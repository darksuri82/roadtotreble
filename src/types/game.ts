import type {
  InjuryAlertItem,
  InjuryAutoReturnEntry,
  InjuryReturnNotification,
  ManagerEventsState,
  PlayerConditionMap,
} from './condition';
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
  | '4-4-2-diamond'
  | '4-2-3-1'
  | '3-5-2'
  | '3-5-2-dm'
  | '3-4-3'
  | '3-4-2-1'
  | '3-3-3-1';

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

export interface AiManagerProfile {
  name: string;
  ovr: number; // 70..99
  traitId: ManagerTraitId;
  preferredFormations?: FormationId[];
  preferredTactics?: TacticId[];
}

export type GamePhase =
  | 'title'
  | 'manager_roulette'
  | 'setup'
  | 'draft'
  | 'league_select'
  | 'season'
  | 'ucl'
  | 'season_end'
  | 'dream_match';

export interface FormationSlot {
  index: number;
  label: string;
  subPosition: SubPosition;
  alternateSubPositions?: SubPosition[];
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
  synergyOvrBonus?: number; // avg individual player synergy + manager OVR boost
  effectiveAtt: number;
  effectiveMid: number;
  effectiveDef: number;
  /** Manager philosophy + tactic bonuses already included in effectiveAtt/Mid/Def */
  managerAttBonus?: number;
  managerMidBonus?: number;
  managerDefBonus?: number;
  managerMatchedCount?: number;
  managerTargetCount?: number;
  managerTacticActive?: boolean;
  managerEffectSummary?: string;
  /** Assistant coach always-on / tactic-active A/M/D bonuses already included in effectiveAtt/Mid/Def */
  staffAttBonus?: number;
  staffMidBonus?: number;
  staffDefBonus?: number;
  staffCoachEffectSummary?: string;
}

export type ChemistryLinkStatus = 'none' | 'weak' | 'strong' | 'legend';

export type ChemistryLineType = 'club' | 'nation' | 'style' | 'elite';

export interface ChemistryLink {
  fromIndex: number;
  toIndex: number;
  status: ChemistryLinkStatus;
  score: number;
  reason: string;
  hasClubLink: boolean;
  hasNationLink: boolean;
  hasStyleLink: boolean;
  hasEliteLink?: boolean;
  isFormerClubLink?: boolean;
  sharedClubName?: string;
  isLegendWildcard: boolean;
  activeLines: ChemistryLineType[];
}

export interface ChemistryBreakdown {
  club: number; // active Same Club / Former Club lines count
  nation: number; // active Same Nationality lines count
  tacticStyle: number; // active Complementary Playstyle lines count
  roleBalance: number; // active Elite 88+ Pair lines count
  elite?: number; // alias mirror of roleBalance
  totalLines?: number; // total active lines across all formation edges
  maxReferenceLines?: number; // formation-normalized line count for 100 chemistry
}

export interface PlayerSlotSynergy {
  slotIndex: number;
  playerId: string;
  totalBonus: number; // 0..4 (neighborBonus 0..3 + independent managerBonus 0..1)
  managerBonus: number; // 0 or 1 independent Manager Style direct player boost
  neighborBonus: number; // 0..3 strictly by connected line count (2->+1, 4->+2, 8->+3)
  lineCount?: number; // total active lines connected to this player
  reasons: string[];
  playerReasons?: string[];
  managerReason?: string;
  baseEffectiveOvr: number; // base OVR + position fit penalty
  effectiveOvrWithSynergy: number; // base OVR + position fit penalty + totalBonus
}

