import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Modal, Image, Alert } from 'react-native'
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet'
import L from 'leaflet'
import * as Location from 'expo-location'
import { useAuth } from '../AuthContext'
import { colors } from '../theme'
import ScreenBackground from '../components/ScreenBackground'

const API = 'https://collectors-realm-backend.onrender.com/api'

const roleMap = {
  COLLECTOR: { label: 'Коллекционер', icon: '🗿', color: '#4A90D9' },
  MASTER_REPAIR: { label: 'Мастер по ремонту', icon: '🔧', color: '#E04E28' },
  CUSTOMIZER: { label: 'Кастомизатор', icon: '🎨', color: '#AF52DE' },
  DIORAMA: { label: 'Мастер диорам', icon: '🏔', color: '#34C759' },
}

// react-leaflet рендерит карту напрямую в DOM страницы (без iframe) — на вебе
// вариант через <iframe srcDoc> у части пользователей рендерился сплошным
// чёрным прямоугольником (тайлы грузились, но не композитились браузером),
// баг воспроизводился и с отключённым 3D-transform, и с ручным invalidateSize.
// Прямой DOM-рендер этого класса бага не имеет.
function ensureLeafletCss() {
  if (typeof document === 'undefined' || document.getElementById('leaflet-css')) return
  const link = document.createElement('link')
  link.id = 'leaflet-css'
  link.rel = 'stylesheet'
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
  document.head.appendChild(link)
}

function buildUserIcon(u, r) {
  const base = 'width:38px;height:38px;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);cursor:pointer;'
  const html = u.avatarUrl
    ? `<div style="${base}border:2.5px solid ${r.color};overflow:hidden;background:#eee;"><img src="${u.avatarUrl}" style="width:100%;height:100%;object-fit:cover;display:block;"/></div>`
    : `<div style="${base}background:rgba(255,255,255,0.95);border:2px solid ${r.color};display:flex;align-items:center;justify-content:center;font-size:18px;">${r.icon}</div>`
  return L.divIcon({ html, iconSize: [38, 38], iconAnchor: [19, 19], className: '' })
}

