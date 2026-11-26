import { describe, expect, it } from 'vitest';
import { FORMATIONS } from '../data/formations';
import {
  AWAKENING_OVR_HARD_CAP,
  computeAwakeningCandidateProbability,
  evaluatePostMatchAwakening,
  getAwakeningExpectedGainRange,
  getAwakeningMinMatchRating,
  getAwakeningTierRateMultiplier,
  rollAwakeningOvrGain,
} from '../engine/awakeningEngine';
import {
  applySlotSynergiesToStarters,
  calculateChemistry,
  calculateTeamRatings,
} from '../engine/chemistryEngine';
import {
  ACTIVE_PLAYERS,
  buildAiClubRoster,
  getLeagueById,
} from '../engine/dataLoader';
import {
  ALL_FIVE_LEAGUE_IDS,
  archiveSeasonToHallOfFame,
  computeSeasonScore,
  HOF_RULE_ERA_V9,
  isFullFiveLeagueDraftPool,
  isHofEntryFullFiveLeagueEligible,
  LEGACY_STORAGE_KEY,
  loadLegacyState,
} from '../engine/legacyEngine';
import { simulateMatch, USER_CLUB_ID } from '../engine/matchEngine';

function createSeededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makePlayerStats(
  p: Player,
  overrides: Partial<PlayerSeasonStats> = {},
): PlayerSeasonStats {
  return {
    playerId: p.id,
    playerName: p.name,
    teamId: USER_CLUB_ID,
    teamName: 'FC 테스트',
    teamShortName: 'TST',
    teamPrimaryColor: '#10b981',
    teamSecondaryColor: '#0f172a',
    isUserTeam: true,
    position: p.position,
    mainPositions: [...p.mainPositions],
    ovr: p.ovr,
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
    isLegend: p.isLegend,
    ...overrides,
  };
}
import {
  generateCompactTeamIntro,
  generateSoloSeasonTeamStory,
  josa,
} from '../engine/teamStoryEngine';
import {
  applyDailyTop10RankingLogic,
  buildGlobalSubmissionPayload,
  formatKstDisplayDate,
  groupWeeklyDailyRankings,
  isHofEntryFromTodayKst,
  validateDailyRankingEligibility,
  validateGlobalHofEntryIntegrity,
} from '../services/globalRankingService';
import type { PlayerConditionMap } from '../types/condition';
import { DEFAULT_MANAGER_AVATAR } from '../types/game';
import type { Club, MatchResult, PlayerSeasonStats } from '../types/league';
import {
  buildHallOfFameMember,
  type GlobalHofRankingEntry,
  type HallOfFameEntry,
} from '../types/legacy';
import type { Player, PlayerAwakeningRecord } from '../types/player';

function makeValidHofEntry(
  overrides: Partial<HallOfFameEntry> = {},
): HallOfFameEntry {
  const starters = ACTIVE_PLAYERS.slice(0, 11);
  const bench = ACTIVE_PLAYERS.slice(11, 16);
  const score = computeSeasonScore({
    finalLeagueRank: 1,
    leaguePoints: 90,
    leaguePlayed: 38,
    leagueGoalDifference: 52,
    leagueLosses: 2,
    leagueId: 'epl',
    cup: null,
    ucl: null,
    teamAvgOvr: 85.2,
    chemistry: 90,
  });
  return {
    id: 'hof-v96-1',
    runId: 'run-v96-1',
    ruleEra: HOF_RULE_ERA_V9,
    completedAt: '2026-11-26T05:00:00.000Z', // 2026-11-26 14:00 KST
    draftLeaguePool: [...ALL_FIVE_LEAGUE_IDS],
    fullFiveLeaguePool: true,
    userClub: {
      name: 'FC 공정',
      shortName: 'FAIR',
      primaryColor: '#10b981',
      secondaryColor: '#0f172a',
      pattern: 'solid',
    },
    managerName: '김감독',
    managerAvatar: DEFAULT_MANAGER_AVATAR,
    managerTraitId: 'tiki_taka',
    managerRating: 92,
    leagueId: 'epl',
    leagueKoreanName: '프리미어리그',
    formation: '3-2-4-1',
    defaultTactic: 'possession',
    finalLeagueRank: 1,
    leaguePoints: 90,
    leagueTotalRounds: 38,
    leagueRecord: '28승 6무 4패',
    cupName: 'FA컵',
    cupResultLabel: '우승',
    cupWon: true,
    uclResultLabel: '우승',
    uclWon: true,
    isTreble: true,
    isLeagueChampion: true,
    teamAvgOvr: 85.2,
    chemistry: 90,
    seasonScore: { ...score, ruleEra: HOF_RULE_ERA_V9 },
    trophies: ['프리미어리그 우승', 'FA컵 우승', 'UEFA 챔피언스리그 우승'],
    topScorerSummary: '에이스 (25골 10도움)',
    starters: starters.map((p) => buildHallOfFameMember(p, 5, 3, 7.5)),
    bench: bench.map((p) => buildHallOfFameMember(p, 1, 1, 7.0)),
    fullStarters: starters,
    fullBench: bench,
    unlockedAchievementIds: [],
    ...overrides,
  };
}

