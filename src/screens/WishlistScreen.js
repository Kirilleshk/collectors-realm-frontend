
import React, { useState, useEffect } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput, Modal, RefreshControl, Alert, KeyboardAvoidingView, Platform } from 'react-native'
import { wishlist } from '../api'
import { colors } from '../theme'

const priorities = [
  { value: 'HIGH', label: 'Высокий', color: colors.accent },
  { value: 'MEDIUM', label: 'Средний', color: colors.blue },
  { value: 'LOW', label: 'Низкий', color: colors.text2 },
]

export default function WishlistScreen() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [modal, setModal] = useState(false)
  const [name, setName] = useState('')
  const [priority, setPriority] = useState('MEDIUM')
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)

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

  async function handleAdd() {
    if (!name.trim()) return
    setSaving(true)
    try {
      await wishlist.add(name.trim(), priority, comment.trim() || undefined)
      setName(''); setPriority('MEDIUM'); setComment(''); setModal(false)
      await load()
    } catch (e) { Alert.alert('Ошибка', e.response?.data?.error || 'Не удалось добавить') }
    setSaving(false)
  }

  async function handleDelete(id) {
    Alert.alert('Удалить?', 'Убрать из вишлиста?', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: async () => {
        try { await wishlist.remove(id); await load() } catch (e) {}
      }}
    ])
  }

  if (loading) return <View style={s.center}><ActivityIndicator color={colors.accent} size="large" /></View>

  return (
    <View style={s.wrap}>
      <FlatList
        data={items}
        keyExtractor={i => i.id}
        contentContainerStyle={s.list}
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
                {item.comment ? <Text style={s.cardComment}>{item.comment}</Text> : null}
                <Text style={[s.cardPriority, { color: p?.color }]}>{p?.label} приоритет</Text>
              </View>
              <TouchableOpacity style={s.deleteBtn} onPress={() => handleDelete(item.id)}>
                <Text style={s.deleteText}>✕</Text>
              </TouchableOpacity>
            </View>
          )
        }}
      />
      <TouchableOpacity style={s.fab} onPress={() => setModal(true)}>
        <Text style={s.fabText}>+</Text>
      </TouchableOpacity>
      <Modal visible={modal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Добавить в вишлист</Text>
            <View style={s.field}>
              <Text style={s.label}>Название фигурки *</Text>
              <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Например: Evangelion Unit-01" placeholderTextColor={colors.text2} />
            </View>
            <View style={s.field}>
              <Text style={s.label}>Приоритет</Text>
              <View style={s.priorityBtns}>
                {priorities.map(p => (
                  <TouchableOpacity key={p.value} style={[s.priorityBtn, priority === p.value && { borderColor: p.color, backgroundColor: `${p.color}20` }]} onPress={() => setPriority(p.value)}>
                    <Text style={[s.priorityBtnText, priority === p.value && { color: p.color }]}>{p.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={s.field}>
              <Text style={s.label}>Комментарий</Text>
              <TextInput style={s.input} value={comment} onChangeText={setComment} placeholder="Версия, цвет, производитель..." placeholderTextColor={colors.text2} />
            </View>
            <View style={s.modalHint}>
              <Text style={s.modalHintText}>✓ Получите уведомление когда эта фигурка появится в магазине</Text>
            </View>
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setModal(false)}>
                <Text style={s.cancelText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.addBtn} onPress={handleAdd} disabled={saving}>
                {saving ? <ActivityIndicator color="white" size="small" /> : <Text style={s.addText}>Добавить</Text>}
              </TouchableOpacity>
            </View>
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
  list: { padding: 16, paddingBottom: 80 },
  card: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 10, flexDirection: 'row', overflow: 'hidden' },
  priorityBar: { width: 4 },
  cardBody: { flex: 1, padding: 14 },
  cardName: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 4 },
  cardComment: { fontSize: 13, color: colors.text2, marginBottom: 6 },
  cardPriority: { fontSize: 12, fontWeight: '500' },
  deleteBtn: { padding: 14, justifyContent: 'center' },
  deleteText: { color: colors.text2, fontSize: 16 },
  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: colors.text, marginBottom: 8 },
  emptySub: { fontSize: 14, color: colors.text2, textAlign: 'center', lineHeight: 20 },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center' },
  fabText: { color: 'white', fontSize: 28, fontWeight: '300', marginTop: -2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, borderTopWidth: 1, borderColor: colors.border },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 20 },
  field: { marginBottom: 16 },
  label: { fontSize: 11, fontWeight: '600', color: colors.text2, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  input: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, color: colors.text, fontSize: 15 },
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
})
