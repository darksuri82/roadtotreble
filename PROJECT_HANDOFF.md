# PITCH MANAGER — PROJECT HANDOFF GUIDE (v3.0)

이 문서는 GitHub 저장소(`darksuri82/roadtotreble`)가 연결된 **Antigravity 프로젝트 대화창**에서 다음 에이전트가 별도의 탐색 없이 즉시 개발·배포를 이어갈 수 있도록 프로젝트의 전체 아키텍처, 구현 명세, 핵심 밸런스 수식, 데이터 구조, 그리고 Phase 3 예정 작업을 정리한 인수인계 문서입니다.

---

## 1. 기술 스택 및 실행 환경

- **Framework**: React 19 + TypeScript (strict) + Vite 8.3.8 (Rolldown)
- **Styling**: Tailwind CSS v4 (`@tailwindcss/vite`) — 미니멀 다크 스포츠 대시보드 테마 (`#090d13`, `#0e141d`, `#111822`, emerald/amber/sky 악센트)
- **Icons**: `lucide-react` + 커스텀 도트 SVG (`PixelTrophySvg.tsx`, `PixelManagerAvatar.tsx`, `PixelStatusIcon.tsx`) + 105개국 인라인 SVG 국기 (`CountryFlagSvg.tsx`)
- **Testing & Lint**: Vitest (`npm run test` — **19개 파일 / 68개 테스트 전부 PASS**), `oxlint` (`npm run lint` — 0 errors)
- **Build**: `npm run build` (`tsc -b && vite build` — `base: './'` 설정으로 GitHub Pages 서브경로 및 루트 배포 모두 호환)
- **라이브 URL**: `https://darksuri82.github.io/roadtotreble/` (`.github/workflows/deploy.yml` 자동 배포 활성화 완료)
- **v3.0 주요 신규 모듈·기능**:
  - **전 리그·전 대회 누적 피로도 & 현실적 3단계 부상 시스템**: `src/types/condition.ts`, `src/engine/conditionEngine.ts`, `InjuryAlertModal.tsx`, `FastSimModal.tsx`(주전 부상 시 고속진행 자동 일시정지), `otherLeaguesEngine.ts`·`cupEngine.ts`·`uclEngine.ts`·`GameContext.tsx` 전 세계 5대 리그 96구단 + 36팀 UCL 동일 적용 및 AI 자동 로테이션·부상 대체, `OpponentPitchView.tsx`·`ClubSquadModal.tsx` 실시간 부상/피로 반영
  - **팀/포지션 라인/선수 단위 사기(Morale) & 72종 기자회견·라커룸 연설**: `src/data/managerEventsPress.ts`(36종), `src/data/managerEventsLocker.ts`(36종), `src/data/managerEvents.ts`(동일 시즌 중복 방지 큐·쿨다운·동적 변수 치환·하이리스크 분기), `ManagerEventModal.tsx`, 도트 SVG 상태 아이콘 3종(`PixelStatusIcon.tsx`: 부상 빨간 십자가 / 사기 최상 불꽃 / 사기 최악 얼음)
  - **전 세계 105개국(2,397명) Windows 호환 인라인 SVG 국기 아이콘**: `CountryFlagSvg.tsx`(영국 4개 홈네이션 잉글랜드·스코틀랜드·웨일스·북아일랜드 구분 및 한국/대한민국 통합), 전 선수 카드·피치보드·드래프트·이적시장·득점/도움/평점 순위·상세 모달 전역 적용
- **v2.9 주요 신규 모듈·기능**:
  - **모바일 브라우저 터치 좌표(Hit-Test) 밀림 완벽 해결 & 뷰포트 안정화**: `html`/`body`/`#root` 단일 문서 스크롤 `overflow-x: clip` + `100dvh`(`min-h-dvh`), `sticky` 헤더 모바일 폭 정상화(`300px` 이내 수납) 및 `backdrop-blur` 합성 레이어 제거, 매치 데이 전술실 액션 버튼 상단 컨트롤 카드 통합, 드래프트 프리뷰 바 높이 고정(`min-h-[84px]`), 카드/피치 노드 `scale`/`translate` 제거 및 전역 `touch-action: manipulation` 적용
