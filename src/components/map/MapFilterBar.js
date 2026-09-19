import React from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native'
import { colors } from '../../theme'
import { roleMap } from '../../utils/mapShared'
import { mapStyles as s } from './mapStyles'

// Панель фильтров по роли + «Поблизости» — общая для MapScreen.js и
// MapScreen.web.js (см. mapShared.js про причину выноса, 19.09.2026)
export default function MapFilterBar({
  users, filter, setFilter,
  nearbyRadius, gettingLocation, toggleNearby, clearNearby,
  filteredCount,
}) {
  return (
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
                  {r} км {nearbyRadius === r ? `(${filteredCount})` : ''}
                </Text>
              </TouchableOpacity>
            ))}
            {nearbyRadius && (
              <TouchableOpacity style={s.radiusClear} onPress={clearNearby}>
                <Text style={s.radiusClearText}>✕</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </View>
  )
}
