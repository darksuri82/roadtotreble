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

export type ClassicEra = '60s' | '70s' | '80s' | '90s' | '00s' | '10s';

export const CLASSIC_ERA_ORDER: readonly ClassicEra[] = [
  '60s',
  '70s',
  '80s',
  '90s',
  '00s',
  '10s',
] as const;

export interface ClassicEraVisualMeta {
  era: ClassicEra;
  shortLabel: string;
  badgeLabel: string;
  fullLabel: string;
  cardClass: string;
  badgeClass: string;
  inlineChipClass: string;
  ovrTextClass: string;
  posBadgeClass: string;
  shimmerViaClass: string;
  confirmBtnClass: string;
  reelSectionClass: string;
  accentHex: string;
}

export const CLASSIC_ERA_META: Record<ClassicEra, ClassicEraVisualMeta> = {
  '60s': {
    era: '60s',
    shortLabel: '60s',
    badgeLabel: '60s',
    fullLabel: '60s 클래식',
    cardClass: 'card-classic-60s',
    badgeClass:
      'bg-gradient-to-r from-amber-600 via-yellow-300 to-amber-500 text-slate-950 font-extrabold',
    inlineChipClass:
      'border border-amber-400/55 bg-amber-500/20 text-amber-200',
    ovrTextClass: 'text-amber-300',
    posBadgeClass: 'bg-amber-500/20 text-amber-200 border border-amber-400/40',
    shimmerViaClass: 'via-amber-200/20',
    confirmBtnClass: 'bg-amber-400 text-slate-950 hover:bg-amber-300',
    reelSectionClass:
      'border-amber-400/55 bg-gradient-to-br from-amber-950/35 via-[#16120c] to-amber-950/20',
    accentHex: '#f59e0b',
  },
  '70s': {
    era: '70s',
    shortLabel: '70s',
    badgeLabel: '70s',
    fullLabel: '70s 클래식',
    cardClass: 'card-classic-70s',
    badgeClass:
      'bg-gradient-to-r from-orange-500 via-amber-300 to-orange-400 text-slate-950 font-extrabold',
    inlineChipClass:
      'border border-orange-400/55 bg-orange-500/20 text-orange-200',
    ovrTextClass: 'text-orange-300',
    posBadgeClass:
      'bg-orange-500/20 text-orange-200 border border-orange-400/40',
    shimmerViaClass: 'via-orange-200/20',
    confirmBtnClass: 'bg-orange-400 text-slate-950 hover:bg-orange-300',
    reelSectionClass:
      'border-orange-400/55 bg-gradient-to-br from-orange-950/35 via-[#18110c] to-orange-950/20',
    accentHex: '#fb923c',
  },
  '80s': {
    era: '80s',
    shortLabel: '80s',
    badgeLabel: '80s',
    fullLabel: '80s 클래식',
    cardClass: 'card-classic-80s',
    badgeClass:
      'bg-gradient-to-r from-amber-500 via-yellow-200 to-amber-400 text-slate-950 font-extrabold',
    inlineChipClass:
      'border border-yellow-400/55 bg-yellow-500/18 text-yellow-200',
    ovrTextClass: 'text-yellow-300',
    posBadgeClass:
      'bg-yellow-500/20 text-yellow-200 border border-yellow-400/40',
    shimmerViaClass: 'via-yellow-200/20',
    confirmBtnClass: 'bg-amber-400 text-slate-950 hover:bg-amber-300',
    reelSectionClass:
      'border-yellow-400/55 bg-gradient-to-br from-yellow-950/30 via-[#17130a] to-amber-950/20',
    accentHex: '#facc15',
  },
  '90s': {
    era: '90s',
    shortLabel: '90s',
    badgeLabel: '90s',
    fullLabel: '90s 클래식',
    cardClass: 'card-classic-90s',
    badgeClass:
      'bg-gradient-to-r from-rose-400 via-pink-200 to-amber-300 text-slate-950 font-extrabold',
    inlineChipClass:
      'border border-rose-400/55 bg-rose-500/20 text-rose-200',
    ovrTextClass: 'text-rose-200',
    posBadgeClass: 'bg-rose-500/20 text-rose-200 border border-rose-400/40',
    shimmerViaClass: 'via-rose-200/20',
    confirmBtnClass: 'bg-rose-400 text-slate-950 hover:bg-rose-300',
    reelSectionClass:
      'border-rose-400/55 bg-gradient-to-br from-rose-950/35 via-[#190f15] to-rose-950/20',
    accentHex: '#fb7185',
  },
  '00s': {
    era: '00s',
    shortLabel: '00s',
    badgeLabel: '00s',
    fullLabel: '00s 클래식',
    cardClass: 'card-classic-00s',
    badgeClass:
      'bg-gradient-to-r from-slate-300 via-amber-100 to-slate-200 text-slate-950 font-extrabold',
    inlineChipClass:
      'border border-slate-300/55 bg-slate-200/18 text-slate-100',
    ovrTextClass: 'text-slate-100',
    posBadgeClass:
      'bg-slate-200/18 text-slate-100 border border-slate-300/40',
    shimmerViaClass: 'via-slate-100/20',
    confirmBtnClass: 'bg-slate-200 text-slate-950 hover:bg-white',
    reelSectionClass:
      'border-slate-300/50 bg-gradient-to-br from-slate-800/40 via-[#131822] to-slate-900/30',
    accentHex: '#e2e8f0',
  },
  '10s': {
    era: '10s',
    shortLabel: '10s',
    badgeLabel: '10s',
    fullLabel: '10s 클래식',
    cardClass: 'card-classic-10s',
    badgeClass:
      'bg-gradient-to-r from-violet-400 via-fuchsia-200 to-amber-300 text-slate-950 font-extrabold',
    inlineChipClass:
      'border border-violet-400/60 bg-violet-500/22 text-violet-200',
    ovrTextClass: 'text-violet-200',
    posBadgeClass:
      'bg-violet-500/22 text-violet-200 border border-violet-400/45',
    shimmerViaClass: 'via-violet-200/22',
    confirmBtnClass: 'bg-violet-400 text-slate-950 hover:bg-violet-300',
    reelSectionClass:
      'border-violet-400/55 bg-gradient-to-br from-violet-950/40 via-[#151126] to-indigo-950/25',
    accentHex: '#a78bfa',
  },
};

