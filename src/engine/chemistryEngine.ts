import { FORMATIONS } from '../data/formations';
import { evaluateSharedClubHeritage } from '../data/formerClubs';
import {
  evaluateManagerPlayerSynergy,
  evaluateManagerTeamEffect,
} from '../data/managerTraits';
import type {
  ChemistryLineType,
  ChemistryLink,
  ChemistryLinkStatus,
  ChemistryResult,
  FormationId,
  ManagerTraitId,
  PlayerSlotSynergy,
  StaffCoachId,
  TeamRatings,
} from '../types/game';
import type { TacticId } from '../types/league';
import type { Player, PlaystyleId } from '../types/player';
import { getPlayerAttributes } from './attributeEngine';
import { evaluatePositionFit } from './positionEngine';
import {
  evaluateStaffCoachEffect,
  getDevCoachPlayerBonus,
} from './staffCoachEngine';

/**
 * Unified 4-Pillar Player Synergy Engine:
 *   1) Playstyle Synergy (`style`): Authentic complementary football role pairs
 *   2) Same Nationality (`nation`): Identical nationalityCode
 *   3) Same Club incl. Verified Former Clubs (`club`): Current same club OR shared official career club
 *   4) Elite Pair (`elite`): Both adjacent players have base OVR >= 86
 *
 * Every active line counts equally as 1 point (1 line = 1 pt).
 * - Individual Player Link Synergy (`neighborBonus`): 2+ lines -> +1, 4+ lines -> +2, 8+ lines -> +3 (max +3)
 * - Independent Manager Compatibility (`managerBonus`): flat +1 for every matching player (decoupled, total max +4)
 * - Team Chemistry (0..100): Monotonic formation-normalized total line count (more lines = strictly higher chemistry)
 */
export const ELITE_PAIR_MIN_OVR = 86;

/**
 * Team Chemistry (0..100) line weights & OVR bonus constants.
 * Individual player synergy counts all 4 line types equally (1 line = 1 pt),
 * whereas Team Chemistry weights club cohesion highest and 88+ Elite pairs lowest
 * so mismatched superstar rosters cannot freeload 95+ team chemistry.
 */
export const TEAM_CHEMISTRY_LINE_WEIGHTS = {
  club: 1.25,
  nation: 1.0,
  style: 1.0,
  elite: 0.45,
} as const;

export const TEAM_CHEMISTRY_NEUTRAL_SCORE = 50;
export const TEAM_CHEMISTRY_MIN_BONUS = -1.5;
export const TEAM_CHEMISTRY_MAX_RAW_BONUS = 2.5;
export const TEAM_CHEMISTRY_ORG_BONUS_CAP = 0.8;
export const TEAM_CHEMISTRY_SYNERGY_DEDUCT_RATIO = 0.75;

export const COMPLEMENTARY_STYLE_PAIRS: [PlaystyleId, PlaystyleId][] = [
  ['playmaker_10', 'line_breaker'],
  ['playmaker_10', 'poacher'],
  ['playmaker_10', 'complete_forward'],
  ['playmaker_10', 'inverted_winger'],
  ['deep_playmaker', 'box_to_box'],
  ['deep_playmaker', 'ball_winner'],
  ['deep_playmaker', 'line_breaker'],
  ['deep_playmaker', 'ball_playing_cb'],
  ['attacking_wingback', 'inverted_winger'],
  ['attacking_wingback', 'complete_forward'],
  ['attacking_wingback', 'poacher'],
  ['attacking_wingback', 'classic_winger'],
  ['classic_winger', 'poacher'],
  ['classic_winger', 'complete_forward'],
  ['ball_playing_cb', 'stopper_cb'],
  ['ball_playing_cb', 'sweeper_keeper'],
  ['stopper_cb', 'shot_stopper'],
  ['ball_winner', 'box_to_box'],
  ['box_to_box', 'complete_forward'],
  ['inverted_winger', 'complete_forward'],
  ['inverted_winger', 'poacher'],
];

export function hasComplementaryPlaystyles(a: Player, b: Player): boolean {
  for (const [s1, s2] of COMPLEMENTARY_STYLE_PAIRS) {
    if (
      (a.playstyles.includes(s1) && b.playstyles.includes(s2)) ||
      (a.playstyles.includes(s2) && b.playstyles.includes(s1))
    ) {
      return true;
    }
  }
  return false;
}

export interface PairLinkEval {
  status: ChemistryLinkStatus;
  score: number; // exact number of active lines (0..4)
  reason: string;
  hasClubLink: boolean;
  hasNationLink: boolean;
  hasStyleLink: boolean;
  hasEliteLink: boolean;
  isFormerClubLink: boolean;
  sharedClubName?: string;
  isLegendWildcard: boolean;
  activeLines: ChemistryLineType[];
  clubContribution: number;
}

