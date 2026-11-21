# PITCH MANAGER — PROJECT HANDOFF GUIDE (v2.2)

이 문서는 GitHub 저장소(`darksuri82/roadtotreble`)가 연결된 **Antigravity 프로젝트 대화창**에서 다음 에이전트가 별도의 탐색 없이 즉시 개발·배포를 이어갈 수 있도록 프로젝트의 전체 아키텍처, 구현 명세, 핵심 밸런스 수식, 데이터 구조, 그리고 Phase 3 예정 작업을 정리한 인수인계 문서입니다.

---

## 1. 기술 스택 및 실행 환경

- **Framework**: React 19 + TypeScript (strict) + Vite 8.3.8 (Rolldown)
- **Styling**: Tailwind CSS v4 (`@tailwindcss/vite`) — 다크 스포츠 대시보드 테마 (`#090e14`, `#111822`, emerald/amber/sky 악센트)
- **Icons**: `lucide-react`
- **Testing & Lint**: Vitest (`npm run test` — **14개 파일 / 42개 테스트 전부 PASS**), `oxlint` (`npm run lint` — 0 errors)
- **Build**: `npm run build` (`tsc -b && vite build` — `base: './'` 설정으로 GitHub Pages 서브경로 및 루트 배포 모두 호환)
- **라이브 URL**: `https://darksuri82.github.io/roadtotreble/` (`.github/workflows/deploy.yml` 자동 배포 활성화 완료)
- **v2.2 주요 신규 모듈·기능**:
  - 전술 vs 플레이스타일 상성(`evaluatePlaystyleTacticMatchup`) + 후반 스코어 상황 보정 + 하프타임 수석코치 교체 추천(`buildHalftimeCoachRecommendations`)
  - 하프타임 선발 ↔ 선발 자유 스왑, 벤치 교체 안전 확인창, 하프타임 `[빠른 선발]`(`optimizeCurrentStartersForFormation`)
  - 2D 시뮬 10종 패턴(U자 빌드업 & 반대전환, 세컨찬스 리바운드, 인게임 PK, VAR 오프사이드 취소) + 개별 선수 능력치 직접 반영(`computeIndividualRosterImpact`) + 노트북/PC 2단 중계 레이아웃
  - 스쿼드/전술 탭 감독 강점 상시 카드(`src/components/common/ManagerTraitBadgeCard.tsx`)
- **중요 TypeScript 컴파일러 제약 (`tsconfig.app.json`)**:
  - `verbatimModuleSyntax: true` (타입은 반드시 `import type` 사용)
  - `erasableSyntaxOnly: true` (enum / parameter properties 금지)
  - `noUnusedLocals: true`, `noUnusedParameters: true`
- **React Compiler / Lint 규칙**:
  - 중첩 `<button>` 금지
  - 렌더 중 `ref.current` 읽기/쓰기 금지
  - `useEffect` 내부 동기 `setState` 호출 지양 (`setTimeout(..., 0)` + cleanup 또는 이벤트 핸들러 사용)

---

## 2. 디렉토리 및 핵심 파일 구조

