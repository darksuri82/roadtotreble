import { describe, expect, it } from 'vitest';
import { FORMATION_LIST, FORMATIONS } from '../data/formations';
import { MANAGER_TRAIT_LIST } from '../data/managerTraits';
import { PLAYSTYLES } from '../data/playstyles';
import { calculateChemistry } from '../engine/chemistryEngine';
import { ALL_PLAYERS } from '../engine/dataLoader';
import {
  BOX_ZONE_MIN_DEPTH,
  createPitchSimState,
  evaluatePassLaneSafety,
  FINAL_THIRD_MIN_DEPTH,
  FIXED_DT,
  getAttackDepth,
  MAX_BOX_BACKPASS_DIST,
  MAX_FINAL_THIRD_BACKPASS_DIST,
  MAX_FRAME_DELTA,
  MIN_DIRECT_FK_SHOT_DEPTH,
  MIN_OPEN_PLAY_SHOT_DEPTH,
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
  computeGameStateUrgency,
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
      for (const seed of [
        'series-1',
        'series-2',
        'series-3',
        'series-4',
        'series-5',
        'series-6',
        'series-7',
        'series-8',
      ]) {
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
    // Possession + Tiki-Taka generates more third-man combinations and a higher patient buildup share per pass than Counter + Direct Football
    const possBuildUpShare =
      (poss.recycles + poss.thirdManRuns) / Math.max(1, poss.passesAttempted);
    const counterBuildUpShare =
      (counter.recycles + counter.thirdManRuns) /
      Math.max(1, counter.passesAttempted);
    expect(poss.thirdManRuns).toBeGreaterThan(counter.thirdManRuns);
    expect(possBuildUpShare).toBeGreaterThan(counterBuildUpShare);
  });

  it('11. Bug 1 Regression: Zero behind-halfway shots & 100% authentic PK/Corner/FK/Counter staging (incl. duplicate GK save guard)', () => {
    const homeStarters = makeSquadForFormation('4-3-3', 0);
    // Deliberately share the exact same GK on both sides (1v1 blind draft edge case!)
    const awayStarters = makeSquadForFormation('4-2-3-1', 1).map((p, idx) =>
      idx === 0 ? homeStarters[0] : p,
    );

    const testEvents: { key: string; event: MatchEvent }[] = [
      {
        key: 'pk-home',
        event: {
          minute: 6,
          half: 1,
          type: 'goal',
          teamId: 'home',
          scorerId: homeStarters[9].id,
          scorerName: homeStarters[9].name,
          description: `${homeStarters[9].name} 페널티킥 성공!`,
          highlightPattern: 'penalty_kick',
          attackRoute: 'penalty_kick',
          isPenalty: true,
        },
      },
      {
        key: 'corner-away',
        event: {
          minute: 13,
          half: 1,
          type: 'goal',
          teamId: 'away',
          scorerId: awayStarters[2].id,
          scorerName: awayStarters[2].name,
          assistId: awayStarters[7].id,
          assistName: awayStarters[7].name,
          description: `${awayStarters[2].name} 코너킥 헤더 골!`,
          highlightPattern: 'corner_kick',
          attackRoute: 'corner_header',
        },
      },
      {
        key: 'fk-home',
        event: {
          minute: 20,
          half: 1,
          type: 'chance',
          teamId: 'home',
          scorerId: homeStarters[7].id,
          scorerName: homeStarters[7].name,
          description: `${homeStarters[7].name} 직접 프리킥 골대 강타!`,
          highlightPattern: 'direct_free_kick',
          attackRoute: 'direct_fk',
          highlightOutcome: 'woodwork',
        },
      },
      {
        key: 'counter-away',
        event: {
          minute: 27,
          half: 1,
          type: 'goal',
          teamId: 'away',
          scorerId: awayStarters[9].id,
          scorerName: awayStarters[9].name,
          assistId: awayStarters[6].id,
          assistName: awayStarters[6].name,
          description: `${awayStarters[9].name} 선수비 후역습 마무리!`,
          highlightPattern: 'high_press_counter',
          attackRoute: 'low_block_counter',
        },
      },
      {
        key: 'dup-gk-save',
        event: {
          minute: 35,
          half: 1,
          type: 'save',
          teamId: 'away', // away defends -> home attacks
          scorerId: awayStarters[0].id, // matches homeStarters[0].id in blind draft!
          scorerName: homeStarters[10].name,
          description: `${homeStarters[10].name} 감아차기, 골키퍼 슈퍼 세이브!`,
          highlightPattern: 'cut_inside_curler',
          attackRoute: 'cut_inside_curler',
          highlightOutcome: 'save',
        },
      },
      {
        key: 'rebound-home',
        event: {
          minute: 41,
          half: 1,
          type: 'goal',
          teamId: 'home',
          scorerId: homeStarters[9].id,
          scorerName: homeStarters[9].name,
          description: `${homeStarters[9].name} 세컨볼 마무리!`,
          highlightPattern: 'rebound_finish',
          attackRoute: 'rebound_poach',
        },
      },
    ];

    const sim = createPitchSimState({
      seed: 'bug1-staging-and-range-verification',
      homeTeamId: 'home',
      awayTeamId: 'away',
      home: makeTeamInput('4-3-3', 'possession', 'tiki_taka', homeStarters),
      away: makeTeamInput('4-2-3-1', 'counter', 'catenaccio', awayStarters),
      startMinute: 0,
      endMinute: 45,
      half: 1,
      targetHomePossession: 52,
      homeShotsTarget: 7,
      awayShotsTarget: 6,
      homeXgTarget: 1.3,
      awayXgTarget: 1.1,
      homeGoalsSoFar: 0,
      awayGoalsSoFar: 0,
      events: testEvents,
    });

    const shotDepthByKey = new Map<string, number>();
    let pkSetupVerified = false;
    let cornerSetupVerified = false;
    let fkSetupVerified = false;
    let dupGkShooterIdx = -1;

    for (let tick = 0; tick < 8000 && !sim.completed; tick += 1) {
      stepPitchSim(sim, FIXED_DT);
      const cue = sim.director;
      if (!cue) continue;

      // Verify exact set-piece ball placement & player staging
      if (cue.key === 'pk-home' && cue.stage === 'set_piece_setup' && !pkSetupVerified) {
        pkSetupVerified = true;
        expect(sim.ball.x).toBeCloseTo(0.885, 3);
        expect(sim.ball.y).toBeCloseTo(0.50, 3);
        expect(sim.ball.ownerIdx).toBeNull();
        // Every other outfielder outside penalty box (x <= 0.82)
        for (let k = 1; k < 11; k += 1) {
          if (k !== cue.scorerIdx) {
            expect(sim.homeAgents[k].x).toBeLessThanOrEqual(0.82);
          }
          expect(sim.awayAgents[k].x).toBeLessThanOrEqual(0.82);
        }
      }

      if (cue.key === 'corner-away' && cue.stage === 'set_piece_setup' && !cornerSetupVerified) {
        cornerSetupVerified = true;
        expect(getAttackDepth(false, sim.ball.x)).toBeGreaterThanOrEqual(0.97);
        expect(sim.ball.y <= 0.05 || sim.ball.y >= 0.95).toBe(true);
        // Box packed with attackers & defenders (depth >= 0.78)
        const boxAttackers = sim.awayAgents.filter(
          (a) => a.slotIndex !== 0 && getAttackDepth(false, a.x) >= 0.78,
        ).length;
        expect(boxAttackers).toBeGreaterThanOrEqual(5);
      }

      if (cue.key === 'fk-home' && cue.stage === 'set_piece_setup' && !fkSetupVerified) {
        fkSetupVerified = true;
        expect(getAttackDepth(true, sim.ball.x)).toBeCloseTo(0.745, 2);
        // 4-man wall lined up cleanly ahead of ball
        for (const wIdx of [4, 5, 6, 7]) {
          expect(sim.awayAgents[wIdx].x).toBeCloseTo(0.835, 2);
        }
      }

      if (cue.key === 'dup-gk-save') {
        dupGkShooterIdx = cue.scorerIdx;
      }

      // Record exact shot launch depth on shot_flight entry
      if (cue.stage === 'shot_flight' && !shotDepthByKey.has(cue.key)) {
        const launchDepth = getAttackDepth(cue.isHomeAttack, cue.shotOrigin.x);
        shotDepthByKey.set(cue.key, launchDepth);
      }
    }

    expect(sim.completed).toBe(true);
    expect(pkSetupVerified).toBe(true);
    expect(cornerSetupVerified).toBe(true);
    expect(fkSetupVerified).toBe(true);
    // Attacking GK (slot 0) MUST NEVER be chosen as shooter even when both teams share GK ID!
    expect(dupGkShooterIdx).toBeGreaterThan(0);

    // Every single shot fired strictly inside realistic shooting range (ZERO behind-halfway shots!)
    expect(shotDepthByKey.size).toBe(testEvents.length);
    expect(shotDepthByKey.get('pk-home')!).toBeCloseTo(0.885, 2);
    expect(shotDepthByKey.get('corner-away')!).toBeGreaterThanOrEqual(0.78);
    expect(shotDepthByKey.get('fk-home')!).toBeGreaterThanOrEqual(MIN_DIRECT_FK_SHOT_DEPTH);
    expect(shotDepthByKey.get('counter-away')!).toBeGreaterThanOrEqual(MIN_OPEN_PLAY_SHOT_DEPTH);
    expect(shotDepthByKey.get('dup-gk-save')!).toBeGreaterThanOrEqual(MIN_OPEN_PLAY_SHOT_DEPTH);
    expect(shotDepthByKey.get('rebound-home')!).toBeGreaterThanOrEqual(0.78);
  });

  it('12. Bug 2 Regression: Box & Final-Third Zone Rules block 40~50m backpasses behind halfway', () => {
    const homeStarters = makeSquadForFormation('4-3-3', 0);
    const awayStarters = makeSquadForFormation('4-2-3-1', 1);

    let observedZonePasses = 0;
    let illegalBackpasses = 0;
    let totalBlocked = 0;

    for (const seed of ['bug2-s1', 'bug2-s2', 'bug2-s3', 'bug2-s4']) {
      const sim = createPitchSimState({
        seed,
        homeTeamId: 'home',
        awayTeamId: 'away',
        home: makeTeamInput('4-3-3', 'possession', 'tiki_taka', homeStarters),
        away: makeTeamInput('4-2-3-1', 'counter', 'catenaccio', awayStarters),
        startMinute: 0,
        endMinute: 45,
        half: 1,
        targetHomePossession: 64,
        homeShotsTarget: 10,
        awayShotsTarget: 3,
        homeXgTarget: 1.6,
        awayXgTarget: 0.4,
        homeGoalsSoFar: 0,
        awayGoalsSoFar: 0,
        events: [],
      });

      // Place home attacker right in front of opponent goal (box zone) with CBs wide open behind halfway!
      const testCarrierIdx = 9;
      sim.homeAgents[testCarrierIdx].x = 0.87;
      sim.homeAgents[testCarrierIdx].y = 0.24;
      sim.homeAgents[7].x = 0.74; // 2nd-line CM nearby (within 0.18 backpass cap)
      sim.homeAgents[7].y = 0.42;
      sim.homeAgents[8].x = 0.84; // box teammate for cutback/layoff
      sim.homeAgents[8].y = 0.52;
      sim.homeAgents[2].x = 0.34; // wide open CB behind halfway!
      sim.homeAgents[2].y = 0.72;
      sim.homeAgents[3].x = 0.36;
      sim.homeAgents[3].y = 0.28;
      sim.possessionIsHome = true;
      sim.ball.ownerTeamIsHome = true;
      sim.ball.ownerIdx = testCarrierIdx;
      sim.ball.x = 0.87;
      sim.ball.y = 0.24;
      sim.carrierHoldTimer = sim.carrierDecisionDelay;

      let prevPassCount = 0;
      for (let tick = 0; tick < 2400 && !sim.completed; tick += 1) {
        stepPitchSim(sim, FIXED_DT);
        if (sim.stats.passesAttempted > prevPassCount) {
          prevPassCount = sim.stats.passesAttempted;
          const b = sim.ball;
          const isHomePass = b.lastTouchTeamIsHome;
          const fromDepth = getAttackDepth(isHomePass, b.originX);
          const toDepth = getAttackDepth(isHomePass, b.destX);
          const backDist = Math.max(0, fromDepth - toDepth);

          if (fromDepth >= BOX_ZONE_MIN_DEPTH) {
            observedZonePasses += 1;
            if (toDepth < 0.48 || backDist > MAX_BOX_BACKPASS_DIST + 0.08) {
              illegalBackpasses += 1;
            }
          } else if (fromDepth >= FINAL_THIRD_MIN_DEPTH) {
            observedZonePasses += 1;
            if (toDepth < 0.46 || backDist > MAX_FINAL_THIRD_BACKPASS_DIST + 0.08) {
              illegalBackpasses += 1;
            }
          }
        }
      }
      totalBlocked += sim.stats.longRangeBackpassesBlocked;
    }

    expect(observedZonePasses).toBeGreaterThan(0);
    expect(illegalBackpasses).toBe(0);
    expect(totalBlocked).toBeGreaterThan(0);
  });

  it('13. Bug 3 Regression: Late-Game Urgency AI shifts trailing team (incl. 2nd-leg agg) to all-out attack & CB box join', () => {
    const homeStarters = makeSquadForFormation('4-3-3', 0);
    const awayStarters = makeSquadForFormation('4-2-3-1', 1);

    // 1) Formula checks across minutes & deficits
    const u50 = computeGameStateUrgency({ minute: 50, scoreDiff: -1 });
    const u78 = computeGameStateUrgency({ minute: 78, scoreDiff: -1 });
    const u86 = computeGameStateUrgency({ minute: 86, scoreDiff: -1 });
    const uLead86 = computeGameStateUrgency({ minute: 86, scoreDiff: 1 });

    expect(u50.attackUrgency).toBe(0);
    expect(u78.attackUrgency).toBeGreaterThan(0.4);
    expect(u86.attackUrgency).toBeGreaterThan(0.85);
    expect(u86.cbBoxJoin).toBe(true);
    expect(uLead86.protectUrgency).toBeGreaterThan(0.85);
    expect(uLead86.attackUrgency).toBe(0);

    // 2) 2nd-leg knockout aggregate deficit: home leads 1-0 tonight, but lost 1st leg 0-2 -> agg 1-2 (trailing -1!)
    const trailingSim = createPitchSimState({
      seed: 'bug3-late-urgency-agg-trailing',
      homeTeamId: 'home',
      awayTeamId: 'away',
      home: makeTeamInput('4-3-3', 'possession', 'tiki_taka', homeStarters),
      away: makeTeamInput('4-2-3-1', 'counter', 'catenaccio', awayStarters),
      startMinute: 74,
      endMinute: 90,
      half: 2,
      targetHomePossession: 58,
      homeShotsTarget: 10,
      awayShotsTarget: 4,
      homeXgTarget: 1.5,
      awayXgTarget: 0.5,
      homeGoalsSoFar: 1,
      awayGoalsSoFar: 0,
      isKnockoutDecider: true,
      aggHomeBeforeMatch: 0,
      aggAwayBeforeMatch: 2,
      events: [],
    });

    const initialPatience = trailingSim.homeDoctrine.buildUpPatience;
    const initialLine = trailingSim.homeDoctrine.defensiveLineOffset;

    for (let tick = 0; tick < 1800 && !trailingSim.completed; tick += 1) {
      stepPitchSim(trailingSim, FIXED_DT);
    }

    // By 88'+, trailing home team dynamically slashed patience, raised defensive line, activated 3-man press & CB box join!
    expect(trailingSim.homeDoctrine.attackUrgency).toBeGreaterThan(0.9);
    expect(trailingSim.homeDoctrine.buildUpPatience).toBeLessThan(initialPatience - 0.25);
    expect(trailingSim.homeDoctrine.defensiveLineOffset).toBeGreaterThan(initialLine + 0.03);
    expect(trailingSim.homeDoctrine.pressersCount).toBe(3);
    expect(trailingSim.homeDoctrine.cbBoxJoin).toBe(true);
    // Leading on aggregate, away team shifted into late lead protection
    expect(trailingSim.awayDoctrine.protectUrgency).toBeGreaterThan(0.9);
    expect(trailingSim.awayDoctrine.defensiveLineOffset).toBeLessThan(
      trailingSim.baseAwayDoctrine.defensiveLineOffset,
    );

    // Verify CB (slot 2) joins opponent penalty box when cbBoxJoin is active in progression
    const homeBase = buildBaseFormationCoords('4-3-3', true);
    const cbTarget = computeDynamicFormationTarget({
      slotIndex: 2,
      base: homeBase[2],
      isHome: true,
      mode: 'progression',
      ball: { x: 0.72, y: 0.45 },
      doctrine: trailingSim.homeDoctrine,
      profile: trailingSim.homeAgents[2].profile,
      territorialShiftX: 0.08,
      simTime: 20,
    });
    expect(cbTarget.x).toBeGreaterThanOrEqual(0.84);
  });

  it('14. Bug 4 Regression: Single-ball invariant guarantees zero ghost trail while carried & zero discontinuity jumps', () => {
    const homeStarters = makeSquadForFormation('4-3-3', 0);
    const awayStarters = makeSquadForFormation('4-2-3-1', 1);

    const events: { key: string; event: MatchEvent }[] = [
      {
        key: 'goal-1',
        event: {
          minute: 12,
          half: 1,
          type: 'goal',
          teamId: 'home',
          scorerId: homeStarters[9].id,
          scorerName: homeStarters[9].name,
          description: '페널티킥 성공!',
          highlightPattern: 'penalty_kick',
        },
      },
      {
        key: 'goal-2',
        event: {
          minute: 28,
          half: 1,
          type: 'goal',
          teamId: 'away',
          scorerId: awayStarters[9].id,
          scorerName: awayStarters[9].name,
          description: '코너킥 헤더 골!',
          highlightPattern: 'corner_kick',
        },
      },
    ];

    const sim = createPitchSimState({
      seed: 'bug4-single-ball-integrity',
      homeTeamId: 'home',
      awayTeamId: 'away',
      home: makeTeamInput('4-3-3', 'wingplay', 'wing_bomber', homeStarters),
      away: makeTeamInput('4-2-3-1', 'gegenpressing', 'gegenpress_guru', awayStarters),
      startMinute: 0,
      endMinute: 45,
      half: 1,
      targetHomePossession: 50,
      homeShotsTarget: 6,
      awayShotsTarget: 6,
      homeXgTarget: 1.0,
      awayXgTarget: 1.0,
      homeGoalsSoFar: 0,
      awayGoalsSoFar: 0,
      events,
    });

    for (let tick = 0; tick < 6000 && !sim.completed; tick += 1) {
      stepPitchSim(sim, FIXED_DT);

      // Owned ball MUST NEVER carry stale trail dots behind carrier
      if (sim.ball.ownerIdx !== null) {
        expect(sim.ball.trail.length).toBe(0);
      }

      // During set-piece setup, ball is locked cleanly with zero prev/current split & zero trail
      if (sim.director?.stage === 'set_piece_setup') {
        expect(sim.ball.trail.length).toBe(0);
        expect(sim.ball.prevX).toBe(sim.ball.x);
        expect(sim.ball.prevY).toBe(sim.ball.y);
      }

      // No discontinuous teleport jump inside any trail segment
      for (let i = 1; i < sim.ball.trail.length; i += 1) {
        const jump = Math.hypot(
          sim.ball.trail[i].x - sim.ball.trail[i - 1].x,
          sim.ball.trail[i].y - sim.ball.trail[i - 1].y,
        );
        expect(jump).toBeLessThan(0.14);
      }
    }

    expect(sim.completed).toBe(true);
  });
});
