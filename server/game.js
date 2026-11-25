'use strict';
// Игровые комнаты: состояние гонки хранится на сервере (в памяти + в базе),
// ученики получают только безопасные данные, ответы проверяются здесь.

const crypto = require('crypto');
const { checkAnswer, publicQuestion, describeAnswer } = require('./quiz');

const ANIMALS = ['cat', 'bunny', 'bear', 'fox', 'panda'];
const MAX_PLAYERS = 300;
const WRONG_COOLDOWN_MS = 1200;
const MAX_ATTEMPTS = 400;
const sha = s => crypto.createHash('sha256').update(s).digest('hex');

class Game {
  constructor(o) {
    this.code = o.code;
    this.teacherId = o.teacherId;
    this.title = o.title;
    this.questions = o.questions;
    this.createdAt = o.createdAt || Date.now();
    this.status = o.status || 'lobby';          // lobby | running | paused | ended
    this.startedAt = o.startedAt || null;
    this.pausedAt = o.pausedAt || null;
    this.pausedTotal = o.pausedTotal || 0;
    this.endedAt = o.endedAt || null;
    this.players = new Map((o.players || []).map(p => [p.id, { ...p, connected: 0 }]));
    this.results = o.results || null;
    this.joinCount = o.joinCount || this.players.size;
  }

  toJSON() {
    return {
      code: this.code, teacherId: this.teacherId, title: this.title, questions: this.questions,
      createdAt: this.createdAt, status: this.status, startedAt: this.startedAt, pausedAt: this.pausedAt,
      pausedTotal: this.pausedTotal, endedAt: this.endedAt, results: this.results, joinCount: this.joinCount,
      players: [...this.players.values()].map(({ connected, lastWrongAt, ...p }) => p)
    };
  }

  get total() { return this.questions.length; }

  // Игровое время (мс) без учёта пауз
  gameMs(now = Date.now()) {
    if (!this.startedAt) return 0;
    const end = this.status === 'ended' ? this.endedAt : now;
    const paused = this.status === 'paused' ? end - this.pausedAt : 0;
    return Math.max(0, end - this.startedAt - this.pausedTotal - paused);
  }

  addPlayer(rawName) {
    const name = String(rawName || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24);
    if (!name) return { error: 'name_required' };
    if (this.status === 'ended') return { error: 'game_ended' };
    if (this.players.size >= MAX_PLAYERS) return { error: 'room_full' };
    const low = name.toLocaleLowerCase('ru');
    for (const p of this.players.values()) if (p.name.toLocaleLowerCase('ru') === low) return { error: 'name_taken' };
    const token = crypto.randomBytes(24).toString('base64url');
    const p = {
      id: crypto.randomBytes(6).toString('hex'), tokenHash: sha(token), name,
      animal: ANIMALS[this.joinCount % ANIMALS.length], joinedAt: Date.now(), connected: 0,
      qIndex: 0, solved: 0, correct: 0, wrong: 0, score: 0, attempts: [],
      startMs: null, finishMs: null, lastCorrectMs: null, qDeadline: null
    };
    this.joinCount++;
    this.players.set(p.id, p);
    if (this.status === 'running' || this.status === 'paused') this.startPlayer(p, Date.now());
    return { player: p, token };
  }

  byToken(token) {
    if (!token) return null;
    const h = sha(String(token));
    for (const p of this.players.values()) if (p.tokenHash === h) return p;
    return null;
  }

  setAnimal(p, animal) {
    if (this.status !== 'lobby' || !ANIMALS.includes(animal)) return false;
    p.animal = animal;
    return true;
  }

  removePlayer(pid) {
    if (this.status !== 'lobby') return false;
    return this.players.delete(pid);
  }

  startPlayer(p, now) {
    p.startMs = this.gameMs(now);
    p.qIndex = 0;
    this.armQuestion(p, now);
  }

  armQuestion(p, now) {
    const q = this.questions[p.qIndex];
    // Во время паузы отсчёт начнётся только после возобновления (resume сдвигает сроки)
    const base = this.status === 'paused' ? this.pausedAt : now;
    p.qDeadline = q && q.time > 0 ? base + q.time * 1000 : null;
  }

