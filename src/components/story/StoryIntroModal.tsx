import { ArrowLeft, ArrowRight, BookOpen, FastForward, Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import type { StoryScenarioMeta } from '../../types/storyMode';
import { JerseySvg } from '../common/JerseySvg';
import { StoryPixelSceneSvg } from './StoryPixelSceneSvg';

interface StoryIntroModalProps {
  meta: StoryScenarioMeta;
  onProceed: () => void;
  onClose?: () => void;
  proceedLabel?: string;
}

export function StoryIntroModal({
  meta,
  onProceed,
  onClose,
  proceedLabel = '전술실로 입장',
}: StoryIntroModalProps) {
  useBodyScrollLock(true);
  const slides = meta.introSlides;
  const [slideIdx, setSlideIdx] = useState(0);
  const current = slides[slideIdx] ?? slides[0];
  const isFirst = slideIdx === 0;
  const isLast = slideIdx >= slides.length - 1;

  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-2.5 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${meta.clubName} 스토리 프롤로그`}
    >
      <div className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-700/85 bg-[#0c121c] shadow-[0_24px_70px_-16px_rgba(0,0,0,0.95)]">
        {/* Top Bar */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-800/90 bg-[#090e17] px-3.5 py-2.5 sm:px-5">
          <div className="flex items-center gap-2 min-w-0">
            <JerseySvg
              primaryColor={meta.clubProfile.primaryColor}
              secondaryColor={meta.clubProfile.secondaryColor}
              pattern={meta.clubProfile.pattern}
              label={meta.clubShortName}
              size={24}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-amber-300">
                <BookOpen className="h-3 w-3 shrink-0" />
                <span className="whitespace-nowrap">{meta.seasonLabel} STORY</span>
              </div>
              <h2 className="truncate text-xs sm:text-sm font-extrabold text-white">
                {meta.clubName} — 《{meta.title}》
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onProceed}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700/80 bg-slate-900/90 px-2.5 py-1 text-[11px] font-bold text-slate-300 hover:border-slate-500 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
            >
              <FastForward className="h-3 w-3" />
              건너뛰기
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-800 bg-slate-900 p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                aria-label="닫기"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Interactive Chapter Tabs */}
        <div className="flex shrink-0 items-center gap-1.5 border-b border-slate-800/80 bg-[#0d1420] px-3.5 py-2 sm:px-5 overflow-x-auto">
          {slides.map((slide, idx) => {
            const active = idx === slideIdx;
            return (
              <button
                key={slide.id}
                type="button"
                onClick={() => setSlideIdx(idx)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  active
                    ? 'border-amber-400/60 bg-amber-500/15 text-amber-200'
                    : 'border-slate-800 bg-[#101826] text-slate-400 hover:border-slate-600 hover:text-slate-200'
                }`}
              >
                <span className="font-mono text-[10px]">0{idx + 1}</span>
                <span>{slide.chapterLabel.replace('CHAPTER ', '')}막</span>
              </button>
            );
          })}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y p-3.5 sm:p-5 space-y-3.5">
          {/* Pixel Art Scene Frame */}
          <div className="overflow-hidden rounded-xl border border-slate-700/80 bg-[#060b14] shadow-[0_12px_28px_-12px_rgba(0,0,0,0.9)]">
            <StoryPixelSceneSvg
              backdrop={current.backdrop}
              characters={current.characters}
              accentColor={meta.accentColor}
            />
          </div>

          {/* Literary Narrative Block */}
          <div className="rounded-xl border border-slate-800/90 bg-[#101826] p-3.5 sm:p-4 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/35 bg-amber-500/10 px-2.5 py-0.5 font-mono text-[10px] font-bold text-amber-300 whitespace-nowrap">
                <Sparkles className="h-2.5 w-2.5 shrink-0" />
                {current.eraTag}
              </span>
              <span className="font-mono text-[10px] text-slate-500">
                {slideIdx + 1} / {slides.length}
              </span>
            </div>

            <h3
              className="text-base sm:text-lg font-extrabold text-white leading-snug"
              style={{ wordBreak: 'keep-all' }}
            >
              {current.title}
            </h3>

            <p
              className="text-xs sm:text-[13.5px] leading-relaxed text-slate-300"
              style={{ wordBreak: 'keep-all' }}
            >
              {current.narrative}
            </p>

            {current.quote && (
              <blockquote
                className="border-l-2 border-amber-400/60 bg-[#0b111c] px-3 py-2 text-[11.5px] sm:text-xs italic text-amber-100/90 rounded-r-lg"
                style={{ wordBreak: 'keep-all' }}
              >
                {current.quote}
              </blockquote>
            )}
          </div>
        </div>

        {/* Footer Controls */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-800/90 bg-[#090e17] px-3.5 py-3 sm:px-5">
          <button
            type="button"
            disabled={isFirst}
            onClick={() => setSlideIdx((i) => Math.max(0, i - 1))}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-700/80 bg-[#111927] px-3 py-2 text-xs font-bold text-slate-200 hover:border-slate-500 disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            이전
          </button>

          <div className="flex items-center gap-1.5">
            {slides.map((s, idx) => (
              <span
                key={s.id}
                className={`h-1.5 rounded-full transition-all ${
                  idx === slideIdx
                    ? 'w-5 bg-amber-400'
                    : 'w-1.5 bg-slate-700'
                }`}
              />
            ))}
          </div>

          {!isLast ? (
            <button
              type="button"
              onClick={() => setSlideIdx((i) => Math.min(slides.length - 1, i + 1))}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/50 bg-amber-500/20 px-4 py-2 text-xs font-extrabold text-amber-200 hover:bg-amber-500/30 transition-colors cursor-pointer whitespace-nowrap"
            >
              다음 장면
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              id="story-intro-proceed-btn"
              type="button"
              onClick={onProceed}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs sm:text-sm font-extrabold text-slate-950 shadow-lg hover:bg-emerald-400 transition-colors cursor-pointer whitespace-nowrap"
            >
              <span>{proceedLabel}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
