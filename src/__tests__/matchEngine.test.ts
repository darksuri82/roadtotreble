import { describe, expect, it } from 'vitest';
import {
  computeSquadPlayerAnalytics,
  computeTeamSeasonAnalytics,
} from '../engine/analyticsEngine';
import { computeSeasonAwards } from '../engine/awardsEngine';
import { calculateChemistry, calculateTeamRatings } from '../engine/chemistryEngine';
import {
  ACTIVE_PLAYERS,
  buildAiClubRoster,
  getLeagueById,
} from '../engine/dataLoader';
import {
  samplePoisson,
  simulateFirstHalf,
  simulateMatch,
  simulateSecondHalf,
  USER_CLUB_ID,
} from '../engine/matchEngine';
import { buildPhase2HandoffState } from '../engine/phase2Bridge';
import {
  applyRoundResults,
  createInitialPlayerStatsMap,
  createInitialStandings,
} from '../engine/standingsEngine';
import { checkTransferWindowTrigger } from '../engine/transferEngine';
import type { Club, Fixture } from '../types/league';

function createSeededRng(seed = 777): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function buildTestStarters() {
  const slots = ['GK', 'LB', 'CB', 'CB', 'RB', 'CDM', 'CM', 'CM', 'LW', 'ST', 'RW'] as const;
  const used = new Set<string>();
  return slots.map((sub) => {
    const p = ACTIVE_PLAYERS.find(
      (x) => !used.has(x.id) && x.mainPositions.includes(sub),
    )!;
    used.add(p.id);
    return p;
  });
}

