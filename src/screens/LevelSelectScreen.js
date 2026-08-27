import React, { useState, useEffect, useRef } from 'react'
import { View, Text, Image, ScrollView, Pressable, StyleSheet, ActivityIndicator, Alert, useWindowDimensions, Platform } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { LinearGradient } from 'expo-linear-gradient'
import { useNavigation } from '@react-navigation/native'
import { game } from '../api'
import { colors } from '../theme'
import ScreenBackground from '../components/ScreenBackground'

// Карта-путь уровней (27.08.2026) — визуальная замена простого списка из
// сессии 21.08, по референсу Марка (извилистая тропа с пронумерованными
// узлами, скриншот в заметке бота cmszxf5h7 от 19.08). Полноценный
// иллюстрированный фон "как на референсе" — это арт-задача (генерируется
// вручную через Leonardo.ai, см. раздел "Арт карт" в CLAUDE.md), не код;
// здесь — стилистическое приближение средствами самого приложения: тот же
// арт арены боя (уже есть у каждого босса) размыт под задник, поверх —
// извилистая SVG-тропа между узлами-уровнями. Пассивка и HP остаются
// видны без доп. тапа (решение от 21.08 — механика не скрывается).
const NODE_SIZE = 84
const NODE_SPACING = 176 // вертикальное расстояние между соседними уровнями
const TOP_PADDING = 72
const BOTTOM_PADDING = 48

