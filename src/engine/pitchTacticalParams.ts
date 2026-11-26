import { FORMATIONS } from '../data/formations';
import { evaluateManagerPlayerSynergy } from '../data/managerTraits';
import type { FormationId } from '../types/game';
import type { Player, PlayerAttributes, PlaystyleId, SubPosition } from '../types/player';
import { getPlayerAttributes } from './attributeEngine';
import { calculateChemistry } from './chemistryEngine';
import type {
  FormationPhaseMode,
  PitchSimTeamInput,
  PlayerAgentProfile,
  SimVec2,
  TeamTacticalDoctrine,
} from './pitchSimTypes';
import { computePlayerStaminaPct, getPlayerStaminaStat } from './staminaEngine';
import {
  evaluateUnifiedTacticalMatchup,
  FORMATION_PROFILES,
} from './unifiedTacticsEngine';

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * Converts a formation's vertical tactical pitch slots into horizontal match pitch base coordinates.
 * Home attacks left -> right (+x); Away attacks right -> left (-x).
 */
export function buildBaseFormationCoords(
  formationId: FormationId,
  isHome: boolean,
): SimVec2[] {
  const slots = (FORMATIONS[formationId] ?? FORMATIONS['4-3-3']).slots;
  return slots.map((slot) => {
    const depth = clamp((92 - slot.y) / 80, 0, 1);
    const nx = isHome ? 0.065 + depth * 0.44 : 0.935 - depth * 0.44;
    const ny = isHome
      ? 0.08 + (slot.x / 100) * 0.84
      : 0.92 - (slot.x / 100) * 0.84;
    return { x: nx, y: ny };
  });
}

/**
 * Computes the live stamina-based kinematic multiplier (speed & acceleration).
 * Matches staminaEngine tiers smoothly so tired starters visibly lose pace and fresh subs shine.
 */
export function getStaminaKinematicFactor(staminaPct: number): number {
  if (staminaPct >= 75) return 1.0;
  if (staminaPct >= 55) {
    return 0.92 + ((staminaPct - 55) / 20) * 0.08;
  }
  if (staminaPct >= 40) {
    return 0.84 + ((staminaPct - 40) / 15) * 0.08;
  }
  return clamp(0.74 + ((staminaPct - 15) / 25) * 0.1, 0.72, 0.84);
}

/**
 * Karun Singh-style 12x8 Expected Threat (xT) spatial grid (rows = width 0..7, cols = attacking depth 0..11).
 * Measures probability of scoring within the next few actions from each pitch zone.
 */
export const XT_GRID_12X8: readonly (readonly number[])[] = [
  [0.0063, 0.0078, 0.0094, 0.0112, 0.0138, 0.0169, 0.0208, 0.0257, 0.0321, 0.0406, 0.0528, 0.0645],
  [0.0074, 0.0090, 0.0108, 0.0128, 0.0156, 0.0191, 0.0236, 0.0298, 0.0384, 0.0524, 0.0752, 0.0985],
  [0.0084, 0.0102, 0.0121, 0.0144, 0.0176, 0.0216, 0.0272, 0.0352, 0.0478, 0.0715, 0.1180, 0.1780],
  [0.0090, 0.0109, 0.0129, 0.0154, 0.0189, 0.0233, 0.0295, 0.0392, 0.0558, 0.0885, 0.1650, 0.2580],
  [0.0090, 0.0109, 0.0129, 0.0154, 0.0189, 0.0233, 0.0295, 0.0392, 0.0558, 0.0885, 0.1650, 0.2580],
  [0.0084, 0.0102, 0.0121, 0.0144, 0.0176, 0.0216, 0.0272, 0.0352, 0.0478, 0.0715, 0.1180, 0.1780],
  [0.0074, 0.0090, 0.0108, 0.0128, 0.0156, 0.0191, 0.0236, 0.0298, 0.0384, 0.0524, 0.0752, 0.0985],
  [0.0063, 0.0078, 0.0094, 0.0112, 0.0138, 0.0169, 0.0208, 0.0257, 0.0321, 0.0406, 0.0528, 0.0645],
];

/**
 * Bilinearly samples Expected Threat (xT) in attacking coordinates for any normalized pitch coordinate.
 */
export function sampleExpectedThreat(isHome: boolean, x: number, y: number): number {
  const depth = clamp(isHome ? x : 1 - x, 0, 0.9999);
  const width = clamp(y, 0, 0.9999);
  const fx = depth * 11;
  const fy = width * 7;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(11, x0 + 1);
  const y1 = Math.min(7, y0 + 1);
  const tx = fx - x0;
  const ty = fy - y0;
  const v00 = XT_GRID_12X8[y0][x0];
  const v10 = XT_GRID_12X8[y0][x1];
  const v01 = XT_GRID_12X8[y1][x0];
  const v11 = XT_GRID_12X8[y1][x1];
  const top = v00 + (v10 - v00) * tx;
  const bot = v01 + (v11 - v01) * tx;
  return top + (bot - top) * ty;
}

export interface GameStateUrgency {
  timeFactor: number;
  effectiveDiff: number;
  attackUrgency: number;
  protectUrgency: number;
  cbBoxJoin: boolean;
}

/**
 * Continuous Game State Urgency curve (remaining time x effective goal difference).
 * Covers end-of-1st-half (40'~45'+), end-of-2nd-half (75'~90'+, max 82'+),
 * end-of-ET1 (100'~105'+), end-of-ET2 (112'~120'+, max 115'+), and 2-legged knockout aggregates.
 */
