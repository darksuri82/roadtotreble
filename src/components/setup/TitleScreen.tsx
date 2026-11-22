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
import { PixelTrophySvg } from '../common/PixelTrophySvg';
import { SystemGuideModal } from '../guide/SystemGuideModal';

export function TitleScreen() {
  const { startNewCareer, legacyState, setLegacyModalOpen, openDreamMatch } =
    useGame();
  const [showGuide, setShowGuide] = useState(false);
  const [showPatchNotes, setShowPatchNotes] = useState(false);
  const achProgress = getAchievementProgress(legacyState);
  const seasonCount = legacyState.hallOfFame.length;

  return (
    <>
      <div className="mx-auto flex min-h-[calc(100dvh-64px)] max-w-4xl flex-col justify-center px-4 py-10 sm:py-16">
        {/* Modern Minimalist Hero with 3 Treble Pixel Trophies */}
        <section className="relative overflow-hidden rounded-3xl border border-slate-800/80 bg-[#0e141d] px-6 py-12 text-center shadow-2xl sm:px-14 sm:py-16">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-28 left-1/2 h-64 w-[28rem] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl"
          />

          <div className="relative mx-auto max-w-2xl">
            {/* Subtle Eyebrow */}
            <div className="flex items-center justify-center gap-2 text-[11px] font-semibold tracking-[0.2em] text-slate-400 uppercase">
              <span>2026-27 EUROPEAN FOOTBALL</span>
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

            {/* Brand Title */}
            <h1 className="font-display mt-4 text-4xl font-bold tracking-tight text-white sm:text-6xl">
              PITCH MANAGER
            </h1>
            <p className="font-display mt-1.5 text-sm font-semibold tracking-[0.34em] text-emerald-400 uppercase sm:text-base">
              ROAD TO TREBLE
            </p>

            {/* 3 Crisp Pixel-Art Treble Trophies */}
            <div className="mt-9 flex items-end justify-center gap-6 sm:gap-10">
              <div className="flex flex-col items-center gap-2">
                <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-slate-800/90 bg-[#121924] sm:h-28 sm:w-28">
                  <PixelTrophySvg
                    variant="league"
                    size={62}
                    className="pixel-float"
                  />
                </div>
                <span className="text-[11px] font-semibold text-slate-400">
                  5대 리그 우승
                </span>
              </div>

              <div className="flex flex-col items-center gap-2 -translate-y-2">
                <div className="flex h-28 w-28 items-center justify-center rounded-2xl border border-amber-400/30 bg-[#141c28] shadow-lg shadow-amber-500/10 sm:h-32 sm:w-32">
                  <PixelTrophySvg
                    variant="ucl"
                    size={74}
                    className="pixel-float-delayed"
                  />
                </div>
                <span className="text-[11px] font-bold text-amber-300">
                  챔피언스리그
                </span>
              </div>

              <div className="flex flex-col items-center gap-2">
                <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-slate-800/90 bg-[#121924] sm:h-28 sm:w-28">
                  <PixelTrophySvg
                    variant="fa_cup"
                    size={62}
                    className="pixel-float-slow"
                  />
                </div>
                <span className="text-[11px] font-semibold text-slate-400">
                  자국 컵대회
                </span>
              </div>
            </div>

            <p className="mx-auto mt-7 max-w-md text-xs leading-relaxed text-slate-400 sm:text-sm">
              16인 드래프트부터 5대 리그, 자국 컵, 36팀 챔피언스리그와 발롱도르까지.
              나만의 전술로 유럽 트레블의 역사를 써 내려가세요.
            </p>

            {/* Primary CTAs */}
            <div className="mt-8 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
              <button
                id="title-start-btn"
                type="button"
                onClick={startNewCareer}
                className="group inline-flex w-full max-w-xs items-center justify-center gap-2.5 rounded-xl bg-emerald-500 px-8 py-3.5 text-sm font-extrabold text-slate-950 shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400 active:scale-[0.99] cursor-pointer sm:w-auto sm:text-base"
              >
                <Play className="h-4 w-4 fill-current" />
                <span>새 시즌 시작</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>

              <button
                id="title-dream-match-btn"
                type="button"
                onClick={() => openDreamMatch(null)}
                className="group inline-flex w-full max-w-xs items-center justify-center gap-2 rounded-xl border border-amber-400/50 bg-amber-500/15 px-6 py-3.5 text-sm font-extrabold text-amber-200 shadow-lg shadow-amber-500/10 transition-all hover:border-amber-300 hover:bg-amber-500/25 active:scale-[0.99] cursor-pointer sm:w-auto sm:text-base"
              >
                <Swords className="h-4 w-4 text-amber-300" />
                <span>드림 매치</span>
                <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-black text-amber-300">
                  역대 강팀 도전
                </span>
              </button>
            </div>
          </div>
        </section>

        {/* Clean 3-Item Auxiliary Navigation */}
        <nav
          aria-label="보조 메뉴"
          className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3"
        >
          <button
            id="title-legacy-card"
            type="button"
            onClick={() => setLegacyModalOpen(true)}
            className="group flex items-center justify-between rounded-2xl border border-slate-800/80 bg-[#0e141d] px-5 py-4 text-left transition-colors hover:border-amber-500/45 hover:bg-[#131b27] cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <Crown className="h-5 w-5 shrink-0 text-amber-400" />
              <div className="min-w-0">
                <div className="text-sm font-bold text-white">
                  레거시 / 명예의 전당
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  {seasonCount > 0
                    ? `${seasonCount}시즌 기록 · 업적 ${achProgress.unlocked}/${achProgress.total}`
                    : `도전과제 ${achProgress.unlocked}/${achProgress.total} 달성`}
                </div>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-slate-600 transition-transform group-hover:translate-x-0.5 group-hover:text-amber-300" />
          </button>

          <button
            id="title-patchnotes-card"
            type="button"
            onClick={() => setShowPatchNotes(true)}
            className="group flex items-center justify-between rounded-2xl border border-slate-800/80 bg-[#0e141d] px-5 py-4 text-left transition-colors hover:border-sky-500/45 hover:bg-[#131b27] cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <ScrollText className="h-5 w-5 shrink-0 text-sky-400" />
              <div className="min-w-0">
                <div className="text-sm font-bold text-white">
                  패치노트{' '}
                  <span className="font-mono text-xs text-sky-400">
                    {CURRENT_APP_VERSION}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  최신 업데이트 및 변경 이력
                </div>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-slate-600 transition-transform group-hover:translate-x-0.5 group-hover:text-sky-300" />
          </button>

          <button
            id="title-guide-card"
            type="button"
            onClick={() => setShowGuide(true)}
            className="group flex items-center justify-between rounded-2xl border border-slate-800/80 bg-[#0e141d] px-5 py-4 text-left transition-colors hover:border-emerald-500/45 hover:bg-[#131b27] cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <BookOpen className="h-5 w-5 shrink-0 text-emerald-400" />
              <div className="min-w-0">
                <div className="text-sm font-bold text-white">가이드</div>
                <div className="text-[11px] text-slate-400 truncate">
                  전술 상성 · 케미 · 컵 · 챔스 안내
                </div>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-slate-600 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-300" />
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
