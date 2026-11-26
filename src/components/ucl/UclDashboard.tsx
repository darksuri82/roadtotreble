import {
  Award,
  FastForward,
  Play,
  Radio,
  Shield,
  Sparkles,
  Trophy,
  Tv,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FORMATION_LIST } from '../../data/formations';
import { MANAGER_TRAITS } from '../../data/managerTraits';
import { ModalBodyLock } from '../../hooks/useBodyScrollLock';
import {
  computeFullPlayerOvrBreakdown,
  getInjuryTooltip,
  getMoraleLabel,
  getMoraleTier,
  isPlayerActivelyInjured,
} from '../../engine/conditionEngine';
import { didUserWinCup } from '../../engine/cupEngine';
import { USER_CLUB_ID } from '../../engine/matchEngine';
import { formatMainPositions } from '../../engine/positionEngine';
import { getUserRank } from '../../engine/standingsEngine';
import { TACTIC_LIST } from '../../engine/tacticEngine';
import {
  didUserWinUcl,
  findNextUserUclLeaguePhaseFixture,
  getUserKnockoutFixtureInfo,
  getUserUclResultLabel,
  UCL_STAGE_LABELS,
} from '../../engine/uclEngine';
import { useGame } from '../../store/GameContext';
import type {
  Club,
  MatchResult,
  PlayerSeasonStats,
  TacticId,
} from '../../types/league';
import type { MpCastLive, MpCastMatch } from '../../types/mpLeague';
import type { Player, SubPosition } from '../../types/player';
import type {
  UclKnockoutStage,
  UclKnockoutTie,
  UclPhaseStage,
  UclTournamentState,
} from '../../types/ucl';
import {
  buildPlayerCompetitionBreakdown,
  getPlayerNationalityMeta,
  resolveClubRoster,
  resolvePlayerById,
} from '../../utils/playerLookup';
import { ClubSquadModal } from '../common/ClubSquadModal';
import { CompactLiveStandings } from '../common/CompactLiveStandings';
import { CountryFlagSvg } from '../common/CountryFlagSvg';
import { InfoHelpButton } from '../common/InfoHelpButton';
import { JerseySvg } from '../common/JerseySvg';
import { ManagerTraitBadgeCard } from '../common/ManagerTraitBadgeCard';
import { MatchDetailModal } from '../common/MatchDetailModal';
import { PenaltyShootoutVisual } from '../common/PenaltyShootoutVisual';
import { PitchBoard, type SlotRef } from '../common/PitchBoard';
import { PixelStatusIcon } from '../common/PixelStatusIcon';
import { PixelTrophySvg } from '../common/PixelTrophySvg';
import { PlayerDetailModal } from '../common/PlayerDetailModal';
import { PlayerNameButton } from '../common/PlayerNameButton';
import { matchResultToCastMatch } from '../common/SoloLiveScoreboard';
import type { SoloLiveDurationMs } from '../common/SoloLiveScoreboard';
import { StaffCoachBadge } from '../common/StaffCoachBadge';
import {
  LiveMatchBroadcast,
  shouldRenderLiveMatchBroadcast,
} from '../league/LiveMatchBroadcast';
import { MatchDayTacticsRoom } from '../league/MatchDayTacticsRoom';
import { TransferMarketModal } from '../transfer/TransferMarketModal';
import { UclBracketTree, type LiveTieOverlay } from './UclBracketTree';
import { UclLeaguePhaseFastSimModal } from './UclLeaguePhaseFastSimModal';
import { UclLeaguePhaseStandingsModal } from './UclLeaguePhaseStandingsModal';
import {
  UclMilestoneModal,
  type UclMilestoneStage,
} from './UclMilestoneModal';
import {
  UclMulticastPopupBoard,
  type SoloUclCastProgress,
} from './UclMulticastPopupBoard';

type UclTab = 'match' | 'standings' | 'bracket' | 'stats' | 'squad';
type SoloUclAutoMode = 'lp' | 'ko_user' | 'ko_spectate';

interface SettledCastHold {
  cast: MpCastLive;
  mode: SoloUclAutoMode;
  playedStage: UclPhaseStage;
  playedLeg: 1 | 2;
  tieId?: string;
}

interface SpectatePrevSnap {
  stage: UclKnockoutStage;
  knockoutLeg: 1 | 2;
  ties: Record<UclKnockoutStage, UclKnockoutTie[]>;
  championTeamId: string | null;
}

const LP_NEXT_ROUND_COUNTDOWN_MS = 1100;

function isUclKoStage(stage: UclPhaseStage): stage is UclKnockoutStage {
  return (
    stage === 'playoff' ||
    stage === 'r16' ||
    stage === 'qf' ||
    stage === 'sf' ||
    stage === 'final'
  );
}

function buildSoloCastMatch(
  result: MatchResult,
  label: string,
  options?: {
    aggHomeBefore?: number;
    aggAwayBefore?: number;
    tieId?: string;
    winnerId?: string | null;
    isKnockoutDecider?: boolean;
  },
): MpCastMatch {
  const base = matchResultToCastMatch(result, label, USER_CLUB_ID);
  const aggH = (options?.aggHomeBefore ?? 0) + result.homeGoals;
  const aggA = (options?.aggAwayBefore ?? 0) + result.awayGoals;
  let winnerId: string | null = options?.winnerId ?? base.winnerId ?? null;
  if (!winnerId && options?.isKnockoutDecider) {
    if (result.extraTime?.winnerTeamId) {
      winnerId = result.extraTime.winnerTeamId;
    } else if (aggH > aggA) {
      winnerId = result.homeTeamId;
    } else if (aggA > aggH) {
      winnerId = result.awayTeamId;
    }
  }
  return {
    ...base,
    aggHomeBefore: options?.aggHomeBefore,
    aggAwayBefore: options?.aggAwayBefore,
    tieId: options?.tieId,
    winnerId,
  };
}

