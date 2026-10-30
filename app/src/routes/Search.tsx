import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { PageHeader, StationLines } from '../components/ui';
import { graph } from '../data/graph';
import { searchStations } from '../features/station-search/search';
import { useApp } from '../state/AppState';

export function Search() {
  const { slot } = useParams();
  const navigate = useNavigate();
  const { draft, setDraft, recentStations, pushRecentStation } = useApp();
  const [q, setQ] = useState('');
  const key = Number(slot);
  const rowIndex = draft.participants.findIndex((p) => p.key === key);
  const hits = useMemo(() => searchStations(graph.raw.stations, q), [q]);

  if (rowIndex < 0) return <Navigate to="/input" replace />;

  const pick = (stationIdx: number) => {
    const id = graph.raw.stations[stationIdx].id;
    setDraft((d) => ({ ...d, participants: d.participants.map((p) => (p.key === key ? { ...p, stationId: id } : p)) }));
    pushRecentStation(id);
    navigate(-1);
  };

  const recent = recentStations.map((id) => graph.stationById.get(id)).filter((x): x is number => x != null);
  const supported = graph.raw.lines.map((l) => l.name).join(', ');

  return (
    <main className="page">
      <PageHeader title={`참가자 ${rowIndex + 1} 출발역`} />
      <div className="search-box">
        <Icon name="search" size={18} />
        <label className="sr-only" htmlFor="station-q">역 이름 검색</label>
        <input
          id="station-q"
          className="field"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="역 이름 또는 초성 (예: ㄱㄴ)"
          autoFocus
          autoComplete="off"
          enterKeyHint="search"
        />
        {q && (
          <button type="button" className="icon-btn search-box__clear" onClick={() => setQ('')} aria-label="검색어 지우기">
            <Icon name="close" size={16} />
          </button>
        )}
      </div>

      {!q && recent.length > 0 && (
        <section>
          <h2 className="section-title">최근 고른 역</h2>
          <div className="chips">
            {recent.map((i) => (
              <button key={i} type="button" className="chip chip-btn" onClick={() => pick(i)}>{graph.raw.stations[i].name}</button>
            ))}
          </div>
        </section>
      )}

      {q && hits.length > 0 && (
        <ul className="list card search-results" aria-label="검색 결과">
          {hits.map((i) => {
            const st = graph.raw.stations[i];
            return (
              <li key={st.id}>
                <button type="button" className="list-row" onClick={() => pick(i)} aria-label={`${st.name} (${st.lines.map((id) => graph.raw.lines.find((l) => l.id === id)?.name).join(', ')})`}>
                  <span className="list-row__body">
                    <span className="list-row__title">{st.name}</span>
                  </span>
                  <StationLines stationIdx={i} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {q && hits.length === 0 && (
        <div className="empty">
          <Icon name="search" size={28} />
          <p className="empty__title">검색 결과가 없어요</p>
          <p className="sub">지금 지원하는 노선: {supported}</p>
        </div>
      )}

      {!q && recent.length === 0 && (
        <p className="sub" style={{ marginTop: 'var(--space-4)' }}>역 이름 일부(예: 강남)나 초성(예: ㄱㄴ)으로 찾을 수 있어요.</p>
      )}
    </main>
  );
}
