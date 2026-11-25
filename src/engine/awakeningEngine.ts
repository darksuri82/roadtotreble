import { evaluateManagerPlayerSynergy } from '../data/managerTraits';
import type { PlayerConditionMap } from '../types/condition';
import type {
  AwakeningAlertItem,
  ManagerTraitId,
  PlayerSlotSynergy,
  StaffCoachId,
} from '../types/game';
import type { PlayerSeasonStats } from '../types/league';
import type {
  GoalkeeperAttributes,
  Player,
  PlayerAttributes,
  PlayerAwakeningRecord,
} from '../types/player';
import {
  FIELD_ATTR_META,
  getPlayerAttributes,
  getPositionWeights,
  getPrimarySubPosition,
  GK_ATTR_META,
} from './attributeEngine';
import { STAFF_COACH_DEV_AWAKENING_MULT } from './staffCoachEngine';

/**
 * Permanent Potential Breakthrough (Awakening) Engine
 *
 * Strict Balance & Integrity Rules:
 * - Legends (`isLegend === true`): 0% (NEVER awaken).
 * - Superstars / Worldclass (`baseOvr >= 89`): ultra-rare (`x0.04` = 1/25), fixed `+2` OVR cap (max 96).
 * - Core / Prospects (`baseOvr <= 88`): ~1 player per season average;
 *   1st awakening x1.00, 2nd awakening x0.90 (no cliff), 3rd+ awakening x0.15 sharp attenuation.
 * - Permanent pure OVR +2..+7 growth + position-tailored sub-attribute growth applied ONLY to
 *   freshly cloned player instances — static DB is NEVER mutated.
 */
export const AWAKENING_MIN_GAIN = 2;
export const AWAKENING_MAX_GAIN = 7;
export const AWAKENING_SUPERSTAR_OVR_THRESHOLD = 89;
export const AWAKENING_SUPERSTAR_MAX_GAIN = 2;
export const AWAKENING_SUPERSTAR_RATE_MULT = 0.04; // 1/25th of normal rate
export const AWAKENING_OVR_HARD_CAP = 96;
export const AWAKENING_MIN_SEASON_MATCH = 6;
export const AWAKENING_MIN_APPEARANCES = 4;
export const AWAKENING_SECOND_COUNT_MULT = 0.9;
export const AWAKENING_THIRD_PLUS_MULT = 0.15;
export const AWAKENING_MAX_VALID_PER_TEAM = 4;
export const AWAKENING_BASE_ELIGIBLE_PROB = 0.0145;

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function pickWeightedInt(
  entries: [number, number][],
  rng: () => number,
): number {
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = rng() * total;
  for (const [val, w] of entries) {
    r -= w;
    if (r <= 0) return val;
  }
  return entries[entries.length - 1][0];
}

/**
 * Rolls the permanent OVR gain (+2..+7) conditioned on the player's base OVR.
 * - baseOvr >= 89: strictly +2 (capped at 96)
 * - Lower OVR gems have wider ceiling up to +7; 85..88 stars grow +2..+4.
 */
export function rollAwakeningOvrGain(
  baseOvr: number,
  rng: () => number = Math.random,
): number {
  const maxAllowed = Math.max(0, AWAKENING_OVR_HARD_CAP - baseOvr);
  if (maxAllowed < AWAKENING_MIN_GAIN) {
    return Math.max(0, maxAllowed);
  }
  if (baseOvr >= AWAKENING_SUPERSTAR_OVR_THRESHOLD) {
    return Math.min(AWAKENING_SUPERSTAR_MAX_GAIN, maxAllowed);
  }

  let table: [number, number][];
  if (baseOvr <= 77) {
    table = [
      [4, 24],
      [5, 36],
      [6, 26],
      [7, 14],
    ];
  } else if (baseOvr <= 81) {
    table = [
      [3, 28],
      [4, 38],
      [5, 24],
      [6, 10],
    ];
  } else if (baseOvr <= 84) {
    table = [
      [2, 26],
      [3, 40],
      [4, 24],
      [5, 10],
    ];
  } else if (baseOvr <= 86) {
    table = [
      [2, 48],
      [3, 38],
      [4, 14],
    ];
  } else {
    // 87..88
    table = [
      [2, 72],
      [3, 28],
    ];
  }

  const rolled = pickWeightedInt(table, rng);
  return clamp(rolled, AWAKENING_MIN_GAIN, Math.min(AWAKENING_MAX_GAIN, maxAllowed));
}

