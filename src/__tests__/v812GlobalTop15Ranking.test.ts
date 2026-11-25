import { describe, expect, it } from 'vitest';
import schemaSql from '../../supabase/schema.sql?raw';
import { ACTIVE_PLAYERS, LEGEND_PLAYERS } from '../engine/dataLoader';
import {
  HOF_AUTO_INDUCTION_MIN_SCORE,
  isEligibleForAutoHofInduction,
} from '../engine/legacyEngine';
import {
  applyTop15RankingLogic,
  buildGlobalClubForMatch,
  buildGlobalSubmissionPayload,
  buildSquadSnapshotFromHofEntry,
  GLOBAL_TOP15_LIMIT,
  reconstructSquadFromGlobalRanking,
} from '../services/globalRankingService';
import { DEFAULT_MANAGER_AVATAR } from '../types/game';
import type {
  GlobalHofRankingEntry,
  HallOfFameEntry,
  SeasonScoreBreakdown,
} from '../types/legacy';
import type { Player } from '../types/player';

function makeScoreBreakdown(totalScore: number): SeasonScoreBreakdown {
  const grade: SeasonScoreBreakdown['grade'] =
    totalScore >= 7200
      ? 'S+'
      : totalScore >= 5600
        ? 'S'
        : totalScore >= 4200
          ? 'A+'
          : 'A';
  return {
    leagueConvertedScore: Math.round(totalScore * 0.4),
    leagueRankBonus: 1200,
    cupBonus: 850,
    uclBonus: 2500,
    honorsBonus: 1600,
    underdogBonus: 0,
    squadCraftBonus: Math.max(0, totalScore - 6150),
    awardsBonus: 350,
    totalScore,
    grade,
  };
}

function makeSampleHofEntry(overrides?: Partial<HallOfFameEntry>): HallOfFameEntry {
  const starters: Player[] = [
    ...LEGEND_PLAYERS.slice(0, 2),
    ...ACTIVE_PLAYERS.slice(0, 8),
    {
      id: 'gen-custom-st-999',
      name: '유스 유망주',
      position: 'FW',
      mainPositions: ['ST'],
      secondaryPositions: [],
      ovr: 81,
      nationality: '잉글랜드',
      nationalityCode: 'GB',
      leagueId: 'epl',
      club: 'FC 테스트',
      att: 83,
      mid: 74,
      def: 46,
      stamina: 85,
      playstyles: ['poacher'],
      scoutNote: '테스트 생성 선수',
      isLegend: false,
      isGenerated: true,
    },
  ];
  const bench: Player[] = ACTIVE_PLAYERS.slice(10, 15);
  const totalScore = overrides?.seasonScore?.totalScore ?? 11250;

  return {
    id: 'hof-test-1',
    runId: 'run-test-1',
    completedAt: '2026-11-24T12:00:00.000Z',
    userClub: {
      name: 'FC 테스트 유나이티드',
      shortName: 'FTU',
      primaryColor: '#10b981',
      secondaryColor: '#0f172a',
      pattern: 'sash',
    },
    managerName: '김전술',
    managerAvatar: DEFAULT_MANAGER_AVATAR,
    managerTraitId: 'tiki_taka',
    managerRating: 94,
    leagueId: 'epl',
    leagueKoreanName: '프리미어리그',
    formation: '4-3-3',
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
    teamAvgOvr: 88.4,
    chemistry: 92,
    avgSynergyOvrBonus: 1.8,
    managerSynergyCount: 8,
    seasonScore: makeScoreBreakdown(totalScore),
    trophies: ['프리미어리그 우승', 'FA컵 우승', 'UEFA 챔피언스리그 우승'],
    topScorerSummary: `${starters[0].name} (28골 12도움)`,
    starters: starters.map((p) => ({
      id: p.id,
      name: p.name,
      ovr: p.ovr,
      position: p.position,
      mainPositions: [...p.mainPositions],
      isLegend: p.isLegend,
      goals: 5,
      assists: 3,
      avgRating: 7.8,
    })),
    bench: bench.map((p) => ({
      id: p.id,
      name: p.name,
      ovr: p.ovr,
      position: p.position,
      mainPositions: [...p.mainPositions],
      isLegend: p.isLegend,
      goals: 1,
      assists: 1,
      avgRating: 7.1,
    })),
    fullStarters: starters,
    fullBench: bench,
    unlockedAchievementIds: ['dynasty_treble'],
    ...overrides,
  };
}

