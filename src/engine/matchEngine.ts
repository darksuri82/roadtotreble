import { getClubManager } from '../data/aiManagers';
import { FORMATIONS } from '../data/formations';
import { evaluateManagerPlayerSynergy } from '../data/managerTraits';
import type {
  FormationId,
  ManagerTraitId,
  PlayerSlotSynergy,
  TeamRatings,
} from '../types/game';
import type {
  AiHalftimeAdjustment,
  Club,
  ExtraTimeInfo,
  Fixture,
  HighlightOutcomeType,
  HighlightPatternId,
  LiveHalftimeState,
  LiveSubRecord,
  MatchCompetitionType,
  MatchEvent,
  MatchPlayerRating,
  MatchResult,
  PenaltyKickLog,
  ShotAngleType,
  TacticId,
} from '../types/league';
import type { Player, SubPosition } from '../types/player';
import {
  computeTeamSubAttributeModifier,
  formatAttackChainDescription,
  mapPatternToAttackRoute,
  pickChainAssister,
  pickChainScorer,
  pickContestDefender,
  pickFinishType,
  resolveHighlightPatternWeightsWithSubAttributes,
} from './attackChainEngine';
import { getPlayerAttributes } from './attributeEngine';
import {
  applySlotSynergiesToStarters,
  calculateChemistry,
} from './chemistryEngine';
import { getPrimaryPosition } from './positionEngine';
import {
  computeLineupStaminaImpact,
  planAutoSubstitutions,
} from './staminaEngine';
import {
  buildHalftimeTacticalHint,
  evaluateFormationMatchup,
  evaluateTacticMatchup,
  TACTICS,
} from './tacticEngine';
import {
  decideAiHalftimeAdjustment,
  evaluateUnifiedTacticalMatchup,
  type UnifiedTacticalMatchup,
} from './unifiedTacticsEngine';

export const USER_CLUB_ID = 'user-club';

