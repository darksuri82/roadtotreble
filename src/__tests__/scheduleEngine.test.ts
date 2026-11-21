import { describe, expect, it } from 'vitest';
import { getLeagueById } from '../engine/dataLoader';
import { generateDoubleRoundRobin } from '../engine/scheduleEngine';

describe('Schedule Engine (Double Round-Robin)', () => {
  it('generates a valid 38-round Home/Away schedule for a 20-team league (EPL)', () => {
    const epl = getLeagueById('epl');
    const fixtures = generateDoubleRoundRobin(epl.clubs);

    // 20 teams -> 38 rounds * 10 matches = 380 fixtures
    expect(fixtures.length).toBe(380);

    const rounds = new Set(fixtures.map((f) => f.round));
    expect(rounds.size).toBe(38);

    const pairMeetings = new Map<string, number>();
    const teamHomeCount = new Map<string, number>();
    const teamAwayCount = new Map<string, number>();

    for (const f of fixtures) {
      expect(f.homeTeamId).not.toBe(f.awayTeamId);
      const key = `${f.homeTeamId}__${f.awayTeamId}`;
      pairMeetings.set(key, (pairMeetings.get(key) ?? 0) + 1);
      teamHomeCount.set(f.homeTeamId, (teamHomeCount.get(f.homeTeamId) ?? 0) + 1);
      teamAwayCount.set(f.awayTeamId, (teamAwayCount.get(f.awayTeamId) ?? 0) + 1);
    }

    // Every ordered (home, away) pair occurs exactly once
    expect(pairMeetings.size).toBe(20 * 19);
    for (const count of pairMeetings.values()) {
      expect(count).toBe(1);
    }

    // Every team plays 19 home and 19 away matches
    for (const club of epl.clubs) {
      expect(teamHomeCount.get(club.id)).toBe(19);
      expect(teamAwayCount.get(club.id)).toBe(19);
    }
  });

  it('generates a valid 34-round Home/Away schedule for an 18-team league (Bundesliga)', () => {
    const bun = getLeagueById('bundesliga');
    const fixtures = generateDoubleRoundRobin(bun.clubs);

    // 18 teams -> 34 rounds * 9 matches = 306 fixtures
    expect(fixtures.length).toBe(306);

    const rounds = new Set(fixtures.map((f) => f.round));
    expect(rounds.size).toBe(34);
  });

  it('randomizes opponent order across seasons while preserving 2nd-half H/A mirror and consecutive streak balance', () => {
    const epl = getLeagueById('epl');
    const mkRng = (seed: number) => {
      let s = seed >>> 0;
      return () => {
        s = (1664525 * s + 1013904223) >>> 0;
        return s / 0x100000000;
      };
    };

    const schedA = generateDoubleRoundRobin(epl.clubs, mkRng(11));
    const schedB = generateDoubleRoundRobin(epl.clubs, mkRng(99));

    const sigA = schedA
      .slice(0, 10)
      .map((f) => `${f.homeTeamId}-${f.awayTeamId}`)
      .join('|');
    const sigB = schedB
      .slice(0, 10)
      .map((f) => `${f.homeTeamId}-${f.awayTeamId}`)
      .join('|');
    expect(sigA).not.toBe(sigB);

    // Verify exact 2nd-half mirror (round r + 19 has swapped home/away)
    const half = 19;
    const firstHalf = schedA.filter((f) => f.round <= half);
    const secondHalf = schedA.filter((f) => f.round > half);
    expect(firstHalf.length).toBe(190);
    expect(secondHalf.length).toBe(190);

    for (let i = 0; i < firstHalf.length; i += 1) {
      expect(secondHalf[i].round).toBe(firstHalf[i].round + half);
      expect(secondHalf[i].homeTeamId).toBe(firstHalf[i].awayTeamId);
      expect(secondHalf[i].awayTeamId).toBe(firstHalf[i].homeTeamId);
    }

    // Verify no team suffers an unrealistic 4+ consecutive home/away streak
    for (const club of epl.clubs) {
      const venues = schedA
        .filter((f) => f.homeTeamId === club.id || f.awayTeamId === club.id)
        .sort((a, b) => a.round - b.round)
        .map((f) => (f.homeTeamId === club.id ? 'H' : 'A'));
      let streak = 1;
      let maxStreak = 1;
      for (let i = 1; i < venues.length; i += 1) {
        if (venues[i] === venues[i - 1]) {
          streak += 1;
          if (streak > maxStreak) maxStreak = streak;
        } else {
          streak = 1;
        }
      }
      expect(maxStreak).toBeLessThanOrEqual(3);
    }
  });
});
