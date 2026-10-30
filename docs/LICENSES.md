# 라이선스 감사

## 오픈소스 (앱 번들)
`npm run licenses --workspace app`(빌드 시 자동)으로 `app/src/legal/oss-licenses.json`을 만들고 앱 설정 > 오픈소스 라이선스에 표시한다. 허용 목록 밖 라이선스가 있으면 빌드가 실패한다.

2026-10-30 결과: 런타임 13개 — MIT 11, ISC 1, Apache-2.0 1(`@apps-in-toss/web-framework` 3.9.0). GPL/AGPL 없음.

| 확인 필요 | 내용 |
|---|---|
| `@apps-in-toss/web-framework` | package.json `license: Apache-2.0`, LICENSE 파일 포함. 앱인토스 이용약관상 추가 조건이 있는지 콘솔 약관으로 확인 |
| `@apps-in-toss/ait-format*` | license 필드 없음 — CLI(빌드 도구) 의존성이라 앱 번들에는 포함되지 않음(D-020) |
| TDS(`@toss/tds-*`) | 사용하지 않음 |

## 데이터
`docs/DATA_SOURCES.md` 참고. 현재 데모 데이터만 사용, 공공데이터 출처 문구는 실데이터 적용 시 앱 설정 > 데이터 출처와 상세 화면 하단에 자동 표시(`graph.sources[].attribution`).

## 브랜드 에셋
| 파일 | 출처 | 비고 |
|---|---|---|
| `assets/brand/icon-source.webp` | 사용자 제공 「사잇」 앱 아이콘(APP_ICON) | 원본. 제작 도구·권리 관계는 사용자 확인 필요 |
| `assets/brand/console-icon-600.png`, `app/public/brand/*.png`, `app/public/favicon.png` | 위 원본에서 `scripts/build-app-icons.py`로 자르기·리사이즈 | 다시 그리지 않음 |
| `docs/design/ui-reference-2.webp` | 사용자 제공 UI 시안 2번(UI_REFERENCE_2) | 디자인 참고용, 앱 번들에 포함하지 않음 |

## 폰트
외부 폰트 미포함. 기기 기본 산세리프(Apple SD Gothic Neo / Noto Sans KR / 맑은 고딕 등) 사용.
