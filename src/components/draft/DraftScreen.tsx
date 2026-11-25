import {
  ArrowLeftRight,
  FastForward,
  Wand2,
  Zap,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { BENCH_SLOTS, FORMATIONS } from '../../data/formations';
import { MANAGER_TRAITS } from '../../data/managerTraits';
import { PLAYSTYLES } from '../../data/playstyles';
import {
  calculateChemistry,
  calculateTeamRatings,
  evaluatePairLink,
} from '../../engine/chemistryEngine';
import { useGame } from '../../store/GameContext';
import { POSITION_LABELS } from '../../types/player';
import type { Player, SubPosition } from '../../types/player';
import { DraftBudgetBar } from '../common/DraftBudgetBar';
import { InfoHelpButton } from '../common/InfoHelpButton';
import { ManagerFitBadge } from '../common/ManagerFitBadge';
import { PitchBoard } from '../common/PitchBoard';
import type { SlotRef } from '../common/PitchBoard';
import { PixelManagerAvatar } from '../common/PixelManagerAvatar';
import { PlayerDetailModal } from '../common/PlayerDetailModal';
import { RouletteReelsView } from './RouletteReelsView';

export function DraftScreen() {
  const {
    state,
    chemistry,
    ratings,
    spinDraftRoulette,
    pickDraftPlayer,
    autoCompleteDraft,
    autoOptimizeLineup,
    swapSquadPositions,
  } = useGame();

  const [selectedSlot, setSelectedSlot] = useState<SlotRef | null>(null);
  const [previewCandidate, setPreviewCandidate] = useState<Player | null>(null);
  const [previewSwaps, setPreviewSwaps] = useState<[SlotRef, SlotRef][]>([]);
  const [inspected, setInspected] = useState<{
    player: Player;
    slotSubPosition?: SubPosition;
    slotIndex?: number;
  } | null>(null);

  const handleSelectPreviewCandidate = (candidate: Player | null) => {
    setPreviewCandidate(candidate);
    setPreviewSwaps([]);
    setSelectedSlot(null);
  };

  const { draft, formation, starters, bench } = state;
  const formationConfig = FORMATIONS[formation];
  const activeTrait = state.manager.traitId
    ? MANAGER_TRAITS[state.manager.traitId]
    : null;

  const isStarterPick = draft.currentSlotType === 'starter';
  const currentSlot = isStarterPick
    ? formationConfig.slots[draft.currentSlotIndex]
    : BENCH_SLOTS[draft.currentSlotIndex];

  const completedCount =
    starters.filter(Boolean).length + bench.filter(Boolean).length;
  const progressPct = Math.round((completedCount / 16) * 100);

  // Build live preview starters & bench + track candidate's moved slot across previewSwaps
  const { displayedStarters, displayedBench, previewCurrentSlot } = useMemo(() => {
    if (!previewCandidate) {
      return {
        displayedStarters: starters,
        displayedBench: bench,
        previewCurrentSlot: null as SlotRef | null,
      };
    }
    const nextStarters = [...starters];
    const nextBench = [...bench];
    if (isStarterPick) {
      nextStarters[draft.currentSlotIndex] = previewCandidate;
    } else {
      nextBench[draft.currentSlotIndex] = previewCandidate;
    }

    let trackedSlot: SlotRef = {
      area: draft.currentSlotType,
      index: draft.currentSlotIndex,
    };

    for (const [from, to] of previewSwaps) {
      const fromVal =
        from.area === 'starter'
          ? nextStarters[from.index]
          : nextBench[from.index];
      const toVal =
        to.area === 'starter' ? nextStarters[to.index] : nextBench[to.index];

      if (from.area === 'starter') nextStarters[from.index] = toVal;
      else nextBench[from.index] = toVal;

      if (to.area === 'starter') nextStarters[to.index] = fromVal;
      else nextBench[to.index] = fromVal;

      if (trackedSlot.area === from.area && trackedSlot.index === from.index) {
        trackedSlot = { ...to };
      } else if (
        trackedSlot.area === to.area &&
        trackedSlot.index === to.index
      ) {
        trackedSlot = { ...from };
      }
    }

    return {
      displayedStarters: nextStarters,
      displayedBench: nextBench,
      previewCurrentSlot: trackedSlot,
    };
  }, [
    previewCandidate,
    isStarterPick,
    starters,
    bench,
    draft.currentSlotType,
    draft.currentSlotIndex,
    previewSwaps,
  ]);

  const displayedChemistry = useMemo(() => {
    if (!previewCandidate) return chemistry;
    return calculateChemistry(
      formation,
      displayedStarters,
      state.defaultTactic,
      state.manager.traitId,
    );
  }, [
    previewCandidate,
    chemistry,
    formation,
    displayedStarters,
    state.defaultTactic,
    state.manager.traitId,
  ]);

  const displayedRatings = useMemo(() => {
    if (!previewCandidate) return ratings;
    return calculateTeamRatings(
      formation,
      displayedStarters.filter((p): p is Player => p !== null),
      displayedChemistry.total,
      state.manager.traitId,
      displayedChemistry.slotSynergies,
      state.defaultTactic,
    );
  }, [
    previewCandidate,
    ratings,
    formation,
    displayedStarters,
    displayedChemistry,
    state.manager.traitId,
    state.defaultTactic,
  ]);

  const previewSlotSynergy =
    previewCandidate && previewCurrentSlot?.area === 'starter'
      ? (displayedChemistry.slotSynergies[previewCurrentSlot.index] ?? null)
      : null;
  const previewChemDelta = previewCandidate
    ? displayedChemistry.total - chemistry.total
    : 0;

  const expectedLinksByPlayerId = useMemo(() => {
    const out: Record<string, number> = {};
    if (!isStarterPick || !draft.hasSpun || draft.reels.length === 0) return out;
    const targetIdx = draft.currentSlotIndex;
    const neighborPlayers: Player[] = [];
    for (const [fromIdx, toIdx] of formationConfig.links) {
      const otherIdx =
        fromIdx === targetIdx ? toIdx : toIdx === targetIdx ? fromIdx : -1;
      if (otherIdx === -1) continue;
      const neighbor = starters[otherIdx];
      if (neighbor) neighborPlayers.push(neighbor);
    }
    if (neighborPlayers.length === 0) return out;
    for (const reel of draft.reels) {
      for (const cand of reel.candidates) {
        let sum = 0;
        for (const neighbor of neighborPlayers) {
          sum += evaluatePairLink(
            cand,
            neighbor,
            state.defaultTactic,
            state.manager.traitId,
          ).score;
        }
        out[cand.id] = sum;
      }
    }
    return out;
  }, [
    isStarterPick,
    draft.hasSpun,
    draft.reels,
    draft.currentSlotIndex,
    formationConfig.links,
    starters,
    state.defaultTactic,
    state.manager.traitId,
  ]);

  const isActiveDraftSlot = (area: 'starter' | 'bench', index: number) =>
    !draft.completed &&
    draft.hasSpun &&
    area === draft.currentSlotType &&
    index === draft.currentSlotIndex;

  const handleSlotClick = (area: 'starter' | 'bench', index: number) => {
    const clickedPlayer =
      area === 'starter' ? displayedStarters[index] : displayedBench[index];

    if (!selectedSlot) {
      if (!clickedPlayer) return;
      setSelectedSlot({ area, index });
      return;
    }

    if (selectedSlot.area === area && selectedSlot.index === index) {
      setSelectedSlot(null);
      return;
    }

    if (previewCandidate) {
      // Live preview-mode swap without committing until user confirms pick!
      setPreviewSwaps((prev) => [...prev, [selectedSlot, { area, index }]]);
      setSelectedSlot(null);
      return;
    }

    if (
      isActiveDraftSlot(selectedSlot.area, selectedSlot.index) ||
      isActiveDraftSlot(area, index)
    ) {
      setSelectedSlot(null);
      return;
    }

    swapSquadPositions(selectedSlot, { area, index });
    setSelectedSlot(null);
  };

  const handleSlotSwap = (from: SlotRef, to: SlotRef) => {
    if (previewCandidate) {
      setPreviewSwaps((prev) => [...prev, [from, to]]);
      setSelectedSlot(null);
      return;
    }
    if (
      isActiveDraftSlot(from.area, from.index) ||
      isActiveDraftSlot(to.area, to.index)
    ) {
      setSelectedSlot(null);
      return;
    }
    swapSquadPositions(from, to);
    setSelectedSlot(null);
  };

  return (
    <div className="mx-auto max-w-6xl px-2.5 sm:px-4 py-2.5 sm:py-5 space-y-2.5 sm:space-y-3.5">
      <DraftBudgetBar
        players={[...starters, ...bench]}
        previewPlayer={previewCandidate}
        compact
      />
      {/* Compact Manager Strip + ? Help Popovers */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 rounded-xl sm:rounded-2xl border border-slate-800/90 bg-[#0e141d] px-2.5 py-1.5 sm:px-3.5 sm:py-2.5">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
          <div className="flex h-6 w-5 sm:h-7 sm:w-6 shrink-0 items-center justify-center rounded-md border border-slate-800 bg-[#090d14]">
            <PixelManagerAvatar
              avatar={state.manager.avatar}
              clubPrimaryColor={state.userClub.primaryColor}
              clubSecondaryColor={state.userClub.secondaryColor}
              size={18}
            />
          </div>
          <span className="truncate text-[11px] sm:text-xs font-extrabold text-white">
            {state.manager.name}
          </span>
          {state.manager.traitId && (
            <ManagerFitBadge
              traitId={state.manager.traitId}
              starters={displayedStarters}
              baselineStarters={previewCandidate ? state.starters : null}
              tactic={state.defaultTactic}
              formation={formation}
              variant="pill"
              align="left"
            />
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {activeTrait && (
            <InfoHelpButton
              title={`${state.manager.name} · ${activeTrait.name}`}
              label="감독 팁"
              size="xs"
              align="right"
              guideTab="chemistry"
            >
              <p className="text-[11px] leading-relaxed text-slate-300 mb-2">
                {activeTrait.draftGuideTip}
              </p>
              <div className="flex flex-wrap gap-1">
                {activeTrait.synergyPlaystyles.map((ps) => (
                  <span
                    key={ps}
                    className="rounded border border-amber-400/35 bg-amber-500/12 px-1.5 py-0.5 text-[10px] font-bold text-amber-200"
                  >
                    {PLAYSTYLES[ps]?.name ?? ps}
                  </span>
                ))}
                {activeTrait.id === 'galactico_manager' && (
                  <span className="rounded border border-cyan-400/40 bg-cyan-500/15 px-1.5 py-0.5 text-[10px] font-bold text-cyan-200">
                    OVR 90+ · 레전드
                  </span>
                )}
                {activeTrait.id === 'total_football' && (
                  <span className="rounded border border-sky-400/40 bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-bold text-sky-200">
                    3포지션+ 멀티
                  </span>
                )}
                {activeTrait.id === 'super_sub' && (
                  <span className="rounded border border-pink-400/40 bg-pink-500/15 px-1.5 py-0.5 text-[10px] font-bold text-pink-200">
                    STA 86+
                  </span>
                )}
              </div>
            </InfoHelpButton>
          )}

          <InfoHelpButton
            title="시너지 4원칙 · 감독 궁합 · 팀 케미"
            label="공식"
            size="xs"
            align="right"
            guideTab="chemistry"
            items={[
              '🟢 구단·전소속 / 🔵 국적 / 🟡 스타일 / 🟣 엘리트 88+ — 모든 연결선 1선 = 1점 통일',
              '개인 인접 시너지: 2선(+1) · 4선(+2) · 8선(+3)',
              '★ 감독 궁합(독립): 일치 선수 모두 별도 +1 → 개인 합산 최대 +4 OVR',
              '팀 케미(0~100): 연결선 단조 증가(-1.5~+2.5, 개별 시너지와 중복 차단 후 팀 조직력 최대 +0.8 추가)',
            ]}
          />
        </div>
      </div>

      {/* Compact Draft Progress Bar */}
      <div className="rounded-xl sm:rounded-2xl border border-slate-800/90 bg-[#0e141d] px-3 py-2 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[11px] sm:text-xs font-bold text-emerald-300 tabular-nums">
              {isStarterPick
                ? `선발 ${draft.currentSlotIndex + 1}/11`
                : `벤치 ${draft.currentSlotIndex + 1}/5`}
            </span>
            <h1 className="text-xs sm:text-base font-extrabold text-white">
              {currentSlot.label} ({POSITION_LABELS[currentSlot.position]})
            </h1>
            <InfoHelpButton
              title="드래프트 조작"
              align="left"
              guideTab="basics"
              items={[
                '후보 1회 클릭: 포메이션 임시 배치(시너지·팀 케미 실시간 프리뷰)',
                '카드 우측 [🔗 N선] 배지: 현재 슬롯 배치 시 바로 생기는 연결선 수',
                '[영입 확정] 또는 재클릭 시 영입 완료 · 피치/벤치 자유 교환 가능',
              ]}
            />
          </div>

          <button
            id="auto-draft-btn"
            type="button"
            onClick={() => {
              setPreviewCandidate(null);
              autoCompleteDraft();
            }}
            className="inline-flex items-center gap-1 rounded-lg sm:rounded-xl border border-slate-700/80 bg-[#0a0f17] px-2.5 py-1 sm:px-3 sm:py-1.5 text-[11px] sm:text-xs font-semibold text-slate-300 hover:border-emerald-500/50 hover:text-emerald-300 transition-colors cursor-pointer shrink-0 touch-manipulation"
          >
            <FastForward className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            자동 완성
          </button>
        </div>

        <div className="mt-1.5 sm:mt-2.5">
          <div className="mb-1 flex items-center justify-between text-[10px] sm:text-[11px] tabular-nums">
            <span className="text-slate-400">{completedCount} / 16</span>
            <span className="font-semibold text-emerald-400">{progressPct}%</span>
          </div>
          <div className="h-1 sm:h-1.5 w-full overflow-hidden rounded-full bg-slate-900">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main 2-Column Layout */}
      <div className="grid grid-cols-1 gap-2.5 sm:gap-3.5 lg:grid-cols-12 items-start">
        {/* Right/Top: Roulette & Candidates (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-2 order-1 lg:order-2">
          <div className="rounded-xl sm:rounded-2xl border border-slate-800 bg-[#111822] p-2 sm:p-2.5">
            <RouletteReelsView
              key={`${draft.currentSlotType}-${draft.currentSlotIndex}`}
              hasSpun={draft.hasSpun}
              reels={draft.reels}
              legendRatePercent={2.5}
              targetSubPosition={currentSlot.subPosition}
              managerTraitId={state.manager.traitId}
              allowedLeagueIds={state.draftLeaguePool}
              previewCandidate={previewCandidate}
              onSelectPreviewCandidate={handleSelectPreviewCandidate}
              previewSlotSynergy={previewSlotSynergy}
              previewChemDelta={previewChemDelta}
              expectedLinksByPlayerId={expectedLinksByPlayerId}
              onSpin={() => {
                setPreviewCandidate(null);
                setPreviewSwaps([]);
                setSelectedSlot(null);
                spinDraftRoulette();
              }}
              onPickPlayer={(p) => {
                const swapsToCommit = [...previewSwaps];
                setPreviewCandidate(null);
                setPreviewSwaps([]);
                setSelectedSlot(null);
                pickDraftPlayer(p);
                for (const [from, to] of swapsToCommit) {
                  swapSquadPositions(from, to);
                }
              }}
              pickActionLabel="영입"
            />
          </div>

          {/* Live Team Ratings Strip (reflects previewCandidate in real time) */}
          <div className="grid grid-cols-4 gap-1.5 tabular-nums">
            <div className="rounded-xl border border-slate-800 bg-[#111822] p-1.5 sm:py-2 text-center">
              <div className="text-[10px] text-slate-400">ATT</div>
              <div className="font-display text-sm sm:text-base font-bold text-white">
                {displayedRatings.att || '-'}
                {previewCandidate &&
                  displayedRatings.att !== ratings.att &&
                  ratings.att > 0 && (
                    <span
                      className={`ml-0.5 text-[10px] ${
                        displayedRatings.att > ratings.att
                          ? 'text-emerald-300'
                          : 'text-amber-300'
                      }`}
                    >
                      ({displayedRatings.att > ratings.att ? '+' : ''}
                      {displayedRatings.att - ratings.att})
                    </span>
                  )}
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#111822] p-1.5 sm:py-2 text-center">
              <div className="text-[10px] text-slate-400">MID</div>
              <div className="font-display text-sm sm:text-base font-bold text-white">
                {displayedRatings.mid || '-'}
                {previewCandidate &&
                  displayedRatings.mid !== ratings.mid &&
                  ratings.mid > 0 && (
                    <span
                      className={`ml-0.5 text-[10px] ${
                        displayedRatings.mid > ratings.mid
                          ? 'text-emerald-300'
                          : 'text-amber-300'
                      }`}
                    >
                      ({displayedRatings.mid > ratings.mid ? '+' : ''}
                      {displayedRatings.mid - ratings.mid})
                    </span>
                  )}
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#111822] p-1.5 sm:py-2 text-center">
              <div className="text-[10px] text-slate-400">DEF</div>
              <div className="font-display text-sm sm:text-base font-bold text-white">
                {displayedRatings.def || '-'}
                {previewCandidate &&
                  displayedRatings.def !== ratings.def &&
                  ratings.def > 0 && (
                    <span
                      className={`ml-0.5 text-[10px] ${
                        displayedRatings.def > ratings.def
                          ? 'text-emerald-300'
                          : 'text-amber-300'
                      }`}
                    >
                      ({displayedRatings.def > ratings.def ? '+' : ''}
                      {displayedRatings.def - ratings.def})
                    </span>
                  )}
              </div>
            </div>
            <div
              className={`rounded-xl border p-1.5 sm:py-2 text-center ${
                previewCandidate
                  ? 'border-emerald-400/50 bg-emerald-950/20'
                  : 'border-emerald-500/25 bg-[#111822]'
              }`}
            >
              <div className="flex items-center justify-center gap-0.5 text-[10px] text-emerald-300">
                <Zap className="w-2.5 h-2.5" />
                케미 ({displayedChemistry.chemistryOvrBonus >= 0 ? '+' : ''}
                {displayedChemistry.chemistryOvrBonus.toFixed(1)})
              </div>
              <div className="font-display text-sm sm:text-base font-bold text-emerald-300">
                {displayedChemistry.total}
                {previewCandidate && previewChemDelta !== 0 && (
                  <span
                    className={`ml-0.5 text-[10px] ${
                      previewChemDelta > 0 ? 'text-emerald-200' : 'text-rose-300'
                    }`}
                  >
                    ({previewChemDelta > 0 ? '+' : ''}
                    {previewChemDelta})
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Left: Interactive Live Pitch with Free Swapping & Quick Lineup (5 cols) */}
        <div className="lg:col-span-5 order-2 lg:order-1 space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-1.5 px-1 text-[11px]">
            <span className="inline-flex items-center gap-1 font-semibold text-slate-300 truncate">
              <ArrowLeftRight className="w-3 h-3 text-emerald-400 shrink-0" />
              {selectedSlot
                ? '이동/교환할 슬롯 클릭'
                : previewCandidate
                  ? `프리뷰(${previewCandidate.name}): 클릭으로 자리 이동`
                  : '클릭·드래그 교환 / 우클릭·ⓘ 상세'}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              {previewCandidate && previewSwaps.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setPreviewSwaps([]);
                    setSelectedSlot(null);
                  }}
                  className="rounded-md border border-sky-400/40 bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold text-sky-200 hover:bg-sky-500/25 cursor-pointer"
                >
                  배치 원복
                </button>
              )}
              {selectedSlot && (
                <button
                  type="button"
                  onClick={() => setSelectedSlot(null)}
                  className="text-amber-300 hover:underline cursor-pointer"
                >
                  취소
                </button>
              )}
              {completedCount >= 2 && (
                <button
                  type="button"
                  disabled={draft.hasSpun}
                  onClick={() => {
                    if (draft.hasSpun) return;
                    setPreviewCandidate(null);
                    setPreviewSwaps([]);
                    setSelectedSlot(null);
                    autoOptimizeLineup();
                  }}
                  title={
                    draft.hasSpun
                      ? '현재 룰렛 영입 확정 후 사용할 수 있습니다'
                      : '현재 보유 선수들의 실효 OVR과 케미를 자동 최적화합니다'
                  }
                  className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10.5px] font-bold transition-colors ${
                    draft.hasSpun
                      ? 'border-slate-700/70 bg-slate-900/60 text-slate-500 cursor-not-allowed'
                      : 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 cursor-pointer'
                  }`}
                >
                  <Wand2 className="w-3 h-3" />
                  빠른 선발
                </button>
              )}
            </div>
          </div>

          <PitchBoard
            formation={formation}
            starters={displayedStarters}
            bench={displayedBench}
            chemistry={displayedChemistry}
            managerTraitId={state.manager.traitId}
            tactic={state.defaultTactic}
            baselineStarters={previewCandidate ? state.starters : null}
            activeSlot={{
              area: draft.currentSlotType,
              index: draft.currentSlotIndex,
            }}
            previewSlot={previewCurrentSlot}
            selectedSlot={selectedSlot}
            onSlotClick={handleSlotClick}
            onSlotSwap={handleSlotSwap}
            onInspectPlayer={(player, slotSubPosition) =>
              setInspected({ player, slotSubPosition })
            }
            showBench
            draftBenchHints
            showChemBreakdown
            compact
          />
        </div>
      </div>

      {/* Mobile Sticky Confirm Bar when previewing a candidate */}
      {previewCandidate && (
        <div className="lg:hidden sticky bottom-2 z-30 flex items-center justify-between gap-2 rounded-xl border border-emerald-400/60 bg-[#0b1518] px-3 py-2 shadow-2xl">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-xs font-extrabold text-white">
                {previewCandidate.name}
              </span>
              <span className="font-mono text-[11px] font-bold text-amber-300 shrink-0">
                {previewCandidate.ovr}
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
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => handleSelectPreviewCandidate(null)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[11px] font-bold text-slate-300 cursor-pointer touch-manipulation"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => {
                const swapsToCommit = [...previewSwaps];
                const picked = previewCandidate;
                setPreviewCandidate(null);
                setPreviewSwaps([]);
                setSelectedSlot(null);
                pickDraftPlayer(picked);
                for (const [from, to] of swapsToCommit) {
                  swapSquadPositions(from, to);
                }
              }}
              className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-black text-slate-950 hover:bg-emerald-400 cursor-pointer touch-manipulation"
            >
              영입 확정
            </button>
          </div>
        </div>
      )}

      <PlayerDetailModal
        player={inspected?.player ?? null}
        slotSubPosition={inspected?.slotSubPosition}
        slotSynergy={
          inspected?.player
            ? Object.values(displayedChemistry.slotSynergies).find(
                (s) => s.playerId === inspected.player.id,
              ) ?? null
            : null
        }
        managerTraitId={state.manager.traitId}
        onClose={() => setInspected(null)}
      />
    </div>
  );
}
