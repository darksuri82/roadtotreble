import {
  Award,
  BarChart3,
  CheckCircle2,
  Crown,
  Globe,
  History,
  RotateCcw,
  Sparkles,
  Star,
  Trophy,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { FORMATIONS } from '../../data/formations';
import { compareScoreWithHistoricalTeams } from '../../data/historicalTeams';
import {
  computeMatchesOnlyAnalytics,
  computeSquadPlayerAnalytics,
  computeTeamSeasonAnalytics,
  mergePlayerStatsMaps,
} from '../../engine/analyticsEngine';
import {
  formatFfpScorePenaltyLabel,
  resolveFfpPenaltyTier,
} from '../../engine/budgetEngine';
import { didUserWinCup, getUserCupResultLabel } from '../../engine/cupEngine';
import { getLeagueById, LEAGUES } from '../../engine/dataLoader';
import {
  buildCompactMatchHistory,
  HOF_AUTO_INDUCTION_MIN_SCORE,
} from '../../engine/legacyEngine';
import { USER_CLUB_ID } from '../../engine/matchEngine';
import { buildFiveLeagueUclQualifiers } from '../../engine/otherLeaguesEngine';
import { formatMainPositions } from '../../engine/positionEngine';
import { getUserRank } from '../../engine/standingsEngine';
import { didUserWinUcl, getUserUclResultLabel } from '../../engine/uclEngine';
import { isSupabaseConfigured } from '../../lib/supabaseClient';
import { fetchGlobalTop15Rankings } from '../../services/globalRankingService';
import { useGame } from '../../store/GameContext';
import type {
  BestXiEntry,
  Club,
  LeagueId,
  MatchResult,
  PlayerSeasonStats,
} from '../../types/league';
import type { UclKnockoutTie } from '../../types/ucl';
import {
  buildPlayerCompetitionBreakdown,
  getPlayerNationalityMeta,
  resolveClubRoster,
  resolvePlayerById,
} from '../../utils/playerLookup';
import { ClubSquadModal } from '../common/ClubSquadModal';
import { ClubTag } from '../common/ClubTag';
import { CountryFlagSvg } from '../common/CountryFlagSvg';
import { JerseySvg } from '../common/JerseySvg';
import { MatchDetailModal } from '../common/MatchDetailModal';
import { PixelManagerAvatar } from '../common/PixelManagerAvatar';
import {
  getDomesticCupTrophyVariant,
  getLeagueTrophyVariant,
  PixelTrophySvg,
} from '../common/PixelTrophySvg';
import { PlayerDetailModal } from '../common/PlayerDetailModal';
import { PlayerNameButton } from '../common/PlayerNameButton';
import {
  type TeamArchiveHonorBadge,
  TeamSeasonArchiveTab,
} from '../common/TeamSeasonArchiveTab';
import { GlobalTop15CelebrationModal } from '../legacy/GlobalTop15CelebrationModal';
import { UclBracketTree } from '../ucl/UclBracketTree';
import { CupBracketView } from './CupBracketView';
import { CupChampionModal } from './CupChampionModal';
import {
  getLeagueTrophyDisplayName,
  LeagueFinaleBannerModal,
} from './LeagueFinaleBannerModal';
import { StandingsTable } from './StandingsTable';
import { TeamAnalyticsTab } from './TeamAnalyticsTab';

type SummaryMainTab = 'overview' | 'my_team' | 'league' | 'cup' | 'ucl' | 'history';
type AwardRankTab = 'goals' | 'assists' | 'cleanSheets' | 'rating';
type HistoryFilter = 'all' | 'league' | 'cup' | 'ucl';

function BestXiPitchCard({
  title,
  entries,
  accentLabel,
  onSelectPlayer,
}: {
  title: string;
  entries: BestXiEntry[];
  accentLabel?: string;
  onSelectPlayer?: (stats: PlayerSeasonStats) => void;
}) {
  const slots = FORMATIONS['4-3-3'].slots;
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold text-white">
          <Star className="w-4 h-4 text-amber-400 fill-current" />
          {title}
        </div>
        <span className="text-[11px] text-emerald-300">
          {accentLabel ?? 'MY 배지 = 우리 팀 선수'}
        </span>
      </div>

      <div className="pitch-surface relative aspect-[4/4.6] w-full overflow-hidden rounded-2xl border border-slate-800">
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
            stroke="rgba(255,255,255,0.14)"
            strokeWidth="0.55"
          />
          <line
            x1="4"
            y1="50"
            x2="96"
            y2="50"
            stroke="rgba(255,255,255,0.13)"
            strokeWidth="0.45"
          />
          <circle
            cx="50"
            cy="50"
            r="11"
            fill="none"
            stroke="rgba(255,255,255,0.13)"
            strokeWidth="0.45"
          />
        </svg>

        {entries.map((entry) => {
          const slot = slots[entry.slotIndex];
          if (!slot) return null;
          const isMine = entry.stats.isUserTeam;
          return (
            <div
              key={`${entry.slotIndex}-${entry.stats.playerId}`}
              style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center"
            >
              <div
                className={`flex flex-col items-center rounded-xl px-2 py-1 min-w-[72px] sm:min-w-[84px] text-center shadow-lg ${
                  isMine
                    ? 'bg-emerald-950/95 border-2 border-emerald-400'
                    : 'bg-[#101822]/95 border border-slate-600/80'
                }`}
              >
                <div className="flex items-center gap-1 leading-none">
                  <span
                    className={`font-display text-sm font-bold ${
                      isMine ? 'text-emerald-300' : 'text-amber-300'
                    }`}
                  >
                    {entry.stats.avgRating.toFixed(1)}
                  </span>
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: entry.stats.teamPrimaryColor }}
                  />
                  <span className="text-[9px] font-bold text-slate-300">
                    {entry.stats.teamShortName}
                  </span>
                  {isMine && (
                    <span className="rounded bg-emerald-400 px-1 text-[7px] font-black text-slate-950">
                      MY
                    </span>
                  )}
                </div>
                {onSelectPlayer ? (
                  <PlayerNameButton
                    onClick={() => onSelectPlayer(entry.stats)}
                    className="mt-0.5 max-w-[84px] text-[10px] font-bold text-white text-center"
                  >
                    {entry.stats.playerName}
                  </PlayerNameButton>
                ) : (
                  <span className="mt-0.5 max-w-[84px] truncate text-[10px] font-bold text-white">
                    {entry.stats.playerName}
                  </span>
                )}
                <span className="text-[9px] text-slate-400">
                  {entry.stats.position === 'GK' ||
                  entry.stats.position === 'DF'
                    ? `${entry.stats.cleanSheets}CS · ${entry.stats.goals}G`
                    : `${entry.stats.goals}G ${entry.stats.assists}A`}
                </span>
              </div>
              <span className="mt-0.5 rounded bg-slate-950/85 px-1.5 text-[9px] font-bold text-slate-300">
                {entry.slotLabel}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SeasonSummary() {
  const {
    state,
    enterUclMode,
    skipUclToFinalSummary,
    setLegacyModalOpen,
    openLegacyModal,
    globalTop15Celebration,
    dismissGlobalTop15Celebration,
    lastGlobalSubmitResult,
    globalRankingsVersion,
    archiveCurrentSeasonNow,
    markCupCelebrated,
    resetGame,
  } = useGame();
  const [mainTab, setMainTab] = useState<SummaryMainTab>('overview');
  const [rankTab, setRankTab] = useState<AwardRankTab>('goals');
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
  const [summaryLeagueId, setSummaryLeagueId] = useState<LeagueId | null>(null);
  const [showLeagueFinaleBanner, setShowLeagueFinaleBanner] = useState(
    () => !state.season?.ucl,
  );
  const [globalCutoffInfo, setGlobalCutoffInfo] = useState<{
    cutoffScore: number | null;
    totalCount: number;
  } | null>(null);
  const [inspectedPlayer, setInspectedPlayer] = useState<{
    playerId: string;
    fallbackStats?: PlayerSeasonStats | null;
  } | null>(null);
  const [inspectedMatch, setInspectedMatch] = useState<MatchResult | null>(null);
  const [inspectedTie, setInspectedTie] = useState<UclKnockoutTie | null>(null);
  const [inspectedClub, setInspectedClub] = useState<{
    club: Club;
    leagueId?: LeagueId;
  } | null>(null);
  const season = state.season;

  useEffect(() => {
    if (!isSupabaseConfigured || !season?.ucl?.completed) return;
    let cancelled = false;
    void fetchGlobalTop15Rankings().then((res) => {
      if (cancelled || !res.ok) return;
      setGlobalCutoffInfo({
        cutoffScore: res.cutoffScore,
        totalCount: res.entries.length,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [season?.ucl?.completed, globalRankingsVersion]);

  const openPlayerById = (
    playerId: string,
    fallbackStats?: PlayerSeasonStats | null,
  ) => {
    setInspectedPlayer({ playerId, fallbackStats: fallbackStats ?? null });
  };

  const clubsById = useMemo(() => {
    const map: Record<string, Club> = {};
    if (season) {
      for (const c of season.clubs) map[c.id] = c;
    }
    return map;
  }, [season]);

  const uclClubsById = useMemo(() => {
    const map: Record<string, Club> = { ...clubsById };
    if (season?.ucl) {
      for (const c of season.ucl.clubs) map[c.id] = c;
    }
    return map;
  }, [season, clubsById]);

  const allKnownClubs = useMemo(
    () => Object.values(uclClubsById),
    [uclClubsById],
  );

  const combinedStatsMap = useMemo(() => {
    if (!season) return {};
    return mergePlayerStatsMaps(
      season.allPlayerStats,
      season.cupPlayerStats,
      season.uclPlayerStats,
    );
  }, [season]);

  // Ballon d'Or & World Best XI are ONLY awarded ONCE after League + Cup + UCL are ALL complete.
  const uclCompleted = Boolean(season?.ucl?.completed);
  const globalAwards = uclCompleted ? (season?.globalAwards ?? null) : null;

  const leagueRankForAnalytics = season
    ? getUserRank(season.standings, USER_CLUB_ID)
    : 1;

  const pureLeaguePoints = useMemo(() => {
    if (!season) return 0;
    return (
      season.standings.find((r) => r.teamId === USER_CLUB_ID || r.isUser)
        ?.points ?? 0
    );
  }, [season]);

  const combinedTeamAnalytics = useMemo(() => {
    if (!season) return null;
    return computeMatchesOnlyAnalytics({
      matches: [
        ...season.userMatchHistory,
        ...season.userCupMatchHistory,
        ...season.userUclMatchHistory,
      ],
      clubs: allKnownClubs,
      userClubId: USER_CLUB_ID,
      finalRank: leagueRankForAnalytics,
      rankLabel: `리그 ${leagueRankForAnalytics}위`,
      competitionScope: 'combined',
      leaguePoints: pureLeaguePoints,
    });
  }, [season, allKnownClubs, leagueRankForAnalytics, pureLeaguePoints]);

  const leagueTeamAnalytics = useMemo(() => {
    if (!season) return null;
    return computeTeamSeasonAnalytics({
      standings: season.standings,
      userMatchHistory: season.userMatchHistory,
      clubs: season.clubs,
      userClubId: USER_CLUB_ID,
    });
  }, [season]);

  const cupTeamAnalytics = useMemo(() => {
    if (!season) return null;
    return computeMatchesOnlyAnalytics({
      matches: season.userCupMatchHistory,
      clubs: season.clubs,
      userClubId: USER_CLUB_ID,
      finalRank: leagueRankForAnalytics,
      rankLabel: getUserCupResultLabel(season.cup, USER_CLUB_ID),
      competitionScope: 'cup',
    });
  }, [season, leagueRankForAnalytics]);

  const uclTeamAnalytics = useMemo(() => {
    if (!season) return null;
    return computeMatchesOnlyAnalytics({
      matches: season.userUclMatchHistory,
      clubs: allKnownClubs,
      userClubId: USER_CLUB_ID,
      finalRank: leagueRankForAnalytics,
      rankLabel: getUserUclResultLabel(season.ucl, USER_CLUB_ID),
      competitionScope: 'ucl',
    });
  }, [season, allKnownClubs, leagueRankForAnalytics]);

  const combinedSquadRows = useMemo(() => {
    if (!season) return [];
    return computeSquadPlayerAnalytics({
      starters: state.starters,
      bench: state.bench,
      allPlayerStats: combinedStatsMap,
    });
  }, [season, state.starters, state.bench, combinedStatsMap]);

  const leagueSquadRows = useMemo(() => {
    if (!season) return [];
    return computeSquadPlayerAnalytics({
      starters: state.starters,
      bench: state.bench,
      allPlayerStats: season.allPlayerStats,
    });
  }, [season, state.starters, state.bench]);

  const cupSquadRows = useMemo(() => {
    if (!season) return [];
    return computeSquadPlayerAnalytics({
      starters: state.starters,
      bench: state.bench,
      allPlayerStats: season.cupPlayerStats,
    });
  }, [season, state.starters, state.bench]);

  const uclSquadRows = useMemo(() => {
    if (!season) return [];
    return computeSquadPlayerAnalytics({
      starters: state.starters,
      bench: state.bench,
      allPlayerStats: season.uclPlayerStats,
    });
  }, [season, state.starters, state.bench]);

  const fullMatchEntries = useMemo(() => {
    if (!season) return [];
    const clubNameById: Record<string, string> = {};
    for (const c of allKnownClubs) clubNameById[c.id] = c.name;
    const summaries = buildCompactMatchHistory({
      leagueMatches: season.userMatchHistory,
      cupMatches: season.userCupMatchHistory,
      uclMatches: season.userUclMatchHistory,
      clubNameById,
    });
    const raws: MatchResult[] = [
      ...season.userMatchHistory,
      ...season.userCupMatchHistory,
      ...season.userUclMatchHistory,
    ];
    return summaries.map((summary, idx) => ({
      summary,
      raw: raws[idx] ?? null,
    }));
  }, [season, allKnownClubs]);

  const uclLeaders = useMemo(() => {
    if (!season) return { scorers: [], assisters: [], ratings: [] };
    const list = Object.values(season.uclPlayerStats).filter(
      (s) => s.appearances > 0,
    );
    return {
      scorers: [...list]
        .sort((a, b) => b.goals - a.goals || b.assists - a.assists)
        .slice(0, 8),
      assisters: [...list]
        .sort((a, b) => b.assists - a.assists || b.goals - a.goals)
        .slice(0, 8),
      ratings: [...list]
        .filter((s) => s.appearances >= 2)
        .sort((a, b) => b.avgRating - a.avgRating || b.goals - a.goals)
        .slice(0, 8),
    };
  }, [season]);

  if (!season || !combinedTeamAnalytics || !leagueTeamAnalytics) return null;

  const league = getLeagueById(season.leagueId);
  const viewedLeagueId: LeagueId = summaryLeagueId ?? season.leagueId;
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
    ? season.standings
    : viewedBgLeague?.standings ?? [];

  const viewedBgTopScorers: PlayerSeasonStats[] = !isViewingUserLeague
    ? Object.values(viewedBgLeague?.playerStats ?? {})
        .filter((s) => s.appearances > 0 && s.goals > 0)
        .sort((a, b) => b.goals - a.goals || b.assists - a.assists)
        .slice(0, 6)
    : [];
  const viewedBgTopAssisters: PlayerSeasonStats[] = !isViewingUserLeague
    ? Object.values(viewedBgLeague?.playerStats ?? {})
        .filter((s) => s.appearances > 0 && s.assists > 0)
        .sort((a, b) => b.assists - a.assists || b.goals - a.goals)
        .slice(0, 6)
    : [];
  const viewedBgTopRatings: PlayerSeasonStats[] = !isViewingUserLeague
    ? Object.values(viewedBgLeague?.playerStats ?? {})
        .filter((s) => s.appearances >= Math.max(10, Math.floor(viewedLeagueMeta.totalRounds * 0.45)))
        .sort((a, b) => b.avgRating - a.avgRating || b.goals - a.goals)
        .slice(0, 6)
    : [];

  const uclQualifiedByLeague =
    season.uclQualifiedSummary ??
    state.phase2Handoff?.uclQualifiedByLeague ??
    buildFiveLeagueUclQualifiers({
      userLeagueId: season.leagueId,
      userLeagueClubs: season.clubs,
      userLeagueStandings: season.standings,
      otherLeagues: season.otherLeagues,
    });

  const finalRank = getUserRank(season.standings, USER_CLUB_ID);
  const userRow = season.standings[finalRank - 1];
  const fourthRow = season.standings[3];
  const qualifiedForUcl = finalRank <= 4;
  const canStartUcl = qualifiedForUcl && !season.ucl;
  const wonCup = didUserWinCup(season.cup, USER_CLUB_ID);
  const wonUcl = didUserWinUcl(season.ucl, USER_CLUB_ID);
  const isTreble = finalRank === 1 && wonCup && wonUcl;
  const awards = season.awards;
  const score = season.seasonScore;

  const activeLeaderboard: PlayerSeasonStats[] = awards
    ? rankTab === 'goals'
      ? awards.topScorers
      : rankTab === 'assists'
        ? awards.topAssisters
        : rankTab === 'cleanSheets'
          ? awards.topCleanSheets
          : awards.topRatings
    : [];

  const filteredHistory = fullMatchEntries.filter(
    (entry) =>
      historyFilter === 'all' || entry.summary.competition === historyFilter,
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-5">
      {/* Domestic Cup Victory Pixel Trophy Celebration (fires even when reached via Skip-to-Season-End!) */}
      {season.cup?.completed &&
        wonCup &&
        !season.cupChampionCelebrated && (
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

      {/* Regular League Final Round Result Popup Banner (shows when cup celebration is not blocking) */}
      {showLeagueFinaleBanner &&
        !(
          season.cup?.completed &&
          wonCup &&
          !season.cupChampionCelebrated
        ) &&
        userRow && (
          <LeagueFinaleBannerModal
            leagueId={season.leagueId}
            leagueName={league.koreanName}
            totalRounds={season.totalRounds}
            totalTeams={season.standings.length}
            uclSpots={league.uclSpots}
            relegationSpots={league.relegationSpots}
            userClub={state.userClub}
            userStanding={userRow}
            finalRank={finalRank}
            canEnterUcl={canStartUcl}
            onEnterUcl={enterUclMode}
            onClose={() => setShowLeagueFinaleBanner(false)}
          />
        )}

      {/* Global TOP 15 Induction Celebration Modal (sequential after cup/league finale modals) */}
      {globalTop15Celebration &&
        !(
          season.cup?.completed &&
          wonCup &&
          !season.cupChampionCelebrated
        ) &&
        !showLeagueFinaleBanner && (
          <GlobalTop15CelebrationModal
            payload={globalTop15Celebration}
            onViewRankings={() => {
              dismissGlobalTop15Celebration();
              openLegacyModal('global_top15');
            }}
            onClose={dismissGlobalTop15Celebration}
          />
        )}

      {/* Main Season Result Hero */}
      <section className="rounded-2xl border border-slate-800 bg-[#0e141d] p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/15 px-2.5 py-1 text-xs font-bold text-amber-300">
                <Trophy className="w-3.5 h-3.5" />
                {finalRank === 1
                  ? `${league.koreanName} 우승 (${getLeagueTrophyDisplayName(season.leagueId)})`
                  : `${league.koreanName} 최종 ${finalRank}위`}
              </span>
              {season.cup && (
                <span className="rounded-md bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-200">
                  {season.cup.meta.koreanName}{' '}
                  {getUserCupResultLabel(season.cup, USER_CLUB_ID)}
                </span>
              )}
              {season.ucl && (
                <span className="rounded-md bg-sky-500/15 px-2.5 py-1 text-xs font-bold text-sky-300">
                  UCL {getUserUclResultLabel(season.ucl, USER_CLUB_ID)}
                </span>
              )}
              {isTreble && (
                <span className="rounded-md bg-amber-400 px-2.5 py-1 text-xs font-black text-slate-950">
                  👑 트레블 달성
                </span>
              )}
              <button
                type="button"
                onClick={() => setShowLeagueFinaleBanner(true)}
                className="rounded-md border border-slate-700 bg-slate-900 px-2 py-0.5 text-[11px] font-bold text-slate-300 hover:border-emerald-400/50 hover:text-emerald-300 cursor-pointer"
              >
                정규리그 결과 배너 보기
              </button>
            </div>

            <h1 className="font-display text-3xl sm:text-4xl font-bold text-white">
              {isTreble
                ? '유럽 축구의 전설, 트레블 완성!'
                : wonUcl
                  ? 'UEFA 챔피언스리그 우승 달성!'
                  : canStartUcl
                    ? '챔피언스리그 진출 성공! 트레블에 도전하세요'
                    : qualifiedForUcl
                      ? '시즌 여정이 마무리되었습니다'
                      : '아쉽게 챔피언스리그 진출권을 놓쳤습니다'}
            </h1>

            <p className="max-w-xl text-sm text-slate-300 leading-relaxed">
              <strong className="text-white">{state.userClub.name}</strong> (
              {state.manager.name} 감독) · {season.totalRounds}R 최종{' '}
              <strong className="text-emerald-300">
                {userRow.points}점 ({userRow.won}승 {userRow.drawn}무{' '}
                {userRow.lost}패, 득실{' '}
                {userRow.goalDifference >= 0
                  ? `+${userRow.goalDifference}`
                  : userRow.goalDifference}
                )
              </strong>
              {!qualifiedForUcl && fourthRow && (
                <span className="text-slate-400">
                  {' '}
                  · 4위 {fourthRow.teamName}과{' '}
                  {Math.max(0, fourthRow.points - userRow.points)}점 차
                </span>
              )}
            </p>

            {/* Primary Actions */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {canStartUcl && (
                <button
                  id="enter-ucl-mode-btn"
                  type="button"
                  onClick={enterUclMode}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-extrabold text-slate-950 shadow-lg hover:bg-emerald-400 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  36팀 챔피언스리그 도전하기 (특별 이적시장 1회)
                </button>
              )}

              {canStartUcl && !season.legacyArchived && (
                <button
                  type="button"
                  onClick={skipUclToFinalSummary}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs font-bold text-slate-300 hover:border-amber-400/50 hover:text-amber-300 cursor-pointer"
                >
                  <Crown className="w-3.5 h-3.5" />
                  챔스 자동 시뮬 후 최종 결산
                </button>
              )}

              {season.legacyArchived ? (
                <button
                  type="button"
                  onClick={() => setLegacyModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/45 bg-amber-500/15 px-4 py-2.5 text-xs font-bold text-amber-300 hover:bg-amber-500/25 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  명예의 전당 등재 완료 · 보기 →
                </button>
              ) : !canStartUcl && Boolean(season.ucl?.completed) ? (
                <button
                  id="manual-hof-register-btn"
                  type="button"
                  onClick={archiveCurrentSeasonNow}
                  title={`자동 등재 기준(${HOF_AUTO_INDUCTION_MIN_SCORE.toLocaleString()}점 이상 · 역대 강팀급) 미만 시즌도 원하면 직접 명예의 전당에 등록할 수 있습니다`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/50 bg-amber-500/15 px-4 py-2.5 text-xs font-extrabold text-amber-200 hover:bg-amber-500/25 cursor-pointer"
                >
                  <Crown className="w-3.5 h-3.5 text-amber-300" />
                  명예의 전당 수동 등록
                </button>
              ) : null}

              <button
                type="button"
                onClick={resetGame}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-800 bg-[#121923] px-4 py-2.5 text-xs font-bold text-slate-300 hover:border-slate-600 hover:text-white cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                새 커리어 시작
              </button>
            </div>
          </div>

          {/* Club + Manager Pixel Avatar + League Champion Pixel Trophy Card */}
          <div className="flex items-center gap-3.5 rounded-xl border border-slate-800 bg-[#090e15] p-4 shrink-0">
            {finalRank === 1 && (
              <div
                title={getLeagueTrophyDisplayName(season.leagueId)}
                className="flex h-16 w-14 items-center justify-center rounded-xl border border-amber-400/40 bg-amber-500/10"
              >
                <PixelTrophySvg
                  variant={getLeagueTrophyVariant(season.leagueId)}
                  size={44}
                  animate
                />
              </div>
            )}
            <JerseySvg
              primaryColor={state.userClub.primaryColor}
              secondaryColor={state.userClub.secondaryColor}
              pattern={state.userClub.pattern}
              label={state.userClub.shortName}
              size={54}
            />
            <div className="flex h-16 w-14 items-center justify-center rounded-xl border border-slate-800 bg-[#111824]">
              <PixelManagerAvatar
                avatar={state.manager.avatar}
                clubPrimaryColor={state.userClub.primaryColor}
                clubSecondaryColor={state.userClub.secondaryColor}
                size={44}
              />
            </div>
            <div>
              <div className="font-display text-2xl font-bold text-amber-300">
                #{finalRank}
              </div>
              <div className="text-xs font-bold text-white">
                {state.userClub.name}
              </div>
              <div className="text-[11px] text-slate-400">
                {state.manager.name} 감독
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Season Score Breakdown Card (with Individual Awards Bonus!) */}
      {score && (
        <section className="rounded-2xl border border-slate-800 bg-[#0e141d] p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400 text-lg font-black text-slate-950">
                {score.grade}
              </span>
              <div>
                <div className="text-[11px] font-bold text-amber-300">
                  공정 시즌 스코어 (PPG×38 보정 + 개인 수상 보너스)
                </div>
                <div className="font-display text-2xl font-bold text-white tabular-nums">
                  {score.totalScore.toLocaleString()} PTS
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setLegacyModalOpen(true)}
              className="rounded-xl border border-slate-800 bg-[#131b26] px-3.5 py-2 text-xs font-bold text-slate-200 hover:border-amber-400/50 hover:text-amber-300 cursor-pointer"
            >
              명예의 전당 · 24종 레거시 도감 →
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8 text-center">
            {[
              { label: '리그 환산(PPG×38)', val: score.leagueConvertedScore },
              { label: '리그 순위', val: score.leagueRankBonus },
              { label: '자국 컵', val: score.cupBonus },
              { label: '챔피언스리그', val: score.uclBonus },
              { label: '대업·대기록', val: score.honorsBonus },
              { label: '스쿼드·감독 시너지', val: score.squadCraftBonus ?? 0, highlight: true },
              { label: '언더독 보너스', val: score.underdogBonus },
              { label: '개인 수상 보너스', val: score.awardsBonus ?? 0, highlight: true },
            ].map((item) => (
              <div
                key={item.label}
                className={`rounded-xl border p-2.5 ${
                  item.highlight && item.val > 0
                    ? 'border-amber-400/40 bg-amber-500/10'
                    : 'border-slate-800 bg-[#090e15]'
                }`}
              >
                <div className="text-[10px] text-slate-400">{item.label}</div>
                <div
                  className={`mt-0.5 font-mono text-sm font-black ${
                    item.highlight && item.val > 0
                      ? 'text-amber-300'
                      : 'text-emerald-300'
                  }`}
                >
                  +{item.val.toLocaleString()}
                </div>
              </div>
            ))}
          </div>

          {score.ffpPenaltyPoints && score.ffpPenaltyPoints > 0 && (() => {
            const tier = resolveFfpPenaltyTier(score.ffpPenaltyPct, score.ffpTier);
            const isTier1 = tier === 1;
            return (
              <div
                className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-[11px] tabular-nums ${
                  isTier1
                    ? 'border-amber-400/35 bg-amber-500/10 text-amber-200'
                    : 'border-rose-500/35 bg-rose-500/10 text-rose-200'
                }`}
              >
                <span className={`font-bold ${isTier1 ? 'text-amber-300' : 'text-rose-300'}`}>
                  {formatFfpScorePenaltyLabel(score.ffpPenaltyPct, score.ffpTier)}
                </span>
                <span className={`font-mono font-black ${isTier1 ? 'text-amber-300' : 'text-rose-300'}`}>
                  -{score.ffpPenaltyPoints.toLocaleString()}점
                </span>
              </div>
            );
          })()}

          {score.honorsBonusDetails && score.honorsBonusDetails.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-200">
              <span className="font-bold text-amber-300">대업·대기록 가산점:</span>
              {score.honorsBonusDetails.map((detail) => (
                <span
                  key={detail}
                  className="rounded-md bg-[#090e15] px-2 py-0.5 font-semibold text-amber-100"
                >
                  {detail}
                </span>
              ))}
            </div>
          )}

          {score.squadCraftDetails && score.squadCraftDetails.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-[11px] text-emerald-200">
              <span className="font-bold text-emerald-300">전력·케미·감독 시너지:</span>
              {score.squadCraftDetails.map((detail) => (
                <span
                  key={detail}
                  className="rounded-md bg-[#090e15] px-2 py-0.5 font-semibold text-emerald-100"
                >
                  {detail}
                </span>
              ))}
            </div>
          )}

          {score.awardsBonusDetails && score.awardsBonusDetails.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-sky-500/20 bg-sky-500/5 px-3 py-2 text-[11px] text-sky-200">
              <span className="font-bold text-sky-300">개인 수상 가산점:</span>
              {score.awardsBonusDetails.map((detail) => (
                <span
                  key={detail}
                  className="rounded-md bg-[#090e15] px-2 py-0.5 font-semibold text-sky-100"
                >
                  {detail}
                </span>
              ))}
            </div>
          )}

          {(() => {
            const histComp = compareScoreWithHistoricalTeams(score.totalScore);
            return (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/8 px-3.5 py-2.5 text-xs">
                <div className="flex items-center gap-2 text-emerald-100">
                  <span className="rounded bg-amber-400/20 px-2 py-0.5 text-[10px] font-black text-amber-300">
                    🏛️ 역대 강팀 비교
                  </span>
                  <span className="font-semibold">{histComp.feedbackText}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setLegacyModalOpen(true)}
                  className="shrink-0 text-[11px] font-bold text-emerald-300 hover:underline cursor-pointer"
                >
                  역대 랭킹표 보기 →
                </button>
              </div>
            );
          })()}

          {isSupabaseConfigured && uclCompleted && (() => {
            const runSubmit =
              lastGlobalSubmitResult &&
              season.runId &&
              lastGlobalSubmitResult.runId === season.runId
                ? lastGlobalSubmitResult.result
                : null;
            const enteredRank =
              runSubmit?.ok && runSubmit.entered && runSubmit.rank
                ? runSubmit.rank
                : null;
            const cutoffScore =
              runSubmit?.cutoffScore ?? globalCutoffInfo?.cutoffScore ?? null;
            const totalCount =
              runSubmit?.totalCount ?? globalCutoffInfo?.totalCount ?? null;

            if (enteredRank === null && totalCount === null) return null;

            return (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-[#090e15] px-3.5 py-2 text-xs">
                <div className="flex flex-wrap items-center gap-2 text-slate-300">
                  <span className="rounded bg-sky-500/15 border border-sky-400/30 px-2 py-0.5 text-[10px] font-black text-sky-300">
                    🌍 글로벌 TOP 15
                  </span>
                  {enteredRank !== null ? (
                    <span className="font-bold text-emerald-300 tabular-nums">
                      역대 글로벌 #{enteredRank}위 등재 완료
                    </span>
                  ) : totalCount !== null && totalCount < 15 ? (
                    <span className="text-slate-300 tabular-nums">
                      현재 {totalCount}/15팀 등재 중
                    </span>
                  ) : cutoffScore !== null ? (
                    <span className="text-slate-400 tabular-nums">
                      현재 15위 커트라인{' '}
                      <strong className="font-mono text-slate-200">
                        {cutoffScore.toLocaleString()} PTS
                      </strong>
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => openLegacyModal('global_top15')}
                  className="shrink-0 text-[11px] font-bold text-sky-300 hover:underline cursor-pointer"
                >
                  TOP 15 랭킹 보기 →
                </button>
              </div>
            );
          })()}
        </section>
      )}

      {/* 6-Tab Full Competition Records Bar */}
      <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-slate-800 bg-[#0e141d] p-1 sm:grid-cols-3 lg:grid-cols-6">
        {(
          [
            ['overview', '통합 요약 · 어워즈', <Award key="a" className="w-3.5 h-3.5" />],
            ['my_team', '내 팀 결산', <Users key="m" className="w-3.5 h-3.5" />],
            ['league', '리그 기록', <Globe key="l" className="w-3.5 h-3.5" />],
            ['cup', season.cup?.meta.koreanName ?? '자국 컵', <Trophy key="c" className="w-3.5 h-3.5" />],
            ['ucl', '챔피언스리그', <Sparkles key="u" className="w-3.5 h-3.5" />],
            ['history', `전체 경기 (${fullMatchEntries.length})`, <History key="h" className="w-3.5 h-3.5" />],
          ] as [SummaryMainTab, string, React.ReactNode][]
        ).map(([id, label, icon]) => (
          <button
            key={id}
            id={id === 'league' ? 'season-analytics-tab-btn' : undefined}
            type="button"
            onClick={() => setMainTab(id)}
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg border py-2.5 px-2 text-xs font-bold transition-colors cursor-pointer ${
              mainTab === id
                ? 'bg-slate-800 text-white border-emerald-500/50'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            {icon}
            <span className="truncate">{label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1B: MY TEAM SEASON ARCHIVE (FORMATION PITCH + COACHING + LEADERS + AWAKENING + HONORS) */}
      {mainTab === 'my_team' && (() => {
        const scopeStatsMap = uclCompleted
          ? combinedStatsMap
          : mergePlayerStatsMaps(season.allPlayerStats, season.cupPlayerStats);
        const myTeamStats = Object.values(scopeStatsMap).filter(
          (st) => st.isUserTeam || st.teamId === USER_CLUB_ID,
        );
        const honors: TeamArchiveHonorBadge[] = [];
        if (isTreble) honors.push({ label: '👑 역사적 트레블', tone: 'gold' });
        if (finalRank === 1) {
          honors.push({ label: `🏆 ${league.koreanName} 우승`, tone: 'gold' });
          if (userRow && userRow.lost === 0) {
            honors.push({ label: '✨ 무패 우승', tone: 'emerald' });
          }
        } else if (qualifiedForUcl) {
          honors.push({ label: `UCL 진출 (리그 ${finalRank}위)`, tone: 'sky' });
        }
        if (wonCup && season.cup) {
          honors.push({ label: `🏆 ${season.cup.meta.koreanName} 우승`, tone: 'gold' });
        }
        if (wonUcl) {
          honors.push({ label: '🏆 UEFA 챔피언스리그 우승', tone: 'sky' });
        }
        if (globalAwards?.ballonDorWinner?.stats.isUserTeam) {
          honors.push({
            label: `발롱도르 · ${globalAwards.ballonDorWinner.stats.playerName}`,
            tone: 'gold',
          });
        }
        if (awards?.poty?.isUserTeam) {
          honors.push({
            label: `리그 올해의 선수 · ${awards.poty.playerName}`,
            tone: 'gold',
          });
        }
        if (awards?.topScorers[0]?.isUserTeam) {
          honors.push({
            label: `리그 득점왕 · ${awards.topScorers[0].playerName}`,
            tone: 'emerald',
          });
        }
        const bestGoalkeeper =
          awards?.bestGoalkeeper ??
          awards?.topCleanSheets.find((p) => p.position === 'GK') ??
          awards?.bestXi.find((x) => x.slotLabel === 'GK')?.stats ??
          null;
        if (bestGoalkeeper?.isUserTeam && bestGoalkeeper.position === 'GK') {
          honors.push({
            label: `최고 GK · ${bestGoalkeeper.playerName}`,
            tone: 'sky',
          });
        }
        const bestDefender =
          awards?.bestDefender ??
          awards?.bestXi.find((x) => x.stats.position === 'DF')?.stats ??
          null;
        if (bestDefender?.isUserTeam && bestDefender.position === 'DF') {
          honors.push({
            label: `최우수 수비수 · ${bestDefender.playerName}`,
            tone: 'emerald',
          });
        }
        if (season.legacyArchived) {
          honors.push({ label: '🏛️ 명예의 전당 등재', tone: 'gold' });
        }

        return (
          <TeamSeasonArchiveTab
            milestoneLabel={
              uclCompleted
                ? 'UCL 포함 시즌 통합 최종 스쿼드'
                : '정규리그 종료 시점 스쿼드'
            }
            club={state.userClub}
            managerName={state.manager.name}
            managerAvatar={state.manager.avatar}
            managerTraitId={state.manager.traitId}
            staffCoachId={season.staffCoach?.hiredCoachId ?? null}
            budgetState={season.budgetState ?? null}
            formation={state.formation}
            tactic={season.defaultTactic}
            starters={state.starters}
            bench={state.bench}
            leagueName={league.koreanName}
            leagueRank={finalRank}
            standingRow={userRow ?? null}
            cupResultLabel={
              season.cup ? getUserCupResultLabel(season.cup, USER_CLUB_ID) : null
            }
            uclResultLabel={
              season.ucl ? getUserUclResultLabel(season.ucl, USER_CLUB_ID) : null
            }
            seasonScore={
              score ? { totalScore: score.totalScore, grade: score.grade } : null
            }
            honors={honors}
            teamStats={myTeamStats}
            onInspectPlayer={(p) =>
              openPlayerById(p.id, scopeStatsMap[p.id] ?? null)
            }
            onInspectStats={(st) => openPlayerById(st.playerId, st)}
          />
        );
      })()}

      {/* TAB 1: GLOBAL AWARDS (BALLON D'OR + WORLD BEST XI) & COMBINED SUMMARY */}
      {mainTab === 'overview' && (
        <div className="space-y-5">
          {/* Gate banner before UCL completes — Ballon d'Or & World Best XI awarded ONCE at full season end */}
          {!uclCompleted && canStartUcl && (
            <div className="rounded-2xl border border-sky-500/35 bg-gradient-to-r from-[#0a1628] via-[#0e1d36] to-[#0c1422] p-5 sm:p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-4">
                  <div className="shrink-0 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-2.5">
                    <PixelTrophySvg variant="ballon_dor" size={52} animate />
                  </div>
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/20 px-2.5 py-0.5 text-[10px] font-black text-sky-300">
                      <Sparkles className="w-3 h-3" />
                      CHAMPIONS LEAGUE GATE · 최종 어워즈 대기
                    </div>
                    <h2 className="text-lg font-extrabold text-white">
                      발롱도르 &amp; FIFA 월드베스트 XI는 챔피언스리그 종료 후 단 1회 종합 시상됩니다
                    </h2>
                    <p className="text-xs leading-relaxed text-slate-300">
                      리그·자국 컵 성적과 36팀 UEFA 챔피언스리그 최종 결과를 모두 합산해 공정하게 수상자를 선정합니다. 챔스에 직접 도전하거나 자동 시뮬레이션으로 시즌 최종 결산을 확인하세요.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={enterUclMode}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-black text-slate-950 hover:bg-emerald-400 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    36팀 챔피언스리그 도전하기
                  </button>
                  <button
                    type="button"
                    onClick={skipUclToFinalSummary}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-2.5 text-xs font-bold text-amber-200 hover:bg-amber-500/20 cursor-pointer"
                  >
                    <Crown className="w-3.5 h-3.5" />
                    챔스 자동 시뮬 후 최종 결산·발롱도르 확인
                  </button>
                </div>
              </div>
            </div>
          )}

          {uclCompleted && season.ucl?.userParticipated === false && season.ucl.championTeamId && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-500/25 bg-sky-500/8 px-4 py-2.5 text-xs text-sky-100">
              <span>
                🏆 이번 시즌 36팀 UEFA 챔피언스리그 최종 우승팀:{' '}
                <strong className="text-amber-300">
                  {uclClubsById[season.ucl.championTeamId]?.name ?? season.ucl.championTeamId}
                </strong>{' '}
                (백그라운드 유럽 대회 결과까지 모두 반영되어 발롱도르·월드베스트 XI가 확정되었습니다)
              </span>
              <button
                type="button"
                onClick={() => setMainTab('ucl')}
                className="font-bold text-sky-300 hover:underline cursor-pointer"
              >
                챔스 대진표 보기 →
              </button>
            </div>
          )}

          {globalAwards && (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
              {/* Ballon d'Or Winner + TOP 5 */}
              <div className="lg:col-span-6 space-y-4">
                {globalAwards.ballonDorWinner && (
                  <div className="card-legend-glow relative w-full overflow-hidden rounded-2xl p-5 text-left">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1.5 min-w-0">
                        <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-2.5 py-0.5 text-[10px] font-black text-slate-950">
                          <Crown className="w-3 h-3" />
                          BALLON D&apos;OR · 시즌 발롱도르 수상자
                        </div>
                        <div>
                          <PlayerNameButton
                            onClick={() =>
                              openPlayerById(
                                globalAwards.ballonDorWinner!.stats.playerId,
                                globalAwards.ballonDorWinner!.stats,
                              )
                            }
                            className="font-display text-3xl font-bold text-white"
                          >
                            {globalAwards.ballonDorWinner.stats.playerName}
                          </PlayerNameButton>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-amber-200">
                          <ClubTag
                            shortName={globalAwards.ballonDorWinner.stats.teamShortName}
                            primaryColor={globalAwards.ballonDorWinner.stats.teamPrimaryColor}
                            isUserTeam={globalAwards.ballonDorWinner.stats.isUserTeam}
                            size="sm"
                          />
                          <span className="font-semibold">
                            {globalAwards.ballonDorWinner.stats.teamName} (
                            {formatMainPositions({
                              mainPositions: globalAwards.ballonDorWinner.stats.mainPositions,
                            })}
                            )
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 pt-1">
                          {globalAwards.ballonDorWinner.reason}
                        </p>
                      </div>

                      <div className="flex flex-col items-center shrink-0">
                        <PixelTrophySvg variant="ballon_dor" size={64} animate />
                        <span className="mt-1 font-display text-sm font-bold text-amber-300">
                          평점 {globalAwards.ballonDorWinner.stats.avgRating.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs tabular-nums">
                      <div className="rounded-lg bg-slate-950/75 p-2">
                        <div className="text-[10px] text-slate-400">출전</div>
                        <div className="font-display text-base font-bold text-white">
                          {globalAwards.ballonDorWinner.stats.appearances}
                        </div>
                      </div>
                      <div className="rounded-lg bg-slate-950/75 p-2">
                        <div className="text-[10px] text-slate-400">득점</div>
                        <div className="font-display text-base font-bold text-emerald-300">
                          {globalAwards.ballonDorWinner.stats.goals}
                        </div>
                      </div>
                      <div className="rounded-lg bg-slate-950/75 p-2">
                        <div className="text-[10px] text-slate-400">도움</div>
                        <div className="font-display text-base font-bold text-sky-300">
                          {globalAwards.ballonDorWinner.stats.assists}
                        </div>
                      </div>
                      <div className="rounded-lg bg-slate-950/75 p-2">
                        <div className="text-[10px] text-slate-400">MOM</div>
                        <div className="font-display text-base font-bold text-amber-300">
                          {globalAwards.ballonDorWinner.stats.momCount}회
                        </div>
                      </div>
                    </div>
                    <div className="mt-2.5 text-right text-[10px] font-semibold text-amber-300/80">
                      선수 이름 클릭 시 대회별 세부 스탯 확인
                    </div>
                  </div>
                )}

                {/* Ballon d'Or TOP 5 Ranking */}
                <div className="rounded-2xl border border-slate-800 bg-[#0e141d] p-4 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white">
                      🏆 발롱도르 최종 후보 TOP 5
                    </span>
                    <span className="text-[11px] text-slate-400">
                      선수 이름 클릭 시 세부 스탯
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {globalAwards.ballonDorTop5.map((cand) => (
                      <div
                        key={`${cand.stats.teamId}-${cand.stats.playerId}`}
                        className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-xs ${
                          cand.stats.isUserTeam
                            ? 'border-emerald-500/45 bg-emerald-500/10'
                            : 'border-slate-800 bg-[#090e15]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md font-display text-xs font-bold ${
                              cand.rank === 1
                                ? 'bg-amber-400 text-slate-950'
                                : cand.rank <= 3
                                  ? 'bg-slate-700 text-white'
                                  : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {cand.rank}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <PlayerNameButton
                                onClick={() => openPlayerById(cand.stats.playerId, cand.stats)}
                                className="font-bold text-white"
                              >
                                {cand.stats.playerName}
                              </PlayerNameButton>
                              <ClubTag
                                shortName={cand.stats.teamShortName}
                                primaryColor={cand.stats.teamPrimaryColor}
                                isUserTeam={cand.stats.isUserTeam}
                              />
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {cand.reason}
                            </div>
                          </div>
                        </div>
                        <div className="text-right font-mono shrink-0">
                          <div className="text-xs font-bold text-amber-300">
                            {cand.stats.goals}G {cand.stats.assists}A
                          </div>
                          <div className="text-[10px] text-slate-400">
                            평점 {cand.stats.avgRating.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* World Best XI Pitch */}
              <div className="lg:col-span-6">
                <BestXiPitchCard
                  title="FIFA 월드베스트 XI (4-3-3)"
                  entries={globalAwards.worldBestXi}
                  accentLabel={`우리 팀 선정: ${globalAwards.worldBestXi.filter((x) => x.stats.isUserTeam).length}명`}
                  onSelectPlayer={(st) => openPlayerById(st.playerId, st)}
                />
              </div>
            </div>
          )}

          {/* Combined Season Analytics */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <BarChart3 className="w-4 h-4 text-emerald-400" />
              우리 팀 시즌 통합 기록 (리그 · 자국 컵 · 챔피언스리그 합산)
            </div>
            <TeamAnalyticsTab
              teamAnalytics={combinedTeamAnalytics}
              squadRows={combinedSquadRows}
              clubName={state.userClub.name}
              onSelectPlayer={(playerId) => openPlayerById(playerId)}
            />
          </div>
        </div>
      )}

      {/* TAB 2: LEAGUE RECORDS, POTY, BEST XI, 5-LEAGUE STANDINGS */}
      {mainTab === 'league' && (
        <div className="space-y-5">
          {awards && (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
              <div className="lg:col-span-6 space-y-4">
                {awards.poty && (
                  <div className="w-full rounded-2xl border border-amber-400/35 bg-[#121925] p-5 text-left">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                          <Crown className="w-3 h-3" />
                          {league.koreanName} 올해의 선수 (리그 MVP)
                        </span>
                        <div className="mt-1.5">
                          <PlayerNameButton
                            onClick={() => openPlayerById(awards.poty!.playerId, awards.poty!)}
                            className="font-display text-2xl font-bold text-white"
                          >
                            {awards.poty.playerName}
                          </PlayerNameButton>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-slate-300">
                          <ClubTag
                            shortName={awards.poty.teamShortName}
                            primaryColor={awards.poty.teamPrimaryColor}
                            isUserTeam={awards.poty.isUserTeam}
                          />
                          <span>{awards.poty.teamName}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[10px] text-amber-300">평균 평점</div>
                        <div className="font-display text-3xl font-bold text-amber-300">
                          {awards.poty.avgRating.toFixed(2)}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {awards.poty.goals}G {awards.poty.assists}A · MOM {awards.poty.momCount}회
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="rounded-2xl border border-slate-800 bg-[#0e141d] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-white">
                      <Award className="w-4 h-4 text-emerald-400" />
                      {league.koreanName} 개인 기록 TOP 10
                    </div>
                    <span className="text-[10px] text-slate-500">
                      선수 이름 클릭 시 세부 스탯
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 rounded-lg bg-[#090e15] p-1 text-[11px]">
                    {(
                      [
                        ['goals', '득점왕'],
                        ['assists', '도움왕'],
                        ['cleanSheets', '클린시트'],
                        ['rating', '평균평점'],
                      ] as [AwardRankTab, string][]
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setRankTab(id)}
                        className={`rounded-md border py-1.5 font-bold cursor-pointer transition-colors ${
                          rankTab === id
                            ? 'bg-slate-800 text-white border-emerald-500/50'
                            : 'border-transparent text-slate-400 hover:text-white'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="overflow-hidden rounded-xl border border-slate-800 bg-[#090e15]">
                    <table className="w-full text-left text-xs tabular-nums">
                      <thead>
                        <tr className="border-b border-slate-800 text-[10px] text-slate-400">
                          <th className="py-2 px-2.5 w-8 text-center">#</th>
                          <th className="py-2 px-2">선수 (소속팀)</th>
                          <th className="py-2 px-2 text-center">포지션</th>
                          <th className="py-2 px-2.5 text-right text-white">기록</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {activeLeaderboard.map((st, idx) => (
                          <tr
                            key={`${st.teamId}-${st.playerId}`}
                            className={`transition-colors ${
                              st.isUserTeam
                                ? 'bg-emerald-500/15'
                                : 'hover:bg-slate-800/25'
                            }`}
                          >
                            <td className="py-2 px-2.5 text-center font-display font-bold text-slate-400">
                              {idx + 1}
                            </td>
                            <td className="py-2 px-2">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <PlayerNameButton
                                  onClick={() => openPlayerById(st.playerId, st)}
                                  className="font-bold text-slate-100"
                                >
                                  {st.playerName}
                                </PlayerNameButton>
                                <ClubTag
                                  shortName={st.teamShortName}
                                  primaryColor={st.teamPrimaryColor}
                                  isUserTeam={st.isUserTeam}
                                />
                              </div>
                            </td>
                            <td className="py-2 px-2 text-center text-[11px] text-slate-400">
                              {st.mainPositions[0]}
                            </td>
                            <td className="py-2 px-2.5 text-right font-display text-sm font-bold text-emerald-300">
                              {rankTab === 'goals' && `${st.goals}골`}
                              {rankTab === 'assists' && `${st.assists}도움`}
                              {rankTab === 'cleanSheets' && `${st.cleanSheets}CS`}
                              {rankTab === 'rating' && st.avgRating.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-6">
                <BestXiPitchCard
                  title={`${league.koreanName} 시즌 베스트 11 (4-3-3)`}
                  entries={awards.bestXi}
                  accentLabel={`우리 팀 선정: ${awards.bestXi.filter((x) => x.stats.isUserTeam).length}명`}
                  onSelectPlayer={(st) => openPlayerById(st.playerId, st)}
                />
              </div>
            </div>
          )}

          {/* 5-League Final Standings + Domestic Cup Champions + Personal Leaders */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-800 bg-[#0e141d] p-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                <Globe className="w-4 h-4 text-emerald-400" />
                유럽 5대 리그 최종 현황 (순위표 · 자국 컵 우승 · 개인 기록)
              </div>
              <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-800 bg-[#090e15] p-1">
                {LEAGUES.map((lg) => {
                  const active = viewedLeagueId === lg.id;
                  const isMine = lg.id === season.leagueId;
                  return (
                    <button
                      key={lg.id}
                      type="button"
                      onClick={() => setSummaryLeagueId(lg.id)}
                      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                        active
                          ? 'bg-slate-800 text-white border-emerald-500/50'
                          : 'border-transparent text-slate-400 hover:text-white'
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

            {!isViewingUserLeague && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-950/15 px-4 py-2.5 text-xs">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-bold text-white">
                    🏆 리그 우승:{' '}
                    <strong className="text-emerald-300">
                      {viewedStandings[0]?.teamName ?? '-'} ({viewedStandings[0]?.points ?? 0}점)
                    </strong>
                  </span>
                  {viewedBgLeague?.cup?.championTeamId && (
                    <span className="font-bold text-amber-200">
                      🥇 {viewedBgLeague.cup.meta.koreanName} 우승:{' '}
                      <strong>
                        {viewedClubsById[viewedBgLeague.cup.championTeamId]?.name ??
                          viewedBgLeague.cup.championTeamId}
                      </strong>
                    </span>
                  )}
                </div>
                {viewedBgTopScorers[0] && (
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
                    <span>⚽ 득점왕:</span>
                    <PlayerNameButton
                      onClick={() =>
                        openPlayerById(viewedBgTopScorers[0].playerId, viewedBgTopScorers[0])
                      }
                      className="font-bold text-amber-300"
                    >
                      {viewedBgTopScorers[0].playerName}
                    </PlayerNameButton>
                    <span className="text-slate-400">
                      ({viewedBgTopScorers[0].goals}골)
                    </span>
                  </div>
                )}
              </div>
            )}

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

            {/* Concrete Other-4-League Personal Leaderboards (Scorers / Assisters / Ratings) */}
            {!isViewingUserLeague &&
              (viewedBgTopScorers.length > 0 || viewedBgTopRatings.length > 0) && (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {[
                    {
                      title: `⚽ ${viewedLeagueMeta.koreanName} 득점 TOP 6`,
                      list: viewedBgTopScorers,
                      fmt: (s: PlayerSeasonStats) => `${s.goals}골`,
                    },
                    {
                      title: `🎯 ${viewedLeagueMeta.koreanName} 도움 TOP 6`,
                      list: viewedBgTopAssisters,
                      fmt: (s: PlayerSeasonStats) => `${s.assists}도움`,
                    },
                    {
                      title: `⭐ ${viewedLeagueMeta.koreanName} 평점 TOP 6`,
                      list: viewedBgTopRatings,
                      fmt: (s: PlayerSeasonStats) => s.avgRating.toFixed(2),
                    },
                  ].map((col) => (
                    <div
                      key={col.title}
                      className="rounded-2xl border border-slate-800 bg-[#0e141d] p-3.5 space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-white">{col.title}</span>
                        <span className="text-[10px] text-slate-500">이름 클릭</span>
                      </div>
                      <div className="space-y-1 text-xs">
                        {col.list.map((s, idx) => (
                          <div
                            key={`${col.title}-${s.teamId}-${s.playerId}`}
                            className="flex items-center justify-between gap-2 rounded-lg bg-[#090e15] px-2.5 py-1.5"
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="w-4 shrink-0 font-mono text-[11px] text-slate-500">
                                {idx + 1}
                              </span>
                              <PlayerNameButton
                                onClick={() => openPlayerById(s.playerId, s)}
                                className="font-semibold text-slate-100"
                              >
                                {s.playerName}
                              </PlayerNameButton>
                              <span className="text-[10px] text-slate-500 shrink-0">
                                ({s.teamShortName})
                              </span>
                            </div>
                            <span className="font-mono font-bold text-emerald-300 shrink-0">
                              {col.fmt(s)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

            {/* 5대 리그 챔피언스리그 진출 20팀 + 리그/컵 우승/득점왕 요약 */}
            <div className="rounded-2xl border border-slate-800 bg-[#0e141d] p-4 space-y-3">
              <div className="text-xs font-bold text-white">
                5대 리그 최종 우승 · 자국 컵 · 득점왕 · UCL 진출 20팀 요약
              </div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
                {uclQualifiedByLeague.map((entry) => {
                  const isMine = entry.leagueId === season.leagueId;
                  const bg = isMine ? null : season.otherLeagues?.[entry.leagueId];
                  const cupObj = isMine ? season.cup : bg?.cup;
                  const cupChampId = cupObj?.championTeamId ?? null;
                  const cupChampName = cupChampId
                    ? (isMine
                        ? clubsById[cupChampId]?.shortName
                        : bg?.clubs.find((c) => c.id === cupChampId)?.shortName) ?? cupChampId
                    : null;
                  const statsSource = isMine
                    ? season.allPlayerStats
                    : (bg?.playerStats ?? {});
                  const topScorer = Object.values(statsSource)
                    .filter((s) => s.goals > 0)
                    .sort((a, b) => b.goals - a.goals || b.assists - a.assists)[0];

                  return (
                    <div
                      key={entry.leagueId}
                      className="rounded-xl border border-slate-800 bg-[#090e15] p-3 space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-[11px] font-bold text-emerald-300">
                        <span>{entry.leagueKoreanName}</span>
                        {cupChampName && (
                          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] text-amber-300">
                            컵: {cupChampName}
                          </span>
                        )}
                      </div>
                      {entry.teams.map((c, idx) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() =>
                            setInspectedClub({
                              club: c,
                              leagueId: entry.leagueId,
                            })
                          }
                          className="flex w-full items-center justify-between text-left text-[11px] text-slate-300 hover:text-white cursor-pointer"
                        >
                          <span
                            className={`truncate ${
                              c.isUser ? 'font-bold text-emerald-300' : ''
                            }`}
                          >
                            {idx === 0 ? '🏆' : `${idx + 1}.`} {c.name}
                          </span>
                          <span className="font-mono text-slate-400">
                            {c.shortName}
                          </span>
                        </button>
                      ))}
                      {topScorer && (
                        <div className="pt-1.5 mt-1 border-t border-slate-800/80 flex items-center justify-between gap-1 text-[10px]">
                          <span className="text-slate-500 shrink-0">⚽ 득점왕</span>
                          <PlayerNameButton
                            onClick={() => openPlayerById(topScorer.playerId, topScorer)}
                            className="font-bold text-amber-200"
                          >
                            {topScorer.playerName}
                          </PlayerNameButton>
                          <span className="font-mono text-emerald-300 shrink-0">
                            {topScorer.goals}G
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <TeamAnalyticsTab
            teamAnalytics={leagueTeamAnalytics}
            squadRows={leagueSquadRows}
            clubName={`${state.userClub.name} (${league.koreanName})`}
            onSelectPlayer={(playerId) => openPlayerById(playerId)}
          />
        </div>
      )}

      {/* TAB 3: DOMESTIC CUP BRACKET & STATS */}
      {mainTab === 'cup' && (
        <div className="space-y-5">
          {season.cup ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-[#0e141d] p-5">
                <div className="flex items-center gap-4">
                  <PixelTrophySvg
                    variant={getDomesticCupTrophyVariant(season.leagueId)}
                    size={56}
                    animate={wonCup}
                  />
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                      {season.cup.meta.name}
                    </div>
                    <h2 className="font-display text-2xl font-bold text-white">
                      {season.cup.meta.koreanName} 최종 결과 ·{' '}
                      <span className="text-emerald-300">
                        {getUserCupResultLabel(season.cup, USER_CLUB_ID)}
                      </span>
                    </h2>
                    {season.cup.championTeamId && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        최종 우승팀:{' '}
                        <strong className="text-amber-300">
                          {clubsById[season.cup.championTeamId]?.name ?? '-'}
                        </strong>
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <CupBracketView
                cup={season.cup}
                clubs={season.clubs}
                leagueId={season.leagueId}
                onSelectMatch={(m) => {
                  setInspectedTie(null);
                  setInspectedMatch(m);
                }}
              />

              {cupTeamAnalytics && season.userCupMatchHistory.length > 0 && (
                <TeamAnalyticsTab
                  teamAnalytics={cupTeamAnalytics}
                  squadRows={cupSquadRows}
                  clubName={`${state.userClub.name} (${season.cup.meta.koreanName})`}
                  onSelectPlayer={(playerId) => openPlayerById(playerId)}
                />
              )}
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-800 bg-[#0e141d] p-10 text-center text-sm text-slate-400">
              자국 컵대회 기록이 없습니다.
            </div>
          )}
        </div>
      )}

      {/* TAB 4: CHAMPIONS LEAGUE FULL PERSISTENT ARCHIVE */}
      {mainTab === 'ucl' && (
        <div className="space-y-5">
          {season.ucl ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-[#0e141d] p-5">
                <div className="flex items-center gap-4">
                  <PixelTrophySvg variant="ucl" size={60} animate={wonUcl} />
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-sky-300">
                      UEFA CHAMPIONS LEAGUE · 36 TEAMS ARCHIVE
                    </div>
                    <h2 className="font-display text-2xl font-bold text-white">
                      우리 팀 최종 성적:{' '}
                      <span className="text-emerald-300">
                        {getUserUclResultLabel(season.ucl, USER_CLUB_ID)}
                      </span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      우승팀:{' '}
                      <strong className="text-amber-300">
                        {season.ucl.championTeamId
                          ? uclClubsById[season.ucl.championTeamId]?.name ?? '-'
                          : '진행 중'}
                      </strong>
                      {season.ucl.userLeaguePhaseRank &&
                        ` · 스위스 리그 페이즈 ${season.ucl.userLeaguePhaseRank}위`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Authentic UCL Bracket Tree */}
              <UclBracketTree
                ucl={season.ucl}
                clubsById={uclClubsById}
                onSelectTie={(tie) => {
                  setInspectedMatch(null);
                  setInspectedTie(tie);
                }}
              />

              {/* UCL 36-Team Final Swiss Standings */}
              <div className="rounded-2xl border border-slate-800 bg-[#0e141d] p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-bold text-white">
                    UCL 36팀 스위스 리그 페이즈 최종 순위표 (구단 클릭 시 스쿼드)
                  </h3>
                  <div className="flex gap-3 text-[11px]">
                    <span className="text-emerald-400">1~8위 16강 직행</span>
                    <span className="text-amber-400">9~24위 PO</span>
                    <span className="text-rose-400">25~36위 탈락</span>
                  </div>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-left text-xs tabular-nums">
                    <thead className="sticky top-0 bg-[#0e141d] border-b border-slate-800 text-[10px] text-slate-400">
                      <tr>
                        <th className="py-2 px-2">#</th>
                        <th className="py-2 px-2">구단</th>
                        <th className="py-2 px-1.5 text-center">경기</th>
                        <th className="py-2 px-1.5 text-center">승</th>
                        <th className="py-2 px-1.5 text-center">무</th>
                        <th className="py-2 px-1.5 text-center">패</th>
                        <th className="py-2 px-1.5 text-center">득실</th>
                        <th className="py-2 px-2 text-center">승점</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {season.ucl.standings.map((row, idx) => (
                        <tr
                          key={row.teamId}
                          onClick={() => {
                            const c = uclClubsById[row.teamId];
                            if (c) setInspectedClub({ club: c });
                          }}
                          className={`cursor-pointer transition-colors ${
                            idx < 8
                              ? 'border-l-2 border-l-emerald-400'
                              : idx < 24
                                ? 'border-l-2 border-l-amber-400'
                                : 'border-l-2 border-l-rose-500/70'
                          } ${
                            row.isUser
                              ? 'bg-emerald-500/15 font-bold text-white hover:bg-emerald-500/25'
                              : 'text-slate-300 hover:bg-slate-800/40'
                          }`}
                        >
                          <td className="py-1.5 px-2 font-mono">{idx + 1}</td>
                          <td className="py-1.5 px-2 hover:text-sky-300">{row.teamName}</td>
                          <td className="py-1.5 px-1.5 text-center font-mono">{row.played}</td>
                          <td className="py-1.5 px-1.5 text-center font-mono">{row.won}</td>
                          <td className="py-1.5 px-1.5 text-center font-mono">{row.drawn}</td>
                          <td className="py-1.5 px-1.5 text-center font-mono">{row.lost}</td>
                          <td className="py-1.5 px-1.5 text-center font-mono">
                            {row.goalDifference >= 0 ? `+${row.goalDifference}` : row.goalDifference}
                          </td>
                          <td className="py-1.5 px-2 text-center font-mono font-bold text-white">
                            {row.points}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* UCL Leaders */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {[
                  { title: '⚽ UCL 득점 순위', list: uclLeaders.scorers, fmt: (s: PlayerSeasonStats) => `${s.goals}골` },
                  { title: '🎯 UCL 도움 순위', list: uclLeaders.assisters, fmt: (s: PlayerSeasonStats) => `${s.assists}도움` },
                  { title: '⭐ UCL 평점 순위', list: uclLeaders.ratings, fmt: (s: PlayerSeasonStats) => s.avgRating.toFixed(2) },
                ].map((col) => (
                  <div
                    key={col.title}
                    className="rounded-2xl border border-slate-800 bg-[#0e141d] p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-white">{col.title}</h4>
                      <span className="text-[10px] text-slate-500">이름 클릭 시 세부 스탯</span>
                    </div>
                    <div className="space-y-1 text-xs">
                      {col.list.map((s, idx) => (
                        <div
                          key={`${s.teamId}-${s.playerId}`}
                          className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left ${
                            s.isUserTeam
                              ? 'bg-emerald-500/15 font-bold text-white'
                              : 'bg-[#090e15] text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="w-4 shrink-0 font-mono text-[11px] text-slate-500">
                              {idx + 1}.
                            </span>
                            {(() => {
                              const nat = getPlayerNationalityMeta(s.playerId);
                              return nat ? (
                                <CountryFlagSvg
                                  code={nat.nationalityCode}
                                  nationality={nat.nationality}
                                  size="xs"
                                />
                              ) : null;
                            })()}
                            <PlayerNameButton
                              onClick={() => openPlayerById(s.playerId, s)}
                              className="font-semibold"
                            >
                              {s.playerName}
                            </PlayerNameButton>
                            <span className="text-[10px] text-slate-500 shrink-0">
                              ({s.teamShortName})
                            </span>
                          </div>
                          <span className="font-mono font-bold text-sky-300 shrink-0">
                            {col.fmt(s)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {uclTeamAnalytics && season.userUclMatchHistory.length > 0 && (
                <TeamAnalyticsTab
                  teamAnalytics={uclTeamAnalytics}
                  squadRows={uclSquadRows}
                  clubName={`${state.userClub.name} (UEFA 챔피언스리그)`}
                  onSelectPlayer={(playerId) => openPlayerById(playerId)}
                />
              )}
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-800 bg-[#0e141d] p-10 text-center space-y-3">
              <div className="flex justify-center">
                <PixelTrophySvg variant="ucl" size={56} />
              </div>
              <p className="text-sm font-bold text-white">
                {canStartUcl
                  ? '아직 챔피언스리그에 출전하지 않았습니다.'
                  : '이번 시즌 챔피언스리그에 진출하지 못했습니다.'}
              </p>
              {canStartUcl && (
                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={enterUclMode}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-extrabold text-slate-950 hover:bg-emerald-400 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    36팀 챔피언스리그 시작하기
                  </button>
                  <button
                    type="button"
                    onClick={skipUclToFinalSummary}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs font-bold text-slate-200 hover:border-amber-400/50 hover:text-amber-300 cursor-pointer"
                  >
                    <Crown className="w-3.5 h-3.5" />
                    챔스 자동 시뮬 후 최종 결산
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: FULL MATCH-BY-MATCH HISTORY LOG */}
      {mainTab === 'history' && (
        <div className="rounded-2xl border border-slate-800 bg-[#0e141d] p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-white">
                전체 경기 히스토리 ({filteredHistory.length}경기)
              </h3>
              <p className="text-xs text-slate-400">
                경기를 클릭하면 득점자·도움·점유율·xG·승부차기·MOM 등 상세 리포트를 확인할 수 있습니다
              </p>
            </div>
            <div className="flex flex-wrap gap-1 rounded-xl border border-slate-800 bg-[#090e15] p-1">
              {(
                [
                  ['all', `전체 (${fullMatchEntries.length})`],
                  ['league', `리그 (${season.userMatchHistory.length})`],
                  ['cup', `자국 컵 (${season.userCupMatchHistory.length})`],
                  ['ucl', `챔스 (${season.userUclMatchHistory.length})`],
                ] as [HistoryFilter, string][]
              ).map(([fid, flabel]) => (
                <button
                  key={fid}
                  type="button"
                  onClick={() => setHistoryFilter(fid)}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold cursor-pointer transition-colors ${
                    historyFilter === fid
                      ? 'bg-slate-800 text-white border-emerald-500/50'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  {flabel}
                </button>
              ))}
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <p className="py-10 text-center text-xs text-slate-500">
              해당 대회의 경기 기록이 없습니다.
            </p>
          ) : (
            <div className="space-y-1.5">
              {filteredHistory.map(({ summary: m, raw }, idx) => (
                <button
                  key={`${m.label}-${idx}`}
                  type="button"
                  disabled={!raw}
                  onClick={() => {
                    if (!raw) return;
                    setInspectedTie(null);
                    setInspectedMatch(raw);
                  }}
                  className="flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800/80 bg-[#090e15] px-3.5 py-2.5 text-left text-xs transition-colors hover:border-emerald-500/45 hover:bg-[#0c131d] cursor-pointer disabled:cursor-default"
                >
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                        m.competition === 'ucl'
                          ? 'bg-sky-500/20 text-sky-300'
                          : m.competition === 'cup'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {m.label}
                    </span>
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-black ${
                        m.outcome === 'W'
                          ? 'bg-emerald-500 text-slate-950'
                          : m.outcome === 'L'
                            ? 'bg-rose-500 text-white'
                            : 'bg-slate-600 text-white'
                      }`}
                    >
                      {m.outcome}
                    </span>
                    <span className="font-bold text-white">
                      {m.isHome ? 'vs' : '@'} {m.opponentName}
                    </span>
                    {m.scorers.length > 0 && (
                      <span className="text-[11px] text-slate-400">
                        ⚽ {m.scorers.join(', ')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-sm font-bold text-white shrink-0">
                    <span>
                      {m.userGoals} - {m.oppGoals}
                    </span>
                    {m.note && (
                      <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[10px] font-bold text-purple-200">
                        {m.note}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Club Squad Modal (Formation default ↔ List toggle) */}
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
        starters={
          inspectedClub?.club.id === USER_CLUB_ID ? state.starters : undefined
        }
        bench={
          inspectedClub?.club.id === USER_CLUB_ID ? state.bench : undefined
        }
        formation={
          inspectedClub?.club.id === USER_CLUB_ID ? state.formation : undefined
        }
        tactic={
          inspectedClub?.club.id === USER_CLUB_ID
            ? state.defaultTactic
            : undefined
        }
        managerOverride={
          inspectedClub?.club.id === USER_CLUB_ID
            ? {
                name: state.manager.name || '내 감독',
                traitId: state.manager.traitId,
                avatar: state.manager.avatar,
              }
            : null
        }
        defaultViewMode="formation"
        statsMap={
          inspectedClub?.leagueId && inspectedClub.leagueId !== season.leagueId
            ? mergePlayerStatsMaps(
                season.otherLeagues?.[inspectedClub.leagueId]?.playerStats ?? {},
                season.otherLeagues?.[inspectedClub.leagueId]?.cupPlayerStats ?? {},
                season.uclPlayerStats,
              )
            : combinedStatsMap
        }
        conditionMap={season.playerConditions}
        onSelectPlayer={(player) => {
          setInspectedClub(null);
          openPlayerById(player.id);
        }}
        onClose={() => setInspectedClub(null)}
      />

      {/* Match / UCL Tie Detail Modal */}
      <MatchDetailModal
        key={inspectedTie?.id ?? inspectedMatch?.fixtureId ?? 'summary-match-detail'}
        match={inspectedMatch}
        tie={inspectedTie}
        clubsById={uclClubsById}
        onSelectPlayer={(playerId) => openPlayerById(playerId)}
        onClose={() => {
          setInspectedMatch(null);
          setInspectedTie(null);
        }}
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
        const matchedSlotSubPos =
          starterIdx >= 0
            ? FORMATIONS[state.formation]?.slots[starterIdx]?.subPosition
            : undefined;
        return (
          <PlayerDetailModal
            player={resolved}
            slotSubPosition={matchedSlotSubPos}
            managerTraitId={state.manager.traitId}
            seasonStats={breakdown.total}
            competitionStats={breakdown}
            onClose={() => setInspectedPlayer(null)}
          />
        );
      })()}
    </div>
  );
}
