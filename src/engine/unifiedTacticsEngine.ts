import { FORMATIONS } from '../data/formations';
import { MANAGER_TRAITS } from '../data/managerTraits';
import type {
  AiManagerProfile,
  FormationId,
  ManagerTraitId,
} from '../types/game';
import type { AiHalftimeAdjustment, TacticId } from '../types/league';
import type { Player, PlaystyleId } from '../types/player';
import { getPlayerAttributes } from './attributeEngine';
import { optimizeCurrentStartersForFormation } from './lineupOptimizer';
import { evaluatePositionFit } from './positionEngine';

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ============================================================================
// 1. FORMATION STRUCTURAL PROFILES (ALL 9 FORMATIONS)
// ============================================================================

interface FormationStructureProfile {
  midfieldDensity: number; // 0..100 central corridor numbers & half-space control
  flankWidth: number; // 0..100 natural touchline attacking width
  flankProtection: number; // 0..100 natural wide defensive coverage
  lineHeight: number; // 0..100 structural defensive line height (high = press, low = deep block)
  boxAttackNumbers: number; // 0..100 strikers + box crashers
  boxDefenseDensity: number; // 0..100 CBs + holding pivots shielding box
  pressTrapShape: number; // 0..100 front/mid pressing structure
  tacticStructureFit: Record<TacticId, number>; // 55..98 how naturally the formation executes each tactic
}

export const FORMATION_PROFILES: Record<FormationId, FormationStructureProfile> = {
  '4-3-3': {
    midfieldDensity: 78,
    flankWidth: 86,
    flankProtection: 78,
    lineHeight: 70,
    boxAttackNumbers: 74,
    boxDefenseDensity: 74,
    pressTrapShape: 86,
    tacticStructureFit: {
      possession: 94,
      gegenpressing: 92,
      wingplay: 88,
      counter: 78,
      balanced: 90,
    },
  },
  '4-4-2': {
    midfieldDensity: 66,
    flankWidth: 80,
    flankProtection: 82,
    lineHeight: 50,
    boxAttackNumbers: 88,
    boxDefenseDensity: 82,
    pressTrapShape: 72,
    tacticStructureFit: {
      possession: 72,
      gegenpressing: 76,
      wingplay: 88,
      counter: 92,
      balanced: 88,
    },
  },
  '4-4-2-diamond': {
    midfieldDensity: 95,
    flankWidth: 56, // Narrow midfield; relies heavily on fullback overlaps
    flankProtection: 64,
    lineHeight: 68,
    boxAttackNumbers: 88,
    boxDefenseDensity: 78,
    pressTrapShape: 84,
    tacticStructureFit: {
      possession: 93,
      gegenpressing: 87,
      wingplay: 64,
      counter: 84,
      balanced: 85,
    },
  },
  '4-2-3-1': {
    midfieldDensity: 84,
    flankWidth: 80,
    flankProtection: 82,
    lineHeight: 62,
    boxAttackNumbers: 78,
    boxDefenseDensity: 84,
    pressTrapShape: 82,
    tacticStructureFit: {
      possession: 90,
      gegenpressing: 88,
      wingplay: 84,
      counter: 88,
      balanced: 95,
    },
  },
  '3-5-2': {
    midfieldDensity: 88,
    flankWidth: 82,
    flankProtection: 74,
    lineHeight: 58,
    boxAttackNumbers: 90,
    boxDefenseDensity: 84,
    pressTrapShape: 78,
    tacticStructureFit: {
      possession: 86,
      gegenpressing: 82,
      wingplay: 90,
      counter: 88,
      balanced: 88,
    },
  },
  '3-5-2-dm': {
    midfieldDensity: 86,
    flankWidth: 78,
    flankProtection: 84,
    lineHeight: 44, // Deep double-pivot shield behind CAM + twin strikers
    boxAttackNumbers: 86,
    boxDefenseDensity: 95,
    pressTrapShape: 70,
    tacticStructureFit: {
      possession: 76,
      gegenpressing: 72,
      wingplay: 86,
      counter: 96,
      balanced: 90,
    },
  },
  '3-4-3': {
    midfieldDensity: 68,
    flankWidth: 94,
    flankProtection: 74,
    lineHeight: 74,
    boxAttackNumbers: 84,
    boxDefenseDensity: 76,
    pressTrapShape: 88,
    tacticStructureFit: {
      possession: 82,
      gegenpressing: 90,
      wingplay: 96,
      counter: 80,
      balanced: 84,
    },
  },
  '3-4-2-1': {
    midfieldDensity: 88,
    flankWidth: 78,
    flankProtection: 80,
    lineHeight: 66,
    boxAttackNumbers: 80,
    boxDefenseDensity: 84,
    pressTrapShape: 86,
    tacticStructureFit: {
      possession: 92,
      gegenpressing: 88,
      wingplay: 84,
      counter: 86,
      balanced: 92,
    },
  },
  '3-3-3-1': {
    midfieldDensity: 94,
    flankWidth: 84,
    flankProtection: 58, // Exposed flanks/back-3 space when press is broken
    lineHeight: 90, // Bielsa ultra-high line & forward numerical overload
    boxAttackNumbers: 86,
    boxDefenseDensity: 62,
    pressTrapShape: 98,
    tacticStructureFit: {
      possession: 90,
      gegenpressing: 98,
      wingplay: 80,
      counter: 58,
      balanced: 74,
    },
  },
};

// ============================================================================
// 2. STAGE 1 — INTERNAL TACTICAL FIT & 5-ZONE LINEUP PROFILE
// ============================================================================

export interface TeamTacticalInput {
  starters: (Player | null)[];
  formation: FormationId;
  tactic: TacticId;
  managerTraitId: ManagerTraitId | null;
  managerOvr?: number; // 70..99 (default 84 for user if unspecified)
}

