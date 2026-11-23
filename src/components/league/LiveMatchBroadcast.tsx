import {
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  BookOpen,
  Check,
  Compass,
  FastForward,
  Lightbulb,
  Pause,
  Play,
  Radio,
  Sparkles,
  Star,
  UserCheck,
  Wand2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getClubManager } from '../../data/aiManagers';
import { FORMATION_LIST, FORMATIONS } from '../../data/formations';
import { MANAGER_TRAITS } from '../../data/managerTraits';
import { PLAYSTYLES } from '../../data/playstyles';
import { calculateChemistry } from '../../engine/chemistryEngine';
import { buildAiClubRoster } from '../../engine/dataLoader';
import { USER_CLUB_ID } from '../../engine/matchEngine';
import {
  computePlayerStaminaPct,
  getPlayerStaminaStat,
  getStaminaPenalty,
  MAX_MATCH_SUBS,
} from '../../engine/staminaEngine';
import {
  buildExtraTimeCoachBriefing,
  buildHalftimeCoachRecommendations,
  TACTIC_LIST,
  TACTICS,
} from '../../engine/tacticEngine';
import {
  evaluateTeamTacticalProfile,
  evaluateUnifiedTacticalMatchup,
} from '../../engine/unifiedTacticsEngine';
import { useGame } from '../../store/GameContext';
import type {
  ChemistryResult,
  FormationId,
  ManagerRouletteState,
  ManagerTraitId,
  UserClubProfile,
} from '../../types/game';
import type {
  Club,
  LiveHalftimeState,
  PlayerSeasonStats,
  TacticId,
} from '../../types/league';
import type { Player, SubPosition } from '../../types/player';
import { ClubTag } from '../common/ClubTag';
import { JerseySvg } from '../common/JerseySvg';
import { PitchBoard } from '../common/PitchBoard';
import type { SlotRef } from '../common/PitchBoard';
import { PixelManagerAvatar } from '../common/PixelManagerAvatar';
import { PlayerDetailModal } from '../common/PlayerDetailModal';
import { TacticsGuideModal } from '../common/TacticsGuideModal';
import { UnifiedTacticsStrip } from '../common/UnifiedTacticsStrip';
import {
  DRAMATIC_REVEAL_MS,
  DRAMATIC_TOTAL_MS,
  PitchMatch2D,
} from './PitchMatch2D';
import type { DramaticHighlightPayload } from './PitchMatch2D';

export interface LiveMatchBroadcastOverride {
  state: {
    formation: FormationId;
    defaultTactic: TacticId;
    starters: (Player | null)[];
    bench: (Player | null)[];
    manager: ManagerRouletteState;
    userClub: UserClubProfile;
    season: {
      liveHalftime: LiveHalftimeState | null;
      allPlayerStats?: Record<string, PlayerSeasonStats>;
    };
  };
  myTeamId?: string;
  opponentRoster?: Player[];
  opponentManagerOverride?: {
    name: string;
    ovr: number;
    traitId: ManagerTraitId;
  };
  disableInstantFinish?: boolean;
  disableLiveSub?: boolean;
  lockSpeed?: 1 | 2 | 4;
  waitingForOpponentLabel?: string | null;
  commitButtonLabel?: string;
  chemistry: ChemistryResult;
  changeFormation: (formation: FormationId) => void;
  optimizeHalftimeStarters: (tactic?: TacticId) => void;
  swapSquadPositions: (from: SlotRef, to: SlotRef) => void;
  enterHalftimeLocker: () => void;
  startSecondHalfBroadcast: (params: {
    secondHalfTactic: TacticId;
    subPlayerIds?: string[];
    firstHalfStarters?: Player[];
  }) => void;
  applySecondHalfLiveSub: (params: {
    minute: number;
    subs: {
      starterIndex?: number;
      benchIndex?: number;
      outPlayerId?: string;
      inPlayerId?: string;
    }[];
    nextStarters?: (Player | null)[];
    nextBench?: (Player | null)[];
    firstHalfStarters: Player[];
    halftimeSubIds: string[];
  }) => void;
  enterExtraTimeBreak: () => void;
  startExtraTimeBroadcast: (params?: {
    etTactic?: TacticId;
    extraSub?: { starterIndex: number; benchIndex: number };
    firstHalfStarters?: Player[];
    halftimeSubIds?: string[];
  }) => void;
  enterEtHalftimeLocker: () => void;
  startEtSecondHalfBroadcast: (params?: {
    etTactic?: TacticId;
    firstHalfStarters?: Player[];
    halftimeSubIds?: string[];
  }) => void;
  enterPenaltyShootout: () => void;
  commitLiveMatch: (secondHalfTactic?: TacticId) => void;
}

interface LiveMatchBroadcastProps {
  clubsById: Record<string, Club>;
  override?: LiveMatchBroadcastOverride;
}

type BroadcastSpeed = 1 | 2 | 4;

const SPEED_MS: Record<BroadcastSpeed, number> = {
  1: 165,
  2: 85,
  4: 38,
};

function makeEventKey(
  ev: { minute: number; half: 1 | 2; type: string; teamId: string; description: string },
  idx: number,
): string {
  return `${ev.half}-${ev.minute}-${ev.type}-${ev.teamId}-${idx}`;
}

function getStaminaBarColor(pct: number): string {
  if (pct >= 70) return 'bg-emerald-400';
  if (pct >= 55) return 'bg-yellow-400';
  if (pct >= 40) return 'bg-orange-400';
  return 'bg-rose-500';
}

function getStaminaTextColor(pct: number): string {
  if (pct >= 70) return 'text-emerald-300';
  if (pct >= 55) return 'text-yellow-300';
  if (pct >= 40) return 'text-orange-300';
  return 'text-rose-400';
}

