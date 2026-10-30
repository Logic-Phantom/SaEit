import { describe, expect, it } from 'vitest';
import type { Station } from '../src/engine';
import { decodePayload, encodePayload, extractQuery, nicknameError } from '../src/features/share/codec';
import { entryTarget } from '../src/features/share/entry';
import { graph } from '../src/data/graph';
import { searchStations } from '../src/features/station-search/search';
import { memoryStore } from '../src/storage/kv';
import { addHistory, addRecentStation, HISTORY_MAX, loadHistory, RECENT_MAX } from '../src/storage/records';

const ids = new Set(['S0001', 'S0002', 'S0003']);

describe('공유 코덱', () => {
  it('왕복', () => {
    const q = encodePayload({ v: 1, s: ['S0001', 'S0002'], n: ['민지', ''], m: 'all', t: true });
    expect(decodePayload(q, ids)).toEqual({ v: 1, s: ['S0001', 'S0002'], n: ['민지', ''], m: 'all', t: true });
  });
  it('닉네임이 모두 비면 n 생략', () => {
    expect(encodePayload({ v: 1, s: ['S0001', 'S0002'], n: ['', ' '] })).toBe('v=1&s=S0001%2CS0002');
  });
  it('변조된 링크 거부', () => {
    expect(decodePayload('v=2&s=S0001,S0002', ids)).toBeNull();
    expect(decodePayload('v=1&s=S0001', ids)).toBeNull(); // 1명
    expect(decodePayload('v=1&s=S0001,S9999', ids)).toBeNull(); // 화이트리스트 밖
    expect(decodePayload('v=1&s=S0001,<script>', ids)).toBeNull();
    expect(decodePayload(`v=1&s=${Array(7).fill('S0001').join(',')}`, ids)).toBeNull(); // 7명
    expect(decodePayload('v=1&s=S0001,S0002&n=a', ids)).toBeNull(); // 길이 불일치
    expect(decodePayload('v=1&s=S0001,S0002&n=아주아주긴닉네임입니다,b', ids)).toBeNull();
    expect(decodePayload('v=1&s=S0001,S0002&m=x', ids)).toBeNull();
  });
  it('닉네임 규칙', () => {
    expect(nicknameError('민지')).toBeNull();
    expect(nicknameError('')).toBeNull();
    expect(nicknameError('www.a.kr')).not.toBeNull();
    expect(nicknameError('01012345678')).not.toBeNull();
    expect(nicknameError('😀')).not.toBeNull();
    expect(nicknameError('123456789')).not.toBeNull();
  });
  it('붙여넣은 링크에서 쿼리 추출', () => {
    expect(extractQuery('intoss://saeit/result?v=1&s=S0001,S0002')).toBe('v=1&s=S0001,S0002');
    expect(extractQuery('https://x.y/#/result?v=1&s=S0001,S0002 확인해 볼래요?')).toBe('v=1&s=S0001,S0002');
    expect(extractQuery('v=1&s=S0001,S0002')).toBe('v=1&s=S0001,S0002');
    expect(extractQuery('아무 글')).toBeNull();
  });
});

describe('역 검색', () => {
  const st = (name: string, chosung: string, aliases: string[] = []): Station => ({ id: name, name, aliases, lines: [], chosung });
  const stations = [st('강남구청', 'ㄱㄴㄱㅊ'), st('강남', 'ㄱㄴ'), st('신논현', 'ㅅㄴㅎ'), st('총신대입구(이수)', 'ㅊㅅㄷㅇㄱㅇㅅ', ['총신대입구', '이수'])];
  it('정확 > 접두 > 포함', () => {
    expect(searchStations(stations, '강남').map((i) => stations[i].name)).toEqual(['강남', '강남구청']);
    expect(searchStations(stations, '논').map((i) => stations[i].name)).toEqual(['신논현']);
  });
  it('초성·별칭·역 접미사', () => {
    expect(searchStations(stations, 'ㄱㄴ').map((i) => stations[i].name)).toEqual(['강남', '강남구청']);
    expect(searchStations(stations, '이수').map((i) => stations[i].name)).toEqual(['총신대입구(이수)']);
    expect(searchStations(stations, '강남역').map((i) => stations[i].name)).toEqual(['강남', '강남구청']);
    expect(searchStations(stations, '  ')).toEqual([]);
  });
});

describe('로컬 기록', () => {
  it('중복 제거·최대 개수', async () => {
    const s = memoryStore();
    for (let i = 0; i < HISTORY_MAX + 3; i++) await addHistory(s, { query: `q${i % (HISTORY_MAX + 1)}`, topStationId: 'S0001', count: 2, at: i });
    const list = await loadHistory(s);
    expect(list.length).toBe(HISTORY_MAX);
    expect(new Set(list.map((e) => e.query)).size).toBe(HISTORY_MAX);
    for (let i = 0; i < RECENT_MAX + 2; i++) await addRecentStation(s, `S000${i % 9}`);
    expect((await addRecentStation(s, 'S0001'))[0]).toBe('S0001');
  });
  it('깨진 저장값은 빈 목록', async () => {
    const s = memoryStore();
    await s.set('saeit.history.v1', '{bad');
    expect(await loadHistory(s)).toEqual([]);
  });
});

describe('진입 링크', () => {
  const [a, b] = graph.raw.stations;
  it('결과 링크는 검증 후 결과 화면', () => {
    expect(entryTarget(`intoss://saeit/result?v=1&s=${a.id},${b.id}`)).toBe(`/result?v=1&s=${a.id}%2C${b.id}`);
    expect(entryTarget('intoss://saeit/result?v=1&s=S9999,S9998')).toBeNull();
  });
  it('주요 기능 경로는 허용 목록만', () => {
    expect(entryTarget('intoss://saeit/input')).toBe('/input');
    expect(entryTarget('intoss-private://saeit/history?x=1')).toBe('/history');
    expect(entryTarget('intoss://saeit/admin')).toBeNull();
    expect(entryTarget('intoss://saeit')).toBeNull();
    expect(entryTarget('https://evil.example/input')).toBeNull();
  });
});
