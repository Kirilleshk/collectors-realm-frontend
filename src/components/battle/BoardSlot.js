import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { colors } from '../../theme'
import { RARITY, CardArt } from '../../utils/cardArt'

// Один слот стола (3 на сторону). entry = { instanceId, cardId, currentHealth, card } | null
export default function BoardSlot({ entry, size = 60 }) {
  if (!entry || !entry.card) {
    return <View style={[s.empty, { width: size, height: size, borderRadius: size * 0.18 }]} />
  }

  const { card, currentHealth } = entry
  const r = RARITY[card.rarity] || RARITY.COMMON
  const damaged = currentHealth < card.health

  return (
    <View style={[s.slot, { width: size, height: size, borderRadius: size * 0.18, borderColor: r.color, backgroundColor: `${r.color}15` }]}>
      <CardArt card={card} size={size * 0.5} />
      <View style={s.statsRow}>
        <View style={[s.statBadge, { backgroundColor: colors.blue }]}>
          <Text style={s.statText}>⚔️{card.attack}</Text>
        </View>
        <View style={[s.statBadge, { backgroundColor: damaged ? colors.accent : colors.green }]}>
          <Text style={s.statText}>❤️{currentHealth}</Text>
        </View>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  empty: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border },
  slot: { borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', paddingBottom: 3, gap: 2 },
  statsRow: { flexDirection: 'row', gap: 3 },
  statBadge: { borderRadius: 6, paddingHorizontal: 3, paddingVertical: 1 },
  statText: { fontSize: 9, fontWeight: '700', color: '#fff' },
})
