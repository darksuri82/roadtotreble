import type { LeagueId } from '../types/league';
import type {
  GoalkeeperAttributes,
  Player,
  PlayerAttributes,
  PlaystyleId,
  Position,
  SubPosition,
} from '../types/player';
import { getPlayerFormerClubs } from './formerClubs';

interface HistPlayerSeed {
  slug: string;
  name: string;
  pos: Position;
  main: SubPosition[];
  sec?: SubPosition[];
  ovr: number;
  nat: string;
  code: string;
  sta: number;
  styles: PlaystyleId[];
  note: string;
  /** [sho, pas, cro, dri, aer, def, phy] */
  f: [number, number, number, number, number, number, number];
  /** [div, han, ref, kic, pos] for GK */
  gk?: [number, number, number, number, number];
}

function buildSquad(
  teamId: string,
  clubName: string,
  leagueId: LeagueId,
  seeds: HistPlayerSeed[],
): Player[] {
  return seeds.map((s) => {
    const [sho, pas, cro, dri, aer, defAttr, phy] = s.f;
    const gkAttrs: GoalkeeperAttributes | undefined = s.gk
      ? {
          div: s.gk[0],
          han: s.gk[1],
          ref: s.gk[2],
          kic: s.gk[3],
          pos: s.gk[4],
        }
      : undefined;

    const attrs: PlayerAttributes = {
      sho,
      pas,
      cro,
      dri,
      aer,
      def: defAttr,
      phy,
      ...(gkAttrs ? { gk: gkAttrs } : {}),
    };

    let att: number;
    let mid: number;
    let def: number;
    if (s.pos === 'GK' && gkAttrs) {
      att = Math.round(gkAttrs.kic * 0.65);
      mid = Math.round(gkAttrs.kic * 0.78);
      def = s.ovr;
    } else if (s.pos === 'FW') {
      att = Math.min(99, Math.round(s.ovr * 0.65 + (sho * 0.55 + dri * 0.45) * 0.35));
      mid = Math.round(pas * 0.5 + dri * 0.3 + cro * 0.2);
      def = Math.round(defAttr * 0.75 + phy * 0.25);
    } else if (s.pos === 'MF') {
      att = Math.round(sho * 0.45 + dri * 0.35 + pas * 0.2);
      mid = Math.min(99, Math.round(s.ovr * 0.65 + (pas * 0.55 + dri * 0.45) * 0.35));
      def = Math.round(defAttr * 0.72 + phy * 0.28);
    } else {
      att = Math.round(sho * 0.35 + cro * 0.4 + dri * 0.25);
      mid = Math.round(pas * 0.55 + cro * 0.25 + phy * 0.2);
      def = Math.min(99, Math.round(s.ovr * 0.65 + (defAttr * 0.6 + aer * 0.2 + phy * 0.2) * 0.35));
    }

    const basePlayer: Player = {
      id: `${teamId}__${s.slug}`,
      name: s.name,
      position: s.pos,
      mainPositions: s.main,
      secondaryPositions: s.sec ?? [],
      ovr: s.ovr,
      nationality: s.nat,
      nationalityCode: s.code,
      leagueId,
      club: clubName,
      att,
      mid,
      def,
      stamina: s.sta,
      playstyles: s.styles,
      scoutNote: s.note,
      isLegend: false,
      attrs,
    };
    const formerClubs = getPlayerFormerClubs(basePlayer);
    return formerClubs.length > 0 ? { ...basePlayer, formerClubs } : basePlayer;
  });
}

export interface HistoricalTeamSquadBundle {
  starters: Player[]; // Exactly 11 players ordered to match team's FormationId slots
  bench: Player[]; // 5~7 prime bench players (total 16~18 players)
}

