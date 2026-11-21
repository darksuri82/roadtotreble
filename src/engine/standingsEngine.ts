import type {
  Club,
  MatchResult,
  PlayerSeasonStats,
  StandingRow,
} from '../types/league';
import type { Player } from '../types/player';
import { USER_CLUB_ID } from './matchEngine';

export function createInitialStandings(clubs: Club[]): StandingRow[] {
  return clubs
    .map((club) => ({
      teamId: club.id,
      teamName: club.name,
      shortName: club.shortName,
      primaryColor: club.primaryColor,
      secondaryColor: club.secondaryColor,
      isUser: Boolean(club.isUser),
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
      form: [] as ('W' | 'D' | 'L')[],
    }))
    .sort((a, b) => a.teamName.localeCompare(b.teamName, 'ko'));
}

export function sortStandings(rows: StandingRow[]): StandingRow[] {
  return [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) {
      return b.goalDifference - a.goalDifference;
    }
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.teamName.localeCompare(b.teamName, 'ko');
  });
}

export function getUserRank(
  standings: StandingRow[],
  userClubId = USER_CLUB_ID,
): number {
  const idx = standings.findIndex((row) => row.teamId === userClubId);
  return idx === -1 ? standings.length : idx + 1;
}

export function createInitialPlayerStatsMap(params: {
  clubs: Club[];
  userClub: Club;
  userSquad: Player[];
  aiRosters: Record<string, Player[]>;
}): Record<string, PlayerSeasonStats> {
  const { clubs, userClub, userSquad, aiRosters } = params;
  const map: Record<string, PlayerSeasonStats> = {};

  const register = (p: Player, club: Club, isUserTeam: boolean) => {
    // Disambiguate key when user drafted a player who is also in an AI club roster
    const statKey = isUserTeam ? `user::${p.id}` : p.id;
    map[statKey] = {
      playerId: p.id,
      playerName: p.name,
      teamId: club.id,
      teamName: club.name,
      teamShortName: club.shortName,
      teamPrimaryColor: club.primaryColor,
      teamSecondaryColor: club.secondaryColor,
      isUserTeam,
      position: p.position,
      mainPositions: [...p.mainPositions],
      ovr: p.ovr,
      appearances: 0,
      starts: 0,
      subAppearances: 0,
      minutesPlayed: 0,
      goals: 0,
      assists: 0,
      xgSum: 0,
      cleanSheets: 0,
      momCount: 0,
      ratingSum: 0,
      avgRating: 0,
      positionCounts: {},
      isLegend: p.isLegend,
    };
  };

  for (const p of userSquad) {
    register(p, userClub, true);
  }

  for (const club of clubs) {
    if (club.id === USER_CLUB_ID) continue;
    const roster = aiRosters[club.id] ?? [];
    for (const p of roster) {
      register(p, club, false);
    }
  }

  return map;
}

export interface RoundUpdateResult {
  standings: StandingRow[];
  allPlayerStats: Record<string, PlayerSeasonStats>;
}

/**
 * Applies all match results of a round to league standings and FULL-LEAGUE individual player stats
 * (starts, sub appearances, minutes played, goals, assists, cumulative xG, clean sheets, MOM count,
 * average rating, and deployed position frequency).
 * Keeps user squad stats cleanly separated from same-player AI club stats via `user::` prefix.
 */