/**
 * Evaluates adjacent player-to-player chemistry strictly by the 4 official synergy rules.
 * Every active line (club, nation, style, elite) counts equally as 1 point.
 */
export function evaluatePairLink(
  a: Player,
  b: Player,
  _tactic: TacticId = 'balanced',
  _managerTraitId: ManagerTraitId | null = null,
): PairLinkEval {
  void _tactic;
  void _managerTraitId;
  const clubHeritage = evaluateSharedClubHeritage(a, b);
  const sameClub = clubHeritage.type === 'current';
  const isFormerClubLink = clubHeritage.type === 'former';
  const hasClubLink = sameClub || isFormerClubLink;
  const hasNationLink = a.nationalityCode === b.nationalityCode;
  const hasStyleLink = hasComplementaryPlaystyles(a, b);
  const hasEliteLink = a.ovr >= ELITE_PAIR_MIN_OVR && b.ovr >= ELITE_PAIR_MIN_OVR;

  const activeLines: ChemistryLineType[] = [];
  if (hasClubLink) activeLines.push('club');
  if (hasNationLink) activeLines.push('nation');
  if (hasStyleLink) activeLines.push('style');
  if (hasEliteLink) activeLines.push('elite');

  const reasons: string[] = [];
  if (sameClub) {
    reasons.push(`동일 구단(${clubHeritage.clubName})`);
  } else if (isFormerClubLink) {
    reasons.push(`전 소속팀(${clubHeritage.clubName})`);
  }
  if (hasNationLink) reasons.push('동일 국적');
  if (hasStyleLink) reasons.push('스타일 궁합');
  if (hasEliteLink) reasons.push(`엘리트 ${ELITE_PAIR_MIN_OVR}+`);

  const lineCount = activeLines.length;
  const clubContribution = hasClubLink ? 1 : 0;

  let status: ChemistryLinkStatus = 'none';
  if (lineCount >= 3) status = 'legend';
  else if (lineCount === 2) status = 'strong';
  else if (lineCount === 1) status = 'weak';

  return {
    status,
    score: lineCount,
    reason: reasons.length > 0 ? reasons.join(' + ') : '연결 없음',
    hasClubLink,
    hasNationLink,
    hasStyleLink,
    hasEliteLink,
    isFormerClubLink,
    sharedClubName: clubHeritage.clubName,
    isLegendWildcard: false,
    activeLines,
    clubContribution,
  };
}

/**
 * Computes:
 * 1) Team Chemistry (0..100): formation-normalized monotonic function of total active lines (1 line = 1 pt)
 *    Formula: totalActiveLines === 0 ? 0 : min(100, round(15 + (totalActiveLines / (edges * 1.9)) * 85))
 * 2) Per-slot Player Link Synergy (`neighborBonus`: 2+ lines -> +1, 4+ -> +2, 8+ -> +3)
 * 3) Decoupled Manager Compatibility (`managerBonus`: flat +1, no combined cap -> totalBonus up to +4)
 */
