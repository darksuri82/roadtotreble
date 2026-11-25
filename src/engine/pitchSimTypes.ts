import type { ChemistryResult, FormationId, ManagerTraitId } from '../types/game';
import type {
  AttackRouteId,
  HighlightOutcomeType,
  HighlightPatternId,
  MatchEvent,
  ShotAngleType,
  TacticId,
} from '../types/league';
import type { Player, PlayerAttributes, PlaystyleId, SubPosition } from '../types/player';

export interface SimVec2 {
  x: number;
  y: number;
}

export type PitchFinalTheme = 'none' | 'cup_final' | 'ucl_final';

export type TacticalPhaseLabel =
  | '후방 빌드업'
  | '볼 순환'
  | '측면 전환'
  | '삼자 연계'
  | '하프스페이스 침투'
  | '전방 압박'
  | '역습 전환'
  | '세트피스';

export type FormationPhaseMode =
  | 'buildup'
  | 'progression'
  | 'defend'
  | 'transition_attack'
  | 'transition_defend';

export type BallFlightType =
  | 'carry'
  | 'ground_pass'
  | 'through_ball'
  | 'long_switch'
  | 'cross'
  | 'shot'
  | 'loose';

export type AgentRoleAction =
  | 'carrier'
  | 'support'
  | 'third_man_wall'
  | 'third_man_runner'
  | 'press'
  | 'cover'
  | 'mark'
  | 'keeper'
  | 'set_piece';

export interface TeamTacticalDoctrine {
  formation: FormationId;
  tactic: TacticId;
  managerTraitId: ManagerTraitId | null;
  managerOvr: number;
  teamChemistry: number; // 0..100
  tacticalFit: number; // 45..99
  /** 0..1: patience for back/lateral recycling before forcing forward pass */
  buildUpPatience: number;
  /** 0.7..1.4: higher = quicker ball release / faster tempo */
  tempo: number;
  /** -1 (short triangle) .. +1 (direct long vertical) */
  passLengthBias: number;
  /** -0.12 .. +0.12 defensive line shift along attacking axis */
  defensiveLineOffset: number;
  /** 0.14 .. 0.36 distance radius in normalized pitch space to trigger press */
  pressTriggerRadius: number;
  /** 1..3 simultaneous pressers targeting ball carrier / cover shadow */
  pressersCount: number;
  /** 0.78 .. 1.18 lateral width scaling in possession */
  attackWidthScale: number;
  /** 0.72 .. 1.12 horizontal compactness when defending (lower = narrower/tighter) */
  defensiveCompactness: number;
  /** 0..1 preference for flank progression / switches / overlaps */
  flankBias: number;
  /** 0..1 preference for central half-space progression */
  centralBias: number;
  /** 0..1 frequency of explicit A->B->C third-man runs */
  thirdManFreq: number;
  /** 0..1 urgency to launch immediate vertical sprints on ball recovery */
  counterSprintUrgency: number;
  /** 0..1 goalkeeper buildup participation */
  gkBuildupSupport: number;
  /** 0..1 fluid positional switching (total_football) */
  positionSwitching: number;
  /** 0..1 defensive line alignment & pass-lane anticipation */
  lineDiscipline: number;
  /** 0..1 star-player ball magnet & 1v1 freedom (galactico_manager) */
  starFocus: number;
  /** 0..1 fresh substitute speed/aggression boost (super_sub) */
  freshSubBoost: number;
  /** 0..1 composure under pressure / big-game focus */
  composure: number;
  /** 0..1 aerial/set-piece focus in final third */
  setPieceFocus: number;
  /** Zone matchup advantages (-1..+1 normalized) */
  zoneMidEdge: number;
  zoneFlankEdge: number;
  zoneTransitionEdge: number;
  zoneBoxEdge: number;
  zonePressEdge: number;
  /** Late-game trailing urgency (0..1) and lead protection urgency (0..1) */
  attackUrgency: number;
  protectUrgency: number;
  /** True when minute >= 85 (or ET >= 115) and trailing by 1 goal: high-AER CB joins box */
  cbBoxJoin: boolean;
}

