import type {
  AiManagerProfile,
  FormationId,
  StaffCoachId,
  TacticalAdaptationAlert,
  TacticalAdaptationState,
  TacticalExposureTier,
  TacticalHistoryEntry,
} from '../types/game';
import type { TacticId } from '../types/league';
import { getBestCounterTactic } from './tacticEngine';

/**
 * AI Pre-Match Tactical Adaptation (Repeated Pattern Counter) Engine
 *
 * Tracks the user's recent 5 matches of `(formation, tactic)` usage.
 * - Repeating the exact same `(formation, tactic)` rapidly builds `exposureScore` (0..100).
 * - Varying either the formation or the tactic naturally drops exposure back to 'low'.
 * - Higher-OVR AI managers (`aiManagers.ts`) read high exposure before kickoff, adopting
 *   counter tactics and applying calibrated pattern-read matchup penalties.
 * - `sys_tactical_mastery` assistant coach mitigates exposure buildup by 45%.
 */
export const ADAPTATION_HISTORY_WINDOW = 5;
export const EXPOSURE_WARNING_THRESHOLD = 45;
export const EXPOSURE_DANGER_THRESHOLD = 72;
export const EXPOSURE_RESET_ALERT_BELOW = 35;
export const COACH_ADAPTATION_MITIGATION = 0.45; // -45% buildup with Tactical Mastery Coach

const RECENCY_WEIGHTS = [1.2, 1.0, 0.85, 0.7, 0.55] as const;

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export function createInitialTacticalAdaptationState(): TacticalAdaptationState {
  return {
    history: [],
    highestAlertedTier: 'low',
    pendingAlert: null,
  };
}

export interface TacticalExposureEvaluation {
  rawExposureScore: number; // 0..100 before coach mitigation
  exposureScore: number; // 0..100 effective exposure
  tier: TacticalExposureTier;
  tierLabel: string;
  consecutiveExactStreak: number;
  exactMatchesInWindow: number;
  mitigatedByCoach: boolean;
}

export function getExposureTier(score: number): TacticalExposureTier {
  if (score >= EXPOSURE_DANGER_THRESHOLD) return 'danger';
  if (score >= EXPOSURE_WARNING_THRESHOLD) return 'warning';
  return 'low';
}

export function getExposureTierLabel(tier: TacticalExposureTier): string {
  if (tier === 'danger') return '파훼 경계';
  if (tier === 'warning') return '주의';
  return '낮음';
}

/**
 * Evaluates how predictable the user's upcoming `(formation, tactic)` is based on
 * the recent 5-match history.
 */
export function evaluateTacticalExposure(params: {
  history: readonly TacticalHistoryEntry[];
  formation: FormationId;
  tactic: TacticId;
  staffCoachId?: StaffCoachId | null;
}): TacticalExposureEvaluation {
  const { history, formation, tactic, staffCoachId = null } = params;
  const recent = history.slice(-ADAPTATION_HISTORY_WINDOW);
  const mitigatedByCoach = staffCoachId === 'sys_tactical_mastery';

  if (recent.length === 0) {
    return {
      rawExposureScore: 0,
      exposureScore: 0,
      tier: 'low',
      tierLabel: getExposureTierLabel('low'),
      consecutiveExactStreak: 0,
      exactMatchesInWindow: 0,
      mitigatedByCoach,
    };
  }

  let raw = 0;
  let exactMatchesInWindow = 0;

  // Iterate newest -> oldest
  for (let lag = 0; lag < recent.length; lag += 1) {
    const entry = recent[recent.length - 1 - lag];
    const w = RECENCY_WEIGHTS[lag] ?? 0.5;
    const sameForm = entry.formation === formation;
    const sameTac = entry.tactic === tactic;
    if (sameForm && sameTac) {
      raw += 16 * w;
      exactMatchesInWindow += 1;
    } else if (sameTac) {
      raw += 5 * w;
    } else if (sameForm) {
      raw += 4 * w;
    }
  }

  // Consecutive identical `(formation, tactic)` streak looking backwards from most recent match
  let consecutiveExactStreak = 0;
  for (let i = recent.length - 1; i >= 0; i -= 1) {
    if (recent[i].formation === formation && recent[i].tactic === tactic) {
      consecutiveExactStreak += 1;
    } else {
      break;
    }
  }

  if (consecutiveExactStreak >= 5) raw += 32;
  else if (consecutiveExactStreak === 4) raw += 24;
  else if (consecutiveExactStreak === 3) raw += 13;
  else if (consecutiveExactStreak === 2) raw += 4;

  const rawExposureScore = clamp(Math.round(raw), 0, 100);
  const exposureScore = mitigatedByCoach
    ? clamp(Math.round(rawExposureScore * (1 - COACH_ADAPTATION_MITIGATION)), 0, 100)
    : rawExposureScore;
  const tier = getExposureTier(exposureScore);

  return {
    rawExposureScore,
    exposureScore,
    tier,
    tierLabel: getExposureTierLabel(tier),
    consecutiveExactStreak,
    exactMatchesInWindow,
    mitigatedByCoach,
  };
}

