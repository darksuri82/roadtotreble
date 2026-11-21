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
  computeMatchFatigueGain,
  createDefaultCondition,
  createDefaultManagerEventsState,
  createInjury,
  getFatigueInitialStaminaCap,
  getFatigueOvrPenalty,
  getInjuryOvrPenalty,
  getMoraleOvrBonus,
  getTeamMoraleBonus,
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
import type { PlayerConditionMap } from '../types/condition';
import type { Player } from '../types/player';

function makeSeededRng(seed = 202603): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe('v3.0 Cumulative Fatigue, 3-Tier Injuries, Morale, 72 Manager Events & 105 SVG Flags', () => {
  it('accumulates fatigue on match play, recovers on rest, and applies expected tier penalties', () => {
    const cm = ACTIVE_PLAYERS.find((p) => p.position === 'MF')!;
    const gk = ACTIVE_PLAYERS.find((p) => p.position === 'GK')!;

    const cmGain = computeMatchFatigueGain({
      player: cm,
      subPosition: 'CM',
      tactic: 'gegenpressing',
      minutesPlayed: 90,
    });
    const gkGain = computeMatchFatigueGain({
      player: gk,
      subPosition: 'GK',
      tactic: 'balanced',
      minutesPlayed: 90,
    });
    expect(cmGain).toBeGreaterThan(gkGain * 2);

    expect(getFatigueOvrPenalty(35)).toBe(0);
    expect(getFatigueOvrPenalty(45)).toBe(-1.0);
    expect(getFatigueOvrPenalty(65)).toBe(-2.5);
    expect(getFatigueOvrPenalty(85)).toBe(-4.5);

    expect(getFatigueInitialStaminaCap(35)).toBe(100);
    expect(getFatigueInitialStaminaCap(65)).toBe(84);
    expect(getFatigueInitialStaminaCap(85)).toBe(74);

    // Rest recovers significantly
    const squad = [cm, gk];
    const condMap: PlayerConditionMap = {
      [cm.id]: { ...createDefaultCondition(), fatigue: 55 },
      [gk.id]: { ...createDefaultCondition(), fatigue: 20 },
    };
    const res = updateSquadConditionsAfterMatch({
      squad,
      starterIds: new Set([gk.id]),
      minutesByPlayerId: { [cm.id]: 0, [gk.id]: 90 },
      tactic: 'balanced',
      conditionMap: condMap,
      competition: 'league',
      isShortRest: false,
      rng: () => 0.99, // no injury
    });
    expect(res.conditionMap[cm.id].fatigue).toBe(31); // 55 - 24
  });

  it('produces restrained realistic injury rates and scales up when fatigued', () => {
    const fw = ACTIVE_PLAYERS.find((p) => p.position === 'FW')!;
    const rngFresh = makeSeededRng(101);
    const rngFatigued = makeSeededRng(101);

    let freshMinor = 0;
    let freshModerate = 0;
    let freshSevere = 0;
    let fatiguedTotal = 0;
    const trials = 20000;

    for (let i = 0; i < trials; i += 1) {
      const fRes = rollPlayerMatchInjury({
        player: fw,
        currentCondition: createDefaultCondition(),
        postMatchFatigue: 20,
        minutesPlayed: 90,
        rng: rngFresh,
      });
      if (fRes.injury?.severity === 'minor') freshMinor += 1;
      if (fRes.injury?.severity === 'moderate') freshModerate += 1;
      if (fRes.injury?.severity === 'severe') freshSevere += 1;

      const dRes = rollPlayerMatchInjury({
        player: fw,
        currentCondition: createDefaultCondition(),
        postMatchFatigue: 70,
        minutesPlayed: 90,
        rng: rngFatigued,
      });
      if (dRes.injury) fatiguedTotal += 1;
    }

    const freshTotal = freshMinor + freshModerate + freshSevere;
    expect(freshMinor).toBeGreaterThan(freshModerate);
    expect(freshModerate).toBeGreaterThanOrEqual(freshSevere);
    // ~0.324% fresh rate => roughly 40..95 injuries over 20000 player-matches
    expect(freshTotal).toBeGreaterThan(40);
    expect(freshTotal).toBeLessThan(95);
    // Fatigued (1.9x) must be substantially higher
    expect(fatiguedTotal).toBeGreaterThan(freshTotal * 1.5);

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
      rng: () => 0.00001,
    });
    expect(capped.newInjuries.length).toBe(1);
    // Severe injury (rng=0.00001 < 0.00004) drops injured player morale by -3 and shocks teamMoraleDelta
    const injuredId = capped.newInjuries[0].playerId;
    expect(capped.conditionMap[injuredId].morale).toBe(-3);
    expect(capped.teamMoraleDelta).toBe(-1);
  });

  it('enforces natural morale cooldown, solo MOM ignition over mass team fire, and collective explosion surges', () => {
    const squad11 = ACTIVE_PLAYERS.slice(0, 11);
    const starterIds = new Set(squad11.map((p) => p.id));
    const minutesByPlayerId = Object.fromEntries(squad11.map((p) => [p.id, 90]));
    const momId = squad11[8].id;

    // 1. Ordinary 1-0 win: ONLY MOM ignites (🔥 >= 4), teammates stay calm (<= 3)
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
    const fireAfterOrd = squad11.filter((p) => ordinaryWin.conditionMap[p.id].morale >= 4);
    expect(fireAfterOrd.map((p) => p.id)).toEqual([momId]);

    // 2. Next ordinary match without fresh heroics: previous MOM cools from >=4 back to 3
    const nextMatch = updateSquadConditionsAfterMatch({
      squad: squad11,
      starterIds,
      minutesByPlayerId,
      tactic: 'balanced',
      conditionMap: ordinaryWin.conditionMap,
      competition: 'league',
      outcome: 'D',
      goalDiff: 0,
      rng: () => 0.99,
    });
    expect(nextMatch.conditionMap[momId].morale).toBe(3);

    // 3. True collective explosion (4-0 demolition on a warm squad): multiple starters ignite together
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
    const fireAfterDemo = squad11.filter((p) => demolition.conditionMap[p.id].morale >= 4);
    expect(fireAfterDemo.length).toBeGreaterThanOrEqual(8);
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

  it('applies morale and condition modifiers cleanly to effective player OVR', () => {
    expect(getMoraleOvrBonus(5)).toBe(2);
    expect(getMoraleOvrBonus(2)).toBe(1);
    expect(getMoraleOvrBonus(0)).toBe(0);
    expect(getMoraleOvrBonus(-2)).toBe(-1);
    expect(getMoraleOvrBonus(-5)).toBe(-2);
    expect(getTeamMoraleBonus(4)).toBe(0.5);
    expect(getTeamMoraleBonus(-4)).toBe(-0.5);

    const sample = ACTIVE_PLAYERS[0];
    const boosted = applyConditionToPlayers(
      [sample],
      { [sample.id]: { ...createDefaultCondition(), morale: 5, fatigue: 10 } },
      4,
    );
    expect(boosted[0].ovr).toBe(Math.min(99, sample.ovr + 3)); // +2 + 0.5 rounded = +3 or +2
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
