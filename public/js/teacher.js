// Кабинет организатора: вход, наборы заданий, конструктор, управление игрой, итоги.
import { t, getLang, onLang } from './i18n.js';
import { $, $$, esc, rich, imgUrl, api, toast, ask, modal, fmtTime, prepareImage, copyText, emit, socket, rainConfetti } from './util.js';
import { animalSVG } from './animals.js';
import { renderRace } from './race.js';
import { podiumHTML, tableHTML } from './podium.js';

const stage = () => $('#stage');
let me = null;
let cleanup = null;
let dirtyGuard = null;   // функция, возвращающая true, если есть несохранённые изменения

function nav(path) {
  if (location.pathname !== path) history.pushState(null, '', path);
  startTeacher();
}
async function guardedNav(path) {
  if (dirtyGuard && dirtyGuard() && !(await ask(t('confirmLeave')))) return;
  dirtyGuard = null;
  nav(path);
}
window.addEventListener('beforeunload', e => { if (dirtyGuard && dirtyGuard()) { e.preventDefault(); e.returnValue = ''; } });
onLang(() => { if (location.pathname.startsWith('/teacher')) rerender?.(); });
let rerender = null;

export async function startTeacher() {
  if (cleanup) { cleanup(); cleanup = null; }
  rerender = null;
  dirtyGuard = null;
  document.body.classList.remove('projector');
  try { me = (await api('/api/auth/me')).teacher; } catch (e) { me = null; }
  if (!me) return drawAuth();
  const p = location.pathname;
  let m;
  if ((m = p.match(/^\/teacher\/quiz\/(new|[a-f0-9]+)$/))) return drawEditor(m[1] === 'new' ? null : m[1]);
  if ((m = p.match(/^\/teacher\/game\/(\d{6})$/))) return drawHost(m[1]);
  return drawDashboard();
}

// ---------- вход / регистрация ----------
function drawAuth(mode = 'login') {
  rerender = () => drawAuth(mode);
  const reg = mode === 'register';
  stage().innerHTML = `<form class="card auth" id="authForm" novalidate>
    <h2>${esc(t('cabinet'))}</h2>
    <p class="muted" style="margin:0 0 6px;text-align:center">${esc(t('teacherNote'))}</p>
    ${reg ? `<label class="field-label" for="aName">${esc(t('yourName'))}</label><input class="field" id="aName" maxlength="60" autocomplete="name">` : ''}
    <label class="field-label" for="aLogin">${esc(t('loginLabel'))}</label><input class="field" id="aLogin" maxlength="40" autocomplete="username" autocapitalize="off" spellcheck="false">
    <label class="field-label" for="aPass">${esc(t('password'))}</label><input class="field" id="aPass" type="password" autocomplete="${reg ? 'new-password' : 'current-password'}">
    <div id="codeWrap" hidden><label class="field-label" for="aCode">${esc(t('signupCode'))}</label><input class="field" id="aCode" maxlength="80"></div>
    <p class="form-error" id="aErr" role="alert"></p>
    <button class="btn primary huge" type="submit">${esc(reg ? t('register') : t('login'))}</button>
    <button class="linkbtn" type="button" id="aSwitch">${esc(reg ? t('haveAccount') : t('noAccount'))}</button>
    <a class="teacher-link" href="/" style="text-align:center">${esc(t('toHome'))}</a>
  </form>`;
  if (reg) api('/api/auth/me').then(r => { $('#codeWrap') && ($('#codeWrap').hidden = !r.signupCode); }).catch(() => {});
  $('#aSwitch').onclick = () => drawAuth(reg ? 'login' : 'register');
  $('#authForm').onsubmit = async e => {
    e.preventDefault();
    const body = { login: $('#aLogin').value, password: $('#aPass').value };
    if (reg) { body.name = $('#aName').value; body.code = $('#aCode').value; if (!body.name.trim()) { $('#aErr').textContent = t('err.name_req2'); return; } }
    try {
      await api(reg ? '/api/auth/register' : '/api/auth/login', { method: 'POST', body });
      startTeacher();
    } catch (err) { $('#aErr').textContent = t('err.' + err.code) !== 'err.' + err.code ? t('err.' + err.code) : t('err.server'); }
  };
}

