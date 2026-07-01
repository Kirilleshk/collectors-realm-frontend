import React, { useState, useEffect, useMemo } from 'react'
import { View, Text, Image, FlatList, StyleSheet, ActivityIndicator, RefreshControl, Pressable, Alert, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { LinearGradient } from 'expo-linear-gradient'
import { game } from '../api'
import { colors } from '../theme'
import { RARITY, rarityFrameStyle, RarityInnerRing, RarityCorners, cardIcon } from '../utils/cardArt'
import StarterPackModal from '../utils/StarterPackModal'

const SORT_OPTIONS = [
  { key: 'default', label: 'Как получены' },
  { key: 'rarity', label: 'По редкости' },
]

export default function GameScreen() {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation()
  const [userCards, setUserCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [startingBattle, setStartingBattle] = useState(false)
  const [claimingStarter, setClaimingStarter] = useState(false)
  const [claimError, setClaimError] = useState(null)
  const [starterGrant, setStarterGrant] = useState(null)
  const [sortBy, setSortBy] = useState('default')
  const [themeArt, setThemeArt] = useState(null)

  useEffect(() => { load() }, [])

  // Бэкенд (GET /api/cards/my) уже отдаёт карты отсортированными по редкости
  // (orderBy card.rarity desc) — поэтому "по умолчанию" сортируем по дате
  // получения, иначе чип "По редкости" всегда выглядел бы no-op (оба режима
  // показывали бы один и тот же порядок)
  const sortedCards = useMemo(() => {
    const arr = [...userCards]
    if (sortBy === 'rarity') {
      arr.sort((a, b) => {
        const ta = (RARITY[a.card.rarity] || RARITY.COMMON).tier
        const tb = (RARITY[b.card.rarity] || RARITY.COMMON).tier
        return tb - ta
      })
    } else {
      arr.sort((a, b) => new Date(a.obtainedAt) - new Date(b.obtainedAt))
    }
    return arr
  }, [userCards, sortBy])

  async function load() {
    try {
      const res = await game.getMyCards()
      setUserCards(Array.isArray(res.data) ? res.data : [])
    } catch (e) { console.error(e) }
    try {
      const themes = await game.getThemes()
      const list = Array.isArray(themes.data) ? themes.data : []
      if (list[0]?.bossImageUrl) setThemeArt(list[0].bossImageUrl)
    } catch (e) { /* фон не критичен, тихо пропускаем */ }
    setLoading(false)
  }

  async function onRefresh() { setRefreshing(true); await load(); setRefreshing(false) }

  async function onClaimStarter() {
    setClaimingStarter(true)
    setClaimError(null)
    try {
      const starter = await game.claimStarter()
      const data = Array.isArray(starter.data) ? starter.data : []
      if (starter.status === 201) setStarterGrant(data)
      setUserCards(data)
    } catch (e) {
      // Alert.alert — no-op в веб-сборке (react-native-web), поэтому
      // ошибку дублируем видимым текстом под кнопкой
      const msg = e?.response
        ? 'Не удалось получить стартовый набор. Попробуйте ещё раз.'
        : 'Сервер долго отвечает (Render просыпается до минуты) — подождите и нажмите ещё раз.'
      Alert.alert('Ошибка', msg)
      setClaimError(msg)
    }
    setClaimingStarter(false)
  }

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
      {!!themeArt && (
        <Image source={{ uri: themeArt }} style={s.backdrop} resizeMode="cover" blurRadius={Platform.OS === 'android' ? 12 : 30} pointerEvents="none" />
      )}
      <View pointerEvents="none" style={s.backdropOverlay} />
      <FlatList
        data={sortedCards}
        keyExtractor={uc => uc.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12 }}
        contentContainerStyle={[s.list, { paddingBottom: 24 + insets.bottom }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        ListHeaderComponent={
          <View style={s.header}>
            <Text style={s.headerTitle}>🃏 Карты Чужой против Хищника</Text>
            <Text style={s.headerSub}>{userCards.length} карт в коллекции</Text>
            {userCards.length > 0 && (
              <View style={s.sortRow}>
                {SORT_OPTIONS.map(opt => (
                  <Pressable
                    key={opt.key}
                    style={[s.sortChip, sortBy === opt.key && s.sortChipActive]}
                    onPress={() => setSortBy(opt.key)}
                  >
                    <Text style={[s.sortChipText, sortBy === opt.key && s.sortChipTextActive]}>{opt.label}</Text>
                  </Pressable>
                ))}
              </View>
            )}
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
            <Text style={s.emptySub}>Получите стартовый набор из 10 карт, чтобы начать игру</Text>
            <Pressable
              style={({ pressed }) => [s.claimBtn, pressed && { opacity: 0.8 }]}
              onPress={onClaimStarter}
              disabled={claimingStarter}
            >
              {claimingStarter
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.claimBtnText}>🎁 Получить стартовый набор</Text>}
            </Pressable>
            {claimError ? <Text style={s.claimErrorText}>{claimError}</Text> : null}
          </View>
        }
        renderItem={({ item }) => {
          const card = item.card
          const r = RARITY[card.rarity] || RARITY.COMMON
          const frame = rarityFrameStyle(card.rarity)
          return (
            <View style={[s.card, frame, { borderColor: r.color }]}>
              <View style={s.artArea}>
                {card.imageUrl
                  ? <Image source={{ uri: card.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  : <View style={[StyleSheet.absoluteFill, s.artFallback, { backgroundColor: `${r.color}22` }]}><Text style={s.artFallbackIcon}>{cardIcon(card)}</Text></View>}
                <LinearGradient colors={['transparent', 'rgba(10,11,14,0.92)']} locations={[0.4, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />

                <View style={[s.costBadge, { backgroundColor: colors.blue }]}><Text style={s.costBadgeText}>{card.cost}</Text></View>
                <View style={[s.rarityBadge, { backgroundColor: `${r.color}30`, borderColor: r.color }]}>
                  <Text style={[s.rarityText, { color: r.color }]}>{r.label}</Text>
                </View>
                {item.quantity > 1 ? <View style={s.qtyBadge}><Text style={s.qtyBadgeText}>×{item.quantity}</Text></View> : null}

                <Text style={s.cardName} numberOfLines={2}>{card.name}</Text>
                <View style={s.medallionsRow}>
                  <View style={[s.medallion, { backgroundColor: colors.blue }]}><Text style={s.medallionText}>{card.attack}</Text></View>
                  <View style={[s.medallion, { backgroundColor: colors.accent }]}><Text style={s.medallionText}>{card.health}</Text></View>
                </View>

                <RarityInnerRing rarity={card.rarity} borderRadius={14} />
                <RarityCorners rarity={card.rarity} />
              </View>
              {card.effectText ? <Text style={s.effectText} numberOfLines={3}>{card.effectText}</Text> : null}
            </View>
          )
        }}
      />
      <StarterPackModal cards={starterGrant} onClose={() => setStarterGrant(null)} />
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.5 },
  backdropOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(10,11,14,0.55)' },
  list: { padding: 16 },
  header: { marginBottom: 16 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 4 },
  headerSub: { fontSize: 13, color: colors.text2, marginBottom: 12 },
  battleBtn: { backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  battleBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  sortRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  sortChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border },
  sortChipActive: { backgroundColor: `${colors.accent}22`, borderColor: colors.accent },
  sortChipText: { fontSize: 12, fontWeight: '600', color: colors.text2 },
  sortChipTextActive: { color: colors.accent, fontWeight: '700' },
  card: { flex: 1, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1.5, overflow: 'hidden', marginBottom: 12 },
  artArea: { height: 150 },
  artFallback: { alignItems: 'center', justifyContent: 'center' },
  artFallbackIcon: { fontSize: 40 },
  costBadge: { position: 'absolute', top: 6, left: 6, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.55)' },
  costBadgeText: { fontSize: 12, fontWeight: '800', color: '#fff' },
  rarityBadge: { position: 'absolute', top: 6, right: 6, borderWidth: 1, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  rarityText: { fontSize: 9, fontWeight: '700' },
  cardName: { position: 'absolute', left: 8, right: 8, bottom: 34, fontSize: 13, fontWeight: '800', color: '#fff', lineHeight: 16, textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } },
  medallionsRow: { position: 'absolute', left: 0, right: 0, bottom: 6, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8 },
  medallion: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.6)' },
  medallionText: { fontSize: 12, fontWeight: '800', color: '#fff' },
  effectText: { fontSize: 11, color: colors.text2, lineHeight: 15, padding: 10, minHeight: 50 },
  qtyBadge: { position: 'absolute', top: 34, right: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  qtyBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 6 },
  emptySub: { fontSize: 13, color: colors.text2, textAlign: 'center', paddingHorizontal: 32, marginBottom: 20 },
  claimBtn: { backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 24 },
  claimBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  claimErrorText: { fontSize: 12, color: colors.accent, textAlign: 'center', marginTop: 12, paddingHorizontal: 24 },
})
