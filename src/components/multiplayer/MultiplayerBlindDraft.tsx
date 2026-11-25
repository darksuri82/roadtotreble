import {
  ArrowRight,
  Check,
  Dices,
  EyeOff,
  FastForward,
  Loader2,
  LogOut,
  Shield,
  Sparkles,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BENCH_SLOTS, FORMATION_LIST, FORMATIONS } from '../../data/formations';
import {
  MANAGER_TRAIT_LIST,
  MANAGER_TRAITS,
} from '../../data/managerTraits';
import { calculateChemistry, calculateTeamRatings } from '../../engine/chemistryEngine';
import {
  DEFAULT_ROULETTE_LEGEND_RATE,
  spinClubRoulette,
} from '../../engine/draftEngine';
import { remapStartersForFormation } from '../../engine/lineupOptimizer';
import { TACTIC_LIST } from '../../engine/tacticEngine';
import {
  DEFAULT_MP_LEAGUE_POOL,
  loadLocalMpDraft,
  saveLocalMpDraft,
} from '../../services/multiplayerService';
import type {
  DraftState,
  FormationId,
  ManagerTraitId,
} from '../../types/game';
import type { LeagueId, TacticId } from '../../types/league';
import type {
  MpLineupPayload,
  MpRoomPlayerRow,
  MpRoomSnapshot,
} from '../../types/multiplayer';
import type { Player, SubPosition } from '../../types/player';
import { ManagerFitBadge } from '../common/ManagerFitBadge';
import { PitchBoard } from '../common/PitchBoard';
import type { SlotRef } from '../common/PitchBoard';
import { PlayerDetailModal } from '../common/PlayerDetailModal';
import { RouletteReelsView } from '../draft/RouletteReelsView';

function findNextOpenSlot(
  starters: (Player | null)[],
  bench: (Player | null)[],
): { currentSlotType: 'starter' | 'bench'; currentSlotIndex: number } | null {
  for (let i = 0; i < 11; i += 1) {
    if (!starters[i]) return { currentSlotType: 'starter', currentSlotIndex: i };
  }
  for (let i = 0; i < 5; i += 1) {
    if (!bench[i]) return { currentSlotType: 'bench', currentSlotIndex: i };
  }
  return null;
}

interface MultiplayerBlindDraftProps {
  snapshot: MpRoomSnapshot;
  playerId: string;
  opponent: MpRoomPlayerRow | null;
  opponentOnline: boolean;
  onProgressUpdate: (progress: number) => void;
  onSubmitCompletedLineup: (payload: MpLineupPayload) => Promise<void>;
  onLeaveRoom: () => void;
}

