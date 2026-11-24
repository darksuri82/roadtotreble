import { describe, expect, it } from 'vitest';
import { FORMATION_LIST, FORMATIONS } from '../data/formations';
import { MANAGER_TRAIT_LIST } from '../data/managerTraits';
import { PLAYSTYLES } from '../data/playstyles';
import { calculateChemistry } from '../engine/chemistryEngine';
import { ALL_PLAYERS } from '../engine/dataLoader';
import {
  createPitchSimState,
  evaluatePassLaneSafety,
  FIXED_DT,
  MAX_FRAME_DELTA,
  resolvePitchFinalTheme,
  SIM_SECONDS_PER_MATCH_MINUTE,
  stepPitchSim,
  syncPitchSimConfig,
} from '../engine/pitchSimEngine';
import type { PitchSimTeamInput } from '../engine/pitchSimTypes';
import {
  buildBaseFormationCoords,
  buildTeamAgentProfiles,
  buildTeamTacticalDoctrine,
  computeAgentLiveStamina,
  computeDynamicFormationTarget,
  getStaminaKinematicFactor,
} from '../engine/pitchTacticalParams';
import { TACTIC_LIST } from '../engine/tacticEngine';
import type { FormationId, ManagerTraitId } from '../types/game';
import type { MatchEvent, TacticId } from '../types/league';
import type { Player, PlaystyleId } from '../types/player';

function makeSquadForFormation(
  formation: FormationId,
  offset = 0,
): Player[] {
  const pool = ALL_PLAYERS;
  const slots = FORMATIONS[formation].slots;
  const used = new Set<string>();
  return slots.map((slot, idx) => {
    const exact = pool.find(
      (p) => !used.has(p.id) && p.mainPositions.includes(slot.subPosition),
    );
    const byPos = pool.find(
      (p) => !used.has(p.id) && p.position === slot.position,
    );
    const pick = exact ?? byPos ?? pool[(idx + offset * 11) % pool.length];
    used.add(pick.id);
    return pick;
  });
}

function makeTeamInput(
  formation: FormationId,
  tactic: TacticId,
  managerTraitId: ManagerTraitId | null,
  starters: Player[],
  extra?: Partial<PitchSimTeamInput>,
): PitchSimTeamInput {
  return {
    formation,
    tactic,
    starters,
    chemistry: calculateChemistry(formation, starters, tactic, managerTraitId),
    managerTraitId,
    managerOvr: 86,
    ...extra,
  };
}