export interface TeamTacticalProfile {
  formation: FormationId;
  tactic: TacticId;
  tacticalFit: number; // 0..100 overall internal cohesion/execution
  structureFit: number; // 0..100
  personnelFit: number; // 0..100
  managerFit: number; // 0..100
  // 5-Zone Ratings (0..100)
  midfieldControl: number;
  flankAttack: number;
  flankDefense: number;
  highLineExposure: number; // higher = more space left behind defense
  transitionThreat: number; // higher = faster vertical counter-attack threat
  boxPresence: number;
  boxCompactness: number;
  pressIntensity: number;
  pressResistance: number;
}

function avgAttr(
  list: Player[],
  getter: (p: Player) => number,
  fallback = 75,
): number {
  if (list.length === 0) return fallback;
  return list.reduce((sum, p) => sum + getter(p), 0) / list.length;
}

function countStyles(list: Player[], styles: PlaystyleId[]): number {
  let count = 0;
  for (const p of list) {
    if (p.playstyles.some((ps) => styles.includes(ps))) count += 1;
  }
  return count;
}

const tacticalProfileCache = new Map<string, TeamTacticalProfile>();
const MAX_TACTICAL_PROFILE_CACHE = 512;

/**
 * Evaluates a lineup holistically (Formation + Tactic + Starter Sub-Attributes/Playstyles + Manager Style/OVR)
 * into a single Internal Tactical Fit score and 5 football zone ratings.
 */
