# Road To Treble — PROJECT HANDOFF GUIDE (v10.1.3)

> Claude Code 세션은 루트 `CLAUDE.md`(세션 시작 절차·불문율·워크플로우)를 먼저 따릅니다.

이 문서는 GitHub 저장소(`darksuri82/roadtotreble`)가 연결된 **Antigravity 프로젝트 대화창**에서 다음 에이전트가 별도의 탐색 없이 즉시 개발·배포를 이어갈 수 있도록 프로젝트의 전체 아키텍처, 구현 명세, 핵심 밸런스 수식, 데이터 구조, 그리고 Phase 3 예정 작업을 정리한 인수인계 문서입니다.

---

## 1. 기술 스택 및 실행 환경

- **Framework**: React 19 + TypeScript (strict) + Vite 8.3.8 (Rolldown)
- **Realtime Backend**: Supabase (`@supabase/supabase-js` — Postgres `mp_rooms` / `mp_room_players` / `global_hof_rankings` + KST 주간 순환 일일 랭킹 `prune_global_daily_rankings()` · 원자적 `submit_global_hof_ranking` RPC + Realtime Postgres Changes + Broadcast Fast Sync + Presence, `supabase/schema.sql`)
- **Styling**: Tailwind CSS v4 (`@tailwindcss/vite`) — 미니멀 다크 스포츠 대시보드 테마 (`#090d13`, `#0d131c`, `#0e141d`, `#111822`, 차분한 슬레이트 UI 크롬 + `@layer components` 기반 시대별 클래식 `60s`~`10s`/슈퍼스타/월클 카드 글로우 & 절제된 붉은 불꽃 각성 글로우 & 선명한 4색 피치 시너지선)
- **Icons**: `lucide-react` + 커스텀 도트 SVG (`RoadToTrebleHeroSvg.tsx`, `StoryPixelSceneSvg.tsx`, `PixelTrophySvg.tsx`, `PixelManagerAvatar.tsx`, `PixelStatusIcon.tsx`, `PixelEventSceneBanner.tsx`, `PenaltyShootoutVisual.tsx`, `FfpOpeningNoticeModal.tsx`) + 105개국 인라인 SVG 국기 (`CountryFlagSvg.tsx`)
- **Testing & Lint**: Vitest (`npm run test` — **62개 파일**, `balanceVerification.test.ts` 등 일부 난수 기반 테스트는 간헐 실패 시 단독 재실행 검증), `oxlint` (`npm run lint` — 0 errors)
- **Build**: `npm run build` (`tsc -b && vite build` — `base: './'` 설정으로 GitHub Pages 서브경로 및 루트 배포 모두 호환, `.github/workflows/deploy.yml`에서 `VITE_SUPABASE_URL`·`VITE_SUPABASE_ANON_KEY` Secret 주입)
- **라이브 URL**: `https://darksuri82.github.io/roadtotreble/` (`.github/workflows/deploy.yml` 자동 배포 활성화 완료)
- **롤백 세이브포인트 태그**: `stable-before-v5-tactics` (`v4.1` `a77f6a4`), `stable-before-v5-polish` (`v5.0.2` `4eb1f74`), `stable-before-mobile-compact` (`v5.1` `17be061`), `stable-before-v6-hof-roster` (`v5.2` `9af2760`), `stable-before-v6-balance-ux` (`v6.1` `8133925`), `stable-before-v6-color-polish` (`v6.2-core` `c0717dd`), `stable-before-v7-multi-1v1` (`v6.2.1` `88bb954`), `stable-before-v6-bugfix-mp` (`v7.1` `c5b9540`), `stable-before-v8.2-mp-polish` (`v8.1` `68620bf`), `stable-before-v8.3-ui-bench` (`v8.2` `3d5f660`), `stable-before-v8.4-live-skip` (`v8.3` `600c7da`), `stable-before-mp-sync-ucl` (`v8.4.2` `9f6e976`), `stable-before-mp-draft-bugfix` (`v8.5.4` `559bef7`), `stable-before-ucl-ready-transfer` (`v8.6` `82e0362`), `stable-before-guide-tutorial-ux` (`v8.9` `79344e7`), `stable-before-realistic-2d-sim` (`v8.10.1` `c5002db`), `stable-before-global-top15-ranking` (`v8.11` `ad739de`), `stable-before-2d-sim-bugfix` (`v8.12` `6775465`), `stable-before-sim-ucl-roulette-fix` (`v8.12.1` `d17c66a`), `stable-before-manager-fit-ui` (`v8.13` `642f444`), `stable-before-ai-balance-tuning` (`v8.14.2` `403067b`), `stable-before-ucl-unified-autosim` (`v8.15` `c756c15`), `stable-before-transfer-squad-sim-fix` (`v8.17` `53828eb`), `stable-before-season-depth-v2` (`v8.18` `679b150`), `stable-before-v9-polish` (`v9.0` `e833400`), `stable-before-v9-balance-tune` (`v9.1` `9b8d0c1`), `stable-before-v9.2.3-awards-ffp-transfer` (`v9.2.2` `14b92b6`), `stable-before-era-classics` (`v9.2.5`), `stable-before-v94-rebalance` (`v9.3.1` `23dbe00`), `stable-before-v9-fix-daily-rank` (`v9.4.0` `f461f08`), `stable-before-v96` (`v9.5.0` `a19535d`), `stable-before-v96-trade-story-awakening` (`v9.6.0` `ea7cfee`), `stable-before-mp-league-polish` (`v9.7.2` `48421b6`), `stable-before-title-redesign` (`v9.8.0` `eaac00f`), `stable-before-v910-balance` (`v9.9.2` `8feef03`), `stable-before-story-mode` (`v9.10.0` `d282977`), `stable-before-v1001-story-era-fix` (`v10.0.0` `b5bbe67`), `stable-before-v1010-story-expansion` (`v10.0.1` `061d1f1`), `stable-before-v1011-story-roulette-fix` (`v10.1.0` `241767c`), `stable-before-v1012-rival-plus1-mission-keys` (`v10.1.1` `6a293ac`), `stable-before-v1013-synergy-awakening-dream` (`v10.1.2` `3e4388a`)
- **필수 운영 규칙 (패치노트 · 첫 화면 업데이트 팝업 동기화)**: 기능 추가·밸런스 조정·버그 수정 등 **모든 수정 배포 시 기존 버전을 덮어쓰지 말고 반드시 새 버전(`vX.Y` 또는 `vX.Y.Z`)으로 `src/data/patchNotes.ts`(`CURRENT_APP_VERSION` + `PATCH_NOTES` 최상단), `CHANGELOG.md`, `PROJECT_HANDOFF.md`, 및 첫 화면 업데이트 안내 팝업(`src/components/common/WhatsNewModal.tsx` 콘텐츠 + `CURRENT_APP_VERSION` 키)을 함께 갱신**할 것.
- **UI 미니멀리즘 원칙**: 게임 플레이 화면에 장황한 AI식 설명 문구·홍보 배너·"새 기능!" 잡다한 텍스트를 배치하지 않고, 간결한 아이콘·수치로만 표현하며 상세 설명은 기존 가이드/전술 도감 모달 및 클릭형 `?` 팝오버(`InfoHelpButton.tsx`, `UnifiedTacticsStrip.tsx`, `ManagerFitBadge.tsx`) 내부에만 수록.
- **v10.1.3 결산·드림매치 선수 카드 시너지/실효 OVR 1:1 정합화 & 리그 MVP급 시즌 포텐 각성 밸런스 보정 (`SeasonSummary.tsx`, `StorySetupScreen.tsx`, `OpponentPitchView.tsx`, `MatchDayTacticsRoom.tsx`, `DreamMatchArena.tsx`, `LegacyHubModal.tsx`, `SeasonDashboard.tsx`, `UclDashboard.tsx`, `PlayerDetailModal.tsx`, `awakeningEngine.ts`, `GameContext.tsx`, `WhatsNewModal.tsx`, `patchNotes.ts`, `v1013SynergyAwakeningDreamMatch.test.ts`)**: `SeasonSummary`·`StorySetupScreen` `PlayerDetailModal` `slotSynergy` 누락 수정, `OpponentPitchView`를 유저 `PitchBoard` 동일 **`기본 OVR + 녹색 +시너지`** 표기로 통일하고 상대/명전/드림 매치 카드 클릭 시 실제 `slotSynergy`·`slotSubPosition`·상대 `managerTraitId`/`managerRating` 전달 및 `ignoreSeasonCondition` 격리 적용. `awakeningEngine.ts`에 88 미만 현역 장기 엘리트/MVP급 시즌 각성 가속 구간(`maxProb 9.5%~22%`, 연속 선발 감쇠 면제, 팀 각성 감쇠 하한 보정) 및 `GameContext.tsx` 리그+컵+UCL 통합 스탯 연동·`SKIP_UCL_TO_FINAL_SUMMARY` 각성 판정 보강.
- **v10.1.2 맨유·아스널 라이벌 보정 +1 완화 & `★ 미션` 핵심 선수 1:1 정합화 (`0708_manutd.json`, `0304_arsenal.json`, `1314_atletico.json`, `GameContext.tsx`, `WhatsNewModal.tsx`, `patchNotes.ts`, `v1010StoryExpansionAndFixes.test.ts`)**: `0708_manutd`·`0304_arsenal` 라이벌 보정을 원년 대비 `+1`(≤92)로 완화. 개별 선수 미션이 없는 `0304_arsenal`·`1314_atletico`의 `missionKeyPlayerIds`를 `[]`로 정리(세이브 자동 반영)해 실제 ★★★ 별 조건에 직결된 5종 핵심 선수만 `★ 미션` 및 방출 경고를 표기하도록 정합화.
- **v10.1.1 스토리 모드 인테르·레버쿠젠 경기 스킵 크래시 수정 & 7종 통합 시대 룰렛 이적시장 개편 (`0910_inter.json`, `2324_leverkusen.json`, `1314_atletico.json`, `matchEngine.ts`, `storyModeEngine.ts`, `transferEngine.ts`, `GameContext.tsx`, `TransferMarketModal.tsx`, `storyRegistry.ts`, `storyMode.ts`, `WhatsNewModal.tsx`, `SystemGuideModal.tsx`, `patchNotes.ts`, `v1010StoryExpansionAndFixes.test.ts`)**: `park_the_bus` 비표준 전술 키 14건 `counter` 교정 + `sanitizeStoryTacticId`/`matchEngine` 안전장치/`loadSavedStoryGameState` 자동 자가 치유 + `1314_atletico` `lev_1314`→`b04_1314` 충돌 분리. 7종 스토리 모드 전체를 싱글플레이 동일 **시즌 3회(10·19·28R / 9·17·25R) + UCL 직전 1회(총 4회) · 창당 3회 협상 · 그 시절 5대 리그 풀 전용 3구단 룰렛(`spinTransferClubs({ storyTransferPool })`, 클래식 FA 0%)**으로 통일.
- **v10.1.0 스토리 모드 7종 확장(23-24 레버쿠젠 · 09-10 인테르) · 2단계 밸런스 개편 · 박지성 월베 ★3 & 3대 버그 수정 (`2324_leverkusen.json`, `0910_inter.json`, `0708_manutd.json`, `0304_arsenal.json`, `storyRegistry.ts`, `storyMode.ts`, `storyModeEngine.ts`, `StoryPixelSceneSvg.tsx`, `StorySetupScreen.tsx`, `PitchBoard.tsx`, `TransferMarketModal.tsx`, `GameContext.tsx`, `WhatsNewModal.tsx`, `SystemGuideModal.tsx`, `patchNotes.ts`, `v1010StoryExpansionAndFixes.test.ts`)**: `2324_leverkusen`(18팀 34R 분데스리가 `[99,17,99]` · DFB-포칼 · `€50M` · 4회 협상) 및 `0910_inter`(20팀 38R 세리에 A `[99,19,99]` + 실제 09-10 UCL 16강 · 코파 이탈리아 · `€60M` · 4회 협상) 추가(총 7종 · 최대 21★). 레스터·토트넘·아틀레티코 난이도는 보존하되 언더독 5팀 4회 협상·예산 상향, 맨유(`€45M` 창당 1명)·아스널(`€25M` 겨울 19R 단 1회 · `allowUclTransferWindow: false`) 라이벌 상향(+2~+3, ≤92) 및 보강 제한 적용. `0708_manutd` ★3을 `globalAwards.worldBestXi` 박지성 월베 선정으로 개편하고 `PitchBoard` `missionHighlightPlayerIds`(`★ 미션`) 분리·스토리 모드 중 레거시 도전과제 24종 차단·이적시장 중복 룰렛 버튼 제거/동적 벤치 인원 표기 수정.
- **v10.0.1 스토리 모드 100% 시대 로스터 격리 & 이적시장 시즌 1회(19R) + UCL 16강 직전 1회 개편 (`dataLoader.ts`, `transferEngine.ts`, `uclEngine.ts`, `playerLookup.ts`, `GameContext.tsx`, `TransferMarketModal.tsx`, `SeasonDashboard.tsx`, `FastSimModal.tsx`, `LiveMatchBroadcast.tsx`, `storyRegistry.ts`, `storyMode.ts`, `WhatsNewModal.tsx`, `SystemGuideModal.tsx`, `patchNotes.ts`, `v1001StoryEraRosterAndWindows.test.ts`)**: `isStoryEraClubId`/`isStoryEraPlayerId` + `strictRosterOnly`로 `buildAiClubSquad16`·`pickReplacementForAiClub`·`sanitizeAiClubRoster`·`generateIncomingTradeOffers`·`handleStartCounterOffer`·`resolveClubRoster` 전역에서 26-27 `ACTIVE_PLAYERS` 병합 및 가상 선수 생성을 원천 차단. 5종 시나리오 모두 리그 중 1회(19R `[99,19,99]`) + UCL 진출 시 16강 직전 1회(`special_transfer` → `r16`)로 개편하고 `getNextTransferWindowRound`/진행 바 센티넬 필터 및 기존 v10.0.0 세이브 자동 마이그레이션/정화 추가.
- **v10.0.0 대형 신규 콘텐츠 「스토리 모드 (History Story Mode)」 5종 출시 (`types/storyMode.ts`, `data/story/storyRegistry.ts`, `data/story/scenarios/*.json`, `engine/storyModeEngine.ts`, `engine/uclEngine.ts`, `engine/awakeningEngine.ts`, `engine/transferEngine.ts`, `services/globalRankingService.ts`, `store/GameContext.tsx`, `components/story/*`, `components/transfer/TransferMarketModal.tsx`, `components/setup/TitleScreen.tsx`, `WhatsNewModal.tsx`, `SystemGuideModal.tsx`, `patchNotes.ts`, `storyModePhase1.test.ts`, `storyModePhase2.test.ts`)**:
  - **5종 역사 시나리오 동적 청크(`19~21 kB gzip`, 총 200구단 2,844명, OVR≤92)**: `1516_leicester`(€25M · 3차 · FA컵), `0708_manutd`(€100M · 3차 · 07-08 UCL 16강 · 박지성 에이스 프로젝트), `1819_tottenham`(€55M · 3차 · 18-19 UCL 16강 · DESK 공격P 60+), `0304_arsenal`(€30M · 겨울 19R 1회·최대 1명 `[99,19,99]` · 03-04 UCL 16강 · 38경기 무패), `1314_atletico`(€45M · 3차 · 13-14 UCL 16강 · 최소 실점 ≤28).
  - **핵심 규칙 & 연출**: 탭형 도트 문학 프롤로그(`StoryPixelSceneSvg` + `StoryIntroModal`), `[빠른 선발]` 전면 제거(`AUTO_OPTIMIZE_LINEUP` 차단), 방안 B 5대 리그 35개 구단 직접 지목 현금 협상 이적시장, `createStoryUclR16State()` 16강 직행 토너먼트, `storyFocusPlayerIds` 각성 공명, 전용 세이브(`rtt_story_mode_active_save_v1`)·별 도감(`rtt_story_mode_codex_v1`) 분리 및 `global_hof_rankings` 제출 원천 차단(`story_mode`).
