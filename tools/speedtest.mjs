// Measures how smoothly the home screen draws on the TV while the remote moves focus.
// Needs a debug build running on the TV and adb connected.
// Usage: node tools/speedtest.mjs [lite] [--css file.css]   (--css adds a stylesheet first, to try a change live)
// It talks to the WebView over the DevTools protocol (adb forward), records every frame's time with
// requestAnimationFrame, presses the D-pad through adb, and prints frame-time numbers per scenario.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const ADB = process.env.ADB || 'adb';   // adb on your PATH, or set ADB to its full path
const PKG = 'com.alphaque.alphadeck';
const PORT = 9333;
const args = process.argv.slice(2);
const lite = args.includes('lite');
const cssAt = args.indexOf('--css');
const css = cssAt >= 0 ? readFileSync(args[cssAt + 1], 'utf8') : null;
const adb = (...a) => execFileSync(ADB, a, { encoding: 'utf8' }).trim();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const key = k => adb('shell', 'input', 'keyevent', 'KEYCODE_DPAD_' + k);

const pid = adb('shell', 'pidof', PKG);
if (!pid) throw new Error('the app is not running');
adb('forward', `tcp:${PORT}`, `localabstract:webview_devtools_remote_${pid}`);
const page = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find(p => p.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r));
let id = 0;
const pending = new Map();
ws.addEventListener('message', e => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
});
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const run = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;

const info = await run(`({ ua: navigator.userAgent, w: innerWidth, h: innerHeight, dpr: devicePixelRatio })`);
console.log('WebView:', info.ua.match(/Chrome\/[\d.]+/)?.[0], `@${info.dpr}x`, lite ? 'LITE' : 'FULL', css ? `+ ${args[cssAt + 1]}` : '');

if (css) await run(`(() => { let s = document.getElementById('speedtest-css'); if (!s) { s = document.createElement('style');
  s.id = 'speedtest-css'; document.head.appendChild(s); } s.textContent = ${JSON.stringify(css)}; })()`);
await run(`(() => { if (document.documentElement.classList.contains('lite') !== ${lite})
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'l', bubbles: true })); })()`);
await sleep(800);

// focus a section's tab, then step down into its first row
async function start(tab) {
  await run(`TV.focus(document.querySelector('[data-tab="${tab}"]'))`);
  await sleep(700);
  key('DOWN');
  await sleep(900);
}

async function measure(label, keys, gap, wait = 700) {
  await run(`(() => { const g = window.__gen = (window.__gen || 0) + 1; window.__f = [];
    (function loop(t) { if (window.__gen !== g) return; window.__f.push(t); requestAnimationFrame(loop); })(performance.now()); })()`);
  for (const k of keys) { key(k); await sleep(gap); }
  await sleep(wait);
  const f = await run(`(() => { window.__gen++; return window.__f; })()`);
  const d = [];
  for (let i = 1; i < f.length; i++) d.push(f[i] - f[i - 1]);
  d.sort((a, b) => a - b);
  const total = f[f.length - 1] - f[0];
  const pct = p => d[Math.min(d.length - 1, Math.floor(d.length * p))].toFixed(0);
  const fps = d.length / total * 1000;
  console.log(`  ${label.padEnd(18)} ${fps.toFixed(0).padStart(3)} fps   p95 ${pct(.95).padStart(3)} ms   worst ${d[d.length - 1].toFixed(0).padStart(4)} ms   ${d.filter(x => x > 50).length} frames over 50 ms`);
  return fps;
}

const out = [];
await start(0);
out.push(await measure('home right x8', Array(8).fill('RIGHT'), 450));
await start(0);
out.push(await measure('home down/up x6', ['DOWN', 'DOWN', 'UP', 'UP', 'DOWN', 'UP'], 550));
await start(1);
out.push(await measure('apps down x6', Array(6).fill('DOWN'), 550));
out.push(await measure('apps up x6', Array(6).fill('UP'), 550));
console.log(`  average ${(out.reduce((a, b) => a + b) / out.length).toFixed(0)} fps`);
await run(`TV.focus(document.querySelector('[data-tab="0"]'))`);
ws.close();
adb('forward', '--remove', `tcp:${PORT}`);
