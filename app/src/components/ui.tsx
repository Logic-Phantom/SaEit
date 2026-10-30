import { useEffect, useRef, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { graph } from '../data/graph';
import type { PathStep } from '../engine';
import { isInToss } from '../platform/toss';
import { Icon } from './Icon';

/** 화면 제목. 토스 앱 안에서는 토스 내비게이션 바의 뒤로가기를 쓰므로 자체 뒤로가기 버튼을 숨긴다. */
export function PageHeader({ title, back = true, right }: { title?: string; back?: boolean; right?: ReactNode }) {
  const navigate = useNavigate();
  const showBack = back && !isInToss();
  return (
    <header className="header">
      {showBack && (
        <button type="button" className="icon-btn header__back" onClick={() => (history.length > 1 ? navigate(-1) : navigate('/', { replace: true }))} aria-label="뒤로 가기">
          <Icon name="back" />
        </button>
      )}
      {title ? <h1 className="header__title">{title}</h1> : <span style={{ flex: 1 }} />}
      {right}
    </header>
  );
}

export function TabBar() {
  const items = [
    { to: '/', label: '홈', icon: 'home' as const, end: true },
    { to: '/history', label: '기록', icon: 'history' as const, end: false },
    { to: '/settings', label: '설정', icon: 'settings' as const, end: false },
  ];
  return (
    <nav className="tabbar" aria-label="주요 메뉴">
      <div className="tabbar__inner">
        {items.map((it) => (
          <NavLink key={it.to} to={it.to} end={it.end} replace>
            <Icon name={it.icon} size={22} />
            {it.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

export function LineBadge({ lineIdx, large }: { lineIdx: number; large?: boolean }) {
  const line = graph.raw.lines[lineIdx];
  return (
    <span className={`line-badge${large ? ' line-badge--lg' : ''}`} style={{ background: line.color }} title={line.name}>
      <span aria-hidden="true">{line.short}</span>
      <span className="sr-only">{line.name}</span>
    </span>
  );
}

export function StationLines({ stationIdx, large }: { stationIdx: number; large?: boolean }) {
  const lineIdx = graph.raw.stations[stationIdx].lines.map((id) => graph.raw.lines.findIndex((l) => l.id === id));
  return (
    <span className="badges">
      {lineIdx.map((li) => <LineBadge key={li} lineIdx={li} large={large} />)}
    </span>
  );
}

/** 경로를 노선 배지 흐름으로: ② → ⑨ */
export function RouteChips({ steps }: { steps: PathStep[] }) {
  const rides = steps.filter((s) => s.kind === 'ride');
  if (!rides.length) return <span className="chip">출발역 그대로</span>;
  return (
    <span className="route-chips" aria-label={rides.map((r) => graph.raw.lines[r.lineIdx].name).join(' 다음 ')}>
      {rides.map((r, i) => (
        <span key={i} className="route-chips" aria-hidden="true">
          {i > 0 && <span className="route-chips__arrow">→</span>}
          <LineBadge lineIdx={r.lineIdx} />
        </span>
      ))}
    </span>
  );
}

export function Avatar({ index, small }: { index: number; small?: boolean }) {
  const n = (index % 6) + 1;
  return (
    <span className={`avatar${small ? ' avatar--sm' : ''}`} style={{ background: `var(--avatar-${n}-bg)`, color: `var(--avatar-${n}-fg)` }} aria-hidden="true">
      <Icon name="person" size={small ? 14 : 22} strokeWidth={2.2} />
    </span>
  );
}

export function AvatarStack({ count, max = 4 }: { count: number; max?: number }) {
  return (
    <span className="avatar-stack" aria-label={`${count}명`}>
      {Array.from({ length: Math.min(count, max) }, (_, i) => <Avatar key={i} index={i} small />)}
      {count > max && <span className="avatar-stack__more">+{count - max}</span>}
    </span>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <span className="switch">
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
      <span />
    </span>
  );
}

export function ConfirmDialog({ title, body, confirmLabel, danger, onConfirm, onCancel }: { title: string; body: string; confirmLabel: string; danger?: boolean; onConfirm: () => void; onCancel: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);
  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dlg-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="dlg-title">{title}</h2>
        <p>{body}</p>
        <div className="btn-row">
          <button ref={ref} type="button" className="btn btn--secondary" onClick={onCancel}>취소</button>
          <button type="button" className={`btn ${danger ? 'btn--danger' : 'btn--primary'}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

export function DemoNotice() {
  if (!graph.raw.demo) return null;
  return (
    <p className="notice notice--warn" role="note">
      <Icon name="info" size={16} />
      <span>지금은 <strong>데모 데이터</strong>예요. 서울 도심 일부 노선만 있고, 역 사이 시간은 모두 같은 값으로 추정했어요.</span>
    </p>
  );
}

export function Disclaimer() {
  return (
    <p className="notice" role="note">
      <Icon name="info" size={16} />
      <span>표준 운행시간 기준 추정치이며 실제 소요시간·배차·지연과 다를 수 있어요. 일부 구간은 거리 기반으로 추정했어요.</span>
    </p>
  );
}

export function EstimatedChip() {
  return <span className="chip chip--warn">추정 포함</span>;
}
