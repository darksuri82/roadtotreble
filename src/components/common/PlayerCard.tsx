import { Crown, Diamond, Star } from 'lucide-react';
import { evaluateManagerPlayerSynergy } from '../../data/managerTraits';
import { PLAYSTYLES } from '../../data/playstyles';
import {
  evaluatePositionFit,
  formatMainPositions,
} from '../../engine/positionEngine';
import type { ManagerTraitId } from '../../types/game';
import { getCardTier, LEAGUE_LABELS, TIER_LABELS } from '../../types/player';
import type { CardTier, Player, SubPosition } from '../../types/player';
import { getCountryFlag } from '../../utils/countryFlag';

interface PlayerCardProps {
  player: Player;
  targetSubPosition?: SubPosition;
  managerTraitId?: ManagerTraitId | null;
  onClick?: () => void;
  onConfirmAction?: () => void;
  selected?: boolean;
  disabled?: boolean;
  compact?: boolean;
  actionLabel?: string;
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
  onClick,
  onConfirmAction,
  selected = false,
  disabled = false,
  compact = false,
  actionLabel,
}: PlayerCardProps) {
  const tier = getCardTier(player);
  const style = TIER_STYLES[tier];
  const isLegend = tier === 'legend';
  const isSuperstar = tier === 'superstar';
  const flag = getCountryFlag(player.nationalityCode);
  const mainPosText = formatMainPositions(player);

  const fit = targetSubPosition
    ? evaluatePositionFit(player, targetSubPosition, managerTraitId)
    : null;
  const hasPenalty = Boolean(fit && fit.penalty < 0);
  const mgrSynergy = evaluateManagerPlayerSynergy(player, managerTraitId);

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
        className={`relative w-full overflow-hidden rounded-xl p-3 text-left transition-all duration-150 ${style.wrapper} ${
          selected ? 'ring-2 ring-emerald-400' : ''
        } ${
          onClick && !disabled
            ? 'cursor-pointer hover:-translate-y-0.5'
            : 'cursor-default'
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
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 truncate mt-0.5">
                <span>{flag}</span>
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

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={() => {
        if (!disabled) onClick?.();
      }}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={`group relative flex flex-col justify-between overflow-hidden rounded-xl p-3.5 text-left transition-all duration-150 ${style.wrapper} ${
        selected ? 'ring-2 ring-emerald-400 scale-[1.01]' : ''
      } ${
        onClick && !disabled
          ? 'cursor-pointer hover:-translate-y-0.5 active:translate-y-0'
          : 'cursor-default'
      } ${disabled ? 'opacity-50' : ''}`}
    >
      {/* Hologram Shimmer ONLY for Legend & Active Superstar */}
      {(isLegend || isSuperstar) && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className={`legend-shimmer-bar absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent ${
              isLegend ? 'via-amber-200/20' : 'via-cyan-200/18'
            } to-transparent`}
          />
        </div>
      )}

      {/* Top Row: OVR + Multi Main Positions + Minimal Tier */}
      <div className="relative z-10 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className={`font-display text-2xl font-bold leading-none ${style.ovrText}`}>
              {player.ovr}
            </span>
            {hasPenalty && fit && (
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${penaltyBadgeColor}`}>
                → {fit.effectiveOvr} ({fit.penalty})
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

        {(isLegend || isSuperstar) ? (
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
      </div>

      {/* Name, Nation, Club */}
      <div className="relative z-10 my-2.5">
        <h3 className="truncate text-sm font-bold text-slate-100 group-hover:text-white">
          {player.name}
        </h3>
        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
          <span>{flag}</span>
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

      {onConfirmAction ? (
        selected ? (
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
        ) : (
          <div className="relative z-10 mt-2.5 w-full rounded-lg border border-slate-700/80 bg-slate-900/75 py-1.5 text-center text-[11px] font-semibold text-slate-400 group-hover:border-slate-500 group-hover:text-slate-200">
            클릭하여 선택 · 상세 확인
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
