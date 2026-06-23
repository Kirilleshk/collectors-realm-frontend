import React, { useRef, useState } from 'react'
import { View, Text, Pressable, Animated, StyleSheet } from 'react-native'
import { colors } from '../../theme'
import { RARITY, CardArt, rarityFrameStyle, RarityInnerRing, RarityCorners } from '../../utils/cardArt'

// Карта в руке игрока. entry = { cardId, card }
// onPress — async, возвращает true/false (успех розыгрыша); при false карта
// возвращается в руку (например, сервер отказал из-за гонки запросов)
export default function HandCard({ entry, playable, onPress }) {
  const card = entry.card
  const r = RARITY[card.rarity] || RARITY.COMMON
  const [busy, setBusy] = useState(false)
  const lift = useRef(new Animated.Value(0)).current

  async function handlePress() {
    if (!playable || busy) return
    setBusy(true)
    await new Promise(resolve => {
      Animated.timing(lift, { toValue: 1, duration: 180, useNativeDriver: false }).start(() => resolve())
    })
    const ok = await onPress()
    if (!ok) {
      Animated.timing(lift, { toValue: 0, duration: 150, useNativeDriver: false }).start()
      setBusy(false)
    }
  }

  const translateY = lift.interpolate({ inputRange: [0, 1], outputRange: [0, -32] })
  const scale = lift.interpolate({ inputRange: [0, 1], outputRange: [1, 0.85] })
  const opacity = lift.interpolate({ inputRange: [0, 1], outputRange: [1, 0] })
  // borderWidth идёт на сам Pressable (там же borderColor) — здесь оставляем
  // только тень/elevation, иначе непрозрачный borderWidth без borderColor
  // нарисует чёрную рамку по умолчанию
  const { borderWidth: frameBorderWidth, ...frameShadow } = rarityFrameStyle(card.rarity)

  return (
    // Тень рамки — на этой обёртке (не на Pressable ниже, у него overflow:hidden
    // под скругление картинки, что обрезало бы shadow)
    <Animated.View style={[frameShadow, { borderRadius: 12, backgroundColor: 'transparent' }, { transform: [{ translateY }, { scale }], opacity }]}>
      <Pressable
        style={({ pressed }) => [s.card, { borderColor: r.color, borderWidth: frameBorderWidth }, !playable && s.cardOff, pressed && playable && { opacity: 0.8 }]}
        onPress={handlePress}
        disabled={!playable || busy}
      >
        <View style={[s.cardArtArea, { backgroundColor: `${r.color}15` }]}>
          <CardArt card={card} size={28} />
          <View style={[s.costBadge, { backgroundColor: colors.blue }]}>
            <Text style={s.costBadgeText}>{card.cost}</Text>
          </View>
        </View>
        <View style={[s.cardNameBanner, { borderTopColor: r.color }]}>
          <Text style={s.cardName} numberOfLines={2}>{card.name}</Text>
        </View>
        <View style={s.cardFooter}>
          <Text style={s.cardStatText}>⚔️{card.attack} ❤️{card.health}</Text>
          <View style={[s.rarityDot, { backgroundColor: r.color }]} />
        </View>
        <RarityInnerRing rarity={card.rarity} borderRadius={12} />
        <RarityCorners rarity={card.rarity} />
      </Pressable>
    </Animated.View>
  )
}

const s = StyleSheet.create({
  card: { width: 88, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 2, overflow: 'hidden' },
  cardOff: { opacity: 0.4 },
  cardArtArea: { height: 48, alignItems: 'center', justifyContent: 'center' },
  costBadge: { position: 'absolute', top: 4, left: 4, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  costBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  cardNameBanner: { paddingHorizontal: 6, paddingVertical: 4, borderTopWidth: 1 },
  cardName: { fontSize: 10, fontWeight: '700', color: colors.text, minHeight: 26 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 6 },
  cardStatText: { fontSize: 10, color: colors.text2, fontWeight: '700' },
  rarityDot: { width: 7, height: 7, borderRadius: 3.5 },
})
