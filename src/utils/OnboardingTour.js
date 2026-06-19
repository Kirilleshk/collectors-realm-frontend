import React, { useEffect, useState } from 'react'
import { View, Text, Modal, Pressable, StyleSheet, Platform, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../theme'

const STORAGE_KEY = 'onboardingTourSeen'
const ARROW_HALF = 12

async function getSeen() {
  try {
    if (Platform.OS === 'web') return localStorage.getItem(STORAGE_KEY)
    const AsyncStorage = require('@react-native-async-storage/async-storage').default
    return await AsyncStorage.getItem(STORAGE_KEY)
  } catch { return null }
}

async function saveSeen() {
  try {
    if (Platform.OS === 'web') { localStorage.setItem(STORAGE_KEY, '1'); return }
    const AsyncStorage = require('@react-native-async-storage/async-storage').default
    await AsyncStorage.setItem(STORAGE_KEY, '1')
  } catch {}
}

// Шаги тура — каждый указывает на вкладку нижнего меню, которую нужно
// подсветить (стрелка снизу + не затемнённый таб-бар на этой вкладке)
const ALL_STEPS = [
  { tab: 'Магазин', icon: '🛍', title: 'Магазин', desc: 'Здесь — товары других коллекционеров: фигурки, аксессуары, диорамы. Используйте поиск и фильтры по статусу и состоянию.' },
  { tab: 'Карта', icon: '🗺', title: 'Карта коллекционеров', desc: 'Коллекционеры, мастера по ремонту, кастомизаторы и мастера диорам рядом с вами. Нажмите на маркер — откроется профиль.' },
  { tab: 'Моё', icon: '🗿', title: 'Коллекция и вишлист', desc: 'Каталог ваших фигурок и список того, что хотите найти. Указывайте приоритет, производителя и год выпуска.' },
  { tab: 'Профиль', icon: '👤', title: 'Профиль', desc: 'Город, роли, фото портфолио, связь с администрацией и раздел «Помощь» со всеми функциями приложения.' },
  { tab: 'Игра', icon: '🎮', title: 'Карточная игра', desc: 'Нажмите «🎁 Получить стартовый набор», чтобы получить 10 карт, а затем «⚔️ Бой с боссом» — карты выходят на стол и бьются друг с другом, цель — снять все жизни босса.' },
]

// navigationRef — общий ref из App.js, showGame/isAdmin — те же флаги,
// что определяют состав вкладок в MainTabs (нужны для подсветки нужной)
export default function OnboardingTour({ navigationRef, showGame, isAdmin, onFinish }) {
  const STEPS = showGame ? ALL_STEPS : ALL_STEPS.filter(st => st.tab !== 'Игра')
  const TABS = ['Магазин', 'Карта', 'Моё', ...(showGame ? ['Игра'] : []), ...(isAdmin ? ['Админ'] : []), 'Профиль']

  const insets = useSafeAreaInsets()
  const { width, height } = useWindowDimensions()
  const [step, setStep] = useState(null)

  useEffect(() => {
    getSeen().then(seen => {
      if (seen) { onFinish?.(); setStep(-1); return }
      navigationRef.current?.navigate(STEPS[0].tab)
      setStep(0)
    })
  }, [])

  if (step === null || step < 0) return null

  function finish() {
    saveSeen()
    // Переход на «Игра» откладываем до самого конца — иначе на этом шаге
    // GameScreen смонтируется и поверх тура всплывёт StarterPackModal
    if (current.tab === 'Игра') navigationRef.current?.navigate('Игра')
    onFinish?.()
    setStep(-1)
  }

  function goNext() {
    if (step >= STEPS.length - 1) { finish(); return }
    const next = STEPS[step + 1]
    if (next.tab !== 'Игра') navigationRef.current?.navigate(next.tab)
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
            <Text style={s.cardIcon}>{current.icon}</Text>
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
              <Text style={s.nextText}>{isLast ? 'Начать игру!' : 'Далее'}</Text>
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
