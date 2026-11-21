import type { DomesticCupState } from '../types/cup';
import type { OtherLeagueSeasonState } from '../types/game';
import type {
  Club,
  LeagueId,
  MatchResult,
  PlayerSeasonStats,
  StandingRow,
} from '../types/league';
import type { UclQualifiedLeagueEntry } from '../types/phase2';
import type { Player } from '../types/player';
import {
  advanceCupStage,
  createDomesticCupState,
  CUP_STAGE_ORDER,
  checkCupStageTrigger,
} from './cupEngine';
import {
  buildAiClubRoster,
  LEAGUES,
  pickReplacementForAiClub,
} from './dataLoader';
import { simulateMatch, USER_CLUB_ID } from './matchEngine';
import { generateDoubleRoundRobin } from './scheduleEngine';
import { applyRoundResults, createInitialStandings } from './standingsEngine';

const NO_USER_ID = '__bg_no_user__';

function compactCupForStorage(cup: DomesticCupState): DomesticCupState {
  const compactNodes = (nodes: DomesticCupState['rounds']['r16']) =>
    nodes.map((node) =>
      node.result
        ? {
            ...node,
            result: {
              ...node.result,
              events: [],
              playerRatings: [],
              extraTime: node.result.extraTime
                ? {
                    ...node.result.extraTime,
                    etEvents: [],
                  }
                : undefined,
            },
          }
        : node,
    );

  return {
    ...cup,
    rounds: {
      r16: compactNodes(cup.rounds.r16),
      qf: compactNodes(cup.rounds.qf),
      sf: compactNodes(cup.rounds.sf),
      final: compactNodes(cup.rounds.final),
    },
  };
}

function buildBackgroundLeagueRosters(
  leagueId: LeagueId,
  clubs: Club[],
  excludeIds?: Set<string>,
): Record<string, Player[]> {
  const aiRosters: Record<string, Player[]> = {};
  for (const club of clubs) {
    aiRosters[club.id] = buildAiClubRoster(club, leagueId, excludeIds);
  }
  return aiRosters;
}

/**
 * Initializes season schedules, standings, real 11-player club rosters (from activePlayers.json),
 * individual player stat maps, and 16-team Domestic Cup brackets for the 4 European Big-5 leagues
 * not chosen by the user.
 */
export function createOtherLeaguesState(
  userLeagueId: LeagueId,
  excludeIds?: Set<string>,
  rng: () => number = Math.random,
): Partial<Record<LeagueId, OtherLeagueSeasonState>> {
  const map: Partial<Record<LeagueId, OtherLeagueSeasonState>> = {};

  for (const league of LEAGUES) {
    if (league.id === userLeagueId) continue;
    const clubs = league.clubs.map((c) => ({ ...c }));
    const fixtures = generateDoubleRoundRobin(clubs, rng);
    const standings = createInitialStandings(clubs);
    const aiRosters = buildBackgroundLeagueRosters(league.id, clubs, excludeIds);
    const cup = createDomesticCupState(
      league.id,
      clubs,
      league.totalRounds,
      rng,
      NO_USER_ID,
    );

    map[league.id] = {
      leagueId: league.id,
      clubs,
      fixtures,
      currentRound: 0,
      totalRounds: league.totalRounds,
      standings,
      aiRosters,
      playerStats: {},
      cup,
      cupPlayerStats: {},
    };
  }

  return map;
}

/**
 * Ensures older localStorage saves without aiRosters/playerStats/cup are safely hydrated.
 */
function ensureLeagueHydrated(
  leagueState: OtherLeagueSeasonState,
  excludeIds?: Set<string>,
  rng: () => number = Math.random,
): OtherLeagueSeasonState {
  if (
    leagueState.aiRosters &&
    Object.keys(leagueState.aiRosters).length > 0 &&
    leagueState.playerStats &&
    leagueState.cup &&
    leagueState.cupPlayerStats
  ) {
    return leagueState;
  }
  const aiRosters =
    leagueState.aiRosters && Object.keys(leagueState.aiRosters).length > 0
      ? leagueState.aiRosters
      : buildBackgroundLeagueRosters(
          leagueState.leagueId,
          leagueState.clubs,
          excludeIds,
        );
  const cup =
    leagueState.cup ??
    createDomesticCupState(
      leagueState.leagueId,
      leagueState.clubs,
      leagueState.totalRounds,
      rng,
      NO_USER_ID,
    );
  return {
    ...leagueState,
    aiRosters,
    playerStats: leagueState.playerStats ?? {},
    cup,
    cupPlayerStats: leagueState.cupPlayerStats ?? {},
  };
}

/**
 * Simulates 1 round of a background Big-5 league using real club rosters + Poisson match engine,
 * accumulating real per-player league stats and progressing its 16-team Domestic Cup on schedule.
 */