/**
 * Validates whether an awakening record is legal against the canonical DB player
 * (used on save hydration, HOF reconstruction, and Global TOP 15 anti-cheat checks).
 */
export function isValidAwakeningRecord(
  canonicalPlayer: Pick<Player, 'ovr' | 'isLegend'>,
  record: PlayerAwakeningRecord | undefined | null,
): record is PlayerAwakeningRecord {
  if (!record || canonicalPlayer.isLegend) return false;
  if (
    typeof record.ovrGain !== 'number' ||
    !Number.isFinite(record.ovrGain) ||
    record.ovrGain < AWAKENING_MIN_GAIN ||
    record.ovrGain > AWAKENING_MAX_GAIN
  ) {
    return false;
  }
  if (
    canonicalPlayer.ovr >= AWAKENING_SUPERSTAR_OVR_THRESHOLD &&
    record.ovrGain > AWAKENING_SUPERSTAR_MAX_GAIN
  ) {
    return false;
  }
  if (canonicalPlayer.ovr + record.ovrGain > AWAKENING_OVR_HARD_CAP) {
    return false;
  }
  return true;
}

/**
 * Computes position-tailored permanent attribute growth and returns a brand-new immutable
 * `Player` clone (NEVER mutating the input or static DB object).
 */
export function applyAwakeningToPlayer(
  basePlayer: Player,
  record: PlayerAwakeningRecord,
): Player {
  if (basePlayer.isLegend) return basePlayer;
  const originalOvr = basePlayer.awakening?.originalOvr ?? basePlayer.ovr;
  const ovrGain = clamp(
    Math.round(record.ovrGain),
    AWAKENING_MIN_GAIN,
    Math.min(
      originalOvr >= AWAKENING_SUPERSTAR_OVR_THRESHOLD
        ? AWAKENING_SUPERSTAR_MAX_GAIN
        : AWAKENING_MAX_GAIN,
      Math.max(AWAKENING_MIN_GAIN, AWAKENING_OVR_HARD_CAP - originalOvr),
    ),
  );
  const newOvr = clamp(originalOvr + ovrGain, 50, AWAKENING_OVR_HARD_CAP);

  // Derive base attributes from untouched pre-awakening baseline
  const baselineForAttrs: Player = basePlayer.awakening
    ? { ...basePlayer, ovr: originalOvr, attrs: undefined, awakening: undefined }
    : basePlayer;
  const baseAttrs = getPlayerAttributes(baselineForAttrs);
  const sub = getPrimarySubPosition(basePlayer);
  const weights = getPositionWeights(sub);

  const statDeltas: { key: string; label: string; before: number; after: number }[] = [];
  let nextAttrs: PlayerAttributes;
  let attGain = ovrGain;
  let midGain = ovrGain;
  let defGain = ovrGain;

  if (basePlayer.position === 'GK' && baseAttrs.gk) {
    const gkWeights: { key: keyof GoalkeeperAttributes; mult: number }[] = [
      { key: 'ref', mult: 1.25 },
      { key: 'div', mult: 1.2 },
      { key: 'pos', mult: 1.15 },
      { key: 'han', mult: 1.05 },
      { key: 'kic', mult: 0.95 },
    ];
    const nextGk: GoalkeeperAttributes = { ...baseAttrs.gk };
    for (const { key, mult } of gkWeights) {
      const before = baseAttrs.gk[key];
      const delta = Math.max(1, Math.round(ovrGain * mult));
      const after = clamp(before + delta, 40, 99);
      nextGk[key] = after;
      const meta = GK_ATTR_META.find((m) => m.key === key);
      statDeltas.push({
        key: meta?.shortLabel ?? key.toUpperCase(),
        label: meta?.fullLabel ?? key,
        before,
        after,
      });
    }
    nextAttrs = {
      sho: baseAttrs.sho,
      pas: clamp(baseAttrs.pas + Math.round(ovrGain * 0.7), 40, 99),
      cro: baseAttrs.cro,
      dri: baseAttrs.dri,
      aer: clamp(baseAttrs.aer + Math.round(ovrGain * 0.8), 40, 99),
      def: clamp(baseAttrs.def + ovrGain, 40, 99),
      phy: clamp(baseAttrs.phy + Math.round(ovrGain * 0.7), 40, 99),
      gk: nextGk,
    };
    attGain = Math.round(ovrGain * 0.35);
    midGain = Math.round(ovrGain * 0.55);
    defGain = ovrGain;
  } else {
    const fieldKeys: (keyof Omit<PlayerAttributes, 'gk'>)[] = [
      'sho',
      'pas',
      'cro',
      'dri',
      'aer',
      'def',
      'phy',
    ];
    const nextField: PlayerAttributes = { ...baseAttrs };
    const rankedDeltas: {
      key: string;
      label: string;
      before: number;
      after: number;
      weight: number;
    }[] = [];

    for (const key of fieldKeys) {
      const w = weights[key];
      const before = baseAttrs[key];
      // Core position stats (w >= 0.20) grow 1.15~1.30x; secondary stats grow 0.85~1.05x; non-core grow ~0.35x
      const mult = w >= 0.25 ? 1.28 : w >= 0.16 ? 1.1 : w > 0 ? 0.85 : 0.35;
      const delta = w > 0 ? Math.max(1, Math.round(ovrGain * mult)) : Math.round(ovrGain * mult);
      const after = clamp(before + delta, 40, 99);
      nextField[key] = after;
      if (after > before) {
        const meta = FIELD_ATTR_META.find((m) => m.key === key);
        rankedDeltas.push({
          key: meta?.shortLabel ?? key.toUpperCase(),
          label: meta?.fullLabel ?? key,
          before,
          after,
          weight: w,
        });
      }
    }
    rankedDeltas.sort((a, b) => b.weight - a.weight || (b.after - b.before) - (a.after - a.before));
    for (const d of rankedDeltas.slice(0, 4)) {
      statDeltas.push({
        key: d.key,
        label: d.label,
        before: d.before,
        after: d.after,
      });
    }
    nextAttrs = nextField;

    // Tailor A/M/D line growths by broad position
    if (basePlayer.position === 'FW') {
      attGain = Math.max(ovrGain, Math.round(ovrGain * 1.15));
      midGain = Math.max(1, Math.round(ovrGain * 0.85));
      defGain = Math.round(ovrGain * 0.4);
    } else if (basePlayer.position === 'MF') {
      attGain = Math.max(1, Math.round(ovrGain * 0.9));
      midGain = Math.max(ovrGain, Math.round(ovrGain * 1.15));
      defGain = Math.max(1, Math.round(ovrGain * 0.85));
    } else {
      attGain = Math.round(ovrGain * 0.5);
      midGain = Math.max(1, Math.round(ovrGain * 0.85));
      defGain = Math.max(ovrGain, Math.round(ovrGain * 1.15));
    }
  }

  const finalRecord: PlayerAwakeningRecord = {
    originalOvr,
    ovrGain,
    round: record.round,
    competition: record.competition,
    statDeltas:
      record.statDeltas && record.statDeltas.length > 0
        ? record.statDeltas
        : statDeltas.slice(0, 4),
  };

  return {
    ...basePlayer,
    ovr: newOvr,
    att: clamp(basePlayer.att + attGain, 30, 99),
    mid: clamp(basePlayer.mid + midGain, 30, 99),
    def: clamp(basePlayer.def + defGain, 30, 99),
    attrs: nextAttrs,
    awakening: finalRecord,
  };
}

