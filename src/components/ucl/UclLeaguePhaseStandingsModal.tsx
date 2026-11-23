import {
  CheckCircle2,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react';
import { Fragment } from 'react';
import { USER_CLUB_ID } from '../../engine/matchEngine';
import { getUserRank } from '../../engine/standingsEngine';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import type { Club } from '../../types/league';
import type { UclTeamEntry, UclTournamentState } from '../../types/ucl';
import { JerseySvg } from '../common/JerseySvg';

interface UclLeaguePhaseStandingsModalProps {
  ucl: UclTournamentState;
  clubsById: Record<string, Club>;
  teamEntryById: Record<string, UclTeamEntry>;
  onInspectClub?: (club: Club) => void;
  onGoToBracket?: () => void;
  onClose: () => void;
}

export function UclLeaguePhaseStandingsModal({
  ucl,
  clubsById,
  teamEntryById,
  onInspectClub,
  onGoToBracket,
  onClose,
}: UclLeaguePhaseStandingsModalProps) {
  useBodyScrollLock(true);
  const userRank =
    ucl.userLeaguePhaseRank ?? getUserRank(ucl.standings, USER_CLUB_ID);
  const userRow = ucl.standings.find((r) => r.teamId === USER_CLUB_ID);
  const userClub = clubsById[USER_CLUB_ID];
  const isCompleted = ucl.leaguePhaseRound >= 8;

  const zoneMeta =
    userRank <= 8
      ? {
          badge: '1~8위 · 16강 직행 확정!',
          desc: '플레이오프 면제 · 16강 토너먼트 시드 배정',
          borderCls: 'border-emerald-500/45 bg-emerald-950/25',
          badgeCls:
            'border-emerald-400/50 bg-emerald-500/20 text-emerald-300',
        }
      : userRank <= 24
        ? {
            badge: '9~24위 · 16강 플레이오프 진출',
            desc: '홈·원정 2차전 플레이오프 승리 시 16강 합류',
            borderCls: 'border-amber-500/45 bg-amber-950/20',
            badgeCls: 'border-amber-400/50 bg-amber-500/20 text-amber-300',
          }
        : {
            badge: '25~36위 · 리그 페이즈 탈락',
            desc: '아쉽게 토너먼트 진출에 실패했습니다',
            borderCls: 'border-rose-500/45 bg-rose-950/20',
            badgeCls: 'border-rose-400/50 bg-rose-500/20 text-rose-300',
          };

  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-2.5 sm:p-4">
      <div className="modal-panel flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-[#0d1422] shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-800 bg-[#090e18] px-4 py-3.5 sm:px-5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-sky-400/35 bg-sky-500/15 text-sky-300">
              <Trophy className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="rounded bg-sky-500/15 px-2 py-0.5 text-[10px] font-extrabold text-sky-300">
                  UCL SWISS LEAGUE PHASE
                </span>
                <span className="font-mono text-xs font-bold text-slate-400">
                  {ucl.leaguePhaseRound} / 8R {isCompleted ? '최종 순위' : '진행 현황'}
                </span>
              </div>
              <h2 className="truncate text-sm sm:text-base font-black text-white">
                챔피언스리그 36팀 리그 페이즈 순위표
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-800 bg-[#111822] p-1.5 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* User Club Result Summary Banner */}
        {userRow && (
          <div className="px-4 pt-3.5 sm:px-5">
            <div
              className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5 ${zoneMeta.borderCls}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                {userClub && (
                  <JerseySvg
                    primaryColor={userClub.primaryColor}
                    secondaryColor={userClub.secondaryColor}
                    pattern={userClub.pattern}
                    label={userClub.shortName}
                    size={36}
                  />
                )}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm sm:text-base font-black text-white">
                      {userRow.teamName}
                    </span>
                    <span
                      className={`rounded-md border px-2 py-0.5 text-[11px] font-extrabold ${zoneMeta.badgeCls}`}
                    >
                      {zoneMeta.badge}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-slate-300 tabular-nums">
                    {isCompleted ? '최종' : '현재'}{' '}
                    <strong className="text-sky-300">{userRank}위 / 36팀</strong> ·{' '}
                    {userRow.played}전 {userRow.won}승 {userRow.drawn}무{' '}
                    {userRow.lost}패 · 승점{' '}
                    <strong className="text-white">{userRow.points}점</strong> (득실{' '}
                    {userRow.goalDifference >= 0
                      ? `+${userRow.goalDifference}`
                      : userRow.goalDifference}
                    )
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                <span className="text-emerald-400">● 1~8위 16강 직행</span>
                <span className="text-amber-400">● 9~24위 플레이오프</span>
                <span className="text-rose-400">● 25~36위 탈락</span>
              </div>
            </div>
          </div>
        )}

        {/* Scrollable 36-Team Table */}
        <div className="modal-scroll flex-1 min-h-0 overflow-y-auto px-4 py-3 sm:px-5">
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#090e18]">
            <table className="w-full text-left text-[11px] sm:text-xs">
              <thead className="sticky top-0 z-10 border-b border-slate-800 bg-[#0b121e] text-[10px] sm:text-[11px] text-slate-400">
                <tr>
                  <th className="py-2 px-2 text-center w-9">#</th>
                  <th className="py-2 px-2">구단</th>
                  <th className="py-2 px-2 hidden sm:table-cell">포트 / 리그</th>
                  <th className="py-2 px-1.5 text-center">경기</th>
                  <th className="py-2 px-1.5 text-center">승</th>
                  <th className="py-2 px-1.5 text-center">무</th>
                  <th className="py-2 px-1.5 text-center">패</th>
                  <th className="py-2 px-1.5 text-center">득실</th>
                  <th className="py-2 px-2 text-center font-black">승점</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 tabular-nums">
                {ucl.standings.map((row, idx) => {
                  const rank = idx + 1;
                  const entry = teamEntryById[row.teamId];
                  const zoneBorder =
                    rank <= 8
                      ? 'border-l-4 border-l-emerald-400'
                      : rank <= 24
                        ? 'border-l-4 border-l-amber-400'
                        : 'border-l-4 border-l-rose-500/70';

                  return (
                    <Fragment key={row.teamId}>
                      <tr
                        onClick={() => {
                          const c = clubsById[row.teamId];
                          if (c && onInspectClub) onInspectClub(c);
                        }}
                        className={`${zoneBorder} transition-colors ${
                          onInspectClub ? 'cursor-pointer' : ''
                        } ${
                          row.isUser
                            ? 'bg-emerald-500/20 font-bold text-white hover:bg-emerald-500/30'
                            : 'hover:bg-slate-800/50 text-slate-200'
                        }`}
                      >
                        <td className="py-1.5 px-2 text-center font-mono font-bold">
                          <span
                            className={
                              rank <= 8
                                ? 'text-emerald-400'
                                : rank <= 24
                                  ? 'text-amber-300'
                                  : 'text-rose-400'
                            }
                          >
                            {rank}
                          </span>
                        </td>
                        <td className="py-1.5 px-2">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: row.primaryColor }}
                            />
                            <span className="truncate max-w-[140px] sm:max-w-none">
                              {row.teamName}
                            </span>
                            {row.isUser && (
                              <span className="rounded bg-emerald-500 px-1.5 py-0.2 text-[9px] font-black text-slate-950 shrink-0">
                                내 구단
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-1.5 px-2 text-[11px] text-slate-400 hidden sm:table-cell">
                          Pot {entry?.pot ?? '-'} · {entry?.originLabel ?? ''}
                        </td>
                        <td className="py-1.5 px-1.5 text-center font-mono">
                          {row.played}
                        </td>
                        <td className="py-1.5 px-1.5 text-center font-mono">
                          {row.won}
                        </td>
                        <td className="py-1.5 px-1.5 text-center font-mono">
                          {row.drawn}
                        </td>
                        <td className="py-1.5 px-1.5 text-center font-mono">
                          {row.lost}
                        </td>
                        <td className="py-1.5 px-1.5 text-center font-mono">
                          {row.goalDifference >= 0
                            ? `+${row.goalDifference}`
                            : row.goalDifference}
                        </td>
                        <td className="py-1.5 px-2 text-center font-mono text-xs sm:text-sm font-black text-white">
                          {row.points}
                        </td>
                      </tr>

                      {rank === 8 && (
                        <tr className="bg-emerald-950/35">
                          <td
                            colSpan={9}
                            className="py-1 px-3 text-center text-[10px] font-extrabold text-emerald-300 tracking-wider"
                          >
                            ▲ 1~8위 16강 토너먼트 직행 커트라인 ▲
                          </td>
                        </tr>
                      )}
                      {rank === 24 && (
                        <tr className="bg-amber-950/30">
                          <td
                            colSpan={9}
                            className="py-1 px-3 text-center text-[10px] font-extrabold text-amber-300 tracking-wider"
                          >
                            ▲ 9~24위 16강 플레이오프 진출 커트라인 · ▼ 25~36위 탈락
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 bg-[#090e18] px-4 py-3 sm:px-5">
          <span className="text-[11px] text-slate-400">
            구단 클릭 시 해당 팀 로스터 및 UCL 기록 확인
          </span>
          <div className="flex items-center gap-2">
            {isCompleted && onGoToBracket && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onGoToBracket();
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-sky-400/45 bg-sky-500/15 px-4 py-2 text-xs font-extrabold text-sky-200 hover:bg-sky-500/25 cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5" />
                토너먼트 대진표 보기
              </button>
            )}
            <button
              id="ucl-close-lp-standings-modal-btn"
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-5 py-2 text-xs font-black text-slate-950 hover:bg-emerald-400 cursor-pointer"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              확인 · 계속하기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
