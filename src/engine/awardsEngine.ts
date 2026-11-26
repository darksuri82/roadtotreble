import type { DomesticCupState } from '../types/cup';
import type { OtherLeagueSeasonState } from '../types/game';
import type {
  BallonDorCandidate,
  BestXiEntry,
  GlobalSeasonAwards,
  LeagueId,
  PlayerSeasonStats,
  SeasonAwards,
  StandingRow,
} from '../types/league';
import type { Position, SubPosition } from '../types/player';
import type { UclTournamentState } from '../types/ucl';
import { getLeagueById, LEAGUES } from './dataLoader';

function computeAwardScore(
  st: PlayerSeasonStats,
  teamRankById: Map<string, number>,
): number {
  const rank = teamRankById.get(st.teamId) ?? 15;
  const rankBonus = rank <= 1 ? 10 : rank <= 4 ? 6 : rank <= 8 ? 2 : 0;

  if (st.position === 'GK') {
    return (
      st.avgRating * 14 +
      st.cleanSheets * 2.2 +
      st.momCount * 3.0 +
      rankBonus
    );
  }
  if (st.position === 'DF') {
    return (
      st.avgRating * 13 +
      st.cleanSheets * 1.5 +
      st.goals * 2.4 +
      st.assists * 1.8 +
      st.momCount * 3.0 +
      rankBonus
    );
  }
  if (st.position === 'MF') {
    return (
      st.avgRating * 13 +
      st.goals * 1.8 +
      st.assists * 2.0 +
      st.momCount * 3.0 +
      rankBonus
    );
  }
  // FW
  return (
    st.avgRating * 12.5 +
    st.goals * 2.0 +
    st.assists * 1.4 +
    st.momCount * 3.0 +
    rankBonus
  );
}

const BEST_XI_SLOTS: {
  slotIndex: number;
  slotLabel: SubPosition;
  preferredSubs: SubPosition[];
  broadFallback: Position;
}[] = [
  { slotIndex: 0, slotLabel: 'GK', preferredSubs: ['GK'], broadFallback: 'GK' },
  { slotIndex: 1, slotLabel: 'LB', preferredSubs: ['LB', 'LWB'], broadFallback: 'DF' },
  { slotIndex: 2, slotLabel: 'CB', preferredSubs: ['CB'], broadFallback: 'DF' },
  { slotIndex: 3, slotLabel: 'CB', preferredSubs: ['CB'], broadFallback: 'DF' },
  { slotIndex: 4, slotLabel: 'RB', preferredSubs: ['RB', 'RWB'], broadFallback: 'DF' },
  { slotIndex: 5, slotLabel: 'CDM', preferredSubs: ['CDM', 'CM'], broadFallback: 'MF' },
  { slotIndex: 6, slotLabel: 'CM', preferredSubs: ['CM', 'CAM'], broadFallback: 'MF' },
  { slotIndex: 7, slotLabel: 'CM', preferredSubs: ['CAM', 'CM', 'CDM'], broadFallback: 'MF' },
  { slotIndex: 8, slotLabel: 'LW', preferredSubs: ['LW', 'LM'], broadFallback: 'FW' },
  { slotIndex: 9, slotLabel: 'ST', preferredSubs: ['ST'], broadFallback: 'FW' },
  { slotIndex: 10, slotLabel: 'RW', preferredSubs: ['RW', 'RM'], broadFallback: 'FW' },
];

/**
 * Generates end-of-season League Personal Rankings (TOP 10), 4-3-3 Best XI, and Player of the Season (POTY).
 */
