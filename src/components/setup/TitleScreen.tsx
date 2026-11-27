import {
  ArrowRight,
  BookOpen,
  Crown,
  Globe,
  GraduationCap,
  Play,
  ScrollText,
  SlidersHorizontal,
  Sparkles,
  Swords,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { CURRENT_APP_VERSION } from '../../data/patchNotes';
import { getAchievementProgress } from '../../engine/legacyEngine';
import { useGame } from '../../store/GameContext';
import { JerseySvg } from '../common/JerseySvg';
import { PatchNotesModal } from '../common/PatchNotesModal';
import { PixelManagerAvatar } from '../common/PixelManagerAvatar';
import { ProfileCustomizerModal } from '../common/ProfileCustomizerModal';
import {
  isWhatsNewDismissed,
  WhatsNewModal,
} from '../common/WhatsNewModal';
import {
  isSoloTutorialDismissed,
  SoloVisualTutorialModal,
} from '../guide/SoloVisualTutorialModal';
import { SystemGuideModal } from '../guide/SystemGuideModal';
import { RoadToTrebleHeroSvg } from './RoadToTrebleHeroSvg';

let whatsNewClosedThisSession = false;

const ROAD_STAGES = [
  { label: '드래프트', accent: 'text-emerald-300', dot: 'bg-emerald-400' },
  { label: '5대 리그', accent: 'text-slate-200', dot: 'bg-slate-400' },
  { label: '자국 컵', accent: 'text-rose-300', dot: 'bg-rose-400' },
  { label: '챔피언스리그', accent: 'text-amber-300', dot: 'bg-amber-400' },
] as const;

export function TitleScreen() {
  const {
    state,
    startNewCareer,
    applyUserProfile,
    legacyState,
    openLegacyModal,
    openDreamMatch,
    openMultiplayer,
  } = useGame();
  const [showGuide, setShowGuide] = useState(false);
  const [showPatchNotes, setShowPatchNotes] = useState(false);
  const [showProfileCustomizer, setShowProfileCustomizer] = useState(false);
  const [showWhatsNew, setShowWhatsNew] = useState<boolean>(
    () => !whatsNewClosedThisSession && !isWhatsNewDismissed(CURRENT_APP_VERSION),
  );
  const [tutorialMode, setTutorialMode] = useState<
    'onboarding' | 'replay' | null
  >(null);
  const achProgress = getAchievementProgress(legacyState);
  const seasonCount = legacyState.hallOfFame.length;

  const handleStartSoloClick = () => {
    if (!isSoloTutorialDismissed()) {
      setTutorialMode('onboarding');
      return;
    }
    startNewCareer();
  };

  return (
    <>
      <div className="mx-auto flex min-h-[calc(100dvh-48px)] max-w-4xl flex-col justify-center px-3 py-2.5 sm:px-5 sm:py-6">
        {/* Official Road To Treble Hero */}
        <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-800/90 bg-gradient-to-b from-[#101824] via-[#0d131c] to-[#0a1018] px-3 py-3.5 text-center shadow-[0_24px_60px_-24px_rgba(0,0,0,0.85)] ring-1 ring-white/[0.03] sm:px-9 sm:py-7">
          {/* Subtle top ambient crown light (restrained, dark-tone native) */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[24rem] -translate-x-1/2 rounded-full bg-emerald-500/[0.09] blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/35 to-transparent"
          />

          <div className="relative mx-auto max-w-2xl">
            {/* Minimal Eyebrow */}
            <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] sm:text-[11px] font-semibold tracking-[0.2em] text-slate-400 uppercase">
              <span className="font-mono text-slate-400">2026-27</span>
              <span className="text-slate-700">·</span>
              <button
                id="hero-version-badge"
                type="button"
                onClick={() => setShowWhatsNew(true)}
                className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-300 hover:border-emerald-400/50 hover:text-emerald-200 transition-colors cursor-pointer"
                title="주요 업데이트 안내 보기"
              >
                <Sparkles className="h-2.5 w-2.5" />
                <span>{CURRENT_APP_VERSION}</span>
              </button>
              <span className="text-slate-700">·</span>
              <button
                id="hero-tutorial-btn"
                type="button"
                onClick={() => setTutorialMode('replay')}
                className="inline-flex items-center gap-1 tracking-normal font-bold text-slate-300 hover:text-emerald-300 transition-colors cursor-pointer whitespace-nowrap"
              >
                <GraduationCap className="h-3 w-3 text-emerald-400 shrink-0" />
                입문 튜토리얼
              </button>
            </div>

            {/* Official Game Title with Refined Emblem Framing */}
            <div className="mt-1.5 sm:mt-2 flex flex-col items-center">
              <div className="flex items-center justify-center gap-2.5 sm:gap-4">
                <span
                  aria-hidden="true"
                  className="hidden sm:block h-px w-8 bg-gradient-to-r from-transparent via-emerald-400/50 to-amber-300/70"
                />
                <h1 className="font-display title-emblem-wordmark bg-gradient-to-b from-white via-slate-100 to-amber-100/95 bg-clip-text text-[2rem] leading-none font-bold tracking-[0.04em] text-transparent sm:text-[3.35rem]">
                  ROAD TO TREBLE
                </h1>
                <span
                  aria-hidden="true"
                  className="hidden sm:block h-px w-8 bg-gradient-to-l from-transparent via-emerald-400/50 to-amber-300/70"
                />
              </div>
              <div
                aria-hidden="true"
                className="mt-1.5 flex items-center gap-1.5"
              >
                <span className="h-px w-10 bg-gradient-to-r from-transparent to-emerald-400/50" />
                <span className="h-1 w-1 rotate-45 bg-amber-400/80" />
                <span className="h-px w-10 bg-gradient-to-l from-transparent to-emerald-400/50" />
              </div>
            </div>

            {/* High-Density Retro Pixel "Road To Treble" Centerpiece */}
            <div className="mx-auto mt-2.5 sm:mt-4 max-w-xl overflow-hidden rounded-xl sm:rounded-2xl border border-slate-700/75 bg-[#060b14] shadow-[0_14px_34px_-16px_rgba(0,0,0,0.9)] ring-1 ring-white/[0.04]">
              <RoadToTrebleHeroSvg
                managerAvatar={state.manager.avatar}
                clubPrimaryColor={state.userClub.primaryColor}
                clubSecondaryColor={state.userClub.secondaryColor}
              />
              <div className="grid grid-cols-4 border-t border-slate-800/90 bg-[#0a1019] px-1.5 py-1.5 sm:px-2.5 sm:py-2 text-[10px] font-bold sm:text-[11px]">
                {ROAD_STAGES.map((stage, idx) => (
                  <div
                    key={stage.label}
                    className={`flex items-center justify-center gap-1 min-w-0 ${stage.accent}`}
                  >
                    <span
                      aria-hidden="true"
                      className={`hidden sm:inline-block h-1.5 w-1.5 rounded-full shrink-0 opacity-75 ${stage.dot}`}
                    />
                    <span className="font-mono text-[9px] text-slate-500 shrink-0">
                      0{idx + 1}
                    </span>
                    <span className="truncate whitespace-nowrap">
                      {stage.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Slim 1-Line Compact Manager & Club Profile Bar (~50px height) */}
            <div className="mx-auto mt-2.5 sm:mt-3.5 max-w-xl">
              <button
                id="title-profile-customizer-btn"
                type="button"
                onClick={() => setShowProfileCustomizer(true)}
                className="group flex h-[50px] w-full items-center justify-between gap-2 rounded-xl border border-slate-800/90 bg-[#0b111b] px-2.5 py-1.5 text-left transition-colors hover:border-emerald-500/45 hover:bg-[#101826] cursor-pointer touch-manipulation sm:px-3"
                title="감독 외형 · 이름 · 구단명 · 유니폼 커스텀"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="flex h-8 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-[#080d14]">
                    <PixelManagerAvatar
                      avatar={state.manager.avatar}
                      clubPrimaryColor={state.userClub.primaryColor}
                      clubSecondaryColor={state.userClub.secondaryColor}
                      size={22}
                    />
                  </div>
                  <JerseySvg
                    primaryColor={state.userClub.primaryColor}
                    secondaryColor={state.userClub.secondaryColor}
                    pattern={state.userClub.pattern}
                    label={state.userClub.shortName}
                    size={26}
                  />
                  <div className="min-w-0 flex-1 leading-tight">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="truncate text-xs sm:text-[13px] font-extrabold text-white">
                        {state.userClub.name}
                      </span>
                      <span className="rounded border border-emerald-500/25 bg-emerald-500/10 px-1 py-px font-mono text-[9.5px] font-bold text-emerald-300 shrink-0">
                        {state.userClub.shortName}
                      </span>
                    </div>
                    <div className="truncate text-[10px] sm:text-[11px] text-slate-400">
                      {state.manager.name} 감독
                    </div>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1 rounded-lg border border-slate-700/80 bg-[#121b28] px-2.5 py-1.5 text-[11px] font-bold text-slate-200 transition-colors group-hover:border-emerald-400/50 group-hover:bg-emerald-500/12 group-hover:text-emerald-200 whitespace-nowrap shrink-0">
                  <SlidersHorizontal className="h-3 w-3 text-emerald-400 shrink-0" />
                  감독 커스텀
                </span>
              </button>
            </div>

            {/* Primary CTAs — Clear Game-Title Hierarchy */}
            <div className="mx-auto mt-3 sm:mt-4 max-w-xl grid grid-cols-2 gap-2 sm:flex sm:flex-row sm:items-center sm:justify-center sm:gap-2.5">
              <button
                id="title-start-btn"
                type="button"
                onClick={handleStartSoloClick}
                className="col-span-2 sm:col-span-1 sm:flex-1 group inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300/60 bg-gradient-to-b from-emerald-400 to-emerald-500 px-4 py-3 sm:px-6 sm:py-3.5 text-sm font-extrabold text-slate-950 shadow-[0_3px_0_0_#047857,0_10px_24px_-6px_rgba(16,185,129,0.38)] transition-all hover:from-emerald-300 hover:to-emerald-400 active:translate-y-[1px] active:shadow-[0_1px_0_0_#047857] cursor-pointer touch-manipulation sm:text-base"
              >
                <Play className="h-4 w-4 fill-current shrink-0" />
                <span className="whitespace-nowrap">새 시즌 시작</span>
                <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
              </button>

              <button
                id="title-multiplayer-btn"
                type="button"
                onClick={() => openMultiplayer(null)}
                className="group inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-xl border border-sky-400/40 bg-[#0d1928] px-3 py-2.5 sm:px-4 sm:py-3.5 text-xs font-extrabold text-sky-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors hover:border-sky-300/70 hover:bg-sky-500/18 cursor-pointer touch-manipulation sm:w-auto sm:text-sm"
              >
                <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-sky-300 shrink-0" />
                <span className="whitespace-nowrap">멀티플레이</span>
                <span className="hidden sm:inline rounded bg-sky-400/18 px-1.5 py-0.5 text-[10px] font-bold text-sky-300 whitespace-nowrap">
                  1v1 · 리그
                </span>
              </button>

              <button
                id="title-dream-match-btn"
                type="button"
                onClick={() => openDreamMatch(null)}
                className="group inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-xl border border-amber-400/40 bg-[#1a160c] px-3 py-2.5 sm:px-4 sm:py-3.5 text-xs font-extrabold text-amber-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors hover:border-amber-300/70 hover:bg-amber-500/18 cursor-pointer touch-manipulation sm:w-auto sm:text-sm"
              >
                <Swords className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-300 shrink-0" />
                <span className="whitespace-nowrap">드림 매치</span>
                <span className="hidden sm:inline rounded bg-amber-400/18 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 whitespace-nowrap">
                  역대·시대별 XI
                </span>
              </button>
            </div>
          </div>
        </section>

        {/* Clean Compact 2x2 / 4-Col Auxiliary Menu Bar */}
        <nav
          aria-label="보조 메뉴"
          className="mt-2.5 sm:mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5"
        >
          <button
            id="title-legacy-card"
            type="button"
            onClick={() => openLegacyModal('hof')}
            className="group flex items-center justify-between gap-1.5 sm:gap-2 rounded-xl sm:rounded-2xl border border-slate-800/90 bg-[#0d131c] px-2.5 py-2.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-colors hover:border-amber-500/45 hover:bg-[#121a26] cursor-pointer touch-manipulation sm:px-3 sm:py-2.5"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg border border-amber-500/20 bg-amber-500/10">
                <Crown className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-400" />
              </span>
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-white sm:text-[13px] truncate">
                  명예의 전당
                </div>
                <div className="text-[10px] font-mono text-slate-400 truncate sm:text-[11px]">
                  {seasonCount}시즌 · {achProgress.unlocked}/{achProgress.total}
                </div>
              </div>
            </div>
            <ArrowRight className="hidden h-3.5 w-3.5 shrink-0 text-slate-600 group-hover:text-amber-300 sm:block" />
          </button>

          <button
            id="title-global-top15-card"
            type="button"
            onClick={() => openLegacyModal('global_top15')}
            className="group flex items-center justify-between gap-1.5 sm:gap-2 rounded-xl sm:rounded-2xl border border-slate-800/90 bg-[#0d131c] px-2.5 py-2.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-colors hover:border-sky-400/45 hover:bg-[#121a26] cursor-pointer touch-manipulation sm:px-3 sm:py-2.5"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg border border-sky-500/20 bg-sky-500/10">
                <Globe className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-sky-400" />
              </span>
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-white sm:text-[13px] truncate">
                  일일 랭킹
                </div>
                <div className="text-[10px] text-sky-300/90 truncate sm:text-[11px]">
                  오늘 TOP 10 · 1대1
                </div>
              </div>
            </div>
            <ArrowRight className="hidden h-3.5 w-3.5 shrink-0 text-slate-600 group-hover:text-sky-300 sm:block" />
          </button>

          <button
            id="title-patchnotes-card"
            type="button"
            onClick={() => setShowPatchNotes(true)}
            className="group flex items-center justify-between gap-1.5 sm:gap-2 rounded-xl sm:rounded-2xl border border-slate-800/90 bg-[#0d131c] px-2.5 py-2.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-colors hover:border-sky-500/45 hover:bg-[#121a26] cursor-pointer touch-manipulation sm:px-3 sm:py-2.5"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg border border-sky-500/20 bg-sky-500/10">
                <ScrollText className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-sky-400" />
              </span>
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-white sm:text-[13px] truncate">
                  패치노트
                </div>
                <div className="text-[10px] font-mono text-sky-400 truncate sm:text-[11px]">
                  {CURRENT_APP_VERSION}
                </div>
              </div>
            </div>
            <ArrowRight className="hidden h-3.5 w-3.5 shrink-0 text-slate-600 group-hover:text-sky-300 sm:block" />
          </button>

          <button
            id="title-guide-card"
            type="button"
            onClick={() => setShowGuide(true)}
            className="group flex items-center justify-between gap-1.5 sm:gap-2 rounded-xl sm:rounded-2xl border border-slate-800/90 bg-[#0d131c] px-2.5 py-2.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-colors hover:border-emerald-500/45 hover:bg-[#121a26] cursor-pointer touch-manipulation sm:px-3 sm:py-2.5"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10">
                <BookOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-400" />
              </span>
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-white sm:text-[13px] truncate">
                  가이드
                </div>
                <div className="text-[10px] text-slate-400 truncate sm:text-[11px]">
                  전술 · 케미 · 룰
                </div>
              </div>
            </div>
            <ArrowRight className="hidden h-3.5 w-3.5 shrink-0 text-slate-600 group-hover:text-emerald-300 sm:block" />
          </button>
        </nav>
      </div>

      {showProfileCustomizer && (
        <ProfileCustomizerModal
          initialNickname={state.manager.name}
          initialAvatar={state.manager.avatar}
          initialClubProfile={state.userClub}
          onApply={({ nickname, avatar, clubProfile }) =>
            applyUserProfile({
              clubProfile,
              managerName: nickname,
              managerAvatar: avatar,
            })
          }
          onClose={() => setShowProfileCustomizer(false)}
        />
      )}
      {showGuide && (
        <SystemGuideModal
          onClose={() => setShowGuide(false)}
          onOpenTutorial={() => {
            setShowGuide(false);
            setTutorialMode('replay');
          }}
        />
      )}
      {tutorialMode && (
        <SoloVisualTutorialModal
          key={tutorialMode}
          open={Boolean(tutorialMode)}
          mode={tutorialMode}
          onClose={() => setTutorialMode(null)}
          onProceed={startNewCareer}
        />
      )}
      {showPatchNotes && (
        <PatchNotesModal onClose={() => setShowPatchNotes(false)} />
      )}
      {showWhatsNew && (
        <WhatsNewModal
          onClose={() => {
            whatsNewClosedThisSession = true;
            setShowWhatsNew(false);
          }}
          onOpenPatchNotes={() => {
            whatsNewClosedThisSession = true;
            setShowWhatsNew(false);
            setShowPatchNotes(true);
          }}
        />
      )}
    </>
  );
}
