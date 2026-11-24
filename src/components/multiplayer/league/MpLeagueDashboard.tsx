import {
  Calendar,
  Check,
  ClipboardList,
  FastForward,
  Loader2,
  LogOut,
  Pause,
  Shield,
  Swords,
  Trophy,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';
import { memo, useCallback, useMemo, useState } from 'react';
import { calculateChemistry, calculateTeamRatings } from '../../../engine/chemistryEngine';
import { getMoraleLabel } from '../../../engine/conditionEngine';
import { getLeagueById } from '../../../engine/dataLoader';
import { getNextTransferWindowRound } from '../../../engine/transferEngine';
import { UCL_STAGE_LABELS } from '../../../engine/uclEngine';
import type { DomesticCupState } from '../../../types/cup';
import type { Club, LeagueId, PlayerSeasonStats, StandingRow } from '../../../types/league';
import type {
  MpH2HRecord,
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
import type { Player } from '../../../types/player';
import type { UclKnockoutStage } from '../../../types/ucl';
import { resolvePlayerById } from '../../../utils/playerLookup';
import { InjuryAlertModal } from '../../common/InjuryAlertModal';
import { ManagerEventModal } from '../../common/ManagerEventModal';
import type { SlotRef } from '../../common/PitchBoard';
import { PixelManagerAvatar } from '../../common/PixelManagerAvatar';
import { PixelTrophySvg } from '../../common/PixelTrophySvg';
import { PlayerDetailModal } from '../../common/PlayerDetailModal';
import { CupBracketView } from '../../league/CupBracketView';
import { LeagueLeadersSideCard } from '../../league/LeagueLeadersSideCard';
import { StandingsTable } from '../../league/StandingsTable';
import { UclBracketTree } from '../../ucl/UclBracketTree';
import { UclLeaguePhaseStandingsModal } from '../../ucl/UclLeaguePhaseStandingsModal';
import { UclMilestoneModal } from '../../ucl/UclMilestoneModal';
import { MpLeagueSeasonSummary } from './MpLeagueSeasonSummary';
import { MpLeagueSquadEditor } from './MpLeagueSquadEditor';
import { MpLeagueTransferModal } from './MpLeagueTransferModal';
import type { MpCounterTradePayload } from './MpLeagueTransferModal';
import {
  hasPlayableTickerMatches,
  isMpTickerPlayed,
  MpLiveTicker,
} from './MpLiveTicker';
import { MpUclMulticastBoard } from './MpUclMulticastBoard';
import {
  MpCupChampionPopup,
  SideUclKnockoutCard,
  SideUclStandings,
  uclZoneOf,
} from './MpUclSidePanel';
import { buildUclViewForViewer, reachedUclMilestone } from './mpUclView';
import type { MpUclMilestone } from './mpUclView';

const LEAGUE_LABEL: Record<LeagueId, string> = {
  epl: 'EPL',
  laliga: '라리가',
  seriea: '세리에A',
  bundesliga: '분데스리가',
  ligue1: '리그1',
};

const UCL_KO_STEPS: { id: UclKnockoutStage; label: string }[] = [
  { id: 'playoff', label: 'PO' },
  { id: 'r16', label: '16강' },
  { id: 'qf', label: '8강' },
  { id: 'sf', label: '4강' },
  { id: 'final', label: '결승' },
];

type DashTab = 'results' | 'cup' | 'ucl' | 'domestic';
type MobileSection = 'main' | 'table' | 'leaders';

/** Popups each tab has already shown (survives remounts when a friend match takes over the screen). */
const seenPopups = new Set<string>();

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
  tickerDoneKey: string | null;
  onTickerDoneKey: (key: string) => void;
  hiddenEventKey: string | null;
  activeEventKey: string | null;
  hostMissing: boolean;
  errorMsg: string | null;
  tacticSavedNotice?: boolean;
  onOpenEditor: () => void;
  onCloseEditor: () => void;
  onSaveSquad: (next: MpSquadInput) => void;
  onAck: (key: string) => void;
  onEventChoice: (choiceId: string) => void;
  onDismissResolution: (key: string) => void;
  onInjuryAck: () => void;
  onTradeAccept: (offerId: string) => void;
  onTradeReject: (offerId: string) => void;
  onTradeCounter: (payload: MpCounterTradePayload) => void;
  onSetAutoMs: (ms: number) => void;
  onForceResume: () => void;
  onLeaveRoom: () => void;
}

interface LiveViewData {
  standings: StandingRow[];
  cup: DomesticCupState | null;
  uclStandings: StandingRow[];
  byClub: Record<string, MpHumanLive>;
  lastRound: MpLeagueLive['lastRound'];
  cupNews: MpLiteMatch[];
  uclLastScores: MpLiteMatch[];
  topScorers: PlayerSeasonStats[];
  topAssisters: PlayerSeasonStats[];
  uclTopScorers: PlayerSeasonStats[];
  uclTopAssisters: PlayerSeasonStats[];
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

const ScoreLine = memo(function ScoreLine({
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
});

/** Compact side league table with UCL & relegation cutlines matching original StandingsTable tone. */
const SideStandings = memo(function SideStandings({
  standings,
  humans,
  myClubId,
  uclSpots = 4,
  relegationSpots = 3,
}: {
  standings: StandingRow[];
  humans: MpLeagueHuman[];
  myClubId: string | null;
  uclSpots?: number;
  relegationSpots?: number;
}) {
  const humanByClub = new Map(humans.map((h) => [h.clubId, h]));
  const relegationStart = standings.length - relegationSpots;
  return (
    <div className="rounded-xl border border-slate-800/90 bg-[#0d131c] overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-800/80 bg-[#0b1018] px-2.5 py-1.5 text-[10px]">
        <span className="font-bold text-slate-200">리그 순위표</span>
        <div className="flex items-center gap-2 text-[9px] text-slate-500">
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
            UCL
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
            강등
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
      {standings.map((r, idx) => {
        const human = humanByClub.get(r.teamId);
        const isMine = r.teamId === myClubId;
        const uclCut = idx === uclSpots - 1;
        const relCut = idx === relegationStart - 1 && relegationSpots > 0;
        return (
          <div
            key={r.teamId}
            className={`grid grid-cols-[18px_minmax(0,1fr)_20px_18px_18px_18px_24px_24px] items-center gap-0.5 sm:gap-1 px-2 py-[3.5px] text-[10px] tabular-nums ${
              isMine
                ? 'bg-emerald-500/14'
                : human
                  ? 'bg-sky-500/8'
                  : ''
            } ${
              uclCut
                ? 'border-b border-sky-400/35'
                : relCut
                  ? 'border-b border-rose-400/35'
                  : 'border-b border-slate-800/35 last:border-b-0'
            }`}
          >
            <span
              className={`font-mono font-bold ${
                idx < uclSpots
                  ? 'text-sky-300'
                  : idx >= relegationStart
                    ? 'text-rose-300/85'
                    : 'text-slate-500'
              }`}
            >
              {idx + 1}
            </span>
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
        );
      })}
    </div>
  );
});

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
  tickerDoneKey,
  onTickerDoneKey,
  hiddenEventKey,
  activeEventKey,
  hostMissing,
  errorMsg,
  tacticSavedNotice = false,
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
  const [mobileSection, setMobileSection] = useState<MobileSection>('main');
  const [popupTick, setPopupTick] = useState(0);
  const [summaryReviewOpen, setSummaryReviewOpen] = useState(false);
  const [inspected, setInspected] = useState<{
    player: Player;
    stats?: PlayerSeasonStats | null;
  } | null>(null);

  const isUclStage = live.stage === 'ucl' && Boolean(live.ucl);
  const tab: DashTab = useMemo(() => {
    if (isUclStage) {
      if (tabChoice === 'results' || tabChoice === 'domestic' || tabChoice === 'ucl') {
        return tabChoice;
      }
      return 'ucl';
    }
    if (tabChoice === 'cup' || tabChoice === 'results') return tabChoice;
    return 'results';
  }, [isUclStage, tabChoice]);

  const leagueMeta = getLeagueById(live.leagueId);
  const myHuman = live.humans.find((h) => h.playerId === playerId) ?? null;
  const myClubId = myHuman?.clubId ?? null;
  const humanIds = useMemo(() => new Set(live.humans.map((h) => h.clubId)), [live.humans]);
  const friendLabelByClub = useMemo(() => {
    const map: Record<string, string> = {};
    for (const h of live.humans) {
      if (h.clubId !== myClubId) {
        const nick = Array.from(h.nickname.trim()).slice(0, 2).join('');
        map[h.clubId] = nick || h.profile.shortName;
      }
    }
    return map;
  }, [live.humans, myClubId]);

  const clubsById = useMemo<Record<string, Club>>(() => {
    const map: Record<string, Club> = {};
    for (const c of live.ucl?.clubs ?? []) map[c.id] = c;
    for (const c of live.clubs) map[c.id] = c;
    return map;
  }, [live.clubs, live.ucl]);
  const rowByPlayer = (human: MpLeagueHuman) =>
    players.find((p) => p.player_id === human.playerId) ?? null;

  // Deterministic spoiler guard: while the live ticker is actively replaying, show exact pre-round snapshots;
  // the instant FT (or PK end) fires, immediately switch to live standings, cup, UCL, and leaders.
  const tickerKey = live.ticker?.key ?? null;
  const tickerHasPlayable = hasPlayableTickerMatches(live.ticker);
  const tickerPlaying = Boolean(
    tickerHasPlayable && tickerDoneKey !== tickerKey && !isMpTickerPlayed(tickerKey),
  );
  const playingClubIds = useMemo(() => {
    const set = new Set<string>();
    if (!tickerPlaying || !live.ticker) return set;
    for (const m of live.ticker.matches) {
      if (!m.instant) {
        set.add(m.homeTeamId);
        set.add(m.awayTeamId);
      }
    }
    return set;
  }, [tickerPlaying, live.ticker]);

  const view: LiveViewData = tickerPlaying
    ? {
        standings: live.ticker?.prevStandings ?? live.standings,
        cup: live.ticker?.prevCup !== undefined ? live.ticker.prevCup : live.cup,
        uclStandings: live.ticker?.prevUclStandings ?? live.ucl?.standings ?? [],
        byClub: live.byClub,
        lastRound: null,
        cupNews: [],
        uclLastScores: [],
        topScorers: live.ticker?.prevTopScorers ?? live.topScorers,
        topAssisters: live.ticker?.prevTopAssisters ?? live.topAssisters ?? [],
        uclTopScorers: live.ticker?.prevUclTopScorers ?? live.ucl?.topScorers ?? [],
        uclTopAssisters: live.ticker?.prevUclTopAssisters ?? live.ucl?.topAssisters ?? [],
      }
    : {
        standings: live.standings,
        cup: live.cup,
        uclStandings: live.ucl?.standings ?? [],
        byClub: live.byClub,
        lastRound: live.lastRound,
        cupNews: live.cupNews,
        uclLastScores: live.ucl?.lastScores ?? [],
        topScorers: live.topScorers,
        topAssisters: live.topAssisters ?? [],
        uclTopScorers: live.ucl?.topScorers ?? [],
        uclTopAssisters: live.ucl?.topAssisters ?? [],
      };

  const handleTickerDone = useCallback(
    (key: string) => {
      onTickerDoneKey(key);
    },
    [onTickerDoneKey],
  );

  const mine: MpHumanLive | null = myClubId ? live.byClub[myClubId] ?? null : null;

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

  const publicSquads = useMemo(() => {
    const map: Record<string, MpSquadInput> = {};
    for (const h of live.humans) {
      const p = players.find((r) => r.player_id === h.playerId)?.league_payload;
      if (p && p.starters?.length === 11) {
        map[h.clubId] = {
          managerTraitId: p.managerTraitId,
          formation: p.formation,
          tactic: p.tactic,
          starters: p.starters,
          bench: p.bench,
        };
      }
    }
    return map;
  }, [live.humans, players]);

  const h2hByClub = useMemo(() => {
    const map: Record<string, MpH2HRecord> = {};
    for (const h of live.humans) {
      const hl = live.byClub[h.clubId];
      if (hl) map[h.clubId] = hl.h2h;
    }
    return map;
  }, [live.humans, live.byClub]);

  const myRankIdx = myClubId
    ? view.standings.findIndex((r) => r.teamId === myClubId)
    : -1;
  const myRank = myRankIdx === -1 ? 10 : myRankIdx + 1;
  const myStandingRow = myRankIdx === -1 ? null : view.standings[myRankIdx];

  const myUclQualified = Boolean(
    myClubId && live.ucl && live.ucl.humanClubIds.includes(myClubId),
  );
  const myUclRankIdx =
    myClubId && isUclStage
      ? view.uclStandings.findIndex((r) => r.teamId === myClubId)
      : -1;
  const myUclRank = myUclRankIdx === -1 ? null : myUclRankIdx + 1;
  const myUclRow = myUclRankIdx === -1 ? null : view.uclStandings[myUclRankIdx];

  const getClubUclKnockoutStatus = useCallback(
    (clubId: string): { label: string; tone: string } => {
      const ucl = live.ucl;
      if (!ucl || !ucl.humanClubIds.includes(clubId)) {
        return { label: '미진출', tone: 'bg-slate-800 text-slate-400 border-slate-700' };
      }
      if (!tickerPlaying && !live.cast && ucl.championTeamId === clubId) {
        return {
          label: '🏆 UCL 우승',
          tone: 'bg-amber-500/20 text-amber-200 border-amber-400/45',
        };
      }
      const stages: UclKnockoutStage[] = ['final', 'sf', 'qf', 'r16', 'playoff'];
      for (const st of stages) {
        const tie = ucl.ties[st]?.find((t) => t.teamAId === clubId || t.teamBId === clubId);
        if (!tie) continue;
        if (tie.winnerId && tie.winnerId !== clubId) {
          return {
            label: `${UCL_STAGE_LABELS[st]} 탈락`,
            tone: 'bg-rose-500/15 text-rose-300 border-rose-500/35',
          };
        }
        return {
          label: `${UCL_STAGE_LABELS[st]} 진출`,
          tone: 'bg-sky-500/18 text-sky-200 border-sky-400/40',
        };
      }
      const lpIdx = view.uclStandings.findIndex((r) => r.teamId === clubId);
      if (lpIdx >= 24) {
        return {
          label: `리그 ${lpIdx + 1}위 탈락`,
          tone: 'bg-rose-500/15 text-rose-300 border-rose-500/35',
        };
      }
      return {
        label: '토너먼트 대기',
        tone: 'bg-sky-500/15 text-sky-200 border-sky-400/35',
      };
    },
    [live.ucl, live.cast, tickerPlaying, view.uclStandings],
  );

  const lockNotes = players
    .filter((p) => {
      const reason = p.activity?.lock?.reason;
      if (!reason) return false;
      // Never spoil or display interview/injury locks while the round scoreboard is still playing
      if (tickerPlaying && (reason === 'interview' || reason === 'injury')) {
        return false;
      }
      return true;
    })
    .map((p) => ({
      text: `${p.nickname}님 ${MP_LEAGUE_LOCK_LABELS[p.activity?.lock?.reason ?? 'tactics']}`,
      offline: !onlinePlayerIds.includes(p.player_id),
    }));
  const flow = live.flow;
  const eventNames =
    !tickerPlaying && flow.kind === 'event'
      ? live.humans.filter((h) => live.byClub[h.clubId]?.event).map((h) => h.nickname)
      : [];
  const pendingAckNames = (key: string) =>
    live.humans
      .filter((h) => !rowByPlayer(h)?.activity?.ackKeys?.includes(key))
      .map((h) => h.nickname);
  const transferWaiting =
    !tickerPlaying && flow.kind === 'transfer'
      ? live.humans
          .filter((h) => {
            const hl = live.byClub[h.clubId];
            if (!hl || hl.offers.length === 0) return false;
            return !rowByPlayer(h)?.activity?.ackKeys?.includes(flow.key);
          })
          .map((h) => h.nickname)
      : [];

  let pauseText: string | null = null;
  if (!tickerPlaying && flow.kind === 'event' && eventNames.length > 0) {
    pauseText = `${eventNames.join(', ')}님 인터뷰 답변 중`;
  } else if (!tickerPlaying && flow.kind === 'transfer') {
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
  const visibleEvent =
    mine?.event && (!activeEventKey || activeEventKey !== hiddenEventKey)
      ? mine.event
      : null;
  const transferDone = flow.kind === 'transfer' && ackKeys.includes(flow.key);
  const showTransfer =
    flow.kind === 'transfer' &&
    mine !== null &&
    mine.offers.length > 0 &&
    mySquad !== null &&
    !tickerPlaying;

  // Single-player UCL popups, re-pointed at MY club
  const uclView = useMemo(
    () => (live.ucl ? buildUclViewForViewer(live.ucl, myClubId) : null),
    [live.ucl, myClubId],
  );
  const milestone: MpUclMilestone | null = live.ucl
    ? reachedUclMilestone(live.ucl, myClubId)
    : null;
  const milestoneKey = milestone ? `${live.seasonKey}:ms:${milestone}` : null;
  const lpKey =
    live.ucl && live.ucl.leaguePhaseRound >= 8 ? `${live.seasonKey}:lp-table` : null;
  const popupsAllowed = !live.cast && !tickerPlaying && flow.kind !== 'cast';
  const summaryActive = flow.kind === 'summary' && live.summary !== null;

  // Spoiler-free Domestic Cup Champion popup: ONLY allowed once live stream finishes FT/PK!
  const cupChampKey =
    view.cup?.completed && view.cup.championTeamId
      ? `${live.seasonKey}:cup-champ`
      : null;
  const showCupChampion = Boolean(
    popupTick >= 0 &&
      popupsAllowed &&
      !showTransfer &&
      !visibleEvent &&
      !showResolution &&
      cupChampKey &&
      !seenPopups.has(cupChampKey) &&
      view.cup &&
      (view.cup.championTeamId === myClubId || !summaryActive),
  );

  // League season summary popup: ALSO strictly gated behind !tickerPlaying & !showCupChampion!
  const showSummary =
    ((summaryActive && popupsAllowed && !showCupChampion) || summaryReviewOpen) &&
    live.summary !== null;

  const showLpTable = Boolean(
    popupTick >= 0 &&
      popupsAllowed &&
      !showSummary &&
      !showCupChampion &&
      lpKey &&
      !seenPopups.has(lpKey) &&
      uclView,
  );
  const showMilestone = Boolean(
    popupsAllowed &&
      !showSummary &&
      !showCupChampion &&
      !showLpTable &&
      milestoneKey &&
      !seenPopups.has(milestoneKey) &&
      uclView,
  );
  const closePopup = (key: string | null) => {
    if (key) seenPopups.add(key);
    setPopupTick((n) => n + 1);
  };
  const isTreble = Boolean(
    myClubId &&
      live.ucl?.championTeamId === myClubId &&
      live.cup?.championTeamId === myClubId &&
      live.standings[0]?.teamId === myClubId,
  );

  const displayRound = tickerPlaying
    ? Math.max(0, live.round - (live.lastRound ? 1 : 0))
    : live.round;
  const displayUclLpRound =
    isUclStage && live.ucl
      ? tickerPlaying && live.ucl.stage === 'league_phase'
        ? Math.max(0, live.ucl.leaguePhaseRound - 1)
        : live.ucl.leaguePhaseRound
      : 0;

  const progressPct = isUclStage
    ? Math.min(100, Math.round((displayUclLpRound / 8) * 100))
    : Math.min(100, Math.round((displayRound / Math.max(1, live.totalRounds)) * 100));

  const nextTransferRound =
    live.stage === 'league' && live.transferWindows
      ? getNextTransferWindowRound(
          live.round,
          live.transferWindows,
          live.completedWindows ?? [],
        )
      : null;

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

  const handleInspectLeader = useCallback(
    (entry: PlayerSeasonStats) => {
      const allPlayers = Object.values(publicSquads).flatMap((s) => [
        ...s.starters,
        ...s.bench,
      ]);
      const found =
        allPlayers.find((p) => p.id === entry.playerId) ??
        resolvePlayerById({ playerId: entry.playerId, fallbackStats: entry });
      if (found) setInspected({ player: found, stats: entry });
    },
    [publicSquads],
  );

  const uclKoStageIdx =
    isUclStage && live.ucl
      ? UCL_KO_STEPS.findIndex((s) => s.id === live.ucl?.stage)
      : -1;

  return (
    <div className="mx-auto max-w-6xl px-2.5 py-2.5 sm:px-4 sm:py-4 space-y-3">
      {/* Top Status Card — automatically switches to UEFA Champions League navy theme in Phase 2 */}
      <section
        className={`rounded-xl sm:rounded-2xl border p-2.5 sm:p-4 space-y-2.5 ${
          isUclStage
            ? 'border-sky-500/35 bg-gradient-to-r from-[#091224] via-[#0d182e] to-[#0b1526] shadow-lg'
            : 'border-slate-800 bg-[#111822]'
        }`}
      >
        <div className="flex flex-col gap-2 sm:gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            {isUclStage && live.ucl ? (
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="inline-flex items-center gap-1 rounded border border-sky-400/40 bg-sky-500/20 px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-[11px] font-black tracking-wide text-sky-200">
                  <Trophy className="w-3 h-3 text-sky-300" />
                  UEFA CHAMPIONS LEAGUE
                </span>
                <span className="font-display text-[11px] sm:text-xs font-bold text-white tabular-nums">
                  {live.ucl.stage === 'league_phase'
                    ? `리그 페이즈 ${displayUclLpRound}/8R`
                    : live.ucl.stage === 'final'
                      ? '결승전'
                      : live.ucl.stage === 'completed'
                        ? '토너먼트 완료'
                        : `${UCL_STAGE_LABELS[live.ucl.stage]} · ${live.ucl.knockoutLeg}차전`}
                </span>
                {myClubId && myUclQualified ? (
                  live.ucl.stage === 'league_phase' && myUclRank !== null && myUclRow ? (
                    <span
                      className={`rounded border px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-[11px] font-bold tabular-nums ${
                        uclZoneOf(myUclRank).badgeCls
                      }`}
                    >
                      {myUclRank}위 · {myUclRow.points}점 · {uclZoneOf(myUclRank).label}
                    </span>
                  ) : (
                    (() => {
                      const st = getClubUclKnockoutStatus(myClubId);
                      return (
                        <span
                          className={`rounded border px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-[11px] font-bold ${st.tone}`}
                        >
                          {st.label}
                        </span>
                      );
                    })()
                  )
                ) : (
                  <span className="rounded border border-slate-700 bg-slate-800/80 px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-[11px] font-bold text-slate-300">
                    관전 중
                  </span>
                )}
                <span className="font-mono text-[10px] text-slate-500">#{roomCode}</span>
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
            ) : (
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span
                  className="rounded px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-[11px] font-extrabold text-slate-950"
                  style={{ backgroundColor: leagueMeta.accentColor }}
                >
                  {leagueMeta.koreanName}
                </span>
                <span className="font-display text-[11px] sm:text-xs font-bold text-slate-200 tabular-nums">
                  {displayRound}/{live.totalRounds}R
                </span>
                {myStandingRow && (
                  <span
                    className={`rounded px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-[11px] font-bold tabular-nums ${
                      myRank <= (leagueMeta.uclSpots ?? 4)
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {myRank}위 · {myStandingRow.points}점 ({myStandingRow.won}승{' '}
                    {myStandingRow.drawn}무 {myStandingRow.lost}패)
                  </span>
                )}
                <span className="font-mono text-[10px] text-slate-500">#{roomCode}</span>
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
            )}

            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] sm:text-xs text-slate-400 tabular-nums">
              {ratings && (
                <span>
                  A <strong className="text-slate-200">{ratings.effectiveAtt}</strong> · M{' '}
                  <strong className="text-slate-200">{ratings.effectiveMid}</strong> · D{' '}
                  <strong className="text-slate-200">{ratings.effectiveDef}</strong>
                </span>
              )}
              {chemistry && (
                <span className="inline-flex items-center gap-0.5 text-emerald-300 font-semibold">
                  <Zap className="w-3 h-3" />
                  {chemistry.total} ({chemistry.chemistryOvrBonus >= 0 ? '+' : ''}
                  {chemistry.chemistryOvrBonus.toFixed(1)})
                </span>
              )}
              {mine && (
                <span className="font-semibold text-slate-300">
                  사기 {getMoraleLabel(mine.morale)}
                </span>
              )}
              {!isUclStage && nextTransferRound !== null && (
                <span className="inline-flex items-center gap-0.5 text-amber-300/90">
                  <Calendar className="w-3 h-3" />
                  이적 {nextTransferRound}R
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {isHost && (
              <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-[#0b1018] px-1.5 py-1">
                <FastForward className="w-3 h-3 text-slate-500" />
                {MP_LEAGUE_AUTO_MS_OPTIONS.map((ms) => (
                  <button
                    key={ms}
                    type="button"
                    onClick={() => onSetAutoMs(ms)}
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums cursor-pointer ${
                      live.autoMs === ms
                        ? isUclStage
                          ? 'bg-sky-500/25 text-sky-200'
                          : 'bg-emerald-500/20 text-emerald-300'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {ms / 1000}s
                  </button>
                ))}
              </div>
            )}
            {live.summary && !summaryActive && (
              <button
                type="button"
                onClick={() => setSummaryReviewOpen(true)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-[#0b1018] px-2.5 py-1.5 text-[11px] font-bold text-slate-300 hover:text-white cursor-pointer"
              >
                <ClipboardList className="w-3 h-3" />
                시즌 정산
              </button>
            )}
            <button
              id="mpl-open-squad-btn"
              type="button"
              disabled={!mySquad}
              onClick={onOpenEditor}
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-extrabold disabled:opacity-40 cursor-pointer ${
                isUclStage
                  ? 'border-sky-400/45 bg-sky-500/15 text-sky-200 hover:bg-sky-500/25'
                  : 'border-emerald-500/45 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
              }`}
            >
              <Shield className="w-3 h-3" />
              스쿼드 · 전술
            </button>
            <button
              type="button"
              onClick={onLeaveRoom}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-[#0b1018] px-2.5 py-1.5 text-[11px] font-bold text-slate-400 hover:text-rose-300 cursor-pointer"
            >
              <LogOut className="w-3 h-3" />
              나가기
            </button>
          </div>
        </div>

        {/* Stage-specific progress indicator */}
        {isUclStage && live.ucl ? (
          live.ucl.stage === 'league_phase' ? (
            <div className="relative h-1 sm:h-1.5 w-full rounded-full bg-slate-900/90 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-400 transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-1">
              {UCL_KO_STEPS.map((st, idx) => {
                const isCurrent = live.ucl?.stage === st.id;
                const isDone =
                  live.ucl?.stage === 'completed' ||
                  (uclKoStageIdx >= 0 && idx < uclKoStageIdx);
                return (
                  <div
                    key={st.id}
                    className={`rounded-md border px-2 py-0.5 text-center text-[10px] font-extrabold ${
                      isCurrent
                        ? 'border-sky-400/60 bg-sky-500/20 text-sky-100'
                        : isDone
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300/80'
                          : 'border-slate-800/80 bg-[#080f1d] text-slate-500'
                    }`}
                  >
                    {st.label}
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <div className="relative h-1 sm:h-1.5 w-full rounded-full bg-slate-900">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
            {live.transferWindows?.map((winRound, i) => {
              const leftPct = (winRound / Math.max(1, live.totalRounds)) * 100;
              const doneWin = live.completedWindows?.includes(i + 1);
              return (
                <div
                  key={winRound}
                  style={{ left: `${leftPct}%` }}
                  title={`제 ${i + 1}차 이적시장 (${winRound}R 종료 후)`}
                  className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full border border-slate-950 ${
                    doneWin ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
              );
            })}
          </div>
        )}
      </section>

      {(errorMsg || hostMissing) && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/25 px-3.5 py-2 text-xs font-bold text-rose-200">
          {hostMissing ? '방장 기기에서 시즌 데이터를 찾을 수 없습니다' : errorMsg}
        </div>
      )}

      {pauseText && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-400/35 bg-amber-500/10 px-3.5 py-1.5">
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

      {tacticSavedNotice && (
        <div className="flex items-center gap-1.5 rounded-xl border border-sky-400/35 bg-sky-500/10 px-3.5 py-1.5 text-xs font-bold text-sky-200">
          <Check className="w-3.5 h-3.5 shrink-0 text-sky-300" />
          <span>전술 수정 완료 · 변경된 전술은 다음 경기부터 적용됩니다</span>
        </div>
      )}

      {flow.kind === 'consent' && (
        <div className="rounded-xl border border-sky-400/40 bg-gradient-to-r from-[#0a1628] via-[#0e1b30] to-[#0c1422] px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <PixelTrophySvg variant="ucl" size={20} />
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
                  {ok ? <Check className="w-3 h-3" /> : <Loader2 className="w-3 h-3 animate-spin" />}
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

      {/* Live scoreboard: the friends' matches of the round that was just simulated */}
      {live.ticker && live.ticker.matches.length > 0 && (
        <MpLiveTicker
          ticker={live.ticker}
          clubsById={clubsById}
          humans={live.humans}
          myClubId={myClubId}
          durationMs={Math.max(3600, Math.min(8200, live.autoMs - 900))}
          onDone={handleTickerDone}
        />
      )}

      {/* Mobile (<lg) Compact Section Switcher — eliminates long vertical scroll between main & sidebar */}
      <div
        className={`lg:hidden grid grid-cols-3 gap-1 rounded-xl border p-1 ${
          isUclStage
            ? 'border-sky-500/30 bg-[#08101f]'
            : 'border-slate-800 bg-[#0b1018]'
        }`}
      >
        {(
          [
            {
              id: 'main' as const,
              label: isUclStage ? '챔스 진행' : '진행 · 결과',
            },
            {
              id: 'table' as const,
              label: isUclStage
                ? live.ucl?.stage === 'league_phase'
                  ? 'UCL 순위표'
                  : '토너먼트'
                : '리그 순위표',
            },
            {
              id: 'leaders' as const,
              label: isUclStage ? 'UCL 기록' : '득점 · 도움',
            },
          ] as { id: MobileSection; label: string }[]
        ).map((sec) => {
          const active = mobileSection === sec.id;
          return (
            <button
              key={sec.id}
              type="button"
              onClick={() => setMobileSection(sec.id)}
              className={`rounded-lg border px-2 py-1.5 text-[11px] font-bold transition-colors cursor-pointer touch-manipulation ${
                active
                  ? isUclStage
                    ? 'border-sky-400/50 bg-sky-500/20 text-sky-100'
                    : 'border-emerald-500/45 bg-slate-800 text-white'
                  : 'border-transparent text-slate-400'
              }`}
            >
              {sec.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12 items-start">
        {/* Left Main Column (8 cols on desktop; visible when mobileSection === 'main' on mobile) */}
        <div
          className={`lg:col-span-8 space-y-3 ${
            mobileSection === 'main' ? 'block' : 'hidden lg:block'
          }`}
        >
          {/* Friends strip — displays live UCL standings/knockout status during Phase 2 */}
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {live.humans.map((h) => {
              const hl = view.byClub[h.clubId];
              const online = onlinePlayerIds.includes(h.playerId);
              const isMe = h.playerId === playerId;
              const inUcl = Boolean(isUclStage && live.ucl?.humanClubIds.includes(h.clubId));

              const leagueRankIdx = view.standings.findIndex((r) => r.teamId === h.clubId);
              const leagueRow = leagueRankIdx === -1 ? null : view.standings[leagueRankIdx];
              const uclRankIdx = isUclStage
                ? view.uclStandings.findIndex((r) => r.teamId === h.clubId)
                : -1;
              const uclRow = uclRankIdx === -1 ? null : view.uclStandings[uclRankIdx];

              const nextOpp = hl?.nextOpponentId ? clubsById[hl.nextOpponentId] : null;
              const nextIsFriend = Boolean(
                hl?.nextOpponentId && humanIds.has(hl.nextOpponentId),
              );
              const rawRecent = hl?.recent ?? [];
              const safeRecent =
                tickerPlaying && playingClubIds.has(h.clubId)
                  ? rawRecent.slice(0, Math.max(0, rawRecent.length - 1))
                  : rawRecent;

              return (
                <div
                  key={h.clubId}
                  className={`rounded-xl border p-2.5 space-y-1.5 ${
                    isMe
                      ? isUclStage
                        ? 'border-sky-400/50 bg-[#0d192f]'
                        : 'border-emerald-500/45 bg-[#0f1a24]'
                      : isUclStage
                        ? 'border-sky-500/20 bg-[#0b1324]'
                        : 'border-slate-800/90 bg-[#111822]'
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="relative shrink-0">
                      <PixelManagerAvatar
                        avatar={h.avatar}
                        clubPrimaryColor={h.profile.primaryColor}
                        clubSecondaryColor={h.profile.secondaryColor}
                        size={28}
                      />
                      <span
                        className={`absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ${
                          online ? 'bg-emerald-400' : 'bg-slate-600'
                        }`}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1 truncate text-[11px] font-extrabold text-white">
                        <span className="truncate">{h.nickname}</span>
                        {isMe && (
                          <span className="shrink-0 rounded bg-emerald-400 px-1 py-px text-[7px] font-black text-slate-950">
                            MY
                          </span>
                        )}
                      </div>
                      <div className="truncate text-[10px] text-slate-400">{h.profile.name}</div>
                    </div>
                    <div className="ml-auto text-right shrink-0">
                      {isUclStage && live.ucl ? (
                        inUcl ? (
                          live.ucl.stage === 'league_phase' && uclRankIdx >= 0 ? (
                            <>
                              <div
                                className={`font-mono text-xs font-black tabular-nums ${
                                  uclZoneOf(uclRankIdx + 1).rankCls
                                }`}
                              >
                                {uclRankIdx + 1}위
                              </div>
                              <div className="text-[10px] font-bold text-slate-400 tabular-nums">
                                {uclRow?.points ?? 0}점
                              </div>
                            </>
                          ) : (
                            <div className="text-[10px] font-extrabold text-sky-300">
                              {getClubUclKnockoutStatus(h.clubId).label}
                            </div>
                          )
                        ) : (
                          <div className="text-[10px] font-bold text-slate-500">미진출</div>
                        )
                      ) : (
                        <>
                          <div className="font-mono text-xs font-black text-white tabular-nums">
                            {leagueRankIdx === -1 ? '-' : `${leagueRankIdx + 1}위`}
                          </div>
                          <div className="text-[10px] font-bold text-slate-400 tabular-nums">
                            {leagueRow?.points ?? 0}점
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1 text-[10px] font-bold">
                    <span className="inline-flex items-center gap-0.5 rounded border border-slate-700 bg-[#0b1018] px-1.5 py-0.5 text-amber-200 tabular-nums">
                      <Swords className="w-2.5 h-2.5 text-amber-300" />
                      {hl?.h2h.won ?? 0}승 {hl?.h2h.drawn ?? 0}무 {hl?.h2h.lost ?? 0}패
                    </span>
                    {safeRecent.slice(-3).map((m, idx) => (
                      <span
                        key={`${m.label}-${idx}`}
                        title={m.label}
                        className={`rounded border px-1 py-0.5 tabular-nums ${resultTone(m, h.clubId)}`}
                      >
                        {m.homeGoals}:{m.awayGoals}
                      </span>
                    ))}
                  </div>
                  {!isUclStage && nextOpp && live.stage === 'league' && (
                    <div
                      className={`truncate text-[10px] font-bold ${
                        nextIsFriend ? 'text-amber-300' : 'text-slate-500'
                      }`}
                    >
                      다음 {nextOpp.name}
                    </div>
                  )}
                  {isUclStage && inUcl && live.ucl?.stage === 'league_phase' && uclRankIdx >= 0 && (
                    <div className="flex items-center justify-between text-[10px]">
                      <span
                        className={`rounded border px-1.5 py-px text-[9px] font-bold ${
                          uclZoneOf(uclRankIdx + 1).badgeCls
                        }`}
                      >
                        {uclZoneOf(uclRankIdx + 1).label}
                      </span>
                      <span className="font-mono text-slate-400 tabular-nums">
                        득실 {(uclRow?.goalDifference ?? 0) >= 0 ? `+${uclRow?.goalDifference ?? 0}` : uclRow?.goalDifference}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Navigation Tabs — tailored per phase */}
          <div
            className={`inline-flex flex-wrap items-center gap-1 rounded-xl border p-1 ${
              isUclStage
                ? 'border-sky-500/25 bg-[#08101f]'
                : 'border-slate-800 bg-[#0b1018]'
            }`}
          >
            {(isUclStage
              ? ([
                  {
                    id: 'ucl',
                    label:
                      live.ucl?.stage === 'league_phase'
                        ? 'UCL 전체 순위표'
                        : 'UCL 토너먼트 대진표',
                  },
                  { id: 'results', label: '최근 경기 결과' },
                  { id: 'domestic', label: '국내 리그 · 컵' },
                ] as { id: DashTab; label: string }[])
              : ([
                  { id: 'results', label: '라운드 결과' },
                  { id: 'cup', label: live.cup?.meta.koreanName ?? '컵' },
                ] as { id: DashTab; label: string }[])
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTabChoice(t.id)}
                className={`rounded-lg border px-3 py-1.5 text-[11px] font-bold transition-colors cursor-pointer ${
                  tab === t.id
                    ? isUclStage
                      ? 'bg-sky-500/20 text-sky-100 border-sky-400/50 shadow-sm'
                      : 'bg-slate-800 text-white border-emerald-500/45 shadow-sm'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'results' && (
            <div className="space-y-2.5">
              {isUclStage && view.uclLastScores.length > 0 && (
                <div className="rounded-xl border border-sky-500/25 bg-[#0b1324] p-2.5 space-y-1.5">
                  <div className="text-[11px] font-bold text-sky-300">
                    {view.uclLastScores[0].label}
                  </div>
                  <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                    {view.uclLastScores.map((m, idx) => (
                      <ScoreLine key={idx} m={m} clubsById={clubsById} humanIds={humanIds} />
                    ))}
                  </div>
                </div>
              )}
              {!isUclStage && view.cupNews.length > 0 && (
                <div className="rounded-xl border border-slate-800/90 bg-[#0d131c] p-2.5 space-y-1.5">
                  <div className="flex items-center gap-1 text-[11px] font-bold text-amber-200">
                    <Trophy className="w-3 h-3" />
                    {view.cupNews[0].label}
                  </div>
                  <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                    {view.cupNews.map((m, idx) => (
                      <ScoreLine key={idx} m={m} clubsById={clubsById} humanIds={humanIds} />
                    ))}
                  </div>
                </div>
              )}
              {!isUclStage && view.lastRound && (
                <div className="rounded-xl border border-slate-800/90 bg-[#0d131c] p-2.5 space-y-1.5">
                  <div className="text-[11px] font-bold text-slate-400">
                    {view.lastRound.round}R 결과
                  </div>
                  <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                    {view.lastRound.scores.map((m, idx) => (
                      <ScoreLine key={idx} m={m} clubsById={clubsById} humanIds={humanIds} />
                    ))}
                  </div>
                </div>
              )}
              {isUclStage && view.uclLastScores.length === 0 && (
                <div className="rounded-xl border border-sky-500/20 bg-[#0b1324] px-3 py-6 text-center text-xs font-bold text-slate-400">
                  경기 진행 중... 라운드 종료 시 결과가 반영됩니다.
                </div>
              )}
            </div>
          )}

          {tab === 'cup' && view.cup && (
            <div className="rounded-xl border border-slate-800/90 bg-[#0d131c] p-2 overflow-x-auto">
              <CupBracketView cup={view.cup} clubs={live.clubs} leagueId={live.leagueId} />
            </div>
          )}

          {tab === 'domestic' && isUclStage && (
            <div className="space-y-3">
              <SideStandings
                standings={view.standings}
                humans={live.humans}
                myClubId={myClubId}
                uclSpots={leagueMeta.uclSpots}
                relegationSpots={leagueMeta.relegationSpots}
              />
              {view.cup && (
                <div className="rounded-xl border border-slate-800/90 bg-[#0d131c] p-2 overflow-x-auto">
                  <CupBracketView cup={view.cup} clubs={live.clubs} leagueId={live.leagueId} />
                </div>
              )}
            </div>
          )}

          {tab === 'ucl' && live.ucl && uclView && (
            <div className="space-y-2">
              {live.ucl.stage === 'league_phase' ? (
                <StandingsTable
                  standings={view.uclStandings}
                  clubsById={clubsById}
                  uclSpots={8}
                  relegationSpots={12}
                />
              ) : (
                <div className="rounded-xl border border-sky-500/25 bg-[#0b1324] p-2 overflow-x-auto">
                  <UclBracketTree ucl={uclView.ucl} clubsById={uclView.clubsById} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Side Column (4 cols on desktop; split cleanly into table / leaders on mobile) */}
        <div
          className={`lg:col-span-4 space-y-2.5 ${
            mobileSection === 'main' ? 'hidden lg:block' : 'block'
          }`}
        >
          <div className={mobileSection === 'table' ? 'block' : 'hidden lg:block'}>
            {isUclStage && live.ucl ? (
              live.ucl.stage === 'league_phase' ? (
                <SideUclStandings
                  standings={view.uclStandings}
                  humans={live.humans}
                  myClubId={myClubId}
                  round={displayUclLpRound}
                />
              ) : (
                <SideUclKnockoutCard
                  ucl={live.ucl}
                  clubsById={clubsById}
                  humans={live.humans}
                  myClubId={myClubId}
                  onOpenBracket={() => {
                    setTabChoice('ucl');
                    setMobileSection('main');
                  }}
                />
              )
            ) : (
              <SideStandings
                standings={view.standings}
                humans={live.humans}
                myClubId={myClubId}
                uclSpots={leagueMeta.uclSpots}
                relegationSpots={leagueMeta.relegationSpots}
              />
            )}
          </div>

          <div className={mobileSection === 'leaders' ? 'block' : 'hidden lg:block'}>
            <LeagueLeadersSideCard
              scorers={isUclStage ? view.uclTopScorers : view.topScorers}
              assisters={isUclStage ? view.uclTopAssisters : view.topAssisters}
              myClubId={myClubId}
              friendLabelByClub={friendLabelByClub}
              maxRows={5}
              desktopLayout="stack"
              competitionPrefix={isUclStage ? 'UCL' : undefined}
              accent={isUclStage ? 'ucl' : 'league'}
              onSelectPlayer={handleInspectLeader}
            />
          </div>
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

      {showCupChampion && view.cup && (
        <MpCupChampionPopup
          cup={view.cup}
          leagueId={live.leagueId}
          clubsById={clubsById}
          humans={live.humans}
          myClubId={myClubId}
          onClose={() => closePopup(cupChampKey)}
        />
      )}

      {showSummary && live.summary && (
        <MpLeagueSeasonSummary
          leagueLabel={LEAGUE_LABEL[live.leagueId]}
          leagueId={live.leagueId}
          summary={live.summary}
          standings={live.standings}
          humans={live.humans}
          clubsById={clubsById}
          squads={publicSquads}
          myClubId={myClubId}
          cup={live.cup}
          uclEnabled={live.uclEnabled}
          uclHumanClubIds={live.ucl?.humanClubIds ?? []}
          h2hByClub={h2hByClub}
          acked={summaryActive && flow.kind === 'summary' && ackKeys.includes(flow.key)}
          waitingNames={flow.kind === 'summary' ? pendingAckNames(flow.key) : []}
          canContinue={summaryActive}
          onContinue={() => {
            if (flow.kind === 'summary') onAck(flow.key);
          }}
          onClose={summaryActive ? undefined : () => setSummaryReviewOpen(false)}
        />
      )}

      {mine &&
        (visibleEvent || showResolution) &&
        myHuman &&
        !tickerPlaying &&
        !showTransfer &&
        !showSummary &&
        !showCupChampion && (
          <ManagerEventModal
            activeEvent={visibleEvent}
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

      {mine &&
        mine.alerts.length > 0 &&
        mySquad &&
        chemistry &&
        ratings &&
        !mine.event &&
        !tickerPlaying &&
        !showTransfer &&
        !showSummary &&
        !showCupChampion && (
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
          offerClubs={mine.offerClubs}
          attemptsLeft={mine.attemptsLeft}
          tradeNote={mine.tradeNote}
          myStarters={mySquad.starters}
          myBench={mySquad.bench}
          myFormation={mySquad.formation}
          myTactic={mySquad.tactic}
          managerTraitId={mySquad.managerTraitId}
          myRank={myRank}
          leagueSize={live.standings.length || 20}
          conditionMap={mine.conditions}
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

      {showLpTable && uclView && (
        <UclLeaguePhaseStandingsModal
          ucl={uclView.ucl}
          clubsById={uclView.clubsById}
          teamEntryById={uclView.teamEntryById}
          onClose={() => closePopup(lpKey)}
        />
      )}

      {showMilestone && uclView && milestone && myHuman && (
        <UclMilestoneModal
          milestone={milestone}
          ucl={uclView.ucl}
          leagueId={live.leagueId}
          userClub={myHuman.profile}
          managerName={myHuman.nickname}
          managerAvatar={myHuman.avatar}
          clubsById={uclView.clubsById}
          uclPlayerStats={uclView.uclPlayerStats}
          isTreble={isTreble}
          onClose={() => closePopup(milestoneKey)}
        />
      )}

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
