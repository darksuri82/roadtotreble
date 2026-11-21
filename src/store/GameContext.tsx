import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { BENCH_SLOTS, FORMATIONS } from '../data/formations';
import { MANAGER_TRAIT_LIST } from '../data/managerTraits';
import { mergePlayerStatsMaps } from '../engine/analyticsEngine';
import { computeGlobalSeasonAwards, computeSeasonAwards } from '../engine/awardsEngine';
import { calculateChemistry, calculateTeamRatings } from '../engine/chemistryEngine';
import {
  advanceCupStage,
  checkCupStageTrigger,
  createDomesticCupState,
  CUP_STAGE_LABELS,
  CUP_STAGE_ORDER,
  cupNodeToFixture,
  findUserCupMatch,
} from '../engine/cupEngine';
import {
  buildAiClubRoster,
  getLeagueById,
  getWeakestClub,
} from '../engine/dataLoader';
import {
  DEFAULT_ROULETTE_LEGEND_RATE,
  spinClubRoulette,
} from '../engine/draftEngine';
import {
  archiveSeasonToHallOfFame,
  buildCompactMatchHistory,
  computeSeasonScore,
  deleteHallOfFameEntry,
  evaluateAchievements,
  loadLegacyState,
  unlockAchievementsInStorage,
} from '../engine/legacyEngine';
import {
  optimizeBestLineup,
  optimizeCurrentStartersForFormation,
  remapStartersForFormation,
} from '../engine/lineupOptimizer';
import {
  resimulateRemainingSecondHalf,
  simulateExtraTimeAndPenalties,
  simulateFirstHalf,
  simulateMatch,
  simulateSecondHalf,
  USER_CLUB_ID,
} from '../engine/matchEngine';
import {
  advanceOtherLeaguesToProgress,
  buildFiveLeagueUclQualifiers,
  createOtherLeaguesState,
} from '../engine/otherLeaguesEngine';
import {
  buildPhase2HandoffState,
  clearPhase2Handoff,
  savePhase2Handoff,
} from '../engine/phase2Bridge';
import { evaluatePositionFit } from '../engine/positionEngine';
import { generateDoubleRoundRobin } from '../engine/scheduleEngine';
import { MAX_MATCH_SUBS } from '../engine/staminaEngine';
import {
  applyRoundResults,
  createInitialPlayerStatsMap,
  createInitialStandings,
  getUserRank,
} from '../engine/standingsEngine';
import {
  checkTransferWindowTrigger,
  createClosedTransferState,
  createOpenTransferState,
  spinTransferClubs,
} from '../engine/transferEngine';
import {
  advanceUclKnockoutLeg,
  createUclTournamentState,
  findNextUserUclLeaguePhaseFixture,
  getUserKnockoutFixtureInfo,
  simulateUclLeaguePhaseRound,
  simulateUclLeaguePhaseToEnd,
  simulateUclToCompletion,
} from '../engine/uclEngine';
import {
  DEFAULT_MANAGER_AVATAR,
  DEFAULT_MANAGER_NAME,
  type ChemistryResult,
  type FormationId,
  type GameState,
  type ManagerAvatarConfig,
  type ManagerTraitId,
  type SeasonState,
  type TeamRatings,
  type TransferTargetPlayer,
  type UserClubProfile,
} from '../types/game';
import type {
  Club,
  LeagueId,
  LiveSubRecord,
  MatchResult,
  TacticId,
} from '../types/league';
import {
  createInitialTrackers,
  type LegacyStorageState,
  type SeasonAchievementTrackers,
} from '../types/legacy';
import type { Player } from '../types/player';

const GAME_STORAGE_KEY = 'football_draft_game_state_v5';

const DEFAULT_USER_CLUB: UserClubProfile = {
  name: 'FC 유나이티드 드림',
  shortName: 'FUD',
  primaryColor: '#10b981',
  secondaryColor: '#0f172a',
  pattern: 'sash',
};

function createEmptyStarters(): (Player | null)[] {
  return Array.from({ length: 11 }, () => null);
}

function createEmptyBench(): (Player | null)[] {
  return Array.from({ length: 5 }, () => null);
}

function findNextEmptyDraftSlot(
  starters: (Player | null)[],
  bench: (Player | null)[],
): { currentSlotType: 'starter' | 'bench'; currentSlotIndex: number } | null {
  for (let i = 0; i < starters.length; i += 1) {
    if (!starters[i]) return { currentSlotType: 'starter', currentSlotIndex: i };
  }
  for (let i = 0; i < bench.length; i += 1) {
    if (!bench[i]) return { currentSlotType: 'bench', currentSlotIndex: i };
  }
  return null;
}

const ALL_LEAGUE_IDS: LeagueId[] = [
  'epl',
  'laliga',
  'seriea',
  'bundesliga',
  'ligue1',
];

function createInitialState(): GameState {
  return {
    phase: 'title',
    userClub: DEFAULT_USER_CLUB,
    manager: {
      name: DEFAULT_MANAGER_NAME,
      avatar: { ...DEFAULT_MANAGER_AVATAR },
      traitId: null,
      rerollsRemaining: 2,
      hasSpun: false,
    },
    draftLeaguePool: [...ALL_LEAGUE_IDS],
    formation: '4-3-3',
    defaultTactic: 'possession',
    starters: createEmptyStarters(),
    bench: createEmptyBench(),
    draft: {
      currentSlotType: 'starter',
      currentSlotIndex: 0,
      hasSpun: false,
      reels: [],
      completed: false,
    },
    season: null,
    phase2Handoff: null,
  };
}

function getAllSquadIds(
  starters: (Player | null)[],
  bench: (Player | null)[],
): Set<string> {
  const ids = new Set<string>();
  for (const p of starters) if (p) ids.add(p.id);
  for (const p of bench) if (p) ids.add(p.id);
  return ids;
}

function buildUserClubEntry(
  profile: UserClubProfile,
  formation: FormationId,
  defaultTactic: TacticId,
  starters: Player[],
  ratings: TeamRatings,
): Club {
  const top3 = [...starters]
    .sort((a, b) => b.att - a.att)
    .slice(0, 3)
    .map((p) => p.name);

  return {
    id: USER_CLUB_ID,
    name: profile.name,
    shortName: profile.shortName,
    primaryColor: profile.primaryColor,
    secondaryColor: profile.secondaryColor,
    pattern: profile.pattern,
    formation,
    defaultTactic,
    att: ratings.att,
    mid: ratings.mid,
    def: ratings.def,
    topScorers: [
      top3[0] ?? '공격수 1',
      top3[1] ?? '공격수 2',
      top3[2] ?? '미드필더 1',
    ],
    isUser: true,
  };
}

function simulateFullSingleRound(
  season: SeasonState,
  formation: FormationId,
  tactic: TacticId,
  managerTraitId: ManagerTraitId | null,
  starters: Player[],
  bench: Player[] = [],
): SeasonState {
  const nextRound = season.currentRound + 1;
  if (nextRound > season.totalRounds) return season;

  const chem = calculateChemistry(formation, starters, tactic, managerTraitId);
  const ratings = calculateTeamRatings(
    formation,
    starters,
    chem.total,
    managerTraitId,
  );

  const updatedClubs = season.clubs.map((c) =>
    c.id === USER_CLUB_ID
      ? {
          ...c,
          formation,
          defaultTactic: season.defaultTactic,
          att: ratings.att,
          mid: ratings.mid,
          def: ratings.def,
        }
      : c,
  );
  const clubsById: Record<string, Club> = {};
  for (const c of updatedClubs) clubsById[c.id] = c;

  const roundResults: MatchResult[] = [];
  let userMatchResult = season.lastUserMatch;

  const updatedFixtures = season.fixtures.map((fixture) => {
    if (fixture.round !== nextRound || fixture.played) return fixture;
    const homeClub = clubsById[fixture.homeTeamId];
    const awayClub = clubsById[fixture.awayTeamId];
    const homeRoster =
      fixture.homeTeamId === USER_CLUB_ID
        ? starters
        : season.aiRosters[fixture.homeTeamId] ?? [];
    const awayRoster =
      fixture.awayTeamId === USER_CLUB_ID
        ? starters
        : season.aiRosters[fixture.awayTeamId] ?? [];

    const isUserInvolved =
      fixture.homeTeamId === USER_CLUB_ID ||
      fixture.awayTeamId === USER_CLUB_ID;

    let oppRank: number | undefined;
    if (isUserInvolved) {
      const oppId =
        fixture.homeTeamId === USER_CLUB_ID
          ? fixture.awayTeamId
          : fixture.homeTeamId;
      const idx = season.standings.findIndex((r) => r.teamId === oppId);
      oppRank = idx === -1 ? undefined : idx + 1;
    }

    const result = simulateMatch(
      fixture,
      homeClub,
      awayClub,
      homeRoster,
      awayRoster,
      isUserInvolved
        ? {
            userClubId: USER_CLUB_ID,
            starters,
            bench,
            formation,
            tactic,
            chemistry: chem.total,
            ratings,
            managerTraitId,
            opponentRank: oppRank,
            allowAutoSubs: true,
          }
        : undefined,
    );

    roundResults.push(result);
    if (isUserInvolved) {
      userMatchResult = result;
    }

    return { ...fixture, played: true, result };
  });

  const { standings, allPlayerStats } = applyRoundResults(
    season.standings,
    roundResults,
    clubsById,
    season.allPlayerStats,
    USER_CLUB_ID,
  );

  const nextUserHistory =
    userMatchResult && userMatchResult.round === nextRound
      ? [...season.userMatchHistory, userMatchResult]
      : season.userMatchHistory;

  const nextTrackers =
    userMatchResult && userMatchResult.round === nextRound
      ? updateTrackersForUserMatch(season.achievementTrackers, userMatchResult)
      : season.achievementTrackers;

  const syncedOtherLeagues = advanceOtherLeaguesToProgress(
    season.otherLeagues ?? createOtherLeaguesState(season.leagueId),
    nextRound,
    season.totalRounds,
  );

  return {
    ...season,
    clubs: updatedClubs,
    fixtures: updatedFixtures,
    currentRound: nextRound,
    nextMatchTactic: null,
    standings,
    otherLeagues: syncedOtherLeagues,
    lastUserMatch: userMatchResult,
    liveHalftime: null,
    userMatchHistory: nextUserHistory,
    allPlayerStats,
    achievementTrackers: nextTrackers,
  };
}

function updateTrackersForUserMatch(
  trackers: SeasonAchievementTrackers | undefined,
  result: MatchResult,
  userClubId = USER_CLUB_ID,
): SeasonAchievementTrackers {
  const base = trackers ?? createInitialTrackers();
  const isHome = result.homeTeamId === userClubId;
  const isAway = result.awayTeamId === userClubId;
  if (!isHome && !isAway) return base;

  const userGoals = isHome ? result.homeGoals : result.awayGoals;
  const oppGoals = isHome ? result.awayGoals : result.homeGoals;
  const userWon = result.extraTime
    ? result.extraTime.winnerTeamId === userClubId
    : userGoals > oppGoals;

  if (!userWon) return base;

  const htHome = result.halftimeHomeGoals;
  const htAway = result.halftimeAwayGoals;
  if (htHome === undefined || htAway === undefined) return base;

  const htUser = isHome ? htHome : htAway;
  const htOpp = isHome ? htAway : htHome;

  let comebackFrom2DownCount = base.comebackFrom2DownCount;
  let halftimeTacticComebackWins = base.halftimeTacticComebackWins;

  if (htOpp - htUser >= 2) {
    comebackFrom2DownCount += 1;
  }
  if (htOpp > htUser && result.halftimeAdjusted) {
    halftimeTacticComebackWins += 1;
  }

  return {
    ...base,
    comebackFrom2DownCount,
    halftimeTacticComebackWins,
  };
}

function syncCupAfterRound(params: {
  season: SeasonState;
  formation: FormationId;
  tactic: TacticId;
  managerTraitId: ManagerTraitId | null;
  starters: Player[];
  bench: Player[];
  autoResolveUserMatches: boolean;
}): SeasonState {
  const {
    season,
    formation,
    tactic,
    managerTraitId,
    starters,
    bench,
    autoResolveUserMatches,
  } = params;
  if (!season.cup || season.cup.completed) return season;

  let current = season;
  let guard = 0;

  while (current.cup && !current.cup.completed && guard < 4) {
    guard += 1;
    const triggered = checkCupStageTrigger(current.cup, current.currentRound);
    if (!triggered) break;

    const userNode = findUserCupMatch(current.cup, triggered, USER_CLUB_ID);
    if (userNode && !autoResolveUserMatches) {
      // Pause for user to play or skip their Domestic Cup match!
      return {
        ...current,
        cup: {
          ...current.cup,
          pendingStage: triggered,
        },
      };
    }

    // Either user was already eliminated OR fast-simming -> auto-resolve this cup stage
    const chem = calculateChemistry(formation, starters, tactic, managerTraitId);
    const ratings = calculateTeamRatings(
      formation,
      starters,
      chem.total,
      managerTraitId,
    );
    const clubsById: Record<string, Club> = Object.fromEntries(
      current.clubs.map((c) => [
        c.id,
        c.id === USER_CLUB_ID
          ? {
              ...c,
              formation,
              defaultTactic: current.defaultTactic,
              att: ratings.att,
              mid: ratings.mid,
              def: ratings.def,
            }
          : c,
      ]),
    );

    const res = advanceCupStage({
      cup: current.cup,
      stage: triggered,
      clubsById,
      aiRosters: current.aiRosters,
      cupPlayerStats: current.cupPlayerStats,
      userContext: userNode
        ? {
            userClubId: USER_CLUB_ID,
            starters,
            bench,
            formation,
            tactic,
            chemistry: chem.total,
            ratings,
            managerTraitId,
            allowAutoSubs: true,
          }
        : undefined,
    });

    current = {
      ...current,
      cup: res.cup,
      cupPlayerStats: res.cupPlayerStats,
      userCupMatchHistory: res.userResult
        ? [...current.userCupMatchHistory, res.userResult]
        : current.userCupMatchHistory,
      lastUserMatch: res.userResult ?? current.lastUserMatch,
      achievementTrackers: res.userResult
        ? updateTrackersForUserMatch(current.achievementTrackers, res.userResult)
        : current.achievementTrackers,
    };
  }

  return current;
}

