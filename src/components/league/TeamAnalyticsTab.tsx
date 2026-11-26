import { ArrowUpDown, Crown, Diamond, Flame, Shield, Target, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { formatMainPositions } from '../../engine/positionEngine';
import type {
  SquadPlayerAnalyticsRow,
  TeamSeasonAnalytics,
} from '../../types/league';
import {
  getClassicEraMeta,
  SUPERSTAR_MIN_OVR,
} from '../../types/player';
import { PlayerNameButton } from '../common/PlayerNameButton';

interface TeamAnalyticsTabProps {
  teamAnalytics: TeamSeasonAnalytics;
  squadRows: SquadPlayerAnalyticsRow[];
  clubName: string;
  onSelectPlayer?: (playerId: string) => void;
}

type SquadSortKey =
  | 'apps'
  | 'mins'
  | 'goals'
  | 'assists'
  | 'ga'
  | 'xg'
  | 'cs'
  | 'mom'
  | 'rating';

export function TeamAnalyticsTab({
  teamAnalytics: t,
  squadRows,
  clubName,
  onSelectPlayer,
}: TeamAnalyticsTabProps) {
  const [sortKey, setSortKey] = useState<SquadSortKey>('rating');

  const sortedSquad = [...squadRows].sort((a, b) => {
    switch (sortKey) {
      case 'apps':
        return b.appearances - a.appearances || b.minutesPlayed - a.minutesPlayed;
      case 'mins':
        return b.minutesPlayed - a.minutesPlayed || b.appearances - a.appearances;
      case 'goals':
        return b.goals - a.goals || b.xg - a.xg;
      case 'assists':
        return b.assists - a.assists || b.goals - a.goals;
      case 'ga':
        return b.goalContributions - a.goalContributions || b.avgRating - a.avgRating;
      case 'xg':
        return b.xg - a.xg;
      case 'cs':
        return b.cleanSheets - a.cleanSheets || b.avgRating - a.avgRating;
      case 'mom':
        return b.momCount - a.momCount || b.avgRating - a.avgRating;
      case 'rating':
      default:
        return b.avgRating - a.avgRating || b.goalContributions - a.goalContributions;
    }
  });

  return (
    <div className="space-y-5">
      {/* Top KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 tabular-nums">
        <div className="rounded-xl border border-slate-800 bg-[#111822] p-4">
          {t.competitionScope === 'combined' ? (
            <>
              <div className="text-[11px] text-slate-400">
                전체 대회 전적 · 승률
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-display text-2xl font-bold text-amber-300">
                  {(
                    t.winRatePct ??
                    (t.played > 0 ? Math.round((t.won / t.played) * 1000) / 10 : 0)
                  ).toFixed(1)}
                  %
                </span>
                {typeof t.leaguePoints === 'number' && (
                  <span className="text-xs font-bold text-emerald-300">
                    리그 승점 {t.leaguePoints}점
                  </span>
                )}
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                총 {t.won}승 {t.drawn}무 {t.lost}패 ({t.played}경기)
              </div>
            </>
          ) : t.competitionScope === 'cup' || t.competitionScope === 'ucl' ? (
            <>
              <div className="text-[11px] text-slate-400">
                대회 최종 성적 · 승률
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-display text-2xl font-bold text-amber-300">
                  {t.rankLabel ?? '-'}
                </span>
                <span className="font-display text-sm font-bold text-emerald-300">
                  승률{' '}
                  {(
                    t.winRatePct ??
                    (t.played > 0 ? Math.round((t.won / t.played) * 1000) / 10 : 0)
                  ).toFixed(1)}
                  %
                </span>
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                {t.won}승 {t.drawn}무 {t.lost}패 ({t.played}경기)
              </div>
            </>
          ) : (
            <>
              <div className="text-[11px] text-slate-400">
                정규 리그 순위 · 리그 승점
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-display text-2xl font-bold text-amber-300">
                  {t.rankLabel ?? (t.finalRank > 0 ? `${t.finalRank}위` : '-')}
                </span>
                <span className="font-display text-lg font-bold text-white">
                  {t.points}점
                </span>
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                {t.won}승 {t.drawn}무 {t.lost}패 ({t.played}경기 · 승률{' '}
                {(
                  t.winRatePct ??
                  (t.played > 0 ? Math.round((t.won / t.played) * 1000) / 10 : 0)
                ).toFixed(1)}
                %)
              </div>
            </>
          )}
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#111822] p-4">
          <div className="text-[11px] text-slate-400">득점 · 실점 · 득실</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold text-white">
              {t.goalsFor} : {t.goalsAgainst}
            </span>
            <span
              className={`font-display text-sm font-bold ${
                t.goalDifference >= 0 ? 'text-emerald-300' : 'text-rose-300'
              }`}
            >
              ({t.goalDifference >= 0 ? `+${t.goalDifference}` : t.goalDifference})
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            클린시트 <strong className="text-sky-300">{t.cleanSheets}회</strong>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#111822] p-4">
          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            <Target className="w-3.5 h-3.5 text-emerald-400" />
            누적 xG vs 실제 득점
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold text-emerald-300">
              {t.totalXg.toFixed(1)}
            </span>
            <span className="text-xs text-slate-400">→ {t.goalsFor}골</span>
          </div>
          <div className="mt-1 text-[11px]">
            결정력{' '}
            <strong
              className={
                t.finishingDiff >= 0 ? 'text-emerald-300' : 'text-rose-300'
              }
            >
              {t.finishingDiff >= 0 ? `+${t.finishingDiff.toFixed(2)}` : t.finishingDiff.toFixed(2)}
            </strong>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#111822] p-4">
          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            <Shield className="w-3.5 h-3.5 text-sky-400" />
            누적 xGA vs 실제 실점
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold text-sky-300">
              {t.totalXga.toFixed(1)}
            </span>
            <span className="text-xs text-slate-400">→ {t.goalsAgainst}실점</span>
          </div>
          <div className="mt-1 text-[11px]">
            실점 억제{' '}
            <strong
              className={
                t.preventedDiff >= 0 ? 'text-emerald-300' : 'text-rose-300'
              }
            >
              {t.preventedDiff >= 0 ? `+${t.preventedDiff.toFixed(2)}` : t.preventedDiff.toFixed(2)}
            </strong>
          </div>
        </div>
      </div>

      {/* Home/Away Splits + Averages + Streaks & Biggest Win */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 tabular-nums">
        <div className="rounded-xl border border-slate-800 bg-[#111822] p-4 space-y-2.5">
          <div className="text-xs font-bold text-slate-300">홈 vs 원정 성적</div>
          <div className="flex items-center justify-between rounded-lg bg-[#0b1018] px-3 py-2 text-xs">
            <span className="font-semibold text-emerald-300">홈 ({t.homeRecord.played}경기)</span>
            <span className="font-bold text-white">
              {t.homeRecord.won}승 {t.homeRecord.drawn}무 {t.homeRecord.lost}패
            </span>
            <span className="text-slate-400">
              {t.homeRecord.gf}:{t.homeRecord.ga}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-[#0b1018] px-3 py-2 text-xs">
            <span className="font-semibold text-sky-300">원정 ({t.awayRecord.played}경기)</span>
            <span className="font-bold text-white">
              {t.awayRecord.won}승 {t.awayRecord.drawn}무 {t.awayRecord.lost}패
            </span>
            <span className="text-slate-400">
              {t.awayRecord.gf}:{t.awayRecord.ga}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#111822] p-4 space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            경기당 평균 지표
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-[#0b1018] p-2.5">
              <div className="text-[10px] text-slate-500">평균 점유율</div>
              <div className="font-display text-lg font-bold text-white">
                {t.avgPossession.toFixed(1)}%
              </div>
            </div>
            <div className="rounded-lg bg-[#0b1018] p-2.5">
              <div className="text-[10px] text-slate-500">경기당 슈팅</div>
              <div className="font-display text-lg font-bold text-white">
                {t.avgShots.toFixed(1)}
              </div>
            </div>
            <div className="rounded-lg bg-[#0b1018] p-2.5">
              <div className="text-[10px] text-slate-500">유효슈팅</div>
              <div className="font-display text-lg font-bold text-sky-300">
                {t.avgShotsOnTarget.toFixed(1)}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#111822] p-4 space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            연속 기록 &amp; 최다 점수차 승리
          </div>
          <div className="grid grid-cols-2 gap-2 text-center text-xs">
            <div className="rounded-lg bg-[#0b1018] p-2">
              <div className="text-[10px] text-slate-500">최다 연승</div>
              <div className="font-display text-lg font-bold text-emerald-300">
                {t.maxWinStreak}연승
              </div>
            </div>
            <div className="rounded-lg bg-[#0b1018] p-2">
              <div className="text-[10px] text-slate-500">최다 무패</div>
              <div className="font-display text-lg font-bold text-amber-300">
                {t.maxUnbeatenStreak}경기
              </div>
            </div>
          </div>
          <div className="rounded-lg bg-[#0b1018] px-3 py-1.5 text-[11px] text-slate-300 flex items-center justify-between">
            <span className="text-slate-500">최다 승차</span>
            {t.biggestWin ? (
              <span className="font-bold text-white">
                {t.biggestWin.round}R {t.biggestWin.isHome ? 'vs' : '@'}{' '}
                {t.biggestWin.opponentName} ({t.biggestWin.userGoals}-
                {t.biggestWin.oppGoals})
              </span>
            ) : (
              <span className="text-slate-500">승리 기록 없음</span>
            )}
          </div>
        </div>
      </div>

      {/* Sortable 16-Player Detailed Squad Analytics Table */}
      <div className="rounded-2xl border border-slate-800 bg-[#111822] p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-extrabold text-white">
              {clubName} 선수단 16명 시즌 세부 기록
            </h3>
            <p className="text-[11px] text-slate-400">
              헤더를 클릭해 출전, 골, 도움, 공격포인트(G+A), 누적 xG, 클린시트, MOM, 평균 평점순으로 정렬할 수 있습니다.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
            <ArrowUpDown className="w-3 h-3" />
            정렬: {sortKey.toUpperCase()}
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#0b1018]">
          <table className="w-full text-left text-xs tabular-nums">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] text-slate-400">
                <th className="py-2.5 px-3">선수</th>
                <th className="py-2.5 px-2 text-center">주 출전 포지션</th>
                <th className="py-2.5 px-2 text-center">
                  <button type="button" onClick={() => setSortKey('apps')} className="hover:text-white cursor-pointer">
                    출전(선발/교체)
                  </button>
                </th>
                <th className="py-2.5 px-2 text-center">
                  <button type="button" onClick={() => setSortKey('mins')} className="hover:text-white cursor-pointer">
                    출전시간
                  </button>
                </th>
                <th className="py-2.5 px-2 text-center">
                  <button type="button" onClick={() => setSortKey('goals')} className="hover:text-white cursor-pointer">
                    골
                  </button>
                </th>
                <th className="py-2.5 px-2 text-center">
                  <button type="button" onClick={() => setSortKey('assists')} className="hover:text-white cursor-pointer">
                    도움
                  </button>
                </th>
                <th className="py-2.5 px-2 text-center">
                  <button type="button" onClick={() => setSortKey('ga')} className="hover:text-white cursor-pointer">
                    G+A
                  </button>
                </th>
                <th className="py-2.5 px-2 text-center">
                  <button type="button" onClick={() => setSortKey('xg')} className="hover:text-white cursor-pointer">
                    누적 xG
                  </button>
                </th>
                <th className="py-2.5 px-2 text-center">
                  <button type="button" onClick={() => setSortKey('cs')} className="hover:text-white cursor-pointer">
                    CS
                  </button>
                </th>
                <th className="py-2.5 px-2 text-center">
                  <button type="button" onClick={() => setSortKey('mom')} className="hover:text-white cursor-pointer">
                    MOM
                  </button>
                </th>
                <th className="py-2.5 px-3 text-center text-white">
                  <button type="button" onClick={() => setSortKey('rating')} className="hover:text-emerald-300 cursor-pointer">
                    평균 평점
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {sortedSquad.map((row) => (
                <tr
                  key={row.playerId}
                  className="hover:bg-slate-800/30"
                >
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1.5">
                      {onSelectPlayer ? (
                        <PlayerNameButton
                          onClick={() => onSelectPlayer(row.playerId)}
                          className="font-bold text-slate-100"
                        >
                          {row.playerName}
                        </PlayerNameButton>
                      ) : (
                        <span className="font-bold text-slate-100">
                          {row.playerName}
                        </span>
                      )}
                      {row.isLegend && (() => {
                        const eraMeta = row.classicEra
                          ? getClassicEraMeta(row.classicEra)
                          : null;
                        return eraMeta ? (
                          <span
                            className={`rounded px-1 py-px text-[9px] font-black shrink-0 ${eraMeta.badgeClass}`}
                            title={eraMeta.fullLabel}
                          >
                            {eraMeta.shortLabel}
                          </span>
                        ) : (
                          <Crown className="w-3 h-3 text-amber-400 shrink-0" />
                        );
                      })()}
                      {!row.isLegend && row.ovr >= SUPERSTAR_MIN_OVR && (
                        <Diamond className="w-3 h-3 text-cyan-300 shrink-0" />
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      OVR {row.ovr} · STA {row.stamina} · {formatMainPositions({ mainPositions: row.mainPositions })}
                    </div>
                  </td>
                  <td className="py-2.5 px-2 text-center">
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-200">
                      {row.primaryDeployedPosition}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-center text-slate-300">
                    <strong className="text-white">{row.appearances}</strong>{' '}
                    <span className="text-[10px] text-slate-500">
                      ({row.starts}/{row.subAppearances})
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-center text-slate-300">
                    {row.minutesPlayed.toLocaleString()}분
                  </td>
                  <td className="py-2.5 px-2 text-center font-bold text-white">
                    {row.goals}
                  </td>
                  <td className="py-2.5 px-2 text-center font-semibold text-sky-300">
                    {row.assists}
                  </td>
                  <td className="py-2.5 px-2 text-center font-bold text-emerald-300">
                    {row.goalContributions}
                  </td>
                  <td className="py-2.5 px-2 text-center text-slate-300">
                    {row.xg.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-2 text-center text-slate-300">
                    {row.position === 'GK' || row.position === 'DF'
                      ? row.cleanSheets
                      : '-'}
                  </td>
                  <td className="py-2.5 px-2 text-center font-bold text-amber-300">
                    {row.momCount}
                  </td>
                  <td className="py-2.5 px-3 text-center font-display text-sm font-bold text-emerald-300">
                    {row.appearances > 0 ? row.avgRating.toFixed(2) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
