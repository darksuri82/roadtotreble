import { Trophy } from 'lucide-react';
import type { Club, StandingRow } from '../../types/league';
import { JerseySvg } from '../common/JerseySvg';

interface StandingsTableProps {
  standings: StandingRow[];
  clubsById: Record<string, Club>;
  uclSpots?: number;
  relegationSpots?: number;
  onSelectClub?: (clubId: string) => void;
}

export function StandingsTable({
  standings,
  clubsById,
  uclSpots = 4,
  relegationSpots = 3,
  onSelectClub,
}: StandingsTableProps) {
  const totalTeams = standings.length;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#101822] shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-extrabold text-white">리그 순위표</h2>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-semibold">
          <span className="flex items-center gap-1.5 text-emerald-300">
            <span className="h-2.5 w-1 rounded-full bg-emerald-400" />
            1~{uclSpots}위 챔피언스리그 진출권
          </span>
          <span className="hidden sm:flex items-center gap-1.5 text-rose-400">
            <span className="h-2.5 w-1 rounded-full bg-rose-500" />
            강등권
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-[11px] sm:text-xs">
          <thead>
            <tr className="border-b border-slate-800/80 bg-slate-950/50 text-[10px] sm:text-[11px] font-bold text-slate-400">
              <th className="py-1.5 sm:py-2.5 pl-2 sm:pl-3 pr-1 sm:pr-2 w-8 sm:w-10 text-center">#</th>
              <th className="py-1.5 sm:py-2.5 px-1.5 sm:px-2">구단</th>
              <th className="py-1.5 sm:py-2.5 px-1 sm:px-1.5 text-center">경기</th>
              <th className="py-1.5 sm:py-2.5 px-1 sm:px-1.5 text-center">승</th>
              <th className="py-1.5 sm:py-2.5 px-1 sm:px-1.5 text-center">무</th>
              <th className="py-1.5 sm:py-2.5 px-1 sm:px-1.5 text-center">패</th>
              <th className="py-1.5 sm:py-2.5 px-1.5 text-center hidden sm:table-cell">득</th>
              <th className="py-1.5 sm:py-2.5 px-1.5 text-center hidden sm:table-cell">실</th>
              <th className="py-1.5 sm:py-2.5 px-1 sm:px-1.5 text-center">득실</th>
              <th className="py-1.5 sm:py-2.5 px-1.5 sm:px-2 text-center text-white">승점</th>
              <th className="py-1.5 sm:py-2.5 pr-3 pl-2 text-right hidden md:table-cell">최근</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {standings.map((row, idx) => {
              const rank = idx + 1;
              const isUcl = rank <= uclSpots;
              const isRelegation = rank > totalTeams - relegationSpots;
              const club = clubsById[row.teamId];

              return (
                <tr
                  key={row.teamId}
                  onClick={onSelectClub ? () => onSelectClub(row.teamId) : undefined}
                  className={`relative transition-colors ${
                    onSelectClub ? 'cursor-pointer' : ''
                  } ${
                    row.isUser
                      ? 'bg-emerald-500/15 hover:bg-emerald-500/20'
                      : isUcl
                        ? 'bg-emerald-950/15 hover:bg-slate-800/40'
                        : 'hover:bg-slate-800/35'
                  }`}
                >
                  <td className="relative py-1 sm:py-2 pl-2 sm:pl-3 pr-1 sm:pr-2 text-center font-display text-xs sm:text-sm font-bold">
                    {isUcl && (
                      <span className="absolute inset-y-0.5 left-0 w-1 rounded-r bg-emerald-400" />
                    )}
                    {isRelegation && (
                      <span className="absolute inset-y-0.5 left-0 w-1 rounded-r bg-rose-500/80" />
                    )}
                    <span
                      className={
                        isUcl
                          ? 'text-emerald-300'
                          : isRelegation
                            ? 'text-rose-400'
                            : 'text-slate-400'
                      }
                    >
                      {rank}
                    </span>
                  </td>

                  <td className="py-1 sm:py-2 px-1.5 sm:px-2">
                    <div className="flex items-center gap-1.5 sm:gap-2 min-w-[110px] sm:min-w-[130px]">
                      <JerseySvg
                        primaryColor={row.primaryColor}
                        secondaryColor={row.secondaryColor}
                        pattern={club?.pattern}
                        size={18}
                      />
                      <span
                        className={`truncate ${
                          row.isUser
                            ? 'font-extrabold text-white'
                            : 'font-semibold text-slate-200'
                        } ${onSelectClub ? 'hover:text-emerald-300 hover:underline' : ''}`}
                      >
                        {row.teamName}
                      </span>
                      {row.isUser && (
                        <span className="rounded border border-emerald-500/40 bg-emerald-500/18 px-1 py-px text-[8px] sm:text-[9px] font-bold text-emerald-300 shrink-0">
                          MY
                        </span>
                      )}
                      {isUcl && rank === 1 && row.played > 0 && (
                        <span className="hidden sm:inline rounded bg-amber-400/20 px-1 py-0.5 text-[9px] font-bold text-amber-300 border border-amber-400/30">
                          1위
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="py-1 sm:py-2 px-1 sm:px-1.5 text-center text-slate-300">
                    {row.played}
                  </td>
                  <td className="py-1 sm:py-2 px-1 sm:px-1.5 text-center text-slate-300">
                    {row.won}
                  </td>
                  <td className="py-1 sm:py-2 px-1 sm:px-1.5 text-center text-slate-400">
                    {row.drawn}
                  </td>
                  <td className="py-1 sm:py-2 px-1 sm:px-1.5 text-center text-slate-400">
                    {row.lost}
                  </td>
                  <td className="py-1 sm:py-2 px-1.5 text-center text-slate-400 hidden sm:table-cell">
                    {row.goalsFor}
                  </td>
                  <td className="py-1 sm:py-2 px-1.5 text-center text-slate-400 hidden sm:table-cell">
                    {row.goalsAgainst}
                  </td>
                  <td
                    className={`py-2 px-1.5 text-center font-semibold ${
                      row.goalDifference > 0
                        ? 'text-emerald-400'
                        : row.goalDifference < 0
                          ? 'text-rose-400'
                          : 'text-slate-400'
                    }`}
                  >
                    {row.goalDifference > 0
                      ? `+${row.goalDifference}`
                      : row.goalDifference}
                  </td>
                  <td className="py-2 px-2 text-center font-display text-base font-bold text-white">
                    {row.points}
                  </td>
                  <td className="py-2 pr-3 pl-2 hidden md:table-cell">
                    <div className="flex items-center justify-end gap-1">
                      {row.form.length === 0 ? (
                        <span className="text-slate-600">-</span>
                      ) : (
                        row.form.map((f, fIdx) => (
                          <span
                            key={fIdx}
                            className={`flex h-4 w-4 items-center justify-center rounded text-[9px] font-extrabold ${
                              f === 'W'
                                ? 'bg-emerald-500/25 text-emerald-300'
                                : f === 'D'
                                  ? 'bg-slate-700 text-slate-300'
                                  : 'bg-rose-500/25 text-rose-300'
                            }`}
                          >
                            {f}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
