# PITCH MANAGER — CHANGELOG

유럽 5대 리그 · 자국 컵대회 · 36팀 UEFA 챔피언스리그 드래프트 & 전술 시뮬레이션 **PITCH MANAGER**의 전체 버전 변경 이력입니다.  
최신 버전이 상단에 표시됩니다.

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
