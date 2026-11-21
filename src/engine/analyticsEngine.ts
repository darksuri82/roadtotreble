import type {
  Club,
  MatchResult,
  PlayerSeasonStats,
  SquadPlayerAnalyticsRow,
  StandingRow,
  TeamSeasonAnalytics,
} from '../types/league';
import type { Player, SubPosition } from '../types/player';
import { USER_CLUB_ID } from './matchEngine';
import { getPrimaryPosition } from './positionEngine';
import { getPlayerStaminaStat } from './staminaEngine';
import { getUserRank } from './standingsEngine';

/**
 * Computes comprehensive end-of-season team metrics for the user's club:
 * rank, points, W/D/L, home/away splits, xG vs GF (finishing), xGA vs GA,
 * average possession/shots/SOT, clean sheets, max win/unbeaten streaks, and biggest margin win.
 */
export function computeTeamSeasonAnalytics(params: {
  standings: StandingRow[];
  userMatchHistory: MatchResult[];
  clubs: Club[];
  userClubId?: string;
}): TeamSeasonAnalytics {
  const {
    standings,
    userMatchHistory,
    clubs,
    userClubId = USER_CLUB_ID,
  } = params;

  const clubMap = new Map<string, Club>(clubs.map((c) => [c.id, c]));
  const userRow = standings.find((r) => r.teamId === userClubId);
  const finalRank = getUserRank(standings, userClubId);

  const homeRecord = { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0 };
  const awayRecord = { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0 };

  let totalXg = 0;
  let totalXga = 0;
  let totalPossession = 0;
  let totalShots = 0;
  let totalSot = 0;
  let cleanSheets = 0;

  let currentWinStreak = 0;
  let maxWinStreak = 0;
  let currentUnbeatenStreak = 0;
  let maxUnbeatenStreak = 0;

  let biggestWin: TeamSeasonAnalytics['biggestWin'] = null;
  let biggestMargin = 0;

  const ordered = [...userMatchHistory].sort((a, b) => a.round - b.round);

  for (const m of ordered) {
    const isHome = m.homeTeamId === userClubId;
    const ug = isHome ? m.homeGoals : m.awayGoals;
    const og = isHome ? m.awayGoals : m.homeGoals;
    const uXg = isHome ? m.homeXg : m.awayXg;
    const oXg = isHome ? m.awayXg : m.homeXg;
    const uPoss = isHome ? m.homePossession : 100 - m.homePossession;
    const uShots = isHome ? m.homeShots : m.awayShots;
    const uSot = isHome ? m.homeShotsOnTarget : m.awayShotsOnTarget;

    totalXg += uXg;
    totalXga += oXg;
    totalPossession += uPoss;
    totalShots += uShots;
    totalSot += uSot;
    if (og === 0) cleanSheets += 1;

    const split = isHome ? homeRecord : awayRecord;
    split.played += 1;
    split.gf += ug;
    split.ga += og;

    if (ug > og) {
      split.won += 1;
      currentWinStreak += 1;
      currentUnbeatenStreak += 1;
      if (currentWinStreak > maxWinStreak) maxWinStreak = currentWinStreak;
      if (currentUnbeatenStreak > maxUnbeatenStreak) {
        maxUnbeatenStreak = currentUnbeatenStreak;
      }

      const margin = ug - og;
      if (
        margin > biggestMargin ||
        (margin === biggestMargin &&
          biggestWin !== null &&
          ug > biggestWin.userGoals)
      ) {
        biggestMargin = margin;
        const oppId = isHome ? m.awayTeamId : m.homeTeamId;
        const oppClub = clubMap.get(oppId);
        biggestWin = {
          round: m.round,
          opponentName: oppClub?.name ?? '상대팀',
          opponentShortName: oppClub?.shortName ?? 'OPP',
          userGoals: ug,
          oppGoals: og,
          isHome,
        };
      }
    } else if (ug === og) {
      split.drawn += 1;
      currentWinStreak = 0;
      currentUnbeatenStreak += 1;
      if (currentUnbeatenStreak > maxUnbeatenStreak) {
        maxUnbeatenStreak = currentUnbeatenStreak;
      }
    } else {
      split.lost += 1;
      currentWinStreak = 0;
      currentUnbeatenStreak = 0;
    }
  }

  const played = ordered.length || userRow?.played || 0;
  const goalsFor = userRow?.goalsFor ?? homeRecord.gf + awayRecord.gf;
  const goalsAgainst = userRow?.goalsAgainst ?? homeRecord.ga + awayRecord.ga;
  const roundedXg = Math.round(totalXg * 100) / 100;
  const roundedXga = Math.round(totalXga * 100) / 100;

  return {
    finalRank,
    points: userRow?.points ?? 0,
    played,
    won: userRow?.won ?? homeRecord.won + awayRecord.won,
    drawn: userRow?.drawn ?? homeRecord.drawn + awayRecord.drawn,
    lost: userRow?.lost ?? homeRecord.lost + awayRecord.lost,
    homeRecord,
    awayRecord,
    goalsFor,
    goalsAgainst,
    goalDifference: goalsFor - goalsAgainst,
    totalXg: roundedXg,
    totalXga: roundedXga,
    finishingDiff: Math.round((goalsFor - roundedXg) * 100) / 100,
    preventedDiff: Math.round((roundedXga - goalsAgainst) * 100) / 100,
    avgPossession:
      played > 0 ? Math.round((totalPossession / played) * 10) / 10 : 50,
    avgShots: played > 0 ? Math.round((totalShots / played) * 10) / 10 : 0,
    avgShotsOnTarget:
      played > 0 ? Math.round((totalSot / played) * 10) / 10 : 0,
    cleanSheets,
    maxWinStreak,
    maxUnbeatenStreak,
    biggestWin,
  };
}

