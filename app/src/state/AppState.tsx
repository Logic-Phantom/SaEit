// 앱 전역 상태: 입력 중인 참가자(뒤로 가도 유지), 로컬 기록, 최근 역, 토스트.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { MAX_PARTICIPANTS } from '../engine';
import { decodePayload, encodePayload, type SharePayload } from '../features/share/codec';
import { validStationIds } from '../data/graph';
import { store } from '../storage/kv';
import { addHistory, addRecentStation, clearHistory, loadHistory, loadRecentStations, type HistoryEntry } from '../storage/records';

export interface DraftParticipant { key: number; nickname: string; stationId: string | null; }
export interface Draft { participants: DraftParticipant[]; allStations: boolean; preferFewerTransfers: boolean; }

let keySeq = 1;
const emptyRow = (): DraftParticipant => ({ key: keySeq++, nickname: '', stationId: null });
export const newDraft = (): Draft => ({ participants: [emptyRow(), emptyRow()], allStations: false, preferFewerTransfers: false });

export function draftFromPayload(p: SharePayload, addOne: boolean): Draft {
  const participants: DraftParticipant[] = p.s.map((id, i) => ({ key: keySeq++, nickname: p.n?.[i] ?? '', stationId: id }));
  if (addOne && participants.length < MAX_PARTICIPANTS) participants.push(emptyRow());
  return { participants, allStations: p.m === 'all', preferFewerTransfers: !!p.t };
}

export function payloadFromDraft(d: Draft): SharePayload {
  const rows = d.participants.filter((p) => p.stationId);
  return { v: 1, s: rows.map((p) => p.stationId!), n: rows.map((p) => p.nickname.trim()), m: d.allStations ? 'all' : undefined, t: d.preferFewerTransfers || undefined };
}

interface AppState {
  draft: Draft;
  setDraft: (updater: (d: Draft) => Draft) => void;
  addRow: () => void;
  history: HistoryEntry[];
  saveHistory: (p: SharePayload, topStationId: string) => void;
  removeAllHistory: () => Promise<void>;
  recentStations: string[];
  pushRecentStation: (id: string) => void;
  toast: (msg: string) => void;
}

const Ctx = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [draft, setDraftState] = useState<Draft>(newDraft);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [recentStations, setRecent] = useState<string[]>([]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    // 저장값도 신뢰하지 않는다: 지금 그래프에 없는 역·깨진 쿼리는 버린다
    loadHistory(store).then((h) => setHistory(h.filter((e) => decodePayload(e.query, validStationIds))));
    loadRecentStations(store).then((r) => setRecent(r.filter((id) => validStationIds.has(id))));
  }, []);

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 2200);
    return () => clearTimeout(t);
  }, [toastMsg]);

  const setDraft = useCallback((u: (d: Draft) => Draft) => setDraftState(u), []);
  const addRow = useCallback(() => setDraftState((d) => (d.participants.length >= MAX_PARTICIPANTS ? d : { ...d, participants: [...d.participants, emptyRow()] })), []);
  const saveHistory = useCallback((p: SharePayload, topStationId: string) => {
    addHistory(store, { query: encodePayload(p), topStationId, count: p.s.length, at: Date.now() }).then(setHistory);
  }, []);
  const removeAllHistory = useCallback(async () => {
    await clearHistory(store);
    setHistory([]);
  }, []);
  const pushRecentStation = useCallback((id: string) => {
    addRecentStation(store, id).then(setRecent);
  }, []);

  const value = useMemo<AppState>(
    () => ({ draft, setDraft, addRow, history, saveHistory, removeAllHistory, recentStations, pushRecentStation, toast: setToastMsg }),
    [draft, setDraft, addRow, history, saveHistory, removeAllHistory, recentStations, pushRecentStation],
  );
  return (
    <Ctx.Provider value={value}>
      {children}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </Ctx.Provider>
  );
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('AppStateProvider missing');
  return v;
}
