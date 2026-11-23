import { ArrowRight, Check, Dices, Loader2, LogOut, Sparkles, Timer, Users } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FORMATION_LIST } from '../../../data/formations';
import { MANAGER_TRAIT_LIST, MANAGER_TRAITS } from '../../../data/managerTraits';
import { calculateChemistry, calculateTeamRatings } from '../../../engine/chemistryEngine';
import { DEFAULT_ROULETTE_LEGEND_RATE, spinClubRoulette } from '../../../engine/draftEngine';
import {
  buildAutoPick,
  collectTakenIds,
  findNextOpenDraftSlot,
  snakePickerId,
} from '../../../engine/mpLeagueDraft';
import { TACTIC_LIST } from '../../../engine/tacticEngine';
import { DEFAULT_MP_LEAGUE_POOL } from '../../../services/multiplayerService';
import { insertLeaguePick } from '../../../services/mpLeagueService';
import type {
  FormationId,
  ManagerTraitId,
  RouletteReelResult,
} from '../../../types/game';
import type { LeagueId, TacticId } from '../../../types/league';
import type {
  MpLeagueLive,
  MpLeaguePickRow,
  MpLeagueSquadPayload,
} from '../../../types/mpLeague';
import type { MpRoomPlayerRow, MpRoomRow } from '../../../types/multiplayer';
import type { Player, SubPosition } from '../../../types/player';
import { JerseySvg } from '../../common/JerseySvg';
import { PitchBoard } from '../../common/PitchBoard';
import type { SlotRef } from '../../common/PitchBoard';
import { PixelManagerAvatar } from '../../common/PixelManagerAvatar';
import { PlayerDetailModal } from '../../common/PlayerDetailModal';
import { RouletteReelsView } from '../../draft/RouletteReelsView';

