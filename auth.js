'use strict';
// Авторизация организатора: пароль (scrypt + соль), сессия в httpOnly-cookie,
// в базе хранится только хеш токена сессии.

const crypto = require('crypto');

const COOKIE = 'sid';
const SESSION_MS = 30 * 24 * 3600 * 1000;

const id = (n = 12) => crypto.randomBytes(n).toString('hex');
const sha = s => crypto.createHash('sha256').update(s).digest('hex');

function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return 'scrypt$' + salt.toString('hex') + '$' + key.toString('hex');
}
function checkPassword(pw, stored) {
  const [alg, saltHex, keyHex] = String(stored).split('$');
  if (alg !== 'scrypt' || !saltHex || !keyHex) return false;
  const key = crypto.scryptSync(pw, Buffer.from(saltHex, 'hex'), 64, { N: 16384, r: 8, p: 1 });
  const want = Buffer.from(keyHex, 'hex');
  return want.length === key.length && crypto.timingSafeEqual(want, key);
}

function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

// Простое ограничение попыток входа: 10 за 15 минут на IP+логин
const attempts = new Map();
function tooMany(key) {
  const now = Date.now();
  const list = (attempts.get(key) || []).filter(t => now - t < 15 * 60 * 1000);
  attempts.set(key, list);
  return list.length >= 10;
}
function noteFail(key) { (attempts.get(key) || attempts.set(key, []).get(key)).push(Date.now()); }

function makeAuth(db) {
  async function createSession(res, teacherId, secure) {
    const token = crypto.randomBytes(32).toString('base64url');
    await db.run('INSERT INTO sessions (token_hash, teacher_id, expires_at) VALUES (?, ?, ?)',
      [sha(token), teacherId, Date.now() + SESSION_MS]);
    res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MS / 1000}${secure ? '; Secure' : ''}`);
  }

  async function teacherFromCookieHeader(header) {
    const token = parseCookies(header)[COOKIE];
    if (!token) return null;
    const s = await db.get('SELECT teacher_id, expires_at FROM sessions WHERE token_hash = ?', [sha(token)]);
    if (!s || s.expires_at < Date.now()) return null;
    return db.get('SELECT id, login, name FROM teachers WHERE id = ?', [s.teacher_id]);
  }

  async function requireTeacher(req, res, next) {
    try {
      const t = await teacherFromCookieHeader(req.headers.cookie);
      if (!t) return res.status(401).json({ error: 'auth' });
      req.teacher = t;
      next();
    } catch (e) { next(e); }
  }

  function routes(app) {
    app.get('/api/auth/me', async (req, res) => {
      const t = await teacherFromCookieHeader(req.headers.cookie);
      res.json({ teacher: t || null, signupCode: !!process.env.TEACHER_SIGNUP_CODE });
    });

    app.post('/api/auth/register', async (req, res) => {
      const { login, name, password, code } = req.body || {};
      const lg = String(login || '').trim().toLowerCase();
      const nm = String(name || '').trim().slice(0, 60);
      const pw = String(password || '');
      if (!/^[a-z0-9._@-]{3,40}$/.test(lg)) return res.status(400).json({ error: 'login_format' });
      if (!nm) return res.status(400).json({ error: 'name_required' });
      if (pw.length < 8) return res.status(400).json({ error: 'password_short' });
      if (process.env.TEACHER_SIGNUP_CODE && code !== process.env.TEACHER_SIGNUP_CODE)
        return res.status(403).json({ error: 'signup_code' });
      if (await db.get('SELECT id FROM teachers WHERE login = ?', [lg])) return res.status(409).json({ error: 'login_taken' });
      const tid = id();
      await db.run('INSERT INTO teachers (id, login, name, pass_hash, created_at) VALUES (?, ?, ?, ?, ?)',
        [tid, lg, nm, hashPassword(pw), Date.now()]);
      await createSession(res, tid, req.secure);
      res.json({ teacher: { id: tid, login: lg, name: nm } });
    });

    app.post('/api/auth/login', async (req, res) => {
      const lg = String(req.body?.login || '').trim().toLowerCase();
      const pw = String(req.body?.password || '');
      const key = req.ip + '|' + lg;
      if (tooMany(key)) return res.status(429).json({ error: 'too_many' });
      const t = await db.get('SELECT id, login, name, pass_hash FROM teachers WHERE login = ?', [lg]);
      if (!t || !checkPassword(pw, t.pass_hash)) { noteFail(key); return res.status(401).json({ error: 'bad_login' }); }
      await createSession(res, t.id, req.secure);
      res.json({ teacher: { id: t.id, login: t.login, name: t.name } });
    });

    app.post('/api/auth/logout', async (req, res) => {
      const token = parseCookies(req.headers.cookie)[COOKIE];
      if (token) await db.run('DELETE FROM sessions WHERE token_hash = ?', [sha(token)]);
      res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
      res.json({ ok: true });
    });
  }

  return { routes, requireTeacher, teacherFromCookieHeader };
}

module.exports = { makeAuth, id, sha };
