// Ученик: вход, комната ожидания, гонка с заданиями, финиш и итоги.
import { t, onLang } from './i18n.js';
import { $, $$, esc, rich, imgUrl, emit, socket, flash, confetti, rainConfetti, cloneCat, fmtTime, toast } from './util.js';
import { animalSVG, ANIMALS } from './animals.js';
import { renderRace, places } from './race.js';
import { podiumHTML, tableHTML } from './podium.js';
import { showView } from './main.js';

const S = { code: null, token: null, view: null, screen: null, qKey: null, deadline: null, busy: false, justAnswered: false, celebrated: false };
const store = {
  get(code) { try { return localStorage.getItem('tok:' + code) || sessionStorage.getItem('tok:' + code); } catch (e) { return null; } },
  set(code, tok) { try { localStorage.setItem('tok:' + code, tok); sessionStorage.setItem('tok:' + code, tok); } catch (e) {} },
  del(code) { try { localStorage.removeItem('tok:' + code); sessionStorage.removeItem('tok:' + code); } catch (e) {} }
};
const stage = () => $('#stage');
let wired = false;

function wire() {
  if (wired) return;
  wired = true;
  const s = socket();
  let offTimer;
  s.on('connect', () => {
    clearTimeout(offTimer);
    hideReconnect();
    if (S.token && S.code) resume(true);
  });
  s.on('disconnect', () => { if (S.token) offTimer = setTimeout(showReconnect, 1200); });
  // Браузер сообщает о потере сети раньше, чем истечёт таймаут WebSocket
  window.addEventListener('offline', () => { if (S.token) showReconnect(); });
  window.addEventListener('online', () => { if (S.token) { s.disconnect(); s.connect(); } });
  s.on('view', v => applyView(v));
  s.on('race', m => {
    if (!S.view) return;
    S.view.race = m.race;
    updateRace();
  });
  s.on('removed', () => {
    store.del(S.code);
    S.token = null;
    S.screen = 'removed';
    stage().innerHTML = `<div class="center-col"><div class="lobby-cat">${animalSVG(S.view?.me?.animal || 'cat')}</div>
      <p class="h2">${esc(t('removed'))}</p><button class="btn primary huge" id="toHome">${esc(t('toHome'))}</button></div>`;
    $('#toHome').onclick = goHome;
  });
  onLang(() => { if (S.view) { S.screen = null; S.qKey = null; render(); } });
}

function showReconnect() {
  if ($('#reconn')) return;
  const el = document.createElement('div');
  el.id = 'reconn';
  el.className = 'toast show';
  el.textContent = t('reconnecting');
  document.body.appendChild(el);
}
function hideReconnect() { $('#reconn')?.remove(); }

export async function join(code, name) {
  wire();
  const r = await emit('player:join', { code, name });
  if (r.error) return r;
  S.code = code; S.token = r.token;
  store.set(code, r.token);
  history.replaceState(null, '', '/play/' + code);
  showView('stage');
  applyView(r.view);
  return r;
}

export async function resume(silent = false) {
  wire();
  if (!S.token) S.token = store.get(S.code);
  if (!S.token) return { error: 'no_player' };
  const r = await emit('player:resume', { code: S.code, token: S.token });
  if (r.error) {
    if (r.error === 'no_player' || r.error === 'no_room') { store.del(S.code); S.token = null; }
    return r;
  }
  showView('stage');
  applyView(r.view);
  return r;
}

export async function tryResume(code) {
  S.code = code;
  S.token = store.get(code);
  if (!S.token) return false;
  const r = await resume();
  return !r.error;
}

function goHome() {
  S.view = null; S.screen = null; S.code = null; S.token = null;
  emit('player:leave', {});
  history.replaceState(null, '', '/');
  showView('home');
}

function applyView(v) {
  const prev = S.view;
  // Переход к следующему заданию без нашего верного ответа = истёк таймер
  if (prev && v.me.qIndex > prev.me.qIndex && !S.justAnswered && prev.status === 'running') flash(t('timeout'), 'info');
  if (prev && prev.status === 'lobby' && v.status === 'running') burst(t('go'));
  S.view = v;
  if (v.remainingMs != null) S.deadline = Date.now() + v.remainingMs; else S.deadline = null;
  render();
}

