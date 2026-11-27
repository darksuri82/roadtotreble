import { describe, expect, it } from 'vitest';
import { WHATS_NEW_HIGHLIGHT_RANGE } from '../components/common/WhatsNewModal';
import {
  buildHistoricalClubForMatch,
  getHistoricalTeamById,
} from '../data/historicalTeams';
import { CURRENT_APP_VERSION, PATCH_NOTES } from '../data/patchNotes';
import {
  AWAKENING_OVR_HARD_CAP,
  computeAwakeningCandidateProbability,
  evaluatePostMatchAwakening,
  evaluateSquadAwakeningReadiness,
} from '../engine/awakeningEngine';
import { calculateChemistry } from '../engine/chemistryEngine';
import { computeFullPlayerOvrBreakdown } from '../engine/conditionEngine';
import { ACTIVE_PLAYERS, LEGEND_PLAYERS } from '../engine/dataLoader';
import { evaluatePositionFit } from '../engine/positionEngine';
import type { PlayerConditionMap } from '../types/condition';
import type { PlayerSlotSynergy } from '../types/game';
import type { PlayerSeasonStats } from '../types/league';
import type { Player } from '../types/player';

function makeSeededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function makeStats(
  p: Player,
  overrides: Partial<PlayerSeasonStats> = {},
): PlayerSeasonStats {
  const apps = overrides.appearances ?? 24;
  const avg = overrides.avgRating ?? 8.06;
  return {
    playerId: p.id,
    playerName: p.name,
    teamId: 'user-club',
    teamName: '구체스터 유나이티드',
    teamShortName: 'KOO',
    teamPrimaryColor: '#10b981',
    teamSecondaryColor: '#0f172a',
    isUserTeam: true,
    position: p.position,
    mainPositions: p.mainPositions,
    ovr: p.ovr,
    appearances: apps,
    starts: apps,
    subAppearances: 0,
    minutesPlayed: apps * 88,
    goals: overrides.goals ?? 20,
    assists: overrides.assists ?? 7,
    xgSum: 16,
    cleanSheets: overrides.cleanSheets ?? 0,
    momCount: overrides.momCount ?? 10,
    ratingSum: avg * apps,
    avgRating: avg,
    positionCounts: { [p.mainPositions[0] ?? 'ST']: apps },
    isLegend: p.isLegend,
    ...overrides,
  };
}

