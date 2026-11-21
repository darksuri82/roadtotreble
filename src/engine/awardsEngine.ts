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
import { buildAiClubRoster, getLeagueById, LEAGUES } from './dataLoader';
import { USER_CLUB_ID } from './matchEngine';

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

  return {
    topScorers,
    topAssisters,
    topCleanSheets,
    topRatings,
    bestXi,
    poty,
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
 * Ballon d'Or (Winner + TOP 5) and 4-3-3 World Best XI combining competition-weighted
 * personal stats (League + Domestic Cup + UCL) and team honors across all 5 European leagues.
 * Attributes every player strictly to their final club at season end with zero duplicates.
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
    userClubId = USER_CLUB_ID,
    excludeIds,
  } = params;

  // 1) Collect trophy & league placement honors per team across all competitions
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

  const userLeague = getLeagueById(userLeagueId);
  const userLeagueWinnerId = leagueStandings[0]?.teamId;
  addHonor(userLeagueWinnerId, `${userLeague.koreanName} 우승`, 18);
  if (leagueStandings[1]?.teamId) {
    addHonor(leagueStandings[1].teamId, `${userLeague.koreanName} 준우승`, 6, false);
  }
  leagueStandings.slice(2, 4).forEach((row) => {
    addHonor(row.teamId, `${userLeague.koreanName} TOP 4`, 3, false);
  });

  if (cup?.completed && cup.championTeamId) {
    addHonor(cup.championTeamId, `${cup.meta.koreanName} 우승`, 9);
  }

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
    // Semifinalists who did not reach the final get +6 prestige
    for (const sfTie of ucl.ties.sf) {
      if (sfTie.winnerId) {
        const sfLoser =
          sfTie.teamAId === sfTie.winnerId ? sfTie.teamBId : sfTie.teamAId;
        addHonor(sfLoser, 'UCL 4강', 6, false);
      }
    }
  }

  // Merge League + Cup + UCL by unique playerId
  const merged = mergeStatsMaps([
    allLeaguePlayerStats,
    cupPlayerStats,
    uclPlayerStats,
  ]);

  // Index competition-specific maps for competition-weighted Ballon d'Or evaluation
  const uclById = new Map<string, PlayerSeasonStats>();
  for (const st of Object.values(uclPlayerStats)) {
    if (st.appearances > 0) uclById.set(st.playerId, st);
  }
  const cupById = new Map<string, PlayerSeasonStats>();
  for (const st of Object.values(cupPlayerStats)) {
    if (st.appearances > 0) cupById.set(st.playerId, st);
  }

  const userLeagueClubIds = new Set(leagueStandings.map((r) => r.teamId));
  const blockedOtherLeagueIds = new Set<string>(excludeIds ?? []);
  // Also block every player who appeared in user's league (including user squad) from being synthesized elsewhere
  for (const st of Object.values(allLeaguePlayerStats)) {
    if (st.appearances > 0 || st.isUserTeam) {
      blockedOtherLeagueIds.add(st.playerId);
    }
  }

  for (const league of LEAGUES) {
    if (league.id === userLeagueId) continue;
    const bg = otherLeagues[league.id];
    if (!bg || bg.standings.length === 0) continue;

    const champId = bg.standings[0]?.teamId;
    addHonor(champId, `${league.koreanName} 우승`, 18);
    if (bg.standings[1]?.teamId) {
      addHonor(bg.standings[1].teamId, `${league.koreanName} 준우승`, 6, false);
    }
    bg.standings.slice(2, 4).forEach((row) => {
      addHonor(row.teamId, `${league.koreanName} TOP 4`, 3, false);
    });

    // Synthesize realistic domestic season production for Top-3 clubs in each other league
    const topClubs = bg.standings.slice(0, 3);
    for (let rankIdx = 0; rankIdx < topClubs.length; rankIdx += 1) {
      const row = topClubs[rankIdx];
      if (userLeagueClubIds.has(row.teamId)) continue;
      const club = bg.clubs.find((c) => c.id === row.teamId);
      if (!club) continue;

      const roster =
        ucl?.aiRosters[club.id] ??
        buildAiClubRoster(club, league.id, blockedOtherLeagueIds);
      const played = Math.max(1, row.played);
      const teamGf = Math.max(30, row.goalsFor);
      const teamCs = Math.max(
        6,
        Math.round(
          played * Math.max(0.22, 0.54 - row.goalsAgainst / (played * 2.5)),
        ),
      );

      const fwList = roster
        .filter((p) => p.position === 'FW')
        .sort((a, b) => b.ovr - a.ovr);
      const mfList = roster
        .filter((p) => p.position === 'MF')
        .sort((a, b) => b.ovr - a.ovr);
      const dfList = roster
        .filter((p) => p.position === 'DF')
        .sort((a, b) => b.ovr - a.ovr);
      const gkList = roster
        .filter((p) => p.position === 'GK')
        .sort((a, b) => b.ovr - a.ovr);

      const addDomesticStats = (
        p: (typeof roster)[number],
        goalShare: number,
        assistShare: number,
        ratingBoost: number,
      ) => {
        // Never duplicate a player who already belongs to the user or played in user's league!
        if (blockedOtherLeagueIds.has(p.id)) return;
        const key = p.id;
        const existing = merged.get(key);
        if (existing && existing.teamId !== club.id) return;

        const domApps = Math.max(24, played - 3);
        const domGoals = Math.max(0, Math.round(teamGf * goalShare));
        const domAssists = Math.max(0, Math.round(teamGf * assistShare));
        const domCs = p.position === 'GK' || p.position === 'DF' ? teamCs : 0;
        const baseAvg =
          6.85 +
          Math.max(0, (p.ovr - 82) * 0.055) +
          (rankIdx === 0 ? 0.18 : rankIdx === 1 ? 0.1 : 0.04) +
          ratingBoost;
        const clampedAvg = Math.min(8.15, Math.max(6.7, baseAvg));
        const domRatingSum = clampedAvg * domApps;
        const domMom = Math.max(
          1,
          Math.round(
            (domGoals * 0.22 +
              domAssists * 0.16 +
              (p.position === 'GK' ? domCs * 0.18 : 0)) *
              (rankIdx === 0 ? 1.1 : 0.9),
          ),
        );

        if (!existing) {
          merged.set(key, {
            playerId: p.id,
            playerName: p.name,
            teamId: club.id,
            teamName: club.name,
            teamShortName: club.shortName,
            teamPrimaryColor: club.primaryColor,
            teamSecondaryColor: club.secondaryColor,
            isUserTeam: false,
            position: p.position,
            mainPositions: p.mainPositions,
            ovr: p.ovr,
            appearances: domApps,
            starts: domApps,
            subAppearances: 0,
            minutesPlayed: domApps * 84,
            goals: domGoals,
            assists: domAssists,
            xgSum: Math.round(domGoals * 0.92 * 10) / 10,
            cleanSheets: domCs,
            momCount: domMom,
            ratingSum: domRatingSum,
            avgRating: Math.round(clampedAvg * 100) / 100,
            positionCounts: { [p.mainPositions[0] ?? 'CM']: domApps },
            isLegend: p.isLegend,
          });
        } else {
          // Existing entry had only UCL stats for this exact club -> add domestic league contribution
          const appearances = existing.appearances + domApps;
          const ratingSum = existing.ratingSum + domRatingSum;
          merged.set(key, {
            ...existing,
            appearances,
            starts: existing.starts + domApps,
            minutesPlayed: existing.minutesPlayed + domApps * 84,
            goals: existing.goals + domGoals,
            assists: existing.assists + domAssists,
            xgSum:
              Math.round((existing.xgSum + domGoals * 0.92) * 100) / 100,
            cleanSheets: existing.cleanSheets + domCs,
            momCount: existing.momCount + domMom,
            ratingSum,
            avgRating: Math.round((ratingSum / appearances) * 100) / 100,
          });
        }
      };

      if (fwList[0]) addDomesticStats(fwList[0], 0.3, 0.09, 0.18);
      if (fwList[1]) addDomesticStats(fwList[1], 0.18, 0.13, 0.1);
      if (fwList[2]) addDomesticStats(fwList[2], 0.13, 0.1, 0.05);
      if (mfList[0]) addDomesticStats(mfList[0], 0.11, 0.17, 0.16);
      if (mfList[1]) addDomesticStats(mfList[1], 0.07, 0.12, 0.08);
      if (mfList[2]) addDomesticStats(mfList[2], 0.05, 0.09, 0.04);
      dfList
        .slice(0, 4)
        .forEach((d, idx) =>
          addDomesticStats(
            d,
            idx < 2 ? 0.035 : 0.02,
            idx >= 2 ? 0.09 : 0.03,
            idx === 0 ? 0.1 : 0.04,
          ),
        );
      if (gkList[0]) addDomesticStats(gkList[0], 0, 0, 0.14);
    }
  }

  // Treble bonus check
  for (const [tid, list] of teamTrophies.entries()) {
    const majorWins = list.filter((t) => t.endsWith('우승')).length;
    if (majorWins >= 3) {
      teamTrophyPoints.set(tid, (teamTrophyPoints.get(tid) ?? 0) + 16);
    }
  }

  // 2) Score every candidate globally with competition-weighted stats + team honors
  const allCandidates = Array.from(merged.values()).filter(
    (p) => p.appearances >= 12,
  );
  const pool =
    allCandidates.length >= 11 ? allCandidates : Array.from(merged.values());

  const scored = pool.map((st) => {
    const trophies = teamTrophies.get(st.teamId) ?? [];
    const trophyPts = teamTrophyPoints.get(st.teamId) ?? 0;
    const uclSt = uclById.get(st.playerId);
    const cupSt = cupById.get(st.playerId);

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
      reasonParts.push(trophies.slice(0, 2).join(' · '));
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
    if (
      st.teamId === userClubId &&
      trophies.some((t) => t.includes('챔피언스리그 우승'))
    ) {
      reasonParts.unshift('유럽 정상 핵심 주역');
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

