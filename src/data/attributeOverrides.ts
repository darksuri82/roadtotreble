import type { PlayerAttributes } from '../types/player';

/**
 * Curated real-football sub-attribute profiles for 5-league stars and classic icons.
 * - Strongly differentiates real physicality/speed archetypes:
 *   e.g. technical pivots/registas (Busquets, Xavi, Pirlo, Kroos, Pedri, Vitinha, Modric,
 *   David Silva, Scholes, Ozil) excel in PAS/DRI/DEF-IQ with realistic lower PHY,
 *   while physical/athletic titans (Van Dijk, Drogba, Yaya Toure, Vieira, Gullit, Stam,
 *   Vidic, Haaland, Mbappe, Bale, Rice, Caicedo, Valverde) tower in PHY/AER.
 */
export const CURATED_ATTRIBUTE_OVERRIDES: Record<string, PlayerAttributes> = {
  // ============================================================================
  // ACTIVE SUPERSTARS & ARCHETYPE BENCHMARKS
  // ============================================================================
  // 라민 야말 (RW, OVR 92) - 크랙 & 찬스메이커 윙어: 최상위 드리블·패스·크로스 + 정교한 감아차기
  'act-004': { sho: 87, pas: 94, cro: 93, dri: 97, aer: 54, def: 51, phy: 82 },
  // 킬리안 음바페 (ST/LW, OVR 92) - 폭발적 스피드·라인브레이킹·결정력
  'act-001': { sho: 95, pas: 84, cro: 79, dri: 95, aer: 74, def: 46, phy: 97 },
  // 해리 케인 (ST, OVR 91) - 완성형 9번: 최고 결정력·헤더 + 2선급 롱패스·스루패스 연계력 (스피드 현실화)
  'act-002': { sho: 96, pas: 91, cro: 82, dri: 84, aer: 92, def: 56, phy: 82 },
  // 엘링 홀란 (ST, OVR 91) - 괴물 타겟/포처 9번: 압도적 골 결정력·공중볼·피지컬
  'act-006': { sho: 97, pas: 73, cro: 58, dri: 79, aer: 95, def: 50, phy: 96 },
  // 마이클 올리세 (RW/CAM, OVR 91) - 왼발 감아차기 크로스·스루패스·드리블·컷인 슈팅
  'act-017': { sho: 88, pas: 94, cro: 95, dri: 94, aer: 57, def: 55, phy: 80 },
  // 로드리 (CDM/CM, OVR 90) - 중원 지배자: 탈압박·패스·수비 지능·체격
  'act-003': { sho: 82, pas: 95, cro: 81, dri: 87, aer: 87, def: 92, phy: 87 },
  // 페드리 (CDM/CM, OVR 90) - 천재 플레이메이커: 시야·스루패스·탈압박 (피지컬·공중볼 현실화)
  'act-022': { sho: 78, pas: 96, cro: 86, dri: 95, aer: 58, def: 81, phy: 76 },
  // 주드 벨링엄 (CAM/CM, OVR 90) - 박스 침투 클러치 미드필더·강한 피지컬
  'act-008': { sho: 89, pas: 90, cro: 82, dri: 91, aer: 85, def: 80, phy: 92 },
  // 비티냐 (CM/CDM, OVR 90) - 후방 빌드업·전진 드리블·템포 조절 (피지컬 현실화)
  'act-007': { sho: 82, pas: 96, cro: 87, dri: 93, aer: 59, def: 81, phy: 78 },
  // 우스만 뎀벨레 (RW/ST, OVR 90) - 양발 크랙 드리블러 & 크로스·슈팅
  'act-005': { sho: 85, pas: 87, cro: 90, dri: 95, aer: 58, def: 48, phy: 90 },
  // 데클런 라이스 (CDM/CM, OVR 90) - 중원 장악·세트피스 킥·압도적 활동량·피지컬
  'act-011': { sho: 79, pas: 89, cro: 88, dri: 84, aer: 88, def: 93, phy: 94 },
  // 윌리엄 살리바 (CB, OVR 89) - 침착한 대인 수비·스피드·빌드업
  'act-014': { sho: 54, pas: 83, cro: 61, dri: 76, aer: 89, def: 92, phy: 92 },
  // 가브리엘 마갈량이스 (CB, OVR 89) - 세트피스 헤더 폭격기 & 철벽 스토퍼
  'act-015': { sho: 63, pas: 76, cro: 57, dri: 70, aer: 94, def: 91, phy: 93 },
  // 부카요 사카 (RW/CAM, OVR 89) - 정교한 크로스·컷백·인사이드 슛
  'act-027': { sho: 86, pas: 88, cro: 91, dri: 90, aer: 63, def: 63, phy: 85 },
  // 비니시우스 주니오르 (LW/ST, OVR 89) - 폭발적 측면 1대1 돌파·스피드
  'act-016': { sho: 87, pas: 83, cro: 83, dri: 95, aer: 61, def: 46, phy: 94 },
  // 흐비차 크바라츠헬리아 (LW/RW, OVR 89) - 변칙 드리블·컷인 슈팅·창조적 패스
  'act-009': { sho: 86, pas: 87, cro: 87, dri: 94, aer: 65, def: 55, phy: 85 },
  // 아슈라프 하키미 (RB, OVR 89) - 초고속 오버래핑 윙백
  'act-012': { sho: 79, pas: 84, cro: 90, dri: 87, aer: 74, def: 84, phy: 95 },
  // 하피냐 (LW/ST, OVR 89) - 침투·왼발 크로스·중거리·강한 압박 활동량
  'act-028': { sho: 89, pas: 87, cro: 91, dri: 89, aer: 68, def: 64, phy: 91 },
  // 자말 무시알라 (CAM/LW, OVR 88) - 좁은 공간 환상 드리블 & 침투 마무리
  'act-021': { sho: 85, pas: 88, cro: 82, dri: 95, aer: 60, def: 63, phy: 78 },
  // 콜 팔머 (CAM/RW, OVR 88) - 냉철한 피니시·스루패스·PK 스페셜리스트
  'act-0023': { sho: 89, pas: 91, cro: 88, dri: 89, aer: 64, def: 55, phy: 77 },
  // 페데리코 발베르데 (CM/RB/RW, OVR 88) - 대포알 중거리 슛 & 무한 동력 피지컬 엔진
  'act-023': { sho: 87, pas: 87, cro: 85, dri: 84, aer: 79, def: 86, phy: 95 },
  // 훌리안 알바레스 (ST, OVR 88) - 전방위 압박·연계·중거리·세트피스
  'act-037': { sho: 91, pas: 86, cro: 84, dri: 88, aer: 78, def: 64, phy: 88 },
  // 누누 멘데스 (LB, OVR 88) - 폭발적 측면 돌파 & 크로스
  'act-013': { sho: 73, pas: 83, cro: 88, dri: 88, aer: 75, def: 85, phy: 94 },
  // 주앙 네베스 (CM/CDM, OVR 88) - 탈압박·태클·패스·왕성한 활동량
  'act-044': { sho: 77, pas: 91, cro: 83, dri: 89, aer: 74, def: 89, phy: 86 },
  // 라우타로 마르티네스 (ST, OVR 88) - 문전 포처 본능·헤더·전방 압박
  'act-018': { sho: 92, pas: 79, cro: 69, dri: 86, aer: 88, def: 57, phy: 88 },
  // 요슈아 키미히 (CDM/RB, OVR 88) - 정밀한 얼리 크로스·코너킥·롱패스 (스피드/피지컬 현실화)
  'act-0803': { sho: 77, pas: 95, cro: 94, dri: 85, aer: 71, def: 86, phy: 79 },
  // 브루노 페르난데스 (CAM/CDM, OVR 88) - 모험적 킬패스·얼리 크로스·중거리·PK
  'act-0031': { sho: 86, pas: 93, cro: 92, dri: 84, aer: 66, def: 70, phy: 80 },
  // 플로리안 비르츠 (CAM/LW, OVR 87) - 창의적 킬패스·하프스페이스 지배자
  'act-020': { sho: 84, pas: 92, cro: 86, dri: 92, aer: 58, def: 64, phy: 77 },
  // 알렉산데르 이사크 (ST, OVR 87) - 유연한 드리블과 정교한 피니시
  'act-0018': { sho: 91, pas: 80, cro: 72, dri: 89, aer: 84, def: 49, phy: 88 },
  // 버질 판 다이크 (CB, OVR 87) - 공중볼 절대 지배자·대각선 롱패스·압도적 피지컬
  'act-025': { sho: 62, pas: 85, cro: 64, dri: 74, aer: 93, def: 90, phy: 91 },
  // 모이세스 카이세도 (CDM, OVR 87) - 강력한 대인 압박·태클·피지컬 볼위너
  'act-057': { sho: 71, pas: 84, cro: 76, dri: 79, aer: 82, def: 91, phy: 92 },
  // 알레산드로 바스토니 (CB, OVR 87) - 왼발 전진 빌드업 & 오버래핑 크로스 센터백
  'act-026': { sho: 61, pas: 88, cro: 82, dri: 79, aer: 87, def: 88, phy: 85 },
  // 니콜로 바렐라 (CM/CAM, OVR 87) - 공수 겸비 박스 투 박스 & 중거리 발리
  'act-032': { sho: 81, pas: 89, cro: 85, dri: 87, aer: 70, def: 84, phy: 88 },
  // 알렉산다르 파블로비치 (CDM, OVR 87) - 딥라잉 패스·조율 특화
  'act-109': { sho: 69, pas: 92, cro: 79, dri: 84, aer: 77, def: 86, phy: 80 },
  // 마르틴 외데고르 (CM/CAM, OVR 86) - 하프스페이스 스루패스·찬스메이킹 (피지컬 현실화)
  'act-024': { sho: 82, pas: 94, cro: 91, dri: 90, aer: 56, def: 73, phy: 75 },
  // 알렉시스 맥 알리스터 (CDM/CM, OVR 86) - 탈압박·패스·중거리·수비 지능 (피지컬 현실화)
  'act-042': { sho: 79, pas: 90, cro: 82, dri: 86, aer: 72, def: 84, phy: 79 },
  // 필 포든 (CAM/RW, OVR 86) - 퍼스트 터치·컷인 중거리 슛·하프스페이스 연계
  'act-048': { sho: 86, pas: 87, cro: 83, dri: 90, aer: 56, def: 58, phy: 76 },
  // 케빈 더 브라위너 (CAM/CM, OVR 86) - 패스 마스터: 택배 크로스·킬패스·중거리 (노쇠 스피드 반영)
  'act-050': { sho: 85, pas: 95, cro: 94, dri: 84, aer: 65, def: 64, phy: 73 },
  // 트렌트 알렉산더아놀드 (RB, OVR 85) - 택배 얼리 크로스·대각선 전환·프리킥
  'act-0269': { sho: 79, pas: 93, cro: 95, dri: 81, aer: 68, def: 77, phy: 79 },
  // 페데리코 디마르코 (LM/LW, OVR 86) - 명품 왼발 얼리 크로스 & 세트피스
  'act-047': { sho: 81, pas: 87, cro: 94, dri: 83, aer: 67, def: 79, phy: 83 },
  // 제레미 도쿠 (LW/CAM, OVR 85) - 폭발적 1대1 크랙 드리블러
  'act-120': { sho: 78, pas: 82, cro: 84, dri: 95, aer: 54, def: 47, phy: 92 },
  // 알폰소 데이비스 (LB/LW, OVR 86) - 초음속 오버래핑 & 드리블 돌파
  'act-085': { sho: 72, pas: 81, cro: 85, dri: 89, aer: 74, def: 82, phy: 95 },
  // 도미니크 소보슬라이 (CDM/CAM, OVR 86) - 레이저 중거리 슛·프리킥·강한 활동량
  'act-0013': { sho: 88, pas: 89, cro: 90, dri: 86, aer: 78, def: 81, phy: 89 },
  // 알레한드로 그리말도 (LWB/LB, OVR 85) - 프리킥·크로스·인사이드 연계
  'act-046': { sho: 81, pas: 88, cro: 93, dri: 85, aer: 65, def: 79, phy: 81 },
  // 마르쿠스 튀람 (ST, OVR 86) - 피지컬·스피드·헤더 겸비 스트라이커
  'act-0518': { sho: 87, pas: 78, cro: 73, dri: 84, aer: 87, def: 55, phy: 92 },
  // 세루 기라시 (ST, OVR 86) - 타겟형 피니셔 & 제공권
  'act-102': { sho: 90, pas: 76, cro: 62, dri: 80, aer: 90, def: 50, phy: 89 },

  // Active Elite Goalkeepers
  'act-019': {
    sho: 40, pas: 74, cro: 57, dri: 60, aer: 91, def: 90, phy: 89,
    gk: { div: 91, han: 87, ref: 92, kic: 76, pos: 89 },
  },
  'act-010': {
    sho: 40, pas: 76, cro: 59, dri: 62, aer: 92, def: 90, phy: 89,
    gk: { div: 90, han: 90, ref: 91, kic: 78, pos: 90 },
  },
  'act-072': {
    sho: 40, pas: 86, cro: 73, dri: 72, aer: 87, def: 88, phy: 84,
    gk: { div: 88, han: 87, ref: 89, kic: 90, pos: 88 },
  },
  'act-030': {
    sho: 41, pas: 85, cro: 71, dri: 72, aer: 88, def: 88, phy: 87,
    gk: { div: 88, han: 88, ref: 89, kic: 88, pos: 89 },
  },
  'act-038': {
    sho: 40, pas: 74, cro: 57, dri: 58, aer: 89, def: 88, phy: 87,
    gk: { div: 88, han: 90, ref: 88, kic: 75, pos: 90 },
  },

  // ============================================================================
  // CLASSIC ICONS BY ID (Primary Era Classics)
  // ============================================================================
  'leg-gk-01': { sho: 40, pas: 83, cro: 69, dri: 71, aer: 95, def: 95, phy: 92, gk: { div: 95, han: 93, ref: 95, kic: 86, pos: 94 } }, // 야신
  'leg-gk-02': { sho: 40, pas: 79, cro: 64, dri: 67, aer: 95, def: 95, phy: 91, gk: { div: 93, han: 94, ref: 93, kic: 82, pos: 96 } }, // 부폰
  'leg-gk-03': { sho: 40, pas: 81, cro: 66, dri: 69, aer: 91, def: 93, phy: 89, gk: { div: 94, han: 90, ref: 96, kic: 83, pos: 91 } }, // 카시야스
  'leg-df-01': { sho: 82, pas: 96, cro: 84, dri: 91, aer: 91, def: 97, phy: 91 }, // 프란츠 베켄바워
  'leg-df-02': { sho: 70, pas: 90, cro: 89, dri: 87, aer: 93, def: 98, phy: 94 }, // 파올로 말디니
  'leg-df-03': { sho: 65, pas: 89, cro: 74, dri: 83, aer: 92, def: 98, phy: 90 }, // 프랑코 바레시
  'leg-df-04': { sho: 58, pas: 83, cro: 68, dri: 80, aer: 93, def: 96, phy: 90 }, // 알레산드로 네스타
  'leg-df-05': { sho: 78, pas: 85, cro: 78, dri: 80, aer: 96, def: 93, phy: 93 }, // 세르히오 라모스
  'leg-df-06': { sho: 90, pas: 86, cro: 94, dri: 89, aer: 74, def: 88, phy: 97 }, // 호베르투 카를루스
  'leg-df-07': { sho: 76, pas: 88, cro: 93, dri: 89, aer: 78, def: 90, phy: 95 }, // 카푸
  'leg-df-08': { sho: 70, pas: 93, cro: 92, dri: 89, aer: 66, def: 95, phy: 83 }, // 필립 람
  'leg-df-09': { sho: 60, pas: 78, cro: 70, dri: 74, aer: 93, def: 94, phy: 94 }, // 카를레스 푸욜
  'leg-mf-01': { sho: 95, pas: 97, cro: 91, dri: 99, aer: 66, def: 50, phy: 88 }, // 디에고 마라도나
  'leg-mf-02': { sho: 92, pas: 96, cro: 89, dri: 98, aer: 75, def: 62, phy: 89 }, // 요한 크루이프
  'leg-mf-03': { sho: 89, pas: 97, cro: 90, dri: 98, aer: 83, def: 71, phy: 84 }, // 지네딘 지단
  'leg-mf-04': { sho: 91, pas: 93, cro: 85, dri: 89, aer: 86, def: 94, phy: 96 }, // 로타어 마테우스
  'leg-mf-05': { sho: 78, pas: 99, cro: 93, dri: 96, aer: 60, def: 79, phy: 75 }, // 사비 에르난데스
  'leg-mf-06': { sho: 82, pas: 98, cro: 90, dri: 99, aer: 58, def: 73, phy: 76 }, // 안드레스 이니에스타
  'leg-mf-07': { sho: 80, pas: 88, cro: 76, dri: 86, aer: 93, def: 94, phy: 97 }, // 파트리크 비에이라
  'leg-mf-08': { sho: 85, pas: 99, cro: 98, dri: 92, aer: 64, def: 77, phy: 72 }, // 안드레아 피를로
  'leg-mf-09': { sho: 80, pas: 86, cro: 85, dri: 86, aer: 75, def: 87, phy: 96 }, // 박지성
  'leg-fw-01': { sho: 98, pas: 98, cro: 94, dri: 99, aer: 70, def: 44, phy: 86 }, // 리오넬 메시
  'leg-fw-02': { sho: 99, pas: 88, cro: 89, dri: 96, aer: 98, def: 47, phy: 98 }, // 크리스티아누 호날두
  'leg-fw-03': { sho: 98, pas: 93, cro: 86, dri: 98, aer: 93, def: 56, phy: 94 }, // 펠레
  'leg-fw-04': { sho: 99, pas: 85, cro: 77, dri: 98, aer: 85, def: 45, phy: 97 }, // 호나우두 (R9)
  'leg-fw-05': { sho: 97, pas: 89, cro: 85, dri: 96, aer: 81, def: 49, phy: 97 }, // 티에리 앙리
  'leg-fw-06': { sho: 90, pas: 95, cro: 91, dri: 99, aer: 70, def: 46, phy: 87 }, // 호나우지뉴
  'leg-fw-07': { sho: 88, pas: 86, cro: 93, dri: 98, aer: 65, def: 45, phy: 88 }, // 가린샤
  'leg-fw-08': { sho: 91, pas: 82, cro: 85, dri: 89, aer: 86, def: 56, phy: 95 }, // 차범근
  'leg-fw-09': { sho: 93, pas: 83, cro: 85, dri: 89, aer: 72, def: 50, phy: 94 }, // 손흥민
  'leg-fw-10': { sho: 97, pas: 84, cro: 75, dri: 88, aer: 94, def: 50, phy: 91 }, // 로베르트 레반도프스키
  'leg-fw-11': { sho: 95, pas: 92, cro: 82, dri: 93, aer: 88, def: 50, phy: 87 }, // 카림 벤제마
  'leg-fw-12': { sho: 97, pas: 88, cro: 82, dri: 92, aer: 87, def: 54, phy: 91 }, // 루이스 수아레스
  'cls-10s-cdm-01': { sho: 65, pas: 97, cro: 80, dri: 90, aer: 80, def: 95, phy: 76 }, // 10s 세르히오 부스케츠
  'cls-10s-cb-01': { sho: 64, pas: 86, cro: 70, dri: 76, aer: 96, def: 95, phy: 95 }, // 10s 버질 판 다이크
  'cls-10s-cm-01': { sho: 83, pas: 98, cro: 94, dri: 96, aer: 62, def: 83, phy: 81 }, // 10s 루카 모드리치
  'cls-10s-cm-02': { sho: 85, pas: 99, cro: 97, dri: 89, aer: 68, def: 81, phy: 74 }, // 10s 토니 크로스
  'cls-10s-cam-01': { sho: 89, pas: 98, cro: 97, dri: 88, aer: 68, def: 69, phy: 82 }, // 10s 케빈 더 브라위너
  'cls-10s-cam-02': { sho: 80, pas: 96, cro: 88, dri: 95, aer: 54, def: 58, phy: 72 }, // 10s 다비드 실바
  'cls-10s-cdm-02': { sho: 71, pas: 87, cro: 75, dri: 87, aer: 70, def: 97, phy: 95 }, // 10s 은골로 캉테
  'cls-10s-cb-03': { sho: 64, pas: 88, cro: 70, dri: 76, aer: 92, def: 91, phy: 82 }, // 10s 제라르 피케
  'cls-10s-rw-03': { sho: 92, pas: 83, cro: 89, dri: 90, aer: 87, def: 60, phy: 97 }, // 10s 가레스 베일
  'cls-00s-st-02': { sho: 93, pas: 79, cro: 74, dri: 82, aer: 96, def: 54, phy: 97 }, // 00s 디디에 드로그바
  'cls-00s-cm-03': { sho: 91, pas: 98, cro: 93, dri: 88, aer: 69, def: 77, phy: 78 }, // 00s 폴 스콜스
  'cls-00s-rw-01': { sho: 86, pas: 96, cro: 99, dri: 82, aer: 70, def: 72, phy: 81 }, // 00s 데이비드 베컴
  'cls-00s-cb-03': { sho: 60, pas: 72, cro: 58, dri: 67, aer: 96, def: 94, phy: 95 }, // 00s 네마냐 비디치
  'cls-90s-cb-04': { sho: 58, pas: 75, cro: 60, dri: 70, aer: 94, def: 93, phy: 96 }, // 90s 야프 스탐
  'cls-80s-mf-01': { sho: 91, pas: 91, cro: 86, dri: 92, aer: 95, def: 82, phy: 97 }, // 80s 뤼트 굴리트
};

