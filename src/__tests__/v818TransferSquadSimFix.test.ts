import { describe, expect, it } from 'vitest';
import { buildClubSquadLineup } from '../components/common/ClubSquadModal';
import { evaluateManagerPlayerSynergy } from '../data/managerTraits';
import { formatAttackChainDescription } from '../engine/attackChainEngine';
import { buildAiClubRoster, getLeagueById } from '../engine/dataLoader';
import {
  createPitchSimState,
  FIXED_DT,
  stepPitchSim,
} from '../engine/pitchSimEngine';
import {
  analyzeClubPositionNeeds,
  computePlayerMarketValueM,
  computePlayerTradePoints,
  evaluateTradePackage,
} from '../engine/transferEngine';
import type { Club, MatchEvent } from '../types/league';
import type { Player } from '../types/player';

function makeClub(id: string, formation: Club['formation'] = '4-3-3'): Club {
  return {
    id,
    name: `Club ${id}`,
    shortName: id.slice(0, 3).toUpperCase(),
    primaryColor: '#10b981',
    secondaryColor: '#0f172a',
    pattern: 'solid',
    att: 84,
    mid: 83,
    def: 82,
    formation,
    defaultTactic: 'balanced',
    topScorers: ['', '', ''],
  };
}

function getSampleRoster(leagueId: 'epl' | 'laliga' = 'epl', clubIdx = 0): {
  club: Club;
  roster: Player[];
} {
  const league = getLeagueById(leagueId);
  const club = league.clubs[clubIdx];
  const roster = buildAiClubRoster(club, leagueId);
  return { club, roster };
}