function computeSeasonScoreFromState(state: GameState): SeasonState['seasonScore'] {
  if (!state.season) return null;
  const filledStarters = state.starters.filter((p): p is Player => p !== null);
  const chem = calculateChemistry(
    state.formation,
    filledStarters,
    state.season.defaultTactic,
    state.manager.traitId,
  );
  const ratings = calculateTeamRatings(
    state.formation,
    filledStarters,
    chem.total,
    state.manager.traitId,
  );
  const userRow = state.season.standings.find((r) => r.teamId === USER_CLUB_ID);
  const finalRank = getUserRank(state.season.standings, USER_CLUB_ID);

  return computeSeasonScore({
    leaguePoints: userRow?.points ?? 0,
    leaguePlayed: userRow?.played ?? state.season.totalRounds,
    leagueGoalDifference: userRow?.goalDifference ?? 0,
    leagueLosses: userRow?.lost ?? 0,
    finalLeagueRank: finalRank,
    cup: state.season.cup,
    ucl: state.season.ucl,
    teamAvgOvr: ratings.rawOvr,
    awards: state.season.awards,
    globalAwards: state.season.globalAwards ?? null,
  });
}

function finalizeSeasonIfEnded(state: GameState): GameState {
  if (!state.season) return state;
  if (state.season.currentRound < state.season.totalRounds) return state;

  const filledStarters = state.starters.filter((p): p is Player => p !== null);
  const filledBench = state.bench.filter((p): p is Player => p !== null);

  // Ensure any remaining Domestic Cup stages are completed before season summary
  let finalSeason = state.season;
  if (finalSeason.cup && !finalSeason.cup.completed) {
    finalSeason = syncCupAfterRound({
      season: { ...finalSeason, currentRound: finalSeason.totalRounds },
      formation: state.formation,
      tactic: finalSeason.defaultTactic,
      managerTraitId: state.manager.traitId,
      starters: filledStarters,
      bench: filledBench,
      autoResolveUserMatches: true,
    });
  }

  const finalOtherLeagues = advanceOtherLeaguesToProgress(
    finalSeason.otherLeagues ?? createOtherLeaguesState(finalSeason.leagueId),
    finalSeason.totalRounds,
    finalSeason.totalRounds,
  );

  const uclQualifiedSummary = buildFiveLeagueUclQualifiers({
    userLeagueId: finalSeason.leagueId,
    userLeagueClubs: finalSeason.clubs,
    userLeagueStandings: finalSeason.standings,
    otherLeagues: finalOtherLeagues,
  });

  const awards = computeSeasonAwards(
    finalSeason.allPlayerStats,
    finalSeason.standings,
    finalSeason.totalRounds,
  );

  const globalAwards = computeGlobalSeasonAwards({
    allLeaguePlayerStats: finalSeason.allPlayerStats,
    cupPlayerStats: finalSeason.cupPlayerStats,
    uclPlayerStats: finalSeason.uclPlayerStats,
    leagueStandings: finalSeason.standings,
    cup: finalSeason.cup,
    ucl: finalSeason.ucl,
    otherLeagues: finalOtherLeagues,
    userLeagueId: finalSeason.leagueId,
  });

  const handoff = buildPhase2HandoffState({
    userClub: state.userClub,
    managerTraitId: state.manager.traitId,
    leagueId: finalSeason.leagueId,
    formation: state.formation,
    defaultTactic: finalSeason.defaultTactic,
    starters: filledStarters,
    bench: filledBench,
    standings: finalSeason.standings,
    clubsInUserLeague: finalSeason.clubs,
    otherLeagues: finalOtherLeagues,
    playerStats: finalSeason.allPlayerStats,
    awards,
  });

  if (handoff) {
    savePhase2Handoff(handoff);
  }

  const nextState: GameState = {
    ...state,
    phase: 'season_end',
    phase2Handoff: handoff,
    season: {
      ...finalSeason,
      otherLeagues: finalOtherLeagues,
      uclQualifiedSummary,
      liveHalftime: null,
      awards,
      globalAwards,
      transferMarket: createClosedTransferState(
        finalSeason.transferMarket.completedWindows,
        finalSeason.transferMarket.history,
      ),
    },
  };

  return {
    ...nextState,
    season: nextState.season
      ? {
          ...nextState.season,
          seasonScore: computeSeasonScoreFromState(nextState),
        }
      : null,
  };
}

type GameAction =
  | { type: 'START_NEW_CAREER' }
  | { type: 'PROCEED_TO_MANAGER_ROULETTE' }
  | { type: 'BACK_TO_CLUB_SETUP' }
  | { type: 'GO_TO_MANAGER_ROULETTE' }
  | {
      type: 'UPDATE_MANAGER_PROFILE';
      payload: { name?: string; avatar?: Partial<ManagerAvatarConfig> };
    }
  | { type: 'SPIN_MANAGER_TRAIT' }
  | { type: 'CONFIRM_MANAGER_TRAIT' }
  | { type: 'UPDATE_CLUB_PROFILE'; payload: Partial<UserClubProfile> }
  | { type: 'SET_DRAFT_LEAGUE_POOL'; payload: { leagues: LeagueId[] } }
  | { type: 'CHANGE_FORMATION'; payload: { formation: FormationId } }
  | { type: 'AUTO_OPTIMIZE_LINEUP' }
  | { type: 'OPTIMIZE_HALFTIME_STARTERS'; payload?: { tactic?: TacticId } }
  | { type: 'SET_DEFAULT_TACTIC'; payload: { tactic: TacticId } }
  | { type: 'START_DRAFT' }
  | { type: 'SPIN_DRAFT_ROULETTE' }
  | { type: 'PICK_DRAFT_PLAYER'; payload: { player: Player } }
  | { type: 'AUTO_COMPLETE_DRAFT' }
  | {
      type: 'SWAP_SQUAD_POSITIONS';
      payload: {
        from: { area: 'starter' | 'bench'; index: number };
        to: { area: 'starter' | 'bench'; index: number };
      };
    }
  | { type: 'SELECT_LEAGUE'; payload: { leagueId: LeagueId } }
  | { type: 'SET_NEXT_MATCH_TACTIC'; payload: { tactic: TacticId | null } }
  | { type: 'START_LIVE_MATCH' }
  | { type: 'ENTER_HALFTIME_LOCKER' }
  | {
      type: 'START_SECOND_HALF_BROADCAST';
      payload: { secondHalfTactic: TacticId; subPlayerIds?: string[]; firstHalfStarters?: Player[] };
    }
  | {
      type: 'APPLY_SECOND_HALF_LIVE_SUB';
      payload: {
        minute: number;
        subs: {
          starterIndex?: number;
          benchIndex?: number;
          outPlayerId?: string;
          inPlayerId?: string;
        }[];
        nextStarters?: (Player | null)[];
        nextBench?: (Player | null)[];
        firstHalfStarters: Player[];
        halftimeSubIds: string[];
      };
    }
  | { type: 'ENTER_EXTRA_TIME_BREAK' }
  | {
      type: 'START_EXTRA_TIME_BROADCAST';
      payload?: {
        extraSub?: { starterIndex: number; benchIndex: number };
        firstHalfStarters?: Player[];
        halftimeSubIds?: string[];
      };
    }
  | { type: 'ENTER_PENALTY_SHOOTOUT' }
  | {
      type: 'COMMIT_LIVE_MATCH';
      payload?: { secondHalfTactic?: TacticId };
    }
  | { type: 'SIMULATE_SINGLE_MATCH_INSTANT' }
  | {
      type: 'SIMULATE_ONE_FAST_ROUND';
      payload: { stopAtTransfer: boolean; stopAtCup?: boolean };
    }
  | { type: 'SIMULATE_TO_NEXT_TRANSFER' }
  | { type: 'SKIP_TO_SEASON_END' }
  | { type: 'TRANSFER_SPIN_CLUBS' }
  | {
      type: 'TRANSFER_SUBMIT_OFFER';
      payload: {
        target: TransferTargetPlayer;
        outSlot: { area: 'starter' | 'bench'; index: number };
      };
    }
  | { type: 'TRANSFER_CLOSE_WINDOW' }
  | { type: 'MARK_CUP_CELEBRATED' }
  | { type: 'ENTER_UCL_MODE' }
  | { type: 'SIMULATE_UCL_LEAGUE_PHASE_TO_END' }
  | { type: 'SIMULATE_UCL_TO_END' }
  | { type: 'FINISH_UCL_TO_SUMMARY' }
  | { type: 'MARK_LEGACY_ARCHIVED' }
  | { type: 'RESET_GAME' };

