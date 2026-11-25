import type {
  AttackRouteId,
  HighlightOutcomeType,
  HighlightPatternId,
  MatchEvent,
  ShotAngleType,
} from '../types/league';
import type {
  BallFlightType,
  DirectorCueState,
  DirectorScrambleMode,
  FormationPhaseMode,
  PitchSimInitConfig,
  PitchSimLiveMetrics,
  PitchSimState,
  PitchSimTeamInput,
  PlayerAgentState,
  SimVec2,
  TeamTacticalDoctrine,
} from './pitchSimTypes';
import {
  applyGameStateUrgencyToDoctrine,
  buildBaseFormationCoords,
  buildTeamAgentProfiles,
  buildTeamTacticalDoctrine,
  computeAgentLiveStamina,
  computeDynamicFormationTarget,
  computeGameStateUrgency,
  getStaminaKinematicFactor,
  sampleExpectedThreat,
} from './pitchTacticalParams';

export const FIXED_DT = 1 / 60;
export const MAX_FRAME_DELTA = 0.05;
/** A-Option: 1.20 sim seconds per match minute -> 1x ~2m05s (90m), 2x ~1m02s, 4x ~31s */
export const SIM_SECONDS_PER_MATCH_MINUTE = 1.2;

/** Shooting range invariants (normalized 0 = own goal line, 1 = opp goal line; pitch ~105m) */
export const MIN_OPEN_PLAY_SHOT_DEPTH = 0.72; // ~29m from opponent goal
export const MIN_LONG_RANGE_SHOT_DEPTH = 0.68; // ~33m long-range cannon
export const MIN_DIRECT_FK_SHOT_DEPTH = 0.66; // ~35m direct free kick max range
export const MIN_BOX_FINISH_SHOT_DEPTH = 0.78; // ~23m penalty-box / edge finish

/** Zone-based backpass caps (prevent absurd box -> own-half 50m backpasses) */
export const BOX_ZONE_MIN_DEPTH = 0.78;
export const FINAL_THIRD_MIN_DEPTH = 0.66;
export const MAX_BOX_BACKPASS_DIST = 0.18;
export const MAX_FINAL_THIRD_BACKPASS_DIST = 0.22;

const ALL_PATTERNS: HighlightPatternId[] = [
  'wing_cross_header',
  'cutback_finish',
  'through_ball_1v1',
  'cut_inside_curler',
  'corner_kick',
  'direct_free_kick',
  'high_press_counter',
  'u_buildup_switch',
  'rebound_finish',
  'penalty_kick',
];

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function quadBezier(p0: SimVec2, p1: SimVec2, p2: SimVec2, t: number): SimVec2 {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  };
}

function atkX(isHome: boolean, homeX: number): number {
  return isHome ? homeX : 1 - homeX;
}

export function getAttackDepth(isHome: boolean, x: number): number {
  return isHome ? x : 1 - x;
}

export function getMinShotDepthForCue(
  pattern: HighlightPatternId,
  route: AttackRouteId,
): number {
  if (pattern === 'penalty_kick') return 0.86;
  if (pattern === 'direct_free_kick') return MIN_DIRECT_FK_SHOT_DEPTH;
  if (route === 'long_range_cannon') return MIN_LONG_RANGE_SHOT_DEPTH;
  if (
    pattern === 'corner_kick' ||
    pattern === 'wing_cross_header' ||
    pattern === 'cutback_finish' ||
    pattern === 'rebound_finish'
  ) {
    return MIN_BOX_FINISH_SHOT_DEPTH;
  }
  return MIN_OPEN_PLAY_SHOT_DEPTH;
}

export function isWithinShootingZone(
  isHome: boolean,
  x: number,
  minDepth: number = MIN_OPEN_PLAY_SHOT_DEPTH,
): boolean {
  return getAttackDepth(isHome, x) >= minDepth;
}

/** Deterministic FNV-1a 32-bit string hash for PRNG seeding */
export function hashSeedString(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) || 1337;
}

/** Deterministic Mulberry32 PRNG step (zero Math.random calls!) */
export function nextSimRng(state: PitchSimState): number {
  let t = (state.rngState + 0x6d2b79f5) >>> 0;
  state.rngState = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Perpendicular distance from point P to line segment A-B */
function pointToSegmentDistance(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): { dist: number; proj: number } {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-6) {
    return { dist: Math.hypot(px - ax, py - ay), proj: 0 };
  }
  const proj = clamp(((px - ax) * dx + (py - ay) * dy) / lenSq, 0, 1);
  const cx = ax + proj * dx;
  const cy = ay + proj * dy;
  return { dist: Math.hypot(px - cx, py - cy), proj };
}

/**
 * Evaluates pass lane safety (0 = blocked, 1 = wide open) against all opposing defenders.
 * Defender DEF attribute & defensive_architect lineDiscipline widen interception shadow.
 */
export function evaluatePassLaneSafety(
  from: SimVec2,
  to: SimVec2,
  defenders: PlayerAgentState[],
  defDoctrine: TeamTacticalDoctrine,
  isAerial = false,
): number {
  const passDist = Math.hypot(to.x - from.x, to.y - from.y);
  if (passDist < 0.025) return 0.95;

  let minSafety = 1.0;
  for (let i = 1; i < defenders.length; i += 1) {
    const d = defenders[i];
    const { dist, proj } = pointToSegmentDistance(
      d.x,
      d.y,
      from.x,
      from.y,
      to.x,
      to.y,
    );
    // Defenders behind the passer or well past the receiver don't intercept
    if (proj < 0.08 || proj > 0.96) continue;
    // Aerial switches/crosses fly over middle-segment defenders
    if (isAerial && proj > 0.22 && proj < 0.78) continue;

    const defFactor = clamp((d.profile.attrs.def - 60) / 38, 0, 1);
    const interceptRadius =
      (0.042 + defFactor * 0.022 + defDoctrine.lineDiscipline * 0.014) *
      (0.82 + 0.32 * proj);
    const safety = clamp((dist - interceptRadius * 0.45) / (interceptRadius * 1.15), 0, 1);
    if (safety < minSafety) minSafety = safety;
  }
  return minSafety;
}

/**
 * Spearman-inspired local Pitch Control margin at spot (0 = dominated by defense, 1 = wide open space).
 */
function evaluateSpotClearance(
  spot: SimVec2,
  defenders: PlayerAgentState[],
): number {
  let minDist = 1.0;
  for (let i = 1; i < defenders.length; i += 1) {
    const d = Math.hypot(defenders[i].x - spot.x, defenders[i].y - spot.y);
    if (d < minDist) minDist = d;
  }
  return clamp((minDist - 0.03) / 0.14, 0, 1);
}

/**
 * Computes opposing outfield last defensive line X (closest outfield defender to own goal).
 */
function getDefensiveBacklineX(defenders: PlayerAgentState[], defIsHome: boolean): number {
  let backX = defIsHome ? 0.32 : 0.68;
  for (let i = 1; i < defenders.length; i += 1) {
    const x = defenders[i].x;
    if (defIsHome) {
      if (x < backX) backX = x;
    } else if (x > backX) {
      backX = x;
    }
  }
  return backX;
}

/**
 * Craig Reynolds Steering: Arrive + Separation + Rotational Inertia.
 */
function applyAgentSteering(params: {
  agent: PlayerAgentState;
  targetX: number;
  targetY: number;
  sprintDemand: number; // 0..1
  teammates: PlayerAgentState[];
  doctrine: TeamTacticalDoctrine;
  dt: number;
  skipSeparation?: boolean;
  speedBoost?: number;
}) {
  const {
    agent,
    targetX,
    targetY,
    sprintDemand,
    teammates,
    doctrine,
    dt,
    skipSeparation = false,
    speedBoost = 1.0,
  } = params;

  agent.prevX = agent.x;
  agent.prevY = agent.y;
  agent.targetX = targetX;
  agent.targetY = targetY;
  agent.sprintFactor = sprintDemand;

  const stamFactor = getStaminaKinematicFactor(agent.staminaPct);
  const freshMult = agent.profile.isFreshSub
    ? 1.04 + doctrine.freshSubBoost * 0.10
    : 1.0;
  const maxSpeed =
    agent.profile.baseMaxSpeed *
    stamFactor *
    freshMult *
    (0.76 + 0.34 * sprintDemand) *
    speedBoost;
  const maxAccel =
    agent.profile.baseMaxAccel *
    stamFactor *
    freshMult *
    (0.80 + 0.30 * sprintDemand) *
    (0.5 + 0.5 * speedBoost);

  // 1) Arrive steering vector
  const toX = targetX - agent.x;
  const toY = targetY - agent.y;
  const dist = Math.hypot(toX, toY);
  const slowRadius = 0.06;

  let desVx = 0;
  let desVy = 0;
  if (dist > 0.0025) {
    const speedMag = dist < slowRadius ? maxSpeed * (dist / slowRadius) : maxSpeed;
    desVx = (toX / dist) * speedMag;
    desVy = (toY / dist) * speedMag;
  }

  // 2) Separation steering (prevents clumping & maintains crisp passing triangles)
  if (!skipSeparation && agent.slotIndex !== 0) {
    const sepRadius = 0.064;
    let sepX = 0;
    let sepY = 0;
    for (let i = 1; i < teammates.length; i += 1) {
      if (i === agent.slotIndex) continue;
      const other = teammates[i];
      const dx = agent.x - other.x;
      const dy = agent.y - other.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.0005 && d < sepRadius) {
        const push = ((sepRadius - d) / sepRadius) * 0.09;
        sepX += (dx / d) * push;
        sepY += (dy / d) * push;
      }
    }
    desVx += sepX;
    desVy += sepY;
  }

  // 3) Smooth steering acceleration clamp
  let steerX = (desVx - agent.vx) * 6.0;
  let steerY = (desVy - agent.vy) * 6.0;
  const steerMag = Math.hypot(steerX, steerY);
  if (steerMag > maxAccel) {
    steerX = (steerX / steerMag) * maxAccel;
    steerY = (steerY / steerMag) * maxAccel;
  }

  agent.vx += steerX * dt;
  agent.vy += steerY * dt;

  // Rotational inertia: smoothly turn heading toward velocity
  const curSpeed = Math.hypot(agent.vx, agent.vy);
  if (curSpeed > 0.006) {
    const targetHeading = Math.atan2(agent.vy, agent.vx);
    let diff = targetHeading - agent.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const maxTurn = agent.profile.baseTurnRate * stamFactor * dt;
    agent.heading += clamp(diff, -maxTurn, maxTurn);

    // Subtle velocity alignment with heading so players arc smoothly instead of knife-edge snapping
    const turnPenalty = Math.max(0.84, Math.cos(clamp(Math.abs(diff), 0, Math.PI * 0.5)));
    const clampedSpeed = Math.min(curSpeed * turnPenalty, maxSpeed * 1.05);
    const scale = clampedSpeed / curSpeed;
    agent.vx *= scale;
    agent.vy *= scale;
  } else {
    agent.vx *= 0.85;
    agent.vy *= 0.85;
  }

  agent.x = clamp(agent.x + agent.vx * dt, 0.032, 0.968);
  agent.y = clamp(agent.y + agent.vy * dt, 0.04, 0.96);

  if (agent.touchCooldown > 0) {
    agent.touchCooldown = Math.max(0, agent.touchCooldown - dt);
  }
}

/**
 * Atomically resets the single ball entity to an exact coordinate, wiping interpolation & trail buffers
 * so set-pieces, kickoffs, restarts, and scene cuts NEVER leave a ghost/duplicate ball behind.
 */
function resetBallToSpot(
  state: PitchSimState,
  x: number,
  y: number,
  ownerTeamIsHome: boolean | null = null,
  ownerIdx: number | null = null,
) {
  const b = state.ball;
  b.x = x;
  b.y = y;
  b.z = 0;
  b.prevX = x;
  b.prevY = y;
  b.prevZ = 0;
  b.vx = 0;
  b.vy = 0;
  b.flightType = ownerIdx !== null ? 'carry' : 'loose';
  b.ownerTeamIsHome = ownerTeamIsHome;
  b.ownerIdx = ownerIdx;
  b.passTargetTeamIsHome = null;
  b.passTargetIdx = null;
  b.originX = x;
  b.originY = y;
  b.destX = x;
  b.destY = y;
  b.ctrlX = x;
  b.ctrlY = y;
  b.flightProgress = 1;
  b.flightDuration = 0.3;
  b.maxArcZ = 0;
  b.trail = [];
  state.passArc = null;
}

/**
 * Cleanly positions an agent during a whistle/broadcast set-piece cut with synchronized prevX/prevY.
 */
function placeAgentForSetPiece(
  agent: PlayerAgentState,
  x: number,
  y: number,
  heading: number,
) {
  const cx = clamp(x, 0.025, 0.975);
  const cy = clamp(y, 0.03, 0.97);
  agent.x = cx;
  agent.y = cy;
  agent.prevX = cx;
  agent.prevY = cy;
  agent.vx = 0;
  agent.vy = 0;
  agent.targetX = cx;
  agent.targetY = cy;
  agent.heading = heading;
  agent.roleAction = agent.slotIndex === 0 ? 'keeper' : 'set_piece';
}

/**
 * Launches a physical ball flight (ground pass, through ball, aerial switch, cross, or shot).
 */
function launchBallFlight(params: {
  state: PitchSimState;
  flightType: BallFlightType;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  ctrlX?: number;
  ctrlY?: number;
  targetTeamIsHome: boolean | null;
  targetIdx: number | null;
  passerIsHome: boolean;
  passerIdx: number;
  speedOverride?: number;
  maxArcZ?: number;
  arcColor?: string;
}) {
  const {
    state,
    flightType,
    fromX,
    fromY,
    toX,
    toY,
    targetTeamIsHome,
    targetIdx,
    passerIsHome,
    passerIdx,
    speedOverride,
    maxArcZ,
    arcColor,
  } = params;

  const dist = Math.hypot(toX - fromX, toY - fromY);
  const baseSpeed =
    speedOverride ??
    (flightType === 'shot'
      ? 0.58
      : flightType === 'through_ball'
        ? 0.44
        : flightType === 'long_switch'
          ? 0.39
          : flightType === 'cross'
            ? 0.37
            : 0.36);
  const duration = clamp(dist / Math.max(0.18, baseSpeed), 0.24, 1.35);

  const midX = params.ctrlX ?? (fromX + toX) * 0.5;
  const midY = params.ctrlY ?? (fromY + toY) * 0.5;
  const arcZ =
    maxArcZ ??
    (flightType === 'long_switch'
      ? clamp(dist * 1.35, 0.40, 1.0)
      : flightType === 'cross'
        ? clamp(dist * 1.4, 0.40, 0.95)
        : flightType === 'shot'
          ? 0.24
          : 0);

  const ball = state.ball;
  // Single-ball integrity: if launch origin differs from previous ball coords, snap cleanly & wipe stale trail
  if (Math.hypot(ball.x - fromX, ball.y - fromY) > 0.035) {
    ball.x = fromX;
    ball.y = fromY;
    ball.z = 0;
    ball.prevX = fromX;
    ball.prevY = fromY;
    ball.prevZ = 0;
    ball.trail = [];
  } else {
    ball.trail = [];
  }

  ball.flightType = flightType;
  ball.ownerTeamIsHome = null;
  ball.ownerIdx = null;
  ball.lastTouchTeamIsHome = passerIsHome;
  ball.lastTouchIdx = passerIdx;
  ball.passTargetTeamIsHome = targetTeamIsHome;
  ball.passTargetIdx = targetIdx;
  ball.originX = fromX;
  ball.originY = fromY;
  ball.destX = toX;
  ball.destY = toY;
  ball.ctrlX = midX;
  ball.ctrlY = midY;
  ball.flightProgress = 0;
  ball.flightDuration = duration;
  ball.maxArcZ = arcZ;

  if (
    arcColor &&
    (flightType === 'long_switch' ||
      flightType === 'cross' ||
      flightType === 'through_ball' ||
      flightType === 'shot')
  ) {
    state.passArc = {
      p0: { x: fromX, y: fromY },
      p1: { x: midX, y: midY },
      p2: { x: toX, y: toY },
      color: arcColor,
      alpha: flightType === 'shot' ? 0.65 : 0.42,
      ttl: duration + 0.22,
      maxTtl: duration + 0.22,
    };
  }
}

/**
 * Finds the best matching slot index (1..10 outfield by default) on a team for a MatchEvent actor.
 * Excludes slot 0 (GK) by default so a defending GK ID on save events can NEVER match the attacking GK.
 */
function findAgentSlotByIdentity(
  agents: PlayerAgentState[],
  playerId?: string,
  playerName?: string,
  fallbackPool: number[] = [8, 9, 10],
  rngVal = 0.5,
  excludeGk = true,
): number {
  const candidates = excludeGk ? agents.filter((a) => a.slotIndex !== 0) : agents;
  if (playerId) {
    const exact = candidates.find((a) => a.profile.playerId === playerId);
    if (exact) return exact.slotIndex;
  }
  if (playerName) {
    const byName = candidates.find((a) => a.profile.name === playerName);
    if (byName) return byName.slotIndex;
  }
  return fallbackPool[Math.floor(rngVal * fallbackPool.length) % fallbackPool.length] ?? 9;
}

/**
 * Resolves AttackRouteId if an event only carried HighlightPatternId.
 */
function resolveRouteForEvent(ev: MatchEvent): AttackRouteId {
  if (ev.attackRoute) return ev.attackRoute;
  switch (ev.highlightPattern) {
    case 'wing_cross_header':
      return 'early_cross';
    case 'cutback_finish':
      return 'cutback';
    case 'through_ball_1v1':
      return 'through_ball';
    case 'cut_inside_curler':
      return 'cut_inside_curler';
    case 'corner_kick':
      return 'corner_header';
    case 'direct_free_kick':
      return 'direct_fk';
    case 'high_press_counter':
      return 'gegenpress_steal';
    case 'u_buildup_switch':
      return 'u_buildup_switch';
    case 'rebound_finish':
      return 'rebound_poach';
    case 'penalty_kick':
      return 'penalty_kick';
    default:
      return 'through_ball';
  }
}

/**
 * Re-applies real-time Game State Urgency (remaining time x effective aggregate score diff)
 * cleanly on top of unmodified base doctrines without cumulative drift.
 */
function refreshLiveUrgencyDoctrines(state: PitchSimState) {
  const curMin = state.matchMinuteFloat;
  const homeEffDiff =
    state.aggHomeBeforeMatch +
    state.homeGoalsLive -
    (state.aggAwayBeforeMatch + state.awayGoalsLive);
  const awayEffDiff = -homeEffDiff;

  const homeBallDepth = state.ball.x;
  const awayBallDepth = 1 - state.ball.x;

  state.homeDoctrine = applyGameStateUrgencyToDoctrine(
    state.baseHomeDoctrine,
    computeGameStateUrgency({
      minute: curMin,
      scoreDiff: homeEffDiff,
      isKnockoutDecider: state.isKnockoutDecider,
      ballDepth: homeBallDepth,
    }),
  );
  state.awayDoctrine = applyGameStateUrgencyToDoctrine(
    state.baseAwayDoctrine,
    computeGameStateUrgency({
      minute: curMin,
      scoreDiff: awayEffDiff,
      isKnockoutDecider: state.isKnockoutDecider,
      ballDepth: awayBallDepth,
    }),
  );
}

/**
 * Creates a fresh deterministic PitchSimState for a match half / ET half.
 */
