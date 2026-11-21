import type { ManagerTraitId } from '../types/game';
import type { TacticId } from '../types/league';
import type { Player, PlaystyleId } from '../types/player';
import { PLAYSTYLES } from './playstyles';

export interface ManagerTraitConfig {
  id: ManagerTraitId;
  name: string;
  tagline: string;
  effectSummary: string;
  draftGuideTip: string;
  badgeColor: string;
  synergyTactic?: TacticId;
  synergyPlaystyles: PlaystyleId[];
}

export const MANAGER_TRAITS: Record<ManagerTraitId, ManagerTraitConfig> = {
  tiki_taka: {
    id: 'tiki_taka',
    name: '티키타카 마스터',
    tagline: '완벽한 삼각 패스와 점유율 축구',
    effectSummary:
      '점유율 전술 시 실효 평점 +1.0 · 플레이메이커/볼플레잉 선수 감독 시너지 OVR +1',
    draftGuideTip:
      '딥라잉 플레이메이커·찬스메이커·빌드업 CB·인버티드 크랙을 우선 영입해 점유율 축구를 완성하세요.',
    badgeColor: '#38bdf8',
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
      '게겐프레싱 전술 시 실효 평점 +1.0 · B2B/볼위너/침투형/윙백 감독 시너지 OVR +1',
    draftGuideTip:
      '활동량이 높은 박스투박스·볼위너·라인브레이커·공격형 윙백을 모으면 압박 효율이 폭발합니다.',
    badgeColor: '#f97316',
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
      '선수비 후역습 전술 시 실효 DEF +1.8 · 파이터 CB/선방형 GK/볼위너 감독 시너지 OVR +1',
    draftGuideTip:
      '파이터형 센터백·선방형 키퍼·볼위너로 골문을 걸어 잠그고, 라인브레이커로 역습 한 방을 노리세요.',
    badgeColor: '#94a3b8',
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
      '측면 공략 전술 시 실효 ATT +1.4 · 윙어/공격형 윙백/포처 감독 시너지 OVR +1',
    draftGuideTip:
      '클래식 윙어·공격형 윙백의 크로스를 마무리할 박스 포처·완성형 FW 조합이 최상입니다.',
    badgeColor: '#22c55e',
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
      '하프타임 전술·포메이션 변경 시 후반 전술 보정 1.5배 증폭 · 전술 이해도 높은 핵심 자원 OVR +1',
    draftGuideTip:
      '후반 전술 전환에 능한 플레이메이커·딥라잉·박스투박스·완성형 공격수를 고르게 배치하세요.',
    badgeColor: '#f59e0b',
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
      '리그 상위 6팀(또는 평균 OVR 84+ 강팀) 상대 시 실효 팀 전력 +1.4 보너스 · 빅매치 클러치 자원 OVR +1',
    draftGuideTip:
      '큰 경기를 결정짓는 완성형 공격수·선방형 키퍼·파이터 CB·플레이메이커로 중심축을 세우세요.',
    badgeColor: '#ef4444',
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
      '매 경기 세트피스 기대득점 +0.13 xG 보너스 · 제공권·킥 정교함 특화 선수 감독 시너지 OVR +1',
    draftGuideTip:
      '제공권이 강한 파이터 CB·완성형 FW·포처와 정교한 킥의 딥라잉 플레이메이커를 추천합니다.',
    badgeColor: '#14b8a6',
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
      '상대보다 평균 OVR이 낮을 때 역전 보정 +1.8 OVR 발동 · 역습/수비 특화 자원 OVR +1',
    draftGuideTip:
      '강팀 뒷공간을 찌르는 라인브레이커·클래식 윙어와 중원 볼위너·선방형 키퍼 조합이 강력합니다.',
    badgeColor: '#eab308',
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
      '부포지션/호환 페널티 -3 → -1, 같은 라인 비적합 -6 → -3 완화 · 멀티 포지션/올라운더 OVR +1',
    draftGuideTip:
      '3개 이상 포지션 소화 가능한 멀티플레이어와 박스투박스·완성형 FW·빌드업 CB를 적극 뽑으세요.',
    badgeColor: '#06b6d4',
    synergyPlaystyles: ['box_to_box', 'complete_forward', 'ball_playing_cb'],
  },
  galactico_manager: {
    id: 'galactico_manager',
    name: '갈락티코 매니저',
    tagline: '월드클래스 스타 군단을 하나로 묶는 카리스마',
    effectSummary:
      '선발 슈퍼스타(91+)·레전드 1명당 실효 전력 +0.35 (최대 +1.8) & 스타/레전드 개인 OVR +1',
    draftGuideTip:
      'OVR 88+ 월드클래스·슈퍼스타·레전드와 창의적 크랙(플레이메이커·인버티드 윙어)을 우선 확보하세요.',
    badgeColor: '#fbbf24',
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
      '라인브레이커·포처·완성형 공격수 보유 시 실효 ATT +1.3 및 득점 전환 효율 상승 · 직선 공격 자원 OVR +1',
    draftGuideTip:
      '라인브레이커·박스 포처·완성형 스트라이커와 빠른 클래식 윙어로 직선적인 화력을 극대화하세요.',
    badgeColor: '#fb7185',
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
      '상시 실효 DEF +1.2 및 상대 기대득점(xG) -0.10 억제 · 수비 핵심 자원 감독 시너지 OVR +1',
    draftGuideTip:
      '파이터 CB·빌드업 CB·볼위너·선방형 키퍼를 탄탄히 갖추면 리그 최소 실점에 도전할 수 있습니다.',
    badgeColor: '#60a5fa',
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
      '경기 점유율 +4% 및 실효 MID +1.4 보너스 · 미드필더 핵심 스타일 감독 시너지 OVR +1',
    draftGuideTip:
      '딥라잉 플레이메이커·창의적 플레이메이커·박스투박스·볼위너로 중원 3인방을 구성하세요.',
    badgeColor: '#34d399',
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
      '하프타임 교체 투입 시 후반전 실효 전력 +1.7 보너스 · 폭발적 조커/고체력(STA 86+) 자원 OVR +1',
    draftGuideTip:
      '후반 승부를 뒤집을 라인브레이커·포처·인버티드 크랙 및 체력(STA) 86+ 선수를 벤치까지 챙기세요.',
    badgeColor: '#f472b6',
    synergyPlaystyles: ['line_breaker', 'poacher', 'inverted_winger', 'classic_winger'],
  },
};