export function calculateChemistry(
  formationId: FormationId,
  starters: (Player | null)[],
  tactic: TacticId = 'balanced',
  managerTraitId: ManagerTraitId | null = null,
  managerOvr = 84,
  options?: {
    staffCoachId?: StaffCoachId | null;
    ffpChemPenalty?: number;
  },
): ChemistryResult {
  const formation = FORMATIONS[formationId] ?? FORMATIONS['4-3-3'];
  const links: ChemistryLink[] = [];
  const slotScoreMap: Record<
    number,
    {
      sum: number;
      count: number;
      clubHits: number;
      formerClubHits: number;
      nationHits: number;
      styleHits: number;
      eliteHits: number;
    }
  > = {};

  for (let i = 0; i < formation.slots.length; i += 1) {
    slotScoreMap[i] = {
      sum: 0,
      count: 0,
      clubHits: 0,
      formerClubHits: 0,
      nationHits: 0,
      styleHits: 0,
      eliteHits: 0,
    };
  }

  let clubLines = 0;
  let nationLines = 0;
  let styleLines = 0;
  let eliteLines = 0;
  const totalLinkCount = Math.max(1, formation.links.length);

  for (const [fromIndex, toIndex] of formation.links) {
    const a = starters[fromIndex];
    const b = starters[toIndex];

    if (!a || !b) {
      links.push({
        fromIndex,
        toIndex,
        status: 'none',
        score: 0,
        reason: '미배치',
        hasClubLink: false,
        hasNationLink: false,
        hasStyleLink: false,
        hasEliteLink: false,
        isFormerClubLink: false,
        isLegendWildcard: false,
        activeLines: [],
      });
      continue;
    }

    const result = evaluatePairLink(a, b, tactic, managerTraitId);
    if (result.hasClubLink) clubLines += 1;
    if (result.hasNationLink) nationLines += 1;
    if (result.hasStyleLink) styleLines += 1;
    if (result.hasEliteLink) eliteLines += 1;

    links.push({
      fromIndex,
      toIndex,
      status: result.status,
      score: result.score,
      reason: result.reason,
      hasClubLink: result.hasClubLink,
      hasNationLink: result.hasNationLink,
      hasStyleLink: result.hasStyleLink,
      hasEliteLink: result.hasEliteLink,
      isFormerClubLink: result.isFormerClubLink,
      sharedClubName: result.sharedClubName,
      isLegendWildcard: false,
      activeLines: result.activeLines,
    });

    for (const idx of [fromIndex, toIndex]) {
      slotScoreMap[idx].sum += result.score;
      slotScoreMap[idx].count += 1;
      if (result.hasClubLink) {
        if (result.isFormerClubLink) slotScoreMap[idx].formerClubHits += 1;
        else slotScoreMap[idx].clubHits += 1;
      }
      if (result.hasNationLink) slotScoreMap[idx].nationHits += 1;
      if (result.hasStyleLink) slotScoreMap[idx].styleHits += 1;
      if (result.hasEliteLink) slotScoreMap[idx].eliteHits += 1;
    }
  }

  const totalActiveLines = clubLines + nationLines + styleLines + eliteLines;
  const maxReferenceLines = Math.round(totalLinkCount * 1.65);
  // Strictly monotonic weighted line score: every added line raises chemistry,
  // while club/nation/style cohesion outweighs raw 88+ Elite star power so
  // mismatched superstar rosters cannot freeload 95+ team chemistry.
  const weightedLines =
    clubLines * TEAM_CHEMISTRY_LINE_WEIGHTS.club +
    nationLines * TEAM_CHEMISTRY_LINE_WEIGHTS.nation +
    styleLines * TEAM_CHEMISTRY_LINE_WEIGHTS.style +
    eliteLines * TEAM_CHEMISTRY_LINE_WEIGHTS.elite;
  const baseTotal =
    totalActiveLines === 0
      ? 0
      : Math.min(
          100,
          Math.max(
            0,
            Math.round(12 + (weightedLines / (totalLinkCount * 1.65)) * 88),
          ),
        );
  const staffChemBonus = evaluateStaffCoachEffect(
    options?.staffCoachId,
    tactic,
  ).chemBonus;
  const ffpPenalty = options?.ffpChemPenalty ?? 0;
  const total =
    totalActiveLines === 0 && staffChemBonus === 0 && ffpPenalty === 0
      ? 0
      : Math.min(100, Math.max(0, baseTotal + staffChemBonus + ffpPenalty));

  const chemistryOvrBonus = computeChemistryOvrBonus(total);

  const slotQuality: Record<number, ChemistryLinkStatus> = {};
  const slotSynergies: Record<number, PlayerSlotSynergy> = {};
  let matchedStyleCount = 0;

  for (let i = 0; i < formation.slots.length; i += 1) {
    const entry = slotScoreMap[i];
    const p = starters[i];
    const slot = formation.slots[i];

    if (!p) {
      slotQuality[i] = 'none';
      continue;
    }

    if (entry.styleHits > 0) {
      matchedStyleCount += 1;
    }

    const lineCount = entry.sum;
    if (lineCount >= 8) slotQuality[i] = 'legend';
    else if (lineCount >= 4) slotQuality[i] = 'strong';
    else if (lineCount >= 2) slotQuality[i] = 'weak';
    else slotQuality[i] = 'none';

    // 1) Universal line-count Player Synergy Bonus (2 -> +1, 4 -> +2, 8 -> +3)
    const neighborBonus =
      lineCount >= 8 ? 3 : lineCount >= 4 ? 2 : lineCount >= 2 ? 1 : 0;

    // 2) Decoupled flat +1 Manager Style Compatibility Bonus (never capped by neighborBonus)
    const mgrEval = evaluateManagerPlayerSynergy(p, managerTraitId, managerOvr);
    const managerBonus = mgrEval.isMatch ? 1 : 0;

    const totalBonus = neighborBonus + managerBonus;

    const playerReasons: string[] = [];
    if (neighborBonus > 0) {
      const linkTags: string[] = [];
      if (entry.clubHits > 0) linkTags.push(`구단 ${entry.clubHits}`);
      if (entry.formerClubHits > 0) linkTags.push(`전소속 ${entry.formerClubHits}`);
      if (entry.nationHits > 0) linkTags.push(`국적 ${entry.nationHits}`);
      if (entry.styleHits > 0) linkTags.push(`스타일 ${entry.styleHits}`);
      if (entry.eliteHits > 0) linkTags.push(`엘리트 ${entry.eliteHits}`);
      const detail = linkTags.length > 0 ? ` (${linkTags.join('·')})` : '';
      playerReasons.push(`연결 ${lineCount}선 → +${neighborBonus}${detail}`);
    }

    const managerReason = managerBonus > 0 ? `감독 궁합 +1` : undefined;
    const reasons: string[] = [];
    if (playerReasons.length > 0) reasons.push(...playerReasons);
    if (managerReason) reasons.push(managerReason);

    const fit = evaluatePositionFit(
      p,
      slot.subPosition,
      managerTraitId,
      slot.alternateSubPositions,
    );
    const baseEffectiveOvr = fit.effectiveOvr;
    const effectiveOvrWithSynergy = Math.min(99, baseEffectiveOvr + totalBonus);

    slotSynergies[i] = {
      slotIndex: i,
      playerId: p.id,
      totalBonus,
      managerBonus,
      neighborBonus,
      lineCount,
      reasons,
      playerReasons,
      managerReason,
      baseEffectiveOvr,
      effectiveOvrWithSynergy,
    };
  }

  return {
    total,
    breakdown: {
      club: clubLines,
      nation: nationLines,
      tacticStyle: styleLines,
      roleBalance: eliteLines,
      elite: eliteLines,
      totalLines: totalActiveLines,
      maxReferenceLines,
    },
    chemistryOvrBonus,
    links,
    slotQuality,
    slotSynergies,
    matchedStyleCount,
  };
}