export function createPitchSimState(config: PitchSimInitConfig): PitchSimState {
  const rngState = hashSeedString(
    `${config.seed}|h${config.half}|s${config.startMinute}`,
  );
  const homeBase = buildBaseFormationCoords(config.home.formation, true);
  const awayBase = buildBaseFormationCoords(config.away.formation, false);

  const homeProfiles = buildTeamAgentProfiles(config.home, config.startMinute);
  const awayProfiles = buildTeamAgentProfiles(config.away, config.startMinute);

  const aggHomeBefore = config.aggHomeBeforeMatch ?? 0;
  const aggAwayBefore = config.aggAwayBeforeMatch ?? 0;
  const isKoDecider = Boolean(config.isKnockoutDecider);
  const homeEffDiff =
    aggHomeBefore + config.homeGoalsSoFar - (aggAwayBefore + config.awayGoalsSoFar);

  const baseHomeDoctrine = buildTeamTacticalDoctrine({
    my: config.home,
    opp: config.away,
    minute: config.startMinute,
    scoreDiff: homeEffDiff,
    isBigMatch: Boolean(config.isBigMatch),
    isKnockoutDecider: isKoDecider,
    applyUrgency: false,
  });
  const baseAwayDoctrine = buildTeamTacticalDoctrine({
    my: config.away,
    opp: config.home,
    minute: config.startMinute,
    scoreDiff: -homeEffDiff,
    isBigMatch: Boolean(config.isBigMatch),
    isKnockoutDecider: isKoDecider,
    applyUrgency: false,
  });

  const homeDoctrine = applyGameStateUrgencyToDoctrine(
    baseHomeDoctrine,
    computeGameStateUrgency({
      minute: config.startMinute,
      scoreDiff: homeEffDiff,
      isKnockoutDecider: isKoDecider,
    }),
  );
  const awayDoctrine = applyGameStateUrgencyToDoctrine(
    baseAwayDoctrine,
    computeGameStateUrgency({
      minute: config.startMinute,
      scoreDiff: -homeEffDiff,
      isKnockoutDecider: isKoDecider,
    }),
  );

  const makeAgent = (
    base: SimVec2,
    isHome: boolean,
    idx: number,
    profile: PlayerAgentState['profile'],
    doctrine: TeamTacticalDoctrine,
  ): PlayerAgentState => ({
    slotIndex: idx,
    isHome,
    x: base.x,
    y: base.y,
    prevX: base.x,
    prevY: base.y,
    vx: 0,
    vy: 0,
    heading: isHome ? 0 : Math.PI,
    targetX: base.x,
    targetY: base.y,
    staminaPct: computeAgentLiveStamina(profile, doctrine, config.startMinute),
    roleAction: idx === 0 ? 'keeper' : 'support',
    sprintFactor: 0,
    touchCooldown: 0,
    profile,
  });

  const homeAgents = homeBase.map((b, i) =>
    makeAgent(b, true, i, homeProfiles[i], homeDoctrine),
  );
  const awayAgents = awayBase.map((b, i) =>
    makeAgent(b, false, i, awayProfiles[i], awayDoctrine),
  );

  // Kickoff ownership: home kicks off 1st half, away kicks off 2nd half
  const startHomePoss = config.half === 1;
  const startCarrier = 6;
  const startAgents = startHomePoss ? homeAgents : awayAgents;
  const startX = startAgents[startCarrier]?.x ?? 0.5;
  const startY = startAgents[startCarrier]?.y ?? 0.5;

  const homeSotTarget =
    config.homeShotsOnTargetTarget ??
    Math.max(
      config.homeGoalsSoFar,
      Math.round(config.homeShotsTarget * 0.42),
    );
  const awaySotTarget =
    config.awayShotsOnTargetTarget ??
    Math.max(
      config.awayGoalsSoFar,
      Math.round(config.awayShotsTarget * 0.42),
    );
  const initMetrics = config.initialLiveMetrics;
  const initialLiveMetrics: PitchSimLiveMetrics = {
    homePossession: Math.round(
      clamp(initMetrics?.homePossession ?? 50, 20, 80),
    ),
    homeShots: Math.max(
      config.homeGoalsSoFar,
      Math.round(initMetrics?.homeShots ?? config.homeGoalsSoFar),
    ),
    awayShots: Math.max(
      config.awayGoalsSoFar,
      Math.round(initMetrics?.awayShots ?? config.awayGoalsSoFar),
    ),
    homeShotsOnTarget: Math.max(
      config.homeGoalsSoFar,
      Math.round(initMetrics?.homeShotsOnTarget ?? config.homeGoalsSoFar),
    ),
    awayShotsOnTarget: Math.max(
      config.awayGoalsSoFar,
      Math.round(initMetrics?.awayShotsOnTarget ?? config.awayGoalsSoFar),
    ),
    homeSaves: Math.max(0, Math.round(initMetrics?.homeSaves ?? 0)),
    awaySaves: Math.max(0, Math.round(initMetrics?.awaySaves ?? 0)),
    homeXg: Math.max(0, Math.round((initMetrics?.homeXg ?? 0) * 100) / 100),
    awayXg: Math.max(0, Math.round((initMetrics?.awayXg ?? 0) * 100) / 100),
  };

  const state: PitchSimState = {
    rngState,
    simTime: 0,
    matchMinuteFloat: config.startMinute,
    startMinute: config.startMinute,
    endMinute: config.endMinute,
    half: config.half,
    completed: false,
    homeTeamId: config.homeTeamId,
    awayTeamId: config.awayTeamId,
    targetHomePossession: clamp(config.targetHomePossession, 31, 69),
    homeShotsTarget: config.homeShotsTarget,
    awayShotsTarget: config.awayShotsTarget,
    homeShotsOnTargetTarget: homeSotTarget,
    awayShotsOnTargetTarget: awaySotTarget,
    homeXgTarget: config.homeXgTarget,
    awayXgTarget: config.awayXgTarget,
    homeGoalsLive: config.homeGoalsSoFar,
    awayGoalsLive: config.awayGoalsSoFar,
    isBigMatch: Boolean(config.isBigMatch),
    isKnockoutDecider: isKoDecider,
    aggHomeBeforeMatch: aggHomeBefore,
    aggAwayBeforeMatch: aggAwayBefore,
    baseHomeDoctrine,
    baseAwayDoctrine,
    homeDoctrine,
    awayDoctrine,
    homeAgents,
    awayAgents,
    ball: {
      x: startX,
      y: startY,
      z: 0,
      prevX: startX,
      prevY: startY,
      prevZ: 0,
      vx: 0,
      vy: 0,
      flightType: 'carry',
      ownerTeamIsHome: startHomePoss,
      ownerIdx: startCarrier,
      lastTouchTeamIsHome: startHomePoss,
      lastTouchIdx: startCarrier,
      passTargetTeamIsHome: null,
      passTargetIdx: null,
      originX: startX,
      originY: startY,
      destX: startX,
      destY: startY,
      ctrlX: startX,
      ctrlY: startY,
      flightProgress: 1,
      flightDuration: 0.4,
      maxArcZ: 0,
      trail: [],
    },
    possessionIsHome: startHomePoss,
    carrierHoldTimer: 0,
    carrierDecisionDelay: 0.52,
    recycleCount: 0,
    stallPassCount: 0,
    possessionStallTime: 0,
    pressTriggerTimer: 0,
    boxStallTimer: 0,
    looseBallStallTimer: 0,
    homePossTicks: 0,
    awayPossTicks: 0,
    liveMetrics: initialLiveMetrics,
    transitionTimer: 0,
    transitionTeamIsHome: null,
    tacticalLabel: '후방 빌드업',
    tacticalLabelTeamIsHome: startHomePoss,
    thirdMan: null,
    director: null,
    scheduledEvents: [...config.events],
    handledEventKeys: new Set(config.preHandledKeys ?? []),
    revealedEventKeys: new Set(config.preHandledKeys ?? []),
    passArc: null,
    runIndicators: [],
    goalRipple: null,
    impactRing: null,
    pitchFlashAlpha: 0,
    localPaceMult: 1.0,
    lastStaminaSyncMinute: Math.floor(config.startMinute),
    stats: {
      passesAttempted: 0,
      passesCompleted: 0,
      recycles: 0,
      switches: 0,
      thirdManRuns: 0,
      interceptions: 0,
      dribbles: 0,
      longRangeBackpassesBlocked: 0,
      lateUrgentForwardPasses: 0,
      maxConsecutiveStallPasses: 0,
      pressingTriggersFired: 0,
      positiveXtPasses: 0,
      boxFreezeGuardsFired: 0,
      openPlayBoxShots: 0,
      secondChanceScrambles: 0,
    },
  };

  return state;
}

/**
 * Lightweight target-only update (zero doctrine / agent profile rebuilds).
 */
export function syncPitchSimTargetsOnly(
  state: PitchSimState,
  params: {
    targetHomePossession: number;
    homeShotsTarget: number;
    awayShotsTarget: number;
    homeShotsOnTargetTarget?: number;
    awayShotsOnTargetTarget?: number;
    homeXgTarget: number;
    awayXgTarget: number;
  },
) {
  state.targetHomePossession = clamp(params.targetHomePossession, 31, 69);
  state.homeShotsTarget = params.homeShotsTarget;
  state.awayShotsTarget = params.awayShotsTarget;
  if (typeof params.homeShotsOnTargetTarget === 'number') {
    state.homeShotsOnTargetTarget = params.homeShotsOnTargetTarget;
  }
  if (typeof params.awayShotsOnTargetTarget === 'number') {
    state.awayShotsOnTargetTarget = params.awayShotsOnTargetTarget;
  }
  state.homeXgTarget = params.homeXgTarget;
  state.awayXgTarget = params.awayXgTarget;
}

/**
 * Hot-syncs rosters, formations, tactics, stamina, and scheduled events mid-match
 * (e.g. after a live 2nd-half substitution or halftime tactical switch) with ZERO player teleporting.
 */
export function syncPitchSimConfig(
  state: PitchSimState,
  params: {
    home: PitchSimTeamInput;
    away: PitchSimTeamInput;
    targetHomePossession: number;
    homeShotsTarget: number;
    awayShotsTarget: number;
    homeShotsOnTargetTarget?: number;
    awayShotsOnTargetTarget?: number;
    homeXgTarget: number;
    awayXgTarget: number;
    events: { key: string; event: MatchEvent }[];
  },
) {
  const curMin = state.matchMinuteFloat;
  syncPitchSimTargetsOnly(state, params);
  state.scheduledEvents = [...params.events];

  const homeEffDiff =
    state.aggHomeBeforeMatch +
    state.homeGoalsLive -
    (state.aggAwayBeforeMatch + state.awayGoalsLive);

  state.baseHomeDoctrine = buildTeamTacticalDoctrine({
    my: params.home,
    opp: params.away,
    minute: curMin,
    scoreDiff: homeEffDiff,
    isBigMatch: state.isBigMatch,
    isKnockoutDecider: state.isKnockoutDecider,
    applyUrgency: false,
  });
  state.baseAwayDoctrine = buildTeamTacticalDoctrine({
    my: params.away,
    opp: params.home,
    minute: curMin,
    scoreDiff: -homeEffDiff,
    isBigMatch: state.isBigMatch,
    isKnockoutDecider: state.isKnockoutDecider,
    applyUrgency: false,
  });
  refreshLiveUrgencyDoctrines(state);

  const nextHomeProfiles = buildTeamAgentProfiles(params.home, curMin);
  const nextAwayProfiles = buildTeamAgentProfiles(params.away, curMin);
  for (let i = 0; i < 11; i += 1) {
    state.homeAgents[i].profile = nextHomeProfiles[i];
    state.homeAgents[i].staminaPct = computeAgentLiveStamina(
      nextHomeProfiles[i],
      state.homeDoctrine,
      curMin,
    );
    state.awayAgents[i].profile = nextAwayProfiles[i];
    state.awayAgents[i].staminaPct = computeAgentLiveStamina(
      nextAwayProfiles[i],
      state.awayDoctrine,
      curMin,
    );
  }
}

/**
 * Increments live 2D-synchronized match metrics the exact moment a shot/save/goal occurs on the pitch.
 */
function recordLiveShotEvent(
  state: PitchSimState,
  isHomeAttack: boolean,
  opts: {
    onTarget: boolean;
    isSave: boolean;
    isGoal: boolean;
    xgDelta: number;
  },
) {
  const m = state.liveMetrics;
  if (isHomeAttack) {
    const capShots = Math.max(state.homeShotsTarget, state.homeGoalsLive);
    const capSot = Math.max(state.homeShotsOnTargetTarget, state.homeGoalsLive);
    m.homeShots = Math.min(capShots, m.homeShots + 1);
    if (opts.onTarget) {
      m.homeShotsOnTarget = Math.min(
        m.homeShots,
        Math.min(capSot, m.homeShotsOnTarget + 1),
      );
    }
    if (opts.isSave) {
      m.awaySaves += 1;
    }
    m.homeXg = Math.min(
      Math.max(state.homeXgTarget, m.homeXg),
      Math.round((m.homeXg + opts.xgDelta) * 100) / 100,
    );
    if (opts.isGoal) {
      m.homeShots = Math.max(m.homeShots, state.homeGoalsLive);
      m.homeShotsOnTarget = Math.max(m.homeShotsOnTarget, state.homeGoalsLive);
    }
  } else {
    const capShots = Math.max(state.awayShotsTarget, state.awayGoalsLive);
    const capSot = Math.max(state.awayShotsOnTargetTarget, state.awayGoalsLive);
    m.awayShots = Math.min(capShots, m.awayShots + 1);
    if (opts.onTarget) {
      m.awayShotsOnTarget = Math.min(
        m.awayShots,
        Math.min(capSot, m.awayShotsOnTarget + 1),
      );
    }
    if (opts.isSave) {
      m.homeSaves += 1;
    }
    m.awayXg = Math.min(
      Math.max(state.awayXgTarget, m.awayXg),
      Math.round((m.awayXg + opts.xgDelta) * 100) / 100,
    );
    if (opts.isGoal) {
      m.awayShots = Math.max(m.awayShots, state.awayGoalsLive);
      m.awayShotsOnTarget = Math.max(m.awayShotsOnTarget, state.awayGoalsLive);
    }
  }
}

/**
 * Updates live 2D-aligned possession, shots, SOT, saves, and xG each simulation tick,
 * reflecting actual on-pitch ball control & shot events while smoothly converging to
 * official half/match targets with zero sudden jumps.
 */
function updateLiveMetrics(state: PitchSimState, dt: number, finalize = false) {
  if (state.possessionIsHome) state.homePossTicks += dt;
  else state.awayPossTicks += dt;

  const span = Math.max(1, state.endMinute - state.startMinute);
  const progress = finalize
    ? 1
    : clamp((state.matchMinuteFloat - state.startMinute) / span, 0, 1);

  const totalPossTicks = state.homePossTicks + state.awayPossTicks;
  const rawSimPoss =
    totalPossTicks > 0.2 ? (state.homePossTicks / totalPossTicks) * 100 : 50;
  // Blend real on-pitch possession with official target smoothly (zero sine wobble, exact convergence at HT/FT)
  const targetWeight = finalize ? 1 : clamp(0.28 + progress * 0.72, 0.28, 0.98);
  const blendedPoss = rawSimPoss * (1 - targetWeight) + state.targetHomePossession * targetWeight;

  const m = state.liveMetrics;
  m.homePossession = Math.round(clamp(blendedPoss, 20, 80));

  if (finalize) {
    m.homePossession = Math.round(clamp(state.targetHomePossession, 20, 80));
    m.homeShots = Math.max(state.homeGoalsLive, Math.round(state.homeShotsTarget));
    m.awayShots = Math.max(state.awayGoalsLive, Math.round(state.awayShotsTarget));
    m.homeShotsOnTarget = Math.min(
      m.homeShots,
      Math.max(state.homeGoalsLive, Math.round(state.homeShotsOnTargetTarget)),
    );
    m.awayShotsOnTarget = Math.min(
      m.awayShots,
      Math.max(state.awayGoalsLive, Math.round(state.awayShotsOnTargetTarget)),
    );
    m.homeXg = Math.round(state.homeXgTarget * 100) / 100;
    m.awayXg = Math.round(state.awayXgTarget * 100) / 100;
    m.homeSaves = Math.max(m.homeSaves, Math.max(0, m.awayShotsOnTarget - state.awayGoalsLive));
    m.awaySaves = Math.max(m.awaySaves, Math.max(0, m.homeShotsOnTarget - state.homeGoalsLive));
    return;
  }

  // Smoothly pace non-highlight background shots & xG so counters never lag far behind or jump at HT/FT
  const expectedHomeShots = Math.floor(state.homeShotsTarget * progress);
  const expectedAwayShots = Math.floor(state.awayShotsTarget * progress);
  const expectedHomeSot = Math.floor(state.homeShotsOnTargetTarget * progress);
  const expectedAwaySot = Math.floor(state.awayShotsOnTargetTarget * progress);

  if (m.homeShots < expectedHomeShots) {
    m.homeShots = Math.min(state.homeShotsTarget, expectedHomeShots);
  }
  if (m.awayShots < expectedAwayShots) {
    m.awayShots = Math.min(state.awayShotsTarget, expectedAwayShots);
  }
  if (m.homeShotsOnTarget < expectedHomeSot) {
    m.homeShotsOnTarget = Math.min(m.homeShots, expectedHomeSot);
  }
  if (m.awayShotsOnTarget < expectedAwaySot) {
    m.awayShotsOnTarget = Math.min(m.awayShots, expectedAwaySot);
  }
  m.homeShots = Math.max(m.homeShots, state.homeGoalsLive);
  m.awayShots = Math.max(m.awayShots, state.awayGoalsLive);
  m.homeShotsOnTarget = Math.min(
    m.homeShots,
    Math.max(m.homeShotsOnTarget, state.homeGoalsLive),
  );
  m.awayShotsOnTarget = Math.min(
    m.awayShots,
    Math.max(m.awayShotsOnTarget, state.awayGoalsLive),
  );

  const floorHomeXg = Math.round(state.homeXgTarget * progress * 0.92 * 100) / 100;
  const floorAwayXg = Math.round(state.awayXgTarget * progress * 0.92 * 100) / 100;
  if (m.homeXg < floorHomeXg) {
    m.homeXg = Math.min(state.homeXgTarget, floorHomeXg);
  }
  if (m.awayXg < floorAwayXg) {
    m.awayXg = Math.min(state.awayXgTarget, floorAwayXg);
  }
  m.homeSaves = Math.max(
    m.homeSaves,
    Math.max(0, m.awayShotsOnTarget - state.awayGoalsLive),
  );
  m.awaySaves = Math.max(
    m.awaySaves,
    Math.max(0, m.homeShotsOnTarget - state.homeGoalsLive),
  );
}

/**
 * Forces decisive open-play action inside the penalty / 6-yard box so an attacker
 * or defender never stalls against the goal line or inside Arrive deadzones.
 * Never alters official match goals (open-play shots resolve cleanly as GK save / block / clearance).
 */
function triggerOpenPlayBoxAction(
  state: PitchSimState,
  carrier: PlayerAgentState,
  isHome: boolean,
) {
  const dir = isHome ? 1 : -1;
  const teammates = isHome ? state.homeAgents : state.awayAgents;
  const defenders = isHome ? state.awayAgents : state.homeAgents;
  const depth = getAttackDepth(isHome, carrier.x);

  // Case 1: Defending team trapped inside own penalty box -> immediate clearance / GK punt upfield!
  if (depth <= 0.22) {
    const targetMate =
      teammates
        .slice(1)
        .filter((t) => t.slotIndex !== carrier.slotIndex)
        .sort((a, b) => getAttackDepth(isHome, b.x) - getAttackDepth(isHome, a.x))[0] ??
      teammates[6];
    const clearX = clamp(carrier.x + dir * 0.28, 0.24, 0.76);
    const clearY = clamp(
      targetMate ? targetMate.y : carrier.y < 0.5 ? 0.24 : 0.76,
      0.14,
      0.86,
    );
    state.carrierHoldTimer = 0;
    state.carrierDecisionDelay = 0.36;
    state.boxStallTimer = 0;
    state.stats.passesAttempted += 1;
    launchBallFlight({
      state,
      flightType: 'long_switch',
      fromX: carrier.x,
      fromY: carrier.y,
      toX: clearX,
      toY: clearY,
      targetTeamIsHome: isHome,
      targetIdx: targetMate ? targetMate.slotIndex : 6,
      passerIsHome: isHome,
      passerIdx: carrier.slotIndex,
      speedOverride: 0.48,
      maxArcZ: 0.65,
    });
    return;
  }

  // Case 2: Attacking team deep in opponent box -> try crisp cutback to open box teammate, else shoot!
  const openBoxMate = teammates.find(
    (m) =>
      m.slotIndex !== 0 &&
      m.slotIndex !== carrier.slotIndex &&
      getAttackDepth(isHome, m.x) >= 0.76 &&
      Math.hypot(m.x - carrier.x, m.y - carrier.y) >= 0.05 &&
      Math.hypot(m.x - carrier.x, m.y - carrier.y) <= 0.24 &&
      Math.abs(m.y - 0.5) < Math.abs(carrier.y - 0.5) - 0.04,
  );
  if (openBoxMate && Math.abs(carrier.y - 0.5) > 0.16 && nextSimRng(state) < 0.48) {
    state.carrierHoldTimer = 0;
    state.carrierDecisionDelay = 0.28;
    state.boxStallTimer = 0;
    state.stats.passesAttempted += 1;
    launchBallFlight({
      state,
      flightType: 'ground_pass',
      fromX: carrier.x,
      fromY: carrier.y,
      toX: clamp(openBoxMate.x + dir * 0.015, 0.08, 0.92),
      toY: clamp(openBoxMate.y, 0.24, 0.76),
      targetTeamIsHome: isHome,
      targetIdx: openBoxMate.slotIndex,
      passerIsHome: isHome,
      passerIdx: carrier.slotIndex,
      speedOverride: 0.50,
    });
    return;
  }

  // Immediate open-play box shot -> GK catch/parry or defender block/clearance (keeps live tempo snappy!)
  const roll = nextSimRng(state);
  const isGkSave = roll < 0.62;
  const shotTargetX = isGkSave ? atkX(isHome, 0.955) : atkX(isHome, 0.895);
  const shotTargetY = clamp(0.42 + nextSimRng(state) * 0.16, 0.38, 0.62);
  const receiverDefIdx = isGkSave
    ? 0
    : defenders
        .slice(1)
        .sort(
          (a, b) =>
            Math.hypot(a.x - carrier.x, a.y - carrier.y) -
            Math.hypot(b.x - carrier.x, b.y - carrier.y),
        )[0]?.slotIndex ?? 1;

  state.stats.openPlayBoxShots += 1;
  state.carrierHoldTimer = 0;
  state.carrierDecisionDelay = 0.34;
  state.boxStallTimer = 0;
  state.impactRing = {
    x: shotTargetX,
    y: shotTargetY,
    alpha: 0.72,
    color: isGkSave ? '#38bdf8' : '#fbbf24',
  };
  recordLiveShotEvent(state, isHome, {
    onTarget: isGkSave,
    isSave: isGkSave,
    isGoal: false,
    xgDelta: isGkSave ? 0.09 : 0.05,
  });
  launchBallFlight({
    state,
    flightType: 'shot',
    fromX: carrier.x,
    fromY: carrier.y,
    toX: shotTargetX,
    toY: shotTargetY,
    targetTeamIsHome: !isHome,
    targetIdx: receiverDefIdx,
    passerIsHome: isHome,
    passerIdx: carrier.slotIndex,
    speedOverride: 0.62,
    maxArcZ: 0.22,
  });
}

