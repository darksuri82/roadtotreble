import { describe, expect, it } from 'vitest';
import awakeningModalSrc from '../components/common/AwakeningCelebrationModal.tsx?raw';
import ffpModalSrc from '../components/common/FfpOpeningNoticeModal.tsx?raw';
import staffCoachModalSrc from '../components/common/StaffCoachHireModal.tsx?raw';
import tacticAdaptModalSrc from '../components/common/TacticalAdaptationModal.tsx?raw';
import systemGuideSrc from '../components/guide/SystemGuideModal.tsx?raw';
import {
  AWAKENING_SECOND_COUNT_MULT,
  AWAKENING_THIRD_PLUS_MULT,
  computeAwakeningCandidateProbability,
  evaluatePostMatchAwakening,
} from '../engine/awakeningEngine';
import {
  computePlayerDraftCostM,
  DRAFT_BUDGET_CAP_M,
  evaluateSquadBudget,
  FFP_TIER1_CHEM_PENALTY,
  FFP_TIER1_LOSS_MORALE_EXTRA,
  FFP_TIER1_SCORE_MULTIPLIER,
  FFP_TIER1_WINDOW1_MAX_ATTEMPTS,
  FFP_TIER1_WINDOW2_MAX_ATTEMPTS,
  FFP_TIER2_CHEM_PENALTY,
  FFP_TIER2_LOSS_MORALE_EXTRA,
  FFP_TIER2_SCORE_MULTIPLIER,
  FFP_TIER2_WINDOW1_MAX_ATTEMPTS,
  FFP_TIER2_WINDOW2_MAX_ATTEMPTS,
  getFfpWindowMaxAttempts,
  LEGEND_FLAT_DRAFT_COST_M,
} from '../engine/budgetEngine';
import { calculateChemistry, calculateTeamRatings } from '../engine/chemistryEngine';
import {
  ACTIVE_PLAYERS,
  buildAiClubRoster,
  getLeagueById,
  LEGEND_PLAYERS,
} from '../engine/dataLoader';
import {
  HOF_RULE_ERA_V9,
  isV9EraHofEntry,
  LEGACY_STORAGE_KEY,
  loadLegacyState,
  saveLegacyState,
} from '../engine/legacyEngine';
import { simulateMatch, USER_CLUB_ID } from '../engine/matchEngine';
import { createPitchSimState } from '../engine/pitchSimEngine';
import {
  computePitchCounterSeverity,
  createInitialTacticalAdaptationState,
  evaluateAiPreMatchCounter,
  evaluateTacticalExposure,
  recordMatchTacticalAdaptation,
} from '../engine/tacticalAdaptationEngine';
import {
  applyTop15RankingLogic,
  buildGlobalSubmissionPayload,
  filterAndRankV9GlobalRows,
  GLOBAL_RANKING_RULE_ERA,
  type RawGlobalRankingRow,
  validateGlobalHofEntryIntegrity,
} from '../services/globalRankingService';
import type { PlayerConditionMap } from '../types/condition';
import { DEFAULT_MANAGER_AVATAR, type FormationId } from '../types/game';
import type { Fixture, PlayerSeasonStats, TacticId } from '../types/league';
import type { GlobalHofRankingEntry, HallOfFameEntry } from '../types/legacy';
import type { Player } from '../types/player';

function makeSeededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe('v9.2 Balance Calibration, Mobile Scroll & Pre-v9.0 Reset', () => {
  it('1 & 2) prices Legends at lower-Superstar tier (€135M) and enforces strengthened FFP Tier 1 & Tier 2 penalties', () => {
    const ovr90 = computePlayerDraftCostM({ ovr: 90, isLegend: false });
    const ovr91 = computePlayerDraftCostM({ ovr: 91, isLegend: false });
    const ovr92 = computePlayerDraftCostM({ ovr: 92, isLegend: false });
    expect(LEGEND_FLAT_DRAFT_COST_M).toBe(135);
    expect(LEGEND_FLAT_DRAFT_COST_M).toBeGreaterThan(ovr90);
    expect(LEGEND_FLAT_DRAFT_COST_M).toBeLessThanOrEqual(ovr91);
    expect(LEGEND_FLAT_DRAFT_COST_M).toBeLessThan(ovr92);

    const makeActive = (id: string, ovr: number): Player => ({
      ...ACTIVE_PLAYERS[0],
      id,
      ovr,
      isLegend: false,
    });

    // 1 Legend + smart value core + bench fits comfortably inside €950M
    const oneLegendSquad: Player[] = [
      LEGEND_PLAYERS[0], // 135
      makeActive('s1', 87), // 77
      makeActive('s2', 87), // 77
      makeActive('s3', 86), // 66
      makeActive('s4', 86), // 66
      makeActive('s5', 85), // 56
      makeActive('s6', 85), // 56
      makeActive('s7', 85), // 56
      makeActive('s8', 84), // 49
      makeActive('s9', 84), // 49
      makeActive('s10', 83), // 43
      makeActive('b1', 80), // 28
      makeActive('b2', 79), // 24
      makeActive('b3', 79), // 24
      makeActive('b4', 78), // 20
      makeActive('b5', 77), // 18
    ];
    const ev1 = evaluateSquadBudget(oneLegendSquad);
    expect(ev1.capM).toBe(DRAFT_BUDGET_CAP_M);
    expect(ev1.ffpTier).toBe(0);
    expect(ev1.remainingM).toBeGreaterThan(50);

    // Stacking 3 Legends + same quality core pushes clearly into FFP pressure
    const threeLegendSquad: Player[] = [
      ...LEGEND_PLAYERS.slice(0, 3), // 405
      makeActive('s1', 87), // 77
      makeActive('s2', 87), // 77
      makeActive('s3', 86), // 66
      makeActive('s4', 86), // 66
      makeActive('s5', 86), // 66
      makeActive('s6', 85), // 56
      makeActive('s7', 85), // 56
      makeActive('s8', 84), // 49
      makeActive('b1', 80), // 28
      makeActive('b2', 79), // 24
      makeActive('b3', 79), // 24
      makeActive('b4', 78), // 20
      makeActive('b5', 77), // 18
    ];
    const ev3 = evaluateSquadBudget(threeLegendSquad);
    expect(ev3.ffpTier).toBeGreaterThanOrEqual(1);
    expect(ev3.chemPenalty).toBe(-FFP_TIER1_CHEM_PENALTY);
    expect(ev3.window1MaxAttempts).toBe(FFP_TIER1_WINDOW1_MAX_ATTEMPTS);
    expect(ev3.window2MaxAttempts).toBe(FFP_TIER1_WINDOW2_MAX_ATTEMPTS);
    expect(ev3.extraLossMoraleDrop).toBe(FFP_TIER1_LOSS_MORALE_EXTRA);
    expect(ev3.scoreMultiplier).toBe(FFP_TIER1_SCORE_MULTIPLIER);

    // Stacking 5 Legends + strong starters hits FFP Tier 2
    const fiveLegendSquad: Player[] = [
      ...LEGEND_PLAYERS.slice(0, 5), // 675
      ...Array.from({ length: 6 }, (_, i) => makeActive(`t2s-${i}`, 86)), // 396
      ...Array.from({ length: 5 }, (_, i) => makeActive(`t2b-${i}`, 80)), // 140 -> total 1211 (+27.5%)
    ];
    const ev5 = evaluateSquadBudget(fiveLegendSquad);
    expect(ev5.ffpTier).toBe(2);
    expect(ev5.chemPenalty).toBe(-FFP_TIER2_CHEM_PENALTY);
    expect(ev5.window1MaxAttempts).toBe(FFP_TIER2_WINDOW1_MAX_ATTEMPTS);
    expect(ev5.window2MaxAttempts).toBe(FFP_TIER2_WINDOW2_MAX_ATTEMPTS);
    expect(ev5.extraLossMoraleDrop).toBe(FFP_TIER2_LOSS_MORALE_EXTRA);
    expect(ev5.scoreMultiplier).toBe(FFP_TIER2_SCORE_MULTIPLIER);

    expect(
      getFfpWindowMaxAttempts(
        {
          capM: 950,
          initialSpentM: 1000,
          excessM: 50,
          excessPct: 5.3,
          ffpTier: 1,
          transferCashM: 0,
          chemPenalty: -8,
          window1MaxAttempts: 2,
          window2MaxAttempts: 1,
          scoreMultiplier: 0.94,
          extraLossMoraleDrop: 1,
        },
        1,
      ),
    ).toBe(2);
  });

  it('4) creates a decisive 38R league point gap between Fixed vs Varied tactics and shifts 2D pitch doctrine', () => {
    const epl = getLeagueById('epl');
    const aiClubs = epl.clubs.slice(0, 19);
    const aiRosters = new Map(aiClubs.map((c) => [c.id, buildAiClubRoster(c, 'epl')]));
    const userStarters = buildAiClubRoster(epl.clubs[0], 'epl');
    const userClub = {
      ...epl.clubs[0],
      id: USER_CLUB_ID,
      name: 'User FC',
      shortName: 'USR',
      isUser: true,
    };

    const run38R = (mode: 'fixed' | 'varied', seed: number) => {
      const rng = makeSeededRng(seed);
      let adapt = createInitialTacticalAdaptationState();
      let pts = 0;
      let gf = 0;
      let ga = 0;
      const rotation: { f: FormationId; t: TacticId }[] = [
        { f: '4-3-3', t: 'possession' },
        { f: '4-2-3-1', t: 'balanced' },
        { f: '4-3-3', t: 'gegenpressing' },
        { f: '4-2-3-1', t: 'wingplay' },
      ];
      for (let round = 1; round <= 38; round += 1) {
        const opp = aiClubs[(round - 1) % aiClubs.length];
        const oppRoster = aiRosters.get(opp.id)!;
        const isHome = round % 2 === 1;
        const choice =
          mode === 'fixed'
            ? { f: '4-3-3' as FormationId, t: 'possession' as TacticId }
            : rotation[Math.floor((round - 1) / 3) % rotation.length];

        const chem = calculateChemistry(choice.f, userStarters, choice.t, 'tiki_taka');
        const ratings = calculateTeamRatings(
          choice.f,
          userStarters,
          chem.total,
          'tiki_taka',
          chem.slotSynergies,
          choice.t,
        );
        const fixture: Fixture = {
          id: `sim-${mode}-${seed}-r${round}`,
          round,
          homeTeamId: isHome ? USER_CLUB_ID : opp.id,
          awayTeamId: isHome ? opp.id : USER_CLUB_ID,
          played: false,
        };
        const res = simulateMatch(
          fixture,
          isHome ? userClub : opp,
          isHome ? opp : userClub,
          isHome ? userStarters : oppRoster,
          isHome ? oppRoster : userStarters,
          {
            userClubId: USER_CLUB_ID,
            formation: choice.f,
            tactic: choice.t,
            starters: userStarters,
            bench: [],
            ratings,
            chemistry: chem.total,
            slotSynergies: chem.slotSynergies,
            managerTraitId: 'tiki_taka',
            tacticalHistory: adapt.history,
          },
          rng,
        );
        const ug = isHome ? res.homeGoals : res.awayGoals;
        const og = isHome ? res.awayGoals : res.homeGoals;
        gf += ug;
        ga += og;
        if (ug > og) pts += 3;
        else if (ug === og) pts += 1;

        adapt = recordMatchTacticalAdaptation({
          prev: adapt,
          formation: choice.f,
          tactic: choice.t,
          round,
          competition: 'league',
        });
      }
      return { pts, gd: gf - ga };
    };

    const seasons = 20;
    let fixedPtsSum = 0;
    let variedPtsSum = 0;
    for (let s = 0; s < seasons; s += 1) {
      fixedPtsSum += run38R('fixed', 5000 + s * 97).pts;
      variedPtsSum += run38R('varied', 5000 + s * 97).pts;
    }
    const fixedAvg = fixedPtsSum / seasons;
    const variedAvg = variedPtsSum / seasons;
    const gap = variedAvg - fixedAvg;
    console.log(
      `[v9.2 Tactical Adaptation 38R x ${seasons}] Fixed avg=${fixedAvg.toFixed(1)} pts | Varied avg=${variedAvg.toFixed(1)} pts | Gap=+${gap.toFixed(1)} pts`,
    );
    expect(gap).toBeGreaterThanOrEqual(5);

    // Verify AI tiering: elite AI punishes much harder than lower-table AI
    const dangerHist = Array.from({ length: 8 }, (_, i) => ({
      formation: '4-3-3' as const,
      tactic: 'possession' as const,
      round: i + 1,
      competition: 'league' as const,
    }));
    const exp = evaluateTacticalExposure({
      history: dangerHist,
      formation: '4-3-3',
      tactic: 'possession',
    });
    const eliteC = evaluateAiPreMatchCounter({
      exposure: exp,
      userTactic: 'possession',
      aiDefaultTactic: 'balanced',
      aiManager: { ovr: 92, traitId: 'tiki_taka', preferredTactics: ['possession'] },
    });
    const lowC = evaluateAiPreMatchCounter({
      exposure: exp,
      userTactic: 'possession',
      aiDefaultTactic: 'balanced',
      aiManager: { ovr: 75, traitId: 'catenaccio', preferredTactics: ['counter'] },
    });
    expect(eliteC.userMidPenalty).toBeLessThan(-2.5);
    expect(Math.abs(eliteC.userMidPenalty)).toBeGreaterThan(Math.abs(lowC.userMidPenalty) * 3);

    // Verify 2D pitchSimEngine reflects tacticalCounterSeverity on doctrine
    const sev = computePitchCounterSeverity(exp.exposureScore, 92);
    expect(sev).toBeGreaterThanOrEqual(0.9);
    const normalSim = createPitchSimState({
      seed: 'adapt-2d-check',
      homeTeamId: USER_CLUB_ID,
      awayTeamId: epl.clubs[1].id,
      home: {
        formation: '4-3-3',
        tactic: 'possession',
        starters: userStarters,
        managerTraitId: 'tiki_taka',
        managerOvr: 86,
        tacticalCounterSeverity: 0,
      },
      away: {
        formation: '4-3-3',
        tactic: 'gegenpressing',
        starters: aiRosters.get(epl.clubs[1].id)!,
        managerTraitId: 'gegenpress_guru',
        managerOvr: 92,
      },
      startMinute: 0,
      endMinute: 45,
      half: 1,
      targetHomePossession: 50,
      homeShotsTarget: 6,
      awayShotsTarget: 6,
      homeXgTarget: 0.8,
      awayXgTarget: 0.8,
      homeGoalsSoFar: 0,
      awayGoalsSoFar: 0,
      events: [],
    });
    const counteredSim = createPitchSimState({
      seed: 'adapt-2d-check',
      homeTeamId: USER_CLUB_ID,
      awayTeamId: epl.clubs[1].id,
      home: {
        formation: '4-3-3',
        tactic: 'possession',
        starters: userStarters,
        managerTraitId: 'tiki_taka',
        managerOvr: 86,
        tacticalCounterSeverity: sev,
      },
      away: {
        formation: '4-3-3',
        tactic: 'gegenpressing',
        starters: aiRosters.get(epl.clubs[1].id)!,
        managerTraitId: 'gegenpress_guru',
        managerOvr: 92,
      },
      startMinute: 0,
      endMinute: 45,
      half: 1,
      targetHomePossession: 45,
      homeShotsTarget: 4,
      awayShotsTarget: 8,
      homeXgTarget: 0.5,
      awayXgTarget: 1.2,
      homeGoalsSoFar: 0,
      awayGoalsSoFar: 0,
      events: [],
    });
    expect(counteredSim.baseHomeDoctrine.tacticalFit).toBeLessThan(
      normalSim.baseHomeDoctrine.tacticalFit - 10,
    );
    expect(counteredSim.baseAwayDoctrine.lineDiscipline).toBeGreaterThan(
      normalSim.baseAwayDoctrine.lineDiscipline + 0.1,
    );
  });

  it('5) calibrates 50-season Awakening distribution (0~2/season, 3+ near-zero) and strongly rewards comprehensive utilization', () => {
    const epl = getLeagueById('epl');
    const baseStarters = buildAiClubRoster(epl.clubs[2], 'epl').map((p, i) => ({
      ...p,
      id: `sim-p-${i}`,
      isLegend: false,
      ovr: Math.min(86, Math.max(78, p.ovr)),
    }));
    const chem = calculateChemistry('4-3-3', baseStarters, 'possession', 'tiki_taka');

    // Compare high-utilization vs low-utilization candidate probabilities directly
    const midPlayer = baseStarters.find((p) => p.position === 'MF') ?? baseStarters[5];
    const highUtilEval = computeAwakeningCandidateProbability({
      player: midPlayer,
      rating: 8.2,
      goals: 1,
      assists: 1,
      minutes: 90,
      cleanSheet: false,
      seasonStats: {
        playerId: midPlayer.id,
        playerName: midPlayer.name,
        teamId: USER_CLUB_ID,
        teamName: 'User',
        teamShortName: 'USR',
        teamPrimaryColor: '#000',
        teamSecondaryColor: '#fff',
        isUserTeam: true,
        position: midPlayer.position,
        mainPositions: midPlayer.mainPositions,
        ovr: midPlayer.ovr,
        appearances: 14,
        starts: 14,
        subAppearances: 0,
        minutesPlayed: 1240,
        goals: 6,
        assists: 7,
        xgSum: 5,
        cleanSheets: 4,
        momCount: 4,
        ratingSum: 106.4,
        avgRating: 7.6,
        positionCounts: {},
        isLegend: false,
      },
      synergy: {
        slotIndex: 5,
        playerId: midPlayer.id,
        neighborBonus: 3,
        managerBonus: 1,
        totalBonus: 4,
        lineCount: 9,
        reasons: [],
        baseEffectiveOvr: midPlayer.ovr,
        effectiveOvrWithSynergy: midPlayer.ovr + 4,
      },
      hasSynergyContext: true,
      condition: {
        morale: 4,
        injury: null,
        consecutiveBenchMatches: 0,
        consecutiveMatchesPlayed: 4,
        recentGoalDrought: 0,
        lastMatchRating: 8.2,
      },
      managerTraitId: 'tiki_taka',
      positionPenalty: 0,
      teamCountMult: 1.0,
      coachMult: 1.0,
    });

    const lowUtilEval = computeAwakeningCandidateProbability({
      player: midPlayer,
      rating: 7.5,
      goals: 0,
      assists: 0,
      minutes: 60,
      cleanSheet: false,
      seasonStats: {
        playerId: midPlayer.id,
        playerName: midPlayer.name,
        teamId: USER_CLUB_ID,
        teamName: 'User',
        teamShortName: 'USR',
        teamPrimaryColor: '#000',
        teamSecondaryColor: '#fff',
        isUserTeam: true,
        position: midPlayer.position,
        mainPositions: midPlayer.mainPositions,
        ovr: midPlayer.ovr,
        appearances: 10,
        starts: 6,
        subAppearances: 4,
        minutesPlayed: 620,
        goals: 0,
        assists: 1,
        xgSum: 0.8,
        cleanSheets: 1,
        momCount: 0,
        ratingSum: 67.0,
        avgRating: 6.7,
        positionCounts: {},
        isLegend: false,
      },
      synergy: {
        slotIndex: 5,
        playerId: midPlayer.id,
        neighborBonus: 0,
        managerBonus: 0,
        totalBonus: 0,
        lineCount: 0,
        reasons: [],
        baseEffectiveOvr: midPlayer.ovr - 6,
        effectiveOvrWithSynergy: midPlayer.ovr - 6,
      },
      hasSynergyContext: true,
      condition: {
        morale: -2,
        injury: null,
        consecutiveBenchMatches: 0,
        consecutiveMatchesPlayed: 12,
        recentGoalDrought: 4,
        lastMatchRating: 7.5,
      },
      managerTraitId: 'catenaccio',
      positionPenalty: -6,
      teamCountMult: 1.0,
      coachMult: 1.0,
    });

    expect(highUtilEval.finalProb / lowUtilEval.finalProb).toBeGreaterThan(15);

    // 50-season simulation across realistic 42-match seasons (38R + 4 Cup/UCL matches)
    const SEASONS = 50;
    const dist = { zero: 0, one: 0, two: 0, threePlus: 0 };
    let totalAwakened = 0;
    let highUtilAwakenedCount = 0;
    let lowUtilAwakenedCount = 0;

    for (let s = 0; s < SEASONS; s += 1) {
      const rng = makeSeededRng(20260 + s * 131);
      const awakened: Record<
        string,
        { originalOvr: number; ovrGain: number; round: number; competition: 'league'; statDeltas: [] }
      > = {};
      const statsMap: Record<string, PlayerSeasonStats> = {};
      const condMap: PlayerConditionMap = {};

      // Make first 5 outfielders well-utilized (healthy rotation/high morale/synergy) & last 5 poorly-utilized (overworked/low morale/0 synergy)
      const customSyn = { ...chem.slotSynergies };
      baseStarters.forEach((p, idx) => {
        const isHighUtil = idx >= 1 && idx <= 5;
        condMap[p.id] = {
          morale: isHighUtil ? 4 : -1,
          injury: null,
          consecutiveBenchMatches: 0,
          consecutiveMatchesPlayed: isHighUtil ? 3 : 10,
          recentGoalDrought: 0,
        };
        if (customSyn[idx]) {
          customSyn[idx] = {
            ...customSyn[idx],
            neighborBonus: isHighUtil ? 3 : 0,
          };
        }
        statsMap[p.id] = {
          playerId: p.id,
          playerName: p.name,
          teamId: USER_CLUB_ID,
          teamName: 'User',
          teamShortName: 'USR',
          teamPrimaryColor: '#000',
          teamSecondaryColor: '#fff',
          isUserTeam: true,
          position: p.position,
          mainPositions: p.mainPositions,
          ovr: p.ovr,
          appearances: 0,
          starts: 0,
          subAppearances: 0,
          minutesPlayed: 0,
          goals: 0,
          assists: 0,
          xgSum: 0,
          cleanSheets: 0,
          momCount: 0,
          ratingSum: 0,
          avgRating: 7.0,
          positionCounts: {},
          isLegend: false,
        };
      });

      for (let m = 1; m <= 42; m += 1) {
        const ratingsById: Record<string, number> = {};
        const goalsById: Record<string, number> = {};
        const assistsById: Record<string, number> = {};
        const minsById: Record<string, number> = {};
        const cs = rng() < 0.35;

        baseStarters.forEach((p, idx) => {
          const isHighUtil = idx >= 1 && idx <= 5;
          // Realistic rating distribution: ~2-3 starters reach 7.4+ in a match
          const baseR = isHighUtil ? 6.95 + rng() * 1.45 : 6.75 + rng() * 1.1;
          const rating = Math.round(baseR * 10) / 10;
          ratingsById[p.id] = rating;
          minsById[p.id] = 90;
          const g = rating >= 7.9 && rng() < 0.45 ? 1 : 0;
          const a = rating >= 7.7 && rng() < 0.35 ? 1 : 0;
          if (g) goalsById[p.id] = g;
          if (a) assistsById[p.id] = a;

          const st = statsMap[p.id];
          st.appearances += 1;
          st.starts += 1;
          st.minutesPlayed += 90;
          st.goals += g;
          st.assists += a;
          if (cs) st.cleanSheets += 1;
          st.ratingSum += rating;
          st.avgRating = st.ratingSum / st.appearances;
        });

        const res = evaluatePostMatchAwakening({
          starters: baseStarters,
          bench: [],
          formation: '4-3-3',
          matchPlayedNumber: m,
          round: m,
          competition: 'league',
          ratingsByPlayerId: ratingsById,
          goalsByPlayerId: goalsById,
          assistsByPlayerId: assistsById,
          minutesByPlayerId: minsById,
          cleanSheet: cs,
          allPlayerStats: statsMap,
          slotSynergies: customSyn,
          conditionMap: condMap,
          managerTraitId: 'tiki_taka',
          existingAwakenedPlayers: awakened,
          rng,
        });

        if (res.triggered && res.awakenedPlayer && res.record) {
          awakened[res.awakenedPlayer.id] = {
            ...res.record,
            competition: 'league',
            statDeltas: [],
          };
          const idx = baseStarters.findIndex((p) => p.id === res.awakenedPlayer!.id);
          if (idx >= 1 && idx <= 5) highUtilAwakenedCount += 1;
          else if (idx >= 6) lowUtilAwakenedCount += 1;
        }
      }

      const cnt = Object.keys(awakened).length;
      totalAwakened += cnt;
      if (cnt === 0) dist.zero += 1;
      else if (cnt === 1) dist.one += 1;
      else if (cnt === 2) dist.two += 1;
      else dist.threePlus += 1;
    }

    console.log(
      `[v9.2 Awakening 50-Season Sim] 0명=${dist.zero}(${(dist.zero * 2).toFixed(0)}%) | 1명=${dist.one}(${(dist.one * 2).toFixed(0)}%) | 2명=${dist.two}(${(dist.two * 2).toFixed(0)}%) | 3명+=${dist.threePlus}(${(dist.threePlus * 2).toFixed(0)}%) | 평균=${(totalAwakened / SEASONS).toFixed(2)}명/시즌 | 고활용=${highUtilAwakenedCount} vs 저활용=${lowUtilAwakenedCount}`,
    );

    expect(AWAKENING_SECOND_COUNT_MULT).toBeLessThan(1);
    expect(AWAKENING_THIRD_PLUS_MULT).toBeLessThanOrEqual(0.1);
    expect(dist.threePlus).toBeLessThanOrEqual(4); // <= 8% (near-zero)
    expect(dist.zero + dist.one + dist.two).toBeGreaterThanOrEqual(46);
    expect(highUtilAwakenedCount).toBeGreaterThan(lowUtilAwakenedCount * 3);
  });

  it('7) purges pre-v9.0 local HOF entries via one-time migration while preserving v9.0+ entries, and excludes pre-v9.0 global TOP 15 rows from listing & cutoff', () => {
    // Mock browser localStorage
    const mem = new Map<string, string>();
    const prevWindow = (globalThis as unknown as { window?: unknown }).window;
    (globalThis as unknown as { window: unknown }).window = {
      localStorage: {
        getItem: (k: string) => mem.get(k) ?? null,
        setItem: (k: string, v: string) => mem.set(k, v),
        removeItem: (k: string) => mem.delete(k),
      },
    };
    try {
      const makeEntry = (id: string, score: number, ruleEra?: string): HallOfFameEntry => ({
        id,
        runId: `run-${id}`,
        ...(ruleEra ? { ruleEra } : {}),
        completedAt: '2026-11-25T10:00:00.000Z',
        userClub: {
          name: `Club ${id}`,
          shortName: 'CLB',
          primaryColor: '#10b981',
          secondaryColor: '#fff',
          pattern: 'solid',
        },
        managerTraitId: 'tiki_taka',
        leagueId: 'epl',
        leagueKoreanName: '프리미어리그',
        formation: '4-3-3',
        defaultTactic: 'possession',
        finalLeagueRank: 1,
        leaguePoints: 90,
        leagueTotalRounds: 38,
        leagueRecord: '28승 6무 4패',
        cupName: 'FA컵',
        cupResultLabel: '우승',
        cupWon: true,
        uclResultLabel: '우승',
        uclWon: true,
        isTreble: true,
        isLeagueChampion: true,
        teamAvgOvr: 87.5,
        chemistry: 90,
        seasonScore: {
          leagueConvertedScore: 2200,
          leagueRankBonus: 1200,
          cupBonus: 850,
          uclBonus: 2500,
          honorsBonus: 1600,
          underdogBonus: 0,
          totalScore: score,
          grade: 'S+',
        },
        trophies: ['프리미어리그 우승'],
        topScorerSummary: '에이스 (25골)',
        starters: ACTIVE_PLAYERS.slice(0, 11).map((p) => ({
          id: p.id,
          name: p.name,
          ovr: p.ovr,
          position: p.position,
          mainPositions: [...p.mainPositions],
          isLegend: p.isLegend,
          goals: 2,
          assists: 1,
          avgRating: 7.5,
        })),
        bench: ACTIVE_PLAYERS.slice(11, 16).map((p) => ({
          id: p.id,
          name: p.name,
          ovr: p.ovr,
          position: p.position,
          mainPositions: [...p.mainPositions],
          isLegend: p.isLegend,
          goals: 0,
          assists: 0,
          avgRating: 7.0,
        })),
        fullStarters: ACTIVE_PLAYERS.slice(0, 11),
        fullBench: ACTIVE_PLAYERS.slice(11, 16),
        unlockedAchievementIds: [],
      });

      const oldEntry = makeEntry('old-v8', 12900);
      const v9Entry = makeEntry('new-v9', 9800, HOF_RULE_ERA_V9);

      // Seed unmigrated pre-v9.0 localStorage payload directly
      mem.set(
        LEGACY_STORAGE_KEY,
        JSON.stringify({
          version: 1,
          hallOfFame: [oldEntry, v9Entry],
          unlockedAchievements: { dynasty_treble: { id: 'dynasty_treble', unlockedAt: '2026-01-01', clubName: 'Old', leagueName: 'EPL', summaryNote: '' } },
          dreamMatchRecords: {},
        }),
      );

      const migrated = loadLegacyState();
      expect(migrated.hofMigrationEra).toBe(HOF_RULE_ERA_V9);
      expect(migrated.hallOfFame).toHaveLength(1);
      expect(migrated.hallOfFame[0].id).toBe('new-v9');
      expect(isV9EraHofEntry(migrated.hallOfFame[0])).toBe(true);
      expect(migrated.hofSummaryCache).toEqual({
        count: 1,
        bestScore: 9800,
        trebleCount: 1,
        uclWins: 1,
      });
      // Achievements preserved
      expect(migrated.unlockedAchievements.dynasty_treble).toBeDefined();

      // Integrity validation blocks pre-v9.0 entry and accepts v9.0+ entry
      expect(validateGlobalHofEntryIntegrity(oldEntry).valid).toBe(false);
      expect(validateGlobalHofEntryIntegrity(v9Entry).valid).toBe(true);

      const payload = buildGlobalSubmissionPayload(v9Entry);
      expect(payload.rule_era).toBe(GLOBAL_RANKING_RULE_ERA);
      expect(payload.score_breakdown.ruleEra).toBe(GLOBAL_RANKING_RULE_ERA);
      expect(payload.squad_snapshot.ruleEra).toBe(GLOBAL_RANKING_RULE_ERA);

      // Raw Supabase row filter excludes pre-v9.0 rows from both listing and cutoff
      const makeRawRow = (id: string, score: number, ruleEra?: string | null): RawGlobalRankingRow => ({
        id,
        run_id: `run-${id}`,
        rule_era: ruleEra ?? null,
        season_score: score,
        grade: 'S+',
        club_name: `Club ${id}`,
        manager_name: '감독',
        league_id: 'epl',
        league_korean_name: '프리미어리그',
        final_league_rank: 1,
        league_points: 90,
        league_record: '28승 6무 4패',
        cup_name: 'FA컵',
        cup_result_label: '우승',
        cup_won: true,
        ucl_result_label: '우승',
        ucl_won: true,
        is_league_champion: true,
        is_treble: true,
        trophies: [],
        formation: '4-3-3',
        default_tactic: 'possession',
        manager_trait_id: 'tiki_taka',
        manager_rating: 92,
        team_avg_ovr: 87.5,
        chemistry: 90,
        top_scorer_summary: '-',
        club_profile: {},
        manager_avatar: DEFAULT_MANAGER_AVATAR,
        score_breakdown: ruleEra ? { totalScore: score, grade: 'S+', ruleEra } : { totalScore: score, grade: 'S+' },
        squad_snapshot: { starters: [], bench: [] },
        achieved_at: '2026-11-25T10:00:00.000Z',
      });

      const filtered = filterAndRankV9GlobalRows([
        makeRawRow('legacy-1', 14500, null),
        makeRawRow('legacy-2', 13800, 'v8.18'),
        makeRawRow('v9-1', 10200, 'v9.0'),
        makeRawRow('v9-2', 9400, 'v9.2'),
      ]);
      expect(filtered.entries).toHaveLength(2);
      expect(filtered.entries[0].id).toBe('v9-1');
      expect(filtered.entries[0].rank).toBe(1);
      expect(filtered.cutoffScore).toBe(9400);

      // Pure applyTop15RankingLogic ignores pre-v9.0 existing rows & rejects pre-v9.0 candidate
      const legacyGlobal = {
        ...filtered.entries[0],
        id: 'old-g',
        runId: 'run-old-g',
        ruleEra: undefined,
        scoreBreakdown: { ...filtered.entries[0].scoreBreakdown, ruleEra: undefined },
        squadSnapshot: { starters: [], bench: [] },
      } as GlobalHofRankingEntry;
      const rejectOld = applyTop15RankingLogic(filtered.entries, legacyGlobal);
      expect(rejectOld.result.ok).toBe(false);
      expect(rejectOld.result.entered).toBe(false);

      saveLegacyState(migrated);
    } finally {
      (globalThis as unknown as { window?: unknown }).window = prevWindow;
    }
  });

  it('6 & 3) enforces single-scroll 90dvh mobile-safe structure on StaffCoachHireModal & v9.0 modals and 6-tab Guidebook IA', () => {
    const modals = [
      staffCoachModalSrc,
      tacticAdaptModalSrc,
      awakeningModalSrc,
      ffpModalSrc,
      systemGuideSrc,
    ];
    for (const src of modals) {
      expect(src).toContain('max-h-[90dvh]');
      expect(src).toContain('flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y');
      expect(src).toContain('shrink-0');
      expect(src).not.toContain('100vh');
      expect(src).not.toContain('zoom:');
    }

    expect(systemGuideSrc).toContain('TAB_SECTIONS');
    expect(systemGuideSrc).toContain('jumpToGuideSection');
    expect(systemGuideSrc).toContain('HOF_RESET_NOTICE_TEXT');
  });
});
