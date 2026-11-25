import { ArrowRight, Flame, X } from 'lucide-react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import type { AwakeningAlertItem } from '../../types/game';

interface AwakeningCelebrationModalProps {
  alert: AwakeningAlertItem;
  onDismiss: () => void;
}

const COMP_LABELS = {
  league: '리그',
  cup: '자국 컵',
  ucl: 'UCL',
} as const;

export function AwakeningCelebrationModal({
  alert,
  onDismiss,
}: AwakeningCelebrationModalProps) {
  useBodyScrollLock(true);

  return (
    <div className="modal-backdrop z-[74]">
      <div className="modal-panel w-full max-w-md rounded-2xl border border-rose-500/50 bg-[#0e0c11] shadow-[0_0_40px_-10px_rgba(220,38,38,0.55)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-rose-500/20 bg-gradient-to-r from-[#241014] via-[#150e14] to-[#1e100d] px-4 py-3.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-rose-500/45 bg-rose-500/15 text-rose-400">
              <Flame className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="rounded border border-rose-500/40 bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-black text-rose-300 whitespace-nowrap">
                  포텐 폭발 · 영구 각성
                </span>
                <span className="text-[11px] font-semibold text-rose-200/70 whitespace-nowrap">
                  {COMP_LABELS[alert.competition]} {alert.round}R
                </span>
              </div>
              <h3 className="text-base font-black text-white truncate mt-0.5">
                {alert.playerName}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white transition"
            aria-label="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="modal-scroll p-4 space-y-4">
          {/* OVR Jump Showcase */}
          <div className="card-awakened-ember rounded-xl p-4 flex items-center justify-between gap-3">
            <div>
              <span className="inline-flex rounded border border-rose-400/35 bg-rose-950/60 px-2 py-0.5 text-[10px] font-black text-rose-200 whitespace-nowrap">
                {alert.position}
              </span>
              <div className="text-xs font-semibold text-rose-100/80 mt-1.5 break-keep">
                시즌 종료·명예의 전당까지 영구 유지
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xl font-black tabular-nums text-slate-400">
                {alert.originalOvr}
              </span>
              <ArrowRight className="w-4 h-4 text-rose-400" />
              <span className="text-3xl font-black tabular-nums text-white">
                {alert.newOvr}
              </span>
              <span className="rounded-md bg-rose-500/25 border border-rose-400/45 px-1.5 py-0.5 text-xs font-black tabular-nums text-rose-200 whitespace-nowrap">
                +{alert.ovrGain}
              </span>
            </div>
          </div>

          {/* Core Stat Deltas */}
          {alert.statDeltas.length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] font-bold text-slate-400">
                핵심 세부 능력치 영구 상승
              </div>
              <div className="grid grid-cols-2 gap-2">
                {alert.statDeltas.map((d) => (
                  <div
                    key={d.key}
                    className="rounded-lg border border-white/10 bg-[#141118] px-3 py-2 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold text-slate-400 whitespace-nowrap">
                        {d.key}
                      </div>
                      <div className="text-xs font-bold text-slate-200 truncate">
                        {d.label}
                      </div>
                    </div>
                    <div className="text-right shrink-0 tabular-nums">
                      <div className="text-xs font-black text-white">
                        {d.before} →{' '}
                        <span className="text-rose-300">{d.after}</span>
                      </div>
                      <div className="text-[10px] font-bold text-orange-300">
                        +{d.after - d.before}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-slate-300 leading-relaxed break-keep">
            {alert.reason ??
              `뛰어난 실전 활약 속에 잠재력이 완전히 만개했습니다! 기본 OVR이 영구적으로 ${alert.originalOvr}에서 ${alert.newOvr}(+${alert.ovrGain})로 성장했습니다.`}
          </p>
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-rose-500/20 bg-[#0b0a0e] px-4 py-3">
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg bg-gradient-to-r from-rose-600 to-orange-500 px-4 py-2 text-xs font-black text-white hover:brightness-110 transition whitespace-nowrap"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
