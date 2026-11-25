// Тексты интерфейса на казахском и русском. Язык — выбор пользователя (переключатель ҚАЗ/РУС).

const D = {
  kk: {
    hello: 'Сәлем, досым!', catAria: 'Қолын бұлғап тұрған сүйкімді мысық',
    whatName: 'Атың кім?', namePh: 'Атыңды жаз', codeLabel: 'Бөлме коды', codePh: 'Мысалы, 482915',
    join: 'Қосылу', forTeacher: 'Мұғалімге арналған кабинет',
    'err.no_room': 'Мұндай бөлме табылмады. Кодты тексер.', 'err.name_taken': 'Бұл атпен ойыншы бар. Тегіңнің бірінші әрпін қос.',
    'err.game_ended': 'Бұл ойын аяқталды.', 'err.room_full': 'Бөлмеде бос орын жоқ.', 'err.name_required': 'Атыңды жаз.',
    'err.code_required': 'Бөлме кодын жаз (6 сан).', 'err.server': 'Қате кетті. Қайта көрші.', 'err.offline': 'Байланыс жоқ. Интернетті тексер.',
    'err.auth': 'Қайта кіріңіз.', 'err.bad_login': 'Логин немесе құпиясөз қате.', 'err.too_many': 'Тым көп әрекет. 15 минуттан кейін көріңіз.',
    'err.login_taken': 'Бұл логин бос емес.', 'err.login_format': 'Логин: 3–40 латын әрпі, сан немесе . _ - @',
    'err.password_short': 'Құпиясөз кемінде 8 таңба болсын.', 'err.signup_code': 'Тіркелу коды қате.', 'err.name_req2': 'Атыңызды жазыңыз.',
    'err.image': 'Суретті жүктеу мүмкін болмады.', 'err.too_large': 'Файл тым үлкен.', 'err.empty_quiz': 'Жинақта тапсырма жоқ.',
    greetName: 'Сәлем, {name}!', lobbyWait: 'Мұғалім ойынды бастағанша күтеміз', pickAnimal: 'Кейіпкеріңді таңда',
    inRoom: 'Бөлмеде: {n}', go: 'Бастадық!',
    cat: 'Мысық', bunny: 'Қоян', bear: 'Аюжан', fox: 'Түлкі', panda: 'Панда',
    task: 'Тапсырма {i} / {n}', answerBtn: 'Жауап беру', answerPh: 'Жауабыңды жаз', pickAll: 'Барлық дұрыс жауапты таңда, сосын «Жауап беру» бас',
    good: ['Жарайсың!', 'Керемет!', 'Дұрыс!', 'Тамаша!', 'Мықтысың!'], wrong: 'Тағы ойланып көрші!', timeout: 'Уақыт бітті',
    finishTitle: 'Мәреге жеттің!', finishSub: 'Басқалардың мәреге жетуін күтеміз', paused: 'Үзіліс', pausedSub: 'Мұғалім ойынды сәл тоқтатты',
    reconnecting: 'Қайта қосылып жатыр…', removed: 'Мұғалім сені бөлмеден шығарды', toHome: 'Басты бетке', you: 'сен',
    yourPlace: 'Сенің орның: {p} / {n}', solvedN: 'Шешілді', scoreN: 'Ұпай', timeN: 'Уақыт',
    results: 'Нәтижелер', congrats: 'Құттықтаймыз! Сен — {p}-орында!',
    motivate: ['Сен жақсы жұмыс жасадың! Келесі жолы бұдан да жақсы болады.', 'Жарайсың! Әр тапсырма сені мықты етеді.', 'Тамаша қатысу! Жаттыға бер — жеңіс алда!', 'Сен қолдан келгеннің бәрін жасадың. Мақтанамыз!'],
    place: 'Орын', name: 'Аты', solved: 'Шешілді', correct: 'Дұрыс', wrongs: 'Қате', time: 'Уақыт', score: 'Ұпай', status: 'Күйі',
    start: 'Старт', finish: 'Мәре',
    // учитель
    cabinet: 'Мұғалім кабинеті', login: 'Кіру', register: 'Тіркелу', loginLabel: 'Логин', password: 'Құпиясөз', yourName: 'Атыңыз',
    signupCode: 'Тіркелу коды', noAccount: 'Аккаунтыңыз жоқ па? Тіркелу', haveAccount: 'Аккаунтыңыз бар ма? Кіру', logout: 'Шығу',
    teacherNote: 'Оқушыларға аккаунт керек емес — олар тек атын және бөлме кодын жазады.',
    myQuizzes: 'Тапсырмалар жинақтары', newQuiz: 'Жаңа жинақ', qCount: '{n} тапсырма', edit: 'Өңдеу', duplicate: 'Көшірме',
    del: 'Жою', createGame: 'Ойын құру', history: 'Ойындар тарихы', open: 'Ашу', emptyQuizzes: 'Әзірге жинақ жоқ. Алғашқысын құрыңыз!',
    emptyGames: 'Әзірге ойын болған жоқ.', players: 'Қатысушылар', date: 'Күні',
    'st.lobby': 'Күту', 'st.running': 'Жүріп жатыр', 'st.paused': 'Үзіліс', 'st.ended': 'Аяқталды',
    quizTitle: 'Жинақ атауы', quizTitlePh: 'Мысалы: Бөлшектер, 5-сынып', addQuestion: 'Тапсырма қосу', fromBank: 'Сақталғандардан қосу',
    save: 'Сақтау', saved: 'Сақталды', unsaved: 'Сақталмаған өзгерістер бар', back: 'Артқа', saving: 'Сақталып жатыр…',
    typeChoice: 'Жауап нұсқалары', typeInput: 'Жауапты өзі жазады', qText: 'Тапсырма мәтіні',
    textHint: 'Формулаларды $…$ ішіне жазыңыз немесе батырмаларды басыңыз. Мысалы: $\\frac{1}{2}+\\frac{1}{3}$',
    preview: 'Оқушы осылай көреді', previewPh: 'Мәтін осында көрінеді', addImage: 'Сурет немесе сызба қосу', removeImage: 'Суретті алып тастау',
    imgHint: 'Суретті Ctrl+V арқылы да қоюға болады', options: 'Жауап нұсқалары', addOption: 'Нұсқа қосу', correctOpt: 'Дұрыс', optPh: 'Нұсқа {n}',
    answerKind: 'Жауап түрі', kindNumber: 'Сан', kindText: 'Мәтін', answers: 'Дұрыс жауап(тар)',
    answersHint: 'Бірнеше нұсқа болса, әрқайсысын жаңа жолдан жазыңыз. Сандарда 0,5 мен 1/2 бірдей саналады.',
    points: 'Ұпай', timerLabel: 'Таймер', timerOn: 'Қосулы', timerOff: 'Таймерсіз', seconds: 'Секунд',
    up: 'Жоғары', down: 'Төмен', removeQ: 'Тапсырманы жою', copyQ: 'Тапсырманың көшірмесі',
    'v.quiz_title': 'Жинақ атауын жазыңыз.', 'v.q_text': '{i}-тапсырма: мәтін немесе сурет қажет.', 'v.q_options': '{i}-тапсырма: кемінде 2 нұсқа қажет.',
    'v.q_correct': '{i}-тапсырма: дұрыс нұсқаны белгілеңіз.', 'v.q_answer': '{i}-тапсырма: дұрыс жауапты жазыңыз.', 'v.q_number': '{i}-тапсырма: жауап сан болуы керек (мысалы 12, -3,5 немесе 3/4).',
    noQuestions: 'Әзірге тапсырма жоқ. «Тапсырма қосу» батырмасын басыңыз.',
    bankTitle: 'Сақталған тапсырмалар', bankAdd: 'Таңдалғандарды қосу', bankEmpty: 'Сақталған тапсырма жоқ.',
    cancel: 'Болдырмау', yes: 'Иә', confirmDelete: '«{t}» жинағын жою керек пе?', confirmLeave: 'Сақталмаған өзгерістер жоғалады. Шығасыз ба?',
    confirmRemoveQ: 'Бұл тапсырманы жою керек пе?', saveFirst: 'Алдымен жинақты сақтаңыз.',
    roomCode: 'Бөлме коды', joinAt: 'Қосылу сілтемесі', copyLink: 'Сілтемені көшіру', copied: 'Көшірілді!', startGame: 'Ойынды бастау',
    waitPlayers: 'Қатысушыларды күтудеміз', pause: 'Үзіліс', resume: 'Жалғастыру', endGame: 'Ойынды аяқтау',
    confirmEnd: 'Ойынды аяқтайсыз ба? Нәтижелер сақталады.', projector: 'Проекторға шығару', exitProjector: 'Басқару панеліне оралу',
    downloadExcel: 'Excel-ге жүктеу', online: 'желіде', offline: 'желіден тыс', answersOf: '{name}: жауаптары', noAnswers: 'Әзірге жауап жоқ.',
    removePlayer: 'Бөлмеден шығару', toCabinet: 'Кабинетке', scanQr: 'Телефонмен QR-кодты сканерлеңіз', joinedN: 'Қосылды: {n}',
    needPlayers: 'Кемінде бір қатысушы қосылуы керек', progress: 'Жарыс барысы', table: 'Қатысушылар кестесі', qShort: '{i}-т.',
    gameEnded: 'Ойын аяқталды', close: 'Жабу', copyFail: 'Көшіру мүмкін болмады — сілтемені қолмен белгілеңіз.'
  },
  ru: {
    hello: 'Привет, мой друг!', catAria: 'Милая кошечка машет лапкой',
    whatName: 'Как тебя зовут?', namePh: 'Введи своё имя', codeLabel: 'Код комнаты', codePh: 'Например, 482915',
    join: 'Присоединиться', forTeacher: 'Кабинет учителя',
    'err.no_room': 'Комната не найдена. Проверь код.', 'err.name_taken': 'Такое имя уже есть. Добавь первую букву фамилии.',
    'err.game_ended': 'Эта игра уже закончилась.', 'err.room_full': 'В комнате нет свободных мест.', 'err.name_required': 'Напиши своё имя.',
    'err.code_required': 'Введи код комнаты (6 цифр).', 'err.server': 'Что-то пошло не так. Попробуй ещё раз.', 'err.offline': 'Нет связи. Проверь интернет.',
    'err.auth': 'Войдите снова.', 'err.bad_login': 'Неверный логин или пароль.', 'err.too_many': 'Слишком много попыток. Попробуйте через 15 минут.',
    'err.login_taken': 'Этот логин уже занят.', 'err.login_format': 'Логин: 3–40 латинских букв, цифр или . _ - @',
    'err.password_short': 'Пароль — не меньше 8 символов.', 'err.signup_code': 'Неверный код регистрации.', 'err.name_req2': 'Введите ваше имя.',
    'err.image': 'Не удалось загрузить рисунок.', 'err.too_large': 'Файл слишком большой.', 'err.empty_quiz': 'В наборе нет заданий.',
    greetName: 'Привет, {name}!', lobbyWait: 'Ждём, когда учитель начнёт игру', pickAnimal: 'Выбери своего героя',
    inRoom: 'В комнате: {n}', go: 'Поехали!',
    cat: 'Кошечка', bunny: 'Зайчик', bear: 'Медвежонок', fox: 'Лисичка', panda: 'Панда',
    task: 'Задание {i} из {n}', answerBtn: 'Ответить', answerPh: 'Напиши ответ', pickAll: 'Выбери все правильные ответы и нажми «Ответить»',
    good: ['Молодец!', 'Отлично!', 'Верно!', 'Здорово!', 'Супер!'], wrong: 'Подумай ещё!', timeout: 'Время вышло',
    finishTitle: 'Ты на финише!', finishSub: 'Ждём остальных участников', paused: 'Пауза', pausedSub: 'Учитель ненадолго остановил игру',
    reconnecting: 'Переподключение…', removed: 'Учитель убрал тебя из комнаты', toHome: 'На главную', you: 'ты',
    yourPlace: 'Твоё место: {p} из {n}', solvedN: 'Решено', scoreN: 'Баллы', timeN: 'Время',
    results: 'Результаты', congrats: 'Поздравляем! Ты на {p}-м месте!',
    motivate: ['Ты отлично поработал! В следующий раз будет ещё лучше.', 'Молодец! Каждое задание делает тебя сильнее.', 'Прекрасная игра! Тренируйся — победа впереди!', 'Ты сделал всё, что мог. Мы тобой гордимся!'],
    place: 'Место', name: 'Имя', solved: 'Решено', correct: 'Верно', wrongs: 'Ошибки', time: 'Время', score: 'Баллы', status: 'Статус',
    start: 'Старт', finish: 'Финиш',
    cabinet: 'Кабинет учителя', login: 'Войти', register: 'Регистрация', loginLabel: 'Логин', password: 'Пароль', yourName: 'Ваше имя',
    signupCode: 'Код регистрации', noAccount: 'Нет аккаунта? Зарегистрироваться', haveAccount: 'Уже есть аккаунт? Войти', logout: 'Выйти',
    teacherNote: 'Ученикам аккаунт не нужен — они вводят только имя и код комнаты.',
    myQuizzes: 'Наборы заданий', newQuiz: 'Новый набор', qCount: '{n}', edit: 'Редактировать', duplicate: 'Копия',
    del: 'Удалить', createGame: 'Создать игру', history: 'История игр', open: 'Открыть', emptyQuizzes: 'Пока нет наборов. Создайте первый!',
    emptyGames: 'Игр пока не было.', players: 'Участники', date: 'Дата',
    'st.lobby': 'Ожидание', 'st.running': 'Идёт', 'st.paused': 'Пауза', 'st.ended': 'Завершена',
    quizTitle: 'Название набора', quizTitlePh: 'Например: Дроби, 5 класс', addQuestion: 'Добавить задание', fromBank: 'Добавить из сохранённых',
    save: 'Сохранить', saved: 'Сохранено', unsaved: 'Есть несохранённые изменения', back: 'Назад', saving: 'Сохраняем…',
    typeChoice: 'Варианты ответа', typeInput: 'Ввод ответа', qText: 'Текст задания',
    textHint: 'Формулы пишите внутри $…$ или нажимайте кнопки. Например: $\\frac{1}{2}+\\frac{1}{3}$',
    preview: 'Так увидит ученик', previewPh: 'Здесь появится текст', addImage: 'Добавить рисунок или схему', removeImage: 'Убрать рисунок',
    imgHint: 'Рисунок можно вставить и через Ctrl+V', options: 'Варианты ответа', addOption: 'Добавить вариант', correctOpt: 'Верный', optPh: 'Вариант {n}',
    answerKind: 'Тип ответа', kindNumber: 'Число', kindText: 'Текст', answers: 'Правильный ответ(ы)',
    answersHint: 'Если вариантов несколько — каждый с новой строки. Для чисел 0,5 и 1/2 считаются одинаковыми.',
    points: 'Баллы', timerLabel: 'Таймер', timerOn: 'Включён', timerOff: 'Без таймера', seconds: 'Секунд',
    up: 'Выше', down: 'Ниже', removeQ: 'Удалить задание', copyQ: 'Копия задания',
    'v.quiz_title': 'Введите название набора.', 'v.q_text': 'Задание {i}: нужен текст или рисунок.', 'v.q_options': 'Задание {i}: нужно минимум 2 варианта.',
    'v.q_correct': 'Задание {i}: отметьте верный вариант.', 'v.q_answer': 'Задание {i}: укажите правильный ответ.', 'v.q_number': 'Задание {i}: ответ должен быть числом (например 12, -3,5 или 3/4).',
    noQuestions: 'Пока нет заданий. Нажмите «Добавить задание».',
    bankTitle: 'Сохранённые задания', bankAdd: 'Добавить выбранные', bankEmpty: 'Сохранённых заданий нет.',
    cancel: 'Отмена', yes: 'Да', confirmDelete: 'Удалить набор «{t}»?', confirmLeave: 'Несохранённые изменения пропадут. Выйти?',
    confirmRemoveQ: 'Удалить это задание?', saveFirst: 'Сначала сохраните набор.',
    roomCode: 'Код комнаты', joinAt: 'Ссылка для входа', copyLink: 'Скопировать ссылку', copied: 'Скопировано!', startGame: 'Начать игру',
    waitPlayers: 'Ждём участников', pause: 'Пауза', resume: 'Продолжить', endGame: 'Завершить игру',
    confirmEnd: 'Завершить игру? Результаты сохранятся.', projector: 'Вывести на проектор', exitProjector: 'Вернуть панель управления',
    downloadExcel: 'Скачать Excel', online: 'в сети', offline: 'не в сети', answersOf: '{name}: ответы', noAnswers: 'Ответов пока нет.',
    removePlayer: 'Убрать из комнаты', toCabinet: 'В кабинет', scanQr: 'Отсканируйте QR-код телефоном', joinedN: 'Подключились: {n}',
    needPlayers: 'Нужен хотя бы один участник', progress: 'Ход гонки', table: 'Таблица участников', qShort: 'З{i}',
    gameEnded: 'Игра завершена', close: 'Закрыть', copyFail: 'Не удалось скопировать — выделите ссылку вручную.'
  }
};

let lang = 'kk';
try { const s = localStorage.getItem('lang'); if (s === 'ru' || s === 'kk') lang = s; } catch (e) {}

const listeners = new Set();
export const getLang = () => lang;
export function setLang(l) {
  if (l !== 'kk' && l !== 'ru' || l === lang) return;
  lang = l;
  try { localStorage.setItem('lang', l); } catch (e) {}
  applyStatic();
  listeners.forEach(fn => fn(l));
}
export const onLang = fn => listeners.add(fn);

function ruPlural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b === 1) return one;
  if (b >= 2 && b <= 4) return few;
  return many;
}

export function t(key, vars) {
  let s = D[lang][key] ?? D.kk[key] ?? key;
  if (key === 'qCount' && lang === 'ru') s = '{n} ' + ruPlural(vars.n, 'задание', 'задания', 'заданий');
  if (typeof s === 'string' && vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));
  return s;
}

export function applyStatic(root = document) {
  document.documentElement.lang = lang;
  root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
  root.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  document.querySelectorAll('.lang button').forEach(b => b.classList.toggle('on', b.dataset.lang === lang));
}