```text
.
├── .github/workflows/deploy.yml   # GitHub Pages 자동 배포 (push to main -> npm ci -> build -> deploy dist/)
├── CHANGELOG.md                   # v1.0 ~ v2.1 전체 패치 이력
├── PROJECT_HANDOFF.md             # 본 인수인계 문서
├── src/
│   ├── App.tsx                    # 게임 페이즈 라우터 + LegacyHubModal + AchievementToast
│   ├── store/
│   │   └── GameContext.tsx        # 전역 상태(useReducer + localStorage 저장/하위호환 + 실시간 도전과제 감시 + 명예의 전당 아카이빙)
│   ├── types/
│   │   ├── player.ts              # Player, Position, SubPosition, PlaystyleId, getCardTier
│   │   ├── league.ts              # Club, LeagueData, Fixture, MatchResult, ExtraTimeInfo, PenaltyKickLog, LiveHalftimeState, PlayerSeasonStats
│   │   ├── game.ts                # GameState, GamePhase, SeasonState, TransferMarketState, ChemistryResult, TeamRatings
│   │   ├── cup.ts                 # DomesticCupState, CupStageId, CupMeta, CupMatchNode
│   │   ├── ucl.ts                 # UclTournamentState, UclTeamEntry, UclKnockoutTie, UclPhaseStage
│   │   ├── legacy.ts              # LegacyStorageState, HallOfFameEntry, SeasonScoreBreakdown, HiddenAchievementDef
│   │   └── phase2.ts              # Phase 1 -> Phase 2 핸드오프 요약 타입
│   ├── data/
│   │   ├── activePlayers.json     # 2026-27 유럽 5대 리그 현역 290명 (복수 주포지션·stamina 포함)
│   │   ├── legendPlayers.json     # 레전드 30명 (stamina 포함)
│   │   ├── leagues.json           # 유럽 5대 리그 96개 구단 (EPL 20, 라리가 20, 세리에 A 20, 분데스리가 18, 리그 1 18)
│   │   ├── uclTeams.json          # 비5대 리그 유럽 강호 16개 구단 · 176명 풀 스쿼드
│   │   ├── formations.ts          # 6종 포메이션 좌표·케미 링크 + 벤치 5슬롯
│   │   ├── managerTraits.ts       # 14종 감독 강점 정의
│   │   ├── playstyles.ts          # 14종 플레이스타일 및 스타일 시너지 쌍
│   │   ├── achievements.ts        # 24종 히든 도전과제 (힌트/해금 제목/역사적 모티브/조건)
│   │   └── patchNotes.ts          # 인게임 패치노트 데이터 (v1.0 ~ v2.1)
│   ├── engine/
│   │   ├── dataLoader.ts          # JSON 로더, AI 11인 로스터 생성(buildAiClubRoster), 로테이션 선수 생성
│   │   ├── positionEngine.ts      # 복수 주포지션/부포지션 적합도 & 실효 OVR 계산
│   │   ├── chemistryEngine.ts     # 3색 병렬 케미(구단/국적/스타일+역할) & 팀 실전 OVR 계산
│   │   ├── tacticEngine.ts        # 5종 전술 & 포메이션 상성, 하프타임 힌트 생성
│   │   ├── staminaEngine.ts       # 인게임 체력 소모(0'~120'), 피로 패널티, 60'~82' 자동 교체 계획
│   │   ├── draftEngine.ts         # 3구단 멀티 후보 드래프트 룰렛 (리그 풀 필터 + 레전드 독립 확률)
│   │   ├── lineupOptimizer.ts     # 포메이션 변경 시 스마트 재배치 & 자동 최적 베스트 11
│   │   ├── scheduleEngine.ts      # Fisher-Yates 랜덤 셔플 더블 라운드 로빈 일정 생성
│   │   ├── matchEngine.ts         # 포아송 xG 경기 엔진, 전반/후반/실시간 교체 재시뮬, 7종 하이라이트, 연장전/승부차기
│   │   ├── standingsEngine.ts     # 순위표 정렬, 풀리그 선수 기록 및 대회별 기록(accumulateCompetitionPlayerStats) 누적
│   │   ├── otherLeaguesEngine.ts  # 타 4대 리그 백그라운드 동시 시뮬레이션 & UCL 20팀 진출 요약
│   │   ├── transferEngine.ts      # 3구단 동적 이적시장 (몸값·확률·20% 하한·UCL 리그 우승 프리미엄)
│   │   ├── cupEngine.ts           # 5대 리그 자국 컵 16강~결승 토너먼트 진행
│   │   ├── uclEngine.ts           # 36팀 4포트 편성, O(N) 8R 스위스 일정 생성, 플레이오프~결승 토너먼트
│   │   ├── awardsEngine.ts        # 시즌 어워드(득점/도움/클린시트/평점/POTY/4-3-3 베스트 11)
│   │   ├── analyticsEngine.ts     # 팀/스쿼드 세부 분석 + 다중 대회 스탯 병합(mergePlayerStatsMaps)
│   │   └── legacyEngine.ts        # PPG×38 공정 시즌 스코어, 명예의 전당 storage, 24종 히든 도전과제 판정
│   ├── components/
│   │   ├── common/                # HeaderNav, JerseySvg, PitchBoard, PlayerCard, PlayerDetailModal, PatchNotesModal
│   │   ├── setup/                 # TitleScreen (v2.1 개편), FormationSelect (1단계), ManagerRouletteScreen (2단계)
│   │   ├── draft/                 # DraftScreen (3단계, 2단계 확정)
│   │   ├── league/                # LeagueSelect, SeasonDashboard, LiveMatchBroadcast, PitchMatch2D, FastSimModal, CupBracketView, SeasonSummary, TeamAnalyticsTab, StandingsTable
│   │   ├── transfer/              # TransferMarketModal (좌우 분할 + 피치 뷰 + UCL 특별 이적시장)
│   │   ├── ucl/                   # UclDashboard (36팀 순위표·토너먼트·UCL 기록·스쿼드)
│   │   ├── legacy/                # LegacyHubModal (명예의 전당 + 24종 도감), AchievementToast
│   │   └── guide/                 # SystemGuideModal
│   └── __tests__/                 # 13개 유닛 테스트 (총 37개 테스트)
```

---

