import { describe, expect, it } from 'vitest';
import {
  loadStoryScenarioBundle,
  STORY_SCENARIOS,
} from '../data/story/storyRegistry';
import {
  ACTIVE_PLAYERS,
  buildAiClubSquad16,
  isStoryEraClubId,
  isStoryEraPlayerId,
  pickReplacementForAiClub,
  sanitizeAiClubRoster,
} from '../engine/dataLoader';
import {
  hydrateStoryScenarioBundle,
  STORY_ACTIVE_SAVE_KEY,
} from '../engine/storyModeEngine';
import {
  buildTradeClubOfferForClub,
  checkTransferWindowTrigger,
  estimateStoryForeignClubRank,
  generateIncomingTradeOffers,
  getNextTransferWindowRound,
} from '../engine/transferEngine';
import {
  gameReducer,
  loadSavedStoryGameState,
  persistGameStateToStorage,
} from '../store/GameContext';
import type { GameState } from '../types/game';
import type { StoryScenarioId } from '../types/storyMode';
import { resolveClubRoster } from '../utils/playerLookup';

const ALL_SCENARIO_IDS: StoryScenarioId[] = STORY_SCENARIOS.map((s) => s.id);
const MODERN_ACTIVE_IDS = new Set(ACTIVE_PLAYERS.map((p) => p.id));