export function computeGameStateUrgency(params: {
  minute: number;
  scoreDiff: number;
  isKnockoutDecider?: boolean;
  ballDepth?: number;
}): GameStateUrgency {
  const { minute, scoreDiff, isKnockoutDecider = false, ballDepth = 0.5 } = params;

  let timeFactor = 0;
  let periodPushFloor = 0;

  if (minute > 90) {
    // Extra Time: ET1 closing push (100'~105'+) & ET2 all-out climax (112'~120'+, max 115'+)
    if (minute <= 105.5) {
      const baseEt1 = 0.36 + ((minute - 91) / 14) * 0.24;
      const et1CloseBoost =
        minute >= 100 ? clamp((minute - 99.5) / 5.5, 0, 1) * 0.28 : 0;
      timeFactor = clamp(baseEt1 + et1CloseBoost, 0, 0.88);
      if (minute >= 100 && (scoreDiff <= 0 || ballDepth >= 0.50)) {
        periodPushFloor = clamp((minute - 99.5) / 5.5, 0, 1) * (scoreDiff < 0 ? 0.68 : 0.42);
      }
    } else if (minute < 112) {
      timeFactor = 0.66 + ((minute - 105.5) / 6.5) * 0.22;
    } else if (minute < 115) {
      timeFactor = 0.88 + ((minute - 112) / 3) * 0.12;
      periodPushFloor = scoreDiff <= 0 ? 0.55 : 0;
    } else {
      timeFactor = 1.0;
      periodPushFloor = scoreDiff < 0 ? 0.95 : scoreDiff === 0 ? 0.64 : 0;
    }
  } else if (minute >= 39.5 && minute <= 46.5) {
    // End of 1st half (40'~45'+): stop sterile recycling and attempt a final attacking thrust
    const fhWindow = clamp((minute - 39.5) / 5.0, 0, 1);
    timeFactor = fhWindow * 0.60;
    if (scoreDiff < 0) {
      periodPushFloor = 0.26 + fhWindow * 0.34; // 0.26..0.60
    } else if (scoreDiff === 0 && ballDepth >= 0.48) {
      periodPushFloor = 0.20 + fhWindow * 0.24; // 0.20..0.44
    } else if (ballDepth >= 0.60) {
      periodPushFloor = 0.18 + fhWindow * 0.18;
    }
  } else if (minute >= 88) {
    timeFactor = 1.0;
  } else if (minute >= 82) {
    timeFactor = 0.78 + ((minute - 82) / 6) * 0.22;
  } else if (minute >= 75) {
    timeFactor = 0.42 + ((minute - 75) / 7) * 0.36;
  } else if (minute >= 65) {
    timeFactor = ((minute - 65) / 10) * 0.42;
  }
  timeFactor = clamp(timeFactor, 0, 1);

  let attackUrgency = 0;
  let protectUrgency = 0;

  if (scoreDiff < 0) {
    const deficitMult =
      scoreDiff === -1 ? 1.0 : scoreDiff === -2 ? 0.92 : 0.76;
    attackUrgency = clamp(Math.max(timeFactor * deficitMult, periodPushFloor), 0, 1);
  } else if (scoreDiff > 0) {
    const isEndOfFirstHalf = minute >= 39.5 && minute <= 46.5;
    if (isEndOfFirstHalf && periodPushFloor > 0) {
      // Attacking half late in 1st half: finish the move rather than turning back to own half
      attackUrgency = clamp(periodPushFloor, 0, 0.36);
    } else if (!isEndOfFirstHalf) {
      const leadMult = scoreDiff === 1 ? 1.0 : 0.75;
      protectUrgency = clamp(timeFactor * leadMult, 0, 1);
    }
  } else {
    // Tied score: push at end of 1H (if in opp half), late 2H knockout, and ET1/ET2 closing windows
    if (periodPushFloor > 0) {
      attackUrgency = clamp(periodPushFloor, 0, isKnockoutDecider ? 0.68 : 0.46);
    } else if (isKnockoutDecider && minute >= 80) {
      attackUrgency = clamp(timeFactor * 0.42, 0, 0.42);
    }
  }

  const cbBoxJoin =
    scoreDiff === -1 &&
    ((minute >= 85 && minute <= 90.5) || minute >= 115);

  return {
    timeFactor,
    effectiveDiff: scoreDiff,
    attackUrgency,
    protectUrgency,
    cbBoxJoin,
  };
}

/**
 * Applies live GameStateUrgency onto an unmodified base TeamTacticalDoctrine so
 * trailing teams stop recycling and push all-out late, while leading teams manage the game.
 */
export function applyGameStateUrgencyToDoctrine(
  base: TeamTacticalDoctrine,
  urgency: GameStateUrgency,
): TeamTacticalDoctrine {
  const { attackUrgency, protectUrgency, cbBoxJoin } = urgency;
  if (attackUrgency <= 0.001 && protectUrgency <= 0.001 && !cbBoxJoin) {
    return {
      ...base,
      attackUrgency: 0,
      protectUrgency: 0,
      cbBoxJoin: false,
    };
  }

  let buildUpPatience = base.buildUpPatience;
  let tempo = base.tempo;
  let passLengthBias = base.passLengthBias;
  let defensiveLineOffset = base.defensiveLineOffset;
  let pressTriggerRadius = base.pressTriggerRadius;
  let pressersCount = base.pressersCount;
  let defensiveCompactness = base.defensiveCompactness;
  let counterSprintUrgency = base.counterSprintUrgency;
  let flankBias = base.flankBias;

  if (attackUrgency > 0) {
    // Late trailing push: slash back/lateral recycling, raise line & press immediately
    buildUpPatience -= 0.62 * attackUrgency;
    tempo += 0.30 * attackUrgency;
    passLengthBias += 0.55 * attackUrgency;
    defensiveLineOffset += 0.085 * attackUrgency;
    pressTriggerRadius += 0.10 * attackUrgency;
    if (attackUrgency >= 0.55) {
      pressersCount = 3;
    }
    counterSprintUrgency += 0.35 * attackUrgency;
    flankBias += 0.12 * attackUrgency;
  } else if (protectUrgency > 0) {
    // Late lead management: control-oriented teams retain ball; direct/press teams drop into compact low block
    const isControlStyle =
      base.tactic === 'possession' || base.tactic === 'balanced';
    if (isControlStyle) {
      buildUpPatience += 0.20 * protectUrgency;
      tempo -= 0.12 * protectUrgency;
      defensiveLineOffset -= 0.045 * protectUrgency;
      defensiveCompactness -= 0.06 * protectUrgency;
    } else {
      buildUpPatience += 0.08 * protectUrgency;
      defensiveLineOffset -= 0.075 * protectUrgency;
      defensiveCompactness -= 0.10 * protectUrgency;
      pressTriggerRadius -= 0.04 * protectUrgency;
    }
  }

  return {
    ...base,
    buildUpPatience: clamp(buildUpPatience, 0.08, 0.98),
    tempo: clamp(tempo, 0.68, 1.55),
    passLengthBias: clamp(passLengthBias, -0.95, 0.98),
    defensiveLineOffset: clamp(defensiveLineOffset, -0.14, 0.16),
    pressTriggerRadius: clamp(pressTriggerRadius, 0.12, 0.44),
    pressersCount: Math.max(1, Math.min(3, pressersCount)),
    defensiveCompactness: clamp(defensiveCompactness, 0.64, 1.08),
    counterSprintUrgency: clamp(counterSprintUrgency, 0.18, 0.99),
    flankBias: clamp(flankBias, 0.18, 0.96),
    attackUrgency,
    protectUrgency,
    cbBoxJoin,
  };
}

