"""Обрыв связи у ученика, перезапуск сервера посреди игры, загрузка рисунка."""
import asyncio, re, os, subprocess, time, base64, struct, zlib
from playwright.async_api import async_playwright, expect

BASE = 'http://localhost:4100'
ENV = dict(os.environ, PORT='4100', SQLITE_FILE='/tmp/e2e.db')

def restart():
    subprocess.run(['pkill', '-TERM', '-f', 'node server/index.js'])
    time.sleep(1.2)
    subprocess.Popen(['node', 'server/index.js'], cwd='/home/claude/platform', env=ENV,
                     stdout=open('/tmp/server.log', 'a'), stderr=subprocess.STDOUT)
    time.sleep(1.5)

def png(w=40, h=30):
    raw = b''.join(b'\x00' + bytes([255, 120, 160] * w) for _ in range(h))
    def ch(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + ch(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + ch(b'IDAT', zlib.compress(raw)) + ch(b'IEND', b'')

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        tc = await b.new_context(); T = await tc.new_page()
        await T.goto(BASE + '/teacher')
        await T.fill('#aLogin', 'aigul'); await T.fill('#aPass', 'qwerty123'); await T.click('#authForm button[type=submit]')
        await T.wait_for_selector('#quizzes .qz')

        # рисунок
        r = await T.request.post(BASE + '/api/images', data=png(), headers={'Content-Type': 'image/png'})
        img = (await r.json())['id']
        g = await T.request.get(f'{BASE}/img/{img}')
        print('image upload', r.status, g.status, g.headers['content-type'])
        bad = await T.request.post(BASE + '/api/images', data=b'<svg onload=alert(1)>', headers={'Content-Type': 'image/png'})
        print('fake image rejected', bad.status)
        qz = await T.request.post(BASE + '/api/quizzes', data={'title': 'Сызба', 'questions': [
            {'type': 'input', 'answerKind': 'number', 'text': 'Суреттегі бұрыш неше градус? $\\angle ABC$', 'image': img, 'answers': ['90'], 'points': 100},
            {'type': 'input', 'answerKind': 'number', 'text': '$3^2$', 'answers': ['9'], 'points': 100},
            {'type': 'input', 'answerKind': 'number', 'text': '$\\sqrt{16}$', 'answers': ['4'], 'points': 100}]})
        qid = (await qz.json())['id']
        code = (await (await T.request.post(BASE + '/api/games', data={'quizId': qid})).json())['code']
        await T.goto(f'{BASE}/teacher/game/{code}')

        sc = await b.new_context(viewport={'width': 390, 'height': 844}); S = await sc.new_page()
        await S.goto(f'{BASE}/join/{code}')
        await S.fill('#joinName', 'Нұрлан'); await S.click('#joinBtn')
        await expect(S.locator('#greet')).to_be_visible()
        await expect(T.locator('#start')).to_be_enabled()
        await T.click('#start')
        await expect(S.locator('#qcard img.qimg')).to_be_visible()
        print('picture shown to student')
        await S.fill('#ans', '90'); await S.click('#ansForm button[type=submit]')
        await expect(S.locator('#qnum')).to_have_text('Тапсырма 2 / 3')

        # кратковременная потеря интернета
        await sc.set_offline(True)
        await S.wait_for_timeout(3000)
        await expect(S.locator('#reconn')).to_be_visible()
        await sc.set_offline(False)
        await expect(S.locator('#reconn')).to_have_count(0, timeout=15000)
        await S.fill('#ans', '9'); await S.click('#ansForm button[type=submit]')
        await expect(S.locator('#qnum')).to_have_text('Тапсырма 3 / 3')
        print('offline → online: progress kept, answering works')

        # перезапуск сервера посреди игры
        restart()
        await expect(S.locator('#qnum')).to_have_text('Тапсырма 3 / 3', timeout=15000)
        await S.reload()
        await expect(S.locator('#qnum')).to_have_text('Тапсырма 3 / 3', timeout=15000)
        await S.fill('#ans', '4'); await S.click('#ansForm button[type=submit]')
        await expect(S.locator('.h2')).to_have_text('Мәреге жеттің!')
        print('server restart: game and progress restored')
        await expect(T.locator('.podium')).to_be_visible(timeout=15000)
        print('host reconnected and saw auto results')
        await b.close()

asyncio.run(main())