describe('v8.11 Realistic 2D Tactical Pitch Simulation Engine', () => {
  it('1. 100% deterministic replay with identical simSeed & distinct divergence on different seeds', () => {
    const homeStarters = makeSquadForFormation('4-3-3', 0);
    const awayStarters = makeSquadForFormation('4-2-3-1', 1);

    const makeInit = (seed: string) =>
      createPitchSimState({
        seed,
        homeTeamId: 'home',
        awayTeamId: 'away',
        home: makeTeamInput('4-3-3', 'possession', 'tiki_taka', homeStarters),
        away: makeTeamInput('4-2-3-1', 'counter', 'direct_football', awayStarters),
        startMinute: 0,
        endMinute: 45,
        half: 1,
        targetHomePossession: 56,
        homeShotsTarget: 7,
        awayShotsTarget: 5,
        homeXgTarget: 1.1,
        awayXgTarget: 0.7,
        homeGoalsSoFar: 0,
        awayGoalsSoFar: 0,
        events: [],
      });

    const simA = makeInit('mp-match-sync-seed-001');
    const simB = makeInit('mp-match-sync-seed-001');
    const simC = makeInit('mp-match-sync-seed-999');

    for (let tick = 0; tick < 600; tick += 1) {
      stepPitchSim(simA, FIXED_DT);
      stepPitchSim(simB, FIXED_DT);
      stepPitchSim(simC, FIXED_DT);
    }

    // Bit-for-bit parity for identical seeds (essential for multiplayer H2H & spectator sync)
    expect(simA.ball.x).toBe(simB.ball.x);
    expect(simA.ball.y).toBe(simB.ball.y);
    expect(simA.ball.z).toBe(simB.ball.z);
    expect(simA.rngState).toBe(simB.rngState);
    expect(simA.matchMinuteFloat).toBe(simB.matchMinuteFloat);
    for (let i = 0; i < 11; i += 1) {
      expect(simA.homeAgents[i].x).toBe(simB.homeAgents[i].x);
      expect(simA.homeAgents[i].y).toBe(simB.homeAgents[i].y);
      expect(simA.awayAgents[i].x).toBe(simB.awayAgents[i].x);
      expect(simA.awayAgents[i].y).toBe(simB.awayAgents[i].y);
    }

    // Different seed diverges cleanly
    const posDiff =
      Math.abs(simA.ball.x - simC.ball.x) + Math.abs(simA.ball.y - simC.ball.y);
    expect(posDiff).toBeGreaterThan(0.001);
  });

  it('2. Fixed-Timestep Accumulator preserves exact 1x : 2x : 4x speed parity with zero skipped ticks', () => {
    expect(FIXED_DT).toBeCloseTo(1 / 60, 6);
    expect(SIM_SECONDS_PER_MATCH_MINUTE).toBe(1.2);
    expect(MAX_FRAME_DELTA).toBe(0.05);

    const homeStarters = makeSquadForFormation('4-3-3', 0);
    const awayStarters = makeSquadForFormation('4-4-2', 1);

    const runAccumulator = (speed: 1 | 2 | 4, wallSeconds: number) => {
      const sim = createPitchSimState({
        seed: 'accumulator-parity-test',
        homeTeamId: 'home',
        awayTeamId: 'away',
        home: makeTeamInput('4-3-3', 'balanced', 'midfield_maestro', homeStarters),
        away: makeTeamInput('4-4-2', 'balanced', 'defensive_architect', awayStarters),
        startMinute: 0,
        endMinute: 45,
        half: 1,
        targetHomePossession: 50,
        homeShotsTarget: 6,
        awayShotsTarget: 6,
        homeXgTarget: 0.9,
        awayXgTarget: 0.9,
        homeGoalsSoFar: 0,
        awayGoalsSoFar: 0,
        events: [],
      });
      const frameDelta = 1 / 60;
      const frames = Math.round(wallSeconds / frameDelta);
      let acc = 0;
      let steps = 0;
      for (let f = 0; f < frames; f += 1) {
        acc += Math.min(MAX_FRAME_DELTA, frameDelta) * speed;
        while (acc >= FIXED_DT) {
          stepPitchSim(sim, FIXED_DT);
          acc -= FIXED_DT;
          steps += 1;
        }
      }
      return { sim, steps };
    };

    // 12s at 1x === 6s at 2x === 3s at 4x (exact same number of physics ticks & identical state!)
    const r1 = runAccumulator(1, 12);
    const r2 = runAccumulator(2, 6);
    const r4 = runAccumulator(4, 3);

    expect(r1.steps).toBe(r2.steps);
    expect(r2.steps).toBe(r4.steps);
    expect(r1.sim.matchMinuteFloat).toBeCloseTo(r2.sim.matchMinuteFloat, 6);
    expect(r2.sim.matchMinuteFloat).toBeCloseTo(r4.sim.matchMinuteFloat, 6);
    expect(r1.sim.ball.x).toBe(r2.sim.ball.x);
    expect(r2.sim.ball.x).toBe(r4.sim.ball.x);
    expect(r1.sim.homeAgents[9].x).toBe(r4.sim.homeAgents[9].x);
  });

  it('3. Layer 1 (All 9 Formations): 3-phase structural transformation (buildup vs defend vs transition)', () => {
    expect(FORMATION_LIST.length).toBe(9);

    for (const formCfg of FORMATION_LIST) {
      const starters = makeSquadForFormation(formCfg.id, 0);
      const team = makeTeamInput(formCfg.id, 'balanced', null, starters);
      const opp = makeTeamInput(
        '4-3-3',
        'balanced',
        null,
        makeSquadForFormation('4-3-3', 1),
      );
      const doctrine = buildTeamTacticalDoctrine({
        my: team,
        opp,
        minute: 20,
        scoreDiff: 0,
        isBigMatch: false,
      });
      const profiles = buildTeamAgentProfiles(team, 20);
      const baseCoords = buildBaseFormationCoords(formCfg.id, true);

      expect(baseCoords).toHaveLength(11);
      expect(profiles).toHaveLength(11);

      let avgProgressionX = 0;
      let avgDefendX = 0;
      for (let i = 1; i < 11; i += 1) {
        const progression = computeDynamicFormationTarget({
          slotIndex: i,
          base: baseCoords[i],
          isHome: true,
          mode: 'progression',
          ball: { x: 0.65, y: 0.48 },
          doctrine,
          profile: profiles[i],
          territorialShiftX: 0.14,
          simTime: 10,
        });
        const defend = computeDynamicFormationTarget({
          slotIndex: i,
          base: baseCoords[i],
          isHome: true,
          mode: 'defend',
          ball: { x: 0.32, y: 0.5 },
          doctrine,
          profile: profiles[i],
          territorialShiftX: -0.14,
          simTime: 10,
        });
        const transition = computeDynamicFormationTarget({
          slotIndex: i,
          base: baseCoords[i],
          isHome: true,
          mode: 'transition_attack',
          ball: { x: 0.55, y: 0.5 },
          doctrine,
          profile: profiles[i],
          territorialShiftX: 0.08,
          simTime: 10,
        });

        for (const pt of [progression, defend, transition]) {
          expect(Number.isFinite(pt.x)).toBe(true);
          expect(Number.isFinite(pt.y)).toBe(true);
          expect(pt.x).toBeGreaterThanOrEqual(0.02);
          expect(pt.x).toBeLessThanOrEqual(0.98);
          expect(pt.y).toBeGreaterThanOrEqual(0.03);
          expect(pt.y).toBeLessThanOrEqual(0.97);
        }
        avgProgressionX += progression.x;
        avgDefendX += defend.x;
      }

      // Attacking progression pushes meaningfully higher up pitch than defensive block
      expect(avgProgressionX / 10).toBeGreaterThan(avgDefendX / 10 + 0.12);
    }
  });

  it('4. Layer 2 (All 5 Team Tactics): produces genuinely distinct pitch doctrines', () => {
    expect(TACTIC_LIST.length).toBe(5);
    const starters = makeSquadForFormation('4-3-3', 0);
    const opp = makeTeamInput(
      '4-3-3',
      'balanced',
      null,
      makeSquadForFormation('4-3-3', 1),
    );

    const docs = Object.fromEntries(
      TACTIC_LIST.map((t) => [
        t.id,
        buildTeamTacticalDoctrine({
          my: makeTeamInput('4-3-3', t.id, null, starters),
          opp,
          minute: 25,
          scoreDiff: 0,
          isBigMatch: false,
        }),
      ]),
    );

    // Possession recycles patiently & favors shorter passing triangles than Counter
    expect(docs.possession.buildUpPatience).toBeGreaterThan(
      docs.counter.buildUpPatience + 0.25,
    );
    expect(docs.possession.passLengthBias).toBeLessThan(
      docs.counter.passLengthBias - 0.5,
    );
    expect(docs.possession.thirdManFreq).toBeGreaterThan(docs.counter.thirdManFreq);

    // Gegenpressing presses higher & wider trigger radius than Counter low-block
    expect(docs.gegenpressing.defensiveLineOffset).toBeGreaterThan(
      docs.counter.defensiveLineOffset + 0.08,
    );
    expect(docs.gegenpressing.pressTriggerRadius).toBeGreaterThan(
      docs.counter.pressTriggerRadius + 0.05,
    );
    expect(docs.gegenpressing.pressersCount).toBeGreaterThanOrEqual(
      docs.counter.pressersCount,
    );

    // Wingplay stretches width & prioritizes flanks over central possession
    expect(docs.wingplay.attackWidthScale).toBeGreaterThan(
      docs.possession.attackWidthScale,
    );
    expect(docs.wingplay.flankBias).toBeGreaterThan(
      docs.possession.flankBias + 0.2,
    );

    // Counter launches urgent vertical transitions
    expect(docs.counter.counterSprintUrgency).toBeGreaterThan(
      docs.possession.counterSprintUrgency + 0.25,
    );
  });

  it('5. Layer 3 (All 14 Manager Traits + OVR): every trait measurably shapes on-pitch doctrine', () => {
    expect(MANAGER_TRAIT_LIST.length).toBe(14);
    const starters = makeSquadForFormation('4-3-3', 0);
    const opp = makeTeamInput(
      '4-3-3',
      'balanced',
      null,
      makeSquadForFormation('4-3-3', 1),
    );

    const baseline = buildTeamTacticalDoctrine({
      my: makeTeamInput('4-3-3', 'balanced', null, starters, {
        halftimeAdjusted: true,
        managerOvr: 82,
      }),
      opp,
      minute: 68,
      scoreDiff: -1,
      isBigMatch: true,
    });

    const numericKeys: (keyof typeof baseline)[] = [
      'buildUpPatience',
      'tempo',
      'passLengthBias',
      'defensiveLineOffset',
      'pressTriggerRadius',
      'pressersCount',
      'attackWidthScale',
      'defensiveCompactness',
      'flankBias',
      'centralBias',
      'thirdManFreq',
      'counterSprintUrgency',
      'gkBuildupSupport',
      'positionSwitching',
      'lineDiscipline',
      'starFocus',
      'freshSubBoost',
      'composure',
      'setPieceFocus',
    ];

    for (const trait of MANAGER_TRAIT_LIST) {
      const withTrait = buildTeamTacticalDoctrine({
        my: makeTeamInput('4-3-3', 'balanced', trait.id, starters, {
          halftimeAdjusted: true,
          managerOvr: 82,
        }),
        opp,
        minute: 68,
        scoreDiff: -1,
        isBigMatch: true,
      });

      const totalDelta = numericKeys.reduce(
        (acc, key) => acc + Math.abs(Number(withTrait[key]) - Number(baseline[key])),
        0,
      );
      expect(totalDelta).toBeGreaterThan(0.03);
    }

    // Higher Manager OVR directly elevates composure & tactical discipline
    const eliteMgr = buildTeamTacticalDoctrine({
      my: makeTeamInput('4-3-3', 'balanced', null, starters, { managerOvr: 96 }),
      opp,
      minute: 60,
      scoreDiff: 0,
      isBigMatch: false,
    });
    const lowMgr = buildTeamTacticalDoctrine({
      my: makeTeamInput('4-3-3', 'balanced', null, starters, { managerOvr: 72 }),
      opp,
      minute: 60,
      scoreDiff: 0,
      isBigMatch: false,
    });
    expect(eliteMgr.composure).toBeGreaterThan(lowMgr.composure);
    expect(eliteMgr.lineDiscipline).toBeGreaterThan(lowMgr.lineDiscipline);
  });

  it('6. Layer 4 (All 14 Playstyles): every playstyle shifts player agent behavioral affinities', () => {
    const allPlaystyleIds = Object.keys(PLAYSTYLES) as PlaystyleId[];
    expect(allPlaystyleIds.length).toBe(14);

    const baseSquad = makeSquadForFormation('4-3-3', 0);

    const affinityKeys = [
      'runBehindBias',
      'dropToLinkBias',
      'boxCrashBias',
      'cutInsideBias',
      'hugTouchlineBias',
      'overlapBias',
      'pressEagerness',
      'holdPositionBias',
      'longSwitchBias',
      'dribbleBias',
      'shootBias',
      'sweeperGkBias',
    ] as const;

    const getProfileForStyle = (style: PlaystyleId | null, slotIndex: number) => {
      const cloned = baseSquad.map((p, idx) =>
        idx === slotIndex ? { ...p, playstyles: style ? [style] : [] } : p,
      );
      const profiles = buildTeamAgentProfiles(
        makeTeamInput('4-3-3', 'balanced', null, cloned),
        15,
      );
      return profiles[slotIndex];
    };

    for (const style of allPlaystyleIds) {
      const slotIdx =
        style === 'sweeper_keeper' || style === 'shot_stopper' ? 0 : 7;
      const neutral = getProfileForStyle(null, slotIdx);
      const styled = getProfileForStyle(style, slotIdx);
      const delta = affinityKeys.reduce(
        (sum, k) => sum + Math.abs(styled[k] - neutral[k]),
        0,
      );
      expect(delta).toBeGreaterThan(0.05);
    }

    // Hallmark playstyle contrasts
    const poacher = getProfileForStyle('poacher', 9);
    const playmaker10 = getProfileForStyle('playmaker_10', 9);
    expect(poacher.boxCrashBias).toBeGreaterThan(playmaker10.boxCrashBias + 0.15);
    expect(playmaker10.dropToLinkBias).toBeGreaterThan(poacher.dropToLinkBias + 0.15);

    const invertedWinger = getProfileForStyle('inverted_winger', 8);
    const classicWinger = getProfileForStyle('classic_winger', 8);
    expect(invertedWinger.cutInsideBias).toBeGreaterThan(
      classicWinger.cutInsideBias + 0.2,
    );
    expect(classicWinger.hugTouchlineBias).toBeGreaterThan(
      invertedWinger.hugTouchlineBias + 0.2,
    );
  });

  it('7. Layer 5 (Sub-Attributes, Chemistry Links, Stamina Decay & Fresh Subs)', () => {
    const squad = makeSquadForFormation('4-3-3', 0);
    const elitePlayer: Player = {
      ...squad[9],
      attrs: {
        sho: 92,
        pas: 95,
        cro: 88,
        dri: 94,
        aer: 82,
        def: 48,
        phy: 95,
      },
      stamina: 90,
    };
    const sluggishPlayer: Player = {
      ...squad[9],
      attrs: {
        sho: 68,
        pas: 56,
        cro: 55,
        dri: 58,
        aer: 65,
        def: 48,
        phy: 55,
      },
      stamina: 62,
    };

    const fastTeam = makeTeamInput(
      '4-3-3',
      'gegenpressing',
      null,
      squad.map((p, i) => (i === 9 ? elitePlayer : p)),
    );
    const slowTeam = makeTeamInput(
      '4-3-3',
      'gegenpressing',
      null,
      squad.map((p, i) => (i === 9 ? sluggishPlayer : p)),
    );
    const opp = makeTeamInput(
      '4-3-3',
      'balanced',
      null,
      makeSquadForFormation('4-3-3', 1),
    );
    const doc = buildTeamTacticalDoctrine({
      my: fastTeam,
      opp,
      minute: 78,
      scoreDiff: 0,
      isBigMatch: false,
    });

    const fastProf = buildTeamAgentProfiles(fastTeam, 10)[9];
    const slowProf = buildTeamAgentProfiles(slowTeam, 10)[9];
    expect(fastProf.baseMaxSpeed).toBeGreaterThan(slowProf.baseMaxSpeed * 1.12);
    expect(fastProf.longSwitchBias).toBeGreaterThan(slowProf.longSwitchBias);

    // Stamina decay visibly reduces kinematics; fresh sub stays far fresher at 78'
    expect(getStaminaKinematicFactor(95)).toBeGreaterThan(
      getStaminaKinematicFactor(35) + 0.14,
    );
    const tiredStarterStam = computeAgentLiveStamina(fastProf, doc, 78);
    const freshSubProf = { ...fastProf, enteredAtMinute: 45, isFreshSub: true };
    const freshSubStam = computeAgentLiveStamina(freshSubProf, doc, 78);
    expect(freshSubStam).toBeGreaterThan(tiredStarterStam + 15);
  });

  it('8. Pass-Lane Safety, Full 45-min Director Highlight Choreography & Hot Live-Sub Sync', () => {
    const homeStarters = makeSquadForFormation('4-3-3', 0);
    const awayStarters = makeSquadForFormation('4-2-3-1', 1);

    const events: { key: string; event: MatchEvent }[] = [
      {
        key: 'h1-10-goal',
        event: {
          minute: 10,
          half: 1,
          type: 'goal',
          teamId: 'home',
          scorerId: homeStarters[9].id,
          scorerName: homeStarters[9].name,
          assistId: homeStarters[7].id,
          assistName: homeStarters[7].name,
          description: `${homeStarters[9].name} 스루패스 마무리 골!`,
          highlightPattern: 'through_ball_1v1',
          attackRoute: 'tiki_taka_triangle',
        },
      },
      {
        key: 'h1-21-save',
        event: {
          minute: 21,
          half: 1,
          type: 'save',
          teamId: 'away',
          scorerId: awayStarters[9].id,
          scorerName: awayStarters[9].name,
          description: `${awayStarters[9].name} 컷인 슈팅, 골키퍼 슈퍼세이브!`,
          highlightPattern: 'cut_inside_curler',
        },
      },
      {
        key: 'h1-32-var',
        event: {
          minute: 32,
          half: 1,
          type: 'var_offside',
          teamId: 'home',
          scorerId: homeStarters[8].id,
          scorerName: homeStarters[8].name,
          description: 'VAR 판독 결과 미세 오프사이드 취소!',
          highlightPattern: 'wing_cross_header',
        },
      },
      {
        key: 'h1-41-pk',
        event: {
          minute: 41,
          half: 1,
          type: 'goal',
          teamId: 'away',
          scorerId: awayStarters[10].id,
          scorerName: awayStarters[10].name,
          description: `${awayStarters[10].name} 페널티킥 성공!`,
          highlightPattern: 'penalty_kick',
        },
      },
    ];

    const sim = createPitchSimState({
      seed: 'full-half-director-test',
      homeTeamId: 'home',
      awayTeamId: 'away',
      home: makeTeamInput('4-3-3', 'possession', 'tiki_taka', homeStarters),
      away: makeTeamInput('4-2-3-1', 'gegenpressing', 'gegenpress_guru', awayStarters),
      startMinute: 0,
      endMinute: 45,
      half: 1,
      targetHomePossession: 54,
      homeShotsTarget: 7,
      awayShotsTarget: 6,
      homeXgTarget: 1.2,
      awayXgTarget: 1.0,
      homeGoalsSoFar: 0,
      awayGoalsSoFar: 0,
      events,
    });

    // Pass-lane safety unit check (outfield defender at slot >= 1 standing directly on pass line drops safety)
    const clearDefenders = sim.awayAgents.map((a) => ({ ...a, x: 0.9, y: 0.9 }));
    const blockingDefenders = sim.awayAgents.map((a, idx) =>
      idx === 4 ? { ...a, x: 0.42, y: 0.5 } : { ...a, x: 0.9, y: 0.9 },
    );
    const openSafety = evaluatePassLaneSafety(
      { x: 0.3, y: 0.5 },
      { x: 0.55, y: 0.5 },
      clearDefenders,
      sim.awayDoctrine,
    );
    const blockedSafety = evaluatePassLaneSafety(
      { x: 0.3, y: 0.5 },
      { x: 0.55, y: 0.5 },
      blockingDefenders,
      sim.awayDoctrine,
    );
    expect(openSafety).toBeGreaterThan(blockedSafety + 0.5);

    const revealed = new Set<string>();
    let hotSyncedOnce = false;
    // Simulate entire 45-minute half (max ~6000 ticks ≈ 100s sim time)
    for (let tick = 0; tick < 6000 && !sim.completed; tick += 1) {
      stepPitchSim(sim, FIXED_DT);

      if (sim.director && sim.director.revealed) {
        revealed.add(sim.director.key);
      }

      // Test live-sub hot-sync mid-half without resetting ball or PRNG
      if (!hotSyncedOnce && sim.matchMinuteFloat >= 25) {
        hotSyncedOnce = true;
        const prevBallX = sim.ball.x;
        const prevRng = sim.rngState;
        syncPitchSimConfig(sim, {
          home: makeTeamInput('4-3-3', 'gegenpressing', 'super_sub', homeStarters, {
            enteredAtMinute: { [homeStarters[9].id]: 25 },
          }),
          away: makeTeamInput('4-2-3-1', 'counter', 'catenaccio', awayStarters),
          targetHomePossession: 54,
          homeShotsTarget: 7,
          awayShotsTarget: 6,
          homeXgTarget: 1.2,
          awayXgTarget: 1.0,
          events,
        });
        expect(sim.ball.x).toBe(prevBallX);
        expect(sim.rngState).toBe(prevRng);
        expect(sim.homeDoctrine.tactic).toBe('gegenpressing');
      }

      // Guard zero NaN / out-of-bounds
      expect(Number.isFinite(sim.ball.x)).toBe(true);
      expect(Number.isFinite(sim.ball.y)).toBe(true);
    }

    expect(sim.completed).toBe(true);
    expect(sim.matchMinuteFloat).toBeGreaterThanOrEqual(45);
    expect(revealed.has('h1-10-goal')).toBe(true);
    expect(revealed.has('h1-21-save')).toBe(true);
    expect(revealed.has('h1-32-var')).toBe(true);
    expect(revealed.has('h1-41-pk')).toBe(true);
  });

  it('9. Championship Final visual theme resolver distinguishes UCL Final, Cup Final & regular matches', () => {
    expect(
      resolvePitchFinalTheme({
        competition: 'ucl',
        competitionLabel: 'UEFA 챔피언스리그 결승',
      }),
    ).toBe('ucl_final');

    expect(
      resolvePitchFinalTheme({
        competition: 'cup',
        competitionLabel: 'FA컵 결승 맞대결',
        explicitFinal: true,
      }),
    ).toBe('cup_final');

    expect(
      resolvePitchFinalTheme({
        competition: 'ucl',
        competitionLabel: 'UCL 8강 2차전',
      }),
    ).toBe('none');

    expect(
      resolvePitchFinalTheme({
        competition: 'league',
        competitionLabel: '리그 14R 맞대결',
      }),
    ).toBe('none');
  });

  it('10. Open-play AI executes patient ball recycling, Third-Man Runs & tactical style contrast', () => {
    const homeStarters = makeSquadForFormation('4-3-3', 0);
    const awayStarters = makeSquadForFormation('4-2-3-1', 1);

    const runOpenPlaySeries = (tactic: TacticId, trait: ManagerTraitId) => {
      let passesAttempted = 0;
      let passesCompleted = 0;
      let recycles = 0;
      let thirdManRuns = 0;
      for (const seed of ['series-1', 'series-2', 'series-3', 'series-4']) {
        const sim = createPitchSimState({
          seed,
          homeTeamId: 'home',
          awayTeamId: 'away',
          home: makeTeamInput('4-3-3', tactic, trait, homeStarters),
          away: makeTeamInput('4-2-3-1', tactic, trait, awayStarters),
          startMinute: 0,
          endMinute: 45,
          half: 1,
          targetHomePossession: 50,
          homeShotsTarget: 6,
          awayShotsTarget: 6,
          homeXgTarget: 0.9,
          awayXgTarget: 0.9,
          homeGoalsSoFar: 0,
          awayGoalsSoFar: 0,
          events: [],
        });
        for (let tick = 0; tick < 3600 && !sim.completed; tick += 1) {
          stepPitchSim(sim, FIXED_DT);
        }
        passesAttempted += sim.stats.passesAttempted;
        passesCompleted += sim.stats.passesCompleted;
        recycles += sim.stats.recycles;
        thirdManRuns += sim.stats.thirdManRuns;
      }
      return { passesAttempted, passesCompleted, recycles, thirdManRuns };
    };

    const poss = runOpenPlaySeries('possession', 'tiki_taka');
    const counter = runOpenPlaySeries('counter', 'direct_football');

    expect(poss.passesAttempted).toBeGreaterThan(80);
    expect(poss.passesCompleted).toBeGreaterThan(40);
    expect(poss.recycles).toBeGreaterThan(0);
    expect(poss.thirdManRuns).toBeGreaterThan(0);
    // Possession + Tiki-Taka generates more patient recycling & third-man combinations than Counter + Direct Football
    expect(poss.recycles + poss.thirdManRuns).toBeGreaterThan(
      counter.recycles + counter.thirdManRuns,
    );
  });
});