export interface CheckPostMatchAwakeningParams {
  starters: (Player | null)[];
  bench: (Player | null)[];
  matchPlayedNumber: number; // total user matches played so far in season
  round: number;
  competition: 'league' | 'cup' | 'ucl';
  ratingsByPlayerId: Record<string, number>;
  goalsByPlayerId: Record<string, number>;
  assistsByPlayerId: Record<string, number>;
  minutesByPlayerId: Record<string, number>;
  cleanSheet: boolean;
  allPlayerStats: Record<string, PlayerSeasonStats>;
  slotSynergies?: Record<number, PlayerSlotSynergy>;
  conditionMap?: PlayerConditionMap;
  managerTraitId: ManagerTraitId | null;
  staffCoachId?: StaffCoachId | null;
  existingAwakenedPlayers?: Record<string, PlayerAwakeningRecord>;
  rng?: () => number;
}

export interface PostMatchAwakeningResult {
  triggered: boolean;
  awakenedPlayer: Player | null;
  record: PlayerAwakeningRecord | null;
  alert: AwakeningAlertItem | null;
}

/**
 * Evaluates post-match awakening eligibility and rolls at most 1 breakthrough per match.
 * Combines real match performance (rating, goals/assists/CS) + manager utilization
 * (synergy, manager fit, morale, potential coach).
 */
