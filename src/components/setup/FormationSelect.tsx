import {
  ArrowRight,
  Bookmark,
  Check,
  Compass,
  Filter,
  Palette,
  Shield,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { FORMATION_LIST, FORMATIONS } from '../../data/formations';
import { MANAGER_TRAITS } from '../../data/managerTraits';
import { LEAGUES } from '../../engine/dataLoader';
import { TACTIC_LIST } from '../../engine/tacticEngine';
import { useGame } from '../../store/GameContext';
import type { JerseyPattern, LeagueId } from '../../types/league';
import {
  deleteClubPreset,
  loadClubPresets,
  saveClubPreset,
} from '../../utils/clubPresets';
import type { ClubPreset } from '../../utils/clubPresets';
import { JerseySvg } from '../common/JerseySvg';

const PRIMARY_COLORS = [
  '#10b981',
  '#ef4444',
  '#2563eb',
  '#f59e0b',
  '#0ea5e9',
  '#f8fafc',
  '#1e293b',
  '#dc2626',
];

const SECONDARY_COLORS = [
  '#0f172a',
  '#ffffff',
  '#fbbf24',
  '#10b981',
  '#ef4444',
  '#38bdf8',
];

const PATTERNS: { id: JerseyPattern; label: string }[] = [
  { id: 'solid', label: '솔리드' },
  { id: 'stripes', label: '세로줄' },
  { id: 'hoops', label: '가로줄' },
  { id: 'sash', label: '사선' },
  { id: 'half', label: '하프' },
];

const LEAGUE_POOL_OPTIONS: { id: LeagueId; label: string; clubsCount: number }[] =
  LEAGUES.map((l) => ({
    id: l.id,
    label: `${l.koreanName} (${l.name === 'Premier League' ? 'EPL' : l.name})`,
    clubsCount: l.clubs.length,
  }));

export function FormationSelect() {
  const {
    state,
    updateClubProfile,
    updateManagerProfile,
    setDraftLeaguePool,
    changeFormation,
    setDefaultTactic,
    proceedToManagerRoulette,
  } = useGame();

  const [presets, setPresets] = useState<ClubPreset[]>(() => loadClubPresets());

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

  const handleApplyPreset = (preset: ClubPreset) => {
    updateClubProfile({
      name: preset.name,
      shortName: preset.shortName,
      primaryColor: preset.primaryColor,
      secondaryColor: preset.secondaryColor,
      pattern: preset.pattern,
    });
    if (preset.managerName || preset.managerAvatar) {
      updateManagerProfile({
        name: preset.managerName,
        avatar: preset.managerAvatar,
      });
    }
  };

  const handleDeletePreset = (id: string) => {
    setPresets(deleteClubPreset(id));
  };

  const handleStart = () => {
    if (!canStart) return;
    const trimmedName = state.userClub.name.trim() || 'FC 유나이티드 드림';
    const trimmedShort =
      (state.userClub.shortName.trim() || 'FUD').toUpperCase().slice(0, 4);
    const nextProfile = {
      ...state.userClub,
      name: trimmedName,
      shortName: trimmedShort,
    };
    updateClubProfile({ name: trimmedName, shortName: trimmedShort });
    setPresets(
      saveClubPreset(nextProfile, {
        name: state.manager.name,
        avatar: state.manager.avatar,
      }),
    );
    proceedToManagerRoulette();
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8 space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold tracking-[0.2em] text-emerald-400 uppercase">
            STEP 1 · CLUB, DRAFT POOL, FORMATION &amp; TACTIC
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold text-white">
            구단 · 드래프트 풀 · 포메이션 설정
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            구단 유니폼과 드래프트 등장 리그 풀, 초기 포메이션·전술을 설정하세요. 다음 단계에서 감독 캐릭터와 능력을 직접 선택합니다.
          </p>
        </div>

        {activeTrait && (
          <div className="rounded-xl border border-amber-400/40 bg-amber-950/20 px-3.5 py-2 text-xs">
            <div className="flex items-center gap-1.5 font-extrabold text-amber-300">
              <Sparkles className="w-3.5 h-3.5" />
              감독 강점: {activeTrait.name}
            </div>
            <div className="text-[11px] text-slate-300 mt-0.5 max-w-xs truncate">
              {activeTrait.effectSummary}
            </div>
          </div>
        )}
      </div>

      {/* Saved Team Presets Bar ([이전 팀 불러오기]) */}
      {presets.length > 0 && (
        <section className="rounded-2xl border border-slate-800 bg-[#101822] p-4 shadow-xl space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-extrabold text-white">
              <Bookmark className="w-4 h-4 text-emerald-400" />
              이전 팀 불러오기 ({presets.length} / 6)
            </div>
            <span className="text-[11px] text-slate-400">
              클릭 시 팀명·약칭·유니폼 즉시 적용
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            {presets.map((preset) => {
              const isCurrent =
                state.userClub.name.trim().toLowerCase() ===
                  preset.name.trim().toLowerCase() &&
                state.userClub.primaryColor === preset.primaryColor &&
                state.userClub.pattern === preset.pattern;
              return (
                <div
                  key={preset.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleApplyPreset(preset)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleApplyPreset(preset);
                    }
                  }}
                  className={`group relative flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-all cursor-pointer ${
                    isCurrent
                      ? 'border-emerald-400 bg-emerald-500/12'
                      : 'border-slate-800 bg-slate-950/70 hover:border-slate-600'
                  }`}
                >
                  <JerseySvg
                    primaryColor={preset.primaryColor}
                    secondaryColor={preset.secondaryColor}
                    pattern={preset.pattern}
                    label={preset.shortName}
                    size={36}
                  />
                  <div className="min-w-0 flex-1 pr-4">
                    <div className="truncate text-xs font-bold text-white">
                      {preset.name}
                    </div>
                    <div className="font-display text-[10px] font-bold text-emerald-300">
                      {preset.shortName}
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label={`${preset.name} 프리셋 삭제`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeletePreset(preset.id);
                    }}
                    className="absolute top-1.5 right-1.5 rounded p-1 text-slate-500 hover:bg-rose-500/15 hover:text-rose-300 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Club Identity + Draft League Pool Filter + Default Tactic */}
        <div className="lg:col-span-4 space-y-5">
          <section className="rounded-2xl border border-slate-800 bg-[#101822] p-5 shadow-xl">
            <div className="mb-4 flex items-center gap-2">
              <Palette className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-extrabold text-white">구단 &amp; 유니폼</h2>
            </div>

            <div className="mb-4 flex items-center gap-3.5 rounded-xl border border-slate-800 bg-slate-950/70 p-3.5">
              <JerseySvg
                primaryColor={state.userClub.primaryColor}
                secondaryColor={state.userClub.secondaryColor}
                pattern={state.userClub.pattern}
                label={state.userClub.shortName}
                size={68}
              />
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-semibold text-slate-400">
                  홈 유니폼 (시작 시 프리셋 자동 저장)
                </div>
                <div className="truncate text-base font-extrabold text-white">
                  {state.userClub.name || 'FC 유나이티드 드림'}
                </div>
                <div className="mt-1 inline-block rounded bg-slate-800 px-2 py-0.5 font-display text-xs font-bold text-emerald-300">
                  {state.userClub.shortName || 'FUD'}
                </div>
              </div>
            </div>

            <div className="space-y-3.5">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-slate-300">
                    구단명
                  </label>
                  <input
                    type="text"
                    maxLength={22}
                    value={state.userClub.name}
                    onChange={(e) => updateClubProfile({ name: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white focus:border-emerald-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-300">
                    약칭
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    value={state.userClub.shortName}
                    onChange={(e) =>
                      updateClubProfile({
                        shortName: e.target.value.toUpperCase(),
                      })
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 font-display text-xs font-bold uppercase text-white focus:border-emerald-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <span className="mb-1 block text-xs font-semibold text-slate-300">
                  메인 컬러
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {PRIMARY_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => updateClubProfile({ primaryColor: c })}
                      style={{ backgroundColor: c }}
                      className={`h-6 w-6 rounded-full border-2 cursor-pointer ${
                        state.userClub.primaryColor === c
                          ? 'border-white scale-110 ring-2 ring-emerald-400'
                          : 'border-slate-700'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div>
                <span className="mb-1 block text-xs font-semibold text-slate-300">
                  보조 컬러
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {SECONDARY_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => updateClubProfile({ secondaryColor: c })}
                      style={{ backgroundColor: c }}
                      className={`h-6 w-6 rounded-full border-2 cursor-pointer ${
                        state.userClub.secondaryColor === c
                          ? 'border-emerald-400 scale-110 ring-2 ring-white'
                          : 'border-slate-700'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-5 gap-1">
                {PATTERNS.map((pat) => (
                  <button
                    key={pat.id}
                    type="button"
                    onClick={() => updateClubProfile({ pattern: pat.id })}
                    className={`rounded-lg py-1.5 text-[11px] font-bold cursor-pointer ${
                      state.userClub.pattern === pat.id
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-slate-900 text-slate-300 border border-slate-700'
                    }`}
                  >
                    {pat.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Draft & Transfer League Pool Checkboxes */}
          <section className="rounded-2xl border border-slate-800 bg-[#101822] p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-emerald-400" />
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
                  className="text-[11px] font-bold text-emerald-400 hover:underline cursor-pointer"
                >
                  전체 선택
                </button>
              )}
            </div>

            <p className="text-[11px] leading-relaxed text-slate-400">
              초기 드래프트 및 시즌 중 이적시장 3구단 룰렛에 등장할 리그를 선택합니다. (레전드 칸 및 5대 리그 백그라운드 순위표·UCL은 영향 없음)
            </p>

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
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleToggleLeague(lg.id)}
                        className="h-4 w-4 rounded accent-emerald-500 cursor-pointer"
                      />
                      <span className="font-bold">{lg.label}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 tabular-nums">
                      {lg.clubsCount}구단
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="flex items-center justify-between text-[11px] pt-1">
              {canStart ? (
                <span className="text-emerald-300 font-semibold tabular-nums">
                  선택 풀: {selectedLeagues.length}개 리그 · {totalSelectedClubs}구단
                </span>
              ) : (
                <span className="text-rose-400 font-bold">
                  최소 1개 이상의 리그를 선택해야 시작할 수 있습니다.
                </span>
              )}
            </div>
          </section>

          {/* 5 Default Tactics */}
          <section className="rounded-2xl border border-slate-800 bg-[#101822] p-5 shadow-xl">
            <div className="mb-3 flex items-center gap-2">
              <Compass className="w-4 h-4 text-emerald-400" />
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
                      <div className="flex items-center gap-1">
                        {isManagerSynergy && (
                          <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[9px] font-extrabold text-amber-300 border border-amber-400/40">
                            감독 추천
                          </span>
                        )}
                        {isSelected && (
                          <span className="rounded bg-emerald-400 px-1.5 py-0.5 text-[9px] font-extrabold text-slate-950">
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

        {/* Right: 6 Formations Grid */}
        <section className="lg:col-span-8 flex flex-col justify-between rounded-2xl border border-slate-800 bg-[#101822] p-5 shadow-xl">
          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                <h2 className="text-base font-extrabold text-white">
                  6종 포메이션 선택 (포백 3종 · 쓰리백 3종)
                </h2>
              </div>
              <span className="text-xs text-slate-400">
                선발 11명 + 벤치 5명 3구단 룰렛 드래프트
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
                        <span className="font-display text-xl font-bold text-white">
                          {fmt.id}
                        </span>
                        <span className="ml-1.5 text-[10px] font-semibold text-emerald-300">
                          {fmt.shortTag}
                        </span>
                      </div>
                      {isSelected && (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400 text-slate-950">
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

                    <p className="text-[10px] leading-snug text-emerald-200/90">
                      + {fmt.strengthSummary}
                    </p>
                    <p className="mt-0.5 text-[10px] leading-snug text-rose-300/80">
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
                ? `드래프트 풀: ${selectedLeagues.length}개 리그 (${totalSelectedClubs}구단) + 레전드`
                : '드래프트 선수 풀 리그를 최소 1개 이상 체크하세요.'}
            </span>
            <button
              id="start-draft-btn"
              type="button"
              disabled={!canStart}
              onClick={handleStart}
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-emerald-500 px-7 py-3.5 text-sm font-extrabold text-slate-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <span>다음 단계: 감독 강점 룰렛 ({state.formation})</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
