import { describe, expect, it } from 'vitest';
import {
  getStoryScenarioMeta,
  loadStoryScenarioBundle,
  STORY_SCENARIOS,
} from '../data/story/storyRegistry';
import { evaluatePostMatchAwakening } from '../engine/awakeningEngine';
import { USER_CLUB_ID } from '../engine/matchEngine';
import {
  createEmptyStoryCodex,
  evaluateStoryChecklist,
  getTotalStoryStars,
  hydrateStoryScenarioBundle,
  recordStoryCompletionInCodex,
  STORY_ACTIVE_SAVE_KEY,
} from '../engine/storyModeEngine';
import { createStoryUclR16State } from '../engine/uclEngine';
import { validateDailyRankingEligibility } from '../services/globalRankingService';
import {
  gameReducer,
  persistGameStateToStorage,
} from '../store/GameContext';
import type { GameState, SeasonState } from '../types/game';
import type { PlayerSeasonStats, StandingRow } from '../types/league';
import type { HallOfFameEntry } from '../types/legacy';

function makeStanding(
  teamId: string,
  points: number,
  lost: number,
  goalsAgainst: number,
  isUser = false,
): StandingRow {
  return {
    teamId,
    teamName: isUser ? 'User Club' : teamId,
    shortName: teamId.slice(0, 3).toUpperCase(),
    primaryColor: '#111111',
    secondaryColor: '#ffffff',
    isUser,
    played: 38,
    won: Math.floor(points / 3),
    drawn: points % 3,
    lost,
    goalsFor: 70,
    goalsAgainst,
    goalDifference: 70 - goalsAgainst,
    points,
    form: ['W', 'W', 'W', 'W', 'W'],
  };
}

function makeStats(
  playerId: string,
  goals: number,
  assists: number,
): PlayerSeasonStats {
  return {
    playerId,
    playerName: playerId,
    teamId: USER_CLUB_ID,
    teamName: 'User Club',
    teamShortName: 'USR',
    teamPrimaryColor: '#000',
    teamSecondaryColor: '#fff',
    isUserTeam: true,
    position: 'MF',
    mainPositions: ['LM'],
    ovr: 81,
    appearances: 35,
    starts: 34,
    subAppearances: 1,
    minutesPlayed: 3000,
    goals,
    assists,
    xgSum: goals * 0.85,
    cleanSheets: 12,
    momCount: 4,
    ratingSum: 255,
    avgRating: 7.3,
    positionCounts: { LM: 34 },
    isLegend: false,
  };
}

