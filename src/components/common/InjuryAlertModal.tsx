import {
  AlertTriangle,
  ArrowLeftRight,
  CheckCircle2,
  ShieldAlert,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { FORMATIONS } from '../../data/formations';
import {
  getInjuryMoralePenalty,
  getInjuryTooltip,
  getMoraleLabel,
  getMoraleTier,
  isPlayerActivelyInjured,
  isPlayerUnavailable,
  recommendBenchReplacements,
  SEVERITY_LABELS,
} from '../../engine/conditionEngine';
import { formatMainPositions } from '../../engine/positionEngine';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import type {
  InjuryAlertItem,
  InjuryAutoReturnEntry,
  PlayerConditionMap,
} from '../../types/condition';
import type {
  ChemistryResult,
  FormationId,
  ManagerTraitId,
  TeamRatings,
} from '../../types/game';
import type { Player, SubPosition } from '../../types/player';
import { CountryFlagSvg } from './CountryFlagSvg';
import { PitchBoard, type SlotRef } from './PitchBoard';
import { PixelStatusIcon } from './PixelStatusIcon';

interface InjuryAlertModalProps {
  alerts: InjuryAlertItem[];
  formation: FormationId;
  starters: (Player | null)[];
  bench: (Player | null)[];
  chemistry: ChemistryResult;
  ratings: TeamRatings;
  managerTraitId: ManagerTraitId | null;
  conditionMap?: PlayerConditionMap;
  onSwapSlots: (from: SlotRef, to: SlotRef) => void;
  onConfirmClose: (autoReturnsToAdd: InjuryAutoReturnEntry[]) => void;
}

const SEVERITY_BADGE_CLS: Record<InjuryAlertItem['injury']['severity'], string> = {
  minor: 'border-amber-400/45 bg-amber-500/15 text-amber-200',
  moderate: 'border-orange-400/50 bg-orange-500/20 text-orange-200',
  severe: 'border-rose-500/60 bg-rose-500/25 text-rose-200',
};

const FIT_BADGE_CLS: Record<'main' | 'secondary' | 'out_of_pos' | 'severe', string> = {
  main: 'border-emerald-400/45 bg-emerald-500/15 text-emerald-200',
  secondary: 'border-amber-400/45 bg-amber-500/15 text-amber-200',
  out_of_pos: 'border-sky-400/40 bg-sky-500/15 text-sky-200',
  severe: 'border-slate-700 bg-slate-800/80 text-slate-400',
};

export function InjuryAlertModal({
  alerts,
  formation,
  starters,
  bench,
  chemistry,
  ratings,
  managerTraitId,
  conditionMap,
  onSwapSlots,
  onConfirmClose,
}: InjuryAlertModalProps) {
  useBodyScrollLock(alerts.length > 0);
  const alertBatchKey = alerts.map((a) => `${a.playerId}:${a.injury.id}`).join('|');

  const defaultSelectedStarterSlot = useMemo<SlotRef | null>(() => {
    const firstStarterAlert = alerts.find(
      (a) => a.isStarter && a.starterSlotIndex !== null,
    );
    if (firstStarterAlert && firstStarterAlert.starterSlotIndex !== null) {
      return { area: 'starter', index: firstStarterAlert.starterSlotIndex };
    }
    return null;
  }, [alerts]);

  const [trackedKey, setTrackedKey] = useState(alertBatchKey);
  const [selectedSlot, setSelectedSlot] = useState<SlotRef | null>(
    defaultSelectedStarterSlot,
  );
  // Tracks which bench player IDs were moved up to starters during this modal session
  const [promotedBenchIds, setPromotedBenchIds] = useState<string[]>([]);

  if (trackedKey !== alertBatchKey) {
    setTrackedKey(alertBatchKey);
    setSelectedSlot(defaultSelectedStarterSlot);
    setPromotedBenchIds([]);
  }

  const highlightedPlayerIds = useMemo(
    () => new Set(alerts.map((a) => a.playerId)),
    [alerts],
  );

  const formCfg = FORMATIONS[formation] ?? FORMATIONS['4-3-3'];

  // Determine the target starter slot for evaluating bench position compatibility.
  // Never fall back to slot 0 (GK) when no starter slot is selected or injured.
  const activeTargetSlotIndex = useMemo<number | null>(() => {
    if (selectedSlot?.area === 'starter') {
      return selectedSlot.index;
    }
    for (const a of alerts) {
      const curIdx = starters.findIndex((p) => p?.id === a.playerId);
      if (curIdx !== -1) return curIdx;
    }
    const firstStarterAlert = alerts.find(
      (a) => a.isStarter && a.starterSlotIndex !== null,
    );
    return firstStarterAlert?.starterSlotIndex ?? null;
  }, [selectedSlot, alerts, starters]);

  const targetSlotDef =
    activeTargetSlotIndex !== null ? formCfg.slots[activeTargetSlotIndex] ?? null : null;
  const targetSubPosition: SubPosition | null = targetSlotDef?.subPosition ?? null;
  const targetPosition = targetSlotDef?.position ?? null;

  const benchRecommendations = useMemo(() => {
    if (!targetSubPosition || !targetPosition) return [];
    return recommendBenchReplacements({
      injuredSlotPosition: targetPosition,
      injuredSlotSubPosition: targetSubPosition,
      bench,
      conditionMap,
      managerTraitId,
      includeUnavailable: true,
    });
  }, [targetPosition, targetSubPosition, bench, conditionMap, managerTraitId]);

  if (alerts.length === 0) return null;

  const hasSevere = alerts.some((a) => a.injury.severity === 'severe');
  const hasModerate = alerts.some((a) => a.injury.severity === 'moderate');

  // Check if any unavailable (moderate/severe) injured player is still in the starting XI
  const remainingUnavailableStarters = alerts.filter((a) => {
    const stillStarter = starters.some((p) => p?.id === a.playerId);
    const cond = conditionMap?.[a.playerId];
    return stillStarter && isPlayerUnavailable(cond);
  });

  // Check how many injured starters have been subbed out to bench (eligible for auto-return)
  const subbedOutStarterAlerts = alerts.filter(
    (a) =>
      a.isStarter &&
      a.starterSlotIndex !== null &&
      bench.some((p) => p?.id === a.playerId),
  );

  const performSwap = (from: SlotRef, to: SlotRef) => {
    if (from.area === to.area && from.index === to.index) return;
    // Track any bench player promoted into starters for accurate multi-step auto-return reversal
    if (from.area === 'bench' && to.area === 'starter') {
      const benchPlayer = bench[from.index];
      if (benchPlayer) {
        setPromotedBenchIds((prev) =>
          prev.includes(benchPlayer.id) ? prev : [...prev, benchPlayer.id],
        );
      }
    } else if (from.area === 'starter' && to.area === 'bench') {
      const benchPlayer = bench[to.index];
      if (benchPlayer) {
        setPromotedBenchIds((prev) =>
          prev.includes(benchPlayer.id) ? prev : [...prev, benchPlayer.id],
        );
      }
    }
    onSwapSlots(from, to);
  };

  const handlePitchSlotClick = (area: 'starter' | 'bench', index: number) => {
    if (!selectedSlot) {
      setSelectedSlot({ area, index });
      return;
    }
    if (selectedSlot.area === area && selectedSlot.index === index) {
      setSelectedSlot(null);
      return;
    }
    performSwap(selectedSlot, { area, index });
    // After swapping two starters (e.g. moving LW -> ST), keep the newly vacated/injured slot easy to target
    if (selectedSlot.area === 'starter' && area === 'starter') {
      const movedPlayer = starters[selectedSlot.index];
      if (movedPlayer && highlightedPlayerIds.has(movedPlayer.id)) {
        setSelectedSlot({ area: 'starter', index });
        return;
      }
    }
    setSelectedSlot(null);
  };

  const handleBenchQuickSwap = (benchIndex: number) => {
    const targetIdx =
      selectedSlot?.area === 'starter'
        ? selectedSlot.index
        : activeTargetSlotIndex;
    if (targetIdx === null) return;
    const target: SlotRef = { area: 'starter', index: targetIdx };
    performSwap(target, { area: 'bench', index: benchIndex });
    // Advance selection to next unresolved injured starter if multiple injuries exist
    const nextUnresolved = alerts.find((a) => {
      const idx = starters.findIndex((p) => p?.id === a.playerId);
      return idx !== -1 && idx !== target.index;
    });
    if (nextUnresolved) {
      const nextIdx = starters.findIndex((p) => p?.id === nextUnresolved.playerId);
      setSelectedSlot(nextIdx !== -1 ? { area: 'starter', index: nextIdx } : null);
    } else {
      setSelectedSlot(null);
    }
  };

  const handleConfirm = () => {
    const autoReturnsToAdd: InjuryAutoReturnEntry[] = [];
    const usedRepIds = new Set<string>();

    for (const alert of alerts) {
      if (!alert.isStarter || alert.starterSlotIndex === null) continue;
      // Only record auto-return if the injured original starter is now on the bench
      const isNowOnBench = bench.some((p) => p?.id === alert.playerId);
      if (!isNowOnBench) continue;

      // Prefer a newly promoted bench player who is currently in starters
      let repId: string | null = null;
      const promotedInStarters = promotedBenchIds.find(
        (id) => !usedRepIds.has(id) && starters.some((p) => p?.id === id),
      );
      if (promotedInStarters) {
        repId = promotedInStarters;
      } else {
        const currentOccupant = starters[alert.starterSlotIndex];
        if (currentOccupant && currentOccupant.id !== alert.playerId) {
          repId = currentOccupant.id;
        }
      }
      if (repId) usedRepIds.add(repId);

      autoReturnsToAdd.push({
        injuredPlayerId: alert.playerId,
        injuredPlayerName: alert.playerName,
        originalSlotIndex: alert.starterSlotIndex,
        replacementPlayerId: repId,
      });
    }

    onConfirmClose(autoReturnsToAdd);
  };

  return (
    <div className="modal-backdrop fixed inset-0 z-[72] flex items-center justify-center bg-slate-950/85 p-2 sm:p-4">
      <div className="modal-panel flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-rose-500/45 bg-[#0e141f] shadow-2xl">
        {/* Header */}
        <div
          className={`flex items-center justify-between gap-2.5 border-b px-3 py-2.5 sm:px-5 sm:py-3.5 shrink-0 ${
            hasSevere
              ? 'border-rose-500/45 bg-gradient-to-r from-rose-950/80 via-[#1b1219] to-[#0e141f]'
              : hasModerate
                ? 'border-orange-500/35 bg-gradient-to-r from-orange-950/60 via-[#191518] to-[#0e141f]'
                : 'border-amber-500/35 bg-gradient-to-r from-amber-950/50 via-[#18161a] to-[#0e141f]'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl border border-rose-400/40 bg-rose-500/15">
              <PixelStatusIcon variant="injury" size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <h2 className="text-xs sm:text-base font-extrabold text-white truncate">
                  {alerts.length === 1
                    ? '부상 발생 · 포메이션 교체'
                    : `부상 발생 (${alerts.length}명) · 교체`}
                </h2>
                <span className="inline-flex items-center gap-1 rounded border border-emerald-400/35 bg-emerald-500/15 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold text-emerald-200">
                  <Sparkles className="h-2.5 w-2.5" />
                  완치 자동복귀
                </span>
              </div>
              <p className="hidden sm:block text-[11px] text-slate-300 truncate">
                피치에서 선발 간 스왑 후 벤치 투입까지 자유롭게 조정할 수 있습니다.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleConfirm}
            aria-label="닫기"
            className="rounded-lg border border-slate-700 bg-slate-900/90 p-1.5 text-slate-300 hover:border-slate-500 hover:text-white cursor-pointer shrink-0 touch-manipulation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Main 2-column body (Mobile: Pitch top, Diagnosis & Bench below) */}
        <div className="modal-scroll flex-1 min-h-0 overflow-y-auto p-2.5 sm:p-5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 items-start">
            {/* Left: Interactive Formation PitchBoard */}
            <div className="lg:col-span-6 space-y-1.5 sm:space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px] sm:text-xs">
                <span className="inline-flex items-center gap-1 font-bold text-slate-200">
                  <ArrowLeftRight className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  {selectedSlot?.area === 'starter' ? (
                    <span>
                      <strong className="text-emerald-300">
                        {formCfg.slots[selectedSlot.index]?.subPosition}
                      </strong>{' '}
                      선택 · 교체 대상 탭
                    </span>
                  ) : (
                    <span>선수 탭으로 교체/스왑</span>
                  )}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] text-slate-400 tabular-nums">
                  <Zap className="h-3 w-3 text-emerald-400" />
                  A {ratings.effectiveAtt} / M {ratings.effectiveMid} / D{' '}
                  {ratings.effectiveDef}
                </span>
              </div>

              <PitchBoard
                formation={formation}
                starters={starters}
                bench={bench}
                chemistry={chemistry}
                managerTraitId={managerTraitId}
                selectedSlot={selectedSlot}
                conditionByPlayerId={conditionMap}
                highlightedPlayerIds={highlightedPlayerIds}
                onSlotClick={handlePitchSlotClick}
                onSlotSwap={(from, to) => {
                  performSwap(from, to);
                  setSelectedSlot(null);
                }}
                showBench={false}
                showChemBreakdown={false}
                compact
              />
            </div>

            {/* Right: Injury Diagnosis Cards + Dynamic Bench Replacements */}
            <div className="lg:col-span-6 space-y-2.5 sm:space-y-3.5">
              {/* 1. Injury Diagnosis Summary */}
              <div className="space-y-2">
                {alerts.map((alert) => {
                  const { injury } = alert;
                  const onBenchNow = bench.some((p) => p?.id === alert.playerId);
                  const stillOnPitch = starters.some((p) => p?.id === alert.playerId);
                  const moraleDrop = getInjuryMoralePenalty(injury.severity);

                  return (
                    <div
                      key={`${alert.playerId}-${injury.id}`}
                      className={`rounded-xl border p-2.5 sm:p-3.5 space-y-1.5 sm:space-y-2 ${
                        onBenchNow
                          ? 'border-emerald-500/40 bg-emerald-950/15'
                          : 'border-rose-500/40 bg-[#0b1019]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`rounded border px-1.5 py-0.5 text-[10px] font-extrabold ${SEVERITY_BADGE_CLS[injury.severity]}`}
                            >
                              {SEVERITY_LABELS[injury.severity]}
                            </span>
                            {alert.wasAggravated && (
                              <span className="inline-flex items-center gap-0.5 rounded border border-rose-400/50 bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-200">
                                <AlertTriangle className="h-3 w-3" />
                                출전 강행 악화
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1 rounded border border-sky-400/40 bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-bold text-sky-200">
                              <PixelStatusIcon variant="morale_low" size={10} />
                              사기 {moraleDrop}
                            </span>
                            {onBenchNow ? (
                              <span className="inline-flex items-center gap-0.5 rounded border border-emerald-400/45 bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-extrabold text-emerald-200">
                                <CheckCircle2 className="h-3 w-3" />
                                벤치 이동 완료
                              </span>
                            ) : stillOnPitch && !injury.canPlayThrough ? (
                              <span className="rounded border border-rose-400/50 bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-extrabold text-rose-200">
                                교체 필요
                              </span>
                            ) : null}
                          </div>

                          <div className="mt-1.5 flex items-center gap-2">
                            <CountryFlagSvg
                              code={alert.nationalityCode}
                              nationality={alert.nationality}
                              size="sm"
                            />
                            <span className="text-sm sm:text-base font-extrabold text-white truncate">
                              {alert.playerName}
                            </span>
                            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-300">
                              {alert.mainPosition}
                            </span>
                            <span className="font-display text-xs font-bold text-amber-300 tabular-nums">
                              OVR {alert.ovr}
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0 rounded-lg border border-rose-500/35 bg-rose-950/40 px-2.5 py-1 text-right tabular-nums">
                          <div className="text-[9px] text-rose-300/80">예상 결장</div>
                          <div className="font-display text-base font-black text-rose-300 leading-tight">
                            {injury.matchesRemaining}경기
                          </div>
                        </div>
                      </div>

                      <div className="rounded-lg border border-slate-800/90 bg-[#0d1420] px-2.5 py-1.5 text-[11px] space-y-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-200">
                            진단명:{' '}
                            <span className="text-rose-300">{injury.name}</span>
                          </span>
                          <span className="text-[10px] font-semibold text-slate-400">
                            {injury.canPlayThrough
                              ? '경상 · 출전 강행 가능'
                              : '출전 불가'}
                          </span>
                        </div>
                        {injury.canPlayThrough ? (
                          <p className="text-[10px] text-amber-200/90 leading-relaxed">
                            벤치 휴식 시 {injury.matchesRemaining}경기 후 완치(자동 복귀). 출전 강행 시{' '}
                            <strong className="text-amber-300">
                              OVR {injury.playThroughPenalty} 하락
                            </strong>{' '}
                            및 악화 위험(+6%)이 있습니다.
                          </p>
                        ) : injury.severity === 'severe' ? (
                          <p className="text-[10px] text-rose-200/90 leading-relaxed">
                            장기 이탈이 불가피한 치명적 중상입니다(팀 사기 -1). 벤치로 이동하면 완치 시 원래 선발 자리에 자동 복귀합니다.
                          </p>
                        ) : (
                          <p className="text-[10px] text-orange-200/90 leading-relaxed">
                            완치까지 출전이 불가합니다. 벤치로 교체해 두면 {injury.matchesRemaining}경기 후 원래 선발 슬롯에 자동 복귀합니다.
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 2. Candidate Bench Panel (Dynamic Position Fit for Active Target Slot) */}
              <div className="rounded-xl border border-slate-800 bg-[#0a1019] p-3.5 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-white">
                    <ShieldAlert className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    <span>후보 벤치 교체 목록</span>
                  </div>
                  {activeTargetSlotIndex !== null && targetSubPosition ? (
                    <span className="rounded border border-emerald-500/35 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                      대상 슬롯: {targetSubPosition} (
                      {starters[activeTargetSlotIndex]?.name ?? '빈 슬롯'})
                    </span>
                  ) : (
                    <span className="rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-slate-400">
                      피치 선발 슬롯 선택 시 적합도 표시
                    </span>
                  )}
                </div>

                {activeTargetSlotIndex !== null && targetSubPosition ? (
                  benchRecommendations.length > 0 ? (
                    <div className="space-y-1.5">
                      {benchRecommendations.map((rec, idx) => {
                        const cond = conditionMap?.[rec.player.id];
                        const injured = isPlayerActivelyInjured(cond);
                        const mTier = cond ? getMoraleTier(cond.morale) : 'normal';
                        const isTopRecommend = idx === 0 && !rec.isUnavailable;
                        const isNewlyInjuredOnBench = highlightedPlayerIds.has(
                          rec.player.id,
                        );

                        return (
                          <div
                            key={rec.player.id}
                            className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 transition-colors ${
                              isNewlyInjuredOnBench
                                ? 'border-rose-500/35 bg-rose-950/20'
                                : isTopRecommend
                                  ? 'border-emerald-500/45 bg-emerald-950/20'
                                  : 'border-slate-800 bg-[#0e1522]'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <CountryFlagSvg
                                code={rec.player.nationalityCode}
                                nationality={rec.player.nationality}
                                size="sm"
                              />
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-xs font-extrabold text-white truncate">
                                    {rec.player.name}
                                  </span>
                                  {isTopRecommend && (
                                    <span className="rounded bg-emerald-400 px-1.5 py-0.2 text-[9px] font-black text-slate-950">
                                      추천
                                    </span>
                                  )}
                                  <span
                                    className={`rounded border px-1.5 py-0.2 text-[9px] font-bold ${FIT_BADGE_CLS[rec.fit]}`}
                                  >
                                    {rec.fitLabel}
                                  </span>
                                  {injured && cond?.injury && (
                                    <PixelStatusIcon
                                      variant="injury"
                                      size={11}
                                      title={getInjuryTooltip(cond.injury)}
                                    />
                                  )}
                                  {mTier === 'ecstatic' && (
                                    <PixelStatusIcon
                                      variant="morale_high"
                                      size={11}
                                      title={`사기 ${getMoraleLabel(cond!.morale)}`}
                                    />
                                  )}
                                  {mTier === 'frozen' && (
                                    <PixelStatusIcon
                                      variant="morale_low"
                                      size={11}
                                      title={`사기 ${getMoraleLabel(cond!.morale)}`}
                                    />
                                  )}
                                </div>
                                <div className="mt-0.5 text-[10px] text-slate-400 tabular-nums">
                                  포지션 {formatMainPositions(rec.player) || rec.player.position} · 기본 OVR{' '}
                                  <span className="font-bold text-slate-200">
                                    {rec.player.ovr}
                                  </span>
                                  {!rec.isUnavailable && (
                                    <>
                                      {' '}
                                      → {targetSubPosition} 실효{' '}
                                      <strong
                                        className={
                                          rec.positionPenalty === 0
                                            ? 'text-emerald-300'
                                            : rec.positionPenalty >= -3
                                              ? 'text-amber-300'
                                              : 'text-orange-300'
                                        }
                                      >
                                        {rec.effectiveScore}
                                      </strong>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            {rec.isUnavailable ? (
                              <span className="shrink-0 rounded border border-rose-500/35 bg-rose-950/40 px-2 py-1 text-[10px] font-bold text-rose-300">
                                결장 {cond?.injury?.matchesRemaining ?? 0}G
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleBenchQuickSwap(rec.benchIndex)}
                                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-emerald-400/50 bg-emerald-500/20 px-2.5 py-1.5 text-[11px] font-extrabold text-emerald-200 hover:bg-emerald-500/30 cursor-pointer"
                              >
                                <ArrowLeftRight className="h-3 w-3" />
                                {targetSubPosition} 투입
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500">
                      벤치에 등록된 후보 선수가 없습니다.
                    </p>
                  )
                ) : (
                  <div className="space-y-1.5">
                    {bench
                      .filter((p): p is Player => p !== null)
                      .map((bp) => {
                        const cond = conditionMap?.[bp.id];
                        const injured = isPlayerActivelyInjured(cond);
                        const unavailable = isPlayerUnavailable(cond);
                        return (
                          <div
                            key={bp.id}
                            className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 ${
                              highlightedPlayerIds.has(bp.id)
                                ? 'border-rose-500/35 bg-rose-950/20'
                                : 'border-slate-800 bg-[#0e1522]'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <CountryFlagSvg
                                code={bp.nationalityCode}
                                nationality={bp.nationality}
                                size="sm"
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-extrabold text-white truncate">
                                    {bp.name}
                                  </span>
                                  <span className="rounded bg-slate-800 px-1.5 py-px text-[9px] font-bold text-slate-300">
                                    {formatMainPositions(bp) || bp.position}
                                  </span>
                                  {injured && cond?.injury && (
                                    <PixelStatusIcon
                                      variant="injury"
                                      size={11}
                                      title={getInjuryTooltip(cond.injury)}
                                    />
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400 tabular-nums">
                                  OVR <span className="font-bold text-slate-200">{bp.ovr}</span>
                                </div>
                              </div>
                            </div>
                            {unavailable && (
                              <span className="shrink-0 rounded border border-rose-500/35 bg-rose-950/40 px-2 py-1 text-[10px] font-bold text-rose-300">
                                결장 {cond?.injury?.matchesRemaining ?? 0}G
                              </span>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-slate-800 bg-[#0a0f18] px-4 py-3 sm:px-5 shrink-0">
          <div className="text-[11px] min-w-0">
            {remainingUnavailableStarters.length > 0 ? (
              <span className="inline-flex items-center gap-1.5 font-bold text-rose-300">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                출전 불가 부상자({remainingUnavailableStarters.map((a) => a.playerName).join(', ')})를 벤치 선수로 교체해 주세요!
              </span>
            ) : subbedOutStarterAlerts.length > 0 ? (
              <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                {subbedOutStarterAlerts.map((a) => a.playerName).join(', ')} — 완치 시 원래 선발 슬롯으로 자동 복귀 예약됨
              </span>
            ) : (
              <span className="text-slate-400">
                피치에서 교체하지 않고 닫으면 현재 선발 라인업이 그대로 유지됩니다.
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleConfirm}
            className={`rounded-lg px-5 py-2 text-xs font-extrabold cursor-pointer shrink-0 ${
              remainingUnavailableStarters.length > 0
                ? 'border border-amber-400/50 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30'
                : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
            }`}
          >
            {remainingUnavailableStarters.length > 0
              ? '미교체 상태로 닫기'
              : '라인업 확정하고 계속하기'}
          </button>
        </div>
      </div>
    </div>
  );
}