export function MultiplayerBlindDraft({
  snapshot,
  playerId,
  opponent,
  opponentOnline,
  onProgressUpdate,
  onSubmitCompletedLineup,
  onLeaveRoom,
}: MultiplayerBlindDraftProps) {
  const { room, players } = snapshot;
  const meRow = players.find((p) => p.player_id === playerId) ?? null;
  const draftGeneration = room.settings.draftGeneration ?? 1;
  const draftLeaguePool: LeagueId[] =
    room.settings.draftLeaguePool?.length > 0
      ? room.settings.draftLeaguePool
      : DEFAULT_MP_LEAGUE_POOL;

  // Restore local draft state on refresh so picks are never lost or leaked
  const restored = useMemo(
    () => loadLocalMpDraft(room.code, playerId, draftGeneration),
    [room.code, playerId, draftGeneration],
  );

  const [step, setStep] = useState<'manager' | 'draft'>(() => {
    if (meRow?.draft_completed) return 'draft';
    return restored?.stage ?? 'manager';
  });
  const [managerTraitId, setManagerTraitId] = useState<ManagerTraitId>(
    () =>
      meRow?.lineup_payload?.managerTraitId ??
      restored?.managerTraitId ??
      MANAGER_TRAIT_LIST[0].id,
  );
  const [formation, setFormation] = useState<FormationId>(
    () => meRow?.lineup_payload?.formation ?? restored?.formation ?? '4-3-3',
  );
  const [defaultTactic, setDefaultTactic] = useState<TacticId>(
    () => meRow?.lineup_payload?.defaultTactic ?? restored?.defaultTactic ?? 'possession',
  );
  const [starters, setStarters] = useState<(Player | null)[]>(() => {
    if (meRow?.lineup_payload?.starters?.length === 11) {
      return [...meRow.lineup_payload.starters];
    }
    return restored?.starters?.length === 11
      ? restored.starters
      : Array.from({ length: 11 }, () => null);
  });
  const [bench, setBench] = useState<(Player | null)[]>(() => {
    if (meRow?.lineup_payload?.bench?.length === 5) {
      return [...meRow.lineup_payload.bench];
    }
    return restored?.bench?.length === 5
      ? restored.bench
      : Array.from({ length: 5 }, () => null);
  });

  const [draft, setDraft] = useState<DraftState>(() => {
    const next = findNextOpenSlot(starters, bench);
    if (!next) {
      return {
        currentSlotType: 'bench',
        currentSlotIndex: 4,
        hasSpun: false,
        reels: [],
        completed: true,
      };
    }
    return {
      currentSlotType: next.currentSlotType,
      currentSlotIndex: next.currentSlotIndex,
      hasSpun: false,
      reels: [],
      completed: false,
    };
  });

  const [previewCandidate, setPreviewCandidate] = useState<Player | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<SlotRef | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [inspected, setInspected] = useState<{
    player: Player;
    slotSubPosition?: SubPosition;
  } | null>(null);

  const filledStarters = useMemo(
    () => starters.filter((p): p is Player => p !== null),
    [starters],
  );
  const filledBench = useMemo(
    () => bench.filter((p): p is Player => p !== null),
    [bench],
  );
  const myFilledCount = filledStarters.length + filledBench.length;
  const isCompleted = Boolean(meRow?.draft_completed || (draft.completed && myFilledCount === 16));

  // Persist local private draft state whenever anything changes
  useEffect(() => {
    saveLocalMpDraft({
      roomCode: room.code,
      playerId,
      draftGeneration,
      stage: step,
      managerTraitId,
      rerollsRemaining: 0,
      hasSpunManager: true,
      formation,
      defaultTactic,
      starters,
      bench,
      completed: isCompleted,
    });
  }, [
    room.code,
    playerId,
    draftGeneration,
    step,
    managerTraitId,
    formation,
    defaultTactic,
    starters,
    bench,
    isCompleted,
  ]);

  const baseChemistry = useMemo(
    () => calculateChemistry(formation, starters, defaultTactic, managerTraitId),
    [formation, starters, defaultTactic, managerTraitId],
  );

  // Live temporary placement preview on PitchBoard (exact same UX as single-player!)
  const previewStarters = useMemo(() => {
    if (!previewCandidate || draft.completed || draft.currentSlotType !== 'starter') {
      return starters;
    }
    const copy = [...starters];
    copy[draft.currentSlotIndex] = previewCandidate;
    return copy;
  }, [previewCandidate, draft, starters]);

  const previewBench = useMemo(() => {
    if (!previewCandidate || draft.completed || draft.currentSlotType !== 'bench') {
      return bench;
    }
    const copy = [...bench];
    copy[draft.currentSlotIndex] = previewCandidate;
    return copy;
  }, [previewCandidate, draft, bench]);

  const displayChemistry = useMemo(
    () =>
      calculateChemistry(
        formation,
        previewStarters,
        defaultTactic,
        managerTraitId,
      ),
    [formation, previewStarters, defaultTactic, managerTraitId],
  );

  const previewSlotSynergy = useMemo(() => {
    if (!previewCandidate || draft.completed || draft.currentSlotType !== 'starter') {
      return null;
    }
    return displayChemistry.slotSynergies[draft.currentSlotIndex] ?? null;
  }, [previewCandidate, draft, displayChemistry]);

  const previewChemDelta = useMemo(() => {
    if (!previewCandidate || draft.completed || draft.currentSlotType !== 'starter') {
      return 0;
    }
    return displayChemistry.total - baseChemistry.total;
  }, [previewCandidate, draft, displayChemistry.total, baseChemistry.total]);

  const ratings = useMemo(
    () =>
      calculateTeamRatings(
        formation,
        previewStarters.filter((p): p is Player => p !== null),
        displayChemistry.total,
        managerTraitId,
        displayChemistry.slotSynergies,
        defaultTactic,
      ),
    [formation, previewStarters, displayChemistry, managerTraitId, defaultTactic],
  );

  const finalizeAndUploadLineup = useCallback(
    async (
      finalStarters: (Player | null)[],
      finalBench: (Player | null)[],
    ) => {
      const cleanStarters = finalStarters.filter((p): p is Player => p !== null);
      const cleanBench = finalBench.filter((p): p is Player => p !== null);
      if (cleanStarters.length < 11 || cleanBench.length < 5) return;
      setSubmitting(true);
      try {
        await onSubmitCompletedLineup({
          managerTraitId,
          formation,
          defaultTactic,
          starters: cleanStarters,
          bench: cleanBench,
          submittedAt: new Date().toISOString(),
        });
      } finally {
        setSubmitting(false);
      }
    },
    [managerTraitId, formation, defaultTactic, onSubmitCompletedLineup],
  );

  const handleRandomTrait = () => {
    const picked =
      MANAGER_TRAIT_LIST[Math.floor(Math.random() * MANAGER_TRAIT_LIST.length)];
    if (picked) setManagerTraitId(picked.id);
  };

  const handleChangeFormation = (nextForm: FormationId) => {
    setFormation((prevForm) => {
      setStarters((prev) =>
        remapStartersForFormation(prev, prevForm, nextForm, managerTraitId),
      );
      return nextForm;
    });
  };

  const handleSpin = () => {
    const formCfg = FORMATIONS[formation];
    const isStarter = draft.currentSlotType === 'starter';
    const slot = isStarter
      ? formCfg.slots[draft.currentSlotIndex]
      : BENCH_SLOTS[draft.currentSlotIndex];
    if (!slot) return;

    // Only exclude MY OWN drafted players — opponent's players remain hidden & duplicates allowed!
    const myPickedIds = new Set<string>();
    for (const p of starters) if (p) myPickedIds.add(p.id);
    for (const p of bench) if (p) myPickedIds.add(p.id);

    const reels = spinClubRoulette(slot.subPosition, slot.position, myPickedIds, {
      legendRate: DEFAULT_ROULETTE_LEGEND_RATE,
      allowedLeagueIds: draftLeaguePool,
    });
    setPreviewCandidate(null);
    setDraft((prev) => ({ ...prev, hasSpun: true, reels }));
  };

  const handlePickPlayer = (player: Player) => {
    const nextStarters = [...starters];
    const nextBench = [...bench];
    if (draft.currentSlotType === 'starter') {
      nextStarters[draft.currentSlotIndex] = player;
    } else {
      nextBench[draft.currentSlotIndex] = player;
    }
    setStarters(nextStarters);
    setBench(nextBench);
    setPreviewCandidate(null);

    const count =
      nextStarters.filter(Boolean).length + nextBench.filter(Boolean).length;
    const nextSlot = findNextOpenSlot(nextStarters, nextBench);

    if (nextSlot) {
      setDraft({
        currentSlotType: nextSlot.currentSlotType,
        currentSlotIndex: nextSlot.currentSlotIndex,
        hasSpun: false,
        reels: [],
        completed: false,
      });
      onProgressUpdate(count);
    } else {
      setDraft({
        currentSlotType: 'bench',
        currentSlotIndex: 4,
        hasSpun: false,
        reels: [],
        completed: true,
      });
      void finalizeAndUploadLineup(nextStarters, nextBench);
    }
  };

  const handleAutoComplete = () => {
    const formCfg = FORMATIONS[formation];
    const nextStarters = [...starters];
    const nextBench = [...bench];
    const myPickedIds = new Set<string>();
    for (const p of nextStarters) if (p) myPickedIds.add(p.id);
    for (const p of nextBench) if (p) myPickedIds.add(p.id);

    for (let i = 0; i < 11; i += 1) {
      if (nextStarters[i]) continue;
      const slot = formCfg.slots[i];
      const reels = spinClubRoulette(slot.subPosition, slot.position, myPickedIds, {
        legendRate: DEFAULT_ROULETTE_LEGEND_RATE,
        allowedLeagueIds: draftLeaguePool,
      });
      const best = reels
        .flatMap((r) => r.candidates)
        .sort((a, b) => b.ovr - a.ovr)[0];
      if (best) {
        nextStarters[i] = best;
        myPickedIds.add(best.id);
      }
    }
    for (let i = 0; i < 5; i += 1) {
      if (nextBench[i]) continue;
      const slot = BENCH_SLOTS[i];
      const reels = spinClubRoulette(slot.subPosition, slot.position, myPickedIds, {
        legendRate: DEFAULT_ROULETTE_LEGEND_RATE,
        allowedLeagueIds: draftLeaguePool,
      });
      const best = reels
        .flatMap((r) => r.candidates)
        .sort((a, b) => b.ovr - a.ovr)[0];
      if (best) {
        nextBench[i] = best;
        myPickedIds.add(best.id);
      }
    }
    setStarters(nextStarters);
    setBench(nextBench);
    setPreviewCandidate(null);
    setDraft({
      currentSlotType: 'bench',
      currentSlotIndex: 4,
      hasSpun: false,
      reels: [],
      completed: true,
    });
    void finalizeAndUploadLineup(nextStarters, nextBench);
  };

  const handleSwapSlots = (from: SlotRef, to: SlotRef) => {
    if (isCompleted) return;
    if (from.area === to.area && from.index === to.index) return;
    const nextStarters = [...starters];
    const nextBench = [...bench];
    const pA =
      from.area === 'starter'
        ? nextStarters[from.index]
        : nextBench[from.index];
    const pB =
      to.area === 'starter' ? nextStarters[to.index] : nextBench[to.index];
    if (from.area === 'starter') nextStarters[from.index] = pB;
    else nextBench[from.index] = pB;
    if (to.area === 'starter') nextStarters[to.index] = pA;
    else nextBench[to.index] = pA;
    setStarters(nextStarters);
    setBench(nextBench);

    const nextSlot = findNextOpenSlot(nextStarters, nextBench);
    if (nextSlot && !draft.hasSpun) {
      setDraft((prev) => ({
        ...prev,
        currentSlotType: nextSlot.currentSlotType,
        currentSlotIndex: nextSlot.currentSlotIndex,
      }));
    }
  };

  const handleSlotClick = (area: 'starter' | 'bench', index: number) => {
    if (isCompleted) return;
    const clicked = area === 'starter' ? starters[index] : bench[index];
    if (!selectedSlot) {
      if (!clicked) return;
      setSelectedSlot({ area, index });
      return;
    }
    if (selectedSlot.area === area && selectedSlot.index === index) {
      setSelectedSlot(null);
      return;
    }
    handleSwapSlots(selectedSlot, { area, index });
    setSelectedSlot(null);
  };

  const currentSlot =
    draft.currentSlotType === 'starter'
      ? FORMATIONS[formation].slots[draft.currentSlotIndex]
      : BENCH_SLOTS[draft.currentSlotIndex];

  const oppProgress = opponent?.draft_progress ?? 0;
  const oppDone = Boolean(opponent?.draft_completed);

  return (
    <div className="mx-auto max-w-6xl px-2.5 py-3 sm:px-4 sm:py-5 space-y-3">
      {/* Compact Private Blind Draft Status Bar */}
      <div className="rounded-xl border border-slate-800/90 bg-[#0d131c] px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/35 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-extrabold text-emerald-300">
            <EyeOff className="w-3 h-3" />
            비공개 블라인드 드래프트
          </span>
          <span className="font-mono text-xs font-bold text-slate-400">
            #{room.code}
          </span>
          <span className="text-xs font-bold text-white tabular-nums">
            내 진행 {myFilledCount}/16
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Opponent Progress Only (Zero Secret Leakage) */}
          <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-[#0a0f17] px-2.5 py-1 text-[11px]">
            {opponentOnline ? (
              <Wifi className="w-3 h-3 text-emerald-400" />
            ) : (
              <WifiOff className="w-3 h-3 text-amber-400" />
            )}
            <span className="font-bold text-slate-300 truncate max-w-[90px]">
              {opponent?.nickname ?? '상대'}
            </span>
            {oppDone ? (
              <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-extrabold text-emerald-300">
                완료 ✓
              </span>
            ) : (
              <span className="font-mono font-bold text-sky-300 tabular-nums">
                {oppProgress}/16
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
      </div>

      {/* ================================================================= */}
      {/* SUB-STEP A: Private Manager Trait + Initial Formation Selection   */}
      {/* ================================================================= */}
      {step === 'manager' && !isCompleted && (
        <div className="rounded-2xl border border-slate-800/90 bg-[#0d131c] p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                비공개 감독 능력 · 포메이션 선택
              </h2>
            </div>
            <button
              type="button"
              onClick={handleRandomTrait}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#111822] px-3 py-1.5 text-xs font-bold text-slate-200 hover:border-amber-400/50 cursor-pointer"
            >
              <Dices className="w-3.5 h-3.5 text-amber-400" />
              랜덤 추천
            </button>
          </div>

          {/* Manager Trait Grid */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {MANAGER_TRAIT_LIST.map((trait) => {
              const active = managerTraitId === trait.id;
              return (
                <button
                  key={trait.id}
                  type="button"
                  onClick={() => setManagerTraitId(trait.id)}
                  className={`rounded-xl border p-3 text-left transition-colors cursor-pointer space-y-1 ${
                    active
                      ? 'border-emerald-400/60 bg-emerald-500/12 text-white'
                      : 'border-slate-800 bg-[#111822] text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-extrabold truncate">
                      {trait.name}
                    </span>
                    {active && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                  </div>
                  <div className="text-[10px] text-slate-400 line-clamp-2 leading-snug">
                    {trait.tagline}
                  </div>
                  <div>
                    <span
                      className={`inline-block rounded border px-1.5 py-px text-[9px] font-bold whitespace-nowrap ${
                        trait.philosophyTarget > 0
                          ? 'border-amber-400/30 bg-amber-500/10 text-amber-200'
                          : 'border-sky-400/30 bg-sky-500/10 text-sky-200'
                      }`}
                    >
                      {trait.philosophyTarget > 0
                        ? `궁합 1~${trait.philosophyTarget}명 비례`
                        : '팀 효과 인원 무관'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Initial Formation & Tactic */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-2 border-t border-slate-800/80">
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold text-slate-400">초기 포메이션</div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                {FORMATION_LIST.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => handleChangeFormation(f.id)}
                    className={`rounded-lg border py-1.5 px-1 text-[11px] font-bold transition-colors cursor-pointer truncate ${
                      formation === f.id
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
                    onClick={() => setDefaultTactic(t.id)}
                    className={`rounded-lg border py-1.5 px-1 text-[11px] font-bold transition-colors cursor-pointer truncate ${
                      defaultTactic === t.id
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
            <button
              id="mp-confirm-manager-btn"
              type="button"
              onClick={() => setStep('draft')}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-extrabold text-slate-950 hover:bg-emerald-400 cursor-pointer"
            >
              선수 드래프트 시작
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* SUB-STEP B & C: 16-Pick Blind Draft OR Waiting for Opponent       */}
      {/* ================================================================= */}
      {(step === 'draft' || isCompleted) && (
        <div className="grid grid-cols-1 gap-2.5 sm:gap-3.5 lg:grid-cols-12 items-start">
          {/* Candidates (7 cols) */}
          <div className="lg:col-span-7 space-y-2 order-1 lg:order-2">
            {isCompleted ? (
              <div className="rounded-2xl border border-emerald-500/35 bg-[#0e1722] p-6 text-center space-y-4">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/40 bg-emerald-500/15 text-emerald-300">
                  {submitting ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <Check className="w-6 h-6" />
                  )}
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-extrabold text-white">
                    {submitting
                      ? '스쿼드 제출 중...'
                      : '내 드래프트 완료! 상대 완료 대기 중'}
                  </h3>
                  <div className="text-xs font-bold text-sky-300 tabular-nums">
                    {opponent?.nickname ?? '상대'} 진행률: {oppProgress}/16
                  </div>
                </div>
                <div className="mx-auto max-w-xs h-2 rounded-full bg-slate-900 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-sky-400 transition-all duration-300"
                    style={{ width: `${Math.min(100, (oppProgress / 16) * 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400">
                  <Shield className="w-3.5 h-3.5 text-emerald-400" />
                  <span>
                    {MANAGER_TRAITS[managerTraitId]?.name} · {formation} · OVR{' '}
                    {Math.round(ratings.ovr || 0)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="rounded-xl sm:rounded-2xl border border-slate-800/90 bg-[#0d131c] p-2 sm:p-2.5 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 font-extrabold text-emerald-300">
                      {draft.currentSlotType === 'starter'
                        ? `선발 ${draft.currentSlotIndex + 1}/11`
                        : `벤치 ${draft.currentSlotIndex + 1}/5`}
                    </span>
                    <span className="font-bold text-white">
                      {currentSlot?.label ?? ''}
                    </span>
                    <ManagerFitBadge
                      traitId={managerTraitId}
                      starters={previewStarters}
                      baselineStarters={previewCandidate ? starters : null}
                      tactic={defaultTactic}
                      formation={formation}
                      variant="pill"
                      align="left"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleAutoComplete}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-[#111822] px-2 py-1 text-[11px] font-bold text-slate-300 hover:border-emerald-400/50 hover:text-emerald-200 cursor-pointer"
                  >
                    <FastForward className="w-3 h-3" />
                    자동 완성
                  </button>
                </div>

                <RouletteReelsView
                  hasSpun={draft.hasSpun}
                  reels={draft.reels}
                  legendRatePercent={Number((DEFAULT_ROULETTE_LEGEND_RATE * 100).toFixed(1))}
                  targetSubPosition={currentSlot?.subPosition ?? 'CM'}
                  managerTraitId={managerTraitId}
                  allowedLeagueIds={draftLeaguePool}
                  previewCandidate={previewCandidate}
                  onSelectPreviewCandidate={setPreviewCandidate}
                  previewSlotSynergy={previewSlotSynergy}
                  previewChemDelta={previewChemDelta}
                  onSpin={handleSpin}
                  onPickPlayer={handlePickPlayer}
                  pickActionLabel={currentSlot?.label ?? '영입'}
                />
              </div>
            )}
          </div>

          {/* Pitch (5 cols) */}
          <div className="lg:col-span-5 space-y-1.5 order-2 lg:order-1">
            <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-xl border border-slate-800/80 bg-[#0d131c] px-2.5 py-1.5 text-xs">
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
              {!isCompleted && selectedSlot && (
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
              tactic={defaultTactic}
              baselineStarters={previewCandidate ? starters : null}
              activeSlot={
                !isCompleted
                  ? {
                      area: draft.currentSlotType,
                      index: draft.currentSlotIndex,
                    }
                  : null
              }
              selectedSlot={selectedSlot}
              onSlotClick={handleSlotClick}
              onSlotSwap={handleSwapSlots}
              onInspectPlayer={(player, slotSubPosition) =>
                setInspected({ player, slotSubPosition })
              }
              showBench
              draftBenchHints={!isCompleted}
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
