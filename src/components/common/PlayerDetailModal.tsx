import { ArrowRight, Crown, Diamond, Shield, Sparkles, Star, TrendingUp, Trophy, X } from 'lucide-react';
import { useEffect } from 'react';
import { evaluateManagerPlayerSynergy } from '../../data/managerTraits';
import { PLAYSTYLES } from '../../data/playstyles';
import {
  computeFullPlayerOvrBreakdown,
  getInjuryOvrPenalty,
  getInjuryTooltip,
  getMoraleLabel,
  getMoraleOvrBonus,
  getMoraleTier,
  isPlayerActivelyInjured,
  isPlayerRecoveringRust,
} from '../../engine/conditionEngine';
import {
  evaluatePositionFit,
  formatMainPositions,
} from '../../engine/positionEngine';
import { TACTICS } from '../../engine/tacticEngine';
import { useGame } from '../../store/GameContext';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import type { PlayerConditionState } from '../../types/condition';
import type { ManagerTraitId, PlayerSlotSynergy } from '../../types/game';
import type { PlayerSeasonStats } from '../../types/league';
import {
  getCardTier,
  LEAGUE_LABELS,
  POSITION_LABELS,
} from '../../types/player';
import type { Player, SubPosition } from '../../types/player';
import type { PlayerCompetitionStatsBreakdown } from '../../utils/playerLookup';
import { CountryFlagSvg } from './CountryFlagSvg';
import { PixelStatusIcon } from './PixelStatusIcon';
import { PlayerSubAttributesCard } from './PlayerSubAttributesCard';

interface PlayerDetailModalProps {
  player: Player | null;
  slotSubPosition?: SubPosition;
  slotSynergy?: PlayerSlotSynergy | null;
  managerTraitId?: ManagerTraitId | null;
  seasonStats?: PlayerSeasonStats | null;
  competitionStats?: PlayerCompetitionStatsBreakdown | null;
  condition?: PlayerConditionState | null;
  onClose: () => void;
}

