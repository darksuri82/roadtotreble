import { describe, expect, it } from 'vitest';
import {
  ALL_MANAGER_EVENTS,
  pickNextManagerEvent,
  resolveManagerEventChoice,
} from '../data/managerEvents';
import { LOCKER_ROOM_EVENTS } from '../data/managerEventsLocker';
import { PRESS_CONFERENCE_EVENTS } from '../data/managerEventsPress';
import {
  applyConditionToPlayers,
  createDefaultCondition,
  createDefaultManagerEventsState,
  createInjury,
  getInjuryOvrPenalty,
  getMoraleOvrBonus,
  getTeamMoraleBonus,
  recommendBenchReplacements,
  resolveAutoReturnInjuredStarters,
  rollPlayerMatchInjury,
  selectConditionAwareAiLineup,
  tickInjuryOneMatch,
  updateSquadConditionsAfterMatch,
} from '../engine/conditionEngine';
import { ACTIVE_PLAYERS, LEGEND_PLAYERS } from '../engine/dataLoader';
import { UCL_EXTERNAL_TEAMS } from '../engine/uclEngine';
import {
  resolveFlagKey,
  SUPPORTED_FLAG_KEYS,
} from '../components/common/CountryFlagSvg';
import type { InjuryAutoReturnEntry, PlayerConditionMap } from '../types/condition';
import type { Player } from '../types/player';

