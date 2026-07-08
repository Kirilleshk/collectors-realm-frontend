import React from 'react'
import { View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { colors } from '../theme'
import { ManaBadge, HealthBadge, AttackBadge } from './cardArt'

const RULES = [
  {
    icon: '🎯',
    title: 'Цель',
    desc: 'Снизьте здоровье босса до 0, не дав своему здоровью закончиться раньше.',
  },
  {
    icon: 'mana',
    title: 'Мана — стоимость карты',
    desc: 'Синий кружок сверху слева на карте. С каждым ходом лимит маны растёт (максимум 10) — на неё разыгрываются карты из руки.',
  },
  {
    icon: 'stats',
    title: 'Здоровье и атака',
    desc: 'Зелёный щит снизу слева — здоровье существа, красный клинок справа — сила удара.',
  },
  {
    icon: '🃏',
    title: 'Ваш ход',
    desc: 'Каждый ход вы берёте карту и можете разыграть из руки все карты, на которые хватает маны — просто нажмите на карту.',
  },
  {
    icon: '⚔️',
    title: 'Атака',
    desc: 'Нажмите на своё существо на столе, чтобы выбрать его атакующим, затем нажмите на существо босса или на самого босса — либо перетащите карту существа на цель.',
  },
  {
    icon: '🔁',
    title: 'Конец хода',
    desc: 'Когда закончили действия — нажмите «Закончить ход», и в бой вступит босс.',
  },
  {
    icon: '✨',
    title: 'Редкость карт',
    desc: 'Обычная → Эпическая → Серебряная → Золотая. Чем реже карта, тем сильнее её характеристики.',
  },
]

function RuleIcon({ icon }) {
  if (icon === 'mana') return <ManaBadge value={3} size={22} />
  if (icon === 'stats') {
    return (
      <View style={{ flexDirection: 'row', gap: 4 }}>
        <HealthBadge value={2} size={22} />
        <AttackBadge value={2} size={22} />
      </View>
    )
  }
  return <Text style={s.icon}>{icon}</Text>
}

export default function HowToPlayModal({ visible, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.card}>
          <Text style={s.title}>❔ Как играть</Text>
          <ScrollView style={s.list} showsVerticalScrollIndicator={false}>
            {RULES.map((item, i) => (
              <View key={i} style={s.item}>
                <View style={s.iconWrap}><RuleIcon icon={item.icon} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.itemTitle}>{item.title}</Text>
                  <Text style={s.itemDesc}>{item.desc}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity style={s.btn} onPress={onClose}>
            <Text style={s.btnText}>Понятно</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { backgroundColor: colors.surface, borderRadius: 20, padding: 24, width: '100%', maxWidth: 440, borderWidth: 1, borderColor: colors.border, maxHeight: '80%' },
  title: { fontSize: 20, fontWeight: '900', color: colors.text, marginBottom: 20, textAlign: 'center' },
  list: { marginBottom: 16 },
  item: { flexDirection: 'row', gap: 14, marginBottom: 18, alignItems: 'flex-start' },
  iconWrap: { width: 36, alignItems: 'center', justifyContent: 'center', paddingTop: 2 },
  icon: { fontSize: 26 },
  itemTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 2 },
  itemDesc: { fontSize: 13, color: colors.text2, lineHeight: 18 },
  btn: { backgroundColor: colors.accent, borderRadius: 12, padding: 16, alignItems: 'center' },
  btnText: { color: 'white', fontSize: 16, fontWeight: '700' },
})
