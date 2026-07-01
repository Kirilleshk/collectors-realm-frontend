import React from 'react'
import { View, Text, Image, StyleSheet } from 'react-native'
import { colors } from '../../theme'

// Стопка карт (колода для добора / сброс) — рубашка темы (если есть арт) + счётчик
export default function DeckPile({ count, label, icon, color = colors.text2, size = 60, backImageUrl }) {
  return (
    <View style={[s.pile, { width: size, height: size, borderRadius: size * 0.18, borderColor: color, overflow: 'hidden' }]}>
      {backImageUrl
        ? <Image source={{ uri: backImageUrl }} style={s.backImage} resizeMode="cover" />
        : <Text style={{ fontSize: size * 0.32 }}>{icon}</Text>}
      <View style={s.countWrap}>
        <Text style={[s.count, { color: backImageUrl ? '#fff' : color }]}>{count}</Text>
        <Text style={[s.label, backImageUrl && s.labelOnImage]}>{label}</Text>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  pile: { borderWidth: 1, borderColor: `${colors.accent}35`, backgroundColor: `${colors.accent}08`, alignItems: 'center', justifyContent: 'center', gap: 1 },
  backImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  countWrap: { alignItems: 'center' },
  count: { fontSize: 13, fontWeight: '700' },
  label: { fontSize: 9, color: colors.text2 },
  labelOnImage: { color: '#fff', textShadowColor: '#000', textShadowRadius: 3 },
})