export function applyRoundResults(
  currentStandings: StandingRow[],
  roundResults: MatchResult[],
  clubsById: Record<string, Club>,
  currentStats: Record<string, PlayerSeasonStats>,
  userClubId = USER_CLUB_ID,
): RoundUpdateResult {
  const rowMap: Record<string, StandingRow> = {};
  for (const row of currentStandings) {
    rowMap[row.teamId] = { ...row, form: [...row.form] };
  }

  const nextStats: Record<string, PlayerSeasonStats> = {};
  for (const [key, st] of Object.entries(currentStats)) {
    nextStats[key] = {
      ...st,
      minutesPlayed: st.minutesPlayed ?? st.starts * 84 + st.subAppearances * 22,
      mainPositions: [...st.mainPositions],
      positionCounts: { ...st.positionCounts },
    };
  }

  for (const res of roundResults) {
    const home = rowMap[res.homeTeamId];
    const away = rowMap[res.awayTeamId];
    if (!home || !away) continue;

    home.played += 1;
    away.played += 1;
    home.goalsFor += res.homeGoals;
    home.goalsAgainst += res.awayGoals;
    away.goalsFor += res.awayGoals;
    away.goalsAgainst += res.homeGoals;
    home.goalDifference = home.goalsFor - home.goalsAgainst;
    away.goalDifference = away.goalsFor - away.goalsAgainst;

    if (res.homeGoals > res.awayGoals) {
      home.won += 1;
      home.points += 3;
      home.form = [...home.form.slice(-4), 'W'];
      away.lost += 1;
      away.form = [...away.form.slice(-4), 'L'];
    } else if (res.homeGoals < res.awayGoals) {
      away.won += 1;
      away.points += 3;
      away.form = [...away.form.slice(-4), 'W'];
      home.lost += 1;
      home.form = [...home.form.slice(-4), 'L'];
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += 1;
      away.points += 1;
      home.form = [...home.form.slice(-4), 'D'];
      away.form = [...away.form.slice(-4), 'D'];
    }

    const homeCleanSheet = res.awayGoals === 0;
    const awayCleanSheet = res.homeGoals === 0;

    // Accumulate full-league individual stats from match ratings
    for (const pr of res.playerRatings) {
      const club = clubsById[pr.teamId];
      const isUser = pr.teamId === userClubId;
      const statKey = isUser ? `user::${pr.playerId}` : pr.playerId;

      if (!nextStats[statKey]) {
        nextStats[statKey] = {
          playerId: pr.playerId,
          playerName: pr.playerName,
          teamId: pr.teamId,
          teamName: club?.name ?? '',
          teamShortName: club?.shortName ?? 'CLB',
          teamPrimaryColor: club?.primaryColor ?? '#10b981',
          teamSecondaryColor: club?.secondaryColor ?? '#ffffff',
          isUserTeam: isUser,
          position: pr.position,
          mainPositions: [pr.subPosition],
          ovr: 75,
          appearances: 0,
          starts: 0,
          subAppearances: 0,
          minutesPlayed: 0,
          goals: 0,
          assists: 0,
          xgSum: 0,
          cleanSheets: 0,
          momCount: 0,
          ratingSum: 0,
          avgRating: 0,
          positionCounts: {},
          isLegend: Boolean(pr.isLegend),
        };
      }

      const entry = nextStats[statKey];
      entry.appearances += 1;
      if (pr.isSub) {
        entry.subAppearances += 1;
      } else {
        entry.starts += 1;
      }
      entry.minutesPlayed =
        (entry.minutesPlayed ?? 0) +
        (typeof pr.minutesPlayed === 'number'
          ? pr.minutesPlayed
          : pr.isSub
            ? 24
            : 90);
      entry.goals += pr.goals;
      entry.assists += pr.assists;
      entry.xgSum = Math.round((entry.xgSum + (pr.xg ?? 0)) * 100) / 100;
      entry.ratingSum = Math.round((entry.ratingSum + pr.rating) * 100) / 100;
      entry.avgRating =
        Math.round((entry.ratingSum / entry.appearances) * 100) / 100;
      entry.positionCounts[pr.subPosition] =
        (entry.positionCounts[pr.subPosition] ?? 0) + 1;

      if (pr.playerId === res.momPlayerId && pr.teamId === (res.playerRatings.find((r) => r.playerId === res.momPlayerId)?.teamId ?? pr.teamId)) {
        entry.momCount += 1;
      }

      const teamKeptCleanSheet =
        pr.teamId === res.homeTeamId ? homeCleanSheet : awayCleanSheet;
      if (
        teamKeptCleanSheet &&
        (pr.position === 'GK' || pr.position === 'DF')
      ) {
        entry.cleanSheets += 1;
      }
    }
  }

  return {
    standings: sortStandings(Object.values(rowMap)),
    allPlayerStats: nextStats,
  };
}

