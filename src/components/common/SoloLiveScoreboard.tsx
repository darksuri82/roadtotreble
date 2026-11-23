import { Pause, Play, Radio, Square } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Club, MatchResult } from '../../types/league';
import type { MpCastMatch, MpFeedItem } from '../../types/mpLeague';
import {
  endMinuteOfCastMatch,
  LiveTickerMatchCard,
} from '../multiplayer/league/MpLiveTicker';

export const SOLO_LIVE_SPEED_OPTIONS = [5000, 7000, 9000] as const;
export type SoloLiveDurationMs = (typeof SOLO_LIVE_SPEED_OPTIONS)[number];

/** Converts a solo MatchResult into the shared live scoreboard match structure (deduping ET events). */
export function matchResultToCastMatch(
  result: MatchResult,
  label: string,
  userClubId: string,
): MpCastMatch {
  const hasEtInEvents = result.events.some((e) => e.minute > 90);
  const allEvents = hasEtInEvents
    ? result.events
    : [...result.events, ...(result.extraTime?.etEvents ?? [])];

  const feed: MpFeedItem[] = allEvents
    .filter(
      (e) =>
        e.type === 'goal' ||
        e.type === 'save' ||
        e.type === 'chance' ||
        e.type === 'var_offside',
    )
    .map((e) => ({
      minute: e.minute,
      teamId: e.teamId,
      kind:
        e.type === 'goal'
          ? ('goal' as const)
          : e.type === 'save'
            ? ('save' as const)
            : e.type === 'chance'
              ? ('chance' as const)
              : ('var' as const),
      text: e.description,
    }))
    .sort((a, b) => a.minute - b.minute);

  const goals = allEvents
    .filter((e) => e.type === 'goal')
    .map((e) => ({
      minute: e.minute,
      teamId: e.teamId,
      scorer: e.scorerName ?? '',
    }))
    .sort((a, b) => a.minute - b.minute);

  return {
    key: result.fixtureId,
    label,
    homeTeamId: result.homeTeamId,
    awayTeamId: result.awayTeamId,
    goals,
    homeGoals: result.homeGoals,
    awayGoals: result.awayGoals,
    extraTime: Boolean(result.extraTime),
    penalties: result.extraTime?.penalties
      ? {
          home: result.extraTime.penalties.homePenGoals,
          away: result.extraTime.penalties.awayPenGoals,
          winnerId: result.extraTime.penalties.winnerTeamId,
        }
      : null,
    winnerId: result.extraTime?.winnerTeamId ?? null,
    humanClubIds: [userClubId],
    feed,
    stats: {
      homePossession: result.homePossession,
      homeShots: result.homeShots,
      awayShots: result.awayShots,
      homeXg: result.homeXg,
      awayXg: result.awayXg,
    },
  };
}

interface SoloLiveScoreboardProps {
  match: MpCastMatch | null;
  clubsById: Record<string, Club>;
  myClubId: string;
  durationMs: SoloLiveDurationMs;
  onChangeDurationMs: (ms: SoloLiveDurationMs) => void;
  paused: boolean;
  pauseReasonLabel?: string | null;
  onTogglePause: () => void;
  onStop: () => void;
  onMatchDone: (matchKey: string) => void;
}

