import { USER_CLUB_ID } from '../../../engine/matchEngine';
import type { Club, MatchResult } from '../../../types/league';
import type { MpUclLive } from '../../../types/mpLeague';
import type {
  UclKnockoutStage,
  UclKnockoutTie,
  UclPhaseStage,
  UclTeamEntry,
  UclTournamentState,
} from '../../../types/ucl';

const KO_STAGES: UclKnockoutStage[] = ['playoff', 'r16', 'qf', 'sf', 'final'];

/**
 * The single-player UCL popups look for the fixed single-user club id. This returns a view of the
 * shared tournament where ONE friend's club is presented under that id, so those popups can be
 * reused unchanged for every friend.
 */
export function buildUclViewForViewer(
  ucl: MpUclLive,
  viewerClubId: string | null,
): {
  ucl: UclTournamentState;
  clubsById: Record<string, Club>;
  teamEntryById: Record<string, UclTeamEntry>;
} {
  const map = (id: string): string => (viewerClubId && id === viewerClubId ? USER_CLUB_ID : id);
  const mapOpt = (id: string | null): string | null => (id === null ? null : map(id));
  const mapResult = (r: MatchResult | undefined): MatchResult | undefined =>
    r
      ? {
          ...r,
          homeTeamId: map(r.homeTeamId),
          awayTeamId: map(r.awayTeamId),
          extraTime: r.extraTime
            ? {
                ...r.extraTime,
                winnerTeamId: map(r.extraTime.winnerTeamId),
                penalties: r.extraTime.penalties
                  ? {
                      ...r.extraTime.penalties,
                      winnerTeamId: map(r.extraTime.penalties.winnerTeamId),
                    }
                  : undefined,
              }
            : undefined,
        }
      : undefined;
  const mapTies = (ties: UclKnockoutTie[]): UclKnockoutTie[] =>
    ties.map((t) => ({
      ...t,
      teamAId: map(t.teamAId),
      teamBId: map(t.teamBId),
      winnerId: mapOpt(t.winnerId),
      leg1: mapResult(t.leg1),
      leg2: mapResult(t.leg2),
    }));

  const clubs = ucl.clubs.map((c) => ({
    ...c,
    id: map(c.id),
    isUser: c.id === viewerClubId,
  }));
  const standings = ucl.standings.map((r) => ({
    ...r,
    teamId: map(r.teamId),
    isUser: r.teamId === viewerClubId,
  }));
  const ties: Record<UclKnockoutStage, UclKnockoutTie[]> = {
    playoff: mapTies(ucl.ties.playoff),
    r16: mapTies(ucl.ties.r16),
    qf: mapTies(ucl.ties.qf),
    sf: mapTies(ucl.ties.sf),
    final: mapTies(ucl.ties.final),
  };

  const participates = Boolean(viewerClubId && ucl.humanClubIds.includes(viewerClubId));
  const rankIdx = standings.findIndex((r) => r.teamId === USER_CLUB_ID);
  const lpDone = ucl.leaguePhaseRound >= 8;
  const rank = participates && lpDone && rankIdx !== -1 ? rankIdx + 1 : null;
  let eliminatedAt: UclPhaseStage | null = null;
  if (rank !== null && rank >= 25) eliminatedAt = 'league_phase';
  else if (participates) {
    for (const stage of KO_STAGES) {
      const tie = ties[stage].find(
        (t) => t.teamAId === USER_CLUB_ID || t.teamBId === USER_CLUB_ID,
      );
      if (tie && tie.winnerId && tie.winnerId !== USER_CLUB_ID) {
        eliminatedAt = stage;
        break;
      }
    }
  }

  const clubsById: Record<string, Club> = Object.fromEntries(clubs.map((c) => [c.id, c]));
  const teamEntryById: Record<string, UclTeamEntry> = Object.fromEntries(
    clubs.map((c) => [
      c.id,
      {
        club: c,
        pot: 1 as const,
        originLabel: '',
        originLeagueId: 'other' as const,
        isLeagueChampion: false,
      },
    ]),
  );

  return {
    clubsById,
    teamEntryById,
    ucl: {
      stage: ucl.stage,
      teams: Object.values(teamEntryById),
      clubs,
      aiRosters: {},
      leaguePhaseFixtures: [],
      leaguePhaseRound: ucl.leaguePhaseRound,
      standings,
      userLeaguePhaseRank: rank,
      enteredViaPlayoff: Boolean(rank !== null && rank >= 9 && rank <= 24),
      knockoutLeg: ucl.knockoutLeg,
      ties,
      userEliminatedAt: eliminatedAt,
      championTeamId: mapOpt(ucl.championTeamId),
      lastUserMatch: null,
      completed: ucl.stage === 'completed',
      userParticipated: participates,
    },
  };
}

export type MpUclMilestone = 'r16' | 'qf' | 'sf' | 'final' | 'champion';

/** Highest knockout milestone this friend's club has reached so far (null if none yet). */
export function reachedUclMilestone(
  ucl: MpUclLive,
  clubId: string | null,
): MpUclMilestone | null {
  if (!clubId || !ucl.humanClubIds.includes(clubId)) return null;
  if (ucl.championTeamId === clubId) return 'champion';
  const inStage = (stage: UclKnockoutStage) =>
    ucl.ties[stage].some((t) => t.teamAId === clubId || t.teamBId === clubId);
  if (inStage('final')) return 'final';
  if (inStage('sf')) return 'sf';
  if (inStage('qf')) return 'qf';
  if (inStage('r16')) return 'r16';
  return null;
}
