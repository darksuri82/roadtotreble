# Road To Treble — CHANGELOG

유럽 5대 리그 · 자국 컵대회 · 36팀 UEFA 챔피언스리그 드래프트 & 전술 시뮬레이션 **Road To Treble**의 전체 버전 변경 이력입니다.  
최신 버전이 상단에 표시됩니다.

---

## v8.13 — 2D xT·정체 감점·능동 압박/커버 섀도우·전반/연장 막판 긴박도 · UCL 전용 승부차기 시각화 · 멀티 챔스 팝업 복원 · 멀티 개막/이적시장 전술 UX · 룰렛 포지션 동적 수정

- **2D 축구 시뮬레이션 무한 공돌리기 방지 & 현대 전술 엔진 고도화 (`src/engine/pitchSimTypes.ts`, `src/engine/pitchTacticalParams.ts`, `src/engine/pitchSimEngine.ts`)**:
  - Karun Singh 12×8 Expected Threat(`XT_GRID_12X8`, `sampleExpectedThreat`)를 도입해 `ΔxT` 기반 전진·하프스페이스·박스 침투 보상을 추가하고, 비전진 패스 누적(`stallPassCount`) 및 점유 정체 타이머(`possessionStallTime`) 기반 **정체 페널티(Stall Decay)**로 안전 패스 감점·`safeRecycle` 강제 오버라이드 해제·전진/스루/전환/탈압박 드리블 가중치 단계적 상승 구현(점유율·티키타카의 2~3회 빌드업 및 삼자 연계 정체성 보존).
  - **능동적 수비 압박 트리거 & 커버 섀도우**: 백패스·측면 터치라인 트랩(`|y - 0.5| > 0.34`)·정체 누적 시 `pressTriggerTimer`를 발동해 압박 반경 확대(`+0.10~0.16`), 압박 인원 `+1명` 증원(최대 4명), 1·2차 압박자의 안전 백패스 각도 차단(Cover Shadow) 및 근접 탈취 압박 강화.
  - **전반·후반·연장 전후반 막판 긴박도 전면 확장 (`computeGameStateUrgency`)**: 정규 후반 막판(`75'~90'+`, `82'+` 극대화)에 더해 **전반 막판(`40'~45'+`)**, **연장 전반 막판(`100'~105'+`)**, **연장 후반 막판(`112'~120'+`, `115'+` 극대화)** 구간까지 공 돌리기를 중단하고 마지막 공격·합산 열세 총공세로 전환.
  - 보너스 보강: `tryInitiateThirdManRun` 및 `B→C` 스루패스에도 박스/파이널 서드 백패스 제한 및 전방 `runTarget` 보간을 적용하고, 고립 상황은 백패스 대신 짧은 드리블·실드 폴백으로 처리.
- **챔피언스리그 전용 브로드캐스트 승부차기(PK) 시각화 (`src/components/common/PenaltyShootoutVisual.tsx`, `src/components/common/SoloLiveScoreboard.tsx`, `src/components/multiplayer/league/MpLiveTicker.tsx`, `src/components/multiplayer/league/MpUclMulticastBoard.tsx`, `src/components/ucl/UclDashboard.tsx`, `src/components/league/LiveMatchBroadcast.tsx`)**:
  - 다크 스타디움 골대·그물·페널티 스팟·다이빙 골키퍼·슈팅 궤적·`GOAL`/`SAVED`/`POST` 미니멀 배지·키커별 `●`/`✕` 스코어보드를 갖춘 `PenaltyShootoutVisual`(`compact`/`broadcast` 2종)을 신설.
  - **UCL 전용 적용**: 싱글 UCL 라이브 자동진행(`SoloLiveScoreboard` `useUclPkVisual`)·UCL 결과 팝업, 멀티 UCL 토너먼트 멀티캐스트(`MpUclMulticastBoard` `penalties` 순차 연출, 방장 `getMpCastDurationMs` 동기화)·멀티 UCL 라이브 티커, **UCL 2D 직접 경기(`LiveMatchBroadcast`)**에 통합. 국내 리그·자국 컵대회 등 타 대회는 기존의 깔끔한 `O`/`X` UI를 유지.
- **멀티리그 챔스 팝업 모달 복원 · 8R 결과 정리 · 개막 전술 정비 팝업 · 이적시장 완료 후 전술 편집 허용 (`src/engine/mpLeagueEngine.ts`, `src/components/multiplayer/league/MpLeagueDashboard.tsx`, `src/components/multiplayer/league/MpLeagueTransferModal.tsx`)**:
  - `MpLeagueDashboard`에서 `MpUclMulticastBoard` `inline` 프롭을 제거해 중앙 팝업 모달로 복원하고, UCL 리그 페이즈 라이브 재생 중에도 중앙 팝업 모달로 진행 후 종료 시 자동 닫힘 처리. `stepUclKnockoutLeg`·토너먼트 `grantMpLeagueConsent` 시 잔존하던 `UCL 리그 페이즈 8R` `ticker`를 `null`로 정리하고, 완료된 리그 페이즈 직전 라운드는 `[지난 라운드 기록 보기]` 접기 토글로 정리.
  - `createMpLeagueSeason` 초기 `flow`를 `consent`(`league-start:${seasonKey}`)로 설정하고 `MpLeagueDashboard`에 개막 전 중앙 팝업(`[전술 수정]` / `[준비 완료]` + 전원 준비 현황)을 신설해 전원 준비 완료 시 1R이 시작되도록 개선(`grantMpLeagueConsent` 리그 단계 지원).
  - `MpLeagueTransferModal`에서 `tacticsLocked = busy`를 트레이드 잠금(`locked = busy || done`)과 분리해 `[이적시장 끝내기]` 클릭 후 다른 감독 대기 중에도 포메이션·전술·선수 교체·빠른 선발을 자유롭게 수정 가능하도록 개선.
- **멀티리그 드래프트 룰렛 `CM` 고정 표시 버그 수정 (`src/engine/mpLeagueDraft.ts`, `src/components/multiplayer/league/MpLeagueDraftBoard.tsx`)**:
  - `resolveMpRouletteTargetDisplay` 헬퍼를 신설하고 `myNextOpenSlot`·`spinnerNextOpenSlot`을 실시간 계산해, 스핀 전·후 모든 라운드(선발 11자리 + 벤치 5자리)의 실제 대상 포지션(`GK`·`CB`·`LB`·`RB`·`CDM`·`CM`·`CAM`·`LW`·`RW`·`ST`)이 룰렛 버튼과 라운드 헤더에 동적으로 바인딩되도록 수정.
- **테스트 (`src/__tests__/v813SimUclRouletteFix.test.ts`, `src/__tests__/v80MultiLeague.test.ts`)**: xT 공간 단조성, 전반/후반/연장 전후반 막판 긴박도, 정체 감점 & 능동 압박 트리거, 멀티리그 개막 준비 팝업 게이트, 멀티 드래프트 룰렛 동적 포지션 바인딩 검증 5건 추가.

---

## v8.12.1 — 2D 매치 시뮬레이션 4대 핵심 버그 근본 수정 (슈팅 사거리·세트피스/역습 연출 일치 · 구역별 백패스 제한 · 막판 긴박도 AI · 단일 공 렌더링 보장)

- **하프라인 뒤 슛 차단 & 이벤트 유형별 2D 사전 연출(Staging) 일치화 (`src/engine/pitchSimEngine.ts`, `src/engine/pitchSimTypes.ts`, `src/components/league/PitchMatch2D.tsx`)**:
  - `MIN_OPEN_PLAY_SHOT_DEPTH = 0.72`(~29m), `MIN_LONG_RANGE_SHOT_DEPTH = 0.68`, `MIN_DIRECT_FK_SHOT_DEPTH = 0.66`, `MIN_BOX_FINISH_SHOT_DEPTH = 0.78` 및 `getMinShotDepthForCue`/`isWithinShootingZone` 물리·AI 가드를 강제해 하프라인 뒤 초장거리 슈팅을 원천 차단.
  - `stageSetPieceFormation`으로 휘슬/장면 전환 시 공을 정확한 위치에 고정 배치하고 22명 포진을 정렬: **PK**(페널티 스팟 `0.885, 0.50` · 키커/GK 1대1 · 나머지 20명 박스 밖), **코너킥**(코너 플래그 · 공격/수비수 박스 내 포진 → 크로스/헤더), **프리킥**(상대 진영 파울 위치 · 4인 수비벽 → 감아차기). 역습(`low_block_counter`/`gegenpress_steal`)은 전방 침투 패스·드리블로 실제 박스 근처(`≥ 0.72`)까지 전진한 뒤 슈팅.
  - `findAgentSlotByIdentity`에 외야수 전용 가드(`excludeGk = true`)와 `save` 이벤트 `scorerId` 우회를 적용해 동명 GK(1대1/드림매치) 환경에서 공격팀 GK가 슈터로 매칭되는 버그 차단.
- **구역별(Zone-based) 패스 판단 & 골대 앞 초장거리 백패스 차단 (`src/engine/pitchSimEngine.ts`)**:
  - 페널티 박스 근접(`carrierDepth ≥ 0.78`)에서 하프라인 뒤(`mateDepth < 0.50`) 및 후진 거리 `> 0.18` 백패스를 하드 필터로 제외하고 컷백·박스 크로스·단거리 레이오프·1대1 컷인 돌파 가중치를 최우선화.
  - 파이널 서드(`0.66..0.78`)에서 하프라인 뒤(`mateDepth < 0.48`) 직행 백패스를 금지하고 최대 `0.22` 이내 2선 단계적 순환만 허용, `isSwitch`에 `forwardDelta ≥ -0.10` 조건을 추가해 깊은 백패스 오분류 제거.
- **경기 막판 시간·스코어 긴박도(Game State Urgency) AI (`src/engine/pitchTacticalParams.ts`, `src/engine/pitchSimEngine.ts`, `src/components/league/PitchMatch2D.tsx`, `src/components/league/LiveMatchBroadcast.tsx`)**:
  - `computeGameStateUrgency` / `applyGameStateUrgencyToDoctrine` 및 `refreshLiveUrgencyDoctrines`(매 분·득점 즉시 재계산, 토너먼트 2차전 `aggHomeBeforeMatch`/`aggAwayBeforeMatch`·`isKnockoutDecider` 연동)를 도입.
  - 75분+(82분+ 강화) 열세 시 `buildUpPatience` 대폭 축소(`safeRecycle` 강제 오버라이드 해제), 전진 스루패스·얼리 크로스·박스 침투·라인 전진·3인 즉각 압박 강화, 85분+ 1골 차 열세 시 CB(슬롯 2)·CM 박스 가담(`cbBoxJoin`) 활성화. 리드 팀은 볼 간수·컴팩트 로우 블록으로 자연 대비.
- **공 2개 분리 렌더링 오류 완전 제거 (`src/engine/pitchSimEngine.ts`, `src/components/league/PitchMatch2D.tsx`)**:
  - 원자적 `resetBallToSpot` 헬퍼 및 `set_piece_setup` 공 잠금(`ownerIdx = null`)으로 `stepDirectorCue`↔`stepBallPhysics` 줄다리기 충돌과 킥오프/세트피스/리스타트 시 잔상·보간 불일치를 원천 제거.
  - `ball.trail`을 비행 중에만 기록하고 `PitchMatch2D.tsx`에서 원형 도트 대신 공 뒤로 가늘어지는 단일 모션 트레일 선(점프 단절 가드 포함)과 통일된 높이 계수(`BALL_Z_LIFT_PX = 9`)를 적용해 4대 화면(싱글·멀티리그·1대1·드림매치) 전원 단일 공 렌더링 보장.
- **테스트 (`src/__tests__/v811Realistic2DSim.test.ts`)**: 4대 버그 회귀 검증 4건 추가(총 14건: PK/코너/FK/역습 스테이징·사거리·동명 GK 가드, 박스/파이널서드 백패스 차단, 토너먼트 합산 열세 긴박도·CB 박스 가담, 단일 공 잔상/보간 무결성).

---

## v8.12 — 글로벌 역대 유저 TOP 15 점수 랭킹 · 랭킹 팀 1대1 도전 매치 · 명예의 전당 자동 등재 기준 상향(6,500+)

- **Supabase 글로벌 역대 TOP 15 원자적 랭킹 & 16위 이하 자동 삭제 (`supabase/schema.sql`, `src/services/globalRankingService.ts`, `src/types/legacy.ts`, `src/types/game.ts`, `src/engine/legacyEngine.ts`)**:
  - `public.global_hof_rankings` 테이블, 동점자 정렬 인덱스(`season_score DESC, is_treble DESC, ucl_won DESC, achieved_at ASC, id ASC`), 공개 `SELECT` 전용 RLS(클라이언트 직접 `INSERT/UPDATE/DELETE` 차단), `pg_advisory_xact_lock` + `SECURITY DEFINER` 기반 원자적 RPC `submit_global_hof_ranking(p_entry jsonb)` 추가 — 신규 기록이 TOP 15 진입 시 16위 이하 기록을 동일 트랜잭션 내에서 즉시 삭제.
  - `SeasonState.runId` 및 `HallOfFameEntry.runId`(`generateSeasonRunId`)를 도입해 DB `UNIQUE(run_id)` 제약과 로컬·클라이언트 중복 제출 가드로 동일 시즌 중복 등재를 차단.
  - 경량 `squad_snapshot` 직렬화(실제 현역/레전드 선수는 ID 기반 최소 메타, 생성 선수는 스탯 폴백 포함) 및 무손실 `reconstructSquadFromGlobalRanking` / `buildGlobalClubForMatch` 구현, Supabase 미연결·오프라인 시 로컬 명전과 싱글플레이 무중단 폴백 보장.
- **명예의 전당 자동 등재 기준 상향(6,500+) & 시즌 종료 TOP 15 축하 팝업 (`src/engine/legacyEngine.ts`, `src/store/GameContext.tsx`, `src/components/legacy/GlobalTop15CelebrationModal.tsx`, `src/components/league/SeasonSummary.tsx`)**:
  - `HOF_AUTO_INDUCTION_MIN_SCORE`를 `5,500` → `6,500`(역대 최강팀 최저 15-16 레스터 시티 6,513점 수준, S+ 7,200점 미만)으로 상향 조정.
  - 싱글플레이 최종 종료(리그 단독 종료 및 챔스 최종 종료 모두 포함) 후 명예의 전당 등재(자동·수동) 시 `submit_global_hof_ranking` RPC를 비동기 실행하고, 신규 TOP 15 진입 시 기존 컵·정규리그 결산 모달 종료 후 순차적으로 `GlobalTop15CelebrationModal` 노출(1회 래치). 미진입 시 실패 팝업 없이 결산 스코어 카드에 현재 15위 커트라인만 간결히 참고 표시.
- **역대 TOP 15 랭킹 보드 UI & `DreamMatchArena` 1대1 도전 연동 (`src/components/legacy/LegacyHubModal.tsx`, `src/components/dream/DreamMatchArena.tsx`, `src/components/setup/TitleScreen.tsx`, `src/components/common/HeaderNav.tsx`)**:
  - `LegacyHubModal`에 `🌍 역대 TOP 15` 탭과 팀 상세 피치/케미/벤치/8항목 점수 미리보기, 로컬 명전 기록의 수동 `[글로벌 도전]` 버튼 추가. 타이틀 보조 바·상단 헤더에서 원클릭 진입 연결.
  - 모든 TOP 15 팀의 `[1대1 대결]` 버튼을 기존 `DreamMatchArena`(전술실 → 2D 리얼리스틱 시뮬레이션 → 하프타임 수싸움 → 연장/PK → 결과)에 직결하고, 도전자 선택에 **현재 진행 중인 시즌 스쿼드** + **내 명예의 전당 팀** 선택 및 미보유 시 간결한 안내 메시지 가드 추가.
- **테스트 (`src/__tests__/v812GlobalTop15Ranking.test.ts`, `src/__tests__/v51PolishAndRebalance.test.ts`, `src/__tests__/v810GuideTutorialAndUx.test.ts`)**: `HOF_AUTO_INDUCTION_MIN_SCORE = 6500`, TOP 15 상한·16위 자동 삭제·중복 `runId`·동점자 타이브레이커, 실제+생성 선수 스냅샷 직렬화/복원 및 `buildGlobalClubForMatch`, `supabase/schema.sql` RLS/RPC 검증 추가.

---

## v8.11 — 리얼리스틱 2D 매치 시뮬레이션 전면 개편 (5대 전술·스탯 완전 통합 · Steering/삼자패스 AI · Fixed-Timestep 정밀 배속 · 결승전 특별 프레임)

- **5대 전술·능력 요소 100% 피치 직결 (`src/engine/pitchSimTypes.ts`, `src/engine/pitchTacticalParams.ts`, `src/engine/pitchSimEngine.ts`)**:
  - **1계층 포메이션 9종 (`FORMATIONS`)**: 공격 빌드업 / 전진 전개 / 수비 블록 / 공격 전환 / 수비 전환 5모드 동적 앵커로 포백·스리백·원톱·투톱·원볼란치·투볼란치·다이아몬드 삼각 구조를 피치 위에서 실시간 구현.
  - **2계층 팀 전술 5종 + 5구역 통합 상성 (`TACTICS`, `evaluateUnifiedTacticalMatchup`)**: `possession` / `gegenpressing` / `counter` / `wingplay` / `balanced`별 `buildUpPatience`·`tempo`·`passLengthBias`·`defensiveLineOffset`·`pressTriggerRadius`·`attackWidthScale`·`thirdManFreq`·`counterSprintUrgency` 직접 제어.
  - **3계층 감독 특성 14종 & 지휘력 OVR (`MANAGER_TRAITS`, `aiManagers.ts`)**: 유저·AI·역대 강팀 감독의 14종 특성 전수 매핑(`tiki_taka` ~ `super_sub`) 및 지휘력 OVR 기반 침착성·라인 규율·후반/빅매치 보정 직결.
  - **4계층 플레이스타일 14종 (`PLAYSTYLES`)**: `line_breaker` ~ `shot_stopper` 전 스타일의 오프더볼 동선(뒷공간 침투·하프스페이스 컷인·터치라인 유지·오버랩·박스 침투·2선 드롭·스위퍼 키퍼) 및 온더볼 판단 가중치 분기.
  - **5계층 세부 능력치(필드 7 + GK 5) · 4색 케미/시너지 행렬 · 실시간 체력 (`attributeEngine.ts`, `chemistryEngine.ts`, `staminaEngine.ts`)**: 11×11 인접 시너지 행렬 기반 연계·삼자패스 보너스, 능력치별 최고 속도/가속도/롱패스 시야/드리블/인터셉트 반경, 실시간 체력 저하에 따른 스피드·복귀력 감소 및 후반 교체 선수 속도 우위 시각화.
- **진짜 축구 AI 아키텍처 & Director 하이라이트 연동 (`src/engine/pitchSimEngine.ts`, `src/components/league/PitchMatch2D.tsx`)**:
  - Craig Reynolds Steering(`Arrive`, `Pursuit`, `Separation`) + 회전 관성으로 급발진·칼각 꺾기·동료 뭉침 완전 해소 및 3D 궤적 볼 물리(`ground_pass`, `through_ball`, `long_switch`, `cross`, `shot`, `carry`, `loose`) 구현.
  - Buckland/Spearman 공간 인식(7후보 Support Spot + 패스 레인 인터셉트 안전도) 기반 인내심 있는 볼 재순환(Recycling) 및 명시적 `A → B → C` 삼자패스(Third-Man Run) 상태 머신 도입.
  - `matchEngine.ts` 기존 밸런스·통계·테스트를 100% 보존하면서 10종 하이라이트 패턴·14종 공격 루트·6종 결과를 텔레포트·스포일러 없이 자연스럽게 전개.
  - Mulberry32 결정론적 시드 PRNG로 멀티플레이 참가자·관전자 전원의 2D 프레임 완벽 일치 보장.
- **Fixed-Timestep Accumulator 정밀 배속 · 4대 화면 호환 · 결승전 특별 프레임 (`src/components/league/PitchMatch2D.tsx`, `src/components/league/LiveMatchBroadcast.tsx`, `src/types/mpLeague.ts`, `src/engine/mpLeagueEngine.ts`, `src/components/multiplayer/league/MpLeagueH2HView.tsx`, `src/components/multiplayer/MultiplayerArena.tsx`, `src/components/dream/DreamMatchArena.tsx`)**:
  - Glenn Fiedler Fixed-Timestep Accumulator(`FIXED_DT = 1/60s`, `MAX_FRAME_DELTA = 0.05s`, `SIM_SECONDS_PER_MATCH_MINUTE = 1.2s`) 적용으로 `1x / 2x / 4x` 배속 시 물리 스킵 0건 및 정확한 `1 : 2 : 4` 재생 시간(1배속 90분 약 2분 05초) 구현.
  - 배속 정책 적용: 싱글·드림매치 `1x/2x/4x` 자유 전환(기본 `1x`), 1대1 멀티 `1x` 고정, 멀티리그 맞대결은 자국 컵 결승·UCL 결승 `1x` 고정 / 그 외 맞대결 `2x` 고정.
  - 싱글·멀티 자국 컵 결승(`cup_final`) 및 UCL 결승(`ucl_final`) 전용 골드 헤어라인 테두리·코너 브래킷·상단 `CUP FINAL`/`UCL FINAL` 배지 추가.
- **테스트 (`src/__tests__/v811Realistic2DSim.test.ts`, `src/__tests__/v80MultiLeague.test.ts`)**: 결정론적 리플레이, Fixed-Timestep 1:2:4 패리티, 9포메이션·5전술·14감독·14플레이스타일·세부능력치/체력, 패스 레인 안전도, 45분 Director 하이라이트·라이브 교체 핫싱크, 결승 테마 및 오픈플레이 재순환/삼자패스 통계 검증 10건 추가.

---

## v8.10.1 — 가이드북 팀 케미(0~100) 구조 & 실전 가이드라인 신설

- **팀 케미 전용 가이드라인 & 엔진 상수 단일화 (`src/engine/chemistryEngine.ts`, `src/components/guide/SystemGuideModal.tsx`, `src/__tests__/v810GuideTutorialAndUx.test.ts`)**:
  - `chemistryEngine.ts`에서 팀 케미 가중치·기준선·보정 상수(`TEAM_CHEMISTRY_LINE_WEIGHTS`, `TEAM_CHEMISTRY_NEUTRAL_SCORE`, `TEAM_CHEMISTRY_MIN_BONUS`, `TEAM_CHEMISTRY_MAX_RAW_BONUS`, `TEAM_CHEMISTRY_ORG_BONUS_CAP`, `TEAM_CHEMISTRY_SYNERGY_DEDUCT_RATIO`)를 공식 export해 엔진 계산과 가이드북이 동일한 상수를 참조하도록 단일화.
  - 가이드북 2번 탭(`케미·시너지·감독`)에 **팀 케미 (0~100) 구조 & 실전 가이드라인** 카드를 신설해 ① 4색 선별 팀 케미 가중치 차이(`구단 ×1.25 · 국적 ×1.0 · 스타일 ×1.0 · 엘리트 88+ ×0.45`)와 설계 의도, ② 0~49점 페널티 구간 / 50~79점 중복 차감(`평균 시너지×0.75`) 구간 / 80~100점 팀 조직력 최대 `+0.8` 및 명예의 전당 가산점(56점 이상 최대 `+440`), ③ 실전 팀 케미 육성 3원칙을 한눈에 정리.

---

## v8.10 — 가이드북 100% 엔진 동기화 · 가독성 개편 · 싱글 5단계 비주얼 튜토리얼 · 인게임 `?` 컨텍스트 도움말 & 논-클러터 편의 UX

- **가이드북 · 전술 도감 · `?` 팝오버 100% 엔진 동기화 (`src/components/guide/SystemGuideModal.tsx`, `src/components/guide/InjuryMoraleGuideContent.tsx`, `src/components/guide/AttributeRoutesGuideContent.tsx`, `src/components/common/TacticsGuideModal.tsx`, `src/components/draft/DraftScreen.tsx`)**:
  - 구버전 수치 12건 전수 청산: 실효 OVR 시너지 보너스 `+0 ~ +3` → 인접 시너지 `+0 ~ +3` + 독립 감독 궁합 `★+1`(합산 최대 `+4`), 경상 출전 강행 페널티 부상 유형별 고정 `-2~-4` 및 4% 악화 분기(30% 중상 격상 / 70% +2경기 연장), 치명적 중상 명칭 통일(`SEVERITY_LABELS`), 토탈 풋볼 포지션 페널티 `0 / -2 / -8`(GK `-15`), 9종 포메이션 + 2단계 통합 전술 수싸움, 14종 감독 직접 선택·빌드업/스페셜리스트 구분, 체력(`staminaEngine.ts`)·교체 5명·조커(+1.4/+3.0) 섹션 신설, NBA식 패키지 트레이드(TP·니즈·통합세·급매·역제안)·자유 벤치·라이브 자동진행(5/7/9초)·UCL 36팀·명예의 전당 24팀·멀티 리그 규칙 전면 현행화, `DraftScreen` `? 공식` 팝오버 최신화, `TacticsGuideModal` 스타일 궁합 21쌍 전체 표시.
  - 핵심 상수(`ELITE_PAIR_MIN_OVR`, `DEFAULT_ROULETTE_LEGEND_RATE`, `TOP4_TRANSFER_LEGEND_RATE`, `UCL_CHAMPION_LEGEND_RATE`, `ATTEMPTS_PER_WINDOW`, `HOF_AUTO_INDUCTION_MIN_SCORE`, `MP_H2H_MAX_POINTS`, `MAX_MATCH_SUBS`, `TACTIC_STAMINA_MULT`, `SEVERITY_LABELS`, `ACTIVE_PLAYERS`/`LEGEND_PLAYERS`, `HISTORICAL_BENCHMARK_TEAMS`, `ALL_MANAGER_EVENTS`)를 엔진에서 직접 참조해 향후 불일치를 원천 차단.
  - 전역 `break-keep`(`word-break: keep-all`)·상태 배지 `whitespace-nowrap`·테이블 최소 폭·하단 여유 패딩(`pb-8`) 적용 및 `SystemGuideModal` 감독 목록 중첩 스크롤(`max-h-56 overflow-y-auto`) 제거로 PC·모바일 한글 쪼개짐·문구 잘림·이중 스크롤 완전 해소.
- **싱글플레이 5단계 비주얼 튜토리얼 신설 (`src/components/guide/SoloVisualTutorialModal.tsx`, `src/components/guide/guideNavigation.ts`, `src/components/setup/TitleScreen.tsx`, `src/components/common/HeaderNav.tsx`)**:
  - 타이틀 화면 `[새 시즌 시작]` 최초 진입 시 다크 톤 커스텀 SVG·미니 UI 일러스트 중심의 5단계 비주얼 튜토리얼(목표 → 감독 → 드래프트·4색 시너지 → 전술·라이브·이적 → `?`·가이드북 안내)을 제공.
  - `X` 닫기, `[바로 시작]` 스킵, `[다음부터 보지 않기]`(`localStorage` `rtt_solo_tutorial_dismissed_v1`), 상단 클릭 스텝 바, 키보드 화살표/모바일 좌우 스와이프, 타이틀·가이드북 상단 `[입문 튜토리얼]` 재실행 버튼 완비.
