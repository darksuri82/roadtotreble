import type {
  FormationId,
  ManagerTraitId,
  OtherLeagueSeasonState,
  UserClubProfile,
} from '../types/game';
import type {
  Club,
  LeagueId,
  PlayerSeasonStats,
  SeasonAwards,
  StandingRow,
  TacticId,
} from '../types/league';
import { PHASE2_STORAGE_KEY } from '../types/phase2';
import type { Phase2HandoffState } from '../types/phase2';
import type { Player } from '../types/player';
import { calculateChemistry, calculateTeamRatings } from './chemistryEngine';
import { USER_CLUB_ID } from './matchEngine';
import { buildFiveLeagueUclQualifiers } from './otherLeaguesEngine';

export function buildPhase2HandoffState(params: {
  userClub: UserClubProfile;
  managerTraitId: ManagerTraitId | null;
  leagueId: LeagueId;
  formation: FormationId;
  defaultTactic: TacticId;
  starters: Player[];
  bench: Player[];
  standings: StandingRow[];
  clubsInUserLeague: Club[];
  otherLeagues?: Partial<Record<LeagueId, OtherLeagueSeasonState>>;
  playerStats: Record<string, PlayerSeasonStats>;
  awards: SeasonAwards | null;
}): Phase2HandoffState | null {
  const {
    userClub,
    managerTraitId,
    leagueId,
    formation,
    defaultTactic,
    starters,
    bench,
    standings,
    clubsInUserLeague,
    otherLeagues,
    playerStats,
    awards,
  } = params;

  let userRankIdx = standings.findIndex((r) => r.teamId === USER_CLUB_ID);
  if (userRankIdx === -1) {
    userRankIdx = standings.findIndex((r) => r.isUser);
  }
  if (userRankIdx === -1) return null;
  const finalRank = userRankIdx + 1;
  if (finalRank > 4) return null;

  const seasonRecord = standings[userRankIdx];
  const chemResult = calculateChemistry(
    formation,
    starters,
    defaultTactic,
    managerTraitId,
  );
  const teamRatings = calculateTeamRatings(
    formation,
    starters,
    chemResult.total,
    managerTraitId,
  );

  const uclQualifiedByLeague = buildFiveLeagueUclQualifiers({
    userLeagueId: leagueId,
    userLeagueClubs: clubsInUserLeague,
    userLeagueStandings: standings,
    otherLeagues,
  });

  return {
    version: 3,
    qualified: true,
    qualifiedAt: new Date().toISOString(),
    userClub,
    managerTraitId,
    leagueId,
    finalRank,
    formation,
    defaultTactic,
    starters,
    bench,
    chemistry: chemResult.total,
    teamRatings,
    seasonRecord,
    playerStats,
    awards,
    uclQualifiedByLeague,
  };
}

export function savePhase2Handoff(payload: Phase2HandoffState): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(PHASE2_STORAGE_KEY, JSON.stringify(payload));
    }
  } catch {
    // Ignore storage quota errors
  }
}

export function clearPhase2Handoff(): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(PHASE2_STORAGE_KEY);
    }
  } catch {
    // Ignore
  }
}
