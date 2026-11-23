import { getClubManager } from '../data/aiManagers';
import { getPlayerFormerClubs } from '../data/formerClubs';
import uclTeamsRaw from '../data/uclTeams.json';
import type { PlayerConditionMap } from '../types/condition';
import type { OtherLeagueSeasonState } from '../types/game';
import type {
  Club,
  Fixture,
  LeagueId,
  MatchResult,
  PlayerSeasonStats,
  StandingRow,
} from '../types/league';
import type { Player } from '../types/player';
import type {
  UclKnockoutStage,
  UclKnockoutTie,
  UclPhaseStage,
  UclTeamEntry,
  UclTournamentState,
} from '../types/ucl';
import {
  commitAiClubPostMatchConditions,
  prepareAiClubLineupForMatch,
} from './conditionEngine';
import { buildAiClubRoster, getLeagueById, LEAGUES } from './dataLoader';
import {
  simulateExtraTimeAndPenalties,
  simulateMatch,
  USER_CLUB_ID,
  type UserMatchContext,
} from './matchEngine';
import {
  accumulateCompetitionPlayerStats,
  applyRoundResults,
  createInitialPlayerStatsMap,
  createInitialStandings,
  findUserRankOrNull,
  getUserRank,
} from './standingsEngine';

interface RawUclTeamEntry {
  club: Club;
  country: string;
  roster: Player[];
}

export const UCL_EXTERNAL_TEAMS: RawUclTeamEntry[] = (
  uclTeamsRaw as RawUclTeamEntry[]
).map((entry) => ({
  ...entry,
  club: {
    ...entry.club,
    manager: getClubManager(entry.club),
  },
  roster: entry.roster.map((p) => {
    const fc = getPlayerFormerClubs(p);
    return fc.length > 0 ? { ...p, formerClubs: fc } : p;
  }),
}));

export const UCL_KNOCKOUT_ORDER: UclKnockoutStage[] = [
  'playoff',
  'r16',
  'qf',
  'sf',
  'final',
];

export const UCL_STAGE_LABELS: Record<UclPhaseStage, string> = {
  special_transfer: '챔스 특별 이적시장',
  league_phase: '스위스 리그 페이즈',
  playoff: '16강 플레이오프',
  r16: '16강 토너먼트',
  qf: '8강 토너먼트',
  sf: '4강 준결승',
  final: '결승전',
  completed: '대회 종료',
};

const LEAGUE_SHORT_LABEL: Record<LeagueId, string> = {
  epl: 'EPL',
  laliga: '라리가',
  seriea: '세리에 A',
  bundesliga: '분데스리가',
  ligue1: '리그 1',
};