export interface ChemistryResult {
  total: number; // 0..100
  breakdown: ChemistryBreakdown;
  chemistryOvrBonus: number; // -1.5 .. +2.5
  links: ChemistryLink[];
  slotQuality: Record<number, ChemistryLinkStatus>;
  slotSynergies: Record<number, PlayerSlotSynergy>;
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
  | 'long_wave'
  | 'updo_bun';
export type ManagerHairColorId = 'brown' | 'black' | 'silver' | 'blonde';
export type ManagerOutfitId =
  | 'classic_suit'
  | 'navy_coat'
  | 'team_tracksuit'
  | 'casual_shirt'
  | 'puffer_jacket'
  | 'female_blazer'
  | 'female_trench'
  | 'female_tracksuit'
  | 'female_knit_skirt';

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
  isStarter?: boolean;
  slotLabel?: string;
  isShockBargain?: boolean;
  bargainDiscountPct?: number;
  bargainReason?: string;
}

export interface ClubPositionNeeds {
  neededPositions: ('GK' | 'DF' | 'MF' | 'FW')[];
  saturatedPositions: ('GK' | 'DF' | 'MF' | 'FW')[];
  avgOvrByPos: Record<'GK' | 'DF' | 'MF' | 'FW', number>;
  countByPos: Record<'GK' | 'DF' | 'MF' | 'FW', number>;
  summaryText: string;
}

export interface TradeAssetValuation {
  playerId: string;
  baseTp: number;
  ageModPct: number;
  formModPct: number;
  injuryModPct: number;
  moraleModPct: number;
  needModPct: number;
  bargainModPct?: number;
  isShockBargain?: boolean;
  effectiveTp: number;
}

export interface TradePackageEvaluation {
  userRawTp: number;
  userEffectiveTp: number;
  aiEffectiveTp: number;
  ratio: number;
  acceptanceChance: number;
  blockedReason: string | null;
  gmReaction: string;
  gmTone: 'eager' | 'considering' | 'hesitant' | 'offended';
  userValuations: TradeAssetValuation[];
  aiValuations: TradeAssetValuation[];
  requiredAutoFillers: number;
  requiredUserReleaseCount: number;
  cashOfferM?: number;
  cashTp?: number;
}

export interface IncomingTradeOffer {
  id: string;
  club: Club;
  leagueId: LeagueId;
  clubRank: number;
  leagueSize: number;
  clubNeeds: ClubPositionNeeds;
  aiOffersPlayers: Player[];
  userRequestedPlayers: Player[];
  aiPitch: string;
  status: 'pending' | 'accepted' | 'rejected';
  isBlockbusterBargain?: boolean;
  bargainHeadline?: string;
}

export interface TradeHistoryRecord {
  windowIndex: number;
  round: number;
  partnerClubName: string;
  sentPlayers: Player[];
  receivedPlayers: Player[];
  acceptanceChance: number;
  isIncomingOffer?: boolean;
  cashOfferM?: number;
}

export interface TransferClubOffer {
  reelIndex: number; // 0, 1, 2
  isLegendSlot: boolean;
  club: Club | null;
  leagueId: LeagueId | 'LEGEND';
  clubRank: number;
  leagueSize: number;
  squad: TransferTargetPlayer[];
  clubNeeds?: ClubPositionNeeds;
}

export interface TransferAttemptResult {
  success: boolean;
  targetPlayer: Player;
  outPlayer: Player;
  probability: number;
  marketValueM: number;
  message: string;
  isTrade?: boolean;
  sentPlayers?: Player[];
  receivedPlayers?: Player[];
  gmReaction?: string;
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
  incomingOffers?: IncomingTradeOffer[];
  attemptedPlayerIds: string[];
  signedPlayerIds: string[];
  lastOfferResult: TransferAttemptResult | null;
  history: TransferHistoryEntry[];
  tradeHistory?: TradeHistoryRecord[];
  completedWindows: number[];
  /** FFP Tier 2 Window-2 transfer embargo note */
  ffpEmbargoActive?: boolean;
}

// =============================================================================
// v9.0 Season Depth Systems (Budget/FFP · AI Tactical Adaptation · Staff Coach · Awakening)
// =============================================================================

export type FfpTier = 0 | 1 | 2;

