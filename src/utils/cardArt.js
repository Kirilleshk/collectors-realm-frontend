import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { colors } from '../theme'

// Палитра редкости — общая для экрана коллекции и боя
export const RARITY = {
  COMMON: { label: 'Обычная', color: colors.blue },
  EPIC: { label: 'Эпическая', color: colors.purple },
  SILVER: { label: 'Серебряная', color: colors.silver },
  GOLD: { label: 'Золотая', color: colors.gold },
}

// У карт нет своих изображений (юридически рискованно тянуть арт франшиз) —
// вместо этого подбираем иконку по геймплейным признакам карты:
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
    <View style={[s.wrap, { width: size, height: size, borderRadius: size * 0.22, backgroundColor: `${r.color}1f`, borderColor: r.color }]}>
      <Text style={{ fontSize: size * 0.5 }}>{cardIcon(card)}</Text>
    </View>
  )
}

export function BossArt({ size = 88 }) {
  return (
    <View style={[s.wrap, s.boss, { width: size, height: size, borderRadius: size * 0.22 }]}>
      <Text style={{ fontSize: size * 0.5 }}>👹</Text>
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  boss: { backgroundColor: `${colors.accent}1f`, borderColor: colors.accent },
})
