import {
  ACTIVE_PLAYERS,
  buildAiClubRoster,
  getLeagueById,
  LEGEND_PLAYERS,
} from '../engine/dataLoader';
import { USER_CLUB_ID } from '../engine/matchEngine';
import { getPlayerStatById } from '../engine/standingsEngine';
import { UCL_EXTERNAL_TEAMS } from '../engine/uclEngine';
import type { SeasonState } from '../types/game';
import type {
  Club,
  LeagueId,
  PlayerSeasonStats,
  PlayerTransferRecord,
} from '../types/league';
import type { Player, PlaystyleId, SubPosition } from '../types/player';

export interface PlayerCompetitionStatsBreakdown {
  league: PlayerSeasonStats | null;
  cup: PlayerSeasonStats | null;
  ucl: PlayerSeasonStats | null;
  total: PlayerSeasonStats | null;
  transferHistory: PlayerTransferRecord[];
  currentClubName?: string;
  clubSeasonHonors?: string[];
}

const ALL_REAL_BY_ID: Map<string, Player> = (() => {
  const m = new Map<string, Player>();
  for (const p of ACTIVE_PLAYERS) m.set(p.id, p);
  for (const p of LEGEND_PLAYERS) m.set(p.id, p);
  for (const entry of UCL_EXTERNAL_TEAMS) {
    for (const p of entry.roster) {
      if (!m.has(p.id)) m.set(p.id, p);
    }
  }
  return m;
})();

export function getPlayerNationalityMeta(
  playerId: string,
): { nationality: string; nationalityCode: string } | null {
  const found = ALL_REAL_BY_ID.get(playerId);
  if (!found) return null;
  return {
    nationality: found.nationality,
    nationalityCode: found.nationalityCode,
  };
}

function fallbackPlaystylesForPosition(sub: SubPosition): PlaystyleId[] {
  if (sub === 'GK') return ['shot_stopper'];
  if (sub === 'CB') return ['stopper_cb'];
  if (['LB', 'RB', 'LWB', 'RWB'].includes(sub)) return ['attacking_wingback'];
  if (sub === 'CDM') return ['ball_winner'];
  if (sub === 'CAM') return ['playmaker_10'];
  if (['LW', 'RW', 'LM', 'RM'].includes(sub)) return ['inverted_winger'];
  if (sub === 'ST') return ['complete_forward'];
  return ['box_to_box'];
}

/**
 * Resolves a Player object by `playerId` from user squad, season AI rosters, other 4 Big-5 leagues'
 * rosters, UCL AI rosters, static 2026-27/Legend/UCL databases, or falls back to `fallbackStats`.
 */
export function resolvePlayerById(params: {
  playerId: string;
  starters?: (Player | null)[];
  bench?: (Player | null)[];
  season?: SeasonState | null;
  fallbackStats?: PlayerSeasonStats | null;
}): Player | null {
  const { playerId, starters = [], bench = [], season, fallbackStats } = params;

  for (const p of starters) {
    if (p && p.id === playerId) return p;
  }
  for (const p of bench) {
    if (p && p.id === playerId) return p;
  }
  if (season) {
    for (const roster of Object.values(season.aiRosters)) {
      const found = roster.find((p) => p.id === playerId);
      if (found) return found;
    }
    if (season.otherLeagues) {
      for (const bg of Object.values(season.otherLeagues)) {
        if (!bg?.aiRosters) continue;
        for (const roster of Object.values(bg.aiRosters)) {
          const found = roster.find((p) => p.id === playerId);
          if (found) return found;
        }
      }
    }
    if (season.ucl) {
      for (const roster of Object.values(season.ucl.aiRosters)) {
        const found = roster.find((p) => p.id === playerId);
        if (found) return found;
      }
    }
  }

  const real = ALL_REAL_BY_ID.get(playerId);
  if (real) return real;

  if (fallbackStats) {
    const mainPos =
      fallbackStats.mainPositions.length > 0
        ? fallbackStats.mainPositions
        : ([
            fallbackStats.position === 'GK'
              ? 'GK'
              : fallbackStats.position === 'DF'
                ? 'CB'
                : fallbackStats.position === 'MF'
                  ? 'CM'
                  : 'ST',
          ] as SubPosition[]);
    const ovr = fallbackStats.ovr || 76;
    return {
      id: fallbackStats.playerId,
      name: fallbackStats.playerName,
      position: fallbackStats.position,
      mainPositions: mainPos,
      secondaryPositions: [],
      ovr,
      nationality: '유럽',
      nationalityCode: 'EU',
      leagueId: fallbackStats.isLegend ? 'LEGEND' : season?.leagueId ?? 'epl',
      club: fallbackStats.teamName || '소속 구단',
      att: fallbackStats.position === 'FW' ? Math.min(96, ovr + 1) : Math.max(30, ovr - 12),
      mid: fallbackStats.position === 'MF' ? Math.min(96, ovr + 1) : Math.max(55, ovr - 8),
      def:
        fallbackStats.position === 'DF' || fallbackStats.position === 'GK'
          ? Math.min(96, ovr + 1)
          : Math.max(40, ovr - 22),
      stamina: 82,
      playstyles: fallbackPlaystylesForPosition(mainPos[0]),
      scoutNote: `${fallbackStats.teamName || '1군'} 핵심 스쿼드 자원`,
      isLegend: fallbackStats.isLegend,
      isGenerated: true,
    };
  }

  return null;
}