- **인게임 `?` 컨텍스트 도움말 고도화 & 논-클러터 편의 UX 6종 (`src/components/common/InfoHelpButton.tsx`, `src/components/common/PitchBoard.tsx`, `src/components/common/PlayerCard.tsx`, `src/components/draft/RouletteReelsView.tsx`, `src/components/draft/DraftScreen.tsx`, `src/components/league/MatchDayTacticsRoom.tsx`, `src/components/common/UnifiedTacticsStrip.tsx`, `src/components/setup/ManagerRouletteScreen.tsx`, `src/components/transfer/TransferMarketModal.tsx`, `src/components/multiplayer/league/MpLeagueTransferModal.tsx`, `src/components/league/SeasonDashboard.tsx`, `src/components/ucl/UclDashboard.tsx`, `src/components/multiplayer/league/MpLeagueDashboard.tsx`, `src/components/legacy/LegacyHubModal.tsx`, `src/components/common/PlayerDetailModal.tsx`)**:
  - `InfoHelpButton`에 모바일 뷰포트 자동 클램핑(`useLayoutEffect`), `pointerdown` 외부 탭 닫기, 하단 `[가이드북 · 해당 탭 →]` 딥링크(`openSystemGuide`)를 추가하고 감독 선택·드래프트·피치·전술실·이적시장·리그/UCL/멀티 대시보드·명예의 전당 적재적소에 배치.
  - 피치 상단 `케미` 배지 옆 4색 연결선·조직력 보정 팝오버 및 선택 선수 `[내역]` 실효 OVR 분해 팝오버(시너지/감독 궁합 분리 표기) 추가.
  - 드래프트 후보 카드에 현재 슬롯 배치 시 예상 인접 연결선 수(`🔗 N선`) 미세 칩 표시(0선 시 미표시).
  - 매치데이 전술실 `[비교]` `?` 팝오버로 현재 상대 기준 5대 전술 완성도·5구역 `▲/▼` 1클릭 비교 및 즉시 적용 지원.
  - 이적시장 `[니즈 강조]` 토글 및 성사 확률 옆 TP·다인 통합세·니즈·급매 분해 `?` 팝오버 추가.
  - 감독 선택 화면 `[전체 14 | 빌드업·전술형 8 | 스페셜리스트 6]` 필터 및 하단 선택 바 궁합 플레이스타일 칩 미리보기 추가.
- **테스트 (`src/__tests__/v810GuideTutorialAndUx.test.ts`)**: 가이드북 구버전 문구 0건 · 중첩 스크롤 0건 · 엔진 상수 정합성 · 토탈 풋볼 0/-2/-8 · 개인 최대 +4 분해 · 튜토리얼/가이드 네비게이션 회귀 검증 추가.

---

## v8.7 — 챔스 1·2차전 전술 정비·생존자 한정 준비완료 · 0ms 즉시 반응 최적화 · 공용 실시간 대진표 · 이적시장 원본 피치 통일

- **챔스 1차전↔2차전 전술 준비 & 멀티 생존자 한정 준비 완료 (`src/types/mpLeague.ts`, `src/engine/mpLeagueEngine.ts`, `src/components/multiplayer/league/useMpLeagueHost.ts`, `src/components/multiplayer/league/MpLeagueDashboard.tsx`, `src/components/ucl/UclDashboard.tsx`)**:
  - `uclConsentedStage`를 스테이지+차전 단위(`${stage}:leg${leg}`)로 세분화하고 `buildUclConsentFlow` / `humansAliveInUcl`을 도입해 1차전 종료 후 2차전 진입 전에도 전술 정비 및 준비 완료 대기를 거치도록 개편(싱글 `UclDashboard`도 1차전 종료 모달 `전술 정비 · 2차전 준비` 및 `2차전 시작 (2D 중계)` / `2차전 스킵` CTA 명확화).
  - 멀티리그 토너먼트 단계·차전 전환 시 탈락자를 제외하고 `requiredClubIds`(현재 챔스 생존자) 전원만 `[준비 완료]`를 누르면 즉시 진행(`생존자 준비 X/Y` 배지, 탈락자는 관전 표시). 생존자 0명(전원 탈락) 시 `allEliminated: true`로 방장에게 `[남은 토너먼트 진행]` 버튼을 제공해 소프트락 방지.
- **준비 완료 0ms 반응 & 멀티플레이 전역 병목 최적화 (`src/components/multiplayer/league/MpLeagueRoot.tsx`, `src/components/multiplayer/league/useMpLeagueHost.ts`, `src/services/multiplayerService.ts`, `src/components/multiplayer/league/MpUclMulticastBoard.tsx`)**:
  - `endMpLeagueCast`·리그페이즈 8R 종료·`closeMpLeagueSummary`·H2H 종료 직후 다음 `consent`로 즉시 직행(인공 5~9초 `autoMs` 대기 제거, `getMpCastDurationMs` 잔여 대기 단축).
  - `MpLeagueBroadcastEvent` `player_signal`에 `ackKey`·`lock`을 실어 DB 응답 대기 전 0ms 낙관적 UI 반영 + Broadcast 즉시 전파(`optimisticAckByPlayerRef`·`optimisticLockByPlayerRef`를 `consent`·`summary`·`transfer`·`h2h` 전 구간 공통 적용).
  - `subscribeToRoom` 전체 방 폴링을 2초→6초(+`visibilitychange` 즉시 갱신)로 완화, Broadcast `live_updated` 직후 중복 `fetchLeagueRev` 억제, `MpUclMulticastBoard` 78ms 타이머 체인을 월클럭 `requestAnimationFrame` + 백그라운드 워치독으로 전환.
- **싱글·멀티 공용 실시간 토너먼트 대진표 & 스포일러 원천 차단 (`src/components/ucl/UclBracketTree.tsx`, `src/components/multiplayer/league/MpUclMulticastBoard.tsx`, `src/components/multiplayer/league/MpLeagueDashboard.tsx`, `src/components/ucl/UclDashboard.tsx`)**:
  - `UclBracketTree`를 싱글·멀티 공용 실시간 대진표로 개편(`LiveTieOverlay` LIVE 배지·실시간 득점/합산, 현재 라운드 강조, 멀티 참가자 커스텀 팀명·유니폼·닉네임/H2H 배지, 모바일 라운드별 빠른 탭 + `[전체 트리]` 가로 스크롤 전환).
  - `MpCastLive`에 `prevUclTies`·`prevUclStage`·`prevUclKnockoutLeg`·`prevUclChampionTeamId` 스냅샷과 `tieId`를 포함하고 `MpUclMulticastBoard`를 대진표 바로 위 인라인 전광판으로 통합해, `FT`(연장·PK 포함) 전 승자 확정·탈락 톤다운·다음 라운드 선노출을 원천 차단. 싱글·멀티 모두 토너먼트 진입 시 대진표로 자연 전환(리그페이즈 최종 순위표는 작은 탭으로 유지).
- **이적시장 원본 포메이션 피치 통일 (`src/components/common/PitchBoard.tsx`, `src/components/transfer/TransferMarketModal.tsx`, `src/components/multiplayer/league/MpLeagueTransferModal.tsx`)**:
  - `PitchBoard`에 다중 선택용 `selectedSlotKeys`·`selectedTone` 및 컴팩트 `slotExtraMeta`(트레이드 가치 TP·상대 니즈 아이콘)만 최소 확장하고, 싱글(일반 트레이드·레전드 FA)·멀티 이적시장 우측 내 스쿼드 피치를 평소 스쿼드와 100% 동일한 `PitchBoard(compact)` + `calculateChemistry`/`calculateTeamRatings`로 전면 교체(4색 케미선·총 케미·`+N`/`-N`·실효 OVR·우상단 `A/M/D`·자유 벤치·케미선 클릭 해제·트레이드 즉시 재계산 반영, `v87UclReadyBracketTransfer.test.ts` 테스트 추가).

---

## v8.6 — 멀티 드래프트 균등 순환 순서·내 턴 알림 · 관전자 하프타임 차단 · 컵 우승 팝업 1회 고정 · UCL 리그페이즈 명칭/전술 정비 개편

- **멀티 드래프트 룰렛·첫 턴 균등 순환 배분 (`src/engine/mpLeagueDraft.ts`, `src/components/multiplayer/league/MpLeagueDraftBoard.tsx`)**:
  - `snakePickerIndex(pickNo, playerCount)`를 스네이크 반전에서 라운드 순환 `(round + pos) % playerCount`로 개편하고 `roundOrderIds`를 추가해 2인(8/8)·3인(6/5/5)·4인(4/4/4/4) 전 참가자가 룰렛과 라운드 첫 픽 기회를 균등하게 배분받도록 개선.
  - 드래프트 상단에 현재 라운드 순번 트랙(`{round + 1}R 순서`)과 `다음 {round + 2}R 룰렛` 담당자 표시 추가.
- **멀티 드래프트 내 차례 가벼운 비차단 알림 (`src/components/multiplayer/league/MpLeagueDraftBoard.tsx`)**:
  - 상대 턴에서 내 턴(룰렛 돌리기/선수 지명)으로 전환 시 클릭을 방해하지 않는 상단 플로팅 토스트(`pointer-events-none`), 에메랄드 테두리 펄스, 브라우저 탭 `[내 차례]` 표기, 모바일 진동 및 `localStorage`(`rtt_mp_draft_turn_sound_v1`) 음소거 토글 가능한 Web Audio 2음 차임 추가.
- **멀티 맞대결 관전자 하프타임 전술 조작 원천 차단 (`src/components/multiplayer/league/MpLeagueH2HView.tsx`, `src/components/league/LiveMatchBroadcast.tsx`)**:
  - `LiveMatchBroadcastOverride`에 `isSpectator`·`spectatorStatus`를 도입해 관전자에게 홈 팀 하프타임 라커룸 UI가 렌더링되거나 수석코치 `[추천 적용]`·선발/교체 조작이 가능했던 버그를 차단하고, 전용 읽기 전용 `하프타임 · 양 팀 전술 조정 중` 대기 패널과 양 감독 확정 상태만 표시.
- **멀티 자국 컵 우승 팝업 반복 노출 버그 근본 해결 (`src/components/multiplayer/league/MpLeagueDashboard.tsx`)**:
  - `localStorage`(`rtt_mp_seen_popups_v1`) + 메모리 기반 `markMpPopupSeen`/`hasMpPopupBeenSeen`과 1회 래치 상태(`openCupPopupKey`, `openLpPopupKey`, `openMilestoneKey`)로 개편하고 자국 컵 팝업을 `live.stage === 'league'`로 한정해 다음 라운드 티커/Realtime 재수신/새로고침에도 절대 재노출되지 않도록 보장.
- **UCL 리그페이즈 순위 명칭 통일 & 챔스·토너먼트 진입 전술 정비 일시정지 (`src/components/league/StandingsTable.tsx`, `src/components/multiplayer/league/MpUclSidePanel.tsx`, `src/components/multiplayer/league/MpLeagueDashboard.tsx`, `src/components/ucl/UclDashboard.tsx`, `src/engine/mpLeagueEngine.ts`)**:
  - `StandingsTable`에 `title`·존 라벨·`accent` 옵션을 추가해 UCL Phase 2에서 `"리그 순위표"` 대신 `"UCL 리그페이즈 순위"`(1~8위 16강 직행 / 9~24위 플레이오프 / 25~36위 탈락)로 명확히 표기하고, 사이드바·모바일 전환 바·싱글 UCL 탭/테이블 명칭도 통일.
  - `closeMpLeagueSummary` 및 `stepUclLeaguePhase`에 `ucl-consent-league_phase` 게이트를 추가하고 `flow.kind === 'consent'` 배너에 `[전술 수정]` + `[준비 완료]` 버튼을 배치해, 챔스 리그페이즈 진입 시점과 토너먼트 각 단계 진입 시 한 번 멈춰 전술을 정비한 뒤 진행하도록 개선(`v86MpDraftAndUclPrep.test.ts` 테스트 추가).

---

## v8.5.4 — 스쿼드 탭 [전술 수정] 일시정지 → [수정 확정] 즉시 재개 UX 개편

- **명시적 [전술 수정] → [수정 확정] 흐름 전환 (`src/hooks/useSoloTacticEditPause.ts`, `src/components/common/SoloLiveScoreboard.tsx`, `src/components/league/SquadManagerModal.tsx`, `src/components/league/SeasonDashboard.tsx`, `src/components/ucl/UclDashboard.tsx`, `src/components/multiplayer/league/MpLeagueRoot.tsx`)**:
  - 기존의 3초 자동 일시정지 타이머(`useSoloTacticEditPause`)를 명시적 편집 세션(`useSoloTacticEditSession`)으로 개편.
  - 솔로 정규 리그·UCL 라이브 자동진행 중 스쿼드 탭(또는 스코어보드 상단)의 `[전술 수정]` 클릭 시 자동진행이 일시정지되고 편집 UI가 열리며, 수정 완료 후 `[수정 확정]` 클릭 시 즉시 자동진행이 재개되고 변경 사항이 있으면 `[전술 수정 완료 · 변경된 전술은 다음 경기부터 적용됩니다]` 배너를 표시(자동진행 비활성 시에는 기존처럼 즉시 편집).
  - 멀티리그도 `[스쿼드·전술]` 저장 직후 2.5초 유예 대기 없이 즉시 재개되면서 다음 경기 적용 안내를 유지하도록 통일.

---

## v8.5.3 — 전술 수정 시 자동진행 잠시 일시정지 & 다음 경기 적용 안내 · 싱글/멀티 실시간 미니 순위표(경·승·무·패·득실·승점)

- **전술 수정 시 자동진행 잠시 일시정지 & 다음 경기 적용 안내 (`src/hooks/useSoloTacticEditPause.ts`, `src/components/common/SoloLiveScoreboard.tsx`, `src/components/league/SeasonDashboard.tsx`, `src/components/ucl/UclDashboard.tsx`, `src/components/multiplayer/league/MpLeagueRoot.tsx`, `src/components/multiplayer/league/MpLeagueDashboard.tsx`, `src/components/multiplayer/league/MpLeagueSquadEditor.tsx`)**:
  - 솔로(정규 리그·UCL) 라이브 자동진행 중 포메이션·전술·선발/벤치를 수정하면 `useSoloTacticEditPause`가 3초간 자동진행을 잠시 일시정지(연속 수정 시 연장, `[재개]` 클릭 시 즉시 재개; 이적·부상·2D 중계 중 오동작 방지)하고 `SoloLiveScoreboard`에 `[전술 수정됨 · 변경된 전술은 다음 경기부터 적용됩니다]` 배너를 다음 경기 시작 시까지 표시.
  - 멀티리그에서는 `MpLeagueSquadEditor` 헤더에 `다음 경기부터 적용` 배지를 표시하고, 변경 사항 저장 직후 2.5초간 `tactics` 일시정지 유예(`tacticGraceActive`)를 유지하며 `MpLeagueDashboard`에 `[전술 수정 완료 · 변경된 전술은 다음 경기부터 적용됩니다]` 안내 배너 표시.
- **싱글·멀티 실시간 미니 순위표 (`src/components/common/CompactLiveStandings.tsx`, `src/components/league/SeasonDashboard.tsx`, `src/components/ucl/UclDashboard.tsx`, `src/components/multiplayer/league/MpLeagueDashboard.tsx`, `src/components/multiplayer/league/MpUclSidePanel.tsx`)**:
  - PC·모바일 공통 컴팩트 실시간 순위표 `CompactLiveStandings`(`# | 구단 | 경 | 승 | 무 | 패 | 득실 | 승점` + `[핵심 / 전체]` 토글 + UCL/강등 컷라인)를 신설해, 솔로 정규 리그·UCL 자동진행 시 PC는 스코어보드 우측·모바일은 스코어보드 바로 아래에 실시간 표시(평상시에도 메인 탭 우측에 표시).
  - 멀티리그 `SideStandings`와 `SideUclStandings`에도 `승·무·패` 컬럼을 추가해 360px 모바일부터 PC까지 깨짐 없이 표시되도록 통일(`v85MpSyncAndUclLayout.test.ts` 테스트 추가).

---

## v8.5.2 — 솔로 라이브 자동진행 시 2D 중계 모달 오오픈 핫픽스

- **솔로 라이브 스코어보드 자동진행 정상 복구 (`src/components/league/LiveMatchBroadcast.tsx`, `src/components/league/SeasonDashboard.tsx`, `src/components/ucl/UclDashboard.tsx`)**:
  - `START_SOLO_STREAM_MATCH`가 미확정 스트리밍 경기를 `liveHalftime.streamAutoMode = true`로 저장할 때, `LiveMatchBroadcast`가 `streamAutoMode`를 필터링하지 않아 상단 `SoloLiveScoreboard` 대신 전체 화면 2D 경기 중계 모달이 즉시 열리던 회귀 버그를 수정.
  - `shouldRenderLiveMatchBroadcast(liveHalftime)`(`Boolean(liveHalftime && !liveHalftime.streamAutoMode)`)를 `LiveMatchBroadcast` 내부와 `SeasonDashboard`·`UclDashboard` 마운트 조건 모두에 적용해, 자동진행 중에는 상단 라이브 스코어보드로 재생되고 일시정지 → `[2D 경기 중계 입장]` 클릭 시(`streamAutoMode: false`)에만 2D 시뮬레이션으로 전환되도록 복구(`v84LiveScoreboardAndSkip.test.ts` 회귀 검증 추가).

---

## v8.5.1 — 4인 멀티리그 2차전 맞대결 2D 집중 진행 · 4인 이적시장·인터뷰 렉/누락/팝업 오류 종합 수정

- **4인 멀티리그 리그 맞대결 2차전만 2D 시뮬레이션 (`src/engine/mpLeagueEngine.ts`)**:
  - `shouldPlayLeagueH2HLive` 도입: 참가자 4인 이상일 때 리그 맞대결 12경기 중 각 조합의 **2차전(6경기)**만 2D 시뮬레이션(`flow.kind === 'h2h'`)으로 진입하고, 1차전(6경기)은 양 팀 실제 전술·케미·사기·컨디션이 반영된 `resolveMpH2HFullInstant` 결과를 `watchedLive: false`로 기록해 `MpLiveTicker` 라이브 스코어보드에서 실시간 중계되도록 개선(H2H 전적·순위·스탯 100% 반영, 2~3인 및 컵·UCL 맞대결은 기존 유지).
- **4인 이적시장·인터뷰 렉·팝업 누락·동시성 오류 다각 수정 (`src/engine/transferEngine.ts`, `src/engine/mpLeagueEngine.ts`, `src/types/mpLeague.ts`, `src/components/multiplayer/league/useMpLeagueHost.ts`, `src/components/multiplayer/league/MpLeagueRoot.tsx`, `src/components/multiplayer/MultiplayerArena.tsx`, `src/components/common/PlayerDetailModal.tsx`)**:
  - `generateIncomingTradeOffers`에 `excludeClubIds`·`minOfferCount` 및 OVR 범위 폴백을 추가하고 `stepTransfer`에 4회 재시도를 적용: 4인 드래프트로 상위 64명이 빠져나가 AI 구단과 최상위 4인 OVR 차이가 벌어지거나 10% 빈 제안/구단 충돌이 겹쳐 일부 참가자의 이적시장 팝업이 0건으로 아예 안 뜨던 버그를 근본 수정(방어적 0건 자동 `ack` 포함).
  - `buildMpLeagueLive`에서 완료된 오퍼의 `offerClubs` 16인 로스터를 즉시 제거해 4인 이적시장 클릭당 DB/Realtime JSON 페이로드 대폭 축소.
  - `useMpLeagueHost` `handleActions`의 `completeLeagueAction`·`updateLeaguePayload`를 `Promise.all` 병렬화하고 틱 실행 중 도착한 브로드캐스트를 즉시 재실행(`pendingWake`) + `handledActionIds` 발행.
  - `MpLeagueRoot`에 고유 요청 ID 기반 `actionBusy`(`handledActionIds`), 방장 본인 클릭 0ms 즉시 기상(`wakeHostLocally`), `event_choice` 전송 실패 시 `answeredEventKey` 복구, 이적시장/인터뷰/정산 진입 시 `editorOpen` 자동 종료 추가.
  - `MultiplayerArena` `mergeRoomSnapshot`에서 미변경 참가자 행과 동일 `rev` `league_payload` 참조를 유지해 타 참가자 클릭 시 4인 이적시장/대시보드 `useMemo` 재계산 스파이크 차단.
  - `PlayerDetailModal` z-index를 `z-[60]` → `z-[85]`로 상향해 이적시장(`z-[70]`)·시즌 정산(`z-[65]`)·전술 편집 모달 뒤로 가려지던 팝업 중첩 버그 해결.
- **테스트 (`src/__tests__/v85MpSyncAndUclLayout.test.ts`)**: 4인 EPL 풀시즌 스트레스 테스트 추가(12경기 중 2차전 6경기만 2D, 1차전 6경기 라이브 스코어보드 재생 + H2H 누적, 3회 이적시장 전원 1건+ 비겹침 제안 & `offerClubs` 프루닝 페이로드 감소, 4인 인터뷰 정상 완료 검증).

---

## v8.5 — 멀티리그 Broadcast 즉시 동기화 · 순위표 즉시 반영 · 컵 우승 조기 스포일러 차단 · 챔스(Phase 2) 전용 레이아웃 & 실시간 사이드바

- **멀티리그 이적시장·인터뷰 팝업 지연/미표시 근본 수정 & Fast Sync (`src/services/mpLeagueService.ts`, `src/components/multiplayer/league/useMpLeagueHost.ts`, `src/components/multiplayer/league/MpLeagueRoot.tsx`, `src/components/multiplayer/league/MpLiveTicker.tsx`, `src/types/mpLeague.ts`)**:
  - `MpLiveTicker` `useEffect` 의존성에 매 리렌더마다 새 참조가 되는 `ordered`가 포함되어 360ms 완료 타이머가 cleanup에 의해 취소되고 `doneRef.current`가 이미 `true`로 굳어 `onDone` 콜백이 영구 유실(다른 버튼을 눌러 리렌더를 일으켜야 팝업이 뜨던 현상)되던 근본 원인을 제거.
  - `orderedRef` 분리, 월클럭(`performance.now()`) 기반 진행 + 350ms 백그라운드 탭 워치독 + `visibilitychange` 복구, `hasPlayableTickerMatches` 가드, `MpLeagueRoot` React 상태 동기화 effect, `${flow.key}:${templateId}` 복합 이벤트 키 스코프 적용.
  - `mp-league:${roomId}` Realtime 채널에 경량 Broadcast(`live_updated`, `player_signal`) + 시즌 중 `mp_league_picks`를 건너뛰는 1-RTT `fetchLeagueLiveOnly` + 방장 커밋 락스텝(`onHostLiveCommitted`)·즉시 기상(`wakeNow`)을 구축해 방장과 비방장 참여자 화면에 이적시장·인터뷰 팝업이 동시에 뜨도록 최적화(DB `postgres_changes` + 2.5초 안전 폴링 Fallback 유지).
- **정규 리그 순위표 라운드 종료 즉시 실시간 반영 (`src/components/multiplayer/league/MpLeagueDashboard.tsx`, `src/components/multiplayer/league/MpLiveTicker.tsx`)**:
  - 낡은 `frozen` 상태를 제거하고 티커 스냅샷(`prevStandings`, `prevTopScorers`, `prevTopAssisters`) 기반 결정적 뷰 전환 + `FT` 도달 즉시 0ms `onDone` 호출로 순위표·승점·득실·득점/도움 순위가 라운드 종료 순간 즉각 반영되도록 개선.
- **컵대회 우승(코파 이탈리아 등) 및 최종 결산 조기 스포일러 완전 차단 (`src/engine/mpLeagueEngine.ts`, `src/components/multiplayer/league/MpLeagueDashboard.tsx`, `src/components/multiplayer/league/MpLeagueRoot.tsx`, `src/components/multiplayer/league/MpUclSidePanel.tsx`)**:
  - `stepLeagueRound`·`stepCupStage`·`stepUclLeaguePhase` 티커에 `prevCup`·`prevUclStandings`·`prevTopScorers`/`prevTopAssisters`·`prevUclTopScorers`/`prevUclTopAssisters`를 포함해 라이브 중계 중 컵 대진표/우승 배지/순위표 스포일러를 원천 차단.
  - `MpLeagueSeasonSummary`, 신규 `MpCupChampionPopup`, `MpLeagueFinalBoard`/`MpLeaguePodiumPopup`, `UclMilestoneModal` 전원을 `!tickerPlaying && !live.cast` 완료 게이트로 통일.
- **멀티리그 챔피언스리그(Phase 2) 사이드바 실시간 순위표 전환 & 전용 레이아웃 (`src/components/multiplayer/league/MpUclSidePanel.tsx`, `src/components/multiplayer/league/MpLeagueDashboard.tsx`, `src/components/league/LeagueLeadersSideCard.tsx`, `src/engine/mpLeagueEngine.ts`)**:
  - `MpUclLive`에 실시간 `topScorers`/`topAssisters` 추가. Phase 2 진입 시 상단 헤더가 챔스 전용 네이비/별빛 테마(`UEFA CHAMPIONS LEAGUE`, 진행 라운드, 진출권 배지, 8R/토너먼트 단계 진행 바)로 자동 전환되고 끝난 국내 리그 요소를 정리.
  - 우측 사이드바가 자동으로 `SideUclStandings`(1~8위 16강 직행 / 9~24위 PO / 25~36위 탈락 컷라인 + 친구 강조 + `[핵심 | 전체 36]` 토글) → 토너먼트 시 `SideUclKnockoutCard` + UCL 득점/도움 `LeagueLeadersSideCard`로 전환.
  - 모바일(`lg:hidden`)에 라이브 스코어보드 하단 3분할 컴팩트 전환 바(`[진행 · 순위표/토너먼트 · 기록]`)를 추가해 단일 스크롤로 쾌적하게 탐색 가능(CSS `zoom`·이중 스크롤 미사용).
- **테스트 (`src/__tests__/v85MpSyncAndUclLayout.test.ts`)**: `hasPlayableTickerMatches`, `uclZoneOf`, 세리에A+코파 이탈리아+UCL 풀시즌 시뮬레이션에서 컵 결승 `prevCup` 비스포일러 및 UCL 36팀 순위표/득점·도움 스냅샷 검증 3건 추가.

---

## v8.4.2 — 라이브 중 2D 입장 · 이벤트 후 자동진행 선택 · 승부차기 추가시간 키커 중계 · 스킵 중 인터뷰 정지 수정