describe('Story Mode Phase 1 — Framework, Data Integrity, UCL R16, Checklists & Isolation', () => {
  it('registers all 7 confirmed scenarios with authentic era budgets and explicit transfer rules', () => {
    expect(STORY_SCENARIOS.map((s) => s.id)).toEqual([
      '1516_leicester',
      '0708_manutd',
      '1819_tottenham',
      '0304_arsenal',
      '1314_atletico',
      '2324_leverkusen',
      '0910_inter',
    ]);

    const leicester = getStoryScenarioMeta('1516_leicester');
    expect(leicester.cashBudgetM).toBe(35);
    expect(leicester.transferRule).toBe('standard_3_only');
    expect(leicester.hasUcl).toBe(false);
    expect(leicester.introSlides.length).toBe(3);

    const manutd = getStoryScenarioMeta('0708_manutd');
    expect(manutd.cashBudgetM).toBe(45);
    expect(manutd.winterMaxSignings).toBeUndefined();
    expect(manutd.transferRule).toBe('standard_3_plus_ucl');
    expect(manutd.hasUcl).toBe(true);
    expect(manutd.introSlides.length).toBe(3);

    const arsenal = getStoryScenarioMeta('0304_arsenal');
    expect(arsenal.transferRule).toBe('standard_3_plus_ucl');
    expect(arsenal.winterMaxSignings).toBeUndefined();
    expect(arsenal.allowUclTransferWindow).toBe(true);
    expect(arsenal.transferRuleReason).toContain('룰렛');
  });

  it('hydrates 15-16 Leicester dynamic JSON with 20 EPL clubs + 16 foreign Top-4 clubs and compressed OVR <= 92', async () => {
    const bundle = await loadStoryScenarioBundle('1516_leicester');
    const hydrated = hydrateStoryScenarioBundle(bundle);

    expect(hydrated.domesticClubs).toHaveLength(20);
    expect(hydrated.userStarters).toHaveLength(11);
    expect(hydrated.userBench.length).toBeGreaterThanOrEqual(5);
    // 19 domestic AI + 16 foreign Top 4 across other 4 leagues = 35 clubs
    expect(hydrated.transferPoolClubs).toHaveLength(35);
    const leagueCounts = hydrated.transferPoolClubs.reduce<Record<string, number>>(
      (acc, c) => {
        acc[c.leagueId] = (acc[c.leagueId] ?? 0) + 1;
        return acc;
      },
      {},
    );
    expect(leagueCounts).toEqual({
      epl: 19,
      laliga: 4,
      seriea: 4,
      bundesliga: 4,
      ligue1: 4,
    });
    expect(hydrated.uclR16Prepared).toBeNull();

    const allPlayers = [
      ...hydrated.userStarters,
      ...hydrated.userBench,
      ...hydrated.transferPoolClubs.flatMap((c) => c.roster),
    ];
    for (const p of allPlayers) {
      expect(p.ovr).toBeLessThanOrEqual(92);
      expect(p.isLegend).toBe(false);
      expect(p.attrs).toBeDefined();
    }
  });

  it('hydrates 07-08 Man Utd dynamic JSON with 20 EPL clubs, 35-club 5-league pool, Park Ji-sung focus, and exact 16-team UCL R16', async () => {
    const bundle = await loadStoryScenarioBundle('0708_manutd');
    const hydrated = hydrateStoryScenarioBundle(bundle);

    expect(hydrated.domesticClubs).toHaveLength(20);
    expect(hydrated.transferPoolClubs).toHaveLength(35);
    expect(hydrated.uclR16Prepared).not.toBeNull();
    expect(hydrated.uclR16Prepared!.clubs).toHaveLength(16);
    expect(hydrated.uclR16Prepared!.pairings).toHaveLength(8);

    const park = hydrated.userStarters.find(
      (p) => p.id === bundle.missionTargets.parkId,
    );
    expect(park).toBeDefined();
    expect(park!.name).toBe('박지성');
    expect(park!.ovr).toBe(81);
    expect(park!.stamina).toBe(98);

    // Direct UCL R16 tournament creation starts immediately at r16
    const { ucl } = createStoryUclR16State({
      seasonLabel: hydrated.uclR16Prepared!.seasonLabel,
      userClub: hydrated.userClub,
      userSquad: [...hydrated.userStarters, ...hydrated.userBench],
      clubs: hydrated.uclR16Prepared!.clubs,
      aiRosters: hydrated.uclR16Prepared!.aiRosters,
      pairings: hydrated.uclR16Prepared!.pairings,
      originLabels: hydrated.uclR16Prepared!.originLabels,
    });
    expect(ucl.stage).toBe('r16');
    expect(ucl.isDirectR16).toBe(true);
    expect(ucl.leaguePhaseFixtures).toHaveLength(0);
    expect(ucl.ties.playoff).toHaveLength(0);
    expect(ucl.ties.r16).toHaveLength(8);
  });

  it('disables AUTO_OPTIMIZE_LINEUP in Story Mode while allowing manual START_STORY_SEASON', async () => {
    const bundle = await loadStoryScenarioBundle('1516_leicester');
    const setupState = gameReducer({} as GameState, {
      type: 'ENTER_STORY_SETUP',
      payload: { bundle },
    });
    expect(setupState.phase).toBe('story_setup');
    expect(setupState.storyMode?.scenarioId).toBe('1516_leicester');

    // Quick lineup must be a strict no-op in Story Mode
    const afterOpt = gameReducer(setupState, { type: 'AUTO_OPTIMIZE_LINEUP' });
    expect(afterOpt).toBe(setupState);

    // Start season directly without draft
    const seasonState = gameReducer(setupState, {
      type: 'START_STORY_SEASON',
      payload: { bundle },
    });
    expect(seasonState.phase).toBe('season');
    expect(seasonState.season).not.toBeNull();
    expect(seasonState.season!.clubs).toHaveLength(20);
    expect(seasonState.season!.budgetState?.transferCashM).toBe(35);
    expect(seasonState.season!.budgetState?.ffpTier).toBe(0);
    expect(seasonState.season!.transferWindows).toEqual([10, 19, 28]);
    expect(seasonState.season!.otherLeagues).toEqual({});
  });

  it('evaluates 15-16 Leicester 3-star checklist accurately at exact boundaries', async () => {
    const bundle = await loadStoryScenarioBundle('1516_leicester');
    const hydrated = hydrateStoryScenarioBundle(bundle);
    const vardyId = bundle.missionTargets.vardyId!;

    const baseSeason = {
      currentRound: 38,
      totalRounds: 38,
      standings: [
        makeStanding(USER_CLUB_ID, 85, 3, 30, true),
        makeStanding('ars_1516', 78, 6, 34, false),
      ],
      allPlayerStats: { [vardyId]: makeStats(vardyId, 20, 6) },
      cupPlayerStats: {},
      uclPlayerStats: {},
      cup: { completed: true, championTeamId: 'ars_1516', userEliminatedAt: 'qf' },
      ucl: null,
      awakenedPlayers: {
        [vardyId]: {
          originalOvr: 83,
          ovrGain: 4,
          round: 22,
          competition: 'league' as const,
          statDeltas: [],
        },
      },
    } as unknown as SeasonState;

    const full3 = evaluateStoryChecklist({
      storyMode: hydrated.runtimeState,
      season: baseSeason,
      starters: hydrated.userStarters,
      bench: hydrated.userBench,
    });
    expect(full3.starsEarned).toBe(3);
    expect(full3.isAllClear).toBe(true);

    // 19 goals -> Star 2 fails
    const fail19 = evaluateStoryChecklist({
      storyMode: hydrated.runtimeState,
      season: {
        ...baseSeason,
        allPlayerStats: { [vardyId]: makeStats(vardyId, 19, 6) },
      },
      starters: hydrated.userStarters,
      bench: hydrated.userBench,
    });
    expect(fail19.items[1].status).toBe('failed');
    expect(fail19.starsEarned).toBe(2);
  });

  it('evaluates 07-08 Man Utd Park Ji-sung checklist including Star 3 World Best XI selection', async () => {
    const bundle = await loadStoryScenarioBundle('0708_manutd');
    const hydrated = hydrateStoryScenarioBundle(bundle);
    const parkId = bundle.missionTargets.parkId!;

    const makeSeason = (worldBestPlayerIds: string[] | null) =>
      ({
        currentRound: 38,
        totalRounds: 38,
        standings: [
          makeStanding(USER_CLUB_ID, 89, 3, 22, true),
          makeStanding('che_0708', 85, 3, 26, false),
        ],
        allPlayerStats: { [parkId]: makeStats(parkId, 7, 5) },
        cupPlayerStats: { [parkId]: makeStats(parkId, 1, 1) },
        uclPlayerStats: { [parkId]: makeStats(parkId, 0, 1) }, // total 15 G+A!
        cup: null,
        ucl: {
          stage: 'completed',
          completed: true,
          championTeamId: USER_CLUB_ID,
          userEliminatedAt: null,
          ties: { playoff: [], r16: [], qf: [], sf: [], final: [] },
        },
        awakenedPlayers: {
          [parkId]: {
            originalOvr: 81,
            ovrGain: 5,
            round: 20,
            competition: 'league' as const,
            statDeltas: [],
          },
        },
        globalAwards: worldBestPlayerIds
          ? {
              worldBestXi: worldBestPlayerIds.map((pid, idx) => ({
                slotLabel: idx === 0 ? 'LM' : 'CM',
                position: 'MF',
                stats: makeStats(pid, 7, 5),
                score: 90,
                leagueId: 'epl',
              })),
            }
          : null,
      }) as unknown as SeasonState;

    // Park Ji-sung selected to World Best XI -> 3 stars!
    const pass3 = evaluateStoryChecklist({
      storyMode: hydrated.runtimeState,
      season: makeSeason([parkId, 's0708_mun_0708_ronaldo']),
      starters: hydrated.userStarters,
      bench: hydrated.userBench,
    });
    expect(pass3.items[2].status).toBe('achieved');
    expect(pass3.starsEarned).toBe(3);

    // World Best XI computed without Park Ji-sung -> Star 3 fails
    const missedXi = evaluateStoryChecklist({
      storyMode: hydrated.runtimeState,
      season: makeSeason(['s0708_mun_0708_ronaldo', 's0708_mun_0708_rooney']),
      starters: hydrated.userStarters,
      bench: hydrated.userBench,
    });
    expect(missedXi.items[2].status).toBe('failed');
    expect(missedXi.starsEarned).toBe(2);

    // Before globalAwards are finalized -> in_progress
    const pendingXi = evaluateStoryChecklist({
      storyMode: hydrated.runtimeState,
      season: makeSeason(null),
      starters: hydrated.userStarters,
      bench: hydrated.userBench,
    });
    expect(pendingXi.items[2].status).toBe('in_progress');
  });

  it('strictly blocks Story Mode entries from Global Daily Ranking and isolates Story Codex & Save keys', async () => {
    const storyEntry = {
      id: 'story-test',
      storyScenarioId: '0708_manutd',
      completedAt: new Date().toISOString(),
      fullFiveLeaguePool: true,
      starters: [],
      bench: [],
    } as unknown as HallOfFameEntry;

    const eligibility = validateDailyRankingEligibility(storyEntry);
    expect(eligibility.eligible).toBe(false);
    expect(eligibility.code).toBe('story_mode');

    // Codex recording tracks stars independently
    const codex0 = createEmptyStoryCodex();
    const { nextCodex, isNewBest } = recordStoryCompletionInCodex({
      codex: codex0,
      summary: {
        scenarioId: '1516_leicester',
        starsEarned: 2,
        isAllClear: false,
        items: [
          { id: 'lei_epl_title', starIndex: 1, shortLabel: 'EPL 우승', detail: '', status: 'achieved', progressText: '' },
          { id: 'lei_trio_vardy', starIndex: 2, shortLabel: '각성', detail: '', status: 'achieved', progressText: '' },
          { id: 'lei_double_or_85', starIndex: 3, shortLabel: '더블', detail: '', status: 'failed', progressText: '' },
        ],
      },
      bestSummaryText: '15-16 EPL 1위 (82점)',
    });
    expect(isNewBest).toBe(true);
    expect(getTotalStoryStars(nextCodex)).toBe(2);

    // Storage isolation check with mock localStorage
    const store = new Map<string, string>();
    const prevWindow = globalThis.window;
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        localStorage: {
          getItem: (k: string) => store.get(k) ?? null,
          setItem: (k: string, v: string) => store.set(k, v),
          removeItem: (k: string) => store.delete(k),
        },
      },
    });
    try {
      store.set('football_draft_game_state_v5', '{"normal":"intact"}');
      const bundle = await loadStoryScenarioBundle('1516_leicester');
      const setup = gameReducer({} as GameState, {
        type: 'ENTER_STORY_SETUP',
        payload: { bundle },
      });
      const started = gameReducer(setup, {
        type: 'START_STORY_SEASON',
        payload: { bundle },
      });
      expect(persistGameStateToStorage(started)).toBe(true);
      expect(store.get('football_draft_game_state_v5')).toBe(
        '{"normal":"intact"}',
      );
      expect(store.has(STORY_ACTIVE_SAVE_KEY)).toBe(true);
    } finally {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: prevWindow,
      });
    }
  });

  it('supports Story Mode awakening focus resonance for Park Ji-sung when naturally positioned', async () => {
    const bundle = await loadStoryScenarioBundle('0708_manutd');
    const hydrated = hydrateStoryScenarioBundle(bundle);
    const parkId = bundle.missionTargets.parkId!;

    const res = evaluatePostMatchAwakening({
      starters: hydrated.userStarters,
      bench: hydrated.userBench,
      formation: '4-4-2',
      matchPlayedNumber: 12,
      round: 12,
      competition: 'league',
      ratingsByPlayerId: { [parkId]: 7.6 },
      goalsByPlayerId: { [parkId]: 1 },
      assistsByPlayerId: { [parkId]: 1 },
      minutesByPlayerId: { [parkId]: 90 },
      cleanSheet: true,
      allPlayerStats: { [parkId]: makeStats(parkId, 4, 4) },
      managerTraitId: 'gegenpress_guru',
      staffCoachId: 'sys_potential_dev',
      storyFocusPlayerIds: [parkId],
      rng: () => 0.001,
    });
    expect(res.triggered).toBe(true);
    expect(res.awakenedPlayer?.id).toBe(parkId);
    expect(res.awakenedPlayer!.ovr).toBeGreaterThan(81);
  });
});