function commitLiveMatchResult(
  state: GameState,
  userMatchResult: MatchResult,
): GameState {
  const season = state.season;
  const halftime = season?.liveHalftime ?? null;
  if (!season || !halftime) return state;

  // Restore original pre-match starting XI, bench, and formation so in-match subs
  // only apply to that fixture and never overwrite the user's saved starting lineup!
  const restoredStarters = halftime.preMatchStarters
    ? [...halftime.preMatchStarters]
    : state.starters;
  const restoredBench = halftime.preMatchBench
    ? [...halftime.preMatchBench]
    : state.bench;
  const restoredFormation = halftime.preMatchFormation ?? state.formation;

  const filledStarters = restoredStarters.filter((p): p is Player => p !== null);
  const filledBench = restoredBench.filter((p): p is Player => p !== null);
  const activeTactic = season.defaultTactic;

  const chem = calculateChemistry(
    restoredFormation,
    filledStarters,
    activeTactic,
    state.manager.traitId,
  );
  const ratings = calculateTeamRatings(
    restoredFormation,
    filledStarters,
    chem.total,
    state.manager.traitId,
  );

  const updatedClubs = season.clubs.map((c) =>
    c.id === USER_CLUB_ID
      ? {
          ...c,
          formation: restoredFormation,
          defaultTactic: season.defaultTactic,
          att: ratings.att,
          mid: ratings.mid,
          def: ratings.def,
        }
      : c,
  );
  const clubsById: Record<string, Club> = {};
  for (const c of updatedClubs) clubsById[c.id] = c;

  // --- Branch 1: Domestic Cup Live Match ---
  if (halftime.competition === 'cup' && season.cup?.pendingStage) {
    const stage = season.cup.pendingStage;
    const cupRes = advanceCupStage({
      cup: season.cup,
      stage,
      clubsById,
      aiRosters: season.aiRosters,
      cupPlayerStats: season.cupPlayerStats,
      precomputedUserResult: userMatchResult,
    });
    const finalUserCupMatch = cupRes.userResult ?? userMatchResult;
    const nextSeason: SeasonState = {
      ...season,
      clubs: updatedClubs,
      cup: cupRes.cup,
      cupPlayerStats: cupRes.cupPlayerStats,
      userCupMatchHistory: [...season.userCupMatchHistory, finalUserCupMatch],
      lastUserMatch: finalUserCupMatch,
      liveHalftime: null,
      nextMatchTactic: null,
      achievementTrackers: updateTrackersForUserMatch(
        season.achievementTrackers,
        finalUserCupMatch,
      ),
    };
    return {
      ...state,
      formation: restoredFormation,
      starters: restoredStarters,
      bench: restoredBench,
      season: nextSeason,
    };
  }

  // --- Branch 2: UEFA Champions League Live Match ---
  if (halftime.competition === 'ucl' && season.ucl) {
    const ucl = {
      ...season.ucl,
      clubs: season.ucl.clubs.map((c) =>
        c.id === USER_CLUB_ID
          ? {
              ...c,
              formation: restoredFormation,
              defaultTactic: season.defaultTactic,
              att: ratings.att,
              mid: ratings.mid,
              def: ratings.def,
            }
          : c,
      ),
    };
    const uclRes =
      ucl.stage === 'league_phase'
        ? simulateUclLeaguePhaseRound({
            ucl,
            uclPlayerStats: season.uclPlayerStats,
            precomputedUserResult: userMatchResult,
          })
        : advanceUclKnockoutLeg({
            ucl,
            uclPlayerStats: season.uclPlayerStats,
            precomputedUserResult: userMatchResult,
          });
    const finalUserUclMatch = uclRes.userResult ?? userMatchResult;
    const nextSeason: SeasonState = {
      ...season,
      clubs: updatedClubs,
      ucl: uclRes.ucl,
      uclPlayerStats: uclRes.uclPlayerStats,
      userUclMatchHistory: [...season.userUclMatchHistory, finalUserUclMatch],
      lastUserMatch: finalUserUclMatch,
      liveHalftime: null,
      nextMatchTactic: null,
      achievementTrackers: updateTrackersForUserMatch(
        season.achievementTrackers,
        finalUserUclMatch,
      ),
    };
    return {
      ...state,
      formation: restoredFormation,
      starters: restoredStarters,
      bench: restoredBench,
      season: nextSeason,
    };
  }

  // --- Branch 3: Regular League Live Match ---
  if (state.phase !== 'season') return state;
  const nextRound = halftime.round;

  const roundResults: MatchResult[] = [userMatchResult];
  const updatedFixtures = season.fixtures.map((fixture) => {
    if (fixture.round !== nextRound || fixture.played) return fixture;
    if (fixture.id === halftime.fixtureId) {
      return { ...fixture, played: true, result: userMatchResult };
    }
    const homeClub = clubsById[fixture.homeTeamId];
    const awayClub = clubsById[fixture.awayTeamId];
    const res = simulateMatch(
      fixture,
      homeClub,
      awayClub,
      season.aiRosters[fixture.homeTeamId] ?? [],
      season.aiRosters[fixture.awayTeamId] ?? [],
    );
    roundResults.push(res);
    return { ...fixture, played: true, result: res };
  });

  const { standings, allPlayerStats } = applyRoundResults(
    season.standings,
    roundResults,
    clubsById,
    season.allPlayerStats,
    USER_CLUB_ID,
  );

  const syncedOtherLeagues = advanceOtherLeaguesToProgress(
    season.otherLeagues ?? createOtherLeaguesState(season.leagueId),
    nextRound,
    season.totalRounds,
  );

  let nextSeason: SeasonState = {
    ...season,
    clubs: updatedClubs,
    fixtures: updatedFixtures,
    currentRound: nextRound,
    nextMatchTactic: null,
    standings,
    otherLeagues: syncedOtherLeagues,
    lastUserMatch: userMatchResult,
    liveHalftime: null,
    userMatchHistory: [...season.userMatchHistory, userMatchResult],
    allPlayerStats,
    achievementTrackers: updateTrackersForUserMatch(
      season.achievementTrackers,
      userMatchResult,
    ),
  };

  nextSeason = syncCupAfterRound({
    season: nextSeason,
    formation: restoredFormation,
    tactic: nextSeason.defaultTactic,
    managerTraitId: state.manager.traitId,
    starters: filledStarters,
    bench: filledBench,
    autoResolveUserMatches: false,
  });

  const trigger = checkTransferWindowTrigger(
    nextSeason.currentRound,
    nextSeason.transferWindows,
    nextSeason.transferMarket.completedWindows,
  );
  if (trigger) {
    nextSeason = {
      ...nextSeason,
      transferMarket: createOpenTransferState(
        trigger.windowIndex,
        trigger.triggerRound,
        getUserRank(nextSeason.standings, USER_CLUB_ID),
        nextSeason.transferMarket,
      ),
    };
  }

  return finalizeSeasonIfEnded({
    ...state,
    formation: restoredFormation,
    starters: restoredStarters,
    bench: restoredBench,
    season: nextSeason,
  });
}

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_NEW_CAREER': {
      return {
        ...createInitialState(),
        phase: 'setup',
        userClub: state.userClub,
      };
    }

    case 'PROCEED_TO_MANAGER_ROULETTE': {
      return {
        ...state,
        phase: 'manager_roulette',
      };
    }

    case 'BACK_TO_CLUB_SETUP': {
      return {
        ...state,
        phase: 'setup',
      };
    }

    case 'GO_TO_MANAGER_ROULETTE': {
      return {
        ...createInitialState(),
        phase: 'manager_roulette',
        userClub: state.userClub,
      };
    }

    case 'UPDATE_MANAGER_PROFILE': {
      return {
        ...state,
        manager: {
          ...state.manager,
          name:
            action.payload.name !== undefined
              ? action.payload.name
              : state.manager.name,
          avatar: action.payload.avatar
            ? { ...state.manager.avatar, ...action.payload.avatar }
            : state.manager.avatar,
        },
      };
    }

    case 'SPIN_MANAGER_TRAIT': {
      if (state.manager.hasSpun && state.manager.rerollsRemaining <= 0) {
        return state;
      }
      const pool = MANAGER_TRAIT_LIST.filter(
        (t) => t.id !== state.manager.traitId,
      );
      const chosen = pool[Math.floor(Math.random() * pool.length)];
      const nextRerolls = state.manager.hasSpun
        ? Math.max(0, state.manager.rerollsRemaining - 1)
        : state.manager.rerollsRemaining;

      return {
        ...state,
        manager: {
          ...state.manager,
          traitId: chosen.id,
          rerollsRemaining: nextRerolls,
          hasSpun: true,
        },
      };
    }

    case 'CONFIRM_MANAGER_TRAIT': {
      if (!state.manager.traitId) return state;
      return {
        ...state,
        phase: 'draft',
        starters: createEmptyStarters(),
        bench: createEmptyBench(),
        season: null,
        phase2Handoff: null,
        draft: {
          currentSlotType: 'starter',
          currentSlotIndex: 0,
          hasSpun: false,
          reels: [],
          completed: false,
        },
      };
    }

    case 'UPDATE_CLUB_PROFILE': {
      return {
        ...state,
        userClub: { ...state.userClub, ...action.payload },
      };
    }

    case 'SET_DRAFT_LEAGUE_POOL': {
      return {
        ...state,
        draftLeaguePool: [...action.payload.leagues],
      };
    }

    case 'CHANGE_FORMATION': {
      const nextFormation = action.payload.formation;
      if (nextFormation === state.formation) return state;

      const remappedStarters = remapStartersForFormation(
        state.starters,
        state.formation,
        nextFormation,
        state.manager.traitId,
      );

      // Re-sync draft active slot if switching formation mid-draft
      let nextDraft = state.draft;
      if (state.phase === 'draft' && !state.draft.completed) {
        const nextEmpty = findNextEmptyDraftSlot(remappedStarters, state.bench);
        if (nextEmpty) {
          const targetChanged =
            nextEmpty.currentSlotType !== state.draft.currentSlotType ||
            nextEmpty.currentSlotIndex !== state.draft.currentSlotIndex;
          nextDraft = {
            ...state.draft,
            currentSlotType: nextEmpty.currentSlotType,
            currentSlotIndex: nextEmpty.currentSlotIndex,
            hasSpun: targetChanged ? false : state.draft.hasSpun,
            reels: targetChanged ? [] : state.draft.reels,
          };
        }
      }

      return {
        ...state,
        formation: nextFormation,
        starters: remappedStarters,
        draft: nextDraft,
        season: state.season
          ? {
              ...state.season,
              clubs: state.season.clubs.map((c) =>
                c.id === USER_CLUB_ID ? { ...c, formation: nextFormation } : c,
              ),
            }
          : null,
      };
    }

    case 'AUTO_OPTIMIZE_LINEUP': {
      const currentTactic =
        state.season?.nextMatchTactic ??
        state.season?.defaultTactic ??
        state.defaultTactic;
      const { starters: optStarters, bench: optBench } = optimizeBestLineup(
        state.starters,
        state.bench,
        state.formation,
        currentTactic,
        state.manager.traitId,
      );

      let nextDraft = state.draft;
      if (state.phase === 'draft' && !state.draft.completed) {
        const nextEmpty = findNextEmptyDraftSlot(optStarters, optBench);
        if (nextEmpty) {
          const targetChanged =
            nextEmpty.currentSlotType !== state.draft.currentSlotType ||
            nextEmpty.currentSlotIndex !== state.draft.currentSlotIndex;
          nextDraft = {
            ...state.draft,
            currentSlotType: nextEmpty.currentSlotType,
            currentSlotIndex: nextEmpty.currentSlotIndex,
            hasSpun: targetChanged ? false : state.draft.hasSpun,
            reels: targetChanged ? [] : state.draft.reels,
          };
        }
      }

      return {
        ...state,
        starters: optStarters,
        bench: optBench,
        draft: nextDraft,
      };
    }

    case 'OPTIMIZE_HALFTIME_STARTERS': {
      const currentTactic =
        action.payload?.tactic ??
        state.season?.nextMatchTactic ??
        state.season?.defaultTactic ??
        state.defaultTactic;
      const optStarters = optimizeCurrentStartersForFormation(
        state.starters,
        state.formation,
        currentTactic,
        state.manager.traitId,
      );
      return {
        ...state,
        starters: optStarters,
      };
    }

    case 'SET_DEFAULT_TACTIC': {
      const nextTactic = action.payload.tactic;
      return {
        ...state,
        defaultTactic: nextTactic,
        season: state.season
          ? {
              ...state.season,
              defaultTactic: nextTactic,
              clubs: state.season.clubs.map((c) =>
                c.id === USER_CLUB_ID
                  ? { ...c, defaultTactic: nextTactic }
                  : c,
              ),
            }
          : null,
      };
    }

    case 'START_DRAFT': {
      return {
        ...state,
        phase: 'draft',
        starters: createEmptyStarters(),
        bench: createEmptyBench(),
        season: null,
        phase2Handoff: null,
        draft: {
          currentSlotType: 'starter',
          currentSlotIndex: 0,
          hasSpun: false,
          reels: [],
          completed: false,
        },
      };
    }

    case 'SPIN_DRAFT_ROULETTE': {
      if (state.phase !== 'draft' || state.draft.hasSpun) return state;
      const isStarter = state.draft.currentSlotType === 'starter';
      const slot = isStarter
        ? FORMATIONS[state.formation].slots[state.draft.currentSlotIndex]
        : BENCH_SLOTS[state.draft.currentSlotIndex];

      const excludeIds = getAllSquadIds(state.starters, state.bench);
      const reels = spinClubRoulette(
        slot.subPosition,
        slot.position,
        excludeIds,
        {
          legendRate: DEFAULT_ROULETTE_LEGEND_RATE,
          allowedLeagueIds: state.draftLeaguePool,
        },
      );

      return {
        ...state,
        draft: {
          ...state.draft,
          hasSpun: true,
          reels,
        },
      };
    }

    case 'PICK_DRAFT_PLAYER': {
      if (state.phase !== 'draft' || state.draft.completed) return state;
      const { player } = action.payload;

      const nextStarters = [...state.starters];
      const nextBench = [...state.bench];

      if (state.draft.currentSlotType === 'starter') {
        nextStarters[state.draft.currentSlotIndex] = player;
      } else {
        nextBench[state.draft.currentSlotIndex] = player;
      }

      const nextEmpty = findNextEmptyDraftSlot(nextStarters, nextBench);
      if (nextEmpty) {
        return {
          ...state,
          starters: nextStarters,
          bench: nextBench,
          draft: {
            currentSlotType: nextEmpty.currentSlotType,
            currentSlotIndex: nextEmpty.currentSlotIndex,
            hasSpun: false,
            reels: [],
            completed: false,
          },
        };
      }

      return {
        ...state,
        phase: 'league_select',
        starters: nextStarters,
        bench: nextBench,
        draft: {
          currentSlotType: 'bench',
          currentSlotIndex: 4,
          hasSpun: false,
          reels: [],
          completed: true,
        },
      };
    }

    case 'AUTO_COMPLETE_DRAFT': {
      if (state.phase !== 'draft') return state;
      const nextStarters = [...state.starters];
      const nextBench = [...state.bench];
      const excludeIds = getAllSquadIds(nextStarters, nextBench);
      const formationSlots = FORMATIONS[state.formation].slots;

      for (let i = 0; i < 11; i += 1) {
        if (nextStarters[i]) continue;
        const slot = formationSlots[i];
        const reels =
          state.draft.currentSlotType === 'starter' &&
          state.draft.currentSlotIndex === i &&
          state.draft.hasSpun &&
          state.draft.reels.length > 0
            ? state.draft.reels
            : spinClubRoulette(slot.subPosition, slot.position, excludeIds, {
                legendRate: DEFAULT_ROULETTE_LEGEND_RATE,
                allowedLeagueIds: state.draftLeaguePool,
              });
        const allCandidates = reels.flatMap((r) => r.candidates);
        const best = [...allCandidates].sort(
          (a, b) =>
            evaluatePositionFit(b, slot.subPosition, state.manager.traitId)
              .effectiveOvr -
            evaluatePositionFit(a, slot.subPosition, state.manager.traitId)
              .effectiveOvr,
        )[0];
        if (best) {
          nextStarters[i] = best;
          excludeIds.add(best.id);
        }
      }

      for (let i = 0; i < 5; i += 1) {
        if (nextBench[i]) continue;
        const slot = BENCH_SLOTS[i];
        const reels =
          state.draft.currentSlotType === 'bench' &&
          state.draft.currentSlotIndex === i &&
          state.draft.hasSpun &&
          state.draft.reels.length > 0
            ? state.draft.reels
            : spinClubRoulette(slot.subPosition, slot.position, excludeIds, {
                legendRate: DEFAULT_ROULETTE_LEGEND_RATE,
                allowedLeagueIds: state.draftLeaguePool,
              });
        const allCandidates = reels.flatMap((r) => r.candidates);
        const best = [...allCandidates].sort((a, b) => b.ovr - a.ovr)[0];
        if (best) {
          nextBench[i] = best;
          excludeIds.add(best.id);
        }
      }

      return {
        ...state,
        phase: 'league_select',
        starters: nextStarters,
        bench: nextBench,
        draft: {
          currentSlotType: 'bench',
          currentSlotIndex: 4,
          hasSpun: false,
          reels: [],
          completed: true,
        },
      };
    }

    case 'SWAP_SQUAD_POSITIONS': {
      const { from, to } = action.payload;
      if (from.area === to.area && from.index === to.index) return state;

      const nextStarters = [...state.starters];
      const nextBench = [...state.bench];

      const getP = (loc: { area: 'starter' | 'bench'; index: number }) =>
        loc.area === 'starter' ? nextStarters[loc.index] : nextBench[loc.index];
      const setP = (
        loc: { area: 'starter' | 'bench'; index: number },
        p: Player | null,
      ) => {
        if (loc.area === 'starter') nextStarters[loc.index] = p;
        else nextBench[loc.index] = p;
      };

      const pFrom = getP(from);
      const pTo = getP(to);

      // During draft, allow swapping a placed player with either another player OR an empty slot
      if (state.phase === 'draft') {
        if (!pFrom && !pTo) return state;
      } else {
        if (!pFrom || !pTo) return state;
      }

      setP(from, pTo);
      setP(to, pFrom);

      // Re-sync next empty draft slot if swapping during draft
      let nextDraft = state.draft;
      if (state.phase === 'draft' && !state.draft.completed) {
        const currentTargetNowFilled =
          state.draft.currentSlotType === 'starter'
            ? nextStarters[state.draft.currentSlotIndex] !== null
            : nextBench[state.draft.currentSlotIndex] !== null;

        if (!state.draft.hasSpun || currentTargetNowFilled) {
          const nextEmpty = findNextEmptyDraftSlot(nextStarters, nextBench);
          if (nextEmpty) {
            const targetChanged =
              nextEmpty.currentSlotType !== state.draft.currentSlotType ||
              nextEmpty.currentSlotIndex !== state.draft.currentSlotIndex;
            nextDraft = {
              ...state.draft,
              currentSlotType: nextEmpty.currentSlotType,
              currentSlotIndex: nextEmpty.currentSlotIndex,
              hasSpun: targetChanged ? false : state.draft.hasSpun,
              reels: targetChanged ? [] : state.draft.reels,
            };
          }
        }
      }

      // Track halftime sub count & sub record if a starter <-> bench swap occurred during live halftime
      const isBenchSub = from.area !== to.area;
      let nextSeason = state.season;
      if (
        state.season &&
        state.season.liveHalftime &&
        state.season.liveHalftime.phase === 'halftime' &&
        isBenchSub
      ) {
        const starterIdx = from.area === 'starter' ? from.index : to.index;
        const benchIdx = from.area === 'bench' ? from.index : to.index;
        const outP = state.starters[starterIdx];
        const inP = state.bench[benchIdx];
        const prevSubs = state.season.liveHalftime.liveSubs ?? [];
        const addedSub: LiveSubRecord[] =
          outP && inP
            ? [
                {
                  minute: 45,
                  outPlayerId: outP.id,
                  outPlayerName: outP.name,
                  inPlayerId: inP.id,
                  inPlayerName: inP.name,
                  slotIndex: starterIdx,
                },
              ]
            : [];
        nextSeason = {
          ...state.season,
          liveHalftime: {
            ...state.season.liveHalftime,
            halftimeSubsMade: state.season.liveHalftime.halftimeSubsMade + 1,
            liveSubs: [...prevSubs, ...addedSub],
          },
        };
      }

      return {
        ...state,
        starters: nextStarters,
        bench: nextBench,
        draft: nextDraft,
        season: nextSeason,
      };
    }

    case 'SELECT_LEAGUE': {
      const league = getLeagueById(action.payload.leagueId);
      const weakest = getWeakestClub(league);
      const filledStarters = state.starters.filter((p): p is Player => p !== null);
      const filledBench = state.bench.filter((p): p is Player => p !== null);

      const chem = calculateChemistry(
        state.formation,
        filledStarters,
        state.defaultTactic,
        state.manager.traitId,
      );
      const ratings = calculateTeamRatings(
        state.formation,
        filledStarters,
        chem.total,
        state.manager.traitId,
      );
      const userClubEntry = buildUserClubEntry(
        state.userClub,
        state.formation,
        state.defaultTactic,
        filledStarters,
        ratings,
      );

      const clubs = league.clubs.map((c) =>
        c.id === weakest.id ? userClubEntry : c,
      );

      const aiRosters: Record<string, Player[]> = {};
      for (const c of clubs) {
        if (c.id !== USER_CLUB_ID) {
          aiRosters[c.id] = buildAiClubRoster(c, league.id);
        }
      }

      const fixtures = generateDoubleRoundRobin(clubs);
      const standings = createInitialStandings(clubs);
      const allPlayerStats = createInitialPlayerStatsMap({
        clubs,
        userClub: userClubEntry,
        userSquad: [...filledStarters, ...filledBench],
        aiRosters,
      });
      const cup = createDomesticCupState(league.id, clubs, league.totalRounds);
      const cupPlayerStats = createInitialPlayerStatsMap({
        clubs,
        userClub: userClubEntry,
        userSquad: [...filledStarters, ...filledBench],
        aiRosters,
      });

      const season: SeasonState = {
        leagueId: league.id,
        replacedClubName: weakest.name,
        defaultTactic: state.defaultTactic,
        nextMatchTactic: null,
        clubs,
        aiRosters,
        fixtures,
        currentRound: 0,
        totalRounds: league.totalRounds,
        transferWindows: league.transferWindows,
        standings,
        otherLeagues: createOtherLeaguesState(league.id),
        lastUserMatch: null,
        liveHalftime: null,
        userMatchHistory: [],
        allPlayerStats,
        transferMarket: createClosedTransferState(),
        awards: null,
        cup,
        cupPlayerStats,
        userCupMatchHistory: [],
        ucl: null,
        uclPlayerStats: {},
        userUclMatchHistory: [],
        achievementTrackers: createInitialTrackers(),
        seasonScore: null,
        legacyArchived: false,
      };

      return {
        ...state,
        phase: 'season',
        season,
        phase2Handoff: null,
      };
    }

    case 'SET_NEXT_MATCH_TACTIC': {
      if (!state.season) return state;
      return {
        ...state,
        season: {
          ...state.season,
          nextMatchTactic: action.payload.tactic,
        },
      };
    }

    case 'START_LIVE_MATCH': {
      if ((state.phase !== 'season' && state.phase !== 'ucl') || !state.season) {
        return state;
      }
      if (state.season.transferMarket.isOpen || state.season.liveHalftime) {
        return state;
      }

      const filledStarters = state.starters.filter((p): p is Player => p !== null);
      const activeTactic =
        state.season.nextMatchTactic ?? state.season.defaultTactic;
      const chem = calculateChemistry(
        state.formation,
        filledStarters,
        activeTactic,
        state.manager.traitId,
      );
      const ratings = calculateTeamRatings(
        state.formation,
        filledStarters,
        chem.total,
        state.manager.traitId,
      );

      let userFixture: SeasonState['fixtures'][number] | null = null;
      let competition: 'league' | 'cup' | 'ucl' = 'league';
      let competitionLabel = '';
      let isKnockoutDecider = false;
      let aggHomeBeforeMatch: number | undefined;
      let aggAwayBeforeMatch: number | undefined;
      let activeClubs: Club[] = state.season.clubs;
      let activeAiRosters: Record<string, Player[]> = state.season.aiRosters;
      let activeStandings = state.season.standings;

      if (state.phase === 'ucl' && state.season.ucl) {
        const ucl = state.season.ucl;
        if (ucl.stage === 'special_transfer' || ucl.stage === 'completed') {
          return state;
        }
        competition = 'ucl';
        activeClubs = ucl.clubs;
        activeAiRosters = ucl.aiRosters;
        activeStandings = ucl.standings;

        if (ucl.stage === 'league_phase') {
          userFixture = findNextUserUclLeaguePhaseFixture(ucl, USER_CLUB_ID);
          competitionLabel = `UCL 리그 페이즈 ${ucl.leaguePhaseRound + 1}R`;
          isKnockoutDecider = false;
        } else {
          const ko = getUserKnockoutFixtureInfo(ucl, USER_CLUB_ID);
          if (!ko) return state;
          userFixture = ko.fixture;
          competitionLabel = ko.competitionLabel;
          isKnockoutDecider = ko.isDecider;
          aggHomeBeforeMatch = ko.aggHomeBeforeMatch;
          aggAwayBeforeMatch = ko.aggAwayBeforeMatch;
        }
      } else if (state.season.cup?.pendingStage) {
        const stage = state.season.cup.pendingStage;
        const userNode = findUserCupMatch(state.season.cup, stage, USER_CLUB_ID);
        if (!userNode) return state;
        competition = 'cup';
        competitionLabel = `${state.season.cup.meta.koreanName} ${CUP_STAGE_LABELS[stage]}`;
        isKnockoutDecider = true;
        userFixture = cupNodeToFixture(
          userNode,
          CUP_STAGE_ORDER.indexOf(stage) + 1,
        );
      } else {
        const nextRound = state.season.currentRound + 1;
        if (nextRound > state.season.totalRounds) return state;
        userFixture =
          state.season.fixtures.find(
            (f) =>
              f.round === nextRound &&
              (f.homeTeamId === USER_CLUB_ID || f.awayTeamId === USER_CLUB_ID),
          ) ?? null;
        const league = getLeagueById(state.season.leagueId);
        competitionLabel = `${league.koreanName} ${nextRound}R`;
      }

      if (!userFixture) return state;

      const clubsById: Record<string, Club> = {};
      for (const c of activeClubs) {
        clubsById[c.id] =
          c.id === USER_CLUB_ID
            ? {
                ...c,
                formation: state.formation,
                att: ratings.att,
                mid: ratings.mid,
                def: ratings.def,
              }
            : c;
      }

      const homeClub = clubsById[userFixture.homeTeamId];
      const awayClub = clubsById[userFixture.awayTeamId];
      if (!homeClub || !awayClub) return state;

      const homeRoster =
        userFixture.homeTeamId === USER_CLUB_ID
          ? filledStarters
          : activeAiRosters[userFixture.homeTeamId] ?? [];
      const awayRoster =
        userFixture.awayTeamId === USER_CLUB_ID
          ? filledStarters
          : activeAiRosters[userFixture.awayTeamId] ?? [];

      const oppId =
        userFixture.homeTeamId === USER_CLUB_ID
          ? userFixture.awayTeamId
          : userFixture.homeTeamId;
      const oppIdx = activeStandings.findIndex((r) => r.teamId === oppId);

      const halftime = simulateFirstHalf({
        fixture: userFixture,
        homeClub,
        awayClub,
        homeRoster,
        awayRoster,
        userContext: {
          userClubId: USER_CLUB_ID,
          starters: filledStarters,
          formation: state.formation,
          tactic: activeTactic,
          chemistry: chem.total,
          ratings,
          managerTraitId: state.manager.traitId,
          opponentRank: oppIdx === -1 ? undefined : oppIdx + 1,
        },
      });

      return {
        ...state,
        season: {
          ...state.season,
          liveHalftime: {
            ...halftime,
            competition,
            competitionLabel,
            isKnockoutDecider,
            aggHomeBeforeMatch,
            aggAwayBeforeMatch,
            preMatchStarters: [...state.starters],
            preMatchBench: [...state.bench],
            preMatchFormation: state.formation,
          },
        },
      };
    }

    case 'ENTER_HALFTIME_LOCKER': {
      const season = state.season;
      const halftime = season?.liveHalftime ?? null;
      if (!season || !halftime) return state;
      return {
        ...state,
        season: {
          ...season,
          liveHalftime: {
            ...halftime,
            phase: 'halftime',
          },
        },
      };
    }

    case 'START_SECOND_HALF_BROADCAST': {
      const season = state.season;
      const halftime = season?.liveHalftime ?? null;
      if (
        (state.phase !== 'season' && state.phase !== 'ucl') ||
        !season ||
        !halftime
      ) {
        return state;
      }

      const filledStarters = state.starters.filter((p): p is Player => p !== null);
      const filledBench = state.bench.filter((p): p is Player => p !== null);
      const { secondHalfTactic, subPlayerIds, firstHalfStarters } = action.payload;

      const chem = calculateChemistry(
        state.formation,
        filledStarters,
        secondHalfTactic,
        state.manager.traitId,
      );
      const ratings = calculateTeamRatings(
        state.formation,
        filledStarters,
        chem.total,
        state.manager.traitId,
      );

      const activeClubs =
        halftime.competition === 'ucl' && season.ucl
          ? season.ucl.clubs
          : season.clubs;
      const activeAiRosters =
        halftime.competition === 'ucl' && season.ucl
          ? season.ucl.aiRosters
          : season.aiRosters;
      const activeStandings =
        halftime.competition === 'ucl' && season.ucl
          ? season.ucl.standings
          : season.standings;

      const clubsById: Record<string, Club> = {};
      for (const c of activeClubs) {
        clubsById[c.id] =
          c.id === USER_CLUB_ID
            ? {
                ...c,
                formation: state.formation,
                att: ratings.att,
                mid: ratings.mid,
                def: ratings.def,
              }
            : c;
      }

      const oppId = halftime.isUserHome
        ? halftime.awayTeamId
        : halftime.homeTeamId;
      const oppIdx = activeStandings.findIndex((r) => r.teamId === oppId);

      const userMatchResult = simulateSecondHalf({
        halftime,
        homeClub: clubsById[halftime.homeTeamId],
        awayClub: clubsById[halftime.awayTeamId],
        homeRoster: halftime.isUserHome
          ? filledStarters
          : activeAiRosters[halftime.homeTeamId] ?? [],
        awayRoster: halftime.isUserHome
          ? activeAiRosters[halftime.awayTeamId] ?? []
          : filledStarters,
        userContext: {
          userClubId: USER_CLUB_ID,
          starters: filledStarters,
          bench: filledBench,
          formation: state.formation,
          tactic: secondHalfTactic,
          chemistry: chem.total,
          ratings,
          managerTraitId: state.manager.traitId,
          opponentRank: oppIdx === -1 ? undefined : oppIdx + 1,
          halftimeSubIds: subPlayerIds,
          firstHalfStarters,
          liveSubs: halftime.liveSubs ?? [],
        },
      });

      return {
        ...state,
        season: {
          ...season,
          liveHalftime: {
            ...halftime,
            phase: 'second_half',
            fullMatchResult: userMatchResult,
          },
        },
      };
    }

    case 'APPLY_SECOND_HALF_LIVE_SUB': {
      const season = state.season;
      const halftime = season?.liveHalftime ?? null;
      const currentResult = halftime?.fullMatchResult ?? null;
      if (
        (state.phase !== 'season' && state.phase !== 'ucl') ||
        !season ||
        !halftime ||
        halftime.phase !== 'second_half' ||
        !currentResult
      ) {
        return state;
      }

      const {
        minute,
        subs,
        nextStarters: payloadStarters,
        nextBench: payloadBench,
        firstHalfStarters,
        halftimeSubIds,
      } = action.payload;

      const remainingAllowed = Math.max(
        0,
        MAX_MATCH_SUBS - halftime.halftimeSubsMade,
      );
      const validSubs = subs.slice(0, remainingAllowed);

      let nextStarters = [...state.starters];
      let nextBench = [...state.bench];
      const newSubRecords: LiveSubRecord[] = [];

      const hasExplicitLineup =
        Array.isArray(payloadStarters) &&
        payloadStarters.length === 11 &&
        Array.isArray(payloadBench) &&
        payloadBench.length === 5;

      if (hasExplicitLineup) {
        const playerById = new Map<string, Player>();
        for (const p of [...state.starters, ...state.bench]) {
          if (p) playerById.set(p.id, p);
        }
        nextStarters = [...payloadStarters];
        nextBench = [...payloadBench];

        for (const s of validSubs) {
          const outP = s.outPlayerId
            ? playerById.get(s.outPlayerId)
            : s.starterIndex !== undefined
              ? state.starters[s.starterIndex]
              : null;
          const inP = s.inPlayerId
            ? playerById.get(s.inPlayerId)
            : s.benchIndex !== undefined
              ? state.bench[s.benchIndex]
              : null;
          if (!outP || !inP) continue;
          const finalSlotIdx = nextStarters.findIndex((p) => p?.id === inP.id);
          newSubRecords.push({
            minute,
            outPlayerId: outP.id,
            outPlayerName: outP.name,
            inPlayerId: inP.id,
            inPlayerName: inP.name,
            slotIndex: finalSlotIdx >= 0 ? finalSlotIdx : (s.starterIndex ?? 0),
          });
        }
      } else {
        if (validSubs.length === 0) return state;
        for (const s of validSubs) {
          if (s.starterIndex === undefined || s.benchIndex === undefined) continue;
          const outP = nextStarters[s.starterIndex];
          const inP = nextBench[s.benchIndex];
          if (!outP || !inP) continue;
          nextStarters[s.starterIndex] = inP;
          nextBench[s.benchIndex] = outP;
          newSubRecords.push({
            minute,
            outPlayerId: outP.id,
            outPlayerName: outP.name,
            inPlayerId: inP.id,
            inPlayerName: inP.name,
            slotIndex: s.starterIndex,
          });
        }
      }

      const lineupPositionsChanged = nextStarters.some(
        (p, idx) => p?.id !== state.starters[idx]?.id,
      );
      if (newSubRecords.length === 0 && !lineupPositionsChanged) return state;

      const filledStarters = nextStarters.filter((p): p is Player => p !== null);
      const filledBench = nextBench.filter((p): p is Player => p !== null);
      const userTactic = halftime.isUserHome
        ? currentResult.homeTactic
        : currentResult.awayTactic;

      const chem = calculateChemistry(
        state.formation,
        filledStarters,
        userTactic,
        state.manager.traitId,
      );
      const ratings = calculateTeamRatings(
        state.formation,
        filledStarters,
        chem.total,
        state.manager.traitId,
      );

      const activeClubs =
        halftime.competition === 'ucl' && season.ucl
          ? season.ucl.clubs
          : season.clubs;
      const activeAiRosters =
        halftime.competition === 'ucl' && season.ucl
          ? season.ucl.aiRosters
          : season.aiRosters;
      const activeStandings =
        halftime.competition === 'ucl' && season.ucl
          ? season.ucl.standings
          : season.standings;

      const clubsById: Record<string, Club> = {};
      for (const c of activeClubs) {
        clubsById[c.id] =
          c.id === USER_CLUB_ID
            ? {
                ...c,
                formation: state.formation,
                att: ratings.att,
                mid: ratings.mid,
                def: ratings.def,
              }
            : c;
      }

      const oppId = halftime.isUserHome
        ? halftime.awayTeamId
        : halftime.homeTeamId;
      const oppIdx = activeStandings.findIndex((r) => r.teamId === oppId);
      const allSubsSoFar = [...(halftime.liveSubs ?? []), ...newSubRecords];

      const updatedResult = resimulateRemainingSecondHalf({
        halftime,
        currentResult,
        fromMinute: minute,
        newSubs: newSubRecords,
        allSubsSoFar,
        homeClub: clubsById[halftime.homeTeamId],
        awayClub: clubsById[halftime.awayTeamId],
        homeRoster: halftime.isUserHome
          ? filledStarters
          : activeAiRosters[halftime.homeTeamId] ?? [],
        awayRoster: halftime.isUserHome
          ? activeAiRosters[halftime.awayTeamId] ?? []
          : filledStarters,
        userContext: {
          userClubId: USER_CLUB_ID,
          starters: filledStarters,
          bench: filledBench,
          formation: state.formation,
          tactic: userTactic,
          chemistry: chem.total,
          ratings,
          managerTraitId: state.manager.traitId,
          opponentRank: oppIdx === -1 ? undefined : oppIdx + 1,
          halftimeSubIds,
          firstHalfStarters,
          liveSubs: allSubsSoFar,
        },
      });

      return {
        ...state,
        starters: nextStarters,
        bench: nextBench,
        season: {
          ...season,
          liveHalftime: {
            ...halftime,
            halftimeSubsMade: halftime.halftimeSubsMade + newSubRecords.length,
            liveSubs: allSubsSoFar,
            fullMatchResult: updatedResult,
          },
        },
      };
    }

    case 'ENTER_EXTRA_TIME_BREAK': {
      const season = state.season;
      const halftime = season?.liveHalftime ?? null;
      if (!season || !halftime || !halftime.fullMatchResult) return state;
      return {
        ...state,
        season: {
          ...season,
          liveHalftime: {
            ...halftime,
            phase: 'extra_time_break',
          },
        },
      };
    }

    case 'START_EXTRA_TIME_BROADCAST': {
      const season = state.season;
      const halftime = season?.liveHalftime ?? null;
      const baseResult = halftime?.fullMatchResult ?? null;
      if (!season || !halftime || !baseResult) return state;

      const nextStarters = [...state.starters];
      const nextBench = [...state.bench];
      const extraSubRecords: LiveSubRecord[] = [];
      const extraSubIds: string[] = [];

      // Allow 1 extra substitution in Extra Time (up to MAX_MATCH_SUBS + 1 = 6 total)
      const extraSub = action.payload?.extraSub;
      if (extraSub && halftime.halftimeSubsMade < MAX_MATCH_SUBS + 1) {
        const outP = nextStarters[extraSub.starterIndex];
        const inP = nextBench[extraSub.benchIndex];
        if (outP && inP) {
          nextStarters[extraSub.starterIndex] = inP;
          nextBench[extraSub.benchIndex] = outP;
          extraSubIds.push(inP.id);
          extraSubRecords.push({
            minute: 90,
            outPlayerId: outP.id,
            outPlayerName: outP.name,
            inPlayerId: inP.id,
            inPlayerName: inP.name,
            slotIndex: extraSub.starterIndex,
          });
        }
      }

      const filledStarters = nextStarters.filter((p): p is Player => p !== null);
      const filledBench = nextBench.filter((p): p is Player => p !== null);
      const userTactic = halftime.isUserHome
        ? baseResult.homeTactic
        : baseResult.awayTactic;

      const chem = calculateChemistry(
        state.formation,
        filledStarters,
        userTactic,
        state.manager.traitId,
      );
      const ratings = calculateTeamRatings(
        state.formation,
        filledStarters,
        chem.total,
        state.manager.traitId,
      );

      const activeClubs =
        halftime.competition === 'ucl' && season.ucl
          ? season.ucl.clubs
          : season.clubs;
      const activeAiRosters =
        halftime.competition === 'ucl' && season.ucl
          ? season.ucl.aiRosters
          : season.aiRosters;

      const clubsById: Record<string, Club> = {};
      for (const c of activeClubs) {
        clubsById[c.id] =
          c.id === USER_CLUB_ID
            ? {
                ...c,
                formation: state.formation,
                att: ratings.att,
                mid: ratings.mid,
                def: ratings.def,
              }
            : c;
      }

      const allSubsSoFar = [...(halftime.liveSubs ?? []), ...extraSubRecords];
      const etResult = simulateExtraTimeAndPenalties({
        baseResult,
        homeClub: clubsById[halftime.homeTeamId],
        awayClub: clubsById[halftime.awayTeamId],
        homeRoster: halftime.isUserHome
          ? filledStarters
          : activeAiRosters[halftime.homeTeamId] ?? [],
        awayRoster: halftime.isUserHome
          ? activeAiRosters[halftime.awayTeamId] ?? []
          : filledStarters,
        userContext: {
          userClubId: USER_CLUB_ID,
          starters: filledStarters,
          bench: filledBench,
          formation: state.formation,
          tactic: userTactic,
          chemistry: chem.total,
          ratings,
          managerTraitId: state.manager.traitId,
          halftimeSubIds: action.payload?.halftimeSubIds,
          firstHalfStarters: action.payload?.firstHalfStarters,
          liveSubs: allSubsSoFar,
        },
        aggHomeBeforeMatch: halftime.aggHomeBeforeMatch,
        aggAwayBeforeMatch: halftime.aggAwayBeforeMatch,
        extraTimeSubIds: extraSubIds,
      });

      return {
        ...state,
        starters: nextStarters,
        bench: nextBench,
        season: {
          ...season,
          liveHalftime: {
            ...halftime,
            halftimeSubsMade: halftime.halftimeSubsMade + extraSubRecords.length,
            liveSubs: allSubsSoFar,
            phase: 'extra_time',
            fullMatchResult: etResult,
          },
        },
      };
    }

    case 'ENTER_PENALTY_SHOOTOUT': {
      const season = state.season;
      const halftime = season?.liveHalftime ?? null;
      if (!season || !halftime) return state;
      return {
        ...state,
        season: {
          ...season,
          liveHalftime: {
            ...halftime,
            phase: 'penalties',
          },
        },
      };
    }

    case 'COMMIT_LIVE_MATCH': {
      const season = state.season;
      const halftime = season?.liveHalftime ?? null;
      if (
        (state.phase !== 'season' && state.phase !== 'ucl') ||
        !season ||
        !halftime
      ) {
        return state;
      }

      const filledStarters = state.starters.filter((p): p is Player => p !== null);
      const filledBench = state.bench.filter((p): p is Player => p !== null);
      const activeClubs =
        halftime.competition === 'ucl' && season.ucl
          ? season.ucl.clubs
          : season.clubs;
      const activeAiRosters =
        halftime.competition === 'ucl' && season.ucl
          ? season.ucl.aiRosters
          : season.aiRosters;
      const activeStandings =
        halftime.competition === 'ucl' && season.ucl
          ? season.ucl.standings
          : season.standings;

      const buildClubsById = (ratings: TeamRatings) => {
        const map: Record<string, Club> = {};
        for (const c of activeClubs) {
          map[c.id] =
            c.id === USER_CLUB_ID
              ? {
                  ...c,
                  formation: state.formation,
                  att: ratings.att,
                  mid: ratings.mid,
                  def: ratings.def,
                }
              : c;
        }
        return map;
      };

      if (halftime.fullMatchResult) {
        let finalRes = halftime.fullMatchResult;
        // If user clicked instant finish while a knockout decider was drawn at 90', resolve ET/PK cleanly!
        if (halftime.isKnockoutDecider && !finalRes.extraTime) {
          const aggH = (halftime.aggHomeBeforeMatch ?? 0) + finalRes.homeGoals;
          const aggA = (halftime.aggAwayBeforeMatch ?? 0) + finalRes.awayGoals;
          if (aggH === aggA) {
            const userTactic = halftime.isUserHome
              ? finalRes.homeTactic
              : finalRes.awayTactic;
            const chem = calculateChemistry(
              state.formation,
              filledStarters,
              userTactic,
              state.manager.traitId,
            );
            const ratings = calculateTeamRatings(
              state.formation,
              filledStarters,
              chem.total,
              state.manager.traitId,
            );
            const clubsById = buildClubsById(ratings);
            finalRes = simulateExtraTimeAndPenalties({
              baseResult: finalRes,
              homeClub: clubsById[halftime.homeTeamId],
              awayClub: clubsById[halftime.awayTeamId],
              homeRoster: halftime.isUserHome
                ? filledStarters
                : activeAiRosters[halftime.homeTeamId] ?? [],
              awayRoster: halftime.isUserHome
                ? activeAiRosters[halftime.awayTeamId] ?? []
                : filledStarters,
              userContext: {
                userClubId: USER_CLUB_ID,
                starters: filledStarters,
                bench: filledBench,
                formation: state.formation,
                tactic: userTactic,
                chemistry: chem.total,
                ratings,
                managerTraitId: state.manager.traitId,
                liveSubs: halftime.liveSubs ?? [],
              },
              aggHomeBeforeMatch: halftime.aggHomeBeforeMatch,
              aggAwayBeforeMatch: halftime.aggAwayBeforeMatch,
            });
          }
        }
        return commitLiveMatchResult(state, finalRes);
      }

      // Instant-finish path directly from first_half or halftime (with realistic auto-subs)
      const secondHalfTactic =
        action.payload?.secondHalfTactic ?? halftime.userTacticAtKickoff;
      const chem = calculateChemistry(
        state.formation,
        filledStarters,
        secondHalfTactic,
        state.manager.traitId,
      );
      const ratings = calculateTeamRatings(
        state.formation,
        filledStarters,
        chem.total,
        state.manager.traitId,
      );

      const clubsById = buildClubsById(ratings);
      const oppId = halftime.isUserHome
        ? halftime.awayTeamId
        : halftime.homeTeamId;
      const oppIdx = activeStandings.findIndex((r) => r.teamId === oppId);

      let userMatchResult = simulateSecondHalf({
        halftime,
        homeClub: clubsById[halftime.homeTeamId],
        awayClub: clubsById[halftime.awayTeamId],
        homeRoster: halftime.isUserHome
          ? filledStarters
          : activeAiRosters[halftime.homeTeamId] ?? [],
        awayRoster: halftime.isUserHome
          ? activeAiRosters[halftime.awayTeamId] ?? []
          : filledStarters,
        userContext: {
          userClubId: USER_CLUB_ID,
          starters: filledStarters,
          bench: filledBench,
          formation: state.formation,
          tactic: secondHalfTactic,
          chemistry: chem.total,
          ratings,
          managerTraitId: state.manager.traitId,
          opponentRank: oppIdx === -1 ? undefined : oppIdx + 1,
          liveSubs: halftime.liveSubs ?? [],
          allowAutoSubs: true,
        },
      });

      if (halftime.isKnockoutDecider) {
        const aggH =
          (halftime.aggHomeBeforeMatch ?? 0) + userMatchResult.homeGoals;
        const aggA =
          (halftime.aggAwayBeforeMatch ?? 0) + userMatchResult.awayGoals;
        if (aggH === aggA) {
          userMatchResult = simulateExtraTimeAndPenalties({
            baseResult: userMatchResult,
            homeClub: clubsById[halftime.homeTeamId],
            awayClub: clubsById[halftime.awayTeamId],
            homeRoster: halftime.isUserHome
              ? filledStarters
              : activeAiRosters[halftime.homeTeamId] ?? [],
            awayRoster: halftime.isUserHome
              ? activeAiRosters[halftime.awayTeamId] ?? []
              : filledStarters,
            userContext: {
              userClubId: USER_CLUB_ID,
              starters: filledStarters,
              bench: filledBench,
              formation: state.formation,
              tactic: secondHalfTactic,
              chemistry: chem.total,
              ratings,
              managerTraitId: state.manager.traitId,
              liveSubs: halftime.liveSubs ?? [],
            },
            aggHomeBeforeMatch: halftime.aggHomeBeforeMatch,
            aggAwayBeforeMatch: halftime.aggAwayBeforeMatch,
          });
        }
      }

      return commitLiveMatchResult(state, userMatchResult);
    }

    case 'SIMULATE_SINGLE_MATCH_INSTANT': {
      if ((state.phase !== 'season' && state.phase !== 'ucl') || !state.season) {
        return state;
      }
      if (state.season.transferMarket.isOpen || state.season.liveHalftime) {
        return state;
      }

      const filledStarters = state.starters.filter((p): p is Player => p !== null);
      const filledBench = state.bench.filter((p): p is Player => p !== null);
      const activeTactic =
        state.season.nextMatchTactic ?? state.season.defaultTactic;

      // UCL 1-match skip
      if (state.phase === 'ucl' && state.season.ucl) {
        const ucl = state.season.ucl;
        if (ucl.stage === 'special_transfer' || ucl.completed) return state;

        const chem = calculateChemistry(
          state.formation,
          filledStarters,
          activeTactic,
          state.manager.traitId,
        );
        const ratings = calculateTeamRatings(
          state.formation,
          filledStarters,
          chem.total,
          state.manager.traitId,
        );
        const syncedUcl = {
          ...ucl,
          clubs: ucl.clubs.map((c) =>
            c.id === USER_CLUB_ID
              ? {
                  ...c,
                  formation: state.formation,
                  defaultTactic: state.season!.defaultTactic,
                  att: ratings.att,
                  mid: ratings.mid,
                  def: ratings.def,
                }
              : c,
          ),
        };
        const userCtx = {
          userClubId: USER_CLUB_ID,
          starters: filledStarters,
          bench: filledBench,
          formation: state.formation,
          tactic: activeTactic,
          chemistry: chem.total,
          ratings,
          managerTraitId: state.manager.traitId,
          allowAutoSubs: true,
        };

        const res =
          syncedUcl.stage === 'league_phase'
            ? simulateUclLeaguePhaseRound({
                ucl: syncedUcl,
                uclPlayerStats: state.season.uclPlayerStats,
                userContext: userCtx,
              })
            : advanceUclKnockoutLeg({
                ucl: syncedUcl,
                uclPlayerStats: state.season.uclPlayerStats,
                userContext: userCtx,
              });

        return {
          ...state,
          season: {
            ...state.season,
            ucl: res.ucl,
            uclPlayerStats: res.uclPlayerStats,
            userUclMatchHistory: res.userResult
              ? [...state.season.userUclMatchHistory, res.userResult]
              : state.season.userUclMatchHistory,
            lastUserMatch: res.userResult ?? state.season.lastUserMatch,
            nextMatchTactic: null,
            achievementTrackers: res.userResult
              ? updateTrackersForUserMatch(
                  state.season.achievementTrackers,
                  res.userResult,
                )
              : state.season.achievementTrackers,
          },
        };
      }

      // Domestic Cup 1-match skip when cup match is pending
      if (state.season.cup?.pendingStage) {
        const nextSeason = syncCupAfterRound({
          season: state.season,
          formation: state.formation,
          tactic: activeTactic,
          managerTraitId: state.manager.traitId,
          starters: filledStarters,
          bench: filledBench,
          autoResolveUserMatches: true,
        });
        return {
          ...state,
          season: {
            ...nextSeason,
            nextMatchTactic: null,
          },
        };
      }

      if (state.season.currentRound >= state.season.totalRounds) {
        return finalizeSeasonIfEnded(state);
      }

      let nextSeason = simulateFullSingleRound(
        state.season,
        state.formation,
        activeTactic,
        state.manager.traitId,
        filledStarters,
        filledBench,
      );

      nextSeason = syncCupAfterRound({
        season: nextSeason,
        formation: state.formation,
        tactic: nextSeason.defaultTactic,
        managerTraitId: state.manager.traitId,
        starters: filledStarters,
        bench: filledBench,
        autoResolveUserMatches: false,
      });

      const trigger = checkTransferWindowTrigger(
        nextSeason.currentRound,
        nextSeason.transferWindows,
        nextSeason.transferMarket.completedWindows,
      );

      if (trigger) {
        nextSeason = {
          ...nextSeason,
          transferMarket: createOpenTransferState(
            trigger.windowIndex,
            trigger.triggerRound,
            getUserRank(nextSeason.standings, USER_CLUB_ID),
            nextSeason.transferMarket,
          ),
        };
      }

      return finalizeSeasonIfEnded({
        ...state,
        season: nextSeason,
      });
    }

    case 'SIMULATE_ONE_FAST_ROUND': {
      if (state.phase !== 'season' || !state.season) return state;
      if (state.season.transferMarket.isOpen || state.season.liveHalftime) {
        return state;
      }
      if (state.season.currentRound >= state.season.totalRounds) {
        return finalizeSeasonIfEnded(state);
      }

      const stopAtCup = Boolean(action.payload.stopAtCup);
      const filledStarters = state.starters.filter((p): p is Player => p !== null);
      const filledBench = state.bench.filter((p): p is Player => p !== null);

      // If stopAtCup is enabled and the user has a pending cup match, pause here!
      if (
        stopAtCup &&
        state.season.cup?.pendingStage &&
        findUserCupMatch(state.season.cup, state.season.cup.pendingStage)
      ) {
        return state;
      }

      // Resolve any pending cup stage first so cup stays strictly synchronized with league
      let workingSeason = state.season;
      if (workingSeason.cup?.pendingStage) {
        workingSeason = syncCupAfterRound({
          season: workingSeason,
          formation: state.formation,
          tactic: workingSeason.defaultTactic,
          managerTraitId: state.manager.traitId,
          starters: filledStarters,
          bench: filledBench,
          autoResolveUserMatches: !stopAtCup,
        });
      }

      let nextSeason = simulateFullSingleRound(
        workingSeason,
        state.formation,
        workingSeason.defaultTactic,
        state.manager.traitId,
        filledStarters,
        filledBench,
      );

      nextSeason = syncCupAfterRound({
        season: nextSeason,
        formation: state.formation,
        tactic: nextSeason.defaultTactic,
        managerTraitId: state.manager.traitId,
        starters: filledStarters,
        bench: filledBench,
        autoResolveUserMatches: !stopAtCup,
      });

      const trigger = checkTransferWindowTrigger(
        nextSeason.currentRound,
        nextSeason.transferWindows,
        nextSeason.transferMarket.completedWindows,
      );

      if (trigger) {
        if (action.payload.stopAtTransfer) {
          nextSeason = {
            ...nextSeason,
            transferMarket: createOpenTransferState(
              trigger.windowIndex,
              trigger.triggerRound,
              getUserRank(nextSeason.standings, USER_CLUB_ID),
              nextSeason.transferMarket,
            ),
          };
        } else {
          // Skipping to season end: mark passed windows as completed without opening modal
          nextSeason = {
            ...nextSeason,
            transferMarket: createClosedTransferState(
              Array.from(
                new Set([
                  ...nextSeason.transferMarket.completedWindows,
                  trigger.windowIndex,
                ]),
              ),
              nextSeason.transferMarket.history,
            ),
          };
        }
      }

      // If stopAtCup triggered a user cup match right on the final round, let the user decide before ending the season!
      if (
        stopAtCup &&
        nextSeason.cup?.pendingStage &&
        findUserCupMatch(nextSeason.cup, nextSeason.cup.pendingStage)
      ) {
        return {
          ...state,
          season: nextSeason,
        };
      }

      return finalizeSeasonIfEnded({
        ...state,
        season: nextSeason,
      });
    }

    case 'SIMULATE_TO_NEXT_TRANSFER': {
      if (state.phase !== 'season' || !state.season) return state;
      if (state.season.transferMarket.isOpen || state.season.liveHalftime) {
        return state;
      }

      const filledStarters = state.starters.filter((p): p is Player => p !== null);
      const filledBench = state.bench.filter((p): p is Player => p !== null);
      let currentSeason = state.season;

      if (currentSeason.cup?.pendingStage) {
        currentSeason = syncCupAfterRound({
          season: currentSeason,
          formation: state.formation,
          tactic: currentSeason.defaultTactic,
          managerTraitId: state.manager.traitId,
          starters: filledStarters,
          bench: filledBench,
          autoResolveUserMatches: true,
        });
      }

      while (currentSeason.currentRound < currentSeason.totalRounds) {
        currentSeason = simulateFullSingleRound(
          currentSeason,
          state.formation,
          currentSeason.defaultTactic,
          state.manager.traitId,
          filledStarters,
          filledBench,
        );

        currentSeason = syncCupAfterRound({
          season: currentSeason,
          formation: state.formation,
          tactic: currentSeason.defaultTactic,
          managerTraitId: state.manager.traitId,
          starters: filledStarters,
          bench: filledBench,
          autoResolveUserMatches: true,
        });

        const trigger = checkTransferWindowTrigger(
          currentSeason.currentRound,
          currentSeason.transferWindows,
          currentSeason.transferMarket.completedWindows,
        );

        if (trigger) {
          currentSeason = {
            ...currentSeason,
            transferMarket: createOpenTransferState(
              trigger.windowIndex,
              trigger.triggerRound,
              getUserRank(currentSeason.standings, USER_CLUB_ID),
              currentSeason.transferMarket,
            ),
          };
          break;
        }
      }

      return finalizeSeasonIfEnded({
        ...state,
        season: currentSeason,
      });
    }

    case 'SKIP_TO_SEASON_END': {
      if (state.phase !== 'season' || !state.season) return state;

      const filledStarters = state.starters.filter((p): p is Player => p !== null);
      const filledBench = state.bench.filter((p): p is Player => p !== null);
      let currentSeason: SeasonState = {
        ...state.season,
        liveHalftime: null,
        transferMarket: createClosedTransferState(
          [1, 2, 3],
          state.season.transferMarket.history,
        ),
      };

      if (currentSeason.cup?.pendingStage) {
        currentSeason = syncCupAfterRound({
          season: currentSeason,
          formation: state.formation,
          tactic: currentSeason.defaultTactic,
          managerTraitId: state.manager.traitId,
          starters: filledStarters,
          bench: filledBench,
          autoResolveUserMatches: true,
        });
      }

      while (currentSeason.currentRound < currentSeason.totalRounds) {
        currentSeason = simulateFullSingleRound(
          currentSeason,
          state.formation,
          currentSeason.defaultTactic,
          state.manager.traitId,
          filledStarters,
          filledBench,
        );
        currentSeason = syncCupAfterRound({
          season: currentSeason,
          formation: state.formation,
          tactic: currentSeason.defaultTactic,
          managerTraitId: state.manager.traitId,
          starters: filledStarters,
          bench: filledBench,
          autoResolveUserMatches: true,
        });
      }

      return finalizeSeasonIfEnded({
        ...state,
        season: currentSeason,
      });
    }

    case 'TRANSFER_SPIN_CLUBS': {
      if (!state.season || !state.season.transferMarket.isOpen) return state;
      const tm = state.season.transferMarket;
      if (tm.hasSpunClubs) return state;

      const ownedIds = getAllSquadIds(state.starters, state.bench);
      const userRank = getUserRank(state.season.standings, USER_CLUB_ID);

      const rolledClubs = spinTransferClubs({
        currentRound: state.season.currentRound,
        totalRounds: state.season.totalRounds,
        windowIndex: tm.windowIndex,
        userLeagueId: state.season.leagueId,
        userRank,
        standings: state.season.standings,
        otherLeagues: state.season.otherLeagues,
        allPlayerStats: state.season.allPlayerStats,
        aiRosters: state.season.aiRosters,
        ownedIds,
        legendBonusActive: tm.legendBonusActive,
        championBonusActive: Boolean(tm.championBonusActive),
        allowedLeagueIds: state.draftLeaguePool,
      });

      return {
        ...state,
        season: {
          ...state.season,
          transferMarket: {
            ...tm,
            hasSpunClubs: true,
            rolledClubs,
            lastOfferResult: null,
          },
        },
      };
    }

    case 'TRANSFER_SUBMIT_OFFER': {
      if (!state.season || !state.season.transferMarket.isOpen) return state;
      const tm = state.season.transferMarket;
      if (!tm.hasSpunClubs || tm.attemptsRemaining <= 0) return state;

      const { target, outSlot } = action.payload;
      // Only block players already signed in this window; failed targets can be retried!
      if (tm.signedPlayerIds.includes(target.player.id)) return state;

      const outPlayer =
        outSlot.area === 'starter'
          ? state.starters[outSlot.index]
          : state.bench[outSlot.index];
      if (!outPlayer) return state;

      const roll = Math.random() * 100;
      const success = roll < target.successChance;
      const nextAttempts = Math.max(0, tm.attemptsRemaining - 1);
      const nextAttempted = [...tm.attemptedPlayerIds, target.player.id];

      if (!success) {
        return {
          ...state,
          season: {
            ...state.season,
            transferMarket: {
              ...tm,
              attemptsRemaining: nextAttempts,
              attemptedPlayerIds: nextAttempted,
              lastOfferResult: {
                success: false,
                targetPlayer: target.player,
                outPlayer,
                probability: target.successChance,
                marketValueM: target.marketValueM,
                message: `${target.clubName} 측이 ${target.player.name} (€${target.marketValueM}M) 영입 제안을 거절했습니다. (성공률 ${target.successChance}%${nextAttempts > 0 ? ' · 남은 기회로 재도전 가능' : ''})`,
              },
            },
          },
        };
      }

      // Negotiation Succeeded!
      const incomingPlayer = target.player;
      const nextStarters = [...state.starters];
      const nextBench = [...state.bench];

      if (outSlot.area === 'starter') nextStarters[outSlot.index] = incomingPlayer;
      else nextBench[outSlot.index] = incomingPlayer;

      const nextHistory = [
        ...tm.history,
        {
          windowIndex: tm.windowIndex,
          round: state.season.currentRound,
          outPlayer,
          inPlayer: incomingPlayer,
          marketValueM: target.marketValueM,
          successChance: target.successChance,
        },
      ];

      const buildFreshStatEntry = () => ({
        playerId: incomingPlayer.id,
        playerName: incomingPlayer.name,
        teamId: USER_CLUB_ID,
        teamName: state.userClub.name,
        teamShortName: state.userClub.shortName,
        teamPrimaryColor: state.userClub.primaryColor,
        teamSecondaryColor: state.userClub.secondaryColor,
        isUserTeam: true,
        position: incomingPlayer.position,
        mainPositions: [...incomingPlayer.mainPositions],
        ovr: incomingPlayer.ovr,
        appearances: 0,
        starts: 0,
        subAppearances: 0,
        minutesPlayed: 0,
        goals: 0,
        assists: 0,
        xgSum: 0,
        cleanSheets: 0,
        momCount: 0,
        ratingSum: 0,
        avgRating: 0,
        positionCounts: {},
        isLegend: incomingPlayer.isLegend,
      });

      const statKey = `user::${incomingPlayer.id}`;
      const nextStats = { ...state.season.allPlayerStats };
      if (!nextStats[statKey]) nextStats[statKey] = buildFreshStatEntry();

      const nextCupStats = { ...state.season.cupPlayerStats };
      if (!nextCupStats[statKey]) nextCupStats[statKey] = buildFreshStatEntry();

      const nextUclStats = { ...state.season.uclPlayerStats };
      if (state.season.ucl && !nextUclStats[statKey]) {
        nextUclStats[statKey] = buildFreshStatEntry();
      }

      const prevTrackers =
        state.season.achievementTrackers ?? createInitialTrackers();
      const nextTrackers: SeasonAchievementTrackers = {
        ...prevTrackers,
        signedUnder20PctSuccess:
          prevTrackers.signedUnder20PctSuccess || target.successChance <= 20,
      };

      return {
        ...state,
        starters: nextStarters,
        bench: nextBench,
        season: {
          ...state.season,
          allPlayerStats: nextStats,
          cupPlayerStats: nextCupStats,
          uclPlayerStats: nextUclStats,
          achievementTrackers: nextTrackers,
          transferMarket: {
            ...tm,
            attemptsRemaining: nextAttempts,
            attemptedPlayerIds: nextAttempted,
            signedPlayerIds: [...tm.signedPlayerIds, incomingPlayer.id],
            history: nextHistory,
            lastOfferResult: {
              success: true,
              targetPlayer: incomingPlayer,
              outPlayer,
              probability: target.successChance,
              marketValueM: target.marketValueM,
              message: `오피셜! ${incomingPlayer.name} (OVR ${incomingPlayer.ovr} · €${target.marketValueM}M) 영입 완료! (${outPlayer.name} 방출)`,
            },
          },
        },
      };
    }

    case 'TRANSFER_CLOSE_WINDOW': {
      if (!state.season || !state.season.transferMarket.isOpen) return state;
      const tm = state.season.transferMarket;
      const nextCompleted = Array.from(
        new Set([...tm.completedWindows, tm.windowIndex]),
      );

      // If closing the UCL Special Window, advance UCL stage into Swiss League Phase!
      const nextUcl =
        tm.isUclSpecial && state.season.ucl?.stage === 'special_transfer'
          ? {
              ...state.season.ucl,
              stage: 'league_phase' as const,
            }
          : state.season.ucl;

      return {
        ...state,
        season: {
          ...state.season,
          ucl: nextUcl,
          transferMarket: createClosedTransferState(nextCompleted, tm.history),
        },
      };
    }

    case 'ENTER_UCL_MODE': {
      if (!state.season || state.phase !== 'season_end') return state;
      const userRank = getUserRank(state.season.standings, USER_CLUB_ID);
      if (userRank > 4) return state;

      // If UCL already created, just switch back into UCL phase
      if (state.season.ucl) {
        return { ...state, phase: 'ucl' };
      }

      const filledStarters = state.starters.filter((p): p is Player => p !== null);
      const filledBench = state.bench.filter((p): p is Player => p !== null);
      const chem = calculateChemistry(
        state.formation,
        filledStarters,
        state.season.defaultTactic,
        state.manager.traitId,
      );
      const ratings = calculateTeamRatings(
        state.formation,
        filledStarters,
        chem.total,
        state.manager.traitId,
      );
      const userClubEntry = buildUserClubEntry(
        state.userClub,
        state.formation,
        state.season.defaultTactic,
        filledStarters,
        ratings,
      );

      const { ucl, uclPlayerStats } = createUclTournamentState({
        userLeagueId: state.season.leagueId,
        userClub: userClubEntry,
        userSquad: [...filledStarters, ...filledBench],
        userLeagueClubs: state.season.clubs,
        userLeagueStandings: state.season.standings,
        userAiRosters: state.season.aiRosters,
        otherLeagues: state.season.otherLeagues,
      });

      const specialTransfer = createOpenTransferState(
        4,
        state.season.totalRounds,
        userRank,
        state.season.transferMarket,
        {
          isUclSpecial: true,
          championBonusActive: userRank === 1,
        },
      );

      return {
        ...state,
        phase: 'ucl',
        season: {
          ...state.season,
          ucl,
          uclPlayerStats,
          userUclMatchHistory: [],
          transferMarket: specialTransfer,
          liveHalftime: null,
          legacyArchived: false,
        },
      };
    }

    case 'MARK_CUP_CELEBRATED': {
      if (!state.season) return state;
      return {
        ...state,
        season: {
          ...state.season,
          cupChampionCelebrated: true,
        },
      };
    }

    case 'SIMULATE_UCL_LEAGUE_PHASE_TO_END': {
      if (state.phase !== 'ucl' || !state.season || !state.season.ucl) {
        return state;
      }
      if (state.season.transferMarket.isOpen || state.season.liveHalftime) {
        return state;
      }
      if (
        state.season.ucl.stage !== 'league_phase' ||
        state.season.ucl.leaguePhaseRound >= 8
      ) {
        return state;
      }

      const filledStarters = state.starters.filter((p): p is Player => p !== null);
      const filledBench = state.bench.filter((p): p is Player => p !== null);
      const activeTactic =
        state.season.nextMatchTactic ?? state.season.defaultTactic;
      const chem = calculateChemistry(
        state.formation,
        filledStarters,
        activeTactic,
        state.manager.traitId,
      );
      const ratings = calculateTeamRatings(
        state.formation,
        filledStarters,
        chem.total,
        state.manager.traitId,
      );
      const syncedUcl = {
        ...state.season.ucl,
        clubs: state.season.ucl.clubs.map((c) =>
          c.id === USER_CLUB_ID
            ? {
                ...c,
                formation: state.formation,
                defaultTactic: state.season!.defaultTactic,
                att: ratings.att,
                mid: ratings.mid,
                def: ratings.def,
              }
            : c,
        ),
      };

      const res = simulateUclLeaguePhaseToEnd({
        ucl: syncedUcl,
        uclPlayerStats: state.season.uclPlayerStats,
        userContext: {
          userClubId: USER_CLUB_ID,
          starters: filledStarters,
          bench: filledBench,
          formation: state.formation,
          tactic: activeTactic,
          chemistry: chem.total,
          ratings,
          managerTraitId: state.manager.traitId,
          allowAutoSubs: true,
        },
      });

      let nextTrackers = state.season.achievementTrackers;
      for (const m of res.newUserMatches) {
        nextTrackers = updateTrackersForUserMatch(nextTrackers, m);
      }

      return {
        ...state,
        season: {
          ...state.season,
          ucl: res.ucl,
          uclPlayerStats: res.uclPlayerStats,
          userUclMatchHistory: [
            ...state.season.userUclMatchHistory,
            ...res.newUserMatches,
          ],
          lastUserMatch:
            res.newUserMatches[res.newUserMatches.length - 1] ??
            state.season.lastUserMatch,
          achievementTrackers: nextTrackers,
        },
      };
    }

    case 'SIMULATE_UCL_TO_END': {
      if (state.phase !== 'ucl' || !state.season || !state.season.ucl) {
        return state;
      }
      if (state.season.transferMarket.isOpen || state.season.liveHalftime) {
        return state;
      }

      const filledStarters = state.starters.filter((p): p is Player => p !== null);
      const filledBench = state.bench.filter((p): p is Player => p !== null);
      const activeTactic =
        state.season.nextMatchTactic ?? state.season.defaultTactic;
      const chem = calculateChemistry(
        state.formation,
        filledStarters,
        activeTactic,
        state.manager.traitId,
      );
      const ratings = calculateTeamRatings(
        state.formation,
        filledStarters,
        chem.total,
        state.manager.traitId,
      );
      const syncedUcl = {
        ...state.season.ucl,
        clubs: state.season.ucl.clubs.map((c) =>
          c.id === USER_CLUB_ID
            ? {
                ...c,
                formation: state.formation,
                defaultTactic: state.season!.defaultTactic,
                att: ratings.att,
                mid: ratings.mid,
                def: ratings.def,
              }
            : c,
        ),
      };

      const res = simulateUclToCompletion({
        ucl: syncedUcl,
        uclPlayerStats: state.season.uclPlayerStats,
        userContext: {
          userClubId: USER_CLUB_ID,
          starters: filledStarters,
          bench: filledBench,
          formation: state.formation,
          tactic: activeTactic,
          chemistry: chem.total,
          ratings,
          managerTraitId: state.manager.traitId,
          allowAutoSubs: true,
        },
      });

      let nextTrackers = state.season.achievementTrackers;
      for (const m of res.newUserMatches) {
        nextTrackers = updateTrackersForUserMatch(nextTrackers, m);
      }

      return {
        ...state,
        season: {
          ...state.season,
          ucl: res.ucl,
          uclPlayerStats: res.uclPlayerStats,
          userUclMatchHistory: [
            ...state.season.userUclMatchHistory,
            ...res.newUserMatches,
          ],
          lastUserMatch:
            res.newUserMatches[res.newUserMatches.length - 1] ??
            state.season.lastUserMatch,
          achievementTrackers: nextTrackers,
        },
      };
    }

    case 'FINISH_UCL_TO_SUMMARY': {
      if (!state.season) return state;
      const globalAwards = computeGlobalSeasonAwards({
        allLeaguePlayerStats: state.season.allPlayerStats,
        cupPlayerStats: state.season.cupPlayerStats,
        uclPlayerStats: state.season.uclPlayerStats,
        leagueStandings: state.season.standings,
        cup: state.season.cup,
        ucl: state.season.ucl,
        otherLeagues: state.season.otherLeagues,
        userLeagueId: state.season.leagueId,
      });

      const updated: GameState = {
        ...state,
        phase: 'season_end',
        season: {
          ...state.season,
          globalAwards,
          liveHalftime: null,
          transferMarket: createClosedTransferState(
            state.season.transferMarket.completedWindows,
            state.season.transferMarket.history,
          ),
        },
      };
      return {
        ...updated,
        season: updated.season
          ? {
              ...updated.season,
              seasonScore: computeSeasonScoreFromState(updated),
            }
          : null,
      };
    }

    case 'MARK_LEGACY_ARCHIVED': {
      if (!state.season) return state;
      return {
        ...state,
        season: {
          ...state.season,
          legacyArchived: true,
          seasonScore:
            state.season.seasonScore ?? computeSeasonScoreFromState(state),
        },
      };
    }

    case 'RESET_GAME': {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(GAME_STORAGE_KEY);
        }
      } catch {
        // Ignore
      }
      clearPhase2Handoff();
      return createInitialState();
    }

    default:
      return state;
  }
}

