# Road To Treble — PROJECT HANDOFF GUIDE (v7.0)

이 문서는 GitHub 저장소(`darksuri82/roadtotreble`)가 연결된 **Antigravity 프로젝트 대화창**에서 다음 에이전트가 별도의 탐색 없이 즉시 개발·배포를 이어갈 수 있도록 프로젝트의 전체 아키텍처, 구현 명세, 핵심 밸런스 수식, 데이터 구조, 그리고 Phase 3 예정 작업을 정리한 인수인계 문서입니다.

---

## 1. 기술 스택 및 실행 환경

- **Framework**: React 19 + TypeScript (strict) + Vite 8.3.8 (Rolldown)
- **Realtime Backend**: Supabase (`@supabase/supabase-js` — Postgres `mp_rooms` / `mp_room_players` + Realtime Postgres Changes + Presence, `supabase/schema.sql`)
- **Styling**: Tailwind CSS v4 (`@tailwindcss/vite`) — 미니멀 다크 스포츠 대시보드 테마 (`#090d13`, `#0d131c`, `#0e141d`, `#111822`, 차분한 슬레이트 UI 크롬 + 웅장한 레전드/슈퍼스타/월클 카드 글로우 & 선명한 4색 피치 시너지선)
- **Icons**: `lucide-react` + 커스텀 도트 SVG (`RoadToTrebleHeroSvg.tsx`, `PixelTrophySvg.tsx`, `PixelManagerAvatar.tsx`, `PixelStatusIcon.tsx`, `PixelEventSceneBanner.tsx`) + 105개국 인라인 SVG 국기 (`CountryFlagSvg.tsx`)
- **Testing & Lint**: Vitest (`npm run test` — **26개 파일 / 103개 테스트 PASS**), `oxlint` (`npm run lint` — 0 errors)
- **Build**: `npm run build` (`tsc -b && vite build` — `base: './'` 설정으로 GitHub Pages 서브경로 및 루트 배포 모두 호환, `.github/workflows/deploy.yml`에서 `VITE_SUPABASE_URL`·`VITE_SUPABASE_ANON_KEY` Secret 주입)
- **라이브 URL**: `https://darksuri82.github.io/roadtotreble/` (`.github/workflows/deploy.yml` 자동 배포 활성화 완료)
- **롤백 세이브포인트 태그**: `stable-before-v5-tactics` (`v4.1` `a77f6a4`), `stable-before-v5-polish` (`v5.0.2` `4eb1f74`), `stable-before-mobile-compact` (`v5.1` `17be061`), `stable-before-v6-hof-roster` (`v5.2` `9af2760`), `stable-before-v6-balance-ux` (`v6.1` `8133925`), `stable-before-v6-color-polish` (`v6.2-core` `c0717dd`), `stable-before-v7-multi-1v1` (`v6.2.1` `88bb954`)
- **필수 운영 규칙 (패치노트 기본 기록)**: 기능 추가·밸런스 조정·버그 수정 등 **모든 수정 배포 시 기존 버전을 덮어쓰지 말고 반드시 새 버전(`vX.Y` 또는 `vX.Y.Z`)으로 `src/data/patchNotes.ts`(`CURRENT_APP_VERSION` + `PATCH_NOTES` 최상단 추가) 및 `CHANGELOG.md`에 변경 사항을 빠짐없이 시간순 누적 기록**할 것.
- **UI 미니멀리즘 원칙**: 게임 플레이 화면에 장황한 AI식 설명 문구·홍보 배너·"새 기능!" 잡다한 텍스트를 배치하지 않고, 간결한 아이콘·수치로만 표현하며 상세 설명은 기존 가이드/전술 도감 모달 및 클릭형 `?` 팝오버(`InfoHelpButton.tsx`, `UnifiedTacticsStrip.tsx`) 내부에만 수록.
- **v7.0 주요 신규 모듈·기능**:
  - **Supabase 실시간 멀티플레이 인프라 & 로비 (`supabase/schema.sql`, `src/lib/supabaseClient.ts`, `src/types/multiplayer.ts`, `src/services/multiplayerService.ts`, `MultiplayerLobby.tsx`, `.github/workflows/deploy.yml`)**: `mp_rooms`/`mp_room_players` 스키마·RLS·Realtime, 6자리 초대 코드·원클릭 초대 링크(`?room=XXXXXX`) 자동 입장, Presence 접속 표시·준비 완료 토글, 미설정 환경 안전 안내 UI, 추후 2단계 멀티 리그 확장형 모드 선택 구조.
  - **1대1 블라인드 드래프트 & 호스트 권위형 대칭 2D 경기 동기화 (`MultiplayerBlindDraft.tsx`, `MultiplayerArena.tsx`, `matchEngine.ts`, `MatchDayTacticsRoom.tsx`, `LiveMatchBroadcast.tsx`, `MatchReportPanel.tsx`, `v70Multiplayer1v1.test.ts`)**: 상호 비공개 감독 능력·16인 동시 드래프트(중복 선수 허용, 진행 중 `draft_progress`만 전송해 제로 리크 보장) → 매치 데이 전술실 라인업 공개 → `opponentUserContext` 대칭 PvP 엔진(AI 자동 대응 배제) 기반 전반·하프타임 동시 수싸움·후반·연장·PK 100% 동일 2D 중계 및 `[같은 팀으로 재대결]` / `[새 드래프트로 1대1]`.
