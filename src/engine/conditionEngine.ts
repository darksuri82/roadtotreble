import type {
  FatigueTier,
  InjuryAlertItem,
  InjurySeverity,
  ManagerEventsState,
  MoraleTier,
  PlayerConditionMap,
  PlayerConditionState,
  PlayerInjury,
  PositionGroupId,
} from '../types/condition';
import type { Club, TacticId } from '../types/league';
import type { Player, Position, SubPosition } from '../types/player';
import { getClubRealDepthPool } from './dataLoader';
import { getPlayerStaminaStat } from './staminaEngine';

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
    fatigue: 0,
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

export function clampFatigue(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function clampMorale(value: number): number {
  return Math.max(-5, Math.min(5, Math.round(value)));
}

// ── Fatigue Evaluation ───────────────────────────────────────────────────────

const POSITION_FATIGUE_MULT: Record<SubPosition, number> = {
  GK: 0.45,
  CB: 0.85,
  LB: 1.08,
  RB: 1.08,
  LWB: 1.12,
  RWB: 1.12,
  CDM: 1.08,
  CM: 1.12,
  CAM: 1.04,
  LM: 1.08,
  RM: 1.08,
  LW: 1.06,
  RW: 1.06,
  ST: 0.95,
};

const TACTIC_FATIGUE_MULT: Record<TacticId, number> = {
  gegenpressing: 1.25,
  wingplay: 1.1,
  balanced: 1.0,
  possession: 1.0,
  counter: 0.9,
};

export function getFatigueTier(fatigue: number): FatigueTier {
  if (fatigue >= 80) return 'burnout';
  if (fatigue >= 60) return 'danger';
  if (fatigue >= 40) return 'caution';
  return 'fresh';
}

export function getFatigueOvrPenalty(fatigue: number): number {
  if (fatigue >= 80) return -4.5;
  if (fatigue >= 60) return -2.5;
  if (fatigue >= 40) return -1.0;
  return 0;
}

export function getFatigueInitialStaminaCap(fatigue: number): number {
  if (fatigue >= 80) return 74;
  if (fatigue >= 60) return 84;
  if (fatigue >= 40) return 93;
  return 100;
}

export function getFatigueInjuryRiskMultiplier(fatigue: number): number {
  if (fatigue >= 80) return 4.8;
  if (fatigue >= 60) return 2.8;
  if (fatigue >= 40) return 1.6;
  return 1.0;
}

export function getFatigueLabel(fatigue: number): string {
  const tier = getFatigueTier(fatigue);
  if (tier === 'burnout') return '방전 (혹사)';
  if (tier === 'danger') return '혹사 위험';
  if (tier === 'caution') return '피로 주의';
  return '양호';
}

/**
 * Computes raw fatigue gained in a single match (before between-round recovery).
 */
export function computeMatchFatigueGain(params: {
  player: Pick<Player, 'stamina' | 'mainPositions' | 'position'>;
  subPosition?: SubPosition;
  tactic: TacticId;
  minutesPlayed: number; // 0..120
}): number {
  const { player, subPosition, tactic, minutesPlayed } = params;
  if (minutesPlayed <= 0) return 0;

  const sta = getPlayerStaminaStat(player);
  // STA 60 => 1.25x, STA 82 => 1.0x, STA 99 => 0.80x
  const staFactor = 1.25 - ((sta - 60) / 39) * 0.45;
  const posKey: SubPosition =
    subPosition ?? player.mainPositions[0] ?? (player.position === 'GK' ? 'GK' : 'CM');
  const posMult = POSITION_FATIGUE_MULT[posKey] ?? 1.0;
  const tacticMult = TACTIC_FATIGUE_MULT[tactic] ?? 1.0;
  const minRatio =
    minutesPlayed >= 90
      ? minutesPlayed / 90
      : Math.max(0.35, minutesPlayed / 90);

  return Math.round(16 * staFactor * posMult * tacticMult * minRatio);
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

/**
 * Rolls whether a player who played in a match sustains a new injury (or aggravates a minor injury).
 * Base probabilities (per player per 90-min match at fresh fatigue < 40):
 * - minor: 1.10%
 * - moderate: 0.22%
 * - severe: 0.035%
 * Scaled by fatigue risk multiplier (1.0x / 1.6x / 2.8x / 4.8x), minutes ratio, and GK factor (0.35x).
 */
export function rollPlayerMatchInjury(params: {
  player: Pick<Player, 'position'>;
  currentCondition: PlayerConditionState;
  postMatchFatigue: number;
  minutesPlayed: number;
  round?: number;
  competition?: 'league' | 'cup' | 'ucl';
  rng?: () => number;
}): { injury: PlayerInjury | null; wasAggravated: boolean } {
  const {
    player,
    currentCondition,
    postMatchFatigue,
    minutesPlayed,
    round,
    competition,
    rng = Math.random,
  } = params;
  if (minutesPlayed <= 0) return { injury: null, wasAggravated: false };

  // Playing through an existing minor injury => +12% aggravation risk
  if (
    currentCondition.injury &&
    currentCondition.injury.matchesRemaining > 0 &&
    currentCondition.injury.canPlayThrough
  ) {
    const aggravationChance = 0.12 * (postMatchFatigue >= 60 ? 1.4 : 1.0);
    if (rng() < aggravationChance) {
      // 65% escalate to moderate, 35% extend minor by +2..3 matches
      if (rng() < 0.65) {
        return {
          injury: createInjury('moderate', round, competition, rng),
          wasAggravated: true,
        };
      }
      const extra = randomInt(2, 3, rng);
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

  const riskMult = getFatigueInjuryRiskMultiplier(postMatchFatigue);
  const gkMult = player.position === 'GK' ? 0.35 : 1.0;
  const minMult = Math.min(1.3, Math.max(0.35, minutesPlayed / 90));
  const totalMult = riskMult * gkMult * minMult;

  const severeProb = 0.00035 * totalMult;
  const moderateProb = 0.0022 * totalMult;
  const minorProb = 0.011 * totalMult;

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

// ── Morale Evaluation ────────────────────────────────────────────────────────

export function getMoraleTier(morale: number): MoraleTier {
  if (morale >= 4) return 'ecstatic';
  if (morale >= 2) return 'high';
  if (morale <= -4) return 'frozen';
  if (morale <= -2) return 'low';
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
  if (teamMorale >= 4) return 0.5;
  if (teamMorale <= -4) return -0.5;
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
  fatiguePenalty: number;
  injuryPenalty: number;
  moraleBonus: number;
  totalDelta: number;
}

export function getPlayerConditionOvrBreakdown(
  condition: PlayerConditionState | undefined | null,
): PlayerConditionOvrBreakdown {
  if (!condition) {
    return { fatiguePenalty: 0, injuryPenalty: 0, moraleBonus: 0, totalDelta: 0 };
  }
  const fatiguePenalty = getFatigueOvrPenalty(condition.fatigue);
  const injuryPenalty = getInjuryOvrPenalty(condition);
  const moraleBonus = getMoraleOvrBonus(condition.morale);
  const totalDelta = Math.round((fatiguePenalty + injuryPenalty + moraleBonus) * 10) / 10;
  return { fatiguePenalty, injuryPenalty, moraleBonus, totalDelta };
}

/**
 * Returns shallow-cloned players with ovr/att/mid/def adjusted by cumulative fatigue,
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
  tactic: TacticId;
  conditionMap: PlayerConditionMap;
  competition: 'league' | 'cup' | 'ucl';
  round?: number;
  isShortRest?: boolean; // true for midweek cup / UCL fixtures
  // Optional match performance signals for morale update
  outcome?: 'W' | 'D' | 'L';
  goalDiff?: number;
  isBigMatch?: boolean;
  momPlayerId?: string | null;
  goalScorerIds?: Set<string>;
  assisterIds?: Set<string>;
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
 * Updates cumulative fatigue, ticks existing injuries, rolls new injuries,
 * and updates player morale for an entire squad (works identically for User & AI clubs).
 */
export function updateSquadConditionsAfterMatch(
  input: PostMatchTeamUpdateInput,
): PostMatchTeamUpdateResult {
  const {
    squad,
    starterIds,
    minutesByPlayerId,
    subPositionByPlayerId = {},
    tactic,
    conditionMap,
    competition,
    round,
    isShortRest = competition !== 'league',
    outcome,
    goalDiff = 0,
    isBigMatch = false,
    momPlayerId = null,
    goalScorerIds,
    assisterIds,
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

  // Team-level morale shift from match result
  let teamMoraleDelta = 0;
  if (outcome === 'W') {
    if (teamWinStreak >= 3) teamMoraleDelta += 1;
    if (isBigMatch || competition === 'cup' || competition === 'ucl') teamMoraleDelta += 1;
  } else if (outcome === 'L') {
    if (teamLossStreak >= 2) teamMoraleDelta -= 1;
    if (isBigMatch || competition === 'cup' || competition === 'ucl') teamMoraleDelta -= 1;
  }
  teamMoraleDelta = Math.max(-2, Math.min(2, teamMoraleDelta));

  const playedRecovery = isShortRest ? 5 : 10;
  const restedRecovery = isShortRest ? 18 : 24;

  for (const player of squad) {
    const prev = getPlayerCondition(conditionMap, player.id);
    const minutes = minutesByPlayerId[player.id] ?? (starterIds.has(player.id) ? 90 : 0);
    const played = minutes > 0;

    // 1. Fatigue update
    let nextFatigue: number;
    if (played) {
      const gain = computeMatchFatigueGain({
        player,
        subPosition: subPositionByPlayerId[player.id],
        tactic,
        minutesPlayed: minutes,
      });
      nextFatigue = clampFatigue(prev.fatigue + gain - playedRecovery);
    } else {
      nextFatigue = clampFatigue(prev.fatigue - restedRecovery);
    }

    // 2. Injury roll (if played) or tick down existing injury
    let nextInjury = tickInjuryOneMatch(prev.injury);
    if (played) {
      const rolled = rollPlayerMatchInjury({
        player,
        currentCondition: prev,
        postMatchFatigue: nextFatigue,
        minutesPlayed: minutes,
        round,
        competition,
        rng,
      });
      if (rolled.injury) {
        nextInjury = rolled.injury;
        if (trackUserAlerts) {
          newInjuries.push({
            playerId: player.id,
            playerName: player.name,
            nationality: player.nationality,
            nationalityCode: player.nationalityCode,
            position: player.position,
            mainPosition: player.mainPositions[0] ?? (player.position === 'GK' ? 'GK' : 'CM'),
            ovr: player.ovr,
            isStarter: starterIds.has(player.id),
            starterSlotIndex: starterSlotIndexByPlayerId[player.id] ?? null,
            injury: rolled.injury,
            wasAggravated: rolled.wasAggravated,
          });
        }
      }
    }

    // 3. Morale update
    let moraleDelta = teamMoraleDelta;
    if (played) {
      if (outcome === 'W' && goalDiff >= 3) moraleDelta += 1;
      if (outcome === 'L' && goalDiff <= -3) moraleDelta -= 2;
      if (momPlayerId && momPlayerId === player.id) moraleDelta += 2;
      if (goalScorerIds?.has(player.id) || assisterIds?.has(player.id)) moraleDelta += 1;
      if (cleanSheet && (player.position === 'GK' || player.position === 'DF')) moraleDelta += 1;
      const rating = ratingsByPlayerId[player.id];
      if (typeof rating === 'number' && rating <= 5.8) moraleDelta -= 1;
    }

    // Unhappy starter-caliber player continuously benched (when healthy)
    const isHealthy = !nextInjury || nextInjury.matchesRemaining === 0;
    const nextBenchStreak = played
      ? 0
      : isHealthy
        ? prev.consecutiveBenchMatches + 1
        : prev.consecutiveBenchMatches;

    if (!played && isHealthy && player.ovr >= starterCaliberThreshold) {
      if (nextBenchStreak === 3 || (nextBenchStreak > 3 && (nextBenchStreak - 3) % 2 === 0)) {
        moraleDelta -= 1;
      }
    }

    // Track goal drought for FW
    const scoredThisMatch = Boolean(goalScorerIds?.has(player.id));
    const nextGoalDrought =
      player.position === 'FW' && played
        ? scoredThisMatch
          ? 0
          : prev.recentGoalDrought + 1
        : prev.recentGoalDrought;

    const nextMorale = clampMorale(prev.morale + Math.max(-3, Math.min(3, moraleDelta)));

    nextMap[player.id] = {
      fatigue: nextFatigue,
      morale: nextMorale,
      injury: nextInjury,
      consecutiveBenchMatches: nextBenchStreak,
      consecutiveMatchesPlayed: played ? prev.consecutiveMatchesPlayed + 1 : 0,
      recentGoalDrought: nextGoalDrought,
      lastMatchRating: played ? ratingsByPlayerId[player.id] : prev.lastMatchRating,
    };
  }

  return {
    conditionMap: nextMap,
    newInjuries,
    teamMoraleDelta,
  };
}

// ── AI Condition-Aware Lineup Selection (Rotation & Injury Substitution) ─────

/**
 * Given a full club squad (18+ players) or base roster (11+ players) and global condition map,
 * selects the best available 11 starters respecting injuries (unavailable players sit out)
 * and rotating fatigued players (fatigue >= 65) when a decent backup exists.
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
      score += getFatigueOvrPenalty(cond.fatigue);
      score += getInjuryOvrPenalty(cond);
      score += getMoraleOvrBonus(cond.morale) * 0.5;
      // Encourage AI rotation when fatigue >= 65
      if (cond.fatigue >= 65) score -= 4;
      if (cond.fatigue >= 80) score -= 4;
    }
    return score;
  };

  for (const basePlayer of baseRoster.slice(0, 11)) {
    const baseCond = conditionMap[basePlayer.id];
    const baseUnavailable = isPlayerUnavailable(baseCond);
    const baseNeedsRest = (baseCond?.fatigue ?? 0) >= 65;

    if (!baseUnavailable && !baseNeedsRest && !usedIds.has(basePlayer.id)) {
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

/**
 * Recommends top bench replacements for an injured user starter, sorted by effective fit + freshness.
 */
export function recommendBenchReplacements(params: {
  injuredSlotPosition: Position;
  bench: (Player | null)[];
  conditionMap: PlayerConditionMap | undefined | null;
}): { player: Player; benchIndex: number; fitLabel: string; fatigue: number; effectiveScore: number }[] {
  const { injuredSlotPosition, bench, conditionMap } = params;
  const results: {
    player: Player;
    benchIndex: number;
    fitLabel: string;
    fatigue: number;
    effectiveScore: number;
  }[] = [];

  bench.forEach((p, idx) => {
    if (!p) return;
    const cond = conditionMap?.[p.id];
    if (isPlayerUnavailable(cond)) return;

    const samePos = p.position === injuredSlotPosition;
    const isGkMismatch = (injuredSlotPosition === 'GK') !== (p.position === 'GK');
    const posPenalty = isGkMismatch ? -20 : samePos ? 0 : -4;
    const fatigue = cond?.fatigue ?? 0;
    const condDelta = getPlayerConditionOvrBreakdown(cond).totalDelta;
    const effectiveScore = Math.round(p.ovr + posPenalty + condDelta);

    results.push({
      player: p,
      benchIndex: idx,
      fitLabel: samePos ? '적정 포지션' : isGkMismatch ? 'GK 불일치' : '멀티 대체',
      fatigue,
      effectiveScore,
    });
  });

  return results.sort((a, b) => b.effectiveScore - a.effectiveScore);
}

/**
 * Prepares an AI club's condition-adjusted 11 starters for a match,
 * sitting out injured players and rotating heavily fatigued players using real club depth.
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
 * Updates an AI club's full squad conditions (cumulative fatigue, injury ticks/rolls, morale)
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
    isShortRest = competition !== 'league',
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
    isShortRest,
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
      c.fatigue > 0 ||
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

