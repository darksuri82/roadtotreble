import { describe, expect, it } from 'vitest';
import { FORMATIONS } from '../data/formations';
import {
  applyAwakeningToPlayer,
  AWAKENING_FOURTH_PLUS_MULT,
  AWAKENING_OVR_HARD_CAP,
  AWAKENING_SECOND_COUNT_MULT,
  AWAKENING_SUPERSTAR_MAX_GAIN,
  AWAKENING_SUPERSTAR_OVR_THRESHOLD,
  AWAKENING_THIRD_COUNT_MULT,
  evaluatePostMatchAwakening,
  isValidAwakeningRecord,
  rollAwakeningOvrGain,
} from '../engine/awakeningEngine';
import {
  CASH_LEGEND_CHANCE_MAX_BONUS,
  CASH_STAR_GUARD_RELIEF_THRESHOLD_M,
  classifyFfpTier,
  computeCashLegendChanceBonus,
  computeCashOfferTp,
  computePlayerDraftCostM,
  createDefaultSeasonBudgetState,
  createSeasonBudgetState,
  deductTransferCash,
  DRAFT_BUDGET_CAP_M,
  evaluateSquadBudget,
  FFP_TIER1_CHEM_PENALTY,
  FFP_TIER1_LOSS_MORALE_EXTRA,
  FFP_TIER1_MAX_OVERRUN_PCT,
  FFP_TIER1_SCORE_MULTIPLIER,
  FFP_TIER1_WINDOW1_MAX_ATTEMPTS,
  FFP_TIER1_WINDOW2_MAX_ATTEMPTS,
  FFP_TIER2_CHEM_PENALTY,
  FFP_TIER2_LOSS_MORALE_EXTRA,
  FFP_TIER2_SCORE_MULTIPLIER,
  FFP_TIER2_SCORE_PENALTY_PCT,
  FFP_TIER2_WINDOW1_MAX_ATTEMPTS,
  FFP_TIER2_WINDOW2_MAX_ATTEMPTS,
  LEGEND_FLAT_DRAFT_COST_M,
} from '../engine/budgetEngine';
import {
  calculateChemistry,
  calculateTeamRatings,
} from '../engine/chemistryEngine';
import { updateSquadConditionsAfterMatch } from '../engine/conditionEngine';
import {
  ACTIVE_PLAYERS,
  ALL_CLUBS_WITH_LEAGUE,
  buildAiClubRoster,
  LEGEND_PLAYERS,
} from '../engine/dataLoader';
import { computeSeasonScore } from '../engine/legacyEngine';
import {
  evaluateStaffCoachEffect,
  getDevCoachPlayerBonus,
  getStaffCoachById,
  rollMidSeasonStaffCoachOffers,
  STAFF_COACH_CHEM_LIFT,
  STAFF_COACH_DEV_OVR_LIFT,
  STAFF_COACH_LINE_LIFT,
  STAFF_COACH_LIST,
  STAFF_COACH_TACTIC_OVR_LIFT,
  STAFF_COACHES,
} from '../engine/staffCoachEngine';
import {
  computeLineupStaminaImpact,
  computePlayerStaminaPct,
} from '../engine/staminaEngine';
import {
  COACH_ADAPTATION_MITIGATION,
  createInitialTacticalAdaptationState,
  evaluateAiPreMatchCounter,
  evaluateTacticalExposure,
  EXPOSURE_DANGER_THRESHOLD,
  EXPOSURE_RESET_ALERT_BELOW,
  EXPOSURE_WARNING_THRESHOLD,
  recordMatchTacticalAdaptation,
} from '../engine/tacticalAdaptationEngine';
import {
  analyzeClubPositionNeeds,
  evaluateTradePackage,
} from '../engine/transferEngine';
import type { Player } from '../types/player';

function createSeededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