function burst(text) {
  const el = document.createElement('div');
  el.className = 'burst';
  el.innerHTML = `<b>${esc(text)}</b>`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1400);
}

function render() {
  const v = S.view;
  if (!v) return;
  const st = v.status;
  let screen;
  if (st === 'lobby') screen = 'lobby';
  else if (st === 'ended') screen = 'results';
  else screen = v.me.finished ? 'finished' : 'play';
  if (screen !== S.screen) {
    S.screen = screen; S.qKey = null;
    ({ lobby: drawLobby, play: drawPlay, finished: drawFinished, results: drawResults })[screen]();
  } else if (screen === 'lobby') updateLobby();
  if (screen === 'play') drawQuestion();
  updateRace();
  pausedOverlay(st === 'paused');
}

// ---------- комната ожидания ----------
function drawLobby() {
  const v = S.view;
  stage().innerHTML = `<div class="center-col">
    <div class="bubble" id="greet"></div>
    <div class="kitty lobby-cat">${cloneCat()}</div>
    <p class="lead dots">${esc(t('lobbyWait'))}</p>
    <div class="card" style="width:100%;display:grid;gap:10px">
      <p class="field-label" style="margin:0;text-align:center">${esc(t('pickAnimal'))}</p>
      <div class="pick" id="pick">${ANIMALS.map(a => `<button type="button" data-a="${a}" aria-pressed="false">${animalSVG(a)}<span>${esc(t(a))}</span></button>`).join('')}</div>
    </div>
    <p class="lead" id="inRoom"></p>
    <div class="chips" id="chips"></div>
  </div>`;
  $('#greet').textContent = t('greetName', { name: v.me.name });
  $('#pick').onclick = async e => {
    const b = e.target.closest('button[data-a]');
    if (!b) return;
    const r = await emit('player:animal', { animal: b.dataset.a });
    if (r.view) applyView(r.view);
  };
  updateLobby();
}
function updateLobby() {
  const v = S.view;
  $$('#pick button').forEach(b => { const on = b.dataset.a === v.me.animal; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
}
function updateChips() {
  const box = $('#chips');
  if (!box) return;
  const v = S.view;
  $('#inRoom').textContent = t('inRoom', { n: v.race.length });
  const have = new Map([...box.children].map(c => [c.dataset.id, c]));
  const ids = new Set(v.race.map(r => r.id));
  for (const [id, el] of have) if (!ids.has(id)) el.remove();
  for (const r of v.race) {
    let c = have.get(r.id);
    if (!c) { c = document.createElement('span'); c.className = 'chip'; c.dataset.id = r.id; c.innerHTML = '<i></i><span></span>'; box.appendChild(c); }
    if (c.dataset.animal !== r.animal) { c.firstElementChild.outerHTML = animalSVG(r.animal); c.dataset.animal = r.animal; }
    c.lastElementChild.textContent = r.name;
    c.classList.toggle('me', r.id === v.me.id);
  }
}

// ---------- гонка и задания ----------
function drawPlay() {
  stage().innerHTML = `<div class="play">
    <div id="raceBox"></div>
    <div class="qhead"><span class="qnum" id="qnum"></span><div class="bar"><i id="qbar"></i></div>
      <div class="timer" id="timer" hidden><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" fill="#fff" stroke="#f3e6f0" stroke-width="5"/>
      <circle id="tring" cx="20" cy="20" r="17" fill="none" stroke="#ff6fa5" stroke-width="5" stroke-linecap="round" stroke-dasharray="106.8" stroke-dashoffset="0"/></svg><b id="tnum"></b></div></div>
    <div class="card qcard" id="qcard"></div>
  </div>`;
}

function drawQuestion() {
  const v = S.view, q = v.question;
  if (!q) return;
  const key = v.code + ':' + q.index;
  $('#qnum').textContent = t('task', { i: q.index + 1, n: v.total });
  $('#qbar').style.setProperty('--w', (100 * v.me.solved / v.total) + '%');
  if (S.qKey === key) return;
  S.qKey = key;
  S.busy = false;
  const img = imgUrl(q.image);
  let body = `<div class="qtext">${rich(q.text)}</div>${img ? `<img class="qimg" src="${img}" alt="">` : ''}`;
  if (q.type === 'choice') {
    body += `<div class="opts" id="opts" style="margin-top:16px">${q.options.map((o, i) => `<button type="button" class="opt c${i % 8}" data-id="${esc(o.id)}">
      <span class="mk">${q.multi ? '' : String.fromCharCode(65 + i)}</span><span>${rich(o.text)}${imgUrl(o.image) ? `<img src="${imgUrl(o.image)}" alt="">` : ''}</span></button>`).join('')}</div>`;
    if (q.multi) body += `<p class="muted" style="margin:12px 0 0;text-align:center">${esc(t('pickAll'))}</p>
      <div class="row" style="justify-content:center;margin-top:10px"><button class="btn primary huge" id="send">${esc(t('answerBtn'))}</button></div>`;
  } else {
    const num = q.answerKind === 'number';
    body += `<form id="ansForm" style="margin-top:16px;display:grid;gap:10px" autocomplete="off">
      <div class="answer-row"><input class="field" id="ans" maxlength="60" ${num ? 'inputmode="decimal"' : ''} placeholder="${esc(t('answerPh'))}" enterkeyhint="send">
      <button class="btn primary huge" type="submit">${esc(t('answerBtn'))}</button></div>
      ${num ? `<div class="keys">${['−', ',', '/'].map(k => `<button type="button" class="btn small" data-k="${k}">${k}</button>`).join('')}</div>` : ''}
    </form>`;
  }
  const card = $('#qcard');
  card.innerHTML = body;
  card.classList.remove('shake');

  if (q.type === 'choice') {
    $('#opts').onclick = e => {
      const b = e.target.closest('.opt');
      if (!b || b.classList.contains('bad') || S.busy) return;
      if (q.multi) { b.classList.toggle('sel'); return; }
      send([b.dataset.id], b);
    };
    if (q.multi) $('#send').onclick = () => {
      const ids = $$('#opts .opt.sel').map(b => b.dataset.id);
      if (ids.length) send(ids);
    };
  } else {
    const inp = $('#ans');
    $('#ansForm').onsubmit = e => { e.preventDefault(); if (inp.value.trim()) send(inp.value.replace(/−/g, '-')); };
    $('#ansForm').querySelector('.keys')?.addEventListener('click', e => {
      const k = e.target.closest('[data-k]');
      if (!k) return;
      const ch = k.dataset.k === '−' ? '-' : k.dataset.k;
      const s = inp.selectionStart ?? inp.value.length, en = inp.selectionEnd ?? s;
      inp.value = inp.value.slice(0, s) + ch + inp.value.slice(en);
      inp.focus(); inp.setSelectionRange(s + 1, s + 1);
    });
    if (matchMedia('(pointer:fine)').matches) inp.focus();
  }
}

async function send(answer, btn) {
  const v = S.view;
  if (S.busy || !v.question) return;
  S.busy = true;
  const card = $('#qcard');
  card.querySelectorAll('button,input').forEach(el => { el.disabled = true; });
  S.justAnswered = true;
  const r = await emit('player:answer', { qIndex: v.question.index, answer });
  if (r.ok) {
    const goods = t('good');
    flash(goods[Math.floor(Math.random() * goods.length)], 'good');
    confetti(60, { x: .5, y: .45 });
    setTimeout(() => { applyView(r.view); S.justAnswered = false; }, 650);
    return;
  }
  S.justAnswered = false;
  if (r.ok === false) {
    flash(t('wrong'), 'bad');
    card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
    if (btn) btn.classList.add('bad');
    setTimeout(() => {
      S.busy = false;
      card.querySelectorAll('button,input').forEach(el => { if (!el.classList.contains('bad')) el.disabled = false; });
      $$('#opts .opt.sel').forEach(b => b.classList.remove('sel'));
      const inp = $('#ans'); if (inp) { inp.select(); }
    }, 1250);
    return;
  }
  S.busy = false;
  card.querySelectorAll('button,input').forEach(el => { if (!el.classList.contains('bad')) el.disabled = false; });
  if (r.view) applyView(r.view);
  if (r.error === 'offline') toast(t('err.offline'));
}

function updateRace() {
  const v = S.view;
  if (!v) return;
  if (S.screen === 'lobby') return updateChips();
  const box = $('#raceBox');
  if (box) renderRace(box, v.race, { total: v.total, meId: v.me.id, max: S.screen === 'finished' ? 8 : 5 });
  const pl = $('#myPlace');
  if (pl) pl.textContent = t('yourPlace', { p: places(v.race).get(v.me.id), n: v.race.length });
}

// Таймер задания
setInterval(() => {
  const el = $('#timer');
  if (!el) return;
  const q = S.view?.question;
  if (!q || !q.time || S.deadline == null || S.screen !== 'play') { el.hidden = true; return; }
  el.hidden = false;
  const left = S.view.status === 'paused' ? S.view.remainingMs : Math.max(0, S.deadline - Date.now());
  const sec = Math.ceil(left / 1000);
  $('#tnum').textContent = sec;
  $('#tring').setAttribute('stroke-dashoffset', String(106.8 * (1 - left / (q.time * 1000))));
  el.classList.toggle('low', sec <= 5);
}, 200);

function pausedOverlay(on) {
  let ov = $('#pausedOv');
  if (on && !ov) {
    ov = document.createElement('div');
    ov.id = 'pausedOv';
    ov.className = 'overlay';
    ov.innerHTML = `<div class="card"><div style="width:120px;margin:0 auto" class="sleep">${animalSVG(S.view.me.animal)}</div>
      <p class="h2">${esc(t('paused'))}</p><p class="lead">${esc(t('pausedSub'))}</p></div>`;
    document.body.appendChild(ov);
  } else if (!on && ov) ov.remove();
}

// ---------- финиш ----------
function drawFinished() {
  const v = S.view;
  stage().innerHTML = `<div class="center-col" style="width:min(100%,860px)">
    <p class="h2">${esc(t('finishTitle'))}</p>
    <div style="width:140px">${animalSVG(v.me.animal, 'ani')}</div>
    ${stats(v.me, v.total)}
    <p class="motto" id="myPlace"></p>
    <p class="lead dots">${esc(t('finishSub'))}</p>
    <div id="raceBox" style="width:100%"></div>
  </div>`;
  $('.center-col svg.ani').style.animation = 'jump 1.2s ease-in-out infinite';
  rainConfetti(3);
}

function stats(me, total) {
  return `<div class="mystats"><div>${esc(t('solvedN'))}<b>${me.solved}/${total}</b></div><div>${esc(t('scoreN'))}<b>${me.score}</b></div><div>${esc(t('timeN'))}<b>${fmtTime(me.timeMs)}</b></div></div>`;
}

// ---------- итоги ----------
function drawResults() {
  const v = S.view, res = v.results;
  if (!res) return;
  const mine = res.ranking.find(r => r.id === v.me.id);
  const top = mine && mine.place <= 3 && mine.solved > 0;
  const mot = t('motivate');
  const msg = top ? t('congrats', { p: mine.place }) : mot[(mine ? mine.place : 0) % mot.length];
  stage().innerHTML = `<div class="center-col" style="width:min(100%,900px)">
    <p class="h2">${esc(t('results'))}</p>
    ${podiumHTML(res)}
    <p class="motto">${esc(msg)}</p>
    ${mine ? stats({ ...mine }, res.total) : ''}
    ${tableHTML(res, { meId: v.me.id, compact: true })}
    <button class="btn primary" id="toHome">${esc(t('toHome'))}</button>
  </div>`;
  $('#toHome').onclick = () => { store.del(S.code); goHome(); };
  if (!S.celebrated) { S.celebrated = true; rainConfetti(top ? 7 : 3); }
}
