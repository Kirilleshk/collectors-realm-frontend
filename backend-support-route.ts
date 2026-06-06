// @ts-nocheck
// =========================================================
// ФАЙЛ ДЛЯ БЭКЕНДА: src/routes/support.routes.ts
// В app.ts добавить:
//   import supportRouter from './routes/support.routes'
//   app.use('/api/support', supportRouter)
// =========================================================

import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'

const router = Router()
const prisma = new PrismaClient()

function getAuth(req: Request): { userId: string; roles: string[] } | null {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) return null
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any
    return { userId: decoded.userId, roles: decoded.roles || [] }
  } catch { return null }
}

// Пользователь: получить свои сообщения (и помечает ответы админа как прочитанные)
router.get('/', async (req: Request, res: Response) => {
  const auth = getAuth(req)
  if (!auth) return res.status(401).json({ error: 'Unauthorized' })

  const messages = await prisma.supportMessage.findMany({
    where: { userId: auth.userId },
    orderBy: { createdAt: 'asc' },
  })

  await prisma.supportMessage.updateMany({
    where: { userId: auth.userId, fromAdmin: true, readByUser: false },
    data: { readByUser: true },
  })

  return res.json(messages)
})

// Пользователь: количество непрочитанных от админа
router.get('/unread', async (req: Request, res: Response) => {
  const auth = getAuth(req)
  if (!auth) return res.json({ count: 0 })

  const count = await prisma.supportMessage.count({
    where: { userId: auth.userId, fromAdmin: true, readByUser: false },
  })

  return res.json({ count })
})

// Пользователь: отправить сообщение
router.post('/', async (req: Request, res: Response) => {
  const auth = getAuth(req)
  if (!auth) return res.status(401).json({ error: 'Unauthorized' })

  const { text } = req.body
  if (!text?.trim()) return res.status(400).json({ error: 'Текст обязателен' })

  const msg = await prisma.supportMessage.create({
    data: { userId: auth.userId, text: text.trim(), fromAdmin: false },
  })

  return res.json(msg)
})

// Админ: список всех диалогов
router.get('/conversations', async (req: Request, res: Response) => {
  const auth = getAuth(req)
  if (!auth?.roles.includes('ADMIN')) return res.status(403).json({ error: 'Forbidden' })

  const messages = await prisma.supportMessage.findMany({
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  })

  const map: Record<string, any> = {}
  for (const msg of messages) {
    if (!map[msg.userId]) {
      map[msg.userId] = {
        user: msg.user,
        lastMessage: msg.text,
        lastAt: msg.createdAt,
        unread: 0,
      }
    }
    if (!msg.fromAdmin && !msg.readByAdmin) map[msg.userId].unread++
  }

  return res.json(
    Object.values(map).sort((a: any, b: any) =>
      new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime()
    )
  )
})

// Админ: сообщения конкретного пользователя
router.get('/:userId', async (req: Request, res: Response) => {
  const auth = getAuth(req)
  if (!auth?.roles.includes('ADMIN')) return res.status(403).json({ error: 'Forbidden' })

  const messages = await prisma.supportMessage.findMany({
    where: { userId: req.params.userId },
    orderBy: { createdAt: 'asc' },
  })

  await prisma.supportMessage.updateMany({
    where: { userId: req.params.userId, fromAdmin: false, readByAdmin: false },
    data: { readByAdmin: true },
  })

  return res.json(messages)
})

// Админ: ответить пользователю
router.post('/:userId/reply', async (req: Request, res: Response) => {
  const auth = getAuth(req)
  if (!auth?.roles.includes('ADMIN')) return res.status(403).json({ error: 'Forbidden' })

  const { text } = req.body
  if (!text?.trim()) return res.status(400).json({ error: 'Текст обязателен' })

  const msg = await prisma.supportMessage.create({
    data: { userId: req.params.userId, text: text.trim(), fromAdmin: true },
  })

  return res.json(msg)
})

export default router
