# Road To Treble — Claude Code 작업 규칙

이 저장소는 Claude Code와 Antigravity가 번갈아 개발한다. 새 세션은 아래 순서를 먼저 따른다.

## 1. 세션 시작 (코드 수정 전 필수)

1. `git status`, `git fetch --all --tags`, `git log -n 8 --oneline`으로 작업 브랜치가 최신 `origin/main`과 일치하는지 확인하고, 뒤처져 있으면 `origin/main` 기준으로 동기화한다.
2. 저장소 전체를 훑기 전에 `PROJECT_HANDOFF.md` → `CHANGELOG.md` 최상단 → `package.json` 순으로 읽는다.
3. 작업 전 현재 커밋에 롤백용 태그(`stable-before-...`) 또는 `claude/...` 작업 브랜치를 남긴다.

## 2. 불문율 (임의 변경 금지)

- **불필요한 리팩토링·리디자인 금지**: 요청한 기능·버그와 무관한 파일, 컴포넌트 구조, 차분한 다크 톤 색감, 모바일 레이아웃을 건드리지 않는다. 새 화면도 기존과 같은 톤으로 만든다.
- **모바일 터치 안정성**: CSS `zoom` 속성과 이중 스크롤(`100vh` 중첩 등)을 쓰지 않는다.
- **UI 텍스트**: 게임 화면에 AI식 장황한 설명 문구·힌트 배너를 넣지 않는다. 상세 설명은 기존 `[가이드]` 모달이나 작은 `?` 툴팁 안에만 넣는다.
- **데이터 무결성**: 실제 선수·구단·역대 강팀 데이터는 사실과 공식 기록에 기반한다. 확인되지 않은 이력·스탯을 지어내지 않는다.
- **보안**: `.env` 파일이나 Supabase 키를 코드에 하드코딩하거나 커밋하지 않는다.

## 3. TypeScript · React 제약

- `verbatimModuleSyntax`: 타입은 반드시 `import type`.
- `erasableSyntaxOnly`: `enum`, parameter properties 금지.
- `noUnusedLocals` / `noUnusedParameters`: 미사용 변수·파라미터 금지.
- 중첩 `<button>` 금지, 렌더 중 `ref.current` 읽기/쓰기 금지, `useEffect` 본문에서 동기 `setState` 지양.

## 4. 작업 워크플로우

1. 바로 수정하지 말고 **현재 `origin/main` 요약 + 수정 계획(건드릴 파일 목록)**을 한국어로 짧게 보고해 승인을 받는다.
2. 구현 후 `npm run build`(타입 체크 포함) 오류 0건, `npm run test`, `npm run lint`를 확인한다.
   - `balanceVerification.test.ts`는 난수 기반이라 가끔 실패한다. 실패하면 그 테스트만 다시 돌려 구분한다.
3. 기존 버전을 덮어쓰지 말고 새 버전으로 `src/data/patchNotes.ts`(`CURRENT_APP_VERSION` + `PATCH_NOTES` 최상단), `CHANGELOG.md`, `PROJECT_HANDOFF.md`를 갱신한다.
   - 첫 화면 업데이트 안내 팝업(`src/components/common/WhatsNewModal.tsx`)도 매 업데이트마다 최신 변경점으로 콘텐츠를 갱신하고 `CURRENT_APP_VERSION` 버전 키(`WHATS_NEW_DISMISSED_STORAGE_KEY`)가 함께 올라가 새 버전 배포 시 `다시 보지 않기`를 눌렀던 사용자에게도 자동 재노출되도록 유지한다.
4. 커밋 후 푸시한다. `main`에 직접 푸시하지 않고 `claude/...` 브랜치에 올렸다면, 사용자가 GitHub에서 PR을 머지해야 반영·배포된다는 점을 마지막에 알린다.

## 5. 참고

- 배포: `main` 푸시 → `.github/workflows/deploy.yml` → GitHub Pages. Supabase 키는 GitHub Secret으로만 주입된다.
- 멀티플레이 DB 스키마는 `supabase/schema.sql`에 있다. 스키마를 바꾸면 사용자가 Supabase SQL Editor에서 실행할 SQL을 따로 안내한다.
- 싱글 플레이 시즌 로직은 `src/store/GameContext.tsx`(유저 구단 1개 전제), 멀티 리그는 `src/engine/mpLeague*.ts`(방장 권위형)로 분리되어 있다.
