import { memo, useMemo, useState } from 'react';
import type { StandingRow } from '../../types/league';
import { uclZoneOf } from '../multiplayer/league/MpUclSidePanel';

export interface CompactLiveStandingsProps {
  title: string;
  standings: StandingRow[];
  myClubId: string;
  variant: 'league' | 'ucl';
  uclSpots?: number;
  relegationSpots?: number;
  roundLabel?: string;
  /** Default view mode: 'focus' shows key zones + my club neighbors (~7-9 rows) for zero-scroll mobile viewing. */
  defaultMode?: 'focus' | 'all';
  onSelectClub?: (teamId: string) => void;
  onOpenFullModal?: () => void;
}

/** Computes focused row indices (top zone + my club ± 1 + cutline) so live standings fit cleanly on mobile & desktop. */
export function computeFocusedStandingIndices(
  standings: StandingRow[],
  myClubId: string,
  variant: 'league' | 'ucl',
  uclSpots = 4,
): number[] {
  const n = standings.length;
  if (n <= 10) return standings.map((_, i) => i);

  const picked = new Set<number>();
  const myIdx = standings.findIndex((r) => r.teamId === myClubId);

  if (variant === 'ucl') {
    // Top 8 (direct R16) or Top 6 if user is outside top 8 to keep mobile ultra-compact
    const topCount = myIdx >= 0 && myIdx < 8 ? Math.min(8, n) : Math.min(5, n);
    for (let i = 0; i < topCount; i += 1) picked.add(i);
    // Direct R16 cutline (8th / 9th)
    if (n >= 9) {
      picked.add(7);
      picked.add(8);
    }
    if (myIdx >= 0) {
      if (myIdx > 0) picked.add(myIdx - 1);
      picked.add(myIdx);
      if (myIdx + 1 < n) picked.add(myIdx + 1);
    }
    // Playoff cutline (24th / 25th) when user is outside top 8
    if (myIdx >= 8 && n >= 25) {
      picked.add(23);
      picked.add(24);
    }
  } else {
    // League: top UCL spots (min 4, max 5) + my club ± 1
    const topCount = Math.min(Math.max(4, uclSpots), n);
    for (let i = 0; i < topCount; i += 1) picked.add(i);
    if (myIdx >= 0) {
      if (myIdx > 0) picked.add(myIdx - 1);
      picked.add(myIdx);
      if (myIdx + 1 < n) picked.add(myIdx + 1);
    }
  }

  return Array.from(picked).sort((a, b) => a - b);
}