export function UclDashboard() {
  const {
    state,
    activeTactic,
    chemistry,
    ratings,
    setSoloTickerPlaying,
    changeFormation,
    autoOptimizeLineup,
    setDefaultTactic,
    setNextMatchTactic,
    swapSquadPositions,
    startLiveMatch,
    startSoloStreamMatch,
    cancelSoloStreamMatch,
    abortStreamAndStartLive2D,
    commitLiveMatch,
    simulateSingleMatchInstant,
    simulateUclPlayoffBye,
    simulateUclToEnd,
    finishUclToSummary,
  } = useGame();

  const [tab, setTab] = useState<UclTab>('match');
  const [showLpSummary, setShowLpSummary] = useState(false);
  const [lpFastSimOpen, setLpFastSimOpen] = useState(false);
  const [lpStandingsModalOpen, setLpStandingsModalOpen] = useState(false);
  const [skipResultModalOpen, setSkipResultModalOpen] = useState(false);
  const [pendingMilestone, setPendingMilestone] =
    useState<UclMilestoneStage | null>(null);
  const [swapPick, setSwapPick] = useState<SlotRef | null>(null);
  const [inspected, setInspected] = useState<{
    player: Player;
    slotSubPosition?: SubPosition;
    fallbackStats?: PlayerSeasonStats | null;
  } | null>(null);
  const [inspectedMatch, setInspectedMatch] = useState<MatchResult | null>(null);
  const [inspectedTie, setInspectedTie] = useState<UclKnockoutTie | null>(null);
  const [inspectedClub, setInspectedClub] = useState<Club | null>(null);

  // Unified Solo UCL Popup Auto-Advance (League Phase + Knockout 1-leg boundary + Spectate)
  const [autoPopupMode, setAutoPopupMode] = useState<SoloUclAutoMode | null>(null);
  const [liveAutoUserPaused, setLiveAutoUserPaused] = useState(false);
  const [liveAutoDurationMs, setLiveAutoDurationMs] =
    useState<SoloLiveDurationMs>(5000);
  const [settledCastHold, setSettledCastHold] = useState<SettledCastHold | null>(null);
  const [lpNextRoundRemainingMs, setLpNextRoundRemainingMs] = useState<number | null>(null);
  const [spectateCast, setSpectateCast] = useState<{
    cast: MpCastLive;
    prevSnap: SpectatePrevSnap;
  } | null>(null);
  const [spectateSettled, setSpectateSettled] = useState(false);
  const [liveOverlays, setLiveOverlays] = useState<Record<string, LiveTieOverlay>>({});

  const committedCastKeyRef = useRef<string | null>(null);
  const pendingSpectateSnapRef = useRef<SpectatePrevSnap | null>(null);

  const season = state.season;
  const ucl = season?.ucl ?? null;

  const streamHalftime = season?.liveHalftime?.streamAutoMode
    ? season.liveHalftime
    : null;
  const liveTickerPlaying = Boolean(
    streamHalftime || (autoPopupMode === 'ko_spectate' && spectateCast && !spectateSettled),
  );

  useEffect(() => {
    const handleGoToTactics = () => {
      setLiveAutoUserPaused(true);
      setTab('squad');
      window.setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 60);
    };
    window.addEventListener('rtt:go-to-tactics', handleGoToTactics);
    return () => {
      window.removeEventListener('rtt:go-to-tactics', handleGoToTactics);
    };
  }, []);

  const isTransferOpen = Boolean(season?.transferMarket.isOpen);
  const hasPendingStaffCoach = Boolean(
    season?.staffCoach?.pendingSelection &&
      season.staffCoach.offeredCoachIds.length > 0,
  );
  const hasPendingInjury = Boolean(
    season?.pendingInjuryAlerts && season.pendingInjuryAlerts.length > 0,
  );
  const hasPendingAwakening = Boolean(
    season?.pendingAwakeningAlerts && season.pendingAwakeningAlerts.length > 0,
  );
  const hasPendingAdaptation = Boolean(
    season?.tacticalAdaptation?.pendingAlert,
  );
  const hasPendingEvent = Boolean(
    season?.managerEvents?.activeEvent || season?.managerEvents?.lastResolution,
  );
  const hasActive2DBroadcast = Boolean(
    season?.liveHalftime && !season.liveHalftime.streamAutoMode,
  );

  // Keep global soloTickerPlaying synced ONLY while a live clock is actively streaming (blocks spoilers before FT)
  useEffect(() => {
    setSoloTickerPlaying(liveTickerPlaying);
  }, [liveTickerPlaying, setSoloTickerPlaying]);

  // Auto-pause League Phase loop if an injury alert arrives so user confirms resume intentionally
  useEffect(() => {
    if (autoPopupMode !== 'lp' || !hasPendingInjury) return;
    const t = window.setTimeout(() => setLiveAutoUserPaused(true), 0);
    return () => window.clearTimeout(t);
  }, [autoPopupMode, hasPendingInjury]);

  useEffect(() => {
    return () => {
      setSoloTickerPlaying(false);
    };
  }, [setSoloTickerPlaying]);

  // Build live MpCastLive from uncommitted solo stream preview
  const streamCast = useMemo<MpCastLive | null>(() => {
    if (!streamHalftime?.fullMatchResult) return null;
    const label =
      streamHalftime.competitionLabel ||
      (ucl?.stage === 'league_phase'
        ? `UCL 리그 페이즈 ${streamHalftime.round}R`
        : 'UEFA 챔피언스리그');
    const activeKoInfo =
      ucl && isUclKoStage(ucl.stage)
        ? getUserKnockoutFixtureInfo(ucl, USER_CLUB_ID)
        : null;
    const match = buildSoloCastMatch(streamHalftime.fullMatchResult, label, {
      aggHomeBefore: streamHalftime.aggHomeBeforeMatch,
      aggAwayBefore: streamHalftime.aggAwayBeforeMatch,
      tieId: activeKoInfo?.tie.id,
      isKnockoutDecider: streamHalftime.isKnockoutDecider,
    });
    return {
      key: `solo-ucl-cast:${streamHalftime.fixtureId}`,
      title: label,
      matches: [match],
    };
  }, [streamHalftime, ucl]);

  // Resolve spectated 1-leg knockout cast immediately after simulateSingleMatchInstant updates ucl
  useEffect(() => {
    const snap = pendingSpectateSnapRef.current;
    if (!snap || !ucl) return;
    const tiesAfter = ucl.ties[snap.stage] ?? [];
    const prevTieById = new Map(
      (snap.ties[snap.stage] ?? []).map((t) => [t.id, t]),
    );
    const stageLabel = UCL_STAGE_LABELS[snap.stage];
    const title =
      snap.stage === 'final'
        ? `UCL ${stageLabel}`
        : `UCL ${stageLabel} ${snap.knockoutLeg}차전`;
    const matches: MpCastMatch[] = [];
    for (const tie of tiesAfter) {
      const res =
        snap.stage === 'final' || snap.knockoutLeg === 1 ? tie.leg1 : tie.leg2;
      if (!res) continue;
      const prev = prevTieById.get(tie.id);
      const isDecider = snap.stage === 'final' || snap.knockoutLeg === 2;
      matches.push(
        buildSoloCastMatch(res, title, {
          aggHomeBefore:
            snap.stage !== 'final' && snap.knockoutLeg === 2
              ? (prev?.aggTeamA ?? 0)
              : undefined,
          aggAwayBefore:
            snap.stage !== 'final' && snap.knockoutLeg === 2
              ? (prev?.aggTeamB ?? 0)
              : undefined,
          tieId: tie.id,
          winnerId: isDecider ? tie.winnerId : null,
          isKnockoutDecider: isDecider,
        }),
      );
    }
    pendingSpectateSnapRef.current = null;
    const castKey = `solo-ucl-spectate:${snap.stage}:leg${snap.knockoutLeg}:${matches.map((m) => m.key).join('|')}`;
    const timer = window.setTimeout(() => {
      if (matches.length === 0) {
        setAutoPopupMode(null);
        setSpectateCast(null);
        setSpectateSettled(false);
        return;
      }
      setSpectateCast({
        cast: { key: castKey, title, matches },
        prevSnap: snap,
      });
      setSpectateSettled(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [ucl]);

  const activePopupCast: MpCastLive | null = useMemo(() => {
    if (!autoPopupMode) return null;
    if (autoPopupMode === 'ko_spectate') {
      return spectateCast?.cast ?? null;
    }
    return streamCast ?? settledCastHold?.cast ?? null;
  }, [autoPopupMode, spectateCast, streamCast, settledCastHold]);

  const isPopupBlockedByOtherModal =
    hasPendingStaffCoach ||
    isTransferOpen ||
    hasPendingInjury ||
    hasPendingAwakening ||
    hasPendingAdaptation ||
    hasPendingEvent ||
    hasActive2DBroadcast ||
    lpFastSimOpen;

  const uclAutoPopupVisible = Boolean(
    autoPopupMode && activePopupCast && !isPopupBlockedByOtherModal,
  );

  const canPlayNextUserLpMatch = Boolean(
    season &&
      ucl &&
      !ucl.completed &&
      !ucl.userEliminatedAt &&
      ucl.stage === 'league_phase' &&
      ucl.leaguePhaseRound < 8,
  );

  const canPlayNextUserKoMatch = Boolean(
    season &&
      ucl &&
      !ucl.completed &&
      !ucl.userEliminatedAt &&
      isUclKoStage(ucl.stage) &&
      getUserKnockoutFixtureInfo(ucl, USER_CLUB_ID),
  );

  const stopUclLiveAuto = useCallback(() => {
    pendingSpectateSnapRef.current = null;
    setAutoPopupMode(null);
    setLiveAutoUserPaused(false);
    setSettledCastHold(null);
    setLpNextRoundRemainingMs(null);
    setSpectateCast(null);
    setSpectateSettled(false);
    setLiveOverlays({});
    cancelSoloStreamMatch();
    setSoloTickerPlaying(false);
  }, [cancelSoloStreamMatch, setSoloTickerPlaying]);

  const startLpAutoSim = useCallback(() => {
    if (!canPlayNextUserLpMatch) return;
    setLiveAutoUserPaused(false);
    setSettledCastHold(null);
    setLpNextRoundRemainingMs(null);
    setSpectateCast(null);
    setSpectateSettled(false);
    setAutoPopupMode('lp');
    startSoloStreamMatch();
  }, [canPlayNextUserLpMatch, startSoloStreamMatch]);

  const startKoAutoSimSingleLeg = useCallback(() => {
    if (!ucl || ucl.completed || !isUclKoStage(ucl.stage)) return;
    setLiveAutoUserPaused(false);
    setSettledCastHold(null);
    setLpNextRoundRemainingMs(null);
    setLiveOverlays({});
    // User alive and playing in this knockout leg
    if (!ucl.userEliminatedAt && getUserKnockoutFixtureInfo(ucl, USER_CLUB_ID)) {
      setSpectateCast(null);
      setSpectateSettled(false);
      setAutoPopupMode('ko_user');
      startSoloStreamMatch();
      return;
    }
    // User eliminated or Top-8 Playoff bye: spectate 1 leg of the current knockout stage
    pendingSpectateSnapRef.current = {
      stage: ucl.stage,
      knockoutLeg: ucl.stage === 'final' ? 1 : ucl.knockoutLeg,
      ties: ucl.ties,
      championTeamId: ucl.championTeamId,
    };
    setSpectateCast(null);
    setSpectateSettled(false);
    setAutoPopupMode('ko_spectate');
    simulateSingleMatchInstant();
  }, [ucl, startSoloStreamMatch, simulateSingleMatchInstant]);

  const handleCastSettled = useCallback(
    (castKey: string) => {
      if (autoPopupMode === 'ko_spectate') {
        setSpectateSettled(true);
        return;
      }
      if (!ucl || !streamCast || streamCast.key !== castKey) return;
      // Atomic idempotency guard: never double-commit the same match
      if (committedCastKeyRef.current === castKey) return;
      committedCastKeyRef.current = castKey;

      const playedStage = ucl.stage;
      const playedLeg: 1 | 2 =
        playedStage === 'final' ? 1 : ucl.knockoutLeg;
      const activeKoInfo = isUclKoStage(playedStage)
        ? getUserKnockoutFixtureInfo(ucl, USER_CLUB_ID)
        : null;
      const mode: SoloUclAutoMode =
        autoPopupMode ?? (playedStage === 'league_phase' ? 'lp' : 'ko_user');

      setSettledCastHold({
        cast: streamCast,
        mode,
        playedStage,
        playedLeg,
        tieId: activeKoInfo?.tie.id,
      });

      commitLiveMatch();

      if (mode === 'lp' && playedStage === 'league_phase' && ucl.leaguePhaseRound + 1 < 8) {
        setLpNextRoundRemainingMs(LP_NEXT_ROUND_COUNTDOWN_MS);
      } else {
        setLpNextRoundRemainingMs(null);
      }
    },
    [autoPopupMode, ucl, streamCast, commitLiveMatch],
  );

  // League Phase round-to-round countdown (pauses cleanly when liveAutoUserPaused or popup blocked)
  useEffect(() => {
    if (
      autoPopupMode !== 'lp' ||
      lpNextRoundRemainingMs === null ||
      liveAutoUserPaused ||
      isPopupBlockedByOtherModal ||
      Boolean(streamHalftime)
    ) {
      return;
    }
    if (!canPlayNextUserLpMatch) {
      const clearT = window.setTimeout(() => setLpNextRoundRemainingMs(null), 0);
      return () => window.clearTimeout(clearT);
    }
    if (lpNextRoundRemainingMs <= 0) {
      const launchT = window.setTimeout(() => {
        setLpNextRoundRemainingMs(null);
        setSettledCastHold(null);
        startSoloStreamMatch();
      }, 0);
      return () => window.clearTimeout(launchT);
    }
    const tickT = window.setTimeout(() => {
      setLpNextRoundRemainingMs((prev) =>
        prev === null ? null : Math.max(0, prev - 100),
      );
    }, 100);
    return () => window.clearTimeout(tickT);
  }, [
    autoPopupMode,
    lpNextRoundRemainingMs,
    liveAutoUserPaused,
    isPopupBlockedByOtherModal,
    streamHalftime,
    canPlayNextUserLpMatch,
    startSoloStreamMatch,
  ]);

  const handleStopAndDirectPlay = useCallback(
    (snapshot: SoloUclCastProgress) => {
      const curKey = activePopupCast?.key ?? null;
      const alreadyCommitted = Boolean(
        snapshot.settled ||
          settledCastHold !== null ||
          (curKey && committedCastKeyRef.current === curKey),
      );
      pendingSpectateSnapRef.current = null;
      setAutoPopupMode(null);
      setLiveAutoUserPaused(false);
      setSettledCastHold(null);
      setLpNextRoundRemainingMs(null);
      setSpectateCast(null);
      setSpectateSettled(false);
      setLiveOverlays({});
      setPendingMilestone((prev) => (prev === 'champion' ? prev : null));
      setSoloTickerPlaying(false);

      if (!alreadyCommitted) {
        // Atomically abort uncommitted auto-sim preview and start a clean 2D live broadcast
        abortStreamAndStartLive2D();
      } else if (canPlayNextUserLpMatch || canPlayNextUserKoMatch) {
        // Previous match already committed: jump directly into the next match's 2D live broadcast
        startLiveMatch();
      }
    },
    [
      activePopupCast,
      settledCastHold,
      canPlayNextUserLpMatch,
      canPlayNextUserKoMatch,
      abortStreamAndStartLive2D,
      startLiveMatch,
      setSoloTickerPlaying,
    ],
  );

  const handleQuickSkipFromLpPopup = useCallback(() => {
    stopUclLiveAuto();
    setShowLpSummary(true);
    setLpFastSimOpen(true);
  }, [stopUclLiveAuto]);

  const handleCastLiveOverlays = useCallback(
    (overlays: Record<string, LiveTieOverlay>) => {
      setLiveOverlays(overlays);
    },
    [],
  );

  const prevLpRoundRef = useRef<number>(ucl?.leaguePhaseRound ?? 0);
  useEffect(() => {
    if (!ucl) return;
    const prevRound = prevLpRoundRef.current;
    const currRound = ucl.leaguePhaseRound;
    if (prevRound < 8 && currRound >= 8) {
      prevLpRoundRef.current = currRound;
      const t = window.setTimeout(() => {
        setShowLpSummary(true);
        setLpStandingsModalOpen(true);
      }, 0);
      return () => window.clearTimeout(t);
    }
    if (prevRound !== currRound) {
      prevLpRoundRef.current = currRound;
    }
  }, [ucl]);

  const prevStageRef = useRef<UclTournamentState['stage'] | null>(
    ucl?.stage ?? null,
  );
  useEffect(() => {
    if (!ucl) return;
    const prev = prevStageRef.current;
    const curr = ucl.stage;
    if (prev !== curr) {
      prevStageRef.current = curr;
      if (!ucl.userEliminatedAt) {
        let nextMs: UclMilestoneStage | null = null;
        if (
          curr === 'r16' ||
          curr === 'qf' ||
          curr === 'sf' ||
          curr === 'final'
        ) {
          nextMs = curr;
        } else if (curr === 'completed' && ucl.championTeamId === USER_CLUB_ID) {
          nextMs = 'champion';
        }
        if (nextMs) {
          const target = nextMs;
          const t = window.setTimeout(() => setPendingMilestone(target), 0);
          return () => window.clearTimeout(t);
        }
      }
    }
  }, [ucl]);

  const openPlayerById = (
    playerId: string,
    fallbackStats?: PlayerSeasonStats | null,
  ) => {
    const resolved = resolvePlayerById({
      playerId,
      starters: state.starters,
      bench: state.bench,
      season,
      fallbackStats,
    });
    if (resolved) {
      setInspected({ player: resolved, fallbackStats: fallbackStats ?? null });
    }
  };

  const clubsById = useMemo<Record<string, Club>>(() => {
    if (!ucl) return {};
    return Object.fromEntries(ucl.clubs.map((c) => [c.id, c]));
  }, [ucl]);

  const teamEntryById = useMemo(() => {
    if (!ucl) return {};
    return Object.fromEntries(ucl.teams.map((t) => [t.club.id, t]));
  }, [ucl]);

  const uclLeaders = useMemo(() => {
    if (!season) return { scorers: [], assisters: [], ratings: [] };
    const list = Object.values(season.uclPlayerStats).filter(
      (s) => s.appearances > 0,
    );
    return {
      scorers: [...list]
        .sort((a, b) => b.goals - a.goals || b.assists - a.assists)
        .slice(0, 12),
      assisters: [...list]
        .sort((a, b) => b.assists - a.assists || b.goals - a.goals)
        .slice(0, 12),
      ratings: [...list]
        .filter((s) => s.appearances >= 2)
        .sort((a, b) => b.avgRating - a.avgRating || b.goals - a.goals)
        .slice(0, 12),
    };
  }, [season]);

  if (!season || !ucl) return null;

  const userUclRank = getUserRank(ucl.standings, USER_CLUB_ID);
  const userWonUcl = didUserWinUcl(ucl, USER_CLUB_ID);
  const userWonLeague = getUserRank(season.standings, USER_CLUB_ID) === 1;
  const userWonCup = didUserWinCup(season.cup, USER_CLUB_ID);
  const isUserTreble = userWonLeague && userWonCup && userWonUcl;
  const championClub = ucl.championTeamId ? clubsById[ucl.championTeamId] : null;
  const userEliminated = Boolean(ucl.userEliminatedAt);

  const nextLeaguePhaseFixture =
    ucl.stage === 'league_phase'
      ? findNextUserUclLeaguePhaseFixture(ucl, USER_CLUB_ID)
      : null;
  const nextKnockoutInfo =
    ucl.stage !== 'special_transfer' &&
    ucl.stage !== 'league_phase' &&
    ucl.stage !== 'completed'
      ? getUserKnockoutFixtureInfo(ucl, USER_CLUB_ID)
      : null;

  const nextFixture = nextLeaguePhaseFixture ?? nextKnockoutInfo?.fixture ?? null;
  const nextHome = nextFixture ? clubsById[nextFixture.homeTeamId] : null;
  const nextAway = nextFixture ? clubsById[nextFixture.awayTeamId] : null;
  const isUserNextMatch = Boolean(nextFixture && !userEliminated && !ucl.completed);

  const handleSquadSlotClick = (area: 'starter' | 'bench', index: number) => {
    if (!swapPick) {
      setSwapPick({ area, index });
      return;
    }
    if (swapPick.area === area && swapPick.index === index) {
      setSwapPick(null);
      return;
    }
    swapSquadPositions(swapPick, { area, index });
    setSwapPick(null);
  };

  const inspectedBreakdown = inspected
    ? buildPlayerCompetitionBreakdown(
        inspected.player.id,
        season,
        inspected.fallbackStats,
      )
    : null;

  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-6 py-5 space-y-5">
      {/* UCL Special Transfer Window Modal */}
      {season.transferMarket.isOpen && !hasPendingStaffCoach && <TransferMarketModal />}

      {/* Live Match Broadcast Modal (reuses full 2D pitch + Slow-Mo + Stamina + ET/PK!) */}
      {shouldRenderLiveMatchBroadcast(season.liveHalftime) && (
        <LiveMatchBroadcast clubsById={clubsById} />
      )}

      {/* UCL League Phase Animated Fast-Sim Modal */}
      <UclLeaguePhaseFastSimModal
        open={lpFastSimOpen}
        clubsById={clubsById}
        onSelectMatch={(m) => {
          setInspectedTie(null);
          setInspectedMatch(m);
        }}
        onFinishAndOpenStandings={() => {
          setLpFastSimOpen(false);
          setLpStandingsModalOpen(true);
        }}
        onClose={() => setLpFastSimOpen(false)}
      />

      {/* UCL 36-Team League Phase Standings Popup Modal */}
      {lpStandingsModalOpen &&
        !lpFastSimOpen &&
        !skipResultModalOpen &&
        !uclAutoPopupVisible &&
        !liveTickerPlaying &&
        !season.liveHalftime &&
        !season.transferMarket.isOpen && (
          <UclLeaguePhaseStandingsModal
            ucl={ucl}
            clubsById={clubsById}
            teamEntryById={teamEntryById}
            onInspectClub={(c) => setInspectedClub(c)}
            onGoToBracket={() => setTab('bracket')}
            onClose={() => setLpStandingsModalOpen(false)}
          />
        )}

      {/* UCL Knockout Round Advancement & Grand Champion Celebration Modal */}
      {pendingMilestone &&
        !lpFastSimOpen &&
        !lpStandingsModalOpen &&
        !skipResultModalOpen &&
        !uclAutoPopupVisible &&
        !liveTickerPlaying &&
        !season.liveHalftime &&
        !season.transferMarket.isOpen && (
          <UclMilestoneModal
            milestone={pendingMilestone}
            ucl={ucl}
            leagueId={season.leagueId}
            userClub={state.userClub}
            managerName={state.manager.name}
            managerAvatar={state.manager.avatar}
            clubsById={clubsById}
            uclPlayerStats={season.uclPlayerStats}
            isTreble={isUserTreble}
            onClose={() => setPendingMilestone(null)}
            onGoToSummary={
              pendingMilestone === 'champion' ? finishUclToSummary : undefined
            }
          />
        )}

      {/* Club Squad Modal */}
      <ClubSquadModal
        club={inspectedClub}
        roster={
          inspectedClub
            ? resolveClubRoster({
                clubId: inspectedClub.id,
                club: inspectedClub,
                season,
                userStarters: state.starters,
                userBench: state.bench,
              })
            : []
        }
        statsMap={season.uclPlayerStats}
        conditionMap={season.playerConditions}
        onSelectPlayer={(player) => {
          setInspectedClub(null);
          setInspected({ player });
        }}
        onClose={() => setInspectedClub(null)}
      />

      {/* Match / Tie Detail Modal */}
      <MatchDetailModal
        key={inspectedTie?.id ?? inspectedMatch?.fixtureId ?? 'ucl-detail'}
        match={inspectedMatch}
        tie={inspectedTie}
        clubsById={clubsById}
        onSelectPlayer={(playerId) => openPlayerById(playerId)}
        onClose={() => {
          setInspectedMatch(null);
          setInspectedTie(null);
        }}
      />

      {/* Player Inspector */}
      {inspected && (
        <PlayerDetailModal
          player={inspected.player}
          slotSubPosition={inspected.slotSubPosition}
          slotSynergy={
            Object.values(chemistry.slotSynergies).find(
              (s) => s.playerId === inspected.player.id,
            ) ?? null
          }
          managerTraitId={state.manager.traitId}
          seasonStats={inspectedBreakdown?.total ?? null}
          competitionStats={inspectedBreakdown}
          condition={season.playerConditions?.[inspected.player.id] ?? null}
          onClose={() => setInspected(null)}
        />
      )}

      {/* Modern Phase 2 UCL Header */}
      <div className="rounded-2xl border border-slate-800/90 bg-[#0d1422] p-3.5 sm:p-5 shadow-xl">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl border border-sky-400/30 bg-sky-500/12 text-sky-300">
              <Trophy className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded bg-sky-500/15 px-2 py-0.5 text-[10px] font-extrabold tracking-wider text-sky-300">
                  UCL · 36 TEAMS
                </span>
                <span className="rounded bg-slate-800/80 px-2 py-0.5 text-[10px] font-bold text-slate-300">
                  {UCL_STAGE_LABELS[ucl.stage]}
                  {ucl.stage === 'league_phase'
                    ? ` ${ucl.leaguePhaseRound}/8R`
                    : ucl.stage !== 'special_transfer' &&
                        ucl.stage !== 'completed' &&
                        ucl.stage !== 'final'
                      ? ` · ${ucl.knockoutLeg}차전`
                      : ''}
                </span>
                <InfoHelpButton
                  title="챔피언스리그 진행 방식"
                  align="left"
                  guideTab="legacy"
                  items={[
                    '리그 페이즈 8경기: 1~8위 16강 직행 · 9~24위 플레이오프 · 25~36위 탈락',
                    '토너먼트(PO~4강): 홈·원정 2차전 합산 스코어 (매 차전·강 경계마다 계속 진행 확인 · 동률 시 연장/PK)',
                    '결승전: 단판 승부 (무승부 시 연장/PK) · 자동진행 중 일시중지 및 직접 2D 전환 지원',
                  ]}
                />
              </div>
              <h1 className="mt-1 truncate text-base sm:text-xl font-black text-white">
                {state.userClub.name} 챔피언스리그
              </h1>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 shrink-0 tabular-nums">
            <button
              type="button"
              onClick={() => setLpStandingsModalOpen(true)}
              title="클릭하여 36팀 리그 페이즈 순위표 팝업 열기"
              className="rounded-xl border border-slate-800 bg-[#090e18] px-2.5 py-2 text-center sm:px-3.5 hover:border-sky-400/50 transition-colors cursor-pointer"
            >
              <div className="text-[10px] text-slate-400">리그 페이즈 ↗</div>
              <div className="font-mono text-xs sm:text-sm font-black text-sky-300">
                {ucl.leaguePhaseRound > 0
                  ? `${ucl.userLeaguePhaseRank ?? userUclRank}위/36`
                  : '순위표'}
              </div>
            </button>
            <div className="rounded-xl border border-slate-800 bg-[#090e18] px-2.5 py-2 text-center sm:px-3.5">
              <div className="text-[10px] text-slate-400">현재 성적</div>
              <div className="truncate text-xs sm:text-sm font-black text-amber-300">
                {getUserUclResultLabel(ucl, USER_CLUB_ID)}
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#090e18] px-2.5 py-2 text-center sm:px-3.5">
              <div className="text-[10px] text-slate-400">팀 전력</div>
              <div className="font-mono text-xs sm:text-sm font-black text-emerald-300">
                {ratings.ovr} · {chemistry.total}
              </div>
              {season.staffCoach?.hiredCoachId && (
                <div className="mt-1">
                  <StaffCoachBadge
                    coachId={season.staffCoach.hiredCoachId}
                    activeTactic={activeTactic}
                    compact
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Clean Unified Navigation Tabs */}
        <div className="mt-3.5 grid grid-cols-5 gap-1 rounded-xl border border-slate-800/90 bg-[#090e18] p-1">
          {(
            [
              ['match', '경기'],
              ['standings', '리그페이즈 순위'],
              ['bracket', '대진표'],
              ['stats', '개인기록'],
              ['squad', '스쿼드'],
            ] as [UclTab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-lg px-2 py-2 text-[11px] sm:text-xs font-bold transition-colors cursor-pointer touch-manipulation truncate ${
                tab === id
                  ? 'bg-slate-800 text-white border border-sky-400/50 shadow-sm'
                  : 'text-slate-400 border border-transparent hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Unified Centered UCL Auto-Advance Popup Modal (Shared Design + PK Visual + Solo Pause/Takeover + Boundary Confirmation) */}
      {uclAutoPopupVisible &&
        activePopupCast &&
        (() => {
          const isKoBoundarySettled =
            (autoPopupMode === 'ko_user' && Boolean(settledCastHold)) ||
            (autoPopupMode === 'ko_spectate' && spectateSettled);
          const isLpCompletedSettled =
            autoPopupMode === 'lp' &&
            Boolean(settledCastHold) &&
            ucl.leaguePhaseRound >= 8;

          const canDirectTakeoverNow = Boolean(
            !userEliminated &&
              autoPopupMode !== 'ko_spectate' &&
              (!settledCastHold || canPlayNextUserLpMatch || canPlayNextUserKoMatch),
          );

          const lpCountdownLabel =
            autoPopupMode === 'lp' && lpNextRoundRemainingMs !== null
              ? liveAutoUserPaused
                ? `다음 라운드 일시중지 (${(lpNextRoundRemainingMs / 1000).toFixed(1)}s)`
                : `다음 라운드 ${(lpNextRoundRemainingMs / 1000).toFixed(1)}s`
              : null;

          // Build compact footer slot inside the modal panel
          let popupFooter: React.ReactNode = null;

          if (autoPopupMode === 'lp') {
            const uRow = ucl.standings.find((r) => r.teamId === USER_CLUB_ID);
            const rank = ucl.userLeaguePhaseRank ?? userUclRank;
            const zoneCls =
              rank <= 8
                ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
                : rank <= 24
                  ? 'border-amber-400/40 bg-amber-500/15 text-amber-200'
                  : 'border-rose-400/40 bg-rose-500/15 text-rose-200';
            const zoneText =
              rank <= 8 ? '16강 직행권' : rank <= 24 ? '플레이오프권' : '탈락권';

            popupFooter = (
              <div className="border-t border-slate-800 bg-[#080f1d] px-3.5 py-2.5 sm:px-4 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-bold text-slate-400">
                      리그 페이즈 {ucl.leaguePhaseRound}/8R
                    </span>
                    <span className="font-mono font-black text-white">
                      {rank}위 / 36팀
                    </span>
                    <span className={`rounded border px-1.5 py-0.5 text-[10px] font-extrabold ${zoneCls}`}>
                      {zoneText}
                    </span>
                  </div>
                  {uRow && (
                    <span className="font-mono text-[11px] font-bold text-sky-200">
                      {uRow.points}점 ({uRow.won}승 {uRow.drawn}무 {uRow.lost}패 · 득실{' '}
                      {uRow.goalDifference >= 0 ? `+${uRow.goalDifference}` : uRow.goalDifference})
                    </span>
                  )}
                </div>

                {isLpCompletedSettled && (
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-1 border-t border-slate-800/80">
                    <button
                      type="button"
                      onClick={() => {
                        setLpStandingsModalOpen(false);
                        stopUclLiveAuto();
                      }}
                      className="rounded-xl border border-slate-700 bg-[#101826] px-3.5 py-2 text-xs font-bold text-slate-300 hover:text-white cursor-pointer touch-manipulation"
                    >
                      대시보드로
                    </button>
                    <button
                      id="solo-ucl-lp-done-standings-btn"
                      type="button"
                      onClick={() => {
                        stopUclLiveAuto();
                        setLpStandingsModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black text-slate-950 hover:bg-emerald-400 cursor-pointer touch-manipulation"
                    >
                      <Trophy className="h-3.5 w-3.5" />
                      36팀 최종 순위표 확인 →
                    </button>
                  </div>
                )}
              </div>
            );
          } else if (isKoBoundarySettled) {
            const playedStage: UclPhaseStage =
              settledCastHold?.playedStage ??
              spectateCast?.prevSnap.stage ??
              ucl.stage;
            const playedLeg: 1 | 2 =
              settledCastHold?.playedLeg ??
              spectateCast?.prevSnap.knockoutLeg ??
              1;
            const matchedTie =
              settledCastHold?.tieId && isUclKoStage(playedStage)
                ? (ucl.ties[playedStage]?.find(
                    (t) => t.id === settledCastHold.tieId,
                  ) ?? null)
                : null;
            const userInTie = Boolean(
              matchedTie &&
                (matchedTie.teamAId === USER_CLUB_ID ||
                  matchedTie.teamBId === USER_CLUB_ID),
            );
            const userIsA = matchedTie?.teamAId === USER_CLUB_ID;
            const userAgg = matchedTie
              ? userIsA
                ? matchedTie.aggTeamA
                : matchedTie.aggTeamB
              : 0;
            const oppAgg = matchedTie
              ? userIsA
                ? matchedTie.aggTeamB
                : matchedTie.aggTeamA
              : 0;
            const nextStepLabel = ucl.completed
              ? '결승 완료'
              : ucl.stage === 'final'
                ? '결승전'
                : isUclKoStage(ucl.stage)
                  ? `${UCL_STAGE_LABELS[ucl.stage]} ${ucl.knockoutLeg}차전`
                  : UCL_STAGE_LABELS[ucl.stage];
            const nextOppClub = (() => {
              if (!nextKnockoutInfo) return null;
              const oppId =
                nextKnockoutInfo.tie.teamAId === USER_CLUB_ID
                  ? nextKnockoutInfo.tie.teamBId
                  : nextKnockoutInfo.tie.teamAId;
              return clubsById[oppId] ?? null;
            })();
            const isPlayoffByeWaiting = Boolean(
              !userEliminated &&
                !ucl.completed &&
                ucl.stage === 'playoff' &&
                !nextKnockoutInfo,
            );

            let boundaryBadgeText = `${UCL_STAGE_LABELS[playedStage]} ${
              playedStage === 'final' ? '종료' : `${playedLeg}차전 종료`
            }`;
            let boundaryBadgeCls =
              'border-sky-400/40 bg-sky-500/15 text-sky-200';
            if (ucl.completed) {
              boundaryBadgeText = userWonUcl
                ? '🏆 UCL 우승 확정!'
                : `우승: ${championClub?.name ?? '확정'}`;
              boundaryBadgeCls = userWonUcl
                ? 'border-amber-400/55 bg-amber-500/20 text-amber-200'
                : 'border-slate-600 bg-slate-800 text-slate-200';
            } else if (userInTie && matchedTie) {
              if (matchedTie.winnerId === USER_CLUB_ID) {
                boundaryBadgeText = `다음 라운드 진출 · 합산 ${userAgg}:${oppAgg}`;
                boundaryBadgeCls =
                  'border-emerald-400/50 bg-emerald-500/20 text-emerald-200';
              } else if (matchedTie.winnerId) {
                boundaryBadgeText = `토너먼트 탈락 · 합산 ${userAgg}:${oppAgg}`;
                boundaryBadgeCls =
                  'border-rose-400/50 bg-rose-500/18 text-rose-200';
              } else {
                const diff = userAgg - oppAgg;
                boundaryBadgeText =
                  diff > 0
                    ? `1차전 종료 · 합산 ${userAgg}:${oppAgg} (+${diff} 리드)`
                    : diff < 0
                      ? `1차전 종료 · 합산 ${userAgg}:${oppAgg} (${diff} 열세)`
                      : `1차전 종료 · 합산 ${userAgg}:${oppAgg} (동률)`;
              }
            }

            popupFooter = (
              <div
                id="solo-ucl-ko-boundary-bar"
                className="border-t border-sky-500/30 bg-[#081020] px-3.5 py-3 sm:px-4 space-y-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-extrabold tabular-nums ${boundaryBadgeCls}`}
                  >
                    {boundaryBadgeText}
                  </span>
                  {!ucl.completed && (
                    <span className="text-[11px] font-bold text-slate-300">
                      다음: <strong className="text-sky-200">{nextStepLabel}</strong>
                      {nextOppClub ? ` · vs ${nextOppClub.name}` : ''}
                    </span>
                  )}
                </div>

                {ucl.completed ? (
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      id="solo-ucl-ko-finish-btn"
                      type="button"
                      onClick={stopUclLiveAuto}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-5 py-2.5 text-xs font-black text-slate-950 hover:bg-amber-300 cursor-pointer touch-manipulation"
                    >
                      <Trophy className="h-3.5 w-3.5" />
                      우승 결과 · 대시보드 확인
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      id="solo-ucl-ko-pause-dashboard-btn"
                      type="button"
                      onClick={stopUclLiveAuto}
                      className="rounded-xl border border-slate-700 bg-[#101826] px-3.5 py-2 text-xs font-bold text-slate-200 hover:border-slate-500 hover:text-white cursor-pointer touch-manipulation"
                    >
                      {userEliminated
                        ? '대시보드 · 대진표로'
                        : '잠깐 멈추기 / 전술·스쿼드 수정'}
                    </button>

                    <div className="flex flex-wrap items-center gap-2">
                      {!userEliminated && nextKnockoutInfo && (
                        <button
                          id="solo-ucl-ko-direct-2d-btn"
                          type="button"
                          onClick={() => {
                            setPendingMilestone((prev) =>
                              prev === 'champion' ? prev : null,
                            );
                            stopUclLiveAuto();
                            startLiveMatch();
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/50 bg-emerald-500/15 px-3.5 py-2 text-xs font-extrabold text-emerald-200 hover:bg-emerald-500/25 cursor-pointer touch-manipulation"
                        >
                          <Tv className="h-3.5 w-3.5" />
                          직접 2D 중계로 치르기
                        </button>
                      )}

                      {userEliminated && (
                        <button
                          id="solo-ucl-ko-skip-to-final-btn"
                          type="button"
                          onClick={() => {
                            stopUclLiveAuto();
                            simulateUclToEnd();
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-sky-400/45 bg-sky-500/15 px-3.5 py-2 text-xs font-extrabold text-sky-200 hover:bg-sky-500/25 cursor-pointer touch-manipulation"
                        >
                          <FastForward className="h-3.5 w-3.5" />
                          결승까지 빠르게 스킵
                        </button>
                      )}

                      {isPlayoffByeWaiting && (
                        <button
                          id="solo-ucl-ko-bye-skip-btn"
                          type="button"
                          onClick={() => {
                            stopUclLiveAuto();
                            simulateUclPlayoffBye();
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-sky-400/45 bg-sky-500/15 px-3.5 py-2 text-xs font-extrabold text-sky-200 hover:bg-sky-500/25 cursor-pointer touch-manipulation"
                        >
                          <FastForward className="h-3.5 w-3.5" />
                          플레이오프 스킵 → 16강
                        </button>
                      )}

                      <button
                        id="solo-ucl-ko-continue-btn"
                        type="button"
                        onClick={() => {
                          setPendingMilestone((prev) =>
                            prev === 'champion' ? prev : null,
                          );
                          startKoAutoSimSingleLeg();
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black text-slate-950 hover:bg-emerald-400 cursor-pointer touch-manipulation"
                      >
                        <Play className="h-3.5 w-3.5 fill-current" />
                        {userEliminated || isPlayoffByeWaiting
                          ? `계속 이어서 관전 (${nextStepLabel})`
                          : `계속 이어서 진행 (${nextStepLabel})`}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          }

          const bracketTiesForCast =
            autoPopupMode === 'ko_spectate' && spectateCast
              ? Object.values(spectateCast.prevSnap.ties).flat()
              : Object.values(ucl.ties).flat();

          const isActiveCastAlreadySettled = Boolean(
            (autoPopupMode === 'ko_spectate' && spectateSettled) ||
              (autoPopupMode !== 'ko_spectate' &&
                !streamCast &&
                settledCastHold !== null &&
                activePopupCast.key === settledCastHold.cast.key),
          );

          return (
            <UclMulticastPopupBoard
              cast={activePopupCast}
              clubsById={clubsById}
              myClubId={USER_CLUB_ID}
              backdropZClass="z-[60]"
              boardId="solo-ucl-multicast-board"
              bracketTies={bracketTiesForCast}
              onLiveOverlays={handleCastLiveOverlays}
              onSettled={handleCastSettled}
              initiallySettled={isActiveCastAlreadySettled}
              soloControls={{
                paused: liveAutoUserPaused,
                onTogglePause: () => setLiveAutoUserPaused((p) => !p),
                speedMs: liveAutoDurationMs,
                onChangeSpeedMs: setLiveAutoDurationMs,
                onStopAndDirectPlay: canDirectTakeoverNow
                  ? handleStopAndDirectPlay
                  : undefined,
                directPlayLabel: settledCastHold
                  ? '다음 경기 직접 2D'
                  : '중단 · 직접 2D 진행',
                onStopToDashboard: stopUclLiveAuto,
                stopLabel:
                  userEliminated || autoPopupMode === 'ko_spectate'
                    ? '자동진행 멈추기'
                    : '전술실로 중단',
                onQuickSkip:
                  autoPopupMode === 'lp' && !isLpCompletedSettled
                    ? handleQuickSkipFromLpPopup
                    : undefined,
                quickSkipLabel: '빠른 스킵',
                statusPill: lpCountdownLabel,
                hidePlaybackControls: isKoBoundarySettled || isLpCompletedSettled,
              }}
              footerSlot={popupFooter}
            />
          );
        })()}

      {/* UCL Match & Knockout Aggregate Result Popup Modal (1-Match Skip) */}
      {skipResultModalOpen &&
        season.userUclMatchHistory.length > 0 &&
        (() => {
          const lastMatch =
            season.userUclMatchHistory[season.userUclMatchHistory.length - 1];
          const homeClub = clubsById[lastMatch.homeTeamId];
          const awayClub = clubsById[lastMatch.awayTeamId];
          const isUserHome = lastMatch.homeTeamId === USER_CLUB_ID;
          const userGoals = isUserHome
            ? lastMatch.homeGoals
            : lastMatch.awayGoals;
          const oppGoals = isUserHome
            ? lastMatch.awayGoals
            : lastMatch.homeGoals;
          const pk = lastMatch.extraTime?.penalties;
          const userWonPk = pk
            ? (isUserHome && pk.winnerTeamId === lastMatch.homeTeamId) ||
              (!isUserHome && pk.winnerTeamId === lastMatch.awayTeamId)
            : false;

          // Match against all knockout ties to surface 1st-leg & Aggregate (AGG) status
          const allTies: UclKnockoutTie[] = Object.values(ucl.ties).flat();
          const matchedTie =
            allTies.find(
              (t) =>
                t.leg1?.fixtureId === lastMatch.fixtureId ||
                t.leg2?.fixtureId === lastMatch.fixtureId,
            ) ?? null;

          const isLeg1OfTwoLeg = Boolean(
            matchedTie &&
              matchedTie.stage !== 'final' &&
              matchedTie.leg1?.fixtureId === lastMatch.fixtureId &&
              !matchedTie.leg2,
          );
          const isLeg2OfTwoLeg = Boolean(
            matchedTie &&
              matchedTie.stage !== 'final' &&
              matchedTie.leg2?.fixtureId === lastMatch.fixtureId,
          );

          const outcome =
            userGoals > oppGoals || (pk && userWonPk)
              ? {
                  label: pk ? '승리 (PK)' : '승리',
                  badgeCls: 'bg-emerald-500 text-slate-950',
                  ringCls: 'border-emerald-400/55',
                }
              : userGoals < oppGoals || (pk && !userWonPk)
                ? {
                    label: pk ? '패배 (PK)' : '패배',
                    badgeCls: 'bg-rose-500 text-white',
                    ringCls: 'border-rose-400/55',
                  }
                : {
                    label: '무승부',
                    badgeCls: 'bg-slate-600 text-white',
                    ringCls: 'border-sky-400/55',
                  };

          // Tie aggregate verdict (for knockout ties)
          const tieVerdict = (() => {
            if (!matchedTie) return null;
            const userIsA = matchedTie.teamAId === USER_CLUB_ID;
            const userAgg = userIsA ? matchedTie.aggTeamA : matchedTie.aggTeamB;
            const oppAgg = userIsA ? matchedTie.aggTeamB : matchedTie.aggTeamA;
            if (matchedTie.winnerId === USER_CLUB_ID) {
              return {
                label:
                  matchedTie.stage === 'final'
                    ? '🏆 UEFA 챔피언스리그 우승!'
                    : '✅ 다음 라운드 진출 확정!',
                cls: 'border-emerald-400/50 bg-emerald-500/20 text-emerald-200',
              };
            }
            if (matchedTie.winnerId && matchedTie.winnerId !== USER_CLUB_ID) {
              return {
                label:
                  matchedTie.stage === 'final'
                    ? '🥈 준우승 · 아쉽게 우승 실패'
                    : '❌ 토너먼트 탈락',
                cls: 'border-rose-400/50 bg-rose-500/20 text-rose-200',
              };
            }
            const diff = userAgg - oppAgg;
            return {
              label:
                diff > 0
                  ? `2차전 대기 · 합산 +${diff} 리드`
                  : diff < 0
                    ? `2차전 대기 · 합산 ${diff} 열세`
                    : '2차전 대기 · 합산 동률',
              cls:
                diff > 0
                  ? 'border-sky-400/45 bg-sky-500/15 text-sky-200'
                  : diff < 0
                    ? 'border-amber-400/45 bg-amber-500/15 text-amber-200'
                    : 'border-slate-600 bg-slate-800/80 text-slate-200',
            };
          })();

          const goalEvents = lastMatch.events
            .filter((e) => e.type === 'goal')
            .slice(0, 6);

          return (
            <div
              id="ucl-skip-result-modal"
              className="modal-backdrop fixed inset-0 z-40 flex items-center justify-center bg-slate-950/85 p-3 sm:p-4"
            >
              <ModalBodyLock />
              <div
                className={`modal-panel flex w-full max-w-xl flex-col overflow-hidden rounded-2xl border bg-[#0f1724] shadow-2xl ${outcome.ringCls}`}
              >
                {/* Modal Header */}
                <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-800 bg-[#0a101a] px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs font-black ${outcome.badgeCls}`}
                    >
                      {outcome.label}
                    </span>
                    <span className="rounded bg-sky-500/15 border border-sky-400/35 px-2 py-0.5 text-[11px] font-bold text-sky-200">
                      {lastMatch.competitionLabel ?? `UCL ${lastMatch.round}R`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSkipResultModalOpen(false)}
                    className="rounded-lg border border-slate-700 bg-slate-900 p-1.5 text-slate-400 hover:text-white cursor-pointer"
                    aria-label="결과 창 닫기"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="modal-scroll flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
                  {/* Single-Match Scoreboard */}
                  <div className="grid grid-cols-3 items-center gap-2 rounded-xl border border-slate-800 bg-[#0b111b] px-3 py-4 text-center">
                    <div className="flex flex-col items-center gap-1.5 min-w-0">
                      {homeClub && (
                        <JerseySvg
                          primaryColor={homeClub.primaryColor}
                          secondaryColor={homeClub.secondaryColor}
                          pattern={homeClub.pattern}
                          label={homeClub.shortName}
                          size={42}
                        />
                      )}
                      <span
                        className={`truncate max-w-full text-xs sm:text-sm font-extrabold ${
                          isUserHome ? 'text-emerald-300' : 'text-white'
                        }`}
                      >
                        {homeClub?.name ?? lastMatch.homeTeamId}
                      </span>
                    </div>

                    <div className="flex flex-col items-center gap-1">
                      <div className="font-display text-3xl sm:text-4xl font-black tracking-wider text-amber-300 tabular-nums">
                        {lastMatch.homeGoals} <span className="text-slate-600">:</span>{' '}
                        {lastMatch.awayGoals}
                      </div>
                      {pk && (
                        <span className="rounded bg-purple-500/20 border border-purple-400/40 px-2 py-0.5 text-[11px] font-black text-purple-200 tabular-nums">
                          PK {pk.homePenGoals} : {pk.awayPenGoals}
                        </span>
                      )}
                      {lastMatch.extraTime && !pk && (
                        <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                          연장전 종료 (AET)
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col items-center gap-1.5 min-w-0">
                      {awayClub && (
                        <JerseySvg
                          primaryColor={awayClub.primaryColor}
                          secondaryColor={awayClub.secondaryColor}
                          pattern={awayClub.pattern}
                          label={awayClub.shortName}
                          size={42}
                        />
                      )}
                      <span
                        className={`truncate max-w-full text-xs sm:text-sm font-extrabold ${
                          !isUserHome ? 'text-emerald-300' : 'text-white'
                        }`}
                      >
                        {awayClub?.name ?? lastMatch.awayTeamId}
                      </span>
                    </div>
                  </div>

                  {pk && (
                    <PenaltyShootoutVisual
                      homeClub={homeClub}
                      awayClub={awayClub}
                      homeTeamId={lastMatch.homeTeamId}
                      awayTeamId={lastMatch.awayTeamId}
                      homeScore={pk.homePenGoals}
                      awayScore={pk.awayPenGoals}
                      kicks={pk.kicks}
                      revealedCount={pk.kicks.length}
                      winnerId={pk.winnerTeamId}
                      myClubId={USER_CLUB_ID}
                      inProgress={false}
                      variant="compact"
                    />
                  )}

                  {/* Prominent Knockout 1st-Leg + Aggregate Score Box */}
                  {matchedTie && (isLeg1OfTwoLeg || isLeg2OfTwoLeg || matchedTie.stage === 'final') && (() => {
                    const clubA = clubsById[matchedTie.teamAId];
                    const clubB = clubsById[matchedTie.teamBId];
                    const leg1 = matchedTie.leg1;
                    return (
                      <div className="rounded-xl border border-sky-400/45 bg-gradient-to-r from-sky-950/60 via-[#0e192b] to-indigo-950/50 p-3.5 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-black text-sky-200">
                            🏆 {UCL_STAGE_LABELS[matchedTie.stage]}{' '}
                            {matchedTie.stage === 'final'
                              ? '결승 결과'
                              : isLeg2OfTwoLeg
                                ? '최종 합산 스코어 (AGG)'
                                : '1차전 종료 · 합산 현황'}
                          </span>
                          {tieVerdict && (
                            <span
                              className={`rounded-md border px-2 py-0.5 text-[11px] font-extrabold ${tieVerdict.cls}`}
                            >
                              {tieVerdict.label}
                            </span>
                          )}
                        </div>

                        {matchedTie.stage !== 'final' && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs tabular-nums">
                            {leg1 && (
                              <div className="rounded-lg border border-slate-700/80 bg-slate-950/75 px-3 py-2 flex items-center justify-between">
                                <span className="text-[11px] font-bold text-slate-400">
                                  1차전 ({clubB?.shortName} 홈)
                                </span>
                                <span className="font-mono font-bold text-slate-200">
                                  {clubB?.shortName} {leg1.homeGoals} : {leg1.awayGoals}{' '}
                                  {clubA?.shortName}
                                </span>
                              </div>
                            )}
                            <div className="rounded-lg border border-amber-400/45 bg-amber-950/25 px-3 py-2 flex items-center justify-between">
                              <span className="text-[11px] font-bold text-amber-200">
                                합산 (AGG)
                              </span>
                              <span className="font-mono text-sm font-black text-amber-300">
                                {clubA?.shortName} {matchedTie.aggTeamA} :{' '}
                                {matchedTie.aggTeamB} {clubB?.shortName}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Scorers */}
                  {goalEvents.length > 0 && (
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5 space-y-1.5">
                      <div className="text-[11px] font-bold text-slate-400">
                        ⚽ 주요 득점 기록
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {goalEvents.map((g, i) => (
                          <span
                            key={`${g.minute}-${g.scorerName}-${i}`}
                            className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                              g.teamId === USER_CLUB_ID
                                ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200'
                                : 'border-slate-700 bg-slate-900 text-slate-200'
                            }`}
                          >
                            {g.scorerName} ({g.minute}&apos;)
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quick Match Stats */}
                  <div className="grid grid-cols-4 gap-2 text-center tabular-nums">
                    <div className="rounded-lg border border-slate-800 bg-[#101826] px-2 py-2">
                      <div className="text-[10px] text-slate-500">점유율</div>
                      <div className="text-xs font-extrabold text-white mt-0.5">
                        {lastMatch.homePossession}% : {100 - lastMatch.homePossession}%
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-[#101826] px-2 py-2">
                      <div className="text-[10px] text-slate-500">슈팅(유효)</div>
                      <div className="text-xs font-extrabold text-white mt-0.5">
                        {lastMatch.homeShots}({lastMatch.homeShotsOnTarget}) :{' '}
                        {lastMatch.awayShots}({lastMatch.awayShotsOnTarget})
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-[#101826] px-2 py-2">
                      <div className="text-[10px] text-slate-500">기대득점 xG</div>
                      <div className="text-xs font-extrabold text-sky-300 mt-0.5">
                        {lastMatch.homeXg.toFixed(1)} : {lastMatch.awayXg.toFixed(1)}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-[#101826] px-2 py-2">
                      <div className="text-[10px] text-slate-500">MOM</div>
                      <div className="truncate text-xs font-extrabold text-amber-300 mt-0.5">
                        {lastMatch.momPlayerName}
                      </div>
                    </div>
                  </div>

                  {/* Modal Footer Actions */}
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSkipResultModalOpen(false);
                        setInspectedTie(matchedTie);
                        setInspectedMatch(lastMatch);
                      }}
                      className="rounded-xl border border-sky-400/45 bg-sky-500/15 px-4 py-2.5 text-xs font-extrabold text-sky-200 hover:bg-sky-500/25 cursor-pointer"
                    >
                      상세 기록 보기
                    </button>
                    <button
                      type="button"
                      onClick={() => setSkipResultModalOpen(false)}
                      className="rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-black text-slate-950 hover:bg-emerald-400 cursor-pointer"
                    >
                      {isLeg1OfTwoLeg ? '전술 정비 · 2차전 준비' : '확인 · 계속하기'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

      {/* TAB 1: MATCH & PROGRESSION */}
      {tab === 'match' && (() => {
        const isKnockoutStage =
          ucl.stage !== 'league_phase' && ucl.stage !== 'special_transfer';
        const isLeg2Prep = Boolean(
          nextKnockoutInfo &&
            nextKnockoutInfo.tie.stage !== 'final' &&
            nextKnockoutInfo.isDecider,
        );
        const bracketUclDisplay =
          autoPopupMode === 'ko_spectate' && spectateCast && !spectateSettled
            ? {
                ...ucl,
                stage: spectateCast.prevSnap.stage,
                knockoutLeg: spectateCast.prevSnap.knockoutLeg,
                ties: spectateCast.prevSnap.ties,
                championTeamId: spectateCast.prevSnap.championTeamId,
              }
            : ucl;
        return (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div
            className={`${
              isKnockoutStage ? 'lg:col-span-12' : 'lg:col-span-8'
            } space-y-4`}
          >
            {showLpSummary && ucl.leaguePhaseRound >= 8 && !liveTickerPlaying && (() => {
              const finalRank = ucl.userLeaguePhaseRank ?? userUclRank;
              const uRow = ucl.standings.find((r) => r.teamId === USER_CLUB_ID);
              const badge =
                finalRank <= 8
                  ? { label: '16강 직행 확정!', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' }
                  : finalRank <= 24
                    ? { label: '16강 플레이오프 진출', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/40' }
                    : { label: '리그 페이즈 탈락', cls: 'bg-rose-500/20 text-rose-300 border-rose-500/40' };
              return (
                <div className="rounded-2xl border border-sky-500/35 bg-[#101929] p-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-bold text-sky-300">
                        스위스 리그 페이즈 8경기 완료
                      </span>
                      <span className={`rounded-md border px-2 py-0.5 text-[11px] font-bold ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-bold text-white">
                      최종 <span className="text-sky-300">{finalRank}위 / 36팀</span> ·{' '}
                      {uRow ? `${uRow.won}승 ${uRow.drawn}무 ${uRow.lost}패 (승점 ${uRow.points}점, 득실 ${uRow.goalDifference >= 0 ? `+${uRow.goalDifference}` : uRow.goalDifference})` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setLpStandingsModalOpen(true)}
                      className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-200 hover:text-white cursor-pointer"
                    >
                      36팀 순위표 팝업
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab('bracket')}
                      className="rounded-lg border border-sky-500/40 bg-sky-500/15 px-3 py-1.5 text-xs font-bold text-sky-200 hover:bg-sky-500/25 cursor-pointer"
                    >
                      대진표 보기
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowLpSummary(false)}
                      className="text-xs text-slate-500 hover:text-slate-300 px-1 cursor-pointer"
                    >
                      닫기
                    </button>
                  </div>
                </div>
              );
            })()}

            {ucl.completed ? (
              <div className="rounded-2xl border border-amber-400/45 bg-[#111926] p-6 text-center space-y-4">
                <div className="flex justify-center">
                  <PixelTrophySvg variant="ucl" size={76} animate />
                </div>
                <div>
                  <div className="text-xs font-bold tracking-widest text-amber-300 uppercase">
                    UEFA CHAMPIONS LEAGUE FINAL RESULT
                  </div>
                  <h2 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-white">
                    {userWonUcl
                      ? `${state.userClub.name}, 빅이어(Big Ears) 정복!`
                      : `챔피언스리그 우승: ${championClub?.name ?? '미정'}`}
                  </h2>
                  <p className="mt-1.5 text-sm text-slate-300">
                    우리 팀 최종 성적:{' '}
                    <strong className="text-sky-300">
                      {getUserUclResultLabel(ucl, USER_CLUB_ID)}
                    </strong>
                    {ucl.userLeaguePhaseRank &&
                      ` (리그 페이즈 ${ucl.userLeaguePhaseRank}위)`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={finishUclToSummary}
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-6 py-3 text-sm font-extrabold text-slate-950 shadow-lg hover:bg-amber-300 cursor-pointer"
                >
                  <Sparkles className="h-4 w-4" />
                  시즌 최종 결산 · 발롱도르 &amp; 명예의 전당 확인 →
                </button>
              </div>
            ) : isUserNextMatch && nextHome && nextAway ? (
              (() => {
                const isUserHomeUcl = nextHome.id === USER_CLUB_ID;
                const uclOpponent = isUserHomeUcl ? nextAway : nextHome;
                const uclOppEntry = teamEntryById[uclOpponent.id];
                const uclOppRoster = resolveClubRoster({
                  clubId: uclOpponent.id,
                  club: uclOpponent,
                  season,
                  userStarters: state.starters,
                  userBench: state.bench,
                });
                const firstLegBanner =
                  nextKnockoutInfo &&
                  nextKnockoutInfo.aggHomeBeforeMatch !== undefined &&
                  nextKnockoutInfo.aggAwayBeforeMatch !== undefined
                    ? {
                        stageLabel: UCL_STAGE_LABELS[nextKnockoutInfo.tie.stage],
                        homeName: nextHome.shortName,
                        awayName: nextAway.shortName,
                        homeLeg1Goals: nextKnockoutInfo.aggHomeBeforeMatch,
                        awayLeg1Goals: nextKnockoutInfo.aggAwayBeforeMatch,
                        isUserHomeLeg2: isUserHomeUcl,
                      }
                    : null;
                return (
                  <MatchDayTacticsRoom
                    opponent={uclOpponent}
                    opponentRoster={uclOppRoster}
                    opponentSubtitle={
                      uclOppEntry
                        ? `Pot ${uclOppEntry.pot} · ${uclOppEntry.originLabel}`
                        : undefined
                    }
                    isHome={isUserHomeUcl}
                    headerBadge={
                      nextKnockoutInfo
                        ? nextKnockoutInfo.competitionLabel
                        : `UCL 스위스 리그 페이즈 ${ucl.leaguePhaseRound + 1} / 8R`
                    }
                    headerAccent="ucl"
                    firstLegBanner={firstLegBanner}
                    activeTactic={activeTactic}
                    defaultTactic={season.defaultTactic}
                    formation={state.formation}
                    starters={state.starters}
                    bench={state.bench}
                    chemistry={chemistry}
                    managerTraitId={state.manager.traitId}
                    tacticalHistory={season.tacticalAdaptation?.history}
                    staffCoachId={season.staffCoach?.hiredCoachId ?? null}
                    onSelectTactic={(tId) => setNextMatchTactic(tId)}
                    onChangeFormation={changeFormation}
                    onSwapSquad={swapSquadPositions}
                    onAutoOptimize={autoOptimizeLineup}
                    onInspectPlayer={(player, slotSubPosition) =>
                      setInspected({ player, slotSubPosition })
                    }
                    onClickOpponentPlayerName={(pid) => openPlayerById(pid)}
                  >
                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          stopUclLiveAuto();
                          startLiveMatch();
                        }}
                        disabled={liveTickerPlaying}
                        className="flex-1 min-w-[200px] inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-extrabold text-slate-950 shadow-lg hover:bg-emerald-400 disabled:opacity-50 cursor-pointer touch-manipulation"
                      >
                        <Play className="h-4 w-4 fill-current" />
                        {isLeg2Prep ? '2차전 시작 (2D 중계)' : '2D 실시간 중계 시작'}
                      </button>
                      {ucl.stage === 'league_phase' && ucl.leaguePhaseRound < 8 ? (
                        <>
                          <button
                            id="ucl-lp-live-auto-btn"
                            type="button"
                            onClick={startLpAutoSim}
                            disabled={liveTickerPlaying}
                            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-sky-400/55 bg-sky-500/18 px-4 py-3 text-xs font-extrabold text-sky-100 hover:bg-sky-500/28 disabled:opacity-50 cursor-pointer touch-manipulation"
                          >
                            <Radio className="h-4 w-4 text-sky-300" />
                            자동진행
                          </button>
                          <button
                            id="ucl-lp-fastsim-btn"
                            type="button"
                            onClick={() => {
                              stopUclLiveAuto();
                              setShowLpSummary(true);
                              setLpFastSimOpen(true);
                            }}
                            disabled={liveTickerPlaying}
                            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/85 px-4 py-3 text-xs font-bold text-slate-200 hover:border-sky-400 hover:text-white disabled:opacity-50 cursor-pointer touch-manipulation"
                          >
                            <FastForward className="h-4 w-4" />
                            리그 페이즈 스킵
                          </button>
                        </>
                      ) : (
                        <button
                          id="ucl-ko-live-auto-btn"
                          type="button"
                          onClick={startKoAutoSimSingleLeg}
                          disabled={liveTickerPlaying}
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-sky-400/55 bg-sky-500/18 px-4 py-3 text-xs font-extrabold text-sky-100 hover:bg-sky-500/28 disabled:opacity-50 cursor-pointer touch-manipulation"
                        >
                          <Radio className="h-4 w-4 text-sky-300" />
                          {isLeg2Prep
                            ? '2차전 자동진행'
                            : ucl.stage === 'final'
                              ? '결승 자동진행'
                              : '1경기 자동진행'}
                        </button>
                      )}
                      <button
                        id="ucl-skip-single-match-btn"
                        type="button"
                        onClick={() => {
                          stopUclLiveAuto();
                          setSkipResultModalOpen(true);
                          simulateSingleMatchInstant();
                        }}
                        disabled={liveTickerPlaying}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-xs font-bold text-slate-200 hover:border-sky-400 hover:text-white disabled:opacity-50 cursor-pointer touch-manipulation"
                      >
                        <FastForward className="h-4 w-4" />
                        {isLeg2Prep ? '2차전 스킵' : '1경기 스킵'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          stopUclLiveAuto();
                          simulateUclToEnd();
                        }}
                        disabled={liveTickerPlaying}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-xs font-bold text-slate-300 hover:border-amber-400/60 hover:text-amber-300 disabled:opacity-50 cursor-pointer touch-manipulation"
                      >
                        대회 끝까지 스킵
                      </button>
                    </div>
                  </MatchDayTacticsRoom>
                );
              })()
            ) : (
              /* User Eliminated or Bye (Top 8 skipping Playoff!) */
              <div className="rounded-2xl border border-slate-800 bg-[#0e141d] p-5 sm:p-6 text-center space-y-3.5">
                {userEliminated ? (
                  <>
                    <div className="text-[11px] font-bold tracking-wider text-rose-400 uppercase">
                      UCL JOURNEY ENDED
                    </div>
                    <h3 className="text-lg sm:text-xl font-black text-white">
                      {getUserUclResultLabel(ucl, USER_CLUB_ID)} 마감
                    </h3>
                    <div className="flex flex-wrap justify-center gap-2">
                      {isUclKoStage(ucl.stage) && (
                        <button
                          id="ucl-ko-spectate-auto-btn"
                          type="button"
                          onClick={startKoAutoSimSingleLeg}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-sky-400/55 bg-sky-500/20 px-4 py-2.5 text-xs sm:text-sm font-extrabold text-sky-100 hover:bg-sky-500/30 cursor-pointer touch-manipulation"
                        >
                          <Radio className="h-4 w-4 text-sky-300" />
                          1경기씩 자동 관전
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={simulateUclToEnd}
                        className="rounded-xl bg-sky-400 px-5 py-2.5 text-xs sm:text-sm font-black text-slate-950 hover:bg-sky-300 cursor-pointer touch-manipulation"
                      >
                        결승까지 빠르게 스킵 →
                      </button>
                      <button
                        type="button"
                        onClick={finishUclToSummary}
                        className="rounded-xl border border-slate-700 bg-[#131b27] px-4 py-2.5 text-xs font-bold text-slate-200 hover:text-white cursor-pointer touch-manipulation"
                      >
                        최종 결산으로 이동 →
                      </button>
                    </div>
                  </>
                ) : (
                  /* User finished 1~8th in Swiss League -> Direct R16 Bye during Playoff! */
                  <>
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-xs font-bold text-emerald-300">
                      <Sparkles className="h-3.5 h-3.5" />
                      리그 페이즈 {ucl.userLeaguePhaseRank}위 · 16강 직행
                    </div>
                    <h3 className="text-lg sm:text-xl font-black text-white">
                      9~24위 플레이오프 진행 중 ({ucl.knockoutLeg}차전)
                    </h3>
                    <div className="flex flex-wrap justify-center gap-2">
                      <button
                        type="button"
                        onClick={simulateUclPlayoffBye}
                        className="rounded-xl bg-emerald-500 px-5 py-2.5 text-xs sm:text-sm font-black text-slate-950 hover:bg-emerald-400 cursor-pointer touch-manipulation"
                      >
                        플레이오프 완료 → 16강 대진 확정
                      </button>
                      <button
                        id="ucl-ko-bye-auto-btn"
                        type="button"
                        onClick={startKoAutoSimSingleLeg}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-sky-400/50 bg-sky-500/18 px-4 py-2.5 text-xs font-extrabold text-sky-100 hover:bg-sky-500/28 cursor-pointer touch-manipulation"
                      >
                        <Radio className="h-3.5 w-3.5 text-sky-300" />
                        {ucl.knockoutLeg}차전 자동 관전
                      </button>
                      <button
                        type="button"
                        onClick={simulateSingleMatchInstant}
                        className="rounded-xl border border-slate-700 bg-[#131b27] px-4 py-2.5 text-xs font-bold text-slate-200 hover:text-white cursor-pointer touch-manipulation"
                      >
                        {ucl.knockoutLeg}차전 스킵
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Latest UCL Match Result */}
            {ucl.lastUserMatch && (
              <button
                type="button"
                onClick={() => {
                  setInspectedTie(null);
                  setInspectedMatch(ucl.lastUserMatch);
                }}
                className="w-full rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-left space-y-2 transition-colors hover:border-sky-400/50 cursor-pointer"
              >
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-bold text-sky-300">
                    직전 UCL 경기 · {ucl.lastUserMatch.competitionLabel}
                  </span>
                  <span>
                    MOM: {ucl.lastUserMatch.momPlayerName} (
                    {ucl.lastUserMatch.momRating.toFixed(1)}) · 상세 보기 →
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-slate-950/70 px-4 py-3 text-sm font-black text-white">
                  <span>{clubsById[ucl.lastUserMatch.homeTeamId]?.name}</span>
                  <span className="font-mono text-lg text-emerald-300">
                    {ucl.lastUserMatch.homeGoals} : {ucl.lastUserMatch.awayGoals}
                    {ucl.lastUserMatch.extraTime?.penalties && (
                      <span className="ml-1.5 text-xs text-purple-300">
                        (PK {ucl.lastUserMatch.extraTime.penalties.homePenGoals}-
                        {ucl.lastUserMatch.extraTime.penalties.awayPenGoals})
                      </span>
                    )}
                  </span>
                  <span>{clubsById[ucl.lastUserMatch.awayTeamId]?.name}</span>
                </div>
              </button>
            )}

            {/* Shared Live Knockout Bracket automatically replaces League Phase standings once knockout starts */}
            {isKnockoutStage && (
              <UclBracketTree
                ucl={bracketUclDisplay}
                clubsById={clubsById}
                myClubId={USER_CLUB_ID}
                liveTieOverlays={liveTickerPlaying ? liveOverlays : undefined}
                hideChampion={Boolean(
                  (season.liveHalftime && ucl.stage === 'final') ||
                    (autoPopupMode === 'ko_spectate' && !spectateSettled),
                )}
                onSelectTie={(tie) => {
                  setInspectedMatch(null);
                  setInspectedTie(tie);
                }}
              />
            )}
          </div>

          {/* Right Compact Real-Time Standings (League Phase only; knockout transitions to live bracket above) */}
          {!isKnockoutStage && (
            <div className="lg:col-span-4">
              <CompactLiveStandings
                title="UCL 리그페이즈 순위"
                standings={ucl.standings}
                myClubId={USER_CLUB_ID}
                variant="ucl"
                roundLabel={`${ucl.leaguePhaseRound}/8R`}
                onSelectClub={(teamId) => {
                  const c = clubsById[teamId];
                  if (c) setInspectedClub(c);
                }}
                onOpenFullModal={() => setLpStandingsModalOpen(true)}
              />
            </div>
          )}
        </div>
        );
      })()}

      {/* TAB 2: FULL 36-TEAM SWISS TABLE */}
      {tab === 'standings' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-black text-white">
              UCL 리그페이즈 순위 ({ucl.leaguePhaseRound} / 8R)
            </h2>
            <div className="flex flex-wrap gap-3 text-[11px]">
              <span className="text-emerald-400 font-bold">1~8위: 16강 직행</span>
              <span className="text-amber-400 font-bold">9~24위: 16강 PO</span>
              <span className="text-rose-400 font-bold">25~36위: 탈락</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px] sm:text-xs">
              <thead className="border-b border-slate-800 text-[10px] sm:text-[11px] text-slate-400">
                <tr>
                  <th className="py-1.5 sm:py-2 px-1.5 sm:px-2">#</th>
                  <th className="py-1.5 sm:py-2 px-1.5 sm:px-2">구단</th>
                  <th className="py-1.5 sm:py-2 px-2 hidden sm:table-cell">포트 / 출전</th>
                  <th className="py-1.5 sm:py-2 px-1 sm:px-1.5 text-center">경기</th>
                  <th className="py-1.5 sm:py-2 px-1 sm:px-1.5 text-center">승</th>
                  <th className="py-1.5 sm:py-2 px-1 sm:px-1.5 text-center">무</th>
                  <th className="py-1.5 sm:py-2 px-1 sm:px-1.5 text-center">패</th>
                  <th className="py-1.5 sm:py-2 px-1 sm:px-1.5 text-center">득실</th>
                  <th className="py-1.5 sm:py-2 px-1.5 sm:px-2 text-center font-black">승점</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {ucl.standings.map((row, idx) => {
                  const rank = idx + 1;
                  const entry = teamEntryById[row.teamId];
                  const zoneBorder =
                    rank <= 8
                      ? 'border-l-4 border-l-emerald-400'
                      : rank <= 24
                        ? 'border-l-4 border-l-amber-400'
                        : 'border-l-4 border-l-rose-500/70';

                  return (
                    <tr
                      key={row.teamId}
                      onClick={() => {
                        const c = clubsById[row.teamId];
                        if (c) setInspectedClub(c);
                      }}
                      className={`${zoneBorder} cursor-pointer transition-colors ${
                        row.isUser
                          ? 'bg-emerald-500/15 font-bold text-white hover:bg-emerald-500/25'
                          : 'hover:bg-slate-800/50 text-slate-200'
                      }`}
                    >
                      <td className="py-1 sm:py-2 px-1.5 sm:px-2 font-mono font-bold">{rank}</td>
                      <td className="py-1 sm:py-2 px-1.5 sm:px-2">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <span
                            className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: row.primaryColor }}
                          />
                          <span className="truncate max-w-[125px] sm:max-w-none hover:text-sky-300">
                            {row.teamName}
                          </span>
                        </div>
                      </td>
                      <td className="py-1 sm:py-2 px-2 text-[11px] text-slate-400 hidden sm:table-cell">
                        Pot {entry?.pot ?? '-'} · {entry?.originLabel ?? ''}
                      </td>
                      <td className="py-1 sm:py-2 px-1 sm:px-1.5 text-center font-mono">
                        {row.played}
                      </td>
                      <td className="py-1 sm:py-2 px-1 sm:px-1.5 text-center font-mono">
                        {row.won}
                      </td>
                      <td className="py-1 sm:py-2 px-1 sm:px-1.5 text-center font-mono">
                        {row.drawn}
                      </td>
                      <td className="py-1 sm:py-2 px-1 sm:px-1.5 text-center font-mono">
                        {row.lost}
                      </td>
                      <td className="py-1 sm:py-2 px-1 sm:px-1.5 text-center font-mono">
                        {row.goalDifference >= 0
                          ? `+${row.goalDifference}`
                          : row.goalDifference}
                      </td>
                      <td className="py-1 sm:py-2 px-1.5 sm:px-2 text-center font-mono text-xs sm:text-sm font-black text-white">
                        {row.points}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: AUTHENTIC ORTHOGONAL KNOCKOUT BRACKET TREE */}
      {tab === 'bracket' && (
        <UclBracketTree
          ucl={ucl}
          clubsById={clubsById}
          onSelectTie={(tie) => {
            setInspectedMatch(null);
            setInspectedTie(tie);
          }}
        />
      )}

      {/* TAB 4: UCL INDIVIDUAL STATS */}
      {tab === 'stats' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {[
            { title: '⚽ UCL 득점 순위', list: uclLeaders.scorers, metric: (s: (typeof uclLeaders.scorers)[0]) => `${s.goals}골` },
            { title: '🎯 UCL 도움 순위', list: uclLeaders.assisters, metric: (s: (typeof uclLeaders.assisters)[0]) => `${s.assists}도움` },
            { title: '⭐ UCL 평점 순위 (2경기↑)', list: uclLeaders.ratings, metric: (s: (typeof uclLeaders.ratings)[0]) => s.avgRating.toFixed(2) },
          ].map((col) => (
            <div
              key={col.title}
              className="rounded-2xl border border-slate-800 bg-slate-900/75 p-4 space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-1.5 text-xs font-black text-white">
                  <Award className="h-4 w-4 text-amber-400" />
                  {col.title}
                </h3>
                <span className="text-[10px] text-slate-500">이름 클릭 시 세부 스탯</span>
              </div>
              {col.list.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-500">
                  경기 진행 후 기록이 집계됩니다.
                </p>
              ) : (
                <div className="space-y-1.5 text-xs">
                  {col.list.map((st, idx) => (
                    <div
                      key={`${col.title}-${st.teamId}-${st.playerId}`}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left ${
                        st.isUserTeam
                          ? 'bg-emerald-500/15 font-bold text-emerald-200'
                          : 'bg-slate-950/60 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-4 shrink-0 font-mono text-[11px] text-slate-400">
                          {idx + 1}
                        </span>
                        {(() => {
                          const nat = getPlayerNationalityMeta(st.playerId);
                          return nat ? (
                            <CountryFlagSvg
                              code={nat.nationalityCode}
                              nationality={nat.nationality}
                              size="xs"
                            />
                          ) : null;
                        })()}
                        <PlayerNameButton
                          onClick={() => openPlayerById(st.playerId, st)}
                          className="font-semibold"
                        >
                          {st.playerName}
                        </PlayerNameButton>
                        <span className="text-[10px] text-slate-500 shrink-0">
                          {st.teamShortName}
                        </span>
                      </div>
                      <span className="font-mono font-black text-amber-300 shrink-0">
                        {col.metric(st)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* TAB 5: SQUAD & TACTICS (Normalized Pitch Proportions matching Regular League SquadManagerModal) */}
      {tab === 'squad' && (() => {
        const uclEditLocked = false;
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              {/* Left: Compact Formation Pitch (5 cols, max-w-[440px]) */}
              <div className="lg:col-span-5">
                <div className="mx-auto max-w-[440px]">
                  <PitchBoard
                    formation={state.formation}
                    starters={state.starters}
                    bench={state.bench}
                    chemistry={chemistry}
                    managerTraitId={state.manager.traitId}
                    tactic={season.defaultTactic}
                    conditionByPlayerId={season.playerConditions}
                    selectedSlot={uclEditLocked ? null : swapPick}
                    onSlotClick={uclEditLocked ? undefined : handleSquadSlotClick}
                    onSlotSwap={uclEditLocked ? undefined : swapSquadPositions}
                    onInspectPlayer={(player, slotSubPosition) =>
                      setInspected({ player, slotSubPosition })
                    }
                    headerRight={
                      <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-slate-300 tabular-nums">
                        <Zap className="h-3 w-3 text-emerald-400" />
                        A <strong className="text-white">{ratings.effectiveAtt}</strong> / M{' '}
                        <strong className="text-white">{ratings.effectiveMid}</strong> / D{' '}
                        <strong className="text-white">{ratings.effectiveDef}</strong>
                      </span>
                    }
                    showBench
                    showChemBreakdown
                    compact
                  />
                </div>
              </div>

              {/* Right: Formation & Tactic Controls + Manager Trait + 16-Player UCL Squad Summary (7 cols) */}
              <div className="lg:col-span-7 space-y-4">
                <div
                  className={`rounded-2xl border border-slate-800 bg-slate-900/75 p-4 space-y-3 ${
                    uclEditLocked ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-black text-white">
                      <Users className="h-4 w-4 text-sky-400" />
                      포메이션 &amp; 기본 전술
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        id="ucl-squad-line-ovr"
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-[#0b1018] px-2.5 py-1 text-xs font-bold text-slate-300 tabular-nums"
                      >
                        <Zap className="h-3.5 w-3.5 text-emerald-400" />
                        A <strong className="text-white">{ratings.effectiveAtt}</strong> / M{' '}
                        <strong className="text-white">{ratings.effectiveMid}</strong> / D{' '}
                        <strong className="text-white">{ratings.effectiveDef}</strong>
                      </span>
                      <button
                        type="button"
                        disabled={uclEditLocked}
                        onClick={autoOptimizeLineup}
                        className="rounded-lg bg-emerald-500/20 px-2.5 py-1 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
                        자동 최적 배치
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                    {FORMATION_LIST.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        disabled={uclEditLocked}
                        title={f.name}
                        onClick={() => changeFormation(f.id)}
                        className={`rounded-lg border py-1.5 px-1 text-[11px] font-bold cursor-pointer disabled:cursor-not-allowed truncate transition-colors ${
                          state.formation === f.id
                            ? 'border-sky-400/55 bg-sky-500/18 text-white'
                            : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                        }`}
                      >
                        {f.id === '4-4-2-diamond'
                          ? '4-4-2◇'
                          : f.id === '3-5-2-dm'
                            ? '3-5-2 DM'
                            : f.id}
                      </button>
                    ))}
                  </div>
                  <div className="pt-2 border-t border-slate-800 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                      <Shield className="h-3.5 w-3.5 text-amber-400" />
                      기본 전술
                    </div>
                    <div className="grid grid-cols-5 gap-1">
                      {TACTIC_LIST.map((t) => {
                        const isMgrPreferred = state.manager.traitId
                          ? MANAGER_TRAITS[state.manager.traitId]?.synergyTactic === t.id
                          : false;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            disabled={uclEditLocked}
                            title={isMgrPreferred ? `${t.name} · 감독 추천 전술` : t.name}
                            onClick={() => setDefaultTactic(t.id as TacticId)}
                            className={`rounded-lg border py-1.5 text-[11px] font-bold cursor-pointer disabled:cursor-not-allowed transition-colors ${
                              season.defaultTactic === t.id
                                ? 'border-emerald-400/55 bg-emerald-500/18 text-white'
                                : isMgrPreferred
                                  ? 'border-slate-700 bg-slate-950 text-slate-200 hover:border-slate-500 hover:text-white'
                                  : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                            }`}
                          >
                            {isMgrPreferred && (
                              <span className="text-amber-300 mr-0.5">★</span>
                            )}
                            {t.shortName}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

            <ManagerTraitBadgeCard
              traitId={state.manager.traitId}
              starters={state.starters}
              tactic={season.defaultTactic}
              formation={state.formation}
              compact
            />

            {/* Compact 16-Player UCL Squad Stats List */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-black text-white">
                  내 16인 스쿼드 UCL 기록 요약
                </span>
                <span className="text-[11px] text-slate-400">
                  이름 클릭 시 대회별 상세 기록
                </span>
              </div>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 max-h-72 overflow-y-auto pr-1">
                {[...state.starters, ...state.bench]
                  .filter((p): p is Player => p !== null)
                  .map((p, idx) => {
                    const st =
                      season.uclPlayerStats[p.id] ??
                      season.uclPlayerStats[`${USER_CLUB_ID}::${p.id}`];
                    const isStarter = idx < 11;
                    const slotSyn = isStarter
                      ? chemistry.slotSynergies[idx]
                      : undefined;
                    const cond = season.playerConditions?.[p.id] ?? null;
                    const ovrBreakdown = computeFullPlayerOvrBreakdown({
                      baseOvr: p.ovr,
                      synergyBonus: slotSyn?.totalBonus ?? 0,
                      condition: cond,
                    });
                    return (
                      <div
                        key={`ucl-sq-${p.id}-${idx}`}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-800/80 bg-slate-950/70 px-2.5 py-1.5 text-xs tabular-nums"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-extrabold ${
                              isStarter
                                ? 'bg-sky-500/20 text-sky-300'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {isStarter ? '선발' : '벤치'}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <CountryFlagSvg
                                code={p.nationalityCode}
                                nationality={p.nationality}
                                size="xs"
                              />
                              <PlayerNameButton
                                onClick={() => openPlayerById(p.id, st)}
                                className="font-bold text-slate-100"
                              >
                                {p.name}
                              </PlayerNameButton>
                              {(() => {
                                if (!cond) return null;
                                const inj = isPlayerActivelyInjured(cond);
                                const mt = getMoraleTier(cond.morale);
                                return (
                                  <>
                                    {inj && cond.injury && (
                                      <PixelStatusIcon
                                        variant="injury"
                                        size={11}
                                        title={getInjuryTooltip(cond.injury)}
                                      />
                                    )}
                                    {mt === 'ecstatic' && (
                                      <PixelStatusIcon
                                        variant="morale_high"
                                        size={11}
                                        title={`사기 ${getMoraleLabel(cond.morale)}`}
                                      />
                                    )}
                                    {mt === 'frozen' && (
                                      <PixelStatusIcon
                                        variant="morale_low"
                                        size={11}
                                        title={`사기 ${getMoraleLabel(cond.morale)}`}
                                      />
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                            <div
                              className="text-[10px] text-slate-500 flex flex-wrap items-center gap-1"
                              title={ovrBreakdown.summaryLine}
                            >
                              <span>
                                {formatMainPositions(p)} · OVR {p.ovr}
                              </span>
                              {ovrBreakdown.synergyBonus > 0 && (
                                <span className="font-bold text-emerald-300">
                                  +{ovrBreakdown.synergyBonus}
                                </span>
                              )}
                              {ovrBreakdown.moraleBonus !== 0 && (
                                <span
                                  className={`font-bold ${
                                    ovrBreakdown.moraleBonus > 0
                                      ? 'text-amber-300'
                                      : 'text-sky-300'
                                  }`}
                                >
                                  {ovrBreakdown.moraleBonus > 0
                                    ? `+${ovrBreakdown.moraleBonus}`
                                    : ovrBreakdown.moraleBonus}
                                </span>
                              )}
                              {ovrBreakdown.isUnavailableInjured ? (
                                <span className="font-bold text-rose-400">
                                  (결장)
                                </span>
                              ) : (
                                ovrBreakdown.injuryPenalty < 0 && (
                                  <span className="font-bold text-rose-400">
                                    {ovrBreakdown.injuryPenalty}
                                  </span>
                                )
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right text-[11px] text-slate-300 shrink-0">
                          <div>
                            {st?.appearances ?? 0}경기 ·{' '}
                            <strong className="text-amber-300">
                              {st?.goals ?? 0}G {st?.assists ?? 0}A
                            </strong>
                          </div>
                          <div className="text-[10px] text-slate-400">
                            평점{' '}
                            {st && st.appearances > 0
                              ? st.avgRating.toFixed(1)
                              : '-'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
          </div>
        );
      })()}
    </div>
  );
}
