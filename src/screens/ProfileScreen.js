import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Image, Modal, KeyboardAvoidingView, Platform } from 'react-native'
import * as Location from 'expo-location'
import { useAuth } from '../AuthContext'
import { colors } from '../theme'
import { pickAndUploadPhoto } from '../utils/uploadPhoto'
import SmartInput from '../utils/SmartInput'
import { HELP_ITEMS } from '../utils/WhatsNewModal'
import { CHANGELOG, CURRENT_VERSION } from '../utils/changelog'

let Updates = null
try { Updates = require('expo-updates') } catch (e) {}

const CLOUD_NAME = 'dqutmb1rm'
const UPLOAD_PRESET = 'collectors_realm'
const API = 'https://collectors-realm-backend.onrender.com/api'

const roleMap = {
  COLLECTOR: { label: 'Коллекционер', color: colors.blue },
  MASTER_REPAIR: { label: 'Мастер по ремонту', color: colors.accent },
  CUSTOMIZER: { label: 'Кастомизатор', color: colors.purple },
  DIORAMA: { label: 'Мастер диорам', color: colors.green },
}

const ALL_ROLES = ['COLLECTOR', 'MASTER_REPAIR', 'CUSTOMIZER', 'DIORAMA']
const MASTER_ROLES = ['MASTER_REPAIR', 'CUSTOMIZER', 'DIORAMA']

