import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Image, Platform, Linking, Alert } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { products, wishlist } from '../api'
import { colors } from '../theme'

const CLOUD_NAME = 'dqutmb1rm'
const UPLOAD_PRESET = 'collectors_realm'

const SELLER = {
  telegram: 'collector_realm_shop',
  whatsapp: '79001234567',
  max: 'collector_realm_shop',
  name: "Collector's Realm"
}

const STATUS_INFO = {
  AVAILABLE: { label: null, color: null },
  SOLD: { label: 'Продан', color: '#8E8E93' },
  PREORDER: { label: 'Предзаказ', color: '#007AFF' },
  RESERVED: { label: 'Резерв', color: '#FF9500' },
  NEGOTIABLE: { label: 'Торг уместен', color: '#AF52DE' },
}

export default function ProductDetailScreen({ route, navigation }) {
  const { id } = route.params
  const [item, setItem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [addingToWishlist, setAddingToWishlist] = useState(false)
  const [addedToWishlist, setAddedToWishlist] = useState(false)
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0)
  const [uploading, setUploading] = useState(false)

  useEffect(() => { load() }, [id])

  async function load() {
    try {
      const res = await products.getById(id)
      setItem(res.data)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  async function handlePickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') { alert('Нужно разрешение!'); return }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    })
    if (!result.canceled) uploadPhoto(result.assets[0].uri)
  }

  async function uploadPhoto(uri) {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', { uri, type: 'image/jpeg', name: 'photo.jpg' })
      fd.append('upload_preset', UPLOAD_PRESET)
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: 'POST', body: fd })
      const data = await res.json()
      if (data.secure_url) {
        setItem(prev => ({
          ...prev,
          images: [...(prev.images || []), { url: data.secure_url, order: (prev.images || []).length }]
        }))
      }
    } catch (e) { alert('Ошибка загрузки фото') }
    setUploading(false)
  }

  async function handleAddToWishlist() {
    setAddingToWishlist(true)
    try {
      await wishlist.add(item.name, 'HIGH', `Хочу купить: ${item.name}`)
      setAddedToWishlist(true)
    } catch (e) { console.error(e) }
    setAddingToWishlist(false)
  }

  async function openTelegram() {
    const msg = encodeURIComponent(`Здравствуйте! Меня интересует товар "${item.name}" за ${item.price?.toLocaleString('ru')} ₽`)
    const url = `https://t.me/${SELLER.telegram}?text=${msg}`
    try { await Linking.openURL(url) } catch { Linking.openURL(`https://t.me/${SELLER.telegram}`) }
  }

  async function openWhatsApp() {
    const msg = encodeURIComponent(`Здравствуйте! Меня интересует товар "${item.name}" за ${item.price?.toLocaleString('ru')} ₽`)
    const url = `https://wa.me/${SELLER.whatsapp}?text=${msg}`
    try { await Linking.openURL(url) } catch { Linking.openURL(`https://wa.me/${SELLER.whatsapp}`) }
  }

  async function openMax() {
    const msg = encodeURIComponent(`Здравствуйте! Меня интересует товар "${item.name}" за ${item.price?.toLocaleString('ru')} ₽`)
    const url = `https://max.ru/im?to=${SELLER.max}&text=${msg}`
    try { await Linking.openURL(url) } catch { Linking.openURL(`https://max.ru/${SELLER.max}`) }
  }

  if (loading) return (
    <View style={s.center}><ActivityIndicator color={colors.accent} size="large" /></View>
  )

  if (!item) return (
    <View style={s.center}><Text style={s.errorText}>Товар не найден</Text></View>
  )

  const conditionLabel = item.condition === 'USED' ? 'Б/у' : 'Новый'
  const conditionColor = item.condition === 'USED' ? colors.purple : colors.green
  const isSold = item.status === 'SOLD'
  const statusInfo = STATUS_INFO[item.status] || STATUS_INFO.AVAILABLE
  const allPhotos = item.images || []
  const currentPhoto = allPhotos[currentPhotoIndex]?.url || null

  return (
    <ScrollView style={s.wrap} showsVerticalScrollIndicator={false}>
      {/* Фото */}
      <View style={s.imageWrap}>
        {currentPhoto
          ? <Image source={{ uri: currentPhoto }} style={s.image} resizeMode="cover" />
          : <Text style={s.imageIcon}>🗿</Text>
        }
        {/* Бейдж статуса */}
        <View style={[s.conditionBadge, {
          backgroundColor: statusInfo.color ? `${statusInfo.color}25` : `${conditionColor}25`,
          borderColor: statusInfo.color ? `${statusInfo.color}60` : `${conditionColor}60`
        }]}>
          <Text style={[s.conditionText, { color: statusInfo.color || conditionColor }]}>
            {statusInfo.label || conditionLabel}
          </Text>
        </View>
        <TouchableOpacity style={s.photoBtn} onPress={handlePickPhoto} disabled={uploading}>
          {uploading
            ? <ActivityIndicator color="white" size="small" />
            : <Text style={s.photoBtnText}>📷 Добавить фото</Text>
          }
        </TouchableOpacity>
      </View>

      {/* Миниатюры */}
      {allPhotos.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.thumbsRow} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
          {allPhotos.map((img, i) => (
            <TouchableOpacity key={i} onPress={() => setCurrentPhotoIndex(i)}>
              <Image source={{ uri: img.url }} style={[s.thumb, currentPhotoIndex === i && s.thumbActive]} resizeMode="cover" />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <View style={s.content}>
        <View style={s.titleRow}>
          <Text style={s.title}>{item.name}</Text>
          <Text style={s.price}>{item.price?.toLocaleString('ru')} ₽</Text>
        </View>

        {item.manufacturer ? (
          <View style={s.manufacturerRow}>
            <Text style={s.manufacturerIcon}>🏭</Text>
            <Text style={s.manufacturer}>{item.manufacturer}</Text>
          </View>
        ) : null}

        {/* Характеристики */}
        <View style={s.specsCard}>
          <Text style={s.specsTitle}>Характеристики</Text>
          <View style={s.specRow}>
            <Text style={s.specLabel}>Состояние</Text>
            <Text style={[s.specValue, { color: conditionColor }]}>{conditionLabel}</Text>
          </View>
          {statusInfo.label && (
            <View style={s.specRow}>
              <Text style={s.specLabel}>Статус</Text>
              <Text style={[s.specValue, { color: statusInfo.color }]}>{statusInfo.label}</Text>
            </View>
          )}
          {item.manufacturer && (
            <View style={s.specRow}>
              <Text style={s.specLabel}>Производитель</Text>
              <Text style={s.specValue}>{item.manufacturer}</Text>
            </View>
          )}
          {item.franchise && (
            <View style={s.specRow}>
              <Text style={s.specLabel}>Франшиза</Text>
              <Text style={s.specValue}>{item.franchise}</Text>
            </View>
          )}
          {item.character && (
            <View style={s.specRow}>
              <Text style={s.specLabel}>Персонаж</Text>
              <Text style={s.specValue}>{item.character}</Text>
            </View>
          )}
          <View style={s.specRow}>
            <Text style={s.specLabel}>Цена</Text>
            <Text style={[s.specValue, { color: colors.accent }]}>{item.price?.toLocaleString('ru')} ₽</Text>
          </View>
        </View>

        {/* Описание */}
        {item.description ? (
          <View style={s.descCard}>
            <Text style={s.descTitle}>Описание</Text>
            <Text style={s.descText}>{item.description}</Text>
          </View>
        ) : null}

        {/* Контакты продавца */}
        {!isSold ? (
          <View style={s.contactCard}>
            <Text style={s.contactTitle}>Связаться с продавцом</Text>
            <View style={s.contactRow}>
              <TouchableOpacity style={s.telegramBtn} onPress={openTelegram}>
                <Text style={s.contactBtnIcon}>✈️</Text>
                <Text style={s.telegramBtnText}>Telegram</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.whatsappBtn} onPress={openWhatsApp}>
                <Text style={s.contactBtnIcon}>💬</Text>
                <Text style={s.whatsappBtnText}>WhatsApp</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={s.maxBtn} onPress={openMax}>
              <Text style={s.contactBtnIcon}>💙</Text>
              <Text style={s.maxBtnText}>Написать в Max</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Кнопки */}
        {!isSold ? (
          <View style={s.actions}>
            <TouchableOpacity style={s.buyBtn} onPress={() => navigation.navigate('Chat', { productName: item.name, productId: item.id })}>
              <Text style={s.buyBtnText}>💬 Написать в чате</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.wishlistBtn, addedToWishlist && s.wishlistBtnAdded]}
              onPress={handleAddToWishlist}
              disabled={addingToWishlist || addedToWishlist}
            >
              {addingToWishlist
                ? <ActivityIndicator color={colors.accent} size="small" />
                : <Text style={[s.wishlistBtnText, addedToWishlist && { color: colors.green }]}>
                    {addedToWishlist ? '✓ В вишлисте' : '🎯 В вишлист'}
                  </Text>
              }
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.soldBanner}>
            <Text style={s.soldBannerText}>😔 Товар уже продан</Text>
            <TouchableOpacity style={s.wishlistBtn} onPress={handleAddToWishlist} disabled={addingToWishlist || addedToWishlist}>
              <Text style={s.wishlistBtnText}>{addedToWishlist ? '✓ В вишлисте' : '🎯 Слежу за похожим'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: colors.text2, fontSize: 16 },
  imageWrap: { height: 280, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', position: 'relative', borderBottomWidth: 1, borderBottomColor: colors.border },
  image: { width: '100%', height: '100%' },
  imageIcon: { fontSize: 100 },
  conditionBadge: { position: 'absolute', top: 16, right: 16, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  conditionText: { fontSize: 13, fontWeight: '700' },
  photoBtn: { position: 'absolute', bottom: 12, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  photoBtnText: { color: 'white', fontSize: 13, fontWeight: '600' },
  thumbsRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  thumb: { width: 60, height: 60, borderRadius: 8, borderWidth: 2, borderColor: 'transparent' },
  thumbActive: { borderColor: colors.accent },
  content: { padding: 20 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, gap: 16 },
  title: { flex: 1, fontSize: 22, fontWeight: '800', color: colors.text, lineHeight: 28 },
  price: { fontSize: 24, fontWeight: '900', color: colors.accent },
  manufacturerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  manufacturerIcon: { fontSize: 16 },
  manufacturer: { fontSize: 14, color: colors.text2, fontWeight: '500' },
  specsCard: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 16 },
  specsTitle: { fontSize: 11, fontWeight: '700', color: colors.text2, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 14 },
  specRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  specLabel: { fontSize: 14, color: colors.text2 },
  specValue: { fontSize: 14, color: colors.text, fontWeight: '600' },
  descCard: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 16 },
  descTitle: { fontSize: 11, fontWeight: '700', color: colors.text2, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 },
  descText: { fontSize: 15, color: colors.text, lineHeight: 22 },
  contactCard: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 16, gap: 10 },
  contactTitle: { fontSize: 11, fontWeight: '700', color: colors.text2, textTransform: 'uppercase', letterSpacing: 1.5 },
  contactRow: { flexDirection: 'row', gap: 10 },
  telegramBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#229ED9', borderRadius: 12, padding: 14 },
  telegramBtnText: { color: 'white', fontWeight: '700', fontSize: 15 },
  whatsappBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#25D366', borderRadius: 12, padding: 14 },
  whatsappBtnText: { color: 'white', fontWeight: '700', fontSize: 15 },
  maxBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#0077FF', borderRadius: 12, padding: 14 },
  maxBtnText: { color: 'white', fontWeight: '700', fontSize: 15 },
  contactBtnIcon: { fontSize: 18 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  buyBtn: { flex: 1, backgroundColor: colors.accent, borderRadius: 14, padding: 16, alignItems: 'center' },
  buyBtnText: { color: 'white', fontSize: 16, fontWeight: '700' },
  wishlistBtn: { flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  wishlistBtnAdded: { borderColor: colors.green },
  wishlistBtnText: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  soldBanner: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, alignItems: 'center', gap: 12 },
  soldBannerText: { fontSize: 16, color: colors.text2, fontWeight: '600' },
})