- **v2.8 주요 신규 모듈·기능**:
  - **매치 데이 전술실 전면 정돈 & 상대팀 포메이션 피치 시각화**: `OpponentPitchView.tsx`(상대 선발 11인 컴팩트 포메이션 피치 + 핵심 경계 TOP 3), `MatchDayTacticsRoom.tsx` 양 팀 전력 비교 바 + 상시 노출 전술·포메이션 선택기 및 경기 액션 바 + 3모드 피치 전환(`[상대 포메이션]` / `[내 선발 편집]` / `[양 팀 피치 비교]`)
  - **드래프트 임시 배치(시너지 실시간 프리뷰) & 시너지 공식 가이드**: `PitchBoard.tsx`(`previewSlot`), `RouletteReelsView.tsx`, `DraftScreen.tsx` 후보 1회 클릭 시 피치 임시 배치 및 개인 시너지 OVR(`+1~+3`)·3색 케미선·팀 케미/스탯 증감 실시간 프리뷰 + 코드 수식(`chemistryEngine.ts`) 100% 일치 `[📐 시너지 & OVR 상승 공식 가이드]` 탭
  - **이적시장 원스톱 협상 모달**: `TransferMarketModal.tsx` 스크롤 왕복 없이 한 화면에서 `[IN 영입 대상] ↔ [OUT 방출 선수 선택(⚡ AI 추천 Top 5 / 선발 11인 / 벤치 5인)] ↔ [오퍼 제출]` 완료
  - **정규 리그 최종 라운드 시즌 결과 팝업 배너 & 5대 리그 전용 도트 우승 트로피**: `LeagueFinaleBannerModal.tsx`, `PixelTrophySvg.tsx`(`epl_league`, `laliga_league`, `seriea_league`, `bundesliga_league` 마이스터샬레, `ligue1_league` 헥사고알 + `getLeagueTrophyVariant`), 1위 우승 / 2~4위 챔스 진출 / 하위 강등권 분기 배너
  - **우측 상단 헤더 1줄 고정 · UCL 스쿼드 피치 비율 정규화 · UCL 1경기 스킵 결과 배너**: `HeaderNav.tsx` 전 버튼 `whitespace-nowrap shrink-0` 1줄 정렬, `UclDashboard.tsx` 내 스쿼드 탭 피치 `lg:col-span-5` + `max-w-[460px]` + `compact` 정규화 및 `[1경기 스킵]` 상단 결과 스코어 배너 추가
- **v2.7 주요 신규 모듈·기능**:
  - **드래프트 감독 시너지 가이드 & 선수 단위 시너지 OVR**: `evaluateManagerPlayerSynergy`, `slotSynergies`(+0~+3), `applySlotSynergiesToStarters`, 드래프트 가이드 바, 피치 녹색 `(+N)` 배지 & 상세 내역
  - **매치 데이 전술실 & 상성 도감**: `MatchDayTacticsRoom.tsx`(상대 예상 XI 스카우팅 + 인라인 전술/포메이션/선발 편집 + 실시간 상성 진단 배지), `TacticsGuideModal.tsx`(1페이지 전술/플레이스타일 상성 도감), 강화된 `TACTIC_MATRIX`(±2.8) & 플레이스타일 상성
  - **연장전(90'·105') 통합 라커룸 & 수석코치 조언**: `simulateExtraTimeFirstHalf`, `simulateExtraTimeSecondHalfAndPenalties`, `buildExtraTimeCoachBriefing`(체력 방전/PK 키커 TOP 5/원클릭 추천), `ENTER_ET_HALFTIME_LOCKER`·`START_ET_SECOND_HALF_BROADCAST`
  - **감독 도트 캐릭터 전면 리뉴얼**: `PixelManagerAvatar.tsx` 여성 수염 노이즈 제거, 성별별 실루엣(여성 모래시계 체형) 분리, 남성/여성 전용 헤어(5종/4종) & 의상(5종/4종) 완전 분리 + `normalizeAvatarForGender` 구버전 하위호환
  - **정규 리그 전용 승점 엄격 분리**: `computeMatchesOnlyAnalytics` 가짜 합산 승점 제거, `competitionScope`/`leaguePoints`/`winRatePct` 도입
  - **유럽 5대 리그 완전 구체화 · 공정 발롱도르 & 난이도 상향**: `otherLeaguesEngine.ts` 타 4대 리그 실제 로스터·개인 스탯·16팀 자국 컵 실시간 시뮬, `awardsEngine.ts` 합성 스탯 제거 및 100% 동일 기준 평가, AI 조직력/원정/스태미나 밸런싱, 5대 리그 순위·컵 우승·득점/도움/평점 UI 개방
  - **선수 이름 전용 클릭 통일**: `PlayerNameButton.tsx` 신설 및 전 기록/순위/리포트/어워즈/스쿼드 화면 행 클릭 제거
