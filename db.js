'use strict';
// Хранилище: PostgreSQL, если задан DATABASE_URL (для хостинга), иначе SQLite-файл.
// Все запросы пишутся с плейсхолдерами "?" и автоматически переводятся в $1..$n для Postgres.

const path = require('path');
const fs = require('fs');

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS teachers (
     id TEXT PRIMARY KEY, login TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
     pass_hash TEXT NOT NULL, created_at BIGINT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS sessions (
     token_hash TEXT PRIMARY KEY, teacher_id TEXT NOT NULL, expires_at BIGINT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS quizzes (
     id TEXT PRIMARY KEY, teacher_id TEXT NOT NULL, title TEXT NOT NULL,
     data TEXT NOT NULL, updated_at BIGINT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS images (
     id TEXT PRIMARY KEY, teacher_id TEXT NOT NULL, mime TEXT NOT NULL,
     data %BLOB% NOT NULL, created_at BIGINT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS games (
     code TEXT PRIMARY KEY, teacher_id TEXT NOT NULL, title TEXT NOT NULL,
     status TEXT NOT NULL, state TEXT NOT NULL, created_at BIGINT NOT NULL, ended_at BIGINT)`,
  `CREATE INDEX IF NOT EXISTS quizzes_teacher ON quizzes(teacher_id)`,
  `CREATE INDEX IF NOT EXISTS games_teacher ON games(teacher_id)`,
  `CREATE INDEX IF NOT EXISTS games_status ON games(status)`
];

async function open() {
  if (process.env.DATABASE_URL) {
    const { Pool, types } = require('pg');
    types.setTypeParser(20, v => Number(v)); // BIGINT → число
    const url = process.env.DATABASE_URL;
    const local = /localhost|127\.0\.0\.1|\/tmp|host=\//.test(url);
    const pool = new Pool({ connectionString: url, max: 10, ssl: local ? false : { rejectUnauthorized: false } });
    const conv = sql => { let i = 0; return sql.replace(/\?/g, () => '$' + (++i)); };
    const db = {
      kind: 'postgres',
      async run(sql, p = []) { await pool.query(conv(sql), p); },
      async get(sql, p = []) { const r = await pool.query(conv(sql), p); return r.rows[0]; },
      async all(sql, p = []) { const r = await pool.query(conv(sql), p); return r.rows; },
      async close() { await pool.end(); }
    };
    for (const s of SCHEMA) await db.run(s.replace('%BLOB%', 'BYTEA'));
    return db;
  }
  const Database = require('better-sqlite3');
  const file = process.env.SQLITE_FILE || path.join(__dirname, '..', 'data', 'platform.db');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const sq = new Database(file);
  sq.pragma('journal_mode = WAL');
  const norm = row => {
    if (!row) return row;
    for (const k of Object.keys(row)) if (typeof row[k] === 'bigint') row[k] = Number(row[k]);
    return row;
  };
  const db = {
    kind: 'sqlite',
    async run(sql, p = []) { sq.prepare(sql).run(...p); },
    async get(sql, p = []) { return norm(sq.prepare(sql).get(...p)); },
    async all(sql, p = []) { return sq.prepare(sql).all(...p).map(norm); },
    async close() { sq.close(); }
  };
  for (const s of SCHEMA) await db.run(s.replace('%BLOB%', 'BLOB'));
  return db;
}

module.exports = { open };
