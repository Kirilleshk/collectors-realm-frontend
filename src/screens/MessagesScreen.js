import React, { useCallback, useEffect, useState } from 'react'
import { View, Text, Image, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { messages } from '../api'
import { useAuth } from '../AuthContext'
import { colors } from '../theme'
import { refreshUnread } from '../utils/unread'
import ScreenBackground from '../components/ScreenBackground'
import BrandHeader from '../components/BrandHeader'
import IconLabel from '../components/IconLabel'
import { MessageCircle, Package, User, WifiOff, RotateCw } from '../icons'

// «Сообщения» (вкладка нижнего меню, 20.10.2026, этап 3 «как на Авито»):
// все переписки по товарам — и где я покупатель, и где продавец.
// Свежие сверху, непрочитанные — с оранжевым счётчиком.

function formatWhen(date) {
  const d = new Date(date)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })
  }
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'вчера'
  return d.toLocaleDateString('ru', { day: 'numeric', month: 'short' })
}

export default function MessagesScreen({ navigation }) {
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    try {
      const res = await messages.conversations()
      setItems(Array.isArray(res.data) ? res.data : [])
      setError(null)
    } catch (e) {
      setError('Не удалось загрузить сообщения')
    }
    setLoading(false)
  }, [])

  // При каждом возврате на вкладку — свежий список (и счётчик на вкладке)
  useEffect(() => navigation.addListener('focus', () => { load(); refreshUnread() }), [navigation, load])
  useEffect(() => { load() }, [load])

  async function onRefresh() {
    setRefreshing(true); await load(); refreshUnread(); setRefreshing(false)
  }

  return (
    <ScreenBackground style={s.wrap}>
      <BrandHeader insets={insets} />
      <Text style={s.title}>Сообщения</Text>
      {loading ? (
        <View style={s.center}><ActivityIndicator color={colors.accent} size="large" /></View>
      ) : error ? (
        <View style={s.center}>
          <WifiOff size={40} color={colors.text2} strokeWidth={1.6} />
          <Text style={s.emptyTitle}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => { setLoading(true); load() }}>
            <IconLabel icon={RotateCw} label="Повторить" textStyle={s.retryText} />
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={c => c.id}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <MessageCircle size={44} color={colors.text2} strokeWidth={1.5} />
              <Text style={s.emptyTitle}>Сообщений пока нет</Text>
              <Text style={s.emptySub}>
                Нажмите «Написать» в карточке товара — переписка с продавцом появится здесь. Сюда же пишут покупатели ваших объявлений.
              </Text>
            </View>
          }
          renderItem={({ item: c }) => {
            const photo = c.product?.images?.[0]?.url
            const mine = c.lastMessage?.senderId === user?.id
            const unread = c.unread > 0
            return (
              <TouchableOpacity style={s.row} onPress={() => navigation.navigate('Conversation', { id: c.id })} activeOpacity={0.75}>
                {photo
                  ? <Image source={{ uri: photo }} style={s.thumb} resizeMode="cover" />
                  : <View style={[s.thumb, s.thumbEmpty]}><Package size={22} color={colors.border} strokeWidth={1.5} /></View>}
                <View style={s.rowBody}>
                  <View style={s.rowTop}>
                    <View style={s.nameWrap}>
                      {c.other?.avatarUrl
                        ? <Image source={{ uri: c.other.avatarUrl }} style={s.avatar} />
                        : <View style={[s.avatar, s.avatarEmpty]}><User size={11} color={colors.text2} /></View>}
                      <Text style={[s.name, unread && s.nameUnread]} numberOfLines={1}>{c.other?.name || 'Пользователь'}</Text>
                    </View>
                    {c.lastMessageAt ? <Text style={s.when}>{formatWhen(c.lastMessageAt)}</Text> : null}
                  </View>
                  <Text style={s.product} numberOfLines={1}>
                    {c.role === 'seller' ? 'Ваш товар · ' : ''}{c.product?.name || c.productName}
                  </Text>
                  <View style={s.rowBottom}>
                    <Text style={[s.preview, unread && s.previewUnread]} numberOfLines={1}>
                      {mine ? 'Вы: ' : ''}{c.lastMessage?.text || ''}
                    </Text>
                    {unread ? <View style={s.badge}><Text style={s.badgeText}>{c.unread > 99 ? '99+' : c.unread}</Text></View> : null}
                  </View>
                </View>
              </TouchableOpacity>
            )
          }}
        />
      )}
    </ScreenBackground>
  )
}

const s = StyleSheet.create({
  wrap: { flex: 1 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 },
  list: { paddingHorizontal: 12, paddingBottom: 24, width: '100%', maxWidth: 720, alignSelf: 'center' },
  row: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginBottom: 8 },
  thumb: { width: 60, height: 60, borderRadius: 10, backgroundColor: colors.surface2 },
  thumbEmpty: { justifyContent: 'center', alignItems: 'center' },
  rowBody: { flex: 1, gap: 3, justifyContent: 'center' },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nameWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  avatar: { width: 18, height: 18, borderRadius: 9 },
  avatarEmpty: { backgroundColor: colors.surface2, justifyContent: 'center', alignItems: 'center' },
  name: { flexShrink: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  nameUnread: { fontWeight: '800' },
  when: { fontSize: 12, color: colors.text2 },
  product: { fontSize: 12, color: colors.text2 },
  rowBottom: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  preview: { flex: 1, fontSize: 14, color: colors.text2 },
  previewUnread: { color: colors.text, fontWeight: '600' },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center' },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.text, textAlign: 'center' },
  emptySub: { fontSize: 14, color: colors.text2, textAlign: 'center', lineHeight: 20 },
  retryBtn: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.accent },
  retryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
})
