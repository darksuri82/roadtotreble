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
 * Tracks the user's recent 8 matches of `(formation, tactic)` usage.
 * - Repeating the exact same `(formation, tactic)` builds `exposureScore` (0..100) gradually,
 *   entering `'warning'` around 5 consecutive matches and reaching `'danger'` (`파훼 경계`, >= 72)
 *   at 8 consecutive identical matches.
 * - Varying either the formation or the tactic naturally drops exposure back to `'low'`.
 * - Higher-OVR AI managers (`aiManagers.ts`, especially elite OVR 85+ tacticians) read high exposure
 *   and deploy unpredicted kickoff or 1st-half counter tactics plus calibrated pattern-read penalties.
 * - `sys_tactical_mastery` assistant coach mitigates exposure buildup by 45%.
 */
export const ADAPTATION_HISTORY_WINDOW = 8;
export const EXPOSURE_WARNING_THRESHOLD = 45;
export const EXPOSURE_DANGER_THRESHOLD = 72;
export const EXPOSURE_RESET_ALERT_BELOW = 35;
export const ELITE_AI_COUNTER_OVR_THRESHOLD = 85;
export const COACH_ADAPTATION_MITIGATION = 0.45; // -45% buildup with Tactical Mastery Coach

const RECENCY_WEIGHTS = [1.15, 1.05, 0.95, 0.88, 0.82, 0.76, 0.7, 0.64] as const;

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
 * the recent 8-match history.
 * Calibrated progression for consecutive identical `(formation, tactic)`:
 * 1:10, 2:19, 3:27, 4:36 (low) -> 5:46, 6:57, 7:67 (warning) -> 8:76 (danger).
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
    const w = RECENCY_WEIGHTS[lag] ?? 0.6;
    const sameForm = entry.formation === formation;
    const sameTac = entry.tactic === tactic;
    if (sameForm && sameTac) {
      raw += 8.5 * w;
      exactMatchesInWindow += 1;
    } else if (sameTac) {
      raw += 3.0 * w;
    } else if (sameForm) {
      raw += 2.4 * w;
    }
  }

  // Consecutive identical `(formation, tactic)` streak looking backwards across stored history (up to 18 matches)
  let consecutiveExactStreak = 0;
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i].formation === formation && history[i].tactic === tactic) {
      consecutiveExactStreak += 1;
    } else {
      break;
    }
  }

  if (consecutiveExactStreak >= 8) raw += 17;
  else if (consecutiveExactStreak === 7) raw += 13;
  else if (consecutiveExactStreak === 6) raw += 9;
  else if (consecutiveExactStreak === 5) raw += 5;
  else if (consecutiveExactStreak === 4) raw += 2;

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

export const ADAPTATION_STREAK_HISTORY_LIMIT = 18;
export const ADAPTATION_MAX_ATT_PENALTY = 3.0;
export const ADAPTATION_MAX_MID_PENALTY = 3.2;
export const ADAPTATION_MAX_DEF_PENALTY = 2.8;
export const ADAPTATION_MAX_AI_XG_BONUS = 0.34;
export const ADAPTATION_MAX_USER_XG_PENALTY = 0.30;
export const ADAPTATION_MAX_AI_OPP_XG_PENALTY = 0.17;
export const ADAPTATION_MAX_POSSESSION_PENALTY = 4.6;
export const ADAPTATION_MAX_MATCHUP_OVR_PENALTY = 1.8;

export interface AiPreMatchCounterEvaluation {
  exposureScore: number;
  tier: TacticalExposureTier;
  aiManagerOvr: number;
  aiIntelScale: number; // 0.30 .. 1.00
  counterStrength: number; // 0 .. 1.00
  responseLevelLabel: '없음' | '제한적' | '맞춤 대응' | '정밀 파훼';
  /** Optional counter tactic the AI manager deploys against the user's predictable style */
  overrideAiTactic: TacticId | null;
  /** Whether the counter deploys from kickoff or as a 1st-half tactical twist */
  counterTiming: 'kickoff' | 'first_half' | null;
  /** Minute when the counter takes effect (0 for kickoff, 18..28 for 1st-half twist) */
  counterMinute: number;
  /** User line penalties (<= 0) */
  userAttPenalty: number;
  userMidPenalty: number;
  userDefPenalty: number;
  /** Opponent xG boost, user xG suppression & opponent defensive organization bonus */
  aiXgBonus: number;
  userXgPenalty: number;
  aiOppXgPenalty: number;
  /** Possession loss (%) & tactical matchup OVR shift applied against the user */
  possessionPenalty: number;
  matchupOvrPenalty: number;
}

