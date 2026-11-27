import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Coins,
  Loader2,
  Lock,
  Play,
  ShieldAlert,
  Sparkles,
  Star,
  Trash2,
  Trophy,
} from 'lucide-react';
import { useState } from 'react';
import {
  loadStoryScenarioBundle,
  STORY_SCENARIOS,
} from '../../data/story/storyRegistry';
import { getTotalStoryStars } from '../../engine/storyModeEngine';
import { useGame } from '../../store/GameContext';
import type {
  StoryScenarioDataBundle,
  StoryScenarioMeta,
} from '../../types/storyMode';
import { JerseySvg } from '../common/JerseySvg';
import { PixelManagerAvatar } from '../common/PixelManagerAvatar';
import { StoryIntroModal } from './StoryIntroModal';

export function StoryModeHub() {
  const {
    storyCodex,
    activeStorySaveAvailable,
    enterStorySetup,
    resumeStorySave,
    abandonStorySave,
    exitStoryToTitle,
  } = useGame();

  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [introState, setIntroState] = useState<{
    meta: StoryScenarioMeta;
    bundle: StoryScenarioDataBundle;
  } | null>(null);

  const totalStars = getTotalStoryStars(storyCodex);
  const maxStars = STORY_SCENARIOS.length * 3;

  const handleSelectScenario = async (meta: StoryScenarioMeta) => {
    if (!meta.isPlayable || loadingId) return;
    setErrorMsg(null);
    setLoadingId(meta.id);
    try {
      const bundle = await loadStoryScenarioBundle(meta.id);
      setIntroState({ meta, bundle });
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : '시나리오 데이터를 불러오는 중 오류가 발생했습니다.',
      );
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <>
      <div className="mx-auto max-w-5xl px-3 py-4 sm:px-5 sm:py-6 space-y-4">
        {/* Header Bar */}
        <section className="rounded-2xl border border-slate-800/90 bg-gradient-to-b from-[#111927] to-[#0c121c] p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={exitStoryToTitle}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-700/80 bg-[#121a27] px-2.5 py-1 text-xs font-bold text-slate-300 hover:border-slate-500 hover:text-white cursor-pointer whitespace-nowrap"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  타이틀
                </button>
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/15 px-2.5 py-0.5 font-mono text-[10px] font-extrabold text-amber-300 whitespace-nowrap">
                  <BookOpen className="h-3 w-3" />
                  HISTORY STORY MODE
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                스토리 모드 — 역사 속 그 시즌으로
              </h1>
              <p
                className="text-xs sm:text-[13px] text-slate-400"
                style={{ wordBreak: 'keep-all' }}
              >
                실제 그 시절 스쿼드와 전술로 시즌에 뛰어듭니다. 스토리 모드는 빠른 선발 없이 직접 라인업을 지휘하며, 일일 글로벌 랭킹과 분리된 별 도감(★★★)으로 기록됩니다.
              </p>
            </div>

            <div className="flex items-center gap-2.5 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3.5 py-2.5 shrink-0">
              <Star className="h-5 w-5 fill-amber-400 text-amber-300 shrink-0" />
              <div className="leading-tight">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300/90">
                  수집한 별
                </div>
                <div className="font-display text-lg font-extrabold text-white tabular-nums">
                  {totalStars} <span className="text-xs text-slate-400">/ {maxStars}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Resume Active Story Save Banner */}
          {activeStorySaveAvailable && (
            <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-200">
                <Sparkles className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>진행 중인 스토리 모드 시즌 세이브가 있습니다.</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  id="story-resume-save-btn"
                  type="button"
                  onClick={() => resumeStorySave()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-extrabold text-slate-950 hover:bg-emerald-400 cursor-pointer whitespace-nowrap"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  이어하기
                </button>
                <button
                  type="button"
                  onClick={abandonStorySave}
                  className="inline-flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-950/40 px-2.5 py-1.5 text-[11px] font-bold text-rose-300 hover:bg-rose-500/20 cursor-pointer whitespace-nowrap"
                  title="진행 중인 스토리 세이브 삭제 (별 도감은 유지)"
                >
                  <Trash2 className="h-3 w-3" />
                  삭제
                </button>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="mt-3 rounded-xl border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-xs font-semibold text-rose-200">
              {errorMsg}
            </div>
          )}
        </section>

        {/* 5 Scenario Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {STORY_SCENARIOS.map((meta) => {
            const rec = storyCodex.records[meta.id];
            const bestStars = rec?.bestStars ?? 0;
            const achievedIds = new Set(rec?.achievedChecklistIds ?? []);
            const isLoading = loadingId === meta.id;

            return (
              <article
                key={meta.id}
                className={`flex flex-col justify-between rounded-2xl border p-4 transition-colors ${
                  meta.isPlayable
                    ? 'border-slate-800/95 bg-[#0e1522] hover:border-slate-600/90'
                    : 'border-slate-800/60 bg-[#0b1019]/85 opacity-80'
                }`}
              >
                <div className="space-y-3">
                  {/* Top Row: Club + Stars */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <JerseySvg
                        primaryColor={meta.clubProfile.primaryColor}
                        secondaryColor={meta.clubProfile.secondaryColor}
                        pattern={meta.clubProfile.pattern}
                        label={meta.clubShortName}
                        size={42}
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-amber-300 whitespace-nowrap">
                            {meta.seasonLabel}
                          </span>
                          <span className="rounded bg-slate-800/90 px-1.5 py-0.5 text-[10px] font-bold text-slate-300 whitespace-nowrap">
                            {meta.leagueLabel} · {meta.cupLabel}
                            {meta.hasUcl && meta.uclLabel ? ` · ${meta.uclLabel}` : ''}
                          </span>
                        </div>
                        <h2 className="mt-1 text-base font-extrabold text-white truncate">
                          {meta.clubName}
                        </h2>
                        <p className="text-xs font-bold text-amber-200/90 truncate">
                          《{meta.title}》
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3].map((idx) => (
                          <Star
                            key={idx}
                            className={`h-4 w-4 ${
                              idx <= bestStars
                                ? 'fill-amber-400 text-amber-300'
                                : 'text-slate-700'
                            }`}
                          />
                        ))}
                      </div>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-extrabold whitespace-nowrap ${
                          meta.difficulty === '극한'
                            ? 'bg-rose-500/15 text-rose-300 border border-rose-500/35'
                            : meta.difficulty === '어려움'
                              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/35'
                              : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/35'
                        }`}
                      >
                        난이도 {meta.difficulty}
                      </span>
                    </div>
                  </div>

                  {/* Manager & Transfer Rule / Era Cash */}
                  <div className="rounded-xl border border-slate-800/90 bg-[#090e17] px-3 py-2 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <PixelManagerAvatar
                          avatar={meta.managerAvatar}
                          clubPrimaryColor={meta.clubProfile.primaryColor}
                          clubSecondaryColor={meta.clubProfile.secondaryColor}
                          size={18}
                        />
                        <span className="font-bold text-slate-200 truncate">
                          {meta.managerName} 감독
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] font-extrabold text-emerald-300 whitespace-nowrap shrink-0">
                        <Coins className="h-3 w-3" />
                        €{meta.cashBudgetM}M
                      </span>
                    </div>
                    <div className="flex items-start gap-1.5 text-[10.5px] text-slate-400 leading-snug">
                      <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0 text-amber-400/80" />
                      <span style={{ wordBreak: 'keep-all' }}>
                        <strong className="text-slate-200">{meta.transferRuleLabel}</strong>
                        {' — '}
                        {meta.transferRuleReason}
                      </span>
                    </div>
                  </div>

                  {/* 3-Star Checklist */}
                  <ul className="space-y-1">
                    {meta.checklist.map((item) => {
                      const done = achievedIds.has(item.id);
                      return (
                        <li
                          key={item.id}
                          className={`flex items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] ${
                            done
                              ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200'
                              : 'border-slate-800/80 bg-[#0b101a] text-slate-300'
                          }`}
                        >
                          {done ? (
                            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                          ) : (
                            <Star className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-600" />
                          )}
                          <span style={{ wordBreak: 'keep-all' }}>
                            <strong className="text-white">★{item.starIndex}</strong>{' '}
                            {item.detail}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {/* Card Footer CTA */}
                <div className="mt-3.5 flex items-center justify-between gap-2 border-t border-slate-800/80 pt-3">
                  <div className="min-w-0 text-[10.5px] text-slate-400 truncate">
                    {rec?.bestSummaryText ? (
                      <span className="inline-flex items-center gap-1 text-amber-200/90">
                        <Trophy className="h-3 w-3 text-amber-400 shrink-0" />
                        최고: {rec.bestSummaryText}
                      </span>
                    ) : (
                      <span>미도전 시나리오</span>
                    )}
                  </div>

                  {meta.isPlayable ? (
                    <button
                      id={`story-card-start-${meta.id}`}
                      type="button"
                      disabled={Boolean(loadingId)}
                      onClick={() => handleSelectScenario(meta)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-extrabold text-slate-950 hover:bg-emerald-400 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          로딩 중...
                        </>
                      ) : (
                        <>
                          <span>스토리 시작</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </>
                      )}
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-xl border border-slate-700/80 bg-slate-900 px-3 py-2 text-[11px] font-bold text-slate-400 whitespace-nowrap shrink-0">
                      <Lock className="h-3 w-3" />
                      2차 업데이트 예정
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {introState && (
        <StoryIntroModal
          meta={introState.meta}
          onClose={() => setIntroState(null)}
          onProceed={() => {
            const bundle = introState.bundle;
            setIntroState(null);
            enterStorySetup(bundle);
          }}
        />
      )}
    </>
  );
}
