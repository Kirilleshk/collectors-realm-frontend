import React, { useState, useEffect, useRef } from 'react'
import { View, Text, Image, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, useWindowDimensions, TextInput, Animated } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { products } from '../api'
import { useAuth } from '../AuthContext'
import ShopFilters, { EMPTY_FILTERS, activeFiltersCount } from '../components/ShopFilters'
import { colors } from '../theme'
import ScreenBackground from '../components/ScreenBackground'
import BrandHeader from '../components/BrandHeader'
import IconLabel from '../components/IconLabel'
import { Gavel, CalendarDays, Search, SearchX, X, Package, WifiOff, RotateCw, SlidersHorizontal, MapPin } from '../icons'

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
  { label: 'Аукцион', value: 'AUCTION', icon: Gavel },
  { label: 'Предзаказ', value: 'PREORDER' },
  { label: 'Резерв', value: 'RESERVED' },
  { label: 'Торг', value: 'NEGOTIABLE' },
  { label: 'Продано', value: 'SOLD' },
]

// Цена для фильтра и сортировки: у аукциона — стартовая
function effectivePrice(item) {
  return item.isAuction ? (item.startPrice || item.price || 0) : (item.price || 0)
}

const normCity = c => (c || '').trim().toLowerCase().replace(/ё/g, 'е')

const STATUS_BADGE = {
  AVAILABLE: { label: null, color: null },
  PREORDER: { label: 'Предзаказ', color: '#007AFF' },
  RESERVED: { label: 'Резерв', color: '#FF9500' },
  NEGOTIABLE: { label: 'Торг', color: '#AF52DE' },
  SOLD: { label: 'Продан', color: '#8E8E93' },
}

