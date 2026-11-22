import { describe, expect, it } from 'vitest';
import {
  ALL_MANAGER_EVENTS,
  classifyChoiceRiskTier,
  pickNextManagerEvent,
  resolveManagerEventChoice,
} from '../data/managerEvents';
import {
  createDefaultCondition,
  createDefaultManagerEventsState,
  getMoraleOvrBonus,
  getMoraleTier,
  getTeamMoraleBonus,
  rollPlayerMatchInjury,
} from '../engine/conditionEngine';
import { ACTIVE_PLAYERS } from '../engine/dataLoader';
import {
  HOF_AUTO_INDUCTION_MIN_SCORE,
  isEligibleForAutoHofInduction,
} from '../engine/legacyEngine';
import type { PlayerConditionMap } from '../types/condition';
import type { Player } from '../types/player';

function makeSeededRng(seed = 515151): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe('v5.1 Polish & Rebalance (Rare Injuries, Strict Morale/Interview Risk-Return, HOF Auto Threshold)', () => {
  it('keeps outfield injuries genuinely rare (~0.143%) with severe injuries ultra-rare', () => {
    const fw = ACTIVE_PLAYERS.find((p) => p.position === 'FW')!;
    const rng = makeSeededRng(2026051);
    const trials = 30000;
    let total = 0;
    let severe = 0;

    for (let i = 0; i < trials; i += 1) {
      const res = rollPlayerMatchInjury({
        player: fw,
        currentCondition: createDefaultCondition(),
        minutesPlayed: 90,
        rng,
      });
      if (res.injury) {
        total += 1;
        if (res.injury.severity === 'severe') severe += 1;
      }
    }

    const rate = total / trials;
    expect(rate).toBeGreaterThan(0.0008);
    expect(rate).toBeLessThan(0.0024);
    expect(severe).toBeLessThanOrEqual(4);
  });

  it('enforces strict morale OVR thresholds and clear high-risk vs safe interview polarization', () => {
    expect(getMoraleTier(5)).toBe('ecstatic');
    expect(getMoraleTier(4)).toBe('high');
    expect(getMoraleTier(2)).toBe('normal');
    expect(getMoraleTier(-2)).toBe('normal');
    expect(getMoraleTier(-3)).toBe('low');
    expect(getMoraleTier(-5)).toBe('frozen');

    expect(getMoraleOvrBonus(2)).toBe(0);
    expect(getMoraleOvrBonus(3)).toBe(1);
    expect(getMoraleOvrBonus(5)).toBe(2);
    expect(getTeamMoraleBonus(4)).toBe(0);
    expect(getTeamMoraleBonus(5)).toBe(0.5);

    // Every single event has explicit risk tier classification & interview cadence triggers by match 3
    const tierCounts = { high: 0, medium: 0, safe: 0 };
    for (const ev of ALL_MANAGER_EVENTS) {
      for (const ch of ev.choices) {
        tierCounts[classifyChoiceRiskTier(ch)] += 1;
      }
    }
    expect(tierCounts.high).toBeGreaterThanOrEqual(50);
    expect(tierCounts.safe).toBeGreaterThanOrEqual(70);

    const starters: (Player | null)[] = ACTIVE_PLAYERS.slice(0, 11);
    const bench: (Player | null)[] = ACTIVE_PLAYERS.slice(11, 16);
    const picked = pickNextManagerEvent({
      eventsState: {
        ...createDefaultManagerEventsState(),
        matchesSinceLastEvent: 3,
      },
      starters,
      bench,
      conditionMap: {},
      teamName: 'FC 트레블',
      managerName: '김감독',
      nextOpponentName: '레알 마드리드',
      nextOpponentRank: 1,
      userRank: 2,
      rng: makeSeededRng(77),
    });
    expect(picked).not.toBeNull();

    // Find a high-risk choice and verify strong upside vs backlash
    const riskyChoice = picked!.choices.find(
      (c) => classifyChoiceRiskTier(c) === 'high',
    );
    if (riskyChoice) {
      const startMap: PlayerConditionMap = Object.fromEntries(
        starters
          .filter((p): p is Player => p !== null)
          .map((p) => [p.id, { ...createDefaultCondition(), morale: 2 }]),
      );
      const successRes = resolveManagerEventChoice({
        event: picked!,
        choiceId: riskyChoice.id,
        starters,
        bench,
        conditionMap: startMap,
        currentTeamMorale: 2,
        rng: () => 0.01,
      });
      const failRes = resolveManagerEventChoice({
        event: picked!,
        choiceId: riskyChoice.id,
        starters,
        bench,
        conditionMap: startMap,
        currentTeamMorale: 2,
        rng: () => 0.99,
      });
      expect(successRes.resolution.riskSucceeded).toBe(true);
      expect(failRes.resolution.riskSucceeded).toBe(false);
      expect(successRes.nextTeamMorale).toBeGreaterThanOrEqual(
        failRes.nextTeamMorale,
      );
    }
  });

  it('auto-inducts only historical-caliber seasons (>= 5,500 / S+ / UCL win / Treble) into Hall of Fame', () => {
    expect(HOF_AUTO_INDUCTION_MIN_SCORE).toBe(5500);
    const mkScore = (totalScore: number, grade: 'S+' | 'S' | 'A+' | 'A') =>
      ({
        totalScore,
        grade,
      }) as Parameters<typeof isEligibleForAutoHofInduction>[0]['seasonScore'];

    // Ordinary non-title season -> manual induction only
    expect(
      isEligibleForAutoHofInduction({
        seasonScore: mkScore(4200, 'A'),
        wonUcl: false,
        isTreble: false,
      }),
    ).toBe(false);
    // 15-16 Leicester-level historical score -> auto inducted
    expect(
      isEligibleForAutoHofInduction({
        seasonScore: mkScore(5684, 'S'),
        wonUcl: false,
        isTreble: false,
      }),
    ).toBe(true);
    // UCL winner or S+ or Treble -> always auto inducted
    expect(
      isEligibleForAutoHofInduction({
        seasonScore: mkScore(5100, 'A+'),
        wonUcl: true,
        isTreble: false,
      }),
    ).toBe(true);
    expect(
      isEligibleForAutoHofInduction({
        seasonScore: mkScore(5200, 'S+'),
        wonUcl: false,
        isTreble: false,
      }),
    ).toBe(true);
  });
});
