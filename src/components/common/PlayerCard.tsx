import { Crown, Diamond, Flame, Link2, Lock, Star } from 'lucide-react';
import { evaluateManagerPlayerSynergy } from '../../data/managerTraits';
import { PLAYSTYLES } from '../../data/playstyles';
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
import type { PlayerConditionState } from '../../types/condition';
import type { ManagerTraitId } from '../../types/game';
import { getCardTier, LEAGUE_LABELS, TIER_LABELS } from '../../types/player';
import type { CardTier, Player, SubPosition } from '../../types/player';
import { CountryFlagSvg } from './CountryFlagSvg';
import { PixelStatusIcon } from './PixelStatusIcon';

interface PlayerCardProps {
  player: Player;
  targetSubPosition?: SubPosition;
  managerTraitId?: ManagerTraitId | null;
  condition?: PlayerConditionState | null;
  onClick?: () => void;
  onConfirmAction?: () => void;
  selected?: boolean;
  disabled?: boolean;
  compact?: boolean;
  /** Ultra-compact vertical card used in draft candidate pools so pitch + candidates fit in one viewport */
  dense?: boolean;
  actionLabel?: string;
  /** When set, locks the card in place with a picked badge (e.g. picker nickname in snake draft) */
  lockedBadgeLabel?: string | null;
  /** When true, card can still be previewed on click, while confirm button stays disabled */
  disableConfirmAction?: boolean;
  /** Text displayed on the disabled confirm button while waiting for opponent turn */
  disabledActionLabel?: string | null;
  /** Live expected adjacent 4-color chemistry link count when placed in the active draft starter slot */
  expectedLinkCount?: number;
  /** Optional progressive draft budget cost (€M) displayed in draft selection cards */
  draftCostM?: number;
}

const TIER_STYLES: Record<
  CardTier,
  {
    wrapper: string;
    badge: string;
    ovrText: string;
    posBadge: string;
  }
> = {
  common: {
    wrapper: 'card-common hover:border-slate-500/60',
    badge: 'bg-slate-800 text-slate-300',
    ovrText: 'text-slate-100',
    posBadge: 'bg-slate-800/90 text-slate-200',
  },
  key: {
    wrapper: 'card-key hover:border-emerald-400/60',
    badge: 'bg-emerald-950/90 text-emerald-300',
    ovrText: 'text-emerald-300',
    posBadge: 'bg-emerald-950/80 text-emerald-200',
  },
  worldclass: {
    wrapper: 'card-worldclass hover:border-sky-400/70',
    badge: 'bg-sky-950/90 text-sky-300',
    ovrText: 'text-sky-300',
    posBadge: 'bg-sky-950/80 text-sky-200',
  },
  superstar: {
    wrapper: 'card-superstar-glow',
    badge:
      'bg-gradient-to-r from-cyan-400 via-sky-200 to-cyan-400 text-slate-950 font-extrabold',
    ovrText: 'text-cyan-200',
    posBadge: 'bg-cyan-500/20 text-cyan-200 border border-cyan-300/40',
  },
  legend: {
    wrapper: 'card-legend-glow',
    badge:
      'bg-gradient-to-r from-amber-500 via-yellow-300 to-amber-500 text-slate-950 font-extrabold',
    ovrText: 'text-amber-300',
    posBadge: 'bg-amber-500/20 text-amber-200 border border-amber-400/40',
  },
};

