import { FORMATIONS } from '../data/formations';
import { MANAGER_TRAITS } from '../data/managerTraits';
import { doesPlaystyleFitTactic, PLAYSTYLES } from '../data/playstyles';
import type {
  ChemistryLineType,
  ChemistryLink,
  ChemistryLinkStatus,
  ChemistryResult,
  FormationId,
  ManagerTraitId,
  TeamRatings,
} from '../types/game';
import type { TacticId } from '../types/league';
import type { Player, PlaystyleId } from '../types/player';
import { evaluatePositionFit } from './positionEngine';

const COMPLEMENTARY_STYLE_PAIRS: [PlaystyleId, PlaystyleId][] = [
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
  ['classic_winger', 'poacher'],
  ['classic_winger', 'complete_forward'],
  ['ball_playing_cb', 'stopper_cb'],
  ['ball_playing_cb', 'sweeper_keeper'],
  ['stopper_cb', 'shot_stopper'],
  ['ball_winner', 'box_to_box'],
  ['box_to_box', 'complete_forward'],
];

function hasComplementaryPlaystyles(a: Player, b: Player): boolean {
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
  isLegendWildcard: boolean;
  activeLines: ChemistryLineType[];
  clubContribution: number;
}

/**
 * Evaluates adjacent player chemistry WITHOUT "Same League".
 * Three independent visual & scoring link criteria:
 *  1) Club link (emerald): Same Club OR Legend wildcard (1 default club/tactic link)
 *  2) Nation link (sky blue): Same Nationality
 *  3) Playstyle/Tactic Synergy link (gold): Complementary playstyles OR both matching active tactic/manager
 */
export function evaluatePairLink(
  a: Player,
  b: Player,
  tactic: TacticId = 'balanced',
  managerTraitId: ManagerTraitId | null = null,
): PairLinkEval {
  const isLegendWildcard = a.isLegend || b.isLegend;
  const sameClub = !a.isLegend && !b.isLegend && a.club === b.club;
  const hasClubLink = sameClub || isLegendWildcard;
  const hasNationLink = a.nationalityCode === b.nationalityCode;

  const traitConfig = managerTraitId ? MANAGER_TRAITS[managerTraitId] : null;
  const aFitsTactic =
    doesPlaystyleFitTactic(a.playstyles, tactic) ||
    Boolean(traitConfig?.synergyPlaystyles?.some((ps) => a.playstyles.includes(ps)));
  const bFitsTactic =
    doesPlaystyleFitTactic(b.playstyles, tactic) ||
    Boolean(traitConfig?.synergyPlaystyles?.some((ps) => b.playstyles.includes(ps)));

  const hasStyleLink =
    hasComplementaryPlaystyles(a, b) ||
    (aFitsTactic && bFitsTactic) ||
    (isLegendWildcard && (aFitsTactic || bFitsTactic));

  const activeLines: ChemistryLineType[] = [];
  if (hasClubLink) activeLines.push('club');
  if (hasNationLink) activeLines.push('nation');
  if (hasStyleLink) activeLines.push('style');

  const reasons: string[] = [];
  if (sameClub) reasons.push('동일 구단');
  else if (isLegendWildcard) reasons.push('레전드 와일드카드');
  if (hasNationLink) reasons.push('동일 국적');
  if (hasStyleLink) reasons.push('플레이스타일 시너지');

  const clubContribution = sameClub ? 1.5 : isLegendWildcard ? 1.15 : 0;
  const score =
    (sameClub ? 1.6 : isLegendWildcard ? 1.2 : 0) +
    (hasNationLink ? 1.1 : 0) +
    (hasStyleLink ? 1.0 : 0);

  let status: ChemistryLinkStatus = 'none';
  if (isLegendWildcard && activeLines.length >= 2) status = 'legend';
  else if (activeLines.length >= 2 || sameClub) status = 'strong';
  else if (activeLines.length === 1) status = 'weak';

  return {
    status,
    score: Math.round(score * 100) / 100,
    reason: reasons.length > 0 ? reasons.join(' + ') : '연결 없음',
    hasClubLink,
    hasNationLink,
    hasStyleLink,
    isLegendWildcard,
    activeLines,
    clubContribution,
  };
}

