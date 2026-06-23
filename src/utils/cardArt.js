import React from 'react'
import { View, Text, Image, StyleSheet } from 'react-native'
import { colors } from '../theme'

// Палитра редкости — общая для экрана коллекции и боя. tier растёт с редкостью —
// от него зависит толщина рамки/свечение в rarityFrameStyle ниже
export const RARITY = {
  COMMON: { label: 'Обычная', color: colors.blue, tier: 0 },
  EPIC: { label: 'Эпическая', color: colors.purple, tier: 1 },
  SILVER: { label: 'Серебряная', color: colors.silver, tier: 2 },
  GOLD: { label: 'Золотая', color: colors.gold, tier: 3 },
}

// Объём рамки по редкости без отдельных арт-ассетов: толще рамка + цветное
// свечение (shadow/elevation) растут с tier. Применяется к внешнему контейнеру
// карты (BoardSlot/HandCard) поверх их собственного borderColor.
export function rarityFrameStyle(rarity) {
  const tier = (RARITY[rarity] || RARITY.COMMON).tier
  const color = (RARITY[rarity] || RARITY.COMMON).color
  return {
    borderWidth: 1.5 + tier * 0.5,
    shadowColor: color,
    shadowOpacity: tier > 0 ? 0.35 + tier * 0.1 : 0,
    shadowRadius: tier > 0 ? 2 + tier * 2 : 0,
    shadowOffset: { width: 0, height: tier > 0 ? 1 : 0 },
    elevation: tier * 2,
  }
}

// Внутренняя светлая обводка-бевел — только у редких карт (SILVER/GOLD),
// создаёт ощущение объёма рамки без растрового арта
export function RarityInnerRing({ rarity, borderRadius = 8 }) {
  const r = RARITY[rarity] || RARITY.COMMON
  if (r.tier < 2) return null
  return <View pointerEvents="none" style={[s.innerRing, { borderRadius: Math.max(0, borderRadius - 3), borderColor: `${r.color}90` }]} />
}

// Декоративные уголки-«вензели» — только у золотых карт, самый престижный тир
export function RarityCorners({ rarity }) {
  if (rarity !== 'GOLD') return null
  const color = RARITY.GOLD.color
  return (
    <>
      <View pointerEvents="none" style={[s.corner, s.cornerTL, { backgroundColor: color }]} />
      <View pointerEvents="none" style={[s.corner, s.cornerTR, { backgroundColor: color }]} />
      <View pointerEvents="none" style={[s.corner, s.cornerBL, { backgroundColor: color }]} />
      <View pointerEvents="none" style={[s.corner, s.cornerBR, { backgroundColor: color }]} />
    </>
  )
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
  innerRing: { position: 'absolute', top: 3, left: 3, right: 3, bottom: 3, borderWidth: 1 },
  corner: { position: 'absolute', width: 5, height: 5, borderRadius: 2.5 },
  cornerTL: { top: 3, left: 3 },
  cornerTR: { top: 3, right: 3 },
  cornerBL: { bottom: 3, left: 3 },
  cornerBR: { bottom: 3, right: 3 },
})
