import { CheckCircle2, X } from 'lucide-react';
import { useEffect } from 'react';
import type { InjuryReturnNotification } from '../../types/condition';

interface InjuryReturnToastProps {
  toasts: InjuryReturnNotification[];
  onDismiss: (id?: string) => void;
}

/**
 * Top notification banner alerting the manager whenever a previously injured
 * starter fully recovers and is automatically restored to their starting XI slot.
 */
export function InjuryReturnToast({
  toasts,
  onDismiss,
}: InjuryReturnToastProps) {
  const latestId = toasts[0]?.id;

  useEffect(() => {
    if (!latestId) return;
    const timer = window.setTimeout(() => {
      onDismiss(latestId);
    }, 5200);
    return () => window.clearTimeout(timer);
  }, [latestId, onDismiss]);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed top-14 left-1/2 z-[75] flex w-full max-w-md -translate-x-1/2 flex-col gap-2 px-3">
      {toasts.slice(0, 3).map((item) => (
        <div
          key={item.id}
          role="status"
          aria-live="polite"
          className="pointer-events-auto flex items-center justify-between gap-2.5 rounded-xl border border-emerald-400/55 bg-[#0c1a16] px-3.5 py-2.5 shadow-2xl"
        >
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <p className="text-xs font-bold text-emerald-100 leading-snug">
              <span className="text-white font-extrabold">{item.playerName}</span>{' '}
              부상 완치 — 선발 라인업
              {item.slotLabel ? `(${item.slotLabel})` : ''}에 자동 복귀했습니다
            </p>
          </div>
          <button
            type="button"
            onClick={() => onDismiss(item.id)}
            aria-label="알림 닫기"
            className="rounded p-1 text-emerald-300/80 hover:bg-emerald-500/20 hover:text-white cursor-pointer shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
