import { describe, expect, it } from 'vitest';
import {
  calculateChemistry,
  calculateTeamRatings,
  computeChemistryOvrBonus,
  evaluatePairLink,
} from '../engine/chemistryEngine';
import { ACTIVE_PLAYERS, LEGEND_PLAYERS } from '../engine/dataLoader';
import { evaluatePositionFit } from '../engine/positionEngine';
import {
  evaluateFormationMatchup,
  evaluateTacticMatchup,
} from '../engine/tacticEngine';
import type { FormationId } from '../types/game';
import type { TacticId } from '../types/league';

describe('V4 Multi-MainPosition Fit, No-Same-League Multi-Line Chemistry & Matchups', () => {
  it('gives 0 penalty for all positions in mainPositions[] and -3/-6/-15 for secondary/out-of-pos/severe', () => {
    const mbappe = ACTIVE_PLAYERS.find((p) => p.name === '킬리안 음바페')!; // mainPositions: ['ST', 'LW']
    const valverde = ACTIVE_PLAYERS.find((p) => p.name === '페데리코 발베르데')!; // mainPositions: ['CM', 'RB', 'RW'], sec: ['CDM']
    const saliba = ACTIVE_PLAYERS.find((p) => p.name === '윌리엄 살리바')!; // mainPositions: ['CB']

    // Both mainPositions -> 0 penalty!
    expect(evaluatePositionFit(mbappe, 'ST').penalty).toBe(0);
    expect(evaluatePositionFit(mbappe, 'LW').penalty).toBe(0);

    // Valverde 3 main positions -> 0, secondary CDM -> -3 (-1 with Total Football)
    expect(evaluatePositionFit(valverde, 'CM').penalty).toBe(0);
    expect(evaluatePositionFit(valverde, 'RB').penalty).toBe(0);
    expect(evaluatePositionFit(valverde, 'RW').penalty).toBe(0);
    expect(evaluatePositionFit(valverde, 'CDM').penalty).toBe(-3);
    expect(evaluatePositionFit(valverde, 'CDM', 'total_football').penalty).toBe(-1);

    // Same line out-of-pos CB -> LB -> -6 (-3 with Total Football)
    expect(evaluatePositionFit(saliba, 'LB').penalty).toBe(-6);
    expect(evaluatePositionFit(saliba, 'LB', 'total_football').penalty).toBe(-3);

    // Different line or GK mismatch -> -15
    expect(evaluatePositionFit(mbappe, 'CB').penalty).toBe(-15);
    expect(evaluatePositionFit(mbappe, 'GK').penalty).toBe(-15);
  });

  it('removes Same League completely, computes multi-line parallel criteria, and preserves [-1.5..+2.5] bounds', () => {
    expect(computeChemistryOvrBonus(0)).toBe(-1.5);
    expect(computeChemistryOvrBonus(50)).toBe(0);
    expect(computeChemistryOvrBonus(100)).toBe(2.5);

    // Same league (EPL) but different clubs & nationalities -> hasClubLink MUST be false!
    const haaland = ACTIVE_PLAYERS.find((p) => p.name === '엘링 홀란')!; // Man City, NO
    const saliba = ACTIVE_PLAYERS.find((p) => p.name === '윌리엄 살리바')!; // Arsenal, FR
    const diffClubLink = evaluatePairLink(haaland, saliba, 'balanced');
    expect(diffClubLink.hasClubLink).toBe(false);
    expect(diffClubLink.hasNationLink).toBe(false);

    // Same club + same nation + complementary style -> up to 3 parallel lines!
    const saka = ACTIVE_PLAYERS.find((p) => p.name === '부카요 사카')!; // Arsenal, GB
    const rice = ACTIVE_PLAYERS.find((p) => p.name === '데클런 라이스')!; // Arsenal, GB
    const arsenalLink = evaluatePairLink(saka, rice, 'possession', null);
    expect(arsenalLink.hasClubLink).toBe(true);
    expect(arsenalLink.hasNationLink).toBe(true);
    expect(arsenalLink.activeLines).toContain('club');
    expect(arsenalLink.activeLines).toContain('nation');

    // Legend wildcard provides default club/tactic link + nation link when matching
    const messi = LEGEND_PLAYERS.find((p) => p.name === '리오넬 메시')!; // AR
    const macAllister = ACTIVE_PLAYERS.find((p) => p.name === '알렉시스 맥 알리스터')!; // AR
    const legendLink = evaluatePairLink(messi, macAllister, 'possession', null);
    expect(legendLink.isLegendWildcard).toBe(true);
    expect(legendLink.hasClubLink).toBe(true);
    expect(legendLink.hasNationLink).toBe(true);
    expect(legendLink.activeLines.length).toBeGreaterThanOrEqual(2);

    const starters = [
      ACTIVE_PLAYERS.find((p) => p.mainPositions.includes('GK'))!,
      ACTIVE_PLAYERS.find((p) => p.mainPositions.includes('LB'))!,
      ...ACTIVE_PLAYERS.filter((p) => p.mainPositions.includes('CB')).slice(0, 2),
      ACTIVE_PLAYERS.find((p) => p.mainPositions.includes('RB'))!,
      ACTIVE_PLAYERS.find((p) => p.mainPositions.includes('CDM'))!,
      ...ACTIVE_PLAYERS.filter((p) => p.mainPositions.includes('CM')).slice(0, 2),
      ACTIVE_PLAYERS.find((p) => p.mainPositions.includes('LW'))!,
      ACTIVE_PLAYERS.find((p) => p.mainPositions.includes('ST'))!,
      ACTIVE_PLAYERS.find((p) => p.mainPositions.includes('RW'))!,
    ];

    const chem = calculateChemistry('4-3-3', starters, 'possession', 'tiki_taka');
    expect(chem.total).toBeGreaterThanOrEqual(0);
    expect(chem.total).toBeLessThanOrEqual(100);
    expect(
      chem.breakdown.club +
        chem.breakdown.nation +
        chem.breakdown.tacticStyle +
        chem.breakdown.roleBalance,
    ).toBeGreaterThanOrEqual(chem.total);

    const ratings = calculateTeamRatings('4-3-3', starters, chem.total, 'tiki_taka');
    expect(ratings.chemistryBonus).toBeGreaterThanOrEqual(-1.5);
    expect(ratings.chemistryBonus).toBeLessThanOrEqual(2.5);
  });

  it('has anti-symmetric 5-tactic and 6-formation matchup matrices', () => {
    const tactics: TacticId[] = [
      'possession',
      'gegenpressing',
      'counter',
      'wingplay',
      'balanced',
    ];
    for (const a of tactics) {
      for (const b of tactics) {
        const ab = evaluateTacticMatchup(a, b).delta;
        const ba = evaluateTacticMatchup(b, a).delta;
        expect(ab + ba).toBeCloseTo(0, 5);
      }
    }

    const formations: FormationId[] = [
      '4-3-3',
      '4-4-2',
      '4-2-3-1',
      '3-5-2',
      '3-4-3',
      '3-4-2-1',
    ];
    for (const a of formations) {
      for (const b of formations) {
        const ab = evaluateFormationMatchup(a, b).delta;
        const ba = evaluateFormationMatchup(b, a).delta;
        expect(ab + ba).toBeCloseTo(0, 5);
      }
    }
  });
});
