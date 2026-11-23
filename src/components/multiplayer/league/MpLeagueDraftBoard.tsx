import { Check, FastForward, Loader2, LogOut, Timer, Users } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MANAGER_TRAITS } from '../../../data/managerTraits';
import { calculateChemistry, calculateTeamRatings } from '../../../engine/chemistryEngine';
import { DEFAULT_ROULETTE_LEGEND_RATE } from '../../../engine/draftEngine';
import {
  buildAutoPick,
  chooseSlotForPlayer,
  collectTakenIds,
  draftRoundOf,
  findNextOpenDraftSlot,
  rebuildSquadFromPicks,
  rollCandidates,
  roundSpinnerId,
  snakePickerId,
  spinSharedRoll,
} from '../../../engine/mpLeagueDraft';
import { DEFAULT_MP_LEAGUE_POOL } from '../../../services/multiplayerService';
import { insertLeaguePick } from '../../../services/mpLeagueService';
import type { FormationId, ManagerTraitId } from '../../../types/game';
import type { LeagueId, TacticId } from '../../../types/league';
import type {
  MpDraftRoll,
  MpLeagueLive,
  MpLeaguePickRow,
  MpLeagueSquadPayload,
} from '../../../types/mpLeague';
import type { MpRoomPlayerRow, MpRoomRow } from '../../../types/multiplayer';
import type { Player, SubPosition } from '../../../types/player';
import { PitchBoard } from '../../common/PitchBoard';
import type { SlotRef } from '../../common/PitchBoard';
import { PixelManagerAvatar } from '../../common/PixelManagerAvatar';
import { PlayerDetailModal } from '../../common/PlayerDetailModal';
import { RouletteReelsView } from '../../draft/RouletteReelsView';
import { MpMiniPitch } from './MpMiniPitch';

interface MpLeagueDraftBoardProps {
  room: MpRoomRow;
  players: MpRoomPlayerRow[];
  playerId: string;
  live: MpLeagueLive;
  picks: MpLeaguePickRow[];
  onlinePlayerIds: string[];
  ackKeys: string[];
  onSavePayload: (payload: MpLeagueSquadPayload) => Promise<void>;
  onSetRoll: (roll: MpDraftRoll) => void;
  onAck: (key: string) => void;
  onLeaveRoom: () => void;
}

function buildBoard(
  picks: MpLeaguePickRow[],
  playerId: string,
  overrides: Record<string, SlotRef>,
): { starters: (Player | null)[]; bench: (Player | null)[] } {
  const starters: (Player | null)[] = Array.from({ length: 11 }, () => null);
  const bench: (Player | null)[] = Array.from({ length: 5 }, () => null);
  const mine = picks
    .filter((p) => p.picker_id === playerId)
    .sort((a, b) => a.pick_no - b.pick_no);
  const leftovers: Player[] = [];
  for (const row of mine) {
    const { player, area, index } = row.player_json;
    const slot = overrides[player.id] ?? { area, index };
    const list = slot.area === 'starter' ? starters : bench;
    if (slot.index >= 0 && slot.index < list.length && !list[slot.index]) {
      list[slot.index] = player;
    } else {
      leftovers.push(player);
    }
  }
  for (const player of leftovers) {
    const sIdx = starters.findIndex((x) => !x);
    if (sIdx !== -1) starters[sIdx] = player;
    else {
      const bIdx = bench.findIndex((x) => !x);
      if (bIdx !== -1) bench[bIdx] = player;
    }
  }
  return { starters, bench };
}

