import { Activity, Award, Clock, Shield, Star, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { USER_CLUB_ID } from '../../engine/matchEngine';
import { TACTICS } from '../../engine/tacticEngine';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import type { Club, MatchResult } from '../../types/league';
import type { UclKnockoutTie } from '../../types/ucl';
import { ClubTag } from './ClubTag';
import { JerseySvg } from './JerseySvg';
import { PlayerNameButton } from './PlayerNameButton';

export interface MatchDetailModalProps {
  match?: MatchResult | null;
  tie?: UclKnockoutTie | null;
  clubsById: Record<string, Club>;
  onSelectPlayer?: (playerId: string) => void;
  onClose: () => void;
}

function MetricBar({
  label,
  homeVal,
  awayVal,
  homeText,
  awayText,
}: {
  label: string;
  homeVal: number;
  awayVal: number;
  homeText: string;
  awayText: string;
}) {
  const total = Math.max(0.01, homeVal + awayVal);
  const homePct = Math.round((homeVal / total) * 100);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px] tabular-nums">
        <span className="font-bold text-emerald-300">{homeText}</span>
        <span className="text-slate-400 font-semibold">{label}</span>
        <span className="font-bold text-sky-300">{awayText}</span>
      </div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-slate-800">
        <div
          className="bg-emerald-400 transition-all"
          style={{ width: `${homePct}%` }}
        />
        <div
          className="bg-sky-400 transition-all"
          style={{ width: `${100 - homePct}%` }}
        />
      </div>
    </div>
  );
}

