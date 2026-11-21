import { BENCH_SLOTS, FORMATIONS } from '../data/formations';
import type { FormationId, ManagerTraitId } from '../types/game';
import type { TacticId } from '../types/league';
import type { Player } from '../types/player';
import { calculateChemistry } from './chemistryEngine';
import { evaluatePositionFit } from './positionEngine';

/**
 * Hungarian Algorithm (Kuhn-Munkres) for maximum-weight bipartite assignment.
 * Given an R x C weight matrix (with R <= C or R > C), returns an array `assignment`
 * of length R where `assignment[r]` is the assigned column index (or -1 if unassigned when R > C).
 */
function solveMaxWeightAssignment(weights: number[][]): number[] {
  const rows = weights.length;
  if (rows === 0) return [];
  const cols = weights[0].length;
  if (cols === 0) return Array.from({ length: rows }, () => -1);

  const transposed = rows > cols;
  const n = transposed ? cols : rows;
  const m = transposed ? rows : cols;

  // Build cost matrix (minimization of -weight)
  const maxVal = weights.reduce(
    (acc, row) => Math.max(acc, ...row),
    Number.NEGATIVE_INFINITY,
  );
  const cost: number[][] = Array.from({ length: n + 1 }, (_, i) =>
    Array.from({ length: m + 1 }, (_, j) => {
      if (i === 0 || j === 0) return 0;
      const w = transposed ? weights[j - 1][i - 1] : weights[i - 1][j - 1];
      return maxVal - w;
    }),
  );

  const u = new Array<number>(n + 1).fill(0);
  const v = new Array<number>(m + 1).fill(0);
  const p = new Array<number>(m + 1).fill(0);
  const way = new Array<number>(m + 1).fill(0);

  for (let i = 1; i <= n; i += 1) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array<number>(m + 1).fill(Number.POSITIVE_INFINITY);
    const used = new Array<boolean>(m + 1).fill(false);

    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = Number.POSITIVE_INFINITY;
      let j1 = 0;

      for (let j = 1; j <= m; j += 1) {
        if (used[j]) continue;
        const cur = cost[i0][j] - u[i0] - v[j];
        if (cur < minv[j]) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j] < delta) {
          delta = minv[j];
          j1 = j;
        }
      }

      for (let j = 0; j <= m; j += 1) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else {
          minv[j] -= delta;
        }
      }

      j0 = j1;
    } while (p[j0] !== 0);

    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0 !== 0);
  }

  const result = new Array<number>(rows).fill(-1);
  for (let j = 1; j <= m; j += 1) {
    if (p[j] > 0) {
      if (transposed) {
        result[j - 1] = p[j] - 1;
      } else {
        result[p[j] - 1] = j - 1;
      }
    }
  }
  return result;
}

/**
 * Smart Formation Remapping:
 * When switching formations, maps existing starters onto the new formation's 11 slots
 * using optimal 1:1 assignment based on position fit (main/secondary/effective OVR)
 * and spatial pitch proximity (so left-sided players stay left, CBs stay CB, GK stays GK).
 */
export function remapStartersForFormation(
  starters: (Player | null)[],
  prevFormation: FormationId,
  nextFormation: FormationId,
  managerTraitId: ManagerTraitId | null = null,
): (Player | null)[] {
  if (prevFormation === nextFormation) {
    return [...starters];
  }

  const prevSlots = FORMATIONS[prevFormation].slots;
  const nextSlots = FORMATIONS[nextFormation].slots;

  const filledEntries: { player: Player; prevIndex: number }[] = [];
  for (let i = 0; i < starters.length; i += 1) {
    const p = starters[i];
    if (p) filledEntries.push({ player: p, prevIndex: i });
  }

  if (filledEntries.length === 0) {
    return Array.from({ length: 11 }, () => null);
  }

  const weights = filledEntries.map(({ player, prevIndex }) => {
    const prevSlot = prevSlots[prevIndex];
    return nextSlots.map((nextSlot) => {
      const fit = evaluatePositionFit(player, nextSlot.subPosition, managerTraitId);
      const fitTierBonus =
        fit.fit === 'main'
          ? 320
          : fit.fit === 'secondary'
            ? 140
            : fit.fit === 'out_of_pos'
              ? 20
              : -420;
      const sameSubBonus = prevSlot.subPosition === nextSlot.subPosition ? 65 : 0;
      const dist = Math.hypot(prevSlot.x - nextSlot.x, prevSlot.y - nextSlot.y);
      const proximityBonus = Math.max(0, 55 - dist * 0.75);
      return fit.effectiveOvr * 10 + fitTierBonus + sameSubBonus + proximityBonus;
    });
  });

  const assignment = solveMaxWeightAssignment(weights);
  const nextStarters: (Player | null)[] = Array.from({ length: 11 }, () => null);

  for (let i = 0; i < filledEntries.length; i += 1) {
    const slotIdx = assignment[i];
    if (slotIdx >= 0 && slotIdx < 11) {
      nextStarters[slotIdx] = filledEntries[i].player;
    }
  }

  return nextStarters;
}

