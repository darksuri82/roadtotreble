import {
  ArrowLeftRight,
  BookOpen,
  ChevronDown,
  ChevronUp,
  FastForward,
  Star,
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
} from '../../engine/chemistryEngine';
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
  const [guideTab, setGuideTab] = useState<'manager' | 'formula'>('manager');
  const [previewCandidate, setPreviewCandidate] = useState<Player | null>(null);
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

  // Build live preview starters & bench when a candidate is clicked once
  const displayedStarters = useMemo(() => {
    if (!previewCandidate || !isStarterPick) return starters;
    const next = [...starters];
    next[draft.currentSlotIndex] = previewCandidate;
    return next;
  }, [previewCandidate, isStarterPick, starters, draft.currentSlotIndex]);

  const displayedBench = useMemo(() => {
    if (!previewCandidate || isStarterPick) return bench;
    const next = [...bench];
    next[draft.currentSlotIndex] = previewCandidate;
    return next;
  }, [previewCandidate, isStarterPick, bench, draft.currentSlotIndex]);

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
    );
  }, [
    previewCandidate,
    ratings,
    formation,
    displayedStarters,
    displayedChemistry,
    state.manager.traitId,
  ]);

  const previewSlotSynergy =
    previewCandidate && isStarterPick
      ? (displayedChemistry.slotSynergies[draft.currentSlotIndex] ?? null)
      : null;
  const previewChemDelta = previewCandidate
    ? displayedChemistry.total - chemistry.total
    : 0;

  const handleSlotClick = (area: 'starter' | 'bench', index: number) => {
    const clickedPlayer = area === 'starter' ? starters[index] : bench[index];

    if (!selectedSlot) {
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
      {/* Collapsible Manager Synergy & Systematic Synergy Formula Guide Panel */}
      <div className="rounded-2xl border border-amber-400/35 bg-gradient-to-r from-amber-950/25 via-[#111822] to-[#111822] overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <div className="flex h-8 w-7 shrink-0 items-center justify-center rounded-lg border border-amber-400/30 bg-[#0b1018]">
              <PixelManagerAvatar
                avatar={state.manager.avatar}
                clubPrimaryColor={state.userClub.primaryColor}
                clubSecondaryColor={state.userClub.secondaryColor}
                size={22}
              />
            </div>

            {/* Guide Mode Switcher Tabs */}
            <div className="inline-flex items-center rounded-xl border border-slate-800 bg-[#0b1018] p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => {
                  setGuideTab('manager');
                  setGuideOpen(true);
                }}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-extrabold transition-colors cursor-pointer ${
                  guideOpen && guideTab === 'manager'
                    ? 'bg-amber-400 text-slate-950'
                    : 'text-amber-200/85 hover:text-white'
                }`}
              >
                <Star className="w-3 h-3" />
                내 감독 추천 스타일
              </button>
              <button
                type="button"
                onClick={() => {
                  setGuideTab('formula');
                  setGuideOpen(true);
                }}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-extrabold transition-colors cursor-pointer ${
                  guideOpen && guideTab === 'formula'
                    ? 'bg-emerald-400 text-slate-950'
                    : 'text-emerald-300/90 hover:text-white'
                }`}
              >
                <BookOpen className="w-3 h-3" />
                시너지 &amp; OVR 상승 공식 가이드
              </button>
            </div>

            {activeTrait && (
              <span className="hidden md:inline-block truncate text-xs font-extrabold text-white">
                {state.manager.name} · {activeTrait.name}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setGuideOpen((o) => !o)}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300 hover:text-amber-200 cursor-pointer shrink-0"
          >
            {guideOpen ? '접기' : '가이드 펼치기'}
            {guideOpen ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {guideOpen && (
          <div className="border-t border-amber-500/20 px-4 py-3">
            {guideTab === 'manager' && activeTrait ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-extrabold text-white">
                    {state.manager.name} ({activeTrait.name})
                  </span>
                  {activeTrait.synergyTactic && (
                    <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                      추천 전술: {TACTICS[activeTrait.synergyTactic].name}
                    </span>
                  )}
                  <span className="text-[11px] font-semibold text-amber-300">
                    · ⭐ 감독 시너지 배지 선수는 선발 배치 시 개인 OVR +1 즉시 상승
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-slate-300">
                  {activeTrait.draftGuideTip}
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400">
                    핵심 시너지 조건:
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
            ) : (
              /* Systematic 100% Code-Accurate Synergy & OVR Formula Table */
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-12 text-xs">
                <div className="lg:col-span-7 rounded-xl border border-slate-800 bg-[#0b1018]/90 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-extrabold text-emerald-300">
                      ① 선발 선수 개인 시너지 OVR 상승 (최대 +3 · 실제 경기 스탯 반영)
                    </span>
                    <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-200">
                      피치 녹색 +1 ~ +3 배지
                    </span>
                  </div>
                  <ul className="space-y-1.5 text-[11px] text-slate-300 leading-relaxed">
                    <li>
                      • <strong className="text-amber-300">⭐ 감독 시너지 (+1 OVR)</strong>: 내 감독 추천 플레이스타일 또는 특성 조건(갈락티코 OVR 88+/레전드, 토탈풋볼 3포지션+, 슈퍼서브 체력 86+) 일치 시 <strong className="text-white">+1</strong>
                    </li>
                    <li>
                      • <strong className="text-emerald-300">🔗 인접 팀원 케미 (+1 ~ +2 OVR)</strong>: 포메이션 연결선으로 이어진 이웃 선수들과의 연결 점수 합산
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                        <span className="rounded bg-emerald-500/15 border border-emerald-400/35 px-1.5 py-0.5 text-emerald-200 font-bold">
                          🟢 동일 구단 +1.6점
                        </span>
                        <span className="rounded bg-amber-500/15 border border-amber-400/35 px-1.5 py-0.5 text-amber-200 font-bold">
                          👑 레전드 와일드카드 +1.2점
                        </span>
                        <span className="rounded bg-sky-500/15 border border-sky-400/35 px-1.5 py-0.5 text-sky-200 font-bold">
                          🔵 동일 국적 +1.1점
                        </span>
                        <span className="rounded bg-amber-400/15 border border-amber-300/35 px-1.5 py-0.5 text-amber-100 font-bold">
                          🟡 보완 스타일·전술 동반 +1.0점
                        </span>
                      </div>
                    </li>
                    <li className="text-[10px] text-slate-400">
                      ↳ <strong className="text-emerald-300">+1 조건</strong>: 인접 연결 합계 <strong className="text-slate-200">1.6점+</strong> (즉, 동일 구단 1명만 연결돼도 즉시 +1) 또는 (국적+스타일 연결) 2개+
                      <br />↳ <strong className="text-emerald-300">+2 조건</strong>: 인접 연결 합계 <strong className="text-slate-200">4.2점+</strong> 또는 (평균 1.75점+ &amp; 2연결+) 또는 (구단 2개+ &amp; 국적·스타일 2개+)
                    </li>
                  </ul>
                </div>

                <div className="lg:col-span-5 rounded-xl border border-slate-800 bg-[#0b1018]/90 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-extrabold text-sky-300">
                      ② 팀 전체 케미스트리 (0~100점)
                    </span>
                    <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-bold text-sky-200">
                      팀 OVR -1.5 ~ +2.5
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-[10px] tabular-nums">
                    <div className="rounded-lg border border-slate-800/90 bg-slate-950/70 px-2 py-1.5">
                      <div className="text-emerald-300 font-bold">동일 구단·레전드</div>
                      <div className="text-slate-300">최대 25점 (인접 가중)</div>
                    </div>
                    <div className="rounded-lg border border-slate-800/90 bg-slate-950/70 px-2 py-1.5">
                      <div className="text-sky-300 font-bold">동일 국적</div>
                      <div className="text-slate-300">최대 20점 (인접 가중)</div>
                    </div>
                    <div className="rounded-lg border border-slate-800/90 bg-slate-950/70 px-2 py-1.5">
                      <div className="text-amber-300 font-bold">전술·스타일·감독</div>
                      <div className="text-slate-300">최대 40점 (궁합 보너스)</div>
                    </div>
                    <div className="rounded-lg border border-slate-800/90 bg-slate-950/70 px-2 py-1.5">
                      <div className="text-slate-300 font-bold">역할 균형</div>
                      <div className="text-slate-400">최대 15점 (공·중·수 조화)</div>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    💡 후보 카드를 <strong className="text-emerald-300">1번 클릭</strong>하면 왼쪽 피치에 임시 배치되어 연결선과 <strong className="text-emerald-300">+OVR 상승량</strong>이 즉시 계산됩니다!
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

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
              후보 1회 클릭 시 포메이션 임시 배치(시너지 실시간 프리뷰) · [영입 확정] 또는 재클릭 시 영입 완료
            </p>
          </div>

          <button
            id="auto-draft-btn"
            type="button"
            onClick={() => {
              setPreviewCandidate(null);
              autoCompleteDraft();
            }}
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
              previewCandidate={previewCandidate}
              onSelectPreviewCandidate={setPreviewCandidate}
              previewSlotSynergy={previewSlotSynergy}
              previewChemDelta={previewChemDelta}
              onSpin={() => {
                setPreviewCandidate(null);
                spinDraftRoulette();
              }}
              onPickPlayer={(p) => {
                setPreviewCandidate(null);
                setSelectedSlot(null);
                pickDraftPlayer(p);
              }}
              pickActionLabel="영입"
            />
          </div>

          {/* Live Team Ratings Strip (reflects previewCandidate in real time) */}
          <div className="grid grid-cols-4 gap-2.5 tabular-nums">
            <div className="rounded-xl border border-slate-800 bg-[#111822] p-3 text-center">
              <div className="text-[11px] text-slate-400">ATT</div>
              <div className="font-display text-xl font-bold text-white">
                {displayedRatings.att || '-'}
                {previewCandidate &&
                  displayedRatings.att !== ratings.att &&
                  ratings.att > 0 && (
                    <span
                      className={`ml-1 text-xs ${
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
            <div className="rounded-xl border border-slate-800 bg-[#111822] p-3 text-center">
              <div className="text-[11px] text-slate-400">MID</div>
              <div className="font-display text-xl font-bold text-white">
                {displayedRatings.mid || '-'}
                {previewCandidate &&
                  displayedRatings.mid !== ratings.mid &&
                  ratings.mid > 0 && (
                    <span
                      className={`ml-1 text-xs ${
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
            <div className="rounded-xl border border-slate-800 bg-[#111822] p-3 text-center">
              <div className="text-[11px] text-slate-400">DEF</div>
              <div className="font-display text-xl font-bold text-white">
                {displayedRatings.def || '-'}
                {previewCandidate &&
                  displayedRatings.def !== ratings.def &&
                  ratings.def > 0 && (
                    <span
                      className={`ml-1 text-xs ${
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
              className={`rounded-xl border p-3 text-center ${
                previewCandidate
                  ? 'border-emerald-400/50 bg-emerald-950/20'
                  : 'border-emerald-500/25 bg-[#111822]'
              }`}
            >
              <div className="flex items-center justify-center gap-1 text-[11px] text-emerald-300">
                <Zap className="w-3 h-3" />
                케미 ({displayedChemistry.chemistryOvrBonus >= 0 ? '+' : ''}
                {displayedChemistry.chemistryOvrBonus.toFixed(1)})
              </div>
              <div className="font-display text-xl font-bold text-emerald-300">
                {displayedChemistry.total}
                {previewCandidate && previewChemDelta !== 0 && (
                  <span
                    className={`ml-1 text-xs ${
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
        <div className="lg:col-span-5 order-2 lg:order-1 space-y-2">
          <div className="flex items-center justify-between gap-2 px-1 text-xs">
            <span className="inline-flex items-center gap-1.5 font-semibold text-slate-300 truncate">
              <ArrowLeftRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              {previewCandidate
                ? `프리뷰 배치 중: ${previewCandidate.name}`
                : selectedSlot
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
                    setPreviewCandidate(null);
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
            starters={displayedStarters}
            bench={displayedBench}
            chemistry={displayedChemistry}
            managerTraitId={state.manager.traitId}
            activeSlot={{
              area: draft.currentSlotType,
              index: draft.currentSlotIndex,
            }}
            previewSlot={
              previewCandidate
                ? {
                    area: draft.currentSlotType,
                    index: draft.currentSlotIndex,
                  }
                : null
            }
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
