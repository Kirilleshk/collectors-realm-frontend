import React, { useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../theme'
import ScreenBackground from '../components/ScreenBackground'
import BrandHeader from '../components/BrandHeader'
import IconLabel from '../components/IconLabel'
import { Boxes, Target, Tag } from '../icons'
import MyListingsScreen from './MyListingsScreen'
import CollectionScreen from './CollectionScreen'
import WishlistScreen from './WishlistScreen'

// «Объявления» — первыми и по умолчанию (20.10.2026, как «Мои объявления»
// на Авито): сюда человек попадает после публикации и отсюда управляет
// своими товарами
const TABS = [
  { key: 'listings', label: 'Объявления', icon: Tag },
  { key: 'collection', label: 'Коллекция', icon: Boxes },
  { key: 'wishlist', label: 'Вишлист', icon: Target },
]

export default function MyItemsScreen() {
  const insets = useSafeAreaInsets()
  const [tab, setTab] = useState('listings')

  return (
    <ScreenBackground style={s.wrap}>
      <BrandHeader insets={insets} />
      <View style={[s.switcher, { paddingTop: 8 }]}>
        {TABS.map(t => (
          <Pressable
            key={t.key}
            style={[s.switchBtn, tab === t.key && s.switchBtnActive]}
            onPress={() => setTab(t.key)}
          >
            <IconLabel icon={t.icon} label={t.label} textStyle={[s.switchText, tab === t.key && s.switchTextActive]} />
          </Pressable>
        ))}
      </View>

      <View style={[s.page, { display: tab === 'listings' ? 'flex' : 'none' }]}>
        <MyListingsScreen />
      </View>
      <View style={[s.page, { display: tab === 'collection' ? 'flex' : 'none' }]}>
        <CollectionScreen />
      </View>
      <View style={[s.page, { display: tab === 'wishlist' ? 'flex' : 'none' }]}>
        <WishlistScreen />
      </View>
    </ScreenBackground>
  )
}

const s = StyleSheet.create({
  wrap: { flex: 1 },
  switcher: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 10, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  switchBtn: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center', backgroundColor: colors.surface2 },
  switchBtnActive: { backgroundColor: colors.accent },
  switchText: { fontSize: 13, fontWeight: '700', color: colors.text2 },
  switchTextActive: { color: '#fff' },
  page: { flex: 1 },
})
