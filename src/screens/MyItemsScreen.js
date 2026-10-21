import React, { useState } from 'react'
import { View, Pressable, ScrollView, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../theme'
import ScreenBackground from '../components/ScreenBackground'
import BrandHeader from '../components/BrandHeader'
import IconLabel from '../components/IconLabel'
import { Boxes, Target, Tag, Heart } from '../icons'
import MyListingsScreen from './MyListingsScreen'
import FavoritesScreen from './FavoritesScreen'
import CollectionScreen from './CollectionScreen'
import WishlistScreen from './WishlistScreen'

// «Объявления» — первыми и по умолчанию (20.10.2026, как «Мои объявления»
// на Авито): сюда человек попадает после публикации и отсюда управляет
// своими товарами
const TABS = [
  { key: 'listings', label: 'Объявления', icon: Tag },
  { key: 'favorites', label: 'Избранное', icon: Heart },
  { key: 'collection', label: 'Коллекция', icon: Boxes },
  { key: 'wishlist', label: 'Вишлист', icon: Target },
]

export default function MyItemsScreen() {
  const insets = useSafeAreaInsets()
  const [tab, setTab] = useState('listings')

  return (
    <ScreenBackground style={s.wrap}>
      <BrandHeader insets={insets} />
      {/* 4 раздела (21.10.2026, + «Избранное») — на узком экране не влезают
          в ряд кнопок одинаковой ширины, поэтому лента с прокруткой */}
      <View style={s.switcher}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.switcherRow}>
        {TABS.map(t => (
          <Pressable
            key={t.key}
            style={[s.switchBtn, tab === t.key && s.switchBtnActive]}
            onPress={() => setTab(t.key)}
          >
            <IconLabel icon={t.icon} label={t.label} textStyle={[s.switchText, tab === t.key && s.switchTextActive]} />
          </Pressable>
        ))}
        </ScrollView>
      </View>

      <View style={[s.page, { display: tab === 'listings' ? 'flex' : 'none' }]}>
        <MyListingsScreen />
      </View>
      <View style={[s.page, { display: tab === 'favorites' ? 'flex' : 'none' }]}>
        <FavoritesScreen />
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
  switcher: { paddingTop: 8, paddingBottom: 10, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  switcherRow: { gap: 8, paddingHorizontal: 16 },
  switchBtn: { borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center', backgroundColor: colors.surface2 },
  switchBtnActive: { backgroundColor: colors.accent },
  switchText: { fontSize: 13, fontWeight: '700', color: colors.text2 },
  switchTextActive: { color: '#fff' },
  page: { flex: 1 },
})