function shuffleArray<T>(items: T[], rng: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function clubRatingScore(club: Club): number {
  return (club.att + club.mid + club.def) / 3;
}

/**
 * Generates an exact 8-round Swiss League Phase schedule for 36 teams across 4 Pots of 9 teams:
 * - 8 rounds * 18 matches = 144 fixtures total
 * - Every team plays exactly 1 match per round (8 total: 4 Home, 4 Away)
 * - Every team plays exactly 2 distinct opponents from each Pot (1 Home, 1 Away per Pot)
 * - Zero duplicate pairings, deterministic O(N) mathematical construction with full randomization.
 */
export function generateSwissSchedule(
  teams: UclTeamEntry[],
  rng: () => number = Math.random,
): Fixture[] {
  const pots: [string[], string[], string[], string[]] = [[], [], [], []];
  for (const t of teams) {
    pots[t.pot - 1].push(t.club.id);
  }

  // Shuffle within each pot so pairings vary fresh every season
  const p0 = shuffleArray(pots[0], rng);
  const p1 = shuffleArray(pots[1], rng);
  const p2 = shuffleArray(pots[2], rng);
  const p3 = shuffleArray(pots[3], rng);

  if (
    p0.length !== 9 ||
    p1.length !== 9 ||
    p2.length !== 9 ||
    p3.length !== 9
  ) {
    throw new Error(
      `UCL Swiss schedule requires 9 teams per pot, got ${p0.length}/${p1.length}/${p2.length}/${p3.length}`,
    );
  }

  const pickDistinctShifts = (): [number, number] => {
    const s1 = Math.floor(rng() * 9);
    const offset = 1 + Math.floor(rng() * 8);
    const s2 = (s1 + offset) % 9;
    return [s1, s2];
  };

  type Pair = [string, string]; // [homeId, awayId]
  const rawRounds: Pair[][] = Array.from({ length: 8 }, () => []);

  // Rounds 0 & 1: Inter-pot (P0 <-> P2) and (P1 <-> P3)
  const [s02a, s02b] = pickDistinctShifts();
  const [s13a, s13b] = pickDistinctShifts();
  for (let i = 0; i < 9; i += 1) {
    rawRounds[0].push([p0[i], p2[(i + s02a) % 9]]);
    rawRounds[0].push([p1[i], p3[(i + s13a) % 9]]);
    rawRounds[1].push([p2[(i + s02b) % 9], p0[i]]);
    rawRounds[1].push([p3[(i + s13b) % 9], p1[i]]);
  }

  // Rounds 2 & 3: Inter-pot (P0 <-> P3) and (P1 <-> P2)
  const [s03a, s03b] = pickDistinctShifts();
  const [s12a, s12b] = pickDistinctShifts();
  for (let i = 0; i < 9; i += 1) {
    rawRounds[2].push([p0[i], p3[(i + s03a) % 9]]);
    rawRounds[2].push([p1[i], p2[(i + s12a) % 9]]);
    rawRounds[3].push([p3[(i + s03b) % 9], p0[i]]);
    rawRounds[3].push([p2[(i + s12b) % 9], p1[i]]);
  }

  // Rounds 4, 5, 6, 7: Intra-pot + adjacent cross-pot for (P0, P1) and (P2, P3)
  const addPairedBlock = (A: string[], B: string[]) => {
    const shift = 1 + Math.floor(rng() * 8);

    // Round 4: 4 intra-A + 4 intra-B + 1 cross (A[8] -> B[8])
    for (const i of [0, 2, 4, 6]) {
      rawRounds[4].push([A[i], A[i + 1]]);
      rawRounds[4].push([B[i], B[i + 1]]);
    }
    rawRounds[4].push([A[8], B[8]]);

    // Round 5: 4 intra-A + 4 intra-B + 1 cross (A[0] -> B[0])
    for (const i of [1, 3, 5, 7]) {
      rawRounds[5].push([A[i], A[i + 1]]);
      rawRounds[5].push([B[i], B[i + 1]]);
    }
    rawRounds[5].push([A[0], B[0]]);

    // Round 6: 1 intra-A (8->0) + 1 intra-B (8->0) + 7 cross (A[1..7] -> B[1..7])
    rawRounds[6].push([A[8], A[0]]);
    rawRounds[6].push([B[8], B[0]]);
    for (let i = 1; i <= 7; i += 1) {
      rawRounds[6].push([A[i], B[i]]);
    }

    // Round 7: 9 cross (B[(i + shift) % 9] -> A[i]) — strictly disjoint from same-index pairs!
    for (let i = 0; i < 9; i += 1) {
      rawRounds[7].push([B[(i + shift) % 9], A[i]]);
    }
  };

  addPairedBlock(p0, p1);
  addPairedBlock(p2, p3);

  // Shuffle the order of the 8 matchdays so Home/Away & Pot order feels organic
  const shuffledRounds = shuffleArray(rawRounds, rng);

  const fixtures: Fixture[] = [];
  shuffledRounds.forEach((pairs, roundIdx) => {
    const roundNum = roundIdx + 1;
    pairs.forEach(([homeTeamId, awayTeamId], matchIdx) => {
      fixtures.push({
        id: `ucl-lp-r${roundNum}-m${matchIdx}`,
        round: roundNum,
        homeTeamId,
        awayTeamId,
        played: false,
      });
    });
  });

  return fixtures;
}

/**
 * Builds the complete 36-Team UEFA Champions League Tournament State from the completed
 * 5-League season standings (Top 4 per league = 20 clubs) + 16 non-Top-5 European clubs.
 * Supports `userParticipated: false` to run a background AI-only UCL when the user finished 5th+
 * so Ballon d'Or & World Best XI are always awarded once after full European competition completion.
 */
export function createUclTournamentState(params: {
  userLeagueId: LeagueId;
  userClub: Club;
  userSquad: Player[];
  userLeagueClubs: Club[];
  userLeagueStandings: StandingRow[];
  userAiRosters: Record<string, Player[]>;
  otherLeagues: Partial<Record<LeagueId, OtherLeagueSeasonState>>;
  excludeIds?: Set<string>;
  userParticipated?: boolean;
  rng?: () => number;
}): {
  ucl: UclTournamentState;
  uclPlayerStats: Record<string, PlayerSeasonStats>;
} {
  const {
    userLeagueId,
    userClub,
    userSquad,
    userLeagueClubs,
    userLeagueStandings,
    userAiRosters,
    otherLeagues,
    excludeIds,
    userParticipated = true,
    rng = Math.random,
  } = params;

  const globalExcludeIds = new Set<string>(excludeIds ?? []);
  for (const p of userSquad) globalExcludeIds.add(p.id);

  const qualifiedEntries: Omit<UclTeamEntry, 'pot'>[] = [];
  const aiRosters: Record<string, Player[]> = {};
  const addedClubIds = new Set<string>();

  const pushClub = (
    club: Club,
    originLeagueId: LeagueId | 'other',
    originLabel: string,
    isLeagueChampion: boolean,
    roster?: Player[],
  ) => {
    if (addedClubIds.has(club.id)) return;
    addedClubIds.add(club.id);
    qualifiedEntries.push({
      club,
      originLabel,
      originLeagueId,
      isLeagueChampion,
    });
    if (club.id !== USER_CLUB_ID) {
      if (roster) {
        aiRosters[club.id] = roster.filter((p) => !globalExcludeIds.has(p.id));
      } else if (userAiRosters[club.id]) {
        aiRosters[club.id] = userAiRosters[club.id];
      } else {
        aiRosters[club.id] = buildAiClubRoster(
          club,
          originLeagueId === 'other' ? 'epl' : originLeagueId,
          globalExcludeIds,
        );
      }
    } else {
      aiRosters[USER_CLUB_ID] = userSquad.slice(0, 11);
    }
  };

  // 1) Top 4 from User's League
  const userLeagueClubMap = new Map(userLeagueClubs.map((c) => [c.id, c]));
  const eligibleUserLeagueRows = userParticipated
    ? userLeagueStandings.slice(0, 4)
    : userLeagueStandings
        .filter((r) => r.teamId !== USER_CLUB_ID)
        .slice(0, 4);
  eligibleUserLeagueRows.forEach((row, idx) => {
    const club =
      row.teamId === USER_CLUB_ID
        ? userClub
        : userLeagueClubMap.get(row.teamId);
    if (!club) return;
    pushClub(
      club,
      userLeagueId,
      `${LEAGUE_SHORT_LABEL[userLeagueId]} ${idx + 1}위`,
      idx === 0,
    );
  });

  // 2) Top 4 from each of the other 4 European leagues
  for (const league of LEAGUES) {
    if (league.id === userLeagueId) continue;
    const bg = otherLeagues[league.id];
    const clubMap = new Map(
      (bg?.clubs ?? league.clubs).map((c) => [c.id, c]),
    );

    const top4Ids = bg
      ? bg.standings.slice(0, 4).map((r) => r.teamId)
      : [...league.clubs]
          .sort((a, b) => clubRatingScore(b) - clubRatingScore(a))
          .slice(0, 4)
          .map((c) => c.id);

    top4Ids.forEach((cid, idx) => {
      const club = clubMap.get(cid);
      if (!club) return;
      pushClub(
        club,
        league.id,
        `${LEAGUE_SHORT_LABEL[league.id]} ${idx + 1}위`,
        idx === 0,
        bg?.aiRosters?.[club.id],
      );
    });
  }

  // 3) 16 non-Top-5 European Clubs from uclTeams.json
  for (const ext of UCL_EXTERNAL_TEAMS) {
    if (qualifiedEntries.length >= 36) break;
    pushClub(ext.club, 'other', ext.country, false, ext.roster);
  }

  // Safety fill if fewer than 36 (should never happen since 20 + 16 = 36)
  if (qualifiedEntries.length < 36) {
    const fallbackLeague = getLeagueById(userLeagueId);
    for (const c of fallbackLeague.clubs) {
      if (qualifiedEntries.length >= 36) break;
      if (!userParticipated && c.id === USER_CLUB_ID) continue;
      pushClub(c, userLeagueId, LEAGUE_SHORT_LABEL[userLeagueId], false);
    }
  }

  // Assign Pots 1..4 (9 teams each): 5 League Champions prioritized in Pot 1, remainder sorted by Club OVR
  const champions = qualifiedEntries
    .filter((e) => e.isLeagueChampion)
    .sort((a, b) => clubRatingScore(b.club) - clubRatingScore(a.club));
  const nonChampions = qualifiedEntries
    .filter((e) => !e.isLeagueChampion)
    .sort((a, b) => clubRatingScore(b.club) - clubRatingScore(a.club));

  const ordered36 = [...champions, ...nonChampions].slice(0, 36);
  const teams: UclTeamEntry[] = ordered36.map((entry, idx) => ({
    ...entry,
    pot: (Math.floor(idx / 9) + 1) as 1 | 2 | 3 | 4,
  }));

  const clubs = teams.map((t) => t.club);
  const leaguePhaseFixtures = generateSwissSchedule(teams, rng);
  const standings = createInitialStandings(clubs);
  const uclPlayerStats = createInitialPlayerStatsMap({
    clubs,
    userClub,
    userSquad: userParticipated ? userSquad : [],
    aiRosters,
  });

  const ucl: UclTournamentState = {
    stage: userParticipated ? 'special_transfer' : 'league_phase',
    teams,
    clubs,
    aiRosters,
    leaguePhaseFixtures,
    leaguePhaseRound: 0,
    standings,
    userLeaguePhaseRank: null,
    enteredViaPlayoff: false,
    knockoutLeg: 1,
    ties: {
      playoff: [],
      r16: [],
      qf: [],
      sf: [],
      final: [],
    },
    userEliminatedAt: null,
    championTeamId: null,
    lastUserMatch: null,
    completed: false,
    userParticipated,
  };

  return { ucl, uclPlayerStats };
}

export function findNextUserUclLeaguePhaseFixture(
  ucl: UclTournamentState,
  userClubId = USER_CLUB_ID,
): Fixture | null {
  if (ucl.stage !== 'league_phase') return null;
  const nextRound = ucl.leaguePhaseRound + 1;
  if (nextRound > 8) return null;
  return (
    ucl.leaguePhaseFixtures.find(
      (f) =>
        f.round === nextRound &&
        !f.played &&
        (f.homeTeamId === userClubId || f.awayTeamId === userClubId),
    ) ?? null
  );
}

/**
 * Builds the 8 two-legged R16 Playoff ties:
 * Seeded (ranks 9..16, Team A - hosts Leg 2) vs Unseeded (ranks 17..24, Team B - hosts Leg 1),
 * pairing modern UEFA brackets: (9/10 vs 23/24), (11/12 vs 21/22), (13/14 vs 19/20), (15/16 vs 17/18).
 */
export function buildPlayoffTies(
  standings: StandingRow[],
  rng: () => number = Math.random,
): UclKnockoutTie[] {
  const seededPairs: [number, number][] = [
    [8, 9], // 9th, 10th
    [10, 11], // 11th, 12th
    [12, 13], // 13th, 14th
    [14, 15], // 15th, 16th
  ];
  const unseededPairs: [number, number][] = [
    [22, 23], // 23rd, 24th
    [20, 21], // 21st, 22nd
    [18, 19], // 19th, 20th
    [16, 17], // 17th, 18th
  ];

  const ties: UclKnockoutTie[] = [];
  for (let b = 0; b < 4; b += 1) {
    const [s1, s2] = seededPairs[b];
    const [u1, u2] = unseededPairs[b];
    const swap = rng() < 0.5;
    const pairs: [StandingRow, StandingRow][] = swap
      ? [
          [standings[s1], standings[u2]],
          [standings[s2], standings[u1]],
        ]
      : [
          [standings[s1], standings[u1]],
          [standings[s2], standings[u2]],
        ];

    for (const [teamA, teamB] of pairs) {
      if (!teamA || !teamB) continue;
      const tieIndex = ties.length;
      ties.push({
        id: `ucl-playoff-${tieIndex}`,
        stage: 'playoff',
        tieIndex,
        teamAId: teamA.teamId,
        teamBId: teamB.teamId,
        aggTeamA: 0,
        aggTeamB: 0,
        winnerId: null,
      });
    }
  }
  return ties;
}

/**
 * Builds the 8 two-legged Round of 16 ties:
 * Top 8 direct qualifiers (Team A - hosts Leg 2) vs 8 Playoff winners (Team B - hosts Leg 1).
 */
export function buildR16Ties(
  standings: StandingRow[],
  playoffTies: UclKnockoutTie[],
  rng: () => number = Math.random,
): UclKnockoutTie[] {
  const top8 = standings.slice(0, 8);
  const playoffWinners = shuffleArray(
    playoffTies
      .map((t) => t.winnerId)
      .filter((id): id is string => Boolean(id)),
    rng,
  );

  // Order bracket slots cleanly so 1st & 2nd are on opposite sides of the bracket
  const orderedSeeds = [0, 7, 3, 4, 2, 5, 1, 6].map((i) => top8[i]);

  return orderedSeeds.map((seedRow, idx) => ({
    id: `ucl-r16-${idx}`,
    stage: 'r16',
    tieIndex: idx,
    teamAId: seedRow.teamId,
    teamBId: playoffWinners[idx] ?? standings[8 + idx]?.teamId ?? '',
    aggTeamA: 0,
    aggTeamB: 0,
    winnerId: null,
  }));
}

function buildNextKnockoutTies(
  stage: 'qf' | 'sf' | 'final',
  prevTies: UclKnockoutTie[],
): UclKnockoutTie[] {
  const ties: UclKnockoutTie[] = [];
  for (let i = 0; i < prevTies.length; i += 2) {
    const w1 = prevTies[i]?.winnerId;
    const w2 = prevTies[i + 1]?.winnerId;
    if (!w1 || !w2) continue;
    ties.push({
      id: `ucl-${stage}-${i / 2}`,
      stage,
      tieIndex: i / 2,
      teamAId: w1,
      teamBId: w2,
      aggTeamA: 0,
      aggTeamB: 0,
      winnerId: null,
    });
  }
  return ties;
}

/**
 * Simulates 1 round (18 matches) of the 36-Team UCL Swiss League Phase.
 * After Round 8, locks `userLeaguePhaseRank`, sets `enteredViaPlayoff` if 9..24,
 * and builds Playoff ties (or marks user eliminated if 25..36).
 */
export function simulateUclLeaguePhaseRound(params: {
  ucl: UclTournamentState;
  uclPlayerStats: Record<string, PlayerSeasonStats>;
  userContext?: UserMatchContext;
  precomputedUserResult?: MatchResult | null;
  /** Multi league: fully resolved results (incl. ET/PK) keyed by fixture id */
  precomputedResults?: Record<string, MatchResult>;
  userClubId?: string;
  conditionMap?: PlayerConditionMap;
  excludeIds?: Set<string>;
  rng?: () => number;
}): {
  ucl: UclTournamentState;
  uclPlayerStats: Record<string, PlayerSeasonStats>;
  userResult: MatchResult | null;
} {
  const {
    ucl,
    uclPlayerStats,
    userContext,
    precomputedUserResult = null,
    precomputedResults,
    userClubId = USER_CLUB_ID,
    conditionMap,
    excludeIds,
    rng = Math.random,
  } = params;

  const targetRound = ucl.leaguePhaseRound + 1;
  if (targetRound > 8) {
    return { ucl, uclPlayerStats, userResult: null };
  }

  const clubsById: Record<string, Club> = Object.fromEntries(
    ucl.clubs.map((c) => [c.id, c]),
  );
  const competitionLabel = `UCL 리그 페이즈 ${targetRound}R`;

  const roundResults: MatchResult[] = [];
  let userResult: MatchResult | null = null;

  const updatedFixtures = ucl.leaguePhaseFixtures.map((fix) => {
    if (fix.round !== targetRound || fix.played) return fix;
    const preResolved = precomputedResults?.[fix.id];
    if (preResolved) {
      const taggedPre: MatchResult = {
        ...preResolved,
        competition: 'ucl',
        competitionLabel,
      };
      roundResults.push(taggedPre);
      return { ...fix, played: true, result: taggedPre };
    }
    const involvesUser =
      fix.homeTeamId === userClubId || fix.awayTeamId === userClubId;
    const homeClub = clubsById[fix.homeTeamId];
    const awayClub = clubsById[fix.awayTeamId];
    const homeIsUser = fix.homeTeamId === userClubId && Boolean(userContext);
    const awayIsUser = fix.awayTeamId === userClubId && Boolean(userContext);

    const homePrep = homeIsUser
      ? null
      : prepareAiClubLineupForMatch({
          club: homeClub,
          baseRoster: ucl.aiRosters[fix.homeTeamId] ?? [],
          conditionMap,
          excludeIds,
        });
    const awayPrep = awayIsUser
      ? null
      : prepareAiClubLineupForMatch({
          club: awayClub,
          baseRoster: ucl.aiRosters[fix.awayTeamId] ?? [],
          conditionMap,
          excludeIds,
        });

    const homeRoster = homeIsUser && userContext
      ? userContext.starters
      : homePrep?.effectiveStarters ?? ucl.aiRosters[fix.homeTeamId] ?? [];
    const awayRoster = awayIsUser && userContext
      ? userContext.starters
      : awayPrep?.effectiveStarters ?? ucl.aiRosters[fix.awayTeamId] ?? [];

    let res: MatchResult;
    if (involvesUser && precomputedUserResult) {
      res = {
        ...precomputedUserResult,
        competition: 'ucl',
        competitionLabel,
      };
    } else {
      const oppId =
        fix.homeTeamId === userClubId ? fix.awayTeamId : fix.homeTeamId;
      const oppIdx = ucl.standings.findIndex((r) => r.teamId === oppId);
      const effectiveUserCtx: UserMatchContext | undefined =
        involvesUser && userContext
          ? {
              ...userContext,
              opponentRank:
                userContext.opponentRank ?? (oppIdx === -1 ? 12 : oppIdx + 1),
            }
          : undefined;
      const base = simulateMatch(
        fix,
        homeClub,
        awayClub,
        homeRoster,
        awayRoster,
        effectiveUserCtx,
        rng,
      );
      res = {
        ...base,
        competition: 'ucl',
        competitionLabel,
      };
    }

    if (homePrep) {
      commitAiClubPostMatchConditions({
        club: homeClub,
        rawStarters: homePrep.rawStarters,
        fullClubSquad: homePrep.fullClubSquad,
        conditionMap,
        competition: 'ucl',
        round: targetRound,
        isShortRest: true,
        outcome:
          res.homeGoals > res.awayGoals
            ? 'W'
            : res.homeGoals < res.awayGoals
              ? 'L'
              : 'D',
        goalDiff: res.homeGoals - res.awayGoals,
        cleanSheet: res.awayGoals === 0,
        rng,
      });
    }
    if (awayPrep) {
      commitAiClubPostMatchConditions({
        club: awayClub,
        rawStarters: awayPrep.rawStarters,
        fullClubSquad: awayPrep.fullClubSquad,
        conditionMap,
        competition: 'ucl',
        round: targetRound,
        isShortRest: true,
        outcome:
          res.awayGoals > res.homeGoals
            ? 'W'
            : res.awayGoals < res.homeGoals
              ? 'L'
              : 'D',
        goalDiff: res.awayGoals - res.homeGoals,
        cleanSheet: res.homeGoals === 0,
        rng,
      });
    }

    if (involvesUser) {
      userResult = res;
    }
    roundResults.push(res);
    return { ...fix, played: true, result: res };
  });

  const applied = applyRoundResults(
    ucl.standings,
    roundResults,
    clubsById,
    uclPlayerStats,
    userClubId,
  );

  let nextStage: UclPhaseStage = 'league_phase';
  let userLeaguePhaseRank = ucl.userLeaguePhaseRank;
  let enteredViaPlayoff = ucl.enteredViaPlayoff;
  let userEliminatedAt = ucl.userEliminatedAt;
  const nextTies = { ...ucl.ties };

  if (targetRound === 8) {
    nextTies.playoff = buildPlayoffTies(applied.standings, rng);
    if (ucl.userParticipated !== false) {
      const rankOrNull = findUserRankOrNull(applied.standings, userClubId);
      if (rankOrNull !== null) {
        userLeaguePhaseRank = rankOrNull;
        if (rankOrNull >= 9 && rankOrNull <= 24) {
          enteredViaPlayoff = true;
        } else if (rankOrNull >= 25) {
          userEliminatedAt = 'league_phase';
        }
      }
    }
    nextStage = 'playoff';
  }

  return {
    ucl: {
      ...ucl,
      stage: nextStage,
      leaguePhaseFixtures: updatedFixtures,
      leaguePhaseRound: targetRound,
      standings: applied.standings,
      userLeaguePhaseRank,
      enteredViaPlayoff,
      knockoutLeg: 1,
      ties: nextTies,
      userEliminatedAt,
      lastUserMatch: userResult ?? ucl.lastUserMatch,
    },
    uclPlayerStats: applied.allPlayerStats,
    userResult,
  };
}

export function findUserActiveKnockoutTie(
  ucl: UclTournamentState,
  userClubId = USER_CLUB_ID,
): UclKnockoutTie | null {
  if (
    ucl.stage === 'special_transfer' ||
    ucl.stage === 'league_phase' ||
    ucl.stage === 'completed'
  ) {
    return null;
  }
  const stageTies = ucl.ties[ucl.stage] ?? [];
  return (
    stageTies.find(
      (t) =>
        t.winnerId === null &&
        (t.teamAId === userClubId || t.teamBId === userClubId),
    ) ?? null
  );
}

/**
 * Returns fixture metadata for the user's current UCL Knockout leg (including 1st-leg aggregate if Leg 2).
 */
export function getUserKnockoutFixtureInfo(
  ucl: UclTournamentState,
  userClubId = USER_CLUB_ID,
): {
  tie: UclKnockoutTie;
  fixture: Fixture;
  isDecider: boolean;
  aggHomeBeforeMatch?: number;
  aggAwayBeforeMatch?: number;
  competitionLabel: string;
} | null {
  const tie = findUserActiveKnockoutTie(ucl, userClubId);
  if (!tie) return null;

  const stageLabel = UCL_STAGE_LABELS[tie.stage];
  if (tie.stage === 'final') {
    return {
      tie,
      fixture: {
        id: `${tie.id}-final`,
        round: 16,
        homeTeamId: tie.teamAId,
        awayTeamId: tie.teamBId,
        played: false,
      },
      isDecider: true,
      competitionLabel: `UCL ${stageLabel}`,
    };
  }

  if (ucl.knockoutLeg === 1) {
    // Leg 1: Team B (lower seed) hosts Team A (higher seed)
    return {
      tie,
      fixture: {
        id: `${tie.id}-leg1`,
        round: 9 + UCL_KNOCKOUT_ORDER.indexOf(tie.stage) * 2,
        homeTeamId: tie.teamBId,
        awayTeamId: tie.teamAId,
        played: false,
      },
      isDecider: false,
      competitionLabel: `UCL ${stageLabel} 1차전`,
    };
  }

  // Leg 2: Team A (higher seed) hosts Team B (lower seed)
  return {
    tie,
    fixture: {
      id: `${tie.id}-leg2`,
      round: 10 + UCL_KNOCKOUT_ORDER.indexOf(tie.stage) * 2,
      homeTeamId: tie.teamAId,
      awayTeamId: tie.teamBId,
      played: false,
    },
    isDecider: true,
    aggHomeBeforeMatch: tie.aggTeamA,
    aggAwayBeforeMatch: tie.aggTeamB,
    competitionLabel: `UCL ${stageLabel} 2차전`,
  };
}

/**
 * Advances the current UCL Knockout leg (Leg 1 -> Leg 2 -> next round, or Final -> Completed).
 * Automatically handles aggregate scores, 2nd-leg Extra Time & Penalties, and stats accumulation.
 */
export function advanceUclKnockoutLeg(params: {
  ucl: UclTournamentState;
  uclPlayerStats: Record<string, PlayerSeasonStats>;
  userContext?: UserMatchContext;
  precomputedUserResult?: MatchResult | null;
  /** Multi league: fully resolved results (incl. ET/PK) keyed by fixture id */
  precomputedResults?: Record<string, MatchResult>;
  userClubId?: string;
  conditionMap?: PlayerConditionMap;
  excludeIds?: Set<string>;
  rng?: () => number;
}): {
  ucl: UclTournamentState;
  uclPlayerStats: Record<string, PlayerSeasonStats>;
  userResult: MatchResult | null;
} {
  const {
    ucl,
    uclPlayerStats,
    userContext,
    precomputedUserResult = null,
    precomputedResults,
    userClubId = USER_CLUB_ID,
    conditionMap,
    excludeIds,
    rng = Math.random,
  } = params;

  if (
    ucl.stage === 'special_transfer' ||
    ucl.stage === 'league_phase' ||
    ucl.stage === 'completed'
  ) {
    return { ucl, uclPlayerStats, userResult: null };
  }

  const stage = ucl.stage;
  const isFinal = stage === 'final';
  const currentLeg = isFinal ? 1 : ucl.knockoutLeg;
  const clubsById: Record<string, Club> = Object.fromEntries(
    ucl.clubs.map((c) => [c.id, c]),
  );

  const stageLabel = UCL_STAGE_LABELS[stage];
  const competitionLabel = isFinal
    ? `UCL ${stageLabel}`
    : `UCL ${stageLabel} ${currentLeg}차전`;

  const legResults: MatchResult[] = [];
  let userResult: MatchResult | null = null;
  let userEliminatedAt = ucl.userEliminatedAt;

  const prepSide = (teamId: string) => {
    if (teamId === userClubId && userContext) {
      return { roster: userContext.starters, aiPrep: null };
    }
    const aiPrep = prepareAiClubLineupForMatch({
      club: clubsById[teamId],
      baseRoster: ucl.aiRosters[teamId] ?? [],
      conditionMap,
      excludeIds,
    });
    return { roster: aiPrep.effectiveStarters, aiPrep };
  };

  const commitSides = (
    homeClub: Club,
    awayClub: Club,
    homeAiPrep: ReturnType<typeof prepareAiClubLineupForMatch> | null,
    awayAiPrep: ReturnType<typeof prepareAiClubLineupForMatch> | null,
    res: MatchResult,
    roundNum: number,
  ) => {
    const wentToEt = Boolean(res.extraTime);
    if (homeAiPrep) {
      commitAiClubPostMatchConditions({
        club: homeClub,
        rawStarters: homeAiPrep.rawStarters,
        fullClubSquad: homeAiPrep.fullClubSquad,
        conditionMap,
        competition: 'ucl',
        round: roundNum,
        isShortRest: true,
        isExtraTime: wentToEt,
        outcome:
          res.homeGoals > res.awayGoals
            ? 'W'
            : res.homeGoals < res.awayGoals
              ? 'L'
              : 'D',
        goalDiff: res.homeGoals - res.awayGoals,
        cleanSheet: res.awayGoals === 0,
        rng,
      });
    }
    if (awayAiPrep) {
      commitAiClubPostMatchConditions({
        club: awayClub,
        rawStarters: awayAiPrep.rawStarters,
        fullClubSquad: awayAiPrep.fullClubSquad,
        conditionMap,
        competition: 'ucl',
        round: roundNum,
        isShortRest: true,
        isExtraTime: wentToEt,
        outcome:
          res.awayGoals > res.homeGoals
            ? 'W'
            : res.awayGoals < res.homeGoals
              ? 'L'
              : 'D',
        goalDiff: res.awayGoals - res.homeGoals,
        cleanSheet: res.homeGoals === 0,
        rng,
      });
    }
  };

  const updatedTies: UclKnockoutTie[] = ucl.ties[stage].map((tie) => {
    const involvesUser =
      tie.teamAId === userClubId || tie.teamBId === userClubId;

    const preResolved =
      precomputedResults?.[
        isFinal ? `${tie.id}-final` : `${tie.id}-leg${currentLeg}`
      ];
    if (preResolved) {
      const res: MatchResult = {
        ...preResolved,
        competition: 'ucl',
        competitionLabel,
      };
      legResults.push(res);
      if (!isFinal && currentLeg === 1) {
        return {
          ...tie,
          leg1: res,
          aggTeamB: res.homeGoals,
          aggTeamA: res.awayGoals,
        };
      }
      const preAggA = isFinal ? res.homeGoals : tie.aggTeamA + res.homeGoals;
      const preAggB = isFinal ? res.awayGoals : tie.aggTeamB + res.awayGoals;
      const preWinnerId = res.extraTime
        ? res.extraTime.winnerTeamId
        : preAggA > preAggB
          ? tie.teamAId
          : tie.teamBId;
      const preDecidedBy: UclKnockoutTie['decidedBy'] = res.extraTime?.penalties
        ? 'penalties'
        : res.extraTime
          ? 'et'
          : 'regular';
      return {
        ...tie,
        ...(isFinal ? { leg1: res } : { leg2: res }),
        aggTeamA: preAggA,
        aggTeamB: preAggB,
        winnerId: preWinnerId,
        decidedBy: preDecidedBy,
        penaltyScoreA: res.extraTime?.penalties?.homePenGoals,
        penaltyScoreB: res.extraTime?.penalties?.awayPenGoals,
      };
    }

    if (isFinal) {
      const homeClub = clubsById[tie.teamAId];
      const awayClub = clubsById[tie.teamBId];
      const homeSide = prepSide(tie.teamAId);
      const awaySide = prepSide(tie.teamBId);
      const homeRoster = homeSide.roster;
      const awayRoster = awaySide.roster;

      let res: MatchResult;
      if (involvesUser && precomputedUserResult) {
        res = {
          ...precomputedUserResult,
          competition: 'ucl',
          competitionLabel,
        };
        if (res.homeGoals === res.awayGoals && !res.extraTime) {
          res = simulateExtraTimeAndPenalties({
            baseResult: res,
            homeClub,
            awayClub,
            homeRoster,
            awayRoster,
            userContext,
            rng,
          });
        }
      } else {
        const base = simulateMatch(
          {
            id: `${tie.id}-final`,
            round: 16,
            homeTeamId: tie.teamAId,
            awayTeamId: tie.teamBId,
            played: false,
          },
          homeClub,
          awayClub,
          homeRoster,
          awayRoster,
          involvesUser ? userContext : undefined,
          rng,
        );
        const tagged: MatchResult = {
          ...base,
          competition: 'ucl',
          competitionLabel,
        };
        res =
          tagged.homeGoals === tagged.awayGoals
            ? simulateExtraTimeAndPenalties({
                baseResult: tagged,
                homeClub,
                awayClub,
                homeRoster,
                awayRoster,
                userContext: involvesUser ? userContext : undefined,
                rng,
              })
            : tagged;
      }

      commitSides(homeClub, awayClub, homeSide.aiPrep, awaySide.aiPrep, res, 16);

      const winnerId = res.extraTime
        ? res.extraTime.winnerTeamId
        : res.homeGoals > res.awayGoals
          ? tie.teamAId
          : tie.teamBId;
      const decidedBy = res.extraTime?.penalties
        ? 'penalties'
        : res.extraTime
          ? 'et'
          : 'regular';

      if (involvesUser) {
        userResult = res;
        if (winnerId !== userClubId) {
          userEliminatedAt = 'final';
        }
      }
      legResults.push(res);

      return {
        ...tie,
        leg1: res,
        aggTeamA: res.homeGoals,
        aggTeamB: res.awayGoals,
        winnerId,
        decidedBy,
        penaltyScoreA: res.extraTime?.penalties?.homePenGoals,
        penaltyScoreB: res.extraTime?.penalties?.awayPenGoals,
      };
    }

    if (currentLeg === 1) {
      // Leg 1: Team B (home) vs Team A (away)
      const homeClub = clubsById[tie.teamBId];
      const awayClub = clubsById[tie.teamAId];
      const homeSide = prepSide(tie.teamBId);
      const awaySide = prepSide(tie.teamAId);
      const homeRoster = homeSide.roster;
      const awayRoster = awaySide.roster;
      const roundNum = 9 + UCL_KNOCKOUT_ORDER.indexOf(stage) * 2;

      let res: MatchResult;
      if (involvesUser && precomputedUserResult) {
        res = {
          ...precomputedUserResult,
          competition: 'ucl',
          competitionLabel,
        };
      } else {
        const base = simulateMatch(
          {
            id: `${tie.id}-leg1`,
            round: roundNum,
            homeTeamId: tie.teamBId,
            awayTeamId: tie.teamAId,
            played: false,
          },
          homeClub,
          awayClub,
          homeRoster,
          awayRoster,
          involvesUser ? userContext : undefined,
          rng,
        );
        res = { ...base, competition: 'ucl', competitionLabel };
      }

      commitSides(homeClub, awayClub, homeSide.aiPrep, awaySide.aiPrep, res, roundNum);

      if (involvesUser) userResult = res;
      legResults.push(res);

      return {
        ...tie,
        leg1: res,
        aggTeamB: res.homeGoals,
        aggTeamA: res.awayGoals,
      };
    }

    // Leg 2: Team A (home) vs Team B (away) — Aggregate decider with ET & PK!
    const homeClub = clubsById[tie.teamAId];
    const awayClub = clubsById[tie.teamBId];
    const homeSide = prepSide(tie.teamAId);
    const awaySide = prepSide(tie.teamBId);
    const homeRoster = homeSide.roster;
    const awayRoster = awaySide.roster;
    const roundNum = 10 + UCL_KNOCKOUT_ORDER.indexOf(stage) * 2;

    const prevAggA = tie.aggTeamA;
    const prevAggB = tie.aggTeamB;

    let res: MatchResult;
    if (involvesUser && precomputedUserResult) {
      res = {
        ...precomputedUserResult,
        competition: 'ucl',
        competitionLabel,
      };
      if (
        prevAggA + res.homeGoals === prevAggB + res.awayGoals &&
        !res.extraTime
      ) {
        res = simulateExtraTimeAndPenalties({
          baseResult: res,
          homeClub,
          awayClub,
          homeRoster,
          awayRoster,
          userContext,
          aggHomeBeforeMatch: prevAggA,
          aggAwayBeforeMatch: prevAggB,
          rng,
        });
      }
    } else {
      const base = simulateMatch(
        {
          id: `${tie.id}-leg2`,
          round: roundNum,
          homeTeamId: tie.teamAId,
          awayTeamId: tie.teamBId,
          played: false,
        },
        homeClub,
        awayClub,
        homeRoster,
        awayRoster,
        involvesUser ? userContext : undefined,
        rng,
      );
      const tagged: MatchResult = {
        ...base,
        competition: 'ucl',
        competitionLabel,
      };
      res =
        prevAggA + tagged.homeGoals === prevAggB + tagged.awayGoals
          ? simulateExtraTimeAndPenalties({
              baseResult: tagged,
              homeClub,
              awayClub,
              homeRoster,
              awayRoster,
              userContext: involvesUser ? userContext : undefined,
              aggHomeBeforeMatch: prevAggA,
              aggAwayBeforeMatch: prevAggB,
              rng,
            })
          : tagged;
    }

    commitSides(homeClub, awayClub, homeSide.aiPrep, awaySide.aiPrep, res, roundNum);

    const finalAggA = prevAggA + res.homeGoals;
    const finalAggB = prevAggB + res.awayGoals;
    const winnerId = res.extraTime
      ? res.extraTime.winnerTeamId
      : finalAggA > finalAggB
        ? tie.teamAId
        : tie.teamBId;
    const decidedBy = res.extraTime?.penalties
      ? 'penalties'
      : res.extraTime
        ? 'et'
        : 'regular';

    if (involvesUser) {
      userResult = res;
      if (winnerId !== userClubId) {
        userEliminatedAt = stage;
      }
    }
    legResults.push(res);

    return {
      ...tie,
      leg2: res,
      aggTeamA: finalAggA,
      aggTeamB: finalAggB,
      winnerId,
      decidedBy,
      penaltyScoreA: res.extraTime?.penalties?.homePenGoals,
      penaltyScoreB: res.extraTime?.penalties?.awayPenGoals,
    };
  });

  const nextStats = accumulateCompetitionPlayerStats(
    uclPlayerStats,
    legResults,
    clubsById,
    userClubId,
  );

  const nextTies: Record<UclKnockoutStage, UclKnockoutTie[]> = {
    ...ucl.ties,
    [stage]: updatedTies,
  };

  let nextStage: UclPhaseStage = stage;
  let nextLeg: 1 | 2 = currentLeg;
  let championTeamId = ucl.championTeamId;
  let completed = ucl.completed;

  if (isFinal) {
    championTeamId = updatedTies[0]?.winnerId ?? null;
    nextStage = 'completed';
    completed = true;
  } else if (currentLeg === 1) {
    nextLeg = 2;
  } else {
    // Stage completed -> build next knockout stage!
    nextLeg = 1;
    if (stage === 'playoff') {
      nextTies.r16 = buildR16Ties(ucl.standings, updatedTies, rng);
      nextStage = 'r16';
    } else if (stage === 'r16') {
      nextTies.qf = buildNextKnockoutTies('qf', updatedTies);
      nextStage = 'qf';
    } else if (stage === 'qf') {
      nextTies.sf = buildNextKnockoutTies('sf', updatedTies);
      nextStage = 'sf';
    } else if (stage === 'sf') {
      nextTies.final = buildNextKnockoutTies('final', updatedTies);
      nextStage = 'final';
    }
  }

  return {
    ucl: {
      ...ucl,
      stage: nextStage,
      knockoutLeg: nextLeg,
      ties: nextTies,
      userEliminatedAt,
      championTeamId,
      lastUserMatch: userResult ?? ucl.lastUserMatch,
      completed,
    },
    uclPlayerStats: nextStats,
    userResult,
  };
}

/**
 * Simulates the rest of the UCL tournament automatically (used when user is eliminated or clicks Fast-Sim to End).
 */
export function simulateUclToCompletion(params: {
  ucl: UclTournamentState;
  uclPlayerStats: Record<string, PlayerSeasonStats>;
  userContext?: UserMatchContext;
  userClubId?: string;
  conditionMap?: PlayerConditionMap;
  excludeIds?: Set<string>;
  rng?: () => number;
}): {
  ucl: UclTournamentState;
  uclPlayerStats: Record<string, PlayerSeasonStats>;
  newUserMatches: MatchResult[];
} {
  let curUcl: UclTournamentState =
    params.ucl.stage === 'special_transfer'
      ? { ...params.ucl, stage: 'league_phase' }
      : params.ucl;
  let curStats = params.uclPlayerStats;
  const newUserMatches: MatchResult[] = [];
  const rng = params.rng ?? Math.random;
  let guard = 0;

  while (!curUcl.completed && guard < 30) {
    guard += 1;
    if (curUcl.stage === 'league_phase') {
      const res = simulateUclLeaguePhaseRound({
        ucl: curUcl,
        uclPlayerStats: curStats,
        userContext: params.userContext,
        userClubId: params.userClubId,
        conditionMap: params.conditionMap,
        excludeIds: params.excludeIds,
        rng,
      });
      curUcl = res.ucl;
      curStats = res.uclPlayerStats;
      if (res.userResult) newUserMatches.push(res.userResult);
    } else {
      const res = advanceUclKnockoutLeg({
        ucl: curUcl,
        uclPlayerStats: curStats,
        userContext: params.userContext,
        userClubId: params.userClubId,
        conditionMap: params.conditionMap,
        excludeIds: params.excludeIds,
        rng,
      });
      curUcl = res.ucl;
      curStats = res.uclPlayerStats;
      if (res.userResult) newUserMatches.push(res.userResult);
    }
  }

  return {
    ucl: curUcl,
    uclPlayerStats: curStats,
    newUserMatches,
  };
}

export interface UclLeaguePhaseSummary {
  finalRank: number;
  points: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  outcome: 'r16' | 'playoff' | 'eliminated';
}

/**
 * Fast-simulates all remaining rounds of the 8-match UCL Swiss League Phase,
 * cleanly transitioning into Playoff / R16 / Eliminated with a structured summary.
 */
export function simulateUclLeaguePhaseToEnd(params: {
  ucl: UclTournamentState;
  uclPlayerStats: Record<string, PlayerSeasonStats>;
  userContext?: UserMatchContext;
  userClubId?: string;
  conditionMap?: PlayerConditionMap;
  excludeIds?: Set<string>;
  rng?: () => number;
}): {
  ucl: UclTournamentState;
  uclPlayerStats: Record<string, PlayerSeasonStats>;
  newUserMatches: MatchResult[];
  summary: UclLeaguePhaseSummary;
} {
  const userClubId = params.userClubId ?? USER_CLUB_ID;
  const rng = params.rng ?? Math.random;
  let curUcl: UclTournamentState =
    params.ucl.stage === 'special_transfer'
      ? { ...params.ucl, stage: 'league_phase' }
      : params.ucl;
  let curStats = params.uclPlayerStats;
  const newUserMatches: MatchResult[] = [];

  let guard = 0;
  while (curUcl.stage === 'league_phase' && curUcl.leaguePhaseRound < 8 && guard < 10) {
    guard += 1;
    const res = simulateUclLeaguePhaseRound({
      ucl: curUcl,
      uclPlayerStats: curStats,
      userContext: params.userContext,
      userClubId,
      conditionMap: params.conditionMap,
      excludeIds: params.excludeIds,
      rng,
    });
    curUcl = res.ucl;
    curStats = res.uclPlayerStats;
    if (res.userResult) {
      newUserMatches.push(res.userResult);
    }
  }

  const finalRank =
    curUcl.userLeaguePhaseRank ?? getUserRank(curUcl.standings, userClubId);
  const userRow = curUcl.standings.find((r) => r.teamId === userClubId);
  const outcome: UclLeaguePhaseSummary['outcome'] =
    finalRank <= 8 ? 'r16' : finalRank <= 24 ? 'playoff' : 'eliminated';

  return {
    ucl: curUcl,
    uclPlayerStats: curStats,
    newUserMatches,
    summary: {
      finalRank,
      points: userRow?.points ?? 0,
      won: userRow?.won ?? 0,
      drawn: userRow?.drawn ?? 0,
      lost: userRow?.lost ?? 0,
      goalsFor: userRow?.goalsFor ?? 0,
      goalsAgainst: userRow?.goalsAgainst ?? 0,
      outcome,
    },
  };
}

/**
 * Resolves all remaining legs of the Playoff stage in a single call (used when the user finished
 * Top 8 with a direct R16 bye so they advance cleanly to R16 in 1 click).
 */
export function advanceUclPlayoffToCompletion(params: {
  ucl: UclTournamentState;
  uclPlayerStats: Record<string, PlayerSeasonStats>;
  userClubId?: string;
  conditionMap?: PlayerConditionMap;
  excludeIds?: Set<string>;
  rng?: () => number;
}): {
  ucl: UclTournamentState;
  uclPlayerStats: Record<string, PlayerSeasonStats>;
} {
  let curUcl = params.ucl;
  let curStats = params.uclPlayerStats;
  const rng = params.rng ?? Math.random;
  let guard = 0;
  while (curUcl.stage === 'playoff' && guard < 4) {
    guard += 1;
    const res = advanceUclKnockoutLeg({
      ucl: curUcl,
      uclPlayerStats: curStats,
      userClubId: params.userClubId,
      conditionMap: params.conditionMap,
      excludeIds: params.excludeIds,
      rng,
    });
    curUcl = res.ucl;
    curStats = res.uclPlayerStats;
  }
  return { ucl: curUcl, uclPlayerStats: curStats };
}

export function getUserUclResultLabel(
  ucl: UclTournamentState | null,
  userClubId = USER_CLUB_ID,
): string {
  if (!ucl || ucl.userParticipated === false) return '미진출';
  if (ucl.championTeamId === userClubId) return '우승';
  if (ucl.userEliminatedAt === 'final') return '준우승';
  if (ucl.userEliminatedAt === 'sf') return '4강';
  if (ucl.userEliminatedAt === 'qf') return '8강';
  if (ucl.userEliminatedAt === 'r16') return '16강';
  if (ucl.userEliminatedAt === 'playoff') return '16강 플레이오프';
  if (ucl.userEliminatedAt === 'league_phase') return '리그 페이즈 탈락';
  return ucl.completed ? '참가' : '진행 중';
}

export function didUserWinUcl(
  ucl: UclTournamentState | null,
  userClubId = USER_CLUB_ID,
): boolean {
  return Boolean(
    ucl && ucl.userParticipated !== false && ucl.championTeamId === userClubId,
  );
}
