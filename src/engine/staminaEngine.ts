import { FORMATIONS } from '../data/formations';
import type { FormationId, ManagerTraitId } from '../types/game';
import type { LiveSubRecord, TacticId } from '../types/league';
import type { Player, SubPosition } from '../types/player';
import { evaluatePositionFit, getPrimaryPosition } from './positionEngine';

export const MAX_MATCH_SUBS = 5;

export const TACTIC_STAMINA_MULT: Record<TacticId, number> = {
  gegenpressing: 1.35,
  wingplay: 1.15,
  possession: 1.0,
  balanced: 1.0,
  counter: 0.9,
};

export const POSITION_STAMINA_MULT: Record<SubPosition, number> = {
  GK: 0.22,
  CB: 0.78,
  LB: 1.16,
  RB: 1.16,
  LWB: 1.24,
  RWB: 1.24,
  CDM: 1.18,
  CM: 1.22,
  CAM: 1.1,
  LM: 1.16,
  RM: 1.16,
  LW: 1.14,
  RW: 1.14,
  ST: 0.95,
};

export type StaminaTier = 'fresh' | 'tired' | 'fatigued' | 'exhausted';

export interface StaminaPenaltyResult {
  ovrPenalty: number; // 0, -1.5, -3.5, or -6.0
  tier: StaminaTier;
  label: string;
}

export function getPlayerStaminaStat(player: Pick<Player, 'stamina'> | null | undefined): number {
  if (!player || typeof player.stamina !== 'number' || Number.isNaN(player.stamina)) {
    return 82;
  }
  return Math.max(60, Math.min(99, Math.round(player.stamina)));
}

/**
 * Computes a player's remaining in-match stamina percentage (15..100)
 * given their STA attribute, deployed subPosition, team tactic, and minutes played on the pitch.
 */
export function computePlayerStaminaPct(params: {
  staminaStat: number;
  subPosition: SubPosition;
  tactic: TacticId;
  minutesPlayed: number;
  initialStaminaCap?: number;
}): number {
  const { staminaStat, subPosition, tactic, minutesPlayed, initialStaminaCap = 100 } = params;
  const startCap = Math.max(50, Math.min(100, Math.round(initialStaminaCap)));
  if (minutesPlayed <= 0) return startCap;

  const clampedStat = Math.max(60, Math.min(99, staminaStat));
  // STA 60 -> 1.48x drain, STA 82 -> 1.07x drain, STA 99 -> 0.76x drain
  const statFactor = 1.48 - ((clampedStat - 60) / 39) * 0.72;
  const posMult = POSITION_STAMINA_MULT[subPosition] ?? 1.0;
  const tacticMult = TACTIC_STAMINA_MULT[tactic] ?? 1.0;

  const drainPerMin = 0.44 * statFactor * posMult * tacticMult;
  const remaining = startCap - drainPerMin * minutesPlayed;
  return Math.max(15, Math.min(startCap, Math.round(remaining)));
}

/**
 * Evaluates in-game performance OVR penalty from current stamina percentage:
 * - >= 70%: 0
 * - 55..69%: -1.5 OVR
 * - 40..54%: -3.5 OVR
 * - < 40%: -6.0 OVR
 */
export function getStaminaPenalty(staminaPct: number): StaminaPenaltyResult {
  if (staminaPct >= 70) {
    return { ovrPenalty: 0, tier: 'fresh', label: '정상' };
  }
  if (staminaPct >= 55) {
    return { ovrPenalty: -1.5, tier: 'tired', label: '소폭 피로' };
  }
  if (staminaPct >= 40) {
    return { ovrPenalty: -3.5, tier: 'fatigued', label: '피로 누적' };
  }
  return { ovrPenalty: -6.0, tier: 'exhausted', label: '방전' };
}

/**
 * Computes per-line (ATT / MID / DEF) average stamina OVR delta for an 11-player lineup
 * at a given match minute, plus a fresh-sub energy bonus when fresh bench players
 * face fatigued opponents in the 2nd half.
 */