/**
 * 4-Pillar Team Identity Chemistry (0..100) — NO "Same League":
 * 1) Same Club links (strong) + Legend wildcard: max 25
 * 2) Same Nationality links (medium): max 20
 * 3) Playstyle · Tactic · Manager Synergy (core pillar): max 40
 * 4) Squad Role Balance (complementary roles across lines): max 15
 *
 * Effective OVR adjustment: [-1.5 .. +2.5 OVR] piecewise linear (50 = neutral).
 */
export function calculateChemistry(
  formationId: FormationId,
  starters: (Player | null)[],
  tactic: TacticId = 'balanced',
  managerTraitId: ManagerTraitId | null = null,
): ChemistryResult {
  const formation = FORMATIONS[formationId];
  const links: ChemistryLink[] = [];
  const slotScoreMap: Record<
    number,
    { sum: number; count: number; hasLegend: boolean }
  > = {};

  for (let i = 0; i < formation.slots.length; i += 1) {
    slotScoreMap[i] = { sum: 0, count: 0, hasLegend: false };
  }

  let nationHits = 0;
  let clubSum = 0;
  let styleLinkHits = 0;
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
        isLegendWildcard: false,
        activeLines: [],
      });
      continue;
    }

    const result = evaluatePairLink(a, b, tactic, managerTraitId);
    if (result.hasNationLink) nationHits += 1;
    clubSum += result.clubContribution;
    if (result.hasStyleLink) styleLinkHits += 1;

    links.push({
      fromIndex,
      toIndex,
      status: result.status,
      score: result.score,
      reason: result.reason,
      hasClubLink: result.hasClubLink,
      hasNationLink: result.hasNationLink,
      hasStyleLink: result.hasStyleLink,
      isLegendWildcard: result.isLegendWildcard,
      activeLines: result.activeLines,
    });

    slotScoreMap[fromIndex].sum += result.score;
    slotScoreMap[fromIndex].count += 1;
    if (result.isLegendWildcard) slotScoreMap[fromIndex].hasLegend = true;

    slotScoreMap[toIndex].sum += result.score;
    slotScoreMap[toIndex].count += 1;
    if (result.isLegendWildcard) slotScoreMap[toIndex].hasLegend = true;
  }

  const filled = starters.filter((p): p is Player => p !== null);

  // Pillar 1: Same Club + Legend wildcard (max 25, NO Same League)
  // Roughly 30% adjacent club/legend links hits 25/25
  const clubScore = Math.min(
    25,
    Math.round((clubSum / (totalLinkCount * 0.42)) * 25),
  );

  // Pillar 2: Same Nationality (max 20) — ~32% of adjacent links hits 20/20
  const nationScore = Math.min(
    20,
    Math.round((nationHits / (totalLinkCount * 0.32)) * 20),
  );

  // Pillar 3: Playstyle · Tactic · Manager Synergy (max 40)
  const traitConfig = managerTraitId ? MANAGER_TRAITS[managerTraitId] : null;
  let matchedStyleCount = 0;
  let stylePoints = 0;

  for (const p of filled) {
    const fitsTactic = doesPlaystyleFitTactic(p.playstyles, tactic);
    const fitsManager = Boolean(
      traitConfig?.synergyPlaystyles?.some((ps) => p.playstyles.includes(ps)),
    );
    if (fitsTactic || fitsManager) {
      matchedStyleCount += 1;
      stylePoints += fitsTactic && fitsManager ? 1.25 : 1.0;
    } else if (p.isLegend) {
      stylePoints += 0.6;
    }
  }

  const pairStyleBonus = Math.min(
    8,
    Math.round((styleLinkHits / (totalLinkCount * 0.55)) * 8),
  );

  const managerTacticBonus =
    traitConfig?.synergyTactic && traitConfig.synergyTactic === tactic ? 5 : 0;

  const galacticoBonus =
    managerTraitId === 'galactico_manager'
      ? Math.min(6, filled.filter((p) => p.isLegend || p.ovr >= 91).length * 2)
      : 0;

  const tacticStyleScore =
    filled.length > 0
      ? Math.min(
          40,
          Math.round((stylePoints / 9.0) * 30) +
            pairStyleBonus +
            managerTacticBonus +
            galacticoBonus,
        )
      : 0;

  // Pillar 4: Squad Role Balance (max 15)
  const roleGroups = new Set<string>();
  for (const p of filled) {
    for (const ps of p.playstyles) {
      const meta = PLAYSTYLES[ps];
      if (meta) roleGroups.add(meta.roleGroup);
    }
  }
  const roleBalanceScore =
    filled.length > 0
      ? Math.min(15, Math.round((roleGroups.size / 6) * 15))
      : 0;

  const total = Math.min(
    100,
    Math.max(0, clubScore + nationScore + tacticStyleScore + roleBalanceScore),
  );

  const chemistryOvrBonus = computeChemistryOvrBonus(total);

  const slotQuality: Record<number, ChemistryLinkStatus> = {};
  for (let i = 0; i < formation.slots.length; i += 1) {
    const entry = slotScoreMap[i];
    if (!starters[i] || entry.count === 0) {
      slotQuality[i] = 'none';
      continue;
    }
    const avg = entry.sum / entry.count;
    if (entry.hasLegend && avg >= 1.6) slotQuality[i] = 'legend';
    else if (avg >= 1.8) slotQuality[i] = 'strong';
    else if (avg >= 0.8) slotQuality[i] = 'weak';
    else slotQuality[i] = 'none';
  }

  return {
    total,
    breakdown: {
      club: clubScore,
      nation: nationScore,
      tacticStyle: tacticStyleScore,
      roleBalance: roleBalanceScore,
    },
    chemistryOvrBonus,
    links,
    slotQuality,
    matchedStyleCount,
  };
}