- **v6.2.1 주요 조정**:
  - **피치 시너지 연결선 & 월클/슈퍼스타/레전드 카드 웅장함 복원 (`index.css`, `PlayerCard.tsx`, `PitchBoard.tsx`, `OpponentPitchView.tsx`)**: 차분한 다크 슬레이트 UI 크롬·상단 헤더 분리·이름 잘림 개선은 유지하면서, 4색 시너지 연결선의 선명한 채도·두께(`0.88`, 호버 강조 `1.0`)와 레전드(골드)·슈퍼스타(사이언)·월드클래스(스카이) 카드의 웅장한 테두리·글로우 복원.
- **v6.2 주요 신규 모듈·기능**:
  - **명예의 전당 공정 계산식 전면 재설계 (`legacyEngine.ts`, `historicalTeams.ts`, `GameContext.tsx`, `v60HofAndRoster.test.ts`)**: 편향·급등 절벽 제거, 시즌 성과 + 전력·시너지·전술 이행도(`evaluateTeamTacticalProfile`) 상한선 기반 공정 단일 공식 적용(유저·역대 24팀 100% 동일).
  - **UCL 토너먼트 진출 팝업 & 우승/트레블 대형 축하 모달 (`UclMilestoneModal.tsx`, `UclDashboard.tsx`, `index.css`)**: 16강·8강·4강·결승 진출 팝업 및 대형 빅이어(`120px`)·컨페티·MVP·트레블 3관왕 축하 연출 구현(스킵 모달 순차 표시).
  - **첫 페이지 SD 감독 도트 리뉴얼 & 정상 염소 이스터에그 (`RoadToTrebleHeroSvg.tsx`)**: 귀여운 SD 2등신 감독 캐릭터 재디자인 및 정상 빅이어 옆 텍스트 없는 염소 픽셀 추가.
  - **양 팀 피치 겹침 버그 수정 & 전역 눈 편한 색감·케미선 개편 (`PitchBoard.tsx`, `OpponentPitchView.tsx`, `MatchDayTacticsRoom.tsx`, `PlayerCard.tsx`, `RouletteReelsView.tsx`, `StandingsTable.tsx`, `index.css`)**: 포메이션·케미 배지를 피치 상단 전용 헤더 바로 분리, 케미선 기본 완화 + 호버/선택 강조, 한국어 긴 이름 스마트 축약 및 전역 글로우·네온 톤 완화.
- **v6.1 주요 신규 모듈·기능**:
  - **트레이드 역제안 헤더 복귀 & 이적시장 실수 종료 방지 (`TransferMarketModal.tsx`)**: `[← 받은 제안으로]` 버튼을 우측 상단 `[이적시장 끝내기]` 바로 왼쪽에 통합 배치하고 중복 안내 바 제거, 남은 기회·대기 제안 존재 시 종료 확인 모달(`#confirm-close-transfer-window-btn`)로 실수 종료 방지.
  - **명예의 전당 스쿼드 OVR 비중 강화 (`legacyEngine.ts`, `v60HofAndRoster.test.ts`)**: 공통 공식 `computeSeasonScore`의 `squadCraftBonus`에 선발 기본 OVR(`baseOvrPts`)·실효 OVR·벤치 뎁스 가중치를 강화하고 자국 리그 대기록 중첩 점수를 조정해 `14-15`·`10-11`·`08-09` 바르셀로나 등 최상위 OVR 스쿼드가 자연스럽게 최상위권에 배치.
  - **전역 소형 네온 색감 절제 & 양 팀 피치 비교 카드 가독성 개선 (`PitchBoard.tsx`, `OpponentPitchView.tsx`, `MatchDayTacticsRoom.tsx`, `TransferMarketModal.tsx`, `SeasonDashboard.tsx`, `LegacyHubModal.tsx`, `UclDashboard.tsx`, `SquadManagerModal.tsx`, `LiveMatchBroadcast.tsx`, `SeasonSummary.tsx`, `LeagueSelect.tsx`, `FastSimModal.tsx`, `MatchDetailModal.tsx`, `TacticsGuideModal.tsx`, `SystemGuideModal.tsx`)**: 소형 탭·토글·필터를 다크 슬레이트 + 은은한 포인트 테두리로 통일하고, 양 팀 피치 비교 카드 크기·OVR/이름 폰트 비율 및 여백 정비.
