# 사잇 - 우리 사이를 잇다

<img src="assets/brand/console-icon-600.png" alt="사잇 앱 아이콘" width="96" />

2~6명이 각자 출발역을 넣으면 **가장 오래 걸리는 사람의 시간이 가장 짧은 역**(최대 소요시간 최소화)을 추천하고, 각자 몇 분·몇 번 환승인지 나란히 보여 주는 **토스 미니앱(앱인토스 WebView)**.

> **현재 상태 (2026-10-30)**: 엔진·데이터 빌드·전체 화면 구현, 자동 테스트 25개 통과, `.ait` 빌드 성공. **데이터는 데모(서울 도심 9개 노선 일부, 시간 균일 추정)** — Phase 0 데이터 검증 게이트를 통과하지 않아 **출시할 수 없는 상태**다. 앱인토스 샌드박스·토스앱 확인은 아직 하지 않았다.

## 상태표
`구현` = 코드 있음 · `자동 테스트 통과` · `브라우저 확인` = Vite 개발 서버 360px · `샌드박스 확인` · `토스앱 확인`

| 영역 | 상태 | 비고 |
|---|---|---|
| Phase 0 데이터 검증(공공데이터 수집·커버리지·정확도 20경로) | ❌ 미착수 | 포털 로그인·활용신청 필요(사용자). 양식: `docs/ACCURACY.md` |
| 데이터 빌드(정규화·ID 고정·추정·검증·COVERAGE 생성) | 자동 테스트 통과 | 입력은 데모 어댑터. 실데이터 어댑터는 원본 컬럼 확인 후 |
| 엔진(다익스트라·후보 평가·정렬·공평 점수·경로 복원) | 자동 테스트 통과 | 6명 × 데모 그래프 < 200ms(Node) |
| 홈 / 출발역 입력 / 역 검색(초성·부분·최근) | 브라우저 확인 | |
| 추천 결과 / 다른 후보 / 상세 경로 / 개인 경로 타임라인 | 브라우저 확인 | 지도 없음(세로 타임라인) |
| 공유(링크 생성·복사·공유 시트) | 브라우저 확인 | 토스: `Share.createLink`·`sendMessage` **미확인** |
| 링크로 참여 / 나도 추가해서 다시 찾기 | 구현 | 쿼리 추출·검증은 자동 테스트 통과 |
| 토스 진입 딥링크(`Environment.initialURL`) | 구현 | **토스앱 확인 필요**(D-009) |
| 이용 기록·최근 역(로컬 저장) | 브라우저 확인 | 토스 Storage 재진입 유지 **미확인** |
| 설정(계산 기준·데이터 출처·개인정보·오픈소스 라이선스) | 브라우저 확인 | |
| 앱인토스 설정·`ait build` | 구현 | `saeit.ait` 생성. appName 콘솔 미확정 |
| 인앱 광고(Phase 4) / 공유 세션(Phase 5) / 막차·배차(Phase 6) | ❌ 미착수 | |

## 실행
요구: Node.js 24+
```bash
npm install
```
```bash
npm run dev
```
브라우저에서 `http://localhost:5173` (모바일 폭으로 보기). 그 밖의 명령:
```bash
npm test
```
```bash
npm run typecheck
```
```bash
npm run data:build
```
```bash
npm run build --workspace app
```
앱인토스 업로드용 패키지(`app/saeit.ait`):
```bash
npm run build:ait --workspace app
```
아이콘을 원본에서 다시 만들 때(Pillow 필요):
```bash
python scripts/build-app-icons.py
```

## 아키텍처
```
[데이터 빌드]  data-build/ (Node 24 + TS, 타입 제거 실행)
  raw(공공데이터) ─▶ sources/*.ts 어댑터 ─▶ normalize-station(역명·초성·별칭)
  ─▶ estimate(시간 없는 구간 추정) ─▶ build-graph(노드=(역,노선), 주행·환승 간선, 역ID 레지스트리)
  ─▶ validate(연결 요소·0초·중복·환승 누락) ─▶ app/src/data/graph.v1.json + docs/COVERAGE.md

[미니앱]  app/ (Vite + React + TS + @apps-in-toss/web-framework 3.9.0, CSR, 해시 라우팅)
  engine/    순수 함수: prepareGraph · shortestFromStation(멀티 소스, 시간→환승 사전순) · evaluate · routeTo
  features/  share(링크 코덱·검증) · station-search(초성/부분 일치) · results(useResult)
  platform/  toss.ts — 토스 안이면 SDK(Share·Clipboard·Environment), 밖이면 브라우저 대체
  storage/   kv.ts(토스 Storage ↔ localStorage 어댑터) · records.ts(기록 20개·최근 역 8개)
  routes/    Home · Input · Search · Result · Candidates · Detail · RouteView · Share · Join · History · Settings
  styles/    design-tokens.css(색·간격·타이포·모서리) · app.css · screens.css

공유 링크 = intoss://saeit/result?v=1&s=S0012,S0450&n=민지,준호&m=all&t=1   ← 서버 없음
```
- 그래프를 앱 번들에 넣는다(현재 39.5 KB, gzip 4.5 KB): 네트워크·CORS·서버 0.
- 방장이 모두의 출발역을 넣고 결과를 링크로 공유 → 받은 사람도 같은 결과. "나도 추가"는 참가자를 더한 **새 링크**를 만든다.
- 결정과 근거는 `docs/DECISIONS.md`(D-001~D-021).

