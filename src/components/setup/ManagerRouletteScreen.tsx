import { ArrowLeft, ArrowRight, Dices, RefreshCw, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MANAGER_TRAIT_LIST, MANAGER_TRAITS } from '../../data/managerTraits';
import { TACTICS } from '../../engine/tacticEngine';
import { useGame } from '../../store/GameContext';

export function ManagerRouletteScreen() {
  const {
    state,
    spinManagerTrait,
    confirmManagerTrait,
    backToClubSetup,
    setDefaultTactic,
  } = useGame();
  const [isSpinning, setIsSpinning] = useState(false);
  const [previewIdx, setPreviewIdx] = useState(0);

  const { traitId, rerollsRemaining, hasSpun } = state.manager;
  const activeTrait = traitId ? MANAGER_TRAITS[traitId] : null;

  useEffect(() => {
    if (!isSpinning) return;
    const interval = window.setInterval(() => {
      setPreviewIdx((prev) => (prev + 1) % MANAGER_TRAIT_LIST.length);
    }, 65);
    const timeout = window.setTimeout(() => {
      window.clearInterval(interval);
      spinManagerTrait();
      setIsSpinning(false);
    }, 900);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [isSpinning, spinManagerTrait]);

  const handleSpin = () => {
    if (isSpinning) return;
    if (hasSpun && rerollsRemaining <= 0) return;
    setIsSpinning(true);
  };

  const displayTrait = isSpinning
    ? MANAGER_TRAIT_LIST[previewIdx]
    : activeTrait;
  const synergyTacticDef =
    !isSpinning && activeTrait?.synergyTactic
      ? TACTICS[activeTrait.synergyTactic]
      : null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={backToClubSetup}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#101822] px-3 py-1.5 text-xs font-bold text-slate-300 hover:border-slate-600 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          1단계 구단·포메이션 설정
        </button>
        <span className="text-xs text-slate-400">
          {state.userClub.name} · {state.formation} · {TACTICS[state.defaultTactic].name}
        </span>
      </div>

      <div className="mb-6 text-center">
        <p className="text-xs font-bold tracking-[0.2em] text-amber-400 uppercase">
          STEP 2 · MANAGER TRAIT ROULETTE
        </p>
        <h1 className="mt-1 font-display text-3xl sm:text-4xl font-bold text-white">
          감독 강점 룰렛
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          구단을 지휘할 감독의 전술 철학을 추첨하세요. 14종의 감독 강점 중 1가지를 획득할 수 있습니다 (최대 2회 리롤).
        </p>
      </div>

      {/* Roulette Display Box */}
      <div className="rounded-3xl border border-slate-800 bg-[#101822] p-6 sm:p-8 shadow-2xl">
        <div
          className={`relative overflow-hidden rounded-2xl border p-6 sm:p-8 text-center transition-all duration-200 ${
            isSpinning
              ? 'border-amber-400/70 bg-amber-950/20'
              : activeTrait
                ? 'border-emerald-400/60 bg-gradient-to-b from-slate-900 to-slate-950 shadow-[0_0_32px_rgba(16,185,129,0.12)]'
                : 'border-dashed border-slate-700 bg-slate-950/70'
          }`}
        >
          {displayTrait ? (
            <div className="space-y-3">
              <div
                className="inline-flex items-center gap-2 rounded-full px-3.5 py-1 text-xs font-extrabold text-slate-950"
                style={{ backgroundColor: displayTrait.badgeColor }}
              >
                <Sparkles className="w-3.5 h-3.5" />
                {isSpinning ? '감독 강점 추첨 중...' : '획득한 감독 강점'}
              </div>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-white">
                {displayTrait.name}
              </h2>
              <p className="text-sm font-semibold text-emerald-300">
                &ldquo;{displayTrait.tagline}&rdquo;
              </p>
              <div className="mx-auto max-w-xl rounded-xl border border-slate-800 bg-slate-950/85 p-4 text-xs sm:text-sm text-slate-200 leading-relaxed">
                {displayTrait.effectSummary}
              </div>

              {synergyTacticDef &&
                activeTrait?.synergyTactic &&
                activeTrait.synergyTactic !== state.defaultTactic && (
                  <div className="mx-auto flex max-w-xl flex-wrap items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-xs text-amber-200">
                    <span>
                      추천 시너지 전술: <strong>{synergyTacticDef.name}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setDefaultTactic(activeTrait.synergyTactic!)
                      }
                      className="rounded-lg bg-amber-400 px-2.5 py-1 text-[11px] font-extrabold text-slate-950 hover:bg-amber-300 transition-colors cursor-pointer"
                    >
                      추천 전술로 즉시 적용
                    </button>
                  </div>
                )}
            </div>
          ) : (
            <div className="py-8 space-y-3">
              <Dices className="mx-auto w-12 h-12 text-amber-400" />
              <div className="text-lg font-extrabold text-white">
                아직 감독 강점을 뽑지 않았습니다
              </div>
              <p className="text-xs text-slate-400">
                아래 [감독 강점 룰렛 돌리기] 버튼을 눌러 나만의 전술 철학을 획득하세요!
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
          {!hasSpun ? (
            <button
              id="spin-manager-btn"
              type="button"
              onClick={handleSpin}
              disabled={isSpinning}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-8 py-3.5 text-sm font-extrabold text-slate-950 shadow-lg shadow-amber-500/20 hover:bg-amber-300 disabled:opacity-60 transition-colors cursor-pointer"
            >
              <Dices className={`w-4 h-4 ${isSpinning ? 'animate-spin' : ''}`} />
              {isSpinning ? '룰렛 회전 중...' : '감독 강점 룰렛 돌리기'}
            </button>
          ) : (
            <>
              <button
                id="reroll-manager-btn"
                type="button"
                onClick={handleSpin}
                disabled={isSpinning || rerollsRemaining <= 0}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-bold text-slate-200 hover:border-amber-400/60 hover:text-amber-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${isSpinning ? 'animate-spin' : ''}`} />
                다시 뽑기 (남은 리롤: {rerollsRemaining}회)
              </button>

              <button
                id="confirm-manager-btn"
                type="button"
                onClick={confirmManagerTrait}
                disabled={isSpinning}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-7 py-3 text-sm font-extrabold text-slate-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 disabled:opacity-60 transition-colors cursor-pointer"
              >
                <span>이 강점으로 16인 드래프트 시작하기</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* All 14 Traits Preview Strip */}
      <div className="mt-6 rounded-2xl border border-slate-800/80 bg-[#101822]/75 p-4">
        <div className="mb-3 text-xs font-bold text-slate-400">
          등장 가능한 14종 감독 강점 목록
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 text-[11px]">
          {MANAGER_TRAIT_LIST.map((t) => {
            const isCurrent = displayTrait?.id === t.id;
            return (
              <div
                key={t.id}
                className={`rounded-lg border px-2.5 py-2 transition-colors ${
                  isCurrent
                    ? 'border-amber-400 bg-amber-500/15 text-white font-bold'
                    : 'border-slate-800/90 bg-slate-950/50 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: t.badgeColor }}
                  />
                  <span className="truncate">{t.name}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
