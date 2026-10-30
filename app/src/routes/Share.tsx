import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { PageHeader } from '../components/ui';
import { stationName } from '../data/graph';
import { useResult } from '../features/results/useResult';
import { copyText, createResultLink, shareMessage } from '../platform/toss';
import { useApp } from '../state/AppState';

const asset = (p: string) => `${import.meta.env.BASE_URL}${p}`;
// 공유 미리보기 이미지는 https로 호스팅해야 한다(Phase 3: GitHub Pages). 정해지기 전에는 넘기지 않는다 → 토스가 앱 이미지·이름을 자동 표시.
const OG_IMAGE_URL: string | undefined = undefined;

export function ShareScreen() {
  const r = useResult();
  const { toast } = useApp();
  const [link, setLink] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const query = r?.query;

  useEffect(() => {
    if (!query) return;
    let alive = true;
    createResultLink(query, OG_IMAGE_URL)
      .then((l) => alive && setLink(l))
      .catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [query]);

  if (!r || !r.selected) return <Navigate to="/" replace />;
  const message = `사잇 - 우리 사이를 잇다\n우리 모두 비슷하게 걸리는 역을 찾았어요. 확인해 볼래요?\n\n추천 역: ${stationName(r.selected.stationIdx)}\n${link ?? ''}`;

  const onShare = async () => {
    if (!link) return;
    try {
      const how = await shareMessage(message);
      if (how === 'copied') toast('공유 문구를 복사했어요');
    } catch {
      toast('공유하지 못했어요. 링크 복사를 이용해 주세요.');
    }
  };
  const onCopy = async () => {
    if (!link) return;
    try {
      await copyText(link);
      toast('링크를 복사했어요');
    } catch {
      toast('복사하지 못했어요');
    }
  };

  return (
    <main className="page page--subtle">
      <PageHeader title="공유하기" />
      <section className="card share-preview">
        <div className="share-preview__art">
          <img src={asset('brand/logo.png')} alt="" width={96} height={96} />
        </div>
        <div className="share-preview__body">
          <p className="share-preview__app">사잇</p>
          <p className="share-preview__tag">우리 사이를 잇다</p>
          <p className="sub">우리 모두 비슷하게 걸리는 역을 찾았어요. 확인해 볼래요?</p>
        </div>
      </section>

      <div className="link-box" aria-live="polite">
        <span className="link-box__text">{failed ? '링크를 만들지 못했어요' : link ?? '링크 만드는 중…'}</span>
        <button type="button" className="icon-btn" onClick={onCopy} disabled={!link} aria-label="링크 복사"><Icon name="copy" size={18} /></button>
      </div>

      <p className="notice" style={{ marginTop: 'var(--space-4)' }}>
        <Icon name="shield" size={16} />
        <span>링크에는 모두의 출발역과 닉네임이 담겨요. 링크를 받은 사람은 누구나 볼 수 있으니 믿을 수 있는 사람에게만 보내 주세요.</span>
      </p>

      <div className="stack" style={{ marginTop: 'var(--space-6)' }}>
        <button type="button" className="btn btn--primary btn--block" onClick={onShare} disabled={!link}><Icon name="share" size={18} /> 공유하기</button>
        <button type="button" className="btn btn--secondary btn--block" onClick={onCopy} disabled={!link}><Icon name="link" size={18} /> 링크 복사</button>
      </div>
    </main>
  );
}
