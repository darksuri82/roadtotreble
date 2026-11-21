import { AlertTriangle, ArrowLeftRight, ShieldAlert, Users, X } from 'lucide-react';
import {
  getFatigueLabel,
  getFatigueTier,
  recommendBenchReplacements,
  SEVERITY_LABELS,
} from '../../engine/conditionEngine';
import type { InjuryAlertItem, PlayerConditionMap } from '../../types/condition';
import type { Player } from '../../types/player';
import { CountryFlagSvg } from './CountryFlagSvg';
import { PixelStatusIcon } from './PixelStatusIcon';

interface InjuryAlertModalProps {
  alerts: InjuryAlertItem[];
  bench: (Player | null)[];
  conditionMap?: PlayerConditionMap;
  onAutoReplace: (
    starterSlotIndex: number,
    benchIndex: number,
    playerId: string,
  ) => void;
  onOpenSquadManagement?: () => void;
  onClose: () => void;
}

const SEVERITY_BADGE_CLS: Record<InjuryAlertItem['injury']['severity'], string> = {
  minor: 'border-amber-400/45 bg-amber-500/15 text-amber-200',
  moderate: 'border-orange-400/50 bg-orange-500/20 text-orange-200',
  severe: 'border-rose-500/60 bg-rose-500/25 text-rose-200',
};

