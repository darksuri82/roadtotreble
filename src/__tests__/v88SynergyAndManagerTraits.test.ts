import { describe, expect, it } from 'vitest';
import { FORMATIONS } from '../data/formations';
import {
  evaluateManagerPlayerSynergy,
  evaluateManagerTeamEffect,
  MANAGER_TRAIT_LIST,
} from '../data/managerTraits';
import {
  calculateChemistry,
  calculateTeamRatings,
  evaluatePairLink,
} from '../engine/chemistryEngine';
import { ACTIVE_PLAYERS } from '../engine/dataLoader';
import { pickHighlightPattern } from '../engine/matchEngine';
import {
  computeLineupStaminaImpact,
  computePlayerStaminaPct,
} from '../engine/staminaEngine';
import {
  computeTacticalPlayerOffset,
  pickTacticalPassNext,
} from '../engine/tacticalMovement';
import type { ManagerTraitId } from '../types/game';
import type { Player, PlaystyleId } from '../types/player';

function makeSeededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function makeCustomXI(opts: {
  ovr?: number;
  clubFn?: (idx: number) => string;
  nationFn?: (idx: number) => { name: string; code: string };
  playstylesFn?: (idx: number) => PlaystyleId[];
  mainPosExtra?: boolean;
}): Player[] {
  const slots = FORMATIONS['4-3-3'].slots;
  const ovr = opts.ovr ?? 85;
  return slots.map((slot, idx) => {
    const nat = opts.nationFn?.(idx) ?? { name: '잉글랜드', code: 'GB' };
    return {
      id: `test-p-${idx}`,
      name: `TestPlayer-${idx}`,
      position: slot.position,
      mainPositions: opts.mainPosExtra
        ? [slot.subPosition, 'CM', 'RB']
        : [slot.subPosition],
      secondaryPositions: [],
      ovr,
      nationality: nat.name,
      nationalityCode: nat.code,
      leagueId: 'epl',
      club: opts.clubFn?.(idx) ?? 'FC Test',
      att: slot.position === 'FW' ? ovr + 1 : ovr - 4,
      mid: slot.position === 'MF' ? ovr + 1 : ovr - 3,
      def: slot.position === 'DF' || slot.position === 'GK' ? ovr + 1 : ovr - 6,
      stamina: 84,
      playstyles: opts.playstylesFn?.(idx) ?? ['box_to_box'],
      scoutNote: '',
      isLegend: ovr >= 91,
    };
  });
}