/**
 * Accumulates individual player stats for knockout / cup / UCL matches without modifying league standings.
 */
export function accumulateCompetitionPlayerStats(
  currentStats: Record<string, PlayerSeasonStats>,
  results: MatchResult[],
  clubsById: Record<string, Club>,
  userClubId = USER_CLUB_ID,
): Record<string, PlayerSeasonStats> {
  const nextStats: Record<string, PlayerSeasonStats> = {};
  for (const [key, st] of Object.entries(currentStats)) {
    nextStats[key] = {
      ...st,
      minutesPlayed: st.minutesPlayed ?? st.starts * 84 + st.subAppearances * 22,
      mainPositions: [...st.mainPositions],
      positionCounts: { ...st.positionCounts },
    };
  }

  for (const res of results) {
    const homeCleanSheet = res.awayGoals === 0;
    const awayCleanSheet = res.homeGoals === 0;
    const momTeamId = res.playerRatings.find(
      (r) => r.playerId === res.momPlayerId,
    )?.teamId;

    for (const pr of res.playerRatings) {
      const club = clubsById[pr.teamId];
      const isUser = pr.teamId === userClubId;
      const statKey = isUser ? `user::${pr.playerId}` : pr.playerId;

      if (!nextStats[statKey]) {
        nextStats[statKey] = {
          playerId: pr.playerId,
          playerName: pr.playerName,
          teamId: pr.teamId,
          teamName: club?.name ?? '',
          teamShortName: club?.shortName ?? 'CLB',
          teamPrimaryColor: club?.primaryColor ?? '#10b981',
          teamSecondaryColor: club?.secondaryColor ?? '#ffffff',
          isUserTeam: isUser,
          position: pr.position,
          mainPositions: [pr.subPosition],
          ovr: 75,
          appearances: 0,
          starts: 0,
          subAppearances: 0,
          minutesPlayed: 0,
          goals: 0,
          assists: 0,
          xgSum: 0,
          cleanSheets: 0,
          momCount: 0,
          ratingSum: 0,
          avgRating: 0,
          positionCounts: {},
          isLegend: Boolean(pr.isLegend),
        };
      }

      const entry = nextStats[statKey];
      entry.appearances += 1;
      if (pr.isSub) {
        entry.subAppearances += 1;
      } else {
        entry.starts += 1;
      }
      entry.minutesPlayed =
        (entry.minutesPlayed ?? 0) +
        (typeof pr.minutesPlayed === 'number'
          ? pr.minutesPlayed
          : pr.isSub
            ? 24
            : 90);
      entry.goals += pr.goals;
      entry.assists += pr.assists;
      entry.xgSum = Math.round((entry.xgSum + (pr.xg ?? 0)) * 100) / 100;
      entry.ratingSum = Math.round((entry.ratingSum + pr.rating) * 100) / 100;
      entry.avgRating =
        Math.round((entry.ratingSum / entry.appearances) * 100) / 100;
      entry.positionCounts[pr.subPosition] =
        (entry.positionCounts[pr.subPosition] ?? 0) + 1;

      if (pr.playerId === res.momPlayerId && pr.teamId === (momTeamId ?? pr.teamId)) {
        entry.momCount += 1;
      }

      const teamKeptCleanSheet =
        pr.teamId === res.homeTeamId ? homeCleanSheet : awayCleanSheet;
      if (
        teamKeptCleanSheet &&
        (pr.position === 'GK' || pr.position === 'DF')
      ) {
        entry.cleanSheets += 1;
      }
    }
  }

  return nextStats;
}
