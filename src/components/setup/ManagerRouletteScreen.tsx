import { ArrowLeft, ArrowRight, Dices, RefreshCw, Sparkles, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MANAGER_TRAIT_LIST, MANAGER_TRAITS } from '../../data/managerTraits';
import { TACTICS } from '../../engine/tacticEngine';
import { useGame } from '../../store/GameContext';
import {
  HAIR_COLOR_OPTIONS,
  HAIR_STYLE_OPTIONS,
  OUTFIT_OPTIONS,
  PixelManagerAvatar,
  SKIN_TONE_OPTIONS,
} from '../common/PixelManagerAvatar';

export function ManagerRouletteScreen() {
  const {
    state,
    updateManagerProfile,
    spinManagerTrait,
    confirmManagerTrait,
    backToClubSetup,
    setDefaultTactic,
  } = useGame();
  const [isSpinning, setIsSpinning] = useState(false);
  const [previewIdx, setPreviewIdx] = useState(0);

  const { name, avatar, traitId, rerollsRemaining, hasSpun } = state.manager;
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
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-10 space-y-6">
      {/* Top Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={backToClubSetup}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#0e141d] px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-slate-600 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          1단계 구단·포메이션 설정
        </button>
        <span className="text-xs text-slate-400">
          {state.userClub.name} · {state.formation} · {TACTICS[state.defaultTactic].name}
        </span>
      </div>

      {/* Header */}
      <div className="text-center">
        <p className="text-[11px] font-bold tracking-[0.22em] text-emerald-400 uppercase">
          STEP 2 · MANAGER PROFILE &amp; TRAIT
        </p>
        <h1 className="mt-1 font-display text-3xl sm:text-4xl font-bold text-white">
          감독 프로필 &amp; 강점 룰렛
        </h1>
        <p className="mt-1.5 text-xs sm:text-sm text-slate-400">
          나만의 감독 이름과 도트 캐릭터를 꾸미고, 구단을 이끌 감독 강점을 추첨하세요.
        </p>
      </div>

      {/* Main 2-Column Workspace: Left = Pixel Avatar Customizer, Right = Trait Roulette */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left: Manager Name + 2-Head-Tall Pixel Avatar Customizer */}
        <section className="lg:col-span-5 rounded-2xl border border-slate-800/90 bg-[#0e141d] p-5 space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
            <User className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-white">감독 캐릭터 커스터마이징</h2>
          </div>

          {/* Live Sprite Stage + Name Input */}
          <div className="flex items-center gap-4 rounded-xl border border-slate-800/80 bg-[#090e15] p-4">
            <div className="flex h-28 w-24 shrink-0 items-center justify-center rounded-xl border border-slate-800 bg-[#121a26]">
              <PixelManagerAvatar
                avatar={avatar}
                clubPrimaryColor={state.userClub.primaryColor}
                clubSecondaryColor={state.userClub.secondaryColor}
                size={76}
              />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <label
                htmlFor="manager-name-input"
                className="block text-[11px] font-semibold text-slate-400"
              >
                감독 이름 (최대 14자)
              </label>
              <input
                id="manager-name-input"
                type="text"
                maxLength={14}
                value={name}
                onChange={(e) =>
                  updateManagerProfile({ name: e.target.value })
                }
                placeholder="감독 이름을 입력하세요"
                className="w-full rounded-lg border border-slate-700 bg-[#111925] px-3 py-2 text-sm font-bold text-white outline-none focus:border-emerald-400"
              />
              <p className="text-[11px] text-slate-500">
                하프타임 라커룸 · 시즌 결산 · 명예의 전당에 표시됩니다
              </p>
            </div>
          </div>

          {/* Skin Tone */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold text-slate-400">피부톤</div>
            <div className="flex flex-wrap gap-2">
              {SKIN_TONE_OPTIONS.map((opt) => {
                const selected = avatar.skinTone === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() =>
                      updateManagerProfile({ avatar: { skinTone: opt.id } })
                    }
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition cursor-pointer ${
                      selected
                        ? 'border-emerald-400 bg-emerald-500/15 text-white'
                        : 'border-slate-800 bg-[#111822] text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <span
                      className="h-3.5 w-3.5 rounded-full border border-black/40"
                      style={{ backgroundColor: opt.base }}
                    />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hair Style */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold text-slate-400">헤어스타일</div>
            <div className="grid grid-cols-2 gap-1.5">
              {HAIR_STYLE_OPTIONS.map((opt) => {
                const selected = avatar.hairStyle === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() =>
                      updateManagerProfile({ avatar: { hairStyle: opt.id } })
                    }
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                      selected
                        ? 'border-emerald-400 bg-emerald-500/15 text-white'
                        : 'border-slate-800 bg-[#111822] text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hair Color */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold text-slate-400">머리색</div>
            <div className="flex flex-wrap gap-2">
              {HAIR_COLOR_OPTIONS.map((opt) => {
                const selected = avatar.hairColor === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() =>
                      updateManagerProfile({ avatar: { hairColor: opt.id } })
                    }
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition cursor-pointer ${
                      selected
                        ? 'border-emerald-400 bg-emerald-500/15 text-white'
                        : 'border-slate-800 bg-[#111822] text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <span
                      className="h-3.5 w-3.5 rounded-full border border-white/20"
                      style={{ backgroundColor: opt.base }}
                    />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Manager Outfit */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold text-slate-400">감독 의상</div>
            <div className="flex flex-wrap gap-1.5">
              {OUTFIT_OPTIONS.map((opt) => {
                const selected = avatar.outfit === opt.id;
                const swatch =
                  opt.id === 'team_tracksuit'
                    ? state.userClub.primaryColor
                    : opt.previewColor;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() =>
                      updateManagerProfile({ avatar: { outfit: opt.id } })
                    }
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition cursor-pointer ${
                      selected
                        ? 'border-emerald-400 bg-emerald-500/15 text-white'
                        : 'border-slate-800 bg-[#111822] text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <span
                      className="h-3 w-3 rounded-sm border border-white/20"
                      style={{ backgroundColor: swatch }}
                    />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Right: Trait Roulette */}
        <section className="lg:col-span-7 flex flex-col justify-between rounded-2xl border border-slate-800/90 bg-[#0e141d] p-5 sm:p-6">
          <div
            className={`relative overflow-hidden rounded-2xl border p-6 text-center transition-all duration-200 ${
              isSpinning
                ? 'border-amber-400/70 bg-amber-950/20'
                : activeTrait
                  ? 'border-emerald-500/45 bg-[#0a1018]'
                  : 'border-dashed border-slate-700 bg-[#0a1018]'
            }`}
          >
            {displayTrait ? (
              <div className="space-y-3">
                <div
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-extrabold text-slate-950"
                  style={{ backgroundColor: displayTrait.badgeColor }}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {isSpinning ? '감독 강점 추첨 중...' : '획득한 감독 강점'}
                </div>
                <h2 className="font-display text-3xl font-bold text-white">
                  {displayTrait.name}
                </h2>
                <p className="text-sm font-semibold text-emerald-300">
                  &ldquo;{displayTrait.tagline}&rdquo;
                </p>
                <div className="mx-auto max-w-lg rounded-xl border border-slate-800 bg-[#0e1520] p-3.5 text-xs sm:text-sm text-slate-200 leading-relaxed">
                  {displayTrait.effectSummary}
                </div>

                {synergyTacticDef &&
                  activeTrait?.synergyTactic &&
                  activeTrait.synergyTactic !== state.defaultTactic && (
                    <div className="mx-auto flex max-w-lg flex-wrap items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
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
                        추천 전술 적용
                      </button>
                    </div>
                  )}
              </div>
            ) : (
              <div className="py-10 space-y-3">
                <Dices className="mx-auto w-11 h-11 text-amber-400" />
                <div className="text-base font-bold text-white">
                  14종 감독 강점 중 1가지를 추첨합니다
                </div>
                <p className="text-xs text-slate-400">
                  추첨 후 최대 2회까지 다시 뽑을 수 있습니다
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-center">
            {!hasSpun ? (
              <button
                id="spin-manager-btn"
                type="button"
                onClick={handleSpin}
                disabled={isSpinning}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-7 py-3 text-sm font-extrabold text-slate-950 shadow-lg shadow-amber-500/15 hover:bg-amber-300 disabled:opacity-60 transition-colors cursor-pointer"
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
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-xs sm:text-sm font-bold text-slate-200 hover:border-amber-400/60 hover:text-amber-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${isSpinning ? 'animate-spin' : ''}`} />
                  다시 뽑기 ({rerollsRemaining}회 남음)
                </button>

                <button
                  id="confirm-manager-btn"
                  type="button"
                  onClick={confirmManagerTrait}
                  disabled={isSpinning}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-xs sm:text-sm font-extrabold text-slate-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 disabled:opacity-60 transition-colors cursor-pointer"
                >
                  <span>16인 드래프트 시작</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </>
            )}
          </div>

          {/* Compact 14 Traits Reference */}
          <div className="mt-5 border-t border-slate-800/80 pt-4">
            <div className="mb-2 text-[11px] font-semibold text-slate-500">
              등장 가능한 14종 감독 강점
            </div>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 text-[11px]">
              {MANAGER_TRAIT_LIST.map((t) => {
                const isCurrent = displayTrait?.id === t.id;
                return (
                  <div
                    key={t.id}
                    className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 transition-colors ${
                      isCurrent
                        ? 'border-amber-400 bg-amber-500/15 text-white font-bold'
                        : 'border-slate-800/70 bg-[#090e15] text-slate-400'
                    }`}
                  >
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: t.badgeColor }}
                    />
                    <span className="truncate">{t.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