/** Own interval so the 4x-per-second countdown never re-renders the pitch or roulette. */
const TurnTimer = memo(function TurnTimer({
  turnKey,
  turnSec,
  onExpire,
}: {
  turnKey: string;
  turnSec: number;
  onExpire: (turnKey: string) => void;
}) {
  const [state, setState] = useState<{ key: string; startedAt: number; now: number }>({
    key: '',
    startedAt: 0,
    now: 0,
  });
  const firedRef = useRef<string | null>(null);

  useEffect(() => {
    const start = Date.now();
    const boot = window.setTimeout(
      () => setState({ key: turnKey, startedAt: start, now: start }),
      0,
    );
    const interval = window.setInterval(() => {
      const now = Date.now();
      setState((prev) => (prev.key === turnKey ? { ...prev, now } : prev));
      if (now - start >= turnSec * 1000 && firedRef.current !== turnKey) {
        firedRef.current = turnKey;
        onExpire(turnKey);
      }
    }, 250);
    return () => {
      window.clearTimeout(boot);
      window.clearInterval(interval);
    };
  }, [turnKey, turnSec, onExpire]);

  const remaining =
    state.key === turnKey
      ? Math.max(0, Math.ceil(turnSec - (state.now - state.startedAt) / 1000))
      : turnSec;
  const tone =
    remaining <= 5 ? 'text-rose-300' : remaining <= 10 ? 'text-amber-300' : 'text-white';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-[#0a0f17] px-2.5 py-1 font-mono text-sm font-black tabular-nums ${tone}`}
    >
      <Timer className="w-3.5 h-3.5" />
      {remaining}s
    </span>
  );
});