/**
 * Mandatory penalty-box / 6-yard-box anti-freeze guard (~0.42s threshold).
 * Eliminates any possibility of ball, attacker, defender, or GK freezing in front of goal.
 */
function enforcePenaltyBoxFreezeGuard(state: PitchSimState, dt: number) {
  const ball = state.ball;
  const dirCue = state.director;

  // Intentional dead-ball pauses (set-piece whistle spot or post-goal celebration) never trigger guard
  if (dirCue && (dirCue.stage === 'set_piece_setup' || dirCue.stage === 'reveal')) {
    state.boxStallTimer = 0;
    state.looseBallStallTimer = 0;
    return;
  }

  const inEitherPenaltyBox =
    (ball.x <= 0.175 || ball.x >= 0.825) && ball.y >= 0.16 && ball.y <= 0.84;
  const ballSpeed = Math.hypot(ball.x - ball.prevX, ball.y - ball.prevY) / Math.max(1e-4, dt);
  const isNearStationary = ballSpeed < 0.04;

  // 1) Orphaned loose ball anywhere on pitch (ownerIdx === null && flightProgress >= 1)
  if (ball.ownerIdx === null && ball.flightProgress >= 1) {
    state.looseBallStallTimer += dt;
    if (state.looseBallStallTimer >= 0.24) {
      state.looseBallStallTimer = 0;
      state.stats.boxFreezeGuardsFired += 1;

      if (dirCue && dirCue.stage === 'execute_route') {
        const atkAgents = dirCue.isHomeAttack ? state.homeAgents : state.awayAgents;
        const scorer = atkAgents[dirCue.scorerIdx];
        if (scorer) {
          triggerDirectorShot(state, dirCue, scorer);
          return;
        }
      }

      // Nearest player picks up and immediately clears/plays on
      let bestIsHome = ball.x < 0.5;
      let bestIdx = 0;
      let bestDist = 999;
      for (const sideHome of [true, false]) {
        const list = sideHome ? state.homeAgents : state.awayAgents;
        for (let i = 0; i < list.length; i += 1) {
          const d = Math.hypot(list[i].x - ball.x, list[i].y - ball.y);
          // Slight GK priority inside own 6-yard box
          const gkBonus =
            i === 0 && ((sideHome && ball.x < 0.10) || (!sideHome && ball.x > 0.90))
              ? -0.05
              : 0;
          if (d + gkBonus < bestDist) {
            bestDist = d + gkBonus;
            bestIsHome = sideHome;
            bestIdx = i;
          }
        }
      }
      ball.ownerTeamIsHome = bestIsHome;
      ball.ownerIdx = bestIdx;
      ball.lastTouchTeamIsHome = bestIsHome;
      ball.lastTouchIdx = bestIdx;
      ball.flightType = 'carry';
      ball.trail = [];
      state.possessionIsHome = bestIsHome;
      state.carrierHoldTimer = 0;
      state.carrierDecisionDelay = 0.18;
      const collector = (bestIsHome ? state.homeAgents : state.awayAgents)[bestIdx];
      if (collector && inEitherPenaltyBox) {
        triggerOpenPlayBoxAction(state, collector, bestIsHome);
      }
      return;
    }
  } else {
    state.looseBallStallTimer = 0;
  }

  // 2) Penalty-box / 6-yard-box stationary carrier or deadlock guard (0.42s)
  if (inEitherPenaltyBox && isNearStationary) {
    state.boxStallTimer += dt;
  } else {
    state.boxStallTimer = Math.max(0, state.boxStallTimer - dt * 2.5);
  }

  if (state.boxStallTimer >= 0.42) {
    state.boxStallTimer = 0;
    state.stats.boxFreezeGuardsFired += 1;

    if (dirCue) {
      if (dirCue.stage === 'execute_route' || dirCue.stage === 'approach') {
        const atkAgents = dirCue.isHomeAttack ? state.homeAgents : state.awayAgents;
        const scorer = atkAgents[dirCue.scorerIdx];
        if (scorer) {
          triggerDirectorShot(state, dirCue, scorer);
          return;
        }
      }
      return;
    }

    if (ball.ownerTeamIsHome !== null && ball.ownerIdx !== null) {
      const carrier = (ball.ownerTeamIsHome ? state.homeAgents : state.awayAgents)[
        ball.ownerIdx
      ];
      if (carrier) {
        triggerOpenPlayBoxAction(state, carrier, ball.ownerTeamIsHome);
      }
    }
  }
}

/**
 * Evaluates 7 candidate Support Spots around a player's formation anchor using
 * Buckland (Simple Soccer) + Spearman (Pitch Control) principles.
 */
function pickBestSupportSpot(params: {
  agent: PlayerAgentState;
  anchor: SimVec2;
  carrier: PlayerAgentState;
  teammates: PlayerAgentState[];
  defenders: PlayerAgentState[];
  atkDoctrine: TeamTacticalDoctrine;
  defDoctrine: TeamTacticalDoctrine;
  oppBacklineX: number;
}): SimVec2 {
  const {
    agent,
    anchor,
    carrier,
    teammates,
    defenders,
    atkDoctrine,
    defDoctrine,
    oppBacklineX,
  } = params;
  const dir = agent.isHome ? 1 : -1;
  const sideSign = anchor.y < 0.42 ? -1 : anchor.y > 0.58 ? 1 : 0;
  const p = agent.profile;

  // 7 candidate tactical support spots around dynamic formation anchor
  const candidates: SimVec2[] = [
    anchor,
    // Forward advance / behind-line run
    { x: clamp(anchor.x + dir * 0.085, 0.07, 0.93), y: anchor.y },
    // Drop-in link / recycle support
    { x: clamp(anchor.x - dir * 0.065, 0.07, 0.93), y: anchor.y },
    // Inside half-space pocket
    {
      x: clamp(anchor.x + dir * 0.035, 0.07, 0.93),
      y: clamp(anchor.y + (sideSign !== 0 ? -sideSign * 0.09 : (carrier.y < 0.5 ? 0.08 : -0.08)), 0.08, 0.92),
    },
    // Wide touchline stretch
    {
      x: clamp(anchor.x + dir * 0.03, 0.07, 0.93),
      y: clamp(anchor.y + (sideSign !== 0 ? sideSign * 0.085 : (carrier.y < 0.5 ? -0.10 : 0.10)), 0.06, 0.94),
    },
    // Diagonal channel penetrate behind opp backline
    {
      x: clamp(oppBacklineX + dir * 0.03, 0.08, 0.92),
      y: clamp(anchor.y * 0.72 + 0.5 * 0.28, 0.12, 0.88),
    },
    // Safe back-angle triangle relative to carrier
    {
      x: clamp(carrier.x - dir * 0.09, 0.08, 0.92),
      y: clamp(carrier.y + (carrier.y < 0.5 ? 0.14 : -0.14), 0.10, 0.90),
    },
  ];

  const synergyBonus = p.synergyWithSlot[carrier.slotIndex] * 0.08;
  let bestSpot = anchor;
  let bestScore = -999;

  for (let c = 0; c < candidates.length; c += 1) {
    const spot = candidates[c];
    // Keep realistic tether to formation anchor (Total Football allows wider roaming)
    const anchorDist = Math.hypot(spot.x - anchor.x, spot.y - anchor.y);
    const maxRoam = 0.15 + atkDoctrine.positionSwitching * 0.09;
    if (anchorDist > maxRoam) continue;

    // 1) Pass lane openness from carrier
    const laneOpen = evaluatePassLaneSafety(
      { x: carrier.x, y: carrier.y },
      spot,
      defenders,
      defDoctrine,
      false,
    );
    // 2) Pitch Control defender clearance
    const spaceFree = evaluateSpotClearance(spot, defenders);
    // 3) Ideal passing distance (depends on tactic passLengthBias)
    const distFromCarrier = Math.hypot(spot.x - carrier.x, spot.y - carrier.y);
    const idealDist = 0.17 + atkDoctrine.passLengthBias * 0.07;
    const distFit = 1 - clamp(Math.abs(distFromCarrier - idealDist) / 0.26, 0, 1);

    // 4) Forward progression & Playstyle affinity
    const forwardGain = (spot.x - carrier.x) * dir;
    let roleFit = 0;
    if (c === 1 || c === 5) {
      roleFit += p.runBehindBias * 0.45 + (forwardGain > 0 ? 0.18 : -0.10);
      if (p.boxCrashBias > 0.65 && Math.abs(spot.y - 0.5) < 0.24) roleFit += 0.22;
    } else if (c === 2 || c === 6) {
      roleFit += p.dropToLinkBias * 0.42 + atkDoctrine.buildUpPatience * 0.22;
    } else if (c === 3) {
      roleFit += p.cutInsideBias * 0.42 + atkDoctrine.centralBias * 0.25;
    } else if (c === 4) {
      roleFit +=
        (p.hugTouchlineBias * 0.42 + p.overlapBias * 0.30) +
        atkDoctrine.flankBias * 0.25;
    } else {
      roleFit += p.holdPositionBias * 0.28;
    }

    // 5) Avoid crowding another teammate
    let crowdPen = 0;
    for (let t = 1; t < teammates.length; t += 1) {
      if (t === agent.slotIndex || t === carrier.slotIndex) continue;
      const td = Math.hypot(teammates[t].targetX - spot.x, teammates[t].targetY - spot.y);
      if (td < 0.095) crowdPen += (0.095 - td) * 3.8;
    }

    const score =
      laneOpen * (0.42 + synergyBonus) +
      spaceFree * 0.36 +
      distFit * 0.22 +
      roleFit -
      anchorDist * 0.75 -
      crowdPen;

    if (score > bestScore) {
      bestScore = score;
      bestSpot = spot;
    }
  }

  return bestSpot;
}

/**
 * Attempts to launch an explicit A -> B -> C Third-Man Run tactical pattern!
 */
function tryInitiateThirdManRun(params: {
  state: PitchSimState;
  carrier: PlayerAgentState;
  teammates: PlayerAgentState[];
  defenders: PlayerAgentState[];
  atkDoctrine: TeamTacticalDoctrine;
  defDoctrine: TeamTacticalDoctrine;
  oppBacklineX: number;
}): boolean {
  const {
    state,
    carrier,
    teammates,
    defenders,
    atkDoctrine,
    defDoctrine,
    oppBacklineX,
  } = params;
  const dir = carrier.isHome ? 1 : -1;

  // Trigger probability scales sharply with tactic, manager trait (tiki_taka / total_football / midfield_maestro / halftime_wizard), and carrier PAS
  const pasNorm = clamp((carrier.profile.attrs.pas - 65) / 32, 0, 1);
  const stallThirdManBoost =
    state.stallPassCount >= 1 && atkDoctrine.thirdManFreq > 0.55
      ? Math.min(0.18, state.stallPassCount * 0.06 * atkDoctrine.thirdManFreq)
      : 0;
  const triggerProb = clamp(
    Math.pow(atkDoctrine.thirdManFreq, 1.65) * 0.62 + pasNorm * 0.06 + stallThirdManBoost,
    0.04,
    0.72,
  );
  if (nextSimRng(state) > triggerProb) return false;

  // Don't trigger from inside own 6-yard box
  const carrierDepth = carrier.isHome ? carrier.x : 1 - carrier.x;
  if (carrierDepth < 0.22 || carrierDepth > 0.80) return false;
  const inBox = carrierDepth >= BOX_ZONE_MIN_DEPTH;
  const inFinal3rd = carrierDepth >= FINAL_THIRD_MIN_DEPTH && !inBox;

  // 1) Pick wall/link player B (midfielder, CAM, or complete_forward ahead of or lateral to A)
  let bestB: PlayerAgentState | null = null;
  let bestBScore = 0.35;
  for (let i = 1; i < teammates.length; i += 1) {
    if (i === carrier.slotIndex) continue;
    const b = teammates[i];
    const dist = Math.hypot(b.x - carrier.x, b.y - carrier.y);
    if (dist < 0.09 || dist > 0.34) continue;
    const bDepth = getAttackDepth(carrier.isHome, b.x);
    const backDist = Math.max(0, carrierDepth - bDepth);
    if (inBox && (bDepth < 0.50 || backDist > MAX_BOX_BACKPASS_DIST)) continue;
    if (inFinal3rd && (bDepth < 0.48 || backDist > MAX_FINAL_THIRD_BACKPASS_DIST)) continue;
    const lane = evaluatePassLaneSafety(
      { x: carrier.x, y: carrier.y },
      { x: b.x, y: b.y },
      defenders,
      defDoctrine,
    );
    if (lane < 0.34) continue;

    const syn = carrier.profile.synergyWithSlot[i] * 0.10;
    const wallAffinity =
      b.profile.dropToLinkBias * 0.45 +
      (b.profile.subPosition === 'CAM' || b.profile.subPosition === 'CM' ? 0.25 : 0) +
      (b.profile.playstyles.includes('complete_forward') ? 0.28 : 0);
    const forward = clamp((b.x - carrier.x) * dir * 1.2, -0.1, 0.3);
    const score = lane * 0.48 + wallAffinity + syn + forward;
    if (score > bestBScore) {
      bestBScore = score;
      bestB = b;
    }
  }
  if (!bestB) return false;

  // 2) Pick 3rd-man runner C (line_breaker, winger, box_to_box, attacking_wingback)
  let bestC: PlayerAgentState | null = null;
  let bestCScore = 0.34;
  let bestTarget: SimVec2 = { x: 0.5, y: 0.5 };

  for (let i = 1; i < teammates.length; i += 1) {
    if (i === carrier.slotIndex || i === bestB.slotIndex) continue;
    const c = teammates[i];
    if (c.profile.subPosition === 'CB') continue;

    // Target space: break midfield press half-space OR penetrate behind opponent backline
    const channelY = clamp(
      c.y * 0.68 + (bestB.y < 0.5 ? 0.66 : 0.34) * 0.32,
      0.14,
      0.86,
    );
    const cDepth = c.isHome ? c.x : 1 - c.x;
    const oppLineDepth = c.isHome ? oppBacklineX : 1 - oppBacklineX;
    const runX = clamp(
      cDepth + 0.16 >= oppLineDepth - 0.06
        ? Math.max(cDepth + 0.12, oppLineDepth + 0.04)
        : cDepth + 0.15,
      0.30,
      0.89,
    );
    const target: SimVec2 = {
      x: atkX(c.isHome, runX),
      y: channelY,
    };
    const bToTargetDist = Math.hypot(target.x - bestB.x, target.y - bestB.y);
    if (bToTargetDist < 0.08 || bToTargetDist > 0.44) continue;

    const space = evaluateSpotClearance(target, defenders);
    const synBC = bestB.profile.synergyWithSlot[i] * 0.12;
    const stamOk = c.staminaPct >= 42 ? 0.12 : -0.15;
    const runnerAffinity =
      c.profile.runBehindBias * 0.48 +
      c.profile.boxCrashBias * 0.22 +
      c.profile.overlapBias * 0.18;
    const score = space * 0.42 + runnerAffinity + synBC + stamOk;
    if (score > bestCScore) {
      bestCScore = score;
      bestC = c;
      bestTarget = target;
    }
  }
  if (!bestC) return false;

  state.thirdMan = {
    active: true,
    teamIsHome: carrier.isHome,
    aIdx: carrier.slotIndex,
    bIdx: bestB.slotIndex,
    cIdx: bestC.slotIndex,
    stage: 'a_to_b',
    wallSpot: { x: bestB.x, y: bestB.y },
    runTarget: bestTarget,
    timer: 0,
  };
  state.tacticalLabel = '삼자 연계';
  state.tacticalLabelTeamIsHome = carrier.isHome;
  state.stats.thirdManRuns += 1;
  state.stats.passesAttempted += 1;

  launchBallFlight({
    state,
    flightType: 'ground_pass',
    fromX: carrier.x,
    fromY: carrier.y,
    toX: bestB.x,
    toY: bestB.y,
    targetTeamIsHome: carrier.isHome,
    targetIdx: bestB.slotIndex,
    passerIsHome: carrier.isHome,
    passerIdx: carrier.slotIndex,
    speedOverride: 0.40,
  });

  return true;
}

/**
 * Utility AI carrier decision maker:
 * Evaluates Pass (short / progressive / through-ball / aerial switch / patient recycle),
 * Third-Man Run, and Dribble/Carry using all 5 tactical & attribute layers.
 */
