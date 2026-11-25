import {
  Bell,
  Check,
  FastForward,
  Loader2,
  LogOut,
  Timer,
  Users,
  Volume2,
  VolumeX,
  Zap,
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
  resolveMpRouletteTargetDisplay,
  rollCandidates,
  roundOrderIds,
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
import { ManagerFitBadge } from '../../common/ManagerFitBadge';
import { DraftBudgetBar } from '../../common/DraftBudgetBar';
import { PitchBoard } from '../../common/PitchBoard';
import type { SlotRef } from '../../common/PitchBoard';
import { PixelManagerAvatar } from '../../common/PixelManagerAvatar';
import { PlayerDetailModal } from '../../common/PlayerDetailModal';
import { RouletteReelsView } from '../../draft/RouletteReelsView';

const TURN_SOUND_STORAGE_KEY = 'rtt_mp_draft_turn_sound_v1';

function readTurnSoundPref(): boolean {
  try {
    return window.localStorage.getItem(TURN_SOUND_STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

/** Plays a very gentle, non-intrusive 2-note Web Audio chime when the player's turn arrives. */
function playSoftTurnChime(): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const notes = [523.25, 659.25];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.09);
      gain.gain.setValueAtTime(0.0001, now + i * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.055, now + i * 0.09 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.09 + 0.17);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.09);
      osc.stop(now + i * 0.09 + 0.18);
    });
    window.setTimeout(() => {
      void ctx.close().catch(() => {});
    }, 450);
  } catch {
    // Ignore autoplay/browser audio restrictions silently
  }
}

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
      className={`inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-[#0a0f17] px-2 py-0.5 font-mono text-xs font-black tabular-nums ${tone}`}
    >
      <Timer className="w-3 h-3" />
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
  const [activeTabPlayerId, setActiveTabPlayerId] = useState<string>(playerId);
  const [turnSoundOn, setTurnSoundOn] = useState<boolean>(readTurnSoundPref);
  const [turnToast, setTurnToast] = useState<string | null>(null);
  const [turnPulse, setTurnPulse] = useState(false);
  const [inspected, setInspected] = useState<{
    player: Player;
    slotSubPosition?: SubPosition;
  } | null>(null);
  const finalSavedRef = useRef<string | null>(null);
  const autoActedRef = useRef<string | null>(null);
  const prevTurnCueRef = useRef<string | null>(null);

  const draft = live.draft;
  const order = useMemo(() => draft?.order ?? [], [draft?.order]);
  const generation = draft?.generation ?? 0;
  const pickNo = picks.length;
  const totalPicks = draft?.totalPicks ?? 0;
  const draftFinished = Boolean(draft && pickNo >= totalPicks);
  const round = draftRoundOf(pickNo, order.length);
  const currentPickerId = draft && !draftFinished ? snakePickerId(pickNo, order) : null;
  const spinnerId = draft && !draftFinished ? roundSpinnerId(round, order) : null;
  const nextRoundSpinnerId =
    draft && !draftFinished && round + 1 < 16 ? roundSpinnerId(round + 1, order) : null;
  const currentRoundOrder = useMemo(
    () => (draft && !draftFinished ? roundOrderIds(round, order) : []),
    [draft, draftFinished, round, order],
  );
  const isMyTurn = currentPickerId === playerId;
  const iAmSpinner = spinnerId === playerId;
  const rouletteClubCount = order.length >= 3 ? 4 : 3;

  const toggleTurnSound = useCallback(() => {
    setTurnSoundOn((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(TURN_SOUND_STORAGE_KEY, next ? 'on' : 'off');
      } catch {
        // Ignore storage write errors
      }
      return next;
    });
  }, []);

  // Subtle non-blocking turn cue (tab focus + brief top pill + border pulse + optional soft chime)
  const myTurnCueId = isMyTurn && !draftFinished ? `${generation}:${pickNo}` : null;
  useEffect(() => {
    if (!myTurnCueId) {
      prevTurnCueRef.current = null;
      return;
    }
    if (prevTurnCueRef.current === myTurnCueId) return;
    prevTurnCueRef.current = myTurnCueId;

    const msg =
      iAmSpinner && pickNo % Math.max(1, order.length) === 0
        ? '내 차례 · 룰렛을 돌려주세요'
        : '내 차례 · 선수를 지명하세요';

    const tStart = window.setTimeout(() => {
      setActiveTabPlayerId(playerId);
      setTurnToast(msg);
      setTurnPulse(true);
    }, 0);
    if (turnSoundOn) {
      playSoftTurnChime();
    }
    try {
      navigator.vibrate?.(40);
    } catch {
      // Ignore vibration API errors
    }
    const tPulse = window.setTimeout(() => setTurnPulse(false), 2200);
    const tToast = window.setTimeout(() => setTurnToast(null), 2600);
    return () => {
      window.clearTimeout(tStart);
      window.clearTimeout(tPulse);
      window.clearTimeout(tToast);
    };
  }, [myTurnCueId, iAmSpinner, pickNo, order.length, playerId, turnSoundOn]);

  // Subtle browser tab title cue while waiting in another tab
  useEffect(() => {
    if (!isMyTurn || draftFinished) return;
    const originalTitle = document.title;
    if (!originalTitle.startsWith('[내 차례]')) {
      document.title = `[내 차례] ${originalTitle}`;
    }
    return () => {
      document.title = originalTitle;
    };
  }, [isMyTurn, draftFinished]);

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

  const myNextOpenSlot = useMemo(
    () => findNextOpenDraftSlot(formation, board.starters, board.bench),
    [formation, board],
  );
  const spinnerNextOpenSlot = useMemo(() => {
    if (!spinnerRow || spinnerRow.player_id === playerId) return myNextOpenSlot;
    const spFormation: FormationId = spinnerRow.league_payload?.formation ?? '4-3-3';
    const spBoard = rebuildSquadFromPicks(picks, spinnerRow.player_id);
    return findNextOpenDraftSlot(spFormation, spBoard.starters, spBoard.bench);
  }, [spinnerRow, playerId, myNextOpenSlot, picks]);
  const rouletteTargetDisplay = useMemo(
    () =>
      resolveMpRouletteTargetDisplay({
        previewSlot,
        roll,
        myNextOpenSlot,
        spinnerNextOpenSlot,
        iAmSpinner,
      }),
    [previewSlot, roll, myNextOpenSlot, spinnerNextOpenSlot, iAmSpinner],
  );

  const handleSelectPreview = useCallback(
    (candidate: Player | null) => {
      setPreviewCandidate(candidate);
      if (candidate) {
        setActiveTabPlayerId(playerId);
      }
    },
    [playerId],
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

  // Order tabs with "내 팀" first, followed by other participants in draft order
  const orderedPlayers = useMemo(() => {
    const byId = new Map(players.map((p) => [p.player_id, p]));
    const inOrder = order
      .map((id) => byId.get(id))
      .filter((p): p is MpRoomPlayerRow => Boolean(p));
    const mine = inOrder.find((p) => p.player_id === playerId);
    const others = inOrder.filter((p) => p.player_id !== playerId);
    return mine ? [mine, ...others] : inOrder;
  }, [order, players, playerId]);

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
        pTactic,
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

  const activeView =
    participantViews.find((v) => v.row.player_id === activeTabPlayerId) ??
    participantViews[0] ??
    null;

  const currentPicker = players.find((p) => p.player_id === currentPickerId) ?? null;
  const waitingLabel = draftFinished
    ? '드래프트 완료'
    : !roll
      ? `${spinnerRow?.nickname ?? '첫 순번'} 룰렛 대기 중`
      : `${currentPicker?.nickname ?? '상대'} 지명 중`;

  return (
    <div className="mx-auto max-w-6xl px-2.5 py-2 sm:px-4 sm:py-3 space-y-2.5">
      {/* Non-blocking subtle turn cue pill (never intercepts clicks or covers controls) */}
      {turnToast && isMyTurn && !draftFinished && (
        <div
          aria-live="polite"
          className="pointer-events-none fixed top-3 left-1/2 z-40 -translate-x-1/2 animate-fade-in"
        >
          <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/55 bg-[#0a1612]/95 px-3.5 py-1.5 text-xs font-extrabold text-emerald-200 shadow-lg backdrop-blur-sm">
            <Bell className="w-3.5 h-3.5 text-emerald-300" />
            <span>{turnToast}</span>
          </div>
        </div>
      )}

      {/* Compact Top Bar */}
      <div className="rounded-xl border border-slate-800/90 bg-[#0d131c] px-3 py-2 space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="inline-flex items-center gap-1 rounded-md border border-sky-400/40 bg-sky-500/10 px-2 py-0.5 text-[11px] font-extrabold text-sky-300">
              <Users className="w-3 h-3" />
              순환 드래프트
            </span>
            <span className="font-mono text-[11px] font-bold text-slate-400">#{room.code}</span>
            <span className="text-xs font-bold text-white tabular-nums">
              {Math.min(round + 1, 16)}/16R · {Math.min(pickNo, totalPicks)}/{totalPicks}
            </span>
            <ManagerFitBadge
              traitId={managerTraitId}
              starters={previewStarters}
              baselineStarters={activePreview ? board.starters : null}
              tactic={tactic}
              formation={formation}
              variant="pill"
              align="left"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {!draftFinished && draft && (
              <div className="flex items-center gap-1.5">
                <span
                  className={`rounded-md border px-2 py-0.5 text-[11px] font-extrabold ${
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
              <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-300">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                시즌 준비 중
              </span>
            )}
            {!draftFinished && (
              <button
                type="button"
                onClick={toggleTurnSound}
                title={turnSoundOn ? '내 차례 알림음 끄기' : '내 차례 알림음 켜기'}
                aria-label={turnSoundOn ? '내 차례 알림음 끄기' : '내 차례 알림음 켜기'}
                className={`inline-flex items-center rounded-lg border p-1.5 cursor-pointer ${
                  turnSoundOn
                    ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300'
                    : 'border-slate-800 bg-[#111822] text-slate-500 hover:text-slate-300'
                }`}
              >
                {turnSoundOn ? (
                  <Volume2 className="w-3.5 h-3.5" />
                ) : (
                  <VolumeX className="w-3.5 h-3.5" />
                )}
              </button>
            )}
            {!draftFinished && (
              <button
                id="mpl-auto-draft-btn"
                type="button"
                disabled={iAgreedAuto}
                onClick={() => onAck(autoKey)}
                className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10.5px] font-bold ${
                  iAgreedAuto
                    ? 'border-emerald-500/40 bg-emerald-500/12 text-emerald-300'
                    : 'border-slate-700 bg-[#111822] text-slate-300 hover:border-emerald-400/50 cursor-pointer'
                }`}
              >
                <FastForward className="w-3 h-3" />
                자동{' '}
                {players.filter((p) => p.activity?.ackKeys?.includes(autoKey)).length}/
                {players.length}
              </button>
            )}
            <button
              type="button"
              onClick={onLeaveRoom}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-[#111822] px-2 py-1 text-[10.5px] font-bold text-slate-400 hover:text-rose-300 cursor-pointer"
            >
              <LogOut className="w-3 h-3" />
              나가기
            </button>
          </div>
        </div>

        {/* Compact Rotating Round Order & Roulette Track */}
        {!draftFinished && currentRoundOrder.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-1.5 border-t border-slate-800/70 pt-1.5 text-[10.5px]">
            <div className="flex flex-wrap items-center gap-1">
              <span className="font-bold text-slate-500 mr-0.5">
                {round + 1}R 순서
              </span>
              {currentRoundOrder.map((pid, idx) => {
                const nick = nicknameByPlayerId[pid] ?? '참가자';
                const isActive = pid === currentPickerId;
                const isSpinner = idx === 0;
                const doneInRound = idx < pickNo % Math.max(1, currentRoundOrder.length);
                return (
                  <span key={pid} className="inline-flex items-center gap-1">
                    {idx > 0 && <span className="text-slate-600">→</span>}
                    <span
                      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-bold ${
                        isActive
                          ? 'border border-emerald-400/55 bg-emerald-500/18 text-emerald-200'
                          : doneInRound
                            ? 'bg-slate-900/70 text-slate-500 line-through'
                            : 'bg-[#111822] text-slate-300'
                      }`}
                    >
                      {isSpinner && (
                        <span className="rounded bg-amber-500/20 px-1 text-[9px] font-extrabold text-amber-300">
                          룰렛
                        </span>
                      )}
                      <span>{nick}</span>
                      {pid === playerId && (
                        <span className="text-[9px] font-black text-emerald-400">ME</span>
                      )}
                    </span>
                  </span>
                );
              })}
            </div>
            {nextRoundSpinnerId && (
              <span className="text-[10px] font-semibold text-slate-400">
                다음 {round + 2}R 룰렛:{' '}
                <strong className="text-slate-200">
                  {nicknameByPlayerId[nextRoundSpinnerId] ?? '-'}
                </strong>
              </span>
            )}
          </div>
        )}
      </div>

      <DraftBudgetBar
        players={[...board.starters, ...board.bench]}
        previewPlayer={previewCandidate}
        compact
      />

      {/* Main 2-Column Layout: [Left: Player Tabs + Single Original Pitch] | [Right: Compact Candidate Pool] */}
      <div className="grid grid-cols-1 gap-2.5 sm:gap-3.5 lg:grid-cols-12 items-start">
        {/* Right/Top on mobile: Compact Shared Roulette & Candidate Pool (7 cols) */}
        <div className="lg:col-span-7 order-1 lg:order-2">
          <div
            className={`rounded-xl sm:rounded-2xl border bg-[#0d131c] p-2 sm:p-2.5 space-y-2 transition-shadow duration-300 ${
              turnPulse
                ? 'border-emerald-400/80 ring-2 ring-emerald-400/45 shadow-[0_0_24px_rgba(16,185,129,0.2)]'
                : isMyTurn
                  ? 'border-emerald-500/45'
                  : 'border-slate-800/90'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs px-0.5">
              <div className="flex items-center gap-1.5">
                <span
                  className={`rounded-md px-2 py-0.5 text-[11px] font-extrabold ${
                    isMyTurn
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {Math.min(round + 1, 16)}라운드
                </span>
                {(roll?.label || rouletteTargetDisplay.label) && (
                  <span className="text-[11px] font-bold text-slate-300">
                    {roll?.label ?? rouletteTargetDisplay.label} 룰렛
                  </span>
                )}
                {allAuto && !draftFinished && (
                  <span className="text-[10.5px] font-bold text-emerald-300">
                    · 자동 진행 중
                  </span>
                )}
              </div>
              {!isMyTurn && !draftFinished && (
                <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-400/35 bg-amber-500/10 px-2 py-0.5 text-[10.5px] font-bold text-amber-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                  {waitingLabel}
                </span>
              )}
              {draftFinished && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-300">
                  <Check className="w-3 h-3" />
                  16인 구성 완료
                </span>
              )}
            </div>

            <RouletteReelsView
              key={`${generation}:${round}`}
              hasSpun={Boolean(roll)}
              reels={roll?.reels ?? []}
              reelCount={rouletteClubCount}
              legendRatePercent={Number((DEFAULT_ROULETTE_LEGEND_RATE * 100).toFixed(1))}
              targetSubPosition={rouletteTargetDisplay.subPosition}
              managerTraitId={managerTraitId}
              allowedLeagueIds={draftPool}
              previewCandidate={activePreview}
              onSelectPreviewCandidate={handleSelectPreview}
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
              pickActionLabel={previewSlot?.label ?? '영입'}
            />
          </div>
        </div>

        {/* Left/Bottom on mobile: Top Participant Switch Tabs + Single Original PitchBoard (5 cols) */}
        <div className="lg:col-span-5 order-2 lg:order-1 space-y-2">
          {/* Top Participant Switch Tabs */}
          <div
            role="tablist"
            aria-label="참가자 포메이션 전환"
            className="grid gap-1.5"
            style={{
              gridTemplateColumns: `repeat(${Math.min(Math.max(participantViews.length, 2), 4)}, minmax(0, 1fr))`,
            }}
          >
            {participantViews.map((pv) => {
              const isSelected = activeView?.row.player_id === pv.row.player_id;
              const onClock = pv.row.player_id === currentPickerId;
              const online = onlinePlayerIds.includes(pv.row.player_id);

              return (
                <button
                  key={pv.row.player_id}
                  role="tab"
                  aria-selected={isSelected}
                  type="button"
                  onClick={() => setActiveTabPlayerId(pv.row.player_id)}
                  className={`flex flex-col gap-0.5 rounded-xl border px-2 py-1.5 text-left transition-colors cursor-pointer min-w-0 touch-manipulation ${
                    isSelected
                      ? pv.isMe
                        ? 'border-emerald-400/75 bg-emerald-950/30 ring-1 ring-emerald-400/35'
                        : 'border-sky-400/65 bg-sky-950/25 ring-1 ring-sky-400/30'
                      : onClock
                        ? 'border-amber-400/55 bg-[#17140d] hover:border-amber-400/80'
                        : 'border-slate-800/90 bg-[#0d131c] hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-1 min-w-0">
                    <PixelManagerAvatar
                      avatar={pv.row.avatar_json}
                      clubPrimaryColor={pv.row.club_profile.primaryColor}
                      clubSecondaryColor={pv.row.club_profile.secondaryColor}
                      size={16}
                    />
                    <span
                      className={`truncate text-[11px] font-extrabold leading-tight ${
                        isSelected ? 'text-white' : 'text-slate-300'
                      }`}
                    >
                      {pv.isMe ? '내 팀' : pv.row.nickname}
                    </span>
                    {pv.isMe && (
                      <span className="shrink-0 rounded bg-emerald-400 px-1 py-px text-[7.5px] font-black leading-none text-slate-950">
                        MY
                      </span>
                    )}
                    {onClock && (
                      <span
                        className={`ml-auto h-1.5 w-1.5 shrink-0 rounded-full animate-pulse ${
                          pv.isMe ? 'bg-emerald-400' : 'bg-amber-400'
                        }`}
                      />
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-1 text-[9.5px] font-bold text-slate-400 tabular-nums">
                    <span>
                      {pv.pickCount}/16
                      {!online && ' · 오프'}
                    </span>
                    <span className={pv.isMe ? 'text-emerald-300/90' : 'text-sky-300/85'}>
                      케미 {pv.chemistry.total}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Single Original Formation PitchBoard */}
          {activeView && (
            <div className="rounded-xl border border-slate-800/90 bg-[#0d131c] p-2 space-y-1.5">
              <div className="flex items-center justify-between gap-2 px-0.5 text-[11px]">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="truncate font-extrabold text-white">
                    {activeView.row.nickname}
                  </span>
                  <span className="text-[10px] text-slate-400 truncate">
                    {MANAGER_TRAITS[activeView.traitId]?.name}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 tabular-nums">
                  {activeView.isMe && selectedSlot && (
                    <button
                      type="button"
                      onClick={() => setSelectedSlot(null)}
                      className="rounded border border-amber-400/40 bg-amber-500/15 px-1.5 py-0.5 text-[9.5px] font-bold text-amber-200 cursor-pointer"
                    >
                      스왑 취소
                    </button>
                  )}
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-slate-300">
                    <Zap className="w-3 h-3 text-emerald-400" />
                    A {activeView.ratings.effectiveAtt} / M {activeView.ratings.effectiveMid} / D{' '}
                    {activeView.ratings.effectiveDef}
                  </span>
                </div>
              </div>

              <PitchBoard
                formation={activeView.formation}
                starters={activeView.starters}
                bench={activeView.bench}
                chemistry={activeView.chemistry}
                managerTraitId={activeView.traitId}
                tactic={activeView.tactic}
                baselineStarters={
                  activeView.isMe && activePreview ? board.starters : null
                }
                conditionByPlayerId={{}}
                activeSlot={
                  activeView.isMe && previewSlot
                    ? { area: previewSlot.area, index: previewSlot.index }
                    : null
                }
                previewSlot={
                  activeView.isMe && previewSlot
                    ? { area: previewSlot.area, index: previewSlot.index }
                    : null
                }
                selectedSlot={activeView.isMe ? selectedSlot : null}
                onSlotClick={
                  activeView.isMe
                    ? handleSlotClick
                    : (area, slotIdx) => {
                        const target =
                          area === 'starter'
                            ? activeView.starters[slotIdx]
                            : activeView.bench[slotIdx];
                        if (target) setInspected({ player: target });
                      }
                }
                onSlotSwap={activeView.isMe ? handleSwap : undefined}
                onInspectPlayer={(player, slotSubPosition) =>
                  setInspected({ player, slotSubPosition })
                }
                showBench
                draftBenchHints={!draftFinished}
                showChemBreakdown={false}
                showChemLegend
                compact
              />
            </div>
          )}
        </div>
      </div>

      {/* Mobile Sticky Confirm Bar when previewing on my turn */}
      {activePreview && isMyTurn && !draftFinished && (
        <div className="lg:hidden sticky bottom-2 z-30 flex items-center justify-between gap-2 rounded-xl border border-emerald-400/60 bg-[#0b1518] px-3 py-2 shadow-2xl">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="truncate text-xs font-extrabold text-white">
              {activePreview.name}
            </span>
            <span className="font-mono text-[11px] font-bold text-amber-300 shrink-0">
              {activePreview.ovr}
            </span>
            {previewChemDelta !== 0 && (
              <span
                className={`font-mono text-[10px] font-bold shrink-0 ${
                  previewChemDelta > 0 ? 'text-emerald-300' : 'text-rose-300'
                }`}
              >
                케미 {previewChemDelta > 0 ? `+${previewChemDelta}` : previewChemDelta}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => handleSelectPreview(null)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[11px] font-bold text-slate-300 cursor-pointer touch-manipulation"
            >
              취소
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void submitPick(activePreview, false)}
              className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-black text-slate-950 hover:bg-emerald-400 disabled:opacity-50 cursor-pointer touch-manipulation"
            >
              {previewSlot?.label ?? '영입'} 확정
            </button>
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
