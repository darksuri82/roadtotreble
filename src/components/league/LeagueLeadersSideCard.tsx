import { Award, Crown } from 'lucide-react';
import { memo, useState } from 'react';
import type { PlayerSeasonStats } from '../../types/league';
import { getPlayerNationalityMeta } from '../../utils/playerLookup';
import { ClubTag } from '../common/ClubTag';
import { CountryFlagSvg } from '../common/CountryFlagSvg';
import { PlayerNameButton } from '../common/PlayerNameButton';

interface LeagueLeadersSideCardProps {
  scorers: PlayerSeasonStats[];
  assisters: PlayerSeasonStats[];
  myClubId?: string | null;
  friendLabelByClub?: Record<string, string>;
  maxRows?: number;
  desktopLayout?: 'stack' | 'two-col';
  competitionPrefix?: string;
  accent?: 'league' | 'ucl';
  onSelectPlayer?: (stats: PlayerSeasonStats) => void;
}

type LeaderTab = 'goals' | 'assists';

function LeaderRows({
  entries,
  mode,
  myClubId,
  friendLabelByClub,
  maxRows,
  onSelectPlayer,
}: {
  entries: PlayerSeasonStats[];
  mode: LeaderTab;
  myClubId?: string | null;
  friendLabelByClub?: Record<string, string>;
  maxRows: number;
  onSelectPlayer?: (stats: PlayerSeasonStats) => void;
}) {
  const sliced = entries
    .filter((e) => (mode === 'goals' ? e.goals > 0 : e.assists > 0))
    .slice(0, maxRows);

  if (sliced.length === 0) {
    return (
      <div className="py-3 text-center text-[11px] text-slate-500">
        기록 집계 중
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {sliced.map((entry, idx) => {
        const isMine =
          entry.isUserTeam || (myClubId != null && entry.teamId === myClubId);
        const friendLabel =
          !isMine && friendLabelByClub ? friendLabelByClub[entry.teamId] : undefined;
        const nat = getPlayerNationalityMeta(entry.playerId);

        return (
          <div
            key={`${mode}-${entry.teamId}-${entry.playerId}`}
            className={`flex items-center justify-between gap-1.5 rounded-lg border px-2 py-1 text-[11px] tabular-nums ${
              isMine
                ? 'border-emerald-500/35 bg-emerald-500/12'
                : friendLabel
                  ? 'border-sky-500/25 bg-sky-500/8'
                  : 'border-transparent bg-[#0b1018]'
            }`}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className={`w-3.5 shrink-0 text-center font-mono text-[10px] font-bold ${
                  idx === 0 ? 'text-amber-300' : 'text-slate-500'
                }`}
              >
                {idx + 1}
              </span>
              {nat && (
                <CountryFlagSvg
                  code={nat.nationalityCode}
                  nationality={nat.nationality}
                  size="xs"
                />
              )}
              {onSelectPlayer ? (
                <PlayerNameButton
                  onClick={() => onSelectPlayer(entry)}
                  className="truncate font-bold text-slate-100"
                >
                  {entry.playerName}
                </PlayerNameButton>
              ) : (
                <span className="truncate font-bold text-slate-100">
                  {entry.playerName}
                </span>
              )}
              <ClubTag
                shortName={entry.teamShortName}
                primaryColor={entry.teamPrimaryColor}
                isUserTeam={isMine}
                size="xs"
              />
              {friendLabel && (
                <span className="shrink-0 rounded bg-sky-400/90 px-1 py-px text-[8px] font-black leading-none text-slate-950">
                  {friendLabel}
                </span>
              )}
            </div>
            <span
              className={`shrink-0 font-display text-xs font-bold ${
                mode === 'goals' ? 'text-emerald-300' : 'text-sky-300'
              }`}
            >
              {mode === 'goals' ? `${entry.goals}골` : `${entry.assists}도움`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Side leaderboard showing Top Scorers + Top Assisters together:
 * - Desktop (lg+): Displays BOTH Goals & Assists simultaneously (stacked or 2-col).
 * - Mobile (<lg): Compact single card with quick [득점 | 도움] toggle to keep vertical height minimal.
 */
export const LeagueLeadersSideCard = memo(function LeagueLeadersSideCard({
  scorers,
  assisters,
  myClubId = null,
  friendLabelByClub,
  maxRows = 5,
  desktopLayout = 'stack',
  competitionPrefix,
  accent = 'league',
  onSelectPlayer,
}: LeagueLeadersSideCardProps) {
  const [mobileTab, setMobileTab] = useState<LeaderTab>('goals');

  const hasAny =
    scorers.some((s) => s.goals > 0) || assisters.some((a) => a.assists > 0);
  if (!hasAny) return null;

  const cardSurface =
    accent === 'ucl'
      ? 'border-sky-500/30 bg-[#0b1324]'
      : 'border-slate-800/90 bg-[#0d131c]';
  const prefix = competitionPrefix ? `${competitionPrefix} ` : '';

  return (
    <>
      {/* Desktop (lg+): Show Goals & Assists simultaneously */}
      <div
        className={`hidden lg:grid gap-2.5 ${
          desktopLayout === 'two-col' ? 'grid-cols-2' : 'grid-cols-1'
        }`}
      >
        <div className={`rounded-xl border p-2.5 space-y-1.5 ${cardSurface}`}>
          <div className="flex items-center justify-between px-0.5">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-200">
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              {prefix}득점 순위
            </span>
            <span className="text-[10px] font-semibold text-slate-500">TOP {maxRows}</span>
          </div>
          <LeaderRows
            entries={scorers}
            mode="goals"
            myClubId={myClubId}
            friendLabelByClub={friendLabelByClub}
            maxRows={maxRows}
            onSelectPlayer={onSelectPlayer}
          />
        </div>

        <div className={`rounded-xl border p-2.5 space-y-1.5 ${cardSurface}`}>
          <div className="flex items-center justify-between px-0.5">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-200">
              <Award className="w-3.5 h-3.5 text-sky-400" />
              {prefix}도움 순위
            </span>
            <span className="text-[10px] font-semibold text-slate-500">TOP {maxRows}</span>
          </div>
          <LeaderRows
            entries={assisters}
            mode="assists"
            myClubId={myClubId}
            friendLabelByClub={friendLabelByClub}
            maxRows={maxRows}
            onSelectPlayer={onSelectPlayer}
          />
        </div>
      </div>

      {/* Mobile (<lg): Compact single card with instant [득점 | 도움] toggle */}
      <div className={`lg:hidden rounded-xl border p-2.5 space-y-2 ${cardSurface}`}>
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-200">
            {mobileTab === 'goals' ? (
              <Crown className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <Award className="w-3.5 h-3.5 text-sky-400" />
            )}
            {prefix}개인 기록 TOP {maxRows}
          </span>
          <div className="inline-flex rounded-lg border border-slate-800 bg-[#0b1018] p-0.5 text-[10px]">
            <button
              type="button"
              onClick={() => setMobileTab('goals')}
              className={`rounded-md px-2.5 py-1 font-bold transition-colors cursor-pointer touch-manipulation ${
                mobileTab === 'goals'
                  ? 'bg-slate-800 text-emerald-300 border border-emerald-500/45'
                  : 'border border-transparent text-slate-400'
              }`}
            >
              득점
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('assists')}
              className={`rounded-md px-2.5 py-1 font-bold transition-colors cursor-pointer touch-manipulation ${
                mobileTab === 'assists'
                  ? 'bg-slate-800 text-sky-300 border border-sky-400/45'
                  : 'border border-transparent text-slate-400'
              }`}
            >
              도움
            </button>
          </div>
        </div>

        <LeaderRows
          entries={mobileTab === 'goals' ? scorers : assisters}
          mode={mobileTab}
          myClubId={myClubId}
          friendLabelByClub={friendLabelByClub}
          maxRows={maxRows}
          onSelectPlayer={onSelectPlayer}
        />
      </div>
    </>
  );
});