export function evaluateTeamTacticalProfile(
  input: TeamTacticalInput,
): TeamTacticalProfile {
  const {
    starters,
    formation,
    tactic,
    managerTraitId,
    managerOvr = 84,
  } = input;

  const cacheKey = `${formation}|${tactic}|${managerTraitId ?? ''}|${managerOvr}|${starters
    .map((p) => (p ? `${p.id}:${p.ovr}:${p.stamina ?? 78}:${p.playstyles.join('.')}` : '_'))
    .join(',')}`;
  const cached = tacticalProfileCache.get(cacheKey);
  if (cached) return cached;

  const formCfg = FORMATIONS[formation] ?? FORMATIONS['4-3-3'];
  const fProf = FORMATION_PROFILES[formation] ?? FORMATION_PROFILES['4-3-3'];

  const filled: { player: Player; slotIndex: number }[] = [];
  for (let i = 0; i < formCfg.slots.length; i += 1) {
    const p = starters[i];
    if (p) filled.push({ player: p, slotIndex: i });
  }
  const players = filled.map((x) => x.player);

  // Partition starters by tactical zone roles based on assigned formation slots
  const gkPlayers: Player[] = [];
  const cbPlayers: Player[] = [];
  const wideDefPlayers: Player[] = []; // LB, RB, LWB, RWB
  const centralMidPlayers: Player[] = []; // CDM, CM, CAM
  const wideAttPlayers: Player[] = []; // LW, RW, LM, RM, wide LAM/RAM
  const strikerPlayers: Player[] = []; // ST

  let outOfPosPenaltySum = 0;

  for (const { player, slotIndex } of filled) {
    const slot = formCfg.slots[slotIndex];
    const fit = evaluatePositionFit(
      player,
      slot.subPosition,
      managerTraitId,
      slot.alternateSubPositions,
    );
    outOfPosPenaltySum += Math.abs(fit.penalty);

    const sub = slot.subPosition;
    if (sub === 'GK') gkPlayers.push(player);
    else if (sub === 'CB') cbPlayers.push(player);
    else if (sub === 'LB' || sub === 'RB' || sub === 'LWB' || sub === 'RWB') {
      wideDefPlayers.push(player);
    } else if (sub === 'ST') strikerPlayers.push(player);
    else if (sub === 'LW' || sub === 'RW' || sub === 'LM' || sub === 'RM') {
      wideAttPlayers.push(player);
    } else {
      // CDM / CM / CAM (in 3-3-3-1, wide LAM/RAM also contribute to half-space & flanks)
      centralMidPlayers.push(player);
      if (formation === '3-3-3-1' && (slotIndex === 7 || slotIndex === 9)) {
        wideAttPlayers.push(player);
      }
    }
  }

  const outfield = players.filter((p) => p.position !== 'GK');
  const wideAll = [...wideDefPlayers, ...wideAttPlayers];
  const buildupSpine = [...gkPlayers, ...cbPlayers, ...centralMidPlayers];
  const attackLine = [...strikerPlayers, ...wideAttPlayers];

  const squadAvgOvr =
    players.length > 0
      ? players.reduce((s, p) => s + p.ovr, 0) / players.length
      : 80;
  // Tactical profile measures tactical specialization relative to each team's own OVR
  // (plus a gentle 15% absolute quality share) so raw OVR isn't double-counted against
  // team ratings, allowing lower-OVR tactical masters to genuinely out-coach mismatched giants.
  const normStat = (raw: number) =>
    clamp(78 + (raw - squadAvgOvr) * 1.15 + (raw - 80) * 0.15, 52, 97);

  // Key normalized sub-attribute averages (52..97)
  const midPas = normStat(avgAttr(centralMidPlayers, (p) => getPlayerAttributes(p).pas, squadAvgOvr));
  const midDri = normStat(avgAttr(centralMidPlayers, (p) => getPlayerAttributes(p).dri, squadAvgOvr - 1));
  const midDef = normStat(avgAttr(centralMidPlayers, (p) => getPlayerAttributes(p).def, squadAvgOvr - 2));
  const midPhy = normStat(avgAttr(centralMidPlayers, (p) => getPlayerAttributes(p).phy, squadAvgOvr - 1));

  const wideCro = normStat(avgAttr(wideAll, (p) => getPlayerAttributes(p).cro, squadAvgOvr - 2));
  const wideDri = normStat(avgAttr(wideAll, (p) => getPlayerAttributes(p).dri, squadAvgOvr));
  const wideDefStat = normStat(avgAttr(wideDefPlayers, (p) => getPlayerAttributes(p).def, squadAvgOvr - 2));
  const wideSta = normStat(avgAttr(wideAll, (p) => p.stamina ?? 78, 78));

  const cbDef = normStat(avgAttr(cbPlayers, (p) => getPlayerAttributes(p).def, squadAvgOvr));
  const cbAer = normStat(avgAttr(cbPlayers, (p) => getPlayerAttributes(p).aer, squadAvgOvr));
  const cbPas = normStat(avgAttr(cbPlayers, (p) => getPlayerAttributes(p).pas, squadAvgOvr - 4));
  const cbPhy = normStat(avgAttr(cbPlayers, (p) => getPlayerAttributes(p).phy, squadAvgOvr));

  const stSho = normStat(avgAttr(strikerPlayers, (p) => getPlayerAttributes(p).sho, squadAvgOvr + 1));
  const stAer = normStat(avgAttr(strikerPlayers, (p) => getPlayerAttributes(p).aer, squadAvgOvr - 1));
  const attPhy = normStat(avgAttr(attackLine, (p) => getPlayerAttributes(p).phy, squadAvgOvr));
  const attSho = normStat(avgAttr(attackLine, (p) => getPlayerAttributes(p).sho, squadAvgOvr));

  const teamSta = normStat(avgAttr(outfield, (p) => p.stamina ?? 78, 78));
  const teamPhy = normStat(avgAttr(outfield, (p) => getPlayerAttributes(p).phy, squadAvgOvr - 1));
  const gkKic = normStat(
    avgAttr(
      gkPlayers,
      (p) => getPlayerAttributes(p).gk?.kic ?? p.ovr - 4,
      squadAvgOvr - 4,
    ),
  );
  const gkShotStop = normStat(
    avgAttr(
      gkPlayers,
      (p) => {
        const g = getPlayerAttributes(p).gk;
        return g ? (g.ref + g.div + g.pos) / 3 : p.ovr;
      },
      squadAvgOvr,
    ),
  );

  // --- Stage 1A: Structure Fit (Formation × Tactic, 35%) ---
  const structureFit = fProf.tacticStructureFit[tactic];

  // --- Stage 1B: Personnel Execution Fit (Sub-Attributes & Playstyles × Tactic, 45%) ---
  let personnelRaw = 74;
  if (tactic === 'possession') {
    const styleHits = countStyles(players, [
      'deep_playmaker',
      'playmaker_10',
      'ball_playing_cb',
      'inverted_winger',
      'sweeper_keeper',
    ]);
    personnelRaw =
      (midPas * 0.36 + midDri * 0.22 + cbPas * 0.22 + gkKic * 0.1 + attSho * 0.1) +
      Math.min(10, styleHits * 2.2);
  } else if (tactic === 'gegenpressing') {
    const styleHits = countStyles(players, [
      'box_to_box',
      'ball_winner',
      'line_breaker',
      'attacking_wingback',
      'inverted_winger',
    ]);
    personnelRaw =
      (teamSta * 0.32 + teamPhy * 0.26 + midDef * 0.22 + attPhy * 0.2) +
      Math.min(10, styleHits * 2.1);
  } else if (tactic === 'wingplay') {
    const styleHits = countStyles(players, [
      'classic_winger',
      'attacking_wingback',
      'poacher',
      'complete_forward',
      'inverted_winger',
    ]);
    personnelRaw =
      (wideCro * 0.32 + wideDri * 0.22 + wideSta * 0.16 + stAer * 0.16 + stSho * 0.14) +
      Math.min(10, styleHits * 2.2);
  } else if (tactic === 'counter') {
    const styleHits = countStyles(players, [
      'stopper_cb',
      'ball_winner',
      'line_breaker',
      'shot_stopper',
      'classic_winger',
    ]);
    personnelRaw =
      (cbDef * 0.28 + attPhy * 0.26 + attSho * 0.18 + midDef * 0.14 + gkShotStop * 0.14) +
      Math.min(10, styleHits * 2.2);
  } else {
    // balanced
    const styleHits = countStyles(players, [
      'complete_forward',
      'box_to_box',
      'playmaker_10',
      'deep_playmaker',
      'ball_playing_cb',
    ]);
    personnelRaw =
      (midPas * 0.24 + cbDef * 0.24 + attSho * 0.24 + teamSta * 0.14 + wideCro * 0.14) +
      Math.min(10, styleHits * 2.0);
  }

  // Out-of-position players degrade tactical execution
  const posFitPenalty = Math.min(18, outOfPosPenaltySum * 0.65);
  const personnelFit = clamp(Math.round(personnelRaw - posFitPenalty), 42, 99);

  // --- Stage 1C: Manager Style & OVR Fit (20%) ---
  const traitCfg = managerTraitId ? MANAGER_TRAITS[managerTraitId] : null;
  let managerFitBase = traitCfg
    ? 80 + (managerOvr - 84) * 0.35
    : 85 + (managerOvr - 84) * 0.35;
  if (traitCfg) {
    if (traitCfg.synergyTactic === tactic) {
      managerFitBase += 6;
    } else if (traitCfg.synergyTactic && traitCfg.synergyTactic !== tactic) {
      managerFitBase -= 5;
    } else {
      // Flexible traits (halftime_wizard, total_football, big_game_hunter, etc.)
      managerFitBase += 3;
    }
    const mgrMatchedPlayers = countStyles(players, traitCfg.synergyPlaystyles);
    managerFitBase += Math.min(4, mgrMatchedPlayers * 0.9);
  }
  const managerFit = clamp(Math.round(managerFitBase), 58, 96);

  const tacticalFit = clamp(
    Math.round(structureFit * 0.35 + personnelFit * 0.45 + managerFit * 0.2),
    45,
    99,
  );

  // Execution multiplier (0.88 .. 1.08) scales how well the team executes its tactical intentions
  const execScale = 0.88 + ((tacticalFit - 50) / 50) * 0.18;

  // ============================================================================
  // 5-ZONE PROFILE COMPUTATION (0..100 each) — Balanced real-football tradeoffs
  // ============================================================================
  const tacticMidMod =
    tactic === 'possession' ? 11 : tactic === 'gegenpressing' ? 3 : tactic === 'counter' ? -7 : tactic === 'wingplay' ? -5 : 2;
  const mgrMidMod = managerTraitId === 'midfield_maestro' ? 6 : managerTraitId === 'tiki_taka' ? 4 : 0;
  const midfieldControl = clamp(
    Math.round(
      (fProf.midfieldDensity * 0.48 + (midPas * 0.5 + midDri * 0.25 + midDef * 0.25) * 0.52 + tacticMidMod + mgrMidMod) *
        execScale,
    ),
    30,
    99,
  );

  const tacticFlankAttMod =
    tactic === 'wingplay' ? 11 : tactic === 'gegenpressing' ? 2 : tactic === 'possession' ? -1 : tactic === 'counter' ? 0 : 2;
  const mgrFlankMod = managerTraitId === 'wing_bomber' ? 6 : 0;
  const wingStyleBoost = countStyles(wideAll, ['classic_winger', 'attacking_wingback', 'inverted_winger']) * 2.2;
  const flankAttack = clamp(
    Math.round(
      (fProf.flankWidth * 0.48 + (wideCro * 0.45 + wideDri * 0.35 + wideSta * 0.2) * 0.52 + tacticFlankAttMod + mgrFlankMod + Math.min(8, wingStyleBoost)) *
        execScale,
    ),
    30,
    99,
  );

  const tacticFlankDefMod =
    tactic === 'counter' ? 6 : tactic === 'possession' ? 2 : tactic === 'wingplay' ? -5 : tactic === 'gegenpressing' ? -4 : 3;
  const flankDefense = clamp(
    Math.round(
      (fProf.flankProtection * 0.5 + (wideDefStat * 0.55 + wideSta * 0.25 + cbDef * 0.2) * 0.5 + tacticFlankDefMod) *
        (0.92 + (tacticalFit - 50) / 250),
    ),
    30,
    99,
  );

  // High-line exposure: high line + aggressive tactics expose space behind; sweeper keeper / fast CB mitigates slightly
  const tacticLineMod =
    tactic === 'gegenpressing' ? 16 : tactic === 'possession' ? 9 : tactic === 'wingplay' ? 4 : tactic === 'counter' ? -20 : 0;
  const sweeperMitigation =
    countStyles(gkPlayers, ['sweeper_keeper']) * 4 + Math.max(0, (cbPhy - 78) * 0.35);
  const highLineExposure = clamp(
    Math.round(fProf.lineHeight + tacticLineMod - sweeperMitigation),
    15,
    98,
  );

  const tacticTransitionMod =
    tactic === 'counter' ? 13 : tactic === 'gegenpressing' ? 6 : tactic === 'wingplay' ? 3 : tactic === 'possession' ? -6 : 2;
  const transStyleBoost = countStyles(attackLine, ['line_breaker', 'classic_winger', 'inverted_winger']) * 3.0;
  const mgrDirectMod = managerTraitId === 'direct_football' ? 6 : managerTraitId === 'underdog_killer' ? 4 : 0;
  const transitionThreat = clamp(
    Math.round(
      (attPhy * 0.42 + attSho * 0.24 + midPas * 0.2 + wideDri * 0.14 + tacticTransitionMod + mgrDirectMod + Math.min(10, transStyleBoost)) *
        execScale,
    ),
    30,
    99,
  );

  const tacticBoxAttMod =
    tactic === 'wingplay' ? 7 : tactic === 'balanced' ? 2 : tactic === 'possession' ? 0 : tactic === 'counter' ? -1 : 1;
  const boxStyleBoost = countStyles(strikerPlayers, ['poacher', 'complete_forward']) * 3.5;
  const boxPresence = clamp(
    Math.round(
      (fProf.boxAttackNumbers * 0.44 + (stSho * 0.42 + stAer * 0.33 + wideCro * 0.25) * 0.56 + tacticBoxAttMod + Math.min(8, boxStyleBoost)) *
        execScale,
    ),
    30,
    99,
  );

  const tacticBoxDefMod =
    tactic === 'counter' ? 10 : tactic === 'balanced' ? 3 : tactic === 'possession' ? 0 : tactic === 'gegenpressing' ? -6 : -2;
  const mgrDefMod =
    managerTraitId === 'catenaccio' || managerTraitId === 'defensive_architect' ? 6 : 0;
  const defStyleBoost = countStyles([...cbPlayers, ...centralMidPlayers, ...gkPlayers], [
    'stopper_cb',
    'ball_winner',
    'shot_stopper',
  ]) * 2.2;
  const boxCompactness = clamp(
    Math.round(
      (fProf.boxDefenseDensity * 0.46 + (cbDef * 0.38 + cbAer * 0.26 + gkShotStop * 0.22 + midDef * 0.14) * 0.54 + tacticBoxDefMod + mgrDefMod + Math.min(8, defStyleBoost)) *
        (0.92 + (tacticalFit - 50) / 250),
    ),
    30,
    99,
  );

  const tacticPressMod =
    tactic === 'gegenpressing' ? 14 : tactic === 'possession' ? 3 : tactic === 'counter' ? -13 : tactic === 'wingplay' ? 1 : 2;
  const mgrPressMod = managerTraitId === 'gegenpress_guru' ? 6 : 0;
  const pressStyleBoost = countStyles(outfield, ['box_to_box', 'ball_winner', 'line_breaker']) * 2.2;
  const pressIntensity = clamp(
    Math.round(
      (fProf.pressTrapShape * 0.46 + (teamSta * 0.38 + teamPhy * 0.34 + midPhy * 0.28) * 0.54 + tacticPressMod + mgrPressMod + Math.min(8, pressStyleBoost)) *
        execScale,
    ),
    25,
    99,
  );

  const resistStyleBoost = countStyles(buildupSpine, [
    'deep_playmaker',
    'ball_playing_cb',
    'sweeper_keeper',
    'playmaker_10',
  ]) * 3.0;
  const pressResistance = clamp(
    Math.round(
      (midPas * 0.35 + midDri * 0.25 + cbPas * 0.25 + gkKic * 0.15 + Math.min(10, resistStyleBoost) + (tactic === 'possession' ? 6 : tactic === 'counter' ? 3 : tactic === 'balanced' ? 2 : tactic === 'gegenpressing' ? -2 : 0)) *
        (0.92 + (tacticalFit - 50) / 250),
    ),
    30,
    99,
  );

  const result: TeamTacticalProfile = {
    formation,
    tactic,
    tacticalFit,
    structureFit,
    personnelFit,
    managerFit,
    midfieldControl,
    flankAttack,
    flankDefense,
    highLineExposure,
    transitionThreat,
    boxPresence,
    boxCompactness,
    pressIntensity,
    pressResistance,
  };
  if (tacticalProfileCache.size >= MAX_TACTICAL_PROFILE_CACHE) {
    tacticalProfileCache.clear();
  }
  tacticalProfileCache.set(cacheKey, result);
  return result;
}

