import { Radio, Star } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ModalBodyLock } from '../../../hooks/useBodyScrollLock';
import type { Club } from '../../../types/league';
import type {
  MpCastLive,
  MpCastMatch,
  MpLeagueHuman,
} from '../../../types/mpLeague';
import type { UclKnockoutTie } from '../../../types/ucl';
import { JerseySvg } from '../../common/JerseySvg';
import { PenaltyShootoutVisual } from '../../common/PenaltyShootoutVisual';
import type { LiveTieOverlay } from '../../ucl/UclBracketTree';
import { LIVE_PK_KICK_INTERVAL_MS } from './MpLiveTicker';

export interface MpUclMulticastBoardProps {
  cast: MpCastLive;
  clubsById: Record<string, Club>;
  humans: MpLeagueHuman[];
  myClubId: string | null;
  /** Render inline inside the dashboard (above the live bracket) instead of a blocking full-screen modal */
  inline?: boolean;
  /** Pre-match ties used to map home/away goals to Team A / Team B for live bracket overlays */
  bracketTies?: UclKnockoutTie[];
  /** Emits live bracket tie overlays as the wall-clock match stream progresses */
  onLiveOverlays?: (overlays: Record<string, LiveTieOverlay>, settled: boolean) => void;
}

type CastPhase = 'regular' | 'etBreak' | 'extra' | 'penalties' | 'ended' | 'final';

const REGULAR_DURATION_MS = 6800; // 0' -> 90'
const ET_BREAK_MS = 700;
const EXTRA_DURATION_MS = 2300; // 90' -> 120'
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

function fallbackClub(id: string): Pick<
  Club,
  'name' | 'shortName' | 'primaryColor' | 'secondaryColor' | 'pattern'
> {
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
  phase: CastPhase,
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
  phase: CastPhase,
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
  phase: CastPhase;
  revealedPenKicks: number;
  clubsById: Record<string, Club>;
  nicknameByClubId: Record<string, string>;
  myClubId: string | null;
}) {
  const { home: liveHome, away: liveAway } = computeLiveScore(match, minute, phase);

  const homeClubObj = clubsById[match.homeTeamId] ?? null;
  const awayClubObj = clubsById[match.awayTeamId] ?? null;
  const home = homeClubObj ?? fallbackClub(match.homeTeamId);
  const away = awayClubObj ?? fallbackClub(match.awayTeamId);

  const clockOver = phase === 'penalties' || phase === 'ended' || phase === 'final';
  const matchOver = clockOver || (!match.extraTime && minute >= 90);
  const hasPens = Boolean(match.penalties);
  const pkKicks = match.penalties?.kicks ?? [];
  const pkTotal = pkKicks.length;
  const pkRevealed =
    phase === 'final' ? pkTotal : Math.min(pkTotal, Math.max(0, revealedPenKicks));
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
    match.humanClubIds.includes(clubId)
      ? (nicknameByClubId[clubId] ?? '')
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

      {hasPens && match.penalties && (phase === 'penalties' || phase === 'final') && (
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

function MpUclMulticastBoardInner({
  cast,
  clubsById,
  humans,
  myClubId,
  inline = false,
  bracketTies,
  onLiveOverlays,
}: MpUclMulticastBoardProps) {
  const [clock, setClock] = useState<{
    minute: number;
    phase: CastPhase;
    revealedPenKicks: number;
  }>({
    minute: 0,
    phase: 'regular',
    revealedPenKicks: 0,
  });
  const onLiveOverlaysRef = useRef(onLiveOverlays);
  useEffect(() => {
    onLiveOverlaysRef.current = onLiveOverlays;
  });

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

  // Wall-clock + rAF timeline (smooth, background-tab resilient, synced to getMpCastDurationMs PK cadence)
  useEffect(() => {
    const startAt = performance.now();
    let rafId = 0;
    let lastMin = -1;
    let lastPhase: CastPhase = 'regular';
    let lastRevealedPk = -1;

    const evaluate = () => {
      const elapsed = performance.now() - startAt;
      let nextMin = 0;
      let nextPhase: CastPhase = 'regular';
      let nextRevealedPk = 0;

      const resolvePostMatch = (
        afterMatchMs: number,
      ): { phase: CastPhase; revealedPenKicks: number } => {
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

      if (elapsed < REGULAR_DURATION_MS) {
        nextMin = Math.min(90, Math.floor((elapsed / REGULAR_DURATION_MS) * 90));
        nextPhase = 'regular';
      } else if (hasExtraTime) {
        const afterReg = elapsed - REGULAR_DURATION_MS;
        if (afterReg < ET_BREAK_MS) {
          nextMin = 90;
          nextPhase = 'etBreak';
        } else if (afterReg < ET_BREAK_MS + EXTRA_DURATION_MS) {
          const etFrac = (afterReg - ET_BREAK_MS) / EXTRA_DURATION_MS;
          nextMin = Math.min(120, 90 + Math.floor(etFrac * 30));
          nextPhase = 'extra';
        } else {
          nextMin = 120;
          const post = resolvePostMatch(afterReg - ET_BREAK_MS - EXTRA_DURATION_MS);
          nextPhase = post.phase;
          nextRevealedPk = post.revealedPenKicks;
        }
      } else {
        nextMin = 90;
        const post = resolvePostMatch(elapsed - REGULAR_DURATION_MS);
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
      return nextPhase === 'final';
    };

    const step = () => {
      const done = evaluate();
      if (!done) {
        rafId = window.requestAnimationFrame(step);
      }
    };
    rafId = window.requestAnimationFrame(step);

    // Watchdog for backgrounded tabs where rAF pauses
    const watchdog = window.setInterval(() => {
      if (evaluate()) window.clearInterval(watchdog);
    }, 350);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearInterval(watchdog);
    };
  }, [hasExtraTime, hasPenalties, maxPkKicks]);

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
  const clockLabel =
    phase === 'penalties'
      ? '승부차기'
      : phase === 'etBreak'
        ? '연장전'
        : running
          ? `${minute}'`
          : '종료';

  const boardContent = (
    <div
      id="mp-ucl-multicast-board"
      className={`overflow-hidden rounded-2xl border shadow-2xl ${
        inline
          ? 'border-sky-400/45 bg-[#0b1426]'
          : 'modal-panel modal-scroll w-full max-w-3xl overflow-y-auto overflow-x-hidden border-sky-500/35 bg-[#0b1322]'
      }`}
    >
      <style>{CAST_KEYFRAMES}</style>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-3.5 py-2.5 sm:px-4 sm:py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Star className="h-4 w-4 shrink-0 fill-current text-sky-300" />
          <h2 className="truncate font-display text-sm sm:text-base font-bold tracking-wide text-white">
            {cast.title}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-black tracking-widest ${
              running
                ? 'border-rose-500/40 bg-rose-500/10 text-rose-300'
                : 'border-slate-700 bg-slate-900/80 text-slate-500'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                running ? 'bg-rose-400' : 'bg-slate-600'
              }`}
              style={
                running
                  ? { animation: 'mplCastLiveDot 1s ease-in-out infinite' }
                  : undefined
              }
            />
            LIVE
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
    </div>
  );

  if (inline) return boardContent;

  return (
    <div className="modal-backdrop fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/88 p-3 sm:p-4">
      <ModalBodyLock />
      {boardContent}
    </div>
  );
}

/** UCL live multicast scoreboard. The clock restarts whenever `cast.key` changes. */
export function MpUclMulticastBoard(props: MpUclMulticastBoardProps) {
  return <MpUclMulticastBoardInner key={props.cast.key} {...props} />;
}