export function MpLeagueDraftBoard({
  room,
  players,
  playerId,
  live,
  picks,
  onlinePlayerIds,
  ackKeys,
  onSavePayload,
  onSetRoll,
  onAck,
  onLeaveRoom,
}: MpLeagueDraftBoardProps) {
  const meRow = players.find((p) => p.player_id === playerId) ?? null;
  const myPayload = meRow?.league_payload ?? null;
  const draftPool: LeagueId[] =
    room.settings.draftLeaguePool?.length > 0
      ? room.settings.draftLeaguePool
      : DEFAULT_MP_LEAGUE_POOL;

  const [overrides, setOverrides] = useState<Record<string, SlotRef>>({});
  const [localRoll, setLocalRoll] = useState<MpDraftRoll | null>(null);
  const [previewCandidate, setPreviewCandidate] = useState<Player | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<SlotRef | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [inspected, setInspected] = useState<{
    player: Player;
    slotSubPosition?: SubPosition;
  } | null>(null);
  const finalSavedRef = useRef<string | null>(null);
  const autoActedRef = useRef<string | null>(null);

  const draft = live.draft;
  const order = useMemo(() => draft?.order ?? [], [draft?.order]);
  const generation = draft?.generation ?? 0;
  const pickNo = picks.length;
  const totalPicks = draft?.totalPicks ?? 0;
  const draftFinished = Boolean(draft && pickNo >= totalPicks);
  const round = draftRoundOf(pickNo, order.length);
  const currentPickerId = draft && !draftFinished ? snakePickerId(pickNo, order) : null;
  const spinnerId = draft && !draftFinished ? roundSpinnerId(round, order) : null;
  const isMyTurn = currentPickerId === playerId;
  const iAmSpinner = spinnerId === playerId;

  const formation: FormationId = myPayload?.formation ?? '4-3-3';
  const tactic: TacticId = myPayload?.tactic ?? 'possession';
  const managerTraitId: ManagerTraitId = myPayload?.managerTraitId ?? 'big_game_hunter';

  const board = useMemo(
    () => buildBoard(picks, playerId, overrides),
    [picks, playerId, overrides],
  );
  const takenIds = useMemo(() => collectTakenIds(picks), [picks]);

  // The round's shared roulette lives on the spinner's row (optimistic copy for the spinner)
  const spinnerRow = players.find((p) => p.player_id === spinnerId) ?? null;
  const remoteRoll = spinnerRow?.activity?.roll ?? null;
  const roll: MpDraftRoll | null = [remoteRoll, localRoll].find(
    (r): r is MpDraftRoll =>
      Boolean(r && r.generation === generation && r.round === round),
  ) ?? null;
  const freeCandidates = useMemo(
    () => (roll ? rollCandidates(roll.reels, takenIds) : []),
    [roll, takenIds],
  );
  const visibleReels = useMemo(
    () =>
      roll
        ? roll.reels.map((r) => ({
            ...r,
            candidates: r.candidates.filter((c) => !takenIds.has(c.id)),
          }))
        : [],
    [roll, takenIds],
  );

  const autoKey = `draft-auto:${generation}`;
  const iAgreedAuto = ackKeys.includes(autoKey);
  const allAuto =
    players.length > 0 && players.every((p) => p.activity?.ackKeys?.includes(autoKey));

  const activePreview = isMyTurn && roll ? previewCandidate : null;
  const previewSlot = useMemo(
    () =>
      activePreview
        ? chooseSlotForPlayer(formation, board.starters, board.bench, activePreview)
        : null,
    [activePreview, formation, board],
  );

  const doSpin = useCallback((): MpDraftRoll | null => {
    if (!iAmSpinner || roll) return roll;
    const slot = findNextOpenDraftSlot(formation, board.starters, board.bench);
    const next: MpDraftRoll = {
      generation,
      round,
      subPosition: slot?.subPosition ?? 'CM',
      label: slot?.label ?? '',
      reels: spinSharedRoll({
        formation,
        starters: board.starters,
        bench: board.bench,
        takenIds,
        allowedLeagueIds: draftPool,
        playerCount: order.length,
      }),
    };
    setLocalRoll(next);
    setPreviewCandidate(null);
    onSetRoll(next);
    return next;
  }, [iAmSpinner, roll, formation, board, generation, round, takenIds, draftPool, order.length, onSetRoll]);

  const submitPick = useCallback(
    async (player: Player, auto: boolean) => {
      if (!draft || submitting) return;
      const slot = chooseSlotForPlayer(formation, board.starters, board.bench, player);
      if (!slot) return;
      setSubmitting(true);
      await insertLeaguePick({
        roomId: room.id,
        draftGeneration: generation,
        pickNo,
        pickerId: playerId,
        pick: { player, area: slot.area, index: slot.index, auto },
      });
      setPreviewCandidate(null);
      setSubmitting(false);
    },
    [draft, submitting, formation, board, room.id, generation, pickNo, playerId],
  );

  const autoAct = useCallback(() => {
    if (!isMyTurn || submitting) return;
    const usedRoll = roll ?? doSpin();
    const pick = buildAutoPick({
      formation,
      starters: board.starters,
      bench: board.bench,
      takenIds,
      allowedLeagueIds: draftPool,
      shownCandidates: usedRoll ? rollCandidates(usedRoll.reels, takenIds) : [],
    });
    if (pick) void submitPick(pick.player, true);
  }, [isMyTurn, submitting, roll, doSpin, formation, board, takenIds, draftPool, submitPick]);

  const handleExpire = useCallback(
    (turnKey: string) => {
      if (turnKey === `${generation}:${pickNo}`) autoAct();
    },
    [generation, pickNo, autoAct],
  );

  // Everyone agreed to auto-draft: my turns resolve by themselves
  useEffect(() => {
    if (!allAuto || !isMyTurn || draftFinished) return;
    const key = `${generation}:${pickNo}`;
    if (autoActedRef.current === key) return;
    const t = window.setTimeout(() => {
      autoActedRef.current = key;
      autoAct();
    }, 350);
    return () => window.clearTimeout(t);
  }, [allAuto, isMyTurn, draftFinished, generation, pickNo, autoAct]);

  // Upload my final 11 + 5 once every pick is in
  useEffect(() => {
    if (!draftFinished || !draft || !myPayload) return;
    const cleanStarters = board.starters.filter((p): p is Player => p !== null);
    const cleanBench = board.bench.filter((p): p is Player => p !== null);
    if (cleanStarters.length !== 11 || cleanBench.length !== 5) return;
    const key = `${generation}:${cleanStarters.map((p) => p.id).join(',')}`;
    if (finalSavedRef.current === key) return;
    finalSavedRef.current = key;
    void onSavePayload({
      managerTraitId,
      formation,
      tactic,
      starters: cleanStarters,
      bench: cleanBench,
      setupReady: true,
      rev: (myPayload.rev ?? 0) + 1,
      by: 'player',
    });
  }, [draftFinished, draft, myPayload, board, generation, managerTraitId, formation, tactic, onSavePayload]);

  const previewStarters = useMemo(() => {
    if (!activePreview || !previewSlot || previewSlot.area !== 'starter') return board.starters;
    const copy = [...board.starters];
    copy[previewSlot.index] = activePreview;
    return copy;
  }, [activePreview, previewSlot, board.starters]);
  const previewBench = useMemo(() => {
    if (!activePreview || !previewSlot || previewSlot.area !== 'bench') return board.bench;
    const copy = [...board.bench];
    copy[previewSlot.index] = activePreview;
    return copy;
  }, [activePreview, previewSlot, board.bench]);

  const baseChemistry = useMemo(
    () => calculateChemistry(formation, board.starters, tactic, managerTraitId),
    [formation, board.starters, tactic, managerTraitId],
  );
  const displayChemistry = useMemo(
    () => calculateChemistry(formation, previewStarters, tactic, managerTraitId),
    [formation, previewStarters, tactic, managerTraitId],
  );
  const ratings = useMemo(
    () =>
      calculateTeamRatings(
        formation,
        previewStarters.filter((p): p is Player => p !== null),
        displayChemistry.total,
        managerTraitId,
        displayChemistry.slotSynergies,
      ),
    [formation, previewStarters, displayChemistry, managerTraitId],
  );
  const previewSlotSynergy =
    activePreview && previewSlot?.area === 'starter'
      ? displayChemistry.slotSynergies[previewSlot.index] ?? null
      : null;
  const previewChemDelta =
    activePreview && previewSlot?.area === 'starter'
      ? displayChemistry.total - baseChemistry.total
      : 0;

  const handleSwap = (from: SlotRef, to: SlotRef) => {
    if (from.area === to.area && from.index === to.index) return;
    const at = (slot: SlotRef) =>
      slot.area === 'starter' ? board.starters[slot.index] : board.bench[slot.index];
    const pA = at(from);
    const pB = at(to);
    setOverrides((prev) => {
      const next = { ...prev };
      if (pA) next[pA.id] = to;
      if (pB) next[pB.id] = from;
      return next;
    });
  };

  const handleSlotClick = (area: 'starter' | 'bench', index: number) => {
    const clicked = area === 'starter' ? board.starters[index] : board.bench[index];
    if (!selectedSlot) {
      if (clicked) setSelectedSlot({ area, index });
      return;
    }
    if (selectedSlot.area === area && selectedSlot.index === index) {
      setSelectedSlot(null);
      return;
    }
    handleSwap(selectedSlot, { area, index });
    setSelectedSlot(null);
  };

  const orderedPlayers = useMemo(() => {
    const byId = new Map(players.map((p) => [p.player_id, p]));
    return order
      .map((id) => byId.get(id))
      .filter((p): p is MpRoomPlayerRow => Boolean(p));
  }, [order, players]);

  const boards = useMemo(() => {
    const map: Record<string, { starters: (Player | null)[]; bench: (Player | null)[] }> = {};
    for (const p of orderedPlayers) {
      map[p.player_id] =
        p.player_id === playerId ? board : rebuildSquadFromPicks(picks, p.player_id);
    }
    return map;
  }, [orderedPlayers, playerId, board, picks]);

  const lastPick = picks.length > 0 ? picks[picks.length - 1] : null;
  const currentPicker = players.find((p) => p.player_id === currentPickerId) ?? null;
  const pickedByName = (id: string) => {
    const row = picks.find((x) => x.player_ref === id);
    return players.find((p) => p.player_id === row?.picker_id)?.nickname ?? null;
  };

  return (
    <div className="mx-auto max-w-6xl px-2.5 py-3 sm:px-4 sm:py-5 space-y-3">
      <div className="rounded-xl border border-slate-800/90 bg-[#0d131c] px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-md border border-sky-400/40 bg-sky-500/10 px-2 py-0.5 text-[11px] font-extrabold text-sky-300">
            <Users className="w-3 h-3" />
            공개 스네이크 드래프트
          </span>
          <span className="font-mono text-xs font-bold text-slate-400">#{room.code}</span>
          <span className="text-xs font-bold text-white tabular-nums">
            {Math.min(round + 1, 16)}/16R · {Math.min(pickNo, totalPicks)}/{totalPicks}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {!draftFinished && (
            <button
              id="mpl-auto-draft-btn"
              type="button"
              disabled={iAgreedAuto}
              onClick={() => onAck(autoKey)}
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-bold ${
                iAgreedAuto
                  ? 'border-emerald-500/40 bg-emerald-500/12 text-emerald-300'
                  : 'border-slate-700 bg-[#111822] text-slate-300 hover:border-emerald-400/50 cursor-pointer'
              }`}
            >
              <FastForward className="w-3 h-3" />
              자동 드래프트{' '}
              {players.filter((p) => p.activity?.ackKeys?.includes(autoKey)).length}/
              {players.length}
            </button>
          )}
          <button
            type="button"
            onClick={onLeaveRoom}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-[#111822] px-2.5 py-1 text-[11px] font-bold text-slate-400 hover:text-rose-300 cursor-pointer"
          >
            <LogOut className="w-3 h-3" />
            나가기
          </button>
        </div>
      </div>

      {/* Everyone's board at a glance */}
      <div
        className={`grid gap-2 ${
          orderedPlayers.length >= 4
            ? 'grid-cols-2 lg:grid-cols-4'
            : orderedPlayers.length === 3
              ? 'grid-cols-3'
              : 'grid-cols-2'
        }`}
      >
        {orderedPlayers.map((p) => {
          const b = boards[p.player_id];
          const count = picks.filter((x) => x.picker_id === p.player_id).length;
          const onClock = p.player_id === currentPickerId;
          const online = onlinePlayerIds.includes(p.player_id);
          return (
            <div
              key={p.player_id}
              className={`rounded-xl border p-1.5 space-y-1 ${
                onClock
                  ? 'border-emerald-400/55 bg-emerald-500/10'
                  : 'border-slate-800 bg-[#0d131c]'
              }`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <PixelManagerAvatar
                  avatar={p.avatar_json}
                  clubPrimaryColor={p.club_profile.primaryColor}
                  clubSecondaryColor={p.club_profile.secondaryColor}
                  size={20}
                />
                <span className="truncate text-[11px] font-extrabold text-slate-100">
                  {p.nickname}
                  {p.player_id === playerId && <span className="ml-1 text-emerald-300">나</span>}
                </span>
                <span className="ml-auto shrink-0 text-[10px] font-bold text-slate-400 tabular-nums">
                  {count}/16{!online && ' · 오프'}
                </span>
              </div>
              <MpMiniPitch
                formation={p.league_payload?.formation ?? '4-3-3'}
                starters={b?.starters ?? []}
                bench={b?.bench ?? []}
                highlightId={
                  lastPick?.picker_id === p.player_id ? lastPick.player_ref : null
                }
                height={112}
              />
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-slate-800/90 bg-[#0d131c] px-3 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-bold text-slate-300">
          {draftFinished ? (
            <span className="inline-flex items-center gap-1.5 text-emerald-300">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              시즌 준비 중
            </span>
          ) : (
            <>
              <span className={isMyTurn ? 'text-emerald-300' : 'text-white'}>
                {isMyTurn ? '내 차례' : `${currentPicker?.nickname ?? '상대'} 차례`}
              </span>
              {roll && <span className="ml-1.5 text-slate-400">· {roll.label} 룰렛</span>}
              {allAuto && <span className="ml-1.5 text-emerald-300">· 자동 진행</span>}
            </>
          )}
        </div>
        {!draftFinished && draft && (
          <TurnTimer
            turnKey={`${generation}:${pickNo}`}
            turnSec={draft.turnSec}
            onExpire={handleExpire}
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12 items-start">
        <div className="lg:col-span-7 space-y-3">
          {isMyTurn && (roll || iAmSpinner) ? (
            <div className="rounded-2xl border border-emerald-500/30 bg-[#0d131c] p-3 space-y-2.5">
              <div className="flex items-center gap-2 text-xs">
                <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 font-extrabold text-emerald-300">
                  {round + 1}라운드
                </span>
                <span className="text-[11px] text-slate-400">
                  ({MANAGER_TRAITS[managerTraitId]?.name})
                </span>
              </div>
              <RouletteReelsView
                key={`${generation}:${round}`}
                hasSpun={Boolean(roll)}
                reels={visibleReels}
                legendRatePercent={Number((DEFAULT_ROULETTE_LEGEND_RATE * 100).toFixed(1))}
                targetSubPosition={previewSlot?.subPosition ?? roll?.subPosition ?? 'CM'}
                managerTraitId={managerTraitId}
                allowedLeagueIds={draftPool}
                previewCandidate={activePreview}
                onSelectPreviewCandidate={setPreviewCandidate}
                previewSlotSynergy={previewSlotSynergy}
                previewChemDelta={previewChemDelta}
                onSpin={() => {
                  doSpin();
                }}
                onPickPlayer={(player) => void submitPick(player, false)}
                pickActionLabel={previewSlot?.label ?? ''}
              />
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800/90 bg-[#0d131c] p-3 space-y-2">
              <div className="text-[11px] font-bold text-slate-400">
                {roll ? `${round + 1}라운드 후보 · ${roll.label}` : '룰렛 대기'}
              </div>
              {roll ? (
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                  {roll.reels.map((reel) => (
                    <div
                      key={reel.reelIndex}
                      className="rounded-xl border border-slate-800 bg-[#0b1018] p-2 space-y-1"
                    >
                      <div className="truncate text-[11px] font-extrabold text-slate-200">
                        {reel.isLegendSlot ? 'LEGEND' : reel.club?.name ?? '-'}
                      </div>
                      {reel.candidates.map((c) => {
                        const by = pickedByName(c.id);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setInspected({ player: c })}
                            className={`flex w-full items-center justify-between gap-1.5 rounded-md px-1.5 py-0.5 text-left cursor-pointer hover:bg-slate-800/60 ${
                              by ? 'opacity-45' : ''
                            }`}
                          >
                            <span className="truncate text-[11px] text-slate-300">
                              <span className="mr-1 font-mono text-[10px] text-slate-500">
                                {c.mainPositions?.[0] ?? c.position}
                              </span>
                              {c.name}
                              {by && <span className="ml-1 text-[10px] text-slate-500">{by}</span>}
                            </span>
                            <span className="font-mono text-[11px] font-bold text-slate-200 tabular-nums">
                              {c.ovr}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 py-3 text-xs font-bold text-slate-500">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {spinnerRow?.nickname ?? '첫 순번'} 룰렛 대기
                </div>
              )}
              {roll && !draftFinished && (
                <div className="text-[10px] font-bold text-slate-500 tabular-nums">
                  남은 후보 {freeCandidates.length}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="lg:col-span-5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800/80 bg-[#0d131c] px-3 py-1.5 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-white">{formation}</span>
              <span className="text-slate-600">·</span>
              <span className="font-bold text-emerald-300 tabular-nums">
                케미 {displayChemistry.total}
              </span>
              <span className="text-slate-600">·</span>
              <span className="font-bold text-slate-200 tabular-nums">
                OVR {Math.round(ratings.ovr || 0)}
              </span>
            </div>
            {selectedSlot ? (
              <button
                type="button"
                onClick={() => setSelectedSlot(null)}
                className="text-[11px] font-bold text-amber-300 hover:underline cursor-pointer"
              >
                스왑 취소
              </button>
            ) : (
              draftFinished && <Check className="w-3.5 h-3.5 text-emerald-400" />
            )}
          </div>
          <PitchBoard
            formation={formation}
            starters={previewStarters}
            bench={previewBench}
            chemistry={displayChemistry}
            managerTraitId={managerTraitId}
            conditionByPlayerId={{}}
            activeSlot={
              previewSlot ? { area: previewSlot.area, index: previewSlot.index } : null
            }
            selectedSlot={selectedSlot}
            onSlotClick={handleSlotClick}
            onSlotSwap={handleSwap}
            onInspectPlayer={(player, slotSubPosition) =>
              setInspected({ player, slotSubPosition })
            }
            showBench
            compact
          />
        </div>
      </div>

      {inspected && (
        <PlayerDetailModal
          player={inspected.player}
          slotSubPosition={inspected.slotSubPosition}
          onClose={() => setInspected(null)}
        />
      )}
    </div>
  );
}
