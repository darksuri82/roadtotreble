import {
  ArrowRight,
  ArrowUpDown,
  Award,
  BarChart3,
  Crown,
  Diamond,
  Globe,
  Hourglass,
  LayoutGrid,
  Sparkles,
  Star,
  Swords,
  Trophy,
  X,
} from 'lucide-react';
import { ModalBodyLock } from '../../../hooks/useBodyScrollLock';
import { Fragment, useState } from 'react';
import type { ReactNode } from 'react';
import { FORMATIONS } from '../../../data/formations';
import { computeSquadPlayerAnalytics } from '../../../engine/analyticsEngine';
import { buildAiClubRoster, getLeagueById } from '../../../engine/dataLoader';
import { formatMainPositions } from '../../../engine/positionEngine';
import { TACTICS } from '../../../engine/tacticEngine';
import type { DomesticCupState } from '../../../types/cup';
import type {
  BestXiEntry,
  Club,
  LeagueId,
  PlayerSeasonStats,
  SquadPlayerAnalyticsRow,
  StandingRow,
} from '../../../types/league';
import type {
  MpH2HRecord,
  MpLeagueHuman,
  MpLeagueSummary,
  MpSquadInput,
} from '../../../types/mpLeague';
import type { Player } from '../../../types/player';
import { getPlayerNationalityMeta, resolvePlayerById } from '../../../utils/playerLookup';
import { ClubSquadModal } from '../../common/ClubSquadModal';
import { ClubTag } from '../../common/ClubTag';
import { CountryFlagSvg } from '../../common/CountryFlagSvg';
import { JerseySvg } from '../../common/JerseySvg';
import { PixelManagerAvatar } from '../../common/PixelManagerAvatar';
import {
  getDomesticCupTrophyVariant,
  getLeagueTrophyVariant,
  PixelTrophySvg,
} from '../../common/PixelTrophySvg';
import { PlayerDetailModal } from '../../common/PlayerDetailModal';
import { PlayerNameButton } from '../../common/PlayerNameButton';
import { CupBracketView } from '../../league/CupBracketView';
import { getLeagueTrophyDisplayName } from '../../league/LeagueFinaleBannerModal';
import { StandingsTable } from '../../league/StandingsTable';

interface MpLeagueSeasonSummaryProps {
  leagueLabel: string;
  leagueId?: LeagueId;
  summary: MpLeagueSummary;
  standings: StandingRow[];
  humans: MpLeagueHuman[];
  clubsById: Record<string, Club>;
  squads: Record<string, MpSquadInput>;
  myClubId: string | null;
  cup?: DomesticCupState | null;
  uclEnabled?: boolean;
  uclHumanClubIds?: string[];
  h2hByClub?: Record<string, MpH2HRecord>;
  acked: boolean;
  waitingNames: string[];
  canContinue: boolean;
  onContinue: () => void;
  onClose?: () => void;
}

type AwardRankTab = 'goals' | 'assists' | 'cleanSheets' | 'rating';

type SquadSortKey =
  | 'lineup'
  | 'apps'
  | 'mins'
  | 'goals'
  | 'assists'
  | 'ga'
  | 'xg'
  | 'cs'
  | 'mom'
  | 'rating';

type MpSquadRow = Omit<SquadPlayerAnalyticsRow, 'stamina'> & {
  stamina: number | null;
  lineupIndex: number;
  isStarter: boolean;
};

interface Ownership {
  myClubId: string | null;
  friendLabelByClub: Record<string, string>;
}

function friendBadgeLabel(human: MpLeagueHuman): string {
  const nick = Array.from(human.nickname.trim()).slice(0, 2).join('');
  return nick || human.profile.shortName;
}

function FriendBadge({ label }: { label: string }) {
  return (
    <span className="shrink-0 rounded bg-sky-400 px-1 py-0.5 text-[8px] font-black leading-none text-slate-950">
      {label}
    </span>
  );
}

function StatClubTag({
  stats,
  own,
  size,
}: {
  stats: PlayerSeasonStats;
  own: Ownership;
  size?: 'xs' | 'sm';
}) {
  const isMine = own.myClubId !== null && stats.teamId === own.myClubId;
  const friendLabel = isMine ? undefined : own.friendLabelByClub[stats.teamId];
  return (
    <>
      <ClubTag
        shortName={stats.teamShortName}
        primaryColor={stats.teamPrimaryColor}
        isUserTeam={isMine}
        size={size}
      />
      {friendLabel && <FriendBadge label={friendLabel} />}
    </>
  );
}

