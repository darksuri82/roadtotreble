import {
  FastForward,
  Pause,
  Play,
  Radio,
  Square,
  Star,
  Tv,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ModalBodyLock } from '../../hooks/useBodyScrollLock';
import type { Club } from '../../types/league';
import type {
  MpCastLive,
  MpCastMatch,
  MpLeagueHuman,
} from '../../types/mpLeague';
import type { UclKnockoutTie } from '../../types/ucl';
import { JerseySvg } from '../common/JerseySvg';
import { PenaltyShootoutVisual } from '../common/PenaltyShootoutVisual';
import { SOLO_LIVE_SPEED_OPTIONS } from '../common/SoloLiveScoreboard';
import type { SoloLiveDurationMs } from '../common/SoloLiveScoreboard';
import { LIVE_PK_KICK_INTERVAL_MS } from '../multiplayer/league/MpLiveTicker';
import type { LiveTieOverlay } from './UclBracketTree';

export type UclCastPhase =
  | 'regular'
  | 'etBreak'
  | 'extra'
  | 'penalties'
  | 'ended'
  | 'final';

export interface SoloUclCastProgress {
  minute: number;
  phase: UclCastPhase;
  revealedPenKicks: number;
  inPenalties: boolean;
  settled: boolean;
}

/**
 * Single-player only playback & takeover controls.
 * Multiplayer boards NEVER pass this prop, guaranteeing zero solo controls in multiplayer.
 */
export interface SoloUclCastControls {
  paused: boolean;
  onTogglePause: () => void;
  speedMs: SoloLiveDurationMs;
  onChangeSpeedMs: (ms: SoloLiveDurationMs) => void;
  /** Shown only when the user's club is alive and can take over into 2D broadcast */
  onStopAndDirectPlay?: (snapshot: SoloUclCastProgress) => void;
  directPlayLabel?: string;
  /** Stop auto-sim and return to dashboard / tactics room */
  onStopToDashboard: () => void;
  stopLabel?: string;
  /** Optional quick switch to fast-skip (League Phase) */
  onQuickSkip?: () => void;
  quickSkipLabel?: string;
  /** Optional status pill (e.g. next-round countdown) */
  statusPill?: string | null;
  /** Hide active playback controls once post-FT boundary confirmation bar is shown */
  hidePlaybackControls?: boolean;
}

export interface UclMulticastPopupBoardProps {
  cast: MpCastLive;
  clubsById: Record<string, Club>;
  humans?: MpLeagueHuman[];
  myClubId: string | null;
  /** Render inline inside the dashboard instead of a centered popup modal */
  inline?: boolean;
  /** Backdrop z-index utility class (default matches multiplayer z-[75]) */
  backdropZClass?: string;
  /** Optional board element id */
  boardId?: string;
  /** Regular 0' -> 90' duration in ms (multiplayer default: 6800ms) */
  regularDurationMs?: number;
  /** Pre-match ties used to map home/away goals to Team A / Team B for live bracket overlays */
  bracketTies?: UclKnockoutTie[];
  /** Emits live bracket tie overlays as the match stream progresses (spoiler-free until final) */
  onLiveOverlays?: (
    overlays: Record<string, LiveTieOverlay>,
    settled: boolean,
  ) => void;
  /** Fires strictly once when the cast finishes 90'/120' + PK shootout sequence */
  onSettled?: (castKey: string) => void;
  /**
   * When true, mounts directly in the settled FT/AET/PK final state without replaying
   * the match clock (prevents replaying an already-committed match after a post-match
   * interview/injury/awakening modal temporarily hides and remounts the popup).
   */
  initiallySettled?: boolean;
  /** Single-player only controls (omitted in multiplayer) */
  soloControls?: SoloUclCastControls;
  /** Optional footer slot inside the modal panel (e.g. solo standings strip or knockout boundary CTA) */
  footerSlot?: ReactNode;
}

const DEFAULT_REGULAR_DURATION_MS = 6800; // 0' -> 90'
const ET_BREAK_MS = 700;
const DEFAULT_EXTRA_DURATION_MS = 2300; // 90' -> 120'
const PENALTY_REVEAL_MS = 750;

