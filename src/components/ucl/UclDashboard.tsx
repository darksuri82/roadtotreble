import {
  Award,
  Check,
  FastForward,
  Play,
  Radio,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Trophy,
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
import type { Player, SubPosition } from '../../types/player';
import type { UclKnockoutTie, UclTournamentState } from '../../types/ucl';
import {
  buildPlayerCompetitionBreakdown,
  getPlayerNationalityMeta,
  resolveClubRoster,
  resolvePlayerById,
} from '../../utils/playerLookup';
import { useSoloTacticEditSession } from '../../hooks/useSoloTacticEditPause';
import { ClubSquadModal } from '../common/ClubSquadModal';
import { CompactLiveStandings } from '../common/CompactLiveStandings';
import { CountryFlagSvg } from '../common/CountryFlagSvg';
import { InfoHelpButton } from '../common/InfoHelpButton';
import { JerseySvg } from '../common/JerseySvg';
import { ManagerTraitBadgeCard } from '../common/ManagerTraitBadgeCard';
import { MatchDetailModal } from '../common/MatchDetailModal';
import { PitchBoard, type SlotRef } from '../common/PitchBoard';
import { PixelStatusIcon } from '../common/PixelStatusIcon';
import { PixelTrophySvg } from '../common/PixelTrophySvg';
import { PlayerDetailModal } from '../common/PlayerDetailModal';
import { PlayerNameButton } from '../common/PlayerNameButton';
import {
  matchResultToCastMatch,
  SoloLiveScoreboard,
} from '../common/SoloLiveScoreboard';
import type { SoloLiveDurationMs } from '../common/SoloLiveScoreboard';
import {
  LiveMatchBroadcast,
  shouldRenderLiveMatchBroadcast,
} from '../league/LiveMatchBroadcast';
import { MatchDayTacticsRoom } from '../league/MatchDayTacticsRoom';
import { TransferMarketModal } from '../transfer/TransferMarketModal';
import { UclBracketTree } from './UclBracketTree';
import { UclLeaguePhaseFastSimModal } from './UclLeaguePhaseFastSimModal';
import { UclLeaguePhaseStandingsModal } from './UclLeaguePhaseStandingsModal';
import {
  UclMilestoneModal,
  type UclMilestoneStage,
} from './UclMilestoneModal';

type UclTab = 'match' | 'standings' | 'bracket' | 'stats' | 'squad';
type UclLiveAutoResumeReason = 'live_match' | 'transfer' | 'injury';

const UCL_LIVE_AUTO_RESUME_COPY: Record<
  UclLiveAutoResumeReason,
  { title: string; subtitle: string }
> = {
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
    enterLiveBroadcastFromStream,
    cancelSoloStreamMatch,
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

  // Solo UCL League Phase Live Scoreboard Auto-Advance (5s / 7s / 9s)
  const [liveAutoActive, setLiveAutoActive] = useState(false);
  const [liveAutoUserPaused, setLiveAutoUserPaused] = useState(false);
  const [liveAutoDurationMs, setLiveAutoDurationMs] =
    useState<SoloLiveDurationMs>(5000);
  const [liveAutoResumePrompt, setLiveAutoResumePrompt] =
    useState<UclLiveAutoResumeReason | null>(null);
  const liveAutoNeedsPromptRef = useRef<UclLiveAutoResumeReason | null>(null);

  const season = state.season;
  const ucl = season?.ucl ?? null;

  const streamHalftime = season?.liveHalftime?.streamAutoMode
    ? season.liveHalftime
    : null;
  const liveTickerPlaying = Boolean(streamHalftime);

  const liveAutoMatch = useMemo(() => {
    if (!streamHalftime?.fullMatchResult) return null;
    const label =
      streamHalftime.competitionLabel ||
      `UCL 리그 페이즈 ${streamHalftime.round}R`;
    return matchResultToCastMatch(
      streamHalftime.fullMatchResult,
      label,
      USER_CLUB_ID,
    );
  }, [streamHalftime]);

  useEffect(() => {
    setSoloTickerPlaying(liveTickerPlaying);
  }, [liveTickerPlaying, setSoloTickerPlaying]);

  useEffect(() => {
    return () => {
      setSoloTickerPlaying(false);
    };
  }, [setSoloTickerPlaying]);

  const isTransferOpen = Boolean(season?.transferMarket.isOpen);
  const hasPendingInjury = Boolean(
    season?.pendingInjuryAlerts && season.pendingInjuryAlerts.length > 0,
  );
  const hasPendingEvent = Boolean(
    season?.managerEvents?.activeEvent || season?.managerEvents?.lastResolution,
  );
  const hasActive2DBroadcast = Boolean(
    season?.liveHalftime && !season.liveHalftime.streamAutoMode,
  );

  // Ask [이어서 자동진행 / 일시정지] after transfer window or injury alert (interviews auto-continue)
  useEffect(() => {
    if (!liveAutoActive) return;
    if (isTransferOpen) {
      liveAutoNeedsPromptRef.current = 'transfer';
    } else if (hasPendingInjury) {
      liveAutoNeedsPromptRef.current = 'injury';
    }
  }, [liveAutoActive, isTransferOpen, hasPendingInjury]);

  const launchNextUclLiveMatch = useCallback(() => {
    if (!season || !ucl || ucl.stage !== 'league_phase' || ucl.leaguePhaseRound >= 8) {
      setLiveAutoActive(false);
      return;
    }
    startSoloStreamMatch();
  }, [season, ucl, startSoloStreamMatch]);

  const handleUclLiveMatchDone = useCallback(() => {
    commitLiveMatch();
  }, [commitLiveMatch]);

  const handleEnterLive2DFromStream = useCallback(
    (minute: number, inPenalties: boolean) => {
      liveAutoNeedsPromptRef.current = 'live_match';
      setLiveAutoUserPaused(false);
      enterLiveBroadcastFromStream(minute, inPenalties);
    },
    [enterLiveBroadcastFromStream],
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
    matchScopeKey:
      streamHalftime?.fixtureId ??
      `ucl-gap:${ucl?.leaguePhaseRound ?? 0}:${ucl?.stage ?? ''}:${ucl?.knockoutLeg ?? 0}`,
  });

  const handleStartLiveTacticEdit = useCallback(() => {
    startTacticEdit();
    setTab('squad');
  }, [startTacticEdit]);

  const stopUclLiveAuto = useCallback(() => {
    liveAutoNeedsPromptRef.current = null;
    resetTacticEdit();
    setLiveAutoActive(false);
    setLiveAutoUserPaused(false);
    setLiveAutoResumePrompt(null);
    cancelSoloStreamMatch();
    setSoloTickerPlaying(false);
  }, [cancelSoloStreamMatch, setSoloTickerPlaying, resetTacticEdit]);

  const liveAutoBlocked =
    isTransferOpen ||
    hasActive2DBroadcast ||
    hasPendingInjury ||
    hasPendingEvent ||
    tacticEditMode ||
    liveAutoResumePrompt !== null;

  useEffect(() => {
    if (
      !season ||
      !ucl ||
      !liveAutoActive ||
      liveAutoUserPaused ||
      liveTickerPlaying ||
      liveAutoBlocked
    ) {
      return;
    }
    if (ucl.stage !== 'league_phase' || ucl.leaguePhaseRound >= 8) {
      liveAutoNeedsPromptRef.current = null;
      const stopT = window.setTimeout(() => setLiveAutoActive(false), 0);
      return () => window.clearTimeout(stopT);
    }
    if (liveAutoNeedsPromptRef.current !== null) {
      const reason = liveAutoNeedsPromptRef.current;
      liveAutoNeedsPromptRef.current = null;
      const promptT = window.setTimeout(() => setLiveAutoResumePrompt(reason), 80);
      return () => window.clearTimeout(promptT);
    }
    const timer = window.setTimeout(() => {
      launchNextUclLiveMatch();
    }, 620);
    return () => window.clearTimeout(timer);
  }, [
    season,
    ucl,
    liveAutoActive,
    liveAutoUserPaused,
    liveTickerPlaying,
    liveAutoBlocked,
    launchNextUclLiveMatch,
  ]);

  const liveAutoPauseReason =
    !liveAutoActive || liveTickerPlaying
      ? null
      : hasActive2DBroadcast
        ? '2D 경기 진행 중'
        : liveAutoResumePrompt !== null
          ? '진행 선택 대기'
          : isTransferOpen
            ? '이적시장 일시정지'
            : hasPendingEvent
              ? '인터뷰 일시정지'
              : hasPendingInjury
                ? '부상 알림 일시정지'
                : null;

  const prevLpRoundRef = useRef<number>(ucl?.leaguePhaseRound ?? 0);
  useEffect(() => {
    if (!ucl) return;
    const prevRound = prevLpRoundRef.current;
    const currRound = ucl.leaguePhaseRound;
    if (prevRound < 8 && currRound >= 8) {
      prevLpRoundRef.current = currRound;
      setShowLpSummary(true);
      // Automatically pop up the 36-team League Phase Final Standings modal when 8R completes
      setLpStandingsModalOpen(true);
    } else if (prevRound !== currRound) {
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
        if (
          curr === 'r16' ||
          curr === 'qf' ||
          curr === 'sf' ||
          curr === 'final'
        ) {
          setPendingMilestone(curr);
        } else if (curr === 'completed' && ucl.championTeamId === USER_CLUB_ID) {
          setPendingMilestone('champion');
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
      {season.transferMarket.isOpen && <TransferMarketModal />}

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
                  items={[
                    '리그 페이즈 8경기: 1~8위 16강 직행 · 9~24위 플레이오프 · 25~36위 탈락',
                    '토너먼트(PO~4강): 홈·원정 2차전 합산 스코어 (동률 시 연장/PK)',
                    '결승전: 단판 승부 (무승부 시 연장/PK)',
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

      {/* UCL Solo Live Scoreboard + Real-Time 36-Team Compact Standings Strip */}
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
              onStop={stopUclLiveAuto}
              onMatchDone={handleUclLiveMatchDone}
              onEnterLiveMatch={handleEnterLive2DFromStream}
            />
          </div>
          <div className="lg:col-span-5">
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
        </div>
      )}

      {/* UCL 1-Match Skip Result Popup Modal (League Phase + Knockout Playoff/R16/QF/SF/Final) */}
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

      {/* UCL Live Auto-Advance Resume Confirmation Modal (after 2D play, Transfer Market, or Injury) */}
      {liveAutoActive &&
        liveAutoResumePrompt !== null &&
        !liveTickerPlaying &&
        !hasActive2DBroadcast &&
        !isTransferOpen &&
        !hasPendingInjury &&
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
                    {UCL_LIVE_AUTO_RESUME_COPY[liveAutoResumePrompt].title}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">
                    {UCL_LIVE_AUTO_RESUME_COPY[liveAutoResumePrompt].subtitle}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  id="ucl-live-auto-resume-pause-btn"
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
                  id="ucl-live-auto-resume-continue-btn"
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

      {/* TAB 1: MATCH & PROGRESSION */}
      {tab === 'match' && (() => {
        const isKnockoutStage =
          ucl.stage !== 'league_phase' && ucl.stage !== 'special_transfer';
        const isLeg2Prep = Boolean(
          nextKnockoutInfo &&
            nextKnockoutInfo.tie.stage !== 'final' &&
            nextKnockoutInfo.isDecider,
        );
        return (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div
            className={`${
              liveAutoActive || isKnockoutStage ? 'lg:col-span-12' : 'lg:col-span-8'
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
                        className="flex-1 min-w-[200px] inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-extrabold text-slate-950 shadow-lg hover:bg-emerald-400 disabled:opacity-50 cursor-pointer"
                      >
                        <Play className="h-4 w-4 fill-current" />
                        {isLeg2Prep ? '2차전 시작 (2D 중계)' : '2D 실시간 중계 시작'}
                      </button>
                      <button
                        id="ucl-skip-single-match-btn"
                        type="button"
                        onClick={() => {
                          stopUclLiveAuto();
                          setSkipResultModalOpen(true);
                          simulateSingleMatchInstant();
                        }}
                        disabled={liveTickerPlaying}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-xs font-bold text-slate-200 hover:border-sky-400 hover:text-white disabled:opacity-50 cursor-pointer"
                      >
                        <FastForward className="h-4 w-4" />
                        {isLeg2Prep ? '2차전 스킵' : '1경기 스킵'}
                      </button>
                      {ucl.stage === 'league_phase' && ucl.leaguePhaseRound < 8 && (
                        <>
                          <button
                            id="ucl-lp-live-auto-btn"
                            type="button"
                            onClick={() => {
                              if (liveAutoActive) {
                                stopUclLiveAuto();
                              } else {
                                setLiveAutoActive(true);
                                setLiveAutoUserPaused(false);
                                if (!liveAutoBlocked) launchNextUclLiveMatch();
                              }
                            }}
                            disabled={!liveAutoActive && liveTickerPlaying}
                            className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-4 py-3 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 ${
                              liveAutoActive
                                ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30'
                                : 'border-emerald-500/45 bg-emerald-500/12 text-emerald-200 hover:bg-emerald-500/22'
                            }`}
                          >
                            <Radio className={`h-4 w-4 ${liveAutoActive ? 'animate-pulse' : ''}`} />
                            {liveAutoActive ? '자동진행 중단' : '라이브 자동진행'}
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
                            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-sky-500/45 bg-sky-500/15 px-4 py-3 text-xs font-bold text-sky-200 hover:bg-sky-500/25 disabled:opacity-50 cursor-pointer"
                          >
                            <FastForward className="h-4 w-4" />
                            리그 페이즈 고속진행
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          stopUclLiveAuto();
                          simulateUclToEnd();
                        }}
                        disabled={liveTickerPlaying}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-xs font-bold text-slate-300 hover:border-amber-400/60 hover:text-amber-300 disabled:opacity-50 cursor-pointer"
                      >
                        대회 끝까지 고속 진행
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
                      <button
                        type="button"
                        onClick={simulateUclToEnd}
                        className="rounded-xl bg-sky-400 px-5 py-2.5 text-xs sm:text-sm font-black text-slate-950 hover:bg-sky-300 cursor-pointer touch-manipulation"
                      >
                        남은 토너먼트 시뮬레이션 →
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
                        type="button"
                        onClick={simulateSingleMatchInstant}
                        className="rounded-xl border border-slate-700 bg-[#131b27] px-4 py-2.5 text-xs font-bold text-slate-200 hover:text-white cursor-pointer touch-manipulation"
                      >
                        {ucl.knockoutLeg}차전만 진행
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
                ucl={ucl}
                clubsById={clubsById}
                myClubId={USER_CLUB_ID}
                hideChampion={Boolean(season.liveHalftime && ucl.stage === 'final')}
                onSelectTie={(tie) => {
                  setInspectedMatch(null);
                  setInspectedTie(tie);
                }}
              />
            )}
          </div>

          {/* Right Compact Real-Time Standings (League Phase only; knockout transitions to live bracket above) */}
          {!liveAutoActive && !isKnockoutStage && (
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
        const uclEditLocked = liveAutoActive && !tacticEditMode;
        return (
          <div className="space-y-3">
            {liveAutoActive && (
              <div
                className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3.5 py-2 ${
                  tacticEditMode
                    ? 'border-amber-400/45 bg-amber-500/12'
                    : 'border-sky-400/35 bg-sky-500/10'
                }`}
              >
                <div className="min-w-0 text-[11px] font-bold">
                  {tacticEditMode ? (
                    <span className="text-amber-200">
                      전술 수정 중 (일시정지) · 다음 경기부터 적용
                    </span>
                  ) : (
                    <span className="text-sky-200">
                      자동진행 중 · [전술 수정] 클릭 시 일시정지 후 수정
                    </span>
                  )}
                </div>
                {tacticEditMode ? (
                  <button
                    id="ucl-squad-confirm-tactic-edit-btn"
                    type="button"
                    onClick={() => {
                      setSwapPick(null);
                      confirmTacticEdit();
                      setLiveAutoUserPaused(false);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-extrabold text-slate-950 hover:bg-emerald-400 cursor-pointer shrink-0"
                  >
                    <Check className="w-3.5 h-3.5" />
                    수정 확정
                  </button>
                ) : (
                  <button
                    id="ucl-squad-start-tactic-edit-btn"
                    type="button"
                    onClick={() => {
                      setSwapPick(null);
                      startTacticEdit();
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-extrabold text-slate-950 hover:bg-sky-400 cursor-pointer shrink-0"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    전술 수정
                  </button>
                )}
              </div>
            )}

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
                                  ? 'border-violet-500/40 bg-[#131428] text-slate-200 hover:border-violet-400/70'
                                  : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                            }`}
                          >
                            {isMgrPreferred && (
                              <span className="text-violet-300 mr-0.5">★</span>
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