/**
 * Synthesizes complete TeamTacticalDoctrine from:
 *  Layer 1 (Formation structure) + Layer 2 (Team Tactic & 5-Zone Matchup) +
 *  Layer 3 (Manager OVR & all 14 Manager Traits) + Layer 5 (Team Chemistry & Live Urgency).
 */
export function buildTeamTacticalDoctrine(params: {
  my: PitchSimTeamInput;
  opp: PitchSimTeamInput;
  minute: number;
  scoreDiff: number; // myGoals - oppGoals (including aggregate in 2nd-leg KO)
  isBigMatch: boolean;
  isKnockoutDecider?: boolean;
  applyUrgency?: boolean;
}): TeamTacticalDoctrine {
  const {
    my,
    opp,
    minute,
    scoreDiff,
    isBigMatch,
    isKnockoutDecider = false,
    applyUrgency = true,
  } = params;
  const fProf = FORMATION_PROFILES[my.formation] ?? FORMATION_PROFILES['4-3-3'];
  const myFilled = my.starters.filter((p): p is Player => p !== null);
  const oppFilled = opp.starters.filter((p): p is Player => p !== null);

  const myAvgOvr =
    myFilled.length > 0
      ? myFilled.reduce((s, p) => s + p.ovr, 0) / myFilled.length
      : 82;
  const oppAvgOvr =
    oppFilled.length > 0
      ? oppFilled.reduce((s, p) => s + p.ovr, 0) / oppFilled.length
      : 82;

  const myChem =
    my.chemistry ??
    calculateChemistry(
      my.formation,
      my.starters,
      my.tactic,
      my.managerTraitId,
      my.managerOvr,
    );

  const matchup =
    myFilled.length >= 11 && oppFilled.length >= 11
      ? evaluateUnifiedTacticalMatchup(
          {
            starters: myFilled.slice(0, 11),
            formation: my.formation,
            tactic: my.tactic,
            managerTraitId: my.managerTraitId,
            managerOvr: my.managerOvr,
          },
          {
            starters: oppFilled.slice(0, 11),
            formation: opp.formation,
            tactic: opp.tactic,
            managerTraitId: opp.managerTraitId,
            managerOvr: opp.managerOvr,
          },
        )
      : null;

  const zoneMap = new Map(
    (matchup?.zones ?? []).map((z) => [z.id, clamp(z.delta / 18, -1, 1)]),
  );

  // Layer 1 + 2: Base tactic doctrine values
  let buildUpPatience = 0.56;
  let tempo = 1.0;
  let passLengthBias = 0.0;
  let defensiveLineOffset = ((fProf.lineHeight - 62) / 100) * 0.16;
  let pressTriggerRadius = 0.21 + ((fProf.pressTrapShape - 78) / 100) * 0.09;
  let pressersCount = 2;
  let attackWidthScale = 0.96 + ((fProf.flankWidth - 80) / 100) * 0.22;
  let defensiveCompactness = 0.94 - ((fProf.boxDefenseDensity - 78) / 100) * 0.14;
  let flankBias = clamp(0.45 + (fProf.flankWidth - 80) * 0.012, 0.22, 0.82);
  let centralBias = clamp(0.48 + (fProf.midfieldDensity - 80) * 0.012, 0.25, 0.85);
  let thirdManFreq = 0.44;
  let counterSprintUrgency = 0.45;
  let gkBuildupSupport = 0.35;
  let positionSwitching = 0.22;
  let lineDiscipline = 0.58;
  let starFocus = 0.30;
  let freshSubBoost = 0.35;
  let composure = 0.52 + ((my.managerOvr - 80) / 25) * 0.22;
  let setPieceFocus = 0.35;

  switch (my.tactic) {
    case 'possession':
      buildUpPatience = 0.86;
      tempo = 0.88;
      passLengthBias = -0.62;
      defensiveLineOffset += 0.032;
      pressTriggerRadius += 0.025;
      pressersCount = 2;
      attackWidthScale *= 1.03;
      defensiveCompactness *= 0.95;
      centralBias += 0.18;
      thirdManFreq = 0.76;
      counterSprintUrgency = 0.28;
      gkBuildupSupport = 0.82;
      lineDiscipline += 0.08;
      composure += 0.12;
      break;
    case 'gegenpressing':
      buildUpPatience = 0.30;
      tempo = 1.24;
      passLengthBias = 0.26;
      defensiveLineOffset += 0.068;
      pressTriggerRadius += 0.095;
      pressersCount = 3;
      attackWidthScale *= 0.95;
      defensiveCompactness *= 0.88;
      centralBias += 0.08;
      thirdManFreq = 0.58;
      counterSprintUrgency = 0.78;
      gkBuildupSupport = 0.62;
      break;
    case 'counter':
      buildUpPatience = 0.22;
      tempo = 1.18;
      passLengthBias = 0.76;
      defensiveLineOffset -= 0.072;
      pressTriggerRadius -= 0.055;
      pressersCount = 1;
      attackWidthScale *= 0.94;
      defensiveCompactness *= 0.78;
      flankBias += 0.05;
      thirdManFreq = 0.42;
      counterSprintUrgency = 0.94;
      gkBuildupSupport = 0.14;
      lineDiscipline += 0.16;
      break;
    case 'wingplay':
      buildUpPatience = 0.54;
      tempo = 1.04;
      passLengthBias = 0.28;
      defensiveLineOffset += 0.008;
      pressTriggerRadius += 0.005;
      pressersCount = 2;
      attackWidthScale *= 1.14;
      defensiveCompactness *= 0.97;
      flankBias += 0.34;
      centralBias -= 0.08;
      thirdManFreq = 0.54;
      counterSprintUrgency = 0.58;
      gkBuildupSupport = 0.36;
      setPieceFocus += 0.14;
      break;
    case 'balanced':
    default:
      buildUpPatience = 0.58;
      tempo = 1.0;
      passLengthBias = 0.0;
      pressersCount = 2;
      thirdManFreq = 0.52;
      counterSprintUrgency = 0.50;
      gkBuildupSupport = 0.42;
      lineDiscipline += 0.06;
      break;
  }

  // Layer 3: Manager OVR coaching precision + ALL 14 Manager Traits (zero omissions!)
  const mgrOvrNorm = clamp((my.managerOvr - 72) / 26, 0, 1);
  thirdManFreq += mgrOvrNorm * 0.12;
  lineDiscipline += mgrOvrNorm * 0.14;
  composure += mgrOvrNorm * 0.12;

  const isSecondHalf = minute >= 45;
  switch (my.managerTraitId) {
    case 'tiki_taka':
      buildUpPatience += 0.16;
      passLengthBias -= 0.28;
      thirdManFreq += 0.22;
      centralBias += 0.14;
      gkBuildupSupport += 0.22;
      composure += 0.12;
      break;
    case 'gegenpress_guru':
      defensiveLineOffset += 0.042;
      pressTriggerRadius += 0.065;
      pressersCount = 3;
      tempo += 0.14;
      counterSprintUrgency += 0.18;
      break;
    case 'catenaccio':
      defensiveLineOffset -= 0.052;
      defensiveCompactness -= 0.12;
      lineDiscipline += 0.24;
      counterSprintUrgency += 0.24;
      passLengthBias += 0.26;
      buildUpPatience -= 0.12;
      break;
    case 'wing_bomber':
      attackWidthScale += 0.12;
      flankBias += 0.28;
      passLengthBias += 0.14;
      thirdManFreq += 0.10;
      break;
    case 'halftime_wizard':
      if (isSecondHalf) {
        const boost = my.halftimeAdjusted ? 1.0 : 0.55;
        const trailingBoost = scoreDiff < 0 ? 0.12 : 0;
        tempo += 0.16 * boost;
        thirdManFreq += 0.20 * boost;
        counterSprintUrgency += (0.16 + trailingBoost) * boost;
        defensiveLineOffset += (scoreDiff < 0 ? 0.038 : 0.012) * boost;
        composure += 0.14 * boost;
      } else {
        composure += 0.06;
        lineDiscipline += 0.06;
      }
      break;
    case 'big_game_hunter': {
      const bigActive = isBigMatch || oppAvgOvr >= 84;
      const mult = bigActive ? 1.0 : 0.4;
      composure += 0.24 * mult;
      lineDiscipline += 0.16 * mult;
      thirdManFreq += 0.14 * mult;
      counterSprintUrgency += 0.14 * mult;
      pressTriggerRadius += 0.03 * mult;
      break;
    }
    case 'set_piece_master':
      setPieceFocus += 0.42;
      flankBias += 0.14;
      lineDiscipline += 0.12;
      break;
    case 'underdog_killer': {
      const isUnderdog = oppAvgOvr >= myAvgOvr;
      const mult = isUnderdog ? 1.0 : 0.45;
      defensiveCompactness -= 0.10 * mult;
      lineDiscipline += 0.20 * mult;
      counterSprintUrgency += 0.30 * mult;
      passLengthBias += 0.20 * mult;
      break;
    }
    case 'total_football':
      positionSwitching += 0.58;
      thirdManFreq += 0.22;
      buildUpPatience += 0.08;
      centralBias += 0.10;
      flankBias += 0.08;
      break;
    case 'galactico_manager':
      starFocus += 0.55;
      composure += 0.14;
      tempo += 0.06;
      break;
    case 'direct_football':
      buildUpPatience -= 0.26;
      passLengthBias += 0.40;
      tempo += 0.18;
      counterSprintUrgency += 0.28;
      break;
    case 'defensive_architect':
      defensiveLineOffset -= 0.025;
      defensiveCompactness -= 0.11;
      lineDiscipline += 0.32;
      pressTriggerRadius += 0.02;
      composure += 0.10;
      break;
    case 'midfield_maestro':
      buildUpPatience += 0.14;
      centralBias += 0.26;
      thirdManFreq += 0.18;
      passLengthBias -= 0.18;
      composure += 0.12;
      break;
    case 'super_sub':
      freshSubBoost += 0.58;
      if (isSecondHalf) {
        tempo += 0.10;
        counterSprintUrgency += 0.12;
      }
      break;
    default:
      break;
  }

  // Layer 5: Team Chemistry & Live Score Urgency
  const chemNorm = clamp(myChem.total / 100, 0, 1);
  thirdManFreq += (chemNorm - 0.5) * 0.18;
  lineDiscipline += (chemNorm - 0.5) * 0.14;
  composure += (chemNorm - 0.5) * 0.14;

  const baseDoctrine: TeamTacticalDoctrine = {
    formation: my.formation,
    tactic: my.tactic,
    managerTraitId: my.managerTraitId,
    managerOvr: my.managerOvr,
    teamChemistry: myChem.total,
    tacticalFit: matchup?.myProfile.tacticalFit ?? 80,
    buildUpPatience: clamp(buildUpPatience, 0.12, 0.96),
    tempo: clamp(tempo, 0.72, 1.42),
    passLengthBias: clamp(passLengthBias, -0.95, 0.95),
    defensiveLineOffset: clamp(defensiveLineOffset, -0.11, 0.11),
    pressTriggerRadius: clamp(pressTriggerRadius, 0.14, 0.36),
    pressersCount: Math.max(1, Math.min(3, pressersCount)),
    attackWidthScale: clamp(attackWidthScale, 0.78, 1.18),
    defensiveCompactness: clamp(defensiveCompactness, 0.70, 1.08),
    flankBias: clamp(flankBias, 0.18, 0.95),
    centralBias: clamp(centralBias, 0.20, 0.95),
    thirdManFreq: clamp(thirdManFreq, 0.18, 0.95),
    counterSprintUrgency: clamp(counterSprintUrgency, 0.18, 0.98),
    gkBuildupSupport: clamp(gkBuildupSupport, 0.08, 0.95),
    positionSwitching: clamp(positionSwitching, 0.10, 0.92),
    lineDiscipline: clamp(lineDiscipline, 0.30, 0.98),
    starFocus: clamp(starFocus, 0.15, 0.95),
    freshSubBoost: clamp(freshSubBoost, 0.20, 0.98),
    composure: clamp(composure, 0.25, 0.98),
    setPieceFocus: clamp(setPieceFocus, 0.20, 0.95),
    zoneMidEdge: zoneMap.get('midfield') ?? 0,
    zoneFlankEdge: zoneMap.get('flanks') ?? 0,
    zoneTransitionEdge: zoneMap.get('transition') ?? 0,
    zoneBoxEdge: zoneMap.get('box') ?? 0,
    zonePressEdge: zoneMap.get('pressing') ?? 0,
    attackUrgency: 0,
    protectUrgency: 0,
    cbBoxJoin: false,
  };

  if (!applyUrgency) {
    return baseDoctrine;
  }

  return applyGameStateUrgencyToDoctrine(
    baseDoctrine,
    computeGameStateUrgency({ minute, scoreDiff, isKnockoutDecider }),
  );
}

