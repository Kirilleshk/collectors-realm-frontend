import React, { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native'
import { WebView } from 'react-native-webview'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../AuthContext'
import { colors } from '../theme'
import ScreenBackground from '../components/ScreenBackground'
import BrandHeader from '../components/BrandHeader'
import MapFilterBar from '../components/map/MapFilterBar'
import MapUserCardModal from '../components/map/MapUserCardModal'
import { mapStyles as s } from '../components/map/mapStyles'
import { roleMap, useMapUsers, useNearbyLocation, filterMapUsers } from '../utils/mapShared'

// Мобильная карта — рендерится через WebView + чистый Leaflet (не react-leaflet,
// у него нет нативного биндинга). Веб-версия — отдельный файл MapScreen.web.js
// (react-leaflet, прямой DOM-рендер), Metro сам подставляет его на вебе по
// расширению `.web.js` — эта ветка на вебе НИКОГДА не грузится, поэтому
// здесь нет ни iframe-фолбэка, ни window.postMessage-моста (были раньше,
// оказались мёртвым кодом — см. чистку техдолга 19.09.2026).
function getMapHTML(users, myLocation = null, radius = null) {
  const markers = users.map(u => {
    const role = u.roles?.[0] || 'COLLECTOR'
    const r = roleMap[role] || roleMap.COLLECTOR
    const badgeLabel = u.badge === 'SHOP' ? '🏪 Магазин' : u.badge === 'BLOGGER' ? '✅ Блогер' : ''
    const ratingLabel = u.avgRating ? `⭐ ${u.avgRating.toFixed(1)} (${u.reviewCount})` : ''
    return `{
      id: ${JSON.stringify(u.id)},
      lat: ${u.latitude}, lng: ${u.longitude},
      name: ${JSON.stringify(u.name)},
      city: ${JSON.stringify(u.city || '')},
      bio: ${JSON.stringify(u.bio && u.bio.length > 160 ? u.bio.slice(0, 160).trimEnd() + '…' : (u.bio || ''))},
      role: ${JSON.stringify(r.label)},
      icon: ${JSON.stringify(r.icon)},
      color: ${JSON.stringify(r.color)},
      avatar: ${JSON.stringify(u.avatarUrl || '')},
      badge: ${JSON.stringify(badgeLabel)},
      rating: ${JSON.stringify(ratingLabel)}
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
<meta name="color-scheme" content="light">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { background: #ffffff; }
html, body, #map { width: 100%; height: 100vh; }
.custom-marker {
  background: rgba(255,255,255,0.95);
  border-radius: 50%;
  border: 2px solid;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  width: 38px;
  height: 38px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  cursor: pointer;
}
.avatar-marker {
  border-radius: 50%;
  border: 2.5px solid;
  display: block;
  width: 38px;
  height: 38px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.35);
  cursor: pointer;
  background: #eee;
}
.avatar-marker img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
</style>
</head>
<body>
<div id="map"></div>
<script>
L.Browser.any3d = false;
var map = L.map('map').setView([${centerLat}, ${centerLng}], ${zoom});
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap'
}).addTo(map);

${nearbyCode}

var users = [${markers}];
users.forEach(function(u) {
  var markerHtml = u.avatar
    ? '<div class="avatar-marker" style="border-color:' + u.color + '"><img src="' + u.avatar + '"/></div>'
    : '<div class="custom-marker" style="border-color:' + u.color + ';background:' + u.color + '22">' + u.icon + '</div>';
  var icon = L.divIcon({
    html: markerHtml,
    iconSize: [38, 38], iconAnchor: [19, 19], className: ''
  });
  var marker = L.marker([u.lat, u.lng], {icon: icon}).addTo(map);
  marker.on('click', function() {
    window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'USER_CLICK', userId: u.id }));
  });
  marker.bindPopup('<b>' + u.icon + ' ' + u.name + '</b>' + (u.badge ? ' <span style="font-size:11px;color:#FF9700">' + u.badge + '</span>' : '') + '<br/>' + u.role + (u.rating ? ' · ' + u.rating : '') + (u.city ? '<br/>📍 ' + u.city : '') + (u.bio ? '<br/><i>' + u.bio + '</i>' : ''));
});

[100, 300, 800].forEach(function(delay) {
  setTimeout(function() { map.invalidateSize(); }, delay);
});
</script>
</body>
</html>`
}

export default function MapScreen({ navigation }) {
  const insets = useSafeAreaInsets()
  const { token, user: me } = useAuth()
  const { users, usersRef, loading, slowLoad, error, loadUsers } = useMapUsers(token, me)
  const { nearbyRadius, myLocation, gettingLocation, toggleNearby, clearNearby } = useNearbyLocation()
  const [filter, setFilter] = useState(null)
  const [selected, setSelected] = useState(null)

  useEffect(() => { loadUsers() }, [])

  function handleWebViewMessage(event) {
    try {
      const data = JSON.parse(event.nativeEvent.data)
      if (data.type === 'USER_CLICK') {
        const user = usersRef.current.find(u => u.id === data.userId)
        if (user) setSelected(user)
      }
    } catch (e) {}
  }

  const filtered = filterMapUsers(users, filter, nearbyRadius, myLocation)

  if (loading) return (
    <View style={[s.center, { paddingTop: insets.top }]}>
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
    <View style={[s.center, { paddingTop: insets.top }]}>
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

  return (
    <ScreenBackground style={s.wrap}>
      <BrandHeader insets={insets} />
      <MapFilterBar
        users={users}
        filter={filter}
        setFilter={setFilter}
        nearbyRadius={nearbyRadius}
        gettingLocation={gettingLocation}
        toggleNearby={toggleNearby}
        clearNearby={clearNearby}
        filteredCount={filtered.length}
      />

      {users.length === 0 ? (
        <View style={s.center}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>🗺</Text>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 8 }}>Карта пустая</Text>
          <Text style={{ color: colors.text2, textAlign: 'center', paddingHorizontal: 32 }}>Пользователи появятся когда укажут своё местоположение в профиле</Text>
        </View>
      ) : (
        <WebView
          source={{ html: getMapHTML(filtered, myLocation, nearbyRadius) }}
          style={{ flex: 1 }}
          onMessage={handleWebViewMessage}
        />
      )}

      <MapUserCardModal
        selected={selected}
        onClose={() => setSelected(null)}
        myLocation={myLocation}
        onOpenProfile={(u) => { setSelected(null); navigation.navigate('UserProfileMap', { userId: u.id }) }}
      />
    </ScreenBackground>
  )
}
