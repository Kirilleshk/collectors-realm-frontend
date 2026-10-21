import React from 'react'
import { View, Text, TextInput, TouchableOpacity, Modal, Pressable, ScrollView, StyleSheet } from 'react-native'
import { colors } from '../theme'
import { CATEGORIES } from '../utils/productMeta'
import { X, MapPin, Check } from '../icons'

// Панель «Фильтры» магазина (21.10.2026): категория, цена от–до, только
// мой город, сортировка. Применяется сразу (без «Применить»), кнопка внизу
// показывает, сколько товаров найдено, и закрывает панель.

export const SORTS = [
  { value: 'new', label: 'Сначала новые' },
  { value: 'cheap', label: 'Дешевле' },
  { value: 'expensive', label: 'Дороже' },
]

export const EMPTY_FILTERS = { category: null, priceFrom: '', priceTo: '', myCity: false, sort: 'new' }

// Сколько фильтров включено — для цифры на кнопке «Фильтры»
export function activeFiltersCount(f) {
  return (f.category ? 1 : 0) + (f.priceFrom ? 1 : 0) + (f.priceTo ? 1 : 0) + (f.myCity ? 1 : 0) + (f.sort !== 'new' ? 1 : 0)
}

function Chip({ label, active, onPress }) {
  return (
    <TouchableOpacity style={[s.chip, active && s.chipActive]} onPress={onPress} activeOpacity={0.85}>
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  )
}

export default function ShopFilters({ visible, onClose, value, onChange, onReset, resultCount, userCity }) {
  const digits = t => t.replace(/\D/g, '').slice(0, 9)
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.sheet} onPress={() => {}}>
          <View style={s.head}>
            <Text style={s.title}>Фильтры</Text>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Закрыть"><X size={22} color={colors.text2} /></TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
            <Text style={s.label}>Категория</Text>
            <View style={s.chips}>
              <Chip label="Все" active={!value.category} onPress={() => onChange({ category: null })} />
              {CATEGORIES.map(c => (
                <Chip key={c.value} label={c.label} active={value.category === c.value} onPress={() => onChange({ category: c.value })} />
              ))}
            </View>

            <Text style={s.label}>Цена, ₽</Text>
            <View style={s.priceRow}>
              <TextInput
                style={s.input}
                value={value.priceFrom}
                onChangeText={t => onChange({ priceFrom: digits(t) })}
                placeholder="от"
                placeholderTextColor={colors.text2}
                keyboardType="numeric"
              />
              <Text style={s.dash}>—</Text>
              <TextInput
                style={s.input}
                value={value.priceTo}
                onChangeText={t => onChange({ priceTo: digits(t) })}
                placeholder="до"
                placeholderTextColor={colors.text2}
                keyboardType="numeric"
              />
            </View>

            <Text style={s.label}>Где</Text>
            {userCity ? (
              <TouchableOpacity style={[s.toggle, value.myCity && s.toggleOn]} onPress={() => onChange({ myCity: !value.myCity })} activeOpacity={0.85}>
                <MapPin size={18} color={value.myCity ? colors.accent : colors.text2} strokeWidth={2} />
                <Text style={[s.toggleText, value.myCity && { color: colors.text }]}>Только продавцы из города {userCity}</Text>
                <View style={[s.check, value.myCity && s.checkOn]}>{value.myCity ? <Check size={14} color="#fff" strokeWidth={3} /> : null}</View>
              </TouchableOpacity>
            ) : (
              <Text style={s.hint}>Укажите свой город в «Профиль → Редактировать профиль» — тогда можно будет показать товары только из него.</Text>
            )}

            <Text style={s.label}>Сортировка</Text>
            <View style={s.chips}>
              {SORTS.map(o => (
                <Chip key={o.value} label={o.label} active={value.sort === o.value} onPress={() => onChange({ sort: o.value })} />
              ))}
            </View>
          </ScrollView>

          <View style={s.footer}>
            <TouchableOpacity style={s.resetBtn} onPress={onReset}>
              <Text style={s.resetText}>Сбросить</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.showBtn} onPress={onClose}>
              <Text style={s.showText}>Показать {resultCount}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { width: '100%', maxWidth: 640, maxHeight: '85%', alignSelf: 'center', backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderColor: colors.border },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  body: { padding: 20, gap: 10 },
  label: { fontSize: 13, fontWeight: '700', color: colors.text2, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2 },
  chipActive: { borderColor: colors.accent, backgroundColor: `${colors.accent}18` },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.text2 },
  chipTextActive: { color: colors.accent },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  // minWidth: 0 — иначе в вебе поле не сжимается и «до» вылезает за край
  input: { flex: 1, minWidth: 0, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, color: colors.text, fontSize: 15 },
  dash: { color: colors.text2, fontSize: 16 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14 },
  toggleOn: { borderColor: colors.accent },
  toggleText: { flex: 1, fontSize: 14, color: colors.text2, fontWeight: '600' },
  check: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  checkOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  hint: { fontSize: 13, color: colors.text2, lineHeight: 19 },
  footer: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: colors.border },
  resetBtn: { paddingHorizontal: 18, justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  resetText: { color: colors.text2, fontSize: 15, fontWeight: '600' },
  showBtn: { flex: 1, height: 48, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  showText: { color: '#fff', fontSize: 16, fontWeight: '800' },
})