function executeCarrierUtilityDecision(state: PitchSimState) {
  const isHome = state.possessionIsHome;
  const teammates = isHome ? state.homeAgents : state.awayAgents;
  const defenders = isHome ? state.awayAgents : state.homeAgents;
  const atkDoctrine = isHome ? state.homeDoctrine : state.awayDoctrine;
  const defDoctrine = isHome ? state.awayDoctrine : state.homeDoctrine;
  const carrierIdx = state.ball.ownerIdx;
  if (carrierIdx === null) return;
  const carrier = teammates[carrierIdx];
  if (!carrier) return;

  const dir = isHome ? 1 : -1;
  const carrierDepth = isHome ? carrier.x : 1 - carrier.x;
  const oppBacklineX = getDefensiveBacklineX(defenders, !isHome);

  // 1) If we are B inside an active Third-Man Run, immediately release the through-ball to C!
  if (
    state.thirdMan &&
    state.thirdMan.active &&
    state.thirdMan.teamIsHome === isHome &&
    state.thirdMan.bIdx === carrierIdx &&
    state.thirdMan.stage === 'b_hold'
  ) {
    const runner = teammates[state.thirdMan.cIdx];
    const blendedX = lerp(runner.x + runner.vx * 0.45, state.thirdMan.runTarget.x, 0.55);
    const blendedY = lerp(runner.y + runner.vy * 0.45, state.thirdMan.runTarget.y, 0.45);
    let leadX = clamp(blendedX + dir * 0.035, 0.08, 0.92);
    const leadY = clamp(blendedY, 0.08, 0.92);
    if (carrierDepth >= FINAL_THIRD_MIN_DEPTH) {
      const minDepth = Math.max(
        carrierDepth >= BOX_ZONE_MIN_DEPTH ? 0.52 : 0.50,
        carrierDepth - (carrierDepth >= BOX_ZONE_MIN_DEPTH ? MAX_BOX_BACKPASS_DIST : MAX_FINAL_THIRD_BACKPASS_DIST),
      );
      if (getAttackDepth(isHome, leadX) < minDepth) {
        leadX = isHome ? minDepth : 1 - minDepth;
      }
    }
    state.thirdMan.stage = 'b_to_c';
    state.tacticalLabel = '하프스페이스 침투';
    state.tacticalLabelTeamIsHome = isHome;
    state.stats.passesAttempted += 1;

    launchBallFlight({
      state,
      flightType: 'through_ball',
      fromX: carrier.x,
      fromY: carrier.y,
      toX: leadX,
      toY: leadY,
      targetTeamIsHome: isHome,
      targetIdx: runner.slotIndex,
      passerIsHome: isHome,
      passerIdx: carrierIdx,
      speedOverride: 0.45 + ((carrier.profile.attrs.pas - 75) / 100) * 0.12,
      arcColor: '#34d399',
    });
    return;
  }

  // 2) Try explicit Third-Man Run (A -> B -> C)
  if (
    !state.thirdMan &&
    carrierIdx !== 0 &&
    tryInitiateThirdManRun({
      state,
      carrier,
      teammates,
      defenders,
      atkDoctrine,
      defDoctrine,
      oppBacklineX,
    })
  ) {
    return;
  }

  // 3) Evaluate local pressure on carrier
  let nearestDefDist = 1.0;
  for (let i = 1; i < defenders.length; i += 1) {
    const d = Math.hypot(defenders[i].x - carrier.x, defenders[i].y - carrier.y);
    if (d < nearestDefDist) nearestDefDist = d;
  }
  const underHeavyPress = nearestDefDist < 0.075;

  const urgency = atkDoctrine.attackUrgency;
  const protect = atkDoctrine.protectUrgency;
  const inBoxZone = carrierDepth >= BOX_ZONE_MIN_DEPTH;
  const inFinalThird = carrierDepth >= FINAL_THIRD_MIN_DEPTH && !inBoxZone;

  // 4) Consider Dribble/Carry forward (in box zone: 1v1 penetration; when stalled: press-breaking carry!)
  const originXT = sampleExpectedThreat(isHome, carrier.x, carrier.y);
  const stallPassThreshold = atkDoctrine.buildUpPatience > 0.65 ? 3 : 2;
  const stallTimeThreshold = (atkDoctrine.buildUpPatience > 0.65 ? 3.4 : 2.2) / clamp(atkDoctrine.tempo, 0.78, 1.32);
  const stallPressure = clamp(
    Math.max(0, state.stallPassCount - stallPassThreshold) * 0.34 +
      Math.max(0, state.possessionStallTime - stallTimeThreshold) * 0.16,
    0,
    1.55,
  );

  // Deep inside opponent penalty / 6-yard box: shoot or cutback decisively instead of clamping into goal-line deadlock!
  if (inBoxZone && carrierDepth >= 0.875 && carrierIdx !== 0) {
    triggerOpenPlayBoxAction(state, carrier, isHome);
    return;
  }

  const aheadSpot: SimVec2 = inBoxZone
    ? {
        x: clamp(carrier.x + dir * 0.055, 0.06, 0.94),
        y: clamp(lerp(carrier.y, 0.5, 0.34), 0.16, 0.84),
      }
    : {
        x: clamp(carrier.x + dir * 0.095, 0.07, 0.93),
        y: clamp(
          carrier.y +
            (carrier.profile.cutInsideBias > 0.6 ? (carrier.y < 0.5 ? 0.055 : -0.055) : 0),
          0.08,
          0.92,
        ),
      };
  const aheadSpace = evaluateSpotClearance(aheadSpot, defenders);
  const aheadXTDelta = sampleExpectedThreat(isHome, aheadSpot.x, aheadSpot.y) - originXT;
  const dribbleScore =
    carrierIdx === 0
      ? -1
      : carrier.profile.dribbleBias * 0.55 +
        aheadSpace * 0.45 +
        aheadXTDelta * 4.5 +
        (carrier.profile.isStar ? atkDoctrine.starFocus * 0.20 : 0) +
        (inBoxZone ? 0.22 + carrier.profile.shootBias * 0.16 : 0) +
        (inFinalThird ? 0.08 : 0) +
        urgency * 0.20 +
        stallPressure * 0.26 -
        (underHeavyPress ? 0.18 : 0);

  const dribbleProb = clamp(
    (inBoxZone ? 0.44 + urgency * 0.14 : 0.34 + urgency * 0.10) + stallPressure * 0.14,
    0.20,
    0.78,
  );
  if (dribbleScore > (inBoxZone ? 0.62 : 0.70) && nextSimRng(state) < dribbleProb) {
    carrier.targetX = aheadSpot.x;
    carrier.targetY = aheadSpot.y;
    state.carrierHoldTimer = 0;
    state.carrierDecisionDelay = clamp(
      (0.60 * (1 - 0.24 * urgency)) / atkDoctrine.tempo,
      0.26,
      0.82,
    );
    if (aheadXTDelta >= 0.004) {
      state.stallPassCount = Math.max(0, state.stallPassCount - 1);
      state.possessionStallTime = Math.max(0, state.possessionStallTime - 1.2);
    }
    state.stats.dribbles += 1;
    if (carrierDepth > 0.58) {
      state.tacticalLabel = '하프스페이스 침투';
      state.tacticalLabelTeamIsHome = isHome;
    }
    return;
  }

  // 5) Evaluate every teammate passing option with Karun Singh xT, Stall Decay, Zone Backpass Caps & Urgency AI!
  type PassCandidate = {
    idx: number;
    score: number;
    flightType: BallFlightType;
    destX: number;
    destY: number;
    isRecycle: boolean;
    isSwitch: boolean;
    isBoxCross: boolean;
    forwardDelta: number;
    deltaXT: number;
    laneSafety: number;
  };

  const options: PassCandidate[] = [];
  const pasNorm = clamp((carrier.profile.attrs.pas - 58) / 40, 0, 1);
  const croNorm = clamp((carrier.profile.attrs.cro - 58) / 40, 0, 1);
  const kicNorm = clamp(((carrier.profile.attrs.gk?.kic ?? 74) - 58) / 40, 0, 1);

  let maxForwardSafety = 0;

  for (let i = 0; i < teammates.length; i += 1) {
    if (i === carrierIdx) continue;
    // Never pass back to GK from final third / opponent half, when stalled, or without GK buildup support
    if (
      i === 0 &&
      (carrierDepth > 0.44 ||
        urgency >= 0.40 ||
        state.stallPassCount >= 3 ||
        (atkDoctrine.gkBuildupSupport < 0.35 && !underHeavyPress))
    ) {
      continue;
    }

    const mate = teammates[i];
    const dist = Math.hypot(mate.x - carrier.x, mate.y - carrier.y);
    if (dist < 0.052) continue;

    const mateDepth = getAttackDepth(isHome, mate.x);
    const forwardDelta = (mate.x - carrier.x) * dir;
    const backwardDist = Math.max(0, -forwardDelta);
    const lateralDelta = Math.abs(mate.y - carrier.y);

    // ── Zone-based Hard Backpass Filter (eliminates box -> own-half 40~50m backpasses!) ──
    if (inBoxZone) {
      if (mateDepth < 0.50 || backwardDist > MAX_BOX_BACKPASS_DIST) {
        state.stats.longRangeBackpassesBlocked += 1;
        continue;
      }
    } else if (inFinalThird) {
      if (mateDepth < 0.48 || backwardDist > MAX_FINAL_THIRD_BACKPASS_DIST) {
        state.stats.longRangeBackpassesBlocked += 1;
        continue;
      }
    } else if (backwardDist > 0.32 && !(i === 0 && carrierDepth <= 0.36)) {
      state.stats.longRangeBackpassesBlocked += 1;
      continue;
    }

    // Diagonal switch MUST be lateral or progressive (never a deep backward bomb!)
    const isSwitch = lateralDelta > 0.34 && dist > 0.30 && forwardDelta >= -0.10;
    const isBoxCross =
      carrierDepth >= 0.68 &&
      Math.abs(carrier.y - 0.5) > 0.26 &&
      mateDepth >= 0.78 &&
      Math.abs(mate.y - 0.5) < 0.26;
    const isCutback =
      inBoxZone &&
      Math.abs(carrier.y - 0.5) > 0.20 &&
      mateDepth >= 0.75 &&
      Math.abs(mate.y - 0.5) < 0.24;
    const isShortLayoff = inBoxZone && dist <= 0.18 && mateDepth >= 0.72;
    const isThrough =
      forwardDelta > 0.12 &&
      (mate.profile.runBehindBias > 0.52 || urgency >= 0.40 || stallPressure >= 0.55) &&
      mateDepth > 0.54;
    const isRecycle = forwardDelta <= 0.025 && !isCutback && !isBoxCross;

    const flightType: BallFlightType = isBoxCross
      ? 'cross'
      : isSwitch
        ? 'long_switch'
        : isThrough
          ? 'through_ball'
          : 'ground_pass';

    // Predictive lead position for through balls / moving receivers
    const leadScale = isThrough ? 0.42 : isBoxCross ? 0.28 : 0.16;
    let destX = clamp(
      mate.x + mate.vx * leadScale + (isThrough ? dir * 0.032 : 0),
      0.05,
      0.95,
    );
    const destY = clamp(mate.y + mate.vy * leadScale, 0.05, 0.95);
    if (inBoxZone || inFinalThird) {
      const minAllowedDepth = Math.max(
        inBoxZone ? 0.50 : 0.48,
        carrierDepth - (inBoxZone ? MAX_BOX_BACKPASS_DIST : MAX_FINAL_THIRD_BACKPASS_DIST),
      );
      if (getAttackDepth(isHome, destX) < minAllowedDepth) {
        destX = isHome ? minAllowedDepth : 1 - minAllowedDepth;
      }
    }

    const destXT = sampleExpectedThreat(isHome, destX, destY);
    const deltaXT = destXT - originXT;

    const laneSafety = evaluatePassLaneSafety(
      { x: carrier.x, y: carrier.y },
      { x: destX, y: destY },
      defenders,
      defDoctrine,
      isSwitch || isBoxCross,
    );
    if (forwardDelta > 0.06 && laneSafety > maxForwardSafety) {
      maxForwardSafety = laneSafety;
    }

    const spaceFree = evaluateSpotClearance({ x: destX, y: destY }, defenders);
    const synergyLink = carrier.profile.synergyWithSlot[i]; // 0..4
    const synBonus = synergyLink * 0.11;
    const starBonus = mate.profile.isStar ? atkDoctrine.starFocus * 0.18 : 0;

    // Distance preference shaped by tactic passLengthBias & PAS/KIC
    const visionRange =
      carrierIdx === 0
        ? 0.28 + kicNorm * 0.32
        : 0.28 + pasNorm * 0.28 + (isSwitch || isBoxCross ? croNorm * 0.14 : 0);
    const rangePen = dist > visionRange ? (dist - visionRange) * 1.9 : 0;

    let utility =
      laneSafety * 0.72 +
      spaceFree * 0.38 +
      synBonus +
      starBonus -
      rangePen;

    // Karun Singh Expected Threat (xT) progression reward (amplified by stallPressure & urgency!)
    if (deltaXT > 0) {
      utility += deltaXT * (8.5 + urgency * 5.2 + stallPressure * 4.2);
    } else if (deltaXT < 0) {
      utility += deltaXT * (2.6 + stallPressure * 3.0 + urgency * 2.2);
    }

    // Box-zone & final-third attacking priorities
    if (isCutback) {
      utility += 0.54 + urgency * 0.30;
    }
    if (isBoxCross) {
      utility += 0.38 + croNorm * 0.24 + urgency * 0.50 + stallPressure * 0.24 + (mate.profile.attrs.aer - 75) * 0.008;
    }
    if (isShortLayoff) {
      utility += 0.32 + synBonus * 0.5;
    }

    // Progression vs Patient Recycling balance (modulated by xT, Stall Decay & Game State Urgency!)
    if (forwardDelta > 0.03) {
      const progReward =
        forwardDelta *
        (1.18 +
          atkDoctrine.passLengthBias * 0.72 +
          (state.transitionTimer > 0 ? 0.78 : 0) +
          urgency * 1.25 +
          stallPressure * 0.72);
      utility += progReward;
      if (atkDoctrine.passLengthBias > 0.15) {
        utility += atkDoctrine.passLengthBias * 0.34;
      }
      if (forwardDelta >= 0.08 || deltaXT >= 0.008) {
        utility += stallPressure * 0.48;
      }
      if (isThrough) {
        utility +=
          pasNorm * 0.32 +
          atkDoctrine.counterSprintUrgency * 0.26 +
          mate.profile.runBehindBias * 0.24 +
          urgency * 0.55 +
          stallPressure * 0.38;
      }
      if (mateDepth >= 0.76) {
        utility += urgency * 0.45 + stallPressure * 0.22;
      }
      // If forward lane is blocked, discourage forcing through defenders — UNLESS stalled or chasing late!
      if (laneSafety < 0.45) {
        const blockCaution = Math.max(
          0.18,
          0.9 +
            atkDoctrine.buildUpPatience * 0.85 -
            urgency * 0.85 -
            stallPressure * 0.45 +
            protect * 0.45,
        );
        utility -= (0.45 - laneSafety) * blockCaution;
      }
      if (protect > 0.25 && laneSafety < 0.55) {
        utility -= protect * 0.36;
      }
    } else {
      // Back-pass / lateral recycling: natural for 2~3 buildup passes in possession, discouraged in direct/counter, then penalized by Stall Decay & Urgency!
      const patienceBonus =
        state.stallPassCount >= stallPassThreshold
          ? Math.min(0, (atkDoctrine.buildUpPatience - 0.48) * 1.1)
          : (atkDoctrine.buildUpPatience - 0.46) * 1.38;
      utility += patienceBonus;
      if (underHeavyPress && stallPressure < 0.65) utility += 0.24;
      if (mate.profile.dropToLinkBias > 0.65 && state.stallPassCount < stallPassThreshold) utility += 0.14;
      if (state.recycleCount >= stallPassThreshold) utility -= 0.34;
      // Progressive Stall Decay: breaks infinite own-half/midfield recycling!
      utility -= stallPressure * 1.15;
      // Step-by-step recycling preference: keep short 5~14m 2nd-line recycling natural, discourage deeper retreats
      if (inBoxZone && backwardDist > 0.06) {
        utility -= (backwardDist - 0.06) * 2.6;
      } else if (inFinalThird && backwardDist > 0.14) {
        utility -= (backwardDist - 0.14) * 1.6;
      }
      // Period-closing / trailing urgency: stop recycling!
      utility -= urgency * 1.05;
      // Late leading protection: safe retention rewarded outside box (unless heavily stalled)
      if (protect > 0.25 && !inBoxZone && laneSafety > 0.62 && state.stallPassCount < 4) {
        utility += protect * 0.26;
      }
    }

    // Diagonal switch bonus for wingplay / wing_bomber / deep_playmaker / ball_playing_cb + breaking stalls!
    if (isSwitch) {
      utility +=
        carrier.profile.longSwitchBias * 0.36 +
        atkDoctrine.flankBias * 0.32 +
        (state.recycleCount >= 1 ? 0.18 : 0) +
        stallPressure * 0.58;
    }

    // Flank vs Central preference
    if (Math.abs(mate.y - 0.5) > 0.28) {
      utility += (atkDoctrine.flankBias - 0.5) * 0.36;
    } else {
      utility += (atkDoctrine.centralBias - 0.5) * 0.32;
    }

    // Small deterministic jitter for natural variety
    utility += (nextSimRng(state) - 0.5) * 0.14;

    options.push({
      idx: i,
      score: utility,
      flightType,
      destX,
      destY,
      isRecycle,
      isSwitch,
      isBoxCross,
      forwardDelta,
      deltaXT,
      laneSafety,
    });
  }

  // Safe fallback if hard backpass filter left no options:
  // inside box -> force immediate cutback/shot/clearance; in final third -> drive diagonally toward box!
  if (options.length === 0) {
    if (inBoxZone) {
      triggerOpenPlayBoxAction(state, carrier, isHome);
      return;
    }
    if (inFinalThird) {
      carrier.targetX = clamp(carrier.x + dir * 0.045, 0.08, 0.92);
      carrier.targetY = clamp(lerp(carrier.y, 0.5, 0.42), 0.14, 0.86);
      state.carrierHoldTimer = 0;
      state.carrierDecisionDelay = 0.28;
      state.stats.dribbles += 1;
      return;
    }
    let bestMateIdx = -1;
    let bestMateDist = 999;
    for (let i = 1; i < teammates.length; i += 1) {
      if (i === carrierIdx) continue;
      const d = Math.hypot(teammates[i].x - carrier.x, teammates[i].y - carrier.y);
      if (d < bestMateDist) {
        bestMateDist = d;
        bestMateIdx = i;
      }
    }
    if (bestMateIdx >= 0) {
      const m = teammates[bestMateIdx];
      const fbForward = (m.x - carrier.x) * dir;
      const fbDeltaXT = sampleExpectedThreat(isHome, m.x, m.y) - originXT;
      options.push({
        idx: bestMateIdx,
        score: 0.1,
        flightType: 'ground_pass',
        destX: m.x,
        destY: m.y,
        isRecycle: fbForward <= 0.025,
        isSwitch: false,
        isBoxCross: false,
        forwardDelta: fbForward,
        deltaXT: fbDeltaXT,
        laneSafety: 0.65,
      });
    }
  }

  options.sort((a, b) => b.score - a.score);

  // If all forward lanes are tight & team has patience (and is NOT stalled or chasing late!), favor safe recycling
  let chosen = options[0];
  if (
    chosen &&
    !chosen.isRecycle &&
    !inBoxZone &&
    urgency < 0.35 &&
    stallPressure < 0.45 &&
    state.stallPassCount < 3 &&
    maxForwardSafety < 0.44 &&
    atkDoctrine.buildUpPatience > 0.55 &&
    state.recycleCount < 3
  ) {
    const safeRecycle = options.find((o) => (o.isRecycle || o.isSwitch) && o.laneSafety > 0.58);
    if (safeRecycle) {
      chosen = safeRecycle;
    }
  }

  if (!chosen) return;

  if (urgency >= 0.35 && (chosen.forwardDelta > 0.03 || chosen.isBoxCross || chosen.deltaXT >= 0.008)) {
    state.stats.lateUrgentForwardPasses += 1;
  }

  // Update stall progression, pressing triggers, recycling counter & tactical phase badge
  const isMeaningfulProgression =
    chosen.isBoxCross || chosen.deltaXT >= 0.008 || chosen.forwardDelta >= 0.08;

  if (isMeaningfulProgression) {
    state.stallPassCount = 0;
    state.possessionStallTime = 0;
    if (chosen.deltaXT > 0.002) {
      state.stats.positiveXtPasses += 1;
    }
  } else if (chosen.isSwitch) {
    state.stallPassCount = Math.max(0, state.stallPassCount - 1);
    state.possessionStallTime *= 0.5;
  } else {
    state.stallPassCount += 1;
    if (state.stallPassCount > state.stats.maxConsecutiveStallPasses) {
      state.stats.maxConsecutiveStallPasses = state.stallPassCount;
    }
    const isBackPass = chosen.forwardDelta < -0.02;
    const isTouchlineTrap = Math.abs(chosen.destY - 0.5) > 0.34;
    if (isBackPass || isTouchlineTrap || state.stallPassCount >= 2) {
      if (state.pressTriggerTimer <= 0.15) {
        state.stats.pressingTriggersFired += 1;
      }
      state.pressTriggerTimer = Math.max(
        state.pressTriggerTimer,
        state.stallPassCount >= 3 ? 2.8 : 2.1,
      );
    }
  }

  if (chosen.isBoxCross) {
    state.recycleCount = 0;
    state.tacticalLabel = '측면 전환';
  } else if (chosen.isSwitch) {
    state.stats.switches += 1;
    state.recycleCount = Math.max(0, state.recycleCount - 1);
    state.tacticalLabel = '측면 전환';
  } else if (chosen.isRecycle) {
    state.recycleCount += 1;
    state.stats.recycles += 1;
    state.tacticalLabel = carrierDepth < 0.38 ? '후방 빌드업' : '볼 순환';
  } else {
    if (isMeaningfulProgression) {
      state.recycleCount = 0;
    }
    if (state.transitionTimer > 0 && state.transitionTeamIsHome === isHome) {
      state.tacticalLabel = '역습 전환';
    } else if (chosen.flightType === 'through_ball') {
      state.tacticalLabel = '하프스페이스 침투';
    } else if (carrierDepth < 0.40) {
      state.tacticalLabel = '후방 빌드업';
    } else {
      state.tacticalLabel = Math.abs(chosen.destY - 0.5) > 0.30 ? '측면 전환' : '볼 순환';
    }
  }
  state.tacticalLabelTeamIsHome = isHome;

  // Check if a low-safety forced pass gets intercepted mid-flight (calibrated by targetHomePossession!)
  const targetPoss = isHome ? state.targetHomePossession / 100 : 1 - state.targetHomePossession / 100;
  const possBias = clamp((0.55 - targetPoss) * 0.25, -0.08, 0.10);
  const interceptProb = clamp(
    (1 - chosen.laneSafety) * 0.34 -
      pasNorm * 0.08 -
      atkDoctrine.composure * 0.07 +
      defDoctrine.lineDiscipline * 0.06 +
      possBias,
    0.01,
    0.42,
  );

  let passDestX = chosen.destX;
  let passDestY = chosen.destY;
  let targetTeamIsHome: boolean = isHome;
  let targetIdx: number = chosen.idx;

  if (nextSimRng(state) < interceptProb && !state.director) {
    // Nearest defender to pass segment steps in to intercept cleanly along the pass line
    let bestDef: PlayerAgentState | null = null;
    let bestDist = 999;
    let bestProj = 0.5;
    for (let d = 1; d < defenders.length; d += 1) {
      const { dist, proj } = pointToSegmentDistance(
        defenders[d].x,
        defenders[d].y,
        carrier.x,
        carrier.y,
        chosen.destX,
        chosen.destY,
      );
      if (proj > 0.15 && proj < 0.90 && dist < bestDist) {
        bestDist = dist;
        bestDef = defenders[d];
        bestProj = proj;
      }
    }
    if (bestDef && bestDist < 0.22) {
      const segX = lerp(carrier.x, chosen.destX, bestProj);
      const segY = lerp(carrier.y, chosen.destY, bestProj);
      passDestX = lerp(segX, bestDef.x, 0.25);
      passDestY = lerp(segY, bestDef.y, 0.25);
      targetTeamIsHome = !isHome;
      targetIdx = bestDef.slotIndex;
      state.stats.interceptions += 1;
    }
  }

  state.stats.passesAttempted += 1;
  launchBallFlight({
    state,
    flightType: chosen.flightType,
    fromX: carrier.x,
    fromY: carrier.y,
    toX: passDestX,
    toY: passDestY,
    ctrlX: chosen.isSwitch ? (carrier.x + passDestX) * 0.5 + dir * 0.04 : undefined,
    ctrlY: chosen.isSwitch ? 0.5 : undefined,
    targetTeamIsHome,
    targetIdx,
    passerIsHome: isHome,
    passerIdx: carrierIdx,
    arcColor:
      chosen.flightType === 'long_switch'
        ? '#38bdf8'
        : chosen.flightType === 'through_ball'
          ? '#34d399'
          : undefined,
  });
}

/**
 * Stages all 22 players cleanly into realistic formation for a set-piece whistle cut
 * (Penalty Kick, Corner Kick, or Direct Free Kick) and locks the single ball on the spot.
 */
