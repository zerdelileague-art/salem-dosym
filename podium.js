// Пьедестал для первых трёх мест и таблица результатов.
import { animalSVG } from './animals.js';
import { t } from './i18n.js';
import { esc, fmtTime } from './util.js';

export function podiumHTML(res) {
  const top = res.ranking.filter(r => r.place <= 3 && r.solved > 0).slice(0, 3);
  if (!top.length) return '';
  const slot = (r, i) => {
    const pos = Math.min(r.place, 3);
    return `<div class="pod p${i + 1}">
      ${animalSVG(r.animal, 'ani')}
      <div class="medal m${pos}">${pos}</div>
      <div class="nm">${esc(r.name)}</div>
      <div class="sc">${r.solved}/${res.total} · ${r.score} · ${fmtTime(r.timeMs)}</div>
      <div class="block">${pos}</div>
    </div>`;
  };
  return `<div class="podium">${top.map(slot).join('')}</div>`;
}

export function tableHTML(res, { meId = null, clickable = false, compact = false } = {}) {
  const hs = compact ? ' hide-s' : '';
  const rows = res.ranking.map(r => `<tr class="${r.place <= 3 && r.solved > 0 ? 'top' + r.place : ''} ${clickable ? 'click' : ''}" data-id="${esc(r.id)}" ${r.id === meId ? 'style="outline:3px solid #ffd45e;outline-offset:-3px"' : ''}>
    <td class="num">${r.place}</td><td class="nm">${esc(r.name)}</td>
    <td class="num">${r.solved} / ${res.total}</td><td class="num ok${hs}">${r.correct}</td><td class="num bad${hs}">${r.wrong}</td>
    <td class="num">${fmtTime(r.timeMs)}</td><td class="num"><b>${r.score}</b></td></tr>`).join('');
  return `<div class="tablewrap"><table>
    <thead><tr><th class="num">${t('place')}</th><th>${t('name')}</th><th class="num">${t('solved')}</th><th class="num${hs}">${t('correct')}</th>
    <th class="num${hs}">${t('wrongs')}</th><th class="num">${t('time')}</th><th class="num">${t('score')}</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}
