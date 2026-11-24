import { ChevronRight, Sparkles, Trophy, X } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { UCL_STAGE_LABELS } from '../../../engine/uclEngine';
import { ModalBodyLock } from '../../../hooks/useBodyScrollLock';
import type { DomesticCupState } from '../../../types/cup';
import type { Club, LeagueId, StandingRow } from '../../../types/league';
import type { MpLeagueHuman, MpUclLive } from '../../../types/mpLeague';
import type { UclKnockoutStage, UclKnockoutTie } from '../../../types/ucl';
import { PixelManagerAvatar } from '../../common/PixelManagerAvatar';
import {
  getDomesticCupTrophyVariant,
  PixelTrophySvg,
} from '../../common/PixelTrophySvg';

const UCL_KO_STAGES: UclKnockoutStage[] = ['playoff', 'r16', 'qf', 'sf', 'final'];

export function uclZoneOf(rank: number): {
  label: string;
  badgeCls: string;
  rankCls: string;
} {
  if (rank <= 8) {
    return {
      label: '16강 직행',
      badgeCls: 'bg-emerald-500/18 text-emerald-200 border-emerald-400/40',
      rankCls: 'text-emerald-300',
    };
  }
  if (rank <= 24) {
    return {
      label: '플레이오프',
      badgeCls: 'bg-amber-500/15 text-amber-200 border-amber-400/40',
      rankCls: 'text-amber-300',
    };
  }
  return {
    label: '탈락권',
    badgeCls: 'bg-rose-500/15 text-rose-200 border-rose-400/35',
    rankCls: 'text-rose-300/85',
  };
}