// ---------- кабинет ----------
async function drawDashboard() {
  rerender = drawDashboard;
  stage().innerHTML = `<div class="panel">
    <div class="phead"><h1>${esc(t('cabinet'))}</h1><div class="row"><span class="who"></span><button class="btn small" id="logout">${esc(t('logout'))}</button></div></div>
    <section class="card" style="display:grid;gap:14px">
      <div class="row" style="justify-content:space-between"><h2 class="h2" style="font-size:28px">${esc(t('myQuizzes'))}</h2>
        <button class="btn primary" id="newQuiz">＋ ${esc(t('newQuiz'))}</button></div>
      <div class="grid" id="quizzes"><p class="muted">…</p></div>
    </section>
    <section class="card" style="display:grid;gap:14px">
      <h2 class="h2" style="font-size:28px">${esc(t('history'))}</h2>
      <div id="games"><p class="muted">…</p></div>
    </section>
  </div>`;
  $('.phead .who').textContent = me.name;
  $('#logout').onclick = async () => { await api('/api/auth/logout', { method: 'POST' }).catch(() => {}); me = null; drawAuth(); };
  $('#newQuiz').onclick = () => nav('/teacher/quiz/new');

  const [quizzes, games] = await Promise.all([api('/api/quizzes').catch(() => []), api('/api/games').catch(() => [])]);
  const qbox = $('#quizzes');
  if (!qbox) return;
  qbox.innerHTML = quizzes.length ? quizzes.map(q => `<div class="card qz" data-id="${esc(q.id)}" style="box-shadow:none;border:2px solid var(--line)">
      <div><h3>${esc(q.title)}</h3><div class="meta">${esc(t('qCount', { n: q.count }))} · ${esc(new Date(q.updatedAt).toLocaleDateString(getLang() === 'ru' ? 'ru-RU' : 'kk-KZ'))}</div></div>
      <div class="row"><button class="btn primary small" data-act="game">▶ ${esc(t('createGame'))}</button>
        <button class="btn small" data-act="edit">${esc(t('edit'))}</button>
        <button class="btn small ghost" data-act="dup">${esc(t('duplicate'))}</button>
        <button class="btn small danger" data-act="del">${esc(t('del'))}</button></div></div>`).join('')
    : `<p class="empty">${esc(t('emptyQuizzes'))}</p>`;
  qbox.onclick = async e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const card = b.closest('[data-id]'), id = card.dataset.id, title = card.querySelector('h3').textContent;
    b.disabled = true;
    try {
      if (b.dataset.act === 'edit') return nav('/teacher/quiz/' + id);
      if (b.dataset.act === 'game') { const r = await api('/api/games', { method: 'POST', body: { quizId: id } }); return nav('/teacher/game/' + r.code); }
      if (b.dataset.act === 'dup') { await api(`/api/quizzes/${id}/duplicate`, { method: 'POST' }); return drawDashboard(); }
      if (b.dataset.act === 'del' && await ask(t('confirmDelete', { t: title }), { ok: t('del'), danger: true })) {
        await api('/api/quizzes/' + id, { method: 'DELETE' }); return drawDashboard();
      }
    } catch (err) { toast(t('err.' + err.code) !== 'err.' + err.code ? t('err.' + err.code) : t('err.server')); }
    finally { b.disabled = false; }
  };

  const gbox = $('#games');
  gbox.innerHTML = games.length ? `<div class="tablewrap" style="box-shadow:none"><table><thead><tr><th>${esc(t('date'))}</th><th>${esc(t('quizTitle'))}</th>
      <th class="num">${esc(t('roomCode'))}</th><th>${esc(t('status'))}</th><th class="num">${esc(t('players'))}</th><th></th></tr></thead><tbody>
      ${games.map(g => `<tr><td>${esc(new Date(g.createdAt).toLocaleString(getLang() === 'ru' ? 'ru-RU' : 'kk-KZ', { dateStyle: 'short', timeStyle: 'short' }))}</td>
        <td class="nm">${esc(g.title)}</td><td class="num">${esc(g.code)}</td><td><span class="pill ${esc(g.status)}">${esc(t('st.' + g.status))}</span></td>
        <td class="num">${g.players}</td><td><div class="row" style="flex-wrap:nowrap"><button class="btn small" data-open="${esc(g.code)}">${esc(t('open'))}</button>
        ${g.status === 'ended' ? `<a class="btn small ghost" href="/api/games/${esc(g.code)}/results.xlsx?lang=${getLang()}&tz=${new Date().getTimezoneOffset()}" download>Excel</a>` : ''}</div></td></tr>`).join('')}
      </tbody></table></div>` : `<p class="empty">${esc(t('emptyGames'))}</p>`;
  gbox.onclick = e => { const b = e.target.closest('[data-open]'); if (b) nav('/teacher/game/' + b.dataset.open); };
}

