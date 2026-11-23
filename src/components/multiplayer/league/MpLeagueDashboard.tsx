import {
  Check,
  Crown,
  FastForward,
  Loader2,
  LogOut,
  Pause,
  Shield,
  Swords,
  Trophy,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { calculateChemistry, calculateTeamRatings } from '../../../engine/chemistryEngine';
import { getMoraleLabel } from '../../../engine/conditionEngine';
import type { Club, LeagueId, StandingRow } from '../../../types/league';
import type {
  MpHumanLive,
  MpLeagueHuman,
  MpLeagueLive,
  MpLiteMatch,
  MpSquadInput,
} from '../../../types/mpLeague';
import {
  MP_LEAGUE_AUTO_MS_OPTIONS,
  MP_LEAGUE_LOCK_LABELS,
} from '../../../types/mpLeague';
import type { MpRoomPlayerRow } from '../../../types/multiplayer';
import type { UclTournamentState } from '../../../types/ucl';
import { InjuryAlertModal } from '../../common/InjuryAlertModal';
import { JerseySvg } from '../../common/JerseySvg';
import { ManagerEventModal } from '../../common/ManagerEventModal';
import type { SlotRef } from '../../common/PitchBoard';
import { PixelManagerAvatar } from '../../common/PixelManagerAvatar';
import { CupBracketView } from '../../league/CupBracketView';
import { StandingsTable } from '../../league/StandingsTable';
import { UclBracketTree } from '../../ucl/UclBracketTree';
import { MpLeagueSquadEditor } from './MpLeagueSquadEditor';
import { MpLeagueTransferModal } from './MpLeagueTransferModal';
import { MpUclMulticastBoard } from './MpUclMulticastBoard';

const LEAGUE_LABEL: Record<LeagueId, string> = {
  epl: 'EPL',
  laliga: '라리가',
  seriea: '세리에A',
  bundesliga: '분데스리가',
  ligue1: '리그1',
};

type DashTab = 'league' | 'cup' | 'ucl';

interface MpLeagueDashboardProps {
  roomCode: string;
  live: MpLeagueLive;
  players: MpRoomPlayerRow[];
  playerId: string;
  isHost: boolean;
  onlinePlayerIds: string[];
  connectionStatus: 'connecting' | 'connected' | 'reconnecting';
  mySquad: MpSquadInput | null;
  ackKeys: string[];
  actionBusy: boolean;
  editorOpen: boolean;
  dismissedResolutionKey: string | null;
  hostMissing: boolean;
  errorMsg: string | null;
  onOpenEditor: () => void;
  onCloseEditor: () => void;
  onSaveSquad: (next: MpSquadInput) => void;
  onAck: (key: string) => void;
  onEventChoice: (choiceId: string) => void;
  onDismissResolution: (key: string) => void;
  onInjuryAck: () => void;
  onTradeAccept: (offerId: string) => void;
  onTradeReject: (offerId: string) => void;
  onTradeCounter: (offerId: string, sendPlayerId: string) => void;
  onSetAutoMs: (ms: number) => void;
  onForceResume: () => void;
  onLeaveRoom: () => void;
}

function resultTone(m: MpLiteMatch, clubId: string): string {
  const isHome = m.homeTeamId === clubId;
  const gf = isHome ? m.homeGoals : m.awayGoals;
  const ga = isHome ? m.awayGoals : m.homeGoals;
  const won = m.etWinnerId ? m.etWinnerId === clubId : gf > ga;
  const lost = m.etWinnerId ? m.etWinnerId !== clubId : gf < ga;
  if (won) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
  if (lost) return 'bg-rose-500/15 text-rose-300 border-rose-500/35';
  return 'bg-slate-700/40 text-slate-300 border-slate-600/50';
}

function ScoreLine({
  m,
  clubsById,
  humanIds,
}: {
  m: MpLiteMatch;
  clubsById: Record<string, Club>;
  humanIds: Set<string>;
}) {
  const home = clubsById[m.homeTeamId];
  const away = clubsById[m.awayTeamId];
  const friendly = humanIds.has(m.homeTeamId) || humanIds.has(m.awayTeamId);
  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-lg border px-2 py-1 text-[11px] ${
        m.isH2H
          ? 'border-amber-400/40 bg-amber-500/10'
          : friendly
            ? 'border-emerald-500/30 bg-emerald-500/8'
            : 'border-slate-800/80 bg-[#0b1018]'
      }`}
    >
      <span
        className={`flex-1 truncate text-right font-bold ${
          humanIds.has(m.homeTeamId) ? 'text-white' : 'text-slate-400'
        }`}
      >
        {home?.shortName ?? '-'}
      </span>
      <span className="font-mono font-black text-white tabular-nums">
        {m.homeGoals}:{m.awayGoals}
        {m.penalties && <span className="ml-0.5 text-[9px] text-amber-300">PK</span>}
      </span>
      <span
        className={`flex-1 truncate font-bold ${
          humanIds.has(m.awayTeamId) ? 'text-white' : 'text-slate-400'
        }`}
      >
        {away?.shortName ?? '-'}
      </span>
    </div>
  );
}

export function MpLeagueDashboard({
  roomCode,
  live,
  players,
  playerId,
  isHost,
  onlinePlayerIds,
  connectionStatus,
  mySquad,
  ackKeys,
  actionBusy,
  editorOpen,
  dismissedResolutionKey,
  hostMissing,
  errorMsg,
  onOpenEditor,
  onCloseEditor,
  onSaveSquad,
  onAck,
  onEventChoice,
  onDismissResolution,
  onInjuryAck,
  onTradeAccept,
  onTradeReject,
  onTradeCounter,
  onSetAutoMs,
  onForceResume,
  onLeaveRoom,
}: MpLeagueDashboardProps) {
  const [tabChoice, setTabChoice] = useState<DashTab | null>(null);
  const tab: DashTab = tabChoice ?? (live.stage === 'ucl' && live.ucl ? 'ucl' : 'league');

  const myHuman = live.humans.find((h) => h.playerId === playerId) ?? null;
  const myClubId = myHuman?.clubId ?? null;
  const mine: MpHumanLive | null = myClubId ? live.byClub[myClubId] ?? null : null;
  const humanIds = useMemo(() => new Set(live.humans.map((h) => h.clubId)), [live.humans]);
  const humanByClub = useMemo(
    () => new Map(live.humans.map((h) => [h.clubId, h])),
    [live.humans],
  );
  const clubsById = useMemo<Record<string, Club>>(() => {
    const map: Record<string, Club> = {};
    for (const c of live.ucl?.clubs ?? []) map[c.id] = c;
    for (const c of live.clubs) map[c.id] = c;
    return map;
  }, [live.clubs, live.ucl]);
  const rowByPlayer = (human: MpLeagueHuman) =>
    players.find((p) => p.player_id === human.playerId) ?? null;

  const chemistry = useMemo(
    () =>
      mySquad
        ? calculateChemistry(
            mySquad.formation,
            mySquad.starters,
            mySquad.tactic,
            mySquad.managerTraitId,
          )
        : null,
    [mySquad],
  );
  const ratings = useMemo(
    () =>
      mySquad && chemistry
        ? calculateTeamRatings(
            mySquad.formation,
            mySquad.starters,
            chemistry.total,
            mySquad.managerTraitId,
            chemistry.slotSynergies,
          )
        : null,
    [mySquad, chemistry],
  );

  // Who is holding the room paused right now
  const lockNotes = players
    .filter((p) => p.activity?.lock)
    .map((p) => ({
      playerId: p.player_id,
      text: `${p.nickname}님 ${MP_LEAGUE_LOCK_LABELS[p.activity?.lock?.reason ?? 'tactics']}`,
      offline: !onlinePlayerIds.includes(p.player_id),
    }));
  const flow = live.flow;
  const eventNames =
    flow.kind === 'event'
      ? live.humans.filter((h) => live.byClub[h.clubId]?.event).map((h) => h.nickname)
      : [];
  const pendingAckNames = (key: string) =>
    live.humans
      .filter((h) => !rowByPlayer(h)?.activity?.ackKeys?.includes(key))
      .map((h) => h.nickname);
  const transferWaiting =
    flow.kind === 'transfer'
      ? live.humans
          .filter((h) => {
            const hl = live.byClub[h.clubId];
            if (!hl || hl.offers.length === 0) return false;
            return !rowByPlayer(h)?.activity?.ackKeys?.includes(flow.key);
          })
          .map((h) => h.nickname)
      : [];

  let pauseText: string | null = null;
  if (flow.kind === 'event' && eventNames.length > 0) {
    pauseText = `${eventNames.join(', ')}님 인터뷰 답변 중`;
  } else if (flow.kind === 'transfer') {
    pauseText =
      transferWaiting.length > 0
        ? `이적시장 · ${transferWaiting.join(', ')}님 진행 중`
        : '이적시장 마감 중';
  } else if (lockNotes.length > 0) {
    pauseText = lockNotes.map((n) => n.text).join(' · ');
  }
  const canForceResume =
    isHost && flow.kind === 'auto' && lockNotes.length > 0 && lockNotes.every((n) => n.offline);

  const resolutionKey = mine?.resolution
    ? `${mine.resolution.eventTitle}:${mine.resolution.chosenLabel}`
    : null;
  const showResolution = Boolean(resolutionKey && resolutionKey !== dismissedResolutionKey);
  const transferDone = flow.kind === 'transfer' && ackKeys.includes(flow.key);
  const showTransfer =
    flow.kind === 'transfer' && mine !== null && mine.offers.length > 0 && mySquad !== null;

  const standings: StandingRow[] = live.standings;
  const uclPseudo: UclTournamentState | null = live.ucl
    ? {
        stage: live.ucl.stage,
        teams: [],
        clubs: live.ucl.clubs,
        aiRosters: {},
        leaguePhaseFixtures: [],
        leaguePhaseRound: live.ucl.leaguePhaseRound,
        standings: live.ucl.standings,
        userLeaguePhaseRank: null,
        enteredViaPlayoff: false,
        knockoutLeg: live.ucl.knockoutLeg,
        ties: live.ucl.ties,
        userEliminatedAt: null,
        championTeamId: live.ucl.championTeamId,
        lastUserMatch: null,
        completed: live.ucl.stage === 'completed',
        userParticipated: false,
      }
    : null;

  const stageBadge =
    live.stage === 'ucl' && live.ucl
      ? live.ucl.stage === 'league_phase'
        ? `챔스 리그 페이즈 ${live.ucl.leaguePhaseRound}/8`
        : '챔스 토너먼트'
      : `${LEAGUE_LABEL[live.leagueId]} ${live.round}/${live.totalRounds}R`;

  const handleInjurySwap = (from: SlotRef, to: SlotRef) => {
    if (!mySquad) return;
    const nextS = [...mySquad.starters];
    const nextB = [...mySquad.bench];
    const pA = from.area === 'starter' ? nextS[from.index] : nextB[from.index];
    const pB = to.area === 'starter' ? nextS[to.index] : nextB[to.index];
    if (!pA || !pB) return;
    if (from.area === 'starter') nextS[from.index] = pB;
    else nextB[from.index] = pB;
    if (to.area === 'starter') nextS[to.index] = pA;
    else nextB[to.index] = pA;
    onSaveSquad({ ...mySquad, starters: nextS, bench: nextB });
  };

  return (
    <div className="mx-auto max-w-6xl px-2.5 py-3 sm:px-4 sm:py-5 space-y-3">
      {/* Top bar */}
      <div className="rounded-xl border border-slate-800/90 bg-[#0d131c] px-3.5 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-sky-400/40 bg-sky-500/10 px-2 py-0.5 text-[11px] font-extrabold text-sky-300">
            <Users className="w-3.5 h-3.5" />
            멀티 리그
          </span>
          <span className="text-xs font-extrabold text-white tabular-nums">{stageBadge}</span>
          <span className="font-mono text-xs text-slate-500">#{roomCode}</span>
          <span
            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold ${
              connectionStatus === 'connected'
                ? 'bg-emerald-500/10 text-emerald-300'
                : 'bg-amber-500/15 text-amber-300'
            }`}
          >
            {connectionStatus === 'connected' ? (
              <Wifi className="w-3 h-3" />
            ) : (
              <WifiOff className="w-3 h-3" />
            )}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {isHost && (
            <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-[#0a0f17] px-1.5 py-1">
              <FastForward className="w-3 h-3 text-slate-500" />
              {MP_LEAGUE_AUTO_MS_OPTIONS.map((ms) => (
                <button
                  key={ms}
                  type="button"
                  onClick={() => onSetAutoMs(ms)}
                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums cursor-pointer ${
                    live.autoMs === ms
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {(ms / 1000).toFixed(1)}s
                </button>
              ))}
            </div>
          )}
          <button
            id="mpl-open-squad-btn"
            type="button"
            disabled={!mySquad}
            onClick={onOpenEditor}
            className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/12 px-2.5 py-1 text-[11px] font-extrabold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-40 cursor-pointer"
          >
            <Shield className="w-3 h-3" />
            스쿼드 · 전술
          </button>
          <button
            type="button"
            onClick={onLeaveRoom}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-[#111822] px-2.5 py-1 text-[11px] font-bold text-slate-400 hover:text-rose-300 cursor-pointer"
          >
            <LogOut className="w-3 h-3" />
            나가기
          </button>
        </div>
      </div>

      {(errorMsg || hostMissing) && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/25 px-3.5 py-2 text-xs font-bold text-rose-200">
          {hostMissing ? '방장 기기에서 시즌 데이터를 찾을 수 없습니다' : errorMsg}
        </div>
      )}

      {pauseText && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-400/35 bg-amber-500/10 px-3.5 py-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-200">
            <Pause className="w-3.5 h-3.5" />
            {pauseText}
          </div>
          {canForceResume && (
            <button
              type="button"
              onClick={onForceResume}
              className="rounded-lg border border-amber-400/45 bg-amber-500/15 px-2.5 py-1 text-[11px] font-extrabold text-amber-200 hover:bg-amber-500/25 cursor-pointer"
            >
              강제 재개
            </button>
          )}
        </div>
      )}

      {/* UCL knockout: every friend must agree before the stage starts */}
      {flow.kind === 'consent' && (
        <div className="rounded-xl border border-sky-400/40 bg-sky-500/10 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-extrabold text-sky-200">{flow.label} 시작</span>
            {live.humans.map((h) => {
              const ok = rowByPlayer(h)?.activity?.ackKeys?.includes(flow.key);
              return (
                <span
                  key={h.clubId}
                  className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-bold ${
                    ok
                      ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                      : 'border-slate-700 bg-[#0b1018] text-slate-400'
                  }`}
                >
                  {ok ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  )}
                  {h.nickname}
                </span>
              );
            })}
          </div>
          {ackKeys.includes(flow.key) ? (
            <span className="text-[11px] font-bold text-slate-400">
              {pendingAckNames(flow.key).join(', ')} 대기 중
            </span>
          ) : (
            <button
              id="mpl-consent-btn"
              type="button"
              onClick={() => onAck(flow.key)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-extrabold text-slate-950 hover:bg-emerald-400 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              진행 동의
            </button>
          )}
        </div>
      )}

      {/* Friends strip */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {live.humans.map((h) => {
          const hl = live.byClub[h.clubId];
          const rankIdx = standings.findIndex((r) => r.teamId === h.clubId);
          const row = rankIdx === -1 ? null : standings[rankIdx];
          const online = onlinePlayerIds.includes(h.playerId);
          const isMe = h.playerId === playerId;
          const nextOpp = hl?.nextOpponentId ? clubsById[hl.nextOpponentId] : null;
          const nextIsFriend = Boolean(hl?.nextOpponentId && humanIds.has(hl.nextOpponentId));
          return (
            <div
              key={h.clubId}
              className={`rounded-xl border p-2.5 space-y-1.5 ${
                isMe ? 'border-emerald-500/40 bg-[#0e1722]' : 'border-slate-800/90 bg-[#0d131c]'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="relative shrink-0">
                  <PixelManagerAvatar
                    avatar={h.avatar}
                    clubPrimaryColor={h.profile.primaryColor}
                    clubSecondaryColor={h.profile.secondaryColor}
                    size={34}
                  />
                  <span
                    className={`absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ${
                      online ? 'bg-emerald-400' : 'bg-slate-600'
                    }`}
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1 truncate text-xs font-extrabold text-white">
                    <span className="truncate">{h.nickname}</span>
                    {isMe && <span className="text-[10px] text-emerald-300">나</span>}
                  </div>
                  <div className="truncate text-[10px] text-slate-400">{h.profile.name}</div>
                </div>
                <div className="ml-auto text-right shrink-0">
                  <div className="font-mono text-sm font-black text-white tabular-nums">
                    {rankIdx === -1 ? '-' : `${rankIdx + 1}위`}
                  </div>
                  <div className="text-[10px] font-bold text-slate-400 tabular-nums">
                    {row?.points ?? 0}점
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1 text-[10px] font-bold">
                <span className="inline-flex items-center gap-0.5 rounded border border-amber-400/30 bg-amber-500/10 px-1 py-0.5 text-amber-200 tabular-nums">
                  <Swords className="w-2.5 h-2.5" />
                  {hl?.h2h.won ?? 0}승 {hl?.h2h.drawn ?? 0}무 {hl?.h2h.lost ?? 0}패
                </span>
                <span className="rounded border border-slate-700 bg-[#0b1018] px-1 py-0.5 text-slate-300">
                  {getMoraleLabel(hl?.morale ?? 0)}
                </span>
                {(hl?.recent ?? []).slice(-4).map((m, idx) => (
                  <span
                    key={`${m.label}-${idx}`}
                    title={m.label}
                    className={`rounded border px-1 py-0.5 tabular-nums ${resultTone(m, h.clubId)}`}
                  >
                    {m.homeGoals}:{m.awayGoals}
                  </span>
                ))}
              </div>
              {nextOpp && live.stage === 'league' && (
                <div
                  className={`truncate text-[10px] font-bold ${
                    nextIsFriend ? 'text-amber-300' : 'text-slate-500'
                  }`}
                >
                  다음 {nextOpp.name}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12 items-start">
        <div className="lg:col-span-8 space-y-2">
          <div className="flex items-center gap-1.5">
            {(
              [
                { id: 'league', label: '리그 순위' },
                { id: 'cup', label: live.cup?.meta.koreanName ?? '컵' },
                ...(live.ucl ? [{ id: 'ucl', label: '챔피언스리그' }] : []),
              ] as { id: DashTab; label: string }[]
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTabChoice(t.id)}
                className={`rounded-lg border px-3 py-1.5 text-[11px] font-bold transition-colors cursor-pointer ${
                  tab === t.id
                    ? 'border-slate-600 bg-[#172030] text-white'
                    : 'border-slate-800 bg-[#0d131c] text-slate-400 hover:text-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'league' && (
            <div className="rounded-xl border border-slate-800/90 bg-[#0d131c] overflow-hidden">
              <div className="grid grid-cols-[28px_1fr_26px_26px_26px_26px_34px_34px] items-center gap-1 border-b border-slate-800 px-2.5 py-1.5 text-[10px] font-bold text-slate-500">
                <span>#</span>
                <span>구단</span>
                <span className="text-center">경기</span>
                <span className="text-center">승</span>
                <span className="text-center">무</span>
                <span className="text-center">패</span>
                <span className="text-center">득실</span>
                <span className="text-center">승점</span>
              </div>
              {standings.map((r, idx) => {
                const human = humanByClub.get(r.teamId);
                const isMine = r.teamId === myClubId;
                return (
                  <div
                    key={r.teamId}
                    className={`grid grid-cols-[28px_1fr_26px_26px_26px_26px_34px_34px] items-center gap-1 px-2.5 py-1 text-[11px] tabular-nums border-b border-slate-800/50 last:border-b-0 ${
                      isMine
                        ? 'bg-emerald-500/10'
                        : human
                          ? 'bg-sky-500/8'
                          : ''
                    }`}
                  >
                    <span
                      className={`font-mono font-bold ${
                        idx < 4 ? 'text-sky-300' : idx >= standings.length - 3 ? 'text-rose-300/80' : 'text-slate-500'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <span className="flex items-center gap-1.5 min-w-0">
                      {human ? (
                        <PixelManagerAvatar
                          avatar={human.avatar}
                          clubPrimaryColor={human.profile.primaryColor}
                          clubSecondaryColor={human.profile.secondaryColor}
                          size={18}
                        />
                      ) : (
                        <JerseySvg
                          primaryColor={r.primaryColor}
                          secondaryColor={r.secondaryColor}
                          pattern={clubsById[r.teamId]?.pattern}
                          label=""
                          size={16}
                        />
                      )}
                      <span
                        className={`truncate font-bold ${
                          human ? 'text-white' : 'text-slate-300'
                        }`}
                      >
                        {r.teamName}
                      </span>
                      {human && (
                        <span className="shrink-0 truncate text-[10px] text-slate-400">
                          {human.nickname}
                        </span>
                      )}
                    </span>
                    <span className="text-center text-slate-400">{r.played}</span>
                    <span className="text-center text-slate-300">{r.won}</span>
                    <span className="text-center text-slate-300">{r.drawn}</span>
                    <span className="text-center text-slate-300">{r.lost}</span>
                    <span className="text-center text-slate-300">
                      {r.goalDifference > 0 ? `+${r.goalDifference}` : r.goalDifference}
                    </span>
                    <span className="text-center font-black text-white">{r.points}</span>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'cup' && live.cup && (
            <div className="rounded-xl border border-slate-800/90 bg-[#0d131c] p-2 overflow-x-auto">
              <CupBracketView cup={live.cup} clubs={live.clubs} leagueId={live.leagueId} />
            </div>
          )}

          {tab === 'ucl' && live.ucl && uclPseudo && (
            <div className="space-y-2">
              {live.ucl.stage === 'league_phase' ? (
                <StandingsTable
                  standings={live.ucl.standings}
                  clubsById={clubsById}
                  uclSpots={8}
                  relegationSpots={12}
                />
              ) : (
                <div className="rounded-xl border border-slate-800/90 bg-[#0d131c] p-2 overflow-x-auto">
                  <UclBracketTree ucl={uclPseudo} clubsById={clubsById} />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="lg:col-span-4 space-y-3">
          {live.stage === 'ucl' && live.ucl && live.ucl.lastScores.length > 0 && (
            <div className="rounded-xl border border-slate-800/90 bg-[#0d131c] p-2.5 space-y-1.5">
              <div className="text-[11px] font-bold text-slate-400">
                {live.ucl.lastScores[0].label}
              </div>
              {live.ucl.lastScores.map((m, idx) => (
                <ScoreLine key={idx} m={m} clubsById={clubsById} humanIds={humanIds} />
              ))}
            </div>
          )}

          {live.cupNews.length > 0 && (
            <div className="rounded-xl border border-slate-800/90 bg-[#0d131c] p-2.5 space-y-1.5">
              <div className="flex items-center gap-1 text-[11px] font-bold text-amber-200">
                <Trophy className="w-3 h-3" />
                {live.cupNews[0].label}
              </div>
              {live.cupNews.map((m, idx) => (
                <ScoreLine key={idx} m={m} clubsById={clubsById} humanIds={humanIds} />
              ))}
            </div>
          )}

          {live.lastRound && (
            <div className="rounded-xl border border-slate-800/90 bg-[#0d131c] p-2.5 space-y-1.5">
              <div className="text-[11px] font-bold text-slate-400">
                {live.lastRound.round}R 결과
              </div>
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-1">
                {live.lastRound.scores.map((m, idx) => (
                  <ScoreLine key={idx} m={m} clubsById={clubsById} humanIds={humanIds} />
                ))}
              </div>
            </div>
          )}

          {live.topScorers.length > 0 && (
            <div className="rounded-xl border border-slate-800/90 bg-[#0d131c] p-2.5 space-y-1">
              <div className="flex items-center gap-1 text-[11px] font-bold text-slate-400">
                <Crown className="w-3 h-3 text-amber-400" />
                득점 순위
              </div>
              {live.topScorers.slice(0, 5).map((s, idx) => (
                <div
                  key={s.playerId}
                  className="flex items-center justify-between gap-2 text-[11px]"
                >
                  <span className="truncate text-slate-300">
                    <span className="mr-1 font-mono text-slate-500">{idx + 1}</span>
                    {s.playerName}
                    <span className="ml-1 text-[10px] text-slate-500">{s.teamShortName}</span>
                  </span>
                  <span className="font-mono font-bold text-white tabular-nums">{s.goals}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {editorOpen && mySquad && (
        <MpLeagueSquadEditor
          squad={mySquad}
          managerTraitId={mySquad.managerTraitId}
          conditions={mine?.conditions ?? {}}
          onSave={onSaveSquad}
          onClose={onCloseEditor}
        />
      )}

      {mine && (mine.event || showResolution) && myHuman && (
        <ManagerEventModal
          activeEvent={mine.event}
          lastResolution={showResolution ? mine.resolution : null}
          managerAvatar={myHuman.avatar}
          managerName={myHuman.nickname}
          userClub={myHuman.profile}
          onSelectChoice={onEventChoice}
          onDismissResolution={() => {
            if (resolutionKey) onDismissResolution(resolutionKey);
          }}
        />
      )}

      {mine && mine.alerts.length > 0 && mySquad && chemistry && ratings && !mine.event && (
        <InjuryAlertModal
          alerts={mine.alerts}
          formation={mySquad.formation}
          starters={mySquad.starters}
          bench={mySquad.bench}
          chemistry={chemistry}
          ratings={ratings}
          managerTraitId={mySquad.managerTraitId}
          conditionMap={mine.conditions}
          onSwapSlots={handleInjurySwap}
          onConfirmClose={onInjuryAck}
        />
      )}

      {showTransfer && mine && mySquad && flow.kind === 'transfer' && (
        <MpLeagueTransferModal
          windowIndex={live.transferWindowIndex ?? 1}
          offers={mine.offers}
          attemptsLeft={mine.attemptsLeft}
          tradeNote={mine.tradeNote}
          myStarters={mySquad.starters}
          myBench={mySquad.bench}
          busy={actionBusy}
          done={transferDone}
          waitingNames={transferWaiting}
          onAccept={onTradeAccept}
          onReject={onTradeReject}
          onCounter={onTradeCounter}
          onFinish={() => onAck(flow.key)}
        />
      )}

      {live.cast && (
        <MpUclMulticastBoard
          cast={live.cast}
          clubsById={clubsById}
          humans={live.humans}
          myClubId={myClubId}
        />
      )}
    </div>
  );
}
