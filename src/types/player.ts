export type Position = 'GK' | 'DF' | 'MF' | 'FW';

export type SubPosition =
  | 'GK'
  | 'LB'
  | 'CB'
  | 'RB'
  | 'LWB'
  | 'RWB'
  | 'CDM'
  | 'CM'
  | 'CAM'
  | 'LM'
  | 'RM'
  | 'LW'
  | 'RW'
  | 'ST';

export type PlaystyleId =
  | 'line_breaker'
  | 'complete_forward'
  | 'poacher'
  | 'inverted_winger'
  | 'classic_winger'
  | 'playmaker_10'
  | 'box_to_box'
  | 'deep_playmaker'
  | 'ball_winner'
  | 'attacking_wingback'
  | 'ball_playing_cb'
  | 'stopper_cb'
  | 'sweeper_keeper'
  | 'shot_stopper';

export type CardTier = 'common' | 'key' | 'worldclass' | 'superstar' | 'legend';

export type PlayerLeagueId =
  | 'epl'
  | 'laliga'
  | 'seriea'
  | 'bundesliga'
  | 'ligue1'
  | 'LEGEND';

export interface Player {
  id: string;
  name: string;
  position: Position;
  mainPositions: SubPosition[];
  secondaryPositions: SubPosition[];
  ovr: number;
  nationality: string;
  nationalityCode: string;
  leagueId: PlayerLeagueId;
  club: string;
  att: number;
  mid: number;
  def: number;
  stamina: number; // 60..99
  playstyles: PlaystyleId[];
  scoutNote: string;
  isLegend: boolean;
  isGenerated?: boolean;
}

export type PositionFitLevel = 'main' | 'secondary' | 'out_of_pos' | 'severe';

export interface PositionFitResult {
  fit: PositionFitLevel;
  penalty: number; // 0, -1/-3, -3/-6, or -15
  effectiveOvr: number;
  label: string;
}

/**
 * Strictly separates Legend vs Active Superstar via `isLegend` boolean flag first,
 * NOT raw OVR thresholds.
 */
export function getCardTier(player: Pick<Player, 'ovr' | 'isLegend'>): CardTier {
  if (player.isLegend) return 'legend';
  if (player.ovr >= 91) return 'superstar';
  if (player.ovr >= 87) return 'worldclass';
  if (player.ovr >= 82) return 'key';
  return 'common';
}

export const TIER_LABELS: Record<CardTier, string> = {
  common: '일반',
  key: '핵심',
  worldclass: '월드클래스',
  superstar: '슈퍼스타',
  legend: 'LEGEND',
};

export const LEAGUE_LABELS: Record<PlayerLeagueId, string> = {
  epl: 'EPL',
  laliga: '라리가',
  seriea: '세리에 A',
  bundesliga: '분데스리가',
  ligue1: '리그 1',
  LEGEND: 'ICON',
};

export const POSITION_LABELS: Record<Position, string> = {
  GK: '골키퍼',
  DF: '수비수',
  MF: '미드필더',
  FW: '공격수',
};