## 3. 현재 구현 완료된 전체 게임 루프 (v2.1)

1. **메인 화면 (`title`)**: 히어로 + `v2.1` 패치노트 + **[새 시즌 시작하기]** + 보조 메뉴 모달([레거시/명예의 전당], [게임 가이드], [패치노트]).
2. **1단계 구단·풀·포메이션 설정 (`setup`)**: 이전 팀 프리셋(`localStorage`, 최대 6개), 팀명/약칭/유니폼, 드래프트 풀 리그 체크박스(최소 1개), 6종 포메이션, 5종 기본 전술.
3. **2단계 감독 강점 룰렛 (`manager_roulette`)**: 14종 감독 강점 중 추첨(최대 2회 리롤).
4. **3단계 16인 드래프트 (`draft`)**: 3구단 룰렛(구단당 3명 후보, 레전드 슬롯 단독 등장), 2단계 선택 확정, 자유 스왑, 스마트 재배치.
5. **리그 선택 (`league_select`)**: 5대 리그 중 1개 참가(해당 리그 최약체 1팀 대체).
6. **정규 시즌 + 자국 컵 (`season`)**:
   - Fisher-Yates 랜덤 더블 라운드 로빈(38R/34R) + 타 4대 리그 백그라운드 동시 진행.
   - 3회 정기 이적시장(동적 몸값/성공률, 최소 하한 20%/레전드 22%, 3회 협상, 재도전 가능, 피치 뷰 스쿼드 상시 비교).
   - 자국 컵 16강~결승 단판 토너먼트(90분 동점 시 연장전 + 6번째 교체 + 승부차기).
   - 2D 피치 중계(7종 하이라이트, 스포일러 방지 자동 슬로우모션, 실시간 체력바, 하프타임 전술/교체, 후반 일시정지 수동 교체, 경기 종료 후 선발 라인업 자동 복원) + 1경기 스킵 + 고속 시뮬.
7. **36팀 UEFA 챔피언스리그 (`ucl`)**:
   - 리그 TOP 4 진입 시 결산 화면에서 진입 → **UCL 특별 이적시장 1회**(리그 우승 시 영입확률 +5% · 레전드 FA 5.5%).
   - 스위스 리그 페이즈 8R(36팀 단일 순위표) → 16강 플레이오프(9~24위 2차전) → 16강/8강/4강(2차전 합산 + 연장/PK) → 단판 결승.
8. **최종 결산 & 레거시 (`season_end`)**:
   - 공정 시즌 스코어(`PPG × 38`), 4개 대회별 세부 분석(`[시즌 통합 / 리그 / 자국 컵 / 챔스]`), 리그 수상/베스트 11, 5대 리그 최종 순위표.
   - `localStorage`(`pitch_manager_legacy_v1`) 명예의 전당 자동 등재 및 24종 히든 도전과제 영구 해금.

---

## 4. 핵심 밸런스 수식 & 데이터 규격

### 4.1 포지션 적합도 & 실효 OVR (`positionEngine.ts`)
- `mainPositions` 포함: `0` (주포지션, 페널티 없음)
- `secondaryPositions` 포함: `-2` (`total_football` 감독 특성 시 `-1`)
- 동일 라인(`FW`/`MF`/`DF`): `-4` (`total_football` 시 `-2`)
- 타 라인: `-8` (`total_football` 시 `-4`)
- 필드 플레이어 ↔ GK 교차 배치: `-18`

### 4.2 팀 케미스트리 (0~100) & 보정 (`chemistryEngine.ts`)
- 총점 100점 구성: **동일 구단(최대 25)** + **동일 국적(최대 20)** + **전술/플레이스타일/감독 시너지(최대 40)** + **스쿼드 역할 밸런스(최대 15)**. *(동일 리그 보너스 없음 — 레전드 카드는 구단 와일드카드 적용)*
- 실전 팀 OVR 보정(`chemistryOvrBonus`): `-1.5 ~ +2.5` (케미 50 기준 0, 95~100 시 최대 +2.5).

### 4.3 지수 포아송 기대득점(xG) 모델 (`matchEngine.ts`)
- `lambdaHome = clamp(1.38 * exp(0.040*(home.att - away.def) + 0.015*(home.mid - away.mid)) + home.xgBonus - away.oppXgPenalty, 0.18, 4.1)`
- `lambdaAway = clamp(1.15 * exp(0.040*(away.att - home.def) + 0.015*(away.mid - home.mid)) + away.xgBonus - home.oppXgPenalty, 0.16, 3.85)`
- **20시즌 밸런스 검증 기준 (`balanceVerification.test.ts`)**:
  - OVR 90 팀: 평균 85~98점 / 1위권
  - OVR 85 팀: 평균 70~82점 / 2~4위권
  - OVR 79 팀: 평균 46~56점 / 8~12위권
  - 84 OVR 풀시너지 vs 89 OVR 무조합 강팀: 50% 전후 승률로 전술·케미 업셋 실현