## 프로젝트 구조
```
saeit/
├─ README.md · CLAUDE.md · package.json(workspaces)
├─ assets/brand/          icon-source.webp(사용자 제공 원본) · console-icon-600.png(콘솔 업로드용)
├─ docs/                  DECISIONS · DATA_SOURCES · COVERAGE(자동) · ACCURACY · TOSS_COMPLIANCE · LICENSES · PRIVACY · TESTING
│  └─ design/ui-reference-2.webp   UI_REFERENCE_2(디자인 참고, 번들 미포함)
├─ data-build/            src/{sources,normalize-station,estimate,validate,report,build-graph}.ts · fixtures/demo-lines.json · raw/ · station-ids.json · tests/
├─ app/                   apps-in-toss.config.ts · index.html · public/brand/ · src/{engine,data,features,platform,storage,state,components,routes,styles,legal,lib} · tests/
├─ scripts/               build-app-icons.py · generate-oss-licenses.mjs · bundle-size.mjs
└─ .github/workflows/     ci.yml(typecheck·test·build) · data-build.yml(수동, PR 생성, 자동 머지 없음)
```

## 디자인
- 기준: **UI_REFERENCE_2** (`docs/design/ui-reference-2.webp`, 사용자 첨부 원본 복사) — 화이트 베이스, 블루·퍼플·핑크 그라데이션 포인트, 둥근 카드(18px), 아바타 리스트, 하단 탭(홈·기록·설정), 결과 카드(역명·"가장 오래 걸리는 사람도 약 N분"·최대/평균/환승 3칸), 상세 경로 카드, 공유 미리보기 카드, 링크 참여 화면 구조를 그대로 따랐다. 시안 속 역명·시간·지도는 쓰지 않고 실제 계산 결과만 표시한다.
- 앱 아이콘: **APP_ICON** (`assets/brand/icon-source.webp`, 사용자 첨부 원본) 을 `scripts/build-app-icons.py`로 잘라 콘솔 아이콘(600px)·앱 안 로고·**홈 워드마크(글자만 투명 배경)**·파비콘·OG 이미지로 사용. 새로 그리거나 생성하지 않았다. 임시 대체물 없음.
- 시안과 다르게 한 부분(이유는 D-018): 지도 → 세로 타임라인, 카카오톡/메시지 버튼 → 토스 공유 시트 + 링크 복사, 닉네임 입력 참여(세션) → 링크 붙여넣기, FAQ·약관·문의 → 계산 기준 안내.
- 토큰: `app/src/styles/design-tokens.css`. 토스 안에서는 토스 내비게이션 바를 쓰므로 자체 뒤로가기 버튼을 숨긴다.

## 프롬프트 모호·충돌 지점
1. **역 ID 형식**: `S0001`(4자리)이면 9,999역까지. 수도권 전체(약 700역)는 충분하지만 지방 확장(Phase 7) 시 자리 수를 늘리면 기존 링크 검증 정규식과 충돌 → 지금은 4자리로 두고, 늘릴 때 `v=2`로 올린다.
2. **'모이기 좋은 역'** 정의: 승하차 인원 데이터 소스가 §2-1 표에 없다 → 환승역으로 대체(D-006). 승하차 데이터를 쓸지 결정 필요.
3. **공유 미리보기 이미지**: `ogImageUrl`은 https 호스팅이 필요하고, 2026-08 이후 앱 이미지가 자동 표시된다 → 별도 OG 호스팅이 필요한지 토스앱에서 보고 결정.
4. **UI 시안의 지도·메신저 버튼·세션 참여**는 MVP 금지 항목과 충돌 → 구현하지 않음(D-018).
5. **`Environment.initialURL` 형식**: WebView에서 경로·쿼리 파싱 예시가 문서에 없다 → `result?` 뒤를 추출하는 방식으로 구현, 토스앱 확인 필요(D-009).