- **v6.0 주요 신규 모듈·기능**:
  - **트레이드 `[받은 제안 → 역제안]` 뒤로가기 동선 수정 (`TransferMarketModal.tsx`)**: 역제안 진입 후 `[← 이전으로]` 클릭 시 이적시장 이탈 없이 직전 화면(받은 제안 목록 / 트레이드 룰렛 화면)으로 정확히 복귀, PC·모바일 상·하단 고정 바 명확 배치.
  - **명예의 전당 피치 스쿼드 상세 뷰 & 감독 시너지·실효 OVR 순위 개편 (`LegacyHubModal.tsx`, `legacyEngine.ts`, `historicalTeams.ts`)**: `PitchBoard` 재사용으로 역대 24팀·유저 명전 팀 모두 선발 11명 피치·4색 케미선·실효 OVR·벤치·감독(OVR·스타일) 한눈에 시각화(구버전 자동 복원 지원), `squadCraftBonus`에 감독 시너지 비율과 실효 OVR 완성도 비중 강화(유저·역대 팀 100% 동일 공식 적용).
  - **명예의 전당 역대 최강 10팀 대거 추가 — 총 24팀 (`historicalSquadsData.ts`, `historicalTeams.ts`, `formerClubs.ts`)**: `71-72 아약스`, `10-11 바르셀로나`, `16-17 레알 마드리드`, `24-25 PSG`, `88-89 AC 밀란`, `07-08 맨유`, `19-20 리버풀`, `06-07 AC 밀란`, `01-02 레알 마드리드`, `94-95 아약스` 10팀(170명 풀스쿼드 + 명장 + 전 소속팀 시너지 하이드레이션 + 드림 매치 연동, 전 24팀 264명 선발 포지션 페널티 0, 비리그 우승 UCL 챔피언 순위 표기 수정).
  - **브라이튼 파스칼 그로스 & 5대 리그 2026-27 로스터 전수 보강 (`activePlayers.json`, `leagues.json`, `formerClubs.ts`, `v60HofAndRoster.test.ts`)**: 파스칼 그로스(`act-263`, `73 → 83`)·루이스 덩크(`74 → 80`) 상향 및 브라이튼 표기 정비, 3건 음차 중복 완전 해소(`룰리`·`비얄리브레`·`콜 캠벨`), 누락 주전 첼시 조던 헨더슨(`act-v6-henderson`, 79) 추가, 도르트문트 막시밀리안 바이어 `FW` 정상화, 5대 리그 2026-27 베테랑·주전 25명 OVR 보정(현역 2,204명 · 레전드 33명 · 96구단 최소 뎁스 100% 충족).
- **v5.2 주요 신규 모듈·기능**:
  - **첫 페이지 실제 `24×28` 도트 트로피 복원 & 모바일 `100dvh` 원스크린 (`PixelTrophySvg.tsx` `getPixelTrophyRects`, `RoadToTrebleHeroSvg.tsx`, `TitleScreen.tsx`)**: EPL 골드 왕관 트로피·FA컵·대형 UCL 빅이어 실제 픽셀 아트를 트레블 로드(`240×94`)에 직접 복원하고 모바일 첫 화면을 한 화면 안에 수납.
  - **모바일 교체·트레이드 오터치(선수 상세 카드 겹침) 완전 해결 (`PitchBoard.tsx`, `TransferMarketModal.tsx`)**: 모바일 피치/벤치/트레이드 카드 전체를 선택·교체 전용 영역으로 통일하고, 선택 시 상단 `[선수 상세]` 바·리스트 우측 분리 `ⓘ` 버튼·하단 고정 트레이드 바 선수 칩에서만 상세 카드가 열리도록 분리.
  - **모바일 전역 한눈에 보기 레이아웃 압축 (`HeaderNav.tsx`, `DraftScreen.tsx`, `RouletteReelsView.tsx`, `SeasonDashboard.tsx`, `MatchDayTacticsRoom.tsx`, `OpponentPitchView.tsx`, `InjuryAlertModal.tsx`, `LiveMatchBroadcast.tsx`, `StandingsTable.tsx`, `UclDashboard.tsx`, `UclBracketTree.tsx`)**: CSS `zoom`·이중 스크롤 없이 드래프트 가로 스와이프+하단 고정 확정 바, 매치 프리뷰 모바일 단일 피치 기본 전환, 이적시장 하단 고정 제출 바, 2D 중계 피치 바로 아래 실시간 중계 배치, 순위표/대진표 행·카드 압축 구현(PC 레이아웃 보존).
