import React, { useState, useEffect, useRef } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Modal, Image, Platform, Alert } from 'react-native'
import { WebView } from 'react-native-webview'
import * as Location from 'expo-location'
import { useAuth } from '../AuthContext'
import { colors } from '../theme'

const API = 'https://collectors-realm-backend.onrender.com/api'

const roleMap = {
  COLLECTOR: { label: 'Коллекционер', icon: '🗿', color: '#4A90D9' },
  MASTER_REPAIR: { label: 'Мастер по ремонту', icon: '🔧', color: '#E04E28' },
  CUSTOMIZER: { label: 'Кастомизатор', icon: '🎨', color: '#AF52DE' },
  DIORAMA: { label: 'Мастер диорам', icon: '🏔', color: '#34C759' },
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function getMapHTML(users, myLocation = null, radius = null) {
  const markers = users.map(u => {
    const role = u.roles?.[0] || 'COLLECTOR'
    const r = roleMap[role] || roleMap.COLLECTOR
    return `{
      id: ${JSON.stringify(u.id)},
      lat: ${u.latitude}, lng: ${u.longitude},
      name: ${JSON.stringify(u.name)},
      city: ${JSON.stringify(u.city || '')},
      bio: ${JSON.stringify(u.bio || '')},
      role: ${JSON.stringify(r.label)},
      icon: ${JSON.stringify(r.icon)},
      color: ${JSON.stringify(r.color)}
    }`
  }).join(',')

  const centerLat = myLocation ? myLocation.latitude : 55.7558
  const centerLng = myLocation ? myLocation.longitude : 37.6173
  const zoom = myLocation && radius ? (radius <= 5 ? 13 : 11) : 5

  const nearbyCode = myLocation && radius ? `
    L.circle([${myLocation.latitude}, ${myLocation.longitude}], {
      radius: ${radius * 1000},
      color: '#E04E28',
      fillColor: '#E04E28',
      fillOpacity: 0.06,
      weight: 2,
      dashArray: '6,4'
    }).addTo(map);
    var myIcon = L.divIcon({
      html: '<div style="background:#E04E28;width:14px;height:14px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.5)"></div>',
      iconSize: [14, 14], iconAnchor: [7, 7], className: ''
    });
    L.marker([${myLocation.latitude}, ${myLocation.longitude}], {icon: myIcon})
      .bindPopup('<b>Вы здесь</b>')
      .addTo(map);
  ` : ''

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body, #map { width: 100%; height: 100vh; }
.custom-marker {
  background: rgba(255,255,255,0.95);
  border-radius: 50%;
  border: 2px solid;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  width: 36px;
  height: 36px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  cursor: pointer;
}
</style>
</head>
<body>
<div id="map"></div>
<script>
var map = L.map('map').setView([${centerLat}, ${centerLng}], ${zoom});
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap'
}).addTo(map);

${nearbyCode}

var users = [${markers}];
users.forEach(function(u) {
  var icon = L.divIcon({
    html: '<div class="custom-marker" style="border-color:' + u.color + ';background:' + u.color + '22">' + u.icon + '</div>',
    iconSize: [36, 36], iconAnchor: [18, 18], className: ''
  });
  var marker = L.marker([u.lat, u.lng], {icon: icon}).addTo(map);
  marker.on('click', function() {
    window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'USER_CLICK', userId: u.id }));
    window.parent && window.parent.postMessage(JSON.stringify({ type: 'USER_CLICK', userId: u.id }), '*');
  });
  marker.bindPopup('<b>' + u.icon + ' ' + u.name + '</b><br/>' + u.role + (u.city ? '<br/>📍 ' + u.city : '') + (u.bio ? '<br/><i>' + u.bio + '</i>' : ''));
});
</script>
</body>
</html>`
}

export default function MapScreen({ navigation }) {
  const { token } = useAuth()
  const [users, setUsers] = useState([])
  const usersRef = useRef([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState(null)
  const [selected, setSelected] = useState(null)
  const [nearbyRadius, setNearbyRadius] = useState(null)
  const [myLocation, setMyLocation] = useState(null)
  const [gettingLocation, setGettingLocation] = useState(false)

  useEffect(() => {
    loadUsers()
    if (Platform.OS === 'web') {
      window.addEventListener('message', handleWebMessage)
      return () => window.removeEventListener('message', handleWebMessage)
    }
  }, [])

  function handleWebMessage(event) {
    try {
      const data = JSON.parse(event.data)
      if (data.type === 'USER_CLICK') {
        const user = usersRef.current.find(u => u.id === data.userId)
        if (user) setSelected(user)
      }
    } catch (e) {}
  }

  async function loadUsers() {
    try {
      const res = await fetch(`${API}/users`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      const list = Array.isArray(data) ? data.filter(u => u.latitude && u.longitude) : []
      setUsers(list)
      usersRef.current = list
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  function handleWebViewMessage(event) {
    try {
      const data = JSON.parse(event.nativeEvent.data)
      if (data.type === 'USER_CLICK') {
        const user = users.find(u => u.id === data.userId)
        if (user) setSelected(user)
      }
    } catch (e) {}
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
    </View>
  )

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

      {/* Кнопки "Поблизости" */}
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
    <View style={s.wrap}>
      <FilterBar />

      {users.length === 0 ? (
        <View style={s.center}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>🗺</Text>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 8 }}>Карта пустая</Text>
          <Text style={{ color: colors.text2, textAlign: 'center', paddingHorizontal: 32 }}>Пользователи появятся когда укажут своё местоположение в профиле</Text>
        </View>
      ) : Platform.OS === 'web' ? (
        <iframe
          srcDoc={getMapHTML(filtered, myLocation, nearbyRadius)}
          style={{ flex: 1, border: 'none', width: '100%', height: '100%' }}
          title="map"
        />
      ) : (
        <WebView
          source={{ html: getMapHTML(filtered, myLocation, nearbyRadius) }}
          style={{ flex: 1 }}
          onMessage={handleWebViewMessage}
        />
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
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
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