- **v2.6 주요 신규 모듈·기능**:
  - **FotMob(`fotmob.com/ko`) 2026-27 5대 리그 96/96 구단 100% 전수 교차검증**: 현역 2,188명(EPL 462 / 라리가 432 / 세리에A 472 / 분데스리가 424 / 리그1 398, 구단당 최소 18명) + 레전드 33명(레벤수 포함) + UCL 외곽 16팀 176명 = 전 세계 **2,397명** 중복 ID/이름 0건, 영문 미번역 0건 검증
  - **근거 기반 OVR 전면 재조정 & 다비드 라야 월드클래스(90) 승격**: FotMob 시장가치 로그 곡선 + 나이 커브 + 포지션 보정 + 2계층 큐레이션(슈퍼스타 91~94 19명, 월드클래스 87~90 67명 — 다비드 라야 90 포함) 및 `leagues.json` 96구단 능력치/`topScorers` 동기화
- **v2.5 주요 신규 모듈·기능**:
  - **2026-27 전면 로스터 재검증 & '레벤수' 레전드 편입**: 레반도프스키(94)·벤제마(93)·수아레스(94) 레전드 풀 편입
  - **드래프트·이적시장 OVR 상위 3명 노출 보장**: `pickClubCandidatesForSlot`(결정적 OVR 정렬), `buildTransferClubSquad`(포지션별 상위 3명 보장, 최대 16명)
  - **전 세계 고유 선수 & 시즌 중 이적 스탯 연속 합산**: 단일 `playerId` 키 통일(`normalizeLegacyPlayerStatsMap`), 원소속 AI 구단 제거+대체 자원 보충(`pickReplacementForAiClub`), `transferHistory` 이력 및 최종 소속팀 시상
  - **발롱도르 & 월드베스트 XI 시즌 완전 종료 시 1회 종합 시상**: TOP 4는 UCL 완료 후 1회, 5위 이하는 백그라운드 36팀 AI UCL 완료 후 1회 (`userParticipated: false` 가드)
  - **Phase 2 심층 최적화 & 0위 자가 복구**: 플레이오프 부전승 원클릭 완료(`SIMULATE_UCL_PLAYOFF_BYE`), `SKIP_UCL_TO_FINAL_SUMMARY`, `FINISH_UCL_TO_SUMMARY` 자동 완료 가드, `loadLegacyState` 0위 자가 복구
  - **리그컵 정통 트리형 대진표 & 전역 선수/경기/구단 상세 모달**: `CupBracketView.tsx`(SVG 엘보 트리), `MatchDetailModal.tsx`(단판/UCL 2차전 탭), `ClubSquadModal.tsx`, `PlayerDetailModal.tsx`(리그/컵/UCL/통합 4단 세부 스탯 + 이적 이력), `src/utils/playerLookup.ts`
- **v2.4 주요 신규 모듈·기능**:
  - 역대 최강 14팀 벤치마크(`src/data/historicalTeams.ts`): 유저와 동일한 `computeSeasonScore`로 공정 산출, 명예의 전당 3종 필터(`[전체 / 유저 / 역대 강팀]`)·베스트 11 상세 모달·결산 한 줄 비교 피드백·Phase 3 Supabase 확장 호환 타입(`UnifiedLeaderboardEntry`)
  - 최종 순위 `0위` 버그 근본 수정(`standingsEngine.ts`, `analyticsEngine.ts`, `phase2Bridge.ts`, `TeamAnalyticsTab.tsx`, `SeasonSummary.tsx`)
  - 감독 강점 14종 카드 그리드 직접 선택(`SELECT_MANAGER_TRAIT` + `[🎲 랜덤 선택]` 보조 버튼)
  - 2등신 도트 감독 성별(남/여)·여성 헤어 3종(단발/포니테일/웨이브 롱헤어)·대머리 명장(`bald`, 머리색 자동 숨김) 확장 및 팀 프리셋(`clubPresets.ts`)·구버전 `localStorage` 안전 폴백 연동
