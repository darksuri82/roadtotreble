import { describe, expect, it } from 'vitest';
import { FORMATIONS } from '../data/formations';
import { ACTIVE_PLAYERS as PLAYERS } from '../engine/dataLoader';
import {
  findNextOpenDraftSlot,
  resolveMpRouletteTargetDisplay,
} from '../engine/mpLeagueDraft';
import {
  createMpLeagueSeason,
  grantMpLeagueConsent,
  runMpLeague,
} from '../engine/mpLeagueEngine';
import {
  createPitchSimState,
  FIXED_DT,
  stepPitchSim,
} from '../engine/pitchSimEngine';
import {
  computeGameStateUrgency,
  sampleExpectedThreat,
} from '../engine/pitchTacticalParams';
import {
  DEFAULT_MANAGER_AVATAR,
  type FormationId,
  type ManagerTraitId,
} from '../types/game';
import type { TacticId } from '../types/league';
import type { MpLeagueHuman, MpSquadInput } from '../types/mpLeague';
import type { Player } from '../types/player';

function makeSquad(formation: FormationId, offset: number): Player[] {
  const slots = FORMATIONS[formation].slots;
  const used = new Set<string>();
  return slots.map((slot, idx) => {
    const match =
      PLAYERS.find(
        (p) =>
          !used.has(p.id) &&
          p.position === slot.position &&
          p.ovr >= 78 &&
          PLAYERS.indexOf(p) >= offset * 12,
      ) ??
      PLAYERS.find((p) => !used.has(p.id) && p.position === slot.position) ??
      PLAYERS[idx + offset * 12];
    used.add(match.id);
    return match;
  });
}

function makeBench(usedIds: Set<string>): Player[] {
  const out: Player[] = [];
  for (const p of PLAYERS) {
    if (usedIds.has(p.id)) continue;
    usedIds.add(p.id);
    out.push(p);
    if (out.length === 5) break;
  }
  return out;
}