// ---------- конструктор заданий ----------
const rid = () => Math.random().toString(36).slice(2, 10);
const newQuestion = () => ({
  id: rid(), type: 'choice', text: '', image: null, points: 100, time: 0, answerKind: 'number', answers: [],
  options: [0, 1, 2, 3].map(() => ({ id: rid(), text: '', correct: false }))
});
const MATH = [
  ['a/b', '\\frac{}{}', 6], ['x²', '^{2}', 3], ['xⁿ', '^{}', 2], ['√', '\\sqrt{}', 6], ['ⁿ√', '\\sqrt[]{}', 6], ['x₁', '_{}', 2],
  ['×', '\\times ', 7], ['÷', '\\div ', 5], ['±', '\\pm ', 4], ['≤', '\\le ', 4], ['≥', '\\ge ', 4], ['≠', '\\ne ', 4], ['≈', '\\approx ', 8],
  ['π', '\\pi ', 4], ['°', '^\\circ ', 6], ['∠', '\\angle ', 7], ['△', '\\triangle ', 10], ['⊥', '\\perp ', 6], ['∥', '\\parallel ', 10],
  ['∞', '\\infty ', 7], ['α', '\\alpha ', 7], ['β', '\\beta ', 6], ['|x|', '\\left|  \\right|', 7]
];