/**
 * Returns a copy of starter players with their individual slotSynergy (+ dev-coach) OVR boosts
 * applied directly to ovr/att/mid/def AND sub-attributes (`attrs`) so match simulation engines
 * (scorer/assister selection & individual impact) reflect exact pitch-displayed stats.
 */
export function applySlotSynergiesToStarters(
  starters: (Player | null)[],
  slotSynergies?: Record<number, PlayerSlotSynergy>,
  staffCoachId: StaffCoachId | null = null,
): Player[] {
  const out: Player[] = [];
  for (let i = 0; i < starters.length; i += 1) {
    const p = starters[i];
    if (!p) continue;
    const synBonus = slotSynergies?.[i]?.totalBonus ?? 0;
    const devLift = staffCoachId ? getDevCoachPlayerBonus(p, staffCoachId) : 0;
    const bonus = synBonus + devLift;
    if (bonus <= 0) {
      out.push(p);
    } else {
      const baseAttrs = getPlayerAttributes(p);
      const lift = Math.round(bonus);
      const liftedAttrs = {
        sho: Math.min(99, baseAttrs.sho + lift),
        pas: Math.min(99, baseAttrs.pas + lift),
        cro: Math.min(99, baseAttrs.cro + lift),
        dri: Math.min(99, baseAttrs.dri + lift),
        aer: Math.min(99, baseAttrs.aer + lift),
        def: Math.min(99, baseAttrs.def + lift),
        phy: Math.min(99, baseAttrs.phy + lift),
        ...(baseAttrs.gk
          ? {
              gk: {
                div: Math.min(99, baseAttrs.gk.div + lift),
                han: Math.min(99, baseAttrs.gk.han + lift),
                kic: Math.min(99, baseAttrs.gk.kic + lift),
                ref: Math.min(99, baseAttrs.gk.ref + lift),
                pos: Math.min(99, baseAttrs.gk.pos + lift),
              },
            }
          : {}),
      };
      out.push({
        ...p,
        ovr: Math.min(99, p.ovr + bonus),
        att: Math.min(99, p.att + bonus),
        mid: Math.min(99, p.mid + bonus),
        def: Math.min(99, p.def + bonus),
        attrs: liftedAttrs,
      });
    }
  }
  return out;
}

/**
 * Computes position-fit-adjusted ATT/MID/DEF/OVR incorporating:
 *  - Individual player link synergy (+0..+3) & decoupled manager compatibility (+1)
 *  - Non-double-counted team chemistry organization bonus (capped +0.8)
 *  - Real-time Manager Philosophy (1..8 progressive) & Recommended Tactic team bonuses
 */
