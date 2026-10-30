import { Navigate, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Disclaimer, EstimatedChip, PageHeader, StationLines } from '../components/ui';
import { graph } from '../data/graph';
import { useResult, withCandidate } from '../features/results/useResult';
import { minutes } from '../lib/format';

export function Candidates() {
  const r = useResult();
  const navigate = useNavigate();
  if (!r) return <Navigate to="/" replace />;
  return (
    <main className="page">
      <PageHeader title="다른 후보 역" />
      <p className="sub" style={{ marginBottom: 'var(--space-4)' }}>비슷하게 걸리는 다른 역도 있어요. 가장 오래 걸리는 시간이 짧은 순서예요.</p>
      <ul className="stack list-plain" aria-label="후보 역 목록">
        {r.results.map((c, rank) => (
          <li key={c.stationIdx}>
            <button type="button" className="card candidate" onClick={() => navigate(`/detail?${withCandidate(r.query, c.stationIdx)}`)}>
              <span className={`candidate__rank${rank === 0 ? ' is-top' : ''}`} aria-label={`${rank + 1}순위`}>{rank + 1}</span>
              <span className="candidate__body">
                <span className="candidate__name">{graph.raw.stations[c.stationIdx].name}</span>
                <span className="candidate__meta">최대 {minutes(c.maxSec)}분 · 평균 {minutes(c.avgSec)}분 · 환승 {c.totalTransfers}회</span>
                <span className="badges">
                  <StationLines stationIdx={c.stationIdx} />
                  {c.estimated && <EstimatedChip />}
                </span>
              </span>
              <Icon name="chevron" size={18} className="list-row__chev" />
            </button>
          </li>
        ))}
      </ul>
      <div style={{ marginTop: 'var(--space-6)' }}><Disclaimer /></div>
    </main>
  );
}
