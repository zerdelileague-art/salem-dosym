"""Скриншоты экранов на разных устройствах (после e2e, пока сервер запущен)."""
import asyncio, re, os
from playwright.async_api import async_playwright

BASE = 'http://localhost:4100'
OUT = '/home/claude/shots/ui'
os.makedirs(OUT, exist_ok=True)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        async def page(w, h):
            c = await b.new_context(viewport={'width': w, 'height': h})
            await c.route(re.compile(r'fonts\.(googleapis|gstatic)\.com'), lambda r: r.abort())
            pg = await c.new_page()
            errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            return pg, errs
        for name, (w, h) in {'home-desktop': (1440, 900), 'home-iphone': (390, 844), 'home-android': (360, 780), 'home-tablet': (820, 1180), 'home-landscape': (844, 390), 'home-board': (1920, 1080)}.items():
            pg, errs = await page(w, h)
            await pg.goto(BASE + '/')
            await pg.wait_for_timeout(2600)
            sw = await pg.evaluate('document.documentElement.scrollWidth')
            print(name, 'scrollW', sw, 'of', w, errs)
            await pg.screenshot(path=f'{OUT}/{name}.png')
        # учитель на телефоне: кабинет и конструктор
        pg, errs = await page(390, 844)
        await pg.goto(BASE + '/teacher')
        await pg.fill('#aLogin', 'aigul'); await pg.fill('#aPass', 'qwerty123'); await pg.click('#authForm button[type=submit]')
        await pg.wait_for_selector('#quizzes .qz')
        await pg.screenshot(path=f'{OUT}/teacher-dash-phone.png', full_page=True)
        await pg.click('#quizzes [data-act=edit]')
        await pg.wait_for_selector('.qe')
        await pg.wait_for_timeout(500)
        print('editor phone scrollW', await pg.evaluate('document.documentElement.scrollWidth'), errs)
        await pg.screenshot(path=f'{OUT}/editor-phone.png')
        # проектор: новая игра, 30 «учеников» через API сокета не нужны — смотрим лобби на доске
        r = await pg.request.get(BASE + '/api/quizzes')
        qid = (await r.json())[0]['id']
        r = await pg.request.post(BASE + '/api/games', data={'quizId': qid})
        code = (await r.json())['code']
        print('projector room', code)
        bd, errs2 = await page(1920, 1080)
        await bd.context.add_cookies(await pg.context.cookies())
        await bd.goto(f'{BASE}/teacher/game/{code}')
        await bd.wait_for_selector('.bigcode')
        await bd.click('#proj')
        await bd.wait_for_timeout(600)
        await bd.screenshot(path=f'{OUT}/board-lobby-projector.png')
        print('board errs', errs2)
        with open('/tmp/proj_code', 'w') as f: f.write(code)
        await b.close()

asyncio.run(main())