// ============================================================================
// 3. STAGE 2 — REALISTIC ZONE-BY-ZONE TACTICAL CLASH
// ============================================================================

export type TacticalZoneId = 'midfield' | 'flanks' | 'transition' | 'box' | 'pressing';

export interface TacticalZoneBattle {
  id: TacticalZoneId;
  label: string;
  shortLabel: string;
  delta: number; // positive = my edge, negative = opponent edge (-30..+30 typical)
  status: 'up' | 'even' | 'down';
  detail: string;
}

export interface RouteWeightModifiers {
  flankMult: number; // cross / cutback multiplier
  centralMult: number; // tiki-taka / through-ball multiplier
  counterMult: number; // low-block counter multiplier
  pressStealMult: number; // gegenpress steal multiplier
  aerialMult: number; // corner / header finish multiplier
}

export interface UnifiedTacticalMatchup {
  myProfile: TeamTacticalProfile;
  oppProfile: TeamTacticalProfile;
  zones: TacticalZoneBattle[];
  // Direct Match Engine Modifiers (strictly anti-symmetric & calibrated)
  attDelta: number; // -2.9 .. +2.9
  midDelta: number; // -2.9 .. +2.9
  defDelta: number; // -2.9 .. +2.9
  xgBonus: number; // 0 .. +0.38 (my side)
  oppXgPenalty: number; // 0 .. +0.28 (my defensive suppression on opp)
  awayXgBonus: number; // 0 .. +0.38 (opp side symmetric)
  awayOppXgPenalty: number; // 0 .. +0.28 (opp defensive suppression on me)
  possessionDelta: number; // -8.5 .. +8.5
  netOvrEquivalent: number; // -3.5 .. +3.5 summary metric
  verdict: 'advantage' | 'slight_advantage' | 'neutral' | 'slight_disadvantage' | 'disadvantage';
  routeWeightMods: RouteWeightModifiers;
}