describe('v9.0 Budget / FFP Soft Cap & Legend Flat Cost', () => {
  it('assigns every Era Classic player the exact unified flat cost (€130M), between OVR 90 and 91', () => {
    expect(LEGEND_FLAT_DRAFT_COST_M).toBe(130);
    expect(LEGEND_PLAYERS.length).toBeGreaterThan(20);

    for (const legend of LEGEND_PLAYERS) {
      expect(computePlayerDraftCostM(legend)).toBe(LEGEND_FLAT_DRAFT_COST_M);
    }

    const ovr90Cost = computePlayerDraftCostM({ ovr: 90, isLegend: false });
    const ovr91Cost = computePlayerDraftCostM({ ovr: 91, isLegend: false });
    const ovr92Cost = computePlayerDraftCostM({ ovr: 92, isLegend: false });
    const ovr94Cost = computePlayerDraftCostM({ ovr: 94, isLegend: false });

    // Era Classic flat cost sits between compressed OVR 90 (€122M) and OVR 91 (€138M)
    expect(LEGEND_FLAT_DRAFT_COST_M).toBeGreaterThan(ovr90Cost);
    expect(LEGEND_FLAT_DRAFT_COST_M).toBeLessThanOrEqual(ovr91Cost);
    expect(LEGEND_FLAT_DRAFT_COST_M).toBeLessThan(ovr92Cost);
    expect(ovr91Cost).toBeLessThan(ovr94Cost);
  });

  it('keeps active player cost curve monotonic non-decreasing across OVR 68..95', () => {
    let prev = 0;
    for (let ovr = 68; ovr <= 95; ovr += 1) {
      const cost = computePlayerDraftCostM({ ovr, isLegend: false });
      expect(cost).toBeGreaterThanOrEqual(prev);
      prev = cost;
    }
  });

  it('allows a realistic title-contender squad (1 Legend + 84~87 core + bench) to fit under €950M cap', () => {
    const legends = LEGEND_PLAYERS.slice(0, 1); // 1 * 135 = 135
    const makeActive = (id: string, ovr: number): Player => ({
      ...ACTIVE_PLAYERS[0],
      id,
      ovr,
      isLegend: false,
    });
    const squad: Player[] = [
      ...legends, // 135
      makeActive('a1', 87), // 80
      makeActive('a2', 85), // 57
      makeActive('a3', 86), // 69
      makeActive('a4', 86), // 69
      makeActive('a5', 86), // 69
      makeActive('a6', 85), // 57
      makeActive('a7', 85), // 57
      makeActive('a8', 85), // 57
      makeActive('a9', 84), // 50
      makeActive('a10', 84), // 50
      // 5 value bench picks (79..82)
      makeActive('b1', 82), // 35
      makeActive('b2', 81), // 31
      makeActive('b3', 80), // 28
      makeActive('b4', 79), // 24
      makeActive('b5', 79), // 24
    ];

    const ev = evaluateSquadBudget(squad);
    expect(ev.capM).toBe(DRAFT_BUDGET_CAP_M);
    expect(ev.ffpTier).toBe(0);
    expect(ev.remainingM).toBeGreaterThan(0);
    expect(ev.chemPenalty).toBe(0);
    expect(ev.window1MaxAttempts).toBe(3);
    expect(ev.window2MaxAttempts).toBe(3);
    expect(ev.scoreMultiplier).toBe(1.0);
    expect(ev.extraLossMoraleDrop).toBe(0);

    const seasonBudget = createSeasonBudgetState(squad);
    expect(seasonBudget.transferCashM).toBe(ev.remainingM);
  });

  it('classifies FFP Tier 1 (+1..+15%) and Tier 2 (>+15%) penalties accurately', () => {
    expect(FFP_TIER1_MAX_OVERRUN_PCT).toBe(15);
    expect(classifyFfpTier(DRAFT_BUDGET_CAP_M)).toBe(0);
    expect(classifyFfpTier(DRAFT_BUDGET_CAP_M + 1)).toBe(1);
    expect(classifyFfpTier(Math.floor(DRAFT_BUDGET_CAP_M * 1.15))).toBe(1);
    expect(classifyFfpTier(Math.ceil(DRAFT_BUDGET_CAP_M * 1.15) + 1)).toBe(2);

    const highSuperstars: Player[] = Array.from({ length: 16 }, (_, i) => ({
      ...ACTIVE_PLAYERS[0],
      id: `ss-${i}`,
      ovr: 90, // 122 each -> 1952M -> Tier 2
      isLegend: false,
    }));
    const tier2Eval = evaluateSquadBudget(highSuperstars);
    expect(tier2Eval.ffpTier).toBe(2);
    expect(tier2Eval.remainingM).toBe(0);
    expect(tier2Eval.chemPenalty).toBe(-FFP_TIER2_CHEM_PENALTY);
    expect(tier2Eval.window1MaxAttempts).toBe(FFP_TIER2_WINDOW1_MAX_ATTEMPTS);
    expect(tier2Eval.window2MaxAttempts).toBe(FFP_TIER2_WINDOW2_MAX_ATTEMPTS);
    expect(tier2Eval.scoreMultiplier).toBe(FFP_TIER2_SCORE_MULTIPLIER);
    expect(tier2Eval.extraLossMoraleDrop).toBe(FFP_TIER2_LOSS_MORALE_EXTRA);

    const tier1Squad: Player[] = Array.from({ length: 16 }, (_, i) => ({
      ...ACTIVE_PLAYERS[0],
      id: `t1-${i}`,
      ovr: i < 10 ? 86 : 85, // 10*69 + 6*57 = 1032M (+14.7% -> Tier 1)
      isLegend: false,
    }));
    const tier1Eval = evaluateSquadBudget(tier1Squad);
    expect(tier1Eval.ffpTier).toBe(1);
    expect(tier1Eval.remainingM).toBe(0);
    expect(tier1Eval.chemPenalty).toBe(-FFP_TIER1_CHEM_PENALTY);
    expect(tier1Eval.window1MaxAttempts).toBe(FFP_TIER1_WINDOW1_MAX_ATTEMPTS);
    expect(tier1Eval.window2MaxAttempts).toBe(FFP_TIER1_WINDOW2_MAX_ATTEMPTS);
    expect(tier1Eval.extraLossMoraleDrop).toBe(FFP_TIER1_LOSS_MORALE_EXTRA);
    expect(tier1Eval.scoreMultiplier).toBe(FFP_TIER1_SCORE_MULTIPLIER);

    // Verify FFP Tier 2 -12% penalty applies cleanly in computeSeasonScore
    const baseScoreInput = {
      leaguePoints: 86,
      leaguePlayed: 38,
      leagueGoalDifference: 45,
      leagueLosses: 4,
      leagueGoalsFor: 82,
      leagueGoalsAgainst: 37,
      finalLeagueRank: 1,
      cup: null,
      ucl: null,
      teamAvgOvr: 88,
      benchAvgOvr: 83,
      chemistry: 88,
      managerSynergyCount: 8,
      tacticalFit: 85,
    };
    const cleanScore = computeSeasonScore({
      ...baseScoreInput,
      ffpScoreMultiplier: 1.0,
    });
    const penalizedScore = computeSeasonScore({
      ...baseScoreInput,
      ffpScoreMultiplier: FFP_TIER2_SCORE_MULTIPLIER,
    });
    expect(penalizedScore.ffpPenaltyPct).toBe(FFP_TIER2_SCORE_PENALTY_PCT);
    expect(penalizedScore.totalScore).toBe(
      Math.round(cleanScore.totalScore * FFP_TIER2_SCORE_MULTIPLIER),
    );
    expect(penalizedScore.ffpPenaltyPoints).toBe(
      cleanScore.totalScore - penalizedScore.totalScore,
    );
  });

  it('converts cash sweeteners into TP, raises trade acceptance, boosts Legend FA chance, and deducts cleanly', () => {
    expect(computeCashOfferTp(0)).toBe(0);
    expect(computeCashOfferTp(40)).toBe(50); // 40 * 1.25
    expect(computeCashOfferTp(120)).toBe(143); // 100 * 1.25 + 20 * 0.90

    expect(computeCashLegendChanceBonus(0)).toBe(0);
    expect(computeCashLegendChanceBonus(40)).toBe(5); // round(4 * 1.2)
    expect(computeCashLegendChanceBonus(200)).toBe(CASH_LEGEND_CHANCE_MAX_BONUS);

    const clubEntry = ALL_CLUBS_WITH_LEAGUE.find((c) => c.club.att >= 85)!;
    const aiRoster = buildAiClubRoster(clubEntry.club, clubEntry.leagueId);
    const aiNeeds = analyzeClubPositionNeeds(aiRoster);
    const aiTarget = aiRoster.find((p) => p.ovr >= 85 && p.position !== 'GK') ?? aiRoster[1];
    const userSent: Player = {
      ...ACTIVE_PLAYERS.find((p) => p.ovr >= 81 && p.ovr <= 83 && p.position !== 'GK')!,
      id: 'user-trade-piece',
    };

    const userGk = ACTIVE_PLAYERS.find((p) => p.position === 'GK')!;
    const userSquad: Player[] = [
      userGk,
      userSent,
      ...ACTIVE_PLAYERS.filter(
        (p) => p.id !== userGk.id && p.id !== userSent.id && p.position !== 'GK',
      ).slice(0, 14),
    ];

    const withoutCash = evaluateTradePackage({
      userSentPlayers: [userSent],
      aiTargetPlayers: [aiTarget],
      aiFillerPlayers: [],
      userSquad,
      aiRoster,
      aiClub: clubEntry.club,
      aiNeeds,
      aiClubRank: 5,
      userRank: 3,
      aiLeagueSize: 20,
      userLeagueSize: 20,
      allPlayerStats: {},
      cashOfferM: 0,
    });
    const withCash = evaluateTradePackage({
      userSentPlayers: [userSent],
      aiTargetPlayers: [aiTarget],
      aiFillerPlayers: [],
      userSquad,
      aiRoster,
      aiClub: clubEntry.club,
      aiNeeds,
      aiClubRank: 5,
      userRank: 3,
      aiLeagueSize: 20,
      userLeagueSize: 20,
      allPlayerStats: {},
      cashOfferM: CASH_STAR_GUARD_RELIEF_THRESHOLD_M,
    });
    expect(withCash.userEffectiveTp).toBeGreaterThan(withoutCash.userEffectiveTp);
    expect(withCash.acceptanceChance).toBeGreaterThanOrEqual(withoutCash.acceptanceChance);

    const fallback = createDefaultSeasonBudgetState();
    expect(fallback.ffpTier).toBe(0);
    expect(fallback.window2MaxAttempts).toBe(3);

    const deducted = deductTransferCash({ ...fallback, transferCashM: 120 }, 45);
    expect(deducted?.transferCashM).toBe(75);
    const floorDeducted = deductTransferCash({ ...fallback, transferCashM: 20 }, 100);
    expect(floorDeducted?.transferCashM).toBe(0);
  });
});

