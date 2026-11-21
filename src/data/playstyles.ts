import type { TacticId } from '../types/league';
import type { PlaystyleId } from '../types/player';

export interface PlaystyleMeta {
  id: PlaystyleId;
  name: string;
  shortName: string;
  description: string;
  bestTactics: TacticId[];
  roleGroup: 'finisher' | 'creator' | 'runner' | 'destroyer' | 'defender' | 'keeper';
}

export const PLAYSTYLES: Record<PlaystyleId, PlaystyleMeta> = {
  line_breaker: {
    id: 'line_breaker',
    name: '라인브레이커',
    shortName: '침투형',
    description: '폭발적인 스피드로 수비 뒷공간을 허무는 침투 특화 공격수',
    bestTactics: ['counter', 'gegenpressing', 'wingplay'],
    roleGroup: 'runner',
  },
  complete_forward: {
    id: 'complete_forward',
    name: '완성형 스트라이커',
    shortName: '완성형 FW',
    description: '연계·헤딩·마무리 모두 최상급인 올라운드 9번',
    bestTactics: ['possession', 'wingplay', 'balanced', 'counter'],
    roleGroup: 'finisher',
  },
  poacher: {
    id: 'poacher',
    name: '박스 포처',
    shortName: '포처',
    description: '페널티 박스 안 위치 선정과 원터치 결정력이 압도적인 골게터',
    bestTactics: ['wingplay', 'counter', 'balanced'],
    roleGroup: 'finisher',
  },
  inverted_winger: {
    id: 'inverted_winger',
    name: '인버티드 크랙',
    shortName: '크랙',
    description: '측면에서 안쪽으로 접고 들어와 드리블·슈팅으로 균열을 만드는 윙어',
    bestTactics: ['possession', 'gegenpressing', 'wingplay'],
    roleGroup: 'creator',
  },
  classic_winger: {
    id: 'classic_winger',
    name: '클래식 윙어',
    shortName: '측면돌파',
    description: '터치라인 돌파와 날카로운 얼리 크로스로 박스 안을 폭격하는 윙어',
    bestTactics: ['wingplay', 'counter'],
    roleGroup: 'runner',
  },
  playmaker_10: {
    id: 'playmaker_10',
    name: '창의적 플레이메이커',
    shortName: '찬스메이커',
    description: '킬패스와 하프스페이스 탈압박으로 결정적 기회를 창출하는 10번',
    bestTactics: ['possession', 'balanced', 'gegenpressing'],
    roleGroup: 'creator',
  },
  box_to_box: {
    id: 'box_to_box',
    name: '박스투박스',
    shortName: 'B2B',
    description: '왕성한 활동량으로 공수 양면 압박과 침투를 책임지는 엔진',
    bestTactics: ['gegenpressing', 'balanced', 'counter'],
    roleGroup: 'runner',
  },
  deep_playmaker: {
    id: 'deep_playmaker',
    name: '딥라잉 플레이메이커',
    shortName: '후방조율',
    description: '후방에서 경기 템포를 조율하고 전진 패스를 뿌리는 사령관',
    bestTactics: ['possession', 'balanced'],
    roleGroup: 'creator',
  },
  ball_winner: {
    id: 'ball_winner',
    name: '볼위닝 미드필더',
    shortName: '볼위너',
    description: '강한 태클과 인터셉트로 상대 역습을 차단하는 중원 파수꾼',
    bestTactics: ['gegenpressing', 'counter', 'balanced'],
    roleGroup: 'destroyer',
  },
  attacking_wingback: {
    id: 'attacking_wingback',
    name: '공격형 윙백',
    shortName: '오버래핑',
    description: '폭발적인 오버래핑과 크로스로 측면 수적 우위를 만드는 풀백/윙백',
    bestTactics: ['wingplay', 'gegenpressing', 'possession'],
    roleGroup: 'runner',
  },
  ball_playing_cb: {
    id: 'ball_playing_cb',
    name: '볼플레잉 수비수',
    shortName: '빌드업 CB',
    description: '침착한 전진 패스와 넓은 커버 범위로 후방 빌드업을 이끄는 수비수',
    bestTactics: ['possession', 'gegenpressing', 'balanced'],
    roleGroup: 'defender',
  },
  stopper_cb: {
    id: 'stopper_cb',
    name: '파이터형 수비수',
    shortName: '파이터 CB',
    description: '대인 방어·공중볼·몸을 던지는 블록에 특화된 철벽 센터백',
    bestTactics: ['counter', 'balanced', 'wingplay'],
    roleGroup: 'defender',
  },
  sweeper_keeper: {
    id: 'sweeper_keeper',
    name: '스위퍼 키퍼',
    shortName: '스위퍼 GK',
    description: '높은 수비라인 배후 커버와 정확한 롱킥·빌드업이 강점인 현대 골키퍼',
    bestTactics: ['possession', 'gegenpressing'],
    roleGroup: 'keeper',
  },
  shot_stopper: {
    id: 'shot_stopper',
    name: '선방형 키퍼',
    shortName: '슈퍼세이브',
    description: '동물적인 반사신경과 1대1 선방으로 실점을 막아내는 수호신',
    bestTactics: ['counter', 'balanced', 'wingplay'],
    roleGroup: 'keeper',
  },
};

export function doesPlaystyleFitTactic(
  playstyles: PlaystyleId[],
  tactic: TacticId,
): boolean {
  if (tactic === 'balanced') {
    return playstyles.some((ps) => PLAYSTYLES[ps]?.bestTactics.includes('balanced'));
  }
  return playstyles.some((ps) => PLAYSTYLES[ps]?.bestTactics.includes(tactic));
}
