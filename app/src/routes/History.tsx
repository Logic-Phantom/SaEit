import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Avatar, AvatarStack, ConfirmDialog, PageHeader, StationLines, TabBar } from '../components/ui';
import { graph } from '../data/graph';
import { shortDate } from '../lib/format';
import { useApp } from '../state/AppState';

export function History() {
  const navigate = useNavigate();
  const { history, removeAllHistory, toast } = useApp();
  const [confirm, setConfirm] = useState(false);
  return (
    <main className="page page--with-tabbar">
      <PageHeader
        title="이용 기록"
        back={false}
        right={history.length > 0 ? <button type="button" className="btn btn--ghost" onClick={() => setConfirm(true)}>전체 삭제</button> : undefined}
      />
      {history.length === 0 ? (
        <div className="empty">
          <Icon name="history" size={30} />
          <p className="empty__title">아직 기록이 없어요</p>
          <p className="sub">중간역을 찾으면 이 기기에만 기록이 남아요.</p>
          <button type="button" className="btn btn--primary" style={{ marginTop: 'var(--space-5)' }} onClick={() => navigate('/input')}>첫 중간역 찾기</button>
        </div>
      ) : (
        <ul className="stack list-plain">
          {history.map((h, i) => {
            const idx = graph.stationById.get(h.topStationId)!;
            return (
              <li key={h.query}>
                <button type="button" className="card person" onClick={() => navigate(`/result?${h.query}`)}>
                  <Avatar index={i} />
                  <span className="person__body">
                    <span className="person__name">{graph.raw.stations[idx].name} <StationLines stationIdx={idx} /></span>
                    <span className="person__meta">{shortDate(h.at)} · {h.count}명</span>
                  </span>
                  <AvatarStack count={h.count} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="foot-note">기록은 이 기기에만 저장되고 서버로 보내지 않아요. 최근 20개까지 남아요.</p>
      {confirm && (
        <ConfirmDialog
          title="기록을 모두 지울까요?"
          body="지운 기록은 되돌릴 수 없어요."
          confirmLabel="모두 지우기"
          danger
          onCancel={() => setConfirm(false)}
          onConfirm={async () => { await removeAllHistory(); setConfirm(false); toast('기록을 지웠어요'); }}
        />
      )}
      <TabBar />
    </main>
  );
}
