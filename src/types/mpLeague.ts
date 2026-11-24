import type {
  ActiveManagerEvent,
  InjuryAlertItem,
  ManagerEventResolution,
  ManagerEventsState,
  PlayerConditionMap,
} from './condition';
import type { DomesticCupState } from './cup';
import type {
  FormationId,
  IncomingTradeOffer,
  ManagerAvatarConfig,
  ManagerTraitId,
  OtherLeagueSeasonState,
  RouletteReelResult,
  TransferClubOffer,
  UserClubProfile,
} from './game';
import type {
  Club,
  Fixture,
  GlobalSeasonAwards,
  LeagueId,
  MatchResult,
  PenaltyKickLog,
  PlayerSeasonStats,
  SeasonAwards,
  StandingRow,
  TacticId,
} from './league';
import type { SeasonScoreBreakdown } from './legacy';
import type { MpMatchState } from './multiplayer';
import type { Player, SubPosition } from './player';
import type {
  UclKnockoutStage,
  UclKnockoutTie,
  UclPhaseStage,
  UclTournamentState,
} from './ucl';

export const MP_LEAGUE_MIN_PLAYERS = 2;
export const MP_LEAGUE_MAX_PLAYERS = 4;
export const MP_LEAGUE_AUTO_MS_OPTIONS = [5000, 7000, 9000] as const;
export const MP_LEAGUE_TURN_SEC_OPTIONS = [15, 20, 30] as const;
export const MP_LEAGUE_DEFAULT_AUTO_MS = 5000;
export const MP_LEAGUE_DEFAULT_TURN_SEC = 30;
export const MP_LEAGUE_DRAFT_PICKS = 16;

/** Host-only room settings for the multi league mode (stored inside mp_rooms.settings.league). */
export interface MpLeagueSettings {
  leagueId: LeagueId;
  uclEnabled: boolean;
  autoMs: number;
  turnSec: number;
  maxPlayers: number;
}

export function normalizeMpLeagueSettings(
  raw: Partial<MpLeagueSettings> | undefined | null,
): MpLeagueSettings {
  const autoMs = Number(raw?.autoMs);
  const turnSec = Number(raw?.turnSec);
  return {
    leagueId: raw?.leagueId ?? 'epl',
    uclEnabled: raw?.uclEnabled ?? true,
    autoMs: Number.isFinite(autoMs)
      ? Math.max(4000, Math.min(9000, autoMs))
      : MP_LEAGUE_DEFAULT_AUTO_MS,
    turnSec: Number.isFinite(turnSec)
      ? Math.max(15, Math.min(30, turnSec))
      : MP_LEAGUE_DEFAULT_TURN_SEC,
    maxPlayers: Math.max(
      MP_LEAGUE_MIN_PLAYERS,
      Math.min(MP_LEAGUE_MAX_PLAYERS, raw?.maxPlayers ?? MP_LEAGUE_MAX_PLAYERS),
    ),
  };
}

/** Player-owned squad row (mp_room_players.league_payload). */
export interface MpLeagueSquadPayload {
  managerTraitId: ManagerTraitId;
  formation: FormationId;
  tactic: TacticId;
  starters: Player[];
  bench: Player[];
  /** True once manager / formation is chosen before the snake draft */
  setupReady?: boolean;
  /** Monotonic revision; whoever writes bumps it */
  rev: number;
  by: 'player' | 'host';
}

export type MpLeagueLockReason = 'tactics' | 'interview' | 'injury' | 'transfer';

export const MP_LEAGUE_LOCK_LABELS: Record<MpLeagueLockReason, string> = {
  tactics: '전술 수정 중',
  interview: '인터뷰 답변 중',
  injury: '부상 교체 중',
  transfer: '이적시장 진행 중',
};

/** Player-owned ephemeral status (mp_room_players.activity). */
export interface MpLeagueActivity {
  lock?: { reason: MpLeagueLockReason; since: string } | null;
  /** Latest block key this player acknowledged (stage consent, transfer window done, H2H report closed) */
  ackKeys?: string[];
  /** Shared draft roulette this manager spun as the first picker of a round */
  roll?: MpDraftRoll | null;
}

export interface MpDraftRoll {
  generation: number;
  round: number;
  /** Slot the round was spun for (the first picker's next open slot) */
  subPosition: SubPosition;
  label: string;
  reels: RouletteReelResult[];
}

export interface MpLeagueHuman {
  playerId: string;
  clubId: string;
  nickname: string;
  avatar: ManagerAvatarConfig;
  profile: UserClubProfile;
  managerTraitId: ManagerTraitId;
}

export interface MpLeaguePickRow {
  room_id: string;
  draft_generation: number;
  pick_no: number;
  player_ref: string;
  picker_id: string;
  player_json: MpLeaguePickJson;
  created_at?: string;
}

export interface MpLeaguePickJson {
  player: Player;
  area: 'starter' | 'bench';
  index: number;
  auto?: boolean;
}