export type PlayerLeagueId =
  | 'epl'
  | 'laliga'
  | 'seriea'
  | 'bundesliga'
  | 'ligue1'
  | 'LEGEND';

export interface GoalkeeperAttributes {
  div: number; // 다이빙 (40..99)
  han: number; // 핸들링 (40..99)
  ref: number; // 반사신경 (40..99)
  kic: number; // 킥/빌드업 (40..99)
  pos: number; // 위치선정 (40..99)
}

export interface PlayerAttributes {
  sho: number; // 슈팅/결정력 (40..99)
  pas: number; // 패스/시야 (40..99)
  cro: number; // 크로스/킥 정확도 (40..99)
  dri: number; // 드리블/볼컨트롤/돌파 (40..99)
  aer: number; // 헤더/공중볼 (40..99)
  def: number; // 수비/태클/위치선정 (40..99)
  phy: number; // 스피드/피지컬/경합 (40..99)
  gk?: GoalkeeperAttributes;
}

export interface PlayerAwakeningRecord {
  originalOvr: number;
  ovrGain: number; // +2 .. +8 (+2 fixed for baseOvr >= 88)
  round: number;
  competition: 'league' | 'cup' | 'ucl';
  /** Top boosted sub-attribute deltas for celebration UI & detail modal */
  statDeltas: { key: string; label: string; before: number; after: number }[];
}

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
  /** True for Era Classic cards (internal compatibility flag shared across engines & RPC) */
  isLegend: boolean;
  /** Era tag for classic cards ('60s'..'10s'); omitted on active players */
  classicEra?: ClassicEra;
  /** Representative peak year/season tag for classic cards (e.g. '2018', '1998') */
  classicSeasonTag?: string;
  isGenerated?: boolean;
  attrs?: PlayerAttributes;
  formerClubs?: string[];
  /** Permanent potential breakthrough growth stored strictly on cloned roster instances (never mutating static DB) */
  awakening?: PlayerAwakeningRecord;
}

