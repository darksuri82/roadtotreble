import type { AiManagerProfile, ManagerTraitId } from '../types/game';
import type { Club, TacticId } from '../types/league';

/**
 * 2026-27 European Top 5 Leagues (96 clubs) + UCL Non-Top-5 (16 clubs) AI Manager Database.
 *
 * Manager OVR Tiers:
 * - 90..95: World-class elite tacticians (UCL/big-league proven icons)
 * - 84..89: European top-tier / Champions League level coaches
 * - 77..83: Established top-flight / tactical mid-table coaches
 * - 70..76: Lower-table / promoted club managers
 */
export const AI_MANAGERS_BY_CLUB_ID: Record<string, AiManagerProfile> = {
  // =========================================================================
  // PREMIER LEAGUE (20 clubs — 2026-27 verified)
  // =========================================================================
  'epl-ars': { name: '미켈 아르테타', ovr: 91, traitId: 'defensive_architect', preferredFormations: ['4-3-3', '4-2-3-1', '3-4-2-1'], preferredTactics: ['possession', 'gegenpressing'] },
  'epl-mci': { name: '엔초 마레스카', ovr: 88, traitId: 'tiki_taka', preferredFormations: ['4-2-3-1', '4-3-3', '3-4-2-1'], preferredTactics: ['possession', 'balanced'] },
  'epl-liv': { name: '안도니 이라올라', ovr: 87, traitId: 'gegenpress_guru', preferredFormations: ['4-2-3-1', '4-3-3', '3-3-3-1'], preferredTactics: ['gegenpressing', 'wingplay'] },
  'epl-che': { name: '사비 알론소', ovr: 92, traitId: 'total_football', preferredFormations: ['4-2-3-1', '3-4-2-1', '4-4-2-diamond'], preferredTactics: ['possession', 'gegenpressing'] },
  'epl-mun': { name: '마이클 캐릭', ovr: 83, traitId: 'midfield_maestro', preferredFormations: ['4-2-3-1', '3-4-2-1', '4-3-3'], preferredTactics: ['counter', 'possession'] },
  'epl-tot': { name: '로베르토 데 제르비', ovr: 86, traitId: 'tiki_taka', preferredFormations: ['4-2-3-1', '3-3-3-1', '3-4-2-1'], preferredTactics: ['possession', 'gegenpressing'] },
  'epl-new': { name: '마티아스 야이슬레', ovr: 82, traitId: 'gegenpress_guru', preferredFormations: ['4-3-3', '4-4-2-diamond'], preferredTactics: ['gegenpressing', 'counter'] },
  'epl-avl': { name: '우나이 에메리', ovr: 90, traitId: 'halftime_wizard', preferredFormations: ['4-2-3-1', '4-4-2', '3-5-2-dm'], preferredTactics: ['counter', 'balanced'] },
  'epl-bha': { name: '파비안 휘르첼러', ovr: 83, traitId: 'total_football', preferredFormations: ['4-2-3-1', '3-4-3', '3-4-2-1'], preferredTactics: ['possession', 'gegenpressing'] },
  'epl-nfo': { name: '올리버 글라스너', ovr: 85, traitId: 'big_game_hunter', preferredFormations: ['3-4-2-1', '4-2-3-1', '3-5-2-dm'], preferredTactics: ['counter', 'gegenpressing'] },
  'epl-bou': { name: '마르코 로제', ovr: 83, traitId: 'gegenpress_guru', preferredFormations: ['4-2-3-1', '4-4-2-diamond', '4-4-2'], preferredTactics: ['gegenpressing', 'counter'] },
  'epl-ful': { name: '알바로 아르벨로아', ovr: 79, traitId: 'wing_bomber', preferredFormations: ['4-2-3-1', '4-3-3'], preferredTactics: ['wingplay', 'balanced'] },
  'epl-bre': { name: '키스 앤드루스', ovr: 78, traitId: 'set_piece_master', preferredFormations: ['4-3-3', '3-5-2-dm'], preferredTactics: ['wingplay', 'counter'] },
  'epl-cry': { name: '피에르 사주', ovr: 80, traitId: 'underdog_killer', preferredFormations: ['3-4-2-1', '4-3-3'], preferredTactics: ['counter', 'balanced'] },
  'epl-eve': { name: '데이비드 모예스', ovr: 82, traitId: 'defensive_architect', preferredFormations: ['4-2-3-1', '4-4-2', '3-5-2-dm'], preferredTactics: ['counter', 'wingplay'] },
  'epl-sun': { name: '레지 르 브리', ovr: 79, traitId: 'gegenpress_guru', preferredFormations: ['4-2-3-1', '4-3-3'], preferredTactics: ['gegenpressing', 'counter'] },
  'epl-lee': { name: '다니엘 파르케', ovr: 78, traitId: 'wing_bomber', preferredFormations: ['4-2-3-1', '4-4-2'], preferredTactics: ['wingplay', 'possession'] },
  'epl-ips': { name: '게리 오닐', ovr: 77, traitId: 'underdog_killer', preferredFormations: ['4-2-3-1', '3-4-2-1'], preferredTactics: ['wingplay', 'counter'] },
  'epl-cov': { name: '프랭크 램파드', ovr: 76, traitId: 'direct_football', preferredFormations: ['4-2-3-1', '4-3-3'], preferredTactics: ['counter', 'balanced'] },
  'epl-hul': { name: '세르게이 야키로비치', ovr: 74, traitId: 'catenaccio', preferredFormations: ['4-3-3', '4-4-2'], preferredTactics: ['balanced', 'counter'] },

  // =========================================================================
  // LA LIGA (20 clubs — 2026-27 verified)
  // =========================================================================
  'lal-bar': { name: '한지 플릭', ovr: 93, traitId: 'gegenpress_guru', preferredFormations: ['4-2-3-1', '4-3-3', '3-3-3-1'], preferredTactics: ['possession', 'gegenpressing'] },
  'lal-rma': { name: '조제 무리뉴', ovr: 93, traitId: 'big_game_hunter', preferredFormations: ['4-3-3', '4-2-3-1', '4-4-2-diamond'], preferredTactics: ['balanced', 'counter'] },
  'lal-atm': { name: '디에고 시메오네', ovr: 91, traitId: 'catenaccio', preferredFormations: ['4-4-2', '3-5-2-dm', '3-5-2'], preferredTactics: ['counter', 'balanced'] },
  'lal-ath': { name: '에딘 테르지치', ovr: 84, traitId: 'wing_bomber', preferredFormations: ['4-2-3-1', '4-3-3'], preferredTactics: ['wingplay', 'gegenpressing'] },
  'lal-vil': { name: '이니고 페레스', ovr: 80, traitId: 'wing_bomber', preferredFormations: ['4-4-2', '4-2-3-1'], preferredTactics: ['wingplay', 'gegenpressing'] },
  'lal-bet': { name: '마누엘 페예그리니', ovr: 85, traitId: 'midfield_maestro', preferredFormations: ['4-2-3-1', '4-4-2-diamond'], preferredTactics: ['possession', 'balanced'] },
  'lal-rso': { name: '펠레그리노 마타라초', ovr: 80, traitId: 'gegenpress_guru', preferredFormations: ['4-3-3', '3-4-2-1'], preferredTactics: ['possession', 'gegenpressing'] },
  'lal-cel': { name: '클라우디오 히랄데스', ovr: 80, traitId: 'total_football', preferredFormations: ['3-4-3', '3-4-2-1'], preferredTactics: ['wingplay', 'possession'] },
  'lal-sev': { name: '루이스 가르시아', ovr: 79, traitId: 'halftime_wizard', preferredFormations: ['4-3-3', '4-2-3-1'], preferredTactics: ['balanced', 'counter'] },
  'lal-osa': { name: '하고바 아라사테', ovr: 80, traitId: 'set_piece_master', preferredFormations: ['4-3-3', '4-2-3-1'], preferredTactics: ['wingplay', 'counter'] },
  'lal-ray': { name: '베냐트 산 호세', ovr: 76, traitId: 'gegenpress_guru', preferredFormations: ['4-2-3-1', '4-4-2'], preferredTactics: ['gegenpressing', 'counter'] },
  'lal-val': { name: '하비에르 아기레', ovr: 80, traitId: 'defensive_architect', preferredFormations: ['4-4-2', '3-5-2-dm'], preferredTactics: ['counter', 'balanced'] },
  'lal-get': { name: '호세 보르달라스', ovr: 81, traitId: 'catenaccio', preferredFormations: ['4-4-2', '3-5-2-dm'], preferredTactics: ['counter', 'wingplay'] },
  'lal-esp': { name: '에데르 사라비아', ovr: 77, traitId: 'tiki_taka', preferredFormations: ['4-4-2', '4-3-3'], preferredTactics: ['counter', 'possession'] },
  'lal-ala': { name: '키케 산체스 플로레스', ovr: 79, traitId: 'defensive_architect', preferredFormations: ['4-2-3-1', '4-4-2'], preferredTactics: ['balanced', 'counter'] },
  'lal-elc': { name: '마르틴 안셀미', ovr: 76, traitId: 'tiki_taka', preferredFormations: ['4-2-3-1', '3-4-2-1'], preferredTactics: ['possession', 'balanced'] },
  'lal-lev': { name: '루이스 카스트로', ovr: 77, traitId: 'underdog_killer', preferredFormations: ['4-4-2', '4-2-3-1'], preferredTactics: ['counter', 'wingplay'] },
  'lal-dep': { name: '안토니오 이달고', ovr: 75, traitId: 'wing_bomber', preferredFormations: ['4-2-3-1', '4-4-2'], preferredTactics: ['wingplay', 'counter'] },
  'lal-rac': { name: '호세 알베르토', ovr: 75, traitId: 'gegenpress_guru', preferredFormations: ['4-2-3-1', '4-3-3'], preferredTactics: ['gegenpressing', 'wingplay'] },
  'lal-mlg': { name: '후안 프란시스코 푸네스', ovr: 73, traitId: 'underdog_killer', preferredFormations: ['4-3-3', '4-4-2'], preferredTactics: ['balanced', 'counter'] },

  // =========================================================================
  // SERIE A (20 clubs — 2026-27 verified)
  // =========================================================================
  'ser-int': { name: '크리스티안 키부', ovr: 85, traitId: 'defensive_architect', preferredFormations: ['3-5-2', '3-5-2-dm', '3-4-2-1'], preferredTactics: ['counter', 'balanced'] },
  'ser-nap': { name: '마시밀리아노 알레그리', ovr: 89, traitId: 'halftime_wizard', preferredFormations: ['4-3-3', '3-5-2-dm', '4-4-2-diamond'], preferredTactics: ['possession', 'counter'] },
  'ser-acm': { name: '후벵 아모림', ovr: 86, traitId: 'wing_bomber', preferredFormations: ['3-4-2-1', '3-4-3', '4-2-3-1'], preferredTactics: ['wingplay', 'gegenpressing'] },
  'ser-juv': { name: '루치아노 스팔레티', ovr: 88, traitId: 'midfield_maestro', preferredFormations: ['4-2-3-1', '4-3-3', '3-5-2'], preferredTactics: ['possession', 'balanced'] },
  'ser-ata': { name: '마우리치오 사리', ovr: 85, traitId: 'tiki_taka', preferredFormations: ['4-3-3', '3-4-2-1'], preferredTactics: ['possession', 'gegenpressing'] },
  'ser-rom': { name: '잔 피에로 가스페리니', ovr: 89, traitId: 'gegenpress_guru', preferredFormations: ['3-4-2-1', '3-3-3-1', '3-4-3'], preferredTactics: ['gegenpressing', 'wingplay'] },
  'ser-laz': { name: '젠나로 가투소', ovr: 80, traitId: 'direct_football', preferredFormations: ['4-2-3-1', '4-3-3'], preferredTactics: ['wingplay', 'gegenpressing'] },
  'ser-fio': { name: '파비오 그로소', ovr: 78, traitId: 'tiki_taka', preferredFormations: ['4-2-3-1', '4-3-3'], preferredTactics: ['possession', 'balanced'] },
  'ser-bol': { name: '도메니코 테데스코', ovr: 82, traitId: 'gegenpress_guru', preferredFormations: ['4-2-3-1', '3-4-2-1'], preferredTactics: ['gegenpressing', 'balanced'] },
  'ser-com': { name: '세스크 파브레가스', ovr: 83, traitId: 'tiki_taka', preferredFormations: ['4-2-3-1', '4-4-2-diamond'], preferredTactics: ['possession', 'gegenpressing'] },
  'ser-tor': { name: '이냐치오 아바테', ovr: 76, traitId: 'defensive_architect', preferredFormations: ['3-5-2', '3-5-2-dm'], preferredTactics: ['counter', 'balanced'] },
  'ser-udi': { name: '코스타 루냐이치', ovr: 77, traitId: 'set_piece_master', preferredFormations: ['3-5-2', '3-5-2-dm'], preferredTactics: ['counter', 'wingplay'] },
  'ser-gen': { name: '다니엘레 데 로시', ovr: 79, traitId: 'midfield_maestro', preferredFormations: ['3-5-2', '4-3-3'], preferredTactics: ['balanced', 'counter'] },
  'ser-cag': { name: '파비오 피사카네', ovr: 74, traitId: 'underdog_killer', preferredFormations: ['4-2-3-1', '3-5-2-dm'], preferredTactics: ['wingplay', 'counter'] },
  'ser-par': { name: '카를로스 쿠에스타', ovr: 77, traitId: 'total_football', preferredFormations: ['4-2-3-1', '4-3-3'], preferredTactics: ['counter', 'possession'] },
  'ser-sas': { name: '알베르토 아퀼라니', ovr: 76, traitId: 'wing_bomber', preferredFormations: ['4-3-3', '4-2-3-1'], preferredTactics: ['wingplay', 'possession'] },
  'ser-lec': { name: '에우세비오 디 프란체스코', ovr: 77, traitId: 'direct_football', preferredFormations: ['4-3-3', '4-2-3-1'], preferredTactics: ['balanced', 'wingplay'] },
  'ser-mon': { name: '이반 유리치', ovr: 79, traitId: 'gegenpress_guru', preferredFormations: ['3-4-2-1', '3-5-2-dm'], preferredTactics: ['balanced', 'gegenpressing'] },
  'ser-ven': { name: '조반니 스트로파', ovr: 75, traitId: 'catenaccio', preferredFormations: ['3-5-2', '3-5-2-dm'], preferredTactics: ['counter', 'balanced'] },
  'ser-fro': { name: '마시밀리아노 알비니', ovr: 73, traitId: 'underdog_killer', preferredFormations: ['4-3-3', '3-5-2-dm'], preferredTactics: ['counter', 'balanced'] },

  // =========================================================================
  // BUNDESLIGA (18 clubs — 2026-27 verified)
  // =========================================================================
  'bun-bay': { name: '뱅상 콤파니', ovr: 88, traitId: 'gegenpress_guru', preferredFormations: ['4-2-3-1', '4-3-3', '3-3-3-1'], preferredTactics: ['gegenpressing', 'possession'] },
  'bun-bvb': { name: '니코 코바치', ovr: 85, traitId: 'direct_football', preferredFormations: ['4-2-3-1', '3-4-2-1', '4-4-2'], preferredTactics: ['gegenpressing', 'counter'] },
  'bun-lev': { name: '카를레스 마르티네스', ovr: 82, traitId: 'total_football', preferredFormations: ['3-4-2-1', '3-4-3'], preferredTactics: ['possession', 'wingplay'] },
  'bun-rbl': { name: '마르틴 데미첼리스', ovr: 81, traitId: 'gegenpress_guru', preferredFormations: ['4-4-2', '4-4-2-diamond'], preferredTactics: ['gegenpressing', 'counter'] },
  'bun-sge': { name: '아디 휘터', ovr: 84, traitId: 'direct_football', preferredFormations: ['4-4-2', '3-4-2-1', '3-5-2-dm'], preferredTactics: ['counter', 'gegenpressing'] },
  'bun-vfb': { name: '제바스티안 회네스', ovr: 86, traitId: 'tiki_taka', preferredFormations: ['4-2-3-1', '4-4-2-diamond', '3-4-2-1'], preferredTactics: ['possession', 'gegenpressing'] },
  'bun-scf': { name: '율리안 슈스터', ovr: 81, traitId: 'set_piece_master', preferredFormations: ['4-2-3-1', '4-4-2'], preferredTactics: ['wingplay', 'balanced'] },
  'bun-m05': { name: '우르스 피셔', ovr: 81, traitId: 'defensive_architect', preferredFormations: ['3-4-2-1', '3-5-2-dm'], preferredTactics: ['gegenpressing', 'counter'] },
  'bun-bmg': { name: '알렉산더 블레신', ovr: 78, traitId: 'gegenpress_guru', preferredFormations: ['4-2-3-1', '3-5-2'], preferredTactics: ['balanced', 'gegenpressing'] },
  'bun-svw': { name: '다니엘 티우네', ovr: 77, traitId: 'wing_bomber', preferredFormations: ['3-5-2', '4-2-3-1'], preferredTactics: ['wingplay', 'counter'] },
  'bun-tsg': { name: '크리스티안 일처', ovr: 80, traitId: 'gegenpress_guru', preferredFormations: ['4-2-3-1', '4-4-2-diamond'], preferredTactics: ['balanced', 'gegenpressing'] },
  'bun-fca': { name: '마누엘 바움', ovr: 76, traitId: 'catenaccio', preferredFormations: ['3-5-2', '3-5-2-dm'], preferredTactics: ['counter', 'balanced'] },
  'bun-fcu': { name: '마우로 루스트리넬리', ovr: 76, traitId: 'set_piece_master', preferredFormations: ['3-4-3', '3-5-2-dm'], preferredTactics: ['counter', 'wingplay'] },
  'bun-koe': { name: 'R. 바그너', ovr: 76, traitId: 'wing_bomber', preferredFormations: ['4-2-3-1', '4-4-2'], preferredTactics: ['wingplay', 'counter'] },
  'bun-hsv': { name: '메를린 폴친', ovr: 77, traitId: 'tiki_taka', preferredFormations: ['4-3-3', '4-2-3-1'], preferredTactics: ['possession', 'wingplay'] },
  'bun-s04': { name: '미론 무슬리치', ovr: 77, traitId: 'underdog_killer', preferredFormations: ['4-2-3-1', '3-5-2-dm'], preferredTactics: ['counter', 'gegenpressing'] },
  'bun-elv': { name: '빈첸트 바그너', ovr: 75, traitId: 'gegenpress_guru', preferredFormations: ['4-2-3-1', '4-4-2'], preferredTactics: ['gegenpressing', 'counter'] },
  'bun-scp': { name: '랄프 케테만', ovr: 74, traitId: 'underdog_killer', preferredFormations: ['3-4-2-1', '3-5-2-dm'], preferredTactics: ['counter', 'wingplay'] },

  // =========================================================================
  // LIGUE 1 (18 clubs — 2026-27 verified)
  // =========================================================================
  'lig-psg': { name: '루이스 엔리케', ovr: 93, traitId: 'tiki_taka', preferredFormations: ['4-3-3', '3-3-3-1', '4-2-3-1'], preferredTactics: ['possession', 'gegenpressing'] },
  'lig-om': { name: '브루노 제네시오', ovr: 84, traitId: 'midfield_maestro', preferredFormations: ['3-4-2-1', '4-2-3-1', '4-3-3'], preferredTactics: ['possession', 'balanced'] },
  'lig-asm': { name: '필리페 루이스', ovr: 84, traitId: 'gegenpress_guru', preferredFormations: ['4-2-3-1', '4-4-2-diamond'], preferredTactics: ['gegenpressing', 'possession'] },
  'lig-lil': { name: '다비데 안첼로티', ovr: 82, traitId: 'halftime_wizard', preferredFormations: ['4-2-3-1', '4-4-2-diamond'], preferredTactics: ['balanced', 'possession'] },
  'lig-ol': { name: '파울루 폰세카', ovr: 84, traitId: 'wing_bomber', preferredFormations: ['4-3-3', '4-2-3-1'], preferredTactics: ['wingplay', 'possession'] },
  'lig-nic': { name: '올리비에 판탈로니', ovr: 77, traitId: 'defensive_architect', preferredFormations: ['3-4-3', '3-5-2-dm'], preferredTactics: ['counter', 'balanced'] },
  'lig-len': { name: '디노 토프묄러', ovr: 81, traitId: 'gegenpress_guru', preferredFormations: ['3-4-2-1', '3-5-2'], preferredTactics: ['gegenpressing', 'counter'] },
  'lig-str': { name: '우고 올리베이라', ovr: 78, traitId: 'gegenpress_guru', preferredFormations: ['3-4-3', '4-3-3'], preferredTactics: ['gegenpressing', 'wingplay'] },
  'lig-bre': { name: '쥘리앵 라슈에르', ovr: 76, traitId: 'set_piece_master', preferredFormations: ['4-3-3', '4-4-2'], preferredTactics: ['wingplay', 'counter'] },
  'lig-ren': { name: '프랑크 에즈', ovr: 82, traitId: 'total_football', preferredFormations: ['3-4-2-1', '3-5-2-dm'], preferredTactics: ['balanced', 'gegenpressing'] },
  'lig-tou': { name: '옌스 베르텔 아스코우', ovr: 76, traitId: 'underdog_killer', preferredFormations: ['3-4-3', '3-5-2-dm'], preferredTactics: ['counter', 'balanced'] },
  'lig-aux': { name: '윌 스틸', ovr: 79, traitId: 'direct_football', preferredFormations: ['3-4-2-1', '4-2-3-1'], preferredTactics: ['counter', 'gegenpressing'] },
  'lig-pfc': { name: '리암 로세니어', ovr: 80, traitId: 'tiki_taka', preferredFormations: ['4-2-3-1', '4-3-3'], preferredTactics: ['possession', 'balanced'] },
  'lig-lor': { name: '알렉상드르 뒤죄', ovr: 76, traitId: 'wing_bomber', preferredFormations: ['4-2-3-1', '4-4-2'], preferredTactics: ['wingplay', 'counter'] },
  'lig-ang': { name: '스테판 질리', ovr: 76, traitId: 'defensive_architect', preferredFormations: ['4-2-3-1', '4-4-2'], preferredTactics: ['balanced', 'counter'] },
  'lig-hac': { name: '디디에 디가르', ovr: 75, traitId: 'catenaccio', preferredFormations: ['4-4-2', '3-5-2-dm'], preferredTactics: ['counter', 'balanced'] },
  'lig-tro': { name: '스테판 뒤몽', ovr: 74, traitId: 'catenaccio', preferredFormations: ['4-3-3', '4-4-2'], preferredTactics: ['counter', 'balanced'] },
  'lig-lma': { name: '파트리크 비데이라', ovr: 73, traitId: 'underdog_killer', preferredFormations: ['4-4-2', '4-2-3-1'], preferredTactics: ['balanced', 'counter'] },

  // =========================================================================
  // UCL NON-TOP-5 CLUBS (16 clubs)
  // =========================================================================
  'ucl-benfica': { name: 'SL 벤피카 감독', ovr: 83, traitId: 'tiki_taka', preferredFormations: ['4-2-3-1', '4-3-3'], preferredTactics: ['possession', 'gegenpressing'] },
  'ucl-porto': { name: 'FC 포르투 감독', ovr: 83, traitId: 'gegenpress_guru', preferredFormations: ['4-3-3', '4-4-2'], preferredTactics: ['gegenpressing', 'counter'] },
  'ucl-sporting': { name: '스포르팅 CP 감독', ovr: 84, traitId: 'total_football', preferredFormations: ['3-4-3', '3-4-2-1'], preferredTactics: ['gegenpressing', 'wingplay'] },
  'ucl-ajax': { name: 'AFC 아약스 감독', ovr: 82, traitId: 'tiki_taka', preferredFormations: ['4-3-3', '3-3-3-1'], preferredTactics: ['possession', 'gegenpressing'] },
  'ucl-psv': { name: 'PSV 감독', ovr: 83, traitId: 'wing_bomber', preferredFormations: ['4-3-3', '4-2-3-1'], preferredTactics: ['wingplay', 'possession'] },
  'ucl-feyenoord': { name: '페예노르트 감독', ovr: 81, traitId: 'gegenpress_guru', preferredFormations: ['4-3-3', '4-2-3-1'], preferredTactics: ['gegenpressing', 'wingplay'] },
  'ucl-celtic': { name: '셀틱 감독', ovr: 80, traitId: 'wing_bomber', preferredFormations: ['4-3-3', '4-2-3-1'], preferredTactics: ['wingplay', 'possession'] },
  'ucl-rangers': { name: '레인저스 감독', ovr: 79, traitId: 'direct_football', preferredFormations: ['4-2-3-1', '4-4-2'], preferredTactics: ['counter', 'wingplay'] },
  'ucl-galatasaray': { name: '갈라타사라이 감독', ovr: 82, traitId: 'big_game_hunter', preferredFormations: ['4-2-3-1', '3-5-2'], preferredTactics: ['gegenpressing', 'wingplay'] },
  'ucl-fenerbahce': { name: '페네르바체 감독', ovr: 82, traitId: 'halftime_wizard', preferredFormations: ['4-2-3-1', '4-4-2-diamond'], preferredTactics: ['balanced', 'counter'] },
  'ucl-salzburg': { name: '잘츠부르크 감독', ovr: 79, traitId: 'gegenpress_guru', preferredFormations: ['4-3-3', '4-4-2-diamond'], preferredTactics: ['gegenpressing', 'counter'] },
  'ucl-shakhtar': { name: '샤흐타르 감독', ovr: 79, traitId: 'tiki_taka', preferredFormations: ['4-3-3', '4-2-3-1'], preferredTactics: ['possession', 'counter'] },
  'ucl-brugge': { name: '클럽 브뤼허 감독', ovr: 80, traitId: 'underdog_killer', preferredFormations: ['4-2-3-1', '3-5-2-dm'], preferredTactics: ['balanced', 'counter'] },
  'ucl-olympiacos': { name: '올림피아코스 감독', ovr: 79, traitId: 'catenaccio', preferredFormations: ['4-2-3-1', '3-5-2-dm'], preferredTactics: ['counter', 'balanced'] },
  'ucl-sparta': { name: '스파르타 프라하 감독', ovr: 78, traitId: 'set_piece_master', preferredFormations: ['3-4-3', '3-5-2-dm'], preferredTactics: ['counter', 'wingplay'] },
  'ucl-dinamo': { name: '디나모 자그레브 감독', ovr: 79, traitId: 'underdog_killer', preferredFormations: ['4-2-3-1', '4-3-3'], preferredTactics: ['balanced', 'counter'] },
};