describe('V4 Poisson Match Engine, Live Broadcast Phases, Awards & Season Analytics', () => {
  it('samples Poisson distribution with mean close to lambda', () => {
    const rng = createSeededRng(12345);
    const lambda = 1.8;
    let sum = 0;
    const trials = 10000;

    for (let i = 0; i < trials; i += 1) {
      sum += samplePoisson(lambda, rng);
    }
    expect(sum / trials).toBeCloseTo(lambda, 1);
  });

  it('simulates 1st half (live phase) -> Halftime -> 2nd half with per-player xG, ratings, and MOM', () => {
    const epl = getLeagueById('epl');
    const starters = buildTestStarters();
    const chem = calculateChemistry('4-3-3', starters, 'possession', 'halftime_wizard');
    const ratings = calculateTeamRatings('4-3-3', starters, chem.total, 'halftime_wizard');

    const userClub: Club = {
      id: USER_CLUB_ID,
      name: '테스트 유나이티드',
      shortName: 'TST',
      primaryColor: '#10b981',
      secondaryColor: '#0f172a',
      formation: '4-3-3',
      defaultTactic: 'possession',
      att: ratings.att,
      mid: ratings.mid,
      def: ratings.def,
      topScorers: ['A', 'B', 'C'],
      isUser: true,
    };
    const aiClub = epl.clubs[0];
    const aiRoster = buildAiClubRoster(aiClub, 'epl');

    const fixture: Fixture = {
      id: 'ht-m1',
      round: 1,
      homeTeamId: USER_CLUB_ID,
      awayTeamId: aiClub.id,
      played: false,
    };

    const rng = createSeededRng(4242);
    const ht = simulateFirstHalf({
      fixture,
      homeClub: userClub,
      awayClub: aiClub,
      homeRoster: starters,
      awayRoster: aiRoster,
      userContext: {
        userClubId: USER_CLUB_ID,
        starters,
        formation: '4-3-3',
        tactic: 'possession',
        chemistry: chem.total,
        ratings,
        managerTraitId: 'halftime_wizard',
      },
      rng,
    });

    expect(ht.phase).toBe('first_half');
    expect(ht.tacticalHint.length).toBeGreaterThan(10);
    expect(ht.homeXg).toBeGreaterThan(0);

    const full = simulateSecondHalf({
      halftime: ht,
      homeClub: userClub,
      awayClub: aiClub,
      homeRoster: starters,
      awayRoster: aiRoster,
      userContext: {
        userClubId: USER_CLUB_ID,
        starters,
        formation: '4-2-3-1',
        tactic: 'gegenpressing',
        chemistry: chem.total,
        ratings,
        managerTraitId: 'halftime_wizard',
      },
      rng,
    });

    expect(full.halftimeAdjusted).toBe(true);
    expect(full.homeXg).toBeGreaterThanOrEqual(ht.homeXg);
    expect(full.homeShotsOnTarget).toBeLessThanOrEqual(full.homeShots);
    expect(full.playerRatings.length).toBe(22);
    expect(full.playerRatings.some((r) => r.xg > 0)).toBe(true);
    expect(full.momPlayerName.length).toBeGreaterThan(0);
  });

  it('tracks disambiguated user vs AI stats, computes Best XI + POTY + Post-Season Team & 16-Player Analytics', () => {
    expect(checkTransferWindowTrigger(10, [10, 19, 28], [])).toEqual({
      windowIndex: 1,
      triggerRound: 10,
    });

    const epl = getLeagueById('epl');
    const starters = buildTestStarters();
    const bench = ACTIVE_PLAYERS.slice(40, 45);
    const userClub: Club = {
      id: USER_CLUB_ID,
      name: '테스트 유나이티드',
      shortName: 'TST',
      primaryColor: '#10b981',
      secondaryColor: '#0f172a',
      formation: '4-3-3',
      defaultTactic: 'possession',
      att: 88,
      mid: 88,
      def: 88,
      topScorers: ['A', 'B', 'C'],
      isUser: true,
    };

    const clubs = [userClub, ...epl.clubs.slice(0, 19)];
    const clubsById: Record<string, Club> = {};
    const aiRosters: Record<string, typeof starters> = {};
    for (const c of clubs) {
      clubsById[c.id] = c;
      if (c.id !== USER_CLUB_ID) aiRosters[c.id] = buildAiClubRoster(c, 'epl');
    }

    let standings = createInitialStandings(clubs);
    let stats = createInitialPlayerStatsMap({
      clubs,
      userClub,
      userSquad: [...starters, ...bench],
      aiRosters,
    });

    const rng = createSeededRng(909);
    const roundResults = [];
    for (let i = 0; i < 10; i += 1) {
      const hc = clubs[i];
      const ac = clubs[19 - i];
      roundResults.push(
        simulateMatch(
          { id: `r1-m${i}`, round: 1, homeTeamId: hc.id, awayTeamId: ac.id, played: false },
          hc,
          ac,
          hc.id === USER_CLUB_ID ? starters : aiRosters[hc.id],
          ac.id === USER_CLUB_ID ? starters : aiRosters[ac.id],
          undefined,
          rng,
        ),
      );
    }

    const applied = applyRoundResults(standings, roundResults, clubsById, stats, USER_CLUB_ID);
    standings = applied.standings;
    stats = applied.allPlayerStats;

    // Verify user stats are cleanly keyed under user:: and carry club color
    const firstStarterStat = stats[`user::${starters[0].id}`];
    expect(firstStarterStat).toBeDefined();
    expect(firstStarterStat.isUserTeam).toBe(true);
    expect(firstStarterStat.teamPrimaryColor).toBe('#10b981');
    expect(firstStarterStat.starts).toBe(1);

    // Verify Post-Season Analytics Engine
    const userMatches = roundResults.filter(
      (m) => m.homeTeamId === USER_CLUB_ID || m.awayTeamId === USER_CLUB_ID,
    );
    const teamAnalytics = computeTeamSeasonAnalytics({
      standings,
      userMatchHistory: userMatches,
      clubs,
    });
    expect(teamAnalytics.played).toBe(1);
    expect(teamAnalytics.totalXg).toBeGreaterThan(0);

    const squadAnalytics = computeSquadPlayerAnalytics({
      starters,
      bench,
      allPlayerStats: stats,
    });
    expect(squadAnalytics.length).toBe(16);
    expect(squadAnalytics.filter((r) => r.starts === 1).length).toBe(11);

    const awards = computeSeasonAwards(stats, standings, 1);
    expect(awards.bestXi.length).toBe(11);
    expect(awards.poty).not.toBeNull();

    const userRow = standings.find((r) => r.teamId === USER_CLUB_ID)!;
    const others = standings.filter((r) => r.teamId !== USER_CLUB_ID);
    const handoff = buildPhase2HandoffState({
      userClub: {
        name: userClub.name,
        shortName: userClub.shortName,
        primaryColor: userClub.primaryColor,
        secondaryColor: userClub.secondaryColor,
        pattern: 'solid',
      },
      managerTraitId: 'tiki_taka',
      leagueId: 'epl',
      formation: '4-3-3',
      defaultTactic: 'possession',
      starters,
      bench,
      standings: [userRow, ...others],
      clubsInUserLeague: clubs,
      playerStats: stats,
      awards,
    });

    expect(handoff).not.toBeNull();
    expect(handoff!.finalRank).toBe(1);
  });
});
