import {
  Check,
  Crown,
  Diamond,
  FastForward,
  Loader2,
  Swords,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { getClubManager } from '../../../data/aiManagers';
import { FORMATIONS } from '../../../data/formations';
import {
  evaluateManagerTeamEffect,
  MANAGER_TRAITS,
} from '../../../data/managerTraits';
import {
  calculateChemistry,
  calculateTeamRatings,
} from '../../../engine/chemistryEngine';
import { buildAiClubRoster } from '../../../engine/dataLoader';
import { optimizeCurrentStartersForFormation } from '../../../engine/lineupOptimizer';
import { TACTICS } from '../../../engine/tacticEngine';
import { UCL_EXTERNAL_TEAMS, UCL_STAGE_LABELS } from '../../../engine/uclEngine';
import {
  evaluateTeamTacticalProfile,
  evaluateUnifiedTacticalMatchup,
} from '../../../engine/unifiedTacticsEngine';
import { ModalBodyLock } from '../../../hooks/useBodyScrollLock';
import type {
  ChemistryLineType,
  ChemistryResult,
  FormationId,
  ManagerTraitId,
} from '../../../types/game';
import type { Club, LeagueId, TacticId } from '../../../types/league';
import type {
  MpLeagueHuman,
  MpSquadInput,
  MpUclLive,
} from '../../../types/mpLeague';
import { getCardTier } from '../../../types/player';
import type { Player } from '../../../types/player';
import type { UclKnockoutStage, UclKnockoutTie } from '../../../types/ucl';
import { CountryFlagSvg } from '../../common/CountryFlagSvg';
import { JerseySvg } from '../../common/JerseySvg';
import { PixelManagerAvatar } from '../../common/PixelManagerAvatar';
import { PixelTrophySvg } from '../../common/PixelTrophySvg';
import { UnifiedTacticsStrip } from '../../common/UnifiedTacticsStrip';

export interface MpUclMatchPreviewModalProps {
  ucl: MpUclLive;
  leagueId: LeagueId;
  clubsById: Record<string, Club>;
  humans: MpLeagueHuman[];
  publicSquads: Record<string, MpSquadInput>;
  myClubId: string | null;
  mySquad: MpSquadInput | null;
  isHost: boolean;
  flowKey: string;
  flowLabel: string;
  requiredClubIds: string[];
  allEliminated: boolean;
  hasPlayerAck: (human: MpLeagueHuman, key: string) => boolean;
  iAcked: boolean;
  waitingSurvivors: string[];
  onAck: (key: string) => void;
  onInspectPlayer?: (player: Player) => void;
}

interface PreviewSideModel {
  clubId: string;
  club: Club;
  human: MpLeagueHuman | null;
  isMe: boolean;
  isHomeThisLeg: boolean;
  formation: FormationId;
  tactic: TacticId;
  starters: (Player | null)[];
  managerName: string;
  managerOvr: number;
  managerTraitId: ManagerTraitId;
  chemistry: ChemistryResult;
  att: number;
  mid: number;
  def: number;
  ovr: number;
  tacticalFit: number;
  mgrEffectSummary: string;
  mgrMatched: number;
  mgrTarget: number;
  topPlayers: { player: Player; displayOvr: number; bonus: number }[];
}

const SYNERGY_COLORS: Record<ChemistryLineType, string> = {
  club: '#10b981',
  nation: '#38bdf8',
  style: '#f59e0b',
  elite: '#c084fc',
};

const EXTERNAL_ROSTER_BY_CLUB_ID: Map<string, Player[]> = new Map(
  UCL_EXTERNAL_TEAMS.map((e) => [e.club.id, e.roster]),
);

const SUFFIX_KEEP_FIRST = new Set([
  '주니오르',
  '주니어',
  '필류',
  '네투',
  '시니어',
]);

function shortFormationLabel(id: FormationId): string {
  if (id === '4-4-2-diamond') return '4-4-2◇';
  if (id === '3-5-2-dm') return '3-5-2 DM';
  return id;
}

function shortPlayerName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length <= 7) return trimmed;
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    if (SUFFIX_KEEP_FIRST.has(last)) return parts[0];
    if (last.length >= 2 && last.length <= 8) return last;
  }
  return trimmed;
}

function isKoStage(stage: string): stage is UclKnockoutStage {
  return (
    stage === 'playoff' ||
    stage === 'r16' ||
    stage === 'qf' ||
    stage === 'sf' ||
    stage === 'final'
  );
}

function fallbackClub(id: string): Club {
  return {
    id,
    name: id,
    shortName: id.slice(0, 3).toUpperCase(),
    primaryColor: '#334155',
    secondaryColor: '#94a3b8',
    pattern: 'solid',
    att: 80,
    mid: 80,
    def: 80,
    formation: '4-3-3',
    defaultTactic: 'balanced',
    topScorers: ['', '', ''],
  };
}

