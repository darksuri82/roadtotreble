import { useEffect } from 'react';
import { Sparkles, Trophy, X } from 'lucide-react';
import { HIDDEN_ACHIEVEMENTS_BY_ID } from '../../data/achievements';
import { useGame } from '../../store/GameContext';

export function AchievementToast() {
  const { recentUnlocks, dismissUnlockToast, setLegacyModalOpen } = useGame();

  useEffect(() => {
    if (recentUnlocks.length === 0) return;
    const latestId = recentUnlocks[0];
    const timer = window.setTimeout(() => {
      dismissUnlockToast(latestId);
    }, 6500);
    return () => window.clearTimeout(timer);
  }, [recentUnlocks, dismissUnlockToast]);

  if (recentUnlocks.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex max-w-sm flex-col gap-2">
      {recentUnlocks.slice(0, 3).map((id) => {
        const def = HIDDEN_ACHIEVEMENTS_BY_ID[id];
        if (!def) return null;

        return (
          <div
            key={id}
            className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-amber-400/50 bg-slate-950/95 p-3.5 shadow-2xl shadow-amber-900/30 backdrop-blur"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-yellow-600 text-slate-950 shadow-inner">
              <Trophy className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-amber-300">
                <Sparkles className="h-3.5 w-3.5" />
                히든 레거시 해금!
              </div>
              <div className="mt-0.5 text-sm font-black text-white">
                {def.title}
              </div>
              <p className="mt-0.5 text-[11px] leading-snug text-slate-300">
                {def.conditionText}
              </p>
              <button
                type="button"
                onClick={() => {
                  dismissUnlockToast(id);
                  setLegacyModalOpen(true);
                }}
                className="mt-1.5 text-[11px] font-bold text-amber-300 underline-offset-2 hover:underline"
              >
                레거시 도감에서 보기 →
              </button>
            </div>
            <button
              type="button"
              onClick={() => dismissUnlockToast(id)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              aria-label="닫기"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
