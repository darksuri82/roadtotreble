import { FORMATIONS } from '../data/formations';
import { evaluateSharedClubHeritage } from '../data/formerClubs';
import { evaluateManagerPlayerSynergy } from '../data/managerTraits';
import type {
  ChemistryLineType,
  ChemistryLink,
  ChemistryLinkStatus,
  ChemistryResult,
  FormationId,
  ManagerTraitId,
  PlayerSlotSynergy,
  TeamRatings,
} from '../types/game';
import type { TacticId } from '../types/league';
import type { Player, PlaystyleId } from '../types/player';
import { evaluatePositionFit } from './positionEngine';

/**
 * v5.0 Strict 4-Pillar Player Synergy Engine:
 *   1) Playstyle Synergy (`style`): Authentic complementary football role pairs ONLY
 *   2) Same Nationality (`nation`): Identical nationalityCode
 *   3) Same Club incl. Verified Former Clubs (`club`): Current same club OR shared official career club
 *   4) Elite Pair (`elite`): Both adjacent players have base OVR >= 88 (World-Class / Superstar / Legend)
 *
 * Manager Style Compatibility is strictly separated as an independent direct player OVR bonus (`managerBonus`).
 */
export const ELITE_PAIR_MIN_OVR = 88;

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
  score: number;
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
 * Evaluates adjacent player-to-player chemistry strictly by the 4 official synergy rules:
 *  1) Club (emerald): Same active club (1.6) OR shared verified former club career (1.25)
 *  2) Nation (sky): Same nationalityCode (1.1)
 *  3) Playstyle (gold): Authentic complementary playstyle pair (1.1)
 *  4) Elite Pair (violet): Both players base OVR >= 88 (1.25)
 */
export function evaluatePairLink(
  a: Player,
  b: Player,
  _tactic: TacticId = 'balanced',
  _managerTraitId: ManagerTraitId | null = null,
): PairLinkEval {
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
  if (hasEliteLink) reasons.push('엘리트 페어');

  const clubContribution = sameClub ? 1.5 : isFormerClubLink ? 1.15 : 0;
  const score =
    (sameClub ? 1.6 : isFormerClubLink ? 1.25 : 0) +
    (hasNationLink ? 1.1 : 0) +
    (hasStyleLink ? 1.1 : 0) +
    (hasEliteLink ? 1.25 : 0);

  let status: ChemistryLinkStatus = 'none';
  if (hasEliteLink && activeLines.length >= 2) status = 'legend';
  else if (activeLines.length >= 2 || sameClub) status = 'strong';
  else if (activeLines.length === 1) status = 'weak';

  return {
    status,
    score: Math.round(score * 100) / 100,
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
 * 4-Pillar Player-to-Player Team Chemistry (0..100) + Separated Manager Direct OVR Compatibility:
 *   1) Club (Current + Verified Former Clubs): max 30
 *   2) Same Nationality: max 25
 *   3) Complementary Playstyle Pairs: max 30
 *   4) Elite Pair (88+ ↔ 88+): max 15
 *
 * Independent Manager Style Fit (`managerBonus`: +0..+2 scaled by managerOvr) is calculated
 * separately per player and applied directly to each player's effective OVR without polluting player synergy links.
 */
