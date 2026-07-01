import React, { useState } from 'react'
import { View, Text, Modal, Pressable, ActivityIndicator, StyleSheet, Platform, Linking } from 'react-native'
import * as Location from 'expo-location'
import { colors } from '../theme'
import { users as usersApi } from '../api'
import { useAuth } from '../AuthContext'

// Показывается когда у пользователя нет сохранённых координат (latitude/longitude
// null — это и есть признак "не дал согласие", т.к. другого способа завершить
// этот модал нет). Нельзя закрыть, не разрешив доступ к геолокации — обязательное
// требование клиента: коллекционер должен быть виден на карте.
export default function LocationRequiredModal() {
  const { user, updateUser } = useAuth()
  const [loading, setLoading] = useState(false)
  const [denied, setDenied] = useState(false)

  if (!user || (user.latitude != null && user.longitude != null)) return null

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

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => {}}>
      <View style={s.overlay}>
        <View style={s.card}>
          <Text style={s.icon}>📍</Text>
          <Text style={s.title}>Нужна геолокация</Text>
          <Text style={s.desc}>
            Чтобы коллекционеры поблизости могли находить друг друга на карте,
            приложению нужен доступ к вашему местоположению. Это обязательный шаг.
          </Text>

          {denied && (
            <View style={s.deniedBox}>
              <Text style={s.deniedText}>
                {Platform.OS === 'web'
                  ? 'Доступ не предоставлен. Разрешите геолокацию для этого сайта в настройках браузера и попробуйте снова.'
                  : 'Доступ не предоставлен. Включите геолокацию в настройках телефона для этого приложения и попробуйте снова.'}
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
})
