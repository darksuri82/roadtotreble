import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { BENCH_SLOTS, FORMATIONS } from '../data/formations';
import {
  pickNextManagerEvent,
  resolveManagerEventChoice,
} from '../data/managerEvents';
import {
  evaluateManagerPlayerSynergy,
  MANAGER_TRAIT_LIST,
} from '../data/managerTraits';
import { mergePlayerStatsMaps } from '../engine/analyticsEngine';
import { getPlayerAttributes } from '../engine/attributeEngine';
import {
  applyAwakeningToPlayer,
  AWAKENING_MAX_VALID_PER_TEAM,
  evaluatePostMatchAwakening,
  isValidAwakeningRecord,
} from '../engine/awakeningEngine';
import { computeGlobalSeasonAwards, computeSeasonAwards } from '../engine/awardsEngine';
import {
  computeCashLegendChanceBonus,
  createDefaultSeasonBudgetState,
  createSeasonBudgetState,
  deductTransferCash,
  getFfpWindowMaxAttempts,
  isFfpEmbargoWindow,
} from '../engine/budgetEngine';
import { calculateChemistry, calculateTeamRatings } from '../engine/chemistryEngine';
import { generateSoloSeasonTeamStory } from '../engine/teamStoryEngine';
import {
  applyConditionToPlayers,
  clampMorale,
  commitAiClubPostMatchConditions,
  compactConditionMapForStorage,
  createDefaultManagerEventsState,
  isPlayerUnavailable,
  prepareAiClubLineupForMatch,
  resolveAutoReturnInjuredStarters,
  updateSquadConditionsAfterMatch,
} from '../engine/conditionEngine';
import {
  advanceCupStage,
  checkCupStageTrigger,
  createDomesticCupState,
  CUP_STAGE_LABELS,
  CUP_STAGE_ORDER,
  cupNodeToFixture,
  didUserWinCup,
  findUserCupMatch,
} from '../engine/cupEngine';
import {
  ACTIVE_PLAYERS,
  buildAiClubRoster,
  buildAiClubSquad16,
  getClubRealDepthPool,
  getLeagueById,
  getWeakestClub,
  isStoryEraClubId,
  isStoryEraPlayerId,
  LEGEND_PLAYERS,
  pickReplacementForAiClub,
  sanitizeAiClubRoster,
} from '../engine/dataLoader';
import {
  DEFAULT_ROULETTE_LEGEND_RATE,
  spinClubRoulette,
} from '../engine/draftEngine';
import {
  archiveSeasonToHallOfFame,
  buildCompactMatchHistory,
  computeSeasonScore,
  computeUserSeasonManagerRating,
  deleteHallOfFameEntry,
  evaluateAchievements,
  generateSeasonRunId,
  isEligibleForAutoHofInduction,
  isFullFiveLeagueDraftPool,
  loadLegacyState,
  recordDreamMatchResult,
  unlockAchievementsInStorage,
} from '../engine/legacyEngine';
import {
  adjustAiClubRatingsForRosterChange,
  optimizeBestLineup,
  optimizeCurrentStartersForFormation,
  remapStartersForFormation,
  reoptimizeAiClubRoster,
} from '../engine/lineupOptimizer';
import {
  resimulateRemainingSecondHalf,
  simulateExtraTimeAndPenalties,
  simulateExtraTimeFirstHalf,
  simulateExtraTimeSecondHalfAndPenalties,
  simulateFirstHalf,
  simulateMatch,
  simulateSecondHalf,
  USER_CLUB_ID,
} from '../engine/matchEngine';
import {
  advanceOtherLeaguesToProgress,
  buildFiveLeagueUclQualifiers,
  createOtherLeaguesState,
  syncTransferToOtherLeagues,
} from '../engine/otherLeaguesEngine';
import {
  buildPhase2HandoffState,
  clearPhase2Handoff,
  savePhase2Handoff,
} from '../engine/phase2Bridge';
import { evaluatePositionFit } from '../engine/positionEngine';
import { generateDoubleRoundRobin } from '../engine/scheduleEngine';
import {
  createInitialStaffCoachState,
  evaluateStaffCoachEffect,
  rollMidSeasonStaffCoachOffers,
} from '../engine/staffCoachEngine';
import { MAX_MATCH_SUBS } from '../engine/staminaEngine';
import {
  applyRoundResults,
  createInitialPlayerStatsMap,
  createInitialStandings,
  getUserRank,
  normalizeLegacyPlayerStatsMap,
} from '../engine/standingsEngine';
import {
  createInitialTacticalAdaptationState,
  recordMatchTacticalAdaptation,
} from '../engine/tacticalAdaptationEngine';
import { evaluateTeamTacticalProfile } from '../engine/unifiedTacticsEngine';
import {
  analyzeClubPositionNeeds,
  buildTransferClubSquad,
  checkTransferWindowTrigger,
  createClosedTransferState,
  createOpenTransferState,
  evaluateShockBargainStatus,
  evaluateTradePackage,
  generateIncomingTradeOffers,
  selectAutoFillerPlayers,
  spinTransferClubs,
} from '../engine/transferEngine';
import {
  advanceUclKnockoutLeg,
  advanceUclPlayoffToCompletion,
  createStoryUclR16State,
  createUclTournamentState,
  didUserWinUcl,
  findNextUserUclLeaguePhaseFixture,
  getUserKnockoutFixtureInfo,
  simulateUclLeaguePhaseRound,
  simulateUclLeaguePhaseToEnd,
  simulateUclToCompletion,
  UCL_EXTERNAL_TEAMS,
} from '../engine/uclEngine';
import {
  clearActiveStorySave,
  evaluateStoryChecklist,
  hasActiveStorySave,
  hydrateStoryScenarioBundle,
  loadStoryCodex,
  recordStoryCompletionInCodex,
  sanitizeStoryTacticId,
  STORY_ACTIVE_SAVE_KEY,
  type HydratedStoryScenario,
} from '../engine/storyModeEngine';
import { getStoryScenarioMeta } from '../data/story/storyRegistry';
import type {
  StoryChecklistSummary,
  StoryCodexStorage,
  StoryModeRuntimeState,
  StoryScenarioDataBundle,
} from '../types/storyMode';
import type {
  InjuryAlertItem,
  InjuryAutoReturnEntry,
  ManagerEventsState,
  PlayerConditionMap,
} from '../types/condition';
import {
  DEFAULT_MANAGER_AVATAR,
  DEFAULT_MANAGER_NAME,
  type AwakeningAlertItem,
  type ChemistryResult,
  type FormationId,
  type GameState,
  type ManagerAvatarConfig,
  type ManagerTraitId,
  type SeasonState,
  type SeasonStoryCrisisLog,
  type StaffCoachId,
  type TacticalAdaptationState,
  type TeamRatings,
  type TransferTargetPlayer,
  type UserClubProfile,
} from '../types/game';
import type {
  Club,
  LeagueId,
  LiveSubRecord,
  MatchResult,
  PlayerSeasonStats,
  PlayerTransferRecord,
  TacticId,
} from '../types/league';
import {
  createInitialTrackers,
  type GlobalHofRankingEntry,
  type GlobalRankingSubmitResult,
  type GlobalTop15CelebrationPayload,
  type HallOfFameEntry,
  type LegacyStorageState,
  type SeasonAchievementTrackers,
} from '../types/legacy';
import { formatPlayerRecordName } from '../types/player';
import type { Player, PlayerAwakeningRecord } from '../types/player';
import {
  hasCelebratedGlobalTop15,
  markGlobalTop15Celebrated,
  submitGlobalHofRanking,
} from '../services/globalRankingService';
import { extractRoomCodeFromUrl } from '../services/multiplayerService';
import {
  DEFAULT_USER_CLUB_PROFILE,
  hasSavedActiveUserProfile,
  loadActiveUserProfile,
  normalizeClubProfile,
  normalizeManagerAvatar,
  saveActiveUserProfile,
  saveClubPreset,
} from '../utils/clubPresets';

const GAME_STORAGE_KEY = 'football_draft_game_state_v5';

const DEFAULT_USER_CLUB: UserClubProfile = DEFAULT_USER_CLUB_PROFILE;

function hydrateWithPersistedProfile(base: GameState): GameState {
  const saved = loadActiveUserProfile();
  return {
    ...base,
    userClub: { ...saved.clubProfile },
    manager: {
      ...base.manager,
      name: saved.managerName,
      avatar: { ...saved.managerAvatar },
    },
  };
}

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

