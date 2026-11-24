import { FORMATIONS } from '../data/formations';
import type {
  InjuryAlertItem,
  InjuryAutoReturnEntry,
  InjuryReturnNotification,
  InjurySeverity,
  ManagerEventsState,
  MoraleTier,
  PlayerConditionMap,
  PlayerConditionState,
  PlayerInjury,
  PositionGroupId,
} from '../types/condition';
import type { FormationId, ManagerTraitId } from '../types/game';
import type { Club, TacticId } from '../types/league';
import type { Player, Position, SubPosition } from '../types/player';
import { getClubRealDepthPool } from './dataLoader';
import { evaluatePositionFit } from './positionEngine';

// ── Injury Catalogs ──────────────────────────────────────────────────────────

interface InjurySpec {
  name: string;
  minMatches: number;
  maxMatches: number;
  playThroughPenalty?: number;
}

const MINOR_INJURIES: InjurySpec[] = [
  { name: '가벼운 발목 염좌', minMatches: 1, maxMatches: 3, playThroughPenalty: -3 },
  { name: '경미한 햄스트링 뻐근함', minMatches: 1, maxMatches: 3, playThroughPenalty: -3 },
  { name: '종아리 타박상', minMatches: 1, maxMatches: 2, playThroughPenalty: -2 },
  { name: '사타구니 경미한 긴장', minMatches: 1, maxMatches: 3, playThroughPenalty: -3 },
  { name: '허벅지 타박상', minMatches: 1, maxMatches: 2, playThroughPenalty: -2 },
  { name: '무릎 경미한 통증', minMatches: 2, maxMatches: 3, playThroughPenalty: -4 },
];

const MODERATE_INJURIES: InjurySpec[] = [
  { name: '햄스트링 2도 파열', minMatches: 5, maxMatches: 8 },
  { name: '내측 측부 인대(MCL) 손상', minMatches: 5, maxMatches: 8 },
  { name: '발목 인대 부분 파열', minMatches: 4, maxMatches: 7 },
  { name: '대퇴사두근 근육 파열', minMatches: 4, maxMatches: 7 },
  { name: '종아리 근육 2도 파열', minMatches: 4, maxMatches: 6 },
  { name: '어깨 탈구 회복', minMatches: 4, maxMatches: 6 },
];

const SEVERE_INJURIES: InjurySpec[] = [
  { name: '전방십자인대(ACL) 파열', minMatches: 22, maxMatches: 28 },
  { name: '아킬레스건 파열', minMatches: 20, maxMatches: 26 },
  { name: '햄스트링 3도 완전 파열', minMatches: 18, maxMatches: 24 },
  { name: '중족골 골절', minMatches: 18, maxMatches: 23 },
];

export const SEVERITY_LABELS: Record<InjurySeverity, string> = {
  minor: '경상',
  moderate: '중상',
  severe: '치명적 중상',
};

// ── Default Factories ────────────────────────────────────────────────────────

export function createDefaultCondition(): PlayerConditionState {
  return {
    morale: 0,
    injury: null,
    consecutiveBenchMatches: 0,
    consecutiveMatchesPlayed: 0,
    recentGoalDrought: 0,
  };
}

export function createDefaultManagerEventsState(): ManagerEventsState {
  return {
    usedEventIds: [],
    matchesSinceLastEvent: 0,
    activeEvent: null,
    lastResolution: null,
    teamMorale: 0,
    recentWinStreak: 0,
    recentLossStreak: 0,
    recentCleanSheetStreak: 0,
    recentUnbeatenStreak: 0,
  };
}

export function getPlayerCondition(
  map: PlayerConditionMap | undefined | null,
  playerId: string,
): PlayerConditionState {
  const existing = map?.[playerId];
  if (!existing) return createDefaultCondition();
  return existing;
}

export function clampMorale(value: number): number {
  return Math.max(-5, Math.min(5, Math.round(value)));
}

// ── Injury Evaluation & Rolling ──────────────────────────────────────────────

export function isPlayerUnavailable(condition: PlayerConditionState | undefined | null): boolean {
  if (!condition?.injury) return false;
  return condition.injury.matchesRemaining > 0 && !condition.injury.canPlayThrough;
}

export function isPlayerActivelyInjured(condition: PlayerConditionState | undefined | null): boolean {
  return Boolean(condition?.injury && condition.injury.matchesRemaining > 0);
}

export function isPlayerRecoveringRust(condition: PlayerConditionState | undefined | null): boolean {
  return Boolean(
    condition?.injury &&
      condition.injury.matchesRemaining === 0 &&
      condition.injury.recoveryMatchesRemaining > 0,
  );
}

/**
 * Computes OVR penalty caused by injury (if playing through a minor injury, or recovering post-injury rust).
 */
export function getInjuryOvrPenalty(condition: PlayerConditionState | undefined | null): number {
  const inj = condition?.injury;
  if (!inj) return 0;
  if (inj.matchesRemaining > 0) {
    if (inj.canPlayThrough) return inj.playThroughPenalty; // -2..-4
    return -10; // unavailable guard
  }
  if (inj.recoveryMatchesRemaining > 0) {
    // Recovery rust: -3 -> -2 -> -1 for severe, -2 -> -1 for moderate
    return -Math.min(3, inj.recoveryMatchesRemaining);
  }
  return 0;
}

