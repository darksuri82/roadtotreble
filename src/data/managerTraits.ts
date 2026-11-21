import type { ManagerTraitId } from '../types/game';
import type { TacticId } from '../types/league';
import type { PlaystyleId } from '../types/player';

export interface ManagerTraitConfig {
  id: ManagerTraitId;
  name: string;
  tagline: string;
  effectSummary: string;
  badgeColor: string;
  synergyTactic?: TacticId;
  synergyPlaystyles?: PlaystyleId[];
}

export const MANAGER_TRAITS: Record<ManagerTraitId, ManagerTraitConfig> = {
  tiki_taka: {
    id: 'tiki_taka',
    name: '티키타카 마스터',
    tagline: '완벽한 삼각 패스와 점유율 축구',
    effectSummary:
      '점유율 전술 사용 시 실효 평점 +1.2 · 플레이메이커/볼플레잉 선수 전술 케미 보너스',
    badgeColor: '#38bdf8',
    synergyTactic: 'possession',
    synergyPlaystyles: ['deep_playmaker', 'playmaker_10', 'ball_playing_cb', 'inverted_winger'],
  },
  gegenpress_guru: {
    id: 'gegenpress_guru',
    name: '게겐프레싱 전도사',
    tagline: '전방 압박이 최고의 플레이메이커',
    effectSummary:
      '게겐프레싱 전술 사용 시 실효 평점 +1.2 · 박스투박스/볼위너/침투형 선수 시너지 강화',
    badgeColor: '#f97316',
    synergyTactic: 'gegenpressing',
    synergyPlaystyles: ['box_to_box', 'ball_winner', 'line_breaker', 'attacking_wingback'],
  },
  catenaccio: {
    id: 'catenaccio',
    name: '카테나치오',
    tagline: '질식 수비와 치명적 한 방의 역습',
    effectSummary:
      '선수비 후역습 전술 시 실효 DEF +2.2 · 파이터형 수비수/선방형 키퍼 실점 억제 대폭 상승',
    badgeColor: '#94a3b8',
    synergyTactic: 'counter',
    synergyPlaystyles: ['stopper_cb', 'shot_stopper', 'ball_winner', 'line_breaker'],
  },
  wing_bomber: {
    id: 'wing_bomber',
    name: '측면 폭격기',
    tagline: '하프스페이스와 터치라인을 가르는 폭격',
    effectSummary:
      '측면 공략 전술 시 실효 ATT +1.8 · 윙어/공격형 윙백 크로스·돌파 xG 보너스',
    badgeColor: '#22c55e',
    synergyTactic: 'wingplay',
    synergyPlaystyles: ['attacking_wingback', 'classic_winger', 'inverted_winger', 'poacher'],
  },
  halftime_wizard: {
    id: 'halftime_wizard',
    name: '하프타임 마법사',
    tagline: '라커룸 연설로 경기를 뒤집는 전략가',
    effectSummary:
      '하프타임 전술·포메이션 변경 시 후반전 전술 보정 효과 1.5배 증폭 (+후반 xG 보너스)',
    badgeColor: '#f59e0b',
  },
  big_game_hunter: {
    id: 'big_game_hunter',
    name: '빅게임 승부사',
    tagline: '강팀일수록 불타오르는 큰 경기 전문 감독',
    effectSummary:
      '현재 리그 상위 6팀(또는 평균 OVR 83+ 강팀) 상대 시 실효 팀 전력 +1.8 보너스',
    badgeColor: '#ef4444',
  },
  set_piece_master: {
    id: 'set_piece_master',
    name: '세트피스 장인',
    tagline: '코너킥과 프리킥으로 승점을 수확하는 디테일',
    effectSummary:
      '매 경기 고정 세트피스 기대득점 +0.18 xG 보너스 (박빙 승부 결정력 대폭 상승)',
    badgeColor: '#14b8a6',
    synergyPlaystyles: ['stopper_cb', 'complete_forward', 'deep_playmaker'],
  },
  underdog_killer: {
    id: 'underdog_killer',
    name: '언더독 킬러',
    tagline: '약팀을 이끌고 거인을 쓰러뜨리는 자이언트 킬러',
    effectSummary:
      '상대 팀보다 평균 OVR이 낮을 때 역전 보정 +2.2 OVR 발동',
    badgeColor: '#eab308',
  },
  total_football: {
    id: 'total_football',
    name: '토탈 풋볼',
    tagline: '포지션의 경계를 허무는 유연한 스위칭 전술',
    effectSummary:
      '부포지션/호환 페널티 -3 → -1, 같은 라인 비적합 페널티 -6 → -3으로 대폭 완화',
    badgeColor: '#06b6d4',
    synergyPlaystyles: ['box_to_box', 'complete_forward', 'ball_playing_cb'],
  },
  galactico_manager: {
    id: 'galactico_manager',
    name: '갈락티코 매니저',
    tagline: '월드클래스 스타 군단을 하나로 묶는 카리스마',
    effectSummary:
      '선발 슈퍼스타(91+)·레전드 1명당 실효 팀 전력 +0.45 (최대 +2.2) & 스타 케미 보너스',
    badgeColor: '#fbbf24',
  },
  direct_football: {
    id: 'direct_football',
    name: '다이렉트 풋볼',
    tagline: '군더더기 없는 종패스와 압도적 마무리',
    effectSummary:
      '라인브레이커·포처·완성형 공격수 보유 시 실효 ATT +1.6 및 득점 전환 효율 상승',
    badgeColor: '#fb7185',
    synergyPlaystyles: ['line_breaker', 'poacher', 'complete_forward'],
  },
  defensive_architect: {
    id: 'defensive_architect',
    name: '수비 조직력 전문가',
    tagline: '리그 최소 실점을 만드는 완벽한 간격 유지',
    effectSummary:
      '전술 무관 상시 실효 DEF +1.6 및 상대 기대득점(xG) -0.14 억제 (클린시트 특화)',
    badgeColor: '#60a5fa',
    synergyPlaystyles: ['stopper_cb', 'ball_playing_cb', 'ball_winner', 'shot_stopper'],
  },
  midfield_maestro: {
    id: 'midfield_maestro',
    name: '중원 지배자',
    tagline: '허리를 장악하는 자가 경기를 지배한다',
    effectSummary:
      '경기 점유율 +4% 및 실효 MID +1.8 보너스 (미드필더 주도권 강화)',
    badgeColor: '#34d399',
    synergyPlaystyles: ['deep_playmaker', 'playmaker_10', 'box_to_box'],
  },
  super_sub: {
    id: 'super_sub',
    name: '교체 카드의 귀재',
    tagline: '후반전 벤치 투입으로 흐름을 단숨에 바꾼다',
    effectSummary:
      '하프타임 교체 투입 시 후반전 팀 실효 전력 +2.0 보너스 (일반 자동 진행 시에도 후반 +0.8)',
    badgeColor: '#f472b6',
  },
};

export const MANAGER_TRAIT_LIST: ManagerTraitConfig[] =
  Object.values(MANAGER_TRAITS);
