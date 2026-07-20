import React, { useState, useEffect, useMemo } from 'react'
import { View, Text, Image, FlatList, StyleSheet, ActivityIndicator, RefreshControl, Pressable, Alert, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { LinearGradient } from 'expo-linear-gradient'
import { game } from '../api'
import { colors } from '../theme'
import { RARITY, FACTION, rarityFrameStyle, RarityInnerRing, CardCorners, cardIcon, ManaBadge, HealthBadge, AttackBadge, nameplateGradient, noCalloutProps, noCalloutStyle } from '../utils/cardArt'
import StarterPackModal from '../utils/StarterPackModal'
import HowToPlayModal from '../utils/HowToPlayModal'

// Коллекция группируется по фракции (по референсу Марка — отдельные группы
// "Хищники"/"Чужие"), внутри группы — по редкости (GOLD → COMMON), при равной
// редкости — по card.order, чтобы порядок был стабильным между обновлениями,
// а не "как получены". Карты без faction (до бэкафилла на бэкенде) попадают
// в отдельную группу "Без фракции", чтобы не потеряться молча.
function buildCollectionRows(userCards) {
  const byFaction = { PREDATOR: [], ALIEN: [], OTHER: [] }
  for (const uc of userCards) {
    const f = uc.card.faction
    ;(byFaction[f] || byFaction.OTHER).push(uc)
  }
  const byRarityThenOrder = (a, b) => {
    const ta = (RARITY[a.card.rarity] || RARITY.COMMON).tier
    const tb = (RARITY[b.card.rarity] || RARITY.COMMON).tier
    if (tb !== ta) return tb - ta
    return (a.card.order ?? 0) - (b.card.order ?? 0)
  }
  byFaction.PREDATOR.sort(byRarityThenOrder)
  byFaction.ALIEN.sort(byRarityThenOrder)
  byFaction.OTHER.sort(byRarityThenOrder)

  const rows = []
  function pushGroup(label, color, cards) {
    if (!cards.length) return
    rows.push({ type: 'header', key: `h-${label}`, label, color })
    for (let i = 0; i < cards.length; i += 2) {
      rows.push({ type: 'row', key: `r-${label}-${i}`, items: cards.slice(i, i + 2) })
    }
  }
  pushGroup('Хищники', FACTION.PREDATOR.color, byFaction.PREDATOR)
  pushGroup('Чужие', FACTION.ALIEN.color, byFaction.ALIEN)
  pushGroup('Без фракции', colors.text2, byFaction.OTHER)
  return rows
}

// Одна карточка коллекции — вынесена из renderItem, т.к. теперь строка данных
// FlatList — это целая пара карт (см. buildCollectionRows), а не одна карта
function CollectionCardTile({ entry }) {
  const card = entry.card
  const r = RARITY[card.rarity] || RARITY.COMMON
  const frame = rarityFrameStyle(card.rarity)
  return (
    <View style={[s.card, frame, noCalloutStyle, { borderColor: r.color }]} {...noCalloutProps}>
      <View style={s.artArea}>
        {card.imageUrl
          ? <Image source={{ uri: card.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          : <View style={[StyleSheet.absoluteFill, s.artFallback, { backgroundColor: `${r.color}22` }]}><Text style={s.artFallbackIcon}>{cardIcon(card)}</Text></View>}
        <LinearGradient {...nameplateGradient(card)} style={StyleSheet.absoluteFill} pointerEvents="none" />

        <View style={s.costBadge}><ManaBadge value={card.cost} size={20} /></View>
        <View style={[s.rarityBadge, { backgroundColor: `${r.color}30`, borderColor: r.color }]}>
          <Text style={[s.rarityText, { color: r.color }]}>{r.label}</Text>
        </View>
        {entry.quantity > 1 ? <View style={s.qtyBadge}><Text style={s.qtyBadgeText}>×{entry.quantity}</Text></View> : null}

        <Text style={s.cardName} numberOfLines={2}>{card.name}</Text>
        <View style={s.medallionsRow}>
          <HealthBadge value={card.health} size={24} />
          <AttackBadge value={card.attack} size={24} />
        </View>

        <RarityInnerRing rarity={card.rarity} borderRadius={14} />
        <CardCorners card={card} />
      </View>
      {card.effectText ? <Text style={s.effectText} numberOfLines={3}>{card.effectText}</Text> : null}
    </View>
  )
}

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
  const [themeArt, setThemeArt] = useState(null)
  const [helpVisible, setHelpVisible] = useState(false)

  useEffect(() => { load() }, [])

  const collectionRows = useMemo(() => buildCollectionRows(userCards), [userCards])

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
      {/* Виньетка темнее у верха (там заголовок/фильтры) и мягче в середине сетки
          карт — сами карточки уже опаковые (colors.surface), фон нужен только
          для атмосферы в промежутках и под шапкой. */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(10,11,14,0.8)', 'rgba(10,11,14,0.5)', 'rgba(10,11,14,0.68)']}
        locations={[0, 0.35, 1]}
        style={s.backdropOverlay}
      />
      <FlatList
        data={collectionRows}
        keyExtractor={row => row.key}
        contentContainerStyle={[s.list, { paddingBottom: 24 + insets.bottom }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        ListHeaderComponent={
          <View style={s.header}>
            <View style={s.headerTop}>
              <Text style={[s.headerTitle, { flex: 1 }]}>🃏 Карты Чужой против Хищника</Text>
              <Pressable style={({ pressed }) => [s.helpBtn, pressed && { opacity: 0.8 }]} onPress={() => setHelpVisible(true)}>
                <Text style={s.helpBtnText}>❔ Как играть</Text>
              </Pressable>
            </View>
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
          if (item.type === 'header') {
            return (
              <View style={s.groupHeader}>
                <View style={[s.groupDot, { backgroundColor: item.color }]} />
                <Text style={[s.groupTitle, { color: item.color }]}>{item.label}</Text>
              </View>
            )
          }
          return (
            <View style={s.row}>
              {item.items.map(entry => (
                <View key={entry.id} style={s.rowSlot}><CollectionCardTile entry={entry} /></View>
              ))}
              {item.items.length < 2 && <View style={s.rowSlot} />}
            </View>
          )
        }}
      />
      <StarterPackModal cards={starterGrant} onClose={() => setStarterGrant(null)} />
      <HowToPlayModal visible={helpVisible} onClose={() => setHelpVisible(false)} />
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.5 },
  backdropOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  list: { padding: 16 },
  header: { marginBottom: 16 },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 4 },
  headerSub: { fontSize: 13, color: colors.text2, marginBottom: 12 },
  helpBtn: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  helpBtnText: { fontSize: 12, fontWeight: '600', color: colors.text2 },
  battleBtn: { backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  battleBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 10 },
  groupDot: { width: 8, height: 8, borderRadius: 4 },
  groupTitle: { fontSize: 14, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  row: { flexDirection: 'row', gap: 12 },
  rowSlot: { flex: 1 },
  card: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1.5, overflow: 'hidden', marginBottom: 12 },
  artArea: { height: 150 },
  artFallback: { alignItems: 'center', justifyContent: 'center' },
  artFallbackIcon: { fontSize: 40 },
  costBadge: { position: 'absolute', top: 3, left: 3 },
  rarityBadge: { position: 'absolute', top: 6, right: 6, borderWidth: 1, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  rarityText: { fontSize: 9, fontWeight: '700' },
  cardName: { position: 'absolute', left: 8, right: 8, bottom: 34, fontSize: 13, fontWeight: '800', color: '#fff', lineHeight: 16, textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } },
  medallionsRow: { position: 'absolute', left: 0, right: 0, bottom: 6, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8 },
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
