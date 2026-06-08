import React, { useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../theme'
import CollectionScreen from './CollectionScreen'
import WishlistScreen from './WishlistScreen'

const TABS = [
  { key: 'collection', label: '🗿 Коллекция' },
  { key: 'wishlist', label: '🎯 Вишлист' },
]

export default function MyItemsScreen() {
  const insets = useSafeAreaInsets()
  const [tab, setTab] = useState('collection')

  return (
    <View style={s.wrap}>
      <View style={[s.switcher, { paddingTop: insets.top + 8 }]}>
        {TABS.map(t => (
          <Pressable
            key={t.key}
            style={[s.switchBtn, tab === t.key && s.switchBtnActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[s.switchText, tab === t.key && s.switchTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={[s.page, { display: tab === 'collection' ? 'flex' : 'none' }]}>
        <CollectionScreen />
      </View>
      <View style={[s.page, { display: tab === 'wishlist' ? 'flex' : 'none' }]}>
        <WishlistScreen />
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  switcher: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 10, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  switchBtn: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center', backgroundColor: colors.surface2 },
  switchBtnActive: { backgroundColor: colors.accent },
  switchText: { fontSize: 13, fontWeight: '700', color: colors.text2 },
  switchTextActive: { color: '#fff' },
  page: { flex: 1 },
})
