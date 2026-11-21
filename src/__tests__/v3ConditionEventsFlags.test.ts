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
    const trials = 4000;

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
    // ~1.35% fresh rate => roughly 35..80 injuries over 4000 player-matches
    expect(freshTotal).toBeGreaterThan(25);
    expect(freshTotal).toBeLessThan(95);
    // Fatigued (2.8x) must be substantially higher
    expect(fatiguedTotal).toBeGreaterThan(freshTotal * 2);
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

  it('provides 72 unique manager events (36 press + 36 locker) across all 3 target scopes with clean interpolation & resolution', () => {
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
      for (const ch of ev.choices) {
        expect(ch.quote.length).toBeGreaterThan(10);
        expect(ch.successEffect.reactionText.length).toBeGreaterThan(10);
      }
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