export type PositionFitLevel = 'main' | 'secondary' | 'out_of_pos' | 'severe';

export interface PositionFitResult {
  fit: PositionFitLevel;
  penalty: number; // 0, -1/-3, -3/-6, or -15
  effectiveOvr: number;
  label: string;
}

export const SUPERSTAR_MIN_OVR = 90;
export const WORLDCLASS_MIN_OVR = 86;
export const KEY_MIN_OVR = 82;

/**
 * Strictly separates Era Classic vs Active Superstar via `isLegend` boolean flag first,
 * NOT raw OVR thresholds.
 */
export function getCardTier(player: Pick<Player, 'ovr' | 'isLegend'>): CardTier {
  if (player.isLegend) return 'legend';
  if (player.ovr >= SUPERSTAR_MIN_OVR) return 'superstar';
  if (player.ovr >= WORLDCLASS_MIN_OVR) return 'worldclass';
  if (player.ovr >= KEY_MIN_OVR) return 'key';
  return 'common';
}

export function getClassicEra(
  player: Pick<Player, 'isLegend' | 'classicEra'> | null | undefined,
): ClassicEra | null {
  if (!player) return null;
  if (player.classicEra && player.classicEra in CLASSIC_ERA_META) {
    return player.classicEra;
  }
  return player.isLegend ? '00s' : null;
}

export function getClassicEraMeta(
  era: ClassicEra | null | undefined,
): ClassicEraVisualMeta {
  if (era && era in CLASSIC_ERA_META) {
    return CLASSIC_ERA_META[era];
  }
  return CLASSIC_ERA_META['00s'];
}

export function formatNameWithClassicEra(
  name: string,
  classicEra?: ClassicEra | null,
  isLegend?: boolean,
): string {
  const tag = classicEra ?? (isLegend ? 'CL' : null);
  if (!tag) return name;
  const suffix = `(${tag})`;
  if (name.endsWith(suffix)) return name;
  return `${name} ${suffix}`;
}

export function formatPlayerRecordName(
  player: Pick<Player, 'name' | 'isLegend' | 'classicEra'>,
): string {
  if (!player.isLegend && !player.classicEra) return player.name;
  return formatNameWithClassicEra(player.name, player.classicEra, player.isLegend);
}

export function getClassicClubSubtitle(
  player: Pick<Player, 'club' | 'isLegend' | 'classicEra' | 'classicSeasonTag'>,
): string {
  if (!player.isLegend && !player.classicEra) return player.club;
  const era = getClassicEra(player) ?? '00s';
  return player.classicSeasonTag
    ? `${era} 클래식 · ${player.classicSeasonTag}`
    : `${era} 클래식`;
}

export const TIER_LABELS: Record<CardTier, string> = {
  common: '일반',
  key: '핵심',
  worldclass: '월드클래스',
  superstar: '슈퍼스타',
  legend: 'CLASSIC',
};

export const LEAGUE_LABELS: Record<PlayerLeagueId, string> = {
  epl: 'EPL',
  laliga: '라리가',
  seriea: '세리에 A',
  bundesliga: '분데스리가',
  ligue1: '리그 1',
  LEGEND: 'CLASSIC',
};

export const POSITION_LABELS: Record<Position, string> = {
  GK: '골키퍼',
  DF: '수비수',
  MF: '미드필더',
  FW: '공격수',
};
