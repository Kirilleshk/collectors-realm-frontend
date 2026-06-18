import React from 'react'
import { View, Text, Image, StyleSheet } from 'react-native'
import { colors } from '../theme'

// Палитра редкости — общая для экрана коллекции и боя
export const RARITY = {
  COMMON: { label: 'Обычная', color: colors.blue },
  EPIC: { label: 'Эпическая', color: colors.purple },
  SILVER: { label: 'Серебряная', color: colors.silver },
  GOLD: { label: 'Золотая', color: colors.gold },
}

// Пока не у всех карт есть нейросгенерированный арт (рисуется постепенно) —
// для карт без imageUrl подбираем иконку по геймплейным признакам:
// тип эффекта говорит о фракции, а её отсутствие — о «простой» карте.
export function cardIcon(card) {
  const effect = card.effectType || ''
  if (effect.startsWith('acid') || effect === 'buff_allies') return '👽'
  if (effect.startsWith('stealth')) return '🏹'
  return card.attack > 0 ? '⚔️' : '🛡️'
}

export function CardArt({ card, size = 56 }) {
  const r = RARITY[card.rarity] || RARITY.COMMON
  return (
    <View style={[s.wrap, { width: size, height: size, borderRadius: size * 0.22, backgroundColor: `${r.color}1f`, borderColor: r.color, overflow: 'hidden' }]}>
      {card.imageUrl
        ? <Image source={{ uri: card.imageUrl }} style={{ width: size, height: size }} resizeMode="cover" />
        : <Text style={{ fontSize: size * 0.5 }}>{cardIcon(card)}</Text>}
    </View>
  )
}

export function BossArt({ size = 88, imageUrl }) {
  return (
    <View style={[s.wrap, s.boss, { width: size, height: size, borderRadius: size * 0.22, overflow: 'hidden' }]}>
      {imageUrl
        ? <Image source={{ uri: imageUrl }} style={{ width: size, height: size }} resizeMode="cover" />
        : <Text style={{ fontSize: size * 0.5 }}>👹</Text>}
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  boss: { backgroundColor: `${colors.accent}1f`, borderColor: colors.accent },
})