export interface SeasonBudgetState {
  capM: number;
  initialSpentM: number;
  excessM: number;
  excessPct: number; // 0..100+
  ffpTier: FfpTier;
  transferCashM: number; // Remaining cash (€M) available for transfer negotiations
  chemPenalty: number; // 0 (tier 0), -8 (tier 1), -14 (tier 2)
  window1MaxAttempts?: number; // 3 (tier 0), 2 (tier 1), 1 (tier 2)
  window2MaxAttempts: number; // 3 (tier 0), 1 (tier 1), 0 (tier 2)
  scoreMultiplier: number; // 1.0 (tier 0), 0.94 (tier 1), 0.80 (tier 2)
  extraLossMoraleDrop: number; // 0 (tier 0), 1 (tier 1), 2 (tier 2)
}

export type TacticalExposureTier = 'low' | 'warning' | 'danger';

export interface TacticalHistoryEntry {
  formation: FormationId;
  tactic: TacticId;
  round: number;
  competition: 'league' | 'cup' | 'ucl';
}

export interface TacticalAdaptationAlert {
  id: string;
  tier: 'warning' | 'danger';
  exposureScore: number;
  repeatedFormation: FormationId;
  repeatedTactic: TacticId;
  consecutiveCount: number;
  triggeredAtRound?: number;
  headline?: string;
  detail?: string;
}

export interface TacticalAdaptationState {
  history: TacticalHistoryEntry[]; // up to last 5 matches
  highestAlertedTier: TacticalExposureTier;
  pendingAlert: TacticalAdaptationAlert | null;
}

export type StaffCoachCategory = 'tactic' | 'line' | 'system';

export type StaffCoachId =
  | 'tactic_possession'
  | 'tactic_gegenpressing'
  | 'tactic_counter'
  | 'tactic_wingplay'
  | 'tactic_balanced'
  | 'line_attack'
  | 'line_midfield'
  | 'line_defense'
  | 'sys_tactical_mastery'
  | 'sys_locker_room'
  | 'sys_supersub_phys'
  | 'sys_potential_dev';

export interface StaffCoachState {
  hiredCoachId: StaffCoachId | null;
  offeredCoachIds: StaffCoachId[];
  pendingSelection: boolean;
  completed: boolean;
}

export interface AwakeningAlertItem {
  id: string;
  playerId: string;
  playerName: string;
  position: Position;
  mainPosition: SubPosition;
  nationality: string;
  nationalityCode: string;
  originalOvr: number;
  newOvr: number;
  ovrGain: number;
  round: number;
  competition: 'league' | 'cup' | 'ucl';
  statDeltas: { key: string; label: string; before: number; after: number }[];
  reason?: string;
}

export interface OtherLeagueSeasonState {
  leagueId: LeagueId;
  clubs: Club[];
  fixtures: Fixture[];
  currentRound: number;
  totalRounds: number;
  standings: StandingRow[];
  aiRosters?: Record<string, Player[]>;
  playerStats?: Record<string, PlayerSeasonStats>;
  cup?: DomesticCupState | null;
  cupPlayerStats?: Record<string, PlayerSeasonStats>;
}

export interface SeasonState {
  runId?: string;
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
  departedPlayerIds?: string[];
  // v3.0 / v3.1: 3-tier injuries, morale, press/locker room events & injury auto-return
  playerConditions?: PlayerConditionMap;
  managerEvents?: ManagerEventsState;
  pendingInjuryAlerts?: InjuryAlertItem[];
  injuryAutoReturns?: InjuryAutoReturnEntry[];
  injuryReturnToasts?: InjuryReturnNotification[];
  // v9.0: Budget/FFP, AI Tactical Adaptation, Mid-season Assistant Coach, Permanent Awakening
  budgetState?: SeasonBudgetState;
  pendingFfpOpeningNotice?: boolean;
  tacticalAdaptation?: TacticalAdaptationState;
  staffCoach?: StaffCoachState;
  awakenedPlayers?: Record<string, import('./player').PlayerAwakeningRecord>;
  pendingAwakeningAlerts?: AwakeningAlertItem[];
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