export interface PlayerAgentProfile {
  slotIndex: number;
  playerId: string;
  name: string;
  subPosition: SubPosition;
  position: 'GK' | 'DF' | 'MF' | 'FW';
  ovr: number;
  attrs: PlayerAttributes;
  playstyles: PlaystyleId[];
  staminaStat: number;
  enteredAtMinute: number;
  isFreshSub: boolean;
  isStar: boolean;
  managerSynergy: boolean;
  /** 0..4 chemistry link strength with each teammate slot 0..10 */
  synergyWithSlot: number[];
  /** Base steering kinematics (normalized pitch units / second) */
  baseMaxSpeed: number;
  baseMaxAccel: number;
  baseTurnRate: number;
  /** Playstyle-driven behavioral affinities */
  runBehindBias: number;
  dropToLinkBias: number;
  boxCrashBias: number;
  cutInsideBias: number;
  hugTouchlineBias: number;
  overlapBias: number;
  pressEagerness: number;
  holdPositionBias: number;
  longSwitchBias: number;
  dribbleBias: number;
  shootBias: number;
  sweeperGkBias: number;
}

export interface PlayerAgentState {
  slotIndex: number;
  isHome: boolean;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  heading: number; // radians
  targetX: number;
  targetY: number;
  staminaPct: number; // 15..100
  roleAction: AgentRoleAction;
  sprintFactor: number; // 0..1
  touchCooldown: number; // seconds
  profile: PlayerAgentProfile;
}

export interface BallTrailPoint {
  x: number;
  y: number;
  z: number;
  flightType: BallFlightType;
}

export interface BallState {
  x: number;
  y: number;
  z: number; // 0 = ground, up to ~1.25 aerial apex
  prevX: number;
  prevY: number;
  prevZ: number;
  vx: number;
  vy: number;
  flightType: BallFlightType;
  ownerTeamIsHome: boolean | null;
  ownerIdx: number | null;
  lastTouchTeamIsHome: boolean;
  lastTouchIdx: number;
  passTargetTeamIsHome: boolean | null;
  passTargetIdx: number | null;
  originX: number;
  originY: number;
  destX: number;
  destY: number;
  ctrlX: number;
  ctrlY: number;
  flightProgress: number; // 0..1
  flightDuration: number; // seconds
  maxArcZ: number;
  trail: BallTrailPoint[];
}

export interface ThirdManRunState {
  active: boolean;
  teamIsHome: boolean;
  aIdx: number;
  bIdx: number;
  cIdx: number;
  stage: 'a_to_b' | 'b_hold' | 'b_to_c';
  wallSpot: SimVec2;
  runTarget: SimVec2;
  timer: number;
}

export type DirectorStage =
  | 'approach'
  | 'set_piece_setup'
  | 'execute_route'
  | 'shot_flight'
  | 'reveal';

export interface DirectorCueState {
  key: string;
  event: MatchEvent;
  isHomeAttack: boolean;
  pattern: HighlightPatternId;
  attackRoute: AttackRouteId;
  outcome: HighlightOutcomeType;
  scorerIdx: number;
  assisterIdx: number;
  defenderIdx: number;
  flankSide: 1 | -1;
  shotAngle: ShotAngleType;
  pkDirection: 'left' | 'center' | 'right';
  reboundOrigin: 'save' | 'woodwork' | 'blocked';
  targetY: number;
  stage: DirectorStage;
  stageTimer: number;
  stageDuration: number;
  shotOrigin: SimVec2;
  shotControl: SimVec2;
  shotEnd: SimVec2;
  revealed: boolean;
  varOffsideLineX: number;
  /** Intermediate step inside multi-touch routes (0 = initial, 1 = pass sent, 2 = receiver driving) */
  routeSubStep: number;
  reboundTriggered: boolean;
  /** Exact locked ball coordinates during set-piece setup (PK spot / corner flag / FK spot) */
  setPieceSpot: SimVec2 | null;
  /** Minimum normalized attack depth (0..1) required before shot is permitted to fire */
  minShotDepth: number;
  /** True once set-piece players have been smoothly staged around the ball */
  staged: boolean;
}

