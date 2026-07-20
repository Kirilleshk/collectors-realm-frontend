import React, { useState, useEffect, useRef } from 'react'
import { View, Text, Image, FlatList, ScrollView, StyleSheet, ActivityIndicator, Pressable, Alert, Platform, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import * as ScreenOrientation from 'expo-screen-orientation'
import { GestureDetector, Gesture } from 'react-native-gesture-handler'
import { LinearGradient } from 'expo-linear-gradient'
import { game } from '../api'
import { colors, getTabBarStyle } from '../theme'
import { auraAttackBonus, hasActivatableAbility } from '../utils/cardArt'
import HpBar from '../components/battle/HpBar'
import BossBanner from '../components/battle/BossBanner'
import BoardSlot from '../components/battle/BoardSlot'
import DeckPile from '../components/battle/DeckPile'
import HandCard from '../components/battle/HandCard'
import LogEntry from '../components/battle/LogEntry'
import CardZoomModal from '../components/battle/CardZoomModal'

const MANA_CAP = 10
const EMPTY_DECK_COUNTS = { playerDeck: 0, playerDiscard: 0, bossDeck: 0, bossHand: 0, bossDiscard: 0 }

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

export default function BattleScreen({ route, navigation }) {
  const insets = useSafeAreaInsets()
  const { width, height } = useWindowDimensions()
  const isLandscape = width > height
  // Высота арены считается явно числом от useWindowDimensions (надёжно
  // обновляется при повороте), а не через flex внутри ScrollView — на вебе
  // flex-контейнер со ScrollView схлопывается в 0 при живом ресайзе окна:
  // onLayout корневого View не успевает переотработать, и без min-height:0
  // скроллящийся flex-child проваливается в классическую CSS-ловушку
  const [playerBarH, setPlayerBarH] = useState(0)
  const [bottomH, setBottomH] = useState(0)
  // Нативная шапка Stack-навигатора и нижний таб-бар вкладок во время боя не
  // нужны (не видно ни «← Бой», ни Магазин/Карта/Профиль) и скрываются на
  // фокусе экрана (см. useFocusEffect ниже + headerShown:false в App.js) —
  // высвобождает ~104px, которых раньше катастрофически не хватало на реальных
  // телефонах в ландшафте (стол обрезался до нечитаемого состояния)
  const HEADER_ESTIMATE = 0
  const TAB_BAR_ESTIMATE = 0
  const LOG_HEIGHT = isLandscape ? 44 : 90
  // Пол поднят с 80 до 140 — старое значение было меньше высоты одного
  // компактного баннера босса, из-за чего арена почти всегда обрезала стол
  // до нечитаемого состояния на телефонах; 140 хотя бы показывает баннер
  // босса + один ряд стола как аварийный минимум
  const arenaHeight = Math.max(
    140,
    height - insets.top - insets.bottom - HEADER_ESTIMATE - TAB_BAR_ESTIMATE - playerBarH - bottomH - LOG_HEIGHT
  )
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
  // Карта, увеличенная долгим нажатием (лупа) — { card, currentHealth } | null.
  // currentHealth есть только для существ на столе, для карт в руке — null
  // (там показываем полное здоровье карты)
  const [zoomCard, setZoomCard] = useState(null)
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
  // сама подстраивается под ширину окна (см. isLandscape выше), а на нативных
  // платформах разворот приложения теперь свободный (see commit 1a6dbcf) — если
  // у пользователя выключен авто-поворот экрана в системе, игра без явного
  // lockAsync никогда не перейдёт в ландшафт. Возвращаем портрет при выходе из боя.
  useEffect(() => {
    if (Platform.OS === 'web') return
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {})
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {})
    }
  }, [])

  // Прячем нижний таб-бар вкладок, пока экран боя в фокусе — освобождает
  // место под арену (см. HEADER_ESTIMATE/TAB_BAR_ESTIMATE выше). На blur
  // (не unmount — GameScreen под этим экраном не размонтируется при переходе
  // в бой) обязательно восстанавливаем ИМЕННО getTabBarStyle(insets), а не
  // undefined — react-navigation мёржит undefined как собственное свойство
  // опций и не откатывается к style из screenOptions, из-за этого таб-бар
  // остался бы без фона/рамки/высоты после возврата из боя на любую вкладку.
  useFocusEffect(
    React.useCallback(() => {
      const parent = navigation.getParent()
      parent?.setOptions({ tabBarStyle: { display: 'none' } })
      return () => parent?.setOptions({ tabBarStyle: getTabBarStyle(insets) })
    }, [navigation, insets])
  )

  function popDamage(target, amount, positive) {
    const id = ++popupId.current
    setPopups(prev => [...prev, { id, target, amount, positive }])
    setTimeout(() => setPopups(prev => prev.filter(p => p.id !== id)), 850)
  }

  // Карта с аурой (buff_allies/acid_blood_buff/stealth_buff) усиливает
  // остальных на том же столе, пока сама жива — видно уже сейчас через
  // effectiveAttack на бейдже, но по фидбэку Марка нужен ещё и всплывающий
  // "+N" на каждой затронутой карте в момент выхода баффера на стол
  // buffFaction — фракция самого баффера: попап "+N" должен появляться только
  // на карточках той же фракции (см. фикс auraAttackBonus в cardArt.js), иначе
  // визуально обещает бонус картам, которых он на самом деле не коснётся
  const AURA_EFFECTS = ['buff_allies', 'acid_blood_buff', 'stealth_buff']
  function popAuraBonus(board, bonus, buffFaction) {
    for (const c of board) {
      if (!c || c.currentHealth <= 0) continue
      if (buffFaction && c.card?.faction && c.card.faction !== buffFaction) continue
      popDamage(c.instanceId, bonus, true)
    }
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
        if (card && AURA_EFFECTS.includes(card.effectType)) popAuraBonus(dBoss, card.effectValue ?? 1, card.faction)
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
      if (added) {
        triggerEffect(added.instanceId, 'spawn')
        const addedCard = res.data.resolved.playerBoard.find(c => c.instanceId === added.instanceId)?.card
        if (addedCard && AURA_EFFECTS.includes(addedCard.effectType)) {
          popAuraBonus(res.data.resolved.playerBoard, addedCard.effectValue ?? 1, addedCard.faction)
        }
      }
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

  // Кнопка "активировать способность" (сейчас только невидимость) на своей
  // карте на столе — по фидбэку Марка это должен быть осознанный выбор игрока,
  // а не автомат с момента выхода карты. Бесплатно, доступно, пока карта жива
  // и способность ещё не активна (см. POST /battle/:id/activate)
  async function onActivateAbility(instanceId) {
    if (acting || battle.status !== 'ACTIVE') return
    setActing(true)
    try {
      const res = await game.activateAbility(battle.id, instanceId)
      applyData(res.data)
      setTimeout(() => logRef.current?.scrollToEnd({ animated: true }), 100)
    } catch (e) {
      Alert.alert('Ошибка', e?.response?.data?.error || 'Не удалось активировать способность.')
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

  // На вебе expo-screen-orientation не может физически повернуть экран
  // телефона (JS не управляет ориентацией браузера без Fullscreen API,
  // ненадёжного на iOS Safari) — раньше при портретной ориентации стол боя
  // просто сжимался в узкую колонку, что и выглядело "не переворачивается".
  // Вместо борьбы с ориентацией браузера — просим пользователя повернуть
  // телефон физически, как это делают большинство веб-игр.
  const isMobileWeb = Platform.OS === 'web' && Math.min(width, height) < 900
  if (isMobileWeb && !isLandscape) {
    return (
      <View style={s.rotateWrap}>
        <Text style={s.rotateIcon}>🔄</Text>
        <Text style={s.rotateTitle}>Поверните телефон</Text>
        <Text style={s.rotateText}>Бой ведётся в альбомной ориентации — поверните устройство боком, чтобы продолжить</Text>
      </View>
    )
  }

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
  // Актуальная сила удара с учётом аур союзников на столе (buff_allies и т.п.) —
  // без этого бейдж показывал базовое значение карты, а реальный урон в бою
  // получался выше на бонус ауры, что выглядело как баг ("на карте 8, а бьёт на 12").
  // Бонус считается ОТДЕЛЬНО для каждого существа по его фракции (см.
  // auraAttackBonus в cardArt.js) — общий бонус на весь стол был багом: аура
  // Преторианца/Волка усиливала весь стол владельца, даже карты чужой фракции,
  // хотя текст эффекта обещает усиление только своей.
  function effectiveAttackOf(entry, ownBoard) {
    if (!entry?.card) return undefined
    return entry.card.attack + auraAttackBonus(ownBoard, entry.card.faction)
  }

  // Выделенный арт арены (сгенерирован под фон, не портрет) показываем чётче —
  // портрет босса как раньше сильно размываем, иначе крупный кроп лица выглядит странно
  const arenaUrl = theme.arenaImageUrl || theme.bossImageUrl
  const isDedicatedArena = !!theme.arenaImageUrl

  return (
    <View style={[s.wrap, isLandscape && s.wrapLandscape]}>
      {!!arenaUrl && (
        <Image
          source={{ uri: arenaUrl }}
          style={[s.backdrop, isDedicatedArena && s.backdropSharp]}
          resizeMode="cover"
          blurRadius={isDedicatedArena ? (Platform.OS === 'android' ? 2 : 4) : (Platform.OS === 'android' ? 12 : 30)}
          pointerEvents="none"
        />
      )}
      {/* Виньетка вместо сплошного затемнения — темнее у краёв (там баннер босса,
          рука игрока, деки), чуть светлее в центре, где сам стол боя. Даёт больше
          атмосферы фону арены и не спорит с читаемостью текста по краям экрана. */}
      <LinearGradient
        pointerEvents="none"
        colors={isDedicatedArena
          ? ['rgba(10,11,14,0.7)', 'rgba(10,11,14,0.32)', 'rgba(10,11,14,0.7)']
          : ['rgba(10,11,14,0.85)', 'rgba(10,11,14,0.55)', 'rgba(10,11,14,0.85)']}
        locations={[0, 0.5, 1]}
        style={s.backdropOverlay}
      />

      {/* Своя кнопка "назад" — нативная шапка Stack-навигатора скрыта
          (headerShown:false в App.js), чтобы не съедать высоту. Абсолютное
          позиционирование поверх фона — не участвует в расчёте arenaHeight. */}
      <Pressable style={[s.backBtn, { top: insets.top + 6 }]} onPress={() => navigation.goBack()}>
        <Text style={s.backBtnText}>←</Text>
      </Pressable>

      <ScrollView
        style={[s.arenaScroll, { height: arenaHeight }]}
        contentContainerStyle={s.arenaScrollContent}
        showsVerticalScrollIndicator={false}
      >
      <View ref={faceZoneRef} collapsable={false}>
        <BossBanner
          bossName={theme.bossName}
          imageUrl={theme.bossImageUrl}
          hp={battle.bossHp}
          maxHp={battle.bossMaxHp}
          popups={popups.filter(p => p.target === 'boss')}
          faceAttackable={faceAttackable}
          onPress={faceAttackable ? () => onAttack(null) : undefined}
          height={isLandscape ? 68 : 168}
          compact={isLandscape}
          handCount={deckCounts.bossHand}
        />
      </View>

      <LinearGradient
        colors={[`${colors.accent}22`, 'transparent', 'transparent']}
        locations={[0, 0.4, 1]}
        style={s.arena}
      >
      <View style={s.boardRow}>
        {bossSlots.map((entry, i) => {
          // Невидимые (stealthCharge) карты тоже можно выбрать целью — атака
          // по ним просто промахнётся (сервер резолвит это как уклонение и
          // снимает заряд невидимости), а не отклоняется как раньше. Иначе
          // Pressable у такой карты был вообще отключён — с точки зрения
          // игрока карту противника нельзя было выбрать вообще никак.
          const isTargetable = !!selectedAttacker && !!entry && entry.currentHealth > 0
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
                onLongPress={entry ? () => setZoomCard({ card: entry.card, currentHealth: entry.currentHealth }) : undefined}
                effectiveAttack={effectiveAttackOf(entry, board.bossBoard)}
              />
            </View>
          )
        })}
      </View>

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
          // onLongPress только когда карта НЕ под управлением жеста (!canSelect) —
          // Pressable внутри BoardSlot иначе снова станет активным touch-responder-ом
          // и конфликтует с GestureDetector на вебе (тот самый баг с перехватом
          // указателя, из-за которого onPress тоже намеренно не передаётся здесь)
          const slot = (
            <BoardSlot
              entry={entry}
              size={slotSize}
              effect={entry ? effects[entry.instanceId] : null}
              popups={entry ? popups.filter(p => p.target === entry.instanceId) : []}
              selectable={canSelect}
              selected={!!entry && selectedAttacker === entry.instanceId}
              effectiveAttack={effectiveAttackOf(entry, board.playerBoard)}
              onLongPress={!canSelect && entry ? () => setZoomCard({ card: entry.card, currentHealth: entry.currentHealth }) : undefined}
            />
          )
          // Кнопка активации способности — сиблинг GestureDetector'а, а не его
          // ребёнок (так же как и лупа выше): свой Pressable внутри области жеста
          // конфликтует с перехватом указателя на вебе. Показываем, только пока
          // способность ещё не активна — активная невидимость не нуждается в кнопке.
          const canActivate = !isOver && !acting && !!entry && entry.currentHealth > 0 && hasActivatableAbility(entry.card) && !entry.stealthCharge
          return (
            <View key={`player-${i}`} collapsable={false} style={s.playerSlotWrap} ref={el => { if (entry && el) playerSlotWrapRefs.current[entry.instanceId] = el }}>
              {canSelect ? <GestureDetector gesture={makeAttackDrag(entry)}>{slot}</GestureDetector> : slot}
              {canActivate && (
                <Pressable style={s.activateBtn} onPress={() => onActivateAbility(entry.instanceId)}>
                  <Text style={s.activateBtnText}>👁️</Text>
                </Pressable>
              )}
            </View>
          )
        })}
      </View>
      </LinearGradient>
      </ScrollView>

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

      <View style={[s.playerBar, isLandscape && s.playerBarCompact]} onLayout={e => setPlayerBarH(e.nativeEvent.layout.height)}>
        <HpBar label="Вы" value={battle.playerHp} max={battle.playerMaxHp} color={colors.green} popups={popups.filter(p => p.target === 'player')} />
        <View style={[s.statsRow, isLandscape && s.statsRowCompact]}>
          <View style={[s.statBadge, isLandscape && s.statBadgeCompact]}><Text style={s.statBadgeText}>💧 {battle.mana}/{MANA_CAP}</Text></View>
          <View style={[s.statBadge, isLandscape && s.statBadgeCompact]}><Text style={s.statBadgeText}>🔄 Ход {battle.turn}</Text></View>
        </View>
      </View>

      <FlatList
        ref={logRef}
        style={[s.log, { height: LOG_HEIGHT }]}
        contentContainerStyle={s.logContent}
        data={Array.isArray(battle.log) ? battle.log : []}
        keyExtractor={(_, i) => String(i)}
        onContentSizeChange={() => logRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => <LogEntry text={item} />}
      />

      <View onLayout={e => setBottomH(e.nativeEvent.layout.height)}>
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
              contentContainerStyle={[s.hand, isLandscape && s.handCompact]}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => {
                const playable = !acting && !boardFull && item.card.cost <= battle.mana
                return (
                  <HandCard
                    entry={item}
                    playable={playable}
                    onPress={() => onPlayCard(item.cardId)}
                    onLongPress={card => setZoomCard({ card, currentHealth: null })}
                    width={isLandscape ? 54 : 96}
                    height={isLandscape ? 76 : 136}
                  />
                )
              }}
            />
            <View style={[s.actions, isLandscape && s.actionsCompact, { paddingBottom: (isLandscape ? 6 : 12) + insets.bottom }]}>
              <Pressable
                style={({ pressed }) => [s.endTurnBtn, isLandscape && s.endTurnBtnCompact, pressed && { opacity: 0.8 }, acting && { opacity: 0.6 }]}
                onPress={onEndTurn}
                disabled={acting}
              >
                {acting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.endTurnBtnText}>Закончить ход</Text>}
              </Pressable>
            </View>
          </>
        )}
      </View>

      <CardZoomModal
        card={zoomCard?.card}
        currentHealth={zoomCard?.currentHealth}
        visible={!!zoomCard}
        onClose={() => setZoomCard(null)}
      />
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  wrapLandscape: { paddingTop: 0 },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.35 },
  backdropSharp: { opacity: 0.55 },
  backdropOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  backBtn: { position: 'absolute', left: 8, zIndex: 10, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(10,11,14,0.6)', alignItems: 'center', justifyContent: 'center' },
  backBtnText: { fontSize: 18, fontWeight: '700', color: colors.text },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  rotateWrap: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center', padding: 32 },
  rotateIcon: { fontSize: 56, marginBottom: 16, transform: [{ rotate: '90deg' }] },
  rotateTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 8, textAlign: 'center' },
  rotateText: { fontSize: 14, color: colors.text2, textAlign: 'center', lineHeight: 20 },
  // Высота задаётся явно числом (arenaHeight, см. компонент) — ScrollView внутри
  // flex-колонки схлопывается в 0 при живом ресайзе окна/повороте на вебе,
  // не пересчитывая flex корректно; explicit height полностью обходит эту проблему
  // flexGrow/flexShrink: 0 — высота полностью управляется явным числом
  // (arenaHeight), не отдаём её на откуп CSS flex-negotiation с соседями
  arenaScroll: { flexGrow: 0, flexShrink: 0, minHeight: 0 },
  arenaScrollContent: { flexGrow: 1, justifyContent: 'center' },
  arena: {},
  dragOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 },
  dragLine: { position: 'absolute', height: 3, borderRadius: 1.5, backgroundColor: colors.gold },
  dragTip: { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: colors.gold },
  boardRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, paddingVertical: 8 },
  playerSlotWrap: { position: 'relative' },
  activateBtn: { position: 'absolute', top: -8, right: -8, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.surface2, borderWidth: 1.5, borderColor: colors.gold, alignItems: 'center', justifyContent: 'center', zIndex: 5 },
  activateBtnText: { fontSize: 12 },
  deckRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 2 },
  playerBar: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.surface, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
  playerBarCompact: { paddingVertical: 3 },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
  statsRowCompact: { marginTop: 0 },
  statBadge: { backgroundColor: colors.surface2, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statBadgeCompact: { paddingVertical: 2 },
  statBadgeText: { fontSize: 12, fontWeight: '700', color: colors.text },
  log: {},
  logContent: { padding: 12 },
  hand: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  handCompact: { paddingVertical: 4, gap: 4 },
  actions: { paddingHorizontal: 16, paddingTop: 4, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  actionsCompact: { paddingTop: 2 },
  endTurnBtn: { backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  endTurnBtnCompact: { paddingVertical: 8 },
  endTurnBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  banner: { margin: 16, borderRadius: 14, borderWidth: 1.5, padding: 20, alignItems: 'center' },
  bannerWin: { backgroundColor: `${colors.green}18`, borderColor: colors.green },
  bannerLose: { backgroundColor: `${colors.accent}18`, borderColor: colors.accent },
  bannerTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 8 },
  bannerText: { fontSize: 13, color: colors.text2, textAlign: 'center', marginBottom: 16, lineHeight: 19 },
  newBattleBtn: { backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 28 },
  newBattleBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
})