export type MpLeagueActionKind =
  | 'event_choice'
  | 'event_dismiss'
  | 'injury_ack'
  | 'trade_accept'
  | 'trade_reject'
  | 'trade_counter';

export interface MpLeagueActionRow {
  id: string;
  room_id: string;
  player_id: string;
  kind: MpLeagueActionKind;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  status: 'pending' | 'done';
  created_at: string;
}

export type MpH2HContext = 'league' | 'cup' | 'ucl_lp' | 'ucl_ko';

export interface MpH2HSpec {
  /** Unique key of this fixture instance (also the precomputed result key) */
  key: string;
  ctx: MpH2HContext;
  label: string;
  homeClubId: string;
  awayClubId: string;
  round: number;
  knockout: boolean;
  aggHomeBefore?: number;
  aggAwayBefore?: number;
  speed: 2 | 4;
}

export interface MpH2HLive {
  spec: MpH2HSpec;
  /** null until both tactics are locked and the host kicks off */
  match: MpMatchState | null;
  /** ISO time when the pre-match room opened (auto-lock safety) */
  openedAt: string;
}

export type MpLeagueFlow =
  | { kind: 'auto' }
  | { kind: 'h2h' }
  | { kind: 'event'; key: string }
  | { kind: 'transfer'; key: string }
  | { kind: 'consent'; key: string; label: string }
  | { kind: 'summary'; key: string }
  | { kind: 'cast'; key: string }
  | { kind: 'done' };

export type MpLeagueStep =
  | { t: 'league_round' }
  | { t: 'cup_stage' }
  | { t: 'events' }
  | { t: 'transfer' }
  | { t: 'finish_league' }
  | { t: 'league_summary' }
  | { t: 'ucl_lp_round' }
  | { t: 'ucl_ko_leg' }
  | { t: 'finalize' };

export interface MpH2HRecord {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
}

export interface MpLiteMatch {
  competition: 'league' | 'cup' | 'ucl';
  label: string;
  homeTeamId: string;
  awayTeamId: string;
  homeGoals: number;
  awayGoals: number;
  /** Winner when decided after extra time / penalties */
  etWinnerId?: string | null;
  penalties?: boolean;
  isH2H?: boolean;
}

export interface MpTradeResultNote {
  success: boolean;
  message: string;
  probability?: number;
}

/** Host-private per-human season bookkeeping */
export interface MpHumanSeasonState {
  events: ManagerEventsState;
  alerts: InjuryAlertItem[];
  history: MpLiteMatch[];
  uclHistory: MpLiteMatch[];
  h2h: MpH2HRecord;
  offers: IncomingTradeOffer[];
  /** Partner club 16-man squad & needs for each incoming offer (populated only during transfer window) */
  offerClubs?: Record<string, TransferClubOffer>;
  attemptsLeft: number;
  tradeNote: MpTradeResultNote | null;
  lastMatch: MatchResult | null;
}

export interface MpCastMatch {
  key: string;
  label: string;
  homeTeamId: string;
  awayTeamId: string;
  /** 2nd leg only: aggregate before this match (home/away of THIS match) */
  aggHomeBefore?: number;
  aggAwayBefore?: number;
  goals: { minute: number; teamId: string; scorer: string }[];
  homeGoals: number;
  awayGoals: number;
  extraTime: boolean;
  penalties?: {
    home: number;
    away: number;
    winnerId: string;
    kicks?: PenaltyKickLog[];
  } | null;
  winnerId?: string | null;
  humanClubIds: string[];
  /** Key moments (goals, big saves, chances) shown only on the viewer's own match card */
  feed?: MpFeedItem[];
  stats?: MpMatchStatLine;
  /** Already watched live (friend match): show the final state without replay */
  instant?: boolean;
}

export interface MpFeedItem {
  minute: number;
  teamId: string;
  kind: 'goal' | 'save' | 'chance' | 'var';
  text: string;
}

export interface MpMatchStatLine {
  homePossession: number;
  homeShots: number;
  awayShots: number;
  homeXg: number;
  awayXg: number;
}

/** League season review shown to everyone once the league finishes (before the UCL / final board). */
export interface MpLeagueSummary {
  awards: SeasonAwards;
  squadStats: Record<string, PlayerSeasonStats[]>;
  cupChampionId: string | null;
}

export interface MpCastLive {
  key: string;
  title: string;
  matches: MpCastMatch[];
  /** League table before this round, shown while the scoreboard is still replaying */
  prevStandings?: StandingRow[];
}

export interface MpFriendRankRow {
  clubId: string;
  playerId: string;
  rank: number;
  seasonScore: SeasonScoreBreakdown;
  h2hPoints: number;
  h2h: MpH2HRecord;
  total: number;
  leagueRank: number;
  leaguePoints: number;
  cupLabel: string;
  uclLabel: string;
  historicalRank: number;
  historicalTotal: number;
}

export interface MpLeagueFinal {
  rows: MpFriendRankRow[];
  awards: SeasonAwards | null;
  globalAwards: GlobalSeasonAwards | null;
  championClubId: string | null;
  cupChampionId: string | null;
  uclChampionId: string | null;
  /** Combined season stats (league + cup + UCL) per friend club for the final squad tab */
  squadStats?: Record<string, PlayerSeasonStats[]>;
}

