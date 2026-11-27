import type {
  AiManagerProfile,
  FormationId,
  ManagerAvatarConfig,
  ManagerTraitId,
  UserClubProfile,
} from './game';
import type {
  Club,
  JerseyPattern,
  LeagueId,
  TacticId,
} from './league';
import type {
  Player,
  PlaystyleId,
  Position,
  SubPosition,
} from './player';

export type StoryScenarioId =
  | '1516_leicester'
  | '1819_tottenham'
  | '0304_arsenal'
  | '0708_manutd'
  | '1314_atletico'
  | '2324_leverkusen'
  | '0910_inter';

export type StoryTransferRule =
  | 'standard_3_plus_ucl'
  | 'standard_3_only'
  | 'winter_plus_ucl'
  | 'winter_1_only';

export type StoryPixelBackdropId =
  | 'king_power_night'
  | 'counter_sprint'
  | 'underdog_crown'
  | 'old_trafford_night'
  | 'three_lungs_engine'
  | 'moscow_rain_final'
  | 'white_hart_lane'
  | 'highbury_unbeaten'
  | 'calderon_fortress'
  | 'bayarena_unbeaten'
  | 'san_siro_treble';

export interface StoryPixelCharacterSpec {
  name: string;
  roleLabel?: string;
  shirtNumber?: number;
  kind: 'manager' | 'player';
  skinTone: 'light' | 'peach' | 'warm' | 'tan' | 'deep';
  hairColor: 'brown' | 'black' | 'silver' | 'blonde';
  hairStyle?: 'short' | 'parted' | 'buzz' | 'bald' | 'long';
  primaryColor: string;
  secondaryColor: string;
  pattern?: JerseyPattern;
  accentGlow?: string;
  /** Normalized x anchor inside 260x112 canvas (e.g. 52..208) */
  x: number;
  /** Subtle highlight marker (e.g. three lungs / heart / crown / ball) */
  emblem?: 'lungs' | 'crown' | 'ball' | 'shield' | 'bolt';
}

export interface StoryIntroSlide {
  id: string;
  chapterLabel: string;
  eraTag: string;
  title: string;
  /** Concise literary 2~3 sentence chronicle */
  narrative: string;
  quote?: string;
  backdrop: StoryPixelBackdropId;
  characters: StoryPixelCharacterSpec[];
}

export interface StoryChecklistDef {
  id: string;
  starIndex: 1 | 2 | 3;
  shortLabel: string;
  detail: string;
}

export type StoryChecklistStatus = 'in_progress' | 'achieved' | 'failed';

export interface StoryChecklistEvalItem {
  id: string;
  starIndex: 1 | 2 | 3;
  shortLabel: string;
  detail: string;
  status: StoryChecklistStatus;
  progressText: string;
}

export interface StoryChecklistSummary {
  scenarioId: StoryScenarioId;
  items: StoryChecklistEvalItem[];
  starsEarned: number; // 0..3
  isAllClear: boolean;
}

export interface StoryManagerTraitOption {
  traitId: ManagerTraitId;
  tag: string;
  pitch: string;
}

export interface StoryScenarioMeta {
  id: StoryScenarioId;
  seasonLabel: string; // e.g. '15-16'
  clubName: string;
  clubShortName: string;
  title: string; // e.g. '5000분의 1의 기적'
  subtitle: string;
  leagueId: LeagueId;
  leagueLabel: string; // e.g. '15-16 EPL'
  cupLabel: string; // e.g. 'FA컵'
  hasUcl: boolean;
  uclLabel?: string; // e.g. '07-08 UCL 16강'
  difficulty: '도전' | '어려움' | '극한';
  accentColor: string;
  clubProfile: UserClubProfile;
  managerName: string;
  managerAvatar: ManagerAvatarConfig;
  defaultFormation: FormationId;
  defaultTactic: TacticId;
  managerTraitOptions: StoryManagerTraitOption[];
  /** Era-calibrated transfer cash budget (€M) */
  cashBudgetM: number;
  cashBudgetNote: string;
  transferRule: StoryTransferRule;
  transferRuleLabel: string;
  /** User-facing historical rationale for transfer rules (especially Arsenal winter-1) */
  transferRuleReason: string;
  /** Max signings/attempts allowed per window (undefined = underdog generous 4 attempts) */
  winterMaxSignings?: number;
  /** Whether a pre-UCL transfer window opens before UCL R16 (defaults to hasUcl; false for 03-04 Arsenal strict mode) */
  allowUclTransferWindow?: boolean;
  checklist: [StoryChecklistDef, StoryChecklistDef, StoryChecklistDef];
  introSlides: StoryIntroSlide[];
  /** True when the dynamic scenario JSON bundle is shipped and playable */
  isPlayable: boolean;
}

/**
 * Compact JSON seed format for era historical players.
 * Hydrated at runtime into full `Player` objects with exact attributes and former clubs.
 */