export function InjuryAlertModal({
  alerts,
  bench,
  conditionMap,
  onAutoReplace,
  onOpenSquadManagement,
  onClose,
}: InjuryAlertModalProps) {
  if (!alerts || alerts.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[72] flex items-center justify-center bg-slate-950/85 p-3 sm:p-4">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-rose-500/45 bg-[#0e1520] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-rose-500/25 bg-gradient-to-r from-rose-950/65 via-[#131926] to-[#0e1520] px-5 py-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-rose-400/40 bg-rose-950/80">
              <PixelStatusIcon variant="injury" size={20} />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-extrabold text-white">
                의료팀 부상 발생 리포트 ({alerts.length}명)
              </h3>
              <p className="text-[11px] text-rose-200/80">
                경기 중 부상이 발생했습니다. 대체 선수를 확인하고 로테이션을 조정하세요.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded-lg border border-slate-700 bg-slate-900 p-1.5 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Injury Alert Cards */}
        <div className="max-h-[68vh] overflow-y-auto p-4 sm:p-5 space-y-3.5">
          {alerts.map((alert) => {
            const { injury } = alert;
            const recommendations =
              alert.isStarter && alert.starterSlotIndex !== null
                ? recommendBenchReplacements({
                    injuredSlotPosition: alert.position,
                    bench,
                    conditionMap,
                  }).slice(0, 3)
                : [];

            return (
              <div
                key={`${alert.playerId}-${injury.id}`}
                className="rounded-xl border border-slate-800 bg-[#090e16] p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`rounded border px-2 py-0.5 text-[10px] font-extrabold ${SEVERITY_BADGE_CLS[injury.severity]}`}
                      >
                        {SEVERITY_LABELS[injury.severity]}
                      </span>
                      {alert.wasAggravated && (
                        <span className="inline-flex items-center gap-1 rounded border border-rose-400/50 bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-200">
                          <AlertTriangle className="h-3 w-3" />
                          출전 강행 악화
                        </span>
                      )}
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-300">
                        {alert.isStarter ? '선발 주전' : '벤치'} · {alert.mainPosition}
                      </span>
                    </div>

                    <div className="mt-1.5 flex items-center gap-2">
                      <CountryFlagSvg
                        code={alert.nationalityCode}
                        nationality={alert.nationality}
                        size="md"
                      />
                      <span className="text-base font-extrabold text-white">
                        {alert.playerName}
                      </span>
                      <span className="font-display text-sm font-bold text-amber-300">
                        OVR {alert.ovr}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 rounded-lg border border-rose-500/30 bg-rose-950/35 px-2.5 py-1.5 text-right tabular-nums">
                    <div className="text-[10px] text-rose-300/80">예상 결장</div>
                    <div className="font-display text-lg font-black text-rose-300 leading-tight">
                      {injury.matchesRemaining}경기
                    </div>
                  </div>
                </div>

                {/* Diagnosis & Impact */}
                <div className="rounded-lg border border-slate-800/90 bg-[#0d1420] px-3 py-2 text-xs space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-200">
                      진단명: <span className="text-rose-300">{injury.name}</span>
                    </span>
                    <span className="text-[11px] font-semibold text-slate-400">
                      {injury.canPlayThrough ? '경상 · 출전 강행 가능' : '출전 불가'}
                    </span>
                  </div>
                  {injury.canPlayThrough ? (
                    <p className="text-[11px] text-amber-200/90 leading-relaxed">
                      휴식 시 {injury.matchesRemaining}경기 후 완치됩니다. 출전 강행 시 기간 중{' '}
                      <strong className="text-amber-300">
                        OVR {injury.playThroughPenalty} 하락
                      </strong>
                      과 중상 악화 위험(+12%)이 따릅니다.
                    </p>
                  ) : injury.severity === 'severe' ? (
                    <p className="text-[11px] text-rose-200/90 leading-relaxed">
                      장기 이탈이 불가피한 치명적 중상입니다. 복귀 후에도 {injury.recoveryMatchesRemaining}경기 컨디션 회복기가 필요합니다.
                    </p>
                  ) : (
                    <p className="text-[11px] text-orange-200/90 leading-relaxed">
                      완전 회복까지 출전이 불가하며, 복귀 직후 {injury.recoveryMatchesRemaining}경기 동안 실효 OVR 소폭 하락이 적용됩니다.
                    </p>
                  )}
                </div>

                {/* Bench replacement recommendations */}
                {alert.isStarter && alert.starterSlotIndex !== null && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                      <ShieldAlert className="h-3.5 w-3.5 text-emerald-400" />
                      현재 벤치 가용 대체 선수 추천
                    </div>
                    {recommendations.length > 0 ? (
                      <div className="space-y-1.5">
                        {recommendations.map((rec) => {
                          const fatTier = getFatigueTier(rec.fatigue);
                          return (
                            <div
                              key={rec.player.id}
                              className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-[#101826] px-3 py-2"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <CountryFlagSvg
                                  code={rec.player.nationalityCode}
                                  nationality={rec.player.nationality}
                                  size="sm"
                                />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="truncate text-xs font-bold text-white">
                                      {rec.player.name}
                                    </span>
                                    <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-bold text-slate-300">
                                      {rec.player.mainPositions[0]}
                                    </span>
                                    <span className="text-[10px] font-semibold text-emerald-300">
                                      {rec.fitLabel}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-slate-400">
                                    OVR {rec.player.ovr} · 피로 {rec.fatigue}% (
                                    <span
                                      className={
                                        fatTier === 'burnout' || fatTier === 'danger'
                                          ? 'text-rose-300'
                                          : fatTier === 'caution'
                                            ? 'text-amber-300'
                                            : 'text-emerald-300'
                                      }
                                    >
                                      {getFatigueLabel(rec.fatigue)}
                                    </span>
                                    )
                                  </div>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  onAutoReplace(
                                    alert.starterSlotIndex!,
                                    rec.benchIndex,
                                    alert.playerId,
                                  )
                                }
                                className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1.5 text-[11px] font-extrabold text-slate-950 hover:bg-emerald-400 cursor-pointer"
                              >
                                <ArrowLeftRight className="h-3 w-3" />
                                즉시 대체 투입
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-[11px] text-slate-400">
                        현재 벤치에 즉시 교체 가능한 건강한 대체 자원이 부족합니다. 스쿼드 탭에서 포지션을 재조정하세요.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-800 bg-[#0b1018] px-5 py-3.5">
          {onOpenSquadManagement && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenSquadManagement();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/15 px-3.5 py-2 text-xs font-bold text-sky-200 hover:bg-sky-500/25 cursor-pointer"
            >
              <Users className="h-3.5 w-3.5" />
              스쿼드 직접 편집하기
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-bold text-slate-100 hover:bg-slate-700 cursor-pointer"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
