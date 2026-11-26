import type { FfpTier, SeasonBudgetState } from '../types/game';
import type { Player } from '../types/player';

/**
 * Draft Budget Soft Cap & 2-Tier FFP System (€M)
 *
 * Philosophy:
 * - Prevents 90+ superstar & multi-Legend spam from effortlessly breaking records while
 *   keeping the cap comfortable for 1 Legend + smart value/manager-fit core to stay cleanly
 *   under budget and carry over transfer cash.
 * - Era Classics use a unified flat price (`LEGEND_FLAT_DRAFT_COST_M = 130`, sitting between
 *   active OVR 90 `€122M` and OVR 91 `€138M` — Superstar lower tier).
 *   Drafting 1 Classic fits comfortably under cap; stacking 2~3+ Classics creates real FFP pressure.
 */
export const DRAFT_BUDGET_CAP_M = 950;
export const LEGEND_FLAT_DRAFT_COST_M = 130;
export const FFP_TIER1_MAX_EXCESS_RATIO = 0.15; // +1% .. +15%
export const FFP_TIER1_MAX_OVERRUN_PCT = Math.round(
  FFP_TIER1_MAX_EXCESS_RATIO * 100,
); // 15

/** FFP Tier 1 (Mild Overrun: +1% .. +15%) */
export const FFP_TIER1_CHEM_PENALTY = 8; // -8 team chemistry
export const FFP_TIER1_LOSS_MORALE_EXTRA = 1; // +1 extra morale drop on losses
export const FFP_TIER1_WINDOW1_MAX_ATTEMPTS = 1; // 3 -> 1 attempt in Window 1
export const FFP_TIER1_WINDOW2_MAX_ATTEMPTS = 1; // 3 -> 1 attempt in Window 2
export const FFP_TIER1_WINDOW3_MAX_ATTEMPTS = 1; // 3 -> 1 attempt in Window 3
export const FFP_TIER1_SCORE_MULTIPLIER = 0.94; // -6% HOF / Global TOP 15 score
export const FFP_TIER1_SCORE_PENALTY_PCT = 6;

/** FFP Tier 2 (Severe Overrun: > +15%) */
export const FFP_TIER2_CHEM_PENALTY = 14; // -14 team chemistry
export const FFP_TIER2_LOSS_MORALE_EXTRA = 2; // +2 extra morale drop on losses
export const FFP_TIER2_WINDOW1_MAX_ATTEMPTS = 0; // Window 1 signings frozen
export const FFP_TIER2_WINDOW2_MAX_ATTEMPTS = 1; // 3 -> 1 attempt in Window 2
export const FFP_TIER2_WINDOW3_MAX_ATTEMPTS = 0; // Window 3 signings frozen
export const FFP_TIER2_SCORE_MULTIPLIER = 0.88; // -12% HOF / Daily Ranking score
export const FFP_TIER2_SCORE_PENALTY_PCT = 12;

/** UCL Special Transfer Window (Window 4) is exempt from FFP attempt caps */
export const FFP_UCL_SPECIAL_MAX_ATTEMPTS = 3;

/** Transfer Cash-Sweetener conversion rates */
export const CASH_TO_TP_RATE = 1.25; // €1M -> +1.25 TP up to €100M
export const CASH_TO_TP_SOFT_CAP_M = 100;
export const CASH_TO_TP_OVER_CAP_RATE = 0.9; // €1M -> +0.90 TP above €100M
export const CASH_LEGEND_CHANCE_PER_10M = 1.5; // +1.5%p per €10M
export const CASH_LEGEND_CHANCE_MAX_BONUS = 15; // max +15%p
export const CASH_STAR_GUARD_RELIEF_THRESHOLD_M = 80; // relaxes OVR-7 guard by 1 when adding €80M+

export interface SquadBudgetEvaluation {
  capM: number;
  spentM: number;
  remainingM: number; // >= 0 (transfer cash carry-over when compliant)
  excessM: number; // >= 0
  excessPct: number; // 0..999 (rounded to 1 decimal)
  usagePct: number; // 0..999
  ffpTier: FfpTier;
  tierLabel: string;
  chemPenalty: number; // 0, -8, or -14
  window1MaxAttempts: number; // 3, 1, or 0
  window2MaxAttempts: number; // 3, 1, or 1
  window3MaxAttempts: number; // 3, 1, or 0
  scoreMultiplier: number; // 1.0, 0.94, or 0.88
  extraLossMoraleDrop: number; // 0, 1, or 2
  previewDeltaM?: number;
}

