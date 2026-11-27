import {
  ArrowLeft,
  ArrowRight,
  Award,
  Check,
  Crown,
  Dices,
  Flame,
  Shield,
  Sparkles,
  Target,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import {
  MANAGER_TRAIT_LIST,
  MANAGER_TRAITS,
  type ManagerTraitCategory,
} from '../../data/managerTraits';
import { PLAYSTYLES } from '../../data/playstyles';
import { TACTICS } from '../../engine/tacticEngine';
import { useGame } from '../../store/GameContext';
import type { ManagerTraitId } from '../../types/game';
import { ActiveProfileChip } from '../common/ActiveProfileChip';
import { InfoHelpButton } from '../common/InfoHelpButton';

function TraitIcon({ traitId }: { traitId: ManagerTraitId }) {
  switch (traitId) {
    case 'tiki_taka':
    case 'midfield_maestro':
    case 'total_football':
      return <Sparkles className="h-4 w-4" />;
    case 'gegenpress_guru':
    case 'wing_bomber':
    case 'direct_football':
      return <Flame className="h-4 w-4" />;
    case 'catenaccio':
    case 'defensive_architect':
      return <Shield className="h-4 w-4" />;
    case 'big_game_hunter':
    case 'galactico_manager':
      return <Crown className="h-4 w-4" />;
    case 'set_piece_master':
    case 'underdog_killer':
      return <Target className="h-4 w-4" />;
    case 'halftime_wizard':
    case 'super_sub':
      return <Zap className="h-4 w-4" />;
    default:
      return <Award className="h-4 w-4" />;
  }
}

export function ManagerRouletteScreen() {
  const {
    state,
    selectManagerTrait,
    spinManagerTrait,
    confirmManagerTrait,
    backToClubSetup,
    setDefaultTactic,
  } = useGame();

  const [traitFilter, setTraitFilter] = useState<'all' | ManagerTraitCategory>(
    'all',
  );
  const { traitId } = state.manager;
  const activeTrait = traitId ? MANAGER_TRAITS[traitId] : null;
  const builderCount = MANAGER_TRAIT_LIST.filter(
    (t) => t.category === 'builder',
  ).length;
  const specialistCount = MANAGER_TRAIT_LIST.filter(
    (t) => t.category === 'specialist',
  ).length;
  const filteredTraits =
    traitFilter === 'all'
      ? MANAGER_TRAIT_LIST
      : MANAGER_TRAIT_LIST.filter((t) => t.category === traitFilter);

  const synergyTacticDef = activeTrait?.synergyTactic
    ? TACTICS[activeTrait.synergyTactic]
    : null;

  return (
    <div className="mx-auto max-w-6xl px-3.5 py-5 sm:px-4 sm:py-7 space-y-5">
      {/* Top Breadcrumb + Compact Active Profile Chip */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={backToClubSetup}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#0e141d] px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-slate-600 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
          >
            <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
            1단계 포메이션·전술 설정
          </button>
          <span className="rounded-lg border border-slate-800/80 bg-[#0a1018] px-2.5 py-1 text-[11px] font-semibold text-slate-300 whitespace-nowrap">
            {state.formation} · {TACTICS[state.defaultTactic].shortName}
          </span>
        </div>

        <ActiveProfileChip />
      </div>

      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold tracking-[0.22em] text-emerald-400 uppercase">
            STEP 2 · MANAGER SPECIALTY
          </p>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-white">
            감독 특성 선택
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              ['all', `전체 ${MANAGER_TRAIT_LIST.length}`],
              ['builder', `빌드업·전술형 ${builderCount}`],
              ['specialist', `스페셜리스트 ${specialistCount}`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTraitFilter(key)}
              className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                traitFilter === key
                  ? 'border-emerald-400/60 bg-slate-800 text-white'
                  : 'border-slate-800 bg-[#0a1018] text-slate-400 hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
          <button
            id="spin-manager-btn"
            type="button"
            onClick={spinManagerTrait}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#121a26] px-3 py-1 text-[11px] font-bold text-amber-300 hover:border-amber-400/60 hover:bg-amber-500/10 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Dices className="h-3.5 w-3.5 shrink-0" />
            랜덤 선택
          </button>
        </div>
      </div>

      {/* Full-Width Direct Selection Workspace for All 14 Manager Traits */}
      <section className="rounded-2xl border border-slate-800/90 bg-[#0e141d] p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-1.5">
            <h2 className="text-sm font-bold text-white">
              감독 능력(강점) 직접 선택 ({MANAGER_TRAIT_LIST.length}종)
            </h2>
            <InfoHelpButton
              title="감독 특성 · 궁합 규칙"
              align="left"
              guideTab="squad"
              items={[
                '빌드업·전술형(8종): 전라인(11명)·라인/측면(6명)·갈락티코(4명) 목표에 따라 팀 A/M/D 점진 강화 + ★추천 전술 시 추가 보너스',
                '스페셜리스트(6종): 포지션 유연성·하프타임 전환·후반 조커·빅매치·언더독·세트피스 특화',
                '★ 감독 궁합: 스타일·조건 일치 선수 전원에게 인접 시너지(+3)와 별개로 개인 +1 OVR (최대 +4)',
              ]}
            />
          </div>
          {activeTrait && (
            <span className="text-[11px] font-bold text-emerald-300 whitespace-nowrap">
              선택됨: {activeTrait.name}
            </span>
          )}
        </div>

        {/* 14-Trait Direct Selection Card Grid (no nested scroll container!) */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTraits.map((t) => {
            const selected = traitId === t.id;
            const synTactic = t.synergyTactic ? TACTICS[t.synergyTactic] : null;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => selectManagerTrait(t.id)}
                className={`group relative flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all cursor-pointer break-keep ${
                  selected
                    ? 'border-emerald-400 bg-emerald-950/30 shadow-md shadow-emerald-500/10'
                    : 'border-slate-800 bg-[#0a1018] hover:border-slate-600 hover:bg-[#101824]'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-950"
                        style={{ backgroundColor: t.badgeColor }}
                      >
                        <TraitIcon traitId={t.id} />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-extrabold text-white truncate">
                            {t.name}
                          </span>
                          {selected && (
                            <span className="inline-flex items-center gap-0.5 rounded bg-emerald-400 px-1.5 py-px text-[9px] font-black text-slate-950 whitespace-nowrap shrink-0">
                              <Check className="h-2.5 w-2.5" />
                              선택됨
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {t.tagline}
                        </div>
                      </div>
                    </div>
                    {synTactic ? (
                      <span className="shrink-0 rounded bg-slate-800/90 px-1.5 py-0.5 text-[10px] font-semibold text-sky-300 whitespace-nowrap">
                        ★ {synTactic.shortName} · 1~{t.philosophyTarget}명
                      </span>
                    ) : (
                      <span
                        className={`shrink-0 rounded border px-1.5 py-0.5 text-[9.5px] font-semibold whitespace-nowrap ${
                          t.philosophyTarget > 0
                            ? 'border-amber-400/30 bg-amber-500/10 text-amber-200'
                            : 'border-sky-400/30 bg-sky-500/10 text-sky-200'
                        }`}
                      >
                        {t.philosophyTarget > 0
                          ? `1~${t.philosophyTarget}명 비례`
                          : '팀 효과 인원 무관'}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-300">
                    {t.effectSummary}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Trait Footer + Compatible Playstyles + CTA */}
        <div className="rounded-xl border border-slate-800 bg-[#090e15] p-4 space-y-3">
          {activeTrait ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="rounded px-2 py-0.5 text-[10px] font-black text-slate-950 whitespace-nowrap"
                    style={{ backgroundColor: activeTrait.badgeColor }}
                  >
                    선택한 능력
                  </span>
                  <span className="text-sm font-extrabold text-white">
                    {activeTrait.name}
                  </span>
                  {synergyTacticDef &&
                    activeTrait.synergyTactic &&
                    activeTrait.synergyTactic !== state.defaultTactic && (
                      <button
                        type="button"
                        onClick={() =>
                          setDefaultTactic(activeTrait.synergyTactic!)
                        }
                        className="rounded-md border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-200 hover:bg-amber-500/25 cursor-pointer whitespace-nowrap"
                      >
                        추천 전술({synergyTacticDef.shortName}) 즉시 적용
                      </button>
                    )}
                </div>
                <p className="text-xs text-slate-400 break-keep">
                  {activeTrait.effectSummary}
                </p>
                <div className="flex flex-wrap items-center gap-1 pt-0.5">
                  <span className="text-[10px] font-bold text-amber-300/90 mr-0.5 whitespace-nowrap">
                    ★ 궁합(+1):
                  </span>
                  {activeTrait.synergyPlaystyles.map((ps) => (
                    <span
                      key={ps}
                      className="rounded border border-slate-700/90 bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold text-slate-200 whitespace-nowrap"
                    >
                      {PLAYSTYLES[ps]?.shortName ?? ps}
                    </span>
                  ))}
                  {activeTrait.id === 'galactico_manager' && (
                    <span className="rounded border border-amber-400/35 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200 whitespace-nowrap">
                      OVR 87+ · 클래식
                    </span>
                  )}
                  {activeTrait.id === 'total_football' && (
                    <span className="rounded border border-cyan-400/35 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-200 whitespace-nowrap">
                      3포지션+ 멀티
                    </span>
                  )}
                  {activeTrait.id === 'super_sub' && (
                    <span className="rounded border border-pink-400/35 bg-pink-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-pink-200 whitespace-nowrap">
                      STA 86+
                    </span>
                  )}
                </div>
              </div>

              <button
                id="confirm-manager-btn"
                type="button"
                onClick={confirmManagerTrait}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-extrabold text-slate-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-colors cursor-pointer whitespace-nowrap"
              >
                <span>16인 드래프트 시작</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
              <span>
                원하는 감독 특성 1가지를 선택하거나{' '}
                <strong className="text-amber-300">[랜덤 선택]</strong>을 눌러주세요.
              </span>
              <button
                type="button"
                disabled
                className="rounded-xl bg-slate-800 px-5 py-2.5 text-xs font-bold text-slate-500 cursor-not-allowed whitespace-nowrap"
              >
                특성을 먼저 선택하세요
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