function makeSeededRng(seed = 202603): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe('v3.1 Standalone 3-Tier Injuries, Auto-Return Lineup, Morale, 72 Manager Events & 105 SVG Flags', () => {
  it('produces restrained standalone injury rates (~0.456% outfield / lower for GK) with max-1 per match cap & morale drop', () => {
    const fw = ACTIVE_PLAYERS.find((p) => p.position === 'FW')!;
    const gk = ACTIVE_PLAYERS.find((p) => p.position === 'GK')!;
    const rngFw = makeSeededRng(101);
    const rngGk = makeSeededRng(101);

    let fwMinor = 0;
    let fwModerate = 0;
    let fwSevere = 0;
    let gkTotal = 0;
    const trials = 20000;

    for (let i = 0; i < trials; i += 1) {
      const fRes = rollPlayerMatchInjury({
        player: fw,
        currentCondition: createDefaultCondition(),
        minutesPlayed: 90,
        rng: rngFw,
      });
      if (fRes.injury?.severity === 'minor') fwMinor += 1;
      if (fRes.injury?.severity === 'moderate') fwModerate += 1;
      if (fRes.injury?.severity === 'severe') fwSevere += 1;

      const gRes = rollPlayerMatchInjury({
        player: gk,
        currentCondition: createDefaultCondition(),
        minutesPlayed: 90,
        rng: rngGk,
      });
      if (gRes.injury) gkTotal += 1;
    }

    const fwTotal = fwMinor + fwModerate + fwSevere;
    expect(fwMinor).toBeGreaterThan(fwModerate * 4);
    expect(fwModerate).toBeGreaterThanOrEqual(fwSevere);
    // v5.1 rare-event outfield rate (~0.143%) => roughly 15..50 injuries over 20000 player-matches (~0.8/season)
    expect(fwTotal).toBeGreaterThan(14);
    expect(fwTotal).toBeLessThan(55);
    // GK (0.35x) must be substantially lower than outfield
    expect(gkTotal).toBeLessThan(fwTotal * 0.65);

    // Per-team per-match safety cap: never more than 1 fresh injury in a single match even with rng=0
    const squad11 = ACTIVE_PLAYERS.slice(0, 11);
    const capped = updateSquadConditionsAfterMatch({
      squad: squad11,
      starterIds: new Set(squad11.map((p) => p.id)),
      minutesByPlayerId: Object.fromEntries(squad11.map((p) => [p.id, 90])),
      tactic: 'gegenpressing',
      conditionMap: {},
      competition: 'league',
      trackUserAlerts: true,
      rng: () => 0.000005,
    });
    expect(capped.newInjuries.length).toBe(1);
    // Severe injury (rng=0.000005 < 0.000018) drops injured player morale by -3 and shocks teamMoraleDelta
    const injuredId = capped.newInjuries[0].playerId;
    expect(capped.conditionMap[injuredId].morale).toBe(-3);
    expect(capped.teamMoraleDelta).toBe(-1);
  });

  it('auto-returns healed original starters safely across direct swap, multi-step rotation, manual return, and transfer edge cases', () => {
    const pool = ACTIVE_PLAYERS.slice(0, 16);
    const origStarters: (Player | null)[] = pool.slice(0, 11);
    const origBench: (Player | null)[] = pool.slice(11, 16);

    // Scenario A: Direct 1:1 replacement (slot 9 injured -> bench[0] put into slot 9)
    const injuredA = origStarters[9]!;
    const repA = origBench[0]!;
    const startersA = [...origStarters];
    const benchA = [...origBench];
    startersA[9] = repA;
    benchA[0] = injuredA;

    const entryA: InjuryAutoReturnEntry = {
      injuredPlayerId: injuredA.id,
      injuredPlayerName: injuredA.name,
      originalSlotIndex: 9,
      replacementPlayerId: repA.id,
    };

    // While still injured (matchesRemaining > 0), must NOT auto-return
    const stillOutMap: PlayerConditionMap = {
      [injuredA.id]: {
        ...createDefaultCondition(),
        injury: {
          ...createInjury('minor', 1, 'league', () => 0.1),
          matchesRemaining: 1,
        },
      },
    };
    const notYet = resolveAutoReturnInjuredStarters({
      starters: startersA,
      bench: benchA,
      conditionMap: stillOutMap,
      autoReturns: [entryA],
      formation: '4-3-3',
    });
    expect(notYet.returnedNotifications.length).toBe(0);
    expect(notYet.remainingAutoReturns.length).toBe(1);
    expect(notYet.starters[9]?.id).toBe(repA.id);

    // Once healed (matchesRemaining === 0 / null), must auto-return injuredA -> slot 9 and repA -> bench
    const healedMap: PlayerConditionMap = {
      [injuredA.id]: { ...createDefaultCondition(), injury: null },
    };
    const restoredA = resolveAutoReturnInjuredStarters({
      starters: startersA,
      bench: benchA,
      conditionMap: healedMap,
      autoReturns: [entryA],
      formation: '4-3-3',
    });
    expect(restoredA.returnedNotifications.length).toBe(1);
    expect(restoredA.returnedNotifications[0].playerId).toBe(injuredA.id);
    expect(restoredA.remainingAutoReturns.length).toBe(0);
    expect(restoredA.starters[9]?.id).toBe(injuredA.id);
    expect(restoredA.bench[0]?.id).toBe(repA.id);

    // Scenario B: Flexible 2-step rotation reversal (slot 9 injured -> slot 8 moved to slot 9, bench[1] entered slot 8)
    const slot8Orig = origStarters[8]!;
    const repB = origBench[1]!;
    const startersB = [...origStarters];
    const benchB = [...origBench];
    startersB[9] = slot8Orig;
    startersB[8] = repB;
    benchB[1] = injuredA;

    const restoredB = resolveAutoReturnInjuredStarters({
      starters: startersB,
      bench: benchB,
      conditionMap: healedMap,
      autoReturns: [
        {
          injuredPlayerId: injuredA.id,
          injuredPlayerName: injuredA.name,
          originalSlotIndex: 9,
          replacementPlayerId: repB.id,
        },
      ],
      formation: '4-3-3',
    });
    expect(restoredB.starters[9]?.id).toBe(injuredA.id);
    expect(restoredB.starters[8]?.id).toBe(slot8Orig.id);
    expect(restoredB.bench[1]?.id).toBe(repB.id);
    // Ensure zero duplicate player IDs across starters + bench
    const allIdsB = [...restoredB.starters, ...restoredB.bench]
      .filter((p): p is Player => Boolean(p))
      .map((p) => p.id);
    expect(new Set(allIdsB).size).toBe(16);

    // Scenario C: Safety guards — departed/transferred player & already-manually-returned player
    const edgeRes = resolveAutoReturnInjuredStarters({
      starters: origStarters,
      bench: origBench,
      conditionMap: {},
      autoReturns: [
        {
          injuredPlayerId: 'departed-player-999',
          injuredPlayerName: '이적 선수',
          originalSlotIndex: 5,
          replacementPlayerId: origBench[0]!.id,
        },
        {
          injuredPlayerId: origStarters[2]!.id, // already manually in starters!
          injuredPlayerName: origStarters[2]!.name,
          originalSlotIndex: 2,
          replacementPlayerId: origBench[1]!.id,
        },
      ],
      formation: '4-3-3',
    });
    expect(edgeRes.remainingAutoReturns.length).toBe(0);
    expect(edgeRes.returnedNotifications.length).toBe(0);
    expect(edgeRes.starters[2]?.id).toBe(origStarters[2]!.id);
  });

  it('recommends bench replacements ranked by position fit and effective OVR', () => {
    const gk = ACTIVE_PLAYERS.find((p) => p.position === 'GK')!;
    const st = ACTIVE_PLAYERS.find((p) => p.mainPositions.includes('ST'))!;
    const cb = ACTIVE_PLAYERS.find((p) => p.mainPositions.includes('CB'))!;
    const recs = recommendBenchReplacements({
      injuredSlotPosition: 'FW',
      injuredSlotSubPosition: 'ST',
      bench: [gk, cb, st],
      conditionMap: {},
      includeUnavailable: true,
    });
    expect(recs[0].player.id).toBe(st.id);
    expect(recs[0].fit).toBe('main');
    expect(recs[recs.length - 1].player.id).toBe(gk.id);
  });

  it('enforces restrained routine-match morale, natural cooldown, and collective demolition surges', () => {
    const squad11 = ACTIVE_PLAYERS.slice(0, 11);
    const starterIds = new Set(squad11.map((p) => p.id));
    const minutesByPlayerId = Object.fromEntries(squad11.map((p) => [p.id, 90]));
    const momId = squad11[8].id;

    // 1. v5.1: Ordinary 1-0 win keeps team restrained (all <= 2, no free OVR boost) while MOM leads the squad
    const warmStart: PlayerConditionMap = Object.fromEntries(
      squad11.map((p) => [p.id, { ...createDefaultCondition(), morale: 1 }]),
    );
    const ordinaryWin = updateSquadConditionsAfterMatch({
      squad: squad11,
      starterIds,
      minutesByPlayerId,
      tactic: 'balanced',
      conditionMap: warmStart,
      competition: 'league',
      outcome: 'W',
      goalDiff: 1,
      momPlayerId: momId,
      goalsByPlayerId: { [momId]: 1 },
      teamWinStreak: 2,
      rng: () => 0.99,
    });
    expect(ordinaryWin.conditionMap[momId].morale).toBe(2);
    expect(
      squad11.every((p) => ordinaryWin.conditionMap[p.id].morale <= 2),
    ).toBe(true);

    // 2. Next ordinary draw without heroics: elevated morale (+4 from interview) cools back down toward 0
    const afterInterview: PlayerConditionMap = {
      ...ordinaryWin.conditionMap,
      [momId]: { ...createDefaultCondition(), morale: 4 },
    };
    const nextMatch = updateSquadConditionsAfterMatch({
      squad: squad11,
      starterIds,
      minutesByPlayerId,
      tactic: 'balanced',
      conditionMap: afterInterview,
      competition: 'league',
      outcome: 'D',
      goalDiff: 0,
      rng: () => 0.99,
    });
    expect(nextMatch.conditionMap[momId].morale).toBeLessThan(4);

    // 3. v5.1 demolition (4-0 on a hot squad + 5-match win streak):
    // MOM with personal heroics + collective demolition breaks into +3 (+1 OVR),
    // while regular teammates remain capped at <= 2 so interviews remain the key driver for team-wide +OVR.
    const hotStart: PlayerConditionMap = Object.fromEntries(
      squad11.map((p) => [p.id, { ...createDefaultCondition(), morale: 2 }]),
    );
    const demolition = updateSquadConditionsAfterMatch({
      squad: squad11,
      starterIds,
      minutesByPlayerId,
      tactic: 'balanced',
      conditionMap: hotStart,
      competition: 'league',
      outcome: 'W',
      goalDiff: 4,
      momPlayerId: momId,
      goalsByPlayerId: { [momId]: 2 },
      teamWinStreak: 5,
      rng: () => 0.99,
    });
    expect(demolition.conditionMap[momId].morale).toBe(3);
    const surgedAfterDemo = squad11.filter(
      (p) => demolition.conditionMap[p.id].morale >= 3,
    );
    expect(surgedAfterDemo.map((p) => p.id)).toEqual([momId]);
  });

  it('handles 3-tier injury recovery countdown, minor play-through penalty, and AI injury substitution', () => {
    const minor = createInjury('minor', 5, 'league', () => 0.1);
    expect(minor.canPlayThrough).toBe(true);
    expect(minor.playThroughPenalty).toBeLessThanOrEqual(-2);
    expect(minor.playThroughPenalty).toBeGreaterThanOrEqual(-4);

    const mod = createInjury('moderate', 5, 'league', () => 0.1);
    expect(mod.canPlayThrough).toBe(false);
    expect(mod.recoveryMatchesRemaining).toBe(2);

    // Tick down moderate injury to recovery rust phase
    let cur = mod as typeof mod | null;
    for (let i = 0; i < mod.initialMatches; i += 1) {
      cur = tickInjuryOneMatch(cur);
    }
    expect(cur?.matchesRemaining).toBe(0);
    expect(cur?.recoveryMatchesRemaining).toBe(2);
    expect(
      getInjuryOvrPenalty({
        ...createDefaultCondition(),
        injury: cur,
      }),
    ).toBe(-2);

    // AI lineup excludes unavailable moderate-injured starter
    const clubPlayers = ACTIVE_PLAYERS.filter((p) => p.club === '아스널');
    const base11 = clubPlayers.slice(0, 11);
    const injuredStar = base11[0];
    const condMap: PlayerConditionMap = {
      [injuredStar.id]: {
        ...createDefaultCondition(),
        injury: mod,
      },
    };
    const aiPick = selectConditionAwareAiLineup({
      baseRoster: base11,
      fullClubPool: clubPlayers,
      conditionMap: condMap,
    });
    expect(aiPick.starters.some((p) => p.id === injuredStar.id)).toBe(false);
    expect(aiPick.injuredPlayers.some((x) => x.player.id === injuredStar.id)).toBe(true);
  });

  it('applies v5.1 strict morale and condition modifiers cleanly to effective player OVR', () => {
    expect(getMoraleOvrBonus(5)).toBe(2);
    expect(getMoraleOvrBonus(4)).toBe(1);
    expect(getMoraleOvrBonus(3)).toBe(1);
    expect(getMoraleOvrBonus(2)).toBe(0);
    expect(getMoraleOvrBonus(0)).toBe(0);
    expect(getMoraleOvrBonus(-2)).toBe(0);
    expect(getMoraleOvrBonus(-3)).toBe(-1);
    expect(getMoraleOvrBonus(-5)).toBe(-2);
    expect(getTeamMoraleBonus(5)).toBe(0.5);
    expect(getTeamMoraleBonus(4)).toBe(0);
    expect(getTeamMoraleBonus(-5)).toBe(-0.5);

    const sample = ACTIVE_PLAYERS[0];
    const boosted = applyConditionToPlayers(
      [sample],
      { [sample.id]: { ...createDefaultCondition(), morale: 5 } },
      5,
    );
    expect(boosted[0].ovr).toBe(Math.min(99, sample.ovr + 3)); // +2 + 0.5 rounded = +3
  });

  it('provides 72 unique manager events (36 press + 36 locker) where every event has a morale-drop/risk choice', () => {
    expect(PRESS_CONFERENCE_EVENTS.length).toBe(36);
    expect(LOCKER_ROOM_EVENTS.length).toBe(36);
    expect(ALL_MANAGER_EVENTS.length).toBe(72);

    const uniqueIds = new Set(ALL_MANAGER_EVENTS.map((e) => e.id));
    expect(uniqueIds.size).toBe(72);

    const teamCount = ALL_MANAGER_EVENTS.filter((e) => e.targetScope === 'team').length;
    const groupCount = ALL_MANAGER_EVENTS.filter((e) => e.targetScope === 'position_group').length;
    const playerCount = ALL_MANAGER_EVENTS.filter((e) => e.targetScope === 'player').length;
    expect(teamCount).toBeGreaterThanOrEqual(20);
    expect(groupCount).toBeGreaterThanOrEqual(18);
    expect(playerCount).toBeGreaterThanOrEqual(20);

    for (const ev of ALL_MANAGER_EVENTS) {
      expect(ev.choices.length).toBe(3);
      let hasNegativePath = false;
      for (const ch of ev.choices) {
        expect(ch.quote.length).toBeGreaterThan(10);
        expect(ch.successEffect.reactionText.length).toBeGreaterThan(10);
        const s = ch.successEffect;
        const f = ch.failEffect;
        const sNeg = [
          s.targetMoraleDelta,
          s.teamMoraleDelta,
          s.starterMoraleDelta,
          s.benchMoraleDelta,
          s.secondaryGroupDelta,
        ].some((v) => (v ?? 0) < 0);
        const fNeg = f
          ? [
              f.targetMoraleDelta,
              f.teamMoraleDelta,
              f.starterMoraleDelta,
              f.benchMoraleDelta,
              f.secondaryGroupDelta,
            ].some((v) => (v ?? 0) < 0)
          : false;
        if (sNeg || fNeg) hasNegativePath = true;
      }
      expect(hasNegativePath).toBe(true);
    }

    // Test non-repeating selection + interpolation + resolution
    const starters: (Player | null)[] = ACTIVE_PLAYERS.slice(0, 11);
    const bench: (Player | null)[] = ACTIVE_PLAYERS.slice(11, 16);
    const condMap: PlayerConditionMap = {};
    const rng = makeSeededRng(777);

    const picked = pickNextManagerEvent({
      eventsState: {
        ...createDefaultManagerEventsState(),
        matchesSinceLastEvent: 4,
        recentLossStreak: 3,
      },
      starters,
      bench,
      conditionMap: condMap,
      teamName: 'FC 드림',
      managerName: '김감독',
      nextOpponentName: '아스널',
      nextOpponentRank: 1,
      userRank: 2,
      rng,
    });
    expect(picked).not.toBeNull();
    expect(picked!.prompt).not.toContain('{');
    expect(picked!.title).not.toContain('{');
    for (const c of picked!.choices) {
      expect(c.quote).not.toContain('{');
    }

    const resolved = resolveManagerEventChoice({
      event: picked!,
      choiceId: picked!.choices[0].id,
      starters,
      bench,
      conditionMap: condMap,
      currentTeamMorale: 0,
      rng: () => 0.1,
    });
    expect(resolved.resolution.outcomes.length).toBeGreaterThan(0);
    expect(resolved.resolution.reactionText.length).toBeGreaterThan(5);
  });

  it('covers 100% of all 2,397 players across Active, Legend, and UCL datasets with inline SVG flags including UK home nations', () => {
    expect(resolveFlagKey('GB', '잉글랜드')).toBe('GB-ENG');
    expect(resolveFlagKey('GB', '스코틀랜드')).toBe('GB-SCT');
    expect(resolveFlagKey('GB', '웨일스')).toBe('GB-WLS');
    expect(resolveFlagKey('GB', '북아일랜드')).toBe('GB-NIR');
    expect(resolveFlagKey('KR', '한국')).toBe('KR');
    expect(resolveFlagKey('KR', '대한민국')).toBe('KR');

    const uclPlayers = UCL_EXTERNAL_TEAMS.flatMap((t) => t.roster);
    const everyone = [...ACTIVE_PLAYERS, ...LEGEND_PLAYERS, ...uclPlayers];
    expect(everyone.length).toBeGreaterThan(2300);

    const missing: string[] = [];
    for (const p of everyone) {
      const key = resolveFlagKey(p.nationalityCode, p.nationality);
      if (!SUPPORTED_FLAG_KEYS.has(key)) {
        missing.push(`${p.nationalityCode}|${p.nationality}=>${key}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