export function calculateTeamRatings(
  formationId: FormationId,
  starters: (Player | null)[],
  chemistryTotal: number,
  managerTraitId: ManagerTraitId | null = null,
  slotSynergies?: Record<number, PlayerSlotSynergy>,
  tactic: TacticId = 'balanced',
  staffCoachId: StaffCoachId | null = null,
): TeamRatings {
  const formation = FORMATIONS[formationId] ?? FORMATIONS['4-3-3'];
  const adjusted: {
    player: Player;
    slotPos: 'GK' | 'DF' | 'MF' | 'FW';
    effectiveOvr: number;
    effectiveAtt: number;
    effectiveMid: number;
    effectiveDef: number;
    synergyBonus: number;
  }[] = [];

  for (let i = 0; i < formation.slots.length; i += 1) {
    const p = starters[i];
    if (!p) continue;
    const slot = formation.slots[i];
    const fit = evaluatePositionFit(
      p,
      slot.subPosition,
      managerTraitId,
      slot.alternateSubPositions,
    );
    const synBonus = slotSynergies?.[i]?.totalBonus ?? 0;
    const devCoachLift = getDevCoachPlayerBonus(p, staffCoachId);
    adjusted.push({
      player: p,
      slotPos: slot.position,
      effectiveOvr: Math.min(99, fit.effectiveOvr + synBonus + devCoachLift),
      effectiveAtt: Math.min(
        99,
        Math.max(30, p.att + fit.penalty + synBonus + devCoachLift),
      ),
      effectiveMid: Math.min(
        99,
        Math.max(30, p.mid + fit.penalty + synBonus + devCoachLift),
      ),
      effectiveDef: Math.min(
        99,
        Math.max(30, p.def + fit.penalty + synBonus + devCoachLift),
      ),
      synergyBonus: synBonus,
    });
  }

  if (adjusted.length === 0) {
    return {
      att: 0,
      mid: 0,
      def: 0,
      ovr: 0,
      rawOvr: 0,
      chemistryBonus: 0,
      synergyOvrBonus: 0,
      effectiveAtt: 0,
      effectiveMid: 0,
      effectiveDef: 0,
      managerAttBonus: 0,
      managerMidBonus: 0,
      managerDefBonus: 0,
      managerMatchedCount: 0,
      managerTargetCount: 0,
      managerTacticActive: false,
      managerEffectSummary: '',
      staffAttBonus: 0,
      staffMidBonus: 0,
      staffDefBonus: 0,
      staffCoachEffectSummary: '',
    };
  }

  const avg = (
    list: typeof adjusted,
    getter: (x: (typeof adjusted)[number]) => number,
    fallback: number,
  ) =>
    list.length > 0
      ? list.reduce((acc, x) => acc + getter(x), 0) / list.length
      : fallback;

  const rawOvrAvg = avg(adjusted, (x) => x.player.ovr, 75);
  const effOvrAvg = avg(adjusted, (x) => x.effectiveOvr, 75);
  const avgSynergyBonus =
    Math.round(avg(adjusted, (x) => x.synergyBonus, 0) * 100) / 100;

  const fwList = adjusted.filter((x) => x.slotPos === 'FW');
  const mfList = adjusted.filter((x) => x.slotPos === 'MF');
  const dfGkList = adjusted.filter(
    (x) => x.slotPos === 'DF' || x.slotPos === 'GK',
  );

  const rawAtt =
    fwList.length > 0 && mfList.length > 0
      ? avg(fwList, (x) => x.effectiveAtt, effOvrAvg) * 0.7 +
        avg(mfList, (x) => x.effectiveAtt, effOvrAvg - 2) * 0.3
      : avg(fwList, (x) => x.effectiveAtt, effOvrAvg);

  const rawMid =
    mfList.length > 0
      ? avg(mfList, (x) => x.effectiveMid, effOvrAvg) * 0.72 +
        avg(
          adjusted.filter((x) => x.slotPos !== 'GK'),
          (x) => x.effectiveMid,
          effOvrAvg,
        ) *
          0.28
      : effOvrAvg;

  const rawDef =
    dfGkList.length > 0 && mfList.length > 0
      ? avg(dfGkList, (x) => x.effectiveDef, effOvrAvg) * 0.76 +
        avg(mfList, (x) => x.effectiveDef, effOvrAvg - 5) * 0.24
      : avg(dfGkList, (x) => x.effectiveDef, effOvrAvg);

  const fullChemBonus = computeChemistryOvrBonus(chemistryTotal);
  const teamOrgBonus = slotSynergies
    ? fullChemBonus < 0
      ? fullChemBonus
      : Math.round(
          Math.min(
            TEAM_CHEMISTRY_ORG_BONUS_CAP,
            Math.max(
              0,
              fullChemBonus -
                avgSynergyBonus * TEAM_CHEMISTRY_SYNERGY_DEDUCT_RATIO,
            ),
          ) * 100,
        ) / 100
    : fullChemBonus;

  // Single-source-of-truth Manager Philosophy + Recommended Tactic A/M/D bonus
  const mgrEffect = evaluateManagerTeamEffect({
    traitId: managerTraitId,
    starters,
    tactic,
  });

  // Single-source-of-truth Mid-season Assistant Coach A/M/D bonus
  const staffEffect = evaluateStaffCoachEffect(staffCoachId, tactic);

  const totalAttBonus = mgrEffect.baseAttDelta + staffEffect.attDelta;
  const totalMidBonus = mgrEffect.baseMidDelta + staffEffect.midDelta;
  const totalDefBonus = mgrEffect.baseDefDelta + staffEffect.defDelta;

  return {
    att: Math.round(rawAtt + totalAttBonus),
    mid: Math.round(rawMid + totalMidBonus),
    def: Math.round(rawDef + totalDefBonus),
    ovr: Math.round(
      effOvrAvg + (totalAttBonus + totalMidBonus + totalDefBonus) / 3,
    ),
    rawOvr: Math.round(rawOvrAvg),
    chemistryBonus: fullChemBonus,
    synergyOvrBonus: avgSynergyBonus,
    effectiveAtt:
      Math.round((rawAtt + teamOrgBonus + totalAttBonus) * 10) / 10,
    effectiveMid:
      Math.round((rawMid + teamOrgBonus + totalMidBonus) * 10) / 10,
    effectiveDef:
      Math.round((rawDef + teamOrgBonus + totalDefBonus) * 10) / 10,
    managerAttBonus: mgrEffect.baseAttDelta,
    managerMidBonus: mgrEffect.baseMidDelta,
    managerDefBonus: mgrEffect.baseDefDelta,
    managerMatchedCount: mgrEffect.matchedCount,
    managerTargetCount: mgrEffect.targetCount,
    managerTacticActive: mgrEffect.isTacticSynergyActive,
    managerEffectSummary: mgrEffect.compactSummary,
    staffAttBonus: staffEffect.attDelta,
    staffMidBonus: staffEffect.midDelta,
    staffDefBonus: staffEffect.defDelta,
    staffCoachEffectSummary: staffEffect.statusChip,
  };
}

