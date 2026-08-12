import React, { useState, useEffect } from 'react'
import { View, Text, Modal, Pressable, ActivityIndicator, StyleSheet, Platform, Linking } from 'react-native'
import * as Location from 'expo-location'
import { colors } from '../theme'
import { users as usersApi } from '../api'
import { useAuth } from '../AuthContext'

async function getSkipFlag(userId) {
  const key = `locationPromptSkipped_${userId}`
  if (Platform.OS === 'web') return localStorage.getItem(key)
  const AsyncStorage = require('@react-native-async-storage/async-storage').default
  return await AsyncStorage.getItem(key)
}
async function setSkipFlag(userId) {
  const key = `locationPromptSkipped_${userId}`
  if (Platform.OS === 'web') { localStorage.setItem(key, '1'); return }
  const AsyncStorage = require('@react-native-async-storage/async-storage').default
  await AsyncStorage.setItem(key, '1')
}

// Показывается когда у пользователя нет сохранённых координат (latitude/longitude
// null) — коллекционер должен быть виден на карте, это важно для продукта.
// НЕ жёсткая блокировка (было так до 12.08 — модалка не закрывалась без
// разрешения геолокации вообще, `onRequestClose={() => {}}` без кнопки
// пропуска): в некоторых браузерных контекстах (встроенный браузер Avito,
// открытие по внешней ссылке) геолокация физически не срабатывает —
// пользователь застревал перед входом навсегда. Марк сам словил это на
// реальной ссылке 12.08. Теперь можно пропустить — координаты можно
// добавить позже в профиле, показ модалки на этом устройстве больше не
// повторяется (флаг в AsyncStorage/localStorage, per-аккаунт).
export default function LocationRequiredModal() {
  const { user, updateUser } = useAuth()
  const [loading, setLoading] = useState(false)
  const [denied, setDenied] = useState(false)
  const [skipped, setSkipped] = useState(null) // null = ещё не проверили флаг

  const isStaff = user?.roles?.some(r => ['ADMIN', 'MODERATOR', 'ANALYTICS'].includes(r))
  const needsLocation = !!user && !isStaff && (user.latitude == null || user.longitude == null)

  useEffect(() => {
    if (!needsLocation) { setSkipped(null); return }
    let cancelled = false
    getSkipFlag(user.id).then(v => { if (!cancelled) setSkipped(!!v) })
    return () => { cancelled = true }
  }, [needsLocation, user?.id])

  if (!needsLocation || skipped === null || skipped === true) return null

  async function handleAllow() {
    setLoading(true)
    setDenied(false)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        setDenied(true)
        setLoading(false)
        return
      }
      const loc = await Location.getCurrentPositionAsync({})
      const { latitude, longitude } = loc.coords
      let city = ''
      try {
        const geo = await Location.reverseGeocodeAsync({ latitude, longitude })
        city = geo?.[0]?.city || geo?.[0]?.region || ''
      } catch (e) {}
      await usersApi.update({ latitude, longitude, city })
      await updateUser({ latitude, longitude, city })
    } catch (e) {
      setDenied(true)
    }
    setLoading(false)
  }

  async function handleSkip() {
    await setSkipFlag(user.id)
    setSkipped(true)
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={handleSkip}>
      <View style={s.overlay}>
        <View style={s.card}>
          <Text style={s.icon}>📍</Text>
          <Text style={s.title}>Нужна геолокация</Text>
          <Text style={s.desc}>
            Чтобы коллекционеры поблизости могли находить друг друга на карте,
            приложению нужен доступ к вашему местоположению.
          </Text>

          {denied && (
            <View style={s.deniedBox}>
              <Text style={s.deniedText}>
                {Platform.OS === 'web'
                  ? 'Доступ не предоставлен. Разрешите геолокацию для этого сайта в настройках браузера и попробуйте снова, или пропустите — включить можно позже в профиле.'
                  : 'Доступ не предоставлен. Включите геолокацию в настройках телефона, или пропустите — включить можно позже в профиле.'}
              </Text>
              {Platform.OS !== 'web' && (
                <Pressable onPress={() => Linking.openSettings()} style={{ marginTop: 8 }}>
                  <Text style={s.settingsLink}>Открыть настройки →</Text>
                </Pressable>
              )}
            </View>
          )}

          <Pressable style={({ pressed }) => [s.btn, pressed && { opacity: 0.8 }]} onPress={handleAllow} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnText}>{denied ? 'Попробовать снова' : 'Разрешить доступ'}</Text>
            }
          </Pressable>
          <Pressable style={({ pressed }) => [s.skipBtn, pressed && { opacity: 0.6 }]} onPress={handleSkip} disabled={loading}>
            <Text style={s.skipBtnText}>Пропустить — включу позже в профиле</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { backgroundColor: colors.surface, borderRadius: 20, padding: 24, width: '100%', maxWidth: 360, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  icon: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '900', color: colors.text, marginBottom: 8, textAlign: 'center' },
  desc: { fontSize: 14, color: colors.text2, textAlign: 'center', marginBottom: 16, lineHeight: 20 },
  deniedBox: { backgroundColor: 'rgba(255,59,48,0.1)', borderRadius: 12, padding: 12, marginBottom: 16, width: '100%' },
  deniedText: { color: '#FF3B30', fontSize: 13, lineHeight: 18, textAlign: 'center' },
  settingsLink: { color: colors.accent, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  btn: { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32, alignItems: 'center', width: '100%' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  skipBtn: { marginTop: 12, paddingVertical: 8 },
  skipBtnText: { color: colors.text2, fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },
})