- **v9.10.0 난이도 상승 밸런스 패치 (`budgetEngine.ts`, `draftEngine.ts`, `transferEngine.ts`, `SystemGuideModal.tsx`, `WhatsNewModal.tsx`, `patchNotes.ts`, `v910BalanceTune.test.ts`)**: 드래프트 예산 소프트 캡 `€950M → €900M`(이월 현금 100% 상한 없음 유지), 빅클럽 12팀(`(att+mid+def)/3 >= 81`) 룰렛 버킷 내 균등 랜덤 추출(표시 3장은 OVR 내림차순 정렬 유지 · 중하위권 84팀은 OVR 상위순 유지 · 싱글/멀티 공용), 시대별 클래식 FA 성사율 하향(기본 `21~26%`, 클램프 `15~30%` / 우승 `34%`, 현금 가산 `€10M당 +1.2%p` 최대 `+12%p`), 일반 이적·경기 엔진 현행 유지 및 첫 화면 `WhatsNewModal` 「난이도 상승!」 탭 추가.
- **v9.9.2 일일 랭킹 핫픽스 (`supabase/schema.sql`, `SeasonSummary.tsx`, `patchNotes.ts`, `WhatsNewModal.tsx`)**: `submit_global_hof_ranking` RPC의 `season_score` 상한을 `15000→30000`으로 교정해 15,000+ 트레블 시즌 제출 허용, `SeasonSummary` 결산 일일 랭킹 바가 실패 응답(`ok: false, totalCount: 0`)으로 `오늘 0/10팀 등재 중`을 오표시하던 버그 수정.
- **v9.9.1 첫 화면 타이틀·도트 일러스트 5대 비주얼 폴리싱 (`index.css`, `TitleScreen.tsx`, `RoadToTrebleHeroSvg.tsx`, `WhatsNewModal.tsx`, `patchNotes.ts`)**: `ROAD TO TREBLE` `filter: drop-shadow` 시인성 교정, `입문 튜토리얼` 우상단 테두리 버튼 분리, 출발선 1px 윤곽 팀 컬러/패턴 깃발 강화, 감독 커스텀 바 톤(`#141f30`) 분리, UCL 빅이어 정상 원형 천정광·수렴형 투광등·기념 기둥·3단 황금 단상·`1.38x` 빅이어 고도화.
- **v9.9.0 첫 화면 고급 도트 리디자인 · 감독/구단 커스텀 첫 화면 분리 및 빠른 시작 플로우 (`RoadToTrebleHeroSvg.tsx`, `PixelManagerAvatar.tsx`, `TitleScreen.tsx`, `index.css`, `clubPresets.ts`, `ProfileCustomizerModal.tsx`, `MpProfileCustomizerModal.tsx`, `ActiveProfileChip.tsx`, `FormationSelect.tsx`, `ManagerRouletteScreen.tsx`, `LeagueSelect.tsx`, `HeaderNav.tsx`, `GameContext.tsx`, `WhatsNewModal.tsx`, `patchNotes.ts`, `v99TitleRedesignAndQuickStart.test.ts`)**:
  - **280×108 고밀도 도트 히어로 & 실시간 커스텀 감독 연동**: `getManagerAvatarRects()` 공용 빌더로 출발선 감독·구단 깃발이 유저 커스텀 외형/색상을 실시간 반영, 디더링 야간 하늘·2층 관중석·4대 투광등 스포트라이트·잔디 스트라이프 디더링·3D 트로피 받침대·정상 빅이어 & 고트(GOAT) 절제된 픽셀 반짝임 적용.
  - **첫 화면 슬림 1줄 프로필 바(`h-[50px]`) & 영구 저장**: `ProfileCustomizerModal`(`MpProfileCustomizerModal` 통합 재사용)로 감독 외형·이름·구단명·유니폼·6프리셋을 일괄 커스텀하고 `ACTIVE_PROFILE_STORAGE_KEY`(`rtt_active_user_profile_v1`)에 영구 저장(기존 프리셋 자동 마이그레이션·싱글/멀티 자동 동기화·최초 방문 기본값 자동 세팅).
  - **새 시즌 빠른 시작 플로우**: `START_NEW_CAREER`/`RESET_GAME` 프로필 유지 보강, `FormationSelect`·`ManagerRouletteScreen` 중복 구단/외형 입력 제거 → 바로 `드래프트 풀·포메이션·전술` → `감독 특성 선택` 진입, 전 설정 단계 상단 `ActiveProfileChip`으로 언제든 모달 수정 가능.
- **v9.8.0 멀티리그 5대 정비 · 방장/참가자 전수 점검 & 싱글 UI/기능 통일 (`types/mpLeague.ts`, `mpLeagueDraft.ts`, `mpLeagueEngine.ts`, `mpLeagueScore.ts`, `mpLeagueH2H.ts`, `useMpLeagueHost.ts`, `MpLeagueRoot.tsx`, `MpLeagueDraftBoard.tsx`, `MpLeagueDashboard.tsx`, `MpUclMatchPreviewModal.tsx`, `MpLeagueSquadEditor.tsx`, `MpLeagueTransferModal.tsx`, `MpLeagueH2HView.tsx`, `MpLeagueSeasonSummary.tsx`, `MpLeagueFinalBoard.tsx`, `WhatsNewModal.tsx`, `patchNotes.ts`, `v98MpLeaguePolish.test.ts`)**:
  - **드래프트 `[빠른 선발]` & 중복 픽 차단**: `buildQuickLineupOverrides`(싱글 `optimizeBestLineup` 재사용, `mp_league_picks` 무변형) + `submittingRef`/`submittedTurnKeyRef` 중복 픽 가드 + 0ms `player_signal` + v9.4 룰렛 프리뷰(`포텐↑`/`육성`, `🔗 N선`) 통일.
  - **시즌 결산 각성 누락 수정 & 1회 노출 가드**: `hydrateMpSquadWithAwakenings`를 호스트(`summary.squads`/`final.squads`/`computeMpHumanSeasonScore`) 및 클라이언트(`mySquad`/`publicSquads`/`MpLeagueSeasonSummary`/`MpLeagueFinalBoard`) 전역 적용, `buildMpAwakeningSeenKey` + `hasMpPopupBeenSeen` + `dismissMpLeagueAwakeningAlert(state, clubId, playerId)` 지정 멱등 제거로 중복 팝업 원천 차단.
  - **UCL 토너먼트 프리뷰 실시간 전술 수정 & 호스트 동기화**: `MpUclMatchPreviewModal`에 10종 포메이션(`3-2-4-1` 포함)·5대 전술·`[빠른 선발]`·공용 `PitchBoard`·`StaffCoachBadge`·전술 노출도·`TacticsGuideModal` 통합, `tactics_update` 액션 + `league_payload` 이중 저장 및 호스트 `consent` 직전 강제 플러시(`handleActions(..., true)`).
  - **단일 순차 팝업 큐 & v9.x 기능 동기화**: `MpLeagueDashboard` `activeOverlayModal` 단일 큐로 모달 중첩 차단, FFP 케미 페널티 오적용 버그 교정(`mine.budget.chemPenalty`), H2H/에디터/이적시장 수석 코치·FFP·전술 노출도·각성 반영, 결산 테이블 시대 클래식/각성 배지 및 `h2hSummary` 팀 스토리 연동.
- **v9.7.2 이적시장 가상 교체 프리뷰 양쪽 선수 직접 선택 시에만 발동 (`TransferMarketModal.tsx`, `MpLeagueTransferModal.tsx`, `chemistryEngine.ts`, `patchNotes.ts`, `WhatsNewModal.tsx`)**: 우리 팀 선수만 클릭했을 때 `autoFillerPlayers`로 시스템 임의 선수와 교체되던 문제 해결 — 양쪽 팀에서 직접 클릭한 선수만 프리뷰 교체 대상에 포함하고, 2:1 비대칭 선택 시 최적 선발 슬롯 자동 매칭.
- **v9.7.1 이적시장 가상 교체(스왑) 프리뷰 양방향 반영 (`TransferMarketModal.tsx`, `MpLeagueTransferModal.tsx`, `patchNotes.ts`, `WhatsNewModal.tsx`)**: 싱글·멀티리그 피치 뷰(선발·벤치) 및 리스트 뷰 양쪽 모두에서 내가 보내는 선수가 상대 팀 슬롯에, 상대 선수가 내 팀 슬롯에 서로 교체 표시(`↔ 원소속 선수` 배지 · `가상 교체 중` 칩 · 클릭 시 선택 해제 · `[원본 스쿼드 보기]` 동시 토글 · 클래식 FA `↔ FA 방출` 배지).
- **v9.7.0 이적시장 가상 교체(스왑) 시너지 프리뷰 → 제안 확정 · 팀 소개 9종 정체성 다각화 · 팀 스토리 부진/위기→반등 다큐 회고 · 포텐 각성 100시즌 실측 진단 & 저발동 병목 해소 (`chemistryEngine.ts`, `PitchBoard.tsx`, `TradeSwapPreviewCard.tsx`, `TransferMarketModal.tsx`, `MpLeagueTransferModal.tsx`, `types/game.ts`, `types/legacy.ts`, `teamStoryEngine.ts`, `TeamStoryTab.tsx`, `GameContext.tsx`, `SeasonSummary.tsx`, `awakeningEngine.ts`, `SystemGuideModal.tsx`, `SoloVisualTutorialModal.tsx`, `WhatsNewModal.tsx`, `patchNotes.ts`, `v97TradePreviewStoryAwakening.test.ts`)**:
  - **이적시장 가상 교체 프리뷰 → 제안 확정**: `computeTradeSwapPreview` + `TradeSwapPreviewCard` + `PitchBoard(previewSlotKeys)`로 내 선수·상대/클래식 선수 선택 시 피치 임시 교체 투입 및 연결선·팀 케미·감독 궁합·포지션 적합도·A/M/D·실효 OVR·현금 잔액 Before → After Δ 실시간 비교 후 `제안 확정` 클릭 시에만 요청 실행(싱글 일반/클래식 FA/수신 제안 · 멀티리그 공통).
  - **팀 소개 9종 정체성 다각화**: 에이스 1인 반복 탈피 — 공격 듀오/중원 축/수비 라인/3인 척추 트리오, 선수명 없는 감독·전술·코치·케미·로테이션 정체성, 언더독 반란, 포텐 각성 군단, 신구 조화, FFP 돌파, 짠물 수비/화력 축구 분기 구축.
  - **팀 스토리 부진·위기→반등 다큐 회고**: 연패·무승 슬럼프, 대패/역전패, 핵심 부상(`storyCrisisLog`), 전술 파훼 위기, 중반 순위 추락, 컵·UCL 조기 탈락/준우승을 자동 추출해 `slump`/`setback` 카드로 시각화하고 코치·이적·전술 변주·각성을 통한 반등(또는 벽)으로 기승전결 연결.
  - **포텐 각성 100시즌 실측 진단 & 밸런스 보정**: `consecutiveMatchesPlayed` 과감쇠 병목·`SIMULATE_UCL_TO_END` 호출 누락·`chemForAwakening` 슬롯 인덱스 누락·`neighborBonus === 1` 공명 제외·GK/DF 비공격포인트 과감점을 해소하고 OVR 구간 배율(`≤76 ×2.30 / 77~79 ×2.00 / 80~81 ×1.65 / 82~84 ×1.40 / 85~87 ×0.78 / 88+ ×0.04`)·평점 기준(`6.75~7.4+`)·육성 코치 1~3명째 한정 가속을 보정(고활용 `1.58→2.30명/시즌`, 저활용 `0%`, 클래식 `0%`, 88+ 인플레 억제 유지).
