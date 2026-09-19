import React, { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native'
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet'
import L from 'leaflet'
import { useAuth } from '../AuthContext'
import { colors } from '../theme'
import ScreenBackground from '../components/ScreenBackground'
import BrandHeader from '../components/BrandHeader'
import MapFilterBar from '../components/map/MapFilterBar'
import MapUserCardModal from '../components/map/MapUserCardModal'
import { mapStyles as s } from '../components/map/mapStyles'
import { roleMap, useMapUsers, useNearbyLocation, filterMapUsers } from '../utils/mapShared'

// Веб-карта — react-leaflet, прямой DOM-рендер (не iframe, см. комментарий
// у ensureLeafletCss). Общая логика (загрузка/фильтр пользователей, «Поблизости»,
// панель фильтров, карточка пользователя, стили) — в mapShared.js и
// src/components/map/, чтобы не дублировать с мобильной MapScreen.js
// (см. чистку техдолга 19.09.2026).

// Найдено 19.08 при живой проверке: анкета коллекционера (10.08) разрешила
// bio до 3000 символов, а карточка пользователя на карте выводила его целиком
// без обрезки — у аккаунта с длинным bio весь низ карточки превращался в
// сплошную стену текста, кнопки "Открыть профиль"/"Закрыть" утекали за пределы
// экрана без возможности прокрутки. Leaflet-попап (простой HTML/JSX, не
// понимает RN numberOfLines) обрезаем вручную здесь же.
function truncateBio(text, max = 160) {
  if (!text) return text
  return text.length > max ? text.slice(0, max).trimEnd() + '…' : text
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

export default function MapScreen({ navigation }) {
  const { token, user: me } = useAuth()
  const { users, loading, slowLoad, error, loadUsers } = useMapUsers(token, me)
  const { nearbyRadius, myLocation, gettingLocation, toggleNearby, clearNearby } = useNearbyLocation()
  const [filter, setFilter] = useState(null)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    ensureLeafletCss()
    loadUsers()
  }, [])

  const filtered = filterMapUsers(users, filter, nearbyRadius, myLocation)

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

  return (
    <ScreenBackground style={s.wrap}>
      <BrandHeader />
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
                    {/* maxWidth+overflowWrap — на случай длинного "слова" без пробелов
                        (вставленная ссылка и т.п.) в имени/bio: truncateBio выше режет
                        по числу символов, но сам по себе не гарантирует перенос строки,
                        а у Leaflet-попапа нет RN numberOfLines — без этой обёртки такой
                        текст рисуется одной сплошной строкой далеко за пределы карты. */}
                    <div style={{ maxWidth: 220, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                      <b>{r.icon} {u.name}</b>
                      {badgeLabel ? <span style={{ fontSize: 11, color: '#FF9700' }}> {badgeLabel}</span> : null}
                      <br />
                      {r.label}{u.avgRating ? ` · ⭐ ${u.avgRating.toFixed(1)} (${u.reviewCount})` : ''}
                      {u.city ? <><br />📍 {u.city}</> : null}
                      {u.bio ? <><br /><i>{truncateBio(u.bio)}</i></> : null}
                    </div>
                  </Popup>
                </Marker>
              )
            })}
          </MapContainer>
        </View>
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