  start() {
    if (this.status !== 'lobby' || this.total === 0) return false;
    const now = Date.now();
    this.status = 'running';
    this.startedAt = now;
    for (const p of this.players.values()) this.startPlayer(p, now);
    return true;
  }

  pause() {
    if (this.status !== 'running') return false;
    this.status = 'paused';
    this.pausedAt = Date.now();
    return true;
  }

  resume() {
    if (this.status !== 'paused') return false;
    const now = Date.now();
    const d = now - this.pausedAt;
    this.pausedTotal += d;
    for (const p of this.players.values()) if (p.qDeadline) p.qDeadline += d;
    this.status = 'running';
    this.pausedAt = null;
    return true;
  }

  end() {
    if (this.status === 'ended') return false;
    if (this.status === 'paused') this.resume();
    if (this.status === 'lobby' && !this.startedAt) this.startedAt = Date.now();
    this.endedAt = Date.now();
    this.status = 'ended';
    for (const p of this.players.values()) p.qDeadline = null;
    this.results = this.computeResults();
    return true;
  }

  playerTime(p) {
    if (p.startMs == null) return 0;
    const end = p.finishMs != null ? p.finishMs : this.gameMs();
    return Math.max(0, end - p.startMs);
  }

  finished(p) { return p.qIndex >= this.total; }

  // Ответ ученика. Повторное начисление невозможно: засчитывается только текущее задание.
  answer(p, qIndex, answer, now = Date.now()) {
    if (this.status !== 'running') return { error: this.status === 'paused' ? 'paused' : 'not_running' };
    if (this.finished(p)) return { error: 'finished' };
    if (qIndex !== p.qIndex) return { error: 'stale', qIndex: p.qIndex };
    if (p.lastWrongAt && now - p.lastWrongAt < WRONG_COOLDOWN_MS) return { error: 'cooldown' };
    const q = this.questions[p.qIndex];
    const ok = checkAnswer(q, answer);
    const t = this.gameMs(now);
    if (p.attempts.length < MAX_ATTEMPTS) p.attempts.push({ q: p.qIndex, a: describeAnswer(q, answer), ok, t });
    if (!ok) {
      p.wrong++;
      p.lastWrongAt = now;
      return { ok: false };
    }
    p.correct++;
    p.solved++;
    p.score += q.points;
    p.lastCorrectMs = t;
    p.qIndex++;
    if (this.finished(p)) { p.finishMs = t; p.qDeadline = null; }
    else this.armQuestion(p, now);
    return { ok: true, finished: this.finished(p) };
  }

  // Истёкший таймер: задание не засчитано, персонаж стоит на месте, следующее задание
  tick(now = Date.now()) {
    if (this.status !== 'running') return [];
    const changed = [];
    for (const p of this.players.values()) {
      if (p.qDeadline && now >= p.qDeadline && !this.finished(p)) {
        const t = this.gameMs(now);
        if (p.attempts.length < MAX_ATTEMPTS) p.attempts.push({ q: p.qIndex, a: '', ok: false, t, timeout: true });
        p.wrong++;
        p.qIndex++;
        if (this.finished(p)) { p.finishMs = t; p.qDeadline = null; }
        else this.armQuestion(p, now);
        changed.push(p);
      }
    }
    return changed;
  }

  allFinished() {
    return this.players.size > 0 && [...this.players.values()].every(p => this.finished(p));
  }

  ranking() {
    const list = [...this.players.values()].map(p => ({
      id: p.id, name: p.name, animal: p.animal, solved: p.solved, correct: p.correct, wrong: p.wrong,
      score: p.score, timeMs: this.playerTime(p), finished: this.finished(p),
      key: p.lastCorrectMs == null ? Infinity : p.lastCorrectMs - (p.startMs || 0)
    }));
    list.sort((a, b) => b.solved - a.solved || b.score - a.score || a.key - b.key || a.timeMs - b.timeMs || a.name.localeCompare(b.name));
    let place = 0, prev = null;
    list.forEach((r, i) => {
      const sig = r.solved + '|' + r.score + '|' + r.key;
      if (sig !== prev) place = i + 1;
      prev = sig;
      r.place = place;
      delete r.key;
    });
    return list;
  }

  computeResults() {
    return { title: this.title, total: this.total, endedAt: this.endedAt, ranking: this.ranking() };
  }

