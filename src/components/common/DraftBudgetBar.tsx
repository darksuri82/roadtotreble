import { AlertTriangle, Coins, ShieldAlert, ShieldCheck } from 'lucide-react';
import {
  computePlayerDraftCostM,
  DRAFT_BUDGET_CAP_M,
  evaluateSquadBudget,
  FFP_TIER1_CHEM_PENALTY,
  FFP_TIER1_LOSS_MORALE_EXTRA,
  FFP_TIER1_MAX_EXCESS_RATIO,
  FFP_TIER1_MAX_OVERRUN_PCT,
  FFP_TIER1_SCORE_PENALTY_PCT,
  FFP_TIER1_WINDOW1_MAX_ATTEMPTS,
  FFP_TIER2_CHEM_PENALTY,
  FFP_TIER2_LOSS_MORALE_EXTRA,
  FFP_TIER2_SCORE_PENALTY_PCT,
  FFP_TIER2_WINDOW2_MAX_ATTEMPTS,
  FFP_UCL_SPECIAL_MAX_ATTEMPTS,
  LEGEND_FLAT_DRAFT_COST_M,
} from '../../engine/budgetEngine';
import type { Player } from '../../types/player';
import { InfoHelpButton } from './InfoHelpButton';

interface DraftBudgetBarProps {
  /** Currently drafted squad players (starters + bench, nulls ignored) */
  players: readonly (Player | null | undefined)[];
  /** Optional candidate currently hovered/selected to preview delta */
  previewPlayer?: Player | null;
  compact?: boolean;
}

