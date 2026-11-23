import type { PlayerConditionMap } from '../types/condition';
import type { FormationId, ManagerTraitId, UserClubProfile } from '../types/game';
import type {
  Club,
  Fixture,
  LiveHalftimeState,
  MatchResult,
  TacticId,
} from '../types/league';
import type { MpH2HSpec, MpLeagueHuman } from '../types/mpLeague';
import type { MpMatchState, MpTacticSubmission } from '../types/multiplayer';
import type { Player } from '../types/player';
import { calculateChemistry, calculateTeamRatings } from './chemistryEngine';
import { applyConditionToPlayers } from './conditionEngine';
import type { UserMatchContext } from './matchEngine';
import {
  simulateExtraTimeFirstHalf,
  simulateExtraTimeSecondHalfAndPenalties,
  simulateFirstHalf,
  simulateSecondHalf,
} from './matchEngine';

/** One side's confirmed tactics for a synced friend-vs-friend match barrier. */
export interface MpH2HSideInput {
  human: MpLeagueHuman;
  formation: FormationId;
  tactic: TacticId;
  starters: Player[];
  bench: Player[];
  teamMorale: number;
}

export function mpH2HMatchId(spec: MpH2HSpec, seasonKey: string): string {
  return `mpl-${seasonKey}-${spec.key}`;
}

export function mpH2HPreMatchKey(spec: MpH2HSpec, seasonKey: string): string {
  return `pre_match:${mpH2HMatchId(spec, seasonKey)}`;
}

export function mpH2HDoneKey(matchId: string): string {
  return `h2h-done:${matchId}`;
}

export function sideFromSubmission(
  human: MpLeagueHuman,
  sub: MpTacticSubmission,
  teamMorale: number,
): MpH2HSideInput {
  return {
    human,
    formation: sub.formation,
    tactic: sub.tactic,
    starters: sub.starters,
    bench: sub.bench,
    teamMorale,
  };
}

function buildClub(
  id: string,
  profile: UserClubProfile,
  formation: FormationId,
  tactic: TacticId,
  starters: Player[],
  traitId: ManagerTraitId,
): Club {
  const chem = calculateChemistry(formation, starters, tactic, traitId);
  const ratings = calculateTeamRatings(
    formation,
    starters,
    chem.total,
    traitId,
    chem.slotSynergies,
  );
  return {
    id,
    name: profile.name || 'FC 드림',
    shortName: profile.shortName || 'DRM',
    primaryColor: profile.primaryColor || '#10b981',
    secondaryColor: profile.secondaryColor || '#f8fafc',
    pattern: profile.pattern || 'solid',
    formation,
    defaultTactic: tactic,
    att: Math.round(ratings.effectiveAtt || ratings.att || 80),
    mid: Math.round(ratings.effectiveMid || ratings.mid || 80),
    def: Math.round(ratings.effectiveDef || ratings.def || 80),
    topScorers: [
      starters[10]?.name ?? starters[9]?.name ?? '에이스',
      starters[9]?.name ?? starters[8]?.name ?? '공격수',
      starters[8]?.name ?? starters[7]?.name ?? '미드필더',
    ],
    isUser: false,
  };
}

function buildCtx(params: {
  clubId: string;
  formation: FormationId;
  tactic: TacticId;
  starters: Player[];
  bench: Player[];
  traitId: ManagerTraitId;
  competition: 'league' | 'cup' | 'ucl';
  halftimeAdjusted?: boolean;
  halftimeSubsMade?: number;
  halftimeSubIds?: string[];
  firstHalfStarters?: Player[];
}): UserMatchContext {
  const chem = calculateChemistry(
    params.formation,
    params.starters,
    params.tactic,
    params.traitId,
  );
  const ratings = calculateTeamRatings(
    params.formation,
    params.starters,
    chem.total,
    params.traitId,
    chem.slotSynergies,
  );
  return {
    userClubId: params.clubId,
    formation: params.formation,
    tactic: params.tactic,
    starters: params.starters,
    bench: params.bench,
    chemistry: chem.total,
    ratings,
    slotSynergies: chem.slotSynergies,
    managerTraitId: params.traitId,
    halftimeAdjusted: params.halftimeAdjusted ?? false,
    halftimeSubsMade: params.halftimeSubsMade ?? 0,
    halftimeSubIds: params.halftimeSubIds ?? [],
    firstHalfStarters: params.firstHalfStarters,
    liveSubs: [],
    allowAutoSubs: false,
    opponentRank: 1,
    competition: params.competition,
  };
}

