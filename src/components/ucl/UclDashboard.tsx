import {
  Award,
  FastForward,
  Play,
  Shield,
  Sparkles,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { FORMATION_LIST } from '../../data/formations';
import {
  getInjuryTooltip,
  getMoraleLabel,
  getMoraleTier,
  isPlayerActivelyInjured,
} from '../../engine/conditionEngine';
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
import type { UclKnockoutTie } from '../../types/ucl';
import {
  buildPlayerCompetitionBreakdown,
  getPlayerNationalityMeta,
  resolveClubRoster,
  resolvePlayerById,
} from '../../utils/playerLookup';
import { ClubSquadModal } from '../common/ClubSquadModal';
import { CountryFlagSvg } from '../common/CountryFlagSvg';
import { JerseySvg } from '../common/JerseySvg';
import { ManagerTraitBadgeCard } from '../common/ManagerTraitBadgeCard';
import { MatchDetailModal } from '../common/MatchDetailModal';
import { PitchBoard, type SlotRef } from '../common/PitchBoard';
import { PixelStatusIcon } from '../common/PixelStatusIcon';
import { PixelTrophySvg } from '../common/PixelTrophySvg';
import { PlayerDetailModal } from '../common/PlayerDetailModal';
import { PlayerNameButton } from '../common/PlayerNameButton';
import { LiveMatchBroadcast } from '../league/LiveMatchBroadcast';
import { MatchDayTacticsRoom } from '../league/MatchDayTacticsRoom';
import { TransferMarketModal } from '../transfer/TransferMarketModal';
import { UclBracketTree } from './UclBracketTree';

type UclTab = 'match' | 'standings' | 'bracket' | 'stats' | 'squad';

export function UclDashboard() {
  const {
    state,
    activeTactic,
    chemistry,
    ratings,
    changeFormation,
    autoOptimizeLineup,
    setDefaultTactic,
    setNextMatchTactic,
    swapSquadPositions,
    startLiveMatch,
    simulateSingleMatchInstant,
    simulateUclPlayoffBye,
    simulateUclLeaguePhaseToEnd,
    simulateUclToEnd,
    finishUclToSummary,
  } = useGame();

  const [tab, setTab] = useState<UclTab>('match');
  const [showLpSummary, setShowLpSummary] = useState(false);
  const [skipResultModalOpen, setSkipResultModalOpen] = useState(false);
  const [swapPick, setSwapPick] = useState<SlotRef | null>(null);
  const [inspected, setInspected] = useState<{
    player: Player;
    slotSubPosition?: SubPosition;
    fallbackStats?: PlayerSeasonStats | null;
  } | null>(null);
  const [inspectedMatch, setInspectedMatch] = useState<MatchResult | null>(null);
  const [inspectedTie, setInspectedTie] = useState<UclKnockoutTie | null>(null);
  const [inspectedClub, setInspectedClub] = useState<Club | null>(null);

  const season = state.season;
  const ucl = season?.ucl ?? null;

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
      {season.liveHalftime && <LiveMatchBroadcast clubsById={clubsById} />}

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
          onClose={() => setInspected(null)}
        />
      )}

      {/* Starry UCL Header */}
      <div className="rounded-3xl border border-sky-500/35 bg-gradient-to-r from-[#081329] via-[#0d1c3d] to-[#0a1324] p-5 shadow-xl shadow-sky-950/30">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-400/40 bg-sky-500/20 text-sky-300 shadow-inner">
              <Trophy className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-sky-500/20 px-2 py-0.5 text-[10px] font-black tracking-wider text-sky-300">
                  UEFA CHAMPIONS LEAGUE · 36 TEAMS
                </span>
                <span className="rounded-md bg-slate-800/80 px-2 py-0.5 text-[10px] font-bold text-slate-300">
                  {UCL_STAGE_LABELS[ucl.stage]}
                  {ucl.stage === 'league_phase'
                    ? ` (${ucl.leaguePhaseRound} / 8R)`
                    : ucl.stage !== 'special_transfer' &&
                        ucl.stage !== 'completed' &&
                        ucl.stage !== 'final'
                      ? ` · ${ucl.knockoutLeg}차전`
                      : ''}
                </span>
              </div>
              <h1 className="mt-1 text-xl sm:text-2xl font-black text-white">
                {state.userClub.name} 유럽 챔피언스리그 원정
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="rounded-xl border border-slate-700/80 bg-slate-950/60 px-3.5 py-2 text-center">
              <div className="text-[10px] text-slate-400">리그 페이즈</div>
              <div className="font-mono text-sm font-black text-sky-300">
                {ucl.leaguePhaseRound > 0
                  ? `${ucl.userLeaguePhaseRank ?? userUclRank}위 / 36`
                  : '개막 대기'}
              </div>
            </div>
            <div className="rounded-xl border border-slate-700/80 bg-slate-950/60 px-3.5 py-2 text-center">
              <div className="text-[10px] text-slate-400">현재 성적</div>
              <div className="text-sm font-black text-amber-300">
                {getUserUclResultLabel(ucl, USER_CLUB_ID)}
              </div>
            </div>
            <div className="rounded-xl border border-slate-700/80 bg-slate-950/60 px-3.5 py-2 text-center">
              <div className="text-[10px] text-slate-400">팀 전력</div>
              <div className="font-mono text-sm font-black text-emerald-300">
                OVR {ratings.ovr} · 케미 {chemistry.total}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mt-4 flex flex-wrap gap-1.5 border-t border-sky-500/20 pt-3">
          {(
            [
              ['match', '⚽ 경기 & 진행'],
              ['standings', '📊 36팀 순위표'],
              ['bracket', '🏆 토너먼트 대진표'],
              ['stats', '⭐ UCL 개인 기록'],
              ['squad', '📋 내 스쿼드 / 전술'],
            ] as [UclTab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-xl px-3.5 py-2 text-xs font-extrabold transition cursor-pointer ${
                tab === id
                  ? 'bg-sky-400 text-slate-950 shadow'
                  : 'bg-slate-900/70 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

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
              className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/85 p-3 sm:p-4"
            >
              <div
                className={`w-full max-w-xl max-h-[90dvh] overflow-y-auto rounded-2xl border-2 bg-[#0f1724] shadow-2xl ${outcome.ringCls}`}
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between gap-2 border-b border-slate-800 bg-[#0a101a] px-4 py-3">
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

                <div className="p-4 sm:p-5 space-y-4">
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
                      확인 · 계속하기
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

      {/* TAB 1: MATCH & PROGRESSION */}
      {tab === 'match' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="lg:col-span-8 space-y-4">
            {showLpSummary && ucl.leaguePhaseRound >= 8 && (() => {
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
                      onClick={() => setTab('standings')}
                      className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-200 hover:text-white cursor-pointer"
                    >
                      36팀 순위표
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
                        onClick={startLiveMatch}
                        className="flex-1 min-w-[200px] inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-extrabold text-slate-950 shadow-lg hover:bg-emerald-400 cursor-pointer"
                      >
                        <Play className="h-4 w-4 fill-current" />
                        2D 실시간 중계 시작
                      </button>
                      <button
                        id="ucl-skip-single-match-btn"
                        type="button"
                        onClick={() => {
                          setSkipResultModalOpen(true);
                          simulateSingleMatchInstant();
                        }}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-xs font-bold text-slate-200 hover:border-sky-400 hover:text-white cursor-pointer"
                      >
                        <FastForward className="h-4 w-4" />
                        1경기 스킵
                      </button>
                      {ucl.stage === 'league_phase' && ucl.leaguePhaseRound < 8 && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowLpSummary(true);
                            simulateUclLeaguePhaseToEnd();
                          }}
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-sky-500/45 bg-sky-500/15 px-4 py-3 text-xs font-bold text-sky-200 hover:bg-sky-500/25 cursor-pointer"
                        >
                          <FastForward className="h-4 w-4" />
                          리그 페이즈 끝까지 고속진행
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={simulateUclToEnd}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-xs font-bold text-slate-300 hover:border-amber-400/60 hover:text-amber-300 cursor-pointer"
                      >
                        대회 끝까지 고속 진행
                      </button>
                    </div>
                  </MatchDayTacticsRoom>
                );
              })()
            ) : (
              /* User Eliminated or Bye (Top 8 skipping Playoff!) */
              <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-6 text-center space-y-4">
                {userEliminated ? (
                  <>
                    <div className="text-xs font-bold text-rose-400">
                      CHAMPIONS LEAGUE JOURNEY ENDED
                    </div>
                    <h3 className="text-xl font-black text-white">
                      우리 팀이 {getUserUclResultLabel(ucl, USER_CLUB_ID)}에서 여정을 마쳤습니다.
                    </h3>
                    <p className="text-xs text-slate-400">
                      남은 토너먼트를 시뮬레이션하여 이번 시즌 유럽 챔피언을 확인하고 최종 결산으로 이동하세요.
                    </p>
                    <div className="flex flex-wrap justify-center gap-2.5">
                      <button
                        type="button"
                        onClick={simulateUclToEnd}
                        className="rounded-xl bg-sky-400 px-5 py-2.5 text-sm font-black text-slate-950 hover:bg-sky-300 cursor-pointer"
                      >
                        남은 챔스 토너먼트 완료하기 →
                      </button>
                      <button
                        type="button"
                        onClick={finishUclToSummary}
                        className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-200 hover:text-white cursor-pointer"
                      >
                        남은 토너먼트 자동 완료 후 최종 결산 →
                      </button>
                    </div>
                  </>
                ) : (
                  /* User finished 1~8th in Swiss League -> Direct R16 Bye during Playoff! */
                  <>
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-black text-emerald-300">
                      <Sparkles className="h-3.5 w-3.5" />
                      리그 페이즈 {ucl.userLeaguePhaseRank}위 · 16강 직행 (부전승)
                    </div>
                    <h3 className="text-xl font-black text-white">
                      9~24위 16강 플레이오프 진행 중 ({ucl.knockoutLeg}차전)
                    </h3>
                    <p className="text-xs text-slate-400">
                      우리 팀은 상위 8위 직행 자격으로 플레이오프를 면제받았습니다. 플레이오프 승자가 결정되면 16강 대진이 완성됩니다.
                    </p>
                    <div className="flex flex-wrap justify-center gap-2.5">
                      <button
                        type="button"
                        onClick={simulateUclPlayoffBye}
                        className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-black text-slate-950 hover:bg-emerald-400 cursor-pointer"
                      >
                        플레이오프 일괄 완료 → 16강 대진 확정
                      </button>
                      <button
                        type="button"
                        onClick={simulateSingleMatchInstant}
                        className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-200 hover:text-white cursor-pointer"
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
          </div>

          {/* Right Mini Standings / Qualification Zones */}
          <div className="lg:col-span-4 rounded-2xl border border-slate-800 bg-slate-900/75 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-white">
                36팀 스위스 리그 요약 (상위권 & 우리 팀)
              </h3>
              <button
                type="button"
                onClick={() => setTab('standings')}
                className="text-[11px] font-bold text-sky-400 hover:underline cursor-pointer"
              >
                전체 36팀 보기 →
              </button>
            </div>
            <div className="space-y-1 text-xs">
              {ucl.standings.slice(0, 10).map((row, idx) => (
                <button
                  key={row.teamId}
                  type="button"
                  onClick={() => {
                    const c = clubsById[row.teamId];
                    if (c) setInspectedClub(c);
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left transition-colors cursor-pointer ${
                    row.isUser
                      ? 'bg-emerald-500/20 font-bold text-emerald-200 hover:bg-emerald-500/30'
                      : 'bg-slate-950/50 text-slate-300 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-4 text-center font-mono text-[11px] font-black ${
                        idx < 8 ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <span className="truncate">{row.teamName}</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="text-slate-400">
                      {row.goalDifference >= 0
                        ? `+${row.goalDifference}`
                        : row.goalDifference}
                    </span>
                    <span className="font-black text-white">{row.points}</span>
                  </div>
                </button>
              ))}
              {userUclRank > 10 && (() => {
                const uRow = ucl.standings[userUclRank - 1];
                if (!uRow) return null;
                return (
                  <button
                    type="button"
                    onClick={() => {
                      const c = clubsById[uRow.teamId];
                      if (c) setInspectedClub(c);
                    }}
                    className="mt-2 flex w-full items-center justify-between rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1.5 text-left font-bold text-emerald-200 hover:bg-emerald-500/25 cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 text-center font-mono text-[11px]">
                        {userUclRank}
                      </span>
                      <span>{uRow.teamName}</span>
                    </div>
                    <span className="font-mono font-black">{uRow.points}점</span>
                  </button>
                );
              })()}
            </div>
            <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-2.5 text-[10px]">
              <span className="text-emerald-400">● 1~8위 16강 직행</span>
              <span className="text-amber-400">● 9~24위 플레이오프</span>
              <span className="text-rose-400">● 25~36위 탈락</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FULL 36-TEAM SWISS TABLE */}
      {tab === 'standings' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-black text-white">
              UCL 36팀 통합 스위스 리그 순위표 ({ucl.leaguePhaseRound} / 8R)
            </h2>
            <div className="flex flex-wrap gap-3 text-[11px]">
              <span className="text-emerald-400 font-bold">1~8위: 16강 직행</span>
              <span className="text-amber-400 font-bold">9~24위: 16강 PO</span>
              <span className="text-rose-400 font-bold">25~36위: 탈락</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 text-[11px] text-slate-400">
                <tr>
                  <th className="py-2 px-2">#</th>
                  <th className="py-2 px-2">구단 (클릭 시 스쿼드)</th>
                  <th className="py-2 px-2">포트 / 출전</th>
                  <th className="py-2 px-1.5 text-center">경기</th>
                  <th className="py-2 px-1.5 text-center">승</th>
                  <th className="py-2 px-1.5 text-center">무</th>
                  <th className="py-2 px-1.5 text-center">패</th>
                  <th className="py-2 px-1.5 text-center">득실</th>
                  <th className="py-2 px-2 text-center font-black">승점</th>
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
                      <td className="py-2 px-2 font-mono font-bold">{rank}</td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: row.primaryColor }}
                          />
                          <span className="hover:text-sky-300">{row.teamName}</span>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-[11px] text-slate-400">
                        Pot {entry?.pot ?? '-'} · {entry?.originLabel ?? ''}
                      </td>
                      <td className="py-2 px-1.5 text-center font-mono">
                        {row.played}
                      </td>
                      <td className="py-2 px-1.5 text-center font-mono">
                        {row.won}
                      </td>
                      <td className="py-2 px-1.5 text-center font-mono">
                        {row.drawn}
                      </td>
                      <td className="py-2 px-1.5 text-center font-mono">
                        {row.lost}
                      </td>
                      <td className="py-2 px-1.5 text-center font-mono">
                        {row.goalDifference >= 0
                          ? `+${row.goalDifference}`
                          : row.goalDifference}
                      </td>
                      <td className="py-2 px-2 text-center font-mono text-sm font-black text-white">
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
      {tab === 'squad' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Left: Compact Formation Pitch (5 cols, max-w-[460px]) */}
          <div className="lg:col-span-5">
            <div className="mx-auto max-w-[460px]">
              <PitchBoard
                formation={state.formation}
                starters={state.starters}
                bench={state.bench}
                chemistry={chemistry}
                managerTraitId={state.manager.traitId}
                selectedSlot={swapPick}
                onSlotClick={handleSquadSlotClick}
                onSlotSwap={swapSquadPositions}
                onInspectPlayer={(player, slotSubPosition) =>
                  setInspected({ player, slotSubPosition })
                }
                showBench
                showChemBreakdown
                compact
              />
            </div>
          </div>

          {/* Right: Formation & Tactic Controls + Manager Trait + 16-Player UCL Squad Summary (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-black text-white">
                  <Users className="h-4 w-4 text-sky-400" />
                  포메이션 &amp; 기본 전술
                </span>
                <button
                  type="button"
                  onClick={autoOptimizeLineup}
                  className="rounded-lg bg-emerald-500/20 px-2.5 py-1 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/30 cursor-pointer"
                >
                  자동 최적 배치
                </button>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                {FORMATION_LIST.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => changeFormation(f.id)}
                    className={`rounded-lg py-1.5 text-xs font-bold cursor-pointer ${
                      state.formation === f.id
                        ? 'bg-sky-400 text-slate-950'
                        : 'border border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    {f.id}
                  </button>
                ))}
              </div>
              <div className="pt-2 border-t border-slate-800 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                  <Shield className="h-3.5 w-3.5 text-amber-400" />
                  기본 전술
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {TACTIC_LIST.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setDefaultTactic(t.id as TacticId)}
                      className={`rounded-lg py-1.5 text-[11px] font-bold cursor-pointer ${
                        season.defaultTactic === t.id
                          ? 'bg-emerald-500 text-slate-950'
                          : 'border border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      {t.shortName}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <ManagerTraitBadgeCard traitId={state.manager.traitId} compact />

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
                                const cond = season.playerConditions?.[p.id];
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
                            <div className="text-[10px] text-slate-500">
                              {formatMainPositions(p)} · OVR {p.ovr}
                              {slotSyn && slotSyn.totalBonus > 0 && (
                                <span className="ml-1 font-bold text-emerald-300">
                                  (+{slotSyn.totalBonus})
                                </span>
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
      )}
    </div>
  );
}
