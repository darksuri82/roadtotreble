import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ROULETTE_LEGEND_RATE,
  spinClubRoulette,
  TOP4_TRANSFER_LEGEND_RATE,
} from '../engine/draftEngine';

function createSeededRng(seed = 42): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

describe('V5 Multi-Candidate 3-Club Roulette + Single-Drop Legend Slot Engine', () => {
  it('returns 3 reels with unique clubs, 2-3 unique candidates per club reel, exact 1 Legend on Legend reel, and zero empty slots', () => {
    const exclude = new Set<string>();
    const rng = createSeededRng(101);

    for (let spin = 0; spin < 20; spin += 1) {
      const reels = spinClubRoulette('LB', 'DF', exclude, {
        legendRate: DEFAULT_ROULETTE_LEGEND_RATE,
        rng,
      });

      expect(reels.length).toBe(3);

      const batchClubIds = new Set<string>();
      const batchPlayerIds = new Set<string>();

      for (const r of reels) {
        if (r.isLegendSlot) {
          expect(r.candidates.length).toBe(1);
        } else {
          expect(r.candidates.length).toBeGreaterThanOrEqual(2);
          expect(r.candidates.length).toBeLessThanOrEqual(3);
        }

        for (const p of r.candidates) {
          expect(exclude.has(p.id)).toBe(false);
          expect(batchPlayerIds.has(p.id)).toBe(false);
          batchPlayerIds.add(p.id);
          if (r.isLegendSlot) {
            expect(p.isLegend).toBe(true);
          } else {
            expect(p.club).toBe(r.club!.name);
          }
        }

        if (!r.isLegendSlot) {
          expect(r.club).not.toBeNull();
          expect(batchClubIds.has(r.club!.id)).toBe(false);
          batchClubIds.add(r.club!.id);
        }
      }

      exclude.add(reels[0].candidates[0].id);
    }
  });

  it('always presents exactly 1 Legend when a golden Legend slot hits', () => {
    const reels = spinClubRoulette('ST', 'FW', new Set<string>(), {
      legendRate: 1.0,
      rng: createSeededRng(55),
    });

    expect(reels.length).toBe(3);
    for (const r of reels) {
      expect(r.isLegendSlot).toBe(true);
      expect(r.candidates.length).toBe(1);
      expect(r.candidates[0].isLegend).toBe(true);
    }
  });

  it('converges to 2.5% base Legend rate and 4.0% Top-4 transfer Legend rate per reel', () => {
    const rngBase = createSeededRng(2025);
    let baseLegendReels = 0;
    const baseSpins = 4000; // 12,000 reels

    for (let i = 0; i < baseSpins; i += 1) {
      const reels = spinClubRoulette('ST', 'FW', new Set<string>(), {
        legendRate: DEFAULT_ROULETTE_LEGEND_RATE,
        rng: rngBase,
      });
      for (const r of reels) if (r.isLegendSlot) baseLegendReels += 1;
    }

    const baseRate = baseLegendReels / (baseSpins * 3);
    expect(baseRate).toBeGreaterThan(0.02);
    expect(baseRate).toBeLessThan(0.031);

    const rngTop4 = createSeededRng(7777);
    let top4LegendReels = 0;
    for (let i = 0; i < baseSpins; i += 1) {
      const reels = spinClubRoulette('CM', 'MF', new Set<string>(), {
        legendRate: TOP4_TRANSFER_LEGEND_RATE,
        rng: rngTop4,
      });
      for (const r of reels) if (r.isLegendSlot) top4LegendReels += 1;
    }

    const top4Rate = top4LegendReels / (baseSpins * 3);
    expect(top4Rate).toBeGreaterThan(0.034);
    expect(top4Rate).toBeLessThan(0.047);
  });

  it('filters regular roulette clubs to allowedLeagueIds while keeping golden Legend slots unaffected', () => {
    const rng = createSeededRng(909);
    for (let spin = 0; spin < 15; spin += 1) {
      const reels = spinClubRoulette('CM', 'MF', new Set<string>(), {
        legendRate: 0,
        allowedLeagueIds: ['laliga'],
        rng,
      });
      expect(reels.length).toBe(3);
      for (const r of reels) {
        expect(r.isLegendSlot).toBe(false);
        expect(r.leagueId).toBe('laliga');
      }
    }

    const legendReels = spinClubRoulette('ST', 'FW', new Set<string>(), {
      legendRate: 1.0,
      allowedLeagueIds: ['laliga'],
      rng,
    });
    for (const r of legendReels) {
      expect(r.isLegendSlot).toBe(true);
      expect(r.candidates.length).toBe(1);
      expect(r.candidates[0].isLegend).toBe(true);
    }
  });
});