- **v9.6.0 명전 날짜 표기·과거 기록 일일 랭킹 제출 차단 · 5대 리그 전체 풀 공정성 기준 · 시기별 팀 스토리텔링 & 칼럼형 팀 소개 · 저OVR 활약·각성 밸런스 개편 (`types/legacy.ts`, `legacyEngine.ts`, `globalRankingService.ts`, `supabase/schema.sql`, `FormationSelect.tsx`, `GameContext.tsx`, `SeasonSummary.tsx`, `LegacyHubModal.tsx`, `teamStoryEngine.ts`, `TeamStoryTab.tsx`, `chemistryEngine.ts`, `matchEngine.ts`, `awakeningEngine.ts`, `SystemGuideModal.tsx`, `SoloVisualTutorialModal.tsx`, `WhatsNewModal.tsx`, `patchNotes.ts`, `v96RankingStoryPoolAwakening.test.ts`)**:
  - **일일 랭킹 날짜 검증 & 명전 날짜 표기/정리**: `loadLegacyState()`에서 `completedAt` 누락·파싱 불가 기록 자동 삭제, `LegacyHubModal`에 KST 완료 날짜(`YYYY.MM.DD` + `오늘`) 표기, `validateDailyRankingEligibility()`·`groupWeeklyDailyRankings()`·`submit_global_hof_ranking` RPC에서 과거 기록 제출·노출 원천 차단(과거 1등 단건 삭제 SQL 포함).
  - **5대 리그 전체 드래프트 풀 공정성 규칙**: `FormationSelect`에서 5대 리그 체크 해제 시 하단 빨간 경고 즉시 노출, 개인 명전 저장은 허용하되 `isFullFiveLeagueDraftPool` 미충족 시즌은 일일 랭킹 자동·수동 제출 및 서버 RPC에서 차단.
  - **시기별 스토리텔링 연대기 & 칼럼형 팀 소개**: 한국어 조사 자동 보정(`josa`) 기반 스포츠 칼럼 문체 팀 소개(`TeamIntroBanner` 말줄임 해제) + 개막~에필로그 주요 사건을 시기별 한 문장씩 연결한 연대기 타임라인으로 전면 개편.
  - **저OVR 원석 경기 활약·각성 밸런스 개편**: `applySlotSynergiesToStarters` 세부능력치(`attrs`/GK)·육성 코치 반영, 경기 이벤트·`buildPlayerRatings` 개별 시너지/감독 궁합/저OVR 완만 바닥선 적용, `awakeningEngine.ts` 저OVR 구간(`≤76 ×2.10` · `77~79 ×1.85` · `80~81 ×1.55`)·상대 평점 기준(`6.8~7.1+`)·육성 공명 보너스(`×1.10~×1.24`) 도입.
- **v9.5.0 세부능력치 현실화 전수 보정 · KST 주간 일일 랭킹(TOP 10/TOP 3) · 팀 스토리 & 1~2줄 소개 · 라이브 리트라이/자동진행/이적시장 수정 · FFP -12% & 역사 팀 OVR 현실화 · 첫 화면 업데이트 팝업 (`attributeEngine.ts`, `attributeOverrides.ts`, `legendPlayers.json`, `activePlayers.json`, `GameContext.tsx`, `UclDashboard.tsx`, `SoloLiveScoreboard.tsx`, `UclMulticastPopupBoard.tsx`, `SeasonDashboard.tsx`, `UclLeaguePhaseFastSimModal.tsx`, `index.css`, `PitchBoard.tsx`, `TransferMarketModal.tsx`, `budgetEngine.ts`, `legacyEngine.ts`, `globalRankingService.ts`, `supabase/schema.sql`, `LegacyHubModal.tsx`, `GlobalTop15CelebrationModal.tsx`, `DreamMatchArena.tsx`, `historicalSquadsData.ts`, `historicalTeams.ts`, `teamStoryEngine.ts`, `TeamStoryTab.tsx`, `TeamSeasonArchiveTab.tsx`, `SeasonSummary.tsx`, `WhatsNewModal.tsx`, `TitleScreen.tsx`, `SoloVisualTutorialModal.tsx`, `SystemGuideModal.tsx`, `CLAUDE.md`, `v95FixesDailyRankStoryWhatsNew.test.ts`)**:
  - **세부능력치 현실화 전수 보정**: 플레이스타일별 포지션 가중치(`getPositionWeights`) 세분화 + `CURATED_CLASSIC_BY_NAME` 폴백 보강 + 클래식 84명·현역 239명 재보정(`10s 부스케츠` PHY 76 · PAS 97 vs `10s 판 다이크` PHY 95 · AER 96, `00s 피를로` PHY 72 vs `00s 드로그바/비에이라` PHY 97, 현역 `페드리` PHY 76 vs `라이스` PHY 94).
  - **라이브 중계 리트라이 차단 · 자동진행 하단 잠금 · 이적시장 클래식 클릭 수정**: `CANCEL_SOLO_STREAM_MATCH` 즉시 확정 + `ABORT_STREAM_AND_START_LIVE_2D` 진행 스코어·이벤트 인계 + `loadSavedGameState` 진행 중 경기(`liveHalftime`) 자동 확정, 리그/UCL 자동진행 중 하단 프리뷰 `pointer-events-none`/disabled 잠금, `@layer components` 정리 + `PitchBoard` 아웃라인/`✓` 선택 배지 + 클래식 FA 하단 고정 바 신설.
  - **FFP 2단계 -20%→-12% & 역사 팀 24팀 OVR 소폭 현실화**: `FFP_TIER2_SCORE_MULTIPLIER = 0.88`(-12%) 전역 동기화, 역사 팀 279명 과대평가 OVR 소폭 현실화(`10-11 바르사 90.9→89.5`, `14-15 바르사 90.6→89.3`, `22-23 맨시티 89.8→87.8`, `24-25 PSG 89.6→88.5`) + `eraPrestigeLift` 완화(`1.4+0.7 → 0.9+0.5`).
  - **KST 주간 일일 랭킹 & 팀 소개(1~2줄)·팀 스토리 탭 & 첫 화면 `WhatsNewModal`**: 당일 TOP 10 / 지난 날짜 TOP 3 아카이브 / 매주 월요일 00:00(KST) 주간 초기화 + 날짜 탭 UI + `supabase/schema.sql` 갱신, `teamStoryEngine.ts`/`TeamStoryTab.tsx`로 결산·일일 랭킹·명전에 팀 소개 및 경기 기반 팀 스토리 직렬화, 첫 페이지 `WhatsNewModal`(`v9.3.0~v9.5.0` 4탭 인게임 프리뷰 + 버전 키 기반 `다시 보지 않기`) 신설 및 `CLAUDE.md` 규칙 명문화.
- **v9.4.0 신규 3-2-4-1 포메이션 · 드래프트 프리뷰 연동 포텐 표시 · 각성 즉시 발동 · 전술 파훼/AI 실효 전력 상향 · 26-27 선수단 67명 정밀 재조정 (`RouletteReelsView.tsx`, `DraftScreen.tsx`, `awakeningEngine.ts`, `game.ts`, `formations.ts`, `tacticEngine.ts`, `unifiedTacticsEngine.ts`, `pitchTacticalParams.ts`, `tacticalMovement.ts`, `aiManagers.ts`, `FormationSelect.tsx`, `App.tsx`, `GameContext.tsx`, `SeasonDashboard.tsx`, `UclDashboard.tsx`, `TeamSeasonArchiveTab.tsx`, `tacticalAdaptationEngine.ts`, `matchEngine.ts`, `activePlayers.json`, `leagues.json`, `attributeEngine.ts`, `SystemGuideModal.tsx`, `SoloVisualTutorialModal.tsx`, `v94RebalanceAndUx.test.ts`)**:
  - **드래프트 프리뷰 연동 포텐/육성 & 각성 원리 가시성**: 미선택 카드 사전 스포일러 제거, 클릭·프리뷰 스왑 시 실제 선발 슬롯 기준으로만 `포텐↑`/`육성` 동적 판정(벤치 미표시), 드래프트 상단 `? 각성` 팝오버 및 가이드북·튜토리얼 원리 명시.
  - **10번째 포메이션 `3-2-4-1` (박스 미드필드)**: `3 CB + 2 CDM + LW·2 CAM·RW + ST` 11슬롯·21연결선·10×10 대칭 상성·통합 5구역·2D 움직임·빅클럽 AI 감독 선호 포메이션 전면 연동.
  - **각성 팝업 즉시 노출 & 내 팀 결산 총/실효 OVR**: `App.tsx` 각성 최우선 승격(`season_end`·이적시장 포함) + `START_SOLO_STREAM_MATCH` 가드 + `commitLiveMatch` 동기 해제 + `SIMULATE_TO_NEXT_TRANSFER` 각성 즉시 중단, `TeamSeasonArchiveTab`에 `총 OVR → 실효 OVR (+Δ)` 추가.
  - **전술 파훼 장기 경직성(10R+ ×1.20 / 14R+ ×1.35) & AI 실효 전력 상향 + 26-27 67명 재조정**: 중·하위권 AI 최소 대응 30%·AI 감독 특성 반영 24~58%·빅클럽/중상위권 조직력 시너지·UCL 보정 +0.75로 실효 난이도 소폭 상향(50시즌 EPL: 고정 풀오토 57.3점 vs 변주 로테이션 70.8점 vs 로테이션+코치+각성2인 75.0점) 및 26-27 FotMob 실제 평가 기반 5대 리그 67명 OVR/`attrs` + 19개 구단 전력 동기화.
- **v9.3.1 5대 리그·시대별 리그 난이도 우승 점수 보정 · 드림 매치 년도별 베스트 11(60s~10s · 6팀) 독립 개편 · 가이드북/튜토리얼 전수 동기화 (`types/legacy.ts`, `legacyEngine.ts`, `historicalTeams.ts`, `eraBestXiTeams.ts`, `globalRankingService.ts`, `supabase/schema.sql`, `GameContext.tsx`, `mpLeagueScore.ts`, `DreamMatchArena.tsx`, `LegacyHubModal.tsx`, `SeasonSummary.tsx`, `MpLeagueFinalBoard.tsx`, `TitleScreen.tsx`, `SystemGuideModal.tsx`, `SoloVisualTutorialModal.tsx`, `v931LeagueScoreAndEraDream.test.ts`)**:
  - **리그 난이도 우승·순위 점수 보정 (전 리더보드 일괄 반영)**: `getModernLeagueStrengthAvg`(전체 60%+상위 6팀 40%)·`getLeagueDifficultyFactor`(기준 `78.0`, 기울기 `0.085`, `0.72~1.32`)로 EPL `×1.243`(+1,492) ~ 리그 1 `×0.815`(+978) 차등 적용. 역대 24팀(`HISTORICAL_ERA_LEAGUE_STRENGTH`)은 각 팀의 당시 시즌 리그 평균 강도 기준 산출. 기존 개인 명전(`loadLegacyState`)·글로벌 TOP 15(`globalRankingService` + `supabase/schema.sql` 멱등 SQL) 모두 자동 보정.
  - **역대 년도별 베스트 11 (60s~10s · 6팀)**: `1960s`·`1970s` 분리로 6개 독립 시대 팀 완성, `DreamMatchArena` 2대 전용 모드 카드 및 `LegacyHubModal` `년도별 베스트 11 (6)` 전용 탭 신설.
  - **가이드북·튜토리얼 전수 동기화**: 잔존 `레전드`/`엘리트 88+` 표기 완전 제거 및 가이드북 6탭 5대 리그 난이도 보정표·시대별 베스트 11 안내 동기화.
- **v9.3.0 시대별 클래식(`60s`~`10s`) 101명 개편 · 현역 OVR 압축 & 중위권 핵심 상향 · 저·중 OVR 포텐 각성(0~3명) (`player.ts`, `legendPlayers.json`, `activePlayers.json`, `leagues.json`, `formerClubs.ts`, `eraBestXiTeams.ts`, `historicalTeams.ts`, `managerTraits.ts`, `budgetEngine.ts`, `chemistryEngine.ts`, `awakeningEngine.ts`, `transferEngine.ts`, `dataLoader.ts`, `legacyEngine.ts`, `globalRankingService.ts`, `matchEngine.ts`, `standingsEngine.ts`, `analyticsEngine.ts`, `pitchTacticalParams.ts`, `PlayerCard.tsx`, `PitchBoard.tsx`, `PlayerDetailModal.tsx`, `RouletteReelsView.tsx`, `DreamMatchArena.tsx`, `TransferMarketModal.tsx`, `SystemGuideModal.tsx`, `SoloVisualTutorialModal.tsx`, `v93EraClassicsRebalance.test.ts`)**:
  - **시대별 클래식 101명 & 시대별 베스트 11(5팀)**: 단일 레전드 폐지 → `60s`~`10s` 유명 아이콘 101명(`OVR 95+` 7명·최고 96 제한, 통합 룰렛 `2.5%/릴`, 전원 `€130M` 균일가). `10s` 클래식↔현역 동명이인은 고유 `id`로 별도 인물 공존(`선수명 (10s)` + 시대 다크 프레임/배지, `ACTIVE_BY_NAME_MAP`/`CLASSIC_BY_NAME_MAP` 분리로 충돌 원천 차단). `DreamMatchArena`에 룰렛 미포함 전설들이 출전하는 `[시대별 베스트 11 (5팀)]` 탭 추가.
  - **현역 OVR 압축(최고 92) & 중위권 핵심 상향**: 현역 최상위 `94→92` 압축, 부진 빅클럽 하향, 비빅클럽 상한 미적용, 5대 리그 중위권 핵심 상향(계급 역전 0건, 동일 OVR 세부 능력치 개별 차별화) 및 연동 기준 전면 동기화(슈퍼스타 `90+` / 월클 `86+`, `ELITE_PAIR_MIN_OVR = 86`, `galactico_manager` `OVR 87+·클래식`, 2D `isStar >= 87`).
  - **저·중 OVR 포텐 각성(0~3명) & 육성 지표**: OVR 구간별 배율(`≤79 ×1.75 / 80~81 ×1.50 / 82~84 ×1.35 / 85~87 ×0.75 / 88+ ×0.04 / 클래식 0%`, 상한 `94`, 감쇠 `1.00 / 0.78 / 0.48 / 0.05`) + 드래프트 카드 단일 칩(`포텐↑`/`육성`) 및 `PlayerDetailModal` 1줄 준비도 체크바 추가.