export function calculateChemistry(
  formationId: FormationId,
  starters: (Player | null)[],
  tactic: TacticId = 'balanced',
  managerTraitId: ManagerTraitId | null = null,
  managerOvr = 84,
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

  let nationHits = 0;
  let clubSum = 0;
  let styleLinkHits = 0;
  let eliteLinkHits = 0;
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
    if (result.hasNationLink) nationHits += 1;
    clubSum += result.clubContribution;
    if (result.hasStyleLink) styleLinkHits += 1;
    if (result.hasEliteLink) eliteLinkHits += 1;

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

  // Pillar 1: Same Club + Former Club Heritage (max 35)
  const clubScore = Math.min(
    35,
    Math.round((clubSum / (totalLinkCount * 0.34)) * 35),
  );

  // Pillar 2: Same Nationality (max 20)
  const nationScore = Math.min(
    20,
    Math.round((nationHits / (totalLinkCount * 0.21)) * 20),
  );

  // Pillar 3: Complementary Playstyle Pairs (max 30)
  const styleScore = Math.min(
    30,
    Math.round((styleLinkHits / (totalLinkCount * 0.25)) * 30),
  );

  // Pillar 4: Elite Pair 88+ Superstar Chemistry (max 15)
  const eliteScore = Math.min(
    15,
    Math.round((eliteLinkHits / (totalLinkCount * 0.22)) * 15),
  );

  const total = Math.min(
    100,
    Math.max(0, clubScore + nationScore + styleScore + eliteScore),
  );

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

    if (entry.count === 0) {
      slotQuality[i] = 'none';
    } else {
      const avg = entry.sum / entry.count;
      if (entry.eliteHits > 0 && avg >= 1.55) slotQuality[i] = 'legend';
      else if (avg >= 1.7) slotQuality[i] = 'strong';
      else if (avg >= 0.75) slotQuality[i] = 'weak';
      else slotQuality[i] = 'none';
    }

    // 1) Strictly 4-Pillar Player-to-Player Synergy Bonus (0..2)
    let neighborBonus = 0;
    const totalClubHits = entry.clubHits + entry.formerClubHits;
    if (entry.count > 0) {
      const avgLink = entry.sum / entry.count;
      if (
        entry.sum >= 4.0 ||
        (avgLink >= 1.65 && entry.count >= 2) ||
        (totalClubHits >= 2 && entry.nationHits + entry.styleHits + entry.eliteHits >= 2)
      ) {
        neighborBonus = 2;
      } else if (
        entry.sum >= 1.25 ||
        totalClubHits >= 1 ||
        entry.eliteHits >= 1 ||
        entry.nationHits + entry.styleHits >= 2
      ) {
        neighborBonus = 1;
      }
    }

    // 2) Independent Manager Style × OVR Compatibility Bonus (0..2)
    const mgrEval = evaluateManagerPlayerSynergy(p, managerTraitId, managerOvr);
    const managerBonus = mgrEval.isMatch ? mgrEval.bonus : 0;

    // Combined cap at +3 to preserve season calibration
    const totalBonus = Math.min(3, neighborBonus + managerBonus);

    const playerReasons: string[] = [];
    if (neighborBonus > 0) {
      const linkTags: string[] = [];
      if (entry.clubHits > 0) linkTags.push('동일 구단');
      if (entry.formerClubHits > 0) linkTags.push('전 소속팀');
      if (entry.nationHits > 0) linkTags.push('동일 국적');
      if (entry.styleHits > 0) linkTags.push('스타일');
      if (entry.eliteHits > 0) linkTags.push('엘리트');
      const detail = linkTags.length > 0 ? ` (${linkTags.join('·')})` : '';
      playerReasons.push(`선수 시너지 +${neighborBonus}${detail}`);
    }

    const managerReason = managerBonus > 0 ? `감독 궁합 +${managerBonus}` : undefined;
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
      club: clubScore,
      nation: nationScore,
      tacticStyle: styleScore,
      roleBalance: eliteScore,
      elite: eliteScore,
    },
    chemistryOvrBonus,
    links,
    slotQuality,
    slotSynergies,
    matchedStyleCount,
  };
}

/**
 * Returns a copy of starter players with their individual slotSynergy OVR boosts applied
 * directly to ovr/att/mid/def so match simulation engines reflect exact pitch-displayed stats.
 */
export function applySlotSynergiesToStarters(
  starters: (Player | null)[],
  slotSynergies?: Record<number, PlayerSlotSynergy>,
): Player[] {
  const out: Player[] = [];
  for (let i = 0; i < starters.length; i += 1) {
    const p = starters[i];
    if (!p) continue;
    const bonus = slotSynergies?.[i]?.totalBonus ?? 0;
    if (bonus <= 0) {
      out.push(p);
    } else {
      out.push({
        ...p,
        ovr: Math.min(99, p.ovr + bonus),
        att: Math.min(99, p.att + bonus),
        mid: Math.min(99, p.mid + bonus),
        def: Math.min(99, p.def + bonus),
      });
    }
  }
  return out;
}

/**
 * Computes position-fit-adjusted ATT/MID/DEF/OVR incorporating individual player synergy + manager OVR boosts
 * and a balanced non-double-counted team chemistry adjustment.
 */
export function calculateTeamRatings(
  formationId: FormationId,
  starters: (Player | null)[],
  chemistryTotal: number,
  managerTraitId: ManagerTraitId | null = null,
  slotSynergies?: Record<number, PlayerSlotSynergy>,
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
    adjusted.push({
      player: p,
      slotPos: slot.position,
      effectiveOvr: Math.min(99, fit.effectiveOvr + synBonus),
      effectiveAtt: Math.min(99, Math.max(30, p.att + fit.penalty + synBonus)),
      effectiveMid: Math.min(99, Math.max(30, p.mid + fit.penalty + synBonus)),
      effectiveDef: Math.min(99, Math.max(30, p.def + fit.penalty + synBonus)),
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
      : Math.round(Math.min(0.8, Math.max(0, fullChemBonus - avgSynergyBonus * 0.75)) * 100) / 100
    : fullChemBonus;

  return {
    att: Math.round(rawAtt),
    mid: Math.round(rawMid),
    def: Math.round(rawDef),
    ovr: Math.round(effOvrAvg),
    rawOvr: Math.round(rawOvrAvg),
    chemistryBonus: fullChemBonus,
    synergyOvrBonus: avgSynergyBonus,
    effectiveAtt: Math.round((rawAtt + teamOrgBonus) * 10) / 10,
    effectiveMid: Math.round((rawMid + teamOrgBonus) * 10) / 10,
    effectiveDef: Math.round((rawDef + teamOrgBonus) * 10) / 10,
  };
}

export function computeChemistryOvrBonus(chemistryTotal: number): number {
  const clamped = Math.min(100, Math.max(0, chemistryTotal));
  const raw =
    clamped <= 50
      ? -1.5 + (clamped / 50) * 1.5
      : ((clamped - 50) / 50) * 2.5;
  return Math.round(raw * 100) / 100;
}
