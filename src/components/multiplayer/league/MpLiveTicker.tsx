import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { Club, PenaltyKickLog } from '../../../types/league';
import type { MpCastLive, MpCastMatch, MpLeagueHuman } from '../../../types/mpLeague';
import { JerseySvg } from '../../common/JerseySvg';

/** Scoreboards that already finished replaying in this tab (never replay after a remount). */
const playedKeys = new Set<string>();

export function isMpTickerPlayed(key: string | null | undefined): boolean {
  return !key || playedKeys.has(key);
}

/** Per-kick reveal cadence during extra penalty shootout phase (added ON TOP of match duration). */
export const LIVE_PK_KICK_INTERVAL_MS = 700;

interface MpLiveTickerProps {
  ticker: MpCastLive;
  clubsById: Record<string, Club>;
  humans: MpLeagueHuman[];
  myClubId: string | null;
  /** Real time for 0' → 90' */
  durationMs: number;
  onDone: (key: string) => void;
}

const FEED_TONE: Record<string, string> = {
  goal: 'text-amber-200',
  save: 'text-sky-200',
  chance: 'text-slate-300',
  var: 'text-rose-200',
};

const FEED_TAG: Record<string, string> = {
  goal: '골',
  save: '선방',
  chance: '찬스',
  var: 'VAR',
};

const FEED_TAG_STYLE: Record<string, string> = {
  goal: 'bg-amber-400/20 text-amber-200 border-amber-400/40',
  save: 'bg-sky-500/20 text-sky-200 border-sky-400/35',
  chance: 'bg-slate-800 text-slate-300 border-slate-700',
  var: 'bg-rose-500/20 text-rose-200 border-rose-400/35',
};

export function endMinuteOfCastMatch(m: MpCastMatch): number {
  return m.extraTime ? 120 : 90;
}

export interface LiveTickerMatchCardProps {
  match: MpCastMatch;
  minute: number;
  finished: boolean;
  clubsById: Record<string, Club>;
  humanByClub?: Record<string, MpLeagueHuman>;
  myClubId: string | null;
  /** Number of penalty kicks revealed so far (added on top of 120' duration). */
  revealedPenKicks?: number;
  /** Optional ref callback for smooth 60fps progress bar transform updates (zero React rerenders). */
  barRef?: (el: HTMLDivElement | null) => void;
  /** Initial progress ratio (0..1) when barRef isn't driving updates or match already ended. */
  initialRatio?: number;
  /** When true, always render feed & stats (solo mode) even without humanClubIds. */
  alwaysShowFeed?: boolean;
}