export function computeSeasonAwards(
  allPlayerStats: Record<string, PlayerSeasonStats>,
  standings: StandingRow[],
  totalRounds: number,
): SeasonAwards {
  const teamRankById = new Map<string, number>();
  standings.forEach((row, idx) => teamRankById.set(row.teamId, idx + 1));

  const players = Object.values(allPlayerStats).filter((p) => p.appearances > 0);
  const minAppsForRating = Math.max(5, Math.floor(totalRounds * 0.45));

  const topScorers = [...players]
    .sort((a, b) => b.goals - a.goals || b.assists - a.assists || b.avgRating - a.avgRating)
    .slice(0, 10);

  const topAssisters = [...players]
    .sort((a, b) => b.assists - a.assists || b.goals - a.goals || b.avgRating - a.avgRating)
    .slice(0, 10);

  const topCleanSheets = players
    .filter((p) => p.position === 'GK' || p.position === 'DF')
    .sort((a, b) => b.cleanSheets - a.cleanSheets || b.avgRating - a.avgRating)
    .slice(0, 10);

  const qualifiedForRating = players.filter(
    (p) => p.appearances >= minAppsForRating,
  );
  const ratingPool = qualifiedForRating.length >= 11 ? qualifiedForRating : players;

  const topRatings = [...ratingPool]
    .sort((a, b) => b.avgRating - a.avgRating || b.momCount - a.momCount)
    .slice(0, 10);

  // Select 4-3-3 League Best XI
  const scoredPool = ratingPool.map((st) => ({
    st,
    score: computeAwardScore(st, teamRankById),
  }));
  scoredPool.sort((a, b) => b.score - a.score);

  const chosenIds = new Set<string>();
  const bestXi: BestXiEntry[] = [];

  for (const slot of BEST_XI_SLOTS) {
    let pick = scoredPool.find(
      (x) =>
        !chosenIds.has(x.st.playerId) &&
        x.st.mainPositions.some((mp) => slot.preferredSubs.includes(mp)),
    );
    if (!pick) {
      pick = scoredPool.find(
        (x) =>
          !chosenIds.has(x.st.playerId) &&
          x.st.position === slot.broadFallback,
      );
    }
    if (!pick) {
      pick = scoredPool.find((x) => !chosenIds.has(x.st.playerId));
    }
    if (pick) {
      chosenIds.add(pick.st.playerId);
      bestXi.push({
        slotIndex: slot.slotIndex,
        slotLabel: slot.slotLabel,
        stats: pick.st,
      });
    }
  }

  const poty = scoredPool[0]?.st ?? null;

  const gkPlayers = players
    .filter((p) => p.position === 'GK')
    .sort(
      (a, b) =>
        b.cleanSheets - a.cleanSheets ||
        b.avgRating - a.avgRating ||
        b.momCount - a.momCount,
    );
  const bestGoalkeeper = gkPlayers[0] ?? null;

  const bestDefender =
    scoredPool.find((x) => x.st.position === 'DF')?.st ??
    players
      .filter((p) => p.position === 'DF')
      .sort(
        (a, b) =>
          computeAwardScore(b, teamRankById) -
          computeAwardScore(a, teamRankById),
      )[0] ??
    null;

  return {
    topScorers,
    topAssisters,
    topCleanSheets,
    topRatings,
    bestXi,
    poty,
    bestGoalkeeper,
    bestDefender,
  };
}

function mergeStatsMaps(
  maps: Record<string, PlayerSeasonStats>[],
): Map<string, PlayerSeasonStats> {
  const merged = new Map<string, PlayerSeasonStats>();
  for (const map of maps) {
    for (const st of Object.values(map)) {
      if (st.appearances <= 0) continue;
      // Strictly key by unique worldwide playerId so mid-season transfers merge into a single player!
      const key = st.playerId;
      const cur = merged.get(key);
      if (!cur) {
        merged.set(key, {
          ...st,
          mainPositions: [...st.mainPositions],
          positionCounts: { ...st.positionCounts },
          transferHistory: st.transferHistory ? [...st.transferHistory] : undefined,
        });
      } else {
        const appearances = cur.appearances + st.appearances;
        const ratingSum = Math.round((cur.ratingSum + st.ratingSum) * 100) / 100;
        const mergedPos = { ...cur.positionCounts };
        for (const [pos, cnt] of Object.entries(st.positionCounts)) {
          const k = pos as SubPosition;
          mergedPos[k] = (mergedPos[k] ?? 0) + (cnt ?? 0);
        }
        const mergedHistory = [...(cur.transferHistory ?? [])];
        for (const rec of st.transferHistory ?? []) {
          if (
            !mergedHistory.some(
              (r) =>
                r.fromClubId === rec.fromClubId &&
                r.toClubId === rec.toClubId &&
                r.round === rec.round,
            )
          ) {
            mergedHistory.push(rec);
          }
        }
        // Latest competition map (e.g. UCL) or user club holds the final club at season end
        const useLaterClub =
          st.isUserTeam || (st.teamId !== cur.teamId && !cur.isUserTeam);
        merged.set(key, {
          ...cur,
          ...(useLaterClub
            ? {
                teamId: st.teamId,
                teamName: st.teamName,
                teamShortName: st.teamShortName,
                teamPrimaryColor: st.teamPrimaryColor,
                teamSecondaryColor: st.teamSecondaryColor,
                isUserTeam: st.isUserTeam,
              }
            : {}),
          appearances,
          starts: cur.starts + st.starts,
          subAppearances: cur.subAppearances + st.subAppearances,
          minutesPlayed: (cur.minutesPlayed ?? 0) + (st.minutesPlayed ?? 0),
          goals: cur.goals + st.goals,
          assists: cur.assists + st.assists,
          xgSum: Math.round((cur.xgSum + st.xgSum) * 100) / 100,
          cleanSheets: cur.cleanSheets + st.cleanSheets,
          momCount: cur.momCount + st.momCount,
          ratingSum,
          avgRating:
            appearances > 0
              ? Math.round((ratingSum / appearances) * 100) / 100
              : 0,
          positionCounts: mergedPos,
          transferHistory:
            mergedHistory.length > 0 ? mergedHistory : undefined,
        });
      }
    }
  }
  return merged;
}