/**
 * Computes a player's non-linear progressive draft cost (€M).
 * - All Era Classics share a unified flat cost (`LEGEND_FLAT_DRAFT_COST_M = €130M`).
 * - Active players scale smoothly at 68..84 and steeply across Worldclass/Superstar 86..92.
 */
export function computePlayerDraftCostM(
  player: Pick<Player, 'ovr' | 'isLegend'>,
): number {
  if (player.isLegend) {
    return LEGEND_FLAT_DRAFT_COST_M;
  }
  const ovr = Math.max(60, Math.min(99, Math.round(player.ovr)));
  let raw: number;
  if (ovr <= 73) {
    raw = Math.max(4, 4 + Math.max(0, ovr - 68) * 1.0); // 68:4 .. 73:9
  } else if (ovr <= 78) {
    raw = 9 + (ovr - 73) * 2.2; // 74:11 .. 78:20
  } else if (ovr <= 82) {
    raw = 20 + (ovr - 78) * 3.75; // 79:24, 80:28, 81:31, 82:35
  } else if (ovr <= 85) {
    raw = 35 + (ovr - 82) * 7.33; // 83:42, 84:50, 85:57
  } else if (ovr <= 87) {
    raw = 57 + (ovr - 85) * 11.5; // 86:69, 87:80
  } else if (ovr <= 89) {
    raw = 80 + (ovr - 87) * 13.0; // 88:93, 89:106
  } else {
    raw = 106 + (ovr - 89) * 16.0; // 90:122, 91:138, 92:154, 93:170
  }
  return Math.max(4, Math.round(raw));
}

export function classifyFfpTier(
  spentM: number,
  capM = DRAFT_BUDGET_CAP_M,
): FfpTier {
  if (spentM <= capM) return 0;
  const excessRatio = (spentM - capM) / Math.max(1, capM);
  if (excessRatio <= FFP_TIER1_MAX_EXCESS_RATIO + 1e-9) return 1;
  return 2;
}

export function evaluateSquadBudget(
  squad: readonly (Player | null | undefined)[],
  options?: {
    capM?: number;
    previewPlayer?: Player | null;
  },
): SquadBudgetEvaluation {
  const capM = options?.capM ?? DRAFT_BUDGET_CAP_M;
  const previewPlayer = options?.previewPlayer ?? null;

  const baseSpentM = squad.reduce(
    (sum, p) => (p ? sum + computePlayerDraftCostM(p) : sum),
    0,
  );
  const previewDeltaM = previewPlayer
    ? computePlayerDraftCostM(previewPlayer)
    : 0;
  const spentM = baseSpentM + previewDeltaM;
  const remainingM = Math.max(0, capM - spentM);
  const excessM = Math.max(0, spentM - capM);
  const excessPct =
    excessM > 0 ? Math.round((excessM / Math.max(1, capM)) * 1000) / 10 : 0;
  const usagePct = Math.round((spentM / Math.max(1, capM)) * 1000) / 10;
  const ffpTier = classifyFfpTier(spentM, capM);

  const tierLabel =
    ffpTier === 0
      ? '예산 준수'
      : ffpTier === 1
        ? `1단계 주의 (+1~${FFP_TIER1_MAX_OVERRUN_PCT}%)`
        : `2단계 FFP 초과 (+${FFP_TIER1_MAX_OVERRUN_PCT}%↑)`;

  const chemPenalty =
    ffpTier === 2
      ? -FFP_TIER2_CHEM_PENALTY
      : ffpTier === 1
        ? -FFP_TIER1_CHEM_PENALTY
        : 0;

  const window1MaxAttempts =
    ffpTier === 2
      ? FFP_TIER2_WINDOW1_MAX_ATTEMPTS
      : ffpTier === 1
        ? FFP_TIER1_WINDOW1_MAX_ATTEMPTS
        : 3;

  const window2MaxAttempts =
    ffpTier === 2
      ? FFP_TIER2_WINDOW2_MAX_ATTEMPTS
      : ffpTier === 1
        ? FFP_TIER1_WINDOW2_MAX_ATTEMPTS
        : 3;

  const window3MaxAttempts =
    ffpTier === 2
      ? FFP_TIER2_WINDOW3_MAX_ATTEMPTS
      : ffpTier === 1
        ? FFP_TIER1_WINDOW3_MAX_ATTEMPTS
        : 3;

  const scoreMultiplier =
    ffpTier === 2
      ? FFP_TIER2_SCORE_MULTIPLIER
      : ffpTier === 1
        ? FFP_TIER1_SCORE_MULTIPLIER
        : 1.0;

  const extraLossMoraleDrop =
    ffpTier === 2
      ? FFP_TIER2_LOSS_MORALE_EXTRA
      : ffpTier === 1
        ? FFP_TIER1_LOSS_MORALE_EXTRA
        : 0;

  return {
    capM,
    spentM,
    remainingM,
    excessM,
    excessPct,
    usagePct,
    ffpTier,
    tierLabel,
    chemPenalty,
    window1MaxAttempts,
    window2MaxAttempts,
    window3MaxAttempts,
    scoreMultiplier,
    extraLossMoraleDrop,
    ...(previewPlayer ? { previewDeltaM } : {}),
  };
}

