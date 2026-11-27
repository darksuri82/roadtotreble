import {
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  FastForward,
  Loader2,
  LogOut,
  Pause,
  Shield,
  Star,
  Swords,
  Trophy,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  evaluateManagerFitDetail,
  MANAGER_TRAITS,
} from '../../../data/managerTraits';
import {
  buildFfpPenaltyHelpItems,
  formatFfpBadgeSummary,
} from '../../../engine/budgetEngine';
import { calculateChemistry, calculateTeamRatings } from '../../../engine/chemistryEngine';
import { getMoraleLabel } from '../../../engine/conditionEngine';
import { getLeagueById } from '../../../engine/dataLoader';
import {
  buildMpAwakeningSeenKey,
  hydrateMpSquadWithAwakenings,
} from '../../../engine/mpLeagueEngine';
import {
  evaluateTacticalExposure,
  EXPOSURE_WARNING_THRESHOLD,
} from '../../../engine/tacticalAdaptationEngine';
import { getNextTransferWindowRound } from '../../../engine/transferEngine';
import { UCL_STAGE_LABELS } from '../../../engine/uclEngine';
import { ModalBodyLock } from '../../../hooks/useBodyScrollLock';
import type { DomesticCupState } from '../../../types/cup';
import type { StaffCoachId } from '../../../types/game';
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
import { AwakeningCelebrationModal } from '../../common/AwakeningCelebrationModal';
import { ClubSquadModal } from '../../common/ClubSquadModal';
import { FfpOpeningNoticeModal } from '../../common/FfpOpeningNoticeModal';
import { InfoHelpButton } from '../../common/InfoHelpButton';
import { InjuryAlertModal } from '../../common/InjuryAlertModal';
import { ManagerEventModal } from '../../common/ManagerEventModal';
import type { SlotRef } from '../../common/PitchBoard';
import { PixelManagerAvatar } from '../../common/PixelManagerAvatar';
import { PixelTrophySvg } from '../../common/PixelTrophySvg';
import { PlayerDetailModal } from '../../common/PlayerDetailModal';
import { StaffCoachBadge } from '../../common/StaffCoachBadge';
import { StaffCoachHireModal } from '../../common/StaffCoachHireModal';
import { TacticalAdaptationModal } from '../../common/TacticalAdaptationModal';
import { CupBracketView } from '../../league/CupBracketView';
import { LeagueLeadersSideCard } from '../../league/LeagueLeadersSideCard';
import { StandingsTable } from '../../league/StandingsTable';
import {
  UclBracketTree,
  type LiveTieOverlay,
  type UclBracketParticipant,
} from '../../ucl/UclBracketTree';
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
import { MpUclMatchPreviewModal } from './MpUclMatchPreviewModal';
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

type DashTab = 'results' | 'cup' | 'ucl' | 'lp_table' | 'domestic';
type MobileSection = 'main' | 'table' | 'leaders';

const SEEN_POPUPS_STORAGE_KEY = 'rtt_mp_seen_popups_v1';

function loadPersistedSeenPopups(): string[] {
  try {
    const raw = window.localStorage.getItem(SEEN_POPUPS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === 'string')
      : [];
  } catch {
    return [];
  }
}

/** Popups already displayed for this room/season/player (persisted in localStorage + memory). */
const seenPopups = new Set<string>(loadPersistedSeenPopups());

export function markMpPopupSeen(key: string): void {
  if (seenPopups.has(key)) return;
  seenPopups.add(key);
  try {
    const recent = Array.from(seenPopups).slice(-40);
    window.localStorage.setItem(SEEN_POPUPS_STORAGE_KEY, JSON.stringify(recent));
  } catch {
    // Ignore storage quota/private mode errors
  }
}

