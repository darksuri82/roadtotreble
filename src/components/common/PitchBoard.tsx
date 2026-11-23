import { Crown, Diamond, Info } from 'lucide-react';
import { useState } from 'react';
import { BENCH_SLOTS, FORMATIONS } from '../../data/formations';
import {
  computeFullPlayerOvrBreakdown,
  getInjuryTooltip,
  getMoraleLabel,
  getMoraleTier,
  isPlayerActivelyInjured,
} from '../../engine/conditionEngine';
import {
  evaluatePositionFit,
  formatMainPositions,
} from '../../engine/positionEngine';
import { useGame } from '../../store/GameContext';
import type { PlayerConditionMap } from '../../types/condition';
import type {
  ChemistryLineType,
  ChemistryResult,
  FormationId,
  ManagerTraitId,
} from '../../types/game';
import { getCardTier } from '../../types/player';
import type { Player, SubPosition } from '../../types/player';
import { CountryFlagSvg } from './CountryFlagSvg';
import { PixelStatusIcon } from './PixelStatusIcon';

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
  conditionByPlayerId?: PlayerConditionMap;
  highlightedPlayerIds?: Set<string>;
  disabledBenchIds?: Set<string>;
  onSlotClick?: (area: 'starter' | 'bench', index: number) => void;
  onSlotSwap?: (from: SlotRef, to: SlotRef) => void;
  onInspectPlayer?: (player: Player, slotSubPosition?: SubPosition) => void;
  showBench?: boolean;
  showChemBreakdown?: boolean;
  compact?: boolean;
  headerLabel?: string;
  headerRight?: React.ReactNode;
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
  club: '#10b981', // Vivid Emerald: Same Club / Former Clubs
  nation: '#38bdf8', // Vivid Sky Blue: Same Nationality
  style: '#f59e0b', // Vivid Gold: Complementary Playstyle Synergy
  elite: '#c084fc', // Vivid Violet: Elite Pair (88+ ↔ 88+)
};

const NAME_SUFFIX_KEEP_FIRST = new Set([
  '주니오르',
  '주니어',
  '필류',
  '네투',
  '시니어',
]);

