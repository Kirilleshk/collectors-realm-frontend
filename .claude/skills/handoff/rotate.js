// Ротация HANDOFF.md: записи старше 3 дней (сегодня + 2 предыдущих) уезжают
// в docs/handoff-archive/ГГГГ-ММ.md. Рабочий файл — новые сверху, архив — по
// возрастанию. Запуск: node .claude/skills/handoff/rotate.js
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..', '..', '..')
const HOT = path.join(ROOT, 'HANDOFF.md')
const ARCH = path.join(ROOT, 'docs', 'handoff-archive')
const KEEP_DAYS = 3
const SECTION = '## Сессии'
const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август',
                'сентябрь', 'октябрь', 'ноябрь', 'декабрь']

const pad = n => String(n).padStart(2, '0')
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
// Ключ: дата | время (у новых записей) | номер (N) (у старых). sort в Node
// устойчивый — при равных ключах сохраняется исходный порядок.
const byKey = (a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)
const join = (head, entries) => [head, ...entries.map(e => e.text)].join('\n\n') + '\n'

// Файл → { head: текст до первой записи, entries: [{ date, key, text }] }
function parse(text, fromMarker) {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  let start = 0
  if (fromMarker) {
    start = lines.findIndex(l => l.startsWith(fromMarker))
    if (start < 0) throw new Error(`В HANDOFF.md нет раздела «${fromMarker}»`)
    start++
  }
  const first = lines.findIndex((l, i) => i >= start && l.startsWith('### '))
  const head = lines.slice(0, first < 0 ? lines.length : first).join('\n').trimEnd()
  const raw = []
  if (first >= 0) {
    for (const line of lines.slice(first)) {
      if (line.startsWith('### ')) raw.push([line])
      else raw[raw.length - 1].push(line)
    }
  }
  const entries = raw.map(ls => {
    while (ls.length > 1 && !ls[ls.length - 1].trim()) ls.pop()
    const h = ls[0]
    const date = (h.match(/^### (\d{4}-\d{2}-\d{2})/) || [])[1]
    if (!date) throw new Error(`Заголовок без даты ГГГГ-ММ-ДД: ${h}`)
    const time = (h.match(/^### \S+ (\d{2}:\d{2})/) || [])[1] || ''
    const n = (h.match(/^### \S+ \((\d+)\)/) || [])[1] || '1'
    // Сортировка и ротация — по КОНЦУ сессии: многодневная сессия, идущая
    // до сих пор, должна быть сверху и не уезжать в архив по дате начала.
    // «ГГГГ-ММ-ДД ЧЧ:ММ – ГГГГ-ММ-ДД ЧЧ:ММ» или «ГГГГ-ММ-ДД ЧЧ:ММ–ЧЧ:ММ»
    const multi = h.match(/^### \S+ \d{2}:\d{2}\s*[–-]\s*(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})/)
    const same = h.match(/^### \S+ \d{2}:\d{2}[–-](\d{2}:\d{2})/)
    const endDate = multi ? multi[1] : date
    const endTime = multi ? multi[2] : same ? same[1] : time
    return { date, endDate, key: `${endDate}|${endTime}|${n.padStart(3, '0')}`, text: ls.join('\n') }
  })
  return { head, entries }
}

const hot = parse(fs.readFileSync(HOT, 'utf8'), SECTION)
const cutoff = new Date()
cutoff.setDate(cutoff.getDate() - (KEEP_DAYS - 1))
const cutoffStr = ymd(cutoff)

const keep = hot.entries.filter(e => e.endDate >= cutoffStr)
const move = hot.entries.filter(e => e.endDate < cutoffStr)

const byMonth = {}
move.forEach(e => { (byMonth[e.date.slice(0, 7)] ||= []).push(e) })
fs.mkdirSync(ARCH, { recursive: true })
for (const [ym, list] of Object.entries(byMonth)) {
  const file = path.join(ARCH, `${ym}.md`)
  const [y, m] = ym.split('-')
  const arch = fs.existsSync(file)
    ? parse(fs.readFileSync(file, 'utf8'))
    : { head: `# HANDOFF — архив, ${MONTHS[+m - 1]} ${y}\n\nЗаписи сессий старше 3 дней, по возрастанию даты. Свежие — в [HANDOFF.md](../../HANDOFF.md).`, entries: [] }
  // list идёт «новые сверху» — разворачиваем, чтобы при равных ключах порядок был хронологическим
  const all = [...arch.entries, ...list.reverse()].sort(byKey)
  fs.writeFileSync(file, join(arch.head, all))
}

keep.sort((a, b) => byKey(b, a))
fs.writeFileSync(HOT, join(hot.head, keep))

console.log(`Рабочий файл: ${keep.length} записей (с ${cutoffStr}). В архив перенесено: ${move.length}` +
  (move.length ? ` → ${Object.keys(byMonth).map(m => m + '.md').join(', ')}` : ''))
