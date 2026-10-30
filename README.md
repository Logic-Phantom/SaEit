# 사잇 - 우리 사이를 잇다

<img src="assets/brand/console-icon-600.png" alt="사잇 앱 아이콘" width="96" />

2~6명이 각자 출발역을 넣으면 **가장 오래 걸리는 사람의 시간이 가장 짧은 역**(최대 소요시간 최소화)을 추천하고, 각자 몇 분·몇 번 환승인지 나란히 보여 주는 **토스 미니앱(앱인토스 WebView)**.

> **현재 상태 (2026-10-30)**: 엔진·데이터 빌드·전체 화면 구현, 자동 테스트 37개 통과, `.ait` 빌드 성공. **범위 C(수도권 전체) 17개 노선·역 535개**, 시간은 서울교통공사 공식 운행시간 + 국토교통부(TAGO) 평일 시간표로 산출. **Phase 0 커버리지 게이트 통과**(13개 주요 노선 95~100%). 남은 게이트는 정확도 20경로(지도 앱 값 입력 대기). 앱인토스 샌드박스·토스앱 확인은 아직 하지 않았다.

## 상태표
`구현` = 코드 있음 · `자동 테스트 통과` · `브라우저 확인` = Vite 개발 서버 360px · `샌드박스 확인` · `토스앱 확인`