function zoneStatus(delta: number): 'up' | 'even' | 'down' {
  if (delta >= 4.5) return 'up';
  if (delta <= -4.5) return 'down';
  return 'even';
}

/**
 * Evaluates our entire lineup setup (Manager + Formation + Tactic + Starters) against
 * the opponent's entire lineup setup across 5 real football zones.
 */
export function evaluateUnifiedTacticalMatchup(
  myInput: TeamTacticalInput,
  oppInput: TeamTacticalInput,
): UnifiedTacticalMatchup {
  const my = evaluateTeamTacticalProfile(myInput);
  const opp = evaluateTeamTacticalProfile(oppInput);

  // 1) Midfield Control Battle
  const midDeltaRaw = my.midfieldControl - opp.midfieldControl;

  // 2) Flank Space Attack vs Cover Battle
  const myFlankEdge = my.flankAttack - opp.flankDefense;
  const oppFlankEdge = opp.flankAttack - my.flankDefense;
  const flankDeltaRaw = (myFlankEdge - oppFlankEdge) * 0.72;

  // 3) High-Line Exposure vs Transition Counter Speed Battle
  // Exploiting opponent's high line with fast transition vs getting caught behind our own high line
  const myCounterExploit = (my.transitionThreat * (0.4 + opp.highLineExposure / 110)) - 48;
  const oppCounterExploit = (opp.transitionThreat * (0.4 + my.highLineExposure / 110)) - 48;
  const transitionDeltaRaw = (myCounterExploit - oppCounterExploit) * 0.78;

  // 4) Box Aerial/Finishing Presence vs Compact Defensive Block Battle
  const myBoxEdge = my.boxPresence - opp.boxCompactness;
  const oppBoxEdge = opp.boxPresence - my.boxCompactness;
  const boxDeltaRaw = (myBoxEdge - oppBoxEdge) * 0.72;

  // 5) High Press Intensity vs Press Resistance Battle
  const myPressEdge = my.pressIntensity - opp.pressResistance;
  const oppPressEdge = opp.pressIntensity - my.pressResistance;
  const pressDeltaRaw = (myPressEdge - oppPressEdge) * 0.68;

  // Internal cohesion difference rewards coherent lineups over forced mismatches
  const fitDiff = my.tacticalFit - opp.tacticalFit;

  const zones: TacticalZoneBattle[] = [
    {
      id: 'midfield',
      label: '중원 주도권',
      shortLabel: '중원',
      delta: Math.round(midDeltaRaw * 10) / 10,
      status: zoneStatus(midDeltaRaw),
      detail: `우리 중원 장악 ${my.midfieldControl} vs 상대 ${opp.midfieldControl}`,
    },
    {
      id: 'flanks',
      label: '측면 공간',
      shortLabel: '측면',
      delta: Math.round(flankDeltaRaw * 10) / 10,
      status: zoneStatus(flankDeltaRaw),
      detail: `측면 공략(${my.flankAttack}) vs 상대 커버(${opp.flankDefense})`,
    },
    {
      id: 'transition',
      label: '뒷공간·전환',
      shortLabel: '전환',
      delta: Math.round(transitionDeltaRaw * 10) / 10,
      status: zoneStatus(transitionDeltaRaw),
      detail: `우리 역습(${my.transitionThreat})→상대 라인(${opp.highLineExposure})`,
    },
    {
      id: 'box',
      label: '박스·공중볼',
      shortLabel: '박스',
      delta: Math.round(boxDeltaRaw * 10) / 10,
      status: zoneStatus(boxDeltaRaw),
      detail: `박스 화력(${my.boxPresence}) vs 상대 밀집(${opp.boxCompactness})`,
    },
    {
      id: 'pressing',
      label: '압박·탈압박',
      shortLabel: '압박',
      delta: Math.round(pressDeltaRaw * 10) / 10,
      status: zoneStatus(pressDeltaRaw),
      detail: `전방 압박(${my.pressIntensity}) vs 상대 탈압박(${opp.pressResistance})`,
    },
  ];

  // Translate zone differentials into calibrated football match engine outputs (strictly anti-symmetric)
  // Midfield dominance feeds sustained final-third pressure (att) AND defending with the ball (def)!
  const attRaw =
    (midDeltaRaw * 0.30 +
      flankDeltaRaw * 0.24 +
      transitionDeltaRaw * 0.22 +
      boxDeltaRaw * 0.14 +
      pressDeltaRaw * 0.10) *
      0.12 +
    fitDiff * 0.065;

  const midRaw =
    (midDeltaRaw * 0.54 + pressDeltaRaw * 0.26 + flankDeltaRaw * 0.20) * 0.115 +
    fitDiff * 0.06;

  const defRaw =
    (midDeltaRaw * 0.32 +
      flankDeltaRaw * 0.22 +
      transitionDeltaRaw * 0.22 +
      boxDeltaRaw * 0.24) *
      0.115 +
    fitDiff * 0.065;

  const attDelta = Math.round(clamp(attRaw, -2.9, 2.9) * 100) / 100;
  const midDelta = Math.round(clamp(midRaw, -2.9, 2.9) * 100) / 100;
  const defDelta = Math.round(clamp(defRaw, -2.9, 2.9) * 100) / 100;

  const attSignal =
    midDeltaRaw * 0.30 + flankDeltaRaw * 0.24 + transitionDeltaRaw * 0.24 + boxDeltaRaw * 0.22 + fitDiff * 0.5;
  const defSignal =
    midDeltaRaw * 0.32 + boxDeltaRaw * 0.24 + flankDeltaRaw * 0.22 + transitionDeltaRaw * 0.22 + fitDiff * 0.5;

  // Thresholded tactical xG swing: routine balanced matches stay xG-neutral,
  // while genuine tactical counter-masterpieces unlock decisive chance quality.
  const xgBonus = Math.round(clamp(Math.max(0, attSignal - 6) * 0.022, 0, 0.32) * 100) / 100;
  const oppXgPenalty = Math.round(clamp(Math.max(0, defSignal - 6) * 0.015, 0, 0.22) * 100) / 100;
  const awayXgBonus = Math.round(clamp(Math.max(0, -attSignal - 6) * 0.022, 0, 0.32) * 100) / 100;
  const awayOppXgPenalty = Math.round(clamp(Math.max(0, -defSignal - 6) * 0.015, 0, 0.22) * 100) / 100;

  const possessionDelta =
    Math.round(
      clamp(midDeltaRaw * 0.34 + pressDeltaRaw * 0.14 + fitDiff * 0.09, -8.5, 8.5) * 10,
    ) / 10;

  const netOvrEquivalent =
    Math.round(
      clamp(
        (attDelta + midDelta + defDelta) / 3 +
          ((xgBonus - awayXgBonus) + (oppXgPenalty - awayOppXgPenalty)) * 1.4,
        -3.5,
        3.5,
      ) * 10,
    ) / 10;

  let verdict: UnifiedTacticalMatchup['verdict'] = 'neutral';
  if (netOvrEquivalent >= 1.3) verdict = 'advantage';
  else if (netOvrEquivalent >= 0.45) verdict = 'slight_advantage';
  else if (netOvrEquivalent <= -1.3) verdict = 'disadvantage';
  else if (netOvrEquivalent <= -0.45) verdict = 'slight_disadvantage';

  const routeWeightMods: RouteWeightModifiers = {
    flankMult: clamp(1 + myFlankEdge * 0.012, 0.72, 1.45),
    centralMult: clamp(1 + midDeltaRaw * 0.012, 0.75, 1.42),
    counterMult: clamp(1 + myCounterExploit * 0.015, 0.72, 1.55),
    pressStealMult: clamp(1 + myPressEdge * 0.014, 0.72, 1.50),
    aerialMult: clamp(1 + myBoxEdge * 0.012, 0.75, 1.42),
  };

  return {
    myProfile: my,
    oppProfile: opp,
    zones,
    attDelta,
    midDelta,
    defDelta,
    xgBonus,
    oppXgPenalty,
    awayXgBonus,
    awayOppXgPenalty,
    possessionDelta,
    netOvrEquivalent,
    verdict,
    routeWeightMods,
  };
}

