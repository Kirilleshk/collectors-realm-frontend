import React, { useState, useEffect, useRef } from 'react'
import { View, Text, Image, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, useWindowDimensions, TextInput, Animated } from 'react-native'
import { products } from '../api'
import { colors } from '../theme'
import ScreenBackground from '../components/ScreenBackground'

// На узком мобильном экране — 2 колонки как раньше; на широком вебе больше
// колонок, чтобы карточка не растягивалась на пол-окна (фикс "растянутых карточек").
// Считается из useWindowDimensions в компоненте, а не один раз при загрузке модуля,
// чтобы сетка пересчитывалась при повороте экрана.
function getNumColumns(width) {
  return width >= 1100 ? 5 : width >= 860 ? 4 : width >= 600 ? 3 : 2
}

const FILTERS = [
  { label: 'Все', value: null },
  { label: 'Новые', value: 'NEW' },
  { label: 'Б/у', value: 'USED' },
  { label: '🔨 Аукцион', value: 'AUCTION' },
  { label: 'Предзаказ', value: 'PREORDER' },
  { label: 'Резерв', value: 'RESERVED' },
  { label: 'Торг', value: 'NEGOTIABLE' },
  { label: 'Продано', value: 'SOLD' },
]

const STATUS_BADGE = {
  AVAILABLE: { label: null, color: null },
  PREORDER: { label: 'Предзаказ', color: '#007AFF' },
  RESERVED: { label: 'Резерв', color: '#FF9500' },
  NEGOTIABLE: { label: 'Торг', color: '#AF52DE' },
  SOLD: { label: 'Продан', color: '#8E8E93' },
}

