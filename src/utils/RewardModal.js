import React from 'react'
import { View, Text, Modal, Pressable, StyleSheet } from 'react-native'
import { colors } from '../theme'
import { RARITY } from './cardArt'

// Награда за победу над боссом (27.08.2026, прямая просьба Марка —
// заметка бота cmtbsvea2: "после каждого босса пользователь должен
// что-то получать"). Раньше награда (всегда 1 карта) была видна только
// строкой в логе боя — теперь показывается отдельным экраном, как уже
// давно сделано для стартового набора (см. StarterPackModal.js, тот же
// визуальный каркас). В отличие от стартового набора (10 карт — там
// уместен свод по редкостям), тут награда маленькая (1-4 карты, растёт
// с номером побеждённого босса), поэтому показываем сами названия карт,
// а не только агрегат.
export default function RewardModal({ cards, onClose }) {
  if (!cards || cards.length === 0) return null

  return (
    <Modal visible transparent animationType="fade">
      <View style={s.overlay}>
        <View style={s.card}>
          <Text style={s.icon}>🏆</Text>
          <Text style={s.title}>Награда за победу!</Text>
          <Text style={s.desc}>
            {cards.length === 1 ? 'Вам добавлена карта в коллекцию' : `Вам добавлено ${cards.length} карт в коллекцию`}
          </Text>
          <View style={s.list}>
            {cards.map((card, i) => (
              <View key={`${card.id}-${i}`} style={[s.row, { borderColor: RARITY[card.rarity].color }]}>
                <Text style={[s.rowRarity, { color: RARITY[card.rarity].color }]}>{RARITY[card.rarity].label}</Text>
                <Text style={s.rowName} numberOfLines={1}>{card.name}</Text>
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
  list: { width: '100%', gap: 8, marginBottom: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  rowRarity: { fontSize: 11, fontWeight: '800', width: 78 },
  rowName: { flex: 1, fontSize: 14, color: colors.text, fontWeight: '600' },
  btn: { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
