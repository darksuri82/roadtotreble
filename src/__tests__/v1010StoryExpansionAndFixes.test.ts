import { describe, expect, it } from 'vitest';
import {
  loadStoryScenarioBundle,
  STORY_SCENARIOS,
} from '../data/story/storyRegistry';
import {
  ACTIVE_PLAYERS,
  isStoryEraClubId,
  isStoryEraPlayerId,
} from '../engine/dataLoader';
import { USER_CLUB_ID } from '../engine/matchEngine';
import {
  evaluateStoryChecklist,
  hydrateStoryScenarioBundle,
} from '../engine/storyModeEngine';
import { createStoryUclR16State } from '../engine/uclEngine';
import { gameReducer } from '../store/GameContext';
import type { GameState, SeasonState } from '../types/game';
import type { PlayerSeasonStats, StandingRow } from '../types/league';

const MODERN_ACTIVE_IDS = new Set(ACTIVE_PLAYERS.map((p) => p.id));

function makeStanding(
  teamId: string,
  points: number,
  lost: number,
  goalsAgainst: number,
  played: number,
  isUser = false,
): StandingRow {
  return {
    teamId,
    teamName: isUser ? 'User Club' : teamId,
    shortName: teamId.slice(0, 3).toUpperCase(),
    primaryColor: '#111111',
    secondaryColor: '#ffffff',
    isUser,
    played,
    won: Math.floor(points / 3),
    drawn: points % 3,
    lost,
    goalsFor: 76,
    goalsAgainst,
    goalDifference: 76 - goalsAgainst,
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
    mainPositions: ['CAM'],
    ovr: 85,
    appearances: 33,
    starts: 32,
    subAppearances: 1,
    minutesPlayed: 2850,
    goals,
    assists,
    xgSum: goals * 0.85,
    cleanSheets: 12,
    momCount: 5,
    ratingSum: 250,
    avgRating: 7.58,
    positionCounts: { CAM: 32 },
    isLegend: false,
  };
}