- **v5.1 주요 신규 모듈·기능**:
  - **공식 타이틀 `Road To Treble` 통일 & 첫 화면 트레블 로드 도트 일러스트 리뉴얼 (`index.html`, `RoadToTrebleHeroSvg.tsx`, `TitleScreen.tsx`, `HeaderNav.tsx`, `PatchNotesModal.tsx`, `SystemGuideModal.tsx`, `LegacyHubModal.tsx`)**: 전 화면 브랜드명 통일, 드래프트(도트 감독·축구공·깃발)→리그→컵→정상 빅이어로 이어지는 픽셀 아트 "길(Road)" 히어로 중심의 깔끔한 원스크린 첫 화면 구축.
  - **부상 확률 대폭 하향 & 사기/인터뷰 리스크-리턴 재밸런싱 (`conditionEngine.ts`, `managerEvents.ts`, `condition.ts`, `ManagerEventModal.tsx`, `InjuryMoraleGuideContent.tsx`, `v51PolishAndRebalance.test.ts`)**: 부상 기본 확률 약 1/3 이하 하향(`minor 0.13%` / `moderate 0.011%` / `severe 0.0018%` / `aggravation 4%`), 사기 OVR 임계치 상향(`-2..+2 => 0`, `±3..±4 => ±1`, `±5 => ±2`, 팀 `±5 => ±0.5`), 일반 경기 승패 변동폭 축소 및 72종 인터뷰 `🔥 고위험` / `⚡ 승부수` / `안정` 리스크 배지·양극화 적용.
  - **명예의 전당 자동 등재 기준 상향(5,500+) & 수동 등록 (`legacyEngine.ts`, `GameContext.tsx`, `SeasonSummary.tsx`)**: `isEligibleForAutoHofInduction`(5,500점+ / S+ / UCL 우승 / 트레블) 충족 시에만 자동 등재, 미만 시즌은 결산 화면 `[명예의 전당 수동 등록]` 버튼 지원.
  - **전역 UI/UX 모던 다이어트 — 모바일 & Phase 2 UCL (`InfoHelpButton.tsx`, `DraftScreen.tsx`, `TransferMarketModal.tsx`, `UclDashboard.tsx`, `LegacyHubModal.tsx`, `SquadManagerModal.tsx`)**: 드래프트 대형 아코디언 배너·트레이드 설명 문구·UCL 진행 안내를 클릭형 `?` 팝오버로 수납하고 Phase 2 헤더·모바일 3열 KPI·5탭 바를 Phase 1과 통일된 차분한 다크 스포츠 톤으로 마감.
- **v5.0 ~ v5.0.2 주요 신규 모듈·기능**:
  - **신규 포메이션 3종(총 9종 확장) (`src/data/formations.ts`, `src/types/game.ts`, `src/engine/positionEngine.ts`, `src/engine/lineupOptimizer.ts`, `src/engine/tacticalMovement.ts`)**: `4-4-2-diamond`(4-4-2 다이아몬드), `3-3-3-1`, `3-5-2-dm`(3-5-2 DM) 3종 포메이션의 좌표·슬롯·`alternateSubPositions` 호환 포지션·케미 링크·2D 오프더볼 움직임·9종 선택 UI 전면 구현.
  - **현실 축구형 [통합 전술 수싸움] 엔진 (`src/engine/unifiedTacticsEngine.ts`, `src/engine/matchEngine.ts`, `src/components/league/MatchDayTacticsRoom.tsx`)**: 분리된 포메이션/전술 `+OVR!` 스택을 폐지하고 1단계 내부 전술 완성도(`tacticalFit`: 포메이션×전술 구조 35% + 스쿼드 OVR 정규화 세부 능력치/스타일 45% + 감독 스타일/OVR 20%) → 2단계 5대 구역 대결(`midfield` · `flanks` · `transition` · `box` · `pressing`)로 점유율·ATT/MID/DEF·임계치 임상 xG·공격 루트 비중(`routeWeightMods`) 산출. 프리뷰는 `[완성도 N% + 5구역 ▲/─/▼ + ? 툴팁]` 1줄 요약 표시.
  - **선수 시너지 4원칙 통일 · 공식 전 소속팀(`formerClubs`) 연동 & 감독 궁합 독립 분리 (`src/engine/chemistryEngine.ts`, `src/data/formerClubs.ts`, `src/data/managerTraits.ts`, `src/components/common/PitchBoard.tsx`, `PlayerDetailModal.tsx`)**: 레전드 와일드카드 및 전술/감독 혼합 링크 제거, 오직 **① 같은 팀/전 소속팀(35) · ② 같은 국적(20) · ③ 플레이스타일 궁합(30) · ④ 엘리트 페어 88+(15)** 4원칙(4색 케미선) 통일. 추측 없이 공식 1군 커리어만 검증한 레전드 33명 + 주요 현역 ~170명의 `formerClubs` 반영. 감독 스타일 궁합은 선수 개인 실효 OVR 독립 상승(`+1~+2`, 개인 총 보정 캡 `+3`)으로 분리해 5대 리그 96구단·UCL 16구단·명전 14팀 전역 적용.
  - **전 구단 AI 감독(OVR·스타일) & 하프타임 능동적 수싸움 (`src/data/aiManagers.ts`, `src/engine/unifiedTacticsEngine.ts`, `src/engine/matchEngine.ts`, `src/engine/tacticEngine.ts`, `GameContext.tsx`, `LiveMatchBroadcast.tsx`, `DreamMatchArena.tsx`)**: 5대 리그 96구단 + UCL 16구단 + 명전 14팀 전 구단에 AI 감독(OVR 70~99, `ManagerTraitId`, 선호 포메이션/전술) 부여. 리그·컵·UCL·드림 매치 전반에서 AI 감독이 하프타임에 전반 흐름을 읽고 OVR 차등 기반 포메이션·전술·교체(최대 2명) 카운터 실행, 수석코치 조언 현실적 불확실성 반영, 후반 시작 시 중계 헤더 1줄(`⚡ [감독명] 하프타임 대응`) 표시 (`v50UnifiedTacticsAndManagers.test.ts`).
