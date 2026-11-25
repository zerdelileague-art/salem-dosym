'use strict';
// Проверка и нормализация наборов заданий, проверка ответов учеников.

const crypto = require('crypto');
const rid = () => crypto.randomBytes(6).toString('hex');

const LIMITS = { questions: 500, text: 3000, option: 500, options: 8, answers: 20 };

function cleanStr(v, max) { return String(v ?? '').replace(/\r\n/g, '\n').slice(0, max); }
function cleanImg(v) { return typeof v === 'string' && /^[a-f0-9]{32}$/.test(v) ? v : null; }

// Возвращает { quiz } либо { error, index } — номер задания с ошибкой
function sanitizeQuiz(input) {
  const title = cleanStr(input?.title, 120).trim();
  if (!title) return { error: 'quiz_title' };
  const list = Array.isArray(input?.questions) ? input.questions.slice(0, LIMITS.questions) : [];
  const questions = [];
  for (let i = 0; i < list.length; i++) {
    const q = list[i] || {};
    const type = q.type === 'input' ? 'input' : 'choice';
    const out = {
      id: typeof q.id === 'string' && /^[a-z0-9]{4,24}$/.test(q.id) ? q.id : rid(),
      type,
      text: cleanStr(q.text, LIMITS.text),
      image: cleanImg(q.image),
      points: Math.max(0, Math.min(10000, Math.round(Number(q.points) || 0))),
      time: Math.max(0, Math.min(3600, Math.round(Number(q.time) || 0)))
    };
    if (out.time > 0 && out.time < 5) out.time = 5;
    if (!out.text.trim() && !out.image) return { error: 'q_text', index: i };
    if (type === 'choice') {
      const opts = (Array.isArray(q.options) ? q.options : []).slice(0, LIMITS.options)
        .map(o => ({
          id: typeof o?.id === 'string' && /^[a-z0-9]{2,24}$/.test(o.id) ? o.id : rid(),
          text: cleanStr(o?.text, LIMITS.option),
          image: cleanImg(o?.image),
          correct: !!o?.correct
        }))
        .filter(o => o.text.trim() || o.image);
      if (opts.length < 2) return { error: 'q_options', index: i };
      if (!opts.some(o => o.correct)) return { error: 'q_correct', index: i };
      const seen = new Set();
      for (const o of opts) { while (seen.has(o.id)) o.id = rid(); seen.add(o.id); }
      out.options = opts;
    } else {
      out.answerKind = q.answerKind === 'text' ? 'text' : 'number';
      const answers = (Array.isArray(q.answers) ? q.answers : String(q.answers ?? '').split(/\n|;/))
        .map(a => cleanStr(a, 200).trim()).filter(Boolean).slice(0, LIMITS.answers);
      if (!answers.length) return { error: 'q_answer', index: i };
      if (out.answerKind === 'number' && answers.some(a => Number.isNaN(parseNum(a)))) return { error: 'q_number', index: i };
      out.answers = answers;
    }
    questions.push(out);
  }
  return { quiz: { title, questions } };
}

function parseNum(s) {
  let t = String(s ?? '').trim().replace(/\s+/g, '').replace(/,/g, '.').replace(/[−–]/g, '-');
  if (!t) return NaN;
  let m = t.match(/^([-+]?\d+(?:\.\d+)?)\/([-+]?\d+(?:\.\d+)?)$/);
  if (m) { const b = Number(m[2]); return b === 0 ? NaN : Number(m[1]) / b; }
  if (/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t)) return Number(t);
  return NaN;
}
function normText(s) {
  return String(s ?? '').normalize('NFC').toLocaleLowerCase('ru').replace(/ё/g, 'е')
    .replace(/\s+/g, ' ').trim().replace(/[.!]+$/, '').trim();
}

// Проверка ответа на сервере. answer: массив id вариантов либо строка.
function checkAnswer(q, answer) {
  if (q.type === 'choice') {
    const picked = new Set((Array.isArray(answer) ? answer : []).map(String));
    const right = new Set(q.options.filter(o => o.correct).map(o => o.id));
    if (picked.size !== right.size) return false;
    for (const id of picked) if (!right.has(id)) return false;
    return true;
  }
  const a = String(answer ?? '').slice(0, 200);
  if (q.answerKind === 'number') {
    const x = parseNum(a);
    if (Number.isNaN(x)) return false;
    return q.answers.some(r => {
      const y = parseNum(r);
      return !Number.isNaN(y) && Math.abs(x - y) <= 1e-9 * Math.max(1, Math.abs(x), Math.abs(y));
    });
  }
  const n = normText(a);
  return n.length > 0 && q.answers.some(r => normText(r) === n);
}

// То, что видит ученик: без правильных ответов
function publicQuestion(q, index) {
  const out = { index, type: q.type, text: q.text, image: q.image, points: q.points, time: q.time };
  if (q.type === 'choice') {
    out.options = q.options.map(o => ({ id: o.id, text: o.text, image: o.image }));
    out.multi = q.options.filter(o => o.correct).length > 1;
  } else out.answerKind = q.answerKind;
  return out;
}

function describeAnswer(q, answer) {
  if (q.type === 'choice') {
    const ids = new Set((Array.isArray(answer) ? answer : []).map(String));
    return q.options.filter(o => ids.has(o.id)).map(o => o.text || '🖼').join('; ').slice(0, 200);
  }
  return String(answer ?? '').slice(0, 100);
}

module.exports = { sanitizeQuiz, checkAnswer, publicQuestion, describeAnswer, parseNum, normText };
