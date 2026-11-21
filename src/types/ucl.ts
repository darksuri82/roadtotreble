import type { Club, Fixture, LeagueId, MatchResult, StandingRow } from './league';
import type { Player } from './player';

export type UclPhaseStage =
  | 'special_transfer'
  | 'league_phase'
  | 'playoff'
  | 'r16'
  | 'qf'
  | 'sf'
  | 'final'
  | 'completed';

export type UclKnockoutStage = 'playoff' | 'r16' | 'qf' | 'sf' | 'final';

export interface UclTeamEntry {
  club: Club;
  pot: 1 | 2 | 3 | 4;
  originLabel: string; // e.g. "EPL 1위", "포르투갈"
  originLeagueId: LeagueId | 'other';
  isLeagueChampion: boolean;
}

export interface UclKnockoutTie {
  id: string;
  stage: UclKnockoutStage;
  tieIndex: number;
  teamAId: string; // Higher seed (plays Leg 2 at home)
  teamBId: string; // Lower seed (plays Leg 1 at home)
  leg1?: MatchResult; // teamB home vs teamA away (or neutral for Final)
  leg2?: MatchResult; // teamA home vs teamB away (undefined for Final)
  aggTeamA: number;
  aggTeamB: number;
  winnerId: string | null;
  decidedBy?: 'regular' | 'et' | 'penalties';
  penaltyScoreA?: number;
  penaltyScoreB?: number;
}

export interface UclTournamentState {
  stage: UclPhaseStage;
  teams: UclTeamEntry[]; // 36 teams
  clubs: Club[]; // 36 clubs
  aiRosters: Record<string, Player[]>;
  leaguePhaseFixtures: Fixture[]; // 8 rounds * 18 matches = 144 matches
  leaguePhaseRound: number; // 0..8
  standings: StandingRow[]; // 36-team single table
  userLeaguePhaseRank: number | null; // 1..36 locked after 8R
  enteredViaPlayoff: boolean; // true if 9..24th (for hidden achievement #13)
  knockoutLeg: 1 | 2; // current leg for active 2-legged knockout stage
  ties: Record<UclKnockoutStage, UclKnockoutTie[]>;
  userEliminatedAt: UclPhaseStage | null;
  championTeamId: string | null;
  lastUserMatch: MatchResult | null;
  completed: boolean;
}