function formatPitchDisplayName(name: string, compact: boolean): string {
  const trimmed = name.trim();
  const limit = compact ? 7 : 8;
  if (trimmed.length <= limit) return trimmed;
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    if (NAME_SUFFIX_KEEP_FIRST.has(last)) {
      return parts[0];
    }
    if (last.length >= 2 && last.length <= limit + 1) {
      return last;
    }
  }
  return trimmed;
}

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
  conditionByPlayerId: conditionProp,
  highlightedPlayerIds,
  disabledBenchIds,
  onSlotClick,
  onSlotSwap,
  onInspectPlayer,
  showBench = true,
  showChemBreakdown = true,
  compact = false,
  headerLabel,
  headerRight,
}: PitchBoardProps) {
  const { state: gameState } = useGame();
  const conditionByPlayerId =
    conditionProp ?? gameState.season?.playerConditions;
  const config = FORMATIONS[formation];
  const [draggingFrom, setDraggingFrom] = useState<SlotRef | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<SlotRef | null>(null);
  const [hoveredStarterIdx, setHoveredStarterIdx] = useState<number | null>(
    null,
  );

  const focusedStarterIdx =
    hoveredStarterIdx ??
    (selectedSlot?.area === 'starter' ? selectedSlot.index : null);

  const canDrag = Boolean(onSlotSwap);

  const handleSlotActivate = (area: 'starter' | 'bench', index: number) => {
    onSlotClick?.(area, index);
  };

  const handleDragStart = (
    e: React.DragEvent,
    area: 'starter' | 'bench',
    index: number,
  ) => {
    if (!canDrag) return;
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

  const selectedPlayer =
    selectedSlot?.area === 'starter'
      ? starters[selectedSlot.index] ?? null
      : selectedSlot?.area === 'bench'
        ? bench[selectedSlot.index] ?? null
        : null;
  const selectedSubPos =
    selectedSlot?.area === 'starter'
      ? config.slots[selectedSlot.index]?.subPosition
      : undefined;

  const formationShort =
    formation === '4-4-2-diamond'
      ? '4-4-2◇'
      : formation === '3-5-2-dm'
        ? '3-5-2 DM'
        : formation;

  return (
    <div className="flex flex-col gap-1.5">
      {/* Dedicated Top Info Header (outside pitch so ST card & crown NEVER overlap formation/chemistry badges) */}
      <div className="flex items-center justify-between gap-2 px-1 text-[11px] min-h-[22px]">
        <div className="flex items-center gap-1.5 min-w-0">
          {headerLabel && (
            <span className="truncate font-bold text-slate-200">
              {headerLabel}
            </span>
          )}
          <span className="rounded border border-slate-700/80 bg-slate-900/90 px-1.5 py-0.5 font-display text-[10px] font-bold text-slate-200 shrink-0">
            {formationShort}
          </span>
          <span className="rounded border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300/90 tabular-nums shrink-0">
            케미 {chemistry.total} ({chemistry.chemistryOvrBonus >= 0 ? '+' : ''}
            {chemistry.chemistryOvrBonus.toFixed(1)})
          </span>
        </div>
        {headerRight && <div className="shrink-0">{headerRight}</div>}
      </div>

      {/* Tap-safe Mobile Inspect Bar: appears only when a player is selected so tapping pitch cards NEVER opens detail modal by mistake */}
      {selectedPlayer && onInspectPlayer && (
        <div className="sm:hidden flex items-center justify-between gap-2 rounded-xl border border-slate-700/80 bg-slate-900/90 px-2.5 py-1.5 text-[11px]">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="rounded border border-emerald-500/40 bg-emerald-500/15 px-1.5 py-px text-[9px] font-bold text-emerald-300 shrink-0">
              선택
            </span>
            <span className="truncate font-bold text-slate-100">
              {selectedPlayer.name}
            </span>
            <span className="font-mono text-[10px] font-bold text-amber-300/90 shrink-0">
              {selectedPlayer.ovr}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onInspectPlayer(selectedPlayer, selectedSubPos)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] font-bold text-slate-200 hover:border-sky-400/50 cursor-pointer shrink-0 touch-manipulation"
          >
            <Info className="w-3 h-3" />
            선수 상세
          </button>
        </div>
      )}

      {/* Main Pitch Container */}
      <div
        className={`pitch-surface relative w-full overflow-hidden rounded-2xl border border-slate-800/90 ${
          compact
            ? 'aspect-[4/3.9] sm:aspect-[4/4.4]'
            : 'aspect-[4/4.05] sm:aspect-[4/4.3]'
        }`}
      >
        {/* SVG Pitch Markings + Vivid Multi-Line Parallel Chemistry Links */}
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
            stroke="rgba(255,255,255,0.11)"
            strokeWidth="0.5"
          />
          <line
            x1="4"
            y1="50"
            x2="96"
            y2="50"
            stroke="rgba(255,255,255,0.10)"
            strokeWidth="0.42"
          />
          <circle
            cx="50"
            cy="50"
            r="11"
            fill="none"
            stroke="rgba(255,255,255,0.10)"
            strokeWidth="0.42"
          />
          <rect
            x="24"
            y="4"
            width="52"
            height="15"
            fill="none"
            stroke="rgba(255,255,255,0.09)"
            strokeWidth="0.42"
          />
          <rect
            x="24"
            y="81"
            width="52"
            height="15"
            fill="none"
            stroke="rgba(255,255,255,0.09)"
            strokeWidth="0.42"
          />

          {chemistry.links.map((link) => {
            const fromSlot = config.slots[link.fromIndex];
            const toSlot = config.slots[link.toIndex];
            if (!fromSlot || !toSlot) return null;

            const isLinkFocused =
              focusedStarterIdx !== null &&
              (link.fromIndex === focusedStarterIdx ||
                link.toIndex === focusedStarterIdx);
            const hasAnyFocus = focusedStarterIdx !== null;

            const activeLines = link.activeLines;

            if (activeLines.length === 0) {
              return (
                <line
                  key={`${link.fromIndex}-${link.toIndex}-none`}
                  x1={fromSlot.x}
                  y1={fromSlot.y}
                  x2={toSlot.x}
                  y2={toSlot.y}
                  stroke="rgba(148, 163, 184, 0.16)"
                  strokeOpacity={hasAnyFocus ? (isLinkFocused ? 0.35 : 0.08) : 0.16}
                  strokeWidth="0.45"
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
            const spacing =
              activeLines.length >= 4
                ? 0.8
                : activeLines.length === 3
                  ? 1.0
                  : 1.12;
            const centerOffset = ((activeLines.length - 1) * spacing) / 2;
            const baseWidth =
              activeLines.length >= 4
                ? 0.6
                : activeLines.length === 3
                  ? 0.7
                  : 0.82;
            const strokeOpacity = hasAnyFocus
              ? isLinkFocused
                ? 1
                : 0.38
              : 0.88;
            const strokeWidth = hasAnyFocus
              ? isLinkFocused
                ? baseWidth + 0.16
                : baseWidth * 0.85
              : baseWidth;

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
                  strokeOpacity={strokeOpacity}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                />
              );
            });
          })}
        </svg>

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
          const isHighlightedInjury = Boolean(
            player && highlightedPlayerIds?.has(player.id),
          );
          const tier = player ? getCardTier(player) : null;
          const isLegend = tier === 'legend';
          const isSuperstar = tier === 'superstar';
          const isWorldclass = tier === 'worldclass';

          const fit = player
            ? evaluatePositionFit(
                player,
                slot.subPosition,
                managerTraitId,
                slot.alternateSubPositions,
              )
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
              ? 'border border-amber-400/45 bg-[#231a0d]/95 text-amber-200'
              : fit?.fit === 'out_of_pos'
                ? 'border border-rose-400/50 bg-[#271318]/95 text-rose-200'
                : 'border border-rose-500/60 bg-[#2b1117]/95 text-rose-200';

          const synTooltipText =
            slotSyn && slotSyn.reasons.length > 0
              ? ` · 시너지 사유: ${slotSyn.reasons.join(', ')}`
              : '';
          const starterCond = player ? conditionByPlayerId?.[player.id] : undefined;
          const starterOvrBr = player
            ? computeFullPlayerOvrBreakdown({
                baseOvr: player.ovr,
                positionPenalty: fit?.penalty ?? 0,
                synergyBonus: synBonus,
                condition: starterCond ?? null,
              })
            : null;

          return (
            <div
              key={slot.index}
              role="button"
              tabIndex={onSlotClick ? 0 : -1}
              draggable={Boolean(canDrag && player)}
              onMouseEnter={() => setHoveredStarterIdx(slot.index)}
              onMouseLeave={() =>
                setHoveredStarterIdx((prev) =>
                  prev === slot.index ? null : prev,
                )
              }
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
              style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
              title={
                player && starterOvrBr
                  ? `${player.name} (${formatMainPositions(player)}) · ${player.club}\n[${starterOvrBr.summaryLine}]${synTooltipText}${staminaPct !== null ? ` · 체력 ${staminaPct}%` : ''} (우클릭/ⓘ 상세)`
                  : `${slot.label} 빈 슬롯`
              }
              className={`group absolute -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center select-none touch-manipulation ${
                onSlotClick ? 'cursor-pointer' : 'cursor-default'
              }`}
            >
              <div
                className={`relative flex flex-col items-center justify-center text-center shadow-md transition-colors ${
                  compact
                    ? 'rounded-lg px-1.5 py-0.5 min-w-[54px] sm:min-w-[66px] max-w-[84px] sm:max-w-[94px]'
                    : 'rounded-xl px-1.5 py-1 min-w-[60px] sm:min-w-[78px] max-w-[92px] sm:max-w-[104px]'
                } ${
                  isHighlightedInjury && player
                    ? 'bg-[#261117]/95 border-2 border-rose-500 ring-2 ring-rose-400/60'
                    : isPreview && player
                      ? 'bg-[#0e221b]/95 border border-emerald-400 ring-2 ring-emerald-400/55'
                      : player
                        ? isLegend
                          ? 'bg-gradient-to-b from-amber-950/95 via-stone-900/95 to-amber-950/95 border border-amber-400/90 shadow-[0_0_12px_rgba(251,191,36,0.38)]'
                          : isSuperstar
                            ? 'bg-gradient-to-b from-cyan-950/95 via-slate-900/95 to-cyan-950/95 border border-cyan-400/85 shadow-[0_0_12px_rgba(34,211,238,0.32)]'
                            : isWorldclass
                              ? 'bg-gradient-to-b from-sky-950/90 via-[#0e1726]/95 to-sky-950/90 border border-sky-400/65 shadow-[0_0_8px_rgba(56,189,248,0.22)]'
                              : staminaPct !== null && staminaPct < 40
                                ? 'bg-[#221218]/95 border border-rose-500/70'
                                : staminaPct !== null && staminaPct < 55
                                  ? 'bg-[#1f1710]/95 border border-amber-500/60'
                                  : 'bg-[#0f1621]/95 border border-slate-700/75 hover:border-slate-500/80'
                        : isActive
                          ? 'bg-emerald-500/12 border border-emerald-400/65'
                          : 'bg-slate-950/70 border border-dashed border-slate-600/55'
                } ${isSelected ? 'ring-2 ring-emerald-400/80' : ''} ${
                  isDragOver ? 'ring-2 ring-sky-400/80' : ''
                }`}
              >
                {isHighlightedInjury && player ? (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-rose-600/90 px-1.5 py-0.2 text-[8px] font-bold text-white shadow">
                    부상 발생
                  </span>
                ) : isPreview && player ? (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-emerald-600/90 px-1.5 py-0.2 text-[8px] font-bold text-white shadow">
                    프리뷰
                  </span>
                ) : isLegend ? (
                  <Crown className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-3 h-3 text-amber-300 drop-shadow" />
                ) : isSuperstar ? (
                  <Diamond className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-3 h-3 text-cyan-300 drop-shadow" />
                ) : null}

                {hasPenalty && fit && (
                  <span
                    className={`absolute -top-2 -left-1.5 rounded px-1 text-[8px] font-bold leading-tight ${penaltyTagCls}`}
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
                    className="hidden sm:flex absolute -top-1.5 -right-1.5 h-3.5 w-3.5 items-center justify-center rounded-full border border-slate-700 bg-slate-900/95 text-slate-400 opacity-30 group-hover:opacity-100 hover:border-slate-400 hover:text-white transition-opacity cursor-pointer z-30"
                  >
                    <Info className="w-2.5 h-2.5" />
                  </button>
                )}

                {player && fit && starterOvrBr ? (
                  <>
                    {(() => {
                      const cond = starterCond;
                      const injured = isPlayerActivelyInjured(cond);
                      const mTier = cond ? getMoraleTier(cond.morale) : 'normal';
                      return (
                        <>
                          {(injured || mTier === 'ecstatic' || mTier === 'frozen') && (
                            <div className="absolute -bottom-2 -right-1.5 z-30 flex items-center gap-0.5 rounded bg-slate-950/95 px-0.5 py-0.5 border border-slate-700/80 shadow">
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
                                  title={`사기 ${getMoraleLabel(cond!.morale)} (+2 OVR)`}
                                />
                              )}
                              {mTier === 'frozen' && (
                                <PixelStatusIcon
                                  variant="morale_low"
                                  size={11}
                                  title={`사기 ${getMoraleLabel(cond!.morale)} (-2 OVR)`}
                                />
                              )}
                            </div>
                          )}
                          <div className="flex items-center justify-center gap-0.5 leading-none tabular-nums">
                            <span
                              className={`font-display font-bold ${
                                compact
                                  ? 'text-[11px] sm:text-xs'
                                  : 'text-xs sm:text-sm'
                              } ${
                                starterOvrBr.injuryPenalty < 0
                                  ? 'text-rose-300'
                                  : hasPenalty
                                    ? fit.fit === 'secondary'
                                      ? 'text-amber-300/90'
                                      : 'text-rose-300'
                                    : isLegend
                                      ? 'text-amber-300'
                                      : isSuperstar
                                        ? 'text-cyan-200'
                                        : isWorldclass
                                          ? 'text-sky-200'
                                          : 'text-slate-100'
                              }`}
                            >
                              {fit.effectiveOvr}
                            </span>
                            {synBonus > 0 && (
                              <span
                                title={`시너지 +${synBonus} (${slotSyn?.reasons.join(' · ')})`}
                                className="rounded bg-emerald-950/80 border border-emerald-500/25 px-0.5 py-px text-[7.5px] sm:text-[8px] font-bold text-emerald-300/90 leading-none"
                              >
                                +{synBonus}
                              </span>
                            )}
                            {starterOvrBr.moraleBonus !== 0 && (
                              <span
                                title={`사기 ${cond ? getMoraleLabel(cond.morale) : ''} (${starterOvrBr.moraleBonus > 0 ? `+${starterOvrBr.moraleBonus}` : starterOvrBr.moraleBonus} OVR)`}
                                className={`rounded px-0.5 py-px text-[7.5px] sm:text-[8px] font-bold leading-none ${
                                  starterOvrBr.moraleBonus > 0
                                    ? 'bg-amber-950/80 border border-amber-400/35 text-amber-200'
                                    : 'bg-sky-950/80 border border-sky-400/35 text-sky-200'
                                }`}
                              >
                                {starterOvrBr.moraleBonus > 0
                                  ? `+${starterOvrBr.moraleBonus}`
                                  : starterOvrBr.moraleBonus}
                              </span>
                            )}
                            {starterOvrBr.injuryPenalty < 0 && (
                              <span
                                title={
                                  cond?.injury
                                    ? getInjuryTooltip(cond.injury)
                                    : `부상 페널티 ${starterOvrBr.injuryPenalty} OVR`
                                }
                                className="rounded bg-rose-950/85 border border-rose-400/40 px-0.5 py-px text-[7.5px] sm:text-[8px] font-bold text-rose-200 leading-none"
                              >
                                {starterOvrBr.isUnavailableInjured
                                  ? '결장'
                                  : starterOvrBr.injuryPenalty}
                              </span>
                            )}
                            <CountryFlagSvg
                              code={player.nationalityCode}
                              nationality={player.nationality}
                              size="xs"
                            />
                          </div>
                          <span
                            className={`mt-0.5 truncate font-semibold text-slate-200 leading-tight ${
                              compact
                                ? 'max-w-[70px] sm:max-w-[84px] text-[8.5px] sm:text-[9.5px]'
                                : 'max-w-[78px] sm:max-w-[94px] text-[9px] sm:text-[10px]'
                            }`}
                          >
                            {formatPitchDisplayName(player.name, compact)}
                          </span>
                          {staminaPct !== null ? (
                            <div className="mt-1 w-full flex items-center gap-1 tabular-nums">
                              <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-950/90">
                                <div
                                  className={`h-full rounded-full transition-all ${getStaminaBarBg(staminaPct)}`}
                                  style={{ width: `${staminaPct}%` }}
                                />
                              </div>
                              <span
                                className={`text-[7.5px] font-bold leading-none ${getStaminaNumCls(staminaPct)}`}
                              >
                                {staminaPct}
                              </span>
                            </div>
                          ) : null}
                        </>
                      );
                    })()}
                  </>
                ) : (
                  <>
                    <span className="font-display text-[11px] font-bold text-slate-300">
                      {slot.label}
                    </span>
                    <span className="text-[8.5px] text-slate-400">
                      {isActive ? '선택 중' : '빈 슬롯'}
                    </span>
                  </>
                )}
              </div>
              <span className="mt-0.5 rounded bg-slate-950/80 px-1 text-[8px] font-medium text-slate-400">
                {slot.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Multi-Line Chemistry Legend (4 official synergy line colors) */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800/80 bg-[#0e141e] px-3 py-1.5 text-[10px] text-slate-400">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-0.5 w-3.5 rounded-full"
              style={{ backgroundColor: LINE_COLORS.club }}
            />
            구단·전소속
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-0.5 w-3.5 rounded-full"
              style={{ backgroundColor: LINE_COLORS.nation }}
            />
            국적
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-0.5 w-3.5 rounded-full"
              style={{ backgroundColor: LINE_COLORS.style }}
            />
            스타일
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-0.5 w-3.5 rounded-full"
              style={{ backgroundColor: LINE_COLORS.elite }}
            />
            엘리트 88+
          </span>
        </div>
        <span className="text-[10px] text-slate-500">
          {onInspectPlayer ? '호버 선 강조 · ⓘ 상세' : '호버 시 선 강조'}
        </span>
      </div>

      {/* 4-Pillar Player Synergy Breakdown */}
      {showChemBreakdown && (
        <div className="grid grid-cols-4 gap-1.5 rounded-xl border border-slate-800/80 bg-[#111822] p-2 text-center text-[10px]">
          <div className="rounded-lg bg-slate-950/60 py-1.5 px-1">
            <div className="text-emerald-400/90">구단·전소속</div>
            <div className="font-display text-xs font-bold text-white">
              {chemistry.breakdown.club} / 35
            </div>
          </div>
          <div className="rounded-lg bg-slate-950/60 py-1.5 px-1">
            <div className="text-sky-400/90">동일 국적</div>
            <div className="font-display text-xs font-bold text-white">
              {chemistry.breakdown.nation} / 20
            </div>
          </div>
          <div className="rounded-lg bg-slate-950/60 py-1.5 px-1">
            <div className="text-amber-400/90">스타일 궁합</div>
            <div className="font-display text-xs font-bold text-white">
              {chemistry.breakdown.tacticStyle} / 30
            </div>
          </div>
          <div className="rounded-lg bg-slate-950/60 py-1.5 px-1">
            <div className="text-purple-400/90">엘리트 88+</div>
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
                  className={`relative flex flex-col items-center justify-center rounded-xl p-1 sm:p-1.5 text-center select-none touch-manipulation transition-colors ${
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
                      className="hidden sm:flex absolute -top-1.5 -right-1.5 h-4 w-4 items-center justify-center rounded-full border border-slate-600 bg-slate-900/95 text-slate-300 hover:border-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer z-20"
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
                    (() => {
                      const cond = conditionByPlayerId?.[player.id];
                      const injured = isPlayerActivelyInjured(cond);
                      const mTier = cond ? getMoraleTier(cond.morale) : 'normal';
                      const benchOvrBr = computeFullPlayerOvrBreakdown({
                        baseOvr: player.ovr,
                        condition: cond ?? null,
                      });
                      return (
                        <>
                          <div
                            title={`${player.name} (${formatMainPositions(player)})\n[${benchOvrBr.summaryLine}]`}
                            className="flex flex-wrap items-center justify-center gap-0.5 tabular-nums"
                          >
                            <span
                              className={`font-display text-sm font-bold leading-tight ${
                                benchOvrBr.injuryPenalty < 0
                                  ? 'text-rose-300'
                                  : isLegend
                                    ? 'text-amber-300'
                                    : isSuperstar
                                      ? 'text-cyan-200'
                                      : 'text-white'
                              }`}
                            >
                              {player.ovr}
                            </span>
                            {benchOvrBr.moraleBonus !== 0 && (
                              <span
                                className={`rounded px-1 py-0.5 text-[8px] font-black leading-none ${
                                  benchOvrBr.moraleBonus > 0
                                    ? 'bg-amber-500/25 border border-amber-400/50 text-amber-200'
                                    : 'bg-sky-500/25 border border-sky-400/50 text-sky-200'
                                }`}
                              >
                                {benchOvrBr.moraleBonus > 0
                                  ? `+${benchOvrBr.moraleBonus}`
                                  : benchOvrBr.moraleBonus}
                              </span>
                            )}
                            {benchOvrBr.injuryPenalty < 0 && (
                              <span className="rounded bg-rose-500/30 border border-rose-400/60 px-1 py-0.5 text-[8px] font-black text-rose-200 leading-none">
                                {benchOvrBr.isUnavailableInjured
                                  ? '결장'
                                  : benchOvrBr.injuryPenalty}
                              </span>
                            )}
                            <CountryFlagSvg
                              code={player.nationalityCode}
                              nationality={player.nationality}
                              size="xs"
                            />
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
                      );
                    })()
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
