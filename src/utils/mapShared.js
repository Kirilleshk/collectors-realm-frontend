import { useState, useRef, useCallback } from 'react'
import { Alert } from 'react-native'
import * as Location from 'expo-location'

// Общая логика карты (вынесено 19.09.2026 при чистке техдолга) —
// MapScreen.js (мобайл, WebView+Leaflet) и MapScreen.web.js (веб,
// react-leaflet) раньше дублировали этот код ~90% один в один: уже
// расходились переписыванием карты (HANDOFF.md, 16.07.2026), и совсем
// недавно один и тот же баг «координата 0 = нет геолокации» пришлось чинить
// в двух местах отдельно. Теперь источник правды один — платформенные файлы
// остаются только с рендерингом карты (WebView/iframe vs react-leaflet),
// который по своей природе не может быть общим.

export const API = 'https://collectors-realm-backend.onrender.com/api'

export const roleMap = {
  COLLECTOR: { label: 'Коллекционер', icon: '🗿', color: '#4A90D9' },
  MASTER_REPAIR: { label: 'Мастер по ремонту', icon: '🔧', color: '#E04E28' },
  CUSTOMIZER: { label: 'Кастомизатор', icon: '🎨', color: '#AF52DE' },
  DIORAMA: { label: 'Мастер диорам', icon: '🏔', color: '#34C759' },
}

export function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Список пользователей для карты — грузится и фильтруется одинаково на
// мобайле и вебе. usersRef нужен только мобильному WebView (хендлер клика
// по маркеру внутри WebView читает актуальный список без замыкания на
// старый рендер) — .web.js может просто не использовать поле usersRef.
export function useMapUsers(token, me) {
  const [users, setUsers] = useState([])
  const usersRef = useRef([])
  const [loading, setLoading] = useState(true)
  const [slowLoad, setSlowLoad] = useState(false)
  const [error, setError] = useState(null)

  const loadUsers = useCallback(async () => {
    setError(null)
    setLoading(true)
    const slowTimer = setTimeout(() => setSlowLoad(true), 8000)
    try {
      const res = await fetch(`${API}/users`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout ? AbortSignal.timeout(65000) : undefined,
      })
      const data = await res.json()
      const list = Array.isArray(data)
        ? data.filter(u => typeof u.latitude === 'number' && typeof u.longitude === 'number').map(u =>
            me && u.id === me.id && me.avatarUrl && !u.avatarUrl
              ? { ...u, avatarUrl: me.avatarUrl }
              : u
          )
        : []
      setUsers(list)
      usersRef.current = list
    } catch (e) {
      setError('Не удалось загрузить карту')
    }
    clearTimeout(slowTimer)
    setSlowLoad(false)
    setLoading(false)
  }, [token, me])

  return { users, usersRef, loading, slowLoad, error, loadUsers }
}

// «Поблизости» — геолокация + выбранный радиус (5/20 км)
export function useNearbyLocation() {
  const [nearbyRadius, setNearbyRadius] = useState(null)
  const [myLocation, setMyLocation] = useState(null)
  const [gettingLocation, setGettingLocation] = useState(false)

  async function toggleNearby(radius) {
    if (nearbyRadius === radius) {
      setNearbyRadius(null)
      setMyLocation(null)
      return
    }
    setGettingLocation(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Нужно разрешение', 'Разрешите доступ к геолокации в настройках')
        setGettingLocation(false)
        return
      }
      const loc = await Location.getCurrentPositionAsync({})
      setMyLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude })
      setNearbyRadius(radius)
    } catch (e) {
      Alert.alert('Ошибка геолокации', e.message)
    }
    setGettingLocation(false)
  }

  function clearNearby() {
    setNearbyRadius(null)
    setMyLocation(null)
  }

  return { nearbyRadius, myLocation, gettingLocation, toggleNearby, clearNearby }
}

// Общий фильтр по роли + радиусу «поблизости» — идентичен на обеих платформах
export function filterMapUsers(users, filter, nearbyRadius, myLocation) {
  return users
    .filter(u => !filter || u.roles?.includes(filter))
    .filter(u => {
      if (!nearbyRadius || !myLocation) return true
      return haversine(myLocation.latitude, myLocation.longitude, u.latitude, u.longitude) <= nearbyRadius
    })
}