describe('v10.1.0 — 23-24 Leverkusen & 09-10 Inter Scenarios, 2-Tier Transfer Balance, Park Ji-sung World Best XI & Isolation', () => {
  it('hydrates 23-24 Bayer Leverkusen with 18 Bundesliga clubs (34R, 17R winter window), 33-club pool, OVR <= 92 & 0 modern leaks', async () => {
    const bundle = await loadStoryScenarioBundle('2324_leverkusen');
    const hydrated = hydrateStoryScenarioBundle(bundle);

    expect(hydrated.meta.leagueId).toBe('bundesliga');
    expect(hydrated.meta.hasUcl).toBe(false);
    expect(hydrated.meta.cashBudgetM).toBe(50);
    expect(hydrated.meta.winterMaxSignings).toBeUndefined();
    expect(hydrated.domesticClubs).toHaveLength(18);
    expect(hydrated.userStarters).toHaveLength(11);
    expect(hydrated.userBench.length).toBeGreaterThanOrEqual(5);
    // 17 domestic AI + 16 foreign Top 4 = 33 clubs
    expect(hydrated.transferPoolClubs).toHaveLength(33);
    expect(hydrated.uclR16Prepared).toBeNull();

    const starterNames = hydrated.userStarters.map((p) => p.name);
    expect(starterNames).toContain('플로리안 비르츠');
    expect(starterNames).toContain('알렉스 그리말도');
    expect(starterNames).toContain('빅터 보니페이스');
    expect(starterNames).toContain('그라니트 자카');

    const allPlayers = [
      ...hydrated.userStarters,
      ...hydrated.userBench,
      ...hydrated.transferPoolClubs.flatMap((c) => c.roster),
    ];
    for (const p of allPlayers) {
      expect(p.ovr).toBeLessThanOrEqual(92);
      expect(MODERN_ACTIVE_IDS.has(p.id)).toBe(false);
      expect(isStoryEraPlayerId(p.id)).toBe(true);
      expect(Boolean(p.isGenerated)).toBe(false);
    }

    // Verify START_STORY_SEASON uses 34 rounds, 17R winter window & 4 underdog attempts
    const inSetup = gameReducer({} as GameState, {
      type: 'ENTER_STORY_SETUP',
      payload: { bundle },
    });
    const started = gameReducer(inSetup, {
      type: 'START_STORY_SEASON',
      payload: { bundle },
    });
    expect(started.season!.totalRounds).toBe(34);
    expect(started.season!.transferWindows).toEqual([9, 17, 25]);
    expect(started.season!.budgetState?.window1MaxAttempts).toBe(3);
    expect(started.season!.budgetState?.window2MaxAttempts).toBe(3);
    expect(started.season!.budgetState?.window3MaxAttempts).toBe(3);
    expect(started.season!.budgetState?.transferCashM).toBe(50);
  });

  it('evaluates 23-24 Leverkusen 3-star checklist accurately (Title, Trio Awakening + Wirtz 18+ G+A, Unbeaten or DFB-Pokal Double)', async () => {
    const bundle = await loadStoryScenarioBundle('2324_leverkusen');
    const hydrated = hydrateStoryScenarioBundle(bundle);
    const wirtzId = bundle.missionTargets.wirtzId!;

    const baseSeason = {
      leagueId: 'bundesliga',
      currentRound: 34,
      totalRounds: 34,
      standings: [
        makeStanding(USER_CLUB_ID, 90, 0, 24, 34, true),
        makeStanding('bay_2324', 72, 8, 45, 34, false),
      ],
      allPlayerStats: { [wirtzId]: makeStats(wirtzId, 11, 7) }, // 18 G+A
      cupPlayerStats: {},
      uclPlayerStats: {},
      cup: { completed: true, championTeamId: 'bay_2324', userEliminatedAt: 'sf' },
      ucl: null,
      awakenedPlayers: {
        [wirtzId]: {
          originalOvr: 86,
          ovrGain: 4,
          round: 21,
          competition: 'league' as const,
          statDeltas: [],
        },
      },
    } as unknown as SeasonState;

    // Unbeaten title + Wirtz awakened + 18 G+A -> 3 stars!
    const unbeaten3 = evaluateStoryChecklist({
      storyMode: hydrated.runtimeState,
      season: baseSeason,
      starters: hydrated.userStarters,
      bench: hydrated.userBench,
    });
    expect(unbeaten3.starsEarned).toBe(3);
    expect(unbeaten3.isAllClear).toBe(true);

    // 1 loss + DFB-Pokal win -> still achieves Star 3 via domestic double!
    const double3 = evaluateStoryChecklist({
      storyMode: hydrated.runtimeState,
      season: {
        ...baseSeason,
        standings: [
          makeStanding(USER_CLUB_ID, 85, 1, 26, 34, true),
          makeStanding('bay_2324', 78, 6, 40, 34, false),
        ],
        cup: { completed: true, championTeamId: USER_CLUB_ID, userEliminatedAt: null },
      } as unknown as SeasonState,
      starters: hydrated.userStarters,
      bench: hydrated.userBench,
    });
    expect(double3.items[2].status).toBe('achieved');
    expect(double3.starsEarned).toBe(3);

    // Wirtz 17 G+A -> Star 2 fails
    const wirtz17 = evaluateStoryChecklist({
      storyMode: hydrated.runtimeState,
      season: {
        ...baseSeason,
        allPlayerStats: { [wirtzId]: makeStats(wirtzId, 10, 7) },
      },
      starters: hydrated.userStarters,
      bench: hydrated.userBench,
    });
    expect(wirtz17.items[1].status).toBe('failed');
    expect(wirtz17.starsEarned).toBe(2);
  });

  it('hydrates 09-10 Inter Milan with 20 Serie A clubs, 35-club pool, exact 09-10 UCL R16 pairings, OVR <= 92 & 0 modern leaks', async () => {
    const bundle = await loadStoryScenarioBundle('0910_inter');
    const hydrated = hydrateStoryScenarioBundle(bundle);

    expect(hydrated.meta.leagueId).toBe('seriea');
    expect(hydrated.meta.hasUcl).toBe(true);
    expect(hydrated.meta.cashBudgetM).toBe(60);
    expect(hydrated.meta.winterMaxSignings).toBeUndefined();
    expect(hydrated.domesticClubs).toHaveLength(20);
    expect(hydrated.transferPoolClubs).toHaveLength(35);
    expect(hydrated.uclR16Prepared).not.toBeNull();
    expect(hydrated.uclR16Prepared!.clubs).toHaveLength(16);
    expect(hydrated.uclR16Prepared!.pairings).toHaveLength(8);

    const starterNames = hydrated.userStarters.map((p) => p.name);
    expect(starterNames).toContain('디에고 밀리토');
    expect(starterNames).toContain('베슬리 스네이더르');
    expect(starterNames).toContain('사뮈엘 에투');
    expect(starterNames).toContain('하비에르 사네티');

    const allPlayers = [
      ...hydrated.userStarters,
      ...hydrated.userBench,
      ...hydrated.transferPoolClubs.flatMap((c) => c.roster),
      ...Object.values(hydrated.uclR16Prepared!.aiRosters).flat(),
    ];
    for (const p of allPlayers) {
      expect(p.ovr).toBeLessThanOrEqual(92);
      expect(MODERN_ACTIVE_IDS.has(p.id)).toBe(false);
      expect(isStoryEraPlayerId(p.id)).toBe(true);
      expect(Boolean(p.isGenerated)).toBe(false);
    }
    for (const c of hydrated.transferPoolClubs) {
      expect(isStoryEraClubId(c.club.id)).toBe(true);
    }

    // Authentic 09-10 UCL R16 pairing: Chelsea vs Inter
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
          (t.teamAId === 'che_0910' && t.teamBId === USER_CLUB_ID) ||
          (t.teamBId === 'che_0910' && t.teamAId === USER_CLUB_ID),
      ),
    ).toBe(true);
  });

  it('evaluates 09-10 Inter Treble 3-star checklist accurately (Serie A, Trio 45+ & Milito 18+, Italian Treble)', async () => {
    const bundle = await loadStoryScenarioBundle('0910_inter');
    const hydrated = hydrateStoryScenarioBundle(bundle);
    const [militoId, sneijderId, etooId] =
      hydrated.runtimeState.missionTargets.interTrioIds ?? [];

    const trebleSeason = {
      leagueId: 'seriea',
      currentRound: 38,
      totalRounds: 38,
      standings: [
        makeStanding(USER_CLUB_ID, 82, 4, 34, 38, true),
        makeStanding('rom_0910', 80, 6, 41, 38, false),
      ],
      allPlayerStats: {
        [militoId]: makeStats(militoId, 20, 4),
        [sneijderId]: makeStats(sneijderId, 6, 9),
        [etooId]: makeStats(etooId, 12, 4), // total = 55, Milito 20 goals
      },
      cupPlayerStats: {},
      uclPlayerStats: {},
      cup: { completed: true, championTeamId: USER_CLUB_ID, userEliminatedAt: null },
      ucl: { completed: true, championTeamId: USER_CLUB_ID, userEliminatedAt: null },
    } as unknown as SeasonState;

    const full3 = evaluateStoryChecklist({
      storyMode: hydrated.runtimeState,
      season: trebleSeason,
      starters: hydrated.userStarters,
      bench: hydrated.userBench,
    });
    expect(full3.starsEarned).toBe(3);
    expect(full3.isAllClear).toBe(true);

    // Losing Coppa Italia fails Star 3 (Treble requires all 3 trophies)
    const noCup = evaluateStoryChecklist({
      storyMode: hydrated.runtimeState,
      season: {
        ...trebleSeason,
        cup: { completed: true, championTeamId: 'rom_0910', userEliminatedAt: 'final' },
      } as unknown as SeasonState,
      starters: hydrated.userStarters,
      bench: hydrated.userBench,
    });
    expect(noCup.items[2].status).toBe('failed');
    expect(noCup.starsEarned).toBe(2);
  });

  it('unifies all 7 Story Mode scenarios to 3 league windows + 1 pre-UCL window (3 attempts each) with 100% era roulette pool and 0% Legend FA', async () => {
    for (const meta of STORY_SCENARIOS) {
      expect(meta.winterMaxSignings).toBeUndefined();
      const bundle = await loadStoryScenarioBundle(meta.id);
      const setup = gameReducer({} as GameState, {
        type: 'ENTER_STORY_SETUP',
        payload: { bundle },
      });
      const started = gameReducer(setup, {
        type: 'START_STORY_SEASON',
        payload: { bundle },
      });
      const expectedWindows =
        started.season!.totalRounds <= 34 ? [9, 17, 25] : [10, 19, 28];
      expect(started.season!.transferWindows).toEqual(expectedWindows);
      expect(started.season!.budgetState?.window1MaxAttempts).toBe(3);
      expect(started.season!.budgetState?.window2MaxAttempts).toBe(3);
      expect(started.season!.budgetState?.window3MaxAttempts).toBe(3);

      // Verify pre-UCL window opens with 3 attempts for ALL 5 UCL scenarios (including Arsenal!)
      if (meta.hasUcl) {
        const uclState = gameReducer(
          {
            ...started,
            phase: 'season_end',
            season: {
              ...started.season!,
              currentRound: started.season!.totalRounds,
            },
          },
          { type: 'ENTER_UCL_MODE' },
        );
        expect(uclState.phase).toBe('ucl');
        expect(uclState.season!.ucl?.stage).toBe('special_transfer');
        expect(uclState.season!.transferMarket.isOpen).toBe(true);
        expect(uclState.season!.transferMarket.maxAttempts).toBe(3);

        // Spin roulette inside Story Mode -> must return 3 unique era clubs, 0 Legend slots, 0 modern/generated players
        const spun = gameReducer(uclState, { type: 'TRANSFER_SPIN_CLUBS' });
        expect(spun.season!.transferMarket.hasSpunClubs).toBe(true);
        expect(spun.season!.transferMarket.rolledClubs).toHaveLength(3);
        const validPoolIds = new Set(
          spun.storyMode!.transferPoolClubs.map((c) => c.club.id),
        );
        const rolledIds = new Set<string>();
        for (const offer of spun.season!.transferMarket.rolledClubs) {
          expect(offer.isLegendSlot).toBe(false);
          expect(offer.club).not.toBeNull();
          expect(validPoolIds.has(offer.club!.id)).toBe(true);
          expect(rolledIds.has(offer.club!.id)).toBe(false);
          rolledIds.add(offer.club!.id);
          for (const target of offer.squad) {
            expect(MODERN_ACTIVE_IDS.has(target.player.id)).toBe(false);
            expect(isStoryEraPlayerId(target.player.id)).toBe(true);
            expect(Boolean(target.player.isGenerated)).toBe(false);
          }
        }
      }
    }
  });

  it('guarantees valid TacticId, FormationId, unique club IDs, and zero park_the_bus crash bugs across all 7 scenarios', async () => {
    const validTactics = new Set([
      'possession',
      'gegenpressing',
      'counter',
      'wingplay',
      'balanced',
    ]);
    const validFormations = new Set([
      '4-3-3',
      '4-4-2',
      '4-4-2-diamond',
      '4-2-3-1',
      '3-5-2',
      '3-5-2-dm',
      '3-4-3',
      '3-4-2-1',
      '3-3-3-1',
      '3-2-4-1',
    ]);

    expect(STORY_SCENARIOS).toHaveLength(7);
    expect(STORY_SCENARIOS.length * 3).toBe(21);

    for (const meta of STORY_SCENARIOS) {
      const bundle = await loadStoryScenarioBundle(meta.id);
      const poolIds = new Set<string>();
      for (const c of [...bundle.domesticClubs, ...bundle.foreignTop4Clubs]) {
        expect(poolIds.has(c.id)).toBe(false);
        poolIds.add(c.id);
      }
      const allClubs = [
        ...bundle.domesticClubs,
        ...bundle.foreignTop4Clubs,
        ...(bundle.uclR16ExtraClubs ?? []),
      ];
      for (const c of allClubs) {
        expect(validTactics.has(c.defaultTactic)).toBe(true);
        expect(validFormations.has(c.formation)).toBe(true);
        for (const t of c.manager.preferredTactics ?? []) {
          expect(validTactics.has(t)).toBe(true);
        }
        for (const fm of c.manager.preferredFormations ?? []) {
          expect(validFormations.has(fm)).toBe(true);
        }
      }
      const referencedTargetIds = new Set<string>();
      for (const val of Object.values(bundle.missionTargets ?? {})) {
        if (Array.isArray(val)) {
          for (const id of val) referencedTargetIds.add(id);
        } else if (typeof val === 'string') {
          referencedTargetIds.add(val);
        }
      }
      expect(new Set(bundle.missionKeyPlayerIds)).toEqual(referencedTargetIds);
    }
  });
});
