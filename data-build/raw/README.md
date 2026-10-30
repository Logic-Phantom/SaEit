# data-build/raw

Phase 0에서 내려받은 공공데이터 원본을 **수정하지 않고** 둔다. 파일명에 기준일을 넣는다(예: `seoul-sections_2026-10-01.csv`).
서비스 키가 필요한 API 응답은 키를 지운 뒤 저장한다. 키는 `.env`(커밋 금지)에만 둔다.
목록·컬럼·이용허락은 `docs/DATA_SOURCES.md`에 기록한다.
