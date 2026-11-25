// Точка входа: язык, фон, приветствие, маршруты (ученик / кабинет учителя).
import { t, setLang, applyStatic, onLang } from './i18n.js';
import { $, $$, esc } from './util.js';

export function showView(name) {
  $$('.view').forEach(v => v.classList.toggle('is-active', v.dataset.view === name));
  window.scrollTo(0, 0);
}

// ---------- надпись: буквы появляются по очереди ----------
function drawHello() {
  const h = $('#hello');
  const text = t('hello');
  let i = 0;
  h.setAttribute('aria-label', text);
  h.innerHTML = text.split(' ').map(word =>
    '<span class="w" aria-hidden="true">' +
    [...word].map(ch => '<span class="l" style="animation-delay:' + (0.15 + 0.06 * i++).toFixed(2) + 's">' + esc(ch) + '</span>').join('') +
    '</span>').join(' ');
  document.title = text;
}

// ---------- фон: облака, звёзды и частицы ----------
function drawSky() {
  const sky = $('#sky');
  let seed = 7;
  const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  const cloudSVG = '<svg viewBox="0 0 200 100"><path d="M48 90 C18 90 8 66 28 56 C22 30 54 20 70 36 C80 10 126 10 132 38 C152 24 182 36 176 60 C196 66 190 90 164 90 Z" fill="#fff"/></svg>';
  const starSVG = c => '<svg viewBox="0 0 24 24"><path d="M12 0 C13 8 16 11 24 12 C16 13 13 16 12 24 C11 16 8 13 0 12 C8 11 11 8 12 0 Z" fill="' + c + '"/></svg>';
  let html = '';
  [[8, 150, 70], [22, 110, 95], [64, 190, 80], [80, 130, 110], [44, 90, 120]].forEach(([top, w, dur]) => {
    html += '<div class="cloud" style="top:' + top + '%;width:' + w + 'px;opacity:' + (0.6 + rnd() * 0.35).toFixed(2) +
      ';animation-duration:' + dur + 's;animation-delay:-' + (rnd() * dur).toFixed(1) + 's">' + cloudSVG + '</div>';
  });
  const colors = ['#fff', '#fff6b8', '#ffe08a', '#fff'];
  for (let k = 0; k < 22; k++) {
    const s = 8 + rnd() * 14;
    html += '<div class="star" style="left:' + (rnd() * 96).toFixed(1) + '%;top:' + (rnd() * 94).toFixed(1) + '%;width:' + s.toFixed(0) +
      'px;height:' + s.toFixed(0) + 'px;animation-duration:' + (2.2 + rnd() * 2.8).toFixed(1) + 's;animation-delay:-' + (rnd() * 4).toFixed(1) + 's">' +
      starSVG(colors[k % colors.length]) + '</div>';
  }
  for (let k = 0; k < 16; k++) {
    const s = 10 + rnd() * 22;
    html += '<div class="dot" style="left:' + (rnd() * 98).toFixed(1) + '%;top:' + (rnd() * 96).toFixed(1) + '%;width:' + s.toFixed(0) +
      'px;height:' + s.toFixed(0) + 'px;animation-duration:' + (5 + rnd() * 5).toFixed(1) + 's;animation-delay:-' + (rnd() * 6).toFixed(1) + 's"></div>';
  }
  sky.insertAdjacentHTML('beforeend', html);
}

// ---------- вход ученика ----------
function wireJoin() {
  const form = $('#joinForm'), nameIn = $('#joinName'), codeIn = $('#joinCode'), err = $('#joinError'), btn = $('#joinBtn');
  codeIn.addEventListener('input', () => { codeIn.value = codeIn.value.replace(/\D/g, '').slice(0, 6); });
  nameIn.addEventListener('keydown', e => { if (e.key === 'Enter' && !codeIn.value) { e.preventDefault(); codeIn.focus(); } });
  let lastErr = null;
  const showErr = code => { lastErr = code; err.textContent = code ? t('err.' + code) : ''; };
  onLang(() => showErr(lastErr));
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const name = nameIn.value.trim(), code = codeIn.value.trim();
    if (!name) { showErr('name_required'); nameIn.focus(); return; }
    if (!/^\d{6}$/.test(code)) { showErr('code_required'); codeIn.focus(); return; }
    showErr(null);
    btn.disabled = true;
    try {
      const { join } = await import('./student.js');
      const r = await join(code, name);
      if (r.error) showErr(t('err.' + r.error) !== 'err.' + r.error ? r.error : 'server');
    } finally { btn.disabled = false; }
  });
}

async function route() {
  const p = location.pathname;
  let m;
  if (p === '/teacher' || p.startsWith('/teacher/')) {
    const { startTeacher } = await import('./teacher.js');
    showView('stage');
    return startTeacher();
  }
  if ((m = p.match(/^\/play\/(\d{6})$/))) {
    const { tryResume } = await import('./student.js');
    if (await tryResume(m[1])) return;
    $('#joinCode').value = m[1];
    history.replaceState(null, '', '/join/' + m[1]);
  }
  if ((m = location.pathname.match(/^\/join\/(\d{6})$/))) $('#joinCode').value = m[1];
  showView('home');
}

$$('.lang button').forEach(b => b.addEventListener('click', () => setLang(b.dataset.lang)));
onLang(drawHello);
applyStatic();
drawHello();
drawSky();
wireJoin();
route();
window.addEventListener('popstate', route);
