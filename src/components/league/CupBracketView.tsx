import { Trophy } from 'lucide-react';
import { CUP_STAGE_LABELS, CUP_STAGE_ORDER } from '../../engine/cupEngine';
import { USER_CLUB_ID } from '../../engine/matchEngine';
import type { CupMatchNode, DomesticCupState } from '../../types/cup';
import type { Club } from '../../types/league';

interface CupBracketViewProps {
  cup: DomesticCupState;
  clubs: Club[];
}

function MatchNodeCard({
  node,
  clubsById,
}: {
  node: CupMatchNode;
  clubsById: Record<string, Club>;
}) {
  const home = clubsById[node.homeTeamId];
  const away = clubsById[node.awayTeamId];
  const involvesUser =
    node.homeTeamId === USER_CLUB_ID || node.awayTeamId === USER_CLUB_ID;

  const homeWon = node.played && node.winnerId === node.homeTeamId;
  const awayWon = node.played && node.winnerId === node.awayTeamId;
  const et = node.result?.extraTime;

  return (
    <div
      className={`rounded-xl border px-3 py-2 text-xs transition ${
        involvesUser
          ? 'border-emerald-500/60 bg-emerald-950/35 shadow-sm shadow-emerald-900/20'
          : 'border-slate-800 bg-slate-900/75'
      }`}
    >
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/20"
              style={{ backgroundColor: home?.primaryColor ?? '#64748b' }}
            />
            <span
              className={`truncate ${
                node.homeTeamId === USER_CLUB_ID
                  ? 'font-bold text-emerald-300'
                  : homeWon
                    ? 'font-semibold text-white'
                    : node.played
                      ? 'text-slate-400'
                      : 'text-slate-200'
              }`}
            >
              {home?.name ?? node.homeTeamId}
            </span>
          </div>
          <span
            className={`shrink-0 font-mono font-bold ${
              homeWon ? 'text-emerald-400' : 'text-slate-300'
            }`}
          >
            {node.played && node.result ? node.result.homeGoals : '-'}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/20"
              style={{ backgroundColor: away?.primaryColor ?? '#64748b' }}
            />
            <span
              className={`truncate ${
                node.awayTeamId === USER_CLUB_ID
                  ? 'font-bold text-emerald-300'
                  : awayWon
                    ? 'font-semibold text-white'
                    : node.played
                      ? 'text-slate-400'
                      : 'text-slate-200'
              }`}
            >
              {away?.name ?? node.awayTeamId}
            </span>
          </div>
          <span
            className={`shrink-0 font-mono font-bold ${
              awayWon ? 'text-emerald-400' : 'text-slate-300'
            }`}
          >
            {node.played && node.result ? node.result.awayGoals : '-'}
          </span>
        </div>
      </div>

      {node.played && et && (
        <div className="mt-1.5 border-t border-slate-800/80 pt-1 text-[10px] font-semibold text-amber-300">
          {et.penalties
            ? `PK ${et.penalties.homePenGoals} - ${et.penalties.awayPenGoals}`
            : '연장전 종료 (AET)'}
        </div>
      )}
    </div>
  );
}

export function CupBracketView({ cup, clubs }: CupBracketViewProps) {
  const clubsById: Record<string, Club> = Object.fromEntries(
    clubs.map((c) => [c.id, c]),
  );
  const champion = cup.championTeamId ? clubsById[cup.championTeamId] : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/75 p-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15"
            style={{ backgroundColor: `${cup.meta.accentColor}22` }}
          >
            <Trophy className="h-5 w-5" style={{ color: cup.meta.accentColor }} />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-white">
              {cup.meta.koreanName}{' '}
              <span className="text-xs font-semibold text-slate-400">
                ({cup.meta.name})
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              16팀 단판 토너먼트 · 일정 트리거: {cup.triggerRounds.map((r) => `${r}R`).join(' · ')}
            </p>
          </div>
        </div>

        {champion ? (
          <div className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-bold text-amber-300">
            <Trophy className="h-4 w-4 text-amber-400" />
            우승: {champion.name}
          </div>
        ) : cup.userEliminatedAt ? (
          <span className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-300">
            우리 팀 {CUP_STAGE_LABELS[cup.userEliminatedAt]} 탈락
          </span>
        ) : (
          <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
            생존 중 · 현재 {CUP_STAGE_LABELS[cup.currentStage]}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {CUP_STAGE_ORDER.map((stage, idx) => {
          const matches = cup.rounds[stage];
          const triggerRound = cup.triggerRounds[idx];
          const isPending = cup.pendingStage === stage;

          return (
            <div key={stage} className="space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <span className="text-xs font-extrabold tracking-wide text-slate-200">
                  {CUP_STAGE_LABELS[stage]}
                  {isPending && (
                    <span className="ml-1.5 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-300">
                      진행 대기
                    </span>
                  )}
                </span>
                <span className="text-[11px] text-slate-500">
                  {triggerRound}R 직후
                </span>
              </div>

              {matches.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/40 p-4 text-center text-xs text-slate-500">
                  이전 라운드 종료 후 대진 확정
                </div>
              ) : (
                <div className="space-y-2">
                  {matches.map((node) => (
                    <MatchNodeCard
                      key={node.id}
                      node={node}
                      clubsById={clubsById}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