/**
 * Resolves the FFP-adjusted transfer attempt limit for Window 1, 2, or 3.
 * Window 4 (UCL Special) always returns `defaultAttempts` (3).
 * Falls back cleanly from `ffpTier` for older saves missing `window1MaxAttempts` / `window3MaxAttempts`.
 */
export function getFfpWindowMaxAttempts(
  budget: SeasonBudgetState | undefined | null,
  windowIndex: number,
  defaultAttempts = 3,
): number {
  if (!budget || budget.ffpTier === 0) return defaultAttempts;
  if (windowIndex === 1) {
    if (typeof budget.window1MaxAttempts === 'number') {
      return budget.window1MaxAttempts;
    }
    return budget.ffpTier === 2
      ? FFP_TIER2_WINDOW1_MAX_ATTEMPTS
      : FFP_TIER1_WINDOW1_MAX_ATTEMPTS;
  }
  if (windowIndex === 2) {
    if (typeof budget.window2MaxAttempts === 'number') {
      return budget.window2MaxAttempts;
    }
    return budget.ffpTier === 2
      ? FFP_TIER2_WINDOW2_MAX_ATTEMPTS
      : FFP_TIER1_WINDOW2_MAX_ATTEMPTS;
  }
  if (windowIndex === 3) {
    if (typeof budget.window3MaxAttempts === 'number') {
      return budget.window3MaxAttempts;
    }
    return budget.ffpTier === 2
      ? FFP_TIER2_WINDOW3_MAX_ATTEMPTS
      : FFP_TIER1_WINDOW3_MAX_ATTEMPTS;
  }
  return defaultAttempts;
}

/**
 * Resolves whether a given FFP tier imposes a transfer embargo (0 attempts) on `windowIndex`.
 * Tier 2 freezes Window 1 & Window 3; Window 2 allows 1 attempt and UCL Special allows 3 attempts.
 */
export function isFfpTierEmbargoWindow(
  ffpTier: FfpTier,
  windowIndex: number,
  isUclSpecial = false,
): boolean {
  if (isUclSpecial || ffpTier !== 2) return false;
  if (windowIndex === 1) return FFP_TIER2_WINDOW1_MAX_ATTEMPTS <= 0;
  if (windowIndex === 2) return FFP_TIER2_WINDOW2_MAX_ATTEMPTS <= 0;
  if (windowIndex === 3) return FFP_TIER2_WINDOW3_MAX_ATTEMPTS <= 0;
  return false;
}

/**
 * Resolves whether the given season budget imposes a transfer embargo (0 attempts) on `windowIndex`.
 */
export function isFfpEmbargoWindow(
  budget: SeasonBudgetState | undefined | null,
  windowIndex: number,
  options?: { isUclSpecial?: boolean },
): boolean {
  if (options?.isUclSpecial) return false;
  if (!budget || budget.ffpTier === 0) return false;
  return getFfpWindowMaxAttempts(budget, windowIndex, 3) <= 0;
}

/**
 * Locks a drafted 16-player squad's initial budget evaluation into a persistent SeasonBudgetState.
 */
export function createSeasonBudgetState(
  squad: (Player | null)[],
  capM = DRAFT_BUDGET_CAP_M,
): SeasonBudgetState {
  const ev = evaluateSquadBudget(squad, { capM });
  return {
    capM: ev.capM,
    initialSpentM: ev.spentM,
    excessM: ev.excessM,
    excessPct: ev.excessPct,
    ffpTier: ev.ffpTier,
    transferCashM: ev.remainingM,
    chemPenalty: ev.chemPenalty,
    window1MaxAttempts: ev.window1MaxAttempts,
    window2MaxAttempts: ev.window2MaxAttempts,
    window3MaxAttempts: ev.window3MaxAttempts,
    scoreMultiplier: ev.scoreMultiplier,
    extraLossMoraleDrop: ev.extraLossMoraleDrop,
  };
}