// ============================================================================
// 4. AI MANAGER HALFTIME ACTIVE COUNTER ENGINE (LEAGUE / CUP / UCL / DREAM)
// ============================================================================

const TACTIC_KOREAN_NAME: Record<TacticId, string> = {
  possession: '점유율',
  gegenpressing: '게겐프레싱',
  counter: '선수비 후역습',
  wingplay: '측면 공략',
  balanced: '밸런스',
};

const ALL_TACTICS: TacticId[] = [
  'possession',
  'gegenpressing',
  'counter',
  'wingplay',
  'balanced',
];

const CANDIDATE_COUNTER_FORMATIONS: FormationId[] = [
  '4-3-3',
  '4-2-3-1',
  '4-4-2',
  '4-4-2-diamond',
  '3-5-2',
  '3-5-2-dm',
  '3-4-2-1',
  '3-4-3',
  '3-3-3-1',
];

/**
 * AI Manager actively reads 1st-half score, xG, possession, and 5-zone tactical clash,
 * then decides whether to switch formation, switch tactic, and make targeted bench subs.
 *
 * Manager OVR drives tactical acumen:
 * - Elite (OVR 88+): Sharp counter-analysis even when drawing or protecting a narrow lead (~85~95%)
 * - Established (OVR 80~87): Responds reliably when trailing or losing tactical zones (~60~78%)
 * - Lower-tier (OVR <80): Simpler, slower reactions mainly when clearly trailing (~30~48%)
 */
