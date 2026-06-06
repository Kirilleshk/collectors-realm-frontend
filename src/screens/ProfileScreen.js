import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Image, Modal, KeyboardAvoidingView, Platform, FlatList, Dimensions } from 'react-native'
import * as Location from 'expo-location'
import { useAuth } from '../AuthContext'
import { colors } from '../theme'
import { pickAndUploadPhoto } from '../utils/uploadPhoto'
import SmartInput from '../utils/SmartInput'
import { HELP_ITEMS } from '../utils/WhatsNewModal'
import { CHANGELOG, CURRENT_VERSION } from '../utils/changelog'
import { portfolioCollections as collectionsApi, reviews as reviewsApi, support as supportApi } from '../api'

const { width } = Dimensions.get('window')
const COLL_CARD = (width - 48) / 2

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

function ReviewCardSmall({ review: r }) {
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {r.fromUser?.avatarUrl
            ? <Image source={{ uri: r.fromUser.avatarUrl }} style={{ width: 28, height: 28, borderRadius: 7 }} />
            : <View style={{ width: 28, height: 28, borderRadius: 7, backgroundColor: `${colors.blue}25`, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontSize: 11, color: colors.blue, fontWeight: '700' }}>{(r.fromUser?.name || '?')[0]}</Text>
              </View>
          }
          <View>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{r.fromUser?.name || 'Пользователь'}</Text>
            <Text style={{ fontSize: 11, color: colors.text2 }}>{new Date(r.createdAt).toLocaleDateString('ru')}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 1 }}>
          {[1, 2, 3, 4, 5].map(i => (
            <Text key={i} style={{ fontSize: 13, color: i <= r.rating ? '#FFB800' : colors.border }}>★</Text>
          ))}
        </View>
      </View>
      {r.comment ? <Text style={{ fontSize: 13, color: colors.text, lineHeight: 19 }}>{r.comment}</Text> : null}
    </View>
  )
}

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
    loadCollections()
    if (user?.id) {
      reviewsApi.getForUser(user.id)
        .then(r => { if (r.data) setMyReviewData(r.data) })
        .catch(() => {})
    }
    supportApi.getUnread().then(r => setSupportUnread(r.data?.count || 0)).catch(() => {})
  }, [token])

  async function loadSupportMessages() {
    setSupportLoading(true)
    try {
      const res = await supportApi.getMyMessages()
      setSupportMessages(Array.isArray(res.data) ? res.data : [])
      setSupportUnread(0)
    } catch (e) {}
    setSupportLoading(false)
  }

  async function sendSupportMessage() {
    if (!supportText.trim() || supportSending) return
    setSupportSending(true)
    try {
      const res = await supportApi.sendMessage(supportText.trim())
      setSupportMessages(prev => [...prev, res.data])
      setSupportText('')
    } catch (e) { Alert.alert('Ошибка', 'Не удалось отправить сообщение') }
    setSupportSending(false)
  }

  async function loadCollections() {
    try {
      const res = await collectionsApi.getMine()
      setCollections(res.data)
    } catch {}
  }

  function openAddCollection() {
    setEditingCollection(null)
    setCollectionForm({ name: '', description: '', photos: [] })
    setAddCollectionVisible(true)
  }

  function openEditCollection(col) {
    setEditingCollection(col)
    setCollectionForm({ name: col.name, description: col.description || '', photos: col.photos })
    setAddCollectionVisible(true)
  }

  async function addPhotoToForm() {
    if (collectionForm.photos.length >= 10) return
    setUploadingCollPhoto(true)
    const url = await pickAndUploadPhoto()
    if (url) setCollectionForm(p => ({ ...p, photos: [...p.photos, { url, id: null }] }))
    setUploadingCollPhoto(false)
  }

  async function saveCollection() {
    if (!collectionForm.name.trim()) { Alert.alert('Введите название'); return }
    setSavingCollection(true)
    try {
      if (editingCollection) {
        // Обновляем название и описание
        const res = await collectionsApi.update(editingCollection.id, {
          name: collectionForm.name.trim(),
          description: collectionForm.description.trim() || undefined,
        })
        setCollections(prev => prev.map(c => c.id === editingCollection.id ? res.data : c))
      } else {
        // Создаём новую коллекцию с фото
        const res = await collectionsApi.create({
          name: collectionForm.name.trim(),
          description: collectionForm.description.trim() || undefined,
          photoUrls: collectionForm.photos.map(p => p.url),
        })
        setCollections(prev => [...prev, res.data])
      }
      setAddCollectionVisible(false)
    } catch (e) {
      Alert.alert('Ошибка', 'Не удалось сохранить коллекцию')
    }
    setSavingCollection(false)
  }

  async function deleteCollection(id) {
    Alert.alert('Удалить коллекцию?', 'Это действие нельзя отменить', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: async () => {
        try {
          await collectionsApi.remove(id)
          setCollections(prev => prev.filter(c => c.id !== id))
          setCollectionDetailVisible(false)
        } catch {
          Alert.alert('Ошибка', 'Не удалось удалить коллекцию')
        }
      }},
    ])
  }

  async function addPhotoToCollection(collectionId) {
    const col = collections.find(c => c.id === collectionId)
    if (!col || col.photos.length >= 10) return
    setUploadingCollPhoto(true)
    const url = await pickAndUploadPhoto()
    if (url) {
      try {
        const res = await collectionsApi.addPhoto(collectionId, url)
        const newPhoto = res.data
        setCollections(prev => prev.map(c =>
          c.id === collectionId ? { ...c, photos: [...c.photos, newPhoto] } : c
        ))
        setActiveCollection(prev => prev?.id === collectionId
          ? { ...prev, photos: [...prev.photos, newPhoto] }
          : prev
        )
      } catch { Alert.alert('Ошибка загрузки фото') }
    }
    setUploadingCollPhoto(false)
  }

  async function removePhotoFromCollection(collectionId, photoId) {
    try {
      await collectionsApi.removePhoto(collectionId, photoId)
      setCollections(prev => prev.map(c =>
        c.id === collectionId ? { ...c, photos: c.photos.filter(p => p.id !== photoId) } : c
      ))
      setActiveCollection(prev => prev?.id === collectionId
        ? { ...prev, photos: prev.photos.filter(p => p.id !== photoId) }
        : prev
      )
    } catch { Alert.alert('Ошибка удаления фото') }
  }
  const [uploadingPortfolio, setUploadingPortfolio] = useState(false)
  const [myReviewData, setMyReviewData] = useState({ reviews: [], avgRating: null, count: 0 })
  const [reviewsModalVisible, setReviewsModalVisible] = useState(false)

  // Связь с администрацией
  const [supportModal, setSupportModal] = useState(false)
  const [supportMessages, setSupportMessages] = useState([])
  const [supportText, setSupportText] = useState('')
  const [supportSending, setSupportSending] = useState(false)
  const [supportLoading, setSupportLoading] = useState(false)
  const [supportUnread, setSupportUnread] = useState(0)

  // Коллекции
  const [collections, setCollections] = useState([])
  const [activeCollection, setActiveCollection] = useState(null)
  const [collectionDetailVisible, setCollectionDetailVisible] = useState(false)
  const [addCollectionVisible, setAddCollectionVisible] = useState(false)
  const [editingCollection, setEditingCollection] = useState(null)
  const [collectionForm, setCollectionForm] = useState({ name: '', description: '', photos: [] })
  const [uploadingCollPhoto, setUploadingCollPhoto] = useState(false)
  const [savingCollection, setSavingCollection] = useState(false)

  const initials = (user?.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const isMaster = (user?.roles || []).some(r => MASTER_ROLES.includes(r))

  async function pickAvatar() {
    setUploadingAvatar(true)
    const url = await pickAndUploadPhoto()
    if (url) {
      setAvatarUrl(url)
      await updateUser({ avatarUrl: url })
      fetch(`${API}/users/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ avatarUrl: url }),
      }).catch(() => {})
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

      {/* Отзывы */}
      <View style={s.section}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={s.sectionTitle}>
            Отзывы{myReviewData.count > 0 ? ` (${myReviewData.count})` : ''}
          </Text>
          {myReviewData.count > 0 && (
            <TouchableOpacity
              style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: `${colors.accent}20`, borderWidth: 1, borderColor: `${colors.accent}40` }}
              onPress={() => setReviewsModalVisible(true)}
            >
              <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '700' }}>Все отзывы</Text>
            </TouchableOpacity>
          )}
        </View>

        {myReviewData.count === 0 ? (
          <Text style={{ fontSize: 14, color: colors.text2, fontStyle: 'italic' }}>Пока нет отзывов</Text>
        ) : (
          <>
            {myReviewData.avgRating != null && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12, backgroundColor: colors.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ fontSize: 28, fontWeight: '800', color: colors.text }}>{myReviewData.avgRating.toFixed(1)}</Text>
                <View>
                  <View style={{ flexDirection: 'row', gap: 3 }}>
                    {[1, 2, 3, 4, 5].map(i => (
                      <Text key={i} style={{ fontSize: 16, color: i <= Math.round(myReviewData.avgRating) ? '#FFB800' : colors.border }}>★</Text>
                    ))}
                  </View>
                  <Text style={{ fontSize: 12, color: colors.text2, marginTop: 2 }}>
                    {myReviewData.count} {myReviewData.count === 1 ? 'отзыв' : myReviewData.count < 5 ? 'отзыва' : 'отзывов'}
                  </Text>
                </View>
              </View>
            )}
            {myReviewData.reviews.slice(0, 3).map(r => (
              <ReviewCardSmall key={r.id} review={r} />
            ))}
            {myReviewData.count > 3 && (
              <TouchableOpacity
                style={{ padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center', backgroundColor: colors.surface }}
                onPress={() => setReviewsModalVisible(true)}
              >
                <Text style={{ color: colors.text2, fontSize: 14, fontWeight: '600' }}>Ещё {myReviewData.count - 3} {myReviewData.count - 3 === 1 ? 'отзыв' : 'отзывов'} →</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>

      {/* Портфолио */}
      <View style={s.section}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={s.sectionTitle}>Моё портфолио ({portfolio.length}/5)</Text>
          {portfolio.length < 5 && (
            <TouchableOpacity
              style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: `${colors.blue}20`, borderWidth: 1, borderColor: `${colors.blue}40` }}
              onPress={pickPortfolioPhoto}
              disabled={uploadingPortfolio}
            >
              <Text style={{ color: colors.blue, fontSize: 13, fontWeight: '700' }}>
                {uploadingPortfolio ? '...' : '+ Фото'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {portfolio.length === 0 ? (
          <TouchableOpacity
            style={{ backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, borderStyle: 'dashed', padding: 24, alignItems: 'center', gap: 8 }}
            onPress={pickPortfolioPhoto}
            disabled={uploadingPortfolio}
          >
            {uploadingPortfolio
              ? <ActivityIndicator color={colors.accent} />
              : <>
                  <Text style={{ fontSize: 36 }}>📸</Text>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>Добавить фото коллекции</Text>
                  <Text style={{ fontSize: 12, color: colors.text2, textAlign: 'center' }}>До 5 фото · видны всем в вашем профиле</Text>
                </>
            }
          </TouchableOpacity>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {portfolio.map((url, i) => (
                <View key={i} style={{ position: 'relative' }}>
                  <Image source={{ uri: url }} style={s.portfolioImg} />
                  <TouchableOpacity style={s.portfolioRemove} onPress={() => removePortfolioPhoto(i)}>
                    <Text style={{ color: 'white', fontSize: 10, fontWeight: '700' }}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {portfolio.length < 5 && (
                <TouchableOpacity style={s.portfolioAdd} onPress={pickPortfolioPhoto} disabled={uploadingPortfolio}>
                  {uploadingPortfolio
                    ? <ActivityIndicator color={colors.accent} />
                    : <>
                        <Text style={{ fontSize: 28, color: colors.text2 }}>📷</Text>
                        <Text style={{ fontSize: 11, color: colors.text2, marginTop: 4 }}>Добавить</Text>
                      </>
                  }
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        )}
      </View>

      {/* Коллекции */}
      <View style={s.section}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={s.sectionTitle}>Коллекции</Text>
          <TouchableOpacity style={s.addCollBtn} onPress={openAddCollection}>
            <Text style={s.addCollBtnText}>+ Добавить</Text>
          </TouchableOpacity>
        </View>

        {collections.length === 0 ? (
          <TouchableOpacity style={s.collEmpty} onPress={openAddCollection}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>🗿</Text>
            <Text style={{ color: colors.text2, fontSize: 14 }}>Добавьте первую коллекцию</Text>
          </TouchableOpacity>
        ) : (
          <View style={s.collGrid}>
            {collections.map(col => (
              <TouchableOpacity
                key={col.id}
                style={s.collCard}
                onPress={() => { setActiveCollection(col); setCollectionDetailVisible(true) }}
              >
                {col.photos[0] ? (
                  <Image source={{ uri: col.photos[0].url }} style={s.collCover} />
                ) : (
                  <View style={[s.collCover, { justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface2 }]}>
                    <Text style={{ fontSize: 32 }}>📷</Text>
                  </View>
                )}
                <View style={s.collCardBody}>
                  <Text style={s.collCardName} numberOfLines={1}>{col.name}</Text>
                  <Text style={s.collCardCount}>{col.photos.length} фото</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Связь с администрацией */}
      <View style={s.section}>
        <TouchableOpacity style={s.supportBtn} onPress={() => { setSupportModal(true); loadSupportMessages() }}>
          <Text style={{ fontSize: 22 }}>💬</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.supportBtnTitle}>Связь с администрацией</Text>
            <Text style={s.supportBtnSub}>Вопросы, жалобы, предложения</Text>
          </View>
          {supportUnread > 0 && (
            <View style={s.unreadBadge}><Text style={s.unreadBadgeText}>{supportUnread}</Text></View>
          )}
          <Text style={{ color: colors.text2, fontSize: 20 }}>›</Text>
        </TouchableOpacity>
      </View>

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
            <View style={{ gap: 8, marginBottom: 20 }}>
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

            <Text style={s.label}>ФОТО ПОРТФОЛИО ({portfolio.length}/5)</Text>
            <Text style={{ fontSize: 12, color: colors.text2, marginBottom: 12, lineHeight: 17 }}>
              Эти фото видят другие пользователи в вашем профиле
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
              {portfolio.map((url, i) => (
                <View key={i} style={{ position: 'relative' }}>
                  <Image source={{ uri: url }} style={{ width: 90, height: 90, borderRadius: 10 }} />
                  <TouchableOpacity
                    style={s.portfolioRemove}
                    onPress={() => removePortfolioPhoto(i)}
                  >
                    <Text style={{ color: 'white', fontSize: 10, fontWeight: '700' }}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {portfolio.length < 5 && (
                <TouchableOpacity
                  style={[s.portfolioAdd, { width: 90, height: 90 }]}
                  onPress={pickPortfolioPhoto}
                  disabled={uploadingPortfolio}
                >
                  {uploadingPortfolio
                    ? <ActivityIndicator color={colors.accent} />
                    : <>
                        <Text style={{ fontSize: 26, color: colors.text2 }}>📷</Text>
                        <Text style={{ fontSize: 10, color: colors.text2, marginTop: 4 }}>Добавить</Text>
                      </>
                  }
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="white" /> : <Text style={{ color: 'white', fontSize: 16, fontWeight: '700' }}>Сохранить</Text>}
            </TouchableOpacity>
            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
      {/* Модал: детальный просмотр коллекции */}
      <Modal visible={collectionDetailVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setCollectionDetailVisible(false)}>
        <View style={s.modal}>
          <View style={s.modalHead}>
            <Text style={s.modalTitle} numberOfLines={1}>{activeCollection?.name}</Text>
            <TouchableOpacity onPress={() => setCollectionDetailVisible(false)}>
              <Text style={{ fontSize: 20, color: colors.text2 }}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
            {activeCollection?.description ? (
              <Text style={{ color: colors.text2, fontSize: 14, marginBottom: 16, lineHeight: 20 }}>{activeCollection.description}</Text>
            ) : null}

            {/* Фото в коллекции */}
            <View style={s.collPhotoGrid}>
              {(activeCollection?.photos || []).map(photo => (
                <View key={photo.id} style={{ position: 'relative' }}>
                  <Image source={{ uri: photo.url }} style={s.collPhoto} />
                  <TouchableOpacity
                    style={s.collPhotoRemove}
                    onPress={() => removePhotoFromCollection(activeCollection.id, photo.id)}
                  >
                    <Text style={{ color: 'white', fontSize: 10, fontWeight: '700' }}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {(activeCollection?.photos?.length || 0) < 10 && (
                <TouchableOpacity style={s.collPhotoAdd} onPress={() => addPhotoToCollection(activeCollection?.id)} disabled={uploadingCollPhoto}>
                  {uploadingCollPhoto
                    ? <ActivityIndicator color={colors.accent} />
                    : <Text style={{ fontSize: 28, color: colors.text2 }}>+</Text>
                  }
                </TouchableOpacity>
              )}
            </View>

            {/* Кнопки управления */}
            <View style={{ gap: 10, marginTop: 24 }}>
              <TouchableOpacity
                style={[s.saveBtn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}
                onPress={() => { setCollectionDetailVisible(false); openEditCollection(activeCollection) }}
              >
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>✏️ Редактировать</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.saveBtn, { backgroundColor: 'rgba(255,59,48,0.1)', borderWidth: 1, borderColor: 'rgba(255,59,48,0.3)' }]}
                onPress={() => deleteCollection(activeCollection?.id)}
              >
                <Text style={{ color: '#FF3B30', fontSize: 15, fontWeight: '600' }}>🗑 Удалить коллекцию</Text>
              </TouchableOpacity>
            </View>
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* Модал: все отзывы */}
      <Modal visible={reviewsModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setReviewsModalVisible(false)}>
        <View style={s.modal}>
          <View style={s.modalHead}>
            <Text style={s.modalTitle}>Отзывы {myReviewData.count > 0 ? `(${myReviewData.count})` : ''}</Text>
            <TouchableOpacity onPress={() => setReviewsModalVisible(false)}>
              <Text style={{ fontSize: 20, color: colors.text2 }}>✕</Text>
            </TouchableOpacity>
          </View>
          {myReviewData.avgRating != null && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text style={{ fontSize: 36, fontWeight: '800', color: colors.text }}>{myReviewData.avgRating.toFixed(1)}</Text>
              <View>
                <View style={{ flexDirection: 'row', gap: 3 }}>
                  {[1, 2, 3, 4, 5].map(i => (
                    <Text key={i} style={{ fontSize: 20, color: i <= Math.round(myReviewData.avgRating) ? '#FFB800' : colors.border }}>★</Text>
                  ))}
                </View>
                <Text style={{ fontSize: 12, color: colors.text2, marginTop: 2 }}>
                  {myReviewData.count} {myReviewData.count === 1 ? 'отзыв' : myReviewData.count < 5 ? 'отзыва' : 'отзывов'}
                </Text>
              </View>
            </View>
          )}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
            {myReviewData.reviews.map(r => <ReviewCardSmall key={r.id} review={r} />)}
            {myReviewData.count === 0 && (
              <Text style={{ fontSize: 14, color: colors.text2, fontStyle: 'italic', textAlign: 'center', marginTop: 32 }}>Пока нет отзывов</Text>
            )}
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* Модал: добавить / редактировать коллекцию */}
      <Modal visible={addCollectionVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setAddCollectionVisible(false)}>
        <KeyboardAvoidingView style={s.modal} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.modalHead}>
            <Text style={s.modalTitle}>{editingCollection ? 'Редактировать' : 'Новая коллекция'}</Text>
            <TouchableOpacity onPress={() => setAddCollectionVisible(false)}>
              <Text style={{ fontSize: 20, color: colors.text2 }}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            <Text style={s.label}>НАЗВАНИЕ *</Text>
            <SmartInput
              style={s.input}
              value={collectionForm.name}
              onChangeText={v => setCollectionForm(p => ({ ...p, name: v }))}
              placeholder="Например: Hot Toys Marvel"
              placeholderTextColor={colors.text2}
              maxLength={100}
            />
            <Text style={s.label}>ОПИСАНИЕ</Text>
            <SmartInput
              style={[s.input, { height: 90, textAlignVertical: 'top' }]}
              value={collectionForm.description}
              onChangeText={v => setCollectionForm(p => ({ ...p, description: v }))}
              placeholder="Расскажите об этой коллекции..."
              placeholderTextColor={colors.text2}
              multiline
              maxLength={500}
            />

            {!editingCollection && (
              <>
                <Text style={s.label}>ФОТО (до 10)</Text>
                <View style={s.collPhotoGrid}>
                  {collectionForm.photos.map((p, i) => (
                    <View key={i} style={{ position: 'relative' }}>
                      <Image source={{ uri: p.url }} style={s.collPhoto} />
                      <TouchableOpacity
                        style={s.collPhotoRemove}
                        onPress={() => setCollectionForm(prev => ({ ...prev, photos: prev.photos.filter((_, j) => j !== i) }))}
                      >
                        <Text style={{ color: 'white', fontSize: 10, fontWeight: '700' }}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                  {collectionForm.photos.length < 10 && (
                    <TouchableOpacity style={s.collPhotoAdd} onPress={addPhotoToForm} disabled={uploadingCollPhoto}>
                      {uploadingCollPhoto
                        ? <ActivityIndicator color={colors.accent} />
                        : <Text style={{ fontSize: 28, color: colors.text2 }}>+</Text>
                      }
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}

            <TouchableOpacity style={[s.saveBtn, { marginTop: 24 }]} onPress={saveCollection} disabled={savingCollection}>
              {savingCollection
                ? <ActivityIndicator color="white" />
                : <Text style={{ color: 'white', fontSize: 16, fontWeight: '700' }}>
                    {editingCollection ? 'Сохранить изменения' : 'Создать коллекцию'}
                  </Text>
              }
            </TouchableOpacity>
            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Модал: Связь с администрацией */}
      <Modal visible={supportModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSupportModal(false)}>
        <View style={[s.modal, { flex: 1 }]}>
          <View style={s.modalHead}>
            <Text style={s.modalTitle}>💬 Связь с администрацией</Text>
            <TouchableOpacity onPress={() => setSupportModal(false)}>
              <Text style={{ fontSize: 20, color: colors.text2 }}>✕</Text>
            </TouchableOpacity>
          </View>

          {supportLoading ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator color={colors.accent} size="large" />
            </View>
          ) : (
            <FlatList
              data={supportMessages}
              keyExtractor={m => m.id}
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 16, gap: 10, flexGrow: 1 }}
              ListEmptyComponent={
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 }}>
                  <Text style={{ fontSize: 48, marginBottom: 16 }}>💬</Text>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 8 }}>Напишите нам</Text>
                  <Text style={{ fontSize: 13, color: colors.text2, textAlign: 'center', lineHeight: 19 }}>
                    Мы ответим как можно скорее
                  </Text>
                </View>
              }
              renderItem={({ item }) => (
                <View style={[
                  { maxWidth: '80%', padding: 12, borderRadius: 16, gap: 4 },
                  item.fromAdmin
                    ? { alignSelf: 'flex-start', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }
                    : { alignSelf: 'flex-end', backgroundColor: colors.accent }
                ]}>
                  {item.fromAdmin && (
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.accent, marginBottom: 2 }}>Администрация</Text>
                  )}
                  <Text style={{ fontSize: 14, color: item.fromAdmin ? colors.text : 'white', lineHeight: 20 }}>{item.text}</Text>
                  <Text style={{ fontSize: 10, color: item.fromAdmin ? colors.text2 : 'rgba(255,255,255,0.7)', alignSelf: 'flex-end', marginTop: 2 }}>
                    {new Date(item.createdAt).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              )}
            />
          )}

          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={{ flexDirection: 'row', padding: 12, gap: 10, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface }}>
              <SmartInput
                style={{ flex: 1, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: colors.text, fontSize: 14, maxHeight: 100 }}
                value={supportText}
                onChangeText={setSupportText}
                placeholder="Сообщение..."
                placeholderTextColor={colors.text2}
                multiline
                maxLength={1000}
              />
              <TouchableOpacity
                style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: supportText.trim() ? colors.accent : colors.surface2, justifyContent: 'center', alignItems: 'center', alignSelf: 'flex-end' }}
                onPress={sendSupportMessage}
                disabled={!supportText.trim() || supportSending}
              >
                {supportSending
                  ? <ActivityIndicator color="white" size="small" />
                  : <Text style={{ color: 'white', fontSize: 18, fontWeight: '700' }}>↑</Text>
                }
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
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

  addCollBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10, backgroundColor: `${colors.accent}20`, borderWidth: 1, borderColor: `${colors.accent}40` },
  addCollBtnText: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  collEmpty: { alignItems: 'center', padding: 32, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, borderStyle: 'dashed', backgroundColor: colors.surface },
  collGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  collCard: { width: COLL_CARD, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  collCover: { width: COLL_CARD, height: COLL_CARD, resizeMode: 'cover' },
  collCardBody: { padding: 10, gap: 2 },
  collCardName: { fontSize: 13, fontWeight: '700', color: colors.text },
  collCardCount: { fontSize: 11, color: colors.text2 },
  collPhotoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  collPhoto: { width: 90, height: 90, borderRadius: 10 },
  collPhotoRemove: { position: 'absolute', top: -6, right: -6, width: 20, height: 20, backgroundColor: 'rgba(255,59,48,0.9)', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  collPhotoAdd: { width: 90, height: 90, borderRadius: 10, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  supportBtn: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 16 },
  supportBtnTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 2 },
  supportBtnSub: { fontSize: 12, color: colors.text2 },
  unreadBadge: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  unreadBadgeText: { color: 'white', fontSize: 11, fontWeight: '700' },
})