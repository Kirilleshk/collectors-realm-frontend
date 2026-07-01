import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native'
import { notifications as notifApi } from '../api'
import { colors } from '../theme'
import ScreenBackground from '../components/ScreenBackground'

const TYPE_CONFIG = {
  MONTHLY_REPORT: { icon: '📊', color: colors.blue },
  YEARLY_REPORT:  { icon: '🏆', color: colors.purple },
  PRICE_DROP:     { icon: '💰', color: colors.green },
  WISHLIST_MATCH: { icon: '🎯', color: colors.accent },
  NEW_PRODUCT:    { icon: '🛍', color: colors.blue },
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return 'только что'
  if (mins < 60) return `${mins} мин. назад`
  if (hours < 24) return `${hours} ч. назад`
  if (days < 30) return `${days} дн. назад`
  return new Date(dateStr).toLocaleDateString('ru')
}

export default function NotificationsScreen({ navigation }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await notifApi.getAll()
      setItems(res.data.items || [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [])

  async function onRefresh() { setRefreshing(true); await load(); setRefreshing(false) }

  async function handleTap(item) {
    if (!item.read) {
      await notifApi.markRead(item.id).catch(() => {})
      setItems(prev => prev.map(n => n.id === item.id ? { ...n, read: true } : n))
    }
    const data = item.data
    if (data?.productId) {
      navigation.navigate('ProductDetail', { id: data.productId })
    }
  }

  async function markAllRead() {
    await notifApi.markAllRead().catch(() => {})
    setItems(prev => prev.map(n => ({ ...n, read: true })))
  }

  const unread = items.filter(n => !n.read).length

  if (loading) return (
    <View style={s.center}><ActivityIndicator color={colors.accent} size="large" /></View>
  )

  return (
    <ScreenBackground style={s.wrap}>
      {unread > 0 && (
        <TouchableOpacity style={s.markAllBtn} onPress={markAllRead}>
          <Text style={s.markAllText}>Отметить все прочитанными ✓</Text>
        </TouchableOpacity>
      )}
      <FlatList
        data={items}
        keyExtractor={n => n.id}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyIcon}>🔔</Text>
            <Text style={s.emptyTitle}>Уведомлений нет</Text>
            <Text style={s.emptySub}>Здесь будут отчёты о коллекции и уведомления о снижении цен</Text>
          </View>
        }
        renderItem={({ item: n }) => {
          const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.NEW_PRODUCT
          return (
            <TouchableOpacity
              style={[s.card, !n.read && s.cardUnread]}
              onPress={() => handleTap(n)}
              activeOpacity={0.8}
            >
              <View style={[s.iconWrap, { backgroundColor: `${cfg.color}20` }]}>
                <Text style={s.icon}>{cfg.icon}</Text>
                {!n.read && <View style={s.dot} />}
              </View>
              <View style={s.cardBody}>
                <Text style={s.cardTitle}>{n.title}</Text>
                <Text style={s.cardDesc} numberOfLines={n.type.includes('REPORT') ? 6 : 2}>{n.body}</Text>
                <Text style={s.cardTime}>{timeAgo(n.createdAt)}</Text>
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  markAllBtn: { padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: 'flex-end', paddingHorizontal: 20 },
  markAllText: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  list: { padding: 16, gap: 10 },
  card: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 12 },
  cardUnread: { borderColor: `${colors.accent}40`, backgroundColor: `${colors.accent}08` },
  iconWrap: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', position: 'relative', flexShrink: 0 },
  icon: { fontSize: 22 },
  dot: { position: 'absolute', top: -3, right: -3, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent, borderWidth: 2, borderColor: colors.bg },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 4 },
  cardDesc: { fontSize: 13, color: colors.text2, lineHeight: 19, marginBottom: 6 },
  cardTime: { fontSize: 11, color: colors.text2 },
  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: colors.text, marginBottom: 8 },
  emptySub: { fontSize: 14, color: colors.text2, textAlign: 'center', lineHeight: 20 },
})
