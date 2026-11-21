import {
  AlertCircle,
  ArrowLeftRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Crown,
  Diamond,
  Dices,
  Handshake,
  Info,
  LayoutGrid,
  List,
  Sparkles,
  Star,
  TrendingDown,
  TrendingUp,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { BENCH_SLOTS, FORMATIONS } from '../../data/formations';
import { evaluateManagerPlayerSynergy } from '../../data/managerTraits';
import { PLAYSTYLES } from '../../data/playstyles';
import { ALL_CLUBS_WITH_LEAGUE } from '../../engine/dataLoader';
import {
  evaluatePositionFit,
  formatMainPositions,
} from '../../engine/positionEngine';
import { useGame } from '../../store/GameContext';
import type { TransferTargetPlayer } from '../../types/game';
import { getCardTier, LEAGUE_LABELS } from '../../types/player';
import type { Player, Position } from '../../types/player';
import { CountryFlagSvg } from '../common/CountryFlagSvg';
import { JerseySvg } from '../common/JerseySvg';

interface TransferMarketModalProps {
  embedded?: boolean;
}

type PosFilter = 'ALL' | Position;

interface OutSlotRef {
  area: 'starter' | 'bench';
  index: number;
}

function getTierProbabilityLabel(target: TransferTargetPlayer): {
  label: string;
  colorCls: string;
} {
  const tier = getCardTier(target.player);
  if (target.isLegendFa || tier === 'legend') {
    return { label: '레전드 FA', colorCls: 'bg-amber-400 text-slate-950' };
  }
  if (tier === 'superstar' || target.player.ovr >= 89) {
    return { label: '슈퍼스타', colorCls: 'bg-cyan-300 text-slate-950' };
  }
  if (target.player.ovr >= 85) {
    return { label: '월드클래스', colorCls: 'bg-violet-500/20 text-violet-300' };
  }
  if (target.player.ovr >= 79) {
    return { label: '주전 핵심', colorCls: 'bg-sky-500/20 text-sky-300' };
  }
  return { label: '로테이션', colorCls: 'bg-emerald-500/20 text-emerald-300' };
}

function shortPlayerLabel(name: string): string {
  const parts = name.trim().split(' ');
  const last = parts[parts.length - 1] ?? name;
  return last.length > 6 ? last.slice(0, 6) : last;
}

export function TransferMarketModal({
  embedded = false,
}: TransferMarketModalProps) {
  const {
    state,
    transferSpinClubs,
    transferSubmitOffer,
    transferCloseWindow,
  } = useGame();

  const season = state.season;
  const tm = season?.transferMarket ?? null;

  const [animating, setAnimating] = useState(false);
  const [lockedCount, setLockedCount] = useState(tm?.hasSpunClubs ? 3 : 0);
  const [tick, setTick] = useState(0);
  const [activeReelIdx, setActiveReelIdx] = useState<number>(0);
  const [posFilter, setPosFilter] = useState<PosFilter>('ALL');
  const [negotiatingTarget, setNegotiatingTarget] =
    useState<TransferTargetPlayer | null>(null);
  const [selectedOutSlot, setSelectedOutSlot] = useState<OutSlotRef | null>(
    null,
  );
  const [outFilterTab, setOutFilterTab] = useState<
    'recommended' | 'starters' | 'bench'
  >('recommended');
  const [mobileSquadOpen, setMobileSquadOpen] = useState(false);
  const [squadViewMode, setSquadViewMode] = useState<'pitch' | 'list'>('pitch');

  useEffect(() => {
    if (!animating) return;
    const iv = window.setInterval(() => setTick((t) => t + 1), 65);
    const t1 = window.setTimeout(() => setLockedCount(1), 360);
    const t2 = window.setTimeout(() => setLockedCount(2), 680);
    const t3 = window.setTimeout(() => {
      setLockedCount(3);
      setAnimating(false);
      window.clearInterval(iv);
    }, 1000);
    return () => {
      window.clearInterval(iv);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [animating]);

  const formationSlots = FORMATIONS[state.formation].slots;

  // Compute starter rows with effective OVR, season avg rating, and weak-slot detection
  const starterRows = useMemo(() => {
    const allStats = season?.allPlayerStats ?? {};
    const rows = state.starters.map((player, idx) => {
      const slot = formationSlots[idx];
      if (!player) {
        return {
          index: idx,
          slotLabel: slot.label,
          subPosition: slot.subPosition,
          x: slot.x,
          y: slot.y,
          player: null as Player | null,
          effectiveOvr: 0,
          penalty: 0,
          avgRating: 0,
          apps: 0,
          isPenaltyWeak: false,
          isLowestOvrWeak: false,
        };
      }
      const fit = evaluatePositionFit(
        player,
        slot.subPosition,
        state.manager.traitId,
      );
      const st = allStats[player.id] ?? allStats[`user::${player.id}`];
      return {
        index: idx,
        slotLabel: slot.label,
        subPosition: slot.subPosition,
        x: slot.x,
        y: slot.y,
        player,
        effectiveOvr: fit.effectiveOvr,
        penalty: fit.penalty,
        avgRating: st?.avgRating ?? 0,
        apps: st?.appearances ?? 0,
        isPenaltyWeak: fit.penalty < 0,
        isLowestOvrWeak: false,
      };
    });

    // Identify bottom-2 effective OVR starters as reinforcement targets
    const sortedOvrs = rows
      .filter((r) => r.player !== null)
      .map((r) => r.effectiveOvr)
      .sort((a, b) => a - b);
    const weakCutoff = sortedOvrs[Math.min(1, sortedOvrs.length - 1)] ?? 0;

    return rows.map((r) => ({
      ...r,
      isLowestOvrWeak: r.player !== null && r.effectiveOvr <= weakCutoff,
    }));
  }, [state.starters, formationSlots, state.manager.traitId, season?.allPlayerStats]);

  const benchRows = useMemo(() => {
    const allStats = season?.allPlayerStats ?? {};
    return state.bench.map((player, idx) => {
      const st = player
        ? allStats[player.id] ?? allStats[`user::${player.id}`]
        : undefined;
      return {
        index: idx,
        slotLabel: BENCH_SLOTS[idx]?.label ?? `B${idx + 1}`,
        player,
        avgRating: st?.avgRating ?? 0,
        apps: st?.appearances ?? 0,
      };
    });
  }, [state.bench, season?.allPlayerStats]);

  if (!season || !tm || !tm.isOpen) return null;

  const weakSlotCount = starterRows.filter(
    (r) => r.isPenaltyWeak || r.isLowestOvrWeak,
  ).length;
  const legendRatePercent = tm.championBonusActive
    ? 5.5
    : tm.legendBonusActive
      ? 4.0
      : 2.5;
  const allRevealed = tm.hasSpunClubs && !animating && lockedCount >= 3;

  const handleSpinClubs = () => {
    if (tm.hasSpunClubs || animating) return;
    setLockedCount(0);
    setActiveReelIdx(0);
    setPosFilter('ALL');
    setNegotiatingTarget(null);
    setSelectedOutSlot(null);
    setAnimating(true);
    transferSpinClubs();
  };

  const handleStartNegotiation = (target: TransferTargetPlayer) => {
    setNegotiatingTarget(target);
    setOutFilterTab('recommended');
    // Auto-suggest best matching starter slot (weakest effective OVR where target fits best)
    let bestSlot: OutSlotRef | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const row of starterRows) {
      if (!row.player) continue;
      const incomingFit = evaluatePositionFit(
        target.player,
        row.subPosition,
        state.manager.traitId,
      );
      const gain = incomingFit.effectiveOvr - row.effectiveOvr;
      const fitBonus =
        incomingFit.fit === 'main'
          ? 14
          : incomingFit.fit === 'secondary'
            ? 5
            : -12;
      const score = gain + fitBonus;
      if (score > bestScore) {
        bestScore = score;
        bestSlot = { area: 'starter', index: row.index };
      }
    }
    setSelectedOutSlot(bestSlot);
  };

  const activeClubOffer = tm.rolledClubs[activeReelIdx] ?? tm.rolledClubs[0];
  const filteredSquad = activeClubOffer
    ? posFilter === 'ALL'
      ? activeClubOffer.squad
      : activeClubOffer.squad.filter((t) => t.player.position === posFilter)
    : [];

  const selectedOutPlayer = selectedOutSlot
    ? selectedOutSlot.area === 'starter'
      ? state.starters[selectedOutSlot.index]
      : state.bench[selectedOutSlot.index]
    : null;

  const selectedOutEffectiveOvr =
    selectedOutSlot && selectedOutPlayer
      ? selectedOutSlot.area === 'starter'
        ? evaluatePositionFit(
            selectedOutPlayer,
            formationSlots[selectedOutSlot.index].subPosition,
            state.manager.traitId,
          ).effectiveOvr
        : selectedOutPlayer.ovr
      : null;

  const incomingProjectedOvr =
    negotiatingTarget && selectedOutSlot
      ? selectedOutSlot.area === 'starter'
        ? evaluatePositionFit(
            negotiatingTarget.player,
            formationSlots[selectedOutSlot.index].subPosition,
            state.manager.traitId,
          ).effectiveOvr
        : negotiatingTarget.player.ovr
      : null;

  const handleConfirmOffer = () => {
    if (!negotiatingTarget || !selectedOutSlot || tm.attemptsRemaining <= 0) {
      return;
    }
    transferSubmitOffer(negotiatingTarget, selectedOutSlot);
    setNegotiatingTarget(null);
    setSelectedOutSlot(null);
  };

  const renderMySquadList = () => (
    <div className="space-y-2.5">
      {/* Header + Pitch/List Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-extrabold text-white">
          <Users className="w-3.5 h-3.5 text-emerald-400" />
          내 스쿼드 ({state.formation})
          {weakSlotCount > 0 && (
            <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
              <AlertCircle className="w-2.5 h-2.5" />
              취약 {weakSlotCount}
            </span>
          )}
        </div>

        <div className="inline-flex items-center rounded-lg border border-slate-800 bg-[#0b1018] p-0.5 text-[10px]">
          <button
            type="button"
            onClick={() => setSquadViewMode('pitch')}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 font-bold transition-colors cursor-pointer ${
              squadViewMode === 'pitch'
                ? 'bg-emerald-500 text-slate-950'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <LayoutGrid className="w-3 h-3" />
            피치
          </button>
          <button
            type="button"
            onClick={() => setSquadViewMode('list')}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 font-bold transition-colors cursor-pointer ${
              squadViewMode === 'list'
                ? 'bg-emerald-500 text-slate-950'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <List className="w-3 h-3" />
            리스트
          </button>
        </div>
      </div>

      {negotiatingTarget && (
        <div className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] text-emerald-200">
          방출할 선수를 피치 또는 벤치에서 직접 클릭해 지정하세요.
        </div>
      )}

      {squadViewMode === 'pitch' ? (
        /* MINI FORMATION PITCH VIEW + BOTTOM 5-PLAYER BENCH BAR */
        <div className="space-y-2.5">
          <div className="relative w-full min-h-[380px] sm:min-h-[415px] overflow-hidden rounded-xl border border-emerald-500/30 bg-gradient-to-b from-[#0b3d28] via-[#0e4b30] to-[#0b3d28] shadow-inner">
            {/* Pitch SVG Markings */}
            <svg
              viewBox="0 0 100 120"
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-0 h-full w-full opacity-30"
              aria-hidden="true"
            >
              <rect x="4" y="4" width="92" height="112" fill="none" stroke="#ffffff" strokeWidth="0.7" />
              <line x1="4" y1="60" x2="96" y2="60" stroke="#ffffff" strokeWidth="0.6" />
              <circle cx="50" cy="60" r="11" fill="none" stroke="#ffffff" strokeWidth="0.6" />
              <circle cx="50" cy="60" r="1" fill="#ffffff" />
              <rect x="24" y="4" width="52" height="16" fill="none" stroke="#ffffff" strokeWidth="0.6" />
              <rect x="36" y="4" width="28" height="6" fill="none" stroke="#ffffff" strokeWidth="0.6" />
              <rect x="24" y="100" width="52" height="16" fill="none" stroke="#ffffff" strokeWidth="0.6" />
              <rect x="36" y="110" width="28" height="6" fill="none" stroke="#ffffff" strokeWidth="0.6" />
            </svg>

            {/* 11 Formation Starter Nodes */}
            {starterRows.map((row) => {
              if (!row.player) return null;
              const isSelectedOut =
                selectedOutSlot?.area === 'starter' &&
                selectedOutSlot.index === row.index;
              const tier = getCardTier(row.player);
              const targetFitsSlot = negotiatingTarget
                ? evaluatePositionFit(
                    negotiatingTarget.player,
                    row.subPosition,
                    state.manager.traitId,
                  )
                : null;
              const isTargetMainFit = targetFitsSlot?.fit === 'main';

              return (
                <button
                  key={`pitch-node-${row.index}`}
                  type="button"
                  onClick={() => {
                    if (negotiatingTarget) {
                      setSelectedOutSlot({ area: 'starter', index: row.index });
                    }
                  }}
                  style={{
                    left: `${row.x}%`,
                    top: `${row.y}%`,
                  }}
                  title={`${row.slotLabel} ${row.player.name} · 실효 OVR ${row.effectiveOvr}${row.penalty < 0 ? ` (페널티 ${row.penalty})` : ''} · 평점 ${row.apps > 0 ? row.avgRating.toFixed(1) : '-'}`}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center rounded-lg border px-1.5 py-1 min-w-[54px] max-w-[74px] transition-colors tabular-nums ${
                    isSelectedOut
                      ? 'z-20 border-rose-400 bg-rose-950/92 ring-2 ring-rose-400/80 shadow-[0_0_14px_rgba(251,113,133,0.45)]'
                      : isTargetMainFit
                        ? 'z-10 border-emerald-400 bg-[#0d1c19]/92 ring-1 ring-emerald-400/70'
                        : row.isPenaltyWeak
                          ? 'z-10 border-rose-400/80 bg-[#231018]/92 ring-1 ring-rose-500/40'
                          : row.isLowestOvrWeak
                            ? 'z-10 border-amber-400/80 bg-[#22190c]/92 ring-1 ring-amber-400/40'
                            : 'border-slate-700/90 bg-[#0b1018]/90 hover:border-slate-400'
                  } ${negotiatingTarget ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  {/* Top Micro Badge: Release / Penalty / Weak / Main Match */}
                  {isSelectedOut ? (
                    <span className="absolute -top-2 rounded bg-rose-500 px-1 text-[8px] font-black text-white">
                      방출
                    </span>
                  ) : row.isPenaltyWeak ? (
                    <span className="absolute -top-2 rounded bg-rose-500/90 px-1 text-[8px] font-black text-white">
                      {row.penalty}
                    </span>
                  ) : row.isLowestOvrWeak ? (
                    <span className="absolute -top-2 rounded bg-amber-400 px-1 text-[8px] font-black text-slate-950">
                      보강
                    </span>
                  ) : isTargetMainFit ? (
                    <span className="absolute -top-2 rounded bg-emerald-400 px-1 text-[8px] font-black text-slate-950">
                      적합
                    </span>
                  ) : null}

                  <div className="flex items-center justify-between w-full gap-1">
                    <span className="text-[8px] font-extrabold text-emerald-300">
                      {row.slotLabel}
                    </span>
                    <span
                      className={`font-display text-xs font-black leading-none ${
                        row.isPenaltyWeak
                          ? 'text-rose-300'
                          : row.isLowestOvrWeak
                            ? 'text-amber-300'
                            : tier === 'legend'
                              ? 'text-amber-300'
                              : tier === 'superstar'
                                ? 'text-cyan-200'
                                : 'text-white'
                      }`}
                    >
                      {row.effectiveOvr}
                    </span>
                  </div>
                  <div className="mt-0.5 w-full truncate text-center text-[9px] font-bold text-slate-100 leading-tight">
                    {shortPlayerLabel(row.player.name)}
                  </div>
                  <div className="text-[8px] font-semibold text-slate-400 leading-none mt-0.5">
                    ★{row.apps > 0 ? row.avgRating.toFixed(1) : '-'}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Pitch Legend */}
          <div className="flex flex-wrap items-center justify-between gap-1 px-0.5 text-[9px] text-slate-400">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              부포지션 페널티
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              최저 OVR 보강
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              협상 대상 적합
            </span>
          </div>

          {/* Bottom 5-Player Bench Bar */}
          <div className="space-y-1">
            <div className="text-[10px] font-bold text-slate-400 px-0.5">
              벤치 5명
            </div>
            <div className="grid grid-cols-5 gap-1">
              {benchRows.map((row) => {
                if (!row.player) return null;
                const isSelectedOut =
                  selectedOutSlot?.area === 'bench' &&
                  selectedOutSlot.index === row.index;
                return (
                  <button
                    key={`pitch-bn-${row.index}`}
                    type="button"
                    onClick={() => {
                      if (negotiatingTarget) {
                        setSelectedOutSlot({ area: 'bench', index: row.index });
                      }
                    }}
                    title={`${row.player.name} (${formatMainPositions(row.player)}) · OVR ${row.player.ovr}`}
                    className={`relative flex flex-col items-center rounded-lg border px-1 py-1.5 text-center transition-all tabular-nums ${
                      isSelectedOut
                        ? 'border-rose-400 bg-rose-500/20 ring-1 ring-rose-400'
                        : 'border-slate-800 bg-[#0b1018] hover:border-slate-600'
                    } ${negotiatingTarget ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    {isSelectedOut && (
                      <span className="absolute -top-1.5 rounded bg-rose-500 px-1 text-[7px] font-black text-white">
                        방출
                      </span>
                    )}
                    <span className="text-[8px] font-bold text-slate-400">
                      {row.player.mainPositions[0]}
                    </span>
                    <span className="font-display text-xs font-extrabold text-white leading-tight">
                      {row.player.ovr}
                    </span>
                    <span className="w-full truncate text-[9px] font-semibold text-slate-200 leading-tight">
                      {shortPlayerLabel(row.player.name)}
                    </span>
                    <span className="text-[8px] text-slate-500 leading-none mt-0.5">
                      ★{row.apps > 0 ? row.avgRating.toFixed(1) : '-'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* CLASSIC LIST VIEW */
        <div className="space-y-3">
          {/* Starters 11 */}
          <div className="space-y-1">
            <div className="text-[10px] font-bold text-slate-400 px-0.5">
              선발 11명 (실효 OVR · 시즌 평점)
            </div>
            <div className="space-y-1">
              {starterRows.map((row) => {
                if (!row.player) return null;
                const isWeak = row.isPenaltyWeak || row.isLowestOvrWeak;
                const isSelectedOut =
                  selectedOutSlot?.area === 'starter' &&
                  selectedOutSlot.index === row.index;
                const tier = getCardTier(row.player);
                const targetFitsSlot = negotiatingTarget
                  ? evaluatePositionFit(
                      negotiatingTarget.player,
                      row.subPosition,
                      state.manager.traitId,
                    )
                  : null;

                return (
                  <button
                    key={`mysq-st-${row.index}`}
                    type="button"
                    onClick={() => {
                      if (negotiatingTarget) {
                        setSelectedOutSlot({ area: 'starter', index: row.index });
                      }
                    }}
                    className={`w-full flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-all ${
                      isSelectedOut
                        ? 'border-rose-400 bg-rose-500/18 ring-1 ring-rose-400/50'
                        : isWeak
                          ? 'border-amber-500/35 bg-amber-950/15 hover:border-amber-400/60'
                          : 'border-slate-800/90 bg-[#0b1018] hover:border-slate-700'
                    } ${negotiatingTarget ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-8 shrink-0 rounded py-0.5 text-center text-[10px] font-extrabold ${
                          row.isPenaltyWeak
                            ? 'bg-rose-500/20 text-rose-300'
                            : row.isLowestOvrWeak
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-slate-800 text-emerald-300'
                        }`}
                      >
                        {row.slotLabel}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="truncate text-xs font-bold text-slate-100">
                            {row.player.name}
                          </span>
                          {tier === 'legend' && (
                            <Crown className="w-2.5 h-2.5 text-amber-300 shrink-0" />
                          )}
                          {tier === 'superstar' && (
                            <Diamond className="w-2.5 h-2.5 text-cyan-300 shrink-0" />
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1 text-[10px] text-slate-500">
                          <span>{formatMainPositions(row.player)}</span>
                          {row.isPenaltyWeak && (
                            <span className="rounded bg-rose-500/20 px-1 text-[9px] font-bold text-rose-300">
                              페널티 {row.penalty}
                            </span>
                          )}
                          {!row.isPenaltyWeak && row.isLowestOvrWeak && (
                            <span className="rounded bg-amber-500/20 px-1 text-[9px] font-bold text-amber-300">
                              보강 추천
                            </span>
                          )}
                          {targetFitsSlot && targetFitsSlot.fit === 'main' && (
                            <span className="rounded bg-emerald-500/20 px-1 text-[9px] font-bold text-emerald-300">
                              주포지션 일치
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 tabular-nums">
                      <div className="text-right">
                        <div
                          className={`font-display text-sm font-bold leading-none ${
                            row.isPenaltyWeak
                              ? 'text-rose-300'
                              : row.isLowestOvrWeak
                                ? 'text-amber-300'
                                : 'text-white'
                          }`}
                        >
                          {row.effectiveOvr}
                        </div>
                        <div className="text-[9px] text-slate-400">
                          평점 {row.apps > 0 ? row.avgRating.toFixed(1) : '-'}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bench 5 */}
          <div className="space-y-1">
            <div className="text-[10px] font-bold text-slate-400 px-0.5">
              벤치 5명
            </div>
            <div className="grid grid-cols-1 gap-1">
              {benchRows.map((row) => {
                if (!row.player) return null;
                const isSelectedOut =
                  selectedOutSlot?.area === 'bench' &&
                  selectedOutSlot.index === row.index;
                return (
                  <button
                    key={`mysq-bn-${row.index}`}
                    type="button"
                    onClick={() => {
                      if (negotiatingTarget) {
                        setSelectedOutSlot({ area: 'bench', index: row.index });
                      }
                    }}
                    className={`w-full flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-all ${
                      isSelectedOut
                        ? 'border-rose-400 bg-rose-500/18 ring-1 ring-rose-400/50'
                        : 'border-slate-800/80 bg-[#0b1018]/80 hover:border-slate-700'
                    } ${negotiatingTarget ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-8 shrink-0 rounded bg-slate-900 py-0.5 text-center text-[10px] font-bold text-slate-400">
                        {row.slotLabel}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold text-slate-200">
                          {row.player.name}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {formatMainPositions(row.player)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0 tabular-nums">
                      <div className="font-display text-sm font-bold text-slate-200 leading-none">
                        {row.player.ovr}
                      </div>
                      <div className="text-[9px] text-slate-500">
                        평점 {row.apps > 0 ? row.avgRating.toFixed(1) : '-'}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const innerContent = (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-800 bg-[#111822]">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-[#0d131c] px-5 py-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded px-2 py-0.5 text-xs font-bold ${
                tm.isUclSpecial
                  ? 'bg-sky-500/20 text-sky-300'
                  : 'bg-emerald-500/15 text-emerald-300'
              }`}
            >
              {tm.isUclSpecial
                ? '🏆 UCL 개막 전 특별 이적시장'
                : `제 ${tm.windowIndex}차 이적시장 (${tm.triggerRound}R)`}
            </span>
            <span
              className={`rounded px-2 py-0.5 text-xs font-bold tabular-nums ${
                tm.attemptsRemaining > 0
                  ? 'bg-sky-500/15 text-sky-300'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              남은 협상 기회 {tm.attemptsRemaining} / {tm.maxAttempts}
            </span>
            {tm.championBonusActive ? (
              <span className="inline-flex items-center gap-1 rounded bg-amber-400/20 border border-amber-400/40 px-2 py-0.5 text-xs font-black text-amber-300">
                <Crown className="w-3.5 h-3.5" />
                리그 우승 프리미엄 · 영입확률 +5% · 레전드 FA 5.5%
              </span>
            ) : tm.legendBonusActive ? (
              <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-amber-300">
                <Crown className="w-3.5 h-3.5" />
                TOP 4 위상 ({tm.userRankAtOpen}위) · 레전드 FA 4.0%
              </span>
            ) : (
              <span className="text-xs text-slate-400">
                현재 {tm.userRankAtOpen}위 · 레전드 FA 2.5%
              </span>
            )}
          </div>
          <h2 className="mt-1.5 text-base sm:text-lg font-extrabold text-white">
            {tm.isUclSpecial
              ? !tm.hasSpunClubs
                ? '챔피언스리그 개막 전 마지막 보강! 3구단 특별 이적시장 룰렛을 돌리세요'
                : '유럽 제패를 위한 최종 스쿼드 보강 (최대 3회 협상)'
              : !tm.hasSpunClubs
                ? '내 취약 포지션을 확인하고 3구단 이적시장 룰렛을 돌리세요'
                : '내 스쿼드와 비교하며 최대 3회 영입 협상을 시도하세요'}
          </h2>
        </div>

        <button
          type="button"
          onClick={transferCloseWindow}
          className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-extrabold transition-colors cursor-pointer ${
            tm.attemptsRemaining <= 0
              ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
              : 'border border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 hover:text-white'
          }`}
        >
          <X className="w-4 h-4" />
          {tm.isUclSpecial
            ? 'UCL 리그 페이즈 개막 →'
            : tm.attemptsRemaining <= 0
              ? '시즌 재개 →'
              : '이적시장 닫기'}
        </button>
      </div>

      {/* Body: Responsive Split (PC Left=My Squad / Right=3-Club Market, Mobile Top Collapsible Drawer) */}
      <div
        className={
          embedded
            ? 'p-4 sm:p-5 space-y-4'
            : 'overflow-y-auto p-4 sm:p-5 max-h-[80vh] space-y-4'
        }
      >
        {/* Mobile Collapsible [내 스쿼드 비교] Drawer */}
        <div className="lg:hidden rounded-xl border border-slate-800 bg-[#0d131c]">
          <button
            type="button"
            onClick={() => setMobileSquadOpen((o) => !o)}
            className="flex w-full items-center justify-between px-4 py-3 text-xs font-extrabold text-white cursor-pointer"
          >
            <span className="inline-flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              내 스쿼드 비교 ({state.formation})
              {weakSlotCount > 0 && (
                <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                  취약 {weakSlotCount}
                </span>
              )}
            </span>
            {mobileSquadOpen ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>
          {mobileSquadOpen && (
            <div className="border-t border-slate-800 p-3.5 max-h-80 overflow-y-auto">
              {renderMySquadList()}
            </div>
          )}
        </div>

        {/* Last Negotiation Outcome Banner */}
        {tm.lastOfferResult && (
          <div
            className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-xs font-semibold ${
              tm.lastOfferResult.success
                ? 'border-emerald-500/45 bg-emerald-500/12 text-emerald-200'
                : 'border-rose-500/45 bg-rose-500/12 text-rose-200'
            }`}
          >
            {tm.lastOfferResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <div>{tm.lastOfferResult.message}</div>
              {tm.attemptsRemaining === 0 && (
                <div className="mt-1 text-[11px] text-slate-300">
                  이번 이적시장 협상 기회 3회를 모두 사용했습니다. 우측 상단의 [시즌 재개]를 눌러 리그로 복귀하세요.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main 2-Column PC Layout */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Left Column (PC Always-Visible My Squad) */}
          <aside className="hidden lg:block lg:col-span-4 rounded-xl border border-slate-800 bg-[#0d131c] p-3.5 self-start">
            {renderMySquadList()}
          </aside>

          {/* Right Column: 3-Club Roulette + Squad Roster Browser */}
          <div className="lg:col-span-8 space-y-4">
            {/* 3-Club Roulette Panel */}
            <div className="rounded-xl border border-slate-800 bg-[#0d131c] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 font-bold text-slate-200">
                  <Dices className="w-4 h-4 text-emerald-400" />
                  {(() => {
                    const poolCount =
                      state.draftLeaguePool.length > 0
                        ? ALL_CLUBS_WITH_LEAGUE.filter((c) =>
                            state.draftLeaguePool.includes(c.leagueId),
                          ).length
                        : ALL_CLUBS_WITH_LEAGUE.length;
                    return `협상 대상 3구단 추첨 (선택 풀 ${poolCount}구단)`;
                  })()}
                </span>
                <span className="text-[11px] text-slate-400">
                  시즌 폼 · 소속 순위 · 우리 위상 반영
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                {[0, 1, 2].map((reelIdx) => {
                  const isLocked =
                    tm.hasSpunClubs &&
                    lockedCount > reelIdx &&
                    tm.rolledClubs[reelIdx];
                  const offer = isLocked ? tm.rolledClubs[reelIdx] : null;
                  const filteredClubs =
                    state.draftLeaguePool.length > 0
                      ? ALL_CLUBS_WITH_LEAGUE.filter((c) =>
                          state.draftLeaguePool.includes(c.leagueId),
                        )
                      : ALL_CLUBS_WITH_LEAGUE;
                  const spinPool =
                    filteredClubs.length > 0
                      ? filteredClubs
                      : ALL_CLUBS_WITH_LEAGUE;
                  const spinningEntry =
                    spinPool[(tick * 7 + reelIdx * 31) % spinPool.length];
                  const showGoldFlash = animating && (tick + reelIdx) % 9 === 0;
                  const isSelectedTab = allRevealed && activeReelIdx === reelIdx;

                  return (
                    <button
                      key={reelIdx}
                      type="button"
                      disabled={!allRevealed}
                      onClick={() => {
                        setActiveReelIdx(reelIdx);
                        setPosFilter('ALL');
                      }}
                      className={`relative flex flex-col items-center justify-center rounded-xl border p-3 text-center min-h-[98px] transition-all ${
                        offer
                          ? offer.isLegendSlot
                            ? `card-legend-glow ${isSelectedTab ? 'ring-2 ring-amber-300' : 'opacity-85 hover:opacity-100'}`
                            : isSelectedTab
                              ? 'border-emerald-400 bg-emerald-500/12 ring-1 ring-emerald-400/40'
                              : 'border-slate-700 bg-[#121a25] hover:border-slate-500'
                          : animating
                            ? showGoldFlash
                              ? 'border-amber-400 bg-amber-950/35'
                              : 'border-sky-400/40 bg-slate-900/80'
                            : 'border-dashed border-slate-800 bg-slate-950/50'
                      } ${allRevealed ? 'cursor-pointer' : 'cursor-default'}`}
                    >
                      <span className="absolute top-1.5 left-2 text-[9px] font-bold text-slate-500">
                        #{reelIdx + 1}
                      </span>

                      {offer ? (
                        offer.isLegendSlot ? (
                          <div className="flex flex-col items-center gap-1 pt-1">
                            <Crown className="w-6 h-6 text-amber-300" />
                            <span className="font-display text-sm font-bold text-amber-300">
                              레전드 FA
                            </span>
                            <span className="text-[10px] font-semibold text-amber-200/80">
                              특별 협상 · 1명
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1 pt-1">
                            {offer.club && (
                              <JerseySvg
                                primaryColor={offer.club.primaryColor}
                                secondaryColor={offer.club.secondaryColor}
                                pattern={offer.club.pattern}
                                label={offer.club.shortName}
                                size={34}
                              />
                            )}
                            <span className="truncate max-w-full text-xs font-bold text-white">
                              {offer.club?.name}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {LEAGUE_LABELS[offer.leagueId]} {offer.clubRank}위 ·{' '}
                              {offer.squad.length}명
                            </span>
                          </div>
                        )
                      ) : animating ? (
                        showGoldFlash ? (
                          <div className="flex flex-col items-center gap-1 pt-1">
                            <Crown className="w-5 h-5 text-amber-300 animate-pulse" />
                            <span className="font-display text-xs font-bold text-amber-300">
                              LEGEND FA?!
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1 pt-1 opacity-85">
                            <JerseySvg
                              primaryColor={spinningEntry.club.primaryColor}
                              secondaryColor={spinningEntry.club.secondaryColor}
                              pattern={spinningEntry.club.pattern}
                              size={30}
                            />
                            <span className="truncate max-w-full text-[11px] font-semibold text-slate-300">
                              {spinningEntry.club.name}
                            </span>
                          </div>
                        )
                      ) : (
                        <div className="flex flex-col items-center gap-1 pt-1 text-slate-600">
                          <Sparkles className="w-4 h-4" />
                          <span className="text-[11px]">대기</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {!tm.hasSpunClubs && (
                <button
                  id="spin-transfer-clubs-btn"
                  type="button"
                  onClick={handleSpinClubs}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-extrabold text-slate-950 hover:bg-emerald-400 transition-colors cursor-pointer"
                >
                  <Dices className="w-4 h-4" />
                  3구단 이적시장 룰렛 돌리기 (레전드 FA {legendRatePercent.toFixed(1)}%)
                </button>
              )}
            </div>

            {/* Squad Browser for Selected Club Tab */}
            {allRevealed && activeClubOffer && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-extrabold text-white">
                    {activeClubOffer.isLegendSlot
                      ? '황금 레전드 FA 특별 명단'
                      : `${activeClubOffer.club?.name} 2026-27 스쿼드 (${LEAGUE_LABELS[activeClubOffer.leagueId]} ${activeClubOffer.clubRank}위)`}
                  </h3>

                  {!activeClubOffer.isLegendSlot && (
                    <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-[#0b1018] p-0.5 text-[11px]">
                      {(['ALL', 'FW', 'MF', 'DF', 'GK'] as PosFilter[]).map(
                        (pf) => (
                          <button
                            key={pf}
                            type="button"
                            onClick={() => setPosFilter(pf)}
                            className={`rounded-md px-2.5 py-1 font-bold cursor-pointer ${
                              posFilter === pf
                                ? 'bg-emerald-500 text-slate-950'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            {pf === 'ALL' ? '전체' : pf}
                          </button>
                        ),
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {filteredSquad.map((target) => {
                    const p = target.player;
                    const tier = getCardTier(p);
                    const isLegend = tier === 'legend';
                    const isSuperstar = tier === 'superstar';
                    const tierBadge = getTierProbabilityLabel(target);
                    const isSigned = tm.signedPlayerIds.includes(p.id);
                    const failCount = isSigned
                      ? 0
                      : tm.attemptedPlayerIds.filter((id) => id === p.id).length;
                    const isNegotiatingThis =
                      negotiatingTarget?.player.id === p.id;
                    const disabled = isSigned || tm.attemptsRemaining <= 0;
                    const mgrSynergy = evaluateManagerPlayerSynergy(
                      p,
                      state.manager.traitId,
                    );

                    const probColor =
                      target.successChance >= 65
                        ? 'text-emerald-300'
                        : target.successChance >= 35
                          ? 'text-sky-300'
                          : target.successChance >= 16
                            ? 'text-amber-300'
                            : 'text-rose-300';

                    const barColor =
                      target.successChance >= 65
                        ? 'bg-emerald-500'
                        : target.successChance >= 35
                          ? 'bg-sky-400'
                          : target.successChance >= 16
                            ? 'bg-amber-400'
                            : 'bg-rose-500';

                    return (
                      <div
                        key={p.id}
                        className={`rounded-xl border p-3.5 flex flex-col justify-between gap-3 transition-all ${
                          isLegend
                            ? 'card-legend-glow'
                            : isSuperstar
                              ? 'card-superstar-glow'
                              : 'border-slate-800 bg-[#0d131c]'
                        } ${isNegotiatingThis ? 'ring-2 ring-emerald-400' : ''}`}
                      >
                        <div className="space-y-2.5">
                          {/* Row 1: Identity & OVR */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span
                                  className={`rounded px-1.5 py-0.5 text-[10px] font-black ${tierBadge.colorCls}`}
                                >
                                  {tierBadge.label}
                                </span>
                                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-200">
                                  {formatMainPositions(p)}
                                </span>
                                {mgrSynergy.isMatch && (
                                  <span
                                    title={mgrSynergy.reason}
                                    className="inline-flex items-center gap-0.5 rounded border border-amber-400/45 bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-200"
                                  >
                                    <Star className="w-2.5 h-2.5 fill-amber-300 text-amber-300" />
                                    감독 시너지
                                  </span>
                                )}
                                {failCount > 0 && !isSigned && (
                                  <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-300">
                                    결렬 {failCount}회 · 재도전 가능
                                  </span>
                                )}
                                {target.formTrend === 'up' && (
                                  <span className="inline-flex items-center gap-0.5 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                                    <TrendingUp className="w-3 h-3" />
                                    폼 상승 ▲
                                  </span>
                                )}
                                {target.formTrend === 'down' && (
                                  <span className="inline-flex items-center gap-0.5 rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-bold text-sky-300">
                                    <TrendingDown className="w-3 h-3" />
                                    폼 하락 ▼
                                  </span>
                                )}
                              </div>

                              <div className="mt-1 flex items-center gap-1.5">
                                <span className="truncate text-sm font-extrabold text-white">
                                  {p.name}
                                </span>
                                {isLegend && (
                                  <Crown className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                                )}
                                {isSuperstar && (
                                  <Diamond className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-400">
                                <CountryFlagSvg
                                  code={p.nationalityCode}
                                  nationality={p.nationality}
                                  size="xs"
                                />
                                <span>
                                  {p.nationality} ·{' '}
                                  {p.playstyles
                                    .map((ps) => PLAYSTYLES[ps]?.shortName ?? ps)
                                    .join(' · ')}
                                </span>
                              </div>
                            </div>

                            <div className="text-right shrink-0 tabular-nums">
                              <div className="text-[9px] font-bold text-slate-500">
                                OVR
                              </div>
                              <div
                                className={`font-display text-2xl font-bold leading-none ${
                                  isLegend
                                    ? 'text-amber-300'
                                    : isSuperstar
                                      ? 'text-cyan-200'
                                      : 'text-white'
                                }`}
                              >
                                {p.ovr}
                              </div>
                              <div className="mt-0.5 text-[10px] text-slate-400">
                                A{p.att} M{p.mid} D{p.def}
                              </div>
                            </div>
                          </div>

                          {/* Row 2: Season Form Summary + Value + Probability */}
                          <div className="rounded-lg border border-slate-800/90 bg-slate-950/65 p-2.5 space-y-2">
                            <div className="flex items-center justify-between gap-2 text-[11px]">
                              <span className="text-slate-300 truncate">
                                {target.formSummary}
                              </span>
                              <span className="font-display text-sm font-bold text-amber-300 shrink-0 tabular-nums">
                                €{target.marketValueM}M
                              </span>
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[11px] tabular-nums">
                                <span className="text-slate-400">
                                  영입 성공 확률
                                </span>
                                <span
                                  className={`font-display text-sm font-bold ${probColor}`}
                                >
                                  {target.successChance}%
                                </span>
                              </div>
                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-900">
                                <div
                                  className={`h-full rounded-full ${barColor}`}
                                  style={{ width: `${target.successChance}%` }}
                                />
                              </div>
                            </div>

                            {/* Transparent Breakdown */}
                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] text-slate-400 tabular-nums">
                              <span className="inline-flex items-center gap-0.5">
                                <Info className="w-2.5 h-2.5 text-slate-500" />
                                기본 €{target.breakdown.baseValueM}M
                              </span>
                              <span>
                                폼{' '}
                                <strong
                                  className={
                                    target.breakdown.formDeltaPct > 0
                                      ? 'text-amber-300'
                                      : target.breakdown.formDeltaPct < 0
                                        ? 'text-emerald-300'
                                        : 'text-slate-300'
                                  }
                                >
                                  {target.breakdown.formDeltaPct >= 0 ? '+' : ''}
                                  {target.breakdown.formDeltaPct}%
                                </strong>
                              </span>
                              {!target.isLegendFa && (
                                <span>
                                  순위{' '}
                                  <strong className="text-slate-200">
                                    {target.breakdown.clubRankDeltaPct >= 0
                                      ? '+'
                                      : ''}
                                    {target.breakdown.clubRankDeltaPct}%
                                  </strong>
                                </span>
                              )}
                              <span>
                                위상{' '}
                                <strong
                                  className={
                                    target.breakdown.userPrestigeDeltaPct > 0
                                      ? 'text-emerald-300'
                                      : target.breakdown.userPrestigeDeltaPct < 0
                                        ? 'text-rose-300'
                                        : 'text-slate-300'
                                  }
                                >
                                  {target.breakdown.userPrestigeDeltaPct >= 0
                                    ? '+'
                                    : ''}
                                  {target.breakdown.userPrestigeDeltaPct}%
                                </strong>
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Offer CTA (opens One-Stop Negotiation Modal immediately) */}
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => handleStartNegotiation(target)}
                          className={`inline-flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-extrabold transition-colors ${
                            isSigned
                              ? 'bg-emerald-500/20 text-emerald-300 cursor-default'
                              : disabled
                                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                : isNegotiatingThis
                                  ? 'bg-sky-400 text-slate-950 cursor-pointer'
                                  : isLegend
                                    ? 'bg-amber-400 text-slate-950 hover:bg-amber-300 cursor-pointer'
                                    : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 cursor-pointer'
                          }`}
                        >
                          <Handshake className="w-3.5 h-3.5" />
                          {isSigned
                            ? '영입 완료'
                            : tm.attemptsRemaining <= 0
                              ? '협상 기회 소진'
                              : failCount > 0
                                ? `재도전 협상 제안 (${target.successChance}%)`
                                : `영입 협상 제안 (${target.successChance}%)`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ONE-STOP NEGOTIATION MODAL / BOTTOM DRAWER (Zero Scroll Back-and-Forth on PC & Mobile) */}
      {negotiatingTarget && (
        <div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-slate-950/90 p-2 sm:p-4"
          onClick={() => {
            setNegotiatingTarget(null);
            setSelectedOutSlot(null);
          }}
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-2xl border border-emerald-500/45 bg-[#111822] shadow-2xl flex flex-col max-h-[90dvh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 bg-[#0d131c] px-4 py-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2 py-0.5 text-[11px] font-extrabold text-emerald-300">
                  <Handshake className="w-3.5 h-3.5" />
                  원스톱 영입 협상
                </span>
                <span className="truncate text-xs font-bold text-slate-300 tabular-nums">
                  남은 기회 {tm.attemptsRemaining} / {tm.maxAttempts}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setNegotiatingTarget(null);
                  setSelectedOutSlot(null);
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-bold text-slate-300 hover:border-slate-500 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                닫기
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto p-3.5 sm:p-4 space-y-3.5">
              {/* 1. Head-to-Head Incoming vs Outgoing Summary */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-11 sm:items-center">
                {/* Incoming Target */}
                <div className="sm:col-span-5 rounded-xl border border-emerald-500/40 bg-[#0b1018] p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-black text-emerald-300">
                        IN 영입 대상
                      </span>
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-bold text-slate-200">
                        {formatMainPositions(negotiatingTarget.player)}
                      </span>
                      {evaluateManagerPlayerSynergy(
                        negotiatingTarget.player,
                        state.manager.traitId,
                      ).isMatch && (
                        <span className="inline-flex items-center gap-0.5 rounded bg-amber-400/20 px-1 py-0.5 text-[9px] font-extrabold text-amber-200">
                          <Star className="w-2.5 h-2.5 fill-amber-300 text-amber-300" />
                          감독 시너지
                        </span>
                      )}
                    </div>
                    <div className="truncate text-sm font-extrabold text-white">
                      {negotiatingTarget.player.name}
                    </div>
                    <div className="text-[10px] text-slate-400 tabular-nums">
                      €{negotiatingTarget.marketValueM}M · 성공 확률{' '}
                      <strong className="text-emerald-300">
                        {negotiatingTarget.successChance}%
                      </strong>
                    </div>
                  </div>
                  <div className="text-right tabular-nums shrink-0">
                    <div className="text-[9px] text-slate-500">슬롯 실효 OVR</div>
                    <div className="font-display text-2xl font-bold text-emerald-300 leading-none">
                      {incomingProjectedOvr ?? negotiatingTarget.player.ovr}
                    </div>
                  </div>
                </div>

                {/* Delta Badge */}
                <div className="sm:col-span-1 flex sm:flex-col items-center justify-center gap-1 text-center">
                  <ArrowLeftRight className="w-4 h-4 text-slate-500" />
                  {incomingProjectedOvr !== null &&
                    selectedOutEffectiveOvr !== null && (
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[10px] font-black tabular-nums ${
                          incomingProjectedOvr - selectedOutEffectiveOvr > 0
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : incomingProjectedOvr - selectedOutEffectiveOvr < 0
                              ? 'bg-rose-500/20 text-rose-300'
                              : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {incomingProjectedOvr - selectedOutEffectiveOvr >= 0
                          ? `+${incomingProjectedOvr - selectedOutEffectiveOvr}`
                          : incomingProjectedOvr - selectedOutEffectiveOvr}
                      </span>
                    )}
                </div>

                {/* Outgoing Squad Player */}
                <div className="sm:col-span-5 rounded-xl border border-rose-500/40 bg-[#0b1018] p-3 flex items-center justify-between gap-2">
                  {selectedOutPlayer && selectedOutSlot ? (
                    <>
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[9px] font-black text-rose-300">
                            OUT 방출 대상
                          </span>
                          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-bold text-slate-200">
                            {selectedOutSlot.area === 'starter'
                              ? `선발 ${formationSlots[selectedOutSlot.index]?.label}`
                              : `벤치 ${BENCH_SLOTS[selectedOutSlot.index]?.label}`}
                          </span>
                        </div>
                        <div className="truncate text-sm font-extrabold text-white">
                          {selectedOutPlayer.name}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          주포지션 {formatMainPositions(selectedOutPlayer)}
                        </div>
                      </div>
                      <div className="text-right tabular-nums shrink-0">
                        <div className="text-[9px] text-slate-500">현재 실효 OVR</div>
                        <div className="font-display text-2xl font-bold text-rose-300 leading-none">
                          {selectedOutEffectiveOvr}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-slate-400 py-2">
                      아래 목록에서 내보낼 우리 팀 선수를 선택하세요
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Inline Outgoing Squad Player Picker (Tabs + Grid) */}
              <div className="rounded-xl border border-slate-800 bg-[#0d131c] p-3 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-white">
                    내보낼 우리 팀 선수 선택 (클릭 시 즉시 변경)
                  </span>

                  <div className="inline-flex items-center rounded-lg border border-slate-800 bg-[#0b1018] p-0.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setOutFilterTab('recommended')}
                      className={`rounded-md px-2.5 py-1 font-bold transition-colors cursor-pointer ${
                        outFilterTab === 'recommended'
                          ? 'bg-emerald-500 text-slate-950'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      ⚡ AI 추천 (Top 5)
                    </button>
                    <button
                      type="button"
                      onClick={() => setOutFilterTab('starters')}
                      className={`rounded-md px-2.5 py-1 font-bold transition-colors cursor-pointer ${
                        outFilterTab === 'starters'
                          ? 'bg-emerald-500 text-slate-950'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      선발 11인
                    </button>
                    <button
                      type="button"
                      onClick={() => setOutFilterTab('bench')}
                      className={`rounded-md px-2.5 py-1 font-bold transition-colors cursor-pointer ${
                        outFilterTab === 'bench'
                          ? 'bg-emerald-500 text-slate-950'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      벤치 5인
                    </button>
                  </div>
                </div>

                {outFilterTab === 'bench' ? (
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {benchRows.map((row) => {
                      if (!row.player) return null;
                      const isSel =
                        selectedOutSlot?.area === 'bench' &&
                        selectedOutSlot.index === row.index;
                      const delta = negotiatingTarget.player.ovr - row.player.ovr;
                      const samePos =
                        row.player.position === negotiatingTarget.player.position;
                      return (
                        <button
                          key={`modal-bn-${row.index}`}
                          type="button"
                          onClick={() =>
                            setSelectedOutSlot({ area: 'bench', index: row.index })
                          }
                          className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left transition-all cursor-pointer tabular-nums ${
                            isSel
                              ? 'border-emerald-400 bg-emerald-500/15 ring-1 ring-emerald-400'
                              : 'border-slate-800 bg-[#0b1018] hover:border-slate-600'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-8 shrink-0 rounded bg-slate-900 py-0.5 text-center text-[10px] font-bold text-slate-300">
                              {row.slotLabel}
                            </span>
                            <div className="min-w-0">
                              <div className="truncate text-xs font-bold text-white">
                                {row.player.name}
                              </div>
                              <div className="flex items-center gap-1 text-[10px] text-slate-400">
                                <span>{formatMainPositions(row.player)}</span>
                                {samePos && (
                                  <span className="rounded bg-emerald-500/20 px-1 text-[9px] font-bold text-emerald-300">
                                    동일 포지션
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-display text-xs font-bold text-slate-200">
                              {row.player.ovr} →{' '}
                              <span className="text-emerald-300">
                                {negotiatingTarget.player.ovr}
                              </span>
                            </div>
                            <div
                              className={`text-[10px] font-extrabold ${
                                delta > 0
                                  ? 'text-emerald-300'
                                  : delta < 0
                                    ? 'text-rose-300'
                                    : 'text-slate-400'
                              }`}
                            >
                              {delta >= 0 ? `+${delta}` : delta} OVR
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {(() => {
                      const evaluatedStarters = starterRows
                        .filter((r) => r.player !== null)
                        .map((row) => {
                          const fit = evaluatePositionFit(
                            negotiatingTarget.player,
                            row.subPosition,
                            state.manager.traitId,
                          );
                          const delta = fit.effectiveOvr - row.effectiveOvr;
                          const fitBonus =
                            fit.fit === 'main'
                              ? 14
                              : fit.fit === 'secondary'
                                ? 5
                                : -12;
                          return {
                            row,
                            fit,
                            delta,
                            score: delta + fitBonus,
                          };
                        });

                      const listToRender =
                        outFilterTab === 'recommended'
                          ? [...evaluatedStarters]
                              .sort((a, b) => b.score - a.score)
                              .slice(0, 5)
                          : evaluatedStarters;

                      return listToRender.map(({ row, fit, delta }, rankIdx) => {
                        if (!row.player) return null;
                        const isSel =
                          selectedOutSlot?.area === 'starter' &&
                          selectedOutSlot.index === row.index;
                        return (
                          <button
                            key={`modal-st-${row.index}`}
                            type="button"
                            onClick={() =>
                              setSelectedOutSlot({
                                area: 'starter',
                                index: row.index,
                              })
                            }
                            className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left transition-all cursor-pointer tabular-nums ${
                              isSel
                                ? 'border-emerald-400 bg-emerald-500/15 ring-1 ring-emerald-400'
                                : 'border-slate-800 bg-[#0b1018] hover:border-slate-600'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className={`w-8 shrink-0 rounded py-0.5 text-center text-[10px] font-extrabold ${
                                  row.isPenaltyWeak
                                    ? 'bg-rose-500/20 text-rose-300'
                                    : row.isLowestOvrWeak
                                      ? 'bg-amber-500/20 text-amber-300'
                                      : 'bg-slate-800 text-emerald-300'
                                }`}
                              >
                                {row.slotLabel}
                              </span>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1">
                                  <span className="truncate text-xs font-bold text-white">
                                    {row.player.name}
                                  </span>
                                  {outFilterTab === 'recommended' &&
                                    rankIdx === 0 && (
                                      <span className="rounded bg-emerald-400 px-1 text-[8px] font-black text-slate-950 shrink-0">
                                        최적 추천
                                      </span>
                                    )}
                                </div>
                                <div className="flex flex-wrap items-center gap-1 text-[10px] text-slate-400">
                                  <span>{formatMainPositions(row.player)}</span>
                                  {fit.fit === 'main' && (
                                    <span className="rounded bg-emerald-500/20 px-1 text-[9px] font-bold text-emerald-300">
                                      주포지션 일치
                                    </span>
                                  )}
                                  {fit.fit === 'secondary' && (
                                    <span className="rounded bg-amber-500/20 px-1 text-[9px] font-bold text-amber-300">
                                      부포지션 ({fit.penalty})
                                    </span>
                                  )}
                                  {fit.fit === 'severe' && (
                                    <span className="rounded bg-rose-500/20 px-1 text-[9px] font-bold text-rose-300">
                                      비적합 ({fit.penalty})
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <div className="font-display text-xs font-bold text-slate-200">
                                {row.effectiveOvr} →{' '}
                                <span className="text-emerald-300">
                                  {fit.effectiveOvr}
                                </span>
                              </div>
                              <div
                                className={`text-[10px] font-extrabold ${
                                  delta > 0
                                    ? 'text-emerald-300'
                                    : delta < 0
                                      ? 'text-rose-300'
                                      : 'text-slate-400'
                                }`}
                              >
                                {delta >= 0 ? `+${delta}` : delta} OVR
                              </div>
                            </div>
                          </button>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer: One-Click Confirm Offer */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 bg-[#0d131c] px-4 py-3">
              <div className="text-xs text-slate-300 tabular-nums">
                이적료{' '}
                <strong className="text-amber-300">
                  €{negotiatingTarget.marketValueM}M
                </strong>{' '}
                · 영입 성공 확률{' '}
                <strong className="text-emerald-300">
                  {negotiatingTarget.successChance}%
                </strong>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    setNegotiatingTarget(null);
                    setSelectedOutSlot(null);
                  }}
                  className="rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-xs font-bold text-slate-300 hover:border-slate-500 hover:text-white cursor-pointer"
                >
                  취소
                </button>
                <button
                  id="submit-transfer-offer-btn"
                  type="button"
                  disabled={!selectedOutSlot || tm.attemptsRemaining <= 0}
                  onClick={handleConfirmOffer}
                  className="inline-flex flex-1 sm:flex-initial items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-extrabold text-slate-950 hover:bg-emerald-400 disabled:opacity-40 transition-colors cursor-pointer"
                >
                  <Handshake className="w-4 h-4" />
                  오퍼 제출 · 영입 시도 (성공률 {negotiatingTarget.successChance}%)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (embedded) return innerContent;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/88 p-3 sm:p-5 backdrop-blur-sm">
      <div className="w-full max-w-7xl shadow-2xl">{innerContent}</div>
    </div>
  );
}