function competitionOf(spec: MpH2HSpec): 'league' | 'cup' | 'ucl' {
  if (spec.ctx === 'league') return 'league';
  if (spec.ctx === 'cup') return 'cup';
  return 'ucl';
}

function diffSubs(
  before: Player[],
  after: Player[],
): { outPlayerName: string; inPlayerName: string; inPlayerId: string }[] {
  const beforeIds = new Set(before.map((p) => p.id));
  const afterIds = new Set(after.map((p) => p.id));
  const out = before.filter((p) => !afterIds.has(p.id));
  const inn = after.filter((p) => !beforeIds.has(p.id));
  const count = Math.min(out.length, inn.length);
  const subs: { outPlayerName: string; inPlayerName: string; inPlayerId: string }[] = [];
  for (let i = 0; i < count; i += 1) {
    subs.push({
      outPlayerName: out[i].name,
      inPlayerName: inn[i].name,
      inPlayerId: inn[i].id,
    });
  }
  return subs;
}

interface PreparedSide {
  club: Club;
  eff: Player[];
  effBench: Player[];
}

function prepareSide(side: MpH2HSideInput, conditions: PlayerConditionMap): PreparedSide {
  const eff = applyConditionToPlayers(side.starters, conditions, side.teamMorale);
  const effBench = applyConditionToPlayers(side.bench, conditions, side.teamMorale);
  return {
    eff,
    effBench,
    club: buildClub(
      side.human.clubId,
      side.human.profile,
      side.formation,
      side.tactic,
      eff,
      side.human.managerTraitId,
    ),
  };
}

/** Both friends locked their tactics: simulate the shared first half (home side = match "host" fields). */
export function kickoffMpH2H(params: {
  spec: MpH2HSpec;
  seasonKey: string;
  home: MpH2HSideInput;
  away: MpH2HSideInput;
  conditions: PlayerConditionMap;
  rng?: () => number;
}): MpMatchState {
  const { spec, seasonKey, home, away, conditions } = params;
  const competition = competitionOf(spec);
  const matchId = mpH2HMatchId(spec, seasonKey);
  const h = prepareSide(home, conditions);
  const a = prepareSide(away, conditions);

  const fixture: Fixture = {
    id: matchId,
    round: spec.round,
    homeTeamId: home.human.clubId,
    awayTeamId: away.human.clubId,
    played: false,
  };

  const ht = simulateFirstHalf({
    fixture,
    homeClub: h.club,
    awayClub: a.club,
    homeRoster: h.eff,
    awayRoster: a.eff,
    userContext: buildCtx({
      clubId: home.human.clubId,
      formation: home.formation,
      tactic: home.tactic,
      starters: h.eff,
      bench: h.effBench,
      traitId: home.human.managerTraitId,
      competition,
    }),
    opponentUserContext: buildCtx({
      clubId: away.human.clubId,
      formation: away.formation,
      tactic: away.tactic,
      starters: a.eff,
      bench: a.effBench,
      traitId: away.human.managerTraitId,
      competition,
    }),
    rng: params.rng,
  });

  const liveHalftime: LiveHalftimeState = {
    ...ht,
    competition,
    competitionLabel: spec.label,
    isKnockoutDecider: spec.knockout,
    aggHomeBeforeMatch: spec.aggHomeBefore,
    aggAwayBeforeMatch: spec.aggAwayBefore,
    phase: 'first_half',
  };

  return {
    matchId,
    matchNumber: spec.round,
    phase: 'first_half',
    hostTeamId: home.human.clubId,
    guestTeamId: away.human.clubId,
    hostFormation: home.formation,
    guestFormation: away.formation,
    hostTactic: home.tactic,
    guestTactic: away.tactic,
    hostManagerTraitId: home.human.managerTraitId,
    guestManagerTraitId: away.human.managerTraitId,
    hostStarters: home.starters,
    hostBench: home.bench,
    guestStarters: away.starters,
    guestBench: away.bench,
    hostFirstHalfStarters: home.starters,
    guestFirstHalfStarters: away.starters,
    hostHalftimeSubIds: [],
    guestHalftimeSubIds: [],
    hostEtSubIds: [],
    guestEtSubIds: [],
    liveHalftime,
    finalResult: null,
    updatedAt: new Date().toISOString(),
  };
}

