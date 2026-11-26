import { FORMATIONS } from '../data/formations';
import { evaluateManagerPlayerSynergy } from '../data/managerTraits';
import type { PlayerConditionMap } from '../types/condition';
import type {
  AwakeningAlertItem,
  FormationId,
  ManagerTraitId,
  PlayerSlotSynergy,
  StaffCoachId,
} from '../types/game';
import type { PlayerSeasonStats } from '../types/league';
import type {
  GoalkeeperAttributes,
  Player,
  PlayerAttributes,
  PlayerAwakeningRecord,
} from '../types/player';
import {
  FIELD_ATTR_META,
  getPlayerAttributes,
  getPositionWeights,
  getPrimarySubPosition,
  GK_ATTR_META,
} from './attributeEngine';
import { evaluatePositionFit } from './positionEngine';
import { STAFF_COACH_DEV_AWAKENING_MULT } from './staffCoachEngine';

/**
 * Permanent Potential Breakthrough (Awakening) Engine
 *
 * Strict Balance & Integrity Rules:
 * - Era Classics (`isLegend === true`): 0% (NEVER awaken).
 * - Superstars / Top Worldclass (`baseOvr >= 88`): ultra-rare (`x0.04` = 1/25), fixed `+2` OVR cap (max 94).
 * - Low & Mid OVR Gems (`baseOvr <= 84`): meaningfully boosted trigger rate (`x1.35..x1.75`) and wider
 *   permanent growth (`+3..+8`) so developing mid-table aces & underrated gems is a genuine winning strategy.
 * - Comprehensive Performance + Utilization Model:
 *   Rewards players who deliver strong match/season output (rating, goals, assists, clean sheets,
 *   appearances/minutes) AND are utilized effectively by the manager (neighbor synergy, manager fit,
 *   morale, condition/rotation care without overload/injury, natural position fit).
 * - Season Target Distribution: 0~3 players/season (1st x1.00, 2nd x0.78, 3rd x0.48, 4th+ x0.05).
 * - Permanent pure OVR +2..+8 growth + position-tailored sub-attribute growth applied ONLY to
 *   freshly cloned player instances — static DB is NEVER mutated.
 */
export const AWAKENING_MIN_GAIN = 2;
export const AWAKENING_MAX_GAIN = 8;
export const AWAKENING_SUPERSTAR_OVR_THRESHOLD = 88;
export const AWAKENING_SUPERSTAR_MAX_GAIN = 2;
export const AWAKENING_SUPERSTAR_RATE_MULT = 0.04; // 1/25th of normal rate
export const AWAKENING_OVR_HARD_CAP = 94;
export const AWAKENING_MIN_SEASON_MATCH = 6;
export const AWAKENING_MIN_APPEARANCES = 4;
export const AWAKENING_SECOND_COUNT_MULT = 0.78;
export const AWAKENING_THIRD_COUNT_MULT = 0.48;
export const AWAKENING_THIRD_PLUS_MULT = 0.05; // 4th+ strong attenuation (kept exported name for backward compatibility)
export const AWAKENING_FOURTH_PLUS_MULT = AWAKENING_THIRD_PLUS_MULT;
export const AWAKENING_MAX_VALID_PER_TEAM = 4;
export const AWAKENING_BASE_ELIGIBLE_PROB = 0.0033;
export const AWAKENING_MAX_CANDIDATE_PROB = 0.042;
export const AWAKENING_LOW_OVR_MAX_CANDIDATE_PROB = 0.046;

export function getAwakeningTierRateMultiplier(baseOvr: number): number {
  if (baseOvr >= AWAKENING_SUPERSTAR_OVR_THRESHOLD) {
    return AWAKENING_SUPERSTAR_RATE_MULT; // 88+: 0.04 (1/25)
  }
  if (baseOvr >= 85) return 0.75; // 85..87: solid starter
  if (baseOvr >= 82) return 1.35; // 82..84: mid-table core / key gem
  if (baseOvr >= 80) return 1.55; // 80..81: high-upside rotation gem
  if (baseOvr >= 77) return 1.85; // 77..79: underrated gem
  return 2.1; // <=76: raw hidden diamond
}

/**
 * OVR-relative minimum match rating required to qualify for post-match awakening.
 * Well-utilized low-OVR players (manager fit + 2+ neighbor synergy + natural position)
 * can trigger on strong relative displays without needing superstar 7.4+ match ratings.
 */
export function getAwakeningMinMatchRating(
  baseOvr: number,
  wellUtilized: boolean,
): number {
  if (baseOvr <= 76) return wellUtilized ? 6.8 : 6.9;
  if (baseOvr <= 79) return wellUtilized ? 6.9 : 7.0;
  if (baseOvr <= 81) return wellUtilized ? 7.1 : 7.2;
  if (baseOvr <= 84) return 7.3;
  return 7.4;
}

