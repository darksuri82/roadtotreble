import {
  Award,
  FastForward,
  Play,
  Shield,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { FORMATION_LIST } from '../../data/formations';
import { USER_CLUB_ID } from '../../engine/matchEngine';
import { getUserRank } from '../../engine/standingsEngine';
import { TACTIC_LIST, TACTICS } from '../../engine/tacticEngine';
import {
  didUserWinUcl,
  findNextUserUclLeaguePhaseFixture,
  getUserKnockoutFixtureInfo,
  getUserUclResultLabel,
  UCL_KNOCKOUT_ORDER,
  UCL_STAGE_LABELS,
} from '../../engine/uclEngine';
import { useGame } from '../../store/GameContext';
import type { Club, TacticId } from '../../types/league';
import type { Player, SubPosition } from '../../types/player';
import type { UclKnockoutTie } from '../../types/ucl';
import { JerseySvg } from '../common/JerseySvg';
import { PitchBoard, type SlotRef } from '../common/PitchBoard';
import { PlayerDetailModal } from '../common/PlayerDetailModal';
import { LiveMatchBroadcast } from '../league/LiveMatchBroadcast';
import { TransferMarketModal } from '../transfer/TransferMarketModal';

type UclTab = 'match' | 'standings' | 'bracket' | 'stats' | 'squad';

function KnockoutTieCard({
  tie,
  clubsById,
}: {
  tie: UclKnockoutTie;
  clubsById: Record<string, Club>;
}) {
  const teamA = clubsById[tie.teamAId];
  const teamB = clubsById[tie.teamBId];
  const involvesUser =
    tie.teamAId === USER_CLUB_ID || tie.teamBId === USER_CLUB_ID;
  const isFinal = tie.stage === 'final';

  return (
    <div
      className={`rounded-xl border p-3 text-xs ${
        involvesUser
          ? 'border-sky-400/60 bg-sky-950/30 shadow-sm shadow-sky-900/20'
          : 'border-slate-800 bg-slate-900/75'
      }`}
    >
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/20"
              style={{ backgroundColor: teamA?.primaryColor ?? '#64748b' }}
            />
            <span
              className={`truncate ${
                tie.teamAId === USER_CLUB_ID
                  ? 'font-black text-emerald-300'
                  : tie.winnerId === tie.teamAId
                    ? 'font-bold text-white'
                    : tie.winnerId
                      ? 'text-slate-400'
                      : 'text-slate-200'
              }`}
            >
              {teamA?.name ?? tie.teamAId}
            </span>
          </div>
          <span className="font-mono font-black text-white">
            {tie.leg1 ? tie.aggTeamA : '-'}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/20"
              style={{ backgroundColor: teamB?.primaryColor ?? '#64748b' }}
            />
            <span
              className={`truncate ${
                tie.teamBId === USER_CLUB_ID
                  ? 'font-black text-emerald-300'
                  : tie.winnerId === tie.teamBId
                    ? 'font-bold text-white'
                    : tie.winnerId
                      ? 'text-slate-400'
                      : 'text-slate-200'
              }`}
            >
              {teamB?.name ?? tie.teamBId}
            </span>
          </div>
          <span className="font-mono font-black text-white">
            {tie.leg1 ? tie.aggTeamB : '-'}
          </span>
        </div>
      </div>

      {tie.leg1 && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-1 border-t border-slate-800/80 pt-1.5 text-[10px] text-slate-400">
          {isFinal ? (
            <span>단판 결승</span>
          ) : (
            <span>
              1차전 {tie.leg1.homeGoals}-{tie.leg1.awayGoals}
              {tie.leg2 ? ` · 2차전 ${tie.leg2.homeGoals}-${tie.leg2.awayGoals}` : ' · 2차전 대기'}
            </span>
          )}
          {tie.decidedBy === 'penalties' &&
            tie.penaltyScoreA !== undefined &&
            tie.penaltyScoreB !== undefined && (
              <span className="font-bold text-purple-300">
                PK {tie.penaltyScoreA}-{tie.penaltyScoreB}
              </span>
            )}
          {tie.decidedBy === 'et' && (
            <span className="font-bold text-amber-300">AET</span>
          )}
        </div>
      )}
    </div>
  );
}

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
    simulateUclToEnd,
    finishUclToSummary,
  } = useGame();

  const [tab, setTab] = useState<UclTab>('match');
  const [swapPick, setSwapPick] = useState<SlotRef | null>(null);
  const [inspected, setInspected] = useState<{
    player: Player;
    slotSubPosition?: SubPosition;
  } | null>(null);

  const season = state.season;
  const ucl = season?.ucl ?? null;

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

  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-6 py-5 space-y-5">
      {/* UCL Special Transfer Window Modal */}
      {season.transferMarket.isOpen && <TransferMarketModal />}

      {/* Live Match Broadcast Modal (reuses full 2D pitch + Slow-Mo + Stamina + ET/PK!) */}
      {season.liveHalftime && <LiveMatchBroadcast clubsById={clubsById} />}

      {/* Player Inspector */}
      {inspected && (
        <PlayerDetailModal
          player={inspected.player}
          slotSubPosition={inspected.slotSubPosition}
          managerTraitId={state.manager.traitId}
          seasonStats={season.uclPlayerStats[`user::${inspected.player.id}`]}
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

      {/* TAB 1: MATCH & PROGRESSION */}
      {tab === 'match' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="lg:col-span-8 space-y-4">
            {ucl.completed ? (
              <div className="rounded-3xl border border-amber-400/50 bg-gradient-to-br from-amber-950/35 via-slate-900 to-slate-950 p-6 text-center space-y-4">
                <Trophy className="mx-auto h-14 w-14 text-amber-400" />
                <div>
                  <div className="text-xs font-black tracking-widest text-amber-300">
                    UEFA CHAMPIONS LEAGUE FINAL RESULT
                  </div>
                  <h2 className="mt-1 text-2xl sm:text-3xl font-black text-white">
                    {userWonUcl
                      ? `🎉 ${state.userClub.name}, 빅이어(Big Ears) 정복!`
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
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-300 px-6 py-3 text-sm font-black text-slate-950 shadow-lg hover:brightness-105 cursor-pointer"
                >
                  <Sparkles className="h-4 w-4" />
                  시즌 최종 결산 · 시즌 스코어 & 명예의 전당 확인 →
                </button>
              </div>
            ) : isUserNextMatch && nextHome && nextAway ? (
              <div className="rounded-2xl border border-sky-500/35 bg-slate-900/80 p-5 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="rounded-md bg-sky-500/20 px-2.5 py-1 text-xs font-black text-sky-300">
                      {nextKnockoutInfo
                        ? nextKnockoutInfo.competitionLabel
                        : `UCL 스위스 리그 페이즈 ${ucl.leaguePhaseRound + 1} / 8R`}
                    </span>
                    {nextKnockoutInfo?.aggHomeBeforeMatch !== undefined && (
                      <span className="ml-2 rounded-md bg-amber-500/20 px-2 py-1 text-xs font-bold text-amber-300">
                        1차전 종료 합산 {nextHome.shortName}{' '}
                        {nextKnockoutInfo.aggHomeBeforeMatch} :{' '}
                        {nextKnockoutInfo.aggAwayBeforeMatch} {nextAway.shortName}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-400">
                    {nextHome.id === USER_CLUB_ID ? '홈 경기' : '원정 경기'}
                  </span>
                </div>

                {/* Matchup Display */}
                <div className="grid grid-cols-3 items-center gap-3 rounded-2xl border border-slate-800 bg-[#0b1018] p-5 text-center">
                  <div className="flex flex-col items-center">
                    <JerseySvg
                      primaryColor={nextHome.primaryColor}
                      secondaryColor={nextHome.secondaryColor}
                      pattern={nextHome.pattern}
                      label={nextHome.shortName}
                      size={52}
                    />
                    <div
                      className={`mt-2 text-sm font-black ${
                        nextHome.isUser ? 'text-emerald-300' : 'text-white'
                      }`}
                    >
                      {nextHome.name}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Pot {teamEntryById[nextHome.id]?.pot ?? '-'} ·{' '}
                      {teamEntryById[nextHome.id]?.originLabel ?? ''}
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-slate-300">
                      ATT {nextHome.att} · MID {nextHome.mid} · DEF {nextHome.def}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="font-display text-2xl font-black text-sky-400">
                      VS
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {nextKnockoutInfo?.isDecider
                        ? '동점 시 연장전 · 승부차기'
                        : '90분 정규 경기'}
                    </div>
                  </div>

                  <div className="flex flex-col items-center">
                    <JerseySvg
                      primaryColor={nextAway.primaryColor}
                      secondaryColor={nextAway.secondaryColor}
                      pattern={nextAway.pattern}
                      label={nextAway.shortName}
                      size={52}
                    />
                    <div
                      className={`mt-2 text-sm font-black ${
                        nextAway.isUser ? 'text-emerald-300' : 'text-white'
                      }`}
                    >
                      {nextAway.name}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Pot {teamEntryById[nextAway.id]?.pot ?? '-'} ·{' '}
                      {teamEntryById[nextAway.id]?.originLabel ?? ''}
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-slate-300">
                      ATT {nextAway.att} · MID {nextAway.mid} · DEF {nextAway.def}
                    </div>
                  </div>
                </div>

                {/* Quick Match Tactic Picker */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-300">
                      이번 경기 전술 선택 (상대 기본 전술:{' '}
                      <strong className="text-sky-300">
                        {
                          TACTICS[
                            nextHome.id === USER_CLUB_ID
                              ? nextAway.defaultTactic
                              : nextHome.defaultTactic
                          ].name
                        }
                      </strong>
                      )
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {TACTIC_LIST.map((t) => {
                      const active = activeTactic === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setNextMatchTactic(t.id)}
                          className={`rounded-xl py-2 text-xs font-bold transition cursor-pointer ${
                            active
                              ? 'bg-sky-400 text-slate-950'
                              : 'border border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          {t.shortName}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={startLiveMatch}
                    className="flex-1 min-w-[200px] inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-400 to-emerald-400 px-5 py-3 text-sm font-black text-slate-950 shadow-lg hover:brightness-105 cursor-pointer"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    2D 실시간 중계 시작
                  </button>
                  <button
                    type="button"
                    onClick={simulateSingleMatchInstant}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-xs font-bold text-slate-200 hover:border-sky-400 hover:text-white cursor-pointer"
                  >
                    <FastForward className="h-4 w-4" />
                    1경기 스킵
                  </button>
                  <button
                    type="button"
                    onClick={simulateUclToEnd}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-xs font-bold text-slate-300 hover:border-amber-400/60 hover:text-amber-300 cursor-pointer"
                  >
                    대회 끝까지 고속 진행
                  </button>
                </div>
              </div>
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
                        바로 최종 결산으로
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
                    <button
                      type="button"
                      onClick={simulateSingleMatchInstant}
                      className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-black text-slate-950 hover:bg-emerald-400 cursor-pointer"
                    >
                      플레이오프 {ucl.knockoutLeg}차전 진행 →
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Latest UCL Match Result */}
            {ucl.lastUserMatch && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-bold text-sky-300">
                    직전 UCL 경기 · {ucl.lastUserMatch.competitionLabel}
                  </span>
                  <span>
                    MOM: {ucl.lastUserMatch.momPlayerName} (
                    {ucl.lastUserMatch.momRating.toFixed(1)})
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
              </div>
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
                <div
                  key={row.teamId}
                  className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 ${
                    row.isUser
                      ? 'bg-emerald-500/20 font-bold text-emerald-200'
                      : 'bg-slate-950/50 text-slate-300'
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
                </div>
              ))}
              {userUclRank > 10 && (() => {
                const uRow = ucl.standings[userUclRank - 1];
                if (!uRow) return null;
                return (
                  <div className="mt-2 flex items-center justify-between rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1.5 font-bold text-emerald-200">
                    <div className="flex items-center gap-2">
                      <span className="w-5 text-center font-mono text-[11px]">
                        {userUclRank}
                      </span>
                      <span>{uRow.teamName}</span>
                    </div>
                    <span className="font-mono font-black">{uRow.points}점</span>
                  </div>
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
                  <th className="py-2 px-2">구단</th>
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
                      className={`${zoneBorder} ${
                        row.isUser
                          ? 'bg-emerald-500/15 font-bold text-white'
                          : 'hover:bg-slate-800/40 text-slate-200'
                      }`}
                    >
                      <td className="py-2 px-2 font-mono font-bold">{rank}</td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: row.primaryColor }}
                          />
                          <span>{row.teamName}</span>
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

      {/* TAB 3: KNOCKOUT BRACKET */}
      {tab === 'bracket' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          {UCL_KNOCKOUT_ORDER.map((stage) => {
            const ties = ucl.ties[stage];
            return (
              <div key={stage} className="space-y-2.5">
                <div className="border-b border-slate-800 pb-1.5 text-xs font-black text-sky-300">
                  {UCL_STAGE_LABELS[stage]}
                </div>
                {ties.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/40 p-4 text-center text-xs text-slate-500">
                    이전 라운드 종료 후 확정
                  </div>
                ) : (
                  <div className="space-y-2">
                    {ties.map((tie) => (
                      <KnockoutTieCard
                        key={tie.id}
                        tie={tie}
                        clubsById={clubsById}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
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
              <h3 className="flex items-center gap-1.5 text-xs font-black text-white">
                <Award className="h-4 w-4 text-amber-400" />
                {col.title}
              </h3>
              {col.list.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-500">
                  경기 진행 후 기록이 집계됩니다.
                </p>
              ) : (
                <div className="space-y-1.5 text-xs">
                  {col.list.map((st, idx) => (
                    <div
                      key={`${col.title}-${st.teamId}-${st.playerId}`}
                      className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 ${
                        st.isUserTeam
                          ? 'bg-emerald-500/15 font-bold text-emerald-200'
                          : 'bg-slate-950/60 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-4 font-mono text-[11px] text-slate-400">
                          {idx + 1}
                        </span>
                        <span className="truncate">{st.playerName}</span>
                        <span className="text-[10px] text-slate-500">
                          {st.teamShortName}
                        </span>
                      </div>
                      <span className="font-mono font-black text-amber-300">
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

      {/* TAB 5: SQUAD & TACTICS */}
      {tab === 'squad' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="lg:col-span-8">
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
            />
          </div>
          <div className="lg:col-span-4 space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-black text-white">
                  <Users className="h-4 w-4 text-sky-400" />
                  포메이션 & 기본 전술
                </span>
                <button
                  type="button"
                  onClick={autoOptimizeLineup}
                  className="rounded-lg bg-emerald-500/20 px-2.5 py-1 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/30 cursor-pointer"
                >
                  자동 최적 배치
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {FORMATION_LIST.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => changeFormation(f.id)}
                    className={`rounded-lg py-1.5 text-xs font-bold cursor-pointer ${
                      state.formation === f.id
                        ? 'bg-sky-400 text-slate-950'
                        : 'border border-slate-800 bg-slate-950 text-slate-300'
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
                          : 'border border-slate-800 bg-slate-950 text-slate-300'
                      }`}
                    >
                      {t.shortName}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
