import React, { useState, useEffect } from 'react'
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl, Pressable, Alert } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { game } from '../api'
import { colors } from '../theme'

const RARITY = {
  COMMON: { label: 'Обычная', color: colors.blue },
  EPIC: { label: 'Эпическая', color: colors.purple },
  SILVER: { label: 'Серебряная', color: colors.silver },
  GOLD: { label: 'Золотая', color: colors.gold },
}

export default function GameScreen() {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation()
  const [userCards, setUserCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [startingBattle, setStartingBattle] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const res = await game.getMyCards()
      let data = Array.isArray(res.data) ? res.data : []
      if (data.length === 0) {
        const starter = await game.claimStarter()
        data = Array.isArray(starter.data) ? starter.data : []
      }
      setUserCards(data)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  async function onRefresh() { setRefreshing(true); await load(); setRefreshing(false) }

  async function onStartBattle() {
    setStartingBattle(true)
    try {
      const res = await game.startBattle()
      navigation.navigate('Battle', { battleId: res.data.battle.id })
    } catch (e) {
      Alert.alert('Ошибка', 'Не удалось начать бой. Попробуйте ещё раз.')
    }
    setStartingBattle(false)
  }

  if (loading) return <View style={s.center}><ActivityIndicator color={colors.accent} size="large" /></View>

  return (
    <View style={s.wrap}>
      <FlatList
        data={userCards}
        keyExtractor={uc => uc.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12 }}
        contentContainerStyle={[s.list, { paddingBottom: 24 + insets.bottom }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        ListHeaderComponent={
          <View style={s.header}>
            <Text style={s.headerTitle}>🃏 Карты Чужой против Хищника</Text>
            <Text style={s.headerSub}>{userCards.length} карт в коллекции</Text>
            <Pressable
              style={({ pressed }) => [s.battleBtn, pressed && { opacity: 0.8 }]}
              onPress={onStartBattle}
              disabled={startingBattle}
            >
              {startingBattle
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.battleBtnText}>⚔️ Бой с боссом</Text>}
            </Pressable>
          </View>
        }
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyIcon}>🎴</Text>
            <Text style={s.emptyTitle}>Коллекция пуста</Text>
            <Text style={s.emptySub}>Потяните вниз, чтобы получить стартовый набор карт</Text>
          </View>
        }
        renderItem={({ item }) => {
          const card = item.card
          const r = RARITY[card.rarity] || RARITY.COMMON
          return (
            <View style={[s.card, { borderColor: r.color }]}>
              <View style={[s.rarityBadge, { backgroundColor: `${r.color}25`, borderColor: r.color }]}>
                <Text style={[s.rarityText, { color: r.color }]}>{r.label}</Text>
              </View>
              <Text style={s.cardName} numberOfLines={2}>{card.name}</Text>
              <View style={s.statsRow}>
                <Text style={s.statText}>⚔️ {card.attack}</Text>
                <Text style={s.statText}>❤️ {card.health}</Text>
                <Text style={s.statText}>💧 {card.cost}</Text>
              </View>
              {card.effectText ? <Text style={s.effectText} numberOfLines={3}>{card.effectText}</Text> : null}
              {item.quantity > 1 ? <Text style={s.qtyBadge}>×{item.quantity}</Text> : null}
            </View>
          )
        }}
      />
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16 },
  header: { marginBottom: 16 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 4 },
  headerSub: { fontSize: 13, color: colors.text2, marginBottom: 12 },
  battleBtn: { backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  battleBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  card: { flex: 1, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1.5, padding: 12, marginBottom: 12, minHeight: 150 },
  rarityBadge: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 8 },
  rarityText: { fontSize: 10, fontWeight: '700' },
  cardName: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 8 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  statText: { fontSize: 12, color: colors.text2, fontWeight: '600' },
  effectText: { fontSize: 11, color: colors.text2, lineHeight: 15 },
  qtyBadge: { position: 'absolute', top: 10, right: 10, fontSize: 12, fontWeight: '700', color: colors.text },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 6 },
  emptySub: { fontSize: 13, color: colors.text2, textAlign: 'center', paddingHorizontal: 32 },
})
