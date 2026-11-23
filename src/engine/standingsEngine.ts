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

export function findUserRankOrNull(
  standings: StandingRow[],
  userClubId = USER_CLUB_ID,
): number | null {
  if (standings.length === 0) return null;
  let idx = standings.findIndex((row) => row.teamId === userClubId);
  if (idx === -1 && userClubId === USER_CLUB_ID) {
    idx = standings.findIndex((row) => row.isUser);
  }
  return idx === -1 ? null : idx + 1;
}

export function getUserRank(
  standings: StandingRow[],
  userClubId = USER_CLUB_ID,
): number {
  if (standings.length === 0) return 1;
  const rank = findUserRankOrNull(standings, userClubId);
  return rank ?? standings.length;
}

export function getPlayerStatById(
  statsMap: Record<string, PlayerSeasonStats> | null | undefined,
  playerId: string,
): PlayerSeasonStats | undefined {
  if (!statsMap) return undefined;
  return statsMap[playerId] ?? statsMap[`user::${playerId}`];
}

/**
 * Normalizes legacy v2.4 saves where user squad stats were stored under `user::${playerId}`
 * into single-key `${playerId}` entries, merging any split pre/post-transfer stats cleanly.
 */
export function normalizeLegacyPlayerStatsMap(
  rawMap: Record<string, PlayerSeasonStats> | null | undefined,
): Record<string, PlayerSeasonStats> {
  if (!rawMap) return {};
  const normalized: Record<string, PlayerSeasonStats> = {};

  for (const st of Object.values(rawMap)) {
    const id = st.playerId;
    const existing = normalized[id];
    if (!existing) {
      normalized[id] = {
        ...st,
        minutesPlayed:
          st.minutesPlayed ?? st.starts * 84 + st.subAppearances * 22,
        mainPositions: [...st.mainPositions],
        positionCounts: { ...st.positionCounts },
        transferHistory: st.transferHistory ? [...st.transferHistory] : undefined,
      };
    } else {
      const appearances = existing.appearances + st.appearances;
      const ratingSum = Math.round((existing.ratingSum + st.ratingSum) * 100) / 100;
      const preferNewClub = st.isUserTeam && !existing.isUserTeam;
      const mergedPos: PlayerSeasonStats['positionCounts'] = {
        ...existing.positionCounts,
      };
      for (const [pos, cnt] of Object.entries(st.positionCounts)) {
        const k = pos as keyof PlayerSeasonStats['positionCounts'];
        mergedPos[k] = (mergedPos[k] ?? 0) + (cnt ?? 0);
      }
      const mergedHistory = [
        ...(existing.transferHistory ?? []),
        ...(st.transferHistory ?? []),
      ];
      normalized[id] = {
        ...(preferNewClub ? st : existing),
        appearances,
        starts: existing.starts + st.starts,
        subAppearances: existing.subAppearances + st.subAppearances,
        minutesPlayed:
          (existing.minutesPlayed ?? 0) + (st.minutesPlayed ?? 0),
        goals: existing.goals + st.goals,
        assists: existing.assists + st.assists,
        xgSum: Math.round((existing.xgSum + st.xgSum) * 100) / 100,
        cleanSheets: existing.cleanSheets + st.cleanSheets,
        momCount: existing.momCount + st.momCount,
        ratingSum,
        avgRating:
          appearances > 0
            ? Math.round((ratingSum / appearances) * 100) / 100
            : 0,
        positionCounts: mergedPos,
        transferHistory: mergedHistory.length > 0 ? mergedHistory : undefined,
      };
    }
  }

  return normalized;
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
    // Worldwide unique playerId key: never overwrite user's owned player entry with an AI entry
    if (map[p.id] && map[p.id].isUserTeam && !isUserTeam) return;
    map[p.id] = {
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
 * under single worldwide `playerId` keys so mid-season transfers seamlessly accumulate stats
 * while updating team metadata to the player's latest club.
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

  const nextStats = normalizeLegacyPlayerStatsMap(currentStats);

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
    const momTeamId = res.playerRatings.find(
      (r) => r.playerId === res.momPlayerId,
    )?.teamId;

    // Accumulate full-league individual stats under single worldwide playerId key (at most 1 appearance per player per match)
    const seenInMatch = new Set<string>();
    for (const pr of res.playerRatings) {
      if (!pr.playerId || seenInMatch.has(pr.playerId)) continue;
      seenInMatch.add(pr.playerId);
      const club = clubsById[pr.teamId];
      const isUser = pr.teamId === userClubId;
      const statKey = pr.playerId;

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
      // Keep latest club attribution if player transferred mid-season
      if (club && entry.teamId !== pr.teamId) {
        entry.teamId = pr.teamId;
        entry.teamName = club.name;
        entry.teamShortName = club.shortName;
        entry.teamPrimaryColor = club.primaryColor;
        entry.teamSecondaryColor = club.secondaryColor;
        entry.isUserTeam = isUser;
      }

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
  const nextStats = normalizeLegacyPlayerStatsMap(currentStats);

  for (const res of results) {
    const homeCleanSheet = res.awayGoals === 0;
    const awayCleanSheet = res.homeGoals === 0;
    const momTeamId = res.playerRatings.find(
      (r) => r.playerId === res.momPlayerId,
    )?.teamId;

    const seenInMatch = new Set<string>();
    for (const pr of res.playerRatings) {
      if (!pr.playerId || seenInMatch.has(pr.playerId)) continue;
      seenInMatch.add(pr.playerId);
      const club = clubsById[pr.teamId];
      const isUser = pr.teamId === userClubId;
      const statKey = pr.playerId;

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
      if (club && entry.teamId !== pr.teamId) {
        entry.teamId = pr.teamId;
        entry.teamName = club.name;
        entry.teamShortName = club.shortName;
        entry.teamPrimaryColor = club.primaryColor;
        entry.teamSecondaryColor = club.secondaryColor;
        entry.isUserTeam = isUser;
      }

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
