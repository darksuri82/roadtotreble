import { describe, expect, it } from 'vitest';
import { calculateChemistry, calculateTeamRatings } from '../engine/chemistryEngine';
import {
  prepareAiClubLineupForMatch,
  selectConditionAwareAiLineup,
} from '../engine/conditionEngine';
import { ACTIVE_PLAYERS, buildAiClubRoster, getLeagueById } from '../engine/dataLoader';
import {
  adjustAiClubRatingsForRosterChange,
  reoptimizeAiClubRoster,
} from '../engine/lineupOptimizer';
import {
  simulateFirstHalf,
  simulateMatch,
  simulateSecondHalf,
  USER_CLUB_ID,
} from '../engine/matchEngine';
import {
  ADAPTATION_HISTORY_WINDOW,
  createInitialTacticalAdaptationState,
  evaluateTacticalExposure,
  EXPOSURE_DANGER_THRESHOLD,
  EXPOSURE_WARNING_THRESHOLD,
  recordMatchTacticalAdaptation,
} from '../engine/tacticalAdaptationEngine';
import type { Fixture } from '../types/league';
import type { Player } from '../types/player';

function makeSeededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe('v9.1 Item 1: 8-Match Exposure Tempo & Danger-Only Re-Arming Alert', () => {
  it('stays low for 1..4 matches, warning for 5..7 without popup, reaches danger at 8 with 1 popup, and re-arms after variation', () => {
    expect(ADAPTATION_HISTORY_WINDOW).toBe(8);
    let state = createInitialTacticalAdaptationState();

    for (let r = 1; r <= 4; r += 1) {
      state = recordMatchTacticalAdaptation({
        prev: state,
        formation: '4-2-3-1',
        tactic: 'possession',
        round: r,
        competition: 'league',
      });
      const ev = evaluateTacticalExposure({
        history: state.history,
        formation: '4-2-3-1',
        tactic: 'possession',
      });
      expect(ev.tier).toBe('low');
      expect(ev.exposureScore).toBeLessThan(EXPOSURE_WARNING_THRESHOLD);
      expect(state.pendingAlert).toBeNull();
    }

    for (let r = 5; r <= 7; r += 1) {
      state = recordMatchTacticalAdaptation({
        prev: state,
        formation: '4-2-3-1',
        tactic: 'possession',
        round: r,
        competition: 'league',
      });
      const ev = evaluateTacticalExposure({
        history: state.history,
        formation: '4-2-3-1',
        tactic: 'possession',
      });
      expect(ev.tier).toBe('warning');
      expect(ev.exposureScore).toBeGreaterThanOrEqual(EXPOSURE_WARNING_THRESHOLD);
      expect(ev.exposureScore).toBeLessThan(EXPOSURE_DANGER_THRESHOLD);
      // Warning tier MUST NEVER pop up a modal
      expect(state.pendingAlert).toBeNull();
    }

    // 8th consecutive match reaches 'danger' and queues ONE popup
    state = recordMatchTacticalAdaptation({
      prev: state,
      formation: '4-2-3-1',
      tactic: 'possession',
      round: 8,
      competition: 'league',
    });
    expect(state.pendingAlert?.tier).toBe('danger');
    expect(state.pendingAlert?.exposureScore).toBeGreaterThanOrEqual(
      EXPOSURE_DANGER_THRESHOLD,
    );
    state = { ...state, pendingAlert: null };

    // Vary 1 match -> drops out of danger & re-arms guard
    state = recordMatchTacticalAdaptation({
      prev: state,
      formation: '3-5-2',
      tactic: 'counter',
      round: 9,
      competition: 'league',
    });
    expect(state.highestAlertedTier).toBe('low');
    expect(state.pendingAlert).toBeNull();

    // Repeating a new pattern for 8 consecutive matches triggers danger popup cleanly again
    let reTriggeredRound = -1;
    for (let r = 10; r <= 18; r += 1) {
      state = recordMatchTacticalAdaptation({
        prev: state,
        formation: '4-4-2',
        tactic: 'wingplay',
        round: r,
        competition: 'league',
      });
      if (state.pendingAlert) {
        reTriggeredRound = r;
        expect(state.pendingAlert.tier).toBe('danger');
        state = { ...state, pendingAlert: null };
      }
    }
    expect(reTriggeredRound).toBe(17);
  });
});