- **v4.1 주요 신규 모듈·기능**:
  - **명예의 전당 역대 강팀 14팀 17인 풀스쿼드·명장 시너지·공정 시즌 스코어 재조정 (`src/data/historicalSquadsData.ts`, `src/data/historicalTeams.ts`, `src/engine/legacyEngine.ts`, `src/types/legacy.ts`, `LegacyHubModal.tsx`, `SeasonSummary.tsx`)**: 역대 14팀 전체를 포메이션 정렬 선발 11명 + 핵심 벤치 6명(총 238명) 풀스쿼드 & 7+5 세부 능력치·플레이스타일 + 명장 지휘력(91~99)·감독 특성·도트 아바타로 완전 구체화하고, 유저와 동일한 `computeSeasonScore`에 역사적 대기록 보너스(`honorsBonusDetails`)와 스쿼드 OVR·팀 케미·감독 시너지·명장 지휘력 보너스(`squadCraftBonus`)를 공정 반영 (`v41HofDreamMatchScenes.test.ts`).
  - **[⚔️ 드림 매치 (명예의 전당 챌린지)] 모드 (`src/components/dream/DreamMatchArena.tsx`, `LiveMatchBroadcast.tsx`, `GameContext.tsx`, `TitleScreen.tsx`, `LegacyHubModal.tsx`, `App.tsx`)**: 진행 중인 시즌 세이브를 보존한 채 독립 실행되는 역대 강팀 단판 챌린지. [방식 A · 내 명전 팀 불러오기(`fullStarters`/`fullBench` 스냅샷 + `reconstructHallOfFameSquad` 구버전 자동 복원)] 및 [방식 B · 즉석 16인 드림 드래프트] 모두 지원, `MatchDayTacticsRoom` → `LiveMatchBroadcast`(`override` 어댑터, 90'/105' 연장 라커룸 + PK 포함) → `MatchReportPanel` + `dreamMatchRecords` 격파 전적 영구 기록.
  - **기자회견·라커룸 8종 도트 배경 씬 · 커스텀 감독 등장 · 직전 경기 스탯 카드 (`src/components/common/PixelEventSceneBanner.tsx`, `src/data/managerEvents.ts`, `src/components/common/ManagerEventModal.tsx`, `src/types/condition.ts`)**: 공식 회견장·UCL 야간 회견장·믹스트존·홈 라커룸·경기장 터널·감독실 1:1·훈련장 피치·승리 환호 라커룸 8종 픽셀 아트 배경 자동 매칭(`resolveManagerEventSceneId`), 유저 커스텀 `PixelManagerAvatar` 전경 단상/책상 레이어 합성, 대상 선수 미니 카드 및 `buildManagerEventMatchContext` 직전 경기 스코어·개인 스탯(평점·골/도움·xG·드리블 돌파·선방·MOM) 요약 카드 연동.
