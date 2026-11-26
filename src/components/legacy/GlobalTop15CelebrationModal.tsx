import { Crown, Globe, Sparkles, Trophy, X } from 'lucide-react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import type { GlobalTop15CelebrationPayload } from '../../types/legacy';

interface GlobalTop15CelebrationModalProps {
  payload: GlobalTop15CelebrationPayload;
  onViewRankings: () => void;
  onClose: () => void;
}

function getRankStyle(rank: number): {
  badgeClass: string;
  ringClass: string;
  label: string;
} {
  if (rank === 1) {
    return {
      badgeClass:
        'bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-500 text-slate-950 shadow-lg shadow-amber-500/25',
      ringClass: 'border-amber-400/50',
      label: '오늘의 일일 랭킹 1위',
    };
  }
  if (rank === 2) {
    return {
      badgeClass:
        'bg-gradient-to-br from-slate-200 via-slate-300 to-slate-400 text-slate-950 shadow-lg shadow-slate-400/20',
      ringClass: 'border-slate-300/45',
      label: '오늘의 일일 랭킹 2위',
    };
  }
  if (rank === 3) {
    return {
      badgeClass:
        'bg-gradient-to-br from-amber-600 via-orange-400 to-amber-700 text-slate-950 shadow-lg shadow-orange-500/20',
      ringClass: 'border-amber-500/45',
      label: '오늘의 일일 랭킹 3위',
    };
  }
  return {
    badgeClass:
      'bg-gradient-to-br from-emerald-400 to-teal-500 text-slate-950 shadow-lg shadow-emerald-500/20',
    ringClass: 'border-emerald-400/45',
    label: `오늘의 일일 랭킹 TOP 10 진입`,
  };
}

export function GlobalTop15CelebrationModal({
  payload,
  onViewRankings,
  onClose,
}: GlobalTop15CelebrationModalProps) {
  useBodyScrollLock(true);
  const rankStyle = getRankStyle(payload.rank);

  return (
    <div
      className="modal-backdrop fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/85 p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="global-top15-celebration-title"
    >
      <div
        className={`modal-panel relative flex w-full max-w-md flex-col overflow-hidden rounded-2xl border ${rankStyle.ringClass} bg-[#0e141d] shadow-2xl`}
      >
        <div className="flex items-center justify-between border-b border-slate-800/90 bg-[#0a0f17] px-4 py-3">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-emerald-400 shrink-0" />
            <span className="text-xs font-extrabold tracking-wide text-emerald-300 uppercase">
              Daily Ranking · TOP 10 (KST)
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-800 bg-slate-900 p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
            aria-label="닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="modal-scroll flex-1 min-h-0 overflow-y-auto px-5 py-6 text-center space-y-5">
          {/* Rank Medallion */}
          <div className="flex flex-col items-center gap-2.5">
            <div
              className={`inline-flex h-20 w-20 items-center justify-center rounded-2xl font-display text-3xl font-black tabular-nums ${rankStyle.badgeClass}`}
            >
              #{payload.rank}
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/35 bg-amber-500/12 px-3 py-1 text-[11px] font-black text-amber-300">
              <Sparkles className="h-3.5 w-3.5" />
              <span>{rankStyle.label}</span>
            </div>
          </div>

          <div className="space-y-1">
            <h2
              id="global-top15-celebration-title"
              className="text-xl sm:text-2xl font-black text-white break-keep"
            >
              오늘의 랭킹 #{payload.rank}위 등재!
            </h2>
            <p className="text-xs font-semibold text-slate-300">
              {payload.clubName} · {payload.managerName} 감독
            </p>
          </div>

          {/* Score Pill */}
          <div className="mx-auto flex items-center justify-center gap-3 rounded-xl border border-slate-800 bg-[#090e15] px-4 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-400 font-display text-base font-black text-slate-950">
              {payload.grade}
            </span>
            <div className="text-left">
              <div className="text-[10px] font-bold text-slate-400">
                공식 시즌 스코어
              </div>
              <div className="font-mono text-2xl font-black text-white tabular-nums leading-tight">
                {payload.totalScore.toLocaleString()}{' '}
                <span className="text-xs font-bold text-amber-300">PTS</span>
              </div>
            </div>
          </div>

          {/* Trophies & Treble Badges */}
          {(payload.isTreble || payload.trophies.length > 0) && (
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {payload.isTreble && (
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-400 px-2.5 py-1 text-[11px] font-black text-slate-950">
                  <Crown className="h-3 w-3" />
                  트레블 달성
                </span>
              )}
              {payload.trophies.map((tr) => (
                <span
                  key={tr}
                  className="inline-flex items-center gap-1 rounded-md border border-amber-400/35 bg-amber-500/12 px-2 py-0.5 text-[11px] font-bold text-amber-200"
                >
                  <Trophy className="h-3 w-3 text-amber-400" />
                  {tr}
                </span>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-1">
            <button
              id="global-top15-celebration-view-btn"
              type="button"
              onClick={onViewRankings}
              className="inline-flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-5 py-2.5 text-xs sm:text-sm font-black text-slate-950 hover:bg-emerald-400 cursor-pointer touch-manipulation"
            >
              <Globe className="h-4 w-4" />
              <span>일일 랭킹 보기</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex w-full sm:w-auto items-center justify-center rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs font-bold text-slate-300 hover:border-slate-500 hover:text-white cursor-pointer touch-manipulation"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