export function decideAiHalftimeAdjustment(params: {
  aiManager: AiManagerProfile;
  aiStarters: Player[];
  aiBench: Player[];
  aiFormation: FormationId;
  aiTactic: TacticId;
  userStarters: Player[];
  userFormation: FormationId;
  userTactic: TacticId;
  userManagerTraitId: ManagerTraitId | null;
  aiGoals: number;
  userGoals: number;
  aiXg: number;
  userXg: number;
  aiPossession: number;
  rng?: () => number;
}): AiHalftimeAdjustment | null {
  const {
    aiManager,
    aiStarters,
    aiBench,
    aiFormation,
    aiTactic,
    userStarters,
    userFormation,
    userTactic,
    userManagerTraitId,
    aiGoals,
    userGoals,
    aiXg,
    userXg,
    rng = Math.random,
  } = params;

  const scoreDiff = aiGoals - userGoals; // >0 AI leading, <0 AI trailing
  const xgDiff = aiXg - userXg;
  const ovr = aiManager.ovr;

  const baselineMatchup = evaluateUnifiedTacticalMatchup(
    {
      starters: aiStarters,
      formation: aiFormation,
      tactic: aiTactic,
      managerTraitId: aiManager.traitId,
      managerOvr: ovr,
    },
    {
      starters: userStarters,
      formation: userFormation,
      tactic: userTactic,
      managerTraitId: userManagerTraitId,
      managerOvr: 85,
    },
  );

  // Determine activation probability based on Manager OVR & match pressure
  let triggerProb = 0.25;
  if (ovr >= 90) {
    // World-class / HOF managers almost always make a smart tactical adjustment unless cruising by 2+ goals AND dominating
    if (scoreDiff <= 0 || baselineMatchup.netOvrEquivalent < 0.2 || xgDiff < -0.15) {
      triggerProb = 0.94;
    } else if (scoreDiff === 1) {
      triggerProb = 0.78; // Lock down lead or twist tactic against user's expected counter
    } else {
      triggerProb = 0.45;
    }
  } else if (ovr >= 84) {
    if (scoreDiff < 0 || baselineMatchup.netOvrEquivalent < -0.3) triggerProb = 0.82;
    else if (scoreDiff === 0) triggerProb = 0.62;
    else if (scoreDiff === 1 && xgDiff < -0.25) triggerProb = 0.52;
    else triggerProb = 0.28;
  } else if (ovr >= 78) {
    if (scoreDiff < 0) triggerProb = 0.68;
    else if (scoreDiff === 0 && baselineMatchup.netOvrEquivalent < -0.6) triggerProb = 0.48;
    else triggerProb = 0.22;
  } else {
    if (scoreDiff <= -2) triggerProb = 0.55;
    else if (scoreDiff < 0) triggerProb = 0.36;
    else triggerProb = 0.14;
  }

  if (rng() > triggerProb) {
    return null;
  }

  // Candidate formations pool scales with manager tactical range (OVR)
  const preferredForms = aiManager.preferredFormations ?? [aiFormation];
  const formationPoolSet = new Set<FormationId>([aiFormation, ...preferredForms]);
  if (ovr >= 88) {
    // Elite managers can flexibly deploy specialized formations when needed
    if (scoreDiff > 0) formationPoolSet.add('3-5-2-dm');
    if (scoreDiff < 0) {
      formationPoolSet.add('3-3-3-1');
      formationPoolSet.add('4-4-2-diamond');
      formationPoolSet.add('3-4-3');
    }
    formationPoolSet.add('4-2-3-1');
    formationPoolSet.add('4-3-3');
  } else if (ovr >= 82) {
    if (scoreDiff > 0) formationPoolSet.add('3-5-2-dm');
    if (scoreDiff < 0) formationPoolSet.add('4-4-2-diamond');
  }

  // Lower-OVR managers only change tactic (rarely formation)
  const candidateFormations: FormationId[] =
    ovr < 78 ? [aiFormation] : Array.from(formationPoolSet).filter((f) => CANDIDATE_COUNTER_FORMATIONS.includes(f));

  // Evaluate candidate (formation, tactic) pairs via the unified matchup engine
  type ScoredOption = {
    formation: FormationId;
    tactic: TacticId;
    score: number;
    remappedStarters: Player[];
  };

  const options: ScoredOption[] = [];

  for (const candForm of candidateFormations) {
    const remapped =
      candForm === aiFormation
        ? [...aiStarters]
        : optimizeCurrentStartersForFormation(
            aiStarters,
            candForm,
            aiTactic,
            aiManager.traitId,
          ).filter((p): p is Player => p !== null);

    if (remapped.length < 11) continue;

    // Guard: ensure switching formation doesn't cause severe out-of-position chaos
    const slots = FORMATIONS[candForm].slots;
    let severeCount = 0;
    for (let i = 0; i < 11; i += 1) {
      const fit = evaluatePositionFit(
        remapped[i],
        slots[i].subPosition,
        aiManager.traitId,
        slots[i].alternateSubPositions,
      );
      if (fit.fit === 'severe') severeCount += 1;
    }
    if (candForm !== aiFormation && severeCount > 0) continue;

    for (const candTactic of ALL_TACTICS) {
      if (candForm === aiFormation && candTactic === aiTactic) continue;

      const evalRes = evaluateUnifiedTacticalMatchup(
        {
          starters: remapped,
          formation: candForm,
          tactic: candTactic,
          managerTraitId: aiManager.traitId,
          managerOvr: ovr,
        },
        {
          starters: userStarters,
          formation: userFormation,
          tactic: userTactic,
          managerTraitId: userManagerTraitId,
          managerOvr: 85,
        },
      );

      // Situational score weighting: chasing favors ATT/xG, protecting lead favors DEF/oppXgPenalty
      let situationalBonus = 0;
      if (scoreDiff < 0) {
        situationalBonus += evalRes.attDelta * 0.7 + evalRes.xgBonus * 4.5;
        if (candTactic === 'gegenpressing' || candTactic === 'wingplay' || candTactic === 'possession') {
          situationalBonus += 0.35;
        }
        if (candForm === '3-3-3-1' && scoreDiff <= -1 && ovr >= 86) situationalBonus += 0.35;
      } else if (scoreDiff > 0) {
        situationalBonus += evalRes.defDelta * 0.8 + evalRes.oppXgPenalty * 5.0;
        if (candTactic === 'counter' || candTactic === 'balanced') situationalBonus += 0.45;
        if (candForm === '3-5-2-dm' || candForm === '4-2-3-1') situationalBonus += 0.35;
      } else {
        situationalBonus += evalRes.midDelta * 0.4;
      }

      // Slight preference for manager's comfort formations
      const comfortBonus = preferredForms.includes(candForm) ? 0.25 : 0;
      // Add controlled noise inversely proportional to manager OVR (elite managers read the pitch more accurately)
      const noiseRange = ovr >= 90 ? 0.22 : ovr >= 83 ? 0.65 : 1.35;
      const noise = (rng() - 0.5) * noiseRange;

      const totalScore =
        evalRes.netOvrEquivalent * 1.45 +
        (evalRes.myProfile.tacticalFit - 70) * 0.04 +
        situationalBonus +
        comfortBonus +
        noise;

      options.push({
        formation: candForm,
        tactic: candTactic,
        score: totalScore,
        remappedStarters: remapped,
      });
    }
  }

  options.sort((a, b) => b.score - a.score);
  const best = options[0];

  let nextFormation = aiFormation;
  let nextTactic = aiTactic;
  let nextStarters = [...aiStarters];
  let nextBench = [...aiBench];

  const baselineScore = baselineMatchup.netOvrEquivalent * 1.45 + (baselineMatchup.myProfile.tacticalFit - 70) * 0.04;
  if (best && (best.score > baselineScore + 0.15 || scoreDiff !== 0)) {
    nextFormation = best.formation;
    nextTactic = best.tactic;
    nextStarters = best.remappedStarters;
  }

  // Targeted Bench Substitutions (up to 2 subs for OVR 82+, 1 sub for lower OVR)
  const subsMade: { outPlayerName: string; inPlayerName: string }[] = [];
  const maxSubs = ovr >= 82 ? 2 : 1;
  const availableBench = nextBench.filter((p) => p.position !== 'GK');
  const slots = FORMATIONS[nextFormation].slots;

  if (availableBench.length > 0 && (scoreDiff <= 0 || ovr >= 84 || rng() < 0.55)) {
    const usedBenchIds = new Set<string>();
    const swappedStarterIndices = new Set<number>();

    for (let s = 0; s < maxSubs; s += 1) {
      let bestPair: { sIdx: number; bPlayer: Player; gain: number } | null = null;

      for (let i = 1; i < 11; i += 1) {
        if (swappedStarterIndices.has(i)) continue;
        const starter = nextStarters[i];
        if (!starter || starter.position === 'GK') continue;
        const slot = slots[i];

        // Prefer subbing lower-stamina or situationally mismatched starters
        const fatigueNeed = starter.stamina < 76 ? 3.5 : starter.stamina < 82 ? 1.5 : 0;

        for (const benchP of availableBench) {
          if (usedBenchIds.has(benchP.id)) continue;
          const fit = evaluatePositionFit(
            benchP,
            slot.subPosition,
            aiManager.traitId,
            slot.alternateSubPositions,
          );
          if (fit.fit === 'severe' || fit.fit === 'out_of_pos') continue;

          let roleBonus = 0;
          if (scoreDiff < 0 && (slot.position === 'FW' || slot.subPosition === 'CAM')) {
            roleBonus += 3.0;
          } else if (scoreDiff > 0 && (slot.position === 'DF' || slot.subPosition === 'CDM')) {
            roleBonus += 2.8;
          }

          const gain = fit.effectiveOvr - starter.ovr + fatigueNeed + roleBonus + 2.5; // +2.5 fresh legs
          if (gain >= 1.5 && (!bestPair || gain > bestPair.gain)) {
            bestPair = { sIdx: i, bPlayer: benchP, gain };
          }
        }
      }

      if (bestPair) {
        const outP = nextStarters[bestPair.sIdx];
        const inP = bestPair.bPlayer;
        nextStarters[bestPair.sIdx] = inP;
        nextBench = nextBench.map((b) => (b.id === inP.id ? outP : b));
        usedBenchIds.add(inP.id);
        swappedStarterIndices.add(bestPair.sIdx);
        subsMade.push({ outPlayerName: outP.name, inPlayerName: inP.name });
      }
    }
  }

  const changedFormation = nextFormation !== aiFormation;
  const changedTactic = nextTactic !== aiTactic;

  if (!changedFormation && !changedTactic && subsMade.length === 0) {
    return null;
  }

  // Concise 1-line broadcast header notification (strictly minimal!)
  const parts: string[] = [];
  if (changedFormation) {
    parts.push(`${FORMATIONS[nextFormation].name.split(' ')[0] === nextFormation ? nextFormation : FORMATIONS[nextFormation].id === '4-4-2-diamond' ? '4-4-2 다이아몬드' : FORMATIONS[nextFormation].id === '3-5-2-dm' ? '3-5-2 DM' : nextFormation} 전환`);
  }
  if (changedTactic) {
    parts.push(TACTIC_KOREAN_NAME[nextTactic]);
  }
  if (subsMade.length > 0) {
    parts.push(`교체 ${subsMade.length}명`);
  }

  const headline = `⚡ ${aiManager.name} 하프타임 대응: ${parts.join(' · ')}`;

  return {
    managerName: aiManager.name,
    managerOvr: aiManager.ovr,
    changedFormation,
    previousFormation: aiFormation,
    newFormation: nextFormation,
    changedTactic,
    previousTactic: aiTactic,
    newTactic: nextTactic,
    subsMade,
    headline,
    updatedStarters: nextStarters,
    updatedBench: nextBench,
  };
}
