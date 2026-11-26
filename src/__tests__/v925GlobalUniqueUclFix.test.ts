import { describe, expect, it } from 'vitest';
import {
  createInjury,
  prepareAiClubLineupForMatch,
} from '../engine/conditionEngine';
import {
  ACTIVE_PLAYERS,
  buildAiClubRoster,
  getLeagueById,
  sanitizeAiClubRoster,
} from '../engine/dataLoader';
import { USER_CLUB_ID } from '../engine/matchEngine';
import { createOtherLeaguesState } from '../engine/otherLeaguesEngine';
import { createInitialStandings } from '../engine/standingsEngine';
import { createUclTournamentState } from '../engine/uclEngine';
import {
  createInitialState,
  gameReducer,
  loadSavedGameState,
  persistGameStateToStorage,
} from '../store/GameContext';
import type { PlayerConditionMap } from '../types/condition';
import type { GameState } from '../types/game';
import type { Player } from '../types/player';

function makeMockStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? (store.get(key) ?? null) : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };
}

function buildHaalandSerieASeasonState(): {
  state: GameState;
  haaland: Player;
  manCityId: string;
} {
  const haaland = ACTIVE_PLAYERS.find((p) => p.id === 'act-006')!;
  expect(haaland).toBeDefined();
  expect(haaland.name).toBe('엘링 홀란');

  const epl = getLeagueById('epl');
  const manCity = epl.clubs.find((c) => c.name === '맨체스터 시티')!;
  expect(manCity).toBeDefined();

  // Pick a clean 16-man squad with Haaland as ST starter
  const byPos = (pos: Player['position'], count: number, exclude: Set<string>) =>
    ACTIVE_PLAYERS.filter(
      (p) => p.position === pos && !exclude.has(p.id),
    ).slice(0, count);

  const used = new Set<string>([haaland.id]);
  const gks = byPos('GK', 2, used);
  gks.forEach((p) => used.add(p.id));
  const dfs = byPos('DF', 6, used);
  dfs.forEach((p) => used.add(p.id));
  const mfs = byPos('MF', 4, used);
  mfs.forEach((p) => used.add(p.id));
  const fws = byPos('FW', 3, used);
  fws.forEach((p) => used.add(p.id));

  // 4-3-3: GK, LB, CB, CB, RB, CDM, CM, CM, LW, ST, RW
  const starters: Player[] = [
    gks[0],
    dfs[0],
    dfs[1],
    dfs[2],
    dfs[3],
    mfs[0],
    mfs[1],
    mfs[2],
    fws[0],
    haaland,
    fws[1],
  ];
  const bench: Player[] = [gks[1], dfs[4], dfs[5], mfs[3], fws[2]];

  const base = createInitialState();
  const readyForLeague: GameState = {
    ...base,
    phase: 'league_select',
    formation: '4-3-3',
    starters,
    bench,
  };

  const seasonState = gameReducer(readyForLeague, {
    type: 'SELECT_LEAGUE',
    payload: { leagueId: 'seriea' },
  });

  return { state: seasonState, haaland, manCityId: manCity.id };
}

function enterUclWithManCity(state: GameState, manCityId: string): GameState {
  expect(state.season).not.toBeNull();
  const season = state.season!;

  // Ensure user finishes 1st in Serie A and Man City finishes 1st in EPL background standings
  const userTopStandings = [
    ...season.standings.filter((r) => r.teamId === USER_CLUB_ID),
    ...season.standings.filter((r) => r.teamId !== USER_CLUB_ID),
  ];
  const eplBg = season.otherLeagues.epl!;
  const manCityTopEpl = [
    ...eplBg.standings.filter((r) => r.teamId === manCityId),
    ...eplBg.standings.filter((r) => r.teamId !== manCityId),
  ];

  const seasonEnded: GameState = {
    ...state,
    phase: 'season_end',
    season: {
      ...season,
      currentRound: season.totalRounds,
      standings: userTopStandings,
      otherLeagues: {
        ...season.otherLeagues,
        epl: {
          ...eplBg,
          currentRound: eplBg.totalRounds,
          standings: manCityTopEpl,
        },
      },
    },
  };

  const uclState = gameReducer(seasonEnded, { type: 'ENTER_UCL_MODE' });
  // Close UCL special transfer window to enter league_phase
  return gameReducer(uclState, { type: 'TRANSFER_CLOSE_WINDOW' });
}

