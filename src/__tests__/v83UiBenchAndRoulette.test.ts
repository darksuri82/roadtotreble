import { describe, expect, it } from 'vitest';
import { calculateChemistry, calculateTeamRatings } from '../engine/chemistryEngine';
import { ACTIVE_PLAYERS } from '../engine/dataLoader';
import { optimizeBestLineup } from '../engine/lineupOptimizer';
import {
  chooseSlotForPlayer,
  findNextOpenDraftSlot,
  spinSharedRoll,
} from '../engine/mpLeagueDraft';
import { resolveAvailableLineup } from '../engine/mpLeagueEngine';
import type { PlayerConditionMap } from '../types/condition';
import type { MpSquadInput } from '../types/mpLeague';
import type { Player } from '../types/player';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickPlayersBySub(sub: string, count: number, excludeIds: Set<string>): Player[] {
  const matched = ACTIVE_PLAYERS.filter(
    (p) => !excludeIds.has(p.id) && (p.mainPositions ?? []).includes(sub as never),
  );
  const chosen = matched.slice(0, count);
  for (const p of chosen) excludeIds.add(p.id);
  return chosen;
}

function buildSampleSquad16(): { starters: Player[]; bench: Player[] } {
  const used = new Set<string>();
  const starters: Player[] = [
    ...pickPlayersBySub('GK', 1, used),
    ...pickPlayersBySub('LB', 1, used),
    ...pickPlayersBySub('CB', 2, used),
    ...pickPlayersBySub('RB', 1, used),
    ...pickPlayersBySub('CDM', 1, used),
    ...pickPlayersBySub('CM', 2, used),
    ...pickPlayersBySub('LW', 1, used),
    ...pickPlayersBySub('ST', 1, used),
    ...pickPlayersBySub('RW', 1, used),
  ];
  const bench: Player[] = [
    ...pickPlayersBySub('ST', 2, used),
    ...pickPlayersBySub('CM', 1, used),
    ...pickPlayersBySub('CB', 1, used),
    ...pickPlayersBySub('GK', 1, used),
  ];
  return { starters, bench };
}

