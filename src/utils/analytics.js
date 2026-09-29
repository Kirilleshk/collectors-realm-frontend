import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

const API = 'https://collectors-realm-backend.onrender.com/api/analytics'
const ANON_KEY = 'analytics_anon_id'
const SOURCE_KEY = 'analytics_source'

let _userId = null
let _ctx = null

// Вызывается из AuthContext СИНХРОННО в момент входа/регистрации/выхода.
// Раньше выставлялось в useEffect в App.js — он срабатывает уже после
// track('login')/track('register'), поэтому эти события писались без
// пользователя (или на предыдущий аккаунт), а после выхода все действия
// продолжали приписываться вышедшему.
export function setAnalyticsUser(id) {
  _userId = id || null
}

function randomId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
}

// Откуда пришёл посетитель: метка из ссылки (markeltoys.ru/?from=tg или
// utm_source=...) или, если метки нет, домен сайта, с которого перешли
function detectSource() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null
  try {
    const q = new URLSearchParams(window.location.search)
    const tag = q.get('from') || q.get('utm_source')
    if (tag) return tag.trim().toLowerCase().slice(0, 40)
    if (document.referrer) {
      const ref = new URL(document.referrer).hostname.replace(/^www\./, '')
      const own = window.location.hostname.replace(/^www\./, '')
      if (ref && ref !== own) return ref.slice(0, 40)
    }
  } catch {}
  return null
}

// id устройства и источник первого захода — один раз за запуск, дальше из кэша.
// Источник запоминается навсегда при первом заходе с меткой ("первое касание"),
// чтобы регистрация через пару дней всё равно засчиталась нужному каналу.
function getContext() {
  if (!_ctx) {
    _ctx = (async () => {
      let anonId = null
      let source = null
      try {
        anonId = await AsyncStorage.getItem(ANON_KEY)
        if (!anonId) {
          anonId = randomId()
          await AsyncStorage.setItem(ANON_KEY, anonId)
        }
        source = await AsyncStorage.getItem(SOURCE_KEY)
        if (!source) {
          source = detectSource()
          if (source) await AsyncStorage.setItem(SOURCE_KEY, source)
        }
      } catch {}
      return { anonId, source }
    })()
  }
  return _ctx
}

export async function track(event, params = {}) {
  // Пользователя фиксируем в момент вызова, до await: иначе событие,
  // вызванное прямо перед выходом из аккаунта, ушло бы уже без него
  const userId = _userId
  try {
    const { anonId, source } = await getContext()
    await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event,
        params,
        platform: Platform.OS,
        userId,
        anonId,
        source,
      }),
    })
  } catch {
    // аналитика не должна ломать приложение
  }
}
