import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Coins,
  Sparkles,
  Star,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { useGame } from '../../store/GameContext';

export function StoryChecklistTracker() {
  const { state, storyChecklist } = useGame();
  const [expanded, setExpanded] = useState(true);

  if (!state.storyMode || !state.season || !storyChecklist) return null;

  const cashM = state.season.budgetState?.transferCashM ?? 0;

  return (
    <section
      id="story-checklist-tracker"
      className="rounded-xl border border-amber-500/35 bg-gradient-to-r from-[#141720] via-[#111622] to-[#131924] px-3 py-2 sm:px-4 sm:py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex items-center gap-1 rounded-md border border-amber-400/40 bg-amber-500/15 px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-amber-300 whitespace-nowrap shrink-0">
            <Sparkles className="h-2.5 w-2.5" />
            STORY {state.storyMode.seasonLabel}
          </span>
          <span className="truncate text-xs sm:text-[13px] font-extrabold text-white">
            《{state.storyMode.title}》
          </span>
          <span className="inline-flex items-center gap-0.5 shrink-0">
            {[1, 2, 3].map((starIdx) => {
              const item = storyChecklist.items[starIdx - 1];
              const achieved = item?.status === 'achieved';
              return (
                <Star
                  key={starIdx}
                  className={`h-3.5 w-3.5 ${
                    achieved
                      ? 'fill-amber-400 text-amber-300'
                      : 'text-slate-600'
                  }`}
                />
              );
            })}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10.5px] font-bold text-emerald-300 whitespace-nowrap">
            <Coins className="h-3 w-3 shrink-0" />
            €{cashM}M
          </span>
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="inline-flex items-center gap-1 rounded-md border border-slate-700/80 bg-slate-900/70 px-2 py-0.5 text-[10.5px] font-bold text-slate-300 hover:text-white cursor-pointer whitespace-nowrap"
          >
            미션 {storyChecklist.starsEarned}/3
            {expanded ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-1.5">
          {storyChecklist.items.map((item) => {
            const isOk = item.status === 'achieved';
            const isFail = item.status === 'failed';
            return (
              <div
                key={item.id}
                className={`flex items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] leading-snug ${
                  isOk
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'
                    : isFail
                      ? 'border-rose-500/35 bg-rose-500/10 text-rose-200/85'
                      : 'border-slate-800 bg-[#0b1019] text-slate-200'
                }`}
              >
                {isOk ? (
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                ) : isFail ? (
                  <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
                ) : (
                  <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400/75" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-bold truncate">
                    ★{item.starIndex} {item.shortLabel}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {item.progressText}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
