import type { ManagerTraitId } from '../types/game';
import type { TacticId } from '../types/league';
import type { Player, PlaystyleId } from '../types/player';
import { PLAYSTYLES } from './playstyles';

export type ManagerTraitCategory = 'builder' | 'specialist';

export interface ManagerTraitConfig {
  id: ManagerTraitId;
  name: string;
  tagline: string;
  effectSummary: string;
  draftGuideTip: string;
  badgeColor: string;
  category: ManagerTraitCategory;
  /** Target count for progressive philosophy gauge (8 for style builders, 6 for galactico/total_football, 0 for pure situational) */
  philosophyTarget: number;
  synergyTactic?: TacticId;
  synergyPlaystyles: PlaystyleId[];
}

export const MANAGER_TRAITS: Record<ManagerTraitId, ManagerTraitConfig> = {
  tiki_taka: {
    id: 'tiki_taka',
    name: '티키타카 마스터',
    tagline: '완벽한 삼각 패스와 점유율 축구',
    effectSummary:
      '궁합 1~11명 MID +3.0 · 점유율 +6% | 점유율 전술 시 ATT +0.9 · MID +0.9 추가 | 궁합 선수 OVR +1',
    draftGuideTip:
      '딥라잉·플레이메이커·빌드업 CB·인버티드 윙어를 모을수록 중원과 점유율이 극대화됩니다.',
    badgeColor: '#38bdf8',
    category: 'builder',
    philosophyTarget: 11,
    synergyTactic: 'possession',
    synergyPlaystyles: [
      'deep_playmaker',
      'playmaker_10',
      'ball_playing_cb',
      'inverted_winger',
      'sweeper_keeper',
    ],
  },
  gegenpress_guru: {
    id: 'gegenpress_guru',
    name: '게겐프레싱 전도사',
    tagline: '전방 압박이 최고의 플레이메이커',
    effectSummary:
      '궁합 1~11명 ATT +2.0 · MID +1.6 | 압박 전술 시 ATT/DEF +0.7 · 체력 소모 완화(1.35→1.15배) | 궁합 +1',
    draftGuideTip:
      '박스투박스·볼위너·라인브레이커·공격형 윙백을 모으면 90분 내내 지치지 않는 전방 압박이 완성됩니다.',
    badgeColor: '#f97316',
    category: 'builder',
    philosophyTarget: 11,
    synergyTactic: 'gegenpressing',
    synergyPlaystyles: [
      'box_to_box',
      'ball_winner',
      'line_breaker',
      'attacking_wingback',
    ],
  },
  catenaccio: {
    id: 'catenaccio',
    name: '카테나치오',
    tagline: '질식 수비와 치명적 한 방의 역습',
    effectSummary:
      '궁합 1~11명 DEF +3.0 | 역습 전술 시 DEF +1.1 · 상대 xG -0.12 추가 | 궁합 선수 OVR +1',
    draftGuideTip:
      '파이터 CB·선방형 GK·볼위너·라인브레이커를 모으고 역습 전술을 쓰면 극단적 빗장수비가 완성됩니다.',
    badgeColor: '#94a3b8',
    category: 'builder',
    philosophyTarget: 11,
    synergyTactic: 'counter',
    synergyPlaystyles: [
      'stopper_cb',
      'shot_stopper',
      'ball_winner',
      'line_breaker',
    ],
  },
  wing_bomber: {
    id: 'wing_bomber',
    name: '측면 폭격기',
    tagline: '하프스페이스와 터치라인을 가르는 폭격',
    effectSummary:
      '궁합 1~6명 ATT +2.4 | 측면 전술 시 ATT +1.1 · xG +0.12 추가 | 궁합 선수 OVR +1',
    draftGuideTip:
      '윙어·공격형 윙백·포처 6명만 모아도 최대 효과가 발동하며 측면 공략 시 화력이 폭발합니다.',
    badgeColor: '#22c55e',
    category: 'builder',
    philosophyTarget: 6,
    synergyTactic: 'wingplay',
    synergyPlaystyles: [
      'attacking_wingback',
      'classic_winger',
      'inverted_winger',
      'poacher',
    ],
  },
  halftime_wizard: {
    id: 'halftime_wizard',
    name: '하프타임 마법사',
    tagline: '라커룸 연설로 경기를 뒤집는 전략가',
    effectSummary:
      '하프타임 전술·포메이션 변경 시 후반 스윙 1.8배 · A/M/D +1.6/+1.4/+1.2 · xG +0.20 (열세 시 추가 ATT +0.8 · xG +0.12)',
    draftGuideTip:
      '후반 전술 전환에 강한 플레이메이커·딥라잉·박스투박스·완성형 FW로 다재다능한 스쿼드를 구성하세요.',
    badgeColor: '#f59e0b',
    category: 'specialist',
    philosophyTarget: 0,
    synergyPlaystyles: [
      'playmaker_10',
      'deep_playmaker',
      'box_to_box',
      'complete_forward',
    ],
  },
  big_game_hunter: {
    id: 'big_game_hunter',
    name: '빅게임 승부사',
    tagline: '강팀일수록 불타오르는 큰 경기 전문 감독',
    effectSummary:
      '상위 6팀 · OVR 84+ 강팀 · 컵 4강/결승 · UCL 토너먼트 시 A·M·D +2.6 · xG +0.14 | 궁합 선수 OVR +1',
    draftGuideTip:
      '큰 경기를 결정짓는 완성형 FW·선방형 GK·파이터 CB·플레이메이커로 중심축을 세우세요.',
    badgeColor: '#ef4444',
    category: 'specialist',
    philosophyTarget: 0,
    synergyPlaystyles: [
      'complete_forward',
      'stopper_cb',
      'shot_stopper',
      'playmaker_10',
    ],
  },
  set_piece_master: {
    id: 'set_piece_master',
    name: '세트피스 장인',
    tagline: '코너킥과 프리킥으로 승점을 수확하는 디테일',
    effectSummary:
      '궁합 1~6명 세트피스 xG +0.14~+0.28 · 코너/프리킥 2.8배 · 상대 xG -0.06 | 궁합 +1',
    draftGuideTip:
      '파이터 CB·완성형 FW·포처·후방조율 6명만 모아도 세트피스 화력이 최대치에 도달합니다.',
    badgeColor: '#14b8a6',
    category: 'specialist',
    philosophyTarget: 6,
    synergyPlaystyles: [
      'stopper_cb',
      'complete_forward',
      'deep_playmaker',
      'poacher',
    ],
  },
  underdog_killer: {
    id: 'underdog_killer',
    name: '언더독 킬러',
    tagline: '약팀을 이끌고 거인을 쓰러뜨리는 자이언트 킬러',
    effectSummary:
      '상대 OVR ≥ 우리 OVR 시 격차 비례 A·M·D +1.8 / +2.6 / +3.5 + 역전 xG·실점 억제 | 궁합 +1',
    draftGuideTip:
      '강팀 뒷공간을 찌르는 라인브레이커·볼위너·선방형 GK·박스투박스 조합이 자이언트 킬링에 최적입니다.',
    badgeColor: '#eab308',
    category: 'specialist',
    philosophyTarget: 0,
    synergyPlaystyles: [
      'line_breaker',
      'ball_winner',
      'shot_stopper',
      'box_to_box',
    ],
  },
  total_football: {
    id: 'total_football',
    name: '토탈 풋볼',
    tagline: '포지션의 경계를 허무는 유연한 스위칭 전술',
    effectSummary:
      '부포지션 페널티 0 · 동일라인 -2 · 타라인 -8 | 3포지션+ 멀티 1~5명 A·M·D +0.55/명 (최대 +2.75) · 개인 OVR +1',
    draftGuideTip:
      '포지션 3개 이상 소화 가능한 멀티 선수를 최대 5명까지 모으면 개인 +1과 팀 A·M·D가 함께 오릅니다.',
    badgeColor: '#06b6d4',
    category: 'specialist',
    philosophyTarget: 5,
    synergyPlaystyles: [],
  },
  galactico_manager: {
    id: 'galactico_manager',
    name: '갈락티코 매니저',
    tagline: '월드클래스 스타 군단을 하나로 묶는 카리스마',
    effectSummary:
      '선발 OVR 87+ · 클래식 1~4명 A·M·D +0.80/명 (최대 +3.2) · 개인 OVR +1',
    draftGuideTip:
      'OVR 87+ 월드클래스·슈퍼스타와 시대별 클래식을 최대 4명까지 모으면 예산 내에서 개인 +1과 팀 A·M·D가 함께 폭발합니다.',
    badgeColor: '#fbbf24',
    category: 'builder',
    philosophyTarget: 4,
    synergyPlaystyles: [],
  },
  direct_football: {
    id: 'direct_football',
    name: '다이렉트 풋볼',
    tagline: '군더더기 없는 종패스와 압도적 마무리',
    effectSummary:
      '전술 무관 상시 궁합 1~6명 ATT +3.0 · xG 최대 +0.16 | 직선 공격·종패스 자원 개인 OVR +1',
    draftGuideTip:
      '침투형·포처·완성형 FW·측면돌파·후방조율 6명을 모으면 어떤 전술이든 최전방 화력이 최대치에 도달합니다.',
    badgeColor: '#fb7185',
    category: 'builder',
    philosophyTarget: 6,
    synergyPlaystyles: [
      'line_breaker',
      'poacher',
      'complete_forward',
      'classic_winger',
      'deep_playmaker',
    ],
  },
  defensive_architect: {
    id: 'defensive_architect',
    name: '수비 조직력 전문가',
    tagline: '리그 최소 실점을 만드는 완벽한 간격 유지',
    effectSummary:
      '전술 무관 상시 궁합 1~6명 DEF +3.0 · 상대 xG 최대 -0.15 | 수비 핵심 자원 개인 OVR +1',
    draftGuideTip:
      '파이터 CB·빌드업 CB·볼위너·선방형 GK 6명을 모으면 어떤 전술에서도 최소 실점에 도전할 수 있습니다.',
    badgeColor: '#60a5fa',
    category: 'builder',
    philosophyTarget: 6,
    synergyPlaystyles: [
      'stopper_cb',
      'ball_playing_cb',
      'ball_winner',
      'shot_stopper',
    ],
  },
  midfield_maestro: {
    id: 'midfield_maestro',
    name: '중원 지배자',
    tagline: '허리를 장악하는 자가 경기를 지배한다',
    effectSummary:
      '전술 무관 상시 궁합 1~6명 MID +3.0 · 점유율 최대 +6% | 중원·빌드업 핵심 자원 개인 OVR +1',
    draftGuideTip:
      '후방조율·찬스메이커·B2B·볼위너·빌드업 CB 6명을 모으면 어떤 전술을 써도 중원을 완전히 장악합니다.',
    badgeColor: '#34d399',
    category: 'builder',
    philosophyTarget: 6,
    synergyPlaystyles: [
      'deep_playmaker',
      'playmaker_10',
      'box_to_box',
      'ball_winner',
      'ball_playing_cb',
    ],
  },
  super_sub: {
    id: 'super_sub',
    name: '교체 카드의 귀재',
    tagline: '후반전 벤치 투입으로 흐름을 단숨에 바꾼다',
    effectSummary:
      '후반 교체 투입 선수 전원 조커 OVR +3.0 · 팀 A/M/D +2.0/+1.5/+1.2 · 교체당 xG +0.11(최대 +0.33)',
    draftGuideTip:
      '벤치까지 라인브레이커·포처·크랙 및 체력(STA) 86+ 자원을 두텁게 챙겨 후반 승부를 뒤집으세요.',
    badgeColor: '#f472b6',
    category: 'specialist',
    philosophyTarget: 0,
    synergyPlaystyles: [
      'line_breaker',
      'poacher',
      'inverted_winger',
      'classic_winger',
    ],
  },
};

