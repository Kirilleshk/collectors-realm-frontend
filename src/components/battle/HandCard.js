import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { colors } from '../../theme'
import { RARITY, CardArt } from '../../utils/cardArt'

// Карта в руке игрока. entry = { cardId, card }
export default function HandCard({ entry, playable, onPress }) {
  const card = entry.card
  const r = RARITY[card.rarity] || RARITY.COMMON

  return (
    <Pressable
      style={({ pressed }) => [s.card, { borderColor: r.color }, !playable && s.cardOff, pressed && playable && { opacity: 0.8 }]}
      onPress={onPress}
      disabled={!playable}
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
    </Pressable>
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
