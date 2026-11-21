import { describe, expect, it } from 'vitest';
import { evaluateManagerPlayerSynergy } from '../data/managerTraits';
import { computeMatchesOnlyAnalytics } from '../engine/analyticsEngine';
import { computeGlobalSeasonAwards } from '../engine/awardsEngine';
import {
  applySlotSynergiesToStarters,
  calculateChemistry,
  calculateTeamRatings,
} from '../engine/chemistryEngine';
import { ACTIVE_PLAYERS, getLeagueById } from '../engine/dataLoader';
import { USER_CLUB_ID } from '../engine/matchEngine';
import {
  advanceOtherLeaguesToProgress,
  createOtherLeaguesState,
} from '../engine/otherLeaguesEngine';
import { createInitialStandings } from '../engine/standingsEngine';
import {
  buildExtraTimeCoachBriefing,
  evaluateTacticMatchup,
} from '../engine/tacticEngine';
import type { MatchResult, PlayerSeasonStats } from '../types/league';

function createSeededRng(seed = 2027): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

describe('v2.7 Stage 1 Core Engine: Synergy OVR, Strict League Points, Concrete 5-League Sim & Fair Global Awards', () => {
  it('computes per-player slotSynergies (+0..+3) from manager & adjacent teammates and reflects them in ratings', () => {
    const arsenalStarters = [
      ACTIVE_PLAYERS.find((p) => p.name === '다비드 라야')!,
      ACTIVE_PLAYERS.find((p) => p.mainPositions.includes('LB') && p.club.includes('아스널')) ??
        ACTIVE_PLAYERS.find((p) => p.mainPositions.includes('LB'))!,
      ACTIVE_PLAYERS.find((p) => p.name === '윌리엄 살리바')!,
      ACTIVE_PLAYERS.find((p) => p.name === '가브리엘 마갈량이스') ??
        ACTIVE_PLAYERS.find((p) => p.mainPositions.includes('CB') && p.name !== '윌리엄 살리바')!,
      ACTIVE_PLAYERS.find((p) => p.mainPositions.includes('RB') && p.club.includes('아스널')) ??
        ACTIVE_PLAYERS.find((p) => p.mainPositions.includes('RB'))!,
      ACTIVE_PLAYERS.find((p) => p.name === '데클런 라이스')!,
      ACTIVE_PLAYERS.find((p) => p.name === '마르틴 외데고르') ??
        ACTIVE_PLAYERS.find((p) => p.mainPositions.includes('CM'))!,
      ACTIVE_PLAYERS.find((p) => p.mainPositions.includes('CM') && p.name !== '데클런 라이스')!,
      ACTIVE_PLAYERS.find((p) => p.mainPositions.includes('LW'))!,
      ACTIVE_PLAYERS.find((p) => p.mainPositions.includes('ST'))!,
      ACTIVE_PLAYERS.find((p) => p.name === '부카요 사카')!,
    ];

    const chem = calculateChemistry(
      '4-3-3',
      arsenalStarters,
      'possession',
      'tiki_taka',
    );
    const boosted = Object.values(chem.slotSynergies).filter(
      (s) => s.totalBonus > 0,
    );
    expect(boosted.length).toBeGreaterThanOrEqual(4);
    for (const s of Object.values(chem.slotSynergies)) {
      expect(s.totalBonus).toBeGreaterThanOrEqual(0);
      expect(s.totalBonus).toBeLessThanOrEqual(3);
      expect(s.effectiveOvrWithSynergy).toBe(
        Math.min(99, s.baseEffectiveOvr + s.totalBonus),
      );
    }

    // Manager synergy utility matches tiki_taka playmakers/inverted wingers
    const sakaMatch = evaluateManagerPlayerSynergy(
      arsenalStarters[10],
      'tiki_taka',
    );
    expect(sakaMatch.isMatch).toBe(true);
    expect(sakaMatch.bonus).toBe(1);

    // applySlotSynergiesToStarters propagates exact bonus to player stats
    const boostedPlayers = applySlotSynergiesToStarters(
      arsenalStarters,
      chem.slotSynergies,
    );
    const salibaIdx = 2;
    expect(boostedPlayers[salibaIdx].ovr).toBe(
      Math.min(
        99,
        arsenalStarters[salibaIdx].ovr + chem.slotSynergies[salibaIdx].totalBonus,
      ),
    );

    const ratings = calculateTeamRatings(
      '4-3-3',
      arsenalStarters,
      chem.total,
      'tiki_taka',
      chem.slotSynergies,
    );
    expect(ratings.synergyOvrBonus).toBeGreaterThan(0);
  });

  it('strictly separates regular league points from cup/UCL/combined analytics', () => {
    const epl = getLeagueById('epl');
    const dummyMatches: MatchResult[] = Array.from({ length: 10 }, (_, i) => ({
      fixtureId: `m-${i}`,
      round: i + 1,
      homeTeamId: USER_CLUB_ID,
      awayTeamId: epl.clubs[0].id,
      homeGoals: 2,
      awayGoals: 0,
      homeXg: 1.8,
      awayXg: 0.6,
      homePossession: 56,
      homeShots: 14,
      awayShots: 6,
      homeShotsOnTarget: 6,
      awayShotsOnTarget: 2,
      homeTactic: 'possession',
      awayTactic: 'balanced',
      homeFormation: '4-3-3',
      awayFormation: '4-3-3',
      homeTacticBonus: 1,
      awayTacticBonus: -1,
      events: [],
      playerRatings: [],
      momPlayerId: 'p1',
      momPlayerName: 'Player 1',
      momRating: 8.5,
    }));

    const cupAnalytics = computeMatchesOnlyAnalytics({
      matches: dummyMatches,
      clubs: epl.clubs,
      competitionScope: 'cup',
      rankLabel: '우승',
    });
    expect(cupAnalytics.points).toBe(0);
    expect(cupAnalytics.winRatePct).toBe(100);

    const combinedAnalytics = computeMatchesOnlyAnalytics({
      matches: dummyMatches,
      clubs: epl.clubs,
      competitionScope: 'combined',
      leaguePoints: 78,
    });
    // Must show pure leaguePoints (78), NOT 10 wins * 3 = 30!
    expect(combinedAnalytics.points).toBe(78);
    expect(combinedAnalytics.leaguePoints).toBe(78);
    expect(combinedAnalytics.winRatePct).toBe(100);
  });

  it('simulates concrete rosters, player stats, and 16-team Domestic Cups for all 4 other Big-5 leagues and runs 100% fair Ballon dOr/World XI', () => {
    const rng = createSeededRng(2027);
    const otherInit = createOtherLeaguesState('epl', undefined, rng);
    const otherFinal = advanceOtherLeaguesToProgress(otherInit, 38, 38, rng);

    for (const lid of ['laliga', 'seriea', 'bundesliga', 'ligue1'] as const) {
      const bg = otherFinal[lid]!;
      expect(bg.aiRosters).toBeDefined();
      expect(Object.keys(bg.aiRosters ?? {}).length).toBe(bg.clubs.length);
      expect(bg.playerStats).toBeDefined();
      const statEntries = Object.values(bg.playerStats ?? {}).filter(
        (s) => s.appearances > 0,
      );
      expect(statEntries.length).toBeGreaterThan(150);
      expect(statEntries.some((s) => s.goals >= 10)).toBe(true);
      expect(bg.cup?.completed).toBe(true);
      expect(bg.cup?.championTeamId).toBeTruthy();
      const cupEntries = Object.values(bg.cupPlayerStats ?? {}).filter(
        (s) => s.appearances > 0,
      );
      expect(cupEntries.length).toBeGreaterThan(50);
    }

    // Even if user league has empty stats, foreign Big-5 stars populate full Ballon d'Or TOP 5 & World Best XI from real stats!
    const epl = getLeagueById('epl');
    const awards = computeGlobalSeasonAwards({
      allLeaguePlayerStats: {} as Record<string, PlayerSeasonStats>,
      cupPlayerStats: {},
      uclPlayerStats: {},
      leagueStandings: createInitialStandings(epl.clubs),
      cup: null,
      ucl: null,
      otherLeagues: otherFinal,
      userLeagueId: 'epl',
    });

    expect(awards.ballonDorWinner).not.toBeNull();
    expect(awards.ballonDorTop5.length).toBe(5);
    expect(awards.worldBestXi.length).toBe(11);
    expect(awards.ballonDorWinner!.stats.appearances).toBeGreaterThanOrEqual(20);
  });

  it('strengthens tactic matchup matrix and produces actionable Extra Time coach briefings', () => {
    const adv = evaluateTacticMatchup('counter', 'gegenpressing');
    expect(adv.delta).toBe(2.8);
    expect(adv.reason.length).toBeGreaterThan(10);

    const starters = ACTIVE_PLAYERS.slice(0, 11);
    const bench = ACTIVE_PLAYERS.slice(11, 16);
    const briefing = buildExtraTimeCoachBriefing({
      stage: 'et_halftime',
      starters,
      bench,
      formation: '4-3-3',
      oppTactic: 'gegenpressing',
      userAggGoals: 2,
      oppAggGoals: 2,
      staminaByPlayerId: {
        [starters[1].id]: 42,
        [starters[5].id]: 46,
      },
      eventsSoFar: [],
      disabledBenchIds: new Set(),
      subsRemaining: 2,
      managerTraitId: null,
    });

    expect(briefing.exhaustedPlayers.length).toBeGreaterThanOrEqual(1);
    expect(briefing.recommendedPkKickers.length).toBeGreaterThanOrEqual(3);
    expect(briefing.adviceLines.some((l) => l.includes('승부차기'))).toBe(true);
  });
});
