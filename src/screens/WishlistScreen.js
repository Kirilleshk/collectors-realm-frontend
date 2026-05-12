import React, { useState, useEffect } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput, Modal, RefreshControl, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { wishlist } from '../api'
import { colors } from '../theme'

const priorities = [
  { value: 'HIGH', label: 'Высокий', color: colors.accent },
  { value: 'MEDIUM', label: 'Средний', color: colors.blue },
  { value: 'LOW', label: 'Низкий', color: colors.text2 },
]

const PRIORITY_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 }

const SORT_OPTIONS = [
  { value: 'priority', label: 'Приоритет' },
  { value: 'az', label: 'А → Я' },
  { value: 'za', label: 'Я → А' },
  { value: 'year_desc', label: 'Год ↓' },
  { value: 'year_asc', label: 'Год ↑' },
  { value: 'mfr', label: 'Производитель' },
]

const EMPTY_FORM = { name: '', priority: 'MEDIUM', comment: '', originalName: '', characterRu: '', manufacturer: '', releaseDate: '' }

export default function WishlistScreen() {
  const insets = useSafeAreaInsets()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [modal, setModal] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [sort, setSort] = useState('priority')

  function setField(key, value) { setForm(p => ({ ...p, [key]: value })) }

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const res = await wishlist.getAll()
      const data = Array.isArray(res.data) ? res.data : (res.data.items || [])
      setItems(data)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  async function onRefresh() { setRefreshing(true); await load(); setRefreshing(false) }

  function openAdd() { setEditId(null); setForm(EMPTY_FORM); setErrors({}); setModal(true) }

  function openEdit(item) {
    setEditId(item.id)
    setForm({
      name: item.name || '',
      priority: item.priority || 'MEDIUM',
      comment: item.comment || '',
      originalName: item.originalName || '',
      characterRu: item.characterRu || '',
      manufacturer: item.manufacturer || '',
      releaseDate: item.releaseDate || '',
    })
    setErrors({})
    setModal(true)
  }

  async function handleSave() {
    const newErrors = {}
    if (!form.name.trim()) newErrors.name = true
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    setSaving(true)
    try {
      const data = {
        name: form.name.trim(),
        priority: form.priority,
        comment: form.comment.trim() || undefined,
        originalName: form.originalName.trim() || undefined,
        characterRu: form.characterRu.trim() || undefined,
        manufacturer: form.manufacturer.trim() || undefined,
        releaseDate: form.releaseDate.trim() || undefined,
      }
      if (editId) {
        await wishlist.update(editId, data)
      } else {
        await wishlist.add(data)
      }
      setModal(false)
      await load()
    } catch (e) { Alert.alert('Ошибка', e.response?.data?.error || 'Не удалось сохранить') }
    setSaving(false)
  }

  async function handleDelete(id) {
    Alert.alert('Удалить?', 'Убрать из вишлиста?', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: async () => {
        try { await wishlist.remove(id); await load() } catch (e) {
          Alert.alert('Ошибка', 'Не удалось удалить')
        }
      }}
    ])
  }

  const sorted = [...items].sort((a, b) => {
    if (sort === 'priority') return (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1)
    if (sort === 'az') return (a.name || '').localeCompare(b.name || '', 'ru')
    if (sort === 'za') return (b.name || '').localeCompare(a.name || '', 'ru')
    if (sort === 'year_asc') return parseInt(a.releaseDate || '0') - parseInt(b.releaseDate || '0')
    if (sort === 'year_desc') return parseInt(b.releaseDate || '0') - parseInt(a.releaseDate || '0')
    if (sort === 'mfr') return (a.manufacturer || '').localeCompare(b.manufacturer || '', 'ru')
    return 0
  })

  if (loading) return <View style={s.center}><ActivityIndicator color={colors.accent} size="large" /></View>

  return (
    <View style={s.wrap}>
      {/* Сортировка */}
      <View style={s.sortBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.sortList}>
          {SORT_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[s.sortBtn, sort === opt.value && s.sortBtnActive]}
              onPress={() => setSort(opt.value)}
            >
              <Text style={[s.sortText, sort === opt.value && s.sortTextActive]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={sorted}
        keyExtractor={i => i.id}
        contentContainerStyle={[s.list, { paddingBottom: 80 + insets.bottom }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyIcon}>🎯</Text>
            <Text style={s.emptyTitle}>Вишлист пуст</Text>
            <Text style={s.emptySub}>Добавьте фигурки которые хотите найти — система уведомит вас когда они появятся в магазине</Text>
          </View>
        }
        renderItem={({ item }) => {
          const p = priorities.find(x => x.value === item.priority)
          return (
            <View style={s.card}>
              <View style={[s.priorityBar, { backgroundColor: p?.color }]} />
              <View style={s.cardBody}>
                <Text style={s.cardName}>{item.name}</Text>
                {item.originalName ? <Text style={s.cardOriginal}>{item.originalName}</Text> : null}
                <View style={s.cardTags}>
                  {item.characterRu ? <Text style={s.cardTag}>👤 {item.characterRu}</Text> : null}
                  {item.manufacturer ? <Text style={s.cardTag}>🏭 {item.manufacturer}</Text> : null}
                  {item.releaseDate ? <Text style={s.cardTag}>📅 {item.releaseDate}</Text> : null}
                </View>
                {item.comment ? <Text style={s.cardComment}>{item.comment}</Text> : null}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={[s.cardPriority, { color: p?.color }]}>{p?.label} приоритет</Text>
                  {item.productId ? <Text style={s.linkedBadge}>🔗 Слежу за ценой</Text> : null}
                </View>
              </View>
              <View style={s.cardActions}>
                <TouchableOpacity style={s.editBtn} onPress={() => openEdit(item)}>
                  <Text style={s.editBtnText}>✏️</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.deleteBtn} onPress={() => handleDelete(item.id)}>
                  <Text style={s.deleteText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          )
        }}
      />

      <TouchableOpacity style={[s.fab, { bottom: 24 + insets.bottom }]} onPress={openAdd}>
        <Text style={s.fabText}>+</Text>
      </TouchableOpacity>

      <Modal visible={modal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }} keyboardVerticalOffset={Platform.OS === 'android' ? 30 : 0}>
          <View style={s.modalOverlay}>
            <View style={s.modalCard}>
              <Text style={s.modalTitle}>{editId ? 'Редактировать' : 'Добавить в вишлист'}</Text>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

                <View style={s.field}>
                  <Text style={[s.label, errors.name && s.labelError]}>
                    Название фигурки{' '}
                    <Text style={s.requiredMark}>* обязательно</Text>
                  </Text>
                  <TextInput
                    style={[s.input, errors.name && s.inputError]}
                    value={form.name}
                    onChangeText={v => { setField('name', v); if (v.trim()) setErrors(p => ({ ...p, name: false })) }}
                    placeholder="Evangelion Unit-01"
                    placeholderTextColor={colors.text2}
                  />
                  {errors.name ? <Text style={s.errorMsg}>Поле обязательно для заполнения</Text> : null}
                </View>

                <View style={s.field}>
                  <Text style={s.label}>Оригинальное название</Text>
                  <TextInput style={s.input} value={form.originalName} onChangeText={v => setField('originalName', v)} placeholder="エヴァンゲリオン初号機" placeholderTextColor={colors.text2} />
                </View>

                <View style={s.field}>
                  <Text style={s.label}>Персонаж (на русском)</Text>
                  <TextInput style={s.input} value={form.characterRu} onChangeText={v => setField('characterRu', v)} placeholder="Синдзи Икари" placeholderTextColor={colors.text2} />
                </View>

                <View style={s.field}>
                  <Text style={s.label}>Производитель</Text>
                  <TextInput style={s.input} value={form.manufacturer} onChangeText={v => setField('manufacturer', v)} placeholder="Bandai, Good Smile Company..." placeholderTextColor={colors.text2} />
                </View>

                <View style={s.field}>
                  <Text style={s.label}>Год выпуска</Text>
                  <TextInput style={s.input} value={form.releaseDate} onChangeText={v => setField('releaseDate', v)} placeholder="2023" placeholderTextColor={colors.text2} keyboardType="numeric" />
                </View>

                <View style={s.field}>
                  <Text style={s.label}>Приоритет</Text>
                  <View style={s.priorityBtns}>
                    {priorities.map(p => (
                      <TouchableOpacity
                        key={p.value}
                        style={[s.priorityBtn, form.priority === p.value && { borderColor: p.color, backgroundColor: `${p.color}20` }]}
                        onPress={() => setField('priority', p.value)}
                      >
                        <Text style={[s.priorityBtnText, form.priority === p.value && { color: p.color }]}>{p.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={s.field}>
                  <Text style={s.label}>Комментарий</Text>
                  <TextInput style={s.input} value={form.comment} onChangeText={v => setField('comment', v)} placeholder="Версия, цвет, особенности..." placeholderTextColor={colors.text2} />
                </View>

                <View style={s.modalHint}>
                  <Text style={s.modalHintText}>✓ Получите уведомление когда эта фигурка появится в магазине</Text>
                </View>

                <View style={s.modalBtns}>
                  <TouchableOpacity style={s.cancelBtn} onPress={() => setModal(false)}>
                    <Text style={s.cancelText}>Отмена</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.addBtn} onPress={handleSave} disabled={saving}>
                    {saving ? <ActivityIndicator color="white" size="small" /> : <Text style={s.addText}>{editId ? 'Сохранить' : 'Добавить'}</Text>}
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
  sortBar: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  sortList: { paddingHorizontal: 12, gap: 8, paddingVertical: 10 },
  sortBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2 },
  sortBtnActive: { borderColor: colors.accent, backgroundColor: `${colors.accent}20` },
  sortText: { fontSize: 12, color: colors.text2, fontWeight: '500' },
  sortTextActive: { color: colors.accent, fontWeight: '700' },
  list: { padding: 16 },
  card: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 10, flexDirection: 'row', overflow: 'hidden' },
  priorityBar: { width: 4 },
  cardBody: { flex: 1, padding: 14 },
  cardName: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 2 },
  cardOriginal: { fontSize: 12, color: colors.text2, marginBottom: 6 },
  cardTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  cardTag: { fontSize: 11, color: colors.text2, backgroundColor: colors.surface2, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  cardComment: { fontSize: 13, color: colors.text2, marginBottom: 6 },
  cardPriority: { fontSize: 12, fontWeight: '500' },
  cardActions: { flexDirection: 'column', gap: 4, padding: 8, justifyContent: 'center' },
  editBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  editBtnText: { fontSize: 16 },
  deleteBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  deleteText: { color: colors.text2, fontSize: 16 },
  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: colors.text, marginBottom: 8 },
  emptySub: { fontSize: 14, color: colors.text2, textAlign: 'center', lineHeight: 20 },
  fab: { position: 'absolute', right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center' },
  fabText: { color: 'white', fontSize: 28, fontWeight: '300', marginTop: -2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 8, borderTopWidth: 1, borderColor: colors.border, maxHeight: '92%' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 20 },
  field: { marginBottom: 16 },
  label: { fontSize: 11, fontWeight: '600', color: colors.text2, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  labelError: { color: '#FF3B30' },
  requiredMark: { color: '#FF3B30', fontWeight: '700', textTransform: 'none' },
  input: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, color: colors.text, fontSize: 15 },
  inputError: { borderColor: '#FF3B30', borderWidth: 1.5 },
  errorMsg: { fontSize: 11, color: '#FF3B30', marginTop: 4 },
  priorityBtns: { flexDirection: 'row', gap: 8 },
  priorityBtn: { flex: 1, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  priorityBtnText: { fontSize: 13, fontWeight: '500', color: colors.text2 },
  modalHint: { backgroundColor: 'rgba(42,170,96,0.08)', borderWidth: 1, borderColor: 'rgba(42,170,96,0.2)', borderRadius: 8, padding: 12, marginBottom: 16 },
  modalHintText: { fontSize: 13, color: colors.green },
  modalBtns: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  cancelText: { color: colors.text, fontSize: 15, fontWeight: '500' },
  addBtn: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: colors.accent, alignItems: 'center' },
  addText: { color: 'white', fontSize: 15, fontWeight: '600' },
  linkedBadge: { fontSize: 10, color: colors.green, fontWeight: '700' },
})
