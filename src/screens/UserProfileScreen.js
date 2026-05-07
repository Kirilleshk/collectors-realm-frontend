import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Image, TouchableOpacity, Linking } from 'react-native'
import { colors } from '../theme'

const API = 'https://collectors-realm-backend.onrender.com/api'

const roleMap = {
  COLLECTOR: { label: 'Коллекционер', color: colors.blue, icon: '🗿' },
  MASTER_REPAIR: { label: 'Мастер по ремонту', color: colors.accent, icon: '🔧' },
  CUSTOMIZER: { label: 'Кастомизатор', color: colors.purple, icon: '🎨' },
  DIORAMA: { label: 'Мастер диорам', color: colors.green, icon: '🏔' },
}

export default function UserProfileScreen({ route, navigation }) {
  const { userId } = route.params
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [userId])

  async function load() {
    try {
      const res = await fetch(`${API}/users/${userId}`)
      const data = await res.json()
      setUser(data)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  if (loading) return (
    <View style={s.center}><ActivityIndicator color={colors.accent} size="large" /></View>
  )

  if (!user) return (
    <View style={s.center}><Text style={{ color: colors.text2 }}>Пользователь не найден</Text></View>
  )

  const initials = (user.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <ScrollView style={s.wrap} showsVerticalScrollIndicator={false}>
      {/* Шапка */}
      <View style={s.header}>
        {user.avatarUrl
          ? <Image source={{ uri: user.avatarUrl }} style={s.avatar} />
          : (
            <View style={s.avatarPlaceholder}>
              <Text style={s.avatarText}>{initials}</Text>
            </View>
          )
        }
        <Text style={s.name}>{user.name}</Text>
        {user.city ? <Text style={s.city}>📍 {user.city}</Text> : null}

        {/* Роли */}
        <View style={s.roles}>
          {(user.roles || []).map(r => {
            const role = roleMap[r]
            return role ? (
              <View key={r} style={[s.roleBadge, { backgroundColor: `${role.color}25`, borderColor: `${role.color}50` }]}>
                <Text style={s.roleIcon}>{role.icon}</Text>
                <Text style={[s.roleText, { color: role.color }]}>{role.label}</Text>
              </View>
            ) : null
          })}
        </View>
      </View>

      {/* О себе */}
      {user.bio ? (
        <View style={s.section}>
          <Text style={s.sectionTitle}>О себе</Text>
          <Text style={s.bio}>{user.bio}</Text>
        </View>
      ) : null}

      {/* Портфолио */}
      {user.portfolioPhotos?.length > 0 ? (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Портфолио ({user.portfolioPhotos.length})</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {user.portfolioPhotos.map((photo, i) => (
                <Image key={i} source={{ uri: photo.url }} style={s.portfolioImg} resizeMode="cover" />
              ))}
            </View>
          </ScrollView>
        </View>
      ) : null}

      {/* Кнопка написать */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Связаться</Text>
        <TouchableOpacity
          style={s.contactBtn}
          onPress={() => Linking.openURL(`https://t.me/collector_realm_shop`)}
        >
          <Text style={s.contactBtnIcon}>✈️</Text>
          <Text style={s.contactBtnText}>Написать в Telegram</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  )
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  header: { alignItems: 'center', paddingTop: 32, paddingBottom: 24, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: colors.border },
  avatar: { width: 90, height: 90, borderRadius: 24, marginBottom: 16 },
  avatarPlaceholder: { width: 90, height: 90, borderRadius: 24, backgroundColor: `${colors.blue}30`, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: `${colors.blue}60`, marginBottom: 16 },
  avatarText: { fontSize: 32, fontWeight: '800', color: colors.blue },
  name: { fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 6 },
  city: { fontSize: 13, color: colors.text2, marginBottom: 12 },
  roles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  roleIcon: { fontSize: 14 },
  roleText: { fontSize: 12, fontWeight: '700' },
  section: { paddingHorizontal: 16, marginTop: 20 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: colors.text2, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 },
  bio: { fontSize: 15, color: colors.text, lineHeight: 22 },
  portfolioImg: { width: 120, height: 120, borderRadius: 12 },
  contactBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#229ED9', borderRadius: 14, padding: 16 },
  contactBtnIcon: { fontSize: 20 },
  contactBtnText: { color: 'white', fontSize: 16, fontWeight: '700' },
})