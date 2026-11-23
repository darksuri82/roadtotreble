import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { Club } from '../../../types/league';
import type { MpCastLive, MpCastMatch, MpLeagueHuman } from '../../../types/mpLeague';
import { JerseySvg } from '../../common/JerseySvg';

/** Scoreboards that already finished replaying in this tab (never replay after a remount). */
const playedKeys = new Set<string>();

export function isMpTickerPlayed(key: string | null | undefined): boolean {
  return !key || playedKeys.has(key);
}

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
  barRef,
  initialRatio,
  alwaysShowFeed = false,
}: LiveTickerMatchCardProps) {
  const maxMin = endMinuteOfCastMatch(match);
  const over = finished || Boolean(match.instant) || minute >= maxMin;
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
    if (!over && g.minute > minute) break;
    shownCount += 1;
    lastGoal = g;
    if (g.teamId === match.homeTeamId) homeGoals += 1;
    else if (g.teamId === match.awayTeamId) awayGoals += 1;
  }
  if (over) {
    homeGoals = match.homeGoals;
    awayGoals = match.awayGoals;
  }

  let feedItem: (typeof sortedFeed)[number] | null = null;
  if (isMine && !over && sortedFeed.length > 0) {
    for (let i = sortedFeed.length - 1; i >= 0; i -= 1) {
      if (sortedFeed[i].minute <= minute) {
        feedItem = sortedFeed[i];
        break;
      }
    }
  }

  const goalFlash =
    !over && !match.instant && lastGoal !== null && minute - lastGoal.minute <= 3;
  const home = clubsById[match.homeTeamId];
  const away = clubsById[match.awayTeamId];
  const clock = match.instant
    ? 'FT'
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

  const fallbackRatio = over ? 1 : Math.min(1, Math.max(0, minute / maxMin));
  const barRatio = initialRatio !== undefined ? initialRatio : fallbackRatio;

  return (
    <div
      className={`relative overflow-hidden rounded-xl border px-2.5 py-2 transition-colors duration-300 ${
        goalFlash
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
            over
              ? 'bg-emerald-500/70'
              : goalFlash
                ? 'bg-amber-400'
                : isMine
                  ? 'bg-emerald-400'
                  : 'bg-sky-400/80'
          }`}
          style={{
            transform: `scaleX(${over ? 1 : barRatio})`,
            willChange: over ? 'auto' : 'transform',
          }}
        />
      </div>

      <div className="flex items-center justify-between gap-2 text-[9px] font-bold text-slate-500">
        <span className="truncate">{match.label}</span>
        <div className="flex shrink-0 items-center gap-1.5">
          {goalFlash && (
            <span className="scoreboard-feed-in rounded bg-amber-400/20 border border-amber-400/50 px-1 py-px text-[8px] font-black tracking-wider text-amber-200">
              GOAL
            </span>
          )}
          <span
            className={`font-mono tabular-nums ${
              over ? 'text-slate-400' : 'text-rose-300'
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
            key={!over && minute > 0 ? `h-${homeGoals}` : 'h-static'}
            className={!over && homeGoals > 0 ? 'scoreboard-score-pop' : undefined}
          >
            {homeGoals}
          </span>
          <span className="mx-1 text-slate-600">:</span>
          <span
            key={!over && minute > 0 ? `a-${awayGoals}` : 'a-static'}
            className={!over && awayGoals > 0 ? 'scoreboard-score-pop' : undefined}
          >
            {awayGoals}
          </span>
        </div>
        {renderSide(match.awayTeamId, away, 'right')}
      </div>

      {over && match.penalties && (
        <div className="text-center text-[9px] font-bold text-amber-300 tabular-nums">
          PK {match.penalties.home}–{match.penalties.away}
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
  const [minute, setMinute] = useState<number>(alreadyPlayed || !needsReplay ? lastMinute : 0);
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
      // Clamp frame delta to prevent giant jumps on background tab resume while still keeping steady pace
      const dt = Math.min(100, Math.max(0, now - lastTs));
      lastTs = now;
      const safeDuration = Math.max(2000, durationRef.current);
      const nextFloat = Math.min(
        lastMinute,
        progressMinRef.current + (dt / safeDuration) * 90,
      );
      progressMinRef.current = nextFloat;

      // Update every active card's progress strip directly at 60fps
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
        if (!doneRef.current) {
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
  }, [alreadyPlayed, needsReplay, lastMinute, ticker.key, ordered]);

  const finished = minute >= lastMinute;
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