/** Both friends confirmed halftime changes: simulate the second half with both real choices. */
export function secondHalfMpH2H(params: {
  spec: MpH2HSpec;
  match: MpMatchState;
  home: MpH2HSideInput;
  away: MpH2HSideInput;
  conditions: PlayerConditionMap;
  rng?: () => number;
}): MpMatchState {
  const { spec, match, home, away, conditions } = params;
  const competition = competitionOf(spec);
  const h = prepareSide(home, conditions);
  const a = prepareSide(away, conditions);
  const homeSubs = diffSubs(match.hostFirstHalfStarters, home.starters);
  const awaySubs = diffSubs(match.guestFirstHalfStarters, away.starters);

  const full = simulateSecondHalf({
    halftime: { ...match.liveHalftime, halftimeSubsMade: homeSubs.length },
    homeClub: h.club,
    awayClub: a.club,
    homeRoster: h.eff,
    awayRoster: a.eff,
    userContext: buildCtx({
      clubId: home.human.clubId,
      formation: home.formation,
      tactic: home.tactic,
      starters: h.eff,
      bench: h.effBench,
      traitId: home.human.managerTraitId,
      competition,
      halftimeAdjusted:
        home.tactic !== match.hostTactic ||
        home.formation !== match.hostFormation ||
        homeSubs.length > 0,
      halftimeSubsMade: homeSubs.length,
      halftimeSubIds: homeSubs.map((s) => s.inPlayerId),
      firstHalfStarters: match.hostFirstHalfStarters,
    }),
    opponentUserContext: buildCtx({
      clubId: away.human.clubId,
      formation: away.formation,
      tactic: away.tactic,
      starters: a.eff,
      bench: a.effBench,
      traitId: away.human.managerTraitId,
      competition,
      halftimeAdjusted:
        away.tactic !== match.guestTactic ||
        away.formation !== match.guestFormation ||
        awaySubs.length > 0,
      halftimeSubsMade: awaySubs.length,
      halftimeSubIds: awaySubs.map((s) => s.inPlayerId),
      firstHalfStarters: match.guestFirstHalfStarters,
    }),
    opponentHalftimeSubs: awaySubs.map((s) => ({
      outPlayerName: s.outPlayerName,
      inPlayerName: s.inPlayerName,
    })),
    rng: params.rng,
  });

  const labeled: MatchResult = {
    ...full,
    competition,
    competitionLabel: spec.label,
  };

  return {
    ...match,
    phase: 'second_half',
    hostFormation: home.formation,
    guestFormation: away.formation,
    hostTactic: home.tactic,
    guestTactic: away.tactic,
    hostStarters: home.starters,
    hostBench: home.bench,
    guestStarters: away.starters,
    guestBench: away.bench,
    hostHalftimeSubIds: homeSubs.map((s) => s.inPlayerId),
    guestHalftimeSubIds: awaySubs.map((s) => s.inPlayerId),
    liveHalftime: {
      ...match.liveHalftime,
      phase: 'second_half',
      halftimeSubsMade: homeSubs.length,
      homeTactic: labeled.homeTactic,
      awayTactic: labeled.awayTactic,
      homeFormation: labeled.homeFormation,
      awayFormation: labeled.awayFormation,
      fullMatchResult: labeled,
    },
    finalResult: labeled,
    updatedAt: new Date().toISOString(),
  };
}

