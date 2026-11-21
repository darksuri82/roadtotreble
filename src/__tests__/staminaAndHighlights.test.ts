import { describe, expect, it } from 'vitest';
import { calculateChemistry, calculateTeamRatings } from '../engine/chemistryEngine';
import { ACTIVE_PLAYERS, buildAiClubRoster, getLeagueById } from '../engine/dataLoader';
import {
  pickHighlightPattern,
  simulateMatch,
  USER_CLUB_ID,
} from '../engine/matchEngine';
import {
  computePlayerStaminaPct,
  getStaminaPenalty,
} from '../engine/staminaEngine';
import type { Club, Fixture, HighlightPatternId } from '../types/league';

function createSeededRng(seed = 2026): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

describe('V5.3 Stamina, Auto-Substitution & 7 Highlight Patterns', () => {
  it('drains stamina realistically by STA attribute, position workload, and tactic intensity', () => {
    const highSta = computePlayerStaminaPct({
      staminaStat: 96,
      subPosition: 'CM',
      tactic: 'balanced',
      minutesPlayed: 75,
    });
    const lowSta = computePlayerStaminaPct({
      staminaStat: 70,
      subPosition: 'CM',
      tactic: 'balanced',
      minutesPlayed: 75,
    });
    expect(highSta).toBeGreaterThan(lowSta);

    const cmGegen = computePlayerStaminaPct({
      staminaStat: 82,
      subPosition: 'CM',
      tactic: 'gegenpressing',
      minutesPlayed: 75,
    });
    const cmCounter = computePlayerStaminaPct({
      staminaStat: 82,
      subPosition: 'CM',
      tactic: 'counter',
      minutesPlayed: 75,
    });
    expect(cmGegen).toBeLessThan(cmCounter);

    const gk = computePlayerStaminaPct({
      staminaStat: 78,
      subPosition: 'GK',
      tactic: 'gegenpressing',
      minutesPlayed: 90,
    });
    const cb = computePlayerStaminaPct({
      staminaStat: 82,
      subPosition: 'CB',
      tactic: 'balanced',
      minutesPlayed: 75,
    });
    expect(gk).toBeGreaterThan(cb);

    expect(getStaminaPenalty(75).ovrPenalty).toBe(0);
    expect(getStaminaPenalty(62).ovrPenalty).toBe(-1.5);
    expect(getStaminaPenalty(48).ovrPenalty).toBe(-3.5);
    expect(getStaminaPenalty(32).ovrPenalty).toBe(-6.0);
  });

  it('executes 3-5 automatic substitutions (60-82m) during quick/skip matches and tracks bench minutesPlayed', () => {
    const epl = getLeagueById('epl');
    const opp = epl.clubs[2];
    const oppRoster = buildAiClubRoster(opp, 'epl');

    const gk = ACTIVE_PLAYERS.find((p) => p.position === 'GK')!;
    const dfs = ACTIVE_PLAYERS.filter((p) => p.position === 'DF').slice(0, 5);
    const mfs = ACTIVE_PLAYERS.filter((p) => p.position === 'MF').slice(0, 5);
    const fws = ACTIVE_PLAYERS.filter((p) => p.position === 'FW').slice(0, 5);

    const starters = [
      gk,
      dfs[0],
      dfs[1],
      dfs[2],
      dfs[3],
      mfs[0],
      mfs[1],
      mfs[2],
      fws[0],
      fws[1],
      fws[2],
    ];
    const bench = [dfs[4], mfs[3], mfs[4], fws[3], fws[4]];

    const chem = calculateChemistry('4-3-3', starters, 'gegenpressing', null);
    const ratings = calculateTeamRatings('4-3-3', starters, chem.total, null);

    const userClub: Club = {
      id: USER_CLUB_ID,
      name: '테스트 FC',
      shortName: 'TST',
      primaryColor: '#10b981',
      secondaryColor: '#ffffff',
      formation: '4-3-3',
      defaultTactic: 'gegenpressing',
      att: ratings.att,
      mid: ratings.mid,
      def: ratings.def,
      topScorers: [fws[0].name, fws[1].name, fws[2].name],
      isUser: true,
    };

    const fixture: Fixture = {
      id: 'r1-m1',
      round: 1,
      homeTeamId: USER_CLUB_ID,
      awayTeamId: opp.id,
      played: false,
    };

    const result = simulateMatch(
      fixture,
      userClub,
      opp,
      starters,
      oppRoster,
      {
        userClubId: USER_CLUB_ID,
        starters,
        bench,
        formation: '4-3-3',
        tactic: 'gegenpressing',
        chemistry: chem.total,
        ratings,
        managerTraitId: null,
        allowAutoSubs: true,
      },
      createSeededRng(77),
    );

    const subEvents = result.events.filter((e) => e.type === 'sub');
    expect(subEvents.length).toBeGreaterThanOrEqual(3);
    expect(subEvents.length).toBeLessThanOrEqual(5);
    for (const ev of subEvents) {
      expect(ev.minute).toBeGreaterThanOrEqual(60);
      expect(ev.minute).toBeLessThanOrEqual(82);
    }

    const userSubRatings = result.playerRatings.filter(
      (r) => r.teamId === USER_CLUB_ID && r.isSub,
    );
    expect(userSubRatings.length).toBe(subEvents.length);
    for (const sr of userSubRatings) {
      expect(sr.minutesPlayed).toBeGreaterThanOrEqual(8);
      expect(sr.minutesPlayed).toBeLessThanOrEqual(30);
    }
  });

  it('generates all 10 highlight patterns and weights them by tactic & set_piece_master trait', () => {
    const sampleRoster = ACTIVE_PLAYERS.slice(0, 11);
    const rng = createSeededRng(303);
    const seen = new Set<HighlightPatternId>();

    for (let i = 0; i < 600; i += 1) {
      seen.add(
        pickHighlightPattern({
          tactic: 'balanced',
          roster: sampleRoster,
          rng,
        }),
      );
    }
    expect(seen.size).toBe(10);

    // Wingplay should favor crosses/cutbacks over counter
    let wingCrossCutback = 0;
    let counterCrossCutback = 0;
    let setPieceWithTrait = 0;
    let setPieceBase = 0;

    const rngW = createSeededRng(501);
    const rngC = createSeededRng(501);
    const rngSp = createSeededRng(701);
    const rngBase = createSeededRng(701);

    for (let i = 0; i < 1000; i += 1) {
      const pw = pickHighlightPattern({ tactic: 'wingplay', roster: sampleRoster, rng: rngW });
      if (pw === 'wing_cross_header' || pw === 'cutback_finish') wingCrossCutback += 1;

      const pc = pickHighlightPattern({ tactic: 'counter', roster: sampleRoster, rng: rngC });
      if (pc === 'wing_cross_header' || pc === 'cutback_finish') counterCrossCutback += 1;

      const psp = pickHighlightPattern({
        tactic: 'balanced',
        roster: sampleRoster,
        managerTraitId: 'set_piece_master',
        rng: rngSp,
      });
      if (psp === 'corner_kick' || psp === 'direct_free_kick') setPieceWithTrait += 1;

      const pb = pickHighlightPattern({
        tactic: 'balanced',
        roster: sampleRoster,
        managerTraitId: null,
        rng: rngBase,
      });
      if (pb === 'corner_kick' || pb === 'direct_free_kick') setPieceBase += 1;
    }

    expect(wingCrossCutback).toBeGreaterThan(counterCrossCutback);
    expect(setPieceWithTrait).toBeGreaterThan(setPieceBase);
  });
});
