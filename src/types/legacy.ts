import type {
  FormationId,
  ManagerAvatarConfig,
  ManagerTraitId,
  UserClubProfile,
} from './game';
import type { LeagueId, TacticId } from './league';
import type { Player } from './player';

export type AchievementCategory =
  | 'epl'
  | 'laliga'
  | 'seriea'
  | 'bundesliga'
  | 'ligue1'
  | 'europe'
  | 'dynasty'
  | 'fairytale'
  | 'drama'
  | 'tactics'
  | 'individual'
  | 'defense'
  | 'chemistry'
  | 'transfer';

export interface HiddenAchievementDef {
  id: string;
  index: number; // 1..24
  category: AchievementCategory;
  categoryLabel: string;
  hint: string; // Shown while locked (short historical motif hint)
  title: string; // Revealed on unlock
  motif: string; // Historical motif explanation revealed on unlock
  conditionText: string; // Exact condition revealed on unlock
}

export interface UnlockedAchievementRecord {
  id: string;
  unlockedAt: string;
  clubName: string;
  leagueName: string;
  summaryNote: string;
}

export interface SeasonScoreBreakdown {
  leagueConvertedScore: number; // PPG * 38 * 26 + GD bonus
  leagueRankBonus: number;
  /** Pre-multiplier base league rank bonus (1st=1200, 2nd=750, ...) */
  leagueRankBaseBonus?: number;
  /** Effective league average strength used for championship/rank calibration */
  leagueStrengthAvg?: number;
  /** Multiplier applied to leagueRankBonus based on league strength (e.g. EPL 1.243, Ligue 1 0.815) */
  leagueDifficultyFactor?: number;
  /** Optional era label for historical teams (e.g. '14-15 라리가') */
  leagueStrengthEraLabel?: string;
  cupBonus: number;
  uclBonus: number;
  honorsBonus: number; // Treble / Double / Unbeaten / Historic milestones
  honorsBonusDetails?: string[];
  underdogBonus: number; // Low avg OVR + high achievement
  squadCraftBonus?: number; // Squad OVR + Chemistry + Manager Synergy completion bonus
  squadCraftDetails?: string[];
  awardsBonus?: number; // Ballon d'Or, World Best XI, League MVP, League Best XI
  awardsBonusDetails?: string[];
  /** FFP overspend score reduction (e.g. 6 for Tier 1 -6%, 12 for Tier 2 -12%) */
  ffpTier?: 0 | 1 | 2;
  ffpPenaltyPct?: number;
  ffpPenaltyPoints?: number;
  /** Rule era marker (e.g. 'v9.0') for post-rebalance ranking eligibility */
  ruleEra?: string;
  totalScore: number;
  grade: 'S+' | 'S' | 'A+' | 'A' | 'B+' | 'B' | 'C';
}

export type TeamStoryHighlightKind =
  | 'opening'
  | 'overachieve'
  | 'turning_point'
  | 'title_match'
  | 'comeback'
  | 'ucl_final'
  | 'cup_final'
  | 'awakening'
  | 'best_match'
  | 'streak'
  | 'ace'
  | 'epilogue';

export interface TeamStoryHighlight {
  kind: TeamStoryHighlightKind;
  /** Optional chronological stage marker (e.g. '개막', '14R', '후반기', '컵 결승', 'UCL 결승', '에필로그') */
  period?: string;
  tag: string;
  title: string;
  detail: string;
  metric?: string;
}

export interface TeamSeasonStory {
  /** Narrative 2~3 sentence human-styled team identity description */
  intro: string;
  /** Chronological data-backed seasonal storytelling chapters */
  highlights: TeamStoryHighlight[];
}

export interface HallOfFameSquadMember {
  id: string;
  name: string;
  ovr: number;
  position: string;
  mainPositions: string[];
  isLegend: boolean;
  classicEra?: import('./player').ClassicEra;
  goals: number;
  assists: number;
  avgRating: number;
  awakening?: import('./player').PlayerAwakeningRecord;
}

export interface HallOfFameMatchSummary {
  competition: 'league' | 'cup' | 'ucl';
  label: string;
  opponentName: string;
  isHome: boolean;
  userGoals: number;
  oppGoals: number;
  outcome: 'W' | 'D' | 'L';
  scorers: string[];
  note?: string;
}

