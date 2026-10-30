import { useEffect, useRef } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { DemoNotice, Disclaimer, EstimatedChip, PageHeader, StationLines } from '../components/ui';
import { graph } from '../data/graph';
import { MAX_PARTICIPANTS } from '../engine';
import { encodePayload } from '../features/share/codec';
import { useResult, withCandidate } from '../features/results/useResult';
import { minutes, participantName } from '../lib/format';
import { draftFromPayload, useApp } from '../state/AppState';

export function Result() {
  const r = useResult();
  const navigate = useNavigate();
  const location = useLocation();
  const { saveHistory, setDraft } = useApp();
  const saved = useRef(false);
  const top = r?.results[0];

  useEffect(() => {
    if (!r || !top || saved.current) return;
    saved.current = true;
    saveHistory(r.payload, graph.raw.stations[top.stationIdx].id);
  }, [r, top, saveHistory]);

  if (!r) return <Navigate to="/" replace />;

  const fromInput = (location.state as { save?: boolean } | null)?.save === true;

  if (!top) {
    return (
      <main className="page">
        <PageHeader title="추천 결과" />
        <div className="empty">
          <Icon name="pin" size={30} />
          <p className="empty__title">조건에 맞는 역을 찾지 못했어요</p>
          <p className="sub">{r.excludedUnreachable > 0 ? '일부 노선은 아직 지원하지 않아 계산할 수 없었어요.' : '추천 기준을 바꿔 다시 찾아보세요.'}</p>
        </div>
        {r.payload.m !== 'all' && (
          <button type="button" className="btn btn--primary btn--block" onClick={() => navigate(`/result?${encodePayload({ ...r.payload, m: 'all' })}`, { replace: true })}>
            모든 역에서 다시 찾기
          </button>
        )}
      </main>
    );
  }

  const st = graph.raw.stations[top.stationIdx];
  const addMe = () => {
    setDraft(() => draftFromPayload(r.payload, true));
    navigate('/input');
  };

  return (
    <main className="page result">
      <PageHeader title="추천 결과" />
      <p className="result__lead">모두에게 가장 공평한 역이에요!</p>

      <section className="card card--pad result-hero" aria-labelledby="top-station">
        <div className="result-hero__title">
          <span className="result-hero__icon" aria-hidden="true"><Icon name="pin" size={22} strokeWidth={2.1} /></span>
          <div>
            <h2 id="top-station" className="result-hero__name">{st.name}</h2>
            <StationLines stationIdx={top.stationIdx} />
          </div>
        </div>
        <p className="result-hero__caption">가장 오래 걸리는 사람도</p>
        <p className="result-hero__time">약 <strong>{minutes(top.maxSec)}</strong>분</p>
        <div className="chips" style={{ justifyContent: 'center' }}>
          <span className="chip chip--brand">공평 점수 {top.fairness} (참고)</span>
          {top.estimated && <EstimatedChip />}
        </div>
        <dl className="stats">
          <div><dt>최대 소요시간</dt><dd>{minutes(top.maxSec)}분</dd></div>
          <div><dt>평균 소요시간</dt><dd>{minutes(top.avgSec)}분</dd></div>
          <div><dt>총 환승 수</dt><dd>{top.totalTransfers}회</dd></div>
        </dl>
        <ul className="per-list" aria-label="참가자별 소요시간">
          {top.per.map((p, i) => (
            <li key={i}>
              <span>{participantName(r.payload.n, i)} <span className="sub">({graph.raw.stations[r.starts[i]].name})</span></span>
              <span>{minutes(p.sec)}분 · 환승 {p.transfers}회</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="stack" style={{ marginTop: 'var(--space-5)' }}>
        <button type="button" className="btn btn--primary btn--block" onClick={() => navigate(`/detail?${withCandidate(r.query, top.stationIdx)}`)}>
          상세 경로 보기 <Icon name="arrowRight" size={18} />
        </button>
        <div className="btn-row">
          <button type="button" className="btn btn--secondary" onClick={() => navigate(`/share?${withCandidate(r.query, top.stationIdx)}`)}>공유하기</button>
          <button type="button" className="btn btn--secondary" onClick={() => navigate(`/candidates?${r.query}`)} disabled={r.results.length < 2}>다른 후보 보기</button>
        </div>
        {!fromInput && r.payload.s.length < MAX_PARTICIPANTS && (
          <button type="button" className="btn btn--ghost" onClick={addMe}><Icon name="plus" size={18} /> 나도 추가해서 다시 찾기</button>
        )}
      </div>

      <div className="stack" style={{ marginTop: 'var(--space-6)' }}>
        {r.excludedUnreachable > 0 && <p className="notice notice--warn">일부 노선은 아직 지원하지 않아 후보에서 뺐어요.</p>}
        <Disclaimer />
        <DemoNotice />
        <p className="sub" style={{ textAlign: 'center' }}>우리의 거리를 잇는 약속.</p>
      </div>
    </main>
  );
}