export const LiveTickerMatchCard = memo(function LiveTickerMatchCard({
  match,
  minute,
  finished,
  clubsById,
  humanByClub,
  myClubId,
  revealedPenKicks,
  barRef,
  initialRatio,
  alwaysShowFeed = false,
}: LiveTickerMatchCardProps) {
  const maxMin = endMinuteOfCastMatch(match);
  const pkKicks: PenaltyKickLog[] = match.penalties?.kicks ?? [];
  const hasPkKicks = pkKicks.length > 0;
  const clockEnded = finished || Boolean(match.instant) || minute >= maxMin;
  const effectiveRevealedKicks =
    !hasPkKicks
      ? 0
      : finished || match.instant || revealedPenKicks === undefined
        ? pkKicks.length
        : Math.min(pkKicks.length, Math.max(0, revealedPenKicks));
  const pkInProgress =
    hasPkKicks &&
    !match.instant &&
    !finished &&
    minute >= maxMin &&
    effectiveRevealedKicks < pkKicks.length;
  const over = finished || Boolean(match.instant) || (minute >= maxMin && !pkInProgress);
  const isMine =
    alwaysShowFeed || Boolean(myClubId && match.humanClubIds.includes(myClubId));

  // Pre-sorted goals & feed memoized per match object
  const sortedGoals = useMemo(
    () => [...match.goals].sort((a, b) => a.minute - b.minute),
    [match.goals],
  );
  const sortedFeed = useMemo(
    () => [...(match.feed ?? [])].sort((a, b) => a.minute - b.minute),
    [match.feed],
  );

  // Derive visible goals & score up to current integer minute
  let homeGoals = 0;
  let awayGoals = 0;
  let shownCount = 0;
  let lastGoal: (typeof sortedGoals)[number] | null = null;
  for (let i = 0; i < sortedGoals.length; i += 1) {
    const g = sortedGoals[i];
    if (!clockEnded && g.minute > minute) break;
    shownCount += 1;
    lastGoal = g;
    if (g.teamId === match.homeTeamId) homeGoals += 1;
    else if (g.teamId === match.awayTeamId) awayGoals += 1;
  }
  if (clockEnded) {
    homeGoals = match.homeGoals;
    awayGoals = match.awayGoals;
  }

  let feedItem: (typeof sortedFeed)[number] | null = null;
  if (isMine && !clockEnded && sortedFeed.length > 0) {
    for (let i = sortedFeed.length - 1; i >= 0; i -= 1) {
      if (sortedFeed[i].minute <= minute) {
        feedItem = sortedFeed[i];
        break;
      }
    }
  }

  const goalFlash =
    !clockEnded && !match.instant && lastGoal !== null && minute - lastGoal.minute <= 3;
  const home = clubsById[match.homeTeamId];
  const away = clubsById[match.awayTeamId];
  const clock = match.instant
    ? 'FT'
    : pkInProgress
      ? 'PK'
      : over
        ? match.penalties
          ? 'PK'
          : match.extraTime
            ? 'AET'
            : 'FT'
        : `${Math.min(minute, maxMin)}'`;

  const renderSide = (
    clubId: string,
    club: Club | undefined,
    align: 'left' | 'right',
  ) => {
    const friend = humanByClub?.[clubId] ?? null;
    const isMySide = myClubId === clubId;
    return (
      <div
        className={`flex min-w-0 flex-1 items-center gap-1.5 ${
          align === 'right' ? 'flex-row-reverse text-right' : ''
        }`}
      >
        <JerseySvg
          primaryColor={club?.primaryColor ?? '#475569'}
          secondaryColor={club?.secondaryColor ?? '#e2e8f0'}
          pattern={club?.pattern}
          label=""
          size={19}
        />
        <div className="min-w-0 leading-tight">
          <div
            className={`truncate text-[11px] font-extrabold ${
              friend || isMySide ? 'text-white' : 'text-slate-300'
            }`}
          >
            {club?.shortName ?? club?.name ?? '-'}
          </div>
          {friend && (
            <div className="truncate text-[9px] font-bold text-emerald-300">
              {isMySide ? '나' : friend.nickname}
            </div>
          )}
        </div>
      </div>
    );
  };

  const fallbackRatio = clockEnded ? 1 : Math.min(1, Math.max(0, minute / maxMin));
  const barRatio = initialRatio !== undefined ? initialRatio : fallbackRatio;

  // Penalty shootout visual state (visible once 120' ends and shootout begins or completes)
  const showPkBox = Boolean(match.penalties && clockEnded);
  const shownKicks = showPkBox && hasPkKicks ? pkKicks.slice(0, effectiveRevealedKicks) : [];
  const latestKick = shownKicks.length > 0 ? shownKicks[shownKicks.length - 1] : null;
  const nextKick =
    pkInProgress && effectiveRevealedKicks < pkKicks.length
      ? pkKicks[effectiveRevealedKicks]
      : null;
  const liveHomePen = latestKick
    ? latestKick.homeScoreAfter
    : over
      ? (match.penalties?.home ?? 0)
      : 0;
  const liveAwayPen = latestKick
    ? latestKick.awayScoreAfter
    : over
      ? (match.penalties?.away ?? 0)
      : 0;
  const homeKicks = shownKicks.filter((k) => k.teamId === match.homeTeamId);
  const awayKicks = shownKicks.filter((k) => k.teamId === match.awayTeamId);
  const pkSlotCount = Math.max(
    5,
    homeKicks.length + (nextKick?.teamId === match.homeTeamId ? 1 : 0),
    awayKicks.length + (nextKick?.teamId === match.awayTeamId ? 1 : 0),
  );
  const isSuddenDeath = (nextKick?.round ?? latestKick?.round ?? 1) > 5;
  const pkWinnerClub = match.penalties ? clubsById[match.penalties.winnerId] : undefined;

  return (
    <div
      className={`relative overflow-hidden rounded-xl border px-2.5 py-2 transition-colors duration-300 ${
        pkInProgress
          ? 'border-amber-400/75 bg-[#161510]'
          : goalFlash
            ? 'scoreboard-goal-flash border-amber-400/75 bg-amber-500/12'
            : isMine
              ? 'border-emerald-500/40 bg-[#0e1722]'
              : 'border-slate-800/90 bg-[#0d131c]'
      }`}
    >
      {/* Top 60fps progress strip */}
      <div className="absolute inset-x-0 top-0 h-[2px] bg-slate-800/80">
        <div
          ref={barRef}
          className={`h-full origin-left ${
            pkInProgress
              ? 'bg-amber-400'
              : clockEnded
                ? 'bg-emerald-500/70'
                : goalFlash
                  ? 'bg-amber-400'
                  : isMine
                    ? 'bg-emerald-400'
                    : 'bg-sky-400/80'
          }`}
          style={{
            transform: `scaleX(${clockEnded ? 1 : barRatio})`,
            willChange: clockEnded ? 'auto' : 'transform',
          }}
        />
      </div>

      <div className="flex items-center justify-between gap-2 text-[9px] font-bold text-slate-500">
        <span className="truncate">{match.label}</span>
        <div className="flex shrink-0 items-center gap-1.5">
          {pkInProgress && (
            <span className="rounded bg-amber-400/20 border border-amber-400/50 px-1 py-px text-[8px] font-black tracking-wider text-amber-200 animate-pulse">
              승부차기
            </span>
          )}
          {goalFlash && !pkInProgress && (
            <span className="scoreboard-feed-in rounded bg-amber-400/20 border border-amber-400/50 px-1 py-px text-[8px] font-black tracking-wider text-amber-200">
              GOAL
            </span>
          )}
          <span
            className={`font-mono tabular-nums ${
              pkInProgress
                ? 'text-amber-300'
                : over
                  ? 'text-slate-400'
                  : 'text-rose-300'
            }`}
          >
            {clock}
          </span>
        </div>
      </div>

      <div className="mt-1 flex items-center gap-2">
        {renderSide(match.homeTeamId, home, 'left')}
        <div className="shrink-0 font-mono text-lg font-black text-white tabular-nums">
          <span
            key={!clockEnded && minute > 0 ? `h-${homeGoals}` : 'h-static'}
            className={!clockEnded && homeGoals > 0 ? 'scoreboard-score-pop' : undefined}
          >
            {homeGoals}
          </span>
          <span className="mx-1 text-slate-600">:</span>
          <span
            key={!clockEnded && minute > 0 ? `a-${awayGoals}` : 'a-static'}
            className={!clockEnded && awayGoals > 0 ? 'scoreboard-score-pop' : undefined}
          >
            {awayGoals}
          </span>
        </div>
        {renderSide(match.awayTeamId, away, 'right')}
      </div>

      {/* Live Penalty Shootout Kicker Board (runs as extra phase after 120') */}
      {showPkBox && match.penalties && (
        <div className="mt-2 rounded-lg border border-amber-400/30 bg-[#0b1018]/90 px-2 py-1.5 space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-[9px] font-extrabold">
            <span className="flex items-center gap-1 text-amber-200">
              승부차기
              {isSuddenDeath && (
                <span className="rounded bg-rose-500/25 border border-rose-400/45 px-1 py-px text-[8px] text-rose-200">
                  서든데스
                </span>
              )}
            </span>
            <span className="font-mono text-[11px] font-black text-amber-300 tabular-nums">
              PK {liveHomePen} : {liveAwayPen}
            </span>
          </div>

          {hasPkKicks && (
            <div className="space-y-1">
              {[
                {
                  teamId: match.homeTeamId,
                  shortName: home?.shortName ?? 'HOME',
                  kicks: homeKicks,
                },
                {
                  teamId: match.awayTeamId,
                  shortName: away?.shortName ?? 'AWAY',
                  kicks: awayKicks,
                },
              ].map((row) => (
                <div
                  key={row.teamId}
                  className="flex items-center justify-between gap-2 text-[9px]"
                >
                  <span
                    className={`w-10 shrink-0 truncate font-extrabold ${
                      row.teamId === myClubId ? 'text-emerald-300' : 'text-slate-400'
                    }`}
                  >
                    {row.shortName}
                  </span>
                  <div className="flex flex-1 flex-wrap items-center gap-1">
                    {Array.from({ length: pkSlotCount }, (_, idx) => {
                      const kick = row.kicks[idx];
                      const isSteppingUp =
                        !kick &&
                        nextKick?.teamId === row.teamId &&
                        idx === row.kicks.length;
                      if (kick) {
                        return (
                          <span
                            key={idx}
                            title={`${kick.round}번 키커 ${kick.kickerName} (${kick.scored ? '성공' : '실축'})`}
                            className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black transition-transform ${
                              kick.scored
                                ? 'bg-emerald-400 text-slate-950'
                                : 'bg-rose-500/85 text-white'
                            }`}
                          >
                            {kick.scored ? 'O' : 'X'}
                          </span>
                        );
                      }
                      return (
                        <span
                          key={idx}
                          className={`inline-flex h-4 w-4 items-center justify-center rounded-full border text-[8px] ${
                            isSteppingUp
                              ? 'border-amber-400 bg-amber-400/20 text-amber-200 animate-pulse'
                              : 'border-slate-700 bg-slate-900/70 text-slate-600'
                          }`}
                        >
                          {isSteppingUp ? '•' : ''}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {latestKick && (
            <div
              key={`pk-${latestKick.round}-${latestKick.teamId}-${latestKick.kickerName}`}
              className="scoreboard-feed-in flex items-center justify-between gap-1.5 border-t border-slate-800/80 pt-1 text-[10px] font-bold"
            >
              <span className="truncate text-slate-200">
                <span className="mr-1 font-mono text-[9px] text-slate-500">
                  R{latestKick.round}
                </span>
                <span className="mr-1 text-slate-400">{latestKick.teamShortName}</span>
                {latestKick.kickerName}
              </span>
              <span
                className={`shrink-0 rounded border px-1.5 py-px text-[9px] font-black ${
                  latestKick.scored
                    ? 'border-emerald-400/50 bg-emerald-500/20 text-emerald-200'
                    : 'border-rose-400/50 bg-rose-500/20 text-rose-200'
                }`}
              >
                {latestKick.scored ? '성공 ⚽' : '실축 ✕'}
              </span>
            </div>
          )}

          {!pkInProgress && pkWinnerClub && (
            <div className="text-center text-[9px] font-extrabold text-emerald-300">
              🏆 {pkWinnerClub.shortName} 승부차기 승 ({match.penalties.home}:
              {match.penalties.away})
            </div>
          )}
        </div>
      )}

      {feedItem && (
        <div
          key={`${feedItem.minute}-${feedItem.kind}-${feedItem.text}`}
          className={`scoreboard-feed-in mt-1.5 flex items-center gap-1 truncate text-[10px] font-bold ${FEED_TONE[feedItem.kind] ?? 'text-slate-300'}`}
        >
          <span className="shrink-0 font-mono tabular-nums text-slate-500">
            {feedItem.minute}&apos;
          </span>
          <span
            className={`shrink-0 rounded border px-1 py-px text-[8px] font-extrabold ${
              FEED_TAG_STYLE[feedItem.kind] ?? 'bg-slate-800 text-slate-300 border-slate-700'
            }`}
          >
            {FEED_TAG[feedItem.kind] ?? feedItem.kind}
          </span>
          <span className="truncate">{feedItem.text}</span>
        </div>
      )}

      {over && shownCount > 0 && (
        <div className="mt-1.5 truncate text-[9px] font-bold text-slate-400">
          {sortedGoals
            .slice(0, shownCount)
            .map((g) => `${g.scorer || '골'} ${g.minute}'`)
            .join(' · ')}
        </div>
      )}

      {over && isMine && match.stats && (
        <div className="mt-1 flex justify-between gap-2 text-[9px] font-bold text-slate-500 tabular-nums">
          <span>
            점유 {Math.round(match.stats.homePossession)}:
            {100 - Math.round(match.stats.homePossession)}
          </span>
          <span>
            슈팅 {match.stats.homeShots}:{match.stats.awayShots}
          </span>
          <span>
            xG {match.stats.homeXg.toFixed(1)}:{match.stats.awayXg.toFixed(1)}
          </span>
        </div>
      )}
    </div>
  );
});

const TickerInner = memo(function TickerInner({
  ticker,
  clubsById,
  humans,
  myClubId,
  durationMs,
  onDone,
}: MpLiveTickerProps) {
  const alreadyPlayed = playedKeys.has(ticker.key);
  const needsReplay = ticker.matches.some((m) => !m.instant);
  const lastMinute = ticker.matches.some((m) => m.extraTime && !m.instant) ? 120 : 90;
  const maxPkKicks = useMemo(
    () =>
      ticker.matches.reduce(
        (max, m) => Math.max(max, m.instant ? 0 : (m.penalties?.kicks?.length ?? 0)),
        0,
      ),
    [ticker.matches],
  );
  const [minute, setMinute] = useState<number>(alreadyPlayed || !needsReplay ? lastMinute : 0);
  const [revealedPenKicks, setRevealedPenKicks] = useState<number>(
    alreadyPlayed || !needsReplay ? maxPkKicks : 0,
  );
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  // Direct DOM progress bar refs per match key (smooth 60fps without React re-renders)
  const barElsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const progressMinRef = useRef<number>(alreadyPlayed || !needsReplay ? lastMinute : 0);
  const durationRef = useRef<number>(durationMs);
  useEffect(() => {
    durationRef.current = durationMs;
  }, [durationMs]);

  const humanByClub = useMemo(() => {
    const map: Record<string, MpLeagueHuman> = {};
    for (const h of humans) map[h.clubId] = h;
    return map;
  }, [humans]);

  const ordered = useMemo(
    () =>
      [...ticker.matches].sort(
        (a, b) =>
          Number(Boolean(myClubId && b.humanClubIds.includes(myClubId))) -
          Number(Boolean(myClubId && a.humanClubIds.includes(myClubId))),
      ),
    [ticker.matches, myClubId],
  );

  // Phase 1: Smooth rAF clock 0' → 90' (or 120' for ET)
  useEffect(() => {
    if (alreadyPlayed || !needsReplay) {
      if (!doneRef.current) {
        doneRef.current = true;
        playedKeys.add(ticker.key);
        const t = window.setTimeout(() => onDoneRef.current(ticker.key), 0);
        return () => window.clearTimeout(t);
      }
      return;
    }

    let rafId = 0;
    let doneTimer = 0;
    let lastTs = performance.now();
    let lastCommittedInt = Math.floor(progressMinRef.current);

    const step = (now: number) => {
      const dt = Math.min(100, Math.max(0, now - lastTs));
      lastTs = now;
      const safeDuration = Math.max(2000, durationRef.current);
      const nextFloat = Math.min(
        lastMinute,
        progressMinRef.current + (dt / safeDuration) * 90,
      );
      progressMinRef.current = nextFloat;

      for (const m of ordered) {
        if (m.instant) continue;
        const el = barElsRef.current.get(m.key);
        if (el) {
          const maxM = endMinuteOfCastMatch(m);
          const ratio = Math.min(1, nextFloat / maxM);
          el.style.transform = `scaleX(${ratio})`;
        }
      }

      const nextInt = Math.floor(nextFloat);
      if (nextInt !== lastCommittedInt) {
        lastCommittedInt = nextInt;
        setMinute(nextInt);
      }

      if (nextFloat >= lastMinute) {
        if (lastCommittedInt !== lastMinute) {
          lastCommittedInt = lastMinute;
          setMinute(lastMinute);
        }
        // Only finish right here if there are NO penalty kicks to reveal afterwards
        if (maxPkKicks === 0 && !doneRef.current) {
          doneRef.current = true;
          playedKeys.add(ticker.key);
          doneTimer = window.setTimeout(() => onDoneRef.current(ticker.key), 360);
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
  }, [alreadyPlayed, needsReplay, lastMinute, maxPkKicks, ticker.key, ordered]);

  // Phase 2 (Extra time on top of configured seconds): sequential PK kicker reveal
  useEffect(() => {
    if (alreadyPlayed || !needsReplay || maxPkKicks === 0) return;
    if (minute < lastMinute || doneRef.current) return;

    if (revealedPenKicks >= maxPkKicks) {
      doneRef.current = true;
      playedKeys.add(ticker.key);
      const t = window.setTimeout(() => onDoneRef.current(ticker.key), 750);
      return () => window.clearTimeout(t);
    }

    const t = window.setTimeout(() => {
      setRevealedPenKicks((prev) => Math.min(maxPkKicks, prev + 1));
    }, LIVE_PK_KICK_INTERVAL_MS);
    return () => window.clearTimeout(t);
  }, [
    alreadyPlayed,
    needsReplay,
    maxPkKicks,
    minute,
    lastMinute,
    revealedPenKicks,
    ticker.key,
  ]);

  const finished = minute >= lastMinute && revealedPenKicks >= maxPkKicks;
  const count = ordered.length;
  if (count === 0) return null;

  return (
    <div
      className={`grid gap-2 ${
        count >= 4
          ? 'grid-cols-2 lg:grid-cols-4'
          : count === 3
            ? 'grid-cols-1 sm:grid-cols-3'
            : count === 2
              ? 'grid-cols-1 sm:grid-cols-2'
              : 'grid-cols-1 sm:max-w-md'
      }`}
    >
      {ordered.map((m) => (
        <LiveTickerMatchCard
          key={m.key}
          match={m}
          minute={minute}
          finished={finished}
          revealedPenKicks={revealedPenKicks}
          clubsById={clubsById}
          humanByClub={humanByClub}
          myClubId={myClubId}
          barRef={(el) => {
            if (el) barElsRef.current.set(m.key, el);
            else barElsRef.current.delete(m.key);
          }}
        />
      ))}
    </div>
  );
});

export function MpLiveTicker(props: MpLiveTickerProps) {
  return <TickerInner key={props.ticker.key} {...props} />;
}
