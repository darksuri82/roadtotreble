import { calculateChemistry } from '../engine/chemistryEngine';
import { getPlayerAttributes } from '../engine/attributeEngine';
import type { FormationId, ManagerAvatarConfig, ManagerTraitId, UserClubProfile } from '../types/game';
import type { LeagueId, TacticId } from '../types/league';
import type { HistoricalBestXiPlayer, HistoricalTeamEntry } from '../types/legacy';
import type { ClassicEra, Player, PlaystyleId, Position, SubPosition } from '../types/player';
import { FORMATIONS } from './formations';
import { evaluateManagerPlayerSynergy } from './managerTraits';

type EraPlayerTuple = [
  id: string,
  name: string,
  era: ClassicEra,
  seasonTag: string,
  position: Position,
  mainPositions: SubPosition[],
  secondaryPositions: SubPosition[],
  ovr: number,
  nationality: string,
  nationalityCode: string,
  att: number,
  mid: number,
  def: number,
  stamina: number,
  playstyles: PlaystyleId[],
  scoutNote: string,
];

function makeEraPlayer(t: EraPlayerTuple): Player {
  const [
    id,
    name,
    era,
    seasonTag,
    position,
    mainPositions,
    secondaryPositions,
    ovr,
    nationality,
    nationalityCode,
    att,
    mid,
    def,
    stamina,
    playstyles,
    scoutNote,
  ] = t;
  const base: Player = {
    id,
    name,
    position,
    mainPositions,
    secondaryPositions,
    ovr,
    nationality,
    nationalityCode,
    leagueId: 'LEGEND',
    club: `${era} 베스트 11`,
    att,
    mid,
    def,
    stamina,
    playstyles,
    scoutNote,
    isLegend: true,
    classicEra: era,
    classicSeasonTag: seasonTag,
  };
  base.attrs = getPlayerAttributes(base);
  return base;
}

interface EraTeamSpec {
  id: string;
  seasonLabel: string;
  displayName: string;
  nickname: string;
  managerName: string;
  managerTraitId: ManagerTraitId;
  managerRating: number;
  managerStyleNote: string;
  managerAvatar: ManagerAvatarConfig;
  userClub: UserClubProfile;
  leagueId: LeagueId;
  leagueKoreanName: string;
  formation: FormationId;
  defaultTactic: TacticId;
  summaryNote: string;
  starters: EraPlayerTuple[];
  bench: EraPlayerTuple[];
}