export interface UserMatchContext {
  userClubId: string;
  starters: Player[];
  bench?: Player[];
  formation: FormationId;
  tactic: TacticId;
  chemistry: number;
  ratings: TeamRatings;
  slotSynergies?: Record<number, PlayerSlotSynergy>;
  managerTraitId: ManagerTraitId | null;
  competition?: MatchCompetitionType;
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

const aiClubSynergyLiftCache = new Map<string, number>();
const MAX_AI_SYNERGY_CACHE = 512;

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
        out.attDelta += 0.85;
        out.midDelta += 1.25;
        out.defDelta += 0.85;
        out.possessionBonus += 3;
      }
      break;
    case 'gegenpress_guru':
      if (userTactic === 'gegenpressing') {
        out.attDelta += 1.15;
        out.midDelta += 1.05;
        out.defDelta += 0.85;
      }
      break;
    case 'catenaccio':
      if (userTactic === 'counter') {
        out.defDelta += 1.8;
        out.oppXgPenalty += 0.08;
      } else {
        out.defDelta += 0.6;
      }
      break;
    case 'wing_bomber':
      if (userTactic === 'wingplay') {
        out.attDelta += 1.4;
        out.xgBonus += 0.08;
      }
      break;
    case 'halftime_wizard':
      if (isSecondHalf && halftimeAdjusted) {
        out.halftimeTacticMultiplier = 1.5;
        out.xgBonus += 0.1;
      }
      break;
    case 'big_game_hunter':
      if ((opponentRank !== undefined && opponentRank <= 6) || oppAvgOvr >= 84) {
        out.attDelta += 1.4;
        out.midDelta += 1.4;
        out.defDelta += 1.4;
      }
      break;
    case 'set_piece_master':
      out.xgBonus += 0.13;
      break;
    case 'underdog_killer':
      if (userAvgOvr < oppAvgOvr) {
        out.attDelta += 1.8;
        out.midDelta += 1.8;
        out.defDelta += 1.8;
      }
      break;
    case 'galactico_manager': {
      const stars = starters.filter((p) => p.isLegend || p.ovr >= 91).length;
      const bonus = Math.min(1.8, stars * 0.35);
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
        out.attDelta += Math.min(1.4, 0.6 + directFw * 0.28);
      }
      break;
    }
    case 'defensive_architect':
      out.defDelta += 1.2;
      out.oppXgPenalty += 0.1;
      break;
    case 'midfield_maestro':
      out.midDelta += 1.4;
      out.possessionBonus += 4;
      break;
    case 'super_sub':
      if (isSecondHalf && halftimeSubsMade > 0) {
        out.attDelta += 1.7;
        out.midDelta += 1.5;
        out.defDelta += 1.2;
      } else if (!isSecondHalf) {
        out.attDelta += 0.35;
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
  opponentUserContext?: UserMatchContext;
  isSecondHalf?: boolean;
  scoreDiffHome?: number; // homeGoals - awayGoals entering 2nd half
  evalMinute?: number;
  enteredAtMinute?: Record<string, number>;
  opponentEnteredAtMinute?: Record<string, number>;
  aiOverrideFormation?: FormationId;
  aiOverrideTactic?: TacticId;
  aiHalftimeAdjusted?: boolean;
}): {
  home: EffectiveTeamStrength;
  away: EffectiveTeamStrength;
  homeTactic: TacticId;
  awayTactic: TacticId;
  homeFormation: FormationId;
  awayFormation: FormationId;
  homePossession: number;
  unifiedMatchup: UnifiedTacticalMatchup | null;
} {
  const {
    homeClub,
    awayClub,
    homeRoster = [],
    awayRoster = [],
    isHomeUser,
    isAwayUser,
    userContext,
    opponentUserContext,
    isSecondHalf = false,
    scoreDiffHome = 0,
    evalMinute = isSecondHalf ? 72 : 30,
    enteredAtMinute = {},
    opponentEnteredAtMinute = {},
    aiOverrideFormation,
    aiOverrideTactic,
    aiHalftimeAdjusted = false,
  } = params;

  const homeUserCtx = isHomeUser ? userContext : opponentUserContext;
  const awayUserCtx = isAwayUser ? userContext : opponentUserContext;
  const homeIsHuman = Boolean(homeUserCtx);
  const awayIsHuman = Boolean(awayUserCtx);

  const homeManager = homeIsHuman ? null : getClubManager(homeClub);
  const awayManager = awayIsHuman ? null : getClubManager(awayClub);

  const homeTactic = homeUserCtx
    ? homeUserCtx.tactic
    : !homeIsHuman && isAwayUser && aiOverrideTactic
      ? aiOverrideTactic
      : homeClub.defaultTactic;
  const awayTactic = awayUserCtx
    ? awayUserCtx.tactic
    : !awayIsHuman && isHomeUser && aiOverrideTactic
      ? aiOverrideTactic
      : awayClub.defaultTactic;
  const homeFormation = homeUserCtx
    ? homeUserCtx.formation
    : !homeIsHuman && isAwayUser && aiOverrideFormation
      ? aiOverrideFormation
      : homeClub.formation;
  const awayFormation = awayUserCtx
    ? awayUserCtx.formation
    : !awayIsHuman && isHomeUser && aiOverrideFormation
      ? aiOverrideFormation
      : awayClub.formation;

  const homeHumanSynergyRoster =
    homeUserCtx && homeUserCtx.starters.length > 0
      ? applySlotSynergiesToStarters(
          homeUserCtx.starters,
          homeUserCtx.slotSynergies,
        )
      : [];
  const awayHumanSynergyRoster =
    awayUserCtx && awayUserCtx.starters.length > 0
      ? applySlotSynergiesToStarters(
          awayUserCtx.starters,
          awayUserCtx.slotSynergies,
        )
      : [];

  // v5.0: Apply identical 4-pillar player synergy + independent AI Manager style/OVR to AI clubs & HOF teams!
  const computeAiSynergyBundle = (
    club: Club,
    roster: Player[],
    formation: FormationId,
    tactic: TacticId,
    manager: ReturnType<typeof getClubManager>,
  ) => {
    const xi = roster.slice(0, 11);
    if (xi.length < 11) {
      const avg = (club.att + club.mid + club.def) / 3;
      const fallbackOrg =
        avg >= 86 ? 1.4 : avg >= 83 ? 1.0 : avg >= 80 ? 0.55 : avg >= 77 ? 0.25 : 0;
      const mgrDelta = (manager.ovr - 80) * 0.08;
      return {
        effectiveRoster: roster,
        att: club.att + fallbackOrg + mgrDelta,
        mid: club.mid + fallbackOrg + mgrDelta,
        def: club.def + fallbackOrg + mgrDelta,
      };
    }

    const compKey = userContext?.competition ?? 'league';
    const aiCacheKey = `${club.id}|${club.att}|${club.mid}|${club.def}|${formation}|${tactic}|${manager.ovr}|${manager.traitId}|${compKey}|${xi.map((p) => `${p.id}:${p.ovr}`).join(',')}`;
    const cachedLift = aiClubSynergyLiftCache.get(aiCacheKey);
    if (cachedLift !== undefined) {
      return {
        effectiveRoster: xi,
        att: club.att + cachedLift,
        mid: club.mid + cachedLift,
        def: club.def + cachedLift,
      };
    }

    const chem = calculateChemistry(formation, xi, tactic, manager.traitId, manager.ovr);

    // Historical HOF teams already carry full 4-pillar synergy + legendary manager OVR in club.att/mid/def
    // (100% identical to user team's calculateTeamRatings) -> apply slot synergies to roster without double-lifting base ratings!
    if (club.id.startsWith('hist-')) {
      return {
        effectiveRoster: applySlotSynergiesToStarters(xi, chem.slotSynergies),
        att: club.att,
        mid: club.mid,
        def: club.def,
      };
    }

    const avgSynBonus =
      Object.values(chem.slotSynergies).reduce((sum, s) => sum + s.totalBonus, 0) / 11;
    const chemOrgBonus =
      chem.chemistryOvrBonus < 0
        ? chem.chemistryOvrBonus * 0.45
        : Math.min(0.3, Math.max(0, chem.chemistryOvrBonus - avgSynBonus * 0.75));

    // Center AI synergy + manager OVR lift around league baseline (avgSyn ~1.8, manager OVR ~85)
    // so elite cohesive clubs & world-class managers (90+) gain +0.20~+0.32 while keeping league points rock-solid
    const relativeSynLift = clamp((avgSynBonus - 1.8) * 0.12, -0.14, 0.15);
    const mgrCoachingBonus = clamp((manager.ovr - 85) * 0.018, -0.15, 0.18);
    const uclPrestigeBonus =
      userContext?.competition === 'ucl' && (club.att + club.mid + club.def) / 3 >= 82
        ? 0.4
        : 0;
    const totalAiLift =
      relativeSynLift + chemOrgBonus * 0.15 + mgrCoachingBonus + uclPrestigeBonus;

    if (aiClubSynergyLiftCache.size >= MAX_AI_SYNERGY_CACHE) {
      aiClubSynergyLiftCache.clear();
    }
    aiClubSynergyLiftCache.set(aiCacheKey, totalAiLift);

    return {
      // Keep raw xi for individual/tactical evaluation so AI synergy isn't triple-counted
      effectiveRoster: xi,
      att: club.att + totalAiLift,
      mid: club.mid + totalAiLift,
      def: club.def + totalAiLift,
    };
  };

  const homeAiBundle =
    !homeIsHuman && homeManager
      ? computeAiSynergyBundle(homeClub, homeRoster, homeFormation, homeTactic, homeManager)
      : null;
  const awayAiBundle =
    !awayIsHuman && awayManager
      ? computeAiSynergyBundle(awayClub, awayRoster, awayFormation, awayTactic, awayManager)
      : null;

  const effectiveHomeRoster =
    homeIsHuman && homeHumanSynergyRoster.length > 0
      ? homeHumanSynergyRoster
      : homeAiBundle
        ? homeAiBundle.effectiveRoster
        : homeRoster;
  const effectiveAwayRoster =
    awayIsHuman && awayHumanSynergyRoster.length > 0
      ? awayHumanSynergyRoster
      : awayAiBundle
        ? awayAiBundle.effectiveRoster
        : awayRoster;

  const homeIndiv =
    effectiveHomeRoster.length > 0
      ? computeIndividualRosterImpact(effectiveHomeRoster)
      : null;
  const awayIndiv =
    effectiveAwayRoster.length > 0
      ? computeIndividualRosterImpact(effectiveAwayRoster)
      : null;

  const computeDirectMgrLift = (ctx?: UserMatchContext) =>
    ctx && !ctx.slotSynergies && ctx.managerTraitId && ctx.starters.length > 0
      ? (ctx.starters.reduce((sum, p) => {
          const ev = evaluateManagerPlayerSynergy(p, ctx.managerTraitId, 88);
          return sum + (ev.isMatch ? ev.bonus : 0);
        }, 0) /
          ctx.starters.length) *
        1.0
      : 0;

  const homeDirectMgrLift = computeDirectMgrLift(homeUserCtx);
  const awayDirectMgrLift = computeDirectMgrLift(awayUserCtx);

  const homeBase = homeUserCtx
    ? {
        att: homeUserCtx.ratings.effectiveAtt + homeDirectMgrLift,
        mid: homeUserCtx.ratings.effectiveMid + homeDirectMgrLift,
        def: homeUserCtx.ratings.effectiveDef + homeDirectMgrLift,
      }
    : {
        att: homeAiBundle ? homeAiBundle.att : homeClub.att,
        mid: homeAiBundle ? homeAiBundle.mid : homeClub.mid,
        def: homeAiBundle ? homeAiBundle.def : homeClub.def,
      };

  const awayBase = awayUserCtx
    ? {
        att: awayUserCtx.ratings.effectiveAtt + awayDirectMgrLift,
        mid: awayUserCtx.ratings.effectiveMid + awayDirectMgrLift,
        def: awayUserCtx.ratings.effectiveDef + awayDirectMgrLift,
      }
    : {
        att: awayAiBundle ? awayAiBundle.att : awayClub.att,
        mid: awayAiBundle ? awayAiBundle.mid : awayClub.mid,
        def: awayAiBundle ? awayAiBundle.def : awayClub.def,
      };

  const homeAvgOvr = (homeBase.att + homeBase.mid + homeBase.def) / 3;
  const awayAvgOvr = (awayBase.att + awayBase.mid + awayBase.def) / 3;

  // Unified v5.0 Tactical Matchup Engine (Manager + Formation + Tactic + Full XI Sub-Attributes & Styles)
  const hasFullRosters = effectiveHomeRoster.length >= 11 && effectiveAwayRoster.length >= 11;
  const unifiedMatchup: UnifiedTacticalMatchup | null = hasFullRosters
    ? evaluateUnifiedTacticalMatchup(
        {
          starters: effectiveHomeRoster.slice(0, 11),
          formation: homeFormation,
          tactic: homeTactic,
          managerTraitId: homeUserCtx ? (homeUserCtx.managerTraitId ?? null) : (homeManager?.traitId ?? null),
          managerOvr: homeIsHuman ? 86 : (homeManager?.ovr ?? 80),
        },
        {
          starters: effectiveAwayRoster.slice(0, 11),
          formation: awayFormation,
          tactic: awayTactic,
          managerTraitId: awayUserCtx ? (awayUserCtx.managerTraitId ?? null) : (awayManager?.traitId ?? null),
          managerOvr: awayIsHuman ? 86 : (awayManager?.ovr ?? 80),
        },
      )
    : null;

  // Fallback for synthetic roster-less unit tests
  const fallbackTacticHome = !unifiedMatchup
    ? evaluateTacticMatchup(homeTactic, awayTactic).delta +
      evaluateFormationMatchup(homeFormation, awayFormation).delta
    : 0;
  const fallbackPossHome = !unifiedMatchup
    ? evaluateFormationMatchup(homeFormation, awayFormation).possessionDelta
    : 0;

  const homeHumanTraitMod = homeUserCtx
    ? computeManagerTraitModifiers({
        traitId: homeUserCtx.managerTraitId,
        starters: homeUserCtx.starters,
        userTactic: homeUserCtx.tactic,
        userAvgOvr: homeAvgOvr,
        oppAvgOvr: awayAvgOvr,
        opponentRank: homeUserCtx.opponentRank,
        halftimeAdjusted: homeUserCtx.halftimeAdjusted,
        halftimeSubsMade: homeUserCtx.halftimeSubsMade,
        isSecondHalf,
      })
    : null;

  const awayHumanTraitMod = awayUserCtx
    ? computeManagerTraitModifiers({
        traitId: awayUserCtx.managerTraitId,
        starters: awayUserCtx.starters,
        userTactic: awayUserCtx.tactic,
        userAvgOvr: awayAvgOvr,
        oppAvgOvr: homeAvgOvr,
        opponentRank: awayUserCtx.opponentRank,
        halftimeAdjusted: awayUserCtx.halftimeAdjusted,
        halftimeSubsMade: awayUserCtx.halftimeSubsMade,
        isSecondHalf,
      })
    : null;

  // AI Manager tactical trait modifiers (scaled smoothly by manager OVR so top coaches leave a genuine footprint)
  const computeAiTraitScale = (mgrOvr: number) =>
    clamp(0.08 + ((mgrOvr - 75) / 20) * 0.12, 0.08, 0.22);

  const homeAiTraitMod =
    !homeIsHuman && homeManager && effectiveHomeRoster.length > 0
      ? computeManagerTraitModifiers({
          traitId: homeManager.traitId,
          starters: effectiveHomeRoster.slice(0, 11),
          userTactic: homeTactic,
          userAvgOvr: homeAvgOvr,
          oppAvgOvr: awayAvgOvr,
          halftimeAdjusted: isAwayUser && aiHalftimeAdjusted,
          isSecondHalf,
        })
      : null;
  const awayAiTraitMod =
    !awayIsHuman && awayManager && effectiveAwayRoster.length > 0
      ? computeManagerTraitModifiers({
          traitId: awayManager.traitId,
          starters: effectiveAwayRoster.slice(0, 11),
          userTactic: awayTactic,
          userAvgOvr: awayAvgOvr,
          oppAvgOvr: homeAvgOvr,
          halftimeAdjusted: isHomeUser && aiHalftimeAdjusted,
          isSecondHalf,
        })
      : null;

  const homeAiScale = homeManager ? computeAiTraitScale(homeManager.ovr) : 0;
  const awayAiScale = awayManager ? computeAiTraitScale(awayManager.ovr) : 0;

  // Stamina impact relative to baseline fatigue (computed symmetrically for both human players in PvP)
  const computeHumanStaminaMod = (
    ctx: UserMatchContext | undefined,
    oppClubForBaseline: Club,
    entryMap: Record<string, number>,
  ) => {
    if (!ctx || ctx.starters.length === 0) return null;
    const oppRawAvg = (oppClubForBaseline.att + oppClubForBaseline.mid + oppClubForBaseline.def) / 3;
    const impact = computeLineupStaminaImpact({
      starters: ctx.starters,
      formation: ctx.formation,
      tactic: ctx.tactic,
      minute: evalMinute,
      enteredAtMinute: entryMap,
    });
    const aiBaseline =
      evalMinute >= 60 ? (oppRawAvg >= 85 ? -0.75 : -0.95) : -0.15;
    return {
      attDelta: clamp((impact.attDelta - aiBaseline) * 0.65, -4.2, 1.8),
      midDelta: clamp((impact.midDelta - aiBaseline) * 0.65, -4.2, 1.8),
      defDelta: clamp((impact.defDelta - aiBaseline) * 0.65, -4.2, 1.8),
      freshSubXgBonus: isSecondHalf ? impact.freshSubXgBonus : 0,
      oppXgFatigueLeak:
        impact.avgStaminaPct < 48
          ? 0.22
          : impact.avgStaminaPct < 58
            ? 0.1
            : 0,
    };
  };

  const homeEntryMap = isHomeUser ? enteredAtMinute : opponentEnteredAtMinute;
  const awayEntryMap = isAwayUser ? enteredAtMinute : opponentEnteredAtMinute;
  const homeStaminaMod = computeHumanStaminaMod(homeUserCtx, awayClub, homeEntryMap);
  const awayStaminaMod = computeHumanStaminaMod(awayUserCtx, homeClub, awayEntryMap);

  // Halftime tactical adaptation boost in 2nd half (both user and opponent can reap tactical swings!)
  const homeHtSwingMult =
    isSecondHalf && homeUserCtx?.halftimeAdjusted
      ? 1.25 * (homeHumanTraitMod?.halftimeTacticMultiplier ?? 1.0)
      : !homeIsHuman && isAwayUser && isSecondHalf && aiHalftimeAdjusted
        ? 1.18 + ((homeManager?.ovr ?? 80) >= 88 ? 0.12 : 0)
        : 1.0;
  const awayHtSwingMult =
    isSecondHalf && awayUserCtx?.halftimeAdjusted
      ? 1.25 * (awayHumanTraitMod?.halftimeTacticMultiplier ?? 1.0)
      : !awayIsHuman && isHomeUser && isSecondHalf && aiHalftimeAdjusted
        ? 1.18 + ((awayManager?.ovr ?? 80) >= 88 ? 0.12 : 0)
        : 1.0;

  const homeAttTac = unifiedMatchup
    ? unifiedMatchup.attDelta * 0.78 * (unifiedMatchup.attDelta > 0 ? homeHtSwingMult : 1.0)
    : fallbackTacticHome * (fallbackTacticHome > 0 ? homeHtSwingMult : 1.0);
  const homeMidTac = unifiedMatchup
    ? unifiedMatchup.midDelta * 0.78 * (unifiedMatchup.midDelta > 0 ? homeHtSwingMult : 1.0)
    : fallbackTacticHome * (fallbackTacticHome > 0 ? homeHtSwingMult : 1.0);
  const homeDefTac = unifiedMatchup
    ? unifiedMatchup.defDelta * 0.78 * (unifiedMatchup.defDelta > 0 ? homeHtSwingMult : 1.0)
    : fallbackTacticHome * (fallbackTacticHome > 0 ? homeHtSwingMult : 1.0);

  const awayAttTac = unifiedMatchup
    ? -unifiedMatchup.attDelta * 0.78 * (-unifiedMatchup.attDelta > 0 ? awayHtSwingMult : 1.0)
    : -fallbackTacticHome * (-fallbackTacticHome > 0 ? awayHtSwingMult : 1.0);
  const awayMidTac = unifiedMatchup
    ? -unifiedMatchup.midDelta * 0.78 * (-unifiedMatchup.midDelta > 0 ? awayHtSwingMult : 1.0)
    : -fallbackTacticHome * (-fallbackTacticHome > 0 ? awayHtSwingMult : 1.0);
  const awayDefTac = unifiedMatchup
    ? -unifiedMatchup.defDelta * 0.78 * (-unifiedMatchup.defDelta > 0 ? awayHtSwingMult : 1.0)
    : -fallbackTacticHome * (-fallbackTacticHome > 0 ? awayHtSwingMult : 1.0);

  // Second-half score-state urgency (trailing team pushes harder; leading team defends deeper)
  const homeSecondHalfAttUrgency = isSecondHalf && scoreDiffHome < 0 ? 0.35 : 0;
  const homeSecondHalfDefUrgency = isSecondHalf && scoreDiffHome > 0 ? 0.3 : 0;
  const awaySecondHalfAttUrgency = isSecondHalf && scoreDiffHome > 0 ? 0.35 : 0;
  const awaySecondHalfDefUrgency = isSecondHalf && scoreDiffHome < 0 ? 0.3 : 0;

  const homeSubMod =
    effectiveHomeRoster.length > 0 && effectiveAwayRoster.length > 0
      ? computeTeamSubAttributeModifier({
          attackingRoster: effectiveHomeRoster,
          defendingRoster: effectiveAwayRoster,
          tactic: homeTactic,
          formation: homeFormation,
        })
      : { xgDelta: 0, possessionDelta: 0 };
  const awaySubMod =
    effectiveHomeRoster.length > 0 && effectiveAwayRoster.length > 0
      ? computeTeamSubAttributeModifier({
          attackingRoster: effectiveAwayRoster,
          defendingRoster: effectiveHomeRoster,
          tactic: awayTactic,
          formation: awayFormation,
        })
      : { xgDelta: 0, possessionDelta: 0 };

  const home: EffectiveTeamStrength = {
    att:
      homeBase.att +
      homeAttTac +
      homeSecondHalfAttUrgency +
      (homeIndiv ? homeIndiv.attDelta * 0.35 : 0) +
      (homeHumanTraitMod ? homeHumanTraitMod.attDelta : 0) +
      (!homeIsHuman && homeAiTraitMod ? homeAiTraitMod.attDelta * homeAiScale : 0) +
      (homeStaminaMod ? homeStaminaMod.attDelta : 0),
    mid:
      homeBase.mid +
      homeMidTac +
      (homeIndiv ? homeIndiv.midDelta * 0.35 : 0) +
      (homeHumanTraitMod ? homeHumanTraitMod.midDelta : 0) +
      (!homeIsHuman && homeAiTraitMod ? homeAiTraitMod.midDelta * homeAiScale : 0) +
      (homeStaminaMod ? homeStaminaMod.midDelta : 0),
    def:
      homeBase.def +
      homeDefTac +
      homeSecondHalfDefUrgency +
      (homeIndiv ? homeIndiv.defDelta * 0.35 : 0) +
      (homeHumanTraitMod ? homeHumanTraitMod.defDelta : 0) +
      (!homeIsHuman && homeAiTraitMod ? homeAiTraitMod.defDelta * homeAiScale : 0) +
      (homeStaminaMod ? homeStaminaMod.defDelta : 0),
    tacticBonus: Math.round((unifiedMatchup ? unifiedMatchup.netOvrEquivalent : fallbackTacticHome) * 10) / 10,
    xgBonus:
      (homeHumanTraitMod ? homeHumanTraitMod.xgBonus : 0) +
      (!homeIsHuman && homeAiTraitMod ? homeAiTraitMod.xgBonus * homeAiScale : 0) +
      (homeStaminaMod ? homeStaminaMod.freshSubXgBonus : 0) +
      (awayStaminaMod ? awayStaminaMod.oppXgFatigueLeak : 0) +
      (unifiedMatchup ? unifiedMatchup.xgBonus : 0) +
      homeSubMod.xgDelta,
    oppXgPenalty:
      (homeHumanTraitMod ? homeHumanTraitMod.oppXgPenalty : 0) +
      (!homeIsHuman && homeAiTraitMod ? homeAiTraitMod.oppXgPenalty * homeAiScale : 0) +
      (unifiedMatchup ? unifiedMatchup.oppXgPenalty : 0) +
      (homeIndiv ? homeIndiv.gkSaveMod * 0.28 : 0),
    possessionBonus:
      (homeHumanTraitMod ? homeHumanTraitMod.possessionBonus : 0) +
      (!homeIsHuman && homeAiTraitMod ? homeAiTraitMod.possessionBonus * homeAiScale : 0) +
      homeSubMod.possessionDelta,
  };

  const away: EffectiveTeamStrength = {
    att:
      awayBase.att +
      awayAttTac +
      awaySecondHalfAttUrgency +
      (awayIndiv ? awayIndiv.attDelta * 0.35 : 0) +
      (awayHumanTraitMod ? awayHumanTraitMod.attDelta : 0) +
      (!awayIsHuman && awayAiTraitMod ? awayAiTraitMod.attDelta * awayAiScale : 0) +
      (awayStaminaMod ? awayStaminaMod.attDelta : 0),
    mid:
      awayBase.mid +
      awayMidTac +
      (awayIndiv ? awayIndiv.midDelta * 0.35 : 0) +
      (awayHumanTraitMod ? awayHumanTraitMod.midDelta : 0) +
      (!awayIsHuman && awayAiTraitMod ? awayAiTraitMod.midDelta * awayAiScale : 0) +
      (awayStaminaMod ? awayStaminaMod.midDelta : 0),
    def:
      awayBase.def +
      awayDefTac +
      awaySecondHalfDefUrgency +
      (awayIndiv ? awayIndiv.defDelta * 0.35 : 0) +
      (awayHumanTraitMod ? awayHumanTraitMod.defDelta : 0) +
      (!awayIsHuman && awayAiTraitMod ? awayAiTraitMod.defDelta * awayAiScale : 0) +
      (awayStaminaMod ? awayStaminaMod.defDelta : 0),
    tacticBonus: Math.round(-(unifiedMatchup ? unifiedMatchup.netOvrEquivalent : fallbackTacticHome) * 10) / 10,
    xgBonus:
      (awayHumanTraitMod ? awayHumanTraitMod.xgBonus : 0) +
      (!awayIsHuman && awayAiTraitMod ? awayAiTraitMod.xgBonus * awayAiScale : 0) +
      (awayStaminaMod ? awayStaminaMod.freshSubXgBonus : 0) +
      (homeStaminaMod ? homeStaminaMod.oppXgFatigueLeak : 0) +
      (unifiedMatchup ? unifiedMatchup.awayXgBonus : 0) +
      awaySubMod.xgDelta,
    oppXgPenalty:
      (awayHumanTraitMod ? awayHumanTraitMod.oppXgPenalty : 0) +
      (!awayIsHuman && awayAiTraitMod ? awayAiTraitMod.oppXgPenalty * awayAiScale : 0) +
      (unifiedMatchup ? unifiedMatchup.awayOppXgPenalty : 0) +
      (awayIndiv ? awayIndiv.gkSaveMod * 0.28 : 0),
    possessionBonus:
      (awayHumanTraitMod ? awayHumanTraitMod.possessionBonus : 0) +
      (!awayIsHuman && awayAiTraitMod ? awayAiTraitMod.possessionBonus * awayAiScale : 0) +
      awaySubMod.possessionDelta,
  };

  const rawPoss =
    50.5 +
    (home.mid - away.mid) * 0.85 +
    (unifiedMatchup
      ? unifiedMatchup.possessionDelta
      : (TACTICS[homeTactic].possessionMod - TACTICS[awayTactic].possessionMod) +
        fallbackPossHome) +
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
    unifiedMatchup,
  };
}