/**
 * Builds sortable individual analytics rows for all 16 user squad players (starters + bench).
 */
export function computeSquadPlayerAnalytics(params: {
  starters: (Player | null)[];
  bench: (Player | null)[];
  allPlayerStats: Record<string, PlayerSeasonStats>;
}): SquadPlayerAnalyticsRow[] {
  const { starters, bench, allPlayerStats } = params;
  const squad = [...starters, ...bench].filter((p): p is Player => p !== null);

  return squad.map((player) => {
    const st = allPlayerStats[`user::${player.id}`];

    let primaryDeployedPosition: SubPosition = getPrimaryPosition(player);
    if (st && st.positionCounts) {
      let bestCount = -1;
      for (const [pos, cnt] of Object.entries(st.positionCounts)) {
        if ((cnt ?? 0) > bestCount) {
          bestCount = cnt ?? 0;
          primaryDeployedPosition = pos as SubPosition;
        }
      }
    }

    const goals = st?.goals ?? 0;
    const assists = st?.assists ?? 0;

    return {
      playerId: player.id,
      playerName: player.name,
      ovr: player.ovr,
      stamina: getPlayerStaminaStat(player),
      isLegend: player.isLegend,
      position: player.position,
      mainPositions: [...player.mainPositions],
      primaryDeployedPosition,
      appearances: st?.appearances ?? 0,
      starts: st?.starts ?? 0,
      subAppearances: st?.subAppearances ?? 0,
      minutesPlayed: st?.minutesPlayed ?? 0,
      goals,
      assists,
      goalContributions: goals + assists,
      xg: Math.round((st?.xgSum ?? 0) * 100) / 100,
      cleanSheets: st?.cleanSheets ?? 0,
      momCount: st?.momCount ?? 0,
      avgRating: st?.avgRating ?? 0,
    };
  });
}

/**
 * Merges multiple PlayerSeasonStats maps (e.g. League + Domestic Cup + UCL) into a single
 * combined season total map for the [시즌 통합] analytics tab and Hall of Fame archive.
 */
export function mergePlayerStatsMaps(
  ...maps: Record<string, PlayerSeasonStats>[]
): Record<string, PlayerSeasonStats> {
  const merged: Record<string, PlayerSeasonStats> = {};

  for (const map of maps) {
    for (const [key, st] of Object.entries(map)) {
      const existing = merged[key];
      if (!existing) {
        merged[key] = {
          ...st,
          mainPositions: [...st.mainPositions],
          positionCounts: { ...st.positionCounts },
        };
      } else {
        existing.appearances += st.appearances;
        existing.starts += st.starts;
        existing.subAppearances += st.subAppearances;
        existing.minutesPlayed =
          (existing.minutesPlayed ?? 0) + (st.minutesPlayed ?? 0);
        existing.goals += st.goals;
        existing.assists += st.assists;
        existing.xgSum = Math.round((existing.xgSum + st.xgSum) * 100) / 100;
        existing.cleanSheets += st.cleanSheets;
        existing.momCount += st.momCount;
        existing.ratingSum =
          Math.round((existing.ratingSum + st.ratingSum) * 100) / 100;
        existing.avgRating =
          existing.appearances > 0
            ? Math.round((existing.ratingSum / existing.appearances) * 100) / 100
            : 0;
        for (const [pos, cnt] of Object.entries(st.positionCounts)) {
          existing.positionCounts[pos as SubPosition] =
            (existing.positionCounts[pos as SubPosition] ?? 0) + (cnt ?? 0);
        }
      }
    }
  }

  return merged;
}

/**
 * Computes team match analytics solely from a MatchResult[] list (for Domestic Cup, UCL, or Combined Season).
 */
export function computeMatchesOnlyAnalytics(params: {
  matches: MatchResult[];
  clubs: Club[];
  userClubId?: string;
  finalRank?: number;
  rankLabel?: string;
}): TeamSeasonAnalytics {
  const {
    matches,
    clubs,
    userClubId = USER_CLUB_ID,
    finalRank,
    rankLabel,
  } = params;
  const synthetic = computeTeamSeasonAnalytics({
    standings: [],
    userMatchHistory: matches,
    clubs,
    userClubId,
  });
  const won = synthetic.homeRecord.won + synthetic.awayRecord.won;
  const drawn = synthetic.homeRecord.drawn + synthetic.awayRecord.drawn;
  const lost = synthetic.homeRecord.lost + synthetic.awayRecord.lost;
  const gf = synthetic.homeRecord.gf + synthetic.awayRecord.gf;
  const ga = synthetic.homeRecord.ga + synthetic.awayRecord.ga;

  return {
    ...synthetic,
    finalRank: finalRank && finalRank > 0 ? finalRank : synthetic.finalRank,
    rankLabel,
    points: won * 3 + drawn,
    won,
    drawn,
    lost,
    goalsFor: gf,
    goalsAgainst: ga,
    goalDifference: gf - ga,
    finishingDiff: Math.round((gf - synthetic.totalXg) * 100) / 100,
    preventedDiff: Math.round((synthetic.totalXga - ga) * 100) / 100,
  };
}