- **v9.2.5 드래프트·영입 선수 타 리그/UCL AI 구단 중복 출전 근본 수정 (`dataLoader.ts`, `conditionEngine.ts`, `uclEngine.ts`, `mpLeagueEngine.ts`, `GameContext.tsx`, `LiveMatchBroadcast.tsx`, `OpponentPitchView.tsx`, `MpUclMatchPreviewModal.tsx`, `playerLookup.ts`, `v925GlobalUniqueUclFix.test.ts`)**: `START_SECOND_HALF_BROADCAST` 상대 벤치 보충 시 `excludeIds` 미전달로 유저 드래프트 선수가 하프타임 교체 투입되던 핵심 원인을 `buildSafeOpponentLiveRoster`로 원천 차단하고, `SIMULATE_UCL_PLAYOFF_BYE`·UCL 스킵/배경/멀티 완료·`loadSavedGameState` 세이브 자가 치유·`sanitizeAiClubRoster`/`prepareAiClubLineupForMatch`/`createUclTournamentState` 및 4대 UI 폴백까지 `ownedIds`/`excludeIds` 전역 유일 불변식 통일.
- **v9.2.4 FFP 이적시장 1·2·3차/UCL 기준 통일 · 자동진행 전술 파훼 경고 이동 수정 (`budgetEngine.ts`, `GameContext.tsx`, `mpLeagueEngine.ts`, `SeasonDashboard.tsx`, `UclDashboard.tsx`)**: FFP 1단계(`1/1/1/UCL 3회`)·2단계(`0/1/0/UCL 3회`) 기준 통일 및 자동진행 중 전술 파훼 경고 `[전술 수정하러 가기]` 즉시 일시정지 + `squad` 탭 이동 수정.
- **v9.2.3 내 팀 결산 GK·DF 수상 분리 · 명전 FFP 1/2단계 라벨 수정 · 이적시장 레전드 2.5% 고정 & 순위 비례 영입 제안 (`awardsEngine.ts`, `budgetEngine.ts`, `legacyEngine.ts`, `transferEngine.ts`, `GameContext.tsx`, `mpLeagueEngine.ts`, `SeasonSummary.tsx`, `LegacyHubModal.tsx`, `MpLeagueFinalBoard.tsx`, `TeamSeasonArchiveTab.tsx`, `TransferMarketModal.tsx`, `SeasonDashboard.tsx`, `SystemGuideModal.tsx`, `v923AwardsFfpTransfer.test.ts`)**: `SeasonAwards`에 GK 전용 `bestGoalkeeper`·DF 전용 `bestDefender` 신설 및 내 팀 결산 `최고 GK` 오류 수정·`최우수 수비수` 배지 추가, `formatFfpScorePenaltyLabel`로 로컬/글로벌 명전·싱글/멀티 결산 FFP 1/2단계 감점 라벨 정합화(구기록 자동 판별) 및 `TeamSeasonArchiveTab` 수치 동기화, 이적시장 룰렛 레전드 확률 `2.5%` 고정 + `rollIncomingOfferTargetCount(userRank)`로 리그 순위 높을수록 AI 영입 제안 수신 확률·건수 상향(1위 100%·최소 2건 / Top 4 100%·최소 1건).
- **v9.2.2 감독 특성 궁합 그룹별 밸런스 개편 (`managerTraits.ts`, `ManagerRouletteScreen.tsx`, `TacticsGuideModal.tsx`, `v814ManagerFitUi.test.ts`)**: 전라인 전술형(3종 `11명` 유지) / 라인 특화·측면·세트피스(5종 `6명` 통일·마일스톤 `2/4/6`, `direct_football`+`deep_playmaker`·`midfield_maestro`+`ball_playing_cb` 보강 및 6명 기준 상한 보정) / `galactico_manager`(`OVR 89+·레전드`, `4명` 목표·마일스톤 `1/2/4`, `+0.80/명` 최대 `+3.2`) / `total_football`(`5명`) / 상황 특화(4종 `0명`).
- **v9.2.1 핫픽스 (`UclMulticastPopupBoard.tsx`, `UclDashboard.tsx`, `v816UclUnifiedAutosimAndPreview.test.ts`)**: UCL 토너먼트 1차전(또는 리그 페이즈·관전) 자동진행 종료 후 인터뷰·부상·각성 등 후속 모달이 열렸다 닫힐 때 `UclMulticastPopupBoard` 리마운트로 이미 끝난 경기가 0분부터 재재생되던 버그 수정(`initiallySettled` + `getInitialUclCastClock`).
- **v9.2 v9.0 밸런스 정밀 튜닝 · 가이드북 6탭 IA · 모바일 스크롤 수정 · v9.0 이전 명전·글로벌 초기화 (`budgetEngine.ts`, `tacticalAdaptationEngine.ts`, `matchEngine.ts`, `pitchSimEngine.ts`, `awakeningEngine.ts`, `SystemGuideModal.tsx`, `guideNavigation.ts`, `SoloVisualTutorialModal.tsx`, `StaffCoachHireModal.tsx`, `index.css`, `legacyEngine.ts`, `globalRankingService.ts`, `supabase/schema.sql`, `LegacyHubModal.tsx`, `v92BalanceAndReset.test.ts`)**:
  - **레전드 가격 인상 & FFP 1·2단계 강화**: `LEGEND_FLAT_DRAFT_COST_M` `€95M`→`€135M`(슈퍼스타 하위권), FFP 1단계(`케미 -8 / 패배 사기 -1 / 1차 2회·2차 1회 / 점수 -6%`)·2단계(`케미 -14 / 패배 사기 -2 / 1차 1회·2차 동결 / 점수 -20%`), 드래프트 바·개막 팝업·대시보드·이적시장 헤더 100% 동기화.
  - **전술 파훼 타격 상향 & 종합 활용도 각성**: 8경기 템포·`위험` 전용 팝업·AI 등급별 차등 유지, 실효 전력(`-2.4/-2.6/-2.2`)·상성(`-1.4`)·xG(`+0.28/-0.24/-0.14`)·점유(`-4%p`)·2D 독트린(`tacticalCounterSeverity`) 강화(38R 고정 vs 변주 `+16.1점`). 각성은 활약+기용 완성도(시너지·감독 궁합·사기·로테이션/부상·포지션 적합도) 종합 반영, 시즌 0~2명(`0명 18% / 1명 42% / 2명 38% / 3명+ 2%`, 고활용 `61` vs 저활용 `1`)·레전드 0%·89+ 1/25 유지.
  - **가이드북 6탭 IA · 모바일 단일 스크롤 · v9.0 이전 기록 전면 폐기**: 플레이 흐름 6탭(`budget`/`tactics`/`squad`/`transfer`/`match`/`legacy`) + 빠른 섹션 점프 칩, `.modal-backdrop`/`StaffCoachHireModal`/v9.0 모달 `max-h-[90dvh]` + `shrink-0` + `flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y` 정비, 로컬 명전 1회성 마이그레이션 + `hofSummaryCache` 재계산 및 글로벌 TOP 15 `rule_era` v9.0+ 원천 필터·`supabase/schema.sql` 정리 SQL 완비.
- **v9.1 v9.0 대규모 업데이트 7대 밸런스·연출·로직 보완 (`tacticalAdaptationEngine.ts`, `TacticalAdaptationModal.tsx`, `lineupOptimizer.ts`, `conditionEngine.ts`, `matchEngine.ts`, `LiveMatchBroadcast.tsx`, `SoloLiveScoreboard.tsx`, `MatchDetailModal.tsx`, `FfpOpeningNoticeModal.tsx`, `TeamSeasonArchiveTab.tsx`, `SeasonSummary.tsx`, `MpLeagueSeasonSummary.tsx`, `MpLeagueFinalBoard.tsx`, `SoloVisualTutorialModal.tsx`, `SystemGuideModal.tsx`, `v91PolishAndFixes.test.ts`)**:
  - **전술 노출도 8경기 완화 & 위험 전용 팝업**: 추적 윈도우 `5`→`8`경기 확장(약 8연속 동일 패턴 시 `파훼 경계` 72+ 도달), `주의` 팝업 제거(전술실 배지 전용), `위험` 도달 시에만 팝업 1회 발동 + 변주 해제 시 재무장.
  - **AI 트레이드 주전 기용 버그 근본 수정**: `reoptimizeAiClubRoster`(헝가리안 Best XI `0..10` 정렬) + `adjustAiClubRatingsForRosterChange`를 싱글·타 리그·UCL·멀티 트레이드 전역 적용, `selectConditionAwareAiLineup`에 `11+` 고OVR 선수 자동 승격 안전망 보강.
  - **명장 AI 전반 기습 카운터 연출**: `AiPreMatchCounterInfo`(`kickoff` / `first_half` 18'~28')로 전술실 경고 배지·2D 실시간 전술 전환·`[전술 파훼 발동]` 중계 상단 배너·라이브 피드·경기 리포트 동기화.
  - **FFP 개막 감사 도트 팝업 & 페널티 명시**: 예산 초과 구단 1R 개막 1회 전용 `FfpOpeningNoticeModal`(유저 감독 당황 아바타·재정 감사 씬 + 페널티 체크리스트, 싱글·멀티 순차 큐 최상위) + 대시보드·이적시장 헤더 FFP 구체 페널티/팝오버 명시.
  - **리그·통합 결산 `[내 팀 결산 / 시즌 스쿼드]` 탭**: 공용 `TeamSeasonArchiveTab`(구단·감독·수석 코치·FFP 헤더 + 읽기 전용 `PitchBoard` 각성/케미/벤치 + 성적·리더·각성·트로피)을 싱글·멀티 리그 결산과 최종 결산 보드에 통합.
  - **6단계 실제 인게임 그래픽 튜토리얼 & 도감형 가이드북**: 예산 프리뷰 슬라이더·수석 코치 도트 아바타·크림슨 엠버 각성 카드·전술 노출도 배지 실물 프리뷰 및 12종 코치 전체 도트 도감·비교표 동기화.
- **v9.0 시즌 운영 깊이 4대 시스템 (`budgetEngine.ts`, `DraftBudgetBar.tsx`, `tacticalAdaptationEngine.ts`, `TacticalAdaptationModal.tsx`, `staffCoachEngine.ts`, `StaffCoachHireModal.tsx`, `StaffCoachBadge.tsx`, `awakeningEngine.ts`, `AwakeningCelebrationModal.tsx`, `v90SeasonDepthSystems.test.ts`)**: 드래프트 예산 `€950M` 소프트 캡(레전드 전원 `€95M` 균일가 · 잔여 예산 100% 이월 현금 협상 · FFP 2단계) · AI 사전 전술 파훼 · 2차 이적시장 수석 코치 12종(3명 추천 → 1명) · 영구 포텐 각성(레전드 0%, 89+ 1/25·최대 `+2`, 일반 ≤88 `+2~+7`·3명째 `×0.15`, 정적 DB 무오염, Crimson Ember).
- **v8.18 이적시장 감독 궁합·가치 지표 통일 · 멀티 참가자/정산 컴팩트 포메이션 팝업 · 2D 골문 멈춤 수정/세컨찬스/지표 동기화 · 멀티리그 전 경기 2배속 고정 (`transferEngine.ts`, `PitchBoard.tsx`, `TransferMarketModal.tsx`, `MpLeagueTransferModal.tsx`, `ClubSquadModal.tsx`, `MpLeagueDashboard.tsx`, `SeasonSummary.tsx`, `MpLeagueSeasonSummary.tsx`, `MpLeagueFinalBoard.tsx`, `mpLeagueEngine.ts`, `MpLeagueH2HView.tsx`, `pitchSimTypes.ts`, `pitchSimEngine.ts`, `attackChainEngine.ts`, `PitchMatch2D.tsx`, `LiveMatchBroadcast.tsx`, `v818TransferSquadSimFix.test.ts`)**:
  - **이적시장 감독 궁합 & 가치 통일 · 탭 중복 제거**: `computePlayerMarketValueM` 단일 시장가치 산식 export + `PitchBoard` 벤치 `★` 배지 + 싱글/멀티 이적시장 내 팀·상대/타 유저·FA 전 영역 `evaluateManagerPlayerSynergy` 기반 `'내 감독 궁합'` 표시 + 멀티 이적시장에 `€XM`/TP/비율/차이/유불리/통합세/니즈/`[✨ 니즈 강조]` 통일 + `MpLeagueTransferModal` `VIEW B` 배타 렌더링(`activeTab === 'offers'`) 및 스크롤 초기화로 스쿼드 탭 하단 이적시장 중복 노출 버그 제거.
  - **참가자 카드 감독 특성 & 공용 컴팩트 포메이션 팝업**: `ClubSquadModal`(`max-w-lg sm:max-w-xl`, `[포메이션]` 기본 ↔ `[리스트]` 전환, `buildClubSquadLineup` 저장 XI 복원 + AI 구단 빈 슬롯 없는 자동 배치)로 `MpLeagueDashboard` 참가자 카드 클릭·싱글 `SeasonSummary`·멀티 `MpLeagueSeasonSummary`/`MpLeagueFinalBoard` 전면 통합.
  - **2D 골문 앞 멈춤 근본 수정 · 세컨찬스/혼전 골 · 지표 일치/최적화**: 리시브 감속·깊은 박스 옵션 공백·고아 루즈볼 멈춤 4대 원인 제거 + `enforcePenaltyBoxFreezeGuard`(`0.42s`)·루즈볼 해소(`0.24s`), 6야드 박스 `tap_in`/`rebound`/`goalmouth_scramble` 및 `attackChainEngine` 자막 동기화, 실시간 `liveMetrics` 공식 전후반 수렴(가짜 `Math.sin` 제거), `PitchMatch2D` `React.memo`·오프스크린 피치 캐시·`syncPitchSimTargetsOnly` 분리 최적화.
  - **멀티리그 전 경기 맞대결 2배속 고정**: 컵/UCL 결승전 포함 멀티리그 모든 H2H(`mpLeagueEngine.ts` `speed: 2`, `MpLeagueH2HView.tsx` `lockSpeed: 2`)를 참가자·관전자 전원 2배속 고정.