/** Safe fallback for legacy saves without `budgetState`. */
export function createDefaultSeasonBudgetState(): SeasonBudgetState {
  return {
    capM: DRAFT_BUDGET_CAP_M,
    initialSpentM: 0,
    excessM: 0,
    excessPct: 0,
    ffpTier: 0,
    transferCashM: 0,
    chemPenalty: 0,
    window1MaxAttempts: 3,
    window2MaxAttempts: 3,
    window3MaxAttempts: 3,
    scoreMultiplier: 1.0,
    extraLossMoraleDrop: 0,
  };
}

/**
 * Converts cash (€M) attached to a trade package into Trade Points (TP).
 * Exempt from multi-player consolidation tax so cash smoothly bridges valuation gaps.
 */
export function computeCashOfferTp(cashOfferM: number): number {
  const safeCash = Math.max(0, Math.round(cashOfferM));
  if (safeCash <= 0) return 0;
  const firstTier = Math.min(safeCash, CASH_TO_TP_SOFT_CAP_M);
  const overflow = Math.max(0, safeCash - CASH_TO_TP_SOFT_CAP_M);
  const raw = firstTier * CASH_TO_TP_RATE + overflow * CASH_TO_TP_OVER_CAP_RATE;
  return Math.round(raw * 10) / 10;
}

/**
 * Converts cash (€M) attached to a Legend FA negotiation into signing probability boost (%p).
 */
export function computeCashLegendChanceBonus(cashOfferM: number): number {
  const safeCash = Math.max(0, Math.round(cashOfferM));
  if (safeCash <= 0) return 0;
  const bonus = (safeCash / 10) * CASH_LEGEND_CHANCE_PER_10M;
  return Math.min(CASH_LEGEND_CHANCE_MAX_BONUS, Math.round(bonus));
}

export function deductTransferCash(
  budget: SeasonBudgetState | undefined | null,
  spentM: number,
): SeasonBudgetState | undefined {
  if (!budget) return undefined;
  const safeSpend = Math.max(0, Math.round(spentM));
  if (safeSpend <= 0) return budget;
  return {
    ...budget,
    transferCashM: Math.max(0, budget.transferCashM - safeSpend),
  };
}

/**
 * Single-source-of-truth concise badge label for dashboard & transfer market headers.
 */
export function formatFfpBadgeSummary(
  ffpTier: FfpTier,
  options?: {
    windowIndex?: number;
    isUclSpecial?: boolean;
    isEmbargo?: boolean;
  },
): string {
  if (ffpTier === 2) {
    if (options?.isEmbargo) {
      const winPrefix = options.windowIndex ? `${options.windowIndex}차 ` : '';
      return `FFP 2단계 · ${winPrefix}영입 동결 (케미 -${FFP_TIER2_CHEM_PENALTY} · 점수 -${FFP_TIER2_SCORE_PENALTY_PCT}%)`;
    }
    if (options?.isUclSpecial) {
      return `FFP 2단계 · UCL 특별 ${FFP_UCL_SPECIAL_MAX_ATTEMPTS}회 (케미 -${FFP_TIER2_CHEM_PENALTY} · 점수 -${FFP_TIER2_SCORE_PENALTY_PCT}%)`;
    }
    if (options?.windowIndex === 2) {
      return `FFP 2단계 · 2차 ${FFP_TIER2_WINDOW2_MAX_ATTEMPTS}회 제한 (케미 -${FFP_TIER2_CHEM_PENALTY} · 점수 -${FFP_TIER2_SCORE_PENALTY_PCT}%)`;
    }
    return `FFP 2단계 · 1·3차 동결/2차 ${FFP_TIER2_WINDOW2_MAX_ATTEMPTS}회 · 케미 -${FFP_TIER2_CHEM_PENALTY} · 점수 -${FFP_TIER2_SCORE_PENALTY_PCT}%`;
  }
  if (ffpTier === 1) {
    if (options?.isUclSpecial) {
      return `FFP 1단계 · UCL 특별 ${FFP_UCL_SPECIAL_MAX_ATTEMPTS}회 (케미 -${FFP_TIER1_CHEM_PENALTY} · 점수 -${FFP_TIER1_SCORE_PENALTY_PCT}%)`;
    }
    if (
      options?.windowIndex &&
      options.windowIndex >= 1 &&
      options.windowIndex <= 3
    ) {
      return `FFP 1단계 · ${options.windowIndex}차 ${FFP_TIER1_WINDOW1_MAX_ATTEMPTS}회 제한 (케미 -${FFP_TIER1_CHEM_PENALTY} · 점수 -${FFP_TIER1_SCORE_PENALTY_PCT}%)`;
    }
    return `FFP 1단계 · 1·2·3차 각 ${FFP_TIER1_WINDOW1_MAX_ATTEMPTS}회 · 케미 -${FFP_TIER1_CHEM_PENALTY} · 점수 -${FFP_TIER1_SCORE_PENALTY_PCT}%`;
  }
  return '예산 준수';
}

