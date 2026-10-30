// 공공데이터포털 파일데이터 원본을 data-build/raw/ 에 내려받는다(로그인 불필요한 파일데이터만).
// 포털 상세 페이지의 '다운로드' 버튼과 같은 흐름: 상세 페이지 → selectFileDataDownload.do → check-limit.json → fileDownload.do
// 다운로드 한도에 걸려 보안문자(captcha)를 요구하면 우회하지 않고 멈춘다 → 브라우저에서 직접 받는다.
// 사용: npm run data:fetch --workspace data-build [-- <publicDataPk> ...]
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const RAW = join(ROOT, 'data-build', 'raw');
const BASE = 'https://www.data.go.kr';
const UA = 'Mozilla/5.0 (saeit data-build)';

/** Phase 0 수집 대상(docs/DATA_SOURCES.md). */
export const SOURCES: { pk: string; note: string }[] = [
  { pk: '15134768', note: '서울특별시_철도역 구간 (1순위 주행 간선)' },
  { pk: '15081860', note: '국가철도공단_서울교통공사 역간거리' },
  { pk: '15044419', note: '서울교통공사_환승역거리 소요시간 정보' },
  { pk: '15081858', note: '국가철도공단_코레일 역간거리' },
  { pk: '15041085', note: '국가철도공단_코레일_환승정보' },
  { pk: '15041298', note: '국가철도공단_수도권9호선_역간거리' },
  { pk: '15041310', note: '국가철도공단_공항철도_역간거리' },
  { pk: '15081850', note: '국가철도공단_에버라인 역간거리' },
];