function stageSetPieceFormation(
  state: PitchSimState,
  dirCue: DirectorCueState,
  spot: SimVec2,
) {
  const isH = dirCue.isHomeAttack;
  const fl = dirCue.flankSide;
  const atkAgents = isH ? state.homeAgents : state.awayAgents;
  const defAgents = isH ? state.awayAgents : state.homeAgents;
  const scorer = atkAgents[dirCue.scorerIdx];
  const assister = atkAgents[dirCue.assisterIdx];
  const atkHeading = isH ? 0 : Math.PI;
  const defHeading = isH ? Math.PI : 0;

  // Lock the single ball cleanly at the set-piece spot (wipes trail & interpolation buffer!)
  state.possessionIsHome = isH;
  resetBallToSpot(state, spot.x, spot.y, null, null);
  dirCue.staged = true;

  // Attacking GK stays back in own box
  placeAgentForSetPiece(atkAgents[0], atkX(isH, 0.08), 0.50, atkHeading);

  if (dirCue.pattern === 'penalty_kick') {
    // Kicker at run-up behind penalty spot, GK on goal line, all other 19 outfielders outside penalty box & arc
    placeAgentForSetPiece(scorer, atkX(isH, 0.838), 0.50, atkHeading);
    placeAgentForSetPiece(defAgents[0], atkX(isH, 0.962), 0.50, defHeading);

    const atkArcYs = [0.22, 0.28, 0.34, 0.40, 0.60, 0.66, 0.72, 0.78, 0.50];
    let atkSlot = 0;
    for (let k = 1; k < 11; k += 1) {
      if (k === scorer.slotIndex) continue;
      const ay = atkArcYs[atkSlot % atkArcYs.length];
      const ax = atkSlot === 8 ? atkX(isH, 0.72) : atkX(isH, 0.775 - (atkSlot % 2) * 0.018);
      placeAgentForSetPiece(atkAgents[k], ax, ay, atkHeading);
      atkSlot += 1;
    }

    const defArcYs = [0.20, 0.26, 0.32, 0.38, 0.44, 0.56, 0.62, 0.68, 0.74, 0.80];
    for (let k = 1; k < 11; k += 1) {
      const dy = defArcYs[(k - 1) % defArcYs.length];
      // Outside the penalty box (box starts at 0.845) and outside the D-arc (arc edge ~0.79)
      const dx = Math.abs(dy - 0.5) < 0.14 ? atkX(isH, 0.765) : atkX(isH, 0.805);
      placeAgentForSetPiece(defAgents[k], dx, dy, defHeading);
    }
    return;
  }

  if (dirCue.pattern === 'corner_kick') {
    // Corner taker right at the corner flag; attackers & defenders packed in penalty box!
    const takerY = fl < 0 ? 0.025 : 0.975;
    placeAgentForSetPiece(assister, atkX(isH, 0.985), takerY, Math.atan2(0.5 - takerY, atkX(isH, 0.88) - spot.x));
    placeAgentForSetPiece(defAgents[0], atkX(isH, 0.962), 0.50 + fl * 0.03, defHeading);
    // Scorer starts slightly off target spot to make an explosive attacking run onto the cross
    placeAgentForSetPiece(
      scorer,
      atkX(isH, 0.845),
      clamp(dirCue.targetY - fl * 0.07, 0.28, 0.72),
      atkHeading,
    );

    const boxAtkSpots: SimVec2[] = [
      { x: atkX(isH, 0.915), y: 0.42 },
      { x: atkX(isH, 0.915), y: 0.58 },
      { x: atkX(isH, 0.875), y: 0.36 },
      { x: atkX(isH, 0.875), y: 0.64 },
      { x: atkX(isH, 0.795), y: 0.44 },
      { x: atkX(isH, 0.795), y: 0.56 },
      { x: atkX(isH, 0.60), y: 0.40 },
      { x: atkX(isH, 0.58), y: 0.60 },
    ];
    let aPtr = 0;
    for (let k = 1; k < 11; k += 1) {
      if (k === assister.slotIndex || k === scorer.slotIndex) continue;
      const p = boxAtkSpots[aPtr % boxAtkSpots.length];
      placeAgentForSetPiece(atkAgents[k], p.x, p.y, atkHeading);
      aPtr += 1;
    }

    const boxDefSpots: SimVec2[] = [
      { x: atkX(isH, 0.945), y: 0.44 },
      { x: atkX(isH, 0.945), y: 0.56 },
      { x: atkX(isH, 0.905), y: 0.38 },
      { x: atkX(isH, 0.905), y: 0.50 },
      { x: atkX(isH, 0.905), y: 0.62 },
      { x: atkX(isH, 0.865), y: 0.34 },
      { x: atkX(isH, 0.865), y: 0.66 },
      { x: atkX(isH, 0.825), y: 0.48 },
      { x: atkX(isH, 0.72), y: 0.38 },
      { x: atkX(isH, 0.68), y: 0.62 },
    ];
    for (let k = 1; k < 11; k += 1) {
      const p = boxDefSpots[(k - 1) % boxDefSpots.length];
      placeAgentForSetPiece(defAgents[k], p.x, p.y, defHeading);
    }
    return;
  }

  // Direct Free Kick: foul spot in attacking third, 4-man wall, GK offset to far post, box runners ready
  placeAgentForSetPiece(scorer, atkX(isH, 0.708), spot.y, atkHeading);
  placeAgentForSetPiece(
    defAgents[0],
    atkX(isH, 0.960),
    fl < 0 ? 0.54 : 0.46,
    defHeading,
  );

  // 4-man defensive wall (slots 4..7)
  const wallX = atkX(isH, 0.835);
  const wallY = lerp(spot.y, 0.5, 0.36);
  const wallIds = new Set([4, 5, 6, 7]);
  [4, 5, 6, 7].forEach((wIdx, idx) => {
    placeAgentForSetPiece(defAgents[wIdx], wallX, wallY + (idx - 1.5) * 0.03, defHeading);
  });

  const defEdgeSpots: SimVec2[] = [
    { x: atkX(isH, 0.865), y: 0.32 },
    { x: atkX(isH, 0.865), y: 0.45 },
    { x: atkX(isH, 0.865), y: 0.58 },
    { x: atkX(isH, 0.865), y: 0.68 },
    { x: atkX(isH, 0.78), y: fl < 0 ? 0.68 : 0.32 },
    { x: atkX(isH, 0.72), y: 0.50 },
  ];
  let dPtr = 0;
  for (let k = 1; k < 11; k += 1) {
    if (wallIds.has(k)) continue;
    const p = defEdgeSpots[dPtr % defEdgeSpots.length];
    placeAgentForSetPiece(defAgents[k], p.x, p.y, defHeading);
    dPtr += 1;
  }

  const atkEdgeSpots: SimVec2[] = [
    { x: atkX(isH, 0.845), y: 0.34 },
    { x: atkX(isH, 0.845), y: 0.48 },
    { x: atkX(isH, 0.845), y: 0.62 },
    { x: atkX(isH, 0.81), y: 0.25 },
    { x: atkX(isH, 0.81), y: 0.75 },
    { x: atkX(isH, 0.72), y: fl < 0 ? 0.24 : 0.76 },
    { x: atkX(isH, 0.64), y: 0.42 },
    { x: atkX(isH, 0.58), y: 0.58 },
    { x: atkX(isH, 0.52), y: 0.48 },
  ];
  let aPtr = 0;
  for (let k = 1; k < 11; k += 1) {
    if (k === scorer.slotIndex) continue;
    const p = atkEdgeSpots[aPtr % atkEdgeSpots.length];
    placeAgentForSetPiece(atkAgents[k], p.x, p.y, atkHeading);
    aPtr += 1;
  }
}

/**
 * Initiates a DirectorCueState cleanly ahead of an upcoming matchEngine highlight event.
 * Set-pieces transition cleanly into whistle-staged formations; open play & counters
 * genuinely advance into realistic shooting range before any shot can fire!
 */
function activateDirectorCue(
  state: PitchSimState,
  entry: { key: string; event: MatchEvent },
) {
  const ev = entry.event;
  const isHomeAttack =
    ev.type === 'save'
      ? ev.teamId !== state.homeTeamId
      : ev.teamId === state.homeTeamId;
  const seedNum =
    ev.minute * 31 + (isHomeAttack ? 7 : 19) + ev.description.length;

  const pattern: HighlightPatternId =
    ev.highlightPattern ?? ALL_PATTERNS[seedNum % ALL_PATTERNS.length];
  const attackRoute = resolveRouteForEvent(ev);

  let outcome: HighlightOutcomeType;
  if (ev.highlightOutcome) outcome = ev.highlightOutcome;
  else if (ev.type === 'var_offside') outcome = 'var_offside';
  else if (ev.type === 'goal') outcome = 'goal';
  else if (ev.type === 'save') outcome = 'save';
  else {
    const r = seedNum % 3;
    outcome = r === 0 ? 'woodwork' : r === 1 ? 'blocked' : 'near_miss';
  }

  const atkAgents = isHomeAttack ? state.homeAgents : state.awayAgents;
  const defAgents = isHomeAttack ? state.awayAgents : state.homeAgents;

  // On `save` events, matchEngine stores defending GK's id in `scorerId` and attacker's name in `scorerName`!
  const scorerIdx = findAgentSlotByIdentity(
    atkAgents,
    ev.type === 'save' ? undefined : ev.scorerId,
    ev.scorerName,
    [8, 9, 10],
    nextSimRng(state),
    true,
  );
  let assisterIdx = findAgentSlotByIdentity(
    atkAgents,
    ev.assistId,
    ev.assistName,
    [5, 6, 7, 8],
    nextSimRng(state),
    true,
  );
  if (assisterIdx === scorerIdx) {
    assisterIdx = scorerIdx === 9 ? 7 : 6;
  }
  const defenderIdx = findAgentSlotByIdentity(
    defAgents,
    undefined,
    ev.contestDefenderName,
    [2, 3],
    nextSimRng(state),
    true,
  );

  // Choose flank side coherently with current ball Y so movement is natural
  const flankSide: 1 | -1 = state.ball.y < 0.5 ? -1 : 1;
  const shotAngle: ShotAngleType =
    ev.shotAngle ??
    (pattern === 'cut_inside_curler'
      ? 'far_post'
      : flankSide < 0
        ? 'acute_left'
        : 'acute_right');
  const pkDirection: 'left' | 'center' | 'right' =
    ev.pkDirection ??
    (seedNum % 3 === 0 ? 'left' : seedNum % 3 === 1 ? 'right' : 'center');
  const reboundOrigin: 'save' | 'woodwork' | 'blocked' =
    ev.reboundOrigin ??
    (seedNum % 3 === 0 ? 'save' : seedNum % 3 === 1 ? 'woodwork' : 'blocked');

  let targetY = 0.5;
  if (outcome === 'woodwork') {
    targetY = flankSide < 0 ? 0.405 : 0.595;
  } else if (pattern === 'penalty_kick') {
    targetY =
      pkDirection === 'left' ? 0.422 : pkDirection === 'right' ? 0.578 : 0.5;
  } else if (shotAngle === 'far_post') {
    targetY = flankSide < 0 ? 0.575 : 0.425;
  } else if (shotAngle === 'near_post') {
    targetY = flankSide < 0 ? 0.43 : 0.57;
  } else if (shotAngle === 'acute_left') {
    targetY = 0.44 + (seedNum % 3) * 0.014;
  } else if (shotAngle === 'acute_right') {
    targetY = 0.56 - (seedNum % 3) * 0.014;
  } else {
    targetY = 0.45 + ((seedNum % 5) / 4) * 0.1;
  }

  const isSetPiece =
    pattern === 'corner_kick' ||
    pattern === 'direct_free_kick' ||
    pattern === 'penalty_kick';

  let setPieceSpot: SimVec2 | null = null;
  if (pattern === 'penalty_kick') {
    setPieceSpot = { x: atkX(isHomeAttack, 0.885), y: 0.50 };
  } else if (pattern === 'corner_kick') {
    setPieceSpot = {
      x: atkX(isHomeAttack, 0.982),
      y: flankSide < 0 ? 0.036 : 0.964,
    };
  } else if (pattern === 'direct_free_kick') {
    setPieceSpot = {
      x: atkX(isHomeAttack, 0.745),
      y: flankSide < 0 ? 0.36 : 0.64,
    };
  }

  const minShotDepth = getMinShotDepthForCue(pattern, attackRoute);
  const scrambleRoll = nextSimRng(state);
  let scrambleMode: DirectorScrambleMode = 'none';
  if (pattern === 'rebound_finish') {
    scrambleMode =
      reboundOrigin === 'blocked' || scrambleRoll < 0.55
        ? 'goalmouth_scramble'
        : 'rebound';
  } else if (
    pattern === 'corner_kick' &&
    outcome !== 'var_offside' &&
    scrambleRoll < 0.36
  ) {
    scrambleMode = 'goalmouth_scramble';
  } else if (
    (pattern === 'cutback_finish' ||
      pattern === 'wing_cross_header' ||
      attackRoute === 'tiki_taka_triangle') &&
    outcome !== 'var_offside' &&
    scrambleRoll < 0.45
  ) {
    scrambleMode = 'tap_in';
  }
  const scrambleDuration =
    scrambleMode === 'goalmouth_scramble'
      ? 0.44 + nextSimRng(state) * 0.12
      : scrambleMode === 'rebound'
        ? 0.34 + nextSimRng(state) * 0.10
        : 0;

  state.thirdMan = null;
  state.handledEventKeys.add(entry.key);

  const cue: DirectorCueState = {
    key: entry.key,
    event: ev,
    isHomeAttack,
    pattern,
    attackRoute,
    outcome,
    scorerIdx,
    assisterIdx,
    defenderIdx,
    flankSide,
    shotAngle,
    pkDirection,
    reboundOrigin,
    targetY,
    stage: isSetPiece ? 'set_piece_setup' : 'approach',
    stageTimer: 0,
    stageDuration: isSetPiece ? 0.88 : 0.95,
    shotOrigin: setPieceSpot ?? { x: atkX(isHomeAttack, 0.84), y: targetY },
    shotControl: { x: atkX(isHomeAttack, 0.90), y: targetY },
    shotEnd: { x: atkX(isHomeAttack, 0.985), y: targetY },
    revealed: false,
    varOffsideLineX: atkX(isHomeAttack, 0.83),
    routeSubStep: 0,
    reboundTriggered: false,
    scrambleMode,
    scrambleTimer: 0,
    scrambleDuration,
    setPieceSpot,
    minShotDepth,
    staged: false,
  };

  state.director = cue;

  // Immediately stage whistle set-pieces so broadcast text & 2D pitch align 100%!
  if (isSetPiece && setPieceSpot) {
    stageSetPieceFormation(state, cue, setPieceSpot);
  }

  state.tacticalLabel = isSetPiece
    ? '세트피스'
    : scrambleMode === 'goalmouth_scramble'
      ? '문전 혼전'
      : scrambleMode === 'rebound'
        ? '세컨찬스'
        : attackRoute === 'low_block_counter' || attackRoute === 'gegenpress_steal'
          ? '역습 전환'
          : attackRoute === 'tiki_taka_triangle'
            ? '삼자 연계'
            : attackRoute === 'u_buildup_switch' || attackRoute === 'early_cross'
              ? '측면 전환'
              : '하프스페이스 침투';
  state.tacticalLabelTeamIsHome = isHomeAttack;
}

/**
 * Steps the Director state machine seamlessly alongside Steering physics & ball flight.
 * Enforces authentic set-piece staging, genuine counterattack runs, and strict shooting range!
 */