export default function LevelSelectScreen() {
  const navigation = useNavigation()
  const { width } = useWindowDimensions()
  const scrollRef = useRef(null)
  // Найдено 27.08.2026 при проверке в ландшафте: автоскролл к текущему
  // уровню считал центрирование от ФИКСИРОВАННОГО отступа (260px) — на
  // высоком портретном экране это давало +- нормальный результат, а на
  // низком ландшафтном (~390px, видимая область ScrollView ещё меньше)
  // промахивался мимо доступного уровня и показывал только запертый
  // верхний. Меряем реальную высоту видимой области (onLayout), не гадаем.
  const [viewportHeight, setViewportHeight] = useState(0)
  const [bosses, setBosses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [startingId, setStartingId] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setError(null)
    try {
      const res = await game.getBosses()
      setBosses(Array.isArray(res.data) ? res.data : [])
    } catch (e) {
      setError('Не удалось загрузить лестницу боссов')
    }
    setLoading(false)
  }

  async function onSelectBoss(boss) {
    if (boss.locked || startingId) return
    setStartingId(boss.id)
    try {
      await game.startBattle(boss.id)
      navigation.navigate('Battle', { bossId: boss.id })
    } catch (e) {
      Alert.alert('Ошибка', 'Не удалось начать бой. Попробуйте ещё раз.')
    }
    setStartingId(null)
  }

  // Уровень 1 — внизу тропы, дальше вверх (та же "лестница", только теперь
  // и визуально лестница, а не список сверху вниз). Узлы зигзагом слева/
  // справа, как на референсе — соединены плавной изогнутой линией.
  // Считаем ДО early-return ниже (loading/error) — эти вычисления сами по
  // себе не хуки, но useEffect на следующей строке хук, а хуки обязаны
  // вызываться в одном и том же порядке при каждом рендере (см. Rules of
  // Hooks) — если бы useEffect стоял ПОСЛЕ return при loading=true, при
  // переходе loading→false React бы увидел "новый" хук на этом месте и
  // упал с ошибкой (поймано вживую при проверке в ландшафте 27.08.2026).
  const totalHeight = TOP_PADDING + BOTTOM_PADDING + NODE_SPACING * Math.max(0, bosses.length - 1) + NODE_SIZE
  const nodeCenterX = i => (i % 2 === 0 ? width * 0.3 : width * 0.7)
  const nodeCenterY = i => totalHeight - BOTTOM_PADDING - NODE_SIZE / 2 - i * NODE_SPACING
  const arenaUrl = bosses.find(b => b.arenaImageUrl)?.arenaImageUrl

  // Текущий доступный уровень (первый не пройденный и не запертый) — к нему
  // сразу скроллим при открытии экрана, чтобы не листать каждый раз с низа.
  // Ждём, пока измерены И данные боссов, И реальная высота видимой области
  // ScrollView (viewportHeight) — центрируем от неё, а не от угаданного
  // отступа (см. комментарий у viewportHeight выше).
  const currentIndex = Math.max(0, bosses.findIndex(b => !b.defeated && !b.locked))
  useEffect(() => {
    if (!bosses.length || !viewportHeight) return
    const targetY = nodeCenterY(currentIndex)
    scrollRef.current?.scrollTo({ y: Math.max(0, targetY - viewportHeight / 2), animated: false })
  }, [bosses.length, viewportHeight, currentIndex])

  if (loading) {
    return <View style={s.center}><ActivityIndicator color={colors.accent} size="large" /></View>
  }

  if (error) {
    return (
      <View style={s.center}>
        <Text style={s.errorText}>{error}</Text>
        <Pressable style={s.retryBtn} onPress={() => { setLoading(true); load() }}>
          <Text style={s.retryText}>Попробовать снова</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <ScreenBackground>
      {!!arenaUrl && (
        <Image source={{ uri: arenaUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" blurRadius={Platform.OS === 'android' ? 14 : 30} />
      )}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(10,11,14,0.55)', 'rgba(10,11,14,0.82)', 'rgba(10,11,14,0.55)']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={s.header}>
        <Text style={s.headerTitle}>🪜 Лестница боссов</Text>
        <Text style={s.headerSub}>Чужой против Хищника</Text>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ height: totalHeight }}
        onLayout={e => setViewportHeight(e.nativeEvent.layout.height)}
        showsVerticalScrollIndicator={false}
      >
        <Svg width={width} height={totalHeight} style={StyleSheet.absoluteFill}>
          {bosses.slice(1).map((boss, idx) => {
            const i = idx + 1
            const a = { x: nodeCenterX(i - 1), y: nodeCenterY(i - 1) }
            const b = { x: nodeCenterX(i), y: nodeCenterY(i) }
            const midY = (a.y + b.y) / 2
            const d = `M ${a.x} ${a.y} C ${a.x} ${midY}, ${b.x} ${midY}, ${b.x} ${b.y}`
            // Отрезок пути подсвечен, только если верхний (следующий) босс
            // уже открыт — иначе получалось, что путь "пройден" аж до
            // самого запертого босса, хотя доступа к нему ещё нет
            const litUp = !boss.locked
            return (
              <Path
                key={boss.id}
                d={d}
                stroke={litUp ? colors.accent : colors.border}
                strokeWidth={6}
                strokeLinecap="round"
                fill="none"
                opacity={litUp ? 0.85 : 0.4}
              />
            )
          })}
        </Svg>

        {bosses.map((boss, i) => (
          <LevelNode
            key={boss.id}
            boss={boss}
            index={i}
            x={nodeCenterX(i)}
            y={nodeCenterY(i)}
            alignRight={i % 2 === 0}
            starting={startingId === boss.id}
            onPress={() => onSelectBoss(boss)}
          />
        ))}
      </ScrollView>
    </ScreenBackground>
  )
}

function LevelNode({ boss, index, x, y, alignRight, starting, onPress }) {
  const disabled = boss.locked || starting
  const stateColor = boss.locked ? colors.border : boss.defeated ? colors.green : colors.accent

  return (
    <View style={[s.nodeWrap, { left: x - NODE_SIZE / 2, top: y - NODE_SIZE / 2 }]}>
      <Pressable
        style={({ pressed }) => [pressed && !disabled && { opacity: 0.85 }]}
        onPress={onPress}
        disabled={disabled}
      >
        <View style={[s.node, { borderColor: stateColor }, boss.locked && s.nodeLocked]}>
          {boss.imageUrl ? (
            <Image source={{ uri: boss.imageUrl }} style={s.nodeImg} resizeMode="cover" />
          ) : (
            <View style={[s.nodeImg, s.nodeImgFallback]}><Text style={{ fontSize: 30 }}>👹</Text></View>
          )}
          {boss.locked && <View style={[StyleSheet.absoluteFill, s.nodeLockOverlay]} />}
        </View>
        <View style={[s.levelBadge, { borderColor: stateColor }]}><Text style={s.levelBadgeText}>{index + 1}</Text></View>
        {starting ? (
          <View style={s.statusBadge}><ActivityIndicator color={colors.accent} size="small" /></View>
        ) : boss.locked ? (
          <View style={[s.statusBadge, { borderColor: colors.border }]}><Text style={s.statusBadgeText}>🔒</Text></View>
        ) : boss.defeated ? (
          <View style={[s.statusBadge, { borderColor: colors.green }]}><Text style={s.statusBadgeText}>✅</Text></View>
        ) : null}
      </Pressable>

      {/* Инфо-панель по другую сторону от узла (референс — минималистичные
          бейджи без подписей, но пассивка/HP боссов у нас не скрытая
          механика уже с 21.08 — оставляем видимой без доп. тапа) */}
      <View style={[s.infoPanel, alignRight ? s.infoPanelRight : s.infoPanelLeft]}>
        <Text style={s.infoName} numberOfLines={1}>{boss.name}</Text>
        <Text style={s.infoHp}>❤️ {boss.hp} HP</Text>
        {boss.passiveText ? <Text style={s.infoPassive} numberOfLines={3}>⚡ {boss.passiveText}</Text> : null}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingHorizontal: 32 },
  errorText: { color: colors.text2, fontSize: 14, textAlign: 'center' },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.accent },
  retryText: { color: colors.accent, fontWeight: '600' },

  header: { paddingTop: 8, paddingBottom: 4, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  headerSub: { fontSize: 12, color: colors.text2, marginTop: 2 },

  nodeWrap: { position: 'absolute', width: NODE_SIZE, alignItems: 'center' },
  node: {
    width: NODE_SIZE, height: NODE_SIZE, borderRadius: NODE_SIZE / 2, overflow: 'hidden',
    borderWidth: 3, backgroundColor: colors.surface2,
  },
  nodeLocked: { opacity: 0.55 },
  nodeImg: { width: '100%', height: '100%' },
  nodeImgFallback: { alignItems: 'center', justifyContent: 'center' },
  nodeLockOverlay: { backgroundColor: 'rgba(0,0,0,0.35)' },

  levelBadge: {
    position: 'absolute', top: -8, left: -8, width: 26, height: 26, borderRadius: 13,
    backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 2,
  },
  levelBadgeText: { color: colors.text, fontSize: 13, fontWeight: '800' },

  statusBadge: {
    position: 'absolute', bottom: -6, right: -6, width: 26, height: 26, borderRadius: 13,
    backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.border,
  },
  statusBadgeText: { fontSize: 13 },

  infoPanel: { position: 'absolute', top: 4, width: 150 },
  infoPanelRight: { left: NODE_SIZE + 14 },
  infoPanelLeft: { right: NODE_SIZE + 14, alignItems: 'flex-end' },
  infoName: { fontSize: 14, fontWeight: '700', color: colors.text },
  infoHp: { fontSize: 11, color: colors.text2, marginTop: 2 },
  infoPassive: { fontSize: 11, color: colors.gold, marginTop: 3, lineHeight: 14 },
})