function resolveAiRosterForPreview(
  club: Club,
  ucl: MpUclLive,
  fallbackLeagueId: LeagueId,
  humanOwnedIds: Set<string>,
): Player[] {
  const fromLive = ucl.knockoutPreviewRosters?.[club.id];
  if (fromLive && fromLive.length > 0) {
    return fromLive.filter((p) => !humanOwnedIds.has(p.id)).slice(0, 11);
  }
  const fromExternal = EXTERNAL_ROSTER_BY_CLUB_ID.get(club.id);
  if (fromExternal && fromExternal.length > 0) {
    return fromExternal.filter((p) => !humanOwnedIds.has(p.id)).slice(0, 11);
  }
  return buildAiClubRoster(club, fallbackLeagueId, humanOwnedIds).slice(0, 11);
}

function buildSidePreview(params: {
  clubId: string;
  isHomeThisLeg: boolean;
  myClubId: string | null;
  mySquad: MpSquadInput | null;
  clubsById: Record<string, Club>;
  humansByClub: Map<string, MpLeagueHuman>;
  publicSquads: Record<string, MpSquadInput>;
  ucl: MpUclLive;
  fallbackLeagueId: LeagueId;
}): PreviewSideModel {
  const {
    clubId,
    isHomeThisLeg,
    myClubId,
    mySquad,
    clubsById,
    humansByClub,
    publicSquads,
    ucl,
    fallbackLeagueId,
  } = params;
  const club = clubsById[clubId] ?? fallbackClub(clubId);
  const human = humansByClub.get(clubId) ?? null;
  const isMe = Boolean(myClubId && clubId === myClubId);
  const squad = isMe ? (mySquad ?? publicSquads[clubId]) : publicSquads[clubId];

  let formation: FormationId;
  let tactic: TacticId;
  let starters: (Player | null)[];
  let managerName: string;
  let managerOvr: number;
  let managerTraitId: ManagerTraitId;

  if (human && squad && squad.starters.length === 11) {
    formation = squad.formation;
    tactic = squad.tactic;
    starters = squad.starters;
    managerName = human.nickname;
    managerOvr = 86;
    managerTraitId = squad.managerTraitId;
  } else {
    const aiMgr = getClubManager(club);
    formation = club.formation ?? '4-3-3';
    tactic = club.defaultTactic ?? 'balanced';
    managerName = aiMgr.name;
    managerOvr = aiMgr.ovr;
    managerTraitId = aiMgr.traitId;
    const humanOwnedIds = new Set<string>();
    if (mySquad) {
      for (const p of [...mySquad.starters, ...mySquad.bench]) {
        if (p) humanOwnedIds.add(p.id);
      }
    }
    for (const sq of Object.values(publicSquads)) {
      for (const p of [...sq.starters, ...sq.bench]) {
        if (p) humanOwnedIds.add(p.id);
      }
    }
    const rawRoster = resolveAiRosterForPreview(
      club,
      ucl,
      fallbackLeagueId,
      humanOwnedIds,
    );
    starters = optimizeCurrentStartersForFormation(
      rawRoster,
      formation,
      tactic,
      managerTraitId,
    );
  }

  const filledStarters = starters.filter((p): p is Player => p !== null);
  const chemistry = calculateChemistry(
    formation,
    starters,
    tactic,
    managerTraitId,
    managerOvr,
  );
  const ratings = calculateTeamRatings(
    formation,
    filledStarters,
    chemistry.total,
    managerTraitId,
    chemistry.slotSynergies,
    tactic,
  );
  const tacticalFit = evaluateTeamTacticalProfile({
    starters: filledStarters,
    formation,
    tactic,
    managerTraitId,
    managerOvr,
  }).tacticalFit;
  const mgrEffect = evaluateManagerTeamEffect({
    traitId: managerTraitId,
    starters,
    tactic,
  });

  const topPlayers = starters
    .map((player, idx) => {
      if (!player) return null;
      const syn = chemistry.slotSynergies[idx];
      const displayOvr = syn ? syn.effectiveOvrWithSynergy : player.ovr;
      return {
        player,
        displayOvr,
        bonus: syn?.totalBonus ?? 0,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.displayOvr - a.displayOvr || b.player.ovr - a.player.ovr)
    .slice(0, 3);

  return {
    clubId,
    club,
    human,
    isMe,
    isHomeThisLeg,
    formation,
    tactic,
    starters,
    managerName,
    managerOvr,
    managerTraitId,
    chemistry,
    att: Math.round(ratings.effectiveAtt || ratings.att || club.att),
    mid: Math.round(ratings.effectiveMid || ratings.mid || club.mid),
    def: Math.round(ratings.effectiveDef || ratings.def || club.def),
    ovr: Math.round(ratings.ovr),
    tacticalFit,
    mgrEffectSummary: mgrEffect.compactSummary,
    mgrMatched: mgrEffect.matchedCount,
    mgrTarget: mgrEffect.targetCount,
    topPlayers,
  };
}

function CompareBarRow({
  label,
  leftVal,
  rightVal,
}: {
  label: string;
  leftVal: number;
  rightVal: number;
}) {
  const leftWins = leftVal > rightVal;
  const rightWins = rightVal > leftVal;
  const minBound = 62;
  const maxBound = 99;
  const toPct = (v: number) =>
    Math.max(12, Math.min(100, Math.round(((v - minBound) / (maxBound - minBound)) * 100)));

  return (
    <div className="grid grid-cols-[40px_1fr_36px_1fr_40px] items-center gap-2 text-xs tabular-nums">
      <span
        className={`text-right font-display font-black ${
          leftWins ? 'text-emerald-300' : 'text-slate-200'
        }`}
      >
        {leftVal}
      </span>
      <div className="flex justify-end h-2 rounded-full bg-slate-900 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            leftWins ? 'bg-emerald-400' : 'bg-sky-400/75'
          }`}
          style={{ width: `${toPct(leftVal)}%` }}
        />
      </div>
      <span className="text-center text-[10px] font-black tracking-wider text-slate-400">
        {label}
      </span>
      <div className="flex justify-start h-2 rounded-full bg-slate-900 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            rightWins ? 'bg-amber-400' : 'bg-slate-500/80'
          }`}
          style={{ width: `${toPct(rightVal)}%` }}
        />
      </div>
      <span
        className={`text-left font-display font-black ${
          rightWins ? 'text-amber-300' : 'text-slate-200'
        }`}
      >
        {rightVal}
      </span>
    </div>
  );
}

