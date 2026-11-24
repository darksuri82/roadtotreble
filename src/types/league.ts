import type { AiManagerProfile, FormationId } from './game';
import type { Player, Position, SubPosition } from './player';

export type LeagueId = 'epl' | 'laliga' | 'seriea' | 'bundesliga' | 'ligue1';

export type JerseyPattern = 'solid' | 'stripes' | 'hoops' | 'sash' | 'half';

export type TacticId =
  | 'possession'
  | 'gegenpressing'
  | 'counter'
  | 'wingplay'
  | 'balanced';

export interface Club {
  id: string;
  name: string;
  shortName: string;
  primaryColor: string;
  secondaryColor: string;
  pattern?: JerseyPattern;
  formation: FormationId;
  defaultTactic: TacticId;
  att: number;
  mid: number;
  def: number;
  topScorers: [string, string, string];
  isUser?: boolean;
  manager?: AiManagerProfile;
}

export interface LeagueData {
  id: LeagueId;
  name: string;
  koreanName: string;
  country: string;
  accentColor: string;
  totalRounds: number;
  transferWindows: [number, number, number];
  uclSpots: number;
  relegationSpots: number;
  clubs: Club[];
}

export type MatchEventType =
  | 'goal'
  | 'chance'
  | 'save'
  | 'var_offside'
  | 'yellow'
  | 'kickoff'
  | 'halftime'
  | 'fulltime'
  | 'sub';

export type HighlightPatternId =
  | 'wing_cross_header'
  | 'cutback_finish'
  | 'through_ball_1v1'
  | 'cut_inside_curler'
  | 'corner_kick'
  | 'direct_free_kick'
  | 'high_press_counter'
  | 'u_buildup_switch'
  | 'rebound_finish'
  | 'penalty_kick';

export type HighlightOutcomeType =
  | 'goal'
  | 'save'
  | 'woodwork'
  | 'blocked'
  | 'near_miss'
  | 'var_offside';

export type ShotAngleType =
  | 'near_post'
  | 'far_post'
  | 'acute_left'
  | 'acute_right'
  | 'center';

export type AttackRouteId =
  | 'early_cross'
  | 'cutback'
  | 'through_ball'
  | 'solo_dribble'
  | 'cut_inside_curler'
  | 'long_range_cannon'
  | 'tiki_taka_triangle'
  | 'u_buildup_switch'
  | 'gegenpress_steal'
  | 'low_block_counter'
  | 'corner_header'
  | 'direct_fk'
  | 'rebound_poach'
  | 'penalty_kick';

export type FinishTypeId =
  | 'inside_shot'
  | 'one_touch'
  | 'curler'
  | 'power_drive'
  | 'long_cannon'
  | 'header'
  | 'volley'
  | 'chip_1v1'
  | 'solo_finish'
  | 'free_kick'
  | 'penalty';

export interface MatchEvent {
  minute: number;
  half: 1 | 2;
  type: MatchEventType;
  teamId: string;
  teamShortName?: string;
  teamColor?: string;
  isUserTeam?: boolean;
  scorerName?: string;
  scorerId?: string;
  assistName?: string;
  assistId?: string;
  xgDelta?: number;
  highlightPattern?: HighlightPatternId;
  highlightOutcome?: HighlightOutcomeType;
  attackRoute?: AttackRouteId;
  finishType?: FinishTypeId;
  dribbleBeatCount?: number;
  contestDefenderName?: string;
  shotAngle?: ShotAngleType;
  isPenalty?: boolean;
  pkDirection?: 'left' | 'center' | 'right';
  reboundOrigin?: 'save' | 'woodwork' | 'blocked';
  secondaryShooterName?: string;
  subOutName?: string;
  subInName?: string;
  description: string;
}

export interface MatchPlayerRating {
  playerId: string;
  playerName: string;
  teamId: string;
  position: Position;
  subPosition: SubPosition;
  rating: number; // 1.0 .. 10.0
  goals: number;
  assists: number;
  xg: number;
  minutesPlayed: number;
  isSub?: boolean;
  isLegend?: boolean;
}

export type MatchCompetitionType = 'league' | 'cup' | 'ucl';

