import {
  ArrowRight,
  BookOpen,
  Crown,
  Play,
  ScrollText,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import { CURRENT_APP_VERSION } from '../../data/patchNotes';
import { getAchievementProgress } from '../../engine/legacyEngine';
import { useGame } from '../../store/GameContext';
import { PatchNotesModal } from '../common/PatchNotesModal';
import { SystemGuideModal } from '../guide/SystemGuideModal';

const CAREER_MILESTONES = [
  { step: '01', label: '구단 · 전술 설정' },
  { step: '02', label: '감독 강점 룰렛' },
  { step: '03', label: '16인 드래프트' },
  { step: '04', label: '5대 리그 · 컵' },
  { step: '05', label: '36팀 챔스 · 트레블' },
];

export function TitleScreen() {
  const { startNewCareer, legacyState, setLegacyModalOpen } = useGame();
  const [showGuide, setShowGuide] = useState(false);
  const [showPatchNotes, setShowPatchNotes] = useState(false);
  const achProgress = getAchievementProgress(legacyState);
  const seasonCount = legacyState.hallOfFame.length;

  return (
    <>
      <div className="mx-auto max-w-4xl px-4 py-10 sm:py-16 space-y-6">
        {/* Clean Minimal Hero (kickru.com inspired) */}
        <section className="relative overflow-hidden rounded-3xl border border-slate-800/90 bg-gradient-to-b from-[#131c28] via-[#0f1620] to-[#0b1018] px-6 py-10 sm:px-12 sm:py-14 text-center shadow-2xl">
          {/* Subtle ambient radial glow */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[32rem] -translate-x-1/2 rounded-full bg-emerald-500/12 blur-3xl"
          />

          <div className="relative mx-auto max-w-2xl space-y-6">
            {/* Version & Season Pill */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                id="hero-version-badge"
                type="button"
                onClick={() => setShowPatchNotes(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-3.5 py-1 text-xs font-extrabold text-emerald-300 hover:border-emerald-400 hover:bg-emerald-500/20 transition-colors cursor-pointer"
                title="최신 패치노트 보기"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>{CURRENT_APP_VERSION}</span>
                <span className="text-emerald-400/70">·</span>
                <span>패치노트</span>
              </button>
              <span className="rounded-full border border-slate-800 bg-slate-900/80 px-3 py-1 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                2026-27 EUROPEAN EDITION
              </span>
            </div>

            {/* Hero Headline */}
            <div className="space-y-3">
              <h1 className="font-display text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-[1.15]">
                드래프트부터 트레블까지,
                <br />
                <span className="text-emerald-400">
                  나만의 전술로 유럽을 지배하라
                </span>
              </h1>
              <p className="mx-auto max-w-xl text-sm sm:text-base text-slate-400 leading-relaxed">
                유럽 5대 리그 96개 구단·자국 컵대회·현행 36팀 스위스 챔피언스리그를
                한 판으로 완결하는 전술 드래프트 시뮬레이션
              </p>
            </div>

            {/* Primary CTA */}
            <div className="pt-2 flex flex-col items-center gap-3">
              <button
                id="title-start-btn"
                type="button"
                onClick={startNewCareer}
                className="group inline-flex w-full sm:w-auto min-w-[240px] items-center justify-center gap-2.5 rounded-2xl bg-emerald-500 px-9 py-4 text-base font-extrabold text-slate-950 shadow-xl shadow-emerald-500/20 hover:bg-emerald-400 active:scale-[0.99] transition-all cursor-pointer"
              >
                <Play className="h-4 w-4 fill-current" />
                <span>새 시즌 시작하기</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
              <p className="text-[11px] text-slate-500">
                1단계 구단·드래프트 풀 설정 → 2단계 감독 강점 룰렛 → 3단계 16인 드래프트
              </p>
            </div>

            {/* Subtle 5-Step Journey Strip */}
            <div className="pt-6 border-t border-slate-800/70">
              <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 text-[11px]">
                {CAREER_MILESTONES.map((item, idx) => (
                  <div key={item.step} className="inline-flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800/90 bg-[#0b1018]/90 px-2.5 py-1 text-slate-300">
                      <span className="font-mono text-[10px] font-bold text-emerald-400">
                        {item.step}
                      </span>
                      <span className="font-semibold">{item.label}</span>
                    </span>
                    {idx < CAREER_MILESTONES.length - 1 && (
                      <span className="hidden sm:inline text-slate-700">→</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Clean 3-Card Auxiliary Navigation */}
        <section
          aria-label="보조 메뉴"
          className="grid grid-cols-1 gap-3 sm:grid-cols-3"
        >
          <button
            id="title-legacy-card"
            type="button"
            onClick={() => setLegacyModalOpen(true)}
            className="group flex flex-col justify-between rounded-2xl border border-slate-800 bg-[#111822] p-5 text-left hover:border-amber-500/50 hover:bg-[#141d29] transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
                <Crown className="h-5 w-5" />
              </span>
              <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 font-mono text-[11px] font-bold text-amber-300">
                {achProgress.unlocked}/{achProgress.total} 달성
              </span>
            </div>
            <div className="mt-4 space-y-1">
              <div className="flex items-center justify-between text-sm font-extrabold text-white group-hover:text-amber-200 transition-colors">
                <span>레거시 · 명예의 전당</span>
                <ArrowRight className="h-4 w-4 text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:text-amber-300" />
              </div>
              <p className="text-xs leading-relaxed text-slate-400">
                {seasonCount > 0
                  ? `역대 ${seasonCount}시즌 기록 · 24종 히든 도전과제`
                  : '공정 PPG×38 시즌 스코어 & 24종 히든 도전과제'}
              </p>
            </div>
          </button>

          <button
            id="title-guide-card"
            type="button"
            onClick={() => setShowGuide(true)}
            className="group flex flex-col justify-between rounded-2xl border border-slate-800 bg-[#111822] p-5 text-left hover:border-emerald-500/50 hover:bg-[#141d29] transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                <BookOpen className="h-5 w-5" />
              </span>
              <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300">
                시스템 안내
              </span>
            </div>
            <div className="mt-4 space-y-1">
              <div className="flex items-center justify-between text-sm font-extrabold text-white group-hover:text-emerald-200 transition-colors">
                <span>게임 가이드</span>
                <ArrowRight className="h-4 w-4 text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-300" />
              </div>
              <p className="text-xs leading-relaxed text-slate-400">
                복수 주포지션 · 다중 케미 · 전술 상성 · 체력·컵·UCL 규칙
              </p>
            </div>
          </button>

          <button
            id="title-patchnotes-card"
            type="button"
            onClick={() => setShowPatchNotes(true)}
            className="group flex flex-col justify-between rounded-2xl border border-slate-800 bg-[#111822] p-5 text-left hover:border-sky-500/50 hover:bg-[#141d29] transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-400">
                <ScrollText className="h-5 w-5" />
              </span>
              <span className="rounded-full bg-sky-500/15 px-2.5 py-0.5 font-mono text-[11px] font-bold text-sky-300">
                {CURRENT_APP_VERSION}
              </span>
            </div>
            <div className="mt-4 space-y-1">
              <div className="flex items-center justify-between text-sm font-extrabold text-white group-hover:text-sky-200 transition-colors">
                <span>패치노트</span>
                <ArrowRight className="h-4 w-4 text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:text-sky-300" />
              </div>
              <p className="text-xs leading-relaxed text-slate-400">
                v1.0 출시부터 Phase 2 완성 · 최신 UI 개편 전체 변경 이력
              </p>
            </div>
          </button>
        </section>

        {/* Minimal Footer */}
        <footer className="flex flex-col items-center justify-between gap-2 border-t border-slate-800/70 pt-5 text-[11px] text-slate-500 sm:flex-row">
          <span>
            PITCH MANAGER {CURRENT_APP_VERSION} · 2026-27 European Football Simulation
          </span>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setLegacyModalOpen(true)}
              className="hover:text-slate-300 transition-colors cursor-pointer"
            >
              명예의 전당
            </button>
            <button
              type="button"
              onClick={() => setShowGuide(true)}
              className="hover:text-slate-300 transition-colors cursor-pointer"
            >
              게임 가이드
            </button>
            <button
              type="button"
              onClick={() => setShowPatchNotes(true)}
              className="hover:text-slate-300 transition-colors cursor-pointer"
            >
              패치노트 ({CURRENT_APP_VERSION})
            </button>
          </div>
        </footer>
      </div>

      {showGuide && <SystemGuideModal onClose={() => setShowGuide(false)} />}
      {showPatchNotes && (
        <PatchNotesModal onClose={() => setShowPatchNotes(false)} />
      )}
    </>
  );
}

