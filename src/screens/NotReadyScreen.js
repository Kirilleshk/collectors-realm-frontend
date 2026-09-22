import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../theme'
import ScreenBackground from '../components/ScreenBackground'
import BrandHeader from '../components/BrandHeader'

// Полноэкранная заглушка для разделов "в разработке" (Игра, Библиотека
// знаний) — по решению Марка от 20.09.2026 (пауза, фокус на привлечение
// аудитории к маркетплейсу). Регистрируется прямо в роутере ВМЕСТО реального
// экрана (см. App.js) — так что попасть в реальный раздел нельзя никаким
// путём, включая прямой navigation.navigate(...) в обход конкретной кнопки
// (по итогам код-ревью, Кирилл, 22.09.2026 — первая версия перехватывала
// только нажатие кнопки/таба, но не саму навигацию).
//
// route.params:
//   title, text  — текст заглушки
//   standalone   — true для таба верхнего уровня (своя BrandHeader-шапка,
//                  как у остальных вкладок); false/не задано — экран внутри
//                  стека другой вкладки, использует обычный header стека
//                  (options.title в месте регистрации Stack.Screen)
export default function NotReadyScreen({ route }) {
  const insets = useSafeAreaInsets()
  const { title, text, standalone } = route.params || {}

  return (
    <ScreenBackground style={s.wrap}>
      {standalone && <BrandHeader insets={insets} />}
      <View style={s.center}>
        <Text style={s.icon}>🚧</Text>
        <Text style={s.title}>{title}</Text>
        <Text style={s.text}>{text}</Text>
      </View>
    </ScreenBackground>
  )
}

const s = StyleSheet.create({
  wrap: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  icon: { fontSize: 56, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '900', color: colors.text, marginBottom: 12, textAlign: 'center' },
  text: { fontSize: 15, color: colors.text2, textAlign: 'center', lineHeight: 22, maxWidth: 360 },
})