/**
 * Single-source-of-truth detailed `?` popover items for active FFP sanctions.
 */
export function buildFfpPenaltyHelpItems(budget: SeasonBudgetState): string[] {
  const spendLine = `초과 지출: €${budget.initialSpentM}M / 한도 €${budget.capM}M (+€${budget.excessM}M, +${budget.excessPct}%)`;
  if (budget.ffpTier === 2) {
    return [
      spendLine,
      `이월 현금 €0M · 팀 케미 상시 -${FFP_TIER2_CHEM_PENALTY} 적용`,
      `정규 이적시장: 1차 동결(${FFP_TIER2_WINDOW1_MAX_ATTEMPTS}회) · 2차 ${FFP_TIER2_WINDOW2_MAX_ATTEMPTS}회 · 3차 동결(${FFP_TIER2_WINDOW3_MAX_ATTEMPTS}회) · UCL 특별 ${FFP_UCL_SPECIAL_MAX_ATTEMPTS}회`,
      `경기 패배 시 선수단 사기 추가 하락 (-${FFP_TIER2_LOSS_MORALE_EXTRA}단계)`,
      `명예의 전당 · 일일 랭킹 최종 점수 -${FFP_TIER2_SCORE_PENALTY_PCT}% 감점`,
    ];
  }
  if (budget.ffpTier === 1) {
    return [
      spendLine,
      `이월 현금 €0M · 팀 케미 상시 -${FFP_TIER1_CHEM_PENALTY} 적용`,
      `정규 이적시장: 1·2·3차 각 ${FFP_TIER1_WINDOW1_MAX_ATTEMPTS}회 제한 · UCL 특별 ${FFP_UCL_SPECIAL_MAX_ATTEMPTS}회`,
      `경기 패배 시 선수단 사기 추가 하락 (-${FFP_TIER1_LOSS_MORALE_EXTRA}단계)`,
      `명예의 전당 · 일일 랭킹 최종 점수 -${FFP_TIER1_SCORE_PENALTY_PCT}% 감점`,
    ];
  }
  return [
    `예산 준수 · 잔여 이월 현금 €${budget.transferCashM}M`,
  ];
}

/**
 * Resolves whether a season-score FFP penalty came from Tier 1 or Tier 2,
 * supporting both explicit `ffpTier` and backward-compatible inference from `ffpPenaltyPct`.
 */
export function resolveFfpPenaltyTier(
  ffpPenaltyPct?: number,
  ffpTier?: FfpTier,
): 1 | 2 {
  if (ffpTier === 1) return 1;
  if (ffpTier === 2) return 2;
  if (
    typeof ffpPenaltyPct === 'number' &&
    ffpPenaltyPct > 0 &&
    ffpPenaltyPct <= FFP_TIER1_SCORE_PENALTY_PCT
  ) {
    return 1;
  }
  return 2;
}

/**
 * Single-source-of-truth label for FFP score deductions in Season Summary & Hall of Fame.
 */
export function formatFfpScorePenaltyLabel(
  ffpPenaltyPct?: number,
  ffpTier?: FfpTier,
): string {
  const tier = resolveFfpPenaltyTier(ffpPenaltyPct, ffpTier);
  const pct =
    typeof ffpPenaltyPct === 'number' && ffpPenaltyPct > 0
      ? ffpPenaltyPct
      : tier === 1
        ? FFP_TIER1_SCORE_PENALTY_PCT
        : FFP_TIER2_SCORE_PENALTY_PCT;
  return `FFP ${tier}단계 예산 초과 감점 (-${pct}%)`;
}