describe('v9.0/v9.1 AI Pre-Match Tactical Adaptation (8-Match Danger & Danger-Only Popup)', () => {
  it('reaches danger at 8 consecutive identical matches, triggers popup ONLY on danger (never warning), prevents spam, and re-arms after variation', () => {
    let state = createInitialTacticalAdaptationState();
    const alertsFired: { round: number; tier: string }[] = [];

    // Matches 1..7 must NEVER fire a popup (1..4 low, 5..7 warning badge only)
    for (let r = 1; r <= 7; r += 1) {
      state = recordMatchTacticalAdaptation({
        prev: state,
        formation: '4-3-3',
        tactic: 'gegenpressing',
        round: r,
        competition: 'league',
      });
      expect(state.pendingAlert).toBeNull();
    }

    // Match 8 crosses into 'danger' (>= 72) and triggers the scouting popup ONCE
    state = recordMatchTacticalAdaptation({
      prev: state,
      formation: '4-3-3',
      tactic: 'gegenpressing',
      round: 8,
      competition: 'league',
    });
    expect(state.pendingAlert).not.toBeNull();
    expect(state.pendingAlert?.tier).toBe('danger');
    expect(state.pendingAlert?.triggeredAtRound).toBe(8);
    expect(state.pendingAlert?.headline).toBeTruthy();
    expect(state.pendingAlert?.detail).toBeTruthy();
    alertsFired.push({ round: 8, tier: state.pendingAlert!.tier });
    state = { ...state, pendingAlert: null };

    // Staying in 'danger' on match 9 must NOT re-trigger popup (anti-spam)
    state = recordMatchTacticalAdaptation({
      prev: state,
      formation: '4-3-3',
      tactic: 'gegenpressing',
      round: 9,
      competition: 'league',
    });
    expect(state.pendingAlert).toBeNull();
    expect(alertsFired).toEqual([{ round: 8, tier: 'danger' }]);

    // Varying both formation & tactic immediately lowers exposure below reset threshold
    const variedEval = evaluateTacticalExposure({
      history: state.history,
      formation: '3-5-2',
      tactic: 'counter',
    });
    expect(variedEval.exposureScore).toBeLessThan(EXPOSURE_RESET_ALERT_BELOW);
    expect(variedEval.tier).toBe('low');

    // Recording the varied match drops out of danger and re-arms the guard
    state = recordMatchTacticalAdaptation({
      prev: state,
      formation: '3-5-2',
      tactic: 'counter',
      round: 10,
      competition: 'league',
    });
    expect(state.pendingAlert).toBeNull();
    expect(state.highestAlertedTier).toBe('low');
  });

  it('scales AI pre-match counter strength by AI manager OVR and mitigates buildup with Tactical Mastery Coach', () => {
    const repeatedHistory = Array.from({ length: 8 }, (_, i) => ({
      formation: '4-3-3' as const,
      tactic: 'possession' as const,
      round: i + 1,
      competition: 'league' as const,
    }));

    const unmitigated = evaluateTacticalExposure({
      history: repeatedHistory,
      formation: '4-3-3',
      tactic: 'possession',
    });
    expect(unmitigated.exposureScore).toBeGreaterThanOrEqual(EXPOSURE_DANGER_THRESHOLD);

    const mitigated = evaluateTacticalExposure({
      history: repeatedHistory,
      formation: '4-3-3',
      tactic: 'possession',
      staffCoachId: 'sys_tactical_mastery',
    });
    expect(mitigated.mitigatedByCoach).toBe(true);
    expect(mitigated.exposureScore).toBe(
      Math.round(unmitigated.rawExposureScore * (1 - COACH_ADAPTATION_MITIGATION)),
    );

    const eliteCounter = evaluateAiPreMatchCounter({
      exposure: unmitigated,
      userTactic: 'possession',
      aiDefaultTactic: 'balanced',
      aiManager: { ovr: 92, traitId: 'tiki_taka' },
      rng: () => 0.1,
    });
    const weakCounter = evaluateAiPreMatchCounter({
      exposure: unmitigated,
      userTactic: 'possession',
      aiDefaultTactic: 'balanced',
      aiManager: { ovr: 74, traitId: 'catenaccio' },
      rng: () => 0.1,
    });

    expect(eliteCounter.counterStrength).toBeGreaterThan(weakCounter.counterStrength);
    expect(eliteCounter.overrideAiTactic).toBe('gegenpressing');
    expect(eliteCounter.userAttPenalty).toBeLessThan(0);
    expect(eliteCounter.userMidPenalty).toBeLessThan(0);
    expect(eliteCounter.userDefPenalty).toBeLessThan(0);
    expect(eliteCounter.aiXgBonus).toBeGreaterThan(weakCounter.aiXgBonus);
    expect(EXPOSURE_WARNING_THRESHOLD).toBeLessThan(EXPOSURE_DANGER_THRESHOLD);
  });
});