function makeRankingEntry(
  idx: number,
  score: number,
  opts?: Partial<GlobalHofRankingEntry>,
): GlobalHofRankingEntry {
  const hof = makeSampleHofEntry({
    id: `hof-${idx}`,
    runId: `run-${idx}`,
    seasonScore: makeScoreBreakdown(score),
  });
  return {
    id: `uuid-${String(idx).padStart(2, '0')}`,
    runId: `run-${idx}`,
    rank: idx,
    seasonScore: score,
    grade: hof.seasonScore.grade,
    clubName: `FC 클럽 ${idx}`,
    managerName: `감독 ${idx}`,
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
    isTreble: false,
    trophies: ['프리미어리그 우승'],
    formation: '4-3-3',
    defaultTactic: 'possession',
    managerTraitId: 'tiki_taka',
    managerRating: 92,
    teamAvgOvr: 87.5,
    chemistry: 88,
    avgSynergyOvrBonus: 1.5,
    managerSynergyCount: 6,
    topScorerSummary: '에이스 (22골 8도움)',
    clubProfile: {
      name: `FC 클럽 ${idx}`,
      shortName: `C${idx}`,
      primaryColor: '#10b981',
      secondaryColor: '#0f172a',
      pattern: 'solid',
    },
    managerAvatar: DEFAULT_MANAGER_AVATAR,
    scoreBreakdown: hof.seasonScore,
    squadSnapshot: buildSquadSnapshotFromHofEntry(hof),
    achievedAt: `2026-11-${String(Math.min(28, 1 + idx)).padStart(2, '0')}T10:00:00.000Z`,
    ...opts,
  };
}

