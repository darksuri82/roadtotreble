import { ArrowLeftRight, Eye, EyeOff, RotateCcw } from 'lucide-react';
import type { TradeSwapPreviewResult } from '../../engine/chemistryEngine';
import { formatPlayerRecordName } from '../../types/player';

interface TradeSwapPreviewCardProps {
  preview: TradeSwapPreviewResult;
  showOnPitch: boolean;
  onToggleShowOnPitch: () => void;
  onResetPreview: () => void;
}

function formatSigned(v: number, decimals = 0): string {
  const fixed = decimals > 0 ? v.toFixed(decimals) : String(Math.round(v));
  if (v > 0) return `+${fixed}`;
  if (v < 0) return fixed;
  return decimals > 0 ? `0.${'0'.repeat(decimals)}` : '0';
}

function deltaTone(v: number): string {
  if (v > 0) return 'text-emerald-300';
  if (v < 0) return 'text-rose-300';
  return 'text-slate-400';
}

export function TradeSwapPreviewCard({
  preview,
  showOnPitch,
  onToggleShowOnPitch,
  onResetPreview,
}: TradeSwapPreviewCardProps) {
  if (!preview.isActive) return null;

  const hasCashChange =
    typeof preview.cashBeforeM === 'number' &&
    typeof preview.cashAfterM === 'number' &&
    typeof preview.cashDeltaM === 'number' &&
    preview.cashDeltaM < 0;

  return (
    <div
      data-testid="trade-swap-preview-card"
      className="rounded-xl border border-emerald-500/40 bg-[#0a131f] px-3 py-2.5 space-y-2 break-keep"
    >
      {/* Top Row: Title + Quick Pitch Toggle & Revert */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-400/45 bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-black text-emerald-200 whitespace-nowrap">
            <ArrowLeftRight className="h-3 w-3 shrink-0" />
            가상 교체 프리뷰
          </span>
          <span className="text-[10.5px] font-bold text-slate-300 whitespace-nowrap tabular-nums">
            연결선 {preview.totalLinesBefore}→{preview.totalLinesAfter}선 (
            <strong className={deltaTone(preview.totalLinesDelta)}>
              {formatSigned(preview.totalLinesDelta)}
            </strong>
            )
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onToggleShowOnPitch}
            className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold transition cursor-pointer whitespace-nowrap touch-manipulation ${
              showOnPitch
                ? 'border-emerald-400/45 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25'
                : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 hover:text-white'
            }`}
          >
            {showOnPitch ? (
              <>
                <Eye className="h-3 w-3 shrink-0" />
                피치 프리뷰 ON
              </>
            ) : (
              <>
                <EyeOff className="h-3 w-3 shrink-0" />
                원본 스쿼드 보기
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onResetPreview}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-bold text-slate-300 hover:border-rose-400/50 hover:text-rose-200 transition cursor-pointer whitespace-nowrap touch-manipulation"
          >
            <RotateCcw className="h-3 w-3 shrink-0" />
            원복
          </button>
        </div>
      </div>

      {/* Key Team Metric Deltas (Before -> After) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 text-[10.5px] tabular-nums">
        <div className="rounded-lg border border-slate-800 bg-[#0d1624] px-2 py-1.5">
          <div className="text-[9.5px] text-slate-400 whitespace-nowrap">팀 케미</div>
          <div className="mt-0.5 font-mono font-bold text-white whitespace-nowrap">
            {preview.beforeChemistry.total}→{preview.afterChemistry.total}{' '}
            <span className={deltaTone(preview.chemDelta)}>
              ({formatSigned(preview.chemDelta)})
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-[#0d1624] px-2 py-1.5">
          <div className="text-[9.5px] text-slate-400 whitespace-nowrap">감독 궁합</div>
          <div className="mt-0.5 font-mono font-bold text-white whitespace-nowrap">
            {preview.managerFitBefore}→{preview.managerFitAfter}
            {preview.managerFitTarget > 0 ? `/${preview.managerFitTarget}` : ''}{' '}
            <span className={deltaTone(preview.managerFitDelta)}>
              ({formatSigned(preview.managerFitDelta)})
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-[#0d1624] px-2 py-1.5">
          <div className="text-[9.5px] text-slate-400 whitespace-nowrap">실효 OVR</div>
          <div className="mt-0.5 font-mono font-bold text-white whitespace-nowrap">
            {preview.beforeEffectiveAvgOvr.toFixed(1)}→
            {preview.afterEffectiveAvgOvr.toFixed(1)}{' '}
            <span className={deltaTone(preview.ovrDelta)}>
              ({formatSigned(preview.ovrDelta, 1)})
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-[#0d1624] px-2 py-1.5">
          <div className="text-[9.5px] text-slate-400 whitespace-nowrap">ATT</div>
          <div className="mt-0.5 font-mono font-bold text-white whitespace-nowrap">
            {preview.beforeRatings.effectiveAtt.toFixed(1)}→
            {preview.afterRatings.effectiveAtt.toFixed(1)}{' '}
            <span className={deltaTone(preview.attDelta)}>
              ({formatSigned(preview.attDelta, 1)})
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-[#0d1624] px-2 py-1.5">
          <div className="text-[9.5px] text-slate-400 whitespace-nowrap">MID</div>
          <div className="mt-0.5 font-mono font-bold text-white whitespace-nowrap">
            {preview.beforeRatings.effectiveMid.toFixed(1)}→
            {preview.afterRatings.effectiveMid.toFixed(1)}{' '}
            <span className={deltaTone(preview.midDelta)}>
              ({formatSigned(preview.midDelta, 1)})
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-[#0d1624] px-2 py-1.5">
          <div className="text-[9.5px] text-slate-400 whitespace-nowrap">DEF</div>
          <div className="mt-0.5 font-mono font-bold text-white whitespace-nowrap">
            {preview.beforeRatings.effectiveDef.toFixed(1)}→
            {preview.afterRatings.effectiveDef.toFixed(1)}{' '}
            <span className={deltaTone(preview.defDelta)}>
              ({formatSigned(preview.defDelta, 1)})
            </span>
          </div>
        </div>
      </div>

      {/* Per-Swapped-Slot Detail Row: Position Fit, Neighbor Lines, Manager Fit, Cash */}
      <div className="flex flex-wrap items-center gap-1.5 text-[10px] tabular-nums">
        {preview.swapPairs.map((pair) => {
          const fit = pair.inPositionFit;
          const fitCls = !fit
            ? 'border-slate-700 bg-slate-900 text-slate-300'
            : fit.penalty === 0
              ? 'border-emerald-500/40 bg-emerald-500/12 text-emerald-200'
              : fit.penalty >= -3
                ? 'border-amber-400/40 bg-amber-500/12 text-amber-200'
                : 'border-rose-500/45 bg-rose-500/15 text-rose-200';
          const fitLabel = !fit
            ? '벤치'
            : fit.penalty === 0
              ? '주포지션'
              : `${fit.label} ${fit.penalty}`;

          const inLines = pair.inSlotSynergy?.lineCount ?? 0;
          const outLines = pair.outSlotSynergy?.lineCount ?? 0;
          const inBonus = pair.inSlotSynergy?.neighborBonus ?? 0;

          return (
            <div
              key={pair.slotKey}
              className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-800/90 bg-slate-950/75 px-2 py-1"
            >
              <span className="rounded bg-slate-800 px-1 py-px text-[9px] font-bold text-sky-300 whitespace-nowrap">
                {pair.slotLabel}
              </span>
              <span className="font-bold text-rose-300/90 line-through whitespace-nowrap">
                {formatPlayerRecordName(pair.outPlayer)}
              </span>
              <span className="text-slate-500">→</span>
              <span className="font-extrabold text-emerald-200 whitespace-nowrap">
                {formatPlayerRecordName(pair.inPlayer)} ({pair.inPlayer.ovr})
              </span>
              <span
                className={`rounded border px-1 py-px text-[9px] font-bold whitespace-nowrap ${fitCls}`}
              >
                {fitLabel}
              </span>
              {pair.area === 'starter' && (
                <span className="font-mono text-[9.5px] text-slate-300 whitespace-nowrap">
                  인접 {outLines}→{inLines}선
                  {inBonus > 0 ? ` (+${inBonus})` : ''}
                </span>
              )}
              <span
                className={`rounded border px-1 py-px text-[9px] font-bold whitespace-nowrap ${
                  pair.inManagerMatch
                    ? 'border-amber-400/45 bg-amber-500/15 text-amber-200'
                    : 'border-slate-700/80 bg-slate-900 text-slate-400'
                }`}
              >
                {pair.inManagerMatch ? '★ 감독 궁합' : '감독 미일치'}
              </span>
            </div>
          );
        })}

        {hasCashChange && (
          <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/35 bg-emerald-950/35 px-2 py-1 font-mono text-[10px] font-bold text-emerald-200 whitespace-nowrap">
            잔액 €{preview.cashBeforeM}M → €{preview.cashAfterM}M (
            <span className="text-amber-300">€{preview.cashDeltaM}M</span>)
          </span>
        )}
      </div>
    </div>
  );
}
