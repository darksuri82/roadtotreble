import type { Club, Fixture } from '../types/league';

function fisherYatesShuffle<T>(items: T[], rng: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function computeMaxVenueStreak(fixtures: Fixture[], teamIds: string[]): number {
  let worst = 1;
  for (const id of teamIds) {
    const venues = fixtures
      .filter((f) => f.homeTeamId === id || f.awayTeamId === id)
      .sort((a, b) => a.round - b.round)
      .map((f) => (f.homeTeamId === id ? 'H' : 'A'));
    let cur = 1;
    for (let i = 1; i < venues.length; i += 1) {
      if (venues[i] === venues[i - 1]) {
        cur += 1;
        if (cur > worst) worst = cur;
      } else {
        cur = 1;
      }
    }
  }
  return worst;
}

/**
 * Generates a randomized, balanced Home/Away Double Round-Robin schedule
 * (38R for 20 teams, 34R for 18 teams) using the Circle Method + Fisher-Yates shuffling:
 * 1) Shuffles participating clubs before pairing
 * 2) Shuffles first-half round order
 * 3) Randomly flips initial Home/Away polarity and balances consecutive H/A streaks (<= 3)
 * 4) Mirrors the first half into the second half with reversed Home/Away
 */
export function generateDoubleRoundRobin(
  clubs: Club[],
  rng: () => number = Math.random,
): Fixture[] {
  const n = clubs.length;
  if (n < 2 || n % 2 !== 0) {
    throw new Error(
      `Double round-robin requires an even number of clubs >= 2, got ${n}`,
    );
  }

  // 1) Fisher-Yates shuffle club order so opponent sequence differs every season
  const shuffledTeamIds = fisherYatesShuffle(
    clubs.map((c) => c.id),
    rng,
  );
  const halfRounds = n - 1;

  // Build unordered round pairings via Circle Method
  const rawRounds: [string, string][][] = [];
  const rotating = [...shuffledTeamIds];

  for (let roundIdx = 0; roundIdx < halfRounds; roundIdx += 1) {
    const roundPairs: [string, string][] = [];
    for (let matchIdx = 0; matchIdx < n / 2; matchIdx += 1) {
      const t1 = rotating[matchIdx];
      const t2 = rotating[n - 1 - matchIdx];
      roundPairs.push([t1, t2]);
    }
    rawRounds.push(roundPairs);

    // Rotate elements 1..n-1 clockwise
    const last = rotating.pop()!;
    rotating.splice(1, 0, last);
  }

  const buildCandidateSchedule = (): Fixture[] => {
    // 2) Fisher-Yates shuffle the first-half round order
    const shuffledRounds = fisherYatesShuffle(rawRounds, rng);

    // 3) Random initial Home/Away polarity + streak-aware Home/Away balancing
    const initialFlip = rng() < 0.5 ? 1 : 0;
    const lastVenue = new Map<string, 'H' | 'A'>();
    const streakLen = new Map<string, number>();
    const homeCount = new Map<string, number>();
    const awayCount = new Map<string, number>();
    const firstRoundVenue = new Map<string, 'H' | 'A'>();

    const scoreOrientation = (
      homeId: string,
      awayId: string,
      roundIdx: number,
    ): number => {
      const hStreak =
        lastVenue.get(homeId) === 'H' ? (streakLen.get(homeId) ?? 0) : 0;
      const aStreak =
        lastVenue.get(awayId) === 'A' ? (streakLen.get(awayId) ?? 0) : 0;
      const hDiff = (homeCount.get(homeId) ?? 0) - (awayCount.get(homeId) ?? 0);
      const aDiff = (awayCount.get(awayId) ?? 0) - (homeCount.get(awayId) ?? 0);

      let penalty =
        (hStreak >= 2 ? 5000 * hStreak : hStreak * 80) +
        (aStreak >= 2 ? 5000 * aStreak : aStreak * 80) +
        Math.max(0, hDiff) * 5 +
        Math.max(0, aDiff) * 5;

      // Avoid extending a streak across the 1st-half -> 2nd-half wrap boundary
      if (roundIdx === halfRounds - 1) {
        // Round `halfRounds + 1` has reversed Round 1 venue
        const r20HomeVenue = firstRoundVenue.get(homeId) === 'H' ? 'A' : 'H';
        const r20AwayVenue = firstRoundVenue.get(awayId) === 'H' ? 'A' : 'H';
        if (r20HomeVenue === 'H') penalty += (hStreak + 1) * 140;
        if (r20AwayVenue === 'A') penalty += (aStreak + 1) * 140;
      }

      return penalty;
    };

    const recordVenue = (
      teamId: string,
      venue: 'H' | 'A',
      roundIdx: number,
    ) => {
      if (roundIdx === 0) firstRoundVenue.set(teamId, venue);
      if (lastVenue.get(teamId) === venue) {
        streakLen.set(teamId, (streakLen.get(teamId) ?? 0) + 1);
      } else {
        lastVenue.set(teamId, venue);
        streakLen.set(teamId, 1);
      }
      if (venue === 'H') {
        homeCount.set(teamId, (homeCount.get(teamId) ?? 0) + 1);
      } else {
        awayCount.set(teamId, (awayCount.get(teamId) ?? 0) + 1);
      }
    };

    const firstHalfFixtures: Fixture[] = [];

    for (let roundIdx = 0; roundIdx < halfRounds; roundIdx += 1) {
      const roundNumber = roundIdx + 1;
      const pairs = fisherYatesShuffle(shuffledRounds[roundIdx], rng);

      for (let matchIdx = 0; matchIdx < pairs.length; matchIdx += 1) {
        const [t1, t2] = pairs[matchIdx];
        const score12 = scoreOrientation(t1, t2, roundIdx);
        const score21 = scoreOrientation(t2, t1, roundIdx);

        let homeTeamId: string;
        let awayTeamId: string;

        if (score12 < score21) {
          homeTeamId = t1;
          awayTeamId = t2;
        } else if (score21 < score12) {
          homeTeamId = t2;
          awayTeamId = t1;
        } else {
          const swap = (roundIdx + matchIdx + initialFlip) % 2 === 1;
          homeTeamId = swap ? t2 : t1;
          awayTeamId = swap ? t1 : t2;
        }

        recordVenue(homeTeamId, 'H', roundIdx);
        recordVenue(awayTeamId, 'A', roundIdx);

        firstHalfFixtures.push({
          id: `r${roundNumber}-m${matchIdx + 1}`,
          round: roundNumber,
          homeTeamId,
          awayTeamId,
          played: false,
        });
      }
    }

    // 4) Second half: exact mirror with reversed Home and Away
    const secondHalfFixtures: Fixture[] = firstHalfFixtures.map((f, idx) => {
      const secondRound = f.round + halfRounds;
      const matchNumber = (idx % (n / 2)) + 1;
      return {
        id: `r${secondRound}-m${matchNumber}`,
        round: secondRound,
        homeTeamId: f.awayTeamId,
        awayTeamId: f.homeTeamId,
        played: false,
      };
    });

    return [...firstHalfFixtures, ...secondHalfFixtures];
  };

  let bestFixtures = buildCandidateSchedule();
  let bestMaxStreak = computeMaxVenueStreak(bestFixtures, shuffledTeamIds);

  for (let attempt = 0; attempt < 16 && bestMaxStreak > 3; attempt += 1) {
    const candidate = buildCandidateSchedule();
    const maxStreak = computeMaxVenueStreak(candidate, shuffledTeamIds);
    if (maxStreak < bestMaxStreak) {
      bestFixtures = candidate;
      bestMaxStreak = maxStreak;
    }
  }

  return bestFixtures;
}
