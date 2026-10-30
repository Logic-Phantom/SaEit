import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/ui';
import { validStationIds } from '../data/graph';
import { decodePayload, encodePayload, extractQuery } from '../features/share/codec';

export function Join() {
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const q = extractQuery(text);
    const p = q ? decodePayload(q, validStationIds) : null;
    if (!p) {
      setError('사잇 결과 링크가 아니거나 지원하지 않는 역이 들어 있어요.');
      return;
    }
    navigate(`/result?${encodePayload(p)}`);
  };

  return (
    <main className="page">
      <PageHeader title="" />
      <div className="segment" role="group" aria-label="입력 방식">
        <button type="button" aria-pressed="false" onClick={() => navigate('/input', { replace: true })}>직접 입력</button>
        <button type="button" aria-pressed="true">링크로 참여</button>
      </div>
      <section className="join">
        <h1 className="lead" style={{ textAlign: 'center' }}>링크로 참여</h1>
        <p className="sub" style={{ textAlign: 'center' }}>친구가 보낸 링크를 붙여 넣으면 같은 결과를 볼 수 있어요.</p>
        <label className="sr-only" htmlFor="join-link">공유 링크</label>
        <input
          id="join-link"
          className="field"
          style={{ marginTop: 'var(--space-6)' }}
          value={text}
          onChange={(e) => { setText(e.target.value); setError(null); }}
          placeholder="링크를 붙여 넣어 주세요"
          autoComplete="off"
          inputMode="url"
        />
        {error && <p className="field-error" role="alert">{error}</p>}
        <button type="button" className="btn btn--primary btn--block" style={{ marginTop: 'var(--space-4)' }} disabled={!text.trim()} onClick={submit}>
          결과 보기
        </button>
        <p className="sub" style={{ textAlign: 'center', marginTop: 'var(--space-6)' }}>로그인 없이 닉네임만으로 이용해요.</p>
      </section>
    </main>
  );
}
