import {
  ArrowRight,
  BookOpen,
  Crown,
  Play,
  ScrollText,
  Swords,
} from 'lucide-react';
import { useState } from 'react';
import { CURRENT_APP_VERSION } from '../../data/patchNotes';
import { getAchievementProgress } from '../../engine/legacyEngine';
import { useGame } from '../../store/GameContext';
import { PatchNotesModal } from '../common/PatchNotesModal';
import { SystemGuideModal } from '../guide/SystemGuideModal';
import { RoadToTrebleHeroSvg } from './RoadToTrebleHeroSvg';

const ROAD_STAGES = [
  { label: '드래프트', accent: 'text-emerald-300' },
  { label: '5대 리그', accent: 'text-slate-300' },
  { label: '자국 컵', accent: 'text-rose-300' },
  { label: '챔피언스리그', accent: 'text-amber-300' },
] as const;

export function TitleScreen() {
  const { startNewCareer, legacyState, setLegacyModalOpen, openDreamMatch } =
    useGame();
  const [showGuide, setShowGuide] = useState(false);
  const [showPatchNotes, setShowPatchNotes] = useState(false);
  const achProgress = getAchievementProgress(legacyState);
  const seasonCount = legacyState.hallOfFame.length;

  return (
    <>
      <div className="mx-auto flex min-h-[calc(100dvh-56px)] max-w-4xl flex-col justify-center px-3.5 py-6 sm:px-5 sm:py-10">
        {/* Official Road To Treble Hero */}
        <section className="relative overflow-hidden rounded-3xl border border-slate-800/80 bg-[#0d131c] px-5 py-7 text-center shadow-2xl sm:px-10 sm:py-10">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 left-1/2 h-56 w-[26rem] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl"
          />

          <div className="relative mx-auto max-w-2xl">
            {/* Minimal Eyebrow */}
            <div className="flex items-center justify-center gap-2 text-[11px] font-semibold tracking-[0.22em] text-slate-400 uppercase">
              <span>2026-27</span>
              <span className="text-slate-700">·</span>
              <button
                id="hero-version-badge"
                type="button"
                onClick={() => setShowPatchNotes(true)}
                className="font-mono font-bold text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
              >
                {CURRENT_APP_VERSION}
              </button>
            </div>

            {/* Official Game Title */}
            <h1 className="font-display mt-2.5 bg-gradient-to-b from-white via-slate-100 to-emerald-200 bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-6xl">
              ROAD TO TREBLE
            </h1>

            {/* Cute Pixel-Art "Road" Centerpiece */}
            <div className="mx-auto mt-5 max-w-xl overflow-hidden rounded-2xl border border-slate-800/90 bg-[#09101c] shadow-inner">
              <RoadToTrebleHeroSvg />
              <div className="grid grid-cols-4 border-t border-slate-800/80 bg-[#0b111b] px-2 py-2 text-[10px] font-bold sm:text-[11px]">
                {ROAD_STAGES.map((stage, idx) => (
                  <div
                    key={stage.label}
                    className={`flex items-center justify-center gap-1 ${stage.accent}`}
                  >
                    <span className="font-mono text-[9px] text-slate-600">
                      0{idx + 1}
                    </span>
                    <span className="truncate">{stage.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Primary CTAs */}
            <div className="mt-6 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
              <button
                id="title-start-btn"
                type="button"
                onClick={startNewCareer}
                className="group inline-flex w-full max-w-xs items-center justify-center gap-2.5 rounded-xl bg-emerald-500 px-8 py-3.5 text-sm font-extrabold text-slate-950 shadow-lg shadow-emerald-500/20 transition-colors hover:bg-emerald-400 cursor-pointer touch-manipulation sm:w-auto sm:text-base"
              >
                <Play className="h-4 w-4 fill-current" />
                <span>새 시즌 시작</span>
                <ArrowRight className="h-4 w-4" />
              </button>

              <button
                id="title-dream-match-btn"
                type="button"
                onClick={() => openDreamMatch(null)}
                className="group inline-flex w-full max-w-xs items-center justify-center gap-2 rounded-xl border border-amber-400/45 bg-amber-500/12 px-6 py-3.5 text-sm font-extrabold text-amber-200 transition-colors hover:border-amber-300/70 hover:bg-amber-500/20 cursor-pointer touch-manipulation sm:w-auto sm:text-base"
              >
                <Swords className="h-4 w-4 text-amber-300" />
                <span>드림 매치</span>
                <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                  명전 대결
                </span>
              </button>
            </div>
          </div>
        </section>

        {/* Clean Compact 3-Item Auxiliary Bar */}
        <nav
          aria-label="보조 메뉴"
          className="mt-3 grid grid-cols-3 gap-2 sm:gap-3"
        >
          <button
            id="title-legacy-card"
            type="button"
            onClick={() => setLegacyModalOpen(true)}
            className="group flex items-center justify-between gap-2 rounded-2xl border border-slate-800/80 bg-[#0d131c] px-3 py-3 text-left transition-colors hover:border-amber-500/40 hover:bg-[#121a26] cursor-pointer touch-manipulation sm:px-4 sm:py-3.5"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Crown className="h-4 w-4 shrink-0 text-amber-400 sm:h-5 sm:w-5" />
              <div className="min-w-0">
                <div className="text-xs font-bold text-white sm:text-sm truncate">
                  명예의 전당
                </div>
                <div className="text-[10px] font-mono text-slate-400 truncate sm:text-[11px]">
                  {seasonCount}시즌 · {achProgress.unlocked}/{achProgress.total}
                </div>
              </div>
            </div>
            <ArrowRight className="hidden h-4 w-4 shrink-0 text-slate-600 group-hover:text-amber-300 sm:block" />
          </button>

          <button
            id="title-patchnotes-card"
            type="button"
            onClick={() => setShowPatchNotes(true)}
            className="group flex items-center justify-between gap-2 rounded-2xl border border-slate-800/80 bg-[#0d131c] px-3 py-3 text-left transition-colors hover:border-sky-500/40 hover:bg-[#121a26] cursor-pointer touch-manipulation sm:px-4 sm:py-3.5"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <ScrollText className="h-4 w-4 shrink-0 text-sky-400 sm:h-5 sm:w-5" />
              <div className="min-w-0">
                <div className="text-xs font-bold text-white sm:text-sm truncate">
                  패치노트
                </div>
                <div className="text-[10px] font-mono text-sky-400 truncate sm:text-[11px]">
                  {CURRENT_APP_VERSION}
                </div>
              </div>
            </div>
            <ArrowRight className="hidden h-4 w-4 shrink-0 text-slate-600 group-hover:text-sky-300 sm:block" />
          </button>

          <button
            id="title-guide-card"
            type="button"
            onClick={() => setShowGuide(true)}
            className="group flex items-center justify-between gap-2 rounded-2xl border border-slate-800/80 bg-[#0d131c] px-3 py-3 text-left transition-colors hover:border-emerald-500/40 hover:bg-[#121a26] cursor-pointer touch-manipulation sm:px-4 sm:py-3.5"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <BookOpen className="h-4 w-4 shrink-0 text-emerald-400 sm:h-5 sm:w-5" />
              <div className="min-w-0">
                <div className="text-xs font-bold text-white sm:text-sm truncate">
                  가이드
                </div>
                <div className="text-[10px] text-slate-400 truncate sm:text-[11px]">
                  전술 · 케미 · 룰
                </div>
              </div>
            </div>
            <ArrowRight className="hidden h-4 w-4 shrink-0 text-slate-600 group-hover:text-emerald-300 sm:block" />
          </button>
        </nav>
      </div>

      {showGuide && <SystemGuideModal onClose={() => setShowGuide(false)} />}
      {showPatchNotes && (
        <PatchNotesModal onClose={() => setShowPatchNotes(false)} />
      )}
    </>
  );
}
