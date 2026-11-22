import type { PlayerAttributes } from '../types/player';

/**
 * Curated real-football sub-attribute profiles for 5-league stars and all 33 all-time legends.
 * - Avoids artificial extreme nerfs: creative wingers/inside forwards (Yamal, Olise, Saka, Salah,
 *   Vinicius, Kvaratskhelia, Raphinha, Palmer, Musiala, Wirtz) retain high SHO alongside elite
 *   PAS/CRO/DRI so they both score goals and create high assist volume naturally.
 * - Every other player in the 2,239-player database receives a rich archetype-driven profile
 *   via `attributeEngine.ts` based on mainPositions, playstyles, OVR, and att/mid/def.
 */
export const CURATED_ATTRIBUTE_OVERRIDES: Record<string, PlayerAttributes> = {
  // ============================================================================
  // ACTIVE SUPERSTARS & ARCHETYPE BENCHMARKS
  // ============================================================================
  // 라민 야말 (RW, OVR 94) - 크랙 & 찬스메이커 윙어: 최고 수준 드리블·패스·크로스 + 준수한 감아차기 결정력
  'act-004': { sho: 88, pas: 94, cro: 93, dri: 97, aer: 56, def: 52, phy: 85 },
  // 킬리안 음바페 (ST/LW, OVR 94) - 폭발적 스피드·라인브레이킹·결정력
  'act-001': { sho: 95, pas: 84, cro: 80, dri: 95, aer: 74, def: 48, phy: 97 },
  // 해리 케인 (ST, OVR 93) - 완성형 9번: 최고 결정력·헤더 + 2선급 롱패스·스루패스 연계력
  'act-002': { sho: 96, pas: 90, cro: 82, dri: 83, aer: 91, def: 58, phy: 86 },
  // 엘링 홀란 (ST, OVR 93) - 괴물 타겟/포처 9번: 압도적 골 결정력·공중볼·피지컬
  'act-006': { sho: 97, pas: 73, cro: 60, dri: 80, aer: 94, def: 52, phy: 96 },
  // 로드리 (CDM/CM, OVR 93) - 중원 지배자: 탈압박·패스·수비·중거리 클러치
  'act-003': { sho: 84, pas: 95, cro: 82, dri: 87, aer: 88, def: 93, phy: 90 },
  // 마이클 올리세 (RW/CAM, OVR 92) - 왼발 감아차기 크로스·스루패스·드리블·컷인 슈팅 겸비
  'act-017': { sho: 87, pas: 93, cro: 94, dri: 93, aer: 58, def: 56, phy: 82 },
  // 페드리 (CDM/CM, OVR 92) - 천재 플레이메이커: 시야·스루패스·탈압박 드리블
  'act-022': { sho: 79, pas: 96, cro: 85, dri: 93, aer: 62, def: 84, phy: 78 },
  // 주드 벨링엄 (CAM/CM, OVR 92) - 박스 침투 클러치 미드필더
  'act-008': { sho: 90, pas: 90, cro: 82, dri: 91, aer: 85, def: 82, phy: 92 },
  // 비티냐 (CM/CDM, OVR 92) - 후방 빌드업·전진 드리블·중거리
  'act-007': { sho: 83, pas: 95, cro: 86, dri: 92, aer: 64, def: 84, phy: 81 },
  // 우스만 뎀벨레 (RW/ST, OVR 92) - 양발 크랙 드리블러 & 크로스·슈팅
  'act-005': { sho: 86, pas: 88, cro: 91, dri: 96, aer: 60, def: 50, phy: 91 },
  // 부카요 사카 (RW/CAM, OVR 91) - 정교한 크로스·컷백·인사이드 슛의 밸런스 크랙
  'act-027': { sho: 88, pas: 90, cro: 92, dri: 92, aer: 64, def: 64, phy: 86 },
  // 비니시우스 주니오르 (LW/ST, OVR 91) - 폭발적 측면 1대1 돌파·원맨골·컷백
  'act-016': { sho: 89, pas: 85, cro: 84, dri: 96, aer: 62, def: 48, phy: 94 },
  // 흐비차 크바라츠헬리아 (LW/RW, OVR 91) - 변칙 드리블 쇼·컷인 슈팅·창조적 패스
  'act-009': { sho: 88, pas: 89, cro: 88, dri: 95, aer: 66, def: 56, phy: 87 },
  // 아슈라프 하키미 (RB, OVR 91) - 초고속 오버래핑 윙백
  'act-012': { sho: 80, pas: 86, cro: 91, dri: 89, aer: 75, def: 86, phy: 96 },
  // 데클런 라이스 (CDM/CM, OVR 91) - 중원 장악·세트피스 킥·박스 투 박스
  'act-011': { sho: 80, pas: 89, cro: 88, dri: 84, aer: 87, def: 92, phy: 93 },
  // 윌리엄 살리바 (CB, OVR 91) - 침착한 대인 수비·스피드·빌드업
  'act-014': { sho: 55, pas: 84, cro: 62, dri: 78, aer: 90, def: 94, phy: 92 },
  // 가브리엘 마갈량이스 (CB, OVR 91) - 세트피스 헤더 폭격기 & 철벽 스토퍼
  'act-015': { sho: 64, pas: 78, cro: 58, dri: 72, aer: 95, def: 93, phy: 93 },
  // 자말 무시알라 (CAM/LW, OVR 90) - 좁은 공간 환상 드리블 & 침투 마무리
  'act-021': { sho: 87, pas: 90, cro: 83, dri: 96, aer: 63, def: 65, phy: 82 },
  // 플로리안 비르츠 (CAM/LW, OVR 90) - 창의적 킬패스·하프스페이스 지배자
  'act-020': { sho: 86, pas: 94, cro: 87, dri: 93, aer: 60, def: 66, phy: 81 },
  // 콜 팔머 (CAM/RW, OVR 90) - 냉철한 피니시·스루패스·PK 스페셜리스트
  'act-0023': { sho: 90, pas: 92, cro: 89, dri: 90, aer: 66, def: 58, phy: 81 },
  // 알렉산데르 이사크 (ST, OVR 90) - 유연한 드리블과 정교한 피니시를 겸비한 9번
  'act-0018': { sho: 92, pas: 80, cro: 72, dri: 89, aer: 84, def: 50, phy: 88 },
  // 라우타로 마르티네스 (ST, OVR 90) - 문전 포처 본능·헤더·전방 압박
  'act-018': { sho: 93, pas: 79, cro: 70, dri: 86, aer: 87, def: 58, phy: 88 },
  // 훌리안 알바레스 (ST, OVR 90) - 전방위 압박·연계·중거리·세트피스
  'act-037': { sho: 91, pas: 86, cro: 84, dri: 88, aer: 78, def: 64, phy: 87 },
  // 페데리코 발베르데 (CM/RB/RW, OVR 90) - 대포알 중거리 슛 & 무한 동력 엔진
  'act-023': { sho: 89, pas: 89, cro: 86, dri: 86, aer: 80, def: 87, phy: 95 },
  // 누누 멘데스 (LB, OVR 90) - 폭발적 측면 돌파 & 크로스
  'act-013': { sho: 74, pas: 85, cro: 89, dri: 90, aer: 76, def: 87, phy: 94 },
  // 주앙 네베스 (CM/CDM, OVR 90) - 탈압박·태클·패스 마에스트로
  'act-044': { sho: 78, pas: 91, cro: 82, dri: 89, aer: 76, def: 89, phy: 88 },
  // 요슈아 키미히 (CDM/RB, OVR 89) - 정밀한 얼리 크로스·코너킥·롱패스
  'act-0803': { sho: 79, pas: 94, cro: 94, dri: 85, aer: 75, def: 86, phy: 83 },
  // 마르틴 외데고르 (CM/CAM, OVR 89) - 하프스페이스 스루패스·찬스메이킹의 정점
  'act-024': { sho: 83, pas: 95, cro: 90, dri: 90, aer: 58, def: 74, phy: 78 },
  // 브루노 페르난데스 (CAM/CDM, OVR 89) - 모험적 킬패스·얼리 크로스·중거리·PK
  'act-0031': { sho: 88, pas: 94, cro: 92, dri: 85, aer: 68, def: 72, phy: 84 },
  // 하피냐 (LW/ST, OVR 89) - 침투·왼발 크로스·중거리·강한 압박 활동량
  'act-028': { sho: 89, pas: 87, cro: 90, dri: 89, aer: 68, def: 64, phy: 90 },
  // 버질 판 다이크 (CB, OVR 89) - 공중볼 절대 지배자 & 대각선 롱패스
  'act-025': { sho: 64, pas: 86, cro: 65, dri: 76, aer: 95, def: 92, phy: 91 },
  // 알레산드로 바스토니 (CB, OVR 89) - 왼발 전진 빌드업 & 오버래핑 크로스 센터백
  'act-026': { sho: 62, pas: 89, cro: 82, dri: 80, aer: 88, def: 90, phy: 87 },
  // 니콜로 바렐라 (CM/CAM, OVR 89) - 공수 겸비 박스 투 박스 & 중거리 발리
  'act-032': { sho: 83, pas: 90, cro: 86, dri: 88, aer: 72, def: 85, phy: 90 },
  // 데지레 두에 (RW/LW, OVR 89) - 화려한 드리블 & 찬스메이킹
  'act-069': { sho: 85, pas: 88, cro: 87, dri: 94, aer: 62, def: 58, phy: 86 },
  // 빅토르 요케레스 (ST, OVR 88) - 저돌적 피지컬 돌파 & 양발 박스 폭격
  'act-054': { sho: 92, pas: 77, cro: 68, dri: 84, aer: 86, def: 54, phy: 94 },
  // 필 포든 (CAM/RW, OVR 88) - 퍼스트 터치·컷인 중거리 슛·하프스페이스 연계
  'act-048': { sho: 89, pas: 89, cro: 85, dri: 92, aer: 58, def: 60, phy: 81 },
  // 트렌트 알렉산더아놀드 (RB, OVR 88) - 택배 얼리 크로스·대각선 전환·프리킥
  'act-0269': { sho: 80, pas: 94, cro: 96, dri: 82, aer: 70, def: 80, phy: 82 },
  // 페데리코 디마르코 (LM/LW, OVR 88) - 명품 왼발 얼리 크로스 & 세트피스
  'act-047': { sho: 83, pas: 89, cro: 95, dri: 85, aer: 68, def: 80, phy: 85 },
  // 니코 윌리엄스 (LW, OVR 88) - 폭발적 가속 드리블 & 양발 크로스/슈팅
  'act-0281': { sho: 84, pas: 84, cro: 88, dri: 93, aer: 62, def: 52, phy: 93 },
  // 브래들리 바르콜라 (LW/RW, OVR 88) - 스피드 드리블 돌파 & 컷백/인사이드 피니시
  'act-066': { sho: 85, pas: 84, cro: 85, dri: 92, aer: 65, def: 52, phy: 92 },
  // 루이스 디아스 (LW, OVR 88) - 저돌적 1대1 돌파 & 컷인 슈팅
  'act-053': { sho: 87, pas: 83, cro: 84, dri: 92, aer: 72, def: 58, phy: 89 },
  // 알폰소 데이비스 (LB/LW, OVR 88) - 초음속 오버래핑 & 드리블 돌파
  'act-085': { sho: 73, pas: 83, cro: 86, dri: 91, aer: 75, def: 84, phy: 96 },
  // 도미니크 소보슬라이 (CDM/CAM, OVR 88) - 레이저 중거리 슛 & 프리킥
  'act-0013': { sho: 89, pas: 89, cro: 90, dri: 86, aer: 78, def: 80, phy: 88 },
  // 제레미 도쿠 (LW/CAM, OVR 86) - 유럽 최강 1대1 크랙 드리블러: 폭발적 돌파·컷백·PK 유도
  'act-120': { sho: 79, pas: 83, cro: 85, dri: 96, aer: 54, def: 48, phy: 93 },
  // 케빈 더 브라위너 (CAM/CM, OVR 86) - 패스 마스터: 택배 크로스·킬패스·중거리
  'act-050': { sho: 86, pas: 96, cro: 95, dri: 85, aer: 66, def: 66, phy: 76 },
  // 알레한드로 그리말도 (LWB/LB, OVR 86) - 프리킥·크로스·인사이드 연계 스페셜리스트
  'act-046': { sho: 82, pas: 89, cro: 94, dri: 86, aer: 66, def: 80, phy: 83 },
  // 세루 기라시 (ST, OVR 86) - 타겟형 피니셔 & 제공권
  'act-102': { sho: 90, pas: 76, cro: 62, dri: 80, aer: 90, def: 50, phy: 88 },
  // 마르쿠스 튀람 (ST, OVR 88) - 피지컬·스피드·헤더 겸비 스트라이커
  'act-0518': { sho: 89, pas: 80, cro: 74, dri: 86, aer: 88, def: 56, phy: 92 },

  // Active Elite Goalkeepers
  'act-019': {
    sho: 38,
    pas: 76,
    cro: 58,
    dri: 62,
    aer: 92,
    def: 92,
    phy: 90,
    gk: { div: 93, han: 89, ref: 94, kic: 79, pos: 91 },
  },
  'act-010': {
    sho: 36,
    pas: 78,
    cro: 60,
    dri: 64,
    aer: 93,
    def: 92,
    phy: 90,
    gk: { div: 92, han: 92, ref: 93, kic: 80, pos: 92 },
  },
  'act-072': {
    sho: 40,
    pas: 88,
    cro: 74,
    dri: 74,
    aer: 88,
    def: 90,
    phy: 85,
    gk: { div: 90, han: 89, ref: 91, kic: 92, pos: 90 },
  },
  'act-030': {
    sho: 42,
    pas: 87,
    cro: 72,
    dri: 74,
    aer: 89,
    def: 90,
    phy: 88,
    gk: { div: 90, han: 90, ref: 91, kic: 90, pos: 91 },
  },
  'act-038': {
    sho: 35,
    pas: 76,
    cro: 58,
    dri: 60,
    aer: 90,
    def: 90,
    phy: 88,
    gk: { div: 90, han: 92, ref: 90, kic: 78, pos: 92 },
  },

  // ============================================================================
  // ALL-TIME LEGENDS (33 PLAYERS)
  // ============================================================================
  'leg-gk-01': {
    sho: 42,
    pas: 84,
    cro: 68,
    dri: 72,
    aer: 95,
    def: 95,
    phy: 93,
    gk: { div: 96, han: 94, ref: 96, kic: 88, pos: 95 },
  },
  'leg-gk-02': {
    sho: 38,
    pas: 80,
    cro: 64,
    dri: 68,
    aer: 94,
    def: 94,
    phy: 91,
    gk: { div: 94, han: 94, ref: 94, kic: 83, pos: 96 },
  },
  'leg-gk-03': {
    sho: 38,
    pas: 82,
    cro: 65,
    dri: 70,
    aer: 91,
    def: 93,
    phy: 90,
    gk: { div: 95, han: 90, ref: 96, kic: 84, pos: 92 },
  },
  'leg-df-01': { sho: 82, pas: 95, cro: 84, dri: 90, aer: 91, def: 96, phy: 92 }, // 프란츠 베켄바워
  'leg-df-02': { sho: 70, pas: 89, cro: 88, dri: 86, aer: 93, def: 98, phy: 94 }, // 파올로 말디니
  'leg-df-03': { sho: 66, pas: 88, cro: 74, dri: 83, aer: 92, def: 97, phy: 91 }, // 프랑코 바레시
  'leg-df-04': { sho: 60, pas: 84, cro: 70, dri: 81, aer: 93, def: 96, phy: 91 }, // 알레산드로 네스타
  'leg-df-05': { sho: 82, pas: 85, cro: 80, dri: 82, aer: 97, def: 94, phy: 94 }, // 세르히오 라모스
  'leg-df-06': { sho: 92, pas: 87, cro: 94, dri: 89, aer: 78, def: 88, phy: 96 }, // 호베르투 카를루스
  'leg-df-07': { sho: 80, pas: 89, cro: 94, dri: 90, aer: 80, def: 90, phy: 96 }, // 카푸
  'leg-df-08': { sho: 76, pas: 93, cro: 93, dri: 89, aer: 78, def: 94, phy: 88 }, // 필립 람
  'leg-df-09': { sho: 64, pas: 80, cro: 72, dri: 76, aer: 95, def: 95, phy: 95 }, // 카를레스 푸욜
  'leg-mf-01': { sho: 95, pas: 97, cro: 94, dri: 99, aer: 68, def: 56, phy: 90 }, // 디에고 마라도나
  'leg-mf-02': { sho: 93, pas: 97, cro: 92, dri: 97, aer: 76, def: 64, phy: 88 }, // 요한 크루이프
  'leg-mf-03': { sho: 91, pas: 97, cro: 92, dri: 97, aer: 86, def: 76, phy: 89 }, // 지네딘 지단
  'leg-mf-04': { sho: 91, pas: 93, cro: 86, dri: 89, aer: 88, def: 93, phy: 95 }, // 로타어 마테우스
  'leg-mf-05': { sho: 82, pas: 99, cro: 92, dri: 94, aer: 66, def: 80, phy: 82 }, // 사비 에르난데스
  'leg-mf-06': { sho: 86, pas: 97, cro: 90, dri: 97, aer: 64, def: 74, phy: 83 }, // 안드레스 이니에스타
  'leg-mf-07': { sho: 82, pas: 89, cro: 78, dri: 86, aer: 93, def: 95, phy: 96 }, // 파트리크 비에이라
  'leg-mf-08': { sho: 87, pas: 98, cro: 96, dri: 89, aer: 68, def: 76, phy: 78 }, // 안드레아 피를로
  'leg-mf-09': { sho: 83, pas: 88, cro: 87, dri: 87, aer: 80, def: 89, phy: 96 }, // 박지성
  'leg-fw-01': { sho: 98, pas: 98, cro: 95, dri: 99, aer: 72, def: 52, phy: 92 }, // 리오넬 메시
  'leg-fw-02': { sho: 99, pas: 88, cro: 89, dri: 95, aer: 98, def: 54, phy: 98 }, // 크리스티아누 호날두
  'leg-fw-03': { sho: 98, pas: 94, cro: 88, dri: 97, aer: 92, def: 62, phy: 95 }, // 펠레
  'leg-fw-04': { sho: 98, pas: 85, cro: 78, dri: 97, aer: 84, def: 48, phy: 97 }, // 호나우두 (R9)
  'leg-fw-05': { sho: 96, pas: 89, cro: 88, dri: 95, aer: 82, def: 54, phy: 96 }, // 티에리 앙리
  'leg-fw-06': { sho: 91, pas: 95, cro: 93, dri: 99, aer: 70, def: 52, phy: 89 }, // 호나우지뉴
  'leg-fw-07': { sho: 89, pas: 90, cro: 96, dri: 99, aer: 66, def: 48, phy: 92 }, // 가린샤
  'leg-fw-08': { sho: 94, pas: 84, cro: 89, dri: 91, aer: 90, def: 62, phy: 95 }, // 차범근
  'leg-fw-09': { sho: 94, pas: 86, cro: 87, dri: 91, aer: 78, def: 58, phy: 93 }, // 손흥민
  'leg-fw-10': { sho: 97, pas: 83, cro: 75, dri: 87, aer: 94, def: 54, phy: 92 }, // 로베르트 레반도프스키
  'leg-fw-11': { sho: 94, pas: 91, cro: 82, dri: 91, aer: 90, def: 54, phy: 89 }, // 카림 벤제마
  'leg-fw-12': { sho: 96, pas: 89, cro: 83, dri: 92, aer: 87, def: 58, phy: 91 }, // 루이스 수아레스
};