- **라이브 스트리밍 일시정지 → 2D 경기 시뮬레이션 즉시 입장 (`src/types/league.ts`, `src/store/GameContext.tsx`, `src/components/common/SoloLiveScoreboard.tsx`, `src/components/league/LiveMatchBroadcast.tsx`, `src/components/league/SeasonDashboard.tsx`, `src/components/ucl/UclDashboard.tsx`)**:
  - 솔로 라이브 자동진행 경기를 `liveHalftime.streamAutoMode = true` 미확정 상태로 시뮬레이션(`START_SOLO_STREAM_MATCH`)하고 `FT`(+PK) 시점에 `COMMIT_LIVE_MATCH`로 확정하도록 구조를 개편(스포일러 원천 제거).
  - 일시정지 상태에서 `[2D 경기 중계 입장]` 클릭 시 `ENTER_LIVE_BROADCAST_FROM_STREAM`으로 멈춘 분(`resumeFromMinute`)과 구간(`first_half` / `second_half` / `extra_time` / `extra_time_2` / `penalties`) 그대로 2D 중계에 난입(전반 진입 시 하프타임 전술 지휘 가능, 이전 하이라이트 재재생 차단).
- **컵대회/2D·이적시장·부상 후 `[이어서 자동진행 / 일시정지]` 확인 팝업 (`src/components/league/SeasonDashboard.tsx`, `src/components/ucl/UclDashboard.tsx`)**:
  - 자동진행 중 자국 컵대회 2D 지휘, 라이브 중 2D 난입, 이적시장 종료, 부상 알림 대응 완료 직후 바로 달리지 않고 `[일시정지]` vs `[이어서 자동진행]` 선택 모달을 표시. 감독 인터뷰는 기존대로 응답 직후 자동진행 즉시 이어감.
- **라이브 스트리밍 승부차기(PK) 추가시간 진행 & 키커별 성공/실축 UI (`src/types/mpLeague.ts`, `src/engine/mpLeagueEngine.ts`, `src/components/multiplayer/league/MpLiveTicker.tsx`, `src/components/common/SoloLiveScoreboard.tsx`, `src/components/multiplayer/league/useMpLeagueHost.ts`)**:
  - `MpCastMatch['penalties']`에 `kicks?: PenaltyKickLog[]` 포함. 솔로·멀티 라이브 스코어보드에서 120분 종료 후 정해진 경기 시간(5·7·9초)에 더해 `700ms/키커` 추가 페이즈로 승부차기를 순차 진행.
  - 실시간 PK 스코어, 서든데스 배지, 팀별 `O`/`X`/다음 키커 도트 보드, 현재 키커 성공/실축 속보 배너 구현 및 멀티 방장 자동진행·캐스트 타이머(`getMpTickerExtraPkMs`, `getMpCastDurationMs`) 연장 동기화.
- **경기 스킵 중 인터뷰·부상 팝업 뒤 백그라운드 진행 버그 전역 수정 (`src/components/ucl/UclLeaguePhaseFastSimModal.tsx`, `src/components/league/FastSimModal.tsx`, `src/store/GameContext.tsx`)**:
  - `UclLeaguePhaseFastSimModal`에 누락되어 있던 `hasPendingEvent`·`isTransferOpen`·`hasLiveHalftime` 정지 조건과 상태 배지(`인터뷰 일시정지`/`부상 알림 일시정지`)·`[즉시 완료]` 비활성화 추가.
  - `FastSimModal` 이적시장 650ms 자동 전환 및 스텝 타이머·`[즉시 완료]`도 인터뷰/부상/2D 중계 중 완전 정지하도록 보강하고, `GameContext` 리듀서(`SIMULATE_ONE_FAST_ROUND`, `SIMULATE_SINGLE_MATCH_INSTANT`, `SIMULATE_TO_NEXT_TRANSFER`, `SKIP_TO_SEASON_END`, `SIMULATE_UCL_LEAGUE_PHASE_TO_END`, `SIMULATE_UCL_TO_END`) 전원 방어 가드 적용.
- **테스트 (`src/__tests__/v84LiveScoreboardAndSkip.test.ts`)**: 미확정 라이브 스트림 + 전반/후반 2D 난입 + 취소/확정, 인터뷰/부상 대기 중 고속 스킵 리듀서 차단, 승부차기 키커 로그 보존 및 추가시간 계산 검증 3건 추가.

---

## v8.4.1 — 솔로 라이브 자동진행 경기 후 인터뷰·부상·이적 팝업 미노출(교착) 핫픽스

- **솔로 라이브 자동진행 교착 수정 (`src/components/league/SeasonDashboard.tsx`, `src/components/ucl/UclDashboard.tsx`)**:
  - 라운드 시뮬레이션 직후 발생한 `activeEvent`(감독 인터뷰)·`pendingInjuryAlerts`(부상)·`transferMarket.isOpen`(이적시장)·`uncelebratedCupWin`(컵 우승) 상태가 아직 `0' → 90'` 재생 중인 `SoloLiveScoreboard`의 `paused` 프롭을 즉시 `true`로 만들어 스코어보드가 멈추고 `soloTickerPlaying`이 해제되지 않아 팝업이 뜨지 않던 교착 버그를 수정.
  - `liveTickerPlaying = soloTickerPlaying || liveAutoMatch !== null` 동안 `liveAutoPauseReason`을 `null`로 유예해 경기가 `FT`까지 완전히 재생된 직후 인터뷰/부상/이적 팝업이 즉시 열리고, 처리 완료 후 자동진행이 이어지도록 수정(1.5초 워치독 안전장치 포함).

---

## v8.4 — 솔로 라이브 스코어보드 자동진행(5·7·9초) · 스킵 단일화 · 멀티 H2H 프리뷰 스킵/결과 확인 · 인터뷰 빈도 축소 & 조기 배지 수정

- **솔로 플레이 [라이브 스코어보드 자동진행] 도입 & 전역 스코어보드 최적화 (`src/components/common/SoloLiveScoreboard.tsx`, `src/components/multiplayer/league/MpLiveTicker.tsx`, `src/index.css`, `src/store/GameContext.tsx`, `src/App.tsx`, `src/components/league/SeasonDashboard.tsx`, `src/components/ucl/UclDashboard.tsx`)**:
  - 공용 `MpLiveTicker` / `LiveTickerMatchCard`를 `requestAnimationFrame` + `performance.now()` 60fps 진행률 바 보간(DOM ref 직접 갱신), 정수 분 변경 시에만 React 상태 커밋, `useMemo` 이벤트/골 사전 정렬, CSS 키프레임(`scorePop`, `feedSlideIn`, `goalFlashBorder`)으로 리팩터링.
  - 솔로 정규 리그(`SeasonDashboard`)와 UCL 리그 페이즈(`UclDashboard`)에 `SoloLiveScoreboard` 기반 `[라이브 자동진행]`(`5초 / 7초 / 9초` 3단계 토글 + 일시정지/재개/중단) 도입. 재생 중(`soloTickerPlaying`)에는 순위표·최근 경기 스포일러와 글로벌 인터뷰/부상/이적시장 모달을 유예하고, `FT` 직후 감독 인터뷰·부상·자국 컵 경기·이적시장 오픈 시 자동 일시정지 및 팝업 처리 후 자동 이어가기 연결.
- **솔로 경기 스킵 단일화 (`src/components/league/FastSimModal.tsx`, `src/components/league/SeasonDashboard.tsx`)**:
  - 기존 `[이적시장까지]` / `[시즌 끝까지]` 2버튼을 단일 `[경기 스킵]` 버튼(`FastSimMode = 'unified'`)으로 통합. 이적시장 도달 시 무조건 자동 일시정지 후 이적시장 진입(`paused_for_transfer`), 이적시장 마감 직후 `[계속 스킵]` vs `[일시중지]` 재질문 팝업(`prompt_resume`) 표시.
- **멀티 리그 맞대결 프리뷰 `[스킵 요청]` & 경기 결과 팝업 `[확인]` 대기 (`src/engine/mpLeagueH2H.ts`, `src/components/multiplayer/league/useMpLeagueHost.ts`, `src/components/multiplayer/league/MpLeagueH2HView.tsx`)**:
  - 프리뷰(매치 데이 전술실) 단계에서부터 `mpH2HPreSkipKey` 기반 `[스킵 요청]` 버튼 추가. 프리뷰/중계 중 양측 스킵 동의 시 `resolveMpH2HFullInstant`로 풀 결과를 산출해 `phase: 'finished'`로 먼저 발행.
  - 일반 2D 종료 및 합의 스킵 모두에서 즉시 넘어가지 않고 스코어·득점자·스탯·MOM이 포함된 `[맞대결 경기 결과 팝업]`을 띄우며, 온라인 참가자 전원(관전자 포함)이 `[확인]`(`doneKey`)을 클릭해야 다음 단계로 전이.
- **멀티 리그 인터뷰 빈도 축소 & `~님이 인터뷰 중...` 조기 노출 버그 수정 (`src/engine/mpLeagueEngine.ts`, `src/types/mpLeague.ts`, `src/components/multiplayer/league/MpLeagueRoot.tsx`, `src/components/multiplayer/league/MpLeagueDashboard.tsx`)**:
  - `MP_LEAGUE_MIN_EVENT_COOLDOWN = 8` (리그 라운드 + 매치 기준), `MP_LEAGUE_MAX_EVENTS_PER_SEASON = 4`, 핵심 분기점(3연승/3연패+, 친구 H2H/상위 4위 빅매치, 평점 8.5+ 대활약) 우선 트리거 + 희소 앵커(`9R, 19R, 29R`)로 시즌당 3~4회 수준 압축. 멀티 자동진행 속도 옵션도 `5초 / 7초 / 9초`로 통일.
  - `tickerDoneKey` 상태를 `MpLeagueRoot`로 끌어올려 `tickerPlaying` 동안 `activity.lock = 'interview' | 'injury'` 발행과 대시보드 `pauseText` 인터뷰/부상/이적 대기 배지 노출을 정확히 차단(경기 종료 후 실제 팝업 오픈 시점에만 활성화).
- **테스트 (`src/__tests__/v84LiveScoreboardAndSkip.test.ts`)**: `5·7·9초` 속도 옵션 및 `matchResultToCastMatch` 연장전 중복 제거, `resolveMpH2HFullInstant` 프리뷰·중계 중 스킵 `phase='finished'` 산출, 멀티 리그 풀시즌 인터뷰 상한(≤4)·8라운드 쿨다운·이적시장 비중첩 검증 3건 추가.

---

## v8.3 — 벤치 포지션 종속 해제 · 챔스 A/M/D OVR · 모바일 모달 안정화 · 컴팩트 피치/후보 · 멀티 단일 피치+탭 · 3인+ 4팀 룰렛

- **벤치 슬롯 포지션 종속 해제 & 포지션 오표시·부상 교체 근본 수정 (`src/engine/lineupOptimizer.ts`, `src/engine/mpLeagueDraft.ts`, `src/engine/mpLeagueEngine.ts`, `src/engine/transferEngine.ts`, `src/components/common/PitchBoard.tsx`, `src/components/common/InjuryAlertModal.tsx`, `src/components/transfer/TransferMarketModal.tsx`, `src/components/multiplayer/league/MpLeagueTransferModal.tsx`, `src/components/multiplayer/league/MpLeagueRoot.tsx`)**:
  - 드래프트 픽 단계에서만 `BENCH_SLOTS` 포지션 가이드를 유지하고(`draftBenchHints`), 드래프트 이후 벤치는 고정 포지션 제약·라벨이 없는 자유 벤치 배열로 전환.
  - `PitchBoard`·`TransferMarketModal`·`MpLeagueTransferModal`·`InjuryAlertModal`·`lineupOptimizer`·`mpLeagueDraft` 전 영역에서 벤치 선수가 항상 본인의 실제 포지션(`player.position` / `mainPositions`)으로 표시·판정되도록 수정(ST가 `bench[0]`에 들어가도 `GK`로 오표시되지 않음).
  - `InjuryAlertModal`에서 벤치 전용 부상 시 `targetSlotIndex`가 `0`(GK)으로 폴백되던 버그를 제거하고, `mpLeagueEngine.resolveAvailableLineup`이 포메이션 슬롯 포지션(`evaluatePositionFit`) 기준으로 부상 대체 선수를 고르도록 수정. `MpLeagueRoot`에 낙관적 스쿼드 반영(`optimisticSquad`)을 추가해 교체 즉시 UI 갱신.
  - 보너스 수정: `mpLeagueEngine.toCastMatch`가 이미 `result.events`에 합쳐진 연장전 이벤트를 중복 합산해 라이브 스코어보드 득점 수가 부풀려지던 버그 수정.
- **챔피언스리그(Phase 2) 스쿼드 우상단 `A / M / D` 실시간 OVR (`src/components/ucl/UclDashboard.tsx`)**:
  - UCL 스쿼드/전술 화면 우상단 및 피치 헤더 우측에 `calculateTeamRatings` 기반 `⚡ A / M / D` 실효 라인 OVR을 추가해 포메이션·선발·전술 변경 시 즉시 갱신.
- **모바일 팝업/모달 스크롤 배경 밀림·하단 출렁임 전역 수정 (`src/hooks/useBodyScrollLock.ts`, `src/index.css`, 전체 29개 모달 컴포넌트)**:
  - 참조 카운트 기반 모바일 안전 바디 스크롤 잠금(`useBodyScrollLock` / `ModalBodyLock`)과 공통 `.modal-backdrop` · `.modal-panel` · `.modal-scroll`(`100dvh`, `overscroll-behavior: contain`, 내부 독립 스크롤) 클래스를 전체 모달에 일관 적용.
- **전역 포메이션 피치 & 드래프트 후보 창 컴팩트화 (`src/components/common/PitchBoard.tsx`, `src/components/league/OpponentPitchView.tsx`, `src/components/common/PlayerCard.tsx`, `src/components/draft/RouletteReelsView.tsx`, `src/components/draft/DraftScreen.tsx`, `src/components/multiplayer/MultiplayerBlindDraft.tsx`)**:
  - CSS `zoom` 없이 피치 비율(`aspect-[4/3.35]` / `compact` `aspect-[4/3.15]`)과 카드 여백을 다듬어 PC·모바일 한눈에 보기 최적화.
  - `PlayerCard`에 `dense` 모드를 신설하고 `RouletteReelsView` 룰렛 머신·후보 카드 높이를 대폭 축소해 피치와 후보 창을 한 화면 안에서 최대한 동시에 확인 가능.
- **멀티 리그 드래프트 `[단일 원본 피치 + 상단 참가자 전환 탭]` & 3인 이상 4팀 룰렛 (`src/components/multiplayer/league/MpLeagueDraftBoard.tsx`, `src/engine/mpLeagueDraft.ts`, `src/components/draft/RouletteReelsView.tsx`, 미사용 `ScaledPitchFrame.tsx` 삭제)**:
  - 소형 다중 피치 그리드를 폐지하고 원본 `PitchBoard` 1개 + 피치 상단 참가자 전환 탭(`내 팀` · 친구별 픽 수 · 케미 요약 · 현재 턴 표시)으로 개편.
  - 멀티 리그 참가자가 3명 이상(3인·4인)일 때 `spinSharedRoll`이 4개 구단(`reelCount = 4`)으로 룰렛을 돌리고, `RouletteReelsView`가 4릴 그리드(`grid-cols-2 sm:grid-cols-4`)와 순차 잠금 애니메이션을 지원하도록 확장(2인 이하는 기존 3구단 유지).
- **테스트 (`src/__tests__/v83UiBenchAndRoulette.test.ts`)**: 자유 벤치 정렬·`chooseSlotForPlayer` 포지션 유지·`resolveAvailableLineup` 슬롯 기반 부상 대체·2인(3팀) vs 3~4인(4팀) 공유 룰렛·실시간 `A/M/D` 재계산 검증 5건 추가.

---

## v8.2 — 멀티플레이 UX·디자인 통일 & 리그 도움 순위 (원본 피치 균등 그리드 · 대기 턴 후보 유지/잠금 · 우상단 A/M/D OVR · 역제안/시즌 정산 원본 통합 · 사이드 득점·도움 순위)

- **멀티 드래프트 원본 피치 그리드 & 대기 턴 UX (`src/components/common/ScaledPitchFrame.tsx`, `PitchBoard.tsx`, `PlayerCard.tsx`, `src/components/draft/RouletteReelsView.tsx`, `src/components/multiplayer/league/MpLeagueDraftBoard.tsx`)**:
  - 기존 간략 피치(`MpMiniPitch.tsx` 삭제)와 별도 대형 내 피치 레이아웃을 제거하고, 원본 `PitchBoard`(선수 카드 · 4색 케미선 · 시너지 수치 · 실효 OVR · 벤치)를 `ResizeObserver` + `transform: scale()` 기반 `ScaledPitchFrame`(CSS `zoom` 미사용)으로 정상 비율 그대로 축소해 2인(2열) · 3인(PC 3열 / 모바일 2+1 중앙 균등) · 4인(PC 4열 / 모바일 2×2) 전원 동일 크기 그리드로 통합.
  - 내 팀은 에메랄드 테두리 + `MY` 배지, 현재 지명 중인 상대는 앰버 하이라이트로 구분하고 개별 확대 모달 유지.
  - 상대 지명 턴에도 `RouletteReelsView`가 축소·접힘 없이 원본 크기 그대로 유지되며, 다른 참가자가 지명한 카드는 자리 이동 없이 즉시 `선택됨 · [닉네임]` 잠금 처리. 대기 중에도 남은 후보 클릭 시 내 피치 임시 배치 프리뷰가 동작하며 지명 확정만 비활성화.
- **멀티 스쿼드 · 전술 화면 우상단 `A / M / D` 실시간 OVR (`src/components/multiplayer/league/MpLeagueSquadEditor.tsx`, `src/components/league/MatchDayTacticsRoom.tsx`)**:
  - `calculateTeamRatings` 기반 `⚡ A / M / D` 실효 라인 OVR을 멀티 리그 스쿼드 에디터와 매치 데이 전술실 우상단에 추가해 포메이션·전술·선발 변경 시 실시간 반영.
- **이적시장 역제안 원본 통일 & 멀티 리그/정산 디자인 일관성 복원 (`src/types/mpLeague.ts`, `src/engine/mpLeagueEngine.ts`, `src/engine/mpLeagueScore.ts`, `src/components/multiplayer/league/useMpLeagueHost.ts`, `MpLeagueTransferModal.tsx`, `MpLeagueDashboard.tsx`, `MpLeagueSeasonSummary.tsx`, `MpLeagueFinalBoard.tsx`, `MpLeagueRoot.tsx`, `mpUclView.ts`)**:
  - 이적시장 진입 시 제안 구단별 16인 `TransferClubOffer`(`offerClubs`)를 생성·동기화하고, 방장 트레이드 처리(`executeMpTradePackage` / `submitMpLeagueTrade`)를 다중 패키지 역제안(`userSentPlayerIds`, `aiTargetPlayerIds`, `aiFillerPlayerIds`, 급매 `shockBargainIds`, 중복 0건 보장)까지 지원하도록 확장.
  - `MpLeagueTransferModal`의 `[조건 수정 · 역제안]`을 싱글 `TransferMarketModal`과 동일한 UI·동선(우상단 `[← 받은 제안으로]` + `[이적시장 끝내기]`, 포메이션/리스트 전환, 상대 니즈 배지, 실시간 성사 확률, 실수 종료 확인 모달, `PlayerDetailModal`)으로 통일.
  - 멀티 리그 대시보드 헤더·시즌 진행 바(이적시장 마커)·순위표(UCL/강등 커트라인)·탭 바를 싱글플레이 톤으로 통일하고, 이적시장/시즌 정산 활성 시 이전 이벤트 결과·부상 알림 모달이 겹쳐 뜨는 버그 수정.
  - `MpLeagueSeasonSummary`(참가자 맞대결·UCL 배지·컵 대진표·UCL 36팀 진입 게이트), `mpUclView.ts`(실제 `topPlayerStats` 연동으로 UCL MVP 표시), `MpLeagueFinalBoard`(트로피 히어로 · 참가자 순위/맞대결/8항목 세부 점수 · 발롱도르 · FIFA 월드베스트 XI · 역대 24팀 비교 · 참가자 스쿼드)를 싱글 시즌 정산 양식과 조화롭게 통합.
- **사이드 득점 순위 + 도움 순위 (`src/components/league/LeagueLeadersSideCard.tsx`, `src/components/league/SeasonDashboard.tsx`, `src/components/multiplayer/league/MpLeagueDashboard.tsx`)**:
  - 싱글 리그와 멀티 리그 모두 사이드 영역에 득점 순위 + 도움 순위(TOP 5) 동시 제공. PC는 동시 표시, 모바일은 `[득점 | 도움]` 원터치 전환 컴팩트 카드로 세로 스크롤 최소화 및 선수 상세 조회 지원.
- **테스트 (`src/__tests__/v82MultiLeaguePolish.test.ts`)**: 2/3/4인 멀티 리그 풀시즌 시뮬레이션으로 `topScorers`/`topAssisters`, `offerClubs` 생성·초기화, 다중 패키지 역제안 및 중복 0건, `uclPlayerStats`·`globalAwards`·`squadStats`, 포메이션 변경 시 `A/M/D` 실시간 재계산 검증 추가.

---

## v8.1 — 멀티 리그 몰입도 개편 (공유 룰렛 드래프트 · 라이브 스코어보드 · 리그 시즌 정산 · 맞대결 합의 스킵 · 챔스 연출 · 최적화)

- **공유 룰렛 스네이크 드래프트 (`src/engine/mpLeagueDraft.ts`, `src/components/multiplayer/league/MpLeagueDraftBoard.tsx`, `MpLeagueSnakeDraft.tsx`, `MpMiniPitch.tsx`, `useMpLeagueHost.ts`)**:
  - 라운드마다 첫 순번 감독이 룰렛을 한 번 돌리고(자신의 다음 빈 슬롯 포지션 기준), 전원이 그 한 룰렛의 후보에서 순서대로 가져갑니다. 순서는 라운드마다 스네이크로 뒤집힙니다.
  - 가져온 선수는 각자 포메이션의 가장 맞는 빈 슬롯에 자동 배치(`chooseSlotForPlayer`)되며 이후 자리 이동 가능. 룰렛 결과는 첫 순번 감독 행의 `activity.roll`로 공유(추가 SQL 없음).
  - 상단에 전원의 드래프트 현황을 소형 포메이션(`MpMiniPitch`)으로 표시. 전원이 `[자동 드래프트]`에 동의하면 남은 픽이 자동 진행.
  - 턴 타이머를 별도 컴포넌트로 분리해 0.25초마다 화면 전체가 다시 그려지던 문제 제거.
- **라이브 스코어보드 & 리그 화면 재배치 (`MpLiveTicker.tsx`, `MpLeagueDashboard.tsx`, `mpLeagueEngine.ts`)**:
  - 자동진행 라운드마다 상단에 친구들 경기 스코어보드가 `1'→90'`(컵 연장·승부차기 포함)으로 흐릅니다. 내 경기 카드에는 골·선방·찬스 등 굵직한 중계가 뜨고, 다른 감독 경기는 실시간 스코어만 표시. 재생이 끝나면 득점자와 점유·슈팅·xG가 남습니다.
  - 재생 중에는 순위표·라운드 결과를 이전 상태로 유지해 결과가 미리 보이지 않습니다.
  - 순위표를 소형 사이드 표로 이동, 본문은 라운드 결과·컵·챔스 탭. 자동진행 간격은 4~7초(기본 5초)로 조정.
- **리그 시즌 정산 (`MpLeagueSeasonSummary.tsx`, `mpLeagueEngine.ts` `league_summary` 단계)**:
  - 리그 종료 직후(챔스 전) 전원에게 올해의 선수·리그 베스트 11·득점/도움/평점 순위·최종 순위표·감독별 스쿼드 기록을 보여주고, 전원이 `[계속]`을 눌러야 다음으로 진행. 이후에도 상단 `[시즌 정산]`으로 다시 열람 가능.
- **친구 맞대결 합의 스킵 (`MpLeagueH2HView.tsx`, `useMpLeagueHost.ts`)**:
  - 중계 중 두 당사자가 모두 `[스킵 요청]`을 누르면 남은 구간(후반·연장·승부차기)을 현재 라인업으로 즉시 계산해 결과로 넘어갑니다. 관전자는 누를 수 없습니다.
- **이적시장 역제안 포메이션 선택 (`MpLeagueTransferModal.tsx`)**: 보낼 선수를 소형 포메이션 피치에서 눌러 선택.
- **챔피언스리그 연출 (`mpUclView.ts`, `MpLeagueDashboard.tsx`)**:
  - 싱글 플레이의 `UclMilestoneModal`(16강·8강·4강·결승 진출, 우승·트레블 축하)과 `UclLeaguePhaseStandingsModal`(36팀 순위표)을 수정 없이 재사용(감독별로 구단 id를 바꿔 끼운 뷰 제공). 리그 페이즈 라운드에도 라이브 스코어보드 적용.
- **최종 결과 팝업 (`MpLeaguePodiumPopup.tsx`, `MpLeagueDuelResultPopup.tsx`)**:
  - 2명일 때 승자 축하 / 패자 놀림 커스텀 감독 팝업 추가, 3~4명 시상대는 등수·인원별로 다른 멘트 표시.
- **최적화 (`MpLeagueRoot.tsx`, `mpLeagueService.ts`, `MultiplayerArena.tsx`)**:
  - 공개 상태는 리비전 번호만 먼저 확인하고 실제로 바뀌었을 때만 전체를 내려받도록 변경(기존: 2.5초마다 전체 다운로드).
  - 2초 안전 폴링 결과가 이전과 같으면 화면을 다시 그리지 않도록 스냅샷 동일성 검사 추가, 대시보드 순위표·결과 줄 메모이제이션.
- **테스트 (`src/__tests__/v80MultiLeague.test.ts`)**: 공유 룰렛(라운드 내 모든 픽이 같은 룰렛에서 나옴)·슬롯 자동 배치·라운드별 스코어보드·리그 정산 대기 단계 검증 추가.

---

## v8.0 — 멀티 리그 & 챔피언스리그 (친구 2~4명 · 공개 스네이크 드래프트 · 느린 자동진행 + 전역 일시정지 · 맞대결 2D 중계/관전 · 단계별 동의 UCL · 2종 결산 보드)

- **멀티 리그 방 & 로비 (`src/components/multiplayer/MultiplayerLobby.tsx`, `src/components/multiplayer/league/MpLeagueLobbyRoom.tsx`, `src/services/multiplayerService.ts`, `src/types/multiplayer.ts`, `src/types/mpLeague.ts`)**:
  - 로비 모드에 `[멀티 리그]`를 활성화(2~4명). 방장이 진행 리그(5대 리그 택1) · 드래프트 풀 · 챔피언스리그 ON/OFF · 드래프트 턴(15/20/30초)을 설정하고, v7.2 감독 도트·유니폼·구단명 커스텀이 로비·순위표·경기·결산 화면에 그대로 연동.
  - 기존 1대1 블라인드 대전 흐름은 변경 없음(`MultiplayerArena.tsx`는 멀티 리그 방일 때 `MpLeagueRoot`로 분기만 추가).