function simulateOtherLeagueOneRound(
  rawLeagueState: OtherLeagueSeasonState,
  rng: () => number,
  excludeIds?: Set<string>,
): OtherLeagueSeasonState {
  const leagueState = ensureLeagueHydrated(rawLeagueState, excludeIds, rng);
  const nextRound = leagueState.currentRound + 1;
  if (nextRound > leagueState.totalRounds) return leagueState;

  const clubsById: Record<string, Club> = {};
  for (const c of leagueState.clubs) clubsById[c.id] = c;
  const aiRosters = leagueState.aiRosters ?? {};

  const roundResults: MatchResult[] = [];
  const updatedFixtures = leagueState.fixtures.map((fixture) => {
    if (fixture.round !== nextRound || fixture.played) return fixture;
    const homeClub = clubsById[fixture.homeTeamId];
    const awayClub = clubsById[fixture.awayTeamId];
    const homeRoster = aiRosters[fixture.homeTeamId] ?? [];
    const awayRoster = aiRosters[fixture.awayTeamId] ?? [];
    const result = simulateMatch(
      fixture,
      homeClub,
      awayClub,
      homeRoster,
      awayRoster,
      undefined,
      rng,
    );
    roundResults.push(result);
    return { ...fixture, played: true };
  });

  const { standings, allPlayerStats } = applyRoundResults(
    leagueState.standings,
    roundResults,
    clubsById,
    leagueState.playerStats ?? {},
    USER_CLUB_ID,
  );

  // Progress background league's Domestic Cup whenever trigger round is reached
  let nextCup = leagueState.cup ?? null;
  let nextCupStats: Record<string, PlayerSeasonStats> =
    leagueState.cupPlayerStats ?? {};

  if (nextCup && !nextCup.completed) {
    let pendingStage = checkCupStageTrigger(nextCup, nextRound);
    while (pendingStage) {
      const advanced = advanceCupStage({
        cup: nextCup,
        stage: pendingStage,
        clubsById,
        aiRosters,
        cupPlayerStats: nextCupStats,
        userClubId: NO_USER_ID,
        rng,
      });
      nextCup = compactCupForStorage(advanced.cup);
      nextCupStats = advanced.cupPlayerStats;
      pendingStage = checkCupStageTrigger(nextCup, nextRound);
    }
  }

  return {
    ...leagueState,
    fixtures: updatedFixtures,
    currentRound: nextRound,
    standings,
    playerStats: allPlayerStats,
    cup: nextCup,
    cupPlayerStats: nextCupStats,
  };
}

/**
 * Synchronizes all 4 background leagues (league matches, real player stats, and domestic cups)
 * to the user league's season progress ratio.
 */
export function advanceOtherLeaguesToProgress(
  otherLeagues: Partial<Record<LeagueId, OtherLeagueSeasonState>> | undefined,
  userCurrentRound: number,
  userTotalRounds: number,
  rng: () => number = Math.random,
  excludeIds?: Set<string>,
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

    let updated = ensureLeagueHydrated(leagueState, excludeIds, rng);
    while (updated.currentRound < targetRound) {
      updated = simulateOtherLeagueOneRound(updated, rng, excludeIds);
    }

    // Guarantee domestic cup finishes when the background league completes all rounds
    if (isSeasonDone && updated.cup && !updated.cup.completed) {
      const clubsById: Record<string, Club> = {};
      for (const c of updated.clubs) clubsById[c.id] = c;
      let cup = updated.cup;
      let cupStats = updated.cupPlayerStats ?? {};
      for (const stage of CUP_STAGE_ORDER) {
        if (cup.completed) break;
        const nodes = cup.rounds[stage];
        if (nodes.some((n) => !n.played)) {
          const advanced = advanceCupStage({
            cup,
            stage,
            clubsById,
            aiRosters: updated.aiRosters ?? {},
            cupPlayerStats: cupStats,
            userClubId: NO_USER_ID,
            rng,
          });
          cup = compactCupForStorage(advanced.cup);
          cupStats = advanced.cupPlayerStats;
        }
      }
      updated = {
        ...updated,
        cup,
        cupPlayerStats: cupStats,
      };
    }

    nextMap[key] = updated;
  }

  return nextMap;
}

/**
 * Removes a mid-season signed player from their original background Big-5 league club roster
 * and promotes a position-matched replacement so the global unique player invariant holds.
 * Accumulated pre-transfer stats in playerStats/cupPlayerStats are preserved for season merging.
 */
export function syncTransferToOtherLeagues(params: {
  otherLeagues: Partial<Record<LeagueId, OtherLeagueSeasonState>> | undefined;
  signedPlayerId: string;
  excludeIds: Set<string>;
}): Partial<Record<LeagueId, OtherLeagueSeasonState>> {
  const { otherLeagues, signedPlayerId, excludeIds } = params;
  if (!otherLeagues) return {};

  const nextMap: Partial<Record<LeagueId, OtherLeagueSeasonState>> = {};
  for (const [key, bg] of Object.entries(otherLeagues) as [
    LeagueId,
    OtherLeagueSeasonState | undefined,
  ][]) {
    if (!bg) continue;
    if (!bg.aiRosters) {
      nextMap[key] = bg;
      continue;
    }

    let modified = false;
    const nextRosters: Record<string, Player[]> = { ...bg.aiRosters };

    for (const club of bg.clubs) {
      const roster = nextRosters[club.id];
      if (!roster) continue;
      const idx = roster.findIndex((p) => p.id === signedPlayerId);
      if (idx === -1) continue;

      const departed = roster[idx];
      const remaining = roster.filter((p) => p.id !== signedPlayerId);
      const clubExclude = new Set<string>([
        ...excludeIds,
        ...remaining.map((p) => p.id),
      ]);
      const replacement = pickReplacementForAiClub({
        club,
        leagueId: bg.leagueId,
        departedPlayer: departed,
        currentRoster: roster,
        excludeIds: clubExclude,
      });
      nextRosters[club.id] = [...remaining, replacement];
      modified = true;
    }

    nextMap[key] = modified ? { ...bg, aiRosters: nextRosters } : bg;
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