/** Real-time Champions League Phase (36 teams) sidebar table with 1~8 / 9~24 cutlines and compact focus mode. */
export const SideUclStandings = memo(function SideUclStandings({
  standings,
  humans,
  myClubId,
  round,
}: {
  standings: StandingRow[];
  humans: MpLeagueHuman[];
  myClubId: string | null;
  round: number;
}) {
  const [mode, setMode] = useState<'focus' | 'all'>('focus');

  const humanByClub = useMemo(
    () => new Map(humans.map((h) => [h.clubId, h])),
    [humans],
  );

  const visibleIndices = useMemo<number[]>(() => {
    if (mode === 'all' || standings.length <= 16) {
      return standings.map((_, i) => i);
    }
    const picked = new Set<number>();
    // Always show Top 8 (Direct R16 zone)
    for (let i = 0; i < Math.min(8, standings.length); i += 1) picked.add(i);
    // Show every participating human club + 1 neighbor above/below for live race context
    standings.forEach((r, idx) => {
      if (humanByClub.has(r.teamId)) {
        if (idx > 0) picked.add(idx - 1);
        picked.add(idx);
        if (idx + 1 < standings.length) picked.add(idx + 1);
      }
    });
    // Include 24th/25th cutline pair if any friend is near playoff cutoff
    const anyOutsideTop8 = standings.some(
      (r, idx) => idx >= 8 && humanByClub.has(r.teamId),
    );
    if (anyOutsideTop8 && standings.length >= 25) {
      picked.add(23);
      picked.add(24);
    }
    return Array.from(picked).sort((a, b) => a - b);
  }, [mode, standings, humanByClub]);

  return (
    <div className="rounded-xl border border-sky-500/30 bg-[#0b1324] overflow-hidden shadow-lg">
      <div className="flex items-center justify-between gap-2 border-b border-sky-500/20 bg-[#08101f] px-2.5 py-2 text-[10px]">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="inline-block h-2 w-2 rounded-full bg-sky-400" />
          <span className="font-extrabold text-sky-100 truncate">
            UCL 리그페이즈 순위 ({round}/8R)
          </span>
        </div>
        <div className="inline-flex rounded-md border border-sky-500/25 bg-[#0c162b] p-0.5 text-[9px] shrink-0">
          <button
            type="button"
            onClick={() => setMode('focus')}
            className={`rounded px-1.5 py-0.5 font-bold cursor-pointer transition-colors ${
              mode === 'focus'
                ? 'bg-sky-500/25 text-sky-200'
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
                ? 'bg-sky-500/25 text-sky-200'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            전체 {standings.length}
          </button>
        </div>
      </div>

      {/* Cutline legend */}
      <div className="flex items-center justify-between border-b border-slate-800/80 bg-[#091120] px-2.5 py-1 text-[9px] text-slate-400">
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
      </div>

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

      {visibleIndices.map((idx, pos) => {
        const r = standings[idx];
        const prevIdx = pos > 0 ? visibleIndices[pos - 1] : -1;
        const showGap = pos > 0 && idx - prevIdx > 1;
        const human = humanByClub.get(r.teamId);
        const isMine = r.teamId === myClubId;
        const zone = uclZoneOf(idx + 1);
        const directCut = idx === 7;
        const poCut = idx === 23;

        return (
          <div key={r.teamId}>
            {showGap && (
              <div className="border-b border-slate-800/45 bg-[#080f1d] py-0.5 text-center text-[9px] font-bold tracking-widest text-slate-600">
                ···
              </div>
            )}
            <div
              className={`grid grid-cols-[18px_minmax(0,1fr)_20px_18px_18px_18px_24px_24px] items-center gap-0.5 sm:gap-1 px-2 py-[4px] text-[10px] tabular-nums ${
                isMine
                  ? 'bg-emerald-500/16'
                  : human
                    ? 'bg-sky-500/12'
                    : ''
              } ${
                directCut
                  ? 'border-b border-emerald-400/45'
                  : poCut
                    ? 'border-b border-amber-400/45'
                    : 'border-b border-slate-800/35 last:border-b-0'
              }`}
            >
              <span className={`font-mono font-bold ${zone.rankCls}`}>{idx + 1}</span>
              <span className="flex items-center gap-1 min-w-0">
                {human ? (
                  <PixelManagerAvatar
                    avatar={human.avatar}
                    clubPrimaryColor={human.profile.primaryColor}
                    clubSecondaryColor={human.profile.secondaryColor}
                    size={14}
                  />
                ) : (
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: r.primaryColor }}
                  />
                )}
                <span className={`truncate font-bold ${human ? 'text-white' : 'text-slate-300'}`}>
                  {r.teamName}
                </span>
                {isMine && (
                  <span className="shrink-0 rounded bg-emerald-400 px-1 text-[7px] font-black leading-tight text-slate-950">
                    MY
                  </span>
                )}
              </span>
              <span className="text-center text-slate-500">{r.played}</span>
              <span className="text-center font-semibold text-emerald-300/90">{r.won}</span>
              <span className="text-center text-slate-400">{r.drawn}</span>
              <span className="text-center text-rose-300/80">{r.lost}</span>
              <span className="text-center text-slate-400">
                {r.goalDifference > 0 ? `+${r.goalDifference}` : r.goalDifference}
              </span>
              <span className="text-center font-black text-white">{r.points}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
});

/** Sidebar knockout summary card once UCL advances beyond the League Phase. */
export const SideUclKnockoutCard = memo(function SideUclKnockoutCard({
  ucl,
  clubsById,
  humans,
  myClubId,
  onOpenBracket,
}: {
  ucl: MpUclLive;
  clubsById: Record<string, Club>;
  humans: MpLeagueHuman[];
  myClubId: string | null;
  onOpenBracket: () => void;
}) {
  const humanIds = useMemo(() => new Set(humans.map((h) => h.clubId)), [humans]);

  const activeStage: UclKnockoutStage = useMemo(() => {
    if (UCL_KO_STAGES.includes(ucl.stage as UclKnockoutStage)) {
      return ucl.stage as UclKnockoutStage;
    }
    for (let i = UCL_KO_STAGES.length - 1; i >= 0; i -= 1) {
      const st = UCL_KO_STAGES[i];
      if ((ucl.ties[st]?.length ?? 0) > 0) return st;
    }
    return 'r16';
  }, [ucl.stage, ucl.ties]);

  const ties: UclKnockoutTie[] = useMemo(() => {
    const raw = ucl.ties[activeStage] ?? [];
    return [...raw].sort((a, b) => {
      const aMine = a.teamAId === myClubId || a.teamBId === myClubId ? 2 : 0;
      const bMine = b.teamAId === myClubId || b.teamBId === myClubId ? 2 : 0;
      const aHum = humanIds.has(a.teamAId) || humanIds.has(a.teamBId) ? 1 : 0;
      const bHum = humanIds.has(b.teamAId) || humanIds.has(b.teamBId) ? 1 : 0;
      return bMine + bHum - (aMine + aHum);
    });
  }, [ucl.ties, activeStage, myClubId, humanIds]);

  const stageTitle =
    ucl.stage === 'completed'
      ? 'UCL 토너먼트 완료'
      : activeStage === 'final'
        ? 'UCL 결승전'
        : `${UCL_STAGE_LABELS[activeStage]} · ${ucl.knockoutLeg}차전`;

  return (
    <div className="rounded-xl border border-sky-500/30 bg-[#0b1324] overflow-hidden shadow-lg">
      <div className="flex items-center justify-between gap-2 border-b border-sky-500/20 bg-[#08101f] px-2.5 py-2 text-[10px]">
        <span className="inline-flex items-center gap-1.5 font-extrabold text-sky-100">
          <Trophy className="w-3.5 h-3.5 text-sky-300" />
          {stageTitle}
        </span>
        <button
          type="button"
          onClick={onOpenBracket}
          className="inline-flex items-center gap-0.5 rounded-md border border-sky-500/30 bg-sky-500/12 px-1.5 py-0.5 text-[9px] font-bold text-sky-200 hover:bg-sky-500/22 cursor-pointer"
        >
          대진표
          <ChevronRight className="w-2.5 h-2.5" />
        </button>
      </div>

      <div className="p-2 space-y-1.5">
        {ties.length === 0 ? (
          <div className="py-4 text-center text-[11px] text-slate-500">대진 편성 대기 중</div>
        ) : (
          ties.map((tie) => {
            const clubA = clubsById[tie.teamAId];
            const clubB = clubsById[tie.teamBId];
            const involvesMine = tie.teamAId === myClubId || tie.teamBId === myClubId;
            const involvesHuman = humanIds.has(tie.teamAId) || humanIds.has(tie.teamBId);
            const hasPlayed = Boolean(tie.leg1);
            const aWon = tie.winnerId === tie.teamAId;
            const bWon = tie.winnerId === tie.teamBId;
            const pk = tie.leg2?.extraTime?.penalties ?? tie.leg1?.extraTime?.penalties;

            return (
              <div
                key={tie.id}
                className={`rounded-lg border px-2 py-1.5 text-[10px] tabular-nums ${
                  involvesMine
                    ? 'border-emerald-500/45 bg-emerald-500/10'
                    : involvesHuman
                      ? 'border-sky-500/35 bg-sky-500/8'
                      : 'border-slate-800/80 bg-[#080f1d]'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span
                    className={`flex-1 truncate text-right font-bold ${
                      aWon
                        ? 'text-emerald-300'
                        : humanIds.has(tie.teamAId)
                          ? 'text-white'
                          : 'text-slate-300'
                    }`}
                  >
                    {clubA?.shortName ?? tie.teamAId}
                  </span>
                  <span className="rounded bg-[#0d172c] px-1.5 py-0.5 font-mono text-[10px] font-black text-white">
                    {hasPlayed ? `${tie.aggTeamA} : ${tie.aggTeamB}` : 'vs'}
                  </span>
                  <span
                    className={`flex-1 truncate font-bold ${
                      bWon
                        ? 'text-emerald-300'
                        : humanIds.has(tie.teamBId)
                          ? 'text-white'
                          : 'text-slate-300'
                    }`}
                  >
                    {clubB?.shortName ?? tie.teamBId}
                  </span>
                </div>
                {pk && (
                  <div className="mt-0.5 text-center text-[9px] font-bold text-amber-300">
                    PK {pk.homePenGoals}:{pk.awayPenGoals}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
});

/** Spoiler-free multiplayer Domestic Cup Champion popup (shown strictly after live FT/PK finishes). */
export function MpCupChampionPopup({
  cup,
  leagueId,
  clubsById,
  humans,
  myClubId,
  onClose,
}: {
  cup: DomesticCupState;
  leagueId: LeagueId;
  clubsById: Record<string, Club>;
  humans: MpLeagueHuman[];
  myClubId: string | null;
  onClose: () => void;
}) {
  const champId = cup.championTeamId;
  if (!champId) return null;
  const champHuman = humans.find((h) => h.clubId === champId) ?? null;
  const champClub = clubsById[champId];
  const isMe = champId === myClubId;
  const finalNode = cup.rounds.final[0];
  const finalRes = finalNode?.result;
  const homeClub = finalNode ? clubsById[finalNode.homeTeamId] : null;
  const awayClub = finalNode ? clubsById[finalNode.awayTeamId] : null;
  const pk = finalRes?.extraTime?.penalties;

  return (
    <div className="modal-backdrop fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/90 p-4">
      <ModalBodyLock />
      <div className="modal-panel relative w-full max-w-md overflow-hidden rounded-2xl border border-amber-400/50 bg-[#101724] p-5 text-center shadow-2xl space-y-4">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3.5 top-3.5 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
          aria-label="닫기"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center gap-2 pt-1">
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-extrabold text-amber-200">
            <Sparkles className="w-3 h-3" />
            {cup.meta.koreanName} 우승 확정
          </span>
          <PixelTrophySvg variant={getDomesticCupTrophyVariant(leagueId)} size={66} animate />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-center gap-2">
            {champHuman && (
              <PixelManagerAvatar
                avatar={champHuman.avatar}
                clubPrimaryColor={champHuman.profile.primaryColor}
                clubSecondaryColor={champHuman.profile.secondaryColor}
                size={30}
              />
            )}
            <h3 className="text-lg font-black text-white">
              {champHuman ? champHuman.profile.name : champClub?.name ?? champId}
            </h3>
          </div>
          {champHuman && (
            <div className="text-xs font-bold text-amber-300">
              {champHuman.nickname} 감독 {isMe ? '· 우승 축하합니다!' : '우승'}
            </div>
          )}
        </div>

        {finalRes && (
          <div className="rounded-xl border border-slate-800 bg-[#0b1018] px-3.5 py-2.5 text-xs font-bold text-slate-200 tabular-nums">
            <div className="text-[10px] text-slate-500 mb-1">결승전 최종 스코어</div>
            <div className="flex items-center justify-center gap-2">
              <span className="truncate">{homeClub?.name ?? finalRes.homeTeamId}</span>
              <span className="font-mono text-sm font-black text-amber-300">
                {finalRes.homeGoals} : {finalRes.awayGoals}
              </span>
              <span className="truncate">{awayClub?.name ?? finalRes.awayTeamId}</span>
            </div>
            {pk && (
              <div className="mt-1 text-[11px] text-amber-300">
                승부차기 {pk.homePenGoals} : {pk.awayPenGoals}
              </div>
            )}
          </div>
        )}

        <button
          id="mp-cup-champion-close-btn"
          type="button"
          onClick={onClose}
          className="w-full rounded-xl bg-amber-400 py-2.5 text-xs font-black text-slate-950 hover:bg-amber-300 cursor-pointer"
        >
          확인
        </button>
      </div>
    </div>
  );
}
