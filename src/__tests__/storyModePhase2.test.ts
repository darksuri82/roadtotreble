import { describe, expect, it } from 'vitest';
import {
  getStoryScenarioMeta,
  loadStoryScenarioBundle,
  STORY_SCENARIOS,
} from '../data/story/storyRegistry';
import { USER_CLUB_ID } from '../engine/matchEngine';
import {
  createEmptyStoryCodex,
  evaluateStoryChecklist,
  getTotalStoryStars,
  hydrateStoryScenarioBundle,
  recordStoryCompletionInCodex,
} from '../engine/storyModeEngine';
import { createStoryUclR16State } from '../engine/uclEngine';
import { gameReducer } from '../store/GameContext';
import type { GameState, SeasonState } from '../types/game';
import type { PlayerSeasonStats, StandingRow } from '../types/league';

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
    goalsFor: 72,
    goalsAgainst,
    goalDifference: 72 - goalsAgainst,
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
    position: 'FW',
    mainPositions: ['ST'],
    ovr: 87,
    appearances: 36,
    starts: 35,
    subAppearances: 1,
    minutesPlayed: 3100,
    goals,
    assists,
    xgSum: goals * 0.9,
    cleanSheets: 10,
    momCount: 5,
    ratingSum: 270,
    avgRating: 7.5,
    positionCounts: { ST: 35 },
    isLegend: false,
  };
}