- **v8.17 드래프트 무한 리롤 악용 원천 차단 · 새로고침 과거 롤백(5MB 저장 초과/라이브 취소) 근본 해결 · 글로벌 TOP 15 무결성 검증 (`GameContext.tsx`, `DraftScreen.tsx`, `MultiplayerBlindDraft.tsx`, `multiplayer.ts`, `globalRankingService.ts`, `supabase/schema.sql`, `v817AntiExploitAndPersistence.test.ts`)**:
  - **드래프트 무한 리롤 차단**: `hasSpun === true` 중 활성 슬롯 교환(`SWAP_SQUAD_POSITIONS`)·`CHANGE_FORMATION`·`AUTO_OPTIMIZE_LINEUP` 차단, `PICK_DRAFT_PLAYER` 후보 목록·중복 검증, 1v1 블라인드 드래프트 `draft`(`hasSpun`/`reels`) 동기 저장·복원.
  - **새로고침 롤백 근본 해결**: `compactGameStateForStorage`(종료 AI 경기 `result` 제거, 카탈로그 AI `{ id, _ref: 1 }` 참조 압축, 0출전 스탯/AI 피로 경량화, 공격적 폴백)로 9.4MB→3MB 미만 경량화해 5MB 쿼터 초과 저장 실패 제거 + `useLayoutEffect` 동기 저장 + `pagehide`/`beforeunload` 플러시 + `streamAutoMode` 새로고침 시 `COMMIT_LIVE_MATCH` 자동 확정 + 로드 시 실존 선수 원본 정규화.
  - **글로벌 TOP 15 무결성**: 클라이언트(`validateGlobalHofEntryIntegrity`) 및 Supabase `submit_global_hof_ranking` RPC 양측 중복 선수·레전드 상한(선발 5명/총 6명)·OVR 상한(`96.5`) 검증.
- **v8.16 싱글·멀티 챔스 자동진행 팝업(PK 시각화) 공용화 · 싱글 일시중지/직접진행 & 토너먼트 1경기씩 경계 확인 · 멀티 토너먼트 상대 비교 경기 프리뷰 (`UclMulticastPopupBoard.tsx`, `MpUclMulticastBoard.tsx`, `GameContext.tsx`, `UclDashboard.tsx`, `mpLeague.ts`, `mpLeagueEngine.ts`, `MpUclMatchPreviewModal.tsx`, `MpLeagueDashboard.tsx`, `MpLeagueRoot.tsx`, `v816UclUnifiedAutosimAndPreview.test.ts`)**:
  - **공용 UCL 자동진행 팝업 & PK 시각화**: `UclMulticastPopupBoard` 추출(스테이지 누적 타임라인으로 일시중지·배속 변경 시 시계 역행 방지, `PenaltyShootoutVisual` PK 시각화·`FT` 전 스포일러 차단·`LiveTieOverlay` 연동 100% 공용화), `MpUclMulticastBoard`는 `soloControls` 미노출 얇은 래퍼로 멀티 동기화 보존.
  - **싱글 전용 일시중지/직접진행 & LP 자유 선택 · KO 1경기씩 경계 확인**: `ABORT_STREAM_AND_START_LIVE_2D` + `committedCastKeyRef` 원자적 전환(중복 반영 차단, `z-[60]` 레이어 양보로 부상·인터뷰 겹침 방지), 리그 페이즈(`[2D 중계]`/`[자동진행]`/`[스킵]`) 자유 선택 및 토너먼트 1경기씩(1·2차전·결승) 자동진행 후 매 경계 `#solo-ucl-ko-boundary-bar` 확인(`ko_user`/`ko_spectate`).
  - **멀티 토너먼트 매 경계 상대 비교 경기 프리뷰 전용 화면**: `MpUclLive.knockoutPreviewRosters` + `MpUclMatchPreviewModal`(1차전/AGG·ATT/MID/DEF·케미·5구역 상성·감독 특성·핵심 TOP 3/선발 포메이션 + 생존자 전용 `[준비 완료]` / 전원 탈락 시 방장 진행)으로 모든 토너먼트 경계에서 단순 스쿼드·전술 수정 UI를 완전 대체.
- **v8.15 상위권 AI 감독·원클럽 케미 시너지 상향 & 명예의 전당 24팀 동반 상향 (`matchEngine.ts`, `historicalTeams.ts`, `balanceVerification.test.ts`)**: `computeAiSynergyBundle`(원클럽 실제 조직력 `avgSyn>=1.85 && chem>=88` + 명장 코칭 `contenderScale` 비례) 및 `computeAiTraitScale`(`7%~17%` → `14%~42%`) 상향으로 리그 1~4위 AI 강팀 실효 OVR `87~89`권 구현(중하위권 유지, OVR 90 기본 팀 우승률 `65%`→`40%` · AI 1위 `86~88점`), `buildHistoricalClubForMatch`에 전설 시대 보정(`+1.4~+2.1`, 상한 99) 동반 적용.
- **v8.14.2 토탈 풋볼 · 갈락티코 최대 5명(`n/5`) 조정 & 갈락티코 기준 `OVR 90+ · 레전드` (`managerTraits.ts`, `DraftScreen.tsx`, `v814ManagerFitUi.test.ts`)**: `total_football`(`3포지션+ 멀티`, `1~5명` `+0.55/명` 최대 `+2.75`, `1/3/5` 마일스톤) 및 `galactico_manager`(`OVR 90+·레전드`, `1~5명` `+0.70/명` 최대 `+3.50`, `1/3/5` 마일스톤) 조정.
- **v8.14.1 토탈 풋볼·갈락티코 기준 100% 통일 & 최대 6명(`n/6`) 조정 · `전라인` → `A·M·D` 표기 직관화 (`managerTraits.ts`, `ManagerFitBadge.tsx`, `ManagerTraitBadgeCard.tsx`, `ManagerRouletteScreen.tsx`, `MultiplayerBlindDraft.tsx`, `MpLeagueSnakeDraft.tsx`, `v814ManagerFitUi.test.ts`)**:
  - `total_football`(`3포지션+ 멀티`, `philosophyTarget: 6`, `1~6명` 최대 `A·M·D +2.75`)과 `galactico_manager`(`OVR 88+·레전드`, `philosophyTarget: 6`, `1~6명` 최대 `A·M·D +3.60`)의 `synergyPlaystyles`를 비워 개인 `★+1`과 팀 상승 기준을 100% 통일(`evaluateManagerPlayerSynergy` 단일 소스), `2/4/6` 마일스톤·`MAX` 배지·`A·M·D` 표기로 전면 직관화.
- **v8.14 싱글·멀티 전 드래프트/스쿼드 감독 궁합 `n/11` & 팀 능력치 상승 표시 (`managerTraits.ts`, `ManagerFitBadge.tsx`, `ManagerTraitBadgeCard.tsx`, `PitchBoard.tsx`, `PlayerCard.tsx`, `ManagerRouletteScreen.tsx`, `DraftScreen.tsx`, `SquadManagerModal.tsx`, `MatchDayTacticsRoom.tsx`, `TransferMarketModal.tsx`, `UclDashboard.tsx`, `MultiplayerBlindDraft.tsx`, `MpLeagueDraftBoard.tsx`, `MpLeagueSnakeDraft.tsx`, `MpLeagueSquadEditor.tsx`, `MpLeagueTransferModal.tsx`, `DreamMatchArena.tsx`, `v814ManagerFitUi.test.ts`)**:
  - **엔진 단일 원본(Single Source of Truth)**: 기존 감독 밸런스 수식은 무변경 유지, `evaluateManagerFitDetail` 순수 헬퍼로 `n/11`(드래프트 중에도 `/11` 분모 고정)·팀 라인 `A/M/D`·`OVR` 상승·`xG`/점유율·추천 전술 시너지·`3/6/9/11명` 기준표·매칭 선발 목록을 일관 산출.
  - **상황 특화형 4종 인원 무관 명확 구분**: `big_game_hunter`·`underdog_killer`·`halftime_wizard`·`super_sub`는 비례 게이지 대신 `팀 효과 인원 무관` 배지와 발동 조건을 명시(개인 `★+1 OVR`만 `n/11` 표시), 감독 선택 카드에도 `궁합 1~11명 비례` vs `팀 효과 인원 무관` 태그 추가.
  - **전 화면 통일 & 실시간 프리뷰**: 다크 톤 `ManagerFitBadge`(`strip`/`pill` + 뷰포트 클램프 클릭 상세 팝오버)를 `PitchBoard`·`ManagerTraitBadgeCard`·싱글/멀티 드래프트 헤더에 통합하고 활성 `tactic` + 후보 프리뷰 `baselineStarters`를 연결해 후보 클릭·스왑·전술·트레이드 시 실시간 반영.
- **v8.13 2D xT·정체 감점·능동 압박/커버 섀도우·전반/연장 막판 긴박도 · UCL 전용 승부차기 시각화 · 멀티 챔스 팝업/개막·이적 전술 UX · 룰렛 동적 포지션 (`pitchSimTypes.ts`, `pitchTacticalParams.ts`, `pitchSimEngine.ts`, `PenaltyShootoutVisual.tsx`, `SoloLiveScoreboard.tsx`, `MpLiveTicker.tsx`, `MpUclMulticastBoard.tsx`, `UclDashboard.tsx`, `LiveMatchBroadcast.tsx`, `mpLeagueEngine.ts`, `MpLeagueDashboard.tsx`, `MpLeagueTransferModal.tsx`, `mpLeagueDraft.ts`, `MpLeagueDraftBoard.tsx`, `v813SimUclRouletteFix.test.ts`)**:
  - **2D 무한 공돌리기 방지 & 현대 전술 엔진**: Karun Singh 12×8 `xT`(`sampleExpectedThreat`) ΔxT 보상 + `stallPassCount`/`possessionStallTime` 정체 감점 + 능동 압박 트리거(`pressTriggerTimer`, 반경 확대·압박 인원 +1)·1/2차 압박자 커버 섀도우 + 전반(`40'~45'+`)·후반(`75'~90'+`)·연장 전후반(`100'~105'+`, `112'~120'+`) 막판 긴박도 전면 확장.
  - **UCL 전용 브로드캐스트 승부차기 시각화**: 다크 스타디움 SVG 골대·다이빙 GK·슈팅 궤적·키커별 `●`/`✕` 보드(`PenaltyShootoutVisual`)를 싱글/멀티 UCL 자동진행 + UCL 2D 직접 경기(`LiveMatchBroadcast`)에만 적용(국내 리그·컵은 기존 `O`/`X` 유지).
  - **멀티 챔스 팝업 복원 · 개막 팝업 · 이적시장 대기 중 전술 수정 · 룰렛 포지션 수정**: `MpUclMulticastBoard` 및 UCL 리그 페이즈 라이브 중앙 팝업 모달 복원, 토너먼트 진입 시 잔류 8R 티커 제거 및 `[지난 라운드 기록 보기]` 접기 토글, `createMpLeagueSeason` 개막 전 `league-start` 준비 팝업, `MpLeagueTransferModal` 완료 후에도 `tacticsLocked = busy`로 스쿼드·전술 수정 허용, `resolveMpRouletteTargetDisplay`로 룰렛 `CM` 고정 버그 해결.
- **v8.12.1 2D 매치 시뮬레이션 4대 핵심 버그 근본 수정 (`pitchSimTypes.ts`, `pitchTacticalParams.ts`, `pitchSimEngine.ts`, `PitchMatch2D.tsx`, `LiveMatchBroadcast.tsx`, `v811Realistic2DSim.test.ts`)**:
  - **슈팅 사거리 가드 & 세트피스/역습 2D 사전 연출 일치화**: `MIN_OPEN_PLAY_SHOT_DEPTH = 0.72`(~29m) 물리·AI 가드로 하프라인 뒤 슈팅 원천 차단 + `stageSetPieceFormation`으로 PK(페널티 스팟·20명 박스 밖)·코너킥(코너 플래그·박스 포진→크로스)·프리킥(파울 지점·4인 수비벽)·역습(실제 박스 근처 전진 후 슈팅) 100% 일치화 + `save` 이벤트 동명 GK 오매칭 차단.
  - **구역별 패스 판단 & 초장거리 백패스 차단**: 박스 근접(`≥ 0.78`) 하프라인 뒤 및 `> 0.18` 백패스 하드 금지(컷백·크로스·단거리 레이오프·1대1 돌파 우선), 파이널 서드(`0.66..0.78`) 최대 `0.22` 단계적 2선 재순환 제한, `isSwitch` `forwardDelta ≥ -0.10` 정상화.
  - **경기 막판 시간·스코어 긴박도 AI**: `computeGameStateUrgency` + `applyGameStateUrgencyToDoctrine` + 매 분/득점 즉시 갱신(토너먼트 2차전 합산 스코어 포함)으로 75'/82'+ 열세 시 재순환 중단·전진 패스/크로스/3인 전방 압박/라인 전진·85'+ 1골 차 CB 박스 가담(`cbBoxJoin`), 리드 팀은 볼 간수·컴팩트 로우 블록 대비.
  - **단일 공 소스 보장**: 원자적 `resetBallToSpot`·`set_piece_setup` 공 잠금·비행 중 전용 테이퍼 모션 트레일 선·통일된 공중 높이 계수(`BALL_Z_LIFT_PX = 9`)로 4대 화면 전원 공 2개 분리 오류 완전 제거.
