import { memo } from 'react';
import { FORMATIONS } from '../../../data/formations';
import type { FormationId } from '../../../types/game';
import type { Player } from '../../../types/player';
import { getCardTier } from '../../../types/player';

interface MpMiniPitchProps {
  formation: FormationId;
  starters: (Player | null)[];
  bench: (Player | null)[];
  /** Player id to flash as the most recent pick */
  highlightId?: string | null;
  height?: number;
}

const TIER_CLS: Record<ReturnType<typeof getCardTier>, string> = {
  legend: 'border-amber-300 bg-amber-400/25 text-amber-100',
  superstar: 'border-cyan-300 bg-cyan-400/20 text-cyan-100',
  worldclass: 'border-sky-300/80 bg-sky-400/15 text-sky-100',
  key: 'border-emerald-400/60 bg-emerald-500/15 text-emerald-100',
  common: 'border-slate-500/70 bg-slate-700/50 text-slate-100',
};

function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  const last = parts[parts.length - 1] ?? name;
  return last.length > 4 ? last.slice(0, 4) : last;
}

/** Small read-only formation overview (who sits where) for draft progress and summaries. */
export const MpMiniPitch = memo(function MpMiniPitch({
  formation,
  starters,
  bench,
  highlightId = null,
  height = 132,
}: MpMiniPitchProps) {
  const cfg = FORMATIONS[formation] ?? FORMATIONS['4-3-3'];
  return (
    <div className="space-y-1">
      <div
        className="relative w-full overflow-hidden rounded-lg border border-emerald-900/50 bg-[#0c1a14]"
        style={{ height }}
      >
        <div className="absolute inset-x-0 top-1/2 h-px bg-emerald-800/40" />
        <div className="absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-800/40" />
        {cfg.slots.slice(0, 11).map((slot, idx) => {
          const p = starters[idx] ?? null;
          const hot = Boolean(p && p.id === highlightId);
          return (
            <div
              key={slot.index}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${slot.x}%`, top: `${Math.min(92, Math.max(9, slot.y))}%` }}
              title={p ? `${p.name} · ${p.ovr}` : slot.label}
            >
              {p ? (
                <div
                  className={`flex min-w-[26px] flex-col items-center rounded border px-0.5 leading-none ${
                    TIER_CLS[getCardTier(p)]
                  } ${hot ? 'ring-2 ring-amber-300' : ''}`}
                >
                  <span className="font-mono text-[9px] font-black tabular-nums">{p.ovr}</span>
                  <span className="max-w-[34px] truncate text-[7px] font-bold">
                    {shortName(p.name)}
                  </span>
                </div>
              ) : (
                <div className="flex h-[15px] min-w-[20px] items-center justify-center rounded border border-dashed border-emerald-800/60 px-0.5 text-[7px] font-bold text-emerald-700">
                  {slot.label}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex gap-0.5">
        {Array.from({ length: 5 }, (_, i) => {
          const p = bench[i] ?? null;
          const hot = Boolean(p && p.id === highlightId);
          return (
            <div
              key={i}
              title={p ? `${p.name} · ${p.ovr}` : '벤치'}
              className={`flex h-[15px] flex-1 items-center justify-center rounded border text-[8px] font-black tabular-nums ${
                p
                  ? `${TIER_CLS[getCardTier(p)]} ${hot ? 'ring-2 ring-amber-300' : ''}`
                  : 'border-dashed border-slate-800 text-slate-700'
              }`}
            >
              {p ? p.ovr : ''}
            </div>
          );
        })}
      </div>
    </div>
  );
});