describe('v9.1 Item 4: AI Club Immediately Starts High-OVR Traded-In Players & Records Stats', () => {
  it('promotes a traded-in OVR 92 striker into AI starting XI indices 0..10 even when appended past index 10, boosts club rating, and logs 90-min match stats', () => {
    const epl = getLeagueById('epl');
    // Pick a mid/lower-table AI club so an OVR 92 striker clearly beats incumbent FWs
    const partnerClub =
      [...epl.clubs].sort((a, b) => a.att - b.att)[0] ?? epl.clubs[0];
    const oppClub = epl.clubs.find((c) => c.id !== partnerClub.id)!;

    const prevRoster = buildAiClubRoster(partnerClub, 'epl');
    expect(prevRoster.length).toBe(11);

    const tradedStar: Player = {
      ...ACTIVE_PLAYERS.find((p) => p.position === 'FW')!,
      id: 'traded-superstar-st',
      name: 'Super Striker',
      ovr: 92,
      att: 93,
      mid: 84,
      def: 46,
      position: 'FW',
      mainPositions: ['ST'],
      secondaryPositions: ['LW', 'RW'],
      club: partnerClub.name,
      leagueId: 'epl',
    };

    // Simulate worst-case trade (user took a bench/depth player, so original 11 remain & traded star is appended at index 11!)
    const rawMerged = [...prevRoster, tradedStar];

    // 1) Legacy/condition-aware safety guard promotes index 11+ star into starters even before re-optimization
    const legacySelected = selectConditionAwareAiLineup({
      baseRoster: rawMerged,
      fullClubPool: [],
      conditionMap: {},
    });
    expect(legacySelected.starters.some((p) => p.id === tradedStar.id)).toBe(true);

    // 2) Trade-time Best-XI re-optimization puts tradedStar cleanly into indices 0..10 and updates club ATT
    const reoptimized = reoptimizeAiClubRoster({
      roster: rawMerged,
      formation: partnerClub.formation,
    });
    expect(reoptimized.slice(0, 11).some((p) => p.id === tradedStar.id)).toBe(true);
    expect(reoptimized.length).toBe(12);

    const updatedPartnerClub = adjustAiClubRatingsForRosterChange(
      partnerClub,
      prevRoster,
      reoptimized,
    );
    expect(updatedPartnerClub.att).toBeGreaterThanOrEqual(partnerClub.att);

    // 3) Next match simulation using prepareAiClubLineupForMatch -> tradedStar starts and records match ratings & 90 mins!
    const prep = prepareAiClubLineupForMatch({
      club: updatedPartnerClub,
      baseRoster: reoptimized,
      conditionMap: {},
    });
    expect(prep.effectiveStarters.some((p) => p.id === tradedStar.id)).toBe(true);

    const fixture: Fixture = {
      id: 'v91-trade-check',
      round: 20,
      homeTeamId: updatedPartnerClub.id,
      awayTeamId: oppClub.id,
      played: false,
    };
    const oppRoster = buildAiClubRoster(oppClub, 'epl');
    const result = simulateMatch(
      fixture,
      updatedPartnerClub,
      oppClub,
      prep.effectiveStarters,
      oppRoster,
      undefined,
      makeSeededRng(777),
    );
    const starRating = result.playerRatings.find(
      (r) => r.playerId === tradedStar.id,
    );
    expect(starRating).toBeDefined();
    expect(starRating!.teamId).toBe(updatedPartnerClub.id);
    expect(starRating!.minutesPlayed).toBe(90);
    expect(starRating!.rating).toBeGreaterThan(0);
  });
});

