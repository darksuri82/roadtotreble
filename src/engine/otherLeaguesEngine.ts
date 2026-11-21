import type { OtherLeagueSeasonState } from '../types/game';
import type { Club, LeagueId, MatchResult, StandingRow } from '../types/league';
import type { UclQualifiedLeagueEntry } from '../types/phase2';
import { LEAGUES } from './dataLoader';
import { simulateBackgroundClubMatch, USER_CLUB_ID } from './matchEngine';
import { generateDoubleRoundRobin } from './scheduleEngine';
import { applyRoundResults, createInitialStandings } from './standingsEngine';

/**
 * Initializes season schedules and standings for the 4 European Top-5 leagues
 * not chosen by the user, so all 5 leagues progress realistically in parallel.
 */
export function createOtherLeaguesState(
  userLeagueId: LeagueId,
): Partial<Record<LeagueId, OtherLeagueSeasonState>> {
  const map: Partial<Record<LeagueId, OtherLeagueSeasonState>> = {};

  for (const league of LEAGUES) {
    if (league.id === userLeagueId) continue;
    const clubs = league.clubs.map((c) => ({ ...c }));
    const fixtures = generateDoubleRoundRobin(clubs);
    const standings = createInitialStandings(clubs);

    map[league.id] = {
      leagueId: league.id,
      clubs,
      fixtures,
      currentRound: 0,
      totalRounds: league.totalRounds,
      standings,
    };
  }

  return map;
}

/**
 * Simulates 1 round of a background AI-only league using the exact same
 * club ratings + Poisson match engine as the user's league.
 */
function simulateOtherLeagueOneRound(
  leagueState: OtherLeagueSeasonState,
  rng: () => number,
): OtherLeagueSeasonState {
  const nextRound = leagueState.currentRound + 1;
  if (nextRound > leagueState.totalRounds) return leagueState;

  const clubsById: Record<string, Club> = {};
  for (const c of leagueState.clubs) clubsById[c.id] = c;

  const roundResults: MatchResult[] = [];
  const updatedFixtures = leagueState.fixtures.map((fixture) => {
    if (fixture.round !== nextRound || fixture.played) return fixture;
    const homeClub = clubsById[fixture.homeTeamId];
    const awayClub = clubsById[fixture.awayTeamId];
    const result = simulateBackgroundClubMatch(
      fixture,
      homeClub,
      awayClub,
      rng,
    );
    roundResults.push(result);
    return { ...fixture, played: true };
  });

  const { standings } = applyRoundResults(
    leagueState.standings,
    roundResults,
    clubsById,
    {},
    USER_CLUB_ID,
  );

  return {
    ...leagueState,
    fixtures: updatedFixtures,
    currentRound: nextRound,
    standings,
  };
}

/**
 * Synchronizes all 4 background leagues to the user league's season progress ratio.
 * Handles 38R (EPL/LaLiga/SerieA) <-> 34R (Bundesliga/Ligue1) alignment cleanly
 * so all 5 leagues finish together at the end of the season.
 */
export function advanceOtherLeaguesToProgress(
  otherLeagues: Partial<Record<LeagueId, OtherLeagueSeasonState>> | undefined,
  userCurrentRound: number,
  userTotalRounds: number,
  rng: () => number = Math.random,
): Partial<Record<LeagueId, OtherLeagueSeasonState>> {
  if (!otherLeagues) return {};

  const progressRatio =
    userTotalRounds > 0
      ? Math.min(1, Math.max(0, userCurrentRound / userTotalRounds))
      : 0;
  const isSeasonDone = userCurrentRound >= userTotalRounds;

  const nextMap: Partial<Record<LeagueId, OtherLeagueSeasonState>> = {};

  for (const [key, leagueState] of Object.entries(otherLeagues) as [
    LeagueId,
    OtherLeagueSeasonState | undefined,
  ][]) {
    if (!leagueState) continue;
    const targetRound = isSeasonDone
      ? leagueState.totalRounds
      : Math.min(
          leagueState.totalRounds,
          Math.round(progressRatio * leagueState.totalRounds),
        );

    let updated = leagueState;
    while (updated.currentRound < targetRound) {
      updated = simulateOtherLeagueOneRound(updated, rng);
    }
    nextMap[key] = updated;
  }

  return nextMap;
}

/**
 * Extracts the Top 4 Champions League qualifiers from all 5 European leagues (20 clubs total)
 * using actual simulated standings for both the user's league and the 4 background leagues.
 */
export function buildFiveLeagueUclQualifiers(params: {
  userLeagueId: LeagueId;
  userLeagueClubs: Club[];
  userLeagueStandings: StandingRow[];
  otherLeagues?: Partial<Record<LeagueId, OtherLeagueSeasonState>>;
}): UclQualifiedLeagueEntry[] {
  const { userLeagueId, userLeagueClubs, userLeagueStandings, otherLeagues } =
    params;
  const userClubMap = new Map(userLeagueClubs.map((c) => [c.id, c]));

  return LEAGUES.map((league) => {
    if (league.id === userLeagueId) {
      const top4 = userLeagueStandings
        .slice(0, 4)
        .map((row) => userClubMap.get(row.teamId))
        .filter((c): c is Club => Boolean(c));
      return {
        leagueId: league.id,
        leagueKoreanName: league.koreanName,
        teams: top4,
      };
    }

    const bg = otherLeagues?.[league.id];
    if (bg && bg.standings.length >= 4) {
      const bgMap = new Map(bg.clubs.map((c) => [c.id, c]));
      const top4 = bg.standings
        .slice(0, 4)
        .map((row) => bgMap.get(row.teamId))
        .filter((c): c is Club => Boolean(c));
      return {
        leagueId: league.id,
        leagueKoreanName: league.koreanName,
        teams: top4,
      };
    }

    const fallbackTop4 = [...league.clubs]
      .sort((a, b) => b.att + b.mid + b.def - (a.att + a.mid + a.def))
      .slice(0, 4);
    return {
      leagueId: league.id,
      leagueKoreanName: league.koreanName,
      teams: fallbackTop4,
    };
  });
}