export function DraftBudgetBar({
  players,
  previewPlayer = null,
  compact = false,
}: DraftBudgetBarProps) {
  const summary = evaluateSquadBudget(players);
  const projected = evaluateSquadBudget(players, { previewPlayer });
  const previewCost = previewPlayer
    ? computePlayerDraftCostM(previewPlayer)
    : 0;
  const hasPreview = previewCost > 0;

  const tier1LimitM = summary.capM; // €950M (100%)
  const tier2LimitM = Math.floor(
    summary.capM * (1 + FFP_TIER1_MAX_EXCESS_RATIO),
  ); // €1,092M (+15%)
  const trackMaxM = Math.round(summary.capM * 1.28); // Visual track max (~€1,216M)

  const baseFillPct = Math.min(100, (summary.spentM / trackMaxM) * 100);
  const projectedFillPct = Math.min(100, (projected.spentM / trackMaxM) * 100);
  const previewSegPct = Math.max(0, projectedFillPct - baseFillPct);
  const capMarkerPct = (tier1LimitM / trackMaxM) * 100;
  const tier2MarkerPct = (tier2LimitM / trackMaxM) * 100;

  // Remaining amounts to Tier 1 (budget cap) and Tier 2 (+15%) based on live projected total
  const activeSpentM = hasPreview ? projected.spentM : summary.spentM;
  const activeTier = hasPreview ? projected.ffpTier : summary.ffpTier;
  const toTier1M = tier1LimitM - activeSpentM; // >0 remaining, <0 exceeded
  const toTier2M = tier2LimitM - activeSpentM; // >0 remaining, <0 exceeded

  const isOverCap = activeTier >= 1;
  const isTier2 = activeTier === 2;

  const containerStyle = isTier2
    ? 'border-rose-500/75 bg-gradient-to-r from-[#240d14] via-[#170d14] to-[#120d16] shadow-[0_0_24px_-6px_rgba(244,63,94,0.55)]'
    : isOverCap
      ? 'border-rose-500/55 bg-gradient-to-r from-[#211116] via-[#17131a] to-[#111520] shadow-[0_0_18px_-6px_rgba(244,63,94,0.4)]'
      : hasPreview
        ? 'border-sky-400/55 bg-gradient-to-r from-[#0e1b29] via-[#0e1622] to-[#0d1520] shadow-[0_0_18px_-6px_rgba(56,189,248,0.35)]'
        : 'border-emerald-500/35 bg-gradient-to-r from-[#0c1a1c] via-[#0e1520] to-[#0d131d] shadow-[0_0_16px_-8px_rgba(16,185,129,0.35)]';

  const baseBarClass =
    summary.ffpTier === 2
      ? 'bg-gradient-to-r from-rose-600 via-red-500 to-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.7)]'
      : summary.ffpTier === 1
        ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 shadow-[0_0_10px_rgba(249,115,22,0.55)]'
        : 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.5)]';

  const previewSegClass =
    projected.ffpTier >= 1
      ? 'bg-gradient-to-r from-rose-500 to-red-400 animate-pulse shadow-[0_0_12px_rgba(244,63,94,0.85)]'
      : 'bg-gradient-to-r from-sky-400 to-cyan-300 animate-pulse shadow-[0_0_10px_rgba(56,189,248,0.75)]';

  const tierTone =
    activeTier === 2
      ? {
          badge: 'bg-rose-500/20 text-rose-200 border-rose-400/60',
          label: `FFP 2단계 초과 (+${projected.excessPct}%)`,
          icon: <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />,
        }
      : activeTier === 1
        ? {
            badge: 'bg-rose-500/18 text-rose-200 border-rose-400/50',
            label: `FFP 1단계 초과 (+${projected.excessPct}%)`,
            icon: <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />,
          }
        : {
            badge: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/40',
            label: '예산 준수',
            icon: <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />,
          };

  return (
    <div
      className={`rounded-xl sm:rounded-2xl border-2 transition-all duration-200 ${containerStyle} ${
        compact ? 'px-3 py-2.5 sm:px-4 sm:py-3' : 'px-4 py-3'
      }`}
    >
      {/* Top Row: Spent / Cap + Live Preview + Status Badge */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          {tierTone.icon}
          <span className="text-xs font-extrabold tracking-tight text-slate-100 whitespace-nowrap">
            드래프트 예산
          </span>
          <span
            className={`text-sm sm:text-base font-black tabular-nums whitespace-nowrap ${
              isOverCap ? 'text-rose-300' : 'text-white'
            }`}
          >
            €{summary.spentM}M
            <span className="text-slate-400 font-bold text-xs sm:text-sm">
              {' '}/ €{summary.capM}M
            </span>
          </span>

          {hasPreview && previewPlayer && (
            <span
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-black tabular-nums whitespace-nowrap ${
                projected.ffpTier >= 1
                  ? 'border-rose-400/65 bg-rose-500/25 text-rose-200'
                  : 'border-sky-400/55 bg-sky-500/20 text-sky-200'
              }`}
            >
              프리뷰 {previewPlayer.name} +€{previewCost}M → €{projected.spentM}M
              {projected.ffpTier >= 1 ? ' (초과!)' : ''}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {projected.remainingM > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-extrabold text-emerald-200 tabular-nums whitespace-nowrap">
              <Coins className="w-3.5 h-3.5 shrink-0 text-emerald-300" />
              이월 예정 €{projected.remainingM}M
            </span>
          ) : (
            <span
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-black whitespace-nowrap ${tierTone.badge}`}
            >
              {tierTone.label}
            </span>
          )}
          <InfoHelpButton
            title="드래프트 예산 & FFP 소프트 캡"
            align="right"
            guideTab="budget"
            items={[
              `16인 총 예산 상한은 €${DRAFT_BUDGET_CAP_M}M입니다. 남은 예산은 시즌 이적시장 현금 협상 자금으로 100% 이월됩니다.`,
              `시대별 클래식은 전원 €${LEGEND_FLAT_DRAFT_COST_M}M 통일 균일가(슈퍼스타 하위권 수준)이며, 다수 수집 시 FFP 압박이 커집니다.`,
              `1단계 초과 (+1%~+${FFP_TIER1_MAX_OVERRUN_PCT}%): 이월 €0 · 정규 1·2·3차 각 ${FFP_TIER1_WINDOW1_MAX_ATTEMPTS}회(UCL ${FFP_UCL_SPECIAL_MAX_ATTEMPTS}회) · 팀 케미 -${FFP_TIER1_CHEM_PENALTY} · 패배 사기 -${FFP_TIER1_LOSS_MORALE_EXTRA} 추가 · 점수 -${FFP_TIER1_SCORE_PENALTY_PCT}%.`,
              `2단계 초과 (+${FFP_TIER1_MAX_OVERRUN_PCT}% 초과): 이월 €0 · 1·3차 동결/2차 ${FFP_TIER2_WINDOW2_MAX_ATTEMPTS}회(UCL ${FFP_UCL_SPECIAL_MAX_ATTEMPTS}회) · 팀 케미 -${FFP_TIER2_CHEM_PENALTY} · 패배 사기 -${FFP_TIER2_LOSS_MORALE_EXTRA} 추가 · 점수 -${FFP_TIER2_SCORE_PENALTY_PCT}%.`,
            ]}
          />
        </div>
      </div>

      {/* High-Visibility Progress Slider with Live Preview Extension & Tier 1 / Tier 2 Threshold Markers */}
      <div className="relative mt-2.5">
        <div className="relative h-3.5 sm:h-4 w-full rounded-full bg-slate-900/95 border border-slate-700/80 overflow-hidden shadow-inner">
          {/* Confirmed Spent Bar */}
          <div
            className={`absolute inset-y-0 left-0 transition-all duration-300 ${baseBarClass}`}
            style={{ width: `${baseFillPct}%` }}
          />
          {/* Live Preview Candidate Extension Bar */}
          {previewSegPct > 0 && (
            <div
              className={`absolute inset-y-0 transition-all duration-200 ${previewSegClass}`}
              style={{
                left: `${baseFillPct}%`,
                width: `${previewSegPct}%`,
              }}
            />
          )}
          {/* 100% Cap Marker (Tier 1 Boundary) */}
          <div
            className="absolute inset-y-0 w-0.5 bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.9)] z-10"
            style={{ left: `${capMarkerPct}%` }}
            title={`1차 경계 (예산 한도 €${tier1LimitM}M)`}
          />
          {/* 115% Marker (Tier 2 Boundary) */}
          <div
            className="absolute inset-y-0 w-0.5 bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.9)] z-10"
            style={{ left: `${tier2MarkerPct}%` }}
            title={`2차 경계 (FFP 2단계 기준 €${tier2LimitM}M)`}
          />
        </div>

        {/* Explicit Remaining Amounts to 1st & 2nd Boundaries */}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] tabular-nums">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-bold whitespace-nowrap ${
                toTier1M >= 0
                  ? 'bg-amber-500/12 text-amber-200 border border-amber-400/30'
                  : 'bg-rose-500/20 text-rose-200 border border-rose-400/45'
              }`}
            >
              1차 경계(€{tier1LimitM}M):{' '}
              {toTier1M >= 0 ? `€${toTier1M}M 남음` : `+€${Math.abs(toTier1M)}M 초과`}
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-bold whitespace-nowrap ${
                toTier2M >= 0
                  ? 'bg-slate-800/90 text-slate-200 border border-slate-600/60'
                  : 'bg-rose-600/25 text-rose-200 border border-rose-400/60'
              }`}
            >
              2차 경계(€{tier2LimitM}M):{' '}
              {toTier2M >= 0 ? `€${toTier2M}M 남음` : `+€${Math.abs(toTier2M)}M 초과`}
            </span>
          </div>

          {activeTier > 0 && (
            <span className="text-[11px] font-bold text-rose-300 break-keep">
              {activeTier === 1
                ? `FFP 1단계: 1·2·3차 각 ${FFP_TIER1_WINDOW1_MAX_ATTEMPTS}회(UCL ${FFP_UCL_SPECIAL_MAX_ATTEMPTS}회) · 케미 -${FFP_TIER1_CHEM_PENALTY} · 사기 -${FFP_TIER1_LOSS_MORALE_EXTRA} · 점수 -${FFP_TIER1_SCORE_PENALTY_PCT}%`
                : `FFP 2단계: 1·3차 동결/2차 ${FFP_TIER2_WINDOW2_MAX_ATTEMPTS}회(UCL ${FFP_UCL_SPECIAL_MAX_ATTEMPTS}회) · 케미 -${FFP_TIER2_CHEM_PENALTY} · 사기 -${FFP_TIER2_LOSS_MORALE_EXTRA} · 점수 -${FFP_TIER2_SCORE_PENALTY_PCT}%`}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
