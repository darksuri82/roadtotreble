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
      '궁합 1~8명 MID +2.4 · 점유율 +5% | 점유율 전술 시 ATT +0.8 · MID +0.8 추가 | 궁합 선수 OVR +1',
    draftGuideTip:
      '딥라잉·플레이메이커·빌드업 CB·인버티드 윙어를 모을수록 중원과 점유율이 극대화됩니다.',
    badgeColor: '#38bdf8',
    category: 'builder',
    philosophyTarget: 8,
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
      '궁합 1~8명 ATT +1.6 · MID +1.2 | 압박 전술 시 ATT/DEF +0.6 · 체력 소모 완화(1.35→1.15배) | 궁합 +1',
    draftGuideTip:
      '박스투박스·볼위너·라인브레이커·공격형 윙백을 모으면 90분 내내 지치지 않는 전방 압박이 완성됩니다.',
    badgeColor: '#f97316',
    category: 'builder',
    philosophyTarget: 8,
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
      '궁합 1~8명 DEF +2.4 | 역습 전술 시 DEF +1.0 · 상대 xG -0.10 추가 | 궁합 선수 OVR +1',
    draftGuideTip:
      '파이터 CB·선방형 GK·볼위너·라인브레이커를 모으고 역습 전술을 쓰면 극단적 빗장수비가 완성됩니다.',
    badgeColor: '#94a3b8',
    category: 'builder',
    philosophyTarget: 8,
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
      '궁합 1~8명 ATT +2.2 | 측면 전술 시 ATT +1.0 · xG +0.10 추가 | 궁합 선수 OVR +1',
    draftGuideTip:
      '윙어·공격형 윙백·포처를 모으고 측면 공략을 쓰면 크로스와 컷백 화력이 폭발합니다.',
    badgeColor: '#22c55e',
    category: 'builder',
    philosophyTarget: 8,
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
      '하프타임 전술·포메이션 변경 시 후반 스윙 1.8배 · A/M/D +1.4/+1.2/+1.0 · xG +0.18 (열세 시 추가 ATT +0.8 · xG +0.10)',
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
      '상위 6팀 · OVR 84+ 강팀 · 컵 4강/결승 · UCL 토너먼트 시 전 라인 +2.4 · xG +0.12 | 궁합 선수 OVR +1',
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
      '매 경기 세트피스 xG +0.18~+0.32 (궁합 비례) · 코너/프리킥 2.8배 · 상대 xG -0.08 | 궁합 +1',
    draftGuideTip:
      '제공권이 강한 파이터 CB·완성형 FW·포처와 킥이 정교한 딥라잉 플레이메이커를 모으세요.',
    badgeColor: '#14b8a6',
    category: 'specialist',
    philosophyTarget: 8,
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
      '상대 OVR ≥ 우리 OVR 시 격차 비례 전 라인 +1.6 / +2.4 / +3.2 + 역전 xG·실점 억제 | 궁합 +1',
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
      '부포지션 페널티 0 · 동일라인 -2 · 타라인 -8 | 멀티포지션(3+) 1명당 전 라인 +0.25 (최대 +1.5) | 궁합 +1',
    draftGuideTip:
      '3개 이상 포지션 소화 가능한 멀티플레이어와 박스투박스·완성형 FW·빌드업 CB를 적극 영입하세요.',
    badgeColor: '#06b6d4',
    category: 'specialist',
    philosophyTarget: 6,
    synergyPlaystyles: ['box_to_box', 'complete_forward', 'ball_playing_cb'],
  },
  galactico_manager: {
    id: 'galactico_manager',
    name: '갈락티코 매니저',
    tagline: '월드클래스 스타 군단을 하나로 묶는 카리스마',
    effectSummary:
      '선발 91+·레전드 1명당 전 라인 +0.4 (최대 6명 +2.4) | 88+·레전드 개인 궁합 OVR +1',
    draftGuideTip:
      'OVR 91+ 슈퍼스타·레전드를 최대한 확보할수록 팀 전체 화력과 위압감이 폭발합니다.',
    badgeColor: '#fbbf24',
    category: 'builder',
    philosophyTarget: 6,
    synergyPlaystyles: [
      'complete_forward',
      'inverted_winger',
      'playmaker_10',
    ],
  },
  direct_football: {
    id: 'direct_football',
    name: '다이렉트 풋볼',
    tagline: '군더더기 없는 종패스와 압도적 마무리',
    effectSummary:
      '전술 무관 상시 궁합 1~8명 ATT +2.8 · xG 최대 +0.16 | 직선 공격 자원 개인 OVR +1',
    draftGuideTip:
      '라인브레이커·포처·완성형 FW·클래식 윙어를 모으면 어떤 전술이든 최전방 화력이 폭발합니다.',
    badgeColor: '#fb7185',
    category: 'builder',
    philosophyTarget: 8,
    synergyPlaystyles: [
      'line_breaker',
      'poacher',
      'complete_forward',
      'classic_winger',
    ],
  },
  defensive_architect: {
    id: 'defensive_architect',
    name: '수비 조직력 전문가',
    tagline: '리그 최소 실점을 만드는 완벽한 간격 유지',
    effectSummary:
      '전술 무관 상시 궁합 1~8명 DEF +2.6 · 상대 xG 최대 -0.14 | 수비 핵심 자원 개인 OVR +1',
    draftGuideTip:
      '파이터 CB·빌드업 CB·볼위너·선방형 GK를 모으면 어떤 전술에서도 최소 실점에 도전할 수 있습니다.',
    badgeColor: '#60a5fa',
    category: 'builder',
    philosophyTarget: 8,
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
      '전술 무관 상시 궁합 1~8명 MID +2.8 · 점유율 최대 +6% | 미드필더 핵심 자원 개인 OVR +1',
    draftGuideTip:
      '딥라잉·플레이메이커·박스투박스·볼위너를 모으면 어떤 전술을 써도 중원을 완전히 장악합니다.',
    badgeColor: '#34d399',
    category: 'builder',
    philosophyTarget: 8,
    synergyPlaystyles: [
      'deep_playmaker',
      'playmaker_10',
      'box_to_box',
      'ball_winner',
    ],
  },
  super_sub: {
    id: 'super_sub',
    name: '교체 카드의 귀재',
    tagline: '후반전 벤치 투입으로 흐름을 단숨에 바꾼다',
    effectSummary:
      '후반 교체 투입 선수 전원 조커 OVR +3.0 · 팀 A/M/D +1.8/+1.4/+1.0 · 교체당 xG +0.10(최대 +0.30)',
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
    (player.isLegend || player.ovr >= 88)
  ) {
    return {
      isMatch: true,
      bonus: 1,
      badgeLabel: '감독 궁합',
      reason: `${trait.name}: ${player.isLegend ? '레전드' : `월드클래스(OVR ${player.ovr})`} (+1 OVR)`,
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
    return `전라인 +${a.toFixed(1)}`;
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

  // Determine philosophy count based on each manager's authentic identity
  let matchedCount = 0;
  if (traitId === 'galactico_manager') {
    matchedCount = filled.filter((p) => p.isLegend || p.ovr >= 91).length;
  } else if (traitId === 'total_football') {
    matchedCount = filled.filter(
      (p) => p.mainPositions.length + p.secondaryPositions.length >= 3,
    ).length;
  } else {
    matchedCount = filled.filter(
      (p) => evaluateManagerPlayerSynergy(p, traitId).isMatch,
    ).length;
  }

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
    // ── Group A: Tactic + 1..8 Builder Managers ────────────────────────────
    case 'tiki_taka':
      baseMidDelta += 2.4 * progressRatio;
      possessionBonus += 5 * progressRatio;
      if (isTacticSynergyActive) {
        baseAttDelta += 0.8;
        baseMidDelta += 0.8;
      }
      break;

    case 'gegenpress_guru':
      baseAttDelta += 1.6 * progressRatio;
      baseMidDelta += 1.2 * progressRatio;
      if (isTacticSynergyActive) {
        baseAttDelta += 0.6;
        baseDefDelta += 0.6;
        staminaDrainMult = 1.15 / 1.35; // mitigates gegenpressing stamina drain 1.35 -> 1.15
      }
      break;

    case 'catenaccio':
      baseDefDelta += 2.4 * progressRatio;
      if (isTacticSynergyActive) {
        baseDefDelta += 1.0;
        oppXgPenalty += 0.1;
      }
      break;

    case 'wing_bomber':
      baseAttDelta += 2.2 * progressRatio;
      if (isTacticSynergyActive) {
        baseAttDelta += 1.0;
        xgBonus += 0.1;
      }
      break;

    // ── Group B: Always-On Style Builders ──────────────────────────────────
    case 'defensive_architect':
      baseDefDelta += 2.6 * progressRatio;
      oppXgPenalty += 0.14 * progressRatio;
      break;

    case 'midfield_maestro':
      baseMidDelta += 2.8 * progressRatio;
      possessionBonus += 6 * progressRatio;
      break;

    case 'direct_football':
      baseAttDelta += 2.8 * progressRatio;
      xgBonus += 0.16 * progressRatio;
      break;

    case 'galactico_manager': {
      const lift = Math.min(2.4, matchedCount * 0.4);
      baseAttDelta += lift;
      baseMidDelta += lift;
      baseDefDelta += lift;
      break;
    }

    // ── Group C: Signature Specialists (no forced 1..8 generic A/M/D) ──────
    case 'total_football': {
      // Main identity: position penalty 0/-2/-8 in positionEngine + multi-position switching bonus
      const lift = Math.min(1.5, matchedCount * 0.25);
      baseAttDelta += lift;
      baseMidDelta += lift;
      baseDefDelta += lift;
      break;
    }

    case 'set_piece_master':
      // Scales set-piece xG cleanly from +0.18 up to +0.32 with aerial/set-piece specialists
      xgBonus += 0.18 + 0.14 * progressRatio;
      oppXgPenalty += 0.08;
      break;

    case 'big_game_hunter': {
      const isBig =
        isBigKnockout ||
        (opponentRank !== undefined && opponentRank <= 6) ||
        (oppAvgOvr !== undefined && oppAvgOvr >= 84);
      if (isBig) {
        isSituationalActive = true;
        situationalAttDelta += 2.4;
        situationalMidDelta += 2.4;
        situationalDefDelta += 2.4;
        xgBonus += 0.12;
        situationalBadge = '빅게임 발동 · 전라인 +2.4';
      }
      break;
    }

    case 'underdog_killer': {
      if (userAvgOvr !== undefined && oppAvgOvr !== undefined && userAvgOvr <= oppAvgOvr) {
        const gap = oppAvgOvr - userAvgOvr;
        isSituationalActive = true;
        if (gap >= 5) {
          situationalAttDelta += 3.2;
          situationalMidDelta += 3.2;
          situationalDefDelta += 3.2;
          xgBonus += 0.15;
          oppXgPenalty += 0.12;
          situationalBadge = '자이언트 킬러 · 전라인 +3.2';
        } else if (gap >= 2) {
          situationalAttDelta += 2.4;
          situationalMidDelta += 2.4;
          situationalDefDelta += 2.4;
          oppXgPenalty += 0.1;
          situationalBadge = '언더독 발동 · 전라인 +2.4';
        } else {
          situationalAttDelta += 1.6;
          situationalMidDelta += 1.6;
          situationalDefDelta += 1.6;
          situationalBadge = '언더독 발동 · 전라인 +1.6';
        }
      }
      break;
    }

    case 'halftime_wizard':
      if (isSecondHalf && halftimeAdjusted) {
        isSituationalActive = true;
        halftimeTacticMultiplier = 1.8;
        situationalAttDelta += 1.4 + (trailingAtHalftime ? 0.8 : 0);
        situationalMidDelta += 1.2;
        situationalDefDelta += 1.0;
        xgBonus += 0.18 + (trailingAtHalftime ? 0.1 : 0);
        situationalBadge = trailingAtHalftime
          ? '라커룸 대역전 발동 · 스윙 1.8배'
          : '하프타임 마법사 발동 · 스윙 1.8배';
      }
      break;

    case 'super_sub':
      jokerOvrLift = 3.0;
      if (isSecondHalf && halftimeSubsMade > 0) {
        isSituationalActive = true;
        situationalAttDelta += 1.8;
        situationalMidDelta += 1.4;
        situationalDefDelta += 1.0;
        xgBonus += Math.min(0.3, halftimeSubsMade * 0.1);
        situationalBadge = `조커 ${halftimeSubsMade}명 발동 · OVR +3.0`;
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
      compactSummary = situationalBadge ?? '강팀·토너먼트 시 +2.4';
    } else if (traitId === 'underdog_killer') {
      compactSummary = situationalBadge ?? '동급↑ 상대 시 +1.6~3.2';
    } else if (traitId === 'halftime_wizard') {
      compactSummary = '하프타임 전환 시 1.8배';
    } else if (traitId === 'super_sub') {
      compactSummary = '교체 조커 OVR +3.0';
    } else if (traitId === 'total_football') {
      compactSummary = '부포지션 0 · 멀티 스위칭';
    }
  } else if (isTacticSynergyActive && cfg.synergyTactic) {
    compactSummary = `${compactSummary} · ★전술`;
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
