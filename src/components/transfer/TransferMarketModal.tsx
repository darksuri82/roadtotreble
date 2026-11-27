import {
  AlertCircle,
  ArrowLeft,
  ArrowLeftRight,
  CheckCircle2,
  Crown,
  Dices,
  Handshake,
  Inbox,
  Info,
  LayoutGrid,
  List,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { FORMATION_LIST, FORMATIONS } from '../../data/formations';
import {
  evaluateManagerPlayerSynergy,
  MANAGER_TRAITS,
} from '../../data/managerTraits';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { formatFfpBadgeSummary } from '../../engine/budgetEngine';
import {
  calculateTeamRatings,
  computeTradeSwapPreview,
} from '../../engine/chemistryEngine';
import {
  getInjuryTooltip,
  getMoraleLabel,
  getMoraleTier,
  isPlayerActivelyInjured,
} from '../../engine/conditionEngine';
import { ALL_CLUBS_WITH_LEAGUE } from '../../engine/dataLoader';
import { USER_CLUB_ID } from '../../engine/matchEngine';
import {
  evaluatePositionFit,
  formatMainPositions,
} from '../../engine/positionEngine';
import { getUserRank } from '../../engine/standingsEngine';
import { TACTIC_LIST } from '../../engine/tacticEngine';
import {
  analyzeClubPositionNeeds,
  buildTradeClubOfferForClub,
  computePlayerMarketValueM,
  computePlayerTradePoints,
  estimateStoryForeignClubRank,
  evaluateTradePackage,
  selectAutoFillerPlayers,
} from '../../engine/transferEngine';
import { useGame } from '../../store/GameContext';
import type {
  FormationId,
  IncomingTradeOffer,
  ManagerTraitId,
  TransferClubOffer,
  TransferTargetPlayer,
} from '../../types/game';
import {
  formatPlayerRecordName,
  getCardTier,
  getClassicEra,
  getClassicEraMeta,
  LEAGUE_LABELS,
  type Player,
  type Position,
} from '../../types/player';
import { computeCashLegendChanceBonus } from '../../engine/budgetEngine';
import { buildPlayerCompetitionBreakdown } from '../../utils/playerLookup';
import { CashSweetenerControl } from '../common/CashSweetenerControl';
import { CountryFlagSvg } from '../common/CountryFlagSvg';
import { InfoHelpButton } from '../common/InfoHelpButton';
import { JerseySvg } from '../common/JerseySvg';
import { ManagerTraitBadgeCard } from '../common/ManagerTraitBadgeCard';
import { PitchBoard } from '../common/PitchBoard';
import { PixelStatusIcon } from '../common/PixelStatusIcon';
import { PlayerDetailModal } from '../common/PlayerDetailModal';
import { PlayerNameButton } from '../common/PlayerNameButton';
import { TradeSwapPreviewCard } from './TradeSwapPreviewCard';

interface TransferMarketModalProps {
  embedded?: boolean;
}

type MarketTab = 'explore' | 'incoming' | 'tactics';
type PosFilter = 'ALL' | Position;
type PickerViewMode = 'formation' | 'list';

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

function shortPitchName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length <= 7) return trimmed;
  const parts = trimmed.split(' ');
  const last = parts[parts.length - 1] ?? trimmed;
  return last.length <= 8 ? last : trimmed.slice(0, 7);
}

function renderMyManagerFitBadge(
  player: Player,
  managerTraitId: ManagerTraitId | null | undefined,
  variant: 'pill' | 'short' | 'star' = 'short',
) {
  const syn = evaluateManagerPlayerSynergy(player, managerTraitId);
  if (syn.bonus <= 0) return null;
  const traitName = managerTraitId
    ? (MANAGER_TRAITS[managerTraitId]?.name ?? '내 감독 특성')
    : '내 감독 특성';
  const tip = `내 감독 궁합 일치 (${traitName}) · ${syn.reason ?? '+1 OVR'}`;
  if (variant === 'star') {
    return (
      <span
        title={tip}
        className="text-[8.5px] sm:text-[9px] font-bold text-amber-300 leading-none shrink-0 drop-shadow-[0_0_2px_rgba(251,191,36,0.45)]"
      >
        ★
      </span>
    );
  }
  return (
    <span
      title={tip}
      className="inline-flex items-center gap-0.5 whitespace-nowrap shrink-0 rounded border border-amber-400/45 bg-amber-950/60 px-1 py-px text-[9px] font-bold text-amber-200 leading-none"
    >
      ★ {variant === 'pill' ? '내 감독 궁합' : '감독 궁합'}
    </span>
  );
}

/**
 * Assigns a club's 16-player squad into 11 formation starter slots + 5 core bench players
 * (1 GK, 2 DF, 2 FW/MF) so the Trade Room displays an authentic Formation Pitch + 5-man Bench below it.
 */
function assignPartnerSquadToFormation(
  formationId: FormationId,
  targets: TransferTargetPlayer[],
): {
  starters: (TransferTargetPlayer | null)[];
  bench: TransferTargetPlayer[];
} {
  const config = FORMATIONS[formationId] ?? FORMATIONS['4-3-3'];
  const slots = config.slots;

  // Fast path: if targets were built by buildTransferClubSquad (11 tagged starters in slot order + 5 core bench)
  const taggedStarters = targets.filter((t) => t.isStarter === true);
  const taggedBench = targets.filter((t) => t.isStarter === false);
  if (taggedStarters.length === slots.length) {
    return {
      starters: taggedStarters,
      bench: taggedBench,
    };
  }

  const assigned: (TransferTargetPlayer | null)[] = Array.from(
    { length: slots.length },
    () => null,
  );
  const usedIds = new Set<string>();

  // 1) GK slot first
  const gkSlotIdx = slots.findIndex((s) => s.position === 'GK');
  if (gkSlotIdx >= 0) {
    const bestGk = [...targets]
      .filter((t) => t.player.position === 'GK')
      .sort((a, b) => b.player.ovr - a.player.ovr)[0];
    if (bestGk) {
      assigned[gkSlotIdx] = bestGk;
      usedIds.add(bestGk.player.id);
    }
  }

  // 2) Remaining outfield slots by best fit + OVR
  for (let idx = 0; idx < slots.length; idx += 1) {
    if (assigned[idx] !== null) continue;
    const slot = slots[idx];
    let bestTarget: TransferTargetPlayer | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const t of targets) {
      if (usedIds.has(t.player.id)) continue;
      if (t.player.position === 'GK' && slot.position !== 'GK') continue;
      const fit = evaluatePositionFit(t.player, slot.subPosition, null);
      const fitBonus =
        fit.fit === 'main' ? 18 : fit.fit === 'secondary' ? 8 : -8;
      const score = fit.effectiveOvr + fitBonus;
      if (score > bestScore) {
        bestScore = score;
        bestTarget = t;
      }
    }
    if (bestTarget) {
      assigned[idx] = bestTarget;
      usedIds.add(bestTarget.player.id);
    }
  }

  const bench = targets.filter((t) => !usedIds.has(t.player.id));

  return { starters: assigned, bench };
}

/**
 * Outer wrapper guarantees zero Rules-of-Hooks violations when tm.isOpen flips true -> false,
 * and cleanly resets inner UI state whenever a new transfer window opens.
 */
export function TransferMarketModal({
  embedded = false,
}: TransferMarketModalProps) {
  const { state } = useGame();
  const season = state.season;
  const tm = season?.transferMarket ?? null;

  if (!season || !tm || !tm.isOpen) return null;

  return (
    <TransferMarketModalInner
      key={`${tm.windowIndex}-${tm.triggerRound}-${tm.isUclSpecial ? 'ucl' : 'lg'}`}
      embedded={embedded}
    />
  );
}

