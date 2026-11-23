import {
  Check,
  FastForward,
  Loader2,
  LogOut,
  Maximize2,
  Timer,
  Users,
  X,
} from 'lucide-react';
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
import { ScaledPitchFrame } from '../../common/ScaledPitchFrame';
import { RouletteReelsView } from '../../draft/RouletteReelsView';

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
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);
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

  const nicknameByPlayerId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of players) map[p.player_id] = p.nickname;
    return map;
  }, [players]);

  const takenByPlayerId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const row of picks) {
      map[row.player_ref] = nicknameByPlayerId[row.picker_id] ?? '선택됨';
    }
    return map;
  }, [picks, nicknameByPlayerId]);

  // The round's shared roulette lives on the spinner's row (optimistic copy for the spinner)
  const spinnerRow = players.find((p) => p.player_id === spinnerId) ?? null;
  const remoteRoll = spinnerRow?.activity?.roll ?? null;
  const roll: MpDraftRoll | null =
    [remoteRoll, localRoll].find(
      (r): r is MpDraftRoll =>
        Boolean(r && r.generation === generation && r.round === round),
    ) ?? null;

  const autoKey = `draft-auto:${generation}`;
  const iAgreedAuto = ackKeys.includes(autoKey);
  const allAuto =
    players.length > 0 && players.every((p) => p.activity?.ackKeys?.includes(autoKey));

  // Allow planning/previewing on my pitch even during opponents' turns; automatically clear if taken
  const activePreview =
    roll && previewCandidate && !takenIds.has(previewCandidate.id)
      ? previewCandidate
      : null;
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
  }, [
    iAmSpinner,
    roll,
    formation,
    board,
    generation,
    round,
    takenIds,
    draftPool,
    order.length,
    onSetRoll,
  ]);

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
  }, [
    draftFinished,
    draft,
    myPayload,
    board,
    generation,
    managerTraitId,
    formation,
    tactic,
    onSavePayload,
  ]);

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

  const participantViews = useMemo(() => {
    return orderedPlayers.map((p) => {
      const isMe = p.player_id === playerId;
      const pFormation: FormationId = p.league_payload?.formation ?? '4-3-3';
      const pTactic: TacticId = p.league_payload?.tactic ?? 'possession';
      const pTrait: ManagerTraitId = p.league_payload?.managerTraitId ?? 'big_game_hunter';
      const squad = isMe
        ? { starters: previewStarters, bench: previewBench }
        : rebuildSquadFromPicks(picks, p.player_id);
      const chemistry = isMe
        ? displayChemistry
        : calculateChemistry(pFormation, squad.starters, pTactic, pTrait);
      const ratings = calculateTeamRatings(
        pFormation,
        squad.starters.filter((x): x is Player => x !== null),
        chemistry.total,
        pTrait,
        chemistry.slotSynergies,
      );
      const pickCount = picks.filter((x) => x.picker_id === p.player_id).length;
      return {
        row: p,
        isMe,
        formation: pFormation,
        tactic: pTactic,
        traitId: pTrait,
        starters: squad.starters,
        bench: squad.bench,
        chemistry,
        ratings,
        pickCount,
      };
    });
  }, [orderedPlayers, playerId, previewStarters, previewBench, picks, displayChemistry]);

  const currentPicker = players.find((p) => p.player_id === currentPickerId) ?? null;
  const waitingLabel = draftFinished
    ? '드래프트 완료'
    : !roll
      ? `${spinnerRow?.nickname ?? '첫 순번'} 룰렛 대기 중`
      : `${currentPicker?.nickname ?? '상대'} 지명 중`;

  const playerCount = participantViews.length;
  const gridContainerCls =
    playerCount === 2
      ? 'mx-auto grid max-w-4xl grid-cols-2 gap-2 sm:gap-3'
      : playerCount === 3
        ? 'grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3'
        : 'grid grid-cols-2 gap-2 xl:grid-cols-4 sm:gap-2.5';

  const expandedView = expandedPlayerId
    ? participantViews.find((v) => v.row.player_id === expandedPlayerId) ?? null
    : null;

  return (
    <div className="mx-auto max-w-7xl px-2.5 py-3 sm:px-4 sm:py-4 space-y-3">
      {/* Top Bar */}
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
          <span className="hidden sm:inline text-[11px] text-slate-400">
            ({MANAGER_TRAITS[managerTraitId]?.name})
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {!draftFinished && draft && (
            <div className="flex items-center gap-1.5">
              <span
                className={`rounded-md border px-2 py-1 text-[11px] font-extrabold ${
                  isMyTurn
                    ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-300'
                    : 'border-slate-700 bg-[#111822] text-slate-300'
                }`}
              >
                {isMyTurn ? '내 차례' : `${currentPicker?.nickname ?? '상대'} 차례`}
              </span>
              <TurnTimer
                turnKey={`${generation}:${pickNo}`}
                turnSec={draft.turnSec}
                onExpire={handleExpire}
              />
            </div>
          )}
          {draftFinished && (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-300">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              시즌 준비 중
            </span>
          )}
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

      {/* Uniform Original Formation Pitch Grid for ALL Participants (2 / 3 / 4 equal-size cards) */}
      <div className="space-y-2">
        <div className={gridContainerCls}>
          {participantViews.map((pv, idx) => {
            const onClock = pv.row.player_id === currentPickerId;
            const online = onlinePlayerIds.includes(pv.row.player_id);
            const isThirdOnMobile = playerCount === 3 && idx === 2;

            const card = (
              <div
                className={`rounded-xl border p-2 space-y-1.5 transition-colors ${
                  onClock && pv.isMe
                    ? 'border-emerald-400/75 bg-[#0e1a1b] ring-1 ring-emerald-400/40'
                    : onClock
                      ? 'border-amber-400/70 bg-[#17140d] ring-1 ring-amber-400/35'
                      : pv.isMe
                        ? 'border-emerald-500/45 bg-[#0e1620]'
                        : 'border-slate-800/90 bg-[#0d131c]'
                }`}
              >
                {/* Participant Header */}
                <div className="flex items-center justify-between gap-1.5 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <PixelManagerAvatar
                      avatar={pv.row.avatar_json}
                      clubPrimaryColor={pv.row.club_profile.primaryColor}
                      clubSecondaryColor={pv.row.club_profile.secondaryColor}
                      size={22}
                    />
                    <span className="truncate text-[11px] font-extrabold text-slate-100">
                      {pv.row.nickname}
                    </span>
                    {pv.isMe && (
                      <span className="shrink-0 rounded bg-emerald-400 px-1 py-0.5 text-[8px] font-black leading-none text-slate-950">
                        MY
                      </span>
                    )}
                    {onClock && (
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full animate-pulse ${
                          pv.isMe ? 'bg-emerald-400' : 'bg-amber-400'
                        }`}
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0 tabular-nums">
                    <span className="text-[10px] font-bold text-slate-400">
                      {pv.pickCount}/16
                      {!online && ' · 오프'}
                    </span>
                    {pv.isMe && selectedSlot && (
                      <button
                        type="button"
                        onClick={() => setSelectedSlot(null)}
                        className="rounded border border-amber-400/40 bg-amber-500/15 px-1 py-0.5 text-[9px] font-bold text-amber-200 cursor-pointer"
                      >
                        취소
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setExpandedPlayerId(pv.row.player_id)}
                      aria-label={`${pv.row.nickname} 피치 크게 보기`}
                      title="크게 보기"
                      className="rounded border border-slate-800 bg-[#111822] p-0.5 text-slate-400 hover:border-slate-600 hover:text-white cursor-pointer"
                    >
                      <Maximize2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Original PitchBoard scaled proportionally to exact cell width (zero zoom, zero distortion) */}
                <ScaledPitchFrame baseWidth={376}>
                  <PitchBoard
                    formation={pv.formation}
                    starters={pv.starters}
                    bench={pv.bench}
                    chemistry={pv.chemistry}
                    managerTraitId={pv.traitId}
                    conditionByPlayerId={{}}
                    activeSlot={
                      pv.isMe && previewSlot
                        ? { area: previewSlot.area, index: previewSlot.index }
                        : null
                    }
                    previewSlot={
                      pv.isMe && previewSlot
                        ? { area: previewSlot.area, index: previewSlot.index }
                        : null
                    }
                    selectedSlot={pv.isMe ? selectedSlot : null}
                    onSlotClick={
                      pv.isMe
                        ? handleSlotClick
                        : (area, slotIdx) => {
                            const target =
                              area === 'starter'
                                ? pv.starters[slotIdx]
                                : pv.bench[slotIdx];
                            if (target) setInspected({ player: target });
                          }
                    }
                    onSlotSwap={pv.isMe ? handleSwap : undefined}
                    onInspectPlayer={(player, slotSubPosition) =>
                      setInspected({ player, slotSubPosition })
                    }
                    headerRight={
                      <span className="font-mono text-[10px] font-bold text-slate-300 tabular-nums">
                        OVR {Math.round(pv.ratings.ovr || 0)}
                      </span>
                    }
                    showBench
                    showChemBreakdown={false}
                    showChemLegend={false}
                    compact
                  />
                </ScaledPitchFrame>
              </div>
            );

            if (isThirdOnMobile) {
              return (
                <div
                  key={pv.row.player_id}
                  className="col-span-2 flex justify-center sm:col-span-1 sm:block"
                >
                  <div className="w-[calc(50%-0.25rem)] sm:w-full">{card}</div>
                </div>
              );
            }
            return <div key={pv.row.player_id}>{card}</div>;
          })}
        </div>

        {/* Single Shared 4-Color Synergy Legend */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800/80 bg-[#0d131c] px-3 py-1.5 text-[10px] text-slate-400">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-3.5 rounded-full bg-emerald-500" />
              구단·전소속
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-3.5 rounded-full bg-sky-400" />
              국적
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-3.5 rounded-full bg-amber-500" />
              스타일
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-3.5 rounded-full bg-purple-400" />
              엘리트 88+
            </span>
          </div>
          {allAuto && !draftFinished ? (
            <span className="font-bold text-emerald-300">자동 드래프트 진행 중</span>
          ) : draftFinished ? (
            <span className="inline-flex items-center gap-1 font-bold text-emerald-300">
              <Check className="w-3 h-3" />
              16인 구성 완료
            </span>
          ) : null}
        </div>
      </div>

      {/* Full-Size Draft Candidate Pool — ALWAYS kept at original size & layout on every turn */}
      <div
        className={`rounded-2xl border bg-[#0d131c] p-3 space-y-2.5 ${
          isMyTurn ? 'border-emerald-500/40' : 'border-slate-800/90'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span
              className={`rounded-md px-2 py-0.5 font-extrabold ${
                isMyTurn
                  ? 'bg-emerald-500/15 text-emerald-300'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {Math.min(round + 1, 16)}라운드
            </span>
            {roll?.label && (
              <span className="font-bold text-slate-300">{roll.label} 룰렛</span>
            )}
          </div>
          {!isMyTurn && !draftFinished && (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-400/35 bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-200">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
              {waitingLabel}
            </span>
          )}
        </div>

        <RouletteReelsView
          key={`${generation}:${round}`}
          hasSpun={Boolean(roll)}
          reels={roll?.reels ?? []}
          legendRatePercent={Number((DEFAULT_ROULETTE_LEGEND_RATE * 100).toFixed(1))}
          targetSubPosition={previewSlot?.subPosition ?? roll?.subPosition ?? 'CM'}
          managerTraitId={managerTraitId}
          allowedLeagueIds={draftPool}
          previewCandidate={activePreview}
          onSelectPreviewCandidate={setPreviewCandidate}
          previewSlotSynergy={previewSlotSynergy}
          previewChemDelta={previewChemDelta}
          canPick={isMyTurn && !draftFinished && !submitting}
          canSpin={isMyTurn && iAmSpinner && !draftFinished}
          waitingStatusLabel={waitingLabel}
          takenByPlayerId={takenByPlayerId}
          onSpin={() => {
            doSpin();
          }}
          onPickPlayer={(player) => void submitPick(player, false)}
          pickActionLabel={previewSlot?.label ?? ''}
        />
      </div>

      {/* Optional Full-Size Pitch Expand Modal (useful on small mobile screens) */}
      {expandedView && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/85 p-3 sm:p-5"
          onClick={() => setExpandedPlayerId(null)}
        >
          <div
            className="w-full max-w-lg max-h-[92dvh] overflow-y-auto rounded-2xl border border-slate-800 bg-[#0d131c] p-3.5 sm:p-4 space-y-2.5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <PixelManagerAvatar
                  avatar={expandedView.row.avatar_json}
                  clubPrimaryColor={expandedView.row.club_profile.primaryColor}
                  clubSecondaryColor={expandedView.row.club_profile.secondaryColor}
                  size={28}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-sm font-extrabold text-white">
                    <span className="truncate">{expandedView.row.nickname}</span>
                    {expandedView.isMe && (
                      <span className="rounded bg-emerald-400 px-1 py-0.5 text-[8px] font-black text-slate-950">
                        MY
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] font-bold text-slate-400 tabular-nums">
                    A {expandedView.ratings.effectiveAtt} / M{' '}
                    {expandedView.ratings.effectiveMid} / D{' '}
                    {expandedView.ratings.effectiveDef} · {expandedView.pickCount}/16
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setExpandedPlayerId(null)}
                aria-label="닫기"
                className="rounded-lg border border-slate-800 bg-[#111822] p-1.5 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <PitchBoard
              formation={expandedView.formation}
              starters={expandedView.starters}
              bench={expandedView.bench}
              chemistry={expandedView.chemistry}
              managerTraitId={expandedView.traitId}
              conditionByPlayerId={{}}
              selectedSlot={expandedView.isMe ? selectedSlot : null}
              onSlotClick={
                expandedView.isMe
                  ? handleSlotClick
                  : (area, slotIdx) => {
                      const target =
                        area === 'starter'
                          ? expandedView.starters[slotIdx]
                          : expandedView.bench[slotIdx];
                      if (target) setInspected({ player: target });
                    }
              }
              onSlotSwap={expandedView.isMe ? handleSwap : undefined}
              onInspectPlayer={(player, slotSubPosition) =>
                setInspected({ player, slotSubPosition })
              }
              showBench
              showChemBreakdown
              compact
            />
          </div>
        </div>
      )}

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
