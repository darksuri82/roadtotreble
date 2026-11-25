import {
  ArrowLeftRight,
  Award,
  Calendar,
  FastForward,
  Globe,
  Play,
  Radio,
  SkipForward,
  Star,
  Trophy,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FORMATIONS } from '../../data/formations';
import {
  buildFfpPenaltyHelpItems,
  formatFfpBadgeSummary,
} from '../../engine/budgetEngine';
import {
  getMoraleLabel,
  getMoraleTier,
  isPlayerActivelyInjured,
} from '../../engine/conditionEngine';
import {
  CUP_STAGE_LABELS,
  didUserWinCup,
  findUserCupMatch,
  getUserCupResultLabel,
} from '../../engine/cupEngine';
import { getLeagueById, LEAGUES } from '../../engine/dataLoader';
import { USER_CLUB_ID } from '../../engine/matchEngine';
import { getUserRank } from '../../engine/standingsEngine';
import { TACTICS } from '../../engine/tacticEngine';
import { getNextTransferWindowRound } from '../../engine/transferEngine';
import { ModalBodyLock } from '../../hooks/useBodyScrollLock';
import { useGame } from '../../store/GameContext';
import type {
  Club,
  LeagueId,
  MatchResult,
  PlayerSeasonStats,
} from '../../types/league';
import {
  buildPlayerCompetitionBreakdown,
  getPlayerNationalityMeta,
  resolveClubRoster,
  resolvePlayerById,
} from '../../utils/playerLookup';
import { useSoloTacticEditSession } from '../../hooks/useSoloTacticEditPause';
import { ClubSquadModal } from '../common/ClubSquadModal';
import { ClubTag } from '../common/ClubTag';
import { CompactLiveStandings } from '../common/CompactLiveStandings';
import { CountryFlagSvg } from '../common/CountryFlagSvg';
import { InfoHelpButton } from '../common/InfoHelpButton';
import { JerseySvg } from '../common/JerseySvg';
import { MatchDetailModal } from '../common/MatchDetailModal';
import {
  getDomesticCupTrophyVariant,
  PixelTrophySvg,
} from '../common/PixelTrophySvg';
import { PixelStatusIcon } from '../common/PixelStatusIcon';
import { PlayerDetailModal } from '../common/PlayerDetailModal';
import { PlayerNameButton } from '../common/PlayerNameButton';
import {
  matchResultToCastMatch,
  SoloLiveScoreboard,
} from '../common/SoloLiveScoreboard';
import type { SoloLiveDurationMs } from '../common/SoloLiveScoreboard';
import { StaffCoachBadge } from '../common/StaffCoachBadge';
import { TransferMarketModal } from '../transfer/TransferMarketModal';
import { CupBracketView } from './CupBracketView';
import { CupChampionModal } from './CupChampionModal';
import { FastSimModal } from './FastSimModal';
import { LeagueLeadersSideCard } from './LeagueLeadersSideCard';
import {
  LiveMatchBroadcast,
  shouldRenderLiveMatchBroadcast,
} from './LiveMatchBroadcast';
import { MatchDayTacticsRoom } from './MatchDayTacticsRoom';
import { MatchReportPanel } from './MatchReportPanel';
import { SquadManagerModal } from './SquadManagerModal';
import { StandingsTable } from './StandingsTable';

type SeasonTab = 'match' | 'cup' | 'squad' | 'standings' | 'transfer';
type RecordSubTab = 'goals' | 'assists' | 'cleanSheets' | 'rating';
type SkipFlowState = 'idle' | 'running' | 'paused_for_transfer' | 'prompt_resume';
type LiveAutoResumeReason = 'cup' | 'live_match' | 'transfer' | 'injury';

const LIVE_AUTO_RESUME_COPY: Record<
  LiveAutoResumeReason,
  { title: string; subtitle: string }
> = {
  cup: {
    title: '컵대회 경기 종료',
    subtitle: '라이브 자동진행을 이어서 진행할까요?',
  },
  live_match: {
    title: '2D 경기 종료',
    subtitle: '라이브 자동진행을 이어서 진행할까요?',
  },
  transfer: {
    title: '이적시장 종료',
    subtitle: '스쿼드를 점검하려면 일시정지를, 바로 달리려면 이어서 진행을 선택하세요.',
  },
  injury: {
    title: '부상 대응 완료',
    subtitle: '라인업을 더 점검하려면 일시정지를, 바로 달리려면 이어서 진행을 선택하세요.',
  },
};