- **감독 선선택 → 실시간 공개 스네이크 드래프트 (`src/engine/mpLeagueDraft.ts`, `src/components/multiplayer/league/MpLeagueSnakeDraft.tsx`, `supabase/schema.sql`)**:
  - 전원 감독 능력·포메이션 선택 후 무작위 순번으로 `1→2→3→3→2→1` 스네이크 진행(16라운드). 기존과 동일한 3구단 룰렛·임시 배치·시너지 프리뷰 UX, 전체 픽 현황 실시간 공개.
  - 턴 타이머(최대 30초) 만료 시 화면 후보 중 OVR 최고 선수를 자동픽, 접속이 끊긴 감독은 방장이 5초 뒤 대신 자동픽.
  - 전 세계 유일 선수: 후보 생성 시 방 전체 픽 제외 + DB 유일 키(`mp_league_picks`)가 같은 선수·같은 순번을 거부 + 시즌 시작 시 5대 리그 96구단·UCL 외곽 구단 로스터에서 드래프트 선수 전원 제외.
- **방장 권위형 공유 시즌 엔진 (`src/engine/mpLeagueEngine.ts`, `src/engine/mpLeagueH2H.ts`, `src/engine/cupEngine.ts`, `src/engine/uclEngine.ts`, `src/components/multiplayer/league/useMpLeagueHost.ts`, `src/services/mpLeagueService.ts`)**:
  - 참가자 구단이 해당 리그 최약체 N팀을 대체해 같은 리그·자국 컵·UCL을 함께 진행. 기존 경기 엔진·컵·UCL·부상/사기·트레이드 엔진을 그대로 재사용하고, 컵·UCL 엔진에는 사람 경기 결과를 주입하는 선택 파라미터(`precomputedResults`)만 추가(기존 싱글 동작 불변).
  - **느린 자동진행**: 라운드당 2.5~4초(방장 조절). **전역 일시정지**: 누구든 스쿼드·전술 수정 / 인터뷰 답변 / 부상 교체 중이면 방 전체 정지, 상단에 `OO님 전술 수정 중` 표시 후 자동 재개. 이적시장 기간은 전원이 끝낼 때까지 정지. 정지를 건 감독이 오프라인이면 방장 `[강제 재개]`.
  - **기자회견·라커룸은 전원 같은 라운드**에 발생(5라운드 간격), 부상은 개별 발생.
  - **이적시장**: 타 구단이 보낸 제안 수락/거절 + 역제안만 진행(창당 협상 3회). 같은 AI 구단이 두 감독에게 동시에 제안하지 않으며, 트레이드는 방장이 순차 처리해 중복 선수 0건.
- **친구 간 맞대결 동기화 2D 중계 & 무조건 관전 (`src/components/multiplayer/league/MpLeagueH2HView.tsx`)**:
  - 리그·자국 컵·UCL 어디서든 친구끼리 만나면 자동진행을 멈추고 전술실 → 2D 중계 → 하프타임/연장 양측 수싸움으로 직접 대결. 리그·컵·UCL 리그 페이즈는 **4배속 고정**, UCL 토너먼트는 **2배속 고정**(배속·스킵 버튼 없음).
  - 비당사자는 `관전 중` 배지와 함께 같은 중계에 자동 진입(조작 불가). 전술 미확정(90초)·미응답 시 현재 라인업으로 자동 확정해 무한 대기 방지.
- **챔피언스리그 (`src/components/multiplayer/league/MpUclMulticastBoard.tsx`, `MpLeagueDashboard.tsx`)**:
  - 리그 4위 이내 감독만 출전, 리그 페이즈는 리그와 동일한 느린 자동진행. 토너먼트는 플레이오프·16강·8강·4강·결승 각 단계마다 **전원 `[진행 동의]`** 후 시작.
  - 유저 vs AI 토너먼트 경기는 **UCL 라이브 멀티캐스트 전광판**으로 `0'→90'`(연장·승부차기 포함) 약 7초간 중계: 득점 시 스코어 카드 점멸, 하단 속보, 2차전 합산 스코어(AGG) 실시간 표시.
- **최종 시즌 결산 2종 보드 & 시상대 (`src/engine/mpLeagueScore.ts`, `MpLeagueFinalBoard.tsx`, `MpLeaguePodiumPopup.tsx`)**:
  - **친구 최종 순위**: 기존 공정 시즌 스코어(`computeSeasonScore`) + 맞대결 점수(승3·무1 승점 ÷ 최대 승점 × 1,500)로 1~4등 결정, 항목별 내역 표시, 커스텀 감독 이미지 노출.
  - **역대 강팀 비교**: 맞대결 점수를 제외한 기존 공식 그대로 역대 24팀 사이 위치 표시. 멀티 시즌은 개인 명예의 전당에 등재하지 않음.
  - 3~4명일 때 시즌·챔스 종료 후 시상대 팝업: 3명이면 3등이 시상대에서 울고, 4명이면 4등은 바닥에 주저앉아 우는 연출(감독 도트 원본 유지, 눈물 오버레이).
- **인프라·문서 (`supabase/schema.sql`, `.gitignore`, `CLAUDE.md`, `src/__tests__/v80MultiLeague.test.ts`)**:
  - Supabase: `mp_rooms`/`mp_room_players` CHECK 제약 제거, `league_payload`·`activity` 컬럼, `mp_league_picks`·`mp_league_state`·`mp_league_actions` 테이블 + RLS + Realtime 추가(SQL Editor에서 1회 실행 필요).
  - `.gitignore`에 `.env` 추가, Claude Code 세션 규칙 `CLAUDE.md` 신설.
  - 스네이크 순번·중복 차단·자동픽, 맞대결 점수, 3인 풀시즌(리그 38R + 컵 + UCL + 인터뷰 동일 라운드 + 트레이드 중복 0건 + 단계 동의 + 2종 결산) 통합 테스트 추가.

---

## v7.2 — 4대 핵심 버그 수정(포지션 페널티·케미선 해제·트레이드 스탯 중복·교체 아웃 잠금) · 멀티플레이 커스텀/승패 도트 모션 · UCL 리그 페이즈 고속진행 & 36팀 순위표 팝업

- **포지션 부적합 OVR 감소 피치·상세 카드 단일화 (`src/data/formations.ts`, `src/engine/positionEngine.ts`, `src/components/league/SeasonDashboard.tsx`, `src/components/transfer/TransferMarketModal.tsx`, `src/components/league/SeasonSummary.tsx`)**:
  - `3-3-3-1`(`RAM`, `LAM`, `LWB`, `RWB` 등) 및 `3-5-2-dm` 슬롯의 `alternateSubPositions` 0-페널티 예외를 제거하고 9개 전 포메이션 피치(`PitchBoard`)와 선수 상세 모달(`PlayerDetailModal`)이 단일 `evaluatePositionFit` 함수를 공유하도록 통일.
- **포메이션 피치 선수 재클릭 시 케미선 강조 해제 (`src/components/common/PitchBoard.tsx`, `src/components/league/OpponentPitchView.tsx`)**:
  - 선택된 선수를 다시 클릭해 선택 해제하거나 피치 빈 공간을 클릭할 때 PC 마우스 잔류 호버 및 모바일 터치 합성 호버 상태를 즉시 초기화하도록 수정.
- **트레이드/교체 선수 출전 수·골·도움 중복 합산 차단 (`src/store/GameContext.tsx`, `src/utils/playerLookup.ts`, `src/engine/awardsEngine.ts`, `src/engine/standingsEngine.ts`, `src/engine/matchEngine.ts`)**:
  - 타 리그 ↔ 우리 리그 트레이드 시 이전 리그 `playerStats` 맵에서 이관 완료된 스탯 엔트리를 즉시 삭제하고, `mergeCrossLeaguePlayerStats` 중복 병합 방지 및 단일 리그 최대 라운드(38R/34R) 상한 보장, 경기당 동일 `playerId` 중복 집계 가드 추가.
- **교체 확정 후 아웃 선수 재교체 차단 & 잔여 체력 유지 (`src/components/league/LiveMatchBroadcast.tsx`, `src/components/dream/DreamMatchArena.tsx`)**:
  - 드림 매치·리그·컵·UCL·멀티플레이 전 모드에서 하프타임·후반 실시간·연장전 교체 아웃 확정 선수를 `confirmedSubRecords` 및 `subbedOutIdSet`에 영구 기록해 `교체됨` 잠금과 교체 시점 잔여 체력을 경기 종료까지 유지.
- **멀티플레이 감독·유니폼·구단명 커스텀 & 프리셋 연동 (`src/components/multiplayer/MpProfileCustomizerModal.tsx`, `src/components/multiplayer/MultiplayerLobby.tsx`, `src/components/multiplayer/MultiplayerArena.tsx`, `src/services/multiplayerService.ts`)**:
  - 멀티플레이 로비에서 감독 픽셀 아바타(성별·피부톤·헤어스타일·머리색·의상·안경), 유니폼 디자인(5종 패턴·메인/보조 컬러), 구단명·약칭을 커스텀하거나 기존 프리셋을 불러와 Supabase `mp_room_players`에 실시간 동기화.
- **킥오프 직전 포메이션 피치 뷰 공개 & 종료 후 승장 축하 / 패장 좌절 도트 모션 팝업 (`src/components/multiplayer/PreKickoffRevealModal.tsx`, `src/components/multiplayer/MpPostMatchManagerPopup.tsx`, `src/components/common/PixelManagerAvatar.tsx`, `src/components/multiplayer/MultiplayerArena.tsx`, `src/__tests__/v72BugfixAndMpCustom.test.ts`)**:
  - `PreKickoffRevealModal`을 양 팀 포메이션 피치 뷰(4색 시너지선·티어 카드·포지션 페널티·선수 상세 연동)로 개편.
  - 1대1 경기 종료 팝업에 승장·패장 양측 커스텀 감독이 나란히 등장하며, 승장의 축하 포즈/표정 4종과 패장의 좌절 도트 모션 4종(엎드려 땅 치며 오열 · 무릎 꿇고 전술판 파손 · 대자로 뻗어 영혼 가출 · 땅에 얼굴 파묻고 좌절 OTL) 및 승리/도발 멘트가 매 경기 랜덤으로 연출되도록 구현.
- **UCL 리그 페이즈 단계별 고속진행 모달 & 36팀 순위표 팝업 (`src/components/ucl/UclLeaguePhaseFastSimModal.tsx`, `src/components/ucl/UclLeaguePhaseStandingsModal.tsx`, `src/components/ucl/UclDashboard.tsx`)**:
  - `[리그 페이즈 끝까지 고속진행]` 클릭 시 자국 리그 `FastSimModal`과 동일하게 1R~8R 라운드별 경기 결과·순위 변동·실시간 상위 8위+내 구단 순위표를 단계별로 진행하는 고속 시뮬레이션 모달(속도 전환·일시정지·부상 자동 정지·즉시 완료 지원) 적용.
  - 리그 페이즈 8R 종료 시 1~8위 16강 직행 / 9~24위 플레이오프 / 25~36위 탈락 커트라인 구분선과 내 구단 진출 요약이 담긴 `[36팀 리그 페이즈 순위표 팝업]` 자동 표시 및 상단 헤더/대진표 상시 열람 버튼 추가.

---

## v7.1 — 1대1 전술실 상대 수정 상태 표시 · 최종 전술 공개/비교 팝업(양측 준비 → 방장 시작) · 멀티 1배속 동기화 고정

- **1대1 매치 데이 전술실 블라인드 상태 표시 (`src/components/league/MatchDayTacticsRoom.tsx`, `src/components/multiplayer/MultiplayerArena.tsx`)**:
  - 드래프트 당시의 초기 포메이션·전술 및 이에 기반한 5구역 상성 화살표가 상대 최종 전술처럼 오인되지 않도록, `blindOpponentStatus` 모드를 도입해 `[전술·포메이션 수정 중...]` / `[전술 확정 (공개 대기)]` 실시간 상태와 내 팀 전술 완성도만 깔끔하게 표시.
- **최종 전술 공개 & 비교 팝업 (`src/components/multiplayer/PreKickoffRevealModal.tsx`, `src/components/multiplayer/MultiplayerArena.tsx`, `src/services/multiplayerService.ts`)**:
  - 양측 전술 확정 시 양 팀의 최종 포메이션·전술·ATT/MID/DEF·완성도·선발 XI 및 실제 5구역 상성 비교를 보여주는 공개 팝업 자동 표시.
  - 양측 모두 `[경기 준비 완료]` 토글 후 방장이 `[경기 시작 · 킥오프]`를 눌러 동시 시작하도록 흐름 개편.
- **멀티 1대1 2D 중계 1배속 고정 (`src/components/league/LiveMatchBroadcast.tsx`, `src/components/multiplayer/MultiplayerArena.tsx`)**:
  - `lockSpeed: 1` 옵션을 적용해 1대1 멀티플레이에서는 양쪽 화면 속도 이탈·스킵 꼬임을 방지하고 `[1x 동기화]`로 고정 진행.

---

## v7.0.2 — 1대1 전술 확정 후 킥오프 멈춤 수정 & 전술 잠금·수정 토글

- **양측 전술 확정 후 킥오프 멈춤 근본 수정 (`src/services/multiplayerService.ts`, `src/types/multiplayer.ts`, `src/components/multiplayer/MultiplayerArena.tsx`)**:
  - `publishMatchState`에 `live_match`/`live`/`playing`/`match`/`in_match`/`in_progress`/`first_half` status 폴백 및 최후 `match_state` 단독 저장 폴백을 적용하고, `isMatchLiveNow` 판별로 DB status 제약조건과 무관하게 양측 확정 즉시 2D 경기가 시작되도록 수정.
  - 전술 확정·상태 발행 직후 즉시 스냅샷을 재조회하고, 호스트 전환 에러 시 가드 해제 및 화면 오류 표시 추가, 안전 폴링 주기 2초 단축.
- **전술 확정 잠금 & `[전술 수정]` 버튼 (`src/components/league/MatchDayTacticsRoom.tsx`, `src/components/league/LiveMatchBroadcast.tsx`, `src/components/multiplayer/MultiplayerArena.tsx`)**:
  - 전술 확정 시 매치 데이 전술실(`locked`) 및 하프타임/연장 라커룸의 전술·포메이션·최적 선발·선수 스왑 조작을 잠금 처리하고, 상대 확정 전까지 `[전술 수정]`으로 해제 가능하도록 개선.

---

## v7.0.1 — 멀티플레이 방 생성 Supabase CHECK 제약조건 호환 핫픽스

- **Supabase `mp_rooms_mode_check` / `status` / `seat` 호환성 수정 (`src/services/multiplayerService.ts`, `src/types/multiplayer.ts`, `src/components/multiplayer/MultiplayerArena.tsx`, `src/components/multiplayer/MultiplayerLobby.tsx`)**:
  - 1대1 방 생성 시 `mode` 필드를 DB 컬럼 `DEFAULT`에 위임해 `mp_rooms_mode_check` 위반 오류를 해결하고, `status`(`tactics`/`pre_match`, `live_match`/`playing`/`match`) 및 `seat`(0/1 기반) CHECK 제약조건 위반(`23514`) 시 호환 값으로 자동 재시도하도록 보강.

---

## v7.0 — Supabase 실시간 멀티플레이 인프라 구축 & 친구와 1대1 블라인드 드래프트 대전

- **Supabase 실시간 멀티플레이 인프라 & 배포 연동 (`supabase/schema.sql`, `src/lib/supabaseClient.ts`, `src/types/multiplayer.ts`, `src/services/multiplayerService.ts`, `.github/workflows/deploy.yml`)**:
  - `mp_rooms` / `mp_room_players` 테이블 스키마 + RLS + Realtime Publication SQL 구축 및 GitHub Actions 빌드 단계에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` Secret 주입 추가.
  - 환경변수 미설정/네트워크 오류 시 크래시 없는 안전한 안내 상태(`isSupabaseConfigured`), `localStorage` 기반 클라이언트 세션 ID·드래프트 자동 백업·재접속 복구 구현.
- **확장형 멀티플레이 로비 & 초대 UX (`src/components/multiplayer/MultiplayerLobby.tsx`, `src/components/setup/TitleScreen.tsx`, `src/store/GameContext.tsx`, `src/App.tsx`, `src/components/common/HeaderNav.tsx`)**:
  - 첫 화면 `[멀티플레이]` 진입 버튼 및 모드 선택형 로비(`1대1 블라인드 대전` 활성 + 2단계 `멀티 리그` 확장 슬롯).
  - 커스텀 감독 프로필 자동 연동, 6자리 초대 코드·원클릭 초대 링크(`?room=XXXXXX`) 복사 및 자동 참가, Supabase Presence 실시간 접속 표시·준비 완료 토글, 방장 전용 드래프트 풀(5대 리그) 및 연장·PK 규칙 설정 지원.
- **상호 비공개 감독 선택 & 동시 블라인드 드래프트 (`src/components/multiplayer/MultiplayerBlindDraft.tsx`)**:
  - 감독 스타일·초기 포메이션 비공개 선택 + 싱글과 동일한 임시 배치·자리 스왑·시너지 프리뷰 UX로 16명 동시 드래프트.
  - 드래프트 중에는 `draft_progress`만 전송해 상대 픽·감독 완전 비공개 보장 및 양 팀 중복 선수 허용.
- **라인업 공개 · 대칭 1대1 동기화 2D 중계 · 재대결 (`src/components/multiplayer/MultiplayerArena.tsx`, `src/engine/matchEngine.ts`, `src/components/league/MatchDayTacticsRoom.tsx`, `src/components/league/LiveMatchBroadcast.tsx`, `src/components/league/MatchReportPanel.tsx`, `src/__tests__/v70Multiplayer1v1.test.ts`)**:
  - `resolveMatchStrengths` / `simulateFirstHalf` / `simulateSecondHalf` / `simulateExtraTimeFirstHalf` / `simulateExtraTimeSecondHalfAndPenalties`에 대칭 `opponentUserContext`를 도입해 AI 자동 대응을 배제하고 양측 감독의 전술·포메이션·하프타임/연장 교체를 100% 동일 기준으로 시뮬레이션.
  - 호스트 권위형 타임라인 동기화로 양쪽 화면에 100% 동일한 스코어·2D 경기 중계·하프타임/연장 동시 수싸움·승부차기 제공, 경기 종료 후 `MatchReportPanel` + `[같은 팀으로 재대결]` / `[새 드래프트로 1대1]` 및 시리즈 전적 누적 지원.

---

## v6.2.1 — 피치 시너지 연결선 & 월클/슈퍼스타/레전드 카드 웅장한 테두리·글로우 복원

- **피치 시너지 연결선 & 최상급 티어 카드 비주얼 복원 (`src/index.css`, `src/components/common/PlayerCard.tsx`, `src/components/common/PitchBoard.tsx`, `src/components/league/OpponentPitchView.tsx`)**:
  - 차분한 다크 슬레이트 UI 크롬(탭·필터·배경)·피치 상단 헤더 분리·긴 이름 스마트 축약은 유지하면서, 피치 위 4색 시너지 연결선의 선명한 채도·두께(`opacity 0.88`, 호버 시 `1.0` 강조)를 복원.
  - 레전드(골드 홀로그램 글로우)·슈퍼스타(사이언 다이아몬드 글로우)·월드클래스(스카이 블루 글로우 테두리)의 웅장한 카드 테두리와 배지를 `PlayerCard` 및 양 팀 피치 카드 전반에 복원.

---

## v6.2 — 명예의 전당 공정 계산식 전면 재설계 · UCL 라운드 진출/우승·트레블 축하 연출 · 첫 페이지 SD 감독 리뉴얼 & 염소 도트 · 피치 겹침 수정 & 전역 눈 편한 색감 개편

- **명예의 전당 공정 계산식 전면 재설계 (`src/engine/legacyEngine.ts`, `src/data/historicalTeams.ts`, `src/store/GameContext.tsx`, `src/__tests__/v60HofAndRoster.test.ts`)**:
  - 특정 팀 편향 및 OVR 급등 절벽을 제거하고, 시즌 성과(38R 환산 리그 95점+ 체감 · 자국 컵 · UCL 우승 `+2,500` · 대기록 상한 `+2,750` · 개인상 상한 `+1,100`)와 전력·완성도(선발·실효 OVR 상한 `+3,400` · 벤치 뎁스 `+500` · 감독 역량 `+420` · 감독-선수 시너지 `+520` · 케미 `+440` · **`evaluateTeamTacticalProfile` 전술 이행도 `+680`**)를 유저·역대 24팀에 100% 동일 적용.
  - 상위권이 `14-15 바르셀로나` · `19-20 바이에른 뮌헨` · `71-72 아약스` · `12-13 바이에른 뮌헨` · `08-09 바르셀로나` · `22-23 맨시티` · `24-25 PSG`로 자연스럽게 분산 경쟁.
- **챔피언스리그 토너먼트 단계별 진출 팝업 & 우승/트레블 대형 축하 연출 (`src/components/ucl/UclMilestoneModal.tsx`, `src/components/ucl/UclDashboard.tsx`, `src/index.css`)**:
  - `16강 · 8강 · 4강 · 결승 진출` 시 직전 라운드 합산 스코어(AGG)/리그 페이즈 순위와 간결한 기대 문구 팝업 표시(스킵 결과 모달과 순차 전환).
  - UCL 우승 시 대형 도트 빅이어(`120px`) · 별빛 컨페티 파티클 · 결승 스코어 · 대회 MVP 요약 제공, 트레블 달성 시 전용 골드 프레임 + 3관왕 트로피 동시 전시.
- **첫 페이지 도트 일러스트 SD 감독 리뉴얼 & 정상 염소 이스터에그 (`src/components/setup/RoadToTrebleHeroSvg.tsx`)**:
  - 기존 각진 감독 도트를 둥근 SD 2등신 비율·반짝이는 눈·볼터치·미니 전술판으로 리뉴얼하고, 빅이어 정상 우측 언덕에 텍스트 없는 흰색 염소 픽셀 이스터에그 배치.
- **양 팀 피치 비교 겹침 버그 수정 & 전역 눈 피로도 완화 (`PitchBoard.tsx`, `OpponentPitchView.tsx`, `MatchDayTacticsRoom.tsx`, `PlayerCard.tsx`, `RouletteReelsView.tsx`, `StandingsTable.tsx`, `index.css`)**:
  - `PitchBoard`와 `OpponentPitchView`의 포메이션·케미 배지를 피치 바깥 상단 전용 헤더 바로 분리해 모든 포메이션에서 ST 카드·왕관과 겹침 원천 차단, 스플릿 피치 높이 통일.
  - 피치 케미선을 차분한 저채도·얇은 선(`opacity 0.28`)으로 완화하고 호버/선택 선수 연결선만 또렷하게 강조(`0.90`), 한국어 긴 이름 스마트 축약(`디마르코`, `마르티네스` 등) 및 카드 폭 확장으로 잘림 개선, 전역 글로우·네온 배지 절제(색감 개편 직전 롤백 태그 `stable-before-v6-color-polish` 별도 분리 보관).

---

## v6.1 — 트레이드 역제안 헤더 복귀·실수 종료 방지 · 명전 스쿼드 OVR 가중치 강화 · 전역 네온 톤 정돈 & 양 팀 피치 비교 가독성 개선

- **트레이드 역제안 헤더 복귀 버튼 통합 & 이적시장 실수 종료 방지 (`src/components/transfer/TransferMarketModal.tsx`)**:
  - 역제안 화면에서 `[← 받은 제안으로]` 버튼을 우측 상단 종료 버튼 바로 왼쪽에 배치하고, 본문·탭 하단에 중복되던 역제안 안내 바를 제거해 깔끔하게 정돈.
  - 우측 상단 닫기 버튼을 `[이적시장 끝내기]`(UCL 특별창은 `[UCL 시작]`)로 명확히 개칭하고, 남은 기회 또는 미처리 받은 제안이 있을 때 클릭 시 실수 종료를 방지하는 확인 모달(`#confirm-close-transfer-window-btn`) 추가.
- **명예의 전당 공통 순위 공식 스쿼드 OVR 비중 강화 (`src/engine/legacyEngine.ts`, `src/__tests__/v60HofAndRoster.test.ts`)**:
  - 유저·역대 강팀 100% 동일 공식 `computeSeasonScore`의 `squadCraftBonus`에 선발 기본 OVR(`baseOvrPts`)과 벤치 뎁스 가중치를 강화하고 자국 리그 대기록 중첩 점수를 완만화.
  - 개별 팀 하드코딩 없이 공식만으로 최상위 OVR 스쿼드(`14-15`·`10-11`·`08-09` 바르셀로나 등)가 `71-72 아약스`보다 상위권에 위치하도록 균형 조정.
- **전역 소형 네온 절제 & 양 팀 피치 비교 카드 타이포그래피 개선 (`PitchBoard.tsx`, `OpponentPitchView.tsx`, `MatchDayTacticsRoom.tsx`, `TransferMarketModal.tsx`, `SeasonDashboard.tsx`, `LegacyHubModal.tsx`, `UclDashboard.tsx`, `SquadManagerModal.tsx`, `LiveMatchBroadcast.tsx`, `SeasonSummary.tsx`, `LeagueSelect.tsx`, `FastSimModal.tsx`, `MatchDetailModal.tsx`, `TacticsGuideModal.tsx`, `SystemGuideModal.tsx`)**:
  - 대시보드·전술실·이적시장·UCL·명전·중계·가이드 전반의 소형 탭·필터·전술/포메이션 토글에서 원색 네온 배경을 제거하고 다크 슬레이트 + 은은한 포인트 테두리로 통일(주요 실행 CTA 버튼 강조는 유지).
  - 양 팀 피치 비교 및 이적시장 듀얼 피치의 선수 카드 폭·OVR·이름 폰트 비율을 축소·정렬하고 `OpponentPitchView` 노드 내 중복 3행 스타일 배지를 정리해 시인성 개선.

---

## v6.0 — 명예의 전당 피치 뷰·감독 시너지 순위 개편 · 역대 최강 10팀 추가(총 24팀) · 트레이드 역제안 뒤로가기 수정 · 파스칼 그로스 & 5대 리그 2026-27 로스터 전수 보강

- **트레이드 `[받은 제안 → 역제안]` 뒤로가기 동선 수정 (`src/components/transfer/TransferMarketModal.tsx`)**:
  - 역제안 화면에서 `[← 이전으로]` 클릭 시 이적시장 전체가 닫히거나 엉뚱한 탭으로 이탈하지 않고 반드시 직전 화면(받은 제안 목록 또는 트레이드 룰렛 화면)으로 복귀하도록 상태 전이를 정리하고, PC·모바일 모두 스크롤 없이 보이는 상·하단 고정 바에 명확히 배치.
- **명예의 전당 상세보기 포메이션 피치 스쿼드 뷰 개편 (`src/components/legacy/LegacyHubModal.tsx`)**:
  - 역대 실제 강팀(24팀)과 유저 명전 팀 모두 상세보기 시 기존 `PitchBoard` 포메이션 피치 컴포넌트를 재사용해 선발 11명 배치 · 4색 시너지선 · 선수별 시너지/감독 궁합 실효 OVR · 벤치 · 감독(OVR·스타일)을 한눈에 표시(구버전 유저 기록 자동 복원 예외 처리 포함).
  - 비리그 우승 UCL 챔피언(1988-89·2006-07 AC 밀란, 2001-02 레알 마드리드)의 상세 헤더 및 리더보드 부제목에 실제 리그 최종 순위(`3위`/`4위`)를 정확히 표기.
