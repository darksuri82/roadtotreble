import {
  AlertCircle,
  ArrowLeft,
  ArrowLeftRight,
  Check,
  CheckCircle2,
  Info,
  LayoutGrid,
  List,
  Loader2,
  Send,
  ShieldAlert,
  X,
  XCircle,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { FORMATIONS } from '../../../data/formations';
import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock';
import {
  calculateChemistry,
  calculateTeamRatings,
} from '../../../engine/chemistryEngine';
import {
  evaluatePositionFit,
  formatMainPositions,
} from '../../../engine/positionEngine';
import {
  analyzeClubPositionNeeds,
  buildTradeClubOfferForClub,
  computePlayerTradePoints,
  evaluateTradePackage,
  selectAutoFillerPlayers,
} from '../../../engine/transferEngine';
import type { PlayerConditionMap } from '../../../types/condition';
import type {
  FormationId,
  IncomingTradeOffer,
  ManagerTraitId,
  TransferClubOffer,
  TransferTargetPlayer,
} from '../../../types/game';
import type { TacticId } from '../../../types/league';
import type { MpTradeResultNote } from '../../../types/mpLeague';
import {
  getCardTier,
  LEAGUE_LABELS,
  type Player,
  type Position,
} from '../../../types/player';
import { CountryFlagSvg } from '../../common/CountryFlagSvg';
import { JerseySvg } from '../../common/JerseySvg';
import { PitchBoard } from '../../common/PitchBoard';
import { PlayerDetailModal } from '../../common/PlayerDetailModal';
import { PlayerNameButton } from '../../common/PlayerNameButton';

export interface MpCounterTradePayload {
  offerId: string;
  sendPlayerId?: string;
  userSentPlayerIds: string[];
  aiTargetPlayerIds: string[];
  aiFillerPlayerIds: string[];
}

export interface MpLeagueTransferModalProps {
  windowIndex: number;
  offers: IncomingTradeOffer[];
  offerClubs?: Record<string, TransferClubOffer>;
  attemptsLeft: number;
  tradeNote: MpTradeResultNote | null;
  myStarters: Player[];
  myBench: Player[];
  myRank?: number;
  leagueSize?: number;
  conditionMap?: PlayerConditionMap;
  busy: boolean;
  done: boolean;
  waitingNames: string[];
  onAccept: (offerId: string) => void;
  onReject: (offerId: string) => void;
  onCounter: (payload: MpCounterTradePayload) => void;
  onFinish: () => void;
  myFormation?: FormationId;
  myTactic?: TacticId;
  managerTraitId?: ManagerTraitId | null;
}

type PickerViewMode = 'formation' | 'list';
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

function shortPitchName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length <= 7) return trimmed;
  const parts = trimmed.split(' ');
  const last = parts[parts.length - 1] ?? trimmed;
  return last.length <= 8 ? last : trimmed.slice(0, 7);
}

function assignPartnerSquadToFormation(
  formationId: FormationId,
  targets: TransferTargetPlayer[],
): {
  starters: (TransferTargetPlayer | null)[];
  bench: TransferTargetPlayer[];
} {
  const config = FORMATIONS[formationId] ?? FORMATIONS['4-3-3'];
  const slots = config.slots;
  const taggedStarters = targets.filter((t) => t.isStarter === true);
  const taggedBench = targets.filter((t) => t.isStarter === false);
  if (taggedStarters.length === slots.length) {
    return { starters: taggedStarters, bench: taggedBench };
  }

  const assigned: (TransferTargetPlayer | null)[] = Array.from(
    { length: slots.length },
    () => null,
  );
  const usedIds = new Set<string>();
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
  return {
    starters: assigned,
    bench: targets.filter((t) => !usedIds.has(t.player.id)),
  };
}