export interface PenaltyKickLog {
  round: number; // 1..5+
  teamId: string;
  teamShortName: string;
  kickerName: string;
  scored: boolean;
  homeScoreAfter: number;
  awayScoreAfter: number;
}

export interface ExtraTimeInfo {
  homeEtGoals: number; // Goals scored during 91'~120'
  awayEtGoals: number;
  etEvents: MatchEvent[];
  penalties?: {
    homePenGoals: number;
    awayPenGoals: number;
    kicks: PenaltyKickLog[];
    winnerTeamId: string;
  };
  winnerTeamId: string;
}

export interface AiHalftimeAdjustment {
  managerName: string;
  managerOvr: number;
  changedFormation: boolean;
  previousFormation: FormationId;
  newFormation: FormationId;
  changedTactic: boolean;
  previousTactic: TacticId;
  newTactic: TacticId;
  subsMade: { outPlayerName: string; inPlayerName: string }[];
  headline: string; // e.g. "⚡ 한지 플릭 하프타임 대응: 3-5-2 DM 전환 · 선수비 후역습"
  updatedStarters?: Player[];
  updatedBench?: Player[];
}

export interface MatchResult {
  fixtureId: string;
  round: number;
  competition?: MatchCompetitionType;
  competitionLabel?: string;
  homeTeamId: string;
  awayTeamId: string;
  homeGoals: number; // Total goals including ET if played
  awayGoals: number;
  homeGoals90?: number;
  awayGoals90?: number;
  homeXg: number;
  awayXg: number;
  homePossession: number;
  homeShots: number;
  awayShots: number;
  homeShotsOnTarget: number;
  awayShotsOnTarget: number;
  homeTactic: TacticId;
  awayTactic: TacticId;
  homeFormation: FormationId;
  awayFormation: FormationId;
  homeTacticBonus: number;
  awayTacticBonus: number;
  halftimeAdjusted?: boolean;
  aiHalftimeAdjustment?: AiHalftimeAdjustment;
  halftimeHomeGoals?: number;
  halftimeAwayGoals?: number;
  extraTime?: ExtraTimeInfo;
  events: MatchEvent[];
  playerRatings: MatchPlayerRating[];
  momPlayerId: string;
  momPlayerName: string;
  momRating: number;
}

export interface LiveSubRecord {
  minute: number;
  outPlayerId: string;
  outPlayerName: string;
  inPlayerId: string;
  inPlayerName: string;
  slotIndex: number;
}

export interface LiveHalftimeState {
  fixtureId: string;
  round: number;
  competition?: MatchCompetitionType;
  competitionLabel?: string;
  isKnockoutDecider?: boolean; // Single-leg cup/final OR 2nd-leg UCL tie
  aggHomeBeforeMatch?: number; // For 2nd-leg UCL tie: home team's 1st-leg goals
  aggAwayBeforeMatch?: number; // For 2nd-leg UCL tie: away team's 1st-leg goals
  homeTeamId: string;
  awayTeamId: string;
  isUserHome: boolean;
  homeGoals: number;
  awayGoals: number;
  homeXg: number;
  awayXg: number;
  homePossession: number;
  homeShots: number;
  awayShots: number;
  homeShotsOnTarget: number;
  awayShotsOnTarget: number;
  homeTactic: TacticId;
  awayTactic: TacticId;
  homeFormation: FormationId;
  awayFormation: FormationId;
  firstHalfEvents: MatchEvent[];
  tacticalHint: string;
  recommendedTactic: TacticId;
  recommendedFormation?: FormationId;
  halftimeSubsMade: number;
  liveSubs?: LiveSubRecord[];
  preMatchStarters?: (Player | null)[];
  preMatchBench?: (Player | null)[];
  preMatchFormation?: FormationId;
  userTacticAtKickoff: TacticId;
  userFormationAtKickoff: FormationId;
  aiHalftimeAdjustment?: AiHalftimeAdjustment;
  phase:
    | 'first_half'
    | 'halftime'
    | 'second_half'
    | 'extra_time_break'
    | 'extra_time'
    | 'extra_time_ht'
    | 'extra_time_2'
    | 'penalties';
  fullMatchResult?: MatchResult;
  etFirstHalfResult?: MatchResult;
  /** True while solo live scoreboard is streaming this match before committing (hides fullscreen 2D modal). */
  streamAutoMode?: boolean;
  /** If user jumps into 2D broadcast mid-stream, start playback from this match minute. */
  resumeFromMinute?: number;
  /** Preserved 90-minute result before precomputed ET so mid-2nd-half takeover can play fresh ET/subs. */
  streamResult90?: MatchResult;
}

