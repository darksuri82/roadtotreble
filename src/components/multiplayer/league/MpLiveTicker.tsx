import { memo, useEffect, useRef, useState } from 'react';
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
  /** Real time for 1' → 90' */
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

function endMinute(m: MpCastMatch): number {
  return m.extraTime ? 120 : 90;
}

function MatchCard({
  match,
  minute,
  finished,
  clubsById,
  humans,
  myClubId,
}: {
  match: MpCastMatch;
  minute: number;
  finished: boolean;
  clubsById: Record<string, Club>;
  humans: MpLeagueHuman[];
  myClubId: string | null;
}) {
  const over = finished || match.instant || minute >= endMinute(match);
  const shown = over ? match.goals : match.goals.filter((g) => g.minute <= minute);
  const homeGoals = shown.filter((g) => g.teamId === match.homeTeamId).length;
  const awayGoals = shown.filter((g) => g.teamId === match.awayTeamId).length;
  const lastGoal = shown.length > 0 ? shown[shown.length - 1] : null;
  const flash = !over && lastGoal !== null && minute - lastGoal.minute <= 3;
  const isMine = Boolean(myClubId && match.humanClubIds.includes(myClubId));
  const home = clubsById[match.homeTeamId];
  const away = clubsById[match.awayTeamId];
  const friendOf = (clubId: string) => humans.find((h) => h.clubId === clubId) ?? null;
  const feedItem =
    isMine && !over
      ? [...(match.feed ?? [])].reverse().find((f) => f.minute <= minute) ?? null
      : null;
  const clock = match.instant
    ? 'FT'
    : over
      ? match.penalties
        ? 'PK'
        : match.extraTime
          ? 'AET'
          : 'FT'
      : `${Math.min(minute, endMinute(match))}'`;

  const side = (clubId: string, club: Club | undefined, align: 'left' | 'right') => {
    const friend = friendOf(clubId);
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
          size={18}
        />
        <div className="min-w-0 leading-tight">
          <div
            className={`truncate text-[11px] font-extrabold ${
              friend ? 'text-white' : 'text-slate-300'
            }`}
          >
            {club?.shortName ?? '-'}
          </div>
          {friend && (
            <div className="truncate text-[9px] font-bold text-emerald-300">
              {friend.clubId === myClubId ? '나' : friend.nickname}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      className={`rounded-xl border px-2.5 py-1.5 transition-colors duration-300 ${
        flash
          ? 'border-amber-400/70 bg-amber-500/15'
          : isMine
            ? 'border-emerald-500/40 bg-[#0e1722]'
            : 'border-slate-800/90 bg-[#0d131c]'
      }`}
    >
      <div className="flex items-center justify-between gap-2 text-[9px] font-bold text-slate-500">
        <span className="truncate">{match.label}</span>
        <span
          className={`shrink-0 font-mono tabular-nums ${over ? 'text-slate-400' : 'text-rose-300'}`}
        >
          {clock}
        </span>
      </div>
      <div className="mt-0.5 flex items-center gap-2">
        {side(match.homeTeamId, home, 'left')}
        <div className="shrink-0 font-mono text-lg font-black text-white tabular-nums">
          {homeGoals}
          <span className="mx-1 text-slate-600">:</span>
          {awayGoals}
        </div>
        {side(match.awayTeamId, away, 'right')}
      </div>
      {over && match.penalties && (
        <div className="text-center text-[9px] font-bold text-amber-300 tabular-nums">
          PK {match.penalties.home}–{match.penalties.away}
        </div>
      )}
      {feedItem && (
        <div className={`mt-1 truncate text-[10px] font-bold ${FEED_TONE[feedItem.kind]}`}>
          <span className="mr-1 font-mono tabular-nums text-slate-500">{feedItem.minute}&apos;</span>
          <span className="mr-1 rounded bg-slate-800 px-1 text-[9px]">{FEED_TAG[feedItem.kind]}</span>
          {feedItem.text}
        </div>
      )}
      {over && shown.length > 0 && (
        <div className="mt-1 truncate text-[9px] font-bold text-slate-400">
          {shown
            .map((g) => `${g.scorer || '골'} ${g.minute}'`)
            .join(' · ')}
        </div>
      )}
      {over && isMine && match.stats && (
        <div className="mt-1 flex justify-between gap-2 text-[9px] font-bold text-slate-500 tabular-nums">
          <span>
            점유 {Math.round(match.stats.homePossession)}:{100 - Math.round(match.stats.homePossession)}
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
}

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

  useEffect(() => {
    if (alreadyPlayed || !needsReplay) {
      if (!doneRef.current) {
        doneRef.current = true;
        playedKeys.add(ticker.key);
        const t = window.setTimeout(() => onDone(ticker.key), 0);
        return () => window.clearTimeout(t);
      }
      return;
    }
    const stepMs = Math.max(24, Math.round(durationMs / 90));
    const interval = window.setInterval(() => {
      setMinute((prev) => {
        const next = prev + 1;
        if (next >= lastMinute) {
          window.clearInterval(interval);
          if (!doneRef.current) {
            doneRef.current = true;
            playedKeys.add(ticker.key);
            window.setTimeout(() => onDone(ticker.key), 350);
          }
          return lastMinute;
        }
        return next;
      });
    }, stepMs);
    return () => window.clearInterval(interval);
  }, [alreadyPlayed, needsReplay, durationMs, lastMinute, ticker.key, onDone]);

  const finished = minute >= lastMinute;
  const count = ticker.matches.length;
  if (count === 0) return null;
  // My match first so its key moments are always in the same place
  const ordered = [...ticker.matches].sort(
    (a, b) =>
      Number(Boolean(myClubId && b.humanClubIds.includes(myClubId))) -
      Number(Boolean(myClubId && a.humanClubIds.includes(myClubId))),
  );

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
        <MatchCard
          key={m.key}
          match={m}
          minute={minute}
          finished={finished}
          clubsById={clubsById}
          humans={humans}
          myClubId={myClubId}
        />
      ))}
    </div>
  );
});

/** Compact live scoreboard of the friends' matches for the round that was just simulated. */
export function MpLiveTicker(props: MpLiveTickerProps) {
  return <TickerInner key={props.ticker.key} {...props} />;
}
