import { useEffect, useState } from 'react'
import { AppState } from 'react-native'
import { messages } from '../api'

// Счётчик непрочитанных сообщений для вкладки «Сообщения» (20.10.2026).
// Один общий на приложение: вкладка подписывается через useUnreadCount(),
// экраны переписки после чтения/отправки зовут refreshUnread(), чтобы
// счётчик сразу пересчитался, не дожидаясь очередного опроса.

const POLL_MS = 30000

let count = 0
const listeners = new Set()

function set(n) {
  if (n === count) return
  count = n
  listeners.forEach(l => l(n))
}

export async function refreshUnread() {
  try {
    const res = await messages.unreadCount()
    set(res.data?.count || 0)
  } catch (e) {}
}

// Опрос — только пока кто-то подписан (вкладка смонтирована, человек вошёл)
// и приложение на экране
export function useUnreadCount() {
  const [n, setN] = useState(count)
  useEffect(() => {
    listeners.add(setN)
    refreshUnread()
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') refreshUnread()
    }, POLL_MS)
    const sub = AppState.addEventListener('change', st => { if (st === 'active') refreshUnread() })
    return () => { listeners.delete(setN); clearInterval(timer); sub.remove() }
  }, [])
  return n
}