/** Compact real-time standings widget (PC & Mobile) displaying Played / W / D / L / GD / PTS. */
export const CompactLiveStandings = memo(function CompactLiveStandings({
  title,
  standings,
  myClubId,
  variant,
  uclSpots = 4,
  relegationSpots = 3,
  roundLabel,
  defaultMode = 'focus',
  onSelectClub,
  onOpenFullModal,
}: CompactLiveStandingsProps) {
  const [mode, setMode] = useState<'focus' | 'all'>(defaultMode);

  const visibleIndices = useMemo<number[]>(() => {
    if (mode === 'all') return standings.map((_, i) => i);
    return computeFocusedStandingIndices(standings, myClubId, variant, uclSpots);
  }, [mode, standings, myClubId, variant, uclSpots]);

  if (standings.length === 0) return null;

  const isUcl = variant === 'ucl';
  const relegationStart = standings.length - relegationSpots;

  return (
    <div
      className={`rounded-xl border overflow-hidden shadow-md ${
        isUcl
          ? 'border-sky-500/30 bg-[#0b1324]'
          : 'border-slate-800/90 bg-[#0d131c]'
      }`}
    >
      {/* Header */}
      <div
        className={`flex items-center justify-between gap-2 border-b px-2.5 py-1.5 text-[10px] ${
          isUcl
            ? 'border-sky-500/20 bg-[#08101f]'
            : 'border-slate-800/80 bg-[#0b1018]'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
              isUcl ? 'bg-sky-400' : 'bg-emerald-400'
            }`}
          />
          <span
            className={`font-extrabold truncate ${
              isUcl ? 'text-sky-100' : 'text-slate-100'
            }`}
          >
            {title}
          </span>
          {roundLabel && (
            <span className="shrink-0 font-mono text-[9px] font-bold text-slate-400 tabular-nums">
              {roundLabel}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {onOpenFullModal && (
            <button
              type="button"
              onClick={onOpenFullModal}
              className="text-[9px] font-bold text-sky-400 hover:text-sky-300 cursor-pointer"
            >
              팝업↗
            </button>
          )}
          <div
            className={`inline-flex rounded-md border p-0.5 text-[9px] ${
              isUcl
                ? 'border-sky-500/25 bg-[#0c162b]'
                : 'border-slate-800 bg-[#090d14]'
            }`}
          >
            <button
              type="button"
              onClick={() => setMode('focus')}
              className={`rounded px-1.5 py-0.5 font-bold cursor-pointer transition-colors ${
                mode === 'focus'
                  ? isUcl
                    ? 'bg-sky-500/25 text-sky-200'
                    : 'bg-emerald-500/20 text-emerald-200'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              핵심
            </button>
            <button
              type="button"
              onClick={() => setMode('all')}
              className={`rounded px-1.5 py-0.5 font-bold cursor-pointer transition-colors ${
                mode === 'all'
                  ? isUcl
                    ? 'bg-sky-500/25 text-sky-200'
                    : 'bg-emerald-500/20 text-emerald-200'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              전체 {standings.length}
            </button>
          </div>
        </div>
      </div>

      {/* Cutline Legend */}
      <div
        className={`flex items-center justify-between border-b px-2.5 py-1 text-[9px] text-slate-400 ${
          isUcl
            ? 'border-slate-800/80 bg-[#091120]'
            : 'border-slate-800/70 bg-[#0a0f17]'
        }`}
      >
        {isUcl ? (
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              1~8 16강
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              9~24 PO
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
              25~36 탈락
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
              UCL (1~{uclSpots})
            </span>
            {relegationSpots > 0 && (
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                강등
              </span>
            )}
          </div>
        )}
      </div>

      {/* Table Columns: # | 구단 | 경 | 승 | 무 | 패 | 득실 | 승점 */}
      <div className="grid grid-cols-[18px_minmax(0,1fr)_20px_18px_18px_18px_24px_24px] items-center gap-0.5 sm:gap-1 border-b border-slate-800/80 px-2 py-1 text-[9px] font-bold text-slate-500">
        <span>#</span>
        <span>구단</span>
        <span className="text-center">경</span>
        <span className="text-center text-emerald-400/80">승</span>
        <span className="text-center">무</span>
        <span className="text-center text-rose-400/80">패</span>
        <span className="text-center">득실</span>
        <span className="text-center text-slate-300">승점</span>
      </div>

      {/* Rows */}
      <div>
        {visibleIndices.map((idx, pos) => {
          const r = standings[idx];
          const prevIdx = pos > 0 ? visibleIndices[pos - 1] : -1;
          const showGap = pos > 0 && idx - prevIdx > 1;
          const isMine = r.teamId === myClubId;
          const rankCls = isUcl
            ? uclZoneOf(idx + 1).rankCls
            : idx < uclSpots
              ? 'text-sky-300'
              : relegationSpots > 0 && idx >= relegationStart
                ? 'text-rose-300/85'
                : 'text-slate-500';
          const cutBorder = isUcl
            ? idx === 7
              ? 'border-b border-emerald-400/45'
              : idx === 23
                ? 'border-b border-amber-400/45'
                : 'border-b border-slate-800/35 last:border-b-0'
            : idx === uclSpots - 1
              ? 'border-b border-sky-400/35'
              : relegationSpots > 0 && idx === relegationStart - 1
                ? 'border-b border-rose-400/35'
                : 'border-b border-slate-800/35 last:border-b-0';

          const rowContent = (
            <>
              <span className={`font-mono font-bold ${rankCls}`}>{idx + 1}</span>
              <span className="flex items-center gap-1 min-w-0">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: r.primaryColor }}
                />
                <span
                  className={`truncate font-bold ${
                    isMine ? 'text-white' : 'text-slate-300'
                  }`}
                >
                  {r.teamName}
                </span>
                {isMine && (
                  <span className="shrink-0 rounded bg-emerald-400 px-1 text-[7px] font-black leading-tight text-slate-950">
                    MY
                  </span>
                )}
              </span>
              <span className="text-center text-slate-500">{r.played}</span>
              <span className="text-center font-semibold text-emerald-300/90">
                {r.won}
              </span>
              <span className="text-center text-slate-400">{r.drawn}</span>
              <span className="text-center text-rose-300/80">{r.lost}</span>
              <span className="text-center text-slate-400">
                {r.goalDifference > 0 ? `+${r.goalDifference}` : r.goalDifference}
              </span>
              <span className="text-center font-black text-white">{r.points}</span>
            </>
          );

          return (
            <div key={r.teamId}>
              {showGap && (
                <div
                  className={`border-b border-slate-800/45 py-0.5 text-center text-[9px] font-bold tracking-widest text-slate-600 ${
                    isUcl ? 'bg-[#080f1d]' : 'bg-[#090d14]'
                  }`}
                >
                  ···
                </div>
              )}
              {onSelectClub ? (
                <button
                  type="button"
                  onClick={() => onSelectClub(r.teamId)}
                  className={`grid w-full grid-cols-[18px_minmax(0,1fr)_20px_18px_18px_18px_24px_24px] items-center gap-0.5 sm:gap-1 px-2 py-[3.5px] text-left text-[10px] tabular-nums transition-colors cursor-pointer ${
                    isMine
                      ? 'bg-emerald-500/16 hover:bg-emerald-500/22'
                      : 'hover:bg-slate-800/40'
                  } ${cutBorder}`}
                >
                  {rowContent}
                </button>
              ) : (
                <div
                  className={`grid grid-cols-[18px_minmax(0,1fr)_20px_18px_18px_18px_24px_24px] items-center gap-0.5 sm:gap-1 px-2 py-[3.5px] text-[10px] tabular-nums ${
                    isMine ? 'bg-emerald-500/16' : ''
                  } ${cutBorder}`}
                >
                  {rowContent}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
