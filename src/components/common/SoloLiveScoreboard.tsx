import {
  Check,
  FastForward,
  Loader2,
  Pause,
  Play,
  Radio,
  SlidersHorizontal,
  Square,
  Tv,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { TACTICS } from '../../engine/tacticEngine';
import type { Club, MatchResult } from '../../types/league';
import type { MpCastMatch, MpFeedItem } from '../../types/mpLeague';
import {
  endMinuteOfCastMatch,
  LIVE_PK_KICK_INTERVAL_MS,
  LiveTickerMatchCard,
} from '../multiplayer/league/MpLiveTicker';
import { JerseySvg } from './JerseySvg';

export const SOLO_LIVE_SPEED_OPTIONS = [5000, 7000, 9000] as const;
export type SoloLiveDurationMs = (typeof SOLO_LIVE_SPEED_OPTIONS)[number];
/** Between-match preparation interval (3s) so players can react & adjust tactics before important matches. */
export const SOLO_LIVE_INTERMISSION_MS = 3000;

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

  const feed: MpFeedItem[] = [
    ...allEvents
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
      })),
    ...(result.aiPreMatchCounter
      ? [
          {
            minute:
              result.aiPreMatchCounter.timing === 'first_half' &&
              result.aiPreMatchCounter.minute > 0
                ? result.aiPreMatchCounter.minute
                : 1,
            teamId:
              result.homeTeamId === userClubId
                ? result.awayTeamId
                : result.homeTeamId,
            kind: 'chance' as const,
            text: `⚡ ${result.aiPreMatchCounter.headline}`,
          },
        ]
      : []),
  ].sort((a, b) => a.minute - b.minute);

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

