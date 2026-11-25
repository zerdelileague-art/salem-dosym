'use strict';
// Итоги игры в Excel (.xlsx): лист с таблицей результатов и лист с ответами по заданиям.

const ExcelJS = require('exceljs');

const T = {
  kk: {
    sheet: 'Нәтижелер', detail: 'Жауаптар', place: 'Орын', name: 'Аты', solved: 'Шешілген тапсырмалар',
    correct: 'Дұрыс жауаптар', wrong: 'Қате жауаптар', time: 'Жалпы уақыт', score: 'Ұпай',
    game: 'Ойын', code: 'Бөлме коды', date: 'Күні', q: 'Тапсырма', timeout: 'уақыт бітті', yes: '✓', no: '✗'
  },
  ru: {
    sheet: 'Результаты', detail: 'Ответы', place: 'Место', name: 'Имя', solved: 'Решено заданий',
    correct: 'Правильных ответов', wrong: 'Неправильных ответов', time: 'Общее время', score: 'Баллы',
    game: 'Игра', code: 'Код комнаты', date: 'Дата', q: 'Задание', timeout: 'время вышло', yes: '✓', no: '✗'
  }
};

const fmtTime = ms => {
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(r).padStart(2, '0');
};

// Формулы LaTeX → читаемый текст для таблицы
function plainMath(s) {
  let r = String(s ?? '');
  for (let i = 0; i < 3; i++) r = r.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)').replace(/\\sqrt\[([^\]]*)\]\{([^{}]*)\}/g, '$1√($2)').replace(/\\sqrt\{([^{}]*)\}/g, '√($1)');
  const map = { times: '×', div: '÷', pm: '±', le: '≤', ge: '≥', ne: '≠', approx: '≈', pi: 'π', angle: '∠', triangle: '△', perp: '⊥', parallel: '∥', infty: '∞', alpha: 'α', beta: 'β', circ: '°', cdot: '·', left: '', right: '' };
  r = r.replace(/\\([a-zA-Z]+)/g, (m, k) => (k in map ? map[k] : m));
  return r.replace(/\^\{([^{}]*)\}/g, '^$1').replace(/_\{([^{}]*)\}/g, '_$1').replace(/\(([0-9a-zA-Z.]+)\)\/\(([0-9a-zA-Z.]+)\)/g, '$1/$2').replace(/\^°/g, '°').replace(/\$/g, '').trim();
}

async function resultsWorkbook(game, lang, tzOffsetMin = 0) {
  const t = T[lang] || T.kk;
  const res = game.results || game.computeResults();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Сәлем, досым!';
  const ws = wb.addWorksheet(t.sheet, { views: [{ state: 'frozen', ySplit: 5 }] });

  ws.mergeCells('A1:G1');
  ws.getCell('A1').value = game.title;
  ws.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FF7A2A68' } };
  ws.getCell('A2').value = t.code; ws.getCell('B2').value = game.code;
  ws.getCell('A3').value = t.date; ws.getCell('B3').value = new Date((res.endedAt || Date.now()) - tzOffsetMin * 60000);
  ws.getCell('B3').numFmt = 'dd.mm.yyyy hh:mm';

  const head = [t.place, t.name, t.solved, t.correct, t.wrong, t.time, t.score];
  const hr = ws.getRow(5);
  hr.values = head;
  hr.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  hr.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  hr.height = 32;
  head.forEach((_, i) => { hr.getCell(i + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB0508F' } }; });

  const medal = ['FFFFE08A', 'FFE6E9F0', 'FFF6D2B5'];
  res.ranking.forEach((r, i) => {
    const row = ws.getRow(6 + i);
    row.values = [r.place, r.name, `${r.solved} / ${res.total}`, r.correct, r.wrong, fmtTime(r.timeMs), r.score];
    if (r.place <= 3) row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: medal[r.place - 1] } }; });
    row.getCell(1).alignment = { horizontal: 'center' };
    for (const c of [3, 4, 5, 6, 7]) row.getCell(c).alignment = { horizontal: 'right' };
  });
  [8, 26, 16, 14, 14, 13, 10].forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  // Лист с подробными ответами: игрок × задание
  const wd = wb.addWorksheet(t.detail);
  const qs = game.questions;
  wd.getRow(1).values = [t.name, ...qs.map((q, i) => `${t.q} ${i + 1}: ${plainMath(q.text).slice(0, 60)}`)];
  wd.getRow(1).alignment = { wrapText: true, vertical: 'top' };
  wd.getRow(1).font = { bold: true };
  const players = [...game.players.values()];
  const order = new Map(res.ranking.map((r, i) => [r.id, i]));
  players.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  players.forEach((p, i) => {
    const cells = qs.map((_, qi) => {
      const at = p.attempts.filter(a => a.q === qi);
      if (!at.length) return '';
      return at.map(a => (a.ok ? t.yes : t.no) + ' ' + (a.timeout ? t.timeout : plainMath(a.a))).join(' | ');
    });
    wd.getRow(2 + i).values = [p.name, ...cells];
  });
  wd.getColumn(1).width = 24;
  for (let i = 0; i < qs.length; i++) wd.getColumn(i + 2).width = 22;

  return wb.xlsx.writeBuffer();
}

module.exports = { resultsWorkbook, fmtTime, plainMath };
