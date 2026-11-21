import {
  Crown,
  HelpCircle,
  RotateCcw,
  ScrollText,
  Sparkles,
  Trophy,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { MANAGER_TRAITS } from '../../data/managerTraits';
import { CURRENT_APP_VERSION } from '../../data/patchNotes';
import { getAchievementProgress } from '../../engine/legacyEngine';
import { useGame } from '../../store/GameContext';
import type { GamePhase } from '../../types/game';
import { SystemGuideModal } from '../guide/SystemGuideModal';
import { JerseySvg } from './JerseySvg';
import { PatchNotesModal } from './PatchNotesModal';

const STEPS: { phase: GamePhase; label: string }[] = [
  { phase: 'setup', label: '구단' },
  { phase: 'manager_roulette', label: '감독' },
  { phase: 'draft', label: '드래프트' },
  { phase: 'league_select', label: '리그' },
  { phase: 'season', label: '리그·컵' },
  { phase: 'ucl', label: '챔스' },
  { phase: 'season_end', label: '결산' },
];

export function HeaderNav() {
  const {
    state,
    chemistry,
    ratings,
    legacyState,
    setLegacyModalOpen,
    resetGame,
  } = useGame();
  const [confirmReset, setConfirmReset] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showPatchNotes, setShowPatchNotes] = useState(false);

  const currentStepIdx = STEPS.findIndex((s) => s.phase === state.phase);
  const activeTrait = state.manager.traitId
    ? MANAGER_TRAITS[state.manager.traitId]
    : null;
  const achProgress = getAchievementProgress(legacyState);
  const isTitle = state.phase === 'title';

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#090d13]/92 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5">
          {/* Brand + Club */}
          <div className="flex items-center gap-2.5 min-w-0">
            <JerseySvg
              primaryColor={state.userClub.primaryColor}
              secondaryColor={state.userClub.secondaryColor}
              pattern={state.userClub.pattern}
              label={state.userClub.shortName}
              size={30}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-display text-sm sm:text-base font-bold tracking-wider text-white">
                  PITCH MANAGER
                </span>
                <button
                  type="button"
                  onClick={() => setShowPatchNotes(true)}
                  className="rounded bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-300 hover:bg-emerald-500/25 transition-colors cursor-pointer"
                  title="패치노트 보기"
                >
                  {CURRENT_APP_VERSION}
                </button>
                {activeTrait && !isTitle && (
                  <span
                    className="hidden md:inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold text-slate-950"
                    style={{ backgroundColor: activeTrait.badgeColor }}
                    title={activeTrait.effectSummary}
                  >
                    <Sparkles className="w-2.5 h-2.5" />
                    {activeTrait.name}
                  </span>
                )}
              </div>
              {!isTitle && (
                <p className="text-[11px] text-slate-400 truncate max-w-[150px] sm:max-w-none">
                  {state.userClub.name} · {state.formation}
                </p>
              )}
            </div>
          </div>

          {/* Minimal Phase Stepper (desktop) */}
          {!isTitle && (
            <nav
              aria-label="게임 진행 단계"
              className="hidden lg:flex items-center gap-1 text-[11px]"
            >
              {STEPS.map((step, idx) => {
                const active = idx === currentStepIdx;
                const passed = idx < currentStepIdx;
                return (
                  <span
                    key={step.phase}
                    className={`rounded-md px-2 py-1 font-semibold ${
                      active
                        ? 'bg-emerald-500/15 text-emerald-300 font-bold'
                        : passed
                          ? 'text-slate-400'
                          : 'text-slate-600'
                    }`}
                  >
                    {idx + 1}. {step.label}
                  </span>
                );
              })}
            </nav>
          )}

          {/* Compact HUD + Patch Notes + Legacy + Guide + Reset */}
          <div className="flex items-center gap-2">
            {!isTitle &&
              state.phase !== 'manager_roulette' &&
              state.phase !== 'setup' && (
                <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-[#111822] px-2.5 py-1 text-xs tabular-nums">
                  <span className="inline-flex items-center gap-1 text-slate-300">
                    <Trophy className="w-3 h-3 text-amber-400" />
                    <strong className="font-display text-white">
                      {ratings.ovr || '-'}
                    </strong>
                  </span>
                  <span className="h-3 w-px bg-slate-800" />
                  <span className="inline-flex items-center gap-1 text-emerald-300">
                    <Zap className="w-3 h-3" />
                    <strong className="font-display">{chemistry.total}</strong>
                  </span>
                </div>
              )}

            <button
              id="open-patchnotes-btn"
              type="button"
              onClick={() => setShowPatchNotes(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-1.5 text-xs font-bold text-sky-300 hover:border-sky-400 hover:bg-sky-500/20 transition-colors cursor-pointer"
              title="버전별 패치노트 열기"
            >
              <ScrollText className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">패치노트</span>
              <span className="font-mono text-[10px] font-black text-sky-200">
                {CURRENT_APP_VERSION}
              </span>
            </button>

            {!isTitle && (
              <>
                <button
                  id="open-legacy-btn"
                  type="button"
                  onClick={() => setLegacyModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/35 bg-amber-500/10 px-2.5 py-1.5 text-xs font-bold text-amber-300 hover:border-amber-400 hover:bg-amber-500/20 transition-colors cursor-pointer"
                  title="명예의 전당 및 24종 히든 도전과제 열기"
                >
                  <Crown className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">레거시</span>
                  <span className="rounded bg-amber-400/20 px-1 py-0.2 font-mono text-[10px] font-black text-amber-200">
                    {achProgress.unlocked}/{achProgress.total}
                  </span>
                </button>

                <button
                  id="open-guide-btn"
                  type="button"
                  onClick={() => setShowGuide(true)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-[#111822] px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:border-slate-600 hover:text-white transition-colors cursor-pointer"
                  title="게임 시스템 가이드 열기"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">가이드</span>
                </button>

                <div>
                  {!confirmReset ? (
                    <button
                      type="button"
                      onClick={() => setConfirmReset(true)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-[#111822] px-2.5 py-1.5 text-xs font-semibold text-slate-400 hover:border-slate-600 hover:text-white cursor-pointer"
                      title="처음으로 돌아가기"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">초기화</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-950/90 px-2 py-1 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmReset(false);
                          resetGame();
                        }}
                        className="rounded bg-rose-500 px-2 py-0.5 font-bold text-white hover:bg-rose-400 cursor-pointer"
                      >
                        초기화 확인
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmReset(false)}
                        className="rounded bg-slate-800 px-2 py-0.5 text-slate-200 hover:bg-slate-700 cursor-pointer"
                      >
                        취소
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {showGuide && <SystemGuideModal onClose={() => setShowGuide(false)} />}
      {showPatchNotes && (
        <PatchNotesModal onClose={() => setShowPatchNotes(false)} />
      )}
    </>
  );
}

