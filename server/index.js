'use strict';
// Сервер платформы: HTTP API + WebSocket (Socket.IO) + раздача сайта.

const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const { open } = require('./db');
const { makeAuth, id } = require('./auth');
const { sanitizeQuiz } = require('./quiz');
const { GameManager, ANIMALS } = require('./game');
const { resultsWorkbook } = require('./excel');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = path.join(__dirname, '..');

async function main() {
  const db = await open();
  const auth = makeAuth(db);
  const games = new GameManager(db);
  const restored = await games.loadActive();
  console.log(`База: ${db.kind}. Восстановлено активных игр: ${restored}`);

  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', [
      "default-src 'self'", "img-src 'self' data: blob:", "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com", "script-src 'self'", "connect-src 'self' ws: wss:",
      "frame-ancestors 'self'", "base-uri 'self'", "form-action 'self'"
    ].join('; '));
    next();
  });
  app.use(express.json({ limit: '5mb' }));

  const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
  const T = auth.requireTeacher;

  auth.routes(app);

  // ---------- наборы заданий ----------
  app.get('/api/quizzes', T, wrap(async (req, res) => {
    const rows = await db.all('SELECT id, title, data, updated_at FROM quizzes WHERE teacher_id = ? ORDER BY updated_at DESC', [req.teacher.id]);
    res.json(rows.map(r => ({ id: r.id, title: r.title, count: JSON.parse(r.data).questions.length, updatedAt: r.updated_at })));
  }));

  app.get('/api/quizzes/:id', T, wrap(async (req, res) => {
    const r = await db.get('SELECT id, title, data FROM quizzes WHERE id = ? AND teacher_id = ?', [req.params.id, req.teacher.id]);
    if (!r) return res.status(404).json({ error: 'not_found' });
    res.json({ id: r.id, title: r.title, questions: JSON.parse(r.data).questions });
  }));

  async function saveQuiz(req, res, existingId) {
    const s = sanitizeQuiz(req.body);
    if (s.error) return res.status(400).json(s);
    const now = Date.now();
    const data = JSON.stringify({ questions: s.quiz.questions });
    if (existingId) {
      const r = await db.get('SELECT id FROM quizzes WHERE id = ? AND teacher_id = ?', [existingId, req.teacher.id]);
      if (!r) return res.status(404).json({ error: 'not_found' });
      await db.run('UPDATE quizzes SET title = ?, data = ?, updated_at = ? WHERE id = ?', [s.quiz.title, data, now, existingId]);
      return res.json({ id: existingId, ...s.quiz });
    }
    const qid = id(8);
    await db.run('INSERT INTO quizzes (id, teacher_id, title, data, updated_at) VALUES (?, ?, ?, ?, ?)', [qid, req.teacher.id, s.quiz.title, data, now]);
    res.json({ id: qid, ...s.quiz });
  }
  app.post('/api/quizzes', T, wrap((req, res) => saveQuiz(req, res, null)));
  app.put('/api/quizzes/:id', T, wrap((req, res) => saveQuiz(req, res, req.params.id)));

  app.delete('/api/quizzes/:id', T, wrap(async (req, res) => {
    await db.run('DELETE FROM quizzes WHERE id = ? AND teacher_id = ?', [req.params.id, req.teacher.id]);
    res.json({ ok: true });
  }));

  app.post('/api/quizzes/:id/duplicate', T, wrap(async (req, res) => {
    const r = await db.get('SELECT title, data FROM quizzes WHERE id = ? AND teacher_id = ?', [req.params.id, req.teacher.id]);
    if (!r) return res.status(404).json({ error: 'not_found' });
    const qid = id(8);
    const title = (r.title + ' (2)').slice(0, 120);
    await db.run('INSERT INTO quizzes (id, teacher_id, title, data, updated_at) VALUES (?, ?, ?, ?, ?)', [qid, req.teacher.id, title, r.data, Date.now()]);
    res.json({ id: qid });
  }));

  // Банк: все сохранённые задания организатора, чтобы использовать их повторно
  app.get('/api/bank', T, wrap(async (req, res) => {
    const rows = await db.all('SELECT id, title, data FROM quizzes WHERE teacher_id = ? ORDER BY updated_at DESC', [req.teacher.id]);
    res.json(rows.map(r => ({ id: r.id, title: r.title, questions: JSON.parse(r.data).questions })));
  }));

  // ---------- изображения ----------
  const MAGIC = [['image/png', [0x89, 0x50, 0x4e, 0x47]], ['image/jpeg', [0xff, 0xd8, 0xff]], ['image/gif', [0x47, 0x49, 0x46]], ['image/webp', [0x52, 0x49, 0x46, 0x46]]];
  app.post('/api/images', T, express.raw({ type: 'image/*', limit: '3mb' }), wrap(async (req, res) => {
    const buf = req.body;
    if (!Buffer.isBuffer(buf) || !buf.length) return res.status(400).json({ error: 'image' });
    const hit = MAGIC.find(([, m]) => m.every((b, i) => buf[i] === b));
    if (!hit) return res.status(400).json({ error: 'image_type' });
    const iid = id(16);
    await db.run('INSERT INTO images (id, teacher_id, mime, data, created_at) VALUES (?, ?, ?, ?, ?)', [iid, req.teacher.id, hit[0], buf, Date.now()]);
    res.json({ id: iid });
  }));
  app.get('/img/:id', wrap(async (req, res) => {
    if (!/^[a-f0-9]{32}$/.test(req.params.id)) return res.status(404).end();
    const r = await db.get('SELECT mime, data FROM images WHERE id = ?', [req.params.id]);
    if (!r) return res.status(404).end();
    res.setHeader('Content-Type', r.mime);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.end(Buffer.from(r.data));
  }));

  // ---------- игры ----------
  app.post('/api/games', T, wrap(async (req, res) => {
    const r = await db.get('SELECT title, data FROM quizzes WHERE id = ? AND teacher_id = ?', [String(req.body?.quizId), req.teacher.id]);
    if (!r) return res.status(404).json({ error: 'not_found' });
    const questions = JSON.parse(r.data).questions;
    if (!questions.length) return res.status(400).json({ error: 'empty_quiz' });
    const g = await games.create(req.teacher.id, { title: r.title, questions });
    res.json({ code: g.code });
  }));

  app.get('/api/games', T, wrap(async (req, res) => {
    const rows = await db.all('SELECT code, title, status, created_at, ended_at, state FROM games WHERE teacher_id = ? ORDER BY created_at DESC LIMIT 100', [req.teacher.id]);
    res.json(rows.map(r => {
      const live = games.games.get(r.code);
      return {
        code: r.code, title: r.title, status: live ? live.status : r.status, createdAt: r.created_at, endedAt: r.ended_at,
        players: live ? live.players.size : (JSON.parse(r.state).players || []).length
      };
    }));
  }));

  app.get('/api/games/:code/results.xlsx', T, wrap(async (req, res) => {
    const g = await games.get(req.params.code);
    if (!g || g.teacherId !== req.teacher.id) return res.status(404).end();
    const lang = req.query.lang === 'ru' ? 'ru' : 'kk';
    const tz = Math.max(-840, Math.min(840, Math.round(Number(req.query.tz) || 0)));
    const buf = await resultsWorkbook(g, lang, tz);
    const name = (lang === 'ru' ? 'результаты-' : 'нәтижелер-') + g.code + '.xlsx';
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="results-${g.code}.xlsx"; filename*=UTF-8''${encodeURIComponent(name)}`);
    res.end(Buffer.from(buf));
  }));

  const joinUrl = (req, code) => {
    const base = process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
    return base.replace(/\/$/, '') + '/join/' + code;
  };
  app.get('/qr/:code.svg', wrap(async (req, res) => {
    const code = String(req.params.code).replace(/\D/g, '').slice(0, 6);
    const svg = await QRCode.toString(joinUrl(req, code), { type: 'svg', margin: 1, color: { dark: '#5b1f52', light: '#ffffff' } });
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.end(svg);
  }));
  app.get('/api/config', (req, res) => res.json({ publicUrl: process.env.PUBLIC_URL || null }));
  app.get('/healthz', (req, res) => res.json({ ok: true, games: games.games.size }));

  // ---------- сайт ----------
  app.use('/vendor/katex', express.static(path.join(ROOT, 'node_modules', 'katex', 'dist'), { maxAge: '30d' }));
  app.use(express.static(path.join(ROOT, 'public'), { maxAge: '1h' }));
  const page = (req, res) => res.sendFile(path.join(ROOT, 'public', 'index.html'));
  app.get(['/', '/join/:code', '/play/:code', '/teacher', '/teacher/*rest'], page);

  app.use((err, req, res, next) => {
    console.error(err);
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'too_large' });
    res.status(500).json({ error: 'server' });
  });

  // ---------- WebSocket ----------
  const server = http.createServer(app);
  const io = new Server(server, { maxHttpBufferSize: 1e5, pingInterval: 15000, pingTimeout: 20000 });

  const flushTimers = new Map();
  function broadcast(g) {
    if (flushTimers.has(g.code)) return;
    flushTimers.set(g.code, setTimeout(() => {
      flushTimers.delete(g.code);
      io.to('g:' + g.code).emit('race', { race: g.race(), status: g.status });
      io.to('h:' + g.code).emit('host', g.hostView());
    }, 250));
  }
  function pushViews(g) {
    for (const p of g.players.values()) io.to('p:' + g.code + ':' + p.id).emit('view', g.playerView(p));
    io.to('h:' + g.code).emit('host', g.hostView());
  }
  const endTimers = new Map();
  function maybeAutoEnd(g) {
    if (g.status !== 'running' || !g.allFinished() || endTimers.has(g.code)) return;
    endTimers.set(g.code, setTimeout(async () => {
      endTimers.delete(g.code);
      if (g.status === 'running' && g.allFinished() && g.end()) { pushViews(g); await games.saveNow(g); }
    }, 4000));
  }

  setInterval(() => {
    for (const g of games.games.values()) {
      const changed = g.tick();
      if (!changed.length) continue;
      for (const p of changed) io.to('p:' + g.code + ':' + p.id).emit('view', g.playerView(p));
      broadcast(g); games.save(g); maybeAutoEnd(g);
    }
  }, 500);

  io.on('connection', socket => {
    // Ограничение частоты событий от одного соединения
    let bucket = 30, last = Date.now();
    socket.use((pkt, next) => {
      const now = Date.now();
      bucket = Math.min(30, bucket + (now - last) / 100); last = now;
      if (bucket < 1) return next(new Error('rate'));
      bucket--; next();
    });

    const ack = fn => (typeof fn === 'function' ? fn : () => {});
    const unbind = () => {
      const d = socket.data;
      if (d.role === 'player') {
        const g = games.games.get(d.code);
        const p = g && g.players.get(d.pid);
        if (p) { p.connected = Math.max(0, p.connected - 1); broadcast(g); }
        socket.leave('g:' + d.code); socket.leave('p:' + d.code + ':' + d.pid);
      }
      if (d.role === 'host') socket.leave('h:' + d.code);
      socket.data = {};
    };
    const bindPlayer = (g, p) => {
      unbind();
      socket.data = { role: 'player', code: g.code, pid: p.id };
      p.connected++;
      socket.join('g:' + g.code); socket.join('p:' + g.code + ':' + p.id);
      broadcast(g);
    };
    const current = () => {
      const d = socket.data;
      if (d.role !== 'player') return {};
      const g = games.games.get(d.code);
      return { g, p: g && g.players.get(d.pid) };
    };

    socket.on('player:join', async (msg, cb) => {
      cb = ack(cb);
      try {
        const g = await games.get(msg?.code);
        if (!g) return cb({ error: 'no_room' });
        const r = g.addPlayer(msg?.name);
        if (r.error) return cb(r);
        bindPlayer(g, r.player);
        games.save(g);
        cb({ ok: true, token: r.token, view: g.playerView(r.player) });
      } catch (e) { console.error(e); cb({ error: 'server' }); }
    });

    socket.on('player:resume', async (msg, cb) => {
      cb = ack(cb);
      try {
        const g = await games.get(msg?.code);
        if (!g) return cb({ error: 'no_room' });
        const p = g.byToken(msg?.token);
        if (!p) return cb({ error: 'no_player' });
        bindPlayer(g, p);
        cb({ ok: true, view: g.playerView(p) });
      } catch (e) { console.error(e); cb({ error: 'server' }); }
    });

    socket.on('player:animal', (msg, cb) => {
      cb = ack(cb);
      const { g, p } = current();
      if (!p || !g.setAnimal(p, msg?.animal)) return cb({ error: 'no' });
      broadcast(g); games.save(g);
      cb({ ok: true, view: g.playerView(p) });
    });

    socket.on('player:answer', (msg, cb) => {
      cb = ack(cb);
      const { g, p } = current();
      if (!p) return cb({ error: 'no_player' });
      const r = g.answer(p, Number(msg?.qIndex), msg?.answer);
      if (!r.error) { broadcast(g); games.save(g); maybeAutoEnd(g); }
      cb({ ...r, view: g.playerView(p) });
    });

    socket.on('player:leave', (msg, cb) => { unbind(); ack(cb)({ ok: true }); });

    // ---------- организатор ----------
    const hostGame = async code => {
      const t = await auth.teacherFromCookieHeader(socket.handshake.headers.cookie);
      if (!t) return { error: 'auth' };
      const g = await games.get(code);
      if (!g || g.teacherId !== t.id) return { error: 'no_room' };
      return { g };
    };

    socket.on('host:watch', async (msg, cb) => {
      cb = ack(cb);
      const r = await hostGame(msg?.code);
      if (r.error) return cb(r);
      unbind();
      socket.data = { role: 'host', code: r.g.code };
      socket.join('h:' + r.g.code);
      cb({ ok: true, view: r.g.hostView(), animals: ANIMALS });
    });

    const control = (name, fn) => socket.on(name, async (msg, cb) => {
      cb = ack(cb);
      const d = socket.data;
      if (d.role !== 'host') return cb({ error: 'auth' });
      const r = await hostGame(d.code);
      if (r.error) return cb(r);
      const out = fn(r.g, msg || {});
      if (out === false) return cb({ error: 'state' });
      if (out && typeof out === 'object' && 'detail' in out) return cb({ ok: true, detail: out.detail });
      pushViews(r.g);
      await games.saveNow(r.g);
      cb({ ok: true, view: r.g.hostView() });
    });
    control('host:start', g => g.start());
    control('host:pause', g => g.pause());
    control('host:resume', g => g.resume());
    control('host:end', g => g.end());
    control('host:remove', (g, m) => {
      const ok = g.removePlayer(String(m.pid));
      if (ok) io.to('p:' + g.code + ':' + m.pid).emit('removed');
      return ok;
    });
    control('host:player', (g, m) => ({ detail: g.playerDetail(String(m.pid)) }));

    socket.on('disconnect', unbind);
  });

  server.listen(PORT, () => console.log(`Сервер запущен: http://localhost:${PORT}`));

  const shutdown = async () => {
    try { await games.flushAll(); await db.close(); } catch (e) { console.error(e); }
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch(e => { console.error(e); process.exit(1); });
