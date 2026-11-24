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
  FormationPhaseMode,
  PitchSimInitConfig,
  PitchSimState,
  PitchSimTeamInput,
  PlayerAgentState,
  SimVec2,
  TeamTacticalDoctrine,
} from './pitchSimTypes';
import {
  buildBaseFormationCoords,
  buildTeamAgentProfiles,
  buildTeamTacticalDoctrine,
  computeAgentLiveStamina,
  computeDynamicFormationTarget,
  getStaminaKinematicFactor,
} from './pitchTacticalParams';

export const FIXED_DT = 1 / 60;
export const MAX_FRAME_DELTA = 0.05;
/** A-Option: 1.20 sim seconds per match minute -> 1x ~2m05s (90m), 2x ~1m02s, 4x ~31s */
export const SIM_SECONDS_PER_MATCH_MINUTE = 1.2;

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
    (0.76 + 0.34 * sprintDemand);
  const maxAccel =
    agent.profile.baseMaxAccel *
    stamFactor *
    freshMult *
    (0.80 + 0.30 * sprintDemand);

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
      ? clamp(dist * 1.45, 0.45, 1.15)
      : flightType === 'cross'
        ? clamp(dist * 1.5, 0.45, 1.05)
        : flightType === 'shot'
          ? 0.24
          : 0);

  const ball = state.ball;
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
 * Finds the best matching slot index (0..10) on a team for a MatchEvent scorer/assister/defender.
 */