describe('v8.13 — 2D xT/Stall/Pressing/ET Urgency, MP Pre-Season Readiness & Dynamic Roulette Position', () => {
  it('1. Karun Singh 12x8 Expected Threat (xT) increases monotonically toward opponent goal & box', () => {
    const ownBox = sampleExpectedThreat(true, 0.08, 0.5);
    const midfield = sampleExpectedThreat(true, 0.50, 0.5);
    const halfSpaceFinalThird = sampleExpectedThreat(true, 0.78, 0.32);
    const oppBoxCenter = sampleExpectedThreat(true, 0.94, 0.5);

    expect(midfield).toBeGreaterThan(ownBox);
    expect(halfSpaceFinalThird).toBeGreaterThan(midfield);
    expect(oppBoxCenter).toBeGreaterThan(halfSpaceFinalThird);
    expect(oppBoxCenter).toBeGreaterThan(0.18);

    // Away team mirrors symmetrically
    const awayOppBox = sampleExpectedThreat(false, 0.06, 0.5);
    expect(awayOppBox).toBeCloseTo(oppBoxCenter, 3);
  });

  it('2. Urgency AI activates at end of 1st half (40-45+), 2nd half (75-90+), ET1 (100-105+) & ET2 (112-120+)', () => {
    const mid1H = computeGameStateUrgency({ minute: 25, scoreDiff: -1, ballDepth: 0.55 });
    const end1H = computeGameStateUrgency({ minute: 44, scoreDiff: -1, ballDepth: 0.58 });
    const end1HTiedOppHalf = computeGameStateUrgency({ minute: 44, scoreDiff: 0, ballDepth: 0.62 });
    const late2H = computeGameStateUrgency({ minute: 85, scoreDiff: -1 });
    const endEt1Trailing = computeGameStateUrgency({ minute: 104, scoreDiff: -1, isKnockoutDecider: true });
    const endEt1Tied = computeGameStateUrgency({ minute: 104, scoreDiff: 0, isKnockoutDecider: true, ballDepth: 0.56 });
    const endEt2Trailing = computeGameStateUrgency({ minute: 118, scoreDiff: -1, isKnockoutDecider: true });
    const endEt2Tied = computeGameStateUrgency({ minute: 118, scoreDiff: 0, isKnockoutDecider: true });

    expect(mid1H.attackUrgency).toBe(0);
    expect(end1H.attackUrgency).toBeGreaterThan(0.45);
    expect(end1HTiedOppHalf.attackUrgency).toBeGreaterThan(0.30);
    expect(late2H.attackUrgency).toBeGreaterThan(0.80);
    expect(late2H.cbBoxJoin).toBe(true);
    expect(endEt1Trailing.attackUrgency).toBeGreaterThan(0.60);
    expect(endEt1Tied.attackUrgency).toBeGreaterThan(0.30);
    expect(endEt2Trailing.attackUrgency).toBeGreaterThan(0.90);
    expect(endEt2Trailing.cbBoxJoin).toBe(true);
    expect(endEt2Tied.attackUrgency).toBeGreaterThan(0.55);
  });

  it('3. Stall Decay & Active Pressing Triggers prevent infinite recycling while preserving progressive xT play', () => {
    const homeStarters = makeSquad('4-3-3', 0);
    const awayStarters = makeSquad('4-2-3-1', 1);

    let totalPositiveXt = 0;
    let totalThirdMan = 0;
    let totalPressTriggers = 0;
    let worstStallStreak = 0;

    for (const seed of ['xt-stall-1', 'xt-stall-2', 'xt-stall-3']) {
      const sim = createPitchSimState({
        seed,
        homeTeamId: 'h',
        awayTeamId: 'a',
        home: {
          formation: '4-3-3',
          tactic: 'possession' as TacticId,
          starters: homeStarters,
          managerTraitId: 'tiki_taka' as ManagerTraitId,
          managerOvr: 88,
        },
        away: {
          formation: '4-2-3-1',
          tactic: 'balanced' as TacticId,
          starters: awayStarters,
          managerTraitId: 'defensive_architect' as ManagerTraitId,
          managerOvr: 85,
        },
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

      for (let t = 0; t < 3600 && !sim.completed; t += 1) {
        stepPitchSim(sim, FIXED_DT);
      }

      totalPositiveXt += sim.stats.positiveXtPasses;
      totalThirdMan += sim.stats.thirdManRuns;
      totalPressTriggers += sim.stats.pressingTriggersFired;
      if (sim.stats.maxConsecutiveStallPasses > worstStallStreak) {
        worstStallStreak = sim.stats.maxConsecutiveStallPasses;
      }
    }

    expect(totalPositiveXt).toBeGreaterThan(5);
    expect(totalPositiveXt + totalThirdMan).toBeGreaterThan(20);
    expect(totalPressTriggers).toBeGreaterThan(10);
    // Stall Decay + Pressing Triggers cap consecutive non-progressive passes cleanly
    expect(worstStallStreak).toBeLessThanOrEqual(12);
  });

  it('4. Multiplayer League starts with pre-season readiness consent before Round 1 and unlocks after all managers ready', () => {
    const usedIds = new Set<string>();
    const s1 = makeSquad('4-3-3', 0);
    s1.forEach((p) => usedIds.add(p.id));
    const b1 = makeBench(usedIds);
    const s2 = makeSquad('4-2-3-1', 2);
    s2.forEach((p) => usedIds.add(p.id));
    const b2 = makeBench(usedIds);

    const humans: MpLeagueHuman[] = [
      {
        playerId: 'p1',
        clubId: 'mp-c1',
        nickname: '감독A',
        avatar: DEFAULT_MANAGER_AVATAR,
        managerTraitId: 'tiki_taka',
        profile: {
          name: 'FC 알파',
          shortName: 'ALP',
          primaryColor: '#10b981',
          secondaryColor: '#ffffff',
          pattern: 'solid',
        },
      },
      {
        playerId: 'p2',
        clubId: 'mp-c2',
        nickname: '감독B',
        avatar: DEFAULT_MANAGER_AVATAR,
        managerTraitId: 'gegenpress_guru',
        profile: {
          name: 'FC 베타',
          shortName: 'BET',
          primaryColor: '#38bdf8',
          secondaryColor: '#0f172a',
          pattern: 'stripes',
        },
      },
    ];
    const squads: Record<string, MpSquadInput> = {
      'mp-c1': {
        formation: '4-3-3',
        tactic: 'possession',
        managerTraitId: 'tiki_taka',
        starters: s1,
        bench: b1,
      },
      'mp-c2': {
        formation: '4-2-3-1',
        tactic: 'counter',
        managerTraitId: 'gegenpress_guru',
        starters: s2,
        bench: b2,
      },
    };

    const initial = createMpLeagueSeason({
      roomId: 'room-preseason-test',
      seasonKey: 's1',
      settings: {
        leagueId: 'epl',
        autoMs: 5000,
        uclEnabled: true,
        turnSec: 45,
        maxPlayers: 2,
      },
      draftLeaguePool: ['epl', 'laliga', 'seriea', 'bundesliga', 'ligue1'],
      humans,
      squads,
    });

    // Must pause BEFORE Round 1 for pre-season tactics & readiness confirmation
    expect(initial.round).toBe(0);
    expect(initial.flow.kind).toBe('consent');
    if (initial.flow.kind === 'consent') {
      expect(initial.flow.key).toBe('league-start:s1');
      expect(initial.flow.requiredClubIds).toEqual(['mp-c1', 'mp-c2']);
    }

    // Without consent, engine does NOT rush into Round 1
    const blocked = runMpLeague(initial, { squads });
    expect(blocked.round).toBe(0);
    expect(blocked.flow.kind).toBe('consent');

    // Once all managers click Ready, Round 1 immediately starts (either simulates 1R or launches 1R live H2H)
    const unlocked = grantMpLeagueConsent(blocked);
    expect(unlocked.flow.kind).toBe('auto');
    const afterR1 = runMpLeague(unlocked, { squads });
    expect(afterR1.round === 1 || afterR1.flow.kind === 'h2h').toBe(true);
  });

  it('5. Multiplayer Draft Roulette dynamically binds target sub-position before & after spin (never stuck on CM)', () => {
    const emptyStarters = Array.from({ length: 11 }, () => null as Player | null);
    const emptyBench = Array.from({ length: 5 }, () => null as Player | null);

    // Round 1 (before spin): 4-3-3 first open slot is GK, NOT hardcoded CM!
    const r1Slot = findNextOpenDraftSlot('4-3-3', emptyStarters, emptyBench);
    expect(r1Slot?.subPosition).toBe('GK');
    const r1Display = resolveMpRouletteTargetDisplay({
      previewSlot: null,
      roll: null,
      myNextOpenSlot: r1Slot,
      spinnerNextOpenSlot: r1Slot,
      iAmSpinner: true,
    });
    expect(r1Display.subPosition).toBe('GK');
    expect(r1Display.label).toBe('GK');

    // Round 2 (after GK filled, before spin): next slot is LB/CB, dynamically updated
    const withGk = [...emptyStarters];
    withGk[0] = PLAYERS.find((p) => p.position === 'GK')!;
    const r2Slot = findNextOpenDraftSlot('4-3-3', withGk, emptyBench);
    expect(r2Slot?.subPosition).not.toBe('CM');
    const r2Display = resolveMpRouletteTargetDisplay({
      previewSlot: null,
      roll: null,
      myNextOpenSlot: r2Slot,
      spinnerNextOpenSlot: r2Slot,
      iAmSpinner: false,
    });
    expect(r2Display.subPosition).toBe(r2Slot?.subPosition);

    // After spin: non-spinner with different formation sees their own next open slot unless previewing
    const fullStarters = makeSquad('4-3-3', 0);
    const benchOpenSlot = findNextOpenDraftSlot('4-3-3', fullStarters, emptyBench);
    expect(benchOpenSlot?.area).toBe('bench');
    expect(benchOpenSlot?.subPosition).toBe('GK');
    const postSpin = resolveMpRouletteTargetDisplay({
      previewSlot: null,
      roll: { subPosition: 'ST', label: 'ST' },
      myNextOpenSlot: benchOpenSlot,
      spinnerNextOpenSlot: { subPosition: 'ST', label: 'ST' },
      iAmSpinner: false,
    });
    expect(postSpin.subPosition).toBe('GK');

    // Clicking a candidate preview overrides immediately
    const previewing = resolveMpRouletteTargetDisplay({
      previewSlot: { subPosition: 'LW', label: 'LW' },
      roll: { subPosition: 'ST', label: 'ST' },
      myNextOpenSlot: benchOpenSlot,
      spinnerNextOpenSlot: { subPosition: 'ST', label: 'ST' },
      iAmSpinner: false,
    });
    expect(previewing.subPosition).toBe('LW');
    expect(previewing.label).toBe('LW');
  });
});
