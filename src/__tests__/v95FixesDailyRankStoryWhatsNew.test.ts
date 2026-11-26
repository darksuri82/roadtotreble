import { describe, expect, it } from 'vitest';
import {
  clearWhatsNewDismissal,
  dismissWhatsNewForVersion,
  isWhatsNewDismissed,
} from '../components/common/WhatsNewModal';
import {
  ERA_BEST_XI_DREAM_TEAMS,
  HISTORICAL_BENCHMARK_TEAMS,
} from '../data/historicalTeams';
import { CURRENT_APP_VERSION } from '../data/patchNotes';
import { getPlayerAttributes } from '../engine/attributeEngine';
import {
  FFP_TIER2_SCORE_MULTIPLIER,
  FFP_TIER2_SCORE_PENALTY_PCT,
} from '../engine/budgetEngine';
import { ACTIVE_PLAYERS, LEGEND_PLAYERS } from '../engine/dataLoader';
import { computeSeasonScore } from '../engine/legacyEngine';
import {
  generateCompactTeamIntro,
  generateSoloSeasonTeamStory,
  resolveGlobalEntryTeamStory,
  resolveHofTeamStory,
} from '../engine/teamStoryEngine';
import {
  buildGlobalSubmissionPayload,
  getKstDateKey,
  getKstWeekDateKeys,
  getKstWeekStartKey,
  GLOBAL_DAILY_TOP_LIMIT,
  GLOBAL_PAST_DAY_ARCHIVE_LIMIT,
  groupWeeklyDailyRankings,
} from '../services/globalRankingService';
import { DEFAULT_MANAGER_AVATAR } from '../types/game';
import type { GlobalHofRankingEntry, HallOfFameEntry } from '../types/legacy';

