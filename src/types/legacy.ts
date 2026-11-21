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
  leagueConvertedScore: number; // PPG * 38 * 25 + GD bonus
  leagueRankBonus: number;
  cupBonus: number;
  uclBonus: number;
  honorsBonus: number; // Treble / Double / Unbeaten
  underdogBonus: number; // Low avg OVR + high achievement
  awardsBonus?: number; // Ballon d'Or, World Best XI, League MVP, League Best XI
  awardsBonusDetails?: string[];
  totalScore: number;
  grade: 'S+' | 'S' | 'A+' | 'A' | 'B+' | 'B' | 'C';
}

export interface HallOfFameSquadMember {
  id: string;
  name: string;
  ovr: number;
  position: string;
  mainPositions: string[];
  isLegend: boolean;
  goals: number;
  assists: number;
  avgRating: number;
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
  completedAt: string;
  userClub: UserClubProfile;
  managerName?: string;
  managerAvatar?: ManagerAvatarConfig;
  managerTraitId: ManagerTraitId | null;
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
  seasonScore: SeasonScoreBreakdown;
  trophies: string[];
  topScorerSummary: string;
  ballonDorWinnerName?: string;
  ballonDorWinnerClub?: string;
  ballonDorIsUser?: boolean;
  worldBestXiUserCount?: number;
  leagueBestXiUserCount?: number;
  matchHistory?: HallOfFameMatchSummary[];
  starters: HallOfFameSquadMember[];
  bench: HallOfFameSquadMember[];
  unlockedAchievementIds: string[];
}

export interface LegacyStorageState {
  version: 1;
  hallOfFame: HallOfFameEntry[];
  unlockedAchievements: Record<string, UnlockedAchievementRecord>;
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
    goals,
    assists,
    avgRating,
  };
}

export type LeaderboardEntrySource = 'user' | 'historical' | 'global';

export interface HistoricalBestXiPlayer {
  position: string;
  name: string;
  note?: string;
}

export interface HistoricalTeamEntry {
  id: string;
  seasonLabel: string; // e.g. "19-20"
  displayName: string; // e.g. "19-20 바이에른 뮌헨"
  nickname: string; // e.g. "UCL 전승 트레블"
  managerName: string;
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
  cupName: string;
  cupResultLabel: string;
  cupWon: boolean;
  uclResultLabel: string;
  uclWon: boolean;
  isTreble: boolean;
  isLeagueChampion: boolean;
  teamAvgOvr: number;
  seasonScore: SeasonScoreBreakdown;
  trophies: string[];
  summaryNote: string;
  ballonDorWinnerName?: string;
  worldBestXiCount: number;
  leagueMvpName?: string;
  leagueBestXiCount: number;
  bestXi: HistoricalBestXiPlayer[];
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