export function computeLineupStaminaImpact(params: {
  starters: Player[];
  formation: FormationId;
  tactic: TacticId;
  minute: number;
  enteredAtMinute?: Record<string, number>;
}): {
  attDelta: number;
  midDelta: number;
  defDelta: number;
  freshSubXgBonus: number;
  avgStaminaPct: number;
} {
  const { starters, formation, tactic, minute, enteredAtMinute = {} } = params;
  const slots = (FORMATIONS[formation] ?? FORMATIONS['4-3-3']).slots;

  let attSum = 0;
  let attCount = 0;
  let midSum = 0;
  let midCount = 0;
  let defSum = 0;
  let defCount = 0;
  let totalPct = 0;
  let freshSubCount = 0;

  starters.forEach((player, idx) => {
    const subPos = slots[idx]?.subPosition ?? getPrimaryPosition(player);
    const entryMin = enteredAtMinute[player.id] ?? 0;
    const minsOnPitch = Math.max(0, minute - entryMin);
    const pct = computePlayerStaminaPct({
      staminaStat: getPlayerStaminaStat(player),
      subPosition: subPos,
      tactic,
      minutesPlayed: minsOnPitch,
    });
    const penalty = getStaminaPenalty(pct).ovrPenalty;
    totalPct += pct;

    // Fresh substitute in 2nd half provides an energetic boost against tired legs
    const isFreshSub = entryMin >= 45 && pct >= 80 && player.position !== 'GK';
    const jokerOvrLift = isFreshSub ? 1.4 : 0;
    if (isFreshSub) freshSubCount += 1;

    const netDelta = penalty + jokerOvrLift;
    if (player.position === 'FW') {
      attSum += netDelta;
      attCount += 1;
    } else if (player.position === 'MF') {
      midSum += netDelta;
      midCount += 1;
    } else {
      defSum += netDelta;
      defCount += 1;
    }
  });

  const avgStaminaPct =
    starters.length > 0 ? Math.round(totalPct / starters.length) : 100;

  return {
    attDelta: attCount > 0 ? Math.round((attSum / attCount) * 100) / 100 : 0,
    midDelta: midCount > 0 ? Math.round((midSum / midCount) * 100) / 100 : 0,
    defDelta: defCount > 0 ? Math.round((defSum / defCount) * 100) / 100 : 0,
    freshSubXgBonus: Math.min(0.24, freshSubCount * 0.06),
    avgStaminaPct,
  };
}

/**
 * Plans 3 to 5 realistic automatic substitutions between minutes 60' and 82'
 * for quick-skip / fast-sim matches (or instant-finish matches), prioritizing
 * the most fatigued outfield starters and matching position-compatible bench players.
 */
export function planAutoSubstitutions(params: {
  starters: Player[];
  bench: Player[];
  formation: FormationId;
  tactic: TacticId;
  managerTraitId: ManagerTraitId | null;
  existingSubsCount?: number;
  rng?: () => number;
}): {
  subs: LiveSubRecord[];
  endingStarters: Player[];
} {
  const {
    starters,
    bench,
    formation,
    tactic,
    managerTraitId,
    existingSubsCount = 0,
    rng = Math.random,
  } = params;

  const availableBench = bench.filter((p) => p.position !== 'GK');
  const maxRemaining = Math.max(0, MAX_MATCH_SUBS - existingSubsCount);
  if (availableBench.length === 0 || maxRemaining === 0 || starters.length === 0) {
    return { subs: [], endingStarters: [...starters] };
  }

  const desiredSubs = Math.min(
    maxRemaining,
    availableBench.length,
    3 + Math.floor(rng() * 3), // 3..5 realistic subs per match
  );

  const slots = (FORMATIONS[formation] ?? FORMATIONS['4-3-3']).slots;

  // Score non-GK starters by fatigue at 65' + mild randomness (representing dip in match form)
  const starterCandidates = starters
    .map((player, slotIndex) => {
      const subPosition = slots[slotIndex]?.subPosition ?? getPrimaryPosition(player);
      const stam65 = computePlayerStaminaPct({
        staminaStat: getPlayerStaminaStat(player),
        subPosition,
        tactic,
        minutesPlayed: 65,
      });
      const fatigueScore = 100 - stam65 + rng() * 14;
      return { player, slotIndex, subPosition, stam65, fatigueScore };
    })
    .filter((c) => c.player.position !== 'GK')
    .sort((a, b) => b.fatigueScore - a.fatigueScore);

  const endingStarters = [...starters];
  const usedBenchIds = new Set<string>();
  const subs: LiveSubRecord[] = [];
  const subMinuteWindows = [61, 67, 72, 77, 81];

  for (const cand of starterCandidates) {
    if (subs.length >= desiredSubs) break;

    let bestBench: Player | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const bp of availableBench) {
      if (usedBenchIds.has(bp.id)) continue;
      const fit = evaluatePositionFit(bp, cand.subPosition, managerTraitId);
      // Avoid completely incompatible substitutions (severe out-of-position)
      if (fit.fit === 'severe') continue;
      const fitBonus =
        fit.fit === 'main' ? 18 : fit.fit === 'secondary' ? 9 : 0;
      const score = fit.effectiveOvr + fitBonus + rng() * 4;
      if (score > bestScore) {
        bestScore = score;
        bestBench = bp;
      }
    }

    if (!bestBench) continue;

    usedBenchIds.add(bestBench.id);
    const baseMin = subMinuteWindows[subs.length] ?? 78;
    const subMinute = Math.min(82, Math.max(60, baseMin + Math.floor(rng() * 3) - 1));

    endingStarters[cand.slotIndex] = bestBench;
    subs.push({
      minute: subMinute,
      outPlayerId: cand.player.id,
      outPlayerName: cand.player.name,
      inPlayerId: bestBench.id,
      inPlayerName: bestBench.name,
      slotIndex: cand.slotIndex,
    });
  }

  subs.sort((a, b) => a.minute - b.minute);
  return { subs, endingStarters };
}