## Phase 0 계획 (다음 작업)
1. `docs/DATA_SOURCES.md`의 6개 소스를 내려받아 `data-build/raw/`에 기준일 포함 이름으로 저장(로그인·활용신청은 사용자).
2. 파일별 컬럼·노선 범위·운영사 값 기록 → `sources/<소스>.ts` 어댑터 작성 → `build-graph.ts` 입력 교체.
3. 커버리지: `npm run data:build`가 만드는 `docs/COVERAGE.md`의 노선별 시간 데이터 보유율(1~9호선·신분당·수인분당·경의중앙·공항철도 등).
4. 정규화: 괄호 부역명·'역' 접미사·공백 규칙(구현됨) + 동명이역 수동 매핑표.
5. 정확도: `docs/ACCURACY.md` 20경로 표에 사용자가 지도 앱 값 입력 → 엔진 값 비교, 평균 오차 5분 초과 또는 주요 노선 보유율 80% 미만이면 범위 축소안 제시.

## 사용자가 할 일
1. 공공데이터포털 활용신청·파일 내려받기(서비스 키는 `.env`, 커밋 금지).
2. `docs/ACCURACY.md` 20경로를 지도 앱으로 확인해 입력.
3. 앱인토스 콘솔 등록 → `appName` 확정(기본 제안 `saeit`), 앱 아이콘에 `assets/brand/console-icon-600.png` 업로드, 검색 키워드 "중간역, 중간지점, 약속장소, 모임장소" 입력, `.ait` 업로드·QR 테스트.
4. KIPRIS에서 '사잇' 상표(9·39·42류) 확인.
5. 광고 수익 누적 5,000원 초과 시 사업자 등록(5영업일 유예) — Phase 4 이후.

## 문서
| 문서 | 내용 |
|---|---|
| docs/DECISIONS.md | 결정·근거 URL·확인일 |
| docs/DATA_SOURCES.md · COVERAGE.md · ACCURACY.md | 데이터 소스, 커버리지(자동), 정확도 검증 양식 |
| docs/TOSS_COMPLIANCE.md | 비게임 체크리스트 항목별 대응 |
| docs/LICENSES.md · PRIVACY.md · TESTING.md | 라이선스 감사, 개인정보, 테스트 결과 |

## 작업 내역 (Work Log)

### 2026-10-30 — 프로젝트 구조·아키텍처 구성, MVP 화면 구현 (데모 데이터)
기준 문서: `Saeit_Final_SuperPrompt_Design_Integrated.md`(사용자 제공) + UI_REFERENCE_2 + APP_ICON.
- **확인한 것**: 앱인토스 문서(llms.txt → webview 튜토리얼, share.createlink/sendmessage, storage, environment.initialurl, checklist/app-nongame, navigationbar)와 설치된 `@apps-in-toss/web-framework` 3.9.0 타입 정의(`config.d.ts`의 설정 필드, `Share`·`Storage`·`Clipboard`·`Environment` 시그니처, 토스 환경 판별 조건). 참고 프로젝트: Cutpick(README 상태 구분·DECISIONS 형식·`generate-oss-licenses.mjs`·`build-app-icons.py`), StrangeRecords(`.github/workflows`의 workflow_dispatch·summary 패턴), Ddalggak(AGENTS.md 작업 규칙).
- **만든 것**: npm workspaces(`app`, `data-build`) / 데이터 빌드 파이프라인(정규화·초성·별칭, 역 ID 레지스트리, 추정, 검증, COVERAGE 자동 생성) / 데모 노선 목록(9개 노선 일부, 123역) / 순수 TS 엔진 / 공유 링크 코덱(화이트리스트·2~6명·닉네임 규칙) / 역 검색 / 토스↔브라우저 플랫폼·저장소 어댑터 / 디자인 토큰 / 화면 11개(홈·입력·검색·결과·후보·상세·경로·공유·링크 참여·기록·설정+하위 4개) / 아이콘 에셋 생성 스크립트 / 오픈소스 라이선스 생성 스크립트 / 번들 크기 스크립트 / CI·데이터 빌드 워크플로 / 문서 9종.
- **명령·결과**: `npm test` → data-build 5 + app 20 **통과**. `npm run typecheck` 오류 0. `npm run build --workspace app` 성공(JS 405.8 KB, gzip 121.1 KB). `npx ait build` → `saeit.ait` 469 KB. `npm run data:build` → 역 123 · 노드 160 · 간선 384 · 39.5 KB, 검증 통과. 오픈소스 13개(MIT 11·ISC 1·Apache-2.0 1).
- **브라우저 확인**(Vite, 360×740): 홈 → 입력 → 초성 검색 → 결과 → 상세 → 경로 타임라인 → 후보 → 공유 → 기록 → 설정. 모든 화면 가로 스크롤 없음, 콘솔 오류 없음, 잘못된 링크는 홈으로.
- **검증하지 못한 것**: 앱인토스 샌드박스·토스앱 전부(콘솔 미등록), 실데이터 정확도(Phase 0), 실기기 성능·키보드 가림·스크린 리더.
- **GitHub**: `main`에 커밋·푸시(사용자 요청).