export function createInitialState(): GameState {
  return {
    phase: 'title',
    userClub: { ...DEFAULT_USER_CLUB },
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

function findNextOpponentInfo(
  season: SeasonState,
  competition: 'league' | 'cup' | 'ucl',
): { name: string; rank: number; isCupOrUcl: boolean } {
  if (competition === 'ucl' && season.ucl && !season.ucl.completed) {
    const clubsById = Object.fromEntries(season.ucl.clubs.map((c) => [c.id, c]));
    if (season.ucl.stage === 'league_phase') {
      const fix = findNextUserUclLeaguePhaseFixture(season.ucl, USER_CLUB_ID);
      if (fix) {
        const oppId =
          fix.homeTeamId === USER_CLUB_ID ? fix.awayTeamId : fix.homeTeamId;
        const idx = season.ucl.standings.findIndex((r) => r.teamId === oppId);
        return {
          name: clubsById[oppId]?.name ?? 'UCL 상대팀',
          rank: idx === -1 ? 8 : idx + 1,
          isCupOrUcl: true,
        };
      }
    } else {
      const ko = getUserKnockoutFixtureInfo(season.ucl, USER_CLUB_ID);
      if (ko) {
        const oppId =
          ko.fixture.homeTeamId === USER_CLUB_ID
            ? ko.fixture.awayTeamId
            : ko.fixture.homeTeamId;
        return {
          name: clubsById[oppId]?.name ?? 'UCL 토너먼트 상대팀',
          rank: 3,
          isCupOrUcl: true,
        };
      }
    }
  }

  if (season.cup?.pendingStage) {
    const node = findUserCupMatch(season.cup, season.cup.pendingStage, USER_CLUB_ID);
    if (node) {
      const oppId =
        node.homeTeamId === USER_CLUB_ID ? node.awayTeamId : node.homeTeamId;
      const club = season.clubs.find((c) => c.id === oppId);
      const idx = season.standings.findIndex((r) => r.teamId === oppId);
      return {
        name: club?.name ?? '컵대회 상대팀',
        rank: idx === -1 ? 6 : idx + 1,
        isCupOrUcl: true,
      };
    }
  }

  const nextR = season.currentRound + 1;
  const nextFix = season.fixtures.find(
    (f) =>
      f.round === nextR &&
      !f.played &&
      (f.homeTeamId === USER_CLUB_ID || f.awayTeamId === USER_CLUB_ID),
  );
  if (nextFix) {
    const oppId =
      nextFix.homeTeamId === USER_CLUB_ID ? nextFix.awayTeamId : nextFix.homeTeamId;
    const club = season.clubs.find((c) => c.id === oppId);
    const idx = season.standings.findIndex((r) => r.teamId === oppId);
    return {
      name: club?.name ?? '다음 상대팀',
      rank: idx === -1 ? 10 : idx + 1,
      isCupOrUcl: false,
    };
  }

  return { name: '다음 상대팀', rank: 8, isCupOrUcl: false };
}

function computeUserChemAndRatings(params: {
  formation: FormationId;
  starters: (Player | null)[];
  tactic: TacticId;
  managerTraitId: ManagerTraitId | null;
  season?: SeasonState | null;
}) {
  const staffCoachId = params.season?.staffCoach?.hiredCoachId ?? null;
  const ffpChemPenalty = params.season?.budgetState?.chemPenalty ?? 0;
  const chem = calculateChemistry(
    params.formation,
    params.starters,
    params.tactic,
    params.managerTraitId,
    undefined,
    { staffCoachId, ffpChemPenalty },
  );
  const ratings = calculateTeamRatings(
    params.formation,
    params.starters,
    chem.total,
    params.managerTraitId,
    chem.slotSynergies,
    params.tactic,
    staffCoachId,
  );
  return { chem, ratings, staffCoachId };
}

function applyAwakenedPlayersToSlots(
  slots: (Player | null)[],
  awakenedMap: Record<string, PlayerAwakeningRecord> | undefined,
): (Player | null)[] {
  if (!awakenedMap || Object.keys(awakenedMap).length === 0) return slots;
  let changed = false;
  const next = slots.map((p) => {
    if (!p) return null;
    const rec = awakenedMap[p.id];
    if (!rec || p.awakening) return p;
    changed = true;
    return applyAwakeningToPlayer(p, rec);
  });
  return changed ? next : slots;
}

function applyPostUserMatchConditionAndEvents(params: {
  season: SeasonState;
  workingConditions: PlayerConditionMap;
  formation: FormationId;
  tactic: TacticId;
  managerTraitId?: ManagerTraitId | null;
  starters: (Player | null)[];
  bench: (Player | null)[];
  userMatchResult: MatchResult | null;
  competition: 'league' | 'cup' | 'ucl';
  round?: number;
  isShortRest?: boolean;
  teamName?: string;
  managerName?: string;
  allowEventTrigger?: boolean;
  liveSubs?: LiveSubRecord[];
  halftimeSubIds?: string[];
}): {
  playerConditions: PlayerConditionMap;
  managerEvents: ManagerEventsState;
  pendingInjuryAlerts: InjuryAlertItem[];
  tacticalAdaptation: TacticalAdaptationState;
  awakenedPlayers: Record<string, PlayerAwakeningRecord>;
  pendingAwakeningAlerts: AwakeningAlertItem[];
  storyCrisisLog: SeasonStoryCrisisLog;
} {
  const {
    season,
    workingConditions,
    formation,
    tactic,
    managerTraitId = null,
    starters,
    bench,
    userMatchResult,
    competition,
    round,
    isShortRest = competition !== 'league',
    teamName = season.clubs.find((c) => c.id === USER_CLUB_ID)?.name ?? '우리 팀',
    managerName = DEFAULT_MANAGER_NAME,
    allowEventTrigger = true,
    liveSubs = [],
    halftimeSubIds = [],
  } = params;

  const prevEvents = season.managerEvents ?? createDefaultManagerEventsState();
  const prevAlerts = season.pendingInjuryAlerts ?? [];
  const prevAdaptation =
    season.tacticalAdaptation ?? createInitialTacticalAdaptationState();
  const prevAwakened = season.awakenedPlayers ?? {};
  const prevAwakeningAlerts = season.pendingAwakeningAlerts ?? [];
  const prevCrisisLog: SeasonStoryCrisisLog = season.storyCrisisLog ?? {
    keyInjuries: [],
    tacticalCrises: [],
  };
  const filledStarters = starters.filter((p): p is Player => p !== null);
  const filledBench = bench.filter((p): p is Player => p !== null);
  const fullSquad = [...filledStarters, ...filledBench];

  if (!userMatchResult || fullSquad.length === 0) {
    return {
      playerConditions: workingConditions,
      managerEvents: prevEvents,
      pendingInjuryAlerts: prevAlerts,
      tacticalAdaptation: prevAdaptation,
      awakenedPlayers: prevAwakened,
      pendingAwakeningAlerts: prevAwakeningAlerts,
      storyCrisisLog: prevCrisisLog,
    };
  }

  const isUserHome = userMatchResult.homeTeamId === USER_CLUB_ID;
  const userGoals = isUserHome
    ? userMatchResult.homeGoals
    : userMatchResult.awayGoals;
  const oppGoals = isUserHome
    ? userMatchResult.awayGoals
    : userMatchResult.homeGoals;
  const wentToEt = Boolean(userMatchResult.extraTime);
  const totalMatchMins = wentToEt ? 120 : 90;

  let outcome: 'W' | 'D' | 'L';
  if (userMatchResult.extraTime) {
    outcome =
      userMatchResult.extraTime.winnerTeamId === USER_CLUB_ID ? 'W' : 'L';
  } else if (userGoals > oppGoals) {
    outcome = 'W';
  } else if (userGoals < oppGoals) {
    outcome = 'L';
  } else {
    outcome = 'D';
  }

  // Track streaks
  const nextWinStreak = outcome === 'W' ? prevEvents.recentWinStreak + 1 : 0;
  const nextLossStreak = outcome === 'L' ? prevEvents.recentLossStreak + 1 : 0;
  const nextCleanSheetStreak =
    oppGoals === 0 ? prevEvents.recentCleanSheetStreak + 1 : 0;
  const nextUnbeatenStreak =
    outcome !== 'L' ? prevEvents.recentUnbeatenStreak + 1 : 0;

  // Build per-player minutes & subPositions
  const formCfg = FORMATIONS[formation] ?? FORMATIONS['4-3-3'];
  const starterIds = new Set<string>();
  const starterSlotIndexByPlayerId: Record<string, number> = {};
  const subPositionByPlayerId: Record<string, Player['mainPositions'][number]> = {};
  const minutesByPlayerId: Record<string, number> = {};

  starters.forEach((p, idx) => {
    if (!p) return;
    starterIds.add(p.id);
    starterSlotIndexByPlayerId[p.id] = idx;
    const slotSub = formCfg.slots[idx]?.subPosition;
    if (slotSub) subPositionByPlayerId[p.id] = slotSub;
    minutesByPlayerId[p.id] = totalMatchMins;
  });

  for (const p of filledBench) {
    minutesByPlayerId[p.id] = 0;
  }

  // Reflect live subs if recorded
  for (const subId of halftimeSubIds) {
    minutesByPlayerId[subId] = Math.max(45, totalMatchMins - 45);
  }
  for (const sub of liveSubs) {
    if (sub.outPlayerId) {
      minutesByPlayerId[sub.outPlayerId] = Math.min(
        totalMatchMins,
        Math.max(15, sub.minute),
      );
    }
    if (sub.inPlayerId) {
      minutesByPlayerId[sub.inPlayerId] = Math.max(
        10,
        totalMatchMins - sub.minute,
      );
    }
  }

  // Extract exact minutesPlayed, scorers, assisters, ratings, MOM from MatchPlayerRating & MatchEvent
  const goalScorerIds = new Set<string>();
  const assisterIds = new Set<string>();
  const goalsByPlayerId: Record<string, number> = {};
  const assistsByPlayerId: Record<string, number> = {};
  const ratingsByPlayerId: Record<string, number> = {};

  for (const pr of userMatchResult.playerRatings) {
    if (pr.teamId === USER_CLUB_ID) {
      ratingsByPlayerId[pr.playerId] = pr.rating;
      if (typeof pr.minutesPlayed === 'number' && pr.minutesPlayed > 0) {
        minutesByPlayerId[pr.playerId] = pr.minutesPlayed;
      }
      if (pr.goals > 0) {
        goalScorerIds.add(pr.playerId);
        goalsByPlayerId[pr.playerId] = Math.max(goalsByPlayerId[pr.playerId] ?? 0, pr.goals);
      }
      if (pr.assists > 0) {
        assisterIds.add(pr.playerId);
        assistsByPlayerId[pr.playerId] = Math.max(assistsByPlayerId[pr.playerId] ?? 0, pr.assists);
      }
    }
  }

  const eventGoalCounts: Record<string, number> = {};
  const eventAssistCounts: Record<string, number> = {};
  for (const ev of userMatchResult.events) {
    if (ev.type === 'goal' && ev.teamId === USER_CLUB_ID) {
      if (ev.scorerId) {
        goalScorerIds.add(ev.scorerId);
        eventGoalCounts[ev.scorerId] = (eventGoalCounts[ev.scorerId] ?? 0) + 1;
      }
      if (ev.assistId) {
        assisterIds.add(ev.assistId);
        eventAssistCounts[ev.assistId] = (eventAssistCounts[ev.assistId] ?? 0) + 1;
      }
    }
  }
  if (userMatchResult.extraTime) {
    for (const ev of userMatchResult.extraTime.etEvents) {
      if (ev.type === 'goal' && ev.teamId === USER_CLUB_ID) {
        if (ev.scorerId) {
          goalScorerIds.add(ev.scorerId);
          eventGoalCounts[ev.scorerId] = (eventGoalCounts[ev.scorerId] ?? 0) + 1;
        }
        if (ev.assistId) {
          assisterIds.add(ev.assistId);
          eventAssistCounts[ev.assistId] = (eventAssistCounts[ev.assistId] ?? 0) + 1;
        }
      }
    }
  }
  for (const [pid, cnt] of Object.entries(eventGoalCounts)) {
    goalsByPlayerId[pid] = Math.max(goalsByPlayerId[pid] ?? 0, cnt);
  }
  for (const [pid, cnt] of Object.entries(eventAssistCounts)) {
    assistsByPlayerId[pid] = Math.max(assistsByPlayerId[pid] ?? 0, cnt);
  }

  const momPlayerId: string | null = userMatchResult.momPlayerId ?? null;

  const oppId = isUserHome
    ? userMatchResult.awayTeamId
    : userMatchResult.homeTeamId;
  const oppStandIdx = season.standings.findIndex((r) => r.teamId === oppId);
  const isBigMatch =
    competition !== 'league' || (oppStandIdx !== -1 && oppStandIdx < 4);

  const staffCoachId = season.staffCoach?.hiredCoachId ?? null;
  const staffEffect = evaluateStaffCoachEffect(staffCoachId, tactic);
  const extraLossMoraleDrop = season.budgetState?.extraLossMoraleDrop ?? 0;

  const userCondUpdate = updateSquadConditionsAfterMatch({
    squad: fullSquad,
    starterIds,
    minutesByPlayerId,
    subPositionByPlayerId,
    tactic,
    conditionMap: workingConditions,
    competition,
    round,
    isShortRest,
    outcome,
    goalDiff: userGoals - oppGoals,
    isBigMatch,
    momPlayerId,
    goalScorerIds,
    assisterIds,
    goalsByPlayerId,
    assistsByPlayerId,
    cleanSheet: oppGoals === 0,
    ratingsByPlayerId,
    teamWinStreak: nextWinStreak,
    teamLossStreak: nextLossStreak,
    trackUserAlerts: true,
    starterSlotIndexByPlayerId,
    extraLossMoraleDrop,
    moraleLossDefense: staffEffect.moraleLossDefense,
  });

  const mergedConditions: PlayerConditionMap = {
    ...workingConditions,
    ...userCondUpdate.conditionMap,
  };

  let baseTeamMorale = prevEvents.teamMorale;
  if (baseTeamMorale >= 4 && userCondUpdate.teamMoraleDelta <= 0) {
    baseTeamMorale = 3;
  } else if (baseTeamMorale >= 2 && outcome !== 'W' && userCondUpdate.teamMoraleDelta <= 0) {
    baseTeamMorale -= 1;
  } else if (baseTeamMorale <= -4 && outcome === 'W' && userCondUpdate.teamMoraleDelta >= 0) {
    baseTeamMorale += 1;
  }
  const nextTeamMorale = clampMorale(
    baseTeamMorale + userCondUpdate.teamMoraleDelta,
  );
  const nextPendingAlerts =
    userCondUpdate.newInjuries.length > 0
      ? [...prevAlerts, ...userCondUpdate.newInjuries]
      : prevAlerts;

  // v9.0 Record Tactical Adaptation exposure & trigger non-spam warning popup on tier entry
  const matchRound = round ?? season.currentRound;
  const nextTacticalAdaptation = recordMatchTacticalAdaptation({
    prev: prevAdaptation,
    round: matchRound,
    competition,
    formation,
    tactic,
    staffCoachId,
  });

  // v9.7 Record notable injuries & tactical counter crises for documentary season storytelling
  let nextKeyInjuries = prevCrisisLog.keyInjuries;
  if (userCondUpdate.newInjuries.length > 0) {
    const appended = userCondUpdate.newInjuries
      .filter((a) => a.injury.initialMatches >= 2 || a.ovr >= 82)
      .map((a) => ({
        round: matchRound,
        competition,
        playerId: a.playerId,
        playerName: a.playerName,
        ovr: a.ovr,
        severity: a.injury.severity,
        matchesMissed: a.injury.initialMatches,
      }));
    if (appended.length > 0) {
      nextKeyInjuries = [...prevCrisisLog.keyInjuries, ...appended].slice(-8);
    }
  }
  let nextTacticalCrises = prevCrisisLog.tacticalCrises;
  if (
    nextTacticalAdaptation.pendingAlert &&
    !prevAdaptation.pendingAlert &&
    nextTacticalAdaptation.pendingAlert.tier === 'danger'
  ) {
    nextTacticalCrises = [
      ...prevCrisisLog.tacticalCrises,
      {
        round: matchRound,
        competition,
        formation,
        tactic,
        exposureScore: nextTacticalAdaptation.pendingAlert.exposureScore,
      },
    ].slice(-4);
  }
  const nextStoryCrisisLog: SeasonStoryCrisisLog =
    nextKeyInjuries === prevCrisisLog.keyInjuries &&
    nextTacticalCrises === prevCrisisLog.tacticalCrises
      ? prevCrisisLog
      : {
          keyInjuries: nextKeyInjuries,
          tacticalCrises: nextTacticalCrises,
        };

  // v9.0 Evaluate post-match Permanent Potential Awakening
  let nextAwakenedPlayers = prevAwakened;
  let nextPendingAwakeningAlerts = prevAwakeningAlerts;
  const totalUserMatchesPlayed =
    season.userMatchHistory.length +
    season.userCupMatchHistory.length +
    season.userUclMatchHistory.length;
  const chemForAwakening = calculateChemistry(
    formation,
    starters,
    tactic,
    managerTraitId,
    undefined,
    { staffCoachId, ffpChemPenalty: season.budgetState?.chemPenalty ?? 0 },
  );
  const awakeningResult = evaluatePostMatchAwakening({
    starters,
    bench,
    formation,
    matchPlayedNumber: totalUserMatchesPlayed,
    round: matchRound,
    competition,
    ratingsByPlayerId,
    goalsByPlayerId,
    assistsByPlayerId,
    minutesByPlayerId,
    cleanSheet: oppGoals === 0,
    allPlayerStats: season.allPlayerStats,
    slotSynergies: chemForAwakening.slotSynergies,
    conditionMap: mergedConditions,
    managerTraitId,
    staffCoachId,
    existingAwakenedPlayers: prevAwakened,
    storyFocusPlayerIds: season.storyFocusPlayerIds,
  });
  if (
    awakeningResult.triggered &&
    awakeningResult.awakenedPlayer &&
    awakeningResult.record &&
    awakeningResult.alert
  ) {
    nextAwakenedPlayers = {
      ...prevAwakened,
      [awakeningResult.awakenedPlayer.id]: awakeningResult.record,
    };
    nextPendingAwakeningAlerts = [
      ...prevAwakeningAlerts,
      awakeningResult.alert,
    ];
  }

  let nextEventsState: ManagerEventsState = {
    ...prevEvents,
    matchesSinceLastEvent: prevEvents.matchesSinceLastEvent + 1,
    teamMorale: nextTeamMorale,
    recentWinStreak: nextWinStreak,
    recentLossStreak: nextLossStreak,
    recentCleanSheetStreak: nextCleanSheetStreak,
    recentUnbeatenStreak: nextUnbeatenStreak,
  };

  // Trigger a non-repeating press conference / locker room event if allowed & no higher-priority alert blocks it
  if (
    allowEventTrigger &&
    !nextEventsState.activeEvent &&
    nextPendingAlerts.length === 0 &&
    nextPendingAwakeningAlerts.length === 0 &&
    !nextTacticalAdaptation.pendingAlert
  ) {
    const nextOpp = findNextOpponentInfo(season, competition);
    const userRank = getUserRank(season.standings, USER_CLUB_ID);
    const lastOppId = isUserHome
      ? userMatchResult.awayTeamId
      : userMatchResult.homeTeamId;
    const lastOppClub =
      season.clubs.find((c) => c.id === lastOppId) ??
      season.ucl?.clubs.find((c) => c.id === lastOppId);
    const picked = pickNextManagerEvent({
      eventsState: nextEventsState,
      starters,
      bench,
      conditionMap: mergedConditions,
      teamName,
      managerName,
      nextOpponentName: nextOpp.name,
      nextOpponentRank: nextOpp.rank,
      userRank,
      isCupOrUclNext: nextOpp.isCupOrUcl,
      lastMatch: userMatchResult,
      lastMatchOpponentName: lastOppClub?.name,
      lastMatchWasUserHome: isUserHome,
      lastMatchMomPlayerId: momPlayerId,
      lastMatchRatings: ratingsByPlayerId,
      recentInjuryJustOccurred: userCondUpdate.newInjuries.length > 0,
    });
    if (picked) {
      nextEventsState = {
        ...nextEventsState,
        usedEventIds: [...nextEventsState.usedEventIds, picked.templateId],
        matchesSinceLastEvent: 0,
        activeEvent: picked,
        lastResolution: null,
      };
    }
  }

  return {
    playerConditions: mergedConditions,
    managerEvents: nextEventsState,
    pendingInjuryAlerts: nextPendingAlerts,
    tacticalAdaptation: nextTacticalAdaptation,
    awakenedPlayers: nextAwakenedPlayers,
    pendingAwakeningAlerts: nextPendingAwakeningAlerts,
    storyCrisisLog: nextStoryCrisisLog,
  };
}

function simulateFullSingleRound(
  season: SeasonState,
  formation: FormationId,
  tactic: TacticId,
  managerTraitId: ManagerTraitId | null,
  starters: Player[],
  bench: Player[] = [],
  options?: {
    rawStarters?: (Player | null)[];
    rawBench?: (Player | null)[];
    teamName?: string;
    managerName?: string;
    allowEventTrigger?: boolean;
  },
): SeasonState {
  const nextRound = season.currentRound + 1;
  if (nextRound > season.totalRounds) return season;

  const workingConditions: PlayerConditionMap = {
    ...season.playerConditions,
  };
  const teamMorale = season.managerEvents?.teamMorale ?? 0;
  const effectiveUserStarters = applyConditionToPlayers(
    starters,
    workingConditions,
    teamMorale,
  );
  const effectiveUserBench = applyConditionToPlayers(
    bench,
    workingConditions,
    teamMorale,
  );

  const { chem, ratings, staffCoachId } = computeUserChemAndRatings({
    formation,
    starters: effectiveUserStarters,
    tactic,
    managerTraitId,
    season,
  });

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

  const excludeIds = new Set<string>([
    ...starters.map((p) => p.id),
    ...bench.map((p) => p.id),
    ...(season.departedPlayerIds ?? []),
  ]);

  const roundResults: MatchResult[] = [];
  let userMatchResult = season.lastUserMatch;

  const updatedFixtures = season.fixtures.map((fixture) => {
    if (fixture.round !== nextRound || fixture.played) return fixture;
    const homeClub = clubsById[fixture.homeTeamId];
    const awayClub = clubsById[fixture.awayTeamId];
    const homeIsUser = fixture.homeTeamId === USER_CLUB_ID;
    const awayIsUser = fixture.awayTeamId === USER_CLUB_ID;

    const homeAiPrep = homeIsUser
      ? null
      : prepareAiClubLineupForMatch({
          club: homeClub,
          baseRoster: season.aiRosters[fixture.homeTeamId] ?? [],
          conditionMap: workingConditions,
          excludeIds,
        });
    const awayAiPrep = awayIsUser
      ? null
      : prepareAiClubLineupForMatch({
          club: awayClub,
          baseRoster: season.aiRosters[fixture.awayTeamId] ?? [],
          conditionMap: workingConditions,
          excludeIds,
        });

    const homeRoster = homeIsUser
      ? effectiveUserStarters
      : homeAiPrep?.effectiveStarters ?? season.aiRosters[fixture.homeTeamId] ?? [];
    const awayRoster = awayIsUser
      ? effectiveUserStarters
      : awayAiPrep?.effectiveStarters ?? season.aiRosters[fixture.awayTeamId] ?? [];

    const isUserInvolved = homeIsUser || awayIsUser;

    let oppRank: number | undefined;
    if (isUserInvolved) {
      const oppId = homeIsUser ? fixture.awayTeamId : fixture.homeTeamId;
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
            starters: effectiveUserStarters,
            bench: effectiveUserBench,
            formation,
            tactic,
            chemistry: chem.total,
            ratings,
            slotSynergies: chem.slotSynergies,
            managerTraitId,
            staffCoachId,
            tacticalHistory: season.tacticalAdaptation?.history,
            competition: 'league' as const,
            opponentRank: oppRank,
            allowAutoSubs: true,
          }
        : undefined,
    );

    if (homeAiPrep) {
      commitAiClubPostMatchConditions({
        club: homeClub,
        rawStarters: homeAiPrep.rawStarters,
        fullClubSquad: homeAiPrep.fullClubSquad,
        conditionMap: workingConditions,
        competition: 'league',
        round: nextRound,
        isShortRest: false,
        outcome:
          result.homeGoals > result.awayGoals
            ? 'W'
            : result.homeGoals < result.awayGoals
              ? 'L'
              : 'D',
        goalDiff: result.homeGoals - result.awayGoals,
        cleanSheet: result.awayGoals === 0,
      });
    }
    if (awayAiPrep) {
      commitAiClubPostMatchConditions({
        club: awayClub,
        rawStarters: awayAiPrep.rawStarters,
        fullClubSquad: awayAiPrep.fullClubSquad,
        conditionMap: workingConditions,
        competition: 'league',
        round: nextRound,
        isShortRest: false,
        outcome:
          result.awayGoals > result.homeGoals
            ? 'W'
            : result.awayGoals < result.homeGoals
              ? 'L'
              : 'D',
        goalDiff: result.awayGoals - result.homeGoals,
        cleanSheet: result.homeGoals === 0,
      });
    }

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
    season.otherLeagues ?? createOtherLeaguesState(season.leagueId, excludeIds),
    nextRound,
    season.totalRounds,
    Math.random,
    excludeIds,
    workingConditions,
  );

  const interimSeason: SeasonState = {
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

  const postCond = applyPostUserMatchConditionAndEvents({
    season: interimSeason,
    workingConditions,
    formation,
    tactic,
    managerTraitId,
    starters: options?.rawStarters ?? starters,
    bench: options?.rawBench ?? bench,
    userMatchResult:
      userMatchResult && userMatchResult.round === nextRound
        ? userMatchResult
        : null,
    competition: 'league',
    round: nextRound,
    isShortRest: false,
    teamName: options?.teamName,
    managerName: options?.managerName,
    allowEventTrigger: options?.allowEventTrigger ?? false,
  });

  return {
    ...interimSeason,
    playerConditions: postCond.playerConditions,
    managerEvents: postCond.managerEvents,
    pendingInjuryAlerts: postCond.pendingInjuryAlerts,
    tacticalAdaptation: postCond.tacticalAdaptation,
    awakenedPlayers: postCond.awakenedPlayers,
    pendingAwakeningAlerts: postCond.pendingAwakeningAlerts,
    storyCrisisLog: postCond.storyCrisisLog,
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
  rawStarters?: (Player | null)[];
  rawBench?: (Player | null)[];
  teamName?: string;
  managerName?: string;
  allowEventTrigger?: boolean;
}): SeasonState {
  const {
    season,
    formation,
    tactic,
    managerTraitId,
    starters,
    bench,
    autoResolveUserMatches,
    rawStarters,
    rawBench,
    teamName,
    managerName,
    allowEventTrigger = false,
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

    const workingConditions: PlayerConditionMap = {
      ...current.playerConditions,
    };
    const teamMorale = current.managerEvents?.teamMorale ?? 0;
    const effectiveUserStarters = applyConditionToPlayers(
      starters,
      workingConditions,
      teamMorale,
    );
    const effectiveUserBench = applyConditionToPlayers(
      bench,
      workingConditions,
      teamMorale,
    );

    // Either user was already eliminated OR fast-simming -> auto-resolve this cup stage
    const { chem, ratings, staffCoachId } = computeUserChemAndRatings({
      formation,
      starters: effectiveUserStarters,
      tactic,
      managerTraitId,
      season: current,
    });
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

    const excludeIds = new Set<string>([
      ...starters.map((p) => p.id),
      ...bench.map((p) => p.id),
      ...(current.departedPlayerIds ?? []),
    ]);

    const res = advanceCupStage({
      cup: current.cup,
      stage: triggered,
      clubsById,
      aiRosters: current.aiRosters,
      cupPlayerStats: current.cupPlayerStats,
      conditionMap: workingConditions,
      excludeIds,
      userContext: userNode
        ? {
            userClubId: USER_CLUB_ID,
            starters: effectiveUserStarters,
            bench: effectiveUserBench,
            formation,
            tactic,
            chemistry: chem.total,
            ratings,
            slotSynergies: chem.slotSynergies,
            managerTraitId,
            staffCoachId,
            tacticalHistory: current.tacticalAdaptation?.history,
            competition: 'cup',
            allowAutoSubs: true,
          }
        : undefined,
    });

    const interimCupSeason: SeasonState = {
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
      playerConditions: workingConditions,
    };

    if (res.userResult) {
      const postCond = applyPostUserMatchConditionAndEvents({
        season: interimCupSeason,
        workingConditions,
        formation,
        tactic,
        managerTraitId,
        starters: rawStarters ?? starters,
        bench: rawBench ?? bench,
        userMatchResult: res.userResult,
        competition: 'cup',
        round: current.currentRound,
        isShortRest: true,
        teamName,
        managerName,
        allowEventTrigger,
      });
      current = {
        ...interimCupSeason,
        playerConditions: postCond.playerConditions,
        managerEvents: postCond.managerEvents,
        pendingInjuryAlerts: postCond.pendingInjuryAlerts,
        tacticalAdaptation: postCond.tacticalAdaptation,
        awakenedPlayers: postCond.awakenedPlayers,
        pendingAwakeningAlerts: postCond.pendingAwakeningAlerts,
    storyCrisisLog: postCond.storyCrisisLog,
      };
    } else {
      current = interimCupSeason;
    }
  }

  return current;
}

function computeSeasonScoreFromState(state: GameState): SeasonState['seasonScore'] {
  if (!state.season) return null;
  const filledStarters = state.starters.filter((p): p is Player => p !== null);
  const { chem, ratings } = computeUserChemAndRatings({
    formation: state.formation,
    starters: filledStarters,
    tactic: state.season.defaultTactic,
    managerTraitId: state.manager.traitId,
    season: state.season,
  });
  const userRow = state.season.standings.find((r) => r.teamId === USER_CLUB_ID);
  const finalRank = getUserRank(state.season.standings, USER_CLUB_ID);
  const played = Math.max(1, userRow?.played ?? state.season.totalRounds);
  const converted38Points = ((userRow?.points ?? 0) / played) * 38;

  const slotSynValues = Object.values(chem.slotSynergies);
  const avgSynergyOvrBonus =
    slotSynValues.length > 0
      ? Math.round(
          (slotSynValues.reduce((sum, s) => sum + s.totalBonus, 0) /
            slotSynValues.length) *
            100,
        ) / 100
      : 0;
  const managerSynergyCount = filledStarters.filter(
    (p) => evaluateManagerPlayerSynergy(p, state.manager.traitId).isMatch,
  ).length;

  const wonCup = didUserWinCup(state.season.cup, USER_CLUB_ID);
  const wonUcl = didUserWinUcl(state.season.ucl, USER_CLUB_ID);
  const uclMatches = state.season.userUclMatchHistory ?? [];
  const uclUnbeatenWin =
    wonUcl &&
    uclMatches.length > 0 &&
    uclMatches.every((m) => {
      const isHome = m.homeTeamId === USER_CLUB_ID;
      const ug = isHome ? m.homeGoals : m.awayGoals;
      const og = isHome ? m.awayGoals : m.homeGoals;
      if (m.extraTime?.penalties) {
        return m.extraTime.penalties.winnerTeamId === USER_CLUB_ID;
      }
      return ug >= og;
    });
  const uclPerfectWin =
    wonUcl &&
    uclMatches.length >= 8 &&
    uclMatches.every((m) => {
      const isHome = m.homeTeamId === USER_CLUB_ID;
      const ug = isHome ? m.homeGoals : m.awayGoals;
      const og = isHome ? m.awayGoals : m.homeGoals;
      return ug > og;
    });

  const managerRating = computeUserSeasonManagerRating({
    finalLeagueRank: finalRank,
    wonCup,
    wonUcl,
    leagueLosses: userRow?.lost ?? 0,
    leaguePlayed: played,
    converted38Points,
    chemistry: chem.total,
    managerSynergyCount,
  });

  const filledBench = state.bench.filter((p): p is Player => p !== null);
  const benchAvgOvr =
    filledBench.length > 0
      ? Math.round(
          (filledBench.reduce((sum, p) => sum + p.ovr, 0) /
            filledBench.length) *
            10,
        ) / 10
      : undefined;

  const tacticalFit =
    filledStarters.length > 0
      ? evaluateTeamTacticalProfile({
          starters: state.starters,
          formation: state.formation,
          tactic: state.season.defaultTactic,
          managerTraitId: state.manager.traitId,
          managerOvr: managerRating,
        }).tacticalFit
      : undefined;

  return computeSeasonScore({
    leaguePoints: userRow?.points ?? 0,
    leaguePlayed: played,
    leagueGoalDifference: userRow?.goalDifference ?? 0,
    leagueLosses: userRow?.lost ?? 0,
    leagueGoalsFor: userRow?.goalsFor,
    leagueGoalsAgainst: userRow?.goalsAgainst,
    finalLeagueRank: finalRank,
    leagueId: state.season.leagueId,
    cup: state.season.cup,
    ucl: state.season.ucl,
    uclPerfectWin,
    uclUnbeatenWin,
    teamAvgOvr: ratings.rawOvr,
    benchAvgOvr,
    chemistry: chem.total,
    avgSynergyOvrBonus,
    managerSynergyCount,
    managerRating,
    tacticalFit,
    awards: state.season.awards,
    globalAwards: state.season.globalAwards ?? null,
    ffpTier: state.season.budgetState?.ffpTier ?? 0,
    ffpScoreMultiplier: state.season.budgetState?.scoreMultiplier ?? 1,
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

  const excludeIds = new Set<string>([
    ...filledStarters.map((p) => p.id),
    ...filledBench.map((p) => p.id),
    ...(finalSeason.departedPlayerIds ?? []),
  ]);

  const isStoryMode = Boolean(state.storyMode);
  const finalOtherLeagues = isStoryMode
    ? {}
    : advanceOtherLeaguesToProgress(
        finalSeason.otherLeagues ??
          createOtherLeaguesState(finalSeason.leagueId, excludeIds),
        finalSeason.totalRounds,
        finalSeason.totalRounds,
        Math.random,
        excludeIds,
      );

  const uclQualifiedSummary = isStoryMode
    ? []
    : buildFiveLeagueUclQualifiers({
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

  const finalRank = getUserRank(finalSeason.standings, USER_CLUB_ID);

  let finalUcl = finalSeason.ucl;
  let finalUclPlayerStats = finalSeason.uclPlayerStats;
  let globalAwards: SeasonState['globalAwards'] = null;

  if (!isStoryMode && finalRank > 4) {
    // Non-UCL user: run background 36-team AI-only UCL to completion so Ballon d'Or & World Best XI
    // are awarded ONCE with full European results finalized!
    const chem = calculateChemistry(
      state.formation,
      filledStarters,
      finalSeason.defaultTactic,
      state.manager.traitId,
    );
    const ratings = calculateTeamRatings(
      state.formation,
      filledStarters,
      chem.total,
      state.manager.traitId,
      chem.slotSynergies,
      finalSeason.defaultTactic,
    );
    const userClubEntry = buildUserClubEntry(
      state.userClub,
      state.formation,
      finalSeason.defaultTactic,
      filledStarters,
      ratings,
    );
    const ownedIds = new Set<string>([
      ...filledStarters.map((p) => p.id),
      ...filledBench.map((p) => p.id),
    ]);
    const bgInit = createUclTournamentState({
      userLeagueId: finalSeason.leagueId,
      userClub: userClubEntry,
      userSquad: [...filledStarters, ...filledBench],
      userLeagueClubs: finalSeason.clubs,
      userLeagueStandings: finalSeason.standings,
      userAiRosters: finalSeason.aiRosters,
      otherLeagues: finalOtherLeagues,
      excludeIds,
      ownedIds,
      userParticipated: false,
    });
    const bgSim = simulateUclToCompletion({
      ucl: bgInit.ucl,
      uclPlayerStats: bgInit.uclPlayerStats,
      excludeIds,
      ownedIds,
    });
    finalUcl = bgSim.ucl;
    finalUclPlayerStats = bgSim.uclPlayerStats;

    globalAwards = computeGlobalSeasonAwards({
      allLeaguePlayerStats: finalSeason.allPlayerStats,
      cupPlayerStats: finalSeason.cupPlayerStats,
      uclPlayerStats: finalUclPlayerStats,
      leagueStandings: finalSeason.standings,
      cup: finalSeason.cup,
      ucl: finalUcl,
      otherLeagues: finalOtherLeagues,
      userLeagueId: finalSeason.leagueId,
      excludeIds,
    });
  }
  // If finalRank <= 4: globalAwards stays null until UCL completes (awarded ONCE after UCL!)

  const handoff = isStoryMode
    ? null
    : buildPhase2HandoffState({
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

  if (handoff && !isStoryMode) {
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
      ucl: finalUcl,
      uclPlayerStats: finalUclPlayerStats,
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
      type: 'APPLY_USER_PROFILE';
      payload: {
        clubProfile: UserClubProfile;
        managerName: string;
        managerAvatar: ManagerAvatarConfig;
      };
    }
  | {
      type: 'UPDATE_MANAGER_PROFILE';
      payload: { name?: string; avatar?: Partial<ManagerAvatarConfig> };
    }
  | { type: 'SELECT_MANAGER_TRAIT'; payload: { traitId: ManagerTraitId } }
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
        etTactic?: TacticId;
        extraSub?: { starterIndex: number; benchIndex: number };
        firstHalfStarters?: Player[];
        halftimeSubIds?: string[];
      };
    }
  | { type: 'ENTER_ET_HALFTIME_LOCKER' }
  | {
      type: 'START_ET_SECOND_HALF_BROADCAST';
      payload?: {
        etTactic?: TacticId;
        firstHalfStarters?: Player[];
        halftimeSubIds?: string[];
      };
    }
  | { type: 'ENTER_PENALTY_SHOOTOUT' }
  | {
      type: 'COMMIT_LIVE_MATCH';
      payload?: { secondHalfTactic?: TacticId };
    }
  | { type: 'START_SOLO_STREAM_MATCH' }
  | {
      type: 'ENTER_LIVE_BROADCAST_FROM_STREAM';
      payload: { minute: number; inPenalties?: boolean };
    }
  | { type: 'CANCEL_SOLO_STREAM_MATCH' }
  | {
      type: 'ABORT_STREAM_AND_START_LIVE_2D';
      payload?: { minute?: number; inPenalties?: boolean };
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
        cashOfferM?: number;
      };
    }
  | {
      type: 'TRADE_SUBMIT_PACKAGE';
      payload: {
        partnerClub: Club;
        partnerLeagueId: LeagueId;
        partnerClubRank: number;
        partnerLeagueSize: number;
        userSentSlots: { area: 'starter' | 'bench'; index: number }[];
        aiTargetPlayers: Player[];
        aiFillerPlayers?: Player[];
        cashOfferM?: number;
        overrideRoll?: number; // optional deterministic roll 0..100 for tests
      };
    }
  | {
      type: 'TRADE_ACCEPT_INCOMING';
      payload: { offerId: string };
    }
  | {
      type: 'TRADE_REJECT_INCOMING';
      payload: { offerId: string };
    }
  | { type: 'TRANSFER_CLOSE_WINDOW' }
  | { type: 'HIRE_STAFF_COACH'; payload: { coachId: StaffCoachId } }
  | { type: 'SKIP_STAFF_COACH' }
  | { type: 'DISMISS_FFP_OPENING_NOTICE' }
  | { type: 'DISMISS_ADAPTATION_ALERT' }
  | { type: 'OPEN_STORY_HUB' }
  | {
      type: 'ENTER_STORY_SETUP';
      payload: { bundle: StoryScenarioDataBundle };
    }
  | {
      type: 'SET_STORY_MANAGER_TRAIT';
      payload: { traitId: ManagerTraitId };
    }
  | { type: 'START_STORY_SEASON'; payload: { bundle: StoryScenarioDataBundle } }
  | { type: 'RESUME_STORY_SAVE'; payload: { savedState: GameState } }
  | { type: 'EXIT_STORY_TO_TITLE' }
  | { type: 'MARK_STORY_CODEX_RECORDED' }
  | { type: 'DISMISS_AWAKENING_ALERT' }
  | { type: 'MARK_CUP_CELEBRATED' }
  | { type: 'ENTER_UCL_MODE' }
  | { type: 'SIMULATE_UCL_LEAGUE_PHASE_TO_END' }
  | { type: 'SIMULATE_UCL_PLAYOFF_BYE' }
  | { type: 'SIMULATE_UCL_TO_END' }
  | { type: 'SKIP_UCL_TO_FINAL_SUMMARY' }
  | { type: 'FINISH_UCL_TO_SUMMARY' }
  | { type: 'RESOLVE_MANAGER_EVENT'; payload: { choiceId: string } }
  | { type: 'DISMISS_MANAGER_EVENT_RESOLUTION' }
  | {
      type: 'DISMISS_INJURY_ALERTS';
      payload?: { autoReturnsToAdd?: InjuryAutoReturnEntry[] };
    }
  | {
      type: 'AUTO_REPLACE_INJURED_STARTER';
      payload: { starterSlotIndex: number; benchIndex: number; playerId: string };
    }
  | { type: 'DISMISS_INJURY_RETURN_TOAST'; payload?: { id?: string } }
  | { type: 'MARK_LEGACY_ARCHIVED' }
  | { type: 'RESET_GAME' };

function buildUserExclusionSets(
  starters: (Player | null)[],
  bench: (Player | null)[],
  departedPlayerIds?: string[],
): { ownedIds: Set<string>; excludeIds: Set<string> } {
  const ownedIds = new Set<string>();
  for (const p of starters) {
    if (p) ownedIds.add(p.id);
  }
  for (const p of bench) {
    if (p) ownedIds.add(p.id);
  }
  const excludeIds = new Set<string>([
    ...ownedIds,
    ...(departedPlayerIds ?? []),
  ]);
  return { ownedIds, excludeIds };
}

function buildSafeOpponentLiveRoster(params: {
  club: Club | undefined;
  baseRoster: Player[];
  conditionMap: PlayerConditionMap | undefined;
  ownedIds: Set<string>;
  excludeIds: Set<string>;
  includeBench?: boolean;
}): Player[] {
  const {
    club,
    baseRoster,
    conditionMap,
    ownedIds,
    excludeIds,
    includeBench = false,
  } = params;
  if (!club) {
    return baseRoster.filter((p) => !ownedIds.has(p.id));
  }
  const prep = prepareAiClubLineupForMatch({
    club,
    baseRoster,
    conditionMap,
    excludeIds,
    ownedIds,
  });
  const starters = prep.effectiveStarters;
  if (!includeBench) return starters;

  const starterIds = new Set(starters.map((p) => p.id));
  const extraBenchFromBase = baseRoster
    .slice(11)
    .filter(
      (p) =>
        !ownedIds.has(p.id) &&
        !starterIds.has(p.id) &&
        !isPlayerUnavailable(conditionMap?.[p.id]),
    );
  const benchExclude = new Set<string>([
    ...excludeIds,
    ...starterIds,
    ...extraBenchFromBase.map((p) => p.id),
  ]);
  const needed = Math.max(0, 5 - extraBenchFromBase.length);
  const depthBench =
    needed > 0
      ? getClubRealDepthPool(club.name, benchExclude)
          .filter((p) => !isPlayerUnavailable(conditionMap?.[p.id]))
          .slice(0, needed)
      : [];
  return [...starters, ...extraBenchFromBase, ...depthBench];
}

function sanitizeRosterMapForUser(params: {
  rosters: Record<string, Player[]> | undefined;
  clubs: Club[];
  leagueIdByClubId?: Map<string, LeagueId>;
  defaultLeagueId: LeagueId;
  ownedIds: Set<string>;
  excludeIds: Set<string>;
}): Record<string, Player[]> {
  const {
    rosters,
    clubs,
    leagueIdByClubId,
    defaultLeagueId,
    ownedIds,
    excludeIds,
  } = params;
  if (!rosters) return {};
  if (ownedIds.size === 0) return rosters;
  const clubById = new Map(clubs.map((c) => [c.id, c]));
  const out: Record<string, Player[]> = {};
  for (const [cid, list] of Object.entries(rosters)) {
    if (cid === USER_CLUB_ID) {
      out[cid] = list;
      continue;
    }
    const club = clubById.get(cid);
    if (!club) {
      out[cid] = list.filter((p) => !ownedIds.has(p.id));
      continue;
    }
    out[cid] = sanitizeAiClubRoster({
      club,
      leagueId: leagueIdByClubId?.get(cid) ?? defaultLeagueId,
      roster: list,
      ownedIds,
      excludeIds,
    });
  }
  return out;
}

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
  const workingConditions: PlayerConditionMap = {
    ...season.playerConditions,
  };
  const { ownedIds, excludeIds } = buildUserExclusionSets(
    filledStarters,
    filledBench,
    season.departedPlayerIds,
  );

  const { ratings } = computeUserChemAndRatings({
    formation: restoredFormation,
    starters: filledStarters,
    tactic: activeTactic,
    managerTraitId: state.manager.traitId,
    season,
  });

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
      conditionMap: workingConditions,
      excludeIds,
    });
    const finalUserCupMatch = cupRes.userResult ?? userMatchResult;
    const interimCupSeason: SeasonState = {
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
    const postCond = applyPostUserMatchConditionAndEvents({
      season: interimCupSeason,
      workingConditions,
      formation: restoredFormation,
      tactic: halftime.userTacticAtKickoff,
      managerTraitId: state.manager.traitId,
      starters: restoredStarters,
      bench: restoredBench,
      userMatchResult: finalUserCupMatch,
      competition: 'cup',
      round: season.currentRound,
      isShortRest: true,
      teamName: state.userClub.name,
      managerName: state.manager.name,
      allowEventTrigger: true,
      liveSubs: halftime.liveSubs,
    });
    const nextSeason: SeasonState = {
      ...interimCupSeason,
      playerConditions: postCond.playerConditions,
      managerEvents: postCond.managerEvents,
      pendingInjuryAlerts: postCond.pendingInjuryAlerts,
      tacticalAdaptation: postCond.tacticalAdaptation,
      awakenedPlayers: postCond.awakenedPlayers,
      pendingAwakeningAlerts: postCond.pendingAwakeningAlerts,
    storyCrisisLog: postCond.storyCrisisLog,
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
            conditionMap: workingConditions,
            excludeIds,
            ownedIds,
          })
        : advanceUclKnockoutLeg({
            ucl,
            uclPlayerStats: season.uclPlayerStats,
            precomputedUserResult: userMatchResult,
            conditionMap: workingConditions,
            excludeIds,
            ownedIds,
          });
    const finalUserUclMatch = uclRes.userResult ?? userMatchResult;
    const interimUclSeason: SeasonState = {
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
    const postCond = applyPostUserMatchConditionAndEvents({
      season: interimUclSeason,
      workingConditions,
      formation: restoredFormation,
      tactic: halftime.userTacticAtKickoff,
      managerTraitId: state.manager.traitId,
      starters: restoredStarters,
      bench: restoredBench,
      userMatchResult: finalUserUclMatch,
      competition: 'ucl',
      round: halftime.round,
      isShortRest: true,
      teamName: state.userClub.name,
      managerName: state.manager.name,
      allowEventTrigger: true,
      liveSubs: halftime.liveSubs,
    });
    const nextSeason: SeasonState = {
      ...interimUclSeason,
      playerConditions: postCond.playerConditions,
      managerEvents: postCond.managerEvents,
      pendingInjuryAlerts: postCond.pendingInjuryAlerts,
      tacticalAdaptation: postCond.tacticalAdaptation,
      awakenedPlayers: postCond.awakenedPlayers,
      pendingAwakeningAlerts: postCond.pendingAwakeningAlerts,
    storyCrisisLog: postCond.storyCrisisLog,
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
      // Update opponent AI squad conditions for user's live opponent
      const oppId =
        fixture.homeTeamId === USER_CLUB_ID
          ? fixture.awayTeamId
          : fixture.homeTeamId;
      const oppClub = clubsById[oppId];
      if (oppClub) {
        const oppPrep = prepareAiClubLineupForMatch({
          club: oppClub,
          baseRoster: season.aiRosters[oppId] ?? [],
          conditionMap: workingConditions,
          excludeIds,
        });
        const oppGoals =
          fixture.homeTeamId === USER_CLUB_ID
            ? userMatchResult.awayGoals
            : userMatchResult.homeGoals;
        const userGoals =
          fixture.homeTeamId === USER_CLUB_ID
            ? userMatchResult.homeGoals
            : userMatchResult.awayGoals;
        commitAiClubPostMatchConditions({
          club: oppClub,
          rawStarters: oppPrep.rawStarters,
          fullClubSquad: oppPrep.fullClubSquad,
          conditionMap: workingConditions,
          competition: 'league',
          round: nextRound,
          isShortRest: false,
          outcome:
            oppGoals > userGoals ? 'W' : oppGoals < userGoals ? 'L' : 'D',
          goalDiff: oppGoals - userGoals,
          cleanSheet: userGoals === 0,
        });
      }
      return { ...fixture, played: true, result: userMatchResult };
    }
    const homeClub = clubsById[fixture.homeTeamId];
    const awayClub = clubsById[fixture.awayTeamId];
    const homeAiPrep = prepareAiClubLineupForMatch({
      club: homeClub,
      baseRoster: season.aiRosters[fixture.homeTeamId] ?? [],
      conditionMap: workingConditions,
      excludeIds,
    });
    const awayAiPrep = prepareAiClubLineupForMatch({
      club: awayClub,
      baseRoster: season.aiRosters[fixture.awayTeamId] ?? [],
      conditionMap: workingConditions,
      excludeIds,
    });
    const res = simulateMatch(
      fixture,
      homeClub,
      awayClub,
      homeAiPrep.effectiveStarters,
      awayAiPrep.effectiveStarters,
    );
    commitAiClubPostMatchConditions({
      club: homeClub,
      rawStarters: homeAiPrep.rawStarters,
      fullClubSquad: homeAiPrep.fullClubSquad,
      conditionMap: workingConditions,
      competition: 'league',
      round: nextRound,
      isShortRest: false,
      outcome:
        res.homeGoals > res.awayGoals
          ? 'W'
          : res.homeGoals < res.awayGoals
            ? 'L'
            : 'D',
      goalDiff: res.homeGoals - res.awayGoals,
      cleanSheet: res.awayGoals === 0,
    });
    commitAiClubPostMatchConditions({
      club: awayClub,
      rawStarters: awayAiPrep.rawStarters,
      fullClubSquad: awayAiPrep.fullClubSquad,
      conditionMap: workingConditions,
      competition: 'league',
      round: nextRound,
      isShortRest: false,
      outcome:
        res.awayGoals > res.homeGoals
          ? 'W'
          : res.awayGoals < res.homeGoals
            ? 'L'
            : 'D',
      goalDiff: res.awayGoals - res.homeGoals,
      cleanSheet: res.homeGoals === 0,
    });
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
    season.otherLeagues ?? createOtherLeaguesState(season.leagueId, excludeIds),
    nextRound,
    season.totalRounds,
    Math.random,
    excludeIds,
    workingConditions,
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
    playerConditions: workingConditions,
  };

  const postCond = applyPostUserMatchConditionAndEvents({
    season: nextSeason,
    workingConditions,
    formation: restoredFormation,
    tactic: halftime.userTacticAtKickoff,
    managerTraitId: state.manager.traitId,
    starters: restoredStarters,
    bench: restoredBench,
    userMatchResult,
    competition: 'league',
    round: nextRound,
    isShortRest: false,
    teamName: state.userClub.name,
    managerName: state.manager.name,
    allowEventTrigger: true,
    liveSubs: halftime.liveSubs,
  });

  nextSeason = {
    ...nextSeason,
    playerConditions: postCond.playerConditions,
    managerEvents: postCond.managerEvents,
    pendingInjuryAlerts: postCond.pendingInjuryAlerts,
    tacticalAdaptation: postCond.tacticalAdaptation,
    awakenedPlayers: postCond.awakenedPlayers,
    pendingAwakeningAlerts: postCond.pendingAwakeningAlerts,
    storyCrisisLog: postCond.storyCrisisLog,
  };

  nextSeason = syncCupAfterRound({
    season: nextSeason,
    formation: restoredFormation,
    tactic: nextSeason.defaultTactic,
    managerTraitId: state.manager.traitId,
    starters: filledStarters,
    bench: filledBench,
    autoResolveUserMatches: false,
    rawStarters: restoredStarters,
    rawBench: restoredBench,
    teamName: state.userClub.name,
    managerName: state.manager.name,
    allowEventTrigger: false,
  });

  const trigger = checkTransferWindowTrigger(
    nextSeason.currentRound,
    nextSeason.transferWindows,
    nextSeason.transferMarket.completedWindows,
  );
  if (trigger) {
    nextSeason = openTransferAndMidSeasonCoach({
      season: nextSeason,
      starters: restoredStarters,
      bench: restoredBench,
      windowIndex: trigger.windowIndex,
      triggerRound: trigger.triggerRound,
      userRank: getUserRank(nextSeason.standings, USER_CLUB_ID),
      allowedLeagueIds: state.draftLeaguePool,
      storyMode: state.storyMode,
    });
  }

  return finalizeSeasonIfEnded({
    ...state,
    formation: restoredFormation,
    starters: restoredStarters,
    bench: restoredBench,
    season: nextSeason,
    ...(trigger && state.storyMode
      ? {
          storyMode: {
            ...state.storyMode,
            signingsThisWindow: 0,
          },
        }
      : {}),
  });
}

function openTransferWindowWithIncomingOffers(params: {
  season: SeasonState;
  starters: (Player | null)[];
  bench: (Player | null)[];
  windowIndex: number;
  triggerRound: number;
  userRank: number;
  allowedLeagueIds?: LeagueId[];
  storyMode?: StoryModeRuntimeState | null;
  options?: { isUclSpecial?: boolean; championBonusActive?: boolean };
}) {
  const {
    season,
    starters,
    bench,
    windowIndex,
    triggerRound,
    userRank,
    allowedLeagueIds,
    storyMode,
    options,
  } = params;
  const isRegularWindow = !options?.isUclSpecial;
  const ffpEmbargoActive = storyMode
    ? false
    : isFfpEmbargoWindow(season.budgetState, windowIndex, {
        isUclSpecial: options?.isUclSpecial,
      });
  const maxAttemptsOverride = storyMode
    ? 3
    : isRegularWindow
      ? getFfpWindowMaxAttempts(season.budgetState, windowIndex, 3)
      : undefined;

  const incomingOffers = ffpEmbargoActive
    ? []
    : generateIncomingTradeOffers({
        windowIndex,
        currentRound: season.currentRound,
        userLeagueId: season.leagueId,
        userRank,
        userStarters: starters,
        userBench: bench,
        standings: season.standings,
        otherLeagues: season.otherLeagues,
        aiRosters: season.aiRosters,
        allPlayerStats: season.allPlayerStats,
        conditionMap: season.playerConditions,
        departedPlayerIds: season.departedPlayerIds ?? [],
        allowedLeagueIds,
        ...(storyMode ? { storyTransferPool: storyMode.transferPoolClubs } : {}),
      });
  return createOpenTransferState(
    windowIndex,
    triggerRound,
    userRank,
    season.transferMarket,
    {
      ...options,
      incomingOffers,
      maxAttemptsOverride,
      ffpEmbargoActive,
    },
  );
}

function openTransferAndMidSeasonCoach(params: {
  season: SeasonState;
  starters: (Player | null)[];
  bench: (Player | null)[];
  windowIndex: number;
  triggerRound: number;
  userRank: number;
  allowedLeagueIds?: LeagueId[];
  storyMode?: StoryModeRuntimeState | null;
  options?: { isUclSpecial?: boolean; championBonusActive?: boolean };
}): SeasonState {
  const { season, windowIndex, options } = params;
  const transferMarket = openTransferWindowWithIncomingOffers(params);
  let nextStaffCoach = season.staffCoach;
  if (
    windowIndex === 2 &&
    !options?.isUclSpecial &&
    !season.staffCoach?.completed &&
    !season.staffCoach?.pendingSelection
  ) {
    const offeredCoachIds = rollMidSeasonStaffCoachOffers({
      activeTactic: season.defaultTactic,
    });
    nextStaffCoach = {
      ...(season.staffCoach ?? createInitialStaffCoachState()),
      offeredCoachIds,
      pendingSelection: true,
    };
  }
  return {
    ...season,
    transferMarket,
    ...(nextStaffCoach ? { staffCoach: nextStaffCoach } : {}),
  };
}

function executeBidirectionalTrade(params: {
  state: GameState;
  partnerClub: Club;
  partnerLeagueId: LeagueId;
  userSentSlots: { area: 'starter' | 'bench'; index: number }[];
  aiTargetPlayers: Player[];
  aiFillerPlayers: Player[];
  acceptanceChance: number;
  gmReaction: string;
  isIncomingOffer: boolean;
  acceptedIncomingOfferId?: string;
  nextAttempts: number;
  cashOfferM?: number;
}): GameState {
  const {
    state,
    partnerClub,
    partnerLeagueId,
    userSentSlots,
    aiTargetPlayers,
    aiFillerPlayers,
    acceptanceChance,
    gmReaction,
    isIncomingOffer,
    acceptedIncomingOfferId,
    nextAttempts,
    cashOfferM = 0,
  } = params;
  const season = state.season;
  if (!season) return state;
  const tm = season.transferMarket;

  const userSentPlayers: Player[] = [];
  for (const slot of userSentSlots) {
    const p =
      slot.area === 'starter'
        ? state.starters[slot.index]
        : state.bench[slot.index];
    if (!p) return state;
    userSentPlayers.push(p);
  }

  const allIncomingRaw = [...aiTargetPlayers, ...aiFillerPlayers];
  if (userSentPlayers.length !== allIncomingRaw.length || userSentPlayers.length === 0) {
    return state;
  }

  // Re-tag club & league metadata cleanly while keeping exact Player ID for cumulative stats
  const allIncomingForUser: Player[] = allIncomingRaw.map((p) => ({
    ...p,
    club: state.userClub.name,
    leagueId: season.leagueId,
  }));
  const allSentForPartner: Player[] = userSentPlayers.map((p) => ({
    ...p,
    club: partnerClub.name,
    leagueId: partnerLeagueId,
  }));

  // 1) Update user starters & bench (exact 16-player Option 3 invariant)
  const nextStarters = [...state.starters];
  const nextBench = [...state.bench];
  userSentSlots.forEach((slot, idx) => {
    const incoming = allIncomingForUser[idx];
    if (slot.area === 'starter') nextStarters[slot.index] = incoming;
    else nextBench[slot.index] = incoming;
  });

  const nextFilledStarters = nextStarters.filter((p): p is Player => p !== null);
  const incomingIds = new Set(allIncomingRaw.map((p) => p.id));
  const sentIds = new Set(userSentPlayers.map((p) => p.id));

  // 2) Update departedPlayerIds (keep both incoming & sent players so neither ever re-spawns via depth pool on their original club)
  const nextDepartedPlayerIds = Array.from(
    new Set([
      ...(season.departedPlayerIds ?? []),
      ...allIncomingRaw.map((p) => p.id),
      ...userSentPlayers.map((p) => p.id),
    ]),
  );

  // 3) 100% Bidirectional AI Club Roster Sync (0 world duplicates across 5 leagues + UCL)
  //    Re-optimize partner club's Best XI so traded-in starter-grade players immediately start in indices 0..10.
  const nextAiRosters: Record<string, Player[]> = {};
  let partnerPrevRoster: Player[] | null = null;
  let partnerNextRoster: Player[] | null = null;
  for (const [cid, roster] of Object.entries(season.aiRosters)) {
    // Scrub any moved IDs from every club first to guarantee zero duplicates
    let cleaned = roster.filter(
      (p) => !incomingIds.has(p.id) && !sentIds.has(p.id),
    );
    if (partnerLeagueId === season.leagueId && cid === partnerClub.id) {
      partnerPrevRoster = roster;
      cleaned = reoptimizeAiClubRoster({
        roster: [...cleaned, ...allSentForPartner],
        formation: partnerClub.formation,
      });
      partnerNextRoster = cleaned;
    }
    nextAiRosters[cid] = cleaned;
  }

  const nextClubs =
    partnerLeagueId === season.leagueId && partnerPrevRoster && partnerNextRoster
      ? season.clubs.map((c) =>
          c.id === partnerClub.id
            ? adjustAiClubRatingsForRosterChange(
                c,
                partnerPrevRoster!,
                partnerNextRoster!,
              )
            : c,
        )
      : season.clubs;

  const nextOtherLeagues: SeasonState['otherLeagues'] = {
    ...season.otherLeagues,
  };
  for (const lid of Object.keys(nextOtherLeagues) as LeagueId[]) {
    const ol = nextOtherLeagues[lid];
    if (!ol || !ol.aiRosters) continue;
    const updatedOlRosters: Record<string, Player[]> = {};
    let olPrevPartner: Player[] | null = null;
    let olNextPartner: Player[] | null = null;
    for (const [cid, roster] of Object.entries(ol.aiRosters)) {
      let cleaned = roster.filter(
        (p) => !incomingIds.has(p.id) && !sentIds.has(p.id),
      );
      if (lid === partnerLeagueId && cid === partnerClub.id) {
        olPrevPartner = roster;
        cleaned = reoptimizeAiClubRoster({
          roster: [...cleaned, ...allSentForPartner],
          formation: partnerClub.formation,
        });
        olNextPartner = cleaned;
      }
      updatedOlRosters[cid] = cleaned;
    }
    const updatedOlClubs =
      lid === partnerLeagueId && olPrevPartner && olNextPartner
        ? ol.clubs.map((c) =>
            c.id === partnerClub.id
              ? adjustAiClubRatingsForRosterChange(
                  c,
                  olPrevPartner!,
                  olNextPartner!,
                )
              : c,
          )
        : ol.clubs;
    nextOtherLeagues[lid] = {
      ...ol,
      clubs: updatedOlClubs,
      aiRosters: updatedOlRosters,
    };
  }

  // 4) Cumulative Stats Continuity & 🔄 트레이드 Transfer History on BOTH sides
  const transferComp: 'league' | 'ucl' = tm.isUclSpecial ? 'ucl' : 'league';
  const windowLabel = tm.isUclSpecial
    ? 'UCL 특별 트레이드'
    : `${tm.windowIndex}차 이적시장 (${season.currentRound}R)`;

  const userClubMeta = {
    id: USER_CLUB_ID,
    name: state.userClub.name,
    shortName: state.userClub.shortName,
    primaryColor: state.userClub.primaryColor,
    secondaryColor: state.userClub.secondaryColor,
  };
  const partnerClubMeta = {
    id: partnerClub.id,
    name: partnerClub.name,
    shortName: partnerClub.shortName,
    primaryColor: partnerClub.primaryColor,
    secondaryColor: partnerClub.secondaryColor,
  };

  const applyRecordToStats = (
    sourceMap: Record<string, PlayerSeasonStats>,
    player: Player,
    toClub: typeof userClubMeta,
    isToUser: boolean,
    record: PlayerTransferRecord,
    seedFromStats?: PlayerSeasonStats | null,
  ): Record<string, PlayerSeasonStats> => {
    const nextMap = { ...sourceMap };
    const existing =
      nextMap[player.id] ??
      nextMap[`user::${player.id}`] ??
      seedFromStats ??
      null;
    delete nextMap[`user::${player.id}`];

    if (existing) {
      const prevHist = existing.transferHistory ?? [];
      nextMap[player.id] = {
        ...existing,
        teamId: toClub.id,
        teamName: toClub.name,
        teamShortName: toClub.shortName,
        teamPrimaryColor: toClub.primaryColor,
        teamSecondaryColor: toClub.secondaryColor,
        isUserTeam: isToUser,
        transferHistory: [...prevHist, record],
      };
    } else {
      nextMap[player.id] = {
        playerId: player.id,
        playerName: formatPlayerRecordName(player),
        teamId: toClub.id,
        teamName: toClub.name,
        teamShortName: toClub.shortName,
        teamPrimaryColor: toClub.primaryColor,
        teamSecondaryColor: toClub.secondaryColor,
        isUserTeam: isToUser,
        position: player.position,
        mainPositions: [...player.mainPositions],
        ovr: player.ovr,
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
        isLegend: player.isLegend,
        classicEra: player.classicEra,
        transferHistory: [record],
      };
    }
    return nextMap;
  };

  let nextStats = { ...season.allPlayerStats };
  let nextCupStats = { ...season.cupPlayerStats };
  let nextUclStats = { ...season.uclPlayerStats };
  const partnerOtherStats =
    partnerLeagueId !== season.leagueId
      ? nextOtherLeagues?.[partnerLeagueId]?.playerStats
      : undefined;
  let updatedPartnerOtherStats = partnerOtherStats
    ? { ...partnerOtherStats }
    : null;

  for (const incomingPlayer of allIncomingRaw) {
    const rec: PlayerTransferRecord = {
      fromClubId: partnerClub.id,
      fromClubName: partnerClub.name,
      toClubId: USER_CLUB_ID,
      toClubName: state.userClub.name,
      round: season.currentRound,
      competition: transferComp,
      type: 'trade',
      counterpartyClub: partnerClub.name,
      windowLabel,
    };
    const otherLeaguePrior =
      updatedPartnerOtherStats?.[incomingPlayer.id] ??
      updatedPartnerOtherStats?.[`user::${incomingPlayer.id}`] ??
      null;
    if (updatedPartnerOtherStats) {
      delete updatedPartnerOtherStats[incomingPlayer.id];
      delete updatedPartnerOtherStats[`user::${incomingPlayer.id}`];
    }
    // Scrub from any other background league stats maps as well so cross-league stats are never double-merged
    for (const lid of Object.keys(nextOtherLeagues) as LeagueId[]) {
      const ol = nextOtherLeagues[lid];
      if (!ol?.playerStats) continue;
      if (
        ol.playerStats[incomingPlayer.id] ||
        ol.playerStats[`user::${incomingPlayer.id}`]
      ) {
        const cleanedOlStats = { ...ol.playerStats };
        delete cleanedOlStats[incomingPlayer.id];
        delete cleanedOlStats[`user::${incomingPlayer.id}`];
        nextOtherLeagues[lid] = {
          ...ol,
          playerStats: cleanedOlStats,
        };
      }
    }
    nextStats = applyRecordToStats(
      nextStats,
      incomingPlayer,
      userClubMeta,
      true,
      rec,
      otherLeaguePrior,
    );
    nextCupStats = applyRecordToStats(
      nextCupStats,
      incomingPlayer,
      userClubMeta,
      true,
      rec,
    );
    if (season.ucl) {
      nextUclStats = applyRecordToStats(
        nextUclStats,
        incomingPlayer,
        userClubMeta,
        true,
        rec,
      );
    }
  }

  for (const sentPlayer of userSentPlayers) {
    const rec: PlayerTransferRecord = {
      fromClubId: USER_CLUB_ID,
      fromClubName: state.userClub.name,
      toClubId: partnerClub.id,
      toClubName: partnerClub.name,
      round: season.currentRound,
      competition: transferComp,
      type: 'trade',
      counterpartyClub: partnerClub.name,
      windowLabel,
    };
    const userPriorStats =
      nextStats[sentPlayer.id] ?? nextStats[`user::${sentPlayer.id}`] ?? null;
    if (updatedPartnerOtherStats && partnerLeagueId !== season.leagueId) {
      updatedPartnerOtherStats = applyRecordToStats(
        updatedPartnerOtherStats,
        sentPlayer,
        partnerClubMeta,
        false,
        rec,
        userPriorStats,
      );
      // Remove from user league stats map since prior stats were migrated to partner's league map
      delete nextStats[sentPlayer.id];
      delete nextStats[`user::${sentPlayer.id}`];
    } else {
      nextStats = applyRecordToStats(
        nextStats,
        sentPlayer,
        partnerClubMeta,
        false,
        rec,
      );
    }
    nextCupStats = applyRecordToStats(
      nextCupStats,
      sentPlayer,
      partnerClubMeta,
      false,
      rec,
    );
    if (season.ucl) {
      nextUclStats = applyRecordToStats(
        nextUclStats,
        sentPlayer,
        partnerClubMeta,
        false,
        rec,
      );
    }
  }

  if (
    updatedPartnerOtherStats &&
    nextOtherLeagues &&
    partnerLeagueId !== season.leagueId &&
    nextOtherLeagues[partnerLeagueId]
  ) {
    nextOtherLeagues[partnerLeagueId] = {
      ...nextOtherLeagues[partnerLeagueId]!,
      playerStats: updatedPartnerOtherStats,
    };
  }

  // 5) Sync UCL rosters & user UCL ratings if UCL is active
  let nextUcl = season.ucl;
  if (nextUcl) {
    const nextUclAiRosters: Record<string, Player[]> = {};
    let uclPrevPartner: Player[] | null = null;
    let uclNextPartner: Player[] | null = null;
    for (const [cid, roster] of Object.entries(nextUcl.aiRosters)) {
      if (cid === USER_CLUB_ID) continue;
      let cleaned = roster.filter(
        (p) => !incomingIds.has(p.id) && !sentIds.has(p.id),
      );
      if (cid === partnerClub.id) {
        uclPrevPartner = roster;
        cleaned = reoptimizeAiClubRoster({
          roster: [...cleaned, ...allSentForPartner],
          formation: partnerClub.formation,
        });
        uclNextPartner = cleaned;
      }
      nextUclAiRosters[cid] = cleaned;
    }
    nextUclAiRosters[USER_CLUB_ID] = nextFilledStarters.slice(0, 11);

    const { ratings: ratingsAfter } = computeUserChemAndRatings({
      formation: state.formation,
      starters: nextFilledStarters,
      tactic: season.defaultTactic,
      managerTraitId: state.manager.traitId,
      season,
    });
    nextUcl = {
      ...nextUcl,
      aiRosters: nextUclAiRosters,
      clubs: nextUcl.clubs.map((c) => {
        if (c.id === USER_CLUB_ID) {
          return {
            ...c,
            formation: state.formation,
            defaultTactic: season.defaultTactic,
            att: ratingsAfter.att,
            mid: ratingsAfter.mid,
            def: ratingsAfter.def,
          };
        }
        if (c.id === partnerClub.id && uclPrevPartner && uclNextPartner) {
          return adjustAiClubRatingsForRosterChange(c, uclPrevPartner, uclNextPartner);
        }
        return c;
      }),
    };
  }

  // 6) Prune injuryAutoReturns for any traded-out players so ghosts never return
  const nextInjuryAutoReturns = (season.injuryAutoReturns ?? []).filter(
    (entry) =>
      !sentIds.has(entry.injuredPlayerId) &&
      !(entry.replacementPlayerId && sentIds.has(entry.replacementPlayerId)),
  );

  // 6b) Update Story Mode transferPoolClubs & UCL R16 prepared rosters first so rolledClubs reflects live foreign era rosters
  let nextStoryMode = state.storyMode;
  if (state.storyMode) {
    const incomingIdSet = new Set(allIncomingRaw.map((p) => p.id));
    const updatedTransferPool = state.storyMode.transferPoolClubs.map((entry) => {
      if (entry.club.id !== partnerClub.id) return entry;
      const updatedRoster = [
        ...entry.roster.filter((p) => !incomingIdSet.has(p.id)),
        ...userSentPlayers.map((p) => ({
          ...p,
          club: entry.club.name,
          leagueId: entry.leagueId,
        })),
      ];
      const optimized = reoptimizeAiClubRoster({
        roster: updatedRoster,
        formation: entry.club.formation,
        managerTraitId: entry.club.manager?.traitId ?? null,
      });
      const updatedClub = adjustAiClubRatingsForRosterChange(
        entry.club,
        entry.roster,
        optimized,
      );
      return {
        ...entry,
        club: updatedClub,
        roster: optimized,
      };
    });

    let updatedUclR16 = state.storyMode.uclR16Prepared;
    if (updatedUclR16) {
      const updatedUclAiRosters = { ...updatedUclR16.aiRosters };
      const partnerEntry = updatedTransferPool.find(
        (c) => c.club.id === partnerClub.id,
      );
      if (partnerEntry && updatedUclAiRosters[partnerClub.id]) {
        updatedUclAiRosters[partnerClub.id] = partnerEntry.roster;
      }
      // Also strip any newly signed user players from all other UCL R16 rosters
      for (const [cid, list] of Object.entries(updatedUclAiRosters)) {
        if (cid === partnerClub.id) continue;
        if (list.some((p) => incomingIdSet.has(p.id))) {
          updatedUclAiRosters[cid] = list.filter((p) => !incomingIdSet.has(p.id));
        }
      }
      updatedUclR16 = {
        ...updatedUclR16,
        clubs: updatedUclR16.clubs.map((c) => {
          const matched = updatedTransferPool.find((t) => t.club.id === c.id);
          return matched ? matched.club : c;
        }),
        aiRosters: updatedUclAiRosters,
      };
    }

    nextStoryMode = {
      ...state.storyMode,
      signingsThisWindow: state.storyMode.signingsThisWindow + 1,
      transferPoolClubs: updatedTransferPool,
      uclR16Prepared: updatedUclR16,
    };
  }

  // 7) Update rolledClubs squads (rebuild partner club's 16-man squad so new arrivals & bench promotions reflect immediately)
  const postTradeOwnedIds = new Set<string>([
    ...nextStarters.filter((p): p is Player => p !== null).map((p) => p.id),
    ...nextBench.filter((p): p is Player => p !== null).map((p) => p.id),
  ]);
  const postTradeExcludeIds = new Set<string>([
    ...postTradeOwnedIds,
    ...nextDepartedPlayerIds,
  ]);

  const nextRolledClubs = tm.rolledClubs.map((offer) => {
    if (offer.isLegendSlot || !offer.club || offer.leagueId === 'LEGEND') {
      return offer;
    }
    if (offer.club.id === partnerClub.id) {
      const storyPoolRoster = nextStoryMode?.transferPoolClubs.find(
        (c) => c.club.id === partnerClub.id,
      )?.roster;
      const updatedLiveRoster =
        partnerLeagueId === season.leagueId
          ? nextAiRosters[partnerClub.id] ?? storyPoolRoster
          : storyPoolRoster ??
            nextOtherLeagues?.[partnerLeagueId]?.aiRosters?.[partnerClub.id];
      const rebuiltSquad = buildTransferClubSquad({
        club: offer.club,
        leagueId: offer.leagueId,
        ownedIds: postTradeOwnedIds,
        excludeIds: postTradeExcludeIds,
        aiRoster: updatedLiveRoster,
        clubRank: offer.clubRank,
        leagueSize: offer.leagueSize,
        currentRound: season.currentRound,
        totalRounds: season.totalRounds,
        windowIndex: tm.windowIndex,
        userRank: getUserRank(season.standings, USER_CLUB_ID),
        userLeagueSize: season.standings.length || 20,
        allPlayerStats: nextStats,
        isUserLeague: offer.leagueId === season.leagueId,
        championBonusActive: Boolean(tm.championBonusActive),
        strictRosterOnly: Boolean(state.storyMode),
      });
      return {
        ...offer,
        squad: rebuiltSquad,
        clubNeeds: analyzeClubPositionNeeds(rebuiltSquad.map((s) => s.player)),
      };
    }
    const filteredSquad = offer.squad.filter((t) => !incomingIds.has(t.player.id));
    return { ...offer, squad: filteredSquad };
  });

  // 8) Update incomingOffers status (mark accepted & invalidate conflicting pending offers)
  const nextIncomingOffers = (tm.incomingOffers ?? []).map((off) => {
    if (acceptedIncomingOfferId && off.id === acceptedIncomingOfferId) {
      return { ...off, status: 'accepted' as const };
    }
    if (off.status !== 'pending') return off;
    const conflictsUser = off.userRequestedPlayers.some((p) => sentIds.has(p.id));
    const conflictsAi = off.aiOffersPlayers.some((p) => incomingIds.has(p.id));
    if (conflictsUser || conflictsAi) {
      return { ...off, status: 'rejected' as const };
    }
    return off;
  });

  const safeCashOfferM =
    !isIncomingOffer && cashOfferM > 0 && season.budgetState
      ? Math.min(Math.round(cashOfferM), season.budgetState.transferCashM)
      : 0;
  const nextBudgetState =
    safeCashOfferM > 0 && season.budgetState
      ? deductTransferCash(season.budgetState, safeCashOfferM)
      : season.budgetState;

  const sentNames = userSentPlayers.map((p) => p.name).join(' + ');
  const recNames = allIncomingRaw.map((p) => p.name).join(' + ');
  const cashTag = safeCashOfferM > 0 ? ` + €${safeCashOfferM}M` : '';

  const nextTradeHistory = [
    ...(tm.tradeHistory ?? []),
    {
      windowIndex: tm.windowIndex,
      round: season.currentRound,
      partnerClubName: partnerClub.name,
      sentPlayers: userSentPlayers,
      receivedPlayers: allIncomingRaw,
      ...(safeCashOfferM > 0 ? { cashOfferM: safeCashOfferM } : {}),
      acceptanceChance,
      isIncomingOffer,
    },
  ];

  // Keep legacy transfer history populated with the headline pair for season summary compatibility
  const nextHistory = [
    ...tm.history,
    {
      windowIndex: tm.windowIndex,
      round: season.currentRound,
      outPlayer: userSentPlayers[0],
      inPlayer: aiTargetPlayers[0],
      marketValueM: Math.round(aiTargetPlayers[0].ovr),
      successChance: acceptanceChance,
    },
  ];

  const prevTrackers =
    season.achievementTrackers ?? createInitialTrackers();
  const nextTrackers: SeasonAchievementTrackers = {
    ...prevTrackers,
    signedUnder20PctSuccess:
      prevTrackers.signedUnder20PctSuccess ||
      (!isIncomingOffer && acceptanceChance > 0 && acceptanceChance <= 20),
  };

  const effectiveNextAttempts = nextAttempts;

  return {
    ...state,
    ...(nextStoryMode ? { storyMode: nextStoryMode } : {}),
    starters: nextStarters,
    bench: nextBench,
    season: {
      ...season,
      clubs: nextClubs,
      ...(nextBudgetState ? { budgetState: nextBudgetState } : {}),
      aiRosters: nextAiRosters,
      otherLeagues: nextOtherLeagues,
      departedPlayerIds: nextDepartedPlayerIds,
      allPlayerStats: nextStats,
      cupPlayerStats: nextCupStats,
      ucl: nextUcl,
      uclPlayerStats: nextUclStats,
      injuryAutoReturns: nextInjuryAutoReturns,
      achievementTrackers: nextTrackers,
      transferMarket: {
        ...tm,
        attemptsRemaining: effectiveNextAttempts,
        attemptedPlayerIds: [
          ...tm.attemptedPlayerIds,
          ...aiTargetPlayers.map((p) => p.id),
        ],
        signedPlayerIds: [
          ...tm.signedPlayerIds,
          ...allIncomingRaw.map((p) => p.id),
        ],
        rolledClubs: nextRolledClubs,
        incomingOffers: nextIncomingOffers,
        history: nextHistory,
        tradeHistory: nextTradeHistory,
        lastOfferResult: {
          success: true,
          isTrade: true,
          targetPlayer: aiTargetPlayers[0],
          outPlayer: userSentPlayers[0],
          sentPlayers: userSentPlayers,
          receivedPlayers: allIncomingRaw,
          probability: acceptanceChance,
          marketValueM: safeCashOfferM,
          gmReaction,
          message: `🔄 트레이드 성사! [${partnerClub.name}] ${recNames} 합류 ↔ ${sentNames}${cashTag} 이적 완료!`,
        },
      },
    },
  };
}

function coreGameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_NEW_CAREER': {
      const fresh = createInitialState();
      const preservedClub = normalizeClubProfile(state.userClub);
      const preservedName = state.manager.name.trim() || DEFAULT_MANAGER_NAME;
      const preservedAvatar = normalizeManagerAvatar(state.manager.avatar);
      return {
        ...fresh,
        phase: 'setup',
        userClub: preservedClub,
        manager: {
          ...fresh.manager,
          name: preservedName,
          avatar: preservedAvatar,
        },
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
      const fresh = createInitialState();
      const preservedClub = normalizeClubProfile(state.userClub);
      const preservedName = state.manager.name.trim() || DEFAULT_MANAGER_NAME;
      const preservedAvatar = normalizeManagerAvatar(state.manager.avatar);
      return {
        ...fresh,
        phase: 'manager_roulette',
        userClub: preservedClub,
        manager: {
          ...fresh.manager,
          name: preservedName,
          avatar: preservedAvatar,
        },
      };
    }

    case 'APPLY_USER_PROFILE': {
      const cleanClub = normalizeClubProfile(action.payload.clubProfile);
      const cleanManagerName =
        action.payload.managerName.trim().slice(0, 14) || DEFAULT_MANAGER_NAME;
      const cleanAvatar = normalizeManagerAvatar(action.payload.managerAvatar);
      saveActiveUserProfile({
        clubProfile: cleanClub,
        managerName: cleanManagerName,
        managerAvatar: cleanAvatar,
      });
      return {
        ...state,
        userClub: cleanClub,
        manager: {
          ...state.manager,
          name: cleanManagerName,
          avatar: cleanAvatar,
        },
      };
    }

    case 'UPDATE_MANAGER_PROFILE': {
      const nextName =
        action.payload.name !== undefined
          ? action.payload.name
          : state.manager.name;
      const nextAvatar = action.payload.avatar
        ? normalizeManagerAvatar({ ...state.manager.avatar, ...action.payload.avatar })
        : state.manager.avatar;
      saveActiveUserProfile({
        clubProfile: state.userClub,
        managerName: nextName,
        managerAvatar: nextAvatar,
      });
      return {
        ...state,
        manager: {
          ...state.manager,
          name: nextName,
          avatar: nextAvatar,
        },
      };
    }

    case 'SELECT_MANAGER_TRAIT': {
      return {
        ...state,
        manager: {
          ...state.manager,
          traitId: action.payload.traitId,
          hasSpun: true,
        },
      };
    }

    case 'SPIN_MANAGER_TRAIT': {
      const pool = MANAGER_TRAIT_LIST.filter(
        (t) => t.id !== state.manager.traitId,
      );
      const chosen = pool[Math.floor(Math.random() * pool.length)];

      return {
        ...state,
        manager: {
          ...state.manager,
          traitId: chosen.id,
          hasSpun: true,
        },
      };
    }

    case 'CONFIRM_MANAGER_TRAIT': {
      if (!state.manager.traitId) return state;
      const trimmedManagerName = state.manager.name.trim() || DEFAULT_MANAGER_NAME;
      const normalizedAvatar = normalizeManagerAvatar(state.manager.avatar);
      const cleanClub = normalizeClubProfile(state.userClub);
      saveActiveUserProfile({
        clubProfile: cleanClub,
        managerName: trimmedManagerName,
        managerAvatar: normalizedAvatar,
      });
      saveClubPreset(cleanClub, {
        name: trimmedManagerName,
        avatar: normalizedAvatar,
      });
      return {
        ...state,
        userClub: cleanClub,
        manager: {
          ...state.manager,
          name: trimmedManagerName,
          avatar: normalizedAvatar,
        },
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
      const nextClub: UserClubProfile = {
        ...state.userClub,
        ...action.payload,
      };
      saveActiveUserProfile({
        clubProfile: nextClub,
        managerName: state.manager.name,
        managerAvatar: state.manager.avatar,
      });
      return {
        ...state,
        userClub: nextClub,
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
      // Anti-exploit: never allow formation switch to reset an already-spun draft roulette
      if (state.phase === 'draft' && !state.draft.completed && state.draft.hasSpun) {
        return state;
      }

      const remappedStarters = remapStartersForFormation(
        state.starters,
        state.formation,
        nextFormation,
        state.manager.traitId,
      );

      // Re-sync draft active slot if switching formation mid-draft (only before spinning)
      let nextDraft = state.draft;
      if (state.phase === 'draft' && !state.draft.completed && !state.draft.hasSpun) {
        const nextEmpty = findNextEmptyDraftSlot(remappedStarters, state.bench);
        if (nextEmpty) {
          nextDraft = {
            ...state.draft,
            currentSlotType: nextEmpty.currentSlotType,
            currentSlotIndex: nextEmpty.currentSlotIndex,
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
      // Story Mode removes Quick Lineup entirely so tactical selection is 100% player skill
      if (state.storyMode) {
        return state;
      }
      // Anti-exploit: never allow quick lineup optimize to reset an already-spun draft roulette
      if (state.phase === 'draft' && !state.draft.completed && state.draft.hasSpun) {
        return state;
      }
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
      if (state.phase === 'draft' && !state.draft.completed && !state.draft.hasSpun) {
        const nextEmpty = findNextEmptyDraftSlot(optStarters, optBench);
        if (nextEmpty) {
          nextDraft = {
            ...state.draft,
            currentSlotType: nextEmpty.currentSlotType,
            currentSlotIndex: nextEmpty.currentSlotIndex,
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
      if (
        state.phase !== 'draft' ||
        state.draft.completed ||
        !state.draft.hasSpun ||
        state.draft.reels.length === 0
      ) {
        return state;
      }
      const requested = action.payload.player;
      const canonicalCandidate = state.draft.reels
        .flatMap((r) => r.candidates)
        .find((c) => c.id === requested.id);
      if (!canonicalCandidate) return state;

      const ownedIds = getAllSquadIds(state.starters, state.bench);
      if (ownedIds.has(canonicalCandidate.id)) return state;

      const nextStarters = [...state.starters];
      const nextBench = [...state.bench];

      if (state.draft.currentSlotType === 'starter') {
        nextStarters[state.draft.currentSlotIndex] = canonicalCandidate;
      } else {
        nextBench[state.draft.currentSlotIndex] = canonicalCandidate;
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

      // Anti-exploit: once roulette is spun in draft, block swapping into the active empty slot
      // so users cannot force-reset draft.hasSpun / draft.reels for infinite re-rolls!
      if (state.phase === 'draft' && !state.draft.completed && state.draft.hasSpun) {
        const isActiveSlot = (loc: { area: 'starter' | 'bench'; index: number }) =>
          loc.area === state.draft.currentSlotType &&
          loc.index === state.draft.currentSlotIndex;
        if (isActiveSlot(from) || isActiveSlot(to)) {
          return state;
        }
      }

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

      // Re-sync next empty draft slot ONLY before roulette has been spun (never clear spun reels)
      let nextDraft = state.draft;
      if (state.phase === 'draft' && !state.draft.completed && !state.draft.hasSpun) {
        const nextEmpty = findNextEmptyDraftSlot(nextStarters, nextBench);
        if (nextEmpty) {
          nextDraft = {
            ...state.draft,
            currentSlotType: nextEmpty.currentSlotType,
            currentSlotIndex: nextEmpty.currentSlotIndex,
          };
        }
      }

      // Track locker-room sub count & sub record if a starter <-> bench swap occurred during halftime or extra time breaks
      const isBenchSub = from.area !== to.area;
      let nextSeason = state.season;
      const livePhase = state.season?.liveHalftime?.phase;
      if (
        state.season &&
        state.season.liveHalftime &&
        (livePhase === 'halftime' ||
          livePhase === 'extra_time_break' ||
          livePhase === 'extra_time_ht') &&
        isBenchSub
      ) {
        const maxSubs =
          livePhase === 'halftime' ? MAX_MATCH_SUBS : MAX_MATCH_SUBS + 1;
        if (state.season.liveHalftime.halftimeSubsMade >= maxSubs) {
          return state;
        }
        const starterIdx = from.area === 'starter' ? from.index : to.index;
        const benchIdx = from.area === 'bench' ? from.index : to.index;
        const outP = state.starters[starterIdx];
        const inP = state.bench[benchIdx];
        const prevSubs = state.season.liveHalftime.liveSubs ?? [];
        const subMinute =
          livePhase === 'halftime'
            ? 45
            : livePhase === 'extra_time_break'
              ? 90
              : 105;
        const addedSub: LiveSubRecord[] =
          outP && inP
            ? [
                {
                  minute: subMinute,
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

      const budgetState = createSeasonBudgetState([
        ...filledStarters,
        ...filledBench,
      ]);

      const chem = calculateChemistry(
        state.formation,
        filledStarters,
        state.defaultTactic,
        state.manager.traitId,
        undefined,
        { ffpChemPenalty: budgetState.chemPenalty },
      );
      const ratings = calculateTeamRatings(
        state.formation,
        filledStarters,
        chem.total,
        state.manager.traitId,
        chem.slotSynergies,
        state.defaultTactic,
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

      const userSquadIds = new Set<string>([
        ...filledStarters.map((p) => p.id),
        ...filledBench.map((p) => p.id),
      ]);

      const aiRosters: Record<string, Player[]> = {};
      for (const c of clubs) {
        if (c.id !== USER_CLUB_ID) {
          aiRosters[c.id] = buildAiClubRoster(c, league.id, userSquadIds);
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
        runId: generateSeasonRunId(),
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
        otherLeagues: createOtherLeaguesState(league.id, userSquadIds),
        lastUserMatch: null,
        liveHalftime: null,
        userMatchHistory: [],
        allPlayerStats,
        transferMarket: createClosedTransferState(),
        awards: null,
        globalAwards: null,
        cup,
        cupPlayerStats,
        userCupMatchHistory: [],
        ucl: null,
        uclPlayerStats: {},
        userUclMatchHistory: [],
        achievementTrackers: createInitialTrackers(),
        seasonScore: null,
        legacyArchived: false,
        departedPlayerIds: [],
        playerConditions: {},
        managerEvents: createDefaultManagerEventsState(),
        pendingInjuryAlerts: [],
        budgetState,
        pendingFfpOpeningNotice: budgetState.ffpTier >= 1,
        tacticalAdaptation: createInitialTacticalAdaptationState(),
        staffCoach: createInitialStaffCoachState(),
        awakenedPlayers: {},
        pendingAwakeningAlerts: [],
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
      const filledBench = state.bench.filter((p): p is Player => p !== null);
      const activeTactic =
        state.season.nextMatchTactic ?? state.season.defaultTactic;
      const condMap = state.season.playerConditions;
      const teamMorale = state.season.managerEvents?.teamMorale ?? 0;
      const effectiveUserStarters = applyConditionToPlayers(
        filledStarters,
        condMap,
        teamMorale,
      );
      const { chem, ratings, staffCoachId } = computeUserChemAndRatings({
        formation: state.formation,
        starters: effectiveUserStarters,
        tactic: activeTactic,
        managerTraitId: state.manager.traitId,
        season: state.season,
      });

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

      const { ownedIds: liveOwnedIds, excludeIds: liveExcludeIds } =
        buildUserExclusionSets(
          filledStarters,
          filledBench,
          state.season.departedPlayerIds,
        );
      const homeRoster =
        userFixture.homeTeamId === USER_CLUB_ID
          ? effectiveUserStarters
          : prepareAiClubLineupForMatch({
              club: homeClub,
              baseRoster: activeAiRosters[userFixture.homeTeamId] ?? [],
              conditionMap: condMap,
              excludeIds: liveExcludeIds,
              ownedIds: liveOwnedIds,
            }).effectiveStarters;
      const awayRoster =
        userFixture.awayTeamId === USER_CLUB_ID
          ? effectiveUserStarters
          : prepareAiClubLineupForMatch({
              club: awayClub,
              baseRoster: activeAiRosters[userFixture.awayTeamId] ?? [],
              conditionMap: condMap,
              excludeIds: liveExcludeIds,
              ownedIds: liveOwnedIds,
            }).effectiveStarters;

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
          starters: effectiveUserStarters,
          formation: state.formation,
          tactic: activeTactic,
          chemistry: chem.total,
          ratings,
          slotSynergies: chem.slotSynergies,
          managerTraitId: state.manager.traitId,
          staffCoachId,
          tacticalHistory: state.season.tacticalAdaptation?.history,
          competition,
          opponentRank: oppIdx === -1 ? undefined : oppIdx + 1,
          isBigKnockout:
            (competition === 'cup' && /(준결승|결승)/.test(competitionLabel)) ||
            (competition === 'ucl' && /(16강|8강|4강|준결승|결승|플레이오프)/.test(competitionLabel)),
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

      const { chem, ratings, staffCoachId } = computeUserChemAndRatings({
        formation: state.formation,
        starters: filledStarters,
        tactic: secondHalfTactic,
        managerTraitId: state.manager.traitId,
        season,
      });

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
      const { ownedIds: shOwnedIds, excludeIds: shExcludeIds } =
        buildUserExclusionSets(
          filledStarters,
          filledBench,
          season.departedPlayerIds,
        );
      const oppFullRoster = buildSafeOpponentLiveRoster({
        club: clubsById[oppId],
        baseRoster: activeAiRosters[oppId] ?? [],
        conditionMap: season.playerConditions,
        ownedIds: shOwnedIds,
        excludeIds: shExcludeIds,
        includeBench: true,
      });

      const userMatchResult = simulateSecondHalf({
        halftime,
        homeClub: clubsById[halftime.homeTeamId],
        awayClub: clubsById[halftime.awayTeamId],
        homeRoster: halftime.isUserHome ? filledStarters : oppFullRoster,
        awayRoster: halftime.isUserHome ? oppFullRoster : filledStarters,
        userContext: {
          userClubId: USER_CLUB_ID,
          starters: filledStarters,
          bench: filledBench,
          formation: state.formation,
          tactic: secondHalfTactic,
          chemistry: chem.total,
          ratings,
          slotSynergies: chem.slotSynergies,
          managerTraitId: state.manager.traitId,
          staffCoachId,
          tacticalHistory: season.tacticalAdaptation?.history,
          competition: halftime.competition,
          opponentRank: oppIdx === -1 ? undefined : oppIdx + 1,
          isBigKnockout:
            (halftime.competition === 'cup' && /(준결승|결승)/.test(halftime.competitionLabel ?? '')) ||
            (halftime.competition === 'ucl' && /(16강|8강|4강|준결승|결승|플레이오프)/.test(halftime.competitionLabel ?? '')),
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
            homeTactic: userMatchResult.homeTactic,
            awayTactic: userMatchResult.awayTactic,
            homeFormation: userMatchResult.homeFormation,
            awayFormation: userMatchResult.awayFormation,
            aiHalftimeAdjustment: userMatchResult.aiHalftimeAdjustment,
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

      const { chem, ratings, staffCoachId } = computeUserChemAndRatings({
        formation: state.formation,
        starters: filledStarters,
        tactic: userTactic,
        managerTraitId: state.manager.traitId,
        season,
      });

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
      const { ownedIds: subOwnedIds, excludeIds: subExcludeIds } =
        buildUserExclusionSets(
          filledStarters,
          filledBench,
          season.departedPlayerIds,
        );
      const safeOppRoster = buildSafeOpponentLiveRoster({
        club: clubsById[oppId],
        baseRoster: activeAiRosters[oppId] ?? [],
        conditionMap: season.playerConditions,
        ownedIds: subOwnedIds,
        excludeIds: subExcludeIds,
      });

      const updatedResult = resimulateRemainingSecondHalf({
        halftime,
        currentResult,
        fromMinute: minute,
        newSubs: newSubRecords,
        allSubsSoFar,
        homeClub: clubsById[halftime.homeTeamId],
        awayClub: clubsById[halftime.awayTeamId],
        homeRoster: halftime.isUserHome ? filledStarters : safeOppRoster,
        awayRoster: halftime.isUserHome ? safeOppRoster : filledStarters,
        userContext: {
          userClubId: USER_CLUB_ID,
          starters: filledStarters,
          bench: filledBench,
          formation: state.formation,
          tactic: userTactic,
          chemistry: chem.total,
          ratings,
          slotSynergies: chem.slotSynergies,
          managerTraitId: state.manager.traitId,
          staffCoachId,
          tacticalHistory: season.tacticalAdaptation?.history,
          competition: halftime.competition,
          opponentRank: oppIdx === -1 ? undefined : oppIdx + 1,
          isBigKnockout:
            (halftime.competition === 'cup' && /(준결승|결승)/.test(halftime.competitionLabel ?? '')) ||
            (halftime.competition === 'ucl' && /(16강|8강|4강|준결승|결승|플레이오프)/.test(halftime.competitionLabel ?? '')),
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
      const extraSubIds: string[] = (halftime.liveSubs ?? [])
        .filter((r) => r.minute >= 90)
        .map((r) => r.inPlayerId);

      // Legacy fallback: allow passing a direct extraSub if caller supplied one
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
      const userTactic =
        action.payload?.etTactic ??
        (halftime.isUserHome ? baseResult.homeTactic : baseResult.awayTactic);

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
        chem.slotSynergies,
        userTactic,
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
      const et1OppId = halftime.isUserHome
        ? halftime.awayTeamId
        : halftime.homeTeamId;
      const { ownedIds: et1OwnedIds, excludeIds: et1ExcludeIds } =
        buildUserExclusionSets(
          filledStarters,
          filledBench,
          season.departedPlayerIds,
        );
      const safeEt1OppRoster = buildSafeOpponentLiveRoster({
        club: clubsById[et1OppId],
        baseRoster: activeAiRosters[et1OppId] ?? [],
        conditionMap: season.playerConditions,
        ownedIds: et1OwnedIds,
        excludeIds: et1ExcludeIds,
      });
      const et1Result = simulateExtraTimeFirstHalf({
        baseResult,
        homeClub: clubsById[halftime.homeTeamId],
        awayClub: clubsById[halftime.awayTeamId],
        homeRoster: halftime.isUserHome ? filledStarters : safeEt1OppRoster,
        awayRoster: halftime.isUserHome ? safeEt1OppRoster : filledStarters,
        userContext: {
          userClubId: USER_CLUB_ID,
          starters: filledStarters,
          bench: filledBench,
          formation: state.formation,
          tactic: userTactic,
          chemistry: chem.total,
          ratings,
          slotSynergies: chem.slotSynergies,
          managerTraitId: state.manager.traitId,
          competition: halftime.competition,
          halftimeSubIds: action.payload?.halftimeSubIds,
          firstHalfStarters: action.payload?.firstHalfStarters,
          liveSubs: allSubsSoFar,
        },
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
            etFirstHalfResult: et1Result,
            fullMatchResult: et1Result,
          },
        },
      };
    }

    case 'ENTER_ET_HALFTIME_LOCKER': {
      const season = state.season;
      const halftime = season?.liveHalftime ?? null;
      if (!season || !halftime || !halftime.fullMatchResult) return state;
      return {
        ...state,
        season: {
          ...season,
          liveHalftime: {
            ...halftime,
            phase: 'extra_time_ht',
          },
        },
      };
    }

    case 'START_ET_SECOND_HALF_BROADCAST': {
      const season = state.season;
      const halftime = season?.liveHalftime ?? null;
      const et1Result =
        halftime?.etFirstHalfResult ?? halftime?.fullMatchResult ?? null;
      if (!season || !halftime || !et1Result) return state;

      const filledStarters = state.starters.filter((p): p is Player => p !== null);
      const filledBench = state.bench.filter((p): p is Player => p !== null);
      const userTactic =
        action.payload?.etTactic ??
        (halftime.isUserHome ? et1Result.homeTactic : et1Result.awayTactic);

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
        chem.slotSynergies,
        userTactic,
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

      const allSubsSoFar = halftime.liveSubs ?? [];
      const extraTimeSubIds = allSubsSoFar
        .filter((r) => r.minute >= 90)
        .map((r) => r.inPlayerId);
      const et2OppId = halftime.isUserHome
        ? halftime.awayTeamId
        : halftime.homeTeamId;
      const { ownedIds: et2OwnedIds, excludeIds: et2ExcludeIds } =
        buildUserExclusionSets(
          filledStarters,
          filledBench,
          season.departedPlayerIds,
        );
      const safeEt2OppRoster = buildSafeOpponentLiveRoster({
        club: clubsById[et2OppId],
        baseRoster: activeAiRosters[et2OppId] ?? [],
        conditionMap: season.playerConditions,
        ownedIds: et2OwnedIds,
        excludeIds: et2ExcludeIds,
      });

      const et2FullResult = simulateExtraTimeSecondHalfAndPenalties({
        et1Result,
        homeClub: clubsById[halftime.homeTeamId],
        awayClub: clubsById[halftime.awayTeamId],
        homeRoster: halftime.isUserHome ? filledStarters : safeEt2OppRoster,
        awayRoster: halftime.isUserHome ? safeEt2OppRoster : filledStarters,
        userContext: {
          userClubId: USER_CLUB_ID,
          starters: filledStarters,
          bench: filledBench,
          formation: state.formation,
          tactic: userTactic,
          chemistry: chem.total,
          ratings,
          slotSynergies: chem.slotSynergies,
          managerTraitId: state.manager.traitId,
          competition: halftime.competition,
          halftimeSubIds: action.payload?.halftimeSubIds,
          firstHalfStarters: action.payload?.firstHalfStarters,
          liveSubs: allSubsSoFar,
        },
        aggHomeBeforeMatch: halftime.aggHomeBeforeMatch,
        aggAwayBeforeMatch: halftime.aggAwayBeforeMatch,
        extraTimeSubIds,
      });

      return {
        ...state,
        season: {
          ...season,
          liveHalftime: {
            ...halftime,
            phase: 'extra_time_2',
            fullMatchResult: et2FullResult,
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

      const commitOppId = halftime.isUserHome
        ? halftime.awayTeamId
        : halftime.homeTeamId;
      const { ownedIds: commitOwnedIds, excludeIds: commitExcludeIds } =
        buildUserExclusionSets(
          filledStarters,
          filledBench,
          season.departedPlayerIds,
        );
      const getSafeCommitOppRoster = (
        clubsMap: Record<string, Club>,
        includeBench = false,
      ) =>
        buildSafeOpponentLiveRoster({
          club: clubsMap[commitOppId],
          baseRoster: activeAiRosters[commitOppId] ?? [],
          conditionMap: season.playerConditions,
          ownedIds: commitOwnedIds,
          excludeIds: commitExcludeIds,
          includeBench,
        });

      if (halftime.fullMatchResult) {
        let finalRes = halftime.fullMatchResult;
        // If user clicked instant finish during ET 1st Half or 105' ET Halftime, complete ET 2nd Half + Penalties!
        if (
          halftime.phase === 'extra_time' ||
          halftime.phase === 'extra_time_ht'
        ) {
          const et1Base = halftime.etFirstHalfResult ?? finalRes;
          const userTactic =
            action.payload?.secondHalfTactic ??
            (halftime.isUserHome ? et1Base.homeTactic : et1Base.awayTactic);
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
            chem.slotSynergies,
            userTactic,
          );
          const clubsById = buildClubsById(ratings);
          const safeOppRoster = getSafeCommitOppRoster(clubsById);
          const allSubsSoFar = halftime.liveSubs ?? [];
          finalRes = simulateExtraTimeSecondHalfAndPenalties({
            et1Result: et1Base,
            homeClub: clubsById[halftime.homeTeamId],
            awayClub: clubsById[halftime.awayTeamId],
            homeRoster: halftime.isUserHome ? filledStarters : safeOppRoster,
            awayRoster: halftime.isUserHome ? safeOppRoster : filledStarters,
            userContext: {
              userClubId: USER_CLUB_ID,
              starters: filledStarters,
              bench: filledBench,
              formation: state.formation,
              tactic: userTactic,
              chemistry: chem.total,
              ratings,
              slotSynergies: chem.slotSynergies,
              managerTraitId: state.manager.traitId,
              competition: halftime.competition,
              liveSubs: allSubsSoFar,
            },
            aggHomeBeforeMatch: halftime.aggHomeBeforeMatch,
            aggAwayBeforeMatch: halftime.aggAwayBeforeMatch,
            extraTimeSubIds: allSubsSoFar
              .filter((r) => r.minute >= 90)
              .map((r) => r.inPlayerId),
          });
        } else if (halftime.isKnockoutDecider && !finalRes.extraTime) {
          // If user clicked instant finish while a knockout decider was drawn at 90', resolve ET/PK cleanly!
          const aggH = (halftime.aggHomeBeforeMatch ?? 0) + finalRes.homeGoals;
          const aggA = (halftime.aggAwayBeforeMatch ?? 0) + finalRes.awayGoals;
          if (aggH === aggA) {
            const userTactic =
              action.payload?.secondHalfTactic ??
              (halftime.isUserHome ? finalRes.homeTactic : finalRes.awayTactic);
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
              chem.slotSynergies,
              userTactic,
            );
            const clubsById = buildClubsById(ratings);
            const safeOppRoster = getSafeCommitOppRoster(clubsById);
            finalRes = simulateExtraTimeAndPenalties({
              baseResult: finalRes,
              homeClub: clubsById[halftime.homeTeamId],
              awayClub: clubsById[halftime.awayTeamId],
              homeRoster: halftime.isUserHome ? filledStarters : safeOppRoster,
              awayRoster: halftime.isUserHome ? safeOppRoster : filledStarters,
              userContext: {
                userClubId: USER_CLUB_ID,
                starters: filledStarters,
                bench: filledBench,
                formation: state.formation,
                tactic: userTactic,
                chemistry: chem.total,
                ratings,
                slotSynergies: chem.slotSynergies,
                managerTraitId: state.manager.traitId,
                competition: halftime.competition,
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
        chem.slotSynergies,
        secondHalfTactic,
      );

      const clubsById = buildClubsById(ratings);
      const oppIdx = activeStandings.findIndex((r) => r.teamId === commitOppId);
      const safeOppWithBench = getSafeCommitOppRoster(clubsById, true);

      let userMatchResult = simulateSecondHalf({
        halftime,
        homeClub: clubsById[halftime.homeTeamId],
        awayClub: clubsById[halftime.awayTeamId],
        homeRoster: halftime.isUserHome ? filledStarters : safeOppWithBench,
        awayRoster: halftime.isUserHome ? safeOppWithBench : filledStarters,
        userContext: {
          userClubId: USER_CLUB_ID,
          starters: filledStarters,
          bench: filledBench,
          formation: state.formation,
          tactic: secondHalfTactic,
          chemistry: chem.total,
          ratings,
          slotSynergies: chem.slotSynergies,
          managerTraitId: state.manager.traitId,
          competition: halftime.competition,
          opponentRank: oppIdx === -1 ? undefined : oppIdx + 1,
          isBigKnockout:
            (halftime.competition === 'cup' && /(준결승|결승)/.test(halftime.competitionLabel ?? '')) ||
            (halftime.competition === 'ucl' && /(16강|8강|4강|준결승|결승|플레이오프)/.test(halftime.competitionLabel ?? '')),
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
          const safeOppEt = getSafeCommitOppRoster(clubsById);
          userMatchResult = simulateExtraTimeAndPenalties({
            baseResult: userMatchResult,
            homeClub: clubsById[halftime.homeTeamId],
            awayClub: clubsById[halftime.awayTeamId],
            homeRoster: halftime.isUserHome ? filledStarters : safeOppEt,
            awayRoster: halftime.isUserHome ? safeOppEt : filledStarters,
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

    case 'START_SOLO_STREAM_MATCH': {
      if ((state.phase !== 'season' && state.phase !== 'ucl') || !state.season) {
        return state;
      }
      if (
        state.season.transferMarket.isOpen ||
        state.season.liveHalftime ||
        Boolean(state.season.staffCoach?.pendingSelection) ||
        (state.season.pendingInjuryAlerts?.length ?? 0) > 0 ||
        (state.season.pendingAwakeningAlerts?.length ?? 0) > 0 ||
        Boolean(state.season.tacticalAdaptation?.pendingAlert) ||
        Boolean(state.season.managerEvents?.activeEvent) ||
        Boolean(state.season.managerEvents?.lastResolution)
      ) {
        return state;
      }

      let next = gameReducer(state, { type: 'START_LIVE_MATCH' });
      const ht1 = next.season?.liveHalftime;
      if (next === state || !ht1) return state;

      const filledStarters = next.starters.filter((p): p is Player => p !== null);
      next = gameReducer(next, {
        type: 'START_SECOND_HALF_BROADCAST',
        payload: {
          secondHalfTactic: ht1.userTacticAtKickoff,
          subPlayerIds: [],
          firstHalfStarters: filledStarters,
        },
      });
      const ht2 = next.season?.liveHalftime;
      const res90 = ht2?.fullMatchResult;
      if (!next.season || !ht2 || !res90) return state;

      // Preserve the 90-minute result before precomputing ET so mid-2nd-half takeover can play fresh ET/subs
      const streamResult90 = res90;
      const aggH = (ht2.aggHomeBeforeMatch ?? 0) + res90.homeGoals;
      const aggA = (ht2.aggAwayBeforeMatch ?? 0) + res90.awayGoals;
      if (ht2.isKnockoutDecider && aggH === aggA) {
        next = gameReducer(next, {
          type: 'START_EXTRA_TIME_BROADCAST',
          payload: {
            etTactic: ht2.userTacticAtKickoff,
            firstHalfStarters: filledStarters,
            halftimeSubIds: [],
          },
        });
        next = gameReducer(next, {
          type: 'START_ET_SECOND_HALF_BROADCAST',
          payload: {
            etTactic: ht2.userTacticAtKickoff,
            firstHalfStarters: filledStarters,
            halftimeSubIds: [],
          },
        });
      }

      if (!next.season?.liveHalftime) return state;
      return {
        ...next,
        season: {
          ...next.season,
          liveHalftime: {
            ...next.season.liveHalftime,
            streamAutoMode: true,
            streamResult90,
          },
        },
      };
    }

    case 'ENTER_LIVE_BROADCAST_FROM_STREAM': {
      const season = state.season;
      const ht = season?.liveHalftime ?? null;
      if (!season || !ht || !ht.streamAutoMode) return state;

      const rawMinute = Math.max(0, Math.floor(action.payload.minute));
      const inPenalties = Boolean(action.payload.inPenalties);
      const hasPenalties = Boolean(ht.fullMatchResult?.extraTime?.penalties);
      const hasExtraTime = Boolean(ht.fullMatchResult?.extraTime);

      if (inPenalties && hasPenalties) {
        return {
          ...state,
          season: {
            ...season,
            liveHalftime: {
              ...ht,
              streamAutoMode: false,
              phase: 'penalties',
              resumeFromMinute: 120,
            },
          },
        };
      }

      if (rawMinute < 45) {
        // Re-entering in 1st half: discard precomputed 2nd half so halftime tactics & subs truly affect the 2nd half!
        return {
          ...state,
          season: {
            ...season,
            liveHalftime: {
              ...ht,
              streamAutoMode: false,
              phase: 'first_half',
              resumeFromMinute: rawMinute,
              fullMatchResult: undefined,
              etFirstHalfResult: undefined,
              streamResult90: undefined,
            },
          },
        };
      }

      if (rawMinute < 90 || !hasExtraTime) {
        const clampedMin = Math.max(46, Math.min(89, rawMinute));
        return {
          ...state,
          season: {
            ...season,
            liveHalftime: {
              ...ht,
              streamAutoMode: false,
              phase: 'second_half',
              resumeFromMinute: clampedMin,
              fullMatchResult: ht.streamResult90 ?? ht.fullMatchResult,
              etFirstHalfResult: undefined,
            },
          },
        };
      }

      if (rawMinute < 105 && ht.etFirstHalfResult) {
        return {
          ...state,
          season: {
            ...season,
            liveHalftime: {
              ...ht,
              streamAutoMode: false,
              phase: 'extra_time',
              resumeFromMinute: Math.max(91, rawMinute),
              fullMatchResult: ht.etFirstHalfResult,
            },
          },
        };
      }

      return {
        ...state,
        season: {
          ...season,
          liveHalftime: {
            ...ht,
            streamAutoMode: false,
            phase: 'extra_time_2',
            resumeFromMinute: Math.max(106, Math.min(119, rawMinute)),
          },
        },
      };
    }

    case 'CANCEL_SOLO_STREAM_MATCH': {
      // Anti-save-scum: once a stream match has kicked off, stopping mid-match settles
      // the in-progress match result instead of wiping liveHalftime for infinite retries.
      if (!state.season?.liveHalftime?.streamAutoMode) return state;
      return gameReducer(state, { type: 'COMMIT_LIVE_MATCH' });
    }

    case 'ABORT_STREAM_AND_START_LIVE_2D': {
      if ((state.phase !== 'season' && state.phase !== 'ucl') || !state.season) {
        return state;
      }
      if (state.season.transferMarket.isOpen) return state;
      const existing = state.season.liveHalftime;
      // Already inside an active 2D broadcast: never double-start
      if (existing && !existing.streamAutoMode) {
        return state;
      }
      // Anti-save-scum: if a stream match is already in progress, transition directly
      // into 2D broadcast preserving its pre-simulated score & events (never re-roll from 0').
      if (existing && existing.streamAutoMode) {
        const resumeMinute = Math.max(
          0,
          Math.floor(action.payload?.minute ?? 46),
        );
        return gameReducer(state, {
          type: 'ENTER_LIVE_BROADCAST_FROM_STREAM',
          payload: {
            minute: resumeMinute,
            inPenalties: Boolean(action.payload?.inPenalties),
          },
        });
      }
      return gameReducer(state, { type: 'START_LIVE_MATCH' });
    }

    case 'SIMULATE_SINGLE_MATCH_INSTANT': {
      if ((state.phase !== 'season' && state.phase !== 'ucl') || !state.season) {
        return state;
      }
      if (
        state.season.transferMarket.isOpen ||
        state.season.liveHalftime ||
        (state.season.pendingInjuryAlerts?.length ?? 0) > 0 ||
        Boolean(state.season.managerEvents?.activeEvent) ||
        Boolean(state.season.managerEvents?.lastResolution)
      ) {
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

        const workingConditions: PlayerConditionMap = {
          ...state.season.playerConditions,
        };
        const teamMorale = state.season.managerEvents?.teamMorale ?? 0;
        const effectiveUserStarters = applyConditionToPlayers(
          filledStarters,
          workingConditions,
          teamMorale,
        );
        const effectiveUserBench = applyConditionToPlayers(
          filledBench,
          workingConditions,
          teamMorale,
        );
        const { ownedIds, excludeIds } = buildUserExclusionSets(
          filledStarters,
          filledBench,
          state.season.departedPlayerIds,
        );

        const { chem, ratings, staffCoachId } = computeUserChemAndRatings({
          formation: state.formation,
          starters: effectiveUserStarters,
          tactic: activeTactic,
          managerTraitId: state.manager.traitId,
          season: state.season,
        });
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
          starters: effectiveUserStarters,
          bench: effectiveUserBench,
          formation: state.formation,
          tactic: activeTactic,
          chemistry: chem.total,
          ratings,
          slotSynergies: chem.slotSynergies,
          managerTraitId: state.manager.traitId,
          staffCoachId,
          tacticalHistory: state.season.tacticalAdaptation?.history,
          competition: 'ucl' as const,
          allowAutoSubs: true,
        };

        const res =
          syncedUcl.stage === 'league_phase'
            ? simulateUclLeaguePhaseRound({
                ucl: syncedUcl,
                uclPlayerStats: state.season.uclPlayerStats,
                userContext: userCtx,
                conditionMap: workingConditions,
                excludeIds,
                ownedIds,
              })
            : advanceUclKnockoutLeg({
                ucl: syncedUcl,
                uclPlayerStats: state.season.uclPlayerStats,
                userContext: userCtx,
                conditionMap: workingConditions,
                excludeIds,
                ownedIds,
              });

        const interimSeason: SeasonState = {
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
          playerConditions: workingConditions,
        };

        const postCond = res.userResult
          ? applyPostUserMatchConditionAndEvents({
              season: interimSeason,
              workingConditions,
              formation: state.formation,
              tactic: activeTactic,
              managerTraitId: state.manager.traitId,
              starters: state.starters,
              bench: state.bench,
              userMatchResult: res.userResult,
              competition: 'ucl',
              round: res.ucl.leaguePhaseRound,
              isShortRest: true,
              teamName: state.userClub.name,
              managerName: state.manager.name,
              allowEventTrigger: true,
            })
          : null;

        return {
          ...state,
          season: {
            ...interimSeason,
            playerConditions: postCond?.playerConditions ?? workingConditions,
            managerEvents: postCond?.managerEvents ?? interimSeason.managerEvents,
            pendingInjuryAlerts:
              postCond?.pendingInjuryAlerts ?? interimSeason.pendingInjuryAlerts,
            tacticalAdaptation:
              postCond?.tacticalAdaptation ?? interimSeason.tacticalAdaptation,
            awakenedPlayers:
              postCond?.awakenedPlayers ?? interimSeason.awakenedPlayers,
            pendingAwakeningAlerts:
              postCond?.pendingAwakeningAlerts ??
              interimSeason.pendingAwakeningAlerts,
            storyCrisisLog:
              postCond?.storyCrisisLog ?? interimSeason.storyCrisisLog,
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
          rawStarters: state.starters,
          rawBench: state.bench,
          teamName: state.userClub.name,
          managerName: state.manager.name,
          allowEventTrigger: true,
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
        {
          rawStarters: state.starters,
          rawBench: state.bench,
          teamName: state.userClub.name,
          managerName: state.manager.name,
          allowEventTrigger: true,
        },
      );

      nextSeason = syncCupAfterRound({
        season: nextSeason,
        formation: state.formation,
        tactic: nextSeason.defaultTactic,
        managerTraitId: state.manager.traitId,
        starters: filledStarters,
        bench: filledBench,
        autoResolveUserMatches: false,
        rawStarters: state.starters,
        rawBench: state.bench,
        teamName: state.userClub.name,
        managerName: state.manager.name,
        allowEventTrigger: false,
      });

      const trigger = checkTransferWindowTrigger(
        nextSeason.currentRound,
        nextSeason.transferWindows,
        nextSeason.transferMarket.completedWindows,
      );

      if (trigger) {
        nextSeason = openTransferAndMidSeasonCoach({
          season: nextSeason,
          starters: state.starters,
          bench: state.bench,
          windowIndex: trigger.windowIndex,
          triggerRound: trigger.triggerRound,
          userRank: getUserRank(nextSeason.standings, USER_CLUB_ID),
          allowedLeagueIds: state.draftLeaguePool,
          storyMode: state.storyMode,
        });
      }

      return finalizeSeasonIfEnded({
        ...state,
        season: nextSeason,
      });
    }

    case 'SIMULATE_ONE_FAST_ROUND': {
      if (state.phase !== 'season' || !state.season) return state;
      if (
        state.season.transferMarket.isOpen ||
        state.season.liveHalftime ||
        Boolean(state.season.staffCoach?.pendingSelection) ||
        (state.season.pendingInjuryAlerts?.length ?? 0) > 0 ||
        (state.season.pendingAwakeningAlerts?.length ?? 0) > 0 ||
        Boolean(state.season.tacticalAdaptation?.pendingAlert) ||
        Boolean(state.season.managerEvents?.activeEvent) ||
        Boolean(state.season.managerEvents?.lastResolution)
      ) {
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
          rawStarters: state.starters,
          rawBench: state.bench,
          teamName: state.userClub.name,
          managerName: state.manager.name,
          allowEventTrigger: false,
        });
      }

      let nextSeason = simulateFullSingleRound(
        workingSeason,
        state.formation,
        workingSeason.defaultTactic,
        state.manager.traitId,
        filledStarters,
        filledBench,
        {
          rawStarters: state.starters,
          rawBench: state.bench,
          teamName: state.userClub.name,
          managerName: state.manager.name,
          allowEventTrigger: false,
        },
      );

      nextSeason = syncCupAfterRound({
        season: nextSeason,
        formation: state.formation,
        tactic: nextSeason.defaultTactic,
        managerTraitId: state.manager.traitId,
        starters: filledStarters,
        bench: filledBench,
        autoResolveUserMatches: !stopAtCup,
        rawStarters: state.starters,
        rawBench: state.bench,
        teamName: state.userClub.name,
        managerName: state.manager.name,
        allowEventTrigger: false,
      });

      const trigger = checkTransferWindowTrigger(
        nextSeason.currentRound,
        nextSeason.transferWindows,
        nextSeason.transferMarket.completedWindows,
      );

      if (trigger) {
        if (action.payload.stopAtTransfer) {
          nextSeason = openTransferAndMidSeasonCoach({
            season: nextSeason,
            starters: state.starters,
            bench: state.bench,
            windowIndex: trigger.windowIndex,
            triggerRound: trigger.triggerRound,
            userRank: getUserRank(nextSeason.standings, USER_CLUB_ID),
            allowedLeagueIds: state.draftLeaguePool,
            storyMode: state.storyMode,
          });
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
              nextSeason.transferMarket.tradeHistory ?? [],
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
      if (
        state.season.transferMarket.isOpen ||
        state.season.liveHalftime ||
        Boolean(state.season.staffCoach?.pendingSelection) ||
        (state.season.pendingAwakeningAlerts?.length ?? 0) > 0 ||
        Boolean(state.season.managerEvents?.activeEvent) ||
        Boolean(state.season.managerEvents?.lastResolution)
      ) {
        return state;
      }

      let workingStartersSlots = state.starters;
      let workingBenchSlots = state.bench;
      let currentSeason = state.season;

      if (currentSeason.cup?.pendingStage) {
        currentSeason = syncCupAfterRound({
          season: currentSeason,
          formation: state.formation,
          tactic: currentSeason.defaultTactic,
          managerTraitId: state.manager.traitId,
          starters: workingStartersSlots.filter((p): p is Player => p !== null),
          bench: workingBenchSlots.filter((p): p is Player => p !== null),
          autoResolveUserMatches: true,
        });
        workingStartersSlots = applyAwakenedPlayersToSlots(
          workingStartersSlots,
          currentSeason.awakenedPlayers,
        );
        workingBenchSlots = applyAwakenedPlayersToSlots(
          workingBenchSlots,
          currentSeason.awakenedPlayers,
        );
        if ((currentSeason.pendingAwakeningAlerts?.length ?? 0) > 0) {
          return finalizeSeasonIfEnded({
            ...state,
            starters: workingStartersSlots,
            bench: workingBenchSlots,
            season: currentSeason,
          });
        }
      }

      while (currentSeason.currentRound < currentSeason.totalRounds) {
        const loopStarters = workingStartersSlots.filter(
          (p): p is Player => p !== null,
        );
        const loopBench = workingBenchSlots.filter(
          (p): p is Player => p !== null,
        );
        currentSeason = simulateFullSingleRound(
          currentSeason,
          state.formation,
          currentSeason.defaultTactic,
          state.manager.traitId,
          loopStarters,
          loopBench,
        );
        workingStartersSlots = applyAwakenedPlayersToSlots(
          workingStartersSlots,
          currentSeason.awakenedPlayers,
        );
        workingBenchSlots = applyAwakenedPlayersToSlots(
          workingBenchSlots,
          currentSeason.awakenedPlayers,
        );

        currentSeason = syncCupAfterRound({
          season: currentSeason,
          formation: state.formation,
          tactic: currentSeason.defaultTactic,
          managerTraitId: state.manager.traitId,
          starters: workingStartersSlots.filter((p): p is Player => p !== null),
          bench: workingBenchSlots.filter((p): p is Player => p !== null),
          autoResolveUserMatches: true,
        });
        workingStartersSlots = applyAwakenedPlayersToSlots(
          workingStartersSlots,
          currentSeason.awakenedPlayers,
        );
        workingBenchSlots = applyAwakenedPlayersToSlots(
          workingBenchSlots,
          currentSeason.awakenedPlayers,
        );

        const trigger = checkTransferWindowTrigger(
          currentSeason.currentRound,
          currentSeason.transferWindows,
          currentSeason.transferMarket.completedWindows,
        );

        if (trigger) {
          currentSeason = openTransferAndMidSeasonCoach({
            season: currentSeason,
            starters: workingStartersSlots,
            bench: workingBenchSlots,
            windowIndex: trigger.windowIndex,
            triggerRound: trigger.triggerRound,
            userRank: getUserRank(currentSeason.standings, USER_CLUB_ID),
            allowedLeagueIds: state.draftLeaguePool,
            storyMode: state.storyMode,
          });
          break;
        }

        if ((currentSeason.pendingAwakeningAlerts?.length ?? 0) > 0) {
          break;
        }
      }

      return finalizeSeasonIfEnded({
        ...state,
        starters: workingStartersSlots,
        bench: workingBenchSlots,
        season: currentSeason,
      });
    }

    case 'SKIP_TO_SEASON_END': {
      if (state.phase !== 'season' || !state.season) return state;
      if (
        Boolean(state.season.managerEvents?.activeEvent) ||
        Boolean(state.season.managerEvents?.lastResolution)
      ) {
        return state;
      }

      let workingStartersSlots = state.starters;
      let workingBenchSlots = state.bench;
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
          starters: workingStartersSlots.filter((p): p is Player => p !== null),
          bench: workingBenchSlots.filter((p): p is Player => p !== null),
          autoResolveUserMatches: true,
        });
        workingStartersSlots = applyAwakenedPlayersToSlots(
          workingStartersSlots,
          currentSeason.awakenedPlayers,
        );
        workingBenchSlots = applyAwakenedPlayersToSlots(
          workingBenchSlots,
          currentSeason.awakenedPlayers,
        );
      }

      while (currentSeason.currentRound < currentSeason.totalRounds) {
        currentSeason = simulateFullSingleRound(
          currentSeason,
          state.formation,
          currentSeason.defaultTactic,
          state.manager.traitId,
          workingStartersSlots.filter((p): p is Player => p !== null),
          workingBenchSlots.filter((p): p is Player => p !== null),
        );
        workingStartersSlots = applyAwakenedPlayersToSlots(
          workingStartersSlots,
          currentSeason.awakenedPlayers,
        );
        workingBenchSlots = applyAwakenedPlayersToSlots(
          workingBenchSlots,
          currentSeason.awakenedPlayers,
        );
        currentSeason = syncCupAfterRound({
          season: currentSeason,
          formation: state.formation,
          tactic: currentSeason.defaultTactic,
          managerTraitId: state.manager.traitId,
          starters: workingStartersSlots.filter((p): p is Player => p !== null),
          bench: workingBenchSlots.filter((p): p is Player => p !== null),
          autoResolveUserMatches: true,
        });
        workingStartersSlots = applyAwakenedPlayersToSlots(
          workingStartersSlots,
          currentSeason.awakenedPlayers,
        );
        workingBenchSlots = applyAwakenedPlayersToSlots(
          workingBenchSlots,
          currentSeason.awakenedPlayers,
        );
      }

      return finalizeSeasonIfEnded({
        ...state,
        starters: workingStartersSlots,
        bench: workingBenchSlots,
        season: currentSeason,
      });
    }

    case 'TRANSFER_SPIN_CLUBS': {
      if (!state.season || !state.season.transferMarket.isOpen) return state;
      const tm = state.season.transferMarket;
      if (tm.ffpEmbargoActive || tm.hasSpunClubs) return state;

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
        departedPlayerIds: state.season.departedPlayerIds ?? [],
        legendBonusActive: state.storyMode ? false : tm.legendBonusActive,
        championBonusActive: Boolean(tm.championBonusActive),
        allowedLeagueIds: state.draftLeaguePool,
        ...(state.storyMode
          ? { storyTransferPool: state.storyMode.transferPoolClubs }
          : {}),
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
      if (tm.ffpEmbargoActive || !tm.hasSpunClubs || tm.attemptsRemaining <= 0) {
        return state;
      }

      const { target, outSlot, cashOfferM = 0 } = action.payload;
      // Only block players already signed in this window; failed targets can be retried!
      if (tm.signedPlayerIds.includes(target.player.id)) return state;

      const outPlayer =
        outSlot.area === 'starter'
          ? state.starters[outSlot.index]
          : state.bench[outSlot.index];
      if (!outPlayer) return state;

      const availableCashM = state.season.budgetState?.transferCashM ?? 0;
      const safeCashOfferM = Math.max(
        0,
        Math.min(Math.round(cashOfferM), availableCashM),
      );
      const cashChanceBonus = computeCashLegendChanceBonus(safeCashOfferM);
      const effectiveSuccessChance = Math.min(
        95,
        Math.max(5, Math.round(target.successChance + cashChanceBonus)),
      );

      const roll = Math.random() * 100;
      const success = roll < effectiveSuccessChance;
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
                probability: effectiveSuccessChance,
                marketValueM: target.marketValueM,
                message: `${target.clubName} 측이 ${target.player.name} (€${target.marketValueM}M) 영입 제안을 거절했습니다. (성공률 ${effectiveSuccessChance}%${nextAttempts > 0 ? ' · 남은 기회로 재도전 가능' : ''})`,
              },
            },
          },
        };
      }

      // Negotiation Succeeded! Enforce global 1-instance uniqueness + stat continuity
      const incomingPlayer = target.player;
      const nextStarters = [...state.starters];
      const nextBench = [...state.bench];

      if (outSlot.area === 'starter') nextStarters[outSlot.index] = incomingPlayer;
      else nextBench[outSlot.index] = incomingPlayer;

      const nextFilledStarters = nextStarters.filter(
        (p): p is Player => p !== null,
      );
      const nextFilledBench = nextBench.filter((p): p is Player => p !== null);

      const nextDepartedPlayerIds = Array.from(
        new Set([
          ...(state.season.departedPlayerIds ?? []),
          incomingPlayer.id,
          outPlayer.id,
        ]),
      );
      const globalExcludeIds = new Set<string>([
        ...nextFilledStarters.map((p) => p.id),
        ...nextFilledBench.map((p) => p.id),
        ...nextDepartedPlayerIds,
      ]);

      // Remove incomingPlayer from original AI club roster in league & backfill cleanly
      const nextAiRosters: Record<string, Player[]> = { ...state.season.aiRosters };
      let originClubId = '';
      let swappedToOriginClub: Club | null = null;
      const clubById = new Map(state.season.clubs.map((c) => [c.id, c]));

      for (const [cid, roster] of Object.entries(nextAiRosters)) {
        const idx = roster.findIndex((p) => p.id === incomingPlayer.id);
        if (idx === -1) continue;
        originClubId = cid;
        const originClub = clubById.get(cid);
        if (originClub) {
          const replacement = pickReplacementForAiClub({
            club: originClub,
            leagueId: state.season.leagueId,
            departedPlayer: incomingPlayer,
            currentRoster: roster,
            excludeIds: globalExcludeIds,
            swapOutPlayer: outPlayer,
            round: state.season.currentRound,
            strictRosterOnly: Boolean(state.storyMode),
          });
          const updatedRoster = [...roster];
          updatedRoster[idx] = replacement;
          nextAiRosters[cid] = updatedRoster;
          if (replacement.id === outPlayer.id) {
            swappedToOriginClub = originClub;
          }
        }
      }

      if (!originClubId) {
        const byName = state.season.clubs.find((c) => c.name === target.clubName);
        originClubId = byName?.id ?? (target.isLegendFa ? 'LEGEND_FA' : `ext-${target.clubShortName}`);
      }

      const transferComp: 'league' | 'ucl' = tm.isUclSpecial ? 'ucl' : 'league';
      const incomingTransferRecord: PlayerTransferRecord = {
        fromClubId: originClubId,
        fromClubName: target.clubName,
        toClubId: USER_CLUB_ID,
        toClubName: state.userClub.name,
        round: state.season.currentRound,
        competition: transferComp,
      };

      const applyTransferToStatsMap = (
        sourceMap: Record<string, PlayerSeasonStats>,
        player: Player,
        toClub: {
          id: string;
          name: string;
          shortName: string;
          primaryColor: string;
          secondaryColor: string;
        },
        isToUser: boolean,
        record: PlayerTransferRecord,
      ): Record<string, PlayerSeasonStats> => {
        const nextMap = { ...sourceMap };
        const existing = nextMap[player.id] ?? nextMap[`user::${player.id}`];
        delete nextMap[`user::${player.id}`];

        if (existing) {
          const prevHist = existing.transferHistory ?? [];
          nextMap[player.id] = {
            ...existing,
            teamId: toClub.id,
            teamName: toClub.name,
            teamShortName: toClub.shortName,
            teamPrimaryColor: toClub.primaryColor,
            teamSecondaryColor: toClub.secondaryColor,
            isUserTeam: isToUser,
            transferHistory: [...prevHist, record],
          };
        } else {
          nextMap[player.id] = {
            playerId: player.id,
            playerName: formatPlayerRecordName(player),
            teamId: toClub.id,
            teamName: toClub.name,
            teamShortName: toClub.shortName,
            teamPrimaryColor: toClub.primaryColor,
            teamSecondaryColor: toClub.secondaryColor,
            isUserTeam: isToUser,
            position: player.position,
            mainPositions: [...player.mainPositions],
            ovr: player.ovr,
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
            isLegend: player.isLegend,
            classicEra: player.classicEra,
            transferHistory: [record],
          };
        }
        return nextMap;
      };

      const userClubMeta = {
        id: USER_CLUB_ID,
        name: state.userClub.name,
        shortName: state.userClub.shortName,
        primaryColor: state.userClub.primaryColor,
        secondaryColor: state.userClub.secondaryColor,
      };

      let nextStats = applyTransferToStatsMap(
        state.season.allPlayerStats,
        incomingPlayer,
        userClubMeta,
        true,
        incomingTransferRecord,
      );
      let nextCupStats = applyTransferToStatsMap(
        state.season.cupPlayerStats,
        incomingPlayer,
        userClubMeta,
        true,
        incomingTransferRecord,
      );
      let nextUclStats = state.season.ucl
        ? applyTransferToStatsMap(
            state.season.uclPlayerStats,
            incomingPlayer,
            userClubMeta,
            true,
            incomingTransferRecord,
          )
        : { ...state.season.uclPlayerStats };

      if (swappedToOriginClub) {
        const swapRecord: PlayerTransferRecord = {
          fromClubId: USER_CLUB_ID,
          fromClubName: state.userClub.name,
          toClubId: swappedToOriginClub.id,
          toClubName: swappedToOriginClub.name,
          round: state.season.currentRound,
          competition: transferComp,
        };
        nextStats = applyTransferToStatsMap(
          nextStats,
          outPlayer,
          swappedToOriginClub,
          false,
          swapRecord,
        );
        nextCupStats = applyTransferToStatsMap(
          nextCupStats,
          outPlayer,
          swappedToOriginClub,
          false,
          swapRecord,
        );
      }

      // If UCL is active (e.g. UCL Special Transfer Window), sync UCL clubs & AI rosters immediately!
      let nextUcl = state.season.ucl;
      if (nextUcl) {
        const nextUclAiRosters: Record<string, Player[]> = {
          ...nextUcl.aiRosters,
          [USER_CLUB_ID]: nextFilledStarters.slice(0, 11),
        };
        const uclClubById = new Map(nextUcl.clubs.map((c) => [c.id, c]));
        for (const [cid, roster] of Object.entries(nextUclAiRosters)) {
          if (cid === USER_CLUB_ID) continue;
          const idx = roster.findIndex((p) => p.id === incomingPlayer.id);
          if (idx === -1) continue;
          const uclOriginClub = uclClubById.get(cid);
          if (uclOriginClub) {
            const entryLeague =
              nextUcl.teams.find((t) => t.club.id === cid)?.originLeagueId ??
              'epl';
            const replacement = pickReplacementForAiClub({
              club: uclOriginClub,
              leagueId: entryLeague === 'other' ? 'epl' : entryLeague,
              departedPlayer: incomingPlayer,
              currentRoster: roster,
              excludeIds: globalExcludeIds,
              swapOutPlayer: outPlayer,
              round: state.season.currentRound,
              strictRosterOnly: Boolean(state.storyMode),
            });
            const updatedRoster = [...roster];
            updatedRoster[idx] = replacement;
            nextUclAiRosters[cid] = updatedRoster;
            if (replacement.id === outPlayer.id) {
              nextUclStats = applyTransferToStatsMap(
                nextUclStats,
                outPlayer,
                uclOriginClub,
                false,
                {
                  fromClubId: USER_CLUB_ID,
                  fromClubName: state.userClub.name,
                  toClubId: uclOriginClub.id,
                  toClubName: uclOriginClub.name,
                  round: state.season.currentRound,
                  competition: 'ucl',
                },
              );
            }
          }
        }

        const chemAfter = calculateChemistry(
          state.formation,
          nextFilledStarters,
          state.season.defaultTactic,
          state.manager.traitId,
        );
        const ratingsAfter = calculateTeamRatings(
          state.formation,
          nextFilledStarters,
          chemAfter.total,
          state.manager.traitId,
          chemAfter.slotSynergies,
          state.season.defaultTactic,
        );
        nextUcl = {
          ...nextUcl,
          aiRosters: nextUclAiRosters,
          clubs: nextUcl.clubs.map((c) =>
            c.id === USER_CLUB_ID
              ? {
                  ...c,
                  formation: state.formation,
                  defaultTactic: state.season!.defaultTactic,
                  att: ratingsAfter.att,
                  mid: ratingsAfter.mid,
                  def: ratingsAfter.def,
                }
              : c,
          ),
        };
      }

      const nextBudgetState =
        safeCashOfferM > 0 && state.season.budgetState
          ? deductTransferCash(state.season.budgetState, safeCashOfferM)
          : state.season.budgetState;
      const cashNote = safeCashOfferM > 0 ? ` · 보너스 €${safeCashOfferM}M 지급` : '';

      const nextHistory = [
        ...tm.history,
        {
          windowIndex: tm.windowIndex,
          round: state.season.currentRound,
          outPlayer,
          inPlayer: incomingPlayer,
          marketValueM: target.marketValueM,
          successChance: effectiveSuccessChance,
        },
      ];

      const prevTrackers =
        state.season.achievementTrackers ?? createInitialTrackers();
      const nextTrackers: SeasonAchievementTrackers = {
        ...prevTrackers,
        signedUnder20PctSuccess:
          prevTrackers.signedUnder20PctSuccess || effectiveSuccessChance <= 20,
      };

      const nextOtherLeagues = syncTransferToOtherLeagues({
        otherLeagues: state.season.otherLeagues,
        signedPlayerId: incomingPlayer.id,
        excludeIds: globalExcludeIds,
      });

      const swapSuffix = swappedToOriginClub
        ? ` (${outPlayer.name} ↔ ${swappedToOriginClub.name} 스왑)`
        : ` (${outPlayer.name} 방출)`;

      return {
        ...state,
        starters: nextStarters,
        bench: nextBench,
        season: {
          ...state.season,
          ...(nextBudgetState ? { budgetState: nextBudgetState } : {}),
          aiRosters: nextAiRosters,
          otherLeagues: nextOtherLeagues,
          departedPlayerIds: nextDepartedPlayerIds,
          allPlayerStats: nextStats,
          cupPlayerStats: nextCupStats,
          ucl: nextUcl,
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
              probability: effectiveSuccessChance,
              marketValueM: target.marketValueM,
              message: `오피셜! ${incomingPlayer.name} (OVR ${incomingPlayer.ovr} · €${target.marketValueM}M) 영입 완료!${cashNote}${swapSuffix}`,
            },
          },
        },
      };
    }

    case 'TRADE_SUBMIT_PACKAGE': {
      if (!state.season || !state.season.transferMarket.isOpen) return state;
      const tm = state.season.transferMarket;
      if (tm.ffpEmbargoActive || tm.attemptsRemaining <= 0) return state;

      const {
        partnerClub,
        partnerLeagueId,
        partnerClubRank,
        partnerLeagueSize,
        userSentSlots,
        aiTargetPlayers,
        aiFillerPlayers: passedFillers,
        cashOfferM = 0,
        overrideRoll,
      } = action.payload;

      const availableCashM = state.season.budgetState?.transferCashM ?? 0;
      const safeCashOfferM = Math.max(
        0,
        Math.min(Math.round(cashOfferM), availableCashM),
      );

      if (userSentSlots.length === 0 || aiTargetPlayers.length === 0) return state;
      // Prevent targeting players already signed in this window
      if (aiTargetPlayers.some((p) => tm.signedPlayerIds.includes(p.id))) {
        return state;
      }

      const userSentPlayers: Player[] = [];
      for (const slot of userSentSlots) {
        const p =
          slot.area === 'starter'
            ? state.starters[slot.index]
            : state.bench[slot.index];
        if (!p) return state;
        userSentPlayers.push(p);
      }

      const userSquad = [
        ...state.starters.filter((p): p is Player => p !== null),
        ...state.bench.filter((p): p is Player => p !== null),
      ];
      const ownedIds = new Set(userSquad.map((p) => p.id));
      const globalExcludeIds = new Set<string>([
        ...ownedIds,
        ...(state.season.departedPlayerIds ?? []),
      ]);
      const storyPartnerRoster = state.storyMode?.transferPoolClubs.find(
        (c) => c.club.id === partnerClub.id,
      )?.roster;
      const liveAiRoster =
        partnerLeagueId === state.season.leagueId
          ? state.season.aiRosters[partnerClub.id] ?? storyPartnerRoster ?? []
          : storyPartnerRoster ??
            state.season.otherLeagues?.[partnerLeagueId]?.aiRosters?.[
              partnerClub.id
            ] ??
            [];
      const partnerSquad16 = buildAiClubSquad16({
        club: partnerClub,
        leagueId: partnerLeagueId,
        liveAiRoster,
        ownedIds,
        excludeIds: globalExcludeIds,
        strictRosterOnly: Boolean(state.storyMode),
      }).all16;
      const aiNeeds = analyzeClubPositionNeeds(partnerSquad16);

      const shockBargainIds = new Set<string>();
      for (const p of partnerSquad16) {
        const sb = evaluateShockBargainStatus({
          player: p,
          clubId: partnerClub.id,
          windowIndex: tm.windowIndex,
          currentRound: state.season.currentRound,
        });
        if (sb.isShockBargain) {
          shockBargainIds.add(p.id);
          break;
        }
      }

      // Option 3: Auto-match rotation fillers when user sends more players than AI targets (2:1 / 3:1)
      const neededFillers = Math.max(
        0,
        userSentPlayers.length - aiTargetPlayers.length,
      );
      let resolvedFillers: Player[] = passedFillers ? [...passedFillers] : [];
      if (resolvedFillers.length < neededFillers) {
        const excludeSet = new Set<string>([
          ...userSquad.map((p) => p.id),
          ...resolvedFillers.map((p) => p.id),
        ]);
        const autoFillers = selectAutoFillerPlayers({
          aiRoster: partnerSquad16,
          aiTargetIds: new Set(aiTargetPlayers.map((p) => p.id)),
          userSentPlayers,
          neededCount: neededFillers - resolvedFillers.length,
          club: partnerClub,
          leagueId: partnerLeagueId,
          excludeIds: excludeSet,
        });
        resolvedFillers = [...resolvedFillers, ...autoFillers];
      } else if (resolvedFillers.length > neededFillers) {
        resolvedFillers = resolvedFillers.slice(0, neededFillers);
      }

      const evaluation = evaluateTradePackage({
        userSentPlayers,
        aiTargetPlayers,
        aiFillerPlayers: resolvedFillers,
        aiClub: partnerClub,
        aiRoster: partnerSquad16,
        aiNeeds,
        userSquad,
        userRank: getUserRank(state.season.standings, USER_CLUB_ID),
        userLeagueSize: state.season.standings.length || 20,
        aiClubRank: partnerClubRank,
        aiLeagueSize: partnerLeagueSize,
        allPlayerStats: state.season.allPlayerStats,
        conditionMap: state.season.playerConditions,
        championBonusActive: Boolean(tm.championBonusActive),
        shockBargainIds,
        cashOfferM: safeCashOfferM,
      });

      if (evaluation.blockedReason || userSentPlayers.length !== aiTargetPlayers.length + resolvedFillers.length) {
        return {
          ...state,
          season: {
            ...state.season,
            transferMarket: {
              ...tm,
              lastOfferResult: {
                success: false,
                isTrade: true,
                targetPlayer: aiTargetPlayers[0],
                outPlayer: userSentPlayers[0],
                sentPlayers: userSentPlayers,
                receivedPlayers: [...aiTargetPlayers, ...resolvedFillers],
                probability: 0,
                marketValueM: safeCashOfferM,
                gmReaction: evaluation.gmReaction,
                message:
                  evaluation.blockedReason ??
                  '양 팀 로스터 인원 균형이 맞지 않아 트레이드를 진행할 수 없습니다.',
              },
            },
          },
        };
      }

      const roll = overrideRoll !== undefined ? overrideRoll : Math.random() * 100;
      const accepted = roll < evaluation.acceptanceChance;
      const nextAttempts = Math.max(0, tm.attemptsRemaining - 1);

      if (!accepted) {
        return {
          ...state,
          season: {
            ...state.season,
            transferMarket: {
              ...tm,
              attemptsRemaining: nextAttempts,
              attemptedPlayerIds: [
                ...tm.attemptedPlayerIds,
                ...aiTargetPlayers.map((p) => p.id),
              ],
              lastOfferResult: {
                success: false,
                isTrade: true,
                targetPlayer: aiTargetPlayers[0],
                outPlayer: userSentPlayers[0],
                sentPlayers: userSentPlayers,
                receivedPlayers: [...aiTargetPlayers, ...resolvedFillers],
                probability: evaluation.acceptanceChance,
                marketValueM: safeCashOfferM,
                gmReaction: evaluation.gmReaction,
                message: `${partnerClub.name} 측이 트레이드 제안을 거절했습니다. (성사 확률 ${evaluation.acceptanceChance}%${nextAttempts > 0 ? ' · 조건을 보강해 재협상 가능' : ''})`,
              },
            },
          },
        };
      }

      return executeBidirectionalTrade({
        state,
        partnerClub,
        partnerLeagueId,
        userSentSlots,
        aiTargetPlayers,
        aiFillerPlayers: resolvedFillers,
        acceptanceChance: evaluation.acceptanceChance,
        gmReaction: evaluation.gmReaction,
        isIncomingOffer: false,
        nextAttempts,
        cashOfferM: safeCashOfferM,
      });
    }

    case 'TRADE_ACCEPT_INCOMING': {
      if (!state.season || !state.season.transferMarket.isOpen) return state;
      const tm = state.season.transferMarket;
      if (tm.ffpEmbargoActive || tm.attemptsRemaining <= 0) return state;

      const offer = (tm.incomingOffers ?? []).find(
        (o) => o.id === action.payload.offerId && o.status === 'pending',
      );
      if (!offer) return state;

      // Locate user slots for every requested player
      const userSentSlots: { area: 'starter' | 'bench'; index: number }[] = [];
      for (const reqPlayer of offer.userRequestedPlayers) {
        const sIdx = state.starters.findIndex((p) => p?.id === reqPlayer.id);
        if (sIdx !== -1) {
          userSentSlots.push({ area: 'starter', index: sIdx });
          continue;
        }
        const bIdx = state.bench.findIndex((p) => p?.id === reqPlayer.id);
        if (bIdx !== -1) {
          userSentSlots.push({ area: 'bench', index: bIdx });
        }
      }
      if (userSentSlots.length !== offer.userRequestedPlayers.length) {
        return state;
      }

      // Guard: ensure user still has >= 1 GK after accepting incoming offer
      const reqIds = new Set(offer.userRequestedPlayers.map((p) => p.id));
      const userSquadNow = [
        ...state.starters.filter((p): p is Player => p !== null),
        ...state.bench.filter((p): p is Player => p !== null),
      ];
      const postUserGks =
        userSquadNow.filter((p) => !reqIds.has(p.id) && p.position === 'GK')
          .length +
        offer.aiOffersPlayers.filter((p) => p.position === 'GK').length;
      if (postUserGks < 1) {
        return {
          ...state,
          season: {
            ...state.season,
            transferMarket: {
              ...tm,
              lastOfferResult: {
                success: false,
                isTrade: true,
                targetPlayer: offer.aiOffersPlayers[0],
                outPlayer: offer.userRequestedPlayers[0],
                probability: 0,
                marketValueM: 0,
                message:
                  '우리 팀에 최소 1명의 골키퍼(GK)를 남겨야 하므로 이 제안을 수락할 수 없습니다.',
              },
            },
          },
        };
      }

      return executeBidirectionalTrade({
        state,
        partnerClub: offer.club,
        partnerLeagueId: offer.leagueId,
        userSentSlots,
        aiTargetPlayers: offer.aiOffersPlayers,
        aiFillerPlayers: [],
        acceptanceChance: 100,
        gmReaction: `${offer.club.shortName} 단장: "트레이드를 수락해 주셔서 감사합니다! 양 팀 모두에게 최고의 윈-윈 딜이 될 겁니다."`,
        isIncomingOffer: true,
        acceptedIncomingOfferId: offer.id,
        nextAttempts: Math.max(0, tm.attemptsRemaining - 1),
      });
    }

    case 'TRADE_REJECT_INCOMING': {
      if (!state.season || !state.season.transferMarket.isOpen) return state;
      const tm = state.season.transferMarket;
      return {
        ...state,
        season: {
          ...state.season,
          transferMarket: {
            ...tm,
            incomingOffers: (tm.incomingOffers ?? []).map((o) =>
              o.id === action.payload.offerId
                ? { ...o, status: 'rejected' as const }
                : o,
            ),
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

      // If closing the UCL Special Window, advance UCL stage into R16 (Story Mode) or Swiss League Phase!
      const nextUcl =
        tm.isUclSpecial && state.season.ucl?.stage === 'special_transfer'
          ? {
              ...state.season.ucl,
              stage: state.season.ucl.isDirectR16
                ? ('r16' as const)
                : ('league_phase' as const),
            }
          : state.season.ucl;

      return {
        ...state,
        ...(state.storyMode
          ? {
              storyMode: {
                ...state.storyMode,
                signingsThisWindow: 0,
              },
            }
          : {}),
        season: {
          ...state.season,
          ucl: nextUcl,
          transferMarket: createClosedTransferState(
            nextCompleted,
            tm.history,
            tm.tradeHistory ?? [],
          ),
        },
      };
    }

    case 'HIRE_STAFF_COACH': {
      if (!state.season) return state;
      const sc = state.season.staffCoach;
      if (!sc || !sc.pendingSelection || sc.completed) return state;
      if (!sc.offeredCoachIds.includes(action.payload.coachId)) return state;
      return {
        ...state,
        season: {
          ...state.season,
          staffCoach: {
            ...sc,
            hiredCoachId: action.payload.coachId,
            pendingSelection: false,
            completed: true,
          },
        },
      };
    }

    case 'SKIP_STAFF_COACH': {
      if (!state.season) return state;
      const sc = state.season.staffCoach;
      if (!sc || !sc.pendingSelection) return state;
      return {
        ...state,
        season: {
          ...state.season,
          staffCoach: {
            ...sc,
            pendingSelection: false,
            completed: true,
          },
        },
      };
    }

    case 'DISMISS_FFP_OPENING_NOTICE': {
      if (!state.season?.pendingFfpOpeningNotice) return state;
      return {
        ...state,
        season: {
          ...state.season,
          pendingFfpOpeningNotice: false,
        },
      };
    }

    case 'DISMISS_ADAPTATION_ALERT': {
      if (!state.season?.tacticalAdaptation?.pendingAlert) return state;
      return {
        ...state,
        season: {
          ...state.season,
          tacticalAdaptation: {
            ...state.season.tacticalAdaptation,
            pendingAlert: null,
          },
        },
      };
    }

    case 'DISMISS_AWAKENING_ALERT': {
      if (!state.season?.pendingAwakeningAlerts?.length) return state;
      return {
        ...state,
        season: {
          ...state.season,
          pendingAwakeningAlerts: state.season.pendingAwakeningAlerts.slice(1),
        },
      };
    }

    case 'ENTER_UCL_MODE': {
      if (!state.season || state.phase !== 'season_end') return state;
      const userRank = getUserRank(state.season.standings, USER_CLUB_ID);
      if (!state.storyMode && userRank > 4) return state;

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
        chem.slotSynergies,
        state.season.defaultTactic,
      );
      const userClubEntry = buildUserClubEntry(
        state.userClub,
        state.formation,
        state.season.defaultTactic,
        filledStarters,
        ratings,
      );

      const { ownedIds, excludeIds } = buildUserExclusionSets(
        filledStarters,
        filledBench,
        state.season.departedPlayerIds,
      );

      // Story Mode: jump directly to authentic 16-team UCL Round of 16 with 1 pre-UCL era transfer window
      if (state.storyMode) {
        const prep = state.storyMode.uclR16Prepared;
        if (!state.storyMode.hasUcl || !prep) return state;
        const mergedAiRosters: Record<string, Player[]> = { ...prep.aiRosters };
        // Keep latest post-transfer rosters for domestic league rivals in UCL R16
        for (const c of prep.clubs) {
          if (c.id !== USER_CLUB_ID && state.season.aiRosters[c.id]) {
            mergedAiRosters[c.id] = state.season.aiRosters[c.id];
          }
        }
        const openPreUclWindow = true;
        const { ucl, uclPlayerStats } = createStoryUclR16State({
          seasonLabel: prep.seasonLabel,
          userClub: userClubEntry,
          userSquad: [...filledStarters, ...filledBench],
          clubs: prep.clubs,
          aiRosters: mergedAiRosters,
          pairings: prep.pairings,
          originLabels: prep.originLabels,
          excludeIds,
          ownedIds,
          startWithSpecialTransfer: openPreUclWindow,
        });
        const storyPreUclTransfer = openTransferWindowWithIncomingOffers({
          season: state.season,
          starters: state.starters,
          bench: state.bench,
          windowIndex: 4,
          triggerRound: state.season.totalRounds,
          userRank,
          storyMode: state.storyMode,
          options: {
            isUclSpecial: true,
            championBonusActive: userRank === 1,
          },
        });
        return {
          ...state,
          phase: 'ucl',
          storyMode: {
            ...state.storyMode,
            signingsThisWindow: 0,
          },
          season: {
            ...state.season,
            ucl,
            uclPlayerStats,
            userUclMatchHistory: [],
            transferMarket: storyPreUclTransfer,
            liveHalftime: null,
          },
        };
      }

      const { ucl, uclPlayerStats } = createUclTournamentState({
        userLeagueId: state.season.leagueId,
        userClub: userClubEntry,
        userSquad: [...filledStarters, ...filledBench],
        userLeagueClubs: state.season.clubs,
        userLeagueStandings: state.season.standings,
        userAiRosters: state.season.aiRosters,
        otherLeagues: state.season.otherLeagues,
        excludeIds,
        ownedIds,
        userParticipated: true,
      });

      const specialTransfer = openTransferWindowWithIncomingOffers({
        season: state.season,
        starters: state.starters,
        bench: state.bench,
        windowIndex: 4,
        triggerRound: state.season.totalRounds,
        userRank,
        allowedLeagueIds: state.draftLeaguePool,
        options: {
          isUclSpecial: true,
          championBonusActive: userRank === 1,
        },
      });

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
      if (
        state.season.transferMarket.isOpen ||
        state.season.liveHalftime ||
        Boolean(state.season.managerEvents?.activeEvent) ||
        Boolean(state.season.managerEvents?.lastResolution)
      ) {
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
      const { chem, ratings, staffCoachId } = computeUserChemAndRatings({
        formation: state.formation,
        starters: filledStarters,
        tactic: activeTactic,
        managerTraitId: state.manager.traitId,
        season: state.season,
      });
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

      const workingConditions: PlayerConditionMap = {
        ...state.season.playerConditions,
      };
      const { ownedIds, excludeIds } = buildUserExclusionSets(
        filledStarters,
        filledBench,
        state.season.departedPlayerIds,
      );

      const res = simulateUclLeaguePhaseToEnd({
        ucl: syncedUcl,
        uclPlayerStats: state.season.uclPlayerStats,
        conditionMap: workingConditions,
        excludeIds,
        ownedIds,
        userContext: {
          userClubId: USER_CLUB_ID,
          starters: applyConditionToPlayers(
            filledStarters,
            workingConditions,
            state.season.managerEvents?.teamMorale ?? 0,
          ),
          bench: filledBench,
          formation: state.formation,
          tactic: activeTactic,
          chemistry: chem.total,
          ratings,
          slotSynergies: chem.slotSynergies,
          managerTraitId: state.manager.traitId,
          staffCoachId,
          tacticalHistory: state.season.tacticalAdaptation?.history,
          competition: 'ucl',
          allowAutoSubs: true,
        },
      });

      let nextTrackers = state.season.achievementTrackers;
      let rollingSeason: SeasonState = {
        ...state.season,
        nextMatchTactic: null,
        ucl: res.ucl,
        uclPlayerStats: res.uclPlayerStats,
        userUclMatchHistory: [
          ...state.season.userUclMatchHistory,
          ...res.newUserMatches,
        ],
        lastUserMatch:
          res.newUserMatches[res.newUserMatches.length - 1] ??
          state.season.lastUserMatch,
        playerConditions: workingConditions,
      };
      for (const m of res.newUserMatches) {
        nextTrackers = updateTrackersForUserMatch(nextTrackers, m);
        const post = applyPostUserMatchConditionAndEvents({
          season: rollingSeason,
          workingConditions: rollingSeason.playerConditions ?? workingConditions,
          formation: state.formation,
          tactic: activeTactic,
          managerTraitId: state.manager.traitId,
          starters: state.starters,
          bench: state.bench,
          userMatchResult: m,
          competition: 'ucl',
          round: m.round,
          isShortRest: true,
          teamName: state.userClub.name,
          managerName: state.manager.name,
          allowEventTrigger: false,
        });
        rollingSeason = {
          ...rollingSeason,
          playerConditions: post.playerConditions,
          managerEvents: post.managerEvents,
          pendingInjuryAlerts: post.pendingInjuryAlerts,
          tacticalAdaptation: post.tacticalAdaptation,
          awakenedPlayers: post.awakenedPlayers,
          pendingAwakeningAlerts: post.pendingAwakeningAlerts,
          storyCrisisLog: post.storyCrisisLog,
        };
      }

      return {
        ...state,
        season: {
          ...rollingSeason,
          achievementTrackers: nextTrackers,
        },
      };
    }

    case 'SIMULATE_UCL_PLAYOFF_BYE': {
      if (state.phase !== 'ucl' || !state.season || !state.season.ucl) {
        return state;
      }
      if (state.season.ucl.stage !== 'playoff') return state;
      const workingConditions: PlayerConditionMap = {
        ...state.season.playerConditions,
      };
      const { ownedIds, excludeIds } = buildUserExclusionSets(
        state.starters,
        state.bench,
        state.season.departedPlayerIds,
      );
      const res = advanceUclPlayoffToCompletion({
        ucl: state.season.ucl,
        uclPlayerStats: state.season.uclPlayerStats,
        conditionMap: workingConditions,
        excludeIds,
        ownedIds,
      });
      return {
        ...state,
        season: {
          ...state.season,
          nextMatchTactic: null,
          ucl: res.ucl,
          uclPlayerStats: res.uclPlayerStats,
          playerConditions: workingConditions,
        },
      };
    }

    case 'SIMULATE_UCL_TO_END': {
      if (state.phase !== 'ucl' || !state.season || !state.season.ucl) {
        return state;
      }
      if (
        state.season.transferMarket.isOpen ||
        state.season.liveHalftime ||
        Boolean(state.season.managerEvents?.activeEvent) ||
        Boolean(state.season.managerEvents?.lastResolution)
      ) {
        return state;
      }

      const filledStarters = state.starters.filter((p): p is Player => p !== null);
      const filledBench = state.bench.filter((p): p is Player => p !== null);
      const activeTactic =
        state.season.nextMatchTactic ?? state.season.defaultTactic;
      const workingConditions: PlayerConditionMap = {
        ...state.season.playerConditions,
      };
      const { ownedIds, excludeIds } = buildUserExclusionSets(
        filledStarters,
        filledBench,
        state.season.departedPlayerIds,
      );
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
        chem.slotSynergies,
        activeTactic,
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
        conditionMap: workingConditions,
        excludeIds,
        ownedIds,
        userContext: {
          userClubId: USER_CLUB_ID,
          starters: applyConditionToPlayers(
            filledStarters,
            workingConditions,
            state.season.managerEvents?.teamMorale ?? 0,
          ),
          bench: filledBench,
          formation: state.formation,
          tactic: activeTactic,
          chemistry: chem.total,
          ratings,
          slotSynergies: chem.slotSynergies,
          managerTraitId: state.manager.traitId,
          competition: 'ucl',
          allowAutoSubs: true,
        },
      });

      let nextTrackers = state.season.achievementTrackers;
      let rollingSeason: SeasonState = {
        ...state.season,
        nextMatchTactic: null,
        ucl: res.ucl,
        uclPlayerStats: res.uclPlayerStats,
        userUclMatchHistory: [
          ...state.season.userUclMatchHistory,
          ...res.newUserMatches,
        ],
        lastUserMatch:
          res.newUserMatches[res.newUserMatches.length - 1] ??
          state.season.lastUserMatch,
        playerConditions: workingConditions,
      };
      for (const m of res.newUserMatches) {
        nextTrackers = updateTrackersForUserMatch(nextTrackers, m);
        const post = applyPostUserMatchConditionAndEvents({
          season: rollingSeason,
          workingConditions: rollingSeason.playerConditions ?? workingConditions,
          formation: state.formation,
          tactic: activeTactic,
          managerTraitId: state.manager.traitId,
          starters: state.starters,
          bench: state.bench,
          userMatchResult: m,
          competition: 'ucl',
          round: m.round,
          isShortRest: true,
          teamName: state.userClub.name,
          managerName: state.manager.name,
          allowEventTrigger: false,
        });
        rollingSeason = {
          ...rollingSeason,
          playerConditions: post.playerConditions,
          managerEvents: post.managerEvents,
          pendingInjuryAlerts: post.pendingInjuryAlerts,
          tacticalAdaptation: post.tacticalAdaptation,
          awakenedPlayers: post.awakenedPlayers,
          pendingAwakeningAlerts: post.pendingAwakeningAlerts,
          storyCrisisLog: post.storyCrisisLog,
        };
      }

      return {
        ...state,
        season: {
          ...rollingSeason,
          achievementTrackers: nextTrackers,
        },
      };
    }

    case 'SKIP_UCL_TO_FINAL_SUMMARY': {
      if (!state.season) return state;
      const filledStarters = state.starters.filter((p): p is Player => p !== null);
      const filledBench = state.bench.filter((p): p is Player => p !== null);
      const activeTactic = state.season.defaultTactic;
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
        chem.slotSynergies,
        activeTactic,
      );
      const userClubEntry = buildUserClubEntry(
        state.userClub,
        state.formation,
        activeTactic,
        filledStarters,
        ratings,
      );
      const { ownedIds, excludeIds } = buildUserExclusionSets(
        filledStarters,
        filledBench,
        state.season.departedPlayerIds,
      );

      const userRank = getUserRank(state.season.standings, USER_CLUB_ID);
      const init = state.season.ucl
        ? { ucl: state.season.ucl, uclPlayerStats: state.season.uclPlayerStats }
        : createUclTournamentState({
            userLeagueId: state.season.leagueId,
            userClub: userClubEntry,
            userSquad: [...filledStarters, ...filledBench],
            userLeagueClubs: state.season.clubs,
            userLeagueStandings: state.season.standings,
            userAiRosters: state.season.aiRosters,
            otherLeagues: state.season.otherLeagues,
            excludeIds,
            ownedIds,
            userParticipated: userRank <= 4,
          });

      const sim = init.ucl.completed
        ? {
            ucl: init.ucl,
            uclPlayerStats: init.uclPlayerStats,
            newUserMatches: [] as MatchResult[],
          }
        : simulateUclToCompletion({
            ucl: init.ucl,
            uclPlayerStats: init.uclPlayerStats,
            excludeIds,
            ownedIds,
            userContext:
              userRank <= 4
                ? {
                    userClubId: USER_CLUB_ID,
                    starters: filledStarters,
                    bench: filledBench,
                    formation: state.formation,
                    tactic: activeTactic,
                    chemistry: chem.total,
                    ratings,
                    managerTraitId: state.manager.traitId,
                    allowAutoSubs: true,
                  }
                : undefined,
          });

      let nextTrackers = state.season.achievementTrackers;
      for (const m of sim.newUserMatches) {
        nextTrackers = updateTrackersForUserMatch(nextTrackers, m);
      }

      const globalAwards = computeGlobalSeasonAwards({
        allLeaguePlayerStats: state.season.allPlayerStats,
        cupPlayerStats: state.season.cupPlayerStats,
        uclPlayerStats: sim.uclPlayerStats,
        leagueStandings: state.season.standings,
        cup: state.season.cup,
        ucl: sim.ucl,
        otherLeagues: state.season.otherLeagues,
        userLeagueId: state.season.leagueId,
        excludeIds,
      });

      const updated: GameState = {
        ...state,
        phase: 'season_end',
        season: {
          ...state.season,
          nextMatchTactic: null,
          ucl: sim.ucl,
          uclPlayerStats: sim.uclPlayerStats,
          userUclMatchHistory: [
            ...state.season.userUclMatchHistory,
            ...sim.newUserMatches,
          ],
          achievementTrackers: nextTrackers,
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

    case 'FINISH_UCL_TO_SUMMARY': {
      if (!state.season) return state;
      const filledStarters = state.starters.filter((p): p is Player => p !== null);
      const filledBench = state.bench.filter((p): p is Player => p !== null);
      const { ownedIds, excludeIds } = buildUserExclusionSets(
        filledStarters,
        filledBench,
        state.season.departedPlayerIds,
      );

      // Guarantee UCL is fully completed before computing Ballon d'Or & entering final summary
      let finalUcl = state.season.ucl;
      let finalUclStats = state.season.uclPlayerStats;
      let extraUserMatches: MatchResult[] = [];
      let nextTrackers = state.season.achievementTrackers;

      if (finalUcl && !finalUcl.completed) {
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
          chem.slotSynergies,
          activeTactic,
        );
        const sim = simulateUclToCompletion({
          ucl: finalUcl,
          uclPlayerStats: finalUclStats,
          excludeIds,
          ownedIds,
          userContext:
            finalUcl.userParticipated !== false
              ? {
                  userClubId: USER_CLUB_ID,
                  starters: filledStarters,
                  bench: filledBench,
                  formation: state.formation,
                  tactic: activeTactic,
                  chemistry: chem.total,
                  ratings,
                  managerTraitId: state.manager.traitId,
                  allowAutoSubs: true,
                }
              : undefined,
        });
        finalUcl = sim.ucl;
        finalUclStats = sim.uclPlayerStats;
        extraUserMatches = sim.newUserMatches;
        for (const m of extraUserMatches) {
          nextTrackers = updateTrackersForUserMatch(nextTrackers, m);
        }
      }

      const globalAwards = computeGlobalSeasonAwards({
        allLeaguePlayerStats: state.season.allPlayerStats,
        cupPlayerStats: state.season.cupPlayerStats,
        uclPlayerStats: finalUclStats,
        leagueStandings: state.season.standings,
        cup: state.season.cup,
        ucl: finalUcl,
        otherLeagues: state.season.otherLeagues,
        userLeagueId: state.season.leagueId,
        excludeIds,
      });

      const updated: GameState = {
        ...state,
        phase: 'season_end',
        season: {
          ...state.season,
          nextMatchTactic: null,
          ucl: finalUcl,
          uclPlayerStats: finalUclStats,
          userUclMatchHistory: [
            ...state.season.userUclMatchHistory,
            ...extraUserMatches,
          ],
          achievementTrackers: nextTrackers,
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

    case 'RESOLVE_MANAGER_EVENT': {
      if (!state.season) return state;
      const evState = state.season.managerEvents;
      if (!evState?.activeEvent) return state;
      const resolved = resolveManagerEventChoice({
        event: evState.activeEvent,
        choiceId: action.payload.choiceId,
        starters: state.starters,
        bench: state.bench,
        conditionMap: state.season.playerConditions ?? {},
        currentTeamMorale: evState.teamMorale,
      });
      return {
        ...state,
        season: {
          ...state.season,
          playerConditions: resolved.nextConditionMap,
          managerEvents: {
            ...evState,
            teamMorale: resolved.nextTeamMorale,
            activeEvent: null,
            lastResolution: resolved.resolution,
          },
        },
      };
    }

    case 'DISMISS_MANAGER_EVENT_RESOLUTION': {
      if (!state.season?.managerEvents) return state;
      return {
        ...state,
        season: {
          ...state.season,
          managerEvents: {
            ...state.season.managerEvents,
            lastResolution: null,
          },
        },
      };
    }

    case 'DISMISS_INJURY_ALERTS': {
      if (!state.season) return state;
      const toAdd = action.payload?.autoReturnsToAdd ?? [];
      let nextAutoReturns = state.season.injuryAutoReturns ?? [];
      if (toAdd.length > 0) {
        const byId = new Map<string, InjuryAutoReturnEntry>();
        for (const e of nextAutoReturns) byId.set(e.injuredPlayerId, e);
        for (const e of toAdd) byId.set(e.injuredPlayerId, e);
        nextAutoReturns = Array.from(byId.values());
      }
      return {
        ...state,
        season: {
          ...state.season,
          pendingInjuryAlerts: [],
          injuryAutoReturns: nextAutoReturns,
        },
      };
    }

    case 'AUTO_REPLACE_INJURED_STARTER': {
      if (!state.season) return state;
      const { starterSlotIndex, benchIndex, playerId } = action.payload;
      const nextStarters = [...state.starters];
      const nextBench = [...state.bench];
      let nextAutoReturns = state.season.injuryAutoReturns ?? [];
      if (
        starterSlotIndex >= 0 &&
        starterSlotIndex < nextStarters.length &&
        benchIndex >= 0 &&
        benchIndex < nextBench.length
      ) {
        const injuredPlayer = nextStarters[starterSlotIndex];
        const replacement = nextBench[benchIndex];
        if (replacement) {
          nextStarters[starterSlotIndex] = replacement;
          nextBench[benchIndex] = injuredPlayer;
          if (injuredPlayer && injuredPlayer.id === playerId) {
            const byId = new Map<string, InjuryAutoReturnEntry>();
            for (const e of nextAutoReturns) byId.set(e.injuredPlayerId, e);
            byId.set(injuredPlayer.id, {
              injuredPlayerId: injuredPlayer.id,
              injuredPlayerName: injuredPlayer.name,
              originalSlotIndex: starterSlotIndex,
              replacementPlayerId: replacement.id,
            });
            nextAutoReturns = Array.from(byId.values());
          }
        }
      }
      const remainingAlerts = (state.season.pendingInjuryAlerts ?? []).filter(
        (a) => a.playerId !== playerId,
      );
      return {
        ...state,
        starters: nextStarters,
        bench: nextBench,
        season: {
          ...state.season,
          pendingInjuryAlerts: remainingAlerts,
          injuryAutoReturns: nextAutoReturns,
        },
      };
    }

    case 'DISMISS_INJURY_RETURN_TOAST': {
      if (!state.season) return state;
      const targetId = action.payload?.id;
      const nextToasts = targetId
        ? (state.season.injuryReturnToasts ?? []).filter((t) => t.id !== targetId)
        : [];
      return {
        ...state,
        season: {
          ...state.season,
          injuryReturnToasts: nextToasts,
        },
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

    case 'OPEN_STORY_HUB': {
      return {
        ...state,
        phase: 'story_hub',
      };
    }

    case 'ENTER_STORY_SETUP': {
      const hydrated: HydratedStoryScenario = hydrateStoryScenarioBundle(
        action.payload.bundle,
      );
      const meta = hydrated.meta;
      const paddedBench: (Player | null)[] = [...hydrated.userBench];
      while (paddedBench.length < 7) paddedBench.push(null);
      return {
        ...createInitialState(),
        phase: 'story_setup',
        userClub: { ...meta.clubProfile },
        manager: {
          name: meta.managerName,
          avatar: { ...meta.managerAvatar },
          traitId: meta.managerTraitOptions[0]?.traitId ?? null,
          rerollsRemaining: 0,
          hasSpun: true,
        },
        formation: meta.defaultFormation,
        defaultTactic: meta.defaultTactic,
        starters: hydrated.userStarters.slice(0, 11),
        bench: paddedBench.slice(0, 7),
        storyMode: hydrated.runtimeState,
      };
    }

    case 'SET_STORY_MANAGER_TRAIT': {
      if (!state.storyMode || state.phase !== 'story_setup') return state;
      return {
        ...state,
        manager: {
          ...state.manager,
          traitId: action.payload.traitId,
        },
      };
    }

    case 'START_STORY_SEASON': {
      const hydrated = hydrateStoryScenarioBundle(action.payload.bundle);
      const meta = hydrated.meta;
      const filledStarters = state.starters.filter(
        (p): p is Player => p !== null,
      );
      const filledBench = state.bench.filter((p): p is Player => p !== null);
      if (filledStarters.length < 11) return state;

      // Story Mode uses era cash budget with zero FFP penalties
      const storyBudgetState = {
        ...createDefaultSeasonBudgetState(),
        capM: 9999,
        initialSpentM: 0,
        excessM: 0,
        excessPct: 0,
        ffpTier: 0 as const,
        transferCashM: meta.cashBudgetM,
        chemPenalty: 0,
        window1MaxAttempts: 3,
        window2MaxAttempts: 3,
        window3MaxAttempts: 3,
        scoreMultiplier: 1.0,
        extraLossMoraleDrop: 0,
      };

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
        chem.slotSynergies,
        state.defaultTactic,
      );
      const userClubEntry = buildUserClubEntry(
        state.userClub,
        state.formation,
        state.defaultTactic,
        filledStarters,
        ratings,
      );

      const clubs = hydrated.domesticClubs.map((c) =>
        c.id === USER_CLUB_ID ? userClubEntry : c,
      );
      const aiRosters = { ...hydrated.domesticAiRosters };
      const fixtures = generateDoubleRoundRobin(clubs);
      const standings = createInitialStandings(clubs);
      const allPlayerStats = createInitialPlayerStatsMap({
        clubs,
        userClub: userClubEntry,
        userSquad: [...filledStarters, ...filledBench],
        aiRosters,
      });
      const totalRounds = (clubs.length - 1) * 2;
      const cup = createDomesticCupState(meta.leagueId, clubs, totalRounds);
      const cupPlayerStats = createInitialPlayerStatsMap({
        clubs,
        userClub: userClubEntry,
        userSquad: [...filledStarters, ...filledBench],
        aiRosters,
      });

      // Story Mode: unified 3 league transfer windows matching Single Player ([9,17,25] for 34R Bundesliga / [10,19,28] for 38R leagues)
      const transferWindows: [number, number, number] =
        totalRounds <= 34 ? [9, 17, 25] : [10, 19, 28];

      const season: SeasonState = {
        runId: `story_${meta.id}_${Date.now()}`,
        leagueId: meta.leagueId,
        replacedClubName: meta.clubName,
        defaultTactic: state.defaultTactic,
        nextMatchTactic: null,
        clubs,
        aiRosters,
        fixtures,
        currentRound: 0,
        totalRounds,
        transferWindows,
        standings,
        otherLeagues: {},
        lastUserMatch: null,
        liveHalftime: null,
        userMatchHistory: [],
        allPlayerStats,
        transferMarket: createClosedTransferState(),
        awards: null,
        globalAwards: null,
        cup,
        cupPlayerStats,
        userCupMatchHistory: [],
        ucl: null,
        uclPlayerStats: {},
        userUclMatchHistory: [],
        achievementTrackers: createInitialTrackers(),
        seasonScore: null,
        legacyArchived: false,
        departedPlayerIds: [],
        playerConditions: {},
        managerEvents: createDefaultManagerEventsState(),
        pendingInjuryAlerts: [],
        budgetState: storyBudgetState,
        pendingFfpOpeningNotice: false,
        tacticalAdaptation: createInitialTacticalAdaptationState(),
        staffCoach: createInitialStaffCoachState(),
        awakenedPlayers: {},
        pendingAwakeningAlerts: [],
        storyFocusPlayerIds: hydrated.runtimeState.awakeningFocusPlayerIds,
      };

      return {
        ...state,
        phase: 'season',
        season,
        phase2Handoff: null,
        storyMode: {
          ...hydrated.runtimeState,
          signingsThisWindow: 0,
          codexRecorded: false,
        },
      };
    }

    case 'RESUME_STORY_SAVE': {
      return action.payload.savedState;
    }

    case 'EXIT_STORY_TO_TITLE': {
      const normalSaved = loadSavedGameState();
      if (normalSaved.phase !== 'title' && !normalSaved.storyMode) {
        return {
          ...hydrateWithPersistedProfile(createInitialState()),
          phase: 'title',
        };
      }
      return hydrateWithPersistedProfile(createInitialState());
    }

    case 'MARK_STORY_CODEX_RECORDED': {
      if (!state.storyMode) return state;
      return {
        ...state,
        storyMode: {
          ...state.storyMode,
          codexRecorded: true,
        },
      };
    }

    case 'RESET_GAME': {
      if (state.storyMode) {
        clearActiveStorySave();
        return {
          ...hydrateWithPersistedProfile(createInitialState()),
          phase: 'story_hub',
        };
      }
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(GAME_STORAGE_KEY);
        }
      } catch {
        // Ignore
      }
      clearPhase2Handoff();
      return hydrateWithPersistedProfile(createInitialState());
    }

    default:
      return state;
  }
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  let next = coreGameReducer(state, action);
  if (next.season?.awakenedPlayers) {
    const syncedStarters = applyAwakenedPlayersToSlots(
      next.starters,
      next.season.awakenedPlayers,
    );
    const syncedBench = applyAwakenedPlayersToSlots(
      next.bench,
      next.season.awakenedPlayers,
    );
    if (syncedStarters !== next.starters || syncedBench !== next.bench) {
      next = {
        ...next,
        starters: syncedStarters,
        bench: syncedBench,
      };
    }
  }
  if (
    !next.season ||
    next.season.liveHalftime ||
    !next.season.injuryAutoReturns ||
    next.season.injuryAutoReturns.length === 0 ||
    !next.season.playerConditions
  ) {
    return next;
  }

  const res = resolveAutoReturnInjuredStarters({
    starters: next.starters,
    bench: next.bench,
    conditionMap: next.season.playerConditions,
    autoReturns: next.season.injuryAutoReturns,
    formation: next.formation,
  });

  if (
    res.returnedNotifications.length === 0 &&
    res.remainingAutoReturns.length === next.season.injuryAutoReturns.length
  ) {
    return next;
  }

  return {
    ...next,
    starters: res.starters,
    bench: res.bench,
    season: {
      ...next.season,
      injuryAutoReturns: res.remainingAutoReturns,
      injuryReturnToasts:
        res.returnedNotifications.length > 0
          ? [
              ...(next.season.injuryReturnToasts ?? []),
              ...res.returnedNotifications,
            ]
          : next.season.injuryReturnToasts,
    },
  };
}

const CANONICAL_PLAYERS_BY_ID: Map<string, Player> = (() => {
  const map = new Map<string, Player>();
  for (const p of LEGEND_PLAYERS) map.set(p.id, p);
  for (const p of ACTIVE_PLAYERS) {
    if (!map.has(p.id)) map.set(p.id, p);
  }
  for (const ext of UCL_EXTERNAL_TEAMS) {
    for (const p of ext.roster) {
      if (!map.has(p.id)) map.set(p.id, p);
    }
  }
  return map;
})();

function compactPlayerForStorage(player: Player): Player | { id: string; _ref: 1 } {
  if (!player.isGenerated && CANONICAL_PLAYERS_BY_ID.has(player.id)) {
    return { id: player.id, _ref: 1 };
  }
  return {
    id: player.id,
    name: player.name,
    position: player.position,
    mainPositions: player.mainPositions,
    secondaryPositions: player.secondaryPositions,
    ovr: player.ovr,
    nationality: player.nationality,
    nationalityCode: player.nationalityCode,
    leagueId: player.leagueId,
    club: player.club,
    att: player.att,
    mid: player.mid,
    def: player.def,
    stamina: player.stamina,
    playstyles: player.playstyles,
    scoutNote: '',
    isLegend: player.isLegend,
    ...(player.isGenerated ? { isGenerated: true } : {}),
  };
}

function hydratePlayerFromCatalog(
  raw: Player | { id: string; _ref?: 1 },
): Player | null {
  if (!raw || typeof raw.id !== 'string') return null;
  if ('_ref' in raw && raw._ref === 1) {
    return CANONICAL_PLAYERS_BY_ID.get(raw.id) ?? null;
  }
  const player = raw as Player;
  if (!player.isGenerated) {
    const canonical = CANONICAL_PLAYERS_BY_ID.get(player.id);
    if (canonical) return canonical;
  }
  if (!player.attrs) {
    return { ...player, attrs: getPlayerAttributes(player) };
  }
  return player;
}

function compactRosterMapForStorage(
  rosters: Record<string, Player[]> | undefined,
): Record<string, Player[]> {
  if (!rosters) return {};
  const out: Record<string, (Player | { id: string; _ref: 1 })[]> = {};
  for (const [clubId, list] of Object.entries(rosters)) {
    out[clubId] = list.map(compactPlayerForStorage);
  }
  return out as unknown as Record<string, Player[]>;
}

function hydrateRosterMapFromCatalog(
  rosters: Record<string, Player[]> | undefined,
): Record<string, Player[]> {
  if (!rosters) return {};
  const out: Record<string, Player[]> = {};
  for (const [clubId, list] of Object.entries(rosters)) {
    out[clubId] = (list as (Player | { id: string; _ref?: 1 })[])
      .map(hydratePlayerFromCatalog)
      .filter((p): p is Player => p !== null);
  }
  return out;
}

function compactPlayerStatsMapForStorage(
  map: Record<string, PlayerSeasonStats> | undefined,
  pruneZeroContributionAi = false,
): Record<string, PlayerSeasonStats> {
  if (!map) return {};
  const out: Record<string, PlayerSeasonStats> = {};
  for (const [id, st] of Object.entries(map)) {
    if (st.isUserTeam) {
      out[id] = st;
      continue;
    }
    if (
      st.appearances <= 0 &&
      st.goals <= 0 &&
      st.assists <= 0 &&
      st.cleanSheets <= 0
    ) {
      continue;
    }
    if (
      pruneZeroContributionAi &&
      st.goals <= 0 &&
      st.assists <= 0 &&
      st.cleanSheets <= 0 &&
      st.avgRating < 7.2
    ) {
      continue;
    }
    out[id] = st;
  }
  return out;
}

function compactConditionsForLocalStorage(
  map: PlayerConditionMap | undefined,
  userSquadIds: Set<string>,
): PlayerConditionMap {
  const base = compactConditionMapForStorage(map);
  const out: PlayerConditionMap = {};
  for (const [id, c] of Object.entries(base)) {
    // Preserve full condition state for user squad; for AI players only persist active injury or non-neutral morale
    if (userSquadIds.has(id) || c.injury !== null || c.morale !== 0) {
      out[id] = c;
    }
  }
  return out;
}

function compactMatchResultForStorage(
  result: MatchResult,
  options?: { keepGoalEventsOnly?: boolean; keepPlayerRatings?: boolean },
): MatchResult {
  const keepGoalEventsOnly = Boolean(options?.keepGoalEventsOnly);
  const keepPlayerRatings = Boolean(options?.keepPlayerRatings);
  return {
    ...result,
    events: keepGoalEventsOnly
      ? result.events.filter((e) => e.type === 'goal')
      : [],
    playerRatings: keepPlayerRatings ? result.playerRatings : [],
    extraTime: result.extraTime
      ? {
          ...result.extraTime,
          etEvents: keepGoalEventsOnly
            ? result.extraTime.etEvents.filter((e) => e.type === 'goal')
            : [],
        }
      : undefined,
  };
}

function compactCupForLocalStorage(
  cup: SeasonState['cup'],
): SeasonState['cup'] {
  if (!cup) return cup;
  const compactNodes = (nodes: typeof cup.rounds.r16) =>
    nodes.map((node) => {
      if (!node.result) return node;
      const isUserNode =
        node.homeTeamId === USER_CLUB_ID || node.awayTeamId === USER_CLUB_ID;
      if (isUserNode) return node;
      return {
        ...node,
        result: compactMatchResultForStorage(node.result),
      };
    });
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

function compactUclForLocalStorage(
  ucl: SeasonState['ucl'],
): SeasonState['ucl'] {
  if (!ucl) return ucl;
  const compactTies = (ties: typeof ucl.ties.r16) =>
    ties.map((tie) => {
      const isUserTie =
        tie.teamAId === USER_CLUB_ID || tie.teamBId === USER_CLUB_ID;
      if (isUserTie) return tie;
      return {
        ...tie,
        ...(tie.leg1 ? { leg1: compactMatchResultForStorage(tie.leg1) } : {}),
        ...(tie.leg2 ? { leg2: compactMatchResultForStorage(tie.leg2) } : {}),
      };
    });
  return {
    ...ucl,
    aiRosters: compactRosterMapForStorage(ucl.aiRosters),
    leaguePhaseFixtures: ucl.leaguePhaseFixtures.map((f) =>
      f.played && f.result
        ? {
            id: f.id,
            round: f.round,
            homeTeamId: f.homeTeamId,
            awayTeamId: f.awayTeamId,
            played: true,
          }
        : f,
    ),
    ties: {
      playoff: compactTies(ucl.ties.playoff),
      r16: compactTies(ucl.ties.r16),
      qf: compactTies(ucl.ties.qf),
      sf: compactTies(ucl.ties.sf),
      final: compactTies(ucl.ties.final),
    },
  };
}

function compactOtherLeaguesForLocalStorage(
  otherLeagues: SeasonState['otherLeagues'],
): SeasonState['otherLeagues'] {
  if (!otherLeagues) return otherLeagues;
  const out: SeasonState['otherLeagues'] = {};
  for (const [lid, lg] of Object.entries(otherLeagues) as [
    LeagueId,
    SeasonState['otherLeagues'][LeagueId],
  ][]) {
    if (!lg) continue;
    out[lid] = {
      ...lg,
      aiRosters: compactRosterMapForStorage(lg.aiRosters),
      fixtures: lg.fixtures.filter((f) => !f.played),
      playerStats: compactPlayerStatsMapForStorage(lg.playerStats, true),
      cupPlayerStats: compactPlayerStatsMapForStorage(lg.cupPlayerStats, true),
    };
  }
  return out;
}

/**
 * Compacts GameState for localStorage persistence so a full 38R + 4-league + Cup + UCL
 * season stays well under the 5MB browser quota (preventing silent QuotaExceededError
 * save failures that previously rolled users back to earlier rounds on refresh).
 * Deliberately preserves in-progress `liveHalftime` (including `streamAutoMode`) so
 * refreshing mid-match can NEVER cancel a losing match.
 */
export function compactGameStateForStorage(
  state: GameState,
  options?: { aggressive?: boolean },
): GameState {
  if (!state.season) return state;
  const aggressive = Boolean(options?.aggressive);
  const season = state.season;
  const userSquadIds = getAllSquadIds(state.starters, state.bench);

  const compactUserHistory = (history: MatchResult[]) => {
    const keepFullCount = aggressive ? 2 : 6;
    if (history.length <= keepFullCount) return history;
    const cutoff = history.length - keepFullCount;
    return history.map((m, idx) =>
      idx < cutoff
        ? compactMatchResultForStorage(m, {
            keepGoalEventsOnly: true,
            keepPlayerRatings: false,
          })
        : m,
    );
  };

  const sanitizedSeason: SeasonState = {
    ...season,
    aiRosters: compactRosterMapForStorage(season.aiRosters),
    fixtures: season.fixtures.map((f) =>
      f.played && f.result
        ? {
            id: f.id,
            round: f.round,
            homeTeamId: f.homeTeamId,
            awayTeamId: f.awayTeamId,
            played: true,
          }
        : f,
    ),
    otherLeagues: compactOtherLeaguesForLocalStorage(season.otherLeagues),
    allPlayerStats: compactPlayerStatsMapForStorage(season.allPlayerStats, aggressive),
    cup: compactCupForLocalStorage(season.cup),
    cupPlayerStats: compactPlayerStatsMapForStorage(season.cupPlayerStats, true),
    ucl: compactUclForLocalStorage(season.ucl),
    uclPlayerStats: compactPlayerStatsMapForStorage(season.uclPlayerStats, true),
    userMatchHistory: compactUserHistory(season.userMatchHistory),
    userCupMatchHistory: compactUserHistory(season.userCupMatchHistory),
    userUclMatchHistory: compactUserHistory(season.userUclMatchHistory),
    ...(season.playerConditions
      ? {
          playerConditions: compactConditionsForLocalStorage(
            season.playerConditions,
            userSquadIds,
          ),
        }
      : {}),
  };

  return {
    ...state,
    season: sanitizedSeason,
  };
}

export function persistGameStateToStorage(state: GameState): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  // Never clobber normal career save when browsing Story Hub or Setup
  if (state.phase === 'story_hub' || state.phase === 'story_setup') {
    return true;
  }
  const targetKey = state.storyMode ? STORY_ACTIVE_SAVE_KEY : GAME_STORAGE_KEY;
  try {
    const compact = compactGameStateForStorage(state);
    window.localStorage.setItem(targetKey, JSON.stringify(compact));
    return true;
  } catch {
    try {
      const aggressive = compactGameStateForStorage(state, { aggressive: true });
      window.localStorage.setItem(targetKey, JSON.stringify(aggressive));
      return true;
    } catch {
      return false;
    }
  }
}

export function loadSavedStoryGameState(): GameState | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(STORY_ACTIVE_SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GameState;
    if (!parsed || !parsed.storyMode || !parsed.season) return null;
    parsed.manager.avatar = normalizeManagerAvatar(parsed.manager.avatar);
    // Hydrate any missing player attrs cleanly without mapping to 26-27 static DB
    const ensureAttrs = (p: Player | null): Player | null => {
      if (!p) return null;
      return p.attrs ? p : { ...p, attrs: getPlayerAttributes(p) };
    };
    parsed.starters = parsed.starters.map(ensureAttrs);
    parsed.bench = parsed.bench.map(ensureAttrs);
    if (parsed.season.aiRosters) {
      const nextAi: Record<string, Player[]> = {};
      for (const [cid, list] of Object.entries(parsed.season.aiRosters)) {
        nextAi[cid] = list
          .map((pl) => ensureAttrs(pl))
          .filter((pl): pl is Player => pl !== null);
      }
      parsed.season.aiRosters = nextAi;
    }
    const sanitizeClubTactics = (c: Club): Club => ({
      ...c,
      defaultTactic: sanitizeStoryTacticId(c.defaultTactic),
      ...(c.manager
        ? {
            manager: {
              ...c.manager,
              ...(c.manager.preferredTactics
                ? {
                    preferredTactics: c.manager.preferredTactics.map((t) =>
                      sanitizeStoryTacticId(t),
                    ),
                  }
                : {}),
            },
          }
        : {}),
    });
    if (parsed.season.clubs) {
      parsed.season.clubs = parsed.season.clubs.map(sanitizeClubTactics);
    }
    if (parsed.season.ucl?.clubs) {
      parsed.season.ucl = {
        ...parsed.season.ucl,
        clubs: parsed.season.ucl.clubs.map(sanitizeClubTactics),
      };
    }
    if (parsed.storyMode.transferPoolClubs) {
      parsed.storyMode.transferPoolClubs = parsed.storyMode.transferPoolClubs.map(
        (entry) => ({
          ...entry,
          club: sanitizeClubTactics(entry.club),
          roster: entry.roster
            .map((pl) => ensureAttrs(pl))
            .filter((pl): pl is Player => pl !== null),
        }),
      );
    }
    if (parsed.storyMode.uclR16Prepared?.aiRosters) {
      const nextPrepAi: Record<string, Player[]> = {};
      for (const [cid, list] of Object.entries(
        parsed.storyMode.uclR16Prepared.aiRosters,
      )) {
        nextPrepAi[cid] = list
          .map((pl) => ensureAttrs(pl))
          .filter((pl): pl is Player => pl !== null);
      }
      parsed.storyMode.uclR16Prepared = {
        ...parsed.storyMode.uclR16Prepared,
        clubs: parsed.storyMode.uclR16Prepared.clubs.map(sanitizeClubTactics),
        aiRosters: nextPrepAi,
      };
    }
    // Migrate v10.0.1/v10.1.0 single-window schedule [99,17|19,99] to unified 3-window schedule [9,17,25] / [10,19,28]
    const standardWindows: [number, number, number] =
      parsed.season.totalRounds <= 34 ? [9, 17, 25] : [10, 19, 28];
    if (
      !parsed.season.transferWindows ||
      parsed.season.transferWindows[0] === 99 ||
      parsed.season.transferWindows[2] === 99
    ) {
      parsed.season.transferWindows = standardWindows;
    }
    parsed.storyMode.winterMaxSignings = undefined;
    parsed.storyMode.allowUclTransferWindow = parsed.storyMode.hasUcl;
    if (
      parsed.storyMode.missionTargets &&
      Object.keys(parsed.storyMode.missionTargets).length === 0
    ) {
      parsed.storyMode.missionKeyPlayerIds = [];
    }
    if (parsed.season.budgetState) {
      parsed.season.budgetState = {
        ...parsed.season.budgetState,
        window1MaxAttempts: 3,
        window2MaxAttempts: 3,
        window3MaxAttempts: 3,
      };
    }
    // Purge any stale modern/generated incoming offers from pre-v10.0.1 open transfer windows
    if (parsed.season.transferMarket?.isOpen) {
      const hasLeak = (parsed.season.transferMarket.incomingOffers ?? []).some(
        (off) =>
          !isStoryEraClubId(off.club.id) ||
          off.aiOffersPlayers.some(
            (p) => Boolean(p.isGenerated) || !isStoryEraPlayerId(p.id),
          ),
      );
      if (hasLeak) {
        const userRank = getUserRank(parsed.season.standings, USER_CLUB_ID);
        parsed.season.transferMarket = {
          ...parsed.season.transferMarket,
          incomingOffers: generateIncomingTradeOffers({
            windowIndex: parsed.season.transferMarket.windowIndex,
            currentRound: parsed.season.currentRound,
            userLeagueId: parsed.season.leagueId,
            userRank,
            userStarters: parsed.starters,
            userBench: parsed.bench,
            standings: parsed.season.standings,
            otherLeagues: parsed.season.otherLeagues,
            aiRosters: parsed.season.aiRosters,
            allPlayerStats: parsed.season.allPlayerStats,
            conditionMap: parsed.season.playerConditions,
            departedPlayerIds: parsed.season.departedPlayerIds ?? [],
            storyTransferPool: parsed.storyMode.transferPoolClubs,
          }),
        };
      }
    }
    if (parsed.season.liveHalftime) {
      const committed = gameReducer(parsed, { type: 'COMMIT_LIVE_MATCH' });
      persistGameStateToStorage(committed);
      return committed;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function loadSavedGameState(): GameState {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return createInitialState();
    }
    const raw = window.localStorage.getItem(GAME_STORAGE_KEY);
    if (!raw) return hydrateWithPersistedProfile(createInitialState());
    const parsed = JSON.parse(raw) as GameState;
    if (
      parsed &&
      parsed.phase &&
      parsed.manager &&
      Array.isArray(parsed.starters)
    ) {
      // Backfill v2.3/v2.4 manager profile fields (including gender) for existing saves
      if (typeof parsed.manager.name !== 'string') {
        parsed.manager.name = DEFAULT_MANAGER_NAME;
      }
      parsed.manager.avatar = normalizeManagerAvatar(parsed.manager.avatar);
      if (
        !Array.isArray(parsed.draftLeaguePool) ||
        parsed.draftLeaguePool.length === 0
      ) {
        parsed.draftLeaguePool = [...ALL_LEAGUE_IDS];
      }

      // Re-canonicalize squad players against static catalog & reject duplicate player IDs.
      // Preserve verified v9.0 permanent potential awakenings onto fresh clones (never mutating static DB).
      const rawAwakenedMap =
        parsed.season?.awakenedPlayers &&
        typeof parsed.season.awakenedPlayers === 'object'
          ? parsed.season.awakenedPlayers
          : {};
      const validAwakenedMap: Record<string, PlayerAwakeningRecord> = {};
      let validAwakenedCount = 0;

      const seenSquadIds = new Set<string>();
      const sanitizeSquadSlot = (p: Player | null): Player | null => {
        if (!p) return null;
        const hydrated = hydratePlayerFromCatalog(p);
        if (!hydrated || seenSquadIds.has(hydrated.id)) return null;
        seenSquadIds.add(hydrated.id);
        const rec = rawAwakenedMap[hydrated.id] ?? p.awakening;
        if (
          rec &&
          validAwakenedCount < AWAKENING_MAX_VALID_PER_TEAM &&
          isValidAwakeningRecord(hydrated, rec)
        ) {
          validAwakenedCount += 1;
          validAwakenedMap[hydrated.id] = rec;
          return applyAwakeningToPlayer(hydrated, rec);
        }
        return hydrated;
      };
      parsed.starters = parsed.starters.map(sanitizeSquadSlot);
      if (Array.isArray(parsed.bench)) {
        parsed.bench = parsed.bench.map(sanitizeSquadSlot);
      }

      if (parsed.season) {
        if (!Array.isArray(parsed.season.departedPlayerIds)) {
          parsed.season.departedPlayerIds = [];
        }
        const savedOwnedIds = new Set<string>(seenSquadIds);
        const savedExcludeIds = new Set<string>([
          ...savedOwnedIds,
          ...parsed.season.departedPlayerIds,
        ]);

        parsed.season.aiRosters = sanitizeRosterMapForUser({
          rosters: hydrateRosterMapFromCatalog(parsed.season.aiRosters),
          clubs: parsed.season.clubs ?? [],
          defaultLeagueId: parsed.season.leagueId,
          ownedIds: savedOwnedIds,
          excludeIds: savedExcludeIds,
        });
        if (!parsed.season.otherLeagues) {
          const initOther = createOtherLeaguesState(
            parsed.season.leagueId,
            savedExcludeIds,
          );
          parsed.season.otherLeagues = advanceOtherLeaguesToProgress(
            initOther,
            parsed.season.currentRound,
            parsed.season.totalRounds,
            Math.random,
            savedExcludeIds,
          );
        } else {
          for (const lg of Object.values(parsed.season.otherLeagues)) {
            if (lg && lg.aiRosters) {
              lg.aiRosters = sanitizeRosterMapForUser({
                rosters: hydrateRosterMapFromCatalog(lg.aiRosters),
                clubs: lg.clubs ?? [],
                defaultLeagueId: lg.leagueId,
                ownedIds: savedOwnedIds,
                excludeIds: savedExcludeIds,
              });
            }
          }
        }
        // Backfill Phase 2 fields for older v5 saves
        if (parsed.season.cup === undefined) parsed.season.cup = null;
        if (!parsed.season.cupPlayerStats) parsed.season.cupPlayerStats = {};
        if (!Array.isArray(parsed.season.userCupMatchHistory)) {
          parsed.season.userCupMatchHistory = [];
        }
        if (parsed.season.ucl === undefined) {
          parsed.season.ucl = null;
        } else if (parsed.season.ucl) {
          const uclLeagueByClubId = new Map<string, LeagueId>();
          for (const t of parsed.season.ucl.teams ?? []) {
            if (t.originLeagueId !== 'other') {
              uclLeagueByClubId.set(t.club.id, t.originLeagueId);
            }
          }
          parsed.season.ucl.aiRosters = sanitizeRosterMapForUser({
            rosters: hydrateRosterMapFromCatalog(parsed.season.ucl.aiRosters),
            clubs: parsed.season.ucl.clubs ?? [],
            leagueIdByClubId: uclLeagueByClubId,
            defaultLeagueId: parsed.season.leagueId,
            ownedIds: savedOwnedIds,
            excludeIds: savedExcludeIds,
          });
        }
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
        // Backfill v9.0 Season Depth fields for legacy saves (zero-breakage fallback)
        if (!parsed.season.budgetState) {
          parsed.season.budgetState = createDefaultSeasonBudgetState();
        }
        if (!parsed.season.tacticalAdaptation) {
          parsed.season.tacticalAdaptation = createInitialTacticalAdaptationState();
        }
        if (!parsed.season.staffCoach) {
          parsed.season.staffCoach = createInitialStaffCoachState();
        }
        parsed.season.awakenedPlayers = validAwakenedMap;
        if (!Array.isArray(parsed.season.pendingAwakeningAlerts)) {
          parsed.season.pendingAwakeningAlerts = [];
        }
        // Migrate legacy v2.4 `user::${id}` stat keys into unified single-player keys
        parsed.season.allPlayerStats = normalizeLegacyPlayerStatsMap(
          parsed.season.allPlayerStats,
        );
        parsed.season.cupPlayerStats = normalizeLegacyPlayerStatsMap(
          parsed.season.cupPlayerStats,
        );
        parsed.season.uclPlayerStats = normalizeLegacyPlayerStatsMap(
          parsed.season.uclPlayerStats,
        );

        // Anti-save-scum: if user refreshed or exited mid-match (whether auto-sim stream
        // OR 2D live broadcast), immediately simulate remaining time and commit the result!
        if (parsed.season.liveHalftime) {
          const committed = gameReducer(parsed, { type: 'COMMIT_LIVE_MATCH' });
          persistGameStateToStorage(committed);
          return committed;
        }
      }
      if (parsed.phase === 'title' && hasSavedActiveUserProfile()) {
        return hydrateWithPersistedProfile(parsed);
      }
      return parsed;
    }
    return hydrateWithPersistedProfile(createInitialState());
  } catch {
    return hydrateWithPersistedProfile(createInitialState());
  }
}

export type LegacyModalTab = 'hof' | 'global_top15' | 'achievements';

interface GameContextValue {
  state: GameState;
  activeTactic: TacticId;
  chemistry: ChemistryResult;
  ratings: TeamRatings;
  legacyState: LegacyStorageState;
  legacyModalOpen: boolean;
  legacyModalInitialTab: LegacyModalTab;
  setLegacyModalOpen: (open: boolean) => void;
  openLegacyModal: (tab?: LegacyModalTab) => void;
  dreamMatchOpen: boolean;
  dreamMatchInitialOpponentId: string | null;
  dreamMatchGlobalOpponent: GlobalHofRankingEntry | null;
  openDreamMatch: (opponentId?: string | null) => void;
  openDreamMatchWithGlobalOpponent: (entry: GlobalHofRankingEntry) => void;
  closeDreamMatch: () => void;
  globalTop15Celebration: GlobalTop15CelebrationPayload | null;
  dismissGlobalTop15Celebration: () => void;
  lastGlobalSubmitResult: {
    runId: string;
    result: GlobalRankingSubmitResult;
  } | null;
  globalRankingsVersion: number;
  submitHallOfFameEntryToGlobal: (
    entry: HallOfFameEntry,
    options?: { triggerCelebration?: boolean },
  ) => Promise<GlobalRankingSubmitResult>;
  multiplayerOpen: boolean;
  soloTickerPlaying: boolean;
  setSoloTickerPlaying: (playing: boolean) => void;
  multiplayerInitialRoomCode: string | null;
  openMultiplayer: (roomCode?: string | null) => void;
  closeMultiplayer: () => void;
  recordDreamMatchOutcome: (params: {
    historicalTeamId: string;
    outcome: 'W' | 'D' | 'L';
    scoreLabel: string;
  }) => void;
  recentUnlocks: string[];
  dismissUnlockToast: (achievementId: string) => void;
  removeHallOfFameEntry: (entryId: string) => void;
  archiveCurrentSeasonNow: () => void;
  startNewCareer: () => void;
  proceedToManagerRoulette: () => void;
  backToClubSetup: () => void;
  goToManagerRoulette: () => void;
  applyUserProfile: (payload: {
    clubProfile: UserClubProfile;
    managerName: string;
    managerAvatar: ManagerAvatarConfig;
  }) => void;
  updateManagerProfile: (patch: {
    name?: string;
    avatar?: Partial<ManagerAvatarConfig>;
  }) => void;
  selectManagerTrait: (traitId: ManagerTraitId) => void;
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
    etTactic?: TacticId;
    extraSub?: { starterIndex: number; benchIndex: number };
    firstHalfStarters?: Player[];
    halftimeSubIds?: string[];
  }) => void;
  enterEtHalftimeLocker: () => void;
  startEtSecondHalfBroadcast: (params?: {
    etTactic?: TacticId;
    firstHalfStarters?: Player[];
    halftimeSubIds?: string[];
  }) => void;
  enterPenaltyShootout: () => void;
  commitLiveMatch: (secondHalfTactic?: TacticId) => void;
  startSoloStreamMatch: () => void;
  enterLiveBroadcastFromStream: (minute: number, inPenalties?: boolean) => void;
  cancelSoloStreamMatch: () => void;
  abortStreamAndStartLive2D: (opts?: {
    minute?: number;
    inPenalties?: boolean;
  }) => void;
  simulateSingleMatchInstant: () => void;
  simulateOneFastRound: (stopAtTransfer: boolean, stopAtCup?: boolean) => void;
  simulateToNextTransfer: () => void;
  skipToSeasonEnd: () => void;
  transferSpinClubs: () => void;
  transferSubmitOffer: (
    target: TransferTargetPlayer,
    outSlot: { area: 'starter' | 'bench'; index: number },
    cashOfferM?: number,
  ) => void;
  tradeSubmitPackage: (payload: {
    partnerClub: Club;
    partnerLeagueId: LeagueId;
    partnerClubRank: number;
    partnerLeagueSize: number;
    userSentSlots: { area: 'starter' | 'bench'; index: number }[];
    aiTargetPlayers: Player[];
    aiFillerPlayers?: Player[];
    cashOfferM?: number;
  }) => void;
  tradeAcceptIncoming: (offerId: string) => void;
  tradeRejectIncoming: (offerId: string) => void;
  transferCloseWindow: () => void;
  hireStaffCoach: (coachId: StaffCoachId) => void;
  skipStaffCoach: () => void;
  dismissFfpOpeningNotice: () => void;
  dismissAdaptationAlert: () => void;
  dismissAwakeningAlert: () => void;
  markCupCelebrated: () => void;
  enterUclMode: () => void;
  simulateUclLeaguePhaseToEnd: () => void;
  simulateUclPlayoffBye: () => void;
  simulateUclToEnd: () => void;
  skipUclToFinalSummary: () => void;
  finishUclToSummary: () => void;
  resolveManagerEvent: (choiceId: string) => void;
  dismissManagerEventResolution: () => void;
  dismissInjuryAlerts: (autoReturnsToAdd?: InjuryAutoReturnEntry[]) => void;
  autoReplaceInjuredStarter: (
    starterSlotIndex: number,
    benchIndex: number,
    playerId: string,
  ) => void;
  dismissInjuryReturnToast: (id?: string) => void;
  resetGame: () => void;
  // Story Mode state & actions (fully isolated from normal career & global ranking)
  storyCodex: StoryCodexStorage;
  storyChecklist: StoryChecklistSummary | null;
  storyLastNewBest: boolean;
  activeStorySaveAvailable: boolean;
  openStoryHub: () => void;
  enterStorySetup: (bundle: StoryScenarioDataBundle) => void;
  setStoryManagerTrait: (traitId: ManagerTraitId) => void;
  startStorySeason: () => void;
  resumeStorySave: () => boolean;
  exitStoryToTitle: () => void;
  abandonStorySave: () => void;
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
  const [storyCodex, setStoryCodex] = useState<StoryCodexStorage>(() =>
    loadStoryCodex(),
  );
  const [storyLastNewBest, setStoryLastNewBest] = useState(false);
  const [activeStorySaveAvailable, setActiveStorySaveAvailable] = useState<boolean>(() =>
    hasActiveStorySave(),
  );
  const activeStoryBundleRef = useRef<StoryScenarioDataBundle | null>(null);
  const [legacyModalOpen, setLegacyModalOpen] = useState(false);
  const [legacyModalInitialTab, setLegacyModalInitialTab] =
    useState<LegacyModalTab>('hof');
  const [dreamMatchOpen, setDreamMatchOpen] = useState(false);
  const [dreamMatchInitialOpponentId, setDreamMatchInitialOpponentId] =
    useState<string | null>(null);
  const [dreamMatchGlobalOpponent, setDreamMatchGlobalOpponent] =
    useState<GlobalHofRankingEntry | null>(null);
  const [globalTop15Celebration, setGlobalTop15Celebration] =
    useState<GlobalTop15CelebrationPayload | null>(null);
  const [lastGlobalSubmitResult, setLastGlobalSubmitResult] = useState<{
    runId: string;
    result: GlobalRankingSubmitResult;
  } | null>(null);
  const [globalRankingsVersion, setGlobalRankingsVersion] = useState(0);
  const inFlightGlobalSubmitRef = useRef<Set<string>>(new Set());
  const [multiplayerInitialRoomCode, setMultiplayerInitialRoomCode] =
    useState<string | null>(() => extractRoomCodeFromUrl());
  const [multiplayerOpen, setMultiplayerOpen] = useState<boolean>(() =>
    Boolean(extractRoomCodeFromUrl()),
  );
  const [soloTickerPlaying, setSoloTickerPlaying] = useState(false);
  const [recentUnlocks, setRecentUnlocks] = useState<string[]>([]);

  const latestStateRef = useRef<GameState>(state);

  // Persist synchronously right after React commits (before browser paint) so a quick refresh
  // after spinning roulette, transferring, or finishing a match can NEVER roll back to the past.
  useLayoutEffect(() => {
    latestStateRef.current = state;
    persistGameStateToStorage(state);
    if (state.storyMode && state.season) {
      setActiveStorySaveAvailable(true);
    }
  }, [state]);

  // Safety flush on tab close / mobile browser refresh / backgrounding
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const flushNow = () => {
      persistGameStateToStorage(latestStateRef.current);
    };
    window.addEventListener('pagehide', flushNow);
    window.addEventListener('beforeunload', flushNow);
    return () => {
      window.removeEventListener('pagehide', flushNow);
      window.removeEventListener('beforeunload', flushNow);
    };
  }, []);

  const activeTactic: TacticId =
    state.season?.nextMatchTactic ??
    state.season?.defaultTactic ??
    state.defaultTactic;
  const activeStaffCoachId = state.season?.staffCoach?.hiredCoachId ?? null;
  const activeFfpChemPenalty = state.season?.budgetState?.chemPenalty ?? 0;

  const chemistry = useMemo(
    () =>
      calculateChemistry(
        state.formation,
        state.starters,
        activeTactic,
        state.manager.traitId,
        undefined,
        {
          staffCoachId: activeStaffCoachId,
          ffpChemPenalty: activeFfpChemPenalty,
        },
      ),
    [
      state.formation,
      state.starters,
      activeTactic,
      state.manager.traitId,
      activeStaffCoachId,
      activeFfpChemPenalty,
    ],
  );

  const ratings = useMemo(
    () =>
      calculateTeamRatings(
        state.formation,
        state.starters,
        chemistry.total,
        state.manager.traitId,
        chemistry.slotSynergies,
        activeTactic,
        activeStaffCoachId,
      ),
    [
      state.formation,
      state.starters,
      chemistry.total,
      chemistry.slotSynergies,
      state.manager.traitId,
      activeTactic,
      activeStaffCoachId,
    ],
  );

  // Real-time 24 Hidden Achievements evaluation + instant unlock toast notifications
  // Hard isolation: Story Mode runs NEVER unlock regular Legacy Achievements!
  useEffect(() => {
    if (state.storyMode || !state.season) return;
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
    state.storyMode,
    state.season,
    state.starters,
    state.bench,
    state.userClub.name,
    ratings.rawOvr,
    chemistry.total,
  ]);

  const submitHallOfFameEntryToGlobal = useCallback(
    async (
      entry: HallOfFameEntry,
      options?: { triggerCelebration?: boolean },
    ): Promise<GlobalRankingSubmitResult> => {
      const effectiveRunId = (entry.runId ?? entry.id).trim();
      if (inFlightGlobalSubmitRef.current.has(effectiveRunId)) {
        return {
          ok: false,
          entered: false,
          rank: null,
          alreadyExists: true,
          cutoffScore: null,
          totalCount: 0,
          prunedCount: 0,
          error: '이미 제출 중입니다.',
        };
      }
      inFlightGlobalSubmitRef.current.add(effectiveRunId);
      try {
        const res = await submitGlobalHofRanking(entry);
        setLastGlobalSubmitResult({ runId: effectiveRunId, result: res });
        if (res.ok && res.entered && res.rank !== null) {
          setGlobalRankingsVersion((v) => v + 1);
          if (
            options?.triggerCelebration &&
            !res.alreadyExists &&
            !hasCelebratedGlobalTop15(effectiveRunId)
          ) {
            markGlobalTop15Celebrated(effectiveRunId);
            setGlobalTop15Celebration({
              runId: effectiveRunId,
              rank: res.rank,
              totalScore: Math.round(entry.seasonScore.totalScore),
              grade: entry.seasonScore.grade,
              clubName: entry.userClub.name,
              managerName: entry.managerName ?? DEFAULT_MANAGER_NAME,
              trophies: entry.trophies,
              isTreble: entry.isTreble,
              uclWon: entry.uclWon,
              isLeagueChampion: entry.isLeagueChampion,
              cupWon: entry.cupWon,
              prunedCount: res.prunedCount,
            });
          }
        }
        return res;
      } finally {
        inFlightGlobalSubmitRef.current.delete(effectiveRunId);
      }
    },
    [],
  );

  const archiveCurrentSeasonNow = useCallback(() => {
    // Hard isolation: Story Mode runs NEVER archive to regular Hall of Fame or submit to Global Daily Rankings
    if (state.storyMode || !state.season || state.season.legacyArchived) return;
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

    const filledStarters = state.starters.filter((p): p is Player => p !== null);
    const slotSynValues = Object.values(chemistry.slotSynergies);
    const avgSynergyOvrBonus =
      slotSynValues.length > 0
        ? Math.round(
            (slotSynValues.reduce((sum, s) => sum + s.totalBonus, 0) /
              slotSynValues.length) *
              100,
          ) / 100
        : 0;
    const managerSynergyCount = filledStarters.filter(
      (p) => evaluateManagerPlayerSynergy(p, state.manager.traitId).isMatch,
    ).length;
    const userRow = state.season.standings.find((r) => r.teamId === USER_CLUB_ID);
    const played = Math.max(1, userRow?.played ?? state.season.totalRounds);
    const managerRating = computeUserSeasonManagerRating({
      finalLeagueRank: getUserRank(state.season.standings, USER_CLUB_ID),
      wonCup: didUserWinCup(state.season.cup, USER_CLUB_ID),
      wonUcl: didUserWinUcl(state.season.ucl, USER_CLUB_ID),
      leagueLosses: userRow?.lost ?? 0,
      leaguePlayed: played,
      converted38Points: ((userRow?.points ?? 0) / played) * 38,
      chemistry: chemistry.total,
      managerSynergyCount,
    });

    const effectiveRunId = state.season.runId || generateSeasonRunId();
    const effectiveTotalOvr =
      Math.round(
        ((ratings.effectiveAtt + ratings.effectiveMid + ratings.effectiveDef) /
          3) *
          10,
      ) / 10;
    const staffCoachId = state.season.staffCoach?.hiredCoachId ?? null;
    const teamStory = generateSoloSeasonTeamStory({
      userClubName: state.userClub.name,
      managerName: state.manager.name,
      managerTraitId: state.manager.traitId,
      managerRating,
      staffCoachId,
      formation: state.formation,
      tactic: state.season.defaultTactic,
      leagueName: getLeagueById(state.season.leagueId).koreanName,
      clubs: state.season.clubs,
      standings: state.season.standings,
      fixtures: state.season.fixtures,
      totalRounds: state.season.totalRounds,
      userMatchHistory: state.season.userMatchHistory,
      userCupMatchHistory: state.season.userCupMatchHistory,
      userUclMatchHistory: state.season.userUclMatchHistory,
      cup: state.season.cup,
      ucl: state.season.ucl,
      starters: state.starters,
      bench: state.bench,
      combinedStatsMap: combinedStats,
      baseAvgOvr: ratings.rawOvr,
      effectiveOvr: effectiveTotalOvr,
      chemistry: chemistry.total,
      ffpTier: state.season.budgetState?.ffpTier,
      tacticalAdaptation: state.season.tacticalAdaptation ?? null,
      tradeHistory: state.season.transferMarket?.tradeHistory ?? [],
      storyCrisisLog: state.season.storyCrisisLog ?? null,
      managerSynergyCount,
    });

    const updated = archiveSeasonToHallOfFame({
      runId: effectiveRunId,
      draftLeaguePool: state.draftLeaguePool,
      userClub: state.userClub,
      managerName: state.manager.name,
      managerAvatar: state.manager.avatar,
      managerTraitId: state.manager.traitId,
      managerRating,
      staffCoachId,
      leagueId: state.season.leagueId,
      formation: state.formation,
      defaultTactic: state.season.defaultTactic,
      standings: state.season.standings,
      totalRounds: state.season.totalRounds,
      cup: state.season.cup,
      ucl: state.season.ucl,
      teamAvgOvr: ratings.rawOvr,
      chemistry: chemistry.total,
      avgSynergyOvrBonus,
      managerSynergyCount,
      seasonScore: score,
      awards: state.season.awards,
      globalAwards: state.season.globalAwards ?? null,
      matchHistory,
      teamStory,
      starters: state.starters,
      bench: state.bench,
      combinedPlayerStats: combinedStats,
      unlockedAchievementIds: earnedIds,
    });
    setLegacyState(updated);
    dispatch({ type: 'MARK_LEGACY_ARCHIVED' });

    const archivedEntry =
      updated.hallOfFame.find((e) => (e.runId ?? e.id) === effectiveRunId) ??
      updated.hallOfFame[0];
    if (archivedEntry && isFullFiveLeagueDraftPool(state.draftLeaguePool)) {
      void submitHallOfFameEntryToGlobal(archivedEntry, {
        triggerCelebration: true,
      });
    }
  }, [state, ratings, chemistry, submitHallOfFameEntryToGlobal]);

  // Auto-archive completed runs into Hall of Fame ONLY when reaching historical-team caliber
  // (score >= 6,500, S+ grade, UCL title, or Treble). Other seasons can be manually registered from SeasonSummary.
  useEffect(() => {
    if (
      state.storyMode ||
      state.phase !== 'season_end' ||
      !state.season ||
      state.season.legacyArchived
    ) {
      return;
    }
    const uclDone = Boolean(state.season.ucl?.completed);
    if (!uclDone) return;

    const score =
      state.season.seasonScore ?? computeSeasonScoreFromState(state);
    if (!score) return;

    const wonLeague =
      getUserRank(state.season.standings, USER_CLUB_ID) === 1;
    const wonCup = didUserWinCup(state.season.cup, USER_CLUB_ID);
    const wonUcl = didUserWinUcl(state.season.ucl, USER_CLUB_ID);
    const isTreble = wonLeague && wonCup && wonUcl;

    if (
      isEligibleForAutoHofInduction({
        seasonScore: score,
        wonUcl,
        isTreble,
      })
    ) {
      const timer = window.setTimeout(() => {
        archiveCurrentSeasonNow();
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [state, archiveCurrentSeasonNow]);

  const storyChecklist = useMemo<StoryChecklistSummary | null>(() => {
    if (!state.storyMode || !state.season) return null;
    return evaluateStoryChecklist({
      storyMode: state.storyMode,
      season: state.season,
      starters: state.starters,
      bench: state.bench,
    });
  }, [state.storyMode, state.season, state.starters, state.bench]);

  // Automatically record Story Mode completion & stars into isolated Story Codex (NEVER global rankings)
  useEffect(() => {
    if (
      !state.storyMode ||
      !state.season ||
      state.phase !== 'season_end' ||
      state.storyMode.codexRecorded ||
      !storyChecklist
    ) {
      return;
    }
    const uclFinalized = !state.storyMode.hasUcl || Boolean(state.season.ucl?.completed);
    if (!uclFinalized) return;

    const rank = getUserRank(state.season.standings, USER_CLUB_ID);
    const userRow = state.season.standings.find((r) => r.teamId === USER_CLUB_ID);
    const wonCup = didUserWinCup(state.season.cup, USER_CLUB_ID);
    const wonUcl = didUserWinUcl(state.season.ucl, USER_CLUB_ID);
    const meta = getStoryScenarioMeta(state.storyMode.scenarioId);
    const parts: string[] = [
      `${meta.leagueLabel} ${rank}위 (${userRow?.points ?? 0}점)`,
    ];
    if (wonCup) parts.push(`${meta.cupLabel} 우승`);
    if (wonUcl && meta.uclLabel) parts.push(`${meta.uclLabel} 우승`);

    const timer = window.setTimeout(() => {
      const { nextCodex, isNewBest } = recordStoryCompletionInCodex({
        codex: loadStoryCodex(),
        summary: storyChecklist,
        bestSummaryText: parts.join(' · '),
      });
      setStoryCodex(nextCodex);
      setStoryLastNewBest(isNewBest);
      dispatch({ type: 'MARK_STORY_CODEX_RECORDED' });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [state.storyMode, state.season, state.phase, storyChecklist]);

  const openStoryHub = useCallback(() => {
    setActiveStorySaveAvailable(hasActiveStorySave());
    setStoryCodex(loadStoryCodex());
    setStoryLastNewBest(false);
    dispatch({ type: 'OPEN_STORY_HUB' });
  }, []);

  const enterStorySetup = useCallback((bundle: StoryScenarioDataBundle) => {
    activeStoryBundleRef.current = bundle;
    setStoryLastNewBest(false);
    dispatch({ type: 'ENTER_STORY_SETUP', payload: { bundle } });
  }, []);

  const setStoryManagerTrait = useCallback((traitId: ManagerTraitId) => {
    dispatch({ type: 'SET_STORY_MANAGER_TRAIT', payload: { traitId } });
  }, []);

  const startStorySeason = useCallback(() => {
    const bundle = activeStoryBundleRef.current;
    if (!bundle) return;
    setStoryLastNewBest(false);
    dispatch({ type: 'START_STORY_SEASON', payload: { bundle } });
  }, []);

  const resumeStorySave = useCallback((): boolean => {
    const saved = loadSavedStoryGameState();
    if (!saved) {
      setActiveStorySaveAvailable(false);
      return false;
    }
    setStoryLastNewBest(false);
    dispatch({ type: 'RESUME_STORY_SAVE', payload: { savedState: saved } });
    return true;
  }, []);

  const exitStoryToTitle = useCallback(() => {
    setStoryLastNewBest(false);
    dispatch({ type: 'EXIT_STORY_TO_TITLE' });
  }, []);

  const abandonStorySave = useCallback(() => {
    clearActiveStorySave();
    setActiveStorySaveAvailable(false);
  }, []);

  const dismissUnlockToast = useCallback((achievementId: string) => {
    setRecentUnlocks((prev) => prev.filter((id) => id !== achievementId));
  }, []);

  const removeHallOfFameEntry = useCallback((entryId: string) => {
    setLegacyState(deleteHallOfFameEntry(entryId));
  }, []);

  const openLegacyModal = useCallback((tab: LegacyModalTab = 'hof') => {
    setLegacyModalInitialTab(tab);
    setLegacyModalOpen(true);
  }, []);

  const dismissGlobalTop15Celebration = useCallback(() => {
    setGlobalTop15Celebration(null);
  }, []);

  const openDreamMatch = useCallback((opponentId?: string | null) => {
    setLegacyModalOpen(false);
    setMultiplayerOpen(false);
    setDreamMatchGlobalOpponent(null);
    setDreamMatchInitialOpponentId(opponentId ?? null);
    setDreamMatchOpen(true);
  }, []);

  const openDreamMatchWithGlobalOpponent = useCallback(
    (entry: GlobalHofRankingEntry) => {
      setLegacyModalOpen(false);
      setMultiplayerOpen(false);
      setDreamMatchInitialOpponentId(null);
      setDreamMatchGlobalOpponent(entry);
      setDreamMatchOpen(true);
    },
    [],
  );

  const closeDreamMatch = useCallback(() => {
    setDreamMatchOpen(false);
    setDreamMatchInitialOpponentId(null);
    setDreamMatchGlobalOpponent(null);
  }, []);

  const openMultiplayer = useCallback((roomCode?: string | null) => {
    setLegacyModalOpen(false);
    setDreamMatchOpen(false);
    setMultiplayerInitialRoomCode(roomCode ?? null);
    setMultiplayerOpen(true);
  }, []);

  const closeMultiplayer = useCallback(() => {
    setMultiplayerOpen(false);
    setMultiplayerInitialRoomCode(null);
  }, []);

  const recordDreamMatchOutcome = useCallback(
    (params: {
      historicalTeamId: string;
      outcome: 'W' | 'D' | 'L';
      scoreLabel: string;
    }) => {
      setLegacyState(recordDreamMatchResult(params));
    },
    [],
  );

  const value = useMemo<GameContextValue>(
    () => ({
      state,
      activeTactic,
      chemistry,
      ratings,
      legacyState,
      legacyModalOpen,
      legacyModalInitialTab,
      setLegacyModalOpen,
      openLegacyModal,
      dreamMatchOpen,
      dreamMatchInitialOpponentId,
      dreamMatchGlobalOpponent,
      openDreamMatch,
      openDreamMatchWithGlobalOpponent,
      closeDreamMatch,
      globalTop15Celebration,
      dismissGlobalTop15Celebration,
      lastGlobalSubmitResult,
      globalRankingsVersion,
      submitHallOfFameEntryToGlobal,
      multiplayerOpen,
      soloTickerPlaying,
      setSoloTickerPlaying,
      multiplayerInitialRoomCode,
      openMultiplayer,
      closeMultiplayer,
      recordDreamMatchOutcome,
      recentUnlocks,
      dismissUnlockToast,
      removeHallOfFameEntry,
      archiveCurrentSeasonNow,
      startNewCareer: () => dispatch({ type: 'START_NEW_CAREER' }),
      proceedToManagerRoulette: () =>
        dispatch({ type: 'PROCEED_TO_MANAGER_ROULETTE' }),
      backToClubSetup: () => dispatch({ type: 'BACK_TO_CLUB_SETUP' }),
      goToManagerRoulette: () => dispatch({ type: 'GO_TO_MANAGER_ROULETTE' }),
      applyUserProfile: (payload) =>
        dispatch({ type: 'APPLY_USER_PROFILE', payload }),
      updateManagerProfile: (patch) =>
        dispatch({ type: 'UPDATE_MANAGER_PROFILE', payload: patch }),
      selectManagerTrait: (traitId) =>
        dispatch({ type: 'SELECT_MANAGER_TRAIT', payload: { traitId } }),
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
      enterEtHalftimeLocker: () => dispatch({ type: 'ENTER_ET_HALFTIME_LOCKER' }),
      startEtSecondHalfBroadcast: (payload) =>
        dispatch({ type: 'START_ET_SECOND_HALF_BROADCAST', payload }),
      enterPenaltyShootout: () => dispatch({ type: 'ENTER_PENALTY_SHOOTOUT' }),
      commitLiveMatch: (secondHalfTactic) =>
        dispatch({ type: 'COMMIT_LIVE_MATCH', payload: { secondHalfTactic } }),
      startSoloStreamMatch: () => dispatch({ type: 'START_SOLO_STREAM_MATCH' }),
      enterLiveBroadcastFromStream: (minute, inPenalties = false) =>
        dispatch({
          type: 'ENTER_LIVE_BROADCAST_FROM_STREAM',
          payload: { minute, inPenalties },
        }),
      cancelSoloStreamMatch: () => dispatch({ type: 'CANCEL_SOLO_STREAM_MATCH' }),
      abortStreamAndStartLive2D: (opts) =>
        dispatch({ type: 'ABORT_STREAM_AND_START_LIVE_2D', payload: opts }),
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
      transferSubmitOffer: (target, outSlot, cashOfferM) =>
        dispatch({
          type: 'TRANSFER_SUBMIT_OFFER',
          payload: { target, outSlot, cashOfferM },
        }),
      tradeSubmitPackage: (payload) =>
        dispatch({
          type: 'TRADE_SUBMIT_PACKAGE',
          payload,
        }),
      tradeAcceptIncoming: (offerId) =>
        dispatch({
          type: 'TRADE_ACCEPT_INCOMING',
          payload: { offerId },
        }),
      tradeRejectIncoming: (offerId) =>
        dispatch({
          type: 'TRADE_REJECT_INCOMING',
          payload: { offerId },
        }),
      transferCloseWindow: () => dispatch({ type: 'TRANSFER_CLOSE_WINDOW' }),
      hireStaffCoach: (coachId) =>
        dispatch({ type: 'HIRE_STAFF_COACH', payload: { coachId } }),
      skipStaffCoach: () => dispatch({ type: 'SKIP_STAFF_COACH' }),
      dismissFfpOpeningNotice: () =>
        dispatch({ type: 'DISMISS_FFP_OPENING_NOTICE' }),
      dismissAdaptationAlert: () =>
        dispatch({ type: 'DISMISS_ADAPTATION_ALERT' }),
      dismissAwakeningAlert: () =>
        dispatch({ type: 'DISMISS_AWAKENING_ALERT' }),
      markCupCelebrated: () => dispatch({ type: 'MARK_CUP_CELEBRATED' }),
      enterUclMode: () => dispatch({ type: 'ENTER_UCL_MODE' }),
      simulateUclLeaguePhaseToEnd: () =>
        dispatch({ type: 'SIMULATE_UCL_LEAGUE_PHASE_TO_END' }),
      simulateUclPlayoffBye: () =>
        dispatch({ type: 'SIMULATE_UCL_PLAYOFF_BYE' }),
      simulateUclToEnd: () => dispatch({ type: 'SIMULATE_UCL_TO_END' }),
      skipUclToFinalSummary: () =>
        dispatch({ type: 'SKIP_UCL_TO_FINAL_SUMMARY' }),
      finishUclToSummary: () => dispatch({ type: 'FINISH_UCL_TO_SUMMARY' }),
      resolveManagerEvent: (choiceId) =>
        dispatch({ type: 'RESOLVE_MANAGER_EVENT', payload: { choiceId } }),
      dismissManagerEventResolution: () =>
        dispatch({ type: 'DISMISS_MANAGER_EVENT_RESOLUTION' }),
      dismissInjuryAlerts: (autoReturnsToAdd) =>
        dispatch({
          type: 'DISMISS_INJURY_ALERTS',
          payload: autoReturnsToAdd ? { autoReturnsToAdd } : undefined,
        }),
      autoReplaceInjuredStarter: (starterSlotIndex, benchIndex, playerId) =>
        dispatch({
          type: 'AUTO_REPLACE_INJURED_STARTER',
          payload: { starterSlotIndex, benchIndex, playerId },
        }),
      dismissInjuryReturnToast: (id) =>
        dispatch({
          type: 'DISMISS_INJURY_RETURN_TOAST',
          payload: id ? { id } : undefined,
        }),
      resetGame: () => {
        setGlobalTop15Celebration(null);
        setLastGlobalSubmitResult(null);
        dispatch({ type: 'RESET_GAME' });
      },
      storyCodex,
      storyChecklist,
      storyLastNewBest,
      activeStorySaveAvailable,
      openStoryHub,
      enterStorySetup,
      setStoryManagerTrait,
      startStorySeason,
      resumeStorySave,
      exitStoryToTitle,
      abandonStorySave,
    }),
    [
      state,
      activeTactic,
      chemistry,
      ratings,
      legacyState,
      legacyModalOpen,
      legacyModalInitialTab,
      openLegacyModal,
      dreamMatchOpen,
      dreamMatchInitialOpponentId,
      dreamMatchGlobalOpponent,
      openDreamMatch,
      openDreamMatchWithGlobalOpponent,
      closeDreamMatch,
      globalTop15Celebration,
      dismissGlobalTop15Celebration,
      lastGlobalSubmitResult,
      globalRankingsVersion,
      submitHallOfFameEntryToGlobal,
      multiplayerOpen,
      soloTickerPlaying,
      multiplayerInitialRoomCode,
      openMultiplayer,
      closeMultiplayer,
      recordDreamMatchOutcome,
      recentUnlocks,
      dismissUnlockToast,
      removeHallOfFameEntry,
      archiveCurrentSeasonNow,
      storyCodex,
      storyChecklist,
      storyLastNewBest,
      activeStorySaveAvailable,
      openStoryHub,
      enterStorySetup,
      setStoryManagerTrait,
      startStorySeason,
      resumeStorySave,
      exitStoryToTitle,
      abandonStorySave,
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