function buildMeIcon() {
  return L.divIcon({
    html: '<div style="background:#E04E28;width:14px;height:14px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.5)"></div>',
    iconSize: [14, 14], iconAnchor: [7, 7], className: '',
  })
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export default function MapScreen({ navigation }) {
  const { token, user: me } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [slowLoad, setSlowLoad] = useState(false)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState(null)
  const [selected, setSelected] = useState(null)
  const [nearbyRadius, setNearbyRadius] = useState(null)
  const [myLocation, setMyLocation] = useState(null)
  const [gettingLocation, setGettingLocation] = useState(false)

  useEffect(() => {
    ensureLeafletCss()
    loadUsers()
  }, [])

  async function loadUsers() {
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
        ? data.filter(u => u.latitude && u.longitude).map(u =>
            me && u.id === me.id && me.avatarUrl && !u.avatarUrl
              ? { ...u, avatarUrl: me.avatarUrl }
              : u
          )
        : []
      setUsers(list)
    } catch (e) {
      setError('Не удалось загрузить карту')
    }
    clearTimeout(slowTimer)
    setSlowLoad(false)
    setLoading(false)
  }

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

  const filtered = users
    .filter(u => !filter || u.roles?.includes(filter))
    .filter(u => {
      if (!nearbyRadius || !myLocation) return true
      return haversine(myLocation.latitude, myLocation.longitude, u.latitude, u.longitude) <= nearbyRadius
    })

  if (loading) return (
    <View style={s.center}>
      <ActivityIndicator color={colors.accent} size="large" />
      <Text style={{ color: colors.text2, marginTop: 12 }}>Загружаем карту...</Text>
      {slowLoad && (
        <Text style={{ color: colors.text2, fontSize: 12, marginTop: 4, textAlign: 'center', paddingHorizontal: 32 }}>
          Сервер просыпается, подождите немного...
        </Text>
      )}
    </View>
  )

  if (error) return (
    <View style={s.center}>
      <Text style={{ fontSize: 40, marginBottom: 8 }}>⚠️</Text>
      <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>Нет соединения</Text>
      <Text style={{ fontSize: 14, color: colors.text2, textAlign: 'center', paddingHorizontal: 32 }}>{error}</Text>
      <TouchableOpacity
        style={{ marginTop: 16, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.accent }}
        onPress={loadUsers}
      >
        <Text style={{ color: 'white', fontSize: 15, fontWeight: '700' }}>↻ Повторить</Text>
      </TouchableOpacity>
    </View>
  )

  const centerLat = myLocation ? myLocation.latitude : 55.7558
  const centerLng = myLocation ? myLocation.longitude : 37.6173
  const zoom = myLocation && nearbyRadius ? (nearbyRadius <= 5 ? 13 : 11) : 5

  const FilterBar = () => (
    <View style={s.filtersWrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
        <TouchableOpacity style={[s.filterBtn, !filter && s.filterBtnActive]} onPress={() => setFilter(null)}>
          <Text style={[s.filterText, !filter && s.filterTextActive]}>Все ({users.length})</Text>
        </TouchableOpacity>
        {Object.entries(roleMap).map(([key, r]) => {
          const count = users.filter(u => u.roles?.includes(key)).length
          const active = filter === key
          return (
            <TouchableOpacity key={key} style={[s.filterBtn, active && { backgroundColor: `${r.color}20`, borderColor: r.color }]} onPress={() => setFilter(active ? null : key)}>
              <Text style={{ fontSize: 14 }}>{r.icon}</Text>
              <Text style={[s.filterText, active && { color: r.color }]}>{r.label} ({count})</Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      <View style={s.nearbyRow}>
        <Text style={s.nearbyLabel}>
          {gettingLocation ? '📡 Определяем...' : '📍 Поблизости:'}
        </Text>
        {gettingLocation ? (
          <ActivityIndicator color={colors.accent} size="small" />
        ) : (
          <>
            {[5, 20].map(r => (
              <TouchableOpacity
                key={r}
                style={[s.radiusBtn, nearbyRadius === r && s.radiusBtnActive]}
                onPress={() => toggleNearby(r)}
              >
                <Text style={[s.radiusText, nearbyRadius === r && s.radiusTextActive]}>
                  {r} км {nearbyRadius === r ? `(${filtered.length})` : ''}
                </Text>
              </TouchableOpacity>
            ))}
            {nearbyRadius && (
              <TouchableOpacity style={s.radiusClear} onPress={() => { setNearbyRadius(null); setMyLocation(null) }}>
                <Text style={s.radiusClearText}>✕</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </View>
  )

  return (
    <ScreenBackground style={s.wrap}>
      <FilterBar />

      {users.length === 0 ? (
        <View style={s.center}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>🗺</Text>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 8 }}>Карта пустая</Text>
          <Text style={{ color: colors.text2, textAlign: 'center', paddingHorizontal: 32 }}>Пользователи появятся когда укажут своё местоположение в профиле</Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <MapContainer
            key={`${centerLat}-${centerLng}-${zoom}`}
            center={[centerLat, centerLng]}
            zoom={zoom}
            style={{ width: '100%', height: '100%' }}
          >
            <TileLayer attribution="© OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

            {myLocation && nearbyRadius && (
              <>
                <Circle
                  center={[myLocation.latitude, myLocation.longitude]}
                  radius={nearbyRadius * 1000}
                  pathOptions={{ color: '#E04E28', fillColor: '#E04E28', fillOpacity: 0.06, weight: 2, dashArray: '6,4' }}
                />
                <Marker position={[myLocation.latitude, myLocation.longitude]} icon={buildMeIcon()}>
                  <Popup><b>Вы здесь</b></Popup>
                </Marker>
              </>
            )}

            {filtered.map(u => {
              const role = u.roles?.[0] || 'COLLECTOR'
              const r = roleMap[role] || roleMap.COLLECTOR
              const badgeLabel = u.badge === 'SHOP' ? '🏪 Магазин' : u.badge === 'BLOGGER' ? '✅ Блогер' : ''
              return (
                <Marker
                  key={u.id}
                  position={[u.latitude, u.longitude]}
                  icon={buildUserIcon(u, r)}
                  eventHandlers={{ click: () => setSelected(u) }}
                >
                  <Popup>
                    <b>{r.icon} {u.name}</b>
                    {badgeLabel ? <span style={{ fontSize: 11, color: '#FF9700' }}> {badgeLabel}</span> : null}
                    <br />
                    {r.label}{u.avgRating ? ` · ⭐ ${u.avgRating.toFixed(1)} (${u.reviewCount})` : ''}
                    {u.city ? <><br />📍 {u.city}</> : null}
                    {u.bio ? <><br /><i>{u.bio}</i></> : null}
                  </Popup>
                </Marker>
              )
            })}
          </MapContainer>
        </View>
      )}

      {/* Карточка пользователя */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setSelected(null)}>
          <View style={s.card}>
            <View style={s.cardHeader}>
              {selected?.avatarUrl ? (
                <Image source={{ uri: selected.avatarUrl }} style={s.avatar} />
              ) : (
                <View style={s.avatarPlaceholder}>
                  <Text style={s.avatarText}>{(selected?.name || '?')[0].toUpperCase()}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={s.cardName}>{selected?.name}</Text>
                {selected?.city ? <Text style={s.cardCity}>📍 {selected.city}</Text> : null}
                {myLocation && selected?.latitude ? (
                  <Text style={s.cardDist}>
                    📏 {haversine(myLocation.latitude, myLocation.longitude, selected.latitude, selected.longitude).toFixed(1)} км от вас
                  </Text>
                ) : null}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                  {(selected?.roles || []).map(r => {
                    const role = roleMap[r]
                    return role ? (
                      <View key={r} style={[s.roleBadge, { backgroundColor: `${role.color}20`, borderColor: `${role.color}50` }]}>
                        <Text style={{ fontSize: 11, color: role.color, fontWeight: '700' }}>{role.icon} {role.label}</Text>
                      </View>
                    ) : null
                  })}
                </View>
              </View>
            </View>
            {selected?.bio ? <Text style={s.cardBio}>{selected.bio}</Text> : null}
            <TouchableOpacity
              style={s.profileBtn}
              onPress={() => {
                setSelected(null)
                navigation.navigate('UserProfileMap', { userId: selected.id })
              }}
            >
              <Text style={s.profileBtnText}>👤 Открыть профиль</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.closeBtn} onPress={() => setSelected(null)}>
              <Text style={s.closeBtnText}>Закрыть</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </ScreenBackground>
  )
}

const s = StyleSheet.create({
  wrap: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg, gap: 12 },
  filtersWrap: { borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  filters: { paddingVertical: 10 },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  filterBtnActive: { backgroundColor: `${colors.accent}20`, borderColor: colors.accent },
  filterText: { fontSize: 13, color: colors.text2, fontWeight: '500' },
  filterTextActive: { color: colors.accent },
  nearbyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border },
  nearbyLabel: { fontSize: 12, color: colors.text2, fontWeight: '600' },
  radiusBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2 },
  radiusBtnActive: { borderColor: colors.accent, backgroundColor: `${colors.accent}20` },
  radiusText: { fontSize: 12, color: colors.text2, fontWeight: '600' },
  radiusTextActive: { color: colors.accent },
  radiusClear: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.surface2, justifyContent: 'center', alignItems: 'center' },
  radiusClearText: { fontSize: 11, color: colors.text2 },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  card: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 12 },
  cardHeader: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  avatar: { width: 60, height: 60, borderRadius: 16 },
  avatarPlaceholder: { width: 60, height: 60, borderRadius: 16, backgroundColor: `${colors.blue}30`, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 24, fontWeight: '800', color: colors.blue },
  cardName: { fontSize: 18, fontWeight: '800', color: colors.text },
  cardCity: { fontSize: 13, color: colors.text2, marginTop: 2 },
  cardDist: { fontSize: 12, color: colors.accent, fontWeight: '600', marginTop: 2 },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  cardBio: { fontSize: 14, color: colors.text2, lineHeight: 20 },
  profileBtn: { backgroundColor: colors.accent, borderRadius: 12, padding: 14, alignItems: 'center' },
  profileBtnText: { color: 'white', fontWeight: '700', fontSize: 15 },
  closeBtn: { backgroundColor: colors.surface2, borderRadius: 12, padding: 14, alignItems: 'center' },
  closeBtnText: { color: colors.text2, fontWeight: '600', fontSize: 15 },
})
