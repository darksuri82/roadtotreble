import {
  ArrowLeftRight,
  BookOpen,
  Check,
  FastForward,
  Flame,
  Loader2,
  Shield,
  Swords,
  Users,
  Wand2,
  Zap,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { getClubManager } from '../../../data/aiManagers';
import { FORMATION_LIST, FORMATIONS } from '../../../data/formations';
import {
  evaluateManagerTeamEffect,
  MANAGER_TRAITS,
} from '../../../data/managerTraits';
import {
  calculateChemistry,
  calculateTeamRatings,
} from '../../../engine/chemistryEngine';
import { buildAiClubRoster } from '../../../engine/dataLoader';
import {
  optimizeBestLineup,
  optimizeCurrentStartersForFormation,
  remapStartersForFormation,
} from '../../../engine/lineupOptimizer';
import { hydrateMpSquadWithAwakenings } from '../../../engine/mpLeagueEngine';
import { TACTIC_LIST, TACTICS } from '../../../engine/tacticEngine';
import {
  evaluateTacticalExposure,
  EXPOSURE_DANGER_THRESHOLD,
  EXPOSURE_WARNING_THRESHOLD,
} from '../../../engine/tacticalAdaptationEngine';
import { UCL_EXTERNAL_TEAMS, UCL_STAGE_LABELS } from '../../../engine/uclEngine';
import {
  evaluateTeamTacticalProfile,
  evaluateUnifiedTacticalMatchup,
} from '../../../engine/unifiedTacticsEngine';
import { ModalBodyLock } from '../../../hooks/useBodyScrollLock';
import type { PlayerConditionMap } from '../../../types/condition';
import type {
  ChemistryResult,
  FormationId,
  ManagerTraitId,
  StaffCoachId,
  TacticalHistoryEntry,
} from '../../../types/game';
import type { Club, LeagueId, TacticId } from '../../../types/league';
import type {
  MpHumanLive,
  MpLeagueHuman,
  MpSquadInput,
  MpUclLive,
} from '../../../types/mpLeague';
import {
  formatPlayerRecordName,
  getClassicEra,
  getClassicEraMeta,
} from '../../../types/player';
import type { Player, SubPosition } from '../../../types/player';
import type { UclKnockoutStage, UclKnockoutTie } from '../../../types/ucl';
import { CountryFlagSvg } from '../../common/CountryFlagSvg';
import { JerseySvg } from '../../common/JerseySvg';
import { PitchBoard } from '../../common/PitchBoard';
import type { SlotRef } from '../../common/PitchBoard';
import { PixelManagerAvatar } from '../../common/PixelManagerAvatar';
import { PixelTrophySvg } from '../../common/PixelTrophySvg';
import { StaffCoachBadge } from '../../common/StaffCoachBadge';
import { TacticsGuideModal } from '../../common/TacticsGuideModal';
import { UnifiedTacticsStrip } from '../../common/UnifiedTacticsStrip';

export interface MpUclMatchPreviewModalProps {
  ucl: MpUclLive;
  leagueId: LeagueId;
  clubsById: Record<string, Club>;
  humans: MpLeagueHuman[];
  publicSquads: Record<string, MpSquadInput>;
  byClub?: Record<string, MpHumanLive>;
  myClubId: string | null;
  mySquad: MpSquadInput | null;
  myConditions?: PlayerConditionMap;
  myStaffCoachId?: StaffCoachId | null;
  myFfpChemPenalty?: number;
  myTacticalHistory?: readonly TacticalHistoryEntry[];
  isHost: boolean;
  flowKey: string;
  flowLabel: string;
  requiredClubIds: string[];
  allEliminated: boolean;
  hasPlayerAck: (human: MpLeagueHuman, key: string) => boolean;
  iAcked: boolean;
  waitingSurvivors: string[];
  onSaveSquad?: (next: MpSquadInput) => Promise<void> | void;
  onAck: (key: string) => void;
  onInspectPlayer?: (player: Player, slotSubPosition?: SubPosition) => void;
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
  bench: (Player | null)[];
  managerName: string;
  managerOvr: number;
  managerTraitId: ManagerTraitId;
  staffCoachId: StaffCoachId | null;
  ffpChemPenalty: number;
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

const EXTERNAL_ROSTER_BY_CLUB_ID: Map<string, Player[]> = new Map(
  UCL_EXTERNAL_TEAMS.map((e) => [e.club.id, e.roster]),
);

function shortFormationLabel(id: FormationId): string {
  if (id === '4-4-2-diamond') return '4-4-2◇';
  if (id === '3-5-2-dm') return '3-5-2 DM';
  return id;
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
  myEffectiveSquad: MpSquadInput | null;
  clubsById: Record<string, Club>;
  humansByClub: Map<string, MpLeagueHuman>;
  publicSquads: Record<string, MpSquadInput>;
  byClub?: Record<string, MpHumanLive>;
  ucl: MpUclLive;
  fallbackLeagueId: LeagueId;
}): PreviewSideModel {
  const {
    clubId,
    isHomeThisLeg,
    myClubId,
    myEffectiveSquad,
    clubsById,
    humansByClub,
    publicSquads,
    byClub,
    ucl,
    fallbackLeagueId,
  } = params;
  const club = clubsById[clubId] ?? fallbackClub(clubId);
  const human = humansByClub.get(clubId) ?? null;
  const isMe = Boolean(myClubId && clubId === myClubId);
  const humanLive = byClub?.[clubId];
  const rawSquad = isMe
    ? (myEffectiveSquad ?? publicSquads[clubId])
    : publicSquads[clubId];
  const squad = rawSquad
    ? hydrateMpSquadWithAwakenings(rawSquad, humanLive?.awakenedPlayers)
    : undefined;

  let formation: FormationId;
  let tactic: TacticId;
  let starters: (Player | null)[];
  let bench: (Player | null)[] = [];
  let managerName: string;
  let managerOvr: number;
  let managerTraitId: ManagerTraitId;
  let staffCoachId: StaffCoachId | null = null;
  let ffpChemPenalty = 0;

  if (human && squad && squad.starters.length === 11) {
    formation = squad.formation;
    tactic = squad.tactic;
    starters = squad.starters;
    bench = squad.bench;
    managerName = human.nickname;
    managerOvr = 86;
    managerTraitId = squad.managerTraitId;
    staffCoachId = humanLive?.staffCoach?.hiredCoachId ?? null;
    ffpChemPenalty = humanLive?.budget?.chemPenalty ?? 0;
  } else {
    const aiMgr = getClubManager(club);
    formation = club.formation ?? '4-3-3';
    tactic = club.defaultTactic ?? 'balanced';
    managerName = aiMgr.name;
    managerOvr = aiMgr.ovr;
    managerTraitId = aiMgr.traitId;
    const humanOwnedIds = new Set<string>();
    if (myEffectiveSquad) {
      for (const p of [...myEffectiveSquad.starters, ...myEffectiveSquad.bench]) {
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
    { staffCoachId, ffpChemPenalty },
  );
  const ratings = calculateTeamRatings(
    formation,
    filledStarters,
    chemistry.total,
    managerTraitId,
    chemistry.slotSynergies,
    tactic,
    staffCoachId,
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
    bench,
    managerName,
    managerOvr,
    managerTraitId,
    staffCoachId,
    ffpChemPenalty,
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
    <div className="grid grid-cols-[36px_1fr_34px_1fr_36px] items-center gap-2 text-xs tabular-nums">
      <span
        className={`text-right font-display font-black ${
          leftWins ? 'text-emerald-300' : 'text-slate-200'
        }`}
      >
        {leftVal}
      </span>
      <div className="flex justify-end h-1.5 rounded-full bg-slate-900 overflow-hidden">
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
      <div className="flex justify-start h-1.5 rounded-full bg-slate-900 overflow-hidden">
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

/**
 * Multiplayer Champions League Knockout Boundary Preview & Tactics Modal.
 * Unified with solo MatchDayTacticsRoom + PitchBoard dark-slate chrome:
 * - Both host and guest survivors can directly edit formation, tactic, and starting XI / bench
 *   between legs (1st ↔ 2nd leg) and knockout stages, with live matchup/synergy preview.
 * - Changes are persisted to league_payload + mp_league_actions before Ready so host simulation
 *   always reflects every participant's latest tactical setup.
 */
export function MpUclMatchPreviewModal({
  ucl,
  leagueId,
  clubsById,
  humans,
  publicSquads,
  byClub,
  myClubId,
  mySquad,
  myConditions = {},
  myStaffCoachId = null,
  myFfpChemPenalty = 0,
  myTacticalHistory,
  isHost,
  flowKey,
  flowLabel,
  requiredClubIds,
  allEliminated,
  hasPlayerAck,
  iAcked,
  waitingSurvivors,
  onSaveSquad,
  onAck,
  onInspectPlayer,
}: MpUclMatchPreviewModalProps) {
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
  const canEditMyTactics = Boolean(
    mySquad && onSaveSquad && iAmRequired && !allEliminated && !isPlayoffBye,
  );

  // Inline editable tactics state for surviving participants (host & guest)
  const [draftFormation, setDraftFormation] = useState<FormationId>(
    () => mySquad?.formation ?? '4-3-3',
  );
  const [draftTactic, setDraftTactic] = useState<TacticId>(
    () => mySquad?.tactic ?? 'balanced',
  );
  const [draftStarters, setDraftStarters] = useState<(Player | null)[]>(() =>
    mySquad ? [...mySquad.starters] : [],
  );
  const [draftBench, setDraftBench] = useState<(Player | null)[]>(() =>
    mySquad ? [...mySquad.bench] : [],
  );
  const [selectedSlot, setSelectedSlot] = useState<SlotRef | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  const [sectionTab, setSectionTab] = useState<'tactics' | 'compare'>(() =>
    canEditMyTactics && !iAcked ? 'tactics' : 'compare',
  );
  const [compareSubTab, setCompareSubTab] = useState<'key' | 'pitch'>('pitch');
  const [mobilePitchSide, setMobilePitchSide] = useState<'left' | 'right'>('left');
  const [selectedTieId, setSelectedTieId] = useState<string | null>(null);

  const myEffectiveSquad = useMemo<MpSquadInput | null>(() => {
    if (!mySquad) return null;
    if (!canEditMyTactics) return mySquad;
    const cleanS = draftStarters.filter((p): p is Player => p !== null);
    const cleanB = draftBench.filter((p): p is Player => p !== null);
    if (cleanS.length !== 11 || cleanB.length !== 5) return mySquad;
    return {
      managerTraitId: mySquad.managerTraitId,
      formation: draftFormation,
      tactic: draftTactic,
      starters: cleanS,
      bench: cleanB,
    };
  }, [mySquad, canEditMyTactics, draftFormation, draftTactic, draftStarters, draftBench]);

  const isDirty = useMemo(() => {
    if (!mySquad || !myEffectiveSquad || !canEditMyTactics) return false;
    if (mySquad.formation !== myEffectiveSquad.formation) return true;
    if (mySquad.tactic !== myEffectiveSquad.tactic) return true;
    const sBefore = mySquad.starters.map((p) => p.id).join(',');
    const sAfter = myEffectiveSquad.starters.map((p) => p.id).join(',');
    if (sBefore !== sAfter) return true;
    const bBefore = mySquad.bench.map((p) => p.id).join(',');
    const bAfter = myEffectiveSquad.bench.map((p) => p.id).join(',');
    return bBefore !== bAfter;
  }, [mySquad, myEffectiveSquad, canEditMyTactics]);

  const myChemistry = useMemo(
    () =>
      myEffectiveSquad
        ? calculateChemistry(
            myEffectiveSquad.formation,
            myEffectiveSquad.starters,
            myEffectiveSquad.tactic,
            myEffectiveSquad.managerTraitId,
            86,
            { staffCoachId: myStaffCoachId, ffpChemPenalty: myFfpChemPenalty },
          )
        : null,
    [myEffectiveSquad, myStaffCoachId, myFfpChemPenalty],
  );

  const tacticalExposure = useMemo(() => {
    if (!myEffectiveSquad || !myTacticalHistory || myTacticalHistory.length === 0) {
      return null;
    }
    return evaluateTacticalExposure({
      history: myTacticalHistory,
      formation: myEffectiveSquad.formation,
      tactic: myEffectiveSquad.tactic,
      staffCoachId: myStaffCoachId,
    });
  }, [myEffectiveSquad, myTacticalHistory, myStaffCoachId]);

  const tacticFits = useMemo(() => {
    const map: Record<TacticId, number> = {
      possession: 75,
      gegenpressing: 75,
      counter: 75,
      wingplay: 75,
      balanced: 75,
    };
    if (!myEffectiveSquad) return map;
    for (const t of TACTIC_LIST) {
      map[t.id] = evaluateTeamTacticalProfile({
        starters: myEffectiveSquad.starters,
        formation: myEffectiveSquad.formation,
        tactic: t.id,
        managerTraitId: myEffectiveSquad.managerTraitId,
        managerOvr: 86,
      }).tacticalFit;
    }
    return map;
  }, [myEffectiveSquad]);

  const handleSwap = useCallback(
    (from: SlotRef, to: SlotRef) => {
      if (!canEditMyTactics || iAcked) return;
      if (from.area === to.area && from.index === to.index) return;
      const nextS = [...draftStarters];
      const nextB = [...draftBench];
      const pA = from.area === 'starter' ? nextS[from.index] : nextB[from.index];
      const pB = to.area === 'starter' ? nextS[to.index] : nextB[to.index];
      if (from.area === 'starter') nextS[from.index] = pB;
      else nextB[from.index] = pB;
      if (to.area === 'starter') nextS[to.index] = pA;
      else nextB[to.index] = pA;
      setDraftStarters(nextS);
      setDraftBench(nextB);
      setSavedToast(false);
    },
    [canEditMyTactics, iAcked, draftStarters, draftBench],
  );

  const handleSlotClick = useCallback(
    (area: 'starter' | 'bench', index: number) => {
      if (!canEditMyTactics || iAcked) return;
      if (!selectedSlot) {
        const clicked = area === 'starter' ? draftStarters[index] : draftBench[index];
        if (clicked) setSelectedSlot({ area, index });
        return;
      }
      if (selectedSlot.area === area && selectedSlot.index === index) {
        setSelectedSlot(null);
        return;
      }
      handleSwap(selectedSlot, { area, index });
      setSelectedSlot(null);
    },
    [canEditMyTactics, iAcked, selectedSlot, draftStarters, draftBench, handleSwap],
  );

  const handleChangeFormation = (nextFormation: FormationId) => {
    if (!canEditMyTactics || iAcked || !mySquad) return;
    setSelectedSlot(null);
    setDraftStarters((prev) =>
      remapStartersForFormation(
        prev,
        draftFormation,
        nextFormation,
        mySquad.managerTraitId,
      ),
    );
    setDraftFormation(nextFormation);
    setSavedToast(false);
  };

  const handleAutoOptimize = () => {
    if (!canEditMyTactics || iAcked || !mySquad) return;
    setSelectedSlot(null);
    const opt = optimizeBestLineup(
      draftStarters,
      draftBench,
      draftFormation,
      draftTactic,
      mySquad.managerTraitId,
    );
    setDraftStarters(opt.starters);
    setDraftBench(opt.bench);
    setSavedToast(false);
  };

  const handleSaveOnly = async () => {
    if (!onSaveSquad || !myEffectiveSquad || saving) return;
    setSaving(true);
    try {
      await onSaveSquad(myEffectiveSquad);
      setSavedToast(true);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmReady = async () => {
    if (saving || iAcked) return;
    setSaving(true);
    try {
      if (canEditMyTactics && isDirty && onSaveSquad && myEffectiveSquad) {
        await onSaveSquad(myEffectiveSquad);
      }
      onAck(flowKey);
    } finally {
      setSaving(false);
    }
  };

  const featuredTie: UclKnockoutTie | null = useMemo(() => {
    if (myActiveTie) return myActiveTie;
    if (selectedTieId) {
      const picked = activeTies.find((t) => t.id === selectedTieId);
      if (picked) return picked;
    }
    return activeTies[0] ?? null;
  }, [myActiveTie, selectedTieId, activeTies]);

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
      myEffectiveSquad,
      clubsById,
      humansByClub,
      publicSquads,
      byClub,
      ucl,
      fallbackLeagueId: leagueId,
    });
    const right = buildSidePreview({
      clubId: rightClubId,
      isHomeThisLeg: rightClubId === homeTeamId,
      myClubId,
      myEffectiveSquad,
      clubsById,
      humansByClub,
      publicSquads,
      byClub,
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
    myEffectiveSquad,
    clubsById,
    humansByClub,
    publicSquads,
    byClub,
    ucl,
    leagueId,
  ]);

  const managerPreferredTactic = mySquad?.managerTraitId
    ? MANAGER_TRAITS[mySquad.managerTraitId]?.synergyTactic
    : undefined;

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
              size={38}
            />
          </div>
          <div className="min-w-0">
            <div
              className={`flex items-center gap-1.5 ${
                align === 'right' ? 'justify-end' : ''
              }`}
            >
              {side.isMe ? (
                <span className="shrink-0 rounded bg-emerald-400 px-1.5 py-px text-[9px] font-black text-slate-950 whitespace-nowrap">
                  MY
                </span>
              ) : side.human ? (
                <span className="shrink-0 rounded border border-amber-400/45 bg-amber-500/15 px-1.5 py-px text-[9px] font-black text-amber-200 whitespace-nowrap">
                  친구 · {side.human.nickname}
                </span>
              ) : null}
              <span className="shrink-0 rounded border border-slate-700 bg-slate-900/90 px-1 py-px text-[9px] font-bold text-slate-400 whitespace-nowrap">
                {side.isHomeThisLeg ? 'HOME' : 'AWAY'}
              </span>
            </div>
            <div className="mt-0.5 truncate text-sm sm:text-base font-black text-white">
              {side.club.name}
            </div>
            <div className="flex flex-wrap items-center gap-1 text-[10px] text-slate-400">
              <span className="font-mono font-bold text-sky-300 whitespace-nowrap">
                {shortFormationLabel(side.formation)}
              </span>
              <span>·</span>
              <span className="font-bold text-amber-300 whitespace-nowrap">
                {TACTICS[side.tactic].shortName}
              </span>
              <span>·</span>
              <span className="font-bold text-emerald-300 tabular-nums whitespace-nowrap">
                케미 {side.chemistry.total}
              </span>
            </div>
          </div>
        </div>

        <div
          className={`inline-flex flex-wrap items-center gap-1 rounded-lg border border-slate-800 bg-[#090e15] px-2 py-1 text-[10px] ${
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
          <span className="font-semibold text-slate-300 whitespace-nowrap">
            {side.managerName}
          </span>
          {traitCfg && (
            <span
              className="rounded px-1.5 py-px text-[9px] font-extrabold text-slate-950 whitespace-nowrap"
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
      className="modal-backdrop fixed inset-0 z-[68] flex items-center justify-center bg-slate-950/88 p-2 sm:p-4"
    >
      <ModalBodyLock />
      <div className="modal-panel flex w-full max-w-4xl max-h-[92dvh] flex-col overflow-hidden rounded-2xl border border-slate-700/90 bg-[#0e141d] shadow-2xl">
        {/* Top Header — unified with MatchDayTacticsRoom dark slate & sky UCL accent */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-[#0b1018] px-3.5 py-2.5 sm:px-5 sm:py-3">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <PixelTrophySvg variant="ucl" size={20} />
            <span className="rounded border border-sky-400/40 bg-sky-500/15 px-2 py-0.5 text-[10px] font-black tracking-wide text-sky-200 whitespace-nowrap">
              {stageTitle}
            </span>
            <h2 className="truncate font-display text-sm sm:text-base font-bold text-white">
              {myActiveTie
                ? '매치데이 전술실 · 프리뷰'
                : isPlayoffBye
                  ? '16강 직행 · 플레이오프 관전'
                  : '토너먼트 관전 프리뷰'}
            </h2>
            {previewPair?.isFriendH2H && (
              <span className="inline-flex items-center gap-1 rounded-md border border-amber-400/50 bg-amber-500/15 px-2 py-0.5 text-[10px] font-black text-amber-200 whitespace-nowrap">
                <Swords className="h-3 w-3" />
                친구 맞대결
              </span>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => setGuideOpen(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-[#111822] px-2 py-1 text-[10.5px] font-bold text-slate-300 hover:border-sky-400/50 hover:text-sky-200 transition-colors cursor-pointer whitespace-nowrap"
            >
              <BookOpen className="w-3 h-3" />
              전술 도감
            </button>
            {allEliminated ? (
              <span className="rounded-md border border-rose-500/35 bg-rose-500/15 px-2 py-0.5 text-[10px] font-extrabold text-rose-200 whitespace-nowrap">
                생존자 0명
              </span>
            ) : (
              <span
                id="mp-ucl-preview-ready-count"
                className="rounded-md border border-sky-400/35 bg-sky-500/15 px-2.5 py-0.5 text-[10px] font-black tabular-nums text-sky-200 whitespace-nowrap"
              >
                생존자 준비 {readyCount}/{survivorHumans.length}
              </span>
            )}
          </div>
        </div>

        {/* Single Scrollable Body (100dvh compliant, zero nested scroll) */}
        <div className="modal-scroll flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y p-3 sm:p-4 space-y-3">
          {/* Spectator / Bye Tie Switcher */}
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
                    className={`rounded-lg border px-2 py-1 text-[10px] font-bold transition-colors cursor-pointer touch-manipulation whitespace-nowrap ${
                      active
                        ? 'border-sky-400/60 bg-sky-500/20 text-sky-100'
                        : hasFriend
                          ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200 hover:border-emerald-400/60'
                          : 'border-slate-800 bg-[#111822] text-slate-400 hover:text-slate-200'
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
              {/* 1. Matchup Header + Live Tactical Power & 5-Zone Strip (unified with MatchDayTacticsRoom) */}
              <div className="rounded-xl border border-slate-800 bg-[#111822] p-3 sm:p-4 space-y-3">
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
                    <span className="font-mono font-black text-amber-300 whitespace-nowrap">
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
                    <span className="rounded-md border border-slate-800 bg-[#090e15] px-2 py-0.5 font-mono text-[10px] font-extrabold tabular-nums text-slate-300 whitespace-nowrap">
                      OVR {previewPair.left.ovr} : {previewPair.right.ovr}
                    </span>
                  </div>

                  {renderSideHeader(previewPair.right, 'right')}
                </div>

                {/* Live A/M/D Comparison Bars */}
                <div className="space-y-1.5 border-t border-slate-800/80 pt-2.5">
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

                {/* Live 5-Zone Tactical Matchup Strip (reacts immediately to formation/tactic edits) */}
                <div className="border-t border-slate-800/80 pt-2.5">
                  <UnifiedTacticsStrip matchup={previewPair.matchup} />
                </div>
              </div>

              {/* 2. Mode Switcher (when active survivor can edit tactics) */}
              {canEditMyTactics && (
                <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-slate-800 bg-[#0b1018] p-1 text-xs">
                  <button
                    id="mp-ucl-preview-tab-tactics"
                    type="button"
                    onClick={() => setSectionTab('tactics')}
                    className={`inline-flex items-center justify-center gap-1.5 rounded-lg border py-2 px-2 font-extrabold transition-colors cursor-pointer whitespace-nowrap touch-manipulation ${
                      sectionTab === 'tactics'
                        ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5" />
                    내 전술 · 라인업 정비
                    {isDirty && (
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                    )}
                  </button>
                  <button
                    id="mp-ucl-preview-tab-compare"
                    type="button"
                    onClick={() => setSectionTab('compare')}
                    className={`inline-flex items-center justify-center gap-1.5 rounded-lg border py-2 px-2 font-extrabold transition-colors cursor-pointer whitespace-nowrap touch-manipulation ${
                      sectionTab === 'compare'
                        ? 'border-sky-400/50 bg-sky-500/18 text-sky-100'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    양 팀 전력 · 상대 분석
                  </button>
                </div>
              )}

              {/* 3A. Inline Tactics & Lineup Editor (reuses MatchDayTacticsRoom controls + PitchBoard) */}
              {canEditMyTactics && sectionTab === 'tactics' && myEffectiveSquad && myChemistry && (
                <div className="rounded-xl border border-slate-800 bg-[#111822] p-3 sm:p-4 space-y-3">
                  {/* Status Strip: Staff Coach + Tactical Exposure + Quick Optimize */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {myStaffCoachId && (
                        <StaffCoachBadge
                          coachId={myStaffCoachId}
                          activeTactic={draftTactic}
                          compact
                        />
                      )}
                      {tacticalExposure &&
                        tacticalExposure.exposureScore >= EXPOSURE_WARNING_THRESHOLD && (
                          <span
                            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold whitespace-nowrap ${
                              tacticalExposure.exposureScore >= EXPOSURE_DANGER_THRESHOLD
                                ? 'border-rose-500/45 bg-rose-500/15 text-rose-200'
                                : 'border-amber-400/40 bg-amber-500/12 text-amber-200'
                            }`}
                          >
                            전술 노출 {tacticalExposure.exposureScore}%
                            {tacticalExposure.exposureScore >= EXPOSURE_DANGER_THRESHOLD
                              ? ' · 파훼 주의'
                              : ''}
                          </span>
                        )}
                      {savedToast && !isDirty && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/12 px-2 py-0.5 text-[10px] font-bold text-emerald-200 whitespace-nowrap">
                          <Check className="w-3 h-3" />
                          전술 반영 완료
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {selectedSlot && (
                        <button
                          type="button"
                          onClick={() => setSelectedSlot(null)}
                          className="rounded-lg border border-amber-400/40 bg-amber-500/15 px-2 py-1 text-[10.5px] font-bold text-amber-200 cursor-pointer whitespace-nowrap"
                        >
                          교환 취소
                        </button>
                      )}
                      <button
                        id="mp-ucl-preview-quick-lineup-btn"
                        type="button"
                        disabled={iAcked}
                        onClick={handleAutoOptimize}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/45 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-45 transition-colors cursor-pointer whitespace-nowrap touch-manipulation"
                      >
                        <Wand2 className="w-3 h-3" />
                        빠른 선발
                      </button>
                    </div>
                  </div>

                  {/* Formation & Tactic Selectors (10 formations incl. 3-2-4-1 + 5 tactics with fit %) */}
                  <div className="rounded-xl border border-slate-800 bg-[#0b1018] p-2.5 sm:p-3 space-y-2.5">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-slate-400">포메이션</span>
                        <span className="font-mono text-[10px] font-bold text-sky-300">
                          {FORMATIONS[draftFormation]?.name ?? draftFormation}
                        </span>
                      </div>
                      <div className="grid grid-cols-5 gap-1">
                        {FORMATION_LIST.map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            disabled={iAcked}
                            onClick={() => handleChangeFormation(f.id)}
                            className={`rounded-lg border py-1.5 px-1 text-[10px] sm:text-[11px] font-bold transition-colors cursor-pointer truncate disabled:opacity-45 touch-manipulation ${
                              draftFormation === f.id
                                ? 'border-sky-400/60 bg-sky-500/20 text-white'
                                : 'border-slate-800 bg-[#111822] text-slate-400 hover:border-slate-600 hover:text-slate-200'
                            }`}
                          >
                            {shortFormationLabel(f.id)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-slate-400">전술 스타일</span>
                        <span className="text-[10px] font-semibold text-slate-400">
                          ★ 감독 추천 · 완성도 %
                        </span>
                      </div>
                      <div className="grid grid-cols-5 gap-1">
                        {TACTIC_LIST.map((t) => {
                          const isPreferred = managerPreferredTactic === t.id;
                          return (
                            <button
                              key={t.id}
                              type="button"
                              disabled={iAcked}
                              onClick={() => {
                                setDraftTactic(t.id);
                                setSavedToast(false);
                              }}
                              className={`flex flex-col items-center rounded-lg border py-1.5 px-1 text-[10.5px] font-bold transition-colors cursor-pointer disabled:opacity-45 touch-manipulation ${
                                draftTactic === t.id
                                  ? 'border-emerald-400/60 bg-emerald-500/18 text-white'
                                  : isPreferred
                                    ? 'border-slate-700 bg-[#111822] text-slate-200 hover:border-slate-500'
                                    : 'border-slate-800 bg-[#111822] text-slate-400 hover:border-slate-600 hover:text-slate-200'
                              }`}
                            >
                              <span className="truncate max-w-full">
                                {isPreferred && (
                                  <span className="text-amber-300 mr-0.5">★</span>
                                )}
                                {t.shortName}
                              </span>
                              <span className="font-mono text-[9px] text-slate-400 tabular-nums">
                                {tacticFits[t.id]}%
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Interactive Single-Player PitchBoard */}
                  <div className="mx-auto w-full max-w-[520px] space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] px-0.5">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-slate-300">
                        <ArrowLeftRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        {iAcked
                          ? '준비 완료됨 · 대기 중'
                          : selectedSlot
                            ? '교체할 슬롯을 클릭하세요'
                            : '클릭·드래그 선수 교체 / 우클릭·ⓘ 상세'}
                      </span>
                      <span className="inline-flex items-center gap-1 font-bold text-slate-300 tabular-nums whitespace-nowrap">
                        <Zap className="w-3 h-3 text-emerald-400" />
                        케미 {myChemistry.total} ({myChemistry.chemistryOvrBonus >= 0 ? '+' : ''}
                        {myChemistry.chemistryOvrBonus.toFixed(1)})
                      </span>
                    </div>

                    <PitchBoard
                      formation={draftFormation}
                      starters={draftStarters}
                      bench={draftBench}
                      chemistry={myChemistry}
                      managerTraitId={myEffectiveSquad.managerTraitId}
                      staffCoachId={myStaffCoachId}
                      tactic={draftTactic}
                      conditionByPlayerId={myConditions}
                      selectedSlot={iAcked ? null : selectedSlot}
                      onSlotClick={iAcked ? undefined : handleSlotClick}
                      onSlotSwap={iAcked ? undefined : handleSwap}
                      onInspectPlayer={onInspectPlayer}
                      showBench
                      showManagerFitStrip
                      showChemBreakdown
                      showChemLegend
                      compact
                    />
                  </div>
                </div>
              )}

              {/* 3B. Both Sides Comparison & Read-Only Single-Player PitchBoard */}
              {(!canEditMyTactics || sectionTab === 'compare') && (
                <div className="rounded-xl border border-slate-800 bg-[#111822] p-3 sm:p-4 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-200">
                      <Users className="h-3.5 w-3.5 text-sky-300" />
                      양 팀 핵심 전력 · 선발 포메이션
                    </span>
                    <div className="inline-flex rounded-lg border border-slate-800 bg-[#090e15] p-0.5 text-[10px]">
                      <button
                        type="button"
                        onClick={() => setCompareSubTab('pitch')}
                        className={`rounded-md px-2.5 py-1 font-bold transition-colors cursor-pointer touch-manipulation whitespace-nowrap ${
                          compareSubTab === 'pitch'
                            ? 'border border-sky-400/50 bg-sky-500/20 text-sky-100'
                            : 'border border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        선발 포메이션
                      </button>
                      <button
                        type="button"
                        onClick={() => setCompareSubTab('key')}
                        className={`rounded-md px-2.5 py-1 font-bold transition-colors cursor-pointer touch-manipulation whitespace-nowrap ${
                          compareSubTab === 'key'
                            ? 'border border-sky-400/50 bg-sky-500/20 text-sky-100'
                            : 'border border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        핵심 TOP 3
                      </button>
                    </div>
                  </div>

                  {/* Chemistry & Manager Synergy Strip */}
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-[11px] tabular-nums">
                    {[previewPair.left, previewPair.right].map((side, idx) => (
                      <div
                        key={`${side.clubId}-meta-${idx}`}
                        className="rounded-lg border border-slate-800/90 bg-[#090e15] px-2.5 py-2 space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-extrabold text-white">
                            {side.club.shortName}
                          </span>
                          <span className="font-mono text-[10px] font-bold text-emerald-300 shrink-0 whitespace-nowrap">
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

                  {compareSubTab === 'key' ? (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {[previewPair.left, previewPair.right].map((side) => (
                        <div
                          key={`${side.clubId}-top3`}
                          className="rounded-xl border border-slate-800/90 bg-[#090e15] p-2.5 space-y-1.5"
                        >
                          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                            <span className="truncate text-slate-200">
                              {side.club.name}
                            </span>
                            <span className="whitespace-nowrap">
                              {shortFormationLabel(side.formation)} ·{' '}
                              {TACTICS[side.tactic].shortName}
                            </span>
                          </div>
                          {side.topPlayers.map(({ player, displayOvr, bonus }) => {
                            const classicEra = getClassicEra(player);
                            const eraMeta = classicEra
                              ? getClassicEraMeta(classicEra)
                              : null;
                            return (
                              <button
                                key={player.id}
                                type="button"
                                onClick={() => onInspectPlayer?.(player)}
                                className={`flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors cursor-pointer touch-manipulation ${
                                  player.awakening
                                    ? 'border-rose-500/45 bg-rose-950/20 hover:border-rose-400/70'
                                    : 'border-slate-800/80 bg-[#0e141d] hover:border-sky-400/45'
                                }`}
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
                                    {formatPlayerRecordName(player)}
                                  </span>
                                  {eraMeta && (
                                    <span className="shrink-0 rounded border border-amber-400/40 bg-amber-500/15 px-1 py-px text-[8px] font-black text-amber-200">
                                      {eraMeta.shortLabel}
                                    </span>
                                  )}
                                  {player.awakening && (
                                    <span className="inline-flex shrink-0 items-center gap-0.5 rounded border border-rose-400/45 bg-rose-500/20 px-1 py-px text-[8px] font-black text-rose-200">
                                      <Flame className="w-2.5 h-2.5" />+{player.awakening.ovrGain}
                                    </span>
                                  )}
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
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {/* Mobile side switcher */}
                      <div className="grid grid-cols-2 gap-1 rounded-lg border border-slate-800 bg-[#090e15] p-0.5 text-[11px] md:hidden">
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
                        {[
                          { side: previewPair.left, mobileKey: 'left' as const },
                          { side: previewPair.right, mobileKey: 'right' as const },
                        ].map(({ side, mobileKey }) => (
                          <div
                            key={`${side.clubId}-pitch`}
                            className={
                              mobilePitchSide === mobileKey
                                ? 'block'
                                : 'hidden md:block'
                            }
                          >
                            <PitchBoard
                              formation={side.formation}
                              starters={side.starters}
                              bench={[]}
                              chemistry={side.chemistry}
                              managerTraitId={side.managerTraitId}
                              staffCoachId={side.staffCoachId}
                              tactic={side.tactic}
                              conditionByPlayerId={side.isMe ? myConditions : {}}
                              onInspectPlayer={onInspectPlayer}
                              headerLabel={`${side.club.shortName} (${shortFormationLabel(side.formation)} · ${TACTICS[side.tactic].shortName})`}
                              showBench={false}
                              showChemLegend={mobileKey === 'left'}
                              compact
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-[#111822] px-4 py-8 text-center text-xs font-bold text-slate-400">
              {flowLabel} 대진 확인 중...
            </div>
          )}

          {/* Other Round Matchups Strip (compact) */}
          {activeTies.length > 1 && (
            <div className="rounded-xl border border-slate-800/80 bg-[#0b1018] p-2.5 space-y-1.5">
              <div className="text-[10px] font-bold text-slate-500">
                이번 라운드 전체 대진 ({activeTies.length}경기)
              </div>
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {activeTies.map((t) => {
                  const cA = clubsById[t.teamAId];
                  const cB = clubsById[t.teamBId];
                  const involvesMe = Boolean(
                    myClubId && (t.teamAId === myClubId || t.teamBId === myClubId),
                  );
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
                            : 'border-slate-800/70 bg-[#111822] text-slate-400'
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

        {/* Fixed Footer: Survivor Ready Roster + Save Tactics + Primary Ready / Host Advance Action */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2.5 border-t border-slate-800 bg-[#0b1018] px-3.5 py-3 sm:px-5">
          <div className="flex flex-wrap items-center gap-1.5">
            {allEliminated ? (
              <span className="text-xs font-bold text-slate-400 break-keep">
                참가자 전원 탈락 · 방장 확인 후 남은 경기를 진행합니다
              </span>
            ) : (
              survivorHumans.map((h) => {
                const ok = hasPlayerAck(h, flowKey);
                return (
                  <span
                    key={h.clubId}
                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-bold whitespace-nowrap ${
                      ok
                        ? 'border-emerald-500/45 bg-emerald-500/15 text-emerald-200'
                        : 'border-slate-700 bg-[#111822] text-slate-400'
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

          <div className="flex flex-wrap items-center gap-2">
            {canEditMyTactics && !iAcked && isDirty && (
              <button
                id="mp-ucl-preview-save-tactics-btn"
                type="button"
                disabled={saving}
                onClick={() => void handleSaveOnly()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-sky-400/50 bg-sky-500/15 px-3.5 py-2.5 text-xs font-extrabold text-sky-200 hover:bg-sky-500/25 disabled:opacity-50 cursor-pointer whitespace-nowrap touch-manipulation"
              >
                <Shield className="h-3.5 w-3.5" />
                {saving ? '저장 중...' : '전술 저장'}
              </button>
            )}

            {allEliminated ? (
              isHost ? (
                <button
                  id="mpl-consent-btn"
                  type="button"
                  disabled={iAcked}
                  onClick={() => onAck(flowKey)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-5 py-2.5 text-xs font-black text-slate-950 hover:bg-amber-300 disabled:opacity-60 cursor-pointer whitespace-nowrap touch-manipulation"
                >
                  <FastForward className="h-3.5 w-3.5" />
                  {iAcked ? '진행 중...' : '다음 경기 진행'}
                </button>
              ) : (
                <span className="rounded-lg border border-slate-700 bg-[#111822] px-3 py-2 text-xs font-bold text-slate-400 whitespace-nowrap">
                  방장 진행 대기 중
                </span>
              )
            ) : !iAmRequired ? (
              <span className="rounded-lg border border-slate-700 bg-[#111822] px-3 py-2 text-xs font-bold text-slate-300">
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
                disabled={saving}
                onClick={() => void handleConfirmReady()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-black text-slate-950 hover:bg-emerald-400 disabled:opacity-60 cursor-pointer whitespace-nowrap touch-manipulation shadow-lg"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                {isDirty ? '전술 반영 · 준비 완료' : '준비 완료'}
              </button>
            )}
          </div>
        </div>
      </div>

      <TacticsGuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />
    </div>
  );
}