class Session {
  private cookies = new Map<string, string>();
  async req(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set('User-Agent', UA);
    if (this.cookies.size) headers.set('Cookie', [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '));
    const res = await fetch(BASE + path, { ...init, headers, redirect: 'follow' });
    for (const c of res.headers.getSetCookie()) {
      const [kv] = c.split(';');
      const i = kv.indexOf('=');
      this.cookies.set(kv.slice(0, i).trim(), kv.slice(i + 1).trim());
    }
    return res;
  }
  post(path: string, form: Record<string, string>) {
    return this.req(path, { method: 'POST', body: new URLSearchParams(form), headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' } });
  }
}

export interface Fetched { pk: string; title: string; file: string | null; bytes: number; modified: string | null; license: string | null; error?: string }

async function fetchOne(pk: string): Promise<Fetched> {
  const s = new Session();
  const page = await (await s.req(`/data/${pk}/fileData.do`)).text();
  const title = /<title>([^<|]+)/.exec(page)?.[1].trim() ?? pk;
  const ld = /<script type="application\/ld\+json">(\{[\s\S]*?\})<\/script>/.exec(page);
  let modified: string | null = null;
  let license: string | null = null;
  if (ld) {
    try {
      const meta = JSON.parse(ld[1]) as { dateModified?: string; license?: { name?: string } };
      modified = meta.dateModified ?? null;
      license = meta.license?.name ?? null;
    } catch { /* 메타데이터 없음 */ }
  }
  const btn = /fn_fileDataDown\('(\d+)',\s*'([^']+)',\s*'([^']*)',\s*'([^']*)'/.exec(page);
  if (!btn) return { pk, title, file: null, bytes: 0, modified, license, error: '다운로드 버튼 없음(파일데이터가 아니거나 페이지 구조 변경)' };
  const [, publicDataPk, detailPk, atchFileIdArg, fileDetailSnArg] = btn;

  const info = JSON.parse(await (await s.post('/tcs/dss/selectFileDataDownload.do', {
    publicDataDetailPk: detailPk, publicDataPk, atchFileId: atchFileIdArg, fileDetailSn: fileDetailSnArg, publicDataTyCode: 'PR0051',
  })).text()) as { status: boolean; atchFileId: string; fileDetailSn: string; dataSetFileDetailInfo: { dataNm: string; publicDataSj: string; publicDataTyDetailCode: string } };
  if (!info.status) return { pk, title, file: null, bytes: 0, modified, license, error: '다운로드 정보 응답 실패' };

  const limit = await s.post('/cmm/cmm/check-limit.json', { atchFileId: info.atchFileId, fileDetailSn: String(info.fileDetailSn) });
  if (limit.status === 403 || ((await limit.json()) as { needCaptcha?: boolean }).needCaptcha) {
    return { pk, title, file: null, bytes: 0, modified, license, error: '다운로드 한도 — 보안문자 필요(브라우저에서 직접 받으세요)' };
  }
  const name = info.dataSetFileDetailInfo.publicDataTyDetailCode === 'DATY05' ? info.dataSetFileDetailInfo.publicDataSj : info.dataSetFileDetailInfo.dataNm;
  const res = await s.req(`/cmm/cmm/fileDownload.do?atchFileId=${info.atchFileId}&fileDetailSn=${info.fileDetailSn}&dataNm=${encodeURI(name)}`);
  const disp = res.headers.get('content-disposition') ?? '';
  const ext = (/\.([a-zA-Z0-9]+)"?\s*$/.exec(decodeURIComponent(disp))?.[1] ?? 'csv').toLowerCase();
  const buf = Buffer.from(await res.arrayBuffer());
  if (!res.ok || buf.length === 0 || buf.subarray(0, 15).toString('latin1').includes('<!DOCTYPE')) {
    return { pk, title, file: null, bytes: 0, modified, license, error: `파일 응답 이상 (HTTP ${res.status})` };
  }
  const safe = title.replace(/[\\/:*?"<>|\s]+/g, '_');
  const file = `${pk}_${safe}.${ext}`;
  writeFileSync(join(RAW, file), buf); // 원본 그대로 저장(인코딩 변환은 어댑터에서)
  return { pk, title, file, bytes: buf.length, modified, license };
}

/** 서울 열린데이터광장 파일: 상세 페이지의 downloadFile(seq) 폼과 같은 POST. seq는 페이지의 파일 목록에서 최신 파일 번호. */
export const SEOUL_SOURCES: { infId: string; seq: string; file: string; note: string }[] = [
  { infId: 'OA-12034', seq: '9', file: 'OA-12034_서울교통공사_역간거리_및_소요시간_240810.csv', note: '서울교통공사 1~8호선 역간 소요시간(주행 시간 실측)' },
];

async function fetchSeoul(src: (typeof SEOUL_SOURCES)[number]): Promise<Fetched> {
  const res = await fetch(`https://datafile.seoul.go.kr/bigfile/iot/inf/nio_download.do?&useCache=false`, {
    method: 'POST',
    headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ infId: src.infId, seq: src.seq, infSeq: '1' }),
  });
  const buf = Buffer.from(await res.arrayBuffer());
  if (!res.ok || buf.length === 0 || buf.subarray(0, 15).toString('latin1').includes('<')) {
    return { pk: src.infId, title: src.note, file: null, bytes: 0, modified: null, license: null, error: `파일 응답 이상 (HTTP ${res.status})` };
  }
  writeFileSync(join(RAW, src.file), buf);
  return { pk: src.infId, title: src.note, file: src.file, bytes: buf.length, modified: null, license: '공공누리 제1유형' };
}

async function main(): Promise<void> {
  if (!existsSync(RAW)) mkdirSync(RAW, { recursive: true });
  const pks = process.argv.slice(2).length ? process.argv.slice(2) : SOURCES.map((s) => s.pk);
  const results: Fetched[] = [];
  for (const pk of pks) {
    try {
      const r = await fetchOne(pk);
      results.push(r);
      console.log(r.file ? `✔ ${pk} ${r.title} → ${r.file} (${(r.bytes / 1024).toFixed(1)} KB)` : `✖ ${pk} ${r.title}: ${r.error}`);
      if (r.error?.includes('보안문자')) break; // 한도에 걸리면 더 시도하지 않는다
    } catch (e) {
      console.log(`✖ ${pk}: ${(e as Error).message}`);
    }
    await new Promise((r) => setTimeout(r, 1500)); // 포털 부하를 줄이려고 간격을 둔다
  }
  if (!process.argv.slice(2).length) {
    for (const src of SEOUL_SOURCES) {
      const r = await fetchSeoul(src);
      results.push(r);
      console.log(r.file ? `✔ ${src.infId} → ${r.file} (${(r.bytes / 1024).toFixed(1)} KB)` : `✖ ${src.infId}: ${r.error}`);
    }
  }
  writeFileSync(join(RAW, 'fetch-log.json'), `${JSON.stringify({ fetchedAt: new Date().toISOString(), results }, null, 1)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
