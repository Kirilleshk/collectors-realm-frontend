import React, { useState, useEffect, useRef } from 'react'
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Pressable, Alert, Animated } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { game } from '../api'
import { colors } from '../theme'
import { RARITY, CardArt, BossArt } from '../utils/cardArt'

const MANA_CAP = 10

export default function BattleScreen({ route, navigation }) {
  const insets = useSafeAreaInsets()
  const [battle, setBattle] = useState(null)
  const [hand, setHand] = useState([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [popups, setPopups] = useState([])
  const logRef = useRef(null)
  const popupId = useRef(0)

  function popDamage(target, amount) {
    const id = ++popupId.current
    setPopups(prev => [...prev, { id, target, amount }])
    setTimeout(() => setPopups(prev => prev.filter(p => p.id !== id)), 850)
  }

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
    const next = data.battle
    if (battle) {
      const bossDmg = battle.bossHp - next.bossHp
      const playerDmg = battle.playerHp - next.playerHp
      if (bossDmg > 0) popDamage('boss', bossDmg)
      if (playerDmg > 0) popDamage('player', playerDmg)
    }
    setBattle(next)
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
      <View style={s.bossSection}>
        <BossArt size={84} />
        <Text style={s.bossName}>{theme.bossName}</Text>
        <HpBar label="Босс" value={battle.bossHp} max={battle.bossMaxHp} color={colors.accent} popups={popups.filter(p => p.target === 'boss')} />
      </View>

      <View style={s.playerBar}>
        <View style={s.playerPortrait}>
          <Text style={s.playerPortraitIcon}>🗿</Text>
        </View>
        <View style={s.playerInfo}>
          <HpBar label="Вы" value={battle.playerHp} max={battle.playerMaxHp} color={colors.green} popups={popups.filter(p => p.target === 'player')} />
          <View style={s.statsRow}>
            <View style={s.statBadge}><Text style={s.statBadgeText}>💧 {battle.mana}/{MANA_CAP}</Text></View>
            <View style={s.statBadge}><Text style={s.statBadgeText}>🔄 Ход {battle.turn}</Text></View>
          </View>
        </View>
      </View>

      <FlatList
        ref={logRef}
        style={s.log}
        contentContainerStyle={s.logContent}
        data={Array.isArray(battle.log) ? battle.log : []}
        keyExtractor={(_, i) => String(i)}
        onContentSizeChange={() => logRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => <LogEntry text={item} />}
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
                  <View style={[s.cardArtArea, { backgroundColor: `${r.color}15` }]}>
                    <CardArt card={card} size={28} />
                    <View style={[s.costBadge, { backgroundColor: colors.blue }]}>
                      <Text style={s.costBadgeText}>{card.cost}</Text>
                    </View>
                  </View>
                  <View style={[s.cardNameBanner, { borderTopColor: r.color }]}>
                    <Text style={s.cardName} numberOfLines={2}>{card.name}</Text>
                  </View>
                  <View style={s.cardFooter}>
                    <Text style={s.cardStatText}>⚔️ {card.attack}</Text>
                    <View style={[s.rarityDot, { backgroundColor: r.color }]} />
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

function HpBar({ label, value, max, color, popups = [] }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0
  return (
    <View style={s.hpRow}>
      <Text style={s.hpLabel}>{label}</Text>
      <View style={s.hpTrackWrap}>
        <View style={s.hpTrack}>
          <View style={[s.hpFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
        </View>
        {popups.map(p => <DamagePopup key={p.id} amount={p.amount} />)}
      </View>
      <Text style={s.hpValue}>{value}/{max}</Text>
    </View>
  )
}

function DamagePopup({ amount }) {
  const anim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 850, useNativeDriver: false }).start()
  }, [])

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -26] })
  const opacity = anim.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] })

  return (
    <Animated.Text style={[s.popup, { transform: [{ translateY }], opacity }]}>
      −{amount}
    </Animated.Text>
  )
}

function classifyLog(text) {
  if (/^Ход\s+\d+/.test(text)) return 'turn'
  if (text.includes('атакует')) return 'boss'
  if (text.includes('разыграли') || text.includes('урон боссу')) return 'player'
  return 'system'
}

function LogEntry({ text }) {
  const kind = classifyLog(text)

  if (kind === 'turn') {
    return (
      <View style={s.logDivider}>
        <Text style={s.logDividerText}>{text}</Text>
      </View>
    )
  }
  if (kind === 'system') {
    return <Text style={s.logSystem}>{text}</Text>
  }

  const isBoss = kind === 'boss'
  const tint = isBoss ? colors.accent : colors.green
  return (
    <View style={[s.logRow, isBoss && s.logRowEnd]}>
      <View style={[s.logBubble, { backgroundColor: `${tint}15`, borderColor: `${tint}35` }]}>
        <View style={[s.logIconBadge, { backgroundColor: tint }]}>
          <Text style={s.logIconBadgeText}>{isBoss ? '👹' : '⚔️'}</Text>
        </View>
        <Text style={s.logBubbleText}>{text}</Text>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  bossSection: { padding: 16, paddingTop: 20, alignItems: 'center', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  bossName: { fontSize: 17, fontWeight: '700', color: colors.text, marginTop: 8, marginBottom: 10 },
  playerBar: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  playerPortrait: { width: 48, height: 48, borderRadius: 24, backgroundColor: `${colors.green}25`, borderWidth: 1.5, borderColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  playerPortraitIcon: { fontSize: 24 },
  playerInfo: { flex: 1 },
  statBadge: { backgroundColor: colors.surface2, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statBadgeText: { fontSize: 12, fontWeight: '700', color: colors.text },
  hpRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6, alignSelf: 'stretch' },
  hpLabel: { fontSize: 12, color: colors.text2, width: 36 },
  hpTrackWrap: { flex: 1 },
  hpTrack: { height: 10, borderRadius: 5, backgroundColor: colors.surface2, overflow: 'hidden' },
  hpFill: { height: '100%', borderRadius: 5 },
  hpValue: { fontSize: 12, color: colors.text2, width: 56, textAlign: 'right' },
  popup: { position: 'absolute', right: 4, top: 0, fontSize: 13, fontWeight: '700', color: colors.text },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  log: { flex: 1 },
  logContent: { padding: 16 },
  logDivider: { alignSelf: 'center', backgroundColor: colors.surface2, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 4, marginVertical: 8 },
  logDividerText: { fontSize: 11, fontWeight: '700', color: colors.text2 },
  logSystem: { fontSize: 12, color: colors.text2, fontStyle: 'italic', textAlign: 'center', marginBottom: 8 },
  logRow: { flexDirection: 'row', marginBottom: 8 },
  logRowEnd: { justifyContent: 'flex-end' },
  logBubble: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, maxWidth: '85%' },
  logIconBadge: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  logIconBadgeText: { fontSize: 11 },
  logBubbleText: { fontSize: 13, color: colors.text, lineHeight: 18, flexShrink: 1 },
  hand: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  card: { width: 88, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 2, overflow: 'hidden' },
  cardOff: { opacity: 0.4 },
  cardArtArea: { height: 48, alignItems: 'center', justifyContent: 'center' },
  costBadge: { position: 'absolute', top: 4, left: 4, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  costBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  cardNameBanner: { paddingHorizontal: 6, paddingVertical: 4, borderTopWidth: 1 },
  cardName: { fontSize: 10, fontWeight: '700', color: colors.text, minHeight: 26 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 6 },
  cardStatText: { fontSize: 11, color: colors.text2, fontWeight: '700' },
  rarityDot: { width: 7, height: 7, borderRadius: 3.5 },
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