export function hasMpPopupBeenSeen(key: string): boolean {
  return seenPopups.has(key);
}

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
  optimisticAcks?: Record<string, string[]>;
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
  onSaveSquadAsync?: (next: MpSquadInput) => Promise<void>;
  onAck: (key: string) => void;
  onEventChoice: (choiceId: string) => void;
  onDismissResolution: (key: string) => void;
  onInjuryAck: () => void;
  onTradeAccept: (offerId: string) => void;
  onTradeReject: (offerId: string) => void;
  onTradeCounter: (payload: MpCounterTradePayload) => void;
  onHireStaffCoach?: (coachId: StaffCoachId) => void;
  onSkipStaffCoach?: () => void;
  onDismissFfpNotice?: () => void;
  onDismissAdaptationAlert?: () => void;
  onDismissAwakeningAlert?: (playerId?: string) => void;
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
  mySquad: rawMySquad,
  ackKeys,
  optimisticAcks,
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
  onSaveSquadAsync,
  onAck,
  onEventChoice,
  onDismissResolution,
  onInjuryAck,
  onTradeAccept,
  onTradeReject,
  onTradeCounter,
  onHireStaffCoach,
  onSkipStaffCoach,
  onDismissFfpNotice,
  onDismissAdaptationAlert,
  onDismissAwakeningAlert,
  onSetAutoMs,
  onForceResume,
  onLeaveRoom,
}: MpLeagueDashboardProps) {
  const [tabChoice, setTabChoice] = useState<DashTab | null>(null);
  const [mobileSection, setMobileSection] = useState<MobileSection>('main');
  const [openCupPopupKey, setOpenCupPopupKey] = useState<string | null>(null);
  const [openLpPopupKey, setOpenLpPopupKey] = useState<string | null>(null);
  const [openMilestoneKey, setOpenMilestoneKey] = useState<string | null>(null);
  const [summaryReviewOpen, setSummaryReviewOpen] = useState(false);
  const [showPastUclRound, setShowPastUclRound] = useState(false);
  const [dismissedAwakeningKeys, setDismissedAwakeningKeys] = useState<string[]>([]);
  const [dismissedFfpKeys, setDismissedFfpKeys] = useState<string[]>([]);
  const [dismissedAdaptationKeys, setDismissedAdaptationKeys] = useState<string[]>([]);
  const [castLive, setCastLive] = useState<{
    castKey: string;
    overlays: Record<string, LiveTieOverlay>;
    settled: boolean;
  } | null>(null);
  const [inspected, setInspected] = useState<{
    player: Player;
    stats?: PlayerSeasonStats | null;
  } | null>(null);
  const [inspectedHumanClubId, setInspectedHumanClubId] = useState<
    string | null
  >(null);

  const isUclStage = live.stage === 'ucl' && Boolean(live.ucl);
  const tab: DashTab = useMemo(() => {
    if (isUclStage) {
      if (
        tabChoice === 'results' ||
        tabChoice === 'domestic' ||
        tabChoice === 'ucl' ||
        tabChoice === 'lp_table'
      ) {
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

  const mySquad = useMemo(
    () =>
      rawMySquad
        ? hydrateMpSquadWithAwakenings(rawMySquad, mine?.awakenedPlayers)
        : null,
    [rawMySquad, mine?.awakenedPlayers],
  );

  const ffpChemPenalty = mine?.budget?.chemPenalty ?? 0;
  const hiredStaffCoachId = mine?.staffCoach?.hiredCoachId ?? null;

  const chemistry = useMemo(
    () =>
      mySquad
        ? calculateChemistry(
            mySquad.formation,
            mySquad.starters,
            mySquad.tactic,
            mySquad.managerTraitId,
            undefined,
            {
              staffCoachId: hiredStaffCoachId,
              ffpChemPenalty,
            },
          )
        : null,
    [mySquad, hiredStaffCoachId, ffpChemPenalty],
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
            mySquad.tactic,
            hiredStaffCoachId,
          )
        : null,
    [mySquad, chemistry, hiredStaffCoachId],
  );

  const myTacticalExposure = useMemo(() => {
    const history = mine?.tacticalAdaptation?.history;
    if (!mySquad || !history || history.length === 0) return null;
    return evaluateTacticalExposure({
      history,
      formation: mySquad.formation,
      tactic: mySquad.tactic,
      staffCoachId: hiredStaffCoachId,
    });
  }, [mine?.tacticalAdaptation?.history, mySquad, hiredStaffCoachId]);

  const publicSquads = useMemo(() => {
    const map: Record<string, MpSquadInput> = {};
    for (const h of live.humans) {
      const fromSummary = live.summary?.squads?.[h.clubId];
      const p = players.find((r) => r.player_id === h.playerId)?.league_payload;
      const baseSquad: MpSquadInput | null =
        p && p.starters?.length === 11
          ? {
              managerTraitId: p.managerTraitId,
              formation: p.formation,
              tactic: p.tactic,
              starters: p.starters,
              bench: p.bench,
            }
          : fromSummary && fromSummary.starters?.length === 11
            ? fromSummary
            : null;
      if (baseSquad) {
        map[h.clubId] = hydrateMpSquadWithAwakenings(
          baseSquad,
          live.byClub[h.clubId]?.awakenedPlayers,
        );
      }
    }
    return map;
  }, [live.humans, live.byClub, live.summary?.squads, players]);

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
  const hasPlayerAck = useCallback(
    (h: MpLeagueHuman, key: string): boolean => {
      if (h.playerId === playerId && ackKeys.includes(key)) return true;
      if (optimisticAcks?.[h.playerId]?.includes(key)) return true;
      return Boolean(rowByPlayer(h)?.activity?.ackKeys?.includes(key));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [playerId, ackKeys, optimisticAcks, players],
  );

  const activeCastKey = live.cast?.key ?? null;
  const castSettled = Boolean(
    activeCastKey && castLive?.castKey === activeCastKey && castLive.settled,
  );
  const activeCastOverlays = useMemo<Record<string, LiveTieOverlay> | undefined>(() => {
    if (!activeCastKey || castLive?.castKey !== activeCastKey) return undefined;
    return castLive.overlays;
  }, [activeCastKey, castLive]);

  const handleCastLiveOverlays = useCallback(
    (overlays: Record<string, LiveTieOverlay>, settled: boolean) => {
      if (!activeCastKey) return;
      setCastLive({ castKey: activeCastKey, overlays, settled });
    },
    [activeCastKey],
  );

  const effectiveUclStage =
    tickerPlaying && live.ticker?.prevUclStage
      ? live.ticker.prevUclStage
      : live.cast && !castSettled && live.cast.prevUclStage
        ? live.cast.prevUclStage
        : live.ucl?.stage ?? null;

  const effectiveUclLeg: 1 | 2 =
    tickerPlaying && live.ticker?.prevUclKnockoutLeg
      ? live.ticker.prevUclKnockoutLeg
      : live.cast && !castSettled && live.cast.prevUclKnockoutLeg
        ? live.cast.prevUclKnockoutLeg
        : live.ucl?.knockoutLeg ?? 1;

  const isUclKnockout = Boolean(
    isUclStage &&
      effectiveUclStage &&
      effectiveUclStage !== 'league_phase' &&
      effectiveUclStage !== 'special_transfer',
  );

  const bracketUcl = useMemo(() => {
    if (!live.ucl) return null;
    if (live.cast && !castSettled && live.cast.prevUclTies) {
      return {
        ...live.ucl,
        stage: live.cast.prevUclStage ?? live.ucl.stage,
        knockoutLeg: live.cast.prevUclKnockoutLeg ?? live.ucl.knockoutLeg,
        ties: live.cast.prevUclTies,
        championTeamId: live.cast.prevUclChampionTeamId ?? null,
      };
    }
    return live.ucl;
  }, [live.ucl, live.cast, castSettled]);

  const bracketParticipants = useMemo<UclBracketParticipant[]>(
    () =>
      live.humans.map((h) => ({
        clubId: h.clubId,
        nickname: h.nickname,
        isMe: h.clubId === myClubId,
      })),
    [live.humans, myClubId],
  );

  const flow = live.flow;
  const eventNames =
    !tickerPlaying && flow.kind === 'event'
      ? live.humans.filter((h) => live.byClub[h.clubId]?.event).map((h) => h.nickname)
      : [];
  const pendingAckNames = (key: string, clubIds?: string[]) =>
    live.humans
      .filter((h) => {
        if (clubIds && !clubIds.includes(h.clubId)) return false;
        return !hasPlayerAck(h, key);
      })
      .map((h) => h.nickname);
  const transferWaiting =
    !tickerPlaying && flow.kind === 'transfer'
      ? live.humans
          .filter((h) => {
            const hl = live.byClub[h.clubId];
            if (!hl || hl.offers.length === 0) return false;
            return !hasPlayerAck(h, flow.key);
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
  const milestoneKey = milestone ? `${roomCode}:${live.seasonKey}:${playerId}:ms:${milestone}` : null;
  const lpKey =
    live.ucl && live.ucl.leaguePhaseRound >= 8
      ? `${roomCode}:${live.seasonKey}:${playerId}:lp-table`
      : null;
  const popupsAllowed = !live.cast && !tickerPlaying && flow.kind !== 'cast';
  const summaryActive = flow.kind === 'summary' && live.summary !== null;

  // 1-time FFP opening notice guard (prevents re-open on realtime re-broadcast)
  const ffpNoticeKey =
    mine?.pendingFfpOpeningNotice && mine.budget && mine.budget.ffpTier >= 1
      ? `${roomCode}:${live.seasonKey}:${playerId}:ffp-open`
      : null;
  const visibleFfpNotice = Boolean(
    ffpNoticeKey &&
      !dismissedFfpKeys.includes(ffpNoticeKey) &&
      !hasMpPopupBeenSeen(ffpNoticeKey),
  );

  // 1-time Awakening popup guard per (roomCode, seasonKey, clubId, playerId)
  // Prevents duplicate awakening popups on host broadcasts or realtime re-receives for both host and guests.
  const visibleAwakeningEntry = useMemo(() => {
    if (!mine?.pendingAwakeningAlerts?.length || !myClubId) return null;
    for (const alert of mine.pendingAwakeningAlerts) {
      const seenKey = `${roomCode}:${buildMpAwakeningSeenKey(
        live.seasonKey,
        myClubId,
        alert.playerId,
      )}`;
      if (
        dismissedAwakeningKeys.includes(seenKey) ||
        hasMpPopupBeenSeen(seenKey)
      ) {
        continue;
      }
      return { alert, seenKey };
    }
    return null;
  }, [
    mine?.pendingAwakeningAlerts,
    myClubId,
    roomCode,
    live.seasonKey,
    dismissedAwakeningKeys,
  ]);

  // Optimistic tactical adaptation alert guard
  const pendingAdaptation = mine?.tacticalAdaptation?.pendingAlert ?? null;
  const adaptationAlertKey = pendingAdaptation
    ? `${roomCode}:${live.seasonKey}:${playerId}:adapt:${pendingAdaptation.id}`
    : null;
  const visibleAdaptationEntry =
    pendingAdaptation &&
    adaptationAlertKey &&
    !dismissedAdaptationKeys.includes(adaptationAlertKey)
      ? { alert: pendingAdaptation, key: adaptationAlertKey }
      : null;

  const handleDismissFfp = useCallback(() => {
    if (ffpNoticeKey) {
      markMpPopupSeen(ffpNoticeKey);
      setDismissedFfpKeys((prev) =>
        prev.includes(ffpNoticeKey) ? prev : [...prev, ffpNoticeKey],
      );
    }
    onDismissFfpNotice?.();
  }, [ffpNoticeKey, onDismissFfpNotice]);

  const handleDismissAwakening = useCallback(() => {
    if (!visibleAwakeningEntry) return;
    const { alert, seenKey } = visibleAwakeningEntry;
    markMpPopupSeen(seenKey);
    setDismissedAwakeningKeys((prev) =>
      prev.includes(seenKey) ? prev : [...prev, seenKey],
    );
    onDismissAwakeningAlert?.(alert.playerId);
  }, [visibleAwakeningEntry, onDismissAwakeningAlert]);

  const handleDismissAdaptation = useCallback(() => {
    if (visibleAdaptationEntry) {
      const k = visibleAdaptationEntry.key;
      setDismissedAdaptationKeys((prev) => (prev.includes(k) ? prev : [...prev, k]));
    }
    onDismissAdaptationAlert?.();
  }, [visibleAdaptationEntry, onDismissAdaptationAlert]);

  // Spoiler-free Domestic Cup Champion popup: ONLY triggers once during domestic league stage after live stream finishes
  const cupChampKey =
    live.stage === 'league' && view.cup?.completed && view.cup.championTeamId
      ? `${roomCode}:${live.seasonKey}:${playerId}:cup-champ`
      : null;
  const canTriggerCupChampion = Boolean(
    popupsAllowed &&
      !visibleFfpNotice &&
      !visibleAwakeningEntry &&
      !showTransfer &&
      !visibleEvent &&
      !showResolution &&
      cupChampKey &&
      live.cup?.completed &&
      (live.cup.championTeamId === myClubId || !summaryActive),
  );
  const cupPending = Boolean(
    canTriggerCupChampion && cupChampKey && !hasMpPopupBeenSeen(cupChampKey),
  );
  const showCupChampion = Boolean(openCupPopupKey && live.cup?.completed);

  // League season summary popup: ALSO strictly gated behind !tickerPlaying & !showCupChampion!
  const showSummary =
    ((summaryActive &&
      popupsAllowed &&
      !visibleFfpNotice &&
      !visibleAwakeningEntry &&
      !showCupChampion &&
      !cupPending) ||
      summaryReviewOpen) &&
    live.summary !== null;

  const canTriggerLpTable = Boolean(
    popupsAllowed &&
      !visibleFfpNotice &&
      !visibleAwakeningEntry &&
      !showSummary &&
      !showCupChampion &&
      !cupPending &&
      lpKey &&
      uclView,
  );
  const lpPending = Boolean(canTriggerLpTable && lpKey && !hasMpPopupBeenSeen(lpKey));
  const showLpTable = Boolean(openLpPopupKey && uclView);

  const canTriggerMilestone = Boolean(
    popupsAllowed &&
      !visibleFfpNotice &&
      !visibleAwakeningEntry &&
      !showSummary &&
      !showCupChampion &&
      !cupPending &&
      !showLpTable &&
      !lpPending &&
      milestoneKey &&
      uclView,
  );
  const milestonePending = Boolean(
    canTriggerMilestone && milestoneKey && !hasMpPopupBeenSeen(milestoneKey),
  );
  const showMilestone = Boolean(openMilestoneKey && uclView && milestone && myHuman);

  const isUclKnockoutConsent = Boolean(
    isUclStage && isUclKnockout && live.ucl && flow.kind === 'consent',
  );
  const hasPendingMineInjury = Boolean(
    mine && mine.alerts.length > 0 && mySquad && chemistry && ratings,
  );
  const hasPendingStaffCoach = Boolean(
    mine &&
      mine.staffCoach?.pendingSelection &&
      mine.staffCoach.offeredCoachIds.length > 0 &&
      mySquad,
  );
  const hasPendingEvent = Boolean(mine && (visibleEvent || showResolution) && myHuman);
  const hasPendingLeagueStartConsent = Boolean(!isUclStage && flow.kind === 'consent');
  const hasPendingUclLpTickerModal = Boolean(
    isUclStage && tickerPlaying && live.ticker && live.ticker.matches.length > 0,
  );

  // Single sequential overlay queue: guarantees at most ONE overlay modal is visible at any time
  type ActiveOverlayModal =
    | 'cast'
    | 'lp_ticker'
    | 'ffp_notice'
    | 'awakening'
    | 'cup_champ'
    | 'summary'
    | 'lp_table'
    | 'milestone'
    | 'event'
    | 'injury'
    | 'staff_coach'
    | 'transfer'
    | 'adaptation'
    | 'editor'
    | 'league_start_consent'
    | 'ucl_preview'
    | null;

  const activeOverlayModal: ActiveOverlayModal = (() => {
    if (live.cast) return 'cast';
    if (hasPendingUclLpTickerModal) return 'lp_ticker';
    if (!popupsAllowed) return null;
    if (visibleFfpNotice) return 'ffp_notice';
    if (visibleAwakeningEntry) return 'awakening';
    if (showCupChampion) return 'cup_champ';
    if (cupPending) return null;
    if (showSummary) return 'summary';
    if (showLpTable) return 'lp_table';
    if (lpPending) return null;
    if (showMilestone) return 'milestone';
    if (milestonePending) return null;
    if (hasPendingEvent) return 'event';
    if (hasPendingMineInjury) return 'injury';
    if (hasPendingStaffCoach) return 'staff_coach';
    if (showTransfer && mine && mySquad && flow.kind === 'transfer') return 'transfer';
    if (visibleAdaptationEntry) return 'adaptation';
    if (editorOpen && mySquad && !isUclKnockoutConsent) return 'editor';
    if (hasPendingLeagueStartConsent) return 'league_start_consent';
    if (isUclKnockoutConsent && live.ucl) return 'ucl_preview';
    return null;
  })();

  // Latch domestic cup champion popup strictly once (persisted in localStorage + memory)
  useEffect(() => {
    if (!canTriggerCupChampion || !cupChampKey || hasMpPopupBeenSeen(cupChampKey)) return;
    const timer = window.setTimeout(() => {
      if (hasMpPopupBeenSeen(cupChampKey)) return;
      markMpPopupSeen(cupChampKey);
      setOpenCupPopupKey(cupChampKey);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [canTriggerCupChampion, cupChampKey]);

  // Latch UCL League Phase final standings popup strictly once
  useEffect(() => {
    if (!canTriggerLpTable || !lpKey || hasMpPopupBeenSeen(lpKey)) return;
    const timer = window.setTimeout(() => {
      if (hasMpPopupBeenSeen(lpKey)) return;
      markMpPopupSeen(lpKey);
      setOpenLpPopupKey(lpKey);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [canTriggerLpTable, lpKey]);

  // Latch UCL milestone popup strictly once
  useEffect(() => {
    if (!canTriggerMilestone || !milestoneKey || hasMpPopupBeenSeen(milestoneKey)) return;
    const timer = window.setTimeout(() => {
      if (hasMpPopupBeenSeen(milestoneKey)) return;
      markMpPopupSeen(milestoneKey);
      setOpenMilestoneKey(milestoneKey);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [canTriggerMilestone, milestoneKey]);
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
    isUclStage && effectiveUclStage
      ? UCL_KO_STEPS.findIndex((s) => s.id === effectiveUclStage)
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
            {isUclStage && live.ucl && effectiveUclStage ? (
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="inline-flex items-center gap-1 rounded border border-sky-400/40 bg-sky-500/20 px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-[11px] font-black tracking-wide text-sky-200">
                  <Trophy className="w-3 h-3 text-sky-300" />
                  UEFA CHAMPIONS LEAGUE
                </span>
                <span className="font-display text-[11px] sm:text-xs font-bold text-white tabular-nums">
                  {effectiveUclStage === 'league_phase'
                    ? `리그 페이즈 ${displayUclLpRound}/8R`
                    : effectiveUclStage === 'final'
                      ? '결승전'
                      : effectiveUclStage === 'completed'
                        ? '토너먼트 완료'
                        : `${UCL_STAGE_LABELS[effectiveUclStage]} · ${effectiveUclLeg}차전`}
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
                <InfoHelpButton
                  title="멀티 챔스 · 생존자 규칙"
                  align="left"
                  size="xs"
                  guideTab="legacy"
                  items={[
                    '리그 페이즈 8경기(1~8위 직행 · 9~24위 PO · 25~36위 탈락) 후 토너먼트 진입',
                    '토너먼트 단계 및 1↔2차전 전환 시 현재 생존자 전원 [준비 완료] 후 즉시 진행 (탈락자는 관전)',
                    '최종 친구 순위 = 공정 시즌 점수 + 친구 맞대결 점수(최대 1,500점)',
                  ]}
                />
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
                <InfoHelpButton
                  title="멀티 리그 진행 규칙"
                  align="left"
                  size="xs"
                  guideTab="legacy"
                  items={[
                    '누군가 스쿼드·전술 수정, 인터뷰, 부상 대응 중이면 방 전체가 안전하게 일시정지됩니다',
                    '친구 맞대결은 2D 중계(4인 리그 맞대결은 2차전 2D · 1차전 라이브 중계), 비당사자는 읽기 전용 관전',
                    '최종 친구 순위 = 공정 시즌 점수 + 맞대결 점수(최대 1,500점)',
                  ]}
                />
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
                <span className="inline-flex items-center gap-0.5 text-amber-300/90 whitespace-nowrap">
                  <Calendar className="w-3 h-3" />
                  이적 {nextTransferRound}R
                </span>
              )}
              {mine?.budget && (
                <span className="inline-flex items-center gap-1">
                  <span
                    className={`inline-flex items-center rounded border px-1.5 py-px text-[10px] font-bold whitespace-nowrap tabular-nums ${
                      mine.budget.ffpTier === 2
                        ? 'border-rose-500/45 bg-rose-500/18 text-rose-200'
                        : mine.budget.ffpTier === 1
                          ? 'border-amber-400/45 bg-amber-500/15 text-amber-200'
                          : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    }`}
                  >
                    {mine.budget.ffpTier >= 1
                      ? formatFfpBadgeSummary(mine.budget.ffpTier)
                      : `자금 €${mine.budget.transferCashM}M`}
                  </span>
                  {mine.budget.ffpTier >= 1 && (
                    <InfoHelpButton
                      title={
                        mine.budget.ffpTier === 2
                          ? `FFP 2단계 징계 적용 중 (+${mine.budget.excessPct}%)`
                          : `FFP 1단계 주의 적용 중 (+${mine.budget.excessPct}%)`
                      }
                      align="right"
                      size="xs"
                      guideTab="budget"
                      items={buildFfpPenaltyHelpItems(mine.budget)}
                    />
                  )}
                </span>
              )}
              {hiredStaffCoachId && mySquad && (
                <StaffCoachBadge
                  coachId={hiredStaffCoachId}
                  activeTactic={mySquad.tactic}
                  compact
                />
              )}
              {myTacticalExposure &&
                myTacticalExposure.exposureScore >= EXPOSURE_WARNING_THRESHOLD && (
                  <span
                    className={`inline-flex items-center rounded border px-1.5 py-px text-[10px] font-bold whitespace-nowrap tabular-nums ${
                      myTacticalExposure.tier === 'danger'
                        ? 'border-rose-500/45 bg-rose-500/18 text-rose-200'
                        : 'border-amber-400/45 bg-amber-500/15 text-amber-200'
                    }`}
                  >
                    {myTacticalExposure.tier === 'danger'
                      ? `전술 파훼 ${myTacticalExposure.exposureScore}%`
                      : `전술 노출 ${myTacticalExposure.exposureScore}%`}
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
            {!isUclKnockoutConsent && (
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
            )}
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

      {isUclStage && !isUclKnockout && flow.kind === 'consent' && !tickerPlaying && !live.cast && (() => {
        const allEliminated = Boolean(flow.allEliminated);
        const requiredClubIds =
          flow.requiredClubIds && flow.requiredClubIds.length > 0
            ? flow.requiredClubIds
            : live.humans.map((h) => h.clubId);
        const survivorHumans = allEliminated
          ? []
          : live.humans.filter((h) => requiredClubIds.includes(h.clubId));
        const readyCount = survivorHumans.filter((h) => hasPlayerAck(h, flow.key)).length;
        const iAmRequired = allEliminated
          ? isHost
          : Boolean(myClubId && requiredClubIds.includes(myClubId));
        const iAcked = ackKeys.includes(flow.key);
        const waitingSurvivors = pendingAckNames(flow.key, requiredClubIds);

        return (
          <div className="rounded-xl border border-sky-400/45 bg-gradient-to-r from-[#0a1628] via-[#0e1b30] to-[#0c1422] px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <PixelTrophySvg variant="ucl" size={20} />
              <span className="text-xs font-extrabold text-sky-200">
                {allEliminated ? flow.label : `${flow.label} · 전술 정비`}
              </span>
              {allEliminated ? (
                <span className="rounded-md border border-rose-500/35 bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-bold text-rose-200">
                  생존자 0명
                </span>
              ) : (
                <>
                  <span className="rounded-md border border-sky-400/35 bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-black tabular-nums text-sky-200">
                    생존자 준비 {readyCount}/{survivorHumans.length}
                  </span>
                  {survivorHumans.map((h) => {
                    const ok = hasPlayerAck(h, flow.key);
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
                </>
              )}
            </div>

            {allEliminated ? (
              isHost ? (
                <button
                  id="mpl-consent-btn"
                  type="button"
                  disabled={iAcked}
                  onClick={() => onAck(flow.key)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-4 py-2 text-xs font-extrabold text-slate-950 hover:bg-amber-300 disabled:opacity-60 cursor-pointer"
                >
                  <FastForward className="w-3.5 h-3.5" />
                  {iAcked ? '진행 중...' : '남은 토너먼트 진행'}
                </button>
              ) : (
                <span className="text-[11px] font-bold text-slate-400">
                  방장 진행 대기 중
                </span>
              )
            ) : !iAmRequired ? (
              <span className="rounded-lg border border-slate-700 bg-[#0b1018] px-2.5 py-1 text-[11px] font-bold text-slate-400">
                관전 중 · {waitingSurvivors.length > 0 ? `${waitingSurvivors.join(', ')} 준비 대기` : '곧 시작'}
              </span>
            ) : iAcked ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/35 bg-emerald-500/12 px-2.5 py-1.5 text-[11px] font-bold text-emerald-300">
                <Check className="w-3.5 h-3.5" />
                준비 완료됨
                {waitingSurvivors.length > 0 && (
                  <span className="text-slate-400 font-semibold">
                    · {waitingSurvivors.join(', ')} 대기 중
                  </span>
                )}
              </span>
            ) : (
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  disabled={!mySquad}
                  onClick={onOpenEditor}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-sky-400/45 bg-sky-500/15 px-3 py-2 text-xs font-extrabold text-sky-200 hover:bg-sky-500/25 disabled:opacity-40 cursor-pointer"
                >
                  <Shield className="w-3.5 h-3.5" />
                  전술 수정
                </button>
                <button
                  id="mpl-consent-btn"
                  type="button"
                  onClick={() => onAck(flow.key)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-extrabold text-slate-950 hover:bg-emerald-400 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  준비 완료
                </button>
              </div>
            )}
          </div>
        );
      })()}

      {/* Pre-Season Match 1 Readiness Popup Modal (before Round 1 auto-progress starts) */}
      {activeOverlayModal === 'league_start_consent' && flow.kind === 'consent' && (() => {
        const requiredClubIds =
          flow.requiredClubIds && flow.requiredClubIds.length > 0
            ? flow.requiredClubIds
            : live.humans.map((h) => h.clubId);
        const participants = live.humans.filter((h) => requiredClubIds.includes(h.clubId));
        const readyCount = participants.filter((h) => hasPlayerAck(h, flow.key)).length;
        const iAcked = ackKeys.includes(flow.key);
        const waitingList = pendingAckNames(flow.key, requiredClubIds);

        return (
          <div
            id="mp-league-start-consent-modal"
            className="modal-backdrop fixed inset-0 z-[65] flex items-center justify-center bg-slate-950/85 p-3 sm:p-4"
          >
            <ModalBodyLock />
            <div className="modal-panel modal-scroll w-full max-w-md max-h-[90dvh] overflow-y-auto overscroll-contain touch-pan-y rounded-2xl border border-emerald-500/35 bg-[#0d1420] shadow-2xl">
              <div className="border-b border-slate-800 bg-[#090e17] px-4 py-3.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Trophy className="h-4 w-4 shrink-0 text-emerald-400" />
                  <h2 className="truncate text-sm font-black text-white">
                    {flow.label}
                  </h2>
                </div>
                <span className="shrink-0 whitespace-nowrap rounded-md border border-emerald-500/35 bg-emerald-500/12 px-2 py-0.5 text-[10px] font-black tabular-nums text-emerald-300">
                  준비 {readyCount}/{participants.length}
                </span>
              </div>

              <div className="p-4 space-y-3.5">
                <div className="text-xs font-semibold text-slate-300 break-keep">
                  첫 경기 개막 전 전술·라인업을 정비하세요. 전원 준비 완료 시 1R이 시작됩니다.
                </div>

                <div className="space-y-1.5">
                  {participants.map((h) => {
                    const ok = hasPlayerAck(h, flow.key);
                    const isMe = h.playerId === playerId;
                    return (
                      <div
                        key={h.clubId}
                        className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs ${
                          ok
                            ? 'border-emerald-500/35 bg-emerald-500/10'
                            : 'border-slate-800 bg-[#0a1019]'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <PixelManagerAvatar
                            avatar={h.avatar}
                            clubPrimaryColor={h.profile.primaryColor}
                            clubSecondaryColor={h.profile.secondaryColor}
                            size={24}
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1 truncate font-extrabold text-white">
                              <span className="truncate">{h.nickname}</span>
                              {isMe && (
                                <span className="rounded bg-emerald-400 px-1 py-px text-[8px] font-black text-slate-950">
                                  MY
                                </span>
                              )}
                            </div>
                            <div className="truncate text-[10px] text-slate-400">
                              {h.profile.name}
                            </div>
                          </div>
                        </div>
                        <span
                          className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-[10px] font-extrabold ${
                            ok
                              ? 'border-emerald-400/45 bg-emerald-500/18 text-emerald-200'
                              : 'border-slate-700 bg-slate-900 text-slate-400'
                          }`}
                        >
                          {ok ? (
                            <>
                              <Check className="h-3 w-3" />
                              준비 완료
                            </>
                          ) : (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" />
                              대기 중
                            </>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {iAcked ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/35 bg-emerald-500/12 px-3 py-2.5 text-xs font-bold text-emerald-200">
                      <Check className="h-3.5 w-3.5" />
                      준비 완료됨
                      {waitingList.length > 0 && (
                        <span className="text-slate-400 font-semibold">
                          · {waitingList.join(', ')} 대기 중
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={!mySquad}
                      onClick={onOpenEditor}
                      className="w-full inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-700 bg-[#0b1018] px-3 py-2 text-xs font-bold text-slate-200 hover:border-sky-400/50 hover:text-sky-200 disabled:opacity-40 cursor-pointer"
                    >
                      <Shield className="w-3.5 h-3.5" />
                      대기 중 전술 수정
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      id="mpl-start-tactics-btn"
                      type="button"
                      disabled={!mySquad}
                      onClick={onOpenEditor}
                      className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-sky-400/45 bg-sky-500/15 px-3 py-2.5 text-xs font-extrabold text-sky-200 hover:bg-sky-500/25 disabled:opacity-40 cursor-pointer"
                    >
                      <Shield className="w-3.5 h-3.5" />
                      전술 수정
                    </button>
                    <button
                      id="mpl-consent-btn"
                      type="button"
                      onClick={() => onAck(flow.key)}
                      className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-emerald-500 px-3 py-2.5 text-xs font-extrabold text-slate-950 hover:bg-emerald-400 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      준비 완료
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Centered Popup Modal — UCL Knockout Live Multicast Board */}
      {activeOverlayModal === 'cast' && live.cast && (
        <MpUclMulticastBoard
          cast={live.cast}
          clubsById={clubsById}
          humans={live.humans}
          myClubId={myClubId}
          bracketTies={
            bracketUcl
              ? Object.values(bracketUcl.ties).flat()
              : undefined
          }
          onLiveOverlays={handleCastLiveOverlays}
        />
      )}

      {/* Live Scoreboard: Centered Popup Modal during UCL League Phase playback; collapsible past results when settled; inline during domestic league */}
      {live.ticker && live.ticker.matches.length > 0 && (
        isUclStage ? (
          activeOverlayModal === 'lp_ticker' ? (
            <div
              id="mp-ucl-lp-cast-modal"
              className="modal-backdrop fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/86 p-3 sm:p-4"
            >
              <ModalBodyLock />
              <div className="modal-panel modal-scroll w-full max-w-3xl max-h-[90dvh] overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y rounded-2xl border border-sky-500/35 bg-[#0b1322] shadow-2xl">
                <div className="flex items-center justify-between gap-2 border-b border-slate-800 px-4 py-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Star className="h-4 w-4 shrink-0 fill-current text-sky-300" />
                    <h2 className="truncate font-display text-sm sm:text-base font-bold tracking-wide text-white">
                      {live.ticker.title}
                    </h2>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-[10px] font-black tracking-widest text-rose-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-pulse" />
                    LIVE
                  </span>
                </div>
                <div className="p-3 sm:p-4">
                  <MpLiveTicker
                    ticker={live.ticker}
                    clubsById={clubsById}
                    humans={live.humans}
                    myClubId={myClubId}
                    durationMs={Math.max(3600, Math.min(8200, live.autoMs - 900))}
                    onDone={handleTickerDone}
                    useUclPkVisual
                  />
                </div>
              </div>
            </div>
          ) : !isUclKnockout ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setShowPastUclRound((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/25 bg-[#0b1324] px-2.5 py-1 text-[11px] font-bold text-sky-200 hover:border-sky-400/50 cursor-pointer"
                >
                  {showPastUclRound ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                  지난 라운드 기록 보기 ({live.ticker.title})
                </button>
              </div>
              {showPastUclRound && (
                <MpLiveTicker
                  ticker={live.ticker}
                  clubsById={clubsById}
                  humans={live.humans}
                  myClubId={myClubId}
                  durationMs={Math.max(3600, Math.min(8200, live.autoMs - 900))}
                  onDone={handleTickerDone}
                  useUclPkVisual
                />
              )}
            </div>
          ) : null
        ) : (
          <MpLiveTicker
            ticker={live.ticker}
            clubsById={clubsById}
            humans={live.humans}
            myClubId={myClubId}
            durationMs={Math.max(3600, Math.min(8200, live.autoMs - 900))}
            onDone={handleTickerDone}
          />
        )
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
              label: isUclKnockout ? '토너먼트 대진표' : isUclStage ? '챔스 진행' : '진행 · 결과',
            },
            {
              id: 'table' as const,
              label: isUclStage
                ? isUclKnockout
                  ? '라운드 요약'
                  : '리그페이즈 순위'
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

              const sq = publicSquads[h.clubId] ?? (isMe ? mySquad : null);
              const traitId = sq?.managerTraitId ?? h.managerTraitId;
              const traitDef = traitId ? MANAGER_TRAITS[traitId] : null;
              const fitDetail =
                traitId && sq?.starters?.length
                  ? evaluateManagerFitDetail({
                      traitId,
                      starters: sq.starters,
                      tactic: sq.tactic,
                    })
                  : null;
              const traitCompactStat =
                fitDetail && fitDetail.scalingMode === 'progressive'
                  ? `${fitDetail.matchedCount}/${fitDetail.totalSlots}`
                  : traitDef
                    ? traitDef.effectSummary.split(',')[0]?.slice(0, 12)
                    : null;

              return (
                <div
                  key={h.clubId}
                  role="button"
                  tabIndex={0}
                  onClick={() => setInspectedHumanClubId(h.clubId)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setInspectedHumanClubId(h.clubId);
                    }
                  }}
                  title={`${h.nickname} (${h.profile.name}) 스쿼드 · 포메이션 보기`}
                  className={`rounded-xl border p-2.5 space-y-1.5 cursor-pointer transition-colors select-none touch-manipulation ${
                    isMe
                      ? isUclStage
                        ? 'border-sky-400/50 bg-[#0d192f] hover:border-sky-300/80'
                        : 'border-emerald-500/45 bg-[#0f1a24] hover:border-emerald-400/80'
                      : isUclStage
                        ? 'border-sky-500/20 bg-[#0b1324] hover:border-sky-400/55'
                        : 'border-slate-800/90 bg-[#111822] hover:border-sky-400/55'
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
                  {traitDef && (
                    <div className="flex items-center justify-between gap-1 text-[9.5px] min-w-0">
                      <span
                        title={`${traitDef.name} · ${traitDef.effectSummary}`}
                        className="inline-flex items-center gap-1 min-w-0 rounded border border-slate-700/80 bg-[#0b1018] px-1.5 py-0.5 font-bold text-slate-200"
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: traitDef.badgeColor }}
                        />
                        <span className="truncate">{traitDef.name}</span>
                        {traitCompactStat && (
                          <span className="whitespace-nowrap shrink-0 font-mono text-[9px] text-amber-300 tabular-nums">
                            {traitCompactStat}
                          </span>
                        )}
                      </span>
                      {sq?.formation && (
                        <span className="whitespace-nowrap shrink-0 font-mono text-[9px] font-bold text-slate-400">
                          {sq.formation}
                        </span>
                      )}
                    </div>
                  )}
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
                    label: isUclKnockout
                      ? 'UCL 토너먼트 대진표'
                      : 'UCL 리그페이즈 순위',
                  },
                  ...(isUclKnockout
                    ? [{ id: 'lp_table' as const, label: '리그페이즈 순위' }]
                    : []),
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

          {tab === 'lp_table' && live.ucl && (
            <StandingsTable
              standings={view.uclStandings}
              clubsById={clubsById}
              uclSpots={8}
              midZoneSpots={24}
              relegationSpots={12}
              title="UCL 리그페이즈 최종 순위 (8/8R)"
              topZoneLabel="1~8위 16강 직행"
              midZoneLabel="9~24위 플레이오프"
              bottomZoneLabel="25~36위 탈락"
              accent="ucl"
            />
          )}

          {tab === 'ucl' && live.ucl && bracketUcl && (
            <div className="space-y-2">
              {!isUclKnockout ? (
                <StandingsTable
                  standings={view.uclStandings}
                  clubsById={clubsById}
                  uclSpots={8}
                  midZoneSpots={24}
                  relegationSpots={12}
                  title={`UCL 리그페이즈 순위 (${displayUclLpRound}/8R)`}
                  topZoneLabel="1~8위 16강 직행"
                  midZoneLabel="9~24위 플레이오프"
                  bottomZoneLabel="25~36위 탈락"
                  accent="ucl"
                />
              ) : (
                <UclBracketTree
                  ucl={bracketUcl}
                  clubsById={clubsById}
                  myClubId={myClubId}
                  participants={bracketParticipants}
                  liveTieOverlays={activeCastOverlays}
                  hideChampion={Boolean(live.cast && !castSettled)}
                />
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
            {isUclStage && bracketUcl ? (
              !isUclKnockout ? (
                <SideUclStandings
                  standings={view.uclStandings}
                  humans={live.humans}
                  myClubId={myClubId}
                  round={displayUclLpRound}
                />
              ) : (
                <SideUclKnockoutCard
                  ucl={bracketUcl}
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

      {activeOverlayModal === 'editor' && mySquad && (
        <MpLeagueSquadEditor
          squad={mySquad}
          managerTraitId={mySquad.managerTraitId}
          staffCoachId={hiredStaffCoachId}
          ffpChemPenalty={ffpChemPenalty}
          tacticalHistory={mine?.tacticalAdaptation?.history}
          conditions={mine?.conditions ?? {}}
          onSave={onSaveSquad}
          onClose={onCloseEditor}
        />
      )}

      {activeOverlayModal === 'ucl_preview' && live.ucl && flow.kind === 'consent' && (() => {
        const allEliminated = Boolean(flow.allEliminated);
        const requiredClubIds =
          flow.requiredClubIds && flow.requiredClubIds.length > 0
            ? flow.requiredClubIds
            : live.humans.map((h) => h.clubId);
        return (
          <MpUclMatchPreviewModal
            key={flow.key}
            ucl={live.ucl}
            leagueId={live.leagueId}
            clubsById={clubsById}
            humans={live.humans}
            publicSquads={publicSquads}
            byClub={live.byClub}
            myClubId={myClubId}
            mySquad={mySquad}
            myConditions={mine?.conditions}
            myStaffCoachId={hiredStaffCoachId}
            myFfpChemPenalty={ffpChemPenalty}
            myTacticalHistory={mine?.tacticalAdaptation?.history}
            isHost={isHost}
            flowKey={flow.key}
            flowLabel={flow.label}
            requiredClubIds={requiredClubIds}
            allEliminated={allEliminated}
            hasPlayerAck={hasPlayerAck}
            iAcked={ackKeys.includes(flow.key)}
            waitingSurvivors={pendingAckNames(flow.key, requiredClubIds)}
            onSaveSquad={onSaveSquadAsync ?? onSaveSquad}
            onAck={onAck}
            onInspectPlayer={(player) => setInspected({ player })}
          />
        );
      })()}

      {activeOverlayModal === 'cup_champ' && live.cup && (
        <MpCupChampionPopup
          cup={live.cup}
          leagueId={live.leagueId}
          clubsById={clubsById}
          humans={live.humans}
          myClubId={myClubId}
          onClose={() => setOpenCupPopupKey(null)}
        />
      )}

      {activeOverlayModal === 'summary' && live.summary && (
        <MpLeagueSeasonSummary
          leagueLabel={LEAGUE_LABEL[live.leagueId]}
          leagueId={live.leagueId}
          summary={live.summary}
          standings={live.standings}
          humans={live.humans}
          clubsById={clubsById}
          squads={publicSquads}
          byClub={live.byClub}
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

      {activeOverlayModal === 'event' && mine && myHuman && (
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

      {activeOverlayModal === 'injury' && mine && mySquad && chemistry && ratings && (
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

      {activeOverlayModal === 'staff_coach' &&
        mine?.staffCoach &&
        mySquad && (
          <StaffCoachHireModal
            offeredCoachIds={mine.staffCoach.offeredCoachIds}
            activeTactic={mySquad.tactic}
            onHire={(coachId) => onHireStaffCoach?.(coachId)}
            onSkip={() => onSkipStaffCoach?.()}
          />
        )}

      {activeOverlayModal === 'transfer' &&
        mine &&
        mySquad &&
        flow.kind === 'transfer' && (
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
            staffCoachId={hiredStaffCoachId}
            ffpChemPenalty={ffpChemPenalty}
            myRank={myRank}
            leagueSize={live.standings.length || 20}
            conditionMap={mine.conditions}
            availableCashM={mine.budget?.transferCashM ?? 0}
            ffpTier={mine.budget?.ffpTier ?? 0}
            busy={actionBusy}
            done={transferDone}
            waitingNames={transferWaiting}
            onAccept={onTradeAccept}
            onReject={onTradeReject}
            onCounter={onTradeCounter}
            onSaveSquad={onSaveSquad}
            onFinish={() => onAck(flow.key)}
          />
        )}

      {activeOverlayModal === 'ffp_notice' && mine?.budget && (
        <FfpOpeningNoticeModal
          budgetState={mine.budget}
          managerAvatar={myHuman?.avatar}
          managerName={myHuman?.nickname}
          userClub={myHuman?.profile}
          onDismiss={handleDismissFfp}
        />
      )}

      {activeOverlayModal === 'awakening' && visibleAwakeningEntry && (
        <AwakeningCelebrationModal
          alert={visibleAwakeningEntry.alert}
          onDismiss={handleDismissAwakening}
        />
      )}

      {activeOverlayModal === 'adaptation' && visibleAdaptationEntry && (
        <TacticalAdaptationModal
          alert={visibleAdaptationEntry.alert}
          managerAvatar={myHuman?.avatar}
          managerName={myHuman?.nickname}
          userClub={myHuman?.profile}
          onDismiss={handleDismissAdaptation}
          onGoToTactics={() => {
            handleDismissAdaptation();
            onOpenEditor();
          }}
        />
      )}

      {activeOverlayModal === 'lp_table' && uclView && (
        <UclLeaguePhaseStandingsModal
          ucl={uclView.ucl}
          clubsById={uclView.clubsById}
          teamEntryById={uclView.teamEntryById}
          onClose={() => setOpenLpPopupKey(null)}
        />
      )}

      {activeOverlayModal === 'milestone' && uclView && milestone && myHuman && (
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
          onClose={() => setOpenMilestoneKey(null)}
        />
      )}

      {inspectedHumanClubId && (() => {
        const targetHuman = live.humans.find(
          (h) => h.clubId === inspectedHumanClubId,
        );
        const targetClub =
          clubsById[inspectedHumanClubId] ??
          (targetHuman
            ? {
                id: targetHuman.clubId,
                name: targetHuman.profile.name,
                shortName: targetHuman.profile.shortName,
                primaryColor: targetHuman.profile.primaryColor,
                secondaryColor: targetHuman.profile.secondaryColor,
                pattern: targetHuman.profile.pattern,
                att: 80,
                mid: 80,
                def: 80,
                formation: '4-3-3' as const,
                defaultTactic: 'balanced' as const,
                topScorers: ['', '', ''] as [string, string, string],
              }
            : null);
        const targetSquad =
          publicSquads[inspectedHumanClubId] ??
          (inspectedHumanClubId === myClubId ? mySquad : null);
        const roster = targetSquad
          ? [...targetSquad.starters, ...targetSquad.bench]
          : [];
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
            conditionMap={
              inspectedHumanClubId === myClubId ? mine?.conditions : undefined
            }
            onSelectPlayer={(player) => {
              setInspected({ player, stats: null });
            }}
            onClose={() => setInspectedHumanClubId(null)}
          />
        );
      })()}

      {inspected && (
        <PlayerDetailModal
          player={inspected.player}
          seasonStats={inspected.stats ?? null}
          managerTraitId={mySquad?.managerTraitId}
          onClose={() => setInspected(null)}
        />
      )}
    </div>
  );
}
