import React, { useCallback, useEffect, useState } from 'react'
import { View, Text, Image, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { favorites as favoritesApi } from '../api'
import { colors } from '../theme'
import { useFavorites, toggleFavorite } from '../utils/favorites'
import IconLabel from '../components/IconLabel'
import { Heart, Package, MapPin, WifiOff, RotateCw } from '../icons'

// «Моё → Избранное» (21.10.2026): товары, отмеченные сердечком. Убрать —
// тем же сердечком; список фильтруется по общему набору id сразу, без
// повторной загрузки.

export default function FavoritesScreen() {
  const navigation = useNavigation()
  const favIds = useFavorites(true)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    try {
      const res = await favoritesApi.list()
      setItems(Array.isArray(res.data) ? res.data : [])
      setError(null)
    } catch (e) {
      setError('Не удалось загрузить избранное')
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => navigation.addListener('focus', load), [navigation, load])

  // Сердечко сняли здесь или в карточке товара — пропадает из списка сразу
  const shown = items.filter(p => favIds.has(p.id))

  if (loading) return <View style={s.center}><ActivityIndicator color={colors.accent} size="large" /></View>

  if (error) return (
    <View style={s.center}>
      <WifiOff size={40} color={colors.text2} strokeWidth={1.6} />
      <Text style={s.emptyTitle}>{error}</Text>
      <TouchableOpacity style={s.retryBtn} onPress={() => { setLoading(true); load() }}>
        <IconLabel icon={RotateCw} label="Повторить" textStyle={s.retryText} />
      </TouchableOpacity>
    </View>
  )

  return (
    <FlatList
      data={shown}
      keyExtractor={p => p.id}
      contentContainerStyle={s.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false) }} tintColor={colors.accent} />}
      ListEmptyComponent={
        <View style={s.empty}>
          <Heart size={44} color={colors.text2} strokeWidth={1.5} />
          <Text style={s.emptyTitle}>В избранном пока пусто</Text>
          <Text style={s.emptySub}>Нажмите на сердечко на товаре в магазине — он появится здесь.</Text>
        </View>
      }
      renderItem={({ item }) => {
        const photo = item.images?.[0]?.url
        const sold = item.status === 'SOLD'
        const price = item.isAuction ? `от ${(item.startPrice || item.price)?.toLocaleString('ru')} ₽` : `${item.price?.toLocaleString('ru')} ₽`
        return (
          <TouchableOpacity style={s.row} onPress={() => navigation.navigate('ProductDetail', { id: item.id })} activeOpacity={0.8}>
            {photo
              ? <Image source={{ uri: photo }} style={[s.thumb, sold && { opacity: 0.5 }]} resizeMode="cover" />
              : <View style={[s.thumb, s.thumbEmpty]}><Package size={24} color={colors.border} strokeWidth={1.5} /></View>}
            <View style={s.info}>
              <Text style={s.name} numberOfLines={2}>{item.name}</Text>
              <Text style={[s.price, sold && { color: colors.text2 }]}>{sold ? 'Продано' : price}</Text>
              {item.seller?.city ? (
                <View style={s.cityRow}>
                  <MapPin size={11} color={colors.text2} strokeWidth={2} />
                  <Text style={s.city} numberOfLines={1}>{item.seller.city}</Text>
                </View>
              ) : null}
            </View>
            <TouchableOpacity style={s.heart} onPress={() => toggleFavorite(item.id)} hitSlop={8} accessibilityLabel="Убрать из избранного">
              <Heart size={20} color={colors.accent} fill={colors.accent} strokeWidth={2.2} />
            </TouchableOpacity>
          </TouchableOpacity>
        )
      }}
    />
  )
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 },
  list: { padding: 16, gap: 10, paddingBottom: 32, width: '100%', maxWidth: 720, alignSelf: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 12 },
  thumb: { width: 76, height: 76, borderRadius: 12, backgroundColor: colors.surface2 },
  thumbEmpty: { justifyContent: 'center', alignItems: 'center' },
  info: { flex: 1, gap: 4 },
  name: { fontSize: 15, fontWeight: '700', color: colors.text, lineHeight: 20 },
  price: { fontSize: 16, fontWeight: '800', color: colors.accent },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  city: { flexShrink: 1, fontSize: 12, color: colors.text2 },
  heart: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: `${colors.accent}15` },
  empty: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 24, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text, textAlign: 'center' },
  emptySub: { fontSize: 13, color: colors.text2, textAlign: 'center', lineHeight: 19 },
  retryBtn: { marginTop: 8, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.accent },
  retryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
})
