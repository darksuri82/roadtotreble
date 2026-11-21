import {
  ArrowLeftRight,
  ChevronDown,
  ChevronUp,
  FastForward,
  Star,
  Wand2,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { BENCH_SLOTS, FORMATIONS } from '../../data/formations';
import { MANAGER_TRAITS } from '../../data/managerTraits';
import { PLAYSTYLES } from '../../data/playstyles';
import { TACTICS } from '../../engine/tacticEngine';
import { useGame } from '../../store/GameContext';
import { POSITION_LABELS } from '../../types/player';
import type { Player, SubPosition } from '../../types/player';
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
  const [guideOpen, setGuideOpen] = useState(true);
  const [inspected, setInspected] = useState<{
    player: Player;
    slotSubPosition?: SubPosition;
    slotIndex?: number;
  } | null>(null);

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

  const handleSlotClick = (area: 'starter' | 'bench', index: number) => {
    const clickedPlayer = area === 'starter' ? starters[index] : bench[index];

    if (!selectedSlot) {
      // Only start a swap from a slot that actually holds a player
      if (!clickedPlayer) return;
      setSelectedSlot({ area, index });
      return;
    }

    if (selectedSlot.area === area && selectedSlot.index === index) {
      setSelectedSlot(null);
      return;
    }

    swapSquadPositions(selectedSlot, { area, index });
    setSelectedSlot(null);
  };

  const handleSlotSwap = (from: SlotRef, to: SlotRef) => {
    swapSquadPositions(from, to);
    setSelectedSlot(null);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-5 space-y-4">
      {/* Collapsible Manager Synergy Guide Bar */}
      {activeTrait && (
        <div className="rounded-2xl border border-amber-400/35 bg-gradient-to-r from-amber-950/25 via-[#111822] to-[#111822] overflow-hidden">
          <button
            type="button"
            onClick={() => setGuideOpen((o) => !o)}
            className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-amber-500/5 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-7 shrink-0 items-center justify-center rounded-lg border border-amber-400/30 bg-[#0b1018]">
                <PixelManagerAvatar
                  avatar={state.manager.avatar}
                  clubPrimaryColor={state.userClub.primaryColor}
                  clubSecondaryColor={state.userClub.secondaryColor}
                  size={22}
                />
              </div>
              <span className="inline-flex items-center gap-1 rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-black text-amber-200 shrink-0">
                <Star className="w-3 h-3 fill-amber-300 text-amber-300" />
                내 감독 추천 선수 스타일
              </span>
              <span className="truncate text-xs font-extrabold text-white">
                {state.manager.name} · {activeTrait.name}
              </span>
              {activeTrait.synergyTactic && (
                <span className="hidden sm:inline-block rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300 shrink-0">
                  추천 전술: {TACTICS[activeTrait.synergyTactic].name}
                </span>
              )}
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300 shrink-0">
              {guideOpen ? '접기' : '펼치기'}
              {guideOpen ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </span>
          </button>

          {guideOpen && (
            <div className="border-t border-amber-500/20 px-4 py-3 space-y-2">
              <p className="text-xs leading-relaxed text-slate-300">
                {activeTrait.draftGuideTip}{' '}
                <span className="text-amber-300 font-semibold">
                  (⭐ 감독 시너지 배지 선수는 선발 배치 시 개인 OVR +1 상승!)
                </span>
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-400">
                  핵심 시너지 스타일:
                </span>
                {activeTrait.synergyPlaystyles.map((ps) => (
                  <span
                    key={ps}
                    className="rounded-md border border-amber-400/35 bg-amber-500/12 px-2 py-0.5 text-[10px] font-bold text-amber-200"
                  >
                    {PLAYSTYLES[ps]?.name ?? ps}
                  </span>
                ))}
                {activeTrait.id === 'galactico_manager' && (
                  <span className="rounded-md border border-cyan-400/40 bg-cyan-500/15 px-2 py-0.5 text-[10px] font-bold text-cyan-200">
                    OVR 88+ 스타 · 레전드
                  </span>
                )}
                {activeTrait.id === 'total_football' && (
                  <span className="rounded-md border border-sky-400/40 bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold text-sky-200">
                    3포지션+ 멀티플레이어
                  </span>
                )}
                {activeTrait.id === 'super_sub' && (
                  <span className="rounded-md border border-pink-400/40 bg-pink-500/15 px-2 py-0.5 text-[10px] font-bold text-pink-200">
                    고체력 (STA 86+)
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Compact Draft Progress Bar */}
      <div className="rounded-2xl border border-slate-800 bg-[#111822] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-300">
                {isStarterPick
                  ? `선발 ${draft.currentSlotIndex + 1} / 11`
                  : `벤치 ${draft.currentSlotIndex + 1} / 5`}
              </span>
              <h1 className="text-base sm:text-lg font-extrabold text-white">
                {currentSlot.label} ({POSITION_LABELS[currentSlot.position]}) 드래프트
              </h1>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              3개 구단(각 3명 · LEGEND 1명 단독) 중 1명을 영입하세요. 배치된 선수는 클릭·드래그로 교환, 우클릭·ⓘ로 상세 정보를 볼 수 있습니다.
            </p>
          </div>

          <button
            id="auto-draft-btn"
            type="button"
            onClick={autoCompleteDraft}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-emerald-500/50 hover:text-emerald-300 transition-colors cursor-pointer shrink-0"
          >
            <FastForward className="w-3.5 h-3.5" />
            나머지 자동 완성
          </button>
        </div>

        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-[11px] tabular-nums">
            <span className="text-slate-400">스쿼드 진행도 ({completedCount} / 16)</span>
            <span className="font-semibold text-emerald-400">{progressPct}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-900">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main 2-Column Layout */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Right/Top: Roulette & Candidates (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4 order-1 lg:order-2">
          <div className="rounded-2xl border border-slate-800 bg-[#111822] p-4">
            <RouletteReelsView
              key={`${draft.currentSlotType}-${draft.currentSlotIndex}`}
              hasSpun={draft.hasSpun}
              reels={draft.reels}
              legendRatePercent={2.5}
              targetSubPosition={currentSlot.subPosition}
              managerTraitId={state.manager.traitId}
              allowedLeagueIds={state.draftLeaguePool}
              onSpin={spinDraftRoulette}
              onPickPlayer={(p) => {
                setSelectedSlot(null);
                pickDraftPlayer(p);
              }}
              pickActionLabel="영입"
            />
          </div>

          {/* Live Team Ratings Strip */}
          <div className="grid grid-cols-4 gap-2.5 tabular-nums">
            <div className="rounded-xl border border-slate-800 bg-[#111822] p-3 text-center">
              <div className="text-[11px] text-slate-400">ATT</div>
              <div className="font-display text-xl font-bold text-white">
                {ratings.att || '-'}
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#111822] p-3 text-center">
              <div className="text-[11px] text-slate-400">MID</div>
              <div className="font-display text-xl font-bold text-white">
                {ratings.mid || '-'}
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#111822] p-3 text-center">
              <div className="text-[11px] text-slate-400">DEF</div>
              <div className="font-display text-xl font-bold text-white">
                {ratings.def || '-'}
              </div>
            </div>
            <div className="rounded-xl border border-emerald-500/25 bg-[#111822] p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-[11px] text-emerald-300">
                <Zap className="w-3 h-3" />
                케미 ({chemistry.chemistryOvrBonus >= 0 ? '+' : ''}
                {chemistry.chemistryOvrBonus.toFixed(1)})
              </div>
              <div className="font-display text-xl font-bold text-emerald-300">
                {chemistry.total}
              </div>
            </div>
          </div>
        </div>

        {/* Left: Interactive Live Pitch with Free Swapping & Quick Lineup (5 cols) */}
        <div className="lg:col-span-5 order-2 lg:order-1 space-y-2">
          <div className="flex items-center justify-between gap-2 px-1 text-xs">
            <span className="inline-flex items-center gap-1.5 font-semibold text-slate-300 truncate">
              <ArrowLeftRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              {selectedSlot
                ? '이동/교환할 슬롯 클릭'
                : '클릭·드래그 교환 / 우클릭·ⓘ 상세'}
            </span>
            <div className="flex items-center gap-2 shrink-0">
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
                  onClick={() => {
                    setSelectedSlot(null);
                    autoOptimizeLineup();
                  }}
                  title="현재 보유 선수들의 실효 OVR과 케미를 자동 최적화합니다"
                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/25 cursor-pointer"
                >
                  <Wand2 className="w-3 h-3" />
                  빠른 선발
                </button>
              )}
            </div>
          </div>

          <PitchBoard
            formation={formation}
            starters={starters}
            bench={bench}
            chemistry={chemistry}
            managerTraitId={state.manager.traitId}
            activeSlot={{
              area: draft.currentSlotType,
              index: draft.currentSlotIndex,
            }}
            selectedSlot={selectedSlot}
            onSlotClick={handleSlotClick}
            onSlotSwap={handleSlotSwap}
            onInspectPlayer={(player, slotSubPosition) =>
              setInspected({ player, slotSubPosition })
            }
            showBench
            showChemBreakdown
          />
        </div>
      </div>

      <PlayerDetailModal
        player={inspected?.player ?? null}
        slotSubPosition={inspected?.slotSubPosition}
        slotSynergy={
          inspected?.player
            ? Object.values(chemistry.slotSynergies).find(
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