export function evaluatePostMatchAwakening(
  params: CheckPostMatchAwakeningParams,
): PostMatchAwakeningResult {
  const {
    starters,
    bench,
    matchPlayedNumber,
    round,
    competition,
    ratingsByPlayerId,
    goalsByPlayerId,
    assistsByPlayerId,
    minutesByPlayerId,
    cleanSheet,
    allPlayerStats,
    slotSynergies,
    conditionMap,
    managerTraitId,
    staffCoachId = null,
    existingAwakenedPlayers = {},
    rng = Math.random,
  } = params;

  const none: PostMatchAwakeningResult = {
    triggered: false,
    awakenedPlayer: null,
    record: null,
    alert: null,
  };

  if (matchPlayedNumber < AWAKENING_MIN_SEASON_MATCH) return none;

  const alreadyCount = Object.keys(existingAwakenedPlayers).length;
  if (alreadyCount >= AWAKENING_MAX_VALID_PER_TEAM) return none;

  // Team-level count scaling: 1st x1.00, 2nd x0.90 (no steep drop), 3rd+ x0.15
  const teamCountMult =
    alreadyCount === 0
      ? 1.0
      : alreadyCount === 1
        ? AWAKENING_SECOND_COUNT_MULT
        : AWAKENING_THIRD_PLUS_MULT;

  const coachMult =
    staffCoachId === 'sys_potential_dev' ? STAFF_COACH_DEV_AWAKENING_MULT : 1.0;

  const synergyByPlayerId = new Map<string, PlayerSlotSynergy>();
  if (slotSynergies) {
    for (const s of Object.values(slotSynergies)) {
      synergyByPlayerId.set(s.playerId, s);
    }
  }

  const allPlayers = [
    ...starters.filter((p): p is Player => p !== null),
    ...bench.filter((p): p is Player => p !== null),
  ];

  // Evaluate candidates in order of highest match rating so top performer gets first crack
  const candidates = allPlayers
    .filter((p) => {
      if (p.isLegend) return false; // Hard guard: Legends 0%
      if (p.awakening || existingAwakenedPlayers[p.id]) return false;
      if (p.ovr >= AWAKENING_OVR_HARD_CAP) return false;
      const mins = minutesByPlayerId[p.id] ?? 0;
      if (mins < 45) return false;
      const rating = ratingsByPlayerId[p.id] ?? 0;
      if (rating < 7.4) return false;
      const st = allPlayerStats[p.id];
      const apps = st?.appearances ?? matchPlayedNumber;
      if (apps < AWAKENING_MIN_APPEARANCES) return false;
      return true;
    })
    .sort((a, b) => (ratingsByPlayerId[b.id] ?? 0) - (ratingsByPlayerId[a.id] ?? 0));

  for (const player of candidates) {
    const rating = ratingsByPlayerId[player.id] ?? 7.4;
    const goals = goalsByPlayerId[player.id] ?? 0;
    const assists = assistsByPlayerId[player.id] ?? 0;
    const st = allPlayerStats[player.id];
    const syn = synergyByPlayerId.get(player.id);
    const cond = conditionMap?.[player.id];
    const mgrFit = evaluateManagerPlayerSynergy(player, managerTraitId);

    // Performance multiplier
    let perfMult = 1.0;
    if (rating >= 8.3) perfMult = 2.2;
    else if (rating >= 7.8) perfMult = 1.55;
    else if (rating >= 7.5) perfMult = 1.15;

    const hadKeyOutput =
      goals >= 1 ||
      assists >= 1 ||
      (cleanSheet && (player.position === 'GK' || player.position === 'DF') && rating >= 7.5);
    if (hadKeyOutput) perfMult *= 1.35;
    if (st && st.appearances >= 4 && st.avgRating >= 7.3) {
      perfMult *= 1.25;
    }

    // Manager utilization & cohesion multiplier
    let utilMult = 1.0;
    if (syn) {
      if (syn.neighborBonus >= 3) utilMult *= 1.35;
      else if (syn.neighborBonus >= 2) utilMult *= 1.2;
    }
    if (mgrFit.isMatch) utilMult *= 1.3;
    const morale = cond?.morale ?? 0;
    if (morale >= 5) utilMult *= 1.35;
    else if (morale >= 3) utilMult *= 1.2;
    else if (morale <= -2) utilMult *= 0.3;

    // Tier rarity multiplier (89+ ultra-rare <= 1/25)
    const tierMult =
      player.ovr >= AWAKENING_SUPERSTAR_OVR_THRESHOLD
        ? AWAKENING_SUPERSTAR_RATE_MULT
        : 1.0;

    const prob = clamp(
      AWAKENING_BASE_ELIGIBLE_PROB *
        perfMult *
        utilMult *
        teamCountMult *
        coachMult *
        tierMult,
      0,
      0.065,
    );

    if (rng() < prob) {
      const ovrGain = rollAwakeningOvrGain(player.ovr, rng);
      if (ovrGain < AWAKENING_MIN_GAIN) continue;
      const draftRecord: PlayerAwakeningRecord = {
        originalOvr: player.ovr,
        ovrGain,
        round,
        competition,
        statDeltas: [],
      };
      const awakenedPlayer = applyAwakeningToPlayer(player, draftRecord);
      const finalRecord = awakenedPlayer.awakening!;
      const reasonParts: string[] = [];
      if (goals >= 2) reasonParts.push(`${goals}골 맹활약`);
      else if (goals >= 1 && assists >= 1) reasonParts.push(`${goals}골 ${assists}도움`);
      else if (goals >= 1) reasonParts.push('결정적인 득점');
      else if (assists >= 1) reasonParts.push('날카로운 어시스트');
      else if (cleanSheet && (player.position === 'GK' || player.position === 'DF')) {
        reasonParts.push('무실점 철벽 수비');
      }
      if (rating >= 8.0) reasonParts.push(`평점 ${rating.toFixed(1)}`);
      if (mgrFit.isMatch) reasonParts.push('감독 전술과의 완벽한 호흡');
      else if (syn && syn.neighborBonus >= 2) reasonParts.push('팀 동료들과의 끈끈한 시너지');
      if (staffCoachId === 'sys_potential_dev') reasonParts.push('잠재력 육성 코치의 집중 지도');
      const reasonLead =
        reasonParts.length > 0
          ? `${reasonParts.slice(0, 2).join('과 ')} 속에`
          : '꾸준한 실전 활약 속에';
      const reason = `${reasonLead} 잠재력이 완전히 만개했습니다! 기본 OVR이 영구적으로 ${finalRecord.originalOvr}에서 ${awakenedPlayer.ovr}(+${finalRecord.ovrGain})로 성장했습니다.`;

      const alert: AwakeningAlertItem = {
        id: `awk-${competition}-r${round}-${player.id}`,
        playerId: player.id,
        playerName: player.name,
        position: player.position,
        mainPosition: player.mainPositions[0] ?? (player.position === 'GK' ? 'GK' : 'CM'),
        nationality: player.nationality,
        nationalityCode: player.nationalityCode,
        originalOvr: finalRecord.originalOvr,
        newOvr: awakenedPlayer.ovr,
        ovrGain: finalRecord.ovrGain,
        round,
        competition,
        statDeltas: finalRecord.statDeltas,
        reason,
      };
      return {
        triggered: true,
        awakenedPlayer,
        record: finalRecord,
        alert,
      };
    }
  }

  return none;
}
