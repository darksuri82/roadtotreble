import { Activity, Award, Clock, Star } from 'lucide-react';
import { useState } from 'react';
import { USER_CLUB_ID } from '../../engine/matchEngine';
import { TACTICS } from '../../engine/tacticEngine';
import type { Club, MatchResult } from '../../types/league';
import { ClubTag } from '../common/ClubTag';
import { JerseySvg } from '../common/JerseySvg';
import { PlayerNameButton } from '../common/PlayerNameButton';

interface MatchReportPanelProps {
  match: MatchResult;
  clubsById: Record<string, Club>;
  onSelectPlayer?: (playerId: string) => void;
  onOpenDetail?: (match: MatchResult) => void;
}

export function MatchReportPanel({
  match,
  clubsById,
  onSelectPlayer,
  onOpenDetail,
}: MatchReportPanelProps) {
  const [subTab, setSubTab] = useState<'timeline' | 'ratings'>('timeline');
  const home = clubsById[match.homeTeamId];
  const away = clubsById[match.awayTeamId];
  if (!home || !away) return null;

  const isUserHome = home.id === USER_CLUB_ID;
  const userGoals = isUserHome ? match.homeGoals : match.awayGoals;
  const oppGoals = isUserHome ? match.awayGoals : match.homeGoals;
  const outcome =
    userGoals > oppGoals ? 'WIN' : userGoals < oppGoals ? 'LOSS' : 'DRAW';

  const homeGoalEvents = match.events.filter(
    (e) => e.type === 'goal' && e.teamId === home.id,
  );
  const awayGoalEvents = match.events.filter(
    (e) => e.type === 'goal' && e.teamId === away.id,
  );

  const userClub = clubsById[USER_CLUB_ID];
  const oppClub = isUserHome ? away : home;

  const userRatings = match.playerRatings
    .filter((r) => r.teamId === USER_CLUB_ID)
    .sort((a, b) => b.rating - a.rating);
  const oppRatings = match.playerRatings
    .filter((r) => r.teamId !== USER_CLUB_ID)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 6);

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#111822] p-4 space-y-3.5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold text-slate-300">
            직전 경기 · ROUND {match.round}
          </span>
          {match.halftimeAdjusted && (
            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
              HT 수정
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {onOpenDetail && (
            <button
              type="button"
              onClick={() => onOpenDetail(match)}
              className="rounded-md border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-sky-300 hover:border-sky-400/50 hover:text-sky-200 cursor-pointer"
            >
              상세 보기
            </button>
          )}
          <span
            className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
              outcome === 'WIN'
                ? 'bg-emerald-500/15 text-emerald-300'
                : outcome === 'DRAW'
                  ? 'bg-slate-800 text-slate-300'
                  : 'bg-rose-500/15 text-rose-300'
            }`}
          >
            {outcome === 'WIN' ? '승리' : outcome === 'DRAW' ? '무승부' : '패배'}
          </span>
        </div>
      </div>

      {/* Scoreboard */}
      <div className="grid grid-cols-3 items-center gap-2 rounded-xl border border-slate-800 bg-[#0b1018] px-3 py-3">
        <div className="flex flex-col items-center text-center">
          <JerseySvg
            primaryColor={home.primaryColor}
            secondaryColor={home.secondaryColor}
            pattern={home.pattern}
            label={home.shortName}
            size={36}
          />
          <span
            className={`mt-1 text-xs font-bold leading-tight ${
              home.isUser ? 'text-emerald-300' : 'text-slate-200'
            }`}
          >
            {home.name}
          </span>
          <span className="text-[10px] text-slate-500">
            {match.homeFormation} · {TACTICS[match.homeTactic].shortName}
          </span>
        </div>

        <div className="flex flex-col items-center justify-center">
          <div className="font-display text-3xl sm:text-4xl font-bold tracking-wider text-white tabular-nums">
            {match.homeGoals} <span className="text-slate-600">:</span>{' '}
            {match.awayGoals}
          </div>
          <div className="mt-1 inline-flex items-center gap-1 rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">
            <Star className="w-2.5 h-2.5 fill-current shrink-0" />
            {onSelectPlayer ? (
              <PlayerNameButton
                onClick={() => onSelectPlayer(match.momPlayerId)}
                className="font-bold text-amber-200"
              >
                {match.momPlayerName}
              </PlayerNameButton>
            ) : (
              <span>{match.momPlayerName}</span>
            )}
            <span>({match.momRating.toFixed(1)})</span>
          </div>
        </div>

        <div className="flex flex-col items-center text-center">
          <JerseySvg
            primaryColor={away.primaryColor}
            secondaryColor={away.secondaryColor}
            pattern={away.pattern}
            label={away.shortName}
            size={36}
          />
          <span
            className={`mt-1 text-xs font-bold leading-tight ${
              away.isUser ? 'text-emerald-300' : 'text-slate-200'
            }`}
          >
            {away.name}
          </span>
          <span className="text-[10px] text-slate-500">
            {match.awayFormation} · {TACTICS[match.awayTactic].shortName}
          </span>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-4 gap-1.5 text-center text-[11px] tabular-nums">
        <div className="rounded-lg bg-[#0b1018] p-2">
          <div className="text-[10px] text-slate-500">점유율</div>
          <div className="font-display text-sm font-bold text-white">
            {match.homePossession}% : {100 - match.homePossession}%
          </div>
        </div>
        <div className="rounded-lg bg-[#0b1018] p-2">
          <div className="text-[10px] text-slate-500">xG</div>
          <div className="font-display text-sm font-bold text-emerald-300">
            {match.homeXg.toFixed(2)} : {match.awayXg.toFixed(2)}
          </div>
        </div>
        <div className="rounded-lg bg-[#0b1018] p-2">
          <div className="text-[10px] text-slate-500">슈팅</div>
          <div className="font-display text-sm font-bold text-white">
            {match.homeShots} : {match.awayShots}
          </div>
        </div>
        <div className="rounded-lg bg-[#0b1018] p-2">
          <div className="text-[10px] text-slate-500">유효슈팅</div>
          <div className="font-display text-sm font-bold text-sky-300">
            {match.homeShotsOnTarget} : {match.awayShotsOnTarget}
          </div>
        </div>
      </div>

      {/* Scorers Summary */}
      {(homeGoalEvents.length > 0 || awayGoalEvents.length > 0) && (
        <div className="grid grid-cols-2 gap-3 rounded-xl bg-[#0b1018] p-2.5 text-[11px]">
          <div className="space-y-1">
            {homeGoalEvents.map((ev, i) => (
              <div key={i} className="text-slate-200 flex items-center gap-1 flex-wrap">
                <span className="font-display text-emerald-400">
                  {ev.minute}&apos;
                </span>
                {ev.scorerId && onSelectPlayer ? (
                  <PlayerNameButton
                    onClick={() => onSelectPlayer(ev.scorerId!)}
                    className="font-semibold text-slate-100"
                  >
                    {ev.scorerName}
                  </PlayerNameButton>
                ) : (
                  <span className="font-semibold">{ev.scorerName}</span>
                )}
                {ev.assistName && (
                  <span className="text-slate-500 inline-flex items-center gap-0.5">
                    (
                    {ev.assistId && onSelectPlayer ? (
                      <PlayerNameButton
                        onClick={() => onSelectPlayer(ev.assistId!)}
                        className="text-slate-400"
                      >
                        {ev.assistName}
                      </PlayerNameButton>
                    ) : (
                      ev.assistName
                    )}
                    )
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="space-y-1 text-right">
            {awayGoalEvents.map((ev, i) => (
              <div key={i} className="text-slate-200 flex items-center justify-end gap-1 flex-wrap">
                {ev.scorerId && onSelectPlayer ? (
                  <PlayerNameButton
                    onClick={() => onSelectPlayer(ev.scorerId!)}
                    className="font-semibold text-slate-100"
                  >
                    {ev.scorerName}
                  </PlayerNameButton>
                ) : (
                  <span className="font-semibold">{ev.scorerName}</span>
                )}
                {ev.assistName && (
                  <span className="text-slate-500 inline-flex items-center gap-0.5">
                    (
                    {ev.assistId && onSelectPlayer ? (
                      <PlayerNameButton
                        onClick={() => onSelectPlayer(ev.assistId!)}
                        className="text-slate-400"
                      >
                        {ev.assistName}
                      </PlayerNameButton>
                    ) : (
                      ev.assistName
                    )}
                    )
                  </span>
                )}
                <span className="font-display text-amber-400">
                  {ev.minute}&apos;
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sub-tabs */}
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-[#0b1018] p-1 text-xs">
        <button
          type="button"
          onClick={() => setSubTab('timeline')}
          className={`inline-flex items-center justify-center gap-1 rounded py-1.5 font-bold cursor-pointer ${
            subTab === 'timeline'
              ? 'bg-emerald-500 text-slate-950'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          경기 로그
        </button>
        <button
          type="button"
          onClick={() => setSubTab('ratings')}
          className={`inline-flex items-center justify-center gap-1 rounded py-1.5 font-bold cursor-pointer ${
            subTab === 'ratings'
              ? 'bg-emerald-500 text-slate-950'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          선수 평점
        </button>
      </div>

      {subTab === 'timeline' ? (
        <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl bg-[#0b1018] p-2.5 text-xs">
          {match.events.map((ev, idx) => {
            const evClub = clubsById[ev.teamId];
            return (
              <div
                key={idx}
                className={`flex items-start gap-2 rounded-md px-2 py-1 ${
                  ev.type === 'goal'
                    ? ev.teamId === USER_CLUB_ID
                      ? 'bg-emerald-500/15 text-emerald-200 font-semibold'
                      : 'bg-rose-500/12 text-rose-200 font-semibold'
                    : ev.type === 'var_offside'
                      ? 'bg-purple-500/15 text-purple-200 font-semibold'
                      : ev.type === 'sub'
                        ? 'bg-amber-500/12 text-amber-200 font-semibold'
                        : 'text-slate-400'
                }`}
              >
                <span className="w-7 shrink-0 font-display text-xs font-bold text-slate-500 tabular-nums">
                  {ev.minute}&apos;
                </span>
                <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                  {evClub && ev.type !== 'halftime' && ev.type !== 'fulltime' && ev.type !== 'kickoff' && (
                    <ClubTag
                      shortName={evClub.shortName}
                      primaryColor={evClub.primaryColor}
                      isUserTeam={evClub.id === USER_CLUB_ID}
                    />
                  )}
                  <span className="leading-snug">{ev.description}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2.5">
          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold text-emerald-300">
              {userClub && (
                <ClubTag
                  shortName={userClub.shortName}
                  primaryColor={userClub.primaryColor}
                  isUserTeam
                />
              )}
              우리 팀 평점
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              {userRatings.map((r) => (
                <div
                  key={`${r.teamId}-${r.playerId}`}
                  className={`flex w-full items-center justify-between gap-1 rounded-lg px-2 py-1.5 border text-left ${
                    r.playerId === match.momPlayerId && r.teamId === USER_CLUB_ID
                      ? 'border-amber-400/50 bg-amber-500/10'
                      : 'border-slate-800/80 bg-[#0b1018]'
                  }`}
                >
                  <div className="flex items-center gap-1 min-w-0">
                    {onSelectPlayer ? (
                      <PlayerNameButton
                        onClick={() => onSelectPlayer(r.playerId)}
                        className="font-semibold text-slate-200"
                      >
                        {r.playerName}
                      </PlayerNameButton>
                    ) : (
                      <span className="truncate font-semibold text-slate-200">
                        {r.playerName}
                      </span>
                    )}
                    {r.goals > 0 && (
                      <span className="shrink-0 text-[10px]">⚽{r.goals}</span>
                    )}
                    {r.assists > 0 && (
                      <span className="shrink-0 text-[10px]">🅰️{r.assists}</span>
                    )}
                  </div>
                  <span
                    className={`font-display text-xs font-bold shrink-0 ml-1 tabular-nums ${
                      r.rating >= 8.0
                        ? 'text-amber-300'
                        : r.rating >= 7.0
                          ? 'text-emerald-300'
                          : 'text-slate-300'
                    }`}
                  >
                    {r.rating.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
              <ClubTag
                shortName={oppClub.shortName}
                primaryColor={oppClub.primaryColor}
              />
              상대 팀 TOP 6
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              {oppRatings.map((r) => (
                <div
                  key={`${r.teamId}-${r.playerId}`}
                  className="flex w-full items-center justify-between gap-1 rounded-lg border border-slate-800/70 bg-[#0b1018] px-2 py-1.5 text-left"
                >
                  <div className="flex items-center gap-1 min-w-0">
                    {onSelectPlayer ? (
                      <PlayerNameButton
                        onClick={() => onSelectPlayer(r.playerId)}
                        className="text-slate-300"
                      >
                        {r.playerName}
                      </PlayerNameButton>
                    ) : (
                      <span className="truncate text-slate-300">
                        {r.playerName}
                      </span>
                    )}
                    {r.goals > 0 && (
                      <span className="shrink-0 text-[10px]">⚽{r.goals}</span>
                    )}
                  </div>
                  <span className="font-display text-xs font-bold text-slate-200 tabular-nums shrink-0">
                    {r.rating.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
