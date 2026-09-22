import React, { useEffect, useState } from 'react'
import { View, Text, Image, Modal, Pressable, StyleSheet, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../theme'
import { useAuth } from '../AuthContext'
import { users as usersApi } from '../api'

const ARROW_HALF = 12

// Шаги тура — каждый указывает на вкладку нижнего меню, которую нужно
// подсветить (стрелка снизу + не затемнённый таб-бар на этой вкладке)
const ALL_STEPS = [
  { tab: 'Магазин', icon: '🛍', title: 'Магазин', desc: 'Здесь — товары других коллекционеров: фигурки, аксессуары, диорамы. Используйте поиск и фильтры по статусу и состоянию.' },
  { tab: 'Карта', icon: '🗺', title: 'Карта коллекционеров', desc: 'Коллекционеры, мастера по ремонту, кастомизаторы и мастера диорам рядом с вами. Нажмите на маркер — откроется профиль.' },
  { tab: 'Моё', icon: '🗿', title: 'Коллекция и вишлист', desc: 'Каталог ваших фигурок и список того, что хотите найти. Указывайте приоритет, производителя и год выпуска.' },
  { tab: 'Профиль', icon: '👤', title: 'Профиль', desc: 'Город, роли, фото портфолио, связь с администрацией и раздел «Помощь» со всеми функциями приложения.' },
]
// Шаг про «Игра» убран из тура 22.09.2026 — раздел приостановлен (решение
// Марка 20.09.2026) и теперь встречает заглушкой "в разработке" вместо
// самого экрана, так что вести туда новых пользователей туром не нужно.
// Сам таб остаётся в TABS ниже — он всё ещё виден в панели, просто ведёт
// на заглушку, и должен учитываться в расчёте ширины/позиции стрелки.

// navigationRef — общий ref из App.js, showGame/isAdmin — те же флаги,
// что определяют состав вкладок в MainTabs (нужны для подсветки нужной)
export default function OnboardingTour({ navigationRef, showGame, isAdmin, onFinish }) {
  const STEPS = ALL_STEPS
  const TABS = ['Магазин', 'Карта', 'Моё', ...(showGame ? ['Игра'] : []), ...(isAdmin ? ['Админ'] : []), 'Профиль']

  const insets = useSafeAreaInsets()
  const { width, height } = useWindowDimensions()
  const { user, updateUser } = useAuth()
  const [step, setStep] = useState(null)

  // Флаг «тур пройден» хранится на сервере в User.onboardingSeen — привязан
  // к аккаунту, а не к localStorage браузера/телефона, иначе при заходе
  // с нового устройства/браузера тур показывался бы заново
  useEffect(() => {
    if (user?.onboardingSeen) { onFinish?.(); setStep(-1); return }
    navigationRef.current?.navigate(STEPS[0].tab)
    setStep(0)
  }, [])

  if (step === null || step < 0) return null

  function finish() {
    usersApi.update({ onboardingSeen: true }).catch(() => {})
    updateUser({ onboardingSeen: true })
    onFinish?.()
    setStep(-1)
  }

  function goNext() {
    if (step >= STEPS.length - 1) { finish(); return }
    const next = STEPS[step + 1]
    navigationRef.current?.navigate(next.tab)
    setStep(step + 1)
  }

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1
  const tabBarHeight = 60 + insets.bottom
  const tabWidth = width / TABS.length
  const tabIndex = TABS.indexOf(current.tab)
  const arrowLeft = Math.max(8, Math.min(width - 40, tabIndex * tabWidth + tabWidth / 2 - ARROW_HALF))

  return (
    <Modal visible transparent animationType="fade" onRequestClose={finish}>
      <Pressable style={s.fullscreen} onPress={goNext}>
        <View style={[s.dim, { height: height - tabBarHeight }]} />
        <Text style={[s.arrow, { left: arrowLeft, bottom: tabBarHeight - 6 }]}>▼</Text>
        <View style={[s.card, { bottom: tabBarHeight + 26 }]}>
          <View style={s.cardHeader}>
            {current.tab === 'Моё'
              ? <Image source={require('../../assets/logo-mark.png')} style={s.cardLogo} resizeMode="contain" />
              : <Text style={s.cardIcon}>{current.icon}</Text>}
            <Text style={s.cardTitle}>{current.title}</Text>
          </View>
          <Text style={s.cardDesc}>{current.desc}</Text>
          <View style={s.dots}>
            {STEPS.map((_, i) => <View key={i} style={[s.dot, i === step && s.dotActive]} />)}
          </View>
          <View style={s.buttons}>
            {!isLast && (
              <Pressable onPress={e => { e.stopPropagation?.(); finish() }}>
                <Text style={s.skipText}>Пропустить</Text>
              </Pressable>
            )}
            <Pressable style={({ pressed }) => [s.nextBtn, pressed && { opacity: 0.85 }]} onPress={e => { e.stopPropagation?.(); goNext() }}>
              <Text style={s.nextText}>{isLast ? 'Начать!' : 'Далее'}</Text>
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Modal>
  )
}

const s = StyleSheet.create({
  fullscreen: { flex: 1 },
  dim: { width: '100%', backgroundColor: 'rgba(0,0,0,0.78)' },
  arrow: { position: 'absolute', fontSize: 28, fontWeight: '900', color: colors.accent },
  card: { position: 'absolute', left: 16, right: 16, backgroundColor: colors.surface, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: colors.border },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  cardIcon: { fontSize: 28 },
  cardLogo: { width: 28, height: 28 },
  cardTitle: { fontSize: 17, fontWeight: '900', color: colors.text },
  cardDesc: { fontSize: 13, color: colors.text2, lineHeight: 19 },
  dots: { flexDirection: 'row', gap: 6, justifyContent: 'center', marginVertical: 14 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.accent, width: 18 },
  buttons: { flexDirection: 'row', alignItems: 'center' },
  skipText: { color: colors.text2, fontSize: 14, fontWeight: '600', paddingVertical: 10, paddingRight: 4 },
  nextBtn: { backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 24, marginLeft: 'auto' },
  nextText: { color: '#fff', fontWeight: '700', fontSize: 14 },
})