function loadSavedGameState(): GameState {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return createInitialState();
    }
    const raw = window.localStorage.getItem(GAME_STORAGE_KEY);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw) as GameState;
    if (
      parsed &&
      parsed.phase &&
      parsed.manager &&
      Array.isArray(parsed.starters)
    ) {
      // Backfill v2.3 manager profile fields for existing saves
      if (typeof parsed.manager.name !== 'string') {
        parsed.manager.name = DEFAULT_MANAGER_NAME;
      }
      if (!parsed.manager.avatar) {
        parsed.manager.avatar = { ...DEFAULT_MANAGER_AVATAR };
      }
      if (
        !Array.isArray(parsed.draftLeaguePool) ||
        parsed.draftLeaguePool.length === 0
      ) {
        parsed.draftLeaguePool = [...ALL_LEAGUE_IDS];
      }
      if (parsed.season) {
        if (!parsed.season.otherLeagues) {
          const initOther = createOtherLeaguesState(parsed.season.leagueId);
          parsed.season.otherLeagues = advanceOtherLeaguesToProgress(
            initOther,
            parsed.season.currentRound,
            parsed.season.totalRounds,
          );
        }
        // Backfill Phase 2 fields for older v5 saves
        if (parsed.season.cup === undefined) parsed.season.cup = null;
        if (!parsed.season.cupPlayerStats) parsed.season.cupPlayerStats = {};
        if (!Array.isArray(parsed.season.userCupMatchHistory)) {
          parsed.season.userCupMatchHistory = [];
        }
        if (parsed.season.ucl === undefined) parsed.season.ucl = null;
        if (!parsed.season.uclPlayerStats) parsed.season.uclPlayerStats = {};
        if (!Array.isArray(parsed.season.userUclMatchHistory)) {
          parsed.season.userUclMatchHistory = [];
        }
        if (!parsed.season.achievementTrackers) {
          parsed.season.achievementTrackers = createInitialTrackers();
        }
        if (parsed.season.seasonScore === undefined) {
          parsed.season.seasonScore = null;
        }
        if (parsed.season.cupChampionCelebrated === undefined) {
          parsed.season.cupChampionCelebrated = false;
        }
      }
      return parsed;
    }
    return createInitialState();
  } catch {
    return createInitialState();
  }
}

