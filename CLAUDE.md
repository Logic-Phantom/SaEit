# 사잇 작업 규칙 (요약)

- 판단 순서: 무료 한도 > 라이선스·정책·개인정보 > 계산 정확성 > 기능 > 디자인.
- 앱인토스 API는 추측하지 않는다: `https://developers-apps-in-toss.toss.im/llms.txt` 문서와 설치된 `node_modules/@apps-in-toss/web-framework/dist/*.d.ts`로 확인하고 `docs/DECISIONS.md`에 근거를 남긴다.
- `data-build/raw/` 원본은 수정 금지. `app/src/data/graph.v1.json`·`docs/COVERAGE.md`·`data-build/station-ids.json`은 `npm run data:build` 산출물로만 바꾼다. 역 ID는 한 번 정하면 바꾸지 않는다.
- `app/src/engine/`은 순수 TS(DOM·SDK 의존 금지).
- 공유 링크 입력은 신뢰하지 않는다: 역ID 화이트리스트, 2~6명, 닉네임 규칙, 실패 시 조용히 홈으로.
- 로그에 닉네임·역 조합을 남기지 않는다.
- 소요시간은 "표준 운행시간 기준 추정치". "정확한 도착 시간" 같은 표현 금지. 공식 노선도·운영기관 로고·노선 심볼 금지.
- 색·간격은 `app/src/styles/design-tokens.css` 토큰만 쓴다.
- 상태는 `구현` / `자동 테스트 통과` / `샌드박스 확인` / `토스앱 확인`으로 구분해 README 상태표에 기록. 확인하지 않은 것을 완료로 보고하지 않는다.
- 결정은 `docs/DECISIONS.md`, 작업 내역은 README 맨 아래 Work Log에 마지막으로 갱신.
- 커밋·푸시·콘솔 업로드·출시 요청은 사용자 승인 후에만.
- 검사: `npm test`, `npm run typecheck`, `npm run build`.