const CAST_KEYFRAMES = `
@keyframes mplCastCardFlash {
  0% { opacity: 0; }
  18% { opacity: 1; }
  100% { opacity: 0; }
}
@keyframes mplCastScorePop {
  0% { transform: scale(1); color: #fcd34d; }
  30% { transform: scale(1.45); color: #fcd34d; }
  100% { transform: scale(1); }
}
@keyframes mplCastTickerIn {
  0% { opacity: 0; transform: translateY(6px); }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes mplCastLiveDot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.25; }
}
@keyframes mplCastReveal {
  0% { opacity: 0; transform: scale(0.85); }
  100% { opacity: 1; transform: scale(1); }
}
`;

function fallbackClub(
  id: string,
): Pick<Club, 'name' | 'shortName' | 'primaryColor' | 'secondaryColor' | 'pattern'> {
  return {
    name: id,
    shortName: id.slice(0, 3).toUpperCase(),
    primaryColor: '#334155',
    secondaryColor: '#94a3b8',
    pattern: 'solid',
  };
}

/** Minute up to which this match's goals are revealed. */
function revealMinute(
  match: MpCastMatch,
  minute: number,
  phase: UclCastPhase,
): number {
  if (phase === 'penalties' || phase === 'ended' || phase === 'final') {
    return Number.POSITIVE_INFINITY;
  }
  if (!match.extraTime && minute >= 90) return Number.POSITIVE_INFINITY;
  return minute;
}

function computeLiveScore(
  match: MpCastMatch,
  minute: number,
  phase: UclCastPhase,
): { home: number; away: number } {
  const upTo = revealMinute(match, minute, phase);
  let home = 0;
  let away = 0;
  for (const goal of match.goals) {
    if (goal.minute > upTo) continue;
    if (goal.teamId === match.homeTeamId) home += 1;
    else if (goal.teamId === match.awayTeamId) away += 1;
  }
  return { home, away };
}

function CastSide({
  club,
  align,
  friendLabel,
  isMine,
  dimmed,
  winner,
}: {
  club: ReturnType<typeof fallbackClub>;
  align: 'left' | 'right';
  friendLabel: string | null;
  isMine: boolean;
  dimmed: boolean;
  winner: boolean;
}) {
  return (
    <div
      className={`flex min-w-0 flex-col gap-1 transition-opacity duration-500 ${
        align === 'left' ? 'items-start text-left' : 'items-end text-right'
      } ${dimmed ? 'opacity-45' : ''}`}
    >
      <div
        className={`flex min-w-0 max-w-full items-center gap-2 ${
          align === 'right' ? 'flex-row-reverse' : ''
        }`}
      >
        <JerseySvg
          primaryColor={club.primaryColor}
          secondaryColor={club.secondaryColor}
          pattern={club.pattern}
          size={30}
        />
        <div className="min-w-0">
          <div
            className={`font-display text-xs sm:text-sm font-bold leading-tight tracking-wide ${
              winner ? 'text-amber-200' : 'text-white'
            }`}
          >
            {club.shortName}
          </div>
          <div className="truncate text-[10px] font-semibold leading-tight text-slate-400">
            {club.name}
          </div>
        </div>
      </div>
      {isMine ? (
        <span className="inline-flex max-w-full items-center rounded-md border border-emerald-400/45 bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-black text-emerald-200">
          나
        </span>
      ) : friendLabel !== null ? (
        <span className="inline-flex max-w-full items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">
          <span className="shrink-0">친구</span>
          <span className="truncate">{friendLabel}</span>
        </span>
      ) : null}
    </div>
  );
}