function CompactPreviewPitch({
  side,
  onInspectPlayer,
}: {
  side: PreviewSideModel;
  onInspectPlayer?: (player: Player) => void;
}) {
  const config = FORMATIONS[side.formation] ?? FORMATIONS['4-3-3'];

  return (
    <div className="relative aspect-[4/3.35] w-full overflow-hidden rounded-xl border border-slate-800/90 bg-gradient-to-b from-[#0e1925] via-[#0c161e] to-[#0a1319]">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <rect
          x="4"
          y="4"
          width="92"
          height="92"
          rx="1.5"
          fill="none"
          stroke="rgba(148,163,184,0.12)"
          strokeWidth="0.5"
        />
        <line
          x1="4"
          y1="50"
          x2="96"
          y2="50"
          stroke="rgba(148,163,184,0.10)"
          strokeWidth="0.42"
        />
        <circle
          cx="50"
          cy="50"
          r="10"
          fill="none"
          stroke="rgba(148,163,184,0.10)"
          strokeWidth="0.42"
        />
        {side.chemistry.links.map((link) => {
          const fromSlot = config.slots[link.fromIndex];
          const toSlot = config.slots[link.toIndex];
          if (!fromSlot || !toSlot || link.activeLines.length === 0) return null;
          const dx = toSlot.x - fromSlot.x;
          const dy = toSlot.y - fromSlot.y;
          const len = Math.hypot(dx, dy) || 1;
          const nx = -dy / len;
          const ny = dx / len;
          const spacing = link.activeLines.length >= 3 ? 0.9 : 1.05;
          const centerOffset = ((link.activeLines.length - 1) * spacing) / 2;
          return link.activeLines.map((lineType, i) => {
            const offset = i * spacing - centerOffset;
            return (
              <line
                key={`${link.fromIndex}-${link.toIndex}-${lineType}`}
                x1={fromSlot.x + nx * offset}
                y1={fromSlot.y + ny * offset}
                x2={toSlot.x + nx * offset}
                y2={toSlot.y + ny * offset}
                stroke={SYNERGY_COLORS[lineType]}
                strokeOpacity={0.78}
                strokeWidth={0.68}
                strokeLinecap="round"
              />
            );
          });
        })}
      </svg>

      {config.slots.map((slot, idx) => {
        const player = side.starters[idx];
        const syn = side.chemistry.slotSynergies[idx];
        const displayOvr = syn ? syn.effectiveOvrWithSynergy : (player?.ovr ?? 0);
        const tier = player ? getCardTier(player) : null;
        return (
          <div
            key={`${side.clubId}-slot-${slot.index}`}
            onClick={() => {
              if (player && onInspectPlayer) onInspectPlayer(player);
            }}
            style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
            className={`absolute -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center ${
              player && onInspectPlayer ? 'cursor-pointer' : ''
            }`}
          >
            <div
              className={`relative flex flex-col items-center rounded-md px-1.5 py-0.5 min-w-[46px] max-w-[74px] text-center shadow ${
                tier === 'legend'
                  ? 'border border-amber-400/85 bg-amber-950/90'
                  : tier === 'superstar'
                    ? 'border border-cyan-400/80 bg-cyan-950/90'
                    : tier === 'worldclass'
                      ? 'border border-sky-400/65 bg-sky-950/90'
                      : 'border border-slate-700/80 bg-[#0f1621]/95'
              }`}
            >
              {tier === 'legend' ? (
                <Crown className="absolute -top-2 left-1/2 -translate-x-1/2 h-2.5 w-2.5 text-amber-300" />
              ) : tier === 'superstar' ? (
                <Diamond className="absolute -top-2 left-1/2 -translate-x-1/2 h-2.5 w-2.5 text-cyan-300" />
              ) : null}
              <div className="flex items-center gap-0.5 leading-none tabular-nums">
                <span className="font-display text-[10px] font-bold text-white">
                  {player ? displayOvr : '-'}
                </span>
                {player && (
                  <CountryFlagSvg
                    code={player.nationalityCode}
                    nationality={player.nationality}
                    size="xs"
                  />
                )}
              </div>
              <span className="mt-0.5 max-w-[66px] truncate text-[8px] font-semibold text-slate-200 leading-tight">
                {player ? shortPlayerName(player.name) : slot.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Multiplayer Champions League Knockout Boundary Preview Modal.
 * Replaces simple squad/tactics editing between knockout stages & legs with a focused
 * head-to-head comparison preview + survivor-only [준비 완료] action.
 */
export function MpUclMatchPreviewModal({
  ucl,
  leagueId,
  clubsById,
  humans,
  publicSquads,
  myClubId,
  mySquad,
  isHost,
  flowKey,
  flowLabel,
  requiredClubIds,
  allEliminated,
  hasPlayerAck,
  iAcked,
  waitingSurvivors,
  onAck,
  onInspectPlayer,
}: MpUclMatchPreviewModalProps) {
  const [lineupTab, setLineupTab] = useState<'key' | 'pitch'>('key');
  const [mobilePitchSide, setMobilePitchSide] = useState<'left' | 'right'>('left');
  const [selectedTieId, setSelectedTieId] = useState<string | null>(null);

  const stage: UclKnockoutStage = isKoStage(ucl.stage) ? ucl.stage : 'r16';
  const isFinal = stage === 'final';
  const leg: 1 | 2 = isFinal ? 1 : ucl.knockoutLeg;
  const stageTitle = isFinal
    ? 'UCL 결승전'
    : `${UCL_STAGE_LABELS[stage]} · ${leg}차전`;

  const humansByClub = useMemo(
    () => new Map(humans.map((h) => [h.clubId, h])),
    [humans],
  );

  const activeTies: UclKnockoutTie[] = useMemo(() => {
    const raw = (ucl.ties[stage] ?? []).filter((t) => t.winnerId === null);
    return [...raw].sort((a, b) => {
      const score = (t: UclKnockoutTie) => {
        const mine =
          myClubId && (t.teamAId === myClubId || t.teamBId === myClubId) ? 4 : 0;
        const hCount =
          (humansByClub.has(t.teamAId) ? 1 : 0) +
          (humansByClub.has(t.teamBId) ? 1 : 0);
        return mine + hCount * 2;
      };
      return score(b) - score(a);
    });
  }, [ucl.ties, stage, myClubId, humansByClub]);

  const myActiveTie = useMemo(
    () =>
      myClubId
        ? (activeTies.find(
            (t) => t.teamAId === myClubId || t.teamBId === myClubId,
          ) ?? null)
        : null,
    [activeTies, myClubId],
  );

  const isPlayoffBye = Boolean(
    !allEliminated &&
      stage === 'playoff' &&
      myClubId &&
      requiredClubIds.includes(myClubId) &&
      !myActiveTie,
  );

  const featuredTie: UclKnockoutTie | null = useMemo(() => {
    if (myActiveTie) return myActiveTie;
    if (selectedTieId) {
      const picked = activeTies.find((t) => t.id === selectedTieId);
      if (picked) return picked;
    }
    return activeTies[0] ?? null;
  }, [myActiveTie, selectedTieId, activeTies]);

  // Determine left vs right team in the comparison (always put MY club on the left when I play)
  const previewPair = useMemo(() => {
    if (!featuredTie) return null;
    const homeTeamId =
      isFinal || leg === 2 ? featuredTie.teamAId : featuredTie.teamBId;
    const awayTeamId =
      isFinal || leg === 2 ? featuredTie.teamBId : featuredTie.teamAId;

    let leftClubId = homeTeamId;
    let rightClubId = awayTeamId;
    if (myClubId && awayTeamId === myClubId) {
      leftClubId = awayTeamId;
      rightClubId = homeTeamId;
    }

    const left = buildSidePreview({
      clubId: leftClubId,
      isHomeThisLeg: leftClubId === homeTeamId,
      myClubId,
      mySquad,
      clubsById,
      humansByClub,
      publicSquads,
      ucl,
      fallbackLeagueId: leagueId,
    });
    const right = buildSidePreview({
      clubId: rightClubId,
      isHomeThisLeg: rightClubId === homeTeamId,
      myClubId,
      mySquad,
      clubsById,
      humansByClub,
      publicSquads,
      ucl,
      fallbackLeagueId: leagueId,
    });

    const matchup = evaluateUnifiedTacticalMatchup(
      {
        starters: left.starters.filter((p): p is Player => p !== null),
        formation: left.formation,
        tactic: left.tactic,
        managerTraitId: left.managerTraitId,
        managerOvr: left.managerOvr,
      },
      {
        starters: right.starters.filter((p): p is Player => p !== null),
        formation: right.formation,
        tactic: right.tactic,
        managerTraitId: right.managerTraitId,
        managerOvr: right.managerOvr,
      },
    );

    const leftIsTeamA = leftClubId === featuredTie.teamAId;
    const leftAggBefore = leftIsTeamA
      ? featuredTie.aggTeamA
      : featuredTie.aggTeamB;
    const rightAggBefore = leftIsTeamA
      ? featuredTie.aggTeamB
      : featuredTie.aggTeamA;

    const leg1 = featuredTie.leg1;
    const leg1LeftGoals = leg1
      ? leg1.homeTeamId === leftClubId
        ? leg1.homeGoals
        : leg1.awayGoals
      : null;
    const leg1RightGoals = leg1
      ? leg1.homeTeamId === rightClubId
        ? leg1.homeGoals
        : leg1.awayGoals
      : null;

    return {
      tie: featuredTie,
      left,
      right,
      matchup,
      isFriendH2H: Boolean(left.human && right.human),
      leftAggBefore,
      rightAggBefore,
      leg1LeftGoals,
      leg1RightGoals,
    };
  }, [
    featuredTie,
    isFinal,
    leg,
    myClubId,
    mySquad,
    clubsById,
    humansByClub,
    publicSquads,
    ucl,
    leagueId,
  ]);

  const survivorHumans = useMemo(
    () =>
      allEliminated
        ? []
        : humans.filter((h) => requiredClubIds.includes(h.clubId)),
    [allEliminated, humans, requiredClubIds],
  );
  const readyCount = survivorHumans.filter((h) => hasPlayerAck(h, flowKey)).length;
  const iAmRequired = allEliminated
    ? isHost
    : Boolean(myClubId && requiredClubIds.includes(myClubId));

  const renderSideHeader = (side: PreviewSideModel, align: 'left' | 'right') => {
    const traitCfg = MANAGER_TRAITS[side.managerTraitId];
    return (
      <div
        className={`flex min-w-0 flex-col gap-1.5 ${
          align === 'right' ? 'items-end text-right' : 'items-start text-left'
        }`}
      >
        <div
          className={`flex items-center gap-2 min-w-0 max-w-full ${
            align === 'right' ? 'flex-row-reverse' : ''
          }`}
        >
          <div className="relative shrink-0">
            <JerseySvg
              primaryColor={side.club.primaryColor}
              secondaryColor={side.club.secondaryColor}
              pattern={side.club.pattern}
              label={side.club.shortName}
              size={40}
            />
          </div>
          <div className="min-w-0">
            <div
              className={`flex items-center gap-1.5 ${
                align === 'right' ? 'justify-end' : ''
              }`}
            >
              {side.isMe ? (
                <span className="shrink-0 rounded bg-emerald-400 px-1.5 py-px text-[9px] font-black text-slate-950">
                  MY
                </span>
              ) : side.human ? (
                <span className="shrink-0 rounded border border-amber-400/45 bg-amber-500/15 px-1.5 py-px text-[9px] font-black text-amber-200">
                  친구 · {side.human.nickname}
                </span>
              ) : null}
              <span className="shrink-0 rounded border border-slate-700 bg-slate-900/90 px-1 py-px text-[9px] font-bold text-slate-400">
                {side.isHomeThisLeg ? 'HOME' : 'AWAY'}
              </span>
            </div>
            <div className="mt-0.5 truncate text-sm sm:text-base font-black text-white">
              {side.club.name}
            </div>
            <div className="flex flex-wrap items-center gap-1 text-[10px] text-slate-400">
              <span className="font-mono font-bold text-sky-300">
                {shortFormationLabel(side.formation)}
              </span>
              <span>·</span>
              <span className="font-bold text-amber-300">
                {TACTICS[side.tactic].shortName}
              </span>
              <span>·</span>
              <span className="font-bold text-emerald-300 tabular-nums">
                케미 {side.chemistry.total}
              </span>
            </div>
          </div>
        </div>

        <div
          className={`inline-flex flex-wrap items-center gap-1 rounded-lg border border-slate-800 bg-[#090f1b] px-2 py-1 text-[10px] ${
            align === 'right' ? 'justify-end' : ''
          }`}
        >
          {side.human && (
            <PixelManagerAvatar
              avatar={side.human.avatar}
              clubPrimaryColor={side.human.profile.primaryColor}
              clubSecondaryColor={side.human.profile.secondaryColor}
              size={15}
            />
          )}
          <span className="font-semibold text-slate-300">{side.managerName}</span>
          {traitCfg && (
            <span
              className="rounded px-1.5 py-px text-[9px] font-extrabold text-slate-950"
              style={{ backgroundColor: traitCfg.badgeColor }}
            >
              {traitCfg.name}
              {side.mgrTarget > 0
                ? ` ${Math.min(side.mgrMatched, side.mgrTarget)}/${side.mgrTarget}`
                : ''}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      id="mp-ucl-knockout-preview-modal"
      className="modal-backdrop fixed inset-0 z-[68] flex items-center justify-center bg-slate-950/88 p-2.5 sm:p-4"
    >
      <ModalBodyLock />
      <div className="modal-panel flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-sky-500/35 bg-[#0b1322] shadow-2xl">
        {/* Top Header */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-[#080f1d] px-3.5 py-2.5 sm:px-5 sm:py-3">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <PixelTrophySvg variant="ucl" size={22} />
            <span className="rounded border border-sky-400/40 bg-sky-500/18 px-2 py-0.5 text-[10px] font-black tracking-wide text-sky-200">
              {stageTitle}
            </span>
            <h2 className="truncate font-display text-sm sm:text-base font-bold text-white">
              {myActiveTie
                ? '경기 프리뷰'
                : isPlayoffBye
                  ? '16강 직행 · 플레이오프 관전'
                  : '관전 프리뷰'}
            </h2>
            {previewPair?.isFriendH2H && (
              <span className="inline-flex items-center gap-1 rounded-md border border-amber-400/50 bg-amber-500/18 px-2 py-0.5 text-[10px] font-black text-amber-200">
                <Swords className="h-3 w-3" />
                친구 맞대결
              </span>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {allEliminated ? (
              <span className="rounded-md border border-rose-500/35 bg-rose-500/15 px-2 py-0.5 text-[10px] font-extrabold text-rose-200">
                생존자 0명
              </span>
            ) : (
              <span
                id="mp-ucl-preview-ready-count"
                className="rounded-md border border-sky-400/35 bg-sky-500/15 px-2.5 py-0.5 text-[10px] font-black tabular-nums text-sky-200"
              >
                생존자 준비 {readyCount}/{survivorHumans.length}
              </span>
            )}
          </div>
        </div>

        {/* Single Scrollable Body (100dvh compliant, zero nested scroll) */}
        <div className="modal-scroll flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-3">
          {/* Spectator / Bye Tie Switcher when user is not directly playing this leg */}
          {!myActiveTie && activeTies.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {activeTies.slice(0, 6).map((t) => {
                const cA = clubsById[t.teamAId];
                const cB = clubsById[t.teamBId];
                const active = featuredTie?.id === t.id;
                const hasFriend =
                  humansByClub.has(t.teamAId) || humansByClub.has(t.teamBId);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTieId(t.id)}
                    className={`rounded-lg border px-2 py-1 text-[10px] font-bold transition-colors cursor-pointer touch-manipulation ${
                      active
                        ? 'border-sky-400/60 bg-sky-500/20 text-sky-100'
                        : hasFriend
                          ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200 hover:border-emerald-400/60'
                          : 'border-slate-800 bg-[#0d1525] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {cA?.shortName ?? t.teamAId} vs {cB?.shortName ?? t.teamBId}
                  </button>
                );
              })}
            </div>
          )}

          {previewPair ? (
            <>
              {/* 1. Matchup Header Card (with Leg 1 & AGG status for 2nd leg) */}
              <div className="rounded-xl border border-slate-800 bg-[#0e1729] p-3 sm:p-4 space-y-3">
                {!isFinal && leg === 2 && previewPair.leg1LeftGoals !== null && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sky-400/35 bg-sky-500/10 px-3 py-1.5 text-xs tabular-nums">
                    <span className="font-bold text-slate-300">
                      1차전{' '}
                      <strong className="font-mono text-white">
                        {previewPair.left.club.shortName}{' '}
                        {previewPair.leg1LeftGoals} :{' '}
                        {previewPair.leg1RightGoals}{' '}
                        {previewPair.right.club.shortName}
                      </strong>
                    </span>
                    <span className="font-mono font-black text-amber-300">
                      합산 AGG {previewPair.leftAggBefore} :{' '}
                      {previewPair.rightAggBefore}
                      {previewPair.left.isMe && (
                        <span className="ml-1.5 text-[10px] font-extrabold text-sky-200">
                          {previewPair.leftAggBefore > previewPair.rightAggBefore
                            ? `(+${previewPair.leftAggBefore - previewPair.rightAggBefore} 리드)`
                            : previewPair.leftAggBefore < previewPair.rightAggBefore
                              ? `(${previewPair.leftAggBefore - previewPair.rightAggBefore} 열세)`
                              : '(동률)'}
                        </span>
                      )}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-4">
                  {renderSideHeader(previewPair.left, 'left')}

                  <div className="flex flex-col items-center gap-1 px-1 text-center">
                    <span className="font-display text-lg sm:text-2xl font-black tracking-widest text-slate-500">
                      VS
                    </span>
                    <span className="rounded-md border border-slate-800 bg-[#080f1c] px-2 py-0.5 font-mono text-[10px] font-extrabold tabular-nums text-slate-300">
                      OVR {previewPair.left.ovr} : {previewPair.right.ovr}
                    </span>
                  </div>

                  {renderSideHeader(previewPair.right, 'right')}
                </div>
              </div>

              {/* 2. Team Power & Tactical Comparison */}
              <div className="rounded-xl border border-slate-800 bg-[#0d1424] p-3 sm:p-4 space-y-3">
                <div className="space-y-2">
                  <CompareBarRow
                    label="ATT"
                    leftVal={previewPair.left.att}
                    rightVal={previewPair.right.att}
                  />
                  <CompareBarRow
                    label="MID"
                    leftVal={previewPair.left.mid}
                    rightVal={previewPair.right.mid}
                  />
                  <CompareBarRow
                    label="DEF"
                    leftVal={previewPair.left.def}
                    rightVal={previewPair.right.def}
                  />
                </div>

                {/* Chemistry, Tactical Fit, Manager Synergy Strip */}
                <div className="grid grid-cols-2 gap-2 border-t border-slate-800/80 pt-2.5 text-[11px] tabular-nums">
                  {[previewPair.left, previewPair.right].map((side, idx) => (
                    <div
                      key={`${side.clubId}-meta-${idx}`}
                      className="rounded-lg border border-slate-800/90 bg-[#090f1b] px-2.5 py-2 space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-extrabold text-white">
                          {side.club.shortName}
                        </span>
                        <span className="font-mono text-[10px] font-bold text-emerald-300 shrink-0">
                          케미 {side.chemistry.total} (
                          {side.chemistry.chemistryOvrBonus >= 0 ? '+' : ''}
                          {side.chemistry.chemistryOvrBonus.toFixed(1)}) · 완성도{' '}
                          {side.tacticalFit}%
                        </span>
                      </div>
                      <div className="truncate text-[10px] text-slate-400">
                        {side.mgrEffectSummary}
                      </div>
                    </div>
                  ))}
                </div>

                {/* 5-Zone Tactical Matchup Strip */}
                <div className="border-t border-slate-800/80 pt-2.5">
                  <UnifiedTacticsStrip matchup={previewPair.matchup} />
                </div>
              </div>

              {/* 3. Key Players / Starting XI Formation Comparison */}
              <div className="rounded-xl border border-slate-800 bg-[#0d1424] p-3 sm:p-4 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-200">
                    <Users className="h-3.5 w-3.5 text-sky-300" />
                    양 팀 핵심 전력 비교
                  </span>
                  <div className="inline-flex rounded-lg border border-slate-800 bg-[#080f1c] p-0.5 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setLineupTab('key')}
                      className={`rounded-md px-2.5 py-1 font-bold transition-colors cursor-pointer touch-manipulation ${
                        lineupTab === 'key'
                          ? 'border border-sky-400/50 bg-sky-500/20 text-sky-100'
                          : 'border border-transparent text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      핵심 TOP 3
                    </button>
                    <button
                      type="button"
                      onClick={() => setLineupTab('pitch')}
                      className={`rounded-md px-2.5 py-1 font-bold transition-colors cursor-pointer touch-manipulation ${
                        lineupTab === 'pitch'
                          ? 'border border-sky-400/50 bg-sky-500/20 text-sky-100'
                          : 'border border-transparent text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      선발 포메이션
                    </button>
                  </div>
                </div>

                {lineupTab === 'key' ? (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {[previewPair.left, previewPair.right].map((side) => (
                      <div
                        key={`${side.clubId}-top3`}
                        className="rounded-xl border border-slate-800/90 bg-[#090f1b] p-2.5 space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                          <span className="truncate text-slate-200">
                            {side.club.name}
                          </span>
                          <span>
                            {shortFormationLabel(side.formation)} ·{' '}
                            {TACTICS[side.tactic].shortName}
                          </span>
                        </div>
                        {side.topPlayers.map(({ player, displayOvr, bonus }) => (
                          <button
                            key={player.id}
                            type="button"
                            onClick={() => onInspectPlayer?.(player)}
                            className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-800/80 bg-[#0e1626] px-2.5 py-1.5 text-left text-xs hover:border-sky-400/45 transition-colors cursor-pointer touch-manipulation"
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="w-7 shrink-0 rounded bg-slate-900 px-1 py-0.5 text-center font-mono text-[9px] font-bold text-slate-300">
                                {player.mainPositions[0] ?? player.position}
                              </span>
                              <CountryFlagSvg
                                code={player.nationalityCode}
                                nationality={player.nationality}
                                size="xs"
                              />
                              <span className="truncate font-bold text-slate-100">
                                {player.name}
                              </span>
                            </div>
                            <div className="flex shrink-0 items-center gap-1 font-mono tabular-nums">
                              <span className="text-xs font-black text-amber-200">
                                {displayOvr}
                              </span>
                              {bonus > 0 && (
                                <span className="text-[10px] font-bold text-emerald-300">
                                  +{bonus}
                                </span>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Mobile side switcher for crisp single-column pitch view */}
                    <div className="grid grid-cols-2 gap-1 rounded-lg border border-slate-800 bg-[#080f1c] p-0.5 text-[11px] md:hidden">
                      <button
                        type="button"
                        onClick={() => setMobilePitchSide('left')}
                        className={`rounded-md py-1.5 font-bold cursor-pointer touch-manipulation truncate px-2 ${
                          mobilePitchSide === 'left'
                            ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/45'
                            : 'text-slate-400'
                        }`}
                      >
                        {previewPair.left.club.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => setMobilePitchSide('right')}
                        className={`rounded-md py-1.5 font-bold cursor-pointer touch-manipulation truncate px-2 ${
                          mobilePitchSide === 'right'
                            ? 'bg-sky-500/20 text-sky-200 border border-sky-400/45'
                            : 'text-slate-400'
                        }`}
                      >
                        {previewPair.right.club.name}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div
                        className={
                          mobilePitchSide === 'left' ? 'block' : 'hidden md:block'
                        }
                      >
                        <div className="mb-1 flex items-center justify-between px-1 text-[11px] font-bold">
                          <span className="truncate text-emerald-200">
                            {previewPair.left.club.name}
                          </span>
                          <span className="font-mono text-slate-400">
                            {shortFormationLabel(previewPair.left.formation)}
                          </span>
                        </div>
                        <CompactPreviewPitch
                          side={previewPair.left}
                          onInspectPlayer={onInspectPlayer}
                        />
                      </div>
                      <div
                        className={
                          mobilePitchSide === 'right' ? 'block' : 'hidden md:block'
                        }
                      >
                        <div className="mb-1 flex items-center justify-between px-1 text-[11px] font-bold">
                          <span className="truncate text-sky-200">
                            {previewPair.right.club.name}
                          </span>
                          <span className="font-mono text-slate-400">
                            {shortFormationLabel(previewPair.right.formation)}
                          </span>
                        </div>
                        <CompactPreviewPitch
                          side={previewPair.right}
                          onInspectPlayer={onInspectPlayer}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-[#0d1424] px-4 py-8 text-center text-xs font-bold text-slate-400">
              {flowLabel} 대진 확인 중...
            </div>
          )}

          {/* Other Round Matchups Strip (compact) */}
          {activeTies.length > 1 && (
            <div className="rounded-xl border border-slate-800/80 bg-[#090f1c] p-2.5 space-y-1.5">
              <div className="text-[10px] font-bold text-slate-500">
                이번 라운드 전체 대진 ({activeTies.length}경기)
              </div>
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {activeTies.map((t) => {
                  const cA = clubsById[t.teamAId];
                  const cB = clubsById[t.teamBId];
                  const involvesMe =
                    Boolean(myClubId && (t.teamAId === myClubId || t.teamBId === myClubId));
                  const involvesFriend =
                    humansByClub.has(t.teamAId) || humansByClub.has(t.teamBId);
                  return (
                    <div
                      key={t.id}
                      className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1 text-[10.5px] tabular-nums ${
                        involvesMe
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-white'
                          : involvesFriend
                            ? 'border-sky-500/30 bg-sky-500/8 text-slate-200'
                            : 'border-slate-800/70 bg-[#0c1322] text-slate-400'
                      }`}
                    >
                      <span className="flex-1 truncate text-right font-bold">
                        {cA?.shortName ?? t.teamAId}
                      </span>
                      <span className="shrink-0 font-mono font-black text-amber-300">
                        {t.leg1 ? `${t.aggTeamA}:${t.aggTeamB}` : 'vs'}
                      </span>
                      <span className="flex-1 truncate font-bold">
                        {cB?.shortName ?? t.teamBId}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Fixed Footer: Survivor Ready Roster + Primary Ready / Host Advance Action */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2.5 border-t border-slate-800 bg-[#080f1d] px-3.5 py-3 sm:px-5">
          <div className="flex flex-wrap items-center gap-1.5">
            {allEliminated ? (
              <span className="text-xs font-bold text-slate-400">
                참가자 전원 탈락 · 방장 확인 후 남은 경기를 진행합니다
              </span>
            ) : (
              survivorHumans.map((h) => {
                const ok = hasPlayerAck(h, flowKey);
                return (
                  <span
                    key={h.clubId}
                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-bold ${
                      ok
                        ? 'border-emerald-500/45 bg-emerald-500/15 text-emerald-200'
                        : 'border-slate-700 bg-[#0d1525] text-slate-400'
                    }`}
                  >
                    {ok ? (
                      <Check className="h-3 w-3 text-emerald-300" />
                    ) : (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    )}
                    {h.nickname}
                  </span>
                );
              })
            )}
          </div>

          <div className="flex items-center gap-2">
            {allEliminated ? (
              isHost ? (
                <button
                  id="mpl-consent-btn"
                  type="button"
                  disabled={iAcked}
                  onClick={() => onAck(flowKey)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-5 py-2.5 text-xs font-black text-slate-950 hover:bg-amber-300 disabled:opacity-60 cursor-pointer touch-manipulation"
                >
                  <FastForward className="h-3.5 w-3.5" />
                  {iAcked ? '진행 중...' : '다음 경기 진행'}
                </button>
              ) : (
                <span className="rounded-lg border border-slate-700 bg-[#0d1525] px-3 py-2 text-xs font-bold text-slate-400">
                  방장 진행 대기 중
                </span>
              )
            ) : !iAmRequired ? (
              <span className="rounded-lg border border-slate-700 bg-[#0d1525] px-3 py-2 text-xs font-bold text-slate-300">
                관전 중 ·{' '}
                {waitingSurvivors.length > 0
                  ? `${waitingSurvivors.join(', ')} 준비 대기`
                  : '곧 시작'}
              </span>
            ) : iAcked ? (
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-2 text-xs font-extrabold text-emerald-200">
                <Check className="h-3.5 w-3.5" />
                준비 완료됨
                {waitingSurvivors.length > 0 && (
                  <span className="font-semibold text-slate-300">
                    · {waitingSurvivors.join(', ')} 대기 중
                  </span>
                )}
              </span>
            ) : (
              <button
                id="mpl-consent-btn"
                type="button"
                onClick={() => onAck(flowKey)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-black text-slate-950 hover:bg-emerald-400 cursor-pointer touch-manipulation shadow-lg"
              >
                <Check className="h-4 w-4" />
                준비 완료
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