export interface HallOfFameEntry {
  id: string;
  runId?: string;
  /** Balance rule era marker ('v9.0'+ entries preserved across v9.0 reset migration) */
  ruleEra?: string;
  completedAt: string;
  /** Selected draft league pool for this season run (all 5 leagues required for Daily Ranking fairness) */
  draftLeaguePool?: LeagueId[];
  /** Explicit flag indicating whether all 5 European major leagues were enabled in the draft pool */
  fullFiveLeaguePool?: boolean;
  userClub: UserClubProfile;
  managerName?: string;
  managerAvatar?: ManagerAvatarConfig;
  managerTraitId: ManagerTraitId | null;
  managerRating?: number;
  staffCoachId?: import('./game').StaffCoachId | null;
  leagueId: LeagueId;
  leagueKoreanName: string;
  formation: FormationId;
  defaultTactic: TacticId;
  finalLeagueRank: number;
  leaguePoints: number;
  leagueTotalRounds: number;
  leagueRecord: string; // e.g. "28승 7무 3패"
  cupName: string;
  cupResultLabel: string; // e.g. "우승", "준우승", "4강"
  cupWon: boolean;
  uclResultLabel: string; // e.g. "우승", "4강", "미진출"
  uclWon: boolean;
  isTreble: boolean;
  isLeagueChampion: boolean;
  teamAvgOvr: number;
  chemistry: number;
  avgSynergyOvrBonus?: number;
  managerSynergyCount?: number;
  seasonScore: SeasonScoreBreakdown;
  trophies: string[];
  topScorerSummary: string;
  ballonDorWinnerName?: string;
  ballonDorWinnerClub?: string;
  ballonDorIsUser?: boolean;
  worldBestXiUserCount?: number;
  leagueBestXiUserCount?: number;
  matchHistory?: HallOfFameMatchSummary[];
  /** Serialized compact team intro & season story timeline */
  teamStory?: TeamSeasonStory;
  starters: HallOfFameSquadMember[];
  bench: HallOfFameSquadMember[];
  /** Full player snapshots (with sub-attributes & playstyles) for Dream Match replay */
  fullStarters?: Player[];
  fullBench?: Player[];
  unlockedAchievementIds: string[];
}

export interface GlobalSquadSnapshotPlayer {
  id: string;
  name: string;
  ovr: number;
  position: string;
  mainPositions: string[];
  isLegend: boolean;
  classicEra?: import('./player').ClassicEra;
  goals?: number;
  assists?: number;
  avgRating?: number;
  /** Optional fallback fields persisted only when player is generated or not in static DB */
  isGenerated?: boolean;
  club?: string;
  leagueId?: LeagueId | 'LEGEND';
  nationality?: string;
  nationalityCode?: string;
  att?: number;
  mid?: number;
  def?: number;
  stamina?: number;
  playstyles?: string[];
  awakening?: import('./player').PlayerAwakeningRecord;
}

export interface GlobalSquadSnapshot {
  ruleEra?: string;
  fullFiveLeaguePool?: boolean;
  staffCoachId?: import('./game').StaffCoachId | null;
  teamStory?: TeamSeasonStory;
  starters: GlobalSquadSnapshotPlayer[];
  bench: GlobalSquadSnapshotPlayer[];
}

export interface GlobalHofRankingEntry {
  id: string;
  runId: string;
  ruleEra?: string;
  /** KST YYYY-MM-DD date bucket */
  rankingDate?: string;
  /** KST Monday YYYY-MM-DD weekly cycle bucket */
  rankingWeekStart?: string;
  rank: number; // 1..10 (today) or 1..3 (past days archive)
  seasonScore: number;
  grade: SeasonScoreBreakdown['grade'];
  clubName: string;
  managerName: string;
  leagueId: LeagueId;
  leagueKoreanName: string;
  finalLeagueRank: number;
  leaguePoints: number;
  leagueTotalRounds: number;
  leagueRecord: string;
  cupName: string;
  cupResultLabel: string;
  cupWon: boolean;
  uclResultLabel: string;
  uclWon: boolean;
  isLeagueChampion: boolean;
  isTreble: boolean;
  trophies: string[];
  formation: FormationId;
  defaultTactic: TacticId;
  managerTraitId: ManagerTraitId | null;
  managerRating: number;
  staffCoachId?: import('./game').StaffCoachId | null;
  teamAvgOvr: number;
  chemistry: number;
  avgSynergyOvrBonus: number;
  managerSynergyCount: number;
  topScorerSummary: string;
  clubProfile: UserClubProfile;
  managerAvatar: ManagerAvatarConfig;
  scoreBreakdown: SeasonScoreBreakdown;
  squadSnapshot: GlobalSquadSnapshot;
  teamStory?: TeamSeasonStory;
  achievedAt: string;
}

