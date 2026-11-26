import { describe, expect, it } from 'vitest';
import dreamMatchSrc from '../components/dream/DreamMatchArena.tsx?raw';
import soloTutorialSrc from '../components/guide/SoloVisualTutorialModal.tsx?raw';
import systemGuideSrc from '../components/guide/SystemGuideModal.tsx?raw';
import legacyHubSrc from '../components/legacy/LegacyHubModal.tsx?raw';
import { FORMATIONS } from '../data/formations';
import {
  buildHistoricalClubForMatch,
  ERA_BEST_XI_DREAM_TEAMS,
  HISTORICAL_BENCHMARK_TEAMS,
  HISTORICAL_ERA_LEAGUE_STRENGTH,
} from '../data/historicalTeams';
import { ACTIVE_PLAYERS } from '../engine/dataLoader';
import {
  computeBaseLeagueRankBonus,
  computeSeasonScore,
  getLeagueDifficultyFactor,
  getModernLeagueRankBonusTable,
  getModernLeagueStrengthAvg,
  HOF_RULE_ERA_V9,
  LEGACY_STORAGE_KEY,
  loadLegacyState,
  recalibrateScoreBreakdownForLeagueDifficulty,
} from '../engine/legacyEngine';
import { evaluatePositionFit } from '../engine/positionEngine';
import {
  filterAndRankV9GlobalRows,
  type RawGlobalRankingRow,
} from '../services/globalRankingService';
import { DEFAULT_MANAGER_AVATAR } from '../types/game';
import type { HallOfFameEntry, SeasonScoreBreakdown } from '../types/legacy';

