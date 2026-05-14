import React, { useState, useEffect } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, RefreshControl,
  Alert, KeyboardAvoidingView, Platform, ScrollView, Image,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { collection } from '../api'
import { colors } from '../theme'
import { pickAndUploadPhoto } from '../utils/uploadPhoto'
import SmartInput from '../utils/SmartInput'

const EMPTY = {
  name: '', manufacturer: '', purchasePrice: '',
  purchaseDate: '', condition: 'NEW', notes: '', imageUrl: '',
}

export default function CollectionScreen() {
  const insets = useSafeAreaInsets()
  const [items, setItems] = useState([])
  const [stats, setStats] = useState({ total: 0, totalValue: 0, addedThisMonth: 0 })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [modal, setModal] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  function setField(k, v) { setForm(p => ({ ...p, [k]: v })) }

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const res = await collection.getAll()
      setItems(res.data.items || [])
      setStats(res.data.stats || { total: 0, totalValue: 0, addedThisMonth: 0 })
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  async function onRefresh() { setRefreshing(true); await load(); setRefreshing(false) }

  function openAdd() { setEditId(null); setForm(EMPTY); setErrors({}); setModal(true) }

  function openEdit(item) {
    setEditId(item.id)
    setForm({
      name: item.name || '',
      manufacturer: item.manufacturer || '',
      purchasePrice: item.purchasePrice ? String(item.purchasePrice) : '',
      purchaseDate: item.purchaseDate || '',
      condition: item.condition || 'NEW',
      notes: item.notes || '',
      imageUrl: item.imageUrl || '',
    })
    setErrors({})
    setModal(true)
  }

  async function pickPhoto() {
    setUploadingPhoto(true)
    const url = await pickAndUploadPhoto()
    if (url) setField('imageUrl', url)
    setUploadingPhoto(false)
  }

  async function handleSave() {
    if (saving) return
    const errs = {}
    if (!form.name.trim()) errs.name = true
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSaving(true)
    try {
      const data = {
        name: form.name.trim(),
        manufacturer: form.manufacturer.trim() || undefined,
        purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : undefined,
        purchaseDate: form.purchaseDate.trim() || undefined,
        condition: form.condition,
        notes: form.notes.trim() || undefined,
        imageUrl: form.imageUrl || undefined,
      }
      if (editId) await collection.update(editId, data)
      else await collection.add(data)
      setModal(false)
      await load()
    } catch (e) { Alert.alert('Ошибка', e.response?.data?.error || 'Не удалось сохранить') }
    setSaving(false)
  }

  async function handleDelete(id) {
    Alert.alert('Удалить?', 'Убрать из коллекции?', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: async () => {
        try { await collection.remove(id); await load() } catch { Alert.alert('Ошибка') }
      }},
    ])
  }

  if (loading) return <View style={s.center}><ActivityIndicator color={colors.accent} size="large" /></View>

  return (
    <View style={s.wrap}>
      {/* Статистика */}
      <View style={s.statsBar}>
        <View style={s.statItem}>
          <Text style={s.statValue}>{stats.total}</Text>
          <Text style={s.statLabel}>фигурок</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statItem}>
          <Text style={s.statValue}>{stats.totalValue.toLocaleString('ru')} ₽</Text>
          <Text style={s.statLabel}>стоимость</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statItem}>
          <Text style={[s.statValue, { color: colors.green }]}>+{stats.addedThisMonth}</Text>
          <Text style={s.statLabel}>в этом месяце</Text>
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={i => i.id}
        contentContainerStyle={[s.list, { paddingBottom: 80 + insets.bottom }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyIcon}>🗿</Text>
            <Text style={s.emptyTitle}>Коллекция пуста</Text>
            <Text style={s.emptySub}>Добавьте свои фигурки и отслеживайте стоимость коллекции</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={s.card}>
            {item.imageUrl
              ? <Image source={{ uri: item.imageUrl }} style={s.cardImg} resizeMode="cover" />
              : <View style={[s.cardImg, s.cardImgPlaceholder]}><Text style={{ fontSize: 28 }}>🗿</Text></View>
            }
            <View style={s.cardBody}>
              <View style={s.cardRow}>
                <Text style={s.cardName} numberOfLines={1}>{item.name}</Text>
                <View style={[s.condBadge, item.condition === 'NEW' ? s.condNew : s.condUsed]}>
                  <Text style={[s.condText, { color: item.condition === 'NEW' ? colors.green : colors.purple }]}>
                    {item.condition === 'NEW' ? 'Новый' : 'Б/у'}
                  </Text>
                </View>
              </View>
              {item.manufacturer ? <Text style={s.cardMfr}>🏭 {item.manufacturer}</Text> : null}
              <View style={s.cardMeta}>
                {item.purchasePrice ? <Text style={s.cardPrice}>{item.purchasePrice.toLocaleString('ru')} ₽</Text> : null}
                {item.purchaseDate ? <Text style={s.cardDate}>📅 {item.purchaseDate}</Text> : null}
              </View>
              {item.notes ? <Text style={s.cardNotes} numberOfLines={2}>{item.notes}</Text> : null}
            </View>
            <View style={s.cardActions}>
              <TouchableOpacity style={s.actionBtn} onPress={() => openEdit(item)}>
                <Text>✏️</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.actionBtn} onPress={() => handleDelete(item.id)}>
                <Text style={{ color: colors.text2 }}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      <TouchableOpacity style={[s.fab, { bottom: 24 + insets.bottom }]} onPress={openAdd}>
        <Text style={s.fabText}>+</Text>
      </TouchableOpacity>

      <Modal visible={modal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }} keyboardVerticalOffset={Platform.OS === 'android' ? 30 : 0}>
          <View style={s.overlay}>
            <View style={s.sheet}>
              <Text style={s.sheetTitle}>{editId ? 'Редактировать' : 'Добавить в коллекцию'}</Text>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

                {/* Фото */}
                <TouchableOpacity style={s.photoBtn} onPress={pickPhoto} disabled={uploadingPhoto}>
                  {form.imageUrl
                    ? <Image source={{ uri: form.imageUrl }} style={s.photoPreview} resizeMode="cover" />
                    : uploadingPhoto
                      ? <ActivityIndicator color={colors.accent} />
                      : <Text style={s.photoPlaceholder}>📷 Добавить фото</Text>
                  }
                </TouchableOpacity>

                <View style={s.field}>
                  <Text style={[s.label, errors.name && { color: '#FF3B30' }]}>
                    Название <Text style={{ color: '#FF3B30' }}>* обязательно</Text>
                  </Text>
                  <SmartInput
                    style={[s.input, errors.name && s.inputError]}
                    value={form.name}
                    onChangeText={v => { setField('name', v); if (v.trim()) setErrors(p => ({ ...p, name: false })) }}
                    placeholder="Evangelion Unit-01"
                    placeholderTextColor={colors.text2}
                  />
                  {errors.name ? <Text style={s.errorMsg}>Обязательное поле</Text> : null}
                </View>

                <View style={s.field}>
                  <Text style={s.label}>Производитель</Text>
                  <SmartInput style={s.input} value={form.manufacturer} onChangeText={v => setField('manufacturer', v)} placeholder="Bandai, Good Smile..." placeholderTextColor={colors.text2} />
                </View>

                <View style={s.field}>
                  <Text style={s.label}>Состояние</Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    {[{ v: 'NEW', l: 'Новый' }, { v: 'USED', l: 'Б/у' }].map(opt => (
                      <TouchableOpacity
                        key={opt.v}
                        onPress={() => setField('condition', opt.v)}
                        style={[s.condBtn, form.condition === opt.v && s.condBtnActive]}
                      >
                        <Text style={[s.condBtnText, form.condition === opt.v && { color: colors.accent }]}>{opt.l}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={s.field}>
                  <Text style={s.label}>Цена покупки (₽)</Text>
                  <SmartInput style={s.input} value={form.purchasePrice} onChangeText={v => setField('purchasePrice', v)} placeholder="3500" placeholderTextColor={colors.text2} keyboardType="numeric" />
                </View>

                <View style={s.field}>
                  <Text style={s.label}>Дата покупки</Text>
                  <SmartInput style={s.input} value={form.purchaseDate} onChangeText={v => setField('purchaseDate', v)} placeholder="2024-03 или 2024-03-15" placeholderTextColor={colors.text2} />
                </View>

                <View style={s.field}>
                  <Text style={s.label}>Заметки</Text>
                  <SmartInput
                    style={[s.input, { height: 80, textAlignVertical: 'top' }]}
                    value={form.notes}
                    onChangeText={v => setField('notes', v)}
                    placeholder="Особенности, дефекты, история..."
                    placeholderTextColor={colors.text2}
                    multiline
                  />
                </View>

                <View style={s.modalBtns}>
                  <TouchableOpacity style={s.cancelBtn} onPress={() => setModal(false)}>
                    <Text style={s.cancelText}>Отмена</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving}>
                    {saving ? <ActivityIndicator color="white" size="small" /> : <Text style={s.saveText}>{editId ? 'Сохранить' : 'Добавить'}</Text>}
                  </TouchableOpacity>
                </View>

                <View style={{ height: 24 }} />
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  statsBar: { flexDirection: 'row', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 14 },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 11, color: colors.text2, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: colors.border },
  list: { padding: 16, gap: 10 },
  card: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  cardImg: { width: 88, height: 88 },
  cardImgPlaceholder: { backgroundColor: colors.surface2, justifyContent: 'center', alignItems: 'center' },
  cardBody: { flex: 1, padding: 12 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  cardName: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.text },
  condBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  condNew: { backgroundColor: `${colors.green}20`, borderColor: `${colors.green}50` },
  condUsed: { backgroundColor: `${colors.purple}20`, borderColor: `${colors.purple}50` },
  condText: { fontSize: 10, fontWeight: '700' },
  cardMfr: { fontSize: 11, color: colors.text2, marginBottom: 4 },
  cardMeta: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  cardPrice: { fontSize: 13, fontWeight: '800', color: colors.accent },
  cardDate: { fontSize: 11, color: colors.text2 },
  cardNotes: { fontSize: 11, color: colors.text2, lineHeight: 16 },
  cardActions: { flexDirection: 'column', gap: 4, padding: 8, justifyContent: 'center' },
  actionBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: colors.text, marginBottom: 8 },
  emptySub: { fontSize: 14, color: colors.text2, textAlign: 'center', lineHeight: 20 },
  fab: { position: 'absolute', right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center' },
  fabText: { color: 'white', fontSize: 28, fontWeight: '300', marginTop: -2 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 8, maxHeight: '94%', borderTopWidth: 1, borderColor: colors.border },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 20 },
  photoBtn: { height: 120, backgroundColor: colors.surface2, borderRadius: 12, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', marginBottom: 16, overflow: 'hidden' },
  photoPreview: { width: '100%', height: '100%' },
  photoPlaceholder: { fontSize: 15, color: colors.text2 },
  field: { marginBottom: 16 },
  label: { fontSize: 11, fontWeight: '600', color: colors.text2, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  input: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, color: colors.text, fontSize: 15 },
  inputError: { borderColor: '#FF3B30', borderWidth: 1.5 },
  errorMsg: { fontSize: 11, color: '#FF3B30', marginTop: 4 },
  condBtn: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', backgroundColor: colors.surface2 },
  condBtnActive: { borderColor: colors.accent, backgroundColor: `${colors.accent}15` },
  condBtnText: { fontSize: 14, fontWeight: '600', color: colors.text2 },
  modalBtns: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  cancelText: { color: colors.text, fontSize: 15, fontWeight: '500' },
  saveBtn: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: colors.accent, alignItems: 'center' },
  saveText: { color: 'white', fontSize: 15, fontWeight: '600' },
})