describe('v10.1.3 Final Summary Synergy, MVP Awakening Ramp & Dream Match OVR Parity', () => {
  it('1) accurately reflects slot synergy & awakening readiness on Alphonso Davies (base 86 +2 -> effective 88)', () => {
    const davies = ACTIVE_PLAYERS.find((p) => p.id === 'act-085');
    expect(davies).toBeDefined();
    expect(davies!.ovr).toBe(86);

    const slotSyn: PlayerSlotSynergy = {
      slotIndex: 1,
      playerId: davies!.id,
      baseEffectiveOvr: 86,
      lineCount: 4,
      neighborBonus: 2,
      managerBonus: 0,
      totalBonus: 2,
      effectiveOvrWithSynergy: 88,
      reasons: ['인접 연결 4선 (+2)'],
    };

    const fit = evaluatePositionFit(davies!, 'LB', 'tiki_taka');
    const breakdown = computeFullPlayerOvrBreakdown({
      baseOvr: davies!.ovr,
      positionPenalty: fit.penalty,
      playerSynergyBonus: slotSyn.neighborBonus,
      managerBonus: slotSyn.managerBonus,
      condition: null,
    });
    expect(breakdown.baseOvr).toBe(86);
    expect(breakdown.synergyBonus).toBe(2);
    expect(breakdown.finalEffectiveOvr).toBe(88);

    const readiness = evaluateSquadAwakeningReadiness({
      player: davies!,
      managerTraitId: 'tiki_taka',
      slotSynergy: slotSyn,
      condition: null,
      positionPenalty: fit.penalty,
    });
    expect(readiness).not.toBeNull();
    const synCheck = readiness!.checks.find((c) => c.label.includes('시너지'));
    const posCheck = readiness!.checks.find((c) => c.label.includes('주포지션'));
    expect(synCheck?.ok).toBe(true);
    expect(posCheck?.ok).toBe(true);
  });

  it('2) aligns Dream Match 14-15 Barcelona Messi base OVR (96) + synergy (+3) = effective OVR (99) without double-counting', () => {
    const barca1415 = getHistoricalTeamById('hist-1415-barca');
    expect(barca1415).toBeDefined();
    const bundle = buildHistoricalClubForMatch(barca1415!);
    const chem = calculateChemistry(
      bundle.club.formation,
      bundle.starters,
      bundle.club.defaultTactic,
      barca1415!.managerTraitId,
      barca1415!.managerRating,
    );

    const messiIdx = bundle.starters.findIndex((p) => p.name.includes('메시'));
    expect(messiIdx).toBeGreaterThanOrEqual(0);
    const messi = bundle.starters[messiIdx];
    const messiSyn = chem.slotSynergies[messiIdx];
    expect(messiSyn).toBeDefined();
    expect(messi.ovr).toBe(96);
    expect(messiSyn.totalBonus).toBeGreaterThan(0);

    const fit = evaluatePositionFit(messi, 'RW', barca1415!.managerTraitId);
    const modalBreakdown = computeFullPlayerOvrBreakdown({
      baseOvr: messi.ovr,
      positionPenalty: fit.penalty,
      playerSynergyBonus: messiSyn.neighborBonus,
      managerBonus: messiSyn.managerBonus,
      condition: null,
    });

    // Pitch shows baseFitOvr (96) + "+3" -> modal shows base 96 + synergy +3 = effective 99
    expect(fit.effectiveOvr).toBe(96);
    expect(modalBreakdown.baseOvr).toBe(96);
    expect(modalBreakdown.synergyBonus).toBe(messiSyn.totalBonus);
    expect(modalBreakdown.finalEffectiveOvr).toBe(
      fit.effectiveOvr + messiSyn.totalBonus,
    );
    expect(modalBreakdown.finalEffectiveOvr).toBe(
      messiSyn.effectiveOvrWithSynergy,
    );
  });

  it('3) empowers historic MVP-caliber seasons (Woltemade 84 OVR, 8.06 avg, 26G 9A, full synergy) to reliably awaken while keeping Classics 0% and 88+ superstars ultra-rare', () => {
    const woltemade = ACTIVE_PLAYERS.find((p) => p.id === 'act-250');
    expect(woltemade).toBeDefined();
    expect(woltemade!.ovr).toBe(84);

    const syn: PlayerSlotSynergy = {
      slotIndex: 10,
      playerId: woltemade!.id,
      baseEffectiveOvr: 84,
      lineCount: 6,
      neighborBonus: 2,
      managerBonus: 1,
      totalBonus: 3,
      effectiveOvrWithSynergy: 87,
      reasons: ['인접 연결 6선 (+2)', '감독 궁합 (+1)'],
    };
    const ironmanCond = {
      morale: 4,
      injury: null,
      consecutiveBenchMatches: 0,
      consecutiveMatchesPlayed: 30,
      recentGoalDrought: 0,
    };

    const normalSeasonProb = computeAwakeningCandidateProbability({
      player: woltemade!,
      rating: 7.8,
      goals: 1,
      assists: 0,
      minutes: 90,
      cleanSheet: false,
      seasonStats: makeStats(woltemade!, {
        appearances: 20,
        goals: 7,
        assists: 3,
        momCount: 2,
        avgRating: 7.3,
      }),
      synergy: syn,
      hasSynergyContext: true,
      condition: ironmanCond,
      managerTraitId: 'tiki_taka',
      positionPenalty: 0,
      teamCountMult: 1.0,
      coachMult: 1.0,
    });

    const mvpSeasonProb = computeAwakeningCandidateProbability({
      player: woltemade!,
      rating: 8.1,
      goals: 1,
      assists: 0,
      minutes: 90,
      cleanSheet: false,
      seasonStats: makeStats(woltemade!, {
        appearances: 26,
        goals: 20,
        assists: 7,
        momCount: 10,
        avgRating: 8.06,
      }),
      synergy: syn,
      hasSynergyContext: true,
      condition: ironmanCond,
      managerTraitId: 'tiki_taka',
      positionPenalty: 0,
      teamCountMult: 1.0,
      coachMult: 1.0,
    });

    expect(mvpSeasonProb.finalProb).toBeGreaterThanOrEqual(0.14);
    expect(mvpSeasonProb.finalProb).toBeGreaterThan(normalSeasonProb.finalProb * 3);

    // 100-season deterministic check: Woltemade-like MVP with 2 teammates already awakened by R15
    const SEASONS = 100;
    let awakenedCount = 0;
    const rng = makeSeededRng(10132026);
    for (let s = 0; s < SEASONS; s += 1) {
      const condMap: PlayerConditionMap = {
        [woltemade!.id]: { ...ironmanCond },
      };
      const existing: Record<
        string,
        {
          originalOvr: number;
          ovrGain: number;
          round: number;
          competition: 'league';
          statDeltas: [];
        }
      > = {
        'teammate-1': {
          originalOvr: 80,
          ovrGain: 4,
          round: 9,
          competition: 'league',
          statDeltas: [],
        },
        'teammate-2': {
          originalOvr: 81,
          ovrGain: 4,
          round: 14,
          competition: 'league',
          statDeltas: [],
        },
      };

      for (let r = 16; r <= 34; r += 1) {
        const st = makeStats(woltemade!, {
          appearances: r,
          goals: Math.round((26 * r) / 34),
          assists: Math.round((9 * r) / 34),
          momCount: Math.round((12 * r) / 34),
          avgRating: 8.06,
        });
        const res = evaluatePostMatchAwakening({
          starters: [
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            woltemade!,
            null,
          ],
          bench: [],
          formation: '4-3-3',
          matchPlayedNumber: r,
          round: r,
          competition: 'league',
          ratingsByPlayerId: { [woltemade!.id]: 8.1 },
          goalsByPlayerId: { [woltemade!.id]: 1 },
          assistsByPlayerId: { [woltemade!.id]: 0 },
          minutesByPlayerId: { [woltemade!.id]: 90 },
          cleanSheet: false,
          allPlayerStats: { [woltemade!.id]: st },
          slotSynergies: { 9: { ...syn, slotIndex: 9 } },
          conditionMap: condMap,
          managerTraitId: 'tiki_taka',
          existingAwakenedPlayers: existing,
          rng,
        });
        if (res.triggered && res.awakenedPlayer?.id === woltemade!.id) {
          expect(res.awakenedPlayer.ovr).toBeLessThanOrEqual(AWAKENING_OVR_HARD_CAP);
          awakenedCount += 1;
          break;
        }
      }
    }
    expect(awakenedCount).toBeGreaterThanOrEqual(90);

    // Superstars (90 OVR) & Classics (isLegend) remain strictly gated
    const superstar = ACTIVE_PLAYERS.find((p) => p.ovr >= 90 && !p.isLegend)!;
    const superstarProb = computeAwakeningCandidateProbability({
      player: superstar,
      rating: 8.6,
      goals: 2,
      assists: 1,
      minutes: 90,
      cleanSheet: false,
      seasonStats: makeStats(superstar, {
        appearances: 28,
        goals: 28,
        assists: 10,
        momCount: 14,
        avgRating: 8.2,
      }),
      synergy: { ...syn, playerId: superstar.id },
      hasSynergyContext: true,
      condition: ironmanCond,
      managerTraitId: 'tiki_taka',
      positionPenalty: 0,
      teamCountMult: 1.0,
      coachMult: 1.0,
    });
    expect(superstarProb.finalProb).toBeLessThanOrEqual(0.01);

    const classic = LEGEND_PLAYERS[0];
    const classicProb = computeAwakeningCandidateProbability({
      player: classic,
      rating: 9.2,
      goals: 3,
      assists: 1,
      minutes: 90,
      cleanSheet: false,
      seasonStats: makeStats(classic, {
        appearances: 30,
        goals: 35,
        assists: 15,
        momCount: 18,
        avgRating: 8.6,
      }),
      synergy: { ...syn, playerId: classic.id },
      hasSynergyContext: true,
      condition: ironmanCond,
      managerTraitId: 'tiki_taka',
      positionPenalty: 0,
      teamCountMult: 1.0,
      coachMult: 1.0,
    });
    expect(classicProb.finalProb).toBe(0);
  });

  it('4) keeps v10.1.3 release metadata synchronized across patchNotes and WhatsNewModal', () => {
    expect(CURRENT_APP_VERSION).toBe('v10.1.3');
    expect(PATCH_NOTES[0].version).toBe('v10.1.3');
    expect(WHATS_NEW_HIGHLIGHT_RANGE).toContain('v10.1.3');
  });
});
