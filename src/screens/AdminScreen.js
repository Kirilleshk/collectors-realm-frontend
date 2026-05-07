import React, { useState, useEffect } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert, Modal, Image, Platform, KeyboardAvoidingView
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { useAuth } from '../AuthContext'
import { colors } from '../theme'

const CLOUD_NAME = 'dqutmb1rm'
const UPLOAD_PRESET = 'collectors_realm'
const API = 'https://collectors-realm-backend.onrender.com/api'

const EMPTY = { name: '', description: '', price: '', condition: 'NEW', manufacturer: '', franchise: '', character: '' }

const STATUS_LABELS = {
  AVAILABLE: { label: 'Доступен', color: '#34C759' },
  SOLD: { label: 'Продан', color: '#8E8E93' },
  PREORDER: { label: 'Предзаказ', color: '#007AFF' },
  RESERVED: { label: 'Резерв', color: '#FF9500' },
  NEGOTIABLE: { label: 'Торг уместен', color: '#AF52DE' },
}

export default function AdminScreen() {
  const { user, token } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [photos, setPhotos] = useState([])
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  const isAdmin = user?.roles?.includes('ADMIN') || user?.email?.includes('admin') || user?.email?.includes('kirill')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch(`${API}/products`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setItems(Array.isArray(data) ? data : (data.products || []))
    } catch (e) {}
    setLoading(false)
  }

  function openAdd() { setEditItem(null); setForm(EMPTY); setPhotos([]); setModal(true) }

  function openEdit(item) {
    setEditItem(item)
    setForm({
      name: item.name || '',
      description: item.description || '',
      price: String(item.price || ''),
      condition: item.condition || 'NEW',
      manufacturer: item.manufacturer || '',
      franchise: item.franchise || '',
      character: item.character || ''
    })
    setPhotos(item.images?.map(i => i.url) || [])
    setModal(true)
  }

  async function pickPhoto() {
    if (photos.length >= 5) { Alert.alert('Максимум 5 фото'); return }

    if (Platform.OS === 'web') {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.onchange = async (e) => {
        const file = e.target.files[0]
        if (!file) return
        setUploadingPhoto(true)
        try {
          const fd = new FormData()
          fd.append('file', file)
          fd.append('upload_preset', UPLOAD_PRESET)
          const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: 'POST', body: fd })
          const d = await r.json()
          if (d.secure_url) setPhotos(p => [...p, d.secure_url])
        } catch (e) { Alert.alert('Ошибка', e.message) }
        setUploadingPhoto(false)
      }
      input.click()
      return
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') { Alert.alert('Нужно разрешение'); return }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.8
    })
    if (!result.canceled) {
      setUploadingPhoto(true)
      try {
        const fd = new FormData()
        fd.append('file', { uri: result.assets[0].uri, type: 'image/jpeg', name: 'photo.jpg' })
        fd.append('upload_preset', UPLOAD_PRESET)
        const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: 'POST', body: fd })
        const d = await r.json()
        if (d.secure_url) setPhotos(p => [...p, d.secure_url])
      } catch (e) { Alert.alert('Ошибка', e.message) }
      setUploadingPhoto(false)
    }
  }

  async function handleSave() {
    if (!form.name.trim()) { Alert.alert('Введите название'); return }
    if (!form.price || isNaN(Number(form.price))) { Alert.alert('Введите цену'); return }
    setSaving(true)
    try {
      const body = {
        name: form.name.trim(),
        description: form.description.trim(),
        price: Number(form.price),
        condition: form.condition,
        manufacturer: form.manufacturer.trim(),
        franchise: form.franchise.trim(),
        character: form.character.trim(),
        imageUrls: photos,
      }
      const url = editItem ? `${API}/products/${editItem.id}` : `${API}/products`
      const method = editItem ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (data.error) { Alert.alert('Ошибка', data.error); setSaving(false); return }
      setModal(false)
      load()
    } catch (e) { Alert.alert('Ошибка', e.message) }
    setSaving(false)
  }

  async function handleChangeStatus(id, currentStatus) {
    const options = [
      { label: '✅ Доступен', status: 'AVAILABLE' },
      { label: '🔴 Продан', status: 'SOLD' },
      { label: '🔵 Предзаказ', status: 'PREORDER' },
      { label: '🟠 Резерв', status: 'RESERVED' },
      { label: '🟣 Торг уместен', status: 'NEGOTIABLE' },
    ].filter(o => o.status !== currentStatus)

    Alert.alert('Изменить статус', 'Выберите новый статус товара', [
      ...options.map(o => ({
        text: o.label,
        onPress: async () => {
          await fetch(`${API}/products/${id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ status: o.status })
          })
          load()
        }
      })),
      { text: 'Отмена', style: 'cancel' }
    ])
  }

  async function handleDelete(id) {
    Alert.alert('Удалить?', 'Нельзя отменить', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: async () => {
        await fetch(`${API}/products/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
        load()
      }}
    ])
  }

  if (!isAdmin) return (
    <View style={s.center}>
      <Text style={{ fontSize: 48, marginBottom: 16 }}>🔒</Text>
      <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 8 }}>Нет доступа</Text>
      <Text style={{ fontSize: 14, color: colors.text2 }}>Только для администраторов</Text>
    </View>
  )

  return (
    <View style={s.wrap}>
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Управление товарами</Text>
          <Text style={s.headerSub}>{items.length} товаров</Text>
        </View>
        <TouchableOpacity style={s.addBtn} onPress={openAdd}>
          <Text style={s.addBtnText}>+ Добавить</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={colors.accent} size="large" /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
          {items.length === 0 ? (
            <View style={s.empty}>
              <Text style={{ fontSize: 48 }}>📦</Text>
              <Text style={{ color: colors.text2, marginTop: 12 }}>Товаров нет — добавьте первый!</Text>
            </View>
          ) : items.map(item => {
            const statusInfo = STATUS_LABELS[item.status] || STATUS_LABELS.AVAILABLE
            return (
              <View key={item.id} style={[s.card, item.status === 'SOLD' && { opacity: 0.5 }]}>
                {item.images?.[0]?.url
                  ? <Image source={{ uri: item.images[0].url }} style={s.thumb} />
                  : <View style={[s.thumb, { backgroundColor: colors.surface2, justifyContent: 'center', alignItems: 'center' }]}><Text style={{ fontSize: 28 }}>🗿</Text></View>
                }
                <View style={{ flex: 1, padding: 12 }}>
                  <Text style={s.cardName} numberOfLines={1}>{item.name}</Text>
                  <Text style={s.cardPrice}>{item.price?.toLocaleString('ru')} ₽</Text>
                  <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                    <Text style={{ fontSize: 11, color: colors.text2 }}>{item.condition === 'NEW' ? 'Новый' : 'Б/у'}</Text>
                    <Text style={{ fontSize: 11, color: statusInfo.color, fontWeight: '700' }}>· {statusInfo.label}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'column', gap: 6, padding: 8 }}>
                  <TouchableOpacity onPress={() => openEdit(item)} style={s.iconBtn}>
                    <Text>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleChangeStatus(item.id, item.status)}
                    style={[s.iconBtn, { backgroundColor: 'rgba(52,199,89,0.2)' }]}
                  >
                    <Text style={{ color: '#34C759', fontWeight: '700', fontSize: 16 }}>⇄</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(item.id)} style={[s.iconBtn, { backgroundColor: 'rgba(255,59,48,0.15)' }]}>
                    <Text>🗑</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )
          })}
        </ScrollView>
      )}

      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={s.modal} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.modalHead}>
            <Text style={s.headerTitle}>{editItem ? 'Редактировать' : 'Новый товар'}</Text>
            <TouchableOpacity onPress={() => setModal(false)}>
              <Text style={{ fontSize: 20, color: colors.text2 }}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 20 }} keyboardShouldPersistTaps="handled">

            <Text style={s.label}>ФОТО ({photos.length}/5)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {photos.map((p, i) => (
                  <View key={i} style={{ position: 'relative' }}>
                    <Image source={{ uri: p }} style={{ width: 90, height: 90, borderRadius: 12 }} />
                    <TouchableOpacity
                      onPress={() => setPhotos(prev => prev.filter((_, j) => j !== i))}
                      style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, backgroundColor: 'rgba(255,59,48,0.9)', borderRadius: 11, justifyContent: 'center', alignItems: 'center' }}
                    >
                      <Text style={{ color: 'white', fontSize: 11, fontWeight: '700' }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                {photos.length < 5 && (
                  <TouchableOpacity
                    onPress={pickPhoto}
                    disabled={uploadingPhoto}
                    style={{ width: 90, height: 90, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', gap: 4 }}
                  >
                    {uploadingPhoto
                      ? <ActivityIndicator color={colors.accent} />
                      : <>
                          <Text style={{ fontSize: 24, color: colors.text2 }}>📷</Text>
                          <Text style={{ fontSize: 10, color: colors.text2 }}>Добавить</Text>
                        </>
                    }
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>

            {[
              ['Название *', 'name', 'Spider-Man Marvel Legends', 'default'],
              ['Цена (₽) *', 'price', '1500', 'numeric'],
              ['Производитель', 'manufacturer', 'Hasbro, Bandai...', 'default'],
              ['Франшиза', 'franchise', 'Marvel, Star Wars...', 'default'],
              ['Персонаж', 'character', 'Spider-Man, Goku...', 'default'],
            ].map(([label, key, placeholder, kb]) => (
              <View key={key}>
                <Text style={s.label}>{label.toUpperCase()}</Text>
                <TextInput
                  style={s.input}
                  value={form[key]}
                  onChangeText={v => setForm(p => ({ ...p, [key]: v }))}
                  placeholder={placeholder}
                  placeholderTextColor={colors.text2}
                  keyboardType={kb}
                />
              </View>
            ))}

            <Text style={s.label}>СОСТОЯНИЕ</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
              {['NEW', 'USED'].map(c => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setForm(p => ({ ...p, condition: c }))}
                  style={{ flex: 1, padding: 12, borderRadius: 12, alignItems: 'center', backgroundColor: form.condition === c ? colors.accent : colors.surface, borderWidth: 1, borderColor: form.condition === c ? colors.accent : colors.border }}
                >
                  <Text style={{ color: form.condition === c ? 'white' : colors.text2, fontWeight: '600' }}>
                    {c === 'NEW' ? 'Новый' : 'Б/у'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.label}>ОПИСАНИЕ</Text>
            <TextInput
              style={[s.input, { height: 100, textAlignVertical: 'top' }]}
              value={form.description}
              onChangeText={v => setForm(p => ({ ...p, description: v }))}
              placeholder="Описание товара..."
              placeholderTextColor={colors.text2}
              multiline
            />

            <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving}>
              {saving
                ? <ActivityIndicator color="white" />
                : <Text style={{ color: 'white', fontSize: 16, fontWeight: '700' }}>
                    {editItem ? 'Сохранить изменения' : 'Добавить товар'}
                  </Text>
              }
            </TouchableOpacity>
            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  empty: { alignItems: 'center', paddingTop: 60 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  headerSub: { fontSize: 12, color: colors.text2, marginTop: 2 },
  addBtn: { backgroundColor: colors.accent, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  addBtnText: { color: 'white', fontWeight: '700', fontSize: 14 },
  card: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  thumb: { width: 80, height: 80 },
  cardName: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 4 },
  cardPrice: { fontSize: 15, fontWeight: '800', color: colors.accent, marginBottom: 4 },
  iconBtn: { width: 34, height: 34, borderRadius: 8, backgroundColor: colors.surface2, justifyContent: 'center', alignItems: 'center' },
  modal: { flex: 1, backgroundColor: colors.bg },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  label: { fontSize: 11, fontWeight: '700', color: colors.text2, letterSpacing: 1.5, marginBottom: 8, marginTop: 4 },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, color: colors.text, fontSize: 15, marginBottom: 16 },
  saveBtn: { backgroundColor: colors.accent, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8 },
})