interface GameContextValue {
  state: GameState;
  activeTactic: TacticId;
  chemistry: ChemistryResult;
  ratings: TeamRatings;
  legacyState: LegacyStorageState;
  legacyModalOpen: boolean;
  setLegacyModalOpen: (open: boolean) => void;
  recentUnlocks: string[];
  dismissUnlockToast: (achievementId: string) => void;
  removeHallOfFameEntry: (entryId: string) => void;
  archiveCurrentSeasonNow: () => void;
  startNewCareer: () => void;
  proceedToManagerRoulette: () => void;
  backToClubSetup: () => void;
  goToManagerRoulette: () => void;
  updateManagerProfile: (patch: {
    name?: string;
    avatar?: Partial<ManagerAvatarConfig>;
  }) => void;
  spinManagerTrait: () => void;
  confirmManagerTrait: () => void;
  updateClubProfile: (patch: Partial<UserClubProfile>) => void;
  setDraftLeaguePool: (leagues: LeagueId[]) => void;
  changeFormation: (formation: FormationId) => void;
  autoOptimizeLineup: () => void;
  optimizeHalftimeStarters: (tactic?: TacticId) => void;
  setDefaultTactic: (tactic: TacticId) => void;
  startDraft: () => void;
  spinDraftRoulette: () => void;
  pickDraftPlayer: (player: Player) => void;
  autoCompleteDraft: () => void;
  swapSquadPositions: (
    from: { area: 'starter' | 'bench'; index: number },
    to: { area: 'starter' | 'bench'; index: number },
  ) => void;
  selectLeague: (leagueId: LeagueId) => void;
  setNextMatchTactic: (tactic: TacticId | null) => void;
  startLiveMatch: () => void;
  enterHalftimeLocker: () => void;
  startSecondHalfBroadcast: (params: {
    secondHalfTactic: TacticId;
    subPlayerIds?: string[];
    firstHalfStarters?: Player[];
  }) => void;
  applySecondHalfLiveSub: (params: {
    minute: number;
    subs: {
      starterIndex?: number;
      benchIndex?: number;
      outPlayerId?: string;
      inPlayerId?: string;
    }[];
    nextStarters?: (Player | null)[];
    nextBench?: (Player | null)[];
    firstHalfStarters: Player[];
    halftimeSubIds: string[];
  }) => void;
  enterExtraTimeBreak: () => void;
  startExtraTimeBroadcast: (params?: {
    extraSub?: { starterIndex: number; benchIndex: number };
    firstHalfStarters?: Player[];
    halftimeSubIds?: string[];
  }) => void;
  enterPenaltyShootout: () => void;
  commitLiveMatch: (secondHalfTactic?: TacticId) => void;
  simulateSingleMatchInstant: () => void;
  simulateOneFastRound: (stopAtTransfer: boolean, stopAtCup?: boolean) => void;
  simulateToNextTransfer: () => void;
  skipToSeasonEnd: () => void;
  transferSpinClubs: () => void;
  transferSubmitOffer: (
    target: TransferTargetPlayer,
    outSlot: { area: 'starter' | 'bench'; index: number },
  ) => void;
  transferCloseWindow: () => void;
  markCupCelebrated: () => void;
  enterUclMode: () => void;
  simulateUclLeaguePhaseToEnd: () => void;
  simulateUclToEnd: () => void;
  finishUclToSummary: () => void;
  resetGame: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(
    gameReducer,
    undefined,
    loadSavedGameState,
  );
  const [legacyState, setLegacyState] = useState<LegacyStorageState>(() =>
    loadLegacyState(),
  );
  const [legacyModalOpen, setLegacyModalOpen] = useState(false);
  const [recentUnlocks, setRecentUnlocks] = useState<string[]>([]);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(GAME_STORAGE_KEY, JSON.stringify(state));
      }
    } catch {
      // Ignore storage quota errors
    }
  }, [state]);

  const activeTactic: TacticId =
    state.season?.nextMatchTactic ??
    state.season?.defaultTactic ??
    state.defaultTactic;

  const chemistry = useMemo(
    () =>
      calculateChemistry(
        state.formation,
        state.starters,
        activeTactic,
        state.manager.traitId,
      ),
    [state.formation, state.starters, activeTactic, state.manager.traitId],
  );

  const ratings = useMemo(
    () =>
      calculateTeamRatings(
        state.formation,
        state.starters,
        chemistry.total,
        state.manager.traitId,
      ),
    [state.formation, state.starters, chemistry.total, state.manager.traitId],
  );

  // Real-time 24 Hidden Achievements evaluation + instant unlock toast notifications
  useEffect(() => {
    if (!state.season) return;
    const earnedIds = evaluateAchievements({
      leagueId: state.season.leagueId,
      totalRounds: state.season.totalRounds,
      standings: state.season.standings,
      userLeagueMatchHistory: state.season.userMatchHistory,
      allPlayerStats: state.season.allPlayerStats,
      cup: state.season.cup,
      userCupMatchHistory: state.season.userCupMatchHistory,
      ucl: state.season.ucl,
      userUclMatchHistory: state.season.userUclMatchHistory,
      starters: state.starters,
      bench: state.bench,
      teamAvgOvr: ratings.rawOvr,
      chemistry: chemistry.total,
      trackers: state.season.achievementTrackers ?? createInitialTrackers(),
    });
    if (earnedIds.length === 0) return;

    const league = getLeagueById(state.season.leagueId);
    const { legacyState: updatedLegacy, newlyUnlockedIds } =
      unlockAchievementsInStorage({
        achievementIds: earnedIds,
        clubName: state.userClub.name,
        leagueName: league.koreanName,
        summaryNote: `${league.koreanName} · OVR ${ratings.rawOvr}`,
      });

    if (newlyUnlockedIds.length > 0) {
      const timer = window.setTimeout(() => {
        setLegacyState(updatedLegacy);
        setRecentUnlocks((prev) =>
          Array.from(new Set([...prev, ...newlyUnlockedIds])),
        );
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [
    state.season,
    state.starters,
    state.bench,
    state.userClub.name,
    ratings.rawOvr,
    chemistry.total,
  ]);

  const archiveCurrentSeasonNow = useCallback(() => {
    if (!state.season || state.season.legacyArchived) return;
    const score =
      state.season.seasonScore ?? computeSeasonScoreFromState(state);
    if (!score) return;

    const combinedStats = mergePlayerStatsMaps(
      state.season.allPlayerStats,
      state.season.cupPlayerStats,
      state.season.uclPlayerStats,
    );
    const earnedIds = evaluateAchievements({
      leagueId: state.season.leagueId,
      totalRounds: state.season.totalRounds,
      standings: state.season.standings,
      userLeagueMatchHistory: state.season.userMatchHistory,
      allPlayerStats: state.season.allPlayerStats,
      cup: state.season.cup,
      userCupMatchHistory: state.season.userCupMatchHistory,
      ucl: state.season.ucl,
      userUclMatchHistory: state.season.userUclMatchHistory,
      starters: state.starters,
      bench: state.bench,
      teamAvgOvr: ratings.rawOvr,
      chemistry: chemistry.total,
      trackers: state.season.achievementTrackers ?? createInitialTrackers(),
    });

    const clubNameById: Record<string, string> = {};
    for (const c of state.season.clubs) clubNameById[c.id] = c.name;
    if (state.season.ucl) {
      for (const c of state.season.ucl.clubs) clubNameById[c.id] = c.name;
    }
    const matchHistory = buildCompactMatchHistory({
      leagueMatches: state.season.userMatchHistory,
      cupMatches: state.season.userCupMatchHistory,
      uclMatches: state.season.userUclMatchHistory,
      clubNameById,
    });

    const updated = archiveSeasonToHallOfFame({
      userClub: state.userClub,
      managerName: state.manager.name,
      managerAvatar: state.manager.avatar,
      managerTraitId: state.manager.traitId,
      leagueId: state.season.leagueId,
      formation: state.formation,
      defaultTactic: state.season.defaultTactic,
      standings: state.season.standings,
      totalRounds: state.season.totalRounds,
      cup: state.season.cup,
      ucl: state.season.ucl,
      teamAvgOvr: ratings.rawOvr,
      chemistry: chemistry.total,
      seasonScore: score,
      awards: state.season.awards,
      globalAwards: state.season.globalAwards ?? null,
      matchHistory,
      starters: state.starters,
      bench: state.bench,
      combinedPlayerStats: combinedStats,
      unlockedAchievementIds: earnedIds,
    });
    setLegacyState(updated);
    dispatch({ type: 'MARK_LEGACY_ARCHIVED' });
  }, [state, ratings.rawOvr, chemistry.total]);

  // Auto-archive completed runs into Hall of Fame once (non-Top4 at league end, OR after UCL completes)
  useEffect(() => {
    if (
      state.phase !== 'season_end' ||
      !state.season ||
      state.season.legacyArchived
    ) {
      return;
    }
    const finalRank = getUserRank(state.season.standings, USER_CLUB_ID);
    const uclDone = Boolean(state.season.ucl?.completed);
    if (finalRank > 4 || uclDone) {
      const timer = window.setTimeout(() => {
        archiveCurrentSeasonNow();
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [state.phase, state.season, archiveCurrentSeasonNow]);

  const dismissUnlockToast = useCallback((achievementId: string) => {
    setRecentUnlocks((prev) => prev.filter((id) => id !== achievementId));
  }, []);

  const removeHallOfFameEntry = useCallback((entryId: string) => {
    setLegacyState(deleteHallOfFameEntry(entryId));
  }, []);

  const value = useMemo<GameContextValue>(
    () => ({
      state,
      activeTactic,
      chemistry,
      ratings,
      legacyState,
      legacyModalOpen,
      setLegacyModalOpen,
      recentUnlocks,
      dismissUnlockToast,
      removeHallOfFameEntry,
      archiveCurrentSeasonNow,
      startNewCareer: () => dispatch({ type: 'START_NEW_CAREER' }),
      proceedToManagerRoulette: () =>
        dispatch({ type: 'PROCEED_TO_MANAGER_ROULETTE' }),
      backToClubSetup: () => dispatch({ type: 'BACK_TO_CLUB_SETUP' }),
      goToManagerRoulette: () => dispatch({ type: 'GO_TO_MANAGER_ROULETTE' }),
      updateManagerProfile: (patch) =>
        dispatch({ type: 'UPDATE_MANAGER_PROFILE', payload: patch }),
      spinManagerTrait: () => dispatch({ type: 'SPIN_MANAGER_TRAIT' }),
      confirmManagerTrait: () => dispatch({ type: 'CONFIRM_MANAGER_TRAIT' }),
      updateClubProfile: (patch) =>
        dispatch({ type: 'UPDATE_CLUB_PROFILE', payload: patch }),
      setDraftLeaguePool: (leagues) =>
        dispatch({ type: 'SET_DRAFT_LEAGUE_POOL', payload: { leagues } }),
      changeFormation: (formation) =>
        dispatch({ type: 'CHANGE_FORMATION', payload: { formation } }),
      autoOptimizeLineup: () => dispatch({ type: 'AUTO_OPTIMIZE_LINEUP' }),
      optimizeHalftimeStarters: (tactic) =>
        dispatch({ type: 'OPTIMIZE_HALFTIME_STARTERS', payload: { tactic } }),
      setDefaultTactic: (tactic) =>
        dispatch({ type: 'SET_DEFAULT_TACTIC', payload: { tactic } }),
      startDraft: () => dispatch({ type: 'START_DRAFT' }),
      spinDraftRoulette: () => dispatch({ type: 'SPIN_DRAFT_ROULETTE' }),
      pickDraftPlayer: (player) =>
        dispatch({ type: 'PICK_DRAFT_PLAYER', payload: { player } }),
      autoCompleteDraft: () => dispatch({ type: 'AUTO_COMPLETE_DRAFT' }),
      swapSquadPositions: (from, to) =>
        dispatch({ type: 'SWAP_SQUAD_POSITIONS', payload: { from, to } }),
      selectLeague: (leagueId) =>
        dispatch({ type: 'SELECT_LEAGUE', payload: { leagueId } }),
      setNextMatchTactic: (tactic) =>
        dispatch({ type: 'SET_NEXT_MATCH_TACTIC', payload: { tactic } }),
      startLiveMatch: () => dispatch({ type: 'START_LIVE_MATCH' }),
      enterHalftimeLocker: () => dispatch({ type: 'ENTER_HALFTIME_LOCKER' }),
      startSecondHalfBroadcast: (payload) =>
        dispatch({ type: 'START_SECOND_HALF_BROADCAST', payload }),
      applySecondHalfLiveSub: (payload) =>
        dispatch({ type: 'APPLY_SECOND_HALF_LIVE_SUB', payload }),
      enterExtraTimeBreak: () => dispatch({ type: 'ENTER_EXTRA_TIME_BREAK' }),
      startExtraTimeBroadcast: (payload) =>
        dispatch({ type: 'START_EXTRA_TIME_BROADCAST', payload }),
      enterPenaltyShootout: () => dispatch({ type: 'ENTER_PENALTY_SHOOTOUT' }),
      commitLiveMatch: (secondHalfTactic) =>
        dispatch({ type: 'COMMIT_LIVE_MATCH', payload: { secondHalfTactic } }),
      simulateSingleMatchInstant: () =>
        dispatch({ type: 'SIMULATE_SINGLE_MATCH_INSTANT' }),
      simulateOneFastRound: (stopAtTransfer, stopAtCup = false) =>
        dispatch({
          type: 'SIMULATE_ONE_FAST_ROUND',
          payload: { stopAtTransfer, stopAtCup },
        }),
      simulateToNextTransfer: () =>
        dispatch({ type: 'SIMULATE_TO_NEXT_TRANSFER' }),
      skipToSeasonEnd: () => dispatch({ type: 'SKIP_TO_SEASON_END' }),
      transferSpinClubs: () => dispatch({ type: 'TRANSFER_SPIN_CLUBS' }),
      transferSubmitOffer: (target, outSlot) =>
        dispatch({
          type: 'TRANSFER_SUBMIT_OFFER',
          payload: { target, outSlot },
        }),
      transferCloseWindow: () => dispatch({ type: 'TRANSFER_CLOSE_WINDOW' }),
      markCupCelebrated: () => dispatch({ type: 'MARK_CUP_CELEBRATED' }),
      enterUclMode: () => dispatch({ type: 'ENTER_UCL_MODE' }),
      simulateUclLeaguePhaseToEnd: () =>
        dispatch({ type: 'SIMULATE_UCL_LEAGUE_PHASE_TO_END' }),
      simulateUclToEnd: () => dispatch({ type: 'SIMULATE_UCL_TO_END' }),
      finishUclToSummary: () => dispatch({ type: 'FINISH_UCL_TO_SUMMARY' }),
      resetGame: () => dispatch({ type: 'RESET_GAME' }),
    }),
    [
      state,
      activeTactic,
      chemistry,
      ratings,
      legacyState,
      legacyModalOpen,
      recentUnlocks,
      dismissUnlockToast,
      removeHallOfFameEntry,
      archiveCurrentSeasonNow,
    ],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) {
    throw new Error('useGame must be used inside GameProvider');
  }
  return ctx;
}