describe('v10.0.1 — Story Mode 100% Era Roster Isolation & 1 Winter + 1 Pre-UCL Transfer Window', () => {
  it('blocks ALL modern 26-27 ACTIVE_PLAYERS and fake generated fillers across every single club in all 5 Story Mode scenarios', async () => {
    for (const scenarioId of ALL_SCENARIO_IDS) {
      const bundle = await loadStoryScenarioBundle(scenarioId);
      const hydrated = hydrateStoryScenarioBundle(bundle);
      const userOwned = new Set([
        ...hydrated.userStarters.map((p) => p.id),
        ...hydrated.userBench.map((p) => p.id),
      ]);

      for (const entry of hydrated.transferPoolClubs) {
        expect(isStoryEraClubId(entry.club.id)).toBe(true);

        // 1) buildAiClubSquad16 (even without explicit strictRosterOnly — defense-in-depth!)
        const sq = buildAiClubSquad16({
          club: entry.club,
          leagueId: entry.leagueId,
          liveAiRoster: entry.roster,
          ownedIds: userOwned,
          excludeIds: userOwned,
        });
        expect(sq.starters).toHaveLength(11);
        expect(sq.all16.length).toBe(entry.roster.length);
        for (const p of sq.all16) {
          expect(MODERN_ACTIVE_IDS.has(p.id)).toBe(false);
          expect(Boolean(p.isGenerated)).toBe(false);
          expect(isStoryEraPlayerId(p.id)).toBe(true);
        }

        // 2) buildTradeClubOfferForClub (scouting / counter-offer pitch view)
        const offer = buildTradeClubOfferForClub({
          club: entry.club,
          leagueId: entry.leagueId,
          clubRank: 2,
          leagueSize: 20,
          currentRound: 19,
          totalRounds: 38,
          windowIndex: 2,
          userRank: 1,
          userLeagueSize: 20,
          isUserLeague: entry.leagueId === hydrated.meta.leagueId,
          aiRoster: entry.roster,
          allPlayerStats: {},
          ownedIds: userOwned,
          excludeIds: userOwned,
          strictRosterOnly: true,
        });
        for (const t of offer.squad) {
          expect(MODERN_ACTIVE_IDS.has(t.player.id)).toBe(false);
          expect(Boolean(t.player.isGenerated)).toBe(false);
          expect(isStoryEraPlayerId(t.player.id)).toBe(true);
        }
      }
    }
  });

  it('keeps 07-08 Tottenham, Sunderland, and Reading 100% era-authentic (no Marmoush, Tonali, Brobbey, or Jack Wood)', async () => {
    const bundle = await loadStoryScenarioBundle('0708_manutd');
    const hydrated = hydrateStoryScenarioBundle(bundle);

    const spurs = hydrated.transferPoolClubs.find(
      (c) => c.club.id === 'tot_0708',
    )!;
    const spursSq = buildAiClubSquad16({
      club: spurs.club,
      leagueId: 'epl',
      liveAiRoster: spurs.roster,
    });
    const spursNames = spursSq.all16.map((p) => p.name);
    expect(spursNames).toContain('디미타르 베르바토프');
    expect(spursNames).toContain('로비 킨');
    expect(spursNames).toContain('이영표');
    expect(spursNames).not.toContain('오마르 마르무시');
    expect(spursNames).not.toContain('산드로 토날리');
    expect(spursNames).not.toContain('페드로 포로');
    expect(spursNames).not.toContain('안토닌 킨스키');

    const sunderland = hydrated.transferPoolClubs.find(
      (c) => c.club.id === 'sun_0708',
    )!;
    const sunSq = buildAiClubSquad16({
      club: sunderland.club,
      leagueId: 'epl',
      liveAiRoster: sunderland.roster,
    });
    const sunNames = sunSq.all16.map((p) => p.name);
    expect(sunNames).toContain('크레이그 고든');
    expect(sunNames).toContain('켄와인 존스');
    expect(sunNames).not.toContain('브라이언 브로베이');

    const reading = hydrated.transferPoolClubs.find(
      (c) => c.club.id === 'rea_0708',
    )!;
    const reaSq = buildAiClubSquad16({
      club: reading.club,
      leagueId: 'epl',
      liveAiRoster: reading.roster,
    });
    expect(reaSq.all16.every((p) => !p.isGenerated)).toBe(true);
    expect(reaSq.all16.map((p) => p.name)).toContain('케빈 도일');
    expect(reaSq.all16.map((p) => p.name)).toContain('셰인 롱');
  });

  it('generates 100% era-authentic incoming trade offers across all 5 scenarios with realistic foreign Top-4 ranks (1..4)', async () => {
    for (const scenarioId of ALL_SCENARIO_IDS) {
      const bundle = await loadStoryScenarioBundle(scenarioId);
      const hydrated = hydrateStoryScenarioBundle(bundle);
      const validClubIds = new Set(
        hydrated.transferPoolClubs.map((c) => c.club.id),
      );
      const validPlayerIds = new Set(
        hydrated.transferPoolClubs.flatMap((c) => c.roster.map((p) => p.id)),
      );

      let seed = 1337;
      const detRng = () => {
        seed = (seed * 16807) % 2147483647;
        return (seed - 1) / 2147483646;
      };

      // Run multiple draws to exercise both domestic & foreign Top-4 clubs
      let totalOffers = 0;
      for (let trial = 0; trial < 8; trial += 1) {
        const offers = generateIncomingTradeOffers({
          windowIndex: 2,
          currentRound: 19,
          userLeagueId: hydrated.meta.leagueId,
          userRank: 1,
          userStarters: hydrated.userStarters,
          userBench: hydrated.userBench,
          standings: [],
          aiRosters: hydrated.domesticAiRosters,
          allPlayerStats: {},
          storyTransferPool: hydrated.transferPoolClubs,
          minOfferCount: 3,
          rng: detRng,
        });
        totalOffers += offers.length;
        for (const off of offers) {
          expect(validClubIds.has(off.club.id)).toBe(true);
          for (const pl of off.aiOffersPlayers) {
            expect(validPlayerIds.has(pl.id)).toBe(true);
            expect(MODERN_ACTIVE_IDS.has(pl.id)).toBe(false);
            expect(Boolean(pl.isGenerated)).toBe(false);
          }
          if (off.leagueId !== hydrated.meta.leagueId) {
            expect(off.clubRank).toBeGreaterThanOrEqual(1);
            expect(off.clubRank).toBeLessThanOrEqual(4);
          }
        }
      }
      expect(totalOffers).toBeGreaterThan(0);

      // Verify estimateStoryForeignClubRank directly
      const foreignClub = hydrated.transferPoolClubs.find(
        (c) => c.leagueId !== hydrated.meta.leagueId,
      )!;
      const est = estimateStoryForeignClubRank(
        foreignClub.club,
        foreignClub.leagueId,
        hydrated.transferPoolClubs,
      );
      expect(est.rank).toBeGreaterThanOrEqual(1);
      expect(est.rank).toBeLessThanOrEqual(4);
    }
  });

  it('never leaks modern 26-27 players during sanitizeAiClubRoster, pickReplacementForAiClub, or resolveClubRoster', async () => {
    const bundle = await loadStoryScenarioBundle('0708_manutd');
    const setup = gameReducer({} as GameState, {
      type: 'ENTER_STORY_SETUP',
      payload: { bundle },
    });
    const started = gameReducer(setup, {
      type: 'START_STORY_SEASON',
      payload: { bundle },
    });

    const spursClub = started.season!.clubs.find((c) => c.id === 'tot_0708')!;
    const spursRoster = started.season!.aiRosters.tot_0708;

    // Simulate user owning Berbatov -> sanitizeAiClubRoster must promote era bench, never pull 26-27 Spurs
    const berbatov = spursRoster.find((p) => p.name === '디미타르 베르바토프')!;
    const sanitized = sanitizeAiClubRoster({
      club: spursClub,
      leagueId: 'epl',
      roster: spursRoster,
      ownedIds: new Set([berbatov.id]),
      excludeIds: new Set([berbatov.id]),
    });
    expect(sanitized.some((p) => p.id === berbatov.id)).toBe(false);
    for (const p of sanitized) {
      expect(MODERN_ACTIVE_IDS.has(p.id)).toBe(false);
      expect(isStoryEraPlayerId(p.id)).toBe(true);
    }

    // pickReplacementForAiClub with swapOutPlayer uses swap player, never 26-27 ACTIVE_PLAYERS
    const swapOut = started.bench.find((p) => p !== null)!;
    const repl = pickReplacementForAiClub({
      club: spursClub,
      leagueId: 'epl',
      departedPlayer: berbatov,
      currentRoster: spursRoster.filter((p) => p.id !== berbatov.id),
      excludeIds: new Set([berbatov.id]),
      swapOutPlayer: swapOut,
    });
    expect(MODERN_ACTIVE_IDS.has(repl.id)).toBe(false);
    expect(repl.id).toBe(swapOut.id);

    // resolveClubRoster (used by SeasonDashboard / UclDashboard Club Detail Modal)
    const resolved = resolveClubRoster({
      clubId: spursClub.id,
      club: spursClub,
      leagueId: 'epl',
      season: started.season!,
      userStarters: started.starters,
      userBench: started.bench,
    });
    expect(resolved.length).toBe(spursRoster.length);
    for (const p of resolved) {
      expect(MODERN_ACTIVE_IDS.has(p.id)).toBe(false);
      expect(Boolean(p.isGenerated)).toBe(false);
      expect(isStoryEraPlayerId(p.id)).toBe(true);
    }
  });

  it('uses 1 league transfer window (19R) for all 5 scenarios, fixes getNextTransferWindowRound sentinel 99, and opens 1 pre-UCL era window before UCL R16', async () => {
    // getNextTransferWindowRound must ignore sentinel 99 and return 19 -> null
    expect(getNextTransferWindowRound(0, [99, 19, 99], [], 38)).toBe(19);
    expect(getNextTransferWindowRound(10, [99, 19, 99], [], 38)).toBe(19);
    expect(getNextTransferWindowRound(19, [99, 19, 99], [2], 38)).toBeNull();
    expect(checkTransferWindowTrigger(10, [99, 19, 99], [])).toBeNull();
    expect(checkTransferWindowTrigger(19, [99, 19, 99], [])).toEqual({
      windowIndex: 2,
      triggerRound: 19,
    });
    expect(checkTransferWindowTrigger(28, [99, 19, 99], [2])).toBeNull();

    // All scenarios initialize with unified 3 league windows ([9, 17, 25] for 18-team Bundesliga, [10, 19, 28] for 20-team leagues)
    for (const scenarioId of ALL_SCENARIO_IDS) {
      const bundle = await loadStoryScenarioBundle(scenarioId);
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
    }

    // UCL scenario (07-08 Man Utd): ENTER_UCL_MODE opens pre-UCL era transfer window, TRANSFER_CLOSE_WINDOW starts R16
    const munBundle = await loadStoryScenarioBundle('0708_manutd');
    const setup = gameReducer({} as GameState, {
      type: 'ENTER_STORY_SETUP',
      payload: { bundle: munBundle },
    });
    const started = gameReducer(setup, {
      type: 'START_STORY_SEASON',
      payload: { bundle: munBundle },
    });
    const atSeasonEnd: GameState = {
      ...started,
      phase: 'season_end',
      season: {
        ...started.season!,
        currentRound: 38,
      },
    };
    const inUcl = gameReducer(atSeasonEnd, { type: 'ENTER_UCL_MODE' });
    expect(inUcl.phase).toBe('ucl');
    expect(inUcl.season!.ucl?.isDirectR16).toBe(true);
    expect(inUcl.season!.ucl?.stage).toBe('special_transfer');
    expect(inUcl.season!.transferMarket.isOpen).toBe(true);
    expect(inUcl.season!.transferMarket.isUclSpecial).toBe(true);
    for (const off of inUcl.season!.transferMarket.incomingOffers ?? []) {
      expect(isStoryEraClubId(off.club.id)).toBe(true);
      for (const p of off.aiOffersPlayers) {
        expect(isStoryEraPlayerId(p.id)).toBe(true);
        expect(Boolean(p.isGenerated)).toBe(false);
      }
    }

    const afterClose = gameReducer(inUcl, { type: 'TRANSFER_CLOSE_WINDOW' });
    expect(afterClose.season!.transferMarket.isOpen).toBe(false);
    expect(afterClose.season!.ucl?.stage).toBe('r16');
  });

  it('migrates legacy v10.0.0 Story Mode saves ([10,19,28] and modern-leaked incoming offers) cleanly on load', async () => {
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
      const bundle = await loadStoryScenarioBundle('0708_manutd');
      const setup = gameReducer({} as GameState, {
        type: 'ENTER_STORY_SETUP',
        payload: { bundle },
      });
      const started = gameReducer(setup, {
        type: 'START_STORY_SEASON',
        payload: { bundle },
      });
      const modernPlayer = ACTIVE_PLAYERS[0];
      const legacyPolluted: GameState = {
        ...started,
        season: {
          ...started.season!,
          currentRound: 10,
          transferWindows: [99, 19, 99],
          transferMarket: {
            ...started.season!.transferMarket,
            isOpen: true,
            windowIndex: 1,
            triggerRound: 10,
            attemptsRemaining: 3,
            maxAttempts: 3,
            incomingOffers: [
              {
                id: 'stale-modern-leak',
                club: started.season!.clubs[1],
                leagueId: 'epl',
                clubRank: 12,
                leagueSize: 20,
                clubNeeds: {
                  neededPositions: ['MF'],
                  saturatedPositions: ['FW'],
                  avgOvrByPos: { GK: 78, DF: 78, MF: 74, FW: 80 },
                  countByPos: { GK: 2, DF: 5, MF: 4, FW: 3 },
                  summaryText: '',
                },
                aiOffersPlayers: [modernPlayer],
                userRequestedPlayers: [started.starters[0]!],
                aiPitch: 'stale',
                status: 'pending',
              },
            ],
          },
        },
      };

      expect(persistGameStateToStorage(legacyPolluted)).toBe(true);
      expect(store.has(STORY_ACTIVE_SAVE_KEY)).toBe(true);

      const loaded = loadSavedStoryGameState();
      expect(loaded).not.toBeNull();
      expect(loaded!.season!.transferWindows).toEqual([10, 19, 28]);
      for (const off of loaded!.season!.transferMarket.incomingOffers ?? []) {
        expect(isStoryEraClubId(off.club.id)).toBe(true);
        for (const p of off.aiOffersPlayers) {
          expect(MODERN_ACTIVE_IDS.has(p.id)).toBe(false);
          expect(Boolean(p.isGenerated)).toBe(false);
          expect(isStoryEraPlayerId(p.id)).toBe(true);
        }
      }
    } finally {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: prevWindow,
      });
    }
  });
});