export interface GlobalRankingSubmitResult {
  ok: boolean;
  entered: boolean;
  rank: number | null;
  alreadyExists: boolean;
  cutoffScore: number | null;
  totalCount: number;
  prunedCount: number;
  rankingDate?: string;
  error?: string;
}

export interface GlobalTop15CelebrationPayload {
  runId: string;
  rank: number;
  totalScore: number;
  grade: SeasonScoreBreakdown['grade'];
  clubName: string;
  managerName: string;
  trophies: string[];
  isTreble: boolean;
  uclWon: boolean;
  isLeagueChampion: boolean;
  cupWon: boolean;
  prunedCount: number;
}

export interface DreamMatchRecord {
  historicalTeamId: string;
  wins: number;
  losses: number;
  draws: number;
  bestResultLabel?: string;
  lastPlayedAt: string;
}

export interface LegacyHofSummaryCache {
  count: number;
  bestScore: number;
  trebleCount: number;
  uclWins: number;
}

export interface LegacyStorageState {
  version: 1;
  /** Tracks one-time HOF era migration completion (e.g. 'v9.0') */
  hofMigrationEra?: string;
  hofSummaryCache?: LegacyHofSummaryCache;
  hallOfFame: HallOfFameEntry[];
  unlockedAchievements: Record<string, UnlockedAchievementRecord>;
  dreamMatchRecords?: Record<string, DreamMatchRecord>;
}

export interface SeasonAchievementTrackers {
  comebackFrom2DownCount: number; // HT 2+ goals behind -> win (league/cup/ucl)
  halftimeTacticComebackWins: number; // HT behind + tactic/formation adjusted -> win
  signedUnder20PctSuccess: boolean; // Signed player with successChance <= 20%
}

export function createInitialTrackers(): SeasonAchievementTrackers {
  return {
    comebackFrom2DownCount: 0,
    halftimeTacticComebackWins: 0,
    signedUnder20PctSuccess: false,
  };
}

export function buildHallOfFameMember(
  player: Player,
  goals: number,
  assists: number,
  avgRating: number,
): HallOfFameSquadMember {
  return {
    id: player.id,
    name: player.name,
    ovr: player.ovr,
    position: player.position,
    mainPositions: [...player.mainPositions],
    isLegend: player.isLegend,
    ...(player.classicEra ? { classicEra: player.classicEra } : {}),
    goals,
    assists,
    avgRating,
    ...(player.awakening ? { awakening: player.awakening } : {}),
  };
}

export type LeaderboardEntrySource = 'user' | 'historical' | 'global';

export interface HistoricalBestXiPlayer {
  position: string;
  name: string;
  ovr?: number;
  note?: string;
}

export interface HistoricalTeamEntry {
  id: string;
  seasonLabel: string; // e.g. "19-20"
  displayName: string; // e.g. "19-20 바이에른 뮌헨"
  nickname: string; // e.g. "UCL 전승 트레블"
  managerName: string;
  managerTraitId: ManagerTraitId;
  managerRating: number; // 91..99 real-world managerial stature
  managerStyleNote: string;
  managerAvatar: ManagerAvatarConfig;
  userClub: UserClubProfile;
  leagueId: LeagueId;
  leagueKoreanName: string;
  formation: FormationId;
  defaultTactic: TacticId;
  finalLeagueRank: number;
  leaguePoints: number;
  leagueTotalRounds: number;
  leagueRecord: string;
  leagueGoalDifference: number;
  goalsFor: number;
  goalsAgainst: number;
  cupName: string;
  cupResultLabel: string;
  cupWon: boolean;
  uclResultLabel: string;
  uclWon: boolean;
  uclPerfectWin?: boolean;
  uclUnbeatenWin?: boolean;
  isTreble: boolean;
  isLeagueChampion: boolean;
  teamAvgOvr: number;
  chemistry: number;
  avgSynergyOvrBonus: number;
  managerSynergyCount: number;
  seasonScore: SeasonScoreBreakdown;
  trophies: string[];
  summaryNote: string;
  ballonDorWinnerName?: string;
  worldBestXiCount: number;
  leagueMvpName?: string;
  leagueBestXiCount: number;
  bestXi: HistoricalBestXiPlayer[];
  /** Full playable prime squad (11 starters aligned to formation + 5~7 key bench = 16~18 players) */
  starters: Player[];
  bench: Player[];
}

export interface UnifiedLeaderboardEntry {
  id: string;
  source: LeaderboardEntrySource;
  displayName: string;
  subtitle: string;
  completedAt: string;
  totalScore: number;
  grade: SeasonScoreBreakdown['grade'];
  userEntry?: HallOfFameEntry;
  historicalEntry?: HistoricalTeamEntry;
}

