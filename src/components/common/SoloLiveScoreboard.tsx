import { Pause, Play, Radio, Square, Tv } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Club, MatchResult } from '../../types/league';
import type { MpCastMatch, MpFeedItem } from '../../types/mpLeague';
import {
  endMinuteOfCastMatch,
  LIVE_PK_KICK_INTERVAL_MS,
  LiveTickerMatchCard,
} from '../multiplayer/league/MpLiveTicker';

export const SOLO_LIVE_SPEED_OPTIONS = [5000, 7000, 9000] as const;
export type SoloLiveDurationMs = (typeof SOLO_LIVE_SPEED_OPTIONS)[number];

/** Converts a solo MatchResult into the shared live scoreboard match structure (deduping ET events + keeping PK kicks). */
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
          kicks: result.extraTime.penalties.kicks,
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
  /** Optional status notice (e.g. tactic changed → applies from next match). */
  noticeLabel?: string | null;
  onTogglePause: () => void;
  onStop: () => void;
  onMatchDone: (matchKey: string) => void;
  /** Called when user pauses mid-stream and chooses to jump straight into this match's 2D broadcast. */
  onEnterLiveMatch?: (minute: number, inPenalties: boolean) => void;
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
    noticeLabel,
    onTogglePause,
    onStop,
    onMatchDone,
    onEnterLiveMatch,
  } = props;

  const progressStateRef = useRef<{ minute: number; inPenalties: boolean; finished: boolean }>({
    minute: 0,
    inPenalties: false,
    finished: false,
  });

  // Reset tracked progress whenever a new match starts
  const lastMatchKeyRef = useRef<string | null>(null);
  if ((match?.key ?? null) !== lastMatchKeyRef.current) {
    lastMatchKeyRef.current = match?.key ?? null;
    progressStateRef.current = { minute: 0, inPenalties: false, finished: false };
  }

  const canEnterLive2D = Boolean(
    match &&
      paused &&
      !pauseReasonLabel &&
      onEnterLiveMatch &&
      !progressStateRef.current.finished,
  );

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

          {canEnterLive2D && onEnterLiveMatch && (
            <button
              id="solo-live-enter-2d-btn"
              type="button"
              onClick={() =>
                onEnterLiveMatch(
                  progressStateRef.current.minute,
                  progressStateRef.current.inPenalties,
                )
              }
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1 text-[11px] font-extrabold text-slate-950 hover:bg-emerald-400 cursor-pointer shadow-sm"
            >
              <Tv className="w-3 h-3" />
              2D 경기 중계 입장
            </button>
          )}
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

      {noticeLabel && (
        <div className="rounded-lg border border-sky-400/35 bg-sky-500/10 px-2.5 py-1 text-[11px] font-bold text-sky-200">
          {noticeLabel}
        </div>
      )}

      {/* Smooth 60fps Live Scoreboard Match Card (+ Extra PK Shootout Phase) */}
      {match ? (
        <SoloScoreboardMatchRunner
          key={match.key}
          match={match}
          clubsById={clubsById}
          myClubId={myClubId}
          durationMs={durationMs}
          paused={paused}
          onProgress={(minute, inPenalties, finished) => {
            progressStateRef.current = { minute, inPenalties, finished };
          }}
          onDone={onMatchDone}
        />
      ) : (
        <div className="rounded-xl border border-slate-800/80 bg-[#0b1018] px-3 py-3 text-center text-xs font-bold text-slate-400">
          {pauseReasonLabel ?? (paused ? '일시정지됨 · 재개를 누르면 이어서 진행됩니다' : '다음 라운드 준비 중...')}
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
  onProgress,
  onDone,
}: {
  match: MpCastMatch;
  clubsById: Record<string, Club>;
  myClubId: string;
  durationMs: SoloLiveDurationMs;
  paused: boolean;
  onProgress: (minute: number, inPenalties: boolean, finished: boolean) => void;
  onDone: (key: string) => void;
}) {
  const maxMin = useMemo(() => endMinuteOfCastMatch(match), [match]);
  const totalPkKicks = match.penalties?.kicks?.length ?? 0;
  const [minute, setMinute] = useState(0);
  const [revealedPenKicks, setRevealedPenKicks] = useState(0);
  const progressMinRef = useRef(0);
  const barElRef = useRef<HTMLDivElement | null>(null);
  const doneRef = useRef(false);
  const durationRef = useRef(durationMs);
  const onDoneRef = useRef(onDone);
  const onProgressRef = useRef(onProgress);

  useEffect(() => {
    durationRef.current = durationMs;
  }, [durationMs]);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    onProgressRef.current = onProgress;
  }, [onProgress]);

  // Keep parent informed of current minute & PK status for mid-stream 2D takeover
  useEffect(() => {
    const inPk = totalPkKicks > 0 && minute >= maxMin && revealedPenKicks < totalPkKicks;
    const isFinished = minute >= maxMin && revealedPenKicks >= totalPkKicks;
    onProgressRef.current(minute, inPk, isFinished);
  }, [minute, maxMin, totalPkKicks, revealedPenKicks]);

  // Phase 1: Match clock 0' → 90' (or 120' for ET)
  useEffect(() => {
    if (paused || doneRef.current || progressMinRef.current >= maxMin) return;

    let rafId = 0;
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
        return;
      }

      rafId = window.requestAnimationFrame(step);
    };

    rafId = window.requestAnimationFrame(step);
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [paused, maxMin]);

  // Phase 2: Extra Penalty Shootout (runs ON TOP of configured match duration, pauses cleanly!) & FT completion
  useEffect(() => {
    if (paused || doneRef.current || minute < maxMin) return;

    if (totalPkKicks === 0) {
      const t = window.setTimeout(() => {
        if (doneRef.current) return;
        doneRef.current = true;
        onDoneRef.current(match.key);
      }, 420);
      return () => window.clearTimeout(t);
    }

    if (revealedPenKicks >= totalPkKicks) {
      const t = window.setTimeout(() => {
        if (doneRef.current) return;
        doneRef.current = true;
        onDoneRef.current(match.key);
      }, 750);
      return () => window.clearTimeout(t);
    }

    const t = window.setTimeout(() => {
      setRevealedPenKicks((prev) => Math.min(totalPkKicks, prev + 1));
    }, LIVE_PK_KICK_INTERVAL_MS);
    return () => window.clearTimeout(t);
  }, [paused, totalPkKicks, minute, maxMin, revealedPenKicks, match.key]);

  const finished = minute >= maxMin && revealedPenKicks >= totalPkKicks;

  return (
    <LiveTickerMatchCard
      match={match}
      minute={minute}
      finished={finished}
      revealedPenKicks={revealedPenKicks}
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
