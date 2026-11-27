import {
  ArrowRight,
  Check,
  Compass,
  Filter,
  Shield,
  Sparkles,
} from 'lucide-react';
import { FORMATION_LIST, FORMATIONS } from '../../data/formations';
import { MANAGER_TRAITS } from '../../data/managerTraits';
import { LEAGUES } from '../../engine/dataLoader';
import { isFullFiveLeagueDraftPool } from '../../engine/legacyEngine';
import { TACTIC_LIST } from '../../engine/tacticEngine';
import { useGame } from '../../store/GameContext';
import type { LeagueId } from '../../types/league';
import { ActiveProfileChip } from '../common/ActiveProfileChip';

const LEAGUE_POOL_OPTIONS: { id: LeagueId; label: string; clubsCount: number }[] =
  LEAGUES.map((l) => ({
    id: l.id,
    label: `${l.koreanName} (${l.name === 'Premier League' ? 'EPL' : l.name})`,
    clubsCount: l.clubs.length,
  }));

export function FormationSelect() {
  const {
    state,
    setDraftLeaguePool,
    changeFormation,
    setDefaultTactic,
    proceedToManagerRoulette,
  } = useGame();

  const activeTrait = state.manager.traitId
    ? MANAGER_TRAITS[state.manager.traitId]
    : null;

  const selectedLeagues = state.draftLeaguePool;
  const totalSelectedClubs = LEAGUE_POOL_OPTIONS.filter((l) =>
    selectedLeagues.includes(l.id),
  ).reduce((sum, l) => sum + l.clubsCount, 0);
  const canStart = selectedLeagues.length >= 1;

  const handleToggleLeague = (id: LeagueId) => {
    if (selectedLeagues.includes(id)) {
      setDraftLeaguePool(selectedLeagues.filter((x) => x !== id));
    } else {
      setDraftLeaguePool([...selectedLeagues, id]);
    }
  };

  const handleNext = () => {
    if (!canStart) return;
    proceedToManagerRoulette();
  };

  return (
    <div className="mx-auto max-w-7xl px-3.5 py-5 sm:px-4 sm:py-7 space-y-5">
      {/* Header + Compact Active Club/Manager Profile Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-bold tracking-[0.2em] text-emerald-400 uppercase">
            STEP 1 · DRAFT POOL, FORMATION &amp; TACTIC
          </p>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-white">
            드래프트 풀 · 포메이션 · 전술 선택
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ActiveProfileChip />
          {activeTrait && (
            <div className="rounded-xl border border-amber-400/40 bg-amber-950/20 px-3 py-1.5 text-xs">
              <div className="flex items-center gap-1.5 font-extrabold text-amber-300 whitespace-nowrap">
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                {activeTrait.name}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left: Draft League Pool Filter + Default Tactic */}
        <div className="lg:col-span-4 space-y-4">
          {/* Draft & Transfer League Pool Checkboxes */}
          <section className="rounded-2xl border border-slate-800 bg-[#101822] p-4 sm:p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-emerald-400 shrink-0" />
                <h2 className="text-sm font-extrabold text-white">
                  드래프트 선수 풀 리그 선택
                </h2>
              </div>
              {selectedLeagues.length < LEAGUE_POOL_OPTIONS.length && (
                <button
                  type="button"
                  onClick={() =>
                    setDraftLeaguePool(LEAGUE_POOL_OPTIONS.map((l) => l.id))
                  }
                  className="text-[11px] font-bold text-emerald-400 hover:underline cursor-pointer whitespace-nowrap"
                >
                  전체 선택
                </button>
              )}
            </div>

            <div className="space-y-1.5">
              {LEAGUE_POOL_OPTIONS.map((lg) => {
                const checked = selectedLeagues.includes(lg.id);
                return (
                  <label
                    key={lg.id}
                    className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs transition-colors cursor-pointer ${
                      checked
                        ? 'border-emerald-500/45 bg-emerald-500/10 text-white'
                        : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleToggleLeague(lg.id)}
                        className="h-4 w-4 rounded accent-emerald-500 cursor-pointer shrink-0"
                      />
                      <span className="font-bold truncate">{lg.label}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 tabular-nums whitespace-nowrap shrink-0">
                      {lg.clubsCount}구단
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="space-y-2 pt-0.5">
              <div className="flex items-center justify-between text-[11px]">
                {canStart ? (
                  <span
                    className={`font-semibold tabular-nums ${
                      isFullFiveLeagueDraftPool(selectedLeagues)
                        ? 'text-emerald-300'
                        : 'text-amber-300'
                    }`}
                  >
                    선택 풀: {selectedLeagues.length}개 리그 · {totalSelectedClubs}구단
                    {isFullFiveLeagueDraftPool(selectedLeagues) && ' · 일일 랭킹 가능'}
                  </span>
                ) : (
                  <span className="text-rose-400 font-bold">
                    최소 1개 이상의 리그를 선택하세요.
                  </span>
                )}
              </div>

              {canStart && !isFullFiveLeagueDraftPool(selectedLeagues) && (
                <div
                  role="alert"
                  className="rounded-xl border border-rose-500/50 bg-rose-500/12 px-3 py-2 text-[11px] font-bold text-rose-400 leading-relaxed break-keep"
                >
                  ⚠️ 5대 리그 드래프트 풀을 모두 체크하지 않으면 공정성을 위해 개인 명예의 전당 기록만 가능하며,{' '}
                  <span className="text-rose-300 underline underline-offset-2">
                    일일 랭킹 제출은 불가
                  </span>
                  합니다.
                </div>
              )}
            </div>
          </section>

          {/* 5 Default Tactics */}
          <section className="rounded-2xl border border-slate-800 bg-[#101822] p-4 sm:p-5 shadow-xl">
            <div className="mb-3 flex items-center gap-2">
              <Compass className="w-4 h-4 text-emerald-400 shrink-0" />
              <h2 className="text-sm font-extrabold text-white">
                기본 팀 전술 (5종)
              </h2>
            </div>

            <div className="space-y-2">
              {TACTIC_LIST.map((t) => {
                const isSelected = state.defaultTactic === t.id;
                const isManagerSynergy = activeTrait?.synergyTactic === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setDefaultTactic(t.id)}
                    className={`w-full rounded-xl border p-3 text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-emerald-400 bg-emerald-950/25'
                        : 'border-slate-800 bg-slate-950/60 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold text-white">
                        {t.name}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {isManagerSynergy && (
                          <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[9px] font-extrabold text-amber-300 border border-amber-400/40 whitespace-nowrap">
                            감독 추천
                          </span>
                        )}
                        {isSelected && (
                          <span className="rounded bg-emerald-400 px-1.5 py-0.5 text-[9px] font-extrabold text-slate-950 whitespace-nowrap">
                            선택됨
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2 text-[10px]">
                      <span className="text-emerald-300">강: {t.strongAgainst}</span>
                      <span className="text-rose-300">약: {t.weakAgainst}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* Right: 10 Formations Grid */}
        <section className="lg:col-span-8 flex flex-col justify-between rounded-2xl border border-slate-800 bg-[#101822] p-4 sm:p-5 shadow-xl">
          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
                <h2 className="text-base font-extrabold text-white">
                  10종 포메이션 선택 (포백 4종 · 쓰리백 6종)
                </h2>
              </div>
              <span className="text-xs text-slate-400 whitespace-nowrap">
                선발 11명 + 벤치 5명 드래프트
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {FORMATION_LIST.map((fmt) => {
                const isSelected = state.formation === fmt.id;
                return (
                  <button
                    key={fmt.id}
                    type="button"
                    onClick={() => changeFormation(fmt.id)}
                    className={`flex flex-col rounded-xl border p-3 text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-emerald-400 bg-emerald-950/25 shadow-[0_0_24px_rgba(16,185,129,0.14)]'
                        : 'border-slate-800 bg-slate-950/60 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-display text-lg font-bold text-white">
                          {fmt.id === '4-4-2-diamond'
                            ? '4-4-2 다이아몬드'
                            : fmt.id === '3-5-2-dm'
                              ? '3-5-2 DM'
                              : fmt.id}
                        </span>
                        <span className="ml-1.5 text-[10px] font-semibold text-emerald-300">
                          {fmt.shortTag}
                        </span>
                      </div>
                      {isSelected && (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400 text-slate-950 shrink-0">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </span>
                      )}
                    </div>

                    {/* Mini Pitch */}
                    <div className="pitch-surface relative my-2.5 aspect-[4/3.8] w-full overflow-hidden rounded-lg border border-emerald-500/20">
                      <svg
                        viewBox="0 0 100 100"
                        className="h-full w-full"
                        aria-hidden="true"
                      >
                        <line
                          x1="6"
                          y1="50"
                          x2="94"
                          y2="50"
                          stroke="rgba(255,255,255,0.15)"
                          strokeWidth="1"
                        />
                        {FORMATIONS[fmt.id].links.map(([a, b]) => (
                          <line
                            key={`${a}-${b}`}
                            x1={fmt.slots[a].x}
                            y1={fmt.slots[a].y}
                            x2={fmt.slots[b].x}
                            y2={fmt.slots[b].y}
                            stroke="rgba(52,211,153,0.28)"
                            strokeWidth="0.9"
                          />
                        ))}
                        {fmt.slots.map((s) => (
                          <g key={s.index}>
                            <circle
                              cx={s.x}
                              cy={s.y}
                              r="4"
                              fill={
                                s.position === 'GK'
                                  ? '#f59e0b'
                                  : isSelected
                                    ? '#10b981'
                                    : '#cbd5e1'
                              }
                            />
                            <text
                              x={s.x}
                              y={s.y + 8.5}
                              textAnchor="middle"
                              fill="rgba(226,232,240,0.85)"
                              fontSize="5"
                              fontWeight="700"
                            >
                              {s.label}
                            </text>
                          </g>
                        ))}
                      </svg>
                    </div>

                    <p className="text-[10px] leading-snug text-emerald-200/90 break-keep">
                      + {fmt.strengthSummary}
                    </p>
                    <p className="mt-0.5 text-[10px] leading-snug text-rose-300/80 break-keep">
                      - {fmt.weaknessSummary}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-t border-slate-800 pt-4">
            <span className="text-xs text-slate-400">
              {canStart
                ? `드래프트 풀: ${selectedLeagues.length}개 리그 (${totalSelectedClubs}구단) + 클래식`
                : '드래프트 선수 풀 리그를 최소 1개 이상 체크하세요.'}
            </span>
            <button
              id="start-draft-btn"
              type="button"
              disabled={!canStart}
              onClick={handleNext}
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-emerald-500 px-7 py-3.5 text-sm font-extrabold text-slate-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
            >
              <span>다음 단계: 감독 특성 선택 ({state.formation})</span>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