function mergeTwoStats(
  a: PlayerSeasonStats | null,
  b: PlayerSeasonStats | null,
): PlayerSeasonStats | null {
  if (!a) return b;
  if (!b) return a;
  const appearances = a.appearances + b.appearances;
  const ratingSum = Math.round((a.ratingSum + b.ratingSum) * 100) / 100;
  const latest = b.isUserTeam || !a.isUserTeam ? b : a;
  const posCounts = { ...a.positionCounts };
  for (const [k, v] of Object.entries(b.positionCounts)) {
    const sub = k as SubPosition;
    posCounts[sub] = (posCounts[sub] ?? 0) + (v ?? 0);
  }
  return {
    ...latest,
    appearances,
    starts: a.starts + b.starts,
    subAppearances: a.subAppearances + b.subAppearances,
    minutesPlayed: (a.minutesPlayed ?? 0) + (b.minutesPlayed ?? 0),
    goals: a.goals + b.goals,
    assists: a.assists + b.assists,
    xgSum: Math.round((a.xgSum + b.xgSum) * 100) / 100,
    cleanSheets: a.cleanSheets + b.cleanSheets,
    momCount: a.momCount + b.momCount,
    ratingSum,
    avgRating:
      appearances > 0
        ? Math.round((ratingSum / appearances) * 100) / 100
        : 0,
    positionCounts: posCounts,
  };
}

function collectClubSeasonHonors(
  teamId: string | undefined,
  season: SeasonState | null | undefined,
): string[] {
  if (!teamId || !season) return [];
  const honors: string[] = [];

  // User league placement
  const uIdx = season.standings.findIndex((r) => r.teamId === teamId);
  if (uIdx >= 0) {
    const leagueMeta = getLeagueById(season.leagueId);
    if (uIdx === 0) honors.push(`${leagueMeta.koreanName} 우승 (1위)`);
    else honors.push(`${leagueMeta.koreanName} ${uIdx + 1}위`);
  }
  if (season.cup?.completed && season.cup.championTeamId === teamId) {
    honors.push(`${season.cup.meta.koreanName} 우승`);
  }

  // Other 4 Big-5 leagues placement + cup
  if (season.otherLeagues) {
    for (const bg of Object.values(season.otherLeagues)) {
      if (!bg) continue;
      const idx = bg.standings.findIndex((r) => r.teamId === teamId);
      if (idx >= 0) {
        const meta = getLeagueById(bg.leagueId);
        if (idx === 0) honors.push(`${meta.koreanName} 우승 (1위)`);
        else honors.push(`${meta.koreanName} ${idx + 1}위`);
      }
      if (bg.cup?.completed && bg.cup.championTeamId === teamId) {
        honors.push(`${bg.cup.meta.koreanName} 우승`);
      }
    }
  }

  // UCL honors
  if (season.ucl?.completed) {
    if (season.ucl.championTeamId === teamId) {
      honors.push('UEFA 챔피언스리그 우승');
    } else if (
      season.ucl.ties.final.some(
        (t) => t.teamAId === teamId || t.teamBId === teamId,
      )
    ) {
      honors.push('UCL 준우승');
    } else if (
      season.ucl.ties.sf.some(
        (t) => t.teamAId === teamId || t.teamBId === teamId,
      )
    ) {
      honors.push('UCL 4강');
    } else if (
      season.ucl.ties.qf.some(
        (t) => t.teamAId === teamId || t.teamBId === teamId,
      )
    ) {
      honors.push('UCL 8강');
    } else if (
      season.ucl.ties.r16.some(
        (t) => t.teamAId === teamId || t.teamBId === teamId,
      )
    ) {
      honors.push('UCL 16강');
    }
  }

  return honors;
}

