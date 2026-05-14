import React, { useEffect, useState } from 'react'
import { View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet, Platform } from 'react-native'
import { colors } from '../theme'
import { CURRENT_VERSION, CURRENT_CHANGES, ALL_HELP_ITEMS } from './changelog'

export { ALL_HELP_ITEMS as HELP_ITEMS }

async function getLastSeenVersion() {
  try {
    if (Platform.OS === 'web') return localStorage.getItem('lastSeenVersion')
    const AsyncStorage = require('@react-native-async-storage/async-storage').default
    return await AsyncStorage.getItem('lastSeenVersion')
  } catch { return null }
}

async function saveLastSeenVersion() {
  try {
    if (Platform.OS === 'web') { localStorage.setItem('lastSeenVersion', CURRENT_VERSION); return }
    const AsyncStorage = require('@react-native-async-storage/async-storage').default
    await AsyncStorage.setItem('lastSeenVersion', CURRENT_VERSION)
  } catch {}
}

export default function WhatsNewModal() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    getLastSeenVersion().then(v => {
      if (v !== CURRENT_VERSION) setVisible(true)
    })
  }, [])

  function close() {
    saveLastSeenVersion()
    setVisible(false)
  }

  if (CURRENT_CHANGES.length === 0) return null

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={s.overlay}>
        <View style={s.card}>
          <Text style={s.title}>Что нового в v{CURRENT_VERSION} 🎉</Text>
          <ScrollView style={s.list} showsVerticalScrollIndicator={false}>
            {CURRENT_CHANGES.map((item, i) => (
              <View key={i} style={s.item}>
                <Text style={s.icon}>{item.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.itemTitle}>{item.title}</Text>
                  <Text style={s.itemDesc}>{item.desc}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity style={s.btn} onPress={close}>
            <Text style={s.btnText}>Понятно, начать!</Text>
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
  item: { flexDirection: 'row', gap: 14, marginBottom: 16, alignItems: 'flex-start' },
  icon: { fontSize: 28, width: 36 },
  itemTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 2 },
  itemDesc: { fontSize: 13, color: colors.text2, lineHeight: 18 },
  btn: { backgroundColor: colors.accent, borderRadius: 12, padding: 16, alignItems: 'center' },
  btnText: { color: 'white', fontSize: 16, fontWeight: '700' },
})
