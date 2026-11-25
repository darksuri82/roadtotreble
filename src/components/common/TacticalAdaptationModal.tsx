import { AlertTriangle, Eye, SlidersHorizontal, X } from 'lucide-react';
import { TACTICS } from '../../engine/tacticEngine';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import type { TacticalAdaptationAlert } from '../../types/game';

interface TacticalAdaptationModalProps {
  alert: TacticalAdaptationAlert;
  onDismiss: () => void;
  onGoToTactics?: () => void;
}

export function TacticalAdaptationModal({
  alert,
  onDismiss,
  onGoToTactics,
}: TacticalAdaptationModalProps) {
  useBodyScrollLock(true);

  const isDanger = alert.tier === 'danger';
  const tacticName = TACTICS[alert.repeatedTactic]?.name ?? alert.repeatedTactic;
  const roundLabel =
    typeof alert.triggeredAtRound === 'number'
      ? `${alert.triggeredAtRound}R 스카우팅 리포트`
      : '스카우팅 리포트';
  const headline =
    alert.headline ??
    (isDanger
      ? '상대 감독들이 우리 전술 패턴을 완벽히 읽어냈습니다'
      : '상대 스카우트들이 반복 전술을 분석하기 시작했습니다');
  const detail =
    alert.detail ??
    (isDanger
      ? `최근 ${alert.consecutiveCount}경기 연속 동일 패턴이 노출되어(노출도 ${alert.exposureScore}/100), 다음 경기부터 상대 AI 감독이 경기 시작 전부터 맞춤 카운터 전술과 정밀 파훼 대응을 준비할 가능성이 높습니다.`
      : `최근 ${alert.consecutiveCount}경기 동안 유사한 포메이션·전술이 반복되어(노출도 ${alert.exposureScore}/100) 상위권 AI 감독들이 사전 대응책을 마련하고 있습니다.`);
  const accentBorder = isDanger
    ? 'border-rose-500/40'
    : 'border-amber-500/35';
  const badgeStyle = isDanger
    ? 'bg-rose-500/15 text-rose-300 border-rose-500/35'
    : 'bg-amber-500/15 text-amber-300 border-amber-500/35';
  const barStyle = isDanger
    ? 'bg-gradient-to-r from-amber-500 to-rose-500'
    : 'bg-gradient-to-r from-amber-500 to-amber-300';

  return (
    <div className="modal-backdrop z-[70]">
      <div
        className={`modal-panel w-full max-w-md rounded-2xl border ${accentBorder} bg-[#0d131c] shadow-2xl overflow-hidden`}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-[#111822] px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${badgeStyle}`}
            >
              {isDanger ? (
                <AlertTriangle className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span
                  className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap ${badgeStyle}`}
                >
                  {isDanger ? '전술 파훼 경계' : '전술 패턴 분석'}
                </span>
                <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap">
                  {roundLabel}
                </span>
              </div>
              <h3 className="text-sm font-black text-white truncate mt-0.5">
                {headline}
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
        <div className="modal-scroll p-4 space-y-3.5">
          {/* Repeated pattern card */}
          <div className="rounded-xl border border-white/10 bg-[#111822]/90 p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-slate-400 font-semibold whitespace-nowrap">
                반복 패턴
              </span>
              <span className="font-bold text-white whitespace-nowrap">
                {alert.repeatedFormation} · {tacticName}
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-semibold whitespace-nowrap">
                  상대 전술 노출도
                </span>
                <span
                  className={`font-black tabular-nums whitespace-nowrap ${
                    isDanger ? 'text-rose-400' : 'text-amber-300'
                  }`}
                >
                  {alert.exposureScore} / 100
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${barStyle}`}
                  style={{ width: `${Math.min(100, alert.exposureScore)}%` }}
                />
              </div>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-slate-300 break-keep">
            {detail}
          </p>

          <div className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2 text-[11px] text-slate-400 break-keep">
            포메이션 또는 전술 스타일을 1~2경기 변주하면 상대의 사전 분석이 무력화됩니다.
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-white/10 bg-[#0b1018] px-4 py-3">
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-bold text-slate-300 hover:bg-white/10 transition whitespace-nowrap"
          >
            확인
          </button>
          {onGoToTactics && (
            <button
              type="button"
              onClick={() => {
                onDismiss();
                onGoToTactics();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-black text-slate-950 hover:bg-emerald-400 transition whitespace-nowrap"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              전술 수정하러 가기
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