/**
 * Calibrated Exponential Poisson expected goals model:
 * - Rewards tailored tactical counters, playstyle matchups, and individual synergy OVR.
 * - Keeps title races competitive against organized AI giants and tough away grounds.
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
    1.40 * Math.exp(homeExp) + home.xgBonus - away.oppXgPenalty,
    0.18,
    4.1,
  );
  const lambdaAway = clamp(
    1.11 * Math.exp(awayExp) + away.xgBonus - home.oppXgPenalty,
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
    wing_cross_header: 15.5,
    cutback_finish: 13,
    through_ball_1v1: 14,
    cut_inside_curler: 15.5,
    corner_kick: 14,
    direct_free_kick: 9.5,
    high_press_counter: 12,
    u_buildup_switch: 13,
    rebound_finish: 11.5,
    penalty_kick: allowPenalty ? 11.5 : 0,
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

  const adjustedWeights = resolveHighlightPatternWeightsWithSubAttributes({
    baseWeights: weights,
    roster,
    tactic,
    managerTraitId,
    allowPenalty,
  });

  const entries = (Object.entries(adjustedWeights) as [HighlightPatternId, number][])
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

function generateHalfGoalEvents(params: {
  goals: number;
  half: 1 | 2;
  club: Club;
  roster: Player[];
  defendingRoster?: Player[];
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
    defendingRoster,
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
    const attackRoute = mapPatternToAttackRoute({
      pattern,
      tactic,
      roster: activeRoster,
      rng,
    });
    const scorer = pickChainScorer({
      roster: activeRoster,
      route: attackRoute,
      freshSubIds: activeFreshIds,
      defendingRoster,
      rng,
    });
    const assister = pickChainAssister({
      roster: activeRoster,
      scorerId: scorer.id,
      route: attackRoute,
      rng,
    });
    const finishType = pickFinishType({
      route: attackRoute,
      scorer,
      rng,
    });
    const contestDefender = pickContestDefender(defendingRoster, rng);
    const scorerAttrs = getPlayerAttributes(scorer);
    const dribbleBeatCount =
      attackRoute === 'solo_dribble'
        ? scorerAttrs.dri >= 93 && rng() < 0.45
          ? 3
          : rng() < 0.72
            ? 2
            : 1
        : undefined;

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

    const desc = formatAttackChainDescription({
      pattern,
      attackRoute,
      finishType,
      outcome: 'goal',
      scorerName: scorer.name,
      assistName: assister?.name,
      secondaryShooterName: firstShooter?.name,
      contestDefenderName: contestDefender?.name,
      dribbleBeatCount,
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
          : attackRoute === 'long_range_cannon'
            ? Math.round((0.08 + rng() * 0.12) * 100) / 100
            : Math.round((0.26 + rng() * 0.27) * 100) / 100,
      highlightPattern: pattern,
      highlightOutcome: 'goal',
      attackRoute,
      finishType,
      dribbleBeatCount,
      contestDefenderName: contestDefender?.name,
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
  homeShots?: number;
  awayShots?: number;
  homeShotsOnTarget?: number;
  awayShotsOnTarget?: number;
  homeXg?: number;
  awayXg?: number;
  homeGoals?: number;
  awayGoals?: number;
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
    homeShots,
    awayShots,
    homeShotsOnTarget,
    awayShotsOnTarget,
    homeXg,
    awayXg,
    homeGoals,
    awayGoals,
    rng,
  } = params;
  const span = Math.max(4, maxMinute - minStart);
  const events: MatchEvent[] = [];

  const nonGoalOutcomes: HighlightOutcomeType[] = [
    'woodwork',
    'blocked',
    'near_miss',
  ];

  // Align highlight ownership and volume with actual shots & xG stats
  const effHomeShots = homeShots ?? 5;
  const effAwayShots = awayShots ?? 5;
  const effHomeXg = homeXg ?? 0.65;
  const effAwayXg = awayXg ?? 0.6;
  const homePressure =
    Math.max(0.4, effHomeShots) * 0.55 + Math.max(0.08, effHomeXg) * 4.5 * 0.45;
  const awayPressure =
    Math.max(0.4, effAwayShots) * 0.55 + Math.max(0.08, effAwayXg) * 4.5 * 0.45;
  const homeAttackShare = clamp(
    homePressure / Math.max(0.5, homePressure + awayPressure),
    0.14,
    0.86,
  );

  // 1) Stat-coherent attacking chances (woodwork / blocked / near_miss)
  const totalHalfShots = effHomeShots + effAwayShots;
  const chanceCount =
    span >= 22
      ? totalHalfShots >= 14
        ? 3
        : totalHalfShots >= 6
          ? 2
          : 1
      : 1;
  for (let cIdx = 0; cIdx < chanceCount; cIdx += 1) {
    const chanceIsHome = rng() < homeAttackShare;
    const cClub = chanceIsHome ? homeClub : awayClub;
    const cRoster = chanceIsHome ? homeRoster : awayRoster;
    const oppRoster = chanceIsHome ? awayRoster : homeRoster;
    const cTactic = chanceIsHome ? homeTactic : awayTactic;
    const cIsUser = chanceIsHome ? isHomeUser : isAwayUser;

    const pattern = pickHighlightPattern({
      tactic: cTactic,
      roster: cRoster,
      managerTraitId: cIsUser ? managerTraitId : null,
      allowPenalty: cIdx === 0 && rng() < 0.22,
      rng,
    });
    const attackRoute = mapPatternToAttackRoute({
      pattern,
      tactic: cTactic,
      roster: cRoster,
      rng,
    });
    const outcome: HighlightOutcomeType =
      pattern === 'penalty_kick'
        ? rng() < 0.5
          ? 'woodwork'
          : 'near_miss'
        : nonGoalOutcomes[Math.floor(rng() * nonGoalOutcomes.length)];
    const shooter = pickChainScorer({
      roster: cRoster,
      route: attackRoute,
      freshSubIds: new Set(),
      defendingRoster: oppRoster,
      rng,
    });
    const finishType = pickFinishType({
      route: attackRoute,
      scorer: shooter,
      rng,
    });
    const contestDefender = pickContestDefender(oppRoster, rng);
    const dribbleBeatCount =
      attackRoute === 'solo_dribble' ? (rng() < 0.65 ? 2 : 1) : undefined;
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
      attackRoute,
      finishType,
      dribbleBeatCount,
      contestDefenderName: contestDefender?.name,
      shotAngle,
      isPenalty: pattern === 'penalty_kick' ? true : undefined,
      pkDirection,
      description: formatAttackChainDescription({
        pattern,
        attackRoute,
        finishType,
        outcome,
        scorerName: shooter.name,
        contestDefenderName: contestDefender?.name,
        dribbleBeatCount,
        pkDirection,
        shotAngle,
      }),
    });
  }

  // 2) Goalkeeper super saves (aligned with actual saved shots-on-target + GK rating)
  if (span >= 8) {
    const homeGkImpact = computeIndividualRosterImpact(homeRoster).gkSaveMod;
    const awayGkImpact = computeIndividualRosterImpact(awayRoster).gkSaveMod;
    const awaySavedShots =
      awayShotsOnTarget !== undefined
        ? Math.max(0, awayShotsOnTarget - (awayGoals ?? 0))
        : 2;
    const homeSavedShots =
      homeShotsOnTarget !== undefined
        ? Math.max(0, homeShotsOnTarget - (homeGoals ?? 0))
        : 2;
    const totalSaved = awaySavedShots + homeSavedShots;
    const saveCount =
      totalSaved <= 0
        ? 0
        : span >= 22 && totalSaved >= 5
          ? 2
          : 1;

    for (let sIdx = 0; sIdx < saveCount; sIdx += 1) {
      const sotShareHomeDef =
        totalSaved > 0 ? awaySavedShots / totalSaved : 1 - homeAttackShare;
      const homeDefProb = clamp(
        sotShareHomeDef * 0.82 +
          (0.5 + (homeGkImpact - awayGkImpact) * 0.8) * 0.18,
        awaySavedShots === 0 ? 0.05 : 0.12,
        homeSavedShots === 0 ? 0.95 : 0.88,
      );
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
        allowPenalty: sIdx === 0 && rng() < 0.22,
        rng,
      });
      const attackRoute = mapPatternToAttackRoute({
        pattern,
        tactic: atkTactic,
        roster: atkRoster,
        rng,
      });
      const shooter = pickChainScorer({
        roster: atkRoster,
        route: attackRoute,
        freshSubIds: new Set(),
        defendingRoster: defRoster,
        rng,
      });
      const finishType = pickFinishType({
        route: attackRoute,
        scorer: shooter,
        rng,
      });
      const dribbleBeatCount =
        attackRoute === 'solo_dribble' ? (rng() < 0.65 ? 2 : 1) : undefined;
      const gk = defRoster.find((p) => p.position === 'GK');
      const shotAngle = pickShotAngleForPattern(pattern, rng);
      const pkDirection = pattern === 'penalty_kick' ? pickPkDirection(rng) : undefined;
      const minFrac =
        saveCount === 1
          ? 0.45 + rng() * 0.45
          : sIdx === 0
            ? 0.2 + rng() * 0.3
            : 0.58 + rng() * 0.34;

      events.push({
        minute: clamp(
          minStart + Math.floor(span * minFrac),
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
        attackRoute,
        finishType,
        dribbleBeatCount,
        shotAngle,
        isPenalty: pattern === 'penalty_kick' ? true : undefined,
        pkDirection,
        description: formatAttackChainDescription({
          pattern,
          attackRoute,
          finishType,
          outcome: 'save',
          scorerName: shooter.name,
          gkName: gk?.name,
          dribbleBeatCount,
          pkDirection,
          shotAngle,
        }),
      });
    }
  }

  // 2.5) Occasional VAR offside disallowed goal (~13% per half, weighted by attacking share)
  if (span >= 14 && rng() < 0.13) {
    const varIsHome = rng() < homeAttackShare;
    const vClub = varIsHome ? homeClub : awayClub;
    const vRoster = varIsHome ? homeRoster : awayRoster;
    const vDefRoster = varIsHome ? awayRoster : homeRoster;
    const vTactic = varIsHome ? homeTactic : awayTactic;
    const vIsUser = varIsHome ? isHomeUser : isAwayUser;
    const varPatterns: HighlightPatternId[] = [
      'through_ball_1v1',
      'u_buildup_switch',
      'wing_cross_header',
      'rebound_finish',
    ];
    const vPattern = varPatterns[Math.floor(rng() * varPatterns.length)];
    const vRoute = mapPatternToAttackRoute({
      pattern: vPattern,
      tactic: vTactic,
      roster: vRoster,
      rng,
    });
    const scorer = pickChainScorer({
      roster: vRoster,
      route: vRoute,
      freshSubIds: new Set(),
      defendingRoster: vDefRoster,
      rng,
    });
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
      attackRoute: vRoute,
      shotAngle: pickShotAngleForPattern(vPattern, rng),
      description: formatAttackChainDescription({
        pattern: vPattern,
        attackRoute: vRoute,
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

    const presentIds = new Set<string>();
    const allParticipants: {
      player: Player;
      subPosition: SubPosition;
      isSub: boolean;
      minutesPlayed: number;
    }[] = [];
    roster.forEach((p, idx) => {
      if (!p || presentIds.has(p.id)) return;
      presentIds.add(p.id);
      const isUser = teamId === userClubId;
      const isSub = isUser && subIdSet.has(p.id);
      const enterMin = isSub ? (subInMinute.get(p.id) ?? 45) : 0;
      const leaveMin =
        isUser && subOutMinute.has(p.id) ? subOutMinute.get(p.id)! : 90;
      allParticipants.push({
        player: p,
        subPosition: formationSlots[idx]?.subPosition ?? getPrimaryPosition(p),
        isSub,
        minutesPlayed: Math.max(1, leaveMin - enterMin),
      });
    });

    if (teamId === userClubId) {
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
  opponentUserContext?: UserMatchContext;
  rng?: () => number;
}): LiveHalftimeState {
  const {
    fixture,
    homeClub,
    awayClub,
    homeRoster,
    awayRoster,
    userContext,
    opponentUserContext,
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
    opponentUserContext,
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

  const homeTraitForGoals = isHomeUser
    ? userContext.managerTraitId
    : opponentUserContext?.managerTraitId ?? userContext.managerTraitId;
  const awayTraitForGoals = isAwayUser
    ? userContext.managerTraitId
    : opponentUserContext?.managerTraitId ?? userContext.managerTraitId;

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
      defendingRoster: awayRoster,
      tactic: resolved.homeTactic,
      managerTraitId: homeTraitForGoals,
      isUser: isHomeUser,
      rng,
    }),
    ...generateHalfGoalEvents({
      goals: awayGoals,
      half: 1,
      club: awayClub,
      roster: awayRoster,
      defendingRoster: homeRoster,
      tactic: resolved.awayTactic,
      managerTraitId: awayTraitForGoals,
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
      homeShots,
      awayShots,
      homeShotsOnTarget,
      awayShotsOnTarget,
      homeXg: h1Xg,
      awayXg: a1Xg,
      homeGoals,
      awayGoals,
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

  const oppClub1st = isHomeUser ? awayClub : homeClub;
  const oppManager1st = getClubManager(oppClub1st);
  const userZones = resolved.unifiedMatchup
    ? resolved.unifiedMatchup.zones.map((z) => ({
        label: z.label,
        delta: isHomeUser ? z.delta : -z.delta,
      }))
    : [];
  const weakestZone = [...userZones].sort((a, b) => a.delta - b.delta)[0];
  const strongestZone = [...userZones].sort((a, b) => b.delta - a.delta)[0];

  const hintData = buildHalftimeTacticalHint({
    userTactic: userContext.tactic,
    oppTactic: isHomeUser ? resolved.awayTactic : resolved.homeTactic,
    userFormation: userContext.formation,
    oppFormation: isHomeUser ? resolved.awayFormation : resolved.homeFormation,
    userGoals: isHomeUser ? homeGoals : awayGoals,
    oppGoals: isHomeUser ? awayGoals : homeGoals,
    userXg: isHomeUser ? h1Xg : a1Xg,
    oppXg: isHomeUser ? a1Xg : h1Xg,
    oppManagerName: oppManager1st.name,
    oppManagerOvr: oppManager1st.ovr,
    weakestZoneLabel: weakestZone && weakestZone.delta <= -3 ? weakestZone.label : undefined,
    strongestZoneLabel: strongestZone && strongestZone.delta >= 3 ? strongestZone.label : undefined,
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
 * Both user and opposing AI Manager actively read the 1st half and make simultaneous halftime moves!
 */
