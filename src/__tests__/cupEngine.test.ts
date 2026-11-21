import { describe, expect, it } from 'vitest';
import {
  advanceCupStage,
  checkCupStageTrigger,
  createDomesticCupState,
  CUP_META_BY_LEAGUE,
  CUP_STAGE_ORDER,
  getUserCupResultLabel,
} from '../engine/cupEngine';
import { buildAiClubRoster, getLeagueById } from '../engine/dataLoader';
import {
  simulateExtraTimeAndPenalties,
  simulatePenaltyShootoutOnly,
  USER_CLUB_ID,
} from '../engine/matchEngine';
import type { Club, LeagueId, MatchResult } from '../types/league';
import type { Player } from '../types/player';

function makeSeededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

describe('Domestic Cup Engine & Extra Time / Penalty Shootout', () => {
  it('maps all 5 European leagues to their exact domestic cup names and trigger rounds', () => {
    const expected: Record<LeagueId, { name: string; triggers: number[] }> = {
      epl: { name: 'FA Cup', triggers: [8, 16, 24, 32] },
      laliga: { name: 'Copa del Rey', triggers: [8, 16, 24, 32] },
      seriea: { name: 'Coppa Italia', triggers: [8, 16, 24, 32] },
      bundesliga: { name: 'DFB-Pokal', triggers: [7, 14, 22, 29] },
      ligue1: { name: 'Coupe de France', triggers: [7, 14, 22, 29] },
    };

    for (const leagueId of Object.keys(expected) as LeagueId[]) {
      const league = getLeagueById(leagueId);
      const clubs: Club[] = league.clubs.map((c, idx) =>
        idx === league.clubs.length - 1 ? { ...c, id: USER_CLUB_ID, isUser: true } : c,
      );
      const cup = createDomesticCupState(
        leagueId,
        clubs,
        league.totalRounds,
        makeSeededRng(42),
      );
      expect(CUP_META_BY_LEAGUE[leagueId].name).toBe(expected[leagueId].name);
      expect(cup.meta.name).toBe(expected[leagueId].name);
      expect(cup.triggerRounds).toEqual(expected[leagueId].triggers);
      expect(cup.participantIds).toHaveLength(16);
      expect(cup.participantIds).toContain(USER_CLUB_ID);
      expect(cup.rounds.r16).toHaveLength(8);
    }
  });

  it('runs a full 16-team single-leg tournament R16 -> QF -> SF -> Final and crowns a champion', () => {
    const rng = makeSeededRng(1001);
    const league = getLeagueById('epl');
    const clubs: Club[] = league.clubs.map((c, idx) =>
      idx === league.clubs.length - 1 ? { ...c, id: USER_CLUB_ID, isUser: true } : c,
    );
    const clubsById = Object.fromEntries(clubs.map((c) => [c.id, c]));
    const aiRosters: Record<string, Player[]> = {};
    for (const c of clubs) {
      aiRosters[c.id] = buildAiClubRoster(c, 'epl');
    }

    let cup = createDomesticCupState('epl', clubs, league.totalRounds, rng);
    let cupStats = {};

    expect(checkCupStageTrigger(cup, 7)).toBeNull();
    expect(checkCupStageTrigger(cup, 8)).toBe('r16');

    for (const stage of CUP_STAGE_ORDER) {
      const res = advanceCupStage({
        cup,
        stage,
        clubsById,
        aiRosters,
        cupPlayerStats: cupStats,
        rng,
      });
      cup = res.cup;
      cupStats = res.cupPlayerStats;
    }

    expect(cup.completed).toBe(true);
    expect(cup.championTeamId).toBeTruthy();
    expect(cup.rounds.r16).toHaveLength(8);
    expect(cup.rounds.qf).toHaveLength(4);
    expect(cup.rounds.sf).toHaveLength(2);
    expect(cup.rounds.final).toHaveLength(1);
    expect(cup.rounds.final[0].winnerId).toBe(cup.championTeamId);
    expect(Object.keys(cupStats).length).toBeGreaterThan(20);
    expect(['우승', '준우승', '4강', '8강', '16강']).toContain(
      getUserCupResultLabel(cup, USER_CLUB_ID),
    );
  });

  it('always resolves 90-min draws via Extra Time and/or Penalty Shootout with a strict winner', () => {
    const rng = makeSeededRng(777);
    const league = getLeagueById('laliga');
    const homeClub = league.clubs[0];
    const awayClub = league.clubs[1];
    const homeRoster = buildAiClubRoster(homeClub, 'laliga');
    const awayRoster = buildAiClubRoster(awayClub, 'laliga');

    const tiedBase: MatchResult = {
      fixtureId: 'cup-test-1',
      round: 1,
      homeTeamId: homeClub.id,
      awayTeamId: awayClub.id,
      homeGoals: 1,
      awayGoals: 1,
      homeGoals90: 1,
      awayGoals90: 1,
      homeXg: 1.2,
      awayXg: 1.1,
      homePossession: 52,
      homeShots: 11,
      awayShots: 10,
      homeShotsOnTarget: 4,
      awayShotsOnTarget: 4,
      homeTactic: 'possession',
      awayTactic: 'counter',
      homeFormation: '4-3-3',
      awayFormation: '4-4-2',
      homeTacticBonus: 0,
      awayTacticBonus: 0,
      events: [],
      playerRatings: [],
      momPlayerId: '',
      momPlayerName: '',
      momRating: 7.0,
    };

    const resolved = simulateExtraTimeAndPenalties({
      baseResult: tiedBase,
      homeClub,
      awayClub,
      homeRoster,
      awayRoster,
      rng,
    });

    expect(resolved.extraTime).toBeDefined();
    expect([homeClub.id, awayClub.id]).toContain(resolved.extraTime!.winnerTeamId);
    if (resolved.homeGoals === resolved.awayGoals) {
      expect(resolved.extraTime!.penalties).toBeDefined();
      expect(resolved.extraTime!.penalties!.homePenGoals).not.toBe(
        resolved.extraTime!.penalties!.awayPenGoals,
      );
    }

    const pkOnly = simulatePenaltyShootoutOnly({
      homeClub,
      awayClub,
      homeRoster,
      awayRoster,
      rng,
    });
    expect(pkOnly.kicks.length).toBeGreaterThanOrEqual(6);
    expect(pkOnly.homePenGoals).not.toBe(pkOnly.awayPenGoals);
    expect([homeClub.id, awayClub.id]).toContain(pkOnly.winnerTeamId);
  });
});
