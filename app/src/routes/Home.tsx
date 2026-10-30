import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { AvatarStack, DemoNotice, StationLines, TabBar } from '../components/ui';
import { graph } from '../data/graph';
import { shortDate } from '../lib/format';
import { useApp } from '../state/AppState';

const asset = (p: string) => `${import.meta.env.BASE_URL}${p}`;

export function Home() {
  const navigate = useNavigate();
  const { history } = useApp();
  const recent = history.slice(0, 3);
  return (
    <main className="page page--with-tabbar home">
      <div className="home__glow" aria-hidden="true" />
      <section className="home__hero">
        <img className="home__wordmark" src={asset('brand/wordmark.png')} alt="사잇" width={168} height={92} />
        <p className="home__tagline">우리 사이를 잇다</p>
        <p className="home__desc">2~6명의 출발역을 입력하면<br />모두 비슷하게 걸리는 중간역을 찾아드려요.</p>
      </section>

      <div className="stack home__actions">
        <button type="button" className="btn btn--primary btn--block" onClick={() => navigate('/input')}>
          중간역 찾기 <Icon name="arrowRight" size={18} />
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => navigate('/join')}>
          <Icon name="link" size={18} /> 공유 링크로 참여하기
        </button>
      </div>

      {recent.length > 0 && (
        <section aria-labelledby="recent-title">
          <h2 id="recent-title" className="section-title">최근 이용 기록</h2>
          <ul className="list card">
            {recent.map((h) => {
              const idx = graph.stationById.get(h.topStationId)!;
              return (
                <li key={h.query}>
                  <button type="button" className="list-row" onClick={() => navigate(`/result?${h.query}`)}>
                    <span className="list-row__body">
                      <span className="list-row__title">{graph.raw.stations[idx].name} <StationLines stationIdx={idx} /></span>
                      <span className="list-row__meta" style={{ display: 'block' }}>{shortDate(h.at)} · {h.count}명</span>
                    </span>
                    <AvatarStack count={h.count} />
                    <Icon name="chevron" size={18} className="list-row__chev" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div style={{ marginTop: 'auto', paddingTop: 'var(--space-6)' }}>
        <DemoNotice />
      </div>
      <TabBar />
    </main>
  );
}