/** True when a knockout decider is level after 90 minutes (aggregate included) and must go to extra time. */
export function mpH2HNeedsExtraTime(spec: MpH2HSpec, match: MpMatchState): boolean {
  const res = match.liveHalftime.fullMatchResult;
  if (!spec.knockout || !res) return false;
  return (
    (spec.aggHomeBefore ?? 0) + (res.homeGoals90 ?? res.homeGoals) ===
    (spec.aggAwayBefore ?? 0) + (res.awayGoals90 ?? res.awayGoals)
  );
}

function etContexts(params: {
  spec: MpH2HSpec;
  match: MpMatchState;
  home: MpH2HSideInput;
  away: MpH2HSideInput;
  h: PreparedSide;
  a: PreparedSide;
  homeEtSubCount: number;
  awayEtSubCount: number;
}): { homeCtx: UserMatchContext; awayCtx: UserMatchContext } {
  const { spec, match, home, away, h, a } = params;
  const competition = competitionOf(spec);
  return {
    homeCtx: buildCtx({
      clubId: home.human.clubId,
      formation: home.formation,
      tactic: home.tactic,
      starters: h.eff,
      bench: h.effBench,
      traitId: home.human.managerTraitId,
      competition,
      halftimeAdjusted: true,
      halftimeSubsMade: match.hostHalftimeSubIds.length + params.homeEtSubCount,
      halftimeSubIds: match.hostHalftimeSubIds,
      firstHalfStarters: match.hostFirstHalfStarters,
    }),
    awayCtx: buildCtx({
      clubId: away.human.clubId,
      formation: away.formation,
      tactic: away.tactic,
      starters: a.eff,
      bench: a.effBench,
      traitId: away.human.managerTraitId,
      competition,
      halftimeAdjusted: true,
      halftimeSubsMade: match.guestHalftimeSubIds.length + params.awayEtSubCount,
      halftimeSubIds: match.guestHalftimeSubIds,
      firstHalfStarters: match.guestFirstHalfStarters,
    }),
  };
}

/** Extra time first half (both friends confirmed their 90' break tactics). */
export function extraTimeFirstHalfMpH2H(params: {
  spec: MpH2HSpec;
  match: MpMatchState;
  home: MpH2HSideInput;
  away: MpH2HSideInput;
  conditions: PlayerConditionMap;
  rng?: () => number;
}): MpMatchState {
  const { spec, match, home, away, conditions } = params;
  const base = match.liveHalftime.fullMatchResult;
  if (!base) return match;
  const h = prepareSide(home, conditions);
  const a = prepareSide(away, conditions);
  const homeEt = diffSubs(match.hostStarters, home.starters).map((s) => s.inPlayerId);
  const awayEt = diffSubs(match.guestStarters, away.starters).map((s) => s.inPlayerId);
  const { homeCtx, awayCtx } = etContexts({
    spec,
    match,
    home,
    away,
    h,
    a,
    homeEtSubCount: homeEt.length,
    awayEtSubCount: awayEt.length,
  });

  const et1 = simulateExtraTimeFirstHalf({
    baseResult: base,
    homeClub: h.club,
    awayClub: a.club,
    homeRoster: h.eff,
    awayRoster: a.eff,
    userContext: homeCtx,
    opponentUserContext: awayCtx,
    extraTimeSubIds: homeEt,
    opponentExtraTimeSubIds: awayEt,
    rng: params.rng,
  });

  return {
    ...match,
    phase: 'extra_time',
    hostFormation: home.formation,
    guestFormation: away.formation,
    hostTactic: home.tactic,
    guestTactic: away.tactic,
    hostStarters: home.starters,
    hostBench: home.bench,
    guestStarters: away.starters,
    guestBench: away.bench,
    hostEtSubIds: [...match.hostEtSubIds, ...homeEt],
    guestEtSubIds: [...match.guestEtSubIds, ...awayEt],
    liveHalftime: {
      ...match.liveHalftime,
      phase: 'extra_time',
      homeTactic: et1.homeTactic,
      awayTactic: et1.awayTactic,
      homeFormation: et1.homeFormation,
      awayFormation: et1.awayFormation,
      fullMatchResult: et1,
    },
    finalResult: et1,
    updatedAt: new Date().toISOString(),
  };
}

