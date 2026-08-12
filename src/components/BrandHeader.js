import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { colors } from '../theme'

// Брендовая плашка сверху каждой вкладки (Марк, 12.08): "во всех меню сверху
// крупными буквами должно быть написано Markeltoys". До 24.07 здесь был
// нативный header с названием текущего экрана — убрали, т.к. дублировал
// подпись таб-бара снизу (см. CLAUDE.md). Теперь вместо названия раздела —
// само название приложения, один раз, не завязано на конкретный экран.
export default function BrandHeader({ insets }) {
  return (
    <View style={[s.wrap, { paddingTop: (insets?.top || 0) + 10 }]}>
      <Text style={s.icon}>🗿</Text>
      <Text style={s.text}>Markeltoys</Text>
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingBottom: 8 },
  icon: { fontSize: 16 },
  text: { fontSize: 15, fontWeight: '800', color: colors.text, letterSpacing: 0.3 },
})