export interface StoryPlayerSeed {
  id: string;
  name: string;
  pos: Position;
  main: SubPosition[];
  sec?: SubPosition[];
  ovr: number;
  nat: string;
  code: string;
  sta: number;
  styles: PlaystyleId[];
  note?: string;
  /** Optional explicit field attrs [sho, pas, cro, dri, aer, def, phy] */
  f?: [number, number, number, number, number, number, number];
  /** Optional explicit GK attrs [div, han, ref, kic, pos] */
  gk?: [number, number, number, number, number];
}

export interface StoryClubSeed {
  id: string;
  name: string;
  shortName: string;
  leagueId: LeagueId | 'other';
  primaryColor: string;
  secondaryColor: string;
  pattern?: JerseyPattern;
  formation: FormationId;
  defaultTactic: TacticId;
  att: number;
  mid: number;
  def: number;
  manager: AiManagerProfile;
  /** 14~17 players; first 11 are starting XI ordered to match `formation` slots */
  roster: StoryPlayerSeed[];
}

export interface StoryUclR16Seed {
  seasonLabel: string;
  /** Exactly 8 pairings of [teamAId (seeded/Leg2 home), teamBId (unseeded/Leg1 home)] */
  pairings: [string, string][];
  /** Origin labels per clubId (e.g. 'EPL 1위', '포르투갈') */
  originLabels: Record<string, string>;
}

export interface StoryScenarioDataBundle {
  scenarioId: StoryScenarioId;
  domesticLeagueId: LeagueId;
  userClubId: string;
  /** Exact 11 player IDs from userClub roster aligned to defaultFormation */
  userStarterIds: string[];
  /** 5~6 bench player IDs from userClub roster */
  userBenchIds: string[];
  /** 18 or 20 clubs in the domestic league (including userClubId) */
  domesticClubs: StoryClubSeed[];
  /** Top 4 clubs from each of the other 4 major European leagues (16 clubs) for direct scouting */
  foreignTop4Clubs: StoryClubSeed[];
  /** Non-Top-5 UCL R16 clubs not already in domesticClubs or foreignTop4Clubs */
  uclR16ExtraClubs?: StoryClubSeed[];
  /** Actual UCL R16 bracket definition (present when hasUcl === true) */
  uclR16?: StoryUclR16Seed;
  /** Opponent club IDs highlighted as Big Matches (⭐ 빅매치) */
  bigMatchClubIds: string[];
  /** Player IDs tied directly to ★★★ mission criteria (protected with trade warning) */
  missionKeyPlayerIds: string[];
  /** Mission development focus player IDs receiving calibrated awakening resonance when well-utilized */
  awakeningFocusPlayerIds: string[];
  /** Mission evaluator-specific player ID hooks */
  missionTargets: {
    leicesterTrioIds?: string[];
    vardyId?: string;
    deskIds?: string[];
    parkId?: string;
    leverkusenTrioIds?: string[];
    wirtzId?: string;
    interTrioIds?: string[];
    militoId?: string;
  };
}

export interface StoryTransferPoolClub {
  club: Club;
  leagueId: LeagueId;
  roster: Player[];
}

export interface StoryUclR16Prepared {
  seasonLabel: string;
  clubs: Club[];
  aiRosters: Record<string, Player[]>;
  pairings: [string, string][];
  originLabels: Record<string, string>;
}

export interface StoryModeRuntimeState {
  scenarioId: StoryScenarioId;
  seasonLabel: string;
  title: string;
  hasUcl: boolean;
  uclLabel?: string;
  transferRule: StoryTransferRule;
  transferRuleLabel: string;
  transferRuleReason: string;
  winterMaxSignings?: number;
  allowUclTransferWindow?: boolean;
  signingsThisWindow: number;
  initialCashBudgetM: number;
  /** Era clubs (domestic AI + 16 other-4-league Top 4) available for direct scouting */
  transferPoolClubs: StoryTransferPoolClub[];
  /** Prepared 16-team UCL R16 package for immediate transition after domestic league */
  uclR16Prepared?: StoryUclR16Prepared | null;
  bigMatchClubIds: string[];
  missionKeyPlayerIds: string[];
  awakeningFocusPlayerIds: string[];
  missionTargets: StoryScenarioDataBundle['missionTargets'];
  /** Records whether completion was already saved to Story Codex */
  codexRecorded?: boolean;
}

export interface StoryCodexRecord {
  scenarioId: StoryScenarioId;
  bestStars: number; // 0..3
  achievedChecklistIds: string[];
  clearCount: number; // times completed with >= 1 star (or full finish)
  attempts: number;
  bestSummaryText?: string; // e.g. 'EPL 1위 (87점) · FA컵 우승'
  lastPlayedAt: string;
}

export interface StoryCodexStorage {
  version: 1;
  records: Partial<Record<StoryScenarioId, StoryCodexRecord>>;
}