function stepDirectorCue(state: PitchSimState, dt: number) {
  const dirCue = state.director;
  if (!dirCue) return;

  dirCue.stageTimer += dt;
  const isH = dirCue.isHomeAttack;
  const fl = dirCue.flankSide;
  const atkAgents = isH ? state.homeAgents : state.awayAgents;
  const defAgents = isH ? state.awayAgents : state.homeAgents;
  const atkDoctrine = isH ? state.homeDoctrine : state.awayDoctrine;
  const defDoctrine = isH ? state.awayDoctrine : state.homeDoctrine;
  const scorer = atkAgents[dirCue.scorerIdx];
  const assister = atkAgents[dirCue.assisterIdx];
  const defender = defAgents[dirCue.defenderIdx];
  const defGk = defAgents[0];

  const flankY = fl < 0 ? 0.12 : 0.88;
  const halfSpaceY = fl < 0 ? 0.28 : 0.72;

  // Route-specific realistic launch & finishing targets (ALL finishing spots strictly inside minShotDepth!)
  let passerDest: SimVec2 = { x: atkX(isH, 0.66), y: halfSpaceY };
  let scorerDest: SimVec2 = { x: atkX(isH, 0.84), y: dirCue.targetY };
  let passFlightType: BallFlightType = 'through_ball';
  let passerMinLaunchDepth = 0.52;

  if (dirCue.pattern === 'corner_kick') {
    passerDest = dirCue.setPieceSpot ?? { x: atkX(isH, 0.982), y: fl < 0 ? 0.036 : 0.964 };
    scorerDest =
      dirCue.scrambleMode === 'goalmouth_scramble'
        ? { x: atkX(isH, 0.935), y: clamp(0.5 + fl * 0.04, 0.43, 0.57) }
        : { x: atkX(isH, 0.915), y: dirCue.targetY };
    passFlightType = 'cross';
    passerMinLaunchDepth = 0.95;
  } else if (dirCue.pattern === 'direct_free_kick') {
    passerDest = dirCue.setPieceSpot ?? { x: atkX(isH, 0.745), y: fl < 0 ? 0.36 : 0.64 };
    scorerDest = passerDest;
  } else if (dirCue.pattern === 'penalty_kick') {
    passerDest = dirCue.setPieceSpot ?? { x: atkX(isH, 0.885), y: 0.50 };
    scorerDest = passerDest;
  } else if (dirCue.pattern === 'rebound_finish') {
    passerDest = { x: atkX(isH, 0.79), y: halfSpaceY };
    // True 6-yard box poacher / scramble finish right in front of goal!
    scorerDest = {
      x: atkX(isH, dirCue.scrambleMode === 'goalmouth_scramble' ? 0.942 : 0.922),
      y: clamp(0.50 - fl * 0.045, 0.42, 0.58),
    };
    passFlightType = 'shot';
  } else if (dirCue.attackRoute === 'early_cross') {
    passerDest = { x: atkX(isH, 0.82), y: flankY };
    scorerDest =
      dirCue.scrambleMode === 'tap_in'
        ? { x: atkX(isH, 0.935), y: clamp(0.50 - fl * 0.04, 0.43, 0.57) }
        : { x: atkX(isH, 0.905), y: dirCue.targetY };
    passFlightType = 'cross';
    passerMinLaunchDepth = 0.68;
  } else if (dirCue.attackRoute === 'cutback') {
    passerDest =
      dirCue.scrambleMode === 'tap_in'
        ? { x: atkX(isH, 0.955), y: fl < 0 ? 0.21 : 0.79 }
        : { x: atkX(isH, 0.938), y: fl < 0 ? 0.17 : 0.83 };
    scorerDest =
      dirCue.scrambleMode === 'tap_in'
        ? { x: atkX(isH, 0.932), y: 0.50 + fl * 0.03 }
        : { x: atkX(isH, 0.885), y: 0.50 + fl * 0.04 };
    passFlightType = 'ground_pass';
    passerMinLaunchDepth = 0.82;
  } else if (dirCue.attackRoute === 'solo_dribble') {
    passerDest = { x: atkX(isH, 0.58), y: halfSpaceY };
    scorerDest = { x: atkX(isH, 0.875), y: fl < 0 ? 0.43 : 0.57 };
    passFlightType = 'ground_pass';
  } else if (dirCue.attackRoute === 'cut_inside_curler') {
    passerDest = { x: atkX(isH, 0.66), y: flankY };
    scorerDest = { x: atkX(isH, 0.805), y: halfSpaceY };
    passFlightType = 'ground_pass';
    passerMinLaunchDepth = 0.58;
  } else if (dirCue.attackRoute === 'long_range_cannon') {
    passerDest = { x: atkX(isH, 0.77), y: halfSpaceY };
    scorerDest = { x: atkX(isH, 0.73), y: 0.50 + fl * 0.06 };
    passFlightType = 'ground_pass';
    passerMinLaunchDepth = 0.60;
  } else if (dirCue.attackRoute === 'u_buildup_switch') {
    passerDest = { x: atkX(isH, 0.56), y: fl < 0 ? 0.72 : 0.28 };
    scorerDest = { x: atkX(isH, 0.845), y: fl < 0 ? 0.26 : 0.74 };
    passFlightType = 'long_switch';
    passerMinLaunchDepth = 0.48;
  } else if (dirCue.attackRoute === 'low_block_counter') {
    // Authentic counter: win/launch from own half or halfway -> sprint into box before finishing!
    passerDest = { x: atkX(isH, 0.46), y: 0.50 };
    scorerDest = { x: atkX(isH, 0.865), y: dirCue.targetY };
    passFlightType = 'through_ball';
    passerMinLaunchDepth = 0.34;
  } else if (dirCue.attackRoute === 'gegenpress_steal') {
    passerDest = { x: atkX(isH, 0.62), y: halfSpaceY };
    scorerDest = { x: atkX(isH, 0.87), y: dirCue.targetY };
    passFlightType = 'through_ball';
    passerMinLaunchDepth = 0.52;
  } else if (dirCue.attackRoute === 'tiki_taka_triangle') {
    passerDest = { x: atkX(isH, 0.76), y: halfSpaceY };
    scorerDest =
      dirCue.scrambleMode === 'tap_in'
        ? { x: atkX(isH, 0.928), y: 0.50 + fl * 0.03 }
        : { x: atkX(isH, 0.875), y: 0.50 + fl * 0.03 };
    passFlightType = 'through_ball';
    passerMinLaunchDepth = 0.62;
  } else {
    passerDest = { x: atkX(isH, 0.65), y: 0.50 + fl * 0.08 };
    scorerDest = { x: atkX(isH, 0.875), y: dirCue.targetY };
    passFlightType = 'through_ball';
    passerMinLaunchDepth = 0.54;
  }

  // ── STAGE 1A: SET-PIECE SETUP (Ball locked cleanly on spot, zero tug-of-war!) ──
  if (dirCue.stage === 'set_piece_setup') {
    const spot = dirCue.setPieceSpot ?? passerDest;
    state.possessionIsHome = isH;
    // Keep ball strictly locked on the set-piece spot (ownerIdx = null prevents stepBallPhysics pulling it!)
    resetBallToSpot(state, spot.x, spot.y, null, null);

    if (dirCue.pattern === 'corner_kick') {
      // Subtle pre-kick jostling inside box while taker stands ready at corner flag
      applyAgentSteering({
        agent: scorer,
        targetX: atkX(isH, 0.855),
        targetY: clamp(dirCue.targetY - fl * 0.04, 0.28, 0.72),
        sprintDemand: 0.45,
        teammates: atkAgents,
        doctrine: atkDoctrine,
        dt,
      });
    } else if (dirCue.pattern === 'penalty_kick') {
      // GK bounces subtly on goal line; kicker poised at run-up
      applyAgentSteering({
        agent: defGk,
        targetX: atkX(isH, 0.962),
        targetY: 0.5 + Math.sin(dirCue.stageTimer * 7) * 0.014,
        sprintDemand: 0.4,
        teammates: defAgents,
        doctrine: defDoctrine,
        dt,
        skipSeparation: true,
      });
    }

    if (dirCue.stageTimer >= dirCue.stageDuration) {
      dirCue.stage = 'execute_route';
      dirCue.stageTimer = 0;
      dirCue.stageDuration =
        dirCue.pattern === 'penalty_kick' || dirCue.pattern === 'direct_free_kick'
          ? 0.52
          : 1.05;
      dirCue.routeSubStep = 0;
    }
    return;
  }

  // ── STAGE 1B: OPEN-PLAY / COUNTER APPROACH ──
  if (dirCue.stage === 'approach') {
    const receiverIdx =
      dirCue.attackRoute === 'solo_dribble' ? dirCue.scorerIdx : dirCue.assisterIdx;
    const receiver = atkAgents[receiverIdx];
    const receiverTarget =
      dirCue.attackRoute === 'solo_dribble'
        ? { x: atkX(isH, 0.64), y: halfSpaceY }
        : passerDest;

    if (dirCue.routeSubStep === 0) {
      dirCue.routeSubStep = 1;
      state.possessionIsHome = isH;
      const fromX = state.ball.x;
      const fromY = state.ball.y;
      launchBallFlight({
        state,
        flightType: 'ground_pass',
        fromX,
        fromY,
        toX: lerp(receiver.x, receiverTarget.x, 0.42),
        toY: lerp(receiver.y, receiverTarget.y, 0.42),
        targetTeamIsHome: isH,
        targetIdx: receiverIdx,
        passerIsHome: isH,
        passerIdx: state.ball.ownerIdx ?? 5,
        speedOverride: 0.52,
      });
    }

    applyAgentSteering({
      agent: assister,
      targetX: passerDest.x,
      targetY: passerDest.y,
      sprintDemand: 1.0,
      teammates: atkAgents,
      doctrine: atkDoctrine,
      dt,
      speedBoost: 1.75,
    });
    applyAgentSteering({
      agent: scorer,
      targetX: lerp(scorer.x, scorerDest.x, 0.65),
      targetY: lerp(scorer.y, scorerDest.y, 0.65),
      sprintDemand: 1.0,
      teammates: atkAgents,
      doctrine: atkDoctrine,
      dt,
      speedBoost: 1.75,
    });

    const receivedByActor =
      state.ball.ownerTeamIsHome === isH && state.ball.ownerIdx === receiverIdx;
    if (receivedByActor || dirCue.stageTimer >= dirCue.stageDuration) {
      // Ensure the actor genuinely holds the ball when entering execute_route
      if (!receivedByActor && state.ball.flightProgress >= 0.95) {
        state.ball.ownerTeamIsHome = isH;
        state.ball.ownerIdx = receiverIdx;
        state.ball.flightType = 'carry';
      }
      dirCue.stage = 'execute_route';
      dirCue.stageTimer = 0;
      dirCue.stageDuration =
        dirCue.attackRoute === 'solo_dribble'
          ? 2.2
          : dirCue.pattern === 'rebound_finish'
            ? 2.4
            : dirCue.attackRoute === 'low_block_counter'
              ? 2.4
              : 2.0;
      dirCue.routeSubStep = 0;
    }
    return;
  }

  // ── STAGE 2: EXECUTE ROUTE (NEVER SHOOTS OUTSIDE REALISTIC SHOOTING RANGE!) ──
  if (dirCue.stage === 'execute_route') {
    // 1) Direct FK & PK: crisp run-up straight to exact setPieceSpot, then shoot from spot!
    if (dirCue.pattern === 'penalty_kick' || dirCue.pattern === 'direct_free_kick') {
      const spot = dirCue.setPieceSpot ?? scorerDest;
      // Keep ball locked on the spot until foot strikes it!
      resetBallToSpot(state, spot.x, spot.y, null, null);
      applyAgentSteering({
        agent: scorer,
        targetX: spot.x,
        targetY: spot.y,
        sprintDemand: 0.95,
        teammates: atkAgents,
        doctrine: atkDoctrine,
        dt,
        skipSeparation: true,
        speedBoost: 1.45,
      });
      const distToSpot = Math.hypot(scorer.x - spot.x, scorer.y - spot.y);
      if (distToSpot < 0.022 || dirCue.stageTimer >= dirCue.stageDuration) {
        triggerDirectorShot(state, dirCue, scorer);
      }
      return;
    }

    // 2) Corner Kick: cross from EXACT corner flag into penalty box -> header/volley OR 6-yard goalmouth scramble!
    if (dirCue.pattern === 'corner_kick') {
      const cornerSpot = dirCue.setPieceSpot ?? passerDest;
      if (dirCue.routeSubStep === 0) {
        dirCue.routeSubStep = 1;
        const firstDrop: SimVec2 =
          dirCue.scrambleMode === 'goalmouth_scramble'
            ? { x: atkX(isH, 0.918), y: clamp(0.5 + fl * 0.055, 0.40, 0.60) }
            : scorerDest;
        const ctrl: SimVec2 = {
          x: atkX(isH, 0.93),
          y: lerp(cornerSpot.y, firstDrop.y, 0.42),
        };
        launchBallFlight({
          state,
          flightType: 'cross',
          fromX: cornerSpot.x,
          fromY: cornerSpot.y,
          toX: firstDrop.x,
          toY: firstDrop.y,
          ctrlX: ctrl.x,
          ctrlY: ctrl.y,
          targetTeamIsHome: dirCue.scrambleMode === 'goalmouth_scramble' ? null : isH,
          targetIdx: dirCue.scrambleMode === 'goalmouth_scramble' ? null : scorer.slotIndex,
          passerIsHome: isH,
          passerIdx: assister.slotIndex,
          speedOverride: 0.44,
          maxArcZ: 0.85,
          arcColor: '#bae6fd',
        });
        state.runIndicators.push({
          from: { x: scorer.x, y: scorer.y },
          to: scorerDest,
          color: '#34d399',
          alpha: 0.72,
          isThirdMan: false,
        });
      }

      if (
        dirCue.scrambleMode === 'goalmouth_scramble' &&
        dirCue.routeSubStep === 1 &&
        state.ball.flightProgress >= 0.94
      ) {
        // First aerial duel knocks the ball loose inside the 6-yard box!
        dirCue.routeSubStep = 2;
        dirCue.scrambleTimer = 0;
        dirCue.reboundTriggered = true;
        state.stats.secondChanceScrambles += 1;
        state.tacticalLabel = '문전 혼전';
        state.tacticalLabelTeamIsHome = isH;
        state.impactRing = {
          x: state.ball.x,
          y: state.ball.y,
          alpha: 0.9,
          color: '#fbbf24',
        };
        launchBallFlight({
          state,
          flightType: 'loose',
          fromX: state.ball.x,
          fromY: state.ball.y,
          toX: scorerDest.x,
          toY: scorerDest.y,
          targetTeamIsHome: isH,
          targetIdx: scorer.slotIndex,
          passerIsHome: !isH,
          passerIdx: defender?.slotIndex ?? 1,
          speedOverride: 0.34,
          maxArcZ: 0.28,
        });
      }

      if (dirCue.scrambleMode === 'goalmouth_scramble' && dirCue.routeSubStep === 2) {
        dirCue.scrambleTimer += dt;
        // 2 attackers + 2 defenders + GK crash the 6-yard loose ball
        const secondAtk = atkAgents.find(
          (a) => a.slotIndex !== 0 && a.slotIndex !== scorer.slotIndex && a.slotIndex !== assister.slotIndex,
        );
        const secondDef = defAgents.find(
          (d) => d.slotIndex !== 0 && d.slotIndex !== defender?.slotIndex,
        );
        if (secondAtk) {
          applyAgentSteering({
            agent: secondAtk,
            targetX: atkX(isH, 0.928),
            targetY: clamp(scorerDest.y + fl * 0.055, 0.38, 0.62),
            sprintDemand: 1.0,
            teammates: atkAgents,
            doctrine: atkDoctrine,
            dt,
            speedBoost: 1.55,
          });
        }
        if (secondDef) {
          applyAgentSteering({
            agent: secondDef,
            targetX: atkX(isH, 0.942),
            targetY: clamp(scorerDest.y - fl * 0.045, 0.38, 0.62),
            sprintDemand: 1.0,
            teammates: defAgents,
            doctrine: defDoctrine,
            dt,
            speedBoost: 1.55,
          });
        }
        applyAgentSteering({
          agent: defGk,
          targetX: atkX(isH, 0.962),
          targetY: clamp(state.ball.y, 0.42, 0.58),
          sprintDemand: 1.0,
          teammates: defAgents,
          doctrine: defDoctrine,
          dt,
          skipSeparation: true,
        });
      }

      applyAgentSteering({
        agent: scorer,
        targetX: scorerDest.x,
        targetY: scorerDest.y,
        sprintDemand: 1.0,
        teammates: atkAgents,
        doctrine: atkDoctrine,
        dt,
        skipSeparation: true,
        speedBoost: 1.75,
      });
      if (defender) {
        applyAgentSteering({
          agent: defender,
          targetX: lerp(defender.x, scorerDest.x + (isH ? 0.015 : -0.015), 0.72),
          targetY: lerp(defender.y, scorerDest.y + fl * 0.025, 0.72),
          sprintDemand: 0.95,
          teammates: defAgents,
          doctrine: defDoctrine,
          dt,
        });
      }

      const crossArrived =
        dirCue.scrambleMode === 'goalmouth_scramble'
          ? dirCue.routeSubStep === 2 &&
            (dirCue.scrambleTimer >= Math.min(0.45, dirCue.scrambleDuration) ||
              (state.ball.ownerTeamIsHome === isH && state.ball.ownerIdx === scorer.slotIndex))
          : (state.ball.ownerTeamIsHome === isH && state.ball.ownerIdx === scorer.slotIndex) ||
            state.ball.flightProgress >= 0.95;
      if (
        (crossArrived && isWithinShootingZone(isH, scorer.x, dirCue.minShotDepth)) ||
        dirCue.stageTimer >= dirCue.stageDuration
      ) {
        triggerDirectorShot(state, dirCue, scorer);
      }
      return;
    }

    // 3) Solo dribble: scorer carries & weaves past defender UNTIL inside shooting range!
    if (dirCue.attackRoute === 'solo_dribble') {
      state.ball.ownerTeamIsHome = isH;
      state.ball.ownerIdx = scorer.slotIndex;
      state.ball.flightType = 'carry';
      const prog = clamp(dirCue.stageTimer / 1.15, 0, 1);
      const zig = Math.sin(prog * Math.PI * 2.5) * 0.05 * fl;
      applyAgentSteering({
        agent: scorer,
        targetX: scorerDest.x,
        targetY: clamp(scorerDest.y + zig, 0.14, 0.86),
        sprintDemand: 1.0,
        teammates: atkAgents,
        doctrine: atkDoctrine,
        dt,
        skipSeparation: true,
        speedBoost: 1.85,
      });
      if (defender) {
        applyAgentSteering({
          agent: defender,
          targetX: scorer.x + (isH ? -0.025 : 0.025),
          targetY: scorer.y + fl * 0.05,
          sprintDemand: 0.82,
          teammates: defAgents,
          doctrine: defDoctrine,
          dt,
        });
      }
      const inRange = isWithinShootingZone(isH, scorer.x, dirCue.minShotDepth);
      const nearDest = Math.hypot(scorer.x - scorerDest.x, scorer.y - scorerDest.y) < 0.055;
      if ((inRange && (nearDest || dirCue.stageTimer >= 0.95)) || dirCue.stageTimer >= dirCue.stageDuration) {
        triggerDirectorShot(state, dirCue, scorer);
      }
      return;
    }

    // 4) Rebound second-chance & Goalmouth Scramble:
    //    Sub-step 0: 1st shooter fires toward goal.
    //    Sub-step 1: 1st shot hits GK parry / post / defender block.
    //    Sub-step 2: Live 6-yard box loose-ball scramble (2 attackers + 2 defenders + GK crash box + optional ricochet).
    //    Sub-step 3: Scorer pounces on 2nd ball -> immediate decisive finish (zero stalling!).
    if (dirCue.pattern === 'rebound_finish') {
      const firstShooterTarget: SimVec2 = { x: atkX(isH, 0.79), y: halfSpaceY };
      const secondAtk = atkAgents.find(
        (a) => a.slotIndex !== 0 && a.slotIndex !== scorer.slotIndex && a.slotIndex !== assister.slotIndex,
      );
      const secondDef = defAgents.find(
        (d) => d.slotIndex !== 0 && d.slotIndex !== defender?.slotIndex,
      );

      if (dirCue.routeSubStep === 0) {
        state.ball.ownerTeamIsHome = isH;
        state.ball.ownerIdx = assister.slotIndex;
        state.ball.flightType = 'carry';
        applyAgentSteering({
          agent: assister,
          targetX: firstShooterTarget.x,
          targetY: firstShooterTarget.y,
          sprintDemand: 1.0,
          teammates: atkAgents,
          doctrine: atkDoctrine,
          dt,
          skipSeparation: true,
          speedBoost: 1.9,
        });
        applyAgentSteering({
          agent: scorer,
          targetX: scorerDest.x,
          targetY: scorerDest.y,
          sprintDemand: 1.0,
          teammates: atkAgents,
          doctrine: atkDoctrine,
          dt,
          skipSeparation: true,
          speedBoost: 1.85,
        });
        if (
          isWithinShootingZone(isH, assister.x, 0.70) ||
          dirCue.stageTimer >= 0.85
        ) {
          dirCue.routeSubStep = 1;
          const deflectSpot: SimVec2 =
            dirCue.reboundOrigin === 'woodwork'
              ? { x: atkX(isH, 0.978), y: fl < 0 ? 0.42 : 0.58 }
              : dirCue.reboundOrigin === 'blocked'
                ? { x: atkX(isH, 0.895), y: 0.50 + fl * 0.04 }
                : { x: atkX(isH, 0.952), y: 0.50 + fl * 0.035 };
          const launchX = isWithinShootingZone(isH, assister.x, 0.70)
            ? assister.x
            : atkX(isH, 0.76);
          launchBallFlight({
            state,
            flightType: 'shot',
            fromX: launchX,
            fromY: assister.y,
            toX: deflectSpot.x,
            toY: deflectSpot.y,
            targetTeamIsHome: null,
            targetIdx: null,
            passerIsHome: isH,
            passerIdx: assister.slotIndex,
            speedOverride: 0.62,
          });
        }
        return;
      }

      if (dirCue.routeSubStep === 1 && state.ball.flightProgress >= 0.94) {
        dirCue.routeSubStep = 2;
        dirCue.scrambleTimer = 0;
        dirCue.reboundTriggered = true;
        state.stats.secondChanceScrambles += 1;
        state.tacticalLabel =
          dirCue.scrambleMode === 'goalmouth_scramble' ? '문전 혼전' : '세컨찬스';
        state.tacticalLabelTeamIsHome = isH;
        // Count the initial parried/blocked shot on live metrics so 2D matches scoreboard!
        recordLiveShotEvent(state, isH, {
          onTarget: dirCue.reboundOrigin === 'save',
          isSave: dirCue.reboundOrigin === 'save',
          isGoal: false,
          xgDelta: 0.08,
        });
        state.impactRing = {
          x: state.ball.x,
          y: state.ball.y,
          alpha: 0.95,
          color:
            dirCue.reboundOrigin === 'woodwork'
              ? '#fb923c'
              : dirCue.reboundOrigin === 'blocked'
                ? '#fbbf24'
                : '#38bdf8',
        };
        const bounceTarget: SimVec2 =
          dirCue.scrambleMode === 'goalmouth_scramble'
            ? {
                x: atkX(isH, 0.922),
                y: clamp(0.50 + fl * 0.035, 0.42, 0.58),
              }
            : scorerDest;
        launchBallFlight({
          state,
          flightType: 'loose',
          fromX: state.ball.x,
          fromY: state.ball.y,
          toX: bounceTarget.x,
          toY: bounceTarget.y,
          targetTeamIsHome:
            dirCue.scrambleMode === 'goalmouth_scramble' ? null : isH,
          targetIdx:
            dirCue.scrambleMode === 'goalmouth_scramble'
              ? null
              : scorer.slotIndex,
          passerIsHome: !isH,
          passerIdx: 0,
          speedOverride: 0.40,
          maxArcZ: 0.34,
        });
      }

      // Goalmouth scramble secondary ricochet inside 6-yard box before scorer pounces!
      if (
        dirCue.routeSubStep === 2 &&
        dirCue.scrambleMode === 'goalmouth_scramble'
      ) {
        dirCue.scrambleTimer += dt;
        if (state.ball.flightProgress >= 0.92 || dirCue.scrambleTimer >= 0.22) {
          dirCue.routeSubStep = 3;
          state.impactRing = {
            x: state.ball.x,
            y: state.ball.y,
            alpha: 0.82,
            color: '#fbbf24',
          };
          launchBallFlight({
            state,
            flightType: 'loose',
            fromX: state.ball.x,
            fromY: state.ball.y,
            toX: scorerDest.x,
            toY: scorerDest.y,
            targetTeamIsHome: isH,
            targetIdx: scorer.slotIndex,
            passerIsHome: !isH,
            passerIdx: defender?.slotIndex ?? 1,
            speedOverride: 0.44,
            maxArcZ: 0.16,
          });
        }
      }

      // All nearby box actors crash the 6-yard box aggressively!
      applyAgentSteering({
        agent: scorer,
        targetX: scorerDest.x,
        targetY: scorerDest.y,
        sprintDemand: 1.0,
        teammates: atkAgents,
        doctrine: atkDoctrine,
        dt,
        skipSeparation: true,
        speedBoost: 2.0,
      });
      if (secondAtk) {
        applyAgentSteering({
          agent: secondAtk,
          targetX: atkX(isH, 0.915),
          targetY: clamp(0.50 + fl * 0.07, 0.36, 0.64),
          sprintDemand: 1.0,
          teammates: atkAgents,
          doctrine: atkDoctrine,
          dt,
          speedBoost: 1.65,
        });
      }
      if (defender) {
        applyAgentSteering({
          agent: defender,
          targetX: atkX(isH, 0.935),
          targetY: clamp(scorerDest.y + fl * 0.03, 0.38, 0.62),
          sprintDemand: 1.0,
          teammates: defAgents,
          doctrine: defDoctrine,
          dt,
          speedBoost: 1.65,
        });
      }
      if (secondDef) {
        applyAgentSteering({
          agent: secondDef,
          targetX: atkX(isH, 0.948),
          targetY: clamp(scorerDest.y - fl * 0.04, 0.38, 0.62),
          sprintDemand: 1.0,
          teammates: defAgents,
          doctrine: defDoctrine,
          dt,
          speedBoost: 1.65,
        });
      }
      applyAgentSteering({
        agent: defGk,
        targetX: atkX(isH, 0.964),
        targetY: clamp(state.ball.y, 0.42, 0.58),
        sprintDemand: 1.0,
        teammates: defAgents,
        doctrine: defDoctrine,
        dt,
        skipSeparation: true,
      });

      const finalReadyStep =
        dirCue.scrambleMode === 'goalmouth_scramble' ? 3 : 2;
      const reboundReady =
        dirCue.routeSubStep >= finalReadyStep &&
        ((state.ball.ownerTeamIsHome === isH && state.ball.ownerIdx === scorer.slotIndex) ||
          state.ball.flightProgress >= 0.92);
      if (
        (reboundReady && isWithinShootingZone(isH, scorer.x, dirCue.minShotDepth)) ||
        dirCue.stageTimer >= dirCue.stageDuration
      ) {
        triggerDirectorShot(state, dirCue, scorer);
      }
      return;
    }

    // 5) Standard open-play & counterattack assisted routes:
    //    Sub-step 0: Assister carries/reaches route launch depth, then delivers pass/cross/through-ball.
    //    Sub-step 1: Pass flies ahead while scorer sprints to scorerDest.
    //    Sub-step 2: If scorer collected pass before minShotDepth (e.g. counterattack!), scorer drives into shooting zone first!
    if (dirCue.routeSubStep === 0) {
      state.ball.ownerTeamIsHome = isH;
      state.ball.ownerIdx = assister.slotIndex;
      state.ball.flightType = 'carry';
      applyAgentSteering({
        agent: assister,
        targetX: passerDest.x,
        targetY: passerDest.y,
        sprintDemand: 1.0,
        teammates: atkAgents,
        doctrine: atkDoctrine,
        dt,
        speedBoost: 1.85,
      });
      applyAgentSteering({
        agent: scorer,
        targetX: lerp(scorer.x, scorerDest.x, 0.72),
        targetY: lerp(scorer.y, scorerDest.y, 0.72),
        sprintDemand: 1.0,
        teammates: atkAgents,
        doctrine: atkDoctrine,
        dt,
        skipSeparation: true,
        speedBoost: 1.85,
      });

      const assisterInLaunchZone =
        getAttackDepth(isH, assister.x) >= passerMinLaunchDepth;
      if (assisterInLaunchZone || dirCue.stageTimer >= 0.78) {
        dirCue.routeSubStep = 1;
        // For fast counters, lead the pass into space ahead of scorer so scorer drives cleanly into box!
        const passTarget: SimVec2 =
          dirCue.attackRoute === 'low_block_counter' &&
          getAttackDepth(isH, scorer.x) < 0.62
            ? {
                x: atkX(isH, Math.min(0.84, getAttackDepth(isH, scorer.x) + 0.22)),
                y: lerp(scorer.y, scorerDest.y, 0.65),
              }
            : scorerDest;
        const ctrl: SimVec2 =
          passFlightType === 'cross'
            ? { x: atkX(isH, 0.87), y: lerp(assister.y, passTarget.y, 0.45) }
            : passFlightType === 'long_switch'
              ? { x: (assister.x + passTarget.x) * 0.5, y: 0.5 }
              : { x: (assister.x + passTarget.x) * 0.5, y: (assister.y + passTarget.y) * 0.5 };
        launchBallFlight({
          state,
          flightType: passFlightType,
          fromX: assister.x,
          fromY: assister.y,
          toX: passTarget.x,
          toY: passTarget.y,
          ctrlX: ctrl.x,
          ctrlY: ctrl.y,
          targetTeamIsHome: isH,
          targetIdx: scorer.slotIndex,
          passerIsHome: isH,
          passerIdx: assister.slotIndex,
          speedOverride: passFlightType === 'cross' ? 0.44 : 0.50,
          arcColor:
            passFlightType === 'cross'
              ? '#bae6fd'
              : passFlightType === 'long_switch'
                ? '#38bdf8'
                : '#34d399',
        });
        state.runIndicators.push({
          from: { x: scorer.x, y: scorer.y },
          to: scorerDest,
          color: '#34d399',
          alpha: 0.72,
          isThirdMan: dirCue.attackRoute === 'tiki_taka_triangle',
        });
      }
      return;
    }

    // Sub-step 1 (pass in flight) & Sub-step 2 (scorer carrying into shooting zone)
    applyAgentSteering({
      agent: scorer,
      targetX: scorerDest.x,
      targetY: scorerDest.y,
      sprintDemand: 1.0,
      teammates: atkAgents,
      doctrine: atkDoctrine,
      dt,
      skipSeparation: true,
      speedBoost: 1.9,
    });
    if (defender) {
      applyAgentSteering({
        agent: defender,
        targetX: lerp(defender.x, scorerDest.x + (isH ? 0.025 : -0.025), 0.7),
        targetY: lerp(defender.y, scorerDest.y + fl * 0.03, 0.7),
        sprintDemand: 0.92,
        teammates: defAgents,
        doctrine: defDoctrine,
        dt,
      });
    }

    const ballWithScorer =
      state.ball.ownerTeamIsHome === isH && state.ball.ownerIdx === scorer.slotIndex;
    const passDone = ballWithScorer || state.ball.flightProgress >= 0.96;

    if (passDone && dirCue.routeSubStep === 1) {
      // Transition cleanly to sub-step 2: scorer carries ball into shooting range if not there yet!
      dirCue.routeSubStep = 2;
      state.ball.ownerTeamIsHome = isH;
      state.ball.ownerIdx = scorer.slotIndex;
      state.ball.flightType = 'carry';
    }

    const inShootingZone = isWithinShootingZone(isH, scorer.x, dirCue.minShotDepth);
    if (
      (dirCue.routeSubStep === 2 && inShootingZone) ||
      dirCue.stageTimer >= dirCue.stageDuration
    ) {
      triggerDirectorShot(state, dirCue, scorer);
    }
    return;
  }

  if (dirCue.stage === 'shot_flight') {
    // GK dives toward shot (or wrong corner on scored PK)
    const gkDiveY =
      dirCue.pattern === 'penalty_kick' && dirCue.outcome === 'goal'
        ? dirCue.pkDirection === 'center'
          ? 0.435
          : dirCue.targetY < 0.5
            ? 0.565
            : 0.435
        : dirCue.targetY;
    applyAgentSteering({
      agent: defGk,
      targetX: atkX(isH, 0.955),
      targetY: gkDiveY,
      sprintDemand: 1.0,
      teammates: defAgents,
      doctrine: defDoctrine,
      dt,
      skipSeparation: true,
    });

    if (dirCue.outcome === 'blocked' && defender) {
      applyAgentSteering({
        agent: defender,
        targetX: dirCue.shotEnd.x,
        targetY: dirCue.shotEnd.y,
        sprintDemand: 1.0,
        teammates: defAgents,
        doctrine: defDoctrine,
        dt,
        skipSeparation: true,
      });
    }

    if (dirCue.stageTimer >= dirCue.stageDuration || state.ball.flightProgress >= 0.98) {
      // Exact impact frame -> REVEAL outcome (zero premature spoilers!)
      dirCue.stage = 'reveal';
      dirCue.stageTimer = 0;
      dirCue.stageDuration = dirCue.outcome === 'var_offside' ? 1.85 : 1.55;
      dirCue.revealed = true;
      state.revealedEventKeys.add(dirCue.key);
      state.localPaceMult = 1.0;

      if (dirCue.outcome === 'goal') {
        if (isH) state.homeGoalsLive += 1;
        else state.awayGoalsLive += 1;
        recordLiveShotEvent(state, isH, {
          onTarget: true,
          isSave: false,
          isGoal: true,
          xgDelta:
            dirCue.pattern === 'penalty_kick'
              ? 0.78
              : dirCue.scrambleMode === 'tap_in' || dirCue.pattern === 'rebound_finish'
                ? 0.42
                : 0.28,
        });
        // Immediately update late-game Game State Urgency when score changes!
        refreshLiveUrgencyDoctrines(state);
        state.goalRipple = { side: isH ? 'right' : 'left', intensity: 1.0 };
        state.pitchFlashAlpha = 0.22;
        resetBallToSpot(state, atkX(isH, 0.996), dirCue.targetY, null, null);
      } else if (dirCue.outcome === 'var_offside') {
        state.goalRipple = { side: isH ? 'right' : 'left', intensity: 0.75 };
        resetBallToSpot(state, atkX(isH, 0.994), dirCue.targetY, null, null);
      } else if (dirCue.outcome === 'save') {
        recordLiveShotEvent(state, isH, {
          onTarget: true,
          isSave: true,
          isGoal: false,
          xgDelta: dirCue.pattern === 'penalty_kick' ? 0.78 : 0.22,
        });
        state.impactRing = {
          x: dirCue.shotEnd.x,
          y: dirCue.shotEnd.y,
          alpha: 1.0,
          color: '#38bdf8',
        };
        launchBallFlight({
          state,
          flightType: 'loose',
          fromX: dirCue.shotEnd.x,
          fromY: dirCue.shotEnd.y,
          toX: atkX(isH, 0.80),
          toY: dirCue.targetY < 0.5 ? 0.22 : 0.78,
          targetTeamIsHome: !isH,
          targetIdx: 1,
          passerIsHome: !isH,
          passerIdx: 0,
          speedOverride: 0.30,
          maxArcZ: 0.35,
        });
      } else if (dirCue.outcome === 'woodwork') {
        recordLiveShotEvent(state, isH, {
          onTarget: false,
          isSave: false,
          isGoal: false,
          xgDelta: 0.16,
        });
        state.impactRing = {
          x: atkX(isH, 0.985),
          y: dirCue.targetY,
          alpha: 1.0,
          color: '#fb923c',
        };
        launchBallFlight({
          state,
          flightType: 'loose',
          fromX: atkX(isH, 0.985),
          fromY: dirCue.targetY,
          toX: atkX(isH, 0.82),
          toY: dirCue.targetY < 0.5 ? 0.28 : 0.72,
          targetTeamIsHome: !isH,
          targetIdx: 2,
          passerIsHome: !isH,
          passerIdx: 2,
          speedOverride: 0.32,
          maxArcZ: 0.62,
        });
      } else if (dirCue.outcome === 'blocked') {
        recordLiveShotEvent(state, isH, {
          onTarget: false,
          isSave: false,
          isGoal: false,
          xgDelta: 0.11,
        });
        state.impactRing = {
          x: dirCue.shotEnd.x,
          y: dirCue.shotEnd.y,
          alpha: 1.0,
          color: '#fbbf24',
        };
        launchBallFlight({
          state,
          flightType: 'loose',
          fromX: dirCue.shotEnd.x,
          fromY: dirCue.shotEnd.y,
          toX: atkX(isH, 0.76),
          toY: dirCue.targetY < 0.5 ? 0.25 : 0.75,
          targetTeamIsHome: !isH,
          targetIdx: 4,
          passerIsHome: !isH,
          passerIdx: dirCue.defenderIdx,
          speedOverride: 0.30,
          maxArcZ: 0.30,
        });
      } else {
        // near_miss
        recordLiveShotEvent(state, isH, {
          onTarget: false,
          isSave: false,
          isGoal: false,
          xgDelta: 0.12,
        });
        launchBallFlight({
          state,
          flightType: 'loose',
          fromX: dirCue.shotEnd.x,
          fromY: dirCue.shotEnd.y,
          toX: atkX(isH, 0.995),
          toY: dirCue.targetY < 0.5 ? 0.31 : 0.69,
          targetTeamIsHome: !isH,
          targetIdx: 0,
          passerIsHome: isH,
          passerIdx: dirCue.scorerIdx,
          speedOverride: 0.32,
        });
      }
    }
    return;
  }

  if (dirCue.stage === 'reveal') {
    if (dirCue.stageTimer >= dirCue.stageDuration) {
      // Hand cleanly back to autonomous play (conceding team restarts from center on goal!)
      const wasGoal = dirCue.outcome === 'goal';
      state.director = null;
      state.goalRipple = null;
      state.localPaceMult = 1.0;

      if (wasGoal) {
        const restartHome = !isH;
        const restartAgents = restartHome ? state.homeAgents : state.awayAgents;
        const mid = restartAgents[6] ?? restartAgents[5];
        state.possessionIsHome = restartHome;
        placeAgentForSetPiece(mid, 0.5, 0.5, restartHome ? 0 : Math.PI);
        resetBallToSpot(state, 0.5, 0.5, restartHome, mid.slotIndex);
        state.tacticalLabel = '후방 빌드업';
        state.tacticalLabelTeamIsHome = restartHome;
      } else {
        // Defending team collects & builds up
        state.possessionIsHome = !isH;
        state.tacticalLabel = '후방 빌드업';
        state.tacticalLabelTeamIsHome = !isH;
      }
      state.carrierHoldTimer = 0;
      state.recycleCount = 0;
      state.stallPassCount = 0;
      state.possessionStallTime = 0;
      state.pressTriggerTimer = 0;
    }
  }
}

