import {
  ArrowLeftRight,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Compass,
  Shield,
  Sparkles,
  Swords,
  Users,
  Wand2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { FORMATION_LIST } from '../../data/formations';
import { PLAYSTYLES } from '../../data/playstyles';
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
  children?: React.ReactNode; // Kickoff / Skip action buttons slot
}

const POS_ORDER: Record<Player['position'], number> = {
  FW: 0,
  MF: 1,
  DF: 2,
  GK: 3,
};

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
  const [showOppSquad, setShowOppSquad] = useState(true);
  const [showLineupEditor, setShowLineupEditor] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<SlotRef | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);

  const filledStarters = useMemo(
    () => starters.filter((p): p is Player => p !== null),
    [starters],
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

  const sortedOppRoster = useMemo(
    () =>
      [...opponentRoster].sort(
        (a, b) => POS_ORDER[a.position] - POS_ORDER[b.position] || b.ovr - a.ovr,
      ),
    [opponentRoster],
  );

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
      ? 'border-amber-500/50 bg-gradient-to-b from-amber-950/20 to-[#111822]'
      : headerAccent === 'ucl'
        ? 'border-sky-500/40 bg-gradient-to-b from-sky-950/20 to-[#0e1520]'
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

  return (
    <div className={`rounded-2xl border p-4 sm:p-5 space-y-4 ${borderCls}`}>
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`text-xs font-extrabold ${
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
            className={`rounded px-2 py-0.5 text-[10px] font-bold ${
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
          className="inline-flex items-center gap-1.5 rounded-lg border border-sky-400/35 bg-sky-500/10 px-2.5 py-1 text-[11px] font-bold text-sky-200 hover:bg-sky-500/20 transition-colors cursor-pointer"
        >
          <BookOpen className="w-3.5 h-3.5" />
          전술·상성 도감
        </button>
      </div>

      {/* 1) Opponent Scouting Card + Expected Starting XI */}
      <div className="rounded-xl border border-slate-800 bg-[#0b1018] overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5">
          <div className="flex items-center gap-3 min-w-0">
            <JerseySvg
              primaryColor={opponent.primaryColor}
              secondaryColor={opponent.secondaryColor}
              pattern={opponent.pattern}
              label={opponent.shortName}
              size={46}
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="truncate text-base font-extrabold text-white">
                  {opponent.name}
                </span>
                {opponentSubtitle && (
                  <span className="text-[10px] font-semibold text-slate-400">
                    ({opponentSubtitle})
                  </span>
                )}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
                <span className="rounded bg-sky-500/15 px-1.5 py-0.5 font-bold text-sky-300">
                  예상 포메이션 {opponent.formation}
                </span>
                <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-bold text-amber-300">
                  전술: {TACTICS[opponent.defaultTactic].name}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex gap-1.5 text-center tabular-nums">
              <div className="rounded-lg bg-[#111822] px-2.5 py-1.5">
                <div className="text-[9px] text-slate-500">ATT</div>
                <div className="font-display text-sm font-bold text-white">
                  {opponent.att}
                </div>
              </div>
              <div className="rounded-lg bg-[#111822] px-2.5 py-1.5">
                <div className="text-[9px] text-slate-500">MID</div>
                <div className="font-display text-sm font-bold text-white">
                  {opponent.mid}
                </div>
              </div>
              <div className="rounded-lg bg-[#111822] px-2.5 py-1.5">
                <div className="text-[9px] text-slate-500">DEF</div>
                <div className="font-display text-sm font-bold text-white">
                  {opponent.def}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Opponent Starting XI Toggle & Grid */}
        {sortedOppRoster.length > 0 && (
          <div className="border-t border-slate-800/80">
            <button
              type="button"
              onClick={() => setShowOppSquad((v) => !v)}
              className="flex w-full items-center justify-between px-3.5 py-2 text-[11px] font-bold text-slate-300 hover:bg-slate-900/60 cursor-pointer"
            >
              <span className="inline-flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-sky-400" />
                상대 예상 선발 11인 · 주요 선수 OVR &amp; 플레이스타일 분석
              </span>
              {showOppSquad ? (
                <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>

            {showOppSquad && (
              <div className="grid grid-cols-1 gap-1.5 px-3.5 pb-3 sm:grid-cols-2">
                {sortedOppRoster.slice(0, 11).map((p) => {
                  const primaryStyle = p.playstyles[0]
                    ? PLAYSTYLES[p.playstyles[0]]?.shortName
                    : null;
                  const isKeyThreat = p.ovr >= 85;
                  return (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[11px] tabular-nums ${
                        isKeyThreat
                          ? 'border border-amber-500/25 bg-amber-950/15'
                          : 'bg-[#101822]/90 border border-slate-800/70'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`w-8 shrink-0 rounded py-0.5 text-center text-[9px] font-black ${
                            p.position === 'FW'
                              ? 'bg-rose-500/20 text-rose-300'
                              : p.position === 'MF'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : p.position === 'DF'
                                  ? 'bg-sky-500/20 text-sky-300'
                                  : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {p.mainPositions[0] ?? p.position}
                        </span>
                        {onClickOpponentPlayerName ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onClickOpponentPlayerName(p.id);
                            }}
                            className="truncate font-bold text-slate-100 hover:text-emerald-300 hover:underline cursor-pointer text-left"
                          >
                            {p.name}
                          </button>
                        ) : (
                          <span className="truncate font-bold text-slate-100">
                            {p.name}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {primaryStyle && (
                          <span className="rounded bg-slate-900 px-1.5 py-0.5 text-[9px] font-semibold text-slate-300">
                            {primaryStyle}
                          </span>
                        )}
                        <span
                          className={`font-display text-xs font-black ${
                            p.ovr >= 88
                              ? 'text-cyan-300'
                              : p.ovr >= 84
                                ? 'text-amber-300'
                                : 'text-slate-200'
                          }`}
                        >
                          {p.ovr}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2) Real-Time Matchup Diagnosis Bar */}
      <div className={`rounded-xl border p-3 space-y-2 ${diagnosisBadgeCls}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-extrabold">
            <span>{diagnosisIcon}</span>
            <span>{diagnosisTitle}</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
            <span
              className={`rounded px-1.5 py-0.5 ${
                formationMatch.delta > 0
                  ? 'bg-emerald-500/20 text-emerald-200'
                  : formationMatch.delta < 0
                    ? 'bg-rose-500/20 text-rose-200'
                    : 'bg-slate-900/70 text-slate-300'
              }`}
            >
              포메이션 {formationMatch.delta > 0 ? `+${formationMatch.delta.toFixed(1)}` : formationMatch.delta.toFixed(1)}
            </span>
            <span className="inline-flex items-center gap-1 rounded bg-slate-950/65 px-1.5 py-0.5 text-amber-200">
              <Sparkles className="w-3 h-3" />
              스타일 카운터 {styleMatch.matchedCount}명
              {(styleMatch.xgBonus > 0 || styleMatch.oppXgPenalty > 0) &&
                ` (xG +${styleMatch.xgBonus.toFixed(2)} / 실점억제 -${styleMatch.oppXgPenalty.toFixed(2)})`}
            </span>
          </div>
        </div>
        <p className="text-[11px] leading-snug opacity-95">
          {tacticMatch.reason}
          {tacticMatch.delta < 0 && (
            <span className="ml-1 font-extrabold underline">
              → [{TACTICS[recommendedTactic].name}] 전환 추천!
            </span>
          )}
        </p>
        {styleMatch.highlights.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 pt-0.5">
            {styleMatch.highlights.map((hl) => (
              <span
                key={hl}
                className="rounded bg-slate-950/55 px-1.5 py-0.5 text-[10px] font-semibold text-slate-200"
              >
                ✓ {hl}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 3) Pre-Match Tactic, Formation & Inline Starting XI Customizer */}
      <div className="rounded-xl border border-slate-800 bg-[#0b1018] p-3.5 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="inline-flex items-center gap-1.5 font-bold text-slate-200">
            <Compass className="w-3.5 h-3.5 text-emerald-400" />
            이번 경기 맞춤 전술 (상대: {TACTICS[opponent.defaultTactic].name})
          </span>
          <span className="text-[10px] text-slate-400">
            추천 표시 = 카운터 전술
          </span>
        </div>

        <div className="grid grid-cols-5 gap-1.5">
          {TACTIC_LIST.map((t) => {
            const active = activeTactic === t.id;
            const isRec = recommendedTactic === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelectTactic(t.id)}
                className={`relative rounded-lg py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                  active
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-[#111822] text-slate-300 border border-slate-800 hover:border-slate-600'
                }`}
              >
                {t.shortName}
                {isRec && !active && (
                  <span className="absolute -top-1.5 right-0.5 rounded bg-amber-400 px-1 text-[8px] font-black text-slate-950">
                    추천
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
          <span className="inline-flex items-center gap-1.5 font-bold text-slate-300">
            <Shield className="w-3.5 h-3.5 text-sky-400" />
            포메이션 (상대: {opponent.formation})
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onAutoOptimize}
              className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300 hover:bg-emerald-500/25 cursor-pointer"
            >
              <Wand2 className="w-3 h-3" />
              빠른 선발
            </button>
            <button
              type="button"
              onClick={() => {
                setShowLineupEditor((v) => !v);
                setSelectedSlot(null);
              }}
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold cursor-pointer transition-colors ${
                showLineupEditor
                  ? 'border-sky-400 bg-sky-400 text-slate-950'
                  : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-sky-400/60'
              }`}
            >
              <Swords className="w-3 h-3" />
              {showLineupEditor ? '라인업 편집 접기' : '선발 라인업 바로 수정'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-6 gap-1">
          {FORMATION_LIST.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => onChangeFormation(f.id)}
              className={`rounded-lg py-1.5 text-[11px] font-bold cursor-pointer ${
                formation === f.id
                  ? 'bg-sky-400 text-slate-950'
                  : 'bg-[#111822] text-slate-300 border border-slate-800 hover:border-slate-600'
              }`}
            >
              {f.id}
            </button>
          ))}
        </div>

        {/* Inline Match-Day Pitch Lineup Editor */}
        {showLineupEditor && (
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-300">
              <span className="inline-flex items-center gap-1 font-semibold">
                <ArrowLeftRight className="w-3.5 h-3.5 text-emerald-400" />
                {selectedSlot
                  ? '교환할 선수 슬롯을 클릭하세요'
                  : '클릭·드래그로 이번 경기 맞춤 선발/벤치를 즉시 조정하세요'}
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
      </div>

      {/* Match Action Buttons Slot */}
      {children}

      {/* 1-Page Tactics & Playstyle Encyclopedia Modal */}
      <TacticsGuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />
    </div>
  );
}