const ERA_SPECS: EraTeamSpec[] = [
  // =========================================================================
  // 1. 1960s ALL-STAR BEST XI (4-3-3)
  // =========================================================================
  {
    id: 'era-60s-xi',
    seasonLabel: '60s',
    displayName: '1960s 올스타 베스트 11',
    nickname: '축구 황제 펠레·야신·가린샤의 태동기',
    managerName: '엘레니오 에레라',
    managerTraitId: 'catenaccio',
    managerRating: 96,
    managerStyleNote: '그란데 인테르 유러피언컵 2연패, 카테나치오를 완성한 60년대 최고 명장',
    managerAvatar: { gender: 'male', skinTone: 'peach', hairStyle: 'slick', hairColor: 'silver', outfit: 'classic_suit' },
    userClub: { name: '1960s 베스트 11', shortName: '60S', primaryColor: '#b45309', secondaryColor: '#1b140d', pattern: 'sash' },
    leagueId: 'seriea',
    leagueKoreanName: '시대별 올스타',
    formation: '4-3-3',
    defaultTactic: 'counter',
    summaryNote: '펠레·야신·가린샤에 더해 보비 무어·파케티·자우마 산투스·보비 찰턴·잔니 리베라·조지 베스트·에우제비우·고든 뱅크스까지 1960년대 세계 축구를 지배한 전설들의 올스타',
    starters: [
      ['era60-gk-1', '레프 야신', '60s', '1963', 'GK', ['GK'], [], 93, '러시아', 'RU', 32, 68, 94, 83, ['shot_stopper', 'sweeper_keeper'], '유일한 GK 발롱도르, 검은 거미'],
      ['era60-lb-1', '자친토 파케티', '60s', '1965', 'DF', ['LB', 'LWB'], ['CB'], 91, '이탈리아', 'IT', 76, 84, 92, 91, ['attacking_wingback'], '공격형 풀백의 시초, 그란데 인테르의 캡틴'],
      ['era60-cb-1', '보비 무어', '60s', '1966', 'DF', ['CB'], ['CDM'], 92, '잉글랜드', 'GB', 62, 84, 94, 88, ['ball_playing_cb', 'stopper_cb'], '66 월드컵 우승 주장, 예측 수비의 교과서'],
      ['era60-cb-2', '체사레 말디니', '60s', '1963', 'DF', ['CB'], ['RB'], 90, '이탈리아', 'IT', 56, 78, 93, 87, ['stopper_cb', 'ball_playing_cb'], '63 유러피언컵 우승 AC 밀란 캡틴, 말디니 가문의 시조'],
      ['era60-rb-1', '자우마 산투스', '60s', '1962', 'DF', ['RB', 'RWB'], ['CB'], 91, '브라질', 'BR', 74, 84, 92, 91, ['attacking_wingback', 'stopper_cb'], '월드컵 2회 우승·3회 연속 올스타팀, 브라질 원조 우풀백'],
      ['era60-cdm-1', '루이스 수아레스 미라몬테스', '60s', '1964', 'MF', ['CDM', 'CM'], ['CAM'], 92, '스페인', 'ES', 82, 94, 80, 88, ['deep_playmaker', 'playmaker_10'], '60 발롱도르·유로 64·유러피언컵 2연패, 그란데 인테르의 건축가'],
      ['era60-cm-1', '보비 찰턴', '60s', '1966', 'MF', ['CM', 'CAM'], ['LW'], 93, '잉글랜드', 'GB', 91, 93, 68, 90, ['playmaker_10', 'box_to_box'], '66 발롱도르·월드컵 우승, 대포알 양발 중거리'],
      ['era60-cm-2', '잔니 리베라', '60s', '1969', 'MF', ['CM', 'CAM'], [], 91, '이탈리아', 'IT', 85, 94, 58, 84, ['playmaker_10'], '69 발롱도르, AC 밀란 황금 소년'],
      ['era60-lw-1', '조지 베스트', '60s', '1968', 'FW', ['LW', 'RW'], ['CAM'], 93, '북아일랜드', 'GB', 93, 88, 48, 86, ['inverted_winger', 'classic_winger'], '68 발롱도르, 다섯 번째 비틀즈의 천재 드리블'],
      ['era60-st-1', '펠레', '60s', '1962', 'FW', ['ST', 'CAM'], ['LW', 'RW'], 96, '브라질', 'BR', 97, 92, 58, 90, ['complete_forward', 'playmaker_10'], '월드컵 3회 우승, 축구 황제'],
      ['era60-rw-1', '가린샤', '60s', '1962', 'FW', ['RW', 'RM'], ['LW'], 92, '브라질', 'BR', 93, 86, 46, 86, ['classic_winger', 'inverted_winger'], '역대 최고 1대1 드리블의 국민들의 기쁨'],
    ],
    bench: [
      ['era60-b-1', '고든 뱅크스', '60s', '1966', 'GK', ['GK'], [], 91, '잉글랜드', 'GB', 28, 62, 92, 82, ['shot_stopper'], '66 월드컵 우승·세기의 선방의 잉글랜드 수문장'],
      ['era60-b-2', '닐톤 산투스', '60s', '1962', 'DF', ['LB', 'LWB'], [], 90, '브라질', 'BR', 75, 83, 90, 89, ['attacking_wingback'], '축구의 백과사전, 현대 공격형 레프트백의 원조'],
      ['era60-b-3', '산드로 마촐라', '60s', '1965', 'MF', ['CAM', 'CM'], ['RW'], 90, '이탈리아', 'IT', 88, 91, 60, 87, ['playmaker_10'], '그란데 인테르 원클럽맨 공격 에이스'],
      ['era60-b-4', '데니스 로', '60s', '1964', 'FW', ['ST'], [], 91, '스코틀랜드', 'GB', 93, 78, 46, 86, ['poacher', 'line_breaker'], '64 발롱도르 수상, 맨유 삼총사의 스트렛포드 킹'],
      ['era60-b-5', '에우제비우', '60s', '1966', 'FW', ['ST', 'CAM'], ['RW'], 93, '포르투갈', 'PT', 95, 84, 52, 89, ['line_breaker', 'complete_forward'], '65 발롱도르·66 월드컵 득점왕, 흑표범'],
    ],
  },

  // =========================================================================
  // 2. 1970s ALL-STAR BEST XI (4-3-3)
  // =========================================================================
  {
    id: 'era-70s-xi',
    seasonLabel: '70s',
    displayName: '1970s 올스타 베스트 11',
    nickname: '토탈 풋볼과 카이저 베켄바워의 시대',
    managerName: '리누스 미헬스',
    managerTraitId: 'total_football',
    managerRating: 97,
    managerStyleNote: '토탈 풋볼의 창시자, 전 포지션 스위칭과 압박의 선구자',
    managerAvatar: { gender: 'male', skinTone: 'light', hairStyle: 'parted', hairColor: 'silver', outfit: 'classic_suit' },
    userClub: { name: '1970s 베스트 11', shortName: '70S', primaryColor: '#ea580c', secondaryColor: '#1c120a', pattern: 'stripes' },
    leagueId: 'bundesliga',
    leagueKoreanName: '시대별 올스타',
    formation: '4-3-3',
    defaultTactic: 'possession',
    summaryNote: '베켄바워·크루이프·게르트 뮐러에 더해 제프 마이어·카를루스 아우베르투·가에타노 시레아·루드 크롤·요한 네스컨스·자이르지뉴·히벨리누·마리오 켐페스까지 70년대 황금 올스타',
    starters: [
      ['era70-gk-1', '제프 마이어', '70s', '1974', 'GK', ['GK'], [], 92, '독일', 'DE', 30, 64, 93, 83, ['shot_stopper'], '74 월드컵·유러피언컵 3연패, 안징의 고양이'],
      ['era70-lb-1', '루드 크롤', '70s', '1974', 'DF', ['LB', 'CB'], ['LWB'], 91, '네덜란드', 'NL', 75, 86, 92, 91, ['ball_playing_cb', 'attacking_wingback'], '아약스 유러피언컵 3연패·토탈 풋볼 최강 레프트백'],
      ['era70-cb-1', '프란츠 베켄바워', '70s', '1974', 'DF', ['CB', 'CDM'], ['CM'], 95, '독일', 'DE', 80, 93, 96, 89, ['ball_playing_cb', 'deep_playmaker'], '리베로를 완성한 카이저'],
      ['era70-cb-2', '가에타노 시레아', '70s', '1978', 'DF', ['CB'], ['CDM'], 91, '이탈리아', 'IT', 66, 86, 93, 87, ['ball_playing_cb'], '퇴장 0회의 신사 리베로'],
      ['era70-rb-1', '카를루스 아우베르투', '70s', '1970', 'DF', ['RB', 'RWB'], ['CB'], 92, '브라질', 'BR', 81, 86, 91, 91, ['attacking_wingback'], '1970 월드컵 결승 전설의 골, 브라질 위대한 주장'],
      ['era70-cdm-1', '요한 네스컨스', '70s', '1974', 'MF', ['CDM', 'CM'], ['RB'], 92, '네덜란드', 'NL', 82, 91, 88, 95, ['box_to_box', 'ball_winner'], '토탈 풋볼의 엔진, 요한 2세'],
      ['era70-cm-1', '파울 브라이트너', '70s', '1974', 'MF', ['CM', 'LB'], ['CDM'], 91, '독일', 'DE', 82, 90, 87, 92, ['box_to_box', 'deep_playmaker'], '74 월드컵·유로 72 우승, 독일의 만능 미드필더'],
      ['era70-cm-2', '요한 크루이프', '70s', '1974', 'MF', ['CM', 'CAM', 'ST'], ['LW'], 95, '네덜란드', 'NL', 94, 96, 66, 89, ['playmaker_10', 'complete_forward'], '토탈 풋볼의 상징, 발롱도르 3회'],
      ['era70-lw-1', '로베르토 히벨리누', '70s', '1970', 'FW', ['LW', 'CAM'], ['CM'], 91, '브라질', 'BR', 90, 92, 54, 86, ['inverted_winger', 'playmaker_10'], '70 월드컵 우승, 대포알 왼발과 플립플랩의 마술사'],
      ['era70-st-1', '게르트 뮐러', '70s', '1974', 'FW', ['ST'], [], 93, '독일', 'DE', 95, 77, 48, 85, ['poacher'], '박스 안 결정력의 폭격기'],
      ['era70-rw-1', '자이르지뉴', '70s', '1970', 'FW', ['RW', 'ST'], ['RM'], 92, '브라질', 'BR', 93, 84, 52, 91, ['line_breaker', 'inverted_winger'], '70 월드컵 전 경기 득점(7골), 브라질의 허리케인'],
    ],
    bench: [
      ['era70-b-1', '디노 조프', '70s', '1974', 'GK', ['GK'], [], 91, '이탈리아', 'IT', 30, 64, 92, 82, ['shot_stopper'], 'A매치 1142분 무실점, 70년대 유벤투스·이탈리아 수호신'],
      ['era70-b-2', '베르티 포크츠', '70s', '1974', 'DF', ['RB', 'CB'], [], 90, '독일', 'DE', 66, 78, 92, 93, ['stopper_cb'], '74 결승 크루이프 전담 마크, 독일의 테리어'],
      ['era70-b-3', '귄터 네처', '70s', '1972', 'MF', ['CM', 'CAM'], [], 91, '독일', 'DE', 84, 94, 62, 84, ['deep_playmaker', 'playmaker_10'], '유로 72 우승 주역, 70년대 분데스리가 최고의 지휘자'],
      ['era70-b-4', '마리오 켐페스', '70s', '1978', 'FW', ['ST', 'LW'], ['CAM'], 91, '아르헨티나', 'AR', 93, 83, 48, 88, ['complete_forward', 'line_breaker'], '78 월드컵 우승·골든볼·득점왕, 엘 마타도르'],
      ['era70-b-5', '케빈 키건', '70s', '1979', 'FW', ['RW', 'ST'], ['CAM'], 91, '잉글랜드', 'GB', 91, 86, 54, 92, ['inverted_winger', 'line_breaker'], '78·79 발롱도르 2연패, 리버풀·함부르크의 마이티 마우스'],
    ],
  },

  // =========================================================================
  // 3. 1980s ALL-STAR BEST XI (4-4-2 Diamond)
  // =========================================================================
  {
    id: 'era-80s-xi',
    seasonLabel: '80s',
    displayName: '1980s 올스타 베스트 11',
    nickname: '마라도나·플라티니·밀란 오렌지 삼총사',
    managerName: '아리고 사키',
    managerTraitId: 'gegenpress_guru',
    managerRating: 97,
    managerStyleNote: '현대 압박 축구와 컴팩트 지역 방어의 혁명가',
    managerAvatar: { gender: 'male', skinTone: 'peach', hairStyle: 'bald', hairColor: 'silver', outfit: 'navy_coat' },
    userClub: { name: '1980s 베스트 11', shortName: '80S', primaryColor: '#eab308', secondaryColor: '#1a1408', pattern: 'stripes' },
    leagueId: 'seriea',
    leagueKoreanName: '시대별 올스타',
    formation: '4-4-2-diamond',
    defaultTactic: 'gegenpressing',
    summaryNote: '마라도나·플라티니·마테우스·바레시·판 바스턴과 슈마허·베르고미·카브리니·소크라테스·굴리트·지쿠까지 1980년대 세리에A·월드컵 전성기 올스타',
    starters: [
      ['era80-gk-1', '디노 조프', '80s', '1982', 'GK', ['GK'], [], 91, '이탈리아', 'IT', 30, 64, 92, 82, ['shot_stopper'], '82 월드컵 40세 우승 주장'],
      ['era80-lb-1', '안드레아스 브레메', '80s', '1990', 'DF', ['LB', 'RB'], ['LWB'], 91, '독일', 'DE', 80, 87, 90, 92, ['attacking_wingback'], '양발 크로스와 결승골의 레프트백'],
      ['era80-cb-1', '프랑코 바레시', '80s', '1989', 'DF', ['CB'], ['CDM'], 94, '이탈리아', 'IT', 64, 84, 96, 88, ['ball_playing_cb', 'stopper_cb'], '밀란 영구 결번 6번'],
      ['era80-cb-2', '로날드 쿠만', '80s', '1988', 'DF', ['CB', 'CDM'], [], 91, '네덜란드', 'NL', 82, 89, 91, 86, ['ball_playing_cb', 'deep_playmaker'], '대포알 프리킥 빌드업 센터백'],
      ['era80-rb-1', '주세페 베르고미', '80s', '1988', 'DF', ['RB', 'CB'], [], 90, '이탈리아', 'IT', 66, 80, 92, 90, ['stopper_cb'], '인테르 원클럽맨, 18세 월드컵 우승 주역'],
      ['era80-cdm-1', '프랑크 레이카르트', '80s', '1989', 'MF', ['CDM', 'CB'], ['CM'], 92, '네덜란드', 'NL', 78, 91, 93, 93, ['ball_winner', 'deep_playmaker'], '밀란 제네레이션의 절대 홀딩'],
      ['era80-cm-1', '로타어 마테우스', '80s', '1990', 'MF', ['CM', 'CDM'], ['CAM'], 93, '독일', 'DE', 86, 94, 91, 96, ['box_to_box', 'ball_winner'], '90 발롱도르, 공수 완벽 엔진'],
      ['era80-cm-2', '미셸 플라티니', '80s', '1984', 'MF', ['CAM', 'CM'], [], 93, '프랑스', 'FR', 92, 95, 62, 86, ['playmaker_10', 'deep_playmaker'], '발롱도르 3연패 프랑스 10번'],
      ['era80-cam-1', '디에고 마라도나', '80s', '1986', 'MF', ['CAM', 'ST'], ['RW'], 96, '아르헨티나', 'AR', 96, 97, 54, 88, ['playmaker_10', 'inverted_winger'], '86 월드컵을 홀로 지배한 신'],
      ['era80-st-1', '마르코 판 바스턴', '80s', '1988', 'FW', ['ST'], [], 93, '네덜란드', 'NL', 95, 83, 50, 84, ['complete_forward', 'poacher'], '발롱도르 3회, 우아한 9번의 정석'],
      ['era80-st-2', '카를하인츠 루메니게', '80s', '1981', 'FW', ['ST', 'RW'], ['LW'], 92, '독일', 'DE', 93, 84, 54, 89, ['line_breaker', 'inverted_winger'], '발롱도르 2연패 독일 캡틴'],
    ],
    bench: [
      ['era80-b-1', '하랄트 슈마허', '80s', '1986', 'GK', ['GK'], [], 90, '독일', 'DE', 30, 62, 91, 82, ['shot_stopper'], '80년대 서독의 강렬한 수문장'],
      ['era80-b-2', '안토니오 카브리니', '80s', '1982', 'DF', ['LB', 'LWB'], [], 90, '이탈리아', 'IT', 74, 82, 90, 91, ['attacking_wingback'], '유벤투스·이탈리아 82 우승 좌측 지배자'],
      ['era80-b-3', '소크라테스', '80s', '1982', 'MF', ['CM', 'CAM'], [], 91, '브라질', 'BR', 86, 93, 70, 84, ['playmaker_10', 'deep_playmaker'], '힐패스와 시야의 의사 축구 철학자'],
      ['era80-b-4', '뤼트 굴리트', '80s', '1987', 'MF', ['CAM', 'CM', 'ST'], ['RW'], 92, '네덜란드', 'NL', 91, 92, 82, 94, ['box_to_box', 'complete_forward'], '87 발롱도르 오렌지 삼총사'],
      ['era80-b-5', '지쿠', '80s', '1982', 'MF', ['CAM'], ['ST'], 92, '브라질', 'BR', 91, 94, 56, 85, ['playmaker_10'], '하얀 펠레, 프리킥 마술사'],
    ],
  },

  // =========================================================================
  // 4. 1990s ALL-STAR BEST XI (4-2-3-1)
  // =========================================================================
  {
    id: 'era-90s-xi',
    seasonLabel: '90s',
    displayName: '1990s 올스타 베스트 11',
    nickname: '외계인 호나우두와 판타지스타의 황금기',
    managerName: '알렉스 퍼거슨',
    managerTraitId: 'big_game_hunter',
    managerRating: 98,
    managerStyleNote: '99 트레블과 빅매치 지배력의 전설적 명장',
    managerAvatar: { gender: 'male', skinTone: 'light', hairStyle: 'parted', hairColor: 'silver', outfit: 'navy_coat' },
    userClub: { name: '1990s 베스트 11', shortName: '90S', primaryColor: '#e11d48', secondaryColor: '#190f15', pattern: 'half' },
    leagueId: 'epl',
    leagueKoreanName: '시대별 올스타',
    formation: '4-2-3-1',
    defaultTactic: 'counter',
    summaryNote: '호나우두 R9·말디니·카푸·카를루스·바조·피구·긱스에 더해 마티아스 잠머·페르난도 레돈도·미카엘 라우드루프·스토이치코프까지 모은 90년대 올스타',
    starters: [
      ['era90-gk-1', '페테르 슈마이켈', '90s', '1999', 'GK', ['GK'], [], 92, '덴마크', 'DK', 32, 65, 93, 84, ['shot_stopper'], '유로 92·맨유 99 트레블 수문장'],
      ['era90-lb-1', '호베르투 카를루스', '90s', '1998', 'DF', ['LB', 'LWB'], [], 92, '브라질', 'BR', 85, 86, 89, 95, ['attacking_wingback'], 'UFO 프리킥과 폭발적 오버래핑'],
      ['era90-cb-1', '파올로 말디니', '90s', '1994', 'DF', ['CB', 'LB'], [], 94, '이탈리아', 'IT', 72, 85, 96, 92, ['stopper_cb', 'attacking_wingback'], '수비의 예술 그 자체'],
      ['era90-cb-2', '마티아스 잠머', '90s', '1996', 'DF', ['CB', 'CDM'], [], 92, '독일', 'DE', 74, 88, 93, 91, ['ball_playing_cb', 'stopper_cb'], '유로 96 MVP · 96 발롱도르 수상 리베로'],
      ['era90-rb-1', '카푸', '90s', '1998', 'DF', ['RB', 'RWB'], [], 92, '브라질', 'BR', 82, 88, 91, 97, ['attacking_wingback'], '월드컵 3연속 결승 출전 우풀백'],
      ['era90-cdm-1', '페르난도 레돈도', '90s', '1998', 'MF', ['CDM', 'CM'], [], 91, '아르헨티나', 'AR', 76, 92, 89, 89, ['deep_playmaker', 'ball_winner'], '우아한 왼발 힐플릭과 탈압박의 레알 중원 왕자'],
      ['era90-cdm-2', '로이 킨', '90s', '1999', 'MF', ['CDM', 'CM'], [], 91, '아일랜드', 'IE', 76, 90, 91, 96, ['ball_winner', 'box_to_box'], '99 트레블 맨유의 투혼 캡틴'],
      ['era90-lw-1', '라이언 긱스', '90s', '1999', 'FW', ['LW', 'LM'], [], 91, '웨일스', 'GB', 88, 89, 60, 91, ['classic_winger'], '왼쪽 측면을 찢는 드리블과 크로스'],
      ['era90-cam-1', '로베르토 바조', '90s', '1993', 'MF', ['CAM', 'ST'], [], 92, '이탈리아', 'IT', 92, 93, 48, 82, ['playmaker_10'], '93 발롱도르 판타지스타'],
      ['era90-rw-1', '루이스 피구', '90s', '2000', 'FW', ['RW', 'RM'], ['CAM'], 92, '포르투갈', 'PT', 90, 91, 58, 88, ['classic_winger', 'playmaker_10'], '2000 발롱도르 측면 지배자'],
      ['era90-st-1', '호나우두 (R9)', '90s', '1997', 'FW', ['ST'], [], 95, '브라질', 'BR', 97, 83, 46, 85, ['line_breaker', 'complete_forward'], '역대 최고 임팩트의 축구 외계인'],
    ],
    bench: [
      ['era90-b-1', '에드윈 판 데르 사르', '90s', '1995', 'GK', ['GK'], [], 90, '네덜란드', 'NL', 32, 72, 91, 83, ['sweeper_keeper'], '아약스 95 무패 UCL 수문장'],
      ['era90-b-2', '릴리앙 튀람', '90s', '1998', 'DF', ['RB', 'CB'], [], 91, '프랑스', 'FR', 70, 82, 93, 92, ['stopper_cb'], '98 월드컵 철벽 수비수'],
      ['era90-b-3', '미카엘 라우드루프', '90s', '1994', 'MF', ['CAM', 'LW'], ['CM'], 92, '덴마크', 'DK', 87, 94, 54, 83, ['playmaker_10'], '노룩 스루패스의 전설, 드림팀 바르사의 10번'],
      ['era90-b-4', '흐리스토 스토이치코프', '90s', '1994', 'FW', ['LW', 'ST'], ['RW'], 92, '불가리아', 'BG', 93, 84, 50, 88, ['inverted_winger', 'line_breaker'], '94 발롱도르·월드컵 득점왕, 불꽃 왼발'],
      ['era90-b-5', '호마리우', '90s', '1994', 'FW', ['ST'], [], 92, '브라질', 'BR', 94, 80, 44, 82, ['poacher', 'line_breaker'], '94 월드컵 골든볼 박스 천재'],
    ],
  },

  // =========================================================================
  // 5. 2000s ALL-STAR BEST XI (4-3-3)
  // =========================================================================
  {
    id: 'era-00s-xi',
    seasonLabel: '00s',
    displayName: '2000s 올스타 베스트 11',
    nickname: '지단·호나우지뉴·앙리 갈락티코 시대',
    managerName: '카를로 안첼로티',
    managerTraitId: 'galactico_manager',
    managerRating: 97,
    managerStyleNote: '슈퍼스타 군단을 하나로 묶는 유럽 최다 UCL 명장',
    managerAvatar: { gender: 'male', skinTone: 'light', hairStyle: 'slick', hairColor: 'silver', outfit: 'classic_suit' },
    userClub: { name: '2000s 베스트 11', shortName: '00S', primaryColor: '#cbd5e1', secondaryColor: '#141923', pattern: 'solid' },
    leagueId: 'laliga',
    leagueKoreanName: '시대별 올스타',
    formation: '4-3-3',
    defaultTactic: 'balanced',
    summaryNote: '지단·앙리·호나우지뉴·부폰·네스타·사비·피를로에 더해 미하엘 발락·마이콩·뤼트 판 니스텔로이·비에이라까지 모은 2000년대 올스타',
    starters: [
      ['era00-gk-1', '잔루이지 부폰', '00s', '2006', 'GK', ['GK'], [], 93, '이탈리아', 'IT', 30, 64, 94, 83, ['shot_stopper'], '06 월드컵 우승, 수문장의 교과서'],
      ['era00-lb-1', '애슐리 콜', '00s', '2006', 'DF', ['LB', 'LWB'], [], 91, '잉글랜드', 'GB', 74, 84, 91, 94, ['attacking_wingback'], '세계 최강 윙어들을 봉쇄한 레프트백'],
      ['era00-cb-1', '알레산드로 네스타', '00s', '2005', 'DF', ['CB'], [], 92, '이탈리아', 'IT', 58, 80, 95, 87, ['stopper_cb', 'ball_playing_cb'], '우아한 태클과 수비 예술'],
      ['era00-cb-2', '파비오 칸나바로', '00s', '2006', 'DF', ['CB'], ['RB'], 91, '이탈리아', 'IT', 56, 76, 94, 89, ['stopper_cb'], '06 월드컵·발롱도르 수상 센터백'],
      ['era00-rb-1', '필립 람', '00s', '2010', 'DF', ['RB', 'LB', 'CDM'], [], 92, '독일', 'DE', 74, 90, 92, 94, ['attacking_wingback', 'deep_playmaker'], '퇴장 0회의 완벽한 축구 지능'],
      ['era00-mf-1', '안드레아 피를로', '00s', '2006', 'MF', ['CDM', 'CM'], [], 92, '이탈리아', 'IT', 80, 95, 74, 86, ['deep_playmaker'], '레지스타의 교과서'],
      ['era00-mf-2', '사비 에르난데스', '00s', '2009', 'MF', ['CM', 'CDM'], [], 93, '스페인', 'ES', 80, 96, 78, 92, ['deep_playmaker', 'playmaker_10'], '티키타카의 두뇌'],
      ['era00-mf-3', '지네딘 지단', '00s', '2002', 'MF', ['CM', 'CAM'], [], 94, '프랑스', 'FR', 90, 96, 72, 88, ['playmaker_10', 'box_to_box'], '02 UCL 결승 발리, 세기의 마에스트로'],
      ['era00-lw-1', '호나우지뉴', '00s', '2005', 'FW', ['LW', 'CAM'], [], 94, '브라질', 'BR', 93, 94, 48, 86, ['inverted_winger', 'playmaker_10'], '05 발롱도르 외계인 판타지스타'],
      ['era00-st-1', '티에리 앙리', '00s', '2004', 'FW', ['ST', 'LW'], [], 94, '프랑스', 'FR', 95, 86, 52, 90, ['line_breaker', 'inverted_winger'], '아스널 무패 우승의 왕'],
      ['era00-rw-1', '카카', '00s', '2007', 'FW', ['RW', 'CAM'], ['ST'], 92, '브라질', 'BR', 92, 92, 56, 89, ['playmaker_10', 'line_breaker'], '07 발롱도르 폭발적 치달 마에스트로'],
    ],
    bench: [
      ['era00-b-1', '이케르 카시야스', '00s', '2008', 'GK', ['GK'], [], 92, '스페인', 'ES', 30, 66, 93, 83, ['shot_stopper'], '성 이케르의 초인적 반사신경'],
      ['era00-b-2', '마이콩', '00s', '2010', 'DF', ['RB', 'RWB'], [], 91, '브라질', 'BR', 83, 85, 88, 94, ['attacking_wingback'], '09-10 인테르 트레블 최강 우풀백'],
      ['era00-b-3', '미하엘 발락', '00s', '2006', 'MF', ['CM', 'CAM'], ['CDM'], 91, '독일', 'DE', 87, 90, 84, 92, ['box_to_box'], '강력한 헤더·중거리·리더십의 독일 전차 주장'],
      ['era00-b-4', '파트리크 비에이라', '00s', '2004', 'MF', ['CDM', 'CM'], [], 92, '프랑스', 'FR', 80, 91, 92, 95, ['ball_winner', 'box_to_box'], '무패 아스널의 중원 괴물'],
      ['era00-b-5', '뤼트 판 니스텔로이', '00s', '2003', 'FW', ['ST'], [], 91, '네덜란드', 'NL', 94, 75, 46, 86, ['poacher'], '박스 안 원터치 마무리의 절대 지존'],
    ],
  },

  // =========================================================================
  // 6. 2010s ALL-STAR BEST XI (4-3-3)
  // =========================================================================
  {
    id: 'era-10s-xi',
    seasonLabel: '10s',
    displayName: '2010s 올스타 베스트 11',
    nickname: '메시·호날두와 현대 축구의 정점',
    managerName: '펩 과르디올라',
    managerTraitId: 'tiki_taka',
    managerRating: 98,
    managerStyleNote: '포지셔널 플레이와 점유율 축구의 절대 정점',
    managerAvatar: { gender: 'male', skinTone: 'peach', hairStyle: 'bald', hairColor: 'black', outfit: 'casual_shirt' },
    userClub: { name: '2010s 베스트 11', shortName: '10S', primaryColor: '#8b5cf6', secondaryColor: '#151126', pattern: 'sash' },
    leagueId: 'laliga',
    leagueKoreanName: '시대별 올스타',
    formation: '4-3-3',
    defaultTactic: 'possession',
    summaryNote: '메시·호날두·레반도프스키·모드리치·이니에스타·노이어·라모스·판 다이크에 더해 뱅상 콤파니·야야 투레·메수트 외질·수아레스까지 집결한 2010년대 올스타',
    starters: [
      ['era10-gk-1', '마누엘 노이어', '10s', '2014', 'GK', ['GK'], [], 93, '독일', 'DE', 38, 80, 94, 86, ['sweeper_keeper', 'shot_stopper'], '스위퍼 키퍼 혁명가'],
      ['era10-lb-1', '마르셀루', '10s', '2017', 'DF', ['LB', 'LWB'], [], 91, '브라질', 'BR', 85, 89, 86, 90, ['attacking_wingback'], '공격수급 발기술의 레알 UCL 3연패 레프트백'],
      ['era10-cb-1', '세르히오 라모스', '10s', '2017', 'DF', ['CB', 'RB'], [], 92, '스페인', 'ES', 74, 83, 93, 90, ['stopper_cb', 'ball_playing_cb'], '클러치 헤더와 투혼의 레알 캡틴'],
      ['era10-cb-2', '버질 판 다이크', '10s', '2019', 'DF', ['CB'], [], 92, '네덜란드', 'NL', 66, 82, 94, 89, ['stopper_cb', 'ball_playing_cb'], '19 발롱도르 2위 통곡의 벽'],
      ['era10-rb-1', '다니 알베스', '10s', '2011', 'DF', ['RB', 'RWB'], [], 91, '브라질', 'BR', 84, 89, 87, 94, ['attacking_wingback'], '역대 최다 우승 공격형 우풀백'],
      ['era10-mf-1', '세르히오 부스케츠', '10s', '2015', 'MF', ['CDM'], ['CM'], 92, '스페인', 'ES', 70, 93, 91, 89, ['deep_playmaker', 'ball_winner'], '역대 최고 원볼란치'],
      ['era10-mf-2', '루카 모드리치', '10s', '2018', 'MF', ['CM', 'CAM'], ['CDM'], 93, '크로아티아', 'HR', 84, 95, 80, 93, ['deep_playmaker', 'playmaker_10'], '18 발롱도르 중원 지배자'],
      ['era10-mf-3', '안드레스 이니에스타', '10s', '2012', 'MF', ['CM', 'CAM'], ['LW'], 93, '스페인', 'ES', 86, 95, 70, 88, ['playmaker_10', 'deep_playmaker'], '라 크로케타의 예술가'],
      ['era10-lw-1', '크리스티아누 호날두', '10s', '2017', 'FW', ['LW', 'ST'], [], 96, '포르투갈', 'PT', 98, 87, 48, 93, ['line_breaker', 'complete_forward'], 'UCL 역대 최다 득점 완벽한 득점 기계'],
      ['era10-st-1', '로베르트 레반도프스키', '10s', '2020', 'FW', ['ST'], [], 93, '폴란드', 'PL', 95, 83, 52, 90, ['complete_forward', 'poacher'], '단일 시즌 41골 9번의 정석'],
      ['era10-rw-1', '리오넬 메시', '10s', '2015', 'FW', ['RW', 'CAM'], ['ST'], 96, '아르헨티나', 'AR', 98, 97, 45, 86, ['inverted_winger', 'playmaker_10'], '발롱도르 8회 축구의 신'],
    ],
    bench: [
      ['era10-b-1', '얀 오블락', '10s', '2018', 'GK', ['GK'], [], 90, '슬로베니아', 'SI', 30, 64, 91, 83, ['shot_stopper'], '사모라상 4연패 수호신'],
      ['era10-b-2', '뱅상 콤파니', '10s', '2014', 'DF', ['CB'], [], 90, '벨기에', 'BE', 62, 80, 92, 87, ['stopper_cb', 'ball_playing_cb'], '맨시티 왕조의 위대한 캡틴 센터백'],
      ['era10-b-3', '야야 투레', '10s', '2014', 'MF', ['CM', 'CDM'], ['CAM'], 91, '코트디부아르', 'CI', 89, 91, 82, 90, ['box_to_box'], '13-14 EPL 20골, 폭주기관차 피지컬 미드필더'],
      ['era10-b-4', '메수트 외질', '10s', '2013', 'MF', ['CAM'], ['RW'], 90, '독일', 'DE', 82, 94, 48, 80, ['playmaker_10'], '천재적 왼발 킬패스와 공간 창조의 어시스트 킹'],
      ['era10-b-5', '루이스 수아레스', '10s', '2016', 'FW', ['ST'], [], 93, '우루과이', 'UY', 95, 86, 54, 90, ['complete_forward', 'poacher'], '유러피언 골든슈 2회 MSN 해결사'],
    ],
  },
];

