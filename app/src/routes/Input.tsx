import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Avatar, ConfirmDialog, PageHeader, StationLines, Switch } from '../components/ui';
import { graph } from '../data/graph';
import { MAX_PARTICIPANTS, MIN_PARTICIPANTS } from '../engine';
import { encodePayload, NICKNAME_MAX, nicknameError } from '../features/share/codec';
import { newDraft, payloadFromDraft, useApp } from '../state/AppState';

export function Input() {
  const navigate = useNavigate();
  const { draft, setDraft, addRow } = useApp();
  const [confirmReset, setConfirmReset] = useState(false);
  const rows = draft.participants;

  const nickErrors = rows.map((r) => nicknameError(r.nickname));
  const missing = rows.filter((r) => !r.stationId).length;
  const reason =
    rows.length < MIN_PARTICIPANTS ? `${MIN_PARTICIPANTS}명 이상 필요해요.`
    : nickErrors.some(Boolean) ? '닉네임을 확인해 주세요.'
    : missing ? `출발역을 골라 주세요 (${missing}명 남음)`
    : null;

  const update = (key: number, patch: Partial<{ nickname: string; stationId: string | null }>) =>
    setDraft((d) => ({ ...d, participants: d.participants.map((p) => (p.key === key ? { ...p, ...patch } : p)) }));
  const remove = (key: number) => setDraft((d) => ({ ...d, participants: d.participants.filter((p) => p.key !== key) }));

  const submit = () => {
    if (reason) return;
    navigate(`/result?${encodePayload(payloadFromDraft(draft))}`, { state: { save: true } });
  };

  const dirty = rows.some((r) => r.stationId || r.nickname);
  return (
    <main className="page page--with-cta">
      <PageHeader
        title="출발역 입력"
        right={dirty ? <button type="button" className="btn btn--ghost" onClick={() => setConfirmReset(true)}>새로 시작</button> : undefined}
      />
      <div className="segment" role="group" aria-label="입력 방식">
        <button type="button" aria-pressed="true">직접 입력</button>
        <button type="button" aria-pressed="false" onClick={() => navigate('/join', { replace: true })}>링크로 참여</button>
      </div>

      <ul className="list card" aria-label="참가자 목록">
        {rows.map((r, i) => {
          const idx = r.stationId ? graph.stationById.get(r.stationId) : undefined;
          return (
            <li key={r.key} className="participant">
              <Avatar index={i} />
              <div className="participant__body">
                <label className="sr-only" htmlFor={`nick-${r.key}`}>참가자 {i + 1} 닉네임</label>
                <input
                  id={`nick-${r.key}`}
                  className="participant__nick"
                  value={r.nickname}
                  maxLength={NICKNAME_MAX + 2}
                  placeholder={`참가자 ${i + 1} (닉네임 선택)`}
                  onChange={(e) => update(r.key, { nickname: e.target.value })}
                  autoComplete="off"
                />
                <button type="button" className={`participant__station${idx == null ? ' is-empty' : ''}`} onClick={() => navigate(`/search/${r.key}`)}>
                  {idx == null ? (
                    <><Icon name="search" size={15} /> 출발역 선택</>
                  ) : (
                    <>{graph.raw.stations[idx].name} <StationLines stationIdx={idx} /></>
                  )}
                </button>
                {nickErrors[i] && <p className="field-error">{nickErrors[i]}</p>}
              </div>
              {rows.length > MIN_PARTICIPANTS && (
                <button type="button" className="icon-btn participant__remove" onClick={() => remove(r.key)} aria-label={`참가자 ${i + 1} 삭제`}>
                  <Icon name="close" size={18} />
                </button>
              )}
            </li>
          );
        })}
        {rows.length < MAX_PARTICIPANTS && (
          <li>
            <button type="button" className="list-row add-row" onClick={addRow}>
              <span className="add-row__icon"><Icon name="plus" size={18} /></span>
              멤버 추가 <span className="sub">(최대 {MAX_PARTICIPANTS}명)</span>
            </button>
          </li>
        )}
      </ul>

      <h2 className="section-title">추천 기준</h2>
      <div className="card">
        <div className="toggle-row">
          <div className="toggle-row__label">
            <strong>모든 역에서 찾기</strong>
            <span>끄면 환승역(모이기 좋은 역) 중에서만 찾아요.</span>
          </div>
          <Switch label="모든 역에서 찾기" checked={draft.allStations} onChange={(v) => setDraft((d) => ({ ...d, allStations: v }))} />
        </div>
        <div className="toggle-row" style={{ borderTop: '1px solid var(--color-line)' }}>
          <div className="toggle-row__label">
            <strong>환승 적은 순 우선</strong>
            <span>가장 오래 걸리는 시간이 같으면 환승이 적은 역을 먼저 보여 줘요.</span>
          </div>
          <Switch label="환승 적은 순 우선" checked={draft.preferFewerTransfers} onChange={(v) => setDraft((d) => ({ ...d, preferFewerTransfers: v }))} />
        </div>
      </div>
      <p className="foot-note">실명 대신 닉네임을 써 주세요. 닉네임은 비워 둬도 돼요.</p>

      <div className="cta-bar">
        <div className="cta-bar__inner">
          <p className="cta-bar__hint" aria-live="polite">{reason ?? ''}</p>
          <button type="button" className="btn btn--primary btn--block" disabled={!!reason} onClick={submit}>중간역 찾기</button>
        </div>
      </div>

      {confirmReset && (
        <ConfirmDialog
          title="새로 시작할까요?"
          body="입력한 참가자와 출발역이 모두 지워져요."
          confirmLabel="새로 시작"
          danger
          onCancel={() => setConfirmReset(false)}
          onConfirm={() => { setDraft(() => newDraft()); setConfirmReset(false); }}
        />
      )}
    </main>
  );
}