- **v4.0 주요 신규 모듈·기능**:
  - **전 선수 세부 능력치(Sub-Attributes) 체계 (`src/types/player.ts`, `src/data/attributeOverrides.ts`, `src/engine/attributeEngine.ts`, `activePlayers.json`, `legendPlayers.json`)**: 전 선수 2,239명(현역 2,206 + 레전드 33) + 생성 자원에 필드 7대(`SHO·PAS·CRO·DRI·AER·DEF·PHY`) + GK 5대(`DIV·HAN·REF·KIC·POS`) 세부 능력치 부여(40~99, 포지션 가중 평균 `OVR ±2` 정합성 유지). 기존 디자인 톤을 그대로 유지한 `PlayerSubAttributesCard.tsx`(7각/5각 SVG 레이더 차트 + 스탯 바 + 아키타입 배지)를 `PlayerDetailModal.tsx`에 통합
  - **단계별 공격 체인 경기 시뮬레이션 엔진 (`src/engine/attackChainEngine.ts`, `src/engine/matchEngine.ts`, `src/types/league.ts`)**: 팀 단위 `Poisson(λ)` 승점 밸런스를 보존하면서 득점·어시스트·찬스·세이브 이벤트를 **빌드업 → 14종 공격 루트(`AttackRouteId`: 원맨 드리블 쇼 `solo_dribble` · 중거리 대포알 `long_range_cannon` · 티키타카 삼각 연계 `tiki_taka_triangle` · 선수비 후역습 `low_block_counter` · 게겐프레싱 탈취 · 얼리 크로스 · 컷백 · 스루패스 · 세트피스 등) → 창출자(`PAS/CRO/DRI`) → 수비수(`DEF/AER`) 경합 → 마무리자(`SHO/AER`)** 단계 체인으로 전면 개편. 4시즌×3리그 아키타입 검증(`v40AttributeEngine.test.ts`: 어시스트 비율 ~70%, 헤더 ~13%, 원맨 드리블 ~4.2%, 세트피스 ~18.5%, 정통 9번 vs 크랙 윙어 vs 10번 자연 분포 확인)
  - **현대 축구 2D 전술 움직임 심화 & `[📊 세부 능력치 & 득점 루트]` 가이드 탭 (`src/engine/tacticalMovement.ts`, `PitchMatch2D.tsx`, `AttributeRoutesGuideContent.tsx`, `SystemGuideModal.tsx`, `TacticsGuideModal.tsx`)**: 전술별 2D 오프더볼·빌드업·수비 블록(점유율 GK 빌드업/인버티드 풀백/삼각 패스, 게겐프레싱 하이 라인/3인 압박 트랩, 역습 로우 블록/직선 침투, 측면 공략 풀백 오버래핑) 및 신규 공격 루트 4종 슬로우모션 애니메이션 구현, `[가이드]`/`[전술 도감]` 모달에 전용 탭 신설
- **v3.3 주요 신규 모듈·기능**:
  - **상대 AI 구단 벤치 누락 해결 · 5대 리그 96구단 풀스쿼드 보강 & 핵심 벤치 5인(16인 규격) 표준화 (`dataLoader.ts`, `transferEngine.ts`, `playerLookup.ts`, `GameContext.tsx`, `activePlayers.json`)**: `buildAiClubRoster`가 선발 11명만 생성한 뒤 `buildTransferClubSquad`가 `aiRoster.length >= 11` 분기에서 후보 풀을 건너뛰어 벤치가 0명으로 나오던 버그를 해결. `buildAiClubSquad16`을 도입해 모든 AI 구단을 우리 팀과 동일한 **16인 규격(선발 11명 + 핵심 벤치 5명: OVR 높은 순 `GK 1 / DF 2 / FW·MF 2`)**으로 표준화하고, FotMob 2026-27 실존 선수 18명 보강으로 96개 전 구단 `총원 ≥ 20, GK ≥ 2, DF ≥ 6, MF ≥ 5, FW ≥ 4`(총 현역 2,206명, 전 세계 중복 0건, 레벤수 레전드 유지) 완비
  - **트레이드 `가치` 한국어 표기 통일 · 포지션 니즈 비중 강화 & 루카 돈치치급 `🚨 충격 급매물` (`TransferMarketModal.tsx`, `transferEngine.ts`)**: `TP` 표기를 전부 **`가치`**로 통일, 상대 구단 포지션 니즈 비중 대폭 강화(`#1 최우선 니즈 +32% & 성사율 +8%p`, `#2 보강 니즈 +18% & +4%p`, `포화 포지션 -25% & -10%p`, 상대 포화 포지션 영입 `-12%`), 선수당 ~4.5% 확률(구단당 최대 1명)로 요구 가치 `-35%` 할인 및 87+ 가드 면제가 적용되는 **`🚨 충격 급매물(evaluateShockBargainStatus)`** 및 타 구단 먼저 오는 **`🚨 블록버스터 급매 제안(isBlockbusterBargain)`** 추가
  - **부상·사기 OVR 증감 직관적 표시 & `[🩺 부상 & 사기 가이드]` 탭 추가 (`conditionEngine.ts`, `PitchBoard.tsx`, `SquadManagerModal.tsx`, `UclDashboard.tsx`, `PlayerCard.tsx`, `PlayerDetailModal.tsx`, `InjuryMoraleGuideContent.tsx`, `SystemGuideModal.tsx`, `TacticsGuideModal.tsx`)**: `computeFullPlayerOvrBreakdown`으로 피치·스쿼드·선수 카드에 사기(`+2/+1/-1/-2`)·부상(`-1~-4` / `결장`) OVR 배지 표시, 호버 툴팁 및 상세 카드 상단에 **`기본 OVR / (포지션) / 시너지 / 사기 / 부상 → 최종 실효 OVR`** 5단 계산 패널 추가, `[가이드]` 및 `[전술 도감]` 모달에 코드 100% 일치 **`[🩺 부상 & 사기 가이드]`** 탭 신설
