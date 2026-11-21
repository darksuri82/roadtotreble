import { FORMATIONS } from '../data/formations';
import type { FormationId, ManagerTraitId, TeamRatings } from '../types/game';
import type {
  Club,
  ExtraTimeInfo,
  Fixture,
  HighlightOutcomeType,
  HighlightPatternId,
  LiveHalftimeState,
  LiveSubRecord,
  MatchEvent,
  MatchPlayerRating,
  MatchResult,
  PenaltyKickLog,
  ShotAngleType,
  TacticId,
} from '../types/league';
import type { Player, SubPosition } from '../types/player';
import { getPrimaryPosition } from './positionEngine';
import {
  computeLineupStaminaImpact,
  planAutoSubstitutions,
} from './staminaEngine';
import {
  buildHalftimeTacticalHint,
  evaluateFormationMatchup,
  evaluatePlaystyleTacticMatchup,
  evaluateTacticMatchup,
  TACTICS,
} from './tacticEngine';

export const USER_CLUB_ID = 'user-club';

export interface UserMatchContext {
  userClubId: string;
  starters: Player[];
  bench?: Player[];
  formation: FormationId;
  tactic: TacticId;
  chemistry: number;
  ratings: TeamRatings;
  managerTraitId: ManagerTraitId | null;
  opponentRank?: number; // 1..20 (for big_game_hunter)
  halftimeAdjusted?: boolean;
  halftimeSubsMade?: number;
  halftimeSubIds?: string[];
  firstHalfStarters?: Player[];
  liveSubs?: LiveSubRecord[];
  allowAutoSubs?: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function samplePoisson(
  lambda: number,
  rng: () => number = Math.random,
): number {
  const safeLambda = Math.max(0.01, lambda);
  const L = Math.exp(-safeLambda);
  let k = 0;
  let p = 1.0;

  do {
    k += 1;
    p *= Math.max(1e-12, rng());
  } while (p > L && k < 15);

  return k - 1;
}

function pickWeighted<T>(
  items: { item: T; weight: number }[],
  rng: () => number,
): T {
  const total = items.reduce((acc, x) => acc + Math.max(0.01, x.weight), 0);
  let threshold = rng() * total;
  for (const entry of items) {
    threshold -= Math.max(0.01, entry.weight);
    if (threshold <= 0) return entry.item;
  }
  return items[items.length - 1].item;
}

interface EffectiveTeamStrength {
  att: number;
  mid: number;
  def: number;
  tacticBonus: number;
  xgBonus: number;
  oppXgPenalty: number;
  possessionBonus: number;
}

function computeManagerTraitModifiers(params: {
  traitId: ManagerTraitId | null;
  starters: Player[];
  userTactic: TacticId;
  userAvgOvr: number;
  oppAvgOvr: number;
  opponentRank?: number;
  halftimeAdjusted?: boolean;
  halftimeSubsMade?: number;
  isSecondHalf?: boolean;
}): {
  attDelta: number;
  midDelta: number;
  defDelta: number;
  xgBonus: number;
  oppXgPenalty: number;
  possessionBonus: number;
  halftimeTacticMultiplier: number;
} {
  const {
    traitId,
    starters,
    userTactic,
    userAvgOvr,
    oppAvgOvr,
    opponentRank,
    halftimeAdjusted,
    halftimeSubsMade = 0,
    isSecondHalf = false,
  } = params;

  const out = {
    attDelta: 0,
    midDelta: 0,
    defDelta: 0,
    xgBonus: 0,
    oppXgPenalty: 0,
    possessionBonus: 0,
    halftimeTacticMultiplier: 1.0,
  };

  if (!traitId) return out;

  switch (traitId) {
    case 'tiki_taka':
      if (userTactic === 'possession') {
        out.attDelta += 1.0;
        out.midDelta += 1.5;
        out.defDelta += 1.0;
        out.possessionBonus += 3;
      }
      break;
    case 'gegenpress_guru':
      if (userTactic === 'gegenpressing') {
        out.attDelta += 1.4;
        out.midDelta += 1.3;
        out.defDelta += 1.0;
      }
      break;
    case 'catenaccio':
      if (userTactic === 'counter') {
        out.defDelta += 2.2;
        out.oppXgPenalty += 0.1;
      } else {
        out.defDelta += 0.8;
      }
      break;
    case 'wing_bomber':
      if (userTactic === 'wingplay') {
        out.attDelta += 1.8;
        out.xgBonus += 0.1;
      }
      break;
    case 'halftime_wizard':
      if (isSecondHalf && halftimeAdjusted) {
        out.halftimeTacticMultiplier = 1.5;
        out.xgBonus += 0.12;
      }
      break;
    case 'big_game_hunter':
      if ((opponentRank !== undefined && opponentRank <= 6) || oppAvgOvr >= 83) {
        out.attDelta += 1.8;
        out.midDelta += 1.8;
        out.defDelta += 1.8;
      }
      break;
    case 'set_piece_master':
      out.xgBonus += 0.18;
      break;
    case 'underdog_killer':
      if (userAvgOvr < oppAvgOvr) {
        out.attDelta += 2.2;
        out.midDelta += 2.2;
        out.defDelta += 2.2;
      }
      break;
    case 'galactico_manager': {
      const stars = starters.filter((p) => p.isLegend || p.ovr >= 91).length;
      const bonus = Math.min(2.2, stars * 0.45);
      out.attDelta += bonus;
      out.midDelta += bonus;
      out.defDelta += bonus;
      break;
    }
    case 'direct_football': {
      const directFw = starters.filter((p) =>
        p.playstyles.some((ps) =>
          ['line_breaker', 'poacher', 'complete_forward'].includes(ps),
        ),
      ).length;
      if (directFw > 0) {
        out.attDelta += Math.min(1.8, 0.8 + directFw * 0.35);
      }
      break;
    }
    case 'defensive_architect':
      out.defDelta += 1.6;
      out.oppXgPenalty += 0.14;
      break;
    case 'midfield_maestro':
      out.midDelta += 1.8;
      out.possessionBonus += 4;
      break;
    case 'super_sub':
      if (isSecondHalf && halftimeSubsMade > 0) {
        out.attDelta += 2.0;
        out.midDelta += 1.8;
        out.defDelta += 1.5;
      } else if (!isSecondHalf) {
        out.attDelta += 0.5;
      }
      break;
    case 'total_football':
      // Main effect is applied in positionEngine (penalty mitigation)
      break;
  }

  return out;
}

export interface IndividualRosterImpact {
  gkSaveMod: number; // + reduces opponent goal conversion / raises save rate
  finisherMod: number; // + boosts box/rebound/header finishing efficiency
  creatorMod: number; // + boosts through-ball & diagonal switch creation
  wingerMod: number; // + boosts flank dribble/cross/cut-inside output
  attDelta: number;
  midDelta: number;
  defDelta: number;
}

/**
 * Evaluates how individual key players' stats (OVR/ATT/MID/DEF) and playstyles directly
 * influence match events & conversion rates beyond simple team average OVR.
 */
export function computeIndividualRosterImpact(
  roster: Player[],
): IndividualRosterImpact {
  if (roster.length === 0) {
    return {
      gkSaveMod: 0,
      finisherMod: 0,
      creatorMod: 0,
      wingerMod: 0,
      attDelta: 0,
      midDelta: 0,
      defDelta: 0,
    };
  }

  const gk = roster.find((p) => p.position === 'GK');
  const gkOvr = gk ? gk.ovr * 0.55 + gk.def * 0.45 : 80;
  const gkStyleBonus = gk
    ? gk.playstyles.includes('shot_stopper')
      ? 2.2
      : gk.playstyles.includes('sweeper_keeper')
        ? 1.4
        : 0
    : 0;
  const gkSaveMod = clamp(((gkOvr + gkStyleBonus) - 82) * 0.015, -0.14, 0.22);

  const finishers = roster.filter(
    (p) =>
      p.position === 'FW' ||
      p.playstyles.some((ps) =>
        ['poacher', 'complete_forward', 'line_breaker'].includes(ps),
      ),
  );
  const topFinisherScore =
    finishers.length > 0
      ? Math.max(
          ...finishers.map(
            (p) =>
              p.att +
              (p.playstyles.some((ps) =>
                ['poacher', 'complete_forward'].includes(ps),
              )
                ? 2.5
                : 0),
          ),
        )
      : 80;
  const finisherMod = clamp((topFinisherScore - 83) * 0.014, -0.1, 0.2);

  const creators = roster.filter((p) =>
    p.playstyles.some((ps) => ['playmaker_10', 'deep_playmaker'].includes(ps)),
  );
  const topCreatorScore =
    creators.length > 0
      ? Math.max(...creators.map((p) => p.mid + 2.0))
      : Math.max(...roster.map((p) => p.mid));
  const creatorMod = clamp((topCreatorScore - 83) * 0.014, -0.1, 0.2);

  const wingers = roster.filter((p) =>
    p.playstyles.some((ps) =>
      ['classic_winger', 'inverted_winger', 'attacking_wingback'].includes(ps),
    ),
  );
  const topWingerScore =
    wingers.length > 0
      ? Math.max(...wingers.map((p) => p.att * 0.6 + p.mid * 0.4 + 2.0))
      : 80;
  const wingerMod = clamp((topWingerScore - 82) * 0.014, -0.1, 0.2);

  return {
    gkSaveMod: Math.round(gkSaveMod * 1000) / 1000,
    finisherMod: Math.round(finisherMod * 1000) / 1000,
    creatorMod: Math.round(creatorMod * 1000) / 1000,
    wingerMod: Math.round(wingerMod * 1000) / 1000,
    attDelta: Math.round((finisherMod * 2.2 + wingerMod * 1.4) * 100) / 100,
    midDelta: Math.round((creatorMod * 2.4 + wingerMod * 0.8) * 100) / 100,
    defDelta: Math.round(gkSaveMod * 2.8 * 100) / 100,
  };
}

function resolveMatchStrengths(params: {
  homeClub: Club;
  awayClub: Club;
  homeRoster?: Player[];
  awayRoster?: Player[];
  isHomeUser: boolean;
  isAwayUser: boolean;
  userContext?: UserMatchContext;
  isSecondHalf?: boolean;
  scoreDiffHome?: number; // homeGoals - awayGoals entering 2nd half
  evalMinute?: number;
  enteredAtMinute?: Record<string, number>;
}): {
  home: EffectiveTeamStrength;
  away: EffectiveTeamStrength;
  homeTactic: TacticId;
  awayTactic: TacticId;
  homeFormation: FormationId;
  awayFormation: FormationId;
  homePossession: number;
} {
  const {
    homeClub,
    awayClub,
    homeRoster = [],
    awayRoster = [],
    isHomeUser,
    isAwayUser,
    userContext,
    isSecondHalf = false,
    scoreDiffHome = 0,
    evalMinute = isSecondHalf ? 72 : 30,
    enteredAtMinute = {},
  } = params;

  const homeTactic =
    isHomeUser && userContext ? userContext.tactic : homeClub.defaultTactic;
  const awayTactic =
    isAwayUser && userContext ? userContext.tactic : awayClub.defaultTactic;
  const homeFormation =
    isHomeUser && userContext ? userContext.formation : homeClub.formation;
  const awayFormation =
    isAwayUser && userContext ? userContext.formation : awayClub.formation;

  const tacticMatchHome = evaluateTacticMatchup(homeTactic, awayTactic);
  const formMatchHome = evaluateFormationMatchup(homeFormation, awayFormation);

  const effectiveHomeRoster =
    isHomeUser && userContext && userContext.starters.length > 0
      ? userContext.starters
      : homeRoster;
  const effectiveAwayRoster =
    isAwayUser && userContext && userContext.starters.length > 0
      ? userContext.starters
      : awayRoster;

  const homeStyleMatch =
    effectiveHomeRoster.length > 0
      ? evaluatePlaystyleTacticMatchup({
          starters: effectiveHomeRoster,
          oppTactic: awayTactic,
          scoreDiff: scoreDiffHome,
          isSecondHalf,
        })
      : null;
  const awayStyleMatch =
    effectiveAwayRoster.length > 0
      ? evaluatePlaystyleTacticMatchup({
          starters: effectiveAwayRoster,
          oppTactic: homeTactic,
          scoreDiff: -scoreDiffHome,
          isSecondHalf,
        })
      : null;

  const homeIndiv =
    effectiveHomeRoster.length > 0
      ? computeIndividualRosterImpact(effectiveHomeRoster)
      : null;
  const awayIndiv =
    effectiveAwayRoster.length > 0
      ? computeIndividualRosterImpact(effectiveAwayRoster)
      : null;

  const homeBase =
    isHomeUser && userContext
      ? {
          att: userContext.ratings.effectiveAtt,
          mid: userContext.ratings.effectiveMid,
          def: userContext.ratings.effectiveDef,
        }
      : { att: homeClub.att, mid: homeClub.mid, def: homeClub.def };

  const awayBase =
    isAwayUser && userContext
      ? {
          att: userContext.ratings.effectiveAtt,
          mid: userContext.ratings.effectiveMid,
          def: userContext.ratings.effectiveDef,
        }
      : { att: awayClub.att, mid: awayClub.mid, def: awayClub.def };

  const homeAvgOvr = (homeBase.att + homeBase.mid + homeBase.def) / 3;
  const awayAvgOvr = (awayBase.att + awayBase.mid + awayBase.def) / 3;

  const userTraitMod =
    (isHomeUser || isAwayUser) && userContext
      ? computeManagerTraitModifiers({
          traitId: userContext.managerTraitId,
          starters: userContext.starters,
          userTactic: userContext.tactic,
          userAvgOvr: isHomeUser ? homeAvgOvr : awayAvgOvr,
          oppAvgOvr: isHomeUser ? awayAvgOvr : homeAvgOvr,
          opponentRank: userContext.opponentRank,
          halftimeAdjusted: userContext.halftimeAdjusted,
          halftimeSubsMade: userContext.halftimeSubsMade,
          isSecondHalf,
        })
      : null;

  // Stamina impact relative to AI baseline fatigue (keeps 20-season calibration centered while rewarding STA + subs)
  const userStaminaMod =
    (isHomeUser || isAwayUser) && userContext && userContext.starters.length > 0
      ? (() => {
          const impact = computeLineupStaminaImpact({
            starters: userContext.starters,
            formation: userContext.formation,
            tactic: userContext.tactic,
            minute: evalMinute,
            enteredAtMinute,
          });
          const aiBaseline = evalMinute >= 60 ? -1.05 : -0.15;
          return {
            attDelta: clamp((impact.attDelta - aiBaseline) * 0.65, -4.2, 2.2),
            midDelta: clamp((impact.midDelta - aiBaseline) * 0.65, -4.2, 2.2),
            defDelta: clamp((impact.defDelta - aiBaseline) * 0.65, -4.2, 2.2),
            freshSubXgBonus: isSecondHalf ? impact.freshSubXgBonus : 0,
            oppXgFatigueLeak:
              impact.avgStaminaPct < 48
                ? 0.22
                : impact.avgStaminaPct < 58
                  ? 0.1
                  : 0,
          };
        })()
      : null;

  // Halftime tactical adaptation boost in 2nd half (makes reading the game at HT rewarding)
  const htSwingMultiplier =
    isSecondHalf && userContext?.halftimeAdjusted
      ? 1.35 * (userTraitMod?.halftimeTacticMultiplier ?? 1.0)
      : 1.0;

  const homeTacticTotal =
    (tacticMatchHome.delta + formMatchHome.delta) *
    (isHomeUser && tacticMatchHome.delta + formMatchHome.delta > 0
      ? htSwingMultiplier
      : 1.0);
  const awayTacticTotal =
    -(tacticMatchHome.delta + formMatchHome.delta) *
    (isAwayUser && -(tacticMatchHome.delta + formMatchHome.delta) > 0
      ? htSwingMultiplier
      : 1.0);

  const home: EffectiveTeamStrength = {
    att:
      homeBase.att +
      homeTacticTotal +
      (homeStyleMatch ? homeStyleMatch.attBonus : 0) +
      (homeIndiv ? homeIndiv.attDelta * 0.35 : 0) +
      (isHomeUser && userTraitMod ? userTraitMod.attDelta : 0) +
      (isHomeUser && userStaminaMod ? userStaminaMod.attDelta : 0),
    mid:
      homeBase.mid +
      homeTacticTotal +
      (homeStyleMatch ? homeStyleMatch.midBonus : 0) +
      (homeIndiv ? homeIndiv.midDelta * 0.35 : 0) +
      (isHomeUser && userTraitMod ? userTraitMod.midDelta : 0) +
      (isHomeUser && userStaminaMod ? userStaminaMod.midDelta : 0),
    def:
      homeBase.def +
      homeTacticTotal +
      (homeStyleMatch ? homeStyleMatch.defBonus : 0) +
      (homeIndiv ? homeIndiv.defDelta * 0.35 : 0) +
      (isHomeUser && userTraitMod ? userTraitMod.defDelta : 0) +
      (isHomeUser && userStaminaMod ? userStaminaMod.defDelta : 0),
    tacticBonus: Math.round(homeTacticTotal * 10) / 10,
    xgBonus:
      (isHomeUser && userTraitMod ? userTraitMod.xgBonus : 0) +
      (isHomeUser && userStaminaMod ? userStaminaMod.freshSubXgBonus : 0) +
      (isAwayUser && userStaminaMod ? userStaminaMod.oppXgFatigueLeak : 0) +
      (homeStyleMatch ? homeStyleMatch.xgBonus : 0),
    oppXgPenalty:
      (isHomeUser && userTraitMod ? userTraitMod.oppXgPenalty : 0) +
      (homeStyleMatch ? homeStyleMatch.oppXgPenalty : 0) +
      (homeIndiv ? homeIndiv.gkSaveMod * 0.28 : 0),
    possessionBonus:
      isHomeUser && userTraitMod ? userTraitMod.possessionBonus : 0,
  };

  const away: EffectiveTeamStrength = {
    att:
      awayBase.att +
      awayTacticTotal +
      (awayStyleMatch ? awayStyleMatch.attBonus : 0) +
      (awayIndiv ? awayIndiv.attDelta * 0.35 : 0) +
      (isAwayUser && userTraitMod ? userTraitMod.attDelta : 0) +
      (isAwayUser && userStaminaMod ? userStaminaMod.attDelta : 0),
    mid:
      awayBase.mid +
      awayTacticTotal +
      (awayStyleMatch ? awayStyleMatch.midBonus : 0) +
      (awayIndiv ? awayIndiv.midDelta * 0.35 : 0) +
      (isAwayUser && userTraitMod ? userTraitMod.midDelta : 0) +
      (isAwayUser && userStaminaMod ? userStaminaMod.midDelta : 0),
    def:
      awayBase.def +
      awayTacticTotal +
      (awayStyleMatch ? awayStyleMatch.defBonus : 0) +
      (awayIndiv ? awayIndiv.defDelta * 0.35 : 0) +
      (isAwayUser && userTraitMod ? userTraitMod.defDelta : 0) +
      (isAwayUser && userStaminaMod ? userStaminaMod.defDelta : 0),
    tacticBonus: Math.round(awayTacticTotal * 10) / 10,
    xgBonus:
      (isAwayUser && userTraitMod ? userTraitMod.xgBonus : 0) +
      (isAwayUser && userStaminaMod ? userStaminaMod.freshSubXgBonus : 0) +
      (isHomeUser && userStaminaMod ? userStaminaMod.oppXgFatigueLeak : 0) +
      (awayStyleMatch ? awayStyleMatch.xgBonus : 0),
    oppXgPenalty:
      (isAwayUser && userTraitMod ? userTraitMod.oppXgPenalty : 0) +
      (awayStyleMatch ? awayStyleMatch.oppXgPenalty : 0) +
      (awayIndiv ? awayIndiv.gkSaveMod * 0.28 : 0),
    possessionBonus:
      isAwayUser && userTraitMod ? userTraitMod.possessionBonus : 0,
  };

  const rawPoss =
    50.5 +
    (home.mid - away.mid) * 0.95 +
    (TACTICS[homeTactic].possessionMod - TACTICS[awayTactic].possessionMod) +
    formMatchHome.possessionDelta +
    (home.possessionBonus - away.possessionBonus);
  const homePossession = Math.round(clamp(rawPoss, 31, 69));

  return {
    home,
    away,
    homeTactic,
    awayTactic,
    homeFormation,
    awayFormation,
    homePossession,
  };
}

/**
 * Calibrated Exponential Poisson expected goals model:
 * - Scales cleanly across large OVR gaps without unrealistic 105-point AI seasons.
 * - Ensures OVR 89-91 dominates (~85-98 pts), 84-86 fights Top 2-4 (~70-82 pts),
 *   78-80 finishes mid-table (~46-56 pts), and full tactical+chemistry synergy (+5~6 OVR)
 *   genuinely enables 83-85 OVR teams to upset mismatched 88-89 OVR giants.
 */
export function computeExpectedGoals(
  home: EffectiveTeamStrength,
  away: EffectiveTeamStrength,
): { lambdaHome: number; lambdaAway: number } {
  const kAtt = 0.040;
  const kMid = 0.015;

  const homeExp =
    kAtt * (home.att - away.def) + kMid * (home.mid - away.mid);
  const awayExp =
    kAtt * (away.att - home.def) + kMid * (away.mid - home.mid);

  const lambdaHome = clamp(
    1.38 * Math.exp(homeExp) + home.xgBonus - away.oppXgPenalty,
    0.18,
    4.1,
  );
  const lambdaAway = clamp(
    1.15 * Math.exp(awayExp) + away.xgBonus - home.oppXgPenalty,
    0.16,
    3.85,
  );

  return { lambdaHome, lambdaAway };
}

/**
 * Selects one of 10 authentic football attack/set-piece highlight patterns,
 * weighted by the attacking team's tactic, manager trait, and individual player stats/playstyles.
 */
export function pickHighlightPattern(params: {
  tactic: TacticId;
  roster: Player[];
  managerTraitId?: ManagerTraitId | null;
  allowPenalty?: boolean;
  rng: () => number;
}): HighlightPatternId {
  const {
    tactic,
    roster,
    managerTraitId = null,
    allowPenalty = true,
    rng,
  } = params;

  const weights: Record<HighlightPatternId, number> = {
    wing_cross_header: 13,
    cutback_finish: 13,
    through_ball_1v1: 14,
    cut_inside_curler: 13,
    corner_kick: 11,
    direct_free_kick: 8,
    high_press_counter: 12,
    u_buildup_switch: 13,
    rebound_finish: 12,
    penalty_kick: allowPenalty ? 11 : 0,
  };

  // Tactic weighting
  switch (tactic) {
    case 'wingplay':
      weights.wing_cross_header *= 2.15;
      weights.cutback_finish *= 1.85;
      weights.u_buildup_switch *= 1.65;
      break;
    case 'counter':
      weights.through_ball_1v1 *= 2.1;
      weights.high_press_counter *= 1.9;
      weights.rebound_finish *= 1.25;
      break;
    case 'gegenpressing':
      weights.high_press_counter *= 2.35;
      weights.cutback_finish *= 1.3;
      weights.rebound_finish *= 1.35;
      break;
    case 'possession':
      weights.u_buildup_switch *= 1.95;
      weights.cutback_finish *= 1.5;
      weights.through_ball_1v1 *= 1.45;
      weights.cut_inside_curler *= 1.45;
      break;
    case 'balanced':
    default:
      weights.u_buildup_switch *= 1.2;
      break;
  }

  // Manager trait weighting
  if (managerTraitId === 'set_piece_master') {
    weights.corner_kick *= 2.15;
    weights.direct_free_kick *= 2.25;
  } else if (managerTraitId === 'wing_bomber') {
    weights.wing_cross_header *= 1.6;
    weights.cutback_finish *= 1.45;
    weights.u_buildup_switch *= 1.4;
  } else if (managerTraitId === 'gegenpress_guru') {
    weights.high_press_counter *= 1.65;
  } else if (managerTraitId === 'direct_football') {
    weights.through_ball_1v1 *= 1.55;
    weights.rebound_finish *= 1.3;
  } else if (managerTraitId === 'tiki_taka') {
    weights.u_buildup_switch *= 1.55;
  }

  // Individual player stat & playstyle direct weighting
  const indiv = computeIndividualRosterImpact(roster);
  const psSet = new Set(roster.flatMap((p) => p.playstyles));

  if (psSet.has('classic_winger') || psSet.has('attacking_wingback')) {
    const mult = 1.25 + Math.max(0, indiv.wingerMod * 1.4);
    weights.wing_cross_header *= mult;
    weights.cutback_finish *= mult * 0.95;
    weights.u_buildup_switch *= 1.22;
  }
  if (psSet.has('line_breaker')) {
    weights.through_ball_1v1 *= 1.35 + Math.max(0, indiv.finisherMod * 1.2);
  }
  if (psSet.has('inverted_winger') || psSet.has('playmaker_10')) {
    weights.cut_inside_curler *= 1.3 + Math.max(0, indiv.wingerMod * 1.1);
    if (allowPenalty) weights.penalty_kick *= 1.22; // tricky box dribblers draw more fouls
  }
  if (psSet.has('playmaker_10') || psSet.has('deep_playmaker')) {
    const creatorMult = 1.28 + Math.max(0, indiv.creatorMod * 1.5);
    weights.through_ball_1v1 *= creatorMult;
    weights.u_buildup_switch *= creatorMult;
  }
  if (psSet.has('poacher') || psSet.has('complete_forward')) {
    const finishMult = 1.3 + Math.max(0, indiv.finisherMod * 1.5);
    weights.rebound_finish *= finishMult;
    weights.wing_cross_header *= 1.22;
    weights.corner_kick *= 1.18;
  }
  if (psSet.has('ball_winner') || psSet.has('box_to_box')) {
    weights.high_press_counter *= 1.22;
  }

  const entries = (Object.entries(weights) as [HighlightPatternId, number][])
    .filter(([, weight]) => weight > 0)
    .map(([item, weight]) => ({ item, weight }));
  return pickWeighted(entries, rng);
}

function pickShotAngleForPattern(
  pattern: HighlightPatternId,
  rng: () => number,
): ShotAngleType {
  switch (pattern) {
    case 'cut_inside_curler':
      return rng() < 0.72 ? 'far_post' : rng() < 0.5 ? 'acute_left' : 'acute_right';
    case 'u_buildup_switch':
    case 'cutback_finish': {
      const r = rng();
      if (r < 0.34) return 'acute_left';
      if (r < 0.68) return 'acute_right';
      return 'far_post';
    }
    case 'wing_cross_header':
    case 'corner_kick': {
      const r = rng();
      if (r < 0.38) return 'far_post';
      if (r < 0.72) return 'near_post';
      return 'center';
    }
    case 'direct_free_kick':
      return rng() < 0.55 ? 'far_post' : 'near_post';
    case 'penalty_kick': {
      const r = rng();
      if (r < 0.4) return 'acute_left';
      if (r < 0.8) return 'acute_right';
      return 'center';
    }
    case 'rebound_finish': {
      const r = rng();
      if (r < 0.32) return 'near_post';
      if (r < 0.64) return 'far_post';
      return 'center';
    }
    default: {
      const angles: ShotAngleType[] = [
        'acute_left',
        'acute_right',
        'far_post',
        'near_post',
        'center',
      ];
      return angles[Math.floor(rng() * angles.length)];
    }
  }
}

function pickPkDirection(rng: () => number): 'left' | 'center' | 'right' {
  const r = rng();
  if (r < 0.42) return 'left';
  if (r < 0.84) return 'right';
  return 'center';
}

function formatHighlightDescription(params: {
  pattern: HighlightPatternId;
  outcome: HighlightOutcomeType;
  scorerName: string;
  assistName?: string;
  gkName?: string;
  secondaryShooterName?: string;
  reboundOrigin?: 'save' | 'woodwork' | 'blocked';
  pkDirection?: 'left' | 'center' | 'right';
  shotAngle?: ShotAngleType;
  isJoker?: boolean;
}): string {
  const {
    pattern,
    outcome,
    scorerName,
    assistName,
    gkName,
    secondaryShooterName,
    reboundOrigin = 'save',
    pkDirection = 'right',
    shotAngle,
    isJoker = false,
  } = params;
  const jokerPrefix = isJoker ? '🔥 교체 투입 조커! ' : '';
  const assistTag = assistName ? ` (도움: ${assistName})` : '';
  const gkLabel = gkName ? `${gkName} 골키퍼` : '상대 골키퍼';
  const pkDirKr =
    pkDirection === 'left'
      ? '좌측 하단'
      : pkDirection === 'right'
        ? '우측 구석'
        : '정면 파넨카';
  const reboundSourceKr =
    reboundOrigin === 'woodwork'
      ? '골대를 맞고 튕겨 나온 볼을'
      : reboundOrigin === 'blocked'
        ? '수비수 몸에 맞고 흐른 세컨드볼을'
        : '골키퍼 선방 후 튕겨 나온 리바운드 볼을';
  const angleNote =
    shotAngle === 'acute_left' || shotAngle === 'acute_right'
      ? '예리한 측면 예각 슈팅으로'
      : shotAngle === 'far_post'
        ? '반대편 파포스트로 감아 차며'
        : shotAngle === 'near_post'
          ? '니어포스트 빈틈을 찌르며'
          : '강력한 슈팅으로';

  if (outcome === 'var_offside') {
    return `📺 VAR 판독! ${scorerName}이(가) 골망을 흔들었으나 부심의 기가 올라갔습니다 — 오프사이드로 득점 취소!`;
  }

  if (outcome === 'goal') {
    switch (pattern) {
      case 'wing_cross_header':
        return `${jokerPrefix}골! 측면 크로스를 ${scorerName}이(가) 타점 높은 헤더로 꽂아 넣습니다!${assistTag}`;
      case 'cutback_finish':
        return `${jokerPrefix}골! 엔드라인 컷백을 쇄도하던 ${scorerName}이(가) ${angleNote} 마무리!${assistTag}`;
      case 'through_ball_1v1':
        return `${jokerPrefix}골! 수비 뒷공간을 허문 스루패스, ${scorerName}이(가) 1대1 찬스를 침착하게 성공시킵니다!${assistTag}`;
      case 'cut_inside_curler':
        return `${jokerPrefix}골! 안쪽으로 파고든 ${scorerName}의 환상적인 파포스트 감아차기 골!${assistTag}`;
      case 'corner_kick':
        return `${jokerPrefix}골! 코너킥 문전 혼전 상황에서 ${scorerName}이(가) 강력한 헤더로 골망을 흔듭니다!${assistTag}`;
      case 'direct_free_kick':
        return `${jokerPrefix}골! ${scorerName}의 그림 같은 직접 프리킥! 수비벽을 넘어 상단 구석에 꽂힙니다!`;
      case 'high_press_counter':
        return `${jokerPrefix}골! 전방 압박으로 볼을 탈취한 직후 고속 역습, ${scorerName}이(가) ${angleNote} 마무리합니다!${assistTag}`;
      case 'u_buildup_switch':
        return `${jokerPrefix}골! 후방 U자 빌드업 후 반대편 측면으로 찔러준 대각선 반대전환! ${scorerName}이(가) ${angleNote} 골망을 가릅니다!${assistTag}`;
      case 'rebound_finish':
        return `${jokerPrefix}골! ${secondaryShooterName ? `${secondaryShooterName}의 슈팅이 ` : ''}${reboundSourceKr} ${scorerName}이(가) 번개처럼 쇄도해 밀어 넣습니다!`;
      case 'penalty_kick':
        return `${jokerPrefix}🎯 PK 골! 박스 안 반칙으로 얻어낸 페널티킥을 ${scorerName}이(가) ${pkDirKr} 코스로 침착하게 꽂아 넣습니다!`;
    }
  }

  if (outcome === 'save') {
    switch (pattern) {
      case 'wing_cross_header':
        return `측면 크로스에 이은 ${scorerName}의 결정적 헤더를 ${gkLabel}가 몸을 날려 쳐냅니다!`;
      case 'cutback_finish':
        return `날카로운 컷백 후 ${scorerName}의 논스톱 슈팅! ${gkLabel}의 동물적인 반사신경 슈퍼 세이브!`;
      case 'through_ball_1v1':
        return `1대1 결정적 기회! ${scorerName}의 슈팅을 ${gkLabel}가 각도를 좁히며 막아냅니다!`;
      case 'cut_inside_curler':
        return `${scorerName}의 위협적인 감아차기 중거리 슛을 ${gkLabel}가 손끝으로 쳐냅니다!`;
      case 'corner_kick':
        return `코너킥에서 이어진 ${scorerName}의 근거리 헤더를 ${gkLabel}가 극적으로 펀칭해냅니다!`;
      case 'direct_free_kick':
        return `${scorerName}의 수비벽을 넘긴 프리킥! ${gkLabel}가 몸을 던져 막아냅니다!`;
      case 'high_press_counter':
        return `전방 압박 탈취 후 고속 역습 슈팅! ${gkLabel}의 결정적 선방으로 실점을 막습니다!`;
      case 'u_buildup_switch':
        return `반대전환 롱패스 후 ${scorerName}의 측면 예각 슈팅! ${gkLabel}가 니어포스트를 틀어막습니다!`;
      case 'rebound_finish':
        return `${reboundSourceKr} 노린 ${scorerName}의 2차 슈팅까지 ${gkLabel}가 연속 슈퍼세이브로 막아냅니다!`;
      case 'penalty_kick':
        return `🧤 PK 선방!! ${scorerName}의 ${pkDirKr} 페널티킥을 ${gkLabel}가 방향을 완벽히 읽고 몸을 날려 막아냅니다!`;
    }
  }

  if (outcome === 'woodwork') {
    switch (pattern) {
      case 'direct_free_kick':
        return `💥 ${scorerName}의 직접 프리킥이 크로스바를 강타하고 튕겨 나옵니다!`;
      case 'cut_inside_curler':
        return `💥 ${scorerName}의 감아차기 슈팅이 파포스트를 때리고 나갑니다!`;
      case 'corner_kick':
        return `💥 코너킥에서 ${scorerName}의 헤더가 골대를 맞고 튕겨 나옵니다!`;
      case 'u_buildup_switch':
        return `💥 반대전환 롱패스를 이어받은 ${scorerName}의 예각 슈팅이 골포스트를 강타합니다!`;
      case 'penalty_kick':
        return `💥 PK 실축! ${scorerName}의 페널티킥이 골대를 강타하고 튕겨 나옵니다!`;
      default:
        return `💥 ${scorerName}의 결정적 슈팅이 골대를 강타합니다! 아쉽게 득점 무산!`;
    }
  }

  if (outcome === 'blocked') {
    switch (pattern) {
      case 'cutback_finish':
        return `🛡️ 엔드라인 컷백 후 ${scorerName}의 슈팅을 상대 수비수가 온몸을 던져 육탄 방어합니다!`;
      case 'corner_kick':
        return `🛡️ 코너킥 세컨드볼 슈팅이 밀집한 수비벽에 맞고 굴절됩니다!`;
      case 'high_press_counter':
        return `🛡️ 고속 역습 상황에서 ${scorerName}의 슈팅을 복귀한 수비수가 슬라이딩 태클로 막아냅니다!`;
      case 'u_buildup_switch':
        return `🛡️ 대각선 반대전환 후 ${scorerName}의 슈팅을 상대 풀백이 결정적 블록으로 막아냅니다!`;
      default:
        return `🛡️ ${scorerName}의 강력한 슈팅을 수비수가 결정적인 태클로 차단합니다!`;
    }
  }

  // near_miss
  switch (pattern) {
    case 'wing_cross_header':
      return `측면 크로스에 맞춘 ${scorerName}의 헤더가 골문 위로 살짝 넘어갑니다!`;
    case 'through_ball_1v1':
      return `완벽한 스루패스 1대1 찬스! ${scorerName}의 슈팅이 골포스트 옆을 아슬아슬하게 스칩니다!`;
    case 'direct_free_kick':
      return `${scorerName}의 예리한 프리킥이 골문 구석을 간발의 차로 벗어납니다!`;
    case 'cut_inside_curler':
      return `컷인 후 날린 ${scorerName}의 감아차기가 골대를 살짝 빗나갑니다!`;
    case 'u_buildup_switch':
      return `화려한 반대전환에 이은 ${scorerName}의 파포스트 슈팅이 아쉽게 빗나갑니다!`;
    case 'rebound_finish':
      return `${reboundSourceKr} 노린 ${scorerName}의 2차 슈팅이 크로스바 위로 살짝 뜹니다!`;
    case 'penalty_kick':
      return `😱 PK 실축! ${scorerName}의 페널티킥이 골문 옆으로 빗나갑니다!`;
    default:
      return `${scorerName}의 회심의 슈팅이 골문을 간발의 차로 벗어납니다!`;
  }
}

function pickScorerWithFreshBoost(
  roster: Player[],
  freshSubIds: Set<string>,
  rng: () => number,
  pattern?: HighlightPatternId,
): Player {
  const outfield = roster.filter((p) => p.position !== 'GK');
  const pool = outfield.length > 0 ? outfield : roster;

  const weighted = pool.map((p) => {
    let posWeight = p.position === 'FW' ? 58 : p.position === 'MF' ? 30 : 12;
    let styleBoost = p.playstyles.some((s) =>
      ['poacher', 'line_breaker', 'complete_forward', 'inverted_winger'].includes(s),
    )
      ? 1.25
      : 1.0;

    // Pattern-specific individual player affinity
    if (pattern === 'penalty_kick') {
      posWeight = p.position === 'FW' ? 75 : p.position === 'MF' ? 28 : 5;
      styleBoost =
        Math.pow(Math.max(50, p.ovr) / 80, 3.0) *
        (p.playstyles.some((s) =>
          ['complete_forward', 'poacher', 'playmaker_10'].includes(s),
        )
          ? 1.65
          : 1.0);
    } else if (pattern === 'wing_cross_header' || pattern === 'corner_kick') {
      if (p.position === 'DF' && p.playstyles.includes('stopper_cb')) {
        posWeight = pattern === 'corner_kick' ? 34 : 14;
      }
      if (p.playstyles.some((s) => ['poacher', 'complete_forward'].includes(s))) {
        styleBoost *= 1.65;
      }
    } else if (pattern === 'rebound_finish') {
      if (p.playstyles.some((s) => ['poacher', 'complete_forward', 'box_to_box'].includes(s))) {
        styleBoost *= 1.75;
      }
    } else if (pattern === 'cut_inside_curler' || pattern === 'u_buildup_switch') {
      if (p.playstyles.some((s) => ['inverted_winger', 'classic_winger', 'attacking_wingback'].includes(s))) {
        styleBoost *= 1.7;
      }
    } else if (pattern === 'through_ball_1v1' || pattern === 'high_press_counter') {
      if (p.playstyles.includes('line_breaker')) {
        styleBoost *= 1.75;
      }
    }

    const jokerBoost = freshSubIds.has(p.id) ? 1.55 : 1.0;
    const attBoost = Math.pow(Math.max(40, p.att) / 80, 2.3);
    return { item: p, weight: posWeight * attBoost * styleBoost * jokerBoost };
  });

  return pickWeighted(weighted, rng);
}

function pickPatternAssister(
  roster: Player[],
  scorerId: string,
  pattern: HighlightPatternId,
  rng: () => number,
): Player | null {
  if (
    pattern === 'direct_free_kick' ||
    pattern === 'penalty_kick' ||
    pattern === 'rebound_finish'
  ) {
    return null;
  }
  const noAssistChance = pattern === 'u_buildup_switch' ? 0.08 : 0.22;
  if (rng() < noAssistChance) return null;

  const candidates = roster.filter(
    (p) => p.id !== scorerId && p.position !== 'GK',
  );
  if (candidates.length === 0) return null;

  const weighted = candidates.map((p) => {
    const posWeight = p.position === 'MF' ? 52 : p.position === 'FW' ? 28 : 20;
    let styleBoost = 1.0;
    if (pattern === 'u_buildup_switch' || pattern === 'through_ball_1v1') {
      if (p.playstyles.some((s) => ['deep_playmaker', 'playmaker_10', 'ball_playing_cb'].includes(s))) {
        styleBoost = 1.95;
      }
    } else if (pattern === 'wing_cross_header' || pattern === 'cutback_finish') {
      if (p.playstyles.some((s) => ['classic_winger', 'attacking_wingback', 'inverted_winger'].includes(s))) {
        styleBoost = 1.85;
      }
    } else if (
      p.playstyles.some((s) =>
        ['playmaker_10', 'deep_playmaker', 'attacking_wingback', 'classic_winger'].includes(s),
      )
    ) {
      styleBoost = 1.35;
    }
    const midBoost = Math.pow(Math.max(40, p.mid) / 80, 2.1);
    return { item: p, weight: posWeight * midBoost * styleBoost };
  });

  return pickWeighted(weighted, rng);
}

function generateHalfGoalEvents(params: {
  goals: number;
  half: 1 | 2;
  club: Club;
  roster: Player[];
  tactic: TacticId;
  managerTraitId?: ManagerTraitId | null;
  isUser: boolean;
  minStart?: number;
  maxMinute?: number;
  freshSubEntryMinute?: Map<string, number>;
  rosterAtMinute?: (minute: number) => Player[];
  rng: () => number;
}): MatchEvent[] {
  const {
    goals,
    half,
    club,
    roster,
    tactic,
    managerTraitId = null,
    isUser,
    minStart = half === 1 ? 2 : 47,
    maxMinute = half === 1 ? 44 : 89,
    freshSubEntryMinute,
    rosterAtMinute,
    rng,
  } = params;
  const span = Math.max(1, maxMinute - minStart + 1);
  const events: MatchEvent[] = [];

  for (let i = 0; i < goals; i += 1) {
    const minute = minStart + Math.floor(rng() * span);
    const activeRoster = rosterAtMinute ? rosterAtMinute(minute) : roster;
    const activeFreshIds = new Set<string>();
    if (freshSubEntryMinute) {
      for (const [pid, enterMin] of freshSubEntryMinute.entries()) {
        if (minute >= enterMin) activeFreshIds.add(pid);
      }
    }

    const pattern = pickHighlightPattern({
      tactic,
      roster: activeRoster,
      managerTraitId: isUser ? managerTraitId : null,
      allowPenalty: true,
      rng,
    });
    const scorer = pickScorerWithFreshBoost(
      activeRoster,
      activeFreshIds,
      rng,
      pattern,
    );
    const assister = pickPatternAssister(activeRoster, scorer.id, pattern, rng);
    const isJoker = activeFreshIds.has(scorer.id);
    const shotAngle = pickShotAngleForPattern(pattern, rng);
    const pkDirection = pattern === 'penalty_kick' ? pickPkDirection(rng) : undefined;
    const reboundOrigins: ('save' | 'woodwork' | 'blocked')[] = [
      'save',
      'woodwork',
      'blocked',
    ];
    const reboundOrigin =
      pattern === 'rebound_finish'
        ? reboundOrigins[Math.floor(rng() * reboundOrigins.length)]
        : undefined;
    const firstShooter =
      pattern === 'rebound_finish'
        ? activeRoster.find((p) => p.id !== scorer.id && p.position !== 'GK') ??
          scorer
        : undefined;

    const desc = formatHighlightDescription({
      pattern,
      outcome: 'goal',
      scorerName: scorer.name,
      assistName: assister?.name,
      secondaryShooterName: firstShooter?.name,
      reboundOrigin,
      pkDirection,
      shotAngle,
      isJoker,
    });

    events.push({
      minute,
      half,
      type: 'goal',
      teamId: club.id,
      teamShortName: club.shortName,
      teamColor: club.primaryColor,
      isUserTeam: isUser,
      scorerId: scorer.id,
      scorerName: scorer.name,
      assistId: assister?.id,
      assistName: assister?.name,
      xgDelta:
        pattern === 'penalty_kick'
          ? 0.78
          : Math.round((0.26 + rng() * 0.27) * 100) / 100,
      highlightPattern: pattern,
      highlightOutcome: 'goal',
      shotAngle,
      isPenalty: pattern === 'penalty_kick' ? true : undefined,
      pkDirection,
      reboundOrigin,
      secondaryShooterName: firstShooter?.name,
      description: desc,
    });
  }

  return events;
}

function generateHalfFlavorEvents(params: {
  half: 1 | 2;
  homeClub: Club;
  awayClub: Club;
  homeRoster: Player[];
  awayRoster: Player[];
  homeTactic: TacticId;
  awayTactic: TacticId;
  isHomeUser: boolean;
  isAwayUser: boolean;
  managerTraitId?: ManagerTraitId | null;
  minStart?: number;
  maxMinute?: number;
  rng: () => number;
}): MatchEvent[] {
  const {
    half,
    homeClub,
    awayClub,
    homeRoster,
    awayRoster,
    homeTactic,
    awayTactic,
    isHomeUser,
    isAwayUser,
    managerTraitId = null,
    minStart = half === 1 ? 5 : 49,
    maxMinute = half === 1 ? 43 : 88,
    rng,
  } = params;
  const span = Math.max(4, maxMinute - minStart);
  const events: MatchEvent[] = [];

  const nonGoalOutcomes: HighlightOutcomeType[] = [
    'woodwork',
    'blocked',
    'near_miss',
  ];

  // 1) Two varied attacking chances (woodwork / blocked / near_miss)
  const chanceCount = span >= 22 ? 2 : 1;
  for (let cIdx = 0; cIdx < chanceCount; cIdx += 1) {
    const chanceIsHome = cIdx === 0 ? rng() < 0.54 : rng() < 0.46;
    const cClub = chanceIsHome ? homeClub : awayClub;
    const cRoster = chanceIsHome ? homeRoster : awayRoster;
    const cTactic = chanceIsHome ? homeTactic : awayTactic;
    const cIsUser = chanceIsHome ? isHomeUser : isAwayUser;

    const pattern = pickHighlightPattern({
      tactic: cTactic,
      roster: cRoster,
      managerTraitId: cIsUser ? managerTraitId : null,
      allowPenalty: cIdx === 0 && rng() < 0.25,
      rng,
    });
    const outcome: HighlightOutcomeType =
      pattern === 'penalty_kick'
        ? rng() < 0.5
          ? 'woodwork'
          : 'near_miss'
        : nonGoalOutcomes[Math.floor(rng() * nonGoalOutcomes.length)];
    const shooter = pickScorerWithFreshBoost(cRoster, new Set(), rng, pattern);
    const shotAngle = pickShotAngleForPattern(pattern, rng);
    const pkDirection = pattern === 'penalty_kick' ? pickPkDirection(rng) : undefined;
    const minute =
      minStart +
      Math.floor(((cIdx + rng() * 0.85) / (chanceCount + 0.3)) * span);

    events.push({
      minute: clamp(minute, minStart, maxMinute),
      half,
      type: 'chance',
      teamId: cClub.id,
      teamShortName: cClub.shortName,
      teamColor: cClub.primaryColor,
      isUserTeam: cIsUser,
      scorerId: shooter.id,
      scorerName: shooter.name,
      xgDelta:
        pattern === 'penalty_kick'
          ? 0.76
          : Math.round((0.11 + rng() * 0.17) * 100) / 100,
      highlightPattern: pattern,
      highlightOutcome: outcome,
      shotAngle,
      isPenalty: pattern === 'penalty_kick' ? true : undefined,
      pkDirection,
      description: formatHighlightDescription({
        pattern,
        outcome,
        scorerName: shooter.name,
        pkDirection,
        shotAngle,
      }),
    });
  }

  // 2) Goalkeeper super save (weighted by actual GK OVR & shot_stopper/sweeper_keeper stats!)
  if (span >= 8) {
    const homeGkImpact = computeIndividualRosterImpact(homeRoster).gkSaveMod;
    const awayGkImpact = computeIndividualRosterImpact(awayRoster).gkSaveMod;
    const homeDefProb = clamp(0.5 + (homeGkImpact - awayGkImpact) * 0.9, 0.3, 0.7);
    const defIsHome = rng() < homeDefProb;
    const defClub = defIsHome ? homeClub : awayClub;
    const defRoster = defIsHome ? homeRoster : awayRoster;
    const atkRoster = defIsHome ? awayRoster : homeRoster;
    const atkTactic = defIsHome ? awayTactic : homeTactic;
    const atkIsUser = defIsHome ? isAwayUser : isHomeUser;

    const pattern = pickHighlightPattern({
      tactic: atkTactic,
      roster: atkRoster,
      managerTraitId: atkIsUser ? managerTraitId : null,
      allowPenalty: rng() < 0.3,
      rng,
    });
    const shooter = pickScorerWithFreshBoost(atkRoster, new Set(), rng, pattern);
    const gk = defRoster.find((p) => p.position === 'GK');
    const shotAngle = pickShotAngleForPattern(pattern, rng);
    const pkDirection = pattern === 'penalty_kick' ? pickPkDirection(rng) : undefined;

    events.push({
      minute: clamp(
        minStart + Math.floor(span * (0.45 + rng() * 0.45)),
        minStart,
        maxMinute,
      ),
      half,
      type: 'save',
      teamId: defClub.id,
      teamShortName: defClub.shortName,
      teamColor: defClub.primaryColor,
      isUserTeam: defIsHome ? isHomeUser : isAwayUser,
      scorerId: gk?.id,
      scorerName: shooter.name,
      highlightPattern: pattern,
      highlightOutcome: 'save',
      shotAngle,
      isPenalty: pattern === 'penalty_kick' ? true : undefined,
      pkDirection,
      description: formatHighlightDescription({
        pattern,
        outcome: 'save',
        scorerName: shooter.name,
        gkName: gk?.name,
        pkDirection,
        shotAngle,
      }),
    });
  }

  // 2.5) Occasional VAR offside disallowed goal (~13% per half -> realistic low probability!)
  if (span >= 14 && rng() < 0.13) {
    const varIsHome = rng() < 0.5;
    const vClub = varIsHome ? homeClub : awayClub;
    const vRoster = varIsHome ? homeRoster : awayRoster;
    const vIsUser = varIsHome ? isHomeUser : isAwayUser;
    const varPatterns: HighlightPatternId[] = [
      'through_ball_1v1',
      'u_buildup_switch',
      'wing_cross_header',
      'rebound_finish',
    ];
    const vPattern = varPatterns[Math.floor(rng() * varPatterns.length)];
    const scorer = pickScorerWithFreshBoost(vRoster, new Set(), rng, vPattern);
    const minute = clamp(
      minStart + Math.floor(span * (0.25 + rng() * 0.65)),
      minStart,
      maxMinute,
    );

    events.push({
      minute,
      half,
      type: 'var_offside',
      teamId: vClub.id,
      teamShortName: vClub.shortName,
      teamColor: vClub.primaryColor,
      isUserTeam: vIsUser,
      scorerId: scorer.id,
      scorerName: scorer.name,
      highlightPattern: vPattern,
      highlightOutcome: 'var_offside',
      shotAngle: pickShotAngleForPattern(vPattern, rng),
      description: formatHighlightDescription({
        pattern: vPattern,
        outcome: 'var_offside',
        scorerName: scorer.name,
      }),
    });
  }

  // 3) Occasional yellow card
  if (rng() < 0.5 && span >= 10) {
    const cardIsHome = rng() < 0.5;
    const yClub = cardIsHome ? homeClub : awayClub;
    const yRoster = cardIsHome ? homeRoster : awayRoster;
    const defenders = yRoster.filter(
      (p) => p.position === 'DF' || p.position === 'MF',
    );
    const booked =
      defenders.length > 0
        ? defenders[Math.floor(rng() * defenders.length)]
        : yRoster[0];
    if (booked) {
      events.push({
        minute: clamp(
          minStart + Math.floor(rng() * span),
          minStart,
          maxMinute,
        ),
        half,
        type: 'yellow',
        teamId: yClub.id,
        teamShortName: yClub.shortName,
        teamColor: yClub.primaryColor,
        isUserTeam: cardIsHome ? isHomeUser : isAwayUser,
        scorerId: booked.id,
        scorerName: booked.name,
        description: `${booked.name}, 거친 태클로 옐로카드를 받습니다.`,
      });
    }
  }

  return events;
}

function buildPlayerRatings(params: {
  homeClub: Club;
  awayClub: Club;
  homeRoster: Player[];
  awayRoster: Player[];
  homeFormation: FormationId;
  awayFormation: FormationId;
  homeGoals: number;
  awayGoals: number;
  homeXg: number;
  awayXg: number;
  events: MatchEvent[];
  userClubId?: string;
  halftimeSubIds?: string[];
  firstHalfUserStarters?: Player[];
  userLiveSubs?: LiveSubRecord[];
  userBench?: Player[];
  rng: () => number;
}): {
  playerRatings: MatchPlayerRating[];
  momPlayerId: string;
  momPlayerName: string;
  momRating: number;
} {
  const {
    homeClub,
    awayClub,
    homeRoster,
    awayRoster,
    homeFormation,
    awayFormation,
    homeGoals,
    awayGoals,
    homeXg,
    awayXg,
    events,
    userClubId,
    halftimeSubIds = [],
    firstHalfUserStarters = [],
    userLiveSubs = [],
    userBench = [],
    rng,
  } = params;

  const subIdSet = new Set(halftimeSubIds);
  const subInMinute = new Map<string, number>();
  const subOutMinute = new Map<string, number>();

  for (const id of halftimeSubIds) {
    subInMinute.set(id, 45);
  }
  for (const rec of userLiveSubs) {
    subIdSet.add(rec.inPlayerId);
    subInMinute.set(rec.inPlayerId, rec.minute);
    subOutMinute.set(rec.outPlayerId, rec.minute);
  }

  const goalCounts = new Map<string, number>();
  const assistCounts = new Map<string, number>();

  for (const ev of events) {
    if (ev.type !== 'goal') continue;
    if (ev.scorerId) {
      const k = `${ev.teamId}:${ev.scorerId}`;
      goalCounts.set(k, (goalCounts.get(k) ?? 0) + 1);
    }
    if (ev.assistId) {
      const k = `${ev.teamId}:${ev.assistId}`;
      assistCounts.set(k, (assistCounts.get(k) ?? 0) + 1);
    }
  }

  const scoreTeam = (
    roster: Player[],
    teamId: string,
    formationId: FormationId,
    gf: number,
    ga: number,
    teamXg: number,
  ): MatchPlayerRating[] => {
    const teamResultMod = gf > ga ? 0.45 : gf < ga ? -0.4 : 0.05;
    const cleanSheet = ga === 0;
    const formationSlots = FORMATIONS[formationId]?.slots ?? [];

    const allParticipants: {
      player: Player;
      subPosition: SubPosition;
      isSub: boolean;
      minutesPlayed: number;
    }[] = roster.map((p, idx) => {
      const isUser = teamId === userClubId;
      const isSub = isUser && subIdSet.has(p.id);
      const enterMin = isSub ? (subInMinute.get(p.id) ?? 45) : 0;
      const leaveMin = isUser && subOutMinute.has(p.id) ? subOutMinute.get(p.id)! : 90;
      return {
        player: p,
        subPosition: formationSlots[idx]?.subPosition ?? getPrimaryPosition(p),
        isSub,
        minutesPlayed: Math.max(1, leaveMin - enterMin),
      };
    });

    if (teamId === userClubId) {
      const presentIds = new Set(allParticipants.map((a) => a.player.id));
      const allKnownPool = new Map<string, Player>();
      for (const p of [...firstHalfUserStarters, ...roster, ...userBench]) {
        allKnownPool.set(p.id, p);
      }

      // Include 1st-half starters who were subbed off
      firstHalfUserStarters.forEach((p, idx) => {
        if (!presentIds.has(p.id)) {
          presentIds.add(p.id);
          const leaveMin = subOutMinute.get(p.id) ?? 45;
          allParticipants.push({
            player: p,
            subPosition:
              formationSlots[idx]?.subPosition ?? getPrimaryPosition(p),
            isSub: false,
            minutesPlayed: Math.max(1, leaveMin),
          });
        }
      });

      // Include any subbed-in or subbed-off player from liveSubs not yet listed
      for (const rec of userLiveSubs) {
        if (!presentIds.has(rec.outPlayerId)) {
          const outP = allKnownPool.get(rec.outPlayerId);
          if (outP) {
            presentIds.add(outP.id);
            allParticipants.push({
              player: outP,
              subPosition:
                formationSlots[rec.slotIndex]?.subPosition ??
                getPrimaryPosition(outP),
              isSub: subIdSet.has(outP.id),
              minutesPlayed: Math.max(
                1,
                rec.minute - (subInMinute.get(outP.id) ?? 0),
              ),
            });
          }
        }
        if (!presentIds.has(rec.inPlayerId)) {
          const inP = allKnownPool.get(rec.inPlayerId);
          if (inP) {
            presentIds.add(inP.id);
            const leaveMin = subOutMinute.get(inP.id) ?? 90;
            allParticipants.push({
              player: inP,
              subPosition:
                formationSlots[rec.slotIndex]?.subPosition ??
                getPrimaryPosition(inP),
              isSub: true,
              minutesPlayed: Math.max(1, leaveMin - rec.minute),
            });
          }
        }
      }
    }

    // Distribute team xG across outfield participants scaled by minutes played
    const xgWeights = allParticipants.map(({ player, minutesPlayed }) => {
      if (player.position === 'GK') return 0;
      const goals = goalCounts.get(`${teamId}:${player.id}`) ?? 0;
      const basePos =
        player.position === 'FW' ? 3.2 : player.position === 'MF' ? 1.5 : 0.45;
      const attFactor = Math.max(0.5, (player.att - 55) / 25);
      const minScale = Math.max(0.25, minutesPlayed / 90);
      return basePos * attFactor * minScale + goals * 2.4;
    });
    const totalWeight = xgWeights.reduce((a, b) => a + b, 0) || 1;

    return allParticipants.map(
      ({ player: p, subPosition, isSub, minutesPlayed }, idx) => {
        const goals = goalCounts.get(`${teamId}:${p.id}`) ?? 0;
        const assists = assistCounts.get(`${teamId}:${p.id}`) ?? 0;
        const playerXg =
          p.position === 'GK'
            ? 0
            : Math.round(teamXg * (xgWeights[idx] / totalWeight) * 100) / 100;

        const base = 6.3 + (p.ovr - 78) * 0.025 + teamResultMod;
        const contrib = goals * 1.15 + assists * 0.72;
        const defBonus =
          cleanSheet &&
          minutesPlayed >= 30 &&
          (p.position === 'GK' || p.position === 'DF')
            ? 0.55
            : ga >= 3 && (p.position === 'GK' || p.position === 'DF')
              ? -0.45
              : 0;
        const jokerEnergyBonus = isSub && goals + assists > 0 ? 0.25 : 0;
        const noise = (rng() - 0.5) * 0.7;
        const rating =
          Math.round(
            clamp(
              base + contrib + defBonus + jokerEnergyBonus + noise,
              4.2,
              10.0,
            ) * 10,
          ) / 10;

        return {
          playerId: p.id,
          playerName: p.name,
          teamId,
          position: p.position,
          subPosition,
          rating,
          goals,
          assists,
          xg: playerXg,
          minutesPlayed,
          isSub,
          isLegend: p.isLegend,
        };
      },
    );
  };

  const allRatings = [
    ...scoreTeam(
      homeRoster,
      homeClub.id,
      homeFormation,
      homeGoals,
      awayGoals,
      homeXg,
    ),
    ...scoreTeam(
      awayRoster,
      awayClub.id,
      awayFormation,
      awayGoals,
      homeGoals,
      awayXg,
    ),
  ];

  let mom = allRatings[0];
  for (const r of allRatings) {
    if (
      r.rating > mom.rating ||
      (r.rating === mom.rating && r.goals + r.assists > mom.goals + mom.assists)
    ) {
      mom = r;
    }
  }

  return {
    playerRatings: allRatings,
    momPlayerId: mom?.playerId ?? '',
    momPlayerName: mom?.playerName ?? '',
    momRating: mom?.rating ?? 7.0,
  };
}

/**
 * Interactive 1st-Half Simulation (45 minutes) for User Matches -> returns LiveHalftimeState
 * ready for progressive real-time broadcast (0' -> 45') before pausing at Halftime.
 */
export function simulateFirstHalf(params: {
  fixture: Fixture;
  homeClub: Club;
  awayClub: Club;
  homeRoster: Player[];
  awayRoster: Player[];
  userContext: UserMatchContext;
  rng?: () => number;
}): LiveHalftimeState {
  const {
    fixture,
    homeClub,
    awayClub,
    homeRoster,
    awayRoster,
    userContext,
    rng = Math.random,
  } = params;

  const isHomeUser = fixture.homeTeamId === userContext.userClubId;
  const isAwayUser = fixture.awayTeamId === userContext.userClubId;

  const resolved = resolveMatchStrengths({
    homeClub,
    awayClub,
    homeRoster,
    awayRoster,
    isHomeUser,
    isAwayUser,
    userContext,
    isSecondHalf: false,
    evalMinute: 28,
  });

  const { lambdaHome, lambdaAway } = computeExpectedGoals(
    resolved.home,
    resolved.away,
  );

  // 1st half carries ~46% of total match xG
  const h1Xg = Math.round(lambdaHome * 0.46 * 100) / 100;
  const a1Xg = Math.round(lambdaAway * 0.46 * 100) / 100;

  const homeGoals = samplePoisson(h1Xg, rng);
  const awayGoals = samplePoisson(a1Xg, rng);

  const homeShots = Math.max(
    homeGoals + 1,
    Math.round(h1Xg * 6.5 + rng() * 3),
  );
  const awayShots = Math.max(
    awayGoals + 1,
    Math.round(a1Xg * 6.3 + rng() * 3),
  );
  const homeShotsOnTarget = Math.min(
    homeShots,
    Math.max(homeGoals, Math.round(homeShots * (0.36 + rng() * 0.16))),
  );
  const awayShotsOnTarget = Math.min(
    awayShots,
    Math.max(awayGoals, Math.round(awayShots * (0.36 + rng() * 0.16))),
  );

  const events: MatchEvent[] = [
    {
      minute: 0,
      half: 1,
      type: 'kickoff',
      teamId: homeClub.id,
      teamShortName: homeClub.shortName,
      teamColor: homeClub.primaryColor,
      isUserTeam: isHomeUser,
      description: `휘슬! ${homeClub.name} (${resolved.homeFormation} · ${TACTICS[resolved.homeTactic].shortName}) vs ${awayClub.name} (${resolved.awayFormation} · ${TACTICS[resolved.awayTactic].shortName}) 킥오프!`,
    },
    ...generateHalfGoalEvents({
      goals: homeGoals,
      half: 1,
      club: homeClub,
      roster: homeRoster,
      tactic: resolved.homeTactic,
      managerTraitId: userContext.managerTraitId,
      isUser: isHomeUser,
      rng,
    }),
    ...generateHalfGoalEvents({
      goals: awayGoals,
      half: 1,
      club: awayClub,
      roster: awayRoster,
      tactic: resolved.awayTactic,
      managerTraitId: userContext.managerTraitId,
      isUser: isAwayUser,
      rng,
    }),
    ...generateHalfFlavorEvents({
      half: 1,
      homeClub,
      awayClub,
      homeRoster,
      awayRoster,
      homeTactic: resolved.homeTactic,
      awayTactic: resolved.awayTactic,
      isHomeUser,
      isAwayUser,
      managerTraitId: userContext.managerTraitId,
      rng,
    }),
    {
      minute: 45,
      half: 1,
      type: 'halftime',
      teamId: homeClub.id,
      description: `전반 종료 (${homeClub.shortName} ${homeGoals} - ${awayGoals} ${awayClub.shortName}). 하프타임 라커룸으로 이동합니다.`,
    },
  ];

  events.sort((a, b) => {
    if (a.minute !== b.minute) return a.minute - b.minute;
    if (a.type === 'kickoff') return -1;
    if (b.type === 'kickoff') return 1;
    if (a.type === 'halftime') return 1;
    if (b.type === 'halftime') return -1;
    return 0;
  });

  const hintData = buildHalftimeTacticalHint({
    userTactic: userContext.tactic,
    oppTactic: isHomeUser ? resolved.awayTactic : resolved.homeTactic,
    userFormation: userContext.formation,
    oppFormation: isHomeUser ? resolved.awayFormation : resolved.homeFormation,
    userGoals: isHomeUser ? homeGoals : awayGoals,
    oppGoals: isHomeUser ? awayGoals : homeGoals,
    userXg: isHomeUser ? h1Xg : a1Xg,
    oppXg: isHomeUser ? a1Xg : h1Xg,
  });

  return {
    fixtureId: fixture.id,
    round: fixture.round,
    homeTeamId: fixture.homeTeamId,
    awayTeamId: fixture.awayTeamId,
    isUserHome: isHomeUser,
    homeGoals,
    awayGoals,
    homeXg: h1Xg,
    awayXg: a1Xg,
    homePossession: resolved.homePossession,
    homeShots,
    awayShots,
    homeShotsOnTarget,
    awayShotsOnTarget,
    homeTactic: resolved.homeTactic,
    awayTactic: resolved.awayTactic,
    homeFormation: resolved.homeFormation,
    awayFormation: resolved.awayFormation,
    firstHalfEvents: events,
    tacticalHint: hintData.hint,
    recommendedTactic: hintData.recommendedTactic,
    recommendedFormation: hintData.recommendedFormation,
    halftimeSubsMade: 0,
    liveSubs: [],
    userTacticAtKickoff: userContext.tactic,
    userFormationAtKickoff: userContext.formation,
    phase: 'first_half',
  };
}

/**
 * Completes the 2nd Half (46'~90') after Halftime tactical/formation/sub adjustments.
 * When `userContext.allowAutoSubs` is true (e.g. instant finish), also schedules realistic
 * 60'~82' bench substitutions so bench players accumulate real minutes & stats.
 */
export function simulateSecondHalf(params: {
  halftime: LiveHalftimeState;
  homeClub: Club;
  awayClub: Club;
  homeRoster: Player[];
  awayRoster: Player[];
  userContext: UserMatchContext;
  rng?: () => number;
}): MatchResult {
  const {
    halftime,
    homeClub,
    awayClub,
    homeRoster,
    awayRoster,
    userContext,
    rng = Math.random,
  } = params;

  const isHomeUser = halftime.isUserHome;
  const isAwayUser = !isHomeUser;
  const userClub = isHomeUser ? homeClub : awayClub;

  const existingLiveSubs = [
    ...(halftime.liveSubs ?? []),
    ...(userContext.liveSubs ?? []),
  ];
  const htSubIds = userContext.halftimeSubIds ?? [];
  const enteredAtMinute: Record<string, number> = {};
  const freshSubEntryMap = new Map<string, number>();

  for (const id of htSubIds) {
    enteredAtMinute[id] = 45;
    freshSubEntryMap.set(id, 45);
  }
  for (const rec of existingLiveSubs) {
    enteredAtMinute[rec.inPlayerId] = rec.minute;
    freshSubEntryMap.set(rec.inPlayerId, rec.minute);
  }

  // Optional auto-subs (used on instant finish from 1st half / halftime)
  let autoSubs: LiveSubRecord[] = [];
  let effectiveUserEndingRoster = [...userContext.starters];
  if (
    userContext.allowAutoSubs &&
    userContext.bench &&
    userContext.bench.length > 0 &&
    halftime.halftimeSubsMade < 3
  ) {
    const planned = planAutoSubstitutions({
      starters: userContext.starters,
      bench: userContext.bench,
      formation: userContext.formation,
      tactic: userContext.tactic,
      managerTraitId: userContext.managerTraitId,
      existingSubsCount: halftime.halftimeSubsMade,
      rng,
    });
    autoSubs = planned.subs;
    effectiveUserEndingRoster = planned.endingStarters;
    for (const rec of autoSubs) {
      enteredAtMinute[rec.inPlayerId] = rec.minute;
      freshSubEntryMap.set(rec.inPlayerId, rec.minute);
    }
  }

  const allSubs = [...existingLiveSubs, ...autoSubs];
  const totalSubsMade = Math.max(halftime.halftimeSubsMade, allSubs.length);

  const halftimeAdjusted =
    userContext.tactic !== halftime.userTacticAtKickoff ||
    userContext.formation !== halftime.userFormationAtKickoff ||
    totalSubsMade > 0;

  const resolved = resolveMatchStrengths({
    homeClub,
    awayClub,
    homeRoster,
    awayRoster,
    isHomeUser,
    isAwayUser,
    userContext: {
      ...userContext,
      starters: effectiveUserEndingRoster,
      halftimeAdjusted,
      halftimeSubsMade: totalSubsMade,
    },
    isSecondHalf: true,
    scoreDiffHome: halftime.homeGoals - halftime.awayGoals,
    evalMinute: 72,
    enteredAtMinute,
  });

  const { lambdaHome, lambdaAway } = computeExpectedGoals(
    resolved.home,
    resolved.away,
  );

  // 2nd half carries ~54% of total match xG (fatigue opens spaces)
  const h2Xg = Math.round(lambdaHome * 0.54 * 100) / 100;
  const a2Xg = Math.round(lambdaAway * 0.54 * 100) / 100;

  const h2Goals = samplePoisson(h2Xg, rng);
  const a2Goals = samplePoisson(a2Xg, rng);

  const h2Shots = Math.max(h2Goals + 1, Math.round(h2Xg * 6.5 + rng() * 3));
  const a2Shots = Math.max(a2Goals + 1, Math.round(a2Xg * 6.3 + rng() * 3));
  const h2Sot = Math.min(
    h2Shots,
    Math.max(h2Goals, Math.round(h2Shots * (0.36 + rng() * 0.16))),
  );
  const a2Sot = Math.min(
    a2Shots,
    Math.max(a2Goals, Math.round(a2Shots * (0.36 + rng() * 0.16))),
  );

  const totalHomeGoals = halftime.homeGoals + h2Goals;
  const totalAwayGoals = halftime.awayGoals + a2Goals;
  const totalHomeXg = Math.round((halftime.homeXg + h2Xg) * 100) / 100;
  const totalAwayXg = Math.round((halftime.awayXg + a2Xg) * 100) / 100;
  const avgPossession = Math.round(
    (halftime.homePossession + resolved.homePossession) / 2,
  );

  const secondHalfEvents: MatchEvent[] = [];

  if (halftimeAdjusted) {
    secondHalfEvents.push({
      minute: 46,
      half: 2,
      type: 'sub',
      teamId: userContext.userClubId,
      teamShortName: userClub.shortName,
      teamColor: userClub.primaryColor,
      isUserTeam: true,
      description: `하프타임 전술 지시 (${userContext.formation} · ${TACTICS[userContext.tactic].name}${halftime.halftimeSubsMade > 0 ? ` · 교체 ${halftime.halftimeSubsMade}명` : ''})`,
    });
  }

  for (const rec of allSubs) {
    secondHalfEvents.push({
      minute: rec.minute,
      half: 2,
      type: 'sub',
      teamId: userContext.userClubId,
      teamShortName: userClub.shortName,
      teamColor: userClub.primaryColor,
      isUserTeam: true,
      subOutName: rec.outPlayerName,
      subInName: rec.inPlayerName,
      description: `🔄 교체 (${rec.minute}'): OUT ${rec.outPlayerName} → IN ${rec.inPlayerName}`,
    });
  }

  const benchById = new Map((userContext.bench ?? []).map((p) => [p.id, p]));
  const userRosterAtMin = (minute: number): Player[] => {
    const cur = [...userContext.starters];
    for (const rec of autoSubs) {
      if (minute >= rec.minute) {
        const bp = benchById.get(rec.inPlayerId);
        if (bp) cur[rec.slotIndex] = bp;
      }
    }
    return cur;
  };

  secondHalfEvents.push(
    ...generateHalfGoalEvents({
      goals: h2Goals,
      half: 2,
      club: homeClub,
      roster: isHomeUser ? effectiveUserEndingRoster : homeRoster,
      tactic: resolved.homeTactic,
      managerTraitId: userContext.managerTraitId,
      isUser: isHomeUser,
      freshSubEntryMinute: isHomeUser ? freshSubEntryMap : undefined,
      rosterAtMinute: isHomeUser ? userRosterAtMin : undefined,
      rng,
    }),
    ...generateHalfGoalEvents({
      goals: a2Goals,
      half: 2,
      club: awayClub,
      roster: isAwayUser ? effectiveUserEndingRoster : awayRoster,
      tactic: resolved.awayTactic,
      managerTraitId: userContext.managerTraitId,
      isUser: isAwayUser,
      freshSubEntryMinute: isAwayUser ? freshSubEntryMap : undefined,
      rosterAtMinute: isAwayUser ? userRosterAtMin : undefined,
      rng,
    }),
    ...generateHalfFlavorEvents({
      half: 2,
      homeClub,
      awayClub,
      homeRoster: isHomeUser ? effectiveUserEndingRoster : homeRoster,
      awayRoster: isAwayUser ? effectiveUserEndingRoster : awayRoster,
      homeTactic: resolved.homeTactic,
      awayTactic: resolved.awayTactic,
      isHomeUser,
      isAwayUser,
      managerTraitId: userContext.managerTraitId,
      rng,
    }),
    {
      minute: 90,
      half: 2,
      type: 'fulltime',
      teamId: homeClub.id,
      description: `경기 종료! 최종 스코어 ${homeClub.shortName} ${totalHomeGoals} - ${totalAwayGoals} ${awayClub.shortName}.`,
    },
  );

  secondHalfEvents.sort((a, b) => {
    if (a.minute !== b.minute) return a.minute - b.minute;
    if (a.type === 'sub') return -1;
    if (b.type === 'sub') return 1;
    if (a.type === 'fulltime') return 1;
    if (b.type === 'fulltime') return -1;
    return 0;
  });

  const allEvents = [...halftime.firstHalfEvents, ...secondHalfEvents];

  const ratingsInfo = buildPlayerRatings({
    homeClub,
    awayClub,
    homeRoster: isHomeUser ? effectiveUserEndingRoster : homeRoster,
    awayRoster: isAwayUser ? effectiveUserEndingRoster : awayRoster,
    homeFormation: resolved.homeFormation,
    awayFormation: resolved.awayFormation,
    homeGoals: totalHomeGoals,
    awayGoals: totalAwayGoals,
    homeXg: totalHomeXg,
    awayXg: totalAwayXg,
    events: allEvents,
    userClubId: userContext.userClubId,
    halftimeSubIds: htSubIds,
    firstHalfUserStarters:
      userContext.firstHalfStarters ?? userContext.starters,
    userLiveSubs: allSubs,
    userBench: userContext.bench,
    rng,
  });

  return {
    fixtureId: halftime.fixtureId,
    round: halftime.round,
    competition: halftime.competition,
    competitionLabel: halftime.competitionLabel,
    homeTeamId: halftime.homeTeamId,
    awayTeamId: halftime.awayTeamId,
    homeGoals: totalHomeGoals,
    awayGoals: totalAwayGoals,
    homeGoals90: totalHomeGoals,
    awayGoals90: totalAwayGoals,
    homeXg: totalHomeXg,
    awayXg: totalAwayXg,
    homePossession: avgPossession,
    homeShots: halftime.homeShots + h2Shots,
    awayShots: halftime.awayShots + a2Shots,
    homeShotsOnTarget: halftime.homeShotsOnTarget + h2Sot,
    awayShotsOnTarget: halftime.awayShotsOnTarget + a2Sot,
    homeTactic: resolved.homeTactic,
    awayTactic: resolved.awayTactic,
    homeFormation: resolved.homeFormation,
    awayFormation: resolved.awayFormation,
    homeTacticBonus: resolved.home.tacticBonus,
    awayTacticBonus: resolved.away.tacticBonus,
    halftimeAdjusted,
    halftimeHomeGoals: halftime.homeGoals,
    halftimeAwayGoals: halftime.awayGoals,
    events: allEvents,
    ...ratingsInfo,
  };
}

/**
 * Re-simulates ONLY the remaining minutes (fromMinute + 1 .. 90') of an in-progress live 2nd half
 * after the user pauses and makes mid-second-half manual substitution(s).
 * Preserves all already-elapsed events (0' .. fromMinute), injects `🔄 OUT / IN` logs at `fromMinute`,
 * and reflects the fresh sub(s)' 100% stamina and joker goal impact for the rest of the match!
 */
export function resimulateRemainingSecondHalf(params: {
  halftime: LiveHalftimeState;
  currentResult: MatchResult;
  fromMinute: number;
  newSubs: LiveSubRecord[];
  allSubsSoFar: LiveSubRecord[];
  homeClub: Club;
  awayClub: Club;
  homeRoster: Player[];
  awayRoster: Player[];
  userContext: UserMatchContext;
  rng?: () => number;
}): MatchResult {
  const {
    halftime,
    currentResult,
    fromMinute,
    newSubs,
    allSubsSoFar,
    homeClub,
    awayClub,
    homeRoster,
    awayRoster,
    userContext,
    rng = Math.random,
  } = params;

  const isHomeUser = halftime.isUserHome;
  const isAwayUser = !isHomeUser;
  const userClub = isHomeUser ? homeClub : awayClub;
  const safeFrom = clamp(fromMinute, 46, 89);

  // Keep all events up to `safeFrom` (excluding fulltime)
  const keptEvents = currentResult.events.filter(
    (ev) => ev.type !== 'fulltime' && ev.minute <= safeFrom,
  );

  // Add live substitution logs at `safeFrom`
  const subLogs: MatchEvent[] = newSubs.map((rec) => ({
    minute: safeFrom,
    half: 2,
    type: 'sub',
    teamId: userContext.userClubId,
    teamShortName: userClub.shortName,
    teamColor: userClub.primaryColor,
    isUserTeam: true,
    subOutName: rec.outPlayerName,
    subInName: rec.inPlayerName,
    description: `🔄 교체 (${safeFrom}'): OUT ${rec.outPlayerName} → IN ${rec.inPlayerName}`,
  }));

  const enteredAtMinute: Record<string, number> = {};
  const freshSubEntryMap = new Map<string, number>();
  for (const id of userContext.halftimeSubIds ?? []) {
    enteredAtMinute[id] = 45;
    freshSubEntryMap.set(id, 45);
  }
  for (const rec of allSubsSoFar) {
    enteredAtMinute[rec.inPlayerId] = rec.minute;
    freshSubEntryMap.set(rec.inPlayerId, rec.minute);
  }

  const remainingMinutes = Math.max(1, 90 - safeFrom);
  const remainingFraction = remainingMinutes / 90;
  const midRemaining = Math.min(88, Math.round((safeFrom + 90) / 2));

  const homeGoalsSoFar = keptEvents.filter(
    (e) => e.type === 'goal' && e.teamId === homeClub.id,
  ).length;
  const awayGoalsSoFar = keptEvents.filter(
    (e) => e.type === 'goal' && e.teamId === awayClub.id,
  ).length;

  const resolved = resolveMatchStrengths({
    homeClub,
    awayClub,
    homeRoster,
    awayRoster,
    isHomeUser,
    isAwayUser,
    userContext: {
      ...userContext,
      halftimeAdjusted: true,
      halftimeSubsMade: allSubsSoFar.length,
    },
    isSecondHalf: true,
    scoreDiffHome: homeGoalsSoFar - awayGoalsSoFar,
    evalMinute: midRemaining,
    enteredAtMinute,
  });

  const { lambdaHome, lambdaAway } = computeExpectedGoals(
    resolved.home,
    resolved.away,
  );

  const remHomeXg = Math.round(lambdaHome * remainingFraction * 1.12 * 100) / 100;
  const remAwayXg = Math.round(lambdaAway * remainingFraction * 1.12 * 100) / 100;

  const remHomeGoals = samplePoisson(remHomeXg, rng);
  const remAwayGoals = samplePoisson(remAwayXg, rng);

  const remStart = Math.min(89, safeFrom + 1);
  const remEvents: MatchEvent[] = [
    ...generateHalfGoalEvents({
      goals: remHomeGoals,
      half: 2,
      club: homeClub,
      roster: homeRoster,
      tactic: resolved.homeTactic,
      managerTraitId: userContext.managerTraitId,
      isUser: isHomeUser,
      minStart: remStart,
      maxMinute: 89,
      freshSubEntryMinute: isHomeUser ? freshSubEntryMap : undefined,
      rng,
    }),
    ...generateHalfGoalEvents({
      goals: remAwayGoals,
      half: 2,
      club: awayClub,
      roster: awayRoster,
      tactic: resolved.awayTactic,
      managerTraitId: userContext.managerTraitId,
      isUser: isAwayUser,
      minStart: remStart,
      maxMinute: 89,
      freshSubEntryMinute: isAwayUser ? freshSubEntryMap : undefined,
      rng,
    }),
    ...(remainingMinutes >= 10
      ? generateHalfFlavorEvents({
          half: 2,
          homeClub,
          awayClub,
          homeRoster,
          awayRoster,
          homeTactic: resolved.homeTactic,
          awayTactic: resolved.awayTactic,
          isHomeUser,
          isAwayUser,
          managerTraitId: userContext.managerTraitId,
          minStart: remStart,
          maxMinute: 89,
          rng,
        })
      : []),
  ];

  const elapsedHomeGoals = keptEvents.filter(
    (e) => e.type === 'goal' && e.teamId === homeClub.id,
  ).length;
  const elapsedAwayGoals = keptEvents.filter(
    (e) => e.type === 'goal' && e.teamId === awayClub.id,
  ).length;

  const totalHomeGoals = elapsedHomeGoals + remHomeGoals;
  const totalAwayGoals = elapsedAwayGoals + remAwayGoals;

  const elapsed2ndFrac = Math.max(0, (safeFrom - 45) / 45);
  const elapsedHomeXg =
    halftime.homeXg + (currentResult.homeXg - halftime.homeXg) * elapsed2ndFrac;
  const elapsedAwayXg =
    halftime.awayXg + (currentResult.awayXg - halftime.awayXg) * elapsed2ndFrac;

  const totalHomeXg = Math.round((elapsedHomeXg + remHomeXg) * 100) / 100;
  const totalAwayXg = Math.round((elapsedAwayXg + remAwayXg) * 100) / 100;

  const allEvents: MatchEvent[] = [
    ...keptEvents,
    ...subLogs,
    ...remEvents,
    {
      minute: 90,
      half: 2,
      type: 'fulltime',
      teamId: homeClub.id,
      description: `경기 종료! 최종 스코어 ${homeClub.shortName} ${totalHomeGoals} - ${totalAwayGoals} ${awayClub.shortName}.`,
    },
  ];

  allEvents.sort((a, b) => {
    if (a.minute !== b.minute) return a.minute - b.minute;
    if (a.type === 'kickoff') return -1;
    if (b.type === 'kickoff') return 1;
    if (a.type === 'sub' && b.type !== 'sub') return -1;
    if (b.type === 'sub' && a.type !== 'sub') return 1;
    if (a.type === 'fulltime') return 1;
    if (b.type === 'fulltime') return -1;
    return 0;
  });

  const ratingsInfo = buildPlayerRatings({
    homeClub,
    awayClub,
    homeRoster,
    awayRoster,
    homeFormation: resolved.homeFormation,
    awayFormation: resolved.awayFormation,
    homeGoals: totalHomeGoals,
    awayGoals: totalAwayGoals,
    homeXg: totalHomeXg,
    awayXg: totalAwayXg,
    events: allEvents,
    userClubId: userContext.userClubId,
    halftimeSubIds: userContext.halftimeSubIds,
    firstHalfUserStarters:
      userContext.firstHalfStarters ?? userContext.starters,
    userLiveSubs: allSubsSoFar,
    userBench: userContext.bench,
    rng,
  });

  return {
    ...currentResult,
    homeGoals: totalHomeGoals,
    awayGoals: totalAwayGoals,
    homeGoals90: totalHomeGoals,
    awayGoals90: totalAwayGoals,
    homeXg: totalHomeXg,
    awayXg: totalAwayXg,
    homeShots: Math.max(
      totalHomeGoals + 1,
      Math.round(totalHomeXg * 6.5 + 2),
    ),
    awayShots: Math.max(
      totalAwayGoals + 1,
      Math.round(totalAwayXg * 6.3 + 2),
    ),
    homeShotsOnTarget: Math.max(
      totalHomeGoals,
      Math.round(totalHomeXg * 2.5 + 1),
    ),
    awayShotsOnTarget: Math.max(
      totalAwayGoals,
      Math.round(totalAwayXg * 2.4 + 1),
    ),
    halftimeAdjusted: true,
    halftimeHomeGoals: halftime.homeGoals,
    halftimeAwayGoals: halftime.awayGoals,
    events: allEvents,
    ...ratingsInfo,
  };
}

/**
 * Full 90-minute match simulation used for AI vs AI fixtures and quick-skip / fast-sim user fixtures.
 * Automatically executes 3~5 realistic bench substitutions between 60' and 82' when bench is provided,
 * giving bench players authentic sub appearances, minutes played, goals, assists, and ratings.
 */
export function simulateMatch(
  fixture: Fixture,
  homeClub: Club,
  awayClub: Club,
  homeRoster: Player[],
  awayRoster: Player[],
  userContext?: UserMatchContext,
  rng: () => number = Math.random,
): MatchResult {
  const isHomeUser = Boolean(
    userContext && fixture.homeTeamId === userContext.userClubId,
  );
  const isAwayUser = Boolean(
    userContext && fixture.awayTeamId === userContext.userClubId,
  );
  const involvesUser = isHomeUser || isAwayUser;

  // Plan automatic 60'~82' bench substitutions for quick/skip/fast-sim user matches
  let autoSubs: LiveSubRecord[] = [];
  let userEndingStarters: Player[] = userContext ? [...userContext.starters] : [];
  const enteredAtMinute: Record<string, number> = {};
  const freshSubEntryMap = new Map<string, number>();

  if (
    involvesUser &&
    userContext &&
    userContext.bench &&
    userContext.bench.length > 0 &&
    userContext.allowAutoSubs !== false
  ) {
    const planned = planAutoSubstitutions({
      starters: userContext.starters,
      bench: userContext.bench,
      formation: userContext.formation,
      tactic: userContext.tactic,
      managerTraitId: userContext.managerTraitId,
      rng,
    });
    autoSubs = planned.subs;
    userEndingStarters = planned.endingStarters;
    for (const rec of autoSubs) {
      enteredAtMinute[rec.inPlayerId] = rec.minute;
      freshSubEntryMap.set(rec.inPlayerId, rec.minute);
    }
  }

  const resolved = resolveMatchStrengths({
    homeClub,
    awayClub,
    homeRoster,
    awayRoster,
    isHomeUser,
    isAwayUser,
    userContext: userContext
      ? {
          ...userContext,
          starters: userEndingStarters,
          halftimeSubsMade: autoSubs.length,
        }
      : undefined,
    isSecondHalf: false,
    evalMinute: 62,
    enteredAtMinute,
  });

  const { lambdaHome, lambdaAway } = computeExpectedGoals(
    resolved.home,
    resolved.away,
  );

  const homeXg = Math.round(lambdaHome * 100) / 100;
  const awayXg = Math.round(lambdaAway * 100) / 100;

  const homeGoals = samplePoisson(lambdaHome, rng);
  const awayGoals = samplePoisson(lambdaAway, rng);

  const homeShots = Math.max(
    homeGoals + 2,
    Math.round(lambdaHome * 6.4 + rng() * 5),
  );
  const awayShots = Math.max(
    awayGoals + 2,
    Math.round(lambdaAway * 6.2 + rng() * 5),
  );
  const homeShotsOnTarget = Math.min(
    homeShots,
    Math.max(homeGoals, Math.round(homeShots * (0.37 + rng() * 0.15))),
  );
  const awayShotsOnTarget = Math.min(
    awayShots,
    Math.max(awayGoals, Math.round(awayShots * (0.37 + rng() * 0.15))),
  );

  const h1Home = Math.floor(homeGoals / 2);
  const h2Home = homeGoals - h1Home;
  const h1Away = Math.floor(awayGoals / 2);
  const h2Away = awayGoals - h1Away;

  const benchById = new Map((userContext?.bench ?? []).map((p) => [p.id, p]));
  const userRosterAtMinute = (minute: number): Player[] => {
    if (!userContext) return [];
    const cur = [...userContext.starters];
    for (const rec of autoSubs) {
      if (minute >= rec.minute) {
        const bp = benchById.get(rec.inPlayerId);
        if (bp) cur[rec.slotIndex] = bp;
      }
    }
    return cur;
  };

  const events: MatchEvent[] = [
    ...generateHalfGoalEvents({
      goals: h1Home,
      half: 1,
      club: homeClub,
      roster: homeRoster,
      tactic: resolved.homeTactic,
      managerTraitId: userContext?.managerTraitId,
      isUser: isHomeUser,
      rng,
    }),
    ...generateHalfGoalEvents({
      goals: h2Home,
      half: 2,
      club: homeClub,
      roster: isHomeUser ? userEndingStarters : homeRoster,
      tactic: resolved.homeTactic,
      managerTraitId: userContext?.managerTraitId,
      isUser: isHomeUser,
      freshSubEntryMinute: isHomeUser ? freshSubEntryMap : undefined,
      rosterAtMinute: isHomeUser ? userRosterAtMinute : undefined,
      rng,
    }),
    ...generateHalfGoalEvents({
      goals: h1Away,
      half: 1,
      club: awayClub,
      roster: awayRoster,
      tactic: resolved.awayTactic,
      managerTraitId: userContext?.managerTraitId,
      isUser: isAwayUser,
      rng,
    }),
    ...generateHalfGoalEvents({
      goals: h2Away,
      half: 2,
      club: awayClub,
      roster: isAwayUser ? userEndingStarters : awayRoster,
      tactic: resolved.awayTactic,
      managerTraitId: userContext?.managerTraitId,
      isUser: isAwayUser,
      freshSubEntryMinute: isAwayUser ? freshSubEntryMap : undefined,
      rosterAtMinute: isAwayUser ? userRosterAtMinute : undefined,
      rng,
    }),
  ];

  if (involvesUser && userContext) {
    const uClub = isHomeUser ? homeClub : awayClub;
    events.push({
      minute: 0,
      half: 1,
      type: 'kickoff',
      teamId: homeClub.id,
      teamShortName: homeClub.shortName,
      teamColor: homeClub.primaryColor,
      isUserTeam: isHomeUser,
      description: `휘슬! ${homeClub.name} vs ${awayClub.name} 킥오프.`,
    });
    const userGk = userContext.starters.find((p) => p.position === 'GK');
    events.push({
      minute: Math.floor(rng() * 35) + 20,
      half: 1,
      type: 'save',
      teamId: userContext.userClubId,
      teamShortName: uClub.shortName,
      teamColor: uClub.primaryColor,
      isUserTeam: true,
      description: userGk
        ? `${userGk.name}의 결정적인 슈퍼 세이브!`
        : '골키퍼의 결정적인 선방!',
    });
    events.push({
      minute: 45,
      half: 1,
      type: 'halftime',
      teamId: homeClub.id,
      description: '전반전 종료.',
    });
    for (const rec of autoSubs) {
      events.push({
        minute: rec.minute,
        half: 2,
        type: 'sub',
        teamId: userContext.userClubId,
        teamShortName: uClub.shortName,
        teamColor: uClub.primaryColor,
        isUserTeam: true,
        subOutName: rec.outPlayerName,
        subInName: rec.inPlayerName,
        description: `🔄 자동 교체 (${rec.minute}'): OUT ${rec.outPlayerName} → IN ${rec.inPlayerName}`,
      });
    }
    events.push({
      minute: 90,
      half: 2,
      type: 'fulltime',
      teamId: homeClub.id,
      description: `경기 종료! 최종 스코어 ${homeClub.shortName} ${homeGoals} - ${awayGoals} ${awayClub.shortName}.`,
    });
  }

  events.sort((a, b) => {
    if (a.minute !== b.minute) return a.minute - b.minute;
    if (a.type === 'kickoff') return -1;
    if (b.type === 'kickoff') return 1;
    if (a.type === 'fulltime') return 1;
    if (b.type === 'fulltime') return -1;
    return 0;
  });

  const ratingsInfo = buildPlayerRatings({
    homeClub,
    awayClub,
    homeRoster: isHomeUser ? userEndingStarters : homeRoster,
    awayRoster: isAwayUser ? userEndingStarters : awayRoster,
    homeFormation: resolved.homeFormation,
    awayFormation: resolved.awayFormation,
    homeGoals,
    awayGoals,
    homeXg,
    awayXg,
    events,
    userClubId: userContext?.userClubId,
    firstHalfUserStarters: userContext?.starters,
    userLiveSubs: autoSubs,
    userBench: userContext?.bench,
    rng,
  });

  return {
    fixtureId: fixture.id,
    round: fixture.round,
    homeTeamId: fixture.homeTeamId,
    awayTeamId: fixture.awayTeamId,
    homeGoals,
    awayGoals,
    homeGoals90: homeGoals,
    awayGoals90: awayGoals,
    halftimeHomeGoals: h1Home,
    halftimeAwayGoals: h1Away,
    homeXg,
    awayXg,
    homePossession: resolved.homePossession,
    homeShots,
    awayShots,
    homeShotsOnTarget,
    awayShotsOnTarget,
    homeTactic: resolved.homeTactic,
    awayTactic: resolved.awayTactic,
    homeFormation: resolved.homeFormation,
    awayFormation: resolved.awayFormation,
    homeTacticBonus: resolved.home.tacticBonus,
    awayTacticBonus: resolved.away.tacticBonus,
    events,
    ...ratingsInfo,
  };
}

/**
 * Lightweight club-vs-club simulation for the 4 background European leagues,
 * reusing the exact same calibrated club ratings, formation/tactic matchup,
 * and Poisson goal model without generating per-player event logs.
 */
export function simulateBackgroundClubMatch(
  fixture: Fixture,
  homeClub: Club,
  awayClub: Club,
  rng: () => number = Math.random,
): MatchResult {
  const resolved = resolveMatchStrengths({
    homeClub,
    awayClub,
    isHomeUser: false,
    isAwayUser: false,
    isSecondHalf: false,
  });

  const { lambdaHome, lambdaAway } = computeExpectedGoals(
    resolved.home,
    resolved.away,
  );

  const homeXg = Math.round(lambdaHome * 100) / 100;
  const awayXg = Math.round(lambdaAway * 100) / 100;
  const homeGoals = samplePoisson(lambdaHome, rng);
  const awayGoals = samplePoisson(lambdaAway, rng);

  return {
    fixtureId: fixture.id,
    round: fixture.round,
    homeTeamId: fixture.homeTeamId,
    awayTeamId: fixture.awayTeamId,
    homeGoals,
    awayGoals,
    homeGoals90: homeGoals,
    awayGoals90: awayGoals,
    homeXg,
    awayXg,
    homePossession: resolved.homePossession,
    homeShots: Math.max(homeGoals + 2, Math.round(lambdaHome * 6.4)),
    awayShots: Math.max(awayGoals + 2, Math.round(lambdaAway * 6.2)),
    homeShotsOnTarget: Math.max(homeGoals, Math.round(lambdaHome * 2.5)),
    awayShotsOnTarget: Math.max(awayGoals, Math.round(lambdaAway * 2.4)),
    homeTactic: resolved.homeTactic,
    awayTactic: resolved.awayTactic,
    homeFormation: resolved.homeFormation,
    awayFormation: resolved.awayFormation,
    homeTacticBonus: resolved.home.tacticBonus,
    awayTacticBonus: resolved.away.tacticBonus,
    events: [],
    playerRatings: [],
    momPlayerId: '',
    momPlayerName: '',
    momRating: 0,
  };
}

function orderPenaltyKickers(roster: Player[]): Player[] {
  const outfield = roster.filter((p) => p.position !== 'GK');
  const gk = roster.filter((p) => p.position === 'GK');
  const sorted = [...outfield].sort(
    (a, b) =>
      b.att * 0.65 +
      b.ovr * 0.35 -
      (a.att * 0.65 + a.ovr * 0.35),
  );
  return [...sorted, ...gk];
}

/**
 * Simulates a realistic football Penalty Shootout (5 regular rounds with early-clinch detection
 * + sudden death until a winner emerges), weighted by kicker finishing vs goalkeeper ability.
 */
export function simulatePenaltyShootoutOnly(params: {
  homeClub: Club;
  awayClub: Club;
  homeRoster: Player[];
  awayRoster: Player[];
  rng?: () => number;
}): NonNullable<ExtraTimeInfo['penalties']> {
  const { homeClub, awayClub, homeRoster, awayRoster, rng = Math.random } =
    params;

  const homeKickers = orderPenaltyKickers(homeRoster);
  const awayKickers = orderPenaltyKickers(awayRoster);
  const homeGkOvr =
    homeRoster.find((p) => p.position === 'GK')?.ovr ?? homeClub.def;
  const awayGkOvr =
    awayRoster.find((p) => p.position === 'GK')?.ovr ?? awayClub.def;

  let homeScore = 0;
  let awayScore = 0;
  const kicks: PenaltyKickLog[] = [];

  const takeKick = (
    kicker: Player | undefined,
    fallbackName: string,
    gkOvr: number,
  ): { name: string; scored: boolean } => {
    const kickerSkill = kicker ? kicker.att * 0.55 + kicker.ovr * 0.45 : 78;
    const prob = clamp(0.79 + (kickerSkill - gkOvr) * 0.0055, 0.66, 0.90);
    return {
      name: kicker?.name ?? fallbackName,
      scored: rng() < prob,
    };
  };

  // Standard 5 rounds with authentic mathematical early-clinch check
  for (let round = 1; round <= 5; round += 1) {
    const hKicker = homeKickers[(round - 1) % Math.max(1, homeKickers.length)];
    const hAttempt = takeKick(hKicker, `${homeClub.shortName} 키커 ${round}`, awayGkOvr);
    if (hAttempt.scored) homeScore += 1;
    kicks.push({
      round,
      teamId: homeClub.id,
      teamShortName: homeClub.shortName,
      kickerName: hAttempt.name,
      scored: hAttempt.scored,
      homeScoreAfter: homeScore,
      awayScoreAfter: awayScore,
    });

    const homeRemainingAfterHome = 5 - round;
    const awayRemainingBeforeAway = 5 - round + 1;
    if (
      homeScore > awayScore + awayRemainingBeforeAway ||
      awayScore > homeScore + homeRemainingAfterHome
    ) {
      break;
    }

    const aKicker = awayKickers[(round - 1) % Math.max(1, awayKickers.length)];
    const aAttempt = takeKick(aKicker, `${awayClub.shortName} 키커 ${round}`, homeGkOvr);
    if (aAttempt.scored) awayScore += 1;
    kicks.push({
      round,
      teamId: awayClub.id,
      teamShortName: awayClub.shortName,
      kickerName: aAttempt.name,
      scored: aAttempt.scored,
      homeScoreAfter: homeScore,
      awayScoreAfter: awayScore,
    });

    const remaining = 5 - round;
    if (
      homeScore > awayScore + remaining ||
      awayScore > homeScore + remaining
    ) {
      break;
    }
  }

  // Sudden death if still level after 5 rounds
  let sdRound = 6;
  while (homeScore === awayScore && sdRound <= 20) {
    const hKicker =
      homeKickers[(sdRound - 1) % Math.max(1, homeKickers.length)];
    const hAttempt = takeKick(
      hKicker,
      `${homeClub.shortName} 키커 ${sdRound}`,
      awayGkOvr,
    );
    if (hAttempt.scored) homeScore += 1;
    kicks.push({
      round: sdRound,
      teamId: homeClub.id,
      teamShortName: homeClub.shortName,
      kickerName: hAttempt.name,
      scored: hAttempt.scored,
      homeScoreAfter: homeScore,
      awayScoreAfter: awayScore,
    });

    const aKicker =
      awayKickers[(sdRound - 1) % Math.max(1, awayKickers.length)];
    const aAttempt = takeKick(
      aKicker,
      `${awayClub.shortName} 키커 ${sdRound}`,
      homeGkOvr,
    );
    if (aAttempt.scored) awayScore += 1;
    kicks.push({
      round: sdRound,
      teamId: awayClub.id,
      teamShortName: awayClub.shortName,
      kickerName: aAttempt.name,
      scored: aAttempt.scored,
      homeScoreAfter: homeScore,
      awayScoreAfter: awayScore,
    });

    sdRound += 1;
  }

  // Absolute fallback safety (in astronomically unlikely 20-round tie)
  if (homeScore === awayScore) {
    homeScore += 1;
    kicks.push({
      round: sdRound,
      teamId: homeClub.id,
      teamShortName: homeClub.shortName,
      kickerName: homeKickers[0]?.name ?? `${homeClub.shortName} 주장`,
      scored: true,
      homeScoreAfter: homeScore,
      awayScoreAfter: awayScore,
    });
  }

  return {
    homePenGoals: homeScore,
    awayPenGoals: awayScore,
    kicks,
    winnerTeamId: homeScore > awayScore ? homeClub.id : awayClub.id,
  };
}

/**
 * Resolves Extra Time (91'~120') and, if still drawn, Penalty Shootout for knockout matches
 * (Single-leg Domestic Cup / UCL Final OR 2nd-leg UCL Knockout ties).
 * Continues stamina drain from 90' into 108' (rewarding high STA and the 6th ET substitution).
 */
export function simulateExtraTimeAndPenalties(params: {
  baseResult: MatchResult;
  homeClub: Club;
  awayClub: Club;
  homeRoster: Player[];
  awayRoster: Player[];
  userContext?: UserMatchContext;
  aggHomeBeforeMatch?: number;
  aggAwayBeforeMatch?: number;
  extraTimeSubIds?: string[];
  rng?: () => number;
}): MatchResult {
  const {
    baseResult,
    homeClub,
    awayClub,
    homeRoster,
    awayRoster,
    userContext,
    aggHomeBeforeMatch,
    aggAwayBeforeMatch,
    extraTimeSubIds = [],
    rng = Math.random,
  } = params;

  const home90 = baseResult.homeGoals90 ?? baseResult.homeGoals;
  const away90 = baseResult.awayGoals90 ?? baseResult.awayGoals;
  const aggBeforeH = aggHomeBeforeMatch ?? 0;
  const aggBeforeA = aggAwayBeforeMatch ?? 0;

  // Already decided in 90 minutes -> return as-is
  if (aggBeforeH + home90 !== aggBeforeA + away90) {
    return baseResult;
  }

  const isHomeUser = Boolean(
    userContext && baseResult.homeTeamId === userContext.userClubId,
  );
  const isAwayUser = Boolean(
    userContext && baseResult.awayTeamId === userContext.userClubId,
  );

  const enteredAtMinute: Record<string, number> = {};
  const freshSubEntryMap = new Map<string, number>();
  for (const id of userContext?.halftimeSubIds ?? []) {
    enteredAtMinute[id] = 45;
    freshSubEntryMap.set(id, 45);
  }
  for (const rec of userContext?.liveSubs ?? []) {
    enteredAtMinute[rec.inPlayerId] = rec.minute;
    freshSubEntryMap.set(rec.inPlayerId, rec.minute);
  }
  for (const id of extraTimeSubIds) {
    enteredAtMinute[id] = 90;
    freshSubEntryMap.set(id, 90);
  }

  const resolved = resolveMatchStrengths({
    homeClub,
    awayClub,
    isHomeUser,
    isAwayUser,
    userContext,
    isSecondHalf: true,
    evalMinute: 108,
    enteredAtMinute,
  });

  const { lambdaHome, lambdaAway } = computeExpectedGoals(
    resolved.home,
    resolved.away,
  );

  // 30 minutes of cautious high-stakes Extra Time (~0.31x of 90-min xG)
  const homeEtXg = Math.round(lambdaHome * 0.31 * 100) / 100;
  const awayEtXg = Math.round(lambdaAway * 0.31 * 100) / 100;

  const homeEtGoals = samplePoisson(homeEtXg, rng);
  const awayEtGoals = samplePoisson(awayEtXg, rng);

  const etEvents: MatchEvent[] = [
    {
      minute: 91,
      half: 2,
      type: 'kickoff',
      teamId: homeClub.id,
      description: '⏱️ 연장전 전반 킥오프! 체력 한계의 30분 승부가 시작됩니다.',
    },
    ...generateHalfGoalEvents({
      goals: homeEtGoals,
      half: 2,
      club: homeClub,
      roster: homeRoster,
      tactic: resolved.homeTactic,
      managerTraitId: userContext?.managerTraitId,
      isUser: isHomeUser,
      minStart: 92,
      maxMinute: 119,
      freshSubEntryMinute: isHomeUser ? freshSubEntryMap : undefined,
      rng,
    }),
    ...generateHalfGoalEvents({
      goals: awayEtGoals,
      half: 2,
      club: awayClub,
      roster: awayRoster,
      tactic: resolved.awayTactic,
      managerTraitId: userContext?.managerTraitId,
      isUser: isAwayUser,
      minStart: 92,
      maxMinute: 119,
      freshSubEntryMinute: isAwayUser ? freshSubEntryMap : undefined,
      rng,
    }),
  ];

  // Add 1-2 tense ET chance/save events so ET feels dramatic even if 0-0
  const flavorPool = generateHalfFlavorEvents({
    half: 2,
    homeClub,
    awayClub,
    homeRoster,
    awayRoster,
    homeTactic: resolved.homeTactic,
    awayTactic: resolved.awayTactic,
    isHomeUser,
    isAwayUser,
    managerTraitId: userContext?.managerTraitId,
    minStart: 94,
    maxMinute: 118,
    rng,
  }).slice(0, 2);
  etEvents.push(...flavorPool);

  etEvents.sort((a, b) => {
    if (a.minute !== b.minute) return a.minute - b.minute;
    if (a.type === 'kickoff') return -1;
    if (b.type === 'kickoff') return 1;
    return 0;
  });

  const totalHomeGoals = home90 + homeEtGoals;
  const totalAwayGoals = away90 + awayEtGoals;
  const finalAggHome = aggBeforeH + totalHomeGoals;
  const finalAggAway = aggBeforeA + totalAwayGoals;

  let penalties: ExtraTimeInfo['penalties'] | undefined;
  let winnerTeamId: string;

  if (finalAggHome > finalAggAway) {
    winnerTeamId = homeClub.id;
  } else if (finalAggAway > finalAggHome) {
    winnerTeamId = awayClub.id;
  } else {
    penalties = simulatePenaltyShootoutOnly({
      homeClub,
      awayClub,
      homeRoster,
      awayRoster,
      rng,
    });
    winnerTeamId = penalties.winnerTeamId;
  }

  etEvents.push({
    minute: 120,
    half: 2,
    type: 'fulltime',
    teamId: winnerTeamId,
    description: penalties
      ? `연장전 종료 (${homeClub.shortName} ${totalHomeGoals} - ${totalAwayGoals} ${awayClub.shortName})! 운명의 승부차기(${penalties.homePenGoals}-${penalties.awayPenGoals})로 돌입합니다!`
      : `연장전 종료! ${homeClub.shortName} ${totalHomeGoals} - ${totalAwayGoals} ${awayClub.shortName} (${winnerTeamId === homeClub.id ? homeClub.shortName : awayClub.shortName} 승리!)`,
  });

  // Update player ratings to reflect ET goals, assists, and +30 minutes played
  const etGoalCounts = new Map<string, number>();
  const etAssistCounts = new Map<string, number>();
  for (const ev of etEvents) {
    if (ev.type === 'goal') {
      if (ev.scorerId) {
        const k = `${ev.teamId}:${ev.scorerId}`;
        etGoalCounts.set(k, (etGoalCounts.get(k) ?? 0) + 1);
      }
      if (ev.assistId) {
        const k = `${ev.teamId}:${ev.assistId}`;
        etAssistCounts.set(k, (etAssistCounts.get(k) ?? 0) + 1);
      }
    }
  }

  const updatedRatings: MatchPlayerRating[] = baseResult.playerRatings.map((pr) => {
    const key = `${pr.teamId}:${pr.playerId}`;
    const g = etGoalCounts.get(key) ?? 0;
    const a = etAssistCounts.get(key) ?? 0;
    const ratingBoost = g * 0.9 + a * 0.55;
    return {
      ...pr,
      goals: pr.goals + g,
      assists: pr.assists + a,
      minutesPlayed: pr.minutesPlayed + (pr.isSub ? 20 : 30),
      rating: Math.round(clamp(pr.rating + ratingBoost, 4.2, 10.0) * 10) / 10,
    };
  });

  // Add any newly entered ET user sub who wasn't in the 90-min ratings yet
  if (userContext && extraTimeSubIds.length > 0) {
    const existingUserIds = new Set(
      updatedRatings
        .filter((r) => r.teamId === userContext.userClubId)
        .map((r) => r.playerId),
    );
    const activeUserRoster = isHomeUser ? homeRoster : awayRoster;
    for (const subId of extraTimeSubIds) {
      if (existingUserIds.has(subId)) continue;
      const p = activeUserRoster.find((x) => x.id === subId);
      if (!p) continue;
      const key = `${userContext.userClubId}:${p.id}`;
      const g = etGoalCounts.get(key) ?? 0;
      const a = etAssistCounts.get(key) ?? 0;
      updatedRatings.push({
        playerId: p.id,
        playerName: p.name,
        teamId: userContext.userClubId,
        position: p.position,
        subPosition: getPrimaryPosition(p),
        rating: Math.round(clamp(6.8 + g * 1.1 + a * 0.65, 5.5, 10.0) * 10) / 10,
        goals: g,
        assists: a,
        xg: g > 0 ? 0.45 : 0.12,
        minutesPlayed: 30,
        isSub: true,
        isLegend: p.isLegend,
      });
    }
  }

  let mom = updatedRatings[0];
  for (const r of updatedRatings) {
    if (
      r.rating > mom.rating ||
      (r.rating === mom.rating && r.goals + r.assists > mom.goals + mom.assists)
    ) {
      mom = r;
    }
  }

  const extraTime: ExtraTimeInfo = {
    homeEtGoals,
    awayEtGoals,
    etEvents,
    penalties,
    winnerTeamId,
  };

  return {
    ...baseResult,
    homeGoals: totalHomeGoals,
    awayGoals: totalAwayGoals,
    homeGoals90: home90,
    awayGoals90: away90,
    homeXg: Math.round((baseResult.homeXg + homeEtXg) * 100) / 100,
    awayXg: Math.round((baseResult.awayXg + awayEtXg) * 100) / 100,
    homeShots: baseResult.homeShots + Math.max(homeEtGoals, Math.round(homeEtXg * 6)),
    awayShots: baseResult.awayShots + Math.max(awayEtGoals, Math.round(awayEtXg * 6)),
    homeShotsOnTarget:
      baseResult.homeShotsOnTarget + Math.max(homeEtGoals, Math.round(homeEtXg * 2.4)),
    awayShotsOnTarget:
      baseResult.awayShotsOnTarget + Math.max(awayEtGoals, Math.round(awayEtXg * 2.4)),
    extraTime,
    events: [...baseResult.events.filter((e) => e.type !== 'fulltime'), ...etEvents],
    playerRatings: updatedRatings,
    momPlayerId: mom?.playerId ?? baseResult.momPlayerId,
    momPlayerName: mom?.playerName ?? baseResult.momPlayerName,
    momRating: mom?.rating ?? baseResult.momRating,
  };
}