- **명예의 전당 순위 계산식 개편 — 감독 시너지 & 선수단 실효 OVR 반영 (`src/engine/legacyEngine.ts`, `src/data/historicalTeams.ts`)**:
  - 비슷한 성적일 때 감독 시너지 비율과 선수 간 케미가 반영된 실효 OVR 완성도가 높은 팀이 더 높은 등수가 되도록 `squadCraftBonus` 가중치를 개편하고 유저 팀과 역대 강팀에 100% 동일한 `computeSeasonScore` 공식을 적용.
- **명예의 전당 역대 최강 10팀 대거 추가 (`src/data/historicalSquadsData.ts`, `src/data/historicalTeams.ts`, `src/data/formerClubs.ts`)**:
  - 14팀 → **총 24팀** 확장: **1971-72 AFC 아약스**(트레블), **2010-11 FC 바르셀로나**(더블), **2016-17 레알 마드리드**(쓰리핏 정점 더블), **2024-25 파리 생제르맹**(루이스 엔리케 트레블), **1988-89 AC 밀란**(사키 무패 유러피언컵), **2007-08 맨체스터 유나이티드**(EPL+UCL 더블), **2019-20 리버풀**(승점 99 EPL 우승), **2006-07 AC 밀란**(안첼로티 4-4-2 다이아몬드 UCL 우승), **2001-02 레알 마드리드**(갈락티코스 1기 UCL 우승), **1994-95 AFC 아약스**(판 할 리그·UCL 무패 더블).
  - 신규 10팀 전원 선발 11명 + 핵심 벤치 6명(170명) 세부 능력치·플레이스타일·전 소속팀 시너지(`getPlayerFormerClubs` 하이드레이션)·명장(OVR·스타일·아바타) 완비 및 전 24팀 264명 선발 포지션 페널티 0 검증 완료, 드림 매치 연동.
- **브라이튼 파스칼 그로스 & 5대 리그 2026-27 로스터 전수 보강 (`src/data/activePlayers.json`, `src/data/leagues.json`, `src/data/formerClubs.ts`)**:
  - FotMob 2026-27 실제 활약 기반 브라이튼 **파스칼 그로스**(`act-263`, OVR `73 → 83`, `PAS 89 / CRO 88`, 전 소속 `TSG 호펜하임 · 보루시아 도르트문트`) 및 주장 **루이스 덩크**(`74 → 80`) 상향, 브라이튼 표기 정비(`매트 오라일리`, `에반 퍼거슨`, `올리비에 보스칼리`, `제이슨 스틸`, `말릭 주니오르 얄쿠예`).
  - 전역 음차 중복 3건 완전 해소(`헤로니모 룰리` 맨시티 단일화 · `아시에르 비얄리브레` 라싱 산탄데르 단일화 · `콜 캠벨` SV 엘버스베르크 단일화), 누락 주전 첼시 **조던 헨더슨**(`act-v6-henderson`, OVR 79) 추가, 도르트문트 **막시밀리안 바이어**(`act-352`) 포지션 정상화(`FW ST/LW`), 5대 리그 2026-27 핵심 주전·베테랑 25명(`제프리 더 랑거`, `에릭 다이어`, `빌리 오르반`, `앤드류 로버트슨`, `뱅자맹 앙드레`, `플로리앙 토뱅`, `후안 포이스`, `알렉스 베렝게르`, `유리 베르치체`, `파비안 셰어`, `댄 번`, `제라르 모레노`, `피카요 토모리`, `케빈 트랍`, `루카시 흐라데츠키`, `페테르 굴라치`, `올리비에 지루` 등) OVR·스탯 보정(현역 2,204명 · 레전드 33명 유지 · 96구단 최소 뎁스 100% 충족).

---

## v5.2 — 첫 페이지 실제 24×28 도트 트로피 복원 · 모바일 전역 한눈에 보기 레이아웃 압축 & 터치 오작동 완전 해결

- **첫 페이지 실제 24×28 도트 트로피 복원 & 모바일 `100dvh` 원스크린 수납 (`src/components/common/PixelTrophySvg.tsx`, `src/components/setup/RoadToTrebleHeroSvg.tsx`, `src/components/setup/TitleScreen.tsx`)**:
  - `getPixelTrophyRects` 헬퍼를 통해 기존 `24×28` 정밀 도트 트로피(`epl_league` · `fa_cup` · 대형 `ucl` 빅이어)의 고유 실루엣·금속 광택·받침대를 트레블 로드 일러스트(`240×94`) 위에 그대로 복원.
  - 모바일 첫 화면 상하 여백 및 2열 CTA 버튼 밀도를 최적화해 스크롤 거의 없이 `100dvh` 안에 타이틀·트로피 길·시작/드림매치·보조 3버튼 수납.
- **모바일 선수 교체·트레이드 선택 시 선수 상세 카드 오터치 완전 해결 (`src/components/common/PitchBoard.tsx`, `src/components/transfer/TransferMarketModal.tsx`)**:
  - `PitchBoard`에서 모바일 카드 모서리 `ⓘ` 아이콘과 롱프레스 자동 팝업을 제거해 카드 전체를 100% 교체/스왑 터치 영역으로 확보하고, 선수 선택 시 상단에 나타나는 전용 `[선수 상세]` 바로 오작동 없이 조회 가능.
  - `TransferMarketModal`의 양 팀 포메이션 피치·벤치·리스트 행에서 이름 버튼 오터치를 제거해 카드/행 전체가 트레이드 선택 전용으로 동작하며, 리스트 우측 분리 `ⓘ` 버튼과 하단 고정(Sticky) 트레이드 바의 선수 칩에서 안전하게 상세 확인.
- **모바일 전역 한눈에 보기 압축 최적화 (`HeaderNav.tsx`, `DraftScreen.tsx`, `RouletteReelsView.tsx`, `SeasonDashboard.tsx`, `MatchDayTacticsRoom.tsx`, `OpponentPitchView.tsx`, `InjuryAlertModal.tsx`, `LiveMatchBroadcast.tsx`, `StandingsTable.tsx`, `UclDashboard.tsx`, `UclBracketTree.tsx`)**:
  - CSS `zoom`·`100vh` 이중 스크롤 없이 순수 반응형 패딩·종횡비·가로 스와이프·하단 고정 바로 모바일 세로 스크롤 대폭 축소(PC 데스크톱 레이아웃 100% 보존).
  - 드래프트 후보 모바일 가로 스와이프 + 하단 고정 `[영입 확정]` 바, 매치 프리뷰 모바일 단일 피치 기본 전환, 이적시장 하단 고정 트레이드 요약·제출 바, 2D 경기 중계 모바일 `[스코어보드 + 2D 피치 + 실시간 중계]` 1화면 재배치, 순위표·UCL 36팀 테이블·토너먼트 브래킷 행/카드 압축 적용.

---

## v5.1 — 공식 타이틀 [Road To Treble] & 트레블 로드 도트 첫 화면 리뉴얼 · 부상 빈도 대폭 하향 · 사기 OVR 임계치 상향 & 기자회견 리스크-리턴 개편 · 명전 자동 등재 기준 상향 & 전역 UI 모던 다이어트

- **공식 타이틀 `Road To Treble` 통일 & 첫 화면 트레블 로드 도트 일러스트 리뉴얼 (`index.html`, `src/components/setup/RoadToTrebleHeroSvg.tsx`, `src/components/setup/TitleScreen.tsx`, `HeaderNav.tsx`, `PatchNotesModal.tsx`, `SystemGuideModal.tsx`, `LegacyHubModal.tsx`)**:
  - 전 화면의 구 명칭(`PITCH MANAGER`)을 공식 명칭 **`Road To Treble`**로 통일.
  - 드래프트(코너플래그·축구공·2등신 도트 감독) → 5대 리그 → 자국 컵 → 정상 빅이어 트로피로 이어지는 픽셀 아트 "길(Road)" 일러스트(`RoadToTrebleHeroSvg`) 중심의 첫 화면 구성 및 불필요한 소개 문구 제거로 PC·모바일 원스크린 완성도 강화.
- **부상 발생 확률 대폭 하향 (`src/engine/conditionEngine.ts`, `src/components/guide/InjuryMoraleGuideContent.tsx`)**:
  - 부상 3단계·도트 아이콘·완치 자동복귀 구조는 유지하면서 기본 확률을 약 1/3 이하로 대폭 하향(`minor 0.13%`, `moderate 0.011%`, `severe 0.0018%`, 경상 강행 악화 `4%`)해 한 시즌 동안 드물게 터지는 희귀 변수 수준으로 조정.
- **사기 OVR 임계치 상향 & 기자회견/라커룸 하이리스크·안정 리스크-리턴 개편 (`src/engine/conditionEngine.ts`, `src/data/managerEvents.ts`, `src/types/condition.ts`, `src/components/common/ManagerEventModal.tsx`)**:
  - 사기 OVR 보정 임계치 상향(`-2..+2 => 0`, `+3..+4 => +1`, `+5 => +2 🔥`, `-3..-4 => -1`, `-5 => -2 ❄️`, 팀 사기 `±5 => ±0.5`) 및 일반 경기 승패 변동폭 대폭 축소.
  - 2~3경기 주기로 발동하는 72종 기자회견·라커룸 선택지를 `🔥 고위험`(+3~+4 폭등 / -2~-3 역풍) · `⚡ 승부수`(+2 / -1~-2) · `안정`(+1 고정 / 역풍 없음) 리스크 등급과 초미니 배지로 정비해 인터뷰가 사기 관리의 핵심 비중을 차지하도록 개편.
- **명예의 전당 자동 등재 기준 상향(5,500+) & 수동 등록 지원 (`src/engine/legacyEngine.ts`, `src/store/GameContext.tsx`, `src/components/league/SeasonSummary.tsx`)**:
  - 역대 강팀급 시즌(`totalScore >= 5500` · `S+` · `UCL 우승` · `트레블`)만 자동 등재되도록 상향(`isEligibleForAutoHofInduction`), 기준 미만 시즌은 결산 화면 `[명예의 전당 수동 등록]` 버튼으로 선택 등록 가능(도전과제는 매 시즌 자동 평가 유지).
- **전역 UI/UX 모던 다이어트 — 모바일 & Phase 2 UCL 집중 정돈 (`src/components/common/InfoHelpButton.tsx`, `DraftScreen.tsx`, `TransferMarketModal.tsx`, `UclDashboard.tsx`, `LegacyHubModal.tsx`, `SquadManagerModal.tsx`)**:
  - 클릭형 `?` 팝오버(`InfoHelpButton`)를 도입해 드래프트 대형 가이드 배너, 트레이드 시장 설명 문구, UCL 진행 규칙, 명전 등재 기준 등 AI식 장황한 설명 텍스트를 전부 `?` 안으로 이동.
  - Phase 2 UCL 헤더·모바일 3열 KPI·5탭 바 및 모달 테두리·배경 톤을 Phase 1과 통일된 차분한 다크 네이비 스포츠 대시보드로 정돈.

---

## v5.0.2 — 상대팀 피치 4색 시너지선·케미·감독 궁합 +OVR 시각화 · 포지션 꼬임 수정 & 드림 매치 명전 팀 실효 능력치 공정 동기화

- **상대팀 피치 4색 시너지선 · 케미 · +OVR 시각화 및 포지션 정렬 수정 (`src/components/league/OpponentPitchView.tsx`, `src/components/common/ClubSquadModal.tsx`)**:
  - 상대팀 포메이션 피치(시즌 5대 리그 · 컵 · UCL · 드림 매치 공통)에 `calculateChemistry(포메이션·선발·전술·AI 감독 스타일·감독 OVR)`를 적용해 4색 병렬 케미선, `케미 N (+X.X)` 오버레이, 선수별 실효 OVR 및 `+1~+3` 배지(선수 시너지 + 감독 궁합 호버 상세), 핵심 경계 실효 OVR을 우리 팀과 동일하게 표시.
  - 기존 탐욕적 슬롯 배치로 CB가 ST에 배치되거나 윙어가 CDM에 배치되던 버그를 명전 14팀 큐레이션 슬롯 고정 및 AI 구단 헝가리안 최적 배치(`optimizeCurrentStartersForFormation`)로 완전 해결.
  - `ClubSquadModal` 헤더 및 리스트에도 AI 감독 OVR, 팀 케미, 선발 `+N` 시너지/감독 궁합 OVR 상승 반영.
- **드림 매치 역대 강팀 실효 ATT/MID/DEF 공정 동기화 (`src/data/historicalTeams.ts`, `src/engine/matchEngine.ts`)**:
  - `buildHistoricalClubForMatch`에서 4원칙 시너지 + 명장 OVR 궁합이 반영된 실효 ATT/MID/DEF를 산출하고, `matchEngine.ts`에서 중복 가산 없이 역대 강팀 로스터에 개인 시너지 OVR을 적용해 유저 팀과 100% 동일 기준으로 대결하도록 동기화.

---

## v5.0.1 — 하프타임·연장 라커룸 통합 전술 UI 통일(구 상성 배지 제거) & 클릭형 `?` 지표 안내 패널 추가

- **하프타임·연장 라커룸 v5.0 통합 전술 UI 통일 (`src/components/common/UnifiedTacticsStrip.tsx`, `src/components/league/LiveMatchBroadcast.tsx`, `src/components/league/MatchDayTacticsRoom.tsx`, `src/components/dream/DreamMatchArena.tsx`)**:
  - 하프타임/연장 라커룸에 잔존하던 구버전 `evaluateTacticMatchup`/`evaluateFormationMatchup` 배지(`상성 우위 +2.8`, `호각`)를 완전 제거하고 경기 전과 동일한 `완성도 %` · `5대 구역(중원·측면·전환·박스·압박)` · `전술 버튼별 완성도 %` · 상대 감독 OVR 표기로 통일.
  - PC·모바일 공통으로 `?` 아이콘 클릭/터치 시 완성도 구성 비율(구조 35% · 선수 45% · 감독 20%), 전술 버튼 아래 `%` 의미, 5대 구역별 역할 및 실시간 대결 수치(하프타임 시 상대 감독 후반 변경 가능성 안내 포함)를 깔끔하게 토글 표시하는 공통 `UnifiedTacticsStrip` 컴포넌트 도입.

---

## v5.0 — 신규 포메이션 3종(4-4-2 다이아몬드 · 3-3-3-1 · 3-5-2 DM) · 현실 축구형 [통합 전술 수싸움] 엔진 · 선수 시너지 4원칙(전 소속팀 · 엘리트 페어) & 감독 궁합 독립 분리 · 전 구단 AI 감독(OVR/스타일) & 하프타임 능동적 수싸움

### 1. 신규 포메이션 3종 추가 (총 9종 포메이션 전면 확장)
- **신규 포메이션 좌표·슬롯·케미 링크·호환 포지션·2D 움직임 (`src/data/formations.ts`, `src/types/game.ts`, `src/engine/positionEngine.ts`, `src/engine/lineupOptimizer.ts`, `src/engine/tacticalMovement.ts`, `src/engine/tacticEngine.ts`)**:
  - **`4-4-2 다이아몬드 (4-4-2-diamond)`**: `GK / LB-CB-CB-RB / CDM / LCM-RCM / CAM / ST-ST` — 좁은 중앙 4인 다이아몬드 하프스페이스 장악, 풀백 터치라인 오버래핑, 투톱 연계 2D 움직임 구현.
  - **`3-3-3-1`**: `GK / LCB-CB-RCB / LWB(LM 호환)-CDM-RWB(RM 호환) / LAM(LW 호환)-CAM-RAM(RW 호환) / ST` — 비엘사식 전방 압박·초공격적 수적 우위·높은 수비 라인 뒷공간 리스크 반영.
  - **`3-5-2 DM (3-5-2-dm)`**: `GK / LCB-CB-RCB / LWB-RWB / LCDM-RCDM / CAM / ST-ST` — 더블 볼란치 수비 안정감·윙백 공수 전환·투톱 연계 구현.
  - `FormationSlot.alternateSubPositions` 지원으로 포지션 적합도(`evaluatePositionFit`), 자동 라인업 최적화(`lineupOptimizer.ts`), 9종 포메이션 선택 UI(`FormationSelect.tsx`, `MatchDayTacticsRoom.tsx`, `SquadManagerModal.tsx`, `UclDashboard.tsx`, `LiveMatchBroadcast.tsx`) 전역 확장.

### 2. 현실 축구형 [통합 전술 수싸움] 엔진 재설계
- **2단계 통합 전술 평가 엔진 (`src/engine/unifiedTacticsEngine.ts`, `src/engine/matchEngine.ts`)**:
  - 기존 분리된 포메이션/전술 단순 `+OVR!` 합산을 폐지하고, **1단계 내부 전술 완성도(`tacticalFit` = 포메이션×전술 구조 35% + 선발 11인 정규화 세부 능력치/플레이스타일 수행력 45% + 감독 스타일/OVR 20%)**와 **2단계 5대 구역 대결(`중원 주도권` · `측면 공간` · `뒷공간/전환` · `박스/공중볼` · `압박/탈압박`)**으로 재설계.
  - 구역 대결 결과가 실효 ATT/MID/DEF, 점유율, 임계치 기반 임상 xG/수비 억제력, 공격 루트 비중(`routeWeightMods`: 측면/중앙/역습/압박탈취/공중볼)에 직접 반영되며, 20시즌 EPL 밸런스 검증(`balanceVerification.test.ts`: OVR 90 1.15위/91.9점 · OVR 85 3.5위/72.9점 · OVR 79 10.95위/50.3점 · AI 1위 85.3점 · 84 OVR 풀시너지 업셋 승률 35%/무패율 61%) 통과.
- **미니멀 UI 원칙 준수 (`src/components/league/MatchDayTacticsRoom.tsx`, `TacticsGuideModal.tsx`, `SystemGuideModal.tsx`)**:
  - 매치 프리뷰 화면에서 번잡한 숫자 나열과 장황한 안내 텍스트를 제거하고 `[완성도 N% + 5대 구역 ▲/─/▼ + ? 툴팁]`의 깔끔한 1줄 지표로 정돈, 상세 수식과 원리는 기존 가이드/전술 도감 모달에 수록.

### 3. 선수 시너지 4원칙 단순화 · 공식 전 소속팀(Former Clubs) 커리어 연동 & 감독 궁합 독립 분리
- **선수 간 시너지 4원칙 엄격 통일 (`src/engine/chemistryEngine.ts`, `src/types/game.ts`, `src/components/common/PitchBoard.tsx`)**:
  - 레전드 와일드카드 및 전술/감독 혼합 링크를 완전 제거하고 오직 4원칙(**① 같은 팀/전 소속팀 35점 · ② 같은 국적 20점 · ③ 플레이스타일 궁합 30점 · ④ 엘리트 페어 OVR 88+ 15점**)으로 100점 체계를 통일하고 4색 케미선(에메랄드/스카이/앰버/퍼플)을 시각화.
- **공식 1군 커리어 기반 전 소속팀 데이터 (`src/data/formerClubs.ts`, `src/engine/dataLoader.ts`, `src/engine/uclEngine.ts`, `src/components/common/PlayerDetailModal.tsx`)**:
  - 추측·지어내기 금지 원칙 하에 검증된 공식 1군 출전 기록만으로 레전드 33명 전원 + 5대 리그/UCL 주요 스타 약 170명의 `formerClubs`(112개 구단 정규 명칭)를 구축해 과거 같은 팀 동료 간 시너지를 발동하고 선수 상세 모달에 전 소속 배지 표시.
- **감독 스타일 궁합 독립 분리 & 전 구단 전역 적용 (`src/data/managerTraits.ts`, `src/data/historicalTeams.ts`, `src/engine/matchEngine.ts`, `src/engine/conditionEngine.ts`)**:
  - 감독 스타일 궁합을 선수 간 시너지에서 분리해 감독 OVR과 스타일 적합도에 따라 선수 개인 실효 OVR을 직접 상승(`+1~+2`, 총 개인 보정 상한 `+3`)시키고, 5대 리그 96개 AI 구단·UCL 16구단·명예의 전당 14팀 전역에 동일 시너지 4원칙 적용.

### 4. 전 구단 AI 감독(OVR·스타일) 도입 & 하프타임 능동적 수싸움 (리그 · 컵 · UCL · 드림 매치)
- **전 구단 AI 감독 데이터베이스 (`src/data/aiManagers.ts`, `src/types/league.ts`, `src/data/historicalTeams.ts`)**:
  - 5대 리그 96개 구단(2026-27 실존 감독 기준), UCL 외곽 16구단, 명예의 전당 14팀 전 구단에 감독 OVR(70~99), 감독 스타일(`ManagerTraitId`), 선호 포메이션·전술 프로필 부여.
- **AI 감독 하프타임 능동적 대응 & 수석코치 현실성 (`src/engine/unifiedTacticsEngine.ts`, `src/engine/matchEngine.ts`, `src/engine/tacticEngine.ts`, `src/store/GameContext.tsx`, `src/components/league/LiveMatchBroadcast.tsx`, `src/components/dream/DreamMatchArena.tsx`)**:
  - 하프타임에 상대 AI 감독도 전반 스코어·점유율·5대 구역 유불리를 읽어 포메이션 변경, 전술 전환, 맞춤 교체(최대 2명)를 동시 실행하며, 감독 OVR 구간(`88+` 선제/정밀 카운터 · `80~87` 반응형 대응 · `<80` 단순/지연 대응)에 따른 수싸움 격차 구현.
  - 수석코치 하프타임 조언에 전반 데이터 기반 유력 관점과 상대 명장의 역카운터 불확실성을 현실적으로 반영하고, 후반 시작 시 상대 AI 감독이 대응한 경우 중계 헤더에 1줄 요약(`⚡ [감독명] 하프타임 대응: ...`) 표시.

---

## v4.1 — 명예의 전당 역대 강팀 14팀 17인 풀스쿼드·명장 시너지·공정 스코어 재조정 · [드림 매치] 챌린지 모드 · 기자회견/라커룸 8종 도트 배경 씬 & 경기 스탯 카드 연동

### 1. 명예의 전당 역대 강팀 14팀 풀스쿼드(총 238명) · 명장 능력치 & 공정 시즌 스코어 재조정
- **역대 최강 14팀 풀스쿼드·세부 능력치 완전 구체화 (`src/data/historicalSquadsData.ts`, `src/data/historicalTeams.ts`, `src/types/legacy.ts`)**:
  - 19-20·12-13 바이에른 뮌헨, 14-15·08-09 바르셀로나, 22-23·17-18 맨시티, 09-10 인터 밀란, 98-99 맨유, 23-24 레버쿠젠, 11-12 레알 마드리드, 03-04 아스널, 04-05 첼시, 13-14 유벤투스, 15-16 레스터 시티 14팀 모두를 포메이션 슬롯에 정확히 일치하는 **선발 11명 + 핵심 벤치 6명(총 238명)**으로 구체화하고 전성기 OVR·7+5 세부 능력치(`SHO/PAS/CRO/DRI/AER/DEF/PHY`, GK `DIV/HAN/REF/KIC/POS`)·플레이스타일·국기 코드를 완비.
  - 각 팀 명장(퍼거슨 99 · 과르디올라 98 · 무리뉴 96 · 하인케스 96 · 플릭 95 · 엔리케 95 · 벵거 95 · 콘테 93 · 사비 알론소 93 · 라니에리 91)에 실제 축구 평가에 맞는 `managerRating` · `managerTraitId` · 맞춤 도트 아바타(`managerAvatar`)를 부여하고 유저 팀과 동일한 `calculateChemistry` / `evaluateManagerPlayerSynergy` 엔진으로 실제 팀 케미와 감독 시너지 OVR 상승을 산출.
- **유저·역대 강팀 100% 동일 공정 시즌 스코어 재조정 (`src/engine/legacyEngine.ts`, `src/store/GameContext.tsx`, `LegacyHubModal.tsx`, `SeasonSummary.tsx`)**:
  - 리그 환산(`PPG×38×26 + GD환산×4.5`), 역사적 대업 보너스(`honorsBonus` + `honorsBonusDetails`: 트레블 `+1,500`, 더블 `+600`, 리그 무패 `+1,200`, 센추리온즈 환산 100점+ `+900`, 환산 100득점+ `+400`, 철벽 수비 환산 18실점 이하 `+800`, UCL 전승 `+850`/무패 `+400`), 언더독 기적 보너스(OVR 82 이하 가중, 상한 `+1,750`), 그리고 **스쿼드 완성도·팀 케미·감독 시너지·명장 지휘력 보너스(`squadCraftBonus` + `squadCraftDetails`)**를 유저(`computeUserSeasonManagerRating`)와 역대 강팀에 동일 적용.
  - 명예의 전당 상세 모달에서 역대 강팀 17인 풀스쿼드 선수 클릭 시 `PlayerDetailModal` 세부 능력치 레이더 차트 즉시 열람 지원.

### 2. 신규 모드: [⚔️ 드림 매치 (명예의 전당 챌린지)]
- **독립 드림 매치 아레나 (`src/components/dream/DreamMatchArena.tsx`, `src/store/GameContext.tsx`, `App.tsx`, `TitleScreen.tsx`, `LegacyHubModal.tsx`, `LiveMatchBroadcast.tsx`)**:
  - 타이틀 화면(`[⚔️ 드림 매치]`) 및 명예의 전당 역대 강팀 카드/상세 모달(`[⚔️ 도전하기]`)에서 진행 중인 정규 시즌 세이브를 건드리지 않고 독립 실행.
  - **방식 A (내 명전 팀 불러오기)**: `HallOfFameEntry`에 `fullStarters`/`fullBench` 풀스쿼드 스냅샷 저장을 보강하고, 구버전 명전 기록도 `reconstructHallOfFameSquad`로 현역/레전드 DB 매칭 및 세부 능력치 자동 복원 지원.
  - **방식 B (즉석 드림 드래프트)**: 1화면 빠른 설정 → 16인 룰렛 드래프트(레전드 4.0%, 임시 배치 시너지 프리뷰, 자유 스왑, 자동완성 지원).
  - `MatchDayTacticsRoom`(양 팀 피치 비교 + 상대 17인 풀스쿼드 스카우팅) → `LiveMatchBroadcast`(`override` 어댑터로 하프타임 라커룸 · 후반 일시정지 수동 교체 · 90'/105' 연장 라커룸 · 승부차기 100% 동일 엔진 플레이) → `MatchReportPanel`/`MatchDetailModal` 상세 리포트 및 `dreamMatchRecords` 격파 전적 영구 저장.

