import React, { useState, useLayoutEffect } from 'react'
import { View, Text, TextInput, ScrollView, TouchableOpacity, Image, ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native'
import { products } from '../api'
import { useAuth } from '../AuthContext'
import { colors } from '../theme'
import { pickAndUploadPhoto } from '../utils/uploadPhoto'
import { track } from '../utils/analytics'
import ScreenBackground from '../components/ScreenBackground'
import IconLabel from '../components/IconLabel'
import { ImagePlus, X, ChevronDown, ChevronUp, Send, Phone } from '../icons'

// Экран «Разместить товар» — открывается кнопкой «+» в магазине (20.10.2026).
// С route.params.product — та же форма в режиме «Редактировать» (кнопка
// владельца в карточке товара): поля заполнены, сохранение — PUT.
// Одна прокручиваемая форма сверху вниз: фото → что продаёте → цена →
// описание → подробности (свёрнуты) → как связаться. Ошибки показываются
// прямо под полями, а не через Alert.alert: в вебе он пустая заглушка
// и человек просто не понял бы, почему ничего не происходит.

const MAX_PHOTOS = 5

const CONDITIONS = [
  { value: 'NEW', label: 'Новый', hint: 'в коробке, не распакован' },
  { value: 'USED', label: 'Б/у', hint: 'был в использовании' },
]

// «@nick», «nick», «t.me/nick», «https://t.me/nick» → «nick»
function normalizeTelegram(v) {
  return v.trim()
    .replace(/^(https?:\/\/)?(www\.)?(t|telegram)\.me\//i, '')
    .replace(/^@/, '')
    .trim()
}

// «+7 (900) 123-45-67», «8 900 123 45 67», «9001234567» → «79001234567»
function normalizePhone(v) {
  let d = v.replace(/\D/g, '')
  if (d.length === 11 && d[0] === '8') d = '7' + d.slice(1)
  if (d.length === 10 && d[0] === '9') d = '7' + d
  return d
}

function parsePrice(v) {
  return Number(v.replace(/\s/g, '').replace(',', '.'))
}

export default function SellProductScreen({ navigation, route }) {
  const { user } = useAuth()
  const editing = route.params?.product || null
  const isStaff = user?.roles?.some(r => r === 'ADMIN' || r === 'MODERATOR')
  // Товары персонала публикуются от имени магазина Markeltoys — контакты
  // продавца им не нужны, покупатель пишет администрации как и раньше.
  // При правке решает сам товар: у товара пользователя контакты нужны — но
  // правит их только сам продавец (схема персонала на бэкенде их не принимает)
  const needContacts = editing ? !!editing.sellerId && !isStaff : !isStaff

  useLayoutEffect(() => {
    if (editing) navigation.setOptions({ title: 'Редактировать товар' })
  }, [navigation, editing])

  const initial = (v) => (v == null ? '' : String(v))
  const [photos, setPhotos] = useState(() => editing?.images?.map(i => i.url) || [])
  const [uploading, setUploading] = useState(false)
  const [name, setName] = useState(initial(editing?.name))
  const [condition, setCondition] = useState(editing?.condition || 'NEW')
  const [price, setPrice] = useState(initial(editing?.price))
  const [description, setDescription] = useState(initial(editing?.description))
  const [manufacturer, setManufacturer] = useState(initial(editing?.manufacturer))
  const [franchise, setFranchise] = useState(initial(editing?.franchise))
  const [character, setCharacter] = useState(initial(editing?.character))
  const [yearMade, setYearMade] = useState(initial(editing?.yearMade))
  // Подробности сразу раскрыты, если в них уже что-то заполнено
  const [showDetails, setShowDetails] = useState(!!(editing?.manufacturer || editing?.franchise || editing?.character || editing?.yearMade))
  const [telegram, setTelegram] = useState(editing?.sellerTelegram ? '@' + editing.sellerTelegram : '')
  const [phone, setPhone] = useState(editing?.sellerPhone ? '+' + editing.sellerPhone : '')
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function addPhoto() {
    if (photos.length >= MAX_PHOTOS) return
    // Кнопку во время загрузки не блокируем: в вебе при закрытии выбора файла
    // без выбора промис не завершается (см. uploadPhoto.js), и заблокированная
    // кнопка осталась бы мёртвой до перезахода на экран
    setUploading(true)
    const url = await pickAndUploadPhoto()
    setUploading(false)
    if (url) setPhotos(p => [...p, url].slice(0, MAX_PHOTOS))
  }

  function removePhoto(i) {
    setPhotos(p => p.filter((_, idx) => idx !== i))
  }

  function makeCover(i) {
    if (i === 0) return
    setPhotos(p => [p[i], ...p.filter((_, idx) => idx !== i)])
  }

  function validate() {
    const e = {}
    if (name.trim().length < 2) e.name = 'Напишите, что продаёте — хотя бы пару слов'
    const p = parsePrice(price)
    if (!price.trim() || !(p > 0)) e.price = 'Укажите цену в рублях'
    else if (p > 100000000) e.price = 'Слишком большая цена — проверьте число'
    if (yearMade.trim()) {
      const y = Number(yearMade.trim())
      const max = new Date().getFullYear() + 1
      if (!/^\d{4}$/.test(yearMade.trim()) || y < 1900 || y > max) e.yearMade = `Год — четыре цифры, от 1900 до ${max}`
    }
    if (needContacts) {
      const tg = normalizeTelegram(telegram)
      const ph = normalizePhone(phone)
      if (!tg && !ph) e.contact = 'Оставьте Telegram или телефон — иначе покупатель не сможет с вами связаться'
      if (tg && !/^[A-Za-z0-9_]{5,32}$/.test(tg)) e.telegram = 'Ник в Telegram — от 5 символов: латинские буквы, цифры, _'
      if (ph && (ph.length < 10 || ph.length > 15)) e.phone = 'Проверьте номер — не хватает цифр'
    }
    return e
  }

  async function handleSubmit() {
    if (submitting) return
    const e = validate()
    setErrors(e)
    setSubmitError(Object.keys(e).length ? 'Проверьте поля, отмеченные красным' : null)
    if (Object.keys(e).length) return

    setSubmitting(true)
    try {
      // Пустое поле: при создании — просто не шлём, при правке — очищаем явно,
      // иначе стёртое человеком описание/контакт сервер счёл бы «не трогать».
      // Схема персонала на бэкенде не принимает null в текстовых полях
      // (только строку) — ему шлём '', продавцу — null
      const empty = editing ? (isStaff ? '' : null) : undefined
      const body = {
        name: name.trim(),
        description: description.trim() || empty,
        price: parsePrice(price),
        condition,
        manufacturer: manufacturer.trim() || empty,
        franchise: franchise.trim() || empty,
        character: character.trim() || empty,
        yearMade: yearMade.trim() ? Number(yearMade.trim()) : (editing ? null : undefined),
        imageUrls: photos,
      }
      if (needContacts) {
        body.sellerTelegram = normalizeTelegram(telegram) || empty
        body.sellerPhone = normalizePhone(phone) || empty
      }
      if (editing) {
        await products.update(editing.id, body)
        // Карточка товара перечитает его сама, когда снова окажется на экране
        navigation.goBack()
        return
      }
      const res = await products.create(body)
      track('product_listed', { productId: res.data.id })
      // replace, а не navigate: «назад» из карточки должен вести в магазин,
      // а не обратно в уже отправленную форму
      navigation.replace('ProductDetail', { id: res.data.id })
    } catch (err) {
      // 400/403/429 — бэкенд отвечает понятной русской фразой (ошибка поля,
      // блокировка, лимит товаров) — показываем её как есть
      const status = err.response?.status
      const serverText = err.response?.data?.error
      setSubmitError(
        !err.response ? 'Нет связи с сервером — проверьте интернет и попробуйте ещё раз' :
        [400, 403, 429].includes(status) && serverText ? serverText :
        (editing ? 'Не удалось сохранить' : 'Не удалось опубликовать товар') + ' — попробуйте ещё раз через минуту'
      )
      setSubmitting(false)
    }
  }

  // Ошибка поля пропадает, как только человек начал его исправлять
  // (общая ошибка «оставьте хоть один контакт» — при правке любого из двух)
  function clearError(key) {
    const isContact = key === 'telegram' || key === 'phone'
    if (!errors[key] && !(isContact && errors.contact)) return
    setErrors(prev => ({ ...prev, [key]: undefined, ...(isContact ? { contact: undefined } : {}) }))
  }

  return (
    <ScreenBackground>
    <KeyboardAvoidingView style={s.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
    <ScrollView style={s.wrap} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <Text style={s.lead}>
        {editing
          ? 'Изменения сразу появятся в магазине.'
          : isStaff
            ? 'Товар появится в магазине от имени Markeltoys.'
            : 'Товар сразу появится в магазине. Покупатели свяжутся с вами напрямую — в Telegram или по телефону.'}
      </Text>

      {/* Фото */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Фото</Text>
        <Text style={s.cardHint}>
          {photos.length > 1
            ? 'Первое фото — обложка в магазине. Нажмите на другое, чтобы сделать обложкой его.'
            : `До ${MAX_PHOTOS} штук. Первое станет обложкой в магазине.`}
        </Text>
        <View style={s.photoGrid}>
          {photos.map((url, i) => (
            <TouchableOpacity key={url + i} style={s.photoTile} onPress={() => makeCover(i)} activeOpacity={0.85}>
              <Image source={{ uri: url }} style={s.photoImg} resizeMode="cover" />
              {i === 0 && <View style={s.coverTag}><Text style={s.coverTagText}>Обложка</Text></View>}
              <TouchableOpacity style={s.photoRemove} onPress={() => removePhoto(i)} hitSlop={8} accessibilityLabel="Убрать фото">
                <X size={14} color="#fff" strokeWidth={2.6} />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
          {photos.length < MAX_PHOTOS && (
            <TouchableOpacity style={[s.photoTile, s.photoAdd]} onPress={addPhoto} activeOpacity={0.8}>
              {uploading
                ? <ActivityIndicator color={colors.accent} />
                : <>
                    <ImagePlus size={26} color={colors.accent} strokeWidth={1.8} />
                    <Text style={s.photoAddText}>{photos.length ? 'Ещё фото' : 'Добавить фото'}</Text>
                  </>
              }
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Основное */}
      <View style={s.card}>
        <Text style={s.label}>Что продаёте <Text style={s.req}>*</Text></Text>
        <TextInput
          style={[s.input, errors.name && s.inputError]}
          value={name}
          onChangeText={t => { setName(t); clearError('name') }}
          placeholder="Например: Гоку, S.H.Figuarts"
          placeholderTextColor={colors.text2}
          maxLength={120}
        />
        {errors.name ? <Text style={s.error}>{errors.name}</Text> : null}

        <Text style={[s.label, s.labelGap]}>Состояние <Text style={s.req}>*</Text></Text>
        <View style={s.segment}>
          {CONDITIONS.map(c => (
            <TouchableOpacity
              key={c.value}
              style={[s.segmentBtn, condition === c.value && s.segmentBtnActive]}
              onPress={() => setCondition(c.value)}
              activeOpacity={0.85}
            >
              <Text style={[s.segmentText, condition === c.value && s.segmentTextActive]}>{c.label}</Text>
              <Text style={[s.segmentHint, condition === c.value && s.segmentHintActive]}>{c.hint}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[s.label, s.labelGap]}>Цена <Text style={s.req}>*</Text></Text>
        <View style={[s.priceWrap, errors.price && s.inputError]}>
          <TextInput
            style={s.priceInput}
            value={price}
            onChangeText={t => { setPrice(t.replace(/[^\d\s.,]/g, '')); clearError('price') }}
            placeholder="0"
            placeholderTextColor={colors.text2}
            keyboardType="numeric"
            maxLength={12}
          />
          <Text style={s.priceCurrency}>₽</Text>
        </View>
        {errors.price ? <Text style={s.error}>{errors.price}</Text> : null}

        <Text style={[s.label, s.labelGap]}>Описание</Text>
        <TextInput
          style={[s.input, s.textarea]}
          value={description}
          onChangeText={setDescription}
          placeholder="Комплектация, дефекты, есть ли коробка, как передадите"
          placeholderTextColor={colors.text2}
          multiline
          maxLength={3000}
          textAlignVertical="top"
        />
      </View>

      {/* Подробности — свёрнуты, чтобы не пугать длинной формой */}
      <View style={s.card}>
        <TouchableOpacity style={s.detailsHeader} onPress={() => setShowDetails(v => !v)} activeOpacity={0.7}>
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitle}>Подробнее о фигурке</Text>
            <Text style={s.cardHint}>Необязательно — помогает найти товар через поиск</Text>
          </View>
          {showDetails
            ? <ChevronUp size={20} color={colors.text2} />
            : <ChevronDown size={20} color={colors.text2} />}
        </TouchableOpacity>
        {(showDetails || errors.yearMade) ? (
          <View style={s.detailsBody}>
            <Text style={s.label}>Производитель</Text>
            <TextInput style={s.input} value={manufacturer} onChangeText={setManufacturer} placeholder="Bandai, Good Smile, Hot Toys…" placeholderTextColor={colors.text2} maxLength={80} />
            <Text style={[s.label, s.labelGap]}>Франшиза</Text>
            <TextInput style={s.input} value={franchise} onChangeText={setFranchise} placeholder="Dragon Ball, Marvel, Наруто…" placeholderTextColor={colors.text2} maxLength={80} />
            <Text style={[s.label, s.labelGap]}>Персонаж</Text>
            <TextInput style={s.input} value={character} onChangeText={setCharacter} placeholder="Гоку, Человек-паук…" placeholderTextColor={colors.text2} maxLength={80} />
            <Text style={[s.label, s.labelGap]}>Год выпуска</Text>
            <TextInput
              style={[s.input, errors.yearMade && s.inputError]}
              value={yearMade}
              onChangeText={t => { setYearMade(t.replace(/\D/g, '')); clearError('yearMade') }}
              placeholder="2024"
              placeholderTextColor={colors.text2}
              keyboardType="numeric"
              maxLength={4}
            />
            {errors.yearMade ? <Text style={s.error}>{errors.yearMade}</Text> : null}
          </View>
        ) : null}
      </View>

      {/* Контакты — только у товара пользователя (не магазина) */}
      {needContacts && (
        <View style={[s.card, errors.contact && s.cardError]}>
          <Text style={s.cardTitle}>Как с вами связаться <Text style={s.req}>*</Text></Text>
          <Text style={s.cardHint}>Хотя бы одно. Увидят все, кто откроет ваш товар.</Text>

          <View style={[s.iconInput, errors.telegram && s.inputError]}>
            <Send size={18} color={colors.blue} strokeWidth={2} />
            <TextInput
              style={s.iconInputField}
              value={telegram}
              onChangeText={t => { setTelegram(t); clearError('telegram') }}
              placeholder="Telegram: @ваш_ник"
              placeholderTextColor={colors.text2}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={60}
            />
          </View>
          {errors.telegram ? <Text style={s.error}>{errors.telegram}</Text> : null}

          <View style={[s.iconInput, s.iconInputGap, errors.phone && s.inputError]}>
            <Phone size={18} color={colors.green} strokeWidth={2} />
            <TextInput
              style={s.iconInputField}
              value={phone}
              onChangeText={t => { setPhone(t); clearError('phone') }}
              placeholder="Телефон для WhatsApp и звонков"
              placeholderTextColor={colors.text2}
              keyboardType="phone-pad"
              maxLength={20}
            />
          </View>
          {errors.phone ? <Text style={s.error}>{errors.phone}</Text> : null}
          {errors.contact ? <Text style={s.error}>{errors.contact}</Text> : null}
        </View>
      )}

      {submitError ? <Text style={[s.error, s.submitError]}>{submitError}</Text> : null}
      <TouchableOpacity style={[s.submitBtn, submitting && s.submitBtnBusy]} onPress={handleSubmit} disabled={submitting} activeOpacity={0.85}>
        {submitting
          ? <ActivityIndicator color="#fff" />
          : <Text style={s.submitText}>{editing ? 'Сохранить' : 'Опубликовать'}</Text>}
      </TouchableOpacity>
    </ScrollView>
    </KeyboardAvoidingView>
    </ScreenBackground>
  )
}

const s = StyleSheet.create({
  wrap: { flex: 1 },
  content: { padding: 16, paddingBottom: 40, gap: 12, width: '100%', maxWidth: 640, alignSelf: 'center' },
  lead: { fontSize: 14, color: colors.text2, lineHeight: 20, paddingHorizontal: 4 },
  card: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16 },
  cardError: { borderColor: `${colors.red}90` },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  cardHint: { fontSize: 12, color: colors.text2, marginTop: 4, lineHeight: 17 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  photoTile: { width: 96, height: 96, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.surface2 },
  photoImg: { width: '100%', height: '100%' },
  photoAdd: { justifyContent: 'center', alignItems: 'center', gap: 6, borderWidth: 1.5, borderStyle: 'dashed', borderColor: `${colors.accent}80`, backgroundColor: `${colors.accent}10` },
  photoAddText: { fontSize: 11, fontWeight: '700', color: colors.accent, textAlign: 'center' },
  coverTag: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(10,11,14,0.75)', paddingVertical: 3 },
  coverTagText: { fontSize: 10, fontWeight: '700', color: colors.text, textAlign: 'center' },
  photoRemove: { position: 'absolute', top: 5, right: 5, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(10,11,14,0.8)', justifyContent: 'center', alignItems: 'center' },
  label: { fontSize: 13, fontWeight: '600', color: colors.text2, marginBottom: 6 },
  labelGap: { marginTop: 14 },
  req: { color: colors.accent },
  input: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: colors.text, fontSize: 15 },
  inputError: { borderColor: colors.red },
  textarea: { minHeight: 96 },
  error: { fontSize: 12, color: colors.red, marginTop: 6, lineHeight: 16 },
  segment: { flexDirection: 'row', gap: 10 },
  segmentBtn: { flex: 1, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2, paddingVertical: 10, paddingHorizontal: 12, alignItems: 'center' },
  segmentBtnActive: { borderColor: colors.accent, backgroundColor: `${colors.accent}18` },
  segmentText: { fontSize: 15, fontWeight: '700', color: colors.text2 },
  segmentTextActive: { color: colors.accent },
  segmentHint: { fontSize: 11, color: colors.text2, marginTop: 2, textAlign: 'center' },
  segmentHintActive: { color: colors.text },
  priceWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14 },
  priceInput: { flex: 1, paddingVertical: 12, color: colors.text, fontSize: 18, fontWeight: '700' },
  priceCurrency: { fontSize: 18, fontWeight: '700', color: colors.text2, marginLeft: 8 },
  detailsHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailsBody: { marginTop: 14 },
  iconInput: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, marginTop: 12 },
  iconInputGap: { marginTop: 10 },
  iconInputField: { flex: 1, paddingVertical: 12, color: colors.text, fontSize: 15 },
  submitError: { textAlign: 'center', fontSize: 13 },
  submitBtn: { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  submitBtnBusy: { opacity: 0.7 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '800' },
})