describe('v9.0 Mid-Season Staff Coaches (12-Coach Pool)', () => {
  it('provides 12 distinct coaches across 3 categories and rolls 1 from each category', () => {
    expect(STAFF_COACH_LIST.length).toBe(12);
    expect(STAFF_COACH_LIST.filter((c) => c.category === 'tactic').length).toBe(5);
    expect(STAFF_COACH_LIST.filter((c) => c.category === 'line').length).toBe(3);
    expect(STAFF_COACH_LIST.filter((c) => c.category === 'system').length).toBe(4);

    const rng = createSeededRng(2026);
    for (let i = 0; i < 20; i += 1) {
      const offer = rollMidSeasonStaffCoachOffers({
        activeTactic: 'gegenpressing',
        rng,
      });
      expect(offer.length).toBe(3);
      expect(new Set(offer).size).toBe(3);
      const cats = offer.map((id) => getStaffCoachById(id)?.category);
      expect(cats).toEqual(['tactic', 'line', 'system']);
    }
  });

  it('applies immediate tactic, line, chemistry, stamina, morale, and dev-coach effects cleanly', () => {
    // Tactic specialist
    const onMatch = evaluateStaffCoachEffect('tactic_possession', 'possession');
    const offMatch = evaluateStaffCoachEffect('tactic_possession', 'counter');
    expect(onMatch.isActiveNow).toBe(true);
    expect(onMatch.attDelta).toBe(STAFF_COACH_TACTIC_OVR_LIFT);
    expect(onMatch.midDelta).toBe(STAFF_COACH_TACTIC_OVR_LIFT);
    expect(onMatch.defDelta).toBe(STAFF_COACH_TACTIC_OVR_LIFT);
    expect(offMatch.isActiveNow).toBe(false);
    expect(offMatch.attDelta).toBe(0);

    // Line specialist
    const attCoach = evaluateStaffCoachEffect('line_attack', 'counter');
    expect(attCoach.isActiveNow).toBe(true);
    expect(attCoach.attDelta).toBe(STAFF_COACH_LINE_LIFT);
    expect(attCoach.midDelta).toBe(0);

    // Locker room coach: +8 chemistry + loss morale defense
    const squad = FORMATIONS['4-3-3'].slots.map((slot, idx) => ({
      ...ACTIVE_PLAYERS[idx],
      position: slot.position,
      mainPositions: [slot.subPosition],
      ovr: 82,
      isLegend: false,
    }));
    const chemBase = calculateChemistry('4-3-3', squad, 'balanced', null);
    const chemLocker = calculateChemistry('4-3-3', squad, 'balanced', null, undefined, {
      staffCoachId: 'sys_locker_room',
    });
    expect(chemLocker.total).toBe(Math.min(100, chemBase.total + STAFF_COACH_CHEM_LIFT));

    // FFP -4 chem penalty stacks cleanly with chemistry engine
    const chemFfp = calculateChemistry('4-3-3', squad, 'balanced', null, undefined, {
      ffpChemPenalty: -FFP_TIER1_CHEM_PENALTY,
    });
    expect(chemFfp.total).toBe(Math.max(0, chemBase.total - FFP_TIER1_CHEM_PENALTY));

    // Morale loss defense vs FFP extra loss morale drop
    const starterIds = new Set(squad.map((p) => p.id));
    const minutesByPlayerId = Object.fromEntries(squad.map((p) => [p.id, 90]));
    const baseLoss = updateSquadConditionsAfterMatch({
      squad,
      starterIds,
      minutesByPlayerId,
      conditionMap: {},
      competition: 'league',
      outcome: 'L',
      goalDiff: -3,
      isBigMatch: false,
      teamWinStreak: 0,
      teamLossStreak: 3,
      rng: () => 0.99,
    });
    const lockerLoss = updateSquadConditionsAfterMatch({
      squad,
      starterIds,
      minutesByPlayerId,
      conditionMap: {},
      competition: 'league',
      outcome: 'L',
      goalDiff: -3,
      isBigMatch: false,
      teamWinStreak: 0,
      teamLossStreak: 3,
      moraleLossDefense: 1,
      rng: () => 0.99,
    });
    const ffp2Loss = updateSquadConditionsAfterMatch({
      squad,
      starterIds,
      minutesByPlayerId,
      conditionMap: {},
      competition: 'league',
      outcome: 'L',
      goalDiff: -3,
      isBigMatch: false,
      teamWinStreak: 0,
      teamLossStreak: 3,
      extraLossMoraleDrop: 1,
      rng: () => 0.99,
    });
    expect(lockerLoss.teamMoraleDelta).toBeGreaterThan(baseLoss.teamMoraleDelta);
    expect(ffp2Loss.teamMoraleDelta).toBeLessThan(baseLoss.teamMoraleDelta);

    // Super-Sub Physical Coach: less stamina drain after 65' & +3.0 sub OVR lift
    const staminaNoCoach = computePlayerStaminaPct({
      staminaStat: 78,
      subPosition: 'CM',
      tactic: 'gegenpressing',
      minutesPlayed: 85,
      currentMinute: 85,
    });
    const staminaWithCoach = computePlayerStaminaPct({
      staminaStat: 78,
      subPosition: 'CM',
      tactic: 'gegenpressing',
      minutesPlayed: 85,
      currentMinute: 85,
      staffCoachId: 'sys_supersub_phys',
    });
    expect(staminaWithCoach).toBeGreaterThan(staminaNoCoach);

    const subImpactBase = computeLineupStaminaImpact({
      formation: '4-3-3',
      starters: squad,
      tactic: 'balanced',
      minute: 72,
      enteredAtMinute: { [squad[9].id]: 60 },
    });
    const subImpactCoach = computeLineupStaminaImpact({
      formation: '4-3-3',
      starters: squad,
      tactic: 'balanced',
      minute: 72,
      enteredAtMinute: { [squad[9].id]: 60 },
      staffCoachId: 'sys_supersub_phys',
    });
    expect(subImpactCoach.attDelta).toBeGreaterThan(subImpactBase.attDelta);

    // Potential Dev Coach: +1.5 for base OVR <= 84 non-Legend, 0 for Legend / 85+
    expect(getDevCoachPlayerBonus({ ovr: 82, isLegend: false }, 'sys_potential_dev')).toBe(
      STAFF_COACH_DEV_OVR_LIFT,
    );
    expect(getDevCoachPlayerBonus({ ovr: 86, isLegend: false }, 'sys_potential_dev')).toBe(0);
    expect(getDevCoachPlayerBonus({ ovr: 82, isLegend: true }, 'sys_potential_dev')).toBe(0);

    const ratingNoCoach = calculateTeamRatings(
      '4-3-3',
      squad,
      chemBase.total,
      null,
      chemBase.slotSynergies,
      'balanced',
      null,
    );
    const ratingDevCoach = calculateTeamRatings(
      '4-3-3',
      squad,
      chemBase.total,
      null,
      chemBase.slotSynergies,
      'balanced',
      'sys_potential_dev',
    );
    expect(ratingDevCoach.effectiveAtt).toBeGreaterThan(ratingNoCoach.effectiveAtt);
    expect(STAFF_COACHES.sys_potential_dev.shortBadge).toContain('84');
  });
});