### 3. 기자회견 & 라커룸: 8종 도트 배경 씬 · 커스텀 감독 등장 · 직전 경기 스탯 카드 연동
- **상황별 8종 픽셀 아트 배경 씬 & 커스텀 감독 레이어링 (`src/components/common/PixelEventSceneBanner.tsx`, `src/data/managerEvents.ts`, `src/components/common/ManagerEventModal.tsx`, `src/types/condition.ts`, `App.tsx`)**:
  - 공식 기자회견장(`press_official`), 빅매치/UCL 야간 회견장(`press_ucl_night`), 경기 직후 믹스트존(`press_mixed_zone`), 홈 라커룸(`locker_home`), 경기장 출전 터널(`stadium_tunnel`), 감독실 1:1 면담실(`manager_office`), 훈련장 피치(`training_pitch`), 승리 환호 라커룸(`celebration_locker`) 8종 인라인 SVG 픽셀 아트 배경을 제작해 72종 이벤트에 자동 매칭(`resolveManagerEventSceneId`).
  - 유저가 커스텀한 `PixelManagerAvatar`를 각 배경 씬 내부(기자회견 단상·감독실 책상 전경 레이어 뒤 포함)에 직접 배치하고, 1:1 개인 이벤트 시 대상 선수 카드(국기·OVR·사기/부상 도트 아이콘)를 나란히 표시.
  - `buildManagerEventMatchContext`로 직전 경기 대회·라운드·스코어·xG·점유율·슈팅 및 대상 선수의 실제 경기 평점·골·도움·xG·원맨 드리블 돌파·선방·MOM/해트트릭/부진 배지를 요약 카드로 팝업 상단에 연동.

---

## v4.0 — 전 선수 세부 능력치(7+5종) 체계 · 단계별 공격 체인(원맨 드리블 쇼/중거리/티키타카/크로스 헤더) 엔진 업그레이드 · 2D 전술 움직임 심화 & 세부 능력치 가이드 탭

### 1. 전 선수 세부 능력치(Sub-Attributes) 체계 & 레이더 차트 시각화
- **타입 및 엔진 (`src/types/player.ts`, `src/data/attributeOverrides.ts`, `src/engine/attributeEngine.ts`, `src/engine/dataLoader.ts`)**:
  - 필드 7대 능력치(`SHO` · `PAS` · `CRO` · `DRI` · `AER` · `DEF` · `PHY`) 및 골키퍼 5대 전문 능력치(`DIV` · `HAN` · `REF` · `KIC` · `POS`)를 도입하고, `activePlayers.json`(2,206명) + `legendPlayers.json`(33명) 전원(총 2,239명)과 생성 로테이션 선수에 적용.
  - 5대 리그 주요 스타 및 레전드 33명 전원 큐레이션 프로필과 나머지 전 선수 아키타입·플레이스타일 기반 결정론적 파생 함수를 결합하고, 전 선수 포지션 가중 평균이 기존 `OVR ±2` 범위 내에 들도록 정규화(현역 최대 97, 레전드 최대 99).
  - 크랙·찬스메이커 윙어(야말·올리세·사카 등)의 득점력을 과도하게 깎지 않고도 `PAS·CRO·DRI` 가중치를 통해 현실적인 어시스트 비중이 자연스럽게 상승하도록 균형 설계.
- **UI 시각화 (`src/components/common/PlayerSubAttributesCard.tsx`, `src/components/common/PlayerDetailModal.tsx`)**:
  - 기존 다크 스포츠 UI 톤과 레이아웃을 그대로 보존한 채, `PlayerDetailModal`에 7각(GK 5각) SVG 레이더 차트 · 스탯 바 · 아키타입 자동 판정 배지 추가(시너지·사기·부상 실효 OVR 실시간 반영).

### 2. 세부 능력치 & 수비 경합 기반 단계별 공격 체인 경기 시뮬레이션 엔진
- **공격 체인 엔진 (`src/engine/attackChainEngine.ts`, `src/engine/matchEngine.ts`, `src/types/league.ts`)**:
  - 기존 단순 `att`/OVR 기반 득점·도움 배분을 **빌드업 → 14종 공격 루트(`AttackRouteId`) → 창출자(`PAS`/`CRO`/`DRI`) → 수비수(`DEF`/`AER`) 경합 → 마무리자(`SHO`/`AER` + 포지션 박스 점유 계수) → 마무리 유형(`FinishTypeId`)** 단계별 체인으로 전면 개편.
  - **원맨 드리블 쇼(`solo_dribble`, 수비 1~3명 단독 돌파)**, **중거리 대포알(`long_range_cannon`)**, **티키타카 삼각 원투패스(`tiki_taka_triangle`)**, **선수비 후역습 뒷공간 롱볼(`low_block_counter`)**, **게겐프레싱 탈취 속공(`gegenpress_steal`)**, **얼리 크로스 헤더/발리**, **컷백**, **스루패스 칩슛**, **코너킥 헤더** 등 다채로운 전개와 한국어 중계 문구 추가.
  - 팀 단위 `Poisson(λ)` 기대득점 모델과 밸런스 구간을 보존하면서, 승부차기(`SHO` vs `GK DIV/REF/POS`)와 점유율(`PAS` 대비 보정)에도 세부 능력치를 반영.

### 3. 현대 축구 2D 피치 전술 움직임 심화 & `[📊 세부 능력치 & 득점 루트]` 가이드 탭
- **2D 전술 움직임 (`src/engine/tacticalMovement.ts`, `src/components/league/PitchMatch2D.tsx`)**:
  - 전술별 오프더볼·빌드업·수비 조직력(점유율: GK 후방 빌드업 전진·인버티드 풀백·펄스 나인 연계·삼각 패스 / 게겐프레싱: 높은 라인·3인 압박 트랩 / 선수비 후역습: 낮은 중앙 밀집 블록·수직 롱볼 / 측면 공략: 풀백 터치라인 오버래핑·박스 쇄도)과 4종 신규 공격 루트 전용 슬로우모션 애니메이션 추가.
- **가이드 모달 탭 신설 (`src/components/guide/AttributeRoutesGuideContent.tsx`, `SystemGuideModal.tsx`, `TacticsGuideModal.tsx`)**:
  - `[가이드]` 모달(6번 탭) 및 `[전술 도감]` 모달(3번 탭)에 세부 능력치 항목·공격 루트별 경합 표·아키타입 골/도움 특성·전술별 2D 움직임을 정리한 **`[📊 세부 능력치 & 득점 루트]`** 탭 추가.

---

## v3.3 — 상대 구단 16인 규격(주전 11 + 핵심 벤치 5) 완벽 표시 · 트레이드 가치 용어 통일 · 포지션 니즈 비중 강화 & 돈치치급 충격 급매물 · 부상/사기 OVR 표시 & 전용 가이드 탭

### 1. 상대 AI 구단 벤치 누락 근본 해결 · 5대 리그 96구단 풀스쿼드 보강 & 핵심 벤치 5인(16인 규격) 표준화
- **원인 진단 및 구조 해결 (`src/engine/dataLoader.ts`, `src/engine/transferEngine.ts`, `src/utils/playerLookup.ts`, `src/store/GameContext.tsx`)**:
  - `buildAiClubRoster`가 선발 11명만 생성한 뒤 `buildTransferClubSquad`가 `if (aiRoster.length >= 11)` 분기에서 `ACTIVE_PLAYERS` 후보 풀을 건너뛰어 벤치가 `11 - 11 = 0명`으로 비어 보이던 버그를 해결.
  - `buildAiClubSquad16`을 도입해 모든 AI 구단이 우리 팀과 동일한 **16인 규격(선발 11명 + 핵심 벤치 5명: OVR 높은 순으로 `GK 1명 / DF 2명 / FW·MF 2명`)**을 갖추도록 표준화하고, 트레이드 성사 후에도 상대 구단 `rolledClubs.squad`가 즉시 새 16인 규격으로 갱신되도록 동기화.
- **FotMob 2026-27 기반 5대 리그 전 구단 벤치 보강 (`src/data/activePlayers.json`)**:
  - 마르세유(헤로니모 루이·루벤 블랑코), AS 로마(엘도르 쇼무로도프·올라 솔바켄), 데포르티보 알라베스(카를로스 비센테·아시에르 비얄리브레·토마스 코네치니) 등 포지션별 후보가 부족하던 13개 구단에 실존 2026-27 FotMob 등록 선수 18명을 보강하여 **96개 전 구단 `총원 ≥ 20명, GK ≥ 2, DF ≥ 6, MF ≥ 5, FW ≥ 4`(총 현역 2,206명, 전 세계 중복 0건, 레벤수 레전드 풀 유지)** 달성.

### 2. 트레이드 `가치` 한국어 표기 통일 · 포지션 니즈 비중 강화 & 루카 돈치치급 `🚨 충격 급매물`
- **트레이드 가치 표기 통일 (`src/components/transfer/TransferMarketModal.tsx`)**:
  - 이적시장 및 트레이드 전 화면·툴팁·비교 바에서 영어 약자 `TP`를 모두 자연스러운 한국어 **`가치`**(`가치 85`, `요구 가치`, `제시 가치`, `트레이드 가치 비교`)로 통일.
- **구단 포지션 니즈 비중 대폭 상향 & 충격 급매물 (`src/engine/transferEngine.ts`, `src/types/game.ts`)**:
  - 상대 구단 `#1 최우선 보강 포지션` **`+32%`**(성사율 `+8%p`), `#2 보강 포지션` **`+18%`**(`+4%p`), `포화 포지션` **`-25%`**(`-10%p`), 상대 포화 포지션 영입 시 요구 가치 **`-12%`**, 상대 부족 포지션 영입 시 **`+12%`**, 다인 패키지 니즈 완화 **`+15%`** 적용.
  - 현실의 루카 돈치치 트레이드처럼 드물게(선수당 약 `4.5%`, 구단당 최대 1명) 요구 가치 **`-35%` 할인 + 87+ 핵심 가드 면제 + 성사율 `+12%p`**가 적용되는 **`🚨 충격 급매물(evaluateShockBargainStatus)`** 및 타 구단이 먼저 상위 OVR 스타를 1:1로 제안하는 **`🚨 블록버스터 급매 제안(isBlockbusterBargain)`** 추가.

### 3. 부상·사기 OVR 증감 직관적 표시 & `[🩺 부상 & 사기 가이드]` 탭 추가
- **실효 OVR 통합 계산 내역 & 배지 시각화 (`src/engine/conditionEngine.ts`, `PitchBoard.tsx`, `SquadManagerModal.tsx`, `UclDashboard.tsx`, `PlayerCard.tsx`, `PlayerDetailModal.tsx`)**:
  - `computeFullPlayerOvrBreakdown`을 추가해 포메이션 피치·스쿼드 목록·선수 카드에 시너지(`+N`)와 함께 **사기 OVR 증감(`+2/+1/-1/-2`)** 및 **부상·회복기 OVR 페널티(빨간색 `-1~-4` / `결장`)**를 나란히 표시.
  - 호버 툴팁 및 `PlayerDetailModal` 상단에 **`기본 OVR / (포지션) / 시너지 / 사기 / 부상 → 최종 실효 OVR`** 5단 계산 패널 표시.
- **`[🩺 부상 & 사기 가이드]` 탭 신설 (`src/components/guide/InjuryMoraleGuideContent.tsx`, `SystemGuideModal.tsx`, `TacticsGuideModal.tsx`)**:
  - 상단 `[가이드]` 모달(5번 탭)과 `[전술 도감]` 모달(상단 탭 전환)에 부상 3등급(경상·중상·장기 부상) 확률·결장 기간·OVR 페널티·완치 시 자동 선발 복귀 규칙·사기 5단계 상승/하락 조건 및 불꽃 자연 냉각 규칙을 실제 코드와 100% 일치하게 정리한 전용 탭 추가.

---

## v3.2.1 — 이적시장 닫기 검은 화면 수정 · 양 팀 포메이션 피치 트레이드 뷰 · 선수 상세 카드 연동 · 제안 포지션 모순 제거 & 0% 확률 제거

### 1. 이적시장 닫기 시 검은 화면 멈춤 치명적 오류 수정
- **`src/components/transfer/TransferMarketModal.tsx`**:
  - `if (!season || !tm || !tm.isOpen) return null;` 뒤에 존재하던 `useMemo`로 인해 창 닫힘 시 발생하던 React Rules-of-Hooks 크래시(`Rendered fewer hooks than expected`)를 `TransferMarketModal` 래퍼 + `TransferMarketModalInner` 구조 분리로 근본 수정.

### 2. 타 구단 트레이드 제안 포지션 논리 모순 수정 & 선수 상세 카드 연동
- **`src/engine/transferEngine.ts`, `src/store/GameContext.tsx`**:
  - `generateIncomingTradeOffers`에서 상대 구단이 요청한 포지션 및 최우선 필요 포지션(`neededPositions[0]`) 선수는 절대 제시 카드에 포함하지 않도록 필터링(GK 필요 시 또는 GK ≤ 2명 시 GK 제시 원천 차단, 여유/포화 포지션 우선 제시, 단장 멘트 포지션 100% 일치).
  - `TRADE_ACCEPT_INCOMING`에 우리 팀 최소 GK 1명 유지 이중 안전 가드 추가.
- **`src/components/transfer/TransferMarketModal.tsx`**:
  - 받은 트레이드 제안·협상 테이블·양 팀 포메이션 피치·하단 벤치·레전드 FA 슬롯 전체에서 선수 이름(`PlayerNameButton`) 클릭 시 `PlayerDetailModal` 상세 카드가 즉시 열리도록 연동.

### 3. 양 팀 포메이션 피치 + 하단 벤치 트레이드 선택 뷰 & 확률 상향(0% 제거)
- **`src/components/transfer/TransferMarketModal.tsx`**:
  - 트레이드 선택 기본 화면을 양 팀 2D 포메이션 피치 + 하단 벤치 멤버 그리드로 개편(`[포메이션 보기 / 리스트 보기]` 전환 지원).
- **`src/engine/transferEngine.ts`**:
  - `evaluateTradePackage`의 성사 확률 곡선을 상향(동등 가치 ~72%, 상한 96%)하고 0% 확률 구간을 완전 제거(최소 2~3% 기적 도전 확률 유지).

---

## v3.2 — NBA식 구단 트레이드 전면 개편 · 드래프트 임시 자리 이동 · 2D 시뮬-통계 정합성 · 프리뷰 양 팀 비교 기본화 · UCL 스킵 팝업 & 1차전/합산 강조

### 1. 이적시장 → NBA식 구단 트레이드 제도 전면 개편 (Option 3 로스터 16인 균형)
- **트레이드 가치 & 포지션 니즈 엔진 (`src/types/game.ts`, `src/types/league.ts`, `src/engine/transferEngine.ts`)**:
  - 지수형 트레이드 가치(`Base TP = 10 × 1.185^(OVR-70)`), 체력·멀티포지션·시즌 폼·부상(-3%/-15%/-35%)·사기(-6%/+4%) 보정, 다대일 압축 보정(`100% / 78% / 60%`, 상대 필요 포지션 `+10%` 완화), OVR 87+ 슈퍼스타 최소 핵심급 가드(`maxUserOvr >= targetOvr - 7`) 도입.
  - 상대 구단 실제 스쿼드 분석(`analyzeClubPositionNeeds`)으로 최우선 보강(`+18%`)·보강(`+10%`)·포화(`-15%`) 포지션 배지와 예상 성사 확률(`0~95%`), 단장 반응 코멘트 생성.
  - **Option 3 자동 백업 매칭(`selectAutoFillerPlayers`)**: 2:1·3:1 다대일 트레이드 시 상대 구단 저OVR 로테이션 백업을 자동 매칭(유저 선택 변경 가능)해 우리 팀 16인(선발 11 + 벤치 5, GK 최소 1명)과 AI 구단 로스터 안전선 유지.
  - **타 구단 먼저 오는 트레이드 제안(`generateIncomingTradeOffers`)**: 매 이적시장 0~5건 생성, `[즉시 수락]` · `[조건 수정 · 역제안]` · `[거절]` 지원.
- **100% 양방향 로스터 동기화 & 트레이드 이력 (`src/store/GameContext.tsx`, `TransferMarketModal.tsx`, `PlayerDetailModal.tsx`)**:
  - `TRADE_SUBMIT_PACKAGE`, `TRADE_ACCEPT_INCOMING`, `TRADE_REJECT_INCOMING` 액션 신설 및 5대 리그(`aiRosters` + `otherLeagues`) + UCL(`ucl.aiRosters`) 양방향 선수 이동(전 세계 중복 0건), 누적 스탯 보존, `PlayerDetailModal` `🔄 트레이드` 배지 표시, 트레이드된 선수의 `injuryAutoReturns` 자동 정리.

### 2. 드래프트 임시 배치(프리뷰) 중 자리 이동(스왑) 지원
- **`src/components/draft/DraftScreen.tsx`**:
  - 후보 1회 클릭으로 피치에 임시 배치한 상태에서 기존 선발·벤치 선수들과 클릭·드래그 스왑 가능(`previewSwaps`), 이동 즉시 케미·개인 시너지 OVR·팀 실효 스탯 실시간 재계산, `[배치 원복]` 및 영입 확정 시 임시 스왑 일괄 반영.

### 3. 2D 경기 시뮬레이션 흐름 ↔ 실제 경기 통계 정합성 강화
- **`src/engine/matchEngine.ts`, `src/components/league/PitchMatch2D.tsx`, `src/components/league/LiveMatchBroadcast.tsx`**:
  - `generateHalfFlavorEvents`의 공격 찬스·골키퍼 세이브·VAR 하이라이트 수와 팀 소유 비중을 실제 슈팅 수·유효슈팅(비득점 선방 수)·xG에 비례하도록 연동.
  - `PitchMatch2D`에 실시간 슈팅·xG·전술 props를 전달해 빌드업→중원→파이널서드 단계적 전개, 지배 팀의 라인 압박 시프트, 전술별(점유·게겐프레싱·역습·측면) 움직임 패턴을 2D 피치에 구현.

### 4. 매치 데이 프리뷰 기본 화면 → [양 팀 피치 비교] 기본값 변경
- **`src/components/league/MatchDayTacticsRoom.tsx`**:
  - 기본 탭을 `'split'`(`[양 팀 피치 비교]`)으로 변경하고 모바일·데스크톱 모두에서 1순위 탭으로 배치.

### 5. UCL 토너먼트 1경기 스킵 결과 팝업 모달 & 1차전/합산 스코어(AGG) 강조
- **`src/components/ucl/UclDashboard.tsx`, `MatchDayTacticsRoom.tsx`, `LiveMatchBroadcast.tsx`, `UclBracketTree.tsx`**:
  - 자동 소멸되던 상단 스킵 배너를 영구 팝업 모달(`#ucl-skip-result-modal`)로 교체해 리그 페이즈·플레이오프·16강·8강·4강·결승 모든 1경기 스킵 시 단판 스코어 + 1차전/합산(AGG) + 진출/탈락/연장/PK 판정 + 득점자 + 스탯 + `[상세 기록 보기]`를 즉시 표시.
  - 2차전 프리뷰(`firstLegBanner`), 2D 중계 전광판 및 하프타임 라커룸(`실시간 합산(AGG)` + 필요 골 수 배지), 브래킷 트리(`UclBracketTree`) 전반의 1차전·합산 스코어 시인성 대폭 강화.

---

## v3.1 — 누적 피로도 완전 삭제 · 포메이션 피치 부상 교체 팝업 · 부상 완치 선발 자동 복귀

### 1. 누적 피로도(Fatigue) 시스템만 완전 삭제 & 단독 부상 확률 재조정
- **누적 피로도 전면 제거 (`src/types/condition.ts`, `src/engine/conditionEngine.ts`, `PitchBoard.tsx`, `SquadManagerModal.tsx`, `OpponentPitchView.tsx`, `SeasonDashboard.tsx`, `ClubSquadModal.tsx`, `PlayerDetailModal.tsx`, `managerEvents.ts`)**:
  - 우리 팀 및 5대 리그 AI 구단 전체의 경기 간 누적 피로도 계산·OVR 페널티·피로 로테이션·UI 피로도 게이지/배지/문구를 모두 삭제.
  - **유지 항목**: 3단계 부상 시스템(도트 십자가·사기 하락·AI 부상 결장/대체), 사기 시스템(도트 불꽃/얼음·72종 기자회견/라커룸 연설 — 연전 이벤트는 `consecutiveMatchesPlayed >= 4` 기준으로 연동), 단일 경기 내부 체력(`staminaEngine.ts`·`matchEngine.ts` 하프타임/연장전 교체용)은 그대로 유지.
  - 피로도 배율 제거에 맞춰 90분 기준 단독 기본 부상 확률을 재조정: **경상 `0.42%`**(시즌당 선수단 전체 약 2~2.5회), **중상 `0.030%`**, **치명적 중상 `0.006%`**, 경상 출전 강행 악화 고정 `6%`, 경기당 팀 신규 부상 최대 1명 캡 유지.

### 2. 부상 발생 교체 팝업 → 실제 스쿼드 포메이션 피치 화면 개편
- **포메이션 피치 기반 교체 모달 (`src/components/common/InjuryAlertModal.tsx`, `PitchBoard.tsx`, `App.tsx`)**:
  - 기존 [내 스쿼드]와 동일한 `PitchBoard`(`compact`)를 재사용해 부상 발생 시 포지션을 외우지 않아도 한눈에 라인업을 보고 교체 가능.
  - 방금 부상당한 선수 슬롯을 빨간 테두리·링·`부상 발생` 배지(`highlightedPlayerIds`)로 강조하고 기본 선택 상태로 지정.
  - 선발 ↔ 선발 포지션 스왑 후 빈자리에 벤치 선수를 넣는 유연한 로테이션 지원 + 선택 슬롯에 맞춰 실시간 갱신되는 후보 벤치 목록(포지션 적합도·실효 OVR·`추천` 배지·원클릭 투입).

### 3. 부상 완치 시 원래 선발 라인업 자동 복귀 & 상단 토스트
- **자동 복귀 엔진 & 예외 안전장치 (`src/engine/conditionEngine.ts`, `src/store/GameContext.tsx`, `src/components/common/InjuryReturnToast.tsx`, `src/types/game.ts`)**:
  - 부상 교체 팝업에서 부상 선발을 벤치로 내리고 대체 투입 확정 시 `{ injuredPlayerId, injuredPlayerName, originalSlotIndex, replacementPlayerId }`를 `season.injuryAutoReturns`에 기록.
  - 라운드 진행(일반 경기·스킵·2D 라이브·고속진행·컵·UCL 공통) 중 결장 기간이 끝나 완치(`matchesRemaining === 0`)되면 자동으로 원래 선발 슬롯에 복귀시키고 임시 대체 선수는 벤치로 반환(다단계 선발 스왑도 역복원).
  - 이적·방출된 선수, 이미 수동 복귀한 선수 등 예외 상황에서도 중복·누락 없이 안전 처리하며, 자동 복귀 시 화면 상단에 `InjuryReturnToast` 배너 표시.

---

## v3.0.2 — 사기 불꽃(🔥) 쿨다운 & 단독 불꽃 중심 개편 · 부상 시 사기 하락 · 72종 이벤트 전원 리스크 분기
- **사기 밸런스 전면 개편 (`conditionEngine.ts`, `GameContext.tsx`, `managerEvents.ts`)**:
  - 불꽃(`🔥`, 사기 `+4~+5`) 자연 냉각(쿨다운) 및 엄격한 불꽃 진입 게이트 도입: 평소에는 MOM(`+3`)·멀티골/평점 9.0+(`+2`)·연속 득점·1:1 면담 등 단독 활약 중심으로 불타오르고, 다수 동시 불꽃은 7연승+·4골 차 이상 대승·빅매치 3골 차 완승 등 클라이맥스에만 발동.
  - 클린시트 사기 보너스를 수비진 전원에서 최고 평점 GK/DF 1명으로 집중.
- **부상 빈도 2차 튜닝 & 부상 시 사기 하락 (`conditionEngine.ts`, `InjuryAlertModal.tsx`)**:
  - 부상 발생 시 등급별 사기 하락(경상 `-1`, 중상 `-2`, 치명적 중상 `-3` + 팀 사기 `-1`) 도입 및 부상 알림 카드 배지 추가.
- **기자회견·라커룸 연설 72종 100% 리스크/사기 하락 분기 완비 (`managerEventsPress.ts`, `managerEventsLocker.ts`)**:
  - 기존 안전 선택지만 존재하던 46개 이벤트를 포함해 72종 전 이벤트에 답변 선택에 따른 사기 하락/역효과(`-1/-2`) 분기 추가 및 안전 팀 선택지 `+2` 인플레이션 완화.

---

## v3.0.1 — 부상 빈도 대폭 하향 (~65%) & 경기당 팀 신규 부상 최대 1명 캡
- **부상 빈도 1차 하향 (`conditionEngine.ts`, `InjuryAlertModal.tsx`)**:
  - 경상·중상·치명적 중상 기본 발생 확률 약 65% 하향, 경상 출전 강행 악화 확률 완화, 경기당 팀 신규 부상 **최대 1명 캡** 도입.

---

## v3.0 — 전 리그 누적 피로도 & 3단계 부상 · 사기 & 72종 기자회견/라커룸 연설 · 도트 상태 아이콘 · 105개국 SVG 국기

### 1. 전 리그·전 대회 누적 피로도 & 현실적 3단계 부상 시스템
- **통합 컨디션 엔진 (`src/types/condition.ts`, `src/engine/conditionEngine.ts`, `dataLoader.ts`, `staminaEngine.ts`, `otherLeaguesEngine.ts`, `cupEngine.ts`, `uclEngine.ts`, `GameContext.tsx`)**:
  - 우리 팀 16인 + 유럽 5대 리그 AI 95구단 + 36팀 UCL 참가 구단 전원에 정규 리그·자국 컵·챔피언스리그 연전 연동 누적 피로도(`0~100`) 적용.
  - 피로 구간별 실효 OVR 보정(`40~59: -1.0`, `60~79: -2.5`, `80+: -4.5`), 경기 시작 체력 상한, 부상 위험 배율(`1.0x → 1.3x → 1.9x → 2.8x`) 연동 및 휴식 시 대폭 회복(`-24`).
  - 200시즌 시뮬레이션 기반 정밀 튜닝(선수단 전체 시즌당 경상 약 2~3회, 중상·치명상 극희귀 + 경기당 팀 신규 부상 최대 1명 캡): **경상**(1~3경기 결장, 사기 `-1`, 출전 강행 시 OVR `-2~-4` & 악화 리스크 `+6%`), **중상**(4~8경기 결장, 사기 `-2` + 2경기 회복기), **치명적 중상**(극저확률 18~28경기 장기 이탈, 사기 `-3`/팀 사기 `-1` + 3경기 회복기).
  - AI 구단 자동 로테이션(고피로 주전 휴식, 부상자 대체 투입) 및 상대 프리뷰(`OpponentPitchView`)·구단 모달(`ClubSquadModal`) 부상/피로 실시간 반영.
- **우리 팀 부상 알림 팝업 & 고속진행 자동 일시정지 (`InjuryAlertModal.tsx`, `FastSimModal.tsx`, `App.tsx`)**:
  - 부상명·등급·예상 결장 경기 수·사기 하락 배지·가용 벤치 대체 선수 TOP 3 추천 및 원클릭 `[즉시 대체 투입]` 제공, 고속진행 중 주전 부상 발생 시 자동 일시정지.