export function MatchDetailModal({
  match = null,
  tie = null,
  clubsById,
  onSelectPlayer,
  onClose,
}: MatchDetailModalProps) {
  const hasTwoLegs = Boolean(tie && tie.stage !== 'final' && tie.leg1 && tie.leg2);
  const [selectedLeg, setSelectedLeg] = useState<1 | 2>(
    tie?.leg2 ? 2 : 1,
  );
  const [subTab, setSubTab] = useState<'overview' | 'ratings'>('overview');

  const activeMatch: MatchResult | null = tie
    ? selectedLeg === 2 && tie.leg2
      ? tie.leg2
      : tie.leg1 ?? tie.leg2 ?? null
    : match;

  useBodyScrollLock(Boolean(activeMatch));

  useEffect(() => {
    if (!activeMatch) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [activeMatch, onClose]);

  if (!activeMatch) return null;

  const home = clubsById[activeMatch.homeTeamId];
  const away = clubsById[activeMatch.awayTeamId];
  const homeName = home?.name ?? activeMatch.homeTeamId;
  const awayName = away?.name ?? activeMatch.awayTeamId;
  const homeShort = home?.shortName ?? 'HOM';
  const awayShort = away?.shortName ?? 'AWY';

  const allEvents = [
    ...activeMatch.events,
    ...(activeMatch.extraTime?.etEvents ?? []),
  ];
  const homeGoalsList = allEvents.filter(
    (e) => e.type === 'goal' && e.teamId === activeMatch.homeTeamId,
  );
  const awayGoalsList = allEvents.filter(
    (e) => e.type === 'goal' && e.teamId === activeMatch.awayTeamId,
  );

  const homeRatings = activeMatch.playerRatings
    .filter((r) => r.teamId === activeMatch.homeTeamId)
    .sort((a, b) => b.rating - a.rating);
  const awayRatings = activeMatch.playerRatings
    .filter((r) => r.teamId === activeMatch.awayTeamId)
    .sort((a, b) => b.rating - a.rating);

  const tieTeamA = tie ? clubsById[tie.teamAId] : null;
  const tieTeamB = tie ? clubsById[tie.teamBId] : null;

  return (
    <div
      className="modal-backdrop fixed inset-0 z-[58] flex items-center justify-center bg-slate-950/82 p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="modal-panel flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-[#0e1520] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 bg-[#0a1019] px-5 py-3.5">
          <div className="flex items-center gap-2 min-w-0">
            <Activity className="h-4 w-4 text-emerald-400 shrink-0" />
            <span className="truncate text-sm font-extrabold text-white">
              {activeMatch.competitionLabel ?? `리그 ${activeMatch.round}라운드`} · 경기 상세 리포트
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded-lg border border-slate-700 bg-slate-900 p-1.5 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Optional 2-Leg Aggregate & Leg Switcher for UCL Ties */}
        {tie && tie.stage !== 'final' && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-[#101928] px-5 py-2.5 text-xs">
            <div className="flex items-center gap-2">
              <span className="rounded bg-sky-500/20 px-2 py-0.5 text-[10px] font-bold text-sky-300">
                1·2차전 합산
              </span>
              <span className="font-bold text-white">
                {tieTeamA?.shortName ?? 'A'} {tie.aggTeamA} - {tie.aggTeamB}{' '}
                {tieTeamB?.shortName ?? 'B'}
              </span>
              {tie.decidedBy === 'penalties' &&
                tie.penaltyScoreA !== undefined &&
                tie.penaltyScoreB !== undefined && (
                  <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[10px] font-bold text-purple-200">
                    PK {tie.penaltyScoreA}-{tie.penaltyScoreB}
                  </span>
                )}
            </div>
            {hasTwoLegs && (
              <div className="flex gap-1 rounded-lg bg-slate-950 p-0.5">
                {([1, 2] as const).map((leg) => (
                  <button
                    key={leg}
                    type="button"
                    onClick={() => setSelectedLeg(leg)}
                    className={`rounded-md border px-2.5 py-1 text-[11px] font-bold cursor-pointer transition-colors ${
                      selectedLeg === leg
                        ? 'bg-slate-800 text-white border-sky-400/50'
                        : 'border-transparent text-slate-400 hover:text-white'
                    }`}
                  >
                    {leg}차전
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Body */}
        <div className="modal-scroll flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Scoreboard */}
          <div className="grid grid-cols-3 items-center gap-2 rounded-2xl border border-slate-800 bg-[#090e16] px-4 py-4">
            <div className="flex flex-col items-center text-center">
              <JerseySvg
                primaryColor={home?.primaryColor ?? '#64748b'}
                secondaryColor={home?.secondaryColor ?? '#ffffff'}
                pattern={home?.pattern}
                label={homeShort}
                size={46}
              />
              <span
                className={`mt-1.5 text-xs sm:text-sm font-extrabold leading-tight ${
                  activeMatch.homeTeamId === USER_CLUB_ID
                    ? 'text-emerald-300'
                    : 'text-white'
                }`}
              >
                {homeName}
              </span>
              <span className="text-[10px] text-slate-500">
                {activeMatch.homeFormation} ·{' '}
                {TACTICS[activeMatch.homeTactic]?.shortName ?? activeMatch.homeTactic}
              </span>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="font-display text-4xl font-black tracking-wider text-white tabular-nums">
                {activeMatch.homeGoals}{' '}
                <span className="text-slate-600">:</span> {activeMatch.awayGoals}
              </div>
              {activeMatch.halftimeHomeGoals !== undefined &&
                activeMatch.halftimeAwayGoals !== undefined && (
                  <div className="text-[10px] text-slate-400 tabular-nums">
                    전반 ({activeMatch.halftimeHomeGoals} :{' '}
                    {activeMatch.halftimeAwayGoals})
                  </div>
                )}
              {activeMatch.extraTime && (
                <div className="mt-1 rounded bg-purple-500/20 px-2 py-0.5 text-[10px] font-bold text-purple-200">
                  {activeMatch.extraTime.penalties
                    ? `승부차기 PK ${activeMatch.extraTime.penalties.homePenGoals} - ${activeMatch.extraTime.penalties.awayPenGoals}`
                    : '연장전 종료 (AET)'}
                </div>
              )}
              <div className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                <Star className="h-3 w-3 fill-current shrink-0" />
                <span>MOM</span>
                {onSelectPlayer ? (
                  <PlayerNameButton
                    onClick={() => onSelectPlayer(activeMatch.momPlayerId)}
                    className="font-bold text-amber-200"
                  >
                    {activeMatch.momPlayerName}
                  </PlayerNameButton>
                ) : (
                  <span>{activeMatch.momPlayerName}</span>
                )}
                <span>({activeMatch.momRating.toFixed(1)})</span>
              </div>
            </div>

            <div className="flex flex-col items-center text-center">
              <JerseySvg
                primaryColor={away?.primaryColor ?? '#64748b'}
                secondaryColor={away?.secondaryColor ?? '#ffffff'}
                pattern={away?.pattern}
                label={awayShort}
                size={46}
              />
              <span
                className={`mt-1.5 text-xs sm:text-sm font-extrabold leading-tight ${
                  activeMatch.awayTeamId === USER_CLUB_ID
                    ? 'text-emerald-300'
                    : 'text-white'
                }`}
              >
                {awayName}
              </span>
              <span className="text-[10px] text-slate-500">
                {activeMatch.awayFormation} ·{' '}
                {TACTICS[activeMatch.awayTactic]?.shortName ?? activeMatch.awayTactic}
              </span>
            </div>
          </div>

          {/* Scorers + Assists */}
          {(homeGoalsList.length > 0 || awayGoalsList.length > 0) && (
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-800 bg-[#090e16] p-3 text-xs">
              <div className="space-y-1">
                {homeGoalsList.map((ev, idx) => (
                  <div key={idx} className="flex flex-wrap items-center gap-1 text-slate-200">
                    <span className="font-mono text-[11px] font-bold text-emerald-400">
                      {ev.minute}&apos;
                    </span>
                    <span>⚽</span>
                    {ev.scorerId && onSelectPlayer ? (
                      <PlayerNameButton
                        onClick={() => onSelectPlayer(ev.scorerId!)}
                        className="font-bold text-slate-100"
                      >
                        {ev.scorerName}
                      </PlayerNameButton>
                    ) : (
                      <span className="font-bold">{ev.scorerName}</span>
                    )}
                    {ev.assistName && (
                      <span className="text-[11px] text-slate-400 inline-flex items-center gap-0.5">
                        (도움:{' '}
                        {ev.assistId && onSelectPlayer ? (
                          <PlayerNameButton
                            onClick={() => onSelectPlayer(ev.assistId!)}
                            className="text-slate-300"
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
                {awayGoalsList.map((ev, idx) => (
                  <div
                    key={idx}
                    className="flex flex-wrap items-center justify-end gap-1 text-slate-200"
                  >
                    {ev.assistName && (
                      <span className="text-[11px] text-slate-400 inline-flex items-center gap-0.5">
                        (도움:{' '}
                        {ev.assistId && onSelectPlayer ? (
                          <PlayerNameButton
                            onClick={() => onSelectPlayer(ev.assistId!)}
                            className="text-slate-300"
                          >
                            {ev.assistName}
                          </PlayerNameButton>
                        ) : (
                          ev.assistName
                        )}
                        )
                      </span>
                    )}
                    {ev.scorerId && onSelectPlayer ? (
                      <PlayerNameButton
                        onClick={() => onSelectPlayer(ev.scorerId!)}
                        className="font-bold text-slate-100"
                      >
                        {ev.scorerName}
                      </PlayerNameButton>
                    ) : (
                      <span className="font-bold">{ev.scorerName}</span>
                    )}
                    <span>⚽</span>
                    <span className="font-mono text-[11px] font-bold text-sky-400">
                      {ev.minute}&apos;
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comparison Metrics */}
          <div className="rounded-xl border border-slate-800 bg-[#090e16] p-3.5 space-y-2.5">
            <MetricBar
              label="점유율"
              homeVal={activeMatch.homePossession}
              awayVal={100 - activeMatch.homePossession}
              homeText={`${activeMatch.homePossession}%`}
              awayText={`${100 - activeMatch.homePossession}%`}
            />
            <MetricBar
              label="기대 득점 (xG)"
              homeVal={activeMatch.homeXg}
              awayVal={activeMatch.awayXg}
              homeText={activeMatch.homeXg.toFixed(2)}
              awayText={activeMatch.awayXg.toFixed(2)}
            />
            <MetricBar
              label="슈팅 (유효슈팅)"
              homeVal={activeMatch.homeShots}
              awayVal={activeMatch.awayShots}
              homeText={`${activeMatch.homeShots} (${activeMatch.homeShotsOnTarget})`}
              awayText={`${activeMatch.awayShots} (${activeMatch.awayShotsOnTarget})`}
            />
          </div>

          {/* Penalty Shootout Kick Log */}
          {activeMatch.extraTime?.penalties && (
            <div className="rounded-xl border border-purple-500/35 bg-purple-950/20 p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-purple-200">
                <span className="inline-flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-purple-300" />
                  승부차기 결과 ({homeShort}{' '}
                  {activeMatch.extraTime.penalties.homePenGoals} -{' '}
                  {activeMatch.extraTime.penalties.awayPenGoals} {awayShort})
                </span>
                <span className="text-[11px] text-amber-300">
                  승자:{' '}
                  {clubsById[activeMatch.extraTime.penalties.winnerTeamId]?.name ??
                    activeMatch.extraTime.penalties.winnerTeamId}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                {activeMatch.extraTime.penalties.kicks.map((k, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between rounded-lg px-2.5 py-1 ${
                      k.scored
                        ? 'bg-emerald-500/10 text-emerald-200'
                        : 'bg-rose-500/10 text-rose-300'
                    }`}
                  >
                    <span className="truncate">
                      {k.round}R [{k.teamShortName}] {k.kickerName}
                    </span>
                    <span className="font-bold shrink-0">
                      {k.scored ? '⚽ 성공' : '✕ 실축'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sub-tabs: Timeline vs Player Ratings */}
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-slate-800 bg-[#090e16] p-1 text-xs">
            <button
              type="button"
              onClick={() => setSubTab('overview')}
              className={`inline-flex items-center justify-center gap-1.5 rounded-lg border py-2 font-bold cursor-pointer transition-colors ${
                subTab === 'overview'
                  ? 'bg-slate-800 text-white border-emerald-500/50'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              주요 경기 이벤트 ({allEvents.length})
            </button>
            <button
              type="button"
              onClick={() => setSubTab('ratings')}
              className={`inline-flex items-center justify-center gap-1.5 rounded-lg border py-2 font-bold cursor-pointer transition-colors ${
                subTab === 'ratings'
                  ? 'bg-slate-800 text-white border-emerald-500/50'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Award className="h-3.5 w-3.5" />
              양 팀 선수 평점
            </button>
          </div>

          {subTab === 'overview' ? (
            <div className="max-h-56 overflow-y-auto space-y-1 rounded-xl border border-slate-800 bg-[#090e16] p-3 text-xs">
              {allEvents.map((ev, idx) => {
                const evClub = clubsById[ev.teamId];
                return (
                  <div
                    key={idx}
                    className={`flex items-start gap-2 rounded-md px-2 py-1 ${
                      ev.type === 'goal'
                        ? 'bg-emerald-500/15 font-semibold text-emerald-100'
                        : ev.type === 'var_offside'
                          ? 'bg-purple-500/15 text-purple-200'
                          : ev.type === 'sub'
                            ? 'bg-amber-500/10 text-amber-200'
                            : 'text-slate-400'
                    }`}
                  >
                    <span className="w-8 shrink-0 font-mono text-[11px] font-bold text-slate-500">
                      {ev.minute}&apos;
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                      {evClub &&
                        ev.type !== 'kickoff' &&
                        ev.type !== 'halftime' &&
                        ev.type !== 'fulltime' && (
                          <ClubTag
                            shortName={evClub.shortName}
                            primaryColor={evClub.primaryColor}
                            isUserTeam={evClub.id === USER_CLUB_ID}
                          />
                        )}
                      <span>{ev.description}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                { title: homeName, club: home, list: homeRatings },
                { title: awayName, club: away, list: awayRatings },
              ].map((side) => (
                <div
                  key={side.title}
                  className="rounded-xl border border-slate-800 bg-[#090e16] p-3 space-y-1.5"
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white pb-1 border-b border-slate-800">
                    {side.club && (
                      <ClubTag
                        shortName={side.club.shortName}
                        primaryColor={side.club.primaryColor}
                        isUserTeam={side.club.id === USER_CLUB_ID}
                      />
                    )}
                    <span className="truncate">{side.title}</span>
                  </div>
                  <div className="space-y-1 text-xs">
                    {side.list.map((r) => {
                      const isMom = r.playerId === activeMatch.momPlayerId;
                      return (
                        <div
                          key={`${r.teamId}-${r.playerId}`}
                          className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1 text-left ${
                            isMom
                              ? 'border border-amber-400/45 bg-amber-500/12'
                              : 'hover:bg-slate-800/35'
                          }`}
                        >
                          <div className="flex items-center gap-1 min-w-0 text-slate-200">
                            <span className="mr-0.5 shrink-0 text-[10px] font-bold text-slate-500">
                              {r.subPosition}
                            </span>
                            {onSelectPlayer ? (
                              <PlayerNameButton
                                onClick={() => onSelectPlayer(r.playerId)}
                                className="font-semibold text-slate-100"
                              >
                                {r.playerName}
                              </PlayerNameButton>
                            ) : (
                              <span className="truncate font-semibold">{r.playerName}</span>
                            )}
                            {r.goals > 0 && (
                              <span className="shrink-0 text-[10px]">⚽{r.goals}</span>
                            )}
                            {r.assists > 0 && (
                              <span className="shrink-0 text-[10px]">🅰️{r.assists}</span>
                            )}
                          </div>
                          <span
                            className={`font-mono text-xs font-bold shrink-0 ml-2 ${
                              isMom
                                ? 'text-amber-300'
                                : r.rating >= 7.5
                                  ? 'text-emerald-300'
                                  : 'text-slate-300'
                            }`}
                          >
                            {r.rating.toFixed(1)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