export function LiveMatchBroadcast({
  clubsById,
  override,
}: LiveMatchBroadcastProps) {
  const gameCtx = useGame();
  const state = override ? override.state : gameCtx.state;
  const chemistry = override ? override.chemistry : gameCtx.chemistry;
  const changeFormation = override
    ? override.changeFormation
    : gameCtx.changeFormation;
  const optimizeHalftimeStarters = override
    ? override.optimizeHalftimeStarters
    : gameCtx.optimizeHalftimeStarters;
  const swapSquadPositions = override
    ? override.swapSquadPositions
    : gameCtx.swapSquadPositions;
  const enterHalftimeLocker = override
    ? override.enterHalftimeLocker
    : gameCtx.enterHalftimeLocker;
  const startSecondHalfBroadcast = override
    ? override.startSecondHalfBroadcast
    : gameCtx.startSecondHalfBroadcast;
  const applySecondHalfLiveSub = override
    ? override.applySecondHalfLiveSub
    : gameCtx.applySecondHalfLiveSub;
  const enterExtraTimeBreak = override
    ? override.enterExtraTimeBreak
    : gameCtx.enterExtraTimeBreak;
  const startExtraTimeBroadcast = override
    ? override.startExtraTimeBroadcast
    : gameCtx.startExtraTimeBroadcast;
  const enterEtHalftimeLocker = override
    ? override.enterEtHalftimeLocker
    : gameCtx.enterEtHalftimeLocker;
  const startEtSecondHalfBroadcast = override
    ? override.startEtSecondHalfBroadcast
    : gameCtx.startEtSecondHalfBroadcast;
  const enterPenaltyShootout = override
    ? override.enterPenaltyShootout
    : gameCtx.enterPenaltyShootout;
  const commitLiveMatch = override
    ? override.commitLiveMatch
    : gameCtx.commitLiveMatch;

  const halftime = state.season?.liveHalftime ?? null;

  const lockedSpeed = override?.lockSpeed;
  const [speed, setSpeed] = useState<BroadcastSpeed>(lockedSpeed ?? 2);
  useEffect(() => {
    if (lockedSpeed !== undefined) setSpeed(lockedSpeed);
  }, [lockedSpeed]);
  const [minute, setMinute] = useState<number>(0);
  const [selectedTactic, setSelectedTactic] = useState<TacticId>(
    halftime?.userTacticAtKickoff ?? state.defaultTactic,
  );
  const [swapPick, setSwapPick] = useState<SlotRef | null>(null);
  const [subbedInIds, setSubbedInIds] = useState<string[]>([]);
  const [pendingHtSubConfirm, setPendingHtSubConfirm] = useState<{
    from: SlotRef;
    to: SlotRef;
    outPlayer: Player;
    inPlayer: Player;
    slotLabel: string;
  } | null>(null);
  const [htNotice, setHtNotice] = useState<string | null>(null);
  const [showTacticsGuide, setShowTacticsGuide] = useState(false);
  const [inspected, setInspected] = useState<{
    player: Player;
    slotSubPosition?: SubPosition;
  } | null>(null);

  // Live 2nd-half pause & manual PitchBoard substitution overlay state
  const [liveSubOpen, setLiveSubOpen] = useState(false);
  const [liveSubPick, setLiveSubPick] = useState<SlotRef | null>(null);
  const [draftStarters, setDraftStarters] = useState<(Player | null)[]>([]);
  const [draftBench, setDraftBench] = useState<(Player | null)[]>([]);
  const [pendingLiveSubs, setPendingLiveSubs] = useState<
    {
      outPlayerId: string;
      outPlayerName: string;
      inPlayerId: string;
      inPlayerName: string;
    }[]
  >([]);

  // Penalty Shootout sequential reveal
  const [revealedPenKicks, setRevealedPenKicks] = useState<number>(0);

  // Spoiler-free dramatic slow-motion state for goals, saves, and decisive chances
  const [dramaticEvent, setDramaticEvent] =
    useState<DramaticHighlightPayload | null>(null);
  const [handledHighlightKeys, setHandledHighlightKeys] = useState<string[]>(
    [],
  );

  // Snapshot 1st-half starters once per fixture so starts vs subAppearances are exact
  const firstHalfStartersRef = useRef<Player[]>([]);
  const lastFixtureIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (halftime && lastFixtureIdRef.current !== halftime.fixtureId) {
      lastFixtureIdRef.current = halftime.fixtureId;
      firstHalfStartersRef.current = state.starters.filter(
        (p): p is Player => p !== null,
      );
    }
  }, [halftime, state.starters]);

  const phase = halftime?.phase ?? null;

  // Reset clock & dramatic state when phase changes across match stages
  useEffect(() => {
    if (phase === 'first_half') {
      setMinute(0);
      setSubbedInIds([]);
      setSwapPick(null);
      setPendingHtSubConfirm(null);
      setHtNotice(null);
      setLiveSubOpen(false);
      setLiveSubPick(null);
      setPendingLiveSubs([]);
      setRevealedPenKicks(0);
      setDramaticEvent(null);
      setHandledHighlightKeys([]);
      if (halftime) setSelectedTactic(halftime.userTacticAtKickoff);
    } else if (phase === 'halftime') {
      setMinute(45);
      setSwapPick(null);
      setPendingHtSubConfirm(null);
      setHtNotice(null);
      setLiveSubOpen(false);
      setDramaticEvent(null);
    } else if (phase === 'second_half') {
      setMinute(46);
      setLiveSubOpen(false);
      setLiveSubPick(null);
      setPendingLiveSubs([]);
      setDramaticEvent(null);
    } else if (phase === 'extra_time_break') {
      setMinute(90);
      setSwapPick(null);
      setPendingHtSubConfirm(null);
      setHtNotice(null);
      setLiveSubOpen(false);
      setDramaticEvent(null);
    } else if (phase === 'extra_time') {
      setMinute(91);
      setDramaticEvent(null);
    } else if (phase === 'extra_time_ht') {
      setMinute(105);
      setSwapPick(null);
      setPendingHtSubConfirm(null);
      setHtNotice(null);
      setLiveSubOpen(false);
      setDramaticEvent(null);
    } else if (phase === 'extra_time_2') {
      setMinute(106);
      setDramaticEvent(null);
    } else if (phase === 'penalties') {
      setMinute(120);
      setDramaticEvent(null);
      setRevealedPenKicks(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, halftime?.fixtureId]);

  const allMatchEvents = useMemo(() => {
    if (!halftime) return [];
    if (
      (phase === 'second_half' ||
        phase === 'extra_time_break' ||
        phase === 'extra_time' ||
        phase === 'extra_time_ht' ||
        phase === 'extra_time_2' ||
        phase === 'penalties') &&
      halftime.fullMatchResult
    ) {
      return halftime.fullMatchResult.events;
    }
    return halftime.firstHalfEvents;
  }, [halftime, phase]);

  const indexedEvents = useMemo(
    () =>
      allMatchEvents.map((ev, idx) => ({
        ev,
        key: makeEventKey(ev, idx),
      })),
    [allMatchEvents],
  );

  // Manage timed reveal + smooth return to normal speed during dramatic slow-motion
  useEffect(() => {
    if (!dramaticEvent) return;
    const currentKey = dramaticEvent.key;

    const revealTimer = window.setTimeout(() => {
      setDramaticEvent((prev) =>
        prev && prev.key === currentKey ? { ...prev, revealed: true } : prev,
      );
    }, DRAMATIC_REVEAL_MS);

    const endTimer = window.setTimeout(() => {
      setDramaticEvent((prev) =>
        prev && prev.key === currentKey ? null : prev,
      );
    }, DRAMATIC_TOTAL_MS);

    return () => {
      window.clearTimeout(revealTimer);
      window.clearTimeout(endTimer);
    };
    // Trigger once per distinct dramatic highlight key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dramaticEvent?.key]);

  // Progressive match clock ticker (1st 0'->45', 2nd 46'->90', ET1 91'->105', ET2 106'->120')
  useEffect(() => {
    if (!halftime) return;
    if (
      phase !== 'first_half' &&
      phase !== 'second_half' &&
      phase !== 'extra_time' &&
      phase !== 'extra_time_2'
    ) {
      return;
    }
    if (dramaticEvent || liveSubOpen) return;

    const targetEnd =
      phase === 'first_half'
        ? 45
        : phase === 'second_half'
          ? 90
          : phase === 'extra_time'
            ? 105
            : 120;

    // Check if there is an unhandled highlight event at the current minute first
    const unhandledNow = indexedEvents.find(
      ({ ev, key }) =>
        ev.minute === minute &&
        !(phase === 'first_half' && ev.half === 2) &&
        (ev.type === 'goal' ||
          ev.type === 'save' ||
          ev.type === 'chance' ||
          ev.type === 'var_offside') &&
        !handledHighlightKeys.includes(key),
    );
    if (unhandledNow) {
      const triggerTimer = window.setTimeout(() => {
        setHandledHighlightKeys((prev) => [...prev, unhandledNow.key]);
        setDramaticEvent({
          key: unhandledNow.key,
          event: unhandledNow.ev,
          revealed: false,
        });
      }, 40);
      return () => window.clearTimeout(triggerTimer);
    }

    if (minute >= targetEnd) {
      if (phase === 'first_half') {
        const pauseTimer = window.setTimeout(() => {
          enterHalftimeLocker();
        }, 420);
        return () => window.clearTimeout(pauseTimer);
      }
      if (
        phase === 'second_half' &&
        halftime.isKnockoutDecider &&
        halftime.fullMatchResult
      ) {
        const h90 =
          halftime.fullMatchResult.homeGoals90 ??
          halftime.fullMatchResult.homeGoals;
        const a90 =
          halftime.fullMatchResult.awayGoals90 ??
          halftime.fullMatchResult.awayGoals;
        const aggH = (halftime.aggHomeBeforeMatch ?? 0) + h90;
        const aggA = (halftime.aggAwayBeforeMatch ?? 0) + a90;
        if (aggH === aggA) {
          const etTimer = window.setTimeout(() => {
            enterExtraTimeBreak();
          }, 520);
          return () => window.clearTimeout(etTimer);
        }
      }
      if (phase === 'extra_time') {
        const etHtTimer = window.setTimeout(() => {
          enterEtHalftimeLocker();
        }, 480);
        return () => window.clearTimeout(etHtTimer);
      }
      if (
        phase === 'extra_time_2' &&
        halftime.fullMatchResult?.extraTime?.penalties
      ) {
        const pkTimer = window.setTimeout(() => {
          enterPenaltyShootout();
        }, 560);
        return () => window.clearTimeout(pkTimer);
      }
      return;
    }

    const tickDelay =
      phase === 'extra_time' || phase === 'extra_time_2'
        ? Math.max(55, SPEED_MS[speed] * 0.9)
        : SPEED_MS[speed];
    const timer = window.setTimeout(() => {
      const nextMin = Math.min(targetEnd, minute + 1);
      const nextHighlight = indexedEvents.find(
        ({ ev, key }) =>
          ev.minute === nextMin &&
          !(phase === 'first_half' && ev.half === 2) &&
          (ev.type === 'goal' ||
            ev.type === 'save' ||
            ev.type === 'chance' ||
            ev.type === 'var_offside') &&
          !handledHighlightKeys.includes(key),
      );
      setMinute(nextMin);
      if (nextHighlight) {
        setHandledHighlightKeys((prev) => [...prev, nextHighlight.key]);
        setDramaticEvent({
          key: nextHighlight.key,
          event: nextHighlight.ev,
          revealed: false,
        });
      }
    }, tickDelay);

    return () => window.clearTimeout(timer);
  }, [
    halftime,
    phase,
    minute,
    speed,
    dramaticEvent,
    liveSubOpen,
    indexedEvents,
    handledHighlightKeys,
    enterHalftimeLocker,
    enterExtraTimeBreak,
    enterEtHalftimeLocker,
    enterPenaltyShootout,
  ]);

  // Sequential Penalty Shootout kicker reveal ticker
  const totalPenKicks =
    halftime?.fullMatchResult?.extraTime?.penalties?.kicks.length ?? 0;
  useEffect(() => {
    if (phase !== 'penalties' || totalPenKicks === 0) return;
    if (revealedPenKicks >= totalPenKicks) return;
    const timer = window.setTimeout(() => {
      setRevealedPenKicks((c) => Math.min(totalPenKicks, c + 1));
    }, 680);
    return () => window.clearTimeout(timer);
  }, [phase, revealedPenKicks, totalPenKicks]);

  // Visible events exclude any currently unrevealed slow-motion highlight (zero spoilers!)
  const visibleEvents = useMemo(
    () =>
      indexedEvents
        .filter(({ ev, key }) => {
          if (phase === 'first_half' && ev.half === 2) return false;
          if (ev.minute > minute) return false;
          if (
            ev.minute === minute &&
            (ev.type === 'goal' ||
              ev.type === 'save' ||
              ev.type === 'chance' ||
              ev.type === 'var_offside')
          ) {
            if (dramaticEvent && dramaticEvent.key === key && !dramaticEvent.revealed) {
              return false;
            }
            if (!handledHighlightKeys.includes(key)) {
              return false;
            }
          }
          return true;
        })
        .map(({ ev }) => ev),
    [indexedEvents, phase, minute, dramaticEvent, handledHighlightKeys],
  );

  if (!halftime) return null;

  const home = clubsById[halftime.homeTeamId];
  const away = clubsById[halftime.awayTeamId];
  if (!home || !away) return null;

  const fullResult = halftime.fullMatchResult;
  const needsExtraTimeAt90 = Boolean(
    halftime.isKnockoutDecider &&
      fullResult &&
      (halftime.aggHomeBeforeMatch ?? 0) +
        (fullResult.homeGoals90 ?? fullResult.homeGoals) ===
        (halftime.aggAwayBeforeMatch ?? 0) +
          (fullResult.awayGoals90 ?? fullResult.awayGoals),
  );
  const penaltiesData = fullResult?.extraTime?.penalties ?? null;
  const isPenaltiesDone =
    phase === 'penalties' &&
    penaltiesData !== null &&
    revealedPenKicks >= penaltiesData.kicks.length;
  const isExtraTimeDone =
    phase === 'extra_time_2' &&
    minute >= 120 &&
    !dramaticEvent &&
    !penaltiesData;
  const isSecondHalfDone =
    (phase === 'second_half' &&
      minute >= 90 &&
      !dramaticEvent &&
      !needsExtraTimeAt90) ||
    isExtraTimeDone ||
    isPenaltiesDone;

  // Live Score derived strictly from revealed goal events up to current clock minute
  const liveHomeGoals = visibleEvents.filter(
    (e) => e.type === 'goal' && e.teamId === home.id,
  ).length;
  const liveAwayGoals = visibleEvents.filter(
    (e) => e.type === 'goal' && e.teamId === away.id,
  ).length;

  // Progressive stats interpolation matching exact HT (45') and FT (90') totals
  const computeLiveMetric = (htVal: number, ftVal: number): number => {
    if (phase === 'first_half') {
      return htVal * Math.min(1, minute / 45);
    }
    if (phase === 'halftime') {
      return htVal;
    }
    const secondProgress = Math.max(0, Math.min(1, (minute - 45) / 45));
    return htVal + (ftVal - htVal) * secondProgress;
  };

  const liveHomeXg = computeLiveMetric(
    halftime.homeXg,
    fullResult?.homeXg ?? halftime.homeXg,
  );
  const liveAwayXg = computeLiveMetric(
    halftime.awayXg,
    fullResult?.awayXg ?? halftime.awayXg,
  );
  const liveHomeShots = Math.max(
    liveHomeGoals,
    Math.round(
      computeLiveMetric(
        halftime.homeShots,
        fullResult?.homeShots ?? halftime.homeShots,
      ),
    ),
  );
  const liveAwayShots = Math.max(
    liveAwayGoals,
    Math.round(
      computeLiveMetric(
        halftime.awayShots,
        fullResult?.awayShots ?? halftime.awayShots,
      ),
    ),
  );
  const liveHomeSot = Math.min(
    liveHomeShots,
    Math.max(
      liveHomeGoals,
      Math.round(
        computeLiveMetric(
          halftime.homeShotsOnTarget,
          fullResult?.homeShotsOnTarget ?? halftime.homeShotsOnTarget,
        ),
      ),
    ),
  );
  const liveAwaySot = Math.min(
    liveAwayShots,
    Math.max(
      liveAwayGoals,
      Math.round(
        computeLiveMetric(
          halftime.awayShotsOnTarget,
          fullResult?.awayShotsOnTarget ?? halftime.awayShotsOnTarget,
        ),
      ),
    ),
  );

  const targetPoss =
    phase === 'second_half' && fullResult
      ? fullResult.homePossession
      : halftime.homePossession;
  const liveHomePoss =
    minute === 0
      ? 50
      : Math.round(
          50 +
            (targetPoss - 50) * Math.min(1, minute / 20) +
            (phase === 'halftime' || isSecondHalfDone
              ? 0
              : Math.sin(minute * 0.45) * 1.5),
        );

  const myTeamId = override?.myTeamId ?? USER_CLUB_ID;
  const oppClub = halftime.isUserHome ? away : home;
  const oppManager = override?.opponentManagerOverride ?? getClubManager(oppClub);
  const oppTactic = halftime.isUserHome ? halftime.awayTactic : halftime.homeTactic;
  const oppFormation = halftime.isUserHome
    ? halftime.awayFormation
    : halftime.homeFormation;
  const oppRoster =
    override?.opponentRoster ??
    gameCtx.state.season?.aiRosters?.[oppClub.id] ??
    gameCtx.state.season?.ucl?.aiRosters?.[oppClub.id] ??
    buildAiClubRoster(oppClub, gameCtx.state.season?.leagueId ?? 'epl');

  const htUnifiedMatchup = evaluateUnifiedTacticalMatchup(
    {
      starters: state.starters,
      formation: state.formation,
      tactic: selectedTactic,
      managerTraitId: state.manager.traitId,
      managerOvr: 86,
    },
    {
      starters: oppRoster.slice(0, 11),
      formation: oppFormation,
      tactic: oppTactic,
      managerTraitId: oppManager.traitId,
      managerOvr: oppManager.ovr,
    },
  );

  const htTacticFits: Record<TacticId, number> = {
    possession: evaluateTeamTacticalProfile({
      starters: state.starters,
      formation: state.formation,
      tactic: 'possession',
      managerTraitId: state.manager.traitId,
      managerOvr: 86,
    }).tacticalFit,
    gegenpressing: evaluateTeamTacticalProfile({
      starters: state.starters,
      formation: state.formation,
      tactic: 'gegenpressing',
      managerTraitId: state.manager.traitId,
      managerOvr: 86,
    }).tacticalFit,
    counter: evaluateTeamTacticalProfile({
      starters: state.starters,
      formation: state.formation,
      tactic: 'counter',
      managerTraitId: state.manager.traitId,
      managerOvr: 86,
    }).tacticalFit,
    wingplay: evaluateTeamTacticalProfile({
      starters: state.starters,
      formation: state.formation,
      tactic: 'wingplay',
      managerTraitId: state.manager.traitId,
      managerOvr: 86,
    }).tacticalFit,
    balanced: evaluateTeamTacticalProfile({
      starters: state.starters,
      formation: state.formation,
      tactic: 'balanced',
      managerTraitId: state.manager.traitId,
      managerOvr: 86,
    }).tacticalFit,
  };

  const isWizard = state.manager.traitId === 'halftime_wizard';
  const activeTrait = state.manager.traitId
    ? MANAGER_TRAITS[state.manager.traitId]
    : null;

  const liveHomeFormation = fullResult?.homeFormation ?? halftime.homeFormation;
  const liveAwayFormation = fullResult?.awayFormation ?? halftime.awayFormation;

  const isEtBreakPhase =
    phase === 'extra_time_break' || phase === 'extra_time_ht';
  const isLockerPhase = phase === 'halftime' || isEtBreakPhase;

  const userActiveTactic: TacticId =
    phase === 'first_half'
      ? halftime.userTacticAtKickoff
      : isLockerPhase
        ? selectedTactic
        : halftime.isUserHome
          ? fullResult?.homeTactic ?? selectedTactic
          : fullResult?.awayTactic ?? selectedTactic;

  const formationSlots = (FORMATIONS[state.formation] ?? FORMATIONS['4-3-3']).slots;

  // Compute live stamina % for each of the 11 user starters at current clock minute
  const enteredAtMap = new Map<string, number>();
  for (const id of subbedInIds) enteredAtMap.set(id, 45);
  for (const rec of halftime.liveSubs ?? []) {
    enteredAtMap.set(rec.inPlayerId, rec.minute);
  }
  const subbedOutIdSet = new Set(
    (halftime.liveSubs ?? []).map((r) => r.outPlayerId),
  );

  const starterStaminaRows = state.starters.map((player, idx) => {
    const slot = formationSlots[idx];
    if (!player) {
      return {
        index: idx,
        slotLabel: slot?.label ?? `S${idx + 1}`,
        subPosition: slot?.subPosition ?? ('CM' as SubPosition),
        player: null as Player | null,
        staminaPct: 100,
        penalty: getStaminaPenalty(100),
        isFreshSub: false,
      };
    }
    const enterMin = enteredAtMap.get(player.id) ?? 0;
    const minsOnPitch = Math.max(0, minute - enterMin);
    const staminaPct = computePlayerStaminaPct({
      staminaStat: getPlayerStaminaStat(player),
      subPosition: slot?.subPosition ?? 'CM',
      tactic: userActiveTactic,
      minutesPlayed: minsOnPitch,
    });
    return {
      index: idx,
      slotLabel: slot?.label ?? `S${idx + 1}`,
      subPosition: slot?.subPosition ?? ('CM' as SubPosition),
      player,
      staminaPct,
      penalty: getStaminaPenalty(staminaPct),
      isFreshSub: enterMin >= 45,
    };
  });

  const staminaByPlayerId: Record<string, number> = {};
  for (const row of starterStaminaRows) {
    if (row.player) staminaByPlayerId[row.player.id] = row.staminaPct;
  }
  for (const bp of state.bench) {
    if (!bp) continue;
    if (subbedOutIdSet.has(bp.id)) {
      const rec = (halftime.liveSubs ?? []).find((r) => r.outPlayerId === bp.id);
      const subMin = rec?.minute ?? 45;
      staminaByPlayerId[bp.id] = computePlayerStaminaPct({
        staminaStat: getPlayerStaminaStat(bp),
        subPosition: formationSlots[rec?.slotIndex ?? 5]?.subPosition ?? 'CM',
        tactic: userActiveTactic,
        minutesPlayed: subMin,
      });
    } else {
      staminaByPlayerId[bp.id] = 100;
    }
  }

  const maxSubsAllowed =
    phase === 'extra_time_break' ||
    phase === 'extra_time' ||
    phase === 'extra_time_ht' ||
    phase === 'extra_time_2'
      ? MAX_MATCH_SUBS + 1
      : MAX_MATCH_SUBS;
  const subsUsed = halftime.halftimeSubsMade;
  const subsRemaining = Math.max(0, maxSubsAllowed - subsUsed);

  const liveAggHomeForBrief = (halftime.aggHomeBeforeMatch ?? 0) + liveHomeGoals;
  const liveAggAwayForBrief = (halftime.aggAwayBeforeMatch ?? 0) + liveAwayGoals;

  const extraTimeBriefing = isEtBreakPhase
    ? buildExtraTimeCoachBriefing({
        stage: phase === 'extra_time_break' ? 'before_et1' : 'et_halftime',
        starters: state.starters,
        bench: state.bench,
        formation: state.formation,
        oppTactic,
        userAggGoals: halftime.isUserHome
          ? liveAggHomeForBrief
          : liveAggAwayForBrief,
        oppAggGoals: halftime.isUserHome
          ? liveAggAwayForBrief
          : liveAggHomeForBrief,
        staminaByPlayerId,
        eventsSoFar: visibleEvents,
        disabledBenchIds: subbedOutIdSet,
        subsRemaining,
        managerTraitId: state.manager.traitId,
      })
    : null;

  const coachRecommendations = isEtBreakPhase
    ? (extraTimeBriefing?.recommendations ?? [])
    : phase === 'halftime' && subsRemaining > 0
      ? buildHalftimeCoachRecommendations({
          starters: state.starters,
          bench: state.bench,
          formation: state.formation,
          oppTactic,
          userGoals: halftime.isUserHome ? halftime.homeGoals : halftime.awayGoals,
          oppGoals: halftime.isUserHome ? halftime.awayGoals : halftime.homeGoals,
          staminaByPlayerId,
          firstHalfEvents: halftime.firstHalfEvents,
          disabledBenchIds: subbedOutIdSet,
          managerTraitId: state.manager.traitId,
          maxRecommendations: 2,
        })
      : [];

  const performHalftimeSwap = (from: SlotRef, to: SlotRef) => {
    if (from.area === 'bench' && to.area === 'bench') return;

    const isBenchSub = from.area !== to.area;
    if (!isBenchSub) {
      // Starter <-> Starter free positional swap (zero substitution count used)
      const pA = state.starters[from.index];
      const pB = state.starters[to.index];
      if (!pA || !pB) return;
      swapSquadPositions(from, to);
      setHtNotice(
        `선발 위치 변경: ${pA.name} ↔ ${pB.name} (교체 횟수 차감 없음)`,
      );
      return;
    }

    if (subsUsed >= maxSubsAllowed) return;
    const starterIdx = from.area === 'starter' ? from.index : to.index;
    const benchIdx = from.area === 'bench' ? from.index : to.index;
    const outPlayer = state.starters[starterIdx];
    const inPlayer = state.bench[benchIdx];
    if (!outPlayer || !inPlayer || subbedOutIdSet.has(inPlayer.id)) return;

    const slotLabel = formationSlots[starterIdx]?.label ?? `#${starterIdx + 1}`;
    setPendingHtSubConfirm({
      from: { area: 'starter', index: starterIdx },
      to: { area: 'bench', index: benchIdx },
      outPlayer,
      inPlayer,
      slotLabel,
    });
  };

  const confirmPendingHalftimeSub = () => {
    if (!pendingHtSubConfirm) return;
    const { from, to, outPlayer, inPlayer } = pendingHtSubConfirm;
    if (subsUsed >= maxSubsAllowed) {
      setPendingHtSubConfirm(null);
      return;
    }
    if (!subbedInIds.includes(inPlayer.id)) {
      setSubbedInIds((prev) => [...prev, inPlayer.id]);
    }
    swapSquadPositions(from, to);
    setHtNotice(`교체 완료: OUT ${outPlayer.name} → IN ${inPlayer.name}`);
    setPendingHtSubConfirm(null);
  };

  const handleApplyCoachRecommendation = (
    starterIndex: number,
    benchIndex: number,
  ) => {
    if (subsUsed >= maxSubsAllowed) return;
    const outPlayer = state.starters[starterIndex];
    const inPlayer = state.bench[benchIndex];
    if (!outPlayer || !inPlayer || subbedOutIdSet.has(inPlayer.id)) return;
    const slotLabel = formationSlots[starterIndex]?.label ?? `#${starterIndex + 1}`;
    setPendingHtSubConfirm({
      from: { area: 'starter', index: starterIndex },
      to: { area: 'bench', index: benchIndex },
      outPlayer,
      inPlayer,
      slotLabel,
    });
  };

  const handleHalftimeQuickBestXi = () => {
    setSwapPick(null);
    optimizeHalftimeStarters(selectedTactic);
    setHtNotice(
      `현재 선발 11명을 ${state.formation} 최적 포지션으로 자동 재배치했습니다.`,
    );
  };

  const handleSlotClick = (area: 'starter' | 'bench', index: number) => {
    const clicked =
      area === 'starter' ? state.starters[index] : state.bench[index];
    if (!clicked) return;
    if (area === 'bench' && subbedOutIdSet.has(clicked.id)) return;

    if (!swapPick) {
      setSwapPick({ area, index });
      return;
    }
    if (swapPick.area === area && swapPick.index === index) {
      setSwapPick(null);
      return;
    }
    performHalftimeSwap(swapPick, { area, index });
    setSwapPick(null);
  };

  const handleInstantFinish = () => {
    setDramaticEvent(null);
    setLiveSubOpen(false);
    setPendingHtSubConfirm(null);
    if (phase === 'second_half') {
      setMinute(90);
      commitLiveMatch();
    } else {
      commitLiveMatch(selectedTactic);
    }
  };

  const handleStartSecondHalf = () => {
    setPendingHtSubConfirm(null);
    setHtNotice(null);
    startSecondHalfBroadcast({
      secondHalfTactic: selectedTactic,
      subPlayerIds: subbedInIds,
      firstHalfStarters: firstHalfStartersRef.current,
    });
  };

  const handleOpenLiveSub = () => {
    if (phase !== 'second_half' || isSecondHalfDone) return;
    setDramaticEvent(null);
    setPendingLiveSubs([]);
    setLiveSubPick(null);
    setDraftStarters([...state.starters]);
    setDraftBench([...state.bench]);
    setLiveSubOpen(true);
  };

  // Disabled bench IDs inside the 2nd-half pause preview (already subbed off earlier OR in current draft queue)
  const draftDisabledBenchIds = new Set<string>(subbedOutIdSet);
  for (const s of pendingLiveSubs) {
    draftDisabledBenchIds.add(s.outPlayerId);
  }

  const hasDraftLineupChanges =
    liveSubOpen &&
    draftStarters.some((p, idx) => p?.id !== state.starters[idx]?.id);

  const performDraftLiveSubSwap = (from: SlotRef, to: SlotRef) => {
    if (from.area === to.area && from.index === to.index) return;

    // 1) Starter <-> Starter free positional swap (zero substitution count used!)
    if (from.area === 'starter' && to.area === 'starter') {
      const pA = draftStarters[from.index];
      const pB = draftStarters[to.index];
      if (!pA || !pB) return;
      const nextS = [...draftStarters];
      nextS[from.index] = pB;
      nextS[to.index] = pA;
      setDraftStarters(nextS);
      return;
    }

    // 2) Ignore bench <-> bench swaps
    if (from.area === 'bench' && to.area === 'bench') return;

    // 3) Starter <-> Bench substitution
    const starterIdx = from.area === 'starter' ? from.index : to.index;
    const benchIdx = from.area === 'bench' ? from.index : to.index;
    const outP = draftStarters[starterIdx];
    const inP = draftBench[benchIdx];
    if (!outP || !inP) return;
    if (draftDisabledBenchIds.has(inP.id)) return;
    if (pendingLiveSubs.length >= subsRemaining) return;
    // Prevent chaining a second bench sub onto a player just brought in during this same pause
    if (pendingLiveSubs.some((s) => s.inPlayerId === outP.id)) return;

    const nextS = [...draftStarters];
    const nextB = [...draftBench];
    nextS[starterIdx] = inP;
    nextB[benchIdx] = outP;
    setDraftStarters(nextS);
    setDraftBench(nextB);
    setPendingLiveSubs((prev) => [
      ...prev,
      {
        outPlayerId: outP.id,
        outPlayerName: outP.name,
        inPlayerId: inP.id,
        inPlayerName: inP.name,
      },
    ]);
  };

  const handleDraftSlotClick = (area: 'starter' | 'bench', index: number) => {
    const clicked =
      area === 'starter' ? draftStarters[index] : draftBench[index];
    if (!clicked) return;
    if (area === 'bench' && draftDisabledBenchIds.has(clicked.id)) return;

    if (!liveSubPick) {
      setLiveSubPick({ area, index });
      return;
    }
    if (liveSubPick.area === area && liveSubPick.index === index) {
      setLiveSubPick(null);
      return;
    }
    if (liveSubPick.area === 'bench' && area === 'bench') {
      // Clicking another bench player switches selection cleanly
      setLiveSubPick({ area, index });
      return;
    }
    // Starter <-> Starter OR Starter <-> Bench executes immediately in draft preview
    performDraftLiveSubSwap(liveSubPick, { area, index });
    setLiveSubPick(null);
  };

  const handleRemovePendingSub = (idxToRemove: number) => {
    const target = pendingLiveSubs[idxToRemove];
    if (!target) return;
    const nextS = [...draftStarters];
    const nextB = [...draftBench];
    const inIdx = nextS.findIndex((p) => p?.id === target.inPlayerId);
    const outIdx = nextB.findIndex((p) => p?.id === target.outPlayerId);
    if (inIdx >= 0 && outIdx >= 0) {
      const tmp = nextS[inIdx];
      nextS[inIdx] = nextB[outIdx];
      nextB[outIdx] = tmp;
    }
    setDraftStarters(nextS);
    setDraftBench(nextB);
    setPendingLiveSubs((prev) => prev.filter((_, i) => i !== idxToRemove));
    setLiveSubPick(null);
  };

  const handleConfirmLiveSubs = () => {
    if (pendingLiveSubs.length === 0 && !hasDraftLineupChanges) {
      setLiveSubOpen(false);
      return;
    }
    const newInIds = pendingLiveSubs.map((s) => s.inPlayerId);
    if (newInIds.length > 0) {
      setSubbedInIds((prev) => Array.from(new Set([...prev, ...newInIds])));
    }

    applySecondHalfLiveSub({
      minute,
      subs: pendingLiveSubs.map((s) => ({
        outPlayerId: s.outPlayerId,
        inPlayerId: s.inPlayerId,
      })),
      nextStarters: draftStarters,
      nextBench: draftBench,
      firstHalfStarters: firstHalfStartersRef.current,
      halftimeSubIds: subbedInIds,
    });
    setPendingLiveSubs([]);
    setLiveSubPick(null);
    setLiveSubOpen(false);
  };

  const draftChemistry = liveSubOpen
    ? calculateChemistry(
        state.formation,
        draftStarters,
        userActiveTactic,
        state.manager.traitId,
      )
    : chemistry;

  const allStats = state.season?.allPlayerStats ?? {};
  const competitionTitle =
    halftime.competitionLabel || `ROUND ${halftime.round}`;
  const isTwoLegSecond =
    halftime.aggHomeBeforeMatch !== undefined &&
    halftime.aggAwayBeforeMatch !== undefined;
  const liveAggHome = (halftime.aggHomeBeforeMatch ?? 0) + liveHomeGoals;
  const liveAggAway = (halftime.aggAwayBeforeMatch ?? 0) + liveAwayGoals;

  const handleStartExtraTime = () => {
    setPendingHtSubConfirm(null);
    setHtNotice(null);
    startExtraTimeBroadcast({
      etTactic: selectedTactic,
      firstHalfStarters: firstHalfStartersRef.current,
      halftimeSubIds: subbedInIds,
    });
  };

  const handleStartEtSecondHalf = () => {
    setPendingHtSubConfirm(null);
    setHtNotice(null);
    startEtSecondHalfBroadcast({
      etTactic: selectedTactic,
      firstHalfStarters: firstHalfStartersRef.current,
      halftimeSubIds: subbedInIds,
    });
  };

  const pitchPhase: 'first_half' | 'halftime' | 'second_half' =
    phase === 'first_half'
      ? 'first_half'
      : isLockerPhase
        ? 'halftime'
        : 'second_half';

  const revealedKicks = penaltiesData
    ? penaltiesData.kicks.slice(0, revealedPenKicks)
    : [];
  const homePenKicks = revealedKicks.filter((k) => k.teamId === home.id);
  const awayPenKicks = revealedKicks.filter((k) => k.teamId === away.id);
  const livePenHomeScore =
    revealedKicks[revealedKicks.length - 1]?.homeScoreAfter ?? 0;
  const livePenAwayScore =
    revealedKicks[revealedKicks.length - 1]?.awayScoreAfter ?? 0;
  const latestPenKick = revealedKicks[revealedKicks.length - 1] ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/92 p-2 sm:p-4 backdrop-blur-sm">
      <div className="flex max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-[#0f1621] shadow-2xl">
        {/* Top Broadcast Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-[#0a0f17] px-3.5 sm:px-5 py-2.5">
          <div className="flex items-center gap-2.5">
            <span
              className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-black tracking-wide ${
                isLockerPhase
                  ? 'bg-amber-400 text-slate-950'
                  : phase === 'penalties'
                    ? 'bg-purple-400 text-slate-950'
                    : liveSubOpen
                      ? 'bg-sky-400 text-slate-950'
                      : isSecondHalfDone
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-rose-500 text-white'
              }`}
            >
              {phase === 'halftime' ? (
                'HALF TIME'
              ) : phase === 'extra_time_break' ? (
                'ET BREAK'
              ) : phase === 'extra_time_ht' ? (
                'ET HALF TIME'
              ) : phase === 'penalties' ? (
                'PENALTIES'
              ) : liveSubOpen ? (
                <>
                  <Pause className="w-3 h-3" />
                  PAUSED
                </>
              ) : isSecondHalfDone ? (
                'FULL TIME'
              ) : (
                <>
                  <Radio className="w-3 h-3 animate-pulse" />
                  LIVE
                </>
              )}
            </span>
            <span className="font-display text-sm font-bold text-white tabular-nums">
              {competitionTitle} · {minute}&apos;
            </span>
            {dramaticEvent && !dramaticEvent.revealed && (
              <span className="rounded bg-amber-400/20 border border-amber-400/50 px-2 py-0.5 text-[10px] font-black text-amber-300 animate-pulse">
                SLOW-MO · 결정적 찬스
              </span>
            )}
          </div>

          {/* Speed Controls + Live Sub + Instant Finish */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(phase === 'first_half' ||
              phase === 'second_half' ||
              phase === 'extra_time' ||
              phase === 'extra_time_2') &&
              !isSecondHalfDone &&
              (lockedSpeed !== undefined ? (
                <span className="inline-flex items-center gap-1 rounded-lg border border-sky-500/40 bg-sky-500/12 px-2.5 py-1 text-[11px] font-extrabold text-sky-200">
                  {lockedSpeed}x 동기화
                </span>
              ) : (
                <div className="flex items-center rounded-lg border border-slate-800 bg-[#111822] p-0.5 text-[11px]">
                  {([1, 2, 4] as BroadcastSpeed[]).map((spd) => (
                    <button
                      key={spd}
                      type="button"
                      onClick={() => setSpeed(spd)}
                      className={`rounded-md border px-2.5 py-1 font-bold transition-colors cursor-pointer ${
                        speed === spd
                          ? 'border-emerald-500/50 bg-slate-800 text-white'
                          : 'border-transparent text-slate-400 hover:text-white'
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              ))}

            {phase === 'second_half' && !isSecondHalfDone && !override?.disableLiveSub && (
              <button
                type="button"
                onClick={handleOpenLiveSub}
                className="inline-flex items-center gap-1.5 rounded-lg border border-sky-400/60 bg-sky-500/15 px-2.5 py-1.5 text-xs font-extrabold text-sky-200 hover:bg-sky-500/25 transition-colors cursor-pointer"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                {subsRemaining > 0
                  ? `선수 교체 · 위치 (${subsUsed}/${MAX_MATCH_SUBS})`
                  : `포지션 변경 (${subsUsed}/${MAX_MATCH_SUBS})`}
              </button>
            )}

            {phase === 'first_half' && lockedSpeed === undefined && (
              <button
                type="button"
                onClick={() => {
                  setDramaticEvent(null);
                  setMinute(45);
                  enterHalftimeLocker();
                }}
                className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-slate-200 hover:border-amber-400/50 hover:text-amber-200 cursor-pointer"
              >
                하프타임으로
              </button>
            )}

            {phase === 'extra_time' && lockedSpeed === undefined && (
              <button
                type="button"
                onClick={() => {
                  setDramaticEvent(null);
                  setMinute(105);
                  enterEtHalftimeLocker();
                }}
                className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-slate-200 hover:border-amber-400/50 hover:text-amber-200 cursor-pointer"
              >
                연장 하프타임으로
              </button>
            )}

            {phase === 'penalties' && !isPenaltiesDone && penaltiesData && lockedSpeed === undefined && (
              <button
                type="button"
                onClick={() => setRevealedPenKicks(penaltiesData.kicks.length)}
                className="rounded-lg border border-purple-400/50 bg-purple-500/15 px-2.5 py-1.5 text-xs font-bold text-purple-200 hover:bg-purple-500/25 cursor-pointer"
              >
                승부차기 결과 바로 보기
              </button>
            )}

            {!isSecondHalfDone && phase !== 'penalties' && !override?.disableInstantFinish && (
              <button
                id="instant-match-result-btn"
                type="button"
                onClick={handleInstantFinish}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-slate-200 hover:border-emerald-400/60 hover:text-emerald-300 cursor-pointer"
              >
                <FastForward className="w-3.5 h-3.5" />
                즉시 결과 보기
              </button>
            )}

            {isSecondHalfDone && (
              <button
                id="commit-live-match-btn"
                type="button"
                onClick={() => commitLiveMatch()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-1.5 text-xs font-extrabold text-slate-950 hover:bg-emerald-400 cursor-pointer"
              >
                {override?.commitButtonLabel ?? '경기 종료 · 결과 확정 →'}
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto p-3 sm:p-4 space-y-3">
          {/* Compact Live Scoreboard & Stats Strip */}
          <div className="rounded-xl border border-slate-800 bg-[#0b1018] px-3.5 py-2.5 space-y-2">
            {/* 1-Line AI Manager Halftime Counter Notification */}
            {phase === 'second_half' &&
              (fullResult?.aiHalftimeAdjustment ?? halftime.aiHalftimeAdjustment) && (
                <div className="flex items-center justify-center rounded-lg border border-amber-400/35 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-200">
                  <span className="truncate">
                    {(fullResult?.aiHalftimeAdjustment ?? halftime.aiHalftimeAdjustment)!.headline}
                  </span>
                </div>
              )}

            <div className="grid grid-cols-3 items-center text-center gap-1.5 sm:gap-2">
              <div className="flex items-center justify-end gap-1.5 sm:gap-2.5 text-right">
                <div className="min-w-0">
                  <div
                    className={`truncate text-[11px] sm:text-sm font-bold ${
                      home.isUser ? 'text-emerald-300' : 'text-white'
                    }`}
                  >
                    {home.name}
                  </div>
                  <div className="text-[9px] sm:text-[10px] text-slate-500">
                    {liveHomeFormation} ·{' '}
                    {TACTICS[fullResult?.homeTactic ?? halftime.homeTactic].shortName}
                  </div>
                </div>
                <JerseySvg
                  primaryColor={home.primaryColor}
                  secondaryColor={home.secondaryColor}
                  pattern={home.pattern}
                  label={home.shortName}
                  size={28}
                />
              </div>

              <div className="flex flex-col items-center">
                <div className="font-display text-2xl sm:text-4xl font-bold tracking-wider text-white tabular-nums leading-none">
                  {liveHomeGoals} <span className="text-slate-600">:</span>{' '}
                  {liveAwayGoals}
                </div>
                <div className="mt-0.5 sm:mt-1 flex flex-wrap items-center justify-center gap-1">
                  <span className="font-display text-[11px] sm:text-xs font-bold text-emerald-400 tabular-nums">
                    {phase === 'halftime'
                      ? "45' HT"
                      : phase === 'extra_time_break'
                        ? "90' 연장"
                        : phase === 'extra_time_ht'
                          ? "105' HT"
                          : phase === 'penalties'
                            ? isPenaltiesDone
                              ? 'PK 종료'
                              : '승부차기'
                            : isSecondHalfDone
                              ? minute > 90
                                ? "120' AET"
                                : "90' FT"
                              : `${minute}'`}
                  </span>
                  {isTwoLegSecond && (
                    <span className="rounded bg-sky-500/20 border border-sky-400/40 px-1.5 py-px text-[10px] sm:text-[11px] font-black text-sky-200 tabular-nums">
                      합산 {liveAggHome}:{liveAggAway}
                    </span>
                  )}
                  {phase === 'penalties' && (
                    <span className="rounded bg-purple-500/20 px-1.5 py-px text-[10px] font-black text-purple-200 tabular-nums">
                      PK {livePenHomeScore}:{livePenAwayScore}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-start gap-1.5 sm:gap-2.5 text-left">
                <JerseySvg
                  primaryColor={away.primaryColor}
                  secondaryColor={away.secondaryColor}
                  pattern={away.pattern}
                  label={away.shortName}
                  size={28}
                />
                <div className="min-w-0">
                  <div
                    className={`truncate text-[11px] sm:text-sm font-bold ${
                      away.isUser ? 'text-emerald-300' : 'text-white'
                    }`}
                  >
                    {away.name}
                  </div>
                  <div className="text-[9px] sm:text-[10px] text-slate-500">
                    {liveAwayFormation} ·{' '}
                    {TACTICS[fullResult?.awayTactic ?? halftime.awayTactic].shortName}
                  </div>
                </div>
              </div>
            </div>

            {/* Prominent 1st-Leg & Live Aggregate Banner for 2-Legged UCL Ties */}
            {isTwoLegSecond && (() => {
              const userAgg = home.isUser ? liveAggHome : liveAggAway;
              const oppAgg = home.isUser ? liveAggAway : liveAggHome;
              const diff = userAgg - oppAgg;
              const statusText =
                diff > 0
                  ? `합산 +${diff} 우위`
                  : diff < 0
                    ? `합산 ${diff} · ${Math.abs(diff)}골 필요`
                    : '합산 동률';
              const statusCls =
                diff > 0
                  ? 'border-emerald-400/45 bg-emerald-500/15 text-emerald-200'
                  : diff < 0
                    ? 'border-rose-400/45 bg-rose-500/15 text-rose-200'
                    : 'border-amber-400/45 bg-amber-500/15 text-amber-200';
              return (
                <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-lg border border-sky-400/35 bg-sky-950/40 px-2.5 py-1 text-[10px] sm:text-[11px] tabular-nums">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded bg-slate-950/80 border border-slate-700 px-1.5 py-px text-[9px] sm:text-[10px] font-bold text-slate-300">
                      1차전 {halftime.aggHomeBeforeMatch}:{halftime.aggAwayBeforeMatch}
                    </span>
                    <span className="font-extrabold text-sky-200">
                      AGG{' '}
                      <span className="text-amber-300 font-black">
                        {liveAggHome}:{liveAggAway}
                      </span>
                    </span>
                  </div>
                  <span className={`rounded border px-1.5 py-px text-[9px] sm:text-[10px] font-extrabold ${statusCls}`}>
                    {statusText}
                  </span>
                </div>
              );
            })()}

            {/* Match Clock Progress Bar */}
            <div className="relative h-1 sm:h-1.5 w-full rounded-full bg-slate-900 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-150 ${
                  minute > 90 ? 'bg-amber-400' : 'bg-emerald-500'
                }`}
                style={{
                  width: `${Math.min(100, (minute / (minute > 90 ? 120 : 90)) * 100)}%`,
                }}
              />
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-600" />
            </div>

            {/* Compact Live Match Stats */}
            <div className="grid grid-cols-4 gap-1 sm:gap-1.5 text-center tabular-nums">
              <div className="flex items-center justify-center gap-1 rounded-lg bg-[#111822] px-1.5 py-0.5 sm:px-2 sm:py-1">
                <span className="text-[9px] sm:text-[10px] text-slate-500">점유</span>
                <span className="font-display text-[11px] sm:text-xs font-bold text-white">
                  {liveHomePoss}:{100 - liveHomePoss}
                </span>
              </div>
              <div className="flex items-center justify-center gap-1 rounded-lg bg-[#111822] px-1.5 py-0.5 sm:px-2 sm:py-1">
                <span className="text-[9px] sm:text-[10px] text-slate-500">xG</span>
                <span className="font-display text-[11px] sm:text-xs font-bold text-emerald-300">
                  {liveHomeXg.toFixed(1)}:{liveAwayXg.toFixed(1)}
                </span>
              </div>
              <div className="flex items-center justify-center gap-1 rounded-lg bg-[#111822] px-1.5 py-0.5 sm:px-2 sm:py-1">
                <span className="text-[9px] sm:text-[10px] text-slate-500">슈팅</span>
                <span className="font-display text-[11px] sm:text-xs font-bold text-white">
                  {liveHomeShots}:{liveAwayShots}
                </span>
              </div>
              <div className="flex items-center justify-center gap-1 rounded-lg bg-[#111822] px-1.5 py-0.5 sm:px-2 sm:py-1">
                <span className="text-[9px] sm:text-[10px] text-slate-500">유효</span>
                <span className="font-display text-[11px] sm:text-xs font-bold text-sky-300">
                  {liveHomeSot}:{liveAwaySot}
                </span>
              </div>
            </div>
          </div>

          {/* PENALTY SHOOTOUT INTERACTIVE PANEL */}
          {phase === 'penalties' && penaltiesData && (
            <div className="rounded-2xl border border-purple-500/40 bg-gradient-to-b from-purple-950/30 via-[#0b1018] to-[#0b1018] p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-black text-purple-200">
                    🎯 운명의 승부차기 (Penalty Shootout)
                  </h3>
                  <p className="text-xs text-slate-400">
                    키커의 결정력과 골키퍼 선방 능력에 따라 매 킥의 승부가 갈립니다.
                  </p>
                </div>
                {isPenaltiesDone && (
                  <div className="rounded-xl border border-emerald-400/50 bg-emerald-500/20 px-3.5 py-1.5 text-sm font-black text-emerald-300">
                    🏆{' '}
                    {penaltiesData.winnerTeamId === home.id
                      ? home.name
                      : away.name}{' '}
                    승부차기 승리 ({penaltiesData.homePenGoals} -{' '}
                    {penaltiesData.awayPenGoals})!
                  </div>
                )}
              </div>

              {/* Team-by-team Kick Circles */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  { club: home, kicks: homePenKicks, score: livePenHomeScore },
                  { club: away, kicks: awayPenKicks, score: livePenAwayScore },
                ].map(({ club, kicks, score }) => (
                  <div
                    key={club.id}
                    className={`rounded-xl border p-3.5 ${
                      club.isUser
                        ? 'border-emerald-500/50 bg-emerald-950/20'
                        : 'border-slate-800 bg-slate-900/70'
                    }`}
                  >
                    <div className="mb-2.5 flex items-center justify-between">
                      <span className="text-sm font-extrabold text-white">
                        {club.name}
                      </span>
                      <span className="font-display text-2xl font-black text-white tabular-nums">
                        {score}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {Array.from(
                        { length: Math.max(5, kicks.length) },
                        (_, idx) => {
                          const k = kicks[idx];
                          if (!k) {
                            return (
                              <div
                                key={`${club.id}-slot-${idx}`}
                                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-slate-950 text-xs font-bold text-slate-600"
                              >
                                {idx + 1}
                              </div>
                            );
                          }
                          return (
                            <div
                              key={`${club.id}-kick-${idx}`}
                              title={`${k.round}번 키커 ${k.kickerName}: ${k.scored ? '성공' : '실축'}`}
                              className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm font-black shadow ${
                                k.scored
                                  ? 'border-emerald-400 bg-emerald-500/25 text-emerald-300'
                                  : 'border-rose-400 bg-rose-500/25 text-rose-300'
                              }`}
                            >
                              {k.scored ? '⚽' : '❌'}
                            </div>
                          );
                        },
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Latest Kicker Broadcast Ticker */}
              {latestPenKick && (
                <div
                  className={`rounded-xl border px-4 py-3 text-center text-sm font-bold ${
                    latestPenKick.scored
                      ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-200'
                      : 'border-rose-500/40 bg-rose-950/30 text-rose-200'
                  }`}
                >
                  [{latestPenKick.round}라운드 · {latestPenKick.teamShortName}]{' '}
                  <span className="text-white">{latestPenKick.kickerName}</span> —{' '}
                  {latestPenKick.scored
                    ? '⚽ 침착하게 골망을 흔듭니다!'
                    : '❌ 실축! 골키퍼가 막아냅니다!'}
                </div>
              )}

              {/* Scrollable Kick Log */}
              <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/60 p-2.5 text-xs space-y-1">
                {[...revealedKicks].reverse().map((k, idx) => (
                  <div
                    key={`pk-log-${k.round}-${k.teamId}-${idx}`}
                    className="flex items-center justify-between border-b border-slate-800/50 pb-1 last:border-0"
                  >
                    <span className="text-slate-300">
                      <span className="font-mono text-slate-500 mr-1.5">
                        #{k.round}
                      </span>
                      <span className="font-bold text-slate-200">
                        [{k.teamShortName}] {k.kickerName}
                      </span>
                    </span>
                    <span
                      className={`font-bold ${
                        k.scored ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {k.scored ? '⚽ 성공' : '❌ 실축'} ({k.homeScoreAfter}-
                      {k.awayScoreAfter})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FULL-TIME MOM BANNER */}
          {isSecondHalfDone && fullResult && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/35 bg-amber-950/20 px-4 py-2.5">
              <div className="flex items-center gap-2 text-xs">
                <Star className="w-4 h-4 text-amber-300 fill-current" />
                <span className="font-bold text-amber-200">
                  경기 최우수 선수 (MOM): {fullResult.momPlayerName} ({fullResult.momRating.toFixed(1)})
                </span>
              </div>
              <button
                type="button"
                onClick={() => commitLiveMatch()}
                className="rounded-lg bg-emerald-500 px-4 py-1.5 text-xs font-extrabold text-slate-950 hover:bg-emerald-400 cursor-pointer"
              >
                {override?.commitButtonLabel ?? '라운드 결과 확정 →'}
              </button>
            </div>
          )}

          {/* LIVE LAYOUT: Mobile stacks Pitch -> Commentary (one-screen!) -> Compact Stamina; Desktop preserves 8+4 columns */}
          {(phase === 'first_half' ||
            phase === 'second_half' ||
            phase === 'extra_time' ||
            phase === 'extra_time_2') && (
            <div className="grid grid-cols-1 gap-2 sm:gap-3 lg:grid-cols-12 items-start">
              {/* 1) 2D Pitch */}
              <div className="lg:col-span-8">
                <PitchMatch2D
                  homeClub={home}
                  awayClub={away}
                  homeFormation={liveHomeFormation}
                  awayFormation={liveAwayFormation}
                  minute={minute}
                  phase={pitchPhase}
                  isFullTime={isSecondHalfDone}
                  speed={speed}
                  homePossession={liveHomePoss}
                  homeShots={liveHomeShots}
                  awayShots={liveAwayShots}
                  homeXg={liveHomeXg}
                  awayXg={liveAwayXg}
                  homeTactic={fullResult?.homeTactic ?? halftime.homeTactic}
                  awayTactic={fullResult?.awayTactic ?? halftime.awayTactic}
                  dramaticEvent={dramaticEvent}
                />
              </div>

              {/* 2) Live Commentary: directly below 2D pitch on mobile, right column on desktop */}
              <div className="lg:col-span-4 lg:row-span-2 rounded-xl border border-slate-800 bg-[#0b1018] p-2 sm:p-3 flex flex-col">
                <div className="mb-1.5 flex items-center justify-between text-[11px] sm:text-xs shrink-0">
                  <span className="font-bold text-slate-200">실시간 중계</span>
                  <span className="text-[10px] sm:text-[11px] text-slate-500 tabular-nums">
                    {visibleEvents.length}건
                  </span>
                </div>
                <div className="max-h-28 sm:max-h-44 lg:max-h-[420px] space-y-1 sm:space-y-1.5 overflow-y-auto pr-1 text-[11px] sm:text-xs">
                  {[...visibleEvents].reverse().map((ev, idx) => {
                    const evClub = clubsById[ev.teamId];
                    return (
                      <div
                        key={`${ev.minute}-${ev.type}-${idx}`}
                        className={`flex items-start gap-1.5 sm:gap-2 rounded-lg px-2 py-1 sm:px-2.5 sm:py-2 ${
                          ev.type === 'goal'
                            ? ev.teamId === myTeamId
                              ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-100 font-semibold'
                              : 'bg-rose-500/12 border border-rose-500/25 text-rose-100 font-semibold'
                            : ev.type === 'var_offside'
                              ? 'bg-purple-500/15 border border-purple-400/40 text-purple-100 font-semibold'
                              : ev.type === 'save'
                                ? 'bg-sky-500/10 text-sky-200'
                                : ev.type === 'yellow'
                                  ? 'bg-amber-500/10 text-amber-200'
                                  : ev.type === 'sub'
                                    ? 'bg-sky-950/60 border border-sky-500/30 text-sky-200 font-semibold'
                                    : 'bg-[#111822]/70 text-slate-400'
                        }`}
                      >
                        <span className="w-6 sm:w-7 shrink-0 font-display text-[10px] sm:text-[11px] font-bold text-slate-400 tabular-nums">
                          {ev.minute}&apos;
                        </span>
                        <div className="flex flex-wrap items-center gap-1 min-w-0">
                          {evClub &&
                            ev.type !== 'halftime' &&
                            ev.type !== 'fulltime' &&
                            ev.type !== 'kickoff' && (
                              <ClubTag
                                shortName={evClub.shortName}
                                primaryColor={evClub.primaryColor}
                                isUserTeam={evClub.id === myTeamId}
                              />
                            )}
                          <span className="leading-snug text-[11px]">
                            {ev.description}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 3) Compact Live Starter Stamina Strip */}
              <div className="lg:col-span-8 rounded-xl border border-slate-800 bg-[#0b1018] p-2 sm:p-2.5 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-1.5 text-[10px] sm:text-[11px]">
                  <span className="inline-flex items-center gap-1 font-bold text-slate-200">
                    <Activity className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400" />
                    선발 체력 ({TACTICS[userActiveTactic].shortName})
                  </span>
                  <div className="hidden sm:flex items-center gap-2 text-[10px] text-slate-400">
                    <span>70%↑ 정상</span>
                    <span className="text-yellow-300">55~69% -1.5</span>
                    <span className="text-orange-300">40~54% -3.5</span>
                    <span className="text-rose-400">40%↓ -6.0</span>
                  </div>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-4 lg:grid-cols-6 gap-1 sm:gap-1.5 tabular-nums">
                  {starterStaminaRows.map((row) => {
                    if (!row.player) return null;
                    return (
                      <div
                        key={`live-stam-${row.index}`}
                        className={`rounded-lg border px-1.5 py-1 sm:px-2 ${
                          row.staminaPct < 40
                            ? 'border-rose-500/45 bg-rose-950/20'
                            : row.staminaPct < 55
                              ? 'border-orange-500/35 bg-orange-950/15'
                              : 'border-slate-800 bg-[#111822]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-0.5 text-[9px] sm:text-[10px]">
                          <span className="font-bold text-slate-400">
                            {row.slotLabel}
                          </span>
                          <span
                            className={`font-extrabold ${getStaminaTextColor(row.staminaPct)}`}
                          >
                            {row.staminaPct}%
                          </span>
                        </div>
                        <div className="truncate text-[9px] sm:text-[10px] font-bold text-slate-100">
                          {row.player.name}
                          {row.isFreshSub && (
                            <span className="ml-0.5 text-[8px] font-black text-sky-300">
                              IN
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-slate-900">
                          <div
                            className={`h-full rounded-full transition-all duration-200 ${getStaminaBarColor(row.staminaPct)}`}
                            style={{ width: `${row.staminaPct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* UNIFIED LOCKER ROOM PANEL (45' Halftime, 90' Extra Time Break, 105' ET Halftime) */}
          {isLockerPhase && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              <div className="lg:col-span-6 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-10 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-[#111822]">
                      <PixelManagerAvatar
                        avatar={state.manager.avatar}
                        clubPrimaryColor={state.userClub.primaryColor}
                        clubSecondaryColor={state.userClub.secondaryColor}
                        size={28}
                      />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-white">
                        {state.manager.name} 감독 ·{' '}
                        {phase === 'halftime'
                          ? '하프타임 라커룸'
                          : phase === 'extra_time_break'
                            ? "90' 연장전 돌입 라커룸"
                            : "105' 연장 하프타임 라커룸"}
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        {isEtBreakPhase
                          ? '연장 특별 교체(+1장 · 최대 6명) · 전술/포메이션 수정 · PK 대비'
                          : '전술 수정 · 선발 스왑 · 후반 교체 지시'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setShowTacticsGuide(true)}
                      className="inline-flex items-center gap-1 rounded-md border border-sky-500/35 bg-sky-500/10 px-2 py-1 text-[10px] font-bold text-sky-200 hover:bg-sky-500/20 cursor-pointer"
                    >
                      <BookOpen className="w-3 h-3" />
                      상성 도감
                    </button>
                    {isWizard && activeTrait && (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                        <Sparkles className="w-3 h-3" />
                        {activeTrait.name} 1.5x
                      </span>
                    )}
                  </div>
                </div>

                {/* Assistant Coach Tactical Analysis + Recommended Subs (HT or ET Briefing) */}
                <div className="rounded-xl border border-amber-500/30 bg-amber-950/15 p-3 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                      <Lightbulb className="w-3.5 h-3.5" />
                      {isEtBreakPhase && extraTimeBriefing
                        ? extraTimeBriefing.headline
                        : '수석코치 전반 분석 & 추천 교체'}
                    </div>
                    <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-200">
                      상대: {TACTICS[oppTactic].shortName} · {oppFormation}
                    </span>
                  </div>

                  {isEtBreakPhase && extraTimeBriefing ? (
                    <div className="space-y-2">
                      <ul className="space-y-1 text-xs leading-relaxed text-slate-200">
                        {extraTimeBriefing.adviceLines.map((line, i) => (
                          <li key={`et-adv-${i}`} className="flex items-start gap-1.5">
                            <span className="text-amber-300 shrink-0">•</span>
                            <span>{line}</span>
                          </li>
                        ))}
                      </ul>

                      {extraTimeBriefing.exhaustedPlayers.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[10px] font-bold text-rose-300">
                            체력 방전 주의:
                          </span>
                          {extraTimeBriefing.exhaustedPlayers.slice(0, 4).map((ep) => (
                            <span
                              key={`exh-${ep.name}`}
                              className="rounded border border-rose-500/35 bg-rose-950/40 px-1.5 py-0.5 text-[10px] font-bold text-rose-200 tabular-nums"
                            >
                              {ep.name} {ep.staminaPct}%
                            </span>
                          ))}
                        </div>
                      )}

                      {extraTimeBriefing.recommendedPkKickers.length > 0 && (
                        <div className="rounded-lg border border-purple-500/25 bg-purple-950/20 px-2.5 py-1.5">
                          <div className="text-[10px] font-bold text-purple-200 mb-1">
                            🎯 승부차기 예상 최우선 키커 TOP 5 (결정력·OVR 기준)
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {extraTimeBriefing.recommendedPkKickers.map((k, idx) => (
                              <span
                                key={`pk-rec-${k.name}-${idx}`}
                                className="rounded bg-slate-900/90 border border-slate-700/80 px-1.5 py-0.5 text-[10px] text-slate-200 tabular-nums"
                              >
                                <span className="text-purple-300 font-bold mr-1">
                                  {idx + 1}.
                                </span>
                                {k.name}{' '}
                                <span className="text-slate-400">ATT {k.att}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs leading-relaxed text-slate-300">
                      {halftime.tacticalHint}
                    </p>
                  )}

                  {coachRecommendations.length > 0 ? (
                    <div className="space-y-2 pt-1 border-t border-amber-500/20">
                      {coachRecommendations.map((rec) => {
                        const inStyle = rec.inPlayer.playstyles[0]
                          ? PLAYSTYLES[rec.inPlayer.playstyles[0]]?.shortName
                          : null;
                        return (
                          <div
                            key={rec.id}
                            className="rounded-lg border border-slate-700/80 bg-[#0b1018]/90 p-2.5 space-y-1.5"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-1.5">
                              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                                <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-extrabold text-sky-200">
                                  {rec.badge}
                                </span>
                                <span className="font-bold text-rose-300 line-through">
                                  {rec.outPlayer.name} ({rec.outStaminaPct}%)
                                </span>
                                <span className="text-slate-500">→</span>
                                <span className="font-extrabold text-emerald-300">
                                  {rec.inPlayer.name} ({rec.inPlayer.ovr})
                                </span>
                                {inStyle && (
                                  <span className="rounded border border-emerald-500/25 bg-emerald-500/10 px-1 py-0.5 text-[9px] font-bold text-emerald-200">
                                    {inStyle}
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                disabled={subsRemaining <= 0}
                                onClick={() =>
                                  handleApplyCoachRecommendation(
                                    rec.starterIndex,
                                    rec.benchIndex,
                                  )
                                }
                                className="inline-flex items-center gap-1 rounded-md bg-emerald-500 px-2.5 py-1 text-[10px] font-extrabold text-slate-950 hover:bg-emerald-400 disabled:opacity-40 cursor-pointer"
                              >
                                <UserCheck className="w-3 h-3" />
                                추천 적용
                              </button>
                            </div>
                            <p className="text-[11px] leading-relaxed text-slate-300">
                              {rec.reason}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="pt-1 border-t border-amber-500/20 text-[11px] text-slate-400">
                      {subsRemaining <= 0
                        ? `교체 카드 ${maxSubsAllowed}장을 모두 사용했습니다. 선발 포지션 스왑과 전술 조정으로 승부를 걸어보세요.`
                        : isEtBreakPhase
                          ? '우측 피치보드에서 선발 ↔ 벤치를 클릭/드래그해 연장 승부수를 직접 투입할 수 있습니다.'
                          : '현재 선발 11명의 체력과 상성이 양호합니다. 후반 흐름을 보며 60분 이후 교체를 활용해도 좋습니다.'}
                    </div>
                  )}
                </div>

                {/* Tactic & Formation Controls (Unified v5.0 Engine UI — consistent with Pre-Match) */}
                <div className="rounded-xl border border-slate-800 bg-[#0b1018] p-3.5 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs">
                    <span className="inline-flex items-center gap-1.5 font-bold text-white">
                      <Compass className="w-3.5 h-3.5 text-emerald-400" />
                      {phase === 'halftime'
                        ? '후반전 전술'
                        : phase === 'extra_time_break'
                          ? '연장 전반 전술'
                          : '연장 후반 전술'}
                      <span className="text-[11px] font-medium text-slate-400">
                        (전반 상대: {TACTICS[oppTactic].shortName} · {oppManager.name}{' '}
                        <span className="font-bold text-amber-300 tabular-nums">
                          {oppManager.ovr}
                        </span>
                        )
                      </span>
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 tabular-nums">
                      {TACTICS[selectedTactic].name} · {htTacticFits[selectedTactic]}%
                    </span>
                  </div>

                  {/* Unified 1-Line Fit % + 5-Zone Summary + Interactive ? Help */}
                  <UnifiedTacticsStrip matchup={htUnifiedMatchup} isHalftime />

                  <div className="grid grid-cols-5 gap-1">
                    {TACTIC_LIST.map((t) => {
                      const active = selectedTactic === t.id;
                      const fitPct = htTacticFits[t.id];
                      const isRec = halftime.recommendedTactic === t.id;
                      const htLocked = Boolean(override?.waitingForOpponentLabel);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          disabled={htLocked}
                          onClick={() => {
                            if (!htLocked) setSelectedTactic(t.id);
                          }}
                          title={`${t.name} (현재 라인업 완성도 ${fitPct}%)`}
                          className={`relative min-w-0 rounded-lg border py-1.5 px-1 text-center transition-colors ${
                            htLocked ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
                          } ${
                            active
                              ? 'border-emerald-400/60 bg-emerald-500/18 text-white font-extrabold'
                              : 'bg-[#111822] text-slate-400 border-slate-800 hover:border-slate-600 hover:text-slate-200 font-bold'
                          }`}
                        >
                          <div className="truncate text-[10px] sm:text-[11px] leading-tight">
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
                          {isRec && !active && (
                            <span className="absolute -top-1.5 right-0.5 rounded border border-amber-400/45 bg-amber-500/20 px-1 text-[8px] font-bold text-amber-300">
                              추천
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="pt-2 border-t border-slate-800 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs">
                      <span className="font-bold text-white">
                        {isEtBreakPhase ? '연장 포메이션' : '후반 포메이션'}{' '}
                        <span className="text-[11px] font-medium text-slate-400">
                          (전반 상대:{' '}
                          {oppFormation === '4-4-2-diamond'
                            ? '4-4-2◇'
                            : oppFormation === '3-5-2-dm'
                              ? '3-5-2 DM'
                              : oppFormation}
                          )
                        </span>
                      </span>
                      <button
                        type="button"
                        disabled={Boolean(override?.waitingForOpponentLabel)}
                        onClick={handleHalftimeQuickBestXi}
                        title="현재 그라운드의 선발 11명(교체 아웃 선수 제외)을 선택한 포메이션에 맞춰 최적 포지션으로 자동 재배치합니다"
                        className="inline-flex items-center gap-1 rounded-md border border-emerald-500/45 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer transition-colors"
                      >
                        <Wand2 className="w-3 h-3" />
                        빠른 선발
                      </button>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-1">
                      {FORMATION_LIST.map((f) => {
                        const htLocked = Boolean(override?.waitingForOpponentLabel);
                        return (
                          <button
                            key={f.id}
                            type="button"
                            disabled={htLocked}
                            title={f.name}
                            onClick={() => {
                              if (!htLocked) changeFormation(f.id);
                            }}
                            className={`rounded-lg border py-1.5 px-1 text-[10px] sm:text-[11px] font-bold truncate transition-colors ${
                              htLocked ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
                            } ${
                              state.formation === f.id
                                ? 'border-sky-400/55 bg-sky-500/18 text-white'
                                : 'bg-[#111822] text-slate-400 border-slate-800 hover:border-slate-600 hover:text-slate-200'
                            }`}
                          >
                            {f.id === '4-4-2-diamond'
                              ? '4-4-2◇'
                              : f.id === '3-5-2-dm'
                                ? '3-5-2 DM'
                                : f.id}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {htNotice && (
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-500/35 bg-emerald-950/20 px-3 py-2 text-[11px] font-semibold text-emerald-200">
                    <span>✓ {htNotice}</span>
                    <button
                      type="button"
                      onClick={() => setHtNotice(null)}
                      className="text-slate-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <div className="rounded-xl border border-slate-800/90 bg-[#0b1018] px-3 py-2 text-[11px] text-slate-400">
                  💡 <strong className="text-sky-300">선발 ↔ 선발</strong> 클릭/드래그는 교체 차감 없이 즉시 위치 변경되며,{' '}
                  <strong className="text-emerald-300">선발 ↔ 벤치</strong> 교체는 실수 방지를 위해 확인창을 거칩니다. 경기 종료 후 원래 선발로 자동 복원됩니다.
                </div>

                {override?.waitingForOpponentLabel ? (
                  <div className="flex w-full items-center justify-center gap-2 rounded-xl border border-sky-500/40 bg-sky-950/35 py-3 text-sm font-extrabold text-sky-200">
                    <span className="h-2.5 w-2.5 rounded-full bg-sky-400 animate-pulse" />
                    {override.waitingForOpponentLabel}
                  </div>
                ) : (
                  <button
                    id={
                      phase === 'halftime'
                        ? 'start-second-half-btn'
                        : phase === 'extra_time_break'
                          ? 'start-extra-time-btn'
                          : 'start-et-second-half-btn'
                    }
                    type="button"
                    onClick={
                      phase === 'halftime'
                        ? handleStartSecondHalf
                        : phase === 'extra_time_break'
                          ? handleStartExtraTime
                          : handleStartEtSecondHalf
                    }
                    className={`inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-extrabold text-slate-950 cursor-pointer ${
                      isEtBreakPhase
                        ? 'bg-amber-400 hover:bg-amber-300'
                        : 'bg-emerald-500 hover:bg-emerald-400'
                    }`}
                  >
                    <Play className="w-4 h-4 fill-current" />
                    {phase === 'halftime'
                      ? "후반전 46' → 90' 중계 시작"
                      : phase === 'extra_time_break'
                        ? "연장 전반 91' → 105' 중계 시작"
                        : "연장 후반 106' → 120' 중계 시작"}
                  </button>
                )}
              </div>

              <div className="lg:col-span-6 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-slate-300">
                    <ArrowLeftRight className="w-3.5 h-3.5 text-emerald-400" />
                    선수 교체 ({subsUsed} / {maxSubsAllowed}명
                    {isEtBreakPhase ? ' · 연장 +1' : ''}) · 선발끼리 자유 스왑 가능
                  </span>
                  {swapPick && (
                    <button
                      type="button"
                      onClick={() => setSwapPick(null)}
                      className="text-amber-300 hover:underline cursor-pointer"
                    >
                      취소
                    </button>
                  )}
                </div>
                <PitchBoard
                  formation={state.formation}
                  starters={state.starters}
                  bench={state.bench}
                  chemistry={chemistry}
                  managerTraitId={state.manager.traitId}
                  selectedSlot={override?.waitingForOpponentLabel ? null : swapPick}
                  staminaByPlayerId={staminaByPlayerId}
                  disabledBenchIds={subbedOutIdSet}
                  onSlotClick={
                    override?.waitingForOpponentLabel ? undefined : handleSlotClick
                  }
                  onSlotSwap={
                    override?.waitingForOpponentLabel ? undefined : performHalftimeSwap
                  }
                  onInspectPlayer={(player, slotSubPosition) =>
                    setInspected({ player, slotSubPosition })
                  }
                  showBench
                  showChemBreakdown={false}
                  compact
                />
              </div>
            </div>
          )}

          {/* Commentary fallback for penalties phase */}
          {phase === 'penalties' && (
            <div className="rounded-xl border border-slate-800 bg-[#0b1018] p-3">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="font-bold text-slate-300">경기 주요 기록</span>
                <span className="text-[11px] text-slate-500 tabular-nums">
                  {visibleEvents.length}개 이벤트
                </span>
              </div>
              <div className="max-h-36 space-y-1 overflow-y-auto pr-1 text-xs">
                {[...visibleEvents].reverse().map((ev, idx) => {
                  const evClub = clubsById[ev.teamId];
                  return (
                    <div
                      key={`${ev.minute}-${ev.type}-${idx}`}
                      className="flex items-start gap-2 rounded-lg bg-[#111822]/70 px-2.5 py-1.5 text-[11px] text-slate-300"
                    >
                      <span className="w-7 shrink-0 font-display font-bold text-slate-500 tabular-nums">
                        {ev.minute}&apos;
                      </span>
                      {evClub && ev.type !== 'halftime' && ev.type !== 'fulltime' && ev.type !== 'kickoff' && (
                        <ClubTag
                          shortName={evClub.shortName}
                          primaryColor={evClub.primaryColor}
                          isUserTeam={evClub.id === myTeamId}
                        />
                      )}
                      <span>{ev.description}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Locker Room Bench Substitution Safety Confirmation Modal (HT & ET) */}
      {pendingHtSubConfirm && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-amber-500/45 bg-[#101824] p-5 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300 border border-amber-500/30">
                <AlertTriangle className="w-5 h-5" />
              </span>
              <div>
                <h4 className="text-sm font-black text-white">
                  선수 교체를 확정할까요?
                </h4>
                <p className="mt-1 text-xs leading-relaxed text-slate-300">
                  <strong className="text-rose-300">
                    {pendingHtSubConfirm.outPlayer.name}
                  </strong>{' '}
                  선수를 빼고{' '}
                  <strong className="text-emerald-300">
                    {pendingHtSubConfirm.inPlayer.name}
                  </strong>{' '}
                  선수를 투입합니다.
                </p>
                <p className="mt-1 text-[11px] font-semibold text-amber-300/90">
                  교체 아웃된 선수는 이번 경기에 다시 출전할 수 없습니다. (교체 {subsUsed + 1}/{maxSubsAllowed})
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-2.5">
                <div className="text-[10px] font-bold text-rose-300">
                  OUT · {pendingHtSubConfirm.slotLabel}
                </div>
                <div className="mt-0.5 font-extrabold text-white truncate">
                  {pendingHtSubConfirm.outPlayer.name}
                </div>
                <div className="mt-1 text-[11px] text-slate-400 tabular-nums">
                  OVR {pendingHtSubConfirm.outPlayer.ovr} · 체력{' '}
                  {staminaByPlayerId[pendingHtSubConfirm.outPlayer.id] ?? 75}%
                </div>
              </div>
              <div className="rounded-xl border border-emerald-500/35 bg-emerald-950/20 p-2.5">
                <div className="text-[10px] font-bold text-emerald-300">
                  IN · 벤치 투입
                </div>
                <div className="mt-0.5 font-extrabold text-white truncate">
                  {pendingHtSubConfirm.inPlayer.name}
                </div>
                <div className="mt-1 text-[11px] text-emerald-200/90 tabular-nums">
                  OVR {pendingHtSubConfirm.inPlayer.ovr} · 체력 100%
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPendingHtSubConfirm(null)}
                className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-bold text-slate-300 hover:text-white cursor-pointer"
              >
                취소
              </button>
              <button
                id="confirm-halftime-sub-btn"
                type="button"
                onClick={confirmPendingHalftimeSub}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-extrabold text-slate-950 hover:bg-emerald-400 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                교체 확정
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live 2nd-Half Substitution Pause Overlay (Full Formation PitchBoard + Live Stamina Bars!) */}
      {liveSubOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/88 p-3 sm:p-5 backdrop-blur-sm">
          <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-sky-500/45 bg-[#0f1621] shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 bg-[#0a0f17] px-5 py-3.5">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-sky-400 px-2 py-0.5 text-[10px] font-black text-slate-950">
                    {minute}&apos; 일시정지
                  </span>
                  <span className="text-xs font-bold text-slate-300">
                    남은 교체 기회 {subsRemaining - pendingLiveSubs.length} / {MAX_MATCH_SUBS}명
                  </span>
                </div>
                <h3 className="mt-1 text-sm font-extrabold text-white">
                  선발끼리 클릭·드래그로 위치 변경 (교체 차감 없음) · 벤치와 교체
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPendingLiveSubs([]);
                  setLiveSubPick(null);
                  setLiveSubOpen(false);
                }}
                className="rounded-lg border border-slate-700 bg-slate-900 p-1.5 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto p-4 sm:p-5 space-y-3">
              {/* Stamina Legend + Auto-restore notice */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-[#0b1018] px-3 py-2 text-[10px] text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-300 font-bold">70%↑ 정상</span>
                  <span className="text-yellow-300">55~69% -1.5</span>
                  <span className="text-orange-300">40~54% -3.5</span>
                  <span className="text-rose-400 font-bold">40%↓ -6.0</span>
                </div>
                <span>선발끼리 자유 스왑 가능 · 경기 종료 후 원래 라인업 복원</span>
              </div>

              {(pendingLiveSubs.length > 0 || hasDraftLineupChanges) && (
                <div className="rounded-xl border border-emerald-500/35 bg-emerald-950/20 p-3 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-emerald-300">
                    <span>
                      {pendingLiveSubs.length > 0
                        ? `대기 중인 교체 (${pendingLiveSubs.length}명)`
                        : '선발 포지션 위치 변경 대기 중'}
                    </span>
                    {hasDraftLineupChanges && pendingLiveSubs.length === 0 && (
                      <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] text-sky-200">
                        교체 횟수 차감 없음
                      </span>
                    )}
                  </div>
                  {pendingLiveSubs.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {pendingLiveSubs.map((sub, idx) => (
                        <span
                          key={`${sub.outPlayerId}-${sub.inPlayerId}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-[#0b1018] px-2.5 py-1 text-xs"
                        >
                          <span className="text-rose-300 line-through">
                            {sub.outPlayerName}
                          </span>
                          <span className="text-slate-500">→</span>
                          <span className="font-bold text-emerald-300">
                            {sub.inPlayerName}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemovePendingSub(idx)}
                            className="ml-1 text-slate-500 hover:text-rose-400 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <PitchBoard
                formation={state.formation}
                starters={draftStarters}
                bench={draftBench}
                chemistry={draftChemistry}
                managerTraitId={state.manager.traitId}
                selectedSlot={liveSubPick}
                staminaByPlayerId={staminaByPlayerId}
                disabledBenchIds={draftDisabledBenchIds}
                onSlotClick={handleDraftSlotClick}
                onSlotSwap={performDraftLiveSubSwap}
                onInspectPlayer={(player, slotSubPosition) =>
                  setInspected({ player, slotSubPosition })
                }
                showBench
                showChemBreakdown={false}
                compact
              />
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-800 bg-[#0a0f17] px-5 py-3">
              <button
                type="button"
                onClick={() => {
                  setPendingLiveSubs([]);
                  setLiveSubPick(null);
                  setLiveSubOpen(false);
                }}
                className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-bold text-slate-300 hover:text-white cursor-pointer"
              >
                취소 · 경기 재개
              </button>
              <button
                type="button"
                disabled={pendingLiveSubs.length === 0 && !hasDraftLineupChanges}
                onClick={handleConfirmLiveSubs}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-extrabold text-slate-950 hover:bg-emerald-400 disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
              >
                <Check className="w-4 h-4" />
                {pendingLiveSubs.length > 0
                  ? `교체 확정 (${pendingLiveSubs.length}명) · 경기 재개`
                  : '포지션 변경 적용 · 경기 재개'}
              </button>
            </div>
          </div>
        </div>
      )}

      <PlayerDetailModal
        player={inspected?.player ?? null}
        slotSubPosition={inspected?.slotSubPosition}
        managerTraitId={state.manager.traitId}
        slotSynergy={
          inspected
            ? (() => {
                const idx = state.starters.findIndex(
                  (p) => p?.id === inspected.player.id,
                );
                return idx >= 0 ? chemistry.slotSynergies?.[idx] ?? null : null;
              })()
            : null
        }
        seasonStats={
          inspected
            ? allStats[inspected.player.id] ??
              allStats[`user::${inspected.player.id}`] ??
              null
            : null
        }
        onClose={() => setInspected(null)}
      />

      <TacticsGuideModal
        open={showTacticsGuide}
        onClose={() => setShowTacticsGuide(false)}
      />
    </div>
  );
}