/** Extra time second half + penalties (both friends confirmed their 105' tactics). */
export function extraTimeSecondHalfMpH2H(params: {
  spec: MpH2HSpec;
  match: MpMatchState;
  home: MpH2HSideInput;
  away: MpH2HSideInput;
  conditions: PlayerConditionMap;
  rng?: () => number;
}): MpMatchState {
  const { spec, match, home, away, conditions } = params;
  const et1 = match.liveHalftime.fullMatchResult;
  if (!et1) return match;
  const h = prepareSide(home, conditions);
  const a = prepareSide(away, conditions);
  const homeEt2 = diffSubs(match.hostStarters, home.starters).map((s) => s.inPlayerId);
  const awayEt2 = diffSubs(match.guestStarters, away.starters).map((s) => s.inPlayerId);
  const allHome = [...match.hostEtSubIds, ...homeEt2];
  const allAway = [...match.guestEtSubIds, ...awayEt2];
  const { homeCtx, awayCtx } = etContexts({
    spec,
    match,
    home,
    away,
    h,
    a,
    homeEtSubCount: allHome.length,
    awayEtSubCount: allAway.length,
  });

  const et2 = simulateExtraTimeSecondHalfAndPenalties({
    et1Result: et1,
    homeClub: h.club,
    awayClub: a.club,
    homeRoster: h.eff,
    awayRoster: a.eff,
    userContext: homeCtx,
    opponentUserContext: awayCtx,
    aggHomeBeforeMatch: spec.aggHomeBefore,
    aggAwayBeforeMatch: spec.aggAwayBefore,
    extraTimeSubIds: allHome,
    opponentExtraTimeSubIds: allAway,
    rng: params.rng,
  });

  return {
    ...match,
    phase: 'extra_time_2',
    hostFormation: home.formation,
    guestFormation: away.formation,
    hostTactic: home.tactic,
    guestTactic: away.tactic,
    hostStarters: home.starters,
    hostBench: home.bench,
    guestStarters: away.starters,
    guestBench: away.bench,
    hostEtSubIds: allHome,
    guestEtSubIds: allAway,
    liveHalftime: {
      ...match.liveHalftime,
      phase: 'extra_time_2',
      homeTactic: et2.homeTactic,
      awayTactic: et2.awayTactic,
      homeFormation: et2.homeFormation,
      awayFormation: et2.awayFormation,
      fullMatchResult: et2,
    },
    finalResult: et2,
    updatedAt: new Date().toISOString(),
  };
}

/** The clubs map both the broadcast and the report need for a friend-vs-friend match. */
export function buildMpH2HClubs(
  humans: MpLeagueHuman[],
  match: MpMatchState,
): Record<string, Club> {
  const map: Record<string, Club> = {};
  const home = humans.find((x) => x.clubId === match.hostTeamId);
  const away = humans.find((x) => x.clubId === match.guestTeamId);
  if (home) {
    map[home.clubId] = buildClub(
      home.clubId,
      home.profile,
      match.hostFormation,
      match.hostTactic,
      match.hostStarters,
      match.hostManagerTraitId,
    );
  }
  if (away) {
    map[away.clubId] = buildClub(
      away.clubId,
      away.profile,
      match.guestFormation,
      match.guestTactic,
      match.guestStarters,
      match.guestManagerTraitId,
    );
  }
  return map;
}