function defaultTraitForTactic(tactic: TacticId): ManagerTraitId {
  switch (tactic) {
    case 'possession':
      return 'tiki_taka';
    case 'gegenpressing':
      return 'gegenpress_guru';
    case 'counter':
      return 'catenaccio';
    case 'wingplay':
      return 'wing_bomber';
    default:
      return 'halftime_wizard';
  }
}

/**
 * Resolves the active AI manager profile for any club (Top 5 Leagues, UCL, or Hall of Fame).
 * Uses `club.manager` if explicitly provided (e.g. Dream Match Hall of Fame teams),
 * otherwise falls back to `AI_MANAGERS_BY_CLUB_ID`, or a calibrated default derived from club OVR.
 */
export function getClubManager(club: Club): AiManagerProfile {
  if (club.manager) {
    return club.manager;
  }
  const mapped = AI_MANAGERS_BY_CLUB_ID[club.id];
  if (mapped) {
    return mapped;
  }
  const avgOvr = Math.round((club.att + club.mid + club.def) / 3);
  return {
    name: `${club.shortName} 감독`,
    ovr: Math.max(74, Math.min(82, avgOvr - 2)),
    traitId: defaultTraitForTactic(club.defaultTactic),
    preferredFormations: [club.formation, '4-2-3-1'],
    preferredTactics: [club.defaultTactic, 'balanced'],
  };
}