export interface PassArcVisual {
  p0: SimVec2;
  p1: SimVec2;
  p2: SimVec2;
  color: string;
  alpha: number;
  ttl: number;
  maxTtl: number;
}

export interface RunIndicatorVisual {
  from: SimVec2;
  to: SimVec2;
  color: string;
  alpha: number;
  isThirdMan: boolean;
}

export interface PitchSimTeamInput {
  formation: FormationId;
  tactic: TacticId;
  starters: (Player | null)[];
  chemistry?: ChemistryResult | null;
  managerTraitId: ManagerTraitId | null;
  managerOvr: number;
  enteredAtMinute?: Record<string, number>;
  halftimeAdjusted?: boolean;
}

export interface PitchSimInitConfig {
  seed: string;
  homeTeamId: string;
  awayTeamId: string;
  home: PitchSimTeamInput;
  away: PitchSimTeamInput;
  startMinute: number;
  endMinute: number;
  half: 1 | 2;
  targetHomePossession: number; // 31..69 from matchEngine
  homeShotsTarget: number;
  awayShotsTarget: number;
  homeXgTarget: number;
  awayXgTarget: number;
  homeGoalsSoFar: number;
  awayGoalsSoFar: number;
  isBigMatch?: boolean;
  isKnockoutDecider?: boolean;
  aggHomeBeforeMatch?: number;
  aggAwayBeforeMatch?: number;
  events: { key: string; event: MatchEvent }[];
  preHandledKeys?: string[];
}

export interface PitchSimState {
  rngState: number;
  simTime: number;
  matchMinuteFloat: number;
  startMinute: number;
  endMinute: number;
  half: 1 | 2;
  completed: boolean;
  homeTeamId: string;
  awayTeamId: string;
  targetHomePossession: number;
  homeShotsTarget: number;
  awayShotsTarget: number;
  homeXgTarget: number;
  awayXgTarget: number;
  homeGoalsLive: number;
  awayGoalsLive: number;
  isBigMatch: boolean;
  isKnockoutDecider: boolean;
  aggHomeBeforeMatch: number;
  aggAwayBeforeMatch: number;
  baseHomeDoctrine: TeamTacticalDoctrine;
  baseAwayDoctrine: TeamTacticalDoctrine;
  homeDoctrine: TeamTacticalDoctrine;
  awayDoctrine: TeamTacticalDoctrine;
  homeAgents: PlayerAgentState[];
  awayAgents: PlayerAgentState[];
  ball: BallState;
  possessionIsHome: boolean;
  carrierHoldTimer: number;
  carrierDecisionDelay: number;
  recycleCount: number;
  transitionTimer: number;
  transitionTeamIsHome: boolean | null;
  tacticalLabel: TacticalPhaseLabel;
  tacticalLabelTeamIsHome: boolean;
  thirdMan: ThirdManRunState | null;
  director: DirectorCueState | null;
  scheduledEvents: { key: string; event: MatchEvent }[];
  handledEventKeys: Set<string>;
  revealedEventKeys: Set<string>;
  passArc: PassArcVisual | null;
  runIndicators: RunIndicatorVisual[];
  goalRipple: { side: 'left' | 'right'; intensity: number } | null;
  impactRing: { x: number; y: number; alpha: number; color: string } | null;
  pitchFlashAlpha: number;
  /** Subtle slowdown during decisive shot flight (still scaled by 1x/2x/4x accumulator) */
  localPaceMult: number;
  lastStaminaSyncMinute: number;
  /** Telemetry counters for verification & testing */
  stats: {
    passesAttempted: number;
    passesCompleted: number;
    recycles: number;
    switches: number;
    thirdManRuns: number;
    interceptions: number;
    dribbles: number;
    longRangeBackpassesBlocked: number;
    lateUrgentForwardPasses: number;
  };
}
