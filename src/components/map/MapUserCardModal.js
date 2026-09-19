import React from 'react'
import { View, Text, TouchableOpacity, ScrollView, Modal, Image } from 'react-native'
import { roleMap, haversine } from '../../utils/mapShared'
import { mapStyles as s } from './mapStyles'

// Карточка пользователя по тапу на маркер — общая для MapScreen.js и
// MapScreen.web.js (см. mapShared.js про причину выноса, 19.09.2026)
export default function MapUserCardModal({ selected, onClose, onOpenProfile, myLocation }) {
  return (
    <Modal visible={!!selected} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <View style={s.card}>
          <ScrollView style={s.cardScroll} contentContainerStyle={{ gap: 12 }}>
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
            {selected?.bio ? <Text style={s.cardBio} numberOfLines={6} ellipsizeMode="tail">{selected.bio}</Text> : null}
          </ScrollView>
          <TouchableOpacity style={s.profileBtn} onPress={() => onOpenProfile(selected)}>
            <Text style={s.profileBtnText}>👤 Открыть профиль</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.closeBtn} onPress={onClose}>
            <Text style={s.closeBtnText}>Закрыть</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  )
}
