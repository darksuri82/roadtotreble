import { Crown, Diamond, Info } from 'lucide-react';
import { useRef, useState } from 'react';
import { BENCH_SLOTS, FORMATIONS } from '../../data/formations';
import {
  evaluatePositionFit,
  formatMainPositions,
} from '../../engine/positionEngine';
import type {
  ChemistryLineType,
  ChemistryResult,
  FormationId,
  ManagerTraitId,
} from '../../types/game';
import { getCardTier } from '../../types/player';
import type { Player, SubPosition } from '../../types/player';
import { getCountryFlag } from '../../utils/countryFlag';

export interface SlotRef {
  area: 'starter' | 'bench';
  index: number;
}

interface PitchBoardProps {
  formation: FormationId;
  starters: (Player | null)[];
  bench: (Player | null)[];
  chemistry: ChemistryResult;
  managerTraitId?: ManagerTraitId | null;
  activeSlot?: SlotRef | null;
  selectedSlot?: SlotRef | null;
  previewSlot?: SlotRef | null;
  staminaByPlayerId?: Record<string, number>;
  disabledBenchIds?: Set<string>;
  onSlotClick?: (area: 'starter' | 'bench', index: number) => void;
  onSlotSwap?: (from: SlotRef, to: SlotRef) => void;
  onInspectPlayer?: (player: Player, slotSubPosition?: SubPosition) => void;
  showBench?: boolean;
  showChemBreakdown?: boolean;
  compact?: boolean;
}

function getStaminaBarBg(pct: number): string {
  if (pct >= 70) return 'bg-emerald-400';
  if (pct >= 55) return 'bg-yellow-400';
  if (pct >= 40) return 'bg-orange-400';
  return 'bg-rose-500';
}

function getStaminaNumCls(pct: number): string {
  if (pct >= 70) return 'text-emerald-300';
  if (pct >= 55) return 'text-yellow-300';
  if (pct >= 40) return 'text-orange-300';
  return 'text-rose-400';
}

const LINE_COLORS: Record<ChemistryLineType, string> = {
  club: '#10b981', // Emerald: Same Club / Legend wildcard
  nation: '#38bdf8', // Sky Blue: Same Nationality
  style: '#f59e0b', // Gold: Playstyle / Tactic Synergy
};