function CastMatchCard({
  match,
  minute,
  phase,
  revealedPenKicks,
  clubsById,
  nicknameByClubId,
  myClubId,
}: {
  match: MpCastMatch;
  minute: number;
  phase: UclCastPhase;
  revealedPenKicks: number;
  clubsById: Record<string, Club>;
  nicknameByClubId: Record<string, string>;
  myClubId: string | null;
}) {
  const { home: liveHome, away: liveAway } = computeLiveScore(
    match,
    minute,
    phase,
  );

  const homeClubObj = clubsById[match.homeTeamId] ?? null;
  const awayClubObj = clubsById[match.awayTeamId] ?? null;
  const home = homeClubObj ?? fallbackClub(match.homeTeamId);
  const away = awayClubObj ?? fallbackClub(match.awayTeamId);

  const clockOver =
    phase === 'penalties' || phase === 'ended' || phase === 'final';
  const matchOver = clockOver || (!match.extraTime && minute >= 90);
  const hasPens = Boolean(match.penalties);
  const pkKicks = match.penalties?.kicks ?? [];
  const pkTotal = pkKicks.length;
  const pkRevealed =
    phase === 'final'
      ? pkTotal
      : Math.min(pkTotal, Math.max(0, revealedPenKicks));
  const pkInProgress =
    hasPens && phase === 'penalties' && pkTotal > 0 && pkRevealed < pkTotal;
  const settled = hasPens ? phase === 'final' : matchOver;
  const winnerId = settled
    ? (match.winnerId ?? match.penalties?.winnerId ?? null)
    : null;

  const hasAgg =
    match.aggHomeBefore !== undefined && match.aggAwayBefore !== undefined;

  let statusLabel: string | null = null;
  let statusClass = 'border-slate-700 bg-slate-900/80 text-slate-300';
  if (hasPens && phase === 'penalties') {
    statusLabel = 'PK 진행';
    statusClass = 'border-sky-400/50 bg-sky-500/18 text-sky-200 animate-pulse';
  } else if (matchOver) {
    statusLabel = match.extraTime ? 'AET' : 'FT';
  } else if (match.extraTime && (phase === 'etBreak' || phase === 'extra')) {
    statusLabel = '연장전';
    statusClass = 'border-amber-500/40 bg-amber-500/10 text-amber-200';
  }

  const friendLabel = (clubId: string): string | null =>
    match.humanClubIds.includes(clubId) && nicknameByClubId[clubId]
      ? nicknameByClubId[clubId]
      : null;

  return (
    <div
      title={match.label}
      className="relative overflow-hidden rounded-xl border border-slate-800 bg-[#111822] px-3 py-2.5"
    >
      {liveHome + liveAway > 0 && (
        <span
          key={`flash-${liveHome}-${liveAway}`}
          className="pointer-events-none absolute inset-0 rounded-xl border border-amber-400/70 bg-amber-400/10"
          style={{
            opacity: 0,
            animation: 'mplCastCardFlash 1s ease-out 1',
          }}
        />
      )}

      <div className="relative flex items-center justify-between gap-2">
        <span className="truncate text-[10px] font-bold uppercase tracking-wider text-slate-500">
          {match.label}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          {phase === 'final' && match.penalties && (
            <span
              className="rounded-md border border-sky-400/40 bg-sky-500/12 px-1.5 py-0.5 text-[10px] font-black tabular-nums text-sky-200"
              style={{ animation: 'mplCastReveal 0.35s ease-out 1' }}
            >
              PK {match.penalties.home}–{match.penalties.away}
            </span>
          )}
          {statusLabel !== null && (
            <span
              className={`rounded-md border px-1.5 py-0.5 text-[10px] font-black tracking-wider ${statusClass}`}
            >
              {statusLabel}
            </span>
          )}
        </div>
      </div>

      <div className="relative mt-2 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
        <CastSide
          club={home}
          align="left"
          friendLabel={friendLabel(match.homeTeamId)}
          isMine={myClubId !== null && myClubId === match.homeTeamId}
          dimmed={winnerId !== null && winnerId !== match.homeTeamId}
          winner={winnerId === match.homeTeamId}
        />

        <div className="flex flex-col items-center">
          <div className="flex items-center gap-1.5 font-display text-2xl sm:text-3xl font-bold leading-none tabular-nums text-white">
            <span
              key={`h-${liveHome}`}
              className="inline-block min-w-[1ch] text-center"
              style={
                liveHome > 0
                  ? { animation: 'mplCastScorePop 1s ease-out 1' }
                  : undefined
              }
            >
              {liveHome}
            </span>
            <span className="text-lg sm:text-xl text-slate-600">:</span>
            <span
              key={`a-${liveAway}`}
              className="inline-block min-w-[1ch] text-center"
              style={
                liveAway > 0
                  ? { animation: 'mplCastScorePop 1s ease-out 1' }
                  : undefined
              }
            >
              {liveAway}
            </span>
          </div>
          {hasAgg && (
            <div className="mt-1 whitespace-nowrap text-[10px] font-bold tabular-nums text-slate-400">
              합산 {(match.aggHomeBefore ?? 0) + liveHome} –{' '}
              {(match.aggAwayBefore ?? 0) + liveAway}
            </div>
          )}
        </div>

        <CastSide
          club={away}
          align="right"
          friendLabel={friendLabel(match.awayTeamId)}
          isMine={myClubId !== null && myClubId === match.awayTeamId}
          dimmed={winnerId !== null && winnerId !== match.awayTeamId}
          winner={winnerId === match.awayTeamId}
        />
      </div>

      {hasPens &&
        match.penalties &&
        (phase === 'penalties' || phase === 'final') && (
          <PenaltyShootoutVisual
            homeClub={homeClubObj}
            awayClub={awayClubObj}
            homeTeamId={match.homeTeamId}
            awayTeamId={match.awayTeamId}
            homeScore={match.penalties.home}
            awayScore={match.penalties.away}
            kicks={pkKicks}
            revealedCount={pkRevealed}
            winnerId={match.penalties.winnerId}
            myClubId={myClubId}
            inProgress={pkInProgress}
            variant="compact"
          />
        )}
    </div>
  );
}