/**
 * Builds the 4-row competition breakdown (League / Domestic Cup / UCL / Season Total),
 * club season honors, and deduplicated mid-season transfer history for ANY player across all 5 leagues.
 */
export function buildPlayerCompetitionBreakdown(
  playerId: string,
  season: SeasonState | null | undefined,
  fallbackStats?: PlayerSeasonStats | null,
): PlayerCompetitionStatsBreakdown {
  let leagueRaw = getPlayerStatById(season?.allPlayerStats, playerId) ?? null;
  let cupRaw = getPlayerStatById(season?.cupPlayerStats, playerId) ?? null;
  const uclRaw = getPlayerStatById(season?.uclPlayerStats, playerId) ?? null;

  // Also merge stats from the 4 background Big-5 leagues (handles both foreign stars & cross-league transfers!)
  if (season?.otherLeagues) {
    for (const bg of Object.values(season.otherLeagues)) {
      if (!bg) continue;
      const bgLeague = getPlayerStatById(bg.playerStats, playerId);
      if (bgLeague && bgLeague.appearances > 0) {
        leagueRaw = mergeTwoStats(bgLeague, leagueRaw);
      }
      const bgCup = getPlayerStatById(bg.cupPlayerStats, playerId);
      if (bgCup && bgCup.appearances > 0) {
        cupRaw = mergeTwoStats(bgCup, cupRaw);
      }
    }
  }

  const league = leagueRaw && leagueRaw.appearances > 0 ? leagueRaw : null;
  const cup = cupRaw && cupRaw.appearances > 0 ? cupRaw : null;
  const ucl = uclRaw && uclRaw.appearances > 0 ? uclRaw : null;

  let total = mergeTwoStats(mergeTwoStats(league, cup), ucl);
  if (!total && fallbackStats && fallbackStats.appearances > 0) {
    total = fallbackStats;
  }

  const historyPool: PlayerTransferRecord[] = [
    ...(leagueRaw?.transferHistory ?? []),
    ...(cupRaw?.transferHistory ?? []),
    ...(uclRaw?.transferHistory ?? []),
    ...(fallbackStats?.transferHistory ?? []),
  ];
  const transferHistory: PlayerTransferRecord[] = [];
  for (const rec of historyPool) {
    if (
      !transferHistory.some(
        (r) =>
          r.fromClubId === rec.fromClubId &&
          r.toClubId === rec.toClubId &&
          r.round === rec.round,
      )
    ) {
      transferHistory.push(rec);
    }
  }

  const latestStat =
    (league?.isUserTeam ? league : null) ??
    ucl ??
    cup ??
    league ??
    fallbackStats ??
    null;
  const clubSeasonHonors = collectClubSeasonHonors(latestStat?.teamId, season);

  return {
    league,
    cup,
    ucl,
    total,
    transferHistory,
    currentClubName: latestStat?.teamName || undefined,
    clubSeasonHonors,
  };
}

/**
 * Resolves the 11-player (or full user 16-player) squad for any club clicked in standings or brackets.
 */
export function resolveClubRoster(params: {
  clubId: string;
  club?: Club | null;
  leagueId?: LeagueId;
  season?: SeasonState | null;
  userStarters?: (Player | null)[];
  userBench?: (Player | null)[];
}): Player[] {
  const {
    clubId,
    club,
    leagueId,
    season,
    userStarters = [],
    userBench = [],
  } = params;

  if (clubId === USER_CLUB_ID) {
    return [...userStarters, ...userBench].filter(
      (p): p is Player => p !== null,
    );
  }
  if (season?.aiRosters[clubId] && season.aiRosters[clubId].length > 0) {
    return season.aiRosters[clubId];
  }
  if (season?.otherLeagues) {
    for (const bg of Object.values(season.otherLeagues)) {
      const bgRoster = bg?.aiRosters?.[clubId];
      if (bgRoster && bgRoster.length > 0) return bgRoster;
    }
  }
  if (
    season?.ucl?.aiRosters[clubId] &&
    season.ucl.aiRosters[clubId].length > 0
  ) {
    return season.ucl.aiRosters[clubId];
  }
  const ext = UCL_EXTERNAL_TEAMS.find((t) => t.club.id === clubId);
  if (ext) return ext.roster;

  if (club) {
    const excludeIds = new Set<string>([
      ...userStarters.filter((p): p is Player => p !== null).map((p) => p.id),
      ...userBench.filter((p): p is Player => p !== null).map((p) => p.id),
      ...(season?.departedPlayerIds ?? []),
    ]);
    return buildAiClubRoster(club, leagueId ?? season?.leagueId ?? 'epl', excludeIds);
  }
  return [];
}