/**
 * Computes global end-of-season awards ONCE at full season completion:
 * Ballon d'Or (Winner + TOP 5) and 4-3-3 World Best XI using 100% IDENTICAL evaluation criteria
 * across all 5 European Big-5 leagues (User League + Other 4 Leagues), all 5 Domestic Cups, and UCL.
 * Uses strictly real simulated player stats with zero synthetic fabrication or user-team bias.
 */
export function computeGlobalSeasonAwards(params: {
  allLeaguePlayerStats: Record<string, PlayerSeasonStats>;
  cupPlayerStats: Record<string, PlayerSeasonStats>;
  uclPlayerStats: Record<string, PlayerSeasonStats>;
  leagueStandings: StandingRow[];
  cup: DomesticCupState | null;
  ucl: UclTournamentState | null;
  otherLeagues: Partial<Record<LeagueId, OtherLeagueSeasonState>>;
  userLeagueId: LeagueId;
  userClubId?: string;
  excludeIds?: Set<string>;
}): GlobalSeasonAwards {
  const {
    allLeaguePlayerStats,
    cupPlayerStats,
    uclPlayerStats,
    leagueStandings,
    cup,
    ucl,
    otherLeagues,
    userLeagueId,
  } = params;

  // 1) Collect trophy & league placement honors identically across ALL 5 leagues, ALL 5 cups, and UCL
  const teamTrophies = new Map<string, string[]>();
  const teamTrophyPoints = new Map<string, number>();

  const addHonor = (
    teamId: string | null | undefined,
    label: string,
    pts: number,
    isDisplayTrophy = true,
  ) => {
    if (!teamId) return;
    if (isDisplayTrophy) {
      const list = teamTrophies.get(teamId) ?? [];
      if (!list.includes(label)) {
        list.push(label);
        teamTrophies.set(teamId, list);
        teamTrophyPoints.set(teamId, (teamTrophyPoints.get(teamId) ?? 0) + pts);
      }
    } else {
      teamTrophyPoints.set(teamId, (teamTrophyPoints.get(teamId) ?? 0) + pts);
    }
  };

  // User's league honors
  const userLeague = getLeagueById(userLeagueId);
  addHonor(leagueStandings[0]?.teamId, `${userLeague.koreanName} 우승`, 18);
  if (leagueStandings[1]?.teamId) {
    addHonor(leagueStandings[1].teamId, `${userLeague.koreanName} 준우승`, 6, false);
  }
  leagueStandings.slice(2, 4).forEach((row) => {
    addHonor(row.teamId, `${userLeague.koreanName} TOP 4`, 3, false);
  });

  if (cup?.completed && cup.championTeamId) {
    addHonor(cup.championTeamId, `${cup.meta.koreanName} 우승`, 9);
  }

  // Other 4 Big-5 leagues' identical honors (League title/runner-up/TOP4 + Domestic Cup champion)
  const otherLeagueStatsMaps: Record<string, PlayerSeasonStats>[] = [];
  const otherCupStatsMaps: Record<string, PlayerSeasonStats>[] = [];

  for (const league of LEAGUES) {
    if (league.id === userLeagueId) continue;
    const bg = otherLeagues[league.id];
    if (!bg || bg.standings.length === 0) continue;

    addHonor(bg.standings[0]?.teamId, `${league.koreanName} 우승`, 18);
    if (bg.standings[1]?.teamId) {
      addHonor(bg.standings[1].teamId, `${league.koreanName} 준우승`, 6, false);
    }
    bg.standings.slice(2, 4).forEach((row) => {
      addHonor(row.teamId, `${league.koreanName} TOP 4`, 3, false);
    });

    if (bg.cup?.completed && bg.cup.championTeamId) {
      addHonor(bg.cup.championTeamId, `${bg.cup.meta.koreanName} 우승`, 9);
    }

    if (bg.playerStats) {
      otherLeagueStatsMaps.push(bg.playerStats);
    }
    if (bg.cupPlayerStats) {
      otherCupStatsMaps.push(bg.cupPlayerStats);
    }
  }

  // UCL honors (identical for all 36 participating clubs)
  if (ucl?.completed && ucl.championTeamId) {
    addHonor(ucl.championTeamId, 'UEFA 챔피언스리그 우승', 32);
    const finalTie = ucl.ties.final[0];
    if (finalTie) {
      const runnerUp =
        finalTie.teamAId === ucl.championTeamId
          ? finalTie.teamBId
          : finalTie.teamAId;
      addHonor(runnerUp, 'UCL 준우승', 12);
    }
    for (const sfTie of ucl.ties.sf) {
      if (sfTie.winnerId) {
        const sfLoser =
          sfTie.teamAId === sfTie.winnerId ? sfTie.teamBId : sfTie.teamAId;
        addHonor(sfLoser, 'UCL 4강', 6, false);
      }
    }
    for (const qfTie of ucl.ties.qf) {
      if (qfTie.winnerId) {
        const qfLoser =
          qfTie.teamAId === qfTie.winnerId ? qfTie.teamBId : qfTie.teamAId;
        addHonor(qfLoser, 'UCL 8강', 3, false);
      }
    }
  }

  // Treble bonus check (identical across all 5 leagues: League + Domestic Cup + UCL = 3 major titles)
  for (const [tid, list] of teamTrophies.entries()) {
    const majorWins = list.filter((t) => t.endsWith('우승')).length;
    if (majorWins >= 3) {
      teamTrophyPoints.set(tid, (teamTrophyPoints.get(tid) ?? 0) + 16);
    }
  }

  // 2) Merge REAL simulated stats across ALL 5 leagues + ALL 5 domestic cups + UCL by unique playerId
  // First deduplicate across the 5 league maps so cross-league traded players are never counted twice
  const deduplicatedLeagueMap: Record<string, PlayerSeasonStats> = {};
  for (const lMap of [...otherLeagueStatsMaps, allLeaguePlayerStats]) {
    for (const st of Object.values(lMap)) {
      if (st.appearances <= 0) continue;
      const existing = deduplicatedLeagueMap[st.playerId];
      if (!existing) {
        deduplicatedLeagueMap[st.playerId] = { ...st };
      } else {
        const hasTrade =
          Boolean(st.transferHistory?.some((r) => r.type === 'trade')) ||
          Boolean(existing.transferHistory?.some((r) => r.type === 'trade'));
        if (hasTrade || existing.appearances + st.appearances > 38) {
          deduplicatedLeagueMap[st.playerId] = st.isUserTeam
            ? { ...st }
            : existing.isUserTeam
              ? existing
              : st.appearances >= existing.appearances
                ? { ...st }
                : existing;
        } else {
          const singleMerged = mergeStatsMaps([
            { [existing.playerId]: existing },
            { [st.playerId]: st },
          ]).get(st.playerId);
          if (singleMerged) {
            deduplicatedLeagueMap[st.playerId] = singleMerged;
          }
        }
      }
    }
  }

  const merged = mergeStatsMaps([
    deduplicatedLeagueMap,
    ...otherCupStatsMaps,
    cupPlayerStats,
    uclPlayerStats,
  ]);

  // Index competition-specific maps for competition-weighted Ballon d'Or / World XI evaluation
  const uclById = new Map<string, PlayerSeasonStats>();
  for (const st of Object.values(uclPlayerStats)) {
    if (st.appearances > 0) uclById.set(st.playerId, st);
  }
  const cupMerged = mergeStatsMaps([...otherCupStatsMaps, cupPlayerStats]);

  // 3) Score every candidate globally with 100% identical formula (zero user bias)
  const allCandidates = Array.from(merged.values()).filter(
    (p) => p.appearances >= 12,
  );
  const pool =
    allCandidates.length >= 11 ? allCandidates : Array.from(merged.values());

  const scored = pool.map((st) => {
    const trophies = teamTrophies.get(st.teamId) ?? [];
    const trophyPts = teamTrophyPoints.get(st.teamId) ?? 0;
    const uclSt = uclById.get(st.playerId);
    const cupSt = cupMerged.get(st.playerId);

    // Competition prestige weighting: UCL +35% extra per G/A/CS/MOM, Domestic Cup +10%
    const uclPrestige = uclSt
      ? uclSt.goals * 0.68 +
        uclSt.assists * 0.5 +
        (st.position === 'GK' || st.position === 'DF'
          ? uclSt.cleanSheets * 0.58
          : 0) +
        uclSt.momCount * 1.15 +
        Math.max(0, uclSt.avgRating - 7.0) * 3.2
      : 0;
    const cupPrestige = cupSt
      ? cupSt.goals * 0.22 +
        cupSt.assists * 0.16 +
        (st.position === 'GK' || st.position === 'DF'
          ? cupSt.cleanSheets * 0.22
          : 0)
      : 0;

    let perfScore = 0;
    if (st.position === 'GK') {
      perfScore =
        st.avgRating * 15.5 +
        st.cleanSheets * 2.1 +
        st.momCount * 2.8 +
        Math.max(0, st.ovr - 80) * 0.9;
    } else if (st.position === 'DF') {
      perfScore =
        st.avgRating * 14.5 +
        st.cleanSheets * 1.45 +
        st.goals * 2.2 +
        st.assists * 1.8 +
        st.momCount * 2.8 +
        Math.max(0, st.ovr - 80) * 0.85;
    } else if (st.position === 'MF') {
      perfScore =
        st.avgRating * 14.5 +
        st.goals * 1.85 +
        st.assists * 1.95 +
        st.momCount * 2.8 +
        Math.max(0, st.ovr - 80) * 0.85;
    } else {
      perfScore =
        st.avgRating * 13.8 +
        st.goals * 1.95 +
        st.assists * 1.45 +
        st.momCount * 2.8 +
        Math.max(0, st.ovr - 80) * 0.85;
    }

    const weightedPerf = perfScore + uclPrestige + cupPrestige;

    // Slight prestige weighting toward attacking/midfield stars for Ballon d'Or race,
    // while keeping World Best XI strictly position-balanced
    const ballonRoleBias =
      st.position === 'FW'
        ? 4.5
        : st.position === 'MF'
          ? 2.5
          : st.position === 'DF'
            ? 0
            : -2;
    const ballonScore =
      Math.round((weightedPerf + trophyPts + ballonRoleBias) * 10) / 10;
    const xiScore = Math.round((weightedPerf + trophyPts * 0.85) * 10) / 10;

    const reasonParts: string[] = [];
    if (trophies.length > 0) {
      reasonParts.push(trophies.slice(0, 3).join(' · '));
    }
    if (st.position === 'GK') {
      reasonParts.push(
        `클린시트 ${st.cleanSheets}회 · 평점 ${st.avgRating.toFixed(2)}`,
      );
    } else {
      reasonParts.push(
        `${st.goals}골 ${st.assists}도움 · 평점 ${st.avgRating.toFixed(2)}`,
      );
    }
    if (uclSt && uclSt.appearances > 0) {
      if (st.position === 'GK') {
        reasonParts.push(`UCL CS ${uclSt.cleanSheets}`);
      } else if (uclSt.goals + uclSt.assists > 0) {
        reasonParts.push(`UCL ${uclSt.goals}G ${uclSt.assists}A`);
      }
    }

    return {
      st,
      trophies,
      ballonScore,
      xiScore,
      reason: reasonParts.join(' / '),
    };
  });

  // Ballon d'Or TOP 5 (strictly unique playerId)
  const ballonSorted = [...scored].sort(
    (a, b) => b.ballonScore - a.ballonScore || b.st.avgRating - a.st.avgRating,
  );
  const ballonDorTop5: BallonDorCandidate[] = ballonSorted
    .slice(0, 5)
    .map((item, idx) => ({
      rank: idx + 1,
      stats: item.st,
      ballonScore: item.ballonScore,
      trophies: item.trophies,
      reason: item.reason,
    }));

  // World Best XI (4-3-3, strictly unique playerId)
  const xiSorted = [...scored].sort(
    (a, b) => b.xiScore - a.xiScore || b.st.avgRating - a.st.avgRating,
  );
  const chosenIds = new Set<string>();
  const worldBestXi: BestXiEntry[] = [];

  for (const slot of BEST_XI_SLOTS) {
    let pick = xiSorted.find(
      (x) =>
        !chosenIds.has(x.st.playerId) &&
        x.st.mainPositions.some((mp) => slot.preferredSubs.includes(mp)),
    );
    if (!pick) {
      pick = xiSorted.find(
        (x) =>
          !chosenIds.has(x.st.playerId) &&
          x.st.position === slot.broadFallback,
      );
    }
    if (!pick) {
      pick = xiSorted.find((x) => !chosenIds.has(x.st.playerId));
    }
    if (pick) {
      chosenIds.add(pick.st.playerId);
      worldBestXi.push({
        slotIndex: slot.slotIndex,
        slotLabel: slot.slotLabel,
        stats: pick.st,
      });
    }
  }

  return {
    ballonDorWinner: ballonDorTop5[0] ?? null,
    ballonDorTop5,
    worldBestXi,
  };
}