interface MpLeagueSnakeDraftProps {
  room: MpRoomRow;
  players: MpRoomPlayerRow[];
  playerId: string;
  live: MpLeagueLive;
  picks: MpLeaguePickRow[];
  onlinePlayerIds: string[];
  onSavePayload: (payload: MpLeagueSquadPayload) => Promise<void>;
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
  const place = (player: Player, slot: SlotRef): boolean => {
    const list = slot.area === 'starter' ? starters : bench;
    if (slot.index < 0 || slot.index >= list.length || list[slot.index]) return false;
    list[slot.index] = player;
    return true;
  };
  const leftovers: Player[] = [];
  for (const row of mine) {
    const { player, area, index } = row.player_json;
    const slot = overrides[player.id] ?? { area, index };
    if (!place(player, slot)) leftovers.push(player);
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

export function MpLeagueSnakeDraft({
  room,
  players,
  playerId,
  live,
  picks,
  onlinePlayerIds,
  onSavePayload,
  onLeaveRoom,
}: MpLeagueSnakeDraftProps) {
  const meRow = players.find((p) => p.player_id === playerId) ?? null;
  const myPayload = meRow?.league_payload ?? null;
  const draftPool: LeagueId[] =
    room.settings.draftLeaguePool?.length > 0
      ? room.settings.draftLeaguePool
      : DEFAULT_MP_LEAGUE_POOL;

  const [traitId, setTraitId] = useState<ManagerTraitId>(
    () => myPayload?.managerTraitId ?? MANAGER_TRAIT_LIST[0].id,
  );
  const [formationDraft, setFormationDraft] = useState<FormationId>(
    () => myPayload?.formation ?? '4-3-3',
  );
  const [tacticDraft, setTacticDraft] = useState<TacticId>(
    () => myPayload?.tactic ?? 'possession',
  );
  const [savingSetup, setSavingSetup] = useState(false);

  const [overrides, setOverrides] = useState<Record<string, SlotRef>>({});
  const [reelState, setReelState] = useState<{
    pickNo: number;
    reels: RouletteReelResult[];
  } | null>(null);
  const [previewCandidate, setPreviewCandidate] = useState<Player | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<SlotRef | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [turnClock, setTurnClock] = useState<{ pickNo: number; startedAt: number }>({
    pickNo: -1,
    startedAt: 0,
  });
  const [now, setNow] = useState<number>(() => Date.now());
  const [inspected, setInspected] = useState<{
    player: Player;
    slotSubPosition?: SubPosition;
  } | null>(null);
  const finalSavedRef = useRef<string | null>(null);

  const isSetupStage = live.stage === 'setup';
  const draft = live.draft;
  const pickNo = picks.length;
  const totalPicks = draft?.totalPicks ?? 0;
  const draftFinished = Boolean(draft && pickNo >= totalPicks);
  const currentPickerId = draft && !draftFinished ? snakePickerId(pickNo, draft.order) : null;
  const isMyTurn = currentPickerId === playerId;

  const formation: FormationId = myPayload?.formation ?? formationDraft;
  const tactic: TacticId = myPayload?.tactic ?? tacticDraft;
  const managerTraitId: ManagerTraitId = myPayload?.managerTraitId ?? traitId;

  const board = useMemo(
    () => buildBoard(picks, playerId, overrides),
    [picks, playerId, overrides],
  );
  const openSlot = useMemo(
    () => findNextOpenDraftSlot(formation, board.starters, board.bench),
    [formation, board],
  );
  const takenIds = useMemo(() => collectTakenIds(picks), [picks]);
  const hasSpun = Boolean(reelState && reelState.pickNo === pickNo);
  const reels = hasSpun && reelState ? reelState.reels : [];
  const activePreview = isMyTurn && hasSpun ? previewCandidate : null;

  // Turn timer: restarts locally whenever a new pick lands (no clock-skew between friends)
  useEffect(() => {
    const t = window.setTimeout(
      () => setTurnClock({ pickNo, startedAt: Date.now() }),
      0,
    );
    return () => window.clearTimeout(t);
  }, [pickNo]);

  useEffect(() => {
    if (isSetupStage || draftFinished) return;
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [isSetupStage, draftFinished]);

  const turnSec = draft?.turnSec ?? 30;
  const remainingSec =
    turnClock.pickNo === pickNo
      ? Math.max(0, Math.ceil(turnSec - (now - turnClock.startedAt) / 1000))
      : turnSec;

  const submitPick = async (player: Player, auto: boolean) => {
    if (!draft || !openSlot || submitting) return;
    setSubmitting(true);
    const res = await insertLeaguePick({
      roomId: room.id,
      draftGeneration: draft.generation,
      pickNo,
      pickerId: playerId,
      pick: { player, area: openSlot.area, index: openSlot.index, auto },
    });
    if (res.outcome !== 'ok') setReelState(null);
    setPreviewCandidate(null);
    setSubmitting(false);
  };

  // Auto-pick safety when my timer runs out (best OVR among the candidates on screen)
  useEffect(() => {
    if (!isMyTurn || !draft || submitting) return;
    if (turnClock.pickNo !== pickNo || remainingSec > 0) return;
    const pick = buildAutoPick({
      formation,
      starters: board.starters,
      bench: board.bench,
      takenIds,
      allowedLeagueIds: draftPool,
      shownCandidates: reels.flatMap((r) => r.candidates),
    });
    if (!pick) return;
    const t = window.setTimeout(() => {
      void submitPick(pick.player, true);
    }, 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMyTurn, remainingSec, turnClock.pickNo, pickNo, submitting]);

  // Upload my final 11 + 5 once every pick is in
  useEffect(() => {
    if (!draftFinished || !draft || !myPayload) return;
    const cleanStarters = board.starters.filter((p): p is Player => p !== null);
    const cleanBench = board.bench.filter((p): p is Player => p !== null);
    if (cleanStarters.length !== 11 || cleanBench.length !== 5) return;
    const key = `${draft.generation}:${cleanStarters.map((p) => p.id).join(',')}`;
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
  }, [draftFinished, draft, myPayload, board, managerTraitId, formation, tactic, onSavePayload]);

  const previewStarters = useMemo(() => {
    if (!activePreview || !openSlot || openSlot.area !== 'starter') return board.starters;
    const copy = [...board.starters];
    copy[openSlot.index] = activePreview;
    return copy;
  }, [activePreview, openSlot, board.starters]);
  const previewBench = useMemo(() => {
    if (!activePreview || !openSlot || openSlot.area !== 'bench') return board.bench;
    const copy = [...board.bench];
    copy[openSlot.index] = activePreview;
    return copy;
  }, [activePreview, openSlot, board.bench]);

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
    activePreview && openSlot?.area === 'starter'
      ? displayChemistry.slotSynergies[openSlot.index] ?? null
      : null;
  const previewChemDelta =
    activePreview && openSlot?.area === 'starter'
      ? displayChemistry.total - baseChemistry.total
      : 0;

  const handleSpin = () => {
    if (!isMyTurn || !openSlot) return;
    const next = spinClubRoulette(openSlot.subPosition, openSlot.position, takenIds, {
      legendRate: DEFAULT_ROULETTE_LEGEND_RATE,
      allowedLeagueIds: draftPool,
    });
    setPreviewCandidate(null);
    setReelState({ pickNo, reels: next });
  };

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

  const handleConfirmSetup = async () => {
    setSavingSetup(true);
    await onSavePayload({
      managerTraitId: traitId,
      formation: formationDraft,
      tactic: tacticDraft,
      starters: [],
      bench: [],
      setupReady: true,
      rev: (myPayload?.rev ?? 0) + 1,
      by: 'player',
    });
    setSavingSetup(false);
  };

  const orderedPlayers = useMemo(() => {
    if (!draft) return players;
    const byId = new Map(players.map((p) => [p.player_id, p]));
    return draft.order
      .map((id) => byId.get(id))
      .filter((p): p is MpRoomPlayerRow => Boolean(p));
  }, [draft, players]);

  const header = (
    <div className="rounded-xl border border-slate-800/90 bg-[#0d131c] px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-md border border-sky-400/40 bg-sky-500/10 px-2 py-0.5 text-[11px] font-extrabold text-sky-300">
          <Users className="w-3 h-3" />
          {isSetupStage ? '감독 선택' : '공개 스네이크 드래프트'}
        </span>
        <span className="font-mono text-xs font-bold text-slate-400">#{room.code}</span>
        {!isSetupStage && draft && (
          <span className="text-xs font-bold text-white tabular-nums">
            {Math.min(pickNo, totalPicks)}/{totalPicks}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={onLeaveRoom}
        className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-[#111822] px-2.5 py-1 text-[11px] font-bold text-slate-400 hover:text-rose-300 cursor-pointer"
      >
        <LogOut className="w-3 h-3" />
        나가기
      </button>
    </div>
  );

  // ── Stage A: every friend picks a manager trait + starting formation ───────
  if (isSetupStage) {
    const iAmReady = Boolean(myPayload?.setupReady);
    return (
      <div className="mx-auto max-w-6xl px-2.5 py-3 sm:px-4 sm:py-5 space-y-3">
        {header}
        <div className="flex flex-wrap gap-2">
          {players.map((p) => (
            <div
              key={p.player_id}
              className={`flex items-center gap-2 rounded-xl border px-2.5 py-1.5 ${
                p.league_payload?.setupReady
                  ? 'border-emerald-500/40 bg-emerald-500/10'
                  : 'border-slate-800 bg-[#0d131c]'
              }`}
            >
              <PixelManagerAvatar
                avatar={p.avatar_json}
                clubPrimaryColor={p.club_profile.primaryColor}
                clubSecondaryColor={p.club_profile.secondaryColor}
                size={26}
              />
              <span className="text-xs font-bold text-slate-200">{p.nickname}</span>
              {p.league_payload?.setupReady ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
              )}
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-slate-800/90 bg-[#0d131c] p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-extrabold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              감독 능력 · 포메이션
            </h2>
            <button
              type="button"
              disabled={iAmReady}
              onClick={() => {
                const picked =
                  MANAGER_TRAIT_LIST[Math.floor(Math.random() * MANAGER_TRAIT_LIST.length)];
                if (picked) setTraitId(picked.id);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#111822] px-3 py-1.5 text-xs font-bold text-slate-200 hover:border-amber-400/50 disabled:opacity-40 cursor-pointer"
            >
              <Dices className="w-3.5 h-3.5 text-amber-400" />
              랜덤 추천
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {MANAGER_TRAIT_LIST.map((trait) => {
              const active = traitId === trait.id;
              return (
                <button
                  key={trait.id}
                  type="button"
                  disabled={iAmReady}
                  onClick={() => setTraitId(trait.id)}
                  className={`rounded-xl border p-3 text-left transition-colors cursor-pointer space-y-1 disabled:cursor-default ${
                    active
                      ? 'border-emerald-400/60 bg-emerald-500/12 text-white'
                      : 'border-slate-800 bg-[#111822] text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-extrabold truncate">{trait.name}</span>
                    {active && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                  </div>
                  <div className="text-[10px] text-slate-400 line-clamp-2 leading-snug">
                    {trait.tagline}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-2 border-t border-slate-800/80">
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold text-slate-400">포메이션</div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                {FORMATION_LIST.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    disabled={iAmReady}
                    onClick={() => setFormationDraft(f.id)}
                    className={`rounded-lg border py-1.5 px-1 text-[11px] font-bold transition-colors cursor-pointer truncate disabled:cursor-default ${
                      formationDraft === f.id
                        ? 'border-sky-400/55 bg-sky-500/18 text-white'
                        : 'border-slate-800 bg-[#111822] text-slate-400 hover:text-slate-200'
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
            </div>
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold text-slate-400">기본 전술</div>
              <div className="grid grid-cols-5 gap-1.5">
                {TACTIC_LIST.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    disabled={iAmReady}
                    onClick={() => setTacticDraft(t.id)}
                    className={`rounded-lg border py-1.5 px-1 text-[11px] font-bold transition-colors cursor-pointer truncate disabled:cursor-default ${
                      tacticDraft === t.id
                        ? 'border-emerald-400/55 bg-emerald-500/15 text-white'
                        : 'border-slate-800 bg-[#111822] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {t.shortName}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            {iAmReady ? (
              <div className="inline-flex items-center gap-2 rounded-xl border border-sky-400/45 bg-sky-500/15 px-5 py-2.5 text-sm font-extrabold text-sky-200">
                <Loader2 className="w-4 h-4 animate-spin" />
                다른 감독 대기 중
              </div>
            ) : (
              <button
                id="mpl-confirm-setup-btn"
                type="button"
                disabled={savingSetup}
                onClick={() => void handleConfirmSetup()}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-extrabold text-slate-950 hover:bg-emerald-400 disabled:opacity-50 cursor-pointer"
              >
                준비 완료
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Stage B: public turn-based snake draft ─────────────────────────────────
  const currentPicker = players.find((p) => p.player_id === currentPickerId) ?? null;
  const timerTone =
    remainingSec <= 5 ? 'text-rose-300' : remainingSec <= 10 ? 'text-amber-300' : 'text-white';

  return (
    <div className="mx-auto max-w-6xl px-2.5 py-3 sm:px-4 sm:py-5 space-y-3">
      {header}

      {/* Turn strip: who is on the clock + everyone's live progress */}
      <div className="rounded-xl border border-slate-800/90 bg-[#0d131c] p-2.5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
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
                {openSlot && isMyTurn && (
                  <span className="ml-1.5 text-slate-400">· {openSlot.label}</span>
                )}
              </>
            )}
          </div>
          {!draftFinished && (
            <span
              className={`inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-[#0a0f17] px-2.5 py-1 font-mono text-sm font-black tabular-nums ${timerTone}`}
            >
              <Timer className="w-3.5 h-3.5" />
              {remainingSec}s
            </span>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-0.5">
          {orderedPlayers.map((p, idx) => {
            const count = picks.filter((x) => x.picker_id === p.player_id).length;
            const onClock = p.player_id === currentPickerId;
            const online = onlinePlayerIds.includes(p.player_id);
            return (
              <div
                key={p.player_id}
                className={`flex shrink-0 items-center gap-2 rounded-xl border px-2.5 py-1.5 ${
                  onClock
                    ? 'border-emerald-400/55 bg-emerald-500/12'
                    : 'border-slate-800 bg-[#0b1018]'
                }`}
              >
                <span className="text-[10px] font-black text-slate-500">{idx + 1}</span>
                <PixelManagerAvatar
                  avatar={p.avatar_json}
                  clubPrimaryColor={p.club_profile.primaryColor}
                  clubSecondaryColor={p.club_profile.secondaryColor}
                  size={24}
                />
                <div className="leading-tight">
                  <div className="text-[11px] font-extrabold text-slate-100">
                    {p.nickname}
                    {p.player_id === playerId && (
                      <span className="ml-1 text-emerald-300">나</span>
                    )}
                  </div>
                  <div className="text-[10px] font-bold text-slate-400 tabular-nums">
                    {count}/16{!online && ' · 오프라인'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12 items-start">
        <div className="lg:col-span-6 space-y-3">
          {isMyTurn && openSlot ? (
            <div className="rounded-2xl border border-emerald-500/30 bg-[#0d131c] p-3.5 space-y-3">
              <div className="flex items-center gap-2 text-xs">
                <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 font-extrabold text-emerald-300">
                  {openSlot.area === 'starter'
                    ? `선발 ${openSlot.index + 1}/11`
                    : `벤치 ${openSlot.index + 1}/5`}
                </span>
                <span className="font-bold text-white">{openSlot.label}</span>
                <span className="text-[11px] text-slate-400">
                  ({MANAGER_TRAITS[managerTraitId]?.name})
                </span>
              </div>
              <RouletteReelsView
                hasSpun={hasSpun}
                reels={reels}
                legendRatePercent={Number((DEFAULT_ROULETTE_LEGEND_RATE * 100).toFixed(1))}
                targetSubPosition={openSlot.subPosition}
                managerTraitId={managerTraitId}
                allowedLeagueIds={draftPool}
                previewCandidate={activePreview}
                onSelectPreviewCandidate={setPreviewCandidate}
                previewSlotSynergy={previewSlotSynergy}
                previewChemDelta={previewChemDelta}
                onSpin={handleSpin}
                onPickPlayer={(player) => void submitPick(player, false)}
                pickActionLabel={`${openSlot.label} 확정`}
              />
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800/90 bg-[#0d131c] p-3.5 space-y-2.5">
              <div className="text-[11px] font-bold text-slate-400">전체 픽 현황</div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {orderedPlayers.map((p) => {
                  const mine = picks
                    .filter((x) => x.picker_id === p.player_id)
                    .sort((a, b) => b.pick_no - a.pick_no);
                  return (
                    <div
                      key={p.player_id}
                      className="rounded-xl border border-slate-800 bg-[#0b1018] p-2 space-y-1.5"
                    >
                      <div className="flex items-center gap-1.5">
                        <JerseySvg
                          primaryColor={p.club_profile.primaryColor}
                          secondaryColor={p.club_profile.secondaryColor}
                          pattern={p.club_profile.pattern}
                          label={p.club_profile.shortName}
                          size={20}
                        />
                        <span className="truncate text-[11px] font-extrabold text-slate-100">
                          {p.nickname}
                        </span>
                      </div>
                      <div className="max-h-44 space-y-0.5 overflow-y-auto pr-0.5">
                        {mine.length === 0 && (
                          <div className="text-[10px] text-slate-600">-</div>
                        )}
                        {mine.map((row) => (
                          <button
                            key={row.pick_no}
                            type="button"
                            onClick={() => setInspected({ player: row.player_json.player })}
                            className="flex w-full items-center justify-between gap-1.5 rounded-md px-1.5 py-0.5 text-left hover:bg-slate-800/60 cursor-pointer"
                          >
                            <span className="truncate text-[11px] text-slate-300">
                              <span className="mr-1 font-mono text-[10px] text-slate-500">
                                {row.player_json.player.mainPositions?.[0] ??
                                  row.player_json.player.position}
                              </span>
                              {row.player_json.player.name}
                            </span>
                            <span className="font-mono text-[11px] font-bold text-slate-200 tabular-nums">
                              {row.player_json.player.ovr}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-6 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800/80 bg-[#0d131c] px-3 py-2 text-xs">
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
            {selectedSlot && (
              <button
                type="button"
                onClick={() => setSelectedSlot(null)}
                className="text-[11px] font-bold text-amber-300 hover:underline cursor-pointer"
              >
                스왑 취소
              </button>
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
              isMyTurn && openSlot ? { area: openSlot.area, index: openSlot.index } : null
            }
            selectedSlot={selectedSlot}
            onSlotClick={handleSlotClick}
            onSlotSwap={handleSwap}
            onInspectPlayer={(player, slotSubPosition) =>
              setInspected({ player, slotSubPosition })
            }
            showBench
            showChemBreakdown
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
