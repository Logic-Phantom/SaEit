import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Avatar, Disclaimer, EstimatedChip, PageHeader, RouteChips, StationLines } from '../components/ui';
import { graph } from '../data/graph';
import { useResult, withCandidate } from '../features/results/useResult';
import { minutes, participantName } from '../lib/format';

export function Detail() {
  const r = useResult();
  const navigate = useNavigate();
  const [order, setOrder] = useState<'time' | 'transfers'>('time');
  if (!r || !r.selected) return <Navigate to="/" replace />;
  const c = r.selected;
  const st = graph.raw.stations[c.stationIdx];
  const rows = c.per.map((p, i) => ({ ...p, i, route: r.route(i, c)! }));
  rows.sort((a, b) => (order === 'time' ? b.sec - a.sec || a.transfers - b.transfers : a.transfers - b.transfers || b.sec - a.sec));
  const rank = r.results.indexOf(c) + 1;

  return (
    <main className="page">
      <PageHeader title="상세 경로" />
      <section className="detail-head">
        <p className="sub">{rank === 1 ? '추천 1순위' : `후보 ${rank}순위`}</p>
        <h2 className="detail-head__name">{st.name} <StationLines stationIdx={c.stationIdx} /></h2>
        <p className="sub">최대 {minutes(c.maxSec)}분 · 평균 {minutes(c.avgSec)}분 · 총 환승 {c.totalTransfers}회 · 공평 점수 {c.fairness}</p>
      </section>

      <div className="segment" role="group" aria-label="정렬">
        <button type="button" aria-pressed={order === 'time'} onClick={() => setOrder('time')}>오래 걸리는 순</button>
        <button type="button" aria-pressed={order === 'transfers'} onClick={() => setOrder('transfers')}>환승 적은 순</button>
      </div>

      <ul className="stack list-plain" aria-label="참가자별 경로">
        {rows.map((p) => (
          <li key={p.i}>
            <button type="button" className="card person" onClick={() => navigate(`/route?${withCandidate(r.query, c.stationIdx, `&p=${p.i}`)}`)}>
              <Avatar index={p.i} />
              <span className="person__body">
                <span className="person__name">{participantName(r.payload.n, p.i)} <span className="sub">({graph.raw.stations[r.starts[p.i]].name})</span></span>
                <span className="person__meta">{minutes(p.sec)}분 · {p.transfers === 0 ? '환승 없음' : `${p.transfers}회 환승`}</span>
                <span className="badges"><RouteChips steps={p.route.steps} />{p.estimated && <EstimatedChip />}</span>
              </span>
              <Icon name="chevron" size={18} className="list-row__chev" />
            </button>
          </li>
        ))}
      </ul>

      <section className="card card--pad" style={{ marginTop: 'var(--space-5)' }}>
        <h3 className="list-row__title" style={{ marginBottom: 'var(--space-2)' }}>이 숫자는 어떻게 나왔나요?</h3>
        <p className="sub">가장 오래 걸리는 사람의 시간이 가장 짧은 역을 먼저 추천해요. 같으면 시간 차이가 작은 역, 환승이 적은 역 순서예요.</p>
        <p className="sub" style={{ marginTop: 'var(--space-2)' }}>공평 점수는 가장 짧게 걸리는 사람 ÷ 가장 오래 걸리는 사람 × 100이에요. 정렬에는 쓰지 않는 참고 지표예요.</p>
      </section>

      <div className="stack" style={{ marginTop: 'var(--space-5)' }}>
        <button type="button" className="btn btn--secondary btn--block" onClick={() => navigate(`/share?${withCandidate(r.query, c.stationIdx)}`)}>
          <Icon name="share" size={18} /> 이 역 공유하기
        </button>
        <Disclaimer />
        <p className="sub">데이터 출처: {graph.raw.sources.map((s) => s.attribution).join(' · ')} <Link className="link" to="/settings/sources">자세히</Link></p>
      </div>
    </main>
  );
}