- **v3.2.1 주요 핫픽스·UX 개선**:
  - **이적시장 닫기 검은 화면 크래시 근본 수정 (`TransferMarketModal.tsx`)**: Wrapper/Inner 분리로 조건부 훅 실행(`Rendered fewer hooks than expected`) 원천 제거 및 이적시장 창 전환 시 로컬 상태 자동 리셋
  - **타 구단 제안 포지션 모순 제거 & 선수 상세 카드 연동 (`transferEngine.ts`, `GameContext.tsx`, `TransferMarketModal.tsx`)**: 요청 포지션·최우선 필요 포지션 제시 차단(GK≤2·GK 필요 시 GK 판매 불가), `TRADE_ACCEPT_INCOMING` 최소 GK 가드 추가, 트레이드 전 화면 선수 이름 클릭 시 `PlayerDetailModal` 즉시 표시
  - **양 팀 포메이션 피치 + 하단 벤치 트레이드 뷰 & 확률 상향·0% 제거 (`TransferMarketModal.tsx`, `transferEngine.ts`)**: 양 팀 포메이션 피치+벤치 기본 뷰(`[포메이션 보기 / 리스트 보기]` 전환), 동등 가치 성사 확률 ~72% 상향 및 0% 구간 제거(최소 2~3% 기적 도전 확률)
- **v3.2 주요 신규 모듈·기능**:
  - **NBA식 구단 트레이드 제도 전면 개편 (`transferEngine.ts`, `GameContext.tsx`, `TransferMarketModal.tsx`, `PlayerDetailModal.tsx`)**: 지수형 TP(`10 * 1.185^(ovr-70)`) + 다대일 압축 보정(`100%/78%/60%`) + OVR 87+ 슈퍼스타 최소 핵심급 가드(`maxUserOvr >= targetOvr - 7`) + 구단 실제 스쿼드 포지션 니즈(`+18%/+10%/-15%`) + Option 3 로스터 16인 자동 로테이션 백업 매칭 + 타 구단 먼저 오는 트레이드 제안(0~5건, 수락/역제안/거절) + 5대 리그·UCL 100% 양방향 로스터 이동(중복 0건, 누적 스탯 보존, `🔄 트레이드` 이력, `injuryAutoReturns` 정리)
  - **드래프트 임시 배치 중 자리 이동 (`DraftScreen.tsx`)**: 프리뷰 모드 중 기존 선발·벤치 클릭/드래그 스왑(`previewSwaps`), 실시간 케미/시너지 OVR/스탯 재계산, `[배치 원복]` 및 확정 시 자동 반영
  - **2D 경기 시뮬레이션 ↔ 통계 정합성 강화 (`matchEngine.ts`, `PitchMatch2D.tsx`, `LiveMatchBroadcast.tsx`)**: 비득점 공격/세이브/VAR 하이라이트를 실제 슈팅·유효슈팅·xG 비중에 연동, 2D 일반 전개에 단계적 빌드업·슈팅/xG 라인 시프트·전술별 움직임 패턴 반영
  - **매치 프리뷰 기본 화면 & UCL 토너먼트 스킵 팝업·합산 강조 (`MatchDayTacticsRoom.tsx`, `UclDashboard.tsx`, `LiveMatchBroadcast.tsx`, `UclBracketTree.tsx`)**: 프리뷰 기본 탭 `'split'`(`[양 팀 피치 비교]`), UCL 1경기 스킵 영구 결과 팝업 모달(`#ucl-skip-result-modal`), 2차전 프리뷰·2D 전광판·브래킷 트리 1차전/합산(AGG) 시인성 강화
- **v3.1 주요 신규 모듈·기능**:
  - **누적 피로도(Fatigue) 완전 제거 & 단독 부상 확률 재조정**: 우리 팀·AI 5대 리그 전체의 경기 간 누적 피로도 계산·OVR 페널티·UI 게이지/배지 완전 삭제(부상·사기·단일 경기 내부 체력 `staminaEngine.ts`는 그대로 유지), 단독 부상 기본 확률 재조정(경상 `0.42%` / 중상 `0.030%` / 치명적 중상 `0.006%`, 경상 강행 악화 고정 `6%`, 경기당 팀 신규 부상 최대 1명 캡, 부상 시 사기 `-1/-2/-3` 하락)
  - **포메이션 피치 기반 부상 교체 팝업 (`InjuryAlertModal.tsx`, `PitchBoard.tsx`)**: `PitchBoard`(`compact`) 재사용 + 부상 슬롯 빨간 테두리 강조(`highlightedPlayerIds`) + 선발 간 자유 포지션 스왑 & 실시간 대상 슬롯 포지션 적합도 벤치 추천 패널(`recommendBenchReplacements`)
  - **부상 완치 시 원 선발 자동 복귀 (`resolveAutoReturnInjuredStarters`, `GameContext.tsx`, `InjuryReturnToast.tsx`)**: 부상 교체 시 `season.injuryAutoReturns`에 원 선발·슬롯·대체 선수 기록, 완치 시 모든 대회/고속진행 공통으로 원 선발 자동 복귀(다단계 스왑 역복원·이적/수동복귀 안전 가드) 및 상단 알림 토스트(`InjuryReturnToast`) 표시
