import {
  Award,
  BarChart3,
  ChevronDown,
  Crown,
  Globe,
  LogOut,
  Sparkles,
  Swords,
  Trophy,
} from 'lucide-react';
import { useState } from 'react';
import { HISTORICAL_BENCHMARK_TEAMS } from '../../../data/historicalTeams';
import {
  formatFfpScorePenaltyLabel,
  resolveFfpPenaltyTier,
} from '../../../engine/budgetEngine';
import { buildAiClubRoster, getLeagueById } from '../../../engine/dataLoader';
import { formatMainPositions } from '../../../engine/positionEngine';
import type { DomesticCupState } from '../../../types/cup';
import type {
  Club,
  LeagueId,
  PlayerSeasonStats,
  StandingRow,
} from '../../../types/league';
import type {
  MpFriendRankRow,
  MpLeagueFinal,
  MpLeagueHuman,
  MpSquadInput,
  MpUclLive,
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
import { StandingsTable } from '../../league/StandingsTable';
import { UclBracketTree } from '../../ucl/UclBracketTree';
import { MpBestXiPitchCard, MpFriendSquadTab } from './MpLeagueSeasonSummary';
import { buildUclViewForViewer } from './mpUclView';

interface MpLeagueFinalBoardProps {
  final: MpLeagueFinal;
  humans: MpLeagueHuman[];
  myClubId: string | null;
  leagueLabel: string;
  leagueId?: LeagueId;
  standings?: StandingRow[];
  clubsById?: Record<string, Club>;
  cup?: DomesticCupState | null;
  ucl?: MpUclLive | null;
  squads?: Record<string, MpSquadInput>;
  byClub?: Record<string, import('../../../types/mpLeague').MpHumanLive>;
  onOpenPodium?: () => void;
  onLeaveRoom: () => void;
}

type FinalTab = 'overview' | 'league' | 'cups' | 'squads';
type AwardRankTab = 'goals' | 'assists' | 'cleanSheets' | 'rating';

type CompareItem =
  | { kind: 'historical'; key: string; rank: number; name: string; score: number }
  | {
      kind: 'friend';
      key: string;
      rank: number;
      score: number;
      row: MpFriendRankRow;
    }
  | { kind: 'gap'; key: string };

function findHuman(
  humans: MpLeagueHuman[],
  row: MpFriendRankRow,
): MpLeagueHuman | undefined {
  return (
    humans.find((h) => h.playerId === row.playerId) ??
    humans.find((h) => h.clubId === row.clubId)
  );
}

function friendBadgeLabel(human: MpLeagueHuman): string {
  const nick = Array.from(human.nickname.trim()).slice(0, 2).join('');
  return nick || human.profile.shortName;
}

function buildCompareItems(rows: MpFriendRankRow[]): CompareItem[] {
  const hist = HISTORICAL_BENCHMARK_TEAMS;
  const shown = new Set<number>();
  for (let i = 0; i < Math.min(3, hist.length); i += 1) shown.add(i);

  const friends = rows.map((row) => {
    const score = row.seasonScore.totalScore;
    const higher = hist.filter((h) => h.seasonScore.totalScore > score).length;
    if (higher - 1 >= 0) shown.add(higher - 1);
    if (higher < hist.length) shown.add(higher);
    return { row, score, higher };
  });
  friends.sort((a, b) => b.score - a.score || a.row.rank - b.row.rank);

  const items: CompareItem[] = [];
  let lastHist = -1;
  let fi = 0;
  const pushFriendsBefore = (histIdx: number) => {
    while (fi < friends.length && friends[fi].higher <= histIdx) {
      const f = friends[fi];
      items.push({
        kind: 'friend',
        key: `f-${f.row.clubId}`,
        rank: f.higher + 1,
        score: f.score,
        row: f.row,
      });
      fi += 1;
    }
  };

  const indices = [...shown].sort((a, b) => a - b);
  for (const i of indices) {
    pushFriendsBefore(i);
    if (i > lastHist + 1) items.push({ kind: 'gap', key: `gap-${i}` });
    const h = hist[i];
    items.push({
      kind: 'historical',
      key: `h-${h.id}`,
      rank: i + 1,
      name: h.displayName,
      score: h.seasonScore.totalScore,
    });
    lastHist = i;
  }
  pushFriendsBefore(hist.length);
  if (lastHist < hist.length - 1) items.push({ kind: 'gap', key: 'gap-end' });
  return items;
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-slate-800 bg-[#0b1018] px-1.5 py-0.5 text-[10px] font-bold text-slate-300">
      <span className="text-slate-500">{label}</span>
      {value}
    </span>
  );
}

function FriendRankCard({
  row,
  human,
  isMe,
  wonLeague,
  wonCup,
  wonUcl,
  leagueId,
}: {
  row: MpFriendRankRow;
  human: MpLeagueHuman | undefined;
  isMe: boolean;
  wonLeague: boolean;
  wonCup: boolean;
  wonUcl: boolean;
  leagueId?: LeagueId;
}) {
  const [open, setOpen] = useState<boolean>(row.rank === 1);
  const first = row.rank === 1;
  const isTreble = wonLeague && wonCup && wonUcl;
  const s = row.seasonScore;
  const parts: { label: string; value: number; highlight?: boolean }[] = [
    { label: '리그 환산(PPG×38)', value: s.leagueConvertedScore },
    {
      label:
        typeof s.leagueDifficultyFactor === 'number'
          ? `리그 순위 (×${s.leagueDifficultyFactor.toFixed(2)})`
          : '리그 순위',
      value: s.leagueRankBonus,
    },
    { label: '자국 컵', value: s.cupBonus },
    { label: '챔피언스리그', value: s.uclBonus },
    { label: '대업·대기록', value: s.honorsBonus },
    { label: '스쿼드·감독 시너지', value: s.squadCraftBonus ?? 0, highlight: true },
    { label: '언더독 보너스', value: s.underdogBonus },
    { label: '개인 수상 보너스', value: s.awardsBonus ?? 0, highlight: true },
  ];

  return (
    <div
      className={`rounded-2xl border transition-colors ${
        first
          ? 'border-amber-400/45 bg-amber-500/[0.06]'
          : isMe
            ? 'border-emerald-500/40 bg-[#101925]'
            : 'border-slate-800 bg-[#111822]'
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full cursor-pointer px-3.5 py-3 text-left"
      >
        <div className="flex items-center gap-2.5 sm:gap-3">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-display text-lg font-black ${
              first
                ? 'bg-amber-400 text-slate-950'
                : 'border border-slate-700 bg-[#0b1018] text-slate-300'
            }`}
          >
            {row.rank}
          </span>
          <div className="flex h-11 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-800 bg-[#0b1018]">
            <PixelManagerAvatar
              avatar={human?.avatar}
              clubPrimaryColor={human?.profile.primaryColor}
              clubSecondaryColor={human?.profile.secondaryColor}
              size={34}
            />
          </div>
          {human && (
            <JerseySvg
              primaryColor={human.profile.primaryColor}
              secondaryColor={human.profile.secondaryColor}
              pattern={human.profile.pattern}
              label={human.profile.shortName}
              size={32}
              className="hidden sm:block shrink-0"
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="truncate text-sm font-extrabold text-white">
                {human?.nickname ?? '감독'}
              </span>
              {isMe && (
                <span className="shrink-0 rounded bg-emerald-400 px-1 py-0.5 text-[8px] font-black leading-none text-slate-950">
                  MY
                </span>
              )}
              <span className="shrink-0 rounded bg-amber-400/20 border border-amber-400/40 px-1.5 py-px font-mono text-[10px] font-black text-amber-300">
                {s.grade}
              </span>
              {isTreble && (
                <span className="shrink-0 rounded bg-amber-400 px-1.5 py-px text-[9px] font-black text-slate-950">
                  👑 트레블
                </span>
              )}
              {wonLeague && (
                <PixelTrophySvg
                  variant={getLeagueTrophyVariant(leagueId ?? '')}
                  size={16}
                />
              )}
              {wonCup && (
                <PixelTrophySvg
                  variant={getDomesticCupTrophyVariant(leagueId ?? '')}
                  size={16}
                />
              )}
              {wonUcl && <PixelTrophySvg variant="ucl" size={16} />}
            </div>
            <div className="truncate text-[11px] font-semibold text-slate-400">
              {human?.profile.name ?? row.clubId}
            </div>
          </div>
          <div className="shrink-0 text-right tabular-nums">
            <div className="text-[9px] font-bold text-slate-500">최종 합계</div>
            <div
              className={`font-display text-xl sm:text-2xl font-black leading-none ${
                first ? 'text-amber-300' : 'text-white'
              }`}
            >
              {row.total.toLocaleString()}
            </div>
          </div>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${
              open ? 'rotate-180' : ''
            }`}
          />
        </div>

        {/* Score formula + H2H + Competition Chips */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px] font-bold tabular-nums">
          <span className="rounded-md border border-slate-800 bg-[#0b1018] px-2 py-0.5 text-slate-300">
            시즌 <strong className="font-mono text-white">{s.totalScore.toLocaleString()}</strong>
          </span>
          <span className="text-slate-500">+</span>
          <span className="inline-flex items-center gap-1 rounded-md border border-sky-500/35 bg-sky-500/10 px-2 py-0.5 text-sky-200">
            <Swords className="w-3 h-3" />
            맞대결 <strong className="font-mono">+{row.h2hPoints.toLocaleString()}</strong>
            <span className="text-[10px] text-sky-300/80">
              ({row.h2h.won}승 {row.h2h.drawn}무 {row.h2h.lost}패)
            </span>
          </span>
          <Chip label="리그" value={`${row.leagueRank}위 · ${row.leaguePoints}점`} />
          <Chip label="컵" value={row.cupLabel} />
          <Chip label="챔스" value={row.uclLabel} />
        </div>
      </button>

      {/* Expandable Solo-Identical 8-Item Fair Season Score Grid */}
      {open && (
        <div className="border-t border-slate-800/80 px-3.5 py-3 space-y-2.5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8 text-center tabular-nums">
            {parts.map((p) => (
              <div
                key={p.label}
                className={`rounded-xl border p-2 ${
                  p.highlight && p.value > 0
                    ? 'border-amber-400/40 bg-amber-500/10'
                    : 'border-slate-800 bg-[#090e15]'
                }`}
              >
                <div className="text-[9px] text-slate-400 truncate">{p.label}</div>
                <div
                  className={`mt-0.5 font-mono text-xs font-black ${
                    p.highlight && p.value > 0 ? 'text-amber-300' : 'text-emerald-300'
                  }`}
                >
                  +{p.value.toLocaleString()}
                </div>
              </div>
            ))}
          </div>

          {s.ffpPenaltyPoints && s.ffpPenaltyPoints > 0 && (() => {
            const tier = resolveFfpPenaltyTier(s.ffpPenaltyPct, s.ffpTier);
            const isTier1 = tier === 1;
            return (
              <div
                className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-1.5 text-[10px] tabular-nums ${
                  isTier1
                    ? 'border-amber-400/35 bg-amber-500/10 text-amber-200'
                    : 'border-rose-500/35 bg-rose-500/10 text-rose-200'
                }`}
              >
                <span className={`font-bold ${isTier1 ? 'text-amber-300' : 'text-rose-300'}`}>
                  {formatFfpScorePenaltyLabel(s.ffpPenaltyPct, s.ffpTier)}
                </span>
                <span className={`font-mono font-black ${isTier1 ? 'text-amber-300' : 'text-rose-300'}`}>
                  -{s.ffpPenaltyPoints.toLocaleString()}점
                </span>
              </div>
            );
          })()}

          {s.honorsBonusDetails && s.honorsBonusDetails.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-1.5 text-[10px] text-amber-200">
              <span className="font-bold text-amber-300">대업·대기록:</span>
              {s.honorsBonusDetails.map((d) => (
                <span key={d} className="rounded bg-[#090e15] px-1.5 py-0.5 font-semibold text-amber-100">
                  {d}
                </span>
              ))}
            </div>
          )}

          {s.squadCraftDetails && s.squadCraftDetails.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 text-[10px] text-emerald-200">
              <span className="font-bold text-emerald-300">전력·시너지:</span>
              {s.squadCraftDetails.map((d) => (
                <span key={d} className="rounded bg-[#090e15] px-1.5 py-0.5 font-semibold text-emerald-100">
                  {d}
                </span>
              ))}
            </div>
          )}

          {s.awardsBonusDetails && s.awardsBonusDetails.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-sky-500/20 bg-sky-500/5 px-3 py-1.5 text-[10px] text-sky-200">
              <span className="font-bold text-sky-300">개인 수상:</span>
              {s.awardsBonusDetails.map((d) => (
                <span key={d} className="rounded bg-[#090e15] px-1.5 py-0.5 font-semibold text-sky-100">
                  {d}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function MpLeagueFinalBoard({
  final,
  humans,
  myClubId,
  leagueLabel,
  leagueId,
  standings = [],
  clubsById = {},
  cup = null,
  ucl = null,
  squads = {},
  byClub = {},
  onOpenPodium,
  onLeaveRoom,
}: MpLeagueFinalBoardProps) {
  const [mainTab, setMainTab] = useState<FinalTab>('overview');
  const [rankTab, setRankTab] = useState<AwardRankTab>('goals');
  const [selectedSquadClubId, setSelectedSquadClubId] = useState<string>(
    myClubId ?? humans[0]?.clubId ?? '',
  );
  const [inspectedClubId, setInspectedClubId] = useState<string | null>(null);
  const [inspected, setInspected] = useState<{
    player: Player;
    stats?: PlayerSeasonStats | null;
  } | null>(null);

  const leagueMeta = leagueId ? getLeagueById(leagueId) : null;
  const leagueName = leagueMeta?.koreanName ?? leagueLabel;
  const compareItems = buildCompareItems(final.rows);

  const humanByClub: Record<string, MpLeagueHuman> = {};
  const friendLabelByClub: Record<string, string> = {};
  for (const h of humans) {
    humanByClub[h.clubId] = h;
    if (h.clubId !== myClubId) friendLabelByClub[h.clubId] = friendBadgeLabel(h);
  }
  const own = { myClubId, friendLabelByClub };

  const rankByClub: Record<string, number> = {};
  standings.forEach((r, i) => {
    rankByClub[r.teamId] = i + 1;
  });

  const winnerRow = final.rows[0] ?? null;
  const winnerHuman = winnerRow ? findHuman(humans, winnerRow) : undefined;
  const uclChampName = final.uclChampionId
    ? clubsById[final.uclChampionId]?.name ?? humanByClub[final.uclChampionId]?.profile.name
    : null;
  const leagueChampName = final.championClubId
    ? clubsById[final.championClubId]?.name ?? humanByClub[final.championClubId]?.profile.name
    : null;
  const cupChampName = final.cupChampionId
    ? clubsById[final.cupChampionId]?.name ?? humanByClub[final.cupChampionId]?.profile.name
    : null;

  const uclView = ucl ? buildUclViewForViewer(ucl, myClubId) : null;

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

  const globalAwards = final.globalAwards;
  const awards = final.awards;
  const activeLeaderboard: PlayerSeasonStats[] = awards
    ? rankTab === 'goals'
      ? awards.topScorers
      : rankTab === 'assists'
        ? awards.topAssisters
        : rankTab === 'cleanSheets'
          ? awards.topCleanSheets
          : awards.topRatings
    : [];

  const tableStandings = standings.map((row) => ({
    ...row,
    isUser: myClubId !== null && row.teamId === myClubId,
  }));

  const selectedSquadHuman =
    humanByClub[selectedSquadClubId] ?? humans[0] ?? null;

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-3 py-4 sm:px-5 sm:py-6">
      {/* Main Season Final Hero — matches solo SeasonSummary.tsx */}
      <section className="rounded-2xl border border-slate-800 bg-[#0e141d] p-4 sm:p-6 space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/15 px-2.5 py-1 text-xs font-bold text-amber-300">
                <Trophy className="w-3.5 h-3.5" />
                최종 시즌 결산 · {leagueName}
              </span>
              {leagueChampName && (
                <span className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-200">
                  <PixelTrophySvg variant={getLeagueTrophyVariant(leagueId ?? '')} size={14} />
                  리그 {leagueChampName}
                </span>
              )}
              {cupChampName && (
                <span className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-200">
                  <PixelTrophySvg variant={getDomesticCupTrophyVariant(leagueId ?? '')} size={14} />
                  컵 {cupChampName}
                </span>
              )}
              {uclChampName && (
                <span className="inline-flex items-center gap-1 rounded-md bg-sky-500/15 px-2.5 py-1 text-xs font-bold text-sky-300">
                  <PixelTrophySvg variant="ucl" size={14} />
                  UCL {uclChampName}
                </span>
              )}
            </div>

            <h1 className="font-display text-2xl sm:text-4xl font-bold text-white">
              {winnerHuman
                ? `${winnerHuman.nickname} 감독 · 최종 종합 1위`
                : '시즌 최종 결산'}
            </h1>

            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              {onOpenPodium && (
                <button
                  type="button"
                  onClick={onOpenPodium}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-amber-400 px-4 py-2 text-xs font-black text-slate-950 hover:bg-amber-300"
                >
                  <Trophy className="h-3.5 w-3.5" />
                  시상대 다시 보기
                </button>
              )}
              <button
                type="button"
                onClick={onLeaveRoom}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-700 bg-[#121923] px-4 py-2 text-xs font-bold text-slate-300 hover:border-slate-500 hover:text-white"
              >
                <LogOut className="h-3.5 w-3.5" />
                방 나가기
              </button>
            </div>
          </div>

          {/* Season Winner Showcase Card (matching solo hero right card) */}
          {winnerHuman && winnerRow && (
            <div className="flex items-center gap-3.5 rounded-xl border border-amber-400/35 bg-[#090e15] p-4 shrink-0">
              <div className="flex h-16 w-14 items-center justify-center rounded-xl border border-amber-400/40 bg-amber-500/10">
                <PixelTrophySvg
                  variant={
                    final.uclChampionId === winnerRow.clubId
                      ? 'ucl'
                      : getLeagueTrophyVariant(leagueId ?? '')
                  }
                  size={44}
                  animate
                />
              </div>
              <JerseySvg
                primaryColor={winnerHuman.profile.primaryColor}
                secondaryColor={winnerHuman.profile.secondaryColor}
                pattern={winnerHuman.profile.pattern}
                label={winnerHuman.profile.shortName}
                size={52}
              />
              <div className="flex h-16 w-14 items-center justify-center rounded-xl border border-slate-800 bg-[#111824]">
                <PixelManagerAvatar
                  avatar={winnerHuman.avatar}
                  clubPrimaryColor={winnerHuman.profile.primaryColor}
                  clubSecondaryColor={winnerHuman.profile.secondaryColor}
                  size={44}
                />
              </div>
              <div className="tabular-nums">
                <div className="font-display text-2xl font-bold text-amber-300">
                  {winnerRow.total.toLocaleString()}
                </div>
                <div className="text-xs font-bold text-white">
                  {winnerHuman.profile.name}
                </div>
                <div className="text-[11px] text-slate-400">
                  {winnerHuman.nickname} · 등급 {winnerRow.seasonScore.grade}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Board A: Friends Final Leaderboard & 8-Item Score Breakdown */}
      <section className="space-y-2.5 rounded-2xl border border-slate-800 bg-[#0e141d] p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-extrabold text-white">
            <Crown className="w-4 h-4 text-amber-400" />
            참가자 최종 순위 · 맞대결 비교
          </h2>
          <span className="text-[11px] text-slate-400">
            클릭하여 8항목 세부 점수 펼치기
          </span>
        </div>
        <div className="space-y-2.5">
          {final.rows.map((row) => (
            <FriendRankCard
              key={row.clubId}
              row={row}
              human={findHuman(humans, row)}
              isMe={myClubId !== null && row.clubId === myClubId}
              wonLeague={final.championClubId === row.clubId}
              wonCup={final.cupChampionId === row.clubId}
              wonUcl={final.uclChampionId === row.clubId}
              leagueId={leagueId}
            />
          ))}
        </div>
      </section>

      {/* Solo-Style Full Competition Records Tabs */}
      <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-slate-800 bg-[#0e141d] p-1 sm:grid-cols-4">
        {(
          [
            ['overview', '발롱도르 · 역대 비교', <Award key="o" className="w-3.5 h-3.5" />],
            ['league', '리그 기록 · 순위표', <Globe key="l" className="w-3.5 h-3.5" />],
            ['cups', '컵 · 챔피언스리그', <Sparkles key="c" className="w-3.5 h-3.5" />],
            ['squads', '내 팀 결산 · 스쿼드', <BarChart3 key="s" className="w-3.5 h-3.5" />],
          ] as [FinalTab, string, React.ReactNode][]
        ).map(([id, label, icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setMainTab(id)}
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg border py-2.5 px-2 text-xs font-bold transition-colors cursor-pointer ${
              mainTab === id
                ? 'bg-slate-800 text-white border-emerald-500/50'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            {icon}
            <span className="truncate">{label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: BALLON D'OR + WORLD BEST XI + HISTORICAL 24-TEAM COMPARISON */}
      {mainTab === 'overview' && (
        <div className="space-y-5">
          {globalAwards && (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
              <div className="lg:col-span-6 space-y-4">
                {globalAwards.ballonDorWinner && (
                  <div className="card-legend-glow relative w-full overflow-hidden rounded-2xl p-5 text-left">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1.5 min-w-0">
                        <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-2.5 py-0.5 text-[10px] font-black text-slate-950">
                          <Crown className="w-3 h-3" />
                          BALLON D&apos;OR · 시즌 발롱도르 수상자
                        </div>
                        <div>
                          <PlayerNameButton
                            onClick={() =>
                              openPlayerByStats(globalAwards.ballonDorWinner!.stats)
                            }
                            className="font-display text-3xl font-bold text-white"
                          >
                            {globalAwards.ballonDorWinner.stats.playerName}
                          </PlayerNameButton>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-amber-200">
                          <ClubTag
                            shortName={globalAwards.ballonDorWinner.stats.teamShortName}
                            primaryColor={globalAwards.ballonDorWinner.stats.teamPrimaryColor}
                            isUserTeam={
                              myClubId !== null &&
                              globalAwards.ballonDorWinner.stats.teamId === myClubId
                            }
                            size="sm"
                          />
                          {friendLabelByClub[globalAwards.ballonDorWinner.stats.teamId] && (
                            <span className="rounded bg-sky-400 px-1 py-0.5 text-[8px] font-black text-slate-950">
                              {friendLabelByClub[globalAwards.ballonDorWinner.stats.teamId]}
                            </span>
                          )}
                          <span className="font-semibold">
                            {globalAwards.ballonDorWinner.stats.teamName} (
                            {formatMainPositions({
                              mainPositions:
                                globalAwards.ballonDorWinner.stats.mainPositions,
                            })}
                            )
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 pt-1">
                          {globalAwards.ballonDorWinner.reason}
                        </p>
                      </div>

                      <div className="flex flex-col items-center shrink-0">
                        <PixelTrophySvg variant="ballon_dor" size={64} animate />
                        <span className="mt-1 font-display text-sm font-bold text-amber-300">
                          평점 {globalAwards.ballonDorWinner.stats.avgRating.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs tabular-nums">
                      <div className="rounded-lg bg-slate-950/75 p-2">
                        <div className="text-[10px] text-slate-400">출전</div>
                        <div className="font-display text-base font-bold text-white">
                          {globalAwards.ballonDorWinner.stats.appearances}
                        </div>
                      </div>
                      <div className="rounded-lg bg-slate-950/75 p-2">
                        <div className="text-[10px] text-slate-400">득점</div>
                        <div className="font-display text-base font-bold text-emerald-300">
                          {globalAwards.ballonDorWinner.stats.goals}
                        </div>
                      </div>
                      <div className="rounded-lg bg-slate-950/75 p-2">
                        <div className="text-[10px] text-slate-400">도움</div>
                        <div className="font-display text-base font-bold text-sky-300">
                          {globalAwards.ballonDorWinner.stats.assists}
                        </div>
                      </div>
                      <div className="rounded-lg bg-slate-950/75 p-2">
                        <div className="text-[10px] text-slate-400">MOM</div>
                        <div className="font-display text-base font-bold text-amber-300">
                          {globalAwards.ballonDorWinner.stats.momCount}회
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Ballon d'Or TOP 5 */}
                <div className="rounded-2xl border border-slate-800 bg-[#0e141d] p-4 space-y-2.5">
                  <div className="text-xs font-bold text-white">
                    🏆 발롱도르 최종 후보 TOP 5
                  </div>
                  <div className="space-y-1.5">
                    {globalAwards.ballonDorTop5.map((cand) => {
                      const isMine =
                        myClubId !== null && cand.stats.teamId === myClubId;
                      const friendLbl = isMine
                        ? undefined
                        : friendLabelByClub[cand.stats.teamId];
                      return (
                        <div
                          key={`${cand.stats.teamId}-${cand.stats.playerId}`}
                          className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-xs ${
                            isMine
                              ? 'border-emerald-500/45 bg-emerald-500/10'
                              : friendLbl
                                ? 'border-sky-500/35 bg-sky-500/10'
                                : 'border-slate-800 bg-[#090e15]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md font-display text-xs font-bold ${
                                cand.rank === 1
                                  ? 'bg-amber-400 text-slate-950'
                                  : cand.rank <= 3
                                    ? 'bg-slate-700 text-white'
                                    : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {cand.rank}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <PlayerNameButton
                                  onClick={() => openPlayerByStats(cand.stats)}
                                  className="font-bold text-white"
                                >
                                  {cand.stats.playerName}
                                </PlayerNameButton>
                                <ClubTag
                                  shortName={cand.stats.teamShortName}
                                  primaryColor={cand.stats.teamPrimaryColor}
                                  isUserTeam={isMine}
                                />
                                {friendLbl && (
                                  <span className="rounded bg-sky-400 px-1 py-0.5 text-[8px] font-black text-slate-950">
                                    {friendLbl}
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate">
                                {cand.reason}
                              </div>
                            </div>
                          </div>
                          <div className="text-right font-mono shrink-0">
                            <div className="text-xs font-bold text-amber-300">
                              {cand.stats.goals}G {cand.stats.assists}A
                            </div>
                            <div className="text-[10px] text-slate-400">
                              평점 {cand.stats.avgRating.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-6">
                <div className="mx-auto max-w-[460px]">
                  <MpBestXiPitchCard
                    title="FIFA 월드베스트 XI (4-3-3)"
                    entries={globalAwards.worldBestXi}
                    accentLabel={`우리 팀 ${globalAwards.worldBestXi.filter((x) => myClubId && x.stats.teamId === myClubId).length}명`}
                    own={own}
                    onSelectPlayer={openPlayerByStats}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Board B: Historical 24-Team Benchmark Comparison */}
          <section className="space-y-2.5 rounded-2xl border border-slate-800 bg-[#0e141d] p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-extrabold text-white">
                🏛️ 역대 강팀 24팀 비교
              </h3>
              <span className="rounded-md border border-slate-800 bg-[#0b1018] px-2 py-0.5 text-[10px] font-bold text-slate-400">
                맞대결 점수 제외 · 동일 공식
              </span>
            </div>
            <div className="space-y-1">
              {compareItems.map((item) => {
                if (item.kind === 'gap') {
                  return (
                    <div
                      key={item.key}
                      className="py-0.5 text-center text-[11px] font-bold leading-none text-slate-600"
                    >
                      …
                    </div>
                  );
                }
                if (item.kind === 'historical') {
                  return (
                    <div
                      key={item.key}
                      className="flex items-center gap-2.5 rounded-lg border border-slate-800 bg-[#111822] px-2.5 py-1.5"
                    >
                      <span className="w-6 shrink-0 text-center font-mono text-xs font-bold text-slate-500">
                        {item.rank}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs font-bold text-slate-300">
                        {item.name}
                      </span>
                      <span className="shrink-0 font-mono text-xs font-bold text-slate-300 tabular-nums">
                        {item.score.toLocaleString()}
                      </span>
                    </div>
                  );
                }
                const human = findHuman(humans, item.row);
                const isMe = myClubId !== null && item.row.clubId === myClubId;
                return (
                  <div
                    key={item.key}
                    className={`flex items-center gap-2.5 rounded-lg border px-2.5 py-1.5 ${
                      isMe
                        ? 'border-emerald-500/40 bg-emerald-500/12'
                        : 'border-sky-500/30 bg-sky-500/10'
                    }`}
                  >
                    <span className="w-6 shrink-0 text-center font-mono text-xs font-black text-emerald-300">
                      {item.rank}
                    </span>
                    <div className="shrink-0">
                      <PixelManagerAvatar
                        avatar={human?.avatar}
                        clubPrimaryColor={human?.profile.primaryColor}
                        clubSecondaryColor={human?.profile.secondaryColor}
                        size={26}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-xs font-extrabold text-white">
                          {human?.nickname ?? '감독'} ({human?.profile.name ?? ''})
                        </span>
                        {isMe && (
                          <span className="shrink-0 rounded bg-emerald-400 px-1 py-0.5 text-[8px] font-black text-slate-950">
                            MY
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] font-bold text-emerald-300/80">
                        역대 {item.row.historicalRank}위 / {item.row.historicalTotal}팀
                      </div>
                    </div>
                    <span className="shrink-0 font-mono text-sm font-black text-emerald-200 tabular-nums">
                      {item.score.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* TAB 2: LEAGUE AWARDS + BEST XI + FINAL STANDINGS */}
      {mainTab === 'league' && (
        <div className="space-y-5">
          {awards && (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
              <div className="lg:col-span-6 space-y-4">
                {awards.poty && (
                  <div className="w-full rounded-2xl border border-amber-400/35 bg-[#121925] p-5 text-left">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                          <Crown className="w-3 h-3" />
                          {leagueName} 올해의 선수 (리그 MVP)
                        </span>
                        <div className="mt-1.5">
                          <PlayerNameButton
                            onClick={() => openPlayerByStats(awards.poty!)}
                            className="font-display text-2xl font-bold text-white"
                          >
                            {awards.poty.playerName}
                          </PlayerNameButton>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-slate-300">
                          <ClubTag
                            shortName={awards.poty.teamShortName}
                            primaryColor={awards.poty.teamPrimaryColor}
                            isUserTeam={
                              myClubId !== null && awards.poty.teamId === myClubId
                            }
                          />
                          <span>{awards.poty.teamName}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[10px] text-amber-300">평균 평점</div>
                        <div className="font-display text-3xl font-bold text-amber-300">
                          {awards.poty.avgRating.toFixed(2)}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {awards.poty.goals}G {awards.poty.assists}A · MOM {awards.poty.momCount}회
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="rounded-2xl border border-slate-800 bg-[#0e141d] p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <Award className="w-4 h-4 text-emerald-400" />
                    {leagueName} 개인 기록 TOP 10
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
                            myClubId !== null && st.teamId === myClubId;
                          const friendLbl = isMine
                            ? undefined
                            : friendLabelByClub[st.teamId];
                          const nat = getPlayerNationalityMeta(st.playerId);
                          return (
                            <tr
                              key={`${st.teamId}-${st.playerId}`}
                              className={
                                isMine
                                  ? 'bg-emerald-500/15'
                                  : friendLbl
                                    ? 'bg-sky-500/10'
                                    : ''
                              }
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
                                    onClick={() => openPlayerByStats(st)}
                                    className="font-bold text-slate-100"
                                  >
                                    {st.playerName}
                                  </PlayerNameButton>
                                  <ClubTag
                                    shortName={st.teamShortName}
                                    primaryColor={st.teamPrimaryColor}
                                    isUserTeam={isMine}
                                  />
                                  {friendLbl && (
                                    <span className="rounded bg-sky-400 px-1 py-0.5 text-[8px] font-black text-slate-950">
                                      {friendLbl}
                                    </span>
                                  )}
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
                    own={own}
                    onSelectPlayer={openPlayerByStats}
                  />
                </div>
              </div>
            </div>
          )}

          {tableStandings.length > 0 && (
            <StandingsTable
              standings={tableStandings}
              clubsById={clubsById}
              uclSpots={leagueMeta?.uclSpots}
              relegationSpots={leagueMeta?.relegationSpots}
              onSelectClub={(clubId) => setInspectedClubId(clubId)}
            />
          )}
        </div>
      )}

      {/* TAB 3: DOMESTIC CUP + UCL BRACKET */}
      {mainTab === 'cups' && (
        <div className="space-y-5">
          {uclView && (
            <div className="rounded-2xl border border-slate-800 bg-[#0e141d] p-4 space-y-3 overflow-x-auto">
              <div className="flex items-center gap-2 text-sm font-extrabold text-sky-300">
                <PixelTrophySvg variant="ucl" size={18} />
                UEFA 챔피언스리그 토너먼트 대진표
              </div>
              <UclBracketTree ucl={uclView.ucl} clubsById={uclView.clubsById} />
            </div>
          )}
          {cup && (
            <div className="rounded-2xl border border-slate-800 bg-[#0e141d] p-4 space-y-3 overflow-x-auto">
              <div className="flex items-center gap-2 text-sm font-extrabold text-amber-300">
                <PixelTrophySvg
                  variant={getDomesticCupTrophyVariant(leagueId ?? '')}
                  size={18}
                />
                {cup.meta.koreanName} 토너먼트 대진표
              </div>
              <CupBracketView
                cup={cup}
                clubs={Object.values(clubsById)}
                leagueId={leagueId ?? 'epl'}
              />
            </div>
          )}
        </div>
      )}

      {/* TAB 4: PER-FRIEND SQUAD ANALYTICS */}
      {mainTab === 'squads' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {final.rows.map((row) => {
              const h = findHuman(humans, row);
              if (!h) return null;
              const active = selectedSquadHuman?.clubId === h.clubId;
              return (
                <button
                  key={h.clubId}
                  type="button"
                  onClick={() => setSelectedSquadClubId(h.clubId)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold cursor-pointer transition-colors ${
                    active
                      ? 'bg-slate-800 text-white border-emerald-500/50'
                      : 'border-slate-800 bg-[#111822] text-slate-400 hover:text-white'
                  }`}
                >
                  <PixelManagerAvatar
                    avatar={h.avatar}
                    clubPrimaryColor={h.profile.primaryColor}
                    clubSecondaryColor={h.profile.secondaryColor}
                    size={18}
                  />
                  {h.nickname}
                  {h.clubId === myClubId && (
                    <span className="rounded bg-emerald-400 px-1 py-0.5 text-[8px] font-black text-slate-950">
                      MY
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {selectedSquadHuman && (() => {
            const hMeta = byClub[selectedSquadHuman.clubId];
            const fRow = final.rows.find(
              (r) => r.clubId === selectedSquadHuman.clubId,
            );
            const hRank = rankByClub[selectedSquadHuman.clubId];
            const honors: import('../../common/TeamSeasonArchiveTab').TeamArchiveHonorBadge[] = [];
            const wonLg = final.championClubId === selectedSquadHuman.clubId;
            const wonCp = final.cupChampionId === selectedSquadHuman.clubId;
            const wonUc = final.uclChampionId === selectedSquadHuman.clubId;
            if (wonLg && wonCp && wonUc) {
              honors.push({ label: '👑 역사적 트레블', tone: 'gold' });
            }
            if (wonLg) {
              honors.push({ label: `🏆 ${leagueName} 우승`, tone: 'gold' });
            }
            if (wonCp && cup) {
              honors.push({ label: `🏆 ${cup.meta.koreanName} 우승`, tone: 'gold' });
            }
            if (wonUc) {
              honors.push({ label: '🏆 UEFA 챔피언스리그 우승', tone: 'sky' });
            }
            if (final.rows[0]?.clubId === selectedSquadHuman.clubId) {
              honors.push({ label: '🥇 멀티 시즌 최종 1위', tone: 'emerald' });
            }
            return (
              <MpFriendSquadTab
                key={selectedSquadHuman.clubId}
                human={selectedSquadHuman}
                rank={hRank}
                row={hRank ? standings[hRank - 1] : undefined}
                stats={final.squadStats?.[selectedSquadHuman.clubId] ?? []}
                squad={squads[selectedSquadHuman.clubId]}
                leagueName={leagueName}
                milestoneLabel="UCL 포함 통합 최종 스쿼드"
                staffCoachId={hMeta?.staffCoach?.hiredCoachId ?? null}
                budgetState={hMeta?.budget ?? null}
                cupResultLabel={wonCp ? '우승' : cup ? '참가' : null}
                uclResultLabel={wonUc ? '우승' : ucl ? '참가' : null}
                seasonScore={
                  fRow
                    ? {
                        totalScore: fRow.total,
                        grade: fRow.seasonScore.grade,
                      }
                    : null
                }
                honors={honors}
                onSelectPlayerId={openPlayerById}
                onOpenFormation={() =>
                  setInspectedClubId(selectedSquadHuman.clubId)
                }
              />
            );
          })()}
        </div>
      )}

      {inspectedClubId && (() => {
        const targetHuman = humans.find((h) => h.clubId === inspectedClubId);
        const targetClub =
          clubsById[inspectedClubId] ??
          uclView?.clubsById?.[inspectedClubId] ??
          null;
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
        const clubStatsList = final.squadStats?.[inspectedClubId] ?? [];
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