export function SoloLiveScoreboard(props: SoloLiveScoreboardProps) {
  const {
    match,
    clubsById,
    myClubId,
    durationMs,
    onChangeDurationMs,
    paused,
    pauseReasonLabel,
    onTogglePause,
    onStop,
    onMatchDone,
  } = props;

  return (
    <div className="rounded-xl sm:rounded-2xl border border-emerald-500/35 bg-[#0c131d] p-2.5 sm:p-3.5 space-y-2.5 shadow-lg">
      {/* Compact control bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-extrabold ${
              paused || pauseReasonLabel
                ? 'border-amber-400/45 bg-amber-500/15 text-amber-200'
                : 'border-emerald-500/45 bg-emerald-500/15 text-emerald-200'
            }`}
          >
            <Radio
              className={`w-3 h-3 ${paused || pauseReasonLabel ? '' : 'animate-pulse'}`}
            />
            {pauseReasonLabel ?? (paused ? '일시정지' : '라이브 자동진행')}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {/* 5초 / 7초 / 9초 3-stage speed selector */}
          <div className="inline-flex items-center rounded-lg border border-slate-800 bg-[#0a0f17] p-0.5 text-[10px]">
            {SOLO_LIVE_SPEED_OPTIONS.map((ms) => {
              const active = durationMs === ms;
              return (
                <button
                  key={ms}
                  type="button"
                  onClick={() => onChangeDurationMs(ms)}
                  className={`rounded-md px-2 py-0.5 font-bold tabular-nums transition-colors cursor-pointer ${
                    active
                      ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/45'
                      : 'border border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {ms / 1000}초
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onTogglePause}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-[#111822] px-2.5 py-1 text-[11px] font-bold text-slate-200 hover:border-amber-400/50 hover:text-amber-200 cursor-pointer"
          >
            {paused ? (
              <>
                <Play className="w-3 h-3 fill-current" />
                재개
              </>
            ) : (
              <>
                <Pause className="w-3 h-3" />
                일시정지
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onStop}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-[#0b1018] px-2.5 py-1 text-[11px] font-bold text-slate-400 hover:border-rose-500/40 hover:text-rose-200 cursor-pointer"
          >
            <Square className="w-2.5 h-2.5 fill-current" />
            중단
          </button>
        </div>
      </div>

      {/* Smooth 60fps Live Scoreboard Match Card */}
      {match ? (
        <SoloScoreboardMatchRunner
          key={match.key}
          match={match}
          clubsById={clubsById}
          myClubId={myClubId}
          durationMs={durationMs}
          paused={paused}
          onDone={onMatchDone}
        />
      ) : (
        <div className="rounded-xl border border-slate-800/80 bg-[#0b1018] px-3 py-3 text-center text-xs font-bold text-slate-400">
          다음 라운드 준비 중...
        </div>
      )}
    </div>
  );
}

function SoloScoreboardMatchRunner({
  match,
  clubsById,
  myClubId,
  durationMs,
  paused,
  onDone,
}: {
  match: MpCastMatch;
  clubsById: Record<string, Club>;
  myClubId: string;
  durationMs: SoloLiveDurationMs;
  paused: boolean;
  onDone: (key: string) => void;
}) {
  const maxMin = useMemo(() => endMinuteOfCastMatch(match), [match]);
  const [minute, setMinute] = useState(0);
  const progressMinRef = useRef(0);
  const barElRef = useRef<HTMLDivElement | null>(null);
  const doneRef = useRef(false);
  const durationRef = useRef(durationMs);
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    durationRef.current = durationMs;
  }, [durationMs]);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (paused || doneRef.current) return;

    let rafId = 0;
    let doneTimer = 0;
    let lastTs = performance.now();
    let lastCommittedInt = Math.floor(progressMinRef.current);

    const step = (now: number) => {
      const dt = Math.min(100, Math.max(0, now - lastTs));
      lastTs = now;
      const nextFloat = Math.min(
        maxMin,
        progressMinRef.current + (dt / durationRef.current) * 90,
      );
      progressMinRef.current = nextFloat;

      if (barElRef.current) {
        barElRef.current.style.transform = `scaleX(${Math.min(1, nextFloat / maxMin)})`;
      }

      const nextInt = Math.floor(nextFloat);
      if (nextInt !== lastCommittedInt) {
        lastCommittedInt = nextInt;
        setMinute(nextInt);
      }

      if (nextFloat >= maxMin) {
        if (lastCommittedInt !== maxMin) {
          lastCommittedInt = maxMin;
          setMinute(maxMin);
        }
        if (!doneRef.current) {
          doneRef.current = true;
          doneTimer = window.setTimeout(() => onDoneRef.current(match.key), 420);
        }
        return;
      }

      rafId = window.requestAnimationFrame(step);
    };

    rafId = window.requestAnimationFrame(step);
    return () => {
      window.cancelAnimationFrame(rafId);
      if (doneTimer) window.clearTimeout(doneTimer);
    };
  }, [paused, maxMin, match.key]);

  return (
    <LiveTickerMatchCard
      match={match}
      minute={minute}
      finished={minute >= maxMin}
      clubsById={clubsById}
      myClubId={myClubId}
      alwaysShowFeed
      initialRatio={0}
      barRef={(el) => {
        barElRef.current = el;
      }}
    />
  );
}