### 2. 팀/포지션 라인/선수 단위 사기(Morale) & 72종 기자회견·라커룸 연설
- **사기 밸런스 & 72종 대규모 이벤트 풀 (`src/data/managerEventsPress.ts`, `src/data/managerEventsLocker.ts`, `src/data/managerEvents.ts`, `ManagerEventModal.tsx`)**:
  - 개인 사기(`-5~+5`, 실효 OVR `±2.0`) + 팀 분위기(`±0.5`) 2축 시스템에 자연 냉각(쿨다운) 및 불꽃(`🔥`) 진입 게이트 적용: 평소에는 MOM·멀티골·연속 득점·1:1 면담 등 단독 활약 중심으로 불타오르고, 다수 동시 불꽃은 7연승+·4골 차 대승·빅매치 3골 차 완승 등 진정한 클라이맥스에만 발동.
  - 기자회견 36종 + 라커룸 연설 36종 = **총 72종** 전원(100%)에 답변 선택에 따른 사기 하락/역효과 리스크 분기 완비, 동일 시즌 중복 방지 큐(`usedEventIds`) 및 쿨다운, 동적 변수 치환(`{playerName}`, `{opponentName}`, `{teamName}`, `{streak}`, `{positionGroup}`, `{rank}`), 결과 리포트 UI 구현.
- **전용 도트 SVG 상태 아이콘 3종 (`src/components/common/PixelStatusIcon.tsx`)**:
  - 부상(의료용 빨간 십자가), 사기 최상(도트 불꽃), 사기 최악(도트 얼음 결정) 픽셀 아트 아이콘 제작 및 피치보드·카드·스쿼드·상대 프리뷰·상세 모달 통합.

### 3. 전 세계 105개국(2,397명) Windows 호환 인라인 SVG 국기 아이콘
- **100% 인라인 SVG 국기 컴포넌트 (`src/components/common/CountryFlagSvg.tsx`, `playerLookup.ts`)**:
  - Windows Chrome/Edge에서 유니코드 국기 이모지가 `KR`, `GB` 글자로 깨지는 문제를 완전 제거하고 데이터셋 전체 105개국(2,397명 100%)을 선명한 인라인 SVG로 렌더링.
  - 잉글랜드·스코틀랜드·웨일스·북아일랜드 4개 영국 홈네이션 국기 구분 지원 + 한국/대한민국 태극기 통합, 전 선수 카드·피치·드래프트·이적시장·득점/도움/평점 순위·상세 모달 전면 적용.

---

## v2.9 — 모바일 브라우저 터치 좌표(Hit-Test) 밀림 완벽 수정 · 동적 뷰포트(100dvh) & 단일 스크롤 안정화

### 1. `html` · `body` · `#root` 단일 문서 스크롤 & 동적 뷰포트(`100dvh`) 정상화
- **모바일 뷰포트·오버플로 구조 정비** (`index.html`, `src/index.css`, `src/App.tsx`, `TitleScreen.tsx`, `TransferMarketModal.tsx`):
  - `html`, `body`, `#root`에 단일 문서 스크롤 기반 `overflow-x: clip` 및 `width/max-width: 100%`를 적용하고, 기존 `100vh`(`min-h-screen`) 기반 높이를 모바일 주소창 축소/확장에 즉시 대응하는 `100dvh`(`min-h-dvh`)로 교체.
  - `viewport-fit=cover` 및 전역 인터랙티브 요소(`button, [role="button"], a, input, select`)에 `touch-action: manipulation` 적용.

### 2. 상단 `sticky` 헤더 모바일 가로폭 초과 해결 & `backdrop-blur` 합성 레이어 제거
- **터치 좌표계 불일치 근본 해결** (`src/components/common/HeaderNav.tsx`, `MatchDayTacticsRoom.tsx`, `OpponentPitchView.tsx`, `TransferMarketModal.tsx`):
  - 상단 `sticky top-0` 헤더가 모바일(`360~390px`) 화면에서 가로폭(`~500px`)을 초과해 Layout Viewport와 Visual Viewport의 터치 좌표계를 어긋나게 만들던 문제 해결(PC 1줄 텍스트 버튼 유지, 모바일 컴팩트 아이콘 레이아웃으로 `300px` 이내 수납).
  - 모바일 스크롤 시 GPU 합성 레이어 좌표 오차를 유발하던 `sticky` 헤더 `backdrop-blur-md`, 매치 데이 전술실 하단 `sticky bottom-2 backdrop-blur-md`, 상대 피치 노드 `backdrop-blur-xs`, 이적시장 중첩 모달 `backdrop-blur-sm` 제거.

### 3. 매치 데이 전술실 액션 버튼 상단 통합 & 드래프트 터치 레이아웃 점프(Layout Shift) 제거
- **터치 시 레이아웃 흔들림 차단** (`MatchDayTacticsRoom.tsx`, `RouletteReelsView.tsx`, `PlayerCard.tsx`, `PitchBoard.tsx`):
  - 매치 데이 전술실의 `[2D 실시간 중계 시작]`·`[1경기 스킵]` 버튼을 상단 전술·포메이션 컨트롤 카드 내부에 통합 배치하고 포메이션 그리드를 모바일 3열(`grid-cols-3`) / PC 6열(`sm:grid-cols-6`)로 반응형 분리.
  - 드래프트 프리뷰 바의 선택 전/후 높이를 `min-h-[84px]`로 고정하고 선수 카드·피치 노드의 `hover:-translate-y-0.5`·`scale-105` 이동을 제거.

---

## v2.8 — 매치 데이 전술실 상대 피치 시각화 · 드래프트 임시 배치 시너지 프리뷰 & 공식 가이드 · 원스톱 이적시장 · 정규리그 최종 결과 배너 & 5대 리그 도트 트로피 · UCL UI 폴리싱

### 1. 경기 전 [매치 데이 전술실] 레이아웃 전면 정돈 & 상대팀 포메이션 피치 시각화
- **상대팀 포메이션 피치 시각화** (`src/components/league/OpponentPitchView.tsx`, `MatchDayTacticsRoom.tsx`):
  - 상대 예상 선발 11인을 테이블/리스트 대신 컴팩트 포메이션 피치 위에 배치하고 핵심 경계 선수(TOP 3)·OVR·주포지션·플레이스타일을 직관적으로 시각화.
  - 상단 양 팀 전력 비교 바(우리 팀 vs 상대 팀 포메이션·전술·실시간 상성 진단 1줄 스트립·ATT/MID/DEF 스탯 비교 필), 상시 노출 전술·포메이션 컨트롤 및 경기 액션 바, 3모드 피치 전환(`[상대 포메이션]` / `[내 선발 편집]` / `[양 팀 피치 비교]`) 적용.

### 2. 드래프트 포메이션 임시 배치(시너지 실시간 프리뷰) & 체계적인 시너지 공식 가이드
- **1회 클릭 임시 배치 & 시너지 실시간 프리뷰** (`src/components/common/PitchBoard.tsx`, `PlayerCard.tsx`, `RouletteReelsView.tsx`, `DraftScreen.tsx`):
  - 후보 카드 1회 클릭 시 포메이션 피치 해당 슬롯에 `[프리뷰]` 상태로 임시 배치되어 감독 시너지(`+1`)·인접 팀원 케미(`+0~+2`) 합산 개인 OVR 상승량(`+1~+3`), 3색 병렬 연결선, 팀 케미 변화(`+Δ`), `ATT/MID/DEF` 증감이 실시간 계산·표시되며 `[영입 확정]`(또는 재클릭)으로 확정.
- **코드 100% 일치 시너지 공식 가이드 패널** (`DraftScreen.tsx`):
  - 드래프트 상단 가이드 바에 `[📐 시너지 & OVR 상승 공식 가이드]` 탭을 추가해 개인 시너지(`+1~+3`) 조건, 인접 연결 점수(`구단 +1.6 / 레전드 +1.2 / 국적 +1.1 / 보완 스타일·전술 +1.0`), 4대 축 팀 케미 공식을 명확히 표기.

### 3. 이적시장 원스톱 UX 개편 (PC·모바일 스크롤 왕복 제로)
- **원스톱 영입 협상 모달** (`src/components/transfer/TransferMarketModal.tsx`):
  - 영입 대상의 `[영입 협상 제안]` 클릭 즉시 화면 중앙/하단에 원스톱 협상 모달이 열리며, 한 화면 안에서 `[IN 영입 대상]` ↔ `[OUT 방출할 우리 팀 선수 선택(⚡ AI 추천 Top 5 / 선발 11인 / 벤치 5인 탭 + 실효 OVR 변화 실시간 비교)]` ↔ `[오퍼 제출 & 성공 확률 확인]`까지 스크롤 왕복 없이 완료.

### 4. 정규 리그 최종 라운드 종료 시점 '시즌 결과 팝업 배너' & 5대 리그 전용 도트 우승 트로피
- **시즌 결과 팝업 배너 & 5대 리그 도트 트로피** (`src/components/common/PixelTrophySvg.tsx`, `src/components/league/LeagueFinaleBannerModal.tsx`, `SeasonSummary.tsx`):
  - 정규 리그 최종 라운드(34R/38R) 종료 즉시 최종 순위, 전적(승/무/패), 순수 정규 승점(PTS), 득실차를 요약하는 팝업 배너 노출.
  - 1위(리그 우승) 시 5대 리그별 고유 도트 우승 트로피 SVG(`epl_league` 크라운 트로피, `laliga_league`, `seriea_league` 스쿠데토, `bundesliga_league` 마이스터샬레, `ligue1_league` 헥사고알) 축하 연출, 2~4위 `🏆 챔피언스리그 진출!`, 하위 강등권 `🔻 강등!` 맞춤 배너 분기.

### 5. 우측 상단 헤더 1줄 고정 · UCL 스쿼드 피치 비율 정규화 · UCL 1경기 스킵 결과 스코어 배너
- **헤더 1줄 정렬** (`src/components/common/HeaderNav.tsx`):
  - 우측 상단 버튼(`패치노트`, `레거시`, `전술 도감`, `가이드`, `초기화`) 전체에 `whitespace-nowrap shrink-0` 및 컴팩트 여백 적용, 단계 표시줄 `xl:flex` 조정으로 2줄 줄바꿈 완전 해결.
- **UCL 내 스쿼드 피치 정규화 & 1경기 스킵 결과 배너** (`src/components/ucl/UclDashboard.tsx`):
  - UCL `[내 스쿼드 / 전술]` 탭 피치를 정규 리그 스쿼드 관리 창과 동일한 비율(`lg:col-span-5` + `max-w-[460px]` + `compact`)로 정규화하고 우측에 16인 UCL 스탯 요약 리스트 추가.
  - UCL `[1경기 스킵]` 클릭 시 라운드명, 양 팀 스코어, 승/무/패(PK) 배지, 득점자 요약, `[상세 기록]` 버튼이 포함된 결과 스코어 배너 즉시 표시.

---

## v2.7 — 시너지 OVR · 매치 데이 전술실 & 상성 도감 · 연장 라커룸 통일 · 도트 감독 리뉴얼 · 5대 리그 구체화 & 난이도 상향

### 1. 드래프트 감독 시너지 가이드 & 포메이션 피치 선수 단위 시너지 OVR
- **드래프트·이적시장 감독 시너지 가이드** (`src/data/managerTraits.ts`, `PlayerCard.tsx`, `DraftScreen.tsx`, `TransferMarketModal.tsx`):
  - 14종 감독 특성별 `synergyPlaystyles`·`draftGuideTip` 및 `evaluateManagerPlayerSynergy` 추가.
  - 드래프트 상단 접이식 `[⭐ 내 감독 추천 선수 스타일]` 가이드 바 및 선수 카드 `⭐ 감독 시너지` 배지·사유 툴팁 추가.
- **피치 위 선수 단위 시너지 OVR 표시 & 엔진 직결** (`src/engine/chemistryEngine.ts`, `matchEngine.ts`, `PitchBoard.tsx`, `PlayerDetailModal.tsx`):
  - 감독 궁합(+1) + 인접 팀원 케미(구단/국적/보완 스타일, +0~+2) 합산 개인 시너지 `slotSynergies`(+0~+3) 산출 및 `applySlotSynergiesToStarters`로 경기 시뮬레이션 엔진에 직접 반영.
  - 피치 위 각 선수 카드에 녹색 `(+1~+3)` 배지 및 호버/상세 모달 상승 내역 표시.

### 2. 경기 전 [매치 데이 전술실] · 전술/상성 영향력 강화 · [전술 & 플레이스타일 상성 도감]
- **매치 데이 전술실** (`src/components/league/MatchDayTacticsRoom.tsx`, `SeasonDashboard.tsx`, `UclDashboard.tsx`):
  - 경기 시작 전 상대 예상 포메이션·전술·선발 11인(OVR·플레이스타일) 스카우팅 및 탭 이동 없는 인라인 전술·포메이션·선발 라인업 수정 지원.
- **전술·플레이스타일 상성 밸런스 강화 & 상성 도감** (`src/engine/tacticEngine.ts`, `src/components/common/TacticsGuideModal.tsx`, `HeaderNav.tsx`):
  - `TACTIC_MATRIX` 강화(±2.2→±2.8, ±0.9→±1.1) 및 `evaluatePlaystyleTacticMatchup` 영향력 상향(ATT/MID/DEF 최대 +1.6, xG ±0.14).
  - 실시간 상성 진단 배지(`🟢/🟡/🔴` + 한 줄 사유)와 헤더·전술실·라커룸 어디서나 열 수 있는 1페이지 `[전술 & 플레이스타일 상성 도감]` 모달 추가.

### 3. 연장전(90분·105분) 교체 UX 하프타임 완전 통일 & 연장 수석코치 조언
- **연장 전/후반 분할 시뮬 & 통합 라커룸** (`src/engine/matchEngine.ts`, `src/engine/tacticEngine.ts`, `src/store/GameContext.tsx`, `LiveMatchBroadcast.tsx`):
  - `simulateExtraTimeFirstHalf`(91'~105')와 `simulateExtraTimeSecondHalfAndPenalties`(106'~120'+PK) 분리 구현 및 `extra_time_break`(90')·`extra_time_ht`(105') 양쪽 모두 하프타임 라커룸과 완전히 동일한 2단 UX(피치보드, 자유 스왑, 빠른 선발, 교체 확인창, 최대 6명 교체, 실시간 체력 게이지)로 통일.
  - `buildExtraTimeCoachBriefing`으로 연장 추가 교체 1장 안내, 체력 방전(<52%) 선수 지목, 승부차기 키커 TOP 5 및 원클릭 추천 교체 제공.

### 4. 감독 도트 캐릭터 전면 리뉴얼 — 성별별 실루엣·헤어·의상 완전 분리
- **픽셀 아트 전면 개편** (`src/types/game.ts`, `PixelManagerAvatar.tsx`, `ManagerRouletteScreen.tsx`, `clubPresets.ts`):
  - 여성 감독 턱·입 주변 수염 노이즈(`y=16..17` 그림자 바) 완전 제거 및 남/여 호감형 얼굴 디테일 정교화.
  - 여성 감독 전용 모래시계 실루엣(슬림한 어깨, 자연스러운 바스트 음영, `y=22..23` 잘록한 허리, `y=24..26` 골반/스커트 플레어)을 모든 의상에 일관 적용.
  - 남성 전용 헤어 5종(`fluffy`/`parted`/`slick`/`buzz`/`bald`) & 의상 5종, 여성 전용 헤어 4종(`bob` C컬/`ponytail`/`long_wave`/`updo_bun`) & 의상 4종(`female_blazer`/`female_trench`/`female_tracksuit`/`female_knit_skirt`) 완전 분리 및 구버전 세이브 자동 매핑(`normalizeAvatarForGender`).

### 5. 승점(Points) 집계 오류 수정 — 정규 리그 전용 엄격 분리
- **정규 리그 전용 승점 규칙 통일** (`src/types/league.ts`, `analyticsEngine.ts`, `TeamAnalyticsTab.tsx`, `SeasonSummary.tsx`):
  - `computeMatchesOnlyAnalytics`의 가짜 합산 승점(`won * 3 + drawn`) 산출을 제거하고 `competitionScope`·`leaguePoints`·`winRatePct` 도입.
  - 통합 탭은 순수 `리그 승점` 명시 + 총 전적·승률(%) 표시, 컵·UCL 탭은 최종 성적·승률(%) 표시로 정리. 시즌 스코어(PPG×38) 및 명예의 전당 정합성 검증 완료.

### 6. 유럽 5대 리그 전체 스쿼드·스탯·자국 컵 구체화 · 100% 공정 발롱도르 & 난이도 상향
- **타 4대 리그 완전 구체화** (`src/engine/otherLeaguesEngine.ts`, `cupEngine.ts`, `uclEngine.ts`, `playerLookup.ts`, `SeasonDashboard.tsx`, `SeasonSummary.tsx`):
  - 미선택 4개 빅리그도 실제 `activePlayers.json` 스쿼드(`aiRosters`) 기반 `simulateMatch` + 개인 스탯(`playerStats`) + 16팀 자국 컵(`cup`, `cupPlayerStats`)을 실시간 시뮬레이션하고 UCL 36팀과 동일 로스터 공유.
  - 순위/기록 탭 및 시즌 결산 탭에서 타 4대 리그 우승팀·자국 컵 우승팀·득점/도움/평점 순위 및 선수 상세 스탯·우승 이력을 직접 열람 가능.
- **100% 동일 기준 발롱도르/월드베스트 XI & 난이도 밸런싱** (`src/engine/awardsEngine.ts`, `matchEngine.ts`):
  - `awardsEngine.ts`의 타 리그 상위 3팀 합성 스탯 로직을 완전 제거하고 5대 리그 전원 동일 기준·실제 스탯·우승 커리어로 평가.
  - AI 구단 티어별 조직력 보정, UCL 강도 보정, 원정 xG 압박, 강팀 후반 체력 스쿼드 깊이 반영 및 유저 상시 버프 중복 정리.

### 7. 선수 상세 팝업 클릭 범위 통일 — 선수 이름 텍스트 전용
- **전역 클릭 범위 정비** (`PlayerNameButton.tsx`, `TeamAnalyticsTab.tsx`, `SeasonDashboard.tsx`, `SeasonSummary.tsx`, `UclDashboard.tsx`, `ClubSquadModal.tsx`, `MatchReportPanel.tsx`, `MatchDetailModal.tsx`, `SquadManagerModal.tsx`):
  - 모든 기록표·순위표·리포트·어워즈·스쿼드 모달의 행/카드 전체 클릭을 제거하고 `PlayerNameButton`으로 선수 이름 텍스트 클릭 시에만 `PlayerDetailModal`이 열리도록 통일.

---

## v2.6 — FotMob 2026-27 5대 리그 96개 구단 전수 교차검증 · 근거 기반 OVR 전면 재조정

### 1. FotMob(`fotmob.com/ko`) 2026-27 5대 리그 96개 구단 100% 전수 교차검증
- **96/96 구단 전수 검증 및 현역 풀 2,188명 확장** (`src/data/activePlayers.json`, `src/data/leagues.json`, `src/data/uclTeams.json`):
  - EPL 20구단(462명), 라리가 20구단(432명), 세리에A 20구단(472명), 분데스리가 18구단(424명), 리그1 18구단(398명) — 총 **2,188명(구단당 최소 18명 이상, 미확인 구단 0건)** 전면 반영.
  - FotMob 공식 포지션 태그(`DM→CDM`, `AM→CAM` 포함) 기반 복수 주포지션·부포지션 정비로 드래프트 시 구단별·포지션별 OVR 상위 3명 노출 정확도 극대화.
  - RB 잘츠부르크 UCL 외곽 로스터의 `케림 알라이베고비치`(유벤투스 이적)를 `에드문드 바이두`로 교체해 전 세계 **2,397명**(현역 2,188 + 레전드 33 + UCL 외곽 176) 중복 ID 0건·중복 선수명 0건 달성.
  - '레벤수'(로베르트 레반도프스키·카림 벤제마·루이스 수아레스) 현역 풀 제외 및 레전드 풀 전용 규칙 100% 유지.

### 2. 근거 기반 OVR 전면 재조정 & 다비드 라야 월드클래스(90) 승격
- **2계층 근거 기반 OVR 산정**:
  - 1계층: FotMob 이적 시장가치 로그 곡선 + 나이 커브(30대 베테랑 보호, 16~21세 유망주 프리미엄 완화) + 포지션별 시장가치 보정(GK/DF/CDM) + 리그·구단 티어 컨텍스트 반영.
  - 2계층: 슈퍼스타(91~94) 19명·월드클래스(87~90) 67명 정밀 큐레이션 — **다비드 라야(아스널 GK) 86 → 90 월드클래스 최상위 승격** (돈나룸마 91·쿠르투아 91 다음 현역 GK 3위권).
- **96개 구단 전력·대표 득점원 동기화**: `leagues.json`의 전 구단 `att`/`mid`/`def`와 `topScorers`(3인)를 FotMob 검증 스쿼드 기준으로 재산출.

### 검증 결과
- 유닛 테스트: **17개 파일 / 55개 테스트 전부 PASS** (20시즌 EPL 밸런스 검증: OVR 90 평균 1.15위/90.7점, OVR 85 평균 3.35위/73.4점, OVR 79 평균 9.4위/53.0점, AI 1위 83.4점, 84 풀시너지 업셋 승률 52%).
- 전역 무결성: 중복 ID 0건, 중복 이름 0건, 영문 미번역 이름 0건, `oxlint` 0 errors, `tsc -b && vite build` 성공.

---

## v2.5 — 2026-27 전면 로스터 재검증 · 레벤수 레전드 편입 · 글로벌 고유 선수 & 이적 스탯 합산 · 발롱도르 1회 시상 · 리그컵 트리 & 선수/경기 상세 모달

### 1. 5대 리그 2026-27 로스터 전면 재검증 & '레벤수' 레전드 편입
- **5대 리그 96개 구단 & UCL 외곽 16개 구단 전면 정비** (`src/data/activePlayers.json`, `src/data/leagues.json`, `src/data/uclTeams.json`):
  - EPL·라리가·세리에A·분데스리가·리그1 96개 구단 현역 1,179명(구단당 최소 7명 이상, 슈퍼스타 91~94 정확히 19명) 및 UCL 외곽 16개 구단 176명을 2026-27 최신 공식 이적·승격/강등 기준으로 재검증.
  - 라치오 중미(다비데 프라테시·케네스 테일러·니콜로 로벨라) 등 누락 핵심 자원 전면 보강 및 전 구단 `topScorers` 실존 2026-27 선수 동기화.
  - 전 세계 총 1,388명(현역 1,179 + 레전드 33 + UCL 외곽 176) 중복 ID 0건, 중복 선수명 0건 검증 완료.
- **'레벤수' 3인방 레전드 풀 편입** (`src/data/legendPlayers.json`):
  - 로베르트 레반도프스키(94), 카림 벤제마(93), 루이스 수아레스(94)를 현역 로스터에서 제외하고 전성기 능력치·플레이스타일로 레전드 풀(총 33명)에 등록.

### 2. 드래프트 & 이적시장 포지션별 OVR 상위 3명 노출 보장
- **결정적 OVR 우선 선발** (`src/engine/draftEngine.ts`, `src/engine/transferEngine.ts`):
  - `pickClubCandidatesForSlot`의 무작위 셔플 후 슬라이스를 제거하고 우선순위 버킷 내 OVR 내림차순 결정적 정렬로 전환(라치오 CM 드래프트 시 프라테시·테일러·로벨라 상위 3명 노출 검증).
  - `buildTransferClubSquad`가 광역 포지션(GK/DF/MF/FW)별 OVR 상위 3명을 우선 보장하고 구단당 최대 16명까지 노출하도록 확장.

### 3. 전 세계 고유 선수(중복 제거) & 시즌 중 이적/트레이드 스탯 합산
- **글로벌 단일 선수 ID 키 통일 & 이적 연속성** (`src/engine/dataLoader.ts`, `src/engine/standingsEngine.ts`, `src/engine/analyticsEngine.ts`, `src/engine/awardsEngine.ts`, `src/store/GameContext.tsx`):
  - `user::${playerId}` 이중 키를 단일 `${playerId}` 키로 전면 통일하고, 구버전 세이브 자동 마이그레이션(`normalizeLegacyPlayerStatsMap`) 구현.
  - 드래프트/영입 선수는 `excludeIds`·`departedPlayerIds`로 AI 구단 로스터 및 UCL 36팀 로스터에서 원천 제외.
  - 시즌 중 영입 성공 시 원소속 AI 구단에서 즉시 제거 후 `pickReplacementForAiClub`으로 포지션 대체 자원을 보충하며, 기존 스탯을 유지한 채 `transferHistory` 이력을 기록해 시즌 통합 기록 및 최종 소속팀 기준 시상 구현.

### 4. Phase 2 심층 감사·최적화, `0위` 재검증 및 UCL 우승 편향 점검
- **Phase 2 UX & 상태 무결성 최적화** (`src/engine/uclEngine.ts`, `src/store/GameContext.tsx`, `src/components/ucl/UclDashboard.tsx`, `src/components/transfer/TransferMarketModal.tsx`):
  - 1~8위 부전승 플레이오프 원클릭 일괄 완료(`advanceUclPlayoffToCompletion` / `SIMULATE_UCL_PLAYOFF_BYE`) 추가.
  - 미완료 UCL 토너먼트에서 최종 결산 이동 시 자동 완료 후 단일 시상(`FINISH_UCL_TO_SUMMARY` / `SKIP_UCL_TO_FINAL_SUMMARY`) 보장.
  - 리그 우승 특별 이적시장 레전드 FA 확률 표기 오류(4.0% → 5.5%) 및 스위스 리그 페이즈 상대 순위(`opponentRank`) 전달 누락 수정.
- **`0위` 버그 전수 점검 & 자가 복구** (`standingsEngine.ts`, `legacyEngine.ts`):
  - `findUserRankOrNull` 추가, `loadLegacyState`에서 구버전 `finalLeagueRank === 0` 레코드 자동 보정(`>= 1`), 비참가 백그라운드 UCL 시 `userParticipated: false` 가드로 `uclBonus === 0` 및 `'미진출'` 라벨 보장.
- **UCL 우승 편향 100회 시뮬레이션 검증**:
  - 바이에른 뮌헨 3연패는 시드/정렬 버그가 아닌 정상 확률 분포(100회 기준: 레알 20%, 바이에른 18%, 리버풀 15%, 아스널 14%, PSG 14%, 맨시티 5%, 인테르·바르사 각 4% 등)임을 확인.

