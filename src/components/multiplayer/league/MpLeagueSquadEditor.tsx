import { ArrowLeftRight, Check, Wand2, X, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';
import { FORMATION_LIST } from '../../../data/formations';
import { calculateChemistry, calculateTeamRatings } from '../../../engine/chemistryEngine';
import {
  optimizeBestLineup,
  remapStartersForFormation,
} from '../../../engine/lineupOptimizer';
import { TACTIC_LIST } from '../../../engine/tacticEngine';
import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock';
import type { PlayerConditionMap } from '../../../types/condition';
import type { FormationId, ManagerTraitId } from '../../../types/game';
import type { TacticId } from '../../../types/league';
import type { MpSquadInput } from '../../../types/mpLeague';
import type { Player, SubPosition } from '../../../types/player';
import { ManagerTraitBadgeCard } from '../../common/ManagerTraitBadgeCard';
import { PitchBoard } from '../../common/PitchBoard';
import type { SlotRef } from '../../common/PitchBoard';
import { PlayerDetailModal } from '../../common/PlayerDetailModal';

interface MpLeagueSquadEditorProps {
  squad: MpSquadInput;
  managerTraitId: ManagerTraitId;
  conditions: PlayerConditionMap;
  onSave: (next: MpSquadInput) => void;
  onClose: () => void;
}

export function MpLeagueSquadEditor({
  squad,
  managerTraitId,
  conditions,
  onSave,
  onClose,
}: MpLeagueSquadEditorProps) {
  useBodyScrollLock(true);
  const [formation, setFormation] = useState<FormationId>(squad.formation);
  const [tactic, setTactic] = useState<TacticId>(squad.tactic);
  const [starters, setStarters] = useState<(Player | null)[]>(() => [...squad.starters]);
  const [bench, setBench] = useState<(Player | null)[]>(() => [...squad.bench]);
  const [selected, setSelected] = useState<SlotRef | null>(null);
  const [inspected, setInspected] = useState<{
    player: Player;
    slotSubPosition?: SubPosition;
  } | null>(null);

  const chemistry = useMemo(
    () => calculateChemistry(formation, starters, tactic, managerTraitId),
    [formation, starters, tactic, managerTraitId],
  );
  const ratings = useMemo(
    () =>
      calculateTeamRatings(
        formation,
        starters.filter((p): p is Player => p !== null),
        chemistry.total,
        managerTraitId,
        chemistry.slotSynergies,
      ),
    [formation, starters, chemistry, managerTraitId],
  );

  const swap = (from: SlotRef, to: SlotRef) => {
    if (from.area === to.area && from.index === to.index) return;
    const nextS = [...starters];
    const nextB = [...bench];
    const pA = from.area === 'starter' ? nextS[from.index] : nextB[from.index];
    const pB = to.area === 'starter' ? nextS[to.index] : nextB[to.index];
    if (from.area === 'starter') nextS[from.index] = pB;
    else nextB[from.index] = pB;
    if (to.area === 'starter') nextS[to.index] = pA;
    else nextB[to.index] = pA;
    setStarters(nextS);
    setBench(nextB);
  };

  const handleSlotClick = (area: 'starter' | 'bench', index: number) => {
    if (!selected) {
      setSelected({ area, index });
      return;
    }
    if (selected.area === area && selected.index === index) {
      setSelected(null);
      return;
    }
    swap(selected, { area, index });
    setSelected(null);
  };

  const handleSave = () => {
    const cleanS = starters.filter((p): p is Player => p !== null);
    const cleanB = bench.filter((p): p is Player => p !== null);
    if (cleanS.length !== 11 || cleanB.length !== 5) return;
    onSave({ managerTraitId, formation, tactic, starters: cleanS, bench: cleanB });
  };

  return (
    <div className="modal-backdrop fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/85 p-2 sm:p-4">
      <div className="modal-panel flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-[#0e141d] shadow-2xl">
        {/* Top Header — matches single-player SquadManagerModal with real-time A / M / D on top right */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 px-3 py-2.5 sm:px-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-sm font-extrabold text-white">스쿼드 · 전술</span>
            <span className="rounded border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-bold text-emerald-300 tabular-nums">
              케미 {chemistry.total} ({chemistry.chemistryOvrBonus >= 0 ? '+' : ''}
              {chemistry.chemistryOvrBonus.toFixed(1)})
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              id="mp-squad-line-ovr"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-[#0b1018] px-2.5 py-1 text-xs font-bold text-slate-300 tabular-nums"
            >
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              A <strong className="text-white">{ratings.effectiveAtt}</strong> / M{' '}
              <strong className="text-white">{ratings.effectiveMid}</strong> / D{' '}
              <strong className="text-white">{ratings.effectiveDef}</strong>
            </span>
            <button
              id="mpl-save-squad-btn"
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-3.5 py-1.5 text-xs font-extrabold text-slate-950 hover:bg-emerald-400 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              저장
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="rounded-lg border border-slate-800 bg-[#111822] p-1.5 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="modal-scroll flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-3">
          <ManagerTraitBadgeCard traitId={managerTraitId} compact />

        {/* Formation & Tactic Controls — identical to single-player SquadManagerModal */}
        <div className="rounded-xl border border-slate-800 bg-[#0b1018] p-3 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-slate-400">포메이션</span>
            <button
              type="button"
              onClick={() => {
                setSelected(null);
                const opt = optimizeBestLineup(starters, bench, formation, tactic, managerTraitId);
                setStarters(opt.starters);
                setBench(opt.bench);
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/45 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/25 transition-colors cursor-pointer"
            >
              <Wand2 className="w-3 h-3" />
              빠른 선발
            </button>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-1">
            {FORMATION_LIST.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setSelected(null);
                  setStarters((prev) =>
                    remapStartersForFormation(prev, formation, f.id, managerTraitId),
                  );
                  setFormation(f.id);
                }}
                className={`rounded-lg border py-1.5 px-1 text-[10px] sm:text-[11px] font-bold transition-colors cursor-pointer truncate ${
                  formation === f.id
                    ? 'border-sky-400/55 bg-sky-500/18 text-white'
                    : 'border-slate-800 bg-[#111822] text-slate-400 hover:border-slate-600 hover:text-slate-200'
                }`}
              >
                {f.id === '4-4-2-diamond' ? '4-4-2◇' : f.id === '3-5-2-dm' ? '3-5-2 DM' : f.id}
              </button>
            ))}
          </div>

          <div>
            <div className="mb-1.5 text-[11px] font-semibold text-slate-400">기본 전술</div>
            <div className="grid grid-cols-5 gap-1">
              {TACTIC_LIST.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTactic(t.id)}
                  className={`rounded-lg border py-1.5 text-[11px] font-bold transition-colors cursor-pointer truncate ${
                    tactic === t.id
                      ? 'border-emerald-400/55 bg-emerald-500/18 text-white'
                      : 'border-slate-800 bg-[#111822] text-slate-400 hover:border-slate-600 hover:text-slate-200'
                  }`}
                >
                  {t.shortName}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Pitch Controls Strip — identical to SquadManagerModal */}
        <div className="mx-auto w-full max-w-[520px] space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1.5 font-semibold text-slate-300">
              <ArrowLeftRight className="w-3.5 h-3.5 text-emerald-400" />
              {selected ? '교체할 선수를 클릭하세요' : '클릭·드래그 교환 / 우클릭·ⓘ 상세'}
            </span>
            <span className="text-[11px] font-bold text-slate-400 tabular-nums">
              OVR {Math.round(ratings.ovr)}
            </span>
          </div>

          <PitchBoard
            formation={formation}
            starters={starters}
            bench={bench}
            chemistry={chemistry}
            managerTraitId={managerTraitId}
            conditionByPlayerId={conditions}
            selectedSlot={selected}
            onSlotClick={handleSlotClick}
            onSlotSwap={swap}
            onInspectPlayer={(player, slotSubPosition) =>
              setInspected({ player, slotSubPosition })
            }
            showBench
            showChemBreakdown
            compact
          />
        </div>
        </div>
      </div>

      {inspected && (
        <PlayerDetailModal
          player={inspected.player}
          slotSubPosition={inspected.slotSubPosition}
          onClose={() => setInspected(null)}
        />
      )}
    </div>
  );
}
