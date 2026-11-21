import type { RouletteReelResult } from '../types/game';
import type { Club, LeagueId } from '../types/league';
import type { Player, Position, SubPosition } from '../types/player';
import {
  ACTIVE_PLAYERS,
  ALL_CLUBS_WITH_LEAGUE,
  generateClubRotationPlayer,
  LEGEND_PLAYERS,
} from './dataLoader';
import { isCompatibleSubPosition } from './positionEngine';

export const DEFAULT_ROULETTE_LEGEND_RATE = 0.025; // 2.5% per reel
export const TOP4_TRANSFER_LEGEND_RATE = 0.04; // 4.0% per reel when Top 4
export const CANDIDATES_PER_REEL = 3; // 2-3 candidates per club/legend slot

export interface SpinRouletteOptions {
  reelCount?: number;
  candidatesPerReel?: number;
  legendRate?: number;
  allowedLeagueIds?: LeagueId[];
  rng?: () => number;
  activePool?: Player[];
  legendPool?: Player[];
}

function shuffleWithRng<T>(items: T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickRandom<T>(items: T[], rng: () => number): T {
  return items[Math.floor(rng() * items.length)];
}

function pickLegendsForSlot(
  targetSub: SubPosition,
  targetBroad: Position,
  excludeIds: Set<string>,
  legendPool: Player[],
  count: number,
  rng: () => number,
): Player[] {
  const unused = legendPool.filter((p) => !excludeIds.has(p.id));
  if (unused.length === 0) return [];

  const picked: Player[] = [];
  const usedLocal = new Set<string>();

  const addFromBucket = (bucket: Player[]) => {
    for (const p of shuffleWithRng(bucket, rng)) {
      if (picked.length >= count) break;
      if (usedLocal.has(p.id)) continue;
      usedLocal.add(p.id);
      picked.push(p);
    }
  };

  // Priority 1: Exact mainPositions match
  addFromBucket(unused.filter((p) => p.mainPositions.includes(targetSub)));

  // Priority 2: Secondary position or compatible pair match
  addFromBucket(
    unused.filter(
      (p) =>
        p.secondaryPositions.includes(targetSub) ||
        p.mainPositions.some((mp) => isCompatibleSubPosition(mp, targetSub)),
    ),
  );

  // Priority 3: Same broad position line
  addFromBucket(unused.filter((p) => p.position === targetBroad));

  // Priority 4: Any remaining Legend
  addFromBucket(unused);

  return picked;
}

function compareByOvrDesc(a: Player, b: Player): number {
  if (b.ovr !== a.ovr) return b.ovr - a.ovr;
  return b.att + b.mid + b.def - (a.att + a.mid + a.def);
}

export function pickClubCandidatesForSlot(params: {
  club: Club;
  leagueId: LeagueId;
  targetSub: SubPosition;
  targetBroad: Position;
  excludeIds: Set<string>;
  activePool: Player[];
  count: number;
  rng: () => number;
}): Player[] {
  const {
    club,
    leagueId,
    targetSub,
    targetBroad,
    excludeIds,
    activePool,
    count,
    rng,
  } = params;

  const clubUnused = activePool.filter(
    (p) => p.club === club.name && !excludeIds.has(p.id),
  );

  const picked: Player[] = [];
  const usedLocalIds = new Set<string>();
  const usedLocalNames = new Set<string>();

  const addFromBucket = (bucket: Player[]) => {
    const sorted = [...bucket].sort(compareByOvrDesc);
    for (const p of sorted) {
      if (picked.length >= count) break;
      if (usedLocalIds.has(p.id)) continue;
      usedLocalIds.add(p.id);
      usedLocalNames.add(p.name);
      picked.push(p);
    }
  };

  // Priority 1: Exact mainPositions match — strictly Top OVR first
  addFromBucket(clubUnused.filter((p) => p.mainPositions.includes(targetSub)));

  // Priority 2: Secondary or compatible pair match — strictly Top OVR first
  addFromBucket(
    clubUnused.filter(
      (p) =>
        p.secondaryPositions.includes(targetSub) ||
        p.mainPositions.some((mp) => isCompatibleSubPosition(mp, targetSub)),
    ),
  );

  // Priority 3: Same broad position line — strictly Top OVR first
  addFromBucket(clubUnused.filter((p) => p.position === targetBroad));

  // Fill remaining slots up to `count` (always guaranteeing 2..3 options per club)
  let fallbackIdx = 0;
  while (picked.length < count) {
    fallbackIdx += 1;
    const gen = generateClubRotationPlayer({
      club,
      leagueId,
      subPosition: targetSub,
      excludeNames: usedLocalNames,
      rng,
    });
    // Guarantee distinct ID even under deterministic RNG
    const uniqueGen: Player = usedLocalIds.has(gen.id)
      ? { ...gen, id: `${gen.id}-${fallbackIdx}` }
      : gen;
    usedLocalIds.add(uniqueGen.id);
    usedLocalNames.add(uniqueGen.name);
    picked.push(uniqueGen);
  }

  // Sort candidates within each club by OVR descending for clean visual comparison
  picked.sort(compareByOvrDesc);
  return picked;
}

/**
 * Multi-Candidate 3-Club Roulette + Rare Legend Special Slot Engine:
 * - Each of the 3 reels independently rolls Legend (2.5% base, 4.0% Top-4 transfer) vs Random Club (97.5% / 96.0%).
 * - No duplicate clubs across the 3 reels.
 * - Each rolled club presents 2-3 position-compatible players (`candidates: Player[]`).
 * - When a golden [LEGEND] slot hits, exactly 1 position-matched Legend is presented for maximum rarity and impact.
 * - No duplicate already-owned players (`excludeIds`) or duplicates across reels.
 * - Automatically generates realistic club-affiliated rotation players (club rating +/- 3) when needed
 *   so every club always provides 2-3 valid choices with 0 empty cards.
 */
export function spinClubRoulette(
  targetSubPosition: SubPosition,
  targetBroadPosition: Position,
  excludeIds: Set<string>,
  options: SpinRouletteOptions = {},
): RouletteReelResult[] {
  const {
    reelCount = 3,
    candidatesPerReel = CANDIDATES_PER_REEL,
    legendRate = DEFAULT_ROULETTE_LEGEND_RATE,
    allowedLeagueIds,
    rng = Math.random,
    activePool = ACTIVE_PLAYERS,
    legendPool = LEGEND_PLAYERS,
  } = options;

  const allowedSet =
    allowedLeagueIds && allowedLeagueIds.length > 0
      ? new Set<LeagueId>(allowedLeagueIds)
      : null;
  const leagueFilteredClubs = allowedSet
    ? ALL_CLUBS_WITH_LEAGUE.filter((entry) => allowedSet.has(entry.leagueId))
    : ALL_CLUBS_WITH_LEAGUE;
  const clubPool =
    leagueFilteredClubs.length >= reelCount
      ? leagueFilteredClubs
      : ALL_CLUBS_WITH_LEAGUE;

  const pickedPlayerIds = new Set<string>(excludeIds);
  const pickedClubIds = new Set<string>();
  const results: RouletteReelResult[] = [];

  for (let reelIndex = 0; reelIndex < reelCount; reelIndex += 1) {
    const rolledLegend = rng() < legendRate;

    if (rolledLegend) {
      const legends = pickLegendsForSlot(
        targetSubPosition,
        targetBroadPosition,
        pickedPlayerIds,
        legendPool,
        1,
        rng,
      );
      if (legends.length > 0) {
        legends.forEach((p) => pickedPlayerIds.add(p.id));
        results.push({
          reelIndex,
          isLegendSlot: true,
          club: null,
          leagueId: 'LEGEND',
          candidates: legends,
        });
        continue;
      }
    }

    // Pick a unique club from the allowed European leagues pool
    const availableClubs = clubPool.filter(
      (entry) => !pickedClubIds.has(entry.club.id),
    );
    const chosenEntry = pickRandom(availableClubs, rng);
    pickedClubIds.add(chosenEntry.club.id);

    const candidates = pickClubCandidatesForSlot({
      club: chosenEntry.club,
      leagueId: chosenEntry.leagueId,
      targetSub: targetSubPosition,
      targetBroad: targetBroadPosition,
      excludeIds: pickedPlayerIds,
      activePool,
      count: candidatesPerReel,
      rng,
    });

    candidates.forEach((p) => pickedPlayerIds.add(p.id));
    results.push({
      reelIndex,
      isLegendSlot: false,
      club: chosenEntry.club,
      leagueId: chosenEntry.leagueId,
      candidates,
    });
  }

  return results;
}
