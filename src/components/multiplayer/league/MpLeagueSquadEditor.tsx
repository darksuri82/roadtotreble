import { Check, Wand2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { FORMATION_LIST } from '../../../data/formations';
import { calculateChemistry, calculateTeamRatings } from '../../../engine/chemistryEngine';
import {
  optimizeBestLineup,
  remapStartersForFormation,
} from '../../../engine/lineupOptimizer';
import { TACTIC_LIST } from '../../../engine/tacticEngine';
import type { PlayerConditionMap } from '../../../types/condition';
import type { FormationId, ManagerTraitId } from '../../../types/game';
import type { TacticId } from '../../../types/league';
import type { MpSquadInput } from '../../../types/mpLeague';
import type { Player, SubPosition } from '../../../types/player';
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
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-slate-950/85 px-2 py-3 sm:py-6">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-800 bg-[#0d131c] p-3 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-extrabold text-white">스쿼드 · 전술</span>
            <span className="font-bold text-emerald-300 tabular-nums">
              케미 {chemistry.total}
            </span>
            <span className="font-bold text-slate-200 tabular-nums">
              OVR {Math.round(ratings.ovr || 0)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const opt = optimizeBestLineup(starters, bench, formation, tactic, managerTraitId);
                setStarters(opt.starters);
                setBench(opt.bench);
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-[#111822] px-2.5 py-1.5 text-[11px] font-bold text-slate-200 hover:border-emerald-400/50 cursor-pointer"
            >
              <Wand2 className="w-3.5 h-3.5 text-emerald-300" />
              최적 선발
            </button>
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

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
            {FORMATION_LIST.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setStarters((prev) =>
                    remapStartersForFormation(prev, formation, f.id, managerTraitId),
                  );
                  setFormation(f.id);
                }}
                className={`rounded-lg border py-1.5 px-1 text-[11px] font-bold transition-colors cursor-pointer truncate ${
                  formation === f.id
                    ? 'border-sky-400/55 bg-sky-500/18 text-white'
                    : 'border-slate-800 bg-[#111822] text-slate-400 hover:text-slate-200'
                }`}
              >
                {f.id === '4-4-2-diamond' ? '4-4-2◇' : f.id === '3-5-2-dm' ? '3-5-2 DM' : f.id}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-5 gap-1.5 content-start">
            {TACTIC_LIST.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTactic(t.id)}
                className={`rounded-lg border py-1.5 px-1 text-[11px] font-bold transition-colors cursor-pointer truncate ${
                  tactic === t.id
                    ? 'border-emerald-400/55 bg-emerald-500/15 text-white'
                    : 'border-slate-800 bg-[#111822] text-slate-400 hover:text-slate-200'
                }`}
              >
                {t.shortName}
              </button>
            ))}
          </div>
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
        />
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
