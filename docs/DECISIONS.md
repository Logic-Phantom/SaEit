# 결정 기록 (Decisions)

작은 결정은 안전한 기본값으로 정하고 여기에 남긴다. 확인일은 모두 2026-10-30.

| ID | 결정 | 근거 / 위험 |
|---|---|---|
| D-001 | **Vite 8 + React 19 + TypeScript 7 + `@apps-in-toss/web-framework` 3.9.0**(npm latest), CSR 전용. npm workspaces로 `app/`·`data-build/` 분리 | 앱인토스 규칙: CSR/SSG만(checklist/app-nongame.md). WebView 튜토리얼(ai-vibe-coding/tutorials/webview.md)의 설치 절차. 목록·폼 중심이라 RN 불필요 |
| D-002 | `apps-in-toss.config.ts`는 `npx ait init` 대신 **설치된 패키지의 `config.d.ts` 타입대로 직접 작성**: `appName`, `brand.primaryColor`, `permissions`, `navigationBar`, `webView`, `webBundleDir` | `ait init`은 대화형. 필드는 `node_modules/@apps-in-toss/web-framework/dist/config.d.ts`(3.9.0)로 확인. `ait build`로 `saeit.ait` 생성 확인 |
| D-003 | `appName = 'saeit'`(기본 제안). 콘솔 확정 시 `apps-in-toss.config.ts`와 `src/platform/toss.ts`의 `APP_NAME`을 함께 바꾼다 | 콘솔 등록명과 다르면 업로드 실패(튜토리얼) |
| D-004 | **토스 앱 판별 = `window.ReactNativeWebView != null`**. 밖에서는 SDK를 부르지 않고 브라우저 대체(localStorage, navigator.share/clipboard, 해시 링크) | SDK 3.9.0 `dist/index.js`가 같은 조건으로 "apps-in-toss 웹뷰 환경이 아니에요"를 throw — 공개 API가 아니므로 SDK 업데이트 때 재확인 |
| D-005 | **자체 뒤로가기 버튼은 토스 밖(브라우저 개발)에서만** 그린다. 토스 안에서는 `navigationBar.withBackButton`(토스 내비게이션 바) 사용 | 체크리스트: 토스 뒤로가기와 미니앱 뒤로가기 동시 노출 금지, 파트너 로고 추가 금지(common/navigationbar.md) |
| D-006 | **'모이기 좋은 역' = 2개 이상 노선이 지나는 환승역**(기본), 토글로 모든 역 | 승하차 인원 데이터 미확보(Phase 0 결정 사항). 사용자가 '모든 역에서 찾기'로 확장 가능 |
| D-007 | 정렬: 최대 시간 → 표준편차 → 환승 합 → 시간 합 → 역 순서(결정적). '환승 적은 순 우선'은 ②③ 교환. 다익스트라는 (시간, 환승) 사전순 | 프롬프트 §3. 동점에서 결과가 매번 같도록 마지막 키 고정 |
| D-008 | 공평 점수 = `round(100 × min/max)`, 모두 0초면 100. **정렬에 쓰지 않는 참고 지표**로 "(참고)" 표기 | 프롬프트 §3-5. 점수 산식 확정 전 정확한 점수처럼 보이지 않게 |
| D-009 | **해시 라우팅(`createHashRouter`)**. 토스 진입 시 `Environment.initialURL`을 읽어 `/result?…`면 결과로 이동, 검증 실패 시 홈 | 앱인토스는 dist를 그대로 패키징 → 서버 경로 재작성에 기대지 않음. WebView에서 `initialURL` 경로·쿼리 파싱 예시는 문서에 없음(environment.initialurl.md) → `result?` 뒤 쿼리를 정규식으로 추출하고 **토스앱 실기기 확인 필요** |
| D-010 | 공유 = `Share.createLink({ path: 'intoss://saeit/result?<query>' })` → `Share.sendMessage`. `ogImageUrl`은 https 호스팅 전까지 넘기지 않음 | share.createlink.md / share.sendmessage.md. 미리보기 이미지는 2026-08 업데이트로 앱 이미지·이름 자동 표시 |
| D-011 | 링크 복사 = `Clipboard.setText`(permissions에 `clipboard: write` 선언). 브라우저는 `navigator.clipboard` | SDK 3.9.0 타입: `PermissionFunctionWithDialog` |
| D-012 | 저장 = `Storage.getItem/setItem/removeItem`(토스) / localStorage(브라우저). 모든 호출 try/catch, 저장값은 읽을 때 다시 검증 | storage.md. 사생활 모드·권한 실패 시에도 앱 동작 |
| D-013 | **데모 그래프로 MVP 화면을 먼저 완성**: `data-build/fixtures/demo-lines.json`(서울 도심 9개 노선 일부, 역 순서만) + 역간 120초·환승 300초 균일 추정, 전 구간 `estimated=true`, `graph.demo=true` → 앱 전체에 "데모 데이터" 배너 | 공공데이터 원본은 포털 로그인·활용신청 필요(사용자 할 일 §11-1). **Phase 0 게이트 미통과 — 출시 불가 상태**. 역 순서는 공개된 노선 정보, 시간은 꾸며낸 실측값이 아님을 명시 |
| D-014 | 역 ID는 `data-build/station-ids.json` 레지스트리로 고정(`S0001`…), 새 역만 번호 추가 | 데이터 소스가 바뀌어도 공유 링크 유지(프롬프트 §4) |
| D-015 | 노선 배지 = 둥근 사각 **텍스트 배지**(색 + "2", "신분당"), 색은 자체 지정 | 공식 노선 심볼·운영기관 로고 미사용(프롬프트 §7-2) |
| D-016 | **앱 아이콘·로고는 사용자 제공 APP_ICON 원본에서 잘라 냄**(`scripts/build-app-icons.py`, Pillow): 콘솔용 600px, 앱 내 로고, 워드마크(글자만 투명 배경), 파비콘, OG 이미지. 다시 그리지 않음 | 프롬프트 §1-1. 워드마크는 채도 기반 알파 추출이라 가장자리 반투명 픽셀이 있음(흰 배경에서만 사용) |
| D-017 | 하단 탭(홈·기록·설정)은 **최상위 3개 화면에만** 표시, 작업 흐름(입력→결과→상세→공유) 화면에는 없음 | 프롬프트 내비게이션 원칙. UI_REFERENCE_2의 탭 구성 |
| D-018 | UI_REFERENCE_2의 **지도·카카오톡/메시지 버튼·"닉네임 입력으로 참여(세션)"·자주 묻는 질문·이용약관·문의하기는 구현하지 않음**. 지도 → 세로 타임라인, 공유 → 토스 공유 시트 + 링크 복사, 참여 → 링크 붙여넣기 + "나도 추가해서 다시 찾기"(새 링크), FAQ → "계산 기준 안내" | MVP 범위(지도 SDK 금지, Phase 5 전 세션 금지, 빈 메뉴 금지). 외부 메신저 직접 연동은 앱인토스 외부 링크 규칙 확인 전 보류 |
| D-019 | CTA 그라데이션은 블루→퍼플(#4778F5→#A466F0)까지만, 핑크는 브랜드 장식(아이콘 배경·1순위 배지)에만 | 흰 글자 대비 유지. 보조 텍스트 #747987(흰 배경 4.6:1) |
| D-020 | 오픈소스 목록은 `app/package.json` 런타임 의존성 트리로 생성(`scripts/generate-oss-licenses.mjs`, Cutpick 스크립트 이식). `@apps-in-toss/cli`는 빌드 도구라 제외 | SDK `dist/index.js`가 import하는 것은 `@webview-bridge/web`·`semver`·`valibot`뿐(3.9.0 확인). 결과 13개, MIT 11·ISC 1·Apache-2.0 1 |
| D-021 | data-build는 **Node 24 내장 TS 타입 제거**로 실행(`node src/build-graph.ts`), tsx 등 추가 의존성 없음 | `erasableSyntaxOnly`로 enum·parameter property 금지 |
