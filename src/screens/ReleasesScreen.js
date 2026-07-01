import React, { useState, useEffect } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image, RefreshControl
} from 'react-native'
import { news as newsApi } from '../api'
import { colors } from '../theme'
import ScreenBackground from '../components/ScreenBackground'

function FeedCard({ item }) {
  const date = new Date(item.date)
  const dateStr = date.toLocaleDateString('ru', { day: 'numeric', month: 'long' })
  const timeStr = date.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })

  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <View style={s.avatar}>
          <Text style={{ fontSize: 18 }}>🗿</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.channelName}>Collector's Realm</Text>
          <Text style={s.date}>{dateStr} в {timeStr}</Text>
        </View>
      </View>

      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={s.img} resizeMode="cover" />
      ) : null}

      {item.text ? (
        <Text style={[s.text, item.imageUrl && { paddingTop: 10 }]}>{item.text}</Text>
      ) : null}
    </View>
  )
}

export default function ReleasesScreen() {
  const [feed, setFeed] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => { loadFeed() }, [])

  async function loadFeed(refresh = false) {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const res = await newsApi.getAll()
      const d = res.data
      const items = Array.isArray(d) ? d : (Array.isArray(d?.items) ? d.items : [])
      setFeed(items)
      setHasMore(typeof d?.hasMore === 'boolean' ? d.hasMore : items.length >= 20)
    } catch (e) {
      setError('Не удалось загрузить ленту')
    }

    setLoading(false)
    setRefreshing(false)
  }

  async function loadMore() {
    if (loadingMore || !hasMore || feed.length === 0) return
    setLoadingMore(true)

    try {
      const oldest = feed[feed.length - 1]
      const beforeNum = oldest?.id?.split('_').pop()
      const res = await newsApi.getAll({ before: beforeNum })
      const d = res.data
      const more = Array.isArray(d) ? d : (Array.isArray(d?.items) ? d.items : [])

      if (more.length === 0) {
        setHasMore(false)
      } else {
        setFeed(prev => [...prev, ...more])
        setHasMore(typeof d?.hasMore === 'boolean' ? d.hasMore : more.length >= 20)
      }
    } catch (e) {}

    setLoadingMore(false)
  }

  if (loading) return (
    <View style={s.center}><ActivityIndicator color={colors.accent} size="large" /></View>
  )

  if (error) return (
    <View style={s.empty}>
      <Text style={s.emptyIcon}>⚙️</Text>
      <Text style={s.emptyTitle}>Лента недоступна</Text>
      <Text style={s.emptySub}>{error}</Text>
      <TouchableOpacity style={s.retryBtn} onPress={() => loadFeed()}>
        <Text style={s.retryText}>Попробовать снова</Text>
      </TouchableOpacity>
    </View>
  )

  return (
    <ScreenBackground>
    <FlatList
      data={feed}
      keyExtractor={i => i.id}
      contentContainerStyle={{ paddingVertical: 8 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => loadFeed(true)} tintColor={colors.accent} />
      }
      onEndReached={loadMore}
      onEndReachedThreshold={0.4}
      ListEmptyComponent={
        <View style={s.empty}>
          <Text style={s.emptyIcon}>📰</Text>
          <Text style={s.emptyTitle}>Постов нет</Text>
          <Text style={s.emptySub}>Потяни вниз чтобы обновить</Text>
        </View>
      }
      ListFooterComponent={
        loadingMore ? (
          <View style={{ paddingVertical: 20, alignItems: 'center' }}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : !hasMore && feed.length > 0 ? (
          <Text style={s.endText}>Это все посты 🗿</Text>
        ) : null
      }
      renderItem={({ item }) => <FeedCard item={item} />}
      ItemSeparatorComponent={() => <View style={s.separator} />}
    />
    </ScreenBackground>
  )
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  card: { backgroundColor: colors.surface, paddingBottom: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#229ED920', borderWidth: 1, borderColor: '#229ED940', justifyContent: 'center', alignItems: 'center' },
  channelName: { fontSize: 14, fontWeight: '700', color: colors.text },
  date: { fontSize: 11, color: colors.text2, marginTop: 1 },
  img: { width: '100%', aspectRatio: 4 / 3 },
  text: { fontSize: 14, color: colors.text, lineHeight: 21, paddingHorizontal: 16, paddingBottom: 14 },

  separator: { height: 1, backgroundColor: colors.border, marginHorizontal: 16 },
  endText: { textAlign: 'center', color: colors.text2, fontSize: 12, paddingVertical: 20 },

  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: colors.text, marginBottom: 8 },
  emptySub: { fontSize: 14, color: colors.text2, textAlign: 'center', lineHeight: 20 },
  retryBtn: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.accent },
  retryText: { color: colors.accent, fontWeight: '600' },
})