### 4.4 체력(STA) 소모 & 패널티 (`staminaEngine.ts`)
- 전술 소모 계수: `gegenpressing 1.35x`, `wingplay 1.15x`, `balanced 1.0x`, `possession 0.92x`, `counter 0.88x`
- 피로 패널티: `>=70% (0)`, `55~69% (-1.5)`, `40~54% (-3.5)`, `<40% (-6.0)`
- 연장전(`91'~120'`)은 `evalMinute = 108`로 체력 소모를 이어 계산하고 6번째 교체 선수는 `enteredAtMinute = 90`으로 100% 신선도 적용.

### 4.5 동적 이적시장 몸값 & 성공률 (`transferEngine.ts`)
- `marketValueM = baseValueM(OVR/티어 비선형) * (1 + formDeltaPct) * (1 + clubRankDeltaPct)`
- `successChance = clamp(baseChance + formChanceMod + sellingClubChanceMod + userPrestigeDeltaPct, minFloor, maxCap)`
  - `minFloor`: 일반 `20%`, 레전드 `22%`
  - `maxCap`: 일반 `95%`, 슈퍼스타 `36%`(리그 우승 UCL 특별시장 `41%`), 레전드 `42%`(우승 프리미엄 `46%`)
- 레전드 FA 출현 확률(릴당): 기본 `2.5%`, 리그 TOP 4 `4.0%`, 리그 우승 UCL 특별시장 `5.5%`.

### 4.6 공정 시즌 스코어 (`legacyEngine.ts`)
- `leagueConvertedScore = round((leaguePoints / leaguePlayed) * 38 * 25 + max(-150, (GD / leaguePlayed) * 38 * 3.5))`
- 보너스 합산: 리그 순위(1위 +1200 ~ 4위 +380) + 자국 컵(우승 +850) + 챔스(우승 +2200) + 대업(트레블 +1500 / 더블 +550 / 리그 무패우승 +750) + 언더독(평균 OVR < 85 달성 시 최대 +900).
- 등급 기준: `S+ (>=7200)`, `S (>=5600)`, `A+ (>=4200)`, `A (>=3200)`, `B+ (>=2300)`, `B (>=1500)`, `C (<1500)`.

### 4.7 로컬 스토리지 키
- `football_draft_game_state_v5`: 진행 중인 게임 전체 상태 (이전 세이브 자동 백필)
- `pitch_manager_club_presets_v1`: 팀 프리셋 (최대 6개)
- `pitch_manager_legacy_v1`: 명예의 전당(최대 50시즌) + 24종 히든 도전과제 해금 기록
- `pitch_manager_phase2_handoff_v1`: 5대 리그 TOP 4 진출 브릿지 데이터

---

## 5. 다음 단계 예정 작업 (Phase 3 로드맵)

새 Antigravity 프로젝트 대화창(`darksuri82/-38-0` 연결)에서 이어서 진행할 우선순위 작업 목록입니다:

1. **GitHub Push & GitHub Pages 라이브 웹사이트 배포 (최우선)**
   - 이 저장소를 `darksuri82/-38-0`의 `main` 브랜치에 푸시.
   - GitHub Pages 설정(`build_type: workflow`)을 활성화해 `.github/workflows/deploy.yml`로 즉시 라이브 URL(`https://darksuri82.github.io/-38-0/`) 배포.
   - 이후 모든 패치·기능 추가 시 `src/data/patchNotes.ts`와 `CHANGELOG.md`를 함께 업데이트하고 푸시하여 자동 반영.
2. **글로벌 랭킹 보드 (Backend / Serverless 연동)**
   - Supabase 또는 Firebase Firestore / Cloudflare Workers KV 연동으로 유저 완료 시즌의 `SeasonScoreBreakdown`·우승 트로피·스쿼드 스냅샷을 공유 랭킹 보드에 등록(시즌/전체/언더독/트레블 리더보드).
3. **PWA (Progressive Web App) 지원**
   - `manifest.webmanifest`, 앱 아이콘, Service Worker 캐싱을 추가해 모바일 홈 화면 설치 및 오프라인 플레이 지원.
4. **Phase 3 콘텐츠 확장 아이디어**
   - 다중 시즌(연속 커리어 / 유스 아카데미 / 선수 에이징 & 은퇴), UEFA 유로파리그(5~6위 진출), 경기 사운드 효과(관중 함성·휘슬·골대 타격음 토글).
