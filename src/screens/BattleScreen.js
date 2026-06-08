import React, { useState, useEffect, useRef } from 'react'
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Pressable, Alert } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { game } from '../api'
import { colors } from '../theme'

const RARITY = {
  COMMON: { label: 'Обычная', color: colors.blue },
  EPIC: { label: 'Эпическая', color: colors.purple },
  SILVER: { label: 'Серебряная', color: colors.silver },
  GOLD: { label: 'Золотая', color: colors.gold },
}

const MANA_CAP = 10

export default function BattleScreen({ route, navigation }) {
  const insets = useSafeAreaInsets()
  const [battle, setBattle] = useState(null)
  const [hand, setHand] = useState([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const logRef = useRef(null)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const res = await game.getActiveBattle()
      let data = res.data
      if (!data) {
        const started = await game.startBattle()
        data = started.data
      }
      setBattle(data.battle)
      setHand(data.userCards)
    } catch (e) {
      Alert.alert('Ошибка', 'Не удалось загрузить бой.')
    }
    setLoading(false)
  }

  function applyResult(data) {
    setBattle(data.battle)
    setHand(data.userCards)
    setTimeout(() => logRef.current?.scrollToEnd({ animated: true }), 100)
  }

  async function onPlayCard(cardId) {
    if (acting || battle.status !== 'ACTIVE') return
    setActing(true)
    try {
      const res = await game.playCard(battle.id, cardId)
      applyResult(res.data)
    } catch (e) {
      Alert.alert('Ошибка', e?.response?.data?.error || 'Не удалось разыграть карту.')
    }
    setActing(false)
  }

  async function onEndTurn() {
    if (acting || battle.status !== 'ACTIVE') return
    setActing(true)
    try {
      const res = await game.endTurn(battle.id)
      applyResult(res.data)
    } catch (e) {
      Alert.alert('Ошибка', 'Не удалось закончить ход.')
    }
    setActing(false)
  }

  async function onNewBattle() {
    setLoading(true)
    setBattle(null)
    try {
      const res = await game.startBattle()
      setBattle(res.data.battle)
      setHand(res.data.userCards)
    } catch (e) {
      Alert.alert('Ошибка', 'Не удалось начать новый бой.')
    }
    setLoading(false)
  }

  if (loading || !battle) return <View style={s.center}><ActivityIndicator color={colors.accent} size="large" /></View>

  const theme = battle.theme
  const isOver = battle.status !== 'ACTIVE'
  const lastLog = Array.isArray(battle.log) ? battle.log[battle.log.length - 1] : null

  return (
    <View style={s.wrap}>
      <View style={s.header}>
        <Text style={s.bossName}>{theme.bossName}</Text>
        <HpBar label="Босс" value={battle.bossHp} max={battle.bossMaxHp} color={colors.accent} />
        <HpBar label="Вы" value={battle.playerHp} max={battle.playerMaxHp} color={colors.green} />
        <View style={s.statsRow}>
          <Text style={s.statText}>💧 Мана: {battle.mana}/{MANA_CAP}</Text>
          <Text style={s.statText}>🔄 Ход: {battle.turn}</Text>
        </View>
      </View>

      <FlatList
        ref={logRef}
        style={s.log}
        contentContainerStyle={s.logContent}
        data={Array.isArray(battle.log) ? battle.log : []}
        keyExtractor={(_, i) => String(i)}
        onContentSizeChange={() => logRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => <Text style={s.logLine}>{item}</Text>}
      />

      {isOver ? (
        <View style={[s.banner, battle.status === 'WON' ? s.bannerWin : s.bannerLose]}>
          <Text style={s.bannerTitle}>{battle.status === 'WON' ? '🏆 Победа!' : '💀 Поражение'}</Text>
          {!!lastLog && <Text style={s.bannerText}>{lastLog}</Text>}
          <Pressable style={({ pressed }) => [s.newBattleBtn, pressed && { opacity: 0.8 }]} onPress={onNewBattle}>
            <Text style={s.newBattleBtnText}>Новый бой</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <FlatList
            horizontal
            data={hand}
            keyExtractor={uc => uc.id}
            contentContainerStyle={s.hand}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => {
              const card = item.card
              const r = RARITY[card.rarity] || RARITY.COMMON
              const playable = !acting && card.cost <= battle.mana
              return (
                <Pressable
                  style={({ pressed }) => [s.card, { borderColor: r.color }, !playable && s.cardOff, pressed && playable && { opacity: 0.8 }]}
                  onPress={() => onPlayCard(card.id)}
                  disabled={!playable}
                >
                  <Text style={s.cardName} numberOfLines={2}>{card.name}</Text>
                  <View style={s.cardStatsRow}>
                    <Text style={s.cardStatText}>⚔️ {card.attack}</Text>
                    <Text style={s.cardStatText}>💧 {card.cost}</Text>
                  </View>
                </Pressable>
              )
            }}
          />
          <View style={[s.actions, { paddingBottom: 12 + insets.bottom }]}>
            <Pressable
              style={({ pressed }) => [s.endTurnBtn, pressed && { opacity: 0.8 }, acting && { opacity: 0.6 }]}
              onPress={onEndTurn}
              disabled={acting}
            >
              {acting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.endTurnBtnText}>Закончить ход</Text>}
            </Pressable>
          </View>
        </>
      )}
    </View>
  )
}

function HpBar({ label, value, max, color }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0
  return (
    <View style={s.hpRow}>
      <Text style={s.hpLabel}>{label}</Text>
      <View style={s.hpTrack}>
        <View style={[s.hpFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
      <Text style={s.hpValue}>{value}/{max}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 16, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  bossName: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 10 },
  hpRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  hpLabel: { fontSize: 12, color: colors.text2, width: 36 },
  hpTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.surface2, overflow: 'hidden' },
  hpFill: { height: '100%', borderRadius: 5 },
  hpValue: { fontSize: 12, color: colors.text2, width: 56, textAlign: 'right' },
  statsRow: { flexDirection: 'row', gap: 16, marginTop: 4 },
  statText: { fontSize: 13, color: colors.text, fontWeight: '600' },
  log: { flex: 1 },
  logContent: { padding: 16, gap: 6 },
  logLine: { fontSize: 13, color: colors.text2, lineHeight: 19 },
  hand: { paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  card: { width: 110, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1.5, padding: 10 },
  cardOff: { opacity: 0.4 },
  cardName: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 8, minHeight: 34 },
  cardStatsRow: { flexDirection: 'row', gap: 10 },
  cardStatText: { fontSize: 12, color: colors.text2, fontWeight: '600' },
  actions: { paddingHorizontal: 16, paddingTop: 4, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  endTurnBtn: { backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  endTurnBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  banner: { margin: 16, borderRadius: 14, borderWidth: 1.5, padding: 20, alignItems: 'center' },
  bannerWin: { backgroundColor: `${colors.green}18`, borderColor: colors.green },
  bannerLose: { backgroundColor: `${colors.accent}18`, borderColor: colors.accent },
  bannerTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 8 },
  bannerText: { fontSize: 13, color: colors.text2, textAlign: 'center', marginBottom: 16, lineHeight: 19 },
  newBattleBtn: { backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 28 },
  newBattleBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
})