async function drawEditor(id) {
  let quiz = { id: null, title: '', questions: [newQuestion()] };
  if (id) {
    try { quiz = await api('/api/quizzes/' + id); }
    catch (e) { toast(t('err.server')); return nav('/teacher'); }
    quiz.questions.forEach(q => {
      q.options = (q.options || []).map(o => ({ ...o }));
      q.answers = q.answers || [];
      q.answerKind = q.answerKind || 'number';
      if (!q.options.length) q.options = [0, 1, 2, 3].map(() => ({ id: rid(), text: '', correct: false }));
    });
  }
  let dirty = false, saving = false;
  dirtyGuard = () => dirty;
  rerender = () => renderAll();

  stage().innerHTML = `<div class="panel">
    <div class="editor-bar">
      <button class="btn small" id="eBack">← ${esc(t('back'))}</button>
      <input class="field" id="eTitle" maxlength="120">
      <span class="status-note" id="eNote"></span>
      <button class="btn small ok" id="eSave"></button>
      <button class="btn small primary" id="eGame"></button>
    </div>
    <div id="eList" style="display:grid;gap:16px"></div>
    <div class="row" style="justify-content:center">
      <button class="btn primary" id="eAdd"></button>
      <button class="btn" id="eBank"></button>
    </div>
  </div>`;

  const list = $('#eList');
  const setDirty = v => { dirty = v; note(); };
  function note() {
    const n = $('#eNote');
    if (!n) return;
    n.textContent = saving ? t('saving') : dirty ? t('unsaved') : (quiz.id ? t('saved') : '');
    n.classList.toggle('dirty', dirty);
  }
  function renderAll() {
    $('#eBack').textContent = '← ' + t('back');
    $('#eTitle').placeholder = t('quizTitlePh');
    $('#eTitle').setAttribute('aria-label', t('quizTitle'));
    $('#eSave').textContent = t('save');
    $('#eGame').textContent = '▶ ' + t('createGame');
    $('#eAdd').textContent = '＋ ' + t('addQuestion');
    $('#eBank').textContent = t('fromBank');
    list.innerHTML = quiz.questions.length ? quiz.questions.map((q, i) => qHTML(q, i)).join('') : `<p class="card empty">${esc(t('noQuestions'))}</p>`;
    note();
  }

  function qHTML(q, i) {
    const n = quiz.questions.length;
    const ans = q.type === 'choice'
      ? `<div style="display:grid;gap:8px"><span class="field-label">${esc(t('options'))}</span>
          ${q.options.map((o, j) => `<div class="opt-edit" data-j="${j}">
            <span class="sw opt c${j % 8}" style="min-height:0;padding:0;box-shadow:none"></span>
            <input class="field o-text" data-k="otext" value="${esc(o.text)}" maxlength="500" placeholder="${esc(t('optPh', { n: j + 1 }))}">
            <div class="row" style="flex-wrap:nowrap;gap:4px"><label class="cor"><input type="checkbox" data-k="ocor" ${o.correct ? 'checked' : ''}>${esc(t('correctOpt'))}</label>
            <button class="btn icon small ghost" data-act="odel" aria-label="${esc(t('del'))}" ${q.options.length <= 2 ? 'disabled' : ''}>✕</button></div>
            <div class="optprev">${/\$/.test(o.text) ? rich(o.text) : ''}</div></div>`).join('')}
          ${q.options.length < 8 ? `<div><button class="btn small" data-act="oadd">＋ ${esc(t('addOption'))}</button></div>` : ''}</div>`
      : `<div style="display:grid;gap:8px">
          <span class="field-label">${esc(t('answerKind'))}</span>
          <div class="seg" data-k="kind"><button type="button" data-v="number" class="${q.answerKind === 'number' ? 'on' : ''}">${esc(t('kindNumber'))}</button><button type="button" data-v="text" class="${q.answerKind === 'text' ? 'on' : ''}">${esc(t('kindText'))}</button></div>
          <label class="field-label" for="ans${q.id}">${esc(t('answers'))}</label>
          <textarea class="field" id="ans${q.id}" data-k="answers" rows="2" style="min-height:64px">${esc(q.answers.join('\n'))}</textarea>
          <small class="muted">${esc(t('answersHint'))}</small></div>`;
    return `<div class="card qe" data-i="${i}" id="q-${q.id}">
      <div class="qe-top"><span class="n">${i + 1}</span>
        <div class="seg" data-k="type"><button type="button" data-v="choice" class="${q.type === 'choice' ? 'on' : ''}">${esc(t('typeChoice'))}</button><button type="button" data-v="input" class="${q.type === 'input' ? 'on' : ''}">${esc(t('typeInput'))}</button></div>
        <span class="grow"></span>
        <button class="btn icon small ghost" data-act="up" aria-label="${esc(t('up'))}" title="${esc(t('up'))}" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button class="btn icon small ghost" data-act="down" aria-label="${esc(t('down'))}" title="${esc(t('down'))}" ${i === n - 1 ? 'disabled' : ''}>↓</button>
        <button class="btn icon small ghost" data-act="copy" aria-label="${esc(t('copyQ'))}" title="${esc(t('copyQ'))}">⧉</button>
        <button class="btn icon small danger" data-act="qdel" aria-label="${esc(t('removeQ'))}" title="${esc(t('removeQ'))}">✕</button>
      </div>
      <div class="cols">
        <div style="display:grid;gap:8px;align-content:start">
          <label class="field-label" for="txt${q.id}">${esc(t('qText'))}</label>
          <div class="mathbar">${MATH.map((m, k) => `<button type="button" data-m="${k}" title="${esc(m[1].trim())}">${esc(m[0])}</button>`).join('')}</div>
          <textarea class="field" id="txt${q.id}" data-k="text" maxlength="3000">${esc(q.text)}</textarea>
          <small class="muted">${esc(t('textHint'))}</small>
          <div class="imgbox">${q.image ? `<img src="${imgUrl(q.image)}" alt=""><button class="btn small danger" data-act="imgdel">${esc(t('removeImage'))}</button>`
            : `<label class="btn small"><input type="file" accept="image/*" data-k="img" hidden>🖼 ${esc(t('addImage'))}</label><small class="muted">${esc(t('imgHint'))}</small>`}</div>
        </div>
        <div style="display:grid;gap:8px;align-content:start">
          <span class="field-label">${esc(t('preview'))}</span>
          <div class="preview" data-prev>${q.text.trim() ? rich(q.text) : `<span class="ph">${esc(t('previewPh'))}</span>`}</div>
        </div>
      </div>
      ${ans}
      <div class="settings">
        <label>${esc(t('points'))}<input class="field" type="number" min="0" max="10000" step="10" data-k="points" value="${q.points}"></label>
        <div style="display:grid;gap:4px"><span class="field-label" style="margin:0;font-size:14px">${esc(t('timerLabel'))}</span>
          <div class="seg" data-k="timer"><button type="button" data-v="off" class="${q.time ? '' : 'on'}">${esc(t('timerOff'))}</button><button type="button" data-v="on" class="${q.time ? 'on' : ''}">${esc(t('timerOn'))}</button></div></div>
        ${q.time ? `<label>${esc(t('seconds'))}<input class="field" type="number" min="5" max="3600" step="5" data-k="time" value="${q.time}"></label>` : ''}
      </div>
    </div>`;
  }

  const qOf = el => { const c = el.closest('.qe'); return c ? { card: c, i: Number(c.dataset.i), q: quiz.questions[Number(c.dataset.i)] } : {}; };
  const redrawQ = i => { const c = list.querySelector(`.qe[data-i="${i}"]`); if (c) { c.outerHTML = qHTML(quiz.questions[i], i); } };

  // Ввод текста
  list.addEventListener('input', e => {
    const k = e.target.dataset.k;
    const { card, q } = qOf(e.target);
    if (!q) return;
    if (k === 'text') { q.text = e.target.value; card.querySelector('[data-prev]').innerHTML = q.text.trim() ? rich(q.text) : `<span class="ph">${esc(t('previewPh'))}</span>`; }
    else if (k === 'otext') { const j = Number(e.target.closest('.opt-edit').dataset.j); q.options[j].text = e.target.value; e.target.closest('.opt-edit').querySelector('.optprev').innerHTML = /\$/.test(e.target.value) ? rich(e.target.value) : ''; }
    else if (k === 'answers') q.answers = e.target.value.split('\n').map(s => s.trim()).filter(Boolean);
    else if (k === 'points') q.points = Math.max(0, Math.round(Number(e.target.value) || 0));
    else if (k === 'time') q.time = Math.max(0, Math.round(Number(e.target.value) || 0));
    else return;
    card.classList.remove('err');
    setDirty(true);
  });
  list.addEventListener('change', async e => {
    const k = e.target.dataset.k;
    const { i, q } = qOf(e.target);
    if (!q) return;
    if (k === 'ocor') { q.options[Number(e.target.closest('.opt-edit').dataset.j)].correct = e.target.checked; setDirty(true); }
    if (k === 'time' && q.time > 0 && q.time < 5) { q.time = 5; e.target.value = 5; }
    if (k === 'img' && e.target.files[0]) await attach(i, e.target.files[0]);
  });
  list.addEventListener('paste', async e => {
    const { i, q } = qOf(e.target);
    if (!q) return;
    const file = [...(e.clipboardData?.items || [])].find(it => it.type.startsWith('image/'))?.getAsFile();
    if (file) { e.preventDefault(); await attach(i, file); }
  });
  let lastField = null;
  list.addEventListener('focusin', e => { if (e.target.matches('textarea[data-k="text"], input[data-k="otext"]')) lastField = e.target; });

  async function attach(i, file) {
    try {
      const blob = await prepareImage(file);
      if (blob.size > 3 * 1024 * 1024) throw Object.assign(new Error(), { code: 'too_large' });
      const r = await api('/api/images', { method: 'POST', body: blob });
      quiz.questions[i].image = r.id;
      redrawQ(i); setDirty(true);
    } catch (err) { toast(t('err.' + (err.code === 'too_large' ? 'too_large' : 'image'))); }
  }

  list.addEventListener('click', async e => {
    const { card, i, q } = qOf(e.target);
    if (!q) return;
    const seg = e.target.closest('.seg button');
    if (seg) {
      const k = seg.parentElement.dataset.k, v = seg.dataset.v;
      if (k === 'type') q.type = v;
      if (k === 'kind') q.answerKind = v;
      if (k === 'timer') q.time = v === 'on' ? (q.time || 30) : 0;
      redrawQ(i); setDirty(true); return;
    }
    const mb = e.target.closest('[data-m]');
    if (mb) {
      const field = lastField && card.contains(lastField) ? lastField : card.querySelector('textarea[data-k="text"]');
      insertMath(field, MATH[Number(mb.dataset.m)]);
      return;
    }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    const Q = quiz.questions;
    if (act === 'up' && i > 0) [Q[i - 1], Q[i]] = [Q[i], Q[i - 1]];
    else if (act === 'down' && i < Q.length - 1) [Q[i + 1], Q[i]] = [Q[i], Q[i + 1]];
    else if (act === 'copy') Q.splice(i + 1, 0, { ...structuredClone(q), id: rid(), options: q.options.map(o => ({ ...o, id: rid() })) });
    else if (act === 'qdel') { if (!(await ask(t('confirmRemoveQ'), { ok: t('del'), danger: true }))) return; Q.splice(i, 1); }
    else if (act === 'oadd') q.options.push({ id: rid(), text: '', correct: false });
    else if (act === 'odel') q.options.splice(Number(e.target.closest('.opt-edit').dataset.j), 1);
    else if (act === 'imgdel') q.image = null;
    else return;
    renderAll(); setDirty(true);
    if (act === 'copy' || act === 'up' || act === 'down') $(`#q-${Q[act === 'copy' ? i + 1 : act === 'up' ? i - 1 : i + 1].id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  function insertMath(field, [, tex, caret]) {
    const v = field.value, s = field.selectionStart ?? v.length, en = field.selectionEnd ?? s;
    const before = v.slice(0, s).replace(/\\\$/g, '');
    const inside = ((before.match(/\$/g) || []).length % 2) === 1;
    const ins = inside ? tex : '$' + tex + '$';
    field.value = v.slice(0, s) + ins + v.slice(en);
    const pos = s + (inside ? 0 : 1) + Math.min(caret, tex.length);
    field.focus();
    field.setSelectionRange(pos, pos);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  }

  $('#eTitle').value = quiz.title;
  $('#eTitle').addEventListener('input', e => { quiz.title = e.target.value; setDirty(true); });
  $('#eBack').onclick = () => guardedNav('/teacher');
  $('#eAdd').onclick = () => {
    quiz.questions.push(newQuestion()); renderAll(); setDirty(true);
    $(`#q-${quiz.questions.at(-1).id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  $('#eSave').onclick = save;
  $('#eGame').onclick = async () => {
    if (dirty || !quiz.id) { if (!(await save())) return; }
    try { const r = await api('/api/games', { method: 'POST', body: { quizId: quiz.id } }); dirtyGuard = null; nav('/teacher/game/' + r.code); }
    catch (err) { toast(t('err.' + err.code) !== 'err.' + err.code ? t('err.' + err.code) : t('err.server')); }
  };
  $('#eBank').onclick = openBank;
  document.addEventListener('keydown', saveKey);
  cleanup = () => document.removeEventListener('keydown', saveKey);
  function saveKey(e) { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); } }

  async function save() {
    if (saving) return false;
    saving = true; note();
    $$('.qe.err').forEach(c => c.classList.remove('err'));
    const body = { title: quiz.title, questions: quiz.questions };
    try {
      const r = quiz.id ? await api('/api/quizzes/' + quiz.id, { method: 'PUT', body }) : await api('/api/quizzes', { method: 'POST', body });
      const fresh = !quiz.id;
      quiz.id = r.id;
      // id заданий и вариантов — как на сервере (нужно для повторного использования)
      r.questions.forEach((sq, k) => { if (quiz.questions[k]) { quiz.questions[k].id = sq.id; if (sq.options) quiz.questions[k].options.forEach((o, j) => { if (sq.options[j]) o.id = sq.options[j].id; }); } });
      if (fresh) history.replaceState(null, '', '/teacher/quiz/' + r.id);
      saving = false; setDirty(false);
      toast(t('saved'));
      return true;
    } catch (err) {
      saving = false; note();
      const d = err.data || {};
      if (d.error && t('v.' + d.error) !== 'v.' + d.error) {
        toast(t('v.' + d.error, { i: (d.index ?? 0) + 1 }), 4000);
        if (d.index != null) { const c = list.querySelector(`.qe[data-i="${d.index}"]`); c?.classList.add('err'); c?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        else $('#eTitle').focus();
      } else toast(t('err.' + err.code) !== 'err.' + err.code ? t('err.' + err.code) : t('err.server'));
      return false;
    }
  }

  async function openBank() {
    let sets = [];
    try { sets = await api('/api/bank'); } catch (e) { toast(t('err.server')); return; }
    sets = sets.filter(s => s.id !== quiz.id && s.questions.length);
    const m = modal(`<h2 class="h2" style="font-size:28px">${esc(t('bankTitle'))}</h2>
      <div style="display:grid">${sets.length ? sets.map((s, si) => `<p class="bank-title">${esc(s.title)}</p>` + s.questions.map((q, qi) => `
        <label class="bank-q"><input type="checkbox" data-s="${si}" data-q="${qi}"><span>${rich(q.text.slice(0, 300)) || '🖼'}${q.image ? ' 🖼' : ''}</span></label>`).join('')).join('')
        : `<p class="empty">${esc(t('bankEmpty'))}</p>`}</div>
      <div class="row" style="justify-content:flex-end"><button class="btn" data-close>${esc(t('cancel'))}</button><button class="btn primary" id="bankAdd">${esc(t('bankAdd'))}</button></div>`, { wide: true });
    $('#bankAdd', m.el).onclick = () => {
      const picked = $$('input[type=checkbox]:checked', m.el).map(c => sets[c.dataset.s].questions[c.dataset.q]);
      if (!picked.length) return m.close();
      for (const q of picked) {
        const c = structuredClone(q);
        c.id = rid();
        c.options = (c.options || [0, 1, 2, 3].map(() => ({ text: '', correct: false }))).map(o => ({ ...o, id: rid() }));
        c.answers = c.answers || []; c.answerKind = c.answerKind || 'number';
        quiz.questions.push(c);
      }
      m.close(); renderAll(); setDirty(true);
    };
  }

  renderAll();
  if (!id) $('#eTitle').focus();
}

// ---------- проведение игры ----------
async function drawHost(code) {
  const s = socket();
  let view = null, recvAt = 0, screen = null, cfg = {};
  try { cfg = await api('/api/config'); } catch (e) {}
  const joinUrl = (cfg.publicUrl || location.origin).replace(/\/$/, '') + '/join/' + code;

  const onHost = v => { view = v; recvAt = Date.now(); render(); };
  const watch = async () => {
    const r = await emit('host:watch', { code });
    if (r.error) {
      if (r.error === 'auth') return drawAuth();
      stage().innerHTML = `<div class="card center-col"><p class="motto">${esc(t('err.no_room'))}</p><button class="btn primary" id="back">${esc(t('toCabinet'))}</button></div>`;
      $('#back').onclick = () => nav('/teacher');
      return;
    }
    onHost(r.view);
  };
  s.on('host', onHost);
  s.on('connect', watch);
  const clock = setInterval(tickClock, 500);
  const fsExit = () => { if (!document.fullscreenElement) document.body.classList.remove('projector'); };
  const online = () => { s.disconnect(); s.connect(); };
  window.addEventListener('online', online);
  document.addEventListener('fullscreenchange', fsExit);
  cleanup = () => {
    s.off('host', onHost); s.off('connect', watch); clearInterval(clock);
    document.removeEventListener('fullscreenchange', fsExit);
    window.removeEventListener('online', online);
    document.body.classList.remove('projector');
    emit('player:leave', {});
  };
  rerender = () => { screen = null; render(); };

  stage().innerHTML = `<div class="panel"><p class="muted">…</p></div>`;
  if (s.connected) watch();

  function tickClock() {
    const el = $('#clock');
    if (!el || !view) return;
    el.textContent = fmtTime(view.gameMs + (view.status === 'running' ? Date.now() - recvAt : 0));
  }

  function render() {
    if (!view) return;
    const want = view.status === 'lobby' ? 'lobby' : view.status === 'ended' ? 'ended' : 'live';
    if (want !== screen) { screen = want; ({ lobby: drawLobby, live: drawLive, ended: drawEnded })[want](); }
    ({ lobby: updLobby, live: updLive, ended: () => {} })[screen]();
  }

  const corner = (qr = true) => `<div class="cornercode">${qr ? `<img src="/qr/${esc(code)}.svg" alt=""><span>${esc(code)}</span>` : ''}
    <button class="btn small" id="exitProj">${esc(t('exitProjector'))}</button></div>`;
  const projBtn = () => `<button class="btn" id="proj">⛶ ${esc(t('projector'))}</button>`;
  function wireProj() {
    $('#proj')?.addEventListener('click', async () => {
      document.body.classList.add('projector');
      try { await document.documentElement.requestFullscreen?.(); } catch (e) {}
    });
    $('#exitProj')?.addEventListener('click', async () => {
      document.body.classList.remove('projector');
      try { if (document.fullscreenElement) await document.exitFullscreen(); } catch (e) {}
    });
  }

  function drawLobby() {
    stage().innerHTML = `<div class="panel">
      <div class="phead"><h1 id="hTitle"></h1><div class="row ctl"><button class="btn small" id="toCab">← ${esc(t('toCabinet'))}</button>${projBtn()}</div></div>
      <div class="host-lobby">
        <div class="card joinbox">
          <span class="field-label">${esc(t('roomCode'))}</span>
          <div class="bigcode">${esc(code)}</div>
          <span class="field-label">${esc(t('joinAt'))}</span>
          <div class="url" id="jurl"></div>
          <button class="btn small ctl" id="copy">${esc(t('copyLink'))}</button>
        </div>
        <div class="card joinbox">
          <div class="qr"><img src="/qr/${esc(code)}.svg" alt="QR"></div>
          <span class="muted">${esc(t('scanQr'))}</span>
        </div>
      </div>
      <section class="card" style="display:grid;gap:14px">
        <div class="row" style="justify-content:space-between"><p class="motto" style="margin:0" id="joined"></p>
          <button class="btn primary huge ctl" id="start">▶ ${esc(t('startGame'))}</button></div>
        <div class="chips" id="hchips"></div>
        <p class="lead dots" id="waitP" style="text-align:center">${esc(t('waitPlayers'))}</p>
      </section>
      ${corner(false)}
    </div>`;
    $('#hTitle').textContent = view.title;
    $('#jurl').textContent = joinUrl;
    $('#toCab').onclick = () => nav('/teacher');
    $('#copy').onclick = async () => toast((await copyText(joinUrl)) ? t('copied') : t('copyFail'));
    $('#start').onclick = async () => {
      if (!view.players.length) return toast(t('needPlayers'));
      const r = await emit('host:start', {});
      if (r.view) onHost(r.view); else toast(t('err.server'));
    };
    $('#hchips').onclick = async e => {
      const x = e.target.closest('.x');
      if (!x) return;
      const r = await emit('host:remove', { pid: x.dataset.id });
      if (r.view) onHost(r.view);
    };
    wireProj();
  }
  function updLobby() {
    $('#joined').textContent = t('joinedN', { n: view.players.length });
    $('#waitP').hidden = view.players.length > 0;
    $('#start').disabled = !view.players.length;
    const box = $('#hchips');
    const have = new Map([...box.children].map(c => [c.dataset.id, c]));
    const ids = new Set(view.players.map(p => p.id));
    for (const [id, el] of have) if (!ids.has(id)) el.remove();
    for (const p of view.players) {
      let c = have.get(p.id);
      if (!c) {
        c = document.createElement('span'); c.className = 'chip'; c.dataset.id = p.id;
        c.innerHTML = `<i></i><span></span><button class="x ctl" aria-label="${esc(t('removePlayer'))}" title="${esc(t('removePlayer'))}">×</button>`;
        c.querySelector('.x').dataset.id = p.id;
        box.appendChild(c);
      }
      if (c.dataset.animal !== p.animal) { c.firstElementChild.outerHTML = animalSVG(p.animal); c.dataset.animal = p.animal; }
      c.children[1].textContent = p.name;
    }
  }

  function drawLive() {
    stage().innerHTML = `<div class="panel">
      <div class="hostbar"><h1 class="h2" id="hTitle" style="font-size:clamp(22px,3vw,32px)"></h1><span class="pill" id="hSt"></span><span class="grow"></span>
        <span class="clock" id="clock">0:00</span>
        <span class="ctl row"><button class="btn warn" id="pz"></button><button class="btn danger" id="end">■ ${esc(t('endGame'))}</button>${projBtn()}</span></div>
      <section class="card" style="display:grid;gap:10px"><span class="field-label">${esc(t('progress'))}</span><div id="hrace"></div></section>
      <section class="ctl" style="display:grid;gap:10px"><span class="field-label">${esc(t('table'))}</span><div class="tablewrap"><table>
        <thead><tr><th>${esc(t('name'))}</th><th class="num">${esc(t('solved'))}</th><th class="num">${esc(t('correct'))}</th><th class="num">${esc(t('wrongs'))}</th>
        <th class="num">${esc(t('time'))}</th><th class="num">${esc(t('score'))}</th><th class="hide-s">${esc(t('status'))}</th></tr></thead><tbody id="htb"></tbody></table></div></section>
      ${corner()}
    </div>`;
    $('#hTitle').textContent = view.title;
    $('#pz').onclick = async () => { const r = await emit(view.status === 'paused' ? 'host:resume' : 'host:pause', {}); if (r.view) onHost(r.view); };
    $('#end').onclick = async () => {
      if (!(await ask(t('confirmEnd'), { ok: t('endGame'), danger: true }))) return;
      const r = await emit('host:end', {}); if (r.view) onHost(r.view);
    };
    $('#htb').onclick = e => { const tr = e.target.closest('tr[data-id]'); if (tr) showPlayer(tr.dataset.id); };
    wireProj();
  }
  function updLive() {
    $('#hSt').className = 'pill ' + view.status;
    $('#hSt').textContent = t('st.' + view.status);
    $('#pz').textContent = view.status === 'paused' ? '▶ ' + t('resume') : '❚❚ ' + t('pause');
    tickClock();
    renderRace($('#hrace'), view.players.map(p => ({ id: p.id, name: p.name, animal: p.animal, solved: p.solved, done: p.done, on: p.on })),
      { total: view.total, stableOrder: true, showOnline: true });
    const order = [...view.players].sort((a, b) => b.solved - a.solved || b.score - a.score || a.timeMs - b.timeMs);
    $('#htb').innerHTML = order.map(p => `<tr class="click" data-id="${esc(p.id)}"><td class="nm">${esc(p.name)}</td>
      <td class="num">${p.solved} / ${view.total}${p.done ? ' ✓' : ''}</td><td class="num ok">${p.correct}</td><td class="num bad">${p.wrong}</td>
      <td class="num">${fmtTime(p.timeMs)}</td><td class="num"><b>${p.score}</b></td>
      <td class="hide-s"><span class="pill" style="${p.on ? 'background:#d8f6e7;color:#167a4e' : ''}">${esc(p.on ? t('online') : t('offline'))}</span></td></tr>`).join('');
  }

  async function showPlayer(pid) {
    const r = await emit('host:player', { pid });
    const d = r.detail;
    if (!d) return;
    const qs = view.questions || [];
    const m = modal(`<h2 class="h2" style="font-size:26px" id="pdName"></h2>
      <div>${d.attempts.length ? d.attempts.map(a => `<div class="attempt"><b class="${a.ok ? 'ok' : 'bad'}">${a.ok ? '✓' : '✗'}</b>
        <span class="pill">${esc(t('qShort', { i: a.q + 1 }))}</span><span>${a.timeout ? `<i class="muted">${esc(t('timeout'))}</i>` : rich(a.a)}
        <small class="muted" style="display:block">${rich((qs[a.q]?.text || '').slice(0, 140))}</small></span><span class="t">${fmtTime(a.t)}</span></div>`).join('')
        : `<p class="empty">${esc(t('noAnswers'))}</p>`}</div>
      <div class="row" style="justify-content:flex-end"><button class="btn primary" data-close>${esc(t('close'))}</button></div>`, { wide: true });
    $('#pdName', m.el).textContent = t('answersOf', { name: d.name });
  }

  function drawEnded() {
    const res = view.results;
    stage().innerHTML = `<div class="panel">
      <div class="phead"><h1 id="hTitle"></h1><div class="row ctl"><button class="btn small" id="toCab">← ${esc(t('toCabinet'))}</button>
        <a class="btn primary" href="/api/games/${esc(code)}/results.xlsx?lang=${getLang()}&tz=${new Date().getTimezoneOffset()}" download>⬇ ${esc(t('downloadExcel'))}</a>${projBtn()}</div></div>
      <div class="center-col" style="width:100%;max-width:none"><p class="h2">${esc(t('results'))}</p>${podiumHTML(res)}</div>
      ${tableHTML(res, { clickable: true })}
      ${corner(false)}
    </div>`;
    $('#hTitle').textContent = view.title + ' · ' + t('gameEnded');
    $('#toCab').onclick = () => nav('/teacher');
    $('.tablewrap tbody').onclick = e => { const tr = e.target.closest('tr[data-id]'); if (tr) showPlayer(tr.dataset.id); };
    wireProj();
    rainConfetti(5);
  }
}