describe('v8.12 Global TOP 15 Ranking, Auto-Prune & 1v1 Challenge', () => {
  it('raises Hall of Fame auto-induction threshold to 6,500 (above 5,500, below S+ 7,200)', () => {
    expect(HOF_AUTO_INDUCTION_MIN_SCORE).toBe(6500);
    expect(
      isEligibleForAutoHofInduction({
        seasonScore: makeScoreBreakdown(6499),
        wonUcl: false,
        isTreble: false,
      }),
    ).toBe(false);
    expect(
      isEligibleForAutoHofInduction({
        seasonScore: makeScoreBreakdown(6500),
        wonUcl: false,
        isTreble: false,
      }),
    ).toBe(true);
  });

  it('maintains strict TOP 15 cap, prunes 16th immediately, and respects tie-breakers', () => {
    const initial15 = Array.from({ length: 15 }, (_, i) =>
      makeRankingEntry(i + 1, 10000 - i * 100),
    );
    // 15th currently has score 8600
    expect(initial15[14].seasonScore).toBe(8600);

    // 1) Entry scoring 8500 -> rejected, list stays 15
    const belowCutoff = makeRankingEntry(16, 8500);
    const resFail = applyTop15RankingLogic(initial15, belowCutoff);
    expect(resFail.result.entered).toBe(false);
    expect(resFail.result.rank).toBeNull();
    expect(resFail.result.prunedCount).toBe(0);
    expect(resFail.nextEntries.length).toBe(GLOBAL_TOP15_LIMIT);
    expect(resFail.nextEntries.some((e) => e.runId === 'run-16')).toBe(false);

    // 2) Entry scoring 9550 -> enters at #6, pushes 8600 out (prunedCount = 1), stays exactly 15
    const qualifier = makeRankingEntry(17, 9550);
    const resEnter = applyTop15RankingLogic(initial15, qualifier);
    expect(resEnter.result.entered).toBe(true);
    expect(resEnter.result.rank).toBe(6);
    expect(resEnter.result.prunedCount).toBe(1);
    expect(resEnter.nextEntries.length).toBe(GLOBAL_TOP15_LIMIT);
    expect(resEnter.nextEntries.some((e) => e.runId === 'run-15')).toBe(false);
    expect(resEnter.result.cutoffScore).toBe(8700);

    // 3) Duplicate runId guard -> does not insert twice
    const dupRes = applyTop15RankingLogic(resEnter.nextEntries, qualifier);
    expect(dupRes.result.alreadyExists).toBe(true);
    expect(dupRes.result.rank).toBe(6);
    expect(dupRes.result.prunedCount).toBe(0);
    expect(dupRes.nextEntries.length).toBe(GLOBAL_TOP15_LIMIT);

    // 4) Tie-breaker: same score -> Treble beats non-Treble; same treble/ucl -> earlier achievedAt wins
    const tieTreble = makeRankingEntry(18, 10000, {
      isTreble: true,
      achievedAt: '2026-11-28T00:00:00.000Z',
    });
    const resTie = applyTop15RankingLogic(initial15, tieTreble);
    expect(resTie.result.entered).toBe(true);
    expect(resTie.result.rank).toBe(1);
  });

  it('serializes compact squad snapshots and reconstructs real + generated players losslessly for 1v1 match', () => {
    const hof = makeSampleHofEntry();
    const payload = buildGlobalSubmissionPayload(hof);

    expect(payload.run_id).toBe('run-test-1');
    expect(payload.squad_snapshot.starters.length).toBe(11);
    expect(payload.squad_snapshot.bench.length).toBe(5);
    // Real player stays lightweight (no redundant att/mid/def), generated player preserves fallback stats
    const realSnap = payload.squad_snapshot.starters[0];
    const genSnap = payload.squad_snapshot.starters[10];
    expect(realSnap.att).toBeUndefined();
    expect(genSnap.isGenerated).toBe(true);
    expect(genSnap.att).toBe(83);

    const rankingEntry = makeRankingEntry(1, hof.seasonScore.totalScore, {
      formation: hof.formation,
      defaultTactic: hof.defaultTactic,
      managerName: hof.managerName ?? '감독',
      managerTraitId: hof.managerTraitId,
      managerRating: hof.managerRating ?? 94,
      squadSnapshot: payload.squad_snapshot,
    });

    const reconstructed = reconstructSquadFromGlobalRanking(rankingEntry);
    expect(reconstructed.starters.length).toBe(11);
    expect(reconstructed.bench.length).toBe(5);
    expect(reconstructed.starters[0].id).toBe(hof.fullStarters![0].id);
    expect(reconstructed.starters[0].attrs).toBeDefined();
    expect(reconstructed.starters[10].name).toBe('유스 유망주');
    expect(reconstructed.starters[10].att).toBe(83);

    const matchBundle = buildGlobalClubForMatch(rankingEntry);
    expect(matchBundle.starters.length).toBe(11);
    expect(matchBundle.bench.length).toBe(5);
    expect(matchBundle.fullRoster.length).toBe(16);
    expect(matchBundle.club.formation).toBe('4-3-3');
    expect(matchBundle.club.defaultTactic).toBe('possession');
    expect(matchBundle.club.manager?.traitId).toBe('tiki_taka');
    expect(matchBundle.club.manager?.ovr).toBe(94);
    expect(matchBundle.club.att).toBeGreaterThanOrEqual(70);
  });

  it('defines atomic TOP 15 table, read-only SELECT RLS, and SECURITY DEFINER prune RPC in supabase/schema.sql', () => {
    expect(schemaSql).toContain('create table if not exists public.global_hof_rankings');
    expect(schemaSql).toContain('run_id text unique not null');
    expect(schemaSql).toContain('global_hof_rankings_public_select');
    expect(schemaSql).toContain('for select to anon, authenticated');
    expect(schemaSql).toContain('create or replace function public.submit_global_hof_ranking');
    expect(schemaSql).toContain('security definer');
    expect(schemaSql).toContain('pg_advisory_xact_lock');
    expect(schemaSql).toContain('limit 15');
    expect(schemaSql).toContain('delete from public.global_hof_rankings');
  });
});
