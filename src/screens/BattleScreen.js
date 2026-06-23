import React, { useState, useEffect, useRef } from 'react'
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Pressable, Alert, Platform, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as ScreenOrientation from 'expo-screen-orientation'
import { GestureDetector, Gesture } from 'react-native-gesture-handler'
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
  const { width, height } = useWindowDimensions()
  const isLandscape = width > height
  const [battle, setBattle] = useState(null)
  const [resolved, setResolved] = useState(null)
  const [deckCounts, setDeckCounts] = useState(EMPTY_DECK_COUNTS)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [popups, setPopups] = useState([])
  // instanceId выбранного для атаки своего существа (ручной таргетинг) — null,
  // если атакующий пока не выбран
  const [selectedAttacker, setSelectedAttacker] = useState(null)
  // Во время анимации боя показываем "рабочую" копию столов (до результата
  // end-turn), а финальное состояние из ответа сервера применяем в самом конце
  const [displayBoard, setDisplayBoard] = useState(null)
  // Разовые триггеры анимаций по instanceId существа: { kind: 'attack'|'hit'|'death'|'spawn', dir, token }
  const [effects, setEffects] = useState({})
  const logRef = useRef(null)
  const popupId = useRef(0)

  // Drag-таргетинг (v2 над тапом): { x1, y1, x2, y2 } экранных координат линии
  // от выбранной карты к текущей точке пальца/мыши, null — когда не тащим
  const [dragLine, setDragLine] = useState(null)
  // Измеренные на onBegin прямоугольники возможных целей (карты босса + "лицо"),
  // в экранных координатах — заполняются асинхронно через .measure()
  const dragTargetsRef = useRef([])
  const dragOriginRef = useRef(null)
  // instanceId -> native ref обёртки слота, для измерения позиций на старте drag
  const bossSlotWrapRefs = useRef({})
  const playerSlotWrapRefs = useRef({})
  const faceZoneRef = useRef(null)

  // Бой удобнее вести в ландшафте — больше места для стола. На вебе раскладка
  // сама подстраивается под ширину окна (см. isLandscape ниже), а на нативных
  // платформах нужно явно повернуть экран; возвращаем портрет при выходе из боя
  useEffect(() => {
    if (Platform.OS === 'web') return
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {})
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {})
    }
  }, [])

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
    setSelectedAttacker(null)
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

  // Тап по своему живому существу, которое ещё не атаковало в этом ходу —
  // выбор/снятие выбора атакующего (тап по уже выбранному снимает выбор)
  function onSelectAttacker(instanceId) {
    if (acting || battle.status !== 'ACTIVE') return
    setSelectedAttacker(prev => (prev === instanceId ? null : instanceId))
  }

  // Тап по подсвеченной карте босса (или по зоне "лица", если на столе босса
  // нет валидных целей) после выбора своего атакующего
  async function onAttack(targetInstanceId) {
    if (acting || !selectedAttacker || battle.status !== 'ACTIVE') return
    setActing(true)
    try {
      const res = await game.attack(battle.id, selectedAttacker, targetInstanceId)
      await playEvents(res.data)
    } catch (e) {
      Alert.alert('Ошибка', e?.response?.data?.error || 'Не удалось атаковать.')
      setSelectedAttacker(null)
    }
    setActing(false)
  }

  // Drag от своего существа к цели (v2 над тапом). Важно: onBegin срабатывает
  // на любое касание, даже на обычный тап (пока движение не превысило
  // minDistance) — поэтому логику выбора/измерения целей вешаем на onStart
  // (срабатывает только когда жест реально активировался, то есть это drag),
  // а финал смотрим через onFinalize с флагом success: false — значит, движения
  // не было, это был обычный тап, и его обрабатываем как onSelectAttacker
  function makeAttackDrag(entry) {
    return Gesture.Pan()
      .minDistance(12)
      .onStart(() => {
        setSelectedAttacker(entry.instanceId)
        dragTargetsRef.current = []
        Object.entries(bossSlotWrapRefs.current).forEach(([id, ref]) => {
          ref?.measure?.((x, y, w, h, pageX, pageY) => {
            dragTargetsRef.current.push({ id, x: pageX, y: pageY, w, h })
          })
        })
        faceZoneRef.current?.measure?.((x, y, w, h, pageX, pageY) => {
          dragTargetsRef.current.push({ id: 'face', x: pageX, y: pageY, w, h })
        })
        playerSlotWrapRefs.current[entry.instanceId]?.measure?.((x, y, w, h, pageX, pageY) => {
          const origin = { x: pageX + w / 2, y: pageY + h / 2 }
          dragOriginRef.current = origin
          setDragLine({ x1: origin.x, y1: origin.y, x2: origin.x, y2: origin.y })
        })
      })
      .onUpdate(e => {
        if (!dragOriginRef.current) return
        setDragLine({ x1: dragOriginRef.current.x, y1: dragOriginRef.current.y, x2: e.absoluteX, y2: e.absoluteY })
      })
      .onFinalize((e, success) => {
        setDragLine(null)
        dragOriginRef.current = null
        if (!success) {
          // движения не было — обычный тап, ведём себя как onSelectAttacker
          onSelectAttacker(entry.instanceId)
          return
        }
        const hit = dragTargetsRef.current.find(r => e.absoluteX >= r.x && e.absoluteX <= r.x + r.w && e.absoluteY >= r.y && e.absoluteY <= r.y + r.h)
        if (!hit) {
          setSelectedAttacker(null)
          return
        }
        onAttack(hit.id === 'face' ? null : hit.id)
      })
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
  const boardSlots = battle.boardSlots || 5
  const slotSize = boardSlots > 3 ? 48 : 60
  const bossSlots = Array.from({ length: boardSlots }, (_, i) => board.bossBoard[i] || null)
  const playerSlots = Array.from({ length: boardSlots }, (_, i) => board.playerBoard[i] || null)
  const boardFull = resolved.playerBoard.length >= boardSlots
  const attackedThisTurn = Array.isArray(battle.attackedThisTurn) ? battle.attackedThisTurn : []
  const hasValidBossTarget = board.bossBoard.some(c => c && c.currentHealth > 0 && !c.stealthCharge)
  const faceAttackable = !!selectedAttacker && !hasValidBossTarget && !acting

  return (
    <View style={[s.wrap, isLandscape && s.wrapLandscape]}>
      <View ref={faceZoneRef} collapsable={false}>
        <Pressable
          style={[s.bossSection, faceAttackable && s.faceAttackable]}
          onPress={faceAttackable ? () => onAttack(null) : undefined}
          disabled={!faceAttackable}
        >
          <BossArt size={52} imageUrl={theme.bossImageUrl} />
          <View style={s.bossInfo}>
            <Text style={s.bossName}>{theme.bossName}{faceAttackable ? ' — бить в лицо' : ''}</Text>
            <HpBar label="Босс" value={battle.bossHp} max={battle.bossMaxHp} color={colors.accent} popups={popups.filter(p => p.target === 'boss')} />
          </View>
        </Pressable>
      </View>

      <View style={s.boardRow}>
        {bossSlots.map((entry, i) => {
          const isTargetable = !!selectedAttacker && !!entry && entry.currentHealth > 0 && !entry.stealthCharge
          return (
            <View
              key={`boss-${i}`}
              collapsable={false}
              ref={el => { if (entry && el) bossSlotWrapRefs.current[entry.instanceId] = el }}
            >
              <BoardSlot
                entry={entry}
                size={slotSize}
                effect={entry ? effects[entry.instanceId] : null}
                popups={entry ? popups.filter(p => p.target === entry.instanceId) : []}
                selectable={isTargetable}
                onPress={isTargetable ? () => onAttack(entry.instanceId) : undefined}
              />
            </View>
          )
        })}
      </View>

      {dragLine && (() => {
        const dx = dragLine.x2 - dragLine.x1
        const dy = dragLine.y2 - dragLine.y1
        const length = Math.hypot(dx, dy)
        const angle = Math.atan2(dy, dx)
        const cx = (dragLine.x1 + dragLine.x2) / 2
        const cy = (dragLine.y1 + dragLine.y2) / 2
        return (
          <View pointerEvents="none" style={s.dragOverlay}>
            <View
              style={[
                s.dragLine,
                { left: cx - length / 2, top: cy - 1.5, width: length, transform: [{ rotate: `${angle}rad` }] },
              ]}
            />
            <View pointerEvents="none" style={[s.dragTip, { left: dragLine.x2 - 5, top: dragLine.y2 - 5 }]} />
          </View>
        )
      })()}

      <View style={s.deckRow}>
        <DeckPile count={deckCounts.playerDiscard} label="Сброс" icon="🗑️" color={colors.text2} />
        <DeckPile count={deckCounts.playerDeck} label="Колода" icon="🂠" color={colors.blue} backImageUrl={theme.backImageUrl} />
      </View>

      <View style={s.boardRow}>
        {playerSlots.map((entry, i) => {
          const canSelect = !isOver && !acting && !!entry && entry.currentHealth > 0 && !attackedThisTurn.includes(entry.instanceId)
          // onPress карте НЕ передаём, когда ей управляет жест (canSelect) — BoardSlot
          // рендерит свой Pressable, и если он активен одновременно с GestureDetector
          // снаружи, на вебе RNGH перехватывает указатель и обычный клик не доходит.
          // И тап, и drag теперь полностью разруливаются внутри makeAttackDrag
          // (см. onFinalize: success=false — это был тап, ведём себя как выбор атакующего)
          const slot = (
            <BoardSlot
              entry={entry}
              size={slotSize}
              effect={entry ? effects[entry.instanceId] : null}
              popups={entry ? popups.filter(p => p.target === entry.instanceId) : []}
              selectable={canSelect}
              selected={!!entry && selectedAttacker === entry.instanceId}
            />
          )
          return (
            <View key={`player-${i}`} collapsable={false} ref={el => { if (entry && el) playerSlotWrapRefs.current[entry.instanceId] = el }}>
              {canSelect ? <GestureDetector gesture={makeAttackDrag(entry)}>{slot}</GestureDetector> : slot}
            </View>
          )
        })}
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
  wrapLandscape: { paddingTop: 0 },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  bossSection: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  faceAttackable: { borderColor: colors.gold, borderBottomWidth: 2 },
  dragOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 },
  dragLine: { position: 'absolute', height: 3, borderRadius: 1.5, backgroundColor: colors.gold },
  dragTip: { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: colors.gold },
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