function evaluateFullLineupObjective(
  starters: (Player | null)[],
  formation: FormationId,
  tactic: TacticId,
  managerTraitId: ManagerTraitId | null,
): number {
  const slots = FORMATIONS[formation].slots;
  let effectiveOvrSum = 0;
  let fitShapeBonus = 0;

  for (let i = 0; i < slots.length; i += 1) {
    const player = starters[i];
    if (!player) continue;
    const fit = evaluatePositionFit(player, slots[i].subPosition, managerTraitId);
    effectiveOvrSum += fit.effectiveOvr;
    if (fit.fit === 'main') fitShapeBonus += 1.2;
    else if (fit.fit === 'secondary') fitShapeBonus += 0.3;
    else if (fit.fit === 'severe') fitShapeBonus -= 18;
  }

  const chem = calculateChemistry(formation, starters, tactic, managerTraitId);
  // Chemistry OVR bonus applies across the whole XI (11 players) plus gentle tie-breaker on total chemistry
  return effectiveOvrSum + chem.chemistryOvrBonus * 11 + chem.total * 0.08 + fitShapeBonus;
}

function organizeBenchSlots(benchPlayers: Player[]): (Player | null)[] {
  const nextBench: (Player | null)[] = Array.from({ length: 5 }, () => null);
  if (benchPlayers.length === 0) return nextBench;

  const trimmed = benchPlayers.slice(0, 5);
  const weights = trimmed.map((player) =>
    BENCH_SLOTS.map((bSlot) => {
      const fit = evaluatePositionFit(player, bSlot.subPosition, null);
      const exactLine = player.position === bSlot.position ? 80 : 0;
      return fit.effectiveOvr * 5 + exactLine + (fit.fit === 'main' ? 40 : 0);
    }),
  );

  const assignment = solveMaxWeightAssignment(weights);
  for (let i = 0; i < trimmed.length; i += 1) {
    const idx = assignment[i];
    if (idx >= 0 && idx < 5) {
      nextBench[idx] = trimmed[i];
    }
  }
  return nextBench;
}

/**
 * One-Click Auto-Optimal Best XI + Bench (`[빠른 선발]`):
 * Evaluates all owned players (up to 16) for the current formation, tactic, and manager trait,
 * maximizing Effective OVR (main/secondary position fit) + Chemistry (club, nation, playstyle/tactic synergy).
 */
export function optimizeBestLineup(
  currentStarters: (Player | null)[],
  currentBench: (Player | null)[],
  formation: FormationId,
  tactic: TacticId,
  managerTraitId: ManagerTraitId | null = null,
): { starters: (Player | null)[]; bench: (Player | null)[] } {
  const pool: Player[] = [];
  const seen = new Set<string>();

  for (const p of [...currentStarters, ...currentBench]) {
    if (p && !seen.has(p.id)) {
      seen.add(p.id);
      pool.push(p);
    }
  }

  if (pool.length === 0) {
    return {
      starters: Array.from({ length: 11 }, () => null),
      bench: Array.from({ length: 5 }, () => null),
    };
  }

  const slots = FORMATIONS[formation].slots;

  // Phase 1: Exact Hungarian assignment maximizing positional Effective OVR
  const seedWeights = pool.map((player) =>
    slots.map((slot) => {
      const fit = evaluatePositionFit(player, slot.subPosition, managerTraitId);
      const fitBonus =
        fit.fit === 'main'
          ? 45
          : fit.fit === 'secondary'
            ? 14
            : fit.fit === 'out_of_pos'
              ? -12
              : -220;
      return fit.effectiveOvr * 10 + fitBonus;
    }),
  );

  const assignment = solveMaxWeightAssignment(seedWeights);
  const starters: (Player | null)[] = Array.from({ length: 11 }, () => null);
  const usedInXI = new Set<number>();

  for (let i = 0; i < pool.length; i += 1) {
    const slotIdx = assignment[i];
    if (slotIdx >= 0 && slotIdx < 11) {
      starters[slotIdx] = pool[i];
      usedInXI.add(i);
    }
  }

  const benchPool: Player[] = [];
  for (let i = 0; i < pool.length; i += 1) {
    if (!usedInXI.has(i)) benchPool.push(pool[i]);
  }

  // Phase 2: 2-opt local optimization for combined Effective OVR + Chemistry (club, nation, playstyle)
  let bestScore = evaluateFullLineupObjective(
    starters,
    formation,
    tactic,
    managerTraitId,
  );

  for (let pass = 0; pass < 6; pass += 1) {
    let improved = false;

    // 2a) Starter <-> Starter swaps (optimizes chemistry link adjacency and multi-position layout)
    for (let i = 0; i < 11; i += 1) {
      for (let j = i + 1; j < 11; j += 1) {
        if (!starters[i] && !starters[j]) continue;
        [starters[i], starters[j]] = [starters[j], starters[i]];
        const candidateScore = evaluateFullLineupObjective(
          starters,
          formation,
          tactic,
          managerTraitId,
        );
        if (candidateScore > bestScore + 0.001) {
          bestScore = candidateScore;
          improved = true;
        } else {
          [starters[i], starters[j]] = [starters[j], starters[i]];
        }
      }
    }

    // 2b) Starter <-> Bench swaps (brings in bench players if Effective OVR + Chemistry improves)
    for (let s = 0; s < 11; s += 1) {
      for (let b = 0; b < benchPool.length; b += 1) {
        const prevStarter = starters[s];
        const prevBench = benchPool[b];
        starters[s] = prevBench;
        const candidateScore = evaluateFullLineupObjective(
          starters,
          formation,
          tactic,
          managerTraitId,
        );
        if (candidateScore > bestScore + 0.001) {
          bestScore = candidateScore;
          if (prevStarter) {
            benchPool[b] = prevStarter;
          } else {
            benchPool.splice(b, 1);
          }
          improved = true;
        } else {
          starters[s] = prevStarter;
        }
      }
    }

    if (!improved) break;
  }

  return {
    starters,
    bench: organizeBenchSlots(benchPool),
  };
}