export default function ShopScreen({ navigation }) {
  const insets = useSafeAreaInsets()
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
  // Панель «Фильтры» (21.10.2026): категория, цена, мой город, сортировка
  const { user } = useAuth()
  const [adv, setAdv] = useState(EMPTY_FILTERS)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const advCount = activeFiltersCount(adv)
  const searchAnim = useRef(new Animated.Value(0)).current
  // Автодополнение по названию товара (Марк, 05.08, пункт 3: та же функция,
  // что и в библиотеке) — товары уже загружены на клиенте, поэтому просто
  // фильтруем локально, без похода на бэкенд. Только по префиксу (как и в
  // библиотеке), уникальные названия, до 8 штук.
  const [showSuggestions, setShowSuggestions] = useState(false)
  const nameSuggestions = search.trim().length >= 2
    ? [...new Set(
        items
          .filter(i => i.name?.toLowerCase().startsWith(search.trim().toLowerCase()))
          .map(i => i.name)
      )].slice(0, 8)
    : []

  useEffect(() => { load() }, [])

  // Возврат на магазин (из формы «+», из карточки товара) — тихо обновляем
  // список без спиннера, чтобы только что выставленный товар сразу был виден.
  // Пока не закончилась первая загрузка (load() ставит флаг), focus
  // пропускаем — не завязываемся на то, придёт ли focus при монтировании.
  const loadedOnceRef = useRef(false)
  useEffect(() => navigation.addListener('focus', async () => {
    if (!loadedOnceRef.current) return
    try {
      const res = await products.getAll()
      setItems(Array.isArray(res.data) ? res.data : (res.data.products || []))
    } catch (e) {}
  }), [navigation])

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
    loadedOnceRef.current = true
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
    if (!(matchSearch && matchFilter)) return false
    if (adv.category && (item.category || 'FIGURE') !== adv.category) return false
    const price = effectivePrice(item)
    if (adv.priceFrom && price < Number(adv.priceFrom)) return false
    if (adv.priceTo && price > Number(adv.priceTo)) return false
    if (adv.myCity && (!item.seller?.city || normCity(item.seller.city) !== normCity(user?.city))) return false
    return true
  })
  // Сервер отдаёт новые сверху — «Сначала новые» это исходный порядок
  if (adv.sort === 'cheap') filtered.sort((a, b) => effectivePrice(a) - effectivePrice(b))
  if (adv.sort === 'expensive') filtered.sort((a, b) => effectivePrice(b) - effectivePrice(a))

  function getBadge(item) {
    if (item.status && item.status !== 'AVAILABLE') {
      return STATUS_BADGE[item.status] || { label: item.condition === 'USED' ? 'Б/у' : 'Новый', color: null }
    }
    return { label: item.condition === 'USED' ? 'Б/у' : 'Новый', color: null }
  }

  function getBadgeStyle(item) {
    const badge = getBadge(item)
    if (badge.color) return { borderColor: `${badge.color}80` }
    if (item.condition === 'USED') return s.badgeUsed
    return s.badgeNew
  }

  if (loading) return (
    <View style={[s.center, { paddingTop: insets.top }]}>
      <ActivityIndicator color={colors.accent} size="large" />
      <Text style={s.loadingText}>Загружаем коллекцию...</Text>
      {slowLoad && (
        <Text style={s.slowText}>Сервер просыпается, подождите немного...</Text>
      )}
    </View>
  )

  if (error) return (
    <View style={[s.center, { paddingTop: insets.top }]}>
      <WifiOff size={40} color={colors.text2} strokeWidth={1.6} style={{ marginBottom: 8 }} />
      <Text style={s.errorTitle}>Нет соединения</Text>
      <Text style={s.errorSub}>{error}</Text>
      <TouchableOpacity style={s.retryBtn} onPress={load}>
        <IconLabel icon={RotateCw} label="Повторить" textStyle={s.retryText} />
      </TouchableOpacity>
    </View>
  )

  return (
    <ScreenBackground style={s.wrap}>
      <BrandHeader insets={insets} />
      {/* Верхний ряд (20.10.2026, упрощение магазина): компактная кнопка
          «Новости» (бывшая «Анонсы новых фигурок», ведёт на тот же экран
          анонсов). «Библиотека» убрана — раздел закрыт; «+» переехал в
          нижнее меню кнопкой «Продать», свои товары — «Моё → Объявления» */}
      <View style={s.topRow}>
        <TouchableOpacity style={s.newsBtn} onPress={() => navigation.navigate('Releases')}>
          <IconLabel icon={CalendarDays} label="Новости" size={14} gap={5} textStyle={s.newsBtnText} />
        </TouchableOpacity>
      </View>

      {/* Поиск + «Фильтры» */}
      <View style={s.searchRow}>
      <Animated.View style={[s.searchWrap, { opacity: searchAnim }]}>
        <Search size={17} color={colors.text2} strokeWidth={2} />
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={t => { setSearch(t); setShowSuggestions(t.trim().length >= 2) }}
          onFocus={() => setShowSuggestions(search.trim().length >= 2)}
          placeholder="Поиск по названию или производителю..."
          placeholderTextColor={colors.text2}
        />
        {search ? (
          <TouchableOpacity onPress={() => { setSearch(''); setShowSuggestions(false) }}>
            <X size={18} color={colors.text2} style={s.searchClear} />
          </TouchableOpacity>
        ) : null}
      </Animated.View>
        <TouchableOpacity style={[s.filtersBtn, advCount > 0 && s.filtersBtnOn]} onPress={() => setFiltersOpen(true)} accessibilityLabel="Фильтры">
          <SlidersHorizontal size={20} color={advCount > 0 ? colors.accent : colors.text} strokeWidth={2} />
          {advCount > 0 ? <View style={s.filtersBadge}><Text style={s.filtersBadgeText}>{advCount}</Text></View> : null}
        </TouchableOpacity>
      </View>
      <ShopFilters
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        value={adv}
        onChange={patch => setAdv(prev => ({ ...prev, ...patch }))}
        onReset={() => setAdv(EMPTY_FILTERS)}
        resultCount={filtered.length}
        userCity={user?.city?.trim() || null}
      />

      {/* Дропдаун автодополнения по названию — обычный поток, отодвигает
          фильтры/сетку под собой вместо абсолютного оверлея */}
      {showSuggestions && nameSuggestions.length > 0 && (
        <View style={s.suggestDropdown}>
          {nameSuggestions.map((name, i) => (
            <TouchableOpacity
              key={`${name}-${i}`}
              style={[s.suggestItem, i === nameSuggestions.length - 1 && s.suggestItemLast]}
              onPress={() => { setSearch(name); setShowSuggestions(false) }}
            >
              <Text style={s.suggestItemText}>{name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

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
              <IconLabel icon={f.icon} label={f.label} size={14} gap={5} textStyle={[s.filterText, filter === f.value && s.filterTextActive]} />
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
            {search
              ? <SearchX size={44} color={colors.text2} strokeWidth={1.5} style={s.emptyIcon} />
              : <Package size={44} color={colors.text2} strokeWidth={1.5} style={s.emptyIcon} />}
            <Text style={s.emptyTitle}>{search || advCount ? 'Ничего не найдено' : 'Товаров пока нет'}</Text>
            <Text style={s.emptySub}>
              {search ? `По запросу "${search}" ничего нет` : advCount ? 'Под выбранные фильтры ничего не подошло' : 'Загляни позже'}
            </Text>
            {search ? (
              <TouchableOpacity style={s.clearSearchBtn} onPress={() => setSearch('')}>
                <Text style={s.clearSearchText}>Очистить поиск</Text>
              </TouchableOpacity>
            ) : null}
            {advCount ? (
              <TouchableOpacity style={s.clearSearchBtn} onPress={() => setAdv(EMPTY_FILTERS)}>
                <Text style={s.clearSearchText}>Сбросить фильтры</Text>
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
                  : <Package size={44} color={colors.border} strokeWidth={1.5} />
                }
                {item.isAuction ? (
                  <View style={s.auctionBadge}>
                    <IconLabel icon={Gavel} label="АУКЦИОН" size={11} gap={4} textStyle={s.auctionBadgeText} />
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
                {/* Город продавца — фигурки часто передают при встрече */}
                {item.seller?.city ? (
                  <View style={s.cardCityRow}>
                    <MapPin size={11} color={colors.text2} strokeWidth={2} />
                    <Text style={s.cardCity} numberOfLines={1}>{item.seller.city}</Text>
                  </View>
                ) : null}
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
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 12, marginBottom: 8 },
  searchWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14, paddingVertical: 10, gap: 10,
  },
  filtersBtn: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  filtersBtnOn: { borderColor: colors.accent },
  filtersBadge: { position: 'absolute', top: -5, right: -5, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center' },
  filtersBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  searchInput: { flex: 1, color: colors.text, fontSize: 14 },
  searchClear: { color: colors.text2, fontSize: 16, padding: 4 },
  suggestDropdown: {
    backgroundColor: colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border,
    marginHorizontal: 12, marginTop: -4, marginBottom: 8,
    overflow: 'hidden',
  },
  suggestItem: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  suggestItemLast: { borderBottomWidth: 0 },
  suggestItemText: { fontSize: 14, color: colors.text },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 12, marginTop: 8, marginBottom: 4 },
  newsBtn: { height: 34, justifyContent: 'center', backgroundColor: `${colors.blue}15`, borderRadius: 17, borderWidth: 1, borderColor: `${colors.blue}30`, paddingHorizontal: 12 },
  newsBtnText: { fontSize: 13, fontWeight: '600', color: colors.blue },
  filtersWrap: { marginBottom: 4 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  filterBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterText: { fontSize: 13, fontWeight: '600', color: colors.text2 },
  filterTextActive: { color: 'white' },
  list: { padding: 12, paddingBottom: 24 },
  // Ровный отступ 12 между карточками (он же заложен в cardWidth). Раньше
  // стоял space-between — неполный ряд на широком экране разъезжался
  // по краям (2 товара при 5 колонках — слева и справа, дыра посередине)
  row: { gap: 12 },
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
  auctionBadge: { position: 'absolute', top: 10, right: 10, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: 'rgba(10,11,14,0.8)', borderWidth: 1, borderColor: '#FF6B0080' },
  auctionBadgeText: { fontSize: 10, fontWeight: '800', color: '#FF6B00' },
  badge: { position: 'absolute', top: 10, right: 10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, backgroundColor: 'rgba(10,11,14,0.8)' },
  badgeNew: { borderColor: 'rgba(42,170,96,0.6)' },
  badgeUsed: { borderColor: 'rgba(139,79,212,0.6)' },
  badgeText: { fontSize: 10, fontWeight: '700', color: colors.text },
  cardBody: { padding: 12 },
  cardName: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 4, lineHeight: 19 },
  cardMfr: { fontSize: 11, color: colors.text2, marginBottom: 8 },
  cardCityRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: -4, marginBottom: 8 },
  cardCity: { flexShrink: 1, fontSize: 11, color: colors.text2 },
  cardPrice: { fontSize: 16, fontWeight: '800', color: colors.accent },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyIcon: { marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: colors.text, marginBottom: 8 },
  emptySub: { fontSize: 14, color: colors.text2, textAlign: 'center' },
  clearSearchBtn: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  clearSearchText: { color: colors.accent, fontSize: 14, fontWeight: '600' },
})