- **v3.0 주요 신규 모듈·기능**:
  - **전 리그·전 대회 현실적 3단계 부상 시스템**: `src/types/condition.ts`, `src/engine/conditionEngine.ts`, `InjuryAlertModal.tsx`, `FastSimModal.tsx`(주전 부상 시 고속진행 자동 일시정지), `otherLeaguesEngine.ts`·`cupEngine.ts`·`uclEngine.ts`·`GameContext.tsx` 전 세계 5대 리그 96구단 + 36팀 UCL 동일 적용 및 AI 부상 대체, `OpponentPitchView.tsx`·`ClubSquadModal.tsx` 실시간 부상 반영
  - **팀/포지션 라인/선수 단위 사기(Morale) & 72종 기자회견·라커룸 연설**: `src/data/managerEventsPress.ts`(36종), `src/data/managerEventsLocker.ts`(36종), `src/data/managerEvents.ts`(동일 시즌 중복 방지 큐·쿨다운·동적 변수 치환·전 이벤트 100% 리스크/사기 하락 분기), `ManagerEventModal.tsx`, 자연 냉각 및 단독 불꽃 우선 게이트, 도트 SVG 상태 아이콘 3종(`PixelStatusIcon.tsx`: 부상 빨간 십자가 / 사기 최상 불꽃 / 사기 최악 얼음)
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
│   │   ├── formations.ts          # 9종 포메이션 좌표·alternateSubPositions·케미 링크 + 벤치 5슬롯
│   │   ├── aiManagers.ts          # 5대 리그 96구단 + UCL 16구단 AI 감독(OVR·스타일·선호 포메이션/전술)
│   │   ├── formerClubs.ts         # 공식 1군 커리어 검증 기반 전 소속팀 이력(레전드 33명 + 주요 현역 ~170명)
│   │   ├── managerTraits.ts       # 14종 감독 강점 정의 & 감독 OVR 기반 개인 궁합(+1~+2)
│   │   ├── playstyles.ts          # 14종 플레이스타일 및 스타일 시너지 쌍
│   │   ├── achievements.ts        # 24종 히든 도전과제 (힌트/해금 제목/역사적 모티브/조건)
│   │   ├── historicalTeams.ts     # 역대 최강 14팀 벤치마크 데이터 (17인 풀스쿼드·명장 OVR 91~99)
│   │   └── patchNotes.ts          # 인게임 패치노트 데이터 (v1.0 ~ v5.0)
│   ├── engine/
│   │   ├── dataLoader.ts          # JSON 로더, formerClubs/AI 감독 하이드레이션, AI 16인 로스터 생성
│   │   ├── positionEngine.ts      # 복수 주포지션/부포지션/alternateSubPositions 적합도 & 실효 OVR 계산
│   │   ├── chemistryEngine.ts     # 엄격 4원칙 선수 시너지(구단·전소속35/국적20/스타일30/엘리트88+15) & 감독 궁합 독립 분리
│   │   ├── unifiedTacticsEngine.ts # 2단계 통합 전술 수싸움(내부 완성도→5구역 대결) & AI 감독 OVR별 하프타임 카운터
│   │   ├── tacticEngine.ts        # 5종 전술/9종 포메이션 메타 & 수석코치 현실적 하프타임 조언
│   │   ├── staminaEngine.ts       # 인게임 체력 소모(0'~120'), 피로 패널티, 60'~82' 자동 교체 계획
│   │   ├── draftEngine.ts         # 3구단 멀티 후보 드래프트 룰렛 (OVR 상위 3명 결정적 노출 + 레전드 독립 확률)
│   │   ├── lineupOptimizer.ts     # 포메이션 변경 시 스마트 재배치 & 자동 최적 베스트 11
│   │   ├── scheduleEngine.ts      # Fisher-Yates 랜덤 셔플 더블 라운드 로빈 일정 생성
│   │   ├── matchEngine.ts         # 포아송 xG 경기 엔진, 통합 전술/AI 감독 하프타임 수싸움, 14종 공격 루트, 연장/PK
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
│   └── __tests__/                 # 23개 유닛/통합 테스트 (총 91개 테스트)
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