export const MANAGER_TRAIT_LIST: ManagerTraitConfig[] =
  Object.values(MANAGER_TRAITS);

export interface ManagerPlayerSynergyEval {
  isMatch: boolean;
  bonus: number; // 0 or 1 (decoupled flat +1 for all matching players, no cap with neighbor synergy)
  badgeLabel: string;
  reason: string;
  matchedPlaystyles: PlaystyleId[];
}

/**
 * Evaluates whether an individual player fits the active Manager Style (completely decoupled from player-to-player links).
 * Every matching player receives a clean flat +1 OVR without capping player link synergy.
 */
export function evaluateManagerPlayerSynergy(
  player: Player,
  managerTraitId: ManagerTraitId | null | undefined,
  _managerOvr = 84,
): ManagerPlayerSynergyEval {
  void _managerOvr;
  if (!managerTraitId) {
    return {
      isMatch: false,
      bonus: 0,
      badgeLabel: '',
      reason: '',
      matchedPlaystyles: [],
    };
  }

  const trait = MANAGER_TRAITS[managerTraitId];
  if (!trait) {
    return {
      isMatch: false,
      bonus: 0,
      badgeLabel: '',
      reason: '',
      matchedPlaystyles: [],
    };
  }

  const matchedPlaystyles = player.playstyles.filter((ps) =>
    trait.synergyPlaystyles.includes(ps),
  );

  // Special trait-specific criteria beyond playstyles
  if (
    managerTraitId === 'galactico_manager' &&
    (player.isLegend || player.ovr >= 87)
  ) {
    return {
      isMatch: true,
      bonus: 1,
      badgeLabel: '감독 궁합',
      reason: `${trait.name}: ${player.isLegend ? `${player.classicEra ?? ''} 클래식`.trim() : `월드클래스+(OVR ${player.ovr})`} (+1 OVR)`,
      matchedPlaystyles,
    };
  }

  if (
    managerTraitId === 'total_football' &&
    player.mainPositions.length + player.secondaryPositions.length >= 3
  ) {
    return {
      isMatch: true,
      bonus: 1,
      badgeLabel: '감독 궁합',
      reason: `${trait.name}: 멀티 포지션 스위칭 (+1 OVR)`,
      matchedPlaystyles,
    };
  }

  if (managerTraitId === 'super_sub' && (player.stamina ?? 80) >= 86) {
    return {
      isMatch: true,
      bonus: 1,
      badgeLabel: '감독 궁합',
      reason: `${trait.name}: 고체력(STA ${player.stamina}) (+1 OVR)`,
      matchedPlaystyles,
    };
  }

  if (matchedPlaystyles.length > 0) {
    const names = matchedPlaystyles
      .map((ps) => PLAYSTYLES[ps]?.shortName ?? ps)
      .join('·');
    return {
      isMatch: true,
      bonus: 1,
      badgeLabel: '감독 궁합',
      reason: `${trait.name} (${names}) (+1 OVR)`,
      matchedPlaystyles,
    };
  }

  return {
    isMatch: false,
    bonus: 0,
    badgeLabel: '',
    reason: '',
    matchedPlaystyles: [],
  };
}