/**
 * Derives a normalized 0..1 counter severity for 2D pitch simulation doctrine adjustments.
 */
export function computePitchCounterSeverity(
  exposureScore: number,
  aiManagerOvr: number,
): number {
  if (exposureScore < EXPOSURE_WARNING_THRESHOLD) return 0;
  const aiIntelScale = clamp((aiManagerOvr - 70) / 16, 0.30, 1.0);
  const severity = clamp(
    (exposureScore - 36) / (EXPOSURE_DANGER_THRESHOLD - 36),
    0,
    1.0,
  );
  const eliteDangerBoost =
    exposureScore >= EXPOSURE_DANGER_THRESHOLD &&
    aiManagerOvr >= ELITE_AI_COUNTER_OVR_THRESHOLD
      ? 1.15
      : 1.0;
  return round2(clamp(severity * aiIntelScale * eliteDangerBoost, 0, 1.0));
}

/**
 * Evaluates how strongly an AI manager counters the user's repeated pattern before/during the 1st half.
 * Scales directly with `aiManager.ovr` (from `aiManagers.ts`) so elite tacticians (OVR 85+)
 * punish rigid patterns decisively with unpredicted counter tactics and steep match penalties,
 * mid-table managers apply meaningful tactical counters once tape builds up,
 * and persistent 10+/14+ match rigidity escalates penalties further (+20% / +35%).
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
  const aiIntelScale = round2(clamp((aiManagerOvr - 70) / 16, 0.30, 1.0));

  if (exposure.exposureScore < EXPOSURE_WARNING_THRESHOLD) {
    return {
      exposureScore: exposure.exposureScore,
      tier: exposure.tier,
      aiManagerOvr,
      aiIntelScale,
      counterStrength: 0,
      responseLevelLabel: '없음',
      overrideAiTactic: null,
      counterTiming: null,
      counterMinute: 0,
      userAttPenalty: 0,
      userMidPenalty: 0,
      userDefPenalty: 0,
      aiXgBonus: 0,
      userXgPenalty: 0,
      aiOppXgPenalty: 0,
      possessionPenalty: 0,
      matchupOvrPenalty: 0,
    };
  }

  // Normalize against the real 8-match danger threshold (72) so 8 consecutive matches hits full severity
  const baseSeverity = clamp(
    (exposure.exposureScore - 36) / (EXPOSURE_DANGER_THRESHOLD - 36),
    0,
    1.0,
  );
  // Elite tacticians (OVR 85+) apply an extra sharp tactical-read multiplier once pattern enters 'danger'
  const eliteDangerMult =
    exposure.tier === 'danger' && aiManagerOvr >= ELITE_AI_COUNTER_OVR_THRESHOLD
      ? 1.15
      : exposure.tier === 'danger' && aiManagerOvr >= 80
        ? 1.08
        : 1.0;
  const counterStrength = round2(
    clamp(baseSeverity * aiIntelScale * eliteDangerMult, 0, 1.0),
  );
  // Persistent rigidity escalation when user refuses to adjust tactics for 10+ / 14+ straight matches
  const rigidityMult =
    exposure.tier === 'danger' && exposure.consecutiveExactStreak >= 14
      ? 1.35
      : exposure.tier === 'danger' && exposure.consecutiveExactStreak >= 10
        ? 1.2
        : 1.0;
  const effectivePenaltyScale = counterStrength * rigidityMult;

  // Determine whether the AI switches its 1st-half tactic to counter the user's predictable style
  const idealCounter = getBestCounterTactic(userTactic);
  let overrideAiTactic: TacticId | null = null;
  let counterTiming: 'kickoff' | 'first_half' | null = null;
  let counterMinute = 0;

  if (idealCounter !== aiDefaultTactic && exposure.exposureScore >= EXPOSURE_WARNING_THRESHOLD) {
    let switchProb = 0;
    if (aiManagerOvr >= 88) {
      switchProb = clamp(
        (exposure.tier === 'danger' ? 0.88 : 0.56) + counterStrength * 0.12,
        0.56,
        0.98,
      );
    } else if (aiManagerOvr >= ELITE_AI_COUNTER_OVR_THRESHOLD) {
      switchProb = clamp(
        (exposure.tier === 'danger' ? 0.78 : 0.44) + counterStrength * 0.18,
        0.44,
        0.94,
      );
    } else if (aiManagerOvr >= 80) {
      switchProb = clamp(0.36 + counterStrength * 0.46, 0.36, 0.82);
    } else {
      switchProb = clamp(0.16 + counterStrength * 0.32, 0.16, 0.48);
    }
    if (rigidityMult > 1.0) {
      switchProb = clamp(switchProb + 0.12, 0, 0.98);
    }
    const roll = rng ? rng() : counterStrength >= 0.42 ? 0.2 : 0.8;
    if (roll < switchProb) {
      overrideAiTactic = idealCounter;
      // Elite tacticians may either ambush right from kickoff OR twist mid-1st-half (18'~28')
      const timingRoll = rng ? rng() : roll;
      if (timingRoll < 0.62) {
        counterTiming = 'kickoff';
        counterMinute = 0;
      } else {
        counterTiming = 'first_half';
        counterMinute = 18 + Math.floor(((timingRoll - 0.62) / 0.38) * 11);
      }
    }
  }

  const userAttPenalty = -round2(effectivePenaltyScale * ADAPTATION_MAX_ATT_PENALTY);
  const userMidPenalty = -round2(effectivePenaltyScale * ADAPTATION_MAX_MID_PENALTY);
  const userDefPenalty = -round2(effectivePenaltyScale * ADAPTATION_MAX_DEF_PENALTY);
  const aiXgBonus = round2(effectivePenaltyScale * ADAPTATION_MAX_AI_XG_BONUS);
  const userXgPenalty = round2(effectivePenaltyScale * ADAPTATION_MAX_USER_XG_PENALTY);
  const aiOppXgPenalty = round2(effectivePenaltyScale * ADAPTATION_MAX_AI_OPP_XG_PENALTY);
  const possessionPenalty = round2(effectivePenaltyScale * ADAPTATION_MAX_POSSESSION_PENALTY);
  const matchupOvrPenalty = round2(effectivePenaltyScale * ADAPTATION_MAX_MATCHUP_OVR_PENALTY);

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
    counterTiming,
    counterMinute,
    userAttPenalty,
    userMidPenalty,
    userDefPenalty,
    aiXgBonus,
    userXgPenalty,
    aiOppXgPenalty,
    possessionPenalty,
    matchupOvrPenalty,
  };
}

/**
 * Records a completed user match into the rolling tactical adaptation history and checks whether
 * a non-spam `'danger'` (`파훼 경계`) scouting popup should be queued.
 *
 * Popup & Anti-Spam Rules (v9.1):
 * - `'warning'` (`45..71`) NEVER triggers a modal popup (shown subtly on tactics room badge only).
 * - `'danger'` (`>= 72`, ~8 consecutive identical matches) triggers ONE scouting popup on entry.
 * - While staying in `'danger'`, the popup never re-fires.
 * - Once tactical variation drops exposure out of `'danger'`, the guard re-arms so a later
 *   re-entry into `'danger'` will notify cleanly once again.
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
  ].slice(-ADAPTATION_STREAK_HISTORY_LIMIT);

  // Project exposure if user keeps the same formation & tactic into the next match
  const projected = evaluateTacticalExposure({
    history: nextHistory,
    formation: params.formation,
    tactic: params.tactic,
    staffCoachId: params.staffCoachId,
  });

  let nextHighest = base.highestAlertedTier;
  let pendingAlert: TacticalAdaptationAlert | null = base.pendingAlert;

  if (projected.tier === 'danger') {
    if (base.highestAlertedTier !== 'danger') {
      const streak = Math.max(1, projected.consecutiveExactStreak);
      nextHighest = 'danger';
      pendingAlert = {
        id: `adapt-${params.competition}-r${params.round}-danger`,
        tier: 'danger',
        exposureScore: projected.exposureScore,
        repeatedFormation: params.formation,
        repeatedTactic: params.tactic,
        consecutiveCount: streak,
        triggeredAtRound: params.round,
        headline: '상대 감독들이 우리 전술 패턴을 완벽히 읽어냈습니다',
        detail: `최근 ${streak}경기 연속 동일 패턴이 노출되어(노출도 ${projected.exposureScore}/100), 다음 경기부터 명장 AI 감독이 프리뷰와 다른 전반 카운터 전술과 정밀 파훼 대응을 가동할 가능성이 높습니다.`,
      };
    }
  } else {
    // Dropped out of 'danger' via tactical variation -> re-arm for any future 'danger' re-entry
    nextHighest = 'low';
  }

  return {
    history: nextHistory,
    highestAlertedTier: nextHighest,
    pendingAlert,
  };
}
