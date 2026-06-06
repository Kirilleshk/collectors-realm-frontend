// @ts-nocheck
// =========================================================
// ФАЙЛ ДЛЯ БЭКЕНДА: src/routes/news.routes.ts
// Скопировать в репозиторий бэкенда на GitHub.
// В основном файле (app.ts / index.ts) добавить:
//   import newsRouter from './routes/news.routes'
//   app.use('/api/news', newsRouter)
// =========================================================

import { Router, Request, Response } from 'express'
import axios from 'axios'

const router = Router()

interface NewsItem {
  id: string
  source: 'telegram'
  text: string
  imageUrl?: string
  date: string
  url: string
}

// Кэш только для первой страницы (без before)
let _cache: { data: NewsItem[]; ts: number } = { data: [], ts: 0 }
const CACHE_MS = 15 * 60 * 1000 // 15 минут

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
}

function stripHtml(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<a[^>]*>([^<]*)<\/a>/gi, '$1')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  )
}

async function fetchTelegramPosts(channel: string, limit = 20, before?: number): Promise<NewsItem[]> {
  const url = before
    ? `https://t.me/s/${channel}?before=${before}`
    : `https://t.me/s/${channel}`

  const res = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
    },
    timeout: 15000,
  })

  const html: string = res.data
  const items: NewsItem[] = []

  // Парсим блоки постов по data-post
  const postRegex = /data-post="([^"]+)"[\s\S]*?(?=data-post="|<\/section|$)/g
  let match

  while ((match = postRegex.exec(html)) !== null && items.length < limit) {
    const postId = match[1] // "markeltoys/123"
    const block = match[0]

    const textMatch = block.match(/class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/)
    const text = textMatch ? stripHtml(textMatch[1]) : ''

    const imgMatch = block.match(/background-image:url\('([^']+)'\)/)
    const imageUrl = imgMatch ? imgMatch[1] : undefined

    const dateMatch = block.match(/datetime="([^"]+)"/)
    const date = dateMatch ? dateMatch[1] : new Date().toISOString()

    if (text.length > 5 || imageUrl) {
      items.push({
        id: `tg_${postId.replace('/', '_')}`,
        source: 'telegram',
        text,
        imageUrl,
        date,
        url: `https://t.me/${postId}`,
      })
    }
  }

  // Telegram отдаёт посты от старых к новым — разворачиваем
  return items.reverse()
}

router.get('/', async (req: Request, res: Response) => {
  const before = req.query.before ? parseInt(req.query.before as string) : undefined

  // Кэш только для первой страницы
  if (!before && Date.now() - _cache.ts < CACHE_MS && _cache.data.length > 0) {
    return res.json({ items: _cache.data, hasMore: true })
  }

  try {
    const items = await fetchTelegramPosts('markeltoys', 20, before)

    if (!before) {
      _cache = { data: items, ts: Date.now() }
    }

    return res.json({ items, hasMore: items.length >= 20 })
  } catch (e: any) {
    console.error('[news] Telegram fetch error:', e.message)
    // При ошибке — отдаём кэш если есть
    if (_cache.data.length > 0) {
      return res.json({ items: _cache.data, hasMore: true })
    }
    return res.json({ items: [], hasMore: false })
  }
})

export default router