export interface Fixture {
  id: string;
  round: number;
  homeTeamId: string;
  awayTeamId: string;
  played: boolean;
  result?: MatchResult;
}

export interface StandingRow {
  teamId: string;
  teamName: string;
  shortName: string;
  primaryColor: string;
  secondaryColor: string;
  isUser: boolean;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form: ('W' | 'D' | 'L')[];
}

export interface PlayerTransferRecord {
  fromClubId: string;
  fromClubName: string;
  toClubId: string;
  toClubName: string;
  round: number;
  competition?: 'league' | 'ucl';
  type?: 'transfer' | 'trade';
  counterpartyClub?: string;
  windowLabel?: string;
}

export interface PlayerSeasonStats {
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  teamShortName: string;
  teamPrimaryColor: string;
  teamSecondaryColor: string;
  isUserTeam: boolean;
  position: Position;
  mainPositions: SubPosition[];
  ovr: number;
  appearances: number;
  starts: number;
  subAppearances: number;
  minutesPlayed: number;
  goals: number;
  assists: number;
  xgSum: number;
  cleanSheets: number;
  momCount: number;
  ratingSum: number;
  avgRating: number;
  positionCounts: Partial<Record<SubPosition, number>>;
  isLegend: boolean;
  transferHistory?: PlayerTransferRecord[];
}

export interface BestXiEntry {
  slotLabel: SubPosition;
  slotIndex: number;
  stats: PlayerSeasonStats;
}

export interface SeasonAwards {
  topScorers: PlayerSeasonStats[];
  topAssisters: PlayerSeasonStats[];
  topCleanSheets: PlayerSeasonStats[];
  topRatings: PlayerSeasonStats[];
  bestXi: BestXiEntry[]; // 4-3-3 11 players
  poty: PlayerSeasonStats | null;
}

export interface BallonDorCandidate {
  rank: number; // 1..5
  stats: PlayerSeasonStats;
  ballonScore: number;
  trophies: string[];
  reason: string;
}

export interface GlobalSeasonAwards {
  ballonDorWinner: BallonDorCandidate | null;
  ballonDorTop5: BallonDorCandidate[];
  worldBestXi: BestXiEntry[]; // 4-3-3 global best 11
}

export interface TeamSeasonAnalytics {
  competitionScope?: 'league' | 'cup' | 'ucl' | 'combined';
  finalRank: number;
  rankLabel?: string; // e.g. '1위', '우승', '4강' for cup/UCL/combined displays
  points: number; // Strictly regular league points (0 for knockout-only cup/UCL tabs)
  leaguePoints?: number | null; // Explicit pure regular league points reference
  winRatePct?: number; // 0..100
  played: number;
  won: number;
  drawn: number;
  lost: number;
  homeRecord: { played: number; won: number; drawn: number; lost: number; gf: number; ga: number };
  awayRecord: { played: number; won: number; drawn: number; lost: number; gf: number; ga: number };
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  totalXg: number;
  totalXga: number;
  finishingDiff: number; // goalsFor - totalXg
  preventedDiff: number; // totalXga - goalsAgainst
  avgPossession: number;
  avgShots: number;
  avgShotsOnTarget: number;
  cleanSheets: number;
  maxWinStreak: number;
  maxUnbeatenStreak: number;
  biggestWin: {
    round: number;
    opponentName: string;
    opponentShortName: string;
    userGoals: number;
    oppGoals: number;
    isHome: boolean;
  } | null;
}

export interface SquadPlayerAnalyticsRow {
  playerId: string;
  playerName: string;
  ovr: number;
  stamina: number;
  isLegend: boolean;
  position: Position;
  mainPositions: SubPosition[];
  primaryDeployedPosition: SubPosition;
  appearances: number;
  starts: number;
  subAppearances: number;
  minutesPlayed: number;
  goals: number;
  assists: number;
  goalContributions: number;
  xg: number;
  cleanSheets: number;
  momCount: number;
  avgRating: number;
}