describe('v8.3 bench decoupling, injury substitution, 4-team roulette & UCL A/M/D ratings', () => {
  it('decouples bench slots from fixed positions in chooseSlotForPlayer while keeping draft spin hints in findNextOpenDraftSlot', () => {
    const { starters, bench } = buildSampleSquad16();
    const stPlayer = bench.find((p) => p.position === 'FW')!;
    const emptyBench: (Player | null)[] = [null, null, null, null, null];

    // Draft pick phase still guides bench[0] spin as GK
    const nextDraftSlot = findNextOpenDraftSlot('4-3-3', starters, emptyBench);
    expect(nextDraftSlot?.area).toBe('bench');
    expect(nextDraftSlot?.index).toBe(0);
    expect(nextDraftSlot?.subPosition).toBe('GK');

    // Placing an ST player into bench[0] MUST keep player's real position (never 'GK')
    const chosen = chooseSlotForPlayer('4-3-3', starters, emptyBench, stPlayer);
    expect(chosen).not.toBeNull();
    expect(chosen!.area).toBe('bench');
    expect(chosen!.index).toBe(0);
    expect(chosen!.position).toBe(stPlayer.position);
    expect(chosen!.subPosition).toBe(stPlayer.mainPositions[0]);
    expect(chosen!.subPosition).not.toBe('GK');
    expect(chosen!.label).toBe('벤치');
  });

  it('sorts post-draft bench freely by line and OVR without forcing outfielders into fixed GK bench slot', () => {
    const used = new Set<string>();
    const gk1 = pickPlayersBySub('GK', 1, used)[0];
    const defs = [
      ...pickPlayersBySub('LB', 1, used),
      ...pickPlayersBySub('CB', 2, used),
      ...pickPlayersBySub('RB', 1, used),
    ];
    const mids = [...pickPlayersBySub('CDM', 1, used), ...pickPlayersBySub('CM', 2, used)];
    const fwds = [
      ...pickPlayersBySub('LW', 1, used),
      ...pickPlayersBySub('ST', 2, used),
      ...pickPlayersBySub('RW', 1, used),
    ];
    const extraMid = pickPlayersBySub('CM', 2, used);
    const extraDef = pickPlayersBySub('CB', 2, used);

    // 16 players with only 1 GK (who must start) → 0 GKs on bench
    const all16: Player[] = [gk1, ...defs, ...mids, ...fwds, ...extraMid, ...extraDef];
    expect(all16).toHaveLength(16);

    const optimized = optimizeBestLineup(
      all16.slice(0, 11),
      all16.slice(11, 16),
      '4-3-3',
      'balanced',
      null,
    );
    expect(optimized.starters[0]?.position).toBe('GK');
    expect(optimized.bench).toHaveLength(5);
    expect(optimized.bench.every((p) => p !== null)).toBe(true);
    // No bench player's position is mutated to GK; bench[0] is simply first non-GK by line order
    expect(optimized.bench.every((p) => p!.position !== 'GK')).toBe(true);
    const lineOrder = { GK: 0, DF: 1, MF: 2, FW: 3 } as const;
    for (let i = 1; i < optimized.bench.length; i += 1) {
      const prev = optimized.bench[i - 1]!;
      const curr = optimized.bench[i]!;
      const prevRank = lineOrder[prev.position];
      const currRank = lineOrder[curr.position];
      expect(prevRank).toBeLessThanOrEqual(currRank);
      if (prevRank === currRank) {
        expect(prev.ovr).toBeGreaterThanOrEqual(curr.ovr);
      }
    }
  });

  it('replaces injured starters using formation slot position rather than bench index or raw starter position', () => {
    const { starters, bench } = buildSampleSquad16();
    // Place an ST at bench[0] (the old GK bench slot) and GK at bench[4]
    const benchStAtZero = [
      bench.find((p) => p.position === 'FW')!,
      bench.find((p) => p.position === 'MF')!,
      bench.find((p) => p.position === 'DF')!,
      bench.filter((p) => p.position === 'FW')[1]!,
      bench.find((p) => p.position === 'GK')!,
    ];

    const squad: MpSquadInput = {
      formation: '4-3-3',
      tactic: 'balanced',
      starters,
      bench: benchStAtZero,
      managerTraitId: 'tiki_taka',
    };

    // Case A: Starting GK (slot 0) is injured out → MUST pull the GK from bench[4], NOT ST from bench[0]
    const condGkOut: PlayerConditionMap = {
      [starters[0].id]: {
        morale: 0,
        consecutiveBenchMatches: 0,
        consecutiveMatchesPlayed: 3,
        recentGoalDrought: 0,
        injury: {
          id: 'inj-gk-1',
          severity: 'moderate',
          name: '손목 부상',
          matchesRemaining: 3,
          initialMatches: 3,
          canPlayThrough: false,
          playThroughPenalty: 0,
          recoveryMatchesRemaining: 2,
        },
      },
    };
    const resolvedGk = resolveAvailableLineup(squad, condGkOut);
    expect(resolvedGk.starters[0].position).toBe('GK');
    expect(resolvedGk.starters[0].id).toBe(benchStAtZero[4].id);

    // Case B: Starting ST (slot 9 in 4-3-3) is injured out → MUST pull a bench ST/outfielder, NEVER the bench GK
    const stSlotIdx = starters.findIndex((p) => (p.mainPositions ?? []).includes('ST'));
    expect(stSlotIdx).toBeGreaterThan(0);
    const condStOut: PlayerConditionMap = {
      [starters[stSlotIdx].id]: {
        morale: 0,
        consecutiveBenchMatches: 0,
        consecutiveMatchesPlayed: 3,
        recentGoalDrought: 0,
        injury: {
          id: 'inj-st-1',
          severity: 'moderate',
          name: '햄스트링 부상',
          matchesRemaining: 3,
          initialMatches: 3,
          canPlayThrough: false,
          playThroughPenalty: 0,
          recoveryMatchesRemaining: 2,
        },
      },
    };
    const resolvedSt = resolveAvailableLineup(squad, condStOut);
    expect(resolvedSt.starters[stSlotIdx].position).toBe('FW');
    expect(resolvedSt.starters[stSlotIdx].position).not.toBe('GK');
  });

  it('expands multi-league shared roulette to 4 clubs for 3+ players while keeping 3 clubs for 2 or fewer', () => {
    const emptyStarters: (Player | null)[] = Array.from({ length: 11 }, () => null);
    const emptyBench: (Player | null)[] = Array.from({ length: 5 }, () => null);
    const allowedLeagueIds = ['epl', 'laliga', 'seriea', 'bundesliga', 'ligue1'] as const;

    const roll2 = spinSharedRoll({
      formation: '4-3-3',
      starters: emptyStarters,
      bench: emptyBench,
      takenIds: new Set(),
      allowedLeagueIds: [...allowedLeagueIds],
      playerCount: 2,
      rng: mulberry32(101),
    });
    expect(roll2).toHaveLength(3);

    const roll3 = spinSharedRoll({
      formation: '4-3-3',
      starters: emptyStarters,
      bench: emptyBench,
      takenIds: new Set(),
      allowedLeagueIds: [...allowedLeagueIds],
      playerCount: 3,
      rng: mulberry32(202),
    });
    expect(roll3).toHaveLength(4);
    expect(new Set(roll3.map((r, idx) => r.club?.id ?? `legend-${idx}`)).size).toBe(4);

    const roll4 = spinSharedRoll({
      formation: '4-2-3-1',
      starters: emptyStarters,
      bench: emptyBench,
      takenIds: new Set(),
      allowedLeagueIds: [...allowedLeagueIds],
      playerCount: 4,
      rng: mulberry32(303),
    });
    expect(roll4).toHaveLength(4);
    expect(new Set(roll4.map((r, idx) => r.club?.id ?? `legend-${idx}`)).size).toBe(4);
  });

  it('recomputes real-time A / M / D effective line OVR immediately on formation or starter swap (UCL squad parity)', () => {
    const { starters, bench } = buildSampleSquad16();
    const chemA = calculateChemistry('4-3-3', starters, 'possession', 'tiki_taka');
    const ratingsA = calculateTeamRatings(
      '4-3-3',
      starters,
      chemA.total,
      'tiki_taka',
      chemA.slotSynergies,
    );
    expect(ratingsA.effectiveAtt).toBeGreaterThan(50);
    expect(ratingsA.effectiveMid).toBeGreaterThan(50);
    expect(ratingsA.effectiveDef).toBeGreaterThan(50);

    // Swap a bench striker into CB slot (out-of-position) → effectiveDef must react immediately
    const swapped = [...starters];
    swapped[2] = bench[0]; // ST in CB slot
    const chemB = calculateChemistry('4-3-3', swapped, 'possession', 'tiki_taka');
    const ratingsB = calculateTeamRatings(
      '4-3-3',
      swapped,
      chemB.total,
      'tiki_taka',
      chemB.slotSynergies,
    );
    expect(ratingsB.effectiveDef).toBeLessThan(ratingsA.effectiveDef);
  });
});
