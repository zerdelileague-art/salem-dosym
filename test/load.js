// Нагрузочный тест и проверки защиты: 100 учеников в одной комнате через настоящие WebSocket-соединения.
const { io } = require('socket.io-client');
const BASE = process.env.BASE || 'http://localhost:4100';
const N = Number(process.env.N || 100);
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exitCode = 1; } else console.log('ok  ', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function http(path, { method = 'GET', body, cookie } = {}) {
  const res = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) }, body: body && JSON.stringify(body) });
  const set = res.headers.get('set-cookie');
  let data = null; try { data = await res.json(); } catch (e) {}
  return { status: res.status, data, cookie: set ? set.split(';')[0] : null };
}
const call = (s, ev, d) => new Promise(r => s.emit(ev, d, r));

(async () => {
  // два учителя
  const u = 'load' + Date.now();
  const t1 = await http('/api/auth/register', { method: 'POST', body: { login: u, name: 'Load', password: 'password1' } });
  const t2 = await http('/api/auth/register', { method: 'POST', body: { login: u + 'b', name: 'Other', password: 'password2' } });
  assert(t1.cookie && t2.cookie, 'регистрация двух учителей');
  assert((await http('/api/quizzes')).status === 401, 'API наборов без входа закрыт (401)');
  assert((await http('/api/auth/login', { method: 'POST', body: { login: u, password: 'wrongpass' } })).status === 401, 'неверный пароль отклонён');

  const questions = [
    { type: 'choice', text: '$2+2$', points: 100, options: [{ text: '3' }, { text: '4', correct: true }, { text: '5' }] },
    { type: 'input', answerKind: 'number', text: '$\\frac{1}{2}$ = ?', answers: ['0,5'], points: 150 },
    { type: 'input', answerKind: 'text', text: 'Түс: аспан қандай?', answers: ['көк', 'синий'], points: 100 },
    { type: 'choice', text: 'Жұп', points: 200, options: [{ text: '2', correct: true }, { text: '3' }, { text: '6', correct: true }] }
  ];
  const q = await http('/api/quizzes', { method: 'POST', cookie: t1.cookie, body: { title: 'Нагрузка', questions } });
  assert(q.status === 200, 'набор сохранён');
  assert((await http('/api/quizzes/' + q.data.id, { cookie: t2.cookie })).status === 404, 'чужой набор недоступен другому учителю');
  const g = await http('/api/games', { method: 'POST', cookie: t1.cookie, body: { quizId: q.data.id } });
  const code = g.data.code;
  assert(/^\d{6}$/.test(code), 'комната создана: ' + code);
  assert((await http(`/api/games/${code}/results.xlsx`, { cookie: t2.cookie })).status === 404, 'чужие результаты недоступны');

  // организатор
  const host = io(BASE, { transports: ['websocket'], extraHeaders: { cookie: t1.cookie } });
  const intruder = io(BASE, { transports: ['websocket'], extraHeaders: { cookie: t2.cookie } });
  const anon = io(BASE, { transports: ['websocket'] });
  assert((await call(intruder, 'host:watch', { code })).error === 'no_room', 'чужой учитель не может управлять комнатой');
  assert((await call(anon, 'host:start', {})).error === 'auth', 'ученик/аноним не может начать игру');
  const hw = await call(host, 'host:watch', { code });
  assert(hw.ok, 'организатор подключён');
  let hostUpdates = 0;
  host.on('host', () => hostUpdates++);

  // N учеников
  const t0 = Date.now();
  const kids = await Promise.all(Array.from({ length: N }, async (_, i) => {
    const s = io(BASE, { transports: ['websocket'], forceNew: true });
    await new Promise(r => s.on('connect', r));
    const r = await call(s, 'player:join', { code, name: 'Оқушы ' + (i + 1) });
    let races = 0;
    s.on('race', () => races++);
    return { s, token: r.token, view: r.view, err: r.error, races: () => races };
  }));
  assert(kids.every(k => !k.err), `${N} учеников подключились за ${Date.now() - t0} мс`);
  const v0 = kids[0].view;
  assert(v0.question === null, 'до старта задания ученикам не отправляются');
  assert((await call(anon, 'player:resume', { code, token: 'fake' })).error === 'no_player', 'чужой/поддельный токен не принимается');
  assert((await call(kids[0].s, 'player:answer', { qIndex: 0, answer: [] })).error === 'not_running', 'ответ до старта не принимается');

  const st = await call(host, 'host:start', {});
  assert(st.ok, 'игра началась');
  const seen = [];
  for (let qi = 0; qi < 1; qi++) seen.push((await call(kids[1].s, 'player:resume', { code, token: kids[1].token })).view.question);
  const qjson = JSON.stringify(seen);
  assert(!/"correct"|"answers"/.test(qjson), 'в задании, которое получает ученик, нет правильных ответов: ' + qjson.slice(0, 120));
  await sleep(300);

  const lat = [];
  const answers = v => {
    const q = v.question;
    if (q.type === 'choice') {
      const ids = q.options.map(o => o.id);
      return q.index === 0 ? [ids[1]] : [ids[0], ids[2]];
    }
    return q.index === 1 ? '1/2' : 'КӨК ';
  };
  // Первому ученику: повторная отправка одного и того же ответа
  {
    const k = kids[0];
    const r1 = await call(k.s, 'player:answer', { qIndex: 0, answer: answers(k.view = { ...k.view, question: (await call(k.s, 'player:resume', { code, token: k.token })).view.question }) });
    const r2 = await call(k.s, 'player:answer', { qIndex: 0, answer: answers(k.view) });
    assert(r1.ok && r2.error === 'stale' && r2.view.me.score === 100, 'повторный ответ не начисляет баллы дважды');
    k.view = r2.view;
  }
  // Остальные решают параллельно; каждый 3-й сначала ошибается
  await Promise.all(kids.map(async (k, i) => {
    let v = i === 0 ? k.view : (await call(k.s, 'player:resume', { code, token: k.token })).view;
    if (i % 3 === 1) {
      const r = await call(k.s, 'player:answer', { qIndex: v.me.qIndex, answer: v.question.type === 'choice' ? [v.question.options[0].id] : '999' });
      if (r.ok !== false) console.error('expected wrong', r);
      await sleep(1300);
    }
    while (!v.me.finished) {
      await sleep(50 + Math.random() * 400);
      const a = Date.now();
      const r = await call(k.s, 'player:answer', { qIndex: v.me.qIndex, answer: answers(v) });
      lat.push(Date.now() - a);
      if (r.error) { console.error('answer err', r.error); await sleep(300); }
      v = r.view;
    }
    k.final = v;
  }));
  lat.sort((a, b) => a - b);
  assert(kids.every(k => k.final.me.finished && k.final.me.solved === 4 && k.final.me.score === 550), 'все дошли до финиша, у всех 550 баллов');
  console.log(`     задержка ответа: медиана ${lat[lat.length >> 1]} мс, 95% ${lat[Math.floor(lat.length * .95)]} мс, макс ${lat.at(-1)} мс (${lat.length} ответов)`);
  await sleep(600);
  const minRaces = Math.min(...kids.map(k => k.races()));
  assert(minRaces > 3, `каждый ученик получал обновления гонки в реальном времени (минимум ${minRaces})`);
  assert(hostUpdates > 3, `организатор получал обновления (${hostUpdates})`);

  // автозавершение, когда все финишировали
  await sleep(4500);
  const fin = await call(kids[5].s, 'player:resume', { code, token: kids[5].token });
  assert(fin.view.status === 'ended' && fin.view.results.ranking.length === N, 'игра завершилась автоматически, таблица на ' + N + ' участников');
  const wrongs = fin.view.results.ranking.filter(r => r.wrong === 1).length;
  assert(wrongs === kids.filter((_, i) => i % 3 === 1).length, 'ошибки подсчитаны верно (' + wrongs + ')');
  const x = await fetch(`${BASE}/api/games/${code}/results.xlsx?lang=ru`, { headers: { cookie: t1.cookie } });
  const buf = Buffer.from(await x.arrayBuffer());
  assert(x.status === 200 && buf.slice(0, 2).toString() === 'PK', 'Excel скачивается (' + buf.length + ' байт)');

  for (const k of kids) k.s.close();
  host.close(); intruder.close(); anon.close();
  console.log(process.exitCode ? 'ЕСТЬ ОШИБКИ' : 'ВСЁ ПРОШЛО');
  process.exit();
})().catch(e => { console.error(e); process.exit(1); });