describe('v9.1 Item 5: Elite AI Manager 1st-Half Counter Tactic Override & Broadcast Alert', () => {
  it('overrides preview tactic in 1st half when user exposure is danger vs elite AI manager and logs [전술 파훼 발동] event', () => {
    const epl = getLeagueById('epl');
    // Pick Man City / Arsenal / Liverpool (top elite AI manager, OVR >= 88) whose default tactic != gegenpressing
    const eliteClub =
      epl.clubs.find(
        (c) => c.defaultTactic !== 'gegenpressing' && (c.att + c.mid + c.def) / 3 >= 84,
      ) ?? epl.clubs[0];

    const userClub = {
      ...epl.clubs[epl.clubs.length - 1],
      id: USER_CLUB_ID,
      name: 'User FC',
      shortName: 'USR',
      isUser: true,
    };
    const userStarters = buildAiClubRoster(epl.clubs[1], 'epl');
    const eliteRoster = buildAiClubRoster(eliteClub, 'epl');
    const chem = calculateChemistry('4-3-3', userStarters, 'possession', 'tiki_taka');
    const ratings = calculateTeamRatings(
      '4-3-3',
      userStarters,
      chem.total,
      'tiki_taka',
      chem.slotSynergies,
      'possession',
    );

    const dangerHistory = Array.from({ length: 8 }, (_, i) => ({
      formation: '4-3-3' as const,
      tactic: 'possession' as const,
      round: i + 1,
      competition: 'league' as const,
    }));

    const fixture: Fixture = {
      id: 'v91-counter-check',
      round: 9,
      homeTeamId: USER_CLUB_ID,
      awayTeamId: eliteClub.id,
      played: false,
    };

    const userCtx = {
      userClubId: USER_CLUB_ID,
      formation: '4-3-3' as const,
      tactic: 'possession' as const,
      starters: userStarters,
      bench: [],
      ratings,
      chemistry: chem.total,
      slotSynergies: chem.slotSynergies,
      managerTraitId: 'tiki_taka' as const,
      tacticalHistory: dangerHistory,
    };

    const ht = simulateFirstHalf({
      fixture,
      homeClub: userClub,
      awayClub: eliteClub,
      homeRoster: userStarters,
      awayRoster: eliteRoster,
      userContext: userCtx,
      rng: makeSeededRng(101),
    });

    expect(ht.aiPreMatchCounter).toBeDefined();
    expect(ht.aiPreMatchCounter!.originalTactic).toBe(eliteClub.defaultTactic);
    expect(ht.aiPreMatchCounter!.appliedTactic).not.toBe(eliteClub.defaultTactic);
    expect(ht.awayTactic).toBe(ht.aiPreMatchCounter!.appliedTactic);
    expect(ht.aiPreMatchCounter!.headline).toContain('[전술 파훼 발동]');
    expect(
      ht.firstHalfEvents.some((ev) => ev.description.includes('[전술 파훼 발동]')),
    ).toBe(true);

    // Ensure 2nd half preserves aiPreMatchCounter onto the final MatchResult
    const full = simulateSecondHalf({
      halftime: ht,
      homeClub: userClub,
      awayClub: eliteClub,
      homeRoster: userStarters,
      awayRoster: eliteRoster,
      userContext: userCtx,
      rng: makeSeededRng(202),
    });
    expect(full.aiPreMatchCounter?.headline).toContain('[전술 파훼 발동]');

    // Also verify quick-sim simulateMatch attaches aiPreMatchCounter & event
    const quick = simulateMatch(
      fixture,
      userClub,
      eliteClub,
      userStarters,
      eliteRoster,
      userCtx,
      makeSeededRng(303),
    );
    expect(quick.aiPreMatchCounter?.headline).toContain('[전술 파훼 발동]');
    expect(
      quick.events.some((ev) => ev.description.includes('[전술 파훼 발동]')),
    ).toBe(true);
  });
});
