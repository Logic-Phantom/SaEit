import { Link, Navigate, useParams } from 'react-router-dom';
import { Icon, type IconName } from '../components/Icon';
import { PageHeader, TabBar } from '../components/ui';
import { graph } from '../data/graph';
import ossLicenses from '../legal/oss-licenses.json';

const asset = (p: string) => `${import.meta.env.BASE_URL}${p}`;
const VERSION = '0.1.0';

export function Settings() {
  const items: { to: string; icon: IconName; label: string }[] = [
    { to: '/settings/how', icon: 'calc', label: '계산 기준 안내' },
    { to: '/settings/sources', icon: 'doc', label: '데이터 출처' },
    { to: '/settings/privacy', icon: 'shield', label: '개인정보 안내' },
    { to: '/settings/licenses', icon: 'info', label: '오픈소스 라이선스' },
  ];
  return (
    <main className="page page--with-tabbar">
      <PageHeader title="설정" back={false} />
      <section className="card about">
        <img src={asset('brand/logo.png')} alt="" width={48} height={48} />
        <div>
          <p className="list-row__title">사잇 - 우리 사이를 잇다</p>
          <p className="list-row__meta">버전 {VERSION} · 데이터 v{graph.raw.version}{graph.raw.demo ? ' (데모)' : ''} · {graph.raw.builtAt}</p>
        </div>
      </section>
      <ul className="list card" style={{ marginTop: 'var(--space-4)' }}>
        {items.map((it) => (
          <li key={it.to}>
            <Link to={it.to} className="list-row" style={{ color: 'inherit', textDecoration: 'none' }}>
              <Icon name={it.icon} size={20} />
              <span className="list-row__body list-row__title">{it.label}</span>
              <Icon name="chevron" size={18} className="list-row__chev" />
            </Link>
          </li>
        ))}
      </ul>
      <TabBar />
    </main>
  );
}

export function SettingsPage() {
  const { page } = useParams();
  if (page === 'how') {
    return (
      <main className="page">
        <PageHeader title="계산 기준 안내" />
        <div className="prose card card--pad">
          <h2>어떤 역을 추천하나요?</h2>
          <p>모두의 출발역에서 각 후보 역까지 가장 빠른 경로를 계산하고, <strong>가장 오래 걸리는 사람의 시간이 가장 짧은 역</strong>을 1순위로 보여 줘요. 평균이 아니라 가장 먼 사람을 기준으로 해서 한 사람만 멀리 오는 일을 줄여요.</p>
          <h2>시간이 같으면?</h2>
          <p>① 사람마다 걸리는 시간 차이가 작은 역 → ② 환승이 적은 역 → ③ 모두의 시간 합이 작은 역 순서예요. '환승 적은 순 우선'을 켜면 ①과 ②의 순서가 바뀌어요.</p>
          <h2>시간은 어떻게 계산하나요?</h2>
          <p>역 사이 표준 운행시간과 환승 시간(도보 + 평균 대기)을 더한 추정치예요. 실시간 도착 정보·지연·급행은 반영하지 않아요. 환승 시간 데이터가 없는 역은 5분으로 계산하고 '추정 포함'으로 표시해요.</p>
          <h2>공평 점수</h2>
          <p>가장 짧게 걸리는 사람 ÷ 가장 오래 걸리는 사람 × 100이에요. 100에 가까울수록 모두 비슷하게 걸려요. 순위를 정하는 데는 쓰지 않는 참고 지표예요.</p>
          <h2>모이기 좋은 역</h2>
          <p>기본으로는 두 개 이상 노선이 지나는 환승역 중에서 찾아요. '모든 역에서 찾기'를 켜면 모든 역이 후보가 돼요.</p>
        </div>
      </main>
    );
  }
  if (page === 'sources') {
    return (
      <main className="page">
        <PageHeader title="데이터 출처" />
        <ul className="stack list-plain">
          {graph.raw.sources.map((s) => (
            <li key={s.id} className="card card--pad">
              <p className="list-row__title">{s.name}</p>
              <p className="list-row__meta">기준일 {s.baseDate} · {s.license}</p>
              <p className="sub" style={{ marginTop: 'var(--space-2)' }}>{s.attribution}</p>
            </li>
          ))}
        </ul>
        <p className="foot-note">노선 색과 배지는 사잇이 자체 지정한 표시이며 운영기관의 공식 노선 심볼이 아니에요. 운영기관과 관련 없는 서비스예요.</p>
      </main>
    );
  }
  if (page === 'privacy') {
    return (
      <main className="page">
        <PageHeader title="개인정보 안내" />
        <div className="prose card card--pad">
          <h2>모으는 정보</h2>
          <p>사잇은 로그인·위치 권한·연락처를 쓰지 않고, 입력한 출발역과 닉네임을 서버로 보내지 않아요. 계산은 모두 이 기기 안에서 해요.</p>
          <h2>기기에 저장하는 정보</h2>
          <p>최근 이용 기록(최대 20개)과 최근 고른 역(최대 8개)을 이 기기에만 저장해요. 이용 기록 화면에서 언제든 지울 수 있고, 앱을 지우면 함께 지워져요.</p>
          <h2>공유 링크</h2>
          <p>공유 링크에는 모두의 출발역과 닉네임이 들어가요. 링크를 받은 사람은 누구나 볼 수 있으니 실명 대신 닉네임을 쓰고, 믿을 수 있는 사람에게만 보내 주세요.</p>
        </div>
      </main>
    );
  }
  if (page === 'licenses') {
    return (
      <main className="page">
        <PageHeader title="오픈소스 라이선스" />
        <p className="sub" style={{ marginBottom: 'var(--space-4)' }}>사잇에 포함된 오픈소스 {ossLicenses.packages.length}개</p>
        <ul className="list card">
          {ossLicenses.packages.map((p) => (
            <li key={`${p.name}@${p.version}`}>
              <details className="oss">
                <summary className="list-row">
                  <span className="list-row__body">
                    <span className="list-row__title">{p.name}</span>
                    <span className="list-row__meta" style={{ display: 'block' }}>{p.version} · {p.license}</span>
                  </span>
                </summary>
                <pre className="oss__text">{[...p.copyright, '', p.textId ? (ossLicenses.texts as Record<string, string>)[p.textId] : `License: ${p.license}`].join('\n')}</pre>
              </details>
            </li>
          ))}
        </ul>
      </main>
    );
  }
  return <Navigate to="/settings" replace />;
}