export interface AiPreMatchCounterEvaluation {
  exposureScore: number;
  tier: TacticalExposureTier;
  aiManagerOvr: number;
  aiIntelScale: number; // 0.15 .. 1.00
  counterStrength: number; // 0 .. 1.00
  responseLevelLabel: '없음' | '제한적' | '맞춤 대응' | '정밀 파훼';
  /** Optional counter tactic the AI manager deploys from kickoff */
  overrideAiTactic: TacticId | null;
  /** User line penalties (<= 0) */
  userAttPenalty: number;
  userMidPenalty: number;
  userDefPenalty: number;
  /** Opponent xG boost & user xG suppression */
  aiXgBonus: number;
  userXgPenalty: number;
}

/**
 * Evaluates how strongly an AI manager counters the user's repeated pattern before kickoff.
 * Scales directly with `aiManager.ovr` (from `aiManagers.ts`) so elite tacticians (OVR 88+)
 * punish rigid patterns decisively while lower-table coaches (OVR <= 79) react only mildly.
 */
export function evaluateAiPreMatchCounter(params: {
  exposure: TacticalExposureEvaluation;
  userTactic: TacticId;
  aiDefaultTactic: TacticId;
  aiManager: Pick<AiManagerProfile, 'ovr' | 'traitId' | 'preferredTactics'>;
  rng?: () => number;
}): AiPreMatchCounterEvaluation {
  const { exposure, userTactic, aiDefaultTactic, aiManager, rng } = params;
  const aiManagerOvr = aiManager.ovr;
  const aiIntelScale = round2(clamp((aiManagerOvr - 71) / 21, 0.15, 1.0));

  if (exposure.exposureScore < EXPOSURE_WARNING_THRESHOLD) {
    return {
      exposureScore: exposure.exposureScore,
      tier: exposure.tier,
      aiManagerOvr,
      aiIntelScale,
      counterStrength: 0,
      responseLevelLabel: '없음',
      overrideAiTactic: null,
      userAttPenalty: 0,
      userMidPenalty: 0,
      userDefPenalty: 0,
      aiXgBonus: 0,
      userXgPenalty: 0,
    };
  }

  const severity = clamp((exposure.exposureScore - 35) / 65, 0, 1);
  const counterStrength = round2(severity * aiIntelScale);

  // Determine whether the AI switches its starting tactic to counter the user's predictable style
  const idealCounter = getBestCounterTactic(userTactic);
  let overrideAiTactic: TacticId | null = null;
  if (idealCounter !== aiDefaultTactic && exposure.exposureScore >= 50) {
    let switchProb = 0;
    if (aiManagerOvr >= 88) {
      switchProb = clamp(0.5 + counterStrength * 0.45, 0.5, 0.95);
    } else if (aiManagerOvr >= 81) {
      switchProb = clamp(0.32 + counterStrength * 0.42, 0.32, 0.78);
    } else {
      switchProb = clamp(0.08 + counterStrength * 0.22, 0.08, 0.24);
    }
    const roll = rng ? rng() : counterStrength >= 0.42 ? 0.2 : 0.8;
    if (roll < switchProb) {
      overrideAiTactic = idealCounter;
    }
  }

  const userAttPenalty = -round2(counterStrength * 1.35);
  const userMidPenalty = -round2(counterStrength * 1.35);
  const userDefPenalty = -round2(counterStrength * 1.15);
  const aiXgBonus = round2(counterStrength * 0.14);
  const userXgPenalty = round2(counterStrength * 0.12);

  const responseLevelLabel: AiPreMatchCounterEvaluation['responseLevelLabel'] =
    counterStrength >= 0.62
      ? '정밀 파훼'
      : counterStrength >= 0.32
        ? '맞춤 대응'
        : '제한적';

  return {
    exposureScore: exposure.exposureScore,
    tier: exposure.tier,
    aiManagerOvr,
    aiIntelScale,
    counterStrength,
    responseLevelLabel,
    overrideAiTactic,
    userAttPenalty,
    userMidPenalty,
    userDefPenalty,
    aiXgBonus,
    userXgPenalty,
  };
}