export default function ProfileScreen() {
  const { user, token, logout, updateUser } = useAuth()
  const [editModal, setEditModal] = useState(false)
  const [profileTab, setProfileTab] = useState('profile')
  const [form, setForm] = useState({ name: user?.name || '', city: user?.city || '', bio: user?.bio || '', roles: user?.roles || [] })
  const [saving, setSaving] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || null)
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [locating, setLocating] = useState(false)
  const [portfolio, setPortfolio] = useState([])

  useEffect(() => {
    fetch(`${API}/users/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data.portfolioPhotos)) {
          setPortfolio(data.portfolioPhotos.map(p => p.url))
        }
      })
      .catch(() => {})
  }, [token])
  const [uploadingPortfolio, setUploadingPortfolio] = useState(false)

  const initials = (user?.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const isMaster = (user?.roles || []).some(r => MASTER_ROLES.includes(r))

  async function pickAvatar() {
    setUploadingAvatar(true)
    const url = await pickAndUploadPhoto()
    if (url) {
      setAvatarUrl(url)
      await fetch(`${API}/users/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ avatarUrl: url }),
      })
      await updateUser({ avatarUrl: url })
    }
    setUploadingAvatar(false)
  }

  async function pickPortfolioPhoto() {
    if (portfolio.length >= 5) { Alert.alert('Максимум 5 фото в портфолио'); return }
    setUploadingPortfolio(true)
    const url = await pickAndUploadPhoto()
    if (url) {
      const newPortfolio = [...portfolio, url]
      setPortfolio(newPortfolio)
      await fetch(`${API}/users/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ portfolioUrls: newPortfolio }),
      })
    }
    setUploadingPortfolio(false)
  }

  async function removePortfolioPhoto(index) {
    const newPortfolio = portfolio.filter((_, i) => i !== index)
    setPortfolio(newPortfolio)
    await fetch(`${API}/users/me`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ portfolioUrls: newPortfolio })
    })
  }

  async function handleLocation() {
    setLocating(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') { Alert.alert('Нужно разрешение на геолокацию'); setLocating(false); return }
      const loc = await Location.getCurrentPositionAsync({})
      const { latitude, longitude } = loc.coords
      const geo = await Location.reverseGeocodeAsync({ latitude, longitude })
      const city = geo?.[0]?.city || geo?.[0]?.region || ''
      await fetch(`${API}/users/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ latitude, longitude, city })
      })
      await updateUser({ latitude, longitude, city })
      Alert.alert('✅ Местоположение сохранено!', city ? `Город: ${city}` : 'Координаты сохранены')
    } catch (e) { Alert.alert('Ошибка геолокации', e.message) }
    setLocating(false)
  }

  async function handleSave() {
    if (!form.name.trim()) { Alert.alert('Введите имя'); return }
    setSaving(true)
    try {
      const res = await fetch(`${API}/users/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: form.name.trim(), city: form.city.trim(), bio: form.bio.trim(), roles: form.roles })
      })
      const data = await res.json()
      if (data.error) { Alert.alert('Ошибка', data.error); setSaving(false); return }
      await updateUser({ name: form.name.trim(), city: form.city.trim(), bio: form.bio.trim(), roles: form.roles })
      setEditModal(false)
      Alert.alert('✅ Профиль обновлён!')
    } catch (e) { Alert.alert('Ошибка', e.message) }
    setSaving(false)
  }

  async function checkForUpdate() {
    if (!Updates || __DEV__) {
      Alert.alert('Обновления', 'OTA-обновления доступны только в production-сборке (APK/EAS Build)')
      return
    }
    setCheckingUpdate(true)
    try {
      const result = await Updates.checkForUpdateAsync()
      if (result.isAvailable) {
        Alert.alert('Доступно обновление!', 'Загрузить и применить сейчас?', [
          { text: 'Отмена', style: 'cancel' },
          { text: 'Обновить', onPress: async () => {
            await Updates.fetchUpdateAsync()
            await Updates.reloadAsync()
          }},
        ])
      } else {
        Alert.alert('Обновлений нет', 'У вас последняя версия приложения')
      }
    } catch (e) {
      Alert.alert('Ошибка', 'Не удалось проверить обновления')
    }
    setCheckingUpdate(false)
  }

  function toggleRole(role) {
    setForm(p => ({
      ...p,
      roles: p.roles.includes(role) ? p.roles.filter(r => r !== role) : [...p.roles, role]
    }))
  }

  return (
    <ScrollView style={s.wrap} showsVerticalScrollIndicator={false}>

      {/* Переключатель вкладок профиля */}
      <View style={s.profileTabs}>
        <TouchableOpacity style={[s.profileTab, profileTab === 'profile' && s.profileTabActive]} onPress={() => setProfileTab('profile')}>
          <Text style={[s.profileTabText, profileTab === 'profile' && s.profileTabTextActive]}>👤 Профиль</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.profileTab, profileTab === 'help' && s.profileTabActive]} onPress={() => setProfileTab('help')}>
          <Text style={[s.profileTabText, profileTab === 'help' && s.profileTabTextActive]}>❓ Помощь</Text>
        </TouchableOpacity>
      </View>

      {/* Вкладка помощи */}
      {profileTab === 'help' && (
        <View style={{ padding: 16, gap: 20 }}>
          {/* Все функции */}
          <View>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 12 }}>Как пользоваться приложением</Text>
            <View style={{ gap: 10 }}>
              {HELP_ITEMS.map((item, i) => (
                <View key={i} style={{ backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 16, flexDirection: 'row', gap: 14 }}>
                  <Text style={{ fontSize: 26 }}>{item.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 4 }}>{item.title}</Text>
                    <Text style={{ fontSize: 13, color: colors.text2, lineHeight: 18 }}>{item.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* История обновлений */}
          <View>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 12 }}>История обновлений</Text>
            {CHANGELOG.map(release => (
              <View key={release.version} style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <View style={{ backgroundColor: release.version === CURRENT_VERSION ? colors.accent : colors.surface2, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: release.version === CURRENT_VERSION ? 'white' : colors.text2 }}>v{release.version}</Text>
                  </View>
                  <Text style={{ fontSize: 12, color: colors.text2 }}>{release.date}</Text>
                </View>
                <View style={{ gap: 6 }}>
                  {release.changes.map((c, i) => (
                    <View key={i} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                      <Text style={{ fontSize: 16 }}>{c.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{c.title}</Text>
                        <Text style={{ fontSize: 12, color: colors.text2, lineHeight: 17 }}>{c.desc}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {profileTab !== 'help' && <>
      {/* Шапка */}
      <View style={s.headerWrap}>
        <TouchableOpacity onPress={pickAvatar} style={s.avatarWrap} disabled={uploadingAvatar}>
          {uploadingAvatar ? (
            <View style={s.avatar}><ActivityIndicator color={colors.accent} /></View>
          ) : avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={s.avatarImg} />
          ) : (
            <View style={s.avatar}><Text style={s.avatarText}>{initials}</Text></View>
          )}
          <View style={s.avatarEditBadge}><Text style={{ color: 'white', fontSize: 10 }}>📷</Text></View>
        </TouchableOpacity>

        <Text style={s.name}>{user?.name}</Text>
        {user?.badge === 'SHOP' && (
          <View style={s.badgeWrap}>
            <Text style={[s.badgeText, { color: '#FF9700', borderColor: '#FF970060', backgroundColor: '#FF970015' }]}>🏪 Магазин</Text>
          </View>
        )}
        {user?.badge === 'BLOGGER' && (
          <View style={s.badgeWrap}>
            <Text style={[s.badgeText, { color: '#007AFF', borderColor: '#007AFF60', backgroundColor: '#007AFF15' }]}>✅ Блогер</Text>
          </View>
        )}
        {user?.city ? <Text style={s.city}>📍 {user.city}</Text> : null}

        <View style={s.roles}>
          {(user?.roles || []).map(r => {
            const role = roleMap[r]
            return role ? (
              <View key={r} style={[s.roleBadge, { backgroundColor: `${role.color}25`, borderColor: `${role.color}50` }]}>
                <Text style={[s.roleText, { color: role.color }]}>{role.label}</Text>
              </View>
            ) : null
          })}
        </View>

        <TouchableOpacity style={s.editBtn} onPress={() => {
          setForm({ name: user?.name || '', city: user?.city || '', bio: user?.bio || '', roles: user?.roles || [] })
          setEditModal(true)
        }}>
          <Text style={s.editBtnText}>✏️ Редактировать профиль</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[s.editBtn, { marginTop: 8, borderColor: `${colors.green}40`, backgroundColor: `${colors.green}10` }]} onPress={handleLocation} disabled={locating}>
          {locating
            ? <ActivityIndicator color={colors.green} size="small" />
            : <Text style={[s.editBtnText, { color: colors.green }]}>📍 Указать моё местоположение</Text>
          }
        </TouchableOpacity>
      </View>

      {/* О себе */}
      {user?.bio ? (
        <View style={s.section}>
          <Text style={s.sectionTitle}>О себе</Text>
          <Text style={s.bio}>{user.bio}</Text>
        </View>
      ) : null}

      {/* Портфолио — только для мастеров */}
      {isMaster ? (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Портфолио ({portfolio.length}/5)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {portfolio.map((url, i) => (
                <View key={i} style={{ position: 'relative' }}>
                  <Image source={{ uri: url }} style={s.portfolioImg} />
                  <TouchableOpacity
                    style={s.portfolioRemove}
                    onPress={() => removePortfolioPhoto(i)}
                  >
                    <Text style={{ color: 'white', fontSize: 10, fontWeight: '700' }}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {portfolio.length < 5 && (
                <TouchableOpacity style={s.portfolioAdd} onPress={pickPortfolioPhoto} disabled={uploadingPortfolio}>
                  {uploadingPortfolio
                    ? <ActivityIndicator color={colors.accent} />
                    : <Text style={{ fontSize: 28, color: colors.text2 }}>+</Text>
                  }
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </View>
      ) : null}

      {/* Аккаунт */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Аккаунт</Text>
        <View style={s.infoCard}>
          <View style={s.infoRow}>
            <Text style={s.infoIcon}>📧</Text>
            <View>
              <Text style={s.infoLabel}>Email</Text>
              <Text style={s.infoValue}>{user?.email || '—'}</Text>
            </View>
          </View>
          <View style={s.divider} />
          <View style={s.infoRow}>
            <Text style={s.infoIcon}>🆔</Text>
            <View>
              <Text style={s.infoLabel}>ID пользователя</Text>
              <Text style={s.infoValue}>#{user?.id?.slice(0, 8) || '—'}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Обновление приложения */}
      <TouchableOpacity style={s.updateBtn} onPress={checkForUpdate} disabled={checkingUpdate}>
        {checkingUpdate
          ? <ActivityIndicator color={colors.blue} size="small" />
          : <Text style={s.updateIcon}>🔄</Text>
        }
        <Text style={s.updateText}>Проверить обновления</Text>
      </TouchableOpacity>

      {/* Выход */}
      <TouchableOpacity style={s.logoutBtn} onPress={logout}>
        <Text style={s.logoutIcon}>🚪</Text>
        <Text style={s.logoutText}>Выйти из аккаунта</Text>
      </TouchableOpacity>
      <View style={{ height: 32 }} />

      {/* Модал редактирования */}
      <Modal visible={editModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={s.modal} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.modalHead}>
            <Text style={s.modalTitle}>Редактировать профиль</Text>
            <TouchableOpacity onPress={() => setEditModal(false)}>
              <Text style={{ fontSize: 20, color: colors.text2 }}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            <Text style={s.label}>ИМЯ *</Text>
            <SmartInput style={s.input} value={form.name} onChangeText={v => setForm(p => ({ ...p, name: v }))} placeholder="Ваше имя" placeholderTextColor={colors.text2} />

            <Text style={s.label}>ГОРОД</Text>
            <SmartInput style={s.input} value={form.city} onChangeText={v => setForm(p => ({ ...p, city: v }))} placeholder="Москва, Санкт-Петербург..." placeholderTextColor={colors.text2} />

            <Text style={s.label}>О СЕБЕ</Text>
            <SmartInput style={[s.input, { height: 100, textAlignVertical: 'top' }]} value={form.bio} onChangeText={v => setForm(p => ({ ...p, bio: v }))} placeholder="Расскажите о себе (до 500 символов)" placeholderTextColor={colors.text2} multiline maxLength={500} />

            <Text style={s.label}>РОЛИ</Text>
            <View style={{ gap: 8, marginBottom: 16 }}>
              {ALL_ROLES.map(role => {
                const r = roleMap[role]
                const active = form.roles.includes(role)
                return (
                  <TouchableOpacity key={role} onPress={() => toggleRole(role)}
                    style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: active ? r.color : colors.border, backgroundColor: active ? `${r.color}15` : colors.surface, gap: 10 }}>
                    <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: active ? r.color : colors.border, backgroundColor: active ? r.color : 'transparent', justifyContent: 'center', alignItems: 'center' }}>
                      {active && <Text style={{ color: 'white', fontSize: 12 }}>✓</Text>}
                    </View>
                    <Text style={{ color: active ? r.color : colors.text, fontWeight: active ? '700' : '400', fontSize: 15 }}>{r.label}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="white" /> : <Text style={{ color: 'white', fontSize: 16, fontWeight: '700' }}>Сохранить</Text>}
            </TouchableOpacity>
            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
      </>}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  profileTabs: { flexDirection: 'row', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  profileTab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  profileTabActive: { borderBottomWidth: 2, borderBottomColor: colors.accent },
  profileTabText: { fontSize: 14, fontWeight: '600', color: colors.text2 },
  profileTabTextActive: { color: colors.accent },
  headerWrap: { alignItems: 'center', paddingTop: 40, paddingBottom: 24, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: colors.border },
  avatarWrap: { position: 'relative', marginBottom: 16 },
  avatar: { width: 88, height: 88, borderRadius: 24, backgroundColor: `${colors.blue}30`, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: `${colors.blue}60` },
  avatarImg: { width: 88, height: 88, borderRadius: 24 },
  avatarText: { fontSize: 32, fontWeight: '800', color: colors.blue },
  avatarEditBadge: { position: 'absolute', bottom: -4, right: -4, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center' },
  name: { fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 6 },
  badgeWrap: { marginBottom: 8 },
  badgeText: { fontSize: 12, fontWeight: '700', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  city: { fontSize: 13, color: colors.text2, marginBottom: 12 },
  roles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 16 },
  roleBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  roleText: { fontSize: 12, fontWeight: '700' },
  editBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: colors.surface },
  editBtnText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  section: { paddingHorizontal: 16, marginBottom: 16, marginTop: 16 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: colors.text2, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 },
  bio: { fontSize: 15, color: colors.text, lineHeight: 22 },
  portfolioImg: { width: 100, height: 100, borderRadius: 12 },
  portfolioRemove: { position: 'absolute', top: -6, right: -6, width: 20, height: 20, backgroundColor: 'rgba(255,59,48,0.9)', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  portfolioAdd: { width: 100, height: 100, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  infoCard: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  infoIcon: { fontSize: 20 },
  infoLabel: { fontSize: 11, color: colors.text2, fontWeight: '600', marginBottom: 2 },
  infoValue: { fontSize: 14, color: colors.text, fontWeight: '500' },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: 16 },
  updateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, marginBottom: 10, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: `${colors.blue}40`, backgroundColor: `${colors.blue}10` },
  updateIcon: { fontSize: 18 },
  updateText: { color: colors.blue, fontSize: 15, fontWeight: '600' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, margin: 16, marginTop: 0, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: `${colors.accent}40`, backgroundColor: `${colors.accent}10` },
  logoutIcon: { fontSize: 18 },
  logoutText: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  modal: { flex: 1, backgroundColor: colors.bg },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  label: { fontSize: 11, fontWeight: '700', color: colors.text2, letterSpacing: 1.5, marginBottom: 8, marginTop: 4 },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, color: colors.text, fontSize: 15, marginBottom: 16 },
  saveBtn: { backgroundColor: colors.accent, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8 },
})