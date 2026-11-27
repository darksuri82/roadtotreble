import { describe, expect, it } from 'vitest';
import { ACTIVE_PLAYERS, getLeagueById, LEGEND_PLAYERS } from '../engine/dataLoader';
import { createInitialStandings } from '../engine/standingsEngine';
import {
  evaluateTransferTarget,
  spinTransferClubs,
} from '../engine/transferEngine';
import type { PlayerSeasonStats } from '../types/league';

function createSeededRng(seed = 7): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

describe('V5 Dynamic Form Transfer Market Engine', () => {
  it('draws 3 unique clubs with 8-16 player squads (top-3 OVR per position) or 1-player Legend FA slot', () => {
    const epl = getLeagueById('epl');
    const standings = createInitialStandings(epl.clubs);

    const offers = spinTransferClubs({
      currentRound: 12,
      totalRounds: 38,
      windowIndex: 1,
      userLeagueId: 'epl',
      userRank: 3,
      standings,
      allPlayerStats: {},
      aiRosters: {},
      ownedIds: new Set<string>(),
      legendBonusActive: true,
      rng: createSeededRng(123),
    });

    expect(offers.length).toBe(3);
    const seenClubIds = new Set<string>();
    for (const offer of offers) {
      if (offer.isLegendSlot) {
        expect(offer.squad.length).toBe(1);
        expect(offer.squad[0].player.isLegend).toBe(true);
      } else {
        expect(offer.club).not.toBeNull();
        expect(seenClubIds.has(offer.club!.id)).toBe(false);
        seenClubIds.add(offer.club!.id);
        expect(offer.squad.length).toBeGreaterThanOrEqual(8);
        expect(offer.squad.length).toBeLessThanOrEqual(16);
      }
    }
  });

  it('adjusts market value and signing probability dynamically based on season form and user rank', () => {
    const epl = getLeagueById('epl');
    const club = epl.clubs[2];
    const sampleFwd = ACTIVE_PLAYERS.find(
      (p) => p.position === 'FW' && p.ovr >= 82 && p.ovr <= 85,
    )!;

    const hotStats: PlayerSeasonStats = {
      playerId: sampleFwd.id,
      playerName: sampleFwd.name,
      teamId: club.id,
      teamName: club.name,
      teamShortName: club.shortName,
      teamPrimaryColor: club.primaryColor,
      teamSecondaryColor: club.secondaryColor,
      isUserTeam: false,
      position: sampleFwd.position,
      mainPositions: sampleFwd.mainPositions,
      ovr: sampleFwd.ovr,
      appearances: 14,
      starts: 14,
      subAppearances: 0,
      minutesPlayed: 1260,
      goals: 15,
      assists: 6,
      xgSum: 11.2,
      cleanSheets: 0,
      momCount: 5,
      ratingSum: 112.0,
      avgRating: 8.0,
      positionCounts: { ST: 14 },
      isLegend: false,
    };

    const slumpStats: PlayerSeasonStats = {
      ...hotStats,
      goals: 1,
      assists: 0,
      momCount: 0,
      ratingSum: 86.8,
      avgRating: 6.2,
    };

    const hotEval = evaluateTransferTarget({
      player: sampleFwd,
      club,
      leagueId: 'epl',
      clubRank: 5,
      leagueSize: 20,
      currentRound: 14,
      totalRounds: 38,
      windowIndex: 1,
      userRank: 4,
      userLeagueSize: 20,
      realStats: hotStats,
    });

    const slumpEval = evaluateTransferTarget({
      player: sampleFwd,
      club,
      leagueId: 'epl',
      clubRank: 5,
      leagueSize: 20,
      currentRound: 14,
      totalRounds: 38,
      windowIndex: 1,
      userRank: 4,
      userLeagueSize: 20,
      realStats: slumpStats,
    });

    expect(hotEval.formTrend).toBe('up');
    expect(slumpEval.formTrend).toBe('down');
    expect(hotEval.marketValueM).toBeGreaterThan(slumpEval.marketValueM);
    expect(slumpEval.successChance).toBeGreaterThan(hotEval.successChance);

    // User club rank prestige effect (Rank 1 vs Rank 18)
    const rank1Eval = evaluateTransferTarget({
      player: sampleFwd,
      club,
      leagueId: 'epl',
      clubRank: 8,
      leagueSize: 20,
      currentRound: 14,
      totalRounds: 38,
      windowIndex: 1,
      userRank: 1,
      userLeagueSize: 20,
      realStats: null,
    });
    const rank18Eval = evaluateTransferTarget({
      player: sampleFwd,
      club,
      leagueId: 'epl',
      clubRank: 8,
      leagueSize: 20,
      currentRound: 14,
      totalRounds: 38,
      windowIndex: 1,
      userRank: 18,
      userLeagueSize: 20,
      realStats: null,
    });
    expect(rank1Eval.successChance).toBeGreaterThan(rank18Eval.successChance);
  });

  it('keeps signing probabilities in realistic tier ranges (rotation > key > worldclass > superstar/legend)', () => {
    const epl = getLeagueById('epl');
    const midClub = epl.clubs[10];

    const rotation = ACTIVE_PLAYERS.find((p) => p.ovr <= 77)!;
    const keyStarter = ACTIVE_PLAYERS.find((p) => p.ovr === 82)!;
    const worldClass = ACTIVE_PLAYERS.find((p) => p.ovr === 86)!;
    const superstar = ACTIVE_PLAYERS.find((p) => p.ovr >= 90)!;
    const legend = LEGEND_PLAYERS[0];

    const evalOne = (player: typeof rotation, isLeg = false) =>
      evaluateTransferTarget({
        player,
        club: isLeg ? null : midClub,
        leagueId: isLeg ? 'LEGEND' : 'epl',
        clubRank: isLeg ? 1 : 10,
        leagueSize: isLeg ? 1 : 20,
        currentRound: 12,
        totalRounds: 38,
        windowIndex: 1,
        userRank: 6,
        userLeagueSize: 20,
        realStats: null,
      });

    const pRot = evalOne(rotation).successChance;
    const pKey = evalOne(keyStarter).successChance;
    const pWc = evalOne(worldClass).successChance;
    const pSup = evalOne(superstar).successChance;
    const pLeg = evalOne(legend, true).successChance;

    expect(pRot).toBeGreaterThanOrEqual(65);
    expect(pRot).toBeLessThanOrEqual(95);
    expect(pKey).toBeGreaterThanOrEqual(40);
    expect(pKey).toBeLessThanOrEqual(80);
    expect(pWc).toBeGreaterThanOrEqual(20);
    expect(pWc).toBeLessThanOrEqual(55);
    // Superstars retain >=20% floor; v9.10.0 Era Classics sit in the 15..30% range
    expect(pSup).toBeGreaterThanOrEqual(20);
    expect(pSup).toBeLessThanOrEqual(36);
    expect(pLeg).toBeGreaterThanOrEqual(15);
    expect(pLeg).toBeLessThanOrEqual(30);

    // Worst-case stress check: 94 OVR superstar at Rank #1 club vs Rank #20 user club -> still >= 20%
    const worstCaseSup = evaluateTransferTarget({
      player: superstar,
      club: epl.clubs[0],
      leagueId: 'epl',
      clubRank: 1,
      leagueSize: 20,
      currentRound: 12,
      totalRounds: 38,
      windowIndex: 1,
      userRank: 20,
      userLeagueSize: 20,
      realStats: null,
    });
    expect(worstCaseSup.successChance).toBeGreaterThanOrEqual(20);
  });

  it('filters rolled transfer clubs strictly to allowedLeagueIds while preserving Legend FA slot', () => {
    const epl = getLeagueById('epl');
    const standings = createInitialStandings(epl.clubs);
    const rng = createSeededRng(404);

    for (let i = 0; i < 15; i += 1) {
      const offers = spinTransferClubs({
        currentRound: 12,
        totalRounds: 38,
        windowIndex: 1,
        userLeagueId: 'epl',
        userRank: 4,
        standings,
        allPlayerStats: {},
        aiRosters: {},
        ownedIds: new Set<string>(),
        legendBonusActive: true,
        allowedLeagueIds: ['epl', 'seriea'],
        rng,
      });

      expect(offers.length).toBe(3);
      for (const offer of offers) {
        if (!offer.isLegendSlot) {
          expect(['epl', 'seriea']).toContain(offer.leagueId);
        }
      }
    }
  });
});
