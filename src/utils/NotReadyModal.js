import React from 'react'
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native'
import { colors } from '../theme'

// Заглушка для разделов "в разработке" (Игра, Библиотека знаний) — по решению
// Марка от 20.09.2026 разработка этих фич приостановлена в пользу фокуса на
// привлечении аудитории к маркетплейсу. Вместо того чтобы просто оставить
// недоделанные разделы как есть, предупреждаем прямо при заходе (Кирилл, 22.09).
export default function NotReadyModal({ visible, onClose, title, text }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.card}>
          <Text style={s.icon}>🚧</Text>
          <Text style={s.title}>{title}</Text>
          <Text style={s.text}>{text}</Text>
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
  card: { backgroundColor: colors.surface, borderRadius: 20, padding: 24, width: '100%', maxWidth: 400, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  icon: { fontSize: 40, marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '900', color: colors.text, marginBottom: 8, textAlign: 'center' },
  text: { fontSize: 14, color: colors.text2, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  btn: { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32, alignItems: 'center' },
  btnText: { color: 'white', fontSize: 15, fontWeight: '700' },
})
