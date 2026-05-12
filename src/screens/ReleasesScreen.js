import React, { useState, useEffect } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Image, RefreshControl, Alert } from 'react-native'
import { releases as releasesApi } from '../api'
import { colors } from '../theme'

function daysUntil(dateStr) {
  const diff = new Date(dateStr) - new Date()
  return Math.ceil(diff / 86400000)
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' })
}

function DaysBadge({ days }) {
  if (days < 0) return <View style={[b.badge, { backgroundColor: '#8E8E9320' }]}><Text style={[b.badgeText, { color: '#8E8E93' }]}>Вышел</Text></View>
  if (days === 0) return <View style={[b.badge, { backgroundColor: `${colors.green}20` }]}><Text style={[b.badgeText, { color: colors.green }]}>Сегодня!</Text></View>
  if (days <= 3) return <View style={[b.badge, { backgroundColor: `${colors.accent}20` }]}><Text style={[b.badgeText, { color: colors.accent }]}>Через {days} дн.</Text></View>
  if (days <= 30) return <View style={[b.badge, { backgroundColor: `${colors.blue}20` }]}><Text style={[b.badgeText, { color: colors.blue }]}>Через {days} дн.</Text></View>
  return <View style={[b.badge, { backgroundColor: colors.surface2 }]}><Text style={[b.badgeText, { color: colors.text2 }]}>{formatDate(new Date(new Date().getTime() + days * 86400000))}</Text></View>
}

const b = StyleSheet.create({
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
})

export default function ReleasesScreen() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [toggling, setToggling] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const res = await releasesApi.getAll()
      setItems(Array.isArray(res.data) ? res.data : [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  async function onRefresh() { setRefreshing(true); await load(); setRefreshing(false) }

  async function handleToggleRemind(item) {
    setToggling(item.id)
    try {
      const res = await releasesApi.toggleRemind(item.id)
      setItems(prev => prev.map(i => i.id === item.id ? {
        ...i,
        hasReminder: res.data.hasReminder,
        reminderCount: res.data.hasReminder ? i.reminderCount + 1 : Math.max(0, i.reminderCount - 1),
      } : i))
    } catch (e) { Alert.alert('Ошибка', 'Не удалось изменить напоминание') }
    setToggling(null)
  }

  if (loading) return <View style={s.center}><ActivityIndicator color={colors.accent} size="large" /></View>

  const upcoming = items.filter(i => daysUntil(i.releaseDate) >= 0)
  const released = items.filter(i => daysUntil(i.releaseDate) < 0)
  const sorted = [...upcoming, ...released]

  return (
    <FlatList
      data={sorted}
      keyExtractor={i => i.id}
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={s.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      ListEmptyComponent={
        <View style={s.empty}>
          <Text style={s.emptyIcon}>📅</Text>
          <Text style={s.emptyTitle}>Анонсов пока нет</Text>
          <Text style={s.emptySub}>Здесь появятся новые фигурки — поставь напоминание чтобы не пропустить</Text>
        </View>
      }
      ListHeaderComponent={
        <Text style={s.header}>📅 Анонсы и релизы</Text>
      }
      renderItem={({ item }) => {
        const days = daysUntil(item.releaseDate)
        const isOut = days < 0
        return (
          <View style={[s.card, isOut && { opacity: 0.6 }]}>
            {item.imageUrl
              ? <Image source={{ uri: item.imageUrl }} style={s.img} resizeMode="cover" />
              : <View style={[s.img, s.imgPlaceholder]}><Text style={{ fontSize: 32 }}>🗿</Text></View>
            }
            <View style={s.cardBody}>
              <View style={s.cardTop}>
                <Text style={s.cardName} numberOfLines={2}>{item.name}</Text>
                <DaysBadge days={days} />
              </View>
              {item.manufacturer ? <Text style={s.cardMfr}>🏭 {item.manufacturer}</Text> : null}
              <Text style={s.cardDate}>📅 {formatDate(item.releaseDate)}</Text>
              {item.description ? <Text style={s.cardDesc} numberOfLines={2}>{item.description}</Text> : null}

              {item.reminderCount > 0 && (
                <Text style={s.reminderCount}>🔔 {item.reminderCount} {item.reminderCount === 1 ? 'человек' : 'человек'} ждут</Text>
              )}

              {!isOut && (
                <TouchableOpacity
                  style={[s.remindBtn, item.hasReminder && s.remindBtnActive]}
                  onPress={() => handleToggleRemind(item)}
                  disabled={toggling === item.id}
                >
                  {toggling === item.id
                    ? <ActivityIndicator color={item.hasReminder ? colors.accent : colors.text2} size="small" />
                    : <Text style={[s.remindText, item.hasReminder && s.remindTextActive]}>
                        {item.hasReminder ? '🔔 Напомнишь' : '🔕 Напомни мне'}
                      </Text>
                  }
                </TouchableOpacity>
              )}
            </View>
          </View>
        )
      }}
    />
  )
}

const s = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, gap: 12 },
  header: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 8 },
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: colors.text, marginBottom: 8 },
  emptySub: { fontSize: 14, color: colors.text2, textAlign: 'center', lineHeight: 20 },
  card: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  img: { width: '100%', height: 160 },
  imgPlaceholder: { backgroundColor: colors.surface2, justifyContent: 'center', alignItems: 'center' },
  cardBody: { padding: 14 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 6 },
  cardName: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.text },
  cardMfr: { fontSize: 12, color: colors.text2, marginBottom: 4 },
  cardDate: { fontSize: 12, color: colors.text2, marginBottom: 6 },
  cardDesc: { fontSize: 13, color: colors.text2, lineHeight: 18, marginBottom: 8 },
  reminderCount: { fontSize: 11, color: colors.text2, marginBottom: 8 },
  remindBtn: { flexDirection: 'row', justifyContent: 'center', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2 },
  remindBtnActive: { borderColor: colors.accent, backgroundColor: `${colors.accent}15` },
  remindText: { fontSize: 13, fontWeight: '600', color: colors.text2 },
  remindTextActive: { color: colors.accent },
})