export const MANAGER_TRAIT_LIST: ManagerTraitConfig[] =
  Object.values(MANAGER_TRAITS);

export interface ManagerPlayerSynergyEval {
  isMatch: boolean;
  bonus: number; // 0 or 1
  badgeLabel: string;
  reason: string;
  matchedPlaystyles: PlaystyleId[];
}

/**
 * Evaluates whether an individual player synergizes with the active Manager Trait.
 * Used across Draft, Transfer Market, PitchBoard individual OVR boost, and Match Engine.
 */
export function evaluateManagerPlayerSynergy(
  player: Player,
  managerTraitId: ManagerTraitId | null | undefined,
): ManagerPlayerSynergyEval {
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
  if (managerTraitId === 'galactico_manager' && (player.isLegend || player.ovr >= 88)) {
    return {
      isMatch: true,
      bonus: 1,
      badgeLabel: '감독 시너지',
      reason: `${trait.name}: ${player.isLegend ? '레전드' : `월드클래스(OVR ${player.ovr})`} 스타 보너스 (+1 OVR)`,
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
      badgeLabel: '감독 시너지',
      reason: `${trait.name}: 멀티 포지션 스위칭 적합 자원 (+1 OVR)`,
      matchedPlaystyles,
    };
  }

  if (managerTraitId === 'super_sub' && (player.stamina ?? 80) >= 86) {
    return {
      isMatch: true,
      bonus: 1,
      badgeLabel: '감독 시너지',
      reason: `${trait.name}: 고체력(STA ${player.stamina}) 후반 압도 자원 (+1 OVR)`,
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
      badgeLabel: '감독 시너지',
      reason: `${trait.name} 핵심 스타일 일치 (${names}) (+1 OVR)`,
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
