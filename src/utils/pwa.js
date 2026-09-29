// Установка приложения на телефон (PWA) и проверка обновлений — только веб.
// На нативе все функции безопасно ничего не делают.
import { Platform } from 'react-native'
import { track } from './analytics'

const isWeb = Platform.OS === 'web' && typeof window !== 'undefined'

// ── Установка ──────────────────────────────────────────────────────────────
// Chrome/Android присылает beforeinstallprompt один раз и рано — часто ещё до
// того, как React смонтирует компоненты. Поэтому слушатель вешается прямо при
// импорте модуля (App.js импортирует его одним из первых), а событие
// сохраняется до нажатия кнопки «Установить».
let deferredPrompt = null
const listeners = new Set()
const notify = () => listeners.forEach(fn => fn())

if (isWeb) {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault() // свой UI вместо мини-баннера браузера
    deferredPrompt = e
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    track('app_installed', { kind: getDeviceKind() })
    notify()
  })
}

export function subscribeInstall(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// Уже запущено как установленное приложение (с иконки на экране)
export function isStandalone() {
  if (!isWeb) return false
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
}

// 'ios-safari'     — можно добавить на экран «Домой» вручную через «Поделиться»
// 'ios-other'      — Telegram/Chrome/другой браузер на iOS: сначала открыть в Safari
// 'android'        — обычный браузер Android (Chrome умеет системный запрос)
// 'android-inapp'  — встроенный браузер приложения (Telegram, VK, Instagram,
//                    WebView): установить оттуда нельзя, нужно открыть в Chrome
// 'desktop'
export function getDeviceKind() {
  if (!isWeb) return 'native'
  const ua = navigator.userAgent || ''
  // iPadOS 13+ представляется как Mac — отличаем по тач-экрану
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  if (isIOS) {
    // Во встроенных браузерах (Telegram, Instagram, VK...) и Chrome/Firefox на
    // iOS нет «На экран Домой» в привычном месте — надёжнее отправить в Safari
    const isSafari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser|Telegram|Instagram|FBAN|FBAV|VKClient|Line\//i.test(ua)
    return isSafari ? 'ios-safari' : 'ios-other'
  }
  if (/Android/i.test(ua)) {
    return /Telegram|Instagram|VKClient|FBAN|FBAV|Line\/|; wv\)/i.test(ua) ? 'android-inapp' : 'android'
  }
  return 'desktop'
}

export function canPromptInstall() {
  return !!deferredPrompt
}

// Показывать ли кнопку «Установить приложение» (в профиле). На десктопе —
// только если браузер реально умеет ставить; на телефоне — всегда (хотя бы
// инструкцией), пока не запущено как установленное.
export function canOfferInstall() {
  if (!isWeb || isStandalone()) return false
  return getDeviceKind() === 'desktop' ? canPromptInstall() : true
}

// Предлагать ли установку самим (всплывающим окном). Обычный Chrome на
// Android без системного запроса — скорее всего приложение уже стоит
// (Chrome тогда запрос не присылает), не надоедаем инструкцией.
export function shouldAutoOffer() {
  if (!isWeb || isStandalone()) return false
  const kind = getDeviceKind()
  if (kind === 'android') return canPromptInstall()
  return kind === 'ios-safari' || kind === 'ios-other' || kind === 'android-inapp'
}

// Системный запрос установки (Chrome/Android/десктоп). Возвращает
// 'accepted' | 'dismissed' | 'unavailable'
export async function promptInstall() {
  if (!deferredPrompt) return 'unavailable'
  const e = deferredPrompt
  deferredPrompt = null // событие одноразовое
  notify()
  try {
    await e.prompt()
    const { outcome } = await e.userChoice
    return outcome
  } catch {
    return 'unavailable'
  }
}

// ── Обновления ─────────────────────────────────────────────────────────────
// Сборка Expo кладёт весь код в /_expo/static/js/web/index-<хеш>.js, и хеш
// меняется при каждом изменении кода. Сравниваем файл, с которым запущена
// текущая страница, с тем, на который ссылается свежий index.html на сервере.
// Service worker не используем — нечему «застревать» в кэше, а index.html
// Cloudflare отдаёт с max-age=0, так что обычная перезагрузка сразу берёт
// новую версию.
const BUNDLE_RE = /\/_expo\/static\/js\/web\/[^"'\s?]+\.js/

function currentBundle() {
  if (!isWeb) return null
  for (const s of document.scripts) {
    const m = s.src && s.src.match(BUNDLE_RE)
    if (m) return m[0]
  }
  return null // dev-режим (expo start) — проверка не нужна
}

async function latestBundle() {
  const res = await fetch(`/?v=${Date.now()}`, { cache: 'no-store' })
  if (!res.ok) return null
  const m = (await res.text()).match(BUNDLE_RE)
  return m ? m[0] : null
}

const CHECK_EVERY_MS = 30 * 60 * 1000
const MIN_GAP_MS = 5 * 60 * 1000

// Проверяет обновление при запуске, раз в 30 минут и при возврате в
// приложение (установленное приложение обычно не перезапускается, а
// «просыпается» из фона). Если на окно ответили «Позже» — про ту же версию
// напомним не раньше чем через час.
const REMIND_AFTER_MS = 60 * 60 * 1000

export function startUpdateChecker(onUpdate) {
  const running = currentBundle()
  if (!running) return () => {}
  let lastCheck = 0
  let reported = null
  let reportedAt = 0

  async function check() {
    const now = Date.now()
    if (now - lastCheck < MIN_GAP_MS) return
    lastCheck = now
    try {
      const latest = await latestBundle()
      if (latest && latest !== running && (latest !== reported || now - reportedAt > REMIND_AFTER_MS)) {
        reported = latest
        reportedAt = now
        onUpdate()
      }
    } catch {
      // нет сети / сервер недоступен — попробуем в следующий раз
    }
  }

  const onVisible = () => { if (document.visibilityState === 'visible') check() }
  const first = setTimeout(check, 15 * 1000)
  const timer = setInterval(check, CHECK_EVERY_MS)
  document.addEventListener('visibilitychange', onVisible)
  return () => {
    clearTimeout(first)
    clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisible)
  }
}

export function reloadApp() {
  if (isWeb) window.location.reload()
}
