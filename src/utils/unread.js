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

// Опрос — только пока кто-то подписан (вкладка смонтирована), человек
// вошёл (enabled; у гостя сообщений нет — 401) и приложение на экране
export function useUnreadCount(enabled = true) {
  const [n, setN] = useState(count)
  useEffect(() => {
    if (!enabled) { set(0); return }
    listeners.add(setN)
    refreshUnread()
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') refreshUnread()
    }, POLL_MS)
    const sub = AppState.addEventListener('change', st => { if (st === 'active') refreshUnread() })
    return () => { listeners.delete(setN); clearInterval(timer); sub.remove() }
  }, [enabled])
  return enabled ? n : 0
}