- **v8.12 글로벌 역대 유저 TOP 15 랭킹 · 랭킹 팀 1대1 도전 매치 · 명예의 전당 기준 상향(6,500+) (`supabase/schema.sql`, `globalRankingService.ts`, `GlobalTop15CelebrationModal.tsx`, `legacyEngine.ts`, `GameContext.tsx`, `SeasonSummary.tsx`, `LegacyHubModal.tsx`, `DreamMatchArena.tsx`, `TitleScreen.tsx`, `HeaderNav.tsx`, `v812GlobalTop15Ranking.test.ts`)**:
  - **원자적 TOP 15 유지 & 16위 이하 즉시 삭제**: `global_hof_rankings` 테이블·공개 조회 전용 RLS(`INSERT/UPDATE/DELETE` 차단)·`pg_advisory_xact_lock` + `SECURITY DEFINER` RPC(`submit_global_hof_ranking`)로 동시 등록 경쟁 조건 없이 상위 15개만 유지하고 16위 이하는 즉시 삭제, `SeasonState.runId`/`HallOfFameEntry.runId`로 중복 제출 방지 및 오프라인 안전 폴백 지원.
  - **명전 자동 등재 기준 상향(6,500+) & 시즌 종료 축하 팝업**: `HOF_AUTO_INDUCTION_MIN_SCORE`를 `5,500` → `6,500`(15-16 레스터 시티 6,513점 기준, S+ 7,200점 미만)으로 상향. 리그 단독/챔스 최종 종료 후 명전 등재 시 자동 판정해 TOP 15 진입 시 1회 래치 축하 모달(`GlobalTop15CelebrationModal`) 순차 노출(미진입 시 커트라인 1줄 참고 표시).
  - **역대 TOP 15 보드 & `DreamMatchArena` 1대1 도전**: `LegacyHubModal` `🌍 역대 TOP 15` 탭(타이틀·헤더 원클릭 진입) + 팀 피치/케미/벤치/8항목 점수 미리보기 + 로컬 명전 `[글로벌 도전]` 버튼 + `[1대1 대결]` 시 기존 `DreamMatchArena`·2D 리얼리스틱 엔진 재사용(현재 진행 중인 시즌 스쿼드 / 내 명전 팀 선택 및 미보유 시 안내 가드).
- **v8.11 리얼리스틱 2D 매치 시뮬레이션 전면 개편 (`pitchSimTypes.ts`, `pitchTacticalParams.ts`, `pitchSimEngine.ts`, `PitchMatch2D.tsx`, `LiveMatchBroadcast.tsx`, `mpLeague.ts`, `mpLeagueEngine.ts`, `MpLeagueH2HView.tsx`, `MultiplayerArena.tsx`, `DreamMatchArena.tsx`, `v811Realistic2DSim.test.ts`)**:
  - **5대 요소 100% 직결**: 9종 포메이션 3단 변형(빌드업/수비/전환) · 5대 팀 전술+5구역 상성 · 14종 감독 특성+지휘력 OVR(유저·AI·역대 강팀) · 14종 플레이스타일 · 세부 능력치(7+5)/11×11 시너지 행렬/실시간 체력 저하(후반 교체 속도 체감)를 매 틱 22명 에이전트 판단에 직결.
  - **진짜 축구 AI & Director 연동**: Craig Reynolds Steering(`Arrive`·`Pursuit`·`Separation`) + 회전 관성 + 3D 궤적 볼 물리, Buckland/Spearman Support Spot + 패스 레인 안전도 기반 볼 재순환(Recycling), 명시적 `A→B→C` 삼자패스(Third-Man Run), `matchEngine.ts` 밸런스 무변경 Director 하이라이트 연동(10종 패턴·14종 루트·6종 결과, 스포일러·텔레포트 0건), Mulberry32 결정론적 시드 동기화.
  - **Fixed-Timestep 배속 & 결승 특별 프레임**: `FIXED_DT=1/60s`·`SIM_SECONDS_PER_MATCH_MINUTE=1.2s`(1x 90분 약 2분 05초)로 정확한 `1x/2x/4x` 비례 배속. 싱글/드림 자유 `1x/2x/4x`(기본 `1x`), 1v1 멀티 `1x` 고정, 멀티리그 맞대결은 자국 컵 결승·UCL 결승 `1x` 고정 / 그 외 `2x` 고정, 컵·UCL 결승전 전용 골드 헤어라인 테두리·코너 브래킷·`CUP FINAL`/`UCL FINAL` 배지 적용.
- **v8.10.1 가이드북 팀 케미(0~100) 구조 & 실전 가이드라인 신설 (`chemistryEngine.ts`, `SystemGuideModal.tsx`, `v810GuideTutorialAndUx.test.ts`)**: `TEAM_CHEMISTRY_*` 상수를 엔진에서 공식 export해 가이드북 2번 탭에 4색 선별 팀 케미 가중치 차이(`1.25 / 1.0 / 1.0 / 0.45`), 50점 기준선·중복 차감(`평균 시너지×0.75`)·최대 `+0.8` 조직력 보너스·명예의 전당 가산, 실전 육성 3원칙 전용 카드를 추가.
- **v8.10 가이드북 100% 엔진 동기화 · 가독성 개편 · 싱글 5단계 비주얼 튜토리얼 · 인게임 `?` 컨텍스트 도움말 & 편의 UX**:
  - **가이드북 전수 동기화 & 가독성 (`SystemGuideModal.tsx`, `InjuryMoraleGuideContent.tsx`, `AttributeRoutesGuideContent.tsx`, `TacticsGuideModal.tsx`, `DraftScreen.tsx`)**: 구버전 수치 12건(시너지 `+0~+3`→최대 `+4`, 경상 강행 페널티, 토탈 풋볼 `0/-2/-8`, 9종 포메이션·통합 전술, 14종 감독 직접 선택, 체력/교체 5명, NBA 패키지 트레이드, UCL 36팀·명전 24팀·멀티 리그 등)을 엔진 상수 직접 참조로 100% 동기화하고, `break-keep`·`whitespace-nowrap`·하단 여유 패딩·중첩 스크롤 제거로 PC·모바일 가독성 완비.
  - **싱글 5단계 비주얼 튜토리얼 (`SoloVisualTutorialModal.tsx`, `guideNavigation.ts`, `TitleScreen.tsx`, `HeaderNav.tsx`)**: `[새 시즌 시작]` 최초 진입 시 커스텀 SVG/미니 UI 5단계 모달 노출(`X`·`[바로 시작]`·`[다음부터 보지 않기]` `rtt_solo_tutorial_dismissed_v1`·스와이프/키보드·타이틀/가이드북 `[입문 튜토리얼]` 재실행).
  - **인게임 `?` 딥링크 & 논-클러터 UX 6종 (`InfoHelpButton.tsx`, `PitchBoard.tsx`, `PlayerCard.tsx`, `RouletteReelsView.tsx`, `DraftScreen.tsx`, `MatchDayTacticsRoom.tsx`, `UnifiedTacticsStrip.tsx`, `ManagerRouletteScreen.tsx`, `TransferMarketModal.tsx`, `MpLeagueTransferModal.tsx`, `SeasonDashboard.tsx`, `UclDashboard.tsx`, `MpLeagueDashboard.tsx`, `LegacyHubModal.tsx`, `PlayerDetailModal.tsx`)**: 뷰포트 자동 클램핑 `?` 팝오버 + `[가이드북 해당 탭 →]` 딥링크, 피치 케미/선택 선수 실효 OVR 분해 팝오버, 드래프트 후보 `🔗 N선` 미세 칩, 전술실 5종 1클릭 비교 `?` 팝오버, 이적시장 `[니즈 강조]` 토글 + 성사 확률 TP 분해 `?`, 감독 선택 빌드업/스페셜리스트 필터 & 궁합 스타일 미리보기 구현(`v810GuideTutorialAndUx.test.ts`).
- **v8.7 챔스 1·2차전 전술 정비·생존자 한정 준비완료 · 0ms 즉시 반응 최적화 · 싱글/멀티 공용 실시간 대진표 · 이적시장 원본 피치 통일**:
  - **1·2차전 전술 정비 & 생존자 한정 준비 완료 (`mpLeague.ts`, `mpLeagueEngine.ts`, `useMpLeagueHost.ts`, `MpLeagueDashboard.tsx`, `UclDashboard.tsx`)**: `uclConsentedStage`를 `${stage}:leg${leg}` 단위로 세분화하고 `buildUclConsentFlow` + `humansAliveInUcl`로 생존자만 `[준비 완료]` 체크(`생존자 준비 X/Y`, 탈락자 자동 제외·관전, 0명 전원 탈락 시 방장 `[남은 토너먼트 진행]` 소프트락 방지), 싱글 `UclDashboard` 1차전 종료 후 2차전 전술 정비·시작 CTA 명확화.
  - **0ms 준비완료 & 전역 병목 최적화 (`MpLeagueRoot.tsx`, `useMpLeagueHost.ts`, `multiplayerService.ts`, `MpUclMulticastBoard.tsx`)**: `endMpLeagueCast`·LP 8R·H2H 종료 시 인공 5~9초 `autoMs` 대기 제거해 0ms 즉시 `consent` 전이, `player_signal` Broadcast에 `ackKey`·`lock`을 실어 DB 대기 전 0ms 낙관적 반영 + 호스트 전 구간(`consent`·`summary`·`transfer`·`h2h`) 즉시 기상, `subscribeToRoom` 안전 폴링 2초→6초 완화 + 중복 `fetchLeagueRev` 억제 + 멀티캐스트 월클럭 rAF화.
  - **공용 실시간 토너먼트 대진표 & 스포일러 차단 (`UclBracketTree.tsx`, `MpUclMulticastBoard.tsx`, `MpLeagueDashboard.tsx`, `UclDashboard.tsx`)**: 싱글·멀티 공용 `UclBracketTree`(`LiveTieOverlay`·`prevUclTies` 스포일러 차단·인라인 멀티캐스트 연동·참가자 커스텀 팀명/컬러/H2H 강조·모바일 라운드 탭+전체 트리 전환)로 토너먼트 자동 전환(리그페이즈 순위표는 작은 탭 유지).
  - **이적시장 원본 포메이션 피치 통일 (`PitchBoard.tsx`, `TransferMarketModal.tsx`, `MpLeagueTransferModal.tsx`)**: `PitchBoard`에 `selectedSlotKeys`/`selectedTone`/`slotExtraMeta`만 최소 확장해 싱글(트레이드·레전드 FA)·멀티 이적시장 모두 평소 스쿼드와 동일한 `PitchBoard(compact)` + 단일 `calculateChemistry`/`calculateTeamRatings`로 4색 케미선·`+N`/`-N`·실효 OVR·우상단 `A/M/D`·자유 벤치 100% 통일(`v87UclReadyBracketTransfer.test.ts`).
- **v8.6 멀티 드래프트 균등 순환 순서·내 턴 알림 · 관전자 하프타임 조작 차단 · 컵 우승 팝업 1회 고정 · UCL 리그페이즈 명칭/전술 정비 개편**:
  - **드래프트 순환 균등 배분 & 내 턴 비차단 알림 (`mpLeagueDraft.ts`, `MpLeagueDraftBoard.tsx`)**: `snakePickerIndex`를 `(round + pos) % playerCount` 순환으로 개편(`roundOrderIds` 추가)해 2P(8/8)·3P(6/5/5)·4P(4/4/4/4) 룰렛·첫 픽 균등화 + 상단 순번/다음 룰렛 표기 + 내 턴 전환 시 `pointer-events-none` 상단 토스트·에메랄드 펄스·탭 `[내 차례]`·음소거 가능한 2음 Web Audio 차임.
  - **관전자 하프타임 조작 차단 & 자국 컵 팝업 1회 고정 (`MpLeagueH2HView.tsx`, `LiveMatchBroadcast.tsx`, `MpLeagueDashboard.tsx`)**: 관전자 전용 읽기 전용 `하프타임 · 양 팀 전술 조정 중` 패널 분리 + 모든 전술/추천/교체 핸들러 잠금, `rtt_mp_seen_popups_v1` `localStorage`+메모리 기반 1회 래치(`openCupPopupKey`/`openLpPopupKey`/`openMilestoneKey`) + `live.stage === 'league'` 가드로 컵 우승 팝업 재노출 원천 차단.
  - **UCL 리그페이즈 순위 명칭 통일 & 챔스/토너먼트 전술 정비 일시정지 (`StandingsTable.tsx`, `MpUclSidePanel.tsx`, `MpLeagueDashboard.tsx`, `UclDashboard.tsx`, `mpLeagueEngine.ts`)**: `StandingsTable` UCL 커스텀 타이틀/존 라벨 지원 및 전 화면 `UCL 리그페이즈 순위` 통일, `closeMpLeagueSummary`·`stepUclLeaguePhase` `ucl-consent-league_phase` 게이트 + `consent` 배너 `[전술 수정]`/`[준비 완료]` 버튼으로 리그페이즈·토너먼트 진입 시 전술 정비 후 진행(`v86MpDraftAndUclPrep.test.ts`).