describe('v9.0 Permanent Potential Awakening', () => {
  it('blocks Legends completely (0%) and caps 89+ superstars at +2 (max 96)', () => {
    const legend = LEGEND_PLAYERS[0];
    const superstar = ACTIVE_PLAYERS.find(
      (p) => !p.isLegend && p.ovr >= AWAKENING_SUPERSTAR_OVR_THRESHOLD && p.ovr <= 92,
    )!;

    // Legends NEVER trigger even with rng = 0
    const legendRes = evaluatePostMatchAwakening({
      starters: [legend],
      bench: [],
      matchPlayedNumber: 20,
      round: 20,
      competition: 'league',
      ratingsByPlayerId: { [legend.id]: 9.5 },
      goalsByPlayerId: { [legend.id]: 3 },
      assistsByPlayerId: {},
      minutesByPlayerId: { [legend.id]: 90 },
      cleanSheet: true,
      allPlayerStats: {},
      managerTraitId: null,
      rng: () => 0,
    });
    expect(legendRes.triggered).toBe(false);
    expect(
      isValidAwakeningRecord(legend, {
        originalOvr: legend.ovr,
        ovrGain: 2,
        round: 10,
        competition: 'league',
        statDeltas: [],
      }),
    ).toBe(false);

    // 89+ superstars strictly capped at +2 and <= 96
    const rng = createSeededRng(777);
    for (let i = 0; i < 30; i += 1) {
      const gain = rollAwakeningOvrGain(superstar.ovr, rng);
      expect(gain).toBeLessThanOrEqual(AWAKENING_SUPERSTAR_MAX_GAIN);
      expect(superstar.ovr + gain).toBeLessThanOrEqual(AWAKENING_OVR_HARD_CAP);
    }
    expect(
      isValidAwakeningRecord(superstar, {
        originalOvr: superstar.ovr,
        ovrGain: 3,
        round: 12,
        competition: 'league',
        statDeltas: [],
      }),
    ).toBe(false);
    expect(
      isValidAwakeningRecord(superstar, {
        originalOvr: superstar.ovr,
        ovrGain: 2,
        round: 12,
        competition: 'league',
        statDeltas: [],
      }),
    ).toBe(true);
  });

  it('permanently lifts OVR & position-tailored attributes on a fresh clone without mutating static DB', () => {
    const dbPlayer = ACTIVE_PLAYERS.find(
      (p) => !p.isLegend && p.position === 'FW' && p.ovr >= 78 && p.ovr <= 84,
    )!;
    const origOvr = dbPlayer.ovr;
    const origAtt = dbPlayer.att;
    const origAttrsJson = JSON.stringify(dbPlayer.attrs ?? null);

    const awakened = applyAwakeningToPlayer(dbPlayer, {
      originalOvr: origOvr,
      ovrGain: 5,
      round: 18,
      competition: 'league',
      statDeltas: [],
    });

    // Fresh clone mutated, static DB untouched
    expect(awakened).not.toBe(dbPlayer);
    expect(awakened.ovr).toBe(origOvr + 5);
    expect(awakened.att).toBeGreaterThanOrEqual(origAtt + 5);
    expect(awakened.awakening?.ovrGain).toBe(5);
    expect(awakened.awakening?.statDeltas.length).toBeGreaterThan(0);

    expect(dbPlayer.ovr).toBe(origOvr);
    expect(dbPlayer.att).toBe(origAtt);
    expect(dbPlayer.awakening).toBeUndefined();
    expect(JSON.stringify(dbPlayer.attrs ?? null)).toBe(origAttrsJson);
  });

  it('keeps 2nd & 3rd awakenings accessible (x0.78 / x0.48) and sharply attenuates 4th+ (x0.05)', () => {
    expect(AWAKENING_SECOND_COUNT_MULT).toBe(0.78);
    expect(AWAKENING_THIRD_COUNT_MULT).toBe(0.48);
    expect(AWAKENING_FOURTH_PLUS_MULT).toBe(0.05);

    const candidate = ACTIVE_PLAYERS.find(
      (p) => !p.isLegend && p.ovr >= 78 && p.ovr <= 84,
    )!;
    const runTrials = (existingCount: number): number => {
      const existing: Record<string, { originalOvr: number; ovrGain: number; round: number; competition: 'league'; statDeltas: [] }> = {};
      for (let i = 0; i < existingCount; i += 1) {
        existing[`other-${i}`] = {
          originalOvr: 80,
          ovrGain: 3,
          round: 8 + i,
          competition: 'league',
          statDeltas: [],
        };
      }
      const rng = createSeededRng(9001 + existingCount * 31);
      let hits = 0;
      for (let t = 0; t < 4000; t += 1) {
        const res = evaluatePostMatchAwakening({
          starters: [candidate],
          bench: [],
          matchPlayedNumber: 15,
          round: 15,
          competition: 'league',
          ratingsByPlayerId: { [candidate.id]: 8.4 },
          goalsByPlayerId: { [candidate.id]: 1 },
          assistsByPlayerId: {},
          minutesByPlayerId: { [candidate.id]: 90 },
          cleanSheet: false,
          allPlayerStats: {},
          managerTraitId: null,
          existingAwakenedPlayers: existing,
          rng,
        });
        if (res.triggered) hits += 1;
      }
      return hits;
    };

    const hits1st = runTrials(0);
    const hits2nd = runTrials(1);
    const hits3rd = runTrials(2);
    const hits4th = runTrials(3);

    expect(hits1st).toBeGreaterThan(20);
    // 2nd should be roughly 0.78x of 1st
    expect(hits2nd / hits1st).toBeGreaterThan(0.55);
    expect(hits2nd / hits1st).toBeLessThan(0.98);
    // 3rd should be roughly 0.48x of 1st (still reachable!)
    expect(hits3rd / hits1st).toBeGreaterThan(0.28);
    expect(hits3rd / hits1st).toBeLessThan(0.70);
    // 4th+ should be near-zero (~0.05x)
    expect(hits4th / hits1st).toBeLessThan(0.15);
  });

  it('verifies SystemGuideModal and DraftBudgetBar stay 100% synced with v9.3 constants including Era Classic flat €130M', async () => {
    const [{ default: guideSrc }, { default: budgetBarSrc }, { default: tutorialSrc }] =
      await Promise.all([
        import('../components/guide/SystemGuideModal.tsx?raw'),
        import('../components/common/DraftBudgetBar.tsx?raw'),
        import('../components/guide/SoloVisualTutorialModal.tsx?raw'),
      ]);

    expect(guideSrc).toContain('LEGEND_FLAT_DRAFT_COST_M');
    expect(guideSrc).toContain('DRAFT_BUDGET_CAP_M');
    expect(guideSrc).toContain('EXPOSURE_WARNING_THRESHOLD');
    expect(guideSrc).toContain('EXPOSURE_DANGER_THRESHOLD');
    expect(guideSrc).toContain('STAFF_COACH_LIST');
    expect(guideSrc).toContain('AWAKENING_THIRD_COUNT_MULT');
    expect(guideSrc).toContain('AWAKENING_FOURTH_PLUS_MULT');
    expect(budgetBarSrc).toContain('LEGEND_FLAT_DRAFT_COST_M');
    expect(tutorialSrc).toContain('LEGEND_FLAT_DRAFT_COST_M');
    expect(tutorialSrc).toContain('DRAFT_BUDGET_CAP_M');
    expect(tutorialSrc).toContain('ADAPTATION_HISTORY_WINDOW');
    expect(tutorialSrc).toContain('EXPOSURE_DANGER_THRESHOLD');
    expect(tutorialSrc).toContain('STAFF_COACHES');
  });
});
