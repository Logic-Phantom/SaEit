// 개별 이동 경로: 지도 없이 세로 타임라인(출발 → 노선 구간/환승 → 도착).
import { Navigate, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Avatar, Disclaimer, EstimatedChip, LineBadge, PageHeader } from '../components/ui';
import { graph, stationName } from '../data/graph';
import { useResult } from '../features/results/useResult';
import { minutes, participantName } from '../lib/format';

export function RouteView() {
  const r = useResult();
  const [params] = useSearchParams();
  const p = Number(params.get('p'));
  if (!r || !r.selected || !Number.isInteger(p) || p < 0 || p >= r.starts.length) return <Navigate to="/" replace />;
  const c = r.selected;
  const route = r.route(p, c)!;
  const lineOf = (i: number) => graph.raw.lines[i];

  return (
    <main className="page">
      <PageHeader title="경로 보기" />
      <section className="route-head">
        <Avatar index={p} />
        <div>
          <p className="person__name">{participantName(r.payload.n, p)} <span className="sub">({stationName(r.starts[p])} → {stationName(c.stationIdx)})</span></p>
          <p className="person__meta">약 {minutes(route.sec)}분 · {route.transfers === 0 ? '환승 없음' : `${route.transfers}회 환승`} {route.estimated && <EstimatedChip />}</p>
        </div>
      </section>

      <ol className="timeline card card--pad" aria-label="이동 순서">
        <li className="tl-stop">
          <span className="tl-dot" style={{ borderColor: route.steps[0]?.kind === 'ride' ? lineOf(route.steps[0].lineIdx).color : 'var(--color-blue)' }} />
          <span className="tl-stop__name">{stationName(r.starts[p])}</span>
          <span className="chip">출발</span>
        </li>
        {route.steps.length === 0 && (
          <li className="tl-note">출발역이 바로 모임 장소예요.</li>
        )}
        {route.steps.map((s, i) =>
          s.kind === 'ride' ? (
            <li key={i} className="tl-ride" style={{ ['--tl-color' as string]: lineOf(s.lineIdx).color }}>
              <div className="tl-ride__info">
                <LineBadge lineIdx={s.lineIdx} /> <strong>{lineOf(s.lineIdx).name}</strong>
                <span className="sub"> · {s.stops}개 역 · 약 {minutes(s.sec)}분</span>
                {s.estimated && <> <EstimatedChip /></>}
              </div>
              <div className="tl-stop tl-stop--inline">
                <span className="tl-dot" style={{ borderColor: lineOf(s.lineIdx).color }} />
                <span className="tl-stop__name">{stationName(s.toStation)}</span>
                {i === route.steps.length - 1 && <span className="chip chip--brand">도착</span>}
              </div>
            </li>
          ) : (
            <li key={i} className="tl-transfer">
              <Icon name="walk" size={16} />
              <span>환승 {lineOf(s.fromLine).short} → {lineOf(s.toLine).short} · 약 {minutes(s.sec)}분{s.estimated ? ' (도보+대기 기본값)' : ''}</span>
            </li>
          ),
        )}
      </ol>

      <div style={{ marginTop: 'var(--space-5)' }}><Disclaimer /></div>
    </main>
  );
}