function triggerDirectorShot(
  state: PitchSimState,
  dirCue: DirectorCueState,
  scorer: PlayerAgentState,
) {
  const isH = dirCue.isHomeAttack;
  const fl = dirCue.flankSide;

  // Enforce hard physical shooting-zone invariant:
  // 1) PK & Direct FK ALWAYS strike from exact setPieceSpot.
  // 2) Open play & Corner ALWAYS strike from within realistic shooting range (>= minShotDepth, never behind halfway!).
  let origin: SimVec2;
  if (
    (dirCue.pattern === 'penalty_kick' || dirCue.pattern === 'direct_free_kick') &&
    dirCue.setPieceSpot
  ) {
    origin = { x: dirCue.setPieceSpot.x, y: dirCue.setPieceSpot.y };
  } else {
    const rawDepth = getAttackDepth(isH, scorer.x);
    if (rawDepth < dirCue.minShotDepth) {
      // Safety fallback (only if timeout fired before arrival): clamp cleanly into shooting zone
      const safeX = atkX(isH, dirCue.minShotDepth);
      scorer.x = safeX;
      scorer.prevX = safeX;
    }
    origin = { x: scorer.x, y: scorer.y };
  }

  const endX =
    dirCue.outcome === 'blocked'
      ? atkX(isH, Math.max(0.885, Math.min(0.955, getAttackDepth(isH, origin.x) + 0.03)))
      : dirCue.outcome === 'save'
        ? atkX(isH, 0.96)
        : dirCue.outcome === 'woodwork'
          ? atkX(isH, 0.985)
          : atkX(isH, 0.99);
  const endY =
    dirCue.outcome === 'near_miss'
      ? dirCue.targetY < 0.5
        ? 0.34
        : 0.66
      : dirCue.targetY;
  const end: SimVec2 = { x: endX, y: endY };

  const isCurved =
    dirCue.pattern === 'cut_inside_curler' ||
    dirCue.pattern === 'direct_free_kick';
  const ctrl: SimVec2 = isCurved
    ? {
        x: lerp(origin.x, end.x, 0.52),
        y: clamp(lerp(origin.y, end.y, 0.35) + fl * 0.12, 0.12, 0.88),
      }
    : {
        x: lerp(origin.x, end.x, 0.5),
        y: lerp(origin.y, end.y, 0.5),
      };

  const isPointBlank =
    getAttackDepth(isH, origin.x) >= 0.91 ||
    dirCue.scrambleMode === 'tap_in' ||
    dirCue.scrambleMode === 'goalmouth_scramble';
  const arcZ =
    dirCue.pattern === 'direct_free_kick' ||
    dirCue.attackRoute === 'long_range_cannon' ||
    dirCue.pattern === 'cut_inside_curler'
      ? 0.65
      : dirCue.pattern === 'wing_cross_header' || dirCue.pattern === 'corner_kick'
        ? 0.40
        : isPointBlank
          ? 0.12
          : 0.20;

  const shotDur = isPointBlank ? 0.54 : 0.86;
  dirCue.shotOrigin = origin;
  dirCue.shotControl = ctrl;
  dirCue.shotEnd = end;
  dirCue.stage = 'shot_flight';
  dirCue.stageTimer = 0;
  dirCue.stageDuration = shotDur;
  state.localPaceMult = isPointBlank ? 0.86 : 0.78;

  launchBallFlight({
    state,
    flightType: 'shot',
    fromX: origin.x,
    fromY: origin.y,
    toX: end.x,
    toY: end.y,
    ctrlX: ctrl.x,
    ctrlY: ctrl.y,
    targetTeamIsHome: null,
    targetIdx: null,
    passerIsHome: isH,
    passerIdx: scorer.slotIndex,
    speedOverride: Math.max(
      0.24,
      Math.hypot(end.x - origin.x, end.y - origin.y) / Math.max(0.45, shotDur - 0.04),
    ),
    maxArcZ: arcZ,
    arcColor: '#fef08a',
  });
}

/**
 * Advances Ball physics by one fixed step.
 */
function stepBallPhysics(state: PitchSimState, dt: number) {
  const ball = state.ball;

  // Hard single-ball lock during set-piece spot staging & PK/FK run-up (zero tug-of-war or ghost trail!)
  if (
    state.director?.setPieceSpot &&
    (state.director.stage === 'set_piece_setup' ||
      (state.director.stage === 'execute_route' &&
        (state.director.pattern === 'penalty_kick' ||
          state.director.pattern === 'direct_free_kick')))
  ) {
    const spot = state.director.setPieceSpot;
    ball.x = spot.x;
    ball.y = spot.y;
    ball.z = 0;
    ball.prevX = spot.x;
    ball.prevY = spot.y;
    ball.prevZ = 0;
    ball.vx = 0;
    ball.vy = 0;
    ball.trail = [];
    return;
  }

  ball.prevX = ball.x;
  ball.prevY = ball.y;
  ball.prevZ = ball.z;

  if (ball.ownerTeamIsHome !== null && ball.ownerIdx !== null) {
    const owner = (ball.ownerTeamIsHome ? state.homeAgents : state.awayAgents)[
      ball.ownerIdx
    ];
    if (owner) {
      const leadDist = 0.015;
      const targetX = clamp(owner.x + Math.cos(owner.heading) * leadDist, 0.025, 0.975);
      const targetY = clamp(owner.y + Math.sin(owner.heading) * leadDist, 0.035, 0.965);
      const smooth = clamp(dt * 18, 0, 1);
      ball.x = lerp(ball.x, targetX, smooth);
      ball.y = lerp(ball.y, targetY, smooth);
      ball.z = lerp(ball.z, 0, smooth);
      ball.vx = owner.vx;
      ball.vy = owner.vy;
    }
    // Owned ball never leaves floating trail dots that can look like a second ball
    if (ball.trail.length > 0) {
      ball.trail = [];
    }
    return;
  } else if (ball.flightProgress < 1) {
    ball.flightProgress = Math.min(1, ball.flightProgress + dt / Math.max(0.15, ball.flightDuration));
    // Ground passes & through balls gently decelerate due to grass friction (ease-out curve)
    const easedT =
      ball.flightType === 'ground_pass' || ball.flightType === 'through_ball'
        ? 1 - Math.pow(1 - ball.flightProgress, 1.38)
        : ball.flightProgress;

    const pt = quadBezier(
      { x: ball.originX, y: ball.originY },
      { x: ball.ctrlX, y: ball.ctrlY },
      { x: ball.destX, y: ball.destY },
      easedT,
    );
    ball.vx = (pt.x - ball.x) / Math.max(1e-4, dt);
    ball.vy = (pt.y - ball.y) / Math.max(1e-4, dt);
    ball.x = pt.x;
    ball.y = pt.y;
    ball.z = Math.sin(ball.flightProgress * Math.PI) * ball.maxArcZ;

    // On arrival: transfer possession cleanly to receiver (or intercepting defender)
    if (ball.flightProgress >= 1 && ball.passTargetTeamIsHome !== null && ball.passTargetIdx !== null) {
      const prevTeam = ball.lastTouchTeamIsHome;
      const newTeam = ball.passTargetTeamIsHome;
      ball.ownerTeamIsHome = newTeam;
      ball.ownerIdx = ball.passTargetIdx;
      ball.flightType = 'carry';
      ball.z = 0;
      ball.trail = [];

      if (newTeam !== prevTeam) {
        // Turnover / interception!
        state.possessionIsHome = newTeam;
        state.recycleCount = 0;
        state.stallPassCount = 0;
        state.possessionStallTime = 0;
        state.pressTriggerTimer = 0;
        state.thirdMan = null;
        state.transitionTimer = 3.2;
        state.transitionTeamIsHome = newTeam;
        const newDoc = newTeam ? state.homeDoctrine : state.awayDoctrine;
        state.tacticalLabel =
          newDoc.tactic === 'gegenpressing' || newDoc.managerTraitId === 'gegenpress_guru'
            ? '전방 압박'
            : '역습 전환';
        state.tacticalLabelTeamIsHome = newTeam;
      } else {
        state.stats.passesCompleted += 1;
        // Advance Third-Man Run state machine on B or C reception
        if (state.thirdMan && state.thirdMan.active && state.thirdMan.teamIsHome === newTeam) {
          if (state.thirdMan.stage === 'a_to_b' && ball.ownerIdx === state.thirdMan.bIdx) {
            state.thirdMan.stage = 'b_hold';
            state.carrierHoldTimer = 0;
            state.carrierDecisionDelay = 0.18; // Crisp one-touch / two-touch wall release!
            return;
          }
          if (state.thirdMan.stage === 'b_to_c' && ball.ownerIdx === state.thirdMan.cIdx) {
            state.thirdMan = null;
          }
        }
      }

      // Compute realistic first-touch hold time (scaled by tempo, urgency, DRI, and chemistry)
      const receiver = (newTeam ? state.homeAgents : state.awayAgents)[ball.ownerIdx];
      const doc = newTeam ? state.homeDoctrine : state.awayDoctrine;
      if (receiver && receiver.slotIndex !== 0) {
        const recDir = newTeam ? 1 : -1;
        receiver.targetX = clamp(receiver.x + recDir * 0.036, 0.06, 0.94);
        receiver.targetY = clamp(lerp(receiver.y, 0.5, 0.16), 0.10, 0.90);
      }
      const driQuick = receiver ? clamp((receiver.profile.attrs.dri - 65) / 35, 0, 1) * 0.14 : 0;
      const synQuick =
        receiver && newTeam === prevTeam
          ? receiver.profile.synergyWithSlot[ball.lastTouchIdx] * 0.035
          : 0;
      const urgencyQuick = doc.attackUrgency * 0.18;
      const minHold = doc.attackUrgency >= 0.25 ? 0.24 : 0.34;
      state.carrierHoldTimer = 0;
      state.carrierDecisionDelay = clamp(
        (0.76 - driQuick - synQuick - urgencyQuick + (nextSimRng(state) - 0.5) * 0.22) / doc.tempo,
        minHold,
        1.08,
      );
      return;
    }

    // Record motion trail ONLY while ball is genuinely moving in flight
    if (Math.hypot(ball.x - ball.prevX, ball.y - ball.prevY) > 0.0015) {
      ball.trail.push({ x: ball.x, y: ball.y, z: ball.z, flightType: ball.flightType });
      const maxTrail = state.director?.stage === 'shot_flight' ? 10 : 7;
      while (ball.trail.length > maxTrail) {
        ball.trail.shift();
      }
    }
  } else if (ball.trail.length > 0) {
    // Stationary loose ball clears trail cleanly
    ball.trail = [];
  }
}

/**
 * Steps the entire 22-player + ball simulation forward by exactly one FIXED_DT tick.
 * 100% deterministic for a given initial seed & sequence of inputs.
 */
