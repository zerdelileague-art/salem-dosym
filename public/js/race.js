// Беговые дорожки: обновляются по ключу (id), чтобы персонажи плавно ехали, а не прыгали.
import { animalSVG } from './animals.js';
import { t } from './i18n.js';

export function places(race) {
  const sorted = [...race].sort((a, b) => b.solved - a.solved);
  const map = new Map();
  let place = 0, prev = -1;
  sorted.forEach((r, i) => { if (r.solved !== prev) place = i + 1; prev = r.solved; map.set(r.id, place); });
  return map;
}

// opts: { total, meId, max (для ученика), stableOrder (для учителя), showOnline }
export function renderRace(box, race, opts) {
  const { total, meId, max = 0, stableOrder = false, showOnline = false } = opts;
  const pl = places(race);
  let list = race;
  if (!stableOrder) list = [...race].sort((a, b) => (pl.get(a.id) - pl.get(b.id)) || a.name.localeCompare(b.name));
  if (max && list.length > max) {
    const top = list.slice(0, max - 1);
    const me = list.find(r => r.id === meId);
    list = me && !top.includes(me) ? [...top, me] : list.slice(0, max);
  }
  box.classList.add('race');
  box.classList.toggle('compact', list.length > 12);

  const keep = new Set(list.map(r => r.id));
  for (const el of [...box.children]) if (!keep.has(el.dataset.id)) el.remove();

  const tickCount = Math.min(total, 30);
  list.forEach((r, i) => {
    let lane = box.querySelector(`.lane[data-id="${CSS.escape(r.id)}"]`);
    if (!lane) {
      lane = document.createElement('div');
      lane.className = 'lane';
      lane.dataset.id = r.id;
      lane.innerHTML = `<div class="lane-name"><span class="pl"></span><span class="off" hidden></span><span class="nm"></span></div>
        <div class="track"><div class="ticks">${'<i></i>'.repeat(tickCount)}</div><div class="runner"></div></div>`;
      lane.querySelector('.runner').innerHTML = animalSVG(r.animal);
      lane.dataset.animal = r.animal;
      lane.dataset.solved = r.solved;
      box.appendChild(lane);
    }
    if (lane.dataset.animal !== r.animal) { lane.querySelector('.runner').innerHTML = animalSVG(r.animal); lane.dataset.animal = r.animal; }
    lane.style.order = i;
    lane.classList.toggle('me', r.id === meId);
    lane.querySelector('.pl').textContent = pl.get(r.id);
    lane.querySelector('.nm').textContent = r.name + (r.id === meId ? ' (' + t('you') + ')' : '');
    lane.querySelector('.off').hidden = !showOnline || r.on;
    const p = total ? Math.min(1, r.solved / total) : 0;
    const runner = lane.querySelector('.runner');
    runner.style.setProperty('--p', p);
    runner.classList.toggle('done', !!r.done && r.solved >= total);
    const prev = Number(lane.dataset.solved);
    if (r.solved > prev) {
      runner.classList.add('moving');
      clearTimeout(runner._t);
      runner._t = setTimeout(() => runner.classList.remove('moving'), 1050);
    }
    lane.dataset.solved = r.solved;
    const ticks = lane.querySelectorAll('.ticks i');
    const doneTicks = Math.round(p * ticks.length);
    ticks.forEach((tk, j) => tk.classList.toggle('done', j < doneTicks));
  });
}
