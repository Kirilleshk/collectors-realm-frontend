import React, { useEffect, useLayoutEffect, useRef } from 'react'
import { View, Text, Image, Animated, Pressable, StyleSheet } from 'react-native'
import { colors } from '../../theme'
import { RARITY, rarityFrameStyle, RarityInnerRing, CardCorners, cardIcon, HealthBadge, AttackBadge, noCalloutProps, noCalloutStyle } from '../../utils/cardArt'
import DamagePopup from './DamagePopup'

// Один слот стола. entry = { instanceId, cardId, currentHealth, card } | null
// effect = { kind: 'attack'|'hit'|'death'|'spawn', dir: 'up'|'down', token } | null —
// разовый триггер анимации (token меняется при каждом новом срабатывании)
// selectable — существо можно выбрать (свой атакующий или валидная цель атаки),
// selected — это текущий выбранный атакующий (более яркая подсветка)
export default function BoardSlot({ entry, size = 60, effect, popups = [], onPress, onLongPress, selectable, selected, effectiveAttack }) {
  const scale = useRef(new Animated.Value(1)).current
  const opacity = useRef(new Animated.Value(1)).current
  const translateY = useRef(new Animated.Value(0)).current
  const flash = useRef(new Animated.Value(0)).current
  // Пульсирующее свечение для "можно походить/атаковать" — по просьбе заказчика
  // рамка НЕ красится в зелёный (это стирало цвет редкости, все карты и босс
  // выглядели одинаково), вместо этого вокруг родного цвета рамки дышит лёгкий
  // ореол того же цвета. selected (выбранный атакующий) — отдельная, более явная
  // подсветка золотым бордером, её не трогаем.
  const glowPulse = useRef(new Animated.Value(0)).current

  // Новая карта в слоте — сбрасываем анимации предыдущего жителя (слоты переиспользуются по индексу).
  // useLayoutEffect — синхронно до отрисовки, иначе новый житель на кадр мелькнёт
  // с "уехавшими" значениями анимации погибшего предыдущего
  useLayoutEffect(() => {
    scale.setValue(1)
    opacity.setValue(1)
    translateY.setValue(0)
    flash.setValue(0)
  }, [entry?.instanceId])

  useEffect(() => {
    if (!effect) return
    if (effect.kind === 'attack') {
      const dy = effect.dir === 'up' ? -14 : 14
      Animated.sequence([
        Animated.timing(translateY, { toValue: dy, duration: 120, useNativeDriver: false }),
        Animated.timing(translateY, { toValue: 0, duration: 160, useNativeDriver: false }),
      ]).start()
    } else if (effect.kind === 'hit') {
      Animated.sequence([
        Animated.timing(flash, { toValue: 1, duration: 70, useNativeDriver: false }),
        Animated.timing(flash, { toValue: 0, duration: 220, useNativeDriver: false }),
      ]).start()
    } else if (effect.kind === 'death') {
      const dy = effect.dir === 'up' ? -16 : 16
      Animated.parallel([
        Animated.timing(scale, { toValue: 0, duration: 380, useNativeDriver: false }),
        Animated.timing(opacity, { toValue: 0, duration: 380, useNativeDriver: false }),
        Animated.timing(translateY, { toValue: dy, duration: 380, useNativeDriver: false }),
      ]).start()
    } else if (effect.kind === 'spawn') {
      scale.setValue(0)
      opacity.setValue(0)
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: false }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: false }),
      ]).start()
    }
  }, [effect?.token])

  useEffect(() => {
    if (!selectable || selected) {
      glowPulse.setValue(0)
      return
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, { toValue: 1, duration: 650, useNativeDriver: false }),
        Animated.timing(glowPulse, { toValue: 0, duration: 650, useNativeDriver: false }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [selectable, selected])

  if (!entry || !entry.card) {
    return (
      <View style={[s.empty, { width: size, height: size, borderRadius: size * 0.18 }]}>
        <View style={[s.emptyGlow, { width: size * 0.4, height: size * 0.4, borderRadius: size * 0.2 }]} />
      </View>
    )
  }

  const { card, currentHealth } = entry
  const r = RARITY[card.rarity] || RARITY.COMMON
  const damaged = currentHealth < card.health
  const flashOpacity = flash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.55] })
  // Цвет рамки всегда остаётся цветом редкости карты — золотой только у явно
  // выбранного атакующего (selected). "Можно походить" (selectable) показываем
  // отдельным пульсирующим ореолом ниже, не трогая сам цвет рамки.
  const ringColor = selected ? colors.gold : r.color
  const glowOpacity = glowPulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.8] })
  const frame = rarityFrameStyle(card.rarity)
  const borderRadius = size * 0.18

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress ? () => onLongPress(card) : undefined}
      disabled={!onPress && !onLongPress}
      {...noCalloutProps}
    >
      <Animated.View
        style={[
          s.slot,
          frame,
          { width: size, height: size, borderRadius, borderColor: ringColor, overflow: 'hidden' },
          noCalloutStyle,
          (selected || selectable) && { borderWidth: 2.5 },
          { transform: [{ translateY }, { scale }], opacity },
        ]}
      >
        {card.imageUrl
          ? <Image source={{ uri: card.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          : <View style={[StyleSheet.absoluteFill, s.artFallback, { backgroundColor: `${r.color}22` }]}><Text style={{ fontSize: size * 0.4 }}>{cardIcon(card)}</Text></View>}
        <View style={s.statsRow}>
          <HealthBadge value={currentHealth} size={Math.round(size * 0.26)} damaged={damaged} />
          <AttackBadge
            value={effectiveAttack ?? card.attack}
            size={Math.round(size * 0.26)}
            buffed={effectiveAttack != null && effectiveAttack > card.attack}
          />
        </View>
        <RarityInnerRing rarity={card.rarity} borderRadius={borderRadius} />
        <CardCorners card={card} />
        <Animated.View pointerEvents="none" style={[s.hitOverlay, { borderRadius, backgroundColor: colors.accent, opacity: flashOpacity }]} />
        {popups.map(p => <DamagePopup key={p.id} amount={p.amount} positive={p.positive} />)}
      </Animated.View>
      {selectable && !selected && (
        <Animated.View
          pointerEvents="none"
          style={[s.activeGlow, { borderRadius: borderRadius + 3, borderColor: r.color, opacity: glowOpacity }]}
        />
      )}
    </Pressable>
  )
}

const s = StyleSheet.create({
  empty: { borderWidth: 1, borderColor: `${colors.accent}30`, backgroundColor: `${colors.accent}08`, alignItems: 'center', justifyContent: 'center' },
  emptyGlow: { backgroundColor: `${colors.accent}12` },
  slot: { borderWidth: 1.5 },
  artFallback: { alignItems: 'center', justifyContent: 'center' },
  statsRow: { position: 'absolute', left: 0, right: 0, bottom: 2, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 2 },
  hitOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  activeGlow: { position: 'absolute', top: -3, left: -3, right: -3, bottom: -3, borderWidth: 2 },
})
