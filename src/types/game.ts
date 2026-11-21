import type { DomesticCupState } from './cup';
import type {
  Club,
  Fixture,
  GlobalSeasonAwards,
  JerseyPattern,
  LeagueId,
  LiveHalftimeState,
  MatchResult,
  PlayerSeasonStats,
  SeasonAwards,
  StandingRow,
  TacticId,
} from './league';
import type {
  SeasonAchievementTrackers,
  SeasonScoreBreakdown,
} from './legacy';
import type { Phase2HandoffState, UclQualifiedLeagueEntry } from './phase2';
import type { Player, Position, SubPosition } from './player';
import type { UclTournamentState } from './ucl';

export type FormationId =
  | '4-3-3'
  | '4-4-2'
  | '4-2-3-1'
  | '3-5-2'
  | '3-4-3'
  | '3-4-2-1';

export type ManagerTraitId =
  | 'tiki_taka'
  | 'gegenpress_guru'
  | 'catenaccio'
  | 'wing_bomber'
  | 'halftime_wizard'
  | 'big_game_hunter'
  | 'set_piece_master'
  | 'underdog_killer'
  | 'total_football'
  | 'galactico_manager'
  | 'direct_football'
  | 'defensive_architect'
  | 'midfield_maestro'
  | 'super_sub';

export type GamePhase =
  | 'title'
  | 'manager_roulette'
  | 'setup'
  | 'draft'
  | 'league_select'
  | 'season'
  | 'ucl'
  | 'season_end';

export interface FormationSlot {
  index: number;
  label: string;
  subPosition: SubPosition;
  position: Position;
  x: number;
  y: number;
}

export interface BenchSlotDefinition {
  index: number;
  label: string;
  subPosition: SubPosition;
  position: Position;
}

export interface FormationConfig {
  id: FormationId;
  name: string;
  shortTag: string;
  description: string;
  strengthSummary: string;
  weaknessSummary: string;
  slots: FormationSlot[];
  links: [number, number][];
}

export interface UserClubProfile {
  name: string;
  shortName: string;
  primaryColor: string;
  secondaryColor: string;
  pattern: JerseyPattern;
}

export interface TeamRatings {
  att: number;
  mid: number;
  def: number;
  ovr: number;
  rawOvr: number;
  chemistryBonus: number; // -1.5 .. +2.5
  effectiveAtt: number;
  effectiveMid: number;
  effectiveDef: number;
}

export type ChemistryLinkStatus = 'none' | 'weak' | 'strong' | 'legend';

export type ChemistryLineType = 'club' | 'nation' | 'style';

export interface ChemistryLink {
  fromIndex: number;
  toIndex: number;
  status: ChemistryLinkStatus;
  score: number;
  reason: string;
  hasClubLink: boolean;
  hasNationLink: boolean;
  hasStyleLink: boolean;
  isLegendWildcard: boolean;
  activeLines: ChemistryLineType[];
}

export interface ChemistryBreakdown {
  club: number; // 0..25 (Same Club + Legend wildcard, NO Same League)
  nation: number; // 0..20 (Same Nationality)
  tacticStyle: number; // 0..40 (Playstyle + Tactic + Manager Synergy)
  roleBalance: number; // 0..15 (Squad Role Balance)
}

export interface ChemistryResult {
  total: number; // 0..100
  breakdown: ChemistryBreakdown;
  chemistryOvrBonus: number; // -1.5 .. +2.5
  links: ChemistryLink[];
  slotQuality: Record<number, ChemistryLinkStatus>;
  matchedStyleCount: number;
}

export interface RouletteReelResult {
  reelIndex: number; // 0, 1, 2
  isLegendSlot: boolean;
  club: Club | null;
  leagueId: LeagueId | 'LEGEND';
  candidates: Player[]; // 2..3 position-compatible players per rolled club or Legend slot
}

export type ManagerGenderId = 'male' | 'female';
export type ManagerSkinToneId = 'light' | 'peach' | 'warm' | 'tan' | 'deep';
export type ManagerHairStyleId =
  | 'fluffy'
  | 'parted'
  | 'slick'
  | 'buzz'
  | 'bald'
  | 'bob'
  | 'ponytail'
  | 'long_wave';
export type ManagerHairColorId = 'brown' | 'black' | 'silver' | 'blonde';
export type ManagerOutfitId =
  | 'classic_suit'
  | 'navy_coat'
  | 'team_tracksuit'
  | 'casual_shirt'
  | 'puffer_jacket';

export interface ManagerAvatarConfig {
  gender?: ManagerGenderId; // optional for legacy localStorage saves; defaults to 'male'
  skinTone: ManagerSkinToneId;
  hairStyle: ManagerHairStyleId;
  hairColor: ManagerHairColorId;
  outfit: ManagerOutfitId;
}

export const DEFAULT_MANAGER_NAME = '신임 감독';

export const DEFAULT_MANAGER_AVATAR: ManagerAvatarConfig = {
  gender: 'male',
  skinTone: 'peach',
  hairStyle: 'fluffy',
  hairColor: 'brown',
  outfit: 'classic_suit',
};