| 영역 | 상태 | 비고 |
|---|---|---|
| Phase 0 원본 수집 | ✅ 완료 | `npm run data:fetch` — 9종(로그인 불필요 파일데이터), `docs/DATA_SOURCES.md` |
| Phase 0 커버리지 게이트(주요 노선 시간 보유율 ≥ 80%) | ✅ 통과 | 13개 주요 노선 95~100% — `docs/COVERAGE.md` |
| 시간표(TAGO) 수집·역간 시간 산출 | ✅ 실행 | 역 444/444, 시간표 888개 → 추정 구간 365개 중 360개 산출. 공식값 대비 중앙값 +30초(정차 포함) |
| Phase 0 정확도 게이트(20경로 평균 오차 ≤ 5분) | ⏳ 입력 대기 | 엔진 값 채움, 지도 앱 값은 사용자 입력 — `docs/ACCURACY.md` |
| 데이터 빌드(어댑터 6종·정규화·동명이역·거리 모델·검증·COVERAGE·ACCURACY 생성) | 자동 테스트 통과 | 서울교통공사 시간·환승, 국가철도공단 거리(코레일 해석 규칙 D-032), 신분당선 역 순서 |
| 엔진(다익스트라·후보 평가·정렬·공평 점수·경로 복원) | 자동 테스트 통과 | 6명 × 278역 0.6 ms(Node, 데스크톱). 535역은 자동 테스트 상한 200ms 안 |
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
npm run data:fetch
```
```bash
npm run data:build
```
```bash
npm run data:accuracy
```
시간표 수집(`.env`에 `TAGO_SERVICE_KEY` 필요, `.env.example` 참고) 후 `npm run data:build`를 다시 실행하면 추정 구간이 시간표 값으로 바뀐다:
```bash
npm run data:tago
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
  fetch-raw(포털·열린데이터 다운로드) ─▶ raw/*.csv(CP949 원본 그대로)
  ─▶ sources/ seoul-metro-runtime(1~8호선 시간) · transfers(환승 보행) · krna-distance(9호선·공항철도 거리)
  ─▶ normalize-station(역명·부역명 별칭·같은 역 매핑·초성)
  ─▶ estimate(거리 → 시간 회귀 sec = 23.9 + 63.2·km) ─▶ build-graph(노드=(역,노선), 주행·환승 간선, 역ID 레지스트리)
  ─▶ validate(연결 요소·0초·중복·환승 누락) ─▶ app/src/data/graph.v1.json + docs/COVERAGE.md
  ─▶ accuracy(앱 엔진으로 기준 20경로 계산) ─▶ docs/ACCURACY.md

[미니앱]  app/ (Vite + React + TS + @apps-in-toss/web-framework 3.9.0, CSR, 해시 라우팅)
  engine/    순수 함수: prepareGraph · shortestFromStation(멀티 소스, 시간→환승 사전순) · evaluate · routeTo
  features/  share(링크 코덱·검증) · station-search(초성/부분 일치) · results(useResult)
  platform/  toss.ts — 토스 안이면 SDK(Share·Clipboard·Environment), 밖이면 브라우저 대체
  storage/   kv.ts(토스 Storage ↔ localStorage 어댑터) · records.ts(기록 20개·최근 역 8개)
  routes/    Home · Input · Search · Result · Candidates · Detail · RouteView · Share · Join · History · Settings
  styles/    design-tokens.css(색·간격·타이포·모서리) · app.css · screens.css

공유 링크 = intoss://saeit/result?v=1&s=S0012,S0450&n=민지,준호&m=all&t=1   ← 서버 없음
```
- 그래프를 앱 번들에 넣는다(현재 163.5 KB, gzip 전): 네트워크·CORS·서버 0.
- 방장이 모두의 출발역을 넣고 결과를 링크로 공유 → 받은 사람도 같은 결과. "나도 추가"는 참가자를 더한 **새 링크**를 만든다.
- 결정과 근거는 `docs/DECISIONS.md`(D-001~D-036).

## 프로젝트 구조
```
saeit/
├─ README.md · CLAUDE.md · package.json(workspaces)
├─ assets/brand/          icon-source.webp(사용자 제공 원본) · console-icon-600.png(콘솔 업로드용)
├─ docs/                  DECISIONS · DATA_SOURCES · COVERAGE(자동) · ACCURACY · TOSS_COMPLIANCE · LICENSES · PRIVACY · TESTING
│  └─ design/ui-reference-2.webp   UI_REFERENCE_2(디자인 참고, 번들 미포함)
├─ data-build/            src/{fetch-raw,csv,sources/*,normalize-station,estimate,validate,report,build-graph,accuracy}.ts · raw/(공공데이터 원본) · fixtures/demo-lines.json · station-ids.json · tests/
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
6. **1순위 소스(15134768) 내용 불일치**(Phase 0에서 발견): 포털 설명과 달리 100행·거리만 있고 소요시간이 없다 → 서울 열린데이터광장 OA-12034를 주행 시간 소스로 씀(D-022).

## Phase 0 결과 (2026-10-30)
**수집**: 로그인 없이 받을 수 있는 원본 9종을 `data-build/raw/`에 저장(`npm run data:fetch`). 컬럼·이용허락·쓰는 이유/안 쓰는 이유는 `docs/DATA_SOURCES.md`.

**그래프**: 역 278 · 노드 329 · 간선 756(81.6 KB), 검증 통과. 환승역 45곳, 환승 간선 114개 중 110개는 실측 보행시간(+대기 3분 가정), 4개는 기본값(9호선↔공항철도).

| 게이트 | 결과 |
|---|---|
| 주요 노선 시간 데이터 보유율 ≥ 80% | **미달** — 1~8호선 100% / 9호선·공항철도 0%(거리 기반 추정) / 신분당·수인분당·경의중앙 데이터 없음 |
| 기준 20경로 평균 오차 ≤ 5분 | **입력 대기** — `docs/ACCURACY.md`에 지도 앱 값만 넣고 `npm run data:accuracy` |

프롬프트 규칙에 따라 범위 축소안을 제시했고, **사용자가 C(수도권 전체)를 골랐다**(D-031). 진행 상황은 아래 "범위 C 진행".

| 안 | 범위 | 장점 | 위험·필요한 것 |
|---|---|---|---|
| **A (추천)** | 서울교통공사 1~8호선(서울 구간) + 9호선·공항철도를 "추정 포함"으로 표시 — **현재 번들 상태** | 서울 도심 대부분의 약속 장소를 커버, 추가 데이터 없이 바로 진행 | 9호선·공항철도 시간 오차(급행 미반영, 정확도 표로 확인), 신분당·수인분당 이용자는 출발역 선택 불가 |
| B | 서울교통공사 1~8호선만 | 모든 시간이 실측 | 9호선(강서·여의도·강남) 사용자 누락이 큼 |
| C | A + 9호선·공항철도·코레일 시간표 수집 후 전체 수도권 | 프롬프트 원래 범위 | TAGO 지하철 시간표 API 활용신청(서비스 키), 코레일 파일 해석 규칙·동명이역 표 작업 필요 |

### 범위 C 진행 (2026-10-30)
- **넣은 것**: 코레일 통합 거리 파일 해석(1호선 코레일 구간, 3호선 대화~삼송, 4호선 과천·안산선, 수인분당·경의중앙·경춘·경강·서해선), 에버라인, 신분당선(역 순서만), 동명이역 구분(경의중앙선 양평·신촌). 그래프 17개 노선·역 535·간선 1550, 검증·위상 점검 통과.
- **시간**: 서울교통공사 구간만 실측. 나머지는 거리 회귀 또는 기본값 추정 → TAGO 시간표로 대체할 준비 완료(`tago/fetch.ts` 수집, `tago/times.ts` 같은 종점 열차 짝짓기 중앙값, `tago/apply.ts` 반영).
- **알려진 추정 오차**: 신분당선은 거리도 없어 역간 120초 → 판교→강남 엔진 8분(실제보다 크게 짧을 가능성). 코레일 노선은 서울교통공사 구간으로 적합한 회귀식을 써서 정차 시간이 긴 노선은 짧게 나올 수 있다.
- **아직 없음**: 4호선 진접선, 8호선 별내선, 우이신설·신림·김포골드·인천1·2·의정부·GTX-A(원본에 역 목록 없음).

### TAGO 시간표 반영 (2026-10-30)
- 서비스 키로 역 444개·평일 시간표 888개(31 MB, git 제외)를 받아 365개 추정 구간 중 360개를 시간표로 바꿨다. 결과만 `data-build/derived/tago-pair-times.json`(24 KB)으로 커밋한다.
- 방법 검증: 같은 구간을 공식값(OA-12034)과 비교하면 중앙값 +30초 — 시간표는 출발→출발이라 다음 역 정차가 포함된다(D-040). 회차역(사당→남태령 등)은 최대 +240초.
- 남은 확인: 공항철도 인천공항1터미널→서울역 49분(일반열차 기준 짧을 수 있음), 급행 미반영, 정차 시간 기준 통일 여부 → 정확도 20경로로 판단.

## 사용자가 할 일
1. ~~범위 결정~~ → C 선택 완료.
2. ~~TAGO 서비스 키~~ → `.env`와 GitHub Secrets(`TAGO_SERVICE_KEY`)에 등록 완료. 시간표를 새로 받을 때는 `npm run data:tago` 또는 Actions의 Data Build에서 `refresh_tago` 체크.
3. `docs/ACCURACY.md` 20경로의 "지도 앱(분)·지도 앱 환승" 두 칸을 지도 앱으로 확인해 입력 → `npm run data:accuracy`.
4. 앱인토스 콘솔 등록 → `appName` 확정(기본 제안 `saeit`), 앱 아이콘에 `assets/brand/console-icon-600.png` 업로드, 검색 키워드 "중간역, 중간지점, 약속장소, 모임장소" 입력, `.ait` 업로드·QR 테스트.
5. KIPRIS에서 '사잇' 상표(9·39·42류) 확인.
6. 광고 수익 누적 5,000원 초과 시 사업자 등록(5영업일 유예) — Phase 4 이후.

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

### 2026-10-30 — Phase 0: 공공데이터 수집·실데이터 그래프·커버리지·정확도 표
- **수집**: `data-build/src/fetch-raw.ts` 추가(포털 '다운로드' 버튼과 같은 요청 흐름, 1.5초 간격, 보안문자 요구 시 중단). 공공데이터포털 8종 + 서울 열린데이터광장 OA-12034 저장. 15119345는 다운로드 버튼이 없어 받지 못함.
- **발견**: 1순위로 잡았던 15134768(서울특별시_철도역 구간)은 100행·거리만·소요시간 없음 → 주행 시간 소스를 OA-12034(서울교통공사 1~8호선 279구간, mm:ss)로 변경(D-022). 코레일 통합 거리 파일은 노선 반복·구간 생략·지선 덧붙임 형식이라 보류(D-025).
- **만든 것**: CSV(CP949) 파서, 어댑터 3종(서울교통공사 시간·지선 분기, 환승 보행시간, 국가철도공단 거리), 역명 정규화 확정(부역명 별칭, 이수=총신대입구), 거리 → 시간 회귀(sec = 23.9 + 63.2·km, 평균 오차 11초), 환승 = 보행 + 대기 180초, COVERAGE 게이트 표, `data-build/src/accuracy.ts`(앱 엔진으로 20경로 계산, 사용자 입력값 보존), 앱 지원 범위 안내(그래프 `note`).
- **명령·결과**: `npm run data:fetch` 9종 ✔ · `npm run data:build` 역 278/노드 329/간선 756, 검증 통과 · `npm test` data-build 11 + app 20 통과 · `npm run typecheck` 오류 0 · 엔진 6명 × 278역 0.6 ms(Node) · 브라우저에서 실데이터 결과 확인(강남·홍대입구·청량리 → 약수 최대 18분).
- **게이트**: 커버리지 **미달**(9호선·공항철도 거리 추정, 신분당·수인분당·경의중앙 없음), 정확도 **지도 앱 값 입력 대기** → 범위 축소안 A/B/C 제시.
- **검증하지 못한 것**: 실제 소요시간과의 비교(사용자 입력 필요), 6호선 응암순환 단방향 영향, 토스앱 동작.
- **GitHub**: `main`에 커밋·푸시.

### 2026-10-30 — 범위 C(수도권 전체): 코레일·에버라인·신분당선 연결, 시간표 수집 준비
- **결정**: 사용자가 범위 C 선택(D-031).
- **만든 것**: `sources/korail-distance.ts`(반복 묶음 중복 제거·생략 구간 보정·분기/지선 끝 규칙, D-032), 동명이역 표(D-033), 에버라인 연결, 신분당선 역 순서 수동 목록(D-034), 환승 노선 매핑 확장(경의중앙·수인분당·경춘·서해·신분당·경원선), TAGO 시간표 수집·산출·반영(`tago/*.ts`, D-035·D-036 — 응답 필드는 포털 Swagger 정의로 확인), `.env.example`, 정확도 기준 경로를 게이트 노선 위주로 교체.
- **명령·결과**: `npm run data:build` 17개 노선·역 535·노드 651·간선 1550·163.5 KB, 검증 통과 · 노선 위상 점검(종점·분기역) 실제와 일치 · `npm test` data-build 16 + app 20 통과 · `npm run typecheck` 오류 0 · `npm run data:tago`는 키가 없어 안내만 출력 · 브라우저에서 판교·수원·홍대입구 → 신도림(최대 37분, 추정 포함).
- **게이트**: 커버리지 미달 8개 노선(시간표 수집 전), 정확도 지도 앱 값 입력 대기.
- **검증하지 못한 것**: TAGO 실제 호출(서비스 키 없음 — 노선 이름 문자열·역 ID 매칭·페이지 수), 시간표 기반 시간의 정확도, 토스앱 동작.
- **GitHub**: `main`에 커밋·푸시.

### 2026-10-30 — TAGO 시간표 수집·반영, 커버리지 게이트 통과
- **키**: 사용자 제공 키(URL 인코딩 값)를 디코딩해 `.env`에 저장(git 제외 확인). 사용자가 GitHub Secrets에 `TAGO_SERVICE_KEY` 등록. `data-build.yml`에 `refresh_tago` 옵션 추가(시크릿 사용). 원본 시간표는 git 제외, 산출 결과만 커밋(D-037).
- **실제 응답 확인**(D-038): 노선 이름 짧은 표기, 역명 부역명 괄호, `arrTime` '0' 존재, 종점 이름 빈 행 약 5%.
- **수정**: 노선 이름 완전 일치(‘1호선’이 부산·대전·인천1호선까지 잡던 문제), 수도권 밖 역 ID 제외, 바뀐 역명(불암산(당고개)) 매칭, 종점 ID 기준 짝짓기, **방향 다수결**(행별 판단 시 1호선 서울 구간이 약 500초로 틀리던 문제, D-039), 앱 지원 범위 안내·출처 문구.
- **명령·결과**: `npm run data:tago` 역 444/444·시간표 888개 · `npm run data:build` 360/365 구간 반영, 역 535·간선 1550·164.6 KB, 검증 통과 · 공식값 대비 중앙값 +30초 · 커버리지 게이트 **통과** · `npm test` data-build 17 + app 20 통과 · `npm run typecheck` 오류 0 · 빌드·`.ait` 성공 · 브라우저 판교·수원·홍대입구 → 대림(최대 44분).
- **검증하지 못한 것**: 정확도 20경로(지도 앱 값), 급행·휴일 시간표, 토스앱 동작.
- **GitHub**: `main`에 커밋·푸시.