export function getInjuryTooltip(injury: PlayerInjury): string {
  if (injury.matchesRemaining > 0) {
    const base = `${SEVERITY_LABELS[injury.severity]}: ${injury.name} (잔여 ${injury.matchesRemaining}경기)`;
    if (injury.canPlayThrough) {
      return `${base} · 출전 강행 가능 (OVR ${injury.playThroughPenalty}, 재부상 위험 증가)`;
    }
    return `${base} · 출전 불가`;
  }
  if (injury.recoveryMatchesRemaining > 0) {
    const pen = -Math.min(3, injury.recoveryMatchesRemaining);
    return `부상 복귀 회복기 (${injury.name}) · 잔여 ${injury.recoveryMatchesRemaining}경기 (OVR ${pen})`;
  }
  return '';
}

function randomInt(min: number, max: number, rng: () => number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function pickInjurySpec(severity: InjurySeverity, rng: () => number): InjurySpec {
  const pool =
    severity === 'severe'
      ? SEVERE_INJURIES
      : severity === 'moderate'
        ? MODERATE_INJURIES
        : MINOR_INJURIES;
  return pool[Math.floor(rng() * pool.length)] ?? pool[0];
}

export function createInjury(
  severity: InjurySeverity,
  round?: number,
  competition?: 'league' | 'cup' | 'ucl',
  rng: () => number = Math.random,
): PlayerInjury {
  const spec = pickInjurySpec(severity, rng);
  const matches = randomInt(spec.minMatches, spec.maxMatches, rng);
  return {
    id: `inj_${severity}_${Date.now()}_${Math.floor(rng() * 1e6)}`,
    name: spec.name,
    severity,
    matchesRemaining: matches,
    initialMatches: matches,
    canPlayThrough: severity === 'minor',
    playThroughPenalty: severity === 'minor' ? (spec.playThroughPenalty ?? -3) : 0,
    recoveryMatchesRemaining: severity === 'severe' ? 3 : severity === 'moderate' ? 2 : 0,
    occurredRound: round,
    occurredCompetition: competition,
  };
}

export function getInjuryMoralePenalty(severity: InjurySeverity): number {
  if (severity === 'severe') return -3;
  if (severity === 'moderate') return -2;
  return -1;
}

/**
 * Rolls whether a player who played in a match sustains a new injury (or aggravates a minor injury).
 * Standalone base probabilities per player per 90-min match (no cumulative fatigue dependency):
 * - minor: 0.13% (~0.70 minor injuries per full 52-match season — occasional realistic variable)
 * - moderate: 0.011% (~0.06 per season — roughly 1 in 16 seasons)
 * - severe: 0.0018% (~0.010 per season — ultra-rare ~1 in 100 seasons event)
 * Scaled by minutes ratio and GK factor (0.35x).
 */
export function rollPlayerMatchInjury(params: {
  player: Pick<Player, 'position'>;
  currentCondition: PlayerConditionState;
  minutesPlayed: number;
  round?: number;
  competition?: 'league' | 'cup' | 'ucl';
  rng?: () => number;
}): { injury: PlayerInjury | null; wasAggravated: boolean } {
  const {
    player,
    currentCondition,
    minutesPlayed,
    round,
    competition,
    rng = Math.random,
  } = params;
  if (minutesPlayed <= 0) return { injury: null, wasAggravated: false };

  // Playing through an existing minor injury => fixed 4% aggravation risk
  if (
    currentCondition.injury &&
    currentCondition.injury.matchesRemaining > 0 &&
    currentCondition.injury.canPlayThrough
  ) {
    if (rng() < 0.04) {
      // 30% escalate to moderate, 70% extend minor by +2 matches
      if (rng() < 0.3) {
        return {
          injury: createInjury('moderate', round, competition, rng),
          wasAggravated: true,
        };
      }
      const extra = 2;
      return {
        injury: {
          ...currentCondition.injury,
          matchesRemaining: currentCondition.injury.matchesRemaining + extra,
          initialMatches: currentCondition.injury.initialMatches + extra,
          playThroughPenalty: Math.max(-4, currentCondition.injury.playThroughPenalty - 1),
        },
        wasAggravated: true,
      };
    }
    return { injury: null, wasAggravated: false };
  }

  // Already out injured? shouldn't roll new injury
  if (currentCondition.injury && currentCondition.injury.matchesRemaining > 0) {
    return { injury: null, wasAggravated: false };
  }

  const gkMult = player.position === 'GK' ? 0.35 : 1.0;
  const minMult = Math.min(1.25, Math.max(0.35, minutesPlayed / 90));
  const totalMult = gkMult * minMult;

  const severeProb = 0.000018 * totalMult;
  const moderateProb = 0.00011 * totalMult;
  const minorProb = 0.0013 * totalMult;

  const roll = rng();
  if (roll < severeProb) {
    return { injury: createInjury('severe', round, competition, rng), wasAggravated: false };
  }
  if (roll < severeProb + moderateProb) {
    return { injury: createInjury('moderate', round, competition, rng), wasAggravated: false };
  }
  if (roll < severeProb + moderateProb + minorProb) {
    return { injury: createInjury('minor', round, competition, rng), wasAggravated: false };
  }
  return { injury: null, wasAggravated: false };
}

/**
 * Advances injury countdown by 1 team match.
 */
export function tickInjuryOneMatch(injury: PlayerInjury | null): PlayerInjury | null {
  if (!injury) return null;
  if (injury.matchesRemaining > 0) {
    const nextRem = injury.matchesRemaining - 1;
    if (nextRem <= 0 && injury.recoveryMatchesRemaining <= 0) {
      return null;
    }
    return {
      ...injury,
      matchesRemaining: nextRem,
    };
  }
  if (injury.recoveryMatchesRemaining > 0) {
    const nextRec = injury.recoveryMatchesRemaining - 1;
    if (nextRec <= 0) return null;
    return {
      ...injury,
      recoveryMatchesRemaining: nextRec,
    };
  }
  return null;
}

// ── Morale Evaluation (v5.1 Strict Thresholds — Interviews Drive Swings) ────

export function getMoraleTier(morale: number): MoraleTier {
  if (morale >= 5) return 'ecstatic';
  if (morale >= 3) return 'high';
  if (morale <= -5) return 'frozen';
  if (morale <= -3) return 'low';
  return 'normal';
}

export function getMoraleOvrBonus(morale: number): number {
  const tier = getMoraleTier(morale);
  if (tier === 'ecstatic') return 2.0;
  if (tier === 'high') return 1.0;
  if (tier === 'low') return -1.0;
  if (tier === 'frozen') return -2.0;
  return 0;
}

export function getTeamMoraleBonus(teamMorale: number): number {
  if (teamMorale >= 5) return 0.5;
  if (teamMorale <= -5) return -0.5;
  return 0;
}

export function getMoraleLabel(morale: number): string {
  const tier = getMoraleTier(morale);
  if (tier === 'ecstatic') return '최상 (각성)';
  if (tier === 'high') return '상승';
  if (tier === 'low') return '저조';
  if (tier === 'frozen') return '최악 (빙결)';
  return '보통';
}

export function getPositionGroup(position: Position): PositionGroupId {
  if (position === 'FW') return 'FW';
  if (position === 'MF') return 'MF';
  return 'DF_GK';
}

export const POSITION_GROUP_LABELS: Record<PositionGroupId, string> = {
  FW: '공격진 (FW)',
  MF: '미드필더진 (MF)',
  DF_GK: '수비진·GK (DF/GK)',
};

// ── Integrated Player OVR Adjustment ─────────────────────────────────────────

export interface PlayerConditionOvrBreakdown {
  injuryPenalty: number;
  moraleBonus: number;
  totalDelta: number;
}

export function getPlayerConditionOvrBreakdown(
  condition: PlayerConditionState | undefined | null,
): PlayerConditionOvrBreakdown {
  if (!condition) {
    return { injuryPenalty: 0, moraleBonus: 0, totalDelta: 0 };
  }
  const injuryPenalty = getInjuryOvrPenalty(condition);
  const moraleBonus = getMoraleOvrBonus(condition.morale);
  const totalDelta = Math.round((injuryPenalty + moraleBonus) * 10) / 10;
  return { injuryPenalty, moraleBonus, totalDelta };
}

export interface FullPlayerOvrBreakdown {
  baseOvr: number;
  positionPenalty: number;
  synergyBonus: number;
  moraleBonus: number;
  injuryPenalty: number;
  isUnavailableInjured: boolean;
  finalEffectiveOvr: number;
  summaryLine: string;
  playerSynergyBonus?: number;
  managerBonus?: number;
}

/**
 * Computes a unified one-glance OVR breakdown:
 * 기본 OVR / (포지션) / 선수 시너지 / 감독 궁합 / 사기 / 부상 -> 최종 실효 OVR
 */
export function computeFullPlayerOvrBreakdown(params: {
  baseOvr: number;
  positionPenalty?: number;
  synergyBonus?: number;
  playerSynergyBonus?: number;
  managerBonus?: number;
  condition?: PlayerConditionState | null;
}): FullPlayerOvrBreakdown {
  const {
    baseOvr,
    positionPenalty = 0,
    synergyBonus = 0,
    playerSynergyBonus,
    managerBonus,
    condition = null,
  } = params;
  const hasSplitSynergy =
    playerSynergyBonus !== undefined || managerBonus !== undefined;
  const effectiveSynergySum = hasSplitSynergy
    ? (playerSynergyBonus ?? 0) + (managerBonus ?? 0)
    : synergyBonus;
  const condBr = getPlayerConditionOvrBreakdown(condition);
  const isUnavailableInjured = isPlayerUnavailable(condition);
  const finalEffectiveOvr = Math.max(
    50,
    Math.min(
      99,
      Math.round(
        baseOvr +
          positionPenalty +
          effectiveSynergySum +
          condBr.moraleBonus +
          condBr.injuryPenalty,
      ),
    ),
  );
  const posPart = positionPenalty < 0 ? ` / 포지션 ${positionPenalty}` : '';
  const synPart = hasSplitSynergy
    ? ` / 시너지 +${playerSynergyBonus ?? 0} / 감독 +${managerBonus ?? 0}`
    : ` / 시너지 +${synergyBonus}`;
  const moraleStr =
    condBr.moraleBonus > 0
      ? `+${condBr.moraleBonus}`
      : `${condBr.moraleBonus}`;
  const injStr = isUnavailableInjured
    ? `출전불가(${condBr.injuryPenalty})`
    : `${condBr.injuryPenalty}`;
  const summaryLine = `기본 OVR ${baseOvr}${posPart}${synPart} / 사기 ${moraleStr} / 부상 ${injStr} → 최종 실효 OVR ${finalEffectiveOvr}`;

  return {
    baseOvr,
    positionPenalty,
    synergyBonus: effectiveSynergySum,
    playerSynergyBonus: playerSynergyBonus ?? effectiveSynergySum,
    managerBonus: managerBonus ?? 0,
    moraleBonus: condBr.moraleBonus,
    injuryPenalty: condBr.injuryPenalty,
    isUnavailableInjured,
    finalEffectiveOvr,
    summaryLine,
  };
}

/**
 * Returns shallow-cloned players with ovr/att/mid/def adjusted by
 * minor-injury play-through penalty, post-injury rust, and individual + team morale.
 * Used cleanly right before match simulation without mutating base squad cards.
 */
export function applyConditionToPlayers(
  players: Player[],
  conditionMap: PlayerConditionMap | undefined | null,
  teamMorale = 0,
): Player[] {
  const teamDelta = getTeamMoraleBonus(teamMorale);
  if (!conditionMap && teamDelta === 0) return players;

  return players.map((p) => {
    const cond = conditionMap?.[p.id];
    const br = getPlayerConditionOvrBreakdown(cond);
    const delta = br.totalDelta + teamDelta;
    if (Math.abs(delta) < 0.05) return p;
    const rounded = Math.round(delta);
    if (rounded === 0) return p;
    return {
      ...p,
      ovr: Math.max(50, Math.min(99, p.ovr + rounded)),
      att: Math.max(40, Math.min(99, p.att + rounded)),
      mid: Math.max(40, Math.min(99, p.mid + rounded)),
      def: Math.max(40, Math.min(99, p.def + rounded)),
    };
  });
}

// ── Post-Match Condition Updater (User & AI Unified) ─────────────────────────

export interface PostMatchTeamUpdateInput {
  squad: Player[];
  starterIds: Set<string>;
  minutesByPlayerId: Record<string, number>;
  subPositionByPlayerId?: Record<string, SubPosition>;
  tactic?: TacticId;
  conditionMap: PlayerConditionMap;
  competition: 'league' | 'cup' | 'ucl';
  round?: number;
  isShortRest?: boolean;
  // Optional match performance signals for morale update
  outcome?: 'W' | 'D' | 'L';
  goalDiff?: number;
  isBigMatch?: boolean;
  momPlayerId?: string | null;
  goalScorerIds?: Set<string>;
  assisterIds?: Set<string>;
  goalsByPlayerId?: Record<string, number>;
  assistsByPlayerId?: Record<string, number>;
  cleanSheet?: boolean;
  ratingsByPlayerId?: Record<string, number>;
  teamWinStreak?: number;
  teamLossStreak?: number;
  trackUserAlerts?: boolean;
  starterSlotIndexByPlayerId?: Record<string, number>;
  rng?: () => number;
}

export interface PostMatchTeamUpdateResult {
  conditionMap: PlayerConditionMap;
  newInjuries: InjuryAlertItem[];
  teamMoraleDelta: number;
}

/**
 * Ticks existing injuries, rolls standalone new injuries, and updates player morale
 * for an entire squad (works identically for User & AI clubs).
 */
export function updateSquadConditionsAfterMatch(
  input: PostMatchTeamUpdateInput,
): PostMatchTeamUpdateResult {
  const {
    squad,
    starterIds,
    minutesByPlayerId,
    conditionMap,
    competition,
    round,
    outcome,
    goalDiff = 0,
    isBigMatch = false,
    momPlayerId = null,
    goalScorerIds,
    assisterIds,
    goalsByPlayerId = {},
    assistsByPlayerId = {},
    cleanSheet = false,
    ratingsByPlayerId = {},
    teamWinStreak = 0,
    teamLossStreak = 0,
    trackUserAlerts = false,
    starterSlotIndexByPlayerId = {},
    rng = Math.random,
  } = input;

  const nextMap: PlayerConditionMap = { ...conditionMap };
  const newInjuries: InjuryAlertItem[] = [];

  // Identify starter-caliber OVR threshold (11th highest OVR in squad)
  const sortedOvrs = squad.map((p) => p.ovr).sort((a, b) => b - a);
  const starterCaliberThreshold = sortedOvrs[Math.min(10, Math.max(0, sortedOvrs.length - 1))] ?? 78;

  // True collective explosion: 8+ win streak, 4+ goal demolition, or big-match 3+ goal thrashing
  const isCollectiveExplosion =
    outcome === 'W' &&
    (goalDiff >= 4 || teamWinStreak >= 8 || (isBigMatch && goalDiff >= 3));

  // Moderate team warmup (nudges toward +1..+2 without pushing whole squad into OVR boost)
  const isTeamWarmup =
    outcome === 'W' &&
    !isCollectiveExplosion &&
    (teamWinStreak >= 5 || goalDiff >= 3);

  // Team-level morale shift for match participants (kept modest so interviews dominate OVR swings)
  let teamPartDelta = 0;
  let teamMoraleDelta = 0;
  if (outcome === 'W') {
    if (isCollectiveExplosion) {
      teamPartDelta = 1;
      teamMoraleDelta = 1;
    } else if (isTeamWarmup) {
      teamPartDelta = 1;
      teamMoraleDelta = 1;
    }
  } else if (outcome === 'L') {
    if (teamLossStreak >= 3) {
      teamPartDelta -= 1;
      teamMoraleDelta -= 1;
    }
    if (goalDiff <= -3) {
      teamPartDelta -= 1;
      teamMoraleDelta -= 1;
    }
    if (isBigMatch && goalDiff <= -2) {
      teamPartDelta -= 1;
    }
  }
  teamPartDelta = Math.max(-2, Math.min(1, teamPartDelta));
  teamMoraleDelta = Math.max(-2, Math.min(1, teamMoraleDelta));

  // On a winning clean sheet, identify the top GK/DF (used only to thaw negative morale)
  let cleanSheetHeroId: string | null = null;
  if (cleanSheet && outcome === 'W') {
    let bestRating = -1;
    for (const p of squad) {
      const mins = minutesByPlayerId[p.id] ?? (starterIds.has(p.id) ? 90 : 0);
      if (mins >= 45 && (p.position === 'GK' || p.position === 'DF')) {
        const r = ratingsByPlayerId[p.id] ?? (p.position === 'GK' ? 7.3 : 7.1);
        if (r > bestRating) {
          bestRating = r;
          cleanSheetHeroId = p.id;
        }
      }
    }
  }

  let teamFreshInjuriesThisMatch = 0;
  let severeInjuryOccurred = false;

  for (const player of squad) {
    const prev = getPlayerCondition(conditionMap, player.id);
    const minutes = minutesByPlayerId[player.id] ?? (starterIds.has(player.id) ? 90 : 0);
    const played = minutes > 0;
    const isStarter = starterIds.has(player.id);
    const wasUnavailable = isPlayerUnavailable(prev);

    // 1. Injury roll (if played) or tick down existing injury
    // Cap fresh injuries at max 1 per team per match to avoid multi-injury pileups
    let nextInjury = tickInjuryOneMatch(prev.injury);
    let newInjuryThisMatch: PlayerInjury | null = null;
    const isPlayingThroughMinor = Boolean(
      prev.injury && prev.injury.matchesRemaining > 0 && prev.injury.canPlayThrough,
    );
    if (played && (teamFreshInjuriesThisMatch < 1 || isPlayingThroughMinor)) {
      const rolled = rollPlayerMatchInjury({
        player,
        currentCondition: prev,
        minutesPlayed: minutes,
        round,
        competition,
        rng,
      });
      if (rolled.injury) {
        if (!rolled.wasAggravated) {
          teamFreshInjuriesThisMatch += 1;
        }
        nextInjury = rolled.injury;
        newInjuryThisMatch = rolled.injury;
        if (rolled.injury.severity === 'severe') {
          severeInjuryOccurred = true;
        }
        if (trackUserAlerts) {
          newInjuries.push({
            playerId: player.id,
            playerName: player.name,
            nationality: player.nationality,
            nationalityCode: player.nationalityCode,
            position: player.position,
            mainPosition: player.mainPositions[0] ?? (player.position === 'GK' ? 'GK' : 'CM'),
            ovr: player.ovr,
            isStarter,
            starterSlotIndex: starterSlotIndexByPlayerId[player.id] ?? null,
            injury: rolled.injury,
            wasAggravated: rolled.wasAggravated,
          });
        }
      }
    }

    // 3. Morale update (v5.1: ordinary matches stay calm; interviews drive ±3..±5 OVR tiers)
    const goals = goalsByPlayerId[player.id] ?? (goalScorerIds?.has(player.id) ? 1 : 0);
    const assists = assistsByPlayerId[player.id] ?? (assisterIds?.has(player.id) ? 1 : 0);
    const rating = ratingsByPlayerId[player.id];

    let indivDelta = 0;
    let isPersonalHero = false;
    if (played) {
      if (
        (momPlayerId && momPlayerId === player.id) ||
        goals >= 3 ||
        (typeof rating === 'number' && rating >= 9.2)
      ) {
        indivDelta += 1;
        isPersonalHero = true;
      } else if (
        prev.morale < 0 &&
        (goals >= 1 || assists >= 1 || player.id === cleanSheetHeroId)
      ) {
        // Routine goal/assist helps thaw negative morale back toward 0 without inflating OVR
        indivDelta += 1;
      }

      if (typeof rating === 'number' && rating <= 5.2) {
        indivDelta -= 1;
      }
    }

    // Injury lowers morale immediately (-1 minor, -2 moderate, -3 severe)
    const injuryMoralePenalty = newInjuryThisMatch
      ? getInjuryMoralePenalty(newInjuryThisMatch.severity)
      : 0;

    // Unhappy starter-caliber player continuously benched (when healthy)
    const isHealthy = !nextInjury || nextInjury.matchesRemaining === 0;
    const nextBenchStreak = played
      ? 0
      : isHealthy
        ? prev.consecutiveBenchMatches + 1
        : prev.consecutiveBenchMatches;

    let benchPenalty = 0;
    if (!played && isHealthy && player.ovr >= starterCaliberThreshold) {
      if (nextBenchStreak === 4 || (nextBenchStreak > 4 && (nextBenchStreak - 4) % 3 === 0)) {
        benchPenalty = -1;
      }
    }

    // Step 3a: Natural cooldown / mean reversion toward calm equilibrium (-2..+2)
    let baseMorale = prev.morale;
    if (baseMorale >= 5) {
      // Ecstatic (+5 🔥) cools back to +4 after a match unless refreshed by personal heroics
      if (!isPersonalHero) {
        baseMorale = 4;
      }
    } else if (baseMorale >= 3) {
      // High (+3/+4) cools by -1 when neither personal heroics nor collective explosion occurred
      if (!isPersonalHero && !isCollectiveExplosion) {
        baseMorale -= 1;
      }
    } else if (baseMorale >= 1) {
      if (outcome !== 'W' && !isPersonalHero) {
        baseMorale -= 1;
      }
    } else if (baseMorale <= -5) {
      if (outcome === 'W' && played && indivDelta >= 0 && injuryMoralePenalty === 0) {
        baseMorale = -4;
      }
    } else if (baseMorale <= -3) {
      if (outcome === 'W' && played && indivDelta >= 0 && injuryMoralePenalty === 0) {
        baseMorale += 1;
      }
    }

    // Step 3b: Apply match deltas
    const teamContribution = played
      ? teamPartDelta
      : teamPartDelta < 0 && !wasUnavailable
        ? Math.max(-1, teamPartDelta)
        : 0;
    const clampedDelta = Math.max(
      -3,
      Math.min(2, teamContribution + indivDelta + injuryMoralePenalty + benchPenalty),
    );
    let nextMorale = baseMorale + clampedDelta;

    // Step 3c: Strict match cap — routine matches alone never exceed +2 (OVR 0);
    // only sustained personal heroics + existing surge can reach +3, while interviews unlock +4/+5 🔥!
    if (prev.morale < 3 && nextMorale >= 3) {
      const earnedMatchHigh =
        isPersonalHero && isCollectiveExplosion && prev.morale >= 2 && injuryMoralePenalty === 0;
      if (!earnedMatchHigh) {
        nextMorale = 2;
      } else {
        nextMorale = Math.min(3, nextMorale);
      }
    }
    if (prev.morale < 5 && nextMorale >= 5) {
      nextMorale = 4;
    }

    // Track goal drought for FW
    const scoredThisMatch = goals > 0;
    const nextGoalDrought =
      player.position === 'FW' && played
        ? scoredThisMatch
          ? 0
          : prev.recentGoalDrought + 1
        : prev.recentGoalDrought;

    nextMap[player.id] = {
      morale: clampMorale(nextMorale),
      injury: nextInjury,
      consecutiveBenchMatches: nextBenchStreak,
      consecutiveMatchesPlayed: played ? prev.consecutiveMatchesPlayed + 1 : 0,
      recentGoalDrought: nextGoalDrought,
      lastMatchRating: played ? rating : prev.lastMatchRating,
    };
  }

  // A season-ending severe injury shocks team morale slightly (-1)
  if (severeInjuryOccurred) {
    teamMoraleDelta = Math.max(-2, teamMoraleDelta - 1);
  }

  return {
    conditionMap: nextMap,
    newInjuries,
    teamMoraleDelta,
  };
}

// ── AI Condition-Aware Lineup Selection (Injury Substitution) ────────────────

/**
 * Given a full club squad (18+ players) or base roster (11+ players) and global condition map,
 * selects the best available 11 starters respecting injuries (unavailable players sit out).
 */
export function selectConditionAwareAiLineup(params: {
  baseRoster: Player[];
  fullClubPool: Player[];
  conditionMap: PlayerConditionMap | undefined | null;
}): {
  starters: Player[];
  fullClubSquad: Player[];
  injuredPlayers: { player: Player; injury: PlayerInjury }[];
} {
  const { baseRoster, fullClubPool, conditionMap } = params;

  // Deduplicate union of baseRoster + fullClubPool
  const byId = new Map<string, Player>();
  for (const p of baseRoster) byId.set(p.id, p);
  for (const p of fullClubPool) {
    if (!byId.has(p.id)) byId.set(p.id, p);
  }
  const fullClubSquad = Array.from(byId.values());

  const injuredPlayers: { player: Player; injury: PlayerInjury }[] = [];
  for (const p of fullClubSquad) {
    const cond = conditionMap?.[p.id];
    if (cond?.injury && cond.injury.matchesRemaining > 0) {
      injuredPlayers.push({ player: p, injury: cond.injury });
    }
  }

  if (!conditionMap) {
    return {
      starters: baseRoster.slice(0, 11),
      fullClubSquad,
      injuredPlayers,
    };
  }

  const usedIds = new Set<string>();
  const selected: Player[] = [];

  // Score candidate for a desired position slot
  const scoreForSlot = (candidate: Player, targetPos: Position): number => {
    const cond = conditionMap[candidate.id];
    if (isPlayerUnavailable(cond)) return -999;
    let score = candidate.ovr;
    if (candidate.position !== targetPos) {
      if (targetPos === 'GK' || candidate.position === 'GK') score -= 25;
      else score -= 6;
    }
    if (cond) {
      score += getInjuryOvrPenalty(cond);
      score += getMoraleOvrBonus(cond.morale) * 0.5;
    }
    return score;
  };

  for (const basePlayer of baseRoster.slice(0, 11)) {
    const baseCond = conditionMap[basePlayer.id];
    const baseUnavailable = isPlayerUnavailable(baseCond);

    if (!baseUnavailable && !usedIds.has(basePlayer.id)) {
      selected.push(basePlayer);
      usedIds.add(basePlayer.id);
      continue;
    }

    // Find best replacement in fullClubSquad
    let best: Player | null = null;
    let bestScore = -1000;
    for (const cand of fullClubSquad) {
      if (usedIds.has(cand.id)) continue;
      const sc = scoreForSlot(cand, basePlayer.position);
      if (sc > bestScore) {
        bestScore = sc;
        best = cand;
      }
    }

    if (best && bestScore > -500) {
      selected.push(best);
      usedIds.add(best.id);
    } else if (!usedIds.has(basePlayer.id)) {
      selected.push(basePlayer);
      usedIds.add(basePlayer.id);
    }
  }

  // Ensure exactly 11 if possible
  while (selected.length < 11) {
    const next = fullClubSquad.find((p) => !usedIds.has(p.id));
    if (!next) break;
    selected.push(next);
    usedIds.add(next.id);
  }

  return {
    starters: selected,
    fullClubSquad,
    injuredPlayers,
  };
}

export interface BenchReplacementRecommendation {
  player: Player;
  benchIndex: number;
  fit: 'main' | 'secondary' | 'out_of_pos' | 'severe';
  fitLabel: string;
  positionPenalty: number;
  effectiveScore: number;
  isUnavailable: boolean;
  isGkMismatch: boolean;
}

/**
 * Evaluates all bench players against a target formation slot (subPosition + position),
 * sorted by effective position-fit + condition OVR so the injury pitch modal shows clear recommendations.
 */
export function recommendBenchReplacements(params: {
  injuredSlotPosition: Position;
  injuredSlotSubPosition?: SubPosition;
  bench: (Player | null)[];
  conditionMap: PlayerConditionMap | undefined | null;
  managerTraitId?: ManagerTraitId | null;
  includeUnavailable?: boolean;
}): BenchReplacementRecommendation[] {
  const {
    injuredSlotPosition,
    injuredSlotSubPosition,
    bench,
    conditionMap,
    managerTraitId = null,
    includeUnavailable = false,
  } = params;
  const results: BenchReplacementRecommendation[] = [];

  const fallbackSub: SubPosition =
    injuredSlotSubPosition ??
    (injuredSlotPosition === 'GK'
      ? 'GK'
      : injuredSlotPosition === 'DF'
        ? 'CB'
        : injuredSlotPosition === 'MF'
          ? 'CM'
          : 'ST');

  bench.forEach((p, idx) => {
    if (!p) return;
    const cond = conditionMap?.[p.id];
    const unavailable = isPlayerUnavailable(cond);
    if (unavailable && !includeUnavailable) return;

    const posFit = evaluatePositionFit(p, fallbackSub, managerTraitId);
    const condDelta = getPlayerConditionOvrBreakdown(cond).totalDelta;
    const isGkMismatch = (fallbackSub === 'GK') !== (p.position === 'GK');
    const effectiveScore = unavailable
      ? -99
      : Math.round(posFit.effectiveOvr + condDelta);

    const fitLabel = isGkMismatch
      ? 'GK 불일치'
      : posFit.fit === 'main'
        ? '주포지션 최적'
        : posFit.fit === 'secondary'
          ? '부포지션 가능'
          : posFit.fit === 'out_of_pos'
            ? '유사 라인 대체'
            : '포지션 불일치';

    results.push({
      player: p,
      benchIndex: idx,
      fit: posFit.fit,
      fitLabel,
      positionPenalty: posFit.penalty,
      effectiveScore,
      isUnavailable: unavailable,
      isGkMismatch,
    });
  });

  return results.sort((a, b) => {
    if (a.isUnavailable !== b.isUnavailable) return a.isUnavailable ? 1 : -1;
    if (a.isGkMismatch !== b.isGkMismatch) return a.isGkMismatch ? 1 : -1;
    return b.effectiveScore - a.effectiveScore;
  });
}

/**
 * Automatically returns fully recovered original starters from the bench back to their
 * recorded starting slots, moving the temporary replacement back to the bench.
 * Safely handles departed players, manually already-returned players, and rotated slots.
 */
export function resolveAutoReturnInjuredStarters(params: {
  starters: (Player | null)[];
  bench: (Player | null)[];
  conditionMap: PlayerConditionMap;
  autoReturns: InjuryAutoReturnEntry[];
  formation: FormationId;
}): {
  starters: (Player | null)[];
  bench: (Player | null)[];
  remainingAutoReturns: InjuryAutoReturnEntry[];
  returnedNotifications: InjuryReturnNotification[];
} {
  const { starters, bench, conditionMap, autoReturns, formation } = params;
  if (!autoReturns || autoReturns.length === 0) {
    return {
      starters,
      bench,
      remainingAutoReturns: [],
      returnedNotifications: [],
    };
  }

  const nextStarters = [...starters];
  const nextBench = [...bench];
  const remainingAutoReturns: InjuryAutoReturnEntry[] = [];
  const returnedNotifications: InjuryReturnNotification[] = [];
  const formCfg = FORMATIONS[formation] ?? FORMATIONS['4-3-3'];

  for (const entry of autoReturns) {
    // 1. Already manually returned to starters? Drop entry safely without duplicating.
    const alreadyInStarters = nextStarters.some(
      (p) => p?.id === entry.injuredPlayerId,
    );
    if (alreadyInStarters) {
      continue;
    }

    // 2. Check if still on the bench (if not in starters or bench, player left via transfer).
    const benchIdx = nextBench.findIndex(
      (p) => p?.id === entry.injuredPlayerId,
    );
    if (benchIdx === -1) {
      continue;
    }

    const cond = conditionMap[entry.injuredPlayerId];
    const stillOutInjured = Boolean(
      cond?.injury && cond.injury.matchesRemaining > 0,
    );
    if (stillOutInjured) {
      remainingAutoReturns.push(entry);
      continue;
    }

    // 3. Fully healed (matchesRemaining === 0): restore to originalSlotIndex safely
    const healedPlayer = nextBench[benchIdx];
    if (!healedPlayer) continue;

    const slotIdx =
      entry.originalSlotIndex >= 0 &&
      entry.originalSlotIndex < nextStarters.length
        ? entry.originalSlotIndex
        : -1;
    if (slotIdx === -1) {
      continue;
    }

    const occupant = nextStarters[slotIdx];
    const repStarterIdx = entry.replacementPlayerId
      ? nextStarters.findIndex((p) => p?.id === entry.replacementPlayerId)
      : -1;

    if (
      repStarterIdx !== -1 &&
      repStarterIdx !== slotIdx &&
      occupant &&
      occupant.id !== entry.replacementPlayerId
    ) {
      // Multi-step rotation reversal:
      // healed -> originalSlotIndex, current occupant -> repStarterIdx, replacement -> benchIdx
      const replacementPlayer = nextStarters[repStarterIdx];
      nextStarters[slotIdx] = healedPlayer;
      nextStarters[repStarterIdx] = occupant;
      nextBench[benchIdx] = replacementPlayer;
    } else {
      // Direct restore: healed -> originalSlotIndex, current slot occupant (usually replacement) -> benchIdx
      nextStarters[slotIdx] = healedPlayer;
      nextBench[benchIdx] = occupant;
    }

    const slotLabel = formCfg.slots[slotIdx]?.subPosition;
    returnedNotifications.push({
      id: `ret_${healedPlayer.id}_${Date.now()}_${slotIdx}`,
      playerId: healedPlayer.id,
      playerName: healedPlayer.name,
      slotLabel,
    });
  }

  return {
    starters: nextStarters,
    bench: nextBench,
    remainingAutoReturns,
    returnedNotifications,
  };
}

/**
 * Prepares an AI club's condition-adjusted 11 starters for a match,
 * sitting out unavailable injured players using real club depth.
 */
export function prepareAiClubLineupForMatch(params: {
  club: Club;
  baseRoster: Player[];
  conditionMap: PlayerConditionMap | undefined | null;
  excludeIds?: Set<string>;
}): {
  effectiveStarters: Player[];
  rawStarters: Player[];
  fullClubSquad: Player[];
} {
  const { club, baseRoster, conditionMap, excludeIds } = params;
  if (!conditionMap) {
    return {
      effectiveStarters: baseRoster,
      rawStarters: baseRoster,
      fullClubSquad: baseRoster,
    };
  }
  const depthPool = getClubRealDepthPool(club.name, excludeIds);
  const { starters, fullClubSquad } = selectConditionAwareAiLineup({
    baseRoster,
    fullClubPool: depthPool,
    conditionMap,
  });
  const effectiveStarters = applyConditionToPlayers(starters, conditionMap, 0);
  return {
    effectiveStarters,
    rawStarters: starters,
    fullClubSquad,
  };
}

/**
 * Updates an AI club's full squad conditions (injury ticks/rolls, morale)
 * directly into the mutable working conditionMap after a match.
 */
export function commitAiClubPostMatchConditions(params: {
  club: Club;
  rawStarters: Player[];
  fullClubSquad: Player[];
  conditionMap: PlayerConditionMap | undefined | null;
  competition: 'league' | 'cup' | 'ucl';
  round?: number;
  isShortRest?: boolean;
  isExtraTime?: boolean;
  outcome?: 'W' | 'D' | 'L';
  goalDiff?: number;
  cleanSheet?: boolean;
  rng?: () => number;
}): void {
  const {
    club,
    rawStarters,
    fullClubSquad,
    conditionMap,
    competition,
    round,
    isExtraTime = false,
    outcome,
    goalDiff = 0,
    cleanSheet = false,
    rng = Math.random,
  } = params;
  if (!conditionMap) return;

  const starterIds = new Set(rawStarters.map((p) => p.id));
  const minutesByPlayerId: Record<string, number> = {};
  const matchMins = isExtraTime ? 120 : 90;
  for (const p of rawStarters) {
    minutesByPlayerId[p.id] = matchMins;
  }

  const res = updateSquadConditionsAfterMatch({
    squad: fullClubSquad,
    starterIds,
    minutesByPlayerId,
    tactic: club.defaultTactic,
    conditionMap,
    competition,
    round,
    outcome,
    goalDiff,
    cleanSheet,
    rng,
  });

  for (const p of fullClubSquad) {
    const updated = res.conditionMap[p.id];
    if (updated) {
      conditionMap[p.id] = updated;
    }
  }
}

/**
 * Strips default/neutral entries from a PlayerConditionMap before localStorage persistence
 * to keep serialized state compact.
 */
export function compactConditionMapForStorage(
  map: PlayerConditionMap | undefined | null,
): PlayerConditionMap {
  if (!map) return {};
  const out: PlayerConditionMap = {};
  for (const [id, c] of Object.entries(map)) {
    if (
      c.morale !== 0 ||
      c.injury !== null ||
      c.consecutiveBenchMatches > 0 ||
      c.consecutiveMatchesPlayed > 0 ||
      c.recentGoalDrought > 0
    ) {
      out[id] = c;
    }
  }
  return out;
}

