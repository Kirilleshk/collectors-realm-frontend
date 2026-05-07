import React, { useState, useEffect } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { products } from '../api'
import { colors } from '../theme'

export default function NotificationsScreen({ navigation }) {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [lastCount, setLastCount] = useState(0)

  useEffect(() => {
    checkNewProducts()
    const interval = setInterval(checkNewProducts, 30000)
    return () => clearInterval(interval)
  }, [])

  async function checkNewProducts() {
    try {
      const res = await products.getAll()
      const data = Array.isArray(res.data) ? res.data : (res.data.products || [])
      const newItems = data.slice(0, 5).map(item => ({
        id: item.id,
        title: '🆕 Новый товар в магазине',
        body: `${item.name} — ${item.price?.toLocaleString('ru')} ₽`,
        time: new Date(),
        item,
        read: false,
      }))
      setNotifications(newItems)
      setLastCount(data.length)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  function markRead(id) {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  function markAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const unreadCount = notifications.filter(n => !n.read).length

  if (loading) return (
    <View style={s.center}>
      <ActivityIndicator color={colors.accent} size="large" />
    </View>
  )

  return (
    <View style={s.wrap}>
      {unreadCount > 0 && (
        <TouchableOpacity style={s.markAllBtn} onPress={markAllRead}>
          <Text style={s.markAllText}>Отметить все прочитанными ✓</Text>
        </TouchableOpacity>
      )}
      <FlatList
        data={notifications}
        keyExtractor={n => n.id}
        contentContainerStyle={s.list}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyIcon}>🔔</Text>
            <Text style={s.emptyTitle}>Уведомлений нет</Text>
            <Text style={s.emptySub}>Мы сообщим когда появятся новые товары</Text>
          </View>
        }
        renderItem={({ item: n }) => (
          <TouchableOpacity
            style={[s.card, !n.read && s.cardUnread]}
            onPress={() => {
              markRead(n.id)
              navigation.navigate('ShopList')
            }}
          >
            <View style={s.cardLeft}>
              <Text style={s.cardIcon}>🛍</Text>
              {!n.read && <View style={s.dot} />}
            </View>
            <View style={s.cardBody}>
              <Text style={s.cardTitle}>{n.title}</Text>
              <Text style={s.cardDesc}>{n.body}</Text>
              <Text style={s.cardTime}>{n.time.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  markAllBtn: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: 'flex-end',
    paddingHorizontal: 20,
  },
  markAllText: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  list: { padding: 16, gap: 10 },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 12,
  },
  cardUnread: {
    borderColor: `${colors.accent}40`,
    backgroundColor: `${colors.accent}08`,
  },
  cardLeft: { alignItems: 'center', gap: 6 },
  cardIcon: { fontSize: 28 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 4 },
  cardDesc: { fontSize: 13, color: colors.text2, marginBottom: 6 },
  cardTime: { fontSize: 11, color: colors.text2 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: colors.text, marginBottom: 8 },
  emptySub: { fontSize: 14, color: colors.text2, textAlign: 'center' },
})