export function computeChemistryOvrBonus(chemistryTotal: number): number {
  const clamped = Math.min(100, Math.max(0, chemistryTotal));
  const raw =
    clamped <= TEAM_CHEMISTRY_NEUTRAL_SCORE
      ? TEAM_CHEMISTRY_MIN_BONUS +
        (clamped / TEAM_CHEMISTRY_NEUTRAL_SCORE) *
          Math.abs(TEAM_CHEMISTRY_MIN_BONUS)
      : ((clamped - TEAM_CHEMISTRY_NEUTRAL_SCORE) /
          (100 - TEAM_CHEMISTRY_NEUTRAL_SCORE)) *
        TEAM_CHEMISTRY_MAX_RAW_BONUS;
  return Math.round(raw * 100) / 100;
}

// =============================================================================
// Transfer Market Virtual Swap Preview (Before -> After Delta)
// =============================================================================

export interface TradePreviewSlotRef {
  area: 'starter' | 'bench';
  index: number;
}

export interface TradePreviewIncomingItem {
  player: Player;
  isFiller?: boolean;
}

export interface TradeSwapPreviewPair {
  slotKey: string;
  area: 'starter' | 'bench';
  index: number;
  slotLabel: string;
  outPlayer: Player;
  inPlayer: Player;
  isFiller: boolean;
  inPositionFit: ReturnType<typeof evaluatePositionFit> | null;
  outPositionFit: ReturnType<typeof evaluatePositionFit> | null;
  inManagerMatch: boolean;
  outManagerMatch: boolean;
  inSlotSynergy: PlayerSlotSynergy | null;
  outSlotSynergy: PlayerSlotSynergy | null;
  lineDelta: number;
}

export interface TradeSwapPreviewResult {
  isActive: boolean;
  previewStarters: (Player | null)[];
  previewBench: (Player | null)[];
  previewSlotKeys: Set<string>;
  swapPairs: TradeSwapPreviewPair[];
  beforeChemistry: ChemistryResult;
  afterChemistry: ChemistryResult;
  chemDelta: number;
  totalLinesBefore: number;
  totalLinesAfter: number;
  totalLinesDelta: number;
  beforeRatings: TeamRatings;
  afterRatings: TeamRatings;
  attDelta: number;
  midDelta: number;
  defDelta: number;
  beforeEffectiveAvgOvr: number;
  afterEffectiveAvgOvr: number;
  ovrDelta: number;
  rawOvrDelta: number;
  managerFitBefore: number;
  managerFitAfter: number;
  managerFitDelta: number;
  managerFitTarget: number;
  cashBeforeM?: number;
  cashAfterM?: number;
  cashDeltaM?: number;
}

function getPermutations<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr];
  const res: T[][] = [];
  for (let i = 0; i < arr.length; i += 1) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const perm of getPermutations(rest)) {
      res.push([arr[i], ...perm]);
    }
  }
  return res;
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

/**
 * Computes a live virtual-swap preview of placing incoming trade/FA player(s) into the user's
 * selected outgoing slot(s) without mutating actual squad state.
 */
