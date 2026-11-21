import { describe, expect, it } from 'vitest';
import { calculateChemistry, calculateTeamRatings } from '../engine/chemistryEngine';
import { ACTIVE_PLAYERS, buildAiClubRoster, getLeagueById } from '../engine/dataLoader';
import { optimizeCurrentStartersForFormation } from '../engine/lineupOptimizer';
import {
  computeIndividualRosterImpact,
  simulateFirstHalf,
  simulateSecondHalf,
  USER_CLUB_ID,
} from '../engine/matchEngine';
import {
  buildHalftimeCoachRecommendations,
  evaluatePlaystyleTacticMatchup,
} from '../engine/tacticEngine';
import type { Club, Fixture } from '../types/league';
import type { Player, PlaystyleId } from '../types/player';

function makePlayer(overrides: Partial<Player> & { id: string; name: string }): Player {
  return {
    club: 'Test FC',
    leagueId: 'epl',
    nationality: 'England',
    nationalityCode: 'GB-ENG',
    position: 'MF',
    mainPositions: ['CM'],
    secondaryPositions: ['CDM'],
    ovr: 84,
    att: 80,
    mid: 84,
    def: 76,
    stamina: 82,
    playstyles: ['box_to_box'],
    scoutNote: '테스트 선수',
    isLegend: false,
    ...overrides,
  };
}

function createSeededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe('v2.2 Playstyle-Tactic Matchups, Assistant Coach, Halftime Optimizer & 2D Sim Events', () => {
  it('rewards authentic playstyle counters against each opponent tactic and score state', () => {
    const counterBreakers: Player[] = [
      makePlayer({ id: 'p1', name: 'Creator', playstyles: ['playmaker_10'] }),
      makePlayer({ id: 'p2', name: 'Poacher', position: 'FW', mainPositions: ['ST'], playstyles: ['poacher'] }),
      makePlayer({ id: 'p3', name: 'Crack', position: 'FW', mainPositions: ['LW'], playstyles: ['inverted_winger'] }),
      makePlayer({ id: 'p4', name: 'DLP', playstyles: ['deep_playmaker'] }),
      makePlayer({ id: 'p5', name: 'Target', position: 'FW', mainPositions: ['ST'], playstyles: ['complete_forward'] }),
    ];
    const pressBreakers: Player[] = [
      makePlayer({ id: 'g1', name: 'Breaker1', position: 'FW', mainPositions: ['ST'], playstyles: ['line_breaker'] }),
      makePlayer({ id: 'g2', name: 'Winger', position: 'FW', mainPositions: ['RW'], playstyles: ['classic_winger'] }),
      makePlayer({ id: 'g3', name: 'BPCB', position: 'DF', mainPositions: ['CB'], playstyles: ['ball_playing_cb'] }),
      makePlayer({ id: 'g4', name: 'DLP', playstyles: ['deep_playmaker'] }),
      makePlayer({ id: 'g5', name: 'Breaker2', position: 'FW', mainPositions: ['LW'], playstyles: ['line_breaker'] }),
      makePlayer({ id: 'g6', name: 'SweeperGK', position: 'GK', mainPositions: ['GK'], playstyles: ['sweeper_keeper'] }),
    ];
    const wingDefenders: Player[] = [
      makePlayer({ id: 'w1', name: 'Stopper1', position: 'DF', mainPositions: ['CB'], playstyles: ['stopper_cb'] }),
      makePlayer({ id: 'w2', name: 'Stopper2', position: 'DF', mainPositions: ['CB'], playstyles: ['stopper_cb'] }),
      makePlayer({ id: 'w3', name: 'Keeper', position: 'GK', mainPositions: ['GK'], playstyles: ['shot_stopper'] }),
      makePlayer({ id: 'w4', name: 'Destroyer', playstyles: ['ball_winner'] }),
    ];

    const vsCounter = evaluatePlaystyleTacticMatchup({
      starters: counterBreakers,
      oppTactic: 'counter',
    });
    expect(vsCounter.attBonus).toBeGreaterThan(0.2);
    expect(vsCounter.xgBonus).toBeGreaterThan(0);

    const vsGegen = evaluatePlaystyleTacticMatchup({
      starters: pressBreakers,
      oppTactic: 'gegenpressing',
    });
    expect(vsGegen.attBonus).toBeGreaterThan(0.15);
    expect(vsGegen.midBonus).toBeGreaterThan(0);

    const vsWing = evaluatePlaystyleTacticMatchup({
      starters: wingDefenders,
      oppTactic: 'wingplay',
    });
    expect(vsWing.defBonus).toBeGreaterThan(0.3);
    expect(vsWing.oppXgPenalty).toBeGreaterThan(0);

    // Chasing in 2nd half boosts attacking profiles; leading boosts defensive profiles
    const chasingBoost = evaluatePlaystyleTacticMatchup({
      starters: counterBreakers,
      oppTactic: 'counter',
      scoreDiff: -1,
      isSecondHalf: true,
    });
    expect(chasingBoost.xgBonus).toBeGreaterThanOrEqual(vsCounter.xgBonus);

    const leadingBoost = evaluatePlaystyleTacticMatchup({
      starters: wingDefenders,
      oppTactic: 'wingplay',
      scoreDiff: 1,
      isSecondHalf: true,
    });
    expect(leadingBoost.oppXgPenalty).toBeGreaterThanOrEqual(vsWing.oppXgPenalty);
  });

  it('builds actionable halftime assistant coach recommendations and respects disabled bench IDs', () => {
    const starters: Player[] = [
      makePlayer({ id: 'gk', name: 'GK', position: 'GK', mainPositions: ['GK'], playstyles: ['shot_stopper'] }),
      makePlayer({ id: 'lb', name: 'LB', position: 'DF', mainPositions: ['LB'], playstyles: ['attacking_wingback'] }),
      makePlayer({ id: 'cb1', name: 'CB1', position: 'DF', mainPositions: ['CB'], playstyles: ['stopper_cb'] }),
      makePlayer({ id: 'cb2', name: 'CB2', position: 'DF', mainPositions: ['CB'], playstyles: ['ball_playing_cb'] }),
      makePlayer({ id: 'rb', name: 'RB', position: 'DF', mainPositions: ['RB'], playstyles: ['attacking_wingback'] }),
      makePlayer({ id: 'cm1', name: 'CM1', position: 'MF', mainPositions: ['CM'], playstyles: ['box_to_box'], ovr: 82 }),
      makePlayer({ id: 'cdm', name: 'CDM', position: 'MF', mainPositions: ['CDM'], playstyles: ['ball_winner'] }),
      makePlayer({ id: 'cm2', name: 'CM2', position: 'MF', mainPositions: ['CM'], playstyles: ['playmaker_10'] }),
      makePlayer({ id: 'lw', name: 'TiredLW', position: 'FW', mainPositions: ['LW'], playstyles: ['inverted_winger'], ovr: 83 }),
      makePlayer({ id: 'st', name: 'TiredST', position: 'FW', mainPositions: ['ST'], playstyles: ['poacher'], ovr: 82 }),
      makePlayer({ id: 'rw', name: 'RW', position: 'FW', mainPositions: ['RW'], playstyles: ['classic_winger'] }),
    ];

    const bench: (Player | null)[] = [
      makePlayer({ id: 'b-st', name: 'FastBreaker', position: 'FW', mainPositions: ['ST'], playstyles: ['line_breaker'], ovr: 86 }),
      makePlayer({ id: 'b-cm', name: 'FreshDLP', position: 'MF', mainPositions: ['CM'], playstyles: ['deep_playmaker'], ovr: 85 }),
      makePlayer({ id: 'b-out', name: 'AlreadySubbedOff', position: 'FW', mainPositions: ['LW'], playstyles: ['line_breaker'], ovr: 92 }),
      null,
      null,
    ];

    const recs = buildHalftimeCoachRecommendations({
      starters,
      bench,
      formation: '4-3-3',
      oppTactic: 'gegenpressing',
      userGoals: 0,
      oppGoals: 1,
      staminaByPlayerId: {
        st: 58,
        cm1: 60,
        lw: 63,
      },
      firstHalfEvents: [],
      disabledBenchIds: new Set(['b-out']),
      managerTraitId: null,
    });

    expect(recs.length).toBeGreaterThanOrEqual(1);
    expect(recs.length).toBeLessThanOrEqual(2);
    expect(recs.some((r) => r.inPlayer.id === 'b-out')).toBe(false);
    expect(recs[0].inPlayer.id).toBe('b-st');
    expect(recs[0].reason.length).toBeGreaterThan(10);
  });

  it('optimizes halftime starters strictly within the active 11 without pulling bench players', () => {
    const gk = ACTIVE_PLAYERS.find((p) => p.position === 'GK')!;
    const defs = ACTIVE_PLAYERS.filter((p) => p.position === 'DF').slice(0, 4);
    const mids = ACTIVE_PLAYERS.filter((p) => p.position === 'MF').slice(0, 3);
    const fws = ACTIVE_PLAYERS.filter((p) => p.position === 'FW').slice(0, 3);
    const scrambled = [fws[0], fws[1], mids[0], defs[0], defs[1], gk, defs[2], defs[3], mids[1], mids[2], fws[2]];

    const optimized = optimizeCurrentStartersForFormation(
      scrambled,
      '4-3-3',
      'possession',
      null,
    );

    const origIds = new Set(scrambled.map((p) => p.id));
    const optIds = new Set(optimized.filter((p): p is Player => p !== null).map((p) => p.id));
    expect(optIds).toEqual(origIds);
    expect(optimized[0]?.id).toBe(gk.id);
  });

  it('reflects individual GK and specialist playstyles directly in roster impact', () => {
    const buildRosterWithGk = (gkOvr: number, gkStyle: PlaystyleId): Player[] => [
      makePlayer({ id: 'gk', name: 'GK', position: 'GK', mainPositions: ['GK'], ovr: gkOvr, def: gkOvr, playstyles: [gkStyle] }),
      ...Array.from({ length: 10 }, (_, idx) =>
        makePlayer({ id: `p${idx}`, name: `P${idx}`, ovr: 82, att: 82, mid: 82, def: 82 }),
      ),
    ];

    const eliteGk = computeIndividualRosterImpact(buildRosterWithGk(92, 'shot_stopper'));
    const weakGk = computeIndividualRosterImpact(buildRosterWithGk(74, 'sweeper_keeper'));
    expect(eliteGk.gkSaveMod).toBeGreaterThan(weakGk.gkSaveMod);
    expect(eliteGk.defDelta).toBeGreaterThan(weakGk.defDelta);
  });

  it('produces v2.2 events (u_buildup_switch, rebound_finish, penalty_kick, var_offside) while preserving exact goal score integrity', () => {
    const epl = getLeagueById('epl');
    const opp = epl.clubs[0];
    const oppRoster = buildAiClubRoster(opp, 'epl');
    const userStarters = [
      ACTIVE_PLAYERS.find((p) => p.position === 'GK')!,
      ...ACTIVE_PLAYERS.filter((p) => p.position === 'DF').slice(0, 4),
      ...ACTIVE_PLAYERS.filter((p) => p.position === 'MF').slice(0, 3),
      ...ACTIVE_PLAYERS.filter((p) => p.position === 'FW').slice(0, 3),
    ];
    const chem = calculateChemistry('4-3-3', userStarters, 'possession', null);
    const ratings = calculateTeamRatings('4-3-3', userStarters, chem.total, null);

    const userClub: Club = {
      id: USER_CLUB_ID,
      name: 'Road To Treble FC',
      shortName: 'RTT',
      primaryColor: '#10b981',
      secondaryColor: '#ffffff',
      formation: '4-3-3',
      defaultTactic: 'possession',
      att: Math.round(ratings.effectiveAtt),
      mid: Math.round(ratings.effectiveMid),
      def: Math.round(ratings.effectiveDef),
      topScorers: ['A', 'B', 'C'],
      isUser: true,
    };

    const rng = createSeededRng(2026);
    let sawUBuildup = false;
    let sawRebound = false;
    let sawPk = false;
    let sawVarOffside = false;

    for (let i = 0; i < 60; i += 1) {
      const fixture: Fixture = {
        id: `v22-fix-${i}`,
        round: 1,
        homeTeamId: USER_CLUB_ID,
        awayTeamId: opp.id,
        played: false,
      };
      const userContext = {
        userClubId: USER_CLUB_ID,
        starters: userStarters,
        formation: '4-3-3' as const,
        tactic: 'possession' as const,
        chemistry: chem.total,
        ratings,
        managerTraitId: null,
      };
      const ht = simulateFirstHalf({
        fixture,
        homeClub: userClub,
        awayClub: opp,
        homeRoster: userStarters,
        awayRoster: oppRoster,
        userContext,
        rng,
      });
      const res = simulateSecondHalf({
        halftime: ht,
        homeClub: userClub,
        awayClub: opp,
        homeRoster: userStarters,
        awayRoster: oppRoster,
        userContext,
        rng,
      });

      const homeGoalEvents = res.events.filter(
        (e) => e.type === 'goal' && e.teamId === USER_CLUB_ID,
      ).length;
      const awayGoalEvents = res.events.filter(
        (e) => e.type === 'goal' && e.teamId === opp.id,
      ).length;
      // VAR offside events must NEVER be counted in actual goals!
      expect(homeGoalEvents).toBe(res.homeGoals);
      expect(awayGoalEvents).toBe(res.awayGoals);

      for (const ev of res.events) {
        if (ev.highlightPattern === 'u_buildup_switch') sawUBuildup = true;
        if (ev.highlightPattern === 'rebound_finish') sawRebound = true;
        if (ev.highlightPattern === 'penalty_kick') sawPk = true;
        if (ev.type === 'var_offside') sawVarOffside = true;
      }
    }

    expect(sawUBuildup).toBe(true);
    expect(sawRebound).toBe(true);
    expect(sawPk).toBe(true);
    expect(sawVarOffside).toBe(true);
  });
});