export interface ManagerRouletteState {
  name: string;
  avatar: ManagerAvatarConfig;
  traitId: ManagerTraitId | null;
  rerollsRemaining: number; // starts at 2
  hasSpun: boolean;
}

export interface DraftState {
  currentSlotType: 'starter' | 'bench';
  currentSlotIndex: number;
  hasSpun: boolean;
  reels: RouletteReelResult[];
  completed: boolean;
}

export interface TransferHistoryEntry {
  windowIndex: number;
  round: number;
  outPlayer: Player;
  inPlayer: Player;
  marketValueM?: number;
  successChance?: number;
}

export type TransferFormTrend = 'up' | 'flat' | 'down';

export interface TransferValuationBreakdown {
  baseValueM: number;
  formDeltaPct: number; // e.g. +18 or -12
  clubRankDeltaPct: number; // e.g. +10 or -8
  userPrestigeDeltaPct: number; // e.g. +10 (rank 1) .. -8 (relegation)
  baseChance: number;
  finalChance: number;
}

export interface TransferTargetPlayer {
  player: Player;
  clubName: string;
  clubShortName: string;
  clubPrimaryColor: string;
  clubSecondaryColor: string;
  leagueId: LeagueId | 'LEGEND';
  clubRank: number;
  leagueSize: number;
  marketValueM: number;
  successChance: number; // 5..95
  formTrend: TransferFormTrend;
  formRating: number;
  formGoals: number;
  formAssists: number;
  formCleanSheets: number;
  formSummary: string;
  breakdown: TransferValuationBreakdown;
  isLegendFa: boolean;
}

export interface TransferClubOffer {
  reelIndex: number; // 0, 1, 2
  isLegendSlot: boolean;
  club: Club | null;
  leagueId: LeagueId | 'LEGEND';
  clubRank: number;
  leagueSize: number;
  squad: TransferTargetPlayer[];
}

export interface TransferAttemptResult {
  success: boolean;
  targetPlayer: Player;
  outPlayer: Player;
  probability: number;
  marketValueM: number;
  message: string;
}

export interface TransferMarketState {
  isOpen: boolean;
  windowIndex: number; // 1, 2, 3, or 4 (UCL Special)
  triggerRound: number;
  attemptsRemaining: number; // starts at 3
  maxAttempts: number; // 3
  legendBonusActive: boolean; // rank <= 4 => 4.0% vs 2.5%
  isUclSpecial?: boolean;
  championBonusActive?: boolean; // League champion entering UCL -> 5.5% legend & +5% signing bonus
  userRankAtOpen: number;
  hasSpunClubs: boolean;
  rolledClubs: TransferClubOffer[];
  attemptedPlayerIds: string[];
  signedPlayerIds: string[];
  lastOfferResult: TransferAttemptResult | null;
  history: TransferHistoryEntry[];
  completedWindows: number[];
}

export interface OtherLeagueSeasonState {
  leagueId: LeagueId;
  clubs: Club[];
  fixtures: Fixture[];
  currentRound: number;
  totalRounds: number;
  standings: StandingRow[];
}

export interface SeasonState {
  leagueId: LeagueId;
  replacedClubName: string;
  defaultTactic: TacticId;
  nextMatchTactic: TacticId | null;
  clubs: Club[];
  aiRosters: Record<string, Player[]>; // 11 starters per AI club for individual stats
  fixtures: Fixture[];
  currentRound: number;
  totalRounds: number;
  transferWindows: [number, number, number];
  standings: StandingRow[];
  otherLeagues: Partial<Record<LeagueId, OtherLeagueSeasonState>>;
  lastUserMatch: MatchResult | null;
  liveHalftime: LiveHalftimeState | null;
  userMatchHistory: MatchResult[];
  allPlayerStats: Record<string, PlayerSeasonStats>;
  transferMarket: TransferMarketState;
  awards: SeasonAwards | null;
  globalAwards?: GlobalSeasonAwards | null;
  uclQualifiedSummary?: UclQualifiedLeagueEntry[];
  // Phase 2: Domestic Cup + 36-Team UCL + Legacy Trackers
  cup: DomesticCupState | null;
  cupChampionCelebrated?: boolean;
  cupPlayerStats: Record<string, PlayerSeasonStats>;
  userCupMatchHistory: MatchResult[];
  ucl: UclTournamentState | null;
  uclPlayerStats: Record<string, PlayerSeasonStats>;
  userUclMatchHistory: MatchResult[];
  achievementTrackers: SeasonAchievementTrackers;
  seasonScore: SeasonScoreBreakdown | null;
  legacyArchived?: boolean;
}

export interface GameState {
  phase: GamePhase;
  userClub: UserClubProfile;
  manager: ManagerRouletteState;
  draftLeaguePool: LeagueId[];
  formation: FormationId;
  defaultTactic: TacticId;
  starters: (Player | null)[];
  bench: (Player | null)[];
  draft: DraftState;
  season: SeasonState | null;
  phase2Handoff: Phase2HandoffState | null;
}
