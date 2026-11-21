import { Crown, Diamond, Shield, Sparkles, TrendingUp, X } from 'lucide-react';
import { useEffect } from 'react';
import { PLAYSTYLES } from '../../data/playstyles';
import {
  evaluatePositionFit,
  formatMainPositions,
} from '../../engine/positionEngine';
import { TACTICS } from '../../engine/tacticEngine';
import type { ManagerTraitId } from '../../types/game';
import type { PlayerSeasonStats } from '../../types/league';
import {
  getCardTier,
  LEAGUE_LABELS,
  POSITION_LABELS,
} from '../../types/player';
import type { Player, SubPosition } from '../../types/player';
import { getCountryFlag } from '../../utils/countryFlag';

interface PlayerDetailModalProps {
  player: Player | null;
  slotSubPosition?: SubPosition;
  managerTraitId?: ManagerTraitId | null;
  seasonStats?: PlayerSeasonStats | null;
  onClose: () => void;
}

export function PlayerDetailModal({
  player,
  slotSubPosition,
  managerTraitId = null,
  seasonStats = null,
  onClose,
}: PlayerDetailModalProps) {
  useEffect(() => {
    if (!player) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [player, onClose]);

  if (!player) return null;

  const tier = getCardTier(player);
  const isLegend = tier === 'legend';
  const isSuperstar = tier === 'superstar';

  const fit = slotSubPosition
    ? evaluatePositionFit(player, slotSubPosition, managerTraitId)
    : null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/82 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-md overflow-hidden rounded-2xl border bg-[#0f1621] shadow-2xl ${
          isLegend
            ? 'border-amber-400/70 shadow-[0_0_28px_rgba(251,191,36,0.22)]'
            : isSuperstar
              ? 'border-cyan-400/70 shadow-[0_0_24px_rgba(34,211,238,0.2)]'
              : 'border-slate-700'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`flex items-start justify-between gap-3 border-b px-5 py-4 ${
            isLegend
              ? 'border-amber-500/30 bg-gradient-to-r from-amber-950/60 via-[#151b26] to-[#0f1621]'
              : isSuperstar
                ? 'border-cyan-500/30 bg-gradient-to-r from-cyan-950/55 via-[#151b26] to-[#0f1621]'
                : 'border-slate-800 bg-[#0b1018]'
          }`}
        >
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {isLegend && (
                <span className="inline-flex items-center gap-1 rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-black text-slate-950">
                  <Crown className="w-3 h-3" />
                  LEGEND
                </span>
              )}
              {isSuperstar && (
                <span className="inline-flex items-center gap-1 rounded bg-cyan-300 px-1.5 py-0.5 text-[10px] font-black text-slate-950">
                  <Diamond className="w-3 h-3" />
                  SUPERSTAR
                </span>
              )}
              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-300">
                {POSITION_LABELS[player.position]}
              </span>
              <span className="text-xs text-slate-400">
                {LEAGUE_LABELS[player.leagueId]}
              </span>
            </div>

            <h3 className="truncate text-lg font-extrabold text-white">
              {player.name}
            </h3>

            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
              <span>
                {getCountryFlag(player.nationalityCode)} {player.nationality}
              </span>
              <span className="text-slate-600">·</span>
              <span className="font-semibold text-slate-200">{player.club}</span>
            </div>
          </div>

          <div className="flex items-start gap-2.5 shrink-0">
            <div className="rounded-xl border border-slate-700/80 bg-[#111822] px-3 py-1.5 text-center tabular-nums">
              <div className="text-[9px] font-bold text-slate-400">
                {fit ? '실효 OVR' : 'OVR'}
              </div>
              <div
                className={`font-display text-2xl font-bold leading-none ${
                  fit && fit.penalty < 0
                    ? fit.fit === 'secondary'
                      ? 'text-amber-300'
                      : 'text-rose-400'
                    : isLegend
                      ? 'text-amber-300'
                      : isSuperstar
                        ? 'text-cyan-200'
                        : 'text-emerald-300'
                }`}
              >
                {fit ? fit.effectiveOvr : player.ovr}
              </div>
              {fit && fit.penalty < 0 && (
                <div className="mt-0.5 text-[9px] font-bold text-slate-400">
                  기본 {player.ovr} ({fit.penalty})
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="rounded-lg border border-slate-700 bg-slate-900 p-1.5 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-4 p-5 max-h-[75vh] overflow-y-auto">
          {/* Positions & Current Slot Fit */}
          <div className="rounded-xl border border-slate-800 bg-[#0b1018] p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">주포지션 (페널티 없음)</span>
              <span className="font-bold text-emerald-300">
                {formatMainPositions(player)}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">부포지션 (-3 OVR)</span>
              <span className="font-semibold text-amber-300">
                {player.secondaryPositions.length > 0
                  ? player.secondaryPositions.join(' · ')
                  : '없음'}
              </span>
            </div>

            {fit && slotSubPosition && (
              <div className="flex items-center justify-between border-t border-slate-800/80 pt-2 text-xs">
                <span className="text-slate-400">
                  현재 슬롯 ({slotSubPosition}) 적합도
                </span>
                <span
                  className={`rounded px-2 py-0.5 text-[11px] font-bold ${
                    fit.fit === 'main'
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : fit.fit === 'secondary'
                        ? 'bg-amber-500/15 text-amber-300'
                        : 'bg-rose-500/15 text-rose-300'
                  }`}
                >
                  {fit.label}
                  {fit.penalty < 0 ? ` (${fit.penalty})` : ' (100%)'}
                </span>
              </div>
            )}
          </div>

          {/* Core Attributes (ATT / MID / DEF / STA) */}
          <div className="grid grid-cols-4 gap-2 text-center tabular-nums">
            <div className="rounded-xl border border-slate-800 bg-[#0b1018] py-2.5">
              <div className="text-[10px] font-bold text-slate-400">ATT</div>
              <div className="font-display text-xl font-bold text-white">
                {player.att}
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#0b1018] py-2.5">
              <div className="text-[10px] font-bold text-slate-400">MID</div>
              <div className="font-display text-xl font-bold text-white">
                {player.mid}
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#0b1018] py-2.5">
              <div className="text-[10px] font-bold text-slate-400">DEF</div>
              <div className="font-display text-xl font-bold text-white">
                {player.def}
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#0b1018] py-2.5">
              <div className="text-[10px] font-bold text-slate-400">체력(STA)</div>
              <div
                className={`font-display text-xl font-bold ${
                  (player.stamina ?? 82) >= 92
                    ? 'text-emerald-300'
                    : (player.stamina ?? 82) <= 75
                      ? 'text-amber-300'
                      : 'text-sky-300'
                }`}
              >
                {player.stamina ?? 82}
              </div>
            </div>
          </div>

          {/* Playstyles */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              플레이스타일 &amp; 전술 궁합
            </div>
            <div className="space-y-1.5">
              {player.playstyles.map((psId) => {
                const meta = PLAYSTYLES[psId];
                if (!meta) return null;
                return (
                  <div
                    key={psId}
                    className="rounded-xl border border-slate-800 bg-[#0b1018] p-3 space-y-1"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <span className="text-xs font-bold text-amber-300">
                        {meta.name}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {meta.bestTactics.map((tid) => (
                          <span
                            key={tid}
                            className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-semibold text-slate-300"
                          >
                            {TACTICS[tid].shortName}
                          </span>
                        ))}
                      </div>
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-400">
                      {meta.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Scout Note */}
          {player.scoutNote && (
            <div className="flex items-start gap-2 rounded-xl border border-slate-800/80 bg-slate-900/50 px-3 py-2.5 text-[11px] text-slate-300">
              <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span>{player.scoutNote}</span>
            </div>
          )}

          {/* Current Season Stats (when in season) */}
          {seasonStats && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                이번 시즌 기록
              </div>
              <div className="grid grid-cols-5 gap-1.5 rounded-xl border border-slate-800 bg-[#0b1018] p-2.5 text-center tabular-nums">
                <div>
                  <div className="text-[10px] text-slate-500">출전</div>
                  <div className="font-display text-sm font-bold text-white">
                    {seasonStats.appearances}
                    {seasonStats.subAppearances > 0 && (
                      <span className="text-[10px] text-slate-400">
                        ({seasonStats.subAppearances})
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500">출전시간</div>
                  <div className="font-display text-sm font-bold text-slate-200">
                    {seasonStats.minutesPlayed ?? 0}&apos;
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500">골 / 도움</div>
                  <div className="font-display text-sm font-bold text-emerald-300">
                    {seasonStats.goals} / {seasonStats.assists}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500">
                    {player.position === 'GK' || player.position === 'DF'
                      ? '클린시트'
                      : 'xG'}
                  </div>
                  <div className="font-display text-sm font-bold text-sky-300">
                    {player.position === 'GK' || player.position === 'DF'
                      ? seasonStats.cleanSheets
                      : seasonStats.xgSum.toFixed(1)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500">평균 평점</div>
                  <div className="font-display text-sm font-bold text-amber-300">
                    {seasonStats.appearances > 0
                      ? seasonStats.avgRating.toFixed(2)
                      : '-'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
