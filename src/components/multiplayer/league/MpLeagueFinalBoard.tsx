import { ChevronDown, LogOut, Trophy } from 'lucide-react';
import { useState } from 'react';
import { HISTORICAL_BENCHMARK_TEAMS } from '../../../data/historicalTeams';
import type {
  MpFriendRankRow,
  MpLeagueFinal,
  MpLeagueHuman,
} from '../../../types/mpLeague';
import { JerseySvg } from '../../common/JerseySvg';
import { PixelManagerAvatar } from '../../common/PixelManagerAvatar';

interface MpLeagueFinalBoardProps {
  final: MpLeagueFinal;
  humans: MpLeagueHuman[];
  myClubId: string | null;
  leagueLabel: string;
  onOpenPodium?: () => void;
  onLeaveRoom: () => void;
}

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
  // Stable order for friends sharing the same slot: higher score first, then friend rank
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
}: {
  row: MpFriendRankRow;
  human: MpLeagueHuman | undefined;
  isMe: boolean;
}) {
  const [open, setOpen] = useState<boolean>(false);
  const first = row.rank === 1;
  const s = row.seasonScore;
  const parts: { label: string; value: number }[] = [
    { label: '리그 환산', value: s.leagueConvertedScore },
    { label: '리그 순위', value: s.leagueRankBonus },
    { label: '자국 컵', value: s.cupBonus },
    { label: '챔스', value: s.uclBonus },
    { label: '대기록', value: s.honorsBonus },
    { label: '언더독', value: s.underdogBonus },
    { label: '스쿼드 완성도', value: s.squadCraftBonus ?? 0 },
    { label: '개인상', value: s.awardsBonus ?? 0 },
  ];

  return (
    <div
      className={`rounded-xl border ${
        first
          ? 'border-amber-500/35 bg-amber-500/[0.05]'
          : 'border-slate-800 bg-[#111822]'
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full cursor-pointer px-3 py-2.5 text-left"
      >
        <div className="flex items-center gap-2.5">
          <span
            className={`w-6 shrink-0 text-center font-mono text-lg font-black ${
              first ? 'text-amber-300' : 'text-slate-400'
            }`}
          >
            {row.rank}
          </span>
          <div className="shrink-0">
            <PixelManagerAvatar
              avatar={human?.avatar}
              clubPrimaryColor={human?.profile.primaryColor}
              clubSecondaryColor={human?.profile.secondaryColor}
              size={40}
            />
          </div>
          {human && (
            <JerseySvg
              primaryColor={human.profile.primaryColor}
              secondaryColor={human.profile.secondaryColor}
              pattern={human.profile.pattern}
              label={human.profile.shortName}
              size={30}
              className="shrink-0"
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-extrabold text-white">
                {human?.nickname ?? '감독'}
              </span>
              {isMe && (
                <span className="shrink-0 rounded border border-emerald-500/40 bg-emerald-500/15 px-1 text-[9px] font-extrabold text-emerald-300">
                  나
                </span>
              )}
            </div>
            <div className="truncate text-[10px] font-bold text-slate-400">
              {human?.profile.name ?? row.clubId}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[9px] font-bold text-slate-500">합계</div>
            <div
              className={`font-mono text-xl font-black leading-none ${
                first ? 'text-amber-200' : 'text-white'
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

        <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] font-bold">
          <span className="rounded-md border border-slate-800 bg-[#0b1018] px-1.5 py-0.5 text-slate-300">
            시즌 점수{' '}
            <span className="font-mono text-white">
              {s.totalScore.toLocaleString()}
            </span>
          </span>
          <span className="text-slate-500">+</span>
          <span className="rounded-md border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 text-sky-200">
            맞대결{' '}
            <span className="font-mono">+{row.h2hPoints.toLocaleString()}</span>
          </span>
          <span className="text-slate-500">=</span>
          <span className="rounded-md border border-slate-700 bg-[#0b1018] px-1.5 py-0.5 text-slate-200">
            합계{' '}
            <span className="font-mono text-white">
              {row.total.toLocaleString()}
            </span>
          </span>
          <span className="font-mono text-[10px] text-slate-400">
            {row.h2h.won}승 {row.h2h.drawn}무 {row.h2h.lost}패
          </span>
        </div>

        <div className="mt-1.5 flex flex-wrap gap-1">
          <Chip
            label="리그"
            value={`${row.leagueRank}위 · 승점 ${row.leaguePoints}`}
          />
          <Chip label="컵" value={row.cupLabel} />
          <Chip label="챔스" value={row.uclLabel} />
        </div>
      </button>

      {open && (
        <div className="grid grid-cols-2 gap-1.5 border-t border-slate-800/80 px-3 py-2.5 sm:grid-cols-3">
          {parts.map((p) => (
            <div
              key={p.label}
              className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#0b1018] px-2 py-1"
            >
              <span className="text-[10px] font-bold text-slate-400">
                {p.label}
              </span>
              <span className="font-mono text-[11px] font-bold text-slate-200">
                {p.value.toLocaleString()}
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#0b1018] px-2 py-1">
            <span className="text-[10px] font-bold text-slate-400">등급</span>
            <span className="font-mono text-[11px] font-black text-amber-200">
              {s.grade}
            </span>
          </div>
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
  onOpenPodium,
  onLeaveRoom,
}: MpLeagueFinalBoardProps) {
  const compareItems = buildCompareItems(final.rows);

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-3 py-4 sm:px-5 sm:py-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-800/90 bg-[#0d131c] px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <span className="rounded-md border border-emerald-500/40 bg-emerald-500/12 px-2 py-0.5 text-[10px] font-extrabold text-emerald-300">
            최종 시즌 결산
          </span>
          <span className="text-sm font-extrabold text-white">{leagueLabel}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {onOpenPodium && (
            <button
              type="button"
              onClick={onOpenPodium}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-amber-500/35 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-extrabold text-amber-200 hover:bg-amber-500/15"
            >
              <Trophy className="h-3.5 w-3.5" />
              시상대 보기
            </button>
          )}
          <button
            type="button"
            onClick={onLeaveRoom}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-700 bg-[#111822] px-2.5 py-1.5 text-[11px] font-extrabold text-slate-300 hover:text-white"
          >
            <LogOut className="h-3.5 w-3.5" />
            방 나가기
          </button>
        </div>
      </div>

      {/* Board A */}
      <section className="space-y-2 rounded-2xl border border-slate-800/90 bg-[#0d131c] p-3 sm:p-4">
        <h3 className="text-sm font-extrabold text-white">친구 최종 순위</h3>
        <div className="space-y-2">
          {final.rows.map((row) => (
            <FriendRankCard
              key={row.clubId}
              row={row}
              human={findHuman(humans, row)}
              isMe={myClubId !== null && row.clubId === myClubId}
            />
          ))}
        </div>
      </section>

      {/* Board B */}
      <section className="space-y-2 rounded-2xl border border-slate-800/90 bg-[#0d131c] p-3 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-extrabold text-white">역대 강팀 비교</h3>
          <span className="rounded-md border border-slate-800 bg-[#0b1018] px-1.5 py-0.5 text-[10px] font-bold text-slate-400">
            맞대결 점수 제외
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
                  <span className="shrink-0 font-mono text-xs font-bold text-slate-300">
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
                className="flex items-center gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.08] px-2.5 py-1.5"
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
                        {human?.nickname ?? '감독'}
                      </span>
                      {isMe && (
                        <span className="shrink-0 rounded border border-emerald-500/40 bg-emerald-500/15 px-1 text-[9px] font-extrabold text-emerald-300">
                          나
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] font-bold text-emerald-300/80">
                      역대 {item.row.historicalRank}위 /{' '}
                      {item.row.historicalTotal}팀
                    </div>
                  </div>
                  <span className="shrink-0 font-mono text-sm font-black text-emerald-200">
                    {item.score.toLocaleString()}
                  </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
