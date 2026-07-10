import React from 'react'
import { View, Text, Image, Modal, Pressable, StyleSheet } from 'react-native'
import { colors } from '../../theme'
import { RARITY, rarityFrameStyle, RarityInnerRing, RarityCorners, cardIcon, ManaBadge, HealthBadge, AttackBadge } from '../../utils/cardArt'

// Увеличенная карточка по долгому нажатию — полный арт + все характеристики
// и текст эффекта (на маленьком бейдже в руке/на столе effectText не влезает
// и не показывается вообще). card — объект карты (не BoardCreature/HandEntry),
// currentHealth — опционально текущее HP существа на столе (если не передано,
// показывается полное здоровье карты, как в руке/коллекции).
export default function CardZoomModal({ card, currentHealth, visible, onClose }) {
  if (!card) return null
  const r = RARITY[card.rarity] || RARITY.COMMON
  const frame = rarityFrameStyle(card.rarity)
  const health = currentHealth ?? card.health

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.cardWrap} onPress={() => {}}>
          <View style={[s.card, frame, { borderColor: r.color }]}>
            {card.imageUrl
              ? <Image source={{ uri: card.imageUrl }} style={s.art} resizeMode="cover" />
              : <View style={[s.art, s.artFallback, { backgroundColor: `${r.color}22` }]}><Text style={s.artFallbackIcon}>{cardIcon(card)}</Text></View>}
            <RarityInnerRing rarity={card.rarity} borderRadius={18} />
            <RarityCorners rarity={card.rarity} />
            <View style={s.costBadge}><ManaBadge value={card.cost} size={30} /></View>
          </View>

          <Text style={s.name}>{card.name}</Text>
          <Text style={[s.rarity, { color: r.color }]}>{r.label}</Text>

          <View style={s.statsRow}>
            <View style={s.statItem}><HealthBadge value={health} size={30} damaged={health < card.health} /><Text style={s.statLabel}>Жизни</Text></View>
            <View style={s.statItem}><AttackBadge value={card.attack} size={30} /><Text style={s.statLabel}>Атака</Text></View>
          </View>

          {!!card.effectText && (
            <View style={s.effectBox}>
              <Text style={s.effectText}>{card.effectText}</Text>
            </View>
          )}

          <Pressable style={s.closeBtn} onPress={onClose}>
            <Text style={s.closeBtnText}>Закрыть</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(6,7,10,0.86)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  cardWrap: { alignItems: 'center', maxWidth: 320, width: '100%' },
  card: { width: 200, height: 280, borderRadius: 18, borderWidth: 2, overflow: 'hidden', backgroundColor: colors.surface },
  art: { width: '100%', height: '100%' },
  artFallback: { alignItems: 'center', justifyContent: 'center' },
  artFallbackIcon: { fontSize: 72 },
  costBadge: { position: 'absolute', top: 8, left: 8 },
  name: { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: 14, textAlign: 'center' },
  rarity: { fontSize: 13, fontWeight: '700', marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 28, marginTop: 14 },
  statItem: { alignItems: 'center', gap: 4 },
  statLabel: { fontSize: 11, color: colors.text2 },
  effectBox: { marginTop: 16, backgroundColor: colors.surface2, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 12, width: '100%' },
  effectText: { fontSize: 13, color: colors.text, lineHeight: 19, textAlign: 'center' },
  closeBtn: { marginTop: 20, backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 28 },
  closeBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
})
