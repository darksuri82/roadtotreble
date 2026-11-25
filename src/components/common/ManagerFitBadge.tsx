import { ChevronDown, Info, Star, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FORMATIONS } from '../../data/formations';
import {
  evaluateManagerFitDetail,
  type ManagerFitDetail,
} from '../../data/managerTraits';
import type { FormationId, ManagerTraitId } from '../../types/game';
import type { TacticId } from '../../types/league';
import type { Player } from '../../types/player';

interface ManagerFitBadgeProps {
  traitId: ManagerTraitId | null | undefined;
  starters: (Player | null)[];
  /** Optional baseline starters (before hovering/previewing a draft candidate) to show live delta */
  baselineStarters?: (Player | null)[] | null;
  tactic?: TacticId;
  formation?: FormationId;
  /** 'strip' = full-width sleek 1-line bar (PitchBoard sub-header); 'pill' = compact inline button */
  variant?: 'strip' | 'pill';
  /** Whether to show manager trait name next to the count */
  showTraitName?: boolean;
  align?: 'left' | 'right' | 'center';
  className?: string;
}

function getSlotLabel(formation: FormationId | undefined, slotIndex: number): string {
  if (!formation) return `#${slotIndex + 1}`;
  const slot = FORMATIONS[formation]?.slots[slotIndex];
  return slot?.label ?? `#${slotIndex + 1}`;
}