function findAgentSlotByIdentity(
  agents: PlayerAgentState[],
  playerId?: string,
  playerName?: string,
  fallbackPool: number[] = [8, 9, 10],
  rngVal = 0.5,
): number {
  if (playerId) {
    const exact = agents.find((a) => a.profile.playerId === playerId);
    if (exact) return exact.slotIndex;
  }
  if (playerName) {
    const byName = agents.find((a) => a.profile.name === playerName);
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

  const homeDoctrine = buildTeamTacticalDoctrine({
    my: config.home,
    opp: config.away,
    minute: config.startMinute,
    scoreDiff: config.homeGoalsSoFar - config.awayGoalsSoFar,
    isBigMatch: Boolean(config.isBigMatch),
  });
  const awayDoctrine = buildTeamTacticalDoctrine({
    my: config.away,
    opp: config.home,
    minute: config.startMinute,
    scoreDiff: config.awayGoalsSoFar - config.homeGoalsSoFar,
    isBigMatch: Boolean(config.isBigMatch),
  });

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
    homeXgTarget: config.homeXgTarget,
    awayXgTarget: config.awayXgTarget,
    homeGoalsLive: config.homeGoalsSoFar,
    awayGoalsLive: config.awayGoalsSoFar,
    isBigMatch: Boolean(config.isBigMatch),
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
    },
  };

  return state;
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
    homeXgTarget: number;
    awayXgTarget: number;
    events: { key: string; event: MatchEvent }[];
  },
) {
  const curMin = state.matchMinuteFloat;
  state.targetHomePossession = clamp(params.targetHomePossession, 31, 69);
  state.homeShotsTarget = params.homeShotsTarget;
  state.awayShotsTarget = params.awayShotsTarget;
  state.homeXgTarget = params.homeXgTarget;
  state.awayXgTarget = params.awayXgTarget;
  state.scheduledEvents = [...params.events];

  state.homeDoctrine = buildTeamTacticalDoctrine({
    my: params.home,
    opp: params.away,
    minute: curMin,
    scoreDiff: state.homeGoalsLive - state.awayGoalsLive,
    isBigMatch: state.isBigMatch,
  });
  state.awayDoctrine = buildTeamTacticalDoctrine({
    my: params.away,
    opp: params.home,
    minute: curMin,
    scoreDiff: state.awayGoalsLive - state.homeGoalsLive,
    isBigMatch: state.isBigMatch,
  });

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
  const triggerProb = clamp(
    0.04 + atkDoctrine.thirdManFreq * 0.44 + pasNorm * 0.10,
    0.06,
    0.60,
  );
  if (nextSimRng(state) > triggerProb) return false;

  // Don't trigger from inside own 6-yard box
  const carrierDepth = carrier.isHome ? carrier.x : 1 - carrier.x;
  if (carrierDepth < 0.22 || carrierDepth > 0.80) return false;

  // 1) Pick wall/link player B (midfielder, CAM, or complete_forward ahead of or lateral to A)
  let bestB: PlayerAgentState | null = null;
  let bestBScore = 0.35;
  for (let i = 1; i < teammates.length; i += 1) {
    if (i === carrier.slotIndex) continue;
    const b = teammates[i];
    const dist = Math.hypot(b.x - carrier.x, b.y - carrier.y);
    if (dist < 0.09 || dist > 0.34) continue;
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
    const leadX = clamp(
      runner.x + runner.vx * 0.55 + dir * 0.035,
      0.08,
      0.92,
    );
    const leadY = clamp(runner.y + runner.vy * 0.55, 0.08, 0.92);
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

  // 4) Consider Dribble/Carry forward if open space & strong DRI
  const aheadSpot: SimVec2 = {
    x: clamp(carrier.x + dir * 0.095, 0.07, 0.93),
    y: clamp(
      carrier.y +
        (carrier.profile.cutInsideBias > 0.6 ? (carrier.y < 0.5 ? 0.055 : -0.055) : 0),
      0.08,
      0.92,
    ),
  };
  const aheadSpace = evaluateSpotClearance(aheadSpot, defenders);
  const dribbleScore =
    carrierIdx === 0
      ? -1
      : carrier.profile.dribbleBias * 0.55 +
        aheadSpace * 0.45 +
        (carrier.profile.isStar ? atkDoctrine.starFocus * 0.20 : 0) -
        (underHeavyPress ? 0.22 : 0) -
        (carrierDepth > 0.80 ? 0.25 : 0);

  if (dribbleScore > 0.72 && nextSimRng(state) < 0.34) {
    carrier.targetX = aheadSpot.x;
    carrier.targetY = aheadSpot.y;
    state.carrierHoldTimer = 0;
    state.carrierDecisionDelay = clamp(0.62 / atkDoctrine.tempo, 0.35, 0.85);
    state.stats.dribbles += 1;
    if (carrierDepth > 0.62) {
      state.tacticalLabel = '하프스페이스 침투';
      state.tacticalLabelTeamIsHome = isHome;
    }
    return;
  }

  // 5) Evaluate every teammate passing option (including Recycling & Diagonal Switch!)
  type PassCandidate = {
    idx: number;
    score: number;
    flightType: BallFlightType;
    destX: number;
    destY: number;
    isRecycle: boolean;
    isSwitch: boolean;
    laneSafety: number;
  };

  const options: PassCandidate[] = [];
  const pasNorm = clamp((carrier.profile.attrs.pas - 58) / 40, 0, 1);
  const croNorm = clamp((carrier.profile.attrs.cro - 58) / 40, 0, 1);
  const kicNorm = clamp(((carrier.profile.attrs.gk?.kic ?? 74) - 58) / 40, 0, 1);

  let maxForwardSafety = 0;

  for (let i = 0; i < teammates.length; i += 1) {
    if (i === carrierIdx) continue;
    // Only pass back to GK if GK buildup support or under heavy pressure in own half
    if (
      i === 0 &&
      (carrierDepth > 0.46 ||
        (atkDoctrine.gkBuildupSupport < 0.35 && !underHeavyPress))
    ) {
      continue;
    }

    const mate = teammates[i];
    const dist = Math.hypot(mate.x - carrier.x, mate.y - carrier.y);
    if (dist < 0.055) continue;

    const forwardDelta = (mate.x - carrier.x) * dir;
    const lateralDelta = Math.abs(mate.y - carrier.y);
    const isSwitch = lateralDelta > 0.34 && dist > 0.30;
    const isThrough =
      forwardDelta > 0.13 &&
      mate.profile.runBehindBias > 0.55 &&
      (isHome ? mate.x : 1 - mate.x) > 0.54;
    const isRecycle = forwardDelta <= 0.025;

    const flightType: BallFlightType = isSwitch
      ? 'long_switch'
      : isThrough
        ? 'through_ball'
        : 'ground_pass';

    // Predictive lead position for through balls / moving receivers
    const leadScale = isThrough ? 0.42 : 0.16;
    const destX = clamp(
      mate.x + mate.vx * leadScale + (isThrough ? dir * 0.032 : 0),
      0.05,
      0.95,
    );
    const destY = clamp(mate.y + mate.vy * leadScale, 0.05, 0.95);

    const laneSafety = evaluatePassLaneSafety(
      { x: carrier.x, y: carrier.y },
      { x: destX, y: destY },
      defenders,
      defDoctrine,
      isSwitch,
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
        : 0.28 + pasNorm * 0.28 + (isSwitch ? croNorm * 0.14 : 0);
    const rangePen = dist > visionRange ? (dist - visionRange) * 1.9 : 0;

    let utility =
      laneSafety * 0.72 +
      spaceFree * 0.38 +
      synBonus +
      starBonus -
      rangePen;

    // Progression vs Patient Recycling balance
    if (forwardDelta > 0.03) {
      const progReward =
        forwardDelta *
        (1.15 + atkDoctrine.passLengthBias * 0.55 + (state.transitionTimer > 0 ? 0.75 : 0));
      utility += progReward;
      if (isThrough) {
        utility +=
          pasNorm * 0.32 +
          atkDoctrine.counterSprintUrgency * 0.26 +
          mate.profile.runBehindBias * 0.24;
      }
      // If forward lane is blocked, strongly discourage forcing through defenders!
      if (laneSafety < 0.45) {
        utility -= (0.45 - laneSafety) * (0.9 + atkDoctrine.buildUpPatience * 0.85);
      }
    } else {
      // Back-pass / lateral recycling: high-patience possession teams recycle eagerly, direct/counter teams avoid backward passes unless pressed
      utility += (atkDoctrine.buildUpPatience - 0.35) * 0.72;
      if (underHeavyPress) utility += 0.28;
      if (mate.profile.dropToLinkBias > 0.65) utility += 0.16;
      if (state.recycleCount >= 4) utility -= 0.28; // eventually progress after patient recycling
    }

    // Diagonal switch bonus for wingplay / wing_bomber / deep_playmaker / ball_playing_cb
    if (isSwitch) {
      utility +=
        carrier.profile.longSwitchBias * 0.36 +
        atkDoctrine.flankBias * 0.32 +
        (state.recycleCount >= 1 ? 0.18 : 0);
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
      laneSafety,
    });
  }

  options.sort((a, b) => b.score - a.score);

  // If all forward lanes are tight & team has patience, favor safe recycling option explicitly
  let chosen = options[0];
  if (
    chosen &&
    !chosen.isRecycle &&
    maxForwardSafety < 0.44 &&
    atkDoctrine.buildUpPatience > 0.55 &&
    state.recycleCount < 4
  ) {
    const safeRecycle = options.find((o) => (o.isRecycle || o.isSwitch) && o.laneSafety > 0.58);
    if (safeRecycle) {
      chosen = safeRecycle;
    }
  }

  if (!chosen) return;

  // Update recycling counter & tactical phase badge
  if (chosen.isSwitch) {
    state.stats.switches += 1;
    state.recycleCount = Math.max(0, state.recycleCount - 1);
    state.tacticalLabel = '측면 전환';
  } else if (chosen.isRecycle) {
    state.recycleCount += 1;
    state.stats.recycles += 1;
    state.tacticalLabel = carrierDepth < 0.38 ? '후방 빌드업' : '볼 순환';
  } else {
    state.recycleCount = 0;
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
    // Nearest defender to pass segment steps in to intercept cleanly
    let bestDef = defenders[5] ?? defenders[2];
    let bestDist = 999;
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
      }
    }
    if (bestDef && bestDist < 0.22) {
      passDestX = lerp(bestDef.x, (carrier.x + chosen.destX) * 0.5, 0.35);
      passDestY = lerp(bestDef.y, (carrier.y + chosen.destY) * 0.5, 0.35);
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
 * Initiates a DirectorCueState cleanly ahead of an upcoming matchEngine highlight event.
 * Never teleports players — transitions smoothly via normal Steering + ball passes!
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

  const scorerIdx = findAgentSlotByIdentity(
    atkAgents,
    ev.scorerId,
    ev.scorerName,
    [8, 9, 10],
    nextSimRng(state),
  );
  let assisterIdx = findAgentSlotByIdentity(
    atkAgents,
    ev.assistId,
    ev.assistName,
    [5, 6, 7, 8],
    nextSimRng(state),
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

  state.thirdMan = null;
  state.handledEventKeys.add(entry.key);

  state.director = {
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
    stageDuration: isSetPiece ? 1.05 : 0.85,
    shotOrigin: { x: atkX(isHomeAttack, 0.84), y: targetY },
    shotControl: { x: atkX(isHomeAttack, 0.90), y: targetY },
    shotEnd: { x: atkX(isHomeAttack, 0.985), y: targetY },
    revealed: false,
    varOffsideLineX: atkX(isHomeAttack, 0.83),
    routeSubStep: 0,
    reboundTriggered: false,
  };

  state.tacticalLabel = isSetPiece
    ? '세트피스'
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
 */
function stepDirectorCue(state: PitchSimState, dt: number) {
  const dirCue = state.director;
  if (!dirCue) return;

  dirCue.stageTimer += dt;
  const isH = dirCue.isHomeAttack;
  const fl = dirCue.flankSide;
  const atkAgents = isH ? state.homeAgents : state.awayAgents;
  const defAgents = isH ? state.awayAgents : state.homeAgents;
  const scorer = atkAgents[dirCue.scorerIdx];
  const assister = atkAgents[dirCue.assisterIdx];
  const defender = defAgents[dirCue.defenderIdx];
  const defGk = defAgents[0];

  const flankY = fl < 0 ? 0.12 : 0.88;
  const halfSpaceY = fl < 0 ? 0.28 : 0.72;

  // Compute route-specific anchor positions for smooth steering (NO instant teleport!)
  let passerDest: SimVec2 = { x: atkX(isH, 0.66), y: halfSpaceY };
  let scorerDest: SimVec2 = { x: atkX(isH, 0.84), y: dirCue.targetY };
  let passFlightType: BallFlightType = 'through_ball';

  if (dirCue.pattern === 'corner_kick') {
    passerDest = { x: atkX(isH, 0.97), y: fl < 0 ? 0.05 : 0.95 };
    scorerDest = { x: atkX(isH, 0.89), y: dirCue.targetY };
    passFlightType = 'cross';
  } else if (dirCue.pattern === 'direct_free_kick') {
    passerDest = { x: atkX(isH, 0.74), y: fl < 0 ? 0.37 : 0.63 };
    scorerDest = { x: atkX(isH, 0.755), y: fl < 0 ? 0.37 : 0.63 };
  } else if (dirCue.pattern === 'penalty_kick') {
    passerDest = { x: atkX(isH, 0.855), y: 0.50 };
    scorerDest = { x: atkX(isH, 0.885), y: 0.50 };
  } else if (dirCue.attackRoute === 'early_cross') {
    passerDest = { x: atkX(isH, 0.82), y: flankY };
    scorerDest = { x: atkX(isH, 0.89), y: dirCue.targetY };
    passFlightType = 'cross';
  } else if (dirCue.attackRoute === 'cutback') {
    passerDest = { x: atkX(isH, 0.945), y: fl < 0 ? 0.18 : 0.82 };
    scorerDest = { x: atkX(isH, 0.855), y: 0.50 + fl * 0.04 };
    passFlightType = 'ground_pass';
  } else if (dirCue.attackRoute === 'solo_dribble') {
    passerDest = { x: atkX(isH, 0.55), y: halfSpaceY };
    scorerDest = { x: atkX(isH, 0.86), y: fl < 0 ? 0.42 : 0.58 };
    passFlightType = 'ground_pass';
  } else if (dirCue.attackRoute === 'cut_inside_curler') {
    passerDest = { x: atkX(isH, 0.62), y: flankY };
    scorerDest = { x: atkX(isH, 0.79), y: halfSpaceY };
    passFlightType = 'ground_pass';
  } else if (dirCue.attackRoute === 'long_range_cannon') {
    passerDest = { x: atkX(isH, 0.78), y: halfSpaceY };
    scorerDest = { x: atkX(isH, 0.70), y: 0.50 + fl * 0.06 };
    passFlightType = 'ground_pass';
  } else if (dirCue.attackRoute === 'u_buildup_switch') {
    passerDest = { x: atkX(isH, 0.52), y: fl < 0 ? 0.72 : 0.28 };
    scorerDest = { x: atkX(isH, 0.83), y: fl < 0 ? 0.24 : 0.76 };
    passFlightType = 'long_switch';
  } else if (dirCue.attackRoute === 'low_block_counter') {
    passerDest = { x: atkX(isH, 0.42), y: 0.50 };
    scorerDest = { x: atkX(isH, 0.855), y: dirCue.targetY };
    passFlightType = 'long_switch';
  } else if (dirCue.attackRoute === 'tiki_taka_triangle') {
    passerDest = { x: atkX(isH, 0.73), y: halfSpaceY };
    scorerDest = { x: atkX(isH, 0.845), y: 0.50 + fl * 0.03 };
    passFlightType = 'through_ball';
  } else {
    passerDest = { x: atkX(isH, 0.62), y: 0.50 + fl * 0.08 };
    scorerDest = { x: atkX(isH, 0.85), y: dirCue.targetY };
    passFlightType = 'through_ball';
  }

  // Guide key actors smoothly via Steering
  if (dirCue.stage === 'set_piece_setup') {
    state.possessionIsHome = isH;
    state.ball.ownerTeamIsHome = isH;
    const taker =
      dirCue.pattern === 'corner_kick' ? assister : scorer;
    state.ball.ownerIdx = taker.slotIndex;
    state.ball.flightType = 'carry';
    state.ball.z = 0;

    // Steer kicker & box players cleanly into set-piece positions
    const spot = dirCue.pattern === 'corner_kick' ? passerDest : scorerDest;
    applyAgentSteering({
      agent: taker,
      targetX: spot.x,
      targetY: spot.y,
      sprintDemand: 0.95,
      teammates: atkAgents,
      doctrine: isH ? state.homeDoctrine : state.awayDoctrine,
      dt,
      skipSeparation: true,
    });
    state.ball.x = lerp(state.ball.x, spot.x, clamp(dt * 8, 0, 1));
    state.ball.y = lerp(state.ball.y, spot.y, clamp(dt * 8, 0, 1));

    if (dirCue.pattern === 'corner_kick') {
      applyAgentSteering({
        agent: scorer,
        targetX: atkX(isH, 0.86),
        targetY: dirCue.targetY,
        sprintDemand: 0.85,
        teammates: atkAgents,
        doctrine: isH ? state.homeDoctrine : state.awayDoctrine,
        dt,
      });
    } else if (dirCue.pattern === 'direct_free_kick') {
      // 4-man wall cleanly lines up
      const wallX = atkX(isH, 0.835);
      const wallY = lerp(spot.y, 0.5, 0.35);
      const wallIds = [4, 5, 6, 7];
      wallIds.forEach((wIdx, k) => {
        applyAgentSteering({
          agent: defAgents[wIdx],
          targetX: wallX,
          targetY: wallY + (k - 1.5) * 0.032,
          sprintDemand: 0.9,
          teammates: defAgents,
          doctrine: isH ? state.awayDoctrine : state.homeDoctrine,
          dt,
          skipSeparation: true,
        });
      });
    } else if (dirCue.pattern === 'penalty_kick') {
      // Everyone else steps outside the penalty arc
      for (let k = 1; k < 11; k += 1) {
        if (k !== scorer.slotIndex) {
          applyAgentSteering({
            agent: atkAgents[k],
            targetX: atkX(isH, 0.785 - (k % 3) * 0.02),
            targetY: 0.24 + ((k * 7) % 10) * 0.055,
            sprintDemand: 0.85,
            teammates: atkAgents,
            doctrine: isH ? state.homeDoctrine : state.awayDoctrine,
            dt,
          });
        }
        applyAgentSteering({
          agent: defAgents[k],
          targetX: atkX(isH, 0.795 - (k % 2) * 0.02),
          targetY: 0.22 + ((k * 5) % 10) * 0.058,
          sprintDemand: 0.85,
          teammates: defAgents,
          doctrine: isH ? state.awayDoctrine : state.homeDoctrine,
          dt,
        });
      }
      applyAgentSteering({
        agent: defGk,
        targetX: atkX(isH, 0.96),
        targetY: 0.5,
        sprintDemand: 0.9,
        teammates: defAgents,
        doctrine: isH ? state.awayDoctrine : state.homeDoctrine,
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
          : 0.92;
      dirCue.routeSubStep = 0;
    }
    return;
  }

  if (dirCue.stage === 'approach') {
    // Smoothly channel possession to attacking team & assister/scorer via genuine pass
    const receiverIdx =
      dirCue.attackRoute === 'solo_dribble' ? dirCue.scorerIdx : dirCue.assisterIdx;
    const receiver = atkAgents[receiverIdx];

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
        toX: lerp(receiver.x, passerDest.x, 0.55),
        toY: lerp(receiver.y, passerDest.y, 0.55),
        targetTeamIsHome: isH,
        targetIdx: receiverIdx,
        passerIsHome: isH,
        passerIdx: state.ball.ownerIdx ?? 5,
        speedOverride: 0.46,
      });
    }

    applyAgentSteering({
      agent: assister,
      targetX: passerDest.x,
      targetY: passerDest.y,
      sprintDemand: 0.95,
      teammates: atkAgents,
      doctrine: isH ? state.homeDoctrine : state.awayDoctrine,
      dt,
    });
    applyAgentSteering({
      agent: scorer,
      targetX: lerp(scorer.x, scorerDest.x, 0.55),
      targetY: lerp(scorer.y, scorerDest.y, 0.55),
      sprintDemand: 0.92,
      teammates: atkAgents,
      doctrine: isH ? state.homeDoctrine : state.awayDoctrine,
      dt,
    });

    if (
      dirCue.stageTimer >= dirCue.stageDuration ||
      (state.ball.ownerTeamIsHome === isH && state.ball.ownerIdx === receiverIdx)
    ) {
      dirCue.stage = 'execute_route';
      dirCue.stageTimer = 0;
      dirCue.stageDuration =
        dirCue.attackRoute === 'solo_dribble'
          ? 1.15
          : dirCue.pattern === 'rebound_finish'
            ? 1.25
            : 1.0;
      dirCue.routeSubStep = 0;
    }
    return;
  }

  if (dirCue.stage === 'execute_route') {
    // 1) Direct FK & PK: brief run-up then fire shot
    if (dirCue.pattern === 'penalty_kick' || dirCue.pattern === 'direct_free_kick') {
      applyAgentSteering({
        agent: scorer,
        targetX: scorerDest.x,
        targetY: scorerDest.y,
        sprintDemand: 0.85,
        teammates: atkAgents,
        doctrine: isH ? state.homeDoctrine : state.awayDoctrine,
        dt,
        skipSeparation: true,
      });
      if (dirCue.stageTimer >= dirCue.stageDuration) {
        triggerDirectorShot(state, dirCue, scorer);
      }
      return;
    }

    // 2) Solo dribble: scorer weaves smoothly past defender
    if (dirCue.attackRoute === 'solo_dribble') {
      const prog = clamp(dirCue.stageTimer / dirCue.stageDuration, 0, 1);
      const zig = Math.sin(prog * Math.PI * 2.5) * 0.055 * fl;
      applyAgentSteering({
        agent: scorer,
        targetX: scorerDest.x,
        targetY: clamp(scorerDest.y + zig, 0.12, 0.88),
        sprintDemand: 1.0,
        teammates: atkAgents,
        doctrine: isH ? state.homeDoctrine : state.awayDoctrine,
        dt,
        skipSeparation: true,
      });
      if (defender) {
        applyAgentSteering({
          agent: defender,
          targetX: scorer.x + (isH ? -0.025 : 0.025),
          targetY: scorer.y + fl * 0.05,
          sprintDemand: 0.78,
          teammates: defAgents,
          doctrine: isH ? state.awayDoctrine : state.homeDoctrine,
          dt,
        });
      }
      if (dirCue.stageTimer >= dirCue.stageDuration) {
        triggerDirectorShot(state, dirCue, scorer);
      }
      return;
    }

    // 3) Rebound finish: 1st shot parried/post/blocked -> loose ball to scorer
    if (dirCue.pattern === 'rebound_finish') {
      if (dirCue.routeSubStep === 0) {
        dirCue.routeSubStep = 1;
        const deflectSpot: SimVec2 =
          dirCue.reboundOrigin === 'woodwork'
            ? { x: atkX(isH, 0.975), y: fl < 0 ? 0.42 : 0.58 }
            : dirCue.reboundOrigin === 'blocked'
              ? { x: atkX(isH, 0.865), y: 0.50 + fl * 0.05 }
              : { x: atkX(isH, 0.94), y: 0.50 + fl * 0.04 };
        launchBallFlight({
          state,
          flightType: 'shot',
          fromX: assister.x,
          fromY: assister.y,
          toX: deflectSpot.x,
          toY: deflectSpot.y,
          targetTeamIsHome: null,
          targetIdx: null,
          passerIsHome: isH,
          passerIdx: assister.slotIndex,
          speedOverride: 0.56,
        });
      } else if (
        dirCue.routeSubStep === 1 &&
        state.ball.flightProgress >= 0.96
      ) {
        dirCue.routeSubStep = 2;
        state.impactRing = {
          x: state.ball.x,
          y: state.ball.y,
          alpha: 0.9,
          color:
            dirCue.reboundOrigin === 'woodwork'
              ? '#fb923c'
              : dirCue.reboundOrigin === 'blocked'
                ? '#fbbf24'
                : '#38bdf8',
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
          passerIdx: 0,
          speedOverride: 0.34,
          maxArcZ: 0.42,
        });
      }

      applyAgentSteering({
        agent: scorer,
        targetX: scorerDest.x,
        targetY: scorerDest.y,
        sprintDemand: 1.0,
        teammates: atkAgents,
        doctrine: isH ? state.homeDoctrine : state.awayDoctrine,
        dt,
        skipSeparation: true,
      });

      if (
        dirCue.routeSubStep === 2 &&
        (state.ball.ownerIdx === scorer.slotIndex ||
          dirCue.stageTimer >= dirCue.stageDuration)
      ) {
        triggerDirectorShot(state, dirCue, scorer);
      }
      return;
    }

    // 4) Standard assisted routes (cross, cutback, through_ball, tiki_taka_triangle, switch, counter, cannon)
    if (dirCue.routeSubStep === 0) {
      dirCue.routeSubStep = 1;
      const ctrl: SimVec2 =
        passFlightType === 'cross'
          ? { x: atkX(isH, 0.87), y: lerp(assister.y, scorerDest.y, 0.45) }
          : passFlightType === 'long_switch'
            ? { x: (assister.x + scorerDest.x) * 0.5, y: 0.5 }
            : { x: (assister.x + scorerDest.x) * 0.5, y: (assister.y + scorerDest.y) * 0.5 };
      launchBallFlight({
        state,
        flightType: passFlightType,
        fromX: assister.x,
        fromY: assister.y,
        toX: scorerDest.x,
        toY: scorerDest.y,
        ctrlX: ctrl.x,
        ctrlY: ctrl.y,
        targetTeamIsHome: isH,
        targetIdx: scorer.slotIndex,
        passerIsHome: isH,
        passerIdx: assister.slotIndex,
        speedOverride: passFlightType === 'cross' ? 0.42 : 0.46,
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

    applyAgentSteering({
      agent: scorer,
      targetX: scorerDest.x,
      targetY: scorerDest.y,
      sprintDemand: 1.0,
      teammates: atkAgents,
      doctrine: isH ? state.homeDoctrine : state.awayDoctrine,
      dt,
      skipSeparation: true,
    });
    if (defender) {
      applyAgentSteering({
        agent: defender,
        targetX: lerp(defender.x, scorerDest.x + (isH ? 0.025 : -0.025), 0.7),
        targetY: lerp(defender.y, scorerDest.y + fl * 0.03, 0.7),
        sprintDemand: 0.92,
        teammates: defAgents,
        doctrine: isH ? state.awayDoctrine : state.homeDoctrine,
        dt,
      });
    }

    const arrivedAtScorer =
      state.ball.ownerTeamIsHome === isH && state.ball.ownerIdx === scorer.slotIndex;
    if (arrivedAtScorer || dirCue.stageTimer >= dirCue.stageDuration) {
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
      doctrine: isH ? state.awayDoctrine : state.homeDoctrine,
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
        doctrine: isH ? state.awayDoctrine : state.homeDoctrine,
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
        state.goalRipple = { side: isH ? 'right' : 'left', intensity: 1.0 };
        state.pitchFlashAlpha = 0.22;
        state.ball.x = atkX(isH, 0.996);
        state.ball.y = dirCue.targetY;
        state.ball.z = 0;
        state.ball.ownerTeamIsHome = null;
        state.ball.ownerIdx = null;
      } else if (dirCue.outcome === 'var_offside') {
        state.goalRipple = { side: isH ? 'right' : 'left', intensity: 0.75 };
        state.ball.x = atkX(isH, 0.994);
        state.ball.y = dirCue.targetY;
      } else if (dirCue.outcome === 'save') {
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
        state.ball.x = 0.5;
        state.ball.y = 0.5;
        state.ball.z = 0;
        state.ball.prevX = 0.5;
        state.ball.prevY = 0.5;
        state.ball.prevZ = 0;
        state.ball.flightType = 'carry';
        state.ball.ownerTeamIsHome = restartHome;
        state.ball.ownerIdx = mid.slotIndex;
        state.ball.trail = [];
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
  const origin: SimVec2 = { x: scorer.x, y: scorer.y };
  const endX =
    dirCue.outcome === 'blocked'
      ? atkX(isH, 0.885)
      : dirCue.outcome === 'save'
        ? atkX(isH, 0.95)
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

  const arcZ =
    dirCue.pattern === 'direct_free_kick' ||
    dirCue.attackRoute === 'long_range_cannon' ||
    dirCue.pattern === 'cut_inside_curler'
      ? 0.78
      : dirCue.pattern === 'wing_cross_header' || dirCue.pattern === 'corner_kick'
        ? 0.45
        : 0.22;

  dirCue.shotOrigin = origin;
  dirCue.shotControl = ctrl;
  dirCue.shotEnd = end;
  dirCue.stage = 'shot_flight';
  dirCue.stageTimer = 0;
  dirCue.stageDuration = 0.88;
  state.localPaceMult = 0.78; // Subtle suspenseful shot flight inside fixed-timestep!

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
    speedOverride: Math.max(0.24, Math.hypot(end.x - origin.x, end.y - origin.y) / 0.86),
    maxArcZ: arcZ,
    arcColor: '#fef08a',
  });
}

/**
 * Advances Ball physics by one fixed step.
 */
function stepBallPhysics(state: PitchSimState, dt: number) {
  const ball = state.ball;
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

      if (newTeam !== prevTeam) {
        // Turnover / interception!
        state.possessionIsHome = newTeam;
        state.recycleCount = 0;
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

      // Compute realistic first-touch hold time (scaled by tempo, DRI, and chemistry)
      const receiver = (newTeam ? state.homeAgents : state.awayAgents)[ball.ownerIdx];
      const doc = newTeam ? state.homeDoctrine : state.awayDoctrine;
      const driQuick = receiver ? clamp((receiver.profile.attrs.dri - 65) / 35, 0, 1) * 0.14 : 0;
      const synQuick =
        receiver && newTeam === prevTeam
          ? receiver.profile.synergyWithSlot[ball.lastTouchIdx] * 0.035
          : 0;
      state.carrierHoldTimer = 0;
      state.carrierDecisionDelay = clamp(
        (0.76 - driQuick - synQuick + (nextSimRng(state) - 0.5) * 0.22) / doc.tempo,
        0.34,
        1.08,
      );
    }
  }

  // Record restrained ball trail
  ball.trail.push({ x: ball.x, y: ball.y, z: ball.z, flightType: ball.flightType });
  const maxTrail = state.director?.stage === 'shot_flight' ? 14 : 9;
  while (ball.trail.length > maxTrail) {
    ball.trail.shift();
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

  // Periodically refresh live player stamina every integer match minute
  const intMin = Math.floor(state.matchMinuteFloat);
  if (intMin > state.lastStaminaSyncMinute) {
    state.lastStaminaSyncMinute = intMin;
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

  // Trigger upcoming matchEngine highlight smoothly ~1.25 minutes ahead (zero teleport!)
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

  // Update transition window
  if (state.transitionTimer > 0) {
    state.transitionTimer = Math.max(0, state.transitionTimer - effDt);
    if (state.transitionTimer === 0) state.transitionTeamIsHome = null;
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

    if (closestDef && closestDefDist < 0.036 && carrier.slotIndex !== 0 && state.carrierHoldTimer > 0.28) {
      const targetPoss = carrierIsHome
        ? state.targetHomePossession / 100
        : 1 - state.targetHomePossession / 100;
      const defSkill = (closestDef.profile.attrs.def + closestDef.profile.attrs.phy) * 0.5;
      const atkSkill = (carrier.profile.attrs.dri + carrier.profile.attrs.phy) * 0.5;
      const stealProbPerSec = clamp(
        0.55 +
          (defSkill - atkSkill) * 0.015 +
          defDoc.zonePressEdge * 0.25 -
          atkDoc.composure * 0.22 +
          (0.55 - targetPoss) * 0.45,
        0.15,
        1.45,
      );
      if (nextSimRng(state) < stealProbPerSec * effDt) {
        state.ball.ownerTeamIsHome = !carrierIsHome;
        state.ball.ownerIdx = closestDef.slotIndex;
        state.ball.lastTouchTeamIsHome = !carrierIsHome;
        state.ball.lastTouchIdx = closestDef.slotIndex;
        state.possessionIsHome = !carrierIsHome;
        state.carrierHoldTimer = 0;
        state.carrierDecisionDelay = 0.48 / defDoc.tempo;
        state.recycleCount = 0;
        state.thirdMan = null;
        state.transitionTimer = 3.2;
        state.transitionTeamIsHome = !carrierIsHome;
        state.tacticalLabel =
          defDoc.tactic === 'gegenpressing' || defDoc.managerTraitId === 'gegenpress_guru'
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

    // Identify defending pressers (1..3 nearest / highest pressEagerness within pressTriggerRadius)
    const presserIndices = new Set<number>();
    if (!hasBall && !state.director) {
      const pressScores: { idx: number; score: number }[] = [];
      for (let i = 1; i < 11; i += 1) {
        const d = Math.hypot(agents[i].x - state.ball.x, agents[i].y - state.ball.y);
        if (d <= doctrine.pressTriggerRadius) {
          const score =
            (doctrine.pressTriggerRadius - d) * 3.0 +
            agents[i].profile.pressEagerness * 0.45 -
            (agents[i].profile.subPosition === 'CB' ? 0.35 : 0);
          pressScores.push({ idx: i, score });
        }
      }
      pressScores.sort((a, b) => b.score - a.score);
      for (let k = 0; k < Math.min(doctrine.pressersCount, pressScores.length); k += 1) {
        presserIndices.add(pressScores[k].idx);
      }
    }

    // Refresh Support Spot targets in staggered intervals (smooth, intelligent decisions)
    const carrier =
      hasBall && state.ball.ownerTeamIsHome === isHome && state.ball.ownerIdx !== null
        ? agents[state.ball.ownerIdx]
        : null;

    for (let i = 0; i < 11; i += 1) {
      const agent = agents[i];

      // Skip actors explicitly steered by Director during set-piece/shot execution
      if (
        state.director &&
        (state.director.stage === 'set_piece_setup' ||
          state.director.stage === 'execute_route' ||
          state.director.stage === 'shot_flight')
      ) {
        const isDirAtk = state.director.isHomeAttack === isHome;
        if (
          (isDirAtk &&
            (i === state.director.scorerIdx ||
              i === state.director.assisterIdx ||
              state.director.pattern === 'penalty_kick')) ||
          (!isDirAtk &&
            (i === 0 ||
              i === state.director.defenderIdx ||
              state.director.pattern === 'penalty_kick' ||
              (state.director.pattern === 'direct_free_kick' && i >= 4 && i <= 7)))
        ) {
          continue;
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

      // Defending presser pursues ball carrier with cover-shadow angle
      if (presserIndices.has(i)) {
        agent.roleAction = 'press';
        const leadT = 0.22;
        const pursueX = clamp(state.ball.x + state.ball.vx * leadT, 0.05, 0.95);
        const pursueY = clamp(state.ball.y + state.ball.vy * leadT, 0.06, 0.94);
        applyAgentSteering({
          agent,
          targetX: pursueX,
          targetY: pursueY,
          sprintDemand: 0.92,
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