describe('v9.3.1 League Difficulty Score Calibration, 6-Decade Era Best XI & Guidebook Sync', () => {
  it('1) differentiates 2026-27 5-league championship bonuses strictly by live league strength (EPL > Serie A > La Liga > Bundesliga > Ligue 1)', () => {
    const table = getModernLeagueRankBonusTable();
    expect(table).toHaveLength(5);
    expect(table.map((r) => r.leagueId)).toEqual([
      'epl',
      'seriea',
      'laliga',
      'bundesliga',
      'ligue1',
    ]);

    const epl = table[0];
    const ligue1 = table[4];
    expect(epl.leagueStrengthAvg).toBeGreaterThan(80);
    expect(ligue1.leagueStrengthAvg).toBeLessThan(76.5);
    expect(epl.firstPlaceBonus).toBeGreaterThan(1450);
    expect(ligue1.firstPlaceBonus).toBeLessThan(1000);
    expect(epl.firstPlaceBonus - ligue1.firstPlaceBonus).toBeGreaterThan(450);

    // Same record in EPL vs Ligue 1 yields strictly higher championship score in EPL
    const common = {
      leaguePoints: 88,
      leaguePlayed: 38,
      leagueGoalDifference: 55,
      leagueLosses: 4,
      finalLeagueRank: 1,
      cup: null,
      ucl: null,
      teamAvgOvr: 85.5,
      chemistry: 88,
    };
    const eplScore = computeSeasonScore({ ...common, leagueId: 'epl' });
    const ligue1Score = computeSeasonScore({ ...common, leagueId: 'ligue1' });
    expect(eplScore.leagueRankBonus).toBe(epl.firstPlaceBonus);
    expect(ligue1Score.leagueRankBonus).toBe(ligue1.firstPlaceBonus);
    expect(eplScore.totalScore - ligue1Score.totalScore).toBe(
      epl.firstPlaceBonus - ligue1.firstPlaceBonus,
    );
  });

  it('2) evaluates all 24 Historical Benchmark teams using their exact historical era league average (not modern league average)', () => {
    expect(HISTORICAL_BENCHMARK_TEAMS).toHaveLength(24);
    for (const team of HISTORICAL_BENCHMARK_TEAMS) {
      const eraAvg = HISTORICAL_ERA_LEAGUE_STRENGTH[team.id];
      expect(eraAvg, `Missing HISTORICAL_ERA_LEAGUE_STRENGTH for ${team.id}`).toBeDefined();
      expect(team.seasonScore.leagueStrengthAvg).toBe(eraAvg);
      expect(team.seasonScore.leagueDifficultyFactor).toBe(
        getLeagueDifficultyFactor(eraAvg),
      );
      expect(team.seasonScore.leagueRankBaseBonus).toBe(
        computeBaseLeagueRankBonus(team.finalLeagueRank),
      );
      expect(team.seasonScore.leagueRankBonus).toBe(
        Math.round(
          computeBaseLeagueRankBonus(team.finalLeagueRank) *
            getLeagueDifficultyFactor(eraAvg),
        ),
      );
    }

    // Historical era contrast: 14-15 La Liga (UEFA #1 peak) > modern La Liga; 88-89 Serie A > 13-14 Serie A
    const barca1415 = HISTORICAL_BENCHMARK_TEAMS.find((t) => t.id === 'hist-1415-barca')!;
    const milan8889 = HISTORICAL_BENCHMARK_TEAMS.find((t) => t.id === 'hist-8889-milan')!;
    const juve1314 = HISTORICAL_BENCHMARK_TEAMS.find((t) => t.id === 'hist-1314-juventus')!;
    const psg2425 = HISTORICAL_BENCHMARK_TEAMS.find((t) => t.id === 'hist-2425-psg')!;
    const city2223 = HISTORICAL_BENCHMARK_TEAMS.find((t) => t.id === 'hist-2223-mancity')!;

    expect(barca1415.seasonScore.leagueStrengthAvg!).toBeGreaterThan(
      getModernLeagueStrengthAvg('laliga'),
    );
    expect(milan8889.seasonScore.leagueStrengthAvg!).toBeGreaterThan(
      juve1314.seasonScore.leagueStrengthAvg!,
    );
    expect(city2223.seasonScore.leagueRankBonus).toBeGreaterThan(
      psg2425.seasonScore.leagueRankBonus + 450,
    );
  });

  it('3) idempotently recalibrates already-saved personal local HOF entries (including FFP) and Global TOP 15 rankings', () => {
    // Pure helper idempotency + FFP proportionality check
    const rawLigue1Ffp: SeasonScoreBreakdown = {
      leagueConvertedScore: 2600,
      leagueRankBonus: 1200,
      cupBonus: 850,
      uclBonus: 2500,
      honorsBonus: 1500,
      underdogBonus: 0,
      squadCraftBonus: 1350,
      awardsBonus: 0,
      ffpTier: 1,
      ffpPenaltyPct: 6,
      ffpPenaltyPoints: 600,
      totalScore: 9400, // raw 10000 * 0.94
      grade: 'S+',
    };
    const pass1 = recalibrateScoreBreakdownForLeagueDifficulty(rawLigue1Ffp, 'ligue1', 1);
    expect(pass1.changed).toBe(true);
    expect(pass1.breakdown.leagueRankBonus).toBeLessThan(1000);
    expect(pass1.breakdown.totalScore).toBeLessThan(9400);
    // Second pass must be a complete no-op
    const pass2 = recalibrateScoreBreakdownForLeagueDifficulty(pass1.breakdown, 'ligue1', 1);
    expect(pass2.changed).toBe(false);
    expect(pass2.breakdown).toEqual(pass1.breakdown);

    // Local HOF storage migration check
    const mem = new Map<string, string>();
    const prevWindow = (globalThis as unknown as { window?: unknown }).window;
    (globalThis as unknown as { window: unknown }).window = {
      localStorage: {
        getItem: (k: string) => mem.get(k) ?? null,
        setItem: (k: string, v: string) => mem.set(k, v),
        removeItem: (k: string) => mem.delete(k),
      },
    };
    try {
      const makeLocalHof = (
        id: string,
        leagueId: 'epl' | 'ligue1',
        totalScore: number,
      ): HallOfFameEntry => ({
        id,
        runId: `run-${id}`,
        ruleEra: HOF_RULE_ERA_V9,
        completedAt: '2026-11-25T10:00:00.000Z',
        userClub: {
          name: id,
          shortName: 'TST',
          primaryColor: '#10b981',
          secondaryColor: '#ffffff',
          pattern: 'solid',
        },
        managerName: '감독',
        managerAvatar: DEFAULT_MANAGER_AVATAR,
        managerTraitId: 'tiki_taka',
        managerRating: 92,
        leagueId,
        leagueKoreanName: leagueId === 'epl' ? '프리미어리그' : '리그 1',
        formation: '4-3-3',
        defaultTactic: 'possession',
        finalLeagueRank: 1,
        leaguePoints: 86,
        leagueTotalRounds: leagueId === 'epl' ? 38 : 34,
        leagueRecord: '27승 5무 6패',
        cupName: '자국 컵',
        cupResultLabel: '우승',
        cupWon: true,
        uclResultLabel: '우승',
        uclWon: true,
        isTreble: true,
        isLeagueChampion: true,
        teamAvgOvr: 86,
        chemistry: 88,
        seasonScore: {
          leagueConvertedScore: 2400,
          leagueRankBonus: 1200,
          cupBonus: 850,
          uclBonus: 2500,
          honorsBonus: 1500,
          underdogBonus: 0,
          squadCraftBonus: totalScore - 8450,
          awardsBonus: 0,
          ruleEra: HOF_RULE_ERA_V9,
          totalScore,
          grade: 'S+',
        },
        trophies: [],
        topScorerSummary: '-',
        starters: [],
        bench: [],
        fullStarters: ACTIVE_PLAYERS.slice(0, 11),
        fullBench: ACTIVE_PLAYERS.slice(11, 16),
        unlockedAchievementIds: [],
      });

      mem.set(
        LEGACY_STORAGE_KEY,
        JSON.stringify({
          version: 1,
          hofMigrationEra: HOF_RULE_ERA_V9,
          hallOfFame: [
            makeLocalHof('local-epl', 'epl', 9500),
            makeLocalHof('local-l1', 'ligue1', 9700),
          ],
          unlockedAchievements: {},
          dreamMatchRecords: {},
        }),
      );

      const loaded1 = loadLegacyState();
      const eplLocal = loaded1.hallOfFame.find((e) => e.id === 'local-epl')!;
      const l1Local = loaded1.hallOfFame.find((e) => e.id === 'local-l1')!;
      const bonusTable = getModernLeagueRankBonusTable();
      const expectedEpl = 9500 + (bonusTable.find((r) => r.leagueId === 'epl')!.firstPlaceBonus - 1200);
      const expectedL1 = 9700 + (bonusTable.find((r) => r.leagueId === 'ligue1')!.firstPlaceBonus - 1200);
      // EPL overtakes Ligue 1 cleanly after league-difficulty recalibration!
      expect(eplLocal.seasonScore.totalScore).toBe(expectedEpl);
      expect(l1Local.seasonScore.totalScore).toBe(expectedL1);
      expect(expectedEpl).toBeGreaterThan(expectedL1);
      expect(loaded1.hofSummaryCache?.bestScore).toBe(expectedEpl);

      // Reloading again stays identical (idempotent)
      const loaded2 = loadLegacyState();
      expect(loaded2.hallOfFame.find((e) => e.id === 'local-epl')!.seasonScore.totalScore).toBe(expectedEpl);
      expect(loaded2.hallOfFame.find((e) => e.id === 'local-l1')!.seasonScore.totalScore).toBe(expectedL1);
    } finally {
      (globalThis as unknown as { window?: unknown }).window = prevWindow;
    }

    // Global TOP 15 automatic recalibration & live re-ranking
    const makeGlobalRow = (
      id: string,
      leagueId: 'epl' | 'ligue1',
      score: number,
    ): RawGlobalRankingRow => ({
      id,
      run_id: `run-${id}`,
      rule_era: 'v9.0',
      season_score: score,
      grade: 'S+',
      club_name: id,
      manager_name: '감독',
      league_id: leagueId,
      league_korean_name: leagueId === 'epl' ? '프리미어리그' : '리그 1',
      final_league_rank: 1,
      league_points: 88,
      league_total_rounds: leagueId === 'epl' ? 38 : 34,
      league_record: '28승 4무 6패',
      cup_name: '컵',
      cup_result_label: '우승',
      cup_won: true,
      ucl_result_label: '우승',
      ucl_won: true,
      is_league_champion: true,
      is_treble: true,
      trophies: [],
      formation: '4-3-3',
      default_tactic: 'possession',
      manager_trait_id: 'tiki_taka',
      manager_rating: 92,
      team_avg_ovr: 86,
      chemistry: 88,
      top_scorer_summary: '-',
      club_profile: {},
      manager_avatar: DEFAULT_MANAGER_AVATAR,
      score_breakdown: {
        leagueConvertedScore: 2400,
        leagueRankBonus: 1200,
        cupBonus: 850,
        uclBonus: 2500,
        honorsBonus: 1500,
        underdogBonus: 0,
        squadCraftBonus: score - 8450,
        awardsBonus: 0,
        ruleEra: 'v9.0',
        totalScore: score,
        grade: 'S+',
      },
      squad_snapshot: { ruleEra: 'v9.0', starters: [], bench: [] },
      achieved_at: '2026-11-25T10:00:00.000Z',
    });

    const ranked = filterAndRankV9GlobalRows([
      makeGlobalRow('global-l1', 'ligue1', 9800), // 9800 - 222 = 9578
      makeGlobalRow('global-epl', 'epl', 9550), // 9550 + 292 = 9842
    ]);
    expect(ranked.entries[0].id).toBe('global-epl');
    expect(ranked.entries[0].rank).toBe(1);
    const bonusTableGlobal = getModernLeagueRankBonusTable();
    const expectedGlobalEpl =
      9550 + (bonusTableGlobal.find((r) => r.leagueId === 'epl')!.firstPlaceBonus - 1200);
    const expectedGlobalL1 =
      9800 + (bonusTableGlobal.find((r) => r.leagueId === 'ligue1')!.firstPlaceBonus - 1200);
    expect(ranked.entries[0].seasonScore).toBe(expectedGlobalEpl);
    expect(ranked.entries[1].id).toBe('global-l1');
    expect(ranked.entries[1].seasonScore).toBe(expectedGlobalL1);
    expect(expectedGlobalEpl).toBeGreaterThan(expectedGlobalL1);
  });

  it('4) provides 6 dedicated Decade Best XI teams (1960s~2010s) with 0 starter penalty and dedicated Dream Match / HOF access', () => {
    expect(ERA_BEST_XI_DREAM_TEAMS.map((t) => t.id)).toEqual([
      'era-60s-xi',
      'era-70s-xi',
      'era-80s-xi',
      'era-90s-xi',
      'era-00s-xi',
      'era-10s-xi',
    ]);

    for (const team of ERA_BEST_XI_DREAM_TEAMS) {
      expect(team.starters).toHaveLength(11);
      expect(team.bench).toHaveLength(5);
      const formation = FORMATIONS[team.formation];
      for (let i = 0; i < 11; i += 1) {
        const fit = evaluatePositionFit(
          team.starters[i],
          formation.slots[i].subPosition,
          team.managerTraitId,
          formation.slots[i].alternateSubPositions,
        );
        expect(
          fit.penalty,
          `${team.id} starter #${i} (${team.starters[i].name})`,
        ).toBe(0);
      }
      const built = buildHistoricalClubForMatch(team);
      expect(built.fullRoster).toHaveLength(16);
    }

    // Dedicated UI presence in DreamMatchArena and LegacyHubModal
    expect(dreamMatchSrc.includes('역대 년도별 베스트 11')).toBe(true);
    expect(legacyHubSrc.includes('ERA_BEST_XI_DREAM_TEAMS')).toBe(true);
    expect(legacyHubSrc.includes('년도별 베스트 11')).toBe(true);
  });

  it('5) keeps Guidebook & Visual Tutorial 100% synced with zero stale legacy strings', () => {
    for (const stale of [
      '엘리트 88+',
      '레전드 제외',
      '레전드 고정가',
      '레전드 FA 협상',
      '레전드 확률',
      '레전드 상한',
      '황금 [LEGEND]',
    ]) {
      expect(systemGuideSrc.includes(stale), `SystemGuideModal stale "${stale}"`).toBe(false);
      expect(soloTutorialSrc.includes(stale), `SoloVisualTutorialModal stale "${stale}"`).toBe(false);
    }

    expect(systemGuideSrc.includes('getModernLeagueRankBonusTable')).toBe(true);
    expect(systemGuideSrc.includes('5대 리그 난이도별 리그 우승·순위 점수 보정')).toBe(true);
    expect(systemGuideSrc.includes('년도별 베스트 11')).toBe(true);
    expect(soloTutorialSrc.includes('ELITE_PAIR_MIN_OVR')).toBe(true);
    expect(soloTutorialSrc.includes('클래식 제외')).toBe(true);
  });
});
