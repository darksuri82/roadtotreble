import type {
  BestXiEntry,
  PlayerSeasonStats,
  SeasonAwards,
  StandingRow,
} from '../types/league';
import type { Position, SubPosition } from '../types/player';

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
        !chosenIds.has(`${x.st.teamId}:${x.st.playerId}`) &&
        x.st.mainPositions.some((mp) => slot.preferredSubs.includes(mp)),
    );
    if (!pick) {
      pick = scoredPool.find(
        (x) =>
          !chosenIds.has(`${x.st.teamId}:${x.st.playerId}`) &&
          x.st.position === slot.broadFallback,
      );
    }
    if (!pick) {
      pick = scoredPool.find(
        (x) => !chosenIds.has(`${x.st.teamId}:${x.st.playerId}`),
      );
    }
    if (pick) {
      chosenIds.add(`${pick.st.teamId}:${pick.st.playerId}`);
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
