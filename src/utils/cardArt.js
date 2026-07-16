import React from 'react'
import { View, Text, Image, StyleSheet, Platform } from 'react-native'
import Svg, { Path, Circle } from 'react-native-svg'
import { colors } from '../theme'

// На вебе (моб. Safari/Chrome) долгое нажатие на <img> внутри карты открывает
// нативное меню браузера (сохранить/открыть картинку) поверх нашего
// onLongPress — Марк видел это как "непонятные лишние пункты, переход на
// сайт". Гасим системный контекст-меню и drag/выделение картинки карты.
export const noCalloutProps = Platform.OS === 'web' ? { onContextMenu: e => e.preventDefault() } : {}
export const noCalloutStyle = Platform.OS === 'web'
  ? { userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none', WebkitUserDrag: 'none' }
  : null

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

// Значки характеристик карты — общие для HandCard/BoardSlot/GameScreen, чтобы
// мана/атака/жизни выглядели одинаково везде и менялись в одном месте.
// Текст поверх — через absolute overlay, а не children Svg, т.к. react-native-svg
// на вебе не всегда корректно позиционирует вложенный RN Text внутри Svg.
function StatText({ value, fontSize }) {
  return (
    <View style={s.statTextWrap} pointerEvents="none">
      <Text style={[s.statText, { fontSize, lineHeight: fontSize + 1 }]}>{value}</Text>
    </View>
  )
}

// Мана — остаётся круглой (по просьбе заказчика), но получает магический ореол:
// внешнее блёклое кольцо-свечение + цветная тень (тот же приём, что и в
// rarityFrameStyle — на Android даёт elevation, на iOS/web настоящий блюр)
export function ManaBadge({ value, size = 24, style }) {
  const outer = size * 1.55
  const halo = size * 1.3
  return (
    <View style={[s.manaShadow, { width: outer, height: outer, shadowColor: colors.blue }, style]}>
      <View style={[s.manaHalo, { width: halo, height: halo, borderRadius: halo / 2, top: (outer - halo) / 2, left: (outer - halo) / 2, backgroundColor: `${colors.blue}33` }]} />
      <View style={[s.manaCircle, { width: size, height: size, borderRadius: size / 2, top: (outer - size) / 2, left: (outer - size) / 2 }]}>
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle cx="12" cy="12" r="11" fill={colors.blue} stroke="rgba(255,255,255,0.65)" strokeWidth="1.5" />
        </Svg>
        <StatText value={value} fontSize={size * 0.5} />
      </View>
    </View>
  )
}

const SHIELD_PATH = 'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z'
// Клинок-медальон: вытянутый ромб (аналог классической игровой иконки атаки) —
// сплошная заливка в средней части, поэтому цифра всегда лежит на цвете, а не
// на прозрачных зазорах, как было бы у составного меча из тонких примитивов
const BLADE_PATH = 'M12 1L18 12L12 23L6 12Z'

// Жизни — щит. damaged=true подсвечивает текущим уроном (accent), как раньше
export function HealthBadge({ value, size = 24, damaged, style }) {
  const fill = damaged ? colors.accent : colors.green
  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d={SHIELD_PATH} fill={fill} stroke="rgba(255,255,255,0.6)" strokeWidth="1" />
      </Svg>
      <StatText value={value} fontSize={size * 0.42} />
    </View>
  )
}

// Бонус атаки от аур союзников на столе (buff_allies/acid_blood_buff/
// stealth_buff), пока сам баффер жив — зеркалит auraAttackBonus на бэкенде
// (cards.routes.ts), нужен на фронте только для отображения актуальной силы
// удара существа (без этого AttackBadge показывал базовое значение карты,
// а реальный урон в бою был выше на бонус ауры — путало игрока).
// Способность "может стать невидимым" — активируется игроком вручную (см.
// POST /battle/:id/activate), не автоматически с выхода на стол. Зеркалит
// hasStealth() на бэкенде (cards.routes.ts).
export function hasActivatableAbility(card) {
  return card?.effectType === 'stealth' || card?.effectType === 'stealth_buff'
}

export function auraAttackBonus(board) {
  let bonus = 0
  for (const c of board || []) {
    if (!c || c.currentHealth <= 0 || !c.card) continue
    if (['buff_allies', 'acid_blood_buff', 'stealth_buff'].includes(c.card.effectType)) {
      bonus += c.card.effectValue ?? 1
    }
  }
  return bonus
}

// Атака — клинок-ромб красного цвета. buffed=true — атака увеличена аурой
// союзников, подсвечиваем золотым вместо красного, чтобы бонус был заметен.
export function AttackBadge({ value, size = 24, style, buffed }) {
  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d={BLADE_PATH} fill={buffed ? colors.gold : colors.red} stroke="rgba(255,255,255,0.6)" strokeWidth="1" />
      </Svg>
      <StatText value={value} fontSize={size * 0.42} />
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  innerRing: { position: 'absolute', top: 3, left: 3, right: 3, bottom: 3, borderWidth: 1 },
  corner: { position: 'absolute', width: 5, height: 5, borderRadius: 2.5 },
  cornerTL: { top: 3, left: 3 },
  cornerTR: { top: 3, right: 3 },
  cornerBL: { bottom: 3, left: 3 },
  cornerBR: { bottom: 3, right: 3 },
  statTextWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  statText: { fontWeight: '800', color: '#fff', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.85)', textShadowRadius: 2, textShadowOffset: { width: 0, height: 1 } },
  manaShadow: { alignItems: 'center', justifyContent: 'center', shadowOpacity: 0.85, shadowRadius: 6, shadowOffset: { width: 0, height: 0 }, elevation: 6 },
  manaHalo: { position: 'absolute' },
  manaCircle: { position: 'absolute', overflow: 'hidden' },
})
