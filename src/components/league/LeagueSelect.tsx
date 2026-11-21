import { ArrowLeftRight, ArrowRight, Globe2, Trophy, Zap } from 'lucide-react';
import { useState } from 'react';
import { FORMATION_LIST } from '../../data/formations';
import { getWeakestClub, LEAGUES } from '../../engine/dataLoader';
import { TACTIC_LIST } from '../../engine/tacticEngine';
import { useGame } from '../../store/GameContext';
import type { LeagueId } from '../../types/league';
import { JerseySvg } from '../common/JerseySvg';
import { PitchBoard } from '../common/PitchBoard';

export function LeagueSelect() {
  const {
    state,
    chemistry,
    ratings,
    selectLeague,
    changeFormation,
    setDefaultTactic,
    swapSquadPositions,
  } = useGame();

  const [selectedLeague, setSelectedLeague] = useState<LeagueId>('epl');
  const [swapSelection, setSwapSelection] = useState<{
    area: 'starter' | 'bench';
    index: number;
  } | null>(null);

  const handleSlotClick = (area: 'starter' | 'bench', index: number) => {
    const clickedPlayer =
      area === 'starter' ? state.starters[index] : state.bench[index];
    if (!clickedPlayer) return;

    if (!swapSelection) {
      setSwapSelection({ area, index });
      return;
    }

    if (swapSelection.area === area && swapSelection.index === index) {
      setSwapSelection(null);
      return;
    }

    swapSquadPositions(swapSelection, { area, index });
    setSwapSelection(null);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold tracking-[0.18em] text-emerald-400 uppercase">
            STEP 4 · DRAFT COMPLETE · 16 PLAYERS READY
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold text-white">
            도전할 유럽 5대 리그를 선택하세요
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            선택한 리그의 전력 최하위 구단을 대체해 편입됩니다. 시작 전 포메이션(6종)·기본 전술(5종) 변경 및 선발↔벤치 자유 교체가 가능합니다.
          </p>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-[#101822] px-4 py-2.5 text-xs">
          <div>
            <span className="text-slate-400">OVR</span>{' '}
            <strong className="font-display text-base text-white">
              {ratings.ovr}
            </strong>
          </div>
          <div>
            <span className="text-slate-400">ATT</span>{' '}
            <strong className="font-display text-base text-white">
              {ratings.att}
            </strong>
          </div>
          <div>
            <span className="text-slate-400">MID</span>{' '}
            <strong className="font-display text-base text-white">
              {ratings.mid}
            </strong>
          </div>
          <div>
            <span className="text-slate-400">DEF</span>{' '}
            <strong className="font-display text-base text-white">
              {ratings.def}
            </strong>
          </div>
          <span className="h-4 w-px bg-slate-700" />
          <div className="flex items-center gap-1 text-emerald-300">
            <Zap className="w-3.5 h-3.5" />
            <span>케미</span>
            <strong className="font-display text-base">{chemistry.total}</strong>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: 5 Leagues */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          {LEAGUES.map((league) => {
            const weakest = getWeakestClub(league);
            const isSelected = selectedLeague === league.id;
            const avgRating = Math.round(
              league.clubs.reduce((acc, c) => acc + (c.att + c.mid + c.def) / 3, 0) /
                league.clubs.length,
            );
            const top3 = league.clubs.slice(0, 3);

            return (
              <button
                key={league.id}
                type="button"
                onClick={() => setSelectedLeague(league.id)}
                className={`group flex flex-col gap-3 rounded-2xl border p-4 text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'border-emerald-400 bg-emerald-950/20 shadow-[0_0_24px_rgba(16,185,129,0.12)]'
                    : 'border-slate-800 bg-[#101822] hover:border-slate-600'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl font-display text-sm font-bold text-slate-950"
                      style={{ backgroundColor: league.accentColor }}
                    >
                      <Globe2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-extrabold text-white">
                          {league.koreanName}
                        </h2>
                        <span className="text-xs font-medium text-slate-400">
                          {league.name} · {league.country}
                        </span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        <span>
                          {league.clubs.length}팀 · {league.totalRounds}R
                        </span>
                        <span>·</span>
                        <span>평균 전력 {avgRating}</span>
                        <span>·</span>
                        <span>
                          이적시장{' '}
                          {league.transferWindows.map((r) => `${r}R`).join(' / ')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-300">
                    <Trophy className="w-3 h-3" />
                    TOP 4 UCL 진출
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80 pt-3 text-xs">
                  <div className="text-slate-400">
                    <span className="font-semibold text-slate-300">우승 후보:</span>{' '}
                    {top3.map((c) => c.name).join(', ')}
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-slate-950/80 px-2.5 py-1.5 border border-slate-800">
                    <JerseySvg
                      primaryColor={weakest.primaryColor}
                      secondaryColor={weakest.secondaryColor}
                      pattern={weakest.pattern}
                      size={22}
                    />
                    <span className="text-slate-400">
                      대체 구단:{' '}
                      <strong className="text-slate-200">{weakest.name}</strong>
                    </span>
                  </div>
                </div>
              </button>
            );
          })}

          <div className="mt-2 flex justify-end">
            <button
              id="confirm-league-btn"
              type="button"
              onClick={() => selectLeague(selectedLeague)}
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-3.5 text-sm font-extrabold text-slate-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-colors cursor-pointer"
            >
              <span>
                {LEAGUES.find((l) => l.id === selectedLeague)?.koreanName} 시즌 시작하기
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right: Pre-Season Formation / Tactic / Squad Tuning */}
        <div className="lg:col-span-5 space-y-3">
          <div className="rounded-xl border border-slate-800 bg-[#101822] p-3 space-y-2.5">
            <div>
              <div className="mb-1 text-[11px] font-bold text-slate-400">
                포메이션 즉시 전환 (6종)
              </div>
              <div className="grid grid-cols-6 gap-1">
                {FORMATION_LIST.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => changeFormation(f.id)}
                    className={`rounded-lg py-1 text-[11px] font-bold cursor-pointer ${
                      state.formation === f.id
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-slate-900 text-slate-300 border border-slate-700'
                    }`}
                  >
                    {f.id}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1 text-[11px] font-bold text-slate-400">
                시즌 기본 전술 (5종)
              </div>
              <div className="grid grid-cols-5 gap-1">
                {TACTIC_LIST.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setDefaultTactic(t.id)}
                    className={`rounded-lg py-1 text-[11px] font-bold cursor-pointer ${
                      state.defaultTactic === t.id
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-slate-900 text-slate-300 border border-slate-700'
                    }`}
                  >
                    {t.shortName}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="inline-flex items-center gap-1.5 font-semibold text-slate-200">
              <ArrowLeftRight className="w-3.5 h-3.5 text-emerald-400" />
              클릭하여 선발·벤치 자유 교체
            </span>
            {swapSelection && (
              <button
                type="button"
                onClick={() => setSwapSelection(null)}
                className="text-amber-300 hover:underline cursor-pointer"
              >
                선택 취소
              </button>
            )}
          </div>

          <PitchBoard
            formation={state.formation}
            starters={state.starters}
            bench={state.bench}
            chemistry={chemistry}
            managerTraitId={state.manager.traitId}
            selectedSlot={swapSelection}
            onSlotClick={handleSlotClick}
            showBench
            showChemBreakdown
          />
        </div>
      </div>
    </div>
  );
}