export const HISTORICAL_SQUADS: Record<string, HistoricalTeamSquadBundle> = {
  // =========================================================================
  // 1. 19-20 바이에른 뮌헨 (4-2-3-1 · 게겐프레싱 · 한지 플릭)
  // Slots: [GK, LB, CB, CB, RB, CDM, CDM, LW, CAM, RW, ST]
  // =========================================================================
  'hist-1920-bayern': {
    starters: buildSquad('hist-1920-bayern', '19-20 바이에른 뮌헨', 'bundesliga', [
      {
        slug: 'neuer', name: '마누엘 노이어', pos: 'GK', main: ['GK'], ovr: 93,
        nat: '독일', code: 'DE', sta: 84, styles: ['sweeper_keeper', 'shot_stopper'],
        note: '결승전 철벽 선방과 하프라인 스위핑으로 완성한 역대급 스위퍼 키퍼',
        f: [45, 86, 72, 68, 76, 84, 86], gk: [92, 90, 95, 95, 94],
      },
      {
        slug: 'davies', name: '알폰소 데이비스', pos: 'DF', main: ['LB', 'LWB'], sec: ['LW', 'LM'], ovr: 86,
        nat: '캐나다', code: 'CA', sta: 94, styles: ['attacking_wingback', 'line_breaker'],
        note: '바르사전 8-2 폭풍 드리블 어시스트의 주인공, 압도적 스피드',
        f: [68, 79, 83, 89, 72, 81, 95],
      },
      {
        slug: 'alaba', name: '다비드 알라바', pos: 'DF', main: ['CB', 'LB'], sec: ['CDM', 'LWB'], ovr: 88,
        nat: '오스트리아', code: 'AT', sta: 88, styles: ['ball_playing_cb'],
        note: '후방 빌드업의 사령관, 정확한 왼발 전진 패스로 압박 탈출',
        f: [74, 89, 86, 84, 80, 88, 86],
      },
      {
        slug: 'boateng', name: '제롬 보아텡', pos: 'DF', main: ['CB'], ovr: 85,
        nat: '독일', code: 'DE', sta: 80, styles: ['ball_playing_cb', 'stopper_cb'],
        note: '정교한 롱패스와 대인 방어로 수비 라인을 지탱한 베테랑',
        f: [58, 83, 76, 72, 87, 86, 85],
      },
      {
        slug: 'kimmich', name: '요주아 키미히', pos: 'DF', main: ['RB', 'CDM'], sec: ['CM', 'RWB'], ovr: 91,
        nat: '독일', code: 'DE', sta: 94, styles: ['attacking_wingback', 'deep_playmaker'],
        note: '결승 결승골 어시스트, 면도날 얼리 크로스와 미친 활동량',
        f: [76, 93, 94, 86, 74, 88, 86],
      },
      {
        slug: 'thiago', name: '티아고 알칸타라', pos: 'MF', main: ['CDM', 'CM'], ovr: 90,
        nat: '스페인', code: 'ES', sta: 87, styles: ['deep_playmaker', 'ball_winner'],
        note: '결승전 중원을 완벽 지배한 탈압박·패스 마에스트로',
        f: [75, 93, 84, 93, 72, 85, 81],
      },
      {
        slug: 'goretzka', name: '레온 고레츠카', pos: 'MF', main: ['CDM', 'CM'], sec: ['CAM'], ovr: 87,
        nat: '독일', code: 'DE', sta: 92, styles: ['box_to_box', 'ball_winner'],
        note: '압도적 피지컬 벌크업과 전방 압박·박스 침투의 엔진',
        f: [82, 84, 76, 82, 86, 85, 92],
      },
      {
        slug: 'coman', name: '킹슬리 코망', pos: 'FW', main: ['LW', 'RW'], sec: ['LM', 'RM'], ovr: 86,
        nat: '프랑스', code: 'FR', sta: 85, styles: ['classic_winger', 'line_breaker'],
        note: 'UCL 결승전 결승 헤더골, 폭발적인 가속력과 1대1 돌파',
        f: [80, 81, 85, 90, 74, 48, 90],
      },
      {
        slug: 'muller', name: '토마스 뮐러', pos: 'MF', main: ['CAM', 'RW'], sec: ['ST'], ovr: 90,
        nat: '독일', code: 'DE', sta: 92, styles: ['playmaker_10', 'box_to_box'],
        note: '리그 21도움 신기록, 라움도이터 공간 창출과 전방 압박 지휘',
        f: [87, 92, 88, 85, 84, 72, 84],
      },
      {
        slug: 'gnabry', name: '세르주 그나브리', pos: 'FW', main: ['RW', 'LW'], sec: ['RM', 'CAM'], ovr: 88,
        nat: '독일', code: 'DE', sta: 87, styles: ['inverted_winger', 'line_breaker'],
        note: 'UCL 9골 맹폭, 토트넘전 4골·리옹전 멀티골의 빅게임 해결사',
        f: [88, 84, 83, 89, 73, 56, 88],
      },
      {
        slug: 'lewandowski', name: '로베르트 레반도프스키', pos: 'FW', main: ['ST'], ovr: 95,
        nat: '폴란드', code: 'PL', sta: 90, styles: ['complete_forward', 'poacher'],
        note: '시즌 55골 · 리그/포칼/UCL 3개 대회 득점왕 석권, 완벽한 9번',
        f: [98, 85, 78, 89, 94, 52, 91],
      },
    ]),
    bench: buildSquad('hist-1920-bayern', '19-20 바이에른 뮌헨', 'bundesliga', [
      {
        slug: 'ulreich', name: '스벤 울라이히', pos: 'GK', main: ['GK'], ovr: 80,
        nat: '독일', code: 'DE', sta: 76, styles: ['shot_stopper'],
        note: '노이어의 뒤를 든든히 받친 신뢰의 백업 골키퍼',
        f: [40, 68, 55, 52, 65, 72, 76], gk: [81, 79, 82, 74, 80],
      },
      {
        slug: 'pavard', name: '뱅자맹 파바르', pos: 'DF', main: ['RB', 'CB'], ovr: 85,
        nat: '프랑스', code: 'FR', sta: 88, styles: ['stopper_cb', 'attacking_wingback'],
        note: '시즌 내내 주전 RB로 활약한 안정적 수비와 발리 킥',
        f: [72, 81, 83, 78, 84, 86, 84],
      },
      {
        slug: 'sule', name: '니클라스 쥘레', pos: 'DF', main: ['CB'], ovr: 84,
        nat: '독일', code: 'DE', sta: 82, styles: ['stopper_cb'],
        note: '결승전 교체 투입으로 무실점을 지킨 거구 센터백',
        f: [52, 76, 62, 68, 88, 85, 89],
      },
      {
        slug: 'hernandez', name: '뤼카 에르난데스', pos: 'DF', main: ['CB', 'LB'], ovr: 85,
        nat: '프랑스', code: 'FR', sta: 86, styles: ['stopper_cb'],
        note: '투지 넘치는 대인 수비와 빠른 커버링',
        f: [56, 77, 75, 76, 84, 87, 88],
      },
      {
        slug: 'perisic', name: '이반 페리시치', pos: 'FW', main: ['LW', 'LM'], sec: ['RW', 'ST'], ovr: 84,
        nat: '크로아티아', code: 'HR', sta: 89, styles: ['classic_winger', 'box_to_box'],
        note: '바르사전 득점 포함 양발 크로스와 성실한 압박의 베테랑 조커',
        f: [83, 81, 86, 83, 83, 66, 86],
      },
      {
        slug: 'coutinho', name: '필리페 쿠티뉴', pos: 'MF', main: ['CAM', 'LW'], sec: ['CM'], ovr: 85,
        nat: '브라질', code: 'BR', sta: 80, styles: ['playmaker_10', 'inverted_winger'],
        note: '바르사전 교체 투입 2골 1도움, 특유의 감아차기 스페셜리스트',
        f: [85, 87, 85, 90, 58, 52, 74],
      },
    ]),
  },

  // =========================================================================
  // 2. 12-13 바이에른 뮌헨 (4-2-3-1 · 측면 공략 · 유프 하인케스)
  // Slots: [GK, LB, CB, CB, RB, CDM, CDM, LW, CAM, RW, ST]
  // =========================================================================
  'hist-1213-bayern': {
    starters: buildSquad('hist-1213-bayern', '12-13 바이에른 뮌헨', 'bundesliga', [
      {
        slug: 'neuer', name: '마누엘 노이어', pos: 'GK', main: ['GK'], ovr: 92,
        nat: '독일', code: 'DE', sta: 85, styles: ['sweeper_keeper', 'shot_stopper'],
        note: '분데스리가 34R 18실점 신화를 이끈 철벽 스위퍼 키퍼',
        f: [45, 85, 70, 68, 76, 84, 86], gk: [92, 90, 94, 93, 93],
      },
      {
        slug: 'alaba', name: '다비드 알라바', pos: 'DF', main: ['LB', 'LWB'], sec: ['CB', 'CM'], ovr: 87,
        nat: '오스트리아', code: 'AT', sta: 91, styles: ['attacking_wingback'],
        note: '리베리와 좌측면을 지배한 최정상급 오버래핑 풀백',
        f: [76, 85, 88, 85, 74, 85, 89],
      },
      {
        slug: 'dante', name: '단테', pos: 'DF', main: ['CB'], ovr: 86,
        nat: '브라질', code: 'BR', sta: 84, styles: ['ball_playing_cb', 'stopper_cb'],
        note: '12-13 시즌 분데스리가 최고의 센터백, 공중볼과 빌드업 완벽',
        f: [56, 82, 68, 72, 89, 87, 86],
      },
      {
        slug: 'boateng', name: '제롬 보아텡', pos: 'DF', main: ['CB'], sec: ['RB'], ovr: 87,
        nat: '독일', code: 'DE', sta: 86, styles: ['stopper_cb', 'ball_playing_cb'],
        note: '압도적 피지컬과 스피드로 상대 역습을 봉쇄한 센터백',
        f: [58, 82, 74, 73, 88, 88, 89],
      },
      {
        slug: 'lahm', name: '필립 람', pos: 'DF', main: ['RB', 'LB'], sec: ['CDM', 'RWB'], ovr: 92,
        nat: '독일', code: 'DE', sta: 93, styles: ['attacking_wingback', 'deep_playmaker'],
        note: '축구 지능의 결정체, 완벽한 태클과 로벤과의 우측 연계',
        f: [70, 90, 91, 88, 70, 93, 86],
      },
      {
        slug: 'martinez', name: '하비 마르티네스', pos: 'MF', main: ['CDM', 'CB'], ovr: 89,
        nat: '스페인', code: 'ES', sta: 91, styles: ['ball_winner', 'stopper_cb'],
        note: '바르사전 7-0 중원 삭제의 주역, 역대급 수비형 미드필더',
        f: [72, 85, 72, 80, 90, 92, 91],
      },
      {
        slug: 'schweinsteiger', name: '바스티안 슈바인슈타이거', pos: 'MF', main: ['CDM', 'CM'], ovr: 91,
        nat: '독일', code: 'DE', sta: 92, styles: ['box_to_box', 'deep_playmaker'],
        note: '공수 완급 조절과 강철 투지의 독일 중원 사령관',
        f: [83, 91, 85, 86, 84, 88, 90],
      },
      {
        slug: 'ribery', name: '프랑크 리베리', pos: 'FW', main: ['LW', 'LM'], sec: ['CAM'], ovr: 93,
        nat: '프랑스', code: 'FR', sta: 90, styles: ['classic_winger', 'inverted_winger'],
        note: 'UEFA 올해의 선수 · 트레블 에이스, 화려한 드리블과 크로스',
        f: [86, 92, 93, 96, 66, 60, 88],
      },
      {
        slug: 'muller', name: '토마스 뮐러', pos: 'MF', main: ['CAM', 'RW'], sec: ['ST'], ovr: 89,
        nat: '독일', code: 'DE', sta: 93, styles: ['playmaker_10', 'poacher'],
        note: '바르사전 3골 맹폭, 예측 불가능한 침투와 헌신적 압박',
        f: [88, 88, 85, 84, 85, 70, 86],
      },
      {
        slug: 'robben', name: '아르옌 로벤', pos: 'FW', main: ['RW', 'RM'], ovr: 92,
        nat: '네덜란드', code: 'NL', sta: 87, styles: ['inverted_winger', 'line_breaker'],
        note: '웸블리 결승전 89분 결승골, 알고도 못 막는 컷인 왼발 감아차기',
        f: [93, 86, 89, 95, 64, 52, 91],
      },
      {
        slug: 'mandzukic', name: '마리오 만주키치', pos: 'FW', main: ['ST'], sec: ['LW'], ovr: 87,
        nat: '크로아티아', code: 'HR', sta: 94, styles: ['poacher', 'complete_forward'],
        note: '결승 선제골 · 최전방부터 수비하는 압도적 제공권·활동량 스트라이커',
        f: [88, 76, 74, 78, 94, 68, 91],
      },
    ]),
    bench: buildSquad('hist-1213-bayern', '12-13 바이에른 뮌헨', 'bundesliga', [
      {
        slug: 'starke', name: '톰 슈타르케', pos: 'GK', main: ['GK'], ovr: 78,
        nat: '독일', code: 'DE', sta: 75, styles: ['shot_stopper'],
        note: '노이어의 백업으로 무패 경기를 지킨 베테랑 키퍼',
        f: [38, 64, 52, 50, 68, 70, 74], gk: [79, 78, 80, 72, 79],
      },
      {
        slug: 'vanbuyten', name: '다니엘 판 바위턴', pos: 'DF', main: ['CB'], ovr: 82,
        nat: '벨기에', code: 'BE', sta: 76, styles: ['stopper_cb'],
        note: '압도적 공중볼 경합과 세트피스 위협을 지닌 베테랑 센터백',
        f: [62, 70, 58, 60, 91, 83, 87],
      },
      {
        slug: 'kroos', name: '토니 크로스', pos: 'MF', main: ['CM', 'CAM'], sec: ['CDM'], ovr: 88,
        nat: '독일', code: 'DE', sta: 86, styles: ['deep_playmaker', 'playmaker_10'],
        note: '부상 전까지 주전 10번으로 활약한 완벽한 패스 마스터',
        f: [84, 93, 91, 85, 70, 76, 79],
      },
      {
        slug: 'gustavo', name: '루이스 구스타부', pos: 'MF', main: ['CDM'], sec: ['CB', 'LB'], ovr: 83,
        nat: '브라질', code: 'BR', sta: 88, styles: ['ball_winner'],
        note: '후반 잠그기 전문 강력한 태클러',
        f: [66, 77, 70, 75, 81, 86, 86],
      },
      {
        slug: 'gomez', name: '마리오 고메스', pos: 'FW', main: ['ST'], ovr: 86,
        nat: '독일', code: 'DE', sta: 82, styles: ['poacher'],
        note: '포칼 결승 멀티골, 박스 안 결정력의 화신',
        f: [91, 70, 66, 76, 90, 44, 86],
      },
      {
        slug: 'shaqiri', name: '제르단 샤키리', pos: 'FW', main: ['RW', 'LW'], sec: ['CAM'], ovr: 82,
        nat: '스위스', code: 'CH', sta: 84, styles: ['inverted_winger'],
        note: '탄탄한 체구와 폭발적 왼발 중거리 슈팅을 갖춘 슈퍼 서브',
        f: [82, 80, 83, 86, 62, 50, 84],
      },
    ]),
  },

  // =========================================================================
  // 3. 14-15 FC 바르셀로나 (4-3-3 · 점유율 · 루이스 엔리케)
  // Slots: [GK, LB, CB, CB, RB, CDM, CM, CM, LW, ST, RW]
  // =========================================================================
  'hist-1415-barca': {
    starters: buildSquad('hist-1415-barca', '14-15 FC 바르셀로나', 'laliga', [
      {
        slug: 'terstegen', name: '마르크안드레 테어 슈테겐', pos: 'GK', main: ['GK'], ovr: 88,
        nat: '독일', code: 'DE', sta: 84, styles: ['sweeper_keeper', 'shot_stopper'],
        note: 'UCL·코파 전 경기 우승, 바이에른전 경이적 더블 세이브',
        f: [44, 85, 68, 68, 72, 80, 82], gk: [88, 86, 91, 91, 87],
      },
      {
        slug: 'alba', name: '조르디 알바', pos: 'DF', main: ['LB', 'LWB'], ovr: 88,
        nat: '스페인', code: 'ES', sta: 93, styles: ['attacking_wingback'],
        note: '메시와의 텔레파시 컷백 연계, 번개 같은 좌측 오버래핑',
        f: [72, 86, 87, 87, 65, 83, 91],
      },
      {
        slug: 'pique', name: '제라르 피케', pos: 'DF', main: ['CB'], ovr: 89,
        nat: '스페인', code: 'ES', sta: 85, styles: ['ball_playing_cb'],
        note: '라리가 21실점의 핵심, 높은 수비 라인을 지휘한 빌드업 센터백',
        f: [64, 86, 72, 77, 91, 90, 86],
      },
      {
        slug: 'mascherano', name: '하비에르 마스체라노', pos: 'DF', main: ['CB', 'CDM'], ovr: 88,
        nat: '아르헨티나', code: 'AR', sta: 91, styles: ['stopper_cb', 'ball_winner'],
        note: '불굴의 슬라이딩 태클과 투지로 뒷공간을 지운 작은 거인',
        f: [60, 84, 72, 77, 81, 91, 88],
      },
      {
        slug: 'alves', name: '다니 알베스', pos: 'DF', main: ['RB', 'RWB'], ovr: 90,
        nat: '브라질', code: 'BR', sta: 92, styles: ['attacking_wingback', 'deep_playmaker'],
        note: '메시 최고의 파트너, 우측면 빌드업·크로스·수비 모두 역대급',
        f: [78, 89, 91, 90, 72, 85, 88],
      },
      {
        slug: 'busquets', name: '세르히오 부스케츠', pos: 'MF', main: ['CDM'], sec: ['CM'], ovr: 91,
        nat: '스페인', code: 'ES', sta: 89, styles: ['deep_playmaker', 'ball_winner'],
        note: '단 한 번의 턴으로 압박을 무력화하는 축구 역사상 최고 피보테',
        f: [68, 93, 80, 90, 82, 90, 82],
      },
      {
        slug: 'iniesta', name: '안드레스 이니에스타', pos: 'MF', main: ['CM', 'CAM'], sec: ['LW'], ovr: 92,
        nat: '스페인', code: 'ES', sta: 86, styles: ['playmaker_10', 'deep_playmaker'],
        note: 'UCL 결승전 MOM, 탈압박·라 크로케타·킬패스의 예술가',
        f: [80, 95, 86, 97, 62, 74, 79],
      },
      {
        slug: 'rakitic', name: '이반 라키티치', pos: 'MF', main: ['CM'], sec: ['CDM', 'CAM'], ovr: 87,
        nat: '크로아티아', code: 'HR', sta: 92, styles: ['box_to_box', 'deep_playmaker'],
        note: 'UCL 결승 선제골 · 알베스와 메시의 뒷공간을 완벽히 메운 만능 미들',
        f: [83, 89, 88, 84, 76, 81, 85],
      },
      {
        slug: 'neymar', name: '네이마르', pos: 'FW', main: ['LW', 'CAM'], sec: ['LM', 'ST'], ovr: 93,
        nat: '브라질', code: 'BR', sta: 88, styles: ['inverted_winger', 'playmaker_10'],
        note: '시즌 39골 · UCL 공동 득점왕, 현란한 개인기와 빅매치 킬러',
        f: [91, 90, 88, 97, 68, 45, 86],
      },
      {
        slug: 'suarez', name: '루이스 수아레스', pos: 'FW', main: ['ST'], ovr: 94,
        nat: '우루과이', code: 'UY', sta: 92, styles: ['complete_forward', 'poacher'],
        note: 'UCL 결승 결승골 · 야수 같은 압박·연계·원터치 마무리 완성형 9번',
        f: [96, 88, 82, 92, 87, 56, 91],
      },
      {
        slug: 'messi', name: '리오넬 메시', pos: 'FW', main: ['RW', 'CAM'], sec: ['ST'], ovr: 97,
        nat: '아르헨티나', code: 'AR', sta: 88, styles: ['inverted_winger', 'playmaker_10'],
        note: '발롱도르 · 58골 27도움, 보아텡 제친 바이에른전 원맨쇼의 정점',
        f: [98, 97, 94, 99, 72, 46, 86],
      },
    ]),
    bench: buildSquad('hist-1415-barca', '14-15 FC 바르셀로나', 'laliga', [
      {
        slug: 'bravo', name: '클라우디오 브라보', pos: 'GK', main: ['GK'], ovr: 87,
        nat: '칠레', code: 'CL', sta: 82, styles: ['sweeper_keeper', 'shot_stopper'],
        note: '라리가 전 경기 선발 19실점·23클린시트 사모라상 수상자',
        f: [42, 82, 66, 65, 70, 78, 80], gk: [87, 87, 89, 86, 88],
      },
      {
        slug: 'mathieu', name: '제레미 마티외', pos: 'DF', main: ['CB', 'LB'], ovr: 82,
        nat: '프랑스', code: 'FR', sta: 82, styles: ['stopper_cb'],
        note: '엘 클라시코 결승 헤더골을 터뜨린 멀티 수비수',
        f: [62, 76, 75, 72, 86, 83, 85],
      },
      {
        slug: 'bartra', name: '마르크 바르트라', pos: 'DF', main: ['CB'], ovr: 81,
        nat: '스페인', code: 'ES', sta: 83, styles: ['ball_playing_cb'],
        note: '라 마시아 출신 발밑 좋은 로테이션 센터백',
        f: [55, 81, 68, 74, 80, 82, 81],
      },
      {
        slug: 'xavi', name: '사비 에르난데스', pos: 'MF', main: ['CM', 'CDM'], ovr: 88,
        nat: '스페인', code: 'ES', sta: 78, styles: ['deep_playmaker', 'playmaker_10'],
        note: '후반전 투입만으로 경기 템포를 완벽히 잠근 트레블 캡틴',
        f: [76, 95, 89, 91, 60, 73, 72],
      },
      {
        slug: 'rafinha', name: '하피냐 알칸타라', pos: 'MF', main: ['CM', 'CAM'], sec: ['RW'], ovr: 81,
        nat: '브라질', code: 'BR', sta: 85, styles: ['box_to_box'],
        note: '부드러운 왼발 탈압박과 전방 압박의 멀티 미드필더',
        f: [76, 83, 77, 85, 68, 72, 79],
      },
      {
        slug: 'pedro', name: '페드로 로드리게스', pos: 'FW', main: ['RW', 'LW'], ovr: 85,
        nat: '스페인', code: 'ES', sta: 90, styles: ['line_breaker', 'classic_winger'],
        note: '양발 결정력과 성실한 오프더볼 침투의 특급 슈퍼 서브',
        f: [85, 82, 82, 86, 68, 60, 86],
      },
    ]),
  },

  // =========================================================================
  // 4. 08-09 FC 바르셀로나 (4-3-3 · 점유율 · 펩 과르디올라)
  // Slots: [GK, LB, CB, CB, RB, CDM, CM, CM, LW, ST, RW]
  // =========================================================================
  'hist-0809-barca': {
    starters: buildSquad('hist-0809-barca', '08-09 FC 바르셀로나', 'laliga', [
      {
        slug: 'valdes', name: '빅토르 발데스', pos: 'GK', main: ['GK'], ovr: 87,
        nat: '스페인', code: 'ES', sta: 84, styles: ['sweeper_keeper', 'shot_stopper'],
        note: '1대1 선방과 후방 패스 빌드업의 원조 스위퍼 키퍼',
        f: [42, 81, 65, 64, 70, 78, 82], gk: [87, 84, 90, 86, 87],
      },
      {
        slug: 'abidal', name: '에릭 아비달', pos: 'DF', main: ['LB', 'CB'], ovr: 86,
        nat: '프랑스', code: 'FR', sta: 88, styles: ['stopper_cb', 'ball_playing_cb'],
        note: '알베스가 전진할 때 스리백처럼 후방을 지킨 철벽 풀백',
        f: [62, 81, 79, 80, 83, 88, 87],
      },
      {
        slug: 'puyol', name: '카를레스 푸욜', pos: 'DF', main: ['CB', 'RB'], ovr: 92,
        nat: '스페인', code: 'ES', sta: 93, styles: ['stopper_cb'],
        note: '타잔 캡틴, 투지·리더십·공중볼·커버링의 완벽한 수비수',
        f: [60, 81, 74, 74, 92, 95, 92],
      },
      {
        slug: 'pique', name: '제라르 피케', pos: 'DF', main: ['CB'], ovr: 87,
        nat: '스페인', code: 'ES', sta: 87, styles: ['ball_playing_cb'],
        note: '과르디올라 체제에서 만개한 패스형 센터백, 6-2 레알전 쐐기골',
        f: [66, 85, 72, 78, 89, 87, 86],
      },
      {
        slug: 'alves', name: '다니 알베스', pos: 'DF', main: ['RB', 'RWB'], ovr: 91,
        nat: '브라질', code: 'BR', sta: 95, styles: ['attacking_wingback'],
        note: '우측 터치라인 전체를 지배한 폭발적 에너지와 크로스',
        f: [80, 88, 92, 90, 73, 85, 91],
      },
      {
        slug: 'busquets', name: '세르히오 부스케츠', pos: 'MF', main: ['CDM'], sec: ['CM'], ovr: 87,
        nat: '스페인', code: 'ES', sta: 88, styles: ['deep_playmaker', 'ball_winner'],
        note: '펩이 과감히 발탁한 천재 피보테, 티키타카의 축',
        f: [65, 90, 77, 87, 81, 87, 81],
      },
      {
        slug: 'xavi', name: '사비 에르난데스', pos: 'MF', main: ['CM', 'CDM'], sec: ['CAM'], ovr: 94,
        nat: '스페인', code: 'ES', sta: 92, styles: ['deep_playmaker', 'playmaker_10'],
        note: '시즌 30도움 · UCL 결승전 어시스트, 티키타카의 뇌',
        f: [81, 98, 92, 94, 62, 78, 80],
      },
      {
        slug: 'iniesta', name: '안드레스 이니에스타', pos: 'MF', main: ['CM', 'CAM'], sec: ['LW'], ovr: 92,
        nat: '스페인', code: 'ES', sta: 89, styles: ['playmaker_10', 'deep_playmaker'],
        note: '스탬포드 브리지 기적의 극장골, 경이로운 드리블 탈압박',
        f: [82, 94, 86, 97, 62, 74, 82],
      },
      {
        slug: 'henry', name: '티에리 앙리', pos: 'FW', main: ['LW', 'ST'], ovr: 90,
        nat: '프랑스', code: 'FR', sta: 85, styles: ['inverted_winger', 'line_breaker'],
        note: '시즌 26골, 왼쪽에서 파고드는 우아한 인사이드 감아차기',
        f: [92, 87, 84, 92, 78, 48, 89],
      },
      {
        slug: 'etoo', name: '사무엘 에투', pos: 'FW', main: ['ST', 'RW'], ovr: 92,
        nat: '카메룬', code: 'CM', sta: 91, styles: ['line_breaker', 'poacher'],
        note: '시즌 36골 · UCL 결승 선제골, 번개 같은 침투와 결정력',
        f: [94, 82, 78, 89, 82, 54, 93],
      },
      {
        slug: 'messi', name: '리오넬 메시', pos: 'FW', main: ['RW', 'ST'], sec: ['CAM'], ovr: 95,
        nat: '아르헨티나', code: 'AR', sta: 90, styles: ['inverted_winger', 'playmaker_10'],
        note: '첫 발롱도르 · 38골, UCL 결승전 환상 헤더 쐐기골 & 펄스 나인 혁명',
        f: [95, 93, 90, 98, 76, 48, 89],
      },
    ]),
    bench: buildSquad('hist-0809-barca', '08-09 FC 바르셀로나', 'laliga', [
      {
        slug: 'pinto', name: '호세 마누엘 핀토', pos: 'GK', main: ['GK'], ovr: 78,
        nat: '스페인', code: 'ES', sta: 75, styles: ['shot_stopper'],
        note: '코파 델 레이 전 경기 출전 우승을 이끈 컵 전문 골키퍼',
        f: [38, 66, 54, 52, 66, 70, 76], gk: [79, 77, 81, 74, 78],
      },
      {
        slug: 'marquez', name: '라파엘 마르케스', pos: 'DF', main: ['CB', 'CDM'], ovr: 86,
        nat: '멕시코', code: 'MX', sta: 82, styles: ['ball_playing_cb', 'deep_playmaker'],
        note: '정교한 롱패스와 프리킥 능력을 겸비한 카이저 센터백',
        f: [72, 87, 80, 78, 85, 86, 82],
      },
      {
        slug: 'toure', name: '야야 투레', pos: 'MF', main: ['CDM', 'CM'], sec: ['CB'], ovr: 88,
        nat: '코트디부아르', code: 'CI', sta: 90, styles: ['box_to_box', 'ball_winner'],
        note: 'UCL 결승 임시 센터백 완벽 소화, 압도적 피지컬과 전진 드리블',
        f: [82, 86, 78, 85, 88, 87, 94],
      },
      {
        slug: 'keita', name: '세이두 케이타', pos: 'MF', main: ['CM', 'CDM'], ovr: 83,
        nat: '말리', code: 'ML', sta: 90, styles: ['box_to_box', 'ball_winner'],
        note: '과르디올라가 가장 신뢰한 성실한 전술형 박스투박스',
        f: [76, 82, 74, 80, 82, 83, 86],
      },
      {
        slug: 'gudjohnsen', name: '아이두르 구드욘센', pos: 'MF', main: ['CAM', 'ST'], sec: ['CM'], ovr: 81,
        nat: '아이슬란드', code: 'IS', sta: 80, styles: ['complete_forward'],
        note: '공격과 중원을 오가며 연계를 도운 베테랑 멀티 자원',
        f: [81, 82, 76, 80, 79, 62, 80],
      },
      {
        slug: 'bojan', name: '보얀 크르키치', pos: 'FW', main: ['ST', 'RW'], sec: ['LW'], ovr: 80,
        nat: '스페인', code: 'ES', sta: 83, styles: ['line_breaker', 'poacher'],
        note: '코파 델 레이 결승 득점, 민첩한 라 마시아 신성',
        f: [81, 77, 74, 85, 64, 42, 78],
      },
    ]),
  },

  // =========================================================================
  // 5. 22-23 맨체스터 시티 (3-4-2-1 · 점유율 · 펩 과르디올라)
  // Slots: [GK, CB, CB, CB, LWB, CM, CM, RWB, CAM, CAM, ST]
  // =========================================================================
  'hist-2223-mancity': {
    starters: buildSquad('hist-2223-mancity', '22-23 맨체스터 시티', 'epl', [
      {
        slug: 'ederson', name: '에데르송', pos: 'GK', main: ['GK'], ovr: 90,
        nat: '브라질', code: 'BR', sta: 84, styles: ['sweeper_keeper'],
        note: 'UCL 결승 막판 기적의 선방과 70m 핀포인트 롱킥 빌드업',
        f: [48, 90, 82, 72, 72, 80, 84], gk: [89, 86, 90, 97, 89],
      },
      {
        slug: 'akanji', name: '마누엘 아칸지', pos: 'DF', main: ['CB', 'LB'], sec: ['RB'], ovr: 86,
        nat: '스위스', code: 'CH', sta: 88, styles: ['ball_playing_cb'],
        note: '결승 선제골 기점 패스, 빠른 발과 침착한 빌드업',
        f: [58, 83, 74, 78, 84, 87, 88],
      },
      {
        slug: 'dias', name: '후벵 디아스', pos: 'DF', main: ['CB'], ovr: 90,
        nat: '포르투갈', code: 'PT', sta: 89, styles: ['stopper_cb', 'ball_playing_cb'],
        note: '트레블 수비진의 리더, 완벽한 위치 선정과 육탄 블록',
        f: [55, 83, 66, 72, 90, 92, 90],
      },
      {
        slug: 'walker', name: '카일 워커', pos: 'DF', main: ['CB', 'RB'], sec: ['RWB'], ovr: 87,
        nat: '잉글랜드', code: 'GB-ENG', sta: 91, styles: ['stopper_cb', 'attacking_wingback'],
        note: '비니시우스를 완벽 봉쇄한 세계 최고 속도의 우측 스토퍼',
        f: [66, 80, 81, 79, 80, 87, 94],
      },
      {
        slug: 'grealish', name: '잭 그릴리시', pos: 'DF', main: ['LWB', 'LW'], sec: ['LM', 'CAM'], ovr: 86,
        nat: '잉글랜드', code: 'GB-ENG', sta: 89, styles: ['classic_winger', 'playmaker_10'],
        note: '압도적 볼 키핑과 파울 유도로 좌측 템포를 완벽히 조율',
        f: [78, 87, 86, 91, 64, 65, 84],
      },
      {
        slug: 'stones', name: '존 스톤스', pos: 'MF', main: ['CM', 'CDM'], sec: ['CB'], ovr: 89,
        nat: '잉글랜드', code: 'GB-ENG', sta: 88, styles: ['ball_playing_cb', 'deep_playmaker'],
        note: '3-2-4-1 혁명의 핵심! 센터백과 볼란치를 오가는 현대판 베켄바워',
        f: [70, 89, 76, 87, 86, 89, 86],
      },
      {
        slug: 'rodri', name: '로드리', pos: 'MF', main: ['CM', 'CDM'], ovr: 93,
        nat: '스페인', code: 'ES', sta: 94, styles: ['deep_playmaker', 'ball_winner'],
        note: 'UCL 결승 결승골 · 대회 최우수 선수, 현시대 최강 수비형 미들',
        f: [84, 93, 82, 88, 88, 92, 91],
      },
      {
        slug: 'bernardo', name: '베르나르두 실바', pos: 'DF', main: ['RWB', 'RW'], sec: ['CM', 'CAM'], ovr: 90,
        nat: '포르투갈', code: 'PT', sta: 95, styles: ['playmaker_10', 'box_to_box'],
        note: '레알 마드리드 4강 멀티골, 무한 체력과 자석 같은 왼발 탈압박',
        f: [83, 91, 88, 94, 62, 76, 85],
      },
      {
        slug: 'gundogan', name: '일카이 귄도안', pos: 'MF', main: ['CAM', 'CM'], sec: ['CDM'], ovr: 89,
        nat: '독일', code: 'DE', sta: 87, styles: ['box_to_box', 'playmaker_10'],
        note: 'FA컵 결승 12초 골 포함 멀티골, 시즌 막판 클러치 트레블 주장',
        f: [87, 91, 83, 89, 74, 78, 80],
      },
      {
        slug: 'kdb', name: '케빈 더 브라위너', pos: 'MF', main: ['CAM', 'CM'], ovr: 94,
        nat: '벨기에', code: 'BE', sta: 87, styles: ['playmaker_10', 'deep_playmaker'],
        note: '시즌 31도움 · 레알전 중거리 동점포, 차원이 다른 킬패스·크로스',
        f: [91, 97, 97, 90, 74, 70, 86],
      },
      {
        slug: 'haaland', name: '엘링 홀란', pos: 'FW', main: ['ST'], ovr: 94,
        nat: '노르웨이', code: 'NO', sta: 90, styles: ['poacher', 'line_breaker'],
        note: 'EPL 단일 시즌 신기록 36골 · 총 52골, 괴물 피지컬·결정력',
        f: [97, 76, 68, 83, 93, 46, 97],
      },
    ]),
    bench: buildSquad('hist-2223-mancity', '22-23 맨체스터 시티', 'epl', [
      {
        slug: 'ortega', name: '슈테판 오르테가', pos: 'GK', main: ['GK'], ovr: 82,
        nat: '독일', code: 'DE', sta: 78, styles: ['sweeper_keeper'],
        note: 'FA컵 우승 주전 키퍼, 안정적 발밑과 반사신경',
        f: [40, 79, 64, 62, 68, 74, 78], gk: [82, 81, 84, 83, 82],
      },
      {
        slug: 'ake', name: '네이선 아케', pos: 'DF', main: ['CB', 'LB'], ovr: 85,
        nat: '네덜란드', code: 'NL', sta: 86, styles: ['stopper_cb', 'ball_playing_cb'],
        note: '우측 윙어 전담 봉쇄와 정확한 왼발 빌드업',
        f: [58, 81, 74, 75, 86, 87, 84],
      },
      {
        slug: 'laporte', name: '아이메릭 라포르트', pos: 'DF', main: ['CB'], ovr: 85,
        nat: '스페인', code: 'ES', sta: 82, styles: ['ball_playing_cb'],
        note: '정확한 왼발 대각선 롱패스의 빌드업 센터백',
        f: [58, 85, 76, 74, 86, 86, 83],
      },
      {
        slug: 'foden', name: '필 포든', pos: 'MF', main: ['CAM', 'LW'], sec: ['RW', 'CM'], ovr: 88,
        nat: '잉글랜드', code: 'GB-ENG', sta: 88, styles: ['inverted_winger', 'playmaker_10'],
        note: '결승전 교체 투입으로 중원에 활력을 불어넣은 맨시티 성골 천재',
        f: [87, 88, 84, 92, 64, 60, 81],
      },
      {
        slug: 'mahrez', name: '리야드 마레즈', pos: 'FW', main: ['RW'], sec: ['RM', 'CAM'], ovr: 87,
        nat: '알제리', code: 'DZ', sta: 84, styles: ['inverted_winger'],
        note: 'FA컵 4강 해트트릭, 환상적인 퍼스트 터치와 왼발 감아차기',
        f: [87, 87, 88, 93, 62, 48, 79],
      },
      {
        slug: 'alvarez', name: '훌리안 알바레스', pos: 'FW', main: ['ST', 'CAM'], sec: ['RW'], ovr: 86,
        nat: '아르헨티나', code: 'AR', sta: 93, styles: ['complete_forward', 'line_breaker'],
        note: '시즌 17골 · 레알 4강 쐐기골, 왕성한 압박과 양발 마무리',
        f: [88, 83, 80, 86, 74, 62, 87],
      },
    ]),
  },

  // =========================================================================
  // 6. 09-10 인터 밀란 (4-2-3-1 · 역습 · 조제 무리뉴)
  // Slots: [GK, LB, CB, CB, RB, CDM, CDM, LW, CAM, RW, ST]
  // =========================================================================
  'hist-0910-inter': {
    starters: buildSquad('hist-0910-inter', '09-10 인터 밀란', 'seriea', [
      {
        slug: 'cesar', name: '줄리우 세자르', pos: 'GK', main: ['GK'], ovr: 90,
        nat: '브라질', code: 'BR', sta: 84, styles: ['shot_stopper'],
        note: '캄프 누 메시의 감아차기를 쳐낸 신들린 반사신경의 수호신',
        f: [42, 76, 62, 60, 72, 80, 84], gk: [91, 88, 93, 82, 90],
      },
      {
        slug: 'zanetti', name: '하비에르 사네티', pos: 'DF', main: ['LB', 'RB'], sec: ['CDM', 'CM'], ovr: 89,
        nat: '아르헨티나', code: 'AR', sta: 96, styles: ['ball_winner', 'attacking_wingback'],
        note: '지치지 않는 강철 캡틴, 4강에서 메시를 꽁꽁 묶은 전설',
        f: [70, 86, 84, 87, 78, 91, 92],
      },
      {
        slug: 'samuel', name: '발테르 사무엘', pos: 'DF', main: ['CB'], ovr: 89,
        nat: '아르헨티나', code: 'AR', sta: 86, styles: ['stopper_cb'],
        note: '‘더 월(The Wall)’ — 무자비한 대인 마크와 완벽한 제공권',
        f: [55, 76, 64, 68, 92, 92, 91],
      },
      {
        slug: 'lucio', name: '루시우', pos: 'DF', main: ['CB'], ovr: 90,
        nat: '브라질', code: 'BR', sta: 89, styles: ['stopper_cb', 'ball_playing_cb'],
        note: '트레블 수비의 핵, 육탄 방어와 호쾌한 오버래핑 돌파',
        f: [66, 80, 70, 79, 92, 92, 93],
      },
      {
        slug: 'maicon', name: '마이콩', pos: 'DF', main: ['RB', 'RWB'], ovr: 91,
        nat: '브라질', code: 'BR', sta: 94, styles: ['attacking_wingback'],
        note: '당대 세계 최강 라이트백, 우측면을 찢는 파괴적 돌파와 대포알 슈팅',
        f: [83, 86, 91, 88, 82, 87, 94],
      },
      {
        slug: 'cambiasso', name: '에스테반 캄비아소', pos: 'MF', main: ['CDM', 'CM'], ovr: 89,
        nat: '아르헨티나', code: 'AR', sta: 92, styles: ['ball_winner', 'deep_playmaker'],
        note: '무리뉴의 그라운드 위 두뇌, 완벽한 인터셉트와 공간 커버',
        f: [76, 88, 78, 84, 80, 91, 86],
      },
      {
        slug: 'motta', name: '티아고 모타', pos: 'MF', main: ['CDM', 'CM'], ovr: 86,
        nat: '이탈리아', code: 'IT', sta: 85, styles: ['deep_playmaker', 'ball_winner'],
        note: '노련한 패스 배급과 중원 템포 조절의 핵심 볼란치',
        f: [74, 88, 76, 82, 84, 86, 85],
      },
      {
        slug: 'pandev', name: '고란 판데프', pos: 'FW', main: ['LW', 'RW'], sec: ['CAM', 'ST'], ovr: 84,
        nat: '북마케도니아', code: 'MK', sta: 88, styles: ['classic_winger', 'line_breaker'],
        note: '겨울 합류 후 헌신적 수비 가담과 날카로운 역습 전개',
        f: [82, 83, 81, 86, 72, 62, 82],
      },
      {
        slug: 'sneijder', name: '베슬러이 스네이더르', pos: 'MF', main: ['CAM'], sec: ['CM'], ovr: 92,
        nat: '네덜란드', code: 'NL', sta: 88, styles: ['playmaker_10'],
        note: 'UCL 도움왕 · 결승 어시스트, 양발 킬패스와 무회전 프리킥 마법사',
        f: [90, 95, 94, 91, 66, 65, 81],
      },
      {
        slug: 'etoo', name: '사무엘 에투', pos: 'FW', main: ['RW', 'ST'], sec: ['LW'], ovr: 90,
        nat: '카메룬', code: 'CM', sta: 94, styles: ['line_breaker', 'complete_forward'],
        note: '팀을 위해 측면 윙백 수준 수비까지 소화하며 역습을 이끈 헌신의 아이콘',
        f: [91, 84, 82, 89, 80, 68, 92],
      },
      {
        slug: 'milito', name: '디에고 밀리토', pos: 'FW', main: ['ST'], ovr: 91,
        nat: '아르헨티나', code: 'AR', sta: 88, styles: ['poacher', 'complete_forward'],
        note: '리그·코파·UCL 결승전 결승골 모두 작렬(결승 멀티골)한 왕자',
        f: [95, 82, 76, 89, 86, 52, 86],
      },
    ]),
    bench: buildSquad('hist-0910-inter', '09-10 인터 밀란', 'seriea', [
      {
        slug: 'toldo', name: '프란체스코 톨도', pos: 'GK', main: ['GK'], ovr: 79,
        nat: '이탈리아', code: 'IT', sta: 74, styles: ['shot_stopper'],
        note: '풍부한 경험으로 라커룸을 지탱한 베테랑 수문장',
        f: [36, 65, 52, 48, 72, 74, 76], gk: [80, 79, 81, 70, 82],
      },
      {
        slug: 'chivu', name: '크리스티안 키부', pos: 'DF', main: ['LB', 'CB'], ovr: 84,
        nat: '루마니아', code: 'RO', sta: 85, styles: ['stopper_cb'],
        note: '헤드기어 투혼으로 좌측 수비를 책임진 결승전 선발 멤버',
        f: [66, 80, 80, 77, 82, 86, 84],
      },
      {
        slug: 'cordoba', name: '이반 코르도바', pos: 'DF', main: ['CB', 'RB'], ovr: 83,
        nat: '콜롬비아', code: 'CO', sta: 86, styles: ['stopper_cb'],
        note: '폭발적 점프력과 빠른 발의 베테랑 수비수',
        f: [50, 72, 64, 70, 88, 85, 87],
      },
      {
        slug: 'materazzi', name: '마르코 마테라치', pos: 'DF', main: ['CB'], ovr: 81,
        nat: '이탈리아', code: 'IT', sta: 76, styles: ['stopper_cb'],
        note: '강력한 제공권과 라커룸 정신적 지주',
        f: [64, 72, 64, 62, 89, 83, 86],
      },
      {
        slug: 'stankovic', name: '데얀 스탄코비치', pos: 'MF', main: ['CM', 'CDM'], sec: ['CAM'], ovr: 85,
        nat: '세르비아', code: 'RS', sta: 89, styles: ['box_to_box', 'ball_winner'],
        note: '폭발적인 중거리 캐논슛과 거친 중원 압박',
        f: [86, 84, 82, 80, 80, 83, 88],
      },
      {
        slug: 'balotelli', name: '마리오 발로텔리', pos: 'FW', main: ['ST', 'LW'], ovr: 83,
        nat: '이탈리아', code: 'IT', sta: 82, styles: ['complete_forward'],
        note: '폭발적 피지컬과 강력한 슈팅력을 지닌 천재 유망주 조커',
        f: [86, 76, 76, 85, 83, 44, 88],
      },
    ]),
  },

  // =========================================================================
  // 7. 98-99 맨체스터 유나이티드 (4-4-2 · 측면 공략 · 알렉스 퍼거슨)
  // Slots: [GK, LB, CB, CB, RB, LM, CM, CM, RM, ST, ST]
  // =========================================================================
  'hist-9899-manutd': {
    starters: buildSquad('hist-9899-manutd', '98-99 맨체스터 유나이티드', 'epl', [
      {
        slug: 'schmeichel', name: '피터 슈마이켈', pos: 'GK', main: ['GK'], ovr: 92,
        nat: '덴마크', code: 'DK', sta: 86, styles: ['shot_stopper'],
        note: 'FA컵 4강 베르캄프 PK 선방, 역대 최고의 거인 수문장',
        f: [44, 78, 68, 60, 82, 84, 91], gk: [93, 91, 94, 86, 93],
      },
      {
        slug: 'irwin', name: '데니스 어윈', pos: 'DF', main: ['LB', 'RB'], ovr: 86,
        nat: '아일랜드', code: 'IE', sta: 89, styles: ['attacking_wingback'],
        note: '퍼거슨이 꼽은 역대 최고 영입, 완벽한 양발 수비와 프리킥·PK',
        f: [76, 84, 87, 80, 76, 87, 84],
      },
      {
        slug: 'stam', name: '야프 스탐', pos: 'DF', main: ['CB'], ovr: 91,
        nat: '네덜란드', code: 'NL', sta: 90, styles: ['stopper_cb'],
        note: '압도적 피지컬·스피드·태클로 EPL을 지배한 네덜란드 거벽',
        f: [56, 78, 66, 72, 93, 93, 95],
      },
      {
        slug: 'johnsen', name: '로니 욘센', pos: 'DF', main: ['CB', 'CDM'], ovr: 84,
        nat: '노르웨이', code: 'NO', sta: 86, styles: ['ball_playing_cb', 'stopper_cb'],
        note: '스탐 옆에서 침착한 커버링과 빌드업을 도맡은 언성 히어로',
        f: [58, 79, 68, 73, 86, 85, 85],
      },
      {
        slug: 'gneville', name: '게리 네빌', pos: 'DF', main: ['RB'], ovr: 85,
        nat: '잉글랜드', code: 'GB-ENG', sta: 91, styles: ['attacking_wingback'],
        note: '베컴 뒤를 완벽히 받쳐준 헌신적 오버래핑과 단단한 수비',
        f: [62, 81, 84, 76, 78, 86, 86],
      },
      {
        slug: 'giggs', name: '라이언 긱스', pos: 'MF', main: ['LM', 'LW'], ovr: 91,
        nat: '웨일스', code: 'GB-WLS', sta: 92, styles: ['classic_winger', 'line_breaker'],
        note: 'FA컵 4강 아스널전 60m 단독 드리블 원더골의 전설 윙어',
        f: [84, 88, 92, 95, 70, 62, 90],
      },
      {
        slug: 'keane', name: '로이 킨', pos: 'MF', main: ['CM', 'CDM'], ovr: 91,
        nat: '아일랜드', code: 'IE', sta: 96, styles: ['ball_winner', 'box_to_box'],
        note: '유벤투스 4강 대역전극을 홀로 이끈 불굴의 캡틴·중원 지배자',
        f: [80, 88, 80, 83, 84, 92, 94],
      },
      {
        slug: 'scholes', name: '폴 스콜스', pos: 'MF', main: ['CM', 'CAM'], ovr: 90,
        nat: '잉글랜드', code: 'GB-ENG', sta: 90, styles: ['deep_playmaker', 'box_to_box'],
        note: '대포알 중거리 슛과 침투, 정교한 장거리 롱패스의 천재',
        f: [89, 94, 88, 88, 76, 78, 83],
      },
      {
        slug: 'beckham', name: '데이비드 베컴', pos: 'MF', main: ['RM', 'RW'], sec: ['CM'], ovr: 92,
        nat: '잉글랜드', code: 'GB-ENG', sta: 95, styles: ['classic_winger', 'deep_playmaker'],
        note: '발롱도르 2위 · 캄프 누 기적의 코너킥 2도움, 역대 최고 오른발 크로스',
        f: [88, 94, 99, 86, 74, 74, 86],
      },
      {
        slug: 'yorke', name: '드와이트 요크', pos: 'FW', main: ['ST'], ovr: 89,
        nat: '트리니다드 토바고', code: 'TT', sta: 89, styles: ['complete_forward', 'poacher'],
        note: 'EPL 득점왕·MVP · 시즌 29골, 콜과 역대급 투톱 호흡',
        f: [91, 84, 80, 88, 86, 52, 88],
      },
      {
        slug: 'cole', name: '앤디 콜', pos: 'FW', main: ['ST'], ovr: 88,
        nat: '잉글랜드', code: 'GB-ENG', sta: 89, styles: ['poacher', 'line_breaker'],
        note: '시즌 24골 · 유벤투스전 결승골, 영리한 오프더볼 침투',
        f: [90, 80, 74, 85, 84, 48, 88],
      },
    ]),
    bench: buildSquad('hist-9899-manutd', '98-99 맨체스터 유나이티드', 'epl', [
      {
        slug: 'vandergouw', name: '라이몬트 판 데르 하우', pos: 'GK', main: ['GK'], ovr: 77,
        nat: '네덜란드', code: 'NL', sta: 74, styles: ['shot_stopper'],
        note: '베테랑 백업 골키퍼',
        f: [36, 65, 52, 48, 66, 70, 74], gk: [78, 77, 79, 72, 78],
      },
      {
        slug: 'berg', name: '헤닝 베르그', pos: 'DF', main: ['CB', 'RB'], ovr: 82,
        nat: '노르웨이', code: 'NO', sta: 84, styles: ['stopper_cb'],
        note: '안정적 위치 선정의 노르웨이 수비수',
        f: [50, 74, 68, 68, 85, 84, 83],
      },
      {
        slug: 'butt', name: '니키 버트', pos: 'MF', main: ['CDM', 'CM'], ovr: 83,
        nat: '잉글랜드', code: 'GB-ENG', sta: 90, styles: ['ball_winner', 'box_to_box'],
        note: '결승전 로이 킨의 공백을 묵묵히 메운 클래스 오브 92',
        f: [72, 81, 74, 78, 78, 85, 87],
      },
      {
        slug: 'blomqvist', name: '예스퍼 블롬크비스트', pos: 'MF', main: ['LM', 'LW'], ovr: 81,
        nat: '스웨덴', code: 'SE', sta: 86, styles: ['classic_winger'],
        note: '결승 선발 출전, 성실한 좌측 측면 돌파',
        f: [76, 80, 84, 84, 66, 56, 82],
      },
      {
        slug: 'sheringham', name: '테디 셰링엄', pos: 'FW', main: ['ST', 'CAM'], ovr: 86,
        nat: '잉글랜드', code: 'GB-ENG', sta: 82, styles: ['complete_forward', 'playmaker_10'],
        note: 'FA컵 결승골 + 캄프 누 91분 동점골·93분 어시스트, 전설의 슈퍼 서브',
        f: [88, 87, 82, 84, 86, 54, 81],
      },
      {
        slug: 'solskjaer', name: '올레 군나르 솔샤르', pos: 'FW', main: ['ST', 'RW'], ovr: 86,
        nat: '노르웨이', code: 'NO', sta: 86, styles: ['poacher'],
        note: '캄프 누 93분 극장 역전 결승골, 동안의 암살자',
        f: [91, 80, 76, 84, 82, 48, 82],
      },
    ]),
  },

  // =========================================================================
  // 8. 23-24 바이어 레버쿠젠 (3-4-2-1 · 점유율 · 사비 알론소)
  // Slots: [GK, CB, CB, CB, LWB, CM, CM, RWB, CAM, CAM, ST]
  // =========================================================================
  'hist-2324-leverkusen': {
    starters: buildSquad('hist-2324-leverkusen', '23-24 바이어 레버쿠젠', 'bundesliga', [
      {
        slug: 'hradecky', name: '루카시 흐라데츠키', pos: 'GK', main: ['GK'], ovr: 84,
        nat: '핀란드', code: 'FI', sta: 82, styles: ['shot_stopper'],
        note: '분데스리가 34R 24실점·15클린시트 무패 캡틴',
        f: [40, 74, 60, 58, 70, 76, 80], gk: [85, 83, 86, 78, 85],
      },
      {
        slug: 'hincapie', name: '피에로 인카피에', pos: 'DF', main: ['CB', 'LB'], sec: ['LWB'], ovr: 83,
        nat: '에콰도르', code: 'EC', sta: 89, styles: ['ball_playing_cb', 'stopper_cb'],
        note: '빠른 커버 스피드와 공격적 전진 패스의 좌측 스토퍼',
        f: [60, 81, 76, 79, 82, 84, 86],
      },
      {
        slug: 'tah', name: '요나탄 타', pos: 'DF', main: ['CB'], ovr: 86,
        nat: '독일', code: 'DE', sta: 88, styles: ['stopper_cb', 'ball_playing_cb'],
        note: '무패 스리백의 중앙 지휘관, 압도적 제공권과 빌드업',
        f: [56, 82, 66, 72, 90, 88, 90],
      },
      {
        slug: 'tapsoba', name: '에드몽 탑소바', pos: 'DF', main: ['CB'], ovr: 84,
        nat: '부르키나파소', code: 'BF', sta: 87, styles: ['ball_playing_cb'],
        note: '침착한 탈압박과 정확한 전진 패스',
        f: [58, 83, 70, 78, 84, 85, 86],
      },
      {
        slug: 'grimaldo', name: '알레한드로 그리말도', pos: 'DF', main: ['LWB', 'LB'], sec: ['LM'], ovr: 87,
        nat: '스페인', code: 'ES', sta: 91, styles: ['attacking_wingback', 'playmaker_10'],
        note: '시즌 12골 20도움, 윙백 역사상 최고 수준의 왼발 킥·프리킥',
        f: [84, 88, 93, 87, 62, 79, 84],
      },
      {
        slug: 'xhaka', name: '그라니트 자카', pos: 'MF', main: ['CM', 'CDM'], ovr: 87,
        nat: '스위스', code: 'CH', sta: 93, styles: ['deep_playmaker', 'ball_winner'],
        note: '사비 알론소 축구의 절대 심장, 포칼 결승 중거리 결승포',
        f: [81, 91, 86, 83, 78, 85, 88],
      },
      {
        slug: 'palacios', name: '에세키엘 팔라시오스', pos: 'MF', main: ['CM', 'CDM'], ovr: 84,
        nat: '아르헨티나', code: 'AR', sta: 90, styles: ['box_to_box', 'ball_winner'],
        note: '압박 탈취와 왕성한 활동량으로 자카를 보좌한 중원 엔진',
        f: [76, 85, 76, 84, 72, 84, 85],
      },
      {
        slug: 'frimpong', name: '제레미 프림퐁', pos: 'DF', main: ['RWB', 'RM'], sec: ['RB', 'RW'], ovr: 86,
        nat: '네덜란드', code: 'NL', sta: 93, styles: ['attacking_wingback', 'line_breaker'],
        note: '시즌 14골 12도움, 윙어급 돌파와 압도적 스피드',
        f: [81, 81, 85, 90, 62, 76, 94],
      },
      {
        slug: 'wirtz', name: '플로리안 비르츠', pos: 'MF', main: ['CAM', 'LW'], sec: ['CM'], ovr: 89,
        nat: '독일', code: 'DE', sta: 90, styles: ['playmaker_10', 'inverted_winger'],
        note: '분데스리가 올해의 선수 · 우승 확정 해트트릭, 천재 10번',
        f: [86, 91, 86, 94, 62, 58, 82],
      },
      {
        slug: 'hofmann', name: '요나스 호프만', pos: 'MF', main: ['CAM', 'RW'], sec: ['RM'], ovr: 82,
        nat: '독일', code: 'DE', sta: 86, styles: ['playmaker_10', 'classic_winger'],
        note: '하프스페이스 연계와 영리한 오프더볼의 베테랑 공격형 미들',
        f: [80, 85, 85, 83, 66, 62, 79],
      },
      {
        slug: 'boniface', name: '빅터 보니페이스', pos: 'FW', main: ['ST'], ovr: 85,
        nat: '나이지리아', code: 'NG', sta: 86, styles: ['complete_forward', 'poacher'],
        note: '시즌 21골 10도움, 파워풀한 드리블과 연계의 무패 주포',
        f: [87, 81, 74, 86, 86, 48, 91],
      },
    ]),
    bench: buildSquad('hist-2324-leverkusen', '23-24 바이어 레버쿠젠', 'bundesliga', [
      {
        slug: 'kovar', name: '마테이 코바르', pos: 'GK', main: ['GK'], ovr: 78,
        nat: '체코', code: 'CZ', sta: 78, styles: ['sweeper_keeper'],
        note: '컵·유로파리그를 책임진 빌드업 골키퍼',
        f: [38, 76, 62, 60, 68, 72, 76], gk: [78, 77, 80, 81, 77],
      },
      {
        slug: 'kossounou', name: '오딜롱 코수누', pos: 'DF', main: ['CB', 'RB'], ovr: 82,
        nat: '코트디부아르', code: 'CI', sta: 87, styles: ['ball_playing_cb'],
        note: '빠른 발과 드리블 전진 능력을 갖춘 우측 센터백',
        f: [56, 80, 70, 79, 83, 83, 87],
      },
      {
        slug: 'stanisic', name: '요시프 스타니시치', pos: 'DF', main: ['CB', 'RB'], sec: ['RWB'], ovr: 81,
        nat: '크로아티아', code: 'HR', sta: 86, styles: ['stopper_cb'],
        note: '바이에른·도르트문트전 극장골을 터뜨린 네버루젠 수호신',
        f: [64, 79, 77, 76, 81, 83, 83],
      },
      {
        slug: 'andrich', name: '로베르트 안드리히', pos: 'MF', main: ['CDM', 'CM'], sec: ['CB'], ovr: 83,
        nat: '독일', code: 'DE', sta: 90, styles: ['ball_winner', 'box_to_box'],
        note: '후반 극장 중거리포와 거친 수비 장악력의 터프가이',
        f: [80, 82, 75, 78, 82, 85, 88],
      },
      {
        slug: 'adli', name: '아민 아들리', pos: 'FW', main: ['CAM', 'LW'], sec: ['RW', 'ST'], ovr: 81,
        nat: '모로코', code: 'MA', sta: 87, styles: ['line_breaker', 'inverted_winger'],
        note: '포칼 득점왕, 민첩한 돌파로 수비를 흔드는 특급 조커',
        f: [80, 79, 78, 86, 68, 52, 83],
      },
      {
        slug: 'schick', name: '파트리크 시크', pos: 'FW', main: ['ST'], ovr: 83,
        nat: '체코', code: 'CZ', sta: 82, styles: ['poacher'],
        note: '추가시간 극장골 제조기, 정교한 왼발과 공중볼 마무리',
        f: [87, 74, 70, 80, 88, 44, 84],
      },
    ]),
  },

  // =========================================================================
  // 9. 17-18 맨체스터 시티 (4-3-3 · 점유율 · 펩 과르디올라)
  // Slots: [GK, LB, CB, CB, RB, CDM, CM, CM, LW, ST, RW]
  // =========================================================================
  'hist-1718-mancity': {
    starters: buildSquad('hist-1718-mancity', '17-18 맨체스터 시티', 'epl', [
      {
        slug: 'ederson', name: '에데르송', pos: 'GK', main: ['GK'], ovr: 88,
        nat: '브라질', code: 'BR', sta: 84, styles: ['sweeper_keeper'],
        note: '입단 첫 해부터 EPL 빌드업 패러다임을 바꾼 스위퍼 키퍼',
        f: [46, 89, 80, 72, 70, 78, 83], gk: [87, 85, 88, 96, 87],
      },
      {
        slug: 'delph', name: '파비안 델프', pos: 'DF', main: ['LB', 'CDM'], sec: ['CM'], ovr: 83,
        nat: '잉글랜드', code: 'GB-ENG', sta: 89, styles: ['deep_playmaker', 'ball_winner'],
        note: '인버티드 풀백으로 완벽 변신해 중원 수적 우위를 만든 숨은 공신',
        f: [70, 84, 79, 82, 70, 83, 84],
      },
      {
        slug: 'kompany', name: '뱅상 콤파니', pos: 'DF', main: ['CB'], ovr: 89,
        nat: '벨기에', code: 'BE', sta: 82, styles: ['stopper_cb', 'ball_playing_cb'],
        note: '센추리온즈 캡틴, 압도적 카리스마와 대인 수비',
        f: [62, 82, 68, 74, 91, 91, 91],
      },
      {
        slug: 'otamendi', name: '니콜라스 오타멘디', pos: 'DF', main: ['CB'], ovr: 86,
        nat: '아르헨티나', code: 'AR', sta: 86, styles: ['stopper_cb', 'ball_playing_cb'],
        note: 'PFA 올해의 팀 선정, 거친 태클과 세트피스 헤더 득점',
        f: [60, 81, 66, 72, 89, 88, 87],
      },
      {
        slug: 'walker', name: '카일 워커', pos: 'DF', main: ['RB', 'RWB'], ovr: 88,
        nat: '잉글랜드', code: 'GB-ENG', sta: 93, styles: ['attacking_wingback'],
        note: 'PFA 올해의 팀, 역습 차단의 절대자이자 우측면 고속 기관차',
        f: [68, 82, 84, 81, 80, 87, 95],
      },
      {
        slug: 'fernandinho', name: '페르난지뉴', pos: 'MF', main: ['CDM'], sec: ['CM', 'CB'], ovr: 89,
        nat: '브라질', code: 'BR', sta: 92, styles: ['ball_winner', 'deep_playmaker'],
        note: '더 브라위너·실바의 뒤를 혼자 다 막아낸 완벽한 원볼란치',
        f: [76, 88, 78, 84, 82, 91, 89],
      },
      {
        slug: 'dsilva', name: '다비드 실바', pos: 'MF', main: ['CM', 'CAM'], ovr: 91,
        nat: '스페인', code: 'ES', sta: 86, styles: ['playmaker_10', 'deep_playmaker'],
        note: '‘엘 마고’ — 좁은 공간에서 예술을 빚는 프리롤 8번 마법사',
        f: [82, 95, 89, 95, 60, 66, 76],
      },
      {
        slug: 'kdb', name: '케빈 더 브라위너', pos: 'MF', main: ['CM', 'CAM'], ovr: 93,
        nat: '벨기에', code: 'BE', sta: 92, styles: ['playmaker_10', 'box_to_box'],
        note: 'EPL 도움왕 16A · 센추리온즈의 지휘자, 양발 패스·중거리 최강',
        f: [90, 96, 96, 90, 74, 72, 88],
      },
      {
        slug: 'sane', name: '르로이 자네', pos: 'FW', main: ['LW', 'LM'], ovr: 88,
        nat: '독일', code: 'DE', sta: 88, styles: ['classic_winger', 'line_breaker'],
        note: 'PFA 올해의 영플레이어(10G 15A), 좌측 터치라인을 찢는 번개',
        f: [85, 84, 88, 92, 72, 46, 93],
      },
      {
        slug: 'aguero', name: '세르히오 아구에로', pos: 'FW', main: ['ST'], ovr: 92,
        nat: '아르헨티나', code: 'AR', sta: 85, styles: ['poacher', 'complete_forward'],
        note: 'EPL 21골 · 역대급 니어포스트 강슛과 민첩한 박스 움직임',
        f: [95, 83, 76, 92, 79, 44, 86],
      },
      {
        slug: 'sterling', name: '라힘 스털링', pos: 'FW', main: ['RW', 'LW'], ovr: 88,
        nat: '잉글랜드', code: 'GB-ENG', sta: 90, styles: ['line_breaker', 'inverted_winger'],
        note: '리그 18골 11도움, 극장골 제조기이자 날카로운 파포스트 침투',
        f: [86, 83, 82, 91, 64, 52, 90],
      },
    ]),
    bench: buildSquad('hist-1718-mancity', '17-18 맨체스터 시티', 'epl', [
      {
        slug: 'bravo', name: '클라우디오 브라보', pos: 'GK', main: ['GK'], ovr: 81,
        nat: '칠레', code: 'CL', sta: 76, styles: ['sweeper_keeper'],
        note: '카라바오컵 우승을 이끈 베테랑 스위퍼 키퍼',
        f: [38, 79, 62, 60, 66, 74, 76], gk: [81, 80, 82, 84, 81],
      },
      {
        slug: 'stones', name: '존 스톤스', pos: 'DF', main: ['CB'], ovr: 85,
        nat: '잉글랜드', code: 'GB-ENG', sta: 85, styles: ['ball_playing_cb'],
        note: '부드러운 전진 패스의 빌드업 센터백',
        f: [56, 85, 70, 80, 84, 86, 83],
      },
      {
        slug: 'laporte', name: '아이메릭 라포르트', pos: 'DF', main: ['CB', 'LB'], ovr: 85,
        nat: '스페인', code: 'ES', sta: 85, styles: ['ball_playing_cb'],
        note: '겨울 합류 후 수비 안정성을 한층 끌어올린 왼발 센터백',
        f: [58, 85, 75, 75, 86, 86, 84],
      },
      {
        slug: 'gundogan', name: '일카이 귄도안', pos: 'MF', main: ['CM', 'CDM'], sec: ['CAM'], ovr: 86,
        nat: '독일', code: 'DE', sta: 84, styles: ['deep_playmaker', 'box_to_box'],
        note: '안정적인 템포 조절과 박스 침투',
        f: [82, 88, 80, 87, 70, 77, 79],
      },
      {
        slug: 'bernardo', name: '베르나르두 실바', pos: 'MF', main: ['RW', 'CAM'], sec: ['CM'], ovr: 86,
        nat: '포르투갈', code: 'PT', sta: 92, styles: ['playmaker_10', 'box_to_box'],
        note: '최다 출전급 로테이션 핵심, 기술과 압박의 조화',
        f: [81, 88, 86, 91, 60, 72, 82],
      },
      {
        slug: 'jesus', name: '가브리엘 제수스', pos: 'FW', main: ['ST'], sec: ['RW', 'LW'], ovr: 85,
        nat: '브라질', code: 'BR', sta: 90, styles: ['line_breaker', 'complete_forward'],
        note: '최종전 94분 승점 100점 확정 칩슛의 주인공',
        f: [86, 81, 76, 88, 78, 56, 85],
      },
    ]),
  },

  // =========================================================================
  // 10. 11-12 레알 마드리드 (4-2-3-1 · 역습 · 조제 무리뉴)
  // Slots: [GK, LB, CB, CB, RB, CDM, CDM, LW, CAM, RW, ST]
  // =========================================================================
  'hist-1112-realmadrid': {
    starters: buildSquad('hist-1112-realmadrid', '11-12 레알 마드리드', 'laliga', [
      {
        slug: 'casillas', name: '이케르 카시야스', pos: 'GK', main: ['GK'], ovr: 92,
        nat: '스페인', code: 'ES', sta: 85, styles: ['shot_stopper'],
        note: '‘성 이케르’ — 신들린 반사신경과 결정적 1대1 선방',
        f: [42, 78, 64, 62, 72, 82, 84], gk: [93, 90, 96, 82, 93],
      },
      {
        slug: 'marcelo', name: '마르셀루', pos: 'DF', main: ['LB', 'LWB'], ovr: 89,
        nat: '브라질', code: 'BR', sta: 91, styles: ['attacking_wingback'],
        note: '호날두와 좌측면을 폭격한 윙어급 테크닉의 공격형 풀백',
        f: [78, 87, 89, 93, 68, 82, 88],
      },
      {
        slug: 'ramos', name: '세르히오 라모스', pos: 'DF', main: ['CB', 'RB'], ovr: 91,
        nat: '스페인', code: 'ES', sta: 91, styles: ['stopper_cb', 'ball_playing_cb'],
        note: '센터백 전환 첫 시즌 완벽 각성, 공중볼·대인 수비·투지 최상',
        f: [72, 84, 78, 80, 94, 92, 92],
      },
      {
        slug: 'pepe', name: '페페', pos: 'DF', main: ['CB'], ovr: 89,
        nat: '포르투갈', code: 'PT', sta: 89, styles: ['stopper_cb'],
        note: '전성기 압도적 스피드와 거친 대인 방어의 파이터 센터백',
        f: [56, 78, 66, 72, 91, 92, 92],
      },
      {
        slug: 'arbeloa', name: '알바로 아르벨로아', pos: 'DF', main: ['RB', 'LB'], ovr: 83,
        nat: '스페인', code: 'ES', sta: 86, styles: ['stopper_cb'],
        note: '마르셀루가 전진할 때 후방을 든든히 지킨 수비형 라이트백',
        f: [58, 78, 76, 74, 78, 85, 83],
      },
      {
        slug: 'alonso', name: '사비 알론소', pos: 'MF', main: ['CDM'], sec: ['CM'], ovr: 91,
        nat: '스페인', code: 'ES', sta: 89, styles: ['deep_playmaker', 'ball_winner'],
        note: '무리뉴 역습 축구의 발사대, 60m 칼날 롱패스와 전술 지휘',
        f: [82, 95, 92, 84, 78, 88, 84],
      },
      {
        slug: 'khedira', name: '사미 케디라', pos: 'MF', main: ['CDM', 'CM'], ovr: 85,
        nat: '독일', code: 'DE', sta: 92, styles: ['box_to_box', 'ball_winner'],
        note: '캄프 누 선제골, 엄청난 활동량으로 중원을 쓸어 담은 언성 히어로',
        f: [76, 82, 74, 79, 85, 86, 90],
      },
      {
        slug: 'ronaldo', name: '크리스티아누 호날두', pos: 'FW', main: ['LW', 'ST'], ovr: 96,
        nat: '포르투갈', code: 'PT', sta: 94, styles: ['line_breaker', 'inverted_winger'],
        note: '리그 46골 · 시즌 60골, 캄프 누 칼마 결승골의 역대급 역습 머신',
        f: [98, 86, 88, 95, 95, 46, 96],
      },
      {
        slug: 'ozil', name: '메수트 외질', pos: 'MF', main: ['CAM'], sec: ['RW'], ovr: 91,
        nat: '독일', code: 'DE', sta: 83, styles: ['playmaker_10'],
        note: '라리가 도움왕 17A, 호날두에게 배달한 천재적 원터치 스루패스',
        f: [81, 96, 91, 94, 60, 48, 78],
      },
      {
        slug: 'dimaria', name: '앙헬 디 마리아', pos: 'FW', main: ['RW', 'LW'], sec: ['CAM', 'RM'], ovr: 89,
        nat: '아르헨티나', code: 'AR', sta: 90, styles: ['classic_winger', 'inverted_winger'],
        note: '리그 15도움, 지치지 않는 드리블과 날카로운 왼발 아웃프런트 크로스',
        f: [84, 89, 92, 93, 64, 62, 87],
      },
      {
        slug: 'benzema', name: '카림 벤제마', pos: 'FW', main: ['ST'], ovr: 90,
        nat: '프랑스', code: 'FR', sta: 87, styles: ['complete_forward'],
        note: '시즌 32골 19도움, 호날두와 환상 호흡을 이룬 연계형 스트라이커',
        f: [91, 88, 81, 91, 85, 48, 86],
      },
    ]),
    bench: buildSquad('hist-1112-realmadrid', '11-12 레알 마드리드', 'laliga', [
      {
        slug: 'adan', name: '안토니오 아단', pos: 'GK', main: ['GK'], ovr: 77,
        nat: '스페인', code: 'ES', sta: 75, styles: ['shot_stopper'],
        note: '레알 유스 출신 백업 골키퍼',
        f: [36, 66, 52, 50, 66, 70, 74], gk: [78, 76, 79, 74, 77],
      },
      {
        slug: 'coentrao', name: '파비우 코엔트랑', pos: 'DF', main: ['LB', 'LWB'], sec: ['CDM'], ovr: 84,
        nat: '포르투갈', code: 'PT', sta: 89, styles: ['attacking_wingback', 'ball_winner'],
        note: '빅매치 수비 안정감을 더해준 강인한 레프트백',
        f: [70, 81, 82, 82, 74, 85, 86],
      },
      {
        slug: 'varane', name: '라파엘 바란', pos: 'DF', main: ['CB'], ovr: 82,
        nat: '프랑스', code: 'FR', sta: 86, styles: ['stopper_cb', 'ball_playing_cb'],
        note: '지단의 추천으로 영입된 압도적 스피드의 천재 센터백',
        f: [52, 78, 64, 72, 85, 83, 88],
      },
      {
        slug: 'kaka', name: '카카', pos: 'MF', main: ['CAM'], sec: ['CM', 'LW'], ovr: 86,
        nat: '브라질', code: 'BR', sta: 81, styles: ['playmaker_10'],
        note: '우아한 치고 달리기와 결정력을 뽐낸 슈퍼 서브',
        f: [85, 88, 84, 90, 74, 52, 83],
      },
      {
        slug: 'callejon', name: '호세 카예혼', pos: 'FW', main: ['RW', 'LW'], sec: ['ST'], ovr: 82,
        nat: '스페인', code: 'ES', sta: 89, styles: ['line_breaker'],
        note: '무리뉴의 특급 조커, 시즌 13골의 날카로운 뒷공간 침투',
        f: [84, 77, 79, 82, 70, 56, 86],
      },
      {
        slug: 'higuain', name: '곤살로 이과인', pos: 'FW', main: ['ST'], ovr: 88,
        nat: '아르헨티나', code: 'AR', sta: 85, styles: ['poacher', 'line_breaker'],
        note: '리그 22골! 벤제마와 선의의 경쟁을 펼친 특급 골잡이',
        f: [91, 78, 72, 85, 83, 44, 86],
      },
    ]),
  },

  // =========================================================================
  // 11. 13-14 유벤투스 (3-5-2 · 점유율 · 안토니오 콘테)
  // Slots: [GK, CB, CB, CB, LWB, CDM, CM, CAM, RWB, ST, ST]
  // =========================================================================
  'hist-1314-juventus': {
    starters: buildSquad('hist-1314-juventus', '13-14 유벤투스', 'seriea', [
      {
        slug: 'buffon', name: '잔루이지 부폰', pos: 'GK', main: ['GK'], ovr: 92,
        nat: '이탈리아', code: 'IT', sta: 84, styles: ['shot_stopper'],
        note: '세리에 A 23실점 철벽의 수호신이자 불멸의 캡틴',
        f: [42, 78, 64, 60, 76, 84, 86], gk: [92, 91, 93, 82, 95],
      },
      {
        slug: 'chiellini', name: '조르조 키엘리니', pos: 'DF', main: ['CB'], ovr: 90,
        nat: '이탈리아', code: 'IT', sta: 89, styles: ['stopper_cb'],
        note: 'BBC 스리백의 투사, 거친 대인 수비와 완벽한 박스 방어',
        f: [54, 76, 66, 68, 92, 93, 92],
      },
      {
        slug: 'bonucci', name: '레오나르도 보누치', pos: 'DF', main: ['CB'], ovr: 88,
        nat: '이탈리아', code: 'IT', sta: 87, styles: ['ball_playing_cb'],
        note: '후방에서 단번에 공격수로 연결하는 스리백의 롱패스 사령관',
        f: [62, 88, 76, 75, 88, 88, 86],
      },
      {
        slug: 'barzagli', name: '안드레아 바르찰리', pos: 'DF', main: ['CB'], ovr: 89,
        nat: '이탈리아', code: 'IT', sta: 86, styles: ['stopper_cb'],
        note: '실수 제로의 완벽한 위치 선정, 이탈리아 수비의 교과서',
        f: [50, 79, 68, 72, 87, 92, 88],
      },
      {
        slug: 'asamoah', name: '콰드워 아사모아', pos: 'DF', main: ['LWB', 'LM'], sec: ['CM', 'LB'], ovr: 83,
        nat: '가나', code: 'GH', sta: 92, styles: ['attacking_wingback', 'box_to_box'],
        note: '지치지 않는 좌측 윙백, 폭발적 돌파와 수비 가담',
        f: [72, 80, 81, 84, 74, 82, 88],
      },
      {
        slug: 'pirlo', name: '안드레아 피를로', pos: 'MF', main: ['CDM', 'CM'], ovr: 91,
        nat: '이탈리아', code: 'IT', sta: 83, styles: ['deep_playmaker'],
        note: '세리에 A 올해의 선수 · 레지스타의 정점, 예술 같은 로빙 패스와 프리킥',
        f: [84, 97, 96, 90, 62, 74, 72],
      },
      {
        slug: 'vidal', name: '아르투로 비달', pos: 'MF', main: ['CM', 'CDM'], sec: ['CAM'], ovr: 89,
        nat: '칠레', code: 'CL', sta: 95, styles: ['box_to_box', 'ball_winner'],
        note: '리그 11골 · 미친 활동량과 태클, 전성기 최강 박스투박스',
        f: [85, 85, 78, 85, 84, 90, 93],
      },
      {
        slug: 'pogba', name: '폴 포그바', pos: 'MF', main: ['CAM', 'CM'], ovr: 87,
        nat: '프랑스', code: 'FR', sta: 90, styles: ['box_to_box', 'playmaker_10'],
        note: '압도적 피지컬과 화려한 기술, 대포알 중거리 슛의 괴물 신성',
        f: [85, 87, 81, 90, 86, 80, 91],
      },
      {
        slug: 'lichtsteiner', name: '슈테판 리히트슈타이너', pos: 'DF', main: ['RWB', 'RB'], ovr: 84,
        nat: '스위스', code: 'CH', sta: 95, styles: ['attacking_wingback'],
        note: '‘스위스 특급’ — 90분 내내 우측을 왕복하는 무한 엔진',
        f: [70, 79, 83, 79, 76, 85, 89],
      },
      {
        slug: 'tevez', name: '카를로스 테베스', pos: 'FW', main: ['ST', 'CAM'], ovr: 90,
        nat: '아르헨티나', code: 'AR', sta: 93, styles: ['complete_forward', 'line_breaker'],
        note: '리그 19골 · 불도저 같은 드리블과 투지의 102점 에이스',
        f: [91, 86, 82, 91, 78, 60, 91],
      },
      {
        slug: 'llorente', name: '페르난도 요렌테', pos: 'FW', main: ['ST'], ovr: 84,
        nat: '스페인', code: 'ES', sta: 84, styles: ['poacher'],
        note: '리그 16골 · 테베스 옆에서 제공권과 포스트 플레이를 완벽 수행',
        f: [86, 75, 68, 76, 94, 46, 89],
      },
    ]),
    bench: buildSquad('hist-1314-juventus', '13-14 유벤투스', 'seriea', [
      {
        slug: 'storari', name: '마르코 스토라리', pos: 'GK', main: ['GK'], ovr: 79,
        nat: '이탈리아', code: 'IT', sta: 75, styles: ['shot_stopper'],
        note: '부폰 결장 시 골문을 지킨 베테랑 키퍼',
        f: [36, 66, 52, 48, 68, 72, 76], gk: [80, 78, 81, 72, 80],
      },
      {
        slug: 'caceres', name: '마르틴 카세레스', pos: 'DF', main: ['CB', 'RB'], sec: ['RWB'], ovr: 82,
        nat: '우루과이', code: 'UY', sta: 86, styles: ['stopper_cb'],
        note: 'BBC 스리백의 완벽한 4번째 멀티 센터백',
        f: [62, 76, 74, 75, 83, 84, 85],
      },
      {
        slug: 'ogbonna', name: '안젤로 오그본나', pos: 'DF', main: ['CB'], ovr: 80,
        nat: '이탈리아', code: 'IT', sta: 82, styles: ['stopper_cb'],
        note: '왼발 빌드업과 탄탄한 체격의 백업 수비수',
        f: [50, 74, 62, 68, 84, 82, 85],
      },
      {
        slug: 'marchisio', name: '클라우디오 마르키시오', pos: 'MF', main: ['CM', 'CDM'], sec: ['CAM'], ovr: 87,
        nat: '이탈리아', code: 'IT', sta: 91, styles: ['box_to_box', 'deep_playmaker'],
        note: '유벤투스 성골 프린스, 완벽한 전술 지능의 만능 미드필더',
        f: [82, 88, 81, 86, 76, 84, 86],
      },
      {
        slug: 'giovinco', name: '세바스티안 조빈코', pos: 'FW', main: ['ST', 'CAM'], sec: ['LW'], ovr: 82,
        nat: '이탈리아', code: 'IT', sta: 82, styles: ['playmaker_10', 'line_breaker'],
        note: '‘원자 개미’ — 날렵한 드리블과 예리한 프리킥 조커',
        f: [82, 83, 83, 89, 52, 42, 74],
      },
      {
        slug: 'vucinic', name: '미르코 부치니치', pos: 'FW', main: ['ST', 'LW'], ovr: 82,
        nat: '몬테네그로', code: 'ME', sta: 80, styles: ['complete_forward'],
        note: '창의적인 연계와 유연한 볼 터치의 공격수',
        f: [83, 81, 76, 85, 78, 46, 81],
      },
    ]),
  },

  // =========================================================================
  // 12. 03-04 아스널 (4-4-2 · 역습 · 아르센 벵거)
  // Slots: [GK, LB, CB, CB, RB, LM, CM, CM, RM, ST, ST]
  // =========================================================================
  'hist-0304-arsenal': {
    starters: buildSquad('hist-0304-arsenal', '03-04 아스널', 'epl', [
      {
        slug: 'lehmann', name: '옌스 레만', pos: 'GK', main: ['GK'], ovr: 87,
        nat: '독일', code: 'DE', sta: 84, styles: ['sweeper_keeper', 'shot_stopper'],
        note: '38경기 전 경기 출전 무패 우승 달성, 적극적인 박스 장악력',
        f: [42, 79, 64, 62, 76, 82, 85], gk: [87, 85, 89, 83, 88],
      },
      {
        slug: 'acole', name: '애슐리 콜', pos: 'DF', main: ['LB', 'LWB'], ovr: 90,
        nat: '잉글랜드', code: 'GB-ENG', sta: 94, styles: ['attacking_wingback'],
        note: '피레스·앙리와 황금 좌측 삼각편대를 형성한 EPL 역대 최고 LB',
        f: [70, 84, 86, 86, 74, 91, 91],
      },
      {
        slug: 'campbell', name: '솔 캠벨', pos: 'DF', main: ['CB'], ovr: 90,
        nat: '잉글랜드', code: 'GB-ENG', sta: 88, styles: ['stopper_cb'],
        note: '압도적 피지컬과 공중볼 장악력, 무패 수비진의 바위',
        f: [55, 76, 62, 70, 93, 92, 95],
      },
      {
        slug: 'toure', name: '콜로 투레', pos: 'DF', main: ['CB', 'RB'], ovr: 86,
        nat: '코트디부아르', code: 'CI', sta: 90, styles: ['stopper_cb'],
        note: '폭발적인 스피드와 투지로 캠벨과 철벽 콤비를 이룬 센터백',
        f: [58, 77, 68, 74, 86, 87, 90],
      },
      {
        slug: 'lauren', name: '로랑', pos: 'DF', main: ['RB'], ovr: 84,
        nat: '카메룬', code: 'CM', sta: 89, styles: ['stopper_cb', 'attacking_wingback'],
        note: '거친 대인 수비와 침착한 PK 능력의 무패 라이트백',
        f: [66, 80, 79, 78, 78, 86, 87],
      },
      {
        slug: 'pires', name: '로베르 피레스', pos: 'MF', main: ['LM', 'LW'], sec: ['CAM'], ovr: 90,
        nat: '프랑스', code: 'FR', sta: 88, styles: ['inverted_winger', 'playmaker_10'],
        note: '리그 14골 10도움, 우아한 컷인과 환상적인 원투패스 예술가',
        f: [87, 90, 88, 92, 72, 60, 84],
      },
      {
        slug: 'vieira', name: '파트리크 비에이라', pos: 'MF', main: ['CM', 'CDM'], ovr: 93,
        nat: '프랑스', code: 'FR', sta: 95, styles: ['box_to_box', 'ball_winner'],
        note: '인빈시블 캡틴, 압도적 피지컬·태클·전진 드리블의 역대급 미들',
        f: [81, 89, 78, 89, 91, 93, 95],
      },
      {
        slug: 'gilberto', name: '질베르투 실바', pos: 'MF', main: ['CM', 'CDM'], ovr: 87,
        nat: '브라질', code: 'BR', sta: 91, styles: ['ball_winner', 'deep_playmaker'],
        note: '‘보이지 않는 벽’ — 비에이라의 전진을 완벽히 커버한 수비의 축',
        f: [70, 85, 74, 80, 84, 90, 88],
      },
      {
        slug: 'ljungberg', name: '프레드리크 융베리', pos: 'MF', main: ['RM', 'RW'], sec: ['CAM'], ovr: 86,
        nat: '스웨덴', code: 'SE', sta: 91, styles: ['line_breaker', 'classic_winger'],
        note: '베르캄프의 스루패스를 받아 꽂아 넣는 날카로운 대각선 침투',
        f: [84, 83, 83, 87, 72, 64, 87],
      },
      {
        slug: 'bergkamp', name: '데니스 베르캄프', pos: 'FW', main: ['ST', 'CAM'], ovr: 91,
        nat: '네덜란드', code: 'NL', sta: 82, styles: ['playmaker_10', 'complete_forward'],
        note: '축구 예술의 극치, 환상적인 퍼스트 터치와 기적의 스루패스',
        f: [90, 95, 89, 95, 76, 48, 80],
      },
      {
        slug: 'henry', name: '티에리 앙리', pos: 'FW', main: ['ST', 'LW'], ovr: 95,
        nat: '프랑스', code: 'FR', sta: 91, styles: ['line_breaker', 'complete_forward'],
        note: 'EPL 득점왕 30골 · MVP, 폭발적 가속과 우아한 감아차기의 킹',
        f: [96, 89, 86, 96, 80, 48, 94],
      },
    ]),
    bench: buildSquad('hist-0304-arsenal', '03-04 아스널', 'epl', [
      {
        slug: 'taylor', name: '스튜어트 테일러', pos: 'GK', main: ['GK'], ovr: 76,
        nat: '잉글랜드', code: 'GB-ENG', sta: 74, styles: ['shot_stopper'],
        note: '아스널 유스 출신 백업 골키퍼',
        f: [35, 64, 52, 48, 66, 68, 74], gk: [77, 75, 78, 71, 76],
      },
      {
        slug: 'keown', name: '마틴 키언', pos: 'DF', main: ['CB'], ovr: 82,
        nat: '잉글랜드', code: 'GB-ENG', sta: 80, styles: ['stopper_cb'],
        note: '투지 넘치는 베테랑 스토퍼',
        f: [48, 70, 60, 62, 86, 85, 86],
      },
      {
        slug: 'clichy', name: '가엘 클리시', pos: 'DF', main: ['LB', 'LWB'], ovr: 80,
        nat: '프랑스', code: 'FR', sta: 88, styles: ['attacking_wingback'],
        note: '최연소 EPL 우승 메달 획득, 빠른 발의 신예 풀백',
        f: [58, 76, 78, 79, 68, 80, 86],
      },
      {
        slug: 'edu', name: '에두 가스파르', pos: 'MF', main: ['CM', 'CDM'], ovr: 84,
        nat: '브라질', code: 'BR', sta: 87, styles: ['box_to_box', 'deep_playmaker'],
        note: '30경기 출전, 왼발 패스와 중거리 슛이 돋보인 핵심 로테이션',
        f: [79, 85, 80, 83, 80, 82, 85],
      },
      {
        slug: 'parlour', name: '레이 팔러', pos: 'MF', main: ['CM', 'RM'], ovr: 82,
        nat: '잉글랜드', code: 'GB-ENG', sta: 90, styles: ['box_to_box'],
        note: '헌신적 활동량과 중거리 슛의 베테랑',
        f: [78, 81, 80, 80, 74, 80, 86],
      },
      {
        slug: 'reyes', name: '호세 안토니오 레예스', pos: 'FW', main: ['LW', 'ST'], sec: ['LM'], ovr: 84,
        nat: '스페인', code: 'ES', sta: 86, styles: ['line_breaker', 'inverted_winger'],
        note: '겨울 합류 후 첼시전 멀티골 등 폭발적 스피드의 신성',
        f: [84, 82, 82, 88, 68, 48, 87],
      },
    ]),
  },

  // =========================================================================
  // 13. 04-05 첼시 (4-3-3 · 역습 · 조제 무리뉴)
  // Slots: [GK, LB, CB, CB, RB, CDM, CM, CM, LW, ST, RW]
  // =========================================================================
  'hist-0405-chelsea': {
    starters: buildSquad('hist-0405-chelsea', '04-05 첼시', 'epl', [
      {
        slug: 'cech', name: '페트르 체흐', pos: 'GK', main: ['GK'], ovr: 92,
        nat: '체코', code: 'CZ', sta: 85, styles: ['shot_stopper'],
        note: 'EPL 역대 최다 24클린시트 · 15실점 신화의 절대 수호신',
        f: [42, 76, 64, 60, 80, 84, 88], gk: [93, 92, 93, 84, 94],
      },
      {
        slug: 'gallas', name: '윌리암 갈라스', pos: 'DF', main: ['LB', 'CB'], sec: ['RB'], ovr: 86,
        nat: '프랑스', code: 'FR', sta: 89, styles: ['stopper_cb'],
        note: '좌측 풀백과 센터백을 완벽히 소화한 강철 대인 수비수',
        f: [64, 78, 76, 77, 84, 89, 89],
      },
      {
        slug: 'terry', name: '존 테리', pos: 'DF', main: ['CB'], ovr: 92,
        nat: '잉글랜드', code: 'GB-ENG', sta: 90, styles: ['stopper_cb'],
        note: 'PFA 올해의 선수 · 15실점 철벽의 캡틴, 압도적 헤더와 태클',
        f: [62, 81, 68, 72, 95, 95, 92],
      },
      {
        slug: 'carvalho', name: '히카르두 카르발류', pos: 'DF', main: ['CB'], ovr: 90,
        nat: '포르투갈', code: 'PT', sta: 87, styles: ['ball_playing_cb', 'stopper_cb'],
        note: '지능적인 예측 인터셉트와 빌드업, 테리와 역대 최고 CB 듀오',
        f: [58, 84, 70, 78, 88, 93, 88],
      },
      {
        slug: 'ferreira', name: '파울루 페헤이라', pos: 'DF', main: ['RB'], ovr: 84,
        nat: '포르투갈', code: 'PT', sta: 88, styles: ['stopper_cb', 'attacking_wingback'],
        note: '무리뉴가 포르투에서 데려온 묵묵하고 빈틈없는 라이트백',
        f: [60, 80, 82, 77, 76, 86, 85],
      },
      {
        slug: 'makelele', name: '클로드 마켈렐레', pos: 'MF', main: ['CDM'], ovr: 91,
        nat: '프랑스', code: 'FR', sta: 95, styles: ['ball_winner', 'deep_playmaker'],
        note: '‘마켈렐레 롤’의 창시자, 포백 앞을 완벽히 지운 역대급 앵커',
        f: [62, 87, 74, 84, 74, 95, 90],
      },
      {
        slug: 'lampard', name: '프랭크 램파드', pos: 'MF', main: ['CM', 'CAM'], ovr: 92,
        nat: '잉글랜드', code: 'GB-ENG', sta: 96, styles: ['box_to_box', 'playmaker_10'],
        note: '발롱도르 2위 · 리그 13골 18도움, 미들라이커의 완성형',
        f: [92, 93, 88, 86, 80, 80, 91],
      },
      {
        slug: 'tiago', name: '티아구 멘데스', pos: 'MF', main: ['CM', 'CDM'], ovr: 84,
        nat: '포르투갈', code: 'PT', sta: 89, styles: ['box_to_box', 'ball_winner'],
        note: '마켈렐레·램파드 사이에서 균형을 잡은 전술형 미드필더',
        f: [76, 84, 78, 81, 78, 84, 86],
      },
      {
        slug: 'duff', name: '데미안 더프', pos: 'FW', main: ['LW', 'LM'], sec: ['RW'], ovr: 86,
        nat: '아일랜드', code: 'IE', sta: 89, styles: ['classic_winger', 'line_breaker'],
        note: '로벤과 양 측면을 흔들며 바르사전 결승골을 도운 날카로운 왼발 윙어',
        f: [82, 84, 87, 89, 68, 58, 86],
      },
      {
        slug: 'drogba', name: '디디에 드로그바', pos: 'FW', main: ['ST'], ovr: 89,
        nat: '코트디부아르', code: 'CI', sta: 90, styles: ['complete_forward', 'poacher'],
        note: '압도적 피지컬과 공중볼 포스트 플레이로 역습 기점을 연 드록신',
        f: [90, 79, 76, 84, 94, 54, 95],
      },
      {
        slug: 'robben', name: '아르옌 로벤', pos: 'FW', main: ['RW', 'LW'], ovr: 89,
        nat: '네덜란드', code: 'NL', sta: 86, styles: ['inverted_winger', 'line_breaker'],
        note: '부상 복귀 직후 리그를 폭격한 폭발적 스피드와 드리블',
        f: [87, 84, 88, 94, 64, 48, 92],
      },
    ]),
    bench: buildSquad('hist-0405-chelsea', '04-05 첼시', 'epl', [
      {
        slug: 'cudicini', name: '카를로 쿠디치니', pos: 'GK', main: ['GK'], ovr: 82,
        nat: '이탈리아', code: 'IT', sta: 78, styles: ['shot_stopper'],
        note: '리그 최고급 백업 골키퍼',
        f: [38, 70, 56, 54, 70, 74, 78], gk: [83, 81, 84, 75, 82],
      },
      {
        slug: 'bridge', name: '웨인 브리지', pos: 'DF', main: ['LB'], ovr: 81,
        nat: '잉글랜드', code: 'GB-ENG', sta: 85, styles: ['attacking_wingback'],
        note: '정교한 왼발 크로스의 잉글랜드 레프트백',
        f: [62, 78, 83, 77, 72, 82, 83],
      },
      {
        slug: 'huth', name: '로베르트 후트', pos: 'DF', main: ['CB'], ovr: 79,
        nat: '독일', code: 'DE', sta: 82, styles: ['stopper_cb'],
        note: '강력한 몸싸움과 공중볼의 젊은 센터백',
        f: [52, 66, 56, 58, 86, 81, 87],
      },
      {
        slug: 'smertin', name: '알렉세이 스메르틴', pos: 'MF', main: ['CDM', 'CM'], ovr: 80,
        nat: '러시아', code: 'RU', sta: 87, styles: ['ball_winner'],
        note: '마켈렐레의 백업으로 수비 밸런스를 지킨 성실한 볼란치',
        f: [66, 78, 72, 74, 74, 83, 83],
      },
      {
        slug: 'jcole', name: '조 콜', pos: 'FW', main: ['RW', 'CAM'], sec: ['LW'], ovr: 85,
        nat: '잉글랜드', code: 'GB-ENG', sta: 86, styles: ['inverted_winger', 'playmaker_10'],
        note: '로벤 부상 공백을 화려한 드리블과 클러치 골로 완벽 대체',
        f: [82, 85, 84, 91, 62, 54, 81],
      },
      {
        slug: 'gudjohnsen', name: '아이두르 구드욘센', pos: 'FW', main: ['ST', 'CAM'], sec: ['CM'], ovr: 85,
        nat: '아이슬란드', code: 'IS', sta: 86, styles: ['complete_forward', 'playmaker_10'],
        note: '리그 12골 · 중원과 최전방을 오가며 팀 전술을 완성한 지능형 공격수',
        f: [85, 86, 80, 85, 81, 62, 82],
      },
    ]),
  },

  // =========================================================================
  // 14. 15-16 레스터 시티 (4-4-2 · 역습 · 클라우디오 라니에리)
  // Slots: [GK, LB, CB, CB, RB, LM, CM, CM, RM, ST, ST]
  // =========================================================================
  'hist-1516-leicester': {
    starters: buildSquad('hist-1516-leicester', '15-16 레스터 시티', 'epl', [
      {
        slug: 'schmeichel', name: '카스페르 슈마이켈', pos: 'GK', main: ['GK'], ovr: 82,
        nat: '덴마크', code: 'DK', sta: 84, styles: ['shot_stopper', 'sweeper_keeper'],
        note: '15클린시트 · 빠른 롱킥으로 역습의 시발점이 된 수호신',
        f: [40, 76, 68, 58, 70, 76, 82], gk: [83, 80, 85, 84, 82],
      },
      {
        slug: 'fuchs', name: '크리스티안 푸흐스', pos: 'DF', main: ['LB'], ovr: 78,
        nat: '오스트리아', code: 'AT', sta: 86, styles: ['attacking_wingback'],
        note: '정확한 왼발 얼리 크로스와 롱 스로인의 베테랑 레프트백',
        f: [64, 77, 84, 72, 74, 79, 80],
      },
      {
        slug: 'morgan', name: '웨스 모건', pos: 'DF', main: ['CB'], ovr: 78,
        nat: '자메이카', code: 'JM', sta: 85, styles: ['stopper_cb'],
        note: '전 경기 풀타임 출전! 육탄 방어와 헤더로 동화를 이끈 주장',
        f: [46, 66, 54, 58, 84, 81, 88],
      },
      {
        slug: 'huth', name: '로베르트 후트', pos: 'DF', main: ['CB'], ovr: 79,
        nat: '독일', code: 'DE', sta: 84, styles: ['stopper_cb'],
        note: '맨시티전 멀티골, 압도적 공중볼과 거친 박스 수비',
        f: [52, 66, 56, 58, 87, 82, 88],
      },
      {
        slug: 'simpson', name: '대니 심슨', pos: 'DF', main: ['RB'], ovr: 75,
        nat: '잉글랜드', code: 'GB-ENG', sta: 85, styles: ['stopper_cb'],
        note: '마레즈의 뒤를 묵묵히 지킨 수비 지향 풀백',
        f: [50, 70, 72, 70, 70, 78, 79],
      },
      {
        slug: 'albrighton', name: '마크 올브라이턴', pos: 'MF', main: ['LM', 'RM'], sec: ['LW'], ovr: 77,
        nat: '잉글랜드', code: 'GB-ENG', sta: 91, styles: ['classic_winger'],
        note: '성실한 수비 가담과 정확한 얼리 크로스의 언성 히어로',
        f: [72, 78, 84, 77, 62, 68, 81],
      },
      {
        slug: 'kante', name: '은골로 캉테', pos: 'MF', main: ['CM', 'CDM'], ovr: 86,
        nat: '프랑스', code: 'FR', sta: 99, styles: ['ball_winner', 'box_to_box'],
        note: '지구 표면의 30%를 덮은 미친 활동량·태클·인터셉트 1위 괴물',
        f: [68, 82, 72, 84, 68, 92, 92],
      },
      {
        slug: 'drinkwater', name: '대니 드링크워터', pos: 'MF', main: ['CM', 'CDM'], ovr: 79,
        nat: '잉글랜드', code: 'GB-ENG', sta: 90, styles: ['deep_playmaker', 'box_to_box'],
        note: '바디에게 꽂아 넣는 원터치 롱패스 역습의 발사대',
        f: [72, 83, 80, 76, 72, 79, 83],
      },
      {
        slug: 'mahrez', name: '리야드 마레즈', pos: 'MF', main: ['RM', 'RW'], ovr: 86,
        nat: '알제리', code: 'DZ', sta: 86, styles: ['inverted_winger', 'playmaker_10'],
        note: 'PFA 올해의 선수 · 17골 11도움, 마법 같은 왼발 드리블과 감아차기',
        f: [86, 86, 87, 93, 60, 48, 80],
      },
      {
        slug: 'okazaki', name: '오카자키 신지', pos: 'FW', main: ['ST', 'CAM'], ovr: 76,
        nat: '일본', code: 'JP', sta: 94, styles: ['box_to_box', 'line_breaker'],
        note: '지치지 않는 전방 압박과 공간 창출로 바디를 살린 헌신의 투톱',
        f: [77, 74, 68, 78, 74, 64, 84],
      },
      {
        slug: 'vardy', name: '제이미 바디', pos: 'FW', main: ['ST'], ovr: 85,
        nat: '잉글랜드', code: 'GB-ENG', sta: 92, styles: ['line_breaker', 'poacher'],
        note: 'EPL 신기록 11경기 연속골 · 24골, 번개 같은 뒷공간 침투와 발리슛',
        f: [89, 75, 72, 82, 78, 52, 93],
      },
    ]),
    bench: buildSquad('hist-1516-leicester', '15-16 레스터 시티', 'epl', [
      {
        slug: 'schwarzer', name: '마크 슈워처', pos: 'GK', main: ['GK'], ovr: 73,
        nat: '호주', code: 'AU', sta: 70, styles: ['shot_stopper'],
        note: '풍부한 경험의 백업 골키퍼',
        f: [32, 60, 48, 46, 66, 66, 70], gk: [74, 73, 74, 68, 76],
      },
      {
        slug: 'wasilewski', name: '마르친 바실레프스키', pos: 'DF', main: ['CB', 'RB'], ovr: 73,
        nat: '폴란드', code: 'PL', sta: 78, styles: ['stopper_cb'],
        note: '강인한 피지컬의 베테랑 수비수',
        f: [44, 62, 54, 54, 80, 76, 84],
      },
      {
        slug: 'schlupp', name: '제프리 슐룹', pos: 'DF', main: ['LB', 'LM'], sec: ['LWB'], ovr: 75,
        nat: '가나', code: 'GH', sta: 87, styles: ['attacking_wingback'],
        note: '폭발적 스피드로 좌측에 활력을 불어넣은 멀티 자원',
        f: [66, 71, 74, 78, 72, 74, 86],
      },
      {
        slug: 'king', name: '앤디 킹', pos: 'MF', main: ['CM'], sec: ['CAM'], ovr: 74,
        nat: '웨일스', code: 'GB-WLS', sta: 85, styles: ['box_to_box'],
        note: '3부→2부→1부 우승을 모두 함께한 레스터 원클럽맨',
        f: [72, 75, 70, 73, 72, 74, 78],
      },
      {
        slug: 'gray', name: '데마라이 그레이', pos: 'FW', main: ['LW', 'RW'], ovr: 74,
        nat: '잉글랜드', code: 'GB-ENG', sta: 84, styles: ['classic_winger', 'line_breaker'],
        note: '겨울 합류 후 후반 측면 흔들기를 맡은 유망주',
        f: [73, 71, 74, 81, 60, 44, 82],
      },
      {
        slug: 'ulloa', name: '레오나르도 우요아', pos: 'FW', main: ['ST'], ovr: 76,
        nat: '아르헨티나', code: 'AR', sta: 82, styles: ['poacher'],
        note: '노리치·웨스트햄전 극장골로 승점을 구해낸 슈퍼 서브 타겟맨',
        f: [80, 68, 62, 72, 85, 48, 84],
      },
    ]),
  },

  // =========================================================================
  // 15. 71-72 AFC 아약스 (4-3-3 · 점유율 · 슈테판 코바치 · 토탈 풋볼 트레블)
  // Slots: [GK, LB, CB, CB, RB, CDM, CM, CM, LW, ST, RW]
  // =========================================================================
  'hist-7172-ajax': {
    starters: buildSquad('hist-7172-ajax', '71-72 AFC 아약스', 'bundesliga', [
      {
        slug: 'stuy', name: '하인츠 스투이', pos: 'GK', main: ['GK'], ovr: 84,
        nat: '네덜란드', code: 'NL', sta: 80, styles: ['sweeper_keeper', 'shot_stopper'],
        note: '유러피언컵 3연패 골문을 지킨 토탈 풋볼의 스위퍼 골키퍼',
        f: [36, 76, 60, 58, 72, 74, 78], gk: [84, 83, 85, 84, 85],
      },
      {
        slug: 'krol', name: '뤼트 크롤', pos: 'DF', main: ['LB', 'CB'], sec: ['LWB'], ovr: 91,
        nat: '네덜란드', code: 'NL', sta: 93, styles: ['ball_playing_cb', 'attacking_wingback'],
        note: '수비와 공격을 자유롭게 오간 역대 최고급 스위핑 풀백',
        f: [74, 89, 88, 86, 84, 92, 90],
      },
      {
        slug: 'hulshoff', name: '바리 휠스호프', pos: 'DF', main: ['CB'], sec: ['CDM'], ovr: 88,
        nat: '네덜란드', code: 'NL', sta: 88, styles: ['ball_playing_cb', 'stopper_cb'],
        note: '공격 가담과 공중 장악을 겸비한 토탈 풋볼 센터백',
        f: [72, 82, 72, 76, 90, 90, 90],
      },
      {
        slug: 'blankenburg', name: '호르스트 블랑켄부르크', pos: 'DF', main: ['CB'], sec: ['CDM'], ovr: 87,
        nat: '독일', code: 'DE', sta: 87, styles: ['ball_playing_cb', 'stopper_cb'],
        note: '최후방 리베로 역할로 아약스 하이 라인의 균형을 잡은 지휘관',
        f: [64, 86, 74, 80, 85, 89, 86],
      },
      {
        slug: 'suurbier', name: '빔 쉬르비르', pos: 'DF', main: ['RB', 'RWB'], ovr: 87,
        nat: '네덜란드', code: 'NL', sta: 94, styles: ['attacking_wingback', 'box_to_box'],
        note: '끝없는 오버래핑과 측면 스위칭으로 우측을 지배한 철인 풀백',
        f: [70, 82, 86, 84, 76, 86, 92],
      },
      {
        slug: 'haan', name: '아리 한', pos: 'MF', main: ['CDM', 'CM'], sec: ['CB'], ovr: 88,
        nat: '네덜란드', code: 'NL', sta: 92, styles: ['deep_playmaker', 'box_to_box'],
        note: '강력한 중거리 슛과 수비·중원 멀티 스위칭의 핵심 축',
        f: [85, 87, 82, 82, 82, 87, 90],
      },
      {
        slug: 'neeskens', name: '요한 네스켄스', pos: 'MF', main: ['CM', 'CDM'], sec: ['RB'], ovr: 92,
        nat: '네덜란드', code: 'NL', sta: 96, styles: ['box_to_box', 'ball_winner'],
        note: '압박·태클·침투·득점을 모두 해낸 역대급 박스투박스 미드필더',
        f: [86, 89, 84, 88, 84, 90, 95],
      },
      {
        slug: 'g_muhren', name: '헤리 뮈런', pos: 'MF', main: ['CM', 'LM'], sec: ['CAM'], ovr: 86,
        nat: '네덜란드', code: 'NL', sta: 90, styles: ['deep_playmaker', 'box_to_box'],
        note: '유려한 패스 워크와 침착한 볼 키핑으로 중원 리듬을 조율한 테크니션',
        f: [79, 89, 85, 87, 74, 78, 84],
      },
      {
        slug: 'keizer', name: '피트 카이저', pos: 'FW', main: ['LW', 'LM'], sec: ['CAM'], ovr: 90,
        nat: '네덜란드', code: 'NL', sta: 87, styles: ['classic_winger', 'playmaker_10'],
        note: '정교한 왼발 크로스와 드리블로 크루이프와 환상의 호흡을 맞춘 주장',
        f: [86, 90, 93, 93, 72, 54, 84],
      },
      {
        slug: 'cruyff', name: '요한 크루이프', pos: 'FW', main: ['ST', 'CAM'], sec: ['LW', 'RW'], ovr: 96,
        nat: '네덜란드', code: 'NL', sta: 91, styles: ['complete_forward', 'playmaker_10'],
        note: '결승 인터 밀란전 멀티골·리그 25골·토탈 풋볼 그 자체인 혁명가',
        f: [94, 96, 90, 98, 78, 58, 90],
      },
      {
        slug: 'swart', name: '샤크 스바르트', pos: 'FW', main: ['RW', 'RM'], ovr: 86,
        nat: '네덜란드', code: 'NL', sta: 86, styles: ['classic_winger', 'line_breaker'],
        note: '미스터 아약스 · 우측 터치라인에서 결정적 크로스와 침투를 공급',
        f: [83, 85, 88, 89, 72, 56, 84],
      },
    ]),
    bench: buildSquad('hist-7172-ajax', '71-72 AFC 아약스', 'bundesliga', [
      {
        slug: 'wever', name: '시스 베버르', pos: 'GK', main: ['GK'], ovr: 76,
        nat: '네덜란드', code: 'NL', sta: 75, styles: ['shot_stopper'],
        note: '아약스 황금기를 뒷받침한 백업 골키퍼',
        f: [32, 66, 52, 50, 68, 68, 72], gk: [76, 76, 77, 72, 77],
      },
      {
        slug: 'schilcher', name: '하인츠 실허', pos: 'DF', main: ['CB', 'RB'], sec: ['CDM'], ovr: 78,
        nat: '오스트리아', code: 'AT', sta: 84, styles: ['stopper_cb'],
        note: '수비 전 지역을 커버한 성실한 멀티 수비수',
        f: [54, 74, 70, 70, 78, 81, 82],
      },
      {
        slug: 'suurendonk', name: '뤼트 쉬렌동크', pos: 'MF', main: ['CM', 'CDM'], sec: ['CB'], ovr: 79,
        nat: '네덜란드', code: 'NL', sta: 86, styles: ['box_to_box'],
        note: '12번째 사도로 불린 아약스 핵심 로테이션 멀티플레이어',
        f: [72, 79, 74, 77, 76, 79, 84],
      },
      {
        slug: 'a_muhren', name: '아르놀트 뮈런', pos: 'MF', main: ['CM', 'LM'], ovr: 82,
        nat: '네덜란드', code: 'NL', sta: 85, styles: ['deep_playmaker', 'playmaker_10'],
        note: '정교한 왼발 패스로 후반 중원 장악력을 높인 신예 플레이메이커',
        f: [76, 86, 86, 84, 68, 72, 78],
      },
      {
        slug: 'rep', name: '조니 레프', pos: 'FW', main: ['RW', 'ST'], ovr: 84,
        nat: '네덜란드', code: 'NL', sta: 88, styles: ['line_breaker', 'poacher'],
        note: '폭발적인 스피드와 득점 감각을 겸비한 차세대 우측 공격수',
        f: [86, 79, 82, 85, 82, 52, 88],
      },
      {
        slug: 'vandijk_d', name: '딕 판 데이크', pos: 'FW', main: ['ST'], ovr: 82,
        nat: '네덜란드', code: 'NL', sta: 83, styles: ['poacher'],
        note: '제공권과 문전 결정력으로 리그 16골을 터뜨린 정통 스트라이커',
        f: [85, 74, 68, 78, 88, 48, 84],
      },
    ]),
  },

  // =========================================================================
  // 16. 10-11 FC 바르셀로나 (4-3-3 · 점유율 · 펩 과르디올라 · 티키타카 완성체)
  // Slots: [GK, LB, CB, CB, RB, CDM, CM, CM, LW, ST, RW]
  // =========================================================================
  'hist-1011-barca': {
    starters: buildSquad('hist-1011-barca', '10-11 FC 바르셀로나', 'laliga', [
      {
        slug: 'valdes', name: '빅토르 발데스', pos: 'GK', main: ['GK'], ovr: 88,
        nat: '스페인', code: 'ES', sta: 82, styles: ['sweeper_keeper', 'shot_stopper'],
        note: '라리가 최소 실점(21실점) 사모라상 · 후방 빌드업의 시발점',
        f: [40, 85, 68, 66, 74, 80, 82], gk: [88, 86, 90, 89, 88],
      },
      {
        slug: 'abidal', name: '에릭 아비달', pos: 'DF', main: ['LB', 'CB'], ovr: 87,
        nat: '프랑스', code: 'FR', sta: 88, styles: ['stopper_cb', 'ball_playing_cb'],
        note: '투병을 딛고 웸블리 결승 선발로 빅이어를 들어 올린 철벽 레프트백',
        f: [62, 82, 80, 81, 84, 90, 89],
      },
      {
        slug: 'pique', name: '제라르 피케', pos: 'DF', main: ['CB'], ovr: 90,
        nat: '스페인', code: 'ES', sta: 86, styles: ['ball_playing_cb', 'stopper_cb'],
        note: '전진 패스와 제공권을 겸비한 펩 바르사 빌드업 수비의 핵',
        f: [66, 87, 72, 80, 92, 91, 87],
      },
      {
        slug: 'puyol', name: '카를레스 푸욜', pos: 'DF', main: ['CB'], sec: ['RB', 'LB'], ovr: 92,
        nat: '스페인', code: 'ES', sta: 90, styles: ['stopper_cb', 'ball_playing_cb'],
        note: '불굴의 투지와 대인 방어로 높은 수비 라인을 지휘한 위대한 주장',
        f: [60, 80, 72, 76, 92, 95, 92],
      },
      {
        slug: 'alves', name: '다니 알베스', pos: 'DF', main: ['RB', 'RWB'], ovr: 91,
        nat: '브라질', code: 'BR', sta: 95, styles: ['attacking_wingback', 'playmaker_10'],
        note: '리그 15도움 · 메시와 우측을 완전히 파괴한 역대 최고급 공격형 풀백',
        f: [80, 90, 93, 91, 72, 84, 91],
      },
      {
        slug: 'busquets', name: '세르히오 부스케츠', pos: 'MF', main: ['CDM'], sec: ['CM'], ovr: 91,
        nat: '스페인', code: 'ES', sta: 88, styles: ['deep_playmaker', 'ball_winner'],
        note: '원터치 탈압박과 공간 예측으로 티키타카의 척추가 된 앵커맨',
        f: [68, 94, 78, 89, 84, 91, 82],
      },
      {
        slug: 'xavi', name: '사비 에르난데스', pos: 'MF', main: ['CM'], sec: ['CDM', 'CAM'], ovr: 94,
        nat: '스페인', code: 'ES', sta: 91, styles: ['deep_playmaker', 'playmaker_10'],
        note: '발롱도르 3위 · 웸블리 결승 완벽 지배, 축구사 최고의 패스 마스터',
        f: [82, 99, 92, 95, 64, 78, 82],
      },
      {
        slug: 'iniesta', name: '안드레스 이니에스타', pos: 'MF', main: ['CM', 'CAM'], sec: ['LW'], ovr: 94,
        nat: '스페인', code: 'ES', sta: 88, styles: ['playmaker_10', 'inverted_winger'],
        note: '발롱도르 2위 · 좁은 공간을 찢는 탈압박과 환상적 전진 드리블',
        f: [84, 96, 88, 98, 60, 72, 80],
      },
      {
        slug: 'villa', name: '다비드 비야', pos: 'FW', main: ['LW', 'ST'], ovr: 90,
        nat: '스페인', code: 'ES', sta: 88, styles: ['inverted_winger', 'poacher'],
        note: '웸블리 결승 감아차기 쐐기골 · 좌측에서 침투하는 완벽한 양발 킬러',
        f: [93, 85, 84, 90, 74, 52, 85],
      },
      {
        slug: 'messi', name: '리오넬 메시', pos: 'FW', main: ['ST', 'RW'], sec: ['CAM'], ovr: 97,
        nat: '아르헨티나', code: 'AR', sta: 88, styles: ['complete_forward', 'playmaker_10'],
        note: '발롱도르 · 공식전 53골·UCL 12골 득점왕, 펄스 나인의 전설',
        f: [97, 96, 90, 99, 70, 44, 86],
      },
      {
        slug: 'pedro', name: '페드로 로드리게스', pos: 'FW', main: ['RW', 'LW'], ovr: 86,
        nat: '스페인', code: 'ES', sta: 92, styles: ['line_breaker', 'inverted_winger'],
        note: '웸블리 결승 선제골 · 양발 마무리와 전방 압박의 완벽한 조연',
        f: [86, 84, 84, 88, 66, 62, 87],
      },
    ]),
    bench: buildSquad('hist-1011-barca', '10-11 FC 바르셀로나', 'laliga', [
      {
        slug: 'pinto', name: '호세 마누엘 핀토', pos: 'GK', main: ['GK'], ovr: 78,
        nat: '스페인', code: 'ES', sta: 75, styles: ['shot_stopper'],
        note: '코파 델 레이 주전으로 나선 베테랑 백업 골키퍼',
        f: [32, 68, 54, 54, 70, 70, 74], gk: [78, 78, 80, 74, 78],
      },
      {
        slug: 'mascherano', name: '하비에르 마스체라노', pos: 'DF', main: ['CB', 'CDM'], ovr: 87,
        nat: '아르헨티나', code: 'AR', sta: 91, styles: ['ball_winner', 'stopper_cb'],
        note: '웸블리 결승 선발 센터백으로 완벽 변신한 투지의 수비 리더',
        f: [62, 83, 72, 78, 80, 91, 89],
      },
      {
        slug: 'adriano', name: '아드리아누', pos: 'DF', main: ['LB', 'RB'], sec: ['LWB'], ovr: 82,
        nat: '브라질', code: 'BR', sta: 86, styles: ['attacking_wingback'],
        note: '좌우 풀백과 윙어를 모두 소화한 양발 멀티 수비 자원',
        f: [76, 80, 83, 83, 70, 80, 84],
      },
      {
        slug: 'keita', name: '세이두 케이타', pos: 'MF', main: ['CM', 'CDM'], ovr: 83,
        nat: '말리', code: 'ML', sta: 90, styles: ['box_to_box', 'ball_winner'],
        note: '펩 과르디올라가 가장 신뢰한 중원 피지컬·압박 로테이션 카드',
        f: [76, 82, 74, 80, 84, 84, 88],
      },
      {
        slug: 'thiago', name: '티아고 알칸타라', pos: 'MF', main: ['CM', 'CAM'], ovr: 81,
        nat: '스페인', code: 'ES', sta: 82, styles: ['deep_playmaker', 'playmaker_10'],
        note: '라 마시아가 배출한 차세대 천재 미드필더',
        f: [74, 86, 80, 88, 66, 72, 76],
      },
      {
        slug: 'afellay', name: '이브라힘 아펠라이', pos: 'FW', main: ['LW', 'RW'], sec: ['CAM'], ovr: 81,
        nat: '네덜란드', code: 'NL', sta: 84, styles: ['classic_winger', 'line_breaker'],
        note: 'UCL 4강 레알전 메시 결승골 어시스트를 기록한 조커 윙어',
        f: [78, 80, 82, 86, 64, 52, 84],
      },
    ]),
  },

  // =========================================================================
  // 17. 16-17 레알 마드리드 (4-4-2 다이아몬드 · 균형 · 지네딘 지단 · 라리가+UCL 더블)
  // Slots: [GK, LB, CB, CB, RB, CDM, LCM, RCM, CAM, ST, ST]
  // =========================================================================
  'hist-1617-realmadrid': {
    starters: buildSquad('hist-1617-realmadrid', '16-17 레알 마드리드', 'laliga', [
      {
        slug: 'navas', name: '케일러 나바스', pos: 'GK', main: ['GK'], ovr: 88,
        nat: '코스타리카', code: 'CR', sta: 82, styles: ['shot_stopper'],
        note: '동물적인 반사신경으로 UCL 2연패 골문을 지킨 수호신',
        f: [36, 76, 62, 60, 74, 78, 82], gk: [90, 85, 93, 80, 88],
      },
      {
        slug: 'marcelo', name: '마르셀루', pos: 'DF', main: ['LB', 'LWB'], ovr: 91,
        nat: '브라질', code: 'BR', sta: 90, styles: ['attacking_wingback', 'playmaker_10'],
        note: '윙어급 기술과 크로스로 좌측 공격을 전담한 월드클래스 레프트백',
        f: [78, 89, 93, 94, 70, 82, 86],
      },
      {
        slug: 'ramos', name: '세르히오 라모스', pos: 'DF', main: ['CB'], sec: ['RB'], ovr: 92,
        nat: '스페인', code: 'ES', sta: 90, styles: ['stopper_cb', 'ball_playing_cb'],
        note: '엘 클라시코·데포르티보전 극장 헤더와 압도적 리더십의 캡틴',
        f: [74, 84, 76, 80, 96, 94, 91],
      },
      {
        slug: 'varane', name: '라파엘 바란', pos: 'DF', main: ['CB'], ovr: 88,
        nat: '프랑스', code: 'FR', sta: 88, styles: ['stopper_cb', 'ball_playing_cb'],
        note: '압도적 스피드와 공중전으로 라모스의 뒷공간을 완벽 커버',
        f: [58, 80, 68, 76, 90, 90, 91],
      },
      {
        slug: 'carvajal', name: '다니 카르바할', pos: 'DF', main: ['RB', 'RWB'], ovr: 88,
        nat: '스페인', code: 'ES', sta: 93, styles: ['attacking_wingback', 'ball_winner'],
        note: '카디프 결승 어시스트 · 공수 밸런스 최상급의 우측 수비수',
        f: [70, 84, 88, 84, 74, 87, 90],
      },
      {
        slug: 'casemiro', name: '카세미루', pos: 'MF', main: ['CDM'], ovr: 89,
        nat: '브라질', code: 'BR', sta: 92, styles: ['ball_winner', 'stopper_cb'],
        note: '카디프 결승 중거리 역전골 · 크카모 중원의 철벽 방패',
        f: [78, 82, 74, 78, 88, 93, 92],
      },
      {
        slug: 'kroos', name: '토니 크로스', pos: 'MF', main: ['CM'], sec: ['CDM'], ovr: 92,
        nat: '독일', code: 'DE', sta: 88, styles: ['deep_playmaker'],
        note: '93%대 패스 성공률과 날카로운 전환 롱패스의 정밀한 메트로놈',
        f: [84, 97, 94, 88, 70, 80, 80],
      },
      {
        slug: 'modric', name: '루카 모드리치', pos: 'MF', main: ['CM'], sec: ['CAM', 'CDM'], ovr: 93,
        nat: '크로아티아', code: 'HR', sta: 92, styles: ['deep_playmaker', 'box_to_box'],
        note: '카디프 결승 중원 완전 장악 · 아웃프런트 패스와 탈압박의 마에스트로',
        f: [82, 96, 91, 95, 66, 82, 85],
      },
      {
        slug: 'isco', name: '이스코', pos: 'MF', main: ['CAM', 'CM'], sec: ['LW'], ovr: 89,
        nat: '스페인', code: 'ES', sta: 87, styles: ['playmaker_10', 'inverted_winger'],
        note: '지단 4-4-2 다이아몬드의 열쇠 · 하반기 환상적 폼과 결승전 선발 활약',
        f: [84, 90, 85, 95, 62, 66, 80],
      },
      {
        slug: 'benzema', name: '카림 벤제마', pos: 'FW', main: ['ST'], sec: ['CAM'], ovr: 89,
        nat: '프랑스', code: 'FR', sta: 86, styles: ['complete_forward', 'playmaker_10'],
        note: '아틀레티코전 칼데론 마법 드리블 · 호날두를 완벽 보좌한 연계형 9번',
        f: [89, 89, 80, 91, 84, 48, 85],
      },
      {
        slug: 'ronaldo', name: '크리스티아누 호날두', pos: 'FW', main: ['ST', 'LW'], ovr: 96,
        nat: '포르투갈', code: 'PT', sta: 90, styles: ['complete_forward', 'poacher'],
        note: '발롱도르 · UCL 8강~결승 10골 폭격(바이에른·AT·유베전 클러치 지배)',
        f: [98, 86, 86, 92, 96, 44, 93],
      },
    ]),
    bench: buildSquad('hist-1617-realmadrid', '16-17 레알 마드리드', 'laliga', [
      {
        slug: 'casilla', name: '키코 카시야', pos: 'GK', main: ['GK'], ovr: 79,
        nat: '스페인', code: 'ES', sta: 76, styles: ['shot_stopper'],
        note: '시즌 로테이션을 안정적으로 소화한 백업 골키퍼',
        f: [34, 70, 56, 54, 74, 72, 78], gk: [79, 78, 81, 76, 79],
      },
      {
        slug: 'pepe', name: '페페', pos: 'DF', main: ['CB'], ovr: 87,
        nat: '포르투갈', code: 'PT', sta: 84, styles: ['stopper_cb'],
        note: '압도적 대인 수비와 투지로 후방을 지킨 베테랑 센터백',
        f: [58, 76, 66, 72, 90, 91, 89],
      },
      {
        slug: 'nacho', name: '나초 페르난데스', pos: 'DF', main: ['CB', 'RB', 'LB'], ovr: 83,
        nat: '스페인', code: 'ES', sta: 88, styles: ['stopper_cb'],
        note: '수비 전 포지션을 빈틈없이 메운 역대급 원클럽 멀티 수비수',
        f: [62, 78, 76, 76, 82, 86, 86],
      },
      {
        slug: 'kovacic', name: '마테오 코바치치', pos: 'MF', main: ['CM', 'CDM'], ovr: 84,
        nat: '크로아티아', code: 'HR', sta: 88, styles: ['box_to_box', 'deep_playmaker'],
        note: '폭발적 전진 드리블로 B팀 중원을 이끈 크로아티아 미드필더',
        f: [74, 85, 76, 90, 68, 80, 84],
      },
      {
        slug: 'bale', name: '가레스 베일', pos: 'FW', main: ['RW', 'LW'], sec: ['ST'], ovr: 89,
        nat: '웨일스', code: 'GB-WLS', sta: 85, styles: ['inverted_winger', 'line_breaker'],
        note: '고향 카디프 결승 무대에 선 폭발적 왼발·스피드 슈퍼스타',
        f: [90, 84, 88, 88, 88, 58, 94],
      },
      {
        slug: 'morata', name: '알바로 모라타', pos: 'FW', main: ['ST'], ovr: 84,
        nat: '스페인', code: 'ES', sta: 86, styles: ['poacher', 'line_breaker'],
        note: '라리가 15골·공식전 20골로 역대급 B팀 우승을 견인한 특급 조커',
        f: [86, 76, 72, 82, 88, 48, 86],
      },
    ]),
  },

  // =========================================================================
  // 18. 24-25 파리 생제르맹 (4-3-3 · 게겐프레싱 · 루이스 엔리케 · 프랑스 최초 트레블)
  // Slots: [GK, LB, CB, CB, RB, CDM, CM, CM, LW, ST, RW]
  // =========================================================================
  'hist-2425-psg': {
    starters: buildSquad('hist-2425-psg', '24-25 파리 생제르맹', 'ligue1', [
      {
        slug: 'donnarumma', name: '잔루이지 돈나룸마', pos: 'GK', main: ['GK'], ovr: 91,
        nat: '이탈리아', code: 'IT', sta: 83, styles: ['shot_stopper'],
        note: '리버풀·아스널·인테르전 토너먼트 철벽 선방으로 빅이어 견인',
        f: [36, 75, 62, 60, 80, 82, 86], gk: [93, 89, 95, 78, 91],
      },
      {
        slug: 'nuno_mendes', name: '누누 멘데스', pos: 'DF', main: ['LB', 'LWB'], ovr: 89,
        nat: '포르투갈', code: 'PT', sta: 94, styles: ['attacking_wingback', 'line_breaker'],
        note: '살라·사카를 봉쇄하고 공격까지 폭발시킨 유럽 최고 레프트백',
        f: [76, 84, 88, 89, 76, 87, 94],
      },
      {
        slug: 'pacho', name: '윌리안 파초', pos: 'DF', main: ['CB'], ovr: 87,
        nat: '에콰도르', code: 'EC', sta: 90, styles: ['stopper_cb', 'ball_playing_cb'],
        note: '데뷔 시즌 곧바로 하이 라인 뒷공간을 완벽히 지배한 왼발 센터백',
        f: [54, 82, 70, 76, 88, 90, 91],
      },
      {
        slug: 'marquinhos', name: '마르키뉴스', pos: 'DF', main: ['CB'], sec: ['CDM'], ovr: 89,
        nat: '브라질', code: 'BR', sta: 89, styles: ['ball_playing_cb', 'stopper_cb'],
        note: '파리 최초 트레블 빅이어를 들어 올린 베테랑 캡틴 센터백',
        f: [62, 86, 74, 80, 88, 92, 88],
      },
      {
        slug: 'hakimi', name: '아슈라프 하키미', pos: 'DF', main: ['RB', 'RWB'], ovr: 91,
        nat: '모로코', code: 'MA', sta: 96, styles: ['attacking_wingback', 'line_breaker'],
        note: 'UCL 결승 선제골 포함 공수 전역 폭발 · 세계 최고 라이트백',
        f: [82, 87, 90, 90, 76, 85, 96],
      },
      {
        slug: 'vitinha', name: '비티냐', pos: 'MF', main: ['CDM', 'CM'], ovr: 91,
        nat: '포르투갈', code: 'PT', sta: 92, styles: ['deep_playmaker', 'playmaker_10'],
        note: '엔리케 PSG의 두뇌 · 압박 속 완벽한 템포 조절과 전진 패스',
        f: [82, 95, 86, 94, 62, 82, 82],
      },
      {
        slug: 'joao_neves', name: '주앙 네베스', pos: 'MF', main: ['CM', 'CDM'], ovr: 89,
        nat: '포르투갈', code: 'PT', sta: 96, styles: ['box_to_box', 'ball_winner'],
        note: '미친 활동량과 탈압박·태클로 중원을 집어삼킨 20세 압박 엔진',
        f: [76, 89, 80, 90, 74, 89, 92],
      },
      {
        slug: 'fabian_ruiz', name: '파비안 루이스', pos: 'MF', main: ['CM'], sec: ['CDM', 'CAM'], ovr: 88,
        nat: '스페인', code: 'ES', sta: 90, styles: ['box_to_box', 'deep_playmaker'],
        note: '아스널전 중거리 결승골 · 유려한 왼발과 박스 침투의 중원 핵심',
        f: [84, 90, 83, 88, 82, 82, 85],
      },
      {
        slug: 'kvaratskhelia', name: '흐비차 크바라츠헬리아', pos: 'FW', main: ['LW'], sec: ['RW', 'CAM'], ovr: 90,
        nat: '조지아', code: 'GE', sta: 90, styles: ['inverted_winger', 'line_breaker'],
        note: '겨울 합류 후 트레블 퍼즐 완성 · UCL 결승 득점 & 압박 헌신',
        f: [88, 87, 88, 95, 72, 64, 88],
      },
      {
        slug: 'dembele', name: '우스만 뎀벨레', pos: 'FW', main: ['ST', 'RW'], sec: ['LW'], ovr: 93,
        nat: '프랑스', code: 'FR', sta: 89, styles: ['complete_forward', 'inverted_winger'],
        note: '2025 발롱도르 · 공식전 35골·리그1 득점왕·UCL 시즌 최우수 선수',
        f: [92, 90, 90, 96, 66, 56, 90],
      },
      {
        slug: 'doue', name: '데지레 두에', pos: 'FW', main: ['RW', 'LW'], sec: ['CAM'], ovr: 88,
        nat: '프랑스', code: 'FR', sta: 89, styles: ['inverted_winger', 'playmaker_10'],
        note: 'UCL 결승 인테르전 2골 1도움 MOM · 19세에 세계를 정복한 신성',
        f: [87, 86, 85, 94, 68, 60, 87],
      },
    ]),
    bench: buildSquad('hist-2425-psg', '24-25 파리 생제르맹', 'ligue1', [
      {
        slug: 'safonov', name: '마트베이 사포노프', pos: 'GK', main: ['GK'], ovr: 81,
        nat: '러시아', code: 'RU', sta: 78, styles: ['shot_stopper'],
        note: '쿠프 드 프랑스 우승 여정을 책임진 든든한 백업 골키퍼',
        f: [34, 72, 58, 56, 74, 74, 78], gk: [82, 80, 83, 76, 81],
      },
      {
        slug: 'l_hernandez', name: '뤼카 에르난데스', pos: 'DF', main: ['LB', 'CB'], ovr: 83,
        nat: '프랑스', code: 'FR', sta: 85, styles: ['stopper_cb'],
        note: '부상 복귀 후 수비 라인 로테이션을 지킨 투지의 멀티 수비수',
        f: [62, 78, 78, 78, 82, 86, 86],
      },
      {
        slug: 'zaire_emery', name: '워렌 자이르에머리', pos: 'MF', main: ['CM', 'CDM'], ovr: 84,
        nat: '프랑스', code: 'FR', sta: 92, styles: ['box_to_box', 'ball_winner'],
        note: '강인한 추진력과 전진 드리블을 갖춘 파리 유스 중원 핵심',
        f: [76, 84, 78, 85, 76, 83, 89],
      },
      {
        slug: 'lee_kangin', name: '이강인', pos: 'MF', main: ['CAM', 'RW', 'CM'], ovr: 83,
        nat: '대한민국', code: 'KR', sta: 84, styles: ['playmaker_10', 'deep_playmaker'],
        note: '정교한 왼발 킥과 탈압박으로 리그1 트레블 로테이션에 기여',
        f: [80, 88, 89, 89, 60, 62, 78],
      },
      {
        slug: 'barcola', name: '브래들리 바르콜라', pos: 'FW', main: ['LW', 'RW'], ovr: 87,
        nat: '프랑스', code: 'FR', sta: 91, styles: ['classic_winger', 'line_breaker'],
        note: '리그1 14골 10도움 · 폭발적 스피드로 시즌 전반기를 견인한 윙어',
        f: [85, 84, 86, 92, 68, 56, 91],
      },
      {
        slug: 'goncalo_ramos', name: '곤살루 하무스', pos: 'FW', main: ['ST'], ovr: 83,
        nat: '포르투갈', code: 'PT', sta: 87, styles: ['poacher'],
        note: '짧은 출전 시간에도 높은 득점 효율을 보인 박스 내 킬러',
        f: [86, 75, 70, 80, 85, 54, 84],
      },
    ]),
  },

  // =========================================================================
  // 19. 88-89 AC 밀란 (4-4-2 · 게겐프레싱 · 아리고 사키 · 불멸의 밀란)
  // Slots: [GK, LB, CB, CB, RB, LM, CM, CM, RM, ST, ST]
  // =========================================================================
  'hist-8889-milan': {
    starters: buildSquad('hist-8889-milan', '88-89 AC 밀란', 'seriea', [
      {
        slug: 'g_galli', name: '조반니 갈리', pos: 'GK', main: ['GK'], ovr: 85,
        nat: '이탈리아', code: 'IT', sta: 80, styles: ['shot_stopper', 'sweeper_keeper'],
        note: '사키 하이 라인의 최후방을 침착하게 지킨 노련한 골키퍼',
        f: [34, 74, 58, 56, 74, 76, 80], gk: [85, 86, 85, 80, 88],
      },
      {
        slug: 'maldini', name: '파올로 말디니', pos: 'DF', main: ['LB', 'CB'], ovr: 93,
        nat: '이탈리아', code: 'IT', sta: 93, styles: ['stopper_cb', 'attacking_wingback'],
        note: '20세의 나이에 세계 최정상 수비력을 보여준 역사상 최고 레프트백',
        f: [68, 86, 87, 86, 88, 96, 92],
      },
      {
        slug: 'baresi', name: '프랑코 바레시', pos: 'DF', main: ['CB'], ovr: 95,
        nat: '이탈리아', code: 'IT', sta: 91, styles: ['ball_playing_cb', 'stopper_cb'],
        note: '오프사이드 트랩과 존 프레싱의 절대 지휘관 · 불멸의 캡틴 6번',
        f: [66, 91, 78, 85, 90, 98, 91],
      },
      {
        slug: 'costacurta', name: '알레산드로 코스타쿠르타', pos: 'DF', main: ['CB'], sec: ['RB'], ovr: 89,
        nat: '이탈리아', code: 'IT', sta: 89, styles: ['stopper_cb', 'ball_playing_cb'],
        note: '바레시와 완벽한 라인 컨트롤을 맞춘 지능형 수비수',
        f: [58, 82, 72, 78, 87, 92, 88],
      },
      {
        slug: 'tassotti', name: '마우로 타소티', pos: 'DF', main: ['RB'], sec: ['CB'], ovr: 88,
        nat: '이탈리아', code: 'IT', sta: 90, styles: ['attacking_wingback', 'stopper_cb'],
        note: '우측 수비 안정과 정교한 오버래핑으로 밀란 4백을 완성한 주축',
        f: [66, 84, 86, 82, 78, 90, 88],
      },
      {
        slug: 'evani', name: '알베리고 에바니', pos: 'MF', main: ['LM', 'CM'], sec: ['LB'], ovr: 85,
        nat: '이탈리아', code: 'IT', sta: 91, styles: ['classic_winger', 'box_to_box'],
        note: '왕성한 활동량과 날카로운 왼발 킥으로 좌측 압박을 수행',
        f: [78, 86, 88, 85, 68, 78, 86],
      },
      {
        slug: 'rijkaard', name: '프랑크 레이카르트', pos: 'MF', main: ['CM', 'CDM'], sec: ['CB'], ovr: 93,
        nat: '네덜란드', code: 'NL', sta: 94, styles: ['ball_winner', 'box_to_box'],
        note: '오렌지 삼총사의 중원 척추 · 압도적 피지컬과 패스의 완성형 홀딩',
        f: [82, 91, 80, 87, 92, 94, 95],
      },
      {
        slug: 'ancelotti', name: '카를로 안첼로티', pos: 'MF', main: ['CM', 'CDM'], ovr: 89,
        nat: '이탈리아', code: 'IT', sta: 88, styles: ['deep_playmaker', 'box_to_box'],
        note: '4강 레알전 5-0 대승 선제 대포알 중거리골 · 사키의 필드 위 감독',
        f: [83, 92, 84, 85, 80, 86, 86],
      },
      {
        slug: 'donadoni', name: '로베르토 도나도니', pos: 'MF', main: ['RM', 'RW'], sec: ['LM'], ovr: 89,
        nat: '이탈리아', code: 'IT', sta: 91, styles: ['classic_winger', 'playmaker_10'],
        note: '현란한 드리블과 크로스로 우측을 지배한 이탈리아 최고 윙어',
        f: [82, 89, 91, 93, 66, 68, 86],
      },
      {
        slug: 'gullit', name: '루드 굴리트', pos: 'FW', main: ['ST', 'CAM'], sec: ['RW', 'CM'], ovr: 94,
        nat: '네덜란드', code: 'NL', sta: 94, styles: ['complete_forward', 'box_to_box'],
        note: '결승 슈테아우아전 멀티골 · 피지컬·스피드·기술을 모두 갖춘 괴물',
        f: [92, 91, 87, 93, 93, 76, 97],
      },
      {
        slug: 'van_basten', name: '마르코 판 바스턴', pos: 'FW', main: ['ST'], ovr: 95,
        nat: '네덜란드', code: 'NL', sta: 88, styles: ['complete_forward', 'poacher'],
        note: '1988·1989 발롱도르 연속 수상 · 공식전 33골·결승전 멀티골의 백조',
        f: [98, 87, 82, 92, 95, 48, 90],
      },
    ]),
    bench: buildSquad('hist-8889-milan', '88-89 AC 밀란', 'seriea', [
      {
        slug: 'pinato', name: '다비데 피나토', pos: 'GK', main: ['GK'], ovr: 76,
        nat: '이탈리아', code: 'IT', sta: 74, styles: ['shot_stopper'],
        note: '밀란의 든든한 세컨드 골키퍼',
        f: [30, 64, 52, 50, 70, 68, 72], gk: [76, 76, 77, 70, 77],
      },
      {
        slug: 'f_galli', name: '필리포 갈리', pos: 'DF', main: ['CB'], ovr: 83,
        nat: '이탈리아', code: 'IT', sta: 85, styles: ['stopper_cb'],
        note: '밀란 철벽 수비 로테이션의 핵심 센터백',
        f: [52, 74, 64, 68, 86, 86, 85],
      },
      {
        slug: 'mussi', name: '로베르토 무시', pos: 'DF', main: ['RB', 'LB'], ovr: 80,
        nat: '이탈리아', code: 'IT', sta: 86, styles: ['attacking_wingback'],
        note: '양 측면 풀백을 탄탄하게 메운 수비 백업',
        f: [60, 75, 78, 76, 74, 82, 84],
      },
      {
        slug: 'colombo', name: '안젤로 콜롬보', pos: 'MF', main: ['CM', 'RM'], ovr: 83,
        nat: '이탈리아', code: 'IT', sta: 93, styles: ['box_to_box', 'ball_winner'],
        note: '결승전 선발 출전 · 사키식 4-4-2 압박의 엔진을 담당한 언성 히어로',
        f: [74, 81, 80, 80, 76, 83, 90],
      },
      {
        slug: 'virdis', name: '피에트로 파올로 비르디스', pos: 'FW', main: ['ST'], ovr: 84,
        nat: '이탈리아', code: 'IT', sta: 84, styles: ['poacher'],
        note: '세리에A 10골로 오렌지 듀오와 공격을 분담한 노련한 골잡이',
        f: [87, 76, 72, 81, 86, 48, 84],
      },
      {
        slug: 'massaro', name: '다니엘레 마사로', pos: 'FW', main: ['ST', 'LW'], ovr: 82,
        nat: '이탈리아', code: 'IT', sta: 87, styles: ['line_breaker', 'poacher'],
        note: '투지 넘치는 전방 압박과 문전 침투의 핵심 조커',
        f: [84, 76, 74, 80, 82, 56, 86],
      },
    ]),
  },

  // =========================================================================
  // 20. 07-08 맨체스터 유나이티드 (4-3-3 · 역습 · 알렉스 퍼거슨 · EPL+UCL 더블)
  // Slots: [GK, LB, CB, CB, RB, CDM, CM, CM, LW, ST, RW]
  // =========================================================================
  'hist-0708-manutd': {
    starters: buildSquad('hist-0708-manutd', '07-08 맨체스터 유나이티드', 'epl', [
      {
        slug: 'vandersar', name: '에드윈 판 데르 사르', pos: 'GK', main: ['GK'], ovr: 90,
        nat: '네덜란드', code: 'NL', sta: 82, styles: ['shot_stopper', 'sweeper_keeper'],
        note: '모스크바 결승 승부차기 아넬카 킥 선방 · EPL 최소 실점(22실점)',
        f: [36, 84, 66, 62, 82, 82, 84], gk: [90, 91, 91, 87, 94],
      },
      {
        slug: 'evra', name: '파트리스 에브라', pos: 'DF', main: ['LB', 'LWB'], ovr: 88,
        nat: '프랑스', code: 'FR', sta: 93, styles: ['attacking_wingback'],
        note: '폭발적 오버래핑과 호날두 배후 커버를 완벽 수행한 정상급 레프트백',
        f: [68, 82, 86, 86, 78, 87, 91],
      },
      {
        slug: 'vidic', name: '네마냐 비디치', pos: 'DF', main: ['CB'], ovr: 91,
        nat: '세르비아', code: 'RS', sta: 90, styles: ['stopper_cb'],
        note: '몸을 아끼지 않는 태클과 압도적 제공권의 최강 파이터 센터백',
        f: [62, 76, 66, 72, 95, 94, 94],
      },
      {
        slug: 'ferdinand', name: '리오 퍼디난드', pos: 'DF', main: ['CB'], ovr: 92,
        nat: '잉글랜드', code: 'GB-ENG', sta: 89, styles: ['ball_playing_cb', 'stopper_cb'],
        note: '스피드·빌드업·수비 지능이 절정에 달했던 역대급 우아한 센터백',
        f: [62, 86, 72, 82, 91, 94, 92],
      },
      {
        slug: 'brown', name: '웨스 브라운', pos: 'DF', main: ['RB', 'CB'], ovr: 83,
        nat: '잉글랜드', code: 'GB-ENG', sta: 88, styles: ['stopper_cb'],
        note: '모스크바 결승 호날두 선제 헤더를 도운 견고한 우측 풀백',
        f: [58, 76, 81, 74, 84, 86, 86],
      },
      {
        slug: 'carrick', name: '마이클 캐릭', pos: 'MF', main: ['CDM', 'CM'], ovr: 87,
        nat: '잉글랜드', code: 'GB-ENG', sta: 88, styles: ['deep_playmaker'],
        note: '조용히 중원 패스 길목을 차단하고 역습 기점을 연 딥라잉 마에스트로',
        f: [76, 90, 84, 83, 80, 86, 83],
      },
      {
        slug: 'scholes', name: '폴 스콜스', pos: 'MF', main: ['CM'], sec: ['CDM', 'CAM'], ovr: 91,
        nat: '잉글랜드', code: 'GB-ENG', sta: 86, styles: ['deep_playmaker', 'playmaker_10'],
        note: 'UCL 4강 바르사전 환상적 중거리 결승골 · 시야와 롱패스의 천재',
        f: [89, 96, 90, 88, 72, 78, 82],
      },
      {
        slug: 'hargreaves', name: '오언 하그리브스', pos: 'MF', main: ['CM', 'CDM'], sec: ['RM', 'RB'], ovr: 85,
        nat: '잉글랜드', code: 'GB-ENG', sta: 93, styles: ['ball_winner', 'box_to_box'],
        note: '아스널전 프리킥 결승골 · 왕성한 기동력과 수비 커버의 핵심 엔진',
        f: [78, 83, 86, 81, 76, 87, 90],
      },
      {
        slug: 'ronaldo', name: '크리스티아누 호날두', pos: 'FW', main: ['LW', 'RW', 'ST'], ovr: 95,
        nat: '포르투갈', code: 'PT', sta: 93, styles: ['complete_forward', 'inverted_winger'],
        note: '2008 발롱도르 · 공식전 42골·EPL 31골·UCL 8골 득점왕의 괴물 시즌',
        f: [96, 87, 89, 96, 93, 46, 95],
      },
      {
        slug: 'tevez', name: '카를로스 테베스', pos: 'FW', main: ['ST'], sec: ['CAM'], ovr: 88,
        nat: '아르헨티나', code: 'AR', sta: 94, styles: ['complete_forward', 'line_breaker'],
        note: '공식전 19골 · 지치지 않는 압박과 연계로 황금 삼각편대를 완성',
        f: [89, 85, 80, 90, 76, 62, 91],
      },
      {
        slug: 'rooney', name: '웨인 루니', pos: 'FW', main: ['RW', 'ST'], sec: ['LW', 'CAM'], ovr: 91,
        nat: '잉글랜드', code: 'GB-ENG', sta: 94, styles: ['complete_forward', 'box_to_box'],
        note: '공격 전 지역을 스위칭하며 18골 14도움을 올린 퍼거슨 축구의 심장',
        f: [91, 89, 86, 89, 84, 68, 93],
      },
    ]),
    bench: buildSquad('hist-0708-manutd', '07-08 맨체스터 유나이티드', 'epl', [
      {
        slug: 'kuszczak', name: '토마시 쿠슈차크', pos: 'GK', main: ['GK'], ovr: 78,
        nat: '폴란드', code: 'PL', sta: 75, styles: ['shot_stopper'],
        note: '리그 9경기 출전으로 우승에 기여한 백업 골키퍼',
        f: [32, 66, 54, 52, 74, 72, 76], gk: [79, 77, 81, 72, 78],
      },
      {
        slug: 'oshea', name: '존 오셰이', pos: 'DF', main: ['RB', 'LB', 'CB'], sec: ['CDM'], ovr: 80,
        nat: '아일랜드', code: 'IE', sta: 86, styles: ['stopper_cb'],
        note: '수비와 미드필드 전 포지션을 소화한 퍼거슨의 만능 땜빵',
        f: [62, 76, 75, 74, 82, 83, 84],
      },
      {
        slug: 'anderson', name: '안데르송', pos: 'MF', main: ['CM', 'CAM'], ovr: 82,
        nat: '브라질', code: 'BR', sta: 89, styles: ['box_to_box'],
        note: '에너지 넘치는 전진 드리블과 결승전 PK 성공으로 빛난 젊은 미들',
        f: [74, 82, 76, 86, 70, 78, 86],
      },
      {
        slug: 'park', name: '박지성', pos: 'MF', main: ['LM', 'RM', 'CM'], sec: ['LW'], ovr: 84,
        nat: '대한민국', code: 'KR', sta: 97, styles: ['box_to_box', 'ball_winner'],
        note: 'UCL 8강 로마·4강 바르사전 맹활약으로 결승행을 견인한 산소탱크',
        f: [78, 83, 82, 84, 74, 83, 93],
      },
      {
        slug: 'giggs', name: '라이언 긱스', pos: 'FW', main: ['LW', 'LM'], sec: ['CM'], ovr: 86,
        nat: '웨일스', code: 'GB-WLS', sta: 85, styles: ['classic_winger', 'playmaker_10'],
        note: '최종전 우승 쐐기골 & 구단 역대 최다 출전·결승 PK 성공의 전설',
        f: [83, 88, 90, 90, 68, 62, 82],
      },
      {
        slug: 'nani', name: '나니', pos: 'FW', main: ['RW', 'LW'], ovr: 83,
        nat: '포르투갈', code: 'PT', sta: 86, styles: ['inverted_winger', 'classic_winger'],
        note: '화려한 양발 드리블과 모스크바 승부차기 5번 키커 강심장',
        f: [82, 81, 85, 90, 68, 50, 84],
      },
    ]),
  },

  // =========================================================================
  // 21. 19-20 리버풀 (4-3-3 · 게겐프레싱 · 위르겐 클롭 · 30년 만의 EPL 승점 99 우승)
  // Slots: [GK, LB, CB, CB, RB, CDM, CM, CM, LW, ST, RW]
  // =========================================================================
  'hist-1920-liverpool': {
    starters: buildSquad('hist-1920-liverpool', '19-20 리버풀', 'epl', [
      {
        slug: 'alisson', name: '알리송 베케르', pos: 'GK', main: ['GK'], ovr: 91,
        nat: '브라질', code: 'BR', sta: 83, styles: ['sweeper_keeper', 'shot_stopper'],
        note: '1대1 선방과 정확한 롱킥으로 리버풀 수비를 완성한 월드클래스 GK',
        f: [40, 86, 70, 66, 80, 82, 85], gk: [91, 90, 93, 90, 93],
      },
      {
        slug: 'robertson', name: '앤드류 로버트슨', pos: 'DF', main: ['LB', 'LWB'], ovr: 89,
        nat: '스코틀랜드', code: 'GB-SCT', sta: 96, styles: ['attacking_wingback'],
        note: 'EPL 12도움 · 지치지 않는 오버래핑과 면도날 왼발 크로스의 철인',
        f: [68, 85, 93, 84, 72, 86, 93],
      },
      {
        slug: 'vandijk', name: '버질 판 다이크', pos: 'DF', main: ['CB'], ovr: 93,
        nat: '네덜란드', code: 'NL', sta: 91, styles: ['ball_playing_cb', 'stopper_cb'],
        note: 'EPL 38경기 풀타임 · 대인 수비·공중볼·롱패스 모두 압도적인 벽',
        f: [68, 88, 76, 80, 96, 95, 95],
      },
      {
        slug: 'gomez', name: '조 고메스', pos: 'DF', main: ['CB'], sec: ['RB'], ovr: 84,
        nat: '잉글랜드', code: 'GB-ENG', sta: 88, styles: ['ball_playing_cb', 'stopper_cb'],
        note: '폭발적 회복 스피드로 판 다이크 옆에서 높은 수비 라인을 지탱',
        f: [52, 80, 72, 76, 82, 86, 90],
      },
      {
        slug: 'trent', name: '트렌트 알렉산더아놀드', pos: 'DF', main: ['RB', 'RWB'], ovr: 90,
        nat: '잉글랜드', code: 'GB-ENG', sta: 90, styles: ['attacking_wingback', 'deep_playmaker'],
        note: 'EPL 4골 13도움 · 측면에서 경기를 조율한 역대급 플레이메이킹 풀백',
        f: [82, 94, 97, 86, 68, 79, 84],
      },
      {
        slug: 'fabinho', name: '파비뉴', pos: 'MF', main: ['CDM'], sec: ['CB'], ovr: 89,
        nat: '브라질', code: 'BR', sta: 91, styles: ['ball_winner', 'deep_playmaker'],
        note: '등대 같은 긴 다리 태클과 맨시티전 중거리포 · 중원의 등불',
        f: [78, 86, 78, 82, 86, 92, 91],
      },
      {
        slug: 'henderson', name: '조던 헨더슨', pos: 'MF', main: ['CM', 'CDM'], ovr: 88,
        nat: '잉글랜드', code: 'GB-ENG', sta: 95, styles: ['box_to_box', 'deep_playmaker'],
        note: 'FWA 올해의 선수 · 30년 만의 리그 트로피를 들어 올린 위대한 주장',
        f: [78, 89, 87, 82, 80, 86, 92],
      },
      {
        slug: 'wijnaldum', name: '조르지니오 바이날둠', pos: 'MF', main: ['CM'], sec: ['CDM', 'CAM'], ovr: 86,
        nat: '네덜란드', code: 'NL', sta: 94, styles: ['box_to_box', 'ball_winner'],
        note: '극강의 탈압박과 볼 키핑으로 중원 밸런스를 유지한 철강왕',
        f: [78, 86, 78, 88, 82, 84, 91],
      },
      {
        slug: 'mane', name: '사디오 마네', pos: 'FW', main: ['LW'], sec: ['RW', 'ST'], ovr: 91,
        nat: '세네갈', code: 'SN', sta: 93, styles: ['inverted_winger', 'line_breaker'],
        note: 'EPL 18골 7도움 · 폭발적 침투와 압박, 클러치 득점의 화신',
        f: [91, 84, 84, 92, 84, 62, 93],
      },
      {
        slug: 'firmino', name: '호베르투 피르미누', pos: 'FW', main: ['ST'], sec: ['CAM'], ovr: 88,
        nat: '브라질', code: 'BR', sta: 92, styles: ['complete_forward', 'playmaker_10'],
        note: '전방 압박의 시발점이자 살라·마네의 공간을 열어준 최고의 펄스 나인',
        f: [85, 89, 80, 91, 80, 70, 86],
      },
      {
        slug: 'salah', name: '모하메드 살라', pos: 'FW', main: ['RW'], sec: ['ST'], ovr: 92,
        nat: '이집트', code: 'EG', sta: 92, styles: ['inverted_winger', 'line_breaker'],
        note: 'EPL 19골 10도움 팀 최다 득점 · 우측 하프스페이스의 절대 지배자',
        f: [93, 86, 86, 94, 70, 56, 92],
      },
    ]),
    bench: buildSquad('hist-1920-liverpool', '19-20 리버풀', 'epl', [
      {
        slug: 'adrian', name: '아드리안', pos: 'GK', main: ['GK'], ovr: 78,
        nat: '스페인', code: 'ES', sta: 75, styles: ['shot_stopper'],
        note: 'UEFA 슈퍼컵 PK 선방 우승 & 리그 초반 연승을 지킨 백업 키퍼',
        f: [32, 68, 56, 54, 74, 72, 78], gk: [79, 77, 81, 74, 78],
      },
      {
        slug: 'matip', name: '조엘 마팁', pos: 'DF', main: ['CB'], ovr: 84,
        nat: '카메룬', code: 'CM', sta: 84, styles: ['ball_playing_cb', 'stopper_cb'],
        note: '전진 드리블과 제공권이 뛰어난 판 다이크의 든든한 파트너',
        f: [58, 81, 68, 80, 88, 86, 85],
      },
      {
        slug: 'milner', name: '제임스 밀너', pos: 'MF', main: ['CM', 'LB'], sec: ['RB', 'CDM'], ovr: 82,
        nat: '잉글랜드', code: 'GB-ENG', sta: 94, styles: ['box_to_box'],
        note: '부주장 리더십과 멀티 포지션·완벽한 PK로 팀을 지탱한 베테랑',
        f: [76, 84, 85, 79, 74, 83, 88],
      },
      {
        slug: 'ox', name: '알렉스 옥슬레이드체임벌린', pos: 'MF', main: ['CM', 'RW'], sec: ['CAM'], ovr: 82,
        nat: '잉글랜드', code: 'GB-ENG', sta: 86, styles: ['box_to_box', 'line_breaker'],
        note: '강력한 중거리 슈팅과 추진력으로 중원에 역동성을 더한 로테이션',
        f: [82, 81, 80, 85, 70, 72, 86],
      },
      {
        slug: 'keita', name: '나비 케이타', pos: 'MF', main: ['CM'], sec: ['CAM'], ovr: 82,
        nat: '기니', code: 'GN', sta: 86, styles: ['box_to_box', 'playmaker_10'],
        note: '전방 압박과 좁은 공간 침투 패스가 날카로운 8번 미드필더',
        f: [77, 84, 76, 87, 64, 78, 84],
      },
      {
        slug: 'origi', name: '디보크 오리기', pos: 'FW', main: ['ST', 'LW'], ovr: 80,
        nat: '벨기에', code: 'BE', sta: 84, styles: ['poacher', 'line_breaker'],
        note: '중요한 순간 득점을 터뜨려낸 클롭 시대의 상징적 슈퍼 서브',
        f: [83, 73, 70, 80, 84, 48, 86],
      },
    ]),
  },

  // =========================================================================
  // 22. 06-07 AC 밀란 (4-4-2 다이아몬드 · 점유율 · 카를로 안첼로티 · 카카 발롱도르 UCL 우승)
  // Slots: [GK, LB, CB, CB, RB, CDM, LCM, RCM, CAM, ST, ST]
  // =========================================================================
  'hist-0607-milan': {
    starters: buildSquad('hist-0607-milan', '06-07 AC 밀란', 'seriea', [
      {
        slug: 'dida', name: '지다', pos: 'GK', main: ['GK'], ovr: 87,
        nat: '브라질', code: 'BR', sta: 80, styles: ['shot_stopper'],
        note: '아테네 결승전 안정적 선방으로 두 번째 빅이어를 품은 브라질 수문장',
        f: [34, 74, 60, 58, 80, 78, 84], gk: [89, 85, 90, 78, 87],
      },
      {
        slug: 'jankulovski', name: '마렉 얀쿨로프스키', pos: 'DF', main: ['LB', 'LWB'], sec: ['LM'], ovr: 85,
        nat: '체코', code: 'CZ', sta: 90, styles: ['attacking_wingback'],
        note: '다이아몬드 전술의 좌측 폭을 책임진 공격적 왼발 풀백',
        f: [74, 83, 88, 84, 74, 83, 88],
      },
      {
        slug: 'maldini', name: '파올로 말디니', pos: 'DF', main: ['CB', 'LB'], ovr: 90,
        nat: '이탈리아', code: 'IT', sta: 84, styles: ['stopper_cb', 'ball_playing_cb'],
        note: '38세의 나이로 통산 5번째 빅이어를 들어 올린 영원한 밀란의 심장',
        f: [62, 84, 80, 80, 88, 94, 86],
      },
      {
        slug: 'nesta', name: '알레산드로 네스타', pos: 'DF', main: ['CB'], ovr: 93,
        nat: '이탈리아', code: 'IT', sta: 87, styles: ['stopper_cb', 'ball_playing_cb'],
        note: '완벽한 태클 타이밍과 우아한 수비 지휘력의 세계 최고 센터백',
        f: [58, 84, 72, 81, 91, 96, 90],
      },
      {
        slug: 'oddo', name: '마시모 오도', pos: 'DF', main: ['RB', 'RWB'], ovr: 85,
        nat: '이탈리아', code: 'IT', sta: 89, styles: ['attacking_wingback'],
        note: '겨울 합류 후 정교한 우측 크로스로 UCL 우승 퍼즐을 맞춘 풀백',
        f: [72, 83, 90, 81, 74, 84, 86],
      },
      {
        slug: 'pirlo', name: '안드레아 피를로', pos: 'MF', main: ['CDM', 'CM'], ovr: 93,
        nat: '이탈리아', code: 'IT', sta: 89, styles: ['deep_playmaker'],
        note: '결승전 선제골 프리킥 & 후방에서 경기를 설계한 위대한 레지스타',
        f: [84, 98, 95, 92, 66, 78, 80],
      },
      {
        slug: 'seedorf', name: '클라렌스 세도르프', pos: 'MF', main: ['CM', 'CAM'], sec: ['LM'], ovr: 90,
        nat: '네덜란드', code: 'NL', sta: 90, styles: ['box_to_box', 'playmaker_10'],
        note: '바이에른·맨유전 결승골 · UCL 4회 우승에 빛나는 강철 테크니션',
        f: [86, 91, 86, 92, 80, 82, 91],
      },
      {
        slug: 'gattuso', name: '젠나로 가투소', pos: 'MF', main: ['CM', 'CDM'], ovr: 89,
        nat: '이탈리아', code: 'IT', sta: 96, styles: ['ball_winner'],
        note: '피를로 옆을 철통 경호하며 맨유·리버풀 중원을 집어삼킨 투견',
        f: [68, 80, 74, 78, 78, 93, 95],
      },
      {
        slug: 'kaka', name: '카카', pos: 'MF', main: ['CAM'], sec: ['ST'], ovr: 95,
        nat: '브라질', code: 'BR', sta: 91, styles: ['playmaker_10', 'line_breaker'],
        note: '2007 발롱도르 · UCL 10골 득점왕, 올드 트래포드를 찢은 치달의 황제',
        f: [93, 94, 88, 97, 78, 56, 93],
      },
      {
        slug: 'inzaghi', name: '필리포 인자기', pos: 'FW', main: ['ST'], ovr: 89,
        nat: '이탈리아', code: 'IT', sta: 86, styles: ['poacher', 'line_breaker'],
        note: '아테네 결승전 멀티골 MOM · 오프사이드 라인 위에서 태어난 천재 골잡이',
        f: [94, 76, 70, 82, 86, 42, 82],
      },
      {
        slug: 'gilardino', name: '알베르토 질라르디노', pos: 'FW', main: ['ST'], ovr: 85,
        nat: '이탈리아', code: 'IT', sta: 86, styles: ['poacher', 'complete_forward'],
        note: '세리에A 팀 최다 12골 & 맨유 4강 쐐기골의 정통 9번 스트라이커',
        f: [88, 77, 72, 81, 88, 48, 84],
      },
    ]),
    bench: buildSquad('hist-0607-milan', '06-07 AC 밀란', 'seriea', [
      {
        slug: 'kalac', name: '젤코 칼라치', pos: 'GK', main: ['GK'], ovr: 78,
        nat: '호주', code: 'AU', sta: 74, styles: ['shot_stopper'],
        note: '202cm 장신으로 제공권을 장악한 백업 골키퍼',
        f: [30, 64, 52, 50, 82, 72, 78], gk: [78, 78, 79, 72, 80],
      },
      {
        slug: 'cafu', name: '카푸', pos: 'DF', main: ['RB', 'RWB'], ovr: 85,
        nat: '브라질', code: 'BR', sta: 88, styles: ['attacking_wingback'],
        note: '노련한 오버래핑과 리더십을 보탠 전설적인 브라질 라이트백',
        f: [72, 84, 88, 86, 72, 83, 86],
      },
      {
        slug: 'kaladze', name: '카하 칼라제', pos: 'DF', main: ['CB', 'LB'], ovr: 83,
        nat: '조지아', code: 'GE', sta: 86, styles: ['stopper_cb'],
        note: '센터백과 레프트백을 모두 소화한 밀란의 핵심 수비 로테이션',
        f: [60, 77, 76, 76, 84, 86, 86],
      },
      {
        slug: 'ambrosini', name: '마시모 암브로시니', pos: 'MF', main: ['CM', 'CDM'], ovr: 86,
        nat: '이탈리아', code: 'IT', sta: 92, styles: ['ball_winner', 'box_to_box'],
        note: '크리스마스 트리 결승전 선발 · 공중볼과 압박의 핵심 중원 리더',
        f: [74, 82, 76, 79, 90, 89, 90],
      },
      {
        slug: 'gourcuff', name: '요안 구르퀴프', pos: 'MF', main: ['CAM', 'CM'], ovr: 80,
        nat: '프랑스', code: 'FR', sta: 83, styles: ['playmaker_10'],
        note: '우아한 볼 터치와 패스 감각을 보여준 프랑스 신예 플레이메이커',
        f: [76, 84, 82, 85, 72, 64, 78],
      },
      {
        slug: 'brocchi', name: '크리스티안 브로키', pos: 'MF', main: ['CM', 'CDM'], ovr: 80,
        nat: '이탈리아', code: 'IT', sta: 90, styles: ['box_to_box', 'ball_winner'],
        note: '왕성한 활동량으로 세리에A 중원 로테이션을 책임진 살림꾼',
        f: [70, 79, 76, 78, 72, 82, 86],
      },
    ]),
  },

  // =========================================================================
  // 23. 01-02 레알 마드리드 (4-4-2 다이아몬드 · 균형 · 비센테 델 보스케 · 갈락티코스 1기 라 노베나)
  // Slots: [GK, LB, CB, CB, RB, CDM, LCM, RCM, CAM, ST, ST]
  // =========================================================================
  'hist-0102-realmadrid': {
    starters: buildSquad('hist-0102-realmadrid', '01-02 레알 마드리드', 'laliga', [
      {
        slug: 'casillas', name: '이케르 카시야스', pos: 'GK', main: ['GK'], ovr: 90,
        nat: '스페인', code: 'ES', sta: 84, styles: ['shot_stopper'],
        note: '글래스고 결승 후반 교체 투입 후 기적의 연속 선방으로 우승 사수',
        f: [34, 76, 62, 60, 74, 80, 82], gk: [92, 87, 96, 78, 90],
      },
      {
        slug: 'roberto_carlos', name: '호베르투 카를루스', pos: 'DF', main: ['LB', 'LWB'], ovr: 92,
        nat: '브라질', code: 'BR', sta: 96, styles: ['attacking_wingback', 'line_breaker'],
        note: '글래스고 결승 지단 발리슛 어시스트 · 초음속 스피드와 UFO 왼발',
        f: [86, 85, 94, 89, 72, 86, 96],
      },
      {
        slug: 'hierro', name: '페르난도 이에로', pos: 'DF', main: ['CB'], sec: ['CDM'], ovr: 90,
        nat: '스페인', code: 'ES', sta: 84, styles: ['ball_playing_cb', 'stopper_cb'],
        note: '정확한 롱패스와 카리스마로 갈락티코스 후방을 통솔한 위대한 주장',
        f: [78, 89, 82, 80, 92, 92, 88],
      },
      {
        slug: 'helguera', name: '이반 엘게라', pos: 'DF', main: ['CB'], sec: ['CDM'], ovr: 86,
        nat: '스페인', code: 'ES', sta: 88, styles: ['ball_playing_cb', 'stopper_cb'],
        note: '안정적 빌드업과 대인 방어로 이에로와 중앙 수비를 완성',
        f: [68, 83, 74, 78, 86, 88, 86],
      },
      {
        slug: 'salgado', name: '미첼 살가도', pos: 'DF', main: ['RB'], ovr: 85,
        nat: '스페인', code: 'ES', sta: 92, styles: ['attacking_wingback', 'ball_winner'],
        note: '끈질긴 대인 마크와 우측 돌파로 피구를 지원한 투지의 라이트백',
        f: [66, 80, 84, 81, 74, 87, 89],
      },
      {
        slug: 'makelele', name: '클로드 마켈렐레', pos: 'MF', main: ['CDM'], ovr: 91,
        nat: '프랑스', code: 'FR', sta: 96, styles: ['ball_winner'],
        note: '갈락티코스 벤틀리의 엔진 · 수비형 미드필더의 교과서를 새로 쓴 앵커',
        f: [62, 86, 74, 84, 74, 96, 94],
      },
      {
        slug: 'solari', name: '산티아고 솔라리', pos: 'MF', main: ['CM', 'LM'], sec: ['LW'], ovr: 84,
        nat: '아르헨티나', code: 'AR', sta: 88, styles: ['classic_winger', 'box_to_box'],
        note: '결승전 카를루스에게 찔러준 천금 스루패스의 기점 · 좌측 밸런스 축',
        f: [78, 85, 86, 87, 70, 74, 82],
      },
      {
        slug: 'figo', name: '루이스 피구', pos: 'MF', main: ['CM', 'RM', 'RW'], sec: ['CAM'], ovr: 92,
        nat: '포르투갈', code: 'PT', sta: 89, styles: ['classic_winger', 'playmaker_10'],
        note: '세계 최고급 드리블과 날카로운 크로스로 우측을 지배한 갈락티코 1호',
        f: [87, 92, 95, 95, 74, 62, 86],
      },
      {
        slug: 'zidane', name: '지네딘 지단', pos: 'MF', main: ['CAM'], sec: ['CM', 'LM'], ovr: 96,
        nat: '프랑스', code: 'FR', sta: 88, styles: ['playmaker_10'],
        note: '글래스고 결승전 역사상 최고의 왼발 발리 결승골 · 우아함의 정점',
        f: [91, 97, 91, 99, 86, 70, 88],
      },
      {
        slug: 'raul', name: '라울 곤살레스', pos: 'FW', main: ['ST'], sec: ['CAM'], ovr: 92,
        nat: '스페인', code: 'ES', sta: 92, styles: ['complete_forward', 'poacher'],
        note: '결승전 선제골·공식전 29골 · 천재적 위치선정과 칩슛의 마드리드 왕자',
        f: [94, 88, 82, 91, 82, 56, 86],
      },
      {
        slug: 'morientes', name: '페르난도 모리엔테스', pos: 'FW', main: ['ST'], ovr: 87,
        nat: '스페인', code: 'ES', sta: 86, styles: ['poacher'],
        note: '라리가 18골 · 압도적 공중볼과 연계로 라울과 환상 투톱을 이룬 9번',
        f: [90, 79, 74, 82, 93, 48, 87],
      },
    ]),
    bench: buildSquad('hist-0102-realmadrid', '01-02 레알 마드리드', 'laliga', [
      {
        slug: 'cesar', name: '세사르 산체스', pos: 'GK', main: ['GK'], ovr: 81,
        nat: '스페인', code: 'ES', sta: 78, styles: ['shot_stopper'],
        note: '글래스고 결승전 선발 출전해 전반을 지킨 베테랑 골키퍼',
        f: [32, 70, 56, 54, 74, 74, 78], gk: [81, 80, 83, 75, 81],
      },
      {
        slug: 'pavon', name: '프란시스코 파본', pos: 'DF', main: ['CB'], ovr: 79,
        nat: '스페인', code: 'ES', sta: 84, styles: ['stopper_cb'],
        note: '지단과 파본들 정책의 상징 · 카스티야 출신 탄탄한 수비 백업',
        f: [50, 72, 62, 68, 82, 82, 82],
      },
      {
        slug: 'flavio', name: '플라비우 콘세이상', pos: 'MF', main: ['CDM', 'CM'], ovr: 82,
        nat: '브라질', code: 'BR', sta: 89, styles: ['ball_winner', 'box_to_box'],
        note: '마켈렐레와 중원 수비를 분담한 브라질 국가대표 홀딩',
        f: [72, 82, 74, 80, 76, 85, 87],
      },
      {
        slug: 'guti', name: '구티', pos: 'MF', main: ['CM', 'CAM'], sec: ['ST'], ovr: 85,
        nat: '스페인', code: 'ES', sta: 84, styles: ['playmaker_10', 'deep_playmaker'],
        note: '예측 불가 킬패스와 천재적 시야를 뽐낸 마드리드 성골 플레이메이커',
        f: [81, 91, 85, 87, 74, 66, 78],
      },
      {
        slug: 'mcmanaman', name: '스티브 맥마나만', pos: 'MF', main: ['RM', 'CM'], sec: ['LM'], ovr: 84,
        nat: '잉글랜드', code: 'GB-ENG', sta: 90, styles: ['classic_winger', 'box_to_box'],
        note: 'UCL 4강 바르사 원정 쐐기골 · 중요한 무대마다 빛난 만능 조커',
        f: [80, 85, 86, 88, 70, 68, 84],
      },
      {
        slug: 'savio', name: '사비우', pos: 'FW', main: ['LW', 'LM'], ovr: 81,
        nat: '브라질', code: 'BR', sta: 84, styles: ['classic_winger', 'inverted_winger'],
        note: '날렵한 왼발 드리블로 측면 변화를 준 브라질 테크니션',
        f: [78, 80, 84, 87, 62, 48, 80],
      },
    ]),
  },

  // =========================================================================
  // 24. 94-95 AFC 아약스 (3-3-3-1 · 점유율 · 루이 판 할 · 리그+UCL 무패 더블)
  // Slots: [GK, LCB, CB, RCB, LWB(LM/LB), CDM(CM), RWB(RM/RB), LAM(CAM/LW/LM), CAM(CM), RAM(CAM/RW/RM), ST]
  // =========================================================================
  'hist-9495-ajax': {
    starters: buildSquad('hist-9495-ajax', '94-95 AFC 아약스', 'bundesliga', [
      {
        slug: 'vandersar', name: '에드윈 판 데르 사르', pos: 'GK', main: ['GK'], ovr: 89,
        nat: '네덜란드', code: 'NL', sta: 84, styles: ['sweeper_keeper', 'shot_stopper'],
        note: 'UCL 11경기 4실점·8클린시트 · 11번째 필드 플레이어 같은 빌드업 GK',
        f: [38, 85, 68, 66, 82, 82, 84], gk: [89, 89, 90, 89, 92],
      },
      {
        slug: 'f_deboer', name: '프랑크 더 부르', pos: 'DF', main: ['CB', 'LB'], ovr: 89,
        nat: '네덜란드', code: 'NL', sta: 90, styles: ['ball_playing_cb', 'stopper_cb'],
        note: '레이저 같은 왼발 롱패스로 3백 좌측 빌드업을 지휘한 수비 핵심',
        f: [76, 91, 88, 82, 86, 90, 88],
      },
      {
        slug: 'blind', name: '다니 블린트', pos: 'DF', main: ['CB'], sec: ['RB', 'CDM'], ovr: 88,
        nat: '네덜란드', code: 'NL', sta: 88, styles: ['ball_playing_cb', 'stopper_cb'],
        note: '젊은 아약스 군단을 완벽히 통솔한 베테랑 주장 리베로',
        f: [66, 87, 78, 81, 86, 91, 87],
      },
      {
        slug: 'reiziger', name: '미하얼 레이지허르', pos: 'DF', main: ['CB', 'RB'], ovr: 85,
        nat: '네덜란드', code: 'NL', sta: 92, styles: ['stopper_cb', 'attacking_wingback'],
        note: '빠른 스피드와 밀착 마크로 우측 뒷공간을 완벽 봉쇄한 수비수',
        f: [60, 80, 81, 80, 78, 87, 91],
      },
      {
        slug: 'davids', name: '에드가르 다비즈', pos: 'MF', main: ['LM', 'CM', 'LWB'], sec: ['CDM'], ovr: 89,
        nat: '네덜란드', code: 'NL', sta: 96, styles: ['ball_winner', 'box_to_box'],
        note: '지치지 않는 투지와 압박·드리블로 중원 좌측을 삼킨 핏불',
        f: [79, 86, 82, 90, 74, 90, 94],
      },
      {
        slug: 'rijkaard', name: '프랑크 레이카르트', pos: 'MF', main: ['CDM', 'CM'], sec: ['CB'], ovr: 91,
        nat: '네덜란드', code: 'NL', sta: 89, styles: ['deep_playmaker', 'ball_winner'],
        note: '결승 클라위버르트 결승골 어시스트 · 경험으로 팀을 완성한 거장',
        f: [80, 91, 80, 86, 90, 92, 91],
      },
      {
        slug: 'seedorf', name: '클라렌스 세도르프', pos: 'MF', main: ['RM', 'CM', 'RWB'], sec: ['CAM'], ovr: 87,
        nat: '네덜란드', code: 'NL', sta: 92, styles: ['box_to_box', 'deep_playmaker'],
        note: '19세에 첫 빅이어를 품은 압도적 피지컬과 기술의 천재 미드필더',
        f: [82, 88, 84, 89, 78, 83, 91],
      },
      {
        slug: 'overmars', name: '마르크 오베르마르스', pos: 'FW', main: ['LW', 'LM', 'CAM'], ovr: 89,
        nat: '네덜란드', code: 'NL', sta: 91, styles: ['classic_winger', 'line_breaker'],
        note: '유럽 최정상급 가속력과 양발 돌파로 밀란 수비를 흔든 번개 윙어',
        f: [85, 84, 90, 93, 62, 54, 95],
      },
      {
        slug: 'litmanen', name: '야리 리트마넨', pos: 'MF', main: ['CAM'], sec: ['ST'], ovr: 91,
        nat: '핀란드', code: 'FI', sta: 88, styles: ['playmaker_10', 'complete_forward'],
        note: '공식전 27골·UCL 6골 · 판 할 3-3-3-1의 완벽한 10번이자 발롱도르 3위',
        f: [91, 93, 86, 92, 78, 58, 82],
      },
      {
        slug: 'finidi', name: '피니디 조지', pos: 'FW', main: ['RW', 'RM', 'CAM'], ovr: 86,
        nat: '나이지리아', code: 'NG', sta: 91, styles: ['classic_winger', 'line_breaker'],
        note: '4강 바이에른전 환상적 중거리골 · 우측 터치라인의 정교한 크로서',
        f: [83, 84, 90, 88, 76, 62, 88],
      },
      {
        slug: 'kluivert', name: '파트릭 클라위버르트', pos: 'FW', main: ['ST'], ovr: 88,
        nat: '네덜란드', code: 'NL', sta: 89, styles: ['complete_forward', 'poacher'],
        note: '18세에 리그 18골 팀 최다 득점 & UCL 결승 85분 결승골의 신동',
        f: [90, 83, 76, 88, 91, 48, 89],
      },
    ]),
    bench: buildSquad('hist-9495-ajax', '94-95 AFC 아약스', 'bundesliga', [
      {
        slug: 'grim', name: '프레드 그림', pos: 'GK', main: ['GK'], ovr: 77,
        nat: '네덜란드', code: 'NL', sta: 75, styles: ['shot_stopper'],
        note: '판 데르 사르의 뒤를 지킨 안정적 백업 골키퍼',
        f: [30, 66, 54, 52, 70, 70, 74], gk: [77, 77, 78, 72, 78],
      },
      {
        slug: 'bogarde', name: '빈스턴 보가르더', pos: 'DF', main: ['CB', 'LB'], ovr: 81,
        nat: '네덜란드', code: 'NL', sta: 87, styles: ['stopper_cb'],
        note: '강인한 피지컬과 스피드로 수비 로테이션을 책임진 멀티 수비수',
        f: [58, 74, 74, 76, 83, 84, 88],
      },
      {
        slug: 'r_deboer', name: '로날트 더 부르', pos: 'MF', main: ['CM', 'RW', 'ST'], sec: ['CAM'], ovr: 86,
        nat: '네덜란드', code: 'NL', sta: 90, styles: ['complete_forward', 'box_to_box'],
        note: '결승전 선발 · 공격과 중원 전 포지션을 넘나든 토탈 풋볼 만능 카드',
        f: [84, 87, 84, 88, 80, 76, 86],
      },
      {
        slug: 'oulida', name: '타릭 울리다', pos: 'MF', main: ['CM', 'CAM'], ovr: 79,
        nat: '네덜란드', code: 'NL', sta: 84, styles: ['playmaker_10'],
        note: 'AEK 아테네전 멀티골을 기록한 아약스 유스 테크니션',
        f: [76, 82, 78, 84, 64, 68, 78],
      },
      {
        slug: 'kanu', name: '은완코 카누', pos: 'FW', main: ['ST'], sec: ['CAM'], ovr: 84,
        nat: '나이지리아', code: 'NG', sta: 84, styles: ['complete_forward', 'playmaker_10'],
        note: '197cm 장신에 마법 같은 발기술을 겸비한 결승전 특급 조커',
        f: [85, 83, 74, 90, 88, 46, 84],
      },
      {
        slug: 'van_vossen', name: '페테르 판 포선', pos: 'FW', main: ['RW', 'LW', 'ST'], ovr: 80,
        nat: '네덜란드', code: 'NL', sta: 85, styles: ['classic_winger', 'line_breaker'],
        note: '빠른 측면 돌파로 무패 시즌 공격 로테이션을 뒷받침',
        f: [80, 76, 81, 84, 68, 50, 84],
      },
    ]),
  },
};
