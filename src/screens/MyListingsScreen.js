import React, { useCallback, useEffect, useState } from 'react'
import { View, Text, Image, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Platform, Alert } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { products } from '../api'
import { useAuth } from '../AuthContext'
import { colors } from '../theme'
import { showNotice } from '../utils/notice'
import IconLabel from '../components/IconLabel'
import { Package, Pencil, CircleCheck, RotateCw, Trash2, Plus, WifiOff } from '../icons'

// «Мои объявления» — вкладка «Моё» (20.10.2026, как на Авито): все товары,
// которые человек выставил, с кнопками прямо на карточке. Раньше свои товары
// искались фильтром «Мои» в общем магазине, а управлять ими можно было
// только из карточки товара.
// Персонал выставляет товары от имени магазина (sellerId = null) — у него
// здесь товары магазина.

const SECTIONS = [
  { key: 'active', label: 'В продаже' },
  { key: 'sold', label: 'Проданные' },
]

// Подтверждение: Alert.alert с кнопками в вебе — пустая заглушка
function confirmAction(title, text, okLabel, onOk) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${text}`)) onOk()
    return
  }
  Alert.alert(title, text, [
    { text: 'Отмена', style: 'cancel' },
    { text: okLabel, style: 'destructive', onPress: onOk },
  ])
}

export default function MyListingsScreen() {
  const navigation = useNavigation()
  const { user } = useAuth()
  const isStaff = user?.roles?.some(r => r === 'ADMIN' || r === 'MODERATOR')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [section, setSection] = useState('active')
  const [busyId, setBusyId] = useState(null)

  const isMine = useCallback(
    p => (isStaff ? !p.sellerId : !!p.sellerId && p.sellerId === user?.id),
    [isStaff, user?.id],
  )

  const load = useCallback(async () => {
    try {
      const res = await products.getAll()
      const all = Array.isArray(res.data) ? res.data : (res.data.products || [])
      setItems(all.filter(isMine))
      setError(null)
    } catch (e) {
      setError('Не удалось загрузить объявления')
    }
    setLoading(false)
  }, [isMine])

  // Перечитываем при каждом возврате на «Моё» — после публикации, правки
  // или удаления из карточки товара список сразу актуален
  useEffect(() => { load() }, [load])
  useEffect(() => navigation.addListener('focus', load), [navigation, load])

  async function onRefresh() {
    setRefreshing(true); await load(); setRefreshing(false)
  }

  async function toggleSold(item) {
    const next = item.status === 'SOLD' ? 'AVAILABLE' : 'SOLD'
    setBusyId(item.id)
    try {
      await products.setStatus(item.id, next)
      setItems(prev => prev.map(p => (p.id === item.id ? { ...p, status: next } : p)))
      showNotice(next === 'SOLD' ? 'Отмечено проданным' : 'Снова в продаже')
    } catch (e) {
      showNotice(e.response?.data?.error || 'Не удалось изменить статус')
    }
    setBusyId(null)
  }

  function remove(item) {
    confirmAction('Удалить объявление?', `«${item.name}» пропадёт из магазина, вернуть его будет нельзя.`, 'Удалить', async () => {
      setBusyId(item.id)
      try {
        await products.remove(item.id)
        setItems(prev => prev.filter(p => p.id !== item.id))
        showNotice('Объявление удалено')
      } catch (e) {
        showNotice(e.response?.data?.error || 'Не удалось удалить')
      }
      setBusyId(null)
    })
  }

  const active = items.filter(p => p.status !== 'SOLD')
  const sold = items.filter(p => p.status === 'SOLD')
  const shown = section === 'active' ? active : sold

  if (loading) return <View style={s.center}><ActivityIndicator color={colors.accent} size="large" /></View>

  if (error) return (
    <View style={s.center}>
      <WifiOff size={40} color={colors.text2} strokeWidth={1.6} />
      <Text style={s.emptyTitle}>{error}</Text>
      <TouchableOpacity style={s.primaryBtn} onPress={() => { setLoading(true); load() }}>
        <IconLabel icon={RotateCw} label="Повторить" textStyle={s.primaryBtnText} />
      </TouchableOpacity>
    </View>
  )

  return (
    <View style={s.wrap}>
      <View style={s.sections}>
        {SECTIONS.map(sec => {
          const count = sec.key === 'active' ? active.length : sold.length
          const on = section === sec.key
          return (
            <TouchableOpacity key={sec.key} style={[s.sectionBtn, on && s.sectionBtnOn]} onPress={() => setSection(sec.key)}>
              <Text style={[s.sectionText, on && s.sectionTextOn]}>{sec.label} · {count}</Text>
            </TouchableOpacity>
          )
        })}
      </View>

      <FlatList
        data={shown}
        keyExtractor={p => p.id}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Package size={44} color={colors.text2} strokeWidth={1.5} />
            <Text style={s.emptyTitle}>
              {section === 'active' ? 'У вас нет объявлений в продаже' : 'Проданных пока нет'}
            </Text>
            {section === 'active' ? (
              <>
                <Text style={s.emptySub}>Нажмите «Продать» внизу экрана — фигурка сразу появится в магазине</Text>
                <TouchableOpacity style={s.primaryBtn} onPress={() => navigation.navigate('SellProduct')}>
                  <IconLabel icon={Plus} label="Разместить объявление" textStyle={s.primaryBtnText} />
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const busy = busyId === item.id
          const isSold = item.status === 'SOLD'
          return (
            <View style={s.card}>
              <TouchableOpacity style={s.cardTop} onPress={() => navigation.navigate('ProductDetail', { id: item.id })} activeOpacity={0.8}>
                {item.images?.[0]?.url
                  ? <Image source={{ uri: item.images[0].url }} style={s.thumb} resizeMode="cover" />
                  : <View style={[s.thumb, s.thumbEmpty]}><Package size={26} color={colors.border} strokeWidth={1.5} /></View>}
                <View style={s.cardInfo}>
                  <Text style={s.cardName} numberOfLines={2}>{item.name}</Text>
                  <Text style={s.cardPrice}>
                    {item.isAuction ? `от ${(item.startPrice || item.price)?.toLocaleString('ru')} ₽` : `${item.price?.toLocaleString('ru')} ₽`}
                  </Text>
                  <Text style={[s.cardStatus, isSold && { color: colors.text2 }]}>{isSold ? 'Продано' : 'В продаже'}</Text>
                </View>
              </TouchableOpacity>
              {/* Аукцион правится только в админке — в форме нет его полей */}
              {item.isAuction ? (
                <Text style={s.auctionNote}>Аукцион — изменить можно во вкладке «Админ»</Text>
              ) : (
                <View style={s.actions}>
                  <TouchableOpacity style={[s.actionBtn, s.actionBtnGrow]} onPress={() => navigation.navigate('SellProduct', { product: item })} disabled={busy}>
                    <IconLabel icon={Pencil} label="Изменить" size={15} textStyle={s.actionText} />
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.actionBtn, s.actionBtnGrow]} onPress={() => toggleSold(item)} disabled={busy}>
                    {busy
                      ? <ActivityIndicator color={colors.text} size="small" />
                      : <IconLabel icon={isSold ? RotateCw : CircleCheck} label={isSold ? 'Вернуть' : 'Продано'} size={15} textStyle={[s.actionText, !isSold && { color: colors.green }]} />}
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.actionBtn, s.actionBtnIcon]} onPress={() => remove(item)} disabled={busy} accessibilityLabel="Удалить объявление">
                    <Trash2 size={17} color={colors.red} strokeWidth={2} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )
        }}
      />
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 },
  sections: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  sectionBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  sectionBtnOn: { backgroundColor: `${colors.accent}20`, borderColor: colors.accent },
  sectionText: { fontSize: 13, fontWeight: '600', color: colors.text2 },
  sectionTextOn: { color: colors.accent },
  list: { padding: 16, gap: 12, paddingBottom: 32, width: '100%', maxWidth: 720, alignSelf: 'center' },
  card: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 12 },
  cardTop: { flexDirection: 'row', gap: 12 },
  thumb: { width: 84, height: 84, borderRadius: 12, backgroundColor: colors.surface2 },
  thumbEmpty: { justifyContent: 'center', alignItems: 'center' },
  cardInfo: { flex: 1, justifyContent: 'center', gap: 4 },
  cardName: { fontSize: 15, fontWeight: '700', color: colors.text, lineHeight: 20 },
  cardPrice: { fontSize: 16, fontWeight: '800', color: colors.accent },
  cardStatus: { fontSize: 12, fontWeight: '600', color: colors.green },
  actions: { flexDirection: 'row', gap: 8 },
  // Без flex в базовом стиле: flex: 0 в вебе обнулял ширину кнопки-корзины
  actionBtn: { minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border },
  actionBtnGrow: { flex: 1 },
  actionBtnIcon: { width: 48 },
  actionText: { fontSize: 13, fontWeight: '700', color: colors.text },
  auctionNote: { fontSize: 12, color: colors.text2 },
  empty: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 24, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text, textAlign: 'center' },
  emptySub: { fontSize: 13, color: colors.text2, textAlign: 'center', lineHeight: 19 },
  primaryBtn: { marginTop: 8, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.accent },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
})