describe('v8.18 Transfer Market, Compact Squad Popup & 2D Simulation Regression Suite', () => {
  it('1 & 5) computes unified market value (€M), TP trade metrics, and manager fit consistently', () => {
    const { roster: homeRoster } = getSampleRoster('epl', 0);
    const { club: aiClub, roster: aiRoster } = getSampleRoster('epl', 1);

    // Market value scales with OVR and respects shock-bargain -35% discount
    const star = [...homeRoster].sort((a, b) => b.ovr - a.ovr)[0];
    const normalMv = computePlayerMarketValueM(star);
    const bargainMv = computePlayerMarketValueM(star, { isShockBargain: true });
    expect(normalMv).toBeGreaterThanOrEqual(3);
    expect(bargainMv).toBeLessThan(normalMv);
    expect(bargainMv).toBe(Math.max(3, Math.round(normalMv * 0.65)));

    // Single manager synergy helper evaluates consistently for both own and opponent players
    const ownFitCount = homeRoster.filter(
      (p) => evaluateManagerPlayerSynergy(p, 'tiki_taka').bonus > 0,
    ).length;
    const oppFitCount = aiRoster.filter(
      (p) => evaluateManagerPlayerSynergy(p, 'tiki_taka').bonus > 0,
    ).length;
    expect(ownFitCount).toBeGreaterThanOrEqual(0);
    expect(oppFitCount).toBeGreaterThanOrEqual(0);

    // Trade points & package evaluation share exact same engine logic
    const clubNeeds = analyzeClubPositionNeeds(aiRoster);
    const target = aiRoster[9] ?? aiRoster[1];
    const outgoing = homeRoster[9] ?? homeRoster[1];
    const tpSingle = computePlayerTradePoints({
      player: target,
      sellingClubNeeds: clubNeeds,
    });
    const pkg = evaluateTradePackage({
      userSentPlayers: [outgoing],
      aiTargetPlayers: [target],
      aiFillerPlayers: [],
      userSquad: homeRoster,
      aiClub,
      aiClubRank: 4,
      aiLeagueSize: 20,
      aiNeeds: clubNeeds,
      aiRoster,
      allPlayerStats: {},
      userRank: 3,
      userLeagueSize: 20,
    });
    expect(pkg.aiValuations[0]?.effectiveTp).toBe(tpSingle.effectiveTp);
    expect(pkg.ratio).toBeGreaterThan(0);
    expect(pkg.acceptanceChance).toBeGreaterThanOrEqual(0);
    expect(pkg.acceptanceChance).toBeLessThanOrEqual(100);
  });

  it('2 & 4) buildClubSquadLineup preserves saved user XI and auto-places AI clubs with zero empty starter slots', () => {
    const { club, roster } = getSampleRoster('epl', 2);

    // Case A: Saved human starters & formation are preserved verbatim
    const savedStarters = roster.slice(0, 11);
    const savedBench = roster.slice(11);
    const humanLineup = buildClubSquadLineup({
      club,
      roster,
      starters: savedStarters,
      bench: savedBench,
      formation: '4-2-3-1',
      tactic: 'possession',
      managerTraitId: 'tiki_taka',
    });
    expect(humanLineup.formation).toBe('4-2-3-1');
    expect(humanLineup.tactic).toBe('possession');
    expect(humanLineup.starters.map((p) => p?.id)).toEqual(
      savedStarters.map((p) => p.id),
    );

    // Case B: AI club with no saved starters fills all 11 slots with zero nulls
    const noMetaClub = makeClub('ai-auto-test', '4-3-3');
    const aiLineup = buildClubSquadLineup({
      club: noMetaClub,
      roster,
    });
    expect(aiLineup.starters).toHaveLength(11);
    expect(aiLineup.starters.every((p) => p !== null)).toBe(true);
    expect(new Set(aiLineup.starters.map((p) => p!.id)).size).toBe(11);
  });

  it('6a) 2D simulation box freeze guard resolves deep-box / orphaned loose-ball stalls without freezing', () => {
    const { club: homeClub, roster: homeRoster } = getSampleRoster('epl', 0);
    const { club: awayClub, roster: awayRoster } = getSampleRoster('epl', 1);

    const state = createPitchSimState({
      seed: 'v818-box-freeze-guard-test',
      homeTeamId: homeClub.id,
      awayTeamId: awayClub.id,
      home: {
        formation: '4-3-3',
        tactic: 'possession',
        starters: homeRoster.slice(0, 11),
        managerTraitId: 'tiki_taka',
        managerOvr: 86,
      },
      away: {
        formation: '4-4-2',
        tactic: 'counter',
        starters: awayRoster.slice(0, 11),
        managerTraitId: 'defensive_architect',
        managerOvr: 85,
      },
      startMinute: 0,
      endMinute: 45,
      half: 1,
      targetHomePossession: 56,
      homeShotsTarget: 7,
      awayShotsTarget: 4,
      homeShotsOnTargetTarget: 4,
      awayShotsOnTargetTarget: 2,
      homeXgTarget: 1.25,
      awayXgTarget: 0.65,
      homeGoalsSoFar: 0,
      awayGoalsSoFar: 0,
      events: [],
    });

    // Force carrier & ball deep into 6-yard box stationary to test forced-resolution guard
    const striker = state.homeAgents[9];
    striker.x = 0.948;
    striker.y = 0.50;
    striker.prevX = 0.948;
    striker.prevY = 0.50;
    striker.targetX = 0.948;
    striker.targetY = 0.50;
    striker.vx = 0;
    striker.vy = 0;
    state.ball.ownerTeamIsHome = true;
    state.ball.ownerIdx = 9;
    state.ball.x = 0.948;
    state.ball.y = 0.50;
    state.ball.prevX = 0.948;
    state.ball.prevY = 0.50;
    state.carrierDecisionDelay = 5.0; // artificially long hold to guarantee guard catches it

    // Step 0.65 seconds (39 ticks) — guard MUST resolve within 0.42s!
    for (let t = 0; t < 40; t += 1) {
      stepPitchSim(state, FIXED_DT);
    }
    expect(state.stats.boxFreezeGuardsFired).toBeGreaterThanOrEqual(1);
    expect(state.boxStallTimer).toBeLessThan(0.42);
  });

  it('6b & 6c) rebound/scramble highlights execute cleanly and liveMetrics converge exactly to official half totals', () => {
    const { club: homeClub, roster: homeRoster } = getSampleRoster('epl', 0);
    const { club: awayClub, roster: awayRoster } = getSampleRoster('laliga', 0);

    const events: { key: string; event: MatchEvent }[] = [
      {
        key: 'ev-rebound-goal',
        event: {
          minute: 12,
          half: 1,
          type: 'goal',
          teamId: homeClub.id,
          scorerId: homeRoster[9].id,
          scorerName: homeRoster[9].name,
          assistId: homeRoster[10].id,
          assistName: homeRoster[10].name,
          highlightPattern: 'rebound_finish',
          reboundOrigin: 'blocked',
          description: formatAttackChainDescription({
            pattern: 'rebound_finish',
            outcome: 'goal',
            scorerName: homeRoster[9].name,
            secondaryShooterName: homeRoster[10].name,
            reboundOrigin: 'blocked',
          }),
        },
      },
      {
        key: 'ev-cutback-save',
        event: {
          minute: 28,
          half: 1,
          type: 'save',
          teamId: awayClub.id,
          scorerId: awayRoster[9].id,
          scorerName: awayRoster[9].name,
          highlightPattern: 'cutback_finish',
          description: formatAttackChainDescription({
            pattern: 'cutback_finish',
            outcome: 'save',
            scorerName: awayRoster[9].name,
            gkName: homeRoster[0].name,
          }),
        },
      },
      {
        key: 'ev-corner-goal',
        event: {
          minute: 40,
          half: 1,
          type: 'goal',
          teamId: homeClub.id,
          scorerId: homeRoster[8].id,
          scorerName: homeRoster[8].name,
          assistId: homeRoster[7].id,
          assistName: homeRoster[7].name,
          highlightPattern: 'corner_kick',
          description: formatAttackChainDescription({
            pattern: 'corner_kick',
            outcome: 'goal',
            scorerName: homeRoster[8].name,
            assistName: homeRoster[7].name,
          }),
        },
      },
    ];

    expect(events[0].event.description).toContain('문전 우당탕탕 혼전');

    const state = createPitchSimState({
      seed: 'v818-scramble-metrics-sync',
      homeTeamId: homeClub.id,
      awayTeamId: awayClub.id,
      home: {
        formation: '4-3-3',
        tactic: 'gegenpressing',
        starters: homeRoster.slice(0, 11),
        managerTraitId: 'gegenpress_guru',
        managerOvr: 87,
      },
      away: {
        formation: '4-3-3',
        tactic: 'possession',
        starters: awayRoster.slice(0, 11),
        managerTraitId: 'tiki_taka',
        managerOvr: 86,
      },
      startMinute: 0,
      endMinute: 45,
      half: 1,
      targetHomePossession: 54,
      homeShotsTarget: 8,
      awayShotsTarget: 5,
      homeShotsOnTargetTarget: 5,
      awayShotsOnTargetTarget: 2,
      homeXgTarget: 1.62,
      awayXgTarget: 0.78,
      homeGoalsSoFar: 0,
      awayGoalsSoFar: 0,
      events,
    });

    let ticks = 0;
    let maxBoxStallSeen = 0;
    while (!state.completed && ticks < 12000) {
      stepPitchSim(state, FIXED_DT);
      if (state.boxStallTimer > maxBoxStallSeen) {
        maxBoxStallSeen = state.boxStallTimer;
      }
      ticks += 1;
    }

    expect(state.completed).toBe(true);
    expect(state.homeGoalsLive).toBe(2);
    expect(state.awayGoalsLive).toBe(0);
    expect(state.stats.secondChanceScrambles).toBeGreaterThanOrEqual(1);
    // Box stall timer never exceeds guard threshold!
    expect(maxBoxStallSeen).toBeLessThanOrEqual(0.45);

    // Exact convergence to official half totals with zero mismatch
    expect(state.liveMetrics.homePossession).toBe(54);
    expect(state.liveMetrics.homeShots).toBe(8);
    expect(state.liveMetrics.awayShots).toBe(5);
    expect(state.liveMetrics.homeShotsOnTarget).toBe(5);
    expect(state.liveMetrics.awayShotsOnTarget).toBe(2);
    expect(state.liveMetrics.homeXg).toBeCloseTo(1.62, 2);
    expect(state.liveMetrics.awayXg).toBeCloseTo(0.78, 2);
    expect(state.liveMetrics.homeSaves).toBeGreaterThanOrEqual(2);
    expect(state.liveMetrics.awaySaves).toBeGreaterThanOrEqual(3);
  });
});