/**
 * Curated classic profiles keyed by Korean player name so Era Best XI Dream Match
 * squads (which use `era60-*`..`era10-*` IDs) inherit authentic sub-attributes instead
 * of generic position averages (e.g. 10s Busquets PHY 76 vs 10s Van Dijk PHY 95).
 */
export const CURATED_CLASSIC_BY_NAME: Record<string, PlayerAttributes> = {
  // 10s & Shared Icons
  '세르히오 부스케츠': { sho: 65, pas: 97, cro: 80, dri: 90, aer: 80, def: 95, phy: 76 },
  '버질 판 다이크': { sho: 64, pas: 86, cro: 70, dri: 76, aer: 96, def: 95, phy: 95 },
  '야야 투레': { sho: 89, pas: 90, cro: 82, dri: 88, aer: 90, def: 84, phy: 97 },
  '메수트 외질': { sho: 81, pas: 97, cro: 92, dri: 93, aer: 58, def: 48, phy: 74 },
  '뱅상 콤파니': { sho: 64, pas: 82, cro: 66, dri: 74, aer: 93, def: 93, phy: 94 },
  '루카 모드리치': { sho: 83, pas: 98, cro: 94, dri: 96, aer: 62, def: 83, phy: 81 },
  '안드레스 이니에스타': { sho: 82, pas: 98, cro: 90, dri: 99, aer: 58, def: 73, phy: 76 },
  '토니 크로스': { sho: 85, pas: 99, cro: 97, dri: 89, aer: 68, def: 81, phy: 74 },
  '다비드 실바': { sho: 80, pas: 96, cro: 88, dri: 95, aer: 54, def: 58, phy: 72 },
  '케빈 더 브라위너': { sho: 89, pas: 98, cro: 97, dri: 88, aer: 68, def: 69, phy: 82 },
  '은골로 캉테': { sho: 71, pas: 87, cro: 75, dri: 87, aer: 70, def: 97, phy: 95 },
  '세르히오 라모스': { sho: 78, pas: 85, cro: 78, dri: 80, aer: 96, def: 93, phy: 93 },
  '마르셀루': { sho: 79, pas: 91, cro: 94, dri: 95, aer: 70, def: 86, phy: 87 },
  '다니 알베스': { sho: 80, pas: 91, cro: 94, dri: 92, aer: 72, def: 87, phy: 90 },
  '리오넬 메시': { sho: 98, pas: 98, cro: 94, dri: 99, aer: 70, def: 44, phy: 86 },
  '크리스티아누 호날두': { sho: 99, pas: 88, cro: 89, dri: 96, aer: 98, def: 47, phy: 98 },
  '로베르트 레반도프스키': { sho: 97, pas: 84, cro: 75, dri: 88, aer: 94, def: 50, phy: 91 },
  '루이스 수아레스': { sho: 97, pas: 88, cro: 82, dri: 92, aer: 87, def: 54, phy: 91 },
  '마누엘 노이어': { sho: 40, pas: 90, cro: 76, dri: 78, aer: 94, def: 94, phy: 92, gk: { div: 94, han: 92, ref: 95, kic: 95, pos: 94 } },
  '얀 오블락': { sho: 40, pas: 77, cro: 63, dri: 65, aer: 92, def: 93, phy: 90, gk: { div: 91, han: 93, ref: 92, kic: 78, pos: 93 } },

  // 00s Icons
  '사비 에르난데스': { sho: 78, pas: 99, cro: 93, dri: 96, aer: 60, def: 79, phy: 75 },
  '안드레아 피를로': { sho: 85, pas: 99, cro: 98, dri: 92, aer: 64, def: 77, phy: 72 },
  '지네딘 지단': { sho: 89, pas: 97, cro: 90, dri: 98, aer: 83, def: 71, phy: 84 },
  '파트리크 비에이라': { sho: 80, pas: 88, cro: 76, dri: 86, aer: 93, def: 94, phy: 97 },
  '디디에 드로그바': { sho: 93, pas: 79, cro: 74, dri: 82, aer: 96, def: 54, phy: 97 },
  '티에리 앙리': { sho: 97, pas: 89, cro: 85, dri: 96, aer: 81, def: 49, phy: 97 },
  '호나우지뉴': { sho: 90, pas: 95, cro: 91, dri: 99, aer: 70, def: 46, phy: 87 },
  '카카': { sho: 91, pas: 92, cro: 86, dri: 95, aer: 74, def: 54, phy: 94 },
  '필립 람': { sho: 70, pas: 93, cro: 92, dri: 89, aer: 66, def: 95, phy: 83 },
  '알레산드로 네스타': { sho: 58, pas: 83, cro: 68, dri: 80, aer: 93, def: 96, phy: 90 },
  '파비오 칸나바로': { sho: 54, pas: 76, cro: 65, dri: 74, aer: 94, def: 96, phy: 91 },
  '애슐리 콜': { sho: 68, pas: 86, cro: 90, dri: 88, aer: 73, def: 94, phy: 94 },
  '마이콩': { sho: 82, pas: 85, cro: 91, dri: 87, aer: 82, def: 88, phy: 96 },
  '미하엘 발락': { sho: 89, pas: 90, cro: 84, dri: 84, aer: 91, def: 84, phy: 93 },
  '뤼트 판 니스텔로이': { sho: 96, pas: 76, cro: 68, dri: 83, aer: 92, def: 45, phy: 89 },
  '잔루이지 부폰': { sho: 40, pas: 79, cro: 64, dri: 67, aer: 95, def: 95, phy: 91, gk: { div: 93, han: 94, ref: 93, kic: 82, pos: 96 } },
  '이케르 카시야스': { sho: 40, pas: 81, cro: 66, dri: 69, aer: 91, def: 93, phy: 89, gk: { div: 94, han: 90, ref: 96, kic: 83, pos: 91 } },
  '폴 스콜스': { sho: 91, pas: 98, cro: 93, dri: 88, aer: 69, def: 77, phy: 78 },
  '데이비드 베컴': { sho: 86, pas: 96, cro: 99, dri: 82, aer: 70, def: 72, phy: 81 },

  // 90s Icons
  '호나우두 (R9)': { sho: 99, pas: 85, cro: 77, dri: 98, aer: 85, def: 45, phy: 97 },
  '파올로 말디니': { sho: 70, pas: 90, cro: 89, dri: 87, aer: 93, def: 98, phy: 94 },
  '호베르투 카를루스': { sho: 90, pas: 86, cro: 94, dri: 89, aer: 74, def: 88, phy: 97 },
  '카푸': { sho: 76, pas: 88, cro: 93, dri: 89, aer: 78, def: 90, phy: 95 },
  '마티아스 잠머': { sho: 76, pas: 89, cro: 78, dri: 84, aer: 90, def: 94, phy: 92 },
  '페르난도 레돈도': { sho: 74, pas: 94, cro: 82, dri: 92, aer: 82, def: 91, phy: 84 },
  '로이 킨': { sho: 78, pas: 89, cro: 76, dri: 83, aer: 86, def: 94, phy: 96 },
  '라이언 긱스': { sho: 84, pas: 89, cro: 95, dri: 94, aer: 66, def: 58, phy: 90 },
  '로베르토 바조': { sho: 93, pas: 93, cro: 87, dri: 97, aer: 66, def: 46, phy: 77 },
  '루이스 피구': { sho: 88, pas: 92, cro: 95, dri: 95, aer: 73, def: 56, phy: 84 },
  '릴리앙 튀람': { sho: 68, pas: 84, cro: 85, dri: 83, aer: 90, def: 95, phy: 96 },
  '미카엘 라우드루프': { sho: 86, pas: 97, cro: 89, dri: 96, aer: 68, def: 52, phy: 79 },
  '흐리스토 스토이치코프': { sho: 94, pas: 86, cro: 85, dri: 93, aer: 78, def: 50, phy: 90 },
  '호마리우': { sho: 98, pas: 84, cro: 74, dri: 96, aer: 79, def: 43, phy: 88 },
  '페테르 슈마이켈': { sho: 40, pas: 80, cro: 66, dri: 68, aer: 94, def: 93, phy: 93, gk: { div: 93, han: 92, ref: 94, kic: 84, pos: 92 } },
  '에드윈 판 데르 사르': { sho: 40, pas: 84, cro: 70, dri: 72, aer: 92, def: 91, phy: 89, gk: { div: 90, han: 92, ref: 91, kic: 88, pos: 93 } },

  // 80s Icons
  '디에고 마라도나': { sho: 95, pas: 97, cro: 91, dri: 99, aer: 66, def: 50, phy: 88 },
  '프랑코 바레시': { sho: 65, pas: 89, cro: 74, dri: 83, aer: 92, def: 98, phy: 90 },
  '로타어 마테우스': { sho: 91, pas: 93, cro: 85, dri: 89, aer: 86, def: 94, phy: 96 },
  '미셸 플라티니': { sho: 94, pas: 97, cro: 93, dri: 92, aer: 74, def: 58, phy: 78 },
  '마르코 판 바스턴': { sho: 98, pas: 85, cro: 78, dri: 90, aer: 95, def: 48, phy: 89 },
  '뤼트 굴리트': { sho: 91, pas: 91, cro: 86, dri: 92, aer: 95, def: 82, phy: 97 },
  '프랑크 레이카르트': { sho: 78, pas: 90, cro: 78, dri: 84, aer: 93, def: 94, phy: 95 },
  '지쿠': { sho: 93, pas: 96, cro: 94, dri: 95, aer: 70, def: 52, phy: 77 },
  '카를하인츠 루메니게': { sho: 95, pas: 87, cro: 85, dri: 94, aer: 83, def: 52, phy: 93 },
  '로날드 쿠만': { sho: 91, pas: 94, cro: 90, dri: 79, aer: 89, def: 91, phy: 83 },
  '안드레아스 브레메': { sho: 82, pas: 90, cro: 95, dri: 86, aer: 78, def: 91, phy: 89 },
  '주세페 베르고미': { sho: 62, pas: 80, cro: 76, dri: 76, aer: 90, def: 94, phy: 91 },
  '소크라테스': { sho: 85, pas: 96, cro: 86, dri: 92, aer: 82, def: 66, phy: 80 },
  '안토니오 카브리니': { sho: 74, pas: 84, cro: 90, dri: 84, aer: 78, def: 91, phy: 90 },
  '하랄트 슈마허': { sho: 40, pas: 74, cro: 60, dri: 62, aer: 92, def: 91, phy: 91, gk: { div: 91, han: 89, ref: 92, kic: 78, pos: 90 } },

  // 70s & 60s Icons
  '요한 크루이프': { sho: 92, pas: 96, cro: 89, dri: 98, aer: 75, def: 62, phy: 89 },
  '프란츠 베켄바워': { sho: 82, pas: 96, cro: 84, dri: 91, aer: 91, def: 97, phy: 91 },
  '게르트 뮐러': { sho: 99, pas: 78, cro: 66, dri: 88, aer: 95, def: 46, phy: 89 },
  '디노 조프': { sho: 40, pas: 76, cro: 62, dri: 64, aer: 93, def: 93, phy: 89, gk: { div: 91, han: 93, ref: 91, kic: 79, pos: 95 } },
  '제프 마이어': { sho: 40, pas: 78, cro: 64, dri: 66, aer: 93, def: 93, phy: 90, gk: { div: 93, han: 92, ref: 94, kic: 80, pos: 92 } },
  '루드 크롤': { sho: 72, pas: 89, cro: 88, dri: 85, aer: 86, def: 93, phy: 90 },
  '가에타노 시레아': { sho: 64, pas: 90, cro: 74, dri: 83, aer: 89, def: 95, phy: 85 },
  '카를루스 아우베르투': { sho: 80, pas: 88, cro: 92, dri: 87, aer: 82, def: 91, phy: 92 },
  '요한 네스컨스': { sho: 84, pas: 90, cro: 82, dri: 87, aer: 84, def: 90, phy: 95 },
  '파울 브라이트너': { sho: 84, pas: 91, cro: 84, dri: 86, aer: 80, def: 88, phy: 91 },
  '로베르토 히벨리누': { sho: 92, pas: 94, cro: 92, dri: 95, aer: 66, def: 52, phy: 82 },
  '자이르지뉴': { sho: 92, pas: 84, cro: 86, dri: 93, aer: 82, def: 52, phy: 94 },
  '귄터 네처': { sho: 85, pas: 97, cro: 92, dri: 90, aer: 72, def: 62, phy: 78 },
  '베르티 포크츠': { sho: 62, pas: 78, cro: 76, dri: 76, aer: 86, def: 94, phy: 93 },
  '마리오 켐페스': { sho: 94, pas: 84, cro: 78, dri: 91, aer: 86, def: 48, phy: 90 },
  '케빈 키건': { sho: 90, pas: 87, cro: 84, dri: 92, aer: 78, def: 56, phy: 92 },
  '펠레': { sho: 98, pas: 93, cro: 86, dri: 98, aer: 93, def: 56, phy: 94 },
  '레프 야신': { sho: 40, pas: 83, cro: 69, dri: 71, aer: 95, def: 95, phy: 92, gk: { div: 95, han: 93, ref: 95, kic: 86, pos: 94 } },
  '가린샤': { sho: 88, pas: 86, cro: 93, dri: 98, aer: 65, def: 45, phy: 88 },
  '자친토 파케티': { sho: 76, pas: 85, cro: 89, dri: 84, aer: 88, def: 93, phy: 94 },
  '보비 무어': { sho: 62, pas: 90, cro: 76, dri: 82, aer: 90, def: 96, phy: 86 },
  '체사레 말디니': { sho: 56, pas: 82, cro: 70, dri: 76, aer: 91, def: 94, phy: 89 },
  '자우마 산투스': { sho: 72, pas: 85, cro: 89, dri: 84, aer: 84, def: 93, phy: 92 },
  '루이스 수아레스 미라몬테스': { sho: 83, pas: 96, cro: 90, dri: 92, aer: 72, def: 81, phy: 80 },
  '보비 찰턴': { sho: 94, pas: 94, cro: 88, dri: 92, aer: 76, def: 68, phy: 88 },
  '잔니 리베라': { sho: 85, pas: 96, cro: 90, dri: 94, aer: 62, def: 56, phy: 76 },
  '조지 베스트': { sho: 91, pas: 89, cro: 88, dri: 98, aer: 72, def: 48, phy: 89 },
  '에우제비우': { sho: 96, pas: 84, cro: 80, dri: 94, aer: 86, def: 50, phy: 96 },
  '고든 뱅크스': { sho: 40, pas: 75, cro: 60, dri: 62, aer: 92, def: 93, phy: 89, gk: { div: 93, han: 92, ref: 95, kic: 77, pos: 92 } },
  '닐톤 산투스': { sho: 74, pas: 86, cro: 90, dri: 86, aer: 80, def: 91, phy: 90 },
  '산드로 마촐라': { sho: 89, pas: 92, cro: 86, dri: 92, aer: 70, def: 58, phy: 84 },
  '데니스 로': { sho: 95, pas: 79, cro: 72, dri: 89, aer: 91, def: 46, phy: 88 },
};