/**
 * Synthesizes PlayerAgentProfile for all 11 starters mapping:
 *  - Layer 4: ALL 14 Playstyles (zero omissions)
 *  - Layer 5: ALL 7 Field + 5 GK Sub-Attributes, Pair Chemistry Matrix, Live Stamina & Fresh-Sub Status.
 */
export function buildTeamAgentProfiles(
  team: PitchSimTeamInput,
  minute: number,
): PlayerAgentProfile[] {
  const formCfg = FORMATIONS[team.formation] ?? FORMATIONS['4-3-3'];
  const chem =
    team.chemistry ??
    calculateChemistry(
      team.formation,
      team.starters,
      team.tactic,
      team.managerTraitId,
      team.managerOvr,
    );

  // Build 11x11 symmetric pair synergy strength matrix (0..4 lines per adjacent link)
  const synergyMatrix: number[][] = Array.from({ length: 11 }, () =>
    Array.from({ length: 11 }, () => 0),
  );
  for (const link of chem.links) {
    if (
      link.fromIndex >= 0 &&
      link.fromIndex < 11 &&
      link.toIndex >= 0 &&
      link.toIndex < 11 &&
      link.score > 0
    ) {
      synergyMatrix[link.fromIndex][link.toIndex] = link.score;
      synergyMatrix[link.toIndex][link.fromIndex] = link.score;
    }
  }

  return formCfg.slots.map((slot, slotIndex) => {
    const p = team.starters[slotIndex] ?? null;
    const playstyles: PlaystyleId[] = p?.playstyles ?? [];
    const ps = new Set<PlaystyleId>(playstyles);
    const attrs: PlayerAttributes = p
      ? getPlayerAttributes(p)
      : {
          sho: 75,
          pas: 75,
          cro: 75,
          dri: 75,
          aer: 75,
          def: 75,
          phy: 75,
          gk: slotIndex === 0 ? { div: 78, han: 76, ref: 78, kic: 74, pos: 77 } : undefined,
        };
    const ovr = p?.ovr ?? 78;
    const staminaStat = getPlayerStaminaStat(p);
    const enteredAt = p ? (team.enteredAtMinute?.[p.id] ?? 0) : 0;
    const isFreshSub = enteredAt >= 45 && minute >= enteredAt && slotIndex !== 0;
    const mgrSynergy = p
      ? evaluateManagerPlayerSynergy(p, team.managerTraitId, team.managerOvr).isMatch
      : false;

    // Kinematics directly from PHY & DRI (normalized pitch units / sec)
    const phyNorm = clamp((attrs.phy - 55) / 44, 0, 1);
    const driNorm = clamp((attrs.dri - 55) / 44, 0, 1);
    const baseMaxSpeed =
      slotIndex === 0
        ? 0.088 + phyNorm * 0.022
        : 0.105 + phyNorm * 0.048 + (ps.has('line_breaker') ? 0.012 : 0) + (ps.has('classic_winger') ? 0.008 : 0);
    const baseMaxAccel =
      slotIndex === 0
        ? 0.24 + phyNorm * 0.08
        : 0.25 + phyNorm * 0.14 + driNorm * 0.06;
    const baseTurnRate = 4.6 + driNorm * 4.4; // rad/s

    // ALL 14 Playstyles explicitly mapped to distinct behavioral weights!
    const sub: SubPosition = slot.subPosition;
    const isWide = sub === 'LW' || sub === 'RW' || sub === 'LM' || sub === 'RM';
    const isFb = sub === 'LB' || sub === 'RB' || sub === 'LWB' || sub === 'RWB';

    const runBehindBias = clamp(
      (sub === 'ST' ? 0.50 : isWide ? 0.42 : 0.18) +
        (ps.has('line_breaker') ? 0.46 : 0) +
        (ps.has('poacher') ? 0.14 : 0) +
        (ps.has('classic_winger') ? 0.16 : 0) +
        (ps.has('complete_forward') ? 0.12 : 0) +
        (attrs.phy - 78) * 0.006,
      0.05,
      1.0,
    );
    const dropToLinkBias = clamp(
      (sub === 'CAM' || sub === 'CM' ? 0.52 : sub === 'CDM' ? 0.65 : 0.20) +
        (ps.has('deep_playmaker') ? 0.44 : 0) +
        (ps.has('playmaker_10') ? 0.36 : 0) +
        (ps.has('complete_forward') ? 0.34 : 0) +
        (ps.has('ball_playing_cb') ? 0.20 : 0) -
        (ps.has('poacher') ? 0.25 : 0) -
        (ps.has('line_breaker') ? 0.18 : 0),
      0.04,
      1.0,
    );
    const boxCrashBias = clamp(
      (sub === 'ST' ? 0.62 : sub === 'CAM' ? 0.38 : isWide ? 0.42 : 0.15) +
        (ps.has('poacher') ? 0.44 : 0) +
        (ps.has('complete_forward') ? 0.30 : 0) +
        (ps.has('box_to_box') ? 0.34 : 0) +
        (ps.has('inverted_winger') ? 0.22 : 0) +
        (attrs.aer - 78) * 0.005,
      0.05,
      1.0,
    );
    const cutInsideBias = clamp(
      (isWide ? 0.35 : 0.10) +
        (ps.has('inverted_winger') ? 0.55 : 0) +
        (ps.has('playmaker_10') ? 0.22 : 0) -
        (ps.has('classic_winger') ? 0.35 : 0),
      0.0,
      1.0,
    );
    const hugTouchlineBias = clamp(
      (isWide ? 0.38 : isFb ? 0.42 : 0.05) +
        (ps.has('classic_winger') ? 0.52 : 0) +
        (ps.has('attacking_wingback') ? 0.40 : 0) -
        (ps.has('inverted_winger') ? 0.30 : 0),
      0.0,
      1.0,
    );
    const overlapBias = clamp(
      (isFb ? 0.44 : 0.05) +
        (ps.has('attacking_wingback') ? 0.48 : 0) +
        (ps.has('box_to_box') ? 0.18 : 0) +
        (attrs.cro - 76) * 0.006,
      0.0,
      1.0,
    );
    const pressEagerness = clamp(
      (sub === 'CDM' || sub === 'CM' ? 0.46 : sub === 'ST' || isWide ? 0.38 : 0.28) +
        (ps.has('ball_winner') ? 0.44 : 0) +
        (ps.has('box_to_box') ? 0.34 : 0) +
        (ps.has('stopper_cb') ? 0.22 : 0) +
        (ps.has('line_breaker') ? 0.16 : 0) -
        (ps.has('poacher') ? 0.18 : 0) -
        (ps.has('deep_playmaker') ? 0.10 : 0),
      0.08,
      1.0,
    );
    const holdPositionBias = clamp(
      (sub === 'CB' ? 0.65 : sub === 'CDM' ? 0.52 : 0.22) +
        (ps.has('stopper_cb') ? 0.34 : 0) +
        (ps.has('shot_stopper') ? 0.42 : 0) +
        (ps.has('deep_playmaker') ? 0.20 : 0) -
        (ps.has('attacking_wingback') ? 0.28 : 0) -
        (ps.has('box_to_box') ? 0.22 : 0),
      0.05,
      1.0,
    );
    const longSwitchBias = clamp(
      0.20 +
        (attrs.pas - 75) * 0.011 +
        (attrs.cro - 75) * 0.008 +
        (ps.has('deep_playmaker') ? 0.38 : 0) +
        (ps.has('ball_playing_cb') ? 0.30 : 0) +
        (ps.has('playmaker_10') ? 0.20 : 0) +
        (ps.has('attacking_wingback') ? 0.16 : 0),
      0.05,
      1.0,
    );
    const dribbleBias = clamp(
      0.16 +
        (attrs.dri - 75) * 0.014 +
        (ps.has('inverted_winger') ? 0.34 : 0) +
        (ps.has('classic_winger') ? 0.28 : 0) +
        (ps.has('playmaker_10') ? 0.22 : 0) +
        (ps.has('ball_playing_cb') ? 0.16 : 0) -
        (ps.has('stopper_cb') ? 0.18 : 0),
      0.04,
      1.0,
    );
    const shootBias = clamp(
      0.18 +
        (attrs.sho - 75) * 0.015 +
        (ps.has('poacher') ? 0.32 : 0) +
        (ps.has('complete_forward') ? 0.26 : 0) +
        (ps.has('inverted_winger') ? 0.24 : 0) +
        (ps.has('line_breaker') ? 0.20 : 0),
      0.04,
      1.0,
    );
    const sweeperGkBias = clamp(
      (slotIndex === 0 ? 0.35 : 0) +
        (ps.has('sweeper_keeper') ? 0.52 : 0) -
        (ps.has('shot_stopper') ? 0.28 : 0) +
        ((attrs.gk?.kic ?? 74) - 75) * 0.012,
      0.04,
      0.98,
    );

    return {
      slotIndex,
      playerId: p?.id ?? `slot-${slotIndex}`,
      name: p?.name ?? slot.label,
      subPosition: sub,
      position: slot.position,
      ovr,
      attrs,
      playstyles,
      staminaStat,
      enteredAtMinute: enteredAt,
      isFreshSub,
      isStar: Boolean(p?.isLegend || ovr >= 87),
      managerSynergy: mgrSynergy,
      synergyWithSlot: synergyMatrix[slotIndex],
      baseMaxSpeed,
      baseMaxAccel,
      baseTurnRate,
      runBehindBias,
      dropToLinkBias,
      boxCrashBias,
      cutInsideBias,
      hugTouchlineBias,
      overlapBias,
      pressEagerness,
      holdPositionBias,
      longSwitchBias,
      dribbleBias,
      shootBias,
      sweeperGkBias,
    };
  });
}