describe('v9.2.5 Global unique-player invariant across Serie A -> UCL vs Man City', () => {
  it('never injects user-drafted Haaland into Man City bench/halftime subs during live 2D or solo stream UCL matches', () => {
    const { state: seasonState, haaland, manCityId } =
      buildHaalandSerieASeasonState();

    // 1) Background EPL Man City roster must not contain Haaland
    const bgCityRoster =
      seasonState.season!.otherLeagues.epl!.aiRosters?.[manCityId] ?? [];
    expect(bgCityRoster).toHaveLength(11);
    expect(bgCityRoster.some((p) => p.id === haaland.id)).toBe(false);

    // 2) Enter UCL and verify Man City UCL roster has 11 players and zero Haaland
    const uclState = enterUclWithManCity(seasonState, manCityId);
    const ucl = uclState.season!.ucl!;
    expect(ucl.clubs.some((c) => c.id === manCityId)).toBe(true);
    expect(ucl.aiRosters[manCityId]).toHaveLength(11);
    expect(ucl.aiRosters[manCityId].some((p) => p.id === haaland.id)).toBe(
      false,
    );

    // 3) Force round 1 UCL fixture to be USER vs Man City
    //    and run START_SOLO_STREAM_MATCH (which executes START_LIVE_MATCH + START_SECOND_HALF_BROADCAST)
    //    20 times so Pep Guardiola (OVR 93) repeatedly runs decideAiHalftimeAdjustment!
    const r1Fixtures = ucl.leaguePhaseFixtures.filter((f) => f.round === 1);
    const userFix = r1Fixtures.find(
      (f) => f.homeTeamId === USER_CLUB_ID || f.awayTeamId === USER_CLUB_ID,
    )!;
    const cityFix = r1Fixtures.find(
      (f) => f.homeTeamId === manCityId || f.awayTeamId === manCityId,
    )!;

    const patchedFixtures = ucl.leaguePhaseFixtures.map((f) => {
      if (f.id === userFix.id) {
        return { ...f, homeTeamId: USER_CLUB_ID, awayTeamId: manCityId };
      }
      if (cityFix.id !== userFix.id && f.id === cityFix.id) {
        const swappedOpp =
          userFix.homeTeamId === USER_CLUB_ID
            ? userFix.awayTeamId
            : userFix.homeTeamId;
        return {
          ...f,
          homeTeamId: f.homeTeamId === manCityId ? swappedOpp : f.homeTeamId,
          awayTeamId: f.awayTeamId === manCityId ? swappedOpp : f.awayTeamId,
        };
      }
      return f;
    });

    const uclVsCity: GameState = {
      ...uclState,
      season: {
        ...uclState.season!,
        ucl: {
          ...ucl,
          leaguePhaseFixtures: patchedFixtures,
        },
      },
    };

    let sawAiAdjustment = false;
    for (let i = 0; i < 20; i += 1) {
      const streamed = gameReducer(uclVsCity, {
        type: 'START_SOLO_STREAM_MATCH',
      });
      const ht = streamed.season!.liveHalftime!;
      expect(ht).toBeDefined();
      const res = ht.fullMatchResult!;
      expect(res).toBeDefined();

      // Check AI halftime adjustment never subs Haaland onto Man City
      const adj = res.aiHalftimeAdjustment;
      if (adj) {
        sawAiAdjustment = true;
        expect(
          (adj.updatedStarters ?? []).some((p) => p.id === haaland.id),
        ).toBe(false);
        expect(
          (adj.updatedBench ?? []).some((p) => p.id === haaland.id),
        ).toBe(false);
        expect(
          adj.subsMade.some((s) => s.inPlayerName === haaland.name),
        ).toBe(false);
      }

      // Check Man City side in playerRatings and events never lists Haaland
      const cityRatings = res.playerRatings.filter(
        (r) => r.teamId === manCityId,
      );
      expect(cityRatings.length).toBeGreaterThanOrEqual(11);
      expect(cityRatings.some((r) => r.playerId === haaland.id)).toBe(false);

      const cityEvents = res.events.filter((e) => e.teamId === manCityId);
      expect(
        cityEvents.some((e) => {
          if (e.type === 'save') {
            // On a save event, teamId/scorerId is the defending GK; scorerName is the opponent shooter (our Haaland)
            return e.scorerId === haaland.id;
          }
          return (
            e.scorerId === haaland.id ||
            e.assistId === haaland.id ||
            e.scorerName === haaland.name ||
            e.subInName === haaland.name
          );
        }),
      ).toBe(false);
    }

    // Sanity check that Pep Guardiola actually triggered halftime counterplay in our 20 trials
    expect(sawAiAdjustment).toBe(true);
  });

  it('never pulls Haaland onto Man City during SIMULATE_UCL_PLAYOFF_BYE even when Man City strikers are injured', () => {
    const { state: seasonState, haaland, manCityId } =
      buildHaalandSerieASeasonState();
    const uclState = enterUclWithManCity(seasonState, manCityId);
    const ucl = uclState.season!.ucl!;

    // Place user in Top 8 (bye) and Man City in Playoff
    const cityRoster = ucl.aiRosters[manCityId];
    const conditions: PlayerConditionMap = {};
    // Injure every FW on Man City's base roster so prepareAiClubLineupForMatch MUST pull from getClubRealDepthPool
    for (const p of cityRoster) {
      if (p.position === 'FW') {
        conditions[p.id] = {
          morale: 0,
          injury: createInjury('moderate', 8, 'ucl', () => 0.1),
          consecutiveBenchMatches: 0,
          consecutiveMatchesPlayed: 0,
          recentGoalDrought: 0,
        };
      }
    }

    const otherClubId = ucl.clubs.find(
      (c) => c.id !== USER_CLUB_ID && c.id !== manCityId,
    )!.id;

    const playoffReadyState: GameState = {
      ...uclState,
      season: {
        ...uclState.season!,
        playerConditions: conditions,
        ucl: {
          ...ucl,
          stage: 'playoff',
          leaguePhaseRound: 8,
          userLeaguePhaseRank: 1,
          knockoutLeg: 1,
          ties: {
            ...ucl.ties,
            playoff: [
              {
                id: 'ucl-playoff-0',
                stage: 'playoff',
                tieIndex: 0,
                teamAId: manCityId,
                teamBId: otherClubId,
                aggTeamA: 0,
                aggTeamB: 0,
                winnerId: null,
              },
            ],
          },
        },
      },
    };

    const afterPlayoff = gameReducer(playoffReadyState, {
      type: 'SIMULATE_UCL_PLAYOFF_BYE',
    });

    const tie = afterPlayoff.season!.ucl!.ties.playoff[0];
    for (const leg of [tie.leg1, tie.leg2]) {
      expect(leg).toBeDefined();
      const cityRatings = leg!.playerRatings.filter(
        (r) => r.teamId === manCityId,
      );
      expect(cityRatings.length).toBeGreaterThanOrEqual(11);
      expect(cityRatings.some((r) => r.playerId === haaland.id)).toBe(false);
    }

    const haalandUclStat = afterPlayoff.season!.uclPlayerStats[haaland.id];
    if (haalandUclStat) {
      expect(haalandUclStat.teamId).not.toBe(manCityId);
    }
  });

  it('heals tainted localStorage saves and excludes user squad when reconstructing missing otherLeagues', () => {
    const { state: seasonState, haaland, manCityId } =
      buildHaalandSerieASeasonState();
    const uclState = enterUclWithManCity(seasonState, manCityId);

    const eplBgRosters = uclState.season!.otherLeagues.epl!.aiRosters ?? {};
    const taintedBgCity = [haaland, ...(eplBgRosters[manCityId] ?? []).slice(1)];
    const taintedUclCity = [
      haaland,
      ...uclState.season!.ucl!.aiRosters[manCityId].slice(1),
    ];

    // 1) Tainted save: inject Haaland directly into otherLeagues EPL & UCL Man City rosters
    const taintedState: GameState = {
      ...uclState,
      season: {
        ...uclState.season!,
        otherLeagues: {
          ...uclState.season!.otherLeagues,
          epl: {
            ...uclState.season!.otherLeagues.epl!,
            aiRosters: {
              ...eplBgRosters,
              [manCityId]: taintedBgCity,
            },
          },
        },
        ucl: {
          ...uclState.season!.ucl!,
          aiRosters: {
            ...uclState.season!.ucl!.aiRosters,
            [manCityId]: taintedUclCity,
          },
        },
      },
    };

    const mockStorage = makeMockStorage();
    const prevWindow = globalThis.window;
    Object.defineProperty(globalThis, 'window', {
      value: { localStorage: mockStorage },
      configurable: true,
    });

    try {
      expect(persistGameStateToStorage(taintedState)).toBe(true);
      const healed = loadSavedGameState();

      const healedBgCity =
        healed.season!.otherLeagues.epl!.aiRosters?.[manCityId] ?? [];
      expect(healedBgCity).toHaveLength(11);
      expect(healedBgCity.some((p) => p.id === haaland.id)).toBe(false);

      const healedUclCity = healed.season!.ucl!.aiRosters[manCityId];
      expect(healedUclCity).toHaveLength(11);
      expect(healedUclCity.some((p) => p.id === haaland.id)).toBe(false);

      // 2) Legacy save missing otherLeagues entirely
      const key = mockStorage.key(0)!;
      const rawJson = JSON.parse(mockStorage.getItem(key)!) as GameState;
      delete (rawJson.season as { otherLeagues?: unknown }).otherLeagues;
      mockStorage.setItem(key, JSON.stringify(rawJson));

      const rebuilt = loadSavedGameState();
      const rebuiltCity =
        rebuilt.season!.otherLeagues.epl!.aiRosters?.[manCityId] ?? [];
      expect(rebuiltCity).toHaveLength(11);
      expect(rebuiltCity.some((p) => p.id === haaland.id)).toBe(false);
    } finally {
      Object.defineProperty(globalThis, 'window', {
        value: prevWindow,
        configurable: true,
      });
    }
  });

  it('sanitizeAiClubRoster & createUclTournamentState preserve legitimately traded players (in departedPlayerIds) while removing owned duplicates', () => {
    const epl = getLeagueById('epl');
    const laliga = getLeagueById('laliga');
    const seriea = getLeagueById('seriea');
    const manCity = epl.clubs.find((c) => c.name === '맨체스터 시티')!;
    const realMadrid = laliga.clubs.find((c) => c.name === '레알 마드리드')!;
    const haaland = ACTIVE_PLAYERS.find((p) => p.id === 'act-006')!;
    const tradedStar = ACTIVE_PLAYERS.find(
      (p) => p.club === '맨체스터 시티' && p.id !== haaland.id,
    )!;

    // Suppose user owns Haaland, and previously traded `tradedStar` to Real Madrid
    const ownedIds = new Set<string>([haaland.id]);
    const departedIds = new Set<string>([haaland.id, tradedStar.id]);

    const realMadridBase = buildAiClubRoster(realMadrid, 'laliga', departedIds);
    const realMadridWithTrade = [
      { ...tradedStar, club: realMadrid.name, leagueId: 'laliga' as const },
      ...realMadridBase.slice(1),
    ];

    // sanitizeAiClubRoster must keep tradedStar on Real Madrid
    const sanitizedMadrid = sanitizeAiClubRoster({
      club: realMadrid,
      leagueId: 'laliga',
      roster: realMadridWithTrade,
      ownedIds,
      excludeIds: departedIds,
    });
    expect(sanitizedMadrid.some((p) => p.id === tradedStar.id)).toBe(true);

    // prepareAiClubLineupForMatch must strip Haaland even when conditionMap is null
    const taintedCity = [
      haaland,
      ...buildAiClubRoster(manCity, 'epl', departedIds).slice(1),
    ];
    const prepNoCond = prepareAiClubLineupForMatch({
      club: manCity,
      baseRoster: taintedCity,
      conditionMap: null,
      excludeIds: departedIds,
      ownedIds,
    });
    expect(prepNoCond.effectiveStarters).toHaveLength(11);
    expect(
      prepNoCond.effectiveStarters.some((p) => p.id === haaland.id),
    ).toBe(false);
    expect(
      prepNoCond.effectiveStarters.some((p) => p.id === tradedStar.id),
    ).toBe(false);

    // createUclTournamentState must preserve tradedStar on Real Madrid and scrub/backfill Haaland on Man City
    const otherLeagues = createOtherLeaguesState('seriea', departedIds);
    otherLeagues.epl!.aiRosters = {
      ...otherLeagues.epl!.aiRosters,
      [manCity.id]: taintedCity,
    };
    otherLeagues.laliga!.aiRosters = {
      ...otherLeagues.laliga!.aiRosters,
      [realMadrid.id]: realMadridWithTrade,
    };
    // Guarantee Man City and Real Madrid are top 4 in their background standings
    otherLeagues.epl!.standings = [
      ...otherLeagues.epl!.standings.filter((r) => r.teamId === manCity.id),
      ...otherLeagues.epl!.standings.filter((r) => r.teamId !== manCity.id),
    ];
    otherLeagues.laliga!.standings = [
      ...otherLeagues.laliga!.standings.filter((r) => r.teamId === realMadrid.id),
      ...otherLeagues.laliga!.standings.filter((r) => r.teamId !== realMadrid.id),
    ];

    const userClub = { ...seriea.clubs[0], id: USER_CLUB_ID };
    const userLeagueClubs = [userClub, ...seriea.clubs.slice(1)];
    const { ucl } = createUclTournamentState({
      userLeagueId: 'seriea',
      userClub,
      userSquad: [haaland],
      userLeagueClubs,
      userLeagueStandings: createInitialStandings(userLeagueClubs),
      userAiRosters: {},
      otherLeagues,
      excludeIds: departedIds,
      ownedIds,
      userParticipated: true,
    });

    expect(ucl.aiRosters[manCity.id]).toHaveLength(11);
    expect(ucl.aiRosters[manCity.id].some((p) => p.id === haaland.id)).toBe(
      false,
    );
    expect(ucl.aiRosters[realMadrid.id]).toHaveLength(11);
    expect(
      ucl.aiRosters[realMadrid.id].some((p) => p.id === tradedStar.id),
    ).toBe(true);
  });
});