function renderPopoverBody(
  detail: ManagerFitDetail,
  formation: FormationId | undefined,
) {
  const isProgressive = detail.scalingMode === 'progressive';
  const eff = detail.effect;

  return (
    <div className="space-y-2.5 text-[11px] text-slate-300 break-keep">
      {/* Header summary */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-lg border border-slate-800/90 bg-[#0d141f] px-2.5 py-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: detail.config.badgeColor }}
            />
            <span className="font-extrabold text-white">
              {detail.config.name}
            </span>
            <span
              className={`rounded border px-1.5 py-px text-[9.5px] font-bold whitespace-nowrap ${
                isProgressive
                  ? 'border-amber-400/35 bg-amber-500/12 text-amber-200'
                  : 'border-sky-400/35 bg-sky-500/12 text-sky-200'
              }`}
            >
              {isProgressive
                ? `1~${detail.totalSlots}명 비례 상승`
                : '팀 효과 인원 무관'}
            </span>
          </div>
          <p className="mt-0.5 text-[10px] text-slate-400">
            {detail.config.tagline}
          </p>
        </div>

        <div className="text-right tabular-nums shrink-0">
          <div className="text-[10px] text-slate-400">
            {isProgressive ? '감독 궁합' : '개인 궁합 (★+1)'}
          </div>
          <div className="font-display text-sm font-black text-amber-300 leading-tight">
            {detail.matchedCount}
            <span className="text-slate-500">/{detail.totalSlots}</span>
          </div>
        </div>
      </div>

      {/* Progressive scaling details OR Situational non-scaling explanation */}
      {isProgressive ? (
        <div className="space-y-2">
          {/* Live active team boost summary */}
          <div className="rounded-lg border border-slate-800/80 bg-[#0e1521] px-2.5 py-2 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold text-slate-400">
                현재 적용 중인 팀 상승
              </span>
              {detail.totalOvrDelta > 0 && (
                <span className="rounded bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-px text-[10px] font-extrabold text-emerald-300 tabular-nums whitespace-nowrap">
                  팀 OVR +{detail.totalOvrDelta.toFixed(1)}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1 tabular-nums">
              {eff.baseAttDelta > 0 && (
                <span className="rounded bg-slate-900 border border-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300 whitespace-nowrap">
                  ATT +{eff.baseAttDelta.toFixed(1)}
                </span>
              )}
              {eff.baseMidDelta > 0 && (
                <span className="rounded bg-slate-900 border border-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-sky-300 whitespace-nowrap">
                  MID +{eff.baseMidDelta.toFixed(1)}
                </span>
              )}
              {eff.baseDefDelta > 0 && (
                <span className="rounded bg-slate-900 border border-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 whitespace-nowrap">
                  DEF +{eff.baseDefDelta.toFixed(1)}
                </span>
              )}
              {detail.traitId === 'set_piece_master' && (
                <>
                  <span className="rounded bg-slate-900 border border-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300 whitespace-nowrap">
                    세트피스 xG +{eff.xgBonus.toFixed(2)}
                  </span>
                  <span className="rounded bg-slate-900 border border-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-sky-300 whitespace-nowrap">
                    상대 xG -{eff.oppXgPenalty.toFixed(2)}
                  </span>
                </>
              )}
              {detail.traitId !== 'set_piece_master' && eff.possessionBonus > 0 && (
                <span className="rounded bg-slate-900 border border-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-cyan-300 whitespace-nowrap">
                  점유율 +{eff.possessionBonus.toFixed(1)}%
                </span>
              )}
              {detail.traitId !== 'set_piece_master' && eff.xgBonus > 0 && (
                <span className="rounded bg-slate-900 border border-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300 whitespace-nowrap">
                  xG +{eff.xgBonus.toFixed(2)}
                </span>
              )}
              {detail.traitId !== 'set_piece_master' && eff.oppXgPenalty > 0 && (
                <span className="rounded bg-slate-900 border border-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-sky-300 whitespace-nowrap">
                  상대 xG -{eff.oppXgPenalty.toFixed(2)}
                </span>
              )}
              {detail.traitId === 'total_football' && (
                <span className="rounded bg-slate-900 border border-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-violet-300 whitespace-nowrap">
                  부포 페널티 0
                </span>
              )}
              {detail.personalMatchedCount > 0 && (
                <span className="rounded bg-amber-500/12 border border-amber-400/30 px-1.5 py-0.5 text-[10px] font-bold text-amber-200 whitespace-nowrap">
                  개인 ★+1 × {detail.personalMatchedCount}명
                </span>
              )}
              {detail.matchedCount === 0 &&
                detail.personalMatchedCount === 0 &&
                eff.baseAttDelta === 0 &&
                eff.baseMidDelta === 0 &&
                eff.baseDefDelta === 0 &&
                detail.traitId !== 'set_piece_master' &&
                detail.traitId !== 'total_football' && (
                  <span className="text-[10px] text-slate-500">
                    궁합 선수를 선발에 배치하면 즉시 상승합니다.
                  </span>
                )}
            </div>

            {detail.tacticSynergyBonusLabel && detail.synergyTacticLabel && (
              <div
                className={`flex items-center justify-between gap-2 rounded-md border px-2 py-1 text-[10px] ${
                  eff.isTacticSynergyActive
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                    : 'border-slate-800 bg-slate-900/70 text-slate-400'
                }`}
              >
                <span>{detail.tacticSynergyBonusLabel}</span>
                <span className="font-extrabold shrink-0 whitespace-nowrap">
                  {eff.isTacticSynergyActive ? '적용 중' : `${detail.synergyTacticLabel} 미선택`}
                </span>
              </div>
            )}
          </div>

          {/* Scaling milestones */}
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-[10px]">
              <span className="font-bold text-slate-400">인원별 상승 (1명씩 연속 적용)</span>
              {detail.perPlayerStepLabel && (
                <span className="text-slate-400 tabular-nums">
                  {detail.perPlayerStepLabel}
                </span>
              )}
            </div>
            <div
              className={`grid gap-1 tabular-nums ${
                detail.milestones.length === 3 ? 'grid-cols-3' : 'grid-cols-2'
              }`}
            >
              {detail.milestones.map((ms) => {
                const isNext = detail.nextMilestone?.targetCount === ms.count;
                return (
                  <div
                    key={ms.count}
                    className={`flex items-center justify-between gap-1 rounded-md border px-2 py-1 text-[10px] ${
                      ms.reached
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                        : isNext
                          ? 'border-amber-400/40 bg-amber-500/10 text-amber-100'
                          : 'border-slate-800/80 bg-[#0d131c] text-slate-400'
                    }`}
                  >
                    <span className="font-extrabold whitespace-nowrap">
                      {ms.count}/{detail.totalSlots}
                    </span>
                    <span className="truncate font-semibold">{ms.summary}</span>
                  </div>
                );
              })}
            </div>
            {detail.nextMilestone ? (
              <div className="text-[10px] text-amber-200/90 tabular-nums">
                다음 기준({detail.nextMilestone.targetCount}/{detail.totalSlots})까지{' '}
                <strong>{detail.nextMilestone.remaining}명</strong> 남음
              </div>
            ) : (
              <div className="text-[10px] font-bold text-emerald-300 tabular-nums">
                최대 효과({detail.totalSlots}/{detail.totalSlots} MAX) 달성!
              </div>
            )}
          </div>
        </div>
      ) : (
        detail.situationalRule && (
          <div className="rounded-lg border border-sky-500/30 bg-sky-950/20 px-2.5 py-2 space-y-1.5">
            <div className="flex items-center gap-1.5 text-[10.5px] font-extrabold text-sky-200">
              <Info className="w-3.5 h-3.5 shrink-0 text-sky-300" />
              <span>팀 특수 효과는 궁합 인원 수와 무관합니다</span>
            </div>
            <div className="space-y-1 text-[10.5px]">
              <div className="flex items-start gap-1.5">
                <span className="text-slate-400 shrink-0 font-semibold">발동 조건</span>
                <span className="text-slate-100 font-semibold">
                  {detail.situationalRule.triggerLabel}
                </span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="text-slate-400 shrink-0 font-semibold">팀 효과</span>
                <span className="text-emerald-300 font-bold">
                  {detail.situationalRule.effectLabel}
                </span>
              </div>
            </div>
            <p className="text-[10px] leading-relaxed text-slate-400 border-t border-slate-800/80 pt-1.5">
              {detail.situationalRule.note}
            </p>
          </div>
        )
      )}

      {/* Matched Starters List */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px]">
          <span className="font-bold text-slate-400">
            {isProgressive ? '선발 궁합 선수' : '개인 ★+1 적용 선발'} (
            {detail.matchedStarters.length}/{detail.filledCount || 11})
          </span>
          {detail.unmatchedStarters.length > 0 && (
            <span className="text-slate-500 tabular-nums">
              미일치 {detail.unmatchedStarters.length}명
            </span>
          )}
        </div>
        {detail.matchedStarters.length > 0 ? (
          <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-0.5">
            {detail.matchedStarters.map((entry) => (
              <span
                key={`${entry.slotIndex}-${entry.player.id}`}
                className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] whitespace-nowrap ${
                  entry.countsForTeamEffect || !isProgressive
                    ? 'border-amber-400/35 bg-amber-500/10 text-amber-100'
                    : 'border-slate-700/80 bg-slate-900/90 text-slate-300'
                }`}
              >
                <span className="text-[9px] font-bold text-slate-400">
                  {getSlotLabel(formation, entry.slotIndex)}
                </span>
                <span className="font-bold">{entry.player.name}</span>
                {entry.hasPersonalSynergy && (
                  <span className="text-[9px] font-extrabold text-amber-300">
                    ★+1
                  </span>
                )}
              </span>
            ))}
          </div>
        ) : (
          <div className="rounded border border-slate-800/80 bg-[#0d131c] px-2 py-1.5 text-[10px] text-slate-500">
            아직 선발에 궁합 일치 선수가 없습니다.
          </div>
        )}
      </div>

      {/* Criteria Chips */}
      {detail.criteriaLabels.length > 0 && (
        <div className="border-t border-slate-800/80 pt-2 space-y-1">
          <div className="text-[10px] font-bold text-slate-400">
            {isProgressive ? '궁합 일치 조건' : '개인 ★+1 조건'}
          </div>
          <div className="flex flex-wrap gap-1">
            {detail.criteriaLabels.map((label) => (
              <span
                key={label}
                className="rounded border border-slate-700/80 bg-slate-900/90 px-1.5 py-0.5 text-[9.5px] font-semibold text-slate-200 whitespace-nowrap"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function ManagerFitBadge({
  traitId,
  starters,
  baselineStarters = null,
  tactic = 'balanced',
  formation,
  variant = 'strip',
  showTraitName = true,
  align = 'left',
  className = '',
}: ManagerFitBadgeProps) {
  const [open, setOpen] = useState(false);
  const [shiftX, setShiftX] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const detail = useMemo(
    () => evaluateManagerFitDetail({ traitId, starters, tactic }),
    [traitId, starters, tactic],
  );

  const baselineDetail = useMemo(
    () =>
      baselineStarters
        ? evaluateManagerFitDetail({
            traitId,
            starters: baselineStarters,
            tactic,
          })
        : null,
    [traitId, baselineStarters, tactic],
  );

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const clampToViewport = () => {
      const el = popoverRef.current;
      if (!el) return;
      const prevTransform = el.style.transform;
      el.style.transform = '';
      const rect = el.getBoundingClientRect();
      el.style.transform = prevTransform;

      const margin = 12;
      let delta = 0;
      if (rect.left < margin) {
        delta = margin - rect.left;
      } else if (rect.right > window.innerWidth - margin) {
        delta = window.innerWidth - margin - rect.right;
      }
      setShiftX(Math.round(delta));
    };

    clampToViewport();
    window.addEventListener('resize', clampToViewport);
    return () => window.removeEventListener('resize', clampToViewport);
  }, [open, align]);

  if (!detail) return null;

  const isProgressive = detail.scalingMode === 'progressive';
  const countDelta =
    baselineDetail !== null
      ? detail.matchedCount - baselineDetail.matchedCount
      : 0;

  const alignClass =
    align === 'left'
      ? 'left-0'
      : align === 'center'
        ? 'left-1/2 -translate-x-1/2'
        : 'right-0';

  const isMaxReached = isProgressive && detail.matchedCount >= detail.totalSlots;
  const countText =
    countDelta !== 0 && baselineDetail
      ? `${baselineDetail.matchedCount}→${detail.matchedCount}/${detail.totalSlots}`
      : isMaxReached
        ? `${detail.matchedCount}/${detail.totalSlots} MAX`
        : `${detail.matchedCount}/${detail.totalSlots}`;

  const primaryChip = detail.activeBoostChips[0] ?? null;
  const secondaryChip = detail.activeBoostChips[1] ?? null;

  return (
    <div
      ref={rootRef}
      className={`relative ${variant === 'strip' ? 'w-full' : 'inline-flex max-w-full'} ${className}`}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setShiftX(0);
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        aria-label={`${detail.config.name} 감독 궁합 상세`}
        className={`group flex items-center justify-between gap-1.5 rounded-lg border text-left transition-colors cursor-pointer touch-manipulation ${
          variant === 'strip'
            ? 'w-full px-2 py-1 text-[10.5px]'
            : 'px-2 py-0.5 text-[10px]'
        } ${
          open
            ? 'border-amber-400/55 bg-[#121a27] text-slate-100'
            : 'border-slate-800/90 bg-[#0c131d] hover:border-slate-700 text-slate-200'
        }`}
      >
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 min-w-0">
          <span className="inline-flex items-center gap-1 font-bold text-slate-100 whitespace-nowrap">
            <Star
              className="h-3 w-3 shrink-0"
              style={{
                color: detail.config.badgeColor,
                fill: detail.config.badgeColor,
              }}
            />
            {showTraitName && (
              <span className="truncate max-w-[110px] sm:max-w-[150px] text-slate-200">
                {detail.config.name}
              </span>
            )}
          </span>

          <span
            className={`inline-flex items-center gap-0.5 rounded border px-1.5 py-px text-[10px] font-extrabold tabular-nums whitespace-nowrap ${
              countDelta > 0
                ? 'border-emerald-400/55 bg-emerald-500/20 text-emerald-200'
                : isProgressive
                  ? detail.matchedCount > 0
                    ? 'border-amber-400/40 bg-amber-500/12 text-amber-200'
                    : 'border-slate-700/80 bg-slate-900/90 text-slate-400'
                  : 'border-sky-400/35 bg-sky-500/10 text-sky-200'
            }`}
          >
            {isProgressive ? '궁합' : '개인 +1'} {countText}
          </span>

          {/* Active team boost chips (or clear non-scaling notice for situational managers) */}
          {isProgressive ? (
            <>
              {primaryChip && (
                <span className="text-[10px] font-bold text-emerald-300 tabular-nums whitespace-nowrap">
                  {primaryChip}
                </span>
              )}
              {secondaryChip && (
                <span className="hidden sm:inline text-[10px] font-semibold text-sky-300 tabular-nums whitespace-nowrap">
                  · {secondaryChip}
                </span>
              )}
              {!primaryChip && (
                <span className="text-[10px] text-slate-500 whitespace-nowrap">
                  +1명부터 팀 상승
                </span>
              )}
              {detail.synergyTacticLabel && (
                <span
                  className={`rounded px-1 py-px text-[9px] font-bold whitespace-nowrap ${
                    detail.effect.isTacticSynergyActive
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/35'
                      : 'bg-slate-900/90 text-slate-500 border border-slate-800'
                  }`}
                >
                  {detail.effect.isTacticSynergyActive
                    ? `${detail.synergyTacticLabel}✓`
                    : `+${detail.synergyTacticLabel}`}
                </span>
              )}
            </>
          ) : (
            <>
              <span className="rounded border border-slate-700/80 bg-slate-900/90 px-1.5 py-px text-[9.5px] font-bold text-slate-300 whitespace-nowrap">
                팀 효과 인원 무관
              </span>
              {secondaryChip && (
                <span className="hidden sm:inline text-[10px] font-semibold text-sky-300/90 whitespace-nowrap">
                  {secondaryChip}
                </span>
              )}
            </>
          )}
        </div>

        <ChevronDown
          className={`h-3 w-3 shrink-0 text-slate-500 transition-transform ${
            open ? 'rotate-180 text-amber-300' : 'group-hover:text-slate-300'
          }`}
        />
      </button>

      {open && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label={`${detail.config.name} 감독 궁합 상세`}
          onClick={(e) => e.stopPropagation()}
          style={
            shiftX !== 0
              ? {
                  transform:
                    align === 'center'
                      ? `translateX(calc(-50% + ${shiftX}px))`
                      : `translateX(${shiftX}px)`,
                }
              : undefined
          }
          className={`absolute top-full z-[70] mt-1.5 w-[min(22.5rem,calc(100vw-1.5rem))] max-h-[min(70dvh,27rem)] overflow-y-auto rounded-xl border border-slate-700/90 bg-[#0a1019] p-3 text-left shadow-2xl ${alignClass}`}
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-800/90 pb-1.5 mb-2">
            <span className="text-[11px] font-extrabold text-slate-100">
              감독 궁합 · 팀 능력치 효과
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded p-0.5 text-slate-500 hover:bg-slate-800 hover:text-slate-200 cursor-pointer shrink-0"
              aria-label="닫기"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {renderPopoverBody(detail, formation)}
        </div>
      )}
    </div>
  );
}