- **v8.5.4 스쿼드 탭 `[전술 수정]` 일시정지 → `[수정 확정]` 즉시 재개 UX (`useSoloTacticEditPause.ts` `useSoloTacticEditSession`, `SoloLiveScoreboard.tsx`, `SquadManagerModal.tsx`, `SeasonDashboard.tsx`, `UclDashboard.tsx`, `MpLeagueRoot.tsx`)**: 3초 자동 일시정지 타이머 대신 솔로 정규 리그·UCL 스쿼드 탭(및 스코어보드 상단)의 `[전술 수정]` 클릭 시 일시정지·편집 잠금 해제 → `[수정 확정]` 클릭 시 즉시 자동진행 재개 + 다음 경기 적용 안내 표시(멀티리그도 저장 직후 유예 대기 없이 즉시 재개).
- **v8.5.3 전술 수정 시 자동진행 일시정지 & 다음 경기 적용 안내 · 싱글/멀티 실시간 미니 순위표(경·승·무·패·득실·승점)**:
  - **전술 수정 일시정지 & 안내 (`useSoloTacticEditPause.ts`, `SoloLiveScoreboard.tsx`, `SeasonDashboard.tsx`, `UclDashboard.tsx`, `MpLeagueRoot.tsx`, `MpLeagueDashboard.tsx`, `MpLeagueSquadEditor.tsx`)**: 솔로 자동진행 중 전술/포메이션/라인업 변경 시 3초 일시정지(연속 편집 시 연장, `[재개]` 즉시 해제) + 다음 경기 적용 배너 표시. 멀티리그도 전술 저장 직후 2.5초 유예 잠금 + 다음 경기 적용 안내 배너 표시.
  - **실시간 미니 순위표 (`CompactLiveStandings.tsx`, `SeasonDashboard.tsx`, `UclDashboard.tsx`, `MpLeagueDashboard.tsx`, `MpUclSidePanel.tsx`)**: 솔로 리그·UCL PC(스코어보드 우측)/모바일(스코어보드 바로 아래)에 `# | 구단 | 경 | 승 | 무 | 패 | 득실 | 승점` 실시간 순위표(`[핵심 / 전체]` 토글) 추가 및 멀티리그 `SideStandings`·`SideUclStandings`에 `승·무·패` 컬럼 추가.
- **v8.5.2 핫픽스 (`LiveMatchBroadcast.tsx`, `SeasonDashboard.tsx`, `UclDashboard.tsx`)**: 솔로 라이브 자동진행(`START_SOLO_STREAM_MATCH`, `liveHalftime.streamAutoMode = true`) 중 `LiveMatchBroadcast`가 `streamAutoMode`를 필터링하지 않아 상단 라이브 스코어보드 대신 2D 시뮬레이션 모달이 자동으로 덮어 열리던 회귀 버그 수정(`shouldRenderLiveMatchBroadcast` 가드 적용, 일시정지 → `[2D 경기 중계 입장]` 클릭 시에만 2D 오픈).
- **v8.5.1 4인 멀티리그 2차전 맞대결 2D 집중 진행 · 4인 이적시장·인터뷰 렉/누락/팝업 오류 종합 최적화**:
  - **4인 리그 맞대결 템포 개선 (`mpLeagueEngine.ts`)**: `shouldPlayLeagueH2HLive`로 4인 이상 멀티리그에서 각 조합의 2차전(6경기)만 2D 시뮬레이션, 1차전(6경기)은 `resolveMpH2HFullInstant` + 라이브 스코어보드 실시간 중계(`watchedLive: false`)로 처리(H2H 전적 정상 누적, 2~3인 및 컵·UCL 기존 유지).
  - **4인 이적시장·인터뷰 렉/누락/동시성·팝업 겹침 수정 (`transferEngine.ts`, `mpLeagueEngine.ts`, `mpLeague.ts`, `useMpLeagueHost.ts`, `MpLeagueRoot.tsx`, `MultiplayerArena.tsx`, `PlayerDetailModal.tsx`)**: `generateIncomingTradeOffers` `excludeClubIds`/`minOfferCount`/OVR-매칭 폴백 + `stepTransfer` 4회 재시도로 4인 드래프트 고OVR 스쿼드·충돌에 의한 제안 0건(이적시장 미오픈) 버그 근본 해결, 완료 오퍼 `offerClubs` 즉시 프루닝으로 페이로드 경량화, `handleActions` `Promise.all` 병렬화 + `pendingWake` 즉시 재실행 + 고유 ID `handledActionIds` 기반 `actionBusy`, 방장 본인 0ms 즉시 기상(`wakeHostLocally`), `mergeRoomSnapshot` 미변경 행/`league_payload` 참조 보존으로 리렌더 스파이크 차단, 이적시장/인터뷰 시 `editorOpen` 자동 닫힘, `PlayerDetailModal` `z-[85]` 상향(`v85MpSyncAndUclLayout.test.ts` 4인 풀시즌 스트레스 테스트).
- **v8.5 멀티리그 Broadcast 즉시 동기화 · 순위표 즉시 반영 · 컵/우승 스포일러 차단 · 챔스(Phase 2) 전용 레이아웃 & 실시간 사이드바**:
  - **Broadcast Fast Sync & 비방장 팝업 지연/미표시 근본 수정 (`mpLeagueService.ts`, `useMpLeagueHost.ts`, `MpLeagueRoot.tsx`, `MpLiveTicker.tsx`)**: `MpLiveTicker` `useEffect` 의존성에서 `ordered`를 제거해 리렌더 시 `onDone` 유실(다른 버튼 클릭 시 뒤늦게 팝업이 뜨던 버그)을 원천 해결하고, 월클럭 + 백그라운드 워치독 + `hasPlayableTickerMatches` 가드 + `mp-league:${roomId}` Broadcast(`live_updated`/`player_signal`) + 1-RTT `fetchLeagueLiveOnly` + 방장 커밋 락스텝/즉시 기상으로 방장·참여자 동시 팝업 구현.
  - **순위표 즉시 반영 & 컵/리그/UCL 조기 스포일러 완전 차단 (`mpLeagueEngine.ts`, `MpLeagueDashboard.tsx`, `MpLeagueRoot.tsx`, `MpUclSidePanel.tsx`)**: 티커에 `prevStandings`/`prevCup`/`prevUclStandings`/`prevTopScorers`/`prevTopAssisters`를 분리 보존해 중계 중 스포일러 차단 및 `FT` 도달 즉시 실시간 반영. `MpLeagueSeasonSummary`, `MpCupChampionPopup`, `MpLeagueFinalBoard`/`MpLeaguePodiumPopup`, `UclMilestoneModal` 전원을 `!tickerPlaying && !live.cast` 완료 후에만 노출.
  - **멀티리그 Phase 2 챔스 전용 레이아웃 & 실시간 사이드바 (`MpUclSidePanel.tsx`, `MpLeagueDashboard.tsx`, `LeagueLeadersSideCard.tsx`, `mpLeagueEngine.ts`)**: 챔스 진입 시 깊은 네이비 전용 헤더 + 우측 사이드바 `SideUclStandings`(1~8/9~24/25~36 컷라인·친구 강조·`[핵심|전체36]`) / 토너먼트 `SideUclKnockoutCard` + UCL 득점·도움 자동 전환, 모바일 3분할 컴팩트 전환 바 적용(`v85MpSyncAndUclLayout.test.ts`).
- **v8.4.2 라이브 중 2D 난입 · 이벤트 후 재개 선택 · 승부차기 추가시간 키커 중계 · 스킵 중 인터뷰 정지 수정**:
  - **라이브 중 2D 시뮬레이션 입장 (`league.ts`, `GameContext.tsx`, `SoloLiveScoreboard.tsx`, `LiveMatchBroadcast.tsx`, `SeasonDashboard.tsx`, `UclDashboard.tsx`)**: 솔로 라이브 자동진행을 `liveHalftime.streamAutoMode` 미확정 상태로 실행(`START_SOLO_STREAM_MATCH` → `FT`+PK 시 `COMMIT_LIVE_MATCH`)해 일시정지 시 `[2D 경기 중계 입장]`(`ENTER_LIVE_BROADCAST_FROM_STREAM`)으로 멈춘 분/구간 그대로 2D 중계에 난입 가능.
  - **이벤트 후 `[이어서 자동진행 / 일시정지]` 선택지 (`SeasonDashboard.tsx`, `UclDashboard.tsx`)**: 컵대회/2D 직접 지휘·이적시장·부상 대응 완료 후 재개 선택 모달 표시(인터뷰는 응답 직후 자동진행 즉시 이어감).
  - **승부차기 추가시간 진행 & 키커별 보드 (`mpLeague.ts`, `mpLeagueEngine.ts`, `MpLiveTicker.tsx`, `SoloLiveScoreboard.tsx`, `useMpLeagueHost.ts`)**: `penalties.kicks` 기반 700ms/키커 추가 페이즈 + 실시간 PK 스코어·`O`/`X` 도트·서든데스 배지·키커 속보 배너 적용 및 멀티 방장 대기시간(`getMpTickerExtraPkMs`, `getMpCastDurationMs`) 동기화.
  - **고속 스킵 인터뷰/부상 백그라운드 진행 차단 (`UclLeaguePhaseFastSimModal.tsx`, `FastSimModal.tsx`, `GameContext.tsx`)**: 모든 고속 스킵 모달 타이머·이적시장 자동전환·`[즉시 완료]` 및 리듀서 액션(`SIMULATE_ONE_FAST_ROUND`, `SIMULATE_SINGLE_MATCH_INSTANT`, `SIMULATE_TO_NEXT_TRANSFER`, `SKIP_TO_SEASON_END`, `SIMULATE_UCL_LEAGUE_PHASE_TO_END`, `SIMULATE_UCL_TO_END`)에 인터뷰/부상 정지 가드 완비(`v84LiveScoreboardAndSkip.test.ts`).
- **v8.4.1 핫픽스 (`SeasonDashboard.tsx`, `UclDashboard.tsx`)**: 솔로 `[라이브 자동진행]` 중 경기 후 인터뷰·부상·이적 이벤트가 스코어보드 재생(`0'→90'`) 도중 `paused=true`를 걸어 `soloTickerPlaying` 해제가 막히고 팝업이 뜨지 않던 교착 버그 수정(`liveTickerPlaying` 동안 `liveAutoPauseReason` 유예 + 1.5초 워치독 추가).
- **v8.4 라이브 스코어보드 자동진행 · 솔로 스킵 단일화 · 멀티 H2H 프리뷰 스킵/결과 확인 · 인터뷰 빈도/조기 배지 수정**:
  - **솔로 라이브 자동진행(5·7·9초) & 스코어보드 rAF 최적화 (`SoloLiveScoreboard.tsx`, `MpLiveTicker.tsx`, `index.css`, `GameContext.tsx` `soloTickerPlaying`, `App.tsx`, `SeasonDashboard.tsx`, `UclDashboard.tsx`)**: 60fps DOM ref 진행률 바 보간 + 정수 분 커밋 + 스코어 플립/골 속보 연출을 솔로·멀티 공용화하고, 솔로 리그·UCL 리그 페이즈에 5/7/9초 라이브 자동진행 도입(인터뷰·부상·자국 컵·이적시장 시 자동 일시정지 → 처리 후 자동 재개).
  - **솔로 경기 스킵 단일화 (`FastSimModal.tsx`, `SeasonDashboard.tsx`)**: 단일 `[경기 스킵]`(`mode='unified'`)으로 통합, 이적시장 자동 중지 후 이적시장 마감 시 `[계속 스킵 / 일시중지]` 재질문 팝업 표시.
  - **멀티 H2H 프리뷰 스킵 & 결과 팝업 `[확인]` 대기 (`mpLeagueH2H.ts` `resolveMpH2HFullInstant`, `useMpLeagueHost.ts`, `MpLeagueH2HView.tsx`)**: 프리뷰 `[스킵 요청]` 지원, 일반 종료/합의 스킵 모두 `phase='finished'` 결과 팝업에서 온라인 전원(관전자 포함) `[확인]` 클릭 후 전이.
  - **멀티 인터뷰 빈도 축소 & 조기 배지 수정 (`mpLeagueEngine.ts`, `mpLeague.ts`, `MpLeagueRoot.tsx`, `MpLeagueDashboard.tsx`)**: 8라운드 쿨다운·시즌 최대 4회 상한·핵심 분기점 트리거 적용, `tickerDoneKey`를 `MpLeagueRoot`로 끌어올려 스코어보드 재생 중 `~님 인터뷰 답변 중` 배지 및 lock 조기 노출 원천 차단(`v84LiveScoreboardAndSkip.test.ts`).
- **v8.3 UI·레이아웃 컴팩트화 & 벤치 포지션 종속 해제**:
  - **자유 벤치 전환 & 부상 교체 수정 (`lineupOptimizer.ts`, `mpLeagueDraft.ts`, `mpLeagueEngine.ts`, `transferEngine.ts`, `PitchBoard.tsx`, `InjuryAlertModal.tsx`, `TransferMarketModal.tsx`, `MpLeagueTransferModal.tsx`, `MpLeagueRoot.tsx`)**: 드래프트 픽 단계에서만 `BENCH_SLOTS` 가이드를 유지(`draftBenchHints`)하고 드래프트 이후 벤치는 포지션 제약 없는 자유 배열로 전환(항상 선수 실제 `player.position` 표시·판정). `InjuryAlertModal` 벤치 부상 시 0번(GK) 슬롯 오폴백 수정, `resolveAvailableLineup` 포메이션 슬롯 기반 대체, `MpLeagueRoot` 낙관적 스쿼드 반영, `toCastMatch` 연장전 이벤트 중복 집계 버그 수정.
  - **UCL 우상단 실시간 `A / M / D` & 모바일 팝업 스크롤 안정화 (`UclDashboard.tsx`, `src/hooks/useBodyScrollLock.ts`, `src/index.css`, 전체 29개 모달)**: Phase 2 스쿼드 우상단 `A/M/D` OVR 추가, 전역 ref-counted 바디 스크롤 잠금 + `.modal-backdrop`/`.modal-panel`/`.modal-scroll`(`100dvh`, `overscroll-behavior: contain`) 일괄 적용.
  - **컴팩트 피치·후보 창, 멀티 단일 피치+탭 & 3인+ 4팀 룰렛 (`PitchBoard.tsx`, `OpponentPitchView.tsx`, `PlayerCard.tsx` `dense`, `RouletteReelsView.tsx`, `DraftScreen.tsx`, `MultiplayerBlindDraft.tsx`, `MpLeagueDraftBoard.tsx`, `mpLeagueDraft.ts`)**: CSS `zoom` 없이 피치·후보 카드 높이 대폭 축소, `ScaledPitchFrame.tsx` 삭제 후 멀티 드래프트를 `[단일 원본 피치 + 상단 참가자 전환 탭]`으로 개편, 3인 이상 참가 시 공유 룰렛 4구단 확장(`v83UiBenchAndRoulette.test.ts`).
