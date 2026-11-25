import { describe, expect, it } from 'vitest';
import {
  ACTIVE_PLAYERS,
  buildAiClubRoster,
  LEAGUES,
  LEGEND_PLAYERS,
} from '../engine/dataLoader';
import { pickClubCandidatesForSlot } from '../engine/draftEngine';
import {
  computeSeasonScore,
  loadLegacyState,
  saveLegacyState,
} from '../engine/legacyEngine';
import { USER_CLUB_ID } from '../engine/matchEngine';
import {
  createInitialStandings,
  findUserRankOrNull,
  normalizeLegacyPlayerStatsMap,
} from '../engine/standingsEngine';
import { buildTransferClubSquad } from '../engine/transferEngine';
import {
  createUclTournamentState,
  getUserUclResultLabel,
  UCL_EXTERNAL_TEAMS,
} from '../engine/uclEngine';
import { createInitialState, gameReducer } from '../store/GameContext';
import type { TransferTargetPlayer } from '../types/game';
import type { PlayerSeasonStats } from '../types/league';

describe('v2.5 Core Requirements Verification', () => {
  it('guarantees zero duplicate IDs and names worldwide across Active, Legend, and UCL External pools', () => {
    const allIds = new Set<string>();
    const allNames = new Set<string>();

    for (const p of ACTIVE_PLAYERS) {
      expect(allIds.has(p.id)).toBe(false);
      expect(allNames.has(p.name)).toBe(false);
      allIds.add(p.id);
      allNames.add(p.name);
    }
    for (const p of LEGEND_PLAYERS) {
      expect(allIds.has(p.id)).toBe(false);
      expect(allNames.has(p.name)).toBe(false);
      allIds.add(p.id);
      allNames.add(p.name);
    }
    for (const ext of UCL_EXTERNAL_TEAMS) {
      for (const p of ext.roster) {
        expect(allIds.has(p.id)).toBe(false);
        expect(allNames.has(p.name)).toBe(false);
        allIds.add(p.id);
        allNames.add(p.name);
      }
    }

    // Every Big-5 club has >= 7 verified 2026-27 players
    for (const lg of LEAGUES) {
      for (const club of lg.clubs) {
        const clubPlayers = ACTIVE_PLAYERS.filter((p) => p.club === club.name);
        expect(clubPlayers.length).toBeGreaterThanOrEqual(7);
      }
    }
  });

  it('guarantees deterministic top-3 OVR exposure in Draft (Lazio CM exposes Frattesi, Taylor, Rovella)', () => {
    const serieA = LEAGUES.find((l) => l.id === 'seriea')!;
    const lazio = serieA.clubs.find((c) => c.name === '라치오')!;
    expect(lazio).toBeDefined();

    const candidates = pickClubCandidatesForSlot({
      club: lazio,
      leagueId: 'seriea',
      targetSub: 'CM',
      targetBroad: 'MF',
      excludeIds: new Set(),
      activePool: ACTIVE_PLAYERS,
      count: 3,
      rng: () => 0.5,
    });
    expect(candidates.length).toBe(3);

    const names = candidates.map((p) => p.name);
    expect(names).toContain('다비데 프라테시');
    expect(names).toContain('케네스 테일러');
    expect(names).toContain('니콜로 로벨라');
    expect(candidates[0].ovr).toBeGreaterThanOrEqual(candidates[1].ovr);
    expect(candidates[1].ovr).toBeGreaterThanOrEqual(candidates[2].ovr);
  });

  it('exposes top-3 OVR players per broad position in Transfer Market club squad', () => {
    const serieA = LEAGUES.find((l) => l.id === 'seriea')!;
    const lazio = serieA.clubs.find((c) => c.name === '라치오')!;
    const squad = buildTransferClubSquad({
      club: lazio,
      leagueId: 'seriea',
      ownedIds: new Set(),
      clubRank: 6,
      leagueSize: 20,
      currentRound: 12,
      totalRounds: 38,
      windowIndex: 1,
      userRank: 3,
      userLeagueSize: 20,
      allPlayerStats: {},
      isUserLeague: true,
    });
    const mfNames = squad
      .filter((t) => t.player.position === 'MF')
      .map((t) => t.player.name);
    expect(mfNames).toContain('다비데 프라테시');
    expect(mfNames).toContain('케네스 테일러');
    expect(mfNames).toContain('니콜로 로벨라');
  });

  it('removes user-owned players from AI rosters & merges pre+post mid-season transfer stats under a single playerId', () => {
    const barca = LEAGUES.find((l) => l.id === 'laliga')!.clubs.find(
      (c) => c.name === 'FC 바르셀로나',
    )!;
    const yamal = ACTIVE_PLAYERS.find((p) => p.name === '라민 야말')!;
    expect(yamal).toBeDefined();

    // 1. Drafted/owned player must never appear in AI club roster
    const aiWithoutYamal = buildAiClubRoster(
      barca,
      'laliga',
      new Set([yamal.id]),
    );
    expect(aiWithoutYamal.some((p) => p.id === yamal.id)).toBe(false);
    expect(aiWithoutYamal.length).toBe(11);

    // 2. Mid-season transfer through real gameReducer merges pre+post stats & removes from AI club
    let state = createInitialState();
    const eplPlayers = ACTIVE_PLAYERS.filter((p) => p.leagueId === 'epl');
    const starters = [
      eplPlayers.find((p) => p.position === 'GK')!,
      ...eplPlayers.filter((p) => p.position === 'DF').slice(0, 4),
      ...eplPlayers.filter((p) => p.position === 'MF').slice(0, 3),
      ...eplPlayers.filter((p) => p.position === 'FW').slice(0, 3),
    ];
    const usedIds = new Set(starters.map((p) => p.id));
    const bench = eplPlayers.filter((p) => !usedIds.has(p.id)).slice(0, 5);
    state = {
      ...state,
      starters,
      bench,
      phase: 'league_select',
    };
    state = gameReducer(state, {
      type: 'SELECT_LEAGUE',
      payload: { leagueId: 'laliga' },
    });
    expect(state.season).not.toBeNull();

    // Seed pre-transfer stats for Yamal at Barcelona
    const preStat: PlayerSeasonStats = {
      playerId: yamal.id,
      playerName: yamal.name,
      teamId: barca.id,
      teamName: barca.name,
      teamShortName: barca.shortName,
      teamPrimaryColor: barca.primaryColor,
      teamSecondaryColor: barca.secondaryColor,
      isUserTeam: false,
      position: yamal.position,
      mainPositions: yamal.mainPositions,
      ovr: yamal.ovr,
      appearances: 20,
      starts: 20,
      subAppearances: 0,
      minutesPlayed: 1780,
      goals: 20,
      assists: 3,
      xgSum: 15.2,
      cleanSheets: 0,
      momCount: 6,
      ratingSum: 156.0,
      avgRating: 7.8,
      positionCounts: { RW: 20 },
      isLegend: false,
    };
    const transferTarget: TransferTargetPlayer = {
      player: yamal,
      clubName: barca.name,
      clubShortName: barca.shortName,
      clubPrimaryColor: barca.primaryColor,
      clubSecondaryColor: barca.secondaryColor,
      leagueId: 'laliga',
      clubRank: 1,
      leagueSize: 20,
      marketValueM: 120,
      successChance: 100, // deterministic 100% for test
      formTrend: 'up',
      formRating: 7.8,
      formGoals: 20,
      formAssists: 3,
      formCleanSheets: 0,
      formSummary: '20골 3도움',
      breakdown: {
        baseValueM: 110,
        formDeltaPct: 10,
        clubRankDeltaPct: 5,
        userPrestigeDeltaPct: 0,
        baseChance: 100,
        finalChance: 100,
      },
      isLegendFa: false,
    };
    state = {
      ...state,
      season: {
        ...state.season!,
        allPlayerStats: {
          ...state.season!.allPlayerStats,
          [yamal.id]: preStat,
        },
        transferMarket: {
          ...state.season!.transferMarket,
          isOpen: true,
          hasSpunClubs: true,
          attemptsRemaining: 3,
          rolledClubs: [
            {
              reelIndex: 0,
              club: barca,
              leagueId: 'laliga',
              isLegendSlot: false,
              clubRank: 1,
              leagueSize: 20,
              squad: [transferTarget],
            },
          ],
        },
      },
    };

    const outPlayer = state.bench[0]!;
    state = gameReducer(state, {
      type: 'TRANSFER_SUBMIT_OFFER',
      payload: {
        target: transferTarget,
        outSlot: { area: 'bench', index: 0 },
      },
    });

    // Yamal moved into user squad, removed from Barcelona AI roster, and stat preserved under single key with transferHistory
    expect(state.bench[0]?.id).toBe(yamal.id);
    expect(
      state.season!.aiRosters[barca.id].some((p) => p.id === yamal.id),
    ).toBe(false);
    expect(state.season!.aiRosters[barca.id].length).toBe(11);
    expect(state.season!.departedPlayerIds).toContain(yamal.id);
    expect(outPlayer.id).not.toBe(yamal.id);

    const mergedStat = state.season!.allPlayerStats[yamal.id];
    expect(mergedStat).toBeDefined();
    expect(mergedStat.goals).toBe(20);
    expect(mergedStat.assists).toBe(3);
    expect(mergedStat.isUserTeam).toBe(true);
    expect(mergedStat.teamId).toBe(USER_CLUB_ID);
    expect(mergedStat.transferHistory?.length).toBe(1);
    expect(mergedStat.transferHistory?.[0].fromClubName).toBe('FC 바르셀로나');
    expect(state.season!.allPlayerStats[`user::${yamal.id}`]).toBeUndefined();
  });

  it('normalizes legacy user:: stat keys and self-heals legacy 0위 Hall of Fame records', () => {
    const normalized = normalizeLegacyPlayerStatsMap({
      'user::p-1': {
        playerId: 'p-1',
        playerName: '테스트 선수',
        teamId: USER_CLUB_ID,
        teamName: '내 팀',
        teamShortName: 'MY',
        teamPrimaryColor: '#10b981',
        teamSecondaryColor: '#ffffff',
        isUserTeam: true,
        position: 'FW',
        mainPositions: ['ST'],
        ovr: 88,
        appearances: 10,
        starts: 10,
        subAppearances: 0,
        minutesPlayed: 900,
        goals: 9,
        assists: 2,
        xgSum: 7.5,
        cleanSheets: 0,
        momCount: 2,
        ratingSum: 76,
        avgRating: 7.6,
        positionCounts: { ST: 10 },
        isLegend: false,
      },
    });
    expect(normalized['p-1']).toBeDefined();
    expect(normalized['user::p-1']).toBeUndefined();

    const emptyStandings = createInitialStandings([]);
    expect(findUserRankOrNull(emptyStandings, USER_CLUB_ID)).toBeNull();

    // Non-participating UCL returns 미진출 and 0 UCL bonus in season score
    const epl = LEAGUES.find((l) => l.id === 'epl')!;
    const { ucl: bgUcl } = createUclTournamentState({
      userLeagueId: 'epl',
      userLeagueClubs: epl.clubs,
      userLeagueStandings: createInitialStandings(epl.clubs),
      userClub: {
        id: USER_CLUB_ID,
        name: '테스트 FC',
        shortName: 'TST',
        primaryColor: '#10b981',
        secondaryColor: '#ffffff',
        pattern: 'solid',
        att: 80,
        mid: 80,
        def: 80,
        formation: '4-3-3',
        defaultTactic: 'balanced',
        topScorers: ['A', 'B', 'C'],
        isUser: true,
      },
      userSquad: [],
      otherLeagues: {},
      userAiRosters: {},
      userParticipated: false,
    });
    expect(bgUcl.userParticipated).toBe(false);
    expect(getUserUclResultLabel(bgUcl, USER_CLUB_ID)).toBe('미진출');

    const score = computeSeasonScore({
      leaguePoints: 58,
      leaguePlayed: 38,
      leagueGoalDifference: 8,
      leagueLosses: 12,
      finalLeagueRank: 6,
      cup: null,
      ucl: { ...bgUcl, completed: true, championTeamId: bgUcl.clubs[0].id },
      teamAvgOvr: 80,
      userClubId: USER_CLUB_ID,
    });
    expect(score.uclBonus).toBe(0);

    // Verify loadLegacyState self-heals finalLeagueRank: 0 when localStorage is available
    const mem = new Map<string, string>();
    const prevWindow = (globalThis as unknown as { window?: unknown }).window;
    const fakeStorage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => {
        mem.set(k, v);
      },
      removeItem: (k: string) => {
        mem.delete(k);
      },
    };
    (globalThis as unknown as { window: unknown }).window = {
      localStorage: fakeStorage,
    };
    try {
      saveLegacyState({
        version: 1,
        hallOfFame: [
          {
            id: 'legacy-zero-test',
            ruleEra: 'v9.0',
            completedAt: new Date().toISOString(),
            userClub: {
              name: '테스트 FC',
              shortName: 'TST',
              primaryColor: '#10b981',
              secondaryColor: '#ffffff',
              pattern: 'solid',
            },
            managerTraitId: null,
            leagueId: 'epl',
            leagueKoreanName: '프리미어리그',
            formation: '4-3-3',
            defaultTactic: 'balanced',
            finalLeagueRank: 0,
            leaguePoints: 45,
            leagueTotalRounds: 38,
            leagueRecord: '12승 9무 17패',
            cupName: 'FA컵',
            cupResultLabel: '16강 탈락',
            cupWon: false,
            uclResultLabel: '미진출',
            uclWon: false,
            isTreble: false,
            isLeagueChampion: false,
            teamAvgOvr: 78,
            chemistry: 75,
            seasonScore: score,
            trophies: [],
            topScorerSummary: '-',
            starters: [],
            bench: [],
            unlockedAchievementIds: [],
            matchHistory: [],
          },
        ],
        unlockedAchievements: {},
      });
      const healed = loadLegacyState();
      expect(healed.hallOfFame[0]?.finalLeagueRank).toBeGreaterThanOrEqual(1);
    } finally {
      (globalThis as unknown as { window?: unknown }).window = prevWindow;
    }
  });
});