export function getAwakeningExpectedGainRange(
  baseOvr: number,
): { min: number; max: number } {
  const maxAllowed = Math.max(0, AWAKENING_OVR_HARD_CAP - baseOvr);
  if (maxAllowed < AWAKENING_MIN_GAIN) return { min: 0, max: 0 };
  if (baseOvr >= AWAKENING_SUPERSTAR_OVR_THRESHOLD) {
    const cap = Math.min(AWAKENING_SUPERSTAR_MAX_GAIN, maxAllowed);
    return { min: cap, max: cap };
  }
  if (baseOvr <= 76) return { min: 6, max: Math.min(8, maxAllowed) };
  if (baseOvr <= 79) return { min: 5, max: Math.min(8, maxAllowed) };
  if (baseOvr <= 81) return { min: 4, max: Math.min(7, maxAllowed) };
  if (baseOvr <= 84) return { min: 3, max: Math.min(6, maxAllowed) };
  return { min: 2, max: Math.min(4, maxAllowed) };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function pickWeightedInt(
  entries: [number, number][],
  rng: () => number,
): number {
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = rng() * total;
  for (const [val, w] of entries) {
    r -= w;
    if (r <= 0) return val;
  }
  return entries[entries.length - 1][0];
}

/**
 * Rolls the permanent OVR gain (+2..+8) conditioned on the player's base OVR.
 * - baseOvr >= 88: strictly +2 (capped at 94)
 * - Low/mid OVR gems (<=84) enjoy substantially larger breakthrough ceilings (+3..+8).
 */
export function rollAwakeningOvrGain(
  baseOvr: number,
  rng: () => number = Math.random,
): number {
  const maxAllowed = Math.max(0, AWAKENING_OVR_HARD_CAP - baseOvr);
  if (maxAllowed < AWAKENING_MIN_GAIN) {
    return Math.max(0, maxAllowed);
  }
  if (baseOvr >= AWAKENING_SUPERSTAR_OVR_THRESHOLD) {
    return Math.min(AWAKENING_SUPERSTAR_MAX_GAIN, maxAllowed);
  }

  let table: [number, number][];
  if (baseOvr <= 76) {
    table = [
      [6, 25],
      [7, 45],
      [8, 30],
    ];
  } else if (baseOvr <= 79) {
    table = [
      [5, 20],
      [6, 35],
      [7, 30],
      [8, 15],
    ];
  } else if (baseOvr <= 81) {
    table = [
      [4, 24],
      [5, 36],
      [6, 26],
      [7, 14],
    ];
  } else if (baseOvr <= 84) {
    table = [
      [3, 22],
      [4, 38],
      [5, 28],
      [6, 12],
    ];
  } else {
    // 85..87
    table = [
      [2, 35],
      [3, 45],
      [4, 20],
    ];
  }

  const rolled = pickWeightedInt(table, rng);
  return clamp(rolled, AWAKENING_MIN_GAIN, Math.min(AWAKENING_MAX_GAIN, maxAllowed));
}

/**
 * Validates whether an awakening record is legal against the canonical DB player
 * (used on save hydration, HOF reconstruction, and Global TOP 15 anti-cheat checks).
 */
export function isValidAwakeningRecord(
  canonicalPlayer: Pick<Player, 'ovr' | 'isLegend'>,
  record: PlayerAwakeningRecord | undefined | null,
): record is PlayerAwakeningRecord {
  if (!record || canonicalPlayer.isLegend) return false;
  if (
    typeof record.ovrGain !== 'number' ||
    !Number.isFinite(record.ovrGain) ||
    record.ovrGain < AWAKENING_MIN_GAIN ||
    record.ovrGain > AWAKENING_MAX_GAIN
  ) {
    return false;
  }
  if (
    canonicalPlayer.ovr >= AWAKENING_SUPERSTAR_OVR_THRESHOLD &&
    record.ovrGain > AWAKENING_SUPERSTAR_MAX_GAIN
  ) {
    return false;
  }
  if (canonicalPlayer.ovr + record.ovrGain > AWAKENING_OVR_HARD_CAP) {
    return false;
  }
  return true;
}

/**
 * Computes position-tailored permanent attribute growth and returns a brand-new immutable
 * `Player` clone (NEVER mutating the input or static DB object).
 */
export function applyAwakeningToPlayer(
  basePlayer: Player,
  record: PlayerAwakeningRecord,
): Player {
  if (basePlayer.isLegend) return basePlayer;
  const originalOvr = basePlayer.awakening?.originalOvr ?? basePlayer.ovr;
  const ovrGain = clamp(
    Math.round(record.ovrGain),
    AWAKENING_MIN_GAIN,
    Math.min(
      originalOvr >= AWAKENING_SUPERSTAR_OVR_THRESHOLD
        ? AWAKENING_SUPERSTAR_MAX_GAIN
        : AWAKENING_MAX_GAIN,
      Math.max(AWAKENING_MIN_GAIN, AWAKENING_OVR_HARD_CAP - originalOvr),
    ),
  );
  const newOvr = clamp(originalOvr + ovrGain, 50, AWAKENING_OVR_HARD_CAP);

  // Derive base attributes from untouched pre-awakening baseline
  const baselineForAttrs: Player = basePlayer.awakening
    ? { ...basePlayer, ovr: originalOvr, attrs: undefined, awakening: undefined }
    : basePlayer;
  const baseAttrs = getPlayerAttributes(baselineForAttrs);
  const sub = getPrimarySubPosition(basePlayer);
  const weights = getPositionWeights(sub);

  const statDeltas: { key: string; label: string; before: number; after: number }[] = [];
  let nextAttrs: PlayerAttributes;
  let attGain = ovrGain;
  let midGain = ovrGain;
  let defGain = ovrGain;

  if (basePlayer.position === 'GK' && baseAttrs.gk) {
    const gkWeights: { key: keyof GoalkeeperAttributes; mult: number }[] = [
      { key: 'ref', mult: 1.25 },
      { key: 'div', mult: 1.2 },
      { key: 'pos', mult: 1.15 },
      { key: 'han', mult: 1.05 },
      { key: 'kic', mult: 0.95 },
    ];
    const nextGk: GoalkeeperAttributes = { ...baseAttrs.gk };
    for (const { key, mult } of gkWeights) {
      const before = baseAttrs.gk[key];
      const delta = Math.max(1, Math.round(ovrGain * mult));
      const after = clamp(before + delta, 40, 99);
      nextGk[key] = after;
      const meta = GK_ATTR_META.find((m) => m.key === key);
      statDeltas.push({
        key: meta?.shortLabel ?? key.toUpperCase(),
        label: meta?.fullLabel ?? key,
        before,
        after,
      });
    }
    nextAttrs = {
      sho: baseAttrs.sho,
      pas: clamp(baseAttrs.pas + Math.round(ovrGain * 0.7), 40, 99),
      cro: baseAttrs.cro,
      dri: baseAttrs.dri,
      aer: clamp(baseAttrs.aer + Math.round(ovrGain * 0.8), 40, 99),
      def: clamp(baseAttrs.def + ovrGain, 40, 99),
      phy: clamp(baseAttrs.phy + Math.round(ovrGain * 0.7), 40, 99),
      gk: nextGk,
    };
    attGain = Math.round(ovrGain * 0.35);
    midGain = Math.round(ovrGain * 0.55);
    defGain = ovrGain;
  } else {
    const fieldKeys: (keyof Omit<PlayerAttributes, 'gk'>)[] = [
      'sho',
      'pas',
      'cro',
      'dri',
      'aer',
      'def',
      'phy',
    ];
    const nextField: PlayerAttributes = { ...baseAttrs };
    const rankedDeltas: {
      key: string;
      label: string;
      before: number;
      after: number;
      weight: number;
    }[] = [];

    for (const key of fieldKeys) {
      const w = weights[key];
      const before = baseAttrs[key];
      // Core position stats (w >= 0.20) grow 1.15~1.30x; secondary stats grow 0.85~1.05x; non-core grow ~0.35x
      const mult = w >= 0.25 ? 1.28 : w >= 0.16 ? 1.1 : w > 0 ? 0.85 : 0.35;
      const delta = w > 0 ? Math.max(1, Math.round(ovrGain * mult)) : Math.round(ovrGain * mult);
      const after = clamp(before + delta, 40, 99);
      nextField[key] = after;
      if (after > before) {
        const meta = FIELD_ATTR_META.find((m) => m.key === key);
        rankedDeltas.push({
          key: meta?.shortLabel ?? key.toUpperCase(),
          label: meta?.fullLabel ?? key,
          before,
          after,
          weight: w,
        });
      }
    }
    rankedDeltas.sort((a, b) => b.weight - a.weight || (b.after - b.before) - (a.after - a.before));
    for (const d of rankedDeltas.slice(0, 4)) {
      statDeltas.push({
        key: d.key,
        label: d.label,
        before: d.before,
        after: d.after,
      });
    }
    nextAttrs = nextField;

    // Tailor A/M/D line growths by broad position
    if (basePlayer.position === 'FW') {
      attGain = Math.max(ovrGain, Math.round(ovrGain * 1.15));
      midGain = Math.max(1, Math.round(ovrGain * 0.85));
      defGain = Math.round(ovrGain * 0.4);
    } else if (basePlayer.position === 'MF') {
      attGain = Math.max(1, Math.round(ovrGain * 0.9));
      midGain = Math.max(ovrGain, Math.round(ovrGain * 1.15));
      defGain = Math.max(1, Math.round(ovrGain * 0.85));
    } else {
      attGain = Math.round(ovrGain * 0.5);
      midGain = Math.max(1, Math.round(ovrGain * 0.85));
      defGain = Math.max(ovrGain, Math.round(ovrGain * 1.15));
    }
  }

  const finalRecord: PlayerAwakeningRecord = {
    originalOvr,
    ovrGain,
    round: record.round,
    competition: record.competition,
    statDeltas:
      record.statDeltas && record.statDeltas.length > 0
        ? record.statDeltas
        : statDeltas.slice(0, 4),
  };

  return {
    ...basePlayer,
    ovr: newOvr,
    att: clamp(basePlayer.att + attGain, 30, 99),
    mid: clamp(basePlayer.mid + midGain, 30, 99),
    def: clamp(basePlayer.def + defGain, 30, 99),
    attrs: nextAttrs,
    awakening: finalRecord,
  };
}

export interface CheckPostMatchAwakeningParams {
  starters: (Player | null)[];
  bench: (Player | null)[];
  formation?: FormationId;
  matchPlayedNumber: number; // total user matches played so far in season
  round: number;
  competition: 'league' | 'cup' | 'ucl';
  ratingsByPlayerId: Record<string, number>;
  goalsByPlayerId: Record<string, number>;
  assistsByPlayerId: Record<string, number>;
  minutesByPlayerId: Record<string, number>;
  cleanSheet: boolean;
  allPlayerStats: Record<string, PlayerSeasonStats>;
  slotSynergies?: Record<number, PlayerSlotSynergy>;
  conditionMap?: PlayerConditionMap;
  managerTraitId: ManagerTraitId | null;
  staffCoachId?: StaffCoachId | null;
  existingAwakenedPlayers?: Record<string, PlayerAwakeningRecord>;
  rng?: () => number;
}

export interface AwakeningCandidateEvaluation {
  perfMult: number;
  utilMult: number;
  positionPenalty: number;
  teamCountMult: number;
  coachMult: number;
  tierMult: number;
  finalProb: number;
}

export interface PostMatchAwakeningResult {
  triggered: boolean;
  awakenedPlayer: Player | null;
  record: PlayerAwakeningRecord | null;
  alert: AwakeningAlertItem | null;
}

/**
 * Pure probability breakdown for a single eligible candidate combining:
 * 1) Real match & season performance (rating, goals, assists, clean sheet, minutes, season stats)
 * 2) Manager utilization quality (neighbor synergy, manager fit, morale, stamina/condition, position fit)
 * 3) Team season-count attenuation, potential coach bonus, and OVR 89+ tier rarity.
 */
export function computeAwakeningCandidateProbability(params: {
  player: Player;
  rating: number;
  goals: number;
  assists: number;
  minutes: number;
  cleanSheet: boolean;
  seasonStats?: PlayerSeasonStats;
  synergy?: PlayerSlotSynergy;
  hasSynergyContext: boolean;
  condition?: PlayerConditionMap[string];
  managerTraitId: ManagerTraitId | null;
  positionPenalty?: number;
  teamCountMult: number;
  coachMult: number;
}): AwakeningCandidateEvaluation {
  const {
    player,
    rating,
    goals,
    assists,
    minutes,
    cleanSheet,
    seasonStats: st,
    synergy: syn,
    hasSynergyContext,
    condition: cond,
    managerTraitId,
    positionPenalty = 0,
    teamCountMult,
    coachMult,
  } = params;

  if (player.isLegend || player.ovr >= AWAKENING_OVR_HARD_CAP) {
    return {
      perfMult: 0,
      utilMult: 0,
      positionPenalty,
      teamCountMult,
      coachMult,
      tierMult: 0,
      finalProb: 0,
    };
  }

  const mgrFit = evaluateManagerPlayerSynergy(player, managerTraitId);
  const wellUtilized =
    mgrFit.isMatch && (syn?.neighborBonus ?? 0) >= 2 && positionPenalty === 0;

  // OVR-relative rating expectation: a 74 OVR player delivering 7.1~7.3 is outperforming their baseline
  const ovrExpectationOffset =
    player.ovr <= 76 ? 0.45 : player.ovr <= 79 ? 0.3 : player.ovr <= 81 ? 0.15 : 0;
  const adjRating = rating + ovrExpectationOffset;

  // 1) Actual match + season performance multiplier (OVR-relative)
  let perfMult = 0.9;
  if (adjRating >= 8.5) perfMult = 2.25;
  else if (adjRating >= 8.1) perfMult = 1.75;
  else if (adjRating >= 7.8) perfMult = 1.42;
  else if (adjRating >= 7.55) perfMult = 1.18;
  else if (adjRating >= 7.25) perfMult = 1.02;

  const isDefensiveCleanSheet =
    cleanSheet &&
    (player.position === 'GK' || player.position === 'DF') &&
    adjRating >= 7.45;
  const directGA = goals + assists;
  if (directGA >= 2) {
    perfMult *= 1.42;
  } else if (directGA === 1 || isDefensiveCleanSheet) {
    perfMult *= 1.24;
  } else if (player.ovr <= 79 && wellUtilized) {
    // Well-nurtured low-OVR connective players (DM/CM/FB/CB) shouldn't be harshly taxed for non-G/A displays
    perfMult *= 0.98;
  } else {
    perfMult *= 0.86;
  }

  if (minutes >= 80) perfMult *= 1.12;
  else if (minutes < 60) perfMult *= 0.82;

  if (st && st.appearances >= AWAKENING_MIN_APPEARANCES) {
    const seasonAdjAvg = st.avgRating + ovrExpectationOffset * 0.7;
    if (st.appearances >= 8 && seasonAdjAvg >= 7.4) perfMult *= 1.32;
    else if (seasonAdjAvg >= 7.12) perfMult *= 1.15;
    else if (seasonAdjAvg < 6.75) perfMult *= 0.62;

    const gaPerApp = (st.goals + st.assists) / Math.max(1, st.appearances);
    const csRate = st.cleanSheets / Math.max(1, st.appearances);
    if ((player.position === 'FW' || player.position === 'MF') && gaPerApp >= 0.65) {
      perfMult *= 1.18;
    } else if ((player.position === 'GK' || player.position === 'DF') && csRate >= 0.4) {
      perfMult *= 1.15;
    }
  }

  // 2) Comprehensive manager utilization multiplier
  let utilMult = 1.0;

  // 2a. Neighbor synergy links
  if (syn) {
    if (syn.neighborBonus >= 3) utilMult *= 1.45;
    else if (syn.neighborBonus >= 2) utilMult *= 1.25;
    else if (syn.neighborBonus === 1) utilMult *= 0.98;
    else utilMult *= 0.5;
  } else if (hasSynergyContext) {
    utilMult *= 0.5;
  }

  // 2b. Manager trait compatibility
  if (mgrFit.isMatch) {
    utilMult *= 1.4;
  } else if (managerTraitId !== null) {
    utilMult *= 0.75;
  }

  // 2c. Morale
  const morale = cond?.morale ?? 0;
  if (morale >= 4) utilMult *= 1.32;
  else if (morale >= 2) utilMult *= 1.15;
  else if (morale >= 0) utilMult *= 0.96;
  else if (morale >= -2) utilMult *= 0.55;
  else utilMult *= 0.25;

  // 2d. Physical condition / rotation workload care & injury check
  if (cond?.injury) {
    utilMult *= 0.25;
  } else if (cond) {
    if (cond.consecutiveMatchesPlayed <= 5) {
      utilMult *= 1.18;
    } else if (cond.consecutiveMatchesPlayed >= 12) {
      utilMult *= 0.45;
    } else if (cond.consecutiveMatchesPlayed >= 8) {
      utilMult *= 0.62;
    }
  }

  // 2e. Position fit (natural role vs forced out-of-position)
  if (positionPenalty === 0) {
    utilMult *= 1.22;
  } else if (positionPenalty >= -3) {
    utilMult *= 0.85;
  } else if (positionPenalty >= -8) {
    utilMult *= 0.35;
  } else {
    utilMult *= 0.14;
  }

  // 2f. Low-OVR Cultivation Resonance: rewards pairing low-OVR gems with manager fit + synergy + natural role
  if (wellUtilized) {
    if (player.ovr <= 76) utilMult *= 1.24;
    else if (player.ovr <= 79) utilMult *= 1.18;
    else if (player.ovr <= 81) utilMult *= 1.1;
  }

  // 3) Tier multiplier (<=76 x2.10, 77..79 x1.85, 80..81 x1.55, 82..84 x1.35, 85..87 x0.75, 88+ x0.04)
  const tierMult = getAwakeningTierRateMultiplier(player.ovr);
  const maxCandidateProb =
    player.ovr <= 79
      ? AWAKENING_LOW_OVR_MAX_CANDIDATE_PROB
      : AWAKENING_MAX_CANDIDATE_PROB;

  const finalProb = clamp(
    AWAKENING_BASE_ELIGIBLE_PROB *
      perfMult *
      utilMult *
      teamCountMult *
      coachMult *
      tierMult,
    0,
    maxCandidateProb,
  );

  return {
    perfMult,
    utilMult,
    positionPenalty,
    teamCountMult,
    coachMult,
    tierMult,
    finalProb,
  };
}

/**
 * Evaluates post-match awakening eligibility and rolls at most 1 breakthrough per match.
 * Combines real match/season performance + comprehensive utilization (synergy, manager fit,
 * morale, stamina/condition, position fit, potential coach).
 */
export function evaluatePostMatchAwakening(
  params: CheckPostMatchAwakeningParams,
): PostMatchAwakeningResult {
  const {
    starters,
    bench,
    formation,
    matchPlayedNumber,
    round,
    competition,
    ratingsByPlayerId,
    goalsByPlayerId,
    assistsByPlayerId,
    minutesByPlayerId,
    cleanSheet,
    allPlayerStats,
    slotSynergies,
    conditionMap,
    managerTraitId,
    staffCoachId = null,
    existingAwakenedPlayers = {},
    rng = Math.random,
  } = params;

  const none: PostMatchAwakeningResult = {
    triggered: false,
    awakenedPlayer: null,
    record: null,
    alert: null,
  };

  if (matchPlayedNumber < AWAKENING_MIN_SEASON_MATCH) return none;

  const alreadyCount = Object.keys(existingAwakenedPlayers).length;
  if (alreadyCount >= AWAKENING_MAX_VALID_PER_TEAM) return none;

  // Team-level count scaling for 0~3 players/season:
  // 1st x1.00, 2nd x0.78, 3rd x0.48, 4th+ x0.05 strong attenuation
  const teamCountMult =
    alreadyCount === 0
      ? 1.0
      : alreadyCount === 1
        ? AWAKENING_SECOND_COUNT_MULT
        : alreadyCount === 2
          ? AWAKENING_THIRD_COUNT_MULT
          : AWAKENING_FOURTH_PLUS_MULT;

  const coachMult =
    staffCoachId === 'sys_potential_dev' ? STAFF_COACH_DEV_AWAKENING_MULT : 1.0;

  const hasSynergyContext = Boolean(slotSynergies && Object.keys(slotSynergies).length > 0);
  const synergyByPlayerId = new Map<string, PlayerSlotSynergy>();
  if (slotSynergies) {
    for (const s of Object.values(slotSynergies)) {
      synergyByPlayerId.set(s.playerId, s);
    }
  }

  // Precompute starter position-fit penalty when formation is available
  const positionPenaltyByPlayerId = new Map<string, number>();
  if (formation && FORMATIONS[formation]) {
    const slots = FORMATIONS[formation].slots;
    for (let i = 0; i < starters.length && i < slots.length; i += 1) {
      const p = starters[i];
      if (!p) continue;
      const slot = slots[i];
      const fit = evaluatePositionFit(
        p,
        slot.subPosition,
        managerTraitId,
        slot.alternateSubPositions,
      );
      positionPenaltyByPlayerId.set(p.id, fit.penalty);
    }
  }

  const allPlayers = [
    ...starters.filter((p): p is Player => p !== null),
    ...bench.filter((p): p is Player => p !== null),
  ];

  // Evaluate candidates in order of highest OVR-relative performance so deserving gems get a fair shot
  const candidates = allPlayers
    .filter((p) => {
      if (p.isLegend) return false; // Hard guard: Era Classics 0%
      if (p.awakening || existingAwakenedPlayers[p.id]) return false;
      if (p.ovr >= AWAKENING_OVR_HARD_CAP) return false;
      const mins = minutesByPlayerId[p.id] ?? 0;
      if (mins < 45) return false;
      const rating = ratingsByPlayerId[p.id] ?? 0;
      const syn = synergyByPlayerId.get(p.id);
      const posPen = positionPenaltyByPlayerId.get(p.id) ?? 0;
      const mgrFit = evaluateManagerPlayerSynergy(p, managerTraitId);
      const wellUtilized =
        mgrFit.isMatch && (syn?.neighborBonus ?? 0) >= 2 && posPen === 0;
      const minRating = getAwakeningMinMatchRating(p.ovr, wellUtilized);
      if (rating < minRating) return false;
      const st = allPlayerStats[p.id];
      const apps = st?.appearances ?? matchPlayedNumber;
      if (apps < AWAKENING_MIN_APPEARANCES) return false;
      return true;
    })
    .sort((a, b) => (ratingsByPlayerId[b.id] ?? 0) - (ratingsByPlayerId[a.id] ?? 0));

  for (const player of candidates) {
    const rating = ratingsByPlayerId[player.id] ?? 7.4;
    const goals = goalsByPlayerId[player.id] ?? 0;
    const assists = assistsByPlayerId[player.id] ?? 0;
    const minutes = minutesByPlayerId[player.id] ?? 90;
    const st = allPlayerStats[player.id];
    const syn = synergyByPlayerId.get(player.id);
    const cond = conditionMap?.[player.id];
    const mgrFit = evaluateManagerPlayerSynergy(player, managerTraitId);
    const positionPenalty = positionPenaltyByPlayerId.get(player.id) ?? 0;

    const evalRes = computeAwakeningCandidateProbability({
      player,
      rating,
      goals,
      assists,
      minutes,
      cleanSheet,
      seasonStats: st,
      synergy: syn,
      hasSynergyContext,
      condition: cond,
      managerTraitId,
      positionPenalty,
      teamCountMult,
      coachMult,
    });

    if (rng() < evalRes.finalProb) {
      const ovrGain = rollAwakeningOvrGain(player.ovr, rng);
      if (ovrGain < AWAKENING_MIN_GAIN) continue;
      const draftRecord: PlayerAwakeningRecord = {
        originalOvr: player.ovr,
        ovrGain,
        round,
        competition,
        statDeltas: [],
      };
      const awakenedPlayer = applyAwakeningToPlayer(player, draftRecord);
      const finalRecord = awakenedPlayer.awakening!;
      const reasonParts: string[] = [];
      if (goals >= 2) reasonParts.push(`${goals}골 맹활약`);
      else if (goals >= 1 && assists >= 1) reasonParts.push(`${goals}골 ${assists}도움`);
      else if (goals >= 1) reasonParts.push('결정적인 득점');
      else if (assists >= 1) reasonParts.push('날카로운 어시스트');
      else if (cleanSheet && (player.position === 'GK' || player.position === 'DF')) {
        reasonParts.push('무실점 철벽 수비');
      }
      if (rating >= 8.0) reasonParts.push(`평점 ${rating.toFixed(1)}`);
      if (mgrFit.isMatch) reasonParts.push('감독 전술과의 완벽한 호흡');
      else if (syn && syn.neighborBonus >= 2) reasonParts.push('팀 동료들과의 끈끈한 시너지');
      else if (
        formation &&
        positionPenalty === 0 &&
        !cond?.injury &&
        (cond?.consecutiveMatchesPlayed ?? 0) <= 5
      ) {
        reasonParts.push('최적 포지션·컨디션 기용');
      }
      if (staffCoachId === 'sys_potential_dev') reasonParts.push('잠재력 육성 코치의 집중 지도');
      const reasonLead =
        reasonParts.length > 0
          ? `${reasonParts.slice(0, 2).join('과 ')} 속에`
          : '꾸준한 실전 활약 속에';
      const reason = `${reasonLead} 잠재력이 완전히 만개했습니다! 기본 OVR이 영구적으로 ${finalRecord.originalOvr}에서 ${awakenedPlayer.ovr}(+${finalRecord.ovrGain})로 성장했습니다.`;

      const alert: AwakeningAlertItem = {
        id: `awk-${competition}-r${round}-${player.id}`,
        playerId: player.id,
        playerName: player.name,
        position: player.position,
        mainPosition: player.mainPositions[0] ?? (player.position === 'GK' ? 'GK' : 'CM'),
        nationality: player.nationality,
        nationalityCode: player.nationalityCode,
        originalOvr: finalRecord.originalOvr,
        newOvr: awakenedPlayer.ovr,
        ovrGain: finalRecord.ovrGain,
        round,
        competition,
        statDeltas: finalRecord.statDeltas,
        reason,
      };
      return {
        triggered: true,
        awakenedPlayer,
        record: finalRecord,
        alert,
      };
    }
  }

  return none;
}

export interface DraftAwakeningPotentialHint {
  level: 'high' | 'good';
  shortLabel: string; // '포텐↑' | '육성'
  expectedGainText: string; // e.g. '+3~+6'
  tooltip: string;
}

/**
 * Computes a concise, restrained awakening-potential hint for draft candidate cards.
 * Returns null for Classics (`isLegend`), already-awakened players, or high-OVR stars (`>= 85`)
 * so cards stay clean and clutter-free.
 */
export function evaluateDraftAwakeningPotential(
  player: Pick<
    Player,
    | 'ovr'
    | 'isLegend'
    | 'awakening'
    | 'position'
    | 'mainPositions'
    | 'secondaryPositions'
    | 'playstyles'
  >,
  options: {
    managerTraitId: ManagerTraitId | null;
    targetSubPosition?: import('../types/player').SubPosition;
    expectedLinkCount?: number;
    /** True when the candidate is currently previewed on a bench slot (no active starter synergy lines) */
    isBenchSlot?: boolean;
  },
): DraftAwakeningPotentialHint | null {
  if (player.isLegend || player.awakening || player.ovr > 84) return null;
  if (options.isBenchSlot) return null;

  const { managerTraitId, targetSubPosition, expectedLinkCount = 0 } = options;
  const mgrFit = evaluateManagerPlayerSynergy(
    player as Player,
    managerTraitId,
  );
  const posFit = targetSubPosition
    ? evaluatePositionFit(player as Player, targetSubPosition, managerTraitId)
    : null;
  const naturalFit = !posFit || posFit.penalty === 0;
  if (!naturalFit) return null;

  const range = getAwakeningExpectedGainRange(player.ovr);
  const expectedGainText =
    range.min === range.max ? `+${range.min}` : `+${range.min}~+${range.max}`;

  const reasons: string[] = [];
  if (player.ovr <= 76) reasons.push('숨은 원석(×2.10)');
  else if (player.ovr <= 79) reasons.push('원석 구간(×1.85)');
  else if (player.ovr <= 81) reasons.push('고잠재 구간(×1.55)');
  else reasons.push('중위권 유망(×1.35)');
  if (mgrFit.isMatch) reasons.push('감독 궁합 ✓');
  if (expectedLinkCount >= 2) reasons.push(`인접 ${expectedLinkCount}선 ✓`);
  if (posFit) reasons.push('주포지션 ✓');

  // High tier: low/mid OVR + natural fit + manager match + (2+ links or <=81 raw gem)
  if (mgrFit.isMatch && (expectedLinkCount >= 2 || player.ovr <= 81)) {
    return {
      level: 'high',
      shortLabel: '포텐↑',
      expectedGainText,
      tooltip: `포텐 각성 유망 (예상 ${expectedGainText}) · ${reasons.join(' · ')}`,
    };
  }

  // Good tier: low/mid OVR + natural fit + (manager match OR 2+ synergy links OR <=79 raw gem)
  if (mgrFit.isMatch || expectedLinkCount >= 2 || player.ovr <= 79) {
    return {
      level: 'good',
      shortLabel: '육성',
      expectedGainText,
      tooltip: `육성 적합 (예상 ${expectedGainText}) · ${reasons.join(' · ')}`,
    };
  }

  return null;
}

export interface SquadAwakeningReadinessSummary {
  eligible: boolean;
  tierLabel: string;
  expectedGainText: string;
  checks: { label: string; ok: boolean }[];
}

/**
 * Compact 1-line awakening readiness breakdown for PlayerDetailModal.
 */
export function evaluateSquadAwakeningReadiness(params: {
  player: Player;
  managerTraitId: ManagerTraitId | null;
  slotSynergy?: PlayerSlotSynergy | null;
  condition?: PlayerConditionMap[string] | null;
  positionPenalty?: number;
}): SquadAwakeningReadinessSummary | null {
  const { player, managerTraitId, slotSynergy, condition, positionPenalty = 0 } = params;
  if (player.isLegend || player.awakening || player.ovr >= AWAKENING_SUPERSTAR_OVR_THRESHOLD) {
    return null;
  }

  const range = getAwakeningExpectedGainRange(player.ovr);
  const expectedGainText =
    range.min === range.max ? `+${range.min}` : `+${range.min}~+${range.max}`;
  const mgrFit = evaluateManagerPlayerSynergy(player, managerTraitId);
  const synOk = (slotSynergy?.neighborBonus ?? 0) >= 2;
  const posOk = positionPenalty === 0;
  const moraleOk = (condition?.morale ?? 0) >= 0 && !condition?.injury;

  const tierLabel =
    player.ovr <= 79
      ? '최고 잠재력 (×1.75)'
      : player.ovr <= 81
        ? '높은 잠재력 (×1.50)'
        : player.ovr <= 84
          ? '유망 잠재력 (×1.35)'
          : '표준 잠재력 (×0.75)';

  return {
    eligible: true,
    tierLabel,
    expectedGainText,
    checks: [
      { label: '감독 궁합', ok: mgrFit.isMatch },
      { label: '시너지 +2↑', ok: synOk },
      { label: '주포지션', ok: posOk },
      { label: '컨디션·사기', ok: moraleOk },
    ],
  };
}

