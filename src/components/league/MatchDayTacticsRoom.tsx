import {
  ArrowLeftRight,
  BookOpen,
  Columns2,
  Compass,
  Eye,
  Shield,
  Sparkles,
  Users,
  Wand2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { FORMATION_LIST } from '../../data/formations';
import { calculateTeamRatings } from '../../engine/chemistryEngine';
import {
  evaluateFormationMatchup,
  evaluatePlaystyleTacticMatchup,
  evaluateTacticMatchup,
  getBestCounterTactic,
  TACTIC_LIST,
  TACTICS,
} from '../../engine/tacticEngine';
import type {
  ChemistryResult,
  FormationId,
  ManagerTraitId,
} from '../../types/game';
import type { Club, TacticId } from '../../types/league';
import type { Player, SubPosition } from '../../types/player';
import { JerseySvg } from '../common/JerseySvg';
import { PitchBoard } from '../common/PitchBoard';
import type { SlotRef } from '../common/PitchBoard';
import { TacticsGuideModal } from '../common/TacticsGuideModal';
import { OpponentPitchView } from './OpponentPitchView';

interface MatchDayTacticsRoomProps {
  opponent: Club;
  opponentRoster: Player[];
  opponentSubtitle?: string;
  isHome: boolean;
  headerBadge: string;
  headerAccent?: 'league' | 'cup' | 'ucl';
  activeTactic: TacticId;
  defaultTactic: TacticId;
  formation: FormationId;
  starters: (Player | null)[];
  bench: (Player | null)[];
  chemistry: ChemistryResult;
  managerTraitId: ManagerTraitId | null;
  onSelectTactic: (tactic: TacticId) => void;
  onChangeFormation: (formation: FormationId) => void;
  onSwapSquad: (from: SlotRef, to: SlotRef) => void;
  onAutoOptimize: () => void;
  onInspectPlayer?: (player: Player, slotSubPosition?: SubPosition) => void;
  onClickOpponentPlayerName?: (playerId: string) => void;
  children?: React.ReactNode; // Sticky Kickoff / Skip action buttons slot
}

type PitchTabMode = 'opponent' | 'our_squad' | 'split';

function StatComparePill({
  label,
  ourVal,
  oppVal,
}: {
  label: string;
  ourVal: number;
  oppVal: number;
}) {
  const diff = ourVal - oppVal;
  return (
    <div className="flex items-center justify-between gap-1.5 rounded-lg bg-[#090e15] border border-slate-800/80 px-2.5 py-1.5 text-xs tabular-nums">
      <span
        className={`font-display font-bold ${
          diff > 0
            ? 'text-emerald-300'
            : diff < 0
              ? 'text-slate-300'
              : 'text-white'
        }`}
      >
        {ourVal}
      </span>
      <span className="text-[10px] font-bold text-slate-500">{label}</span>
      <span
        className={`font-display font-bold ${
          diff < 0
            ? 'text-rose-300'
            : diff > 0
              ? 'text-slate-400'
              : 'text-white'
        }`}
      >
        {oppVal}
      </span>
    </div>
  );
}

export function MatchDayTacticsRoom({
  opponent,
  opponentRoster,
  opponentSubtitle,
  isHome,
  headerBadge,
  headerAccent = 'league',
  activeTactic,
  formation,
  starters,
  bench,
  chemistry,
  managerTraitId,
  onSelectTactic,
  onChangeFormation,
  onSwapSquad,
  onAutoOptimize,
  onInspectPlayer,
  onClickOpponentPlayerName,
  children,
}: MatchDayTacticsRoomProps) {
  const [pitchTab, setPitchTab] = useState<PitchTabMode>('opponent');
  const [selectedSlot, setSelectedSlot] = useState<SlotRef | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);

  const filledStarters = useMemo(
    () => starters.filter((p): p is Player => p !== null),
    [starters],
  );

  const ourRatings = useMemo(
    () =>
      calculateTeamRatings(
        formation,
        filledStarters,
        chemistry.total,
        managerTraitId,
        chemistry.slotSynergies,
      ),
    [formation, filledStarters, chemistry, managerTraitId],
  );

  const tacticMatch = useMemo(
    () => evaluateTacticMatchup(activeTactic, opponent.defaultTactic),
    [activeTactic, opponent.defaultTactic],
  );

  const formationMatch = useMemo(
    () => evaluateFormationMatchup(formation, opponent.formation),
    [formation, opponent.formation],
  );

  const styleMatch = useMemo(
    () =>
      evaluatePlaystyleTacticMatchup({
        starters: filledStarters,
        oppTactic: opponent.defaultTactic,
      }),
    [filledStarters, opponent.defaultTactic],
  );

  const recommendedTactic = getBestCounterTactic(opponent.defaultTactic);

  const handleSlotClick = (area: 'starter' | 'bench', index: number) => {
    const clicked = area === 'starter' ? starters[index] : bench[index];
    if (!selectedSlot) {
      if (!clicked) return;
      setSelectedSlot({ area, index });
      return;
    }
    if (selectedSlot.area === area && selectedSlot.index === index) {
      setSelectedSlot(null);
      return;
    }
    onSwapSquad(selectedSlot, { area, index });
    setSelectedSlot(null);
  };

  const borderCls =
    headerAccent === 'cup'
      ? 'border-amber-500/45 bg-[#101722]'
      : headerAccent === 'ucl'
        ? 'border-sky-500/40 bg-[#0e1520]'
        : 'border-slate-800 bg-[#111822]';

  const diagnosisBadgeCls =
    tacticMatch.delta >= 2
      ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200'
      : tacticMatch.delta > 0
        ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300'
        : tacticMatch.delta <= -2
          ? 'border-rose-400/50 bg-rose-500/15 text-rose-200'
          : tacticMatch.delta < 0
            ? 'border-rose-500/35 bg-rose-500/10 text-rose-300'
            : 'border-slate-700 bg-slate-800/70 text-slate-300';

  const diagnosisIcon =
    tacticMatch.delta > 0 ? '🟢' : tacticMatch.delta < 0 ? '🔴' : '🟡';

  const diagnosisTitle =
    tacticMatch.delta >= 2
      ? `전술 상성 유리 (+${tacticMatch.delta.toFixed(1)})`
      : tacticMatch.delta > 0
        ? `전술 약우위 (+${tacticMatch.delta.toFixed(1)})`
        : tacticMatch.delta <= -2
          ? `전술 상성 불리 (${tacticMatch.delta.toFixed(1)})`
          : tacticMatch.delta < 0
            ? `전술 약열세 (${tacticMatch.delta.toFixed(1)})`
            : '전술 상성 호각 (0.0)';

  const styleNetDelta =
    (styleMatch.attBonus + styleMatch.midBonus + styleMatch.defBonus) / 3;

  return (
    <div className={`rounded-2xl border p-3.5 sm:p-4 space-y-3.5 ${borderCls}`}>
      {/* 1) Top Match Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span
            className={`text-xs font-extrabold truncate ${
              headerAccent === 'cup'
                ? 'text-amber-300'
                : headerAccent === 'ucl'
                  ? 'text-sky-300'
                  : 'text-emerald-300'
            }`}
          >
            {headerBadge}
          </span>
          <span
            className={`rounded px-2 py-0.5 text-[10px] font-bold whitespace-nowrap ${
              isHome
                ? 'bg-emerald-500/15 text-emerald-300'
                : 'bg-sky-500/15 text-sky-300'
            }`}
          >
            {isHome ? 'HOME' : 'AWAY'}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setGuideOpen(true)}
          className="inline-flex items-center gap-1 rounded-lg border border-sky-400/35 bg-sky-500/10 px-2.5 py-1 text-[11px] font-bold text-sky-200 hover:bg-sky-500/20 transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <BookOpen className="w-3.5 h-3.5" />
          전술·상성 도감
        </button>
      </div>

      {/* 2) Streamlined Head-to-Head Comparison Bar (Our Team vs Opponent) */}
      <div className="rounded-xl border border-slate-800/90 bg-[#0b1018] p-3 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Our Team Summary */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-black text-emerald-300 whitespace-nowrap">
              MY TEAM
            </span>
            <span className="font-mono text-xs font-bold text-white whitespace-nowrap">
              {formation}
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-xs font-bold text-emerald-300 whitespace-nowrap">
              {TACTICS[activeTactic].shortName}
            </span>
          </div>

          <span className="font-display text-xs font-black text-slate-500">
            VS
          </span>

          {/* Opponent Summary */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="text-right min-w-0">
              <div className="flex items-center justify-end gap-1.5">
                <span className="truncate text-sm font-extrabold text-white">
                  {opponent.name}
                </span>
                {opponentSubtitle && (
                  <span className="hidden sm:inline text-[10px] text-slate-400 whitespace-nowrap">
                    ({opponentSubtitle})
                  </span>
                )}
              </div>
              <div className="flex items-center justify-end gap-1.5 text-[11px]">
                <span className="font-mono font-bold text-sky-300">
                  {opponent.formation}
                </span>
                <span className="text-slate-600">·</span>
                <span className="font-bold text-amber-300">
                  {TACTICS[opponent.defaultTactic].name}
                </span>
              </div>
            </div>
            <JerseySvg
              primaryColor={opponent.primaryColor}
              secondaryColor={opponent.secondaryColor}
              pattern={opponent.pattern}
              label={opponent.shortName}
              size={38}
            />
          </div>
        </div>

        {/* Dual Stat Comparison Bar (OUR vs OPP) */}
        <div className="grid grid-cols-3 gap-2">
          <StatComparePill
            label="ATT 공격"
            ourVal={ourRatings.att}
            oppVal={opponent.att}
          />
          <StatComparePill
            label="MID 중원"
            ourVal={ourRatings.mid}
            oppVal={opponent.mid}
          />
          <StatComparePill
            label="DEF 수비"
            ourVal={ourRatings.def}
            oppVal={opponent.def}
          />
        </div>

        {/* 1-Line Real-Time Matchup Diagnosis Strip */}
        <div
          className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] ${diagnosisBadgeCls}`}
        >
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            <span className="font-extrabold whitespace-nowrap">
              {diagnosisIcon} {diagnosisTitle}
            </span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-200 leading-snug">
              {tacticMatch.reason}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 text-[10px]">
            <span
              className={`rounded px-1.5 py-0.5 font-bold whitespace-nowrap ${
                formationMatch.delta > 0
                  ? 'bg-emerald-500/20 text-emerald-200'
                  : formationMatch.delta < 0
                    ? 'bg-rose-500/20 text-rose-200'
                    : 'bg-slate-900/70 text-slate-300'
              }`}
            >
              포메이션 {formationMatch.delta >= 0 ? '+' : ''}
              {formationMatch.delta.toFixed(1)}
            </span>
            <span
              className={`rounded px-1.5 py-0.5 font-bold whitespace-nowrap ${
                styleNetDelta > 0.2
                  ? 'bg-emerald-500/20 text-emerald-200'
                  : 'bg-slate-900/70 text-slate-300'
              }`}
            >
              스타일 +{styleNetDelta.toFixed(1)}
            </span>
          </div>
        </div>
      </div>

      {/* 3) Always-Visible Compact Tactic & Formation Bar */}
      <div className="rounded-xl border border-slate-800/90 bg-[#0b1018] p-3 space-y-2.5">
        {/* Tactic 5-Button Selector */}
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
            <span className="inline-flex items-center gap-1.5 font-bold text-slate-200">
              <Compass className="w-3.5 h-3.5 text-emerald-400" />
              맞춤 전술 선택
            </span>
            {activeTactic !== recommendedTactic ? (
              <button
                type="button"
                onClick={() => onSelectTactic(recommendedTactic)}
                className="inline-flex items-center gap-1 rounded bg-amber-400/15 border border-amber-400/40 px-2 py-0.5 text-[10px] font-bold text-amber-200 hover:bg-amber-400/25 cursor-pointer whitespace-nowrap"
              >
                <Sparkles className="w-2.5 h-2.5" />
                카운터 추천: {TACTICS[recommendedTactic].shortName} 적용
              </button>
            ) : (
              <span className="text-[10px] font-bold text-emerald-300">
                ✓ 최적 카운터 전술 적용됨
              </span>
            )}
          </div>

          <div className="grid grid-cols-5 gap-1">
            {TACTIC_LIST.map((t) => {
              const active = activeTactic === t.id;
              const isRec = recommendedTactic === t.id;
              const vsEval = evaluateTacticMatchup(t.id, opponent.defaultTactic);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onSelectTactic(t.id)}
                  className={`relative rounded-lg py-1.5 px-1 text-center transition-all cursor-pointer ${
                    active
                      ? 'bg-emerald-500 text-slate-950 font-extrabold shadow'
                      : 'bg-[#111822] text-slate-300 border border-slate-800 hover:border-slate-600 font-bold'
                  }`}
                >
                  <div className="text-[11px] leading-tight whitespace-nowrap">
                    {t.shortName}
                  </div>
                  <div
                    className={`mt-0.5 text-[9px] font-bold tabular-nums ${
                      active
                        ? 'text-slate-900'
                        : vsEval.delta > 0
                          ? 'text-emerald-400'
                          : vsEval.delta < 0
                            ? 'text-rose-400'
                            : 'text-slate-500'
                    }`}
                  >
                    {vsEval.delta > 0
                      ? `유리 +${vsEval.delta.toFixed(1)}`
                      : vsEval.delta < 0
                        ? `불리 ${vsEval.delta.toFixed(1)}`
                        : '호각'}
                  </div>
                  {isRec && !active && (
                    <span className="absolute -top-1.5 right-0.5 rounded bg-amber-400 px-1 text-[8px] font-black text-slate-950">
                      추천
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Formation 6-Button Selector + Quick Optimize */}
        <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1.5 font-bold text-slate-200">
              <Shield className="w-3.5 h-3.5 text-sky-400" />
              우리 팀 포메이션
            </span>
            <button
              type="button"
              onClick={() => {
                setSelectedSlot(null);
                onAutoOptimize();
              }}
              className="inline-flex items-center gap-1 rounded-md bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-extrabold text-emerald-300 hover:bg-emerald-500/30 cursor-pointer whitespace-nowrap"
            >
              <Wand2 className="w-3 h-3" />
              빠른 최적 선발
            </button>
          </div>
          <div className="grid grid-cols-6 gap-1">
            {FORMATION_LIST.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setSelectedSlot(null);
                  onChangeFormation(f.id);
                }}
                className={`rounded-lg py-1.5 text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  formation === f.id
                    ? 'bg-sky-400 text-slate-950 font-extrabold'
                    : 'bg-[#111822] text-slate-300 border border-slate-800 hover:border-slate-600'
                }`}
              >
                {f.id}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4) Formation Pitch Visualizer (Opponent Pitch vs Our Lineup Editor) */}
      <div className="rounded-xl border border-slate-800/90 bg-[#0b1018] p-3 space-y-2.5">
        {/* Segmented Pitch View Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 rounded-lg bg-[#111822] p-1 text-[11px] w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setPitchTab('opponent')}
              className={`inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 font-bold transition-colors cursor-pointer whitespace-nowrap ${
                pitchTab === 'opponent'
                  ? 'bg-sky-400 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              상대 포메이션 ({opponent.formation})
            </button>
            <button
              type="button"
              onClick={() => setPitchTab('our_squad')}
              className={`inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 font-bold transition-colors cursor-pointer whitespace-nowrap ${
                pitchTab === 'our_squad'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              내 선발 편집 ({formation})
            </button>
            <button
              type="button"
              onClick={() => setPitchTab('split')}
              className={`hidden sm:inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 font-bold transition-colors cursor-pointer whitespace-nowrap ${
                pitchTab === 'split'
                  ? 'bg-amber-400 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Columns2 className="w-3.5 h-3.5" />
              양 팀 피치 비교
            </button>
          </div>

          {styleMatch.highlights.length > 0 && (
            <div className="hidden md:flex items-center gap-1 text-[10px] text-emerald-300 truncate">
              <span className="font-bold text-slate-400">상성 우위:</span>
              <span className="truncate">
                {styleMatch.highlights.slice(0, 2).join(' · ')}
              </span>
            </div>
          )}
        </div>

        {/* Pitch Content Area */}
        {pitchTab === 'opponent' && (
          <div className="mx-auto max-w-[460px]">
            <OpponentPitchView
              opponent={opponent}
              roster={opponentRoster}
              onClickPlayerName={onClickOpponentPlayerName}
            />
          </div>
        )}

        {pitchTab === 'our_squad' && (
          <div className="mx-auto max-w-[460px] space-y-1.5">
            <div className="flex items-center justify-between text-[11px] px-1">
              <span className="inline-flex items-center gap-1 text-slate-400">
                <ArrowLeftRight className="w-3 h-3 text-emerald-400" />
                {selectedSlot
                  ? '교체할 대상 슬롯을 클릭하세요'
                  : '선발 ↔ 벤치 클릭·드래그로 즉시 교체'}
              </span>
              {selectedSlot && (
                <button
                  type="button"
                  onClick={() => setSelectedSlot(null)}
                  className="text-amber-300 hover:underline cursor-pointer"
                >
                  선택 취소
                </button>
              )}
            </div>
            <PitchBoard
              formation={formation}
              starters={starters}
              bench={bench}
              chemistry={chemistry}
              managerTraitId={managerTraitId}
              selectedSlot={selectedSlot}
              onSlotClick={handleSlotClick}
              onSlotSwap={(from, to) => {
                onSwapSquad(from, to);
                setSelectedSlot(null);
              }}
              onInspectPlayer={onInspectPlayer}
              showBench
              showChemBreakdown={false}
              compact
            />
          </div>
        )}

        {pitchTab === 'split' && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 items-start">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] px-1">
                <span className="font-extrabold text-emerald-300">
                  우리 팀 선발 · 벤치 ({formation})
                </span>
                {selectedSlot && (
                  <button
                    type="button"
                    onClick={() => setSelectedSlot(null)}
                    className="text-amber-300 hover:underline cursor-pointer"
                  >
                    취소
                  </button>
                )}
              </div>
              <PitchBoard
                formation={formation}
                starters={starters}
                bench={bench}
                chemistry={chemistry}
                managerTraitId={managerTraitId}
                selectedSlot={selectedSlot}
                onSlotClick={handleSlotClick}
                onSlotSwap={(from, to) => {
                  onSwapSquad(from, to);
                  setSelectedSlot(null);
                }}
                onInspectPlayer={onInspectPlayer}
                showBench
                showChemBreakdown={false}
                compact
              />
            </div>

            <div>
              <OpponentPitchView
                opponent={opponent}
                roster={opponentRoster}
                onClickPlayerName={onClickOpponentPlayerName}
              />
            </div>
          </div>
        )}
      </div>

      {/* 5) Sticky Always-Visible Match Kickoff / Skip Action Bar */}
      {children && (
        <div className="sticky bottom-2 z-30 rounded-xl border border-slate-700/90 bg-[#0a1019]/95 p-2.5 shadow-2xl backdrop-blur-md">
          {children}
        </div>
      )}

      <TacticsGuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />
    </div>
  );
}