export interface ManagerTeamEffectInput {
  traitId: ManagerTraitId | null | undefined;
  starters: (Player | null)[];
  tactic?: TacticId;
  /** Optional match-day / live context for situational specialist traits */
  userAvgOvr?: number;
  oppAvgOvr?: number;
  opponentRank?: number;
  isBigKnockout?: boolean;
  halftimeAdjusted?: boolean;
  halftimeSubsMade?: number;
  isSecondHalf?: boolean;
  trailingAtHalftime?: boolean;
  /** True during full-match quick/auto-sim so halftime_wizard & super_sub apply realistic 2nd-half averaged impact */
  isFullMatchQuickSim?: boolean;
}

export interface ManagerTeamEffectResult {
  category: ManagerTraitCategory;
  matchedCount: number;
  targetCount: number;
  progressRatio: number; // 0..1
  isTacticSynergyActive: boolean;
  isSituationalActive: boolean;
  /** Always-on / tactic-matching bonuses displayed live on Squad/Draft/Tactics A/M/D */
  baseAttDelta: number;
  baseMidDelta: number;
  baseDefDelta: number;
  /** Situational match bonuses (big_game, underdog, halftime, super_sub) */
  situationalAttDelta: number;
  situationalMidDelta: number;
  situationalDefDelta: number;
  /** Combined total (base + situational) */
  attDelta: number;
  midDelta: number;
  defDelta: number;
  xgBonus: number;
  oppXgPenalty: number;
  possessionBonus: number;
  halftimeTacticMultiplier: number;
  staminaDrainMult: number; // multiplier applied on top of TACTIC_STAMINA_MULT (e.g. 1.15/1.35 for gegenpress_guru)
  jokerOvrLift: number; // 1.4 default, 3.0 for super_sub
  /** Short, clean summary badge text for UI (no verbose prose) */
  compactSummary: string;
  situationalBadge?: string;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function formatStatDeltaParts(att: number, mid: number, def: number): string {
  const a = Math.round(att * 10) / 10;
  const m = Math.round(mid * 10) / 10;
  const d = Math.round(def * 10) / 10;
  if (a > 0 && a === m && m === d) {
    return `A·M·D +${a.toFixed(1)}`;
  }
  const parts: string[] = [];
  if (a > 0) parts.push(`A +${a.toFixed(1)}`);
  if (m > 0) parts.push(`M +${m.toFixed(1)}`);
  if (d > 0) parts.push(`D +${d.toFixed(1)}`);
  return parts.join(' · ');
}

/**
 * Single Source of Truth for all 14 Manager Trait team-level effects.
 * Used identically by `calculateTeamRatings` (live A/M/D UI across Solo/Draft/Transfer/UCL/MP/Dream)
 * and `matchEngine` (with zero double-counting via `TeamRatings.managerAtt/Mid/DefBonus`).
 */
export function evaluateManagerTeamEffect(
  input: ManagerTeamEffectInput,
): ManagerTeamEffectResult {
  const {
    traitId,
    starters,
    tactic = 'balanced',
    userAvgOvr,
    oppAvgOvr,
    opponentRank,
    isBigKnockout = false,
    halftimeAdjusted = false,
    halftimeSubsMade = 0,
    isSecondHalf = false,
    trailingAtHalftime = false,
    isFullMatchQuickSim = false,
  } = input;

  const empty: ManagerTeamEffectResult = {
    category: 'specialist',
    matchedCount: 0,
    targetCount: 0,
    progressRatio: 0,
    isTacticSynergyActive: false,
    isSituationalActive: false,
    baseAttDelta: 0,
    baseMidDelta: 0,
    baseDefDelta: 0,
    situationalAttDelta: 0,
    situationalMidDelta: 0,
    situationalDefDelta: 0,
    attDelta: 0,
    midDelta: 0,
    defDelta: 0,
    xgBonus: 0,
    oppXgPenalty: 0,
    possessionBonus: 0,
    halftimeTacticMultiplier: 1.0,
    staminaDrainMult: 1.0,
    jokerOvrLift: 1.4,
    compactSummary: '',
  };

  if (!traitId) return empty;
  const cfg = MANAGER_TRAITS[traitId];
  if (!cfg) return empty;

  const filled = starters.filter((p): p is Player => p !== null);
  const targetCount = cfg.philosophyTarget;

  // 100% unified matching: every player with ★ manager fit increments matchedCount identically
  const matchedCount = filled.filter(
    (p) => evaluateManagerPlayerSynergy(p, traitId).isMatch,
  ).length;

  const progressRatio =
    targetCount > 0 ? Math.min(1, matchedCount / targetCount) : 0;
  const isTacticSynergyActive = Boolean(
    cfg.synergyTactic && cfg.synergyTactic === tactic,
  );

  let baseAttDelta = 0;
  let baseMidDelta = 0;
  let baseDefDelta = 0;
  let situationalAttDelta = 0;
  let situationalMidDelta = 0;
  let situationalDefDelta = 0;
  let xgBonus = 0;
  let oppXgPenalty = 0;
  let possessionBonus = 0;
  let halftimeTacticMultiplier = 1.0;
  let staminaDrainMult = 1.0;
  let jokerOvrLift = 1.4;
  let isSituationalActive = false;
  let situationalBadge: string | undefined;

  switch (traitId) {
    // ── Group A: Tactic + 1..11 Builder Managers ───────────────────────────
    case 'tiki_taka':
      baseMidDelta += 3.0 * progressRatio;
      possessionBonus += 6 * progressRatio;
      if (isTacticSynergyActive) {
        baseAttDelta += 0.9;
        baseMidDelta += 0.9;
      }
      break;

    case 'gegenpress_guru':
      baseAttDelta += 2.0 * progressRatio;
      baseMidDelta += 1.6 * progressRatio;
      if (isTacticSynergyActive) {
        baseAttDelta += 0.7;
        baseDefDelta += 0.7;
        staminaDrainMult = 1.15 / 1.35; // mitigates gegenpressing stamina drain 1.35 -> 1.15
      }
      break;

    case 'catenaccio':
      baseDefDelta += 3.0 * progressRatio;
      if (isTacticSynergyActive) {
        baseDefDelta += 1.1;
        oppXgPenalty += 0.12;
      }
      break;

    case 'wing_bomber':
      baseAttDelta += 2.4 * progressRatio;
      if (isTacticSynergyActive) {
        baseAttDelta += 1.1;
        xgBonus += 0.12;
      }
      break;

    // ── Group B: Always-On Line Specialists (1..6 players) ─────────────────
    case 'defensive_architect':
      baseDefDelta += 3.0 * progressRatio;
      oppXgPenalty += 0.15 * progressRatio;
      break;

    case 'midfield_maestro':
      baseMidDelta += 3.0 * progressRatio;
      possessionBonus += 6 * progressRatio;
      break;

    case 'direct_football':
      baseAttDelta += 3.0 * progressRatio;
      xgBonus += 0.16 * progressRatio;
      break;

    case 'galactico_manager': {
      // OVR 89+ / Legend 1..4 players (+0.80/player, max +3.20 A·M·D)
      const lift = 3.2 * progressRatio;
      baseAttDelta += lift;
      baseMidDelta += lift;
      baseDefDelta += lift;
      break;
    }

    // ── Group C: Signature Specialists ─────────────────────────────────────
    case 'total_football': {
      // Position penalty 0/-2/-8 in positionEngine + 3+ position multi-player bonus (1..5 players, +0.55/player, max +2.75 A·M·D)
      const lift = 2.75 * progressRatio;
      baseAttDelta += lift;
      baseMidDelta += lift;
      baseDefDelta += lift;
      break;
    }

    case 'set_piece_master':
      // Scales set-piece xG cleanly from +0.14 up to +0.28 across 1..6 aerial/set-piece specialists
      xgBonus += 0.14 + 0.14 * progressRatio;
      oppXgPenalty += 0.06;
      break;

    case 'big_game_hunter': {
      const isBig =
        isBigKnockout ||
        (opponentRank !== undefined && opponentRank <= 6) ||
        (oppAvgOvr !== undefined && oppAvgOvr >= 84);
      if (isBig) {
        isSituationalActive = true;
        situationalAttDelta += 2.6;
        situationalMidDelta += 2.6;
        situationalDefDelta += 2.6;
        xgBonus += 0.14;
        situationalBadge = '빅게임 A·M·D +2.6';
      }
      break;
    }

    case 'underdog_killer': {
      if (userAvgOvr !== undefined && oppAvgOvr !== undefined && userAvgOvr <= oppAvgOvr) {
        const gap = oppAvgOvr - userAvgOvr;
        isSituationalActive = true;
        if (gap >= 5) {
          situationalAttDelta += 3.5;
          situationalMidDelta += 3.5;
          situationalDefDelta += 3.5;
          xgBonus += 0.16;
          oppXgPenalty += 0.12;
          situationalBadge = '자이언트 킬러 A·M·D +3.5';
        } else if (gap >= 2) {
          situationalAttDelta += 2.6;
          situationalMidDelta += 2.6;
          situationalDefDelta += 2.6;
          oppXgPenalty += 0.1;
          situationalBadge = '언더독 A·M·D +2.6';
        } else {
          situationalAttDelta += 1.8;
          situationalMidDelta += 1.8;
          situationalDefDelta += 1.8;
          situationalBadge = '언더독 A·M·D +1.8';
        }
      }
      break;
    }

    case 'halftime_wizard':
      if (isSecondHalf && halftimeAdjusted) {
        isSituationalActive = true;
        halftimeTacticMultiplier = 1.8;
        situationalAttDelta += 1.6 + (trailingAtHalftime ? 0.8 : 0);
        situationalMidDelta += 1.4;
        situationalDefDelta += 1.2;
        xgBonus += 0.2 + (trailingAtHalftime ? 0.12 : 0);
        situationalBadge = trailingAtHalftime
          ? '라커룸 역전 · 스윙 1.8배'
          : '하프타임 전환 · 스윙 1.8배';
      } else if (isFullMatchQuickSim) {
        // Quick/auto-sim averages the coach's 2nd-half halftime adaptation across 90 minutes
        isSituationalActive = true;
        situationalAttDelta += 1.0;
        situationalMidDelta += 0.9;
        situationalDefDelta += 0.8;
        xgBonus += 0.14;
      }
      break;

    case 'super_sub':
      jokerOvrLift = 3.0;
      if (isSecondHalf && halftimeSubsMade > 0) {
        isSituationalActive = true;
        situationalAttDelta += 2.0;
        situationalMidDelta += 1.5;
        situationalDefDelta += 1.2;
        xgBonus += Math.min(0.33, halftimeSubsMade * 0.11);
        situationalBadge = `조커 ${halftimeSubsMade}명 · OVR +3.0`;
      } else if (isFullMatchQuickSim) {
        // Quick/auto-sim averages 2nd-half super-sub impact across 90 minutes
        isSituationalActive = true;
        const effectiveQuickSubs = Math.max(2, halftimeSubsMade);
        situationalAttDelta += 1.0;
        situationalMidDelta += 0.8;
        situationalDefDelta += 0.6;
        xgBonus += Math.min(0.18, effectiveQuickSubs * 0.06);
      }
      break;
  }

  baseAttDelta = round2(baseAttDelta);
  baseMidDelta = round2(baseMidDelta);
  baseDefDelta = round2(baseDefDelta);
  situationalAttDelta = round2(situationalAttDelta);
  situationalMidDelta = round2(situationalMidDelta);
  situationalDefDelta = round2(situationalDefDelta);

  const attDelta = round2(baseAttDelta + situationalAttDelta);
  const midDelta = round2(baseMidDelta + situationalMidDelta);
  const defDelta = round2(baseDefDelta + situationalDefDelta);

  // Build crisp, zero-clutter summary label for UI
  const statText = formatStatDeltaParts(baseAttDelta, baseMidDelta, baseDefDelta);
  let compactSummary = statText;
  if (!compactSummary) {
    if (traitId === 'set_piece_master') {
      compactSummary = `세트피스 xG +${xgBonus.toFixed(2)}`;
    } else if (traitId === 'big_game_hunter') {
      compactSummary = situationalBadge ?? '강팀·토너먼트 A·M·D +2.6';
    } else if (traitId === 'underdog_killer') {
      compactSummary = situationalBadge ?? '동급↑ 상대 A·M·D +1.8~3.5';
    } else if (traitId === 'halftime_wizard') {
      compactSummary = '하프타임 전환 1.8배';
    } else if (traitId === 'super_sub') {
      compactSummary = '교체 조커 OVR +3.0';
    } else if (traitId === 'total_football') {
      compactSummary = '부포지션 0 · 3포지션+ 멀티';
    }
  } else if (isTacticSynergyActive && cfg.synergyTactic) {
    compactSummary = `${compactSummary} (추천 전술)`;
  }

  return {
    category: cfg.category,
    matchedCount,
    targetCount,
    progressRatio: round2(progressRatio),
    isTacticSynergyActive,
    isSituationalActive,
    baseAttDelta,
    baseMidDelta,
    baseDefDelta,
    situationalAttDelta,
    situationalMidDelta,
    situationalDefDelta,
    attDelta,
    midDelta,
    defDelta,
    xgBonus: round2(xgBonus),
    oppXgPenalty: round2(oppXgPenalty),
    possessionBonus: round2(possessionBonus),
    halftimeTacticMultiplier,
    staminaDrainMult,
    jokerOvrLift,
    compactSummary,
    situationalBadge,
  };
}

export type ManagerFitScalingMode = 'progressive' | 'situational';

export interface ManagerFitStarterEntry {
  slotIndex: number;
  player: Player;
  /** True if this starter increments the 1..11 team-level scaling (always false for situational specialists) */
  countsForTeamEffect: boolean;
  /** True if this starter receives individual ★+1 OVR manager synergy */
  hasPersonalSynergy: boolean;
  reason: string;
}

export interface ManagerFitMilestone {
  count: number;
  attDelta: number;
  midDelta: number;
  defDelta: number;
  ovrDelta: number;
  summary: string;
  reached: boolean;
}

export interface ManagerFitSituationalRule {
  shortTrigger: string;
  triggerLabel: string;
  effectLabel: string;
  note: string;
}

export interface ManagerFitDetail {
  traitId: ManagerTraitId;
  config: ManagerTraitConfig;
  scalingMode: ManagerFitScalingMode;
  /** Headline numerator out of totalSlots (identical for personal ★+1 and team scaling on progressive traits) */
  matchedCount: number;
  /** Target denominator: 6 for rare-criteria traits (total_football / galactico_manager), 11 for style builders & situational */
  totalSlots: number;
  filledCount: number;
  /** Starters receiving individual ★+1 OVR */
  personalMatchedCount: number;
  /** Starters scaling team stats (0 for situational traits whose team effect does not depend on count) */
  teamScalingMatchedCount: number;
  /** Always false now that all 10 progressive traits share a 100% unified criteria */
  hasSeparatePersonalCriteria: boolean;
  effect: ManagerTeamEffectResult;
  /** Team OVR lift from baseAtt/Mid/Def deltas = (ΔA + ΔM + ΔD) / 3 */
  teamLineOvrDelta: number;
  /** Average OVR lift across 11 starters from personal ★+1 bonuses */
  personalAvgOvrDelta: number;
  /** Combined visible team OVR lift */
  totalOvrDelta: number;
  /** Short active effect chips for 1-line UI display */
  activeBoostChips: string[];
  /** Criteria labels for matching players */
  criteriaLabels: string[];
  /** Korean tactic label if this manager has a recommended synergy tactic */
  synergyTacticLabel: string | null;
  /** Recommended tactic bonus description (for Group A managers) */
  tacticSynergyBonusLabel: string | null;
  /** Per-player scaling step description for progressive traits (null for situational) */
  perPlayerStepLabel: string | null;
  /** Next milestone (2/4/6 or 3/6/9/11) for progressive traits */
  nextMilestone: {
    targetCount: number;
    remaining: number;
    summary: string;
  } | null;
  /** Milestone reference table (empty for situational traits so players never think count scales team effect) */
  milestones: ManagerFitMilestone[];
  /** Explicit trigger & non-scaling note for the 4 situational specialists */
  situationalRule: ManagerFitSituationalRule | null;
  /** Matched starters */
  matchedStarters: ManagerFitStarterEntry[];
  /** Filled starters that do not match this manager */
  unmatchedStarters: { slotIndex: number; player: Player }[];
}

const SYNERGY_TACTIC_LABELS: Record<TacticId, string> = {
  balanced: '밸런스',
  possession: '점유율',
  gegenpressing: '압박',
  counter: '역습',
  wingplay: '측면',
};

const TACTIC_SYNERGY_BONUS_LABELS: Partial<Record<ManagerTraitId, string>> = {
  tiki_taka: '점유율 전술 시 ATT +0.9 · MID +0.9 추가',
  gegenpress_guru: '압박 전술 시 ATT +0.7 · DEF +0.7 · 체력 소모 완화',
  catenaccio: '역습 전술 시 DEF +1.1 · 상대 xG -0.12 추가',
  wing_bomber: '측면 전술 시 ATT +1.1 · xG +0.12 추가',
};

const PER_PLAYER_STEP_LABELS: Partial<Record<ManagerTraitId, string>> = {
  tiki_taka: '+1명당 MID +0.27 · 점유율 +0.5%',
  gegenpress_guru: '+1명당 ATT +0.18 · MID +0.15',
  catenaccio: '+1명당 DEF +0.27',
  wing_bomber: '+1명당 ATT +0.40 (최대 6명)',
  direct_football: '+1명당 ATT +0.50 · xG +0.027 (최대 6명)',
  defensive_architect: '+1명당 DEF +0.50 · 상대 xG -0.025 (최대 6명)',
  midfield_maestro: '+1명당 MID +0.50 · 점유율 +1.0% (최대 6명)',
  galactico_manager: '+1명당 A·M·D +0.80 (최대 4명)',
  total_football: '+1명당 A·M·D +0.55 (최대 5명)',
  set_piece_master: '기본 xG +0.14 + 1명당 +0.023 (최대 6명 · +0.28)',
};

const SITUATIONAL_RULES: Partial<
  Record<ManagerTraitId, ManagerFitSituationalRule>
> = {
  big_game_hunter: {
    shortTrigger: '강팀·빅매치 +2.6',
    triggerLabel: '상위 6팀 · OVR 84+ · 컵 4강/결승 · UCL 토너먼트',
    effectLabel: 'A·M·D +2.6 · xG +0.14',
    note: '팀 특수 효과는 궁합 인원(n/11)과 무관하게 조건 충족 시 100% 발동합니다. 궁합이 맞는 선발 선수에게는 개인 ★+1 OVR만 별도 적용됩니다.',
  },
  underdog_killer: {
    shortTrigger: '동급↑ 상대 +1.8~3.5',
    triggerLabel: '상대 팀 평균 OVR ≥ 우리 팀 평균 OVR',
    effectLabel: '격차별 A·M·D +1.8 / +2.6 / +3.5 · xG/수비 보정',
    note: '팀 특수 효과는 궁합 인원(n/11)과 무관하게 상대 전력 조건 충족 시 100% 발동합니다. 궁합이 맞는 선발 선수에게는 개인 ★+1 OVR만 별도 적용됩니다.',
  },
  halftime_wizard: {
    shortTrigger: '하프타임 전환 1.8배',
    triggerLabel: '하프타임 전술 또는 포메이션 변경 시',
    effectLabel: '후반 스윙 1.8배 · A/M/D +1.6/+1.4/+1.2 · xG +0.20 (열세 시 추가)',
    note: '팀 특수 효과는 궁합 인원(n/11)과 무관하게 하프타임 조정 시 100% 발동합니다. 궁합이 맞는 선발 선수에게는 개인 ★+1 OVR만 별도 적용됩니다.',
  },
  super_sub: {
    shortTrigger: '후반 조커 +3.0',
    triggerLabel: '후반 벤치 선수 교체 투입 시',
    effectLabel: '조커 OVR +3.0 · A/M/D +2.0/+1.5/+1.2 · 교체당 xG +0.11',
    note: '팀 특수 효과는 궁합 인원(n/11)과 무관하게 후반 교체 시 100% 발동합니다. 궁합이 맞는 선발 선수에게는 개인 ★+1 OVR만 별도 적용됩니다.',
  },
};

function buildMilestoneAtCount(
  traitId: ManagerTraitId,
  count: number,
  targetCount: number,
  currentCount: number,
): ManagerFitMilestone {
  const ratio = Math.min(1, count / Math.max(1, targetCount));
  let att = 0;
  let mid = 0;
  let def = 0;
  let extra = '';

  switch (traitId) {
    case 'tiki_taka':
      mid = 3.0 * ratio;
      extra = `점유 +${(6 * ratio).toFixed(1)}%`;
      break;
    case 'gegenpress_guru':
      att = 2.0 * ratio;
      mid = 1.6 * ratio;
      break;
    case 'catenaccio':
      def = 3.0 * ratio;
      break;
    case 'wing_bomber':
      att = 2.4 * ratio;
      break;
    case 'defensive_architect':
      def = 3.0 * ratio;
      extra = `상대 xG -${(0.15 * ratio).toFixed(2)}`;
      break;
    case 'midfield_maestro':
      mid = 3.0 * ratio;
      extra = `점유 +${(6 * ratio).toFixed(1)}%`;
      break;
    case 'direct_football':
      att = 3.0 * ratio;
      extra = `xG +${(0.16 * ratio).toFixed(2)}`;
      break;
    case 'galactico_manager': {
      const lift = 3.2 * ratio;
      att = lift;
      mid = lift;
      def = lift;
      break;
    }
    case 'total_football': {
      const lift = 2.75 * ratio;
      att = lift;
      mid = lift;
      def = lift;
      break;
    }
    case 'set_piece_master':
      extra = `세트피스 xG +${(0.14 + 0.14 * ratio).toFixed(2)}`;
      break;
    default:
      break;
  }

  const attDelta = round2(att);
  const midDelta = round2(mid);
  const defDelta = round2(def);
  const ovrDelta = round2((attDelta + midDelta + defDelta) / 3);
  const statStr = formatStatDeltaParts(attDelta, midDelta, defDelta);
  const summary = [statStr, extra].filter(Boolean).join(' · ');

  return {
    count,
    attDelta,
    midDelta,
    defDelta,
    ovrDelta,
    summary,
    reached: currentCount >= count,
  };
}

function getCriteriaLabels(traitId: ManagerTraitId): string[] {
  const cfg = MANAGER_TRAITS[traitId];
  if (!cfg) return [];
  if (traitId === 'galactico_manager') {
    return ['OVR 87+ · 클래식'];
  }
  if (traitId === 'total_football') {
    return ['3포지션+ 멀티'];
  }
  const styleNames = cfg.synergyPlaystyles.map(
    (ps) => PLAYSTYLES[ps]?.shortName ?? PLAYSTYLES[ps]?.name ?? ps,
  );
  if (traitId === 'super_sub') {
    return ['체력 86+', ...styleNames];
  }
  return styleNames;
}

/**
 * Single Source of Truth detail evaluator for Manager Fit UI across all Draft & Squad screens.
 * Strictly mirrors `evaluateManagerTeamEffect` and `evaluateManagerPlayerSynergy` without duplicating formulas.
 */
export function evaluateManagerFitDetail(params: {
  traitId: ManagerTraitId | null | undefined;
  starters: (Player | null)[];
  tactic?: TacticId;
}): ManagerFitDetail | null {
  const { traitId, starters, tactic = 'balanced' } = params;
  if (!traitId) return null;
  const cfg = MANAGER_TRAITS[traitId];
  if (!cfg) return null;

  const effect = evaluateManagerTeamEffect({ traitId, starters, tactic });
  const scalingMode: ManagerFitScalingMode =
    cfg.philosophyTarget > 0 ? 'progressive' : 'situational';
  const totalSlots = cfg.philosophyTarget > 0 ? cfg.philosophyTarget : 11;

  const matchedStarters: ManagerFitStarterEntry[] = [];
  const unmatchedStarters: { slotIndex: number; player: Player }[] = [];
  let filledCount = 0;
  let personalMatchedCount = 0;
  let teamScalingMatchedCount = 0;

  starters.forEach((player, slotIndex) => {
    if (!player) return;
    filledCount += 1;
    const personal = evaluateManagerPlayerSynergy(player, traitId);
    const countsForTeam = scalingMode === 'progressive' && personal.isMatch;
    if (personal.isMatch) personalMatchedCount += 1;
    if (countsForTeam) teamScalingMatchedCount += 1;

    if (personal.isMatch) {
      matchedStarters.push({
        slotIndex,
        player,
        countsForTeamEffect: countsForTeam,
        hasPersonalSynergy: true,
        reason: personal.reason,
      });
    } else {
      unmatchedStarters.push({ slotIndex, player });
    }
  });

  const matchedCount = personalMatchedCount;

  const teamLineOvrDelta = round2(
    (effect.baseAttDelta + effect.baseMidDelta + effect.baseDefDelta) / 3,
  );
  const personalAvgOvrDelta = round2(personalMatchedCount / 11);
  const totalOvrDelta = round2(teamLineOvrDelta + personalAvgOvrDelta);

  const activeBoostChips: string[] = [];
  const situationalRule =
    scalingMode === 'situational' ? (SITUATIONAL_RULES[traitId] ?? null) : null;

  if (scalingMode === 'situational' && situationalRule) {
    activeBoostChips.push('팀 효과 인원 무관');
    activeBoostChips.push(situationalRule.shortTrigger);
  } else {
    const statPart = formatStatDeltaParts(
      effect.baseAttDelta,
      effect.baseMidDelta,
      effect.baseDefDelta,
    );
    if (statPart) {
      activeBoostChips.push(statPart);
    }
    if (traitId === 'set_piece_master') {
      activeBoostChips.push(`세트피스 xG +${effect.xgBonus.toFixed(2)}`);
      activeBoostChips.push(`상대 xG -${effect.oppXgPenalty.toFixed(2)}`);
    } else {
      if (effect.possessionBonus > 0) {
        activeBoostChips.push(`점유 +${effect.possessionBonus.toFixed(1)}%`);
      }
      if (effect.xgBonus > 0) {
        activeBoostChips.push(`xG +${effect.xgBonus.toFixed(2)}`);
      }
      if (effect.oppXgPenalty > 0) {
        activeBoostChips.push(`상대 xG -${effect.oppXgPenalty.toFixed(2)}`);
      }
      if (traitId === 'total_football') {
        activeBoostChips.push('부포 페널티 0');
      }
      if (traitId === 'gegenpress_guru' && effect.isTacticSynergyActive) {
        activeBoostChips.push('체력소모↓');
      }
    }
  }

  const milestoneCounts =
    totalSlots === 4
      ? [1, 2, 4]
      : totalSlots === 5
        ? [1, 3, 5]
        : totalSlots === 6
          ? [2, 4, 6]
          : [3, 6, 9, 11];
  const milestones: ManagerFitMilestone[] =
    scalingMode === 'progressive'
      ? milestoneCounts.map((c) =>
          buildMilestoneAtCount(traitId, c, totalSlots, matchedCount),
        )
      : [];

  const nextMs = milestones.find((m) => m.count > matchedCount) ?? null;
  const nextMilestone = nextMs
    ? {
        targetCount: nextMs.count,
        remaining: nextMs.count - matchedCount,
        summary: nextMs.summary,
      }
    : null;

  return {
    traitId,
    config: cfg,
    scalingMode,
    matchedCount,
    totalSlots,
    filledCount,
    personalMatchedCount,
    teamScalingMatchedCount,
    hasSeparatePersonalCriteria: false,
    effect,
    teamLineOvrDelta,
    personalAvgOvrDelta,
    totalOvrDelta,
    activeBoostChips,
    criteriaLabels: getCriteriaLabels(traitId),
    synergyTacticLabel: cfg.synergyTactic
      ? SYNERGY_TACTIC_LABELS[cfg.synergyTactic]
      : null,
    tacticSynergyBonusLabel: TACTIC_SYNERGY_BONUS_LABELS[traitId] ?? null,
    perPlayerStepLabel: PER_PLAYER_STEP_LABELS[traitId] ?? null,
    nextMilestone,
    milestones,
    situationalRule,
    matchedStarters,
    unmatchedStarters,
  };
}
