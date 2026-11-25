import { Coins, Minus, Plus, RotateCcw } from 'lucide-react';
import {
  computeCashLegendChanceBonus,
  computeCashOfferTp,
} from '../../engine/budgetEngine';

interface CashSweetenerControlProps {
  availableCashM: number;
  cashOfferM: number;
  onChange: (nextCashM: number) => void;
  mode?: 'trade' | 'legend';
  disabled?: boolean;
}

export function CashSweetenerControl({
  availableCashM,
  cashOfferM,
  onChange,
  mode = 'trade',
  disabled = false,
}: CashSweetenerControlProps) {
  const maxCash = Math.max(0, Math.floor(availableCashM));
  const safeVal = Math.max(0, Math.min(Math.round(cashOfferM), maxCash));

  if (maxCash <= 0) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#0b1018] px-3 py-2 text-[11px] text-slate-400">
        <span className="inline-flex items-center gap-1.5 font-semibold whitespace-nowrap">
          <Coins className="w-3.5 h-3.5 text-slate-500" />
          보유 이적 자금 €0M
        </span>
        <span className="text-[10px] text-slate-500 whitespace-nowrap">
          현금 얹기 불가
        </span>
      </div>
    );
  }

  const tpBonus = mode === 'trade' ? computeCashOfferTp(safeVal) : 0;
  const legendPctBonus =
    mode === 'legend' ? computeCashLegendChanceBonus(safeVal) : 0;

  const setClamped = (v: number) => {
    const next = Math.max(0, Math.min(maxCash, Math.round(v)));
    onChange(next);
  };

  return (
    <div className="rounded-xl border border-emerald-500/25 bg-[#0b121b] p-2.5 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Coins className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="text-[11px] font-bold text-slate-200 whitespace-nowrap">
            현금 얹기
          </span>
          <span className="text-[10.5px] font-semibold text-slate-400 tabular-nums whitespace-nowrap">
            (보유 €{maxCash}M)
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs font-black tabular-nums text-emerald-300 whitespace-nowrap">
            +€{safeVal}M
          </span>
          {safeVal > 0 && (
            <span className="rounded border border-emerald-500/35 bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-black tabular-nums text-emerald-200 whitespace-nowrap">
              {mode === 'trade'
                ? `+${tpBonus.toFixed(1)} TP`
                : `성공률 +${legendPctBonus}%p`}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={disabled || safeVal <= 0}
          onClick={() => setClamped(safeVal - 5)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 disabled:opacity-40 transition"
          aria-label="5M 감소"
        >
          <Minus className="w-3 h-3" />
        </button>

        <input
          type="range"
          min={0}
          max={maxCash}
          step={1}
          value={safeVal}
          disabled={disabled}
          onChange={(e) => setClamped(Number(e.target.value))}
          className="flex-1 h-1.5 accent-emerald-400 cursor-pointer disabled:opacity-40"
          aria-label="현금 추가 제안 금액"
        />

        <button
          type="button"
          disabled={disabled || safeVal >= maxCash}
          onClick={() => setClamped(safeVal + 5)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 disabled:opacity-40 transition"
          aria-label="5M 증가"
        >
          <Plus className="w-3 h-3" />
        </button>

        {safeVal > 0 && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => setClamped(0)}
            className="flex h-7 px-2 shrink-0 items-center justify-center gap-1 rounded-md border border-white/10 bg-white/5 text-[10px] font-bold text-slate-300 hover:bg-white/10 disabled:opacity-40 transition whitespace-nowrap"
            title="현금 초기화"
          >
            <RotateCcw className="w-2.5 h-2.5" />
            초기화
          </button>
        )}
      </div>

      <div className="text-[10px] text-slate-400 break-keep">
        성사 시에만 차감 · 거절 시 보유 자금 유지
      </div>
    </div>
  );
}
