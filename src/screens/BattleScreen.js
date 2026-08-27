import React, { useState, useEffect, useRef } from 'react'
import { View, Text, Image, FlatList, ScrollView, Modal, StyleSheet, ActivityIndicator, Pressable, Alert, Platform, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import { GestureDetector, Gesture } from 'react-native-gesture-handler'
import { LinearGradient } from 'expo-linear-gradient'
import { game } from '../api'
import { colors, getTabBarStyle } from '../theme'
import { auraAttackBonus, hasActivatableAbility } from '../utils/cardArt'
import HpBar from '../components/battle/HpBar'
import BossBanner from '../components/battle/BossBanner'
import BoardSlot from '../components/battle/BoardSlot'
import HandCard from '../components/battle/HandCard'
import LogEntry from '../components/battle/LogEntry'
import CardZoomModal from '../components/battle/CardZoomModal'

const MANA_CAP = 10
const EMPTY_DECK_COUNTS = { playerDeck: 0, playerDiscard: 0, bossDeck: 0, bossHand: 0, bossDiscard: 0 }

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

export default function BattleScreen({ route, navigation }) {
  const insets = useSafeAreaInsets()
  const { height: winHeight } = useWindowDimensions()
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
  // Текстовый лог хода — по фидбэку Марка не должен быть частью основного
  // экрана боя вообще ("убери текстовый вариант боя, ничего не нужно
  // прокручивать, стол и рука должны быть видны всегда"). Экран боя снова
  // фиксированный (без общего скролла, как было временно на 21.07) — стол,
  // полоса игрока и рука всегда помещаются на экране; лог при этом никуда не
  // делся, просто убран из основного вида и открывается отдельным окном по
  // кнопке — если что-то пошло не так, историю ходов всё ещё можно посмотреть.
  const [logVisible, setLogVisible] = useState(false)
  // Реально измеренная высота арены (onLayout) — статичный порог compact
  // (высота экрана < 500) угадывал размер слотов НЕ по факту доступного
  // места, а по общему разрешению экрана; на part реальных телефонов (не
  // тех трёх, что тестировались в браузере) сумма banner+playerBar+рука+
  // кнопка съедала больше места, чем предполагалось, и ряд существ игрока
  // обрезался снизу (overflow:hidden арены) — Марк не мог выбрать карту на
  // столе для атаки, потому что она была наполовину скрыта под полосой "Вы".
  // Размер слота теперь считается от РЕАЛЬНОЙ высоты арены, а не от догадки.
  const [arenaHeight, setArenaHeight] = useState(0)
  const [arenaWidth, setArenaWidth] = useState(0)
  // Рука карт — горизонтальный скролл без индикатора (showsHorizontalScrollIndicator
  // отключён по прошлой просьбе Марка). Когда карт в руке больше, чем влезает в
  // ширину экрана, лишние карты просто уходят за правый край без единой визуальной
  // подсказки, что там ещё что-то есть — с виду читается как "карты пропали/обрезаны"
  // (жалоба Марка 03.08), хотя на деле достаточно свайпнуть. Затухание с правого
  // края появляется, только когда контент реально не помещается целиком.
  const [handOverflow, setHandOverflow] = useState(false)
  const handViewportWidthRef = useRef(0)
  const handContentWidthRef = useRef(0)
  function checkHandOverflow() {
    setHandOverflow(handContentWidthRef.current > handViewportWidthRef.current + 2)
  }
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

  // Поворот больше НЕ навязывается — раньше здесь принудительно лочили
  // ландшафт при входе в бой (и портрет при выходе), пользователь просил
  // убрать это требование. Ориентация теперь полностью свободная, как и на
  // остальных экранах приложения (app.json: orientation "default", это был
  // единственный экран, где вообще что-то лочилось).

  // Прячем нижний таб-бар вкладок, пока экран боя в фокусе — освобождает
  // место под арену. На blur (не unmount — GameScreen под этим экраном не
  // размонтируется при переходе в бой) обязательно восстанавливаем ИМЕННО
  // getTabBarStyle(insets), а не undefined — react-navigation мёржит undefined
  // как собственное свойство опций и не откатывается к style из screenOptions,
  // из-за этого таб-бар остался бы без фона/рамки/высоты после возврата из боя.
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
        // Лестница боссов (21.08.2026) — раньше route.params игнорировался
        // (был только один босс вообще), теперь LevelSelectScreen передаёт
        // конкретного bossId, с которым резюмировать/начать бой
        const started = await game.startBattle(route.params?.bossId)
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
      // Пассивка босса сработала (лестница боссов, 21.08.2026) — regen лечит
      // видимую HP-полоску босса, поэтому получает попап там же, где обычный
      // урон/лечение; mana_drain не привязан ни к одной HP-полоске, для него
      // достаточно текстовой строки в логе (уже в battle.log с сервера)
      if (ev.type === 'boss_passive') {
        if (ev.passiveType === 'regen') popDamage('boss', ev.value, true)
        await sleep(500)
        continue
      }
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
    // Реванш — тот же босс, что только что закончился (не сбрасывает
    // прогресс лестницы на боссе #1); bossId читаем из ЕЩЁ живого battle
    // (state), до его сброса ниже
    const rematchBossId = battle?.bossId ?? route.params?.bossId
    setLoading(true)
    setBattle(null)
    setResolved(null)
    setDisplayBoard(null)
    setEffects({})
    try {
      const res = await game.startBattle(rematchBossId)
      applyData(res.data)
    } catch (e) {
      Alert.alert('Ошибка', 'Не удалось начать новый бой.')
    }
    setLoading(false)
  }

  if (loading || !battle || !resolved) return <View style={s.center}><ActivityIndicator color={colors.accent} size="large" /></View>

  const theme = battle.theme
  // Лестница боссов (21.08.2026) — battle.boss отсутствует у боёв, начатых
  // до этой фичи (bossId nullable), откатываемся на старые поля темы
  const boss = battle.boss
  const bossDisplayName = boss?.name ?? theme.bossName
  const bossDisplayImage = boss?.imageUrl ?? theme.bossImageUrl
  const isOver = battle.status !== 'ACTIVE'
  const lastLog = Array.isArray(battle.log) ? battle.log[battle.log.length - 1] : null
  const board = displayBoard || resolved
  const boardSlots = battle.boardSlots || 5
  // Экран боя фиксированный (см. комментарий у logVisible выше) — реального
  // дефицита ВЫСОТЫ (не соотношения сторон, см. коммит от 20.07 про ту же
  // ошибку) достаточно много (телефон-ландшафт ~390px), приходится ужимать
  // баннер босса и карты в руке, иначе низ экрана обрежется без скролла
  const compact = winHeight < 500
  // Слот стола считается от РЕАЛЬНОЙ высоты арены (arenaHeight, onLayout), а
  // не от догадки по winHeight — см. комментарий у arenaHeight выше. Первая
  // версия этого расчёта всё равно резала ряд существ игрока на компактных
  // экранах (телефон-ландшафт ~390px): baнnер+рука+статус-бар там съедали
  // почти всё место, арене оставалось ~14px. Раз уж считаем по факту —
  // заодно на compact убрали из арены ряд колоды/сброса (перенесён в
  // статус-бар) и ужали баннер/руку/кнопку, чтобы реально важные для тапа
  // ряды существ получали основную часть места, а не 14px обрезанный кусок.
  // На compact в арене только 2 ряда (boss+player), на обычных экранах — 3
  // (+ colodeRow, 60px пилы + 4px паддинг).
  // Стол — главный визуальный акцент боя (по прямой просьбе Марка 01.08 и
  // повторно 27.08: "должны быть крупные карты пользователя... пусть будут
  // небольшие карты в таком же формате останутся карты у босса" — босс не
  // самое интересное на столе, важно то, чем реально играет пользователь).
  // Поэтому у босса и игрока теперь РАЗНЫЕ потолки размера — не общий slotSize.
  const maxBossSlotSize = compact ? 48 : 64
  const maxPlayerSlotSize = compact ? 84 : 130
  // Найдено 26.08.2026 (жалоба Марка "уже почти месяц", подтверждено замером
  // реального DOM на проде): при boardSlots=5 ряд физически не помещается в
  // одну строку по ШИРИНЕ на портретных экранах — переносится (flexWrap).
  // Считаем по факту (arenaWidth, onLayout), не угадываем — тот же принцип,
  // что применён ниже к arenaHeight. У боссовского и игрового рядов может
  // получиться разное число строк — размер слотов разный, значит и то,
  // сколько их влезает в строку по ширине, тоже разное.
  const GAP = 10
  function linesFor(maxSize) {
    const perLine = arenaWidth > 0 ? Math.max(1, Math.floor((arenaWidth + GAP) / (maxSize + GAP))) : boardSlots
    return Math.max(1, Math.ceil(boardSlots / perLine))
  }
  const bossLines = linesFor(maxBossSlotSize)
  const playerLines = linesFor(maxPlayerSlotSize)
  // Боссу — всегда его маленький потолок размера (он и так компактный, под
  // высоту подстраивать незачем). Игроку — весь ОСТАТОК высоты арены после
  // ряда босса, чтобы карты игрока реально расширялись в освободившееся
  // место, а не оставляли его пустым (жалоба 27.08: "смотри сколько места
  // свободного" — раньше формула считала МИНИМАЛЬНО достаточный размер по
  // жёсткому потолку в 96px и останавливалась, хотя высоты хватало на
  // гораздо крупнее — реально пустовавшее место возле игрового ряда).
  const bossSlotSize = maxBossSlotSize
  const bossRowHeight = bossLines * bossSlotSize + (bossLines - 1) * GAP
  // Немного места на естественные зазоры между рядами (justifyContent:'space-evenly') —
  // в compact (ландшафт) арене и так критически мало высоты, резервировать
  // там 24px как в портрете — значит без нужды отбирать их у карт игрока
  const ARENA_GAP_BUDGET = compact ? 8 : 24
  const playerSlotSize = arenaHeight > 0
    ? Math.max(40, Math.min(maxPlayerSlotSize, Math.floor((arenaHeight - ARENA_GAP_BUDGET - bossRowHeight) / playerLines) - GAP))
    : maxPlayerSlotSize
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
  // Лестница боссов (21.08.2026): предпочитаем арт КОНКРЕТНОГО босса (когда
  // появится настоящий, не заглушка), с откатом на общий фон темы
  const arenaUrl = boss?.arenaImageUrl || theme.arenaImageUrl || bossDisplayImage
  const isDedicatedArena = !!(boss?.arenaImageUrl || theme.arenaImageUrl)

  return (
    <View style={s.wrap}>
      {!!arenaUrl && (
        <Image
          source={{ uri: arenaUrl }}
          style={[s.backdrop, isDedicatedArena && s.backdropSharp]}
          resizeMode="cover"
          blurRadius={isDedicatedArena ? (Platform.OS === 'android' ? 2 : 4) : (Platform.OS === 'android' ? 12 : 30)}
          pointerEvents="none"
        />
      )}
      {/* Виньетка вместо сплошного затемнения — темнее у краёв, чуть светлее в
          центре, где сам стол боя. */}
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
          позиционирование — только в углу, ничего важного не закрывает. */}
      <Pressable style={[s.backBtn, { top: insets.top + 6 }]} onPress={() => navigation.goBack()}>
        <Text style={s.backBtnText}>←</Text>
      </Pressable>

      {/* Экран боя фиксированный, без общего скролла (см. комментарий у
          logVisible) — стол, полоса игрока и рука всегда видны целиком.
          Арена растягивается на всё оставшееся место (flex:1) между
          баннером босса и нижним блоком, размеры внутри подстраиваются
          под compact при реальном дефиците высоты. */}
      <View style={[s.pageFixed, { paddingTop: insets.top + 48, paddingBottom: insets.bottom }]}>
        <View ref={faceZoneRef} collapsable={false}>
          <BossBanner
            bossName={bossDisplayName}
            imageUrl={bossDisplayImage}
            hp={battle.bossHp}
            maxHp={battle.bossMaxHp}
            passiveText={boss?.passiveText}
            popups={popups.filter(p => p.target === 'boss')}
            faceAttackable={faceAttackable}
            onPress={faceAttackable ? () => onAttack(null) : undefined}
            height={compact ? 56 : 116}
            handCount={deckCounts.bossHand}
            compact={compact}
          />
        </View>

        <LinearGradient
          colors={[`${colors.accent}22`, 'transparent', 'transparent']}
          locations={[0, 0.4, 1]}
          style={s.arena}
          onLayout={e => { setArenaHeight(e.nativeEvent.layout.height); setArenaWidth(e.nativeEvent.layout.width) }}
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
                    size={bossSlotSize}
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
                  size={playerSlotSize}
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
              // Явная кнопка лупы (26.08.2026, жалоба Марка "нельзя увеличить карту") —
              // ровно когда onLongPress ВЫШЕ отключён (canSelect=true, картой можно
              // ходить/атаковать — то есть почти всё время на своём ходу), кроме
              // долгого нажатия других способов увеличить карту не было вообще.
              // Та же схема, что и activateBtn: сиблинг GestureDetector'а, не ребёнок.
              const showZoomBtn = canSelect && !!entry
              return (
                <View key={`player-${i}`} collapsable={false} style={s.playerSlotWrap} ref={el => { if (entry && el) playerSlotWrapRefs.current[entry.instanceId] = el }}>
                  {canSelect ? <GestureDetector gesture={makeAttackDrag(entry)}>{slot}</GestureDetector> : slot}
                  {canActivate && (
                    <Pressable style={s.activateBtn} onPress={() => onActivateAbility(entry.instanceId)}>
                      <Text style={s.activateBtnText}>👁️</Text>
                    </Pressable>
                  )}
                  {showZoomBtn && (
                    <Pressable style={s.zoomBtn} onPress={() => setZoomCard({ card: entry.card, currentHealth: entry.currentHealth })}>
                      <Text style={s.activateBtnText}>🔍</Text>
                    </Pressable>
                  )}
                </View>
              )
            })}
          </View>
        </LinearGradient>

        <View style={[s.playerBar, compact && s.playerBarCompact]}>
          <HpBar label="Вы" value={battle.playerHp} max={battle.playerMaxHp} color={colors.green} popups={popups.filter(p => p.target === 'player')} compact={compact} />
          <View style={s.statsRow}>
            <View style={s.statBadge}><Text style={s.statBadgeText}>💧 {battle.mana}/{MANA_CAP}</Text></View>
            <View style={s.statBadge}><Text style={s.statBadgeText}>🔄 Ход {battle.turn}</Text></View>
            {/* Колода/сброс — раньше отдельным рядом в арене только на compact,
                теперь всегда здесь (26.08.2026: арене нужна вся высота под
                карты, счётчики — не то, чем управляют пальцем каждый ход) */}
            <View style={s.statBadge}><Text style={s.statBadgeText}>🂠 {deckCounts.playerDeck}</Text></View>
            <View style={s.statBadge}><Text style={s.statBadgeText}>🗑️ {deckCounts.playerDiscard}</Text></View>
            <Pressable style={s.statBadge} onPress={() => setLogVisible(true)}>
              <Text style={s.statBadgeText}>📜 Лог</Text>
            </Pressable>
          </View>
        </View>

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
            <View style={s.handWrap}>
              <FlatList
                horizontal
                // Без явного style горизонтальный FlatList в этом флекс-столбце
                // неявно растягивался (flexGrow) и отжирал у арены (тоже
                // flex:1) в разы больше места, чем требовал её реальный
                // контент (285px вместо ожидаемых ~116px при карте 100px) —
                // именно это весь день не давало столу вырасти до заданного
                // maxSlotSize, а не сама формула расчёта. Найдено 01.08.2026.
                style={[s.handList, { height: (compact ? 64 : 100) + (compact ? 4 : 16) }]}
                data={resolved.playerHand}
                keyExtractor={(entry, i) => `${entry.cardId}-${i}`}
                contentContainerStyle={[s.hand, compact && s.handCompact]}
                showsHorizontalScrollIndicator={false}
                onLayout={e => { handViewportWidthRef.current = e.nativeEvent.layout.width; checkHandOverflow() }}
                onContentSizeChange={w => { handContentWidthRef.current = w; checkHandOverflow() }}
                renderItem={({ item }) => {
                  const playable = !acting && !boardFull && item.card.cost <= battle.mana
                  return (
                    <HandCard
                      entry={item}
                      playable={playable}
                      onPress={() => onPlayCard(item.cardId)}
                      onLongPress={card => setZoomCard({ card, currentHealth: null })}
                      width={compact ? 46 : 72}
                      height={compact ? 64 : 100}
                      nameLines={compact ? 1 : 2}
                    />
                  )
                }}
              />
              {handOverflow && (
                <LinearGradient
                  pointerEvents="none"
                  colors={['transparent', colors.surface]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={s.handFade}
                />
              )}
            </View>
            <View style={[s.actions, compact && s.actionsCompact]}>
              <Pressable
                style={({ pressed }) => [s.endTurnBtn, compact && s.endTurnBtnCompact, pressed && { opacity: 0.8 }, acting && { opacity: 0.6 }]}
                onPress={onEndTurn}
                disabled={acting}
              >
                {acting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.endTurnBtnText}>Закончить ход</Text>}
              </Pressable>
            </View>
          </>
        )}
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

      <CardZoomModal
        card={zoomCard?.card}
        currentHealth={zoomCard?.currentHealth}
        visible={!!zoomCard}
        onClose={() => setZoomCard(null)}
      />

      <Modal visible={logVisible} transparent animationType="fade" onRequestClose={() => setLogVisible(false)}>
        <Pressable style={s.logBackdrop} onPress={() => setLogVisible(false)}>
          <Pressable style={s.logPanel} onPress={() => {}}>
            <Text style={s.logPanelTitle}>Лог хода</Text>
            <ScrollView style={s.logScroll} contentContainerStyle={s.logContent}>
              {(Array.isArray(battle.log) ? battle.log : []).map((entry, i) => (
                <LogEntry key={i} text={entry} />
              ))}
            </ScrollView>
            <Pressable style={s.closeLogBtn} onPress={() => setLogVisible(false)}>
              <Text style={s.closeLogBtnText}>Закрыть</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.35 },
  backdropSharp: { opacity: 0.55 },
  backdropOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  backBtn: { position: 'absolute', left: 8, zIndex: 10, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(10,11,14,0.6)', alignItems: 'center', justifyContent: 'center' },
  backBtnText: { fontSize: 18, fontWeight: '700', color: colors.text },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  pageFixed: { flex: 1 },
  arena: { flex: 1, minHeight: 0, justifyContent: 'space-evenly', overflow: 'hidden' },
  dragOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 },
  dragLine: { position: 'absolute', height: 3, borderRadius: 1.5, backgroundColor: colors.gold },
  dragTip: { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: colors.gold },
  boardRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, paddingVertical: 4, flexWrap: 'wrap' },
  playerSlotWrap: { position: 'relative' },
  activateBtn: { position: 'absolute', top: -8, right: -8, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.surface2, borderWidth: 1.5, borderColor: colors.gold, alignItems: 'center', justifyContent: 'center', zIndex: 5 },
  activateBtnText: { fontSize: 12 },
  zoomBtn: { position: 'absolute', top: -8, left: -8, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.surface2, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', zIndex: 5 },
  deckRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 2 },
  playerBar: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.surface, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
  playerBarCompact: { paddingVertical: 3 },
  statsRow: { flexDirection: 'row', gap: 6, marginTop: 2, flexWrap: 'wrap' },
  statBadge: { backgroundColor: colors.surface2, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statBadgeText: { fontSize: 12, fontWeight: '700', color: colors.text },
  handWrap: { position: 'relative' },
  handList: { flexGrow: 0, flexShrink: 0 },
  handFade: { position: 'absolute', top: 0, right: 0, bottom: 0, width: 36 },
  hand: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  handCompact: { paddingVertical: 2 },
  actions: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  actionsCompact: { paddingTop: 2, paddingBottom: 4 },
  endTurnBtn: { backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  endTurnBtnCompact: { paddingVertical: 6 },
  endTurnBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  banner: { margin: 16, borderRadius: 14, borderWidth: 1.5, padding: 20, alignItems: 'center' },
  bannerWin: { backgroundColor: `${colors.green}18`, borderColor: colors.green },
  bannerLose: { backgroundColor: `${colors.accent}18`, borderColor: colors.accent },
  bannerTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 8 },
  bannerText: { fontSize: 13, color: colors.text2, textAlign: 'center', marginBottom: 16, lineHeight: 19 },
  newBattleBtn: { backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 28 },
  newBattleBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  logBackdrop: { flex: 1, backgroundColor: 'rgba(6,7,10,0.86)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  logPanel: { width: '100%', maxWidth: 420, maxHeight: '80%', backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16 },
  logPanelTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 10 },
  logScroll: { flexGrow: 0 },
  logContent: { paddingBottom: 8 },
  closeLogBtn: { marginTop: 12, backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  closeLogBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
})