const TIER_RANK: Record<TacticalExposureTier, number> = {
  low: 0,
  warning: 1,
  danger: 2,
};

/**
 * Records a completed user match into the 5-match rolling window and checks whether
 * a one-time non-spam warning/danger scouting alert should be queued.
 *
 * Anti-spam rule:
 * - Fires ONCE on first crossing into `'warning'` (`>= 45`) and ONCE on first crossing into `'danger'` (`>= 72`).
 * - Resets `highestAlertedTier` back to `'low'` only when variation drops exposure below `EXPOSURE_RESET_ALERT_BELOW` (`< 35`).
 */
export function recordMatchTacticalAdaptation(params: {
  prev: TacticalAdaptationState | undefined | null;
  formation: FormationId;
  tactic: TacticId;
  round: number;
  competition: 'league' | 'cup' | 'ucl';
  staffCoachId?: StaffCoachId | null;
}): TacticalAdaptationState {
  const base = params.prev ?? createInitialTacticalAdaptationState();
  const nextHistory: TacticalHistoryEntry[] = [
    ...base.history,
    {
      formation: params.formation,
      tactic: params.tactic,
      round: params.round,
      competition: params.competition,
    },
  ].slice(-ADAPTATION_HISTORY_WINDOW);

  // Project exposure if user keeps the same formation & tactic into the next match
  const projected = evaluateTacticalExposure({
    history: nextHistory,
    formation: params.formation,
    tactic: params.tactic,
    staffCoachId: params.staffCoachId,
  });

  let nextHighest = base.highestAlertedTier;
  let pendingAlert: TacticalAdaptationAlert | null = base.pendingAlert;

  if (projected.exposureScore < EXPOSURE_RESET_ALERT_BELOW) {
    nextHighest = 'low';
  } else if (
    (projected.tier === 'warning' || projected.tier === 'danger') &&
    TIER_RANK[projected.tier] > TIER_RANK[base.highestAlertedTier]
  ) {
    nextHighest = projected.tier;
    pendingAlert = {
      id: `adapt-${params.competition}-r${params.round}-${projected.tier}`,
      tier: projected.tier,
      exposureScore: projected.exposureScore,
      repeatedFormation: params.formation,
      repeatedTactic: params.tactic,
      consecutiveCount: Math.max(1, projected.consecutiveExactStreak),
    };
  }

  return {
    history: nextHistory,
    highestAlertedTier: nextHighest,
    pendingAlert,
  };
}
