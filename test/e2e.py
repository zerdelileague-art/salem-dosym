"""Сквозной тест: учитель + 3 ученика в независимых браузерных сессиях."""
import asyncio, re, sys, os
from playwright.async_api import async_playwright, expect

BASE = os.environ.get('BASE', 'http://localhost:4100')
SHOTS = '/home/claude/shots/e2e'
os.makedirs(SHOTS, exist_ok=True)
errors = []

def watch(page, tag):
    page.on('pageerror', lambda e: errors.append(f'{tag}: {e}'))
    page.on('console', lambda m: m.type == 'error' and 'fonts.g' not in m.text and errors.append(f'{tag} console: {m.text}'))

async def shot(page, name):
    await page.wait_for_timeout(400)
    await page.screenshot(path=f'{SHOTS}/{name}.png')

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        async def ctx(w, h, mobile=False):
            c = await b.new_context(viewport={'width': w, 'height': h}, is_mobile=mobile, has_touch=mobile, accept_downloads=True)
            await c.route(re.compile(r'fonts\.(googleapis|gstatic)\.com'), lambda r: r.abort())
            return c
        tc = await ctx(1280, 860)
        T = await tc.new_page(); watch(T, 'teacher')

        # ---- регистрация учителя ----
        await T.goto(BASE + '/teacher')
        await T.click('#aSwitch')
        await T.fill('#aName', 'Айгүл Серікқызы')
        await T.fill('#aLogin', 'aigul')
        await T.fill('#aPass', 'qwerty123')
        await T.click('#authForm button[type=submit]')
        await expect(T.locator('#newQuiz')).to_be_visible()
        await T.click('#newQuiz')
        await expect(T.locator('#eTitle')).to_be_visible()
        await T.fill('#eTitle', 'Бөлшектер мен сандар')

        Q = lambda i: f'.qe[data-i="{i}"]'
        # 1: варианты, формула через кнопку
        await T.fill(f'{Q(0)} textarea[data-k=text]', 'Есепте: ')
        await T.click(f'{Q(0)} .mathbar button[data-m="0"]')  # \frac{}{}
        await T.keyboard.type('1'); await T.keyboard.press('ArrowRight'); await T.keyboard.press('ArrowRight'); await T.keyboard.type('2')
        await T.keyboard.press('End')
        await T.keyboard.type(' + $\\frac{1}{4}$ = ?')
        for j, v in enumerate(['$\\frac{2}{6}$', '$\\frac{3}{4}$', '$\\frac{1}{8}$', '1']):
            await T.fill(f'{Q(0)} .opt-edit[data-j="{j}"] input[data-k=otext]', v)
        await T.check(f'{Q(0)} .opt-edit[data-j="1"] input[data-k=ocor]')
        # 2: число
        await T.click('#eAdd')
        await T.click(f'{Q(1)} .seg[data-k=type] button[data-v=input]')
        await T.fill(f'{Q(1)} textarea[data-k=text]', 'Есепте: $2^{3}$')
        await T.fill(f'{Q(1)} textarea[data-k=answers]', '8')
        # 3: текст
        await T.click('#eAdd')
        await T.click(f'{Q(2)} .seg[data-k=type] button[data-v=input]')
        await T.click(f'{Q(2)} .seg[data-k=kind] button[data-v=text]')
        await T.fill(f'{Q(2)} textarea[data-k=text]', 'Қазақстанның астанасы қай қала?')
        await T.fill(f'{Q(2)} textarea[data-k=answers]', 'Астана')
        # 4: несколько верных
        await T.click('#eAdd')
        await T.fill(f'{Q(3)} textarea[data-k=text]', 'Жұп сандарды таңда')
        for j, v in enumerate(['2', '3', '4', '5']):
            await T.fill(f'{Q(3)} .opt-edit[data-j="{j}"] input[data-k=otext]', v)
        await T.check(f'{Q(3)} .opt-edit[data-j="0"] input[data-k=ocor]')
        await T.check(f'{Q(3)} .opt-edit[data-j="2"] input[data-k=ocor]')
        # 5: таймер 6 сек
        await T.click('#eAdd')
        await T.fill(f'{Q(4)} textarea[data-k=text]', '$\\sqrt{81}$ = ?')
        await T.fill(f'{Q(4)} .opt-edit[data-j="0"] input[data-k=otext]', '7')
        await T.fill(f'{Q(4)} .opt-edit[data-j="1"] input[data-k=otext]', '9')
        await T.check(f'{Q(4)} .opt-edit[data-j="1"] input[data-k=ocor]')
        await T.click(f'{Q(4)} .seg[data-k=timer] button[data-v=on]')
        await T.fill(f'{Q(4)} input[data-k=time]', '6')
        await T.locator(f'{Q(4)} input[data-k=time]').blur()
        # проверка валидации: пустой вариант без отметки
        await T.click('#eAdd')
        await T.fill(f'{Q(5)} textarea[data-k=text]', 'Удалим это задание')
        await T.click('#eSave')
        await expect(T.locator(f'{Q(5)}.err')).to_be_visible()
        await T.click(f'{Q(5)} [data-act=qdel]')
        await T.click('#overlay [data-a="1"]')
        await T.locator(Q(0)).scroll_into_view_if_needed()
        await shot(T, '01-editor')
        await T.click('#eSave')
        await expect(T.locator('#eNote')).to_have_text(re.compile('Сақталды'))
        assert '/teacher/quiz/' in T.url, T.url
        await T.click('#eGame')
        await T.wait_for_url(re.compile(r'/teacher/game/\d{6}'))
        code = T.url.rsplit('/', 1)[1]
        print('room', code)
        await expect(T.locator('.bigcode')).to_have_text(code)

        # ---- ученики ----
        sa = await ctx(390, 844, True); A = await sa.new_page(); watch(A, 'A')
        sb = await ctx(360, 780, True); B = await sb.new_page(); watch(B, 'B')
        sc = await ctx(1024, 768); C = await sc.new_page(); watch(C, 'C')
        await A.goto(BASE + '/'); await shot(A, '02-home-phone')
        await A.fill('#joinCode', code)
        await A.fill('#joinName', 'Айгерім')
        await A.click('#joinBtn')
        await expect(A.locator('#greet')).to_have_text('Сәлем, Айгерім!')
        await B.goto(f'{BASE}/join/{code}')
        await expect(B.locator('#joinCode')).to_have_value(code)
        await B.click('.lang button[data-lang=ru]')
        await B.fill('#joinName', 'Данияр')
        await B.click('#joinBtn')
        await expect(B.locator('#greet')).to_have_text('Привет, Данияр!')
        await B.click('#pick button[data-a=fox]')
        await C.goto(f'{BASE}/join/{code}')
        await C.fill('#joinName', 'айгерім')
        await C.click('#joinBtn')
        await expect(C.locator('#joinError')).not_to_be_empty()  # имя занято
        await C.fill('#joinName', 'Сәуле')
        await C.click('#joinBtn')
        await expect(C.locator('#greet')).to_be_visible()
        await expect(T.locator('#hchips .chip')).to_have_count(3)
        await expect(A.locator('#chips .chip')).to_have_count(3)
        await shot(A, '03-lobby-phone')
        await shot(T, '04-host-lobby')

        # ---- старт ----
        await T.click('#start')
        for P in (A, B, C):
            await expect(P.locator('#qcard .qtext')).to_be_visible()
        html = await A.locator('#qcard').inner_html()
        assert 'correct' not in html
        await A.wait_for_timeout(1300)
        await shot(A, '05-question-phone')

        # A: ошибка, затем верно
        await A.click('#opts .opt >> nth=0')
        await expect(A.locator('#opts .opt.bad')).to_have_count(1)
        await expect(A.locator('#qnum')).to_have_text('Тапсырма 1 / 5')
        await A.wait_for_timeout(1400)
        await A.click('#opts .opt >> nth=1')
        await expect(A.locator('#qnum')).to_have_text('Тапсырма 2 / 5')
        await A.fill('#ans', '8'); await A.click('#ansForm button[type=submit]')
        await expect(A.locator('#qnum')).to_have_text('Тапсырма 3 / 5')

        # B: верно, затем обновление страницы — прогресс восстанавливается
        await B.click('#opts .opt >> nth=1')
        await expect(B.locator('#qnum')).to_have_text('Задание 2 из 5')
        await B.reload()
        await expect(B.locator('#qnum')).to_have_text('Задание 2 из 5')
        await B.fill('#ans', '16/2'); await B.click('#ansForm button[type=submit]')
        await expect(B.locator('#qnum')).to_have_text('Задание 3 из 5')
        await shot(B, '06-race-android-ru')

        # пауза
        await expect(T.locator('#pz')).to_be_visible()
        await T.click('#pz')
        await expect(A.locator('#pausedOv')).to_be_visible()
        await shot(A, '07-paused')
        await T.click('#pz')
        await expect(A.locator('#pausedOv')).to_have_count(0)

        # A: текст (регистр/пробелы), несколько верных, таймер истекает
        await A.fill('#ans', '  астана '); await A.click('#ansForm button[type=submit]')
        await expect(A.locator('#qnum')).to_have_text('Тапсырма 4 / 5')
        await A.click('#opts .opt >> nth=0'); await A.click('#opts .opt >> nth=2'); await A.click('#send')
        await expect(A.locator('#qnum')).to_have_text('Тапсырма 5 / 5')
        await expect(A.locator('#timer')).to_be_visible()
        await shot(A, '08-timer')
        await expect(A.locator('.h2')).to_have_text('Мәреге жеттің!', timeout=9000)  # время вышло → финиш
        await shot(A, '09-finished')

        # B: дорешивает всё правильно
        await B.fill('#ans', 'Астана'); await B.click('#ansForm button[type=submit]')
        await expect(B.locator('#qnum')).to_have_text('Задание 4 из 5')
        await B.click('#opts .opt >> nth=0'); await B.click('#opts .opt >> nth=2'); await B.click('#send')
        await expect(B.locator('#qnum')).to_have_text('Задание 5 из 5')
        await B.click('#opts .opt >> nth=1')
        await expect(B.locator('.h2')).to_have_text('Ты на финише!')

        # C: одно верное
        await C.click('#opts .opt >> nth=1')
        await expect(C.locator('#qnum')).to_have_text('Тапсырма 2 / 5')
        await shot(T, '10-host-live')
        await T.click('#htb tr >> nth=0')
        await expect(T.locator('#overlay .attempt').first).to_be_visible()
        await shot(T, '11-host-player-detail')
        await T.click('#overlay [data-close]')

        # завершение
        await T.click('#end')
        await T.click('#overlay [data-a="1"]')
        await expect(T.locator('.podium')).to_be_visible()
        await expect(A.locator('.podium')).to_be_visible()
        await T.wait_for_timeout(2200)
        await shot(T, '12-host-results')
        await A.wait_for_timeout(2000)
        await shot(A, '13-results-phone')
        await shot(B, '14-results-android')
        rows = await T.locator('.tablewrap tbody tr').all_inner_texts()
        print('\n'.join(rows))
        assert rows[0].startswith('1') and 'Данияр' in rows[0], rows[0]

        async with T.expect_download() as dl:
            await T.click('a[href*="results.xlsx"]')
        d = await dl.value
        await d.save_as('/home/claude/shots/e2e/results.xlsx')
        print('xlsx', d.suggested_filename)

        # кабинет: история
        await T.click('#toCab')
        await expect(T.locator('#games tbody tr')).to_have_count(1)
        await shot(T, '15-dashboard')
        await b.close()
    print('ERRORS:', errors or 'none')
    if errors: sys.exit(1)

asyncio.run(main())