/** Slim UCL snapshot published to every client */
export interface MpUclLive {
  stage: UclPhaseStage;
  knockoutLeg: 1 | 2;
  leaguePhaseRound: number;
  clubs: Club[];
  standings: StandingRow[];
  ties: Record<UclKnockoutStage, UclKnockoutTie[]>;
  championTeamId: string | null;
  humanClubIds: string[];
  lastScores: MpLiteMatch[];
  /** Top UCL player stats (used for UCL MVP display in UclMilestoneModal) */
  topPlayerStats?: Record<string, PlayerSeasonStats>;
}

export interface MpHumanLive {
  clubId: string;
  morale: number;
  conditions: PlayerConditionMap;
  alerts: InjuryAlertItem[];
  event: ActiveManagerEvent | null;
  resolution: ManagerEventResolution | null;
  offers: IncomingTradeOffer[];
  /** Partner club 16-man squad & needs for original counter-offer UI (transfer window only) */
  offerClubs?: Record<string, TransferClubOffer>;
  attemptsLeft: number;
  tradeNote: MpTradeResultNote | null;
  h2h: MpH2HRecord;
  recent: MpLiteMatch[];
  nextOpponentId: string | null;
}

export interface MpDraftLive {
  generation: number;
  order: string[];
  turnSec: number;
  totalPicks: number;
}

export type MpLeagueStage = 'setup' | 'draft' | 'league' | 'ucl' | 'final';

/** Authoritative public state the host publishes to mp_league_state.live */
export interface MpLeagueLive {
  rev: number;
  seasonKey: string;
  stage: MpLeagueStage;
  flow: MpLeagueFlow;
  draft: MpDraftLive | null;
  leagueId: LeagueId;
  uclEnabled: boolean;
  autoMs: number;
  round: number;
  totalRounds: number;
  transferWindows?: [number, number, number];
  completedWindows?: number[];
  humans: MpLeagueHuman[];
  clubs: Club[];
  standings: StandingRow[];
  lastRound: { round: number; scores: MpLiteMatch[] } | null;
  cup: DomesticCupState | null;
  cupNews: MpLiteMatch[];
  topScorers: PlayerSeasonStats[];
  topAssisters: PlayerSeasonStats[];
  byClub: Record<string, MpHumanLive>;
  h2h: MpH2HLive | null;
  ucl: MpUclLive | null;
  cast: MpCastLive | null;
  /** Live scoreboard replay of the friends' matches in the round that was just simulated */
  ticker: MpCastLive | null;
  summary: MpLeagueSummary | null;
  final: MpLeagueFinal | null;
  transferWindowIndex: number | null;
  updatedAt: string;
}

/** Full host-private season state (kept in memory + IndexedDB on the host browser). */
export interface MpLeagueHostState {
  version: 1;
  roomId: string;
  seasonKey: string;
  settings: MpLeagueSettings;
  draftLeaguePool: LeagueId[];
  stage: MpLeagueStage;
  flow: MpLeagueFlow;
  todo: MpLeagueStep[];
  humans: MpLeagueHuman[];
  replacedClubNames: string[];
  clubs: Club[];
  aiRosters: Record<string, Player[]>;
  fixtures: Fixture[];
  round: number;
  totalRounds: number;
  transferWindows: [number, number, number];
  completedWindows: number[];
  transferWindowIndex: number | null;
  eventRounds: number[];
  lastEventRound?: number;
  standings: StandingRow[];
  allPlayerStats: Record<string, PlayerSeasonStats>;
  cup: DomesticCupState | null;
  cupPlayerStats: Record<string, PlayerSeasonStats>;
  otherLeagues: Partial<Record<LeagueId, OtherLeagueSeasonState>>;
  conditions: PlayerConditionMap;
  departedIds: string[];
  perHuman: Record<string, MpHumanSeasonState>;
  h2hQueue: MpH2HSpec[];
  h2hResults: Record<string, MatchResult>;
  h2hLive: MpH2HLive | null;
  lastRound: { round: number; scores: MpLiteMatch[] } | null;
  cupNews: MpLiteMatch[];
  ucl: UclTournamentState | null;
  uclPlayerStats: Record<string, PlayerSeasonStats>;
  uclHumanClubIds: string[];
  uclLastScores: MpLiteMatch[];
  uclConsentedStage: string | null;
  cast: MpCastLive | null;
  ticker: MpCastLive | null;
  summary: MpLeagueSummary | null;
  awards: SeasonAwards | null;
  globalAwards: GlobalSeasonAwards | null;
  final: MpLeagueFinal | null;
  /** Last squads the host validated for every friend (source of truth for roster membership) */
  squads: Record<string, MpSquadInput>;
  rev: number;
}

export interface MpSquadInput {
  managerTraitId: ManagerTraitId;
  formation: FormationId;
  tactic: TacticId;
  starters: Player[];
  bench: Player[];
}
