# PITCH MANAGER — CHANGELOG

유럽 5대 리그 · 자국 컵대회 · 36팀 UEFA 챔피언스리그 드래프트 & 전술 시뮬레이션 **PITCH MANAGER**의 전체 버전 변경 이력입니다.  
최신 버전이 상단에 표시됩니다.

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