export interface SoloLiveIntermissionInfo {
  /** Remaining wait time in ms (0..totalMs) */
  remainingMs: number;
  /** Total wait time in ms (default SOLO_LIVE_INTERMISSION_MS = 3000) */
  totalMs: number;
  /** Label of the upcoming match (e.g. "ROUND 12" or "FA컵 8강") */
  nextRoundLabel: string;
  /** Upcoming opponent club (if available) */
  nextOpponent: Club | null;
  /** True when user is home */
  isHome?: boolean;
  /** True when upcoming match is a big/important match (rival, top-4 clash, or cup) */
  isImportantMatch?: boolean;
  /** Optional badge label for important match */
  importantBadge?: string | null;
  /** Optional callback to skip the remaining intermission countdown and start immediately */
  onStartNow?: () => void;
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
  /** True while user is explicitly editing tactics */
  tacticEditActive?: boolean;
  onStartTacticEdit?: () => void;
  onConfirmTacticEdit?: () => void;
  onTogglePause: () => void;
  onStop: () => void;
  onMatchDone: (matchKey: string) => void;
  /** Called when user pauses mid-stream and chooses to jump straight into this match's 2D broadcast. */
  onEnterLiveMatch?: (minute: number, inPenalties: boolean) => void;
  /** Between-match 3-second preparation intermission state (shown while match === null) */
  intermission?: SoloLiveIntermissionInfo | null;
  /** When true (UCL only), render broadcast SVG penalty shootout visual instead of plain O/X board. */
  useUclPkVisual?: boolean;
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
    tacticEditActive = false,
    onStartTacticEdit,
    onConfirmTacticEdit,
    onTogglePause,
    onStop,
    onMatchDone,
    onEnterLiveMatch,
    intermission = null,
    useUclPkVisual = false,
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
      !tacticEditActive &&
      onEnterLiveMatch &&
      !progressStateRef.current.finished,
  );

  const showIntermissionCard = Boolean(
    !match && intermission && (!pauseReasonLabel || tacticEditActive),
  );
  const intermissionTotalMs = Math.max(
    1,
    intermission?.totalMs ?? SOLO_LIVE_INTERMISSION_MS,
  );
  const intermissionRemainingMs = Math.max(
    0,
    Math.min(intermissionTotalMs, intermission?.remainingMs ?? intermissionTotalMs),
  );
  const intermissionProgressPct = Math.max(
    0,
    Math.min(
      100,
      ((intermissionTotalMs - intermissionRemainingMs) / intermissionTotalMs) * 100,
    ),
  );

  return (
    <div className="rounded-xl sm:rounded-2xl border border-emerald-500/35 bg-[#0c131d] p-2.5 sm:p-3.5 space-y-2.5 shadow-lg">
      {/* Compact control bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-extrabold ${
              paused || pauseReasonLabel
                ? 'border-amber-400/45 bg-amber-500/15 text-amber-200'
                : showIntermissionCard
                  ? 'border-sky-400/45 bg-sky-500/15 text-sky-200'
                  : 'border-emerald-500/45 bg-emerald-500/15 text-emerald-200'
            }`}
          >
            {showIntermissionCard && !paused && !pauseReasonLabel ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Radio
                className={`w-3 h-3 ${paused || pauseReasonLabel ? '' : 'animate-pulse'}`}
              />
            )}
            {pauseReasonLabel ??
              (paused
                ? '일시정지'
                : showIntermissionCard
                  ? '다음 경기 대기'
                  : '라이브 자동진행')}
          </span>

          {tacticEditActive && onConfirmTacticEdit ? (
            <button
              id="solo-live-confirm-tactic-btn"
              type="button"
              onClick={onConfirmTacticEdit}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1 text-[11px] font-extrabold text-slate-950 hover:bg-emerald-400 cursor-pointer shadow-sm"
            >
              <Check className="w-3 h-3" />
              {match ? '수정 확정 · 재개' : '수정 확정 · 바로 시작'}
            </button>
          ) : (
            onStartTacticEdit && (
              <button
                id="solo-live-edit-tactic-btn"
                type="button"
                onClick={onStartTacticEdit}
                className="inline-flex items-center gap-1 rounded-lg border border-sky-400/40 bg-sky-500/15 px-2.5 py-1 text-[11px] font-bold text-sky-200 hover:bg-sky-500/25 cursor-pointer"
              >
                <SlidersHorizontal className="w-3 h-3" />
                전술 수정
              </button>
            )
          )}

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

          {!tacticEditActive && (
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
          )}

          <button
            type="button"
            onClick={onStop}
            title={
              match
                ? '진행 중인 경기를 즉시 확정하고 자동진행을 중단합니다'
                : '다음 경기 시작 전에 자동진행을 중단합니다'
            }
            className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-[#0b1018] px-2.5 py-1 text-[11px] font-bold text-slate-400 hover:border-rose-500/40 hover:text-rose-200 cursor-pointer whitespace-nowrap"
          >
            <Square className="w-2.5 h-2.5 fill-current" />
            {match ? '확정·중단' : '중단'}
          </button>
        </div>
      </div>

      {tacticEditActive && (
        <div className="rounded-lg border border-amber-400/35 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-200">
          {match
            ? '전술 수정 중 · 수정 확정 시 자동진행이 재개되며 변경된 전술은 다음 경기부터 적용됩니다'
            : '전술 수정 중 · 하단 전술실 또는 스쿼드 탭에서 수정 후 [수정 확정 · 바로 시작]을 누르면 다음 경기에 즉시 적용됩니다'}
        </div>
      )}

      {!tacticEditActive && noticeLabel && (
        <div className="rounded-lg border border-sky-400/35 bg-sky-500/10 px-2.5 py-1 text-[11px] font-bold text-sky-200">
          {noticeLabel}
        </div>
      )}

      {/* Smooth 60fps Live Scoreboard Match Card (+ Extra PK Shootout Phase) OR 3s Next-Match Intermission */}
      {match ? (
        <SoloScoreboardMatchRunner
          key={match.key}
          match={match}
          clubsById={clubsById}
          myClubId={myClubId}
          durationMs={durationMs}
          paused={paused}
          useUclPkVisual={useUclPkVisual}
          onProgress={(minute, inPenalties, finished) => {
            progressStateRef.current = { minute, inPenalties, finished };
          }}
          onDone={onMatchDone}
        />
      ) : showIntermissionCard && intermission ? (
        <div
          id="solo-live-intermission-card"
          className={`rounded-xl border px-3 py-2.5 space-y-2 transition-colors ${
            tacticEditActive
              ? 'border-amber-400/45 bg-amber-950/15'
              : intermission.isImportantMatch
                ? 'border-amber-400/50 bg-gradient-to-r from-[#0e1524] via-[#151520] to-[#0e1524]'
                : 'border-sky-500/35 bg-[#0b111d]'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[11px] font-extrabold">
              <Loader2
                className={`w-3.5 h-3.5 shrink-0 ${
                  tacticEditActive || paused
                    ? 'text-amber-300'
                    : 'text-sky-300 animate-spin'
                }`}
              />
              <span
                className={
                  tacticEditActive || paused ? 'text-amber-200' : 'text-sky-200'
                }
              >
                {tacticEditActive
                  ? '전술 대비 중 (카운트다운 정지)'
                  : paused
                    ? '다음 경기 대기 일시정지'
                    : '다음 경기 준비 중 · 전술 수정 시 바로 적용'}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span
                id="solo-live-intermission-timer"
                className={`rounded-md border px-2 py-0.5 font-mono text-[11px] font-extrabold tabular-nums ${
                  tacticEditActive || paused
                    ? 'border-amber-400/40 bg-amber-500/15 text-amber-200'
                    : 'border-sky-400/40 bg-sky-500/15 text-sky-200'
                }`}
              >
                {(intermissionRemainingMs / 1000).toFixed(1)}초
              </span>
              {!tacticEditActive && intermission.onStartNow && (
                <button
                  id="solo-live-intermission-start-now-btn"
                  type="button"
                  onClick={intermission.onStartNow}
                  className="inline-flex items-center gap-1 rounded-md border border-emerald-400/45 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-extrabold text-emerald-200 hover:bg-emerald-500/25 cursor-pointer"
                >
                  <FastForward className="w-3 h-3" />
                  바로 시작
                </button>
              )}
            </div>
          </div>

          {intermission.nextOpponent && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800/90 bg-[#090e17] px-2.5 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <JerseySvg
                  primaryColor={intermission.nextOpponent.primaryColor}
                  secondaryColor={intermission.nextOpponent.secondaryColor}
                  pattern={intermission.nextOpponent.pattern}
                  size={24}
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-400">
                      {intermission.nextRoundLabel}
                    </span>
                    <span className="truncate text-xs font-extrabold text-white">
                      {intermission.isHome ? 'vs' : '@'}{' '}
                      {intermission.nextOpponent.name}
                    </span>
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-bold text-slate-300">
                      {intermission.isHome ? '홈' : '원정'}
                    </span>
                    {intermission.importantBadge && (
                      <span className="rounded border border-amber-400/45 bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-extrabold text-amber-200">
                        {intermission.importantBadge}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[10px] font-semibold text-slate-400 tabular-nums">
                    상대 예상: {intermission.nextOpponent.formation} ·{' '}
                    {TACTICS[intermission.nextOpponent.defaultTactic].shortName}{' '}
                    · OVR{' '}
                    {Math.round(
                      (intermission.nextOpponent.att +
                        intermission.nextOpponent.mid +
                        intermission.nextOpponent.def) /
                        3,
                    )}
                  </div>
                </div>
              </div>

              {tacticEditActive && onConfirmTacticEdit ? (
                <button
                  type="button"
                  onClick={onConfirmTacticEdit}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1 text-[11px] font-extrabold text-slate-950 hover:bg-emerald-400 cursor-pointer shrink-0"
                >
                  <Check className="w-3 h-3" />
                  수정 확정 · 시작
                </button>
              ) : (
                onStartTacticEdit && (
                  <button
                    type="button"
                    onClick={onStartTacticEdit}
                    className="inline-flex items-center gap-1 rounded-lg border border-sky-400/45 bg-sky-500/20 px-2.5 py-1 text-[11px] font-extrabold text-sky-100 hover:bg-sky-500/30 cursor-pointer shrink-0"
                  >
                    <SlidersHorizontal className="w-3 h-3" />
                    전술 대비
                  </button>
                )
              )}
            </div>
          )}

          {/* Smooth 3-second loading bar */}
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800/90">
            <div
              className={`h-full rounded-full transition-[width] duration-100 ease-linear ${
                tacticEditActive || paused
                  ? 'bg-amber-400'
                  : intermission.isImportantMatch
                    ? 'bg-gradient-to-r from-amber-400 via-sky-400 to-emerald-400'
                    : 'bg-gradient-to-r from-sky-400 to-emerald-400'
              }`}
              style={{ width: `${intermissionProgressPct}%` }}
            />
          </div>
        </div>
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
  useUclPkVisual,
  onProgress,
  onDone,
}: {
  match: MpCastMatch;
  clubsById: Record<string, Club>;
  myClubId: string;
  durationMs: SoloLiveDurationMs;
  paused: boolean;
  useUclPkVisual: boolean;
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
      useUclPkVisual={useUclPkVisual}
      initialRatio={0}
      barRef={(el) => {
        barElRef.current = el;
      }}
    />
  );
}