export function stepPitchSim(state: PitchSimState, dt: number = FIXED_DT) {
  if (state.completed) return;

  const effDt = dt * state.localPaceMult;
  state.simTime += effDt;

  // Decay visual overlays cleanly in simulation time
  if (state.passArc) {
    state.passArc.ttl -= dt;
    if (state.passArc.ttl <= 0) state.passArc = null;
    else state.passArc.alpha = clamp((state.passArc.ttl / state.passArc.maxTtl) * 0.55, 0, 0.65);
  }
  if (state.impactRing) {
    state.impactRing.alpha = Math.max(0, state.impactRing.alpha - dt * 1.4);
    if (state.impactRing.alpha <= 0.01) state.impactRing = null;
  }
  if (state.goalRipple) {
    state.goalRipple.intensity = Math.max(0, state.goalRipple.intensity - dt * 0.85);
    if (state.goalRipple.intensity <= 0.01) state.goalRipple = null;
  }
  if (state.pitchFlashAlpha > 0) {
    state.pitchFlashAlpha = Math.max(0, state.pitchFlashAlpha - dt * 0.45);
  }
  state.runIndicators = [];

  // Advance match minute clock (gently paused while a Director highlight finishes right on its minute)
  const clockRate = state.director
    ? 0.08 / SIM_SECONDS_PER_MATCH_MINUTE
    : 1 / SIM_SECONDS_PER_MATCH_MINUTE;
  state.matchMinuteFloat = Math.min(
    state.endMinute,
    state.matchMinuteFloat + dt * clockRate,
  );

  // Periodically refresh live stamina AND late-game urgency doctrines every integer match minute
  const intMin = Math.floor(state.matchMinuteFloat);
  if (intMin > state.lastStaminaSyncMinute) {
    state.lastStaminaSyncMinute = intMin;
    refreshLiveUrgencyDoctrines(state);
    for (let i = 0; i < 11; i += 1) {
      state.homeAgents[i].staminaPct = computeAgentLiveStamina(
        state.homeAgents[i].profile,
        state.homeDoctrine,
        intMin,
      );
      state.awayAgents[i].staminaPct = computeAgentLiveStamina(
        state.awayAgents[i].profile,
        state.awayDoctrine,
        intMin,
      );
    }
  }

  // Trigger upcoming matchEngine highlight smoothly ~1.25 minutes ahead
  if (!state.director) {
    const upcoming = state.scheduledEvents.find(
      ({ key, event }) =>
        !state.handledEventKeys.has(key) &&
        (event.type === 'goal' ||
          event.type === 'save' ||
          event.type === 'chance' ||
          event.type === 'var_offside') &&
        event.minute >= state.startMinute &&
        event.minute <= state.endMinute &&
        state.matchMinuteFloat >= Math.max(state.startMinute + 0.35, event.minute - 1.15),
    );
    if (upcoming) {
      activateDirectorCue(state, upcoming);
    }
  }

  // Update transition window & active pressing trigger timer
  if (state.transitionTimer > 0) {
    state.transitionTimer = Math.max(0, state.transitionTimer - effDt);
    if (state.transitionTimer === 0) state.transitionTeamIsHome = null;
  }
  if (state.pressTriggerTimer > 0) {
    state.pressTriggerTimer = Math.max(0, state.pressTriggerTimer - effDt);
  }

  // Track open-play possession stall duration (only when stalling without progression or dwelling on the ball)
  if (!state.director && state.ball.ownerTeamIsHome !== null && state.ball.ownerIdx !== null) {
    if (state.stallPassCount >= 1 || state.carrierHoldTimer > 0.65) {
      state.possessionStallTime += effDt;
    }
    if (state.possessionStallTime >= 3.0 && state.pressTriggerTimer <= 0.1) {
      state.pressTriggerTimer = 2.0;
      state.stats.pressingTriggersFired += 1;
    }
  }

  // Update Third-Man Run timeout safety
  if (state.thirdMan) {
    state.thirdMan.timer += effDt;
    if (state.thirdMan.timer > 3.2 || state.thirdMan.teamIsHome !== state.possessionIsHome) {
      state.thirdMan = null;
    }
  }

  // Step Director if active
  if (state.director) {
    stepDirectorCue(state, effDt);
  }

  // Step Ball Physics
  stepBallPhysics(state, effDt);

  // Enforce penalty/6-yard box freeze guard & orphaned loose-ball resolver
  enforcePenaltyBoxFreezeGuard(state, effDt);

  // Carrier decision timer & pressing turnover in open play
  if (!state.director && state.ball.ownerTeamIsHome !== null && state.ball.ownerIdx !== null) {
    state.carrierHoldTimer += effDt;

    // Check close-range tackle/press steal by defending pressers
    const carrierIsHome = state.ball.ownerTeamIsHome;
    const carrier = (carrierIsHome ? state.homeAgents : state.awayAgents)[state.ball.ownerIdx];
    const defenders = carrierIsHome ? state.awayAgents : state.homeAgents;
    const atkDoc = carrierIsHome ? state.homeDoctrine : state.awayDoctrine;
    const defDoc = carrierIsHome ? state.awayDoctrine : state.homeDoctrine;

    let closestDef: PlayerAgentState | null = null;
    let closestDefDist = 999;
    for (let i = 1; i < defenders.length; i += 1) {
      const d = Math.hypot(defenders[i].x - carrier.x, defenders[i].y - carrier.y);
      if (d < closestDefDist) {
        closestDefDist = d;
        closestDef = defenders[i];
      }
    }

    const activePressBoost =
      (state.pressTriggerTimer > 0 ? 0.28 : 0) +
      Math.max(0, state.stallPassCount - 1) * 0.14;
    const tackleReach = state.pressTriggerTimer > 0 ? 0.042 : 0.036;

    if (closestDef && closestDefDist < tackleReach && carrier.slotIndex !== 0 && state.carrierHoldTimer > 0.24) {
      const targetPoss = carrierIsHome
        ? state.targetHomePossession / 100
        : 1 - state.targetHomePossession / 100;
      const defSkill = (closestDef.profile.attrs.def + closestDef.profile.attrs.phy) * 0.5;
      const atkSkill = (carrier.profile.attrs.dri + carrier.profile.attrs.phy) * 0.5;
      const stealProbPerSec = clamp(
        0.55 +
          (defSkill - atkSkill) * 0.015 +
          defDoc.zonePressEdge * 0.25 +
          defDoc.attackUrgency * 0.25 +
          activePressBoost -
          atkDoc.composure * 0.22 +
          (0.55 - targetPoss) * 0.45,
        0.15,
        1.85,
      );
      if (nextSimRng(state) < stealProbPerSec * effDt) {
        state.ball.ownerTeamIsHome = !carrierIsHome;
        state.ball.ownerIdx = closestDef.slotIndex;
        state.ball.lastTouchTeamIsHome = !carrierIsHome;
        state.ball.lastTouchIdx = closestDef.slotIndex;
        state.ball.trail = [];
        state.possessionIsHome = !carrierIsHome;
        state.carrierHoldTimer = 0;
        state.carrierDecisionDelay = Math.max(0.24, (0.48 - defDoc.attackUrgency * 0.14) / defDoc.tempo);
        state.recycleCount = 0;
        state.stallPassCount = 0;
        state.possessionStallTime = 0;
        state.pressTriggerTimer = 0;
        state.thirdMan = null;
        state.transitionTimer = 3.2;
        state.transitionTeamIsHome = !carrierIsHome;
        state.tacticalLabel =
          defDoc.tactic === 'gegenpressing' || defDoc.managerTraitId === 'gegenpress_guru' || defDoc.attackUrgency >= 0.55
            ? '전방 압박'
            : '역습 전환';
        state.tacticalLabelTeamIsHome = !carrierIsHome;
        state.stats.interceptions += 1;
      }
    }

    if (state.carrierHoldTimer >= state.carrierDecisionDelay) {
      executeCarrierUtilityDecision(state);
    }
  }

  // ── Update all 22 Player Agents via 5-Layer Tactical Steering ──
  const homeBase = buildBaseFormationCoords(state.homeDoctrine.formation, true);
  const awayBase = buildBaseFormationCoords(state.awayDoctrine.formation, false);

  const shotShare =
    (state.homeShotsTarget + 1.5) /
    Math.max(3, state.homeShotsTarget + state.awayShotsTarget + 3);
  const xgShare =
    (state.homeXgTarget + 0.3) /
    Math.max(0.6, state.homeXgTarget + state.awayXgTarget + 0.6);
  const territorialHome =
    (state.targetHomePossession / 100) * 0.52 + shotShare * 0.24 + xgShare * 0.24;
  const territorialShiftX = (territorialHome - 0.5) * 0.24;

  const updateTeamAgents = (isHome: boolean) => {
    const agents = isHome ? state.homeAgents : state.awayAgents;
    const oppAgents = isHome ? state.awayAgents : state.homeAgents;
    const base = isHome ? homeBase : awayBase;
    const doctrine = isHome ? state.homeDoctrine : state.awayDoctrine;
    const oppDoctrine = isHome ? state.awayDoctrine : state.homeDoctrine;
    const hasBall = state.possessionIsHome === isHome;
    const ballDepth = isHome ? state.ball.x : 1 - state.ball.x;
    const oppBacklineX = getDefensiveBacklineX(oppAgents, !isHome);

    let mode: FormationPhaseMode;
    if (hasBall) {
      if (state.transitionTimer > 0 && state.transitionTeamIsHome === isHome) {
        mode = 'transition_attack';
      } else {
        mode = ballDepth < 0.44 ? 'buildup' : 'progression';
      }
    } else if (state.transitionTimer > 0 && state.transitionTeamIsHome !== isHome) {
      mode = 'transition_defend';
    } else {
      mode = 'defend';
    }

    // Active Pressing Triggers: fire immediately on opponent backpasses, touchline traps, or possession stalls
    const pressTriggered =
      !hasBall &&
      !state.director &&
      (state.pressTriggerTimer > 0 ||
        state.stallPassCount >= 2 ||
        state.possessionStallTime >= 2.8 ||
        Math.abs(state.ball.y - 0.5) > 0.34);

    const effectivePressRadius = pressTriggered
      ? clamp(
          doctrine.pressTriggerRadius + (state.stallPassCount >= 3 ? 0.16 : 0.10),
          0.22,
          0.52,
        )
      : doctrine.pressTriggerRadius;
    const effectivePressersCount = pressTriggered
      ? Math.min(4, doctrine.pressersCount + 1)
      : doctrine.pressersCount;

    // Identify defending pressers (1..4 nearest / highest pressEagerness within effectivePressRadius)
    const presserIndices = new Set<number>();
    let primaryPresserIdx = -1;
    let coverShadowOutlet: SimVec2 | null = null;
    if (!hasBall && !state.director) {
      const pressScores: { idx: number; score: number }[] = [];
      for (let i = 1; i < 11; i += 1) {
        const d = Math.hypot(agents[i].x - state.ball.x, agents[i].y - state.ball.y);
        if (d <= effectivePressRadius) {
          const score =
            (effectivePressRadius - d) * 3.0 +
            agents[i].profile.pressEagerness * 0.45 +
            doctrine.attackUrgency * 0.35 +
            (pressTriggered ? 0.30 : 0) -
            (agents[i].profile.subPosition === 'CB' ? 0.35 : 0);
          pressScores.push({ idx: i, score });
        }
      }
      pressScores.sort((a, b) => b.score - a.score);
      for (let k = 0; k < Math.min(effectivePressersCount, pressScores.length); k += 1) {
        presserIndices.add(pressScores[k].idx);
      }
      if (pressScores.length > 0) {
        primaryPresserIdx = pressScores[0].idx;
      }

      // Compute Cover Shadow target: find the attacking carrier's nearest safe back/lateral outlet
      if (
        primaryPresserIdx >= 0 &&
        state.ball.ownerTeamIsHome === !isHome &&
        state.ball.ownerIdx !== null
      ) {
        const oppCarrierIdx = state.ball.ownerIdx;
        const oppCarrier = oppAgents[oppCarrierIdx];
        const oppDir = !isHome ? 1 : -1;
        let bestOutletDist = 999;
        for (let j = 1; j < oppAgents.length; j += 1) {
          if (j === oppCarrierIdx) continue;
          const m = oppAgents[j];
          const fwd = (m.x - oppCarrier.x) * oppDir;
          if (fwd > 0.06) continue; // block backward / lateral safe recycling outlets
          const d = Math.hypot(m.x - oppCarrier.x, m.y - oppCarrier.y);
          if (d > 0.06 && d < 0.32 && d < bestOutletDist) {
            bestOutletDist = d;
            coverShadowOutlet = { x: m.x, y: m.y };
          }
        }
      }
    }

    // Refresh Support Spot targets in staggered intervals (smooth, intelligent decisions)
    const carrier =
      hasBall && state.ball.ownerTeamIsHome === isHome && state.ball.ownerIdx !== null
        ? agents[state.ball.ownerIdx]
        : null;

    for (let i = 0; i < 11; i += 1) {
      const agent = agents[i];

      // Preserve staged set-piece formations & Director-controlled actors cleanly!
      if (state.director) {
        const dStage = state.director.stage;
        const dPat = state.director.pattern;
        const isSetPieceCue =
          dPat === 'penalty_kick' ||
          dPat === 'corner_kick' ||
          dPat === 'direct_free_kick';

        // During set-piece setup & execution, keep all 22 players in their staged set-piece formation
        if (isSetPieceCue && (dStage === 'set_piece_setup' || dStage === 'execute_route')) {
          continue;
        }
        if (dStage === 'execute_route' || dStage === 'shot_flight') {
          const isDirAtk = state.director.isHomeAttack === isHome;
          if (
            (isDirAtk &&
              (i === state.director.scorerIdx ||
                i === state.director.assisterIdx ||
                dPat === 'penalty_kick')) ||
            (!isDirAtk &&
              (i === 0 ||
                i === state.director.defenderIdx ||
                dPat === 'penalty_kick' ||
                (dPat === 'direct_free_kick' && i >= 4 && i <= 7)))
          ) {
            continue;
          }
        }
      }

      // Active Third-Man Run actor overrides (A -> B -> C)
      if (state.thirdMan && state.thirdMan.active && state.thirdMan.teamIsHome === isHome) {
        if (i === state.thirdMan.cIdx) {
          agent.roleAction = 'third_man_runner';
          applyAgentSteering({
            agent,
            targetX: state.thirdMan.runTarget.x,
            targetY: state.thirdMan.runTarget.y,
            sprintDemand: 1.0,
            teammates: agents,
            doctrine,
            dt: effDt,
          });
          state.runIndicators.push({
            from: { x: agent.x, y: agent.y },
            to: state.thirdMan.runTarget,
            color: '#34d399',
            alpha: 0.65,
            isThirdMan: true,
          });
          continue;
        }
        if (i === state.thirdMan.bIdx) {
          agent.roleAction = 'third_man_wall';
          applyAgentSteering({
            agent,
            targetX: state.thirdMan.wallSpot.x,
            targetY: state.thirdMan.wallSpot.y,
            sprintDemand: 0.65,
            teammates: agents,
            doctrine,
            dt: effDt,
          });
          continue;
        }
      }

      // Incoming pass receiver moves smoothly to meet the pass (Pursuit!)
      if (
        state.ball.ownerTeamIsHome === null &&
        state.ball.passTargetTeamIsHome === isHome &&
        state.ball.passTargetIdx === i
      ) {
        agent.roleAction = 'support';
        applyAgentSteering({
          agent,
          targetX: state.ball.destX,
          targetY: state.ball.destY,
          sprintDemand: state.ball.flightType === 'through_ball' ? 1.0 : 0.82,
          teammates: agents,
          doctrine,
          dt: effDt,
          skipSeparation: true,
        });
        continue;
      }

      // Carrier gently dribbles toward space ahead
      if (carrier && i === carrier.slotIndex) {
        agent.roleAction = 'carrier';
        applyAgentSteering({
          agent,
          targetX: agent.targetX,
          targetY: agent.targetY,
          sprintDemand: 0.62,
          teammates: agents,
          doctrine,
          dt: effDt,
          skipSeparation: true,
        });
        continue;
      }

      // Defending presser pursues ball carrier with Cover Shadow angle on nearest safe outlet!
      if (presserIndices.has(i)) {
        agent.roleAction = 'press';
        const leadT = 0.22;
        let pursueX = clamp(state.ball.x + state.ball.vx * leadT, 0.05, 0.95);
        let pursueY = clamp(state.ball.y + state.ball.vy * leadT, 0.06, 0.94);

        if (i === primaryPresserIdx && coverShadowOutlet) {
          // Curve pursuit into the passing lane between carrier and safest outlet (Cover Shadow)
          const shadowBias = pressTriggered ? 0.24 : 0.16;
          pursueX = clamp(lerp(pursueX, coverShadowOutlet.x, shadowBias), 0.05, 0.95);
          pursueY = clamp(lerp(pursueY, coverShadowOutlet.y, shadowBias), 0.06, 0.94);
        } else if (i !== primaryPresserIdx && coverShadowOutlet && pressTriggered) {
          // Secondary presser screens the outlet lane closely to force long ball or turnover
          pursueX = clamp(lerp(pursueX, coverShadowOutlet.x, 0.42), 0.05, 0.95);
          pursueY = clamp(lerp(pursueY, coverShadowOutlet.y, 0.42), 0.06, 0.94);
        }

        applyAgentSteering({
          agent,
          targetX: pursueX,
          targetY: pursueY,
          sprintDemand: pressTriggered ? 1.0 : 0.92,
          teammates: agents,
          doctrine,
          dt: effDt,
        });
        continue;
      }

      // Base 3-phase formation anchor
      const anchor = computeDynamicFormationTarget({
        slotIndex: i,
        base: base[i],
        isHome,
        mode,
        ball: { x: state.ball.x, y: state.ball.y },
        doctrine,
        profile: agent.profile,
        territorialShiftX,
        simTime: state.simTime,
      });

      let targetX = anchor.x;
      let targetY = anchor.y;
      let sprintDemand = mode === 'transition_attack' || mode === 'transition_defend' ? 0.85 : 0.56;

      if (i === 0) {
        agent.roleAction = 'keeper';
      } else if (hasBall && carrier) {
        agent.roleAction = 'support';
        // Staggered Pitch Control Support Spot re-evaluation (~3.5 times/sec per player)
        const tickIdx = Math.floor(state.simTime * 60);
        if ((tickIdx + i * 3) % 16 === 0) {
          const bestSpot = pickBestSupportSpot({
            agent,
            anchor,
            carrier,
            teammates: agents,
            defenders: oppAgents,
            atkDoctrine: doctrine,
            defDoctrine: oppDoctrine,
            oppBacklineX,
          });
          targetX = bestSpot.x;
          targetY = bestSpot.y;
        } else {
          // Keep blending smoothly toward previously evaluated spot + anchor drift
          targetX = lerp(agent.targetX, anchor.x, 0.14);
          targetY = lerp(agent.targetY, anchor.y, 0.14);
        }
        // Highlight penetrating line_breaker runs subtly
        if (
          agent.profile.runBehindBias > 0.78 &&
          Math.hypot(targetX - agent.x, targetY - agent.y) > 0.10 &&
          (isHome ? targetX > oppBacklineX - 0.02 : targetX < oppBacklineX + 0.02)
        ) {
          sprintDemand = 0.95;
          state.runIndicators.push({
            from: { x: agent.x, y: agent.y },
            to: { x: targetX, y: targetY },
            color: '#38bdf8',
            alpha: 0.45,
            isThirdMan: false,
          });
        }
      } else {
        agent.roleAction = agent.profile.subPosition === 'CB' ? 'mark' : 'cover';
        // Defensive Architect & Stopper CB maintain flat defensive backline alignment
        if (agent.profile.subPosition === 'CB' && doctrine.lineDiscipline > 0.62) {
          const lineX = anchor.x;
          targetX = lerp(targetX, lineX, doctrine.lineDiscipline * 0.45);
        }
      }

      applyAgentSteering({
        agent,
        targetX,
        targetY,
        sprintDemand,
        teammates: agents,
        doctrine,
        dt: effDt,
      });
    }
  };

  updateTeamAgents(true);
  updateTeamAgents(false);

  // Sync live 2D possession / shots / SOT / saves / xG with pitch state
  updateLiveMetrics(state, effDt, false);

  // Check half completion (only when no active Director highlight is still playing)
  if (state.matchMinuteFloat >= state.endMinute && !state.director) {
    // Make sure any remaining event right at endMinute was handled
    const remainingHighlight = state.scheduledEvents.find(
      ({ key, event }) =>
        !state.handledEventKeys.has(key) &&
        (event.type === 'goal' ||
          event.type === 'save' ||
          event.type === 'chance' ||
          event.type === 'var_offside') &&
        event.minute >= state.startMinute &&
        event.minute <= state.endMinute,
    );
    if (remainingHighlight) {
      activateDirectorCue(state, remainingHighlight);
    } else {
      updateLiveMetrics(state, 0, true);
      state.completed = true;
    }
  }
}

/**
 * Helper to detect championship final match theme from competition metadata.
 */
export function resolvePitchFinalTheme(params: {
  competition?: 'league' | 'cup' | 'ucl';
  competitionLabel?: string;
  explicitFinal?: boolean;
}): 'none' | 'cup_final' | 'ucl_final' {
  const { competition, competitionLabel = '', explicitFinal = false } = params;
  const labelIsFinal =
    competitionLabel.includes('결승') && !competitionLabel.includes('준결승');
  const isFinal = explicitFinal || labelIsFinal;
  if (!isFinal) return 'none';
  if (competition === 'ucl' || competitionLabel.toUpperCase().includes('UCL') || competitionLabel.includes('챔피언스')) {
    return 'ucl_final';
  }
  return 'cup_final';
}
