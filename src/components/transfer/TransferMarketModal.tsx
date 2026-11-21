import {
  AlertCircle,
  ArrowLeftRight,
  CheckCircle2,
  Crown,
  Dices,
  Handshake,
  Inbox,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { BENCH_SLOTS, FORMATIONS } from '../../data/formations';
import {
  getInjuryTooltip,
  getMoraleLabel,
  getMoraleTier,
  isPlayerActivelyInjured,
} from '../../engine/conditionEngine';
import { ALL_CLUBS_WITH_LEAGUE } from '../../engine/dataLoader';
import { USER_CLUB_ID } from '../../engine/matchEngine';
import { formatMainPositions } from '../../engine/positionEngine';
import { getUserRank } from '../../engine/standingsEngine';
import {
  analyzeClubPositionNeeds,
  buildTradeClubOfferForClub,
  computePlayerTradePoints,
  evaluateTradePackage,
  selectAutoFillerPlayers,
} from '../../engine/transferEngine';
import { useGame } from '../../store/GameContext';
import type {
  IncomingTradeOffer,
  TransferClubOffer,
  TransferTargetPlayer,
} from '../../types/game';
import {
  getCardTier,
  LEAGUE_LABELS,
  type Player,
  type Position,
} from '../../types/player';
import { CountryFlagSvg } from '../common/CountryFlagSvg';
import { JerseySvg } from '../common/JerseySvg';
import { PixelStatusIcon } from '../common/PixelStatusIcon';

interface TransferMarketModalProps {
  embedded?: boolean;
}

type MarketTab = 'explore' | 'incoming';
type PosFilter = 'ALL' | Position;

interface SlotRef {
  area: 'starter' | 'bench';
  index: number;
}

const POS_BADGE_KO: Record<Position, string> = {
  GK: 'GK',
  DF: 'DF',
  MF: 'MF',
  FW: 'FW',
};

function slotKey(ref: SlotRef): string {
  return `${ref.area}:${ref.index}`;
}

export function TransferMarketModal({
  embedded = false,
}: TransferMarketModalProps) {
  const {
    state,
    transferSpinClubs,
    transferSubmitOffer,
    tradeSubmitPackage,
    tradeAcceptIncoming,
    tradeRejectIncoming,
    transferCloseWindow,
  } = useGame();

  const season = state.season;
  const tm = season?.transferMarket ?? null;

  const incomingOffers = tm?.incomingOffers ?? [];
  const pendingIncomingCount = incomingOffers.filter(
    (o) => o.status === 'pending',
  ).length;

  const [activeTab, setActiveTab] = useState<MarketTab>('explore');
  const [animating, setAnimating] = useState(false);
  const [lockedCount, setLockedCount] = useState(tm?.hasSpunClubs ? 3 : 0);
  const [tick, setTick] = useState(0);
  const [activeReelIdx, setActiveReelIdx] = useState<number>(0);
  const [counterOfferClub, setCounterOfferClub] =
    useState<TransferClubOffer | null>(null);
  const [posFilter, setPosFilter] = useState<PosFilter>('ALL');

  // NBA Multi-player Trade Package State
  const [selectedAiPlayerIds, setSelectedAiPlayerIds] = useState<string[]>([]);
  const [selectedUserSlots, setSelectedUserSlots] = useState<SlotRef[]>([]);
  const [customFillerIds, setCustomFillerIds] = useState<string[] | null>(null);

  // Legend FA 1:1 Special Slot State
  const [legendOutSlot, setLegendOutSlot] = useState<SlotRef | null>(null);

  useEffect(() => {
    if (!animating) return;
    const iv = window.setInterval(() => setTick((t) => t + 1), 65);
    const t1 = window.setTimeout(() => setLockedCount(1), 340);
    const t2 = window.setTimeout(() => setLockedCount(2), 640);
    const t3 = window.setTimeout(() => {
      setLockedCount(3);
      setAnimating(false);
      window.clearInterval(iv);
    }, 940);
    return () => {
      window.clearInterval(iv);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [animating]);

  const formationSlots = FORMATIONS[state.formation].slots;

  const userRosterEntries = useMemo(() => {
    const entries: {
      ref: SlotRef;
      key: string;
      player: Player;
      slotLabel: string;
      isStarter: boolean;
    }[] = [];
    state.starters.forEach((p, idx) => {
      if (!p) return;
      entries.push({
        ref: { area: 'starter', index: idx },
        key: `starter:${idx}`,
        player: p,
        slotLabel: formationSlots[idx]?.label ?? `선발${idx + 1}`,
        isStarter: true,
      });
    });
    state.bench.forEach((p, idx) => {
      if (!p) return;
      entries.push({
        ref: { area: 'bench', index: idx },
        key: `bench:${idx}`,
        player: p,
        slotLabel: BENCH_SLOTS[idx]?.label ?? `벤치${idx + 1}`,
        isStarter: false,
      });
    });
    return entries;
  }, [state.starters, state.bench, formationSlots]);

  const userSquadPlayers = useMemo(
    () => userRosterEntries.map((e) => e.player),
    [userRosterEntries],
  );

  // Active partner club offer (either counter-offer club from incoming tab OR selected roulette reel)
  const activeClubOffer: TransferClubOffer | null = useMemo(() => {
    if (counterOfferClub) return counterOfferClub;
    if (!tm || !tm.hasSpunClubs || tm.rolledClubs.length === 0) return null;
    return tm.rolledClubs[activeReelIdx] ?? tm.rolledClubs[0] ?? null;
  }, [counterOfferClub, tm, activeReelIdx]);

  const activePartnerAiRoster = useMemo(() => {
    if (!season || !activeClubOffer || activeClubOffer.isLegendSlot || !activeClubOffer.club) {
      return [] as Player[];
    }
    const cid = activeClubOffer.club.id;
    const lid = activeClubOffer.leagueId;
    if (lid === 'LEGEND') return [];
    const live =
      lid === season.leagueId
        ? season.aiRosters[cid]
        : season.otherLeagues?.[lid]?.aiRosters?.[cid];
    if (live && live.length >= 11) return live;
    return activeClubOffer.squad.map((t) => t.player);
  }, [season, activeClubOffer]);

  const activeClubNeeds = useMemo(() => {
    if (!activeClubOffer || activeClubOffer.isLegendSlot) return null;
    if (activeClubOffer.clubNeeds) return activeClubOffer.clubNeeds;
    return analyzeClubPositionNeeds(activePartnerAiRoster);
  }, [activeClubOffer, activePartnerAiRoster]);

  // Resolve selected players cleanly (filtering out anyone already traded away)
  const selectedAiPlayers = useMemo(() => {
    if (!activeClubOffer || activeClubOffer.isLegendSlot) return [] as Player[];
    const byId = new Map(activeClubOffer.squad.map((t) => [t.player.id, t.player]));
    const signedSet = new Set(tm?.signedPlayerIds ?? []);
    return selectedAiPlayerIds
      .filter((id) => !signedSet.has(id))
      .map((id) => byId.get(id))
      .filter((p): p is Player => Boolean(p));
  }, [activeClubOffer, selectedAiPlayerIds, tm]);

  const selectedUserPlayers = useMemo(() => {
    return selectedUserSlots
      .map((ref) =>
        ref.area === 'starter'
          ? state.starters[ref.index]
          : state.bench[ref.index],
      )
      .filter((p): p is Player => p !== null);
  }, [selectedUserSlots, state.starters, state.bench]);

  // Option 3: Auto-selected rotation fillers for 2:1 / 3:1 deals
  const neededAutoFillers = Math.max(
    0,
    selectedUserPlayers.length - selectedAiPlayers.length,
  );

  const autoFillerPlayers = useMemo(() => {
    if (
      neededAutoFillers <= 0 ||
      !activeClubOffer ||
      activeClubOffer.isLegendSlot ||
      !activeClubOffer.club ||
      activeClubOffer.leagueId === 'LEGEND'
    ) {
      return [] as Player[];
    }
    const targetIds = new Set(selectedAiPlayers.map((p) => p.id));
    const excludeIds = new Set(userSquadPlayers.map((p) => p.id));

    if (customFillerIds && customFillerIds.length === neededAutoFillers) {
      const byId = new Map(activePartnerAiRoster.map((p) => [p.id, p]));
      const custom = customFillerIds
        .map((id) => byId.get(id))
        .filter((p): p is Player => Boolean(p))
        .filter((p) => !targetIds.has(p.id));
      if (custom.length === neededAutoFillers) return custom;
    }

    return selectAutoFillerPlayers({
      aiRoster: activePartnerAiRoster,
      aiTargetIds: targetIds,
      userSentPlayers: selectedUserPlayers,
      neededCount: neededAutoFillers,
      club: activeClubOffer.club,
      leagueId: activeClubOffer.leagueId,
      excludeIds,
    });
  }, [
    neededAutoFillers,
    activeClubOffer,
    activePartnerAiRoster,
    selectedAiPlayers,
    selectedUserPlayers,
    userSquadPlayers,
    customFillerIds,
  ]);

  // Available candidate backups on partner club so user can optionally swap the Option 3 filler
  const optionalFillerPool = useMemo(() => {
    if (neededAutoFillers <= 0 || !activeClubOffer || activeClubOffer.isLegendSlot) {
      return [] as Player[];
    }
    const targetIds = new Set(selectedAiPlayers.map((p) => p.id));
    return [...activePartnerAiRoster]
      .filter((p) => !targetIds.has(p.id))
      .sort((a, b) => a.ovr - b.ovr)
      .slice(0, 6);
  }, [neededAutoFillers, activeClubOffer, activePartnerAiRoster, selectedAiPlayers]);

  // Live Trade Package Evaluation
  const tradeEval = useMemo(() => {
    if (
      !season ||
      !activeClubOffer ||
      activeClubOffer.isLegendSlot ||
      !activeClubOffer.club ||
      !activeClubNeeds
    ) {
      return null;
    }
    return evaluateTradePackage({
      userSentPlayers: selectedUserPlayers,
      aiTargetPlayers: selectedAiPlayers,
      aiFillerPlayers: autoFillerPlayers,
      aiClub: activeClubOffer.club,
      aiRoster: activePartnerAiRoster,
      aiNeeds: activeClubNeeds,
      userSquad: userSquadPlayers,
      userRank: getUserRank(season.standings, USER_CLUB_ID),
      userLeagueSize: season.standings.length || 20,
      aiClubRank: activeClubOffer.clubRank,
      aiLeagueSize: activeClubOffer.leagueSize,
      allPlayerStats: season.allPlayerStats,
      conditionMap: season.playerConditions,
      championBonusActive: Boolean(tm?.championBonusActive),
    });
  }, [
    season,
    activeClubOffer,
    activeClubNeeds,
    selectedUserPlayers,
    selectedAiPlayers,
    autoFillerPlayers,
    activePartnerAiRoster,
    userSquadPlayers,
    tm,
  ]);

  if (!season || !tm || !tm.isOpen) return null;

  const isUclSpecial = Boolean(tm.isUclSpecial);
  const isChampBonus = Boolean(tm.championBonusActive);

  const resetTradeBuilder = () => {
    setSelectedAiPlayerIds([]);
    setSelectedUserSlots([]);
    setCustomFillerIds(null);
  };

  const handleSelectClubReel = (idx: number) => {
    setCounterOfferClub(null);
    setActiveReelIdx(idx);
    setPosFilter('ALL');
    resetTradeBuilder();
    setLegendOutSlot(null);
  };

  const handleSpin = () => {
    if (tm.hasSpunClubs || animating) return;
    setLockedCount(0);
    setAnimating(true);
    transferSpinClubs();
    setActiveReelIdx(0);
    setCounterOfferClub(null);
    resetTradeBuilder();
  };

  const handleToggleAiPlayer = (playerId: string) => {
    setCustomFillerIds(null);
    setSelectedAiPlayerIds((prev) => {
      if (prev.includes(playerId)) return prev.filter((id) => id !== playerId);
      if (prev.length >= 3) return prev;
      return [...prev, playerId];
    });
  };

  const handleToggleUserSlot = (ref: SlotRef) => {
    setCustomFillerIds(null);
    const k = slotKey(ref);
    setSelectedUserSlots((prev) => {
      if (prev.some((s) => slotKey(s) === k)) {
        return prev.filter((s) => slotKey(s) !== k);
      }
      if (prev.length >= 3) return prev;
      return [...prev, ref];
    });
  };

  const handleCycleFiller = (fillerIndex: number) => {
    if (optionalFillerPool.length <= 1) return;
    const currentIds = autoFillerPlayers.map((p) => p.id);
    const currentId = currentIds[fillerIndex];
    const currentPoolIdx = optionalFillerPool.findIndex((p) => p.id === currentId);
    for (let step = 1; step <= optionalFillerPool.length; step += 1) {
      const nextCand =
        optionalFillerPool[(currentPoolIdx + step) % optionalFillerPool.length];
      if (!currentIds.includes(nextCand.id)) {
        const nextIds = [...currentIds];
        nextIds[fillerIndex] = nextCand.id;
        setCustomFillerIds(nextIds);
        return;
      }
    }
  };

  const handleStartCounterOffer = (offer: IncomingTradeOffer) => {
    const ownedIds = new Set(userSquadPlayers.map((p) => p.id));
    const excludeIds = new Set<string>([
      ...ownedIds,
      ...(season.departedPlayerIds ?? []),
    ]);
    const isUserLeague = offer.leagueId === season.leagueId;
    const liveRoster = isUserLeague
      ? season.aiRosters[offer.club.id]
      : season.otherLeagues?.[offer.leagueId]?.aiRosters?.[offer.club.id];
    const statsMap = isUserLeague
      ? season.allPlayerStats
      : season.otherLeagues?.[offer.leagueId]?.playerStats ??
        season.allPlayerStats;

    const clubOffer = buildTradeClubOfferForClub({
      club: offer.club,
      leagueId: offer.leagueId,
      clubRank: offer.clubRank,
      leagueSize: offer.leagueSize,
      currentRound: season.currentRound,
      totalRounds: season.totalRounds,
      windowIndex: tm.windowIndex,
      userRank: getUserRank(season.standings, USER_CLUB_ID),
      userLeagueSize: season.standings.length || 20,
      isUserLeague,
      aiRoster: liveRoster,
      allPlayerStats: statsMap,
      ownedIds,
      excludeIds,
      championBonusActive: isChampBonus,
    });

    // Ensure AI's offered players are present in squad list
    setCounterOfferClub(clubOffer);
    setSelectedAiPlayerIds(offer.aiOffersPlayers.map((p) => p.id));

    const preSlots: SlotRef[] = [];
    for (const req of offer.userRequestedPlayers) {
      const found = userRosterEntries.find((e) => e.player.id === req.id);
      if (found) preSlots.push(found.ref);
    }
    setSelectedUserSlots(preSlots);
    setCustomFillerIds(null);
    setPosFilter('ALL');
    setActiveTab('explore');
  };

  const handleSubmitTrade = () => {
    if (
      !activeClubOffer ||
      activeClubOffer.isLegendSlot ||
      !activeClubOffer.club ||
      activeClubOffer.leagueId === 'LEGEND' ||
      !tradeEval ||
      tradeEval.blockedReason ||
      tradeEval.requiredUserReleaseCount > 0 ||
      tm.attemptsRemaining <= 0
    ) {
      return;
    }

    tradeSubmitPackage({
      partnerClub: activeClubOffer.club,
      partnerLeagueId: activeClubOffer.leagueId,
      partnerClubRank: activeClubOffer.clubRank,
      partnerLeagueSize: activeClubOffer.leagueSize,
      userSentSlots: selectedUserSlots,
      aiTargetPlayers: selectedAiPlayers,
      aiFillerPlayers: autoFillerPlayers,
    });
    resetTradeBuilder();
  };

  const handleSubmitLegendOffer = (target: TransferTargetPlayer) => {
    if (!legendOutSlot || tm.attemptsRemaining <= 0) return;
    transferSubmitOffer(target, legendOutSlot);
    setLegendOutSlot(null);
  };

  const filteredPartnerSquad = useMemo(() => {
    if (!activeClubOffer) return [];
    const signedSet = new Set(tm.signedPlayerIds);
    return activeClubOffer.squad.filter((t) => {
      if (signedSet.has(t.player.id)) return false;
      if (posFilter === 'ALL') return true;
      return t.player.position === posFilter;
    });
  }, [activeClubOffer, posFilter, tm.signedPlayerIds]);

  const canSubmitTrade = Boolean(
    tradeEval &&
      !tradeEval.blockedReason &&
      tradeEval.requiredUserReleaseCount === 0 &&
      selectedAiPlayers.length > 0 &&
      selectedUserPlayers.length > 0 &&
      tm.attemptsRemaining > 0,
  );

  const shellContent = (
    <div
      className={`flex flex-col overflow-hidden bg-[#0e1522] border border-slate-800 shadow-2xl ${
        embedded
          ? 'w-full rounded-2xl'
          : 'w-full max-w-6xl max-h-[94dvh] rounded-2xl'
      }`}
    >
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-[#090f19] px-4 py-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-sky-400/40 bg-sky-500/15 text-sky-300">
            <ArrowLeftRight className="h-4.5 w-4.5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm sm:text-base font-black text-white">
                {isUclSpecial
                  ? '⭐ UCL 특별 트레이드 시장'
                  : `🔄 제 ${tm.windowIndex}차 구단 트레이드 시장 (${tm.triggerRound}R)`}
              </h2>
              <span className="rounded-md border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-extrabold text-emerald-300 tabular-nums">
                협상 기회 {tm.attemptsRemaining} / {tm.maxAttempts}
              </span>
              {tm.legendBonusActive && (
                <span className="rounded-md border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                  👑 {isChampBonus ? '우승 레전드 보너스 5.5%' : '상위권 레전드 보너스 4.0%'}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              1:1 · 2:1 · 3:1 NBA식 패키지 트레이드 · 상대 포지션 니즈 보너스 · 로스터 16인 자동 균형
            </p>
          </div>
        </div>

        <button
          id="close-transfer-window-btn"
          type="button"
          onClick={transferCloseWindow}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-extrabold text-slate-200 hover:border-emerald-400/60 hover:text-white cursor-pointer"
        >
          <X className="h-3.5 w-3.5" />
          {isUclSpecial ? '트레이드 종료 → UCL 시작' : '이적시장 닫고 계속'}
        </button>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 bg-[#0b111c] px-4 py-2">
        <button
          type="button"
          onClick={() => setActiveTab('explore')}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-extrabold transition cursor-pointer ${
            activeTab === 'explore'
              ? 'bg-sky-400 text-slate-950 shadow'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <Handshake className="h-3.5 w-3.5" />
          구단 트레이드 탐색
          {counterOfferClub && (
            <span className="rounded bg-slate-950/25 px-1.5 py-0.5 text-[10px]">
              역제안 중
            </span>
          )}
        </button>
        <button
          id="incoming-trade-offers-tab"
          type="button"
          onClick={() => setActiveTab('incoming')}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-extrabold transition cursor-pointer ${
            activeTab === 'incoming'
              ? 'bg-amber-400 text-slate-950 shadow'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <Inbox className="h-3.5 w-3.5" />
          받은 트레이드 제안
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-black tabular-nums ${
              pendingIncomingCount > 0
                ? activeTab === 'incoming'
                  ? 'bg-slate-950 text-amber-300'
                  : 'bg-amber-500 text-slate-950'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {pendingIncomingCount}
          </span>
        </button>
        <div className="ml-auto hidden sm:flex items-center gap-2 text-[11px] text-slate-400">
          <Users className="h-3.5 w-3.5 text-emerald-400" />
          <span>우리 로스터 {userSquadPlayers.length}인 (선발 11 · 벤치 5 유지)</span>
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-4">
        {/* Last Negotiation Result Banner */}
        {tm.lastOfferResult && (
          <div
            className={`rounded-xl border-2 px-4 py-3 space-y-1.5 ${
              tm.lastOfferResult.success
                ? 'border-emerald-400/60 bg-emerald-950/35 text-emerald-100'
                : 'border-rose-400/55 bg-rose-950/35 text-rose-100'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {tm.lastOfferResult.success ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400 mt-0.5" />
              ) : (
                <XCircle className="h-5 w-5 shrink-0 text-rose-400 mt-0.5" />
              )}
              <div className="min-w-0 space-y-1">
                <div className="text-xs sm:text-sm font-black">
                  {tm.lastOfferResult.message}
                </div>
                {tm.lastOfferResult.gmReaction && (
                  <p className="text-[11px] text-slate-300 italic">
                    {tm.lastOfferResult.gmReaction}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: INCOMING AI TRADE OFFERS (0-5 per window) */}
        {activeTab === 'incoming' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-black text-white">
                  📩 타 구단으로부터 도착한 트레이드 제안 ({incomingOffers.length}건)
                </h3>
                <p className="text-[11px] text-slate-400">
                  즉시 수락하면 100% 성사되며, [조건 수정 · 역제안]으로 다대일(2:1 · 3:1) 패키지를 재구성할 수도 있습니다.
                </p>
              </div>
            </div>

            {incomingOffers.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-[#0b111c] p-8 text-center space-y-3">
                <Inbox className="h-9 w-9 mx-auto text-slate-600" />
                <div className="text-sm font-bold text-slate-300">
                  이번 이적시장에는 타 구단에서 먼저 도착한 트레이드 제안이 없습니다.
                </div>
                <p className="text-xs text-slate-500">
                  [구단 트레이드 탐색] 탭에서 구단 룰렛을 돌려 직접 트레이드를 제안해 보세요!
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('explore')}
                  className="rounded-xl bg-sky-400 px-4 py-2 text-xs font-black text-slate-950 hover:bg-sky-300 cursor-pointer"
                >
                  구단 트레이드 탐색으로 이동 →
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {incomingOffers.map((offer) => {
                  const isPending = offer.status === 'pending';
                  const isAccepted = offer.status === 'accepted';
                  return (
                    <div
                      key={offer.id}
                      className={`rounded-2xl border p-4 space-y-3 ${
                        isAccepted
                          ? 'border-emerald-500/50 bg-emerald-950/20'
                          : !isPending
                            ? 'border-slate-800 bg-slate-950/50 opacity-60'
                            : 'border-amber-400/40 bg-[#101827]'
                      }`}
                    >
                      {/* Club header */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <JerseySvg
                            primaryColor={offer.club.primaryColor}
                            secondaryColor={offer.club.secondaryColor}
                            pattern={offer.club.pattern}
                            label={offer.club.shortName}
                            size={34}
                          />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="truncate text-sm font-black text-white">
                                {offer.club.name}
                              </span>
                              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-300">
                                {LEAGUE_LABELS[offer.leagueId]} {offer.clubRank}위
                              </span>
                            </div>
                            <div className="mt-0.5 flex flex-wrap gap-1">
                              {offer.clubNeeds.neededPositions.map((pos, idx) => (
                                <span
                                  key={`${offer.id}-need-${pos}`}
                                  className="rounded bg-sky-500/15 border border-sky-400/35 px-1.5 py-px text-[9px] font-extrabold text-sky-200"
                                >
                                  {idx === 0 ? '🔥 최우선 니즈' : '✨ 보강'} {pos}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        {!isPending && (
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-black ${
                              isAccepted
                                ? 'bg-emerald-500 text-slate-950'
                                : 'bg-slate-700 text-slate-300'
                            }`}
                          >
                            {isAccepted ? '성사됨' : '거절/만료'}
                          </span>
                        )}
                      </div>

                      {/* Swap visual */}
                      <div className="grid grid-cols-11 items-center gap-2 rounded-xl border border-slate-800 bg-[#0b1019] p-3">
                        <div className="col-span-5 space-y-1.5">
                          <div className="text-[10px] font-bold text-emerald-300">
                            📥 우리가 받는 선수
                          </div>
                          {offer.aiOffersPlayers.map((p) => {
                            const val = computePlayerTradePoints({
                              player: p,
                              stats: season.allPlayerStats[p.id] ?? null,
                              conditionMap: season.playerConditions,
                            });
                            return (
                              <div
                                key={p.id}
                                className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 px-2.5 py-1.5"
                              >
                                <div className="flex items-center gap-1.5">
                                  <CountryFlagSvg
                                    code={p.nationalityCode}
                                    nationality={p.nationality}
                                    size="xs"
                                  />
                                  <span className="truncate text-xs font-extrabold text-white">
                                    {p.name}
                                  </span>
                                </div>
                                <div className="mt-0.5 flex items-center justify-between text-[10px] text-slate-300 tabular-nums">
                                  <span>
                                    {formatMainPositions(p)} · STA {p.stamina}
                                  </span>
                                  <span className="font-black text-emerald-300">
                                    OVR {p.ovr} · {val.effectiveTp}TP
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="col-span-1 flex justify-center">
                          <ArrowLeftRight className="h-4 w-4 text-amber-400" />
                        </div>

                        <div className="col-span-5 space-y-1.5">
                          <div className="text-[10px] font-bold text-rose-300">
                            📤 상대가 요청한 선수
                          </div>
                          {offer.userRequestedPlayers.map((p) => {
                            const val = computePlayerTradePoints({
                              player: p,
                              receivingClubNeeds: offer.clubNeeds,
                              stats: season.allPlayerStats[p.id] ?? null,
                              conditionMap: season.playerConditions,
                            });
                            return (
                              <div
                                key={p.id}
                                className="rounded-lg border border-rose-500/30 bg-rose-950/20 px-2.5 py-1.5"
                              >
                                <div className="flex items-center gap-1.5">
                                  <CountryFlagSvg
                                    code={p.nationalityCode}
                                    nationality={p.nationality}
                                    size="xs"
                                  />
                                  <span className="truncate text-xs font-extrabold text-white">
                                    {p.name}
                                  </span>
                                </div>
                                <div className="mt-0.5 flex items-center justify-between text-[10px] text-slate-300 tabular-nums">
                                  <span>
                                    {formatMainPositions(p)} · STA {p.stamina}
                                  </span>
                                  <span className="font-black text-rose-300">
                                    OVR {p.ovr} · {val.effectiveTp}TP
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <p className="rounded-lg bg-slate-950/70 px-3 py-2 text-[11px] leading-relaxed text-slate-300 italic">
                        {offer.club.shortName} 단장: {offer.aiPitch}
                      </p>

                      {isPending && (
                        <div className="flex flex-wrap items-center gap-2 pt-0.5">
                          <button
                            type="button"
                            disabled={tm.attemptsRemaining <= 0}
                            onClick={() => tradeAcceptIncoming(offer.id)}
                            className="flex-1 min-w-[110px] rounded-xl bg-emerald-500 px-3 py-2 text-xs font-black text-slate-950 hover:bg-emerald-400 disabled:opacity-40 cursor-pointer"
                          >
                            ✅ 즉시 수락
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStartCounterOffer(offer)}
                            className="flex-1 min-w-[110px] rounded-xl border border-sky-400/45 bg-sky-500/15 px-3 py-2 text-xs font-extrabold text-sky-200 hover:bg-sky-500/25 cursor-pointer"
                          >
                            🔄 조건 수정 · 역제안
                          </button>
                          <button
                            type="button"
                            onClick={() => tradeRejectIncoming(offer.id)}
                            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-400 hover:border-rose-400/50 hover:text-rose-300 cursor-pointer"
                          >
                            거절
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 1: EXPLORE CLUBS & NBA TRADE BUILDER */}
        {activeTab === 'explore' && (
          <div className="space-y-4">
            {/* Step 1: 3-Club Roulette Banner (when not yet spun or showing 3 rolled clubs) */}
            {!tm.hasSpunClubs && !counterOfferClub ? (
              <div className="rounded-2xl border border-sky-500/35 bg-gradient-to-b from-[#111c30] to-[#0c1320] p-6 text-center space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/35 bg-sky-500/15 px-3 py-1 text-xs font-bold text-sky-200">
                  <Dices className="h-3.5 w-3.5" />
                  트레이드 협상 구단 3곳 추첨
                </div>
                <h3 className="text-lg sm:text-xl font-black text-white">
                  이번 이적시장에서 협상 테이블을 열 3개 구단을 추첨하세요!
                </h3>
                <p className="max-w-xl mx-auto text-xs text-slate-400">
                  각 구단의 실제 스쿼드 약점(포지션 니즈)이 공개됩니다. 1:1뿐 아니라 2:1 · 3:1 패키지로 슈퍼스타 트레이드를 노려보세요!
                </p>

                {/* 3 Slot Reels Preview */}
                <div className="grid grid-cols-3 gap-3 max-w-xl mx-auto">
                  {[0, 1, 2].map((rIdx) => {
                    const spinClub =
                      ALL_CLUBS_WITH_LEAGUE[
                        (tick * 7 + rIdx * 19) % ALL_CLUBS_WITH_LEAGUE.length
                      ];
                    return (
                      <div
                        key={`reel-pre-${rIdx}`}
                        className="rounded-xl border border-slate-700 bg-[#0a101b] p-3 flex flex-col items-center gap-2"
                      >
                        <JerseySvg
                          primaryColor={
                            animating ? spinClub.club.primaryColor : '#334155'
                          }
                          secondaryColor={
                            animating ? spinClub.club.secondaryColor : '#1e293b'
                          }
                          pattern={animating ? spinClub.club.pattern : 'solid'}
                          label={animating ? spinClub.club.shortName : '?'}
                          size={40}
                        />
                        <div className="text-[11px] font-bold text-slate-300 truncate max-w-full">
                          {animating ? spinClub.club.name : `협상 슬롯 #${rIdx + 1}`}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap justify-center gap-2.5 pt-1">
                  <button
                    id="spin-transfer-clubs-btn"
                    type="button"
                    disabled={animating}
                    onClick={handleSpin}
                    className="inline-flex items-center gap-2 rounded-xl bg-sky-400 px-6 py-3 text-sm font-black text-slate-950 shadow-lg hover:bg-sky-300 disabled:opacity-50 cursor-pointer"
                  >
                    <Dices className="h-4 w-4" />
                    {animating ? '협상 구단 추첨 중...' : '협상 구단 3곳 추첨하기'}
                  </button>
                  {pendingIncomingCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('incoming')}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/45 bg-amber-500/15 px-4 py-3 text-xs font-extrabold text-amber-200 hover:bg-amber-500/25 cursor-pointer"
                    >
                      <Inbox className="h-4 w-4" />
                      도착한 제안 {pendingIncomingCount}건 먼저 보기
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                {/* Partner Club Selector Strip */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {tm.rolledClubs.map((offer, idx) => {
                    const isSelected =
                      !counterOfferClub && activeReelIdx === idx;
                    const isLocked = idx < lockedCount || !animating;
                    const spinClub =
                      ALL_CLUBS_WITH_LEAGUE[
                        (tick * 7 + idx * 23) % ALL_CLUBS_WITH_LEAGUE.length
                      ];
                    return (
                      <button
                        key={`club-reel-${idx}`}
                        type="button"
                        onClick={() => handleSelectClubReel(idx)}
                        className={`rounded-xl border p-3 text-left transition cursor-pointer ${
                          offer.isLegendSlot
                            ? isSelected
                              ? 'border-amber-400 bg-amber-950/35 ring-1 ring-amber-400/50'
                              : 'border-amber-500/45 bg-amber-950/15 hover:border-amber-400'
                            : isSelected
                              ? 'border-sky-400 bg-sky-950/35 ring-1 ring-sky-400/50'
                              : 'border-slate-800 bg-[#101827] hover:border-slate-600'
                        }`}
                      >
                        {!isLocked ? (
                          <div className="flex items-center gap-2.5">
                            <JerseySvg
                              primaryColor={spinClub.club.primaryColor}
                              secondaryColor={spinClub.club.secondaryColor}
                              pattern={spinClub.club.pattern}
                              label={spinClub.club.shortName}
                              size={34}
                            />
                            <div className="text-xs font-bold text-slate-300">
                              추첨 중...
                            </div>
                          </div>
                        ) : offer.isLegendSlot ? (
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-400 text-slate-950">
                              <Crown className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-black text-amber-300">
                                👑 LEGEND FA 특별 슬롯
                              </div>
                              <div className="truncate text-[11px] text-amber-100 font-bold">
                                {offer.squad[0]?.player.name ?? '레전드'} (OVR{' '}
                                {offer.squad[0]?.player.ovr})
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2.5">
                              {offer.club && (
                                <JerseySvg
                                  primaryColor={offer.club.primaryColor}
                                  secondaryColor={offer.club.secondaryColor}
                                  pattern={offer.club.pattern}
                                  label={offer.club.shortName}
                                  size={34}
                                />
                              )}
                              <div className="min-w-0">
                                <div className="truncate text-xs font-black text-white">
                                  {offer.club?.name}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {offer.leagueId !== 'LEGEND'
                                    ? LEAGUE_LABELS[offer.leagueId]
                                    : ''}{' '}
                                  {offer.clubRank}위 · 선수 {offer.squad.length}명
                                </div>
                              </div>
                            </div>
                            {offer.clubNeeds && (
                              <div className="flex flex-wrap gap-1">
                                {offer.clubNeeds.neededPositions.map((p, nIdx) => (
                                  <span
                                    key={`${idx}-need-${p}`}
                                    className={`rounded px-1.5 py-0.5 text-[9px] font-extrabold ${
                                      nIdx === 0
                                        ? 'bg-amber-500/20 text-amber-200 border border-amber-400/40'
                                        : 'bg-sky-500/15 text-sky-200 border border-sky-400/35'
                                    }`}
                                  >
                                    {nIdx === 0 ? '🔥 최우선' : '✨ 필요'} {POS_BADGE_KO[p]}
                                  </span>
                                ))}
                                {offer.clubNeeds.saturatedPositions.map((p) => (
                                  <span
                                    key={`${idx}-sat-${p}`}
                                    className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-bold text-slate-400"
                                  >
                                    포화 {POS_BADGE_KO[p]}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Counter-offer active club pill */}
                {counterOfferClub && counterOfferClub.club && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-400/45 bg-amber-950/25 px-3.5 py-2">
                    <div className="flex items-center gap-2 text-xs font-extrabold text-amber-200">
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>
                        역제안 협상 테이블: {counterOfferClub.club.name} (
                        {counterOfferClub.clubNeeds?.summaryText})
                      </span>
                    </div>
                    {tm.hasSpunClubs && (
                      <button
                        type="button"
                        onClick={() => handleSelectClubReel(0)}
                        className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-slate-300 hover:text-white cursor-pointer"
                      >
                        추첨 구단으로 돌아가기
                      </button>
                    )}
                  </div>
                )}

                {/* LEGEND FA 1:1 SPECIAL NEGOTIATION PANEL */}
                {activeClubOffer?.isLegendSlot && activeClubOffer.squad[0] && (() => {
                  const legTarget = activeClubOffer.squad[0];
                  const alreadySigned = tm.signedPlayerIds.includes(
                    legTarget.player.id,
                  );
                  return (
                    <div className="rounded-2xl border border-amber-400/50 bg-gradient-to-br from-amber-950/35 via-[#131926] to-[#0d1320] p-4 sm:p-5 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-400 text-slate-950 shadow">
                            <Crown className="h-6 w-6" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <CountryFlagSvg
                                code={legTarget.player.nationalityCode}
                                nationality={legTarget.player.nationality}
                                size="sm"
                              />
                              <h3 className="text-base sm:text-lg font-black text-amber-200">
                                {legTarget.player.name}
                              </h3>
                              <span className="rounded bg-amber-400 px-2 py-0.5 text-xs font-black text-slate-950">
                                OVR {legTarget.player.ovr}
                              </span>
                            </div>
                            <p className="text-xs text-slate-300">
                              {formatMainPositions(legTarget.player)} ·{' '}
                              {legTarget.formSummary} · 영입 성공 확률{' '}
                              <strong className="text-amber-300">
                                {legTarget.successChance}%
                              </strong>
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={
                            alreadySigned ||
                            !legendOutSlot ||
                            tm.attemptsRemaining <= 0
                          }
                          onClick={() => handleSubmitLegendOffer(legTarget)}
                          className="rounded-xl bg-amber-400 px-5 py-2.5 text-xs font-black text-slate-950 hover:bg-amber-300 disabled:opacity-40 cursor-pointer"
                        >
                          {alreadySigned
                            ? '영입 완료'
                            : `👑 레전드 FA 영입 제안 (${legTarget.successChance}%)`}
                        </button>
                      </div>

                      <div className="space-y-2">
                        <div className="text-xs font-bold text-slate-300">
                          방출(교체)할 우리 팀 선수 1명을 선택하세요:
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {userRosterEntries.map((entry) => {
                            const selected =
                              legendOutSlot &&
                              slotKey(legendOutSlot) === entry.key;
                            return (
                              <button
                                key={`leg-out-${entry.key}`}
                                type="button"
                                onClick={() => setLegendOutSlot(entry.ref)}
                                className={`rounded-lg border px-2.5 py-2 text-left transition cursor-pointer ${
                                  selected
                                    ? 'border-amber-400 bg-amber-500/20'
                                    : 'border-slate-800 bg-slate-950/70 hover:border-slate-600'
                                }`}
                              >
                                <div className="flex items-center justify-between text-[10px]">
                                  <span className="font-bold text-slate-400">
                                    {entry.slotLabel}
                                  </span>
                                  <span className="font-black text-white">
                                    OVR {entry.player.ovr}
                                  </span>
                                </div>
                                <div className="truncate text-xs font-bold text-slate-100 mt-0.5">
                                  {entry.player.name}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* NBA TRADE PACKAGE BUILDER & DUAL SQUAD PICKER */}
                {activeClubOffer && !activeClubOffer.isLegendSlot && activeClubOffer.club && (
                  <div className="space-y-4">
                    {/* Live Trade Table Evaluation Summary */}
                    <div className="rounded-2xl border border-slate-700/90 bg-gradient-to-r from-[#11192a] via-[#101826] to-[#0e1924] p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs sm:text-sm font-black text-white">
                            📋 트레이드 협상 테이블 · {activeClubOffer.club.name}
                          </span>
                          <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-sky-300">
                            {selectedUserPlayers.length} :{' '}
                            {selectedAiPlayers.length}
                            {autoFillerPlayers.length > 0
                              ? ` (+백업 ${autoFillerPlayers.length})`
                              : ''}{' '}
                            패키지
                          </span>
                        </div>
                        {(selectedAiPlayers.length > 0 ||
                          selectedUserPlayers.length > 0) && (
                          <button
                            type="button"
                            onClick={resetTradeBuilder}
                            className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-[10px] font-bold text-slate-300 hover:text-white cursor-pointer"
                          >
                            패키지 초기화
                          </button>
                        )}
                      </div>

                      {/* Side-by-side Package Chips */}
                      <div className="grid grid-cols-1 md:grid-cols-11 gap-2.5 items-stretch">
                        {/* User Sending */}
                        <div className="md:col-span-5 rounded-xl border border-rose-500/30 bg-rose-950/15 p-2.5 space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-extrabold text-rose-300">
                              📤 보내는 선수 ({selectedUserPlayers.length}/3)
                            </span>
                            {tradeEval && (
                              <span className="font-mono font-bold text-rose-200 tabular-nums">
                                실효 {tradeEval.userEffectiveTp} TP
                              </span>
                            )}
                          </div>
                          {selectedUserPlayers.length === 0 ? (
                            <div className="py-3 text-center text-[11px] text-slate-500">
                              우측 우리 팀 스쿼드에서 보낼 선수를 선택하세요
                            </div>
                          ) : (
                            <div className="space-y-1">
                              {selectedUserPlayers.map((p, idx) => {
                                const val = tradeEval?.userValuations.find(
                                  (v) => v.playerId === p.id,
                                );
                                return (
                                  <div
                                    key={`sent-${p.id}`}
                                    className="flex items-center justify-between gap-2 rounded-lg bg-slate-950/75 px-2.5 py-1.5 text-xs"
                                  >
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <CountryFlagSvg
                                        code={p.nationalityCode}
                                        nationality={p.nationality}
                                        size="xs"
                                      />
                                      <span className="truncate font-bold text-white">
                                        {p.name}
                                      </span>
                                      <span className="text-[10px] text-slate-400">
                                        {p.position} · {p.ovr}
                                      </span>
                                      {val && val.needModPct > 0 && (
                                        <span className="rounded bg-emerald-500/20 px-1 py-px text-[9px] font-black text-emerald-300">
                                          니즈 +{val.needModPct}%
                                        </span>
                                      )}
                                      {val && val.needModPct < 0 && (
                                        <span className="rounded bg-rose-500/20 px-1 py-px text-[9px] font-black text-rose-300">
                                          포화 {val.needModPct}%
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      {val && (
                                        <span className="font-mono text-[10px] font-bold text-slate-300 tabular-nums">
                                          {val.effectiveTp}TP
                                        </span>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleToggleUserSlot(
                                            selectedUserSlots[idx],
                                          )
                                        }
                                        className="text-slate-500 hover:text-rose-300 cursor-pointer"
                                        aria-label={`${p.name} 제거`}
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        <div className="md:col-span-1 flex items-center justify-center">
                          <ArrowLeftRight className="h-5 w-5 text-sky-400" />
                        </div>

                        {/* AI Sending (Targets + Option 3 Auto Fillers) */}
                        <div className="md:col-span-5 rounded-xl border border-emerald-500/30 bg-emerald-950/15 p-2.5 space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-extrabold text-emerald-300">
                              📥 받는 선수 ({selectedAiPlayers.length}/3
                              {autoFillerPlayers.length > 0
                                ? ` + 자동 백업 ${autoFillerPlayers.length}`
                                : ''}
                              )
                            </span>
                            {tradeEval && (
                              <span className="font-mono font-bold text-emerald-200 tabular-nums">
                                요구 {tradeEval.aiEffectiveTp} TP
                              </span>
                            )}
                          </div>
                          {selectedAiPlayers.length === 0 ? (
                            <div className="py-3 text-center text-[11px] text-slate-500">
                              좌측 상대 구단 선수단에서 영입할 선수를 선택하세요
                            </div>
                          ) : (
                            <div className="space-y-1">
                              {selectedAiPlayers.map((p) => {
                                const val = tradeEval?.aiValuations.find(
                                  (v) => v.playerId === p.id,
                                );
                                return (
                                  <div
                                    key={`rec-${p.id}`}
                                    className="flex items-center justify-between gap-2 rounded-lg bg-slate-950/75 px-2.5 py-1.5 text-xs"
                                  >
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <CountryFlagSvg
                                        code={p.nationalityCode}
                                        nationality={p.nationality}
                                        size="xs"
                                      />
                                      <span className="truncate font-bold text-white">
                                        {p.name}
                                      </span>
                                      <span className="text-[10px] text-slate-400">
                                        {p.position} · {p.ovr}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      {val && (
                                        <span className="font-mono text-[10px] font-bold text-emerald-300 tabular-nums">
                                          {val.effectiveTp}TP
                                        </span>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => handleToggleAiPlayer(p.id)}
                                        className="text-slate-500 hover:text-rose-300 cursor-pointer"
                                        aria-label={`${p.name} 제거`}
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}

                              {/* Option 3 Automatic Roster-Balance Fillers */}
                              {autoFillerPlayers.map((fp, fIdx) => (
                                <div
                                  key={`filler-${fp.id}`}
                                  className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-sky-400/40 bg-sky-950/25 px-2.5 py-1.5 text-[11px]"
                                >
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="rounded bg-sky-500/20 px-1 py-px text-[9px] font-black text-sky-300">
                                      16인 균형 백업
                                    </span>
                                    <span className="truncate font-bold text-sky-100">
                                      {fp.name}
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                      {fp.position} · OVR {fp.ovr}
                                    </span>
                                  </div>
                                  {optionalFillerPool.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => handleCycleFiller(fIdx)}
                                      className="rounded border border-sky-400/40 bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold text-sky-200 hover:bg-sky-500/20 cursor-pointer shrink-0"
                                    >
                                      백업 변경
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Evaluation Bar + GM Reaction + Submit */}
                      {tradeEval &&
                        (selectedAiPlayers.length > 0 ||
                          selectedUserPlayers.length > 0) && (
                          <div className="rounded-xl border border-slate-800 bg-[#0a1019] p-3 space-y-2.5">
                            {/* Extra outgoing player prompt when receiving more than sending (1:2 / 1:3) */}
                            {tradeEval.requiredUserReleaseCount > 0 && (
                              <div className="flex items-center gap-2 rounded-lg border border-amber-400/45 bg-amber-950/30 px-3 py-2 text-xs font-bold text-amber-200">
                                <AlertCircle className="h-4 w-4 shrink-0 text-amber-300" />
                                로스터 16인 유지를 위해 우리 팀에서{' '}
                                {tradeEval.requiredUserReleaseCount}명을 더 보내는 선수로 선택해 주세요!
                              </div>
                            )}

                            {tradeEval.blockedReason &&
                              tradeEval.requiredUserReleaseCount === 0 && (
                                <div className="flex items-center gap-2 rounded-lg border border-rose-500/45 bg-rose-950/35 px-3 py-2 text-xs font-bold text-rose-200">
                                  <ShieldAlert className="h-4 w-4 shrink-0 text-rose-400" />
                                  {tradeEval.blockedReason}
                                </div>
                              )}

                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="space-y-1 min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-[11px] font-bold text-slate-400">
                                    예상 성사 확률:
                                  </span>
                                  <span
                                    className={`rounded-md px-2 py-0.5 text-sm font-black tabular-nums ${
                                      tradeEval.acceptanceChance >= 75
                                        ? 'bg-emerald-500 text-slate-950'
                                        : tradeEval.acceptanceChance >= 45
                                          ? 'bg-amber-400 text-slate-950'
                                          : tradeEval.acceptanceChance > 0
                                            ? 'bg-orange-500/25 text-orange-200 border border-orange-400/40'
                                            : 'bg-rose-500/25 text-rose-200 border border-rose-500/40'
                                    }`}
                                  >
                                    {tradeEval.acceptanceChance}%
                                  </span>
                                  <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                                    가치 비율 {Math.round(tradeEval.ratio * 100)}%
                                  </span>
                                  {selectedUserPlayers.length > 1 && (
                                    <span className="text-[10px] text-slate-500">
                                      (다인 패키지 압축 보정 적용)
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-200 leading-relaxed">
                                  {tradeEval.gmReaction}
                                </p>
                              </div>

                              <button
                                id="submit-trade-package-btn"
                                type="button"
                                disabled={!canSubmitTrade}
                                onClick={handleSubmitTrade}
                                className="rounded-xl bg-emerald-500 px-5 py-2.5 text-xs sm:text-sm font-black text-slate-950 shadow-lg hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
                              >
                                🤝 트레이드 제안 ({tradeEval.acceptanceChance}%)
                              </button>
                            </div>
                          </div>
                        )}
                    </div>

                    {/* Dual Column Squad Picker */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                      {/* Left: Counterparty Club Squad */}
                      <div className="lg:col-span-6 rounded-2xl border border-slate-800 bg-[#0b111c] p-3.5 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <JerseySvg
                              primaryColor={activeClubOffer.club.primaryColor}
                              secondaryColor={activeClubOffer.club.secondaryColor}
                              pattern={activeClubOffer.club.pattern}
                              label={activeClubOffer.club.shortName}
                              size={28}
                            />
                            <div>
                              <div className="text-xs font-black text-white">
                                {activeClubOffer.club.name} 선수단 (받는 선수)
                              </div>
                              {activeClubNeeds && (
                                <div className="text-[10px] text-sky-300 font-bold">
                                  {activeClubNeeds.summaryText}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {(['ALL', 'GK', 'DF', 'MF', 'FW'] as const).map(
                              (pf) => (
                                <button
                                  key={`pf-${pf}`}
                                  type="button"
                                  onClick={() => setPosFilter(pf)}
                                  className={`rounded-md px-2 py-1 text-[10px] font-bold cursor-pointer ${
                                    posFilter === pf
                                      ? 'bg-sky-400 text-slate-950'
                                      : 'bg-slate-900 text-slate-400 hover:text-white'
                                  }`}
                                >
                                  {pf === 'ALL' ? '전체' : pf}
                                </button>
                              ),
                            )}
                          </div>
                        </div>

                        <div className="max-h-[380px] overflow-y-auto space-y-1.5 pr-1">
                          {filteredPartnerSquad.map((target) => {
                            const p = target.player;
                            const isPicked = selectedAiPlayerIds.includes(p.id);
                            const tpVal = computePlayerTradePoints({
                              player: p,
                              stats: season.allPlayerStats[p.id] ?? null,
                              conditionMap: season.playerConditions,
                            });
                            const cond = season.playerConditions?.[p.id];
                            const inj = cond ? isPlayerActivelyInjured(cond) : false;
                            const mt = cond ? getMoraleTier(cond.morale) : 'normal';
                            const tier = getCardTier(p);
                            return (
                              <button
                                key={`ai-p-${p.id}`}
                                type="button"
                                onClick={() => handleToggleAiPlayer(p.id)}
                                className={`w-full rounded-xl border px-3 py-2 text-left transition cursor-pointer flex items-center justify-between gap-2 ${
                                  isPicked
                                    ? 'border-emerald-400 bg-emerald-950/35 ring-1 ring-emerald-400/40'
                                    : 'border-slate-800 bg-[#101826] hover:border-slate-600'
                                }`}
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <CountryFlagSvg
                                      code={p.nationalityCode}
                                      nationality={p.nationality}
                                      size="xs"
                                    />
                                    <span className="truncate text-xs font-extrabold text-white">
                                      {p.name}
                                    </span>
                                    {tier === 'superstar' && (
                                      <Sparkles className="h-3 w-3 text-cyan-300 shrink-0" />
                                    )}
                                    {inj && cond?.injury && (
                                      <PixelStatusIcon
                                        variant="injury"
                                        size={11}
                                        title={getInjuryTooltip(cond.injury)}
                                      />
                                    )}
                                    {mt === 'ecstatic' && (
                                      <PixelStatusIcon
                                        variant="morale_high"
                                        size={11}
                                        title={`사기 ${getMoraleLabel(cond!.morale)}`}
                                      />
                                    )}
                                    {mt === 'frozen' && (
                                      <PixelStatusIcon
                                        variant="morale_low"
                                        size={11}
                                        title={`사기 ${getMoraleLabel(cond!.morale)}`}
                                      />
                                    )}
                                  </div>
                                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
                                    <span>{formatMainPositions(p)}</span>
                                    <span>· STA {p.stamina}</span>
                                    <span className="inline-flex items-center gap-0.5">
                                      {target.formTrend === 'up' && (
                                        <TrendingUp className="h-3 w-3 text-emerald-400" />
                                      )}
                                      {target.formTrend === 'down' && (
                                        <TrendingDown className="h-3 w-3 text-rose-400" />
                                      )}
                                      평점 {target.formRating.toFixed(1)}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0 tabular-nums">
                                  <div className="text-right">
                                    <div className="text-xs font-black text-amber-300">
                                      OVR {p.ovr}
                                    </div>
                                    <div className="text-[10px] font-mono text-sky-300">
                                      {tpVal.effectiveTp} TP
                                    </div>
                                  </div>
                                  <span
                                    className={`rounded-lg px-2 py-1 text-[10px] font-black ${
                                      isPicked
                                        ? 'bg-emerald-500 text-slate-950'
                                        : 'bg-slate-800 text-slate-300'
                                    }`}
                                  >
                                    {isPicked ? '✓ 선택' : '+ 추가'}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Right: User Squad (16 Players) */}
                      <div className="lg:col-span-6 rounded-2xl border border-slate-800 bg-[#0b111c] p-3.5 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="text-xs font-black text-white">
                              {state.userClub.name} 스쿼드 (보내는 선수)
                            </div>
                            <div className="text-[10px] text-slate-400">
                              상대 필요 포지션 선수를 포함하면 가치가 +10%~+18% 상승합니다!
                            </div>
                          </div>
                          <span className="rounded bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-slate-300">
                            {selectedUserSlots.length} / 3 선택
                          </span>
                        </div>

                        <div className="max-h-[380px] overflow-y-auto space-y-1.5 pr-1">
                          {userRosterEntries.map((entry) => {
                            const p = entry.player;
                            const isPicked = selectedUserSlots.some(
                              (s) => slotKey(s) === entry.key,
                            );
                            const tpVal = computePlayerTradePoints({
                              player: p,
                              receivingClubNeeds: activeClubNeeds,
                              stats:
                                season.allPlayerStats[p.id] ??
                                season.allPlayerStats[`user::${p.id}`] ??
                                null,
                              conditionMap: season.playerConditions,
                            });
                            const cond = season.playerConditions?.[p.id];
                            const inj = cond ? isPlayerActivelyInjured(cond) : false;
                            const mt = cond ? getMoraleTier(cond.morale) : 'normal';

                            return (
                              <button
                                key={`u-p-${entry.key}`}
                                type="button"
                                onClick={() => handleToggleUserSlot(entry.ref)}
                                className={`w-full rounded-xl border px-3 py-2 text-left transition cursor-pointer flex items-center justify-between gap-2 ${
                                  isPicked
                                    ? 'border-rose-400 bg-rose-950/35 ring-1 ring-rose-400/40'
                                    : 'border-slate-800 bg-[#101826] hover:border-slate-600'
                                }`}
                              >
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span
                                      className={`rounded px-1.5 py-0.5 text-[9px] font-black ${
                                        entry.isStarter
                                          ? 'bg-emerald-500/20 text-emerald-300'
                                          : 'bg-slate-800 text-slate-400'
                                      }`}
                                    >
                                      {entry.slotLabel}
                                    </span>
                                    <CountryFlagSvg
                                      code={p.nationalityCode}
                                      nationality={p.nationality}
                                      size="xs"
                                    />
                                    <span className="truncate text-xs font-extrabold text-white">
                                      {p.name}
                                    </span>
                                    {inj && cond?.injury && (
                                      <PixelStatusIcon
                                        variant="injury"
                                        size={11}
                                        title={getInjuryTooltip(cond.injury)}
                                      />
                                    )}
                                    {mt === 'ecstatic' && (
                                      <PixelStatusIcon
                                        variant="morale_high"
                                        size={11}
                                        title={`사기 ${getMoraleLabel(cond!.morale)}`}
                                      />
                                    )}
                                    {mt === 'frozen' && (
                                      <PixelStatusIcon
                                        variant="morale_low"
                                        size={11}
                                        title={`사기 ${getMoraleLabel(cond!.morale)}`}
                                      />
                                    )}
                                  </div>
                                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
                                    <span>
                                      {formatMainPositions(p)} · STA {p.stamina}
                                    </span>
                                    {tpVal.needModPct >= 18 && (
                                      <span className="rounded bg-amber-500/20 px-1.5 py-px text-[9px] font-black text-amber-200">
                                        🔥 최우선 니즈 +18%
                                      </span>
                                    )}
                                    {tpVal.needModPct === 10 && (
                                      <span className="rounded bg-sky-500/15 px-1.5 py-px text-[9px] font-black text-sky-200">
                                        ✨ 보강 니즈 +10%
                                      </span>
                                    )}
                                    {tpVal.needModPct < 0 && (
                                      <span className="rounded bg-slate-800 px-1.5 py-px text-[9px] font-bold text-slate-400">
                                        ⚠️ 포화 -15%
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0 tabular-nums">
                                  <div className="text-right">
                                    <div className="text-xs font-black text-white">
                                      OVR {p.ovr}
                                    </div>
                                    <div className="text-[10px] font-mono text-rose-300">
                                      {tpVal.effectiveTp} TP
                                    </div>
                                  </div>
                                  <span
                                    className={`rounded-lg px-2 py-1 text-[10px] font-black ${
                                      isPicked
                                        ? 'bg-rose-500 text-white'
                                        : 'bg-slate-800 text-slate-300'
                                    }`}
                                  >
                                    {isPicked ? '✓ 포함' : '+ 선택'}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Season Completed Trades Log */}
        {(tm.tradeHistory?.length ?? 0) > 0 && (
          <div className="rounded-xl border border-slate-800 bg-[#0a1019] p-3 space-y-2">
            <div className="text-[11px] font-extrabold text-slate-300">
              📜 이번 시즌 성사된 트레이드 기록 ({tm.tradeHistory!.length}건)
            </div>
            <div className="space-y-1.5">
              {tm.tradeHistory!.map((rec, idx) => (
                <div
                  key={`th-${rec.round}-${idx}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-900/70 px-3 py-1.5 text-[11px]"
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-bold text-sky-300">
                      {rec.round}R · {rec.partnerClubName}
                    </span>
                    <span className="font-bold text-emerald-300">
                      IN {rec.receivedPlayers.map((p) => `${p.name}(${p.ovr})`).join(' + ')}
                    </span>
                    <span className="text-slate-500">↔</span>
                    <span className="font-bold text-rose-300">
                      OUT {rec.sentPlayers.map((p) => `${p.name}(${p.ovr})`).join(' + ')}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {rec.isIncomingOffer
                      ? '상대 제안 수락'
                      : `성사 확률 ${rec.acceptanceChance}%`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (embedded) return shellContent;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-2 sm:p-4">
      {shellContent}
    </div>
  );
}