- **v8.2 멀티플레이 UX·디자인 정합성 개편 & 리그 도움 순위**:
  - **드래프트 균등 원본 피치 & 대기 턴 UX (`ScaledPitchFrame.tsx`, `PitchBoard.tsx`, `PlayerCard.tsx`, `RouletteReelsView.tsx`, `MpLeagueDraftBoard.tsx`)**: 간략 피치(`MpMiniPitch.tsx` 삭제)와 대형 내 피치 분리를 제거하고, `ResizeObserver` + `transform: scale()`(`baseWidth=376`, CSS `zoom` 미사용)으로 원본 `PitchBoard`를 2/3/4인 전원 동일 크기 그리드로 렌더링(내 팀 에메랄드+`MY`, 상대 지명 턴 앰버). 대기 턴에도 `RouletteReelsView`를 원본 크기로 유지하며 선택된 선수만 제자리 `선택됨 · [닉네임]` 잠금 처리.
  - **실시간 우상단 `A / M / D` OVR (`MpLeagueSquadEditor.tsx`, `MatchDayTacticsRoom.tsx`)**: 싱글과 동일한 `calculateTeamRatings` 기반 `A / M / D` 지표를 멀티 스쿼드 에디터 및 전술실 우상단에 실시간 표시.
  - **이적시장 역제안 원본 통일 & 정산/대시보드 일관성 (`mpLeagueEngine.ts`, `mpLeagueScore.ts`, `useMpLeagueHost.ts`, `MpLeagueTransferModal.tsx`, `MpLeagueDashboard.tsx`, `MpLeagueSeasonSummary.tsx`, `MpLeagueFinalBoard.tsx`, `mpUclView.ts`)**: `offerClubs` + 다중 패키지 역제안 엔진 확장 및 `TransferMarketModal` 동일 UX(`[← 받은 제안으로]` / `[이적시장 끝내기]`, 듀얼 피치/리스트, 성사 확률, 실수 종료 모달) 적용. 이적시장·시즌 정산 위 이전 이벤트 결과/부상 모달 중첩 버그 차단. 리그 종료(UCL 진입 게이트·컵 대진표·H2H)·UCL MVP(`topPlayerStats`)·최종 결산(발롱도르·FIFA 월드베스트 XI·역대 24팀·참가자 순위/맞대결/8항목 세부 점수) 통합.
  - **사이드 득점 + 도움 순위 (`LeagueLeadersSideCard.tsx`, `SeasonDashboard.tsx`, `MpLeagueDashboard.tsx`)**: 싱글·멀티 리그 공통 사이드 위젯 — PC 동시 표시, 모바일 `[득점 | 도움]` 원터치 전환.
- **v8.1 멀티 리그 몰입도 개편**:
  - **드래프트**: 라운드당 룰렛 1개를 전원이 공유(첫 순번이 돌림, `mp_room_players.activity.roll`), 순서만 스네이크로 뒤집힘. `MpLeagueDraftBoard.tsx`가 드래프트 화면, `MpLeagueSnakeDraft.tsx`는 감독 선택 화면만 담당. 전원 동의 자동 드래프트 키는 `draft-auto:{generation}`(activity.ackKeys).
  - **라이브 스코어보드**: 엔진이 라운드마다 `MpLeagueLive.ticker`(친구 경기의 골 분·중계 feed·스탯·직전 순위표)를 발행하고 `MpLiveTicker.tsx`가 재생. 재생 완료 전에는 대시보드가 이전 순위·결과를 유지.
  - **진행 흐름 추가**: `summary`(리그 정산, 전원 `[계속]` 필요). 진행 단계에 `league_summary` 추가.
  - **맞대결 스킵**: 양 당사자의 `h2h-skip:{matchId}` 확인 키가 모두 있으면 방장이 남은 구간을 즉시 계산.
  - **챔스 팝업 재사용**: `mpUclView.ts`가 한 감독의 구단을 싱글용 고정 id로 바꿔 끼운 뷰를 만들어 싱글 팝업을 그대로 사용(싱글 컴포넌트 수정 없음).
  - **동기화 비용**: 클라이언트는 `live->rev`만 먼저 조회 후 변경 시에만 전체 상태를 받음. 자동진행 간격 4~7초.
- **v8.0 멀티 리그 & 챔피언스리그 (친구 2~4명 공유 시즌)**:
  - **구조 — 방장 권위형**: 방장 브라우저가 시즌 전체(`MpLeagueHostState`)를 계산해 공개 스냅샷(`MpLeagueLive`)만 `mp_league_state.live`에 발행하고, 나머지는 받아서 그립니다. 방장 전용 전체 상태는 방장 브라우저 IndexedDB(`rtt_mp_league_host_v1`)에 라운드마다 저장되어 새로고침 시 이어집니다(다른 기기에서는 이어받기 불가, 방장 자동 승계 없음).
  - **분리 원칙**: 싱글 플레이(`GameContext.tsx`, 유저 구단 1개 전제)와 1대1(`MultiplayerArena.tsx`)은 건드리지 않았습니다. 멀티 리그는 `src/engine/mpLeagueEngine.ts`(시즌 진행 상태 머신 `runMpLeague`), `mpLeagueDraft.ts`(스네이크 순번·자동픽), `mpLeagueH2H.ts`(친구 맞대결 단계 시뮬), `mpLeagueScore.ts`(결산 2종 점수), `src/services/mpLeagueService.ts`(Supabase 동기화), `src/components/multiplayer/league/*`(화면)로 분리되어 있습니다.
  - **기존 엔진 재사용**: `matchEngine`·`conditionEngine`·`transferEngine`·`awardsEngine`·`legacyEngine.computeSeasonScore`를 그대로 호출합니다. `cupEngine.advanceCupStage`, `uclEngine.simulateUclLeaguePhaseRound`/`advanceUclKnockoutLeg`에는 사람 경기 결과를 주입하는 선택 파라미터 `precomputedResults`만 추가했습니다(없으면 기존 동작 100% 동일).
  - **진행 흐름(`MpLeagueFlow`)**: `auto`(라운드당 2.5~4초 타이머) ↔ `h2h`(친구 맞대결) / `event`(전원 같은 라운드 인터뷰) / `transfer`(받은 제안·역제안만) / `consent`(UCL 토너먼트 단계별 전원 동의) / `cast`(UCL 멀티캐스트 전광판) → `done`. 전역 일시정지는 각 참가자 행의 `mp_room_players.activity.lock`으로 표현됩니다.
  - **테이블 역할**: `mp_room_players.league_payload`(본인 스쿼드, 트레이드 시 방장이 갱신), `mp_room_players.activity`(일시정지 사유 + 동의/완료 확인 키), `mp_room_players.tactic_submission`(맞대결 전술 확정, 1대1과 공용), `mp_league_picks`(공개 드래프트 픽, 유일 키로 중복 차단), `mp_league_actions`(참가자→방장 요청 큐).
  - **맞대결 배속**: 리그·컵·UCL 리그 페이즈 4배속, UCL 토너먼트 2배속(`MpH2HSpec.speed`). 비당사자는 `LiveMatchBroadcast`를 조작 잠금 상태로 관전합니다.
  - **결산**: 친구 순위 = `computeSeasonScore` 총점 + 맞대결 점수(최대 1,500), 역대 강팀 비교 = `computeSeasonScore` 총점만. 멀티 시즌은 명예의 전당에 저장하지 않습니다.
  - **Supabase**: `supabase/schema.sql` 하단 v8.0 구간을 SQL Editor에서 1회 실행해야 멀티 리그 방이 만들어집니다(미적용 시 방 생성 단계에서 안내 문구 표시).
  - **검증 범위**: `v80MultiLeague.test.ts`(엔진 풀시즌) + 로컬 가짜 백엔드로 브라우저 3개 실플레이. 실제 Supabase Realtime 환경에서의 2~4인 접속은 배포 후 확인이 필요합니다.
- **v7.2 주요 버그 수정 · 멀티플레이 커스텀/연출 · UCL 리그 페이즈 고속진행 & 36팀 순위표 팝업**:
  - **4대 버그 수정 (`formations.ts`, `positionEngine.ts`, `PitchBoard.tsx`, `OpponentPitchView.tsx`, `GameContext.tsx`, `playerLookup.ts`, `awardsEngine.ts`, `standingsEngine.ts`, `matchEngine.ts`, `LiveMatchBroadcast.tsx`, `DreamMatchArena.tsx`)**: ① 9개 전 포메이션 피치·상세 카드 포지션 부적합 OVR 페널티 단일화(`3-3-3-1` `RAM` 등), ② 피치 선수 재클릭/빈 공간 클릭 시 케미선 호버·선택 강조 즉시 해제, ③ 타 리그 트레이드 선수 스탯 이중 합산(66경기 버그) 차단 및 단일 리그 최대 라운드(38R/34R) 상한 보장, ④ 전 모드 교체 아웃 확정 선수 영구 잠금(`교체됨`) 및 잔여 체력 유지(체력 100 초기화 방지).
  - **멀티플레이 감독·유니폼·구단명 커스텀 & 피치 공개/승패 감독 도트 모션 팝업 (`MpProfileCustomizerModal.tsx`, `PreKickoffRevealModal.tsx`, `MpPostMatchManagerPopup.tsx`, `PixelManagerAvatar.tsx`, `MultiplayerLobby.tsx`, `MultiplayerArena.tsx`, `multiplayerService.ts`, `v72BugfixAndMpCustom.test.ts`)**: 로비 감독 외형·유니폼 패턴/컬러·구단명 커스텀 및 프리셋 불러오기(`updatePlayerProfile` 실시간 동기화), 킥오프 직전 양 팀 포메이션 피치 뷰 공개 모달, 1대1 종료 후 승장(축하 포즈 4종) + 패장(엎드려 땅치기·무릎 꿇고 오열·대자로 뻗어 영혼 가출·OTL 얼굴 파묻기 등 좌절 모션 4종) 동시 등장 및 랜덤 멘트 팝업 구현.
  - **UCL 리그 페이즈 단계별 고속진행 모달 & 36팀 순위표 팝업 (`UclLeaguePhaseFastSimModal.tsx`, `UclLeaguePhaseStandingsModal.tsx`, `UclDashboard.tsx`)**: `[리그 페이즈 끝까지 고속진행]` 클릭 시 1R~8R 라운드별 경기 결과·순위 변동·실시간 상위 8위+내 구단 순위표를 단계별로 보여주는 고속진행 모달(속도 조절·일시정지·부상 자동 정지·즉시 완료) 및 8R 완료 시 자동 표시되는 36팀 스위스 리그 페이즈 순위표 팝업(1~8위 직행 / 9~24위 PO / 25~36위 탈락 커트라인 포함) 구현.
- **v7.1 주요 개선**:
  - **1대1 전술실 블라인드 상태 · 최종 전술 공개/비교 팝업 · 1배속 동기화 (`MatchDayTacticsRoom.tsx`, `PreKickoffRevealModal.tsx`, `LiveMatchBroadcast.tsx`, `MultiplayerArena.tsx`)**: 전술실 상대 상태 `[전술·포메이션 수정 중...]`/`[전술 확정 (공개 대기)]` 표시, 양측 확정 후 최종 전술 비교 팝업(양측 준비 완료 → 방장 킥오프), 멀티 2D 중계 `lockSpeed: 1` 고정.
- **v7.0.2 핫픽스**:
  - **양측 전술 확정 후 킥오프 멈춤 수정 & 전술 잠금 (`multiplayerService.ts`, `MultiplayerArena.tsx`, `MatchDayTacticsRoom.tsx`, `LiveMatchBroadcast.tsx`)**: `publishMatchState` status CHECK 폴백·`match_state` 단독 저장 폴백·`isMatchLiveNow` 판별·즉시 스냅샷 재조회 적용, 전술 확정 시 전술/포메이션/스왑 잠금 및 `[전술 수정]` 해제 버튼 추가.
- **v7.0.1 핫픽스**:
  - **Supabase CHECK 제약조건 호환성 (`multiplayerService.ts`, `multiplayer.ts`, `MultiplayerArena.tsx`, `MultiplayerLobby.tsx`)**: 1대1 방 생성 시 `mode`를 DB `DEFAULT`에 위임하고 `status`/`seat` CHECK 제약조건(`23514`) 자동 폴백 추가.
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

이어서 진행할 우선순위 작업 목록입니다 (저장소: `darksuri82/roadtotreble`, 라이브: `https://darksuri82.github.io/roadtotreble/`):

1. **멀티 리그 후속 (v8.x)**
   - 실제 Supabase 환경 2~4인 실전 테스트 후 타이밍(턴·전술 확정 제한 시간) 조정, 방장 자동 승계, 참가자 간 직접 트레이드, 시즌 중 재접속 UX 보강.
2. **글로벌 랭킹 보드 (Backend / Serverless 연동)**
   - Supabase 또는 Firebase Firestore / Cloudflare Workers KV 연동으로 유저 완료 시즌의 `SeasonScoreBreakdown`·우승 트로피·스쿼드 스냅샷을 공유 랭킹 보드에 등록(시즌/전체/언더독/트레블 리더보드).
3. **PWA (Progressive Web App) 지원**
   - `manifest.webmanifest`, 앱 아이콘, Service Worker 캐싱을 추가해 모바일 홈 화면 설치 및 오프라인 플레이 지원.
4. **Phase 3 콘텐츠 확장 아이디어**
   - 다중 시즌(연속 커리어 / 유스 아카데미 / 선수 에이징 & 은퇴), UEFA 유로파리그(5~6위 진출), 경기 사운드 효과(관중 함성·휘슬·골대 타격음 토글).
