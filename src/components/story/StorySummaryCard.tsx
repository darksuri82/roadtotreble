import {
  ArrowLeft,
  CheckCircle2,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Star,
  XCircle,
} from 'lucide-react';
import {
  getStoryScenarioMeta,
  loadStoryScenarioBundle,
} from '../../data/story/storyRegistry';
import { useGame } from '../../store/GameContext';

export function StorySummaryCard() {
  const {
    state,
    storyChecklist,
    storyLastNewBest,
    storyCodex,
    enterStorySetup,
    openStoryHub,
  } = useGame();

  if (!state.storyMode || !state.season || !storyChecklist) return null;

  const meta = getStoryScenarioMeta(state.storyMode.scenarioId);
  const isFinalized =
    !state.storyMode.hasUcl || Boolean(state.season.ucl?.completed);
  const prevBest = storyCodex.records[state.storyMode.scenarioId]?.bestStars ?? 0;

  const handleReplay = async () => {
    const bundle = await loadStoryScenarioBundle(meta.id);
    enterStorySetup(bundle);
  };

  return (
    <section
      id="story-summary-card"
      className="rounded-2xl border border-amber-500/45 bg-gradient-to-b from-[#171925] via-[#111622] to-[#0c111b] p-4 sm:p-5 space-y-4 shadow-[0_18px_45px_-20px_rgba(0,0,0,0.9)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/45 bg-amber-500/15 px-2.5 py-0.5 font-mono text-[10px] font-extrabold text-amber-300">
              <Sparkles className="h-3 w-3" />
              STORY {meta.seasonLabel} 결산
            </span>
            {isFinalized && storyLastNewBest && storyChecklist.starsEarned > 0 && (
              <span className="rounded-full border border-emerald-400/50 bg-emerald-500/20 px-2 py-0.5 text-[10px] font-extrabold text-emerald-200">
                NEW BEST!
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
              <ShieldCheck className="h-3 w-3 text-slate-400" />
              일일 랭킹 미제출 · 별 도감 전용
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-extrabold text-white">
            {meta.clubName} — 《{meta.title}》
          </h2>
          <p className="text-xs text-slate-400">
            {isFinalized
              ? storyChecklist.isAllClear
                ? '모든 역사적 미션을 완벽히 정복했습니다! (★★★ ALL CLEAR)'
                : `이번 시즌 ${storyChecklist.starsEarned}개의 별을 획득했습니다. (최고 기록: ★ ${Math.max(prevBest, storyChecklist.starsEarned)}/3)`
              : `${meta.uclLabel ?? 'UCL 16강'} 토너먼트가 남아 있습니다. 아래 버튼으로 챔스 16강에 도전해 남은 별을 노려보세요!`}
          </p>
        </div>

        {/* Big 3-Star Display */}
        <div className="flex items-center gap-1.5 rounded-xl border border-amber-400/35 bg-[#0a0f18] px-4 py-2.5 shrink-0">
          {[1, 2, 3].map((idx) => {
            const achieved = storyChecklist.items[idx - 1]?.status === 'achieved';
            return (
              <Star
                key={idx}
                className={`h-7 w-7 ${
                  achieved
                    ? 'fill-amber-400 text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.45)]'
                    : 'text-slate-700'
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* 3 Checklist Results */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {storyChecklist.items.map((item) => {
          const isOk = item.status === 'achieved';
          const isFail = item.status === 'failed';
          return (
            <div
              key={item.id}
              className={`rounded-xl border p-3 space-y-1 ${
                isOk
                  ? 'border-emerald-500/45 bg-emerald-500/12'
                  : isFail
                    ? 'border-rose-500/35 bg-rose-500/10'
                    : 'border-slate-800 bg-[#0b1019]'
              }`}
            >
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-xs font-extrabold text-white">
                  ★{item.starIndex} {item.shortLabel}
                </span>
                {isOk ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                ) : isFail ? (
                  <XCircle className="h-4 w-4 text-rose-400 shrink-0" />
                ) : (
                  <Star className="h-4 w-4 text-amber-400/60 shrink-0" />
                )}
              </div>
              <div className="text-[11px] font-semibold text-slate-300">
                {item.progressText}
              </div>
              <div className="text-[10px] text-slate-400">{item.detail}</div>
            </div>
          );
        })}
      </div>

      {/* Story Mode Actions */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => void handleReplay()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/50 bg-amber-500/15 px-4 py-2 text-xs font-extrabold text-amber-200 hover:bg-amber-500/25 cursor-pointer whitespace-nowrap"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          이 시나리오 재도전
        </button>
        <button
          type="button"
          onClick={openStoryHub}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-bold text-slate-200 hover:border-slate-500 hover:text-white cursor-pointer whitespace-nowrap"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          스토리 허브로
        </button>
      </div>
    </section>
  );
}
