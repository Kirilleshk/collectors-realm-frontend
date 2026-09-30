// Хук SessionStart: фиксирует время начала сессии для /handoff.
// Время пишется в .claude/sessions/<session_id> (в .gitignore) и печатается
// в stdout — Claude Code добавляет этот вывод в контекст сессии.
// При compact/resume в тот же день время начала НЕ перезаписывается.
const fs = require('fs')
const path = require('path')

const pad = n => String(n).padStart(2, '0')
const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`

let input = ''
process.stdin.on('data', c => { input += c })
process.stdin.on('end', () => {
  let data = {}
  try { data = JSON.parse(input) } catch {}
  const id = data.session_id
  if (!id) return

  const dir = path.join(process.env.CLAUDE_PROJECT_DIR || path.join(__dirname, '..', '..'), '.claude', 'sessions')
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, id)
  const now = fmt(new Date())

  let start = null
  try { start = fs.readFileSync(file, 'utf8').trim() } catch {}
  // Новая сессия или возобновлённая в другой день — считаем начало заново.
  if (!start || data.source === 'startup' || data.source === 'clear' || start.slice(0, 10) !== now.slice(0, 10)) {
    start = now
    fs.writeFileSync(file, start)
  }

  // Уборка: файлы сессий старше 14 дней не нужны.
  const weekAgo = Date.now() - 14 * 24 * 3600 * 1000
  for (const f of fs.readdirSync(dir)) {
    try { if (fs.statSync(path.join(dir, f)).mtimeMs < weekAgo) fs.unlinkSync(path.join(dir, f)) } catch {}
  }

  console.log(`[handoff] Сессия ${id.slice(0, 8)} начата ${start} (время компьютера). Используется командой /handoff.`)
})
