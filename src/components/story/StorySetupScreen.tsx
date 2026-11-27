import {
  ArrowLeft,
  BookOpen,
  Coins,
  Play,
  ShieldAlert,
  Sparkles,
  Star,
} from 'lucide-react';
import { useState } from 'react';
import { FORMATION_LIST } from '../../data/formations';
import { MANAGER_TRAITS } from '../../data/managerTraits';
import { getStoryScenarioMeta } from '../../data/story/storyRegistry';
import { TACTIC_LIST } from '../../engine/tacticEngine';
import { useGame } from '../../store/GameContext';
import type { Player, SubPosition } from '../../types/player';
import { JerseySvg } from '../common/JerseySvg';
import { PitchBoard, type SlotRef } from '../common/PitchBoard';
import { PixelManagerAvatar } from '../common/PixelManagerAvatar';
import { PlayerDetailModal } from '../common/PlayerDetailModal';
import { StoryIntroModal } from './StoryIntroModal';

export function StorySetupScreen() {
  const {
    state,
    chemistry,
    ratings,
    changeFormation,
    setDefaultTactic,
    swapSquadPositions,
    setStoryManagerTrait,
    startStorySeason,
    openStoryHub,
  } = useGame();

  const [selectedSlot, setSelectedSlot] = useState<SlotRef | null>(null);
  const [inspectPlayer, setInspectPlayer] = useState<{
    player: Player;
    slotSubPosition?: SubPosition;
  } | null>(null);
  const [showIntroReplay, setShowIntroReplay] = useState(false);

  if (!state.storyMode) return null;
  const meta = getStoryScenarioMeta(state.storyMode.scenarioId);
  const missionKeySet = new Set(state.storyMode.missionKeyPlayerIds);

  const handleSlotClick = (area: 'starter' | 'bench', index: number) => {
    if (!selectedSlot) {
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

  return (
    <>
      <div className="mx-auto max-w-6xl px-3 py-4 sm:px-5 sm:py-5 space-y-4">
        {/* Top Banner */}
        <section className="rounded-2xl border border-slate-800/90 bg-gradient-to-b from-[#111927] to-[#0c121c] p-3.5 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <JerseySvg
                primaryColor={meta.clubProfile.primaryColor}
                secondaryColor={meta.clubProfile.secondaryColor}
                pattern={meta.clubProfile.pattern}
                label={meta.clubShortName}
                size={44}
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={openStoryHub}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-0.5 text-[11px] font-bold text-slate-300 hover:text-white cursor-pointer whitespace-nowrap"
                  >
                    <ArrowLeft className="h-3 w-3" />
                    시나리오 목록
                  </button>
                  <span className="rounded border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 font-mono text-[10px] font-extrabold text-amber-300 whitespace-nowrap">
                    {meta.leagueLabel} · {meta.cupLabel}
                    {meta.hasUcl && meta.uclLabel ? ` · ${meta.uclLabel}` : ''}
                  </span>
                </div>
                <h1 className="mt-1 text-lg sm:text-xl font-extrabold text-white truncate">
                  {meta.clubName} — 《{meta.title}》 개막 전술실
                </h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowIntroReplay(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-200 hover:bg-amber-500/20 cursor-pointer whitespace-nowrap"
              >
                <BookOpen className="h-3.5 w-3.5" />
                스토리 다시보기
              </button>
              <button
                id="story-start-season-btn"
                type="button"
                onClick={startStorySeason}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-extrabold text-slate-950 shadow-lg hover:bg-emerald-400 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Play className="h-4 w-4 fill-current" />
                시즌 개막
              </button>
            </div>
          </div>

          {/* Era Cash & Transfer Rule Summary */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-[#090e17] px-3 py-2 text-[11.5px]">
            <div className="flex items-center gap-2 text-slate-300">
              <ShieldAlert className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <span style={{ wordBreak: 'keep-all' }}>
                <strong className="text-white">{meta.transferRuleLabel}</strong> · 빠른 선발 비활성화 (직접 선발·교체 배치)
              </span>
            </div>
            <span className="inline-flex items-center gap-1 font-mono text-xs font-extrabold text-emerald-300 whitespace-nowrap">
              <Coins className="h-3.5 w-3.5" />
              보유 현금 €{meta.cashBudgetM}M
            </span>
          </div>
        </section>

        {/* Main 2-Column Layout: Left = Pitch (Manual Lineup), Right = Philosophy / Tactics / Checklist */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          <div className="lg:col-span-7 space-y-3">
            <PitchBoard
              formation={state.formation}
              starters={state.starters}
              bench={state.bench}
              chemistry={chemistry}
              managerTraitId={state.manager.traitId}
              tactic={state.defaultTactic}
              selectedSlot={selectedSlot}
              missionHighlightPlayerIds={missionKeySet}
              onSlotClick={handleSlotClick}
              onSlotSwap={(from, to) => {
                swapSquadPositions(from, to);
                setSelectedSlot(null);
              }}
              onInspectPlayer={(player, slotSubPosition) =>
                setInspectPlayer({ player, slotSubPosition })
              }
              showBench
              showManagerFitStrip
              showChemBreakdown
              headerLabel={`${meta.clubName} 개막 스쿼드 (클릭·드래그로 직접 배치)`}
              headerRight={
                <span className="font-mono text-[11px] font-bold text-slate-300 whitespace-nowrap">
                  OVR <strong className="text-white">{ratings.ovr}</strong> · A{ratings.effectiveAtt}/M{ratings.effectiveMid}/D{ratings.effectiveDef}
                </span>
              }
            />
          </div>

          <div className="lg:col-span-5 space-y-3.5">
            {/* 1. Manager Philosophy 3-Choice */}
            <section className="rounded-2xl border border-slate-800/90 bg-[#0e1522] p-3.5 space-y-2.5">
              <div className="flex items-center gap-2">
                <PixelManagerAvatar
                  avatar={meta.managerAvatar}
                  clubPrimaryColor={meta.clubProfile.primaryColor}
                  clubSecondaryColor={meta.clubProfile.secondaryColor}
                  size={24}
                />
                <div>
                  <h2 className="text-xs sm:text-sm font-extrabold text-white">
                    {meta.managerName} 감독 — 전술 철학 선택 (3택)
                  </h2>
                  <p className="text-[10.5px] text-slate-400">
                    같은 스쿼드라도 어떤 철학을 고르느냐에 따라 시너지·미션 공략법이 달라집니다.
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                {meta.managerTraitOptions.map((opt) => {
                  const trait = MANAGER_TRAITS[opt.traitId];
                  const active = state.manager.traitId === opt.traitId;
                  return (
                    <button
                      key={opt.traitId}
                      type="button"
                      onClick={() => setStoryManagerTrait(opt.traitId)}
                      className={`w-full rounded-xl border p-2.5 text-left transition-colors cursor-pointer ${
                        active
                          ? 'border-emerald-400/65 bg-emerald-500/12'
                          : 'border-slate-800 bg-[#0a1019] hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-extrabold text-white">
                          {trait.name}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9.5px] font-bold whitespace-nowrap ${
                            active
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {opt.tag}
                        </span>
                      </div>
                      <p
                        className="mt-1 text-[11px] text-slate-300/90 leading-snug"
                        style={{ wordBreak: 'keep-all' }}
                      >
                        {opt.pitch}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 2. Formation & Default Tactic */}
            <section className="rounded-2xl border border-slate-800/90 bg-[#0e1522] p-3.5 space-y-3">
              <div>
                <h2 className="text-xs font-extrabold text-slate-200 mb-1.5">
                  포메이션 선택 (10종)
                </h2>
                <div className="grid grid-cols-5 gap-1">
                  {FORMATION_LIST.map((f) => {
                    const active = state.formation === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => changeFormation(f.id)}
                        className={`rounded-lg border px-1.5 py-1.5 font-mono text-[10.5px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                          active
                            ? 'border-emerald-400/65 bg-emerald-500/20 text-emerald-200'
                            : 'border-slate-800 bg-[#0a1019] text-slate-400 hover:border-slate-600 hover:text-white'
                        }`}
                      >
                        {f.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <h2 className="text-xs font-extrabold text-slate-200 mb-1.5">
                  기본 전술 선택 (5종)
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {TACTIC_LIST.map((t) => {
                    const active = state.defaultTactic === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setDefaultTactic(t.id)}
                        className={`rounded-lg border px-2 py-1.5 text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                          active
                            ? 'border-sky-400/65 bg-sky-500/20 text-sky-200'
                            : 'border-slate-800 bg-[#0a1019] text-slate-400 hover:border-slate-600 hover:text-white'
                        }`}
                      >
                        {t.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* 3. 3-Star Checklist Preview */}
            <section className="rounded-2xl border border-amber-500/35 bg-[#121622] p-3.5 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-amber-300">
                <Sparkles className="h-3.5 w-3.5" />
                <span>시나리오 별 3개(★★★) 목표</span>
              </div>
              <ul className="space-y-1.5">
                {meta.checklist.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start gap-2 rounded-lg border border-slate-800 bg-[#0b1019] px-2.5 py-2 text-[11.5px] text-slate-200"
                  >
                    <Star className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                    <div style={{ wordBreak: 'keep-all' }}>
                      <div className="font-bold text-white">
                        ★{item.starIndex} {item.shortLabel}
                      </div>
                      <div className="text-[10.5px] text-slate-400">
                        {item.detail}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </div>

      {showIntroReplay && (
        <StoryIntroModal
          meta={meta}
          proceedLabel="전술실로 돌아가기"
          onClose={() => setShowIntroReplay(false)}
          onProceed={() => setShowIntroReplay(false)}
        />
      )}

      {inspectPlayer && (
        <PlayerDetailModal
          player={inspectPlayer.player}
          slotSubPosition={inspectPlayer.slotSubPosition}
          managerTraitId={state.manager.traitId}
          onClose={() => setInspectPlayer(null)}
        />
      )}
    </>
  );
}
