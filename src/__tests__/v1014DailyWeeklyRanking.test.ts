import { describe, expect, it } from 'vitest';
import { WHATS_NEW_HIGHLIGHT_RANGE } from '../components/common/WhatsNewModal';
import { CURRENT_APP_VERSION, PATCH_NOTES } from '../data/patchNotes';
import {
  applyDailyTop10RankingLogic,
  getKstWeekEndKey,
  getKstWeekStartKey,
  GLOBAL_DAILY_TOP_LIMIT,
  GLOBAL_PAST_DAY_ARCHIVE_LIMIT,
  GLOBAL_RANKING_RULE_ERA,
  GLOBAL_WEEKLY_TOP_LIMIT,
  groupWeeklyDailyRankings,
} from '../services/globalRankingService';
import { DEFAULT_MANAGER_AVATAR } from '../types/game';
import type { GlobalHofRankingEntry } from '../types/legacy';

function makeRankingEntry(
  runId: string,
  score: number,
  rankingDate: string,
  rankingWeekStart: string,
  opts?: { fullFiveLeaguePool?: boolean; achievedAt?: string },
): GlobalHofRankingEntry {
  return {
    id: `row-${runId}`,
    runId,
    rank: 1,
    ruleEra: GLOBAL_RANKING_RULE_ERA,
    rankingDate,
    rankingWeekStart,
    seasonScore: score,
    grade: 'S+',
    clubName: `FC ${runId}`,
    managerName: '김명장',
    leagueId: 'epl',
    leagueKoreanName: '프리미어리그',
    finalLeagueRank: 1,
    leaguePoints: 95,
    leagueTotalRounds: 38,
    leagueRecord: '30승 5무 3패',
    cupName: 'FA컵',
    cupResultLabel: '우승',
    cupWon: true,
    uclResultLabel: '우승',
    uclWon: true,
    isLeagueChampion: true,
    isTreble: true,
    trophies: ['프리미어리그 우승', 'FA컵 우승', 'UCL 우승'],
    formation: '4-3-3',
    defaultTactic: 'possession',
    managerTraitId: 'tiki_taka',
    managerRating: 94,
    teamAvgOvr: 87.2,
    chemistry: 96,
    avgSynergyOvrBonus: 2.8,
    managerSynergyCount: 8,
    topScorerSummary: '에이스 28G 9A',
    clubProfile: {
      name: `FC ${runId}`,
      shortName: 'FCR',
      primaryColor: '#10b981',
      secondaryColor: '#0f172a',
      pattern: 'solid',
    },
    managerAvatar: DEFAULT_MANAGER_AVATAR,
    scoreBreakdown: {
      ruleEra: GLOBAL_RANKING_RULE_ERA,
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
    squadSnapshot: {
      ruleEra: GLOBAL_RANKING_RULE_ERA,
      fullFiveLeaguePool: opts?.fullFiveLeaguePool ?? true,
      starters: [],
      bench: [],
    },
    achievedAt: opts?.achievedAt ?? `${rankingDate}T05:00:00.000Z`,
  };
}

describe('v10.1.4 Daily + Weekly (Mon~Sun) TOP 10 Ranking System', () => {
  it('1) computes exact KST Monday~Sunday week boundaries', () => {
    // 2026-11-26 is Thursday KST -> Mon 2026-11-23 ~ Sun 2026-11-29
    const thuNoonKst = new Date('2026-11-26T03:00:00.000Z');
    expect(getKstWeekStartKey(thuNoonKst)).toBe('2026-11-23');
    expect(getKstWeekEndKey(thuNoonKst)).toBe('2026-11-29');

    // Sunday 23:30 KST still belongs to the same week (Mon 2026-11-23 ~ Sun 2026-11-29)
    const sunLateKst = new Date('2026-11-29T14:30:00.000Z');
    expect(getKstWeekStartKey(sunLateKst)).toBe('2026-11-23');
    expect(getKstWeekEndKey(sunLateKst)).toBe('2026-11-29');

    // Monday 00:05 KST rolls cleanly to new week (Mon 2026-11-30 ~ Sun 2026-12-06)
    const monEarlyKst = new Date('2026-11-29T15:05:00.000Z');
    expect(getKstWeekStartKey(monEarlyKst)).toBe('2026-11-30');
    expect(getKstWeekEndKey(monEarlyKst)).toBe('2026-12-06');
  });

  it('2) builds combined Mon~Sun Weekly TOP 10 alongside Daily Today TOP 10 & Past-Day TOP 3 archive', () => {
    const thuNoonKst = new Date('2026-11-26T03:00:00.000Z');
    const weekStart = '2026-11-23';

    const entries: GlobalHofRankingEntry[] = [
      // Monday had 6 super-high scores (14000..13500): daily archive keeps TOP 3,
      // but ALL 6 belong in Mon~Sun Weekly TOP 10!
      ...Array.from({ length: 6 }, (_, i) =>
        makeRankingEntry(`mon-${i + 1}`, 14000 - i * 100, '2026-11-23', weekStart),
      ),
      // Tuesday had 3 strong scores (13950, 13650, 12800)
      makeRankingEntry('tue-1', 13950, '2026-11-24', weekStart),
      makeRankingEntry('tue-2', 13650, '2026-11-24', weekStart),
      makeRankingEntry('tue-3', 12800, '2026-11-24', weekStart),
      // Today (Thursday) has 22 scores (14100 down to 9900) -> capped to Daily TOP 20
      ...Array.from({ length: 22 }, (_, i) =>
        makeRankingEntry(`thu-${i + 1}`, 14100 - i * 200, '2026-11-26', weekStart),
      ),
      // Previous week record (must be excluded from both Daily & Weekly)
      makeRankingEntry('prev-week', 19999, '2026-11-22', '2026-11-16'),
      // Partial-pool record (must be excluded from both Daily & Weekly)
      makeRankingEntry('partial-pool', 18888, '2026-11-26', weekStart, {
        fullFiveLeaguePool: false,
      }),
    ];

    const board = groupWeeklyDailyRankings(entries, thuNoonKst);

    // Daily caps intact (Today TOP 20, Past-day TOP 3)
    expect(board.weekStartKey).toBe('2026-11-23');
    expect(board.weekEndKey).toBe('2026-11-29');
    expect(GLOBAL_DAILY_TOP_LIMIT).toBe(20);
    expect(GLOBAL_WEEKLY_TOP_LIMIT).toBe(10);
    expect(board.todayEntries.length).toBe(GLOBAL_DAILY_TOP_LIMIT);
    expect(board.byDate['2026-11-23'].entries.length).toBe(
      GLOBAL_PAST_DAY_ARCHIVE_LIMIT,
    );

    // Weekly TOP 10 combines Mon~Thu and retains Monday's #4~#5 high scorers!
    expect(board.weeklyEntries.length).toBe(GLOBAL_WEEKLY_TOP_LIMIT);
    expect(board.weeklyEntries[0].runId).toBe('thu-1'); // 14100
    expect(board.weeklyEntries[0].rank).toBe(1);
    expect(board.weeklyEntries[1].runId).toBe('mon-1'); // 14000
    expect(board.weeklyEntries[2].runId).toBe('tue-1'); // 13950
    expect(board.weeklyEntries.some((e) => e.runId === 'mon-4')).toBe(true); // 13700 (4th on Monday -> still Weekly TOP 10!)
    expect(board.weeklyEntries.some((e) => e.runId === 'mon-5')).toBe(true); // 13600 (10th overall)
    expect(board.weeklyEntries.some((e) => e.runId === 'mon-6')).toBe(false); // 13500 (11th overall -> outside TOP 10)
    expect(board.weeklyEntries.every((e) => e.runId !== 'prev-week')).toBe(true);
    expect(board.weeklyEntries.every((e) => e.runId !== 'partial-pool')).toBe(
      true,
    );
    expect(board.weeklyCutoffScore).toBe(13600);
  });

  it('3) preserves Mon~Sun Weekly TOP 10 entries when new daily records are submitted', () => {
    const tueNoonKst = new Date('2026-11-24T03:00:00.000Z');
    const weekStart = '2026-11-23';

    const existing: GlobalHofRankingEntry[] = Array.from({ length: 5 }, (_, i) =>
      makeRankingEntry(`mon-${i + 1}`, 13500 - i * 100, '2026-11-23', weekStart),
    );
    const candidate = makeRankingEntry('tue-new', 13600, '2026-11-24', weekStart);

    const { board, result } = applyDailyTop10RankingLogic(
      existing,
      candidate,
      tueNoonKst,
    );
    expect(result.ok).toBe(true);
    expect(result.entered).toBe(true);
    expect(result.rank).toBe(1);

    // Monday daily archive shows TOP 3, while Weekly TOP 10 retains all 5 Monday teams + Tuesday #1 = 6 teams
    expect(board.byDate['2026-11-23'].entries.length).toBe(3);
    expect(board.weeklyEntries.length).toBe(6);
    expect(board.weeklyEntries[0].runId).toBe('tue-new');
    expect(board.weeklyEntries.some((e) => e.runId === 'mon-4')).toBe(true);
    expect(board.weeklyEntries.some((e) => e.runId === 'mon-5')).toBe(true);
  });

  it('4) keeps v10.1.5 release metadata synchronized across patchNotes and WhatsNewModal', () => {
    expect(PATCH_NOTES[0].version).toBe(CURRENT_APP_VERSION);
    expect(PATCH_NOTES.some((p) => p.version === 'v10.1.5')).toBe(true);
    expect(WHATS_NEW_HIGHLIGHT_RANGE).toContain(CURRENT_APP_VERSION);
  });
});