export function PlayerCard({
  player,
  targetSubPosition,
  managerTraitId = null,
  condition = null,
  onClick,
  onConfirmAction,
  selected = false,
  disabled = false,
  compact = false,
  dense = false,
  actionLabel,
  lockedBadgeLabel = null,
  disableConfirmAction = false,
  disabledActionLabel = null,
  expectedLinkCount,
  draftCostM,
}: PlayerCardProps) {
  const tier = getCardTier(player);
  const style = TIER_STYLES[tier];
  const isLegend = tier === 'legend';
  const isSuperstar = tier === 'superstar';
  const isAwakened = Boolean(player.awakening);
  const effectiveWrapper = isAwakened ? 'card-awakened-ember' : style.wrapper;
  const mainPosText = formatMainPositions(player);
  const isInjured = isPlayerActivelyInjured(condition);
  const moraleTier = condition ? getMoraleTier(condition.morale) : 'normal';

  const fit = targetSubPosition
    ? evaluatePositionFit(player, targetSubPosition, managerTraitId)
    : null;
  const hasPenalty = Boolean(fit && fit.penalty < 0);
  const mgrSynergy = evaluateManagerPlayerSynergy(player, managerTraitId);
  const ovrBr = computeFullPlayerOvrBreakdown({
    baseOvr: player.ovr,
    positionPenalty: fit?.penalty ?? 0,
    synergyBonus: mgrSynergy.isMatch ? 1 : 0,
    condition,
  });

  const penaltyBadgeColor =
    fit?.fit === 'secondary'
      ? 'bg-amber-500/20 text-amber-300'
      : fit?.fit === 'out_of_pos'
        ? 'bg-orange-500/25 text-orange-300'
        : 'bg-rose-500/25 text-rose-300';

  if (compact) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={ovrBr.summaryLine}
        className={`relative w-full overflow-hidden rounded-xl p-3 text-left transition-colors duration-150 ${effectiveWrapper} ${
          selected ? 'ring-2 ring-emerald-400' : ''
        } ${
          onClick && !disabled ? 'cursor-pointer' : 'cursor-default'
        } ${disabled ? 'opacity-50' : ''}`}
      >
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex flex-col items-center justify-center w-11 shrink-0">
              <span className={`font-display text-xl font-bold leading-none ${style.ovrText}`}>
                {hasPenalty && fit ? fit.effectiveOvr : player.ovr}
              </span>
              <span className="mt-1 truncate max-w-[50px] text-[9px] font-bold tracking-wide text-slate-400">
                {mainPosText}
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-bold text-slate-100">
                  {player.name}
                </span>
                {isLegend && (
                  <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                )}
                {isSuperstar && (
                  <Diamond className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                )}
                {isInjured && condition?.injury && (
                  <PixelStatusIcon
                    variant="injury"
                    size={13}
                    title={getInjuryTooltip(condition.injury)}
                  />
                )}
                {moraleTier === 'ecstatic' && (
                  <PixelStatusIcon
                    variant="morale_high"
                    size={13}
                    title={`사기 ${getMoraleLabel(condition!.morale)} (+2 OVR)`}
                  />
                )}
                {moraleTier === 'frozen' && (
                  <PixelStatusIcon
                    variant="morale_low"
                    size={13}
                    title={`사기 ${getMoraleLabel(condition!.morale)} (-2 OVR)`}
                  />
                )}
                {ovrBr.moraleBonus !== 0 && (
                  <span
                    className={`rounded px-1 py-0.5 text-[9px] font-black leading-none ${
                      ovrBr.moraleBonus > 0
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-sky-500/20 text-sky-300'
                    }`}
                  >
                    {ovrBr.moraleBonus > 0
                      ? `+${ovrBr.moraleBonus}`
                      : ovrBr.moraleBonus}
                  </span>
                )}
                {ovrBr.injuryPenalty < 0 && (
                  <span className="rounded bg-rose-500/25 border border-rose-400/50 px-1 py-0.5 text-[9px] font-black text-rose-200 leading-none">
                    {ovrBr.isUnavailableInjured
                      ? '결장'
                      : ovrBr.injuryPenalty}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 truncate mt-0.5">
                <CountryFlagSvg
                  code={player.nationalityCode}
                  nationality={player.nationality}
                  size="xs"
                />
                <span className="truncate">{player.club}</span>
                {player.secondaryPositions.length > 0 && (
                  <span className="text-[10px] text-slate-500">
                    · 부 {player.secondaryPositions.slice(0, 2).join('/')}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1 shrink-0">
            {mgrSynergy.isMatch && (
              <span
                title={mgrSynergy.reason}
                className="inline-flex items-center gap-0.5 rounded bg-amber-400/20 border border-amber-400/45 px-1.5 py-0.5 text-[9px] font-extrabold text-amber-200"
              >
                <Star className="w-2.5 h-2.5 fill-amber-300 text-amber-300" />
                감독 시너지
              </span>
            )}
            {hasPenalty && fit && (
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${penaltyBadgeColor}`}>
                {fit.penalty}
              </span>
            )}
            {player.playstyles[0] && (
              <span className="rounded bg-slate-900/90 px-1.5 py-0.5 text-[10px] font-medium text-slate-300">
                {PLAYSTYLES[player.playstyles[0]]?.shortName ?? player.playstyles[0]}
              </span>
            )}
          </div>
        </div>
      </button>
    );
  }

  if (dense) {
    return (
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        title={ovrBr.summaryLine}
        onClick={() => {
          if (!disabled) onClick?.();
        }}
        onKeyDown={(e) => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onClick?.();
          }
        }}
        className={`group relative flex flex-col justify-between gap-1.5 overflow-hidden rounded-lg p-2 text-left transition-colors duration-150 ${effectiveWrapper} ${
          selected ? 'ring-2 ring-emerald-400' : ''
        } ${
          onClick && !disabled ? 'cursor-pointer' : 'cursor-default'
        } ${lockedBadgeLabel ? 'opacity-45 grayscale-[35%]' : disabled ? 'opacity-50' : ''}`}
      >
        {(isLegend || isSuperstar) && !lockedBadgeLabel && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div
              className={`legend-shimmer-bar absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent ${
                isLegend ? 'via-amber-200/20' : 'via-cyan-200/18'
              } to-transparent`}
            />
          </div>
        )}

        {/* Row 1: OVR + Penalty + Position + Cost / Tier */}
        <div className="relative z-10 flex items-center justify-between gap-1">
          <div className="flex items-center gap-1 min-w-0 tabular-nums">
            <span className={`font-display text-lg font-bold leading-none ${isAwakened ? 'text-rose-200' : style.ovrText}`}>
              {player.ovr}
            </span>
            {hasPenalty && fit && (
              <span className={`rounded px-1 py-px text-[9px] font-bold leading-none ${penaltyBadgeColor}`}>
                {fit.penalty}
              </span>
            )}
            <span
              className={`truncate rounded px-1 py-px text-[9px] font-bold leading-none ${style.posBadge}`}
            >
              {mainPosText}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {typeof draftCostM === 'number' && (
              <span
                className="rounded border border-amber-400/30 bg-amber-500/12 px-1 py-px text-[8.5px] font-black tabular-nums text-amber-200 whitespace-nowrap"
                title={`드래프트 예산 €${draftCostM}M`}
              >
                €{draftCostM}M
              </span>
            )}
            {isAwakened && player.awakening ? (
              <span className="inline-flex items-center gap-0.5 rounded-full border border-rose-400/50 bg-rose-500/20 px-1.5 py-px text-[8.5px] font-black text-rose-200 whitespace-nowrap">
                <Flame className="w-2.5 h-2.5 text-orange-300" />
                각성+{player.awakening.ovrGain}
              </span>
            ) : isLegend || isSuperstar ? (
              <span
                className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-px text-[8.5px] shrink-0 ${style.badge}`}
              >
                {isLegend ? (
                  <>
                    <Crown className="w-2.5 h-2.5" />
                    LEGEND
                  </>
                ) : (
                  <>
                    <Diamond className="w-2.5 h-2.5" />
                    슈퍼스타
                  </>
                )}
              </span>
            ) : (
              <span className={`rounded px-1 py-px text-[8.5px] font-semibold shrink-0 ${style.badge}`}>
                {TIER_LABELS[tier]}
              </span>
            )}
          </div>
        </div>

        {/* Row 2: Flag + Name + Compact Playstyles/Manager Synergy */}
        <div className="relative z-10 space-y-1 min-w-0">
          <div className="flex items-center gap-1 min-w-0">
            <CountryFlagSvg
              code={player.nationalityCode}
              nationality={player.nationality}
              size="xs"
            />
            <h3 className="truncate text-xs font-bold text-slate-100 group-hover:text-white leading-tight">
              {player.name}
            </h3>
            {mgrSynergy.isMatch && (
              <span
                title={`감독 궁합 일치 (${mgrSynergy.reason}) · 개인 ★+1 OVR`}
                className="inline-flex shrink-0 items-center gap-0.5 rounded border border-amber-400/50 bg-amber-400/18 px-1 py-px text-[8.5px] font-extrabold text-amber-200 leading-none whitespace-nowrap"
              >
                <Star className="w-2 h-2 fill-amber-300 text-amber-300 shrink-0" />
                궁합+1
              </span>
            )}
            {typeof expectedLinkCount === 'number' && expectedLinkCount > 0 && (
              <span
                title={`현재 슬롯 배치 시 인접 연결 ${expectedLinkCount}선 (${expectedLinkCount >= 4 ? '시너지 +2' : expectedLinkCount >= 2 ? '시너지 +1' : '연결 1선'})`}
                className={`inline-flex shrink-0 items-center gap-0.5 rounded border px-1 py-px text-[8.5px] font-extrabold leading-none tabular-nums ${
                  expectedLinkCount >= 2
                    ? 'border-emerald-400/45 bg-emerald-500/15 text-emerald-200'
                    : 'border-slate-700/80 bg-slate-900/90 text-slate-300'
                }`}
              >
                <Link2 className="w-2 h-2 shrink-0" />
                {expectedLinkCount}선
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 overflow-hidden">
            {player.playstyles.slice(0, 2).map((ps) => {
              const isMatchedStyle = mgrSynergy.matchedPlaystyles.includes(ps);
              return (
                <span
                  key={ps}
                  className={`truncate rounded px-1 py-px text-[8.5px] font-semibold leading-tight ${
                    isMatchedStyle
                      ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/35'
                      : 'bg-slate-900/90 text-emerald-300/85'
                  }`}
                >
                  {PLAYSTYLES[ps]?.shortName ?? PLAYSTYLES[ps]?.name ?? ps}
                </span>
              );
            })}
          </div>
        </div>

        {/* Row 3: Inline A/M/D + Compact Action/Lock */}
        <div className="relative z-10 flex items-center justify-between gap-1.5 border-t border-slate-800/75 pt-1 tabular-nums">
          <div className="flex items-center gap-1.5 text-[9.5px] font-bold text-slate-400">
            <span>
              A<strong className="ml-0.5 font-display text-[11px] text-slate-200">{player.att}</strong>
            </span>
            <span>
              M<strong className="ml-0.5 font-display text-[11px] text-slate-200">{player.mid}</strong>
            </span>
            <span>
              D<strong className="ml-0.5 font-display text-[11px] text-slate-200">{player.def}</strong>
            </span>
          </div>

          {lockedBadgeLabel ? (
            <span className="inline-flex max-w-[92px] items-center gap-0.5 rounded border border-slate-700/80 bg-slate-950/90 px-1.5 py-0.5 text-[9px] font-extrabold text-slate-400">
              <Lock className="w-2.5 h-2.5 shrink-0" />
              <span className="truncate">{lockedBadgeLabel}</span>
            </span>
          ) : onConfirmAction && selected ? (
            disableConfirmAction ? (
              <span className="rounded border border-slate-700 bg-slate-900/90 px-1.5 py-0.5 text-[9px] font-bold text-slate-400">
                대기
              </span>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onConfirmAction();
                }}
                className={`rounded px-2 py-0.5 text-[10px] font-extrabold transition-colors cursor-pointer shrink-0 ${
                  isLegend
                    ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                    : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                }`}
              >
                확정 ✓
              </button>
            )
          ) : (
            <span className="text-[9px] font-semibold text-slate-500 group-hover:text-emerald-300 shrink-0">
              {selected ? '선택됨' : '프리뷰'}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      title={ovrBr.summaryLine}
      onClick={() => {
        if (!disabled) onClick?.();
      }}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={`group relative flex flex-col justify-between overflow-hidden rounded-xl p-3.5 text-left transition-colors duration-150 ${effectiveWrapper} ${
        selected ? 'ring-2 ring-emerald-400' : ''
      } ${
        onClick && !disabled ? 'cursor-pointer' : 'cursor-default'
      } ${lockedBadgeLabel ? 'opacity-45 grayscale-[35%]' : disabled ? 'opacity-50' : ''}`}
    >
      {/* Hologram Shimmer ONLY for Legend & Active Superstar */}
      {(isLegend || isSuperstar) && !lockedBadgeLabel && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className={`legend-shimmer-bar absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent ${
              isLegend ? 'via-amber-200/20' : 'via-cyan-200/18'
            } to-transparent`}
          />
        </div>
      )}

      {/* Top Row: OVR + Multi Main Positions + Cost / Tier */}
      <div className="relative z-10 flex items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-baseline gap-1.5">
            <span className={`font-display text-2xl font-bold leading-none ${isAwakened ? 'text-rose-200' : style.ovrText}`}>
              {player.ovr}
            </span>
            {hasPenalty && fit && (
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${penaltyBadgeColor}`}>
                → {fit.effectiveOvr} ({fit.penalty})
              </span>
            )}
            {ovrBr.moraleBonus !== 0 && (
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-black ${
                  ovrBr.moraleBonus > 0
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                    : 'bg-sky-500/20 text-sky-300 border border-sky-400/40'
                }`}
              >
                사기 {ovrBr.moraleBonus > 0 ? `+${ovrBr.moraleBonus}` : ovrBr.moraleBonus}
              </span>
            )}
            {ovrBr.injuryPenalty < 0 && (
              <span className="rounded bg-rose-500/25 border border-rose-400/50 px-1.5 py-0.5 text-[10px] font-black text-rose-200">
                부상 {ovrBr.isUnavailableInjured ? '결장' : ovrBr.injuryPenalty}
              </span>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            <span
              className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${style.posBadge}`}
            >
              {mainPosText}
            </span>
            {player.secondaryPositions.length > 0 && (
              <span className="text-[10px] text-slate-500">
                부 {player.secondaryPositions.slice(0, 2).join('/')}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          {isAwakened && player.awakening ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-rose-400/50 bg-rose-500/20 px-2 py-0.5 text-[10px] font-black text-rose-200 whitespace-nowrap">
              <Flame className="w-3 h-3 text-orange-300" />
              각성 +{player.awakening.ovrGain}
            </span>
          ) : (isLegend || isSuperstar) ? (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] shrink-0 ${style.badge}`}
            >
              {isLegend ? (
                <>
                  <Crown className="w-3 h-3" />
                  LEGEND
                </>
              ) : (
                <>
                  <Diamond className="w-3 h-3" />
                  슈퍼스타
                </>
              )}
            </span>
          ) : (
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold shrink-0 ${style.badge}`}>
              {TIER_LABELS[tier]}
            </span>
          )}
          {typeof draftCostM === 'number' && (
            <span className="rounded border border-amber-400/30 bg-amber-500/12 px-1.5 py-0.5 text-[10px] font-black tabular-nums text-amber-200 whitespace-nowrap">
              €{draftCostM}M
            </span>
          )}
        </div>
      </div>

      {/* Name, Nation, Club */}
      <div className="relative z-10 my-2.5">
        <div className="flex items-center gap-1.5">
          <h3 className="truncate text-sm font-bold text-slate-100 group-hover:text-white">
            {player.name}
          </h3>
          {isInjured && condition?.injury && (
            <PixelStatusIcon
              variant="injury"
              size={14}
              title={getInjuryTooltip(condition.injury)}
            />
          )}
          {moraleTier === 'ecstatic' && (
            <PixelStatusIcon
              variant="morale_high"
              size={14}
              title={`사기 ${getMoraleLabel(condition!.morale)} (+2 OVR)`}
            />
          )}
          {moraleTier === 'frozen' && (
            <PixelStatusIcon
              variant="morale_low"
              size={14}
              title={`사기 ${getMoraleLabel(condition!.morale)} (-2 OVR)`}
            />
          )}
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
          <CountryFlagSvg
            code={player.nationalityCode}
            nationality={player.nationality}
            size="sm"
          />
          <span className="truncate">{player.nationality}</span>
          <span className="text-slate-600">·</span>
          <span className="truncate text-slate-300">
            {isLegend ? 'ICON 와일드카드' : player.club}
          </span>
          {!isLegend && (
            <span className="text-[10px] text-slate-500 shrink-0">
              ({LEAGUE_LABELS[player.leagueId]})
            </span>
          )}
        </div>
      </div>

      {/* Playstyles + Manager Synergy Badge */}
      <div className="relative z-10 mb-2.5 flex flex-wrap gap-1">
        {mgrSynergy.isMatch && (
          <span
            title={mgrSynergy.reason}
            className="inline-flex items-center gap-1 rounded border border-amber-400/50 bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-200"
          >
            <Star className="w-2.5 h-2.5 fill-amber-300 text-amber-300" />
            감독 시너지 +1
          </span>
        )}
        {player.playstyles.map((ps) => {
          const isMatchedStyle = mgrSynergy.matchedPlaystyles.includes(ps);
          return (
            <span
              key={ps}
              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                isMatchedStyle
                  ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/35'
                  : 'bg-slate-900/90 text-emerald-300/90'
              }`}
            >
              {PLAYSTYLES[ps]?.name ?? ps}
            </span>
          );
        })}
      </div>

      {/* Clean Compact ATT / MID / DEF */}
      <div className="relative z-10 grid grid-cols-3 gap-1.5 border-t border-slate-800/80 pt-2 text-center">
        <div>
          <div className="text-[9px] text-slate-500">ATT</div>
          <div className="font-display text-sm font-bold text-slate-200">{player.att}</div>
        </div>
        <div>
          <div className="text-[9px] text-slate-500">MID</div>
          <div className="font-display text-sm font-bold text-slate-200">{player.mid}</div>
        </div>
        <div>
          <div className="text-[9px] text-slate-500">DEF</div>
          <div className="font-display text-sm font-bold text-slate-200">{player.def}</div>
        </div>
      </div>

      {lockedBadgeLabel ? (
        <div className="relative z-10 mt-2.5 flex w-full items-center justify-center gap-1 rounded-lg border border-slate-700/80 bg-slate-950/90 py-2 text-center text-xs font-extrabold text-slate-400">
          <Lock className="w-3 h-3 shrink-0" />
          <span className="truncate">선택됨 · {lockedBadgeLabel}</span>
        </div>
      ) : onConfirmAction ? (
        selected ? (
          disableConfirmAction ? (
            <button
              type="button"
              disabled
              onClick={(e) => e.stopPropagation()}
              className="relative z-10 mt-2.5 w-full rounded-lg border border-slate-700 bg-slate-900/90 py-2 text-center text-xs font-bold text-slate-400 cursor-not-allowed"
            >
              {disabledActionLabel ?? '상대 지명 중'}
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onConfirmAction();
              }}
              className={`relative z-10 mt-2.5 w-full rounded-lg py-2 text-center text-xs font-extrabold transition-colors cursor-pointer ${
                isLegend
                  ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                  : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
              }`}
            >
              {actionLabel ?? '영입하기'} 확정 ✓
            </button>
          )
        ) : (
          <div className="relative z-10 mt-2.5 w-full rounded-lg border border-slate-700/80 bg-slate-900/75 py-2 text-center text-xs font-semibold text-slate-400 group-hover:border-emerald-500/50 group-hover:text-emerald-200">
            클릭하여 피치 임시 배치 · 프리뷰
          </div>
        )
      ) : (
        actionLabel && (
          <div
            className={`relative z-10 mt-2.5 w-full rounded-lg py-1.5 text-center text-xs font-bold transition-colors ${
              isLegend
                ? 'bg-amber-400 text-slate-950 group-hover:bg-amber-300'
                : isSuperstar
                  ? 'bg-cyan-300 text-slate-950 group-hover:bg-cyan-200'
                  : 'bg-slate-800 text-slate-200 group-hover:bg-emerald-500 group-hover:text-slate-950'
            }`}
          >
            {actionLabel}
          </div>
        )
      )}
    </div>
  );
}