function buildEraBestXiEntry(spec: EraTeamSpec): HistoricalTeamEntry {
  const starters = spec.starters.map(makeEraPlayer);
  const bench = spec.bench.map(makeEraPlayer);
  const formationCfg = FORMATIONS[spec.formation];

  const chemResult = calculateChemistry(
    spec.formation,
    starters,
    spec.defaultTactic,
    spec.managerTraitId,
    spec.managerRating,
  );
  const rawAvg = starters.reduce((s, p) => s + p.ovr, 0) / starters.length;
  const teamAvgOvr = Math.round(rawAvg * 10) / 10;

  const slotSynValues = Object.values(chemResult.slotSynergies);
  const avgSynergyOvrBonus =
    slotSynValues.length > 0
      ? Math.round(
          (slotSynValues.reduce((sum, s) => sum + s.totalBonus, 0) /
            slotSynValues.length) *
            100,
        ) / 100
      : 0;
  const managerSynergyCount = starters.filter(
    (p) => evaluateManagerPlayerSynergy(p, spec.managerTraitId, spec.managerRating).isMatch,
  ).length;

  const bestXi: HistoricalBestXiPlayer[] = starters.map((p, idx) => ({
    position: formationCfg.slots[idx]?.label ?? p.mainPositions[0] ?? p.position,
    name: p.name,
    ovr: p.ovr,
  }));

  return {
    id: spec.id,
    seasonLabel: spec.seasonLabel,
    displayName: spec.displayName,
    nickname: spec.nickname,
    managerName: spec.managerName,
    managerTraitId: spec.managerTraitId,
    managerRating: spec.managerRating,
    managerStyleNote: spec.managerStyleNote,
    managerAvatar: spec.managerAvatar,
    userClub: spec.userClub,
    leagueId: spec.leagueId,
    leagueKoreanName: spec.leagueKoreanName,
    formation: spec.formation,
    defaultTactic: spec.defaultTactic,
    finalLeagueRank: 1,
    leaguePoints: 99,
    leagueTotalRounds: 38,
    leagueRecord: '시대 올스타',
    leagueGoalDifference: 80,
    goalsFor: 105,
    goalsAgainst: 25,
    cupName: '시대별 올스타전',
    cupResultLabel: '올스타',
    cupWon: true,
    uclResultLabel: '드림매치 전용',
    uclWon: true,
    isTreble: true,
    isLeagueChampion: true,
    teamAvgOvr,
    chemistry: chemResult.total,
    avgSynergyOvrBonus,
    managerSynergyCount,
    seasonScore: {
      leagueConvertedScore: 3000,
      leagueRankBonus: 1200,
      cupBonus: 850,
      uclBonus: 1800,
      honorsBonus: 1200,
      underdogBonus: 0,
      squadCraftBonus: 2000,
      awardsBonus: 600,
      totalScore: 10650,
      grade: 'S+',
    },
    trophies: [`${spec.seasonLabel} 베스트 11`],
    summaryNote: spec.summaryNote,
    worldBestXiCount: 11,
    leagueBestXiCount: 11,
    bestXi,
    starters,
    bench,
  };
}

export const ERA_BEST_XI_DREAM_TEAMS: HistoricalTeamEntry[] = ERA_SPECS.map(buildEraBestXiEntry);
