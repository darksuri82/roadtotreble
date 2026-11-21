import { describe, expect, it } from 'vitest';
import { FORMATIONS } from '../data/formations';
import { calculateChemistry, calculateTeamRatings } from '../engine/chemistryEngine';
import { ACTIVE_PLAYERS } from '../engine/dataLoader';
import {
  optimizeBestLineup,
  remapStartersForFormation,
} from '../engine/lineupOptimizer';
import type { Player } from '../types/player';

function pickSampleSquad16(): { starters: Player[]; bench: Player[] } {
  const used = new Set<string>();
  const take = (pred: (p: Player) => boolean): Player => {
    const found = ACTIVE_PLAYERS.find((p) => !used.has(p.id) && pred(p));
    if (!found) throw new Error('Missing sample player');
    used.add(found.id);
    return found;
  };

  const starters: Player[] = [
    take((p) => p.mainPositions.includes('GK')),
    take((p) => p.mainPositions.includes('LB')),
    take((p) => p.mainPositions.includes('CB')),
    take((p) => p.mainPositions.includes('CB')),
    take((p) => p.mainPositions.includes('RB')),
    take((p) => p.mainPositions.includes('CDM')),
    take((p) => p.mainPositions.includes('CM')),
    take((p) => p.mainPositions.includes('CM')),
    take((p) => p.mainPositions.includes('LW')),
    take((p) => p.mainPositions.includes('ST')),
    take((p) => p.mainPositions.includes('RW')),
  ];

  const bench: Player[] = [
    take((p) => p.mainPositions.includes('GK')),
    take((p) => p.mainPositions.includes('CB')),
    take((p) => p.mainPositions.includes('CAM')),
    take((p) => p.mainPositions.includes('CM')),
    take((p) => p.mainPositions.includes('ST')),
  ];

  return { starters, bench };
}

describe('V5 Lineup Optimizer (Smart Formation Remap + Quick Best XI)', () => {
  it('preserves core positions (GK, CBs, ST) cleanly when switching formations', () => {
    const { starters } = pickSampleSquad16();
    const gk = starters[0];
    const st = starters[9];

    const remapped = remapStartersForFormation(starters, '4-3-3', '3-5-2');
    const slots352 = FORMATIONS['3-5-2'].slots;

    expect(remapped.filter(Boolean).length).toBe(11);
    expect(remapped[0]?.id).toBe(gk.id); // GK stays in GK slot (index 0)

    const stSlotIdx = remapped.findIndex((p) => p?.id === st.id);
    expect(slots352[stSlotIdx].subPosition).toBe('ST');
  });

  it('auto-optimizes a scrambled 16-player squad to maximize Effective OVR + Chemistry', () => {
    const { starters, bench } = pickSampleSquad16();
    // Deliberately scramble starters: put ST in GK, GK in ST, CB in LW, etc.
    const scrambledStarters = [...starters].reverse();

    const beforeChem = calculateChemistry('4-3-3', scrambledStarters, 'possession', null);
    const beforeRatings = calculateTeamRatings('4-3-3', scrambledStarters, beforeChem.total, null);

    const { starters: optStarters, bench: optBench } = optimizeBestLineup(
      scrambledStarters,
      bench,
      '4-3-3',
      'possession',
      null,
    );

    expect(optStarters.filter(Boolean).length).toBe(11);
    expect(optBench.filter(Boolean).length).toBe(5);
    expect(optStarters[0]?.mainPositions).toContain('GK');

    const afterChem = calculateChemistry('4-3-3', optStarters, 'possession', null);
    const afterRatings = calculateTeamRatings('4-3-3', optStarters, afterChem.total, null);

    expect(afterRatings.ovr).toBeGreaterThan(beforeRatings.ovr);
    expect(afterChem.total).toBeGreaterThanOrEqual(beforeChem.total);
  });
});