describe('Story Mode Phase 2 — All 7 Scenarios Playable, Data Integrity, UCL R16 & Checklists', () => {
  it('enables all 7 scenarios as playable with 3-chapter pixel-art literary prologues', () => {
    expect(STORY_SCENARIOS).toHaveLength(7);
    for (const meta of STORY_SCENARIOS) {
      expect(meta.isPlayable).toBe(true);
      expect(meta.introSlides).toHaveLength(3);
      for (const slide of meta.introSlides) {
        expect(slide.narrative.length).toBeGreaterThan(20);
        expect(slide.characters.length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('hydrates 18-19 Tottenham with 20 EPL clubs, 35-club 5-league pool, DESK starters & exact 18-19 UCL R16', async () => {
    const bundle = await loadStoryScenarioBundle('1819_tottenham');
    const hydrated = hydrateStoryScenarioBundle(bundle);

    expect(hydrated.domesticClubs).toHaveLength(20);
    expect(hydrated.userStarters).toHaveLength(11);
    expect(hydrated.userBench).toHaveLength(6);
    expect(hydrated.transferPoolClubs).toHaveLength(35);

    const poolLeagues = new Set(hydrated.transferPoolClubs.map((c) => c.leagueId));
    expect(poolLeagues).toEqual(
      new Set(['epl', 'laliga', 'seriea', 'bundesliga', 'ligue1']),
    );

    const allPlayers = [
      ...hydrated.userStarters,
      ...hydrated.userBench,
      ...Object.values(hydrated.domesticAiRosters).flat(),
      ...hydrated.transferPoolClubs.flatMap((c) => c.roster),
      ...Object.values(hydrated.uclR16Prepared?.aiRosters ?? {}).flat(),
    ];
    for (const pl of allPlayers) {
      expect(pl.ovr).toBeLessThanOrEqual(92);
    }

    // DESK mission targets must all be present in opening starters
    const starterIds = new Set(hydrated.userStarters.map((p) => p.id));
    for (const id of hydrated.runtimeState.missionTargets.deskIds ?? []) {
      expect(starterIds.has(id)).toBe(true);
    }

    // Direct 18-19 UCL R16 bracket integrity
    const prep = hydrated.uclR16Prepared!;
    const { ucl } = createStoryUclR16State({
      seasonLabel: prep.seasonLabel,
      userClub: hydrated.userClub,
      userSquad: [...hydrated.userStarters, ...hydrated.userBench],
      clubs: prep.clubs,
      aiRosters: prep.aiRosters,
      pairings: prep.pairings,
      originLabels: prep.originLabels,
    });
    expect(ucl.stage).toBe('r16');
    expect(ucl.isDirectR16).toBe(true);
    expect(ucl.clubs).toHaveLength(16);
    expect(ucl.ties.r16).toHaveLength(8);
    expect(
      ucl.ties.r16.some(
        (t) =>
          (t.teamAId === 'bvb_1819' && t.teamBId === USER_CLUB_ID) ||
          (t.teamBId === 'bvb_1819' && t.teamAId === USER_CLUB_ID),
      ),
    ).toBe(true);
  });

  it('evaluates 18-19 Tottenham 3-star checklist boundary conditions accurately', async () => {
    const bundle = await loadStoryScenarioBundle('1819_tottenham');
    const hydrated = hydrateStoryScenarioBundle(bundle);
    const [kane, son, eriksen, alli] =
      hydrated.runtimeState.missionTargets.deskIds ?? [];

    const baseSeason = {
      leagueId: 'epl',
      clubs: hydrated.domesticClubs,
      schedule: [],
      currentRound: 38,
      totalRounds: 38,
      standings: [
        makeStanding(USER_CLUB_ID, 99, 3, 28, true),
        makeStanding('mci_1819', 98, 4, 23, false),
      ],
      playerStats: {},
      allPlayerStats: {
        [kane]: makeStats(kane, 22, 5),
        [son]: makeStats(son, 14, 7),
        [eriksen]: makeStats(eriksen, 5, 6),
        [alli]: makeStats(alli, 0, 0), // total = 59
      },
      cupPlayerStats: {},
      uclPlayerStats: {},
      cup: { completed: true, championTeamId: 'mci_1819', userEliminatedAt: 'sf' },
      ucl: { completed: true, championTeamId: USER_CLUB_ID },
    } as unknown as SeasonState;

    const at59 = evaluateStoryChecklist({
      storyMode: hydrated.runtimeState,
      season: baseSeason,
      starters: hydrated.userStarters,
      bench: hydrated.userBench,
    });
    expect(at59.items[0].status).toBe('achieved'); // EPL title
    expect(at59.items[1].status).toBe('failed'); // DESK 59 < 60
    expect(at59.items[2].status).toBe('achieved'); // UCL + EPL double
    expect(at59.starsEarned).toBe(2);

    const at60 = evaluateStoryChecklist({
      storyMode: hydrated.runtimeState,
      season: {
        ...baseSeason,
        allPlayerStats: {
          ...baseSeason.allPlayerStats,
          [alli]: makeStats(alli, 1, 0), // total = 60
        },
      },
      starters: hydrated.userStarters,
      bench: hydrated.userBench,
    });
    expect(at60.items[1].status).toBe('achieved');
    expect(at60.starsEarned).toBe(3);
    expect(at60.isAllClear).toBe(true);
  });

  it('hydrates 03-04 Arsenal with winter-only transfer windows [99,19,99], €30M budget & exact 03-04 UCL R16', async () => {
    const bundle = await loadStoryScenarioBundle('0304_arsenal');
    const hydrated = hydrateStoryScenarioBundle(bundle);

    expect(hydrated.domesticClubs).toHaveLength(20);
    expect(hydrated.transferPoolClubs).toHaveLength(35);
    expect(hydrated.userStarters.map((p) => p.name)).toContain('티에리 앙리');
    expect(hydrated.userStarters.map((p) => p.name)).toContain('데니스 베르캄프');
    expect(hydrated.userStarters.map((p) => p.name)).toContain('패트릭 비에이라');

    const prep = hydrated.uclR16Prepared!;
    const { ucl } = createStoryUclR16State({
      seasonLabel: prep.seasonLabel,
      userClub: hydrated.userClub,
      userSquad: [...hydrated.userStarters, ...hydrated.userBench],
      clubs: prep.clubs,
      aiRosters: prep.aiRosters,
      pairings: prep.pairings,
      originLabels: prep.originLabels,
    });
    expect(ucl.clubs).toHaveLength(16);
    expect(
      ucl.ties.r16.some(
        (t) =>
          (t.teamAId === USER_CLUB_ID && t.teamBId === 'celv_0304') ||
          (t.teamBId === USER_CLUB_ID && t.teamAId === 'celv_0304'),
      ),
    ).toBe(true);

    // Verify START_STORY_SEASON enforces winter_1_only window schedule & €30M budget
    const inSetup = gameReducer({} as GameState, {
      type: 'ENTER_STORY_SETUP',
      payload: { bundle },
    });
    const started = gameReducer(inSetup, {
      type: 'START_STORY_SEASON',
      payload: { bundle },
    });

    expect(started.phase).toBe('season');
    expect(started.season?.transferWindows).toEqual([10, 19, 28]);
    expect(started.season?.budgetState?.transferCashM).toBe(25);
    expect(started.storyMode?.winterMaxSignings).toBeUndefined();
    expect(started.storyMode?.allowUclTransferWindow).toBe(true);
    expect(started.storyMode?.transferRule).toBe('standard_3_plus_ucl');
  });

  it('evaluates 03-04 Arsenal unbeaten 38-match and UCL double checklist accurately', async () => {
    const bundle = await loadStoryScenarioBundle('0304_arsenal');
    const hydrated = hydrateStoryScenarioBundle(bundle);

    const unbeatenDouble = evaluateStoryChecklist({
      storyMode: hydrated.runtimeState,
      season: {
        leagueId: 'epl',
        clubs: hydrated.domesticClubs,
        schedule: [],
        currentRound: 38,
        totalRounds: 38,
        standings: [
          makeStanding(USER_CLUB_ID, 90, 0, 26, true),
          makeStanding('che_0304', 79, 7, 30, false),
        ],
        playerStats: {},
        allPlayerStats: {},
        cupPlayerStats: {},
        uclPlayerStats: {},
        ucl: { completed: true, championTeamId: USER_CLUB_ID },
      } as unknown as SeasonState,
      starters: hydrated.userStarters,
      bench: hydrated.userBench,
    });
    expect(unbeatenDouble.starsEarned).toBe(3);
    expect(unbeatenDouble.isAllClear).toBe(true);

    // 1 loss even with league title + UCL fails Stars 2 & 3
    const oneLoss = evaluateStoryChecklist({
      storyMode: hydrated.runtimeState,
      season: {
        leagueId: 'epl',
        clubs: hydrated.domesticClubs,
        schedule: [],
        currentRound: 38,
        totalRounds: 38,
        standings: [
          makeStanding(USER_CLUB_ID, 91, 1, 25, true),
          makeStanding('che_0304', 79, 7, 30, false),
        ],
        playerStats: {},
        allPlayerStats: {},
        cupPlayerStats: {},
        uclPlayerStats: {},
        ucl: { completed: true, championTeamId: USER_CLUB_ID },
      } as unknown as SeasonState,
      starters: hydrated.userStarters,
      bench: hydrated.userBench,
    });
    expect(oneLoss.items[0].status).toBe('achieved');
    expect(oneLoss.items[1].status).toBe('failed');
    expect(oneLoss.items[2].status).toBe('failed');
    expect(oneLoss.starsEarned).toBe(1);
  });

  it('hydrates 13-14 Atletico with 20 La Liga clubs, 35-club 5-league pool & exact 13-14 UCL R16', async () => {
    const bundle = await loadStoryScenarioBundle('1314_atletico');
    const hydrated = hydrateStoryScenarioBundle(bundle);

    expect(hydrated.meta.leagueId).toBe('laliga');
    expect(hydrated.domesticClubs).toHaveLength(20);
    expect(hydrated.transferPoolClubs).toHaveLength(35);

    const poolLeagues = new Set(hydrated.transferPoolClubs.map((c) => c.leagueId));
    expect(poolLeagues).toEqual(
      new Set(['epl', 'laliga', 'seriea', 'bundesliga', 'ligue1']),
    );

    const allPlayers = [
      ...hydrated.userStarters,
      ...hydrated.userBench,
      ...Object.values(hydrated.domesticAiRosters).flat(),
      ...hydrated.transferPoolClubs.flatMap((c) => c.roster),
      ...Object.values(hydrated.uclR16Prepared?.aiRosters ?? {}).flat(),
    ];
    for (const pl of allPlayers) {
      expect(pl.ovr).toBeLessThanOrEqual(92);
    }

    const prep = hydrated.uclR16Prepared!;
    const { ucl } = createStoryUclR16State({
      seasonLabel: prep.seasonLabel,
      userClub: hydrated.userClub,
      userSquad: [...hydrated.userStarters, ...hydrated.userBench],
      clubs: prep.clubs,
      aiRosters: prep.aiRosters,
      pairings: prep.pairings,
      originLabels: prep.originLabels,
    });
    expect(ucl.clubs).toHaveLength(16);
    expect(
      ucl.ties.r16.some(
        (t) =>
          (t.teamAId === USER_CLUB_ID && t.teamBId === 'acm_1314') ||
          (t.teamBId === USER_CLUB_ID && t.teamAId === 'acm_1314'),
      ),
    ).toBe(true);
  });

  it('evaluates 13-14 Atletico <=28 GA league-best defense & La Liga + UCL double checklist accurately', async () => {
    const bundle = await loadStoryScenarioBundle('1314_atletico');
    const hydrated = hydrateStoryScenarioBundle(bundle);

    const allClear = evaluateStoryChecklist({
      storyMode: hydrated.runtimeState,
      season: {
        leagueId: 'laliga',
        clubs: hydrated.domesticClubs,
        schedule: [],
        currentRound: 38,
        totalRounds: 38,
        standings: [
          makeStanding(USER_CLUB_ID, 90, 4, 26, true),
          makeStanding('bar_1314', 87, 5, 33, false),
          makeStanding('rma_1314', 87, 5, 38, false),
        ],
        playerStats: {},
        allPlayerStats: {},
        cupPlayerStats: {},
        uclPlayerStats: {},
        ucl: { completed: true, championTeamId: USER_CLUB_ID },
      } as unknown as SeasonState,
      starters: hydrated.userStarters,
      bench: hydrated.userBench,
    });
    expect(allClear.starsEarned).toBe(3);
    expect(allClear.isAllClear).toBe(true);

    // 29 GA fails Star 2 even if best defense in league
    const ga29 = evaluateStoryChecklist({
      storyMode: hydrated.runtimeState,
      season: {
        leagueId: 'laliga',
        clubs: hydrated.domesticClubs,
        schedule: [],
        currentRound: 38,
        totalRounds: 38,
        standings: [
          makeStanding(USER_CLUB_ID, 90, 4, 29, true),
          makeStanding('bar_1314', 87, 5, 33, false),
        ],
        playerStats: {},
        allPlayerStats: {},
        cupPlayerStats: {},
        uclPlayerStats: {},
        ucl: { completed: true, championTeamId: 'rma_1314', userEliminatedAt: 'final' },
      } as unknown as SeasonState,
      starters: hydrated.userStarters,
      bench: hydrated.userBench,
    });
    expect(ga29.items[0].status).toBe('achieved');
    expect(ga29.items[1].status).toBe('failed');
    expect(ga29.items[2].status).toBe('failed');
    expect(ga29.starsEarned).toBe(1);

    // 27 GA when rival has 25 GA fails "league minimum GA #1"
    const notBestDef = evaluateStoryChecklist({
      storyMode: hydrated.runtimeState,
      season: {
        leagueId: 'laliga',
        clubs: hydrated.domesticClubs,
        schedule: [],
        currentRound: 38,
        totalRounds: 38,
        standings: [
          makeStanding(USER_CLUB_ID, 90, 4, 27, true),
          makeStanding('bar_1314', 87, 5, 25, false),
        ],
        playerStats: {},
        allPlayerStats: {},
        cupPlayerStats: {},
        uclPlayerStats: {},
        ucl: { completed: true, championTeamId: USER_CLUB_ID },
      } as unknown as SeasonState,
      starters: hydrated.userStarters,
      bench: hydrated.userBench,
    });
    expect(notBestDef.items[1].status).toBe('failed');
    expect(notBestDef.starsEarned).toBe(2);
  });

  it('tracks full 21/21 star codex completion across all 7 scenarios', () => {
    let codex = createEmptyStoryCodex();
    for (const meta of STORY_SCENARIOS) {
      const m = getStoryScenarioMeta(meta.id);
      const { nextCodex, isNewBest } = recordStoryCompletionInCodex({
        codex,
        summary: {
          scenarioId: m.id,
          items: m.checklist.map((c) => ({
            ...c,
            status: 'achieved',
            progressText: '달성',
          })),
          starsEarned: 3,
          isAllClear: true,
        },
        bestSummaryText: `${m.leagueLabel} 1위 (90점)`,
      });
      expect(isNewBest).toBe(true);
      codex = nextCodex;
    }
    expect(getTotalStoryStars(codex)).toBe(21);
  });
});
