import type {
  Club,
  LeagueId,
  PlayerSeasonStats,
  SeasonAwards,
  StandingRow,
  TacticId,
} from './league';
import type {
  FormationId,
  ManagerTraitId,
  TeamRatings,
  UserClubProfile,
} from './game';
import type { Player } from './player';

export const PHASE2_STORAGE_KEY = 'football_draft_phase2_handoff_v3';

export interface UclQualifiedLeagueEntry {
  leagueId: LeagueId;
  leagueKoreanName: string;
  teams: Club[];
}

export interface Phase2HandoffState {
  version: 3;
  qualified: true;
  qualifiedAt: string;
  userClub: UserClubProfile;
  managerTraitId: ManagerTraitId | null;
  leagueId: LeagueId;
  finalRank: number; // 1..4
  formation: FormationId;
  defaultTactic: TacticId;
  starters: Player[];
  bench: Player[];
  chemistry: number;
  teamRatings: TeamRatings;
  seasonRecord: StandingRow;
  playerStats: Record<string, PlayerSeasonStats>;
  awards: SeasonAwards | null;
  uclQualifiedByLeague: UclQualifiedLeagueEntry[];
}