/**
 * Computes the initial clock state for UclMulticastPopupBoardInner.
 * When `initiallySettled` is true (e.g. remounting after a post-match interview/injury modal
 * temporarily hid the already-finished cast), starts directly at the final FT/AET/PK state.
 */
export function getInitialUclCastClock(
  cast: MpCastLive,
  initiallySettled = false,
): {
  minute: number;
  phase: UclCastPhase;
  revealedPenKicks: number;
} {
  if (!initiallySettled) {
    return { minute: 0, phase: 'regular', revealedPenKicks: 0 };
  }
  const hasExtraTime = cast.matches.some((m) => m.extraTime);
  const maxPkKicks = cast.matches.reduce(
    (max, m) => Math.max(max, m.penalties?.kicks?.length ?? 0),
    0,
  );
  return {
    minute: hasExtraTime ? 120 : 90,
    phase: 'final',
    revealedPenKicks: maxPkKicks,
  };
}

function UclMulticastPopupBoardInner({
  cast,
  clubsById,
  humans = [],
  myClubId,
  inline = false,
  backdropZClass = 'z-[75]',
  boardId = 'mp-ucl-multicast-board',
  regularDurationMs = DEFAULT_REGULAR_DURATION_MS,
  bracketTies,
  onLiveOverlays,
  onSettled,
  initiallySettled = false,
  soloControls,
  footerSlot,
}: UclMulticastPopupBoardProps) {
  const [clock, setClock] = useState<{
    minute: number;
    phase: UclCastPhase;
    revealedPenKicks: number;
  }>(() => getInitialUclCastClock(cast, initiallySettled));

  const paused = Boolean(soloControls?.paused);
  const effectiveRegularMs = soloControls
    ? soloControls.speedMs
    : regularDurationMs;

  const onLiveOverlaysRef = useRef(onLiveOverlays);
  const onSettledRef = useRef(onSettled);
  const pausedRef = useRef(paused);
  const regularMsRef = useRef(effectiveRegularMs);
  const settledFiredRef = useRef(initiallySettled);

  // Stage-accumulated timeline refs so pause/resume & mid-stream speed changes never jump backward
  const timelineRef = useRef({
    regProgress: initiallySettled ? 1 : 0,
    etBreakMs: initiallySettled ? ET_BREAK_MS : 0,
    etProgress: initiallySettled ? 1 : 0,
    postMs: initiallySettled ? Number.MAX_SAFE_INTEGER : 0,
  });

  useEffect(() => {
    onLiveOverlaysRef.current = onLiveOverlays;
  });
  useEffect(() => {
    onSettledRef.current = onSettled;
  });
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    regularMsRef.current = effectiveRegularMs;
  }, [effectiveRegularMs]);

  const hasExtraTime = cast.matches.some((m) => m.extraTime);
  const hasPenalties = cast.matches.some((m) => Boolean(m.penalties));
  const maxPkKicks = useMemo(
    () =>
      cast.matches.reduce(
        (max, m) => Math.max(max, m.penalties?.kicks?.length ?? 0),
        0,
      ),
    [cast.matches],
  );

  // Wall-clock + rAF timeline (background-tab resilient, pause-safe, speed-change-safe, synced to multiplayer PK cadence)
  useEffect(() => {
    // Already-settled cast remounted after a post-match modal: never replay from 0'
    if (initiallySettled) {
      settledFiredRef.current = true;
      return;
    }
    let rafId = 0;
    let lastTickAt: number | null = pausedRef.current ? null : performance.now();
    let lastMin = -1;
    let lastPhase: UclCastPhase = 'regular';
    let lastRevealedPk = -1;

    const resolvePostMatch = (
      afterMatchMs: number,
    ): { phase: UclCastPhase; revealedPenKicks: number } => {
      if (!hasPenalties) {
        return { phase: 'final', revealedPenKicks: 0 };
      }
      if (maxPkKicks > 0) {
        const pkTotalMs = maxPkKicks * LIVE_PK_KICK_INTERVAL_MS;
        if (afterMatchMs < pkTotalMs) {
          return {
            phase: 'penalties',
            revealedPenKicks: Math.min(
              maxPkKicks,
              Math.floor(afterMatchMs / LIVE_PK_KICK_INTERVAL_MS) + 1,
            ),
          };
        }
        return { phase: 'final', revealedPenKicks: maxPkKicks };
      }
      return {
        phase: afterMatchMs < PENALTY_REVEAL_MS ? 'ended' : 'final',
        revealedPenKicks: 0,
      };
    };

    const evaluate = () => {
      const now = performance.now();
      if (pausedRef.current) {
        lastTickAt = null;
        return false;
      }
      if (lastTickAt === null) {
        lastTickAt = now;
      }
      let dt = Math.max(0, now - lastTickAt);
      lastTickAt = now;

      const tl = timelineRef.current;
      const curRegMs = Math.max(1000, regularMsRef.current);
      const curExtraMs =
        curRegMs === DEFAULT_REGULAR_DURATION_MS
          ? DEFAULT_EXTRA_DURATION_MS
          : Math.max(1200, Math.round(curRegMs * 0.34));

      if (tl.regProgress < 1 && dt > 0) {
        const remainingRegMs = (1 - tl.regProgress) * curRegMs;
        if (dt < remainingRegMs) {
          tl.regProgress += dt / curRegMs;
          dt = 0;
        } else {
          tl.regProgress = 1;
          dt -= remainingRegMs;
        }
      }

      if (tl.regProgress >= 1 && hasExtraTime) {
        if (tl.etBreakMs < ET_BREAK_MS && dt > 0) {
          const rem = ET_BREAK_MS - tl.etBreakMs;
          if (dt < rem) {
            tl.etBreakMs += dt;
            dt = 0;
          } else {
            tl.etBreakMs = ET_BREAK_MS;
            dt -= rem;
          }
        }
        if (tl.etBreakMs >= ET_BREAK_MS && tl.etProgress < 1 && dt > 0) {
          const remainingEtMs = (1 - tl.etProgress) * curExtraMs;
          if (dt < remainingEtMs) {
            tl.etProgress += dt / curExtraMs;
            dt = 0;
          } else {
            tl.etProgress = 1;
            dt -= remainingEtMs;
          }
        }
        if (tl.etProgress >= 1 && dt > 0) {
          tl.postMs += dt;
        }
      } else if (tl.regProgress >= 1 && dt > 0) {
        tl.postMs += dt;
      }

      let nextMin = 0;
      let nextPhase: UclCastPhase = 'regular';
      let nextRevealedPk = 0;

      if (tl.regProgress < 1) {
        nextMin = Math.min(90, Math.floor(tl.regProgress * 90));
        nextPhase = 'regular';
      } else if (hasExtraTime) {
        if (tl.etBreakMs < ET_BREAK_MS) {
          nextMin = 90;
          nextPhase = 'etBreak';
        } else if (tl.etProgress < 1) {
          nextMin = Math.min(120, 90 + Math.floor(tl.etProgress * 30));
          nextPhase = 'extra';
        } else {
          nextMin = 120;
          const post = resolvePostMatch(tl.postMs);
          nextPhase = post.phase;
          nextRevealedPk = post.revealedPenKicks;
        }
      } else {
        nextMin = 90;
        const post = resolvePostMatch(tl.postMs);
        nextPhase = post.phase;
        nextRevealedPk = post.revealedPenKicks;
      }

      if (
        nextMin !== lastMin ||
        nextPhase !== lastPhase ||
        nextRevealedPk !== lastRevealedPk
      ) {
        lastMin = nextMin;
        lastPhase = nextPhase;
        lastRevealedPk = nextRevealedPk;
        setClock({
          minute: nextMin,
          phase: nextPhase,
          revealedPenKicks: nextRevealedPk,
        });
      }

      const isFinal = nextPhase === 'final';
      if (isFinal && !settledFiredRef.current) {
        settledFiredRef.current = true;
        onSettledRef.current?.(cast.key);
      }
      return isFinal;
    };

    const step = () => {
      const done = evaluate();
      if (!done) {
        rafId = window.requestAnimationFrame(step);
      }
    };
    rafId = window.requestAnimationFrame(step);

    const watchdog = window.setInterval(() => {
      if (evaluate()) window.clearInterval(watchdog);
    }, 350);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearInterval(watchdog);
    };
  }, [cast.key, hasExtraTime, hasPenalties, maxPkKicks, initiallySettled]);

  // Publish live overlays to the shared UclBracketTree (spoiler-free until phase === 'final')
  useEffect(() => {
    if (!onLiveOverlaysRef.current) return;
    const tieById = new Map<string, UclKnockoutTie>();
    for (const t of bracketTies ?? []) tieById.set(t.id, t);

    const overlays: Record<string, LiveTieOverlay> = {};
    for (const m of cast.matches) {
      const tie =
        (m.tieId ? tieById.get(m.tieId) : undefined) ??
        (bracketTies ?? []).find(
          (t) =>
            (t.teamAId === m.homeTeamId && t.teamBId === m.awayTeamId) ||
            (t.teamAId === m.awayTeamId && t.teamBId === m.homeTeamId),
        );
      if (!tie) continue;
      const { home, away } = computeLiveScore(m, clock.minute, clock.phase);
      const aIsHome = tie.teamAId === m.homeTeamId;
      const liveGoalsA = aIsHome ? home : away;
      const liveGoalsB = aIsHome ? away : home;
      const matchOver =
        clock.phase === 'penalties' ||
        clock.phase === 'ended' ||
        clock.phase === 'final' ||
        (!m.extraTime && clock.minute >= 90);
      const settled = m.penalties ? clock.phase === 'final' : matchOver;
      const clockLabel = settled
        ? m.extraTime
          ? 'AET'
          : 'FT'
        : clock.phase === 'penalties'
          ? 'PK'
          : clock.phase === 'etBreak'
            ? '연장전'
            : `${clock.minute}'`;

      overlays[tie.id] = {
        liveGoalsA,
        liveGoalsB,
        clockLabel,
        isLive: !settled,
        penaltyScoreA:
          settled && m.penalties
            ? aIsHome
              ? m.penalties.home
              : m.penalties.away
            : undefined,
        penaltyScoreB:
          settled && m.penalties
            ? aIsHome
              ? m.penalties.away
              : m.penalties.home
            : undefined,
      };
    }
    onLiveOverlaysRef.current(overlays, clock.phase === 'final');
  }, [cast.matches, bracketTies, clock.minute, clock.phase]);

  const nicknameByClubId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const human of humans) map[human.clubId] = human.nickname;
    return map;
  }, [humans]);

  const { minute, phase, revealedPenKicks } = clock;

  let latest: {
    id: string;
    minute: number;
    scorer: string;
    teamId: string;
  } | null = null;
  for (const match of cast.matches) {
    const upTo = revealMinute(match, minute, phase);
    match.goals.forEach((goal, idx) => {
      if (goal.minute > upTo) return;
      if (latest === null || goal.minute >= latest.minute) {
        latest = {
          id: `${match.key}-${idx}`,
          minute: goal.minute,
          scorer: goal.scorer,
          teamId: goal.teamId,
        };
      }
    });
  }
  const latestGoal = latest as {
    id: string;
    minute: number;
    scorer: string;
    teamId: string;
  } | null;

  const running =
    phase === 'regular' ||
    phase === 'etBreak' ||
    phase === 'extra' ||
    phase === 'penalties';
  const settledNow = phase === 'final';
  const clockLabel =
    phase === 'penalties'
      ? '승부차기'
      : phase === 'etBreak'
        ? '연장전'
        : running
          ? `${minute}'`
          : '종료';

  const currentProgress: SoloUclCastProgress = {
    minute,
    phase,
    revealedPenKicks,
    inPenalties: phase === 'penalties',
    settled: settledNow,
  };

  const boardContent = (
    <div
      id={boardId}
      className={`overflow-hidden rounded-2xl border shadow-2xl ${
        inline
          ? 'border-sky-400/45 bg-[#0b1426]'
          : 'modal-panel modal-scroll w-full max-w-3xl overflow-y-auto overflow-x-hidden border-sky-500/35 bg-[#0b1322]'
      }`}
    >
      <style>{CAST_KEYFRAMES}</style>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-800 px-3.5 py-2.5 sm:px-4 sm:py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Star className="h-4 w-4 shrink-0 fill-current text-sky-300" />
          <h2 className="truncate font-display text-sm sm:text-base font-bold tracking-wide text-white">
            {cast.title}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {soloControls?.statusPill && (
            <span className="rounded-md border border-sky-400/35 bg-sky-500/12 px-2 py-0.5 text-[10px] font-extrabold tabular-nums text-sky-200">
              {soloControls.statusPill}
            </span>
          )}
          <span
            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-black tracking-widest ${
              paused
                ? 'border-amber-400/45 bg-amber-500/15 text-amber-200'
                : running
                  ? 'border-rose-500/40 bg-rose-500/10 text-rose-300'
                  : 'border-slate-700 bg-slate-900/80 text-slate-500'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                paused
                  ? 'bg-amber-400'
                  : running
                    ? 'bg-rose-400'
                    : 'bg-slate-600'
              }`}
              style={
                !paused && running
                  ? { animation: 'mplCastLiveDot 1s ease-in-out infinite' }
                  : undefined
              }
            />
            {paused ? 'PAUSED' : 'LIVE'}
          </span>
          <span
            className={`min-w-[3.25rem] rounded-md border px-2 py-0.5 text-center font-display text-xs sm:text-sm font-bold tabular-nums ${
              phase === 'penalties'
                ? 'border-sky-400/50 bg-sky-500/18 text-sky-200'
                : phase === 'etBreak' || phase === 'extra'
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
                  : 'border-slate-700 bg-[#0b1018] text-slate-100'
            }`}
          >
            {clockLabel}
          </span>
        </div>
      </div>

      {/* Single-player ONLY playback & takeover bar (strictly absent in multiplayer) */}
      {soloControls && !soloControls.hidePlaybackControls && (
        <div
          id="solo-ucl-cast-controls"
          className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 bg-[#080f1c] px-3.5 py-2 sm:px-4"
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              id="solo-ucl-cast-pause-btn"
              type="button"
              onClick={soloControls.onTogglePause}
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-extrabold transition-colors cursor-pointer touch-manipulation ${
                paused
                  ? 'border-emerald-400/55 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30'
                  : 'border-amber-400/45 bg-amber-500/12 text-amber-200 hover:bg-amber-500/22'
              }`}
            >
              {paused ? (
                <>
                  <Play className="h-3 w-3 fill-current" />
                  재개
                </>
              ) : (
                <>
                  <Pause className="h-3 w-3" />
                  일시중지
                </>
              )}
            </button>

            <div className="inline-flex items-center rounded-lg border border-slate-800 bg-[#0b1220] p-0.5 text-[10px]">
              {SOLO_LIVE_SPEED_OPTIONS.map((ms) => {
                const active = soloControls.speedMs === ms;
                return (
                  <button
                    key={ms}
                    type="button"
                    onClick={() => soloControls.onChangeSpeedMs(ms)}
                    className={`rounded-md px-2 py-1 font-bold tabular-nums transition-colors cursor-pointer touch-manipulation ${
                      active
                        ? 'border border-sky-400/50 bg-sky-500/20 text-sky-100'
                        : 'border border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {ms / 1000}초
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {soloControls.onStopAndDirectPlay && (
              <button
                id="solo-ucl-cast-direct-2d-btn"
                type="button"
                onClick={() => soloControls.onStopAndDirectPlay?.(currentProgress)}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1.5 text-[11px] font-extrabold text-slate-950 hover:bg-emerald-400 cursor-pointer touch-manipulation"
              >
                <Tv className="h-3 w-3" />
                {soloControls.directPlayLabel ?? '중단 · 직접 2D 진행'}
              </button>
            )}
            {soloControls.onQuickSkip && (
              <button
                id="solo-ucl-cast-quick-skip-btn"
                type="button"
                onClick={soloControls.onQuickSkip}
                className="inline-flex items-center gap-1 rounded-lg border border-sky-500/40 bg-sky-500/15 px-2.5 py-1.5 text-[11px] font-bold text-sky-200 hover:bg-sky-500/25 cursor-pointer touch-manipulation"
              >
                <FastForward className="h-3 w-3" />
                {soloControls.quickSkipLabel ?? '빠른 스킵'}
              </button>
            )}
            <button
              id="solo-ucl-cast-stop-btn"
              type="button"
              onClick={soloControls.onStopToDashboard}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-[#101826] px-2.5 py-1.5 text-[11px] font-bold text-slate-300 hover:border-rose-500/45 hover:text-rose-200 cursor-pointer touch-manipulation"
            >
              <Square className="h-2.5 w-2.5 fill-current" />
              {soloControls.stopLabel ?? '자동진행 중단'}
            </button>
          </div>
        </div>
      )}

      {/* Score cards */}
      <div
        className={`grid grid-cols-1 gap-2 p-3 ${
          cast.matches.length > 1 ? 'sm:grid-cols-2' : ''
        }`}
      >
        {cast.matches.map((match) => (
          <CastMatchCard
            key={match.key}
            match={match}
            minute={minute}
            phase={phase}
            revealedPenKicks={revealedPenKicks}
            clubsById={clubsById}
            nicknameByClubId={nicknameByClubId}
            myClubId={myClubId}
          />
        ))}
      </div>

      {/* Ticker */}
      <div className="flex items-center gap-2.5 border-t border-slate-800 bg-[#0b1018] px-3.5 py-2">
        <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-amber-500/35 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-black text-amber-300">
          <Radio className="h-3 w-3" />
          속보
        </span>
        <div className="min-w-0 flex-1 overflow-hidden">
          {latestGoal !== null ? (
            <div
              key={latestGoal.id}
              className="truncate text-xs font-bold text-slate-100"
              style={{ animation: 'mplCastTickerIn 0.3s ease-out 1' }}
            >
              <span className="tabular-nums text-amber-300">
                {latestGoal.minute}&apos;
              </span>{' '}
              골 — {latestGoal.scorer} (
              {clubsById[latestGoal.teamId]?.shortName ??
                fallbackClub(latestGoal.teamId).shortName}
              )
            </div>
          ) : (
            <div className="truncate text-xs font-semibold text-slate-400">
              {cast.title}
            </div>
          )}
        </div>
      </div>

      {/* Optional Footer Slot (Solo live standings summary or Knockout boundary confirmation) */}
      {footerSlot}
    </div>
  );

  if (inline) return boardContent;

  return (
    <div
      className={`modal-backdrop fixed inset-0 ${backdropZClass} flex items-center justify-center bg-slate-950/88 p-3 sm:p-4`}
    >
      <ModalBodyLock />
      {boardContent}
    </div>
  );
}

/** Shared UCL live multicast popup scoreboard (restarts cleanly whenever `cast.key` changes). */
export function UclMulticastPopupBoard(props: UclMulticastPopupBoardProps) {
  return <UclMulticastPopupBoardInner key={props.cast.key} {...props} />;
}
