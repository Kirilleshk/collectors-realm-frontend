import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { colors } from '../../theme'

// Стопка карт (колода для добора / сброс) — рубашка + счётчик
export default function DeckPile({ count, label, icon, color = colors.text2, size = 60 }) {
  return (
    <View style={[s.pile, { width: size, height: size, borderRadius: size * 0.18, borderColor: color }]}>
      <Text style={{ fontSize: size * 0.32 }}>{icon}</Text>
      <Text style={[s.count, { color }]}>{count}</Text>
      <Text style={s.label}>{label}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  pile: { borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface2, gap: 1 },
  count: { fontSize: 13, fontWeight: '700' },
  label: { fontSize: 9, color: colors.text2 },
})
