import React, { useRef, useState } from 'react'
import { View, Text, Image, Pressable, Animated, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { colors } from '../../theme'
import { RARITY, rarityFrameStyle, RarityInnerRing, RarityCorners, cardIcon } from '../../utils/cardArt'

const CARD_WIDTH = 96
const CARD_HEIGHT = 136

// Карта в руке игрока. entry = { cardId, card }
// onPress — async, возвращает true/false (успех розыгрыша); при false карта
// возвращается в руку (например, сервер отказал из-за гонки запросов)
// width/height — компактный размер в ландшафте, чтобы рука не отъедала
// половину и без того тесной по высоте альбомной ориентации
export default function HandCard({ entry, playable, onPress, width = CARD_WIDTH, height = CARD_HEIGHT }) {
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
    <Animated.View style={[frameShadow, { borderRadius: 14, backgroundColor: 'transparent' }, { transform: [{ translateY }, { scale }], opacity }]}>
      <Pressable
        style={({ pressed }) => [
          s.card,
          { width, height, borderColor: r.color, borderWidth: frameBorderWidth },
          !playable && s.cardOff,
          pressed && playable && { opacity: 0.8 },
        ]}
        onPress={handlePress}
        disabled={!playable || busy}
      >
        {card.imageUrl
          ? <Image source={{ uri: card.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          : <View style={[StyleSheet.absoluteFill, s.artFallback, { backgroundColor: `${r.color}22` }]}><Text style={s.artFallbackIcon}>{cardIcon(card)}</Text></View>}

        <LinearGradient colors={['transparent', 'rgba(10,11,14,0.92)']} locations={[0.4, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />

        <View style={[s.costBadge, { backgroundColor: colors.blue }]}>
          <Text style={s.costBadgeText}>{card.cost}</Text>
        </View>

        <Text style={s.cardName} numberOfLines={2}>{card.name}</Text>

        <View style={s.medallionsRow}>
          <View style={[s.medallion, { backgroundColor: colors.blue }]}><Text style={s.medallionText}>{card.attack}</Text></View>
          <View style={[s.medallion, { backgroundColor: colors.accent }]}><Text style={s.medallionText}>{card.health}</Text></View>
        </View>

        <RarityInnerRing rarity={card.rarity} borderRadius={14} />
        <RarityCorners rarity={card.rarity} />
      </Pressable>
    </Animated.View>
  )
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 14, overflow: 'hidden' },
  cardOff: { opacity: 0.4 },
  artFallback: { alignItems: 'center', justifyContent: 'center' },
  artFallbackIcon: { fontSize: 40 },
  costBadge: { position: 'absolute', top: 5, left: 5, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.55)' },
  costBadgeText: { fontSize: 12, fontWeight: '800', color: '#fff' },
  cardName: { position: 'absolute', left: 6, right: 6, bottom: 30, fontSize: 11, fontWeight: '800', color: '#fff', lineHeight: 13, textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } },
  medallionsRow: { position: 'absolute', left: 0, right: 0, bottom: 4, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6 },
  medallion: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.6)' },
  medallionText: { fontSize: 11, fontWeight: '800', color: '#fff' },
})
