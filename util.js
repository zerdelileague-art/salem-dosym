// Общие помощники: экранирование, формулы (KaTeX), запросы, уведомления, конфетти, диалоги.
import { t } from './i18n.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Текст с формулами: всё вне $…$ экранируется, внутри — KaTeX
export function rich(text) {
  const s = String(text ?? '');
  const parts = [];
  const re = /\$\$([\s\S]+?)\$\$|\$((?:\\\$|[^$])+?)\$/g;
  let last = 0, m;
  while ((m = re.exec(s))) {
    parts.push(plain(s.slice(last, m.index)));
    const tex = m[1] ?? m[2];
    parts.push(math(tex, !!m[1]));
    last = re.lastIndex;
  }
  parts.push(plain(s.slice(last)));
  return parts.join('');
}
const plain = s => esc(s.replace(/\\\$/g, '$')).replace(/\n/g, '<br>');
function math(tex, display) {
  try {
    if (window.katex) return window.katex.renderToString(tex, { throwOnError: false, displayMode: display, strict: 'ignore', trust: false, output: 'html' });
  } catch (e) { /* покажем как текст */ }
  return '<code>' + esc(tex) + '</code>';
}

export const imgUrl = id => (id && /^[a-f0-9]{32}$/.test(id) ? '/img/' + id : '');

export async function api(path, opts = {}) {
  const init = { method: opts.method || 'GET', headers: {}, credentials: 'same-origin' };
  if (opts.body instanceof Blob) { init.body = opts.body; init.headers['Content-Type'] = opts.body.type; }
  else if (opts.body !== undefined) { init.body = JSON.stringify(opts.body); init.headers['Content-Type'] = 'application/json'; }
  let res;
  try { res = await fetch(path, init); } catch (e) { throw Object.assign(new Error('offline'), { code: 'offline' }); }
  let data = null;
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) throw Object.assign(new Error(data?.error || 'server'), { code: data?.error || 'server', data, status: res.status });
  return data;
}

let toastTimer;
export function toast(msg, ms = 2600) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

export function fmtTime(ms) {
  const s = Math.max(0, Math.round((ms || 0) / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(r).padStart(2, '0');
}

// Диалог внутри страницы (вместо confirm)
export function ask(message, { ok = t('yes'), cancel = t('cancel'), danger = false } = {}) {
  return new Promise(resolve => {
    const ov = $('#overlay');
    ov.innerHTML = `<div class="card" role="dialog" aria-modal="true"><p class="motto" style="margin:0">${esc(message)}</p>
      <div class="row"><button class="btn" data-a="0">${esc(cancel)}</button><button class="btn ${danger ? 'danger' : 'primary'}" data-a="1">${esc(ok)}</button></div></div>`;
    ov.hidden = false;
    const done = v => { ov.hidden = true; ov.innerHTML = ''; document.removeEventListener('keydown', key); resolve(v); };
    const key = e => { if (e.key === 'Escape') done(false); };
    document.addEventListener('keydown', key);
    ov.onclick = e => { const b = e.target.closest('[data-a]'); if (b) done(b.dataset.a === '1'); else if (e.target === ov) done(false); };
    ov.querySelector('[data-a="1"]').focus();
  });
}

export function modal(html, { wide = false } = {}) {
  const ov = $('#overlay');
  ov.innerHTML = `<div class="card ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">${html}</div>`;
  ov.hidden = false;
  const close = () => { ov.hidden = true; ov.innerHTML = ''; document.removeEventListener('keydown', key); };
  const key = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', key);
  ov.onclick = e => { if (e.target === ov || e.target.closest('[data-close]')) close(); };
  return { el: ov.firstElementChild, close };
}

export function closeOverlay() { const ov = $('#overlay'); ov.hidden = true; ov.innerHTML = ''; }

// ---------- конфетти ----------
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let parts = [], raf = 0;
export function confetti(n = 140, origin) {
  if (reduce) return;
  const c = $('#confetti');
  const W = c.width = innerWidth * devicePixelRatio, H = c.height = innerHeight * devicePixelRatio;
  const cols = ['#ff6f8a', '#3fa7f5', '#f5b51f', '#2fbf86', '#9b7bff', '#ff8f4a', '#ffd45e', '#ff9fd0'];
  const ox = (origin?.x ?? .5) * W, oy = (origin?.y ?? .35) * H;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = (4 + Math.random() * 9) * devicePixelRatio;
    parts.push({ x: ox, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 6 * devicePixelRatio, r: (4 + Math.random() * 6) * devicePixelRatio,
      c: cols[i % cols.length], rot: Math.random() * 6, vr: (Math.random() - .5) * .4, life: 0, shape: i % 3 });
  }
  if (!raf) raf = requestAnimationFrame(step);
  function step() {
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    parts = parts.filter(p => p.life < 220 && p.y < H + 40);
    for (const p of parts) {
      p.life++; p.vy += .25 * devicePixelRatio; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c;
      if (p.shape === 0) ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
      else if (p.shape === 1) { ctx.beginPath(); ctx.arc(0, 0, p.r * .7, 0, 7); ctx.fill(); }
      else { ctx.beginPath(); ctx.moveTo(0, -p.r); ctx.lineTo(p.r, p.r); ctx.lineTo(-p.r, p.r); ctx.fill(); }
      ctx.restore();
    }
    raf = parts.length ? requestAnimationFrame(step) : (ctx.clearRect(0, 0, W, H), 0);
  }
}
export function rainConfetti(times = 4) {
  for (let i = 0; i < times; i++) setTimeout(() => confetti(90, { x: .15 + Math.random() * .7, y: .1 }), i * 600);
}

export function flash(text, kind = 'good') {
  const el = document.createElement('div');
  el.className = 'feedback ' + kind;
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

// Копия утверждённой кошечки с уникальными id градиентов
let catN = 0;
export function cloneCat() {
  const src = $('#homeKitty svg');
  if (!src) return '';
  const k = 'c' + (++catN);
  return src.outerHTML.replace(/id="(g\w+)"/g, `id="$1${k}"`).replace(/url\(#(g\w+)\)/g, `url(#$1${k})`);
}

// Сжатие рисунка перед загрузкой (до 1400px), SVG превращается в PNG
export function prepareImage(file) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) return reject(new Error('image'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const max = 1400;
      let w = img.naturalWidth || 800, h = img.naturalHeight || 600;
      const k = Math.min(1, max / Math.max(w, h));
      w = Math.round(w * k); h = Math.round(h * k);
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const ctx = cv.getContext('2d');
      const keepAlpha = /png|svg|gif|webp/.test(file.type);
      if (!keepAlpha) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); }
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      cv.toBlob(b => (b ? resolve(b) : reject(new Error('image'))), keepAlpha ? 'image/png' : 'image/jpeg', .88);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')); };
    img.src = url;
  });
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) {}
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy'); ta.remove(); return ok;
  } catch (e) { return false; }
}

// Единое WebSocket-соединение
let sock = null;
export function socket() {
  if (!sock) sock = window.io({ transports: ['websocket', 'polling'], reconnectionDelayMax: 4000 });
  return sock;
}
export function emit(ev, data, timeout = 8000) {
  return new Promise(resolve => {
    const s = socket();
    let done = false;
    const timer = setTimeout(() => { if (!done) { done = true; resolve({ error: 'offline' }); } }, timeout);
    s.emit(ev, data, r => { if (done) return; done = true; clearTimeout(timer); resolve(r || { error: 'server' }); });
  });
}