export default function ShopScreen({ navigation }) {
  const { width } = useWindowDimensions()
  const numColumns = getNumColumns(width)
  const cardWidth = (width - 12 * (numColumns + 1)) / numColumns

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [slowLoad, setSlowLoad] = useState(false)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState(null)
  const searchAnim = useRef(new Animated.Value(0)).current

  useEffect(() => { load() }, [])

  useEffect(() => {
    Animated.timing(searchAnim, {
      toValue: 1, duration: 400, useNativeDriver: true
    }).start()
  }, [])

  async function load() {
    setError(null)
    setLoading(true)
    const slowTimer = setTimeout(() => setSlowLoad(true), 8000)
    try {
      const res = await products.getAll()
      const data = Array.isArray(res.data) ? res.data : (res.data.products || [])
      setItems(data)
    } catch (e) {
      setError('Не удалось загрузить товары')
    }
    clearTimeout(slowTimer)
    setSlowLoad(false)
    setLoading(false)
  }

  async function onRefresh() {
    setRefreshing(true); await load(); setRefreshing(false)
  }

  const filtered = items.filter(item => {
    const matchSearch = item.name?.toLowerCase().includes(search.toLowerCase()) ||
      item.manufacturer?.toLowerCase().includes(search.toLowerCase())
    const matchFilter = !filter ? item.status !== 'SOLD' : (
      filter === 'NEW' ? item.status !== 'SOLD' && item.condition === 'NEW' :
      filter === 'USED' ? item.status !== 'SOLD' && item.condition === 'USED' :
      filter === 'AUCTION' ? item.isAuction && item.status !== 'SOLD' :
      item.status === filter
    )
    return matchSearch && matchFilter
  })

  function getBadge(item) {
    if (item.status && item.status !== 'AVAILABLE') {
      return STATUS_BADGE[item.status] || { label: item.condition === 'USED' ? 'Б/у' : 'Новый', color: null }
    }
    return { label: item.condition === 'USED' ? 'Б/у' : 'Новый', color: null }
  }

  function getBadgeStyle(item) {
    const badge = getBadge(item)
    if (badge.color) return { backgroundColor: `${badge.color}30`, borderColor: `${badge.color}60` }
    if (item.condition === 'USED') return s.badgeUsed
    return s.badgeNew
  }

  if (loading) return (
    <View style={s.center}>
      <ActivityIndicator color={colors.accent} size="large" />
      <Text style={s.loadingText}>Загружаем коллекцию...</Text>
      {slowLoad && (
        <Text style={s.slowText}>Сервер просыпается, подождите немного...</Text>
      )}
    </View>
  )

  if (error) return (
    <View style={s.center}>
      <Text style={{ fontSize: 40, marginBottom: 8 }}>⚠️</Text>
      <Text style={s.errorTitle}>Нет соединения</Text>
      <Text style={s.errorSub}>{error}</Text>
      <TouchableOpacity style={s.retryBtn} onPress={load}>
        <Text style={s.retryText}>↻ Повторить</Text>
      </TouchableOpacity>
    </View>
  )

  return (
    <ScreenBackground style={s.wrap}>
      {/* Кнопка Анонсы */}
      <TouchableOpacity style={s.announceBanner} onPress={() => navigation.navigate('Releases')}>
        <Text style={s.announceBannerText}>📅 Анонсы новых фигурок →</Text>
      </TouchableOpacity>

      {/* Поиск */}
      <Animated.View style={[s.searchWrap, { opacity: searchAnim }]}>
        <Text style={s.searchIcon}>🔍</Text>
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Поиск по названию или производителю..."
          placeholderTextColor={colors.text2}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={s.searchClear}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </Animated.View>

      {/* Фильтры */}
      <View style={s.filtersWrap}>
        <FlatList
          data={FILTERS}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={f => f.label}
          contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
          renderItem={({ item: f }) => (
            <TouchableOpacity
              style={[s.filterBtn, filter === f.value && s.filterBtnActive]}
              onPress={() => setFilter(f.value)}
            >
              <Text style={[s.filterText, filter === f.value && s.filterTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      <FlatList
        key={numColumns}
        data={filtered}
        keyExtractor={i => i.id}
        numColumns={numColumns}
        contentContainerStyle={s.list}
        columnWrapperStyle={s.row}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        ListHeaderComponent={
          <View style={s.header}>
            <Text style={s.headerTitle}>Коллекция</Text>
            <Text style={s.headerCount}>{filtered.length} из {items.length}</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyIcon}>{search ? '🔍' : '🗿'}</Text>
            <Text style={s.emptyTitle}>{search ? 'Ничего не найдено' : 'Товаров пока нет'}</Text>
            <Text style={s.emptySub}>{search ? `По запросу "${search}" ничего нет` : 'Загляни позже'}</Text>
            {search ? (
              <TouchableOpacity style={s.clearSearchBtn} onPress={() => setSearch('')}>
                <Text style={s.clearSearchText}>Очистить поиск</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const badge = getBadge(item)
          return (
            <TouchableOpacity
              style={[s.card, { width: cardWidth }]}
              onPress={() => navigation.navigate('ProductDetail', { id: item.id })}
              activeOpacity={0.85}
            >
              <View style={s.imgWrap}>
                {item.images?.[0]?.url
                  ? <Image source={{ uri: item.images[0].url }} style={s.img} resizeMode="cover" />
                  : <Text style={s.imgIcon}>🗿</Text>
                }
                {item.isAuction ? (
                  <View style={s.auctionBadge}>
                    <Text style={s.auctionBadgeText}>🔨 АУКЦИОН</Text>
                  </View>
                ) : (
                  <View style={[s.badge, getBadgeStyle(item)]}>
                    <Text style={[s.badgeText, badge.color ? { color: badge.color } : {}]}>
                      {badge.label}
                    </Text>
                  </View>
                )}
              </View>
              <View style={s.cardBody}>
                <Text style={s.cardName} numberOfLines={2}>{item.name}</Text>
                {item.manufacturer ? <Text style={s.cardMfr} numberOfLines={1}>{item.manufacturer}</Text> : null}
                {item.isAuction
                  ? <Text style={[s.cardPrice, { color: '#FF6B00' }]}>от {(item.startPrice || item.price)?.toLocaleString('ru')} ₽</Text>
                  : <Text style={s.cardPrice}>{item.price?.toLocaleString('ru')} ₽</Text>
                }
              </View>
            </TouchableOpacity>
          )
        }}
      />
    </ScreenBackground>
  )
}

const s = StyleSheet.create({
  wrap: { flex: 1 },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: colors.text2, fontSize: 14 },
  slowText: { color: colors.text2, fontSize: 12, textAlign: 'center', paddingHorizontal: 32, marginTop: 4 },
  errorTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  errorSub: { fontSize: 14, color: colors.text2, textAlign: 'center', paddingHorizontal: 32 },
  retryBtn: { marginTop: 8, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.accent },
  retryText: { color: 'white', fontSize: 15, fontWeight: '700' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border,
    margin: 12, marginBottom: 8,
    paddingHorizontal: 14, paddingVertical: 10, gap: 10,
  },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, color: colors.text, fontSize: 14 },
  searchClear: { color: colors.text2, fontSize: 16, padding: 4 },
  announceBanner: { marginHorizontal: 12, marginTop: 8, marginBottom: 4, backgroundColor: `${colors.blue}15`, borderRadius: 10, borderWidth: 1, borderColor: `${colors.blue}30`, paddingHorizontal: 14, paddingVertical: 10 },
  announceBannerText: { fontSize: 13, fontWeight: '600', color: colors.blue },
  filtersWrap: { marginBottom: 4 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  filterBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterText: { fontSize: 13, fontWeight: '600', color: colors.text2 },
  filterTextActive: { color: 'white' },
  list: { padding: 12, paddingBottom: 24 },
  row: { justifyContent: 'space-between' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingHorizontal: 4 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  headerCount: { fontSize: 13, color: colors.text2 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16, borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden', marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  imgWrap: { height: 150, backgroundColor: colors.surface2, justifyContent: 'center', alignItems: 'center', position: 'relative', overflow: 'hidden' },
  img: { width: '100%', height: 150 },
  imgIcon: { fontSize: 52 },
  auctionBadge: { position: 'absolute', top: 10, right: 10, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: '#FF6B0022', borderWidth: 1, borderColor: '#FF6B0060' },
  auctionBadgeText: { fontSize: 10, fontWeight: '800', color: '#FF6B00' },
  badge: { position: 'absolute', top: 10, right: 10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  badgeNew: { backgroundColor: 'rgba(42,170,96,0.2)', borderColor: 'rgba(42,170,96,0.4)' },
  badgeUsed: { backgroundColor: 'rgba(139,79,212,0.2)', borderColor: 'rgba(139,79,212,0.4)' },
  badgeText: { fontSize: 10, fontWeight: '700', color: colors.text },
  cardBody: { padding: 12 },
  cardName: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 4, lineHeight: 19 },
  cardMfr: { fontSize: 11, color: colors.text2, marginBottom: 8 },
  cardPrice: { fontSize: 16, fontWeight: '800', color: colors.accent },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: colors.text, marginBottom: 8 },
  emptySub: { fontSize: 14, color: colors.text2, textAlign: 'center' },
  clearSearchBtn: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  clearSearchText: { color: colors.accent, fontSize: 14, fontWeight: '600' },
})