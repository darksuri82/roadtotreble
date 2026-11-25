import { AlertTriangle, Coins, ShieldCheck, ShieldAlert } from 'lucide-react';
import {
  computePlayerDraftCostM,
  DRAFT_BUDGET_CAP_M,
  evaluateSquadBudget,
  FFP_TIER1_CHEM_PENALTY,
  FFP_TIER1_MAX_OVERRUN_PCT,
  FFP_TIER2_SCORE_PENALTY_PCT,
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
  const previewCost = previewPlayer
    ? computePlayerDraftCostM(previewPlayer)
    : 0;
  const projectedSpent = summary.spentM + previewCost;
  const projectedPct = Math.round((projectedSpent / summary.capM) * 100);
  const barFillPct = Math.min(100, Math.round((summary.spentM / (summary.capM * 1.25)) * 100));
  const capMarkerPct = Math.round((1 / 1.25) * 100); // 80% = 100% cap
  const tier2MarkerPct = Math.round((1.15 / 1.25) * 100); // 92% = 115% cap

  const tierTone =
    summary.ffpTier === 2
      ? {
          badge: 'bg-rose-500/15 text-rose-300 border-rose-500/35',
          bar: 'bg-gradient-to-r from-rose-600 to-rose-400',
          label: `FFP 2단계 (+${summary.overrunPct}%)`,
          icon: <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />,
        }
      : summary.ffpTier === 1
        ? {
            badge: 'bg-amber-500/15 text-amber-300 border-amber-500/35',
            bar: 'bg-gradient-to-r from-amber-500 to-amber-400',
            label: `FFP 1단계 (+${summary.overrunPct}%)`,
            icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />,
          }
        : {
            badge: 'bg-emerald-500/12 text-emerald-300 border-emerald-500/30',
            bar: 'bg-gradient-to-r from-emerald-600 to-emerald-400',
            label: '예산 준수',
            icon: <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />,
          };

  return (
    <div
      className={`rounded-xl border border-white/10 bg-[#0d131c]/95 ${
        compact ? 'px-3 py-2' : 'px-3.5 py-2.5'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {tierTone.icon}
          <span className="text-[11px] sm:text-xs font-bold text-slate-200 whitespace-nowrap">
            드래프트 예산
          </span>
          <span className="text-xs sm:text-sm font-black tabular-nums text-white whitespace-nowrap">
            €{summary.spentM}M
            <span className="text-slate-500 font-semibold">
              {' '}/ €{summary.capM}M
            </span>
          </span>
          {previewCost > 0 && (
            <span className="text-[11px] font-bold tabular-nums text-sky-300 whitespace-nowrap">
              (+€{previewCost}M → {projectedPct}%)
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {summary.remainingM > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-300 tabular-nums whitespace-nowrap">
              <Coins className="w-3 h-3 shrink-0" />
              이월 예정 €{summary.remainingM}M
            </span>
          ) : (
            <span
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-bold whitespace-nowrap ${tierTone.badge}`}
            >
              {tierTone.label}
            </span>
          )}
          <InfoHelpButton
            title="드래프트 예산 & FFP 소프트 캡"
            align="right"
            guideTab="transfer"
            items={[
              `16인 총 예산 상한은 €${DRAFT_BUDGET_CAP_M}M입니다. 남은 예산은 시즌 이적시장 현금 협상 자금으로 100% 이월됩니다.`,
              `레전드는 전원 €${LEGEND_FLAT_DRAFT_COST_M}M 균일가이며, 현역 90+ 슈퍼스타는 누진 몸값이 적용됩니다.`,
              `1단계 초과 (+1%~+${FFP_TIER1_MAX_OVERRUN_PCT}%): 이월 자금 €0, 2차 이적시장 영입 1회 제한, 팀 케미 -${FFP_TIER1_CHEM_PENALTY}.`,
              `2단계 초과 (+${FFP_TIER1_MAX_OVERRUN_PCT}% 초과): 1단계 페널티 + 2차 이적시장 선수 영입 동결, 패배 시 사기 하락 증가, 시즌 최종 점수 -${FFP_TIER2_SCORE_PENALTY_PCT}% 감점.`,
            ]}
          />
        </div>
      </div>

      {/* Progress Track with 100% Cap & 115% Tier-2 Markers */}
      <div className="relative mt-2 h-2 w-full rounded-full bg-slate-800/90 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${tierTone.bar}`}
          style={{ width: `${barFillPct}%` }}
        />
        <div
          className="absolute top-0 bottom-0 w-px bg-amber-300/80"
          style={{ left: `${capMarkerPct}%` }}
          title={`예산 한도 €${summary.capM}M`}
        />
        <div
          className="absolute top-0 bottom-0 w-px bg-rose-400/80"
          style={{ left: `${tier2MarkerPct}%` }}
          title={`FFP 2단계 기준 €${Math.round(summary.capM * 1.15)}M`}
        />
      </div>

      {summary.ffpTier > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] break-keep">
          {summary.ffpTier === 1 ? (
            <span className="text-amber-300/90">
              이월 €0 · 2차 이적시장 1회 제한 · 팀 케미 -{FFP_TIER1_CHEM_PENALTY}
            </span>
          ) : (
            <span className="text-rose-300/90">
              2차 이적시장 영입 동결 · 패배 사기 하락 증가 · 최종 랭킹 점수 -{FFP_TIER2_SCORE_PENALTY_PCT}%
            </span>
          )}
        </div>
      )}
    </div>
  );
}
