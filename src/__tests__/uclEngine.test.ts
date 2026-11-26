import { describe, expect, it } from 'vitest';
import { buildAiClubRoster, getLeagueById } from '../engine/dataLoader';
import { USER_CLUB_ID } from '../engine/matchEngine';
import {
  advanceOtherLeaguesToProgress,
  createOtherLeaguesState,
} from '../engine/otherLeaguesEngine';
import { createInitialStandings } from '../engine/standingsEngine';
import {
  evaluateTransferTarget,
  TRANSFER_ROULETTE_LEGEND_RATE,
} from '../engine/transferEngine';
import {
  createUclTournamentState,
  generateSwissSchedule,
  simulateUclToCompletion,
} from '../engine/uclEngine';
import type { Club } from '../types/league';
import type { Player } from '../types/player';

function makeSeededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

describe('36-Team UEFA Champions League Swiss + Knockout Engine', () => {
  function setupCompletedFiveLeagues(seed: number) {
    const rng = makeSeededRng(seed);
    const epl = getLeagueById('epl');
    const userClub: Club = {
      ...epl.clubs[0],
      id: USER_CLUB_ID,
      name: 'FC 테스트',
      shortName: 'FCT',
      isUser: true,
    };
    const userLeagueClubs = [userClub, ...epl.clubs.slice(1)];
    const userAiRosters: Record<string, Player[]> = {};
    for (const c of userLeagueClubs) {
      if (c.id !== USER_CLUB_ID) {
        userAiRosters[c.id] = buildAiClubRoster(c, 'epl');
      }
    }
    const userSquad = buildAiClubRoster(epl.clubs[0], 'epl');
    const standings = createInitialStandings(userLeagueClubs);
    // Force user to 1st place so Top 4 is guaranteed
    const userIdx = standings.findIndex((r) => r.teamId === USER_CLUB_ID);
    const [uRow] = standings.splice(userIdx, 1);
    uRow.points = 92;
    standings.unshift(uRow);

    const otherLeagues = advanceOtherLeaguesToProgress(
      createOtherLeaguesState('epl'),
      38,
      38,
      rng,
    );

    return {
      userClub,
      userSquad,
      userLeagueClubs,
      userLeagueStandings: standings,
      userAiRosters,
      otherLeagues,
      rng,
    };
  }

  it('builds 36 unique clubs across 4 Pots of 9 (5 league champions in Pot 1) and generates a mathematically valid 8-round Swiss schedule', () => {
    for (const seed of [11, 2026, 9999]) {
      const ctx = setupCompletedFiveLeagues(seed);
      const { ucl } = createUclTournamentState({
        userLeagueId: 'epl',
        ...ctx,
      });

      expect(ucl.teams).toHaveLength(36);
      expect(new Set(ucl.teams.map((t) => t.club.id)).size).toBe(36);

      // 4 Pots of 9 teams each, all 5 league champions in Pot 1
      for (const pot of [1, 2, 3, 4] as const) {
        expect(ucl.teams.filter((t) => t.pot === pot)).toHaveLength(9);
      }
      const champions = ucl.teams.filter((t) => t.isLeagueChampion);
      expect(champions).toHaveLength(5);
      expect(champions.every((c) => c.pot === 1)).toBe(true);

      // Verify Swiss schedule invariants
      const fixtures = generateSwissSchedule(ucl.teams, makeSeededRng(seed + 5));
      expect(fixtures).toHaveLength(144); // 8 rounds * 18 matches

      const potByTeam = new Map(ucl.teams.map((t) => [t.club.id, t.pot]));
      const homeCount = new Map<string, number>();
      const awayCount = new Map<string, number>();
      const opponents = new Map<string, Set<string>>();
      const oppPotCounts = new Map<string, Record<number, number>>();

      for (let r = 1; r <= 8; r += 1) {
        const roundFixes = fixtures.filter((f) => f.round === r);
        expect(roundFixes).toHaveLength(18);
        const seenInRound = new Set<string>();
        for (const f of roundFixes) {
          expect(f.homeTeamId).not.toBe(f.awayTeamId);
          expect(seenInRound.has(f.homeTeamId)).toBe(false);
          expect(seenInRound.has(f.awayTeamId)).toBe(false);
          seenInRound.add(f.homeTeamId);
          seenInRound.add(f.awayTeamId);

          homeCount.set(f.homeTeamId, (homeCount.get(f.homeTeamId) ?? 0) + 1);
          awayCount.set(f.awayTeamId, (awayCount.get(f.awayTeamId) ?? 0) + 1);

          if (!opponents.has(f.homeTeamId)) opponents.set(f.homeTeamId, new Set());
          if (!opponents.has(f.awayTeamId)) opponents.set(f.awayTeamId, new Set());
          opponents.get(f.homeTeamId)!.add(f.awayTeamId);
          opponents.get(f.awayTeamId)!.add(f.homeTeamId);

          const hPot = potByTeam.get(f.homeTeamId)!;
          const aPot = potByTeam.get(f.awayTeamId)!;
          const hMap = oppPotCounts.get(f.homeTeamId) ?? { 1: 0, 2: 0, 3: 0, 4: 0 };
          hMap[aPot] += 1;
          oppPotCounts.set(f.homeTeamId, hMap);

          const aMap = oppPotCounts.get(f.awayTeamId) ?? { 1: 0, 2: 0, 3: 0, 4: 0 };
          aMap[hPot] += 1;
          oppPotCounts.set(f.awayTeamId, aMap);
        }
      }

      for (const t of ucl.teams) {
        const id = t.club.id;
        expect(homeCount.get(id)).toBe(4);
        expect(awayCount.get(id)).toBe(4);
        expect(opponents.get(id)!.size).toBe(8); // 8 strictly unique opponents
        expect(oppPotCounts.get(id)).toEqual({ 1: 2, 2: 2, 3: 2, 4: 2 });
      }
    }
  });

  it('simulates full UCL tournament from Swiss League Phase through Playoff, R16, QF, SF, Final to Champion', () => {
    const ctx = setupCompletedFiveLeagues(555);
    const { ucl, uclPlayerStats } = createUclTournamentState({
      userLeagueId: 'epl',
      ...ctx,
    });

    const completed = simulateUclToCompletion({
      ucl,
      uclPlayerStats,
      rng: makeSeededRng(888),
    });

    expect(completed.ucl.completed).toBe(true);
    expect(completed.ucl.stage).toBe('completed');
    expect(completed.ucl.leaguePhaseRound).toBe(8);
    expect(completed.ucl.userLeaguePhaseRank).toBeGreaterThanOrEqual(1);
    expect(completed.ucl.userLeaguePhaseRank).toBeLessThanOrEqual(36);
    expect(completed.ucl.ties.playoff).toHaveLength(8);
    expect(completed.ucl.ties.r16).toHaveLength(8);
    expect(completed.ucl.ties.qf).toHaveLength(4);
    expect(completed.ucl.ties.sf).toHaveLength(2);
    expect(completed.ucl.ties.final).toHaveLength(1);
    expect(completed.ucl.championTeamId).toBe(completed.ucl.ties.final[0].winnerId);
    expect(Object.keys(completed.uclPlayerStats).length).toBeGreaterThan(200);
  });

  it('applies League Champion Prestige Bonus in UCL Special Transfer Window', () => {
    expect(TRANSFER_ROULETTE_LEGEND_RATE).toBe(0.025);
    const epl = getLeagueById('epl');
    const samplePlayer = buildAiClubRoster(epl.clubs[0], 'epl')[0];
    const normal = evaluateTransferTarget({
      player: samplePlayer,
      club: epl.clubs[0],
      leagueId: 'epl',
      clubRank: 2,
      leagueSize: 20,
      currentRound: 38,
      totalRounds: 38,
      windowIndex: 4,
      userRank: 1,
      userLeagueSize: 20,
      championBonusActive: false,
    });
    const champ = evaluateTransferTarget({
      player: samplePlayer,
      club: epl.clubs[0],
      leagueId: 'epl',
      clubRank: 2,
      leagueSize: 20,
      currentRound: 38,
      totalRounds: 38,
      windowIndex: 4,
      userRank: 1,
      userLeagueSize: 20,
      championBonusActive: true,
    });
    expect(champ.successChance).toBeGreaterThanOrEqual(normal.successChance);
    expect(champ.breakdown.userPrestigeDeltaPct).toBe(
      normal.breakdown.userPrestigeDeltaPct + 5,
    );
  });
});