export function computeTradeSwapPreview(params: {
  formationId: FormationId;
  starters: (Player | null)[];
  bench: (Player | null)[];
  outSlots: TradePreviewSlotRef[];
  inItems: TradePreviewIncomingItem[];
  tactic: TacticId;
  managerTraitId: ManagerTraitId | null;
  staffCoachId?: StaffCoachId | null;
  ffpChemPenalty?: number;
  beforeChemistry?: ChemistryResult;
  beforeRatings?: TeamRatings;
  cashBeforeM?: number;
  cashOfferM?: number;
}): TradeSwapPreviewResult {
  const {
    formationId,
    starters,
    bench,
    outSlots,
    inItems,
    tactic,
    managerTraitId,
    staffCoachId = null,
    ffpChemPenalty = 0,
    cashBeforeM,
    cashOfferM = 0,
  } = params;

  const formation = FORMATIONS[formationId] ?? FORMATIONS['4-3-3'];
  const chemOpts = { staffCoachId, ffpChemPenalty };

  const beforeChemistry =
    params.beforeChemistry ??
    calculateChemistry(
      formationId,
      starters,
      tactic,
      managerTraitId,
      undefined,
      chemOpts,
    );
  const beforeRatings =
    params.beforeRatings ??
    calculateTeamRatings(
      formationId,
      starters,
      beforeChemistry.total,
      managerTraitId,
      beforeChemistry.slotSynergies,
      tactic,
      staffCoachId,
    );

  const validOutSlots = outSlots
    .map((ref) => ({
      ref,
      player:
        ref.area === 'starter'
          ? (starters[ref.index] ?? null)
          : (bench[ref.index] ?? null),
    }))
    .filter(
      (x): x is { ref: TradePreviewSlotRef; player: Player } =>
        x.player !== null,
    );

  const pairCount = Math.min(validOutSlots.length, inItems.length);
  const beforeEffAvg = round1(
    (beforeRatings.effectiveAtt +
      beforeRatings.effectiveMid +
      beforeRatings.effectiveDef) /
      3,
  );
  const totalLinesBefore =
    beforeChemistry.breakdown.totalLines ??
    beforeChemistry.breakdown.club +
      beforeChemistry.breakdown.nation +
      beforeChemistry.breakdown.tacticStyle +
      beforeChemistry.breakdown.roleBalance;

  if (pairCount === 0) {
    return {
      isActive: false,
      previewStarters: starters,
      previewBench: bench,
      previewSlotKeys: new Set<string>(),
      swapPairs: [],
      beforeChemistry,
      afterChemistry: beforeChemistry,
      chemDelta: 0,
      totalLinesBefore,
      totalLinesAfter: totalLinesBefore,
      totalLinesDelta: 0,
      beforeRatings,
      afterRatings: beforeRatings,
      attDelta: 0,
      midDelta: 0,
      defDelta: 0,
      beforeEffectiveAvgOvr: beforeEffAvg,
      afterEffectiveAvgOvr: beforeEffAvg,
      ovrDelta: 0,
      rawOvrDelta: 0,
      managerFitBefore: beforeRatings.managerMatchedCount ?? 0,
      managerFitAfter: beforeRatings.managerMatchedCount ?? 0,
      managerFitDelta: 0,
      managerFitTarget: beforeRatings.managerTargetCount ?? 0,
      ...(typeof cashBeforeM === 'number'
        ? {
            cashBeforeM,
            cashAfterM: Math.max(0, cashBeforeM - Math.max(0, cashOfferM)),
            cashDeltaM: -Math.min(cashBeforeM, Math.max(0, cashOfferM)),
          }
        : {}),
    };
  }

  // Pair up to 3 incoming players into outgoing slots by best positional fit
  // (prioritizing non-filler primary targets for starter slots)
  const chosenOut = validOutSlots.slice(0, pairCount);
  const chosenIn = inItems.slice(0, pairCount);

  const inPerms = getPermutations(chosenIn);
  let bestPerm = chosenIn;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const perm of inPerms) {
    let score = 0;
    for (let i = 0; i < pairCount; i += 1) {
      const outEntry = chosenOut[i];
      const inEntry = perm[i];
      if (outEntry.ref.area === 'starter') {
        const slot = formation.slots[outEntry.ref.index];
        if (slot) {
          const fit = evaluatePositionFit(
            inEntry.player,
            slot.subPosition,
            managerTraitId,
            slot.alternateSubPositions,
          );
          score += fit.effectiveOvr + (fit.penalty === 0 ? 15 : fit.penalty * 2);
        }
        // Strongly prefer primary trade target over backup filler in starter slots
        score += inEntry.isFiller ? -40 : 40;
      } else {
        score += inEntry.isFiller ? 10 : 0;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestPerm = perm;
    }
  }

  const previewStarters = [...starters];
  const previewBench = [...bench];
  const previewSlotKeys = new Set<string>();

  for (let i = 0; i < pairCount; i += 1) {
    const { ref } = chosenOut[i];
    const inItem = bestPerm[i];
    const k = `${ref.area}:${ref.index}`;
    previewSlotKeys.add(k);
    if (ref.area === 'starter') {
      previewStarters[ref.index] = inItem.player;
    } else {
      previewBench[ref.index] = inItem.player;
    }
  }

  const afterChemistry = calculateChemistry(
    formationId,
    previewStarters,
    tactic,
    managerTraitId,
    undefined,
    chemOpts,
  );
  const afterRatings = calculateTeamRatings(
    formationId,
    previewStarters,
    afterChemistry.total,
    managerTraitId,
    afterChemistry.slotSynergies,
    tactic,
    staffCoachId,
  );

  const swapPairs: TradeSwapPreviewPair[] = [];
  for (let i = 0; i < pairCount; i += 1) {
    const { ref, player: outPlayer } = chosenOut[i];
    const inItem = bestPerm[i];
    const k = `${ref.area}:${ref.index}`;
    const slot = ref.area === 'starter' ? formation.slots[ref.index] : undefined;
    const inPositionFit = slot
      ? evaluatePositionFit(
          inItem.player,
          slot.subPosition,
          managerTraitId,
          slot.alternateSubPositions,
        )
      : null;
    const outPositionFit = slot
      ? evaluatePositionFit(
          outPlayer,
          slot.subPosition,
          managerTraitId,
          slot.alternateSubPositions,
        )
      : null;
    const inSlotSynergy =
      ref.area === 'starter'
        ? (afterChemistry.slotSynergies[ref.index] ?? null)
        : null;
    const outSlotSynergy =
      ref.area === 'starter'
        ? (beforeChemistry.slotSynergies[ref.index] ?? null)
        : null;
    const inLines = inSlotSynergy?.lineCount ?? 0;
    const outLines = outSlotSynergy?.lineCount ?? 0;

    swapPairs.push({
      slotKey: k,
      area: ref.area,
      index: ref.index,
      slotLabel: slot ? slot.label : `벤치 ${ref.index + 1}`,
      outPlayer,
      inPlayer: inItem.player,
      isFiller: Boolean(inItem.isFiller),
      inPositionFit,
      outPositionFit,
      inManagerMatch: evaluateManagerPlayerSynergy(
        inItem.player,
        managerTraitId,
      ).isMatch,
      outManagerMatch: evaluateManagerPlayerSynergy(
        outPlayer,
        managerTraitId,
      ).isMatch,
      inSlotSynergy,
      outSlotSynergy,
      lineDelta: inLines - outLines,
    });
  }

  const totalLinesAfter =
    afterChemistry.breakdown.totalLines ??
    afterChemistry.breakdown.club +
      afterChemistry.breakdown.nation +
      afterChemistry.breakdown.tacticStyle +
      afterChemistry.breakdown.roleBalance;
  const afterEffAvg = round1(
    (afterRatings.effectiveAtt +
      afterRatings.effectiveMid +
      afterRatings.effectiveDef) /
      3,
  );

  return {
    isActive: true,
    previewStarters,
    previewBench,
    previewSlotKeys,
    swapPairs,
    beforeChemistry,
    afterChemistry,
    chemDelta: afterChemistry.total - beforeChemistry.total,
    totalLinesBefore,
    totalLinesAfter,
    totalLinesDelta: totalLinesAfter - totalLinesBefore,
    beforeRatings,
    afterRatings,
    attDelta: round1(afterRatings.effectiveAtt - beforeRatings.effectiveAtt),
    midDelta: round1(afterRatings.effectiveMid - beforeRatings.effectiveMid),
    defDelta: round1(afterRatings.effectiveDef - beforeRatings.effectiveDef),
    beforeEffectiveAvgOvr: beforeEffAvg,
    afterEffectiveAvgOvr: afterEffAvg,
    ovrDelta: round1(afterEffAvg - beforeEffAvg),
    rawOvrDelta: afterRatings.rawOvr - beforeRatings.rawOvr,
    managerFitBefore: beforeRatings.managerMatchedCount ?? 0,
    managerFitAfter: afterRatings.managerMatchedCount ?? 0,
    managerFitDelta:
      (afterRatings.managerMatchedCount ?? 0) -
      (beforeRatings.managerMatchedCount ?? 0),
    managerFitTarget: afterRatings.managerTargetCount ?? 0,
    ...(typeof cashBeforeM === 'number'
      ? {
          cashBeforeM,
          cashAfterM: Math.max(0, cashBeforeM - Math.max(0, cashOfferM)),
          cashDeltaM: -Math.min(cashBeforeM, Math.max(0, cashOfferM)),
        }
      : {}),
  };
}