describe('v9.6.0 Daily Ranking Date Guard, 5-League Pool Fairness, Storytelling & Low-OVR Awakening', () => {
  it('1) blocks past HOF records from today Daily Ranking, formats KST dates, prunes undated legacy records, and filters mismatched past rows', () => {
    const refTodayKst = '2026-11-26T06:00:00.000Z'; // 2026-11-26 15:00 KST

    const todayEntry = makeValidHofEntry({
      id: 'hof-today',
      runId: 'run-today',
      completedAt: '2026-11-26T04:30:00.000Z', // 2026-11-26 13:30 KST
    });
    const yesterdayEntry = makeValidHofEntry({
      id: 'hof-past',
      runId: 'run-past',
      completedAt: '2026-11-25T05:00:00.000Z', // 2026-11-25 14:00 KST
    });
    const undatedEntry = makeValidHofEntry({
      id: 'hof-nodate',
      runId: 'run-nodate',
      completedAt: '',
    });

    expect(formatKstDisplayDate(todayEntry.completedAt)).toBe('2026.11.26');
    expect(formatKstDisplayDate(yesterdayEntry.completedAt)).toBe('2026.11.25');
    expect(formatKstDisplayDate(undatedEntry.completedAt)).toBe('');

    expect(isHofEntryFromTodayKst(todayEntry, refTodayKst)).toBe(true);
    expect(isHofEntryFromTodayKst(yesterdayEntry, refTodayKst)).toBe(false);
    expect(isHofEntryFromTodayKst(undatedEntry, refTodayKst)).toBe(false);

    expect(validateDailyRankingEligibility(todayEntry, refTodayKst).eligible).toBe(true);
    const pastCheck = validateDailyRankingEligibility(yesterdayEntry, refTodayKst);
    expect(pastCheck.eligible).toBe(false);
    expect(pastCheck.code).toBe('past_date');

    const undatedCheck = validateDailyRankingEligibility(undatedEntry, refTodayKst);
    expect(undatedCheck.eligible).toBe(false);
    expect(undatedCheck.code).toBe('missing_date');

    // loadLegacyState() deletes undated / unparseable HOF records automatically
    const store = new Map<string, string>();
    const mockStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    };
    const origWindow = globalThis.window;
    Object.defineProperty(globalThis, 'window', {
      value: { localStorage: mockStorage },
      configurable: true,
      writable: true,
    });
    try {
      store.set(
        LEGACY_STORAGE_KEY,
        JSON.stringify({
          version: 1,
          hofMigrationEra: HOF_RULE_ERA_V9,
          hallOfFame: [
            todayEntry,
            yesterdayEntry,
            undatedEntry,
            makeValidHofEntry({ id: 'hof-corrupt', completedAt: 'not-a-date' }),
          ],
          unlockedAchievements: {},
        }),
      );
      const loaded = loadLegacyState();
      expect(loaded.hallOfFame.map((e) => e.id)).toEqual([
        'hof-today',
        'hof-past',
      ]);
    } finally {
      Object.defineProperty(globalThis, 'window', {
        value: origWindow,
        configurable: true,
        writable: true,
      });
    }

    // groupWeeklyDailyRankings excludes mistakenly submitted past record sitting in today's bucket
    const makeGlobalRow = (
      id: string,
      score: number,
      rankingDate: string,
      achievedAt: string,
      fullFiveLeaguePool = true,
    ): GlobalHofRankingEntry => ({
      id,
      runId: `run-${id}`,
      ruleEra: HOF_RULE_ERA_V9,
      rankingDate,
      rankingWeekStart: '2026-11-23',
      rank: 1,
      seasonScore: score,
      grade: 'S+',
      clubName: `FC ${id}`,
      managerName: '감독',
      leagueId: 'epl',
      leagueKoreanName: '프리미어리그',
      finalLeagueRank: 1,
      leaguePoints: 90,
      leagueTotalRounds: 38,
      leagueRecord: '28승 6무 4패',
      cupName: 'FA컵',
      cupResultLabel: '우승',
      cupWon: true,
      uclResultLabel: '우승',
      uclWon: true,
      isLeagueChampion: true,
      isTreble: true,
      trophies: ['프리미어리그 우승'],
      formation: '3-2-4-1',
      defaultTactic: 'possession',
      managerTraitId: 'tiki_taka',
      managerRating: 92,
      teamAvgOvr: 86,
      chemistry: 90,
      avgSynergyOvrBonus: 1.5,
      managerSynergyCount: 7,
      topScorerSummary: '에이스 (24골)',
      clubProfile: todayEntry.userClub,
      managerAvatar: DEFAULT_MANAGER_AVATAR,
      scoreBreakdown: todayEntry.seasonScore,
      squadSnapshot: {
        ruleEra: HOF_RULE_ERA_V9,
        fullFiveLeaguePool,
        starters: [],
        bench: [],
      },
      achievedAt,
    });

    const board = groupWeeklyDailyRankings(
      [
        // Mistakenly submitted past #1 record in today's bucket!
        makeGlobalRow('past-mistake', 12999, '2026-11-26', '2026-11-25T05:00:00.000Z'),
        // Legitimate today record
        makeGlobalRow('legit-today', 10500, '2026-11-26', '2026-11-26T04:00:00.000Z'),
      ],
      refTodayKst,
    );
    expect(board.todayEntries.map((e) => e.id)).toEqual(['legit-today']);

    // applyDailyTop10RankingLogic rejects past candidate
    const pastAttempt = applyDailyTop10RankingLogic(
      board.todayEntries,
      makeGlobalRow('past-2', 13000, '2026-11-26', '2026-11-24T05:00:00.000Z'),
      refTodayKst,
    );
    expect(pastAttempt.result.ok).toBe(false);
    expect(pastAttempt.result.entered).toBe(false);
  });

  it('2) enforces Full 5-League Draft Pool for Daily Ranking while still allowing personal HOF archiving', () => {
    expect(isFullFiveLeagueDraftPool(ALL_FIVE_LEAGUE_IDS)).toBe(true);
    expect(
      isFullFiveLeagueDraftPool(['epl', 'laliga', 'seriea', 'bundesliga']),
    ).toBe(false);
    expect(isFullFiveLeagueDraftPool(['epl'])).toBe(false);

    const refToday = '2026-11-26T06:00:00.000Z';
    const partialEntry = makeValidHofEntry({
      draftLeaguePool: ['epl', 'laliga'],
      fullFiveLeaguePool: false,
      completedAt: '2026-11-26T05:00:00.000Z',
    });

    expect(isHofEntryFullFiveLeagueEligible(partialEntry)).toBe(false);
    expect(validateGlobalHofEntryIntegrity(partialEntry).valid).toBe(false);

    const elig = validateDailyRankingEligibility(partialEntry, refToday);
    expect(elig.eligible).toBe(false);
    expect(elig.code).toBe('partial_pool');

    const payload = buildGlobalSubmissionPayload(partialEntry);
    expect(payload.squad_snapshot.fullFiveLeaguePool).toBe(false);

    // Personal HOF archiving STILL succeeds even with partial league pool!
    const store = new Map<string, string>();
    const origWindow = globalThis.window;
    Object.defineProperty(globalThis, 'window', {
      value: {
        localStorage: {
          getItem: (k: string) => store.get(k) ?? null,
          setItem: (k: string, v: string) => store.set(k, v),
          removeItem: (k: string) => store.delete(k),
        },
      },
      configurable: true,
      writable: true,
    });
    try {
      const updated = archiveSeasonToHallOfFame({
        runId: 'run-partial-personal',
        draftLeaguePool: ['epl'],
        userClub: partialEntry.userClub,
        managerName: '감독',
        managerTraitId: 'tiki_taka',
        leagueId: 'epl',
        formation: '4-3-3',
        defaultTactic: 'possession',
        standings: [
          {
            teamId: USER_CLUB_ID,
            teamName: 'FC 개인명전',
            shortName: 'PER',
            primaryColor: '#10b981',
            secondaryColor: '#0f172a',
            isUser: true,
            played: 38,
            won: 28,
            drawn: 6,
            lost: 4,
            goalsFor: 80,
            goalsAgainst: 25,
            goalDifference: 55,
            points: 90,
            form: ['W', 'W', 'W', 'W', 'W'],
          },
        ],
        totalRounds: 38,
        cup: null,
        ucl: null,
        teamAvgOvr: 84,
        chemistry: 88,
        seasonScore: partialEntry.seasonScore,
        starters: ACTIVE_PLAYERS.slice(0, 11),
        bench: ACTIVE_PLAYERS.slice(11, 16),
        combinedPlayerStats: {},
        unlockedAchievementIds: [],
      });
      expect(updated.hallOfFame).toHaveLength(1);
      expect(updated.hallOfFame[0].fullFiveLeaguePool).toBe(false);
      expect(updated.hallOfFame[0].draftLeaguePool).toEqual(['epl']);
    } finally {
      Object.defineProperty(globalThis, 'window', {
        value: origWindow,
        configurable: true,
        writable: true,
      });
    }
  });

  it('3) generates expressive human-styled team intro (proper Korean josa, zero dry stat-dump) and chronological storytelling chapters', () => {
    expect(josa('점유율', '으로/로')).toBe('점유율로');
    expect(josa('역습', '으로/로')).toBe('역습으로');
    expect(josa('음바페', '을/를')).toBe('음바페를');
    expect(josa('홀란', '이/가')).toBe('홀란이');

    const underdogIntro = generateCompactTeamIntro({
      clubName: 'FC 기적',
      managerName: '박명장',
      managerTraitId: 'big_game_hunter',
      managerRating: 93,
      staffCoachId: 'line_defense',
      formation: '3-2-4-1',
      tactic: 'possession',
      baseAvgOvr: 81.2,
      effectiveOvr: 86.1,
      chemistry: 92,
      awakenedCount: 1,
      classicCount: 1,
      leagueName: '프리미어리그',
      finalRank: 1,
      expectedRank: 9,
      leaguePoints: 86,
      leaguePlayed: 38,
      goalsFor: 72,
      goalsAgainst: 24,
      awakenedNames: ['엘리엇 앤더슨'],
      classicNames: ['세르히오 부스케츠 (10s)'],
      defAnchorName: '버질 판 다이크',
    });

    expect(underdogIntro).toContain('3-2-4-1');
    expect(underdogIntro).toContain('각성');
    expect(underdogIntro).toContain('반란');
    expect(underdogIntro).not.toContain('점유율으로');
    expect(underdogIntro).not.toContain('(실효 OVR');

    const ironDefenseIntro = generateCompactTeamIntro({
      clubName: 'FC 철벽',
      managerTraitId: 'defensive_architect',
      formation: '4-4-2',
      tactic: 'counter',
      baseAvgOvr: 84.0,
      effectiveOvr: 87.0,
      chemistry: 90,
      leagueName: '세리에 A',
      finalRank: 1,
      leaguePoints: 92,
      leaguePlayed: 38,
      goalsFor: 68,
      goalsAgainst: 18,
      losses: 0,
      defAnchorName: '알레산드로 바스토니',
    });
    expect(ironDefenseIntro).toContain('바스토니');
    expect(ironDefenseIntro).toContain('수비');

    // Chronological storytelling across opening -> streak -> awakening -> comeback -> league climax -> epilogue
    const awakenedStarter: Player = {
      ...ACTIVE_PLAYERS[20],
      ovr: 86,
      awakening: {
        originalOvr: 79,
        ovrGain: 7,
        round: 14,
        competition: 'league',
        statDeltas: [{ key: 'pas', label: '패스', before: 79, after: 87 }],
      },
    };
    const starters = [awakenedStarter, ...ACTIVE_PLAYERS.slice(1, 11)];
    const bench = ACTIVE_PLAYERS.slice(11, 16);
    const makeLeagueMatch = (
      round: number,
      oppId: string,
      ug: number,
      og: number,
      htU: number,
      htO: number,
    ): MatchResult => ({
      fixtureId: `fix-r${round}`,
      round,
      competition: 'league',
      homeTeamId: USER_CLUB_ID,
      awayTeamId: oppId,
      homeGoals: ug,
      awayGoals: og,
      halftimeHomeGoals: htU,
      halftimeAwayGoals: htO,
      homePossession: 56,
      homeShots: 14,
      awayShots: 8,
      homeShotsOnTarget: 7,
      awayShotsOnTarget: 3,
      homeXg: 2.1,
      awayXg: 0.9,
      homeTactic: 'possession',
      awayTactic: 'balanced',
      homeFormation: '3-2-4-1',
      awayFormation: '4-3-3',
      homeTacticBonus: 0,
      awayTacticBonus: 0,
      events: [
        {
          minute: 78,
          half: 2,
          type: 'goal',
          teamId: USER_CLUB_ID,
          scorerName: awakenedStarter.name,
          description: '결승골!',
        },
      ],
      playerRatings: [],
      momPlayerId: awakenedStarter.id,
      momPlayerName: awakenedStarter.name,
      momRating: 8.4,
    });

    const userHistory: MatchResult[] = [
      makeLeagueMatch(1, 'ai-1', 2, 0, 1, 0),
      makeLeagueMatch(2, 'ai-2', 3, 1, 1, 0),
      makeLeagueMatch(3, 'ai-3', 2, 1, 1, 1),
      makeLeagueMatch(4, 'ai-4', 1, 0, 0, 0),
      makeLeagueMatch(5, 'ai-5', 2, 0, 1, 0),
      makeLeagueMatch(12, 'ai-city', 2, 1, 1, 0),
      makeLeagueMatch(24, 'ai-city', 3, 2, 0, 2), // 2-goal comeback!
      makeLeagueMatch(30, 'ai-4', 5, 0, 3, 0), // huge win!
    ];

    const story = generateSoloSeasonTeamStory({
      userClubName: 'FC 연대기',
      managerName: '박명장',
      managerTraitId: 'big_game_hunter',
      managerRating: 93,
      staffCoachId: 'line_defense',
      formation: '3-2-4-1',
      tactic: 'possession',
      leagueName: '프리미어리그',
      clubs: [
        {
          id: USER_CLUB_ID,
          name: 'FC 연대기',
          shortName: 'CHR',
          primaryColor: '#10b981',
          secondaryColor: '#0f172a',
          att: 83,
          mid: 84,
          def: 83,
          formation: '3-2-4-1',
          defaultTactic: 'possession',
          topScorers: ['A', 'B', 'C'],
          isUser: true,
        },
        {
          id: 'ai-city',
          name: '맨체스터 시티',
          shortName: 'MCI',
          primaryColor: '#38bdf8',
          secondaryColor: '#0f172a',
          att: 87,
          mid: 88,
          def: 86,
          formation: '4-3-3',
          defaultTactic: 'possession',
          topScorers: ['X', 'Y', 'Z'],
        },
        {
          id: 'ai-1',
          name: '아스널',
          shortName: 'ARS',
          primaryColor: '#ef4444',
          secondaryColor: '#ffffff',
          att: 86,
          mid: 86,
          def: 86,
          formation: '4-3-3',
          defaultTactic: 'possession',
          topScorers: ['X', 'Y', 'Z'],
        },
      ],
      standings: [
        {
          teamId: USER_CLUB_ID,
          teamName: 'FC 연대기',
          shortName: 'CHR',
          primaryColor: '#10b981',
          secondaryColor: '#0f172a',
          isUser: true,
          played: 38,
          won: 29,
          drawn: 7,
          lost: 2,
          goalsFor: 82,
          goalsAgainst: 22,
          goalDifference: 60,
          points: 94,
          form: ['W', 'W', 'W', 'W', 'W'],
        },
        {
          teamId: 'ai-city',
          teamName: '맨체스터 시티',
          shortName: 'MCI',
          primaryColor: '#38bdf8',
          secondaryColor: '#0f172a',
          isUser: false,
          played: 38,
          won: 27,
          drawn: 6,
          lost: 5,
          goalsFor: 78,
          goalsAgainst: 30,
          goalDifference: 48,
          points: 87,
          form: ['W', 'W', 'D', 'W', 'W'],
        },
      ],
      fixtures: [],
      totalRounds: 38,
      userMatchHistory: userHistory,
      userCupMatchHistory: [],
      userUclMatchHistory: [],
      cup: null,
      ucl: null,
      starters,
      bench,
      combinedStatsMap: {
        [awakenedStarter.id]: makePlayerStats(awakenedStarter, {
          teamName: 'FC 연대기',
          teamShortName: 'CHR',
          appearances: 35,
          starts: 34,
          minutesPlayed: 3060,
          goals: 16,
          assists: 14,
          cleanSheets: 12,
          ratingSum: 266,
          avgRating: 7.6,
          momCount: 7,
          xgSum: 13,
        }),
      },
      baseAvgOvr: 83.2,
      effectiveOvr: 87.5,
      chemistry: 92,
      ffpTier: 0,
      userClubId: USER_CLUB_ID,
    });

    expect(story.highlights.length).toBeGreaterThanOrEqual(6);
    expect(story.highlights[0].kind).toBe('opening');
    expect(story.highlights.some((h) => h.kind === 'awakening' && h.period === '14R')).toBe(true);
    expect(story.highlights.some((h) => h.kind === 'comeback')).toBe(true);
    expect(story.highlights[story.highlights.length - 1].period).toBe('에필로그');
  });

  it('4) lifts low-OVR synergized players in match ratings/sub-attributes and enables reliable, balanced awakening in 50-season real match sim', () => {
    // 4a. Tier rates & gain ranges for low-OVR hidden gems (v9.7.0 calibrated)
    expect(getAwakeningTierRateMultiplier(75)).toBe(2.3);
    expect(getAwakeningTierRateMultiplier(78)).toBe(2.0);
    expect(getAwakeningTierRateMultiplier(80)).toBe(1.65);
    expect(getAwakeningExpectedGainRange(75)).toEqual({ min: 6, max: 8 });
    expect(getAwakeningMinMatchRating(75, true)).toBe(6.75);
    expect(getAwakeningMinMatchRating(78, true)).toBe(6.9);

    const rngGain = createSeededRng(20260960);
    for (let i = 0; i < 40; i += 1) {
      const g = rollAwakeningOvrGain(75, rngGain);
      expect(g).toBeGreaterThanOrEqual(6);
      expect(g).toBeLessThanOrEqual(8);
    }

    // 4b. applySlotSynergiesToStarters lifts attrs too!
    const lowPlayer = ACTIVE_PLAYERS.find(
      (p) => p.ovr >= 74 && p.ovr <= 77 && p.position === 'MF',
    )!;
    const boosted = applySlotSynergiesToStarters(
      [lowPlayer],
      {
        0: {
          slotIndex: 0,
          playerId: lowPlayer.id,
          baseEffectiveOvr: lowPlayer.ovr,
          effectiveOvrWithSynergy: lowPlayer.ovr + 4,
          neighborBonus: 3,
          managerBonus: 1,
          totalBonus: 4,
          reasons: ['시너지'],
          lineCount: 8,
        },
      },
      'sys_potential_dev',
    )[0];
    expect(boosted.ovr).toBeGreaterThanOrEqual(lowPlayer.ovr + 5);
    expect(boosted.attrs?.pas).toBeGreaterThan(
      (lowPlayer.attrs?.pas ?? lowPlayer.ovr) + 3,
    );

    // 4c. Well-utilized low-OVR player gets dramatically higher awakening probability than poorly utilized one
    const highUtilEval = computeAwakeningCandidateProbability({
      player: lowPlayer,
      rating: 7.1,
      goals: 0,
      assists: 0,
      minutes: 90,
      cleanSheet: false,
      seasonStats: makePlayerStats(lowPlayer, {
        teamName: 'FC 원석',
        teamShortName: 'GEM',
        appearances: 10,
        starts: 10,
        minutesPlayed: 900,
        goals: 1,
        assists: 2,
        cleanSheets: 3,
        ratingSum: 70.0,
        avgRating: 7.0,
        xgSum: 1.5,
      }),
      synergy: {
        slotIndex: 0,
        playerId: lowPlayer.id,
        baseEffectiveOvr: lowPlayer.ovr,
        effectiveOvrWithSynergy: lowPlayer.ovr + 4,
        neighborBonus: 3,
        managerBonus: 1,
        totalBonus: 4,
        reasons: ['풀시너지'],
        lineCount: 8,
      },
      hasSynergyContext: true,
      condition: {
        morale: 4,
        injury: null,
        consecutiveBenchMatches: 0,
        consecutiveMatchesPlayed: 3,
        recentGoalDrought: 0,
      },
      managerTraitId: 'midfield_maestro',
      positionPenalty: 0,
      teamCountMult: 1.0,
      coachMult: 1.0,
    });

    const poorUtilEval = computeAwakeningCandidateProbability({
      player: lowPlayer,
      rating: 7.1,
      goals: 0,
      assists: 0,
      minutes: 90,
      cleanSheet: false,
      synergy: {
        slotIndex: 0,
        playerId: lowPlayer.id,
        baseEffectiveOvr: lowPlayer.ovr,
        effectiveOvrWithSynergy: lowPlayer.ovr,
        neighborBonus: 0,
        managerBonus: 0,
        totalBonus: 0,
        reasons: [],
        lineCount: 0,
      },
      hasSynergyContext: true,
      condition: {
        morale: -2,
        injury: null,
        consecutiveBenchMatches: 0,
        consecutiveMatchesPlayed: 10,
        recentGoalDrought: 0,
      },
      managerTraitId: 'catenaccio',
      positionPenalty: -6,
      teamCountMult: 1.0,
      coachMult: 1.0,
    });
    expect(highUtilEval.finalProb).toBeGreaterThan(poorUtilEval.finalProb * 8);
    expect(highUtilEval.finalProb).toBeGreaterThanOrEqual(0.02);

    // 4d. Real 40-season match simulation with a low-OVR (74..79) well-synergized squad
    const formation = '4-3-3' as const;
    const slots = FORMATIONS[formation].slots;
    const used = new Set<string>();
    const lowSquad: Player[] = slots.map((slot) => {
      const pick =
        ACTIVE_PLAYERS.find(
          (p) =>
            !used.has(p.id) &&
            p.ovr >= 74 &&
            p.ovr <= 79 &&
            p.mainPositions.includes(slot.subPosition),
        ) ??
        ACTIVE_PLAYERS.find(
          (p) =>
            !used.has(p.id) &&
            p.ovr >= 72 &&
            p.ovr <= 80 &&
            p.position === slot.position,
        )!;
      used.add(pick.id);
      return pick;
    });

    const epl = getLeagueById('epl');
    const midOpponents = epl.clubs.slice(6, 16);
    const oppRosters = new Map(
      midOpponents.map((c) => [c.id, buildAiClubRoster(c, 'epl')]),
    );

    // Construct realistic strong slot synergies (neighborBonus 2~3 + managerBonus 1 for fitting players)
    const chem = calculateChemistry(formation, lowSquad, 'balanced', 'tiki_taka');
    const boostedSynergies = Object.fromEntries(
      lowSquad.map((p, idx) => [
        idx,
        {
          ...(chem.slotSynergies[idx] ?? {
            slotIndex: idx,
            playerId: p.id,
            baseEffectiveOvr: p.ovr,
            effectiveOvrWithSynergy: p.ovr,
            neighborBonus: 0,
            managerBonus: 0,
            totalBonus: 0,
            reasons: [],
            lineCount: 0,
          }),
          neighborBonus: 3,
          managerBonus: 1,
          totalBonus: 4,
          effectiveOvrWithSynergy: p.ovr + 4,
        },
      ]),
    );
    const teamRatings = calculateTeamRatings(
      formation,
      lowSquad,
      90,
      'tiki_taka',
      boostedSynergies,
      'balanced',
    );
    const userClub: Club = {
      id: USER_CLUB_ID,
      name: 'FC 저OVR 원석',
      shortName: 'LOW',
      primaryColor: '#10b981',
      secondaryColor: '#0f172a',
      pattern: 'solid',
      att: teamRatings.att,
      mid: teamRatings.mid,
      def: teamRatings.def,
      formation,
      defaultTactic: 'balanced',
      topScorers: [lowSquad[8].name, lowSquad[9].name, lowSquad[10].name],
    };

    const SEASONS = 40;
    const rng = createSeededRng(20260961);
    let totalAwakened = 0;
    let totalRatingSum = 0;
    let totalRatingCount = 0;

    for (let s = 0; s < SEASONS; s += 1) {
      const awakened: Record<string, PlayerAwakeningRecord> = {};
      const statsMap: Record<string, PlayerSeasonStats> = {};
      const condMap: PlayerConditionMap = {};
      for (const p of lowSquad) {
        statsMap[p.id] = makePlayerStats(p, {
          teamName: userClub.name,
          teamShortName: userClub.shortName,
        });
        condMap[p.id] = {
          morale: 3,
          injury: null,
          consecutiveBenchMatches: 0,
          consecutiveMatchesPlayed: 3,
          recentGoalDrought: 0,
        };
      }

      for (let m = 1; m <= 38; m += 1) {
        const opp = midOpponents[m % midOpponents.length];
        const oppRoster = oppRosters.get(opp.id)!;
        const res = simulateMatch(
          {
            id: `s${s}-m${m}`,
            round: m,
            homeTeamId: USER_CLUB_ID,
            awayTeamId: opp.id,
            played: false,
          },
          userClub,
          opp,
          lowSquad,
          oppRoster,
          {
            userClubId: USER_CLUB_ID,
            formation,
            tactic: 'balanced',
            chemistry: 90,
            ratings: teamRatings,
            slotSynergies: boostedSynergies,
            managerTraitId: 'tiki_taka',
            starters: lowSquad,
            bench: [],
          },
          rng,
        );

        const ratingsById: Record<string, number> = {};
        const goalsById: Record<string, number> = {};
        const assistsById: Record<string, number> = {};
        const minsById: Record<string, number> = {};
        for (const pr of res.playerRatings) {
          if (pr.teamId !== USER_CLUB_ID) continue;
          ratingsById[pr.playerId] = pr.rating;
          goalsById[pr.playerId] = pr.goals;
          assistsById[pr.playerId] = pr.assists;
          minsById[pr.playerId] = pr.minutesPlayed;
          totalRatingSum += pr.rating;
          totalRatingCount += 1;
          const st = statsMap[pr.playerId];
          if (st) {
            st.appearances += 1;
            st.starts += 1;
            st.goals += pr.goals;
            st.assists += pr.assists;
            if (res.awayGoals === 0 && (pr.position === 'GK' || pr.position === 'DF')) {
              st.cleanSheets += 1;
            }
            st.ratingSum += pr.rating;
            st.avgRating = st.ratingSum / st.appearances;
          }
        }

        const awk = evaluatePostMatchAwakening({
          starters: lowSquad,
          bench: [],
          formation,
          matchPlayedNumber: m,
          round: m,
          competition: 'league',
          ratingsByPlayerId: ratingsById,
          goalsByPlayerId: goalsById,
          assistsByPlayerId: assistsById,
          minutesByPlayerId: minsById,
          cleanSheet: res.awayGoals === 0,
          allPlayerStats: statsMap,
          slotSynergies: boostedSynergies,
          conditionMap: condMap,
          managerTraitId: 'tiki_taka',
          existingAwakenedPlayers: awakened,
          rng,
        });
        if (awk.triggered && awk.awakenedPlayer && awk.record) {
          expect(awk.awakenedPlayer.ovr).toBeLessThanOrEqual(AWAKENING_OVR_HARD_CAP);
          awakened[awk.awakenedPlayer.id] = awk.record;
        }
      }
      totalAwakened += Object.keys(awakened).length;
    }

    const avgRating = totalRatingSum / Math.max(1, totalRatingCount);
    const avgAwkPerSeason = totalAwakened / SEASONS;
    console.log(
      `[v9.6 Low-OVR(74~79) Full-Synergy 40-Season Real Match Sim] 평균 평점=${avgRating.toFixed(2)} | 평균 각성=${avgAwkPerSeason.toFixed(2)}명/시즌`,
    );
    expect(avgRating).toBeGreaterThanOrEqual(6.85);
    expect(avgAwkPerSeason).toBeGreaterThanOrEqual(1.2);
    expect(avgAwkPerSeason).toBeLessThanOrEqual(3.2);
  }, 45000);
});
