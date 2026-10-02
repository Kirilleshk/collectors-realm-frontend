import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { API_URL } from '../config'

const API = `${API_URL}/analytics`
const ANON_KEY = 'analytics_anon_id'
const SOURCE_KEY = 'analytics_source'

let _userId = null
let _token = null
let _ctx = null

// Вызывается из AuthContext СИНХРОННО в момент входа/регистрации/выхода.
// Раньше выставлялось в useEffect в App.js — он срабатывает уже после
// track('login')/track('register'), поэтому эти события писались без
// пользователя (или на предыдущий аккаунт), а после выхода все действия
// продолжали приписываться вышедшему.
// Токен нужен серверу, чтобы определить пользователя (userId из тела запроса
// он больше не принимает на веру — его мог подставить кто угодно).
export function setAnalyticsUser(id, token) {
  _userId = id || null
  _token = (id && token) || null
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

// Отметка «первый заход был без метки» — чтобы более поздний переход по
// ссылке (из Telegram, поиска) не переписал источник задним числом
const DIRECT = '-'

// id устройства и источник первого захода — один раз за запуск, дальше из кэша.
// Источник фиксируется навсегда при ПЕРВОМ заходе устройства ("первое
// касание"), включая «прямой заход», — чтобы регистрация через пару дней
// всё равно засчиталась тому каналу, откуда человек пришёл впервые.
function getContext() {
  if (!_ctx) {
    _ctx = (async () => {
      let anonId = null
      let source = null
      try {
        anonId = await AsyncStorage.getItem(ANON_KEY)
        const isNewDevice = !anonId
        if (isNewDevice) {
          anonId = randomId()
          await AsyncStorage.setItem(ANON_KEY, anonId)
        }
        source = await AsyncStorage.getItem(SOURCE_KEY)
        if (!source) {
          // Устройство уже заходило раньше без метки — значит, первым был
          // прямой заход, даже если сейчас пришло по ссылке
          source = (isNewDevice && detectSource()) || DIRECT
          await AsyncStorage.setItem(SOURCE_KEY, source)
        }
      } catch {}
      return { anonId, source: source === DIRECT ? null : source }
    })()
  }
  return _ctx
}

export async function track(event, params = {}) {
  // Пользователя фиксируем в момент вызова, до await: иначе событие,
  // вызванное прямо перед выходом из аккаунта, ушло бы уже без него
  const userId = _userId
  const token = _token
  try {
    const { anonId, source } = await getContext()
    await fetch(API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        event,
        params,
        platform: Platform.OS,
        // TODO: убрать после 01.10.2026 — сервер с 29.09 берёт пользователя
        // только из токена; поле оставлено как мост, пока на Render могла
        // крутиться старая версия бэкенда, читавшая userId из тела
        userId,
        anonId,
        source,
      }),
    })
  } catch {
    // аналитика не должна ломать приложение
  }
}