### 5. 발롱도르 & 월드베스트 XI: 시즌 완전 종료 시 1회만 종합 시상
- **단일 종합 시상 및 대회별 가중치 정교화** (`src/engine/awardsEngine.ts`, `src/store/GameContext.tsx`, `src/components/league/SeasonSummary.tsx`):
  - TOP 4 챔스 진출 팀은 리그 종료 시점에 발롱도르를 보류하고 UCL 진출 관문 배너를 표시한 뒤, UCL 완전 종료 시 단 1회 시상.
  - 5위 이하 챔스 미진출 팀은 리그 종료 즉시 백그라운드 36팀 AI 챔스를 완료한 뒤 단 1회 시상.
  - 대회별 개인 스탯 가중치(UCL·컵 프레스티지 반영)와 팀 실적(UCL·리그·컵 우승 및 트레블 가점)을 균형 있게 고도화.

### 6. 리그컵 트리형 대진표 + 클릭 가능한 선수 대회별 스탯 & 경기 상세 모달
- **자국 컵 정통 트리형 대진표** (`src/components/league/CupBracketView.tsx`): SVG 직각 엘보 연결선 기반 `16강 → 8강 → 4강 → 결승 → 우승 트로피` 트리 구현.
- **전역 클릭 가능 선수 상세 & 대회별 세부 스탯** (`src/utils/playerLookup.ts`, `src/components/common/PlayerDetailModal.tsx`, `ClubSquadModal.tsx`): 리그·자국 컵·챔피언스리그·시즌 통합 4단 스탯 테이블 및 이적 이력 배지 표시.
- **완료 경기 & 2차전 타이 상세 리포트 모달** (`src/components/common/MatchDetailModal.tsx`): 리그 최근 경기·경기 리포트·전체 경기 히스토리·자국 컵 대진표·UCL 대진표(1·2차전 탭 지원) 어디서든 클릭 시 스코어·득점/도움·점유율·슈팅/xG·승부차기 로그·평점·MOM 열람 가능.

### 검증 결과
- 유닛 테스트: **17개 파일 / 55개 테스트 전부 PASS**, `oxlint` 0 errors, `tsc -b && vite build` 성공.
- 실제 `gameReducer` 기반 **20시즌 연속 풀 시뮬레이션**(5대 리그 순환, TOP 4 UCL 15시즌 + 5위 이하 백그라운드 UCL 5시즌, 시즌 중 이적 44건·동일리그 스탯 합산 28건, 컵 300경기·UCL 토너먼트 900경기 전수 검증) **오류 0건 통과**.

---

## v2.4 — 역대 최강팀 14팀 벤치마크 · 최종 순위 0위 버그 수정 · 감독 능력 직접 선택 · 남/여 & 대머리 커스터마이징

### 명예의 전당 — 실제 역대 최강팀 14팀 벤치마크 랭킹
- **실제 역대 최강 14팀 데이터 & 공정 점수 산출** (`src/data/historicalTeams.ts`, `src/types/legacy.ts`):
  - 19-20·12-13 바이에른, 14-15·08-09 바르사, 22-23·17-18 맨시티, 09-10 인테르, 98-99 맨유, 23-24 레버쿠젠, 11-12 레알, 13-14 유벤투스, 03-04 아스널, 04-05 첼시, 15-16 레스터 14팀 수록.
  - 하드코딩 없이 유저와 동일한 `computeSeasonScore` 함수에 실제 리그/컵/챔스/개인수상 실적을 통과시켜 공정 산출.
  - Phase 3 Supabase 글로벌 명예의 전당 데이터를 그대로 병합할 수 있는 `UnifiedLeaderboardEntry` 타입으로 설계.
- **명예의 전당 UI & 결산 비교 피드백** (`LegacyHubModal.tsx`, `SeasonSummary.tsx`):
  - `[전체 랭킹 | 유저 기록만 | 역대 실제 강팀]` 3종 필터 탭, `🏛️ 역대 강팀` / `👤 MY TEAM` 배지 구분, 역대 강팀 상세 보기(감독명·실제 성적·트로피·대표 베스트 11·시즌 스코어 세부 내역) 구현.
  - 시즌 결산 스코어 카드에 역대 랭킹 N위 한 줄 비교 피드백(`compareScoreWithHistoricalTeams`) 표시.

### 최종 순위 `0위` 버그 근본 수정
- **원인 및 수정** (`src/engine/analyticsEngine.ts`, `src/engine/standingsEngine.ts`, `src/engine/phase2Bridge.ts`, `src/components/league/TeamAnalyticsTab.tsx`, `src/components/league/SeasonSummary.tsx`):
  - `computeMatchesOnlyAnalytics`가 빈 배열 `standings: []`을 전달해 `getUserRank([])`가 `0`을 반환하고 `TeamAnalyticsTab`에서 `0위`로 출력되던 문제를 수정.
  - `getUserRank`에 `row.isUser` 폴백 및 빈 배열 가드(`>= 1`) 추가, 통합·컵·UCL 분석 카드에 대회별 실제 성적(`rankLabel`: 리그 N위 / 우승·4강 등)을 정확히 전달하도록 수정.

### 감독 능력(강점) 직접 선택 방식 전환 & 감독 캐릭터 남/여·대머리 확장
- **14종 감독 강점 카드 그리드 직접 선택** (`ManagerRouletteScreen.tsx`, `GameContext.tsx`):
  - 룰렛 방식을 14종 카드 그리드 직접 선택 UI(`SELECT_MANAGER_TRAIT`)로 전환하고, 우측 상단에 `[🎲 랜덤 선택]` 보조 버튼 배치.
- **성별(남/여) & 대머리(명장) 도트 커스터마이징 확장** (`PixelManagerAvatar.tsx`, `src/types/game.ts`, `src/utils/clubPresets.ts`, `FormationSelect.tsx`):
  - 여성 감독 속눈썹·단발·포니테일·웨이브 롱헤어 및 명장 광택 대머리(`bald`, 선택 시 머리색 팔레트 숨김) 추가.
  - 팀 프리셋(`localStorage`) 및 기존 세이브에 성별·헤어 설정 저장·복원 및 구버전(`gender` 누락) `male` 안전 폴백 적용.

---

## v2.3 — 도트 감독 커스터마이징 · 발롱도르 & 월드베스트 XI · 챔스 트리 대진표 & 트로피 개편

### 도트 아바타 & 도트 트로피 · 미니멀 UI 리뉴얼
- **2등신 도트 감독 캐릭터 & 감독 이름 커스터마이징** (`src/components/common/PixelManagerAvatar.tsx`, `src/components/setup/ManagerRouletteScreen.tsx`):
  - 감독 이름(최대 14자) 입력 + 피부톤(5종) · 헤어스타일(4종) · 머리색(4종) · 감독 의상(5종, 팀 컬러 트레이닝복 포함) 실시간 도트 커스터마이징 구현.
  - 헤더, 스쿼드/전술(`ManagerTraitBadgeCard`), 하프타임 라커룸(`LiveMatchBroadcast`), 자국 컵 우승 축하 모달, 시즌 결산(`SeasonSummary`), 명예의 전당(`LegacyHubModal`) 전역 연동 및 기존 세이브 하위호환 백필.
- **고퀄리티 도트 트로피 SVG 3종 + 발롱도르** (`src/components/common/PixelTrophySvg.tsx`, `src/components/setup/TitleScreen.tsx`):
  - 5대 리그 트로피, 5개국 자국 컵 트로피(FA컵·코파 델 레이·코파 이탈리아·DFB 포칼·쿠프 드 프랑스), UCL 빅이어, 발롱도르 황금 공 도트 SVG 구현.
  - 첫 페이지 히어로를 **"PITCH MANAGER · ROAD TO TREBLE"** + 3종 도트 트로피 중심으로 현대적 미니멀 리뉴얼.

### 자국 컵 고속진행 일시정지 & 도트 트로피 축하 모달
- **고속진행 컵대회 자동 일시정지** (`FastSimModal.tsx`, `GameContext.tsx`):
  - 고속진행 중 자국 컵 토너먼트(16강·8강·4강·결승) 도달 시 자동 일시정지 후 `[직접 경기 진행]` / `[이 경기 스킵하고 계속]` 선택 카드 제공.
- **자국 컵 우승 도트 트로피 축하 모달** (`src/components/league/CupChampionModal.tsx`, `SeasonDashboard.tsx`, `SeasonSummary.tsx`):
  - 직접 경기·1경기 스킵·고속진행 어느 경로로 우승하더라도 우승 축하 모달 1회 보장 (`cupChampionCelebrated` 상태 추적).

### 챔피언스리그 스위스 페이즈 고속진행 & 정통 트리형 대진표
- **UCL 리그 페이즈 끝까지 고속진행** (`simulateUclLeaguePhaseToEnd` in `uclEngine.ts`, `UclDashboard.tsx`):
  - 남은 리그 페이즈(최대 8R) 일괄 진행 및 완료 직후 36팀 최종 순위·전적·16강 직행/플레이오프/탈락 결과 요약 배너 제공.
- **정통 좌→우 직각 연결선 토너먼트 브래킷 트리** (`src/components/ucl/UclBracketTree.tsx`):
  - SVG 직각 엘보 연결선으로 `16강 → 8강 → 4강 → 결승 → 빅이어 우승 카드`를 연결하고, 1·2차전/합산 스코어·ET/PK 배지·모바일 가로 스크롤 지원.

### 발롱도르 · 월드베스트 XI · 개인 수상 시즌 스코어 보너스 · 전체 기록 보존
- **발롱도르 & 월드베스트 XI 시상식** (`computeGlobalSeasonAwards` in `awardsEngine.ts`, `SeasonSummary.tsx`):
  - 5대 리그·자국 컵·UCL 성적 및 우승 가산점을 종합해 발롱도르 최종 수상자 + TOP 5 후보와 4-3-3 월드베스트 XI 발표.
- **시즌 스코어(강팀 점수) 개인 수상 보너스 반영** (`computeSeasonScore` in `legacyEngine.ts`):
  - 발롱도르 수상 `+600`, 월드베스트 XI `1명당 +120`, 리그 MVP `+350`, 리그 베스트 11 `1명당 +60` 가산점 및 세부 내역 표시.
- **5탭 전체 대회 기록 보존 & 명예의 전당 히스토리** (`SeasonSummary.tsx`, `LegacyHubModal.tsx`, `buildCompactMatchHistory`):
  - UCL 종료 후에도 `[통합 요약·어워즈 | 리그 기록 | 자국 컵 | 챔피언스리그 | 전체 경기]` 5탭과 명예의 전당 상세 경기 로그로 모든 순위표·대진표·득점자 기록 영구 열람 가능.

---

## v2.2 — 전술·스타일 상성 엔진 · 하프타임 수석코치 · 2D 중계 고도화

### 전술·스타일 상성 & 하프타임 수석코치
- **전술 vs 선수 플레이스타일 상성 & 스코어 상황 보정** (`src/engine/tacticEngine.ts`, `src/engine/matchEngine.ts`):
  - 상대 전술(선수비 후역습 / 게겐프레싱 / 점유율 / 측면 공략)에 맞춘 선수 스타일별 실효 전력·xG 상성 보정 도입.
  - 후반전 리드 굳히기(수비·활동량 자원 가산) 및 추격 상황(공격 조커·라인브레이커·포처 가산) 보정 반영.
- **하프타임 수석코치 추천 교체 브리핑** (`buildHalftimeCoachRecommendations`, `src/components/league/LiveMatchBroadcast.tsx`):
  - 전반 스코어, 상대 전술, 실시간 체력·평점, 벤치 상성을 종합 분석해 `OUT → IN` 추천 카드 1~2개와 전술적 사유 제시 및 원클릭 적용 지원.

### 하프타임 · 후반 교체 UX & 스쿼드 감독 강점 카드
- **선발 11명 자유 포지션 스왑 & 벤치 교체 안전 확인창** (`LiveMatchBroadcast.tsx`, `GameContext.tsx`):
  - 하프타임 및 후반전 실시간 교체 모달 모두에서 선발 ↔ 선발 클릭·드래그 위치 변경 지원 (교체 횟수 차감 없음, 5명 교체 완료 후에도 포지션 조정 가능).
  - 하프타임 선발 ↔ 벤치 교체 시 재출전 불가 경고와 함께 `[교체 확정]` 확인 모달을 거쳐 오클릭 방지.
- **하프타임 `[빠른 선발]` 버튼** (`optimizeCurrentStartersForFormation`, `GameContext.tsx`):
  - 포메이션 변경 시 교체 아웃된 선수를 건드리지 않고 현재 그라운드 11명만으로 최적 포지션 자동 재배치.
- **스쿼드/전술 탭 감독 강점 상시 확인** (`src/components/common/ManagerTraitBadgeCard.tsx`, `SquadManagerModal.tsx`, `UclDashboard.tsx`):
  - 리그·UCL 스쿼드/전술 탭에서 감독 강점명, 효과 요약, 추천 전술, 시너지 스타일을 상시 열람 가능.

### 2D 경기 시뮬레이션 고도화 & 노트북/PC 화면 최적화
- **개별 선수 능력치·스타일 직접 반영** (`computeIndividualRosterImpact`, `matchEngine.ts`):
  - 골키퍼 OVR/스타일(선방률), 윙어(측면 돌파·크로스), 플레이메이커(스루패스·반대전환), 포처/완성형 FW(헤더·리바운드)가 이벤트 빈도와 성공률에 직접 작용하도록 강화.
- **신규 2D 이벤트 & 움직임 확장** (`PitchMatch2D.tsx`, `matchEngine.ts`):
  - **U자 빌드업 & 반대전환 롱패스**, **세컨찬스(리바운드) 마무리**, **인게임 페널티킥(PK)**, **VAR 오프사이드 득점 취소** 연출 및 측면 예각·파포스트·니어포스트 등 슈팅 각도 다양화 구현 (총 10종 패턴).
- **2D 중계 화면 크기 & 2단 레이아웃 최적화** (`LiveMatchBroadcast.tsx`, `PitchMatch2D.tsx`):
  - 노트북/PC 뷰포트에서 스크롤을 최소화하도록 상단 스코어보드 컴팩트화 + 좌측(2D 피치·체력) / 우측(실시간 중계 로그) 2단 레이아웃 적용.

---

## v2.1 — 메인 UI 전면 개편 · 인게임 패치노트 · 프로젝트 인수인계

### UI / UX
- **시작화면(메인 페이지) 전면 개편** (`src/components/setup/TitleScreen.tsx`):
  - 축구 시뮬레이션 *벤치에서 발롱까지(kickru.com)* 스타일을 참고한 미니멀 히어로(타이틀 + `v2.1` 버전 배지 + 커리어 5단계 로드맵 + 메인 **[새 시즌 시작하기]** CTA) 중심으로 재설계.
  - 복잡한 인라인 가이드/설정을 제거하고 **[레거시 · 명예의 전당]**, **[게임 가이드]**, **[패치노트]** 3개의 정돈된 보조 메뉴 카드로 분리하여 모달로 열리게 개선.
  - PC 및 모바일 화면 여백, 폰트 위계, 버튼 터치 영역 최적화.
- **커리어 시작 3단계 플로우 정돈** (`src/store/GameContext.tsx`, `FormationSelect.tsx`, `ManagerRouletteScreen.tsx`, `HeaderNav.tsx`):
  - `1단계 구단·프리셋·드래프트 풀·포메이션 설정` → `2단계 감독 강점 룰렛` → `3단계 16인 드래프트` 순으로 깔끔하게 진행되도록 개편.
- **인게임 패치노트 추가** (`src/data/patchNotes.ts`, `src/components/common/PatchNotesModal.tsx`):
  - 첫 화면 및 상단 헤더 버전 배지에서 `v1.0 ~ v2.1` 전체 패치 내역을 언제든 열람 가능.

### CI / 문서화
- GitHub Pages 자동 배포 워크플로우(`.github/workflows/deploy.yml`) 추가 (`main` 푸시 시 `npm ci && npm run build` 후 `dist/` 자동 배포).
- 새 프로젝트 대화창 인수인계용 `CHANGELOG.md` 및 `PROJECT_HANDOFF.md` 작성.

---

## v2.0 — Phase 2: 자국 컵대회 · 36팀 챔피언스리그 · 공정 시즌 스코어 & 24종 히든 레거시

### 자국 컵대회 & 연장전/승부차기
- **5대 리그별 자국 컵 자동 매칭** (`src/engine/cupEngine.ts`, `src/types/cup.ts`, `src/components/league/CupBracketView.tsx`):
  - EPL(`FA Cup`), 라리가(`Copa del Rey`), 세리에 A(`Coppa Italia`), 분데스리가(`DFB-Pokal`), 리그 1(`Coupe de France`) 16팀 단판 토너먼트(`16강 → 8강 → 4강 → 결승`) 통합.
  - 정규 리그 일정 사이(`8/16/24/32R`, 34R 리그는 `7/14/22/29R`)에 자동 배치, 기존 2D 중계·1경기 스킵·고속 진행(자동 교체) 완벽 호환.
- **연장전(ET) & 승부차기(PK)** (`src/engine/matchEngine.ts`, `src/components/league/LiveMatchBroadcast.tsx`):
  - 90분 동점(또는 2차전 합산 동점) 시 기존 체력 소모가 이어지는 연장전(91'~120') 진행.
  - 연장전 시작 전 특별 규정으로 **추가 교체 1장(최대 6명)**을 포메이션 체력바와 함께 허용.
  - 연장 종료 후에도 동점일 경우 키커별 `⚽ / ❌` 순차 연출(5라운드 조기 확정 + 서든데스) 승부차기로 승부 결정.

### 현행 36팀 UEFA 챔피언스리그
- **36팀 풀 구성 & 비5대 리그 16개 구단 데이터** (`src/data/uclTeams.json`, `src/engine/uclEngine.ts`, `src/types/ucl.ts`):
  - Phase 1 백그라운드 5대 리그 최종 순위표의 각 리그 TOP 4(20팀) + 유럽 비5대 리그 강호 16개 구단(벤피카·포르투·스포르팅·아약스·PSV·페예노르트·셀틱·레인저스·갈라타사라이·페네르바체·잘츠부르크·샤흐타르·클뤼프 브뤼허·올림피아코스·스파르타 프라하·디나모 자그레브, 총 176명 로스터) 연동.
  - 5대 리그 우승팀 1포트 우선 배정 포함 4개 포트(각 9팀) 자동 편성.
- **수학적 무결성 스위스 리그 페이즈 일정** (`generateSwissSchedule`):
  - 전 36팀이 4개 포트에서 각 2팀씩(홈 1 / 원정 1), 총 8경기(4홈 4원정, 중복 대진 0건, 총 144경기)를 치르는 O(N) 확정 알고리즘 구현 및 유닛 테스트 검증.
  - `1~8위` 16강 직행, `9~24위` 홈&어웨이 16강 플레이오프, `25~36위` 탈락, 16강~4강 2차전 합산(동점 시 연장/PK), 단판 중립 결승 지원.
- **UCL 개막 전 특별 이적시장** (`src/engine/transferEngine.ts`, `src/components/transfer/TransferMarketModal.tsx`):
  - 리그 TOP 4 진출 시 특별 이적시장 1회 오픈. 리그 우승(1위) 구단은 **영입 확률 +5%, 레전드 FA 확률 5.5%(+4% 협상 보너스)** 프리미엄 적용.
- **UCL 대시보드 & 통합 통계** (`src/components/ucl/UclDashboard.tsx`, `src/components/league/SeasonSummary.tsx`):
  - 36팀 순위표·토너먼트 대진표·UCL 개인 기록·스쿼드/전술 관리 화면 구현.
  - 최종 결산 분석에 **[시즌 통합 / 리그 / 자국 컵 / 챔스]** 4개 대회별 필터 탭 도입.

### 공정 시즌 스코어 · 명예의 전당 · 24종 히든 도전과제
- **공정 시즌 스코어** (`src/engine/legacyEngine.ts`, `src/types/legacy.ts`):
  - 34R(분데스리가·리그 1)과 38R(EPL·라리가·세리에 A) 간 형평성을 위해 **`PPG × 38` 환산 점수** + 리그 순위·컵·챔스·대업(트레블/더블/무패)·언더독(저 OVR 우승) 보너스 및 `S+ ~ C` 등급 산출.
- **명예의 전당 & 24종 히든 레거시** (`src/data/achievements.ts`, `src/components/legacy/LegacyHubModal.tsx`, `src/components/legacy/AchievementToast.tsx`):
  - `localStorage`(`pitch_manager_legacy_v1`)에 완료 시즌 영구 아카이브(최고 스코어순/최신순 정렬, 구단·유니폼·최종 스쿼드·트로피 상세 열람).
  - 24종 히든 도전과제(미해금 `???` + 짧은 역사적 모티브 힌트, `X / 24` 진행도, 달성 즉시 `🏆 히든 레거시 해금!` 토스트 알림).

---

## v1.5.1 (Phase 1 v5.3.1) — 교체 라인업 자동 복원 · 피치 체력바 · 최소 이적 확률 보장

### 경기 교체 / UI
- `START_LIVE_MATCH` 시 경기 전 선발 11명·벤치 5명·포메이션 스냅샷 저장 및 경기 종료(`commitLiveMatchResult`) 시 자동 복원하여 인게임 교체가 기본 선발 명단을 덮어쓰지 않도록 수정.
- 하프타임 및 후반 실시간 수동 교체 시 `PitchBoard` 각 선수 카드 위에 실시간 체력바(%)와 교체 불가(이미 교체 아웃된 선수) 상태 직접 표시.

### 이적시장 밸런스
- 레전드(최소 22%) 및 슈퍼스타·고 OVR 선수 포함 모든 영입 협상 성공률의 최소 하한선 **20%** 보장.

---

## v1.5 (Phase 1 v5.3) — 랜덤 일정 · 선수 체력(STA) · 7종 하이라이트 · 피치 뷰 이적시장

### 대진표
- Fisher-Yates 무작위 셔플을 적용하여 매 시즌 리그 일정 순서 및 홈/원정 시작을 랜덤화(백그라운드 타 4대 리그 포함, 전반기 1회 대결 및 후반기 홈/원정 반전 규칙 유지).

### 체력(STA) & 교체 시스템
- 현역 290명, 레전드 30명, 자동 생성 로테이션 선수 전원에 현실적 활동량 기반 `stamina`(60~99) 스탯 부여 및 상세 모달 표시.
- 경기 시간(0'→90'), 선수 `stamina`, 포지션 활동량, 팀 전술(게겐프레싱 1.35x, 측면 공략 1.15x 등)에 따른 분 단위 체력 소모 및 구간별 경기력 패널티(`70%↑ 정상`, `55~69% -1.5`, `40~54% -3.5`, `40%↓ -6.0`) 구현.
- 후반 실시간 일시정지 수동 교체 및 1경기 스킵·고속 진행 시 60'~82' 자동 벤치 교체(3~5명) 적용.

### 2D 중계 & 이적시장
- 7종 공격/세트피스 하이라이트 패턴(`wing_cross_header`, `cutback_finish`, `through_ball_1v1`, `cut_inside_curler`, `corner_kick`, `direct_free_kick`, `high_press_counter`) 및 전술/감독 특성 가중치 연동.
- 이적시장 내 스쿼드 비교 패널에 포메이션 피치 뷰 도입.

---

## v1.4 (Phase 1 v5.2) — 팀 프리셋 · 드래프트 리그 필터 · 레전드 협상 개선

### 편의성 & 드래프트
- `localStorage` 기반 **[이전 팀 불러오기]** 프리셋(팀명·약칭·유니폼 최대 6개 보관, 중복 덮어쓰기, 개별 삭제).
- **[드래프트 풀 리그 선택]** 5대 리그 체크박스 필터(드래프트·이적시장 구단 풀에만 적용, 레전드 슬롯 및 백그라운드 5대 리그 순위표·UCL 참가팀 로직은 독립 유지).
- 드래프트 선수 클릭 시 확인 단계를 거치는 2단계 선택 확정 UX 적용.
- 레전드 영입 확률 상향 및 거절된 선수 재협상 허용.

---

## v1.3 (Phase 1 v5.1) — 스쿼드 상시 비교 · 자동 슬로우모션 · 5대 리그 순위표

### 이적시장 / 2D 중계 / 시뮬레이션
- 이적시장 PC 좌우 분할 / 모바일 접이식 드로어 **[내 스쿼드 비교]** 패널 및 취약 포지션(최저 실효 OVR / 부포지션 페널티) 자동 강조.
- 골뿐만 아니라 슈퍼세이브·골대 강타·아슬아슬한 실축에도 동일하게 작동하는 **스포일러 방지 자동 슬로우모션** 연출 도입.
- **1경기 즉시 스킵** 버튼 및 결과 요약 모달 추가.
- 백그라운드 타 4대 리그 동시 시뮬레이션(`otherLeaguesEngine.ts`) 및 5대 리그 순위표 전환 UI 구축.

---

## v1.2 (Phase 1 v5.0) — 2D 피치 중계 · 동적 이적시장 · 스마트 라인업

### 중계 / 이적시장 / 라인업 UX
- 2D 실시간 경기장 중계(`PitchMatch2D.tsx`) 및 고속 시뮬레이션 애니메이션 모달(`FastSimModal.tsx`) 구현.
- 선수 시즌 폼·소속 구단 순위·우리 팀 순위(위상) 기반 동적 몸값(€M) 및 영입 성공률 계산 3구단 이적시장(`transferEngine.ts`) 구현.
- 포메이션 변경 시 스마트 자동 재배치(`remapStartersForFormation`), 자동 최적 베스트 11(`optimizeBestLineup`), 선수 상세 정보 모달(`PlayerDetailModal.tsx`), 레전드 슬롯 단독 등장 적용.

---

## v1.1 (Phase 1 v4.0) — 2026-27 풀 로스터 · 복수 주포지션 · 3색 병렬 케미 · 세부 분석

### 로스터 / 케미 / 분석
- 2026-27 유럽 5대 리그 96개 구단·현역 290명·레전드 30명 로스터 및 복수 주포지션(`mainPositions`)·부포지션(`secondaryPositions`) 체계 도입.
- 구단당 3명 멀티 후보 3구단 룰렛, 드래프트 중/시즌 중 자유 스왑.
- 구단(노랑)·국적(초록)·플레이스타일 시너지(하늘) 3색 병렬 케미스트리 라인 시각화.
- `analyticsEngine.ts` 및 `TeamAnalyticsTab.tsx`: xG/xGA, 득점 전환율, 홈/원정 성적, 최다 연승/무패, 16인 정렬 가능 스쿼드 세부 통계 구현.

---

## v1.0 (Phase 1 초기 출시) — 드래프트 & 유럽 5대 리그 시뮬레이션 기반

### 핵심 게임플레이
- 유럽 5대 리그(EPL 38R, 라리가 38R, 세리에 A 38R, 분데스리가 34R, 리그 1 34R) 더블 라운드 로빈 일정 및 순위표.
- 3구단 룰렛 기반 16인 스쿼드 드래프트(선발 11 + 벤치 5), 6종 포메이션, 5종 전술 상성, 14종 감독 강점 룰렛.
- 지수 포아송 기대득점(xG) 기반 경기 시뮬레이션 엔진, 하프타임 라커룸 전술·교체 지시, 시즌 어워드(득점왕·도움왕·클린시트·POTY·베스트 11), 20시즌 밸런스 검증 테스트 구축.
