import React from 'react'
import { View, Text, Modal, Pressable, StyleSheet } from 'react-native'
import { colors } from '../theme'
import { RARITY } from './cardArt'

// Показывается один раз — сразу после того как POST /cards/starter впервые
// выдал игроку стартовый набор (ответ 201, не идемпотентный повторный 200)
export default function StarterPackModal({ cards, onClose }) {
  if (!cards) return null

  const total = cards.reduce((sum, uc) => sum + uc.quantity, 0)
  const counts = { COMMON: 0, EPIC: 0, SILVER: 0, GOLD: 0 }
  for (const uc of cards) counts[uc.card.rarity] += uc.quantity

  return (
    <Modal visible transparent animationType="fade">
      <View style={s.overlay}>
        <View style={s.card}>
          <Text style={s.icon}>🎁</Text>
          <Text style={s.title}>Стартовый набор!</Text>
          <Text style={s.desc}>Вам добавлено {total} игровых карт в коллекцию «Карты Средиземья»</Text>
          <View style={s.breakdown}>
            {Object.entries(counts).filter(([, n]) => n > 0).map(([rarity, n]) => (
              <View key={rarity} style={[s.badge, { borderColor: RARITY[rarity].color }]}>
                <Text style={[s.badgeText, { color: RARITY[rarity].color }]}>{RARITY[rarity].label}: {n}</Text>
              </View>
            ))}
          </View>
          <Pressable style={({ pressed }) => [s.btn, pressed && { opacity: 0.8 }]} onPress={onClose}>
            <Text style={s.btnText}>Отлично!</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { backgroundColor: colors.surface, borderRadius: 20, padding: 24, width: '100%', maxWidth: 360, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  icon: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '900', color: colors.text, marginBottom: 8, textAlign: 'center' },
  desc: { fontSize: 14, color: colors.text2, textAlign: 'center', marginBottom: 16, lineHeight: 20 },
  breakdown: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 20 },
  badge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  btn: { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
