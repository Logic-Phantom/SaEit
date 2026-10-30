// 앱인토스 콘솔용 스크린샷(세로 636×1048 PNG, 최소 3장)을 실제 앱 화면에서 만든다.
// 헤드리스 Chrome은 창 최소 너비가 있어 --window-size로는 360px 휴대폰 폭이 안 나온다 → DevTools 프로토콜로 기기 화면을 흉내 낸다.
// 사용: npm run dev (5173) 를 켠 상태에서  node scripts/store-screenshots.mjs
// 출력: assets/store/phone-01~04.png. 참가자 닉네임은 예시(실존 인물 아님).
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = join(ROOT, 'assets', 'store');
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.env.APP_URL ?? 'http://localhost:5173/';
const PORT = 9333;
// CSS 360×593 × 1.7667배 = 636×1048
const W = 360, H = 593, SCALE = 636 / 360;
const Q = `v=1&s=S0001,S0120,S0109&n=${encodeURIComponent('민지,준호,서연')}`;
const SHOTS = [
  ['phone-01.png', '#/'],
  ['phone-02.png', `#/result?${Q}`],
  ['phone-03.png', `#/candidates?${Q}`],
  ['phone-04.png', `#/settings`],
];

const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${PORT}`, `--user-data-dir=${join(tmpdir(), 'saeit-shots')}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    await sleep(200);
    try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === 'page'); } catch { /* 아직 안 뜸 */ }
  }
  if (!target) throw new Error('Chrome DevTools에 연결하지 못했어요');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });

  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: SCALE, mobile: true });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
  // 토스 앱 안에서는 토스 내비게이션 바를 쓰고 앱 자체 뒤로가기는 숨긴다(D-005) → 캡처도 같게
  await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: "document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='.header__back{display:none!important}';document.head.appendChild(s)})" });
  mkdirSync(OUT, { recursive: true });
  for (const [file, hash] of SHOTS) {
    await send('Page.navigate', { url: `${BASE}${hash}` });
    await sleep(1500);
    const r = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(OUT, file), Buffer.from(r.result.data, 'base64'));
    console.log(`✔ ${file} ← ${hash}`);
  }
  ws.close();
} finally {
  chrome.kill();
}