export function simulateSecondHalf(params: {
  halftime: LiveHalftimeState;
  homeClub: Club;
  awayClub: Club;
  homeRoster: Player[];
  awayRoster: Player[];
  userContext: UserMatchContext;
  opponentUserContext?: UserMatchContext;
  opponentHalftimeSubs?: { outPlayerName: string; inPlayerName: string }[];
  rng?: () => number;
}): MatchResult {
  const {
    halftime,
    homeClub,
    awayClub,
    homeRoster,
    awayRoster,
    userContext,
    opponentUserContext,
    opponentHalftimeSubs = [],
    rng = Math.random,
  } = params;

  const isHomeUser = halftime.isUserHome;
  const isAwayUser = !isHomeUser;
  const userClub = isHomeUser ? homeClub : awayClub;
  const oppClub = isHomeUser ? awayClub : homeClub;
  const oppFullRoster = isHomeUser ? awayRoster : homeRoster;
  const oppManager = getClubManager(oppClub);

  // Active AI Manager Halftime Counterplay (League + Cup + UCL + Dream Match)
  // In 1v1 PvP (opponentUserContext provided), bypass AI counterplay completely and honor the human opponent's choices!
  const aiStarters1st = oppFullRoster.slice(0, 11);
  const aiBench1st = oppFullRoster.slice(11);
  const aiHalftimeAdjustment: AiHalftimeAdjustment | null =
    !opponentUserContext && aiStarters1st.length >= 11
      ? decideAiHalftimeAdjustment({
          aiManager: oppManager,
          aiStarters: aiStarters1st,
          aiBench: aiBench1st,
          aiFormation: isHomeUser ? halftime.awayFormation : halftime.homeFormation,
          aiTactic: isHomeUser ? halftime.awayTactic : halftime.homeTactic,
          userStarters:
            userContext.firstHalfStarters && userContext.firstHalfStarters.length >= 11
              ? userContext.firstHalfStarters
              : userContext.starters,
          userFormation: halftime.userFormationAtKickoff,
          userTactic: halftime.userTacticAtKickoff,
          userManagerTraitId: userContext.managerTraitId,
          aiGoals: isHomeUser ? halftime.awayGoals : halftime.homeGoals,
          userGoals: isHomeUser ? halftime.homeGoals : halftime.awayGoals,
          aiXg: isHomeUser ? halftime.awayXg : halftime.homeXg,
          userXg: isHomeUser ? halftime.homeXg : halftime.awayXg,
          aiPossession: isHomeUser ? 100 - halftime.homePossession : halftime.homePossession,
          rng,
        })
      : null;

  const effectiveOppRoster2nd =
    opponentUserContext && opponentUserContext.starters.length > 0
      ? opponentUserContext.starters
      : aiHalftimeAdjustment?.updatedStarters && aiHalftimeAdjustment.updatedStarters.length >= 11
        ? aiHalftimeAdjustment.updatedStarters
        : oppFullRoster;

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

  const opponentEnteredAtMinute: Record<string, number> = {};
  const opponentFreshSubEntryMap = new Map<string, number>();
  for (const id of opponentUserContext?.halftimeSubIds ?? []) {
    opponentEnteredAtMinute[id] = 45;
    opponentFreshSubEntryMap.set(id, 45);
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

  const oppHalftimeAdjusted = opponentUserContext
    ? Boolean(
        opponentUserContext.halftimeAdjusted ||
          opponentUserContext.tactic !== (isHomeUser ? halftime.awayTactic : halftime.homeTactic) ||
          opponentUserContext.formation !== (isHomeUser ? halftime.awayFormation : halftime.homeFormation) ||
          (opponentUserContext.halftimeSubsMade ?? 0) > 0,
      )
    : false;

  const homeRoster2nd = isHomeUser ? effectiveUserEndingRoster : effectiveOppRoster2nd;
  const awayRoster2nd = isAwayUser ? effectiveUserEndingRoster : effectiveOppRoster2nd;

  const resolved = resolveMatchStrengths({
    homeClub,
    awayClub,
    homeRoster: homeRoster2nd,
    awayRoster: awayRoster2nd,
    isHomeUser,
    isAwayUser,
    userContext: {
      ...userContext,
      starters: effectiveUserEndingRoster,
      halftimeAdjusted,
      halftimeSubsMade: totalSubsMade,
    },
    opponentUserContext: opponentUserContext
      ? {
          ...opponentUserContext,
          halftimeAdjusted: oppHalftimeAdjusted,
        }
      : undefined,
    isSecondHalf: true,
    scoreDiffHome: halftime.homeGoals - halftime.awayGoals,
    evalMinute: 72,
    enteredAtMinute,
    opponentEnteredAtMinute,
    aiOverrideFormation: aiHalftimeAdjustment?.newFormation,
    aiOverrideTactic: aiHalftimeAdjustment?.newTactic,
    aiHalftimeAdjusted: Boolean(aiHalftimeAdjustment),
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

  if (opponentUserContext && oppHalftimeAdjusted) {
    const oppSubsCount = Math.max(
      opponentUserContext.halftimeSubsMade ?? 0,
      opponentHalftimeSubs.length,
    );
    secondHalfEvents.push({
      minute: 46,
      half: 2,
      type: 'sub',
      teamId: oppClub.id,
      teamShortName: oppClub.shortName,
      teamColor: oppClub.primaryColor,
      isUserTeam: false,
      description: `하프타임 전술 지시 (${opponentUserContext.formation} · ${TACTICS[opponentUserContext.tactic].name}${oppSubsCount > 0 ? ` · 교체 ${oppSubsCount}명` : ''})`,
    });
    for (const s of opponentHalftimeSubs) {
      secondHalfEvents.push({
        minute: 46,
        half: 2,
        type: 'sub',
        teamId: oppClub.id,
        teamShortName: oppClub.shortName,
        teamColor: oppClub.primaryColor,
        isUserTeam: false,
        subOutName: s.outPlayerName,
        subInName: s.inPlayerName,
        description: `🔄 ${oppClub.shortName} 교체 (46'): OUT ${s.outPlayerName} → IN ${s.inPlayerName}`,
      });
    }
  } else if (aiHalftimeAdjustment) {
    secondHalfEvents.push({
      minute: 46,
      half: 2,
      type: 'sub',
      teamId: oppClub.id,
      teamShortName: oppClub.shortName,
      teamColor: oppClub.primaryColor,
      isUserTeam: false,
      description: aiHalftimeAdjustment.headline,
    });
    for (const s of aiHalftimeAdjustment.subsMade) {
      secondHalfEvents.push({
        minute: 46,
        half: 2,
        type: 'sub',
        teamId: oppClub.id,
        teamShortName: oppClub.shortName,
        teamColor: oppClub.primaryColor,
        isUserTeam: false,
        subOutName: s.outPlayerName,
        subInName: s.inPlayerName,
        description: `🔄 ${oppClub.shortName} 교체 (46'): OUT ${s.outPlayerName} → IN ${s.inPlayerName}`,
      });
    }
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
      roster: homeRoster2nd,
      defendingRoster: awayRoster2nd,
      tactic: resolved.homeTactic,
      managerTraitId: isHomeUser
        ? userContext.managerTraitId
        : opponentUserContext?.managerTraitId ?? userContext.managerTraitId,
      isUser: isHomeUser,
      freshSubEntryMinute: isHomeUser
        ? freshSubEntryMap
        : opponentUserContext
          ? opponentFreshSubEntryMap
          : undefined,
      rosterAtMinute: isHomeUser ? userRosterAtMin : undefined,
      rng,
    }),
    ...generateHalfGoalEvents({
      goals: a2Goals,
      half: 2,
      club: awayClub,
      roster: awayRoster2nd,
      defendingRoster: homeRoster2nd,
      tactic: resolved.awayTactic,
      managerTraitId: isAwayUser
        ? userContext.managerTraitId
        : opponentUserContext?.managerTraitId ?? userContext.managerTraitId,
      isUser: isAwayUser,
      freshSubEntryMinute: isAwayUser
        ? freshSubEntryMap
        : opponentUserContext
          ? opponentFreshSubEntryMap
          : undefined,
      rosterAtMinute: isAwayUser ? userRosterAtMin : undefined,
      rng,
    }),
    ...generateHalfFlavorEvents({
      half: 2,
      homeClub,
      awayClub,
      homeRoster: homeRoster2nd,
      awayRoster: awayRoster2nd,
      homeTactic: resolved.homeTactic,
      awayTactic: resolved.awayTactic,
      isHomeUser,
      isAwayUser,
      managerTraitId: userContext.managerTraitId,
      homeShots: h2Shots,
      awayShots: a2Shots,
      homeShotsOnTarget: h2Sot,
      awayShotsOnTarget: a2Sot,
      homeXg: h2Xg,
      awayXg: a2Xg,
      homeGoals: h2Goals,
      awayGoals: a2Goals,
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
    homeRoster: homeRoster2nd,
    awayRoster: awayRoster2nd,
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
    ...(aiHalftimeAdjustment ? { aiHalftimeAdjustment } : {}),
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
      defendingRoster: awayRoster,
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
      defendingRoster: homeRoster,
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
      defendingRoster: awayRoster,
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
      defendingRoster: isAwayUser ? userEndingStarters : awayRoster,
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
      defendingRoster: homeRoster,
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
      defendingRoster: isHomeUser ? userEndingStarters : homeRoster,
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
  const sorted = [...outfield].sort((a, b) => {
    const aa = getPlayerAttributes(a);
    const bb = getPlayerAttributes(b);
    return bb.sho * 0.7 + b.ovr * 0.3 - (aa.sho * 0.7 + a.ovr * 0.3);
  });
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
  const homeGk = homeRoster.find((p) => p.position === 'GK');
  const awayGk = awayRoster.find((p) => p.position === 'GK');
  const homeGkAttrs = homeGk ? getPlayerAttributes(homeGk).gk : undefined;
  const awayGkAttrs = awayGk ? getPlayerAttributes(awayGk).gk : undefined;
  const homeGkOvr = homeGkAttrs
    ? homeGkAttrs.div * 0.4 + homeGkAttrs.ref * 0.4 + homeGkAttrs.pos * 0.2
    : (homeGk?.ovr ?? homeClub.def);
  const awayGkOvr = awayGkAttrs
    ? awayGkAttrs.div * 0.4 + awayGkAttrs.ref * 0.4 + awayGkAttrs.pos * 0.2
    : (awayGk?.ovr ?? awayClub.def);

  let homeScore = 0;
  let awayScore = 0;
  const kicks: PenaltyKickLog[] = [];

  const takeKick = (
    kicker: Player | undefined,
    fallbackName: string,
    gkOvr: number,
  ): { name: string; scored: boolean } => {
    const kickerSkill = kicker
      ? getPlayerAttributes(kicker).sho * 0.65 + kicker.ovr * 0.35
      : 78;
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
    homeRoster,
    awayRoster,
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
      defendingRoster: awayRoster,
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
      defendingRoster: homeRoster,
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

/**
 * Simulates Extra Time 1st Half (91'~105') only, pausing at 105' ET Halftime
 * so the manager can adjust tactics/formation or make an additional substitution before 106'~120'.
 */
export function simulateExtraTimeFirstHalf(params: {
  baseResult: MatchResult;
  homeClub: Club;
  awayClub: Club;
  homeRoster: Player[];
  awayRoster: Player[];
  userContext?: UserMatchContext;
  opponentUserContext?: UserMatchContext;
  extraTimeSubIds?: string[];
  opponentExtraTimeSubIds?: string[];
  rng?: () => number;
}): MatchResult {
  const {
    baseResult,
    homeClub,
    awayClub,
    homeRoster,
    awayRoster,
    userContext,
    opponentUserContext,
    extraTimeSubIds = [],
    opponentExtraTimeSubIds = [],
    rng = Math.random,
  } = params;

  const home90 = baseResult.homeGoals90 ?? baseResult.homeGoals;
  const away90 = baseResult.awayGoals90 ?? baseResult.awayGoals;

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

  const opponentEnteredAtMinute: Record<string, number> = {};
  for (const id of opponentUserContext?.halftimeSubIds ?? []) {
    opponentEnteredAtMinute[id] = 45;
  }
  for (const id of opponentExtraTimeSubIds) {
    opponentEnteredAtMinute[id] = 90;
  }

  const resolved = resolveMatchStrengths({
    homeClub,
    awayClub,
    homeRoster,
    awayRoster,
    isHomeUser,
    isAwayUser,
    userContext,
    opponentUserContext,
    isSecondHalf: true,
    evalMinute: 98,
    enteredAtMinute,
    opponentEnteredAtMinute,
  });

  const { lambdaHome, lambdaAway } = computeExpectedGoals(
    resolved.home,
    resolved.away,
  );

  // 15 minutes of ET 1st half (~0.155x of 90-min xG)
  const homeEt1Xg = Math.round(lambdaHome * 0.155 * 100) / 100;
  const awayEt1Xg = Math.round(lambdaAway * 0.155 * 100) / 100;

  const homeEt1Goals = samplePoisson(homeEt1Xg, rng);
  const awayEt1Goals = samplePoisson(awayEt1Xg, rng);

  const et1Events: MatchEvent[] = [
    {
      minute: 91,
      half: 2,
      type: 'kickoff',
      teamId: homeClub.id,
      description: '⏱️ 연장전 전반 킥오프! 체력 한계의 승부가 시작됩니다.',
    },
    ...generateHalfGoalEvents({
      goals: homeEt1Goals,
      half: 2,
      club: homeClub,
      roster: homeRoster,
      defendingRoster: awayRoster,
      tactic: resolved.homeTactic,
      managerTraitId: userContext?.managerTraitId,
      isUser: isHomeUser,
      minStart: 92,
      maxMinute: 104,
      freshSubEntryMinute: isHomeUser ? freshSubEntryMap : undefined,
      rng,
    }),
    ...generateHalfGoalEvents({
      goals: awayEt1Goals,
      half: 2,
      club: awayClub,
      roster: awayRoster,
      defendingRoster: homeRoster,
      tactic: resolved.awayTactic,
      managerTraitId: userContext?.managerTraitId,
      isUser: isAwayUser,
      minStart: 92,
      maxMinute: 104,
      freshSubEntryMinute: isAwayUser ? freshSubEntryMap : undefined,
      rng,
    }),
  ];

  const flavor1 = generateHalfFlavorEvents({
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
    minStart: 93,
    maxMinute: 104,
    rng,
  }).slice(0, 1);
  et1Events.push(...flavor1);

  et1Events.sort((a, b) => {
    if (a.minute !== b.minute) return a.minute - b.minute;
    if (a.type === 'kickoff') return -1;
    if (b.type === 'kickoff') return 1;
    return 0;
  });

  et1Events.push({
    minute: 105,
    half: 2,
    type: 'halftime',
    teamId: homeClub.id,
    description: `연장 전반 종료 (${homeClub.shortName} ${home90 + homeEt1Goals} - ${away90 + awayEt1Goals} ${awayClub.shortName}). 짧은 휴식 후 연장 후반으로 이어집니다.`,
  });

  return {
    ...baseResult,
    homeGoals: home90 + homeEt1Goals,
    awayGoals: away90 + awayEt1Goals,
    homeGoals90: home90,
    awayGoals90: away90,
    homeTactic: resolved.homeTactic,
    awayTactic: resolved.awayTactic,
    homeFormation: resolved.homeFormation,
    awayFormation: resolved.awayFormation,
    homeXg: Math.round((baseResult.homeXg + homeEt1Xg) * 100) / 100,
    awayXg: Math.round((baseResult.awayXg + awayEt1Xg) * 100) / 100,
    homeShots:
      baseResult.homeShots + Math.max(homeEt1Goals, Math.round(homeEt1Xg * 6)),
    awayShots:
      baseResult.awayShots + Math.max(awayEt1Goals, Math.round(awayEt1Xg * 6)),
    homeShotsOnTarget:
      baseResult.homeShotsOnTarget +
      Math.max(homeEt1Goals, Math.round(homeEt1Xg * 2.4)),
    awayShotsOnTarget:
      baseResult.awayShotsOnTarget +
      Math.max(awayEt1Goals, Math.round(awayEt1Xg * 2.4)),
    extraTime: {
      homeEtGoals: homeEt1Goals,
      awayEtGoals: awayEt1Goals,
      etEvents: et1Events,
      winnerTeamId: homeClub.id,
    },
    events: [
      ...baseResult.events.filter((e) => e.type !== 'fulltime'),
      ...et1Events,
    ],
  };
}

/**
 * Simulates Extra Time 2nd Half (106'~120') from a completed ET 1st Half result,
 * reflecting any 105' ET halftime tactics/formation/substitution changes, and runs Penalty Shootout if still tied.
 */
export function simulateExtraTimeSecondHalfAndPenalties(params: {
  et1Result: MatchResult;
  homeClub: Club;
  awayClub: Club;
  homeRoster: Player[];
  awayRoster: Player[];
  userContext?: UserMatchContext;
  opponentUserContext?: UserMatchContext;
  aggHomeBeforeMatch?: number;
  aggAwayBeforeMatch?: number;
  extraTimeSubIds?: string[];
  opponentExtraTimeSubIds?: string[];
  rng?: () => number;
}): MatchResult {
  const {
    et1Result,
    homeClub,
    awayClub,
    homeRoster,
    awayRoster,
    userContext,
    opponentUserContext,
    aggHomeBeforeMatch,
    aggAwayBeforeMatch,
    extraTimeSubIds = [],
    opponentExtraTimeSubIds = [],
    rng = Math.random,
  } = params;

  const home90 = et1Result.homeGoals90 ?? et1Result.homeGoals;
  const away90 = et1Result.awayGoals90 ?? et1Result.awayGoals;
  const homeEt1Goals = et1Result.extraTime?.homeEtGoals ?? 0;
  const awayEt1Goals = et1Result.extraTime?.awayEtGoals ?? 0;
  const et1Events = et1Result.extraTime?.etEvents ?? [];
  const aggBeforeH = aggHomeBeforeMatch ?? 0;
  const aggBeforeA = aggAwayBeforeMatch ?? 0;

  const isHomeUser = Boolean(
    userContext && et1Result.homeTeamId === userContext.userClubId,
  );
  const isAwayUser = Boolean(
    userContext && et1Result.awayTeamId === userContext.userClubId,
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
    if (enteredAtMinute[id] === undefined) {
      enteredAtMinute[id] = 105;
      freshSubEntryMap.set(id, 105);
    }
  }

  const opponentEnteredAtMinute: Record<string, number> = {};
  for (const id of opponentUserContext?.halftimeSubIds ?? []) {
    opponentEnteredAtMinute[id] = 45;
  }
  for (const id of opponentExtraTimeSubIds) {
    if (opponentEnteredAtMinute[id] === undefined) {
      opponentEnteredAtMinute[id] = 105;
    }
  }

  const scoreDiffHome =
    aggBeforeH + home90 + homeEt1Goals - (aggBeforeA + away90 + awayEt1Goals);

  const resolved = resolveMatchStrengths({
    homeClub,
    awayClub,
    homeRoster,
    awayRoster,
    isHomeUser,
    isAwayUser,
    userContext,
    opponentUserContext,
    isSecondHalf: true,
    scoreDiffHome,
    evalMinute: 114,
    enteredAtMinute,
    opponentEnteredAtMinute,
  });

  const { lambdaHome, lambdaAway } = computeExpectedGoals(
    resolved.home,
    resolved.away,
  );

  const homeEt2Xg = Math.round(lambdaHome * 0.16 * 100) / 100;
  const awayEt2Xg = Math.round(lambdaAway * 0.16 * 100) / 100;

  const homeEt2Goals = samplePoisson(homeEt2Xg, rng);
  const awayEt2Goals = samplePoisson(awayEt2Xg, rng);

  const et2Events: MatchEvent[] = [
    {
      minute: 106,
      half: 2,
      type: 'kickoff',
      teamId: awayClub.id,
      description: '⏱️ 연장전 후반 킥오프! 운명의 마지막 15분이 시작됩니다.',
    },
    ...generateHalfGoalEvents({
      goals: homeEt2Goals,
      half: 2,
      club: homeClub,
      roster: homeRoster,
      defendingRoster: awayRoster,
      tactic: resolved.homeTactic,
      managerTraitId: userContext?.managerTraitId,
      isUser: isHomeUser,
      minStart: 107,
      maxMinute: 119,
      freshSubEntryMinute: isHomeUser ? freshSubEntryMap : undefined,
      rng,
    }),
    ...generateHalfGoalEvents({
      goals: awayEt2Goals,
      half: 2,
      club: awayClub,
      roster: awayRoster,
      defendingRoster: homeRoster,
      tactic: resolved.awayTactic,
      managerTraitId: userContext?.managerTraitId,
      isUser: isAwayUser,
      minStart: 107,
      maxMinute: 119,
      freshSubEntryMinute: isAwayUser ? freshSubEntryMap : undefined,
      rng,
    }),
  ];

  const flavor2 = generateHalfFlavorEvents({
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
    minStart: 108,
    maxMinute: 119,
    rng,
  }).slice(0, 1);
  et2Events.push(...flavor2);

  et2Events.sort((a, b) => {
    if (a.minute !== b.minute) return a.minute - b.minute;
    if (a.type === 'kickoff') return -1;
    if (b.type === 'kickoff') return 1;
    return 0;
  });

  const totalEtEvents = [...et1Events, ...et2Events];
  const totalHomeEtGoals = homeEt1Goals + homeEt2Goals;
  const totalAwayEtGoals = awayEt1Goals + awayEt2Goals;
  const totalHomeGoals = home90 + totalHomeEtGoals;
  const totalAwayGoals = away90 + totalAwayEtGoals;
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

  totalEtEvents.push({
    minute: 120,
    half: 2,
    type: 'fulltime',
    teamId: winnerTeamId,
    description: penalties
      ? `연장전 종료 (${homeClub.shortName} ${totalHomeGoals} - ${totalAwayGoals} ${awayClub.shortName})! 운명의 승부차기(${penalties.homePenGoals}-${penalties.awayPenGoals})로 돌입합니다!`
      : `연장전 종료! ${homeClub.shortName} ${totalHomeGoals} - ${totalAwayGoals} ${awayClub.shortName} (${winnerTeamId === homeClub.id ? homeClub.shortName : awayClub.shortName} 승리!)`,
  });

  // Update player ratings across full ET (ET1 + ET2)
  const etGoalCounts = new Map<string, number>();
  const etAssistCounts = new Map<string, number>();
  for (const ev of totalEtEvents) {
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

  const updatedRatings: MatchPlayerRating[] = et1Result.playerRatings.map((pr) => {
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
        minutesPlayed: enteredAtMinute[subId] === 105 ? 15 : 30,
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

  const basePreEtEvents = et1Result.events.filter(
    (e) => e.minute <= 90 && e.type !== 'fulltime',
  );

  return {
    ...et1Result,
    homeGoals: totalHomeGoals,
    awayGoals: totalAwayGoals,
    homeGoals90: home90,
    awayGoals90: away90,
    homeTactic: resolved.homeTactic,
    awayTactic: resolved.awayTactic,
    homeFormation: resolved.homeFormation,
    awayFormation: resolved.awayFormation,
    homeXg: Math.round((et1Result.homeXg + homeEt2Xg) * 100) / 100,
    awayXg: Math.round((et1Result.awayXg + awayEt2Xg) * 100) / 100,
    homeShots:
      et1Result.homeShots + Math.max(homeEt2Goals, Math.round(homeEt2Xg * 6)),
    awayShots:
      et1Result.awayShots + Math.max(awayEt2Goals, Math.round(awayEt2Xg * 6)),
    homeShotsOnTarget:
      et1Result.homeShotsOnTarget +
      Math.max(homeEt2Goals, Math.round(homeEt2Xg * 2.4)),
    awayShotsOnTarget:
      et1Result.awayShotsOnTarget +
      Math.max(awayEt2Goals, Math.round(awayEt2Xg * 2.4)),
    extraTime: {
      homeEtGoals: totalHomeEtGoals,
      awayEtGoals: totalAwayEtGoals,
      etEvents: totalEtEvents,
      penalties,
      winnerTeamId,
    },
    events: [...basePreEtEvents, ...totalEtEvents],
    playerRatings: updatedRatings,
    momPlayerId: mom?.playerId ?? et1Result.momPlayerId,
    momPlayerName: mom?.playerName ?? et1Result.momPlayerName,
    momRating: mom?.rating ?? et1Result.momRating,
  };
}
