import React, { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, ActivityIndicator, Alert, Image, Modal, KeyboardAvoidingView, Platform } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import * as Location from 'expo-location'
import { useAuth } from '../AuthContext'
import { colors } from '../theme'

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
  const [form, setForm] = useState({ name: user?.name || '', city: user?.city || '', bio: user?.bio || '', roles: user?.roles || [] })
  const [saving, setSaving] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [locating, setLocating] = useState(false)
  const [portfolio, setPortfolio] = useState([])
  const [uploadingPortfolio, setUploadingPortfolio] = useState(false)

  const initials = (user?.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const isMaster = (user?.roles || []).some(r => MASTER_ROLES.includes(r))

  async function pickAvatar() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') return
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.8 })
    if (!result.canceled) {
      setUploadingAvatar(true)
      try {
        const fd = new FormData()
        fd.append('file', { uri: result.assets[0].uri, type: 'image/jpeg', name: 'avatar.jpg' })
        fd.append('upload_preset', UPLOAD_PRESET)
        const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: 'POST', body: fd })
        const d = await r.json()
        if (d.secure_url) {
          setAvatarUrl(d.secure_url)
          await fetch(`${API}/users/me`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ avatarUrl: d.secure_url })
          })
          await updateUser({ avatarUrl: d.secure_url })
        }
      } catch (e) { Alert.alert('Ошибка загрузки фото') }
      setUploadingAvatar(false)
    }
  }

  async function pickPortfolioPhoto() {
    if (portfolio.length >= 5) { Alert.alert('Максимум 5 фото в портфолио'); return }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') return
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.8 })
    if (!result.canceled) {
      setUploadingPortfolio(true)
      try {
        const fd = new FormData()
        fd.append('file', { uri: result.assets[0].uri, type: 'image/jpeg', name: 'portfolio.jpg' })
        fd.append('upload_preset', UPLOAD_PRESET)
        const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: 'POST', body: fd })
        const d = await r.json()
        if (d.secure_url) {
          const newPortfolio = [...portfolio, d.secure_url]
          setPortfolio(newPortfolio)
          // Сохраняем на бэкенде
          await fetch(`${API}/users/me`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ portfolioUrls: newPortfolio })
          })
        }
      } catch (e) { Alert.alert('Ошибка загрузки фото') }
      setUploadingPortfolio(false)
    }
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

  function toggleRole(role) {
    setForm(p => ({
      ...p,
      roles: p.roles.includes(role) ? p.roles.filter(r => r !== role) : [...p.roles, role]
    }))
  }

  return (
    <ScrollView style={s.wrap} showsVerticalScrollIndicator={false}>
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
            <TextInput style={s.input} value={form.name} onChangeText={v => setForm(p => ({ ...p, name: v }))} placeholder="Ваше имя" placeholderTextColor={colors.text2} />

            <Text style={s.label}>ГОРОД</Text>
            <TextInput style={s.input} value={form.city} onChangeText={v => setForm(p => ({ ...p, city: v }))} placeholder="Москва, Санкт-Петербург..." placeholderTextColor={colors.text2} />

            <Text style={s.label}>О СЕБЕ</Text>
            <TextInput style={[s.input, { height: 100, textAlignVertical: 'top' }]} value={form.bio} onChangeText={v => setForm(p => ({ ...p, bio: v }))} placeholder="Расскажите о себе (до 500 символов)" placeholderTextColor={colors.text2} multiline maxLength={500} />

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
    </ScrollView>
  )
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  headerWrap: { alignItems: 'center', paddingTop: 40, paddingBottom: 24, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: colors.border },
  avatarWrap: { position: 'relative', marginBottom: 16 },
  avatar: { width: 88, height: 88, borderRadius: 24, backgroundColor: `${colors.blue}30`, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: `${colors.blue}60` },
  avatarImg: { width: 88, height: 88, borderRadius: 24 },
  avatarText: { fontSize: 32, fontWeight: '800', color: colors.blue },
  avatarEditBadge: { position: 'absolute', bottom: -4, right: -4, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center' },
  name: { fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 6 },
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
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, margin: 16, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: `${colors.accent}40`, backgroundColor: `${colors.accent}10` },
  logoutIcon: { fontSize: 18 },
  logoutText: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  modal: { flex: 1, backgroundColor: colors.bg },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  label: { fontSize: 11, fontWeight: '700', color: colors.text2, letterSpacing: 1.5, marginBottom: 8, marginTop: 4 },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, color: colors.text, fontSize: 15, marginBottom: 16 },
  saveBtn: { backgroundColor: colors.accent, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8 },
})