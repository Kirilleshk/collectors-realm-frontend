import React, { useEffect, useState } from 'react'
import { View, Text, Modal, Pressable, StyleSheet, Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { colors } from '../theme'
import { track } from './analytics'
import {
  getDeviceKind, canPromptInstall, promptInstall, subscribeInstall, shouldAutoOffer,
} from './pwa'

const APP_URL = 'https://markeltoys.ru'
const DISMISSED_KEY = 'pwa_install_dismissed_at'
const DONE_KEY = 'pwa_install_done'
const REMIND_AFTER_MS = 7 * 24 * 60 * 60 * 1000

// Перерисовка при появлении/исчезновении системного запроса установки
function useInstallAvailability() {
  const [, force] = useState(0)
  useEffect(() => subscribeInstall(() => force(x => x + 1)), [])
  return canPromptInstall()
}

function Steps({ items }) {
  return (
    <View style={s.steps}>
      {items.map((t, i) => (
        <View key={i} style={s.stepRow}>
          <Text style={s.stepNum}>{i + 1}</Text>
          <Text style={s.stepText}>{t}</Text>
        </View>
      ))}
    </View>
  )
}

// Окно «Установить приложение». from — откуда открыли ('auto' | 'profile'),
// для статистики. onClose(reason): 'later' | 'done' | 'installed'
export default function InstallAppModal({ visible, onClose, from = 'profile' }) {
  const canPrompt = useInstallAvailability()
  const [copied, setCopied] = useState(false)
  const kind = getDeviceKind()

  useEffect(() => {
    if (visible) track('install_offer_shown', { kind, from, prompt: canPrompt })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  if (!visible) return null

  async function handleInstall() {
    const outcome = await promptInstall()
    track('install_click', { kind, from, outcome })
    // Запрос одноразовый: после отказа окно закрываем, а не показываем
    // инструкцию «откройте в Chrome» человеку, который уже в Chrome
    onClose(outcome === 'accepted' ? 'installed' : 'later')
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(APP_URL)
      setCopied(true)
    } catch {}
  }

  let body
  if (canPrompt) {
    body = (
      <Pressable style={({ pressed }) => [s.btn, pressed && { opacity: 0.8 }]} onPress={handleInstall}>
        <Text style={s.btnText}>📲 Установить</Text>
      </Pressable>
    )
  } else if (kind === 'ios-safari') {
    body = (
      <>
        <Steps items={[
          'Нажмите кнопку «Поделиться» внизу экрана — квадрат со стрелкой вверх ⬆️',
          'Прокрутите список и выберите «На экран „Домой“» ➕',
          'Нажмите «Добавить» в правом верхнем углу',
        ]} />
        <Text style={s.note}>
          После установки откройте Markeltoys с иконки и один раз войдите в аккаунт заново — у установленного приложения на iPhone отдельный вход.
        </Text>
      </>
    )
  } else if (kind === 'ios-other') {
    body = (
      <>
        <Text style={s.desc}>На iPhone установить приложение можно только через Safari.</Text>
        <Steps items={[
          'Нажмите ⋯ или «Поделиться» и выберите «Открыть в Safari». Если такого пункта нет — скопируйте ссылку кнопкой ниже и вставьте её в Safari',
          'В Safari нажмите «Поделиться» ⬆️ → «На экран „Домой“» ➕ → «Добавить»',
        ]} />
        <Pressable style={({ pressed }) => [s.btnOutline, pressed && { opacity: 0.7 }]} onPress={copyLink}>
          <Text style={s.btnOutlineText}>{copied ? '✅ Ссылка скопирована' : '📋 Скопировать ссылку'}</Text>
        </Pressable>
      </>
    )
  } else {
    // Android: встроенный браузер (Telegram/VK...) или браузер без системного запроса
    body = (
      <>
        <Steps items={[
          kind === 'android-inapp'
            ? 'Нажмите ⋮ в правом верхнем углу и выберите «Открыть в браузере» (или скопируйте ссылку кнопкой ниже и откройте в Chrome)'
            : 'Откройте markeltoys.ru в браузере Chrome',
          'В Chrome нажмите ⋮ в правом верхнем углу',
          'Выберите «Установить приложение» или «Добавить на главный экран»',
        ]} />
        <Pressable style={({ pressed }) => [s.btnOutline, pressed && { opacity: 0.7 }]} onPress={copyLink}>
          <Text style={s.btnOutlineText}>{copied ? '✅ Ссылка скопирована' : '📋 Скопировать ссылку'}</Text>
        </Pressable>
      </>
    )
  }

  const manual = !canPrompt
  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => onClose('later')}>
      <View style={s.overlay}>
        <View style={s.card}>
          <Text style={s.icon}>📲</Text>
          <Text style={s.title}>Установите Markeltoys</Text>
          <Text style={s.desc}>
            Приложение появится на экране телефона и будет открываться с иконки на весь экран — без поиска ссылки и без браузера.
          </Text>
          {body}
          {manual && (
            <Pressable style={({ pressed }) => [s.linkBtn, pressed && { opacity: 0.6 }]} onPress={() => onClose('done')}>
              <Text style={s.linkBtnText}>Уже установлено</Text>
            </Pressable>
          )}
          <Pressable style={({ pressed }) => [s.linkBtn, pressed && { opacity: 0.6 }]} onPress={() => onClose('later')}>
            <Text style={s.linkBtnText}>Не сейчас</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

// Само предлагает установку один раз после онбординга и потом не чаще раза в
// неделю («Не сейчас»); «Уже установлено» / успешная установка — больше
// никогда. enabled — когда другие окна (тур, геолокация) уже не мешают.
export function InstallAppPrompt({ enabled }) {
  const [visible, setVisible] = useState(false)
  const canPrompt = useInstallAvailability()

  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled || visible || !shouldAutoOffer()) return
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        if (await AsyncStorage.getItem(DONE_KEY)) return
        const dismissedAt = Number(await AsyncStorage.getItem(DISMISSED_KEY) || 0)
        if (Date.now() - dismissedAt < REMIND_AFTER_MS) return
        if (!cancelled) setVisible(true)
      } catch {}
    }, 4000)
    return () => { cancelled = true; clearTimeout(timer) }
    // canPrompt — чтобы на Android показать, как только Chrome пришлёт запрос
  }, [enabled, canPrompt])

  function handleClose(reason) {
    setVisible(false)
    const key = reason === 'later' ? DISMISSED_KEY : DONE_KEY
    AsyncStorage.setItem(key, reason === 'later' ? String(Date.now()) : '1').catch(() => {})
  }

  return <InstallAppModal visible={visible} onClose={handleClose} from="auto" />
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { backgroundColor: colors.surface, borderRadius: 20, padding: 24, width: '100%', maxWidth: 380, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  icon: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '900', color: colors.text, marginBottom: 8, textAlign: 'center' },
  desc: { fontSize: 14, color: colors.text2, textAlign: 'center', marginBottom: 16, lineHeight: 20 },
  note: { fontSize: 12, color: colors.text2, textAlign: 'center', marginTop: 4, marginBottom: 8, lineHeight: 17 },
  steps: { width: '100%', gap: 10, marginBottom: 12 },
  stepRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  stepNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.accent, color: '#fff', fontWeight: '800', textAlign: 'center', lineHeight: 24, fontSize: 13, overflow: 'hidden' },
  stepText: { flex: 1, color: colors.text, fontSize: 14, lineHeight: 20 },
  btn: { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32, alignItems: 'center', width: '100%' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnOutline: { borderRadius: 12, borderWidth: 1, borderColor: colors.accent, paddingVertical: 12, alignItems: 'center', width: '100%', marginBottom: 4 },
  btnOutlineText: { color: colors.accent, fontSize: 14, fontWeight: '700' },
  linkBtn: { marginTop: 10, paddingVertical: 6 },
  linkBtnText: { color: colors.text2, fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },
})
