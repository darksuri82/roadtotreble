import type { Position, SubPosition } from './player';

export type InjurySeverity = 'minor' | 'moderate' | 'severe';

export type MoraleTier = 'ecstatic' | 'high' | 'normal' | 'low' | 'frozen';

export interface PlayerInjury {
  id: string;
  name: string;
  severity: InjurySeverity;
  matchesRemaining: number;
  initialMatches: number;
  canPlayThrough: boolean;
  playThroughPenalty: number; // -2..-4 for minor injury if forced to play
  recoveryMatchesRemaining: number; // post-return rust matches (2 for moderate, 3 for severe)
  occurredRound?: number;
  occurredCompetition?: 'league' | 'cup' | 'ucl';
}

export interface PlayerConditionState {
  morale: number; // -5..+5
  injury: PlayerInjury | null;
  consecutiveBenchMatches: number;
  consecutiveMatchesPlayed: number;
  recentGoalDrought: number;
  lastMatchRating?: number;
}

export type PlayerConditionMap = Record<string, PlayerConditionState>;

export interface InjuryAlertItem {
  playerId: string;
  playerName: string;
  nationality: string;
  nationalityCode: string;
  position: Position;
  mainPosition: SubPosition;
  ovr: number;
  isStarter: boolean;
  starterSlotIndex: number | null;
  injury: PlayerInjury;
  wasAggravated?: boolean;
}

export interface InjuryAutoReturnEntry {
  injuredPlayerId: string;
  injuredPlayerName: string;
  originalSlotIndex: number;
  replacementPlayerId: string | null;
}

export interface InjuryReturnNotification {
  id: string;
  playerId: string;
  playerName: string;
  slotLabel?: string;
}

export type ManagerEventCategory = 'press_conference' | 'locker_room';

export type ManagerEventTargetScope = 'team' | 'position_group' | 'player';

export type PositionGroupId = 'FW' | 'MF' | 'DF_GK';

export type ManagerEventTriggerType =
  | 'any'
  | 'win_streak'
  | 'lose_streak'
  | 'big_win'
  | 'heavy_loss'
  | 'big_match'
  | 'cup_or_ucl'
  | 'fatigue_overload'
  | 'xg_underperform'
  | 'clean_sheet_streak'
  | 'conceded_many'
  | 'player_poor_rating'
  | 'player_mom_or_hattrick'
  | 'player_goal_drought'
  | 'player_bench_unhappy'
  | 'player_injury_cover'
  | 'player_big_game_ace'
  | 'player_returning_injury'
  | 'transfer_rumor'
  | 'title_race'
  | 'unbeaten_run'
  | 'comeback_win';

export interface ManagerEventChoiceEffect {
  targetMoraleDelta?: number;
  teamMoraleDelta?: number;
  benchMoraleDelta?: number;
  starterMoraleDelta?: number;
  secondaryGroup?: PositionGroupId;
  secondaryGroupDelta?: number;
  frozenReliefBonus?: number;
  reactionText: string;
}

export type ManagerChoiceRiskTier = 'high' | 'medium' | 'safe';

export interface ManagerEventChoiceDef {
  id: string;
  label: string;
  toneTag: string;
  quote: string;
  riskTier?: ManagerChoiceRiskTier;
  riskLabel?: string;
  successChance?: number; // 0..1, omitted => deterministic success
  successEffect: ManagerEventChoiceEffect;
  failEffect?: ManagerEventChoiceEffect;
}

export interface ManagerEventTemplate {
  id: string;
  category: ManagerEventCategory;
  targetScope: ManagerEventTargetScope;
  positionGroup?: PositionGroupId;
  trigger: ManagerEventTriggerType;
  title: string;
  speakerLabel: string;
  prompt: string;
  choices: [ManagerEventChoiceDef, ManagerEventChoiceDef, ManagerEventChoiceDef];
}

export type ManagerEventSceneId =
  | 'press_official'
  | 'press_ucl_night'
  | 'press_mixed_zone'
  | 'locker_home'
  | 'stadium_tunnel'
  | 'manager_office'
  | 'training_pitch'
  | 'celebration_locker';

export interface ManagerEventPlayerMatchStat {
  playerId: string;
  playerName: string;
  position: Position;
  subPosition: SubPosition;
  ovr: number;
  rating: number;
  goals: number;
  assists: number;
  xg: number;
  minutesPlayed: number;
  isMom: boolean;
  dribbleBeats: number;
  savesCount: number;
  keyMoments: string[];
}

export interface ManagerEventMatchContext {
  competitionLabel: string; // e.g. "리그 14R", "FA컵 8강", "UCL 4R"
  userTeamName: string;
  opponentName: string;
  userGoals: number;
  oppGoals: number;
  outcome: 'W' | 'D' | 'L';
  note?: string; // e.g. "PK 5-4", "연장"
  userXg: number;
  oppXg: number;
  userPossession: number;
  userShots: number;
  userShotsOnTarget: number;
  momPlayerName?: string;
  momRating?: number;
  playerStats?: ManagerEventPlayerMatchStat | null;
}

export interface ActiveManagerEvent {
  templateId: string;
  category: ManagerEventCategory;
  sceneId?: ManagerEventSceneId;
  targetScope: ManagerEventTargetScope;
  positionGroup?: PositionGroupId;
  targetPlayerId?: string;
  targetPlayerName?: string;
  targetPlayerNationality?: string;
  targetPlayerNationalityCode?: string;
  targetPlayerOvr?: number;
  targetPlayerPosition?: Position;
  targetPlayerMainPosition?: SubPosition;
  targetPlayerMorale?: number;
  targetPlayerInjured?: boolean;
  title: string;
  speakerLabel: string;
  contextBadge: string;
  prompt: string;
  choices: ManagerEventChoiceDef[];
  matchContext?: ManagerEventMatchContext | null;
}

export interface ManagerEventOutcomeItem {
  label: string;
  delta: number;
  note: string;
}

export interface ManagerEventResolution {
  eventTitle: string;
  category: ManagerEventCategory;
  sceneId?: ManagerEventSceneId;
  chosenLabel: string;
  chosenQuote: string;
  wasRisky: boolean;
  riskSucceeded: boolean;
  reactionText: string;
  outcomes: ManagerEventOutcomeItem[];
}

export interface ManagerEventsState {
  usedEventIds: string[];
  matchesSinceLastEvent: number;
  activeEvent: ActiveManagerEvent | null;
  lastResolution: ManagerEventResolution | null;
  teamMorale: number; // -5..+5
  recentWinStreak: number;
  recentLossStreak: number;
  recentCleanSheetStreak: number;
  recentUnbeatenStreak: number;
}