/**
 * Computes current stamina percentage for a single agent at a given match minute.
 */
export function computeAgentLiveStamina(
  profile: PlayerAgentProfile,
  doctrine: TeamTacticalDoctrine,
  minute: number,
): number {
  const minsPlayed = Math.max(0, minute - profile.enteredAtMinute);
  return computePlayerStaminaPct({
    staminaStat: profile.staminaStat,
    subPosition: profile.subPosition,
    tactic: doctrine.tactic,
    minutesPlayed: minsPlayed,
    managerTraitId: doctrine.managerTraitId,
  });
}

/**
 * Layer 1 + 2 + 3 + 4 Unified 3-Phase Formation Anchor Calculator.
 * Transforms every one of the 9 formations dynamically across:
 *  - buildup (in-possession own half / deep progression)
 *  - progression (in-possession midfield / final third)
 *  - defend (out-of-possession structured block)
 *  - transition_attack (0..3.5s after recovery — explosive vertical runs)
 *  - transition_defend (0..3.5s after turnover — counterpress vs sprint recovery)
 */
export function computeDynamicFormationTarget(params: {
  slotIndex: number;
  base: SimVec2;
  isHome: boolean;
  mode: FormationPhaseMode;
  ball: SimVec2;
  doctrine: TeamTacticalDoctrine;
  profile: PlayerAgentProfile;
  territorialShiftX: number;
  simTime: number;
}): SimVec2 {
  const {
    slotIndex,
    base,
    isHome,
    mode,
    ball,
    doctrine,
    profile,
    territorialShiftX,
    simTime,
  } = params;

  const dir = isHome ? 1 : -1;
  const sub = profile.subPosition;
  const isTopFlank = base.y < 0.36;
  const isBotFlank = base.y > 0.64;
  const sideSign = isTopFlank ? -1 : isBotFlank ? 1 : 0;

  // Goalkeeper (slot 0)
  if (slotIndex === 0) {
    const ballAdvance = isHome ? Math.max(0, ball.x - 0.38) : Math.max(0, 0.62 - ball.x);
    let gx = isHome ? 0.048 : 0.952;
    const sweepStep =
      (mode === 'buildup' || mode === 'progression'
        ? doctrine.gkBuildupSupport * 0.055 + profile.sweeperGkBias * 0.04
        : profile.sweeperGkBias * 0.048 + Math.max(0, doctrine.defensiveLineOffset) * 0.35) *
      (0.45 + ballAdvance * 0.9);
    gx += dir * sweepStep;
    const gy = clamp(0.5 + (ball.y - 0.5) * 0.24, 0.36, 0.64);
    return {
      x: isHome ? clamp(gx, 0.038, 0.18) : clamp(gx, 0.82, 0.962),
      y: gy,
    };
  }

  const isCB = sub === 'CB';
  const isFB = sub === 'LB' || sub === 'RB' || sub === 'LWB' || sub === 'RWB';
  const isCDM = sub === 'CDM';
  const isCM = sub === 'CM';
  const isCAM = sub === 'CAM';
  const isWinger = sub === 'LW' || sub === 'RW' || sub === 'LM' || sub === 'RM';
  const isST = sub === 'ST';

  const isInPoss = mode === 'buildup' || mode === 'progression' || mode === 'transition_attack';
  const lineFactor = isST || isWinger ? 1.05 : isCAM || isCM ? 0.95 : isCDM ? 0.86 : 0.72;

  // Ball-coupled team block shift (smooth, cohesive unit movement)
  const ballShiftX = (ball.x - 0.5) * (isInPoss ? 0.40 : 0.44) * lineFactor;
  const ballShiftY = (ball.y - 0.5) * (isInPoss ? 0.16 : 0.24);

  let x = base.x + ballShiftX + territorialShiftX * 0.45 * lineFactor;
  let y = 0.5 + (base.y - 0.5) * (isInPoss ? doctrine.attackWidthScale : doctrine.defensiveCompactness) + ballShiftY;

  // Apply defensive line height / pressing line doctrine
  x += dir * doctrine.defensiveLineOffset * (isCB || isFB || isCDM ? 1.1 : 0.75);

  // ── Formation-Specific 3-Phase Structural Geometry (ALL 9 FORMATIONS) ──
  const form = doctrine.formation;
  if (isInPoss) {
    const isDeep = mode === 'buildup';
    const isTrans = mode === 'transition_attack';

    if (form === '4-3-3') {
      if (isCB) {
        y += (base.y < 0.5 ? -0.045 : 0.045); // CBs split wide in buildup
        x += dir * (isDeep ? -0.02 : 0.04);
      } else if (isCDM) {
        x += dir * (isDeep ? -0.045 : 0.015); // Single pivot drops between CBs
      } else if (isCM) {
        x += dir * (isDeep ? 0.01 : 0.07); // Dual 8s push into half-spaces
        y += sideSign * -0.03;
      } else if (isFB) {
        x += dir * (isDeep ? 0.025 : 0.085);
      } else if (isWinger) {
        x += dir * (isTrans ? 0.11 : 0.055);
      } else if (isST) {
        x += dir * (isTrans ? 0.10 : isDeep ? -0.015 : 0.06);
      }
    } else if (form === '4-4-2') {
      if (isCB) x += dir * (isDeep ? -0.02 : 0.025);
      else if (isFB) x += dir * (isDeep ? 0.02 : 0.075);
      else if (isWinger) {
        x += dir * (isDeep ? 0.03 : 0.085);
        y += sideSign * 0.035;
      } else if (isCM) {
        // Stagger the 2 CMs vertically to create passing angles (one holds, one steps)
        x += dir * (slotIndex === 6 ? -0.015 : 0.045);
      } else if (isST) {
        // Stagger twin strikers (one drops to link, one pins backline)
        x += dir * (slotIndex === 9 ? (isTrans ? 0.09 : -0.025) : 0.075);
      }
    } else if (form === '4-4-2-diamond') {
      if (isFB) {
        // Fullbacks supply sole touchline width
        x += dir * (isDeep ? 0.04 : 0.11);
        y += sideSign * 0.065;
      } else if (isCDM) {
        x += dir * -0.03;
      } else if (isCM) {
        x += dir * 0.035;
        y += (0.5 - y) * 0.16; // Narrow central diamond
      } else if (isCAM) {
        x += dir * 0.045; // Tip of diamond behind twin strikers
      } else if (isST) {
        x += dir * (isTrans ? 0.10 : 0.065);
        y += sideSign * 0.035; // Split channels for CAM through-balls
      }
    } else if (form === '4-2-3-1') {
      if (isCDM) {
        // Double pivot: ball-side steps slightly higher, far-side anchors rest defense
        const nearBall = Math.abs(base.y - ball.y) < 0.25;
        x += dir * (isDeep ? -0.03 : nearBall ? 0.025 : -0.01);
      } else if (isCAM) {
        x += dir * 0.04;
        y += (ball.y - y) * 0.18; // 10 drifts to ball-side half-space pocket
      } else if (isFB) {
        x += dir * (isDeep ? 0.02 : 0.08);
      } else if (isWinger) {
        x += dir * (isTrans ? 0.10 : 0.055);
      } else if (isST) {
        x += dir * (isTrans ? 0.10 : 0.06);
      }
    } else if (form === '3-5-2') {
      if (isCB) {
        x += dir * (slotIndex === 2 ? -0.025 : 0.015); // Wide CBs step into half-space
        y += sideSign * 0.035;
      } else if (isFB) {
        x += dir * (isDeep ? 0.04 : 0.12); // Wingbacks surge high
        y += sideSign * 0.045;
      } else if (isCDM || isCM) {
        x += dir * (isCDM ? -0.015 : 0.045);
      } else if (isCAM) {
        x += dir * 0.05;
      } else if (isST) {
        x += dir * (slotIndex === 9 ? 0.03 : 0.085);
      }
    } else if (form === '3-5-2-dm') {
      if (isCB) x += dir * -0.02;
      else if (isCDM) x += dir * (isDeep ? -0.03 : -0.005); // Rock-solid 3+2 rest defense
      else if (isFB) {
        x += dir * (isTrans ? 0.11 : isDeep ? 0.03 : 0.095);
        y += sideSign * 0.045;
      } else if (isCAM) x += dir * 0.055;
      else if (isST) x += dir * (isTrans ? 0.11 : 0.065);
    } else if (form === '3-4-3') {
      if (isCB) {
        x += dir * (slotIndex === 2 ? -0.015 : 0.03);
        y += sideSign * 0.03;
      } else if (isFB) {
        x += dir * (isDeep ? 0.04 : 0.105);
        y += sideSign * 0.05;
      } else if (isCM) {
        x += dir * (isDeep ? -0.02 : 0.03);
      } else if (isWinger) {
        x += dir * 0.06;
        y += -sideSign * 0.07; // Wingers tuck into half-space as wingbacks overlap!
      } else if (isST) {
        x += dir * 0.065;
      }
    } else if (form === '3-4-2-1') {
      if (isCB) x += dir * (slotIndex === 2 ? -0.015 : 0.025);
      else if (isFB) {
        x += dir * (isDeep ? 0.04 : 0.105);
        y += sideSign * 0.055;
      } else if (isCM) {
        x += dir * (isDeep ? -0.02 : 0.025);
      } else if (isCAM) {
        // Dual 10s form box midfield with the 2 CMs in half-spaces
        x += dir * (isDeep ? 0.015 : 0.06);
        y += -sideSign * 0.02;
      } else if (isST) {
        x += dir * 0.075;
      }
    } else if (form === '3-3-3-1') {
      if (isCB) x += dir * 0.045;
      else if (isCDM) x += dir * 0.01;
      else if (isFB) {
        x += dir * (isDeep ? 0.035 : 0.085);
        y += sideSign * 0.04;
      } else if (isCAM) {
        x += dir * (isDeep ? 0.025 : 0.075);
      } else if (isST) {
        x += dir * 0.085;
      }
    }

    // Tactic-specific in-possession refinements
    if (doctrine.tactic === 'possession' && isFB && profile.overlapBias < 0.72) {
      // Inverted fullbacks tuck inside in possession unless they are specialist attacking wingbacks
      y += -sideSign * 0.095;
      x += dir * 0.025;
    } else if (doctrine.tactic === 'wingplay' && isFB) {
      x += dir * 0.05;
      y += sideSign * 0.04;
    } else if (mode === 'transition_attack' && (isST || isWinger || isCAM)) {
      x += dir * (0.065 + doctrine.counterSprintUrgency * 0.065);
    }

    // Layer 4: Individual Playstyle Off-Ball Modifiers (ALL 12 outfield playstyles!)
    if (profile.hugTouchlineBias > 0.65 && (isWinger || isFB)) {
      y += sideSign * 0.055;
    }
    if (profile.cutInsideBias > 0.60 && isWinger) {
      y += -sideSign * 0.085;
      x += dir * 0.025;
    }
    if (profile.overlapBias > 0.72 && isFB) {
      x += dir * (isDeep ? 0.02 : 0.075);
      y += sideSign * 0.04;
    }
    if (profile.dropToLinkBias > 0.70 && (isST || isCAM || isCDM)) {
      x += -dir * (isDeep ? 0.05 : 0.025);
    }
    if (profile.runBehindBias > 0.72 && (isST || isWinger)) {
      x += dir * (isDeep ? 0.03 : 0.065);
    }
    if (profile.boxCrashBias > 0.68 && (isCM || isST) && !isDeep) {
      x += dir * 0.055;
      y += (0.5 - y) * 0.22;
    }
    if (profile.holdPositionBias > 0.78 && (isCB || isCDM)) {
      x += -dir * 0.03;
    }

    // Total Football fluid positional interchange
    if (doctrine.positionSwitching > 0.45 && !isCB) {
      x += dir * Math.sin(simTime * 0.75 + slotIndex * 1.4) * 0.032 * doctrine.positionSwitching;
      y += Math.cos(simTime * 0.65 + slotIndex * 1.1) * 0.055 * doctrine.positionSwitching;
    }

    // Late-game trailing urgency: push team block forward & crash the box!
    if (doctrine.attackUrgency > 0.15) {
      const urg = doctrine.attackUrgency;
      if (isST || isWinger || isCAM) {
        x += dir * (0.04 + 0.06 * urg);
        if (!isDeep && (isWinger || isCAM)) {
          y += (0.5 - y) * 0.18 * urg;
        }
      } else if (isCM || isFB) {
        x += dir * (0.045 + 0.075 * urg);
        if (isCM && !isDeep && urg >= 0.6) {
          y += (0.5 - y) * 0.28 * urg;
        }
      } else if (isCDM) {
        x += dir * (0.035 + 0.055 * urg);
      } else if (isCB) {
        x += dir * (0.03 + 0.05 * urg);
      }
      // 85'+ 1-goal deficit power play: send 1 CB (slot 2) & CMs into opponent penalty box
      if (doctrine.cbBoxJoin && !isDeep) {
        if (isCB && slotIndex === 2) {
          x = isHome ? Math.max(x, 0.85) : Math.min(x, 0.15);
          y = 0.46;
        } else if (isCM) {
          x += dir * 0.06;
          y += (0.5 - y) * 0.25;
        }
      }
    }
  } else {
    // ── Out-of-Possession Defensive Block & Recovery Transition ──
    const isTransDef = mode === 'transition_defend';

    if (form === '3-5-2' || form === '3-5-2-dm' || form === '3-4-3' || form === '3-4-2-1') {
      // 3-back formations morph into compact 5-back defensive blocks
      if (isFB) {
        x += -dir * 0.085;
        y += sideSign * 0.015;
      } else if (isWinger || isCAM) {
        x += -dir * 0.065;
      }
    } else if (form === '4-3-3') {
      // Morphs into 4-5-1 / 4-1-4-1 defensive block
      if (isWinger) x += -dir * 0.095;
      else if (isCM) x += -dir * 0.04;
    } else if (form === '4-2-3-1') {
      // Morphs into compact 4-4-2 / 4-2-3-1 mid-block
      if (isWinger) x += -dir * 0.065;
      else if (isCAM) x += dir * 0.02;
    } else if (form === '4-4-2-diamond') {
      if (isCM || isCDM) y += (0.5 - y) * 0.18;
    } else if (form === '3-3-3-1') {
      // Ultra-high man-oriented press shape
      if (!isCB) x += dir * 0.04;
    }

    // Counter-attacking striker stays poised as outlet near halfway
    if (isST && doctrine.tactic === 'counter') {
      x += dir * 0.055;
    } else {
      x += -dir * (isTransDef ? 0.04 : 0.025);
    }

    // Late-game trailing: high urgent press block; Late-game leading: compact protective block
    if (doctrine.attackUrgency > 0.25) {
      x += dir * (0.045 + 0.065 * doctrine.attackUrgency);
    } else if (doctrine.protectUrgency > 0.25) {
      x -= dir * (0.03 + 0.05 * doctrine.protectUrgency);
    }

    // Defensive compactness pulls far-side players toward ball corridor
    y += (0.5 - y) * (1 - doctrine.defensiveCompactness) * 0.45;
  }

  return {
    x: clamp(x, 0.06, 0.94),
    y: clamp(y, 0.06, 0.94),
  };
}
