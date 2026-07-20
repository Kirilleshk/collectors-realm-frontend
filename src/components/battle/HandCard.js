import React, { useRef, useState } from 'react'
import { View, Text, Image, Pressable, Animated, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { colors } from '../../theme'
import { RARITY, rarityFrameStyle, RarityInnerRing, CardCorners, cardIcon, ManaBadge, HealthBadge, AttackBadge, nameplateGradient, noCalloutProps, noCalloutStyle } from '../../utils/cardArt'

const CARD_WIDTH = 96
const CARD_HEIGHT = 136

// Карта в руке игрока. entry = { cardId, card }
// onPress — async, возвращает true/false (успех розыгрыша); при false карта
// возвращается в руку (например, сервер отказал из-за гонки запросов)
// onLongPress(card) — долгое нажатие показывает увеличенную карту с полным
// описанием эффекта (не помещается на маленьком бейдже руки)
// width/height — компактный размер в ландшафте, чтобы рука не отъедала
// половину и без того тесной по высоте альбомной ориентации
export default function HandCard({ entry, playable, onPress, onLongPress, width = CARD_WIDTH, height = CARD_HEIGHT }) {
  const card = entry.card
  const r = RARITY[card.rarity] || RARITY.COMMON
  // Карты с boardImageUrl — новый реюскин (20.07.2026): imageUrl у них уже целая
  // карта с рамкой/именем/маной/статами, нарисованными на самой картинке. Свои
  // бейджи/имя/рамку поверх такой картинки НЕ рисуем — задвоится с тем, что уже
  // на картинке. Старые карты (boardImageUrl нет) — как раньше, полная сборка
  // из отдельных бейджей на голом квадратном портрете.
  const isFullArt = !!card.boardImageUrl
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
          { width, height },
          isFullArt ? null : { borderColor: r.color, borderWidth: frameBorderWidth },
          noCalloutStyle,
          !playable && s.cardOff,
          pressed && playable && { opacity: 0.8 },
        ]}
        onPress={handlePress}
        onLongPress={onLongPress ? () => onLongPress(card) : undefined}
        disabled={busy}
        {...noCalloutProps}
      >
        {card.imageUrl
          ? <Image source={{ uri: card.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          : <View style={[StyleSheet.absoluteFill, s.artFallback, { backgroundColor: `${r.color}22` }]}><Text style={s.artFallbackIcon}>{cardIcon(card)}</Text></View>}

        {!isFullArt && (
          <>
            <LinearGradient {...nameplateGradient(card)} style={StyleSheet.absoluteFill} pointerEvents="none" />
            <View style={s.costBadge}><ManaBadge value={card.cost} size={20} /></View>
            <Text style={s.cardName} numberOfLines={2}>{card.name}</Text>
            <View style={s.medallionsRow}>
              <HealthBadge value={card.health} size={22} />
              <AttackBadge value={card.attack} size={22} />
            </View>
            <RarityInnerRing rarity={card.rarity} borderRadius={14} />
            <CardCorners card={card} />
          </>
        )}
      </Pressable>
    </Animated.View>
  )
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 14, overflow: 'hidden' },
  cardOff: { opacity: 0.4 },
  artFallback: { alignItems: 'center', justifyContent: 'center' },
  artFallbackIcon: { fontSize: 40 },
  costBadge: { position: 'absolute', top: 2, left: 2 },
  cardName: { position: 'absolute', left: 6, right: 6, bottom: 30, fontSize: 11, fontWeight: '800', color: '#fff', lineHeight: 13, textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } },
  medallionsRow: { position: 'absolute', left: 0, right: 0, bottom: 4, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6 },
})
