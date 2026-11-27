import {
  BookOpen,
  Crown,
  Globe,
  HelpCircle,
  RotateCcw,
  ScrollText,
  Trophy,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { CURRENT_APP_VERSION } from '../../data/patchNotes';
import { getAchievementProgress } from '../../engine/legacyEngine';
import { useGame } from '../../store/GameContext';
import type { GamePhase } from '../../types/game';
import {
  type GuideTabId,
  OPEN_SOLO_TUTORIAL_EVENT,
  OPEN_SYSTEM_GUIDE_EVENT,
} from '../guide/guideNavigation';
import { SoloVisualTutorialModal } from '../guide/SoloVisualTutorialModal';
import { SystemGuideModal } from '../guide/SystemGuideModal';
import { JerseySvg } from './JerseySvg';
import { PatchNotesModal } from './PatchNotesModal';
import { PixelManagerAvatar } from './PixelManagerAvatar';
import { TacticsGuideModal } from './TacticsGuideModal';

const STEPS: { phase: GamePhase; label: string }[] = [
  { phase: 'setup', label: '전술' },
  { phase: 'manager_roulette', label: '특성' },
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
    multiplayerOpen,
    openLegacyModal,
    resetGame,
  } = useGame();
  const [confirmReset, setConfirmReset] = useState(false);
  const [guideModalTab, setGuideModalTab] = useState<GuideTabId | null>(null);
  const [showTacticsGuide, setShowTacticsGuide] = useState(false);
  const [showPatchNotes, setShowPatchNotes] = useState(false);
  const [showTutorialReplay, setShowTutorialReplay] = useState(false);

  useEffect(() => {
    const handleOpenGuide = (e: Event) => {
      const custom = e as CustomEvent<{ tab?: GuideTabId }>;
      setGuideModalTab(custom.detail?.tab ?? 'budget');
    };
    const handleOpenTutorial = () => {
      setGuideModalTab(null);
      setShowTutorialReplay(true);
    };
    window.addEventListener(OPEN_SYSTEM_GUIDE_EVENT, handleOpenGuide);
    window.addEventListener(OPEN_SOLO_TUTORIAL_EVENT, handleOpenTutorial);
    return () => {
      window.removeEventListener(OPEN_SYSTEM_GUIDE_EVENT, handleOpenGuide);
      window.removeEventListener(OPEN_SOLO_TUTORIAL_EVENT, handleOpenTutorial);
    };
  }, []);

  const currentStepIdx = STEPS.findIndex((s) => s.phase === state.phase);
  const achProgress = getAchievementProgress(legacyState);
  const isStoryMode = Boolean(state.storyMode);
  const isTitle =
    state.phase === 'title' || state.phase === 'story_hub' || multiplayerOpen;

  return (
    <>
      <header className="sticky top-0 z-40 w-full max-w-full overflow-x-clip border-b border-slate-800/80 bg-[#090d13]">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2">
          {/* Brand + Club / Manager */}
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
            {!isTitle ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <JerseySvg
                  primaryColor={state.userClub.primaryColor}
                  secondaryColor={state.userClub.secondaryColor}
                  pattern={state.userClub.pattern}
                  label={state.userClub.shortName}
                  size={24}
                />
                <div className="hidden sm:flex h-7 w-6 items-center justify-center rounded-md border border-slate-800 bg-[#111822]">
                  <PixelManagerAvatar
                    avatar={state.manager.avatar}
                    clubPrimaryColor={state.userClub.primaryColor}
                    clubSecondaryColor={state.userClub.secondaryColor}
                    size={20}
                  />
                </div>
              </div>
            ) : (
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 shrink-0" />
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-display text-xs sm:text-base font-bold tracking-wider text-white whitespace-nowrap">
                  ROAD TO TREBLE
                </span>
                {isStoryMode && !isTitle && (
                  <span className="rounded border border-amber-400/45 bg-amber-500/15 px-1.5 py-0.5 font-mono text-[9.5px] font-extrabold text-amber-300 whitespace-nowrap shrink-0">
                    STORY {state.storyMode?.seasonLabel}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setShowPatchNotes(true)}
                  className="rounded px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  title="패치노트 보기"
                >
                  {CURRENT_APP_VERSION}
                </button>
              </div>
              {!isTitle && (
                <p className="text-[10px] sm:text-[11px] text-slate-400 truncate max-w-[115px] sm:max-w-[220px] md:max-w-none">
                  {state.userClub.name} · {state.manager.name} 감독 · {state.formation}
                </p>
              )}
            </div>
          </div>

          {/* Minimal Phase Stepper (xl desktop only so right buttons never wrap) */}
          {!isTitle && !isStoryMode && (
            <nav
              aria-label="게임 진행 단계"
              className="hidden xl:flex items-center gap-0.5 text-[11px] shrink-0"
            >
              {STEPS.map((step, idx) => {
                const active = idx === currentStepIdx;
                const passed = idx < currentStepIdx;
                return (
                  <span
                    key={step.phase}
                    className={`rounded-md px-1.5 py-0.5 font-semibold whitespace-nowrap ${
                      active
                        ? 'bg-emerald-500/15 text-emerald-300 font-bold'
                        : passed
                          ? 'text-slate-400'
                          : 'text-slate-600'
                    }`}
                  >
                    {idx + 1}.{step.label}
                  </span>
                );
              })}
            </nav>
          )}

          {/* Compact HUD & Single-Line Actions */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {!isTitle &&
              state.phase !== 'manager_roulette' &&
              state.phase !== 'setup' &&
              state.phase !== 'story_setup' && (
                <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#0e141d] px-2 py-1 text-[11px] tabular-nums whitespace-nowrap shrink-0">
                  <span className="inline-flex items-center gap-1 text-slate-300">
                    <Trophy className="w-3 h-3 text-amber-400 shrink-0" />
                    <strong className="font-display text-white">
                      {ratings.ovr || '-'}
                    </strong>
                  </span>
                  <span className="h-3 w-px bg-slate-800" />
                  <span className="inline-flex items-center gap-0.5 text-emerald-300">
                    <Zap className="w-3 h-3 shrink-0" />
                    <strong className="font-display">{chemistry.total}</strong>
                  </span>
                </div>
              )}

            <button
              id="open-patchnotes-btn"
              type="button"
              onClick={() => setShowPatchNotes(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-[#0e141d] p-1.5 sm:px-2 sm:py-1 text-[11px] font-semibold text-slate-300 hover:border-slate-600 hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
              title="버전별 패치노트 열기"
            >
              <ScrollText className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span className="hidden md:inline">패치노트</span>
            </button>

            <button
              id="open-global-top15-btn"
              type="button"
              onClick={() => openLegacyModal('global_top15')}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-[#0e141d] p-1.5 sm:px-2 sm:py-1 text-[11px] font-semibold text-sky-300 hover:border-sky-400/50 hover:text-sky-200 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              title="일일 랭킹 (당일 TOP 10 · 주간 TOP 3 아카이브) 열기"
            >
              <Globe className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span className="hidden sm:inline">일일 랭킹</span>
            </button>

            {!isTitle && (
              <>
                <button
                  id="open-legacy-btn"
                  type="button"
                  onClick={() => openLegacyModal('hof')}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-[#0e141d] p-1.5 sm:px-2 sm:py-1 text-[11px] font-semibold text-amber-300 hover:border-amber-500/50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  title="명예의 전당 및 24종 히든 도전과제 열기"
                >
                  <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="hidden sm:inline">레거시</span>
                  <span className="hidden sm:inline font-mono text-[10px] text-amber-200/80">
                    {achProgress.unlocked}/{achProgress.total}
                  </span>
                </button>

                <button
                  id="open-tactics-guide-btn"
                  type="button"
                  onClick={() => setShowTacticsGuide(true)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-[#0e141d] p-1.5 sm:px-2 sm:py-1 text-[11px] font-semibold text-sky-300 hover:border-sky-500/50 hover:text-sky-200 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  title="전술 & 플레이스타일 상성 도감 · 부상 & 사기 가이드 열기"
                >
                  <BookOpen className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span className="hidden sm:inline">전술 도감</span>
                </button>

                <button
                  id="open-guide-btn"
                  type="button"
                  onClick={() => setGuideModalTab('budget')}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-[#0e141d] p-1.5 sm:px-2 sm:py-1 text-[11px] font-semibold text-slate-300 hover:border-slate-600 hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  title="게임 시스템 & 부상·사기 가이드 열기"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="hidden sm:inline">가이드</span>
                </button>

                <div className="shrink-0">
                  {!confirmReset ? (
                    <button
                      type="button"
                      onClick={() => setConfirmReset(true)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-[#0e141d] p-1.5 sm:px-2 sm:py-1 text-[11px] font-semibold text-slate-400 hover:border-slate-600 hover:text-white cursor-pointer whitespace-nowrap shrink-0"
                      title="처음으로 돌아가기"
                    >
                      <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                      <span className="hidden sm:inline">초기화</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-950/90 px-1.5 py-0.5 text-[11px] whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmReset(false);
                          resetGame();
                        }}
                        className="rounded bg-rose-500 px-1.5 py-0.5 font-bold text-white hover:bg-rose-400 cursor-pointer whitespace-nowrap"
                      >
                        확인
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmReset(false)}
                        className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-200 hover:bg-slate-700 cursor-pointer whitespace-nowrap"
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

      {guideModalTab && (
        <SystemGuideModal
          initialTab={guideModalTab}
          onClose={() => setGuideModalTab(null)}
          onOpenTutorial={() => {
            setGuideModalTab(null);
            setShowTutorialReplay(true);
          }}
        />
      )}
      {showTutorialReplay && (
        <SoloVisualTutorialModal
          open={showTutorialReplay}
          mode="replay"
          onClose={() => setShowTutorialReplay(false)}
        />
      )}
      <TacticsGuideModal
        open={showTacticsGuide}
        onClose={() => setShowTacticsGuide(false)}
      />
      {showPatchNotes && (
        <PatchNotesModal onClose={() => setShowPatchNotes(false)} />
      )}
    </>
  );
}
