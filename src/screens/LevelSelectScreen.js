import React, { useState, useEffect } from 'react'
import { View, Text, Image, FlatList, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { game } from '../api'
import { colors } from '../theme'
import ScreenBackground from '../components/ScreenBackground'

// Лестница боссов (21.08.2026) — простой вертикальный список ступеней
// сложности внутри одной темы: заблокирован / доступен / пройден. По
// решению из скоупинга — красивая карта-путь в стиле референса Марка
// (RPG world-map) делается отдельным шагом ПОСЛЕ проверки механики, здесь
// сознательно минимально.
export default function LevelSelectScreen() {
  const navigation = useNavigation()
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
      <FlatList
        data={bosses}
        keyExtractor={b => b.id}
        contentContainerStyle={s.list}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        renderItem={({ item, index }) => (
          <BossRow boss={item} index={index} starting={startingId === item.id} onPress={() => onSelectBoss(item)} />
        )}
      />
    </ScreenBackground>
  )
}

function BossRow({ boss, index, starting, onPress }) {
  const disabled = boss.locked || starting
  return (
    <Pressable
      style={({ pressed }) => [s.row, boss.locked && s.rowLocked, boss.defeated && s.rowDefeated, pressed && !disabled && { opacity: 0.85 }]}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={s.portraitWrap}>
        {boss.imageUrl ? (
          <Image source={{ uri: boss.imageUrl }} style={[s.portrait, boss.locked && s.portraitLocked]} resizeMode="cover" />
        ) : (
          <View style={[s.portrait, s.portraitFallback]}><Text style={{ fontSize: 28 }}>👹</Text></View>
        )}
        <View style={s.levelBadge}><Text style={s.levelBadgeText}>{index + 1}</Text></View>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.name} numberOfLines={1}>{boss.name}</Text>
        <Text style={s.hp}>❤️ {boss.hp} HP</Text>
        {boss.passiveText ? <Text style={s.passive} numberOfLines={2}>⚡ {boss.passiveText}</Text> : null}
      </View>
      {starting ? (
        <ActivityIndicator color={colors.accent} size="small" />
      ) : boss.locked ? (
        <Text style={s.statusIcon}>🔒</Text>
      ) : boss.defeated ? (
        <Text style={s.statusIcon}>✅</Text>
      ) : (
        <Text style={s.statusArrow}>›</Text>
      )}
    </Pressable>
  )
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingHorizontal: 32 },
  errorText: { color: colors.text2, fontSize: 14, textAlign: 'center' },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.accent },
  retryText: { color: colors.accent, fontWeight: '600' },

  list: { padding: 16 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: colors.surface, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: colors.border,
  },
  rowLocked: { opacity: 0.5 },
  rowDefeated: { borderColor: `${colors.green}60` },

  portraitWrap: { position: 'relative' },
  portrait: { width: 56, height: 56, borderRadius: 12, backgroundColor: colors.surface2 },
  portraitLocked: { opacity: 0.6 },
  portraitFallback: { alignItems: 'center', justifyContent: 'center' },
  levelBadge: {
    position: 'absolute', top: -6, left: -6, width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.bg,
  },
  levelBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  name: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 3 },
  hp: { fontSize: 12, color: colors.text2, marginBottom: 3 },
  passive: { fontSize: 11, color: colors.gold, lineHeight: 15 },

  statusIcon: { fontSize: 20 },
  statusArrow: { fontSize: 22, color: colors.text2, fontWeight: '300' },
})