function TransferMarketModalInner({ embedded }: { embedded: boolean }) {
  useBodyScrollLock(!embedded);
  const {
    state,
    chemistry,
    changeFormation,
    setDefaultTactic,
    autoOptimizeLineup,
    swapSquadPositions,
    transferSpinClubs,
    transferSubmitOffer,
    tradeSubmitPackage,
    tradeAcceptIncoming,
    tradeRejectIncoming,
    transferCloseWindow,
  } = useGame();

  const season = state.season!;
  const tm = season.transferMarket;
  const isStoryMode = Boolean(state.storyMode);
  const missionKeySet = useMemo(
    () => new Set(state.storyMode?.missionKeyPlayerIds ?? []),
    [state.storyMode?.missionKeyPlayerIds],
  );
  const [storyLeagueFilter, setStoryLeagueFilter] = useState<
    import('../../types/league').LeagueId
  >(season.leagueId);

  const incomingOffers = tm.incomingOffers ?? [];
  const pendingIncomingCount = incomingOffers.filter(
    (o) => o.status === 'pending',
  ).length;

  const [activeTab, setActiveTab] = useState<MarketTab>('explore');
  const [tacticsSelectedSlot, setTacticsSelectedSlot] =
    useState<SlotRef | null>(null);
  const [pickerViewMode, setPickerViewMode] =
    useState<PickerViewMode>('formation');
  const [highlightNeedsOnly, setHighlightNeedsOnly] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [lockedCount, setLockedCount] = useState(tm.hasSpunClubs ? 3 : 0);
  const [tick, setTick] = useState(0);
  const [activeReelIdx, setActiveReelIdx] = useState<number>(0);
  const [counterOfferClub, setCounterOfferClub] =
    useState<TransferClubOffer | null>(null);
  const [counterOfferOrigin, setCounterOfferOrigin] =
    useState<MarketTab>('incoming');
  const [posFilter, setPosFilter] = useState<PosFilter>('ALL');

  // Player Detail Inspector Modal
  const [inspectedPlayer, setInspectedPlayer] = useState<Player | null>(null);
  // Accidental close confirmation guard for ending transfer window
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);

  // NBA Multi-player Trade Package State
  const [selectedAiPlayerIds, setSelectedAiPlayerIds] = useState<string[]>([]);
  const [selectedUserSlots, setSelectedUserSlots] = useState<SlotRef[]>([]);
  const [customFillerIds, setCustomFillerIds] = useState<string[] | null>(null);
  const [cashOfferM, setCashOfferM] = useState<number>(0);

  const availableCashM = season.budgetState?.transferCashM ?? 0;
  const ffpTier = season.budgetState?.ffpTier ?? 0;
  const ffpEmbargoActive = Boolean(tm.ffpEmbargoActive);
  const clampedCashOfferM = Math.max(0, Math.min(cashOfferM, availableCashM));

  // Legend FA 1:1 Special Slot State
  const [legendOutSlot, setLegendOutSlot] = useState<SlotRef | null>(null);
  // Virtual swap preview toggle on user pitch (default ON whenever incoming + outgoing picked)
  const [showSwapPreviewOnPitch, setShowSwapPreviewOnPitch] = useState(true);

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
  const staffCoachId = season.staffCoach?.hiredCoachId ?? null;
  const ffpChemPenalty = season.budgetState?.chemPenalty ?? 0;

  const teamRatings = useMemo(
    () =>
      calculateTeamRatings(
        state.formation,
        state.starters,
        chemistry.total,
        state.manager.traitId,
        chemistry.slotSynergies,
        state.defaultTactic,
        staffCoachId,
      ),
    [
      state.formation,
      state.starters,
      chemistry.total,
      chemistry.slotSynergies,
      state.manager.traitId,
      state.defaultTactic,
      staffCoachId,
    ],
  );

  const selectedUserSlotKeys = useMemo(
    () => new Set(selectedUserSlots.map((s) => slotKey(s))),
    [selectedUserSlots],
  );

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
        slotLabel: p.mainPositions[0] ?? p.position,
        isStarter: false,
      });
    });
    return entries;
  }, [state.starters, state.bench, formationSlots]);

  const userSquadPlayers = useMemo(
    () => userRosterEntries.map((e) => e.player),
    [userRosterEntries],
  );

  // Active partner club offer (either counter-offer/Story club OR selected roulette reel)
  const activeClubOffer: TransferClubOffer | null = useMemo(() => {
    if (counterOfferClub) {
      if (
        isStoryMode &&
        counterOfferClub.club &&
        counterOfferClub.leagueId !== 'LEGEND'
      ) {
        const clubId = counterOfferClub.club.id;
        const leagueId = counterOfferClub.leagueId;
        const storyEntry = state.storyMode?.transferPoolClubs.find(
          (c) => c.club.id === clubId,
        );
        const isUserLeague = leagueId === season.leagueId;
        const liveRoster = isUserLeague
          ? season.aiRosters[clubId] ?? storyEntry?.roster
          : storyEntry?.roster;
        if (liveRoster && liveRoster.length > 0) {
          const ownedIds = new Set(userSquadPlayers.map((p) => p.id));
          const excludeIds = new Set<string>([
            ...ownedIds,
            ...(season.departedPlayerIds ?? []),
          ]);
          return buildTradeClubOfferForClub({
            club: storyEntry?.club ?? counterOfferClub.club,
            leagueId,
            clubRank: counterOfferClub.clubRank,
            leagueSize: counterOfferClub.leagueSize,
            currentRound: season.currentRound,
            totalRounds: season.totalRounds,
            windowIndex: tm.windowIndex,
            userRank: getUserRank(season.standings, USER_CLUB_ID),
            userLeagueSize: season.standings.length || 20,
            isUserLeague,
            aiRoster: liveRoster,
            allPlayerStats: season.allPlayerStats,
            ownedIds,
            excludeIds,
            championBonusActive: Boolean(tm.championBonusActive),
            strictRosterOnly: true,
          });
        }
      }
      return counterOfferClub;
    }
    if (!tm.hasSpunClubs || tm.rolledClubs.length === 0) return null;
    return tm.rolledClubs[activeReelIdx] ?? tm.rolledClubs[0] ?? null;
  }, [
    counterOfferClub,
    isStoryMode,
    state.storyMode?.transferPoolClubs,
    season.leagueId,
    season.aiRosters,
    season.departedPlayerIds,
    season.currentRound,
    season.totalRounds,
    season.standings,
    season.allPlayerStats,
    userSquadPlayers,
    tm.windowIndex,
    tm.championBonusActive,
    tm.hasSpunClubs,
    tm.rolledClubs,
    activeReelIdx,
  ]);

  // All available (not-yet-signed) targets on the active partner club (16-man squad: 11 starters + 5 core bench)
  const availablePartnerTargets = useMemo(() => {
    if (!activeClubOffer) return [] as TransferTargetPlayer[];
    const signedSet = new Set(tm.signedPlayerIds);
    return activeClubOffer.squad.filter((t) => !signedSet.has(t.player.id));
  }, [activeClubOffer, tm.signedPlayerIds]);

  const activePartnerAiRoster = useMemo(() => {
    if (
      !activeClubOffer ||
      activeClubOffer.isLegendSlot ||
      !activeClubOffer.club
    ) {
      return [] as Player[];
    }
    return availablePartnerTargets.map((t) => t.player);
  }, [activeClubOffer, availablePartnerTargets]);

  const activeClubNeeds = useMemo(() => {
    if (!activeClubOffer || activeClubOffer.isLegendSlot) return null;
    if (activeClubOffer.clubNeeds) return activeClubOffer.clubNeeds;
    return analyzeClubPositionNeeds(activePartnerAiRoster);
  }, [activeClubOffer, activePartnerAiRoster]);

  const activeShockBargainIds = useMemo(() => {
    const ids = new Set<string>();
    for (const t of availablePartnerTargets) {
      if (t.isShockBargain) ids.add(t.player.id);
    }
    return ids;
  }, [availablePartnerTargets]);

  const filteredPartnerSquad = useMemo(() => {
    return availablePartnerTargets.filter((t) => {
      if (posFilter === 'ALL') return true;
      return t.player.position === posFilter;
    });
  }, [availablePartnerTargets, posFilter]);

  const partnerFormationLayout = useMemo(() => {
    if (
      !activeClubOffer ||
      activeClubOffer.isLegendSlot ||
      !activeClubOffer.club
    ) {
      return null;
    }
    const formId = activeClubOffer.club.formation ?? '4-3-3';
    const { starters, bench } = assignPartnerSquadToFormation(
      formId,
      availablePartnerTargets,
    );
    const starterIdSet = new Set(
      starters.filter((t): t is TransferTargetPlayer => t !== null).map((t) => t.player.id),
    );
    return {
      formationId: formId,
      slots: (FORMATIONS[formId] ?? FORMATIONS['4-3-3']).slots,
      starters,
      bench,
      starterIdSet,
    };
  }, [activeClubOffer, availablePartnerTargets]);

  // Resolve selected players cleanly
  const selectedAiPlayers = useMemo(() => {
    if (!activeClubOffer || activeClubOffer.isLegendSlot) return [] as Player[];
    const byId = new Map(
      availablePartnerTargets.map((t) => [t.player.id, t.player]),
    );
    return selectedAiPlayerIds
      .map((id) => byId.get(id))
      .filter((p): p is Player => Boolean(p));
  }, [activeClubOffer, availablePartnerTargets, selectedAiPlayerIds]);

  const selectedUserPlayers = useMemo(() => {
    return selectedUserSlots
      .map((ref) =>
        ref.area === 'starter'
          ? state.starters[ref.index]
          : state.bench[ref.index],
      )
      .filter((p): p is Player => p !== null);
  }, [selectedUserSlots, state.starters, state.bench]);

  // Option 3: Auto-selected rotation fillers for 2:1 / 3:1 deals (only once user picks opponent target)
  const neededAutoFillers =
    selectedAiPlayers.length > 0
      ? Math.max(0, selectedUserPlayers.length - selectedAiPlayers.length)
      : 0;

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

  const optionalFillerPool = useMemo(() => {
    if (
      neededAutoFillers <= 0 ||
      !activeClubOffer ||
      activeClubOffer.isLegendSlot
    ) {
      return [] as Player[];
    }
    const targetIds = new Set(selectedAiPlayers.map((p) => p.id));
    return [...activePartnerAiRoster]
      .filter((p) => !targetIds.has(p.id))
      .sort((a, b) => a.ovr - b.ovr)
      .slice(0, 6);
  }, [
    neededAutoFillers,
    activeClubOffer,
    activePartnerAiRoster,
    selectedAiPlayers,
  ]);

  // Live Trade Package Evaluation
  const tradeEval = useMemo(() => {
    if (
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
      championBonusActive: Boolean(tm.championBonusActive),
      shockBargainIds: activeShockBargainIds,
      cashOfferM: clampedCashOfferM,
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
    tm.championBonusActive,
    activeShockBargainIds,
    clampedCashOfferM,
  ]);

  const tradeSwapPreview = useMemo(
    () =>
      computeTradeSwapPreview({
        formationId: state.formation,
        starters: state.starters,
        bench: state.bench,
        outSlots: selectedUserSlots,
        inItems: selectedAiPlayers.map((player) => ({
          player,
          isFiller: false,
        })),
        tactic: state.defaultTactic,
        managerTraitId: state.manager.traitId,
        staffCoachId,
        ffpChemPenalty,
        beforeChemistry: chemistry,
        beforeRatings: teamRatings,
        cashBeforeM: availableCashM,
        cashOfferM: clampedCashOfferM,
      }),
    [
      state.formation,
      state.starters,
      state.bench,
      selectedUserSlots,
      selectedAiPlayers,
      state.defaultTactic,
      state.manager.traitId,
      staffCoachId,
      ffpChemPenalty,
      chemistry,
      teamRatings,
      availableCashM,
      clampedCashOfferM,
    ],
  );

  const isMirrorSwapPreviewActive =
    showSwapPreviewOnPitch && tradeSwapPreview.isActive;
  const swapPairByAiId = useMemo(
    () =>
      new Map(
        tradeSwapPreview.swapPairs.map((pair) => [pair.inPlayer.id, pair]),
      ),
    [tradeSwapPreview.swapPairs],
  );
  const swapPairByUserSlotKey = useMemo(
    () =>
      new Map(tradeSwapPreview.swapPairs.map((pair) => [pair.slotKey, pair])),
    [tradeSwapPreview.swapPairs],
  );

  const legendTargetPlayer = activeClubOffer?.isLegendSlot
    ? (activeClubOffer.squad[0]?.player ?? null)
    : null;

  const legendSwapPreview = useMemo(
    () =>
      computeTradeSwapPreview({
        formationId: state.formation,
        starters: state.starters,
        bench: state.bench,
        outSlots: legendOutSlot ? [legendOutSlot] : [],
        inItems: legendTargetPlayer
          ? [{ player: legendTargetPlayer, isFiller: false }]
          : [],
        tactic: state.defaultTactic,
        managerTraitId: state.manager.traitId,
        staffCoachId,
        ffpChemPenalty,
        beforeChemistry: chemistry,
        beforeRatings: teamRatings,
        cashBeforeM: availableCashM,
        cashOfferM: clampedCashOfferM,
      }),
    [
      state.formation,
      state.starters,
      state.bench,
      legendOutSlot,
      legendTargetPlayer,
      state.defaultTactic,
      state.manager.traitId,
      staffCoachId,
      ffpChemPenalty,
      chemistry,
      teamRatings,
      availableCashM,
      clampedCashOfferM,
    ],
  );

  const inspectedBreakdown = useMemo(() => {
    if (!inspectedPlayer) return null;
    return buildPlayerCompetitionBreakdown(inspectedPlayer.id, season, null);
  }, [inspectedPlayer, season]);

  const isUclSpecial = Boolean(tm.isUclSpecial);
  const isChampBonus = Boolean(tm.championBonusActive);

  const resetTradeBuilder = () => {
    setSelectedAiPlayerIds([]);
    setSelectedUserSlots([]);
    setCustomFillerIds(null);
    setCashOfferM(0);
    setShowSwapPreviewOnPitch(true);
  };

  const handleSelectClubReel = (idx: number) => {
    setCounterOfferClub(null);
    setActiveReelIdx(idx);
    setPosFilter('ALL');
    resetTradeBuilder();
    setLegendOutSlot(null);
  };

  const handleSpin = () => {
    if (tm.hasSpunClubs || animating || ffpEmbargoActive) return;
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
    const currentPoolIdx = optionalFillerPool.findIndex(
      (p) => p.id === currentId,
    );
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
    const storyPoolEntry = state.storyMode?.transferPoolClubs.find(
      (c) => c.club.id === offer.club.id,
    );
    const liveRoster = isUserLeague
      ? season.aiRosters[offer.club.id] ?? storyPoolEntry?.roster
      : storyPoolEntry?.roster ??
        season.otherLeagues?.[offer.leagueId]?.aiRosters?.[offer.club.id];
    const statsMap = isUserLeague
      ? season.allPlayerStats
      : season.otherLeagues?.[offer.leagueId]?.playerStats ??
        season.allPlayerStats;

    const clubOffer = buildTradeClubOfferForClub({
      club: storyPoolEntry?.club ?? offer.club,
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
      strictRosterOnly: isStoryMode,
    });

    setCounterOfferOrigin(activeTab);
    setCounterOfferClub(clubOffer);
    setSelectedAiPlayerIds(offer.aiOffersPlayers.map((p) => p.id));

    const preSlots: SlotRef[] = [];
    for (const req of offer.userRequestedPlayers) {
      const found = userRosterEntries.find((e) => e.player.id === req.id);
      if (found) preSlots.push(found.ref);
    }
    setSelectedUserSlots(preSlots);
    setCustomFillerIds(null);
    setCashOfferM(0);
    setPosFilter('ALL');
    setActiveTab('explore');
  };

  const handleExitCounterOffer = (targetTab?: MarketTab) => {
    const dest = targetTab ?? counterOfferOrigin;
    setCounterOfferClub(null);
    setSelectedAiPlayerIds([]);
    setSelectedUserSlots([]);
    setCustomFillerIds(null);
    setCashOfferM(0);
    setPosFilter('ALL');
    setActiveTab(dest);
  };

  const handleSelectStoryClub = (
    entry: import('../../types/storyMode').StoryTransferPoolClub,
  ) => {
    const ownedIds = new Set(userSquadPlayers.map((p) => p.id));
    const excludeIds = new Set<string>([
      ...ownedIds,
      ...(season.departedPlayerIds ?? []),
    ]);
    const isUserLeague = entry.leagueId === season.leagueId;
    const liveRoster = isUserLeague
      ? season.aiRosters[entry.club.id] ?? entry.roster
      : entry.roster;
    const standIdx = isUserLeague
      ? season.standings.findIndex((s) => s.teamId === entry.club.id)
      : -1;
    const foreignEst =
      !isUserLeague && state.storyMode?.transferPoolClubs
        ? estimateStoryForeignClubRank(
            entry.club,
            entry.leagueId,
            state.storyMode.transferPoolClubs,
          )
        : null;
    const clubRank =
      standIdx !== -1 ? standIdx + 1 : (foreignEst?.rank ?? 2);
    const leagueSize = isUserLeague
      ? season.standings.length || 20
      : (foreignEst?.leagueSize ?? 20);
    const clubOffer = buildTradeClubOfferForClub({
      club: entry.club,
      leagueId: entry.leagueId,
      clubRank,
      leagueSize,
      currentRound: season.currentRound,
      totalRounds: season.totalRounds,
      windowIndex: tm.windowIndex,
      userRank: getUserRank(season.standings, USER_CLUB_ID),
      userLeagueSize: season.standings.length || 20,
      isUserLeague,
      aiRoster: liveRoster,
      allPlayerStats: season.allPlayerStats,
      ownedIds,
      excludeIds,
      championBonusActive: Boolean(tm.championBonusActive),
      strictRosterOnly: true,
    });
    setCounterOfferOrigin('explore');
    setCounterOfferClub(clubOffer);
    setSelectedAiPlayerIds([]);
    setSelectedUserSlots([]);
    setCustomFillerIds(null);
    setCashOfferM(0);
    setPosFilter('ALL');
    setActiveTab('explore');
  };

  const handleSubmitTrade = () => {
    if (
      ffpEmbargoActive ||
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
      cashOfferM: clampedCashOfferM,
    });
    resetTradeBuilder();
  };

  const handleSubmitLegendOffer = (target: TransferTargetPlayer) => {
    if (ffpEmbargoActive || !legendOutSlot || tm.attemptsRemaining <= 0) return;
    transferSubmitOffer(target, legendOutSlot, clampedCashOfferM);
    setLegendOutSlot(null);
    setCashOfferM(0);
  };

  const canSubmitTrade = Boolean(
    !ffpEmbargoActive &&
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
          : 'modal-panel w-full max-w-6xl rounded-2xl'
      }`}
    >
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-800 bg-[#090f19] px-4 py-3">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-sky-400/35 bg-sky-500/12 text-sky-300">
            <ArrowLeftRight className="h-4 w-4" />
          </div>
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            <h2 className="text-sm sm:text-base font-black text-white">
              {isUclSpecial
                ? isStoryMode
                  ? 'UCL 16강 직전 이적시장'
                  : 'UCL 특별 트레이드'
                : isStoryMode
                  ? `겨울 이적시장 (${tm.triggerRound}R)`
                  : `제 ${tm.windowIndex}차 트레이드 (${tm.triggerRound}R)`}
            </h2>
            <span className="rounded-md border border-emerald-400/35 bg-emerald-500/12 px-2 py-0.5 text-[11px] font-extrabold text-emerald-300 tabular-nums whitespace-nowrap">
              {tm.attemptsRemaining}/{tm.maxAttempts}회
            </span>
            <span className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-200 tabular-nums whitespace-nowrap">
              보유 자금 €{availableCashM}M
            </span>
            {ffpTier >= 1 && (
              <span
                className={`rounded-md border px-2 py-0.5 text-[10.5px] whitespace-nowrap ${
                  ffpTier === 2
                    ? ffpEmbargoActive
                      ? 'border-rose-500/45 bg-rose-500/18 font-black text-rose-200'
                      : 'border-rose-500/40 bg-rose-500/15 font-bold text-rose-200'
                    : 'border-amber-500/40 bg-amber-500/15 font-bold text-amber-200'
                }`}
              >
                {formatFfpBadgeSummary(ffpTier, {
                  windowIndex: tm.windowIndex,
                  isUclSpecial,
                  isEmbargo: ffpEmbargoActive,
                })}
              </span>
            )}
            <InfoHelpButton
              title="트레이드 규칙 · 가치(TP)"
              align="left"
              guideTab="transfer"
              items={[
                '1:1 · 2:1 · 3:1 패키지 트레이드 (로스터 16인 · GK 최소 1명 유지)',
                '상대 최우선 니즈(🔥 +32% · +8%p) / 보강 니즈(✨ +18% · +4%p) / 포화(-25% · -10%p)',
                '다인 통합세(100%/78%/60%, 니즈 +15% 완화) · 프런트 급매(🚨 -35% · +12%p)',
                'OVR 87+ 슈퍼스타 영입 시(급매 제외) 대상 OVR -7 이상 핵심 자산 필요 (€80M+ 현금 시 1 완화)',
                '드래프트 잔여 예산 현금 얹기: €1M당 +1.25 TP(통합세 면제) · 레전드 FA 최대 +15%p',
              ]}
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {counterOfferClub &&
            activeTab === 'explore' &&
            (!isStoryMode || counterOfferOrigin === 'incoming') && (
              <button
                id="counter-offer-back-btn"
                type="button"
                onClick={() => handleExitCounterOffer()}
                className="inline-flex items-center gap-1 rounded-xl border border-amber-400/45 bg-amber-500/12 px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-extrabold text-amber-200 hover:bg-amber-500/22 hover:text-amber-100 transition cursor-pointer touch-manipulation whitespace-nowrap"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                {counterOfferOrigin === 'incoming'
                  ? '받은 제안으로'
                  : '트레이드 룰렛으로'}
              </button>
            )}
          <button
            id="close-transfer-window-btn"
            type="button"
            onClick={() => {
              if (tm.attemptsRemaining > 0 || pendingIncomingCount > 0) {
                setConfirmCloseOpen(true);
              } else {
                transferCloseWindow();
              }
            }}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-900 px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-bold text-slate-300 hover:border-rose-400/50 hover:text-rose-200 transition cursor-pointer touch-manipulation whitespace-nowrap"
          >
            <X className="h-3.5 w-3.5" />
            {isUclSpecial ? 'UCL 시작' : '이적시장 끝내기'}
          </button>
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 bg-[#0b111c] px-4 py-2">
        <button
          type="button"
          onClick={() => setActiveTab('explore')}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
            activeTab === 'explore'
              ? 'bg-slate-800 text-white border border-sky-400/45 shadow-sm'
              : 'bg-slate-900/70 text-slate-400 border border-slate-800 hover:bg-slate-800/80 hover:text-slate-200'
          }`}
        >
          <Handshake className="h-3.5 w-3.5 text-sky-300" />
          구단 트레이드 탐색
          {counterOfferClub && (
            <span className="rounded bg-amber-500/18 border border-amber-400/35 px-1.5 py-0.2 text-[10px] font-bold text-amber-200">
              {isStoryMode ? '지목' : '역제안'} · {counterOfferClub.club?.shortName ?? ''}
            </span>
          )}
        </button>
        <button
          id="incoming-trade-offers-tab"
          type="button"
          onClick={() => setActiveTab('incoming')}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
            activeTab === 'incoming'
              ? 'bg-slate-800 text-white border border-amber-400/45 shadow-sm'
              : 'bg-slate-900/70 text-slate-400 border border-slate-800 hover:bg-slate-800/80 hover:text-slate-200'
          }`}
        >
          <Inbox className="h-3.5 w-3.5 text-amber-300" />
          받은 트레이드 제안
          <span
            className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold tabular-nums ${
              pendingIncomingCount > 0
                ? 'bg-amber-500/20 text-amber-200 border border-amber-400/40'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {pendingIncomingCount}
          </span>
        </button>
        <button
          id="transfer-tactics-tab"
          type="button"
          onClick={() => {
            setTacticsSelectedSlot(null);
            setActiveTab('tactics');
          }}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
            activeTab === 'tactics'
              ? 'bg-slate-800 text-white border border-emerald-400/45 shadow-sm'
              : 'bg-slate-900/70 text-slate-400 border border-slate-800 hover:bg-slate-800/80 hover:text-slate-200'
          }`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5 text-emerald-300" />
          스쿼드 · 전술
        </button>
        {counterOfferClub && activeTab === 'explore' && counterOfferOrigin === 'incoming' && (
          <button
            type="button"
            onClick={() => handleExitCounterOffer('explore')}
            className="rounded-lg border border-slate-700/80 bg-slate-900/80 px-2.5 py-1.5 text-[11px] font-bold text-slate-300 hover:border-sky-400/50 hover:text-white transition cursor-pointer touch-manipulation"
          >
            {isStoryMode
              ? '5대 리그 구단 목록'
              : tm.hasSpunClubs
                ? '추첨 구단 보기'
                : '트레이드 룰렛'}
          </button>
        )}
        <div className="ml-auto hidden sm:flex items-center gap-2 text-[11px] text-slate-400">
          <Users className="h-3.5 w-3.5 text-slate-500" />
          <span>
            우리 로스터 {userSquadPlayers.length}인 (선발 11 · 벤치{' '}
            {Math.max(0, userSquadPlayers.length - 11)} 유지)
          </span>
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="modal-scroll flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-5 space-y-4">
        {/* Last Negotiation Result Banner */}
        {tm.lastOfferResult && activeTab !== 'tactics' && (
          <div
            className={`rounded-xl border px-4 py-3 space-y-1 ${
              tm.lastOfferResult.success
                ? 'border-emerald-500/45 bg-emerald-950/30 text-emerald-100'
                : 'border-rose-500/45 bg-rose-950/30 text-rose-100'
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

        {/* TAB 3: IN-MODAL SQUAD & TACTICS EDITOR */}
        {activeTab === 'tactics' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            <div className="lg:col-span-5 space-y-3">
              <ManagerTraitBadgeCard traitId={state.manager.traitId} compact />

              <div className="rounded-xl border border-slate-800/90 bg-[#0b1018] p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-300">
                    포메이션 · 전술 설정
                  </span>
                  {!isStoryMode && (
                    <button
                      type="button"
                      onClick={() => {
                        setTacticsSelectedSlot(null);
                        autoOptimizeLineup();
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-sky-500/35 bg-sky-500/12 px-2.5 py-1 text-[11px] font-bold text-sky-200 hover:bg-sky-500/20 transition-colors cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      빠른 선발
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-1">
                  {FORMATION_LIST.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        setTacticsSelectedSlot(null);
                        changeFormation(f.id);
                      }}
                      className={`rounded-lg border py-1.5 px-1 text-[10px] sm:text-[11px] font-bold cursor-pointer truncate transition-colors ${
                        state.formation === f.id
                          ? 'border-sky-400/55 bg-sky-500/18 text-white'
                          : 'bg-[#111822] text-slate-400 border-slate-800 hover:border-slate-600 hover:text-slate-200'
                      }`}
                    >
                      {f.id === '4-4-2-diamond'
                        ? '4-4-2◇'
                        : f.id === '3-5-2-dm'
                          ? '3-5-2 DM'
                          : f.id}
                    </button>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold text-slate-400">
                    기본 전술
                  </div>
                  <div className="grid grid-cols-5 gap-1">
                    {TACTIC_LIST.map((t) => {
                      const isMgrPreferred = state.manager.traitId
                        ? MANAGER_TRAITS[state.manager.traitId]?.synergyTactic ===
                          t.id
                        : false;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          title={
                            isMgrPreferred
                              ? `${t.name} · 감독 추천 전술`
                              : t.name
                          }
                          onClick={() => setDefaultTactic(t.id)}
                          className={`rounded-lg border py-1.5 text-[11px] font-bold cursor-pointer transition-colors ${
                            state.defaultTactic === t.id
                              ? 'border-emerald-400/55 bg-emerald-500/18 text-white'
                              : isMgrPreferred
                                ? 'bg-[#111822] text-slate-200 border-slate-700 hover:border-slate-500 hover:text-white'
                                : 'bg-[#111822] text-slate-400 border-slate-800 hover:border-slate-600 hover:text-slate-200'
                          }`}
                        >
                          {isMgrPreferred && (
                            <span className="text-amber-300 mr-0.5">★</span>
                          )}
                          {t.shortName}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-1.5 pt-1 text-center tabular-nums">
                  <div className="rounded-lg border border-slate-800/80 bg-[#090e15] py-1.5">
                    <div className="text-[9.5px] text-slate-500">ATT</div>
                    <div className="font-display text-xs font-bold text-white">
                      {teamRatings.effectiveAtt}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-800/80 bg-[#090e15] py-1.5">
                    <div className="text-[9.5px] text-slate-500">MID</div>
                    <div className="font-display text-xs font-bold text-white">
                      {teamRatings.effectiveMid}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-800/80 bg-[#090e15] py-1.5">
                    <div className="text-[9.5px] text-slate-500">DEF</div>
                    <div className="font-display text-xs font-bold text-white">
                      {teamRatings.effectiveDef}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-800/80 bg-[#090e15] py-1.5">
                    <div className="text-[9.5px] text-slate-500">케미</div>
                    <div className="font-display text-xs font-bold text-emerald-300">
                      {chemistry.total}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 space-y-2">
              <div className="flex items-center justify-between text-xs px-0.5">
                <span className="inline-flex items-center gap-1.5 font-semibold text-slate-300">
                  <ArrowLeftRight className="w-3.5 h-3.5 text-emerald-400" />
                  {tacticsSelectedSlot
                    ? '교체할 선수를 클릭하세요'
                    : '클릭·드래그 교환 / 우클릭·ⓘ 상세'}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 tabular-nums">
                  <Zap className="w-3.5 h-3.5 text-emerald-400" />
                  OVR {Math.round(teamRatings.ovr)}
                </span>
              </div>

              <PitchBoard
                formation={state.formation}
                starters={state.starters}
                bench={state.bench}
                chemistry={chemistry}
                managerTraitId={state.manager.traitId}
                tactic={state.defaultTactic}
                conditionByPlayerId={season.playerConditions}
                selectedSlot={tacticsSelectedSlot}
                onSlotClick={(area: 'starter' | 'bench', index: number) => {
                  if (!tacticsSelectedSlot) {
                    const p =
                      area === 'starter'
                        ? state.starters[index]
                        : state.bench[index];
                    if (!p) return;
                    setTacticsSelectedSlot({ area, index });
                    return;
                  }
                  if (
                    tacticsSelectedSlot.area === area &&
                    tacticsSelectedSlot.index === index
                  ) {
                    setTacticsSelectedSlot(null);
                    return;
                  }
                  swapSquadPositions(tacticsSelectedSlot, { area, index });
                  setTacticsSelectedSlot(null);
                }}
                onSlotSwap={(from: SlotRef, to: SlotRef) => {
                  swapSquadPositions(from, to);
                  setTacticsSelectedSlot(null);
                }}
                onInspectPlayer={(p) => setInspectedPlayer(p)}
                showChemLegend
                compact
              />
            </div>
          </div>
        )}

        {/* TAB 2: INCOMING AI TRADE OFFERS (0-5 per window) */}
        {activeTab === 'incoming' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-black text-white">
                받은 트레이드 제안 ({incomingOffers.length}건)
              </h3>
            </div>

            {incomingOffers.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-[#0b111c] p-8 text-center space-y-3">
                <Inbox className="h-8 w-8 mx-auto text-slate-600" />
                <div className="text-sm font-bold text-slate-300">
                  도착한 트레이드 제안이 없습니다.
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('explore')}
                  className="rounded-xl bg-sky-400 px-4 py-2 text-xs font-black text-slate-950 hover:bg-sky-300 cursor-pointer"
                >
                  구단 탐색으로 이동 →
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
                            className={`rounded-md px-2 py-0.5 text-[10px] font-bold border ${
                              isAccepted
                                ? 'bg-emerald-500/18 text-emerald-300 border-emerald-500/40'
                                : 'bg-slate-800/80 text-slate-400 border-slate-700/70'
                            }`}
                          >
                            {isAccepted ? '성사됨' : '거절/만료'}
                          </span>
                        )}
                      </div>

                      {offer.isBlockbusterBargain && (
                        <div className="flex items-center gap-1.5 rounded-lg border border-rose-400/50 bg-rose-500/15 px-2.5 py-1 text-[11px] font-black text-rose-200">
                          <span>{offer.bargainHeadline ?? '🚨 충격의 급매물 · 보드진 파격 제안'}</span>
                        </div>
                      )}

                      {/* Swap visual with clickable player names */}
                      <div className="grid grid-cols-11 items-center gap-2 rounded-xl border border-slate-800 bg-[#0b1019] p-3">
                        <div className="col-span-5 space-y-1.5">
                          <div className="text-[10px] font-bold text-emerald-300">
                            📥 우리가 받는 선수
                          </div>
                          {offer.aiOffersPlayers.map((p) => {
                            const val = computePlayerTradePoints({
                              player: p,
                              sellingClubNeeds: offer.clubNeeds,
                              isShockBargain: Boolean(offer.isBlockbusterBargain),
                              stats: season.allPlayerStats[p.id] ?? null,
                              conditionMap: season.playerConditions,
                            });
                            const mv = computePlayerMarketValueM(p, {
                              isShockBargain: Boolean(offer.isBlockbusterBargain),
                            });
                            return (
                              <div
                                key={p.id}
                                className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 px-2.5 py-1.5"
                              >
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <CountryFlagSvg
                                    code={p.nationalityCode}
                                    nationality={p.nationality}
                                    size="xs"
                                  />
                                  <PlayerNameButton
                                    onClick={() => setInspectedPlayer(p)}
                                    className="truncate text-xs font-extrabold text-white"
                                  >
                                    {p.name}
                                  </PlayerNameButton>
                                  {renderMyManagerFitBadge(
                                    p,
                                    state.manager.traitId,
                                    'pill',
                                  )}
                                </div>
                                <div className="mt-0.5 flex flex-wrap items-center justify-between gap-1 text-[10px] text-slate-300 tabular-nums">
                                  <span className="whitespace-nowrap">
                                    {formatMainPositions(p)} · STA {p.stamina}
                                  </span>
                                  <span className="whitespace-nowrap font-black text-emerald-300">
                                    OVR {p.ovr} · €{mv}M · TP {val.effectiveTp}
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
                            const mv = computePlayerMarketValueM(p);
                            return (
                              <div
                                key={p.id}
                                className="rounded-lg border border-rose-500/30 bg-rose-950/20 px-2.5 py-1.5"
                              >
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <CountryFlagSvg
                                    code={p.nationalityCode}
                                    nationality={p.nationality}
                                    size="xs"
                                  />
                                  <PlayerNameButton
                                    onClick={() => setInspectedPlayer(p)}
                                    className="truncate text-xs font-extrabold text-white"
                                  >
                                    {p.name}
                                  </PlayerNameButton>
                                  {renderMyManagerFitBadge(
                                    p,
                                    state.manager.traitId,
                                    'short',
                                  )}
                                </div>
                                <div className="mt-0.5 flex flex-wrap items-center justify-between gap-1 text-[10px] text-slate-300 tabular-nums">
                                  <span className="whitespace-nowrap">
                                    {formatMainPositions(p)} · STA {p.stamina}
                                  </span>
                                  <span className="whitespace-nowrap font-black text-rose-300">
                                    OVR {p.ovr} · €{mv}M · TP {val.effectiveTp}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {isPending && (() => {
                        const outSlots: SlotRef[] = [];
                        for (const req of offer.userRequestedPlayers) {
                          const found = userRosterEntries.find(
                            (e) => e.player.id === req.id,
                          );
                          if (found) outSlots.push(found.ref);
                        }
                        const preview = computeTradeSwapPreview({
                          formationId: state.formation,
                          starters: state.starters,
                          bench: state.bench,
                          outSlots,
                          inItems: offer.aiOffersPlayers.map((player) => ({
                            player,
                            isFiller: false,
                          })),
                          tactic: state.defaultTactic,
                          managerTraitId: state.manager.traitId,
                          staffCoachId,
                          ffpChemPenalty,
                          beforeChemistry: chemistry,
                          beforeRatings: teamRatings,
                        });
                        if (!preview.isActive) return null;
                        const tone = (v: number) =>
                          v > 0
                            ? 'text-emerald-300'
                            : v < 0
                              ? 'text-rose-300'
                              : 'text-slate-400';
                        const sgn = (v: number, dec = 0) =>
                          `${v > 0 ? '+' : ''}${dec > 0 ? v.toFixed(dec) : Math.round(v)}`;
                        return (
                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-lg border border-emerald-500/25 bg-[#0a131f] px-2.5 py-1.5 text-[10px] font-mono tabular-nums">
                            <span className="font-sans font-bold text-emerald-300 whitespace-nowrap">
                              투입 프리뷰
                            </span>
                            <span className="text-slate-300 whitespace-nowrap">
                              케미 <strong className={tone(preview.chemDelta)}>{sgn(preview.chemDelta)}</strong>
                            </span>
                            <span className="text-slate-300 whitespace-nowrap">
                              연결선 <strong className={tone(preview.totalLinesDelta)}>{sgn(preview.totalLinesDelta)}</strong>
                            </span>
                            <span className="text-slate-300 whitespace-nowrap">
                              궁합 <strong className={tone(preview.managerFitDelta)}>{sgn(preview.managerFitDelta)}</strong>
                            </span>
                            <span className="text-slate-300 whitespace-nowrap">
                              실효 OVR <strong className={tone(preview.ovrDelta)}>{sgn(preview.ovrDelta, 1)}</strong>
                            </span>
                          </div>
                        );
                      })()}

                      <p className="rounded-lg bg-slate-950/70 px-3 py-2 text-[11px] leading-relaxed text-slate-300 italic">
                        {offer.club.shortName} 단장: {offer.aiPitch}
                      </p>

                      {isPending && (
                        <div className="flex flex-wrap items-center gap-2 pt-0.5">
                          <button
                            type="button"
                            disabled={tm.attemptsRemaining <= 0}
                            onClick={() => tradeAcceptIncoming(offer.id)}
                            className="flex-1 min-w-[110px] rounded-xl bg-emerald-500 px-3 py-2 text-xs font-black text-slate-950 hover:bg-emerald-400 disabled:opacity-40 cursor-pointer whitespace-nowrap"
                          >
                            ✅ 제안 수락
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStartCounterOffer(offer)}
                            className="flex-1 min-w-[125px] rounded-xl border border-sky-400/45 bg-sky-500/15 px-3 py-2 text-xs font-extrabold text-sky-200 hover:bg-sky-500/25 cursor-pointer whitespace-nowrap"
                          >
                            👁️ 피치 프리뷰 · 수정
                          </button>
                          <button
                            type="button"
                            onClick={() => tradeRejectIncoming(offer.id)}
                            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-400 hover:border-rose-400/50 hover:text-rose-300 cursor-pointer whitespace-nowrap"
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
            {/* Step 1: 3-Club Roulette Banner (or FFP Tier 2 Embargo Notice) */}
            {ffpEmbargoActive ? (
              <div className="rounded-2xl border border-rose-500/40 bg-rose-950/15 p-5 sm:p-6 text-center space-y-3">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-rose-400/40 bg-rose-500/15 px-3 py-1 text-[11px] font-black text-rose-200">
                  FFP 2단계 예산 초과 · {tm.windowIndex}차 이적시장 영입 동결
                </div>
                <h3 className="text-base sm:text-lg font-black text-white">
                  이번 {tm.windowIndex}차 이적시장에서는 선수 영입이 제한됩니다
                </h3>
                <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed break-keep">
                  드래프트 예산 15% 초과(FFP 2단계) 제재로 1·3차 이적시장 구단 추첨과 트레이드가 동결되었습니다.{' '}
                  {tm.windowIndex === 1
                    ? '2차 이적시장(1회 제한) 및 UCL 진출 시 특별 이적시장(3회)에서 보강할 수 있습니다.'
                    : '현재 스쿼드와 전술 정비로 시즌을 마무리하며, UCL 진출 시 특별 이적시장(3회)에서 보강할 수 있습니다.'}
                </p>
                <div className="flex flex-wrap justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab('tactics')}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-2.5 text-xs font-extrabold text-emerald-200 hover:bg-emerald-500/25 cursor-pointer"
                  >
                    스쿼드 · 전술 정비하기
                  </button>
                  <button
                    type="button"
                    onClick={() => transferCloseWindow()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-200 px-5 py-2.5 text-xs font-black text-slate-950 hover:bg-white cursor-pointer"
                  >
                    이적시장 닫고 시즌 계속
                  </button>
                </div>
              </div>
            ) : isStoryMode && !counterOfferClub ? (
              <div
                id="story-direct-scout-browser"
                className="rounded-2xl border border-amber-500/35 bg-[#0c1320] p-4 sm:p-5 space-y-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-500/15 px-2.5 py-0.5 text-[10.5px] font-extrabold text-amber-300">
                      <Sparkles className="h-3 w-3" />
                      {state.storyMode?.seasonLabel} 시대 5대 리그 직접 스카우팅 (운빨 0%)
                    </div>
                    <h3 className="text-base sm:text-lg font-black text-white">
                      협상할 구단을 직접 지목하세요
                    </h3>
                    <p
                      className="text-[11.5px] text-slate-400"
                      style={{ wordBreak: 'keep-all' }}
                    >
                      {state.storyMode?.transferRuleReason}
                    </p>
                  </div>
                  <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-right shrink-0">
                    <div className="text-[10px] font-bold text-emerald-300/80">
                      보유 현금 예산
                    </div>
                    <div className="font-mono text-base font-black text-emerald-300">
                      €{availableCashM}M
                    </div>
                  </div>
                </div>

                {/* 5-League Tabs */}
                <div className="grid grid-cols-5 gap-1.5 rounded-xl border border-slate-800 bg-[#080e18] p-1">
                  {(
                    [
                      ['epl', 'EPL'],
                      ['laliga', '라리가'],
                      ['seriea', '세리에 A'],
                      ['bundesliga', '분데스리가'],
                      ['ligue1', '리그 1'],
                    ] as [import('../../types/league').LeagueId, string][]
                  ).map(([lid, label]) => {
                    const count = (
                      state.storyMode?.transferPoolClubs ?? []
                    ).filter((c) => c.leagueId === lid).length;
                    const active = storyLeagueFilter === lid;
                    return (
                      <button
                        key={lid}
                        type="button"
                        onClick={() => setStoryLeagueFilter(lid)}
                        className={`rounded-lg px-2 py-2 text-[11px] sm:text-xs font-extrabold transition-colors cursor-pointer whitespace-nowrap ${
                          active
                            ? 'bg-sky-500/20 text-sky-200 border border-sky-400/50'
                            : 'text-slate-400 border border-transparent hover:bg-slate-800/70 hover:text-white'
                        }`}
                      >
                        {label}{' '}
                        <span className="font-mono text-[10px] opacity-75">
                          ({count})
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Era Club Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                  {(state.storyMode?.transferPoolClubs ?? [])
                    .filter((c) => c.leagueId === storyLeagueFilter)
                    .map((entry) => {
                      const avgOvr = Math.round(
                        (entry.club.att + entry.club.mid + entry.club.def) / 3,
                      );
                      const standIdx =
                        entry.leagueId === season.leagueId
                          ? season.standings.findIndex(
                              (s) => s.teamId === entry.club.id,
                            )
                          : -1;
                      return (
                        <button
                          key={entry.club.id}
                          type="button"
                          onClick={() => handleSelectStoryClub(entry)}
                          className="group flex items-center gap-2.5 rounded-xl border border-slate-800 bg-[#101827] p-2.5 text-left hover:border-sky-400/65 hover:bg-[#142036] transition-colors cursor-pointer"
                        >
                          <JerseySvg
                            primaryColor={entry.club.primaryColor}
                            secondaryColor={entry.club.secondaryColor}
                            pattern={entry.club.pattern}
                            label={entry.club.shortName}
                            size={34}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-xs font-extrabold text-white group-hover:text-sky-200">
                              {entry.club.name}
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
                              <span>OVR {avgOvr}</span>
                              {standIdx !== -1 && (
                                <span className="text-amber-300">
                                  · {standIdx + 1}위
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>
            ) : !tm.hasSpunClubs && !counterOfferClub ? (
              <div className="rounded-2xl border border-slate-800 bg-[#0c1320] p-5 sm:p-6 text-center space-y-4">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-[11px] font-bold text-sky-200">
                  <Dices className="h-3.5 w-3.5" />
                  협상 구단 3곳 추첨
                </div>
                <h3 className="text-base sm:text-lg font-black text-white">
                  트레이드 협상 구단 추첨
                </h3>

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
                          {animating
                            ? spinClub.club.name
                            : `협상 슬롯 #${rIdx + 1}`}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap justify-center gap-2.5 pt-1">
                  <button
                    id="spin-transfer-clubs-btn"
                    type="button"
                    disabled={animating || ffpEmbargoActive}
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
                {isStoryMode && counterOfferClub && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/35 bg-[#101827] px-3 py-2">
                    <button
                      type="button"
                      onClick={() => handleExitCounterOffer('explore')}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-slate-200 hover:border-sky-400/60 hover:text-white cursor-pointer whitespace-nowrap"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      5대 리그 다른 구단 지목하기
                    </button>
                    {selectedUserPlayers.some((p) => missionKeySet.has(p.id)) && (
                      <span className="inline-flex items-center gap-1 rounded-lg border border-rose-400/50 bg-rose-500/15 px-2.5 py-1 text-[11px] font-extrabold text-rose-200">
                        <ShieldAlert className="h-3.5 w-3.5 text-rose-300 shrink-0" />
                        ★ 미션 핵심 선수 방출 주의 — 트레이드 시 ★★★ 달성 불가 위험!
                      </span>
                    )}
                  </div>
                )}

                {/* Partner Club Selector Strip */}
                {!isStoryMode && (
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
                          (() => {
                            const classicP = offer.squad[0]?.player;
                            const eraMeta = classicP
                              ? getClassicEraMeta(getClassicEra(classicP))
                              : null;
                            return (
                              <div className="flex items-center gap-2.5">
                                <div
                                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[11px] font-black ${
                                    eraMeta?.badgeClass ?? 'bg-amber-400 text-slate-950'
                                  }`}
                                >
                                  {eraMeta ? eraMeta.shortLabel : <Crown className="h-5 w-5" />}
                                </div>
                                <div className="min-w-0">
                                  <div className="text-xs font-black text-amber-300">
                                    👑 {eraMeta ? `${eraMeta.shortLabel} CLASSIC FA` : 'CLASSIC FA'} 특별 슬롯
                                  </div>
                                  <div className="truncate text-[11px] text-amber-100 font-bold">
                                    {classicP
                                      ? `${formatPlayerRecordName(classicP)} (OVR ${classicP.ovr})`
                                      : '클래식 FA'}
                                  </div>
                                </div>
                              </div>
                            );
                          })()
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
                                  {offer.clubRank}위 · {offer.club?.formation}
                                </div>
                              </div>
                            </div>
                            {offer.clubNeeds && (
                              <div className="flex flex-wrap gap-1">
                                {offer.clubNeeds.neededPositions.map(
                                  (p, nIdx) => (
                                    <span
                                      key={`${idx}-need-${p}`}
                                      className={`rounded px-1.5 py-0.5 text-[9px] font-extrabold ${
                                        nIdx === 0
                                          ? 'bg-amber-500/20 text-amber-200 border border-amber-400/40'
                                          : 'bg-sky-500/15 text-sky-200 border border-sky-400/35'
                                      }`}
                                    >
                                      {nIdx === 0 ? '🔥 최우선' : '✨ 필요'}{' '}
                                      {POS_BADGE_KO[p]}
                                    </span>
                                  ),
                                )}
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
                )}

                {/* Counter-offer active club indicator is handled cleanly in header & negotiation table */}

                {/* CLASSIC FA 1:1 SPECIAL NEGOTIATION PANEL */}
                {activeClubOffer?.isLegendSlot &&
                  activeClubOffer.squad[0] &&
                  (() => {
                    const legTarget = activeClubOffer.squad[0];
                    const legEraMeta = getClassicEraMeta(
                      getClassicEra(legTarget.player),
                    );
                    const alreadySigned = tm.signedPlayerIds.includes(
                      legTarget.player.id,
                    );
                    const legSwapPair =
                      showSwapPreviewOnPitch && legendSwapPreview.isActive
                        ? (legendSwapPreview.swapPairs[0] ?? null)
                        : null;
                    return (
                      <div className="rounded-2xl border border-amber-400/50 bg-gradient-to-br from-amber-950/35 via-[#131926] to-[#0d1320] p-4 sm:p-5 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xs font-black shadow ${legEraMeta.badgeClass}`}
                            >
                              {legEraMeta.shortLabel}
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <CountryFlagSvg
                                  code={legTarget.player.nationalityCode}
                                  nationality={legTarget.player.nationality}
                                  size="sm"
                                />
                                <PlayerNameButton
                                  onClick={() =>
                                    setInspectedPlayer(legTarget.player)
                                  }
                                  className="text-base sm:text-lg font-black text-amber-200"
                                >
                                  {legTarget.player.name}
                                </PlayerNameButton>
                                <span
                                  className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-black ${legEraMeta.badgeClass}`}
                                >
                                  {legEraMeta.fullLabel}
                                  {legTarget.player.classicSeasonTag
                                    ? ` · ${legTarget.player.classicSeasonTag}`
                                    : ''}
                                </span>
                                <span className="whitespace-nowrap rounded bg-amber-400 px-2 py-0.5 text-xs font-black text-slate-950">
                                  OVR {legTarget.player.ovr}
                                </span>
                                {renderMyManagerFitBadge(
                                  legTarget.player,
                                  state.manager.traitId,
                                  'pill',
                                )}
                                {legSwapPair && (
                                  <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-rose-400/55 bg-rose-950/50 px-2 py-0.5 text-[10px] font-black text-rose-200">
                                    ↔ FA 방출: {legSwapPair.outPlayer.name} ({legSwapPair.outPlayer.ovr})
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-300">
                                {formatMainPositions(legTarget.player)} ·{' '}
                                €{computePlayerMarketValueM(legTarget.player, {
                                  marketValueMOverride: legTarget.marketValueM,
                                })}M · {legTarget.formSummary} · 영입 성공 확률{' '}
                                <strong className="text-amber-300">
                                  {Math.min(
                                    95,
                                    Math.round(
                                      legTarget.successChance +
                                        computeCashLegendChanceBonus(
                                          clampedCashOfferM,
                                        ),
                                    ),
                                  )}
                                  %
                                </strong>
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={
                              alreadySigned ||
                              !legendOutSlot ||
                              tm.attemptsRemaining <= 0 ||
                              ffpEmbargoActive
                            }
                            onClick={() => handleSubmitLegendOffer(legTarget)}
                            className="rounded-xl bg-amber-400 px-5 py-2.5 text-xs font-black text-slate-950 hover:bg-amber-300 disabled:opacity-40 cursor-pointer whitespace-nowrap"
                          >
                            {alreadySigned
                              ? '영입 완료'
                              : `👑 ${legEraMeta.shortLabel} 제안 확정 (${Math.min(
                                  95,
                                  Math.round(
                                    legTarget.successChance +
                                      computeCashLegendChanceBonus(
                                        clampedCashOfferM,
                                      ),
                                  ),
                                )}%)`}
                          </button>
                        </div>

                        <CashSweetenerControl
                          availableCashM={availableCashM}
                          cashOfferM={clampedCashOfferM}
                          onChange={setCashOfferM}
                          mode="legend"
                          disabled={
                            alreadySigned ||
                            tm.attemptsRemaining <= 0 ||
                            ffpEmbargoActive
                          }
                        />

                        {legendSwapPreview.isActive && (
                          <TradeSwapPreviewCard
                            preview={legendSwapPreview}
                            showOnPitch={showSwapPreviewOnPitch}
                            onToggleShowOnPitch={() =>
                              setShowSwapPreviewOnPitch((v) => !v)
                            }
                            onResetPreview={() => {
                              setLegendOutSlot(null);
                              setShowSwapPreviewOnPitch(true);
                            }}
                          />
                        )}

                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span className="font-bold text-slate-300">
                              교체(가상 투입)할 우리 팀 선수를 선택하세요:
                            </span>
                            {(() => {
                              const pickedOut = legendOutSlot
                                ? legendOutSlot.area === 'starter'
                                  ? state.starters[legendOutSlot.index]
                                  : state.bench[legendOutSlot.index]
                                : null;
                              if (!pickedOut) {
                                return (
                                  <span className="rounded-md border border-slate-700/80 bg-slate-900/70 px-2 py-0.5 text-[10px] font-semibold text-slate-400 whitespace-nowrap">
                                    미선택 · 아래 선수 클릭 시 프리뷰
                                  </span>
                                );
                              }
                              return (
                                <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-400/50 bg-emerald-950/45 px-2 py-0.5 text-[10px] font-extrabold text-emerald-200 whitespace-nowrap">
                                  <span>
                                    OUT {formatPlayerRecordName(pickedOut)} ({pickedOut.ovr}) → IN{' '}
                                    {formatPlayerRecordName(legTarget.player)} ({legTarget.player.ovr})
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setLegendOutSlot(null)}
                                    className="rounded bg-slate-800/90 px-1 text-[9px] text-slate-200 hover:bg-rose-500/45 cursor-pointer"
                                  >
                                    원복
                                  </button>
                                </span>
                              );
                            })()}
                          </div>
                          {(() => {
                            const usePreview =
                              showSwapPreviewOnPitch && legendSwapPreview.isActive;
                            const activeRatings = usePreview
                              ? legendSwapPreview.afterRatings
                              : teamRatings;
                            return (
                              <PitchBoard
                                formation={state.formation}
                                starters={
                                  usePreview
                                    ? legendSwapPreview.previewStarters
                                    : state.starters
                                }
                                bench={
                                  usePreview
                                    ? legendSwapPreview.previewBench
                                    : state.bench
                                }
                                chemistry={
                                  usePreview
                                    ? legendSwapPreview.afterChemistry
                                    : chemistry
                                }
                                baselineStarters={
                                  usePreview ? state.starters : null
                                }
                                managerTraitId={state.manager.traitId}
                                tactic={state.defaultTactic}
                                conditionByPlayerId={season.playerConditions}
                                selectedSlot={usePreview ? null : legendOutSlot}
                                previewSlotKeys={
                                  usePreview
                                    ? legendSwapPreview.previewSlotKeys
                                    : undefined
                                }
                                selectedTone="rose"
                                onSlotClick={(area, index) => {
                                  const p =
                                    area === 'starter'
                                      ? state.starters[index]
                                      : state.bench[index];
                                  if (!p) return;
                                  setLegendOutSlot((prev) =>
                                    prev &&
                                    prev.area === area &&
                                    prev.index === index
                                      ? null
                                      : { area, index },
                                  );
                                }}
                                onInspectPlayer={(p) => setInspectedPlayer(p)}
                                compact
                                showBench
                                showChemBreakdown={false}
                                showChemLegend
                                headerLabel={
                                  usePreview
                                    ? `${state.userClub.name} · 프리뷰`
                                    : state.userClub.name
                                }
                                headerRight={
                                  <span className="font-mono text-[10px] font-bold text-slate-300 tabular-nums">
                                    A{' '}
                                    <strong className="text-white">
                                      {activeRatings.effectiveAtt}
                                    </strong>{' '}
                                    · M{' '}
                                    <strong className="text-white">
                                      {activeRatings.effectiveMid}
                                    </strong>{' '}
                                    · D{' '}
                                    <strong className="text-white">
                                      {activeRatings.effectiveDef}
                                    </strong>
                                  </span>
                                }
                              />
                            );
                          })()}
                        </div>
                      </div>
                    );
                  })()}

                {/* NBA TRADE PACKAGE BUILDER & DUAL FORMATION PICKER */}
                {activeClubOffer &&
                  !activeClubOffer.isLegendSlot &&
                  activeClubOffer.club && (
                    <div className="space-y-4">
                      {/* Live Trade Table Evaluation Summary */}
                      <div className="rounded-2xl border border-slate-700/90 bg-gradient-to-r from-[#11192a] via-[#101826] to-[#0e1924] p-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs sm:text-sm font-black text-white">
                              📋 트레이드 협상 테이블 ·{' '}
                              {activeClubOffer.club.name}
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

                          <div className="flex flex-wrap items-center gap-1.5">
                            {activeClubNeeds && (
                              <button
                                type="button"
                                onClick={() => setHighlightNeedsOnly((v) => !v)}
                                title="상대 구단이 필요로 하는 포지션(🔥/✨)의 우리 선수를 한눈에 강조합니다"
                                className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                                  highlightNeedsOnly
                                    ? 'border-amber-400/60 bg-amber-500/18 text-amber-200'
                                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                                }`}
                              >
                                <Sparkles className="h-3 w-3 text-amber-300 shrink-0" />
                                니즈 강조
                              </button>
                            )}
                            {/* Formation / List View Toggle */}
                            <div className="inline-flex rounded-lg border border-slate-800 bg-slate-950 p-0.5 gap-0.5">
                              <button
                                type="button"
                                onClick={() => setPickerViewMode('formation')}
                                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold cursor-pointer ${
                                  pickerViewMode === 'formation'
                                    ? 'bg-slate-800 text-white border border-slate-600/80'
                                    : 'text-slate-400 border border-transparent hover:text-slate-200'
                                }`}
                              >
                                <LayoutGrid className="h-3 w-3 text-emerald-300" />
                                포메이션 보기
                              </button>
                              <button
                                type="button"
                                onClick={() => setPickerViewMode('list')}
                                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold cursor-pointer ${
                                  pickerViewMode === 'list'
                                    ? 'bg-slate-800 text-white border border-slate-600/80'
                                    : 'text-slate-400 border border-transparent hover:text-slate-200'
                                }`}
                              >
                                <List className="h-3 w-3 text-sky-300" />
                                리스트 보기
                              </button>
                            </div>
                            {(selectedAiPlayers.length > 0 ||
                              selectedUserPlayers.length > 0) && (
                              <button
                                type="button"
                                onClick={resetTradeBuilder}
                                className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-[10px] font-bold text-slate-300 hover:text-white cursor-pointer"
                              >
                                초기화
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Side-by-side Package Chips */}
                        <div className="grid grid-cols-1 md:grid-cols-11 gap-2.5 items-stretch">
                          {/* AI Sending (Targets + Option 3 Auto Fillers) */}
                          <div className="md:col-span-5 rounded-xl border border-emerald-500/30 bg-emerald-950/15 p-2.5 space-y-1.5">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-extrabold text-emerald-300">
                                📥 받는 선수 ({selectedAiPlayers.length}/3
                                {autoFillerPlayers.length > 0
                                  ? ` + 백업 ${autoFillerPlayers.length}`
                                  : ''}
                                )
                              </span>
                              {tradeEval && (
                                <span className="font-mono font-bold text-emerald-200 tabular-nums">
                                  요구 가치 {tradeEval.aiEffectiveTp}
                                </span>
                              )}
                            </div>
                            {selectedAiPlayers.length === 0 ? (
                              <div className="py-2.5 text-center text-[11px] text-slate-500">
                                좌측 상대 포메이션/벤치에서 영입할 선수를 클릭하세요
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
                                      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                                        <CountryFlagSvg
                                          code={p.nationalityCode}
                                          nationality={p.nationality}
                                          size="xs"
                                        />
                                        <PlayerNameButton
                                          onClick={() => setInspectedPlayer(p)}
                                          className="truncate font-bold text-white"
                                        >
                                          {p.name}
                                        </PlayerNameButton>
                                        <span className="whitespace-nowrap text-[10px] text-slate-400">
                                          {p.position} · {p.ovr}
                                        </span>
                                        {renderMyManagerFitBadge(
                                          p,
                                          state.manager.traitId,
                                          'short',
                                        )}
                                        {val?.isShockBargain && (
                                          <span className="whitespace-nowrap rounded bg-rose-500/25 border border-rose-400/50 px-1 py-px text-[9px] font-black text-rose-200">
                                            🚨 급매 -35%
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        {val && (
                                          <span className="whitespace-nowrap font-mono text-[10px] font-bold text-emerald-300 tabular-nums">
                                            €{computePlayerMarketValueM(p, {
                                              isShockBargain: val.isShockBargain,
                                            })}M · TP {val.effectiveTp}
                                          </span>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleToggleAiPlayer(p.id)
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

                                {/* Option 3 Automatic Roster-Balance Fillers */}
                                {autoFillerPlayers.map((fp, fIdx) => (
                                  <div
                                    key={`filler-${fp.id}`}
                                    className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-sky-400/40 bg-sky-950/25 px-2.5 py-1.5 text-[11px]"
                                  >
                                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                                      <span className="whitespace-nowrap rounded bg-sky-500/20 px-1 py-px text-[9px] font-black text-sky-300 shrink-0">
                                        16인 백업
                                      </span>
                                      <PlayerNameButton
                                        onClick={() => setInspectedPlayer(fp)}
                                        className="truncate font-bold text-sky-100"
                                      >
                                        {fp.name}
                                      </PlayerNameButton>
                                      <span className="whitespace-nowrap text-[10px] text-slate-400 shrink-0">
                                        {fp.position} · {fp.ovr}
                                      </span>
                                      {renderMyManagerFitBadge(
                                        fp,
                                        state.manager.traitId,
                                        'star',
                                      )}
                                    </div>
                                    {optionalFillerPool.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => handleCycleFiller(fIdx)}
                                        className="rounded border border-sky-400/40 bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold text-sky-200 hover:bg-sky-500/20 cursor-pointer shrink-0"
                                      >
                                        변경
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="md:col-span-1 flex items-center justify-center">
                            <ArrowLeftRight className="h-5 w-5 text-sky-400" />
                          </div>

                          {/* User Sending */}
                          <div className="md:col-span-5 rounded-xl border border-rose-500/30 bg-rose-950/15 p-2.5 space-y-1.5">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-extrabold text-rose-300">
                                📤 보내는 선수 ({selectedUserPlayers.length}/3)
                              </span>
                              {tradeEval && (
                                <span className="font-mono font-bold text-rose-200 tabular-nums">
                                  제시 가치 {tradeEval.userEffectiveTp}
                                </span>
                              )}
                            </div>
                            {selectedUserPlayers.length === 0 ? (
                              <div className="py-2.5 text-center text-[11px] text-slate-500">
                                우측 우리 팀 포메이션/벤치에서 보낼 선수를 클릭하세요
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
                                      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                                        <CountryFlagSvg
                                          code={p.nationalityCode}
                                          nationality={p.nationality}
                                          size="xs"
                                        />
                                        <PlayerNameButton
                                          onClick={() => setInspectedPlayer(p)}
                                          className="truncate font-bold text-white"
                                        >
                                          {p.name}
                                        </PlayerNameButton>
                                        <span className="whitespace-nowrap text-[10px] text-slate-400">
                                          {p.position} · {p.ovr}
                                        </span>
                                        {renderMyManagerFitBadge(
                                          p,
                                          state.manager.traitId,
                                          'short',
                                        )}
                                        {val && val.needModPct > 0 && (
                                          <span className="whitespace-nowrap rounded bg-emerald-500/20 px-1 py-px text-[9px] font-black text-emerald-300">
                                            +{val.needModPct}%
                                          </span>
                                        )}
                                        {val && val.needModPct < 0 && (
                                          <span className="whitespace-nowrap rounded bg-rose-500/20 px-1 py-px text-[9px] font-black text-rose-300">
                                            {val.needModPct}%
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        {val && (
                                          <span className="whitespace-nowrap font-mono text-[10px] font-bold text-slate-300 tabular-nums">
                                            €{computePlayerMarketValueM(p)}M · TP {val.effectiveTp}
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
                        </div>

                        {/* Evaluation Bar + GM Reaction + Submit */}
                        {tradeEval &&
                          (selectedAiPlayers.length > 0 ||
                            selectedUserPlayers.length > 0) && (
                            <div className="rounded-xl border border-slate-800 bg-[#0a1019] p-3 space-y-2.5">
                              {tradeEval.requiredUserReleaseCount > 0 && (
                                <div className="flex items-center gap-2 rounded-lg border border-amber-400/45 bg-amber-950/30 px-3 py-2 text-xs font-bold text-amber-200">
                                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-300" />
                                  로스터 16인 유지를 위해 우리 팀에서{' '}
                                  {tradeEval.requiredUserReleaseCount}명을 더
                                  보내는 선수로 선택해 주세요!
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
                                      className={`rounded-md border px-2 py-0.5 text-sm font-black tabular-nums ${
                                        tradeEval.acceptanceChance >= 72
                                          ? 'bg-emerald-500/18 text-emerald-300 border-emerald-500/40'
                                          : tradeEval.acceptanceChance >= 45
                                            ? 'bg-amber-500/18 text-amber-200 border-amber-400/40'
                                            : 'bg-orange-500/20 text-orange-200 border-orange-400/40'
                                      }`}
                                    >
                                      {tradeEval.acceptanceChance}%
                                    </span>
                                    <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                                      트레이드 가치 비교 {Math.round(tradeEval.ratio * 100)}%
                                    </span>
                                    <InfoHelpButton
                                      title="성사 확률 · TP 가치 내역"
                                      align="left"
                                      size="xs"
                                      guideTab="transfer"
                                    >
                                      <div className="space-y-1 text-[10.5px] text-slate-300 tabular-nums">
                                        <div className="flex justify-between">
                                          <span className="text-slate-400">우리 제안 유효 TP</span>
                                          <span className="font-bold text-white">
                                            {tradeEval.userEffectiveTp} TP
                                            {selectedUserPlayers.length > 1 && (
                                              <span className="text-slate-500 ml-1">
                                                (원가 {tradeEval.userRawTp})
                                              </span>
                                            )}
                                          </span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-slate-400">상대 요구 TP</span>
                                          <span className="font-bold text-emerald-300">
                                            {tradeEval.aiEffectiveTp} TP
                                          </span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-slate-400">가치 비율</span>
                                          <span className="font-bold text-sky-300">
                                            {Math.round(tradeEval.ratio * 100)}%
                                          </span>
                                        </div>
                                        {selectedUserPlayers.length > 1 && (
                                          <div className="pt-1 border-t border-slate-800 text-[10px] text-slate-400">
                                            • 다인 패키지 통합세(100% / 78% / 60%, 니즈 +15% 완화) 반영
                                          </div>
                                        )}
                                        <div className="text-[10px] text-slate-400">
                                          • 상대 니즈(🔥+32% / ✨+18%) · 급매(🚨-35%) · 구단 순위 위상 포함
                                        </div>
                                      </div>
                                    </InfoHelpButton>
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
                                  className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs sm:text-sm font-black text-white shadow-lg shadow-emerald-950/40 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0 transition-colors whitespace-nowrap"
                                >
                                  제안 확정 (트레이드 요청 · {tradeEval.acceptanceChance}%)
                                </button>
                              </div>

                              <CashSweetenerControl
                                availableCashM={availableCashM}
                                cashOfferM={clampedCashOfferM}
                                onChange={setCashOfferM}
                                mode="trade"
                                disabled={
                                  tm.attemptsRemaining <= 0 || ffpEmbargoActive
                                }
                              />
                            </div>
                          )}

                        {tradeSwapPreview.isActive && (
                          <TradeSwapPreviewCard
                            preview={tradeSwapPreview}
                            showOnPitch={showSwapPreviewOnPitch}
                            onToggleShowOnPitch={() =>
                              setShowSwapPreviewOnPitch((v) => !v)
                            }
                            onResetPreview={resetTradeBuilder}
                          />
                        )}
                      </div>

                      {/* DUAL FORMATION PITCH VIEW (DEFAULT) */}
                      {pickerViewMode === 'formation' &&
                        partnerFormationLayout && (
                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                            {/* LEFT: Partner Club Formation Pitch + 5 Core Bench Below */}
                            <div className="lg:col-span-6 rounded-2xl border border-slate-800 bg-[#0b111c] p-3.5 space-y-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <JerseySvg
                                    primaryColor={
                                      activeClubOffer.club.primaryColor
                                    }
                                    secondaryColor={
                                      activeClubOffer.club.secondaryColor
                                    }
                                    pattern={activeClubOffer.club.pattern}
                                    label={activeClubOffer.club.shortName}
                                    size={28}
                                  />
                                  <div className="min-w-0">
                                    <div className="truncate text-xs font-black text-white">
                                      {activeClubOffer.club.name} (
                                      {partnerFormationLayout.formationId} · 주전 11 + 벤치 {partnerFormationLayout.bench.length})
                                    </div>
                                    {activeClubNeeds && (
                                      <div className="text-[10px] font-bold text-sky-300">
                                        {activeClubNeeds.summaryText}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {isMirrorSwapPreviewActive && (
                                    <span className="rounded bg-rose-500/18 border border-rose-400/45 px-1.5 py-0.5 text-[9.5px] font-black text-rose-200 whitespace-nowrap">
                                      가상 교체 중
                                    </span>
                                  )}
                                  <span className="rounded bg-emerald-500/15 border border-emerald-400/35 px-2 py-0.5 text-[10px] font-extrabold text-emerald-200 whitespace-nowrap">
                                    받는 선수 {selectedAiPlayers.length}/3
                                  </span>
                                </div>
                              </div>

                              {/* Partner Pitch */}
                              <div className="relative aspect-[4/3.85] sm:aspect-[4/4.5] w-full overflow-hidden rounded-xl border border-slate-700/80 bg-gradient-to-b from-[#0e261c] via-[#102c20] to-[#0c2218]">
                                {/* Pitch Markings */}
                                <div className="pointer-events-none absolute inset-3 rounded border border-white/15">
                                  <div className="absolute left-0 right-0 top-1/2 h-px bg-white/15" />
                                  <div className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/15" />
                                  <div className="absolute left-1/2 top-0 h-10 w-28 -translate-x-1/2 border-b border-x border-white/15" />
                                  <div className="absolute left-1/2 bottom-0 h-10 w-28 -translate-x-1/2 border-t border-x border-white/15" />
                                </div>

                                {partnerFormationLayout.slots.map(
                                  (slot, idx) => {
                                    const t =
                                      partnerFormationLayout.starters[idx];
                                    if (!t) return null;
                                    const origP = t.player;
                                    const mirroredPair = isMirrorSwapPreviewActive
                                      ? (swapPairByAiId.get(origP.id) ?? null)
                                      : null;
                                    const p = mirroredPair
                                      ? mirroredPair.outPlayer
                                      : origP;
                                    const isPicked =
                                      selectedAiPlayerIds.includes(origP.id);
                                    const tpVal = mirroredPair
                                      ? computePlayerTradePoints({
                                          player: p,
                                          receivingClubNeeds: activeClubNeeds,
                                          stats:
                                            season.allPlayerStats[p.id] ??
                                            season.allPlayerStats[`user::${p.id}`] ??
                                            null,
                                          conditionMap: season.playerConditions,
                                        })
                                      : computePlayerTradePoints({
                                          player: origP,
                                          sellingClubNeeds: activeClubNeeds,
                                          isShockBargain: Boolean(t.isShockBargain),
                                          stats: season.allPlayerStats[origP.id] ?? null,
                                          conditionMap: season.playerConditions,
                                        });
                                      const cond = season.playerConditions?.[p.id];
                                      const inj = cond
                                        ? isPlayerActivelyInjured(cond)
                                        : false;
                                      const mt = cond
                                        ? getMoraleTier(cond.morale)
                                        : 'normal';
                                      const myFit = evaluateManagerPlayerSynergy(
                                        p,
                                        state.manager.traitId,
                                      );
                                      const mv = mirroredPair
                                        ? computePlayerMarketValueM(p)
                                        : computePlayerMarketValueM(origP, {
                                            isShockBargain: Boolean(t.isShockBargain),
                                            marketValueMOverride: t.marketValueM,
                                          });

                                      return (
                                        <div
                                          key={`ai-pitch-${idx}-${origP.id}`}
                                          onClick={() => {
                                            if (mirroredPair?.isFiller) {
                                              handleToggleUserSlot({
                                                area: mirroredPair.area,
                                                index: mirroredPair.index,
                                              });
                                            } else {
                                              handleToggleAiPlayer(origP.id);
                                            }
                                          }}
                                          onContextMenu={(e) => {
                                            e.preventDefault();
                                            setInspectedPlayer(p);
                                          }}
                                          style={{
                                            left: `${slot.x}%`,
                                            top: `${slot.y}%`,
                                          }}
                                          title={
                                            mirroredPair
                                              ? `[가상 교체] ${p.name} (OVR ${p.ovr}) ←→ ${origP.name} (OVR ${origP.ovr}) · 클릭 시 선택 해제 (우클릭 상세)`
                                              : t.isShockBargain
                                                ? `${origP.name} · €${mv}M · TP ${Math.round(tpVal.effectiveTp)} · ${t.bargainReason ?? '프런트 급매 -35%'}${myFit.bonus > 0 ? ` · ★ 내 감독 궁합 일치` : ''} (우클릭 상세)`
                                                : `${origP.name} (주전 ${slot.label} · OVR ${origP.ovr} · €${mv}M · TP ${Math.round(tpVal.effectiveTp)})${myFit.bonus > 0 ? ` · ★ 내 감독 궁합 일치` : ''} (우클릭 상세)`
                                          }
                                          className={`absolute -translate-x-1/2 -translate-y-1/2 w-[60px] sm:w-[74px] rounded-lg border px-1 py-0.5 sm:px-1.5 sm:py-0.5 text-center transition-colors cursor-pointer select-none touch-manipulation ${
                                            mirroredPair
                                              ? 'border-rose-400 bg-rose-950/95 ring-2 ring-rose-400/65 shadow-md z-25'
                                              : isPicked
                                                ? 'border-emerald-300 bg-emerald-950/95 ring-1 ring-emerald-400/70 shadow-md z-20'
                                                : t.isShockBargain
                                                  ? 'border-rose-400/80 bg-rose-950/90 ring-1 ring-rose-400/45 hover:border-emerald-400 z-15'
                                                  : myFit.bonus > 0
                                                    ? 'border-amber-400/55 bg-slate-950/90 hover:border-emerald-400/70 z-10'
                                                    : 'border-slate-700/85 bg-slate-950/90 hover:border-emerald-400/60 z-10'
                                          }`}
                                        >
                                          {mirroredPair ? (
                                            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 max-w-[76px] truncate whitespace-nowrap rounded bg-rose-500 px-1 py-px text-[7px] font-black text-white shadow">
                                              ↔{shortPitchName(origP.name)}
                                            </span>
                                          ) : t.isShockBargain ? (
                                            <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-rose-600 px-1 py-px text-[7px] font-black text-white shadow">
                                              급매-35%
                                            </span>
                                          ) : null}
                                          <div className="flex items-center justify-between text-[7.5px] sm:text-[8.5px] tabular-nums leading-none">
                                            <span className="font-semibold text-slate-400">
                                              {slot.label}
                                            </span>
                                            <span className="inline-flex items-center gap-0.5 font-bold text-amber-300">
                                              {!mirroredPair &&
                                                renderMyManagerFitBadge(
                                                  p,
                                                  state.manager.traitId,
                                                  'star',
                                                )}
                                              {p.ovr}
                                            </span>
                                          </div>
                                          <div className="mt-0.5 flex items-center justify-center gap-0.5">
                                            <CountryFlagSvg
                                              code={p.nationalityCode}
                                              nationality={p.nationality}
                                              size="xs"
                                            />
                                            <span className="truncate text-[8.5px] sm:text-[9.5px] font-bold text-white leading-tight">
                                              {shortPitchName(p.name)}
                                            </span>
                                          </div>
                                          <div className="mt-0.5 flex items-center justify-center gap-1 text-[7.5px] sm:text-[8.5px] tabular-nums leading-none">
                                            <span className={`font-mono ${mirroredPair ? 'text-rose-200' : 'text-sky-300/90'}`}>
                                              {Math.round(tpVal.effectiveTp)}
                                            </span>
                                            {inj && cond?.injury && (
                                              <PixelStatusIcon
                                                variant="injury"
                                                size={9}
                                                title={getInjuryTooltip(
                                                  cond.injury,
                                                )}
                                              />
                                            )}
                                            {mt === 'ecstatic' && (
                                              <PixelStatusIcon
                                                variant="morale_high"
                                                size={9}
                                                title={`사기 ${getMoraleLabel(cond!.morale)}`}
                                              />
                                            )}
                                            {mt === 'frozen' && (
                                              <PixelStatusIcon
                                                variant="morale_low"
                                                size={9}
                                                title={`사기 ${getMoraleLabel(cond!.morale)}`}
                                              />
                                            )}
                                          </div>
                                        </div>
                                      );
                                    },
                                  )}
                                </div>

                                {/* Partner Club 5 Core Bench Below Pitch */}
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between text-[10px]">
                                    <span className="font-extrabold text-slate-300">
                                      상대 벤치 ({partnerFormationLayout.bench.length}명)
                                    </span>
                                    <span className="text-slate-500">
                                      탭하여 트레이드 선택
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                                    {partnerFormationLayout.bench.map((t) => {
                                      const origP = t.player;
                                      const mirroredPair = isMirrorSwapPreviewActive
                                        ? (swapPairByAiId.get(origP.id) ?? null)
                                        : null;
                                      const p = mirroredPair
                                        ? mirroredPair.outPlayer
                                        : origP;
                                      const isPicked =
                                        selectedAiPlayerIds.includes(origP.id);
                                      const tpVal = mirroredPair
                                        ? computePlayerTradePoints({
                                            player: p,
                                            receivingClubNeeds: activeClubNeeds,
                                            stats:
                                              season.allPlayerStats[p.id] ??
                                              season.allPlayerStats[`user::${p.id}`] ??
                                              null,
                                            conditionMap: season.playerConditions,
                                          })
                                        : computePlayerTradePoints({
                                            player: origP,
                                            sellingClubNeeds: activeClubNeeds,
                                            isShockBargain: Boolean(t.isShockBargain),
                                            stats: season.allPlayerStats[origP.id] ?? null,
                                            conditionMap: season.playerConditions,
                                          });
                                      const myFit = evaluateManagerPlayerSynergy(
                                        p,
                                        state.manager.traitId,
                                      );
                                      const mv = mirroredPair
                                        ? computePlayerMarketValueM(p)
                                        : computePlayerMarketValueM(origP, {
                                            isShockBargain: Boolean(t.isShockBargain),
                                            marketValueMOverride: t.marketValueM,
                                          });
                                      return (
                                        <div
                                          key={`ai-bench-${origP.id}`}
                                          onClick={() => {
                                            if (mirroredPair?.isFiller) {
                                              handleToggleUserSlot({
                                                area: mirroredPair.area,
                                                index: mirroredPair.index,
                                              });
                                            } else {
                                              handleToggleAiPlayer(origP.id);
                                            }
                                          }}
                                          onContextMenu={(e) => {
                                            e.preventDefault();
                                            setInspectedPlayer(p);
                                          }}
                                          title={
                                            mirroredPair
                                              ? `[가상 교체] ${p.name} (OVR ${p.ovr}) ←→ ${origP.name} (OVR ${origP.ovr}) · 클릭 시 선택 해제`
                                              : `${origP.name} · OVR ${origP.ovr} · €${mv}M · TP ${Math.round(tpVal.effectiveTp)}${myFit.bonus > 0 ? ' · ★ 내 감독 궁합 일치' : ''}`
                                          }
                                          className={`rounded-lg border px-2 py-1.5 transition-colors cursor-pointer select-none touch-manipulation ${
                                            mirroredPair
                                              ? 'border-rose-400 bg-rose-950/50 ring-1 ring-rose-400/60'
                                              : isPicked
                                                ? 'border-emerald-400 bg-emerald-950/45 ring-1 ring-emerald-400/50'
                                                : t.isShockBargain
                                                  ? 'border-rose-400/70 bg-rose-950/30 hover:border-emerald-400'
                                                  : myFit.bonus > 0
                                                    ? 'border-amber-400/45 bg-[#101826] hover:border-emerald-400/70'
                                                    : 'border-slate-800 bg-[#101826] hover:border-slate-600'
                                          }`}
                                        >
                                          <div className="flex items-center justify-between text-[9px] tabular-nums">
                                            <span
                                              className={`whitespace-nowrap rounded px-1 py-px font-bold ${
                                                mirroredPair
                                                  ? 'bg-rose-500/25 text-rose-200'
                                                  : 'bg-slate-800 text-sky-300'
                                              }`}
                                            >
                                              {mirroredPair
                                                ? `↔${shortPitchName(origP.name)}`
                                                : (t.slotLabel ?? `벤치 ${origP.position}`)}
                                            </span>
                                            <span className="inline-flex items-center gap-0.5 whitespace-nowrap font-black text-amber-300">
                                              {!mirroredPair &&
                                                renderMyManagerFitBadge(
                                                  p,
                                                  state.manager.traitId,
                                                  'star',
                                                )}
                                              {p.ovr} · {Math.round(tpVal.effectiveTp)}
                                            </span>
                                          </div>
                                          <div className="mt-0.5 flex items-center justify-between gap-1 min-w-0">
                                            <div className="flex items-center gap-1 min-w-0">
                                              <CountryFlagSvg
                                                code={p.nationalityCode}
                                                nationality={p.nationality}
                                                size="xs"
                                              />
                                              <span className="truncate text-[11px] font-bold text-white">
                                                {p.name}
                                              </span>
                                            </div>
                                            {!mirroredPair && t.isShockBargain && (
                                              <span className="whitespace-nowrap rounded bg-rose-500/25 px-1 text-[8px] font-black text-rose-200 shrink-0">
                                                급매
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                            </div>

                            {/* RIGHT: User Club Formation Pitch + 5 Bench Below */}
                            <div className="lg:col-span-6 rounded-2xl border border-slate-800 bg-[#0b111c] p-3.5 space-y-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <JerseySvg
                                    primaryColor={state.userClub.primaryColor}
                                    secondaryColor={
                                      state.userClub.secondaryColor
                                    }
                                    pattern={state.userClub.pattern}
                                    label={state.userClub.shortName}
                                    size={28}
                                  />
                                  <div className="min-w-0">
                                    <div className="truncate text-xs font-black text-emerald-300">
                                      📤 {state.userClub.name} ({state.formation} · 주전 11 + 벤치 {Math.max(0, userSquadPlayers.length - 11)})
                                    </div>
                                    <div className="text-[10px] text-slate-400">
                                      🔥 상대 최우선 니즈 +32% · ✨ 보강 니즈 +18% · ⚠️ 포화 -25%
                                    </div>
                                  </div>
                                </div>
                                <span className="rounded bg-rose-500/15 border border-rose-400/35 px-2 py-0.5 text-[10px] font-extrabold text-rose-200 shrink-0">
                                  보내는 선수 {selectedUserSlots.length}/3
                                </span>
                              </div>

                              {/* Unified Squad Pitch + Free Bench with Live Virtual Swap Preview */}
                              {(() => {
                                const usePreview =
                                  showSwapPreviewOnPitch &&
                                  tradeSwapPreview.isActive;
                                const activeRatings = usePreview
                                  ? tradeSwapPreview.afterRatings
                                  : teamRatings;
                                const pairBySlotKey = new Map(
                                  tradeSwapPreview.swapPairs.map((pair) => [
                                    pair.slotKey,
                                    pair,
                                  ]),
                                );
                                return (
                                  <PitchBoard
                                    formation={state.formation}
                                    starters={
                                      usePreview
                                        ? tradeSwapPreview.previewStarters
                                        : state.starters
                                    }
                                    bench={
                                      usePreview
                                        ? tradeSwapPreview.previewBench
                                        : state.bench
                                    }
                                    chemistry={
                                      usePreview
                                        ? tradeSwapPreview.afterChemistry
                                        : chemistry
                                    }
                                    baselineStarters={
                                      usePreview ? state.starters : null
                                    }
                                    managerTraitId={state.manager.traitId}
                                    tactic={state.defaultTactic}
                                    conditionByPlayerId={
                                      season.playerConditions
                                    }
                                    selectedSlotKeys={selectedUserSlotKeys}
                                    previewSlotKeys={
                                      usePreview
                                        ? tradeSwapPreview.previewSlotKeys
                                        : undefined
                                    }
                                    selectedTone="rose"
                                    onSlotClick={(area, index) => {
                                      const p =
                                        area === 'starter'
                                          ? state.starters[index]
                                          : state.bench[index];
                                      if (!p) return;
                                      handleToggleUserSlot({ area, index });
                                    }}
                                    onInspectPlayer={(p) =>
                                      setInspectedPlayer(p)
                                    }
                                    slotExtraMeta={(area, index, p) => {
                                      const sk = `${area}:${index}`;
                                      const swapped = usePreview
                                        ? pairBySlotKey.get(sk)
                                        : undefined;
                                      if (swapped) {
                                        return (
                                          <div className="mt-0.5 flex items-center justify-center gap-0.5 text-[7px] sm:text-[7.5px] leading-none text-emerald-300/95 font-bold truncate max-w-full">
                                            <span>
                                              ↔{shortPitchName(swapped.outPlayer.name)}
                                            </span>
                                          </div>
                                        );
                                      }
                                      const tpVal = computePlayerTradePoints({
                                        player: p,
                                        receivingClubNeeds: activeClubNeeds,
                                        stats:
                                          season.allPlayerStats[p.id] ??
                                          season.allPlayerStats[
                                            `user::${p.id}`
                                          ] ??
                                          null,
                                        conditionMap: season.playerConditions,
                                      });
                                      const isTopNeed = tpVal.needModPct >= 30;
                                      const isSecondNeed =
                                        tpVal.needModPct > 0 &&
                                        tpVal.needModPct < 30;
                                      const isSaturated = tpVal.needModPct < 0;
                                      return (
                                        <div
                                          className={`mt-0.5 flex items-center justify-center gap-0.5 text-[7.5px] sm:text-[8px] tabular-nums leading-none ${
                                            highlightNeedsOnly &&
                                            !isTopNeed &&
                                            !isSecondNeed
                                              ? 'opacity-40'
                                              : ''
                                          }`}
                                        >
                                          <span className="font-mono font-bold text-rose-300/95">
                                            {Math.round(tpVal.effectiveTp)}
                                          </span>
                                          {isTopNeed && (
                                            <span
                                              className={`font-black text-amber-300 ${
                                                highlightNeedsOnly
                                                  ? 'rounded bg-amber-500/25 border border-amber-400/50 px-1 py-px text-[7px]'
                                                  : 'text-[8px]'
                                              }`}
                                            >
                                              {highlightNeedsOnly
                                                ? '🔥+32%'
                                                : '🔥'}
                                            </span>
                                          )}
                                          {isSecondNeed && (
                                            <span
                                              className={`font-black text-sky-300 ${
                                                highlightNeedsOnly
                                                  ? 'rounded bg-sky-500/20 border border-sky-400/45 px-1 py-px text-[7px]'
                                                  : 'text-[8px]'
                                              }`}
                                            >
                                              {highlightNeedsOnly
                                                ? '✨+18%'
                                                : '✨'}
                                            </span>
                                          )}
                                          {highlightNeedsOnly && isSaturated && (
                                            <span className="text-[7px] font-bold text-slate-500">
                                              포화
                                            </span>
                                          )}
                                        </div>
                                      );
                                    }}
                                    compact
                                    showBench
                                    showChemBreakdown={false}
                                    showChemLegend
                                    headerLabel={
                                      usePreview
                                        ? `${state.userClub.name} · 프리뷰`
                                        : state.userClub.name
                                    }
                                    headerRight={
                                      <span className="font-mono text-[10px] font-bold text-slate-300 tabular-nums">
                                        A{' '}
                                        <strong className="text-white">
                                          {activeRatings.effectiveAtt}
                                        </strong>{' '}
                                        · M{' '}
                                        <strong className="text-white">
                                          {activeRatings.effectiveMid}
                                        </strong>{' '}
                                        · D{' '}
                                        <strong className="text-white">
                                          {activeRatings.effectiveDef}
                                        </strong>
                                      </span>
                                    }
                                  />
                                );
                              })()}
                            </div>
                          </div>
                        )}

                      {/* LIST VIEW (OPTIONAL TOGGLE) */}
                      {pickerViewMode === 'list' && (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4">
                          {/* Left: Partner List (16-man: Starters 11 + Core Bench 5) */}
                          <div className="lg:col-span-6 rounded-2xl border border-slate-800 bg-[#0b111c] p-2.5 sm:p-3.5 space-y-2.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="text-xs font-black text-white">
                                📥 {activeClubOffer.club.name} (16인)
                              </div>
                              <div className="flex items-center gap-1">
                                {(['ALL', 'GK', 'DF', 'MF', 'FW'] as const).map(
                                  (pf) => (
                                    <button
                                      key={`pf-${pf}`}
                                      type="button"
                                      onClick={() => setPosFilter(pf)}
                                      className={`rounded-md border px-2 py-1 text-[10px] font-bold cursor-pointer touch-manipulation transition-colors ${
                                        posFilter === pf
                                          ? 'bg-slate-800 text-white border-sky-400/50'
                                          : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:text-white'
                                      }`}
                                    >
                                      {pf === 'ALL' ? '전체' : pf}
                                    </button>
                                  ),
                                )}
                              </div>
                            </div>

                            <div className="max-h-[340px] sm:max-h-[380px] overflow-y-auto space-y-1 pr-1">
                              {filteredPartnerSquad.map((target) => {
                                const origP = target.player;
                                const mirroredPair = isMirrorSwapPreviewActive
                                  ? (swapPairByAiId.get(origP.id) ?? null)
                                  : null;
                                const p = mirroredPair
                                  ? mirroredPair.outPlayer
                                  : origP;
                                const isPicked = selectedAiPlayerIds.includes(
                                  origP.id,
                                );
                                const isStarterTarget =
                                  target.isStarter !== undefined
                                    ? target.isStarter
                                    : Boolean(
                                        partnerFormationLayout?.starterIdSet.has(
                                          origP.id,
                                        ),
                                      );
                                const roleBadgeLabel = isStarterTarget
                                  ? `선발 · ${target.slotLabel ?? origP.position}`
                                  : target.slotLabel ?? `벤치 ${origP.position}`;
                                const tpVal = mirroredPair
                                  ? computePlayerTradePoints({
                                      player: p,
                                      receivingClubNeeds: activeClubNeeds,
                                      stats:
                                        season.allPlayerStats[p.id] ??
                                        season.allPlayerStats[`user::${p.id}`] ??
                                        null,
                                      conditionMap: season.playerConditions,
                                    })
                                  : computePlayerTradePoints({
                                      player: origP,
                                      sellingClubNeeds: activeClubNeeds,
                                      isShockBargain: Boolean(target.isShockBargain),
                                      stats: season.allPlayerStats[origP.id] ?? null,
                                      conditionMap: season.playerConditions,
                                    });
                                const mv = mirroredPair
                                  ? computePlayerMarketValueM(p)
                                  : computePlayerMarketValueM(origP, {
                                      isShockBargain: Boolean(target.isShockBargain),
                                      marketValueMOverride: target.marketValueM,
                                    });
                                const tier = getCardTier(p);
                                return (
                                  <div
                                    key={`ai-p-${origP.id}`}
                                    onClick={() => {
                                      if (mirroredPair?.isFiller) {
                                        handleToggleUserSlot({
                                          area: mirroredPair.area,
                                          index: mirroredPair.index,
                                        });
                                      } else {
                                        handleToggleAiPlayer(origP.id);
                                      }
                                    }}
                                    className={`w-full rounded-xl border px-2.5 py-1.5 sm:px-3 sm:py-2 text-left transition-colors cursor-pointer touch-manipulation flex items-center justify-between gap-2 ${
                                      mirroredPair
                                        ? 'border-rose-400 bg-rose-950/35 ring-1 ring-rose-400/50'
                                        : isPicked
                                          ? 'border-emerald-400 bg-emerald-950/35 ring-1 ring-emerald-400/40'
                                          : target.isShockBargain
                                            ? 'border-rose-400/60 bg-rose-950/25 hover:border-emerald-400'
                                            : 'border-slate-800 bg-[#101826] hover:border-slate-600'
                                    }`}
                                  >
                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-center gap-1">
                                        <span
                                          className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[9px] font-black ${
                                            mirroredPair
                                              ? 'bg-rose-500/25 text-rose-200'
                                              : isStarterTarget
                                                ? 'bg-emerald-500/20 text-emerald-300'
                                                : 'bg-sky-500/15 text-sky-300'
                                          }`}
                                        >
                                          {roleBadgeLabel}
                                        </span>
                                        <CountryFlagSvg
                                          code={p.nationalityCode}
                                          nationality={p.nationality}
                                          size="xs"
                                        />
                                        <span className="truncate text-xs font-extrabold text-white">
                                          {p.name}
                                        </span>
                                        {mirroredPair && (
                                          <span className="whitespace-nowrap rounded bg-rose-500/25 border border-rose-400/45 px-1 py-px text-[9px] font-black text-rose-200">
                                            ↔ {shortPitchName(origP.name)}
                                          </span>
                                        )}
                                        {tier === 'superstar' && (
                                          <Sparkles className="h-3 w-3 text-cyan-300 shrink-0" />
                                        )}
                                        {!mirroredPair &&
                                          renderMyManagerFitBadge(
                                            p,
                                            state.manager.traitId,
                                            'pill',
                                          )}
                                        {!mirroredPair && target.isShockBargain && (
                                          <span className="whitespace-nowrap rounded bg-rose-500/25 border border-rose-400/50 px-1 py-px text-[9px] font-black text-rose-200">
                                            🚨-35%
                                          </span>
                                        )}
                                      </div>
                                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
                                        <span className="whitespace-nowrap">
                                          {formatMainPositions(p)}
                                        </span>
                                        <span className="whitespace-nowrap">
                                          · STA {p.stamina}
                                        </span>
                                        {!mirroredPair && (
                                          <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
                                            {target.formTrend === 'up' && (
                                              <TrendingUp className="h-3 w-3 text-emerald-400" />
                                            )}
                                            {target.formTrend === 'down' && (
                                              <TrendingDown className="h-3 w-3 text-rose-400" />
                                            )}
                                            {target.formRating.toFixed(1)}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0 tabular-nums">
                                      <div className="text-right">
                                        <div className="text-xs font-black text-amber-300">
                                          {p.ovr}
                                        </div>
                                        <div className={`whitespace-nowrap text-[10px] font-mono ${mirroredPair ? 'text-rose-300' : 'text-sky-300'}`}>
                                          €{mv}M · TP {tpVal.effectiveTp}
                                        </div>
                                      </div>
                                      <button
                                        type="button"
                                        aria-label={`${p.name} 상세 보기`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setInspectedPlayer(p);
                                        }}
                                        className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-slate-400 hover:border-sky-400 hover:text-sky-300 cursor-pointer touch-manipulation"
                                      >
                                        <Info className="h-3 w-3" />
                                      </button>
                                      <span
                                        className={`rounded-lg border px-2 py-1 text-[10px] font-bold ${
                                          mirroredPair
                                            ? 'bg-rose-500/20 text-rose-200 border-rose-400/50'
                                            : isPicked
                                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/45'
                                              : 'bg-slate-800/80 text-slate-300 border-slate-700/70'
                                        }`}
                                      >
                                        {mirroredPair ? '↔' : isPicked ? '✓' : '+'}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Right: User List */}
                          <div className="lg:col-span-6 rounded-2xl border border-slate-800 bg-[#0b111c] p-2.5 sm:p-3.5 space-y-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-xs font-black text-emerald-300">
                                📤 {state.userClub.name} (16인)
                              </div>
                              <span className="rounded bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-slate-300">
                                {selectedUserSlots.length}/3
                              </span>
                            </div>

                            <div className="max-h-[340px] sm:max-h-[380px] overflow-y-auto space-y-1 pr-1">
                              {userRosterEntries.map((entry) => {
                                const origP = entry.player;
                                const mirroredUserPair = isMirrorSwapPreviewActive
                                  ? (swapPairByUserSlotKey.get(entry.key) ?? null)
                                  : null;
                                const p = mirroredUserPair
                                  ? mirroredUserPair.inPlayer
                                  : origP;
                                const isPicked = selectedUserSlots.some(
                                  (s) => slotKey(s) === entry.key,
                                );
                                const tpVal = mirroredUserPair
                                  ? computePlayerTradePoints({
                                      player: p,
                                      sellingClubNeeds: activeClubNeeds,
                                      stats: season.allPlayerStats[p.id] ?? null,
                                      conditionMap: season.playerConditions,
                                    })
                                  : computePlayerTradePoints({
                                      player: origP,
                                      receivingClubNeeds: activeClubNeeds,
                                      stats:
                                        season.allPlayerStats[origP.id] ??
                                        season.allPlayerStats[`user::${origP.id}`] ??
                                        null,
                                      conditionMap: season.playerConditions,
                                    });
                                const mv = computePlayerMarketValueM(p);
                                return (
                                  <div
                                    key={`u-p-${entry.key}`}
                                    onClick={() =>
                                      handleToggleUserSlot(entry.ref)
                                    }
                                    className={`w-full rounded-xl border px-2.5 py-1.5 sm:px-3 sm:py-2 text-left transition-colors cursor-pointer touch-manipulation flex items-center justify-between gap-2 ${
                                      mirroredUserPair
                                        ? 'border-emerald-400 bg-emerald-950/35 ring-1 ring-emerald-400/50'
                                        : isPicked
                                          ? 'border-rose-400 bg-rose-950/35 ring-1 ring-rose-400/40'
                                          : 'border-slate-800 bg-[#101826] hover:border-slate-600'
                                    }`}
                                  >
                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-center gap-1">
                                        <span
                                          className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[9px] font-black ${
                                            entry.isStarter
                                              ? 'bg-emerald-500/20 text-emerald-300'
                                              : 'bg-slate-800 text-slate-400'
                                          }`}
                                        >
                                          {entry.isStarter
                                            ? `선발 · ${entry.slotLabel}`
                                            : `벤치 ${entry.slotLabel}`}
                                        </span>
                                        <CountryFlagSvg
                                          code={p.nationalityCode}
                                          nationality={p.nationality}
                                          size="xs"
                                        />
                                        <span className="truncate text-xs font-extrabold text-white">
                                          {p.name}
                                        </span>
                                        {mirroredUserPair && (
                                          <span className="whitespace-nowrap rounded bg-emerald-500/25 border border-emerald-400/45 px-1 py-px text-[9px] font-black text-emerald-200">
                                            ↔ {shortPitchName(origP.name)}
                                          </span>
                                        )}
                                        {renderMyManagerFitBadge(
                                          p,
                                          state.manager.traitId,
                                          'short',
                                        )}
                                      </div>
                                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
                                        <span className="whitespace-nowrap">
                                          {formatMainPositions(p)} · STA{' '}
                                          {p.stamina}
                                        </span>
                                        {!mirroredUserPair && tpVal.needModPct >= 30 && (
                                          <span className="whitespace-nowrap rounded bg-amber-500/20 px-1 py-px text-[9px] font-black text-amber-200">
                                            🔥+32%
                                          </span>
                                        )}
                                        {!mirroredUserPair && tpVal.needModPct > 0 && tpVal.needModPct < 30 && (
                                          <span className="whitespace-nowrap rounded bg-sky-500/15 px-1 py-px text-[9px] font-black text-sky-200">
                                            ✨+18%
                                          </span>
                                        )}
                                        {!mirroredUserPair && tpVal.needModPct < 0 && (
                                          <span className="whitespace-nowrap rounded bg-slate-800 px-1 py-px text-[9px] font-bold text-slate-400">
                                            ⚠️-25%
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0 tabular-nums">
                                      <div className="text-right">
                                        <div className="text-xs font-black text-white">
                                          {p.ovr}
                                        </div>
                                        <div className={`whitespace-nowrap text-[10px] font-mono ${mirroredUserPair ? 'text-emerald-300' : 'text-rose-300'}`}>
                                          €{mv}M · TP {tpVal.effectiveTp}
                                        </div>
                                      </div>
                                      <button
                                        type="button"
                                        aria-label={`${p.name} 상세 보기`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setInspectedPlayer(p);
                                        }}
                                        className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-slate-400 hover:border-sky-400 hover:text-sky-300 cursor-pointer touch-manipulation"
                                      >
                                        <Info className="h-3 w-3" />
                                      </button>
                                      <span
                                        className={`rounded-lg px-2 py-1 text-[10px] font-black ${
                                          mirroredUserPair
                                            ? 'bg-emerald-500 text-slate-950'
                                            : isPicked
                                              ? 'bg-rose-500 text-white'
                                              : 'bg-slate-800 text-slate-300'
                                        }`}
                                      >
                                        {mirroredUserPair ? '↔' : isPicked ? '✓' : '+'}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
              </>
            )}
          </div>
        )}

        {/* Season Completed Trades Log */}
        {activeTab !== 'tactics' && (tm.tradeHistory?.length ?? 0) > 0 && (
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
                      IN{' '}
                      {rec.receivedPlayers
                        .map((p) => `${p.name}(${p.ovr})`)
                        .join(' + ')}
                    </span>
                    <span className="text-slate-500">↔</span>
                    <span className="font-bold text-rose-300">
                      OUT{' '}
                      {rec.sentPlayers
                        .map((p) => `${p.name}(${p.ovr})`)
                        .join(' + ')}
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

      {/* Sticky Bottom Classic FA Bar (instant feedback when clicking a player to release) */}
      {activeTab === 'explore' &&
        activeClubOffer?.isLegendSlot &&
        activeClubOffer.squad[0] &&
        legendOutSlot &&
        (() => {
          const legTarget = activeClubOffer.squad[0];
          const pickedOut =
            legendOutSlot.area === 'starter'
              ? state.starters[legendOutSlot.index]
              : state.bench[legendOutSlot.index];
          if (!pickedOut) return null;
          const alreadySigned = tm.signedPlayerIds.includes(legTarget.player.id);
          const chancePct = Math.min(
            95,
            Math.round(
              legTarget.successChance +
                computeCashLegendChanceBonus(clampedCashOfferM),
            ),
          );
          return (
            <div className="shrink-0 border-t border-amber-500/35 bg-[#0b101b] px-3 py-2 sm:px-4 sm:py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] sm:text-[11px] min-w-0 flex-1">
                  <span className="inline-flex items-center gap-1 rounded-md border border-amber-400/45 bg-amber-500/15 px-1.5 py-0.5 font-bold text-amber-200 whitespace-nowrap">
                    IN {shortPitchName(legTarget.player.name)} ({legTarget.player.ovr})
                  </span>
                  <span className="text-slate-500">↔</span>
                  <button
                    type="button"
                    onClick={() => setInspectedPlayer(pickedOut)}
                    className="inline-flex items-center gap-1 rounded-md border border-rose-400/45 bg-rose-500/15 px-1.5 py-0.5 font-bold text-rose-200 cursor-pointer whitespace-nowrap"
                  >
                    <span>OUT {shortPitchName(pickedOut.name)} ({pickedOut.ovr})</span>
                    <Info className="h-2.5 w-2.5 opacity-80" />
                  </button>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setLegendOutSlot(null)}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-[10px] sm:text-[11px] font-bold text-slate-300 cursor-pointer whitespace-nowrap"
                  >
                    원복
                  </button>
                  <button
                    type="button"
                    disabled={
                      alreadySigned ||
                      tm.attemptsRemaining <= 0 ||
                      ffpEmbargoActive
                    }
                    onClick={() => handleSubmitLegendOffer(legTarget)}
                    className="rounded-lg bg-amber-400 px-3 py-1.5 text-[11px] sm:text-xs font-black text-slate-950 hover:bg-amber-300 disabled:opacity-40 cursor-pointer whitespace-nowrap"
                  >
                    {alreadySigned
                      ? '영입 완료'
                      : `👑 제안 확정 (${chancePct}%)`}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {/* Sticky Bottom Trade Bar (Mobile & PC convenience: inspect selected players & submit without scrolling back up!) */}
      {activeTab === 'explore' &&
        activeClubOffer &&
        !activeClubOffer.isLegendSlot &&
        (selectedAiPlayers.length > 0 || selectedUserPlayers.length > 0) && (
          <div className="shrink-0 border-t border-slate-800 bg-[#090f19] px-3 py-2 sm:px-4 sm:py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1 min-w-0 flex-1 text-[10px] sm:text-[11px]">
                {selectedAiPlayers.map((p) => (
                  <button
                    key={`bar-in-${p.id}`}
                    type="button"
                    onClick={() => setInspectedPlayer(p)}
                    className="inline-flex items-center gap-1 rounded-md border border-emerald-400/40 bg-emerald-500/15 px-1.5 py-0.5 font-bold text-emerald-200 cursor-pointer touch-manipulation"
                    title="탭하여 선수 상세 카드 보기"
                  >
                    <span>IN {shortPitchName(p.name)}</span>
                    <Info className="h-2.5 w-2.5 opacity-80" />
                  </button>
                ))}
                {selectedUserPlayers.map((p) => (
                  <button
                    key={`bar-out-${p.id}`}
                    type="button"
                    onClick={() => setInspectedPlayer(p)}
                    className="inline-flex items-center gap-1 rounded-md border border-rose-400/40 bg-rose-500/15 px-1.5 py-0.5 font-bold text-rose-200 cursor-pointer touch-manipulation"
                    title="탭하여 선수 상세 카드 보기"
                  >
                    <span>OUT {shortPitchName(p.name)}</span>
                    <Info className="h-2.5 w-2.5 opacity-80" />
                  </button>
                ))}
                {tradeSwapPreview.isActive && (
                  <span className="hidden sm:inline-flex items-center gap-1.5 rounded-md border border-slate-700/80 bg-slate-900/90 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-200 tabular-nums whitespace-nowrap">
                    <span>
                      케미{' '}
                      <strong
                        className={
                          tradeSwapPreview.chemDelta > 0
                            ? 'text-emerald-300'
                            : tradeSwapPreview.chemDelta < 0
                              ? 'text-rose-300'
                              : 'text-slate-400'
                        }
                      >
                        {tradeSwapPreview.chemDelta > 0 ? '+' : ''}
                        {tradeSwapPreview.chemDelta}
                      </strong>
                    </span>
                    <span>
                      OVR{' '}
                      <strong
                        className={
                          tradeSwapPreview.ovrDelta > 0
                            ? 'text-emerald-300'
                            : tradeSwapPreview.ovrDelta < 0
                              ? 'text-rose-300'
                              : 'text-slate-400'
                        }
                      >
                        {tradeSwapPreview.ovrDelta > 0 ? '+' : ''}
                        {tradeSwapPreview.ovrDelta.toFixed(1)}
                      </strong>
                    </span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {counterOfferClub && (
                  <button
                    type="button"
                    onClick={() => handleExitCounterOffer()}
                    className="inline-flex items-center gap-1 rounded-lg border border-amber-400/45 bg-amber-500/12 px-2 py-1.5 text-[10px] sm:text-[11px] font-extrabold text-amber-200 hover:bg-amber-400 hover:text-slate-950 cursor-pointer touch-manipulation whitespace-nowrap"
                  >
                    <ArrowLeft className="h-3 w-3" />
                    이전
                  </button>
                )}
                <button
                  type="button"
                  onClick={resetTradeBuilder}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-[10px] sm:text-[11px] font-bold text-slate-300 cursor-pointer touch-manipulation whitespace-nowrap"
                >
                  원복
                </button>
                <button
                  type="button"
                  disabled={!canSubmitTrade}
                  onClick={handleSubmitTrade}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] sm:text-xs font-extrabold text-white hover:bg-emerald-500 disabled:opacity-40 cursor-pointer touch-manipulation whitespace-nowrap transition-colors"
                >
                  {tradeEval
                    ? `제안 확정 (${tradeEval.acceptanceChance}%)`
                    : '선수 선택 중'}
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Accidental Close Guard Modal */}
      {confirmCloseOpen && (
        <div className="modal-backdrop fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 p-4">
          <div className="modal-panel w-full max-w-sm rounded-2xl border border-slate-700/90 bg-[#0d1420] p-5 shadow-2xl space-y-4">
            <div className="space-y-1.5">
              <h3 className="text-sm font-black text-white">
                {isUclSpecial
                  ? '특별 이적시장을 마치고 UCL을 시작할까요?'
                  : '이적시장을 끝내시겠습니까?'}
              </h3>
              <p className="text-xs leading-relaxed text-slate-400">
                이적시장을 끝내면 이번 회차의 남은 기회가 모두 종료됩니다.
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1 text-[11px]">
                {tm.attemptsRemaining > 0 && (
                  <span className="rounded-md border border-slate-700 bg-slate-900 px-2 py-0.5 font-bold text-slate-200 tabular-nums">
                    남은 트레이드 기회 {tm.attemptsRemaining}회
                  </span>
                )}
                {pendingIncomingCount > 0 && (
                  <span className="rounded-md border border-amber-400/35 bg-amber-500/12 px-2 py-0.5 font-bold text-amber-200 tabular-nums">
                    미확인 받은 제안 {pendingIncomingCount}건
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmCloseOpen(false)}
                className="rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700 hover:text-white cursor-pointer touch-manipulation"
              >
                계속 진행
              </button>
              <button
                id="confirm-close-transfer-window-btn"
                type="button"
                onClick={() => {
                  setConfirmCloseOpen(false);
                  transferCloseWindow();
                }}
                className="rounded-xl border border-rose-500/45 bg-rose-600/90 px-3.5 py-2 text-xs font-extrabold text-white hover:bg-rose-500 cursor-pointer touch-manipulation"
              >
                {isUclSpecial ? 'UCL 시작' : '이적시장 끝내기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Player Detail Card Modal (z-[60], floats cleanly above Trade Room!) */}
      {inspectedPlayer && (() => {
        const starterIdx = state.starters.findIndex(
          (p) => p?.id === inspectedPlayer.id,
        );
        const matchedSlotSubPos =
          starterIdx >= 0
            ? FORMATIONS[state.formation]?.slots[starterIdx]?.subPosition
            : undefined;
        return (
          <PlayerDetailModal
            player={inspectedPlayer}
            slotSubPosition={matchedSlotSubPos}
            slotSynergy={
              Object.values(chemistry.slotSynergies).find(
                (s) => s.playerId === inspectedPlayer.id,
              ) ?? null
            }
            managerTraitId={state.manager.traitId}
            seasonStats={inspectedBreakdown?.total ?? null}
            competitionStats={inspectedBreakdown}
            condition={season.playerConditions?.[inspectedPlayer.id] ?? null}
            onClose={() => setInspectedPlayer(null)}
          />
        );
      })()}
    </div>
  );

  if (embedded) return shellContent;

  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-2 sm:p-4">
      {shellContent}
    </div>
  );
}