/**
 * Computes position-fit-adjusted ATT/MID/DEF/OVR and applies additive chemistry OVR bonus [-1.5 .. +2.5].
 */
export function calculateTeamRatings(
  formationId: FormationId,
  starters: (Player | null)[],
  chemistryTotal: number,
  managerTraitId: ManagerTraitId | null = null,
): TeamRatings {
  const formation = FORMATIONS[formationId];
  const adjusted: {
    player: Player;
    slotPos: 'GK' | 'DF' | 'MF' | 'FW';
    effectiveOvr: number;
    effectiveAtt: number;
    effectiveMid: number;
    effectiveDef: number;
  }[] = [];

  for (let i = 0; i < formation.slots.length; i += 1) {
    const p = starters[i];
    if (!p) continue;
    const slot = formation.slots[i];
    const fit = evaluatePositionFit(p, slot.subPosition, managerTraitId);
    adjusted.push({
      player: p,
      slotPos: slot.position,
      effectiveOvr: fit.effectiveOvr,
      effectiveAtt: Math.max(30, p.att + fit.penalty),
      effectiveMid: Math.max(30, p.mid + fit.penalty),
      effectiveDef: Math.max(30, p.def + fit.penalty),
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

  const chemistryBonus = computeChemistryOvrBonus(chemistryTotal);

  return {
    att: Math.round(rawAtt),
    mid: Math.round(rawMid),
    def: Math.round(rawDef),
    ovr: Math.round(effOvrAvg),
    rawOvr: Math.round(rawOvrAvg),
    chemistryBonus,
    effectiveAtt: Math.round((rawAtt + chemistryBonus) * 10) / 10,
    effectiveMid: Math.round((rawMid + chemistryBonus) * 10) / 10,
    effectiveDef: Math.round((rawDef + chemistryBonus) * 10) / 10,
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
