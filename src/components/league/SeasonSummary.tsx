import {
  Award,
  BarChart3,
  CheckCircle2,
  Crown,
  Globe,
  RotateCcw,
  Sparkles,
  Star,
  Trophy,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { FORMATIONS } from '../../data/formations';
import {
  computeMatchesOnlyAnalytics,
  computeSquadPlayerAnalytics,
  computeTeamSeasonAnalytics,
  mergePlayerStatsMaps,
} from '../../engine/analyticsEngine';
import { didUserWinCup, getUserCupResultLabel } from '../../engine/cupEngine';
import { getLeagueById, LEAGUES } from '../../engine/dataLoader';
import { USER_CLUB_ID } from '../../engine/matchEngine';
import { buildFiveLeagueUclQualifiers } from '../../engine/otherLeaguesEngine';
import { formatMainPositions } from '../../engine/positionEngine';
import { getUserRank } from '../../engine/standingsEngine';
import { didUserWinUcl, getUserUclResultLabel } from '../../engine/uclEngine';
import { useGame } from '../../store/GameContext';
import type { Club, LeagueId, PlayerSeasonStats } from '../../types/league';
import { ClubTag } from '../common/ClubTag';
import { JerseySvg } from '../common/JerseySvg';
import { StandingsTable } from './StandingsTable';
import { TeamAnalyticsTab } from './TeamAnalyticsTab';

type SummaryMainTab = 'awards' | 'analytics' | 'standings';
type AwardRankTab = 'goals' | 'assists' | 'cleanSheets' | 'rating';
type AnalyticsScope = 'league' | 'cup' | 'ucl' | 'combined';

export function SeasonSummary() {
  const {
    state,
    enterUclMode,
    archiveCurrentSeasonNow,
    setLegacyModalOpen,
    resetGame,
  } = useGame();
  const [mainTab, setMainTab] = useState<SummaryMainTab>('awards');
  const [rankTab, setRankTab] = useState<AwardRankTab>('goals');
  const [analyticsScope, setAnalyticsScope] = useState<AnalyticsScope>('combined');
  const [summaryLeagueId, setSummaryLeagueId] = useState<LeagueId | null>(null);
  const season = state.season;

  const clubsById = useMemo(() => {
    const map: Record<string, Club> = {};
    if (season) {
      for (const c of season.clubs) map[c.id] = c;
    }
    return map;
  }, [season]);

  const allKnownClubs = useMemo(() => {
    if (!season) return [];
    const map = new Map<string, Club>();
    for (const c of season.clubs) map.set(c.id, c);
    if (season.ucl) {
      for (const c of season.ucl.clubs) map.set(c.id, c);
    }
    return Array.from(map.values());
  }, [season]);

  const combinedStatsMap = useMemo(() => {
    if (!season) return {};
    return mergePlayerStatsMaps(
      season.allPlayerStats,
      season.cupPlayerStats,
      season.uclPlayerStats,
    );
  }, [season]);

  const activeTeamAnalytics = useMemo(() => {
    if (!season) return null;
    if (analyticsScope === 'league') {
      return computeTeamSeasonAnalytics({
        standings: season.standings,
        userMatchHistory: season.userMatchHistory,
        clubs: season.clubs,
        userClubId: USER_CLUB_ID,
      });
    }
    if (analyticsScope === 'cup') {
      return computeMatchesOnlyAnalytics({
        matches: season.userCupMatchHistory,
        clubs: season.clubs,
        userClubId: USER_CLUB_ID,
      });
    }
    if (analyticsScope === 'ucl') {
      return computeMatchesOnlyAnalytics({
        matches: season.userUclMatchHistory,
        clubs: allKnownClubs,
        userClubId: USER_CLUB_ID,
      });
    }
    return computeMatchesOnlyAnalytics({
      matches: [
        ...season.userMatchHistory,
        ...season.userCupMatchHistory,
        ...season.userUclMatchHistory,
      ],
      clubs: allKnownClubs,
      userClubId: USER_CLUB_ID,
    });
  }, [season, analyticsScope, allKnownClubs]);

  const activeSquadAnalytics = useMemo(() => {
    if (!season) return [];
    const targetMap =
      analyticsScope === 'league'
        ? season.allPlayerStats
        : analyticsScope === 'cup'
          ? season.cupPlayerStats
          : analyticsScope === 'ucl'
            ? season.uclPlayerStats
            : combinedStatsMap;
    return computeSquadPlayerAnalytics({
      starters: state.starters,
      bench: state.bench,
      allPlayerStats: targetMap,
    });
  }, [season, state.starters, state.bench, analyticsScope, combinedStatsMap]);

  if (!season || !activeTeamAnalytics) return null;

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
  const bestXiSlots = FORMATIONS['4-3-3'].slots;

  const activeLeaderboard: PlayerSeasonStats[] = awards
    ? rankTab === 'goals'
      ? awards.topScorers
      : rankTab === 'assists'
        ? awards.topAssisters
        : rankTab === 'cleanSheets'
          ? awards.topCleanSheets
          : awards.topRatings
    : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-5">
      {/* Main Season Result & 1-Run Treble UCL Entry Banner */}
      {qualifiedForUcl ? (
        <section className="rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-[#0e231c] via-[#111822] to-[#0c1a33] p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-300">
                  <Trophy className="w-3.5 h-3.5" />
                  {finalRank === 1
                    ? `${league.koreanName} 우승 · UCL 1포트 진출`
                    : `${league.koreanName} 최종 ${finalRank}위 · TOP 4 달성`}
                </span>
                {season.cup && (
                  <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-bold text-slate-200">
                    🏆 {season.cup.meta.koreanName} {getUserCupResultLabel(season.cup, USER_CLUB_ID)}
                  </span>
                )}
                {season.ucl && (
                  <span className="rounded-full bg-sky-500/20 px-3 py-1 text-xs font-bold text-sky-300">
                    ⭐ UCL {getUserUclResultLabel(season.ucl, USER_CLUB_ID)}
                  </span>
                )}
                {isTreble && (
                  <span className="rounded-full bg-gradient-to-r from-amber-400 to-yellow-300 px-3 py-1 text-xs font-black text-slate-950">
                    👑 역사적 트레블 달성!
                  </span>
                )}
              </div>

              <h1 className="font-display text-3xl sm:text-4xl font-bold text-white">
                {isTreble
                  ? '유럽 축구의 전설, 트레블 완성!'
                  : wonUcl
                    ? 'UEFA 챔피언스리그 우승 달성!'
                    : canStartUcl
                      ? '챔피언스리그 진출 성공! 트레블에 도전하세요'
                      : '시즌 여정이 마무리되었습니다'}
              </h1>

              <p className="max-w-xl text-sm text-slate-300 leading-relaxed">
                <strong className="text-white">{state.userClub.name}</strong>이(가){' '}
                {season.totalRounds}R 최종{' '}
                <strong className="text-emerald-300">
                  {userRow.points}점 ({userRow.won}승 {userRow.drawn}무{' '}
                  {userRow.lost}패, 득실{' '}
                  {userRow.goalDifference >= 0
                    ? `+${userRow.goalDifference}`
                    : userRow.goalDifference}
                  )
                </strong>
                으로 정규 리그를 마쳤습니다.
              </p>

              {/* Primary Phase 2 CTA: Enter 36-Team Champions League! */}
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                {canStartUcl && (
                  <button
                    id="enter-ucl-mode-btn"
                    type="button"
                    onClick={enterUclMode}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-400 via-blue-400 to-emerald-400 px-5 py-3 text-sm font-black text-slate-950 shadow-lg shadow-sky-900/40 hover:brightness-105 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    🏆 36팀 챔피언스리그 도전하기 (특별 이적시장 1회)
                  </button>
                )}

                {canStartUcl && !season.legacyArchived && (
                  <button
                    type="button"
                    onClick={archiveCurrentSeasonNow}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-xs font-bold text-slate-300 hover:border-amber-400/50 hover:text-amber-300 cursor-pointer"
                  >
                    <Crown className="w-3.5 h-3.5" />
                    챔스 건너뛰고 명예의 전당 기록
                  </button>
                )}

                {season.legacyArchived && (
                  <button
                    type="button"
                    onClick={() => setLegacyModalOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/50 bg-amber-500/15 px-4 py-2.5 text-xs font-black text-amber-300 hover:bg-amber-500/25 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    명예의 전당 등재 완료 · 레거시 확인 →
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4 rounded-xl border border-slate-800 bg-[#0b1018] p-4 shrink-0">
              <JerseySvg
                primaryColor={state.userClub.primaryColor}
                secondaryColor={state.userClub.secondaryColor}
                pattern={state.userClub.pattern}
                label={state.userClub.shortName}
                size={64}
              />
              <div className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-3xl font-bold text-amber-300">
                    #{finalRank}
                  </span>
                  <span className="text-xs font-bold text-slate-300">
                    {state.userClub.name}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={resetGame}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-300 hover:text-white cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    새 커리어
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-800 bg-[#111822] p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-300">
                  {league.koreanName} 시즌 종료 · 최종 {finalRank}위
                </span>
                {season.cup && (
                  <span className="rounded bg-amber-500/15 px-2.5 py-1 text-xs font-bold text-amber-300">
                    🏆 {season.cup.meta.koreanName} {getUserCupResultLabel(season.cup, USER_CLUB_ID)}
                  </span>
                )}
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-white">
                아쉽게 챔피언스리그 진출권을 놓쳤습니다
              </h1>
              <p className="text-sm text-slate-400">
                최종 {userRow.points}점 ({userRow.won}승 {userRow.drawn}무 {userRow.lost}패) · 4위{' '}
                {fourthRow?.teamName}({fourthRow?.points}점)과{' '}
                <strong className="text-amber-300">
                  {Math.max(0, (fourthRow?.points ?? 0) - userRow.points)}점
                </strong>{' '}
                차이
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setLegacyModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-2.5 text-xs font-bold text-amber-300 hover:bg-amber-500/20 cursor-pointer"
              >
                <Crown className="w-4 h-4" />
                명예의 전당 보기
              </button>
              <button
                type="button"
                onClick={resetGame}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-extrabold text-slate-950 hover:bg-emerald-400 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                새 커리어 재도전
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Fair Season Score Breakdown Card */}
      {score && (
        <section className="rounded-2xl border border-amber-500/30 bg-[#111822] p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400 text-lg font-black text-slate-950">
                {score.grade}
              </span>
              <div>
                <div className="text-xs font-bold text-amber-300">
                  공정 시즌 스코어 (34R/38R PPG×38 보정)
                </div>
                <div className="font-display text-2xl font-black text-white tabular-nums">
                  {score.totalScore.toLocaleString()} PTS
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setLegacyModalOpen(true)}
              className="rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-bold text-slate-200 hover:border-amber-400/60 hover:text-amber-300 cursor-pointer"
            >
              🏛️ 명예의 전당 · 24종 레거시 도감 →
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 text-center">
            {[
              { label: '리그 환산(PPG×38)', val: score.leagueConvertedScore },
              { label: '리그 순위', val: score.leagueRankBonus },
              { label: '자국 컵', val: score.cupBonus },
              { label: '챔피언스리그', val: score.uclBonus },
              { label: '대업(트레블/무패)', val: score.honorsBonus },
              { label: '언더독 보너스', val: score.underdogBonus },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-slate-800 bg-[#0b1018] p-2.5"
              >
                <div className="text-[10px] text-slate-400">{item.label}</div>
                <div className="mt-0.5 font-mono text-sm font-black text-emerald-300">
                  +{item.val.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Season Summary Main Tabs */}
      <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-slate-800 bg-[#111822] p-1">
        <button
          type="button"
          onClick={() => setMainTab('awards')}
          className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-extrabold cursor-pointer ${
            mainTab === 'awards'
              ? 'bg-emerald-500 text-slate-950'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Award className="w-4 h-4" />
          시즌 수상 · 베스트 11
        </button>
        <button
          id="season-analytics-tab-btn"
          type="button"
          onClick={() => setMainTab('analytics')}
          className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-extrabold cursor-pointer ${
            mainTab === 'analytics'
              ? 'bg-emerald-500 text-slate-950'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          우리 팀 시즌 세부 분석
        </button>
        <button
          type="button"
          onClick={() => setMainTab('standings')}
          className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-extrabold cursor-pointer ${
            mainTab === 'standings'
              ? 'bg-emerald-500 text-slate-950'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Trophy className="w-4 h-4" />
          최종 순위표
        </button>
      </div>

      {/* TAB 1: AWARDS & BEST XI */}
      {mainTab === 'awards' && awards && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Left: POTY + Personal Rankings TOP 10 (6 cols) */}
          <div className="lg:col-span-6 space-y-5">
            {awards.poty && (
              <div className="card-legend-glow relative overflow-hidden rounded-2xl p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-2.5 py-0.5 text-[10px] font-black text-slate-950">
                      <Crown className="w-3 h-3" />
                      {league.koreanName} 올해의 선수 (POTY)
                    </div>
                    <h2 className="mt-2 font-display text-2xl sm:text-3xl font-bold text-white">
                      {awards.poty.playerName}
                    </h2>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-amber-200">
                      <ClubTag
                        shortName={awards.poty.teamShortName}
                        primaryColor={awards.poty.teamPrimaryColor}
                        isUserTeam={awards.poty.isUserTeam}
                        size="sm"
                      />
                      <span className="font-semibold">
                        {awards.poty.teamName} ({formatMainPositions({ mainPositions: awards.poty.mainPositions })})
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-[10px] font-bold text-amber-300">
                      평균 평점
                    </div>
                    <div className="font-display text-4xl font-bold text-amber-300 tabular-nums">
                      {awards.poty.avgRating.toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs tabular-nums">
                  <div className="rounded-lg bg-slate-950/75 p-2">
                    <div className="text-[10px] text-slate-400">출전</div>
                    <div className="font-display text-base font-bold text-white">
                      {awards.poty.appearances}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-950/75 p-2">
                    <div className="text-[10px] text-slate-400">득점</div>
                    <div className="font-display text-base font-bold text-emerald-300">
                      {awards.poty.goals}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-950/75 p-2">
                    <div className="text-[10px] text-slate-400">도움</div>
                    <div className="font-display text-base font-bold text-sky-300">
                      {awards.poty.assists}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-950/75 p-2">
                    <div className="text-[10px] text-slate-400">MOM</div>
                    <div className="font-display text-base font-bold text-amber-300">
                      {awards.poty.momCount}회
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Personal Rankings TOP 10 */}
            <div className="rounded-2xl border border-slate-800 bg-[#111822] p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <Award className="w-4 h-4 text-emerald-400" />
                리그 개인 기록 TOP 10
              </div>

              <div className="grid grid-cols-4 gap-1 rounded-lg bg-[#0b1018] p-1 text-[11px]">
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
                    className={`rounded-md py-1.5 font-bold cursor-pointer ${
                      rankTab === id
                        ? 'bg-emerald-500 text-slate-950'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-800 bg-[#0b1018]">
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
                        className={
                          st.isUserTeam
                            ? 'bg-emerald-500/15'
                            : 'hover:bg-slate-800/30'
                        }
                      >
                        <td className="py-2 px-2.5 text-center font-display font-bold text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-100">
                              {st.playerName}
                            </span>
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

          {/* Right: 4-3-3 League Best XI Pitch (6 cols) */}
          <div className="lg:col-span-6 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                <Star className="w-4 h-4 text-amber-400 fill-current" />
                {league.koreanName} 시즌 베스트 11 (4-3-3)
              </div>
              <span className="text-[11px] text-emerald-300">
                MY 배지 = 우리 팀 선수
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

              {awards.bestXi.map((entry) => {
                const slot = bestXiSlots[entry.slotIndex];
                if (!slot) return null;
                const isMine = entry.stats.isUserTeam;
                return (
                  <div
                    key={entry.slotIndex}
                    style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center"
                  >
                    <div
                      className={`flex flex-col items-center rounded-xl px-2 py-1 min-w-[70px] sm:min-w-[82px] text-center shadow-lg ${
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
                      <span className="mt-0.5 max-w-[80px] truncate text-[10px] font-bold text-white">
                        {entry.stats.playerName}
                      </span>
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
        </div>
      )}

      {/* TAB 2: [우리 팀 시즌 세부 분석] (리그 / 자국 컵 / 챔스 / 시즌 통합) */}
      {mainTab === 'analytics' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-800 bg-[#111822] p-3">
            <span className="text-xs font-extrabold text-slate-200">
              대회별 기록 필터 (득점·도움·xG·출전시간·평균평점)
            </span>
            <div className="flex flex-wrap gap-1 rounded-xl border border-slate-800 bg-[#0b1018] p-1">
              {(
                [
                  ['combined', `시즌 통합 (${season.userMatchHistory.length + season.userCupMatchHistory.length + season.userUclMatchHistory.length}경기)`],
                  ['league', `리그 (${season.userMatchHistory.length}경기)`],
                  ['cup', `${season.cup?.meta.koreanName ?? '자국 컵'} (${season.userCupMatchHistory.length}경기)`],
                  ['ucl', `챔스 (${season.userUclMatchHistory.length}경기)`],
                ] as [AnalyticsScope, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setAnalyticsScope(id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                    analyticsScope === id
                      ? 'bg-emerald-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <TeamAnalyticsTab
            teamAnalytics={activeTeamAnalytics}
            squadRows={activeSquadAnalytics}
            clubName={state.userClub.name}
          />
        </div>
      )}

      {/* TAB 3: FINAL STANDINGS (5대 리그 전환 + Phase 2 UCL 20팀 진출 확정) */}
      {mainTab === 'standings' && (
        <div className="space-y-5">
          {/* 5대 리그 전환 탭 */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-800 bg-[#111822] p-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
              <Globe className="w-4 h-4 text-emerald-400" />
              유럽 5대 리그 최종 순위표 (UCL 진출권 TOP 4)
            </div>
            <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-800 bg-[#0b1018] p-1">
              {LEAGUES.map((lg) => {
                const active = viewedLeagueId === lg.id;
                const isMine = lg.id === season.leagueId;
                return (
                  <button
                    key={lg.id}
                    type="button"
                    onClick={() => setSummaryLeagueId(lg.id)}
                    className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                      active
                        ? 'bg-emerald-500 text-slate-950'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>{lg.koreanName}</span>
                    {isMine && (
                      <span
                        className={`rounded px-1 text-[8px] font-black ${
                          active
                            ? 'bg-slate-950 text-emerald-300'
                            : 'bg-emerald-500/20 text-emerald-300'
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

          <StandingsTable
            standings={viewedStandings}
            clubsById={viewedClubsById}
            uclSpots={viewedLeagueMeta.uclSpots}
            relegationSpots={viewedLeagueMeta.relegationSpots}
          />

          {/* 5대 리그 챔피언스리그 진출 확정 20팀 (Phase 2 연동 준비) */}
          <div className="rounded-2xl border border-emerald-500/30 bg-[#111822] p-4 sm:p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-extrabold text-white">
                <Trophy className="w-4 h-4 text-amber-400" />
                5대 리그 챔피언스리그 진출 확정 20팀 (Phase 2 연동 데이터)
              </div>
              <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                5대 리그 × TOP 4 = 20팀 저장 완료
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {uclQualifiedByLeague.map((entry) => {
                const lgMeta = getLeagueById(entry.leagueId);
                return (
                  <div
                    key={entry.leagueId}
                    className="rounded-xl border border-slate-800 bg-[#0b1018] p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className="rounded px-1.5 py-0.5 text-[10px] font-extrabold text-slate-950"
                        style={{ backgroundColor: lgMeta.accentColor }}
                      >
                        {entry.leagueKoreanName}
                      </span>
                      {entry.leagueId === season.leagueId && (
                        <span className="text-[9px] font-bold text-emerald-400">
                          MY 리그
                        </span>
                      )}
                    </div>
                    <div className="space-y-1">
                      {entry.teams.map((club, idx) => (
                        <div
                          key={club.id}
                          className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] ${
                            club.isUser
                              ? 'bg-emerald-500/15 border border-emerald-500/40 font-bold text-emerald-200'
                              : 'bg-[#111822] text-slate-200'
                          }`}
                        >
                          <span className="font-display text-xs font-bold text-emerald-400 w-3.5">
                            {idx + 1}
                          </span>
                          <span
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: club.primaryColor }}
                          />
                          <span className="truncate">{club.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