- **v2.3 주요 모듈·기능**:
  - 2등신 도트 감독 아바타(`PixelManagerAvatar.tsx`) & 이름 커스터마이징 전역 연동 + 도트 트로피 SVG(`PixelTrophySvg.tsx`) + 첫 화면 미니멀 리뉴얼
  - 자국 컵 고속진행 자동 일시정지(`FastSimModal.tsx`) + 우승 도트 트로피 축하 모달(`CupChampionModal.tsx`)
  - UCL 스위스 리그 페이즈 고속진행(`simulateUclLeaguePhaseToEnd`) + 정통 좌→우 SVG 브래킷 트리(`UclBracketTree.tsx`)
  - 발롱도르 TOP 5 & 월드베스트 XI 4-3-3(`computeGlobalSeasonAwards`) + 개인 수상 시즌 스코어 보너스 + 5탭 전체 대회 기록 영구 보존
- **v2.2 주요 모듈·기능**:
  - 전술 vs 플레이스타일 상성(`evaluatePlaystyleTacticMatchup`) + 후반 스코어 상황 보정 + 하프타임 수석코치 교체 추천(`buildHalftimeCoachRecommendations`)
  - 하프타임/후반 선발 ↔ 선발 자유 스왑, 벤치 교체 안전 확인창, 하프타임 `[빠른 선발]`(`optimizeCurrentStartersForFormation`)
  - 2D 시뮬 10종 패턴 + 개별 선수 능력치 직접 반영(`computeIndividualRosterImpact`) + 2단 중계 레이아웃 + `ManagerTraitBadgeCard.tsx`
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
├── CHANGELOG.md                   # v1.0 ~ v2.6 전체 패치 이력
├── PROJECT_HANDOFF.md             # 본 인수인계 문서
├── src/
│   ├── App.tsx                    # 게임 페이즈 라우터 + LegacyHubModal + AchievementToast
│   ├── store/
│   │   └── GameContext.tsx        # 전역 상태(useReducer + localStorage 저장/하위호환 + 실시간 도전과제 감시 + 명예의 전당 아카이빙)
│   ├── types/
│   │   ├── player.ts              # Player, Position, SubPosition, PlaystyleId, getCardTier
│   │   ├── league.ts              # Club, LeagueData, Fixture, MatchResult, ExtraTimeInfo, PenaltyKickLog, LiveHalftimeState, PlayerSeasonStats, PlayerTransferRecord
│   │   ├── game.ts                # GameState, GamePhase, SeasonState, TransferMarketState, ChemistryResult, TeamRatings
│   │   ├── cup.ts                 # DomesticCupState, CupStageId, CupMeta, CupMatchNode
│   │   ├── ucl.ts                 # UclTournamentState, UclTeamEntry, UclKnockoutTie, UclPhaseStage
│   │   ├── legacy.ts              # LegacyStorageState, HallOfFameEntry, SeasonScoreBreakdown, HiddenAchievementDef
│   │   └── phase2.ts              # Phase 1 -> Phase 2 핸드오프 요약 타입
│   ├── data/
│   │   ├── activePlayers.json     # FotMob 2026-27 유럽 5대 리그 96개 구단 현역 2,188명 (복수 주포지션·stamina·playstyles 포함)
│   │   ├── legendPlayers.json     # 레전드 33명 (레벤수 3인방 포함, stamina 포함)
│   │   ├── leagues.json           # 유럽 5대 리그 96개 구단 (EPL 20, 라리가 20, 세리에 A 20, 분데스리가 18, 리그 1 18)
│   │   ├── uclTeams.json          # 비5대 리그 유럽 강호 16개 구단 · 176명 풀 스쿼드 (5대 리그와 중복 0건)
│   │   ├── formations.ts          # 6종 포메이션 좌표·케미 링크 + 벤치 5슬롯
│   │   ├── managerTraits.ts       # 14종 감독 강점 정의
│   │   ├── playstyles.ts          # 14종 플레이스타일 및 스타일 시너지 쌍
│   │   ├── achievements.ts        # 24종 히든 도전과제 (힌트/해금 제목/역사적 모티브/조건)
│   │   ├── historicalTeams.ts     # 역대 최강 14팀 벤치마크 데이터
│   │   └── patchNotes.ts          # 인게임 패치노트 데이터 (v1.0 ~ v2.6)
│   ├── engine/
│   │   ├── dataLoader.ts          # JSON 로더, AI 11인 로스터 생성(buildAiClubRoster + excludeIds), 대체 자원 보충(pickReplacementForAiClub)
│   │   ├── positionEngine.ts      # 복수 주포지션/부포지션 적합도 & 실효 OVR 계산
│   │   ├── chemistryEngine.ts     # 3색 병렬 케미(구단/국적/스타일+역할) & 팀 실전 OVR 계산
│   │   ├── tacticEngine.ts        # 5종 전술 & 포메이션 상성, 하프타임 힌트 생성
│   │   ├── staminaEngine.ts       # 인게임 체력 소모(0'~120'), 피로 패널티, 60'~82' 자동 교체 계획
│   │   ├── draftEngine.ts         # 3구단 멀티 후보 드래프트 룰렛 (OVR 상위 3명 결정적 노출 + 레전드 독립 확률)
│   │   ├── lineupOptimizer.ts     # 포메이션 변경 시 스마트 재배치 & 자동 최적 베스트 11
│   │   ├── scheduleEngine.ts      # Fisher-Yates 랜덤 셔플 더블 라운드 로빈 일정 생성
│   │   ├── matchEngine.ts         # 포아송 xG 경기 엔진, 전반/후반/실시간 교체 재시뮬, 10종 하이라이트, 연장전/승부차기
│   │   ├── standingsEngine.ts     # 순위표 정렬, 단일 playerId 스탯 누적 및 레거시 user:: 키 정규화
│   │   ├── otherLeaguesEngine.ts  # 타 4대 리그 백그라운드 동시 시뮬레이션 & UCL 20팀 진출 요약
│   │   ├── transferEngine.ts      # 3구단 동적 이적시장 (포지션별 OVR 상위 3명 보장, 몸값·확률·UCL 우승 프리미엄)
│   │   ├── cupEngine.ts           # 5대 리그 자국 컵 16강~결승 토너먼트 진행
│   │   ├── uclEngine.ts           # 36팀 4포트 편성, O(N) 8R 스위스 일정, 플레이오프 부전승 일괄 완료, 토너먼트
│   │   ├── awardsEngine.ts        # 리그 어워드 & 시즌 완전 종료 단일 발롱도르·월드베스트 XI 종합 산정
│   │   ├── analyticsEngine.ts     # 팀/스쿼드 세부 분석 + 다중 대회 스탯 병합(mergePlayerStatsMaps)
│   │   └── legacyEngine.ts        # PPG×38 공정 시즌 스코어, 명예의 전당 storage(0위 자가 복구), 24종 히든 도전과제 판정
│   ├── utils/
│   │   ├── playerLookup.ts        # 전역 선수 조회, 리그/컵/UCL/통합 4단 세부 스탯 및 이적 이력 조합, 구단 로스터 조회
│   │   └── clubPresets.ts         # 이전 팀 프리셋 localStorage 저장/복원
│   ├── components/
│   │   ├── common/                # HeaderNav, JerseySvg, PitchBoard, PlayerCard, PlayerDetailModal, MatchDetailModal, ClubSquadModal, PatchNotesModal
│   │   ├── setup/                 # TitleScreen, FormationSelect (1단계), ManagerRouletteScreen (2단계)
│   │   ├── draft/                 # DraftScreen (3단계, 2단계 확정)
│   │   ├── league/                # LeagueSelect, SeasonDashboard, LiveMatchBroadcast, PitchMatch2D, FastSimModal, CupBracketView (SVG 트리), SeasonSummary, TeamAnalyticsTab, StandingsTable
│   │   ├── transfer/              # TransferMarketModal (좌우 분할 + 피치 뷰 + UCL 특별 이적시장)
│   │   ├── ucl/                   # UclDashboard, UclBracketTree (SVG 트리)
│   │   ├── legacy/                # LegacyHubModal (명예의 전당 + 역대 14팀 + 24종 도감), AchievementToast
│   │   └── guide/                 # SystemGuideModal
│   └── __tests__/                 # 17개 유닛 테스트 (총 55개 테스트)
```

---

## 3. 현재 구현 완료된 전체 게임 루프 (v2.5)

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