describe('v8.8 Unified 1-Pt 2/4/8 Line Synergy, Decoupled +1 Manager Fit & 14 Manager Traits', () => {
  it('scores every link line as exactly 1 pt and applies universal 2/4/8 -> +1/+2/+3 with decoupled +1 manager fit (max +4)', () => {
    // Same club + same nation + complementary style + 88+ elite = exactly 4 lines = score 4
    const pA = makeCustomXI({
      ovr: 89,
      playstylesFn: () => ['playmaker_10'],
    })[5];
    const pB = makeCustomXI({
      ovr: 89,
      playstylesFn: () => ['line_breaker'],
    })[9];
    const link4 = evaluatePairLink(pA, pB);
    expect(link4.activeLines.length).toBe(4);
    expect(link4.score).toBe(4);

    // Full cohesive 89-OVR XI matching tiki_taka: central hubs get >=8 lines (+3) + manager (+1) = +4!
    const xi = makeCustomXI({
      ovr: 89,
      playstylesFn: (idx) =>
        idx % 2 === 0
          ? ['deep_playmaker', 'ball_playing_cb']
          : ['playmaker_10', 'inverted_winger'],
    });
    const chem = calculateChemistry('4-3-3', xi, 'possession', 'tiki_taka');
    const hubSlots = [2, 3, 5, 6, 7]; // CBs and CMs with 4-5 adjacent links
    const hasPlus4 = hubSlots.some((i) => {
      const s = chem.slotSynergies[i];
      return (s.lineCount ?? 0) >= 8 && s.neighborBonus === 3 && s.managerBonus === 1 && s.totalBonus === 4;
    });
    expect(hasPlus4).toBe(true);

    // Verify exact 2/4/8 thresholds on all slots
    for (const s of Object.values(chem.slotSynergies)) {
      const lc = s.lineCount ?? 0;
      const expectedNeighbor =
        lc >= 8 ? 3 : lc >= 4 ? 2 : lc >= 2 ? 1 : 0;
      expect(s.neighborBonus).toBe(expectedNeighbor);
      expect(s.totalBonus).toBe(s.neighborBonus + s.managerBonus);
      expect(s.managerBonus).toBeLessThanOrEqual(1);
    }
  });

  it('guarantees strictly monotonic Team Chemistry when swapping a fewer-line player for a more-line player, and caps mismatched 88+ strangers below cohesive squads', () => {
    // Reproduces Pavlovic (fewer links) -> Barella (more links) monotonicity without hitting 100 ceiling
    const baseXI = makeCustomXI({
      ovr: 85,
      clubFn: (idx) => (idx === 6 ? 'OtherClub' : idx < 4 ? 'Inter' : `Club-${idx % 4}`),
      nationFn: (idx) =>
        idx === 6
          ? { name: '독일', code: 'DE' }
          : idx % 2 === 0
            ? { name: '이탈리아', code: 'IT' }
            : { name: '프랑스', code: 'FR' },
      playstylesFn: (idx) =>
        idx === 6 ? ['shot_stopper'] : idx % 2 === 0 ? ['box_to_box'] : ['deep_playmaker'],
    });
    const upgradedXI = baseXI.map((p, idx) =>
      idx === 6
        ? {
            ...p,
            name: '니콜로 바렐라',
            club: 'Inter',
            nationality: '이탈리아',
            nationalityCode: 'IT',
            playstyles: ['box_to_box', 'deep_playmaker'] as PlaystyleId[],
          }
        : p,
    );

    const chemBefore = calculateChemistry('4-3-3', baseXI, 'possession', 'midfield_maestro');
    const chemAfter = calculateChemistry('4-3-3', upgradedXI, 'possession', 'midfield_maestro');

    expect(chemBefore.total).toBeLessThan(95);
    expect(chemAfter.slotSynergies[6].lineCount ?? 0).toBeGreaterThan(
      chemBefore.slotSynergies[6].lineCount ?? 0,
    );
    expect(chemAfter.breakdown.totalLines ?? 0).toBeGreaterThan(
      chemBefore.breakdown.totalLines ?? 0,
    );
    expect(chemAfter.total).toBeGreaterThan(chemBefore.total);

    // Mismatched 90-OVR strangers (different clubs, different nations, no complementary styles) must have lower chemistry than an 84-OVR cohesive club/nation squad
    const mismatchedSuperstars = makeCustomXI({
      ovr: 90,
      clubFn: (idx) => `UniqueClub-${idx}`,
      nationFn: (idx) => ({ name: `Nation-${idx}`, code: `N${idx}` }),
      playstylesFn: () => ['shot_stopper'],
    });
    const cohesive84 = makeCustomXI({
      ovr: 84,
      clubFn: () => 'Athletic Club',
      nationFn: () => ({ name: '스페인', code: 'ES' }),
      playstylesFn: (idx) => (idx % 2 === 0 ? ['deep_playmaker'] : ['line_breaker']),
    });
    const chemMismatch = calculateChemistry('4-3-3', mismatchedSuperstars, 'balanced', null);
    const chemCohesive = calculateChemistry('4-3-3', cohesive84, 'balanced', null);
    expect(chemCohesive.total).toBeGreaterThan(chemMismatch.total + 30);
    expect(chemMismatch.total).toBeLessThan(55);
  });

  it('scales 8 system-builder manager traits progressively from 1..8 (6 for galactico) and reflects live tactic bonuses in calculateTeamRatings', () => {
    const builders: ManagerTraitId[] = [
      'tiki_taka',
      'gegenpress_guru',
      'catenaccio',
      'wing_bomber',
      'defensive_architect',
      'midfield_maestro',
      'direct_football',
      'galactico_manager',
    ];

    for (const traitId of builders) {
      const nonMatching: PlaystyleId[] =
        traitId === 'catenaccio' || traitId === 'defensive_architect'
          ? ['classic_winger']
          : ['shot_stopper'];
      const zeroXI = makeCustomXI({
        ovr: 83,
        playstylesFn: () => nonMatching,
      });
      const halfXI = makeCustomXI({
        ovr: traitId === 'galactico_manager' ? 83 : 85,
        playstylesFn: (idx) => {
          if (idx >= 4) return nonMatching;
          if (traitId === 'tiki_taka' || traitId === 'midfield_maestro') return ['deep_playmaker'];
          if (traitId === 'gegenpress_guru') return ['box_to_box'];
          if (traitId === 'catenaccio' || traitId === 'defensive_architect') return ['stopper_cb'];
          if (traitId === 'wing_bomber') return ['classic_winger'];
          if (traitId === 'direct_football') return ['line_breaker'];
          return ['complete_forward'];
        },
      }).map((p, idx) =>
        traitId === 'galactico_manager' && idx < 3 ? { ...p, ovr: 92, isLegend: true } : p,
      );
      const fullXI = halfXI.map((p) => {
        if (traitId === 'galactico_manager') return { ...p, ovr: 92, isLegend: true };
        return halfXI[0] ? { ...p, playstyles: halfXI[0].playstyles } : p;
      });

      const eff0 = evaluateManagerTeamEffect({ traitId, starters: zeroXI, tactic: 'balanced' });
      const effHalf = evaluateManagerTeamEffect({ traitId, starters: halfXI, tactic: 'balanced' });
      const effFull = evaluateManagerTeamEffect({ traitId, starters: fullXI, tactic: 'balanced' });

      const sum = (e: ReturnType<typeof evaluateManagerTeamEffect>) =>
        e.baseAttDelta + e.baseMidDelta + e.baseDefDelta;
      expect(sum(effFull)).toBeGreaterThan(sum(effHalf));
      expect(sum(effHalf)).toBeGreaterThan(sum(eff0));
      expect(effFull.matchedCount).toBeGreaterThanOrEqual(effFull.targetCount);
    }

    // Recommended tactic bonus activates live in calculateTeamRatings
    const tikiXI = makeCustomXI({
      ovr: 85,
      playstylesFn: () => ['deep_playmaker'],
    });
    const chemPos = calculateChemistry('4-3-3', tikiXI, 'possession', 'tiki_taka');
    const rPos = calculateTeamRatings('4-3-3', tikiXI, chemPos.total, 'tiki_taka', chemPos.slotSynergies, 'possession');
    const rBal = calculateTeamRatings('4-3-3', tikiXI, chemPos.total, 'tiki_taka', chemPos.slotSynergies, 'balanced');
    expect(rPos.managerTacticActive).toBe(true);
    expect(rBal.managerTacticActive).toBe(false);
    expect(rPos.effectiveMid).toBeGreaterThan(rBal.effectiveMid);
  });

  it('activates all 6 specialist manager traits with distinct mechanics (no generic forced 1..8)', () => {
    const baseXI = makeCustomXI({ ovr: 84, mainPosExtra: true });

    // 1) total_football: versatile players lift all lines
    const tf = evaluateManagerTeamEffect({ traitId: 'total_football', starters: baseXI, tactic: 'balanced' });
    expect(tf.baseAttDelta).toBeCloseTo(1.5, 2);
    expect(tf.baseMidDelta).toBeCloseTo(1.5, 2);
    expect(tf.baseDefDelta).toBeCloseTo(1.5, 2);

    // 2) halftime_wizard: 2nd half adjustment + trailing comeback boost
    const hw = evaluateManagerTeamEffect({
      traitId: 'halftime_wizard',
      starters: baseXI,
      tactic: 'counter',
      isSecondHalf: true,
      halftimeAdjusted: true,
      trailingAtHalftime: true,
    });
    expect(hw.halftimeTacticMultiplier).toBe(1.8);
    expect(hw.situationalAttDelta).toBeGreaterThanOrEqual(2.0);
    expect(hw.xgBonus).toBeGreaterThanOrEqual(0.25);

    // 3) super_sub: fresh subs boost 2nd-half team & stamina joker lift
    const ss = evaluateManagerTeamEffect({
      traitId: 'super_sub',
      starters: baseXI,
      tactic: 'balanced',
      isSecondHalf: true,
      halftimeSubsMade: 3,
    });
    expect(ss.situationalAttDelta).toBeGreaterThan(1.5);
    expect(ss.xgBonus).toBeCloseTo(0.3, 2);
    const stamSuper = computeLineupStaminaImpact({
      starters: baseXI,
      formation: '4-3-3',
      tactic: 'balanced',
      minute: 70,
      enteredAtMinute: { [baseXI[9].id]: 46, [baseXI[10].id]: 46 },
      managerTraitId: 'super_sub',
    });
    const stamNorm = computeLineupStaminaImpact({
      starters: baseXI,
      formation: '4-3-3',
      tactic: 'balanced',
      minute: 70,
      enteredAtMinute: { [baseXI[9].id]: 46, [baseXI[10].id]: 46 },
      managerTraitId: null,
    });
    expect(stamSuper.freshSubXgBonus).toBeGreaterThan(stamNorm.freshSubXgBonus);
    expect(stamSuper.attDelta).toBeGreaterThan(stamNorm.attDelta);

    // 4) big_game_hunter: triggers on Top 6 / OVR 84+ / knockout
    const bgh = evaluateManagerTeamEffect({
      traitId: 'big_game_hunter',
      starters: baseXI,
      tactic: 'balanced',
      isBigKnockout: true,
    });
    expect(bgh.situationalAttDelta).toBe(2.4);
    expect(bgh.xgBonus).toBe(0.12);

    // 5) underdog_killer: scales with OVR gap (0..1 / 2..4 / 5+)
    const ukSmall = evaluateManagerTeamEffect({
      traitId: 'underdog_killer',
      starters: baseXI,
      tactic: 'counter',
      userAvgOvr: 84,
      oppAvgOvr: 85,
    });
    const ukHuge = evaluateManagerTeamEffect({
      traitId: 'underdog_killer',
      starters: baseXI,
      tactic: 'counter',
      userAvgOvr: 82,
      oppAvgOvr: 89,
    });
    expect(ukSmall.situationalAttDelta).toBe(1.6);
    expect(ukHuge.situationalAttDelta).toBe(3.2);
    expect(ukHuge.oppXgPenalty).toBe(0.12);

    // 6) set_piece_master: xG + corner/FK + oppXgPenalty
    const spm = evaluateManagerTeamEffect({
      traitId: 'set_piece_master',
      starters: makeCustomXI({ playstylesFn: () => ['stopper_cb', 'poacher'] }),
      tactic: 'balanced',
    });
    expect(spm.xgBonus).toBeGreaterThanOrEqual(0.26);
    expect(spm.oppXgPenalty).toBe(0.06);

    // Quick-sim / auto-sim averaging for halftime_wizard & super_sub
    const hwQuick = evaluateManagerTeamEffect({
      traitId: 'halftime_wizard',
      starters: baseXI,
      tactic: 'balanced',
      isFullMatchQuickSim: true,
    });
    expect(hwQuick.situationalAttDelta).toBeGreaterThan(0.5);
    expect(hwQuick.xgBonus).toBeGreaterThan(0.08);
    const ssQuick = evaluateManagerTeamEffect({
      traitId: 'super_sub',
      starters: baseXI,
      tactic: 'balanced',
      isFullMatchQuickSim: true,
    });
    expect(ssQuick.situationalAttDelta).toBeGreaterThan(0.5);
    expect(ssQuick.xgBonus).toBeGreaterThan(0.08);

    // gegenpress_guru stamina reduction check
    const ggStam = computePlayerStaminaPct({
      staminaStat: 84,
      subPosition: 'CM',
      tactic: 'gegenpressing',
      minutesPlayed: 80,
      managerTraitId: 'gegenpress_guru',
    });
    const normStam = computePlayerStaminaPct({
      staminaStat: 84,
      subPosition: 'CM',
      tactic: 'gegenpressing',
      minutesPlayed: 80,
      managerTraitId: null,
    });
    expect(ggStam).toBeGreaterThan(normStam + 3);

    // All 14 traits are present & flat +1 manager compatibility holds for every trait
    expect(MANAGER_TRAIT_LIST.length).toBe(14);
    const pedri = ACTIVE_PLAYERS.find((p) => p.name === '페드리')!;
    for (const t of MANAGER_TRAIT_LIST) {
      const ev = evaluateManagerPlayerSynergy(pedri, t.id, 95);
      expect(ev.bonus).toBeLessThanOrEqual(1);
    }
  });

  it('reflects manager trait identity in both 2D tactical movement/passing and 2D highlight pattern distribution', () => {
    // 2D off-ball movement: gegenpress_guru pushes higher than catenaccio; wing_bomber pushes wingers wider
    const ggDef = computeTacticalPlayerOffset({
      slotIndex: 2,
      base: { x: 0.25, y: 0.4 },
      formation: '4-3-3',
      tactic: 'balanced',
      isHome: true,
      hasBall: false,
      attackPhase: 1,
      ball: { x: 0.55, y: 0.5 },
      simClock: 2,
      managerTraitId: 'gegenpress_guru',
    });
    const catDef = computeTacticalPlayerOffset({
      slotIndex: 2,
      base: { x: 0.25, y: 0.4 },
      formation: '4-3-3',
      tactic: 'balanced',
      isHome: true,
      hasBall: false,
      attackPhase: 1,
      ball: { x: 0.55, y: 0.5 },
      simClock: 2,
      managerTraitId: 'catenaccio',
    });
    expect(ggDef.x).toBeGreaterThan(catDef.x + 0.03);

    const wbWinger = computeTacticalPlayerOffset({
      slotIndex: 8,
      base: { x: 0.72, y: 0.22 },
      formation: '4-3-3',
      tactic: 'balanced',
      isHome: true,
      hasBall: true,
      attackPhase: 2,
      ball: { x: 0.5, y: 0.5 },
      simClock: 2,
      managerTraitId: 'wing_bomber',
    });
    const ttWinger = computeTacticalPlayerOffset({
      slotIndex: 8,
      base: { x: 0.72, y: 0.22 },
      formation: '4-3-3',
      tactic: 'balanced',
      isHome: true,
      hasBall: true,
      attackPhase: 2,
      ball: { x: 0.5, y: 0.5 },
      simClock: 2,
      managerTraitId: 'tiki_taka',
    });
    // LW is top flank (y < 0.35), so wing_bomber pushes further toward touchline (more negative y offset) than tiki_taka
    expect(wbWinger.y).toBeLessThan(ttWinger.y - 0.01);

    // 2D pass target selection & tempo: direct_football plays faster/more vertical than tiki_taka
    const positions = [
      { x: 0.1, y: 0.5 },
      { x: 0.28, y: 0.2 },
      { x: 0.26, y: 0.4 },
      { x: 0.26, y: 0.6 },
      { x: 0.28, y: 0.8 },
      { x: 0.48, y: 0.5 }, // carrier (index 5)
      { x: 0.52, y: 0.36 }, // short tiki-taka teammate
      { x: 0.52, y: 0.64 }, // short tiki-taka teammate
      { x: 0.76, y: 0.18 }, // wide wing
      { x: 0.82, y: 0.5 }, // forward striker
      { x: 0.76, y: 0.82 }, // wide wing
    ];
    let ttAvgX = 0;
    let dfAvgX = 0;
    let ttDelay = 0;
    let dfDelay = 0;
    for (let i = 0; i < 200; i += 1) {
      const r1 = pickTacticalPassNext({
        tactic: 'balanced',
        attackPhase: 1,
        carrierIdx: 4,
        activeBase: positions,
        managerTraitId: 'tiki_taka',
      });
      const r2 = pickTacticalPassNext({
        tactic: 'balanced',
        attackPhase: 1,
        carrierIdx: 4,
        activeBase: positions,
        managerTraitId: 'direct_football',
      });
      ttAvgX += positions[r1.nextCarrierIdx].x;
      dfAvgX += positions[r2.nextCarrierIdx].x;
      ttDelay += r1.passDelay;
      dfDelay += r2.passDelay;
    }
    expect(dfDelay / 200).toBeLessThan(ttDelay / 200);
    expect(dfAvgX / 200).toBeGreaterThan(ttAvgX / 200);

    // 2D highlight patterns: each signature trait spikes its hallmark pattern!
    const neutralXI = makeCustomXI({ ovr: 85, playstylesFn: () => ['box_to_box'] });
    const samplePatterns = (traitId: ManagerTraitId | null) => {
      const rng = makeSeededRng(777);
      const counts: Record<string, number> = {};
      for (let i = 0; i < 1200; i += 1) {
        const pat = pickHighlightPattern({
          tactic: 'balanced',
          roster: neutralXI,
          managerTraitId: traitId,
          rng,
        });
        counts[pat] = (counts[pat] ?? 0) + 1;
      }
      return counts;
    };

    const baseCounts = samplePatterns(null);
    const spmCounts = samplePatterns('set_piece_master');
    const wbCounts = samplePatterns('wing_bomber');
    const ggCounts = samplePatterns('gegenpress_guru');
    const dfCounts = samplePatterns('direct_football');
    const ttCounts = samplePatterns('tiki_taka');

    expect(
      (spmCounts.corner_kick ?? 0) + (spmCounts.direct_free_kick ?? 0),
    ).toBeGreaterThan(((baseCounts.corner_kick ?? 0) + (baseCounts.direct_free_kick ?? 0)) * 1.6);
    expect(
      (wbCounts.wing_cross_header ?? 0) + (wbCounts.cutback_finish ?? 0),
    ).toBeGreaterThan(((baseCounts.wing_cross_header ?? 0) + (baseCounts.cutback_finish ?? 0)) * 1.35);
    expect(ggCounts.high_press_counter ?? 0).toBeGreaterThan((baseCounts.high_press_counter ?? 0) * 1.45);
    expect(dfCounts.through_ball_1v1 ?? 0).toBeGreaterThan((baseCounts.through_ball_1v1 ?? 0) * 1.4);
    expect(ttCounts.u_buildup_switch ?? 0).toBeGreaterThan((baseCounts.u_buildup_switch ?? 0) * 1.4);
  });
});