export function PlayerDetailModal({
  player,
  slotSubPosition,
  slotSynergy = null,
  managerTraitId = null,
  seasonStats = null,
  competitionStats = null,
  condition: conditionProp = null,
  onClose,
}: PlayerDetailModalProps) {
  const { state } = useGame();
  useBodyScrollLock(Boolean(player));
  const condition =
    conditionProp ??
    (player ? (state.season?.playerConditions?.[player.id] ?? null) : null);

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
  const mgrSynergy = evaluateManagerPlayerSynergy(player, managerTraitId);
  const synBonus = slotSynergy?.totalBonus ?? (mgrSynergy.isMatch ? 1 : 0);
  const ovrBr = computeFullPlayerOvrBreakdown({
    baseOvr: player.ovr,
    positionPenalty: fit?.penalty ?? 0,
    synergyBonus: synBonus,
    condition,
  });
  const displayOvr = ovrBr.finalEffectiveOvr;
  const hasAnyOvrMod =
    ovrBr.positionPenalty !== 0 ||
    ovrBr.synergyBonus !== 0 ||
    ovrBr.moraleBonus !== 0 ||
    ovrBr.injuryPenalty !== 0;
  const clubHonors = competitionStats?.clubSeasonHonors ?? [];

  const transferHistory =
    competitionStats?.transferHistory ??
    seasonStats?.transferHistory ??
    [];
  const displayClub =
    competitionStats?.currentClubName ??
    seasonStats?.teamName ??
    player.club;

  const hasBreakdown = Boolean(
    competitionStats &&
      (competitionStats.league ||
        competitionStats.cup ||
        competitionStats.ucl ||
        competitionStats.total),
  );
  const isDefenderOrGk = player.position === 'GK' || player.position === 'DF';

  const breakdownRows: {
    label: string;
    st: PlayerSeasonStats | null;
    isTotal?: boolean;
  }[] = competitionStats
    ? [
        { label: '리그', st: competitionStats.league },
        { label: '자국 컵', st: competitionStats.cup },
        { label: '챔피언스리그', st: competitionStats.ucl },
        { label: '시즌 통합', st: competitionStats.total, isTotal: true },
      ]
    : [];

  return (
    <div
      className="modal-backdrop fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/85 p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className={`modal-panel flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border bg-[#0f1621] shadow-2xl ${
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
          className={`flex shrink-0 items-start justify-between gap-3 border-b px-5 py-4 ${
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
              {mgrSynergy.isMatch && (
                <span
                  title={mgrSynergy.reason}
                  className="inline-flex items-center gap-0.5 rounded bg-amber-400/20 border border-amber-400/40 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-200"
                >
                  <Star className="w-2.5 h-2.5 fill-amber-300 text-amber-300" />
                  감독 궁합 +{mgrSynergy.bonus}
                </span>
              )}
            </div>

            <h3 className="truncate text-lg font-extrabold text-white">
              {player.name}
            </h3>

            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
              <span className="inline-flex items-center gap-1.5">
                <CountryFlagSvg
                  code={player.nationalityCode}
                  nationality={player.nationality}
                  size="sm"
                />
                {player.nationality}
              </span>
              <span className="text-slate-600">·</span>
              <span className="font-semibold text-slate-200">{displayClub}</span>
            </div>

            {player.formerClubs && player.formerClubs.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 pt-0.5">
                <span className="text-[10px] font-bold text-slate-500">전 소속</span>
                {player.formerClubs.map((fc) => (
                  <span
                    key={fc}
                    className="rounded bg-slate-800/80 border border-slate-700/70 px-1.5 py-0.5 text-[10px] font-semibold text-slate-300"
                  >
                    {fc}
                  </span>
                ))}
              </div>
            )}

            {/* Season Club Honors (League rank / Cup / UCL) */}
            {clubHonors.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 pt-0.5">
                {clubHonors.map((honor) => (
                  <span
                    key={honor}
                    className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                      honor.includes('우승')
                        ? 'bg-amber-500/20 text-amber-200 border border-amber-400/35'
                        : 'bg-slate-800/90 text-slate-300'
                    }`}
                  >
                    {honor.includes('우승') && (
                      <Trophy className="w-2.5 h-2.5 text-amber-300" />
                    )}
                    {honor}
                  </span>
                ))}
              </div>
            )}

            {/* Mid-season Transfer / Trade History Badge */}
            {transferHistory.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {transferHistory.map((tr, idx) => {
                  const isTrade = tr.type === 'trade';
                  return (
                    <span
                      key={`${tr.fromClubId}-${tr.toClubId}-${tr.round}-${idx}`}
                      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold ${
                        isTrade
                          ? 'border-sky-400/45 bg-sky-500/15 text-sky-200'
                          : 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200'
                      }`}
                    >
                      {isTrade && (
                        <span className="rounded bg-sky-400/20 px-1 py-px text-[9px] font-black text-sky-300">
                          🔄 트레이드
                        </span>
                      )}
                      <span>{tr.fromClubName}</span>
                      <ArrowRight
                        className={`w-2.5 h-2.5 ${
                          isTrade ? 'text-sky-400' : 'text-emerald-400'
                        }`}
                      />
                      <span>{tr.toClubName}</span>
                      <span
                        className={
                          isTrade ? 'text-sky-300/80' : 'text-emerald-400/80'
                        }
                      >
                        (
                        {tr.windowLabel ??
                          (tr.competition === 'ucl'
                            ? 'UCL 특별'
                            : `${tr.round}R`)}
                        )
                      </span>
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-start gap-2.5 shrink-0">
            <div className="rounded-xl border border-slate-700/80 bg-[#111822] px-3 py-1.5 text-center tabular-nums">
              <div className="text-[9px] font-bold text-slate-400">
                {hasAnyOvrMod ? '최종 실효 OVR' : 'OVR'}
              </div>
              <div className="flex flex-wrap items-baseline justify-center gap-1">
                <span
                  className={`font-display text-2xl font-bold leading-none ${
                    ovrBr.injuryPenalty < 0
                      ? 'text-rose-300'
                      : fit && fit.penalty < 0 && synBonus === 0
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
                  {displayOvr}
                </span>
                {synBonus > 0 && (
                  <span className="rounded bg-emerald-500/20 px-1 py-0.5 text-[10px] font-black text-emerald-300">
                    +{synBonus}
                  </span>
                )}
                {ovrBr.moraleBonus !== 0 && (
                  <span
                    className={`rounded px-1 py-0.5 text-[10px] font-black ${
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
                  <span className="rounded bg-rose-500/25 px-1 py-0.5 text-[10px] font-black text-rose-300">
                    {ovrBr.isUnavailableInjured ? '결장' : ovrBr.injuryPenalty}
                  </span>
                )}
              </div>
              {hasAnyOvrMod && (
                <div className="mt-0.5 text-[9px] font-bold text-slate-400">
                  기본 {player.ovr}
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
        <div className="modal-scroll flex-1 min-h-0 overflow-y-auto space-y-4 p-5">
          {/* Unified OVR Calculation Breakdown Strip (기본 OVR / 시너지 / 사기 / 부상 -> 최종 실효 OVR) */}
          <div className="rounded-xl border border-slate-800 bg-[#0b1018] p-3 space-y-2 tabular-nums">
            <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-200">
              <span>📐 실효 OVR 상세 계산 내역</span>
              <span className="font-mono text-emerald-300">
                최종 실효 OVR {ovrBr.finalEffectiveOvr}
              </span>
            </div>
            <div className="grid grid-cols-5 gap-1.5 text-center text-[10px]">
              <div className="rounded-lg border border-slate-800 bg-[#111822] py-1.5 px-1">
                <div className="text-slate-400">기본 OVR</div>
                <div className="mt-0.5 font-display text-sm font-black text-white">
                  {ovrBr.baseOvr}
                </div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-[#111822] py-1.5 px-1">
                <div className="text-emerald-300/90">시너지</div>
                <div className="mt-0.5 font-display text-sm font-black text-emerald-300">
                  +{ovrBr.synergyBonus}
                </div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-[#111822] py-1.5 px-1">
                <div className="text-amber-300/90">사기</div>
                <div
                  className={`mt-0.5 font-display text-sm font-black ${
                    ovrBr.moraleBonus > 0
                      ? 'text-amber-300'
                      : ovrBr.moraleBonus < 0
                        ? 'text-sky-300'
                        : 'text-slate-300'
                  }`}
                >
                  {ovrBr.moraleBonus > 0
                    ? `+${ovrBr.moraleBonus}`
                    : ovrBr.moraleBonus}
                </div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-[#111822] py-1.5 px-1">
                <div className="text-rose-300/90">부상</div>
                <div
                  className={`mt-0.5 font-display text-sm font-black ${
                    ovrBr.injuryPenalty < 0
                      ? 'text-rose-400'
                      : 'text-slate-300'
                  }`}
                >
                  {ovrBr.isUnavailableInjured
                    ? '결장'
                    : ovrBr.injuryPenalty}
                </div>
              </div>
              <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/25 py-1.5 px-1">
                <div className="font-bold text-emerald-300">최종 실효</div>
                <div className="mt-0.5 font-display text-sm font-black text-emerald-200">
                  {ovrBr.finalEffectiveOvr}
                </div>
              </div>
            </div>
            {ovrBr.positionPenalty < 0 && (
              <div className="text-[10px] text-amber-300/90 text-right">
                * 현재 배치 슬롯 포지션 적합도 보정 ({ovrBr.positionPenalty} OVR) 포함
              </div>
            )}
          </div>

          {/* Condition: Morale & Injury */}
          {condition && (
            <div className="rounded-xl border border-slate-800 bg-[#0b1018] p-3.5 space-y-2.5">
              <div className="rounded-lg border border-slate-800/90 bg-[#0f1622] px-3 py-2 text-xs">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>선수 사기</span>
                  <span className="inline-flex items-center gap-1 font-bold text-slate-200">
                    {getMoraleTier(condition.morale) === 'ecstatic' && (
                      <PixelStatusIcon variant="morale_high" size={12} />
                    )}
                    {getMoraleTier(condition.morale) === 'frozen' && (
                      <PixelStatusIcon variant="morale_low" size={12} />
                    )}
                    {getMoraleLabel(condition.morale)}
                  </span>
                </div>
                <div className="mt-1 flex items-baseline justify-between tabular-nums">
                  <span className="font-display text-sm font-black text-white">
                    {condition.morale > 0 ? `+${condition.morale}` : condition.morale} / 5
                  </span>
                  <span
                    className={`text-[10px] font-bold ${
                      getMoraleOvrBonus(condition.morale) > 0
                        ? 'text-emerald-300'
                        : getMoraleOvrBonus(condition.morale) < 0
                          ? 'text-sky-300'
                          : 'text-slate-400'
                    }`}
                  >
                    OVR {getMoraleOvrBonus(condition.morale) >= 0 ? '+' : ''}
                    {getMoraleOvrBonus(condition.morale)}
                  </span>
                </div>
              </div>

              {(isPlayerActivelyInjured(condition) || isPlayerRecoveringRust(condition)) &&
                condition.injury && (
                  <div className="flex items-start gap-2 rounded-lg border border-rose-500/35 bg-rose-950/30 px-3 py-2 text-[11px] text-rose-200">
                    <PixelStatusIcon variant="injury" size={15} className="mt-0.5" />
                    <div className="leading-snug">
                      <div className="font-bold">
                        {getInjuryTooltip(condition.injury)}
                      </div>
                      {getInjuryOvrPenalty(condition) < 0 &&
                        condition.injury.canPlayThrough && (
                          <div className="text-[10px] text-amber-200/90 mt-0.5">
                            출전 강행 중 실효 OVR {getInjuryOvrPenalty(condition)} 적용
                          </div>
                        )}
                    </div>
                  </div>
                )}
            </div>
          )}

          {/* Individual Synergy OVR Breakdown Banner */}
          {((slotSynergy && slotSynergy.reasons.length > 0) || mgrSynergy.isMatch) && (
            <div className="rounded-xl border border-emerald-500/35 bg-emerald-950/20 px-3.5 py-2.5 space-y-1">
              <div className="flex items-center justify-between text-xs font-extrabold text-emerald-300">
                <span className="inline-flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  개인 시너지 OVR 상승 내역
                </span>
                {synBonus > 0 && (
                  <span className="rounded bg-emerald-500/25 px-1.5 py-0.5 text-[11px] font-black text-emerald-200">
                    총 +{synBonus} OVR
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-200 space-y-0.5">
                {slotSynergy && slotSynergy.reasons.length > 0 ? (
                  slotSynergy.reasons.map((r) => <div key={r}>• {r}</div>)
                ) : (
                  <div>• {mgrSynergy.reason}</div>
                )}
              </div>
            </div>
          )}

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

          {/* Detailed Sub-Attributes (Radar + Stat Bars + Archetype) */}
          <PlayerSubAttributesCard player={player} effectiveOvr={displayOvr} />

          {/* Competition-Split Detailed Season Stats Table (v2.5) */}
          {hasBreakdown ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-bold text-slate-200">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  대회별 시즌 세부 스탯
                </span>
                <span className="text-[10px] text-slate-500">
                  리그 · 자국 컵 · UCL 통합
                </span>
              </div>
              <div className="overflow-hidden rounded-xl border border-slate-800 bg-[#0b1018]">
                <table className="w-full text-left text-[11px] tabular-nums">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] text-slate-400">
                      <th className="py-2 pl-3 pr-2">대회</th>
                      <th className="py-2 px-1.5 text-center">출전</th>
                      <th className="py-2 px-1.5 text-center">골</th>
                      <th className="py-2 px-1.5 text-center">도움</th>
                      <th className="py-2 px-1.5 text-center">
                        {isDefenderOrGk ? 'CS' : 'xG'}
                      </th>
                      <th className="py-2 px-1.5 text-center">MOM</th>
                      <th className="py-2 pl-1.5 pr-3 text-right">평점</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {breakdownRows.map((row) => (
                      <tr
                        key={row.label}
                        className={
                          row.isTotal
                            ? 'bg-emerald-500/10 font-bold text-white'
                            : 'text-slate-300'
                        }
                      >
                        <td className="py-2 pl-3 pr-2 font-bold">
                          {row.label}
                        </td>
                        <td className="py-2 px-1.5 text-center">
                          {row.st ? row.st.appearances : '-'}
                        </td>
                        <td className="py-2 px-1.5 text-center font-bold text-emerald-300">
                          {row.st ? row.st.goals : '-'}
                        </td>
                        <td className="py-2 px-1.5 text-center font-semibold text-sky-300">
                          {row.st ? row.st.assists : '-'}
                        </td>
                        <td className="py-2 px-1.5 text-center text-slate-300">
                          {row.st
                            ? isDefenderOrGk
                              ? row.st.cleanSheets
                              : row.st.xgSum.toFixed(1)
                            : '-'}
                        </td>
                        <td className="py-2 px-1.5 text-center text-amber-300">
                          {row.st ? row.st.momCount : '-'}
                        </td>
                        <td className="py-2 pl-1.5 pr-3 text-right font-display font-bold text-amber-300">
                          {row.st && row.st.appearances > 0
                            ? row.st.avgRating.toFixed(2)
                            : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : seasonStats ? (
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
                    {isDefenderOrGk ? '클린시트' : 'xG'}
                  </div>
                  <div className="font-display text-sm font-bold text-sky-300">
                    {isDefenderOrGk
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
          ) : null}

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
        </div>
      </div>
    </div>
  );
}