export function PitchBoard({
  formation,
  starters,
  bench,
  chemistry,
  managerTraitId = null,
  activeSlot = null,
  selectedSlot = null,
  previewSlot = null,
  staminaByPlayerId,
  disabledBenchIds,
  onSlotClick,
  onSlotSwap,
  onInspectPlayer,
  showBench = true,
  showChemBreakdown = true,
  compact = false,
}: PitchBoardProps) {
  const config = FORMATIONS[formation];
  const [draggingFrom, setDraggingFrom] = useState<SlotRef | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<SlotRef | null>(null);

  // Mobile long-press inspection timer without interfering with click-to-swap
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);

  const canDrag = Boolean(onSlotSwap);

  const clearLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleTouchStartInspect = (
    player: Player | null,
    subPos?: SubPosition,
  ) => {
    if (!player || !onInspectPlayer) return;
    longPressTriggeredRef.current = false;
    clearLongPress();
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      onInspectPlayer(player, subPos);
    }, 450);
  };

  const handleSlotActivate = (area: 'starter' | 'bench', index: number) => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }
    onSlotClick?.(area, index);
  };

  const handleDragStart = (
    e: React.DragEvent,
    area: 'starter' | 'bench',
    index: number,
  ) => {
    if (!canDrag) return;
    clearLongPress();
    setDraggingFrom({ area, index });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `${area}:${index}`);
  };

  const handleDragOver = (
    e: React.DragEvent,
    area: 'starter' | 'bench',
    index: number,
  ) => {
    if (!canDrag || !draggingFrom) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverSlot?.area !== area || dragOverSlot?.index !== index) {
      setDragOverSlot({ area, index });
    }
  };

  const handleDrop = (
    e: React.DragEvent,
    area: 'starter' | 'bench',
    index: number,
  ) => {
    if (!canDrag || !onSlotSwap) return;
    e.preventDefault();
    const from = draggingFrom;
    setDraggingFrom(null);
    setDragOverSlot(null);
    if (from && (from.area !== area || from.index !== index)) {
      onSlotSwap(from, { area, index });
    }
  };

  const handleDragEnd = () => {
    setDraggingFrom(null);
    setDragOverSlot(null);
  };

  return (
    <div className="flex flex-col gap-2.5">
      {/* Main Pitch Container */}
      <div
        className={`pitch-surface relative w-full overflow-hidden rounded-2xl border border-slate-800 ${
          compact ? 'aspect-[4/4.5]' : 'aspect-[4/4.8] sm:aspect-[4/4.3]'
        }`}
      >
        {/* SVG Pitch Markings + Multi-Line Parallel Chemistry Links */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <rect
            x="4"
            y="4"
            width="92"
            height="92"
            rx="1.5"
            fill="none"
            stroke="rgba(255,255,255,0.13)"
            strokeWidth="0.55"
          />
          <line
            x1="4"
            y1="50"
            x2="96"
            y2="50"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="0.45"
          />
          <circle
            cx="50"
            cy="50"
            r="11"
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="0.45"
          />
          <rect
            x="24"
            y="4"
            width="52"
            height="15"
            fill="none"
            stroke="rgba(255,255,255,0.11)"
            strokeWidth="0.45"
          />
          <rect
            x="24"
            y="81"
            width="52"
            height="15"
            fill="none"
            stroke="rgba(255,255,255,0.11)"
            strokeWidth="0.45"
          />

          {chemistry.links.map((link) => {
            const fromSlot = config.slots[link.fromIndex];
            const toSlot = config.slots[link.toIndex];
            if (!fromSlot || !toSlot) return null;

            const activeLines = link.activeLines;

            if (activeLines.length === 0) {
              return (
                <line
                  key={`${link.fromIndex}-${link.toIndex}-none`}
                  x1={fromSlot.x}
                  y1={fromSlot.y}
                  x2={toSlot.x}
                  y2={toSlot.y}
                  stroke="rgba(148, 163, 184, 0.18)"
                  strokeWidth="0.5"
                  strokeDasharray="2 3"
                  strokeLinecap="round"
                />
              );
            }

            // Compute perpendicular unit normal vector for crisp parallel offset lines
            const dx = toSlot.x - fromSlot.x;
            const dy = toSlot.y - fromSlot.y;
            const len = Math.hypot(dx, dy) || 1;
            const nx = -dy / len;
            const ny = dx / len;
            const spacing = activeLines.length === 3 ? 1.05 : 1.15;
            const centerOffset = ((activeLines.length - 1) * spacing) / 2;

            return activeLines.map((lineType, lineIdx) => {
              const offset = lineIdx * spacing - centerOffset;
              return (
                <line
                  key={`${link.fromIndex}-${link.toIndex}-${lineType}`}
                  x1={fromSlot.x + nx * offset}
                  y1={fromSlot.y + ny * offset}
                  x2={toSlot.x + nx * offset}
                  y2={toSlot.y + ny * offset}
                  stroke={LINE_COLORS[lineType]}
                  strokeOpacity={0.92}
                  strokeWidth={activeLines.length === 3 ? '0.72' : '0.85'}
                  strokeLinecap="round"
                />
              );
            });
          })}
        </svg>

        {/* Minimal Top Overlay */}
        <div className="pointer-events-none absolute left-3 top-2.5 z-10 flex items-center gap-2">
          <span className="rounded bg-slate-950/85 px-2 py-0.5 font-display text-xs font-bold text-slate-100">
            {formation}
          </span>
          <span className="rounded bg-slate-950/85 px-2 py-0.5 text-[11px] font-semibold text-emerald-300 tabular-nums">
            케미 {chemistry.total} ({chemistry.chemistryOvrBonus >= 0 ? '+' : ''}
            {chemistry.chemistryOvrBonus.toFixed(1)})
          </span>
        </div>

        {/* 11 Starter Nodes */}
        {config.slots.map((slot) => {
          const player = starters[slot.index];
          const isActive =
            activeSlot?.area === 'starter' && activeSlot.index === slot.index;
          const isSelected =
            selectedSlot?.area === 'starter' &&
            selectedSlot.index === slot.index;
          const isPreview =
            previewSlot?.area === 'starter' &&
            previewSlot.index === slot.index;
          const isDragOver =
            dragOverSlot?.area === 'starter' &&
            dragOverSlot.index === slot.index;
          const tier = player ? getCardTier(player) : null;
          const isLegend = tier === 'legend';
          const isSuperstar = tier === 'superstar';

          const fit = player
            ? evaluatePositionFit(player, slot.subPosition, managerTraitId)
            : null;
          const slotSyn = player ? chemistry.slotSynergies?.[slot.index] : undefined;
          const synBonus = slotSyn?.totalBonus ?? 0;
          const hasPenalty = Boolean(fit && fit.penalty < 0);
          const staminaPct =
            player && staminaByPlayerId !== undefined
              ? (staminaByPlayerId[player.id] ?? 100)
              : null;

          const penaltyTagCls =
            fit?.fit === 'secondary'
              ? 'bg-amber-400 text-slate-950'
              : fit?.fit === 'out_of_pos'
                ? 'bg-orange-500 text-white'
                : 'bg-rose-600 text-white';

          const synTooltipText =
            slotSyn && slotSyn.reasons.length > 0
              ? ` · 시너지 +${slotSyn.totalBonus} (${slotSyn.reasons.join(', ')})`
              : '';

          return (
            <div
              key={slot.index}
              role="button"
              tabIndex={onSlotClick ? 0 : -1}
              draggable={Boolean(canDrag && player)}
              onDragStart={(e) => handleDragStart(e, 'starter', slot.index)}
              onDragOver={(e) => handleDragOver(e, 'starter', slot.index)}
              onDrop={(e) => handleDrop(e, 'starter', slot.index)}
              onDragEnd={handleDragEnd}
              onClick={() => handleSlotActivate('starter', slot.index)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleSlotActivate('starter', slot.index);
                }
              }}
              onContextMenu={(e) => {
                if (player && onInspectPlayer) {
                  e.preventDefault();
                  onInspectPlayer(player, slot.subPosition);
                }
              }}
              onTouchStart={() =>
                handleTouchStartInspect(player, slot.subPosition)
              }
              onTouchEnd={clearLongPress}
              onTouchMove={clearLongPress}
              onTouchCancel={clearLongPress}
              style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
              title={
                player
                  ? `${player.name} (${formatMainPositions(player)}) · ${player.club}${synTooltipText}${staminaPct !== null ? ` · 체력 ${staminaPct}%` : ''} (우클릭/ⓘ 상세)`
                  : `${slot.label} 빈 슬롯`
              }
              className={`group absolute -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center select-none ${
                onSlotClick ? 'cursor-pointer' : 'cursor-default'
              }`}
            >
              <div
                className={`relative flex flex-col items-center justify-center rounded-xl px-1.5 py-1 min-w-[60px] sm:min-w-[74px] text-center shadow-md transition-colors ${
                  isPreview && player
                    ? 'bg-emerald-950/95 border-2 border-emerald-300 ring-2 ring-emerald-400/80 shadow-[0_0_16px_rgba(16,185,129,0.55)]'
                    : player
                      ? isLegend
                        ? 'bg-gradient-to-b from-amber-950 via-stone-900 to-amber-950 border-2 border-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.5)]'
                        : isSuperstar
                          ? 'bg-gradient-to-b from-cyan-950 via-slate-900 to-cyan-950 border-2 border-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.42)]'
                          : staminaPct !== null && staminaPct < 40
                            ? 'bg-[#251018]/95 border-2 border-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.45)]'
                            : staminaPct !== null && staminaPct < 55
                              ? 'bg-[#22170e]/95 border border-orange-400/90'
                              : 'bg-[#101822]/95 border border-slate-600/75'
                      : isActive
                        ? 'bg-emerald-500/20 border-2 border-emerald-400'
                        : 'bg-slate-950/70 border border-dashed border-slate-600/60'
                } ${isSelected ? 'ring-2 ring-emerald-400' : ''} ${
                  isDragOver ? 'ring-2 ring-sky-400' : ''
                }`}
              >
                {isPreview && player ? (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-emerald-400 px-1 py-0.2 text-[8px] font-black text-slate-950 shadow">
                    프리뷰
                  </span>
                ) : isLegend ? (
                  <Crown className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 text-amber-300" />
                ) : isSuperstar ? (
                  <Diamond className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 text-cyan-300" />
                ) : null}

                {hasPenalty && fit && (
                  <span
                    className={`absolute -top-2 -left-1.5 rounded px-1 text-[8px] font-black leading-tight ${penaltyTagCls}`}
                  >
                    {fit.penalty}
                  </span>
                )}

                {player && onInspectPlayer && (
                  <button
                    type="button"
                    aria-label={`${player.name} 상세 정보`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onInspectPlayer(player, slot.subPosition);
                    }}
                    onTouchStart={(e) => e.stopPropagation()}
                    className="absolute -top-2 -right-2 flex h-4 w-4 items-center justify-center rounded-full border border-slate-600 bg-slate-900/95 text-slate-300 hover:border-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer z-30"
                  >
                    <Info className="w-2.5 h-2.5" />
                  </button>
                )}

                {player && fit ? (
                  <>
                    <div className="flex items-center gap-0.5 leading-none tabular-nums">
                      <span
                        className={`font-display text-sm sm:text-base font-bold ${
                          hasPenalty
                            ? fit.fit === 'secondary'
                              ? 'text-amber-300'
                              : fit.fit === 'out_of_pos'
                                ? 'text-orange-400'
                                : 'text-rose-400'
                            : isLegend
                              ? 'text-amber-300'
                              : isSuperstar
                                ? 'text-cyan-200'
                                : 'text-white'
                        }`}
                      >
                        {fit.effectiveOvr}
                      </span>
                      {synBonus > 0 && (
                        <span
                          title={slotSyn?.reasons.join(' · ')}
                          className="rounded bg-emerald-500/25 border border-emerald-400/50 px-1 py-0.5 text-[8px] sm:text-[9px] font-black text-emerald-300 leading-none"
                        >
                          +{synBonus}
                        </span>
                      )}
                      <span className="text-[10px]">
                        {getCountryFlag(player.nationalityCode)}
                      </span>
                    </div>
                    <span className="mt-0.5 max-w-[66px] sm:max-w-[82px] truncate text-[9px] sm:text-[10px] font-bold text-slate-100 leading-tight">
                      {player.name}
                    </span>
                    {staminaPct !== null && (
                      <div className="mt-1 w-full flex items-center gap-1 tabular-nums">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-950/90">
                          <div
                            className={`h-full rounded-full transition-all ${getStaminaBarBg(staminaPct)}`}
                            style={{ width: `${staminaPct}%` }}
                          />
                        </div>
                        <span
                          className={`text-[8px] font-black leading-none ${getStaminaNumCls(staminaPct)}`}
                        >
                          {staminaPct}
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <span className="font-display text-xs font-bold text-slate-300">
                      {slot.label}
                    </span>
                    <span className="text-[9px] text-slate-400">
                      {isActive ? '선택 중' : '빈 슬롯'}
                    </span>
                  </>
                )}
              </div>
              <span className="mt-0.5 rounded bg-slate-950/85 px-1.5 text-[9px] font-bold text-slate-300">
                {slot.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Multi-Line Chemistry Legend (3 parallel line colors) */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800/80 bg-[#111822] px-3 py-2 text-[11px] text-slate-300">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full bg-emerald-400" />
            구단·레전드
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full bg-sky-400" />
            국적
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full bg-amber-400" />
            플레이스타일 시너지
          </span>
        </div>
        <span className="text-[10px] text-slate-500">
          {onInspectPlayer ? '우클릭 · ⓘ 선수 상세' : '중복 충족 시 다중 병렬선'}
        </span>
      </div>

      {/* 4-Pillar Chemistry Breakdown (NO Same League) */}
      {showChemBreakdown && (
        <div className="grid grid-cols-4 gap-1.5 rounded-xl border border-slate-800/80 bg-[#111822] p-2 text-center text-[10px]">
          <div className="rounded-lg bg-slate-950/60 py-1.5 px-1">
            <div className="text-emerald-400/90">동일 구단</div>
            <div className="font-display text-xs font-bold text-white">
              {chemistry.breakdown.club} / 25
            </div>
          </div>
          <div className="rounded-lg bg-slate-950/60 py-1.5 px-1">
            <div className="text-sky-400/90">동일 국적</div>
            <div className="font-display text-xs font-bold text-white">
              {chemistry.breakdown.nation} / 20
            </div>
          </div>
          <div className="rounded-lg bg-slate-950/60 py-1.5 px-1">
            <div className="text-amber-400/90">전술·스타일</div>
            <div className="font-display text-xs font-bold text-white">
              {chemistry.breakdown.tacticStyle} / 40
            </div>
          </div>
          <div className="rounded-lg bg-slate-950/60 py-1.5 px-1">
            <div className="text-slate-400">역할 균형</div>
            <div className="font-display text-xs font-bold text-white">
              {chemistry.breakdown.roleBalance} / 15
            </div>
          </div>
        </div>
      )}

      {/* Bench Row (5 slots) */}
      {showBench && (
        <div className="rounded-xl border border-slate-800/80 bg-[#111822] p-2.5">
          <div className="mb-2 flex items-center justify-between text-[11px]">
            <span className="font-bold text-slate-300">벤치 스쿼드</span>
            <span className="text-slate-500 tabular-nums">
              {bench.filter(Boolean).length} / 5
            </span>
          </div>

          <div className="grid grid-cols-5 gap-1.5">
            {BENCH_SLOTS.map((bSlot) => {
              const player = bench[bSlot.index];
              const isDisabledBench = Boolean(
                player && disabledBenchIds?.has(player.id),
              );
              const isActive =
                activeSlot?.area === 'bench' &&
                activeSlot.index === bSlot.index;
              const isSelected =
                selectedSlot?.area === 'bench' &&
                selectedSlot.index === bSlot.index;
              const isPreview =
                previewSlot?.area === 'bench' &&
                previewSlot.index === bSlot.index;
              const isDragOver =
                dragOverSlot?.area === 'bench' &&
                dragOverSlot.index === bSlot.index;
              const tier = player ? getCardTier(player) : null;
              const isLegend = tier === 'legend';
              const isSuperstar = tier === 'superstar';
              const benchStaminaPct =
                player && staminaByPlayerId !== undefined
                  ? (staminaByPlayerId[player.id] ?? 100)
                  : null;

              return (
                <div
                  key={bSlot.index}
                  role="button"
                  tabIndex={onSlotClick && !isDisabledBench ? 0 : -1}
                  draggable={Boolean(canDrag && player && !isDisabledBench)}
                  onDragStart={(e) => {
                    if (isDisabledBench) return;
                    handleDragStart(e, 'bench', bSlot.index);
                  }}
                  onDragOver={(e) => {
                    if (isDisabledBench) return;
                    handleDragOver(e, 'bench', bSlot.index);
                  }}
                  onDrop={(e) => {
                    if (isDisabledBench) return;
                    handleDrop(e, 'bench', bSlot.index);
                  }}
                  onDragEnd={handleDragEnd}
                  onClick={() => {
                    if (isDisabledBench) return;
                    handleSlotActivate('bench', bSlot.index);
                  }}
                  onKeyDown={(e) => {
                    if (isDisabledBench) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSlotActivate('bench', bSlot.index);
                    }
                  }}
                  onContextMenu={(e) => {
                    if (player && onInspectPlayer) {
                      e.preventDefault();
                      onInspectPlayer(player);
                    }
                  }}
                  onTouchStart={() => handleTouchStartInspect(player)}
                  onTouchEnd={clearLongPress}
                  onTouchMove={clearLongPress}
                  onTouchCancel={clearLongPress}
                  className={`relative flex flex-col items-center justify-center rounded-xl p-1.5 text-center select-none transition-all ${
                    isDisabledBench
                      ? 'bg-slate-950/70 border border-slate-800 opacity-45 cursor-not-allowed'
                      : isPreview && player
                        ? 'bg-emerald-950/90 border-2 border-emerald-300 ring-2 ring-emerald-400/75 shadow-[0_0_12px_rgba(16,185,129,0.45)]'
                        : player
                          ? isLegend
                            ? 'bg-amber-950/45 border border-amber-400'
                            : isSuperstar
                              ? 'bg-cyan-950/45 border border-cyan-300'
                              : 'bg-slate-900/90 border border-slate-700/80'
                          : isActive
                            ? 'bg-emerald-500/15 border-2 border-emerald-400'
                            : 'bg-slate-950/60 border border-dashed border-slate-700/60'
                  } ${
                    onSlotClick && !isDisabledBench
                      ? 'cursor-pointer hover:border-emerald-400/70'
                      : isDisabledBench
                        ? 'cursor-not-allowed'
                        : 'cursor-default'
                  } ${isSelected ? 'ring-2 ring-emerald-400' : ''} ${
                    isDragOver ? 'ring-2 ring-sky-400' : ''
                  }`}
                >
                  {isPreview && player && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-emerald-400 px-1 text-[7px] font-black text-slate-950">
                      프리뷰
                    </span>
                  )}
                  {player && onInspectPlayer && (
                    <button
                      type="button"
                      aria-label={`${player.name} 상세 정보`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onInspectPlayer(player);
                      }}
                      onTouchStart={(e) => e.stopPropagation()}
                      className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-slate-600 bg-slate-900/95 text-slate-300 hover:border-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer z-20"
                    >
                      <Info className="w-2.5 h-2.5" />
                    </button>
                  )}

                  {isDisabledBench && (
                    <span className="absolute -top-1.5 -left-1 rounded bg-slate-700 px-1 text-[8px] font-black text-slate-200">
                      OUT
                    </span>
                  )}

                  <span className="truncate max-w-full text-[9px] font-bold text-slate-400">
                    {player ? formatMainPositions(player) : bSlot.label}
                  </span>
                  {player ? (
                    <>
                      <span
                        className={`font-display text-sm font-bold leading-tight ${
                          isLegend
                            ? 'text-amber-300'
                            : isSuperstar
                              ? 'text-cyan-200'
                              : 'text-white'
                        }`}
                      >
                        {player.ovr}
                      </span>
                      <span className="w-full truncate text-[10px] font-semibold text-slate-200">
                        {player.name}
                      </span>
                      {benchStaminaPct !== null && (
                        <div className="mt-1 w-full flex items-center gap-1 tabular-nums">
                          <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-950">
                            <div
                              className={`h-full rounded-full ${
                                isDisabledBench
                                  ? 'bg-slate-600'
                                  : getStaminaBarBg(benchStaminaPct)
                              }`}
                              style={{ width: `${benchStaminaPct}%` }}
                            />
                          </div>
                          <span
                            className={`text-[8px] font-black leading-none ${
                              isDisabledBench
                                ? 'text-slate-500'
                                : getStaminaNumCls(benchStaminaPct)
                            }`}
                          >
                            {benchStaminaPct}%
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="mt-1 text-[10px] text-slate-500">
                      {isActive ? '선택 중' : '대기'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