export function SeasonDashboard() {
  const {
    state,
    activeTactic,
    chemistry,
    ratings,
    setSoloTickerPlaying,
    changeFormation,
    autoOptimizeLineup,
    swapSquadPositions,
    setNextMatchTactic,
    startLiveMatch,
    startSoloStreamMatch,
    enterLiveBroadcastFromStream,
    cancelSoloStreamMatch,
    commitLiveMatch,
    simulateSingleMatchInstant,
    markCupCelebrated,
  } = useGame();

  const [activeTab, setActiveTab] = useState<SeasonTab>('match');
  const [recordTab, setRecordTab] = useState<RecordSubTab>('goals');
  const [skipFlowState, setSkipFlowState] = useState<SkipFlowState>('idle');
  const [quickSkipModalOpen, setQuickSkipModalOpen] = useState(false);
  const [standingsLeagueId, setStandingsLeagueId] = useState<LeagueId | null>(
    null,
  );
  const [inspectedPlayer, setInspectedPlayer] = useState<{
    playerId: string;
    fallbackStats?: PlayerSeasonStats | null;
  } | null>(null);
  const [inspectedMatch, setInspectedMatch] = useState<MatchResult | null>(null);
  const [inspectedClub, setInspectedClub] = useState<{
    club: Club;
    leagueId?: LeagueId;
  } | null>(null);

  // Solo Live Scoreboard Auto-Advance state (5s / 7s / 9s)
  const [liveAutoActive, setLiveAutoActive] = useState(false);
  const [liveAutoUserPaused, setLiveAutoUserPaused] = useState(false);
  const [liveAutoDurationMs, setLiveAutoDurationMs] =
    useState<SoloLiveDurationMs>(5000);
  const [liveAutoCupPromptOpen, setLiveAutoCupPromptOpen] = useState(false);
  const [liveAutoResumePrompt, setLiveAutoResumePrompt] =
    useState<LiveAutoResumeReason | null>(null);
  const liveAutoNeedsPromptRef = useRef<LiveAutoResumeReason | null>(null);
  const prevTransferOpenRef = useRef<boolean>(false);

  const season = state.season;

  const clubsById = useMemo(() => {
    const map: Record<string, Club> = {};
    if (season) {
      for (const c of season.clubs) map[c.id] = c;
    }
    return map;
  }, [season]);

  // Active uncommitted live-stream match stored in liveHalftime (enables mid-match 2D jump-in!)
  const streamHalftime = season?.liveHalftime?.streamAutoMode
    ? season.liveHalftime
    : null;
  const liveTickerPlaying = Boolean(streamHalftime);

  const liveAutoMatch = useMemo(() => {
    if (!streamHalftime?.fullMatchResult) return null;
    const label =
      streamHalftime.competitionLabel || `리그 ${streamHalftime.round}R`;
    return matchResultToCastMatch(
      streamHalftime.fullMatchResult,
      label,
      USER_CLUB_ID,
    );
  }, [streamHalftime]);

  // Sync global soloTickerPlaying flag & clean up on unmount
  useEffect(() => {
    setSoloTickerPlaying(liveTickerPlaying);
  }, [liveTickerPlaying, setSoloTickerPlaying]);

  useEffect(() => {
    return () => {
      setSoloTickerPlaying(false);
    };
  }, [setSoloTickerPlaying]);

  useEffect(() => {
    const handleGoToTactics = () => {
      setActiveTab('match');
      setLiveAutoUserPaused(true);
      window.setTimeout(() => {
        document
          .getElementById('tactics-room-line-ovr')
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 60);
    };
    window.addEventListener('rtt:go-to-tactics', handleGoToTactics);
    return () => {
      window.removeEventListener('rtt:go-to-tactics', handleGoToTactics);
    };
  }, []);

  // Unified skip flow: detect transfer market closing after auto-pause → show resume prompt
  const isTransferOpen = Boolean(season?.transferMarket.isOpen);
  useEffect(() => {
    const wasOpen = prevTransferOpenRef.current;
    prevTransferOpenRef.current = isTransferOpen;
    if (wasOpen && !isTransferOpen && skipFlowState === 'paused_for_transfer') {
      const t = window.setTimeout(() => setSkipFlowState('prompt_resume'), 0);
      return () => window.clearTimeout(t);
    }
  }, [isTransferOpen, skipFlowState]);

  const pendingCupStage = season?.cup?.pendingStage ?? null;
  const pendingCupNode =
    season?.cup && pendingCupStage
      ? findUserCupMatch(season.cup, pendingCupStage, USER_CLUB_ID)
      : null;

  const hasPendingFfpNotice = Boolean(
    season?.pendingFfpOpeningNotice &&
      season.budgetState &&
      season.budgetState.ffpTier >= 1,
  );
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
  const uncelebratedCupWin = Boolean(
    season?.cup?.completed &&
      didUserWinCup(season.cup, USER_CLUB_ID) &&
      !season.cupChampionCelebrated,
  );
  const hasActive2DBroadcast = Boolean(
    season?.liveHalftime && !season.liveHalftime.streamAutoMode,
  );

  // Remember when transfer market or injury alert interrupts live auto-advance so we ask [이어서 자동진행 / 일시정지] after
  // (Interviews intentionally do NOT set this ref — they auto-resume smoothly!)
  useEffect(() => {
    if (!liveAutoActive) return;
    if (isTransferOpen || hasPendingStaffCoach) {
      liveAutoNeedsPromptRef.current = 'transfer';
    } else if (hasPendingInjury) {
      liveAutoNeedsPromptRef.current = 'injury';
    }
  }, [liveAutoActive, isTransferOpen, hasPendingStaffCoach, hasPendingInjury]);

  const launchNextLiveAutoMatch = useCallback(
    (allowCup = false) => {
      if (!season || state.phase !== 'season') return;
      if (season.currentRound >= season.totalRounds && !pendingCupNode) {
        setLiveAutoActive(false);
        return;
      }
      if (pendingCupNode && !allowCup) {
        setLiveAutoCupPromptOpen(true);
        return;
      }
      startSoloStreamMatch();
    },
    [season, state.phase, pendingCupNode, startSoloStreamMatch],
  );

  const handleLiveAutoMatchDone = useCallback(() => {
    // Commit the streamed match result now → updates standings/stats/events/injuries/transfers with zero spoilers
    commitLiveMatch();
  }, [commitLiveMatch]);

  const handleEnterLive2DFromStream = useCallback(
    (minute: number, inPenalties: boolean) => {
      liveAutoNeedsPromptRef.current =
        streamHalftime?.competition === 'cup' ? 'cup' : 'live_match';
      setLiveAutoUserPaused(false);
      enterLiveBroadcastFromStream(minute, inPenalties);
    },
    [streamHalftime?.competition, enterLiveBroadcastFromStream],
  );

  const tacticSignature = `${state.formation}|${season?.defaultTactic ?? ''}|${season?.nextMatchTactic ?? ''}|${state.starters.map((p) => p?.id ?? '').join(',')}|${state.bench.map((p) => p?.id ?? '').join(',')}`;
  const {
    tacticEditMode,
    tacticNoticeLabel,
    startTacticEdit,
    confirmTacticEdit,
    resetTacticEdit,
  } = useSoloTacticEditSession({
    tacticSignature,
    liveAutoActive,
    matchScopeKey: streamHalftime?.fixtureId ?? `gap:${season?.currentRound ?? 0}`,
  });

  const handleStartLiveTacticEdit = useCallback(() => {
    startTacticEdit();
    setActiveTab('squad');
  }, [startTacticEdit]);

  const stopLiveAuto = useCallback(() => {
    liveAutoNeedsPromptRef.current = null;
    resetTacticEdit();
    setLiveAutoActive(false);
    setLiveAutoUserPaused(false);
    setLiveAutoCupPromptOpen(false);
    setLiveAutoResumePrompt(null);
    cancelSoloStreamMatch();
    setSoloTickerPlaying(false);
  }, [cancelSoloStreamMatch, setSoloTickerPlaying, resetTacticEdit]);

  // Schedule next live auto-advance match (or ask resume confirmation after cup/2D/transfer/injury)
  const liveAutoBlockedByEvent =
    hasPendingFfpNotice ||
    hasPendingStaffCoach ||
    isTransferOpen ||
    hasPendingInjury ||
    hasPendingAwakening ||
    hasPendingAdaptation ||
    hasPendingEvent ||
    uncelebratedCupWin ||
    hasActive2DBroadcast ||
    tacticEditMode ||
    liveAutoCupPromptOpen ||
    liveAutoResumePrompt !== null;

  useEffect(() => {
    if (
      !season ||
      state.phase !== 'season' ||
      !liveAutoActive ||
      liveAutoUserPaused ||
      liveTickerPlaying ||
      liveAutoBlockedByEvent
    ) {
      return;
    }
    if (season.currentRound >= season.totalRounds && !pendingCupNode) {
      liveAutoNeedsPromptRef.current = null;
      const stopT = window.setTimeout(() => setLiveAutoActive(false), 0);
      return () => window.clearTimeout(stopT);
    }
    // After direct cup/2D play, transfer window, or injury handling, ask user whether to continue or stay paused
    if (liveAutoNeedsPromptRef.current !== null) {
      const reason = liveAutoNeedsPromptRef.current;
      liveAutoNeedsPromptRef.current = null;
      const promptT = window.setTimeout(() => setLiveAutoResumePrompt(reason), 80);
      return () => window.clearTimeout(promptT);
    }
    if (pendingCupNode) {
      const cupT = window.setTimeout(() => setLiveAutoCupPromptOpen(true), 120);
      return () => window.clearTimeout(cupT);
    }
    const timer = window.setTimeout(() => {
      launchNextLiveAutoMatch(false);
    }, 620);
    return () => window.clearTimeout(timer);
  }, [
    season,
    state.phase,
    liveAutoActive,
    liveAutoUserPaused,
    liveTickerPlaying,
    liveAutoBlockedByEvent,
    pendingCupNode,
    launchNextLiveAutoMatch,
  ]);

  if (!season) return null;

  const displayStandings = season.standings;
  const displayRound = season.currentRound;
  const displayLastMatch = season.lastUserMatch;

  const league = getLeagueById(season.leagueId);
  const viewedLeagueId: LeagueId = standingsLeagueId ?? season.leagueId;
  const viewedLeagueMeta = getLeagueById(viewedLeagueId);
  const isViewingUserLeague = viewedLeagueId === season.leagueId;
  const viewedBgLeague = !isViewingUserLeague
    ? season.otherLeagues?.[viewedLeagueId]
    : undefined;
  const viewedClubsById: Record<string, Club> = isViewingUserLeague
    ? clubsById
    : Object.fromEntries(
        (viewedBgLeague?.clubs ?? viewedLeagueMeta.clubs).map((c) => [c.id, c]),
      );
  const viewedStandings = isViewingUserLeague
    ? displayStandings
    : viewedBgLeague?.standings ?? [];

  const userRank = getUserRank(displayStandings, USER_CLUB_ID);
  const userRow = displayStandings.find((r) => r.teamId === USER_CLUB_ID);
  const inUclZone = userRank <= 4;

  const nextRoundNumber = season.currentRound + 1;
  const nextLeagueFixture = season.fixtures.find(
    (f) =>
      f.round === nextRoundNumber &&
      (f.homeTeamId === USER_CLUB_ID || f.awayTeamId === USER_CLUB_ID),
  );

  const isNextCupMatch = Boolean(pendingCupNode && season.cup && pendingCupStage);
  const nextOpponent = isNextCupMatch && pendingCupNode
    ? clubsById[
        pendingCupNode.homeTeamId === USER_CLUB_ID
          ? pendingCupNode.awayTeamId
          : pendingCupNode.homeTeamId
      ]
    : nextLeagueFixture
      ? clubsById[
          nextLeagueFixture.homeTeamId === USER_CLUB_ID
            ? nextLeagueFixture.awayTeamId
            : nextLeagueFixture.homeTeamId
        ]
      : null;
  const isNextHome = isNextCupMatch && pendingCupNode
    ? pendingCupNode.homeTeamId === USER_CLUB_ID
    : nextLeagueFixture?.homeTeamId === USER_CLUB_ID;

  const nextOpponentRoster = nextOpponent
    ? resolveClubRoster({
        clubId: nextOpponent.id,
        club: nextOpponent,
        leagueId: season.leagueId,
        season,
        userStarters: state.starters,
        userBench: state.bench,
      })
    : [];

  const nextTransferRound = getNextTransferWindowRound(
    season.currentRound,
    season.transferWindows,
    season.transferMarket.completedWindows,
  );

  const viewedStatsMap = isViewingUserLeague
    ? season.allPlayerStats
    : (viewedBgLeague?.playerStats ?? {});
  const viewedRoundForMin = isViewingUserLeague
    ? displayRound
    : (viewedBgLeague?.currentRound ?? 0);
  const allStatsList = Object.values(viewedStatsMap).filter(
    (s) => s.appearances > 0,
  );
  const activeLeaderboard = [...allStatsList]
    .filter((s) =>
      recordTab === 'goals'
        ? s.goals > 0
        : recordTab === 'assists'
          ? s.assists > 0
          : recordTab === 'cleanSheets'
            ? (s.position === 'GK' || s.position === 'DF') && s.cleanSheets > 0
            : s.appearances >= Math.max(1, Math.floor(viewedRoundForMin * 0.4)),
    )
    .sort((a, b) => {
      if (recordTab === 'goals') return b.goals - a.goals || b.assists - a.assists;
      if (recordTab === 'assists') return b.assists - a.assists || b.goals - a.goals;
      if (recordTab === 'cleanSheets') return b.cleanSheets - a.cleanSheets || b.avgRating - a.avgRating;
      return b.avgRating - a.avgRating || b.momCount - a.momCount;
    })
    .slice(0, 10);

  const handleStartUnifiedSkip = () => {
    stopLiveAuto();
    setSkipFlowState('running');
  };

  const handleStartLiveAuto = () => {
    setSkipFlowState('idle');
    setLiveAutoActive(true);
    setLiveAutoUserPaused(false);
    setActiveTab('match');
    if (pendingCupNode) {
      setLiveAutoCupPromptOpen(true);
    } else if (!liveAutoBlockedByEvent) {
      launchNextLiveAutoMatch(false);
    }
  };

  const handleSingleMatchSkip = () => {
    stopLiveAuto();
    simulateSingleMatchInstant();
    setQuickSkipModalOpen(true);
  };

  const progressPct = Math.round(
    (displayRound / season.totalRounds) * 100,
  );

  const liveAutoPauseReason =
    !liveAutoActive || liveTickerPlaying
      ? null
      : hasActive2DBroadcast
        ? '2D 경기 진행 중'
        : liveAutoResumePrompt !== null
          ? '진행 선택 대기'
          : liveAutoCupPromptOpen
            ? '컵대회 일시정지'
            : hasPendingFfpNotice
              ? 'FFP 재정 통지'
              : hasPendingStaffCoach
                ? '수석 코치 선임'
                : isTransferOpen
                  ? '이적시장 일시정지'
                  : hasPendingAwakening
                    ? '선수 포텐 각성'
                    : hasPendingAdaptation
                      ? '전술 적응 경고'
                      : hasPendingEvent
                        ? '인터뷰 일시정지'
                        : hasPendingInjury
                          ? '부상 알림 일시정지'
                          : uncelebratedCupWin
                            ? '컵 우승 축하'
                            : null;

  const controlsBlocked =
    hasPendingFfpNotice ||
    hasPendingStaffCoach ||
    season.transferMarket.isOpen ||
    Boolean(season.liveHalftime) ||
    skipFlowState === 'running' ||
    quickSkipModalOpen ||
    liveTickerPlaying;

  const navTabs: { id: SeasonTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    {
      id: 'match',
      label: '경기장/일정',
      icon: <Play className="w-3.5 h-3.5" />,
      badge: isNextCupMatch ? 'CUP' : undefined,
    },
    {
      id: 'cup',
      label: season.cup?.meta.koreanName ?? '자국 컵',
      icon: <Award className="w-3.5 h-3.5" />,
      badge: isNextCupMatch ? 'NOW' : undefined,
    },
    { id: 'squad', label: '스쿼드/전술', icon: <Users className="w-3.5 h-3.5" /> },
    { id: 'standings', label: '순위/기록', icon: <Trophy className="w-3.5 h-3.5" /> },
    {
      id: 'transfer',
      label: '이적시장',
      icon: <ArrowLeftRight className="w-3.5 h-3.5" />,
      badge: season.transferMarket.isOpen ? 'OPEN' : undefined,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-2.5 sm:px-4 py-2.5 sm:py-5 space-y-3 sm:space-y-5">
      {/* Compact Season Status + Clean Top 5-Tab Navigation */}
      <section className="rounded-xl sm:rounded-2xl border border-slate-800 bg-[#111822] p-2.5 sm:p-4 space-y-2 sm:space-y-3.5">
        <div className="flex flex-col gap-2 sm:gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span
                className="rounded px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-[11px] font-extrabold text-slate-950"
                style={{ backgroundColor: league.accentColor }}
              >
                {league.koreanName}
              </span>
              <span className="font-display text-[11px] sm:text-xs font-bold text-slate-200 tabular-nums">
                {displayRound}/{season.totalRounds}R
              </span>
              <span
                className={`rounded px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-[11px] font-bold ${
                  inUclZone
                    ? 'bg-emerald-500/15 text-emerald-300'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {userRank}위 · {userRow?.points ?? 0}점 ({userRow?.won ?? 0}승{' '}
                {userRow?.drawn ?? 0}무 {userRow?.lost ?? 0}패)
              </span>
              {season.cup && (
                <span className="rounded bg-amber-500/15 px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-[11px] font-bold text-amber-300">
                  🏆 {getUserCupResultLabel(season.cup, USER_CLUB_ID)}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] sm:text-xs text-slate-400 tabular-nums">
              <span>
                A <strong className="text-slate-200">{ratings.effectiveAtt}</strong> · M{' '}
                <strong className="text-slate-200">{ratings.effectiveMid}</strong> · D{' '}
                <strong className="text-slate-200">{ratings.effectiveDef}</strong>
              </span>
              <span className="inline-flex items-center gap-0.5 text-emerald-300 font-semibold">
                <Zap className="w-3 h-3" />
                {chemistry.total} ({chemistry.chemistryOvrBonus >= 0 ? '+' : ''}
                {chemistry.chemistryOvrBonus.toFixed(1)})
              </span>
              {(() => {
                const condMap = season.playerConditions;
                const teamMorale = season.managerEvents?.teamMorale ?? 0;
                const mTier = getMoraleTier(teamMorale);
                const injuredCount = [...state.starters, ...state.bench].filter(
                  (p) => p && isPlayerActivelyInjured(condMap?.[p.id]),
                ).length;

                return (
                  <>
                    <span
                      title="팀 사기 · 기자회견/라커룸 연설과 경기 결과에 연동"
                      className={`inline-flex items-center gap-1 font-semibold ${
                        mTier === 'ecstatic' || mTier === 'high'
                          ? 'text-amber-300'
                          : mTier === 'low' || mTier === 'frozen'
                            ? 'text-sky-300'
                            : 'text-slate-300'
                      }`}
                    >
                      {mTier === 'ecstatic' && (
                        <PixelStatusIcon variant="morale_high" size={11} />
                      )}
                      {mTier === 'frozen' && (
                        <PixelStatusIcon variant="morale_low" size={11} />
                      )}
                      사기 {getMoraleLabel(teamMorale)}
                    </span>
                    {injuredCount > 0 && (
                      <span
                        title="현재 우리 팀 부상자 수"
                        className="inline-flex items-center gap-1 rounded bg-rose-500/15 border border-rose-400/35 px-1.5 py-px text-[10px] font-bold text-rose-200"
                      >
                        <PixelStatusIcon variant="injury" size={10} />
                        부상 {injuredCount}
                      </span>
                    )}
                  </>
                );
              })()}
              {nextTransferRound !== null && (
                <span className="inline-flex items-center gap-0.5 text-amber-300/90 whitespace-nowrap">
                  <Calendar className="w-3 h-3" />
                  이적 {nextTransferRound}R
                </span>
              )}
              {season.budgetState && (
                <span className="inline-flex items-center gap-1">
                  <span
                    title={
                      season.budgetState.ffpTier >= 1
                        ? buildFfpPenaltyHelpItems(season.budgetState).join(' · ')
                        : `이적시장 협상에 얹을 수 있는 잔여 예산 €${season.budgetState.transferCashM}M`
                    }
                    className={`inline-flex items-center gap-1 rounded border px-1.5 py-px text-[10px] font-bold whitespace-nowrap tabular-nums ${
                      season.budgetState.ffpTier === 2
                        ? 'border-rose-500/45 bg-rose-500/18 text-rose-200'
                        : season.budgetState.ffpTier === 1
                          ? 'border-amber-400/45 bg-amber-500/15 text-amber-200'
                          : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    }`}
                  >
                    {season.budgetState.ffpTier >= 1
                      ? formatFfpBadgeSummary(season.budgetState.ffpTier)
                      : `자금 €${season.budgetState.transferCashM}M`}
                  </span>
                  {season.budgetState.ffpTier >= 1 && (
                    <InfoHelpButton
                      title={
                        season.budgetState.ffpTier === 2
                          ? `FFP 2단계 징계 적용 중 (+${season.budgetState.excessPct}%)`
                          : `FFP 1단계 주의 적용 중 (+${season.budgetState.excessPct}%)`
                      }
                      align="right"
                      size="xs"
                      guideTab="budget"
                      items={buildFfpPenaltyHelpItems(season.budgetState)}
                    />
                  )}
                </span>
              )}
              {season.staffCoach?.hiredCoachId && (
                <StaffCoachBadge
                  coachId={season.staffCoach.hiredCoachId}
                  activeTactic={activeTactic}
                  compact
                />
              )}
              <InfoHelpButton
                title="시즌 진행 · 자동진행 · 스킵 안내"
                align="right"
                size="xs"
                guideTab="legacy"
                items={[
                  '2D 중계: 직접 경기를 관전하며 하프타임(45\') 전술 수싸움 및 최대 5명 교체 지휘',
                  '라이브 자동진행(5/7/9초): 일시정지 후 [2D 경기 중계 입장]으로 멈춘 분 그대로 난입 가능',
                  '자동진행 중 [전술 수정] → [수정 확정]으로 다음 경기 전술 즉시 반영 · 컵/이적/부상 시 자동 멈춤',
                  '리그 4위 이내 진입 시 36팀 UEFA 챔피언스리그 자동 진출',
                ]}
              />
            </div>
          </div>

          {/* 5-Tab Clean Navigation */}
          <nav className="grid grid-cols-5 gap-1 rounded-xl border border-slate-800 bg-[#0b1018] p-1">
            {navTabs.map((t) => {
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className={`inline-flex items-center justify-center gap-1 rounded-lg px-1 py-1.5 sm:px-2 sm:py-2 text-[10px] sm:text-xs font-bold transition-colors cursor-pointer touch-manipulation ${
                    active
                      ? 'bg-slate-800 text-white border border-emerald-500/45 shadow-sm'
                      : 'text-slate-400 border border-transparent hover:text-slate-200'
                  }`}
                >
                  <span className={`hidden sm:inline-flex ${active ? 'text-emerald-300' : ''}`}>
                    {t.icon}
                  </span>
                  <span className="truncate">{t.label}</span>
                  {t.badge && (
                    <span className="rounded bg-amber-500/20 border border-amber-400/40 px-1 py-px text-[8px] font-extrabold text-amber-200">
                      {t.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Minimal Season Progress Bar */}
        <div className="relative h-1 sm:h-1.5 w-full rounded-full bg-slate-900">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
          {season.transferWindows.map((winRound, i) => {
            const leftPct = (winRound / season.totalRounds) * 100;
            const done = season.transferMarket.completedWindows.includes(i + 1);
            return (
              <div
                key={winRound}
                style={{ left: `${leftPct}%` }}
                title={`제 ${i + 1}차 이적시장 (${winRound}R 종료 후)`}
                className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full border border-slate-950 ${
                  done ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
            );
          })}
        </div>
      </section>

      {/* Solo Live Scoreboard + Real-Time Compact Standings Strip (PC side-by-side / Mobile stacked right below) */}
      {liveAutoActive && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12 items-start">
          <div className="lg:col-span-7">
            <SoloLiveScoreboard
              match={liveAutoMatch}
              clubsById={clubsById}
              myClubId={USER_CLUB_ID}
              durationMs={liveAutoDurationMs}
              onChangeDurationMs={setLiveAutoDurationMs}
              paused={
                liveAutoUserPaused ||
                tacticEditMode ||
                Boolean(liveAutoPauseReason)
              }
              pauseReasonLabel={
                liveAutoPauseReason ?? (tacticEditMode ? '전술 수정 중' : null)
              }
              noticeLabel={tacticNoticeLabel}
              tacticEditActive={tacticEditMode}
              onStartTacticEdit={
                liveAutoPauseReason ? undefined : handleStartLiveTacticEdit
              }
              onConfirmTacticEdit={() => {
                confirmTacticEdit();
                setLiveAutoUserPaused(false);
              }}
              onTogglePause={() => {
                if (liveAutoPauseReason || tacticEditMode) return;
                setLiveAutoUserPaused((p) => !p);
              }}
              onStop={stopLiveAuto}
              onMatchDone={handleLiveAutoMatchDone}
              onEnterLiveMatch={handleEnterLive2DFromStream}
            />
          </div>
          <div className="lg:col-span-5">
            <CompactLiveStandings
              title={`${league.koreanName} 실시간 순위`}
              standings={displayStandings}
              myClubId={USER_CLUB_ID}
              variant="league"
              uclSpots={league.uclSpots}
              relegationSpots={league.relegationSpots}
              roundLabel={`${displayRound}/${season.totalRounds}R`}
              onSelectClub={(teamId) => {
                const c = clubsById[teamId];
                if (c) setInspectedClub({ club: c, leagueId: season.leagueId });
              }}
            />
          </div>
        </div>
      )}

      {/* TAB 1: 경기장/일정 */}
      {activeTab === 'match' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Left: Next Match Preview & Live Controls (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            {nextOpponent && (
              <MatchDayTacticsRoom
                opponent={nextOpponent}
                opponentRoster={nextOpponentRoster}
                isHome={isNextHome}
                headerBadge={
                  isNextCupMatch && season.cup && pendingCupStage
                    ? `🏆 ${season.cup.meta.koreanName} ${CUP_STAGE_LABELS[pendingCupStage]} (단판 승부 · 동점 시 연장/PK)`
                    : `매치 데이 전술실 · ROUND ${nextRoundNumber}`
                }
                headerAccent={isNextCupMatch ? 'cup' : 'league'}
                activeTactic={activeTactic}
                defaultTactic={season.defaultTactic}
                formation={state.formation}
                starters={state.starters}
                bench={state.bench}
                chemistry={chemistry}
                managerTraitId={state.manager.traitId}
                tacticalHistory={season.tacticalAdaptation?.history}
                staffCoachId={season.staffCoach?.hiredCoachId ?? null}
                onSelectTactic={(tId) =>
                  setNextMatchTactic(tId === season.defaultTactic ? null : tId)
                }
                onChangeFormation={changeFormation}
                onSwapSquad={swapSquadPositions}
                onAutoOptimize={autoOptimizeLineup}
                onInspectPlayer={(p) =>
                  setInspectedPlayer({ playerId: p.id })
                }
                onClickOpponentPlayerName={(pid) =>
                  setInspectedPlayer({ playerId: pid })
                }
              >
                {/* Match Actions */}
                <div className="space-y-2">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
                    <button
                      id="play-next-round-btn"
                      type="button"
                      onClick={() => {
                        if (liveAutoActive && isNextCupMatch && liveAutoUserPaused) {
                          liveAutoNeedsPromptRef.current = 'cup';
                          setLiveAutoUserPaused(false);
                          startLiveMatch();
                        } else {
                          stopLiveAuto();
                          startLiveMatch();
                        }
                      }}
                      disabled={controlsBlocked}
                      className="sm:col-span-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-extrabold text-slate-950 hover:bg-emerald-400 disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      경기 진행 (2D 중계 · 하프타임)
                    </button>

                    <button
                      id="skip-one-match-btn"
                      type="button"
                      onClick={handleSingleMatchSkip}
                      disabled={controlsBlocked}
                      className="sm:col-span-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-emerald-500/45 bg-emerald-500/12 px-3 py-3 text-xs sm:text-sm font-extrabold text-emerald-200 hover:bg-emerald-500/22 disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      <FastForward className="w-4 h-4" />
                      1경기 스킵
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      id="solo-live-auto-btn"
                      type="button"
                      onClick={liveAutoActive ? stopLiveAuto : handleStartLiveAuto}
                      disabled={!liveAutoActive && controlsBlocked}
                      className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-colors cursor-pointer disabled:opacity-45 ${
                        liveAutoActive
                          ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30'
                          : 'border-sky-500/40 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20'
                      }`}
                    >
                      <Radio className={`w-3.5 h-3.5 ${liveAutoActive ? 'animate-pulse' : ''}`} />
                      {liveAutoActive ? '자동진행 중단' : '라이브 자동진행'}
                    </button>

                    <button
                      id="unified-skip-btn"
                      type="button"
                      onClick={handleStartUnifiedSkip}
                      disabled={controlsBlocked}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-amber-400/35 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-200 hover:bg-amber-500/20 disabled:opacity-45 cursor-pointer"
                    >
                      <SkipForward className="w-3.5 h-3.5" />
                      경기 스킵
                    </button>
                  </div>
                </div>
              </MatchDayTacticsRoom>
            )}

            {/* Recent Match History Strip */}
            {season.userMatchHistory.length > 0 && (
              <div className="rounded-2xl border border-slate-800 bg-[#111822] p-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                  <span>최근 경기 결과</span>
                  <span className="text-[10px] font-medium text-slate-500">
                    클릭하여 경기 상세 확인
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {[...season.userMatchHistory]
                    .reverse()
                    .slice(0, 6)
                    .map((m) => {
                      const isHome = m.homeTeamId === USER_CLUB_ID;
                      const opp = clubsById[isHome ? m.awayTeamId : m.homeTeamId];
                      const ug = isHome ? m.homeGoals : m.awayGoals;
                      const og = isHome ? m.awayGoals : m.homeGoals;
                      const badge =
                        ug > og
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : ug < og
                            ? 'bg-rose-500/15 text-rose-300'
                            : 'bg-slate-800 text-slate-300';
                      return (
                        <button
                          key={m.fixtureId}
                          type="button"
                          onClick={() => setInspectedMatch(m)}
                          className="flex items-center justify-between rounded-lg border border-transparent bg-[#0b1018] px-3 py-2 text-left text-xs tabular-nums transition-colors hover:border-emerald-500/40 cursor-pointer"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[10px] text-slate-500">
                              {m.round}R
                            </span>
                            <span className="truncate font-semibold text-slate-200">
                              {isHome ? 'vs' : '@'} {opp?.name ?? '상대'}
                            </span>
                          </div>
                          <span className={`rounded px-2 py-0.5 font-display font-bold ${badge}`}>
                            {ug} - {og}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </div>
            )}
          </div>

          {/* Right: Latest Match Report + League Top Scorers & Assisters Side Card (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            {displayLastMatch ? (
              <MatchReportPanel
                match={displayLastMatch}
                clubsById={clubsById}
                onSelectPlayer={(playerId) => setInspectedPlayer({ playerId })}
                onOpenDetail={(m) => setInspectedMatch(m)}
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-800 bg-[#111822]/70 p-6 text-center text-xs text-slate-400">
                <strong className="block text-sm text-white mb-1">
                  {league.koreanName} 2026-27 개막 준비 완료
                </strong>
                <span>
                  {season.replacedClubName}을(를) 대신해 참가했습니다. 상대 전술과 포메이션을 확인하고 개막전을 지휘하세요.
                </span>
              </div>
            )}

            {!liveAutoActive && (
              <CompactLiveStandings
                title={`${league.koreanName} 실시간 순위`}
                standings={displayStandings}
                myClubId={USER_CLUB_ID}
                variant="league"
                uclSpots={league.uclSpots}
                relegationSpots={league.relegationSpots}
                roundLabel={`${displayRound}/${season.totalRounds}R`}
                onSelectClub={(teamId) => {
                  const c = clubsById[teamId];
                  if (c) setInspectedClub({ club: c, leagueId: season.leagueId });
                }}
              />
            )}

            {season.currentRound > 0 && (() => {
              const leagueList = Object.values(season.allPlayerStats).filter(
                (s) => s.appearances > 0,
              );
              const sideScorers = [...leagueList]
                .filter((s) => s.goals > 0)
                .sort((a, b) => b.goals - a.goals || b.assists - a.assists)
                .slice(0, 5);
              const sideAssisters = [...leagueList]
                .filter((s) => s.assists > 0)
                .sort((a, b) => b.assists - a.assists || b.goals - a.goals)
                .slice(0, 5);
              return (
                <LeagueLeadersSideCard
                  scorers={sideScorers}
                  assisters={sideAssisters}
                  myClubId={USER_CLUB_ID}
                  maxRows={5}
                  desktopLayout="stack"
                  onSelectPlayer={(entry) =>
                    setInspectedPlayer({
                      playerId: entry.playerId,
                      fallbackStats: entry,
                    })
                  }
                />
              );
            })()}
          </div>
        </div>
      )}

      {/* TAB 2: 스쿼드/전술 */}
      {activeTab === 'squad' && (
        <SquadManagerModal
          embedded
          liveAutoEdit={
            liveAutoActive
              ? {
                  editing: tacticEditMode,
                  onStartEdit: startTacticEdit,
                  onConfirmEdit: () => {
                    confirmTacticEdit();
                    setLiveAutoUserPaused(false);
                  },
                }
              : undefined
          }
        />
      )}

      {/* TAB 3: 순위/기록 (5대 리그 전환 지원) */}
      {activeTab === 'standings' && (
        <div className="space-y-4">
          {/* 5대 리그 전환 탭 */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-800 bg-[#111822] p-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
              <Globe className="w-4 h-4 text-emerald-400" />
              유럽 5대 리그 실시간 순위표
            </div>
            <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-800 bg-[#0b1018] p-1">
              {LEAGUES.map((lg) => {
                const active = viewedLeagueId === lg.id;
                const isMine = lg.id === season.leagueId;
                return (
                  <button
                    key={lg.id}
                    type="button"
                    onClick={() => setStandingsLeagueId(lg.id)}
                    className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                      active
                        ? 'bg-slate-800 text-white border-emerald-500/50'
                        : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-900/60'
                    }`}
                  >
                    <span>{lg.koreanName}</span>
                    {isMine && (
                      <span
                        className={`rounded px-1 text-[8px] font-black ${
                          active
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-slate-800 text-emerald-300/80'
                        }`}
                      >
                        MY
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <StandingsTable
                standings={viewedStandings}
                clubsById={viewedClubsById}
                uclSpots={viewedLeagueMeta.uclSpots}
                relegationSpots={viewedLeagueMeta.relegationSpots}
                onSelectClub={(clubId) => {
                  const club = viewedClubsById[clubId];
                  if (club) {
                    setInspectedClub({ club, leagueId: viewedLeagueId });
                  }
                }}
              />
            </div>

            <div className="lg:col-span-5 space-y-4">
              {!isViewingUserLeague && (
                <div className="rounded-2xl border border-slate-800 bg-[#111822] p-4 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="rounded px-2 py-0.5 text-[11px] font-extrabold text-slate-950"
                        style={{ backgroundColor: viewedLeagueMeta.accentColor }}
                      >
                        {viewedLeagueMeta.koreanName}
                      </span>
                      <span className="text-xs font-bold text-slate-300 tabular-nums">
                        {viewedBgLeague?.currentRound ?? 0} /{' '}
                        {viewedLeagueMeta.totalRounds}R 진행 중
                      </span>
                    </div>
                    {viewedBgLeague?.cup && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/35 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                        <Trophy className="w-3 h-3" />
                        {viewedBgLeague.cup.completed && viewedBgLeague.cup.championTeamId
                          ? `${viewedBgLeague.cup.meta.koreanName} 우승: ${
                              viewedClubsById[viewedBgLeague.cup.championTeamId]?.name ??
                              viewedBgLeague.cup.championTeamId
                            }`
                          : `${viewedBgLeague.cup.meta.koreanName} 진행 중`}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-400">
                    실제 2026-27 구단 스쿼드로 리그·자국 컵이 실시간 시뮬레이션되며, 개인 기록은 발롱도르·월드베스트 XI에 동일 기준으로 반영됩니다.
                  </p>
                </div>
              )}

              <div className="rounded-2xl border border-slate-800 bg-[#111822] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                    <Award className="w-4 h-4 text-amber-400" />
                    {viewedLeagueMeta.koreanName} 개인 기록 TOP 10
                  </div>
                  <span className="text-[10px] text-slate-500">
                    선수 이름 클릭 시 세부 스탯
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-1 rounded-lg bg-[#0b1018] p-1 text-[11px]">
                  {(
                    [
                      ['goals', '득점'],
                      ['assists', '도움'],
                      ['cleanSheets', '클린시트'],
                      ['rating', '평점'],
                    ] as [RecordSubTab, string][]
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setRecordTab(id)}
                      className={`rounded-md border py-1.5 font-bold cursor-pointer transition-colors ${
                        recordTab === id
                          ? 'bg-slate-800 text-white border-emerald-500/50'
                          : 'border-transparent text-slate-400 hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {activeLeaderboard.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-500">
                    아직 집계된 기록이 없습니다.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {activeLeaderboard.map((entry, idx) => (
                      <div
                        key={`${entry.teamId}-${entry.playerId}`}
                        className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs tabular-nums ${
                          entry.isUserTeam
                            ? 'bg-emerald-500/15 border border-emerald-500/35'
                            : 'bg-[#0b1018] border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-display w-4 shrink-0 text-slate-500 font-bold text-center">
                            {idx + 1}
                          </span>
                          {(() => {
                            const nat = getPlayerNationalityMeta(entry.playerId);
                            return nat ? (
                              <CountryFlagSvg
                                code={nat.nationalityCode}
                                nationality={nat.nationality}
                                size="xs"
                              />
                            ) : null;
                          })()}
                          <PlayerNameButton
                            onClick={() =>
                              setInspectedPlayer({
                                playerId: entry.playerId,
                                fallbackStats: entry,
                              })
                            }
                            className="font-bold text-slate-100"
                          >
                            {entry.playerName}
                          </PlayerNameButton>
                          <ClubTag
                            shortName={entry.teamShortName}
                            primaryColor={entry.teamPrimaryColor}
                            isUserTeam={entry.isUserTeam}
                          />
                        </div>
                        <span className="font-display text-sm font-bold text-emerald-300 shrink-0">
                          {recordTab === 'goals' && `${entry.goals}골`}
                          {recordTab === 'assists' && `${entry.assists}도움`}
                          {recordTab === 'cleanSheets' && `${entry.cleanSheets}CS`}
                          {recordTab === 'rating' && entry.avgRating.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: 자국 컵 토너먼트 */}
      {activeTab === 'cup' && season.cup && (
        <div className="space-y-4">
          {isNextCupMatch && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/50 bg-amber-950/20 p-4">
              <div>
                <div className="text-xs font-black text-amber-300">
                  🏆 {season.cup.meta.koreanName}{' '}
                  {pendingCupStage ? CUP_STAGE_LABELS[pendingCupStage] : ''} 경기 대기 중
                </div>
                <p className="mt-0.5 text-xs text-slate-300">
                  상대: <strong className="text-white">{nextOpponent?.name}</strong> · 단판 토너먼트 (90분 동점 시 연장전·승부차기)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('match')}
                  disabled={controlsBlocked}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-4 py-2 text-xs font-black text-slate-950 hover:bg-amber-300 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  컵 프리뷰 · 2D 지휘
                </button>
                <button
                  type="button"
                  onClick={handleSingleMatchSkip}
                  disabled={controlsBlocked}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/40 bg-amber-500/15 px-3 py-2 text-xs font-bold text-amber-200 hover:bg-amber-500/25 cursor-pointer"
                >
                  <FastForward className="w-3.5 h-3.5" />
                  1경기 스킵
                </button>
              </div>
            </div>
          )}
          <CupBracketView
            cup={season.cup}
            clubs={season.clubs}
            leagueId={season.leagueId}
            onSelectMatch={(m) => setInspectedMatch(m)}
          />
        </div>
      )}

      {/* TAB 4: 이적시장 */}
      {activeTab === 'transfer' && (
        <div className="space-y-5">
          {season.transferMarket.isOpen ? (
            <TransferMarketModal embedded />
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-[#111822] p-6 text-center space-y-2">
              <ArrowLeftRight className="mx-auto w-7 h-7 text-slate-500" />
              <h3 className="text-base font-bold text-white">
                {nextTransferRound !== null
                  ? `다음 이적시장: ${nextTransferRound}라운드 종료 후 개장`
                  : '이번 시즌 이적시장이 모두 마감되었습니다'}
              </h3>
              <p className="text-xs text-slate-400">
                이적시장 개장 시 3구단 룰렛으로 추첨된 구단의 2026-27 스쿼드를 탐색하고 최대 3회 영입 협상을 시도할 수 있습니다. (리그 4위 이내 시 레전드 FA 4.0%)
              </p>
            </div>
          )}

          {/* Transfer History */}
          <div className="rounded-2xl border border-slate-800 bg-[#111822] p-4 space-y-3">
            <div className="text-xs font-bold text-slate-300">
              시즌 이적 내역 ({season.transferMarket.history.length}건)
            </div>
            {season.transferMarket.history.length === 0 ? (
              <p className="text-xs text-slate-500">아직 완료된 이적이 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {season.transferMarket.history.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#0b1018] px-3 py-2.5 text-xs"
                  >
                    <span className="text-[11px] font-semibold text-slate-500">
                      제 {item.windowIndex}차 ({item.round}R)
                      {item.marketValueM ? ` · €${item.marketValueM}M` : ''}
                    </span>
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-rose-300 line-through">
                        {item.outPlayer.name} ({item.outPlayer.ovr})
                      </span>
                      <span className="text-slate-600">→</span>
                      <span className="font-bold text-emerald-300">
                        {item.inPlayer.name} ({item.inPlayer.ovr})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Real-Time Match Broadcast Modal (0' -> 45' HT -> 90' FT -> ET/PK) */}
      {shouldRenderLiveMatchBroadcast(season.liveHalftime) && (
        <LiveMatchBroadcast clubsById={clubsById} />
      )}

      {/* Fast-Forward Unified Simulation Modal */}
      <FastSimModal
        mode={skipFlowState === 'running' ? 'unified' : null}
        clubsById={clubsById}
        onPausedForTransfer={() => setSkipFlowState('paused_for_transfer')}
        onOpenCupPreview={() => {
          setSkipFlowState('idle');
          setActiveTab('match');
        }}
        onClose={() => setSkipFlowState('idle')}
      />

      {/* 1-Match Instant Skip Summary Modal */}
      {quickSkipModalOpen && season.lastUserMatch && (() => {
        const m = season.lastUserMatch;
        const home = clubsById[m.homeTeamId];
        const away = clubsById[m.awayTeamId];
        if (!home || !away) return null;
        const isHome = m.homeTeamId === USER_CLUB_ID;
        const ug = isHome ? m.homeGoals : m.awayGoals;
        const og = isHome ? m.awayGoals : m.homeGoals;
        const userWonPk =
          m.extraTime?.penalties &&
          m.extraTime.penalties.winnerTeamId === USER_CLUB_ID;
        const userLostPk =
          m.extraTime?.penalties &&
          m.extraTime.penalties.winnerTeamId !== USER_CLUB_ID;
        const outcome = userWonPk
          ? '승부차기 승'
          : userLostPk
            ? '승부차기 패'
            : ug > og
              ? '승리'
              : ug < og
                ? '패배'
                : '무승부';
        const outcomeCls =
          userWonPk || ug > og
            ? 'bg-emerald-500 text-slate-950'
            : userLostPk || ug < og
              ? 'bg-rose-500 text-white'
              : 'bg-slate-600 text-white';
        const goalEvents = m.events.filter((e) => e.type === 'goal');

        return (
          <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-slate-950/88 p-4">
            <ModalBodyLock />
            <div className="modal-panel flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-700 bg-[#0f1621] shadow-2xl">
              <div className="flex shrink-0 items-center justify-between border-b border-slate-800 bg-[#0a0f17] px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <span className={`rounded px-2 py-0.5 text-[11px] font-black ${outcomeCls}`}>
                    {outcome}
                  </span>
                  <span className="font-display text-sm font-bold text-white">
                    {m.competitionLabel ?? `ROUND ${m.round}`} 경기 결과 요약
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setQuickSkipModalOpen(false)}
                  className="rounded-lg border border-slate-700 bg-slate-900 p-1 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="modal-scroll flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
                {/* Scoreboard */}
                <div className="grid grid-cols-3 items-center text-center gap-2 rounded-xl border border-slate-800 bg-[#0b1018] p-4">
                  <div className="flex flex-col items-center">
                    <JerseySvg
                      primaryColor={home.primaryColor}
                      secondaryColor={home.secondaryColor}
                      pattern={home.pattern}
                      label={home.shortName}
                      size={42}
                    />
                    <span
                      className={`mt-1.5 text-xs font-bold ${
                        home.isUser ? 'text-emerald-300' : 'text-white'
                      }`}
                    >
                      {home.name}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {m.homeFormation} · {TACTICS[m.homeTactic].shortName}
                    </span>
                  </div>

                  <div className="font-display text-4xl font-bold text-white tabular-nums">
                    {m.homeGoals} <span className="text-slate-600">:</span>{' '}
                    {m.awayGoals}
                  </div>

                  <div className="flex flex-col items-center">
                    <JerseySvg
                      primaryColor={away.primaryColor}
                      secondaryColor={away.secondaryColor}
                      pattern={away.pattern}
                      label={away.shortName}
                      size={42}
                    />
                    <span
                      className={`mt-1.5 text-xs font-bold ${
                        away.isUser ? 'text-emerald-300' : 'text-white'
                      }`}
                    >
                      {away.name}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {m.awayFormation} · {TACTICS[m.awayTactic].shortName}
                    </span>
                  </div>
                </div>

                {/* Goal & Assist List */}
                <div className="rounded-xl border border-slate-800 bg-[#0b1018] p-3 space-y-1.5">
                  <div className="text-[11px] font-bold text-slate-400">
                    득점 · 도움 기록
                  </div>
                  {goalEvents.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      양 팀 득점 없이 무승부로 종료되었습니다.
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {goalEvents.map((ev, idx) => {
                        const evClub = clubsById[ev.teamId];
                        return (
                          <div
                            key={`${ev.minute}-${idx}`}
                            className="flex items-center gap-2 text-xs"
                          >
                            <span className="w-7 font-display font-bold text-slate-500 tabular-nums">
                              {ev.minute}&apos;
                            </span>
                            {evClub && (
                              <ClubTag
                                shortName={evClub.shortName}
                                primaryColor={evClub.primaryColor}
                                isUserTeam={evClub.id === USER_CLUB_ID}
                              />
                            )}
                            <span className="font-bold text-white">
                              ⚽ {ev.scorerName}
                            </span>
                            {ev.assistName && (
                              <span className="text-[11px] text-slate-400">
                                (도움: {ev.assistName})
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Stats Strip */}
                <div className="grid grid-cols-4 gap-2 text-center tabular-nums">
                  <div className="rounded-lg bg-[#0b1018] p-2">
                    <div className="text-[10px] text-slate-500">점유율</div>
                    <div className="font-display text-sm font-bold text-white">
                      {m.homePossession}%:{100 - m.homePossession}%
                    </div>
                  </div>
                  <div className="rounded-lg bg-[#0b1018] p-2">
                    <div className="text-[10px] text-slate-500">xG</div>
                    <div className="font-display text-sm font-bold text-emerald-300">
                      {m.homeXg.toFixed(2)}:{m.awayXg.toFixed(2)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-[#0b1018] p-2">
                    <div className="text-[10px] text-slate-500">슈팅</div>
                    <div className="font-display text-sm font-bold text-white">
                      {m.homeShots}:{m.awayShots}
                    </div>
                  </div>
                  <div className="rounded-lg bg-[#0b1018] p-2">
                    <div className="text-[10px] text-slate-500">유효슈팅</div>
                    <div className="font-display text-sm font-bold text-sky-300">
                      {m.homeShotsOnTarget}:{m.awayShotsOnTarget}
                    </div>
                  </div>
                </div>

                {/* MOM + Confirm CTA */}
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-400/30 bg-amber-950/20 px-3.5 py-2.5 text-xs">
                  <span className="inline-flex items-center gap-1.5 font-bold text-amber-200">
                    <Star className="w-3.5 h-3.5 text-amber-300 fill-current" />
                    MOM: {m.momPlayerName} ({m.momRating.toFixed(1)})
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuickSkipModalOpen(false)}
                    className="rounded-lg bg-emerald-500 px-4 py-1.5 text-xs font-extrabold text-slate-950 hover:bg-emerald-400 cursor-pointer"
                  >
                    {season.transferMarket.isOpen
                      ? '이적시장 입장 →'
                      : '다음 라운드로 →'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Domestic Cup Victory Pixel Trophy Celebration Modal (live match, 1-match skip, or fast-sim) */}
      {season.cup?.completed &&
        didUserWinCup(season.cup, USER_CLUB_ID) &&
        !season.cupChampionCelebrated &&
        !season.liveHalftime &&
        !liveTickerPlaying &&
        skipFlowState !== 'running' &&
        !quickSkipModalOpen && (
          <CupChampionModal
            cup={season.cup}
            leagueId={season.leagueId}
            userClub={state.userClub}
            managerName={state.manager.name}
            managerAvatar={state.manager.avatar}
            clubsById={clubsById}
            onClose={markCupCelebrated}
          />
        )}

      {/* Mid-Season Transfer Market Modal (auto-pops when opened outside transfer tab & not in fast-sim/quick-skip/live-ticker) */}
      {activeTab !== 'transfer' &&
        skipFlowState !== 'running' &&
        !liveTickerPlaying &&
        !quickSkipModalOpen &&
        !hasPendingStaffCoach && <TransferMarketModal />}

      {/* Post-Transfer Skip Resume Prompt ([계속 스킵] vs [일시중지]) */}
      {skipFlowState === 'prompt_resume' &&
        !season.transferMarket.isOpen &&
        state.phase === 'season' &&
        (season.currentRound < season.totalRounds || Boolean(pendingCupNode)) && (
          <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4">
            <ModalBodyLock />
            <div className="modal-panel w-full max-w-sm rounded-2xl border border-slate-700 bg-[#111822] p-5 shadow-2xl space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300">
                  <SkipForward className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-white">
                    이적시장 종료
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">
                    {nextTransferRound !== null
                      ? `다음 이적시장(${nextTransferRound}R)까지 계속 스킵할까요?`
                      : `시즌 종료(${season.totalRounds}R)까지 계속 스킵할까요?`}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  id="skip-transfer-pause-btn"
                  type="button"
                  onClick={() => setSkipFlowState('idle')}
                  className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-bold text-slate-300 hover:text-white cursor-pointer"
                >
                  일시중지
                </button>
                <button
                  id="skip-transfer-resume-btn"
                  type="button"
                  onClick={() => setSkipFlowState('running')}
                  className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-extrabold text-slate-950 hover:bg-emerald-400 cursor-pointer"
                >
                  계속 스킵
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Live Auto-Advance Domestic Cup Alert Popup */}
      {liveAutoCupPromptOpen && pendingCupNode && pendingCupStage && season.cup && (() => {
        const cupOpp =
          clubsById[
            pendingCupNode.homeTeamId === USER_CLUB_ID
              ? pendingCupNode.awayTeamId
              : pendingCupNode.homeTeamId
          ];
        return (
          <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4">
            <ModalBodyLock />
            <div className="modal-panel w-full max-w-md rounded-2xl border border-amber-400/45 bg-[#111822] p-5 shadow-2xl space-y-4">
              <div className="flex items-center gap-3.5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-500/10">
                  <PixelTrophySvg
                    variant={getDomesticCupTrophyVariant(season.leagueId)}
                    size={34}
                  />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-amber-300">
                    🏆 자국 컵대회 도달 · 자동진행 일시정지
                  </div>
                  <h3 className="mt-0.5 text-sm font-extrabold text-white">
                    {season.cup.meta.koreanName} {CUP_STAGE_LABELS[pendingCupStage]} vs{' '}
                    <span className="text-emerald-300">{cupOpp?.name ?? '상대팀'}</span>
                  </h3>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={stopLiveAuto}
                  className="rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-bold text-slate-300 hover:text-white cursor-pointer"
                >
                  자동진행 중단
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLiveAutoCupPromptOpen(false);
                    launchNextLiveAutoMatch(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-sky-500/45 bg-sky-500/15 px-3.5 py-2 text-xs font-bold text-sky-200 hover:bg-sky-500/25 cursor-pointer"
                >
                  <Radio className="w-3.5 h-3.5" />
                  스코어보드 진행
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLiveAutoCupPromptOpen(false);
                    setLiveAutoUserPaused(true);
                    setActiveTab('match');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-extrabold text-slate-950 hover:bg-emerald-400 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  프리뷰 후 2D 지휘
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Live Auto-Advance Resume Confirmation Modal (after Cup/2D play, Transfer Market, or Injury) */}
      {liveAutoActive &&
        liveAutoResumePrompt !== null &&
        !liveTickerPlaying &&
        !hasActive2DBroadcast &&
        !hasPendingStaffCoach &&
        !isTransferOpen &&
        !hasPendingInjury &&
        !hasPendingAwakening &&
        !hasPendingAdaptation &&
        !hasPendingEvent && (
          <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4">
            <ModalBodyLock />
            <div className="modal-panel w-full max-w-sm rounded-2xl border border-slate-700 bg-[#111822] p-5 shadow-2xl space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300">
                  <Radio className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-white">
                    {LIVE_AUTO_RESUME_COPY[liveAutoResumePrompt].title}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">
                    {LIVE_AUTO_RESUME_COPY[liveAutoResumePrompt].subtitle}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  id="live-auto-resume-pause-btn"
                  type="button"
                  onClick={() => {
                    setLiveAutoResumePrompt(null);
                    setLiveAutoUserPaused(true);
                  }}
                  className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-bold text-slate-300 hover:text-white cursor-pointer"
                >
                  일시정지
                </button>
                <button
                  id="live-auto-resume-continue-btn"
                  type="button"
                  onClick={() => {
                    setLiveAutoResumePrompt(null);
                    setLiveAutoUserPaused(false);
                  }}
                  className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-extrabold text-slate-950 hover:bg-emerald-400 cursor-pointer"
                >
                  이어서 자동진행
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Club Squad Modal */}
      <ClubSquadModal
        club={inspectedClub?.club ?? null}
        roster={
          inspectedClub
            ? resolveClubRoster({
                clubId: inspectedClub.club.id,
                club: inspectedClub.club,
                leagueId: inspectedClub.leagueId,
                season,
                userStarters: state.starters,
                userBench: state.bench,
              })
            : []
        }
        statsMap={
          inspectedClub?.leagueId && inspectedClub.leagueId !== season.leagueId
            ? (season.otherLeagues?.[inspectedClub.leagueId]?.playerStats ??
              season.allPlayerStats)
            : season.allPlayerStats
        }
        conditionMap={season.playerConditions}
        onSelectPlayer={(player) => {
          setInspectedClub(null);
          setInspectedPlayer({ playerId: player.id });
        }}
        onClose={() => setInspectedClub(null)}
      />

      {/* Match Detail Modal */}
      <MatchDetailModal
        key={inspectedMatch?.fixtureId ?? 'season-match-detail'}
        match={inspectedMatch}
        clubsById={clubsById}
        onSelectPlayer={(playerId) => setInspectedPlayer({ playerId })}
        onClose={() => setInspectedMatch(null)}
      />

      {/* Player Detail Modal with Competition Breakdown */}
      {inspectedPlayer && (() => {
        const resolved = resolvePlayerById({
          playerId: inspectedPlayer.playerId,
          starters: state.starters,
          bench: state.bench,
          season,
          fallbackStats: inspectedPlayer.fallbackStats,
        });
        const breakdown = buildPlayerCompetitionBreakdown(
          inspectedPlayer.playerId,
          season,
          inspectedPlayer.fallbackStats,
        );
        const starterIdx = resolved
          ? state.starters.findIndex((p) => p?.id === resolved.id)
          : -1;
        const matchedSlotSynergy =
          starterIdx >= 0 ? chemistry.slotSynergies?.[starterIdx] ?? null : null;
        const matchedSlotSubPos =
          starterIdx >= 0
            ? FORMATIONS[state.formation]?.slots[starterIdx]?.subPosition
            : undefined;
        return (
          <PlayerDetailModal
            player={resolved}
            slotSubPosition={matchedSlotSubPos}
            managerTraitId={state.manager.traitId}
            slotSynergy={matchedSlotSynergy}
            seasonStats={breakdown.total}
            competitionStats={breakdown}
            condition={
              resolved ? season.playerConditions?.[resolved.id] ?? null : null
            }
            onClose={() => setInspectedPlayer(null)}
          />
        );
      })()}
    </div>
  );
}
