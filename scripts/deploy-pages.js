// Выкладка веб-сборки на GitHub Pages (ветка gh-pages) — основной хостинг
// markeltoys.ru с 04.10.2026. Cloudflare Worker российские провайдеры режут
// (бандл обрывается на ~25 КБ из 1,8 МБ), GitHub Pages и Render — нет
// (проверено без VPN 02.10, см. HANDOFF).
//
// Запуск: npm run deploy (сначала собирает dist/, потом вызывает этот скрипт).
//
// Ветка gh-pages — только артефакт сборки: каждый раз один коммит без истории
// и force-push, иначе каждая выкладка (~2 МБ) навсегда оседала бы в публичном
// репозитории. В тексте коммита — хэш исходников, из которых собрано.
// Откат — checkout нужного коммита main и снова npm run deploy.

const { execSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const DOMAIN = 'markeltoys.ru'
const BRANCH = 'gh-pages'
const ROOT = path.resolve(__dirname, '..')
const DIST = path.join(ROOT, 'dist')

const run = (cmd, cwd = ROOT) => execSync(cmd, { cwd, stdio: 'pipe', encoding: 'utf8' }).trim()

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error('Нет dist/index.html — сначала npm run build (или запускать через npm run deploy).')
  process.exit(1)
}

// Адрес API вшивается в бандл при сборке. Относительный '/api' на Pages
// не работает — Pages не умеет пересылать запросы на бэкенд.
const bundles = fs.readdirSync(path.join(DIST, '_expo', 'static', 'js', 'web'))
  .filter((f) => f.endsWith('.js'))
  .map((f) => fs.readFileSync(path.join(DIST, '_expo', 'static', 'js', 'web', f), 'utf8'))
if (!bundles.some((b) => b.includes('collectors-realm-backend.onrender.com/api'))) {
  console.error('В сборке нет адреса Render API — похоже, задан EXPO_PUBLIC_API_URL. Пересобрать без него.')
  process.exit(1)
}

const sha = run('git rev-parse --short HEAD')
const dirty = run('git status --porcelain') !== ''
const remote = run('git remote get-url origin')
if (dirty) console.warn('⚠️  Есть незакоммиченные изменения — на прод уйдёт то, чего нет в git.')

// SPA на Pages: на неизвестный путь (прямая ссылка, F5 не на главной) Pages
// отдаёт 404.html — кладём туда то же приложение. Код ответа при этом 404,
// но страница открывается. .nojekyll — иначе Jekyll выкинет папку _expo
// (имена с подчёркиванием). CNAME — свой домен для Pages.
fs.copyFileSync(path.join(DIST, 'index.html'), path.join(DIST, '404.html'))
fs.writeFileSync(path.join(DIST, '.nojekyll'), '')
fs.writeFileSync(path.join(DIST, 'CNAME'), DOMAIN + '\n')

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'markeltoys-pages-'))
try {
  fs.cpSync(DIST, tmp, { recursive: true })
  run(`git init -q -b ${BRANCH}`, tmp)
  run('git add -A', tmp)
  run(`git commit -q -m "deploy: ${DOMAIN} из ${sha}${dirty ? ' (+незакоммиченное)' : ''}"`, tmp)
  console.log(`Отправляю сборку из ${sha} в ${BRANCH}…`)
  run(`git push -f "${remote}" HEAD:${BRANCH}`, tmp)
} finally {
  fs.rmSync(tmp, { recursive: true, force: true })
}

console.log(`Готово. GitHub Pages обновит https://${DOMAIN} за 1–2 минуты.`)