describe('v9.5.0 Realistic Sub-Attributes, FFP -12%, Historical Boss OVR, KST Daily Ranking, Team Story & WhatsNew', () => {
  it('1) differentiates technical playmakers from physical powerhouses across Classics, Active & Era Best XI', () => {
    const busquets = LEGEND_PLAYERS.find((p) => p.name.includes('부스케츠'))!;
    const vvd = LEGEND_PLAYERS.find((p) => p.name.includes('판 다이크'))!;
    const pirlo = LEGEND_PLAYERS.find((p) => p.name.includes('피를로'))!;
    const xavi = LEGEND_PLAYERS.find((p) => p.name.includes('사비 에르난데스'))!;
    const drogba = LEGEND_PLAYERS.find((p) => p.name.includes('드로그바'))!;
    const vieira = LEGEND_PLAYERS.find((p) => p.name.includes('비에이라'))!;

    const busqAttrs = getPlayerAttributes(busquets);
    const vvdAttrs = getPlayerAttributes(vvd);
    const pirloAttrs = getPlayerAttributes(pirlo);
    const xaviAttrs = getPlayerAttributes(xavi);
    const drogbaAttrs = getPlayerAttributes(drogba);
    const vieiraAttrs = getPlayerAttributes(vieira);

    // Busquets vs Van Dijk: identical 92 OVR, completely distinct profiles
    expect(vvdAttrs.phy - busqAttrs.phy).toBeGreaterThanOrEqual(15);
    expect(busqAttrs.pas - vvdAttrs.pas).toBeGreaterThanOrEqual(8);
    expect(busqAttrs.phy).toBeLessThanOrEqual(78);
    expect(vvdAttrs.phy).toBeGreaterThanOrEqual(93);

    // Pirlo & Xavi vs Drogba & Vieira
    expect(pirloAttrs.phy).toBeLessThanOrEqual(75);
    expect(xaviAttrs.phy).toBeLessThanOrEqual(77);
    expect(pirloAttrs.pas).toBeGreaterThanOrEqual(97);
    expect(drogbaAttrs.phy).toBeGreaterThanOrEqual(95);
    expect(vieiraAttrs.phy).toBeGreaterThanOrEqual(95);

    // Era Best XI 10s Busquets vs 10s Van Dijk also differentiated via CURATED_CLASSIC_BY_NAME fallback
    const era10 = ERA_BEST_XI_DREAM_TEAMS.find((t) => t.id.includes('10s'))!;
    const eraBusq = era10.starters.find((p) => p.name.includes('부스케츠'))!;
    const eraVvd = era10.starters.find((p) => p.name.includes('판 다이크'))!;
    expect(
      getPlayerAttributes(eraVvd).phy - getPlayerAttributes(eraBusq).phy,
    ).toBeGreaterThanOrEqual(14);

    // Active Pedri vs Declan Rice
    const pedri = ACTIVE_PLAYERS.find((p) => p.name === '페드리')!;
    const rice = ACTIVE_PLAYERS.find((p) => p.name === '데클런 라이스')!;
    expect(
      getPlayerAttributes(rice).phy - getPlayerAttributes(pedri).phy,
    ).toBeGreaterThanOrEqual(12);
  });

  it('5) relaxes FFP Tier 2 final score penalty from 20% to 12%', () => {
    expect(FFP_TIER2_SCORE_PENALTY_PCT).toBe(12);
    expect(FFP_TIER2_SCORE_MULTIPLIER).toBe(0.88);

    const base = computeSeasonScore({
      leagueId: 'epl',
      finalLeagueRank: 1,
      leaguePoints: 90,
      leaguePlayed: 38,
      leagueGoalDifference: 55,
      leagueLosses: 2,
      cup: null,
      ucl: null,
      teamAvgOvr: 86,
      ffpTier: 0,
    });
    const tier2 = computeSeasonScore({
      leagueId: 'epl',
      finalLeagueRank: 1,
      leaguePoints: 90,
      leaguePlayed: 38,
      leagueGoalDifference: 55,
      leagueLosses: 2,
      cup: null,
      ucl: null,
      teamAvgOvr: 86,
      ffpTier: 2,
      ffpScoreMultiplier: FFP_TIER2_SCORE_MULTIPLIER,
    });

    expect(tier2.ffpPenaltyPct).toBe(12);
    expect(tier2.ffpTier).toBe(2);
    expect(tier2.totalScore).toBe(Math.round(base.totalScore * 0.88));
    expect(tier2.ffpPenaltyPoints).toBe(base.totalScore - tier2.totalScore);
  });

  it('7) modestly calibrates historical final-boss team OVRs while preserving top boss hierarchy', () => {
    const byId = new Map(HISTORICAL_BENCHMARK_TEAMS.map((t) => [t.id, t]));
    const barca1011 = byId.get('hist-1011-barca')!;
    const barca1415 = byId.get('hist-1415-barca')!;
    const city2223 = byId.get('hist-2223-mancity')!;
    const psg2425 = byId.get('hist-2425-psg')!;
    const leicester1516 = byId.get('hist-1516-leicester')!;

    // Still strong final bosses (~87.5~89.8 range), no longer unreachable 90.9+
    expect(barca1011.teamAvgOvr).toBeGreaterThanOrEqual(88.5);
    expect(barca1011.teamAvgOvr).toBeLessThanOrEqual(89.8);
    expect(barca1415.teamAvgOvr).toBeGreaterThanOrEqual(88.5);
    expect(barca1415.teamAvgOvr).toBeLessThanOrEqual(89.6);
    expect(city2223.teamAvgOvr).toBeGreaterThanOrEqual(87.2);
    expect(city2223.teamAvgOvr).toBeLessThanOrEqual(88.8);
    expect(psg2425.teamAvgOvr).toBeGreaterThanOrEqual(87.0);
    expect(psg2425.teamAvgOvr).toBeLessThanOrEqual(88.8);

    // Hierarchy preserved: peak Barca > City/PSG > Leicester miracle
    expect(barca1011.teamAvgOvr).toBeGreaterThan(city2223.teamAvgOvr);
    expect(city2223.teamAvgOvr).toBeGreaterThan(leicester1516.teamAvgOvr);
  });

  it('6) groups KST weekly daily rankings with Today TOP 10, Past Days TOP 3 archive, and Monday 00:00 KST reset', () => {
    // 2026-11-26 is Thursday in KST; Monday of that week is 2026-11-23
    const thuNoonKst = new Date('2026-11-26T03:00:00.000Z'); // 12:00 KST
    expect(getKstDateKey(thuNoonKst)).toBe('2026-11-26');
    expect(getKstWeekStartKey(thuNoonKst)).toBe('2026-11-23');
    expect(getKstWeekDateKeys(thuNoonKst)).toEqual([
      '2026-11-26',
      '2026-11-25',
      '2026-11-24',
      '2026-11-23',
    ]);

    // Sunday 23:30 KST vs Monday 00:10 KST (UTC Sunday 15:10) triggers weekly reset
    const sunLateKst = new Date('2026-11-29T14:30:00.000Z'); // 2026-11-29 23:30 KST
    const monEarlyKst = new Date('2026-11-29T15:10:00.000Z'); // 2026-11-30 00:10 KST
    expect(getKstWeekStartKey(sunLateKst)).toBe('2026-11-23');
    expect(getKstWeekStartKey(monEarlyKst)).toBe('2026-11-30');
    expect(getKstWeekDateKeys(monEarlyKst)).toEqual(['2026-11-30']);

    const makeEntry = (
      id: string,
      score: number,
      rankingDate: string,
      rankingWeekStart: string,
    ): GlobalHofRankingEntry => ({
      id,
      runId: id,
      ruleEra: 'v9.0',
      rank: 1,
      rankingDate,
      rankingWeekStart,
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
      teamAvgOvr: 87.2,
      chemistry: 90,
      avgSynergyOvrBonus: 1.6,
      managerSynergyCount: 7,
      topScorerSummary: '에이스 (25골)',
      clubProfile: {
        name: `FC ${id}`,
        shortName: 'FC',
        primaryColor: '#10b981',
        secondaryColor: '#0f172a',
        pattern: 'solid',
      },
      managerAvatar: DEFAULT_MANAGER_AVATAR,
      scoreBreakdown: {
        leagueConvertedScore: 3000,
        leagueRankBonus: 1492,
        cupBonus: 850,
        uclBonus: 2500,
        honorsBonus: 1600,
        underdogBonus: 0,
        squadCraftBonus: 500,
        awardsBonus: 300,
        totalScore: score,
        grade: 'S+',
      },
      squadSnapshot: { starters: [], bench: [] },
      achievedAt: `${rankingDate}T05:00:00.000Z`,
    });

    const rawEntries: GlobalHofRankingEntry[] = [
      // 12 entries today -> capped to TOP 10
      ...Array.from({ length: 12 }, (_, i) =>
        makeEntry(`today-${i}`, 10000 - i * 50, '2026-11-26', '2026-11-23'),
      ),
      // 6 entries yesterday -> capped to TOP 3 archive
      ...Array.from({ length: 6 }, (_, i) =>
        makeEntry(`yest-${i}`, 9800 - i * 80, '2026-11-25', '2026-11-23'),
      ),
      // Previous week entry -> excluded after Monday reset
      makeEntry('prev-week', 12000, '2026-11-22', '2026-11-16'),
    ];

    const board = groupWeeklyDailyRankings(rawEntries, thuNoonKst);
    expect(board.todayKey).toBe('2026-11-26');
    expect(board.weekStartKey).toBe('2026-11-23');
    expect(board.byDate['2026-11-26'].entries.length).toBe(
      GLOBAL_DAILY_TOP_LIMIT,
    );
    expect(board.byDate['2026-11-26'].entries[0].rank).toBe(1);
    expect(board.byDate['2026-11-25'].entries.length).toBe(
      GLOBAL_PAST_DAY_ARCHIVE_LIMIT,
    );
    expect(board.byDate['2026-11-25'].entries[2].rank).toBe(3);
    expect(
      board.buckets.every((b) => b.entries.every((e) => e.runId !== 'prev-week')),
    ).toBe(true);
  });

  it('8) generates compact 1~2 line team intro and timeline Team Story and serializes them into HOF & Daily Ranking snapshots', () => {
    const intro = generateCompactTeamIntro({
      clubName: 'FC 트레블',
      managerName: '김명장',
      managerTraitId: 'tiki_taka',
      managerRating: 95,
      staffCoachId: 'tactic_possession',
      formation: '3-2-4-1',
      tactic: 'possession',
      baseAvgOvr: 85.4,
      effectiveOvr: 88.2,
      chemistry: 92,
      awakenedCount: 2,
      classicCount: 1,
      ffpTier: 0,
    });
    expect(intro.length).toBeGreaterThan(20);
    expect(intro).toContain('3-2-4-1');
    expect(intro).toContain('각성');

    const awakenedStarter = {
      ...ACTIVE_PLAYERS[0],
      ovr: 89,
      awakening: {
        originalOvr: 83,
        ovrGain: 6,
        round: 18,
        competition: 'league' as const,
        statDeltas: [{ key: 'pas', label: '패스', before: 84, after: 91 }],
      },
    };
    const starters = [awakenedStarter, ...ACTIVE_PLAYERS.slice(1, 11)];
    const bench = ACTIVE_PLAYERS.slice(11, 16);

    const story = generateSoloSeasonTeamStory({
      userClubName: 'FC 트레블',
      managerName: '김명장',
      managerTraitId: 'tiki_taka',
      managerRating: 95,
      staffCoachId: 'tactic_possession',
      formation: '3-2-4-1',
      tactic: 'possession',
      leagueName: '프리미어리그',
      clubs: [
        {
          id: 'user',
          name: 'FC 트레블',
          shortName: 'FCT',
          primaryColor: '#10b981',
          secondaryColor: '#0f172a',
          att: 85,
          mid: 85,
          def: 85,
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
          att: 88,
          mid: 88,
          def: 87,
          formation: '4-3-3',
          defaultTactic: 'possession',
          topScorers: ['X', 'Y', 'Z'],
        },
      ],
      standings: [
        {
          teamId: 'user',
          teamName: 'FC 트레블',
          shortName: 'FCT',
          primaryColor: '#10b981',
          secondaryColor: '#0f172a',
          isUser: true,
          played: 38,
          won: 30,
          drawn: 6,
          lost: 2,
          goalsFor: 88,
          goalsAgainst: 24,
          goalDifference: 64,
          points: 96,
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
          drawn: 7,
          lost: 4,
          goalsFor: 79,
          goalsAgainst: 31,
          goalDifference: 48,
          points: 88,
          form: ['W', 'D', 'W', 'L', 'W'],
        },
      ],
      fixtures: [],
      totalRounds: 38,
      userMatchHistory: [
        {
          fixtureId: 'fix-1',
          round: 28,
          competition: 'league',
          homeTeamId: 'user',
          awayTeamId: 'ai-city',
          homeGoals: 3,
          awayGoals: 2,
          halftimeHomeGoals: 0,
          halftimeAwayGoals: 2,
          homePossession: 56,
          homeShots: 16,
          awayShots: 9,
          homeShotsOnTarget: 8,
          awayShotsOnTarget: 4,
          homeXg: 2.6,
          awayXg: 1.4,
          homeTactic: 'possession',
          awayTactic: 'possession',
          homeFormation: '3-2-4-1',
          awayFormation: '4-3-3',
          homeTacticBonus: 0,
          awayTacticBonus: 0,
          events: [
            {
              minute: 85,
              half: 2,
              type: 'goal',
              teamId: 'user',
              scorerName: awakenedStarter.name,
              description: '역전 결승골!',
            },
          ],
          playerRatings: [],
          momPlayerId: awakenedStarter.id,
          momPlayerName: awakenedStarter.name,
          momRating: 8.6,
        },
      ],
      userCupMatchHistory: [],
      userUclMatchHistory: [],
      cup: null,
      ucl: null,
      starters,
      bench,
      combinedStatsMap: {},
      baseAvgOvr: 84.5,
      effectiveOvr: 87.9,
      chemistry: 92,
      ffpTier: 0,
      userClubId: 'user',
    });

    expect(story.intro.length).toBeGreaterThan(20);
    expect(story.highlights.length).toBeGreaterThanOrEqual(2);
    expect(
      story.highlights.some(
        (h) => h.kind === 'comeback' || h.kind === 'awakening',
      ),
    ).toBe(true);

    const hofEntry: HallOfFameEntry = {
      id: 'hof-story-1',
      runId: 'run-story-1',
      ruleEra: 'v9.0',
      completedAt: '2026-11-26T05:00:00.000Z',
      userClub: {
        name: 'FC 트레블',
        shortName: 'FCT',
        primaryColor: '#10b981',
        secondaryColor: '#0f172a',
        pattern: 'solid',
      },
      managerName: '김명장',
      managerAvatar: DEFAULT_MANAGER_AVATAR,
      managerTraitId: 'tiki_taka',
      staffCoachId: 'tactic_possession',
      managerRating: 95,
      leagueId: 'epl',
      leagueKoreanName: '프리미어리그',
      formation: '3-2-4-1',
      defaultTactic: 'possession',
      finalLeagueRank: 1,
      leaguePoints: 96,
      leagueTotalRounds: 38,
      leagueRecord: '30승 6무 2패',
      cupName: 'FA컵',
      cupResultLabel: '우승',
      cupWon: true,
      uclResultLabel: '우승',
      uclWon: true,
      isTreble: true,
      isLeagueChampion: true,
      teamAvgOvr: 84.5,
      chemistry: 92,
      seasonScore: {
        leagueConvertedScore: 3000,
        leagueRankBonus: 1492,
        cupBonus: 850,
        uclBonus: 2500,
        honorsBonus: 1600,
        underdogBonus: 300,
        squadCraftBonus: 500,
        awardsBonus: 350,
        totalScore: 10592,
        grade: 'S+',
      },
      trophies: ['프리미어리그 우승', 'FA컵 우승', 'UEFA 챔피언스리그 우승'],
      topScorerSummary: '음바페 (31골 10도움)',
      starters: [],
      bench: [],
      fullStarters: starters,
      fullBench: bench,
      unlockedAchievementIds: [],
      teamStory: story,
    };

    expect(resolveHofTeamStory(hofEntry).intro).toBe(story.intro);

    const payload = buildGlobalSubmissionPayload(hofEntry);
    expect(payload.squad_snapshot.staffCoachId).toBe('tactic_possession');
    expect(payload.squad_snapshot.teamStory?.intro).toBe(story.intro);

    const reconstructedStory = resolveGlobalEntryTeamStory({
      id: 'g-1',
      runId: 'run-story-1',
      ruleEra: 'v9.0',
      rank: 1,
      seasonScore: 10592,
      grade: 'S+',
      clubName: 'FC 트레블',
      managerName: '김명장',
      leagueId: 'epl',
      leagueKoreanName: '프리미어리그',
      finalLeagueRank: 1,
      leaguePoints: 96,
      leagueTotalRounds: 38,
      leagueRecord: '30승 6무 2패',
      cupName: 'FA컵',
      cupResultLabel: '우승',
      cupWon: true,
      uclResultLabel: '우승',
      uclWon: true,
      isLeagueChampion: true,
      isTreble: true,
      trophies: hofEntry.trophies,
      formation: '3-2-4-1',
      defaultTactic: 'possession',
      managerTraitId: 'tiki_taka',
      staffCoachId: 'tactic_possession',
      managerRating: 95,
      teamAvgOvr: 84.5,
      chemistry: 92,
      avgSynergyOvrBonus: 1.8,
      managerSynergyCount: 8,
      topScorerSummary: hofEntry.topScorerSummary,
      clubProfile: hofEntry.userClub,
      managerAvatar: DEFAULT_MANAGER_AVATAR,
      scoreBreakdown: hofEntry.seasonScore,
      squadSnapshot: payload.squad_snapshot,
      teamStory: payload.squad_snapshot.teamStory,
      achievedAt: hofEntry.completedAt,
    });
    expect(reconstructedStory.intro).toBe(story.intro);
  });

  it('9) persists WhatsNewModal dismissal by current version key and re-shows automatically on newer version', () => {
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
      clearWhatsNewDismissal();
      expect(isWhatsNewDismissed(CURRENT_APP_VERSION)).toBe(false);

      dismissWhatsNewForVersion(CURRENT_APP_VERSION);
      expect(isWhatsNewDismissed(CURRENT_APP_VERSION)).toBe(true);

      // Next release version automatically re-shows the popup!
      expect(isWhatsNewDismissed('v9.9.9')).toBe(false);
    } finally {
      Object.defineProperty(globalThis, 'window', {
        value: origWindow,
        configurable: true,
        writable: true,
      });
    }
  });
});