  race() {
    return [...this.players.values()].map(p => ({
      id: p.id, name: p.name, animal: p.animal, solved: p.solved, done: this.finished(p), on: p.connected > 0
    }));
  }

  playerView(p, now = Date.now()) {
    const q = this.status !== 'lobby' && !this.finished(p) && this.status !== 'ended' ? this.questions[p.qIndex] : null;
    return {
      code: this.code, title: this.title, status: this.status, total: this.total, serverNow: now,
      me: {
        id: p.id, name: p.name, animal: p.animal, solved: p.solved, score: p.score, correct: p.correct,
        wrong: p.wrong, qIndex: p.qIndex, finished: this.finished(p), timeMs: this.playerTime(p)
      },
      question: q ? publicQuestion(q, p.qIndex) : null,
      remainingMs: q && p.qDeadline ? Math.max(0, p.qDeadline - (this.status === 'paused' ? this.pausedAt : now)) : null,
      race: this.race(),
      results: this.status === 'ended' ? this.results : null
    };
  }

  hostView(now = Date.now()) {
    return {
      code: this.code, title: this.title, status: this.status, total: this.total, gameMs: this.gameMs(now),
      serverNow: now,
      questions: this.questions.map(q => ({ text: q.text.slice(0, 140), points: q.points, type: q.type })),
      players: [...this.players.values()].map(p => ({
        id: p.id, name: p.name, animal: p.animal, on: p.connected > 0, solved: p.solved, correct: p.correct,
        wrong: p.wrong, score: p.score, qIndex: p.qIndex, done: this.finished(p), timeMs: this.playerTime(p)
      })),
      results: this.status === 'ended' ? this.results : null
    };
  }

  playerDetail(pid) {
    const p = this.players.get(pid);
    if (!p) return null;
    return { id: p.id, name: p.name, attempts: p.attempts };
  }
}

// Менеджер комнат: создание, кэш в памяти, сохранение в базу
class GameManager {
  constructor(db) { this.db = db; this.games = new Map(); this.saveTimers = new Map(); }

  async loadActive() {
    const rows = await this.db.all("SELECT state FROM games WHERE status <> 'ended'");
    for (const r of rows) {
      try { const g = new Game(JSON.parse(r.state)); this.games.set(g.code, g); } catch (e) { console.error('load game', e); }
    }
    return rows.length;
  }

  async newCode() {
    for (let i = 0; i < 50; i++) {
      const code = String(100000 + crypto.randomInt(900000));
      if (this.games.has(code)) continue;
      if (!(await this.db.get('SELECT code FROM games WHERE code = ?', [code]))) return code;
    }
    throw new Error('no code');
  }

  async create(teacherId, quiz) {
    const code = await this.newCode();
    const g = new Game({ code, teacherId, title: quiz.title, questions: quiz.questions });
    this.games.set(code, g);
    await this.db.run('INSERT INTO games (code, teacher_id, title, status, state, created_at, ended_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [code, teacherId, g.title, g.status, JSON.stringify(g), g.createdAt, null]);
    return g;
  }

  async get(code) {
    code = String(code || '').replace(/\D/g, '');
    if (this.games.has(code)) return this.games.get(code);
    const r = await this.db.get('SELECT state FROM games WHERE code = ?', [code]);
    if (!r) return null;
    const g = new Game(JSON.parse(r.state));
    this.games.set(code, g);
    if (g.status === 'ended') setTimeout(() => { if (this.games.get(code) === g && g.status === 'ended') this.games.delete(code); }, 3600e3).unref();
    return g;
  }

  async saveNow(g) {
    clearTimeout(this.saveTimers.get(g.code));
    this.saveTimers.delete(g.code);
    await this.db.run('UPDATE games SET status = ?, state = ?, ended_at = ?, title = ? WHERE code = ?',
      [g.status, JSON.stringify(g), g.endedAt, g.title, g.code]);
  }

  save(g) {
    if (this.saveTimers.has(g.code)) return;
    this.saveTimers.set(g.code, setTimeout(() => this.saveNow(g).catch(e => console.error('save', e)), 1000));
  }

  async flushAll() { for (const g of this.games.values()) await this.saveNow(g); }
}

module.exports = { Game, GameManager, ANIMALS };
