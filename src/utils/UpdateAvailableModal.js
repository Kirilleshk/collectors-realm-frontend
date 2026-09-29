import React, { useEffect, useState } from 'react'
import { View, Text, Modal, Pressable, StyleSheet, Platform } from 'react-native'
import { colors } from '../theme'
import { track } from './analytics'
import { startUpdateChecker, reloadApp } from './pwa'

// Окно «Доступна новая версия» (веб / установленное приложение): появляется,
// когда на сервер выложили новую версию, а у человека открыта старая.
export default function UpdateAvailableModal() {
  const [visible, setVisible] = useState(false)
  const [reloading, setReloading] = useState(false)

  useEffect(() => {
    if (Platform.OS !== 'web') return
    return startUpdateChecker(() => setVisible(true))
  }, [])

  if (!visible) return null

  async function handleUpdate() {
    setReloading(true)
    // даём событию уйти, но не держим человека дольше секунды
    await Promise.race([track('update_applied'), new Promise(r => setTimeout(r, 1000))])
    reloadApp()
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => setVisible(false)}>
      <View style={s.overlay}>
        <View style={s.card}>
          <Text style={s.icon}>🚀</Text>
          <Text style={s.title}>Доступна новая версия</Text>
          <Text style={s.desc}>
            Мы обновили Markeltoys. Нажмите «Обновить», чтобы получить исправления и новые возможности — это займёт пару секунд.
          </Text>
          <Pressable style={({ pressed }) => [s.btn, pressed && { opacity: 0.8 }]} onPress={handleUpdate} disabled={reloading}>
            <Text style={s.btnText}>{reloading ? 'Обновляем…' : 'Обновить'}</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [s.linkBtn, pressed && { opacity: 0.6 }]} onPress={() => setVisible(false)} disabled={reloading}>
            <Text style={s.linkBtnText}>Позже</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { backgroundColor: colors.surface, borderRadius: 20, padding: 24, width: '100%', maxWidth: 360, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  icon: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '900', color: colors.text, marginBottom: 8, textAlign: 'center' },
  desc: { fontSize: 14, color: colors.text2, textAlign: 'center', marginBottom: 16, lineHeight: 20 },
  btn: { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32, alignItems: 'center', width: '100%' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  linkBtn: { marginTop: 12, paddingVertical: 8 },
  linkBtnText: { color: colors.text2, fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },
})
