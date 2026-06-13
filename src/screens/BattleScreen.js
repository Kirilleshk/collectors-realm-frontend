import React, { useState, useEffect, useRef } from 'react'
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Pressable, Alert } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { game } from '../api'
import { colors } from '../theme'
import { BossArt } from '../utils/cardArt'
import HpBar from '../components/battle/HpBar'
import BoardSlot from '../components/battle/BoardSlot'
import DeckPile from '../components/battle/DeckPile'
import HandCard from '../components/battle/HandCard'
import LogEntry from '../components/battle/LogEntry'

const MANA_CAP = 10
const EMPTY_DECK_COUNTS = { playerDeck: 0, playerDiscard: 0, bossDeck: 0, bossDiscard: 0 }

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

export default function BattleScreen({ route, navigation }) {
  const insets = useSafeAreaInsets()
  const [battle, setBattle] = useState(null)
  const [resolved, setResolved] = useState(null)
  const [deckCounts, setDeckCounts] = useState(EMPTY_DECK_COUNTS)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [popups, setPopups] = useState([])
  // Во время анимации боя показываем "рабочую" копию столов (до результата
  // end-turn), а финальное состояние из ответа сервера применяем в самом конце
  const [displayBoard, setDisplayBoard] = useState(null)
  // Разовые триггеры анимаций по instanceId существа: { kind: 'attack'|'hit'|'death'|'spawn', dir, token }
  const [effects, setEffects] = useState({})
  const logRef = useRef(null)
  const popupId = useRef(0)

  function popDamage(target, amount) {
    const id = ++popupId.current
    setPopups(prev => [...prev, { id, target, amount }])
    setTimeout(() => setPopups(prev => prev.filter(p => p.id !== id)), 850)
  }

  function triggerEffect(instanceId, kind, dir) {
    if (!instanceId) return
    setEffects(prev => ({ ...prev, [instanceId]: { kind, dir, token: Math.random() } }))
  }

  useEffect(() => { load() }, [])

  function applyData(data) {
    setBattle(data.battle)
    setResolved(data.resolved)
    setDeckCounts(data.deckCounts)
  }

  async function load() {
    setDisplayBoard(null)
    setEffects({})
    try {
      const res = await game.getActiveBattle()
      let data = res.data
      if (!data) {
        const started = await game.startBattle()
        data = started.data
      }
      applyData(data)
    } catch (e) {
      Alert.alert('Ошибка', 'Не удалось загрузить бой.')
    }
    setLoading(false)
  }

  // Пошагово проигрывает события боя (атаки, удары в лицо, смерти, выход карты
  // босса), затем применяет финальное состояние из ответа сервера
  async function playEvents(data) {
    const events = Array.isArray(data.events) ? data.events : []
    if (events.length === 0) {
      applyData(data)
      setTimeout(() => logRef.current?.scrollToEnd({ animated: true }), 100)
      return
    }

    const cardsById = new Map()
    const collect = list => { for (const e of list || []) if (e?.card) cardsById.set(e.cardId, e.card) }
    collect(resolved.playerBoard); collect(resolved.bossBoard); collect(resolved.playerHand)
    collect(data.resolved.playerBoard); collect(data.resolved.bossBoard); collect(data.resolved.playerHand)

    let dPlayer = resolved.playerBoard.map(c => ({ ...c }))
    let dBoss = resolved.bossBoard.map(c => ({ ...c }))
    setDisplayBoard({ playerBoard: dPlayer, bossBoard: dBoss })

    for (const ev of events) {
      if (ev.type === 'boss_play') {
        const card = cardsById.get(ev.cardId) ?? null
        dBoss = [...dBoss, { instanceId: ev.instanceId, cardId: ev.cardId, currentHealth: card?.health ?? 0, card }]
        setDisplayBoard({ playerBoard: dPlayer, bossBoard: dBoss })
        triggerEffect(ev.instanceId, 'spawn')
        await sleep(420)
        continue
      }

      // Игрок бьёт вверх (в сторону стола босса), босс — вниз (в сторону стола игрока).
      // Сброс расположен между столами, поэтому погибшее существо "улетает"
      // в ту же сторону, что и его атака.
      const lungeDir = ev.attackerSide === 'player' ? 'up' : 'down'
      const enemyDeathDir = lungeDir === 'up' ? 'down' : 'up'

      triggerEffect(ev.attackerInstanceId, 'attack', lungeDir)
      await sleep(200)

      if (ev.targetInstanceId) {
        triggerEffect(ev.targetInstanceId, 'hit')
        popDamage(ev.targetInstanceId, ev.damageToTarget)
      } else {
        popDamage(ev.attackerSide === 'player' ? 'boss' : 'player', ev.damageToTarget)
      }
      if (ev.damageToAttacker > 0) {
        triggerEffect(ev.attackerInstanceId, 'hit')
        popDamage(ev.attackerInstanceId, ev.damageToAttacker)
      }
      await sleep(260)

      if (ev.targetDied) triggerEffect(ev.targetInstanceId, 'death', enemyDeathDir)
      if (ev.attackerDied) triggerEffect(ev.attackerInstanceId, 'death', lungeDir)
      if (ev.targetDied || ev.attackerDied) await sleep(380)
    }

    applyData(data)
    setDisplayBoard(null)
    setEffects({})
    setTimeout(() => logRef.current?.scrollToEnd({ animated: true }), 100)
  }

  // Возвращает true при успехе — HandCard так понимает, что карту не нужно
  // возвращать обратно в руку
  async function onPlayCard(cardId) {
    if (acting || battle.status !== 'ACTIVE') return false
    setActing(true)
    let ok = false
    try {
      const res = await game.playCard(battle.id, cardId)
      const oldIds = new Set(battle.playerBoard.map(c => c.instanceId))
      const added = res.data.battle.playerBoard.find(c => !oldIds.has(c.instanceId))
      applyData(res.data)
      if (added) triggerEffect(added.instanceId, 'spawn')
      setTimeout(() => logRef.current?.scrollToEnd({ animated: true }), 100)
      ok = true
    } catch (e) {
      Alert.alert('Ошибка', e?.response?.data?.error || 'Не удалось разыграть карту.')
    }
    setActing(false)
    return ok
  }

  async function onEndTurn() {
    if (acting || battle.status !== 'ACTIVE') return
    setActing(true)
    try {
      const res = await game.endTurn(battle.id)
      await playEvents(res.data)
    } catch (e) {
      Alert.alert('Ошибка', 'Не удалось закончить ход.')
    }
    setActing(false)
  }

  async function onNewBattle() {
    setLoading(true)
    setBattle(null)
    setResolved(null)
    setDisplayBoard(null)
    setEffects({})
    try {
      const res = await game.startBattle()
      applyData(res.data)
    } catch (e) {
      Alert.alert('Ошибка', 'Не удалось начать новый бой.')
    }
    setLoading(false)
  }

  if (loading || !battle || !resolved) return <View style={s.center}><ActivityIndicator color={colors.accent} size="large" /></View>

  const theme = battle.theme
  const isOver = battle.status !== 'ACTIVE'
  const lastLog = Array.isArray(battle.log) ? battle.log[battle.log.length - 1] : null
  const board = displayBoard || resolved
  const bossSlots = [0, 1, 2].map(i => board.bossBoard[i] || null)
  const playerSlots = [0, 1, 2].map(i => board.playerBoard[i] || null)
  const boardFull = resolved.playerBoard.length >= 3

  return (
    <View style={s.wrap}>
      <View style={s.bossSection}>
        <BossArt size={52} />
        <View style={s.bossInfo}>
          <Text style={s.bossName}>{theme.bossName}</Text>
          <HpBar label="Босс" value={battle.bossHp} max={battle.bossMaxHp} color={colors.accent} popups={popups.filter(p => p.target === 'boss')} />
        </View>
      </View>

      <View style={s.boardRow}>
        {bossSlots.map((entry, i) => (
          <BoardSlot
            key={`boss-${i}`}
            entry={entry}
            effect={entry ? effects[entry.instanceId] : null}
            popups={entry ? popups.filter(p => p.target === entry.instanceId) : []}
          />
        ))}
      </View>

      <View style={s.deckRow}>
        <DeckPile count={deckCounts.playerDiscard} label="Сброс" icon="🗑️" color={colors.text2} />
        <DeckPile count={deckCounts.playerDeck} label="Колода" icon="🂠" color={colors.blue} />
      </View>

      <View style={s.boardRow}>
        {playerSlots.map((entry, i) => (
          <BoardSlot
            key={`player-${i}`}
            entry={entry}
            effect={entry ? effects[entry.instanceId] : null}
            popups={entry ? popups.filter(p => p.target === entry.instanceId) : []}
          />
        ))}
      </View>

      <View style={s.playerBar}>
        <HpBar label="Вы" value={battle.playerHp} max={battle.playerMaxHp} color={colors.green} popups={popups.filter(p => p.target === 'player')} />
        <View style={s.statsRow}>
          <View style={s.statBadge}><Text style={s.statBadgeText}>💧 {battle.mana}/{MANA_CAP}</Text></View>
          <View style={s.statBadge}><Text style={s.statBadgeText}>🔄 Ход {battle.turn}</Text></View>
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
            data={resolved.playerHand}
            keyExtractor={(entry, i) => `${entry.cardId}-${i}`}
            contentContainerStyle={s.hand}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => {
              const playable = !acting && !boardFull && item.card.cost <= battle.mana
              return <HandCard entry={item} playable={playable} onPress={() => onPlayCard(item.cardId)} />
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

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  bossSection: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  bossInfo: { flex: 1 },
  bossName: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 6 },
  boardRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, paddingVertical: 8 },
  deckRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 2 },
  playerBar: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.surface, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
  statBadge: { backgroundColor: colors.surface2, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statBadgeText: { fontSize: 12, fontWeight: '700', color: colors.text },
  log: { flex: 1 },
  logContent: { padding: 12 },
  hand: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
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