export function MpLeagueTransferModal({
  windowIndex,
  offers,
  offerClubs,
  attemptsLeft,
  tradeNote,
  myStarters,
  myBench,
  myRank = 10,
  leagueSize = 20,
  conditionMap,
  busy,
  done,
  waitingNames,
  onAccept,
  onReject,
  onCounter,
  onFinish,
  myFormation = '4-3-3',
  myTactic = 'balanced',
  managerTraitId = null,
}: MpLeagueTransferModalProps) {
  useBodyScrollLock(true);
  const [counterOfferId, setCounterOfferId] = useState<string | null>(null);
  const [pickerViewMode, setPickerViewMode] =
    useState<PickerViewMode>('formation');
  const [posFilter, setPosFilter] = useState<PosFilter>('ALL');
  const [selectedAiPlayerIds, setSelectedAiPlayerIds] = useState<string[]>([]);
  const [selectedUserSlots, setSelectedUserSlots] = useState<SlotRef[]>([]);
  const [customFillerIds, setCustomFillerIds] = useState<string[] | null>(null);
  const [inspectedPlayer, setInspectedPlayer] = useState<Player | null>(null);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);

  const locked = busy || done;
  const noAttempts = attemptsLeft <= 0;
  const pendingCount = offers.filter((o) => o.status === 'pending').length;

  const formationSlots = (FORMATIONS[myFormation] ?? FORMATIONS['4-3-3']).slots;

  const myChemistry = useMemo(
    () => calculateChemistry(myFormation, myStarters, myTactic, managerTraitId),
    [myFormation, myStarters, myTactic, managerTraitId],
  );
  const myRatings = useMemo(
    () =>
      calculateTeamRatings(
        myFormation,
        myStarters,
        myChemistry.total,
        managerTraitId,
        myChemistry.slotSynergies,
      ),
    [myFormation, myStarters, myChemistry.total, myChemistry.slotSynergies, managerTraitId],
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
    myStarters.forEach((p, idx) => {
      if (p) {
        const ref: SlotRef = { area: 'starter', index: idx };
        entries.push({
          ref,
          key: slotKey(ref),
          player: p,
          slotLabel: formationSlots[idx]?.label ?? `S${idx + 1}`,
          isStarter: true,
        });
      }
    });
    myBench.forEach((p, idx) => {
      if (p) {
        const ref: SlotRef = { area: 'bench', index: idx };
        entries.push({
          ref,
          key: slotKey(ref),
          player: p,
          slotLabel: p.mainPositions[0] ?? p.position,
          isStarter: false,
        });
      }
    });
    return entries;
  }, [myStarters, myBench, formationSlots]);

  const userSquadPlayers = useMemo(
    () => userRosterEntries.map((e) => e.player),
    [userRosterEntries],
  );

  // Active incoming offer being countered (auto-exits if offer is no longer pending)
  const activeOffer = useMemo(
    () =>
      counterOfferId
        ? offers.find((o) => o.id === counterOfferId && o.status === 'pending') ??
          null
        : null,
    [counterOfferId, offers],
  );

  const activeClubOffer: TransferClubOffer | null = useMemo(() => {
    if (!activeOffer) return null;
    const fromHost = offerClubs?.[activeOffer.id];
    if (fromHost) return fromHost;
    return buildTradeClubOfferForClub({
      club: activeOffer.club,
      leagueId: activeOffer.leagueId,
      clubRank: activeOffer.clubRank,
      leagueSize: activeOffer.leagueSize,
      currentRound: 1,
      totalRounds: 38,
      windowIndex,
      userRank: myRank,
      userLeagueSize: leagueSize,
      isUserLeague: false,
      aiRoster: activeOffer.aiOffersPlayers,
      allPlayerStats: {},
      ownedIds: new Set(userSquadPlayers.map((p) => p.id)),
      excludeIds: new Set(userSquadPlayers.map((p) => p.id)),
    });
  }, [activeOffer, offerClubs, windowIndex, myRank, leagueSize, userSquadPlayers]);

  const partnerFormationId: FormationId =
    activeClubOffer?.club?.formation ?? '4-3-3';
  const partnerFormationSlots = (
    FORMATIONS[partnerFormationId] ?? FORMATIONS['4-3-3']
  ).slots;

  const partnerFormationLayout = useMemo(() => {
    if (!activeClubOffer) return null;
    return assignPartnerSquadToFormation(
      partnerFormationId,
      activeClubOffer.squad,
    );
  }, [activeClubOffer, partnerFormationId]);

  const selectedAiPlayers = useMemo(() => {
    if (!activeClubOffer) return [];
    const byId = new Map(activeClubOffer.squad.map((t) => [t.player.id, t.player]));
    return selectedAiPlayerIds
      .map((id) => byId.get(id))
      .filter((p): p is Player => Boolean(p));
  }, [activeClubOffer, selectedAiPlayerIds]);

  const selectedUserPlayers = useMemo(() => {
    const byKey = new Map(userRosterEntries.map((e) => [e.key, e.player]));
    return selectedUserSlots
      .map((ref) => byKey.get(slotKey(ref)))
      .filter((p): p is Player => Boolean(p));
  }, [userRosterEntries, selectedUserSlots]);

  const neededFillerCount = Math.max(
    0,
    selectedUserPlayers.length - selectedAiPlayers.length,
  );

  const optionalFillerPool = useMemo(() => {
    if (!activeClubOffer) return [];
    const targetSet = new Set(selectedAiPlayerIds);
    return activeClubOffer.squad
      .map((t) => t.player)
      .filter((p) => !targetSet.has(p.id))
      .sort((a, b) => a.ovr - b.ovr);
  }, [activeClubOffer, selectedAiPlayerIds]);

  const autoFillerPlayers = useMemo(() => {
    if (
      !activeClubOffer ||
      !activeClubOffer.club ||
      activeClubOffer.leagueId === 'LEGEND' ||
      neededFillerCount === 0
    ) {
      return [];
    }
    if (customFillerIds && customFillerIds.length === neededFillerCount) {
      const byId = new Map(optionalFillerPool.map((p) => [p.id, p]));
      const resolved = customFillerIds
        .map((id) => byId.get(id))
        .filter((p): p is Player => Boolean(p));
      if (resolved.length === neededFillerCount) return resolved;
    }
    return selectAutoFillerPlayers({
      aiRoster: activeClubOffer.squad.map((t) => t.player),
      aiTargetIds: new Set(selectedAiPlayerIds),
      userSentPlayers: selectedUserPlayers,
      neededCount: neededFillerCount,
      club: activeClubOffer.club,
      leagueId: activeClubOffer.leagueId,
      excludeIds: new Set(userSquadPlayers.map((p) => p.id)),
    });
  }, [
    activeClubOffer,
    neededFillerCount,
    customFillerIds,
    optionalFillerPool,
    selectedAiPlayerIds,
    selectedUserPlayers,
    userSquadPlayers,
  ]);

  const tradeEval = useMemo(() => {
    if (
      !activeClubOffer ||
      !activeClubOffer.club ||
      selectedAiPlayers.length === 0 ||
      selectedUserPlayers.length === 0
    ) {
      return null;
    }
    const aiRoster = activeClubOffer.squad.map((t) => t.player);
    const shockBargainIds = new Set(
      activeClubOffer.squad
        .filter((t) => t.isShockBargain)
        .map((t) => t.player.id),
    );
    return evaluateTradePackage({
      userSentPlayers: selectedUserPlayers,
      aiTargetPlayers: selectedAiPlayers,
      aiFillerPlayers: autoFillerPlayers,
      aiClub: activeClubOffer.club,
      aiRoster,
      aiNeeds: activeClubOffer.clubNeeds ?? analyzeClubPositionNeeds(aiRoster),
      userSquad: userSquadPlayers,
      userRank: myRank,
      userLeagueSize: leagueSize,
      aiClubRank: activeClubOffer.clubRank,
      aiLeagueSize: activeClubOffer.leagueSize,
      allPlayerStats: {},
      conditionMap,
      shockBargainIds,
    });
  }, [
    activeClubOffer,
    selectedAiPlayers,
    selectedUserPlayers,
    autoFillerPlayers,
    userSquadPlayers,
    myRank,
    leagueSize,
    conditionMap,
  ]);

  const handleStartCounterOffer = (offer: IncomingTradeOffer) => {
    setCounterOfferId(offer.id);
    setSelectedAiPlayerIds(offer.aiOffersPlayers.map((p) => p.id));
    const preSlots: SlotRef[] = [];
    for (const req of offer.userRequestedPlayers) {
      const found = userRosterEntries.find((e) => e.player.id === req.id);
      if (found) preSlots.push(found.ref);
    }
    setSelectedUserSlots(preSlots);
    setCustomFillerIds(null);
    setPosFilter('ALL');
  };

  const handleExitCounterOffer = () => {
    setCounterOfferId(null);
    setSelectedAiPlayerIds([]);
    setSelectedUserSlots([]);
    setCustomFillerIds(null);
    setPosFilter('ALL');
  };

  const handleToggleAiPlayer = (pid: string) => {
    setCustomFillerIds(null);
    setSelectedAiPlayerIds((prev) => {
      if (prev.includes(pid)) return prev.filter((id) => id !== pid);
      if (prev.length >= 3) return prev;
      return [...prev, pid];
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

  const handleCycleFiller = (fillerIdx: number) => {
    if (optionalFillerPool.length <= neededFillerCount) return;
    const currentIds = autoFillerPlayers.map((p) => p.id);
    const curId = currentIds[fillerIdx];
    const startIdx = optionalFillerPool.findIndex((p) => p.id === curId);
    for (let step = 1; step <= optionalFillerPool.length; step += 1) {
      const candidate =
        optionalFillerPool[(startIdx + step) % optionalFillerPool.length];
      if (!currentIds.includes(candidate.id)) {
        const nextIds = [...currentIds];
        nextIds[fillerIdx] = candidate.id;
        setCustomFillerIds(nextIds);
        return;
      }
    }
  };

  const canSubmitCounter = Boolean(
    activeOffer &&
      !locked &&
      !noAttempts &&
      tradeEval &&
      !tradeEval.blockedReason &&
      tradeEval.requiredUserReleaseCount === 0 &&
      selectedAiPlayers.length > 0 &&
      selectedUserPlayers.length > 0,
  );

  const handleSubmitCounter = () => {
    if (!activeOffer || !canSubmitCounter) return;
    onCounter({
      offerId: activeOffer.id,
      sendPlayerId: selectedUserPlayers[0]?.id,
      userSentPlayerIds: selectedUserPlayers.map((p) => p.id),
      aiTargetPlayerIds: selectedAiPlayers.map((p) => p.id),
      aiFillerPlayerIds: autoFillerPlayers.map((p) => p.id),
    });
    handleExitCounterOffer();
  };

  const filteredPartnerSquad = useMemo(() => {
    if (!activeClubOffer) return [];
    const list = activeClubOffer.squad;
    return posFilter === 'ALL'
      ? list
      : list.filter((t) => t.player.position === posFilter);
  }, [activeClubOffer, posFilter]);

  const filteredUserEntries = useMemo(() => {
    return posFilter === 'ALL'
      ? userRosterEntries
      : userRosterEntries.filter((e) => e.player.position === posFilter);
  }, [userRosterEntries, posFilter]);

  return (
    <div
      id="mp-league-transfer-modal"
      className="modal-backdrop fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/85 p-2.5 sm:p-4"
    >
      <div className="modal-panel flex flex-col w-full max-w-6xl overflow-hidden rounded-2xl border border-slate-800 bg-[#0e1522] shadow-2xl">
        {/* Top Header — matches original TransferMarketModal.tsx */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-800 bg-[#090f19] px-4 py-3">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-sky-400/35 bg-sky-500/12 text-sky-300">
              <ArrowLeftRight className="h-4 w-4" />
            </div>
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              <h2 className="text-sm sm:text-base font-black text-white">
                제 {windowIndex}차 트레이드 ·{' '}
                {activeOffer ? `역제안 (${activeOffer.club.shortName})` : '받은 제안'}
              </h2>
              <span
                className={`rounded-md border px-2 py-0.5 text-[11px] font-extrabold tabular-nums ${
                  noAttempts
                    ? 'border-slate-700 bg-slate-900/80 text-slate-500'
                    : 'border-emerald-400/35 bg-emerald-500/12 text-emerald-300'
                }`}
              >
                {attemptsLeft}/3회
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {activeOffer && (
              <button
                id="mp-counter-offer-back-btn"
                type="button"
                onClick={handleExitCounterOffer}
                className="inline-flex items-center gap-1 rounded-xl border border-amber-400/45 bg-amber-500/12 px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-extrabold text-amber-200 hover:bg-amber-500/22 hover:text-amber-100 transition cursor-pointer touch-manipulation whitespace-nowrap"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                받은 제안으로
              </button>
            )}
            {done ? (
              <div className="flex min-w-0 max-w-full items-center gap-1.5 rounded-xl border border-slate-700 bg-[#0b1018] px-3 py-1.5 text-xs font-bold text-slate-300">
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-sky-300" />
                <span className="shrink-0">다른 감독 대기 중</span>
                {waitingNames.length > 0 && (
                  <span className="min-w-0 truncate text-slate-500">
                    {waitingNames.join(', ')}
                  </span>
                )}
              </div>
            ) : (
              <button
                id="mp-close-transfer-window-btn"
                type="button"
                disabled={busy}
                onClick={() => {
                  if (attemptsLeft > 0 && pendingCount > 0) {
                    setConfirmCloseOpen(true);
                  } else {
                    onFinish();
                  }
                }}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-900 px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-bold text-slate-300 hover:border-rose-400/50 hover:text-rose-200 transition cursor-pointer disabled:opacity-40 whitespace-nowrap"
              >
                <X className="h-3.5 w-3.5" />
                이적시장 끝내기
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="modal-scroll flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-5 space-y-4">
          {/* Last Negotiation Result Banner */}
          {tradeNote && (
            <div
              className={`rounded-xl border px-4 py-2.5 flex items-start gap-2.5 ${
                tradeNote.success
                  ? 'border-emerald-500/45 bg-emerald-950/30 text-emerald-100'
                  : 'border-rose-500/45 bg-rose-950/30 text-rose-100'
              }`}
            >
              {tradeNote.success ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
              ) : (
                <XCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              )}
              <div className="min-w-0 text-xs sm:text-sm font-bold">
                {tradeNote.message}
              </div>
            </div>
          )}

          {/* VIEW A: INCOMING OFFERS LIST (Original TransferMarketModal Card Design) */}
          {!activeOffer && (
            <div className="space-y-3">
              {offers.length === 0 ? (
                <div className="rounded-2xl border border-slate-800 bg-[#0b111c] px-4 py-10 text-center text-xs font-bold text-slate-500">
                  이번 이적시장에 도착한 타 구단 트레이드 제안이 없습니다.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {offers.map((offer) => {
                    const isPending = offer.status === 'pending';
                    return (
                      <div
                        key={offer.id}
                        className={`rounded-2xl border p-3.5 sm:p-4 space-y-3 ${
                          offer.isBlockbusterBargain && isPending
                            ? 'border-amber-400/50 bg-[#131823]'
                            : 'border-slate-800 bg-[#101827]'
                        } ${isPending ? '' : 'opacity-55'}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <JerseySvg
                              primaryColor={offer.club.primaryColor}
                              secondaryColor={offer.club.secondaryColor}
                              pattern={offer.club.pattern}
                              label={offer.club.shortName}
                              size={36}
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="truncate text-sm font-black text-white">
                                  {offer.club.name}
                                </span>
                                {offer.isBlockbusterBargain && (
                                  <span className="shrink-0 rounded bg-rose-500/20 border border-rose-400/45 px-1.5 py-0.5 text-[9px] font-black text-rose-200">
                                    🚨 급매
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {LEAGUE_LABELS[offer.leagueId]} {offer.clubRank}위 ·{' '}
                                {offer.club.formation}
                              </div>
                            </div>
                          </div>
                          {offer.status === 'accepted' && (
                            <span className="rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-black text-emerald-300">
                              성사됨
                            </span>
                          )}
                          {offer.status === 'rejected' && (
                            <span className="rounded-md border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-slate-400">
                              거절됨
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {/* AI Offers */}
                          <div className="space-y-1">
                            <div className="text-[10px] font-extrabold text-emerald-300">
                              📥 받는 선수
                            </div>
                            {offer.aiOffersPlayers.map((p) => {
                              const val = computePlayerTradePoints({ player: p });
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
                                    <PlayerNameButton
                                      onClick={() => setInspectedPlayer(p)}
                                      className="truncate text-xs font-extrabold text-white"
                                    >
                                      {p.name}
                                    </PlayerNameButton>
                                  </div>
                                  <div className="mt-0.5 flex items-center justify-between text-[10px] text-slate-300 tabular-nums">
                                    <span>
                                      {formatMainPositions(p)} · STA {p.stamina}
                                    </span>
                                    <span className="font-black text-emerald-300">
                                      OVR {p.ovr} · 가치 {val.effectiveTp}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* AI Requests */}
                          <div className="space-y-1">
                            <div className="text-[10px] font-extrabold text-rose-300">
                              📤 보내는 선수
                            </div>
                            {offer.userRequestedPlayers.map((p) => {
                              const val = computePlayerTradePoints({ player: p });
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
                                    <PlayerNameButton
                                      onClick={() => setInspectedPlayer(p)}
                                      className="truncate text-xs font-extrabold text-white"
                                    >
                                      {p.name}
                                    </PlayerNameButton>
                                  </div>
                                  <div className="mt-0.5 flex items-center justify-between text-[10px] text-slate-300 tabular-nums">
                                    <span>
                                      {formatMainPositions(p)} · STA {p.stamina}
                                    </span>
                                    <span className="font-black text-rose-300">
                                      OVR {p.ovr} · 가치 {val.effectiveTp}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {offer.aiPitch && (
                          <p className="rounded-lg bg-slate-950/70 px-3 py-2 text-[11px] leading-relaxed text-slate-300 italic">
                            {offer.club.shortName} 단장: {offer.aiPitch}
                          </p>
                        )}

                        {isPending && (
                          <div className="flex flex-wrap items-center gap-2 pt-0.5">
                            <button
                              type="button"
                              disabled={locked || noAttempts}
                              onClick={() => onAccept(offer.id)}
                              className="flex-1 min-w-[100px] rounded-xl bg-emerald-500 px-3 py-2 text-xs font-black text-slate-950 hover:bg-emerald-400 disabled:opacity-40 cursor-pointer"
                            >
                              ✅ 즉시 수락
                            </button>
                            <button
                              type="button"
                              disabled={locked || noAttempts}
                              onClick={() => handleStartCounterOffer(offer)}
                              className="flex-1 min-w-[115px] rounded-xl border border-sky-400/45 bg-sky-500/15 px-3 py-2 text-xs font-extrabold text-sky-200 hover:bg-sky-500/25 disabled:opacity-40 cursor-pointer"
                            >
                              🔄 조건 수정 · 역제안
                            </button>
                            <button
                              type="button"
                              disabled={locked}
                              onClick={() => onReject(offer.id)}
                              className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-400 hover:border-rose-400/50 hover:text-rose-300 disabled:opacity-40 cursor-pointer"
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

          {/* VIEW B: ORIGINAL COUNTER-OFFER NEGOTIATION ROOM (Identical to TransferMarketModal.tsx) */}
          {activeOffer && activeClubOffer && activeClubOffer.club && (
            <div className="space-y-3.5">
              {/* Partner Club Header + Position Needs + View Toggle */}
              <div className="rounded-2xl border border-slate-800 bg-[#0b111c] p-3.5 sm:p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex flex-wrap items-center gap-2.5 min-w-0">
                    <JerseySvg
                      primaryColor={activeClubOffer.club.primaryColor}
                      secondaryColor={activeClubOffer.club.secondaryColor}
                      pattern={activeClubOffer.club.pattern}
                      label={activeClubOffer.club.shortName}
                      size={36}
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-sm font-black text-white">
                          {activeClubOffer.club.name}
                        </span>
                        <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-sky-300">
                          {selectedUserPlayers.length} : {selectedAiPlayers.length}
                          {autoFillerPlayers.length > 0
                            ? ` (+백업 ${autoFillerPlayers.length})`
                            : ''}{' '}
                          패키지
                        </span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-slate-400">
                        <span>
                          {activeClubOffer.leagueId !== 'LEGEND'
                            ? LEAGUE_LABELS[activeClubOffer.leagueId]
                            : ''}{' '}
                          {activeClubOffer.clubRank}위 · {partnerFormationId}
                        </span>
                        {activeClubOffer.clubNeeds?.neededPositions.map((p, nIdx) => (
                          <span
                            key={`need-${p}`}
                            className={`rounded px-1.5 py-0.5 text-[9px] font-extrabold ${
                              nIdx === 0
                                ? 'bg-amber-500/20 text-amber-200 border border-amber-400/40'
                                : 'bg-sky-500/15 text-sky-200 border border-sky-400/35'
                            }`}
                          >
                            {nIdx === 0 ? '🔥 최우선' : '✨ 필요'} {POS_BADGE_KO[p]}
                          </span>
                        ))}
                        {activeClubOffer.clubNeeds?.saturatedPositions.map((p) => (
                          <span
                            key={`sat-${p}`}
                            className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-bold text-slate-400"
                          >
                            포화 {POS_BADGE_KO[p]}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
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
                    {(selectedAiPlayers.length > 0 || selectedUserPlayers.length > 0) && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedAiPlayerIds([]);
                          setSelectedUserSlots([]);
                          setCustomFillerIds(null);
                        }}
                        className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-[10px] font-bold text-slate-300 hover:text-white cursor-pointer"
                      >
                        초기화
                      </button>
                    )}
                  </div>
                </div>

                {/* Side-by-side Package Chips */}
                <div className="grid grid-cols-1 md:grid-cols-11 gap-2.5 items-stretch">
                  {/* AI Sending */}
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
                      <div className="py-2 text-center text-[11px] text-slate-500">
                        좌측 상대 구단에서 영입할 선수를 선택하세요
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
                                <PlayerNameButton
                                  onClick={() => setInspectedPlayer(p)}
                                  className="truncate font-bold text-white"
                                >
                                  {p.name}
                                </PlayerNameButton>
                                <span className="text-[10px] text-slate-400 shrink-0">
                                  {p.position} · {p.ovr}
                                </span>
                                {val?.isShockBargain && (
                                  <span className="rounded bg-rose-500/25 border border-rose-400/50 px-1 py-px text-[9px] font-black text-rose-200 shrink-0">
                                    🚨 급매 -35%
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {val && (
                                  <span className="font-mono text-[10px] font-bold text-emerald-300 tabular-nums">
                                    가치 {val.effectiveTp}
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

                        {autoFillerPlayers.map((fp, fIdx) => (
                          <div
                            key={`filler-${fp.id}`}
                            className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-sky-400/40 bg-sky-950/25 px-2.5 py-1.5 text-[11px]"
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="rounded bg-sky-500/20 px-1 py-px text-[9px] font-black text-sky-300 shrink-0">
                                16인 백업
                              </span>
                              <PlayerNameButton
                                onClick={() => setInspectedPlayer(fp)}
                                className="truncate font-bold text-sky-100"
                              >
                                {fp.name}
                              </PlayerNameButton>
                              <span className="text-[10px] text-slate-400 shrink-0">
                                {fp.position} · {fp.ovr}
                              </span>
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
                      <div className="py-2 text-center text-[11px] text-slate-500">
                        우측 우리 팀에서 보낼 선수를 선택하세요
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {selectedUserPlayers.map((p, idx) => {
                          const val = tradeEval?.userValuations.find(
                            (v) => v.playerId === p.id,
                          );
                          const ref = selectedUserSlots[idx];
                          return (
                            <div
                              key={`send-${p.id}`}
                              className="flex items-center justify-between gap-2 rounded-lg bg-slate-950/75 px-2.5 py-1.5 text-xs"
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
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
                                <span className="text-[10px] text-slate-400 shrink-0">
                                  {p.position} · {p.ovr}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {val && (
                                  <span className="font-mono text-[10px] font-bold text-rose-300 tabular-nums">
                                    가치 {val.effectiveTp}
                                  </span>
                                )}
                                {ref && (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleUserSlot(ref)}
                                    className="text-slate-500 hover:text-rose-300 cursor-pointer"
                                    aria-label={`${p.name} 제거`}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Live Probability & Value Verdict Meter */}
                {tradeEval && (
                  <div className="rounded-xl border border-slate-800 bg-[#090e16] p-3 space-y-2">
                    {tradeEval.blockedReason ? (
                      <div className="flex items-center gap-2 text-xs font-bold text-rose-300">
                        <ShieldAlert className="h-4 w-4 shrink-0" />
                        <span>{tradeEval.blockedReason}</span>
                      </div>
                    ) : tradeEval.requiredUserReleaseCount > 0 ? (
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>
                          16인 로스터 유지를 위해 우리 팀 선수 {tradeEval.requiredUserReleaseCount}명을 더 선택하세요.
                        </span>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="font-bold text-slate-300">
                            {tradeEval.gmReaction}
                          </span>
                          <span
                            className={`font-display text-base font-black tabular-nums ${
                              tradeEval.acceptanceChance >= 70
                                ? 'text-emerald-300'
                                : tradeEval.acceptanceChance >= 40
                                  ? 'text-amber-300'
                                  : 'text-rose-300'
                            }`}
                          >
                            성사 확률 {tradeEval.acceptanceChance}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-900">
                          <div
                            className={`h-full rounded-full transition-all ${
                              tradeEval.acceptanceChance >= 70
                                ? 'bg-emerald-400'
                                : tradeEval.acceptanceChance >= 40
                                  ? 'bg-amber-400'
                                  : 'bg-rose-400'
                            }`}
                            style={{ width: `${tradeEval.acceptanceChance}%` }}
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Dual Roster Picker: Formation View or List View */}
              {pickerViewMode === 'formation' && partnerFormationLayout ? (
                <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
                  {/* LEFT: Partner Club Formation Pitch + 5 Bench */}
                  <div className="rounded-2xl border border-emerald-500/25 bg-[#0c1320] p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-extrabold text-emerald-300">
                        {activeClubOffer.club.name} ({partnerFormationId})
                      </span>
                      <span className="text-[10px] text-slate-400">
                        클릭하여 영입 대상 선택
                      </span>
                    </div>

                    <div className="pitch-surface relative aspect-[4/4.2] w-full overflow-hidden rounded-xl border border-slate-800">
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
                          strokeWidth="0.4"
                        />
                        <circle
                          cx="50"
                          cy="50"
                          r="11"
                          fill="none"
                          stroke="rgba(255,255,255,0.10)"
                          strokeWidth="0.4"
                        />
                      </svg>
                      {partnerFormationSlots.map((slot, idx) => {
                        const t = partnerFormationLayout.starters[idx];
                        if (!t) return null;
                        const p = t.player;
                        const selected = selectedAiPlayerIds.includes(p.id);
                        const isBargain = Boolean(t.isShockBargain);
                        const tier = getCardTier(p);
                        return (
                          <button
                            key={`p-st-${slot.index}`}
                            type="button"
                            onClick={() => handleToggleAiPlayer(p.id)}
                            style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                            className={`absolute -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center rounded-lg px-1.5 py-1 min-w-[54px] sm:min-w-[64px] max-w-[78px] text-center transition-colors cursor-pointer touch-manipulation ${
                              selected
                                ? 'bg-emerald-950/95 border-2 border-emerald-400 ring-2 ring-emerald-400/50'
                                : tier === 'legend'
                                  ? 'bg-amber-950/90 border border-amber-400/80'
                                  : tier === 'superstar'
                                    ? 'bg-cyan-950/90 border border-cyan-400/80'
                                    : 'bg-[#0f1621]/95 border border-slate-700/80 hover:border-emerald-400/60'
                            }`}
                          >
                            {isBargain && (
                              <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded bg-rose-500 px-1 text-[7px] font-black text-white whitespace-nowrap">
                                급매
                              </span>
                            )}
                            <span className="font-display text-[11px] font-bold text-white leading-none tabular-nums">
                              {p.ovr}
                            </span>
                            <span className="mt-0.5 max-w-[68px] truncate text-[8.5px] font-semibold text-slate-200 leading-tight">
                              {shortPitchName(p.name)}
                            </span>
                            <span className="text-[7.5px] text-slate-400">
                              {slot.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Partner Bench */}
                    <div className="grid grid-cols-5 gap-1">
                      {partnerFormationLayout.bench.slice(0, 5).map((t) => {
                        const p = t.player;
                        const selected = selectedAiPlayerIds.includes(p.id);
                        return (
                          <button
                            key={`p-bn-${p.id}`}
                            type="button"
                            onClick={() => handleToggleAiPlayer(p.id)}
                            className={`rounded-lg border p-1.5 text-center transition-colors cursor-pointer touch-manipulation ${
                              selected
                                ? 'border-emerald-400 bg-emerald-500/20'
                                : 'border-slate-800 bg-[#0a0f18] hover:border-slate-600'
                            }`}
                          >
                            <div className="text-[8px] font-bold text-slate-400">
                              {p.position}
                            </div>
                            <div className="font-display text-xs font-bold text-white tabular-nums">
                              {p.ovr}
                            </div>
                            <div className="truncate text-[9px] text-slate-300">
                              {shortPitchName(p.name)}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* RIGHT: Unified Original Squad Pitch + Free Bench (100% identical chemistry, +/- OVR, A/M/D) */}
                  <div className="rounded-2xl border border-rose-500/25 bg-[#0c1320] p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-extrabold text-rose-300">
                        📤 우리 팀 ({myFormation} · 보내는 선수 {selectedUserSlots.length}/3)
                      </span>
                      <span className="text-[10px] text-slate-400">
                        클릭 선택 · 우클릭 상세
                      </span>
                    </div>

                    <PitchBoard
                      formation={myFormation}
                      starters={myStarters}
                      bench={myBench}
                      chemistry={myChemistry}
                      managerTraitId={managerTraitId}
                      conditionByPlayerId={conditionMap}
                      selectedSlotKeys={selectedUserSlotKeys}
                      selectedTone="rose"
                      onSlotClick={(area, index) => {
                        const p = area === 'starter' ? myStarters[index] : myBench[index];
                        if (!p) return;
                        handleToggleUserSlot({ area, index });
                      }}
                      onInspectPlayer={(p) => setInspectedPlayer(p)}
                      slotExtraMeta={(_area, _index, p) => {
                        const tpVal = computePlayerTradePoints({
                          player: p,
                          receivingClubNeeds: activeClubOffer.clubNeeds ?? null,
                          conditionMap,
                        });
                        return (
                          <div className="mt-0.5 flex items-center justify-center gap-0.5 text-[7.5px] sm:text-[8px] tabular-nums leading-none">
                            <span className="font-mono font-bold text-rose-300/95">
                              {Math.round(tpVal.effectiveTp)}
                            </span>
                            {tpVal.needModPct >= 30 && (
                              <span className="text-[8px] font-black text-amber-300">
                                🔥
                              </span>
                            )}
                            {tpVal.needModPct > 0 && tpVal.needModPct < 30 && (
                              <span className="text-[8px] font-black text-sky-300">
                                ✨
                              </span>
                            )}
                          </div>
                        );
                      }}
                      compact
                      showBench
                      showChemBreakdown={false}
                      showChemLegend
                      headerRight={
                        <span className="font-mono text-[10px] font-bold text-slate-300 tabular-nums">
                          A <strong className="text-white">{myRatings.effectiveAtt}</strong> · M{' '}
                          <strong className="text-white">{myRatings.effectiveMid}</strong> · D{' '}
                          <strong className="text-white">{myRatings.effectiveDef}</strong>
                        </span>
                      }
                    />
                  </div>
                </div>
              ) : (
                /* List View */
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center gap-1">
                    {(['ALL', 'FW', 'MF', 'DF', 'GK'] as PosFilter[]).map((pf) => (
                      <button
                        key={pf}
                        type="button"
                        onClick={() => setPosFilter(pf)}
                        className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold cursor-pointer ${
                          posFilter === pf
                            ? 'bg-slate-800 text-white border-emerald-500/50'
                            : 'bg-[#111822] text-slate-400 border-slate-800 hover:text-white'
                        }`}
                      >
                        {pf === 'ALL' ? '전체' : pf}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    {/* Partner List */}
                    <div className="rounded-xl border border-slate-800 bg-[#0b111c] p-2.5 space-y-1.5">
                      <div className="text-xs font-extrabold text-emerald-300 px-1">
                        {activeClubOffer.club.name} 스쿼드
                      </div>
                      {filteredPartnerSquad.map((t) => {
                        const p = t.player;
                        const selected = selectedAiPlayerIds.includes(p.id);
                        return (
                          <div
                            key={`lp-${p.id}`}
                            className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 ${
                              selected
                                ? 'border-emerald-400 bg-emerald-500/15'
                                : 'border-slate-800/80 bg-[#101827]'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => handleToggleAiPlayer(p.id)}
                              className="flex flex-1 items-center gap-2 min-w-0 text-left cursor-pointer"
                            >
                              <span className="w-8 shrink-0 text-[10px] font-bold text-slate-400">
                                {p.mainPositions[0] ?? p.position}
                              </span>
                              <CountryFlagSvg
                                code={p.nationalityCode}
                                nationality={p.nationality}
                                size="xs"
                              />
                              <span className="truncate text-xs font-bold text-white">
                                {p.name}
                              </span>
                              <span className="ml-auto font-mono text-xs font-bold text-emerald-300 tabular-nums shrink-0">
                                {p.ovr}
                              </span>
                              <span className="font-mono text-[10px] text-slate-400 tabular-nums shrink-0">
                                가치 {computePlayerTradePoints({ player: p }).effectiveTp}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setInspectedPlayer(p)}
                              aria-label={`${p.name} 상세`}
                              className="shrink-0 rounded-md border border-slate-700 bg-slate-900 p-1 text-slate-400 hover:text-white cursor-pointer"
                            >
                              <Info className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {/* Our List */}
                    <div className="rounded-xl border border-slate-800 bg-[#0b111c] p-2.5 space-y-1.5">
                      <div className="text-xs font-extrabold text-rose-300 px-1">
                        우리 팀 스쿼드
                      </div>
                      {filteredUserEntries.map((entry) => {
                        const p = entry.player;
                        const selected = selectedUserSlots.some(
                          (s) => slotKey(s) === entry.key,
                        );
                        const tp = computePlayerTradePoints({ player: p }).effectiveTp;
                        return (
                          <div
                            key={`lu-${entry.key}`}
                            className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 ${
                              selected
                                ? 'border-rose-400 bg-rose-500/15'
                                : 'border-slate-800/80 bg-[#101827]'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => handleToggleUserSlot(entry.ref)}
                              className="flex flex-1 items-center gap-2 min-w-0 text-left cursor-pointer"
                            >
                              <span className="w-8 shrink-0 text-[10px] font-bold text-slate-400">
                                {entry.slotLabel}
                              </span>
                              <CountryFlagSvg
                                code={p.nationalityCode}
                                nationality={p.nationality}
                                size="xs"
                              />
                              <span className="truncate text-xs font-bold text-white">
                                {p.name}
                              </span>
                              <span className="ml-auto font-mono text-xs font-bold text-amber-300 tabular-nums shrink-0">
                                {p.ovr}
                              </span>
                              <span className="font-mono text-[10px] text-slate-400 tabular-nums shrink-0">
                                가치 {tp}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setInspectedPlayer(p)}
                              aria-label={`${p.name} 상세`}
                              className="shrink-0 rounded-md border border-slate-700 bg-slate-900 p-1 text-slate-400 hover:text-white cursor-pointer"
                            >
                              <Info className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sticky Bottom Bar for Counter-Offer Submission */}
        {activeOffer && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 bg-[#090f19] px-4 py-2.5">
            <button
              type="button"
              onClick={handleExitCounterOffer}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-300 hover:text-white cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              받은 제안으로
            </button>
            <button
              id="mp-submit-counter-btn"
              type="button"
              disabled={!canSubmitCounter}
              onClick={handleSubmitCounter}
              className="inline-flex items-center gap-1.5 rounded-xl bg-sky-400 px-5 py-2 text-xs font-black text-slate-950 hover:bg-sky-300 disabled:opacity-40 cursor-pointer"
            >
              <Send className="h-3.5 w-3.5" />
              역제안 제출
              {tradeEval && !tradeEval.blockedReason && tradeEval.requiredUserReleaseCount === 0
                ? ` (${tradeEval.acceptanceChance}%)`
                : ''}
            </button>
          </div>
        )}
      </div>

      {/* Accidental Close Confirmation Guard — identical to original TransferMarketModal */}
      {confirmCloseOpen && (
        <div className="modal-backdrop fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/85 p-4">
          <div className="modal-panel w-full max-w-sm rounded-2xl border border-slate-800 bg-[#0e1522] p-5 space-y-4 shadow-2xl">
            <div className="space-y-1">
              <h3 className="text-sm font-black text-white">이적시장을 끝내시겠습니까?</h3>
              <p className="text-xs text-slate-400">
                남은 협상 기회 {attemptsLeft}회 · 대기 중인 제안 {pendingCount}건이 있습니다.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmCloseOpen(false)}
                className="rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-bold text-slate-300 hover:text-white cursor-pointer"
              >
                계속 협상
              </button>
              <button
                id="mp-confirm-close-transfer-btn"
                type="button"
                onClick={() => {
                  setConfirmCloseOpen(false);
                  onFinish();
                }}
                className="inline-flex items-center gap-1 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-extrabold text-slate-950 hover:bg-emerald-400 cursor-pointer"
              >
                <Check className="h-3.5 w-3.5" />
                끝내기
              </button>
            </div>
          </div>
        </div>
      )}

      {inspectedPlayer && (
        <PlayerDetailModal
          player={inspectedPlayer}
          onClose={() => setInspectedPlayer(null)}
        />
      )}
    </div>
  );
}
