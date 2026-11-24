import {
  ArrowLeftRight,
  BookOpen,
  Columns2,
  Compass,
  Eye,
  Shield,
  Users,
  Wand2,
  Zap,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { getClubManager } from '../../data/aiManagers';
import { FORMATION_LIST } from '../../data/formations';
import {
  evaluateManagerTeamEffect,
  MANAGER_TRAITS,
} from '../../data/managerTraits';
import { calculateTeamRatings } from '../../engine/chemistryEngine';
import { TACTIC_LIST, TACTICS } from '../../engine/tacticEngine';
import {
  evaluateTeamTacticalProfile,
  evaluateUnifiedTacticalMatchup,
} from '../../engine/unifiedTacticsEngine';
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
import { UnifiedTacticsStrip } from '../common/UnifiedTacticsStrip';
import { OpponentPitchView } from './OpponentPitchView';

function shortFormationLabel(id: FormationId): string {
  if (id === '4-4-2-diamond') return '4-4-2◇';
  if (id === '3-5-2-dm') return '3-5-2 DM';
  return id;
}

interface MatchDayTacticsRoomProps {
  opponent: Club;
  opponentRoster: Player[];
  opponentSubtitle?: string;
  opponentManagerOverride?: {
    name: string;
    ovr: number;
    traitId: ManagerTraitId;
  };
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
  locked?: boolean;
  blindOpponentStatus?: 'editing' | 'locked' | null;
  firstLegBanner?: {
    stageLabel: string;
    homeName: string;
    awayName: string;
    homeLeg1Goals: number;
    awayLeg1Goals: number;
    isUserHomeLeg2: boolean;
  } | null;
  children?: React.ReactNode; // Sticky Kickoff / Skip action buttons slot
}

type PitchTabMode = 'split' | 'opponent' | 'our_squad';

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
  opponentManagerOverride,
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
  locked = false,
  blindOpponentStatus = null,
  firstLegBanner = null,
  children,
}: MatchDayTacticsRoomProps) {
  const [pitchTab, setPitchTab] = useState<PitchTabMode>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768
      ? 'our_squad'
      : 'split',
  );
  const [selectedSlot, setSelectedSlot] = useState<SlotRef | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);

  const filledStarters = useMemo(
    () => starters.filter((p): p is Player => p !== null),
    [starters],
  );

  const oppManager = useMemo(
    () => opponentManagerOverride ?? getClubManager(opponent),
    [opponentManagerOverride, opponent],
  );

  const ourRatings = useMemo(
    () =>
      calculateTeamRatings(
        formation,
        filledStarters,
        chemistry.total,
        managerTraitId,
        chemistry.slotSynergies,
        activeTactic,
      ),
    [formation, filledStarters, chemistry, managerTraitId, activeTactic],
  );

  const liveManagerEffect = useMemo(() => {
    if (!managerTraitId) return null;
    const isBigKnockout =
      (headerAccent === 'cup' && /(준결승|결승)/.test(headerBadge)) ||
      (headerAccent === 'ucl' && /(16강|8강|4강|준결승|결승|플레이오프)/.test(headerBadge));
    const oppAvgOvr = (opponent.att + opponent.mid + opponent.def) / 3;
    const baseUserAvgOvr =
      ((ourRatings.effectiveAtt - (ourRatings.managerAttBonus ?? 0)) +
        (ourRatings.effectiveMid - (ourRatings.managerMidBonus ?? 0)) +
        (ourRatings.effectiveDef - (ourRatings.managerDefBonus ?? 0))) /
      3;
    return evaluateManagerTeamEffect({
      traitId: managerTraitId,
      starters: filledStarters,
      tactic: activeTactic,
      userAvgOvr: baseUserAvgOvr,
      oppAvgOvr,
      isBigKnockout,
    });
  }, [
    managerTraitId,
    headerAccent,
    headerBadge,
    opponent.att,
    opponent.mid,
    opponent.def,
    ourRatings,
    filledStarters,
    activeTactic,
  ]);

  const oppManagerEffect = useMemo(() => {
    const isBigKnockout =
      (headerAccent === 'cup' && /(준결승|결승)/.test(headerBadge)) ||
      (headerAccent === 'ucl' && /(16강|8강|4강|준결승|결승|플레이오프)/.test(headerBadge));
    const oppAvgOvr = (opponent.att + opponent.mid + opponent.def) / 3;
    const baseUserAvgOvr =
      ((ourRatings.effectiveAtt - (ourRatings.managerAttBonus ?? 0)) +
        (ourRatings.effectiveMid - (ourRatings.managerMidBonus ?? 0)) +
        (ourRatings.effectiveDef - (ourRatings.managerDefBonus ?? 0))) /
      3;
    return evaluateManagerTeamEffect({
      traitId: oppManager.traitId,
      starters: opponentRoster.slice(0, 11),
      tactic: opponent.defaultTactic,
      userAvgOvr: oppAvgOvr,
      oppAvgOvr: baseUserAvgOvr,
      isBigKnockout,
    });
  }, [
    oppManager.traitId,
    opponentRoster,
    opponent.defaultTactic,
    opponent.att,
    opponent.mid,
    opponent.def,
    ourRatings,
    headerAccent,
    headerBadge,
  ]);

  const displayAtt = Math.round(
    (ourRatings.effectiveAtt + (liveManagerEffect?.situationalAttDelta ?? 0)) * 10,
  ) / 10;
  const displayMid = Math.round(
    (ourRatings.effectiveMid + (liveManagerEffect?.situationalMidDelta ?? 0)) * 10,
  ) / 10;
  const displayDef = Math.round(
    (ourRatings.effectiveDef + (liveManagerEffect?.situationalDefDelta ?? 0)) * 10,
  ) / 10;
  const managerPreferredTactic = managerTraitId
    ? MANAGER_TRAITS[managerTraitId]?.synergyTactic
    : undefined;

  const unifiedMatchup = useMemo(
    () =>
      evaluateUnifiedTacticalMatchup(
        {
          starters,
          formation,
          tactic: activeTactic,
          managerTraitId,
          managerOvr: 86,
        },
        {
          starters: opponentRoster.slice(0, 11),
          formation: opponent.formation,
          tactic: opponent.defaultTactic,
          managerTraitId: oppManager.traitId,
          managerOvr: oppManager.ovr,
        },
      ),
    [
      starters,
      formation,
      activeTactic,
      managerTraitId,
      opponentRoster,
      opponent.formation,
      opponent.defaultTactic,
      oppManager,
    ],
  );

  const tacticFits = useMemo(() => {
    const map: Record<TacticId, number> = {
      possession: 75,
      gegenpressing: 75,
      counter: 75,
      wingplay: 75,
      balanced: 75,
    };
    for (const t of TACTIC_LIST) {
      map[t.id] = evaluateTeamTacticalProfile({
        starters,
        formation,
        tactic: t.id,
        managerTraitId,
        managerOvr: 86,
      }).tacticalFit;
    }
    return map;
  }, [starters, formation, managerTraitId]);

  const handleSlotClick = (area: 'starter' | 'bench', index: number) => {
    if (locked) return;
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

  return (
    <div className={`rounded-xl sm:rounded-2xl border p-2.5 sm:p-4 space-y-2.5 sm:space-y-3.5 ${borderCls}`}>
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

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <span
            id="tactics-room-line-ovr"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-[#0b1018] px-2 py-1 text-[11px] font-bold text-slate-300 tabular-nums whitespace-nowrap"
          >
            <Zap className="w-3 h-3 text-emerald-400" />
            A <strong className="text-white">{displayAtt}</strong> / M{' '}
            <strong className="text-white">{displayMid}</strong> / D{' '}
            <strong className="text-white">{displayDef}</strong>
          </span>
          <button
            type="button"
            onClick={() => setGuideOpen(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-sky-400/35 bg-sky-500/10 px-2.5 py-1 text-[11px] font-bold text-sky-200 hover:bg-sky-500/20 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <BookOpen className="w-3.5 h-3.5" />
            전술·상성 도감
          </button>
        </div>
      </div>

      {/* Prominent UCL 2nd-Leg 1st-Leg Score & Required Goals Banner */}
      {firstLegBanner && (() => {
        const userLeg1 = firstLegBanner.isUserHomeLeg2
          ? firstLegBanner.homeLeg1Goals
          : firstLegBanner.awayLeg1Goals;
        const oppLeg1 = firstLegBanner.isUserHomeLeg2
          ? firstLegBanner.awayLeg1Goals
          : firstLegBanner.homeLeg1Goals;
        const diff = userLeg1 - oppLeg1;
        const statusCls =
          diff > 0
            ? 'border-emerald-400/60 bg-gradient-to-r from-emerald-950/75 via-[#101c26] to-sky-950/50'
            : diff < 0
              ? 'border-rose-400/60 bg-gradient-to-r from-rose-950/75 via-[#1c131d] to-amber-950/40'
              : 'border-amber-400/60 bg-gradient-to-r from-amber-950/70 via-[#161a24] to-sky-950/50';
        const neededText =
          diff > 0
            ? `현재 합산 +${diff}골 리드 · 2차전 무승부 또는 ${diff - 1}골 차 이내 패배까지 진출`
            : diff < 0
              ? `현재 합산 ${Math.abs(diff)}골 차 열세 · ${Math.abs(diff)}골 차 승리 시 연장전, ${Math.abs(diff) + 1}골 차 이상 승리 시 직행!`
              : '현재 합산 동점 · 2차전 승리 시 진출 (무승부 시 연장·승부차기)';

        return (
          <div
            className={`rounded-xl border-2 px-3.5 py-3 shadow-lg ${statusCls}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-amber-400 px-2 py-0.5 text-[10px] font-black text-slate-950 whitespace-nowrap">
                  1차전 합산 현황
                </span>
                <div className="flex items-center gap-2 font-display text-base sm:text-lg font-black text-white tabular-nums">
                  <span className={firstLegBanner.isUserHomeLeg2 ? 'text-emerald-300' : 'text-slate-100'}>
                    {firstLegBanner.homeName}
                  </span>
                  <span className="rounded-lg border border-amber-400/50 bg-slate-950/90 px-3 py-0.5 text-amber-300 text-lg sm:text-xl">
                    {firstLegBanner.homeLeg1Goals} - {firstLegBanner.awayLeg1Goals}
                  </span>
                  <span className={!firstLegBanner.isUserHomeLeg2 ? 'text-emerald-300' : 'text-slate-100'}>
                    {firstLegBanner.awayName}
                  </span>
                </div>
              </div>
              <span
                className={`rounded-md px-2.5 py-1 text-[11px] font-extrabold ${
                  diff > 0
                    ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/40'
                    : diff < 0
                      ? 'bg-rose-500/20 text-rose-200 border border-rose-400/40'
                      : 'bg-amber-500/20 text-amber-200 border border-amber-400/40'
                }`}
              >
                {diff > 0 ? `+${diff} 리드` : diff < 0 ? `${diff} 열세` : '동점'}
              </span>
            </div>
            <p className="mt-1.5 text-xs font-bold text-slate-200">
              {neededText}
            </p>
          </div>
        );
      })()}

      {/* 2) Streamlined Head-to-Head Comparison Bar (Our Team vs Opponent) */}
      <div className="rounded-xl border border-slate-800/90 bg-[#0b1018] p-3 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Our Team Summary */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-black text-emerald-300 whitespace-nowrap">
              MY TEAM
            </span>
            <span className="font-mono text-xs font-bold text-white whitespace-nowrap">
              {shortFormationLabel(formation)}
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
              <div className="flex flex-wrap items-center justify-end gap-1.5 text-[11px]">
                {blindOpponentStatus ? (
                  <span
                    className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                      blindOpponentStatus === 'locked'
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/35'
                        : 'bg-amber-500/15 text-amber-300 border border-amber-400/35'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        blindOpponentStatus === 'locked'
                          ? 'bg-emerald-400'
                          : 'bg-amber-400 animate-pulse'
                      }`}
                    />
                    {blindOpponentStatus === 'locked'
                      ? '전술 확정 (공개 대기)'
                      : '전술·포메이션 수정 중...'}
                  </span>
                ) : (
                  <>
                    <span className="font-mono font-bold text-sky-300">
                      {shortFormationLabel(opponent.formation)}
                    </span>
                    <span className="text-slate-600">·</span>
                    <span className="font-bold text-amber-300">
                      {TACTICS[opponent.defaultTactic].shortName}
                    </span>
                  </>
                )}
                <span className="text-slate-600">·</span>
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-300"
                  title={`${oppManager.name} (OVR ${oppManager.ovr} · ${MANAGER_TRAITS[oppManager.traitId]?.name ?? ''})`}
                >
                  {oppManager.name}
                  <span
                    className={`rounded px-1 py-0.2 text-[9px] font-black tabular-nums ${
                      oppManager.ovr >= 90
                        ? 'bg-amber-400/20 text-amber-300'
                        : oppManager.ovr >= 84
                          ? 'bg-sky-400/20 text-sky-300'
                          : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {oppManager.ovr}
                  </span>
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
            ourVal={Math.round(displayAtt)}
            oppVal={opponent.att}
          />
          <StatComparePill
            label="MID 중원"
            ourVal={Math.round(displayMid)}
            oppVal={opponent.mid}
          />
          <StatComparePill
            label="DEF 수비"
            ourVal={Math.round(displayDef)}
            oppVal={opponent.def}
          />
        </div>

        {/* Concise Dual Manager Ability Strip (My Manager vs Opponent Manager) */}
        {(liveManagerEffect || oppManagerEffect) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[10.5px]">
            <div
              className="flex items-center justify-between gap-2 rounded-lg border border-slate-800/80 bg-[#090e15] px-2.5 py-1.5 min-w-0"
              title={
                managerTraitId
                  ? `${MANAGER_TRAITS[managerTraitId]?.name}: ${MANAGER_TRAITS[managerTraitId]?.effectSummary}`
                  : undefined
              }
            >
              <div className="flex items-center gap-1.5 min-w-0 shrink-0">
                <span className="text-[9.5px] font-bold text-emerald-400/90">
                  내 감독
                </span>
                <span className="font-bold text-slate-100 truncate">
                  {managerTraitId ? MANAGER_TRAITS[managerTraitId]?.name : '-'}
                </span>
                {liveManagerEffect && liveManagerEffect.targetCount > 0 && (
                  <span className="text-[10px] font-semibold text-amber-300/95 tabular-nums">
                    ★{Math.min(liveManagerEffect.matchedCount, liveManagerEffect.targetCount)}/{liveManagerEffect.targetCount}
                  </span>
                )}
              </div>
              <span className="truncate font-semibold text-emerald-300/90 tabular-nums">
                {liveManagerEffect?.compactSummary ?? '-'}
              </span>
            </div>

            <div
              className="flex items-center justify-between gap-2 rounded-lg border border-slate-800/80 bg-[#090e15] px-2.5 py-1.5 min-w-0"
              title={`${oppManager.name} (OVR ${oppManager.ovr} · ${MANAGER_TRAITS[oppManager.traitId]?.name ?? ''}): ${MANAGER_TRAITS[oppManager.traitId]?.effectSummary ?? ''}`}
            >
              <div className="flex items-center gap-1.5 min-w-0 shrink-0">
                <span className="text-[9.5px] font-bold text-slate-400">
                  상대 감독
                </span>
                <span className="font-bold text-slate-100 truncate">
                  {MANAGER_TRAITS[oppManager.traitId]?.name ?? '-'}
                </span>
                {!blindOpponentStatus && oppManagerEffect.targetCount > 0 && (
                  <span className="text-[10px] font-semibold text-amber-300/85 tabular-nums">
                    ★{Math.min(oppManagerEffect.matchedCount, oppManagerEffect.targetCount)}/{oppManagerEffect.targetCount}
                  </span>
                )}
              </div>
              <span className="truncate font-semibold text-amber-200/90 tabular-nums">
                {blindOpponentStatus
                  ? '전술 비공개'
                  : oppManagerEffect.compactSummary}
              </span>
            </div>
          </div>
        )}

        {/* Minimal 1-Line Unified Tactical Zone Summary Strip + Interactive ? Help */}
        {blindOpponentStatus ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800/80 bg-[#090e15] px-3 py-1.5 text-[11px]">
            <span className="inline-flex items-center gap-1.5 font-bold text-sky-200 tabular-nums">
              내 전술 완성도{' '}
              <strong className="text-emerald-300">{tacticFits[activeTactic]}%</strong>
            </span>
            <span className="text-[10px] font-semibold text-slate-400">
              양측 확정 후 최종 전술·상성 비교 공개
            </span>
          </div>
        ) : (
          <UnifiedTacticsStrip matchup={unifiedMatchup} />
        )}
      </div>

      {/* 3) Always-Visible Compact Tactic & Formation Bar */}
      <div className="rounded-xl border border-slate-800/90 bg-[#0b1018] p-3 space-y-2.5">
        {/* Tactic 5-Button Selector (Shows Lineup Tactical Fit %, no forced RPS numbers) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-1.5 text-[11px]">
            <span className="inline-flex items-center gap-1.5 font-bold text-slate-200">
              <Compass className="w-3.5 h-3.5 text-emerald-400" />
              전술
              {locked && (
                <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[9px] font-extrabold text-sky-300">
                  확정됨
                </span>
              )}
            </span>
            <span className="text-[10px] font-bold text-slate-400 tabular-nums">
              {TACTICS[activeTactic].name} · {tacticFits[activeTactic]}%
            </span>
          </div>

          <div className="grid grid-cols-5 gap-1">
            {TACTIC_LIST.map((t) => {
              const active = activeTactic === t.id;
              const fitPct = tacticFits[t.id];
              const isMgrPreferred = managerPreferredTactic === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  disabled={locked}
                  onClick={() => {
                    if (!locked) onSelectTactic(t.id);
                  }}
                  title={`${t.name} (라인업 완성도 ${fitPct}%${isMgrPreferred ? ' · 감독 추천 전술' : ''})`}
                  className={`relative min-w-0 rounded-lg py-1.5 px-1 text-center transition-colors ${
                    locked ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
                  } ${
                    active
                      ? 'bg-emerald-500/18 text-emerald-100 border border-emerald-400/55 font-extrabold'
                      : isMgrPreferred
                        ? 'bg-[#111822] text-slate-200 border border-slate-700 hover:border-slate-500 font-bold'
                        : 'bg-[#111822] text-slate-300 border border-slate-800 hover:border-slate-600 font-bold'
                  }`}
                >
                  <div className="truncate text-[10px] sm:text-[11px] leading-tight">
                    {isMgrPreferred && (
                      <span className="text-amber-300 mr-0.5">★</span>
                    )}
                    {t.shortName}
                  </div>
                  <div
                    className={`mt-0.5 truncate text-[8px] sm:text-[9px] font-bold tabular-nums ${
                      active
                        ? 'text-emerald-300'
                        : fitPct >= 84
                          ? 'text-emerald-400'
                          : fitPct >= 74
                            ? 'text-slate-400'
                            : 'text-rose-400'
                    }`}
                  >
                    {fitPct}%
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Formation 9-Button Selector + Quick Optimize */}
        <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1.5 font-bold text-slate-200">
              <Shield className="w-3.5 h-3.5 text-sky-400" />
              포메이션
            </span>
            <button
              type="button"
              disabled={locked}
              onClick={() => {
                if (locked) return;
                setSelectedSlot(null);
                onAutoOptimize();
              }}
              className="inline-flex items-center gap-1 rounded-md bg-slate-800/90 border border-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-200 hover:border-emerald-400/50 hover:text-emerald-200 disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
            >
              <Wand2 className="w-3 h-3 text-emerald-400" />
              빠른 최적 선발
            </button>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-1">
            {FORMATION_LIST.map((f) => (
              <button
                key={f.id}
                type="button"
                disabled={locked}
                title={`${f.name} · ${f.shortTag}`}
                onClick={() => {
                  if (locked) return;
                  setSelectedSlot(null);
                  onChangeFormation(f.id);
                }}
                className={`rounded-lg py-1.5 px-1 text-[10px] sm:text-[11px] font-bold transition-colors truncate ${
                  locked ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
                } ${
                  formation === f.id
                    ? 'bg-sky-500/18 text-sky-100 border border-sky-400/55 font-extrabold'
                    : 'bg-[#111822] text-slate-300 border border-slate-800 hover:border-slate-600'
                }`}
              >
                {shortFormationLabel(f.id)}
              </button>
            ))}
          </div>
        </div>

        {/* Always-Visible Primary Match Action Controls (Kickoff / Skip) */}
        {children && (
          <div className="pt-2.5 border-t border-slate-800/90">
            {children}
          </div>
        )}
      </div>

      {/* 4) Formation Pitch Visualizer (Opponent Pitch vs Our Lineup Editor) */}
      <div className="rounded-xl border border-slate-800/90 bg-[#0b1018] p-3 space-y-2.5">
        {/* Segmented Pitch View Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="grid grid-cols-3 gap-1 rounded-lg border border-slate-800 bg-[#111822] p-1 text-[11px] w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setPitchTab('split')}
              className={`inline-flex items-center justify-center gap-1 rounded-md px-2 sm:px-2.5 py-1.5 font-bold transition-colors cursor-pointer whitespace-nowrap ${
                pitchTab === 'split'
                  ? 'bg-slate-800 text-white border border-slate-600/80 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              <Columns2 className="w-3.5 h-3.5 shrink-0 text-amber-300" />
              양 팀 피치 비교
            </button>
            <button
              type="button"
              onClick={() => setPitchTab('opponent')}
              className={`inline-flex items-center justify-center gap-1 rounded-md px-2 sm:px-2.5 py-1.5 font-bold transition-colors cursor-pointer whitespace-nowrap ${
                pitchTab === 'opponent'
                  ? 'bg-slate-800 text-white border border-slate-600/80 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              <Eye className="w-3.5 h-3.5 shrink-0 text-sky-300" />
              {blindOpponentStatus
                ? '상대 스쿼드'
                : `상대 (${opponent.formation})`}
            </button>
            <button
              type="button"
              onClick={() => setPitchTab('our_squad')}
              className={`inline-flex items-center justify-center gap-1 rounded-md px-2 sm:px-2.5 py-1.5 font-bold transition-colors cursor-pointer whitespace-nowrap ${
                pitchTab === 'our_squad'
                  ? 'bg-slate-800 text-white border border-slate-600/80 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              <Users className="w-3.5 h-3.5 shrink-0 text-emerald-300" />
              내 선발 ({shortFormationLabel(formation)})
            </button>
          </div>
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
                {locked
                  ? '전술 확정됨 · 수정하려면 아래 [전술 수정]을 누르세요'
                  : selectedSlot
                    ? '교체할 대상 슬롯을 클릭하세요'
                    : '선발 ↔ 벤치 클릭·드래그로 즉시 교체'}
              </span>
              {selectedSlot && !locked && (
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
              selectedSlot={locked ? null : selectedSlot}
              onSlotClick={locked ? undefined : handleSlotClick}
              onSlotSwap={
                locked
                  ? undefined
                  : (from, to) => {
                      onSwapSquad(from, to);
                      setSelectedSlot(null);
                    }
              }
              onInspectPlayer={onInspectPlayer}
              showBench
              showChemBreakdown={false}
              compact
            />
          </div>
        )}

        {pitchTab === 'split' && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 items-start">
            <div>
              <PitchBoard
                formation={formation}
                starters={starters}
                bench={bench}
                chemistry={chemistry}
                managerTraitId={managerTraitId}
                selectedSlot={locked ? null : selectedSlot}
                onSlotClick={locked ? undefined : handleSlotClick}
                onSlotSwap={
                  locked
                    ? undefined
                    : (from, to) => {
                        onSwapSquad(from, to);
                        setSelectedSlot(null);
                      }
                }
                onInspectPlayer={onInspectPlayer}
                showBench
                showChemBreakdown={false}
                compact
                headerLabel="우리 팀 선발 · 벤치"
                headerRight={
                  selectedSlot && !locked ? (
                    <button
                      type="button"
                      onClick={() => setSelectedSlot(null)}
                      className="text-[11px] font-semibold text-amber-300 hover:underline cursor-pointer"
                    >
                      취소
                    </button>
                  ) : null
                }
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

      <TacticsGuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />
    </div>
  );
}