export function MpBestXiPitchCard({
  title,
  entries,
  accentLabel,
  own,
  onSelectPlayer,
}: {
  title: string;
  entries: BestXiEntry[];
  accentLabel?: string;
  own: Ownership;
  onSelectPlayer?: (stats: PlayerSeasonStats) => void;
}) {
  const slots = FORMATIONS['4-3-3'].slots;
  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <div className="flex items-center gap-1.5 text-xs font-bold text-white">
          <Star className="w-4 h-4 text-amber-400 fill-current" />
          {title}
        </div>
        <span className="text-[11px] text-emerald-300">
          {accentLabel ?? 'MY 배지 = 우리 팀 선수'}
        </span>
      </div>

      <div className="pitch-surface relative aspect-[4/4.6] w-full overflow-hidden rounded-2xl border border-slate-800">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <rect
            x="4"
            y="4"
            width="92"
            height="92"
            rx="1.5"
            fill="none"
            stroke="rgba(255,255,255,0.14)"
            strokeWidth="0.55"
          />
          <line
            x1="4"
            y1="50"
            x2="96"
            y2="50"
            stroke="rgba(255,255,255,0.13)"
            strokeWidth="0.45"
          />
          <circle
            cx="50"
            cy="50"
            r="11"
            fill="none"
            stroke="rgba(255,255,255,0.13)"
            strokeWidth="0.45"
          />
        </svg>

        {entries.map((entry) => {
          const slot = slots[entry.slotIndex];
          if (!slot) return null;
          const isMine =
            own.myClubId !== null && entry.stats.teamId === own.myClubId;
          const friendLabel = isMine
            ? undefined
            : own.friendLabelByClub[entry.stats.teamId];
          return (
            <div
              key={`${entry.slotIndex}-${entry.stats.playerId}`}
              style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center"
            >
              <div
                className={`flex flex-col items-center rounded-xl px-2 py-1 min-w-[72px] sm:min-w-[84px] text-center shadow-lg ${
                  isMine
                    ? 'bg-emerald-950/95 border-2 border-emerald-400'
                    : friendLabel
                      ? 'bg-sky-950/95 border-2 border-sky-400'
                      : 'bg-[#101822]/95 border border-slate-600/80'
                }`}
              >
                <div className="flex items-center gap-1 leading-none">
                  <span
                    className={`font-display text-sm font-bold ${
                      isMine
                        ? 'text-emerald-300'
                        : friendLabel
                          ? 'text-sky-300'
                          : 'text-amber-300'
                    }`}
                  >
                    {entry.stats.avgRating.toFixed(1)}
                  </span>
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: entry.stats.teamPrimaryColor }}
                  />
                  <span className="text-[9px] font-bold text-slate-300">
                    {entry.stats.teamShortName}
                  </span>
                  {isMine && (
                    <span className="rounded bg-emerald-400 px-1 text-[7px] font-black text-slate-950">
                      MY
                    </span>
                  )}
                  {friendLabel && (
                    <span className="rounded bg-sky-400 px-1 text-[7px] font-black text-slate-950">
                      {friendLabel}
                    </span>
                  )}
                </div>
                {onSelectPlayer ? (
                  <PlayerNameButton
                    onClick={() => onSelectPlayer(entry.stats)}
                    className="mt-0.5 max-w-[84px] text-[10px] font-bold text-white text-center"
                  >
                    {entry.stats.playerName}
                  </PlayerNameButton>
                ) : (
                  <span className="mt-0.5 max-w-[84px] truncate text-[10px] font-bold text-white">
                    {entry.stats.playerName}
                  </span>
                )}
                <span className="text-[9px] text-slate-400">
                  {entry.stats.position === 'GK' ||
                  entry.stats.position === 'DF'
                    ? `${entry.stats.cleanSheets}CS · ${entry.stats.goals}G`
                    : `${entry.stats.goals}G ${entry.stats.assists}A`}
                </span>
              </div>
              <span className="mt-0.5 rounded bg-slate-950/85 px-1.5 text-[9px] font-bold text-slate-300">
                {entry.slotLabel}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FriendHeroCard({
  human,
  rank,
  row,
  isMe,
  leagueId,
  leagueName,
  uclStatus,
  h2h,
  onClick,
}: {
  human: MpLeagueHuman;
  rank: number | undefined;
  row: StandingRow | undefined;
  isMe: boolean;
  leagueId: LeagueId | undefined;
  leagueName: string;
  uclStatus: 'qualified' | 'missed' | 'off';
  h2h?: MpH2HRecord;
  onClick?: () => void;
}) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      title={onClick ? `${human.nickname} (${human.profile.name}) 포메이션 보기` : undefined}
      className={`rounded-xl border p-3 sm:p-4 space-y-2 transition-colors ${
        onClick ? 'cursor-pointer hover:border-sky-400/60' : ''
      } ${
        isMe
          ? 'border-emerald-500/45 bg-emerald-500/10'
          : 'border-slate-800 bg-[#090e15]'
      }`}
    >
      <div className="flex items-center gap-2.5 sm:gap-3.5">
        {rank === 1 && (
          <div
            title={
              leagueId
                ? getLeagueTrophyDisplayName(leagueId)
                : `${leagueName} 우승`
            }
            className="flex h-16 w-14 shrink-0 items-center justify-center rounded-xl border border-amber-400/40 bg-amber-500/10"
          >
            <PixelTrophySvg
              variant={getLeagueTrophyVariant(leagueId ?? '')}
              size={44}
              animate
            />
          </div>
        )}
        <JerseySvg
          primaryColor={human.profile.primaryColor}
          secondaryColor={human.profile.secondaryColor}
          pattern={human.profile.pattern}
          label={human.profile.shortName}
          size={52}
          className="shrink-0"
        />
        <div className="flex h-16 w-14 shrink-0 items-center justify-center rounded-xl border border-slate-800 bg-[#111824]">
          <PixelManagerAvatar
            avatar={human.avatar}
            clubPrimaryColor={human.profile.primaryColor}
            clubSecondaryColor={human.profile.secondaryColor}
            size={44}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-display text-2xl font-bold text-amber-300">
              {rank ? `#${rank}` : '-'}
            </span>
            {isMe && (
              <span className="shrink-0 rounded bg-emerald-400 px-1 py-0.5 text-[9px] font-black leading-none text-slate-950">
                MY
              </span>
            )}
            {uclStatus === 'qualified' && (
              <span className="shrink-0 rounded border border-sky-400/40 bg-sky-500/15 px-1.5 py-0.5 text-[9px] font-extrabold text-sky-200">
                UCL 진출
              </span>
            )}
            {uclStatus === 'missed' && (
              <span className="shrink-0 rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold text-slate-400">
                UCL 미진출
              </span>
            )}
          </div>
          <div className="truncate text-xs font-bold text-white">
            {human.profile.name}
          </div>
          <div className="truncate text-[11px] text-slate-400">
            {human.nickname} 감독
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums">
        {row && (
          <span className="font-bold text-emerald-300">
            {row.points}점 ({row.won}승 {row.drawn}무 {row.lost}패 · 득실{' '}
            {row.goalDifference >= 0
              ? `+${row.goalDifference}`
              : row.goalDifference}
            )
          </span>
        )}
        {h2h && h2h.played > 0 && (
          <span className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-[#111822] px-2 py-0.5 text-[10px] font-bold text-slate-200">
            <Swords className="w-3 h-3 text-amber-300" />
            맞대결 {h2h.won}승 {h2h.drawn}무 {h2h.lost}패
          </span>
        )}
      </div>
    </div>
  );
}

function LeagueRecordsTab({
  leagueName,
  summary,
  own,
  onInspectStats,
}: {
  leagueName: string;
  summary: MpLeagueSummary;
  own: Ownership;
  onInspectStats: (stats: PlayerSeasonStats) => void;
}) {
  const [rankTab, setRankTab] = useState<AwardRankTab>('goals');
  const awards = summary.awards;
  const poty = awards.poty;

  const activeLeaderboard: PlayerSeasonStats[] =
    rankTab === 'goals'
      ? awards.topScorers
      : rankTab === 'assists'
        ? awards.topAssisters
        : rankTab === 'cleanSheets'
          ? awards.topCleanSheets
          : awards.topRatings;

  const mineInXi = awards.bestXi.filter(
    (x) => own.myClubId !== null && x.stats.teamId === own.myClubId,
  ).length;
  const friendsInXi = awards.bestXi.filter(
    (x) =>
      x.stats.teamId !== own.myClubId &&
      Boolean(own.friendLabelByClub[x.stats.teamId]),
  ).length;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      <div className="lg:col-span-6 space-y-4">
        {poty && (
          <div className="w-full rounded-2xl border border-amber-400/35 bg-[#121925] p-5 text-left">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                  <Crown className="w-3 h-3" />
                  {leagueName} 올해의 선수 (리그 MVP)
                </span>
                <div className="mt-1.5">
                  <PlayerNameButton
                    onClick={() => onInspectStats(poty)}
                    className="font-display text-2xl font-bold text-white"
                  >
                    {poty.playerName}
                  </PlayerNameButton>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-300">
                  <StatClubTag stats={poty} own={own} />
                  <span>{poty.teamName}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[10px] text-amber-300">평균 평점</div>
                <div className="font-display text-3xl font-bold text-amber-300">
                  {poty.avgRating.toFixed(2)}
                </div>
                <div className="text-[11px] text-slate-400">
                  {poty.goals}G {poty.assists}A · MOM {poty.momCount}회
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-slate-800 bg-[#0e141d] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-white">
              <Award className="w-4 h-4 text-emerald-400" />
              {leagueName} 개인 기록 TOP 10
            </div>
          </div>
          <div className="grid grid-cols-4 gap-1 rounded-lg bg-[#090e15] p-1 text-[11px]">
            {(
              [
                ['goals', '득점왕'],
                ['assists', '도움왕'],
                ['cleanSheets', '클린시트'],
                ['rating', '평균평점'],
              ] as [AwardRankTab, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setRankTab(id)}
                className={`rounded-md border py-1.5 font-bold cursor-pointer transition-colors ${
                  rankTab === id
                    ? 'bg-slate-800 text-white border-emerald-500/50'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-[#090e15]">
            <table className="w-full text-left text-xs tabular-nums">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] text-slate-400">
                  <th className="py-2 px-2.5 w-8 text-center">#</th>
                  <th className="py-2 px-2">선수 (소속팀)</th>
                  <th className="py-2 px-2 text-center">포지션</th>
                  <th className="py-2 px-2.5 text-right text-white">기록</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {activeLeaderboard.map((st, idx) => {
                  const isMine =
                    own.myClubId !== null && st.teamId === own.myClubId;
                  const isFriend =
                    !isMine && Boolean(own.friendLabelByClub[st.teamId]);
                  const nat = getPlayerNationalityMeta(st.playerId);
                  return (
                    <tr
                      key={`${st.teamId}-${st.playerId}`}
                      className={`transition-colors ${
                        isMine
                          ? 'bg-emerald-500/15'
                          : isFriend
                            ? 'bg-sky-500/10'
                            : 'hover:bg-slate-800/25'
                      }`}
                    >
                      <td className="py-2 px-2.5 text-center font-display font-bold text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {nat && (
                            <CountryFlagSvg
                              code={nat.nationalityCode}
                              nationality={nat.nationality}
                              size="xs"
                            />
                          )}
                          <PlayerNameButton
                            onClick={() => onInspectStats(st)}
                            className="font-bold text-slate-100"
                          >
                            {st.playerName}
                          </PlayerNameButton>
                          <StatClubTag stats={st} own={own} />
                        </div>
                      </td>
                      <td className="py-2 px-2 text-center text-[11px] text-slate-400">
                        {st.mainPositions[0]}
                      </td>
                      <td className="py-2 px-2.5 text-right font-display text-sm font-bold text-emerald-300">
                        {rankTab === 'goals' && `${st.goals}골`}
                        {rankTab === 'assists' && `${st.assists}도움`}
                        {rankTab === 'cleanSheets' && `${st.cleanSheets}CS`}
                        {rankTab === 'rating' && st.avgRating.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="lg:col-span-6">
        <div className="mx-auto max-w-[460px]">
          <MpBestXiPitchCard
            title={`${leagueName} 시즌 베스트 11 (4-3-3)`}
            entries={awards.bestXi}
            accentLabel={`우리 팀 선정: ${mineInXi}명 · 친구 팀 ${friendsInXi}명`}
            own={own}
            onSelectPlayer={onInspectStats}
          />
        </div>
      </div>
    </div>
  );
}

function buildSquadRows(
  stats: PlayerSeasonStats[],
  squad: MpSquadInput | undefined,
): MpSquadRow[] {
  const statsById: Record<string, PlayerSeasonStats> = {};
  for (const st of stats) statsById[st.playerId] = st;

  const rows: MpSquadRow[] = [];
  const seen = new Set<string>();
  if (squad) {
    const base = computeSquadPlayerAnalytics({
      starters: squad.starters,
      bench: squad.bench,
      allPlayerStats: statsById,
    });
    base.forEach((row, i) => {
      if (seen.has(row.playerId)) return;
      seen.add(row.playerId);
      rows.push({
        ...row,
        lineupIndex: i,
        isStarter: i < squad.starters.length,
      });
    });
  }
  for (const st of stats) {
    if (seen.has(st.playerId)) continue;
    seen.add(st.playerId);
    let primaryDeployedPosition = st.mainPositions[0];
    let bestCount = -1;
    for (const [pos, cnt] of Object.entries(st.positionCounts)) {
      if ((cnt ?? 0) > bestCount) {
        bestCount = cnt ?? 0;
        primaryDeployedPosition = pos as typeof primaryDeployedPosition;
      }
    }
    rows.push({
      playerId: st.playerId,
      playerName: st.playerName,
      ovr: st.ovr,
      stamina: null,
      isLegend: st.isLegend,
      position: st.position,
      mainPositions: [...st.mainPositions],
      primaryDeployedPosition,
      appearances: st.appearances,
      starts: st.starts,
      subAppearances: st.subAppearances,
      minutesPlayed: st.minutesPlayed,
      goals: st.goals,
      assists: st.assists,
      goalContributions: st.goals + st.assists,
      xg: Math.round(st.xgSum * 100) / 100,
      cleanSheets: st.cleanSheets,
      momCount: st.momCount,
      avgRating: st.avgRating,
      lineupIndex: rows.length,
      isStarter: !squad && rows.length < 11,
    });
  }
  return rows;
}

export function MpFriendSquadTab({
  human,
  rank,
  row,
  stats,
  squad,
  onSelectPlayerId,
  onOpenFormation,
}: {
  human: MpLeagueHuman;
  rank: number | undefined;
  row: StandingRow | undefined;
  stats: PlayerSeasonStats[];
  squad: MpSquadInput | undefined;
  onSelectPlayerId?: (playerId: string) => void;
  onOpenFormation?: () => void;
}) {
  const [sortKey, setSortKey] = useState<SquadSortKey>('lineup');
  const squadRows = buildSquadRows(stats, squad);

  const sortedSquad = [...squadRows].sort((a, b) => {
    switch (sortKey) {
      case 'apps':
        return b.appearances - a.appearances || b.minutesPlayed - a.minutesPlayed;
      case 'mins':
        return b.minutesPlayed - a.minutesPlayed || b.appearances - a.appearances;
      case 'goals':
        return b.goals - a.goals || b.xg - a.xg;
      case 'assists':
        return b.assists - a.assists || b.goals - a.goals;
      case 'ga':
        return b.goalContributions - a.goalContributions || b.avgRating - a.avgRating;
      case 'xg':
        return b.xg - a.xg;
      case 'cs':
        return b.cleanSheets - a.cleanSheets || b.avgRating - a.avgRating;
      case 'mom':
        return b.momCount - a.momCount || b.avgRating - a.avgRating;
      case 'rating':
        return b.avgRating - a.avgRating || b.goalContributions - a.goalContributions;
      case 'lineup':
      default:
        return a.lineupIndex - b.lineupIndex;
    }
  });

  const winRate =
    row && row.played > 0 ? Math.round((row.won / row.played) * 1000) / 10 : 0;
  const topScorer = [...squadRows].sort(
    (a, b) => b.goals - a.goals || b.assists - a.assists,
  )[0];
  const topAssister = [...squadRows].sort(
    (a, b) => b.assists - a.assists || b.goals - a.goals,
  )[0];
  const topRated = [...squadRows]
    .filter((r) => r.appearances > 0)
    .sort((a, b) => b.avgRating - a.avgRating)[0];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-white">
        <BarChart3 className="w-4 h-4 shrink-0 text-emerald-400" />
        <span className="min-w-0 truncate">
          {human.profile.name} ({human.nickname} 감독)
        </span>
        {squad && (
          <>
            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-200">
              {squad.formation}
            </span>
            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-200">
              {TACTICS[squad.tactic]?.name ?? squad.tactic}
            </span>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 tabular-nums">
        <div className="rounded-xl border border-slate-800 bg-[#111822] p-4">
          <div className="text-[11px] text-slate-400">정규 리그 순위 · 승점</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold text-amber-300">
              {rank ? `${rank}위` : '-'}
            </span>
            <span className="font-display text-lg font-bold text-white">
              {row ? `${row.points}점` : '-'}
            </span>
          </div>
          {row && (
            <div className="mt-1 text-[11px] text-slate-400">
              {row.won}승 {row.drawn}무 {row.lost}패 ({row.played}경기 · 승률{' '}
              {winRate.toFixed(1)}%)
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#111822] p-4">
          <div className="text-[11px] text-slate-400">득점 · 실점 · 득실</div>
          {row ? (
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-display text-2xl font-bold text-white">
                {row.goalsFor} : {row.goalsAgainst}
              </span>
              <span
                className={`font-display text-sm font-bold ${
                  row.goalDifference >= 0 ? 'text-emerald-300' : 'text-rose-300'
                }`}
              >
                (
                {row.goalDifference >= 0
                  ? `+${row.goalDifference}`
                  : row.goalDifference}
                )
              </span>
            </div>
          ) : (
            <div className="mt-1 font-display text-2xl font-bold text-white">-</div>
          )}
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#111822] p-4">
          <div className="text-[11px] text-slate-400">팀 내 최다 득점 · 도움</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold text-emerald-300">
              {topScorer ? topScorer.goals : 0}
            </span>
            <span className="min-w-0 truncate text-xs text-slate-400">
              {topScorer && topScorer.goals > 0 ? topScorer.playerName : '-'}
            </span>
          </div>
          <div className="mt-1 truncate text-[11px] text-slate-400">
            도움{' '}
            <strong className="text-sky-300">
              {topAssister ? topAssister.assists : 0}
            </strong>
            {topAssister && topAssister.assists > 0
              ? ` ${topAssister.playerName}`
              : ''}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#111822] p-4">
          <div className="text-[11px] text-slate-400">팀 내 최고 평점</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold text-amber-300">
              {topRated ? topRated.avgRating.toFixed(2) : '-'}
            </span>
          </div>
          <div className="mt-1 truncate text-[11px] text-slate-400">
            {topRated ? topRated.playerName : '-'}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-[#111822] p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="min-w-0 truncate text-sm font-extrabold text-white">
            {human.profile.name} 선수단 {squadRows.length}명 시즌 세부 기록
          </h3>
          <div className="flex items-center gap-2 shrink-0">
            {onOpenFormation && (
              <button
                type="button"
                onClick={onOpenFormation}
                className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-emerald-500/40 bg-emerald-500/12 px-2.5 py-1 text-[11px] font-bold text-emerald-200 hover:bg-emerald-500/20 cursor-pointer"
              >
                <LayoutGrid className="w-3 h-3" />
                포메이션 보기
              </button>
            )}
            <button
              type="button"
              onClick={() => setSortKey('lineup')}
              className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] text-slate-500 hover:text-white cursor-pointer"
            >
              <ArrowUpDown className="w-3 h-3" />
              정렬: {sortKey === 'lineup' ? '라인업' : sortKey.toUpperCase()}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#0b1018]">
          <table className="w-full min-w-[720px] text-left text-xs tabular-nums">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] text-slate-400">
                <th className="py-2.5 px-3">선수</th>
                <th className="py-2.5 px-2 text-center">주 출전 포지션</th>
                <th className="py-2.5 px-2 text-center">
                  <button type="button" onClick={() => setSortKey('apps')} className="hover:text-white cursor-pointer">
                    출전(선발/교체)
                  </button>
                </th>
                <th className="py-2.5 px-2 text-center">
                  <button type="button" onClick={() => setSortKey('mins')} className="hover:text-white cursor-pointer">
                    출전시간
                  </button>
                </th>
                <th className="py-2.5 px-2 text-center">
                  <button type="button" onClick={() => setSortKey('goals')} className="hover:text-white cursor-pointer">
                    골
                  </button>
                </th>
                <th className="py-2.5 px-2 text-center">
                  <button type="button" onClick={() => setSortKey('assists')} className="hover:text-white cursor-pointer">
                    도움
                  </button>
                </th>
                <th className="py-2.5 px-2 text-center">
                  <button type="button" onClick={() => setSortKey('ga')} className="hover:text-white cursor-pointer">
                    G+A
                  </button>
                </th>
                <th className="py-2.5 px-2 text-center">
                  <button type="button" onClick={() => setSortKey('xg')} className="hover:text-white cursor-pointer">
                    누적 xG
                  </button>
                </th>
                <th className="py-2.5 px-2 text-center">
                  <button type="button" onClick={() => setSortKey('cs')} className="hover:text-white cursor-pointer">
                    CS
                  </button>
                </th>
                <th className="py-2.5 px-2 text-center">
                  <button type="button" onClick={() => setSortKey('mom')} className="hover:text-white cursor-pointer">
                    MOM
                  </button>
                </th>
                <th className="py-2.5 px-3 text-center text-white">
                  <button type="button" onClick={() => setSortKey('rating')} className="hover:text-emerald-300 cursor-pointer">
                    평균 평점
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {sortedSquad.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-6 text-center text-slate-500">
                    기록 없음
                  </td>
                </tr>
              )}
              {sortedSquad.map((r, idx) => {
                const groupLabel =
                  sortKey !== 'lineup'
                    ? null
                    : idx === 0 && r.isStarter
                      ? '선발'
                      : !r.isStarter && (idx === 0 || sortedSquad[idx - 1].isStarter)
                        ? '벤치'
                        : null;
                return (
                  <Fragment key={r.playerId}>
                    {groupLabel && (
                      <tr className="bg-slate-950/50">
                        <td
                          colSpan={11}
                          className="py-1 px-3 text-[10px] font-bold text-slate-500"
                        >
                          {groupLabel}
                        </td>
                      </tr>
                    )}
                    <tr className="hover:bg-slate-800/30">
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5">
                          {onSelectPlayerId ? (
                            <PlayerNameButton
                              onClick={() => onSelectPlayerId(r.playerId)}
                              className="font-bold text-slate-100"
                            >
                              {r.playerName}
                            </PlayerNameButton>
                          ) : (
                            <span className="font-bold text-slate-100">
                              {r.playerName}
                            </span>
                          )}
                          {r.isLegend && (
                            <Crown className="w-3 h-3 text-amber-400 shrink-0" />
                          )}
                          {!r.isLegend && r.ovr >= 91 && (
                            <Diamond className="w-3 h-3 text-cyan-300 shrink-0" />
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          OVR {r.ovr}
                          {r.stamina !== null ? ` · STA ${r.stamina}` : ''} ·{' '}
                          {formatMainPositions({ mainPositions: r.mainPositions })}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-200">
                          {r.primaryDeployedPosition}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-center text-slate-300">
                        <strong className="text-white">{r.appearances}</strong>{' '}
                        <span className="text-[10px] text-slate-500">
                          ({r.starts}/{r.subAppearances})
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-center text-slate-300">
                        {r.minutesPlayed.toLocaleString()}분
                      </td>
                      <td className="py-2.5 px-2 text-center font-bold text-white">
                        {r.goals}
                      </td>
                      <td className="py-2.5 px-2 text-center font-semibold text-sky-300">
                        {r.assists}
                      </td>
                      <td className="py-2.5 px-2 text-center font-bold text-emerald-300">
                        {r.goalContributions}
                      </td>
                      <td className="py-2.5 px-2 text-center text-slate-300">
                        {r.xg.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-2 text-center text-slate-300">
                        {r.position === 'GK' || r.position === 'DF'
                          ? r.cleanSheets
                          : '-'}
                      </td>
                      <td className="py-2.5 px-2 text-center font-bold text-amber-300">
                        {r.momCount}
                      </td>
                      <td className="py-2.5 px-3 text-center font-display text-sm font-bold text-emerald-300">
                        {r.appearances > 0 ? r.avgRating.toFixed(2) : '-'}
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function MpLeagueSeasonSummary({
  leagueLabel,
  leagueId,
  summary,
  standings,
  humans,
  clubsById,
  squads,
  myClubId,
  cup = null,
  uclEnabled = false,
  uclHumanClubIds = [],
  h2hByClub,
  acked,
  waitingNames,
  canContinue,
  onContinue,
  onClose,
}: MpLeagueSeasonSummaryProps) {
  const [mainTab, setMainTab] = useState<string>('league');
  const [inspectedClubId, setInspectedClubId] = useState<string | null>(null);
  const [inspected, setInspected] = useState<{
    player: Player;
    stats?: PlayerSeasonStats | null;
  } | null>(null);

  const leagueMeta = leagueId ? getLeagueById(leagueId) : null;
  const leagueName = leagueMeta?.koreanName ?? leagueLabel;

  const humanByClub: Record<string, MpLeagueHuman> = {};
  const friendLabelByClub: Record<string, string> = {};
  for (const h of humans) {
    humanByClub[h.clubId] = h;
    if (h.clubId !== myClubId) friendLabelByClub[h.clubId] = friendBadgeLabel(h);
  }
  const own: Ownership = { myClubId, friendLabelByClub };

  const rankByClub: Record<string, number> = {};
  standings.forEach((row, i) => {
    rankByClub[row.teamId] = i + 1;
  });
  const orderedHumans = [...humans].sort(
    (a, b) => (rankByClub[a.clubId] ?? 999) - (rankByClub[b.clubId] ?? 999),
  );

  const uclQualifiedSet = new Set(uclHumanClubIds);
  const qualifiedHumans = orderedHumans.filter((h) => uclQualifiedSet.has(h.clubId));
  const headingToUcl = Boolean(uclEnabled && qualifiedHumans.length > 0);

  const tableStandings = standings.map((row) => ({
    ...row,
    isUser: myClubId !== null && row.teamId === myClubId,
  }));

  const champion = standings[0];
  const cupChampionId = summary.cupChampionId;
  const cupClub = cupChampionId ? clubsById[cupChampionId] : undefined;
  const cupHuman = cupChampionId ? humanByClub[cupChampionId] : undefined;
  const cupName = cupClub?.name ?? cupHuman?.profile.name;

  const allSquadPlayers = Object.values(squads).flatMap((s) => [
    ...s.starters,
    ...s.bench,
  ]);
  const openPlayerByStats = (st: PlayerSeasonStats) => {
    const found =
      allSquadPlayers.find((p) => p.id === st.playerId) ??
      resolvePlayerById({ playerId: st.playerId, fallbackStats: st });
    if (found) setInspected({ player: found, stats: st });
  };
  const openPlayerById = (pid: string) => {
    const found =
      allSquadPlayers.find((p) => p.id === pid) ??
      resolvePlayerById({ playerId: pid });
    if (found) setInspected({ player: found });
  };

  const tabs: [string, string, ReactNode][] = [
    ['league', '리그 기록', <Globe key="l" className="w-3.5 h-3.5 shrink-0" />],
    ['table', '순위표', <Trophy key="t" className="w-3.5 h-3.5 shrink-0" />],
    ...(cup
      ? [
          [
            'cup',
            cup.meta.koreanName,
            <Award key="cup" className="w-3.5 h-3.5 shrink-0" />,
          ] as [string, string, ReactNode],
        ]
      : []),
    ...orderedHumans.map(
      (h): [string, string, ReactNode] => [
        `club:${h.clubId}`,
        h.nickname,
        <BarChart3 key={h.clubId} className="w-3.5 h-3.5 shrink-0" />,
      ],
    ),
  ];
  const squadHuman = mainTab.startsWith('club:')
    ? humanByClub[mainTab.slice('club:'.length)]
    : undefined;
  const squadRank = squadHuman ? rankByClub[squadHuman.clubId] : undefined;

  return (
    <div className="modal-backdrop fixed inset-0 z-[65] bg-slate-950/90">
      <ModalBodyLock />
      <div className="modal-scroll h-full w-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-3 py-4 sm:px-5 sm:py-6 space-y-5">
        {/* Main Season Result Hero — aligned with solo SeasonSummary.tsx */}
        <section className="rounded-2xl border border-slate-800 bg-[#0e141d] p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/15 px-2.5 py-1 text-xs font-bold text-amber-300">
                  <Trophy className="w-3.5 h-3.5" />
                  리그 시즌 정산
                </span>
                <span className="rounded-md bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-200">
                  {leagueName}
                </span>
                {cupName && (
                  <span className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-200">
                    <PixelTrophySvg
                      variant={getDomesticCupTrophyVariant(leagueId ?? '')}
                      size={14}
                    />
                    <span className="truncate">컵 우승 {cupName}</span>
                    {cupChampionId && cupChampionId === myClubId && (
                      <span className="shrink-0 rounded bg-emerald-400 px-1 py-0.5 text-[8px] font-black leading-none text-slate-950">
                        MY
                      </span>
                    )}
                    {cupChampionId && friendLabelByClub[cupChampionId] && (
                      <FriendBadge label={friendLabelByClub[cupChampionId]} />
                    )}
                  </span>
                )}
              </div>
              {champion && (
                <h1 className="font-display text-2xl sm:text-4xl font-bold text-white">
                  {leagueName} 우승 · {champion.teamName}
                </h1>
              )}
            </div>

            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {!headingToUcl && (
                acked ? (
                  <span className="inline-flex min-w-0 items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-[11px] font-bold text-slate-300">
                    <Hourglass className="w-3.5 h-3.5 shrink-0 text-sky-300" />
                    <span className="shrink-0">다른 감독 대기 중</span>
                    {waitingNames.length > 0 && (
                      <span className="truncate text-sky-300">
                        {waitingNames.join(', ')}
                      </span>
                    )}
                  </span>
                ) : (
                  canContinue && (
                    <button
                      type="button"
                      onClick={onContinue}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-extrabold text-slate-950 shadow-lg hover:bg-emerald-400 cursor-pointer"
                    >
                      최종 결산으로
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )
                )
              )}
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="닫기"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-800 bg-[#121923] text-slate-300 hover:border-slate-600 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Friends Comparison Grid: Rank · Points · H2H · UCL Ticket */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {orderedHumans.map((human) => {
              const rank = rankByClub[human.clubId];
              const uclStatus: 'qualified' | 'missed' | 'off' = !uclEnabled
                ? 'off'
                : uclQualifiedSet.has(human.clubId)
                  ? 'qualified'
                  : 'missed';
              return (
                <FriendHeroCard
                  key={human.clubId}
                  human={human}
                  rank={rank}
                  row={rank ? standings[rank - 1] : undefined}
                  isMe={human.clubId === myClubId}
                  leagueId={leagueId}
                  leagueName={leagueName}
                  uclStatus={uclStatus}
                  h2h={h2hByClub?.[human.clubId]}
                  onClick={() => setInspectedClubId(human.clubId)}
                />
              );
            })}
          </div>
        </section>

        {/* Champions League Entry Gate Card — matches solo SeasonSummary.tsx CHAMPIONS LEAGUE GATE */}
        {headingToUcl && canContinue && (
          <section className="rounded-2xl border border-sky-500/35 bg-gradient-to-r from-[#0a1628] via-[#0e1d36] to-[#0c1422] p-4 sm:p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3.5">
                <div className="shrink-0 rounded-2xl border border-sky-400/30 bg-sky-500/10 p-2.5">
                  <PixelTrophySvg variant="ucl" size={48} animate />
                </div>
                <div className="space-y-1.5 min-w-0">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/20 px-2.5 py-0.5 text-[10px] font-black text-sky-300">
                    <Sparkles className="w-3 h-3" />
                    UEFA CHAMPIONS LEAGUE · 36팀 진입
                  </div>
                  <h2 className="text-base sm:text-lg font-extrabold text-white">
                    챔피언스리그 진출 확정 ({qualifiedHumans.length}명)
                  </h2>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {qualifiedHumans.map((h) => (
                      <span
                        key={h.clubId}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-sky-400/30 bg-[#0b1322] px-2 py-1 text-[11px] font-bold text-slate-100"
                      >
                        <PixelManagerAvatar
                          avatar={h.avatar}
                          clubPrimaryColor={h.profile.primaryColor}
                          clubSecondaryColor={h.profile.secondaryColor}
                          size={18}
                        />
                        {h.nickname}
                        <span className="font-mono text-[10px] text-sky-300">
                          #{rankByClub[h.clubId]}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="shrink-0">
                {acked ? (
                  <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs font-bold text-slate-300">
                    <Hourglass className="w-3.5 h-3.5 shrink-0 text-sky-300" />
                    <span>대기 중</span>
                    {waitingNames.length > 0 && (
                      <span className="text-sky-300">{waitingNames.join(', ')}</span>
                    )}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={onContinue}
                    className="inline-flex w-full md:w-auto items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-extrabold text-slate-950 shadow-lg hover:bg-emerald-400 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    챔피언스리그 진입
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Records Tab Bar */}
        <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-slate-800 bg-[#0e141d] p-1 sm:grid-cols-3 lg:flex">
          {tabs.map(([id, label, icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMainTab(id)}
              className={`inline-flex min-w-0 items-center justify-center gap-1.5 rounded-lg border py-2.5 px-2 text-xs font-bold transition-colors cursor-pointer lg:flex-1 ${
                mainTab === id
                  ? 'bg-slate-800 text-white border-emerald-500/50'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              {icon}
              <span className="truncate">{label}</span>
              {id === `club:${myClubId}` && (
                <span className="shrink-0 rounded bg-emerald-400 px-1 py-0.5 text-[8px] font-black leading-none text-slate-950">
                  MY
                </span>
              )}
            </button>
          ))}
        </div>

        {mainTab === 'league' && (
          <LeagueRecordsTab
            leagueName={leagueName}
            summary={summary}
            own={own}
            onInspectStats={openPlayerByStats}
          />
        )}

        {mainTab === 'table' && (
          <StandingsTable
            standings={tableStandings}
            clubsById={clubsById}
            uclSpots={leagueMeta?.uclSpots}
            relegationSpots={leagueMeta?.relegationSpots}
            onSelectClub={(clubId) => setInspectedClubId(clubId)}
          />
        )}

        {mainTab === 'cup' && cup && (
          <div className="rounded-2xl border border-slate-800 bg-[#0e141d] p-3 overflow-x-auto">
            <CupBracketView
              cup={cup}
              clubs={Object.values(clubsById)}
              leagueId={leagueId ?? 'epl'}
            />
          </div>
        )}

        {squadHuman && (
          <MpFriendSquadTab
            key={squadHuman.clubId}
            human={squadHuman}
            rank={squadRank}
            row={squadRank ? standings[squadRank - 1] : undefined}
            stats={summary.squadStats[squadHuman.clubId] ?? []}
            squad={squads[squadHuman.clubId]}
            onSelectPlayerId={openPlayerById}
            onOpenFormation={() => setInspectedClubId(squadHuman.clubId)}
          />
        )}
      </div>
      </div>

      {inspectedClubId && (() => {
        const targetHuman = humans.find((h) => h.clubId === inspectedClubId);
        const targetClub = clubsById[inspectedClubId] ?? null;
        const targetSquad = squads[inspectedClubId];
        const humanOwnedIds = new Set(
          Object.values(squads).flatMap((s) => [
            ...s.starters.map((p) => p.id),
            ...s.bench.map((p) => p.id),
          ]),
        );
        const roster = targetSquad
          ? [...targetSquad.starters, ...targetSquad.bench]
          : targetClub
            ? buildAiClubRoster(targetClub, leagueId ?? 'epl', humanOwnedIds)
            : [];
        const clubStatsList = summary.squadStats[inspectedClubId] ?? [];
        const statsMap = Object.fromEntries(
          clubStatsList.map((st) => [st.playerId, st]),
        );
        return (
          <ClubSquadModal
            club={targetClub}
            roster={roster}
            starters={targetSquad?.starters}
            bench={targetSquad?.bench}
            formation={targetSquad?.formation}
            tactic={targetSquad?.tactic}
            managerOverride={
              targetHuman
                ? {
                    name: `${targetHuman.nickname} 감독`,
                    traitId:
                      targetSquad?.managerTraitId ?? targetHuman.managerTraitId,
                    avatar: targetHuman.avatar,
                  }
                : null
            }
            defaultViewMode="formation"
            statsMap={statsMap}
            onSelectPlayer={(player) => {
              setInspected({
                player,
                stats: statsMap[player.id] ?? null,
              });
            }}
            onClose={() => setInspectedClubId(null)}
          />
        );
      })()}

      {inspected && (
        <PlayerDetailModal
          player={inspected.player}
          seasonStats={inspected.stats ?? null}
          onClose={() => setInspected(null)}
        />
      )}
    </div>
  );
}
