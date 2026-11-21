import {
  ArrowLeftRight,
  ArrowUpDown,
  Crown,
  Diamond,
  Wand2,
  X,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { FORMATION_LIST, FORMATIONS } from '../../data/formations';
import { formatMainPositions } from '../../engine/positionEngine';
import { TACTIC_LIST } from '../../engine/tacticEngine';
import { useGame } from '../../store/GameContext';
import { getCardTier } from '../../types/player';
import type { Player, SubPosition } from '../../types/player';
import { ManagerTraitBadgeCard } from '../common/ManagerTraitBadgeCard';
import { PitchBoard } from '../common/PitchBoard';
import type { SlotRef } from '../common/PitchBoard';
import { PlayerDetailModal } from '../common/PlayerDetailModal';
import { buildPlayerCompetitionBreakdown } from '../../utils/playerLookup';

interface SquadManagerModalProps {
  onClose?: () => void;
  embedded?: boolean;
}

type SortKey = 'ovr' | 'apps' | 'goals' | 'assists' | 'xg' | 'cs' | 'mom' | 'rating';

export function SquadManagerModal({
  onClose,
  embedded = false,
}: SquadManagerModalProps) {
  const {
    state,
    chemistry,
    ratings,
    changeFormation,
    autoOptimizeLineup,
    setDefaultTactic,
    swapSquadPositions,
  } = useGame();
  const [selectedSlot, setSelectedSlot] = useState<SlotRef | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>('rating');
  const [inspected, setInspected] = useState<{
    player: Player;
    slotSubPosition?: SubPosition;
  } | null>(null);

  const allStats = state.season?.allPlayerStats ?? {};
  const formationSlots = FORMATIONS[state.formation].slots;

  const handleSlotClick = (area: 'starter' | 'bench', index: number) => {
    const clicked =
      area === 'starter' ? state.starters[index] : state.bench[index];
    if (!clicked) return;

    if (!selectedSlot) {
      setSelectedSlot({ area, index });
      return;
    }

    if (selectedSlot.area === area && selectedSlot.index === index) {
      setSelectedSlot(null);
      return;
    }

    swapSquadPositions(selectedSlot, { area, index });
    setSelectedSlot(null);
  };

  const rows = [
    ...state.starters.map((p, idx) => ({
      p,
      label: `선발 · ${formationSlots[idx]?.label ?? `#${idx + 1}`}`,
      slotSubPosition: formationSlots[idx]?.subPosition,
    })),
    ...state.bench.map((p, idx) => ({
      p,
      label: `벤치 #${idx + 1}`,
      slotSubPosition: undefined as SubPosition | undefined,
    })),
  ]
    .filter(
      (
        x,
      ): x is {
        p: Player;
        label: string;
        slotSubPosition: SubPosition | undefined;
      } => x.p !== null,
    )
    .map(({ p, label, slotSubPosition }) => {
      const st = allStats[p.id] ?? allStats[`user::${p.id}`];
      return {
        player: p,
        label,
        slotSubPosition,
        apps: st?.appearances ?? 0,
        starts: st?.starts ?? 0,
        subs: st?.subAppearances ?? 0,
        mins: st?.minutesPlayed ?? 0,
        goals: st?.goals ?? 0,
        assists: st?.assists ?? 0,
        xg: st?.xgSum ?? 0,
        cs: st?.cleanSheets ?? 0,
        mom: st?.momCount ?? 0,
        avgRating: st?.avgRating ?? 0,
      };
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'ovr':
          return b.player.ovr - a.player.ovr;
        case 'apps':
          return b.apps - a.apps || b.mins - a.mins;
        case 'goals':
          return b.goals - a.goals || b.assists - a.assists;
        case 'assists':
          return b.assists - a.assists || b.goals - a.goals;
        case 'xg':
          return b.xg - a.xg;
        case 'cs':
          return b.cs - a.cs;
        case 'mom':
          return b.mom - a.mom || b.avgRating - a.avgRating;
        case 'rating':
        default:
          return b.avgRating - a.avgRating || b.player.ovr - a.player.ovr;
      }
    });

  const content = (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      {/* Left: Manager Trait + 6 Formations + 5 Tactics + Quick Auto-Lineup + Pitch */}
      <div className="lg:col-span-5 space-y-3">
        <ManagerTraitBadgeCard traitId={state.manager.traitId} compact />
        <div className="rounded-xl border border-slate-800 bg-[#0b1018] p-3 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-slate-400">
              포메이션 (6종 · 변경 시 스마트 유지)
            </span>
            <button
              id="quick-best-xi-btn"
              type="button"
              onClick={() => {
                setSelectedSlot(null);
                autoOptimizeLineup();
              }}
              title="16명 전체 선수 대상으로 실효 OVR과 케미스트리를 극대화하는 베스트 11을 자동 배치합니다"
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1 text-[11px] font-extrabold text-slate-950 hover:bg-emerald-400 transition-colors cursor-pointer"
            >
              <Wand2 className="w-3 h-3" />
              빠른 선발
            </button>
          </div>
          <div className="grid grid-cols-6 gap-1">
            {FORMATION_LIST.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setSelectedSlot(null);
                  changeFormation(f.id);
                }}
                className={`rounded-lg py-1.5 text-[11px] font-bold cursor-pointer ${
                  state.formation === f.id
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-[#111822] text-slate-300 border border-slate-800 hover:border-slate-600'
                }`}
              >
                {f.id}
              </button>
            ))}
          </div>

          <div>
            <div className="mb-1.5 text-[11px] font-semibold text-slate-400">
              기본 전술
            </div>
            <div className="grid grid-cols-5 gap-1">
              {TACTIC_LIST.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setDefaultTactic(t.id)}
                  className={`rounded-lg py-1.5 text-[11px] font-bold cursor-pointer ${
                    state.defaultTactic === t.id
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-[#111822] text-slate-300 border border-slate-800 hover:border-slate-600'
                  }`}
                >
                  {t.shortName}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="inline-flex items-center gap-1.5 font-semibold text-slate-300">
            <ArrowLeftRight className="w-3.5 h-3.5 text-emerald-400" />
            {selectedSlot ? '교체할 선수를 클릭하세요' : '클릭·드래그 교환 / 우클릭·ⓘ 상세'}
          </span>
          <span className="inline-flex items-center gap-1 text-slate-400 tabular-nums">
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            A {ratings.effectiveAtt} / M {ratings.effectiveMid} / D{' '}
            {ratings.effectiveDef}
          </span>
        </div>

        <PitchBoard
          formation={state.formation}
          starters={state.starters}
          bench={state.bench}
          chemistry={chemistry}
          managerTraitId={state.manager.traitId}
          selectedSlot={selectedSlot}
          onSlotClick={handleSlotClick}
          onSlotSwap={(from, to) => {
            swapSquadPositions(from, to);
            setSelectedSlot(null);
          }}
          onInspectPlayer={(player, slotSubPosition) =>
            setInspected({ player, slotSubPosition })
          }
          showBench
          showChemBreakdown
          compact
        />
      </div>

      {/* Right: Sortable Team Squad Stats Table */}
      <div className="lg:col-span-7 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-bold text-slate-300">
            선수단 시즌 스탯 (16명 · 행 클릭 시 상세 보기)
          </h3>
          <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
            <ArrowUpDown className="w-3 h-3" />
            정렬: {sortBy.toUpperCase()}
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#0b1018]">
          <table className="w-full text-left text-xs tabular-nums">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] text-slate-400">
                <th className="py-2.5 px-3">선수</th>
                <th className="py-2.5 px-2 text-center">주포지션</th>
                <th className="py-2.5 px-2 text-center">
                  <button type="button" onClick={() => setSortBy('ovr')} className="hover:text-white cursor-pointer">
                    OVR
                  </button>
                </th>
                <th className="py-2.5 px-2 text-center">STA</th>
                <th className="py-2.5 px-2 text-center">
                  <button type="button" onClick={() => setSortBy('apps')} className="hover:text-white cursor-pointer">
                    출전(선/교)
                  </button>
                </th>
                <th className="py-2.5 px-2 text-center">출전시간</th>
                <th className="py-2.5 px-2 text-center">
                  <button type="button" onClick={() => setSortBy('goals')} className="hover:text-white cursor-pointer">
                    득점
                  </button>
                </th>
                <th className="py-2.5 px-2 text-center">
                  <button type="button" onClick={() => setSortBy('assists')} className="hover:text-white cursor-pointer">
                    도움
                  </button>
                </th>
                <th className="py-2.5 px-2 text-center">
                  <button type="button" onClick={() => setSortBy('xg')} className="hover:text-white cursor-pointer">
                    xG
                  </button>
                </th>
                <th className="py-2.5 px-2 text-center">
                  <button type="button" onClick={() => setSortBy('cs')} className="hover:text-white cursor-pointer">
                    CS
                  </button>
                </th>
                <th className="py-2.5 px-2 text-center">
                  <button type="button" onClick={() => setSortBy('mom')} className="hover:text-white cursor-pointer">
                    MOM
                  </button>
                </th>
                <th className="py-2.5 px-2.5 text-center text-white">
                  <button type="button" onClick={() => setSortBy('rating')} className="hover:text-emerald-300 cursor-pointer">
                    평점
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {rows.map((r) => {
                const tier = getCardTier(r.player);
                const sta = r.player.stamina ?? 82;
                return (
                  <tr
                    key={r.player.id}
                    onClick={() =>
                      setInspected({
                        player: r.player,
                        slotSubPosition: r.slotSubPosition,
                      })
                    }
                    className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-100">
                          {r.player.name}
                        </span>
                        {tier === 'legend' && (
                          <Crown className="w-3 h-3 text-amber-400 shrink-0" />
                        )}
                        {tier === 'superstar' && (
                          <Diamond className="w-3 h-3 text-cyan-300 shrink-0" />
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500">
                        {r.label} · {r.player.club}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-center text-[11px] font-semibold text-slate-300">
                      {formatMainPositions(r.player)}
                    </td>
                    <td className="py-2 px-2 text-center font-display text-sm font-bold text-emerald-300">
                      {r.player.ovr}
                    </td>
                    <td
                      className={`py-2 px-2 text-center font-bold ${
                        sta >= 92
                          ? 'text-emerald-300'
                          : sta <= 75
                            ? 'text-amber-300'
                            : 'text-slate-300'
                      }`}
                    >
                      {sta}
                    </td>
                    <td className="py-2 px-2 text-center text-slate-300">
                      <strong className="text-white">{r.apps}</strong>{' '}
                      <span className="text-[10px] text-slate-500">
                        ({r.starts}/{r.subs})
                      </span>
                    </td>
                    <td className="py-2 px-2 text-center text-slate-300">
                      {r.mins.toLocaleString()}분
                    </td>
                    <td className="py-2 px-2 text-center font-bold text-white">
                      {r.goals}
                    </td>
                    <td className="py-2 px-2 text-center font-semibold text-sky-300">
                      {r.assists}
                    </td>
                    <td className="py-2 px-2 text-center text-slate-400">
                      {r.xg.toFixed(1)}
                    </td>
                    <td className="py-2 px-2 text-center text-slate-300">
                      {r.player.position === 'GK' || r.player.position === 'DF'
                        ? r.cs
                        : '-'}
                    </td>
                    <td className="py-2 px-2 text-center font-bold text-amber-300">
                      {r.mom}
                    </td>
                    <td className="py-2 px-2.5 text-center font-display text-sm font-bold text-emerald-300">
                      {r.apps > 0 ? r.avgRating.toFixed(2) : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <PlayerDetailModal
        player={inspected?.player ?? null}
        slotSubPosition={inspected?.slotSubPosition}
        managerTraitId={state.manager.traitId}
        seasonStats={
          inspected
            ? allStats[inspected.player.id] ??
              allStats[`user::${inspected.player.id}`] ??
              null
            : null
        }
        competitionStats={
          inspected
            ? buildPlayerCompetitionBreakdown(inspected.player.id, state.season)
            : null
        }
        onClose={() => setInspected(null)}
      />
    </div>
  );

  if (embedded) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-[#111822] p-4 sm:p-5">
        {content}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-3 sm:p-6 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-[#0d141d] shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <h2 className="text-base font-extrabold text-white">
            스쿼드 &amp; 전술 관리
          </h2>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-700 bg-slate-900 p-2 text-slate-300 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="overflow-y-auto p-5">{content}</div>
      </div>
    </div>
  );
}
