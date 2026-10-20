import React, { useState, useEffect, useRef } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Image, Platform, Linking, Alert, TextInput } from 'react-native'
import { products, wishlist, bids, collection, reviews, messages as messagesApi } from '../api'
import { useAuth } from '../AuthContext'
import { colors } from '../theme'
import { pickAndUploadPhoto } from '../utils/uploadPhoto'
import { track } from '../utils/analytics'
import { showNotice } from '../utils/notice'
import ScreenBackground from '../components/ScreenBackground'
import IconLabel from '../components/IconLabel'
import { Package, Gavel, Camera, Factory, Trophy, MessageCircle, Send, Target, Boxes, Check, CircleSlash, Phone, Pencil, CircleCheck, RotateCw, Trash2, User, ChevronRight, Star } from '../icons'
import { API_URL } from '../config'

const CLOUD_NAME = 'dqutmb1rm'
const UPLOAD_PRESET = 'collectors_realm'

// 20.10.2026: у товаров магазина убраны WhatsApp и Max — номер 79001234567
// был ненастоящим, ник в Max не проверен. Покупатель пишет магазину в чат
// поддержки внутри сайта (ChatScreen), он точно работает. Настоящие
// контакты магазина — добавить, когда их даст Марк.

const MAX_CONTENT = 820

const STATUS_INFO = {
  AVAILABLE: { label: null, color: null },
  SOLD: { label: 'Продан', color: '#8E8E93' },
  PREORDER: { label: 'Предзаказ', color: '#007AFF' },
  RESERVED: { label: 'Резерв', color: '#FF9500' },
  NEGOTIABLE: { label: 'Торг уместен', color: '#AF52DE' },
}

// 79001234567 → «+7 900 123-45-67»; другие форматы — просто с плюсом
function formatPhone(d) {
  if (d?.length === 11 && d[0] === '7') return `+7 ${d.slice(1, 4)} ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9)}`
  return d ? '+' + d : ''
}

// Подтверждение действия: Alert.alert с кнопками в вебе — пустая заглушка
// (диалог не появится и действие не выполнится), там — window.confirm
function confirmAction(title, text, okLabel, onOk) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${text}`)) onOk()
    return
  }
  Alert.alert(title, text, [
    { text: 'Отмена', style: 'cancel' },
    { text: okLabel, style: 'destructive', onPress: onOk },
  ])
}

function getTimeLeft(endTime) {
  const diff = new Date(endTime) - new Date()
  if (diff <= 0) return null
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    mins: Math.floor((diff % 3600000) / 60000),
    secs: Math.floor((diff % 60000) / 1000),
  }
}

export default function ProductDetailScreen({ route, navigation }) {
  const { id } = route.params
  const { user, token } = useAuth()
  const isStaff = user?.roles?.some(r => r === 'ADMIN' || r === 'MODERATOR')
  const [item, setItem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [addingToWishlist, setAddingToWishlist] = useState(false)
  const [addedToWishlist, setAddedToWishlist] = useState(false)
  const [addingToCollection, setAddingToCollection] = useState(false)
  const [addedToCollection, setAddedToCollection] = useState(false)
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [auctionBids, setAuctionBids] = useState([])
  const [bidAmount, setBidAmount] = useState('')
  const [placingBid, setPlacingBid] = useState(false)
  const [timeLeft, setTimeLeft] = useState(null)
  const [managing, setManaging] = useState(false)
  const [manageError, setManageError] = useState(null)
  const [sellerRating, setSellerRating] = useState(null) // { avg, count }
  const [openingChat, setOpeningChat] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => { load() }, [id])

  // Возврат на карточку (после «Редактировать») — перечитываем товар без
  // спиннера. Пока не закончилась первая загрузка — пропускаем (там уже идёт load())
  const loadedOnceRef = useRef(false)
  useEffect(() => navigation.addListener('focus', () => {
    if (loadedOnceRef.current) load()
  }), [navigation, id])

  // Рейтинг продавца-пользователя из отзывов о нём — показывается в блоке
  // продавца под ценой (доверие, как на Авито)
  useEffect(() => {
    const sellerId = item?.sellerId
    if (!sellerId) { setSellerRating(null); return }
    let alive = true
    reviews.getForUser(sellerId)
      .then(res => { if (alive) setSellerRating({ avg: res.data?.avgRating ?? null, count: res.data?.count || 0 }) })
      .catch(() => {})
    return () => { alive = false }
  }, [item?.sellerId])

  useEffect(() => {
    if (item?.isAuction && item?.auctionEndTime) {
      loadBids()
      setTimeLeft(getTimeLeft(item.auctionEndTime))
      timerRef.current = setInterval(() => {
        setTimeLeft(getTimeLeft(item.auctionEndTime))
      }, 1000)
    }
    return () => clearInterval(timerRef.current)
  }, [item?.auctionEndTime])

  async function loadBids() {
    try {
      const res = await bids.getForProduct(id)
      setAuctionBids(Array.isArray(res.data) ? res.data : [])
    } catch (e) {}
  }

  async function handlePlaceBid() {
    const amount = Number(bidAmount)
    const topBid = auctionBids[0]?.amount || 0
    const minBid = topBid > 0 ? topBid + (item.priceStep || 0) : (item.startPrice || 0)
    if (!amount || amount < minBid) {
      Alert.alert('Ставка слишком мала', `Минимальная ставка: ${minBid.toLocaleString('ru')} ₽`)
      return
    }
    setPlacingBid(true)
    try {
      await bids.place(id, amount)
      track('bid_placed', { productId: id, amount: Number(amount) })
      setBidAmount('')
      await loadBids()
    } catch (e) {
      Alert.alert('Ошибка', e.response?.data?.error || 'Не удалось сделать ставку')
    }
    setPlacingBid(false)
  }

  async function load() {
    try {
      const res = await products.getById(id)
      setItem(res.data)
    } catch (e) { console.error(e) }
    loadedOnceRef.current = true
    setLoading(false)
  }

  async function handlePickPhoto() {
    setUploading(true)
    const url = await pickAndUploadPhoto()
    if (url) {
      const newImages = [...(item.images || []), { url, order: (item.images || []).length }]
      try {
        const res = await fetch(`${API_URL}/products/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            name: item.name, price: item.price, condition: item.condition,
            imageUrls: newImages.map(i => i.url),
          }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        setItem(prev => ({ ...prev, images: newImages }))
      } catch (e) { Alert.alert('Ошибка', 'Не удалось сохранить фото') }
    }
    setUploading(false)
  }

  async function handleAddToWishlist() {
    setAddingToWishlist(true)
    try {
      await wishlist.add({
        name: item.name,
        priority: 'HIGH',
        manufacturer: item.manufacturer || undefined,
        productId: item.id,
      })
      setAddedToWishlist(true)
      track('add_to_wishlist', { productId: item.id, productName: item.name })
    } catch (e) { console.error(e) }
    setAddingToWishlist(false)
  }

  async function handleAddToCollection() {
    setAddingToCollection(true)
    try {
      await collection.add({
        name: item.name,
        manufacturer: item.manufacturer || undefined,
        purchasePrice: item.price || undefined,
        imageUrl: item.images?.[0]?.url || undefined,
        condition: item.condition || 'NEW',
      })
      setAddedToCollection(true)
      track('add_to_collection', { productId: item.id, productName: item.name })
    } catch (e) { Alert.alert('Ошибка', 'Не удалось добавить в коллекцию') }
    setAddingToCollection(false)
  }

  // Связь с продавцом-пользователем — напрямую, по его контактам из товара
  function openSellerTelegram() {
    track('contact_seller', { method: 'telegram', productId: item.id, sellerId: item.sellerId })
    Linking.openURL(`https://t.me/${item.sellerTelegram}`)
  }

  function openSellerWhatsApp() {
    track('contact_seller', { method: 'whatsapp', productId: item.id, sellerId: item.sellerId })
    const msg = encodeURIComponent(`Здравствуйте! Меня интересует ваш товар "${item.name}" за ${item.price?.toLocaleString('ru')} ₽ (Markeltoys)`)
    Linking.openURL(`https://wa.me/${item.sellerPhone}?text=${msg}`)
  }

  // «Написать» у товара пользователя — переписка на сайте (этап 3 «как на
  // Авито», 20.10.2026): найти/создать переписку и открыть её
  async function openChat() {
    if (openingChat) return
    setOpeningChat(true)
    try {
      const res = await messagesApi.start(item.id)
      track('contact_seller', { method: 'chat', productId: item.id, sellerId: item.sellerId })
      navigation.navigate('Conversation', { id: res.data.id })
    } catch (e) {
      showNotice(e.response?.data?.error || 'Не удалось открыть переписку — попробуйте ещё раз', { error: true })
    }
    setOpeningChat(false)
  }

  function callSeller() {
    track('contact_seller', { method: 'call', productId: item.id, sellerId: item.sellerId })
    Linking.openURL(`tel:+${item.sellerPhone}`)
  }

  async function handleToggleSold() {
    const next = item.status === 'SOLD' ? 'AVAILABLE' : 'SOLD'
    setManaging(true); setManageError(null)
    try {
      await products.setStatus(item.id, next)
      setItem(prev => ({ ...prev, status: next }))
      showNotice(next === 'SOLD' ? 'Отмечено проданным' : 'Снова в продаже')
    } catch (e) {
      setManageError(e.response?.data?.error || 'Не удалось изменить статус — попробуйте ещё раз')
    }
    setManaging(false)
  }

  function handleDelete() {
    confirmAction('Удалить товар?', 'Он пропадёт из магазина, вернуть его будет нельзя.', 'Удалить', async () => {
      setManaging(true); setManageError(null)
      try {
        await products.remove(item.id)
        showNotice('Объявление удалено')
        navigation.goBack()
      } catch (e) {
        setManageError(e.response?.data?.error || 'Не удалось удалить — попробуйте ещё раз')
        setManaging(false)
      }
    })
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
  // Товар пользователя (не магазина): свой блок продавца и прямые контакты
  // вместо контактов Markeltoys и чата с администрацией
  const isUserListing = !!item.sellerId
  const isOwner = isUserListing && item.sellerId === user?.id
  // Управлять из карточки: продавец — своим товаром, персонал — любым
  // (товар магазина, модерация чужого). Аукцион — только из админки:
  // в форме «+» нет полей аукциона
  const canManage = isOwner || (isStaff && !item.isAuction)
  // Кнопки покупателя («Написать», вишлист, коллекция) прячем только у того,
  // кто в этом товаре продавец: у владельца и у персонала на товаре магазина.
  // Модератор на чужом товаре пользователя — тоже покупатель: ему и панель
  // модерации, и «Написать» (раньше прятали по canManage — персонал не мог
  // написать продавцу, 20.10.2026)
  const hideBuyer = isOwner || (isStaff && !isUserListing)
  // Закреплённая внизу панель «Написать / Позвонить» (20.10.2026, этап 2
  // «как на Авито»): видна при любой прокрутке — покупателю не нужно искать
  // контакты внизу длинной страницы. Не показывается тому, кто управляет
  // товаром, у проданного и у аукциона (там свой блок ставок).
  // «Написать» — переписка на сайте с продавцом (Telegram/WhatsApp — запасные,
  // в блоке продавца); у товара магазина — чат с администрацией.
  const writeAction = isUserListing
    ? openChat
    : () => navigation.navigate('Chat', { productName: item.name, productId: item.id })
  const showBar = !hideBuyer && !isSold && !item.isAuction
  const ratingText = sellerRating?.count
    ? `${sellerRating.avg.toFixed(1)} · ${sellerRating.count} ${sellerRating.count % 10 === 1 && sellerRating.count % 100 !== 11 ? 'отзыв' : [2, 3, 4].includes(sellerRating.count % 10) && ![12, 13, 14].includes(sellerRating.count % 100) ? 'отзыва' : 'отзывов'}`
    : 'Пока нет отзывов'

  return (
    <ScreenBackground>
    <ScrollView style={s.wrap} contentContainerStyle={[s.scrollContent, showBar && s.scrollWithBar]} showsVerticalScrollIndicator={false}>
      {/* Фото */}
      <View style={s.imageWrap}>
        {currentPhoto
          ? <>
              <Image source={{ uri: currentPhoto }} style={s.imageBackdrop} resizeMode="cover" blurRadius={24} />
              <View style={s.imageDim} />
              <Image source={{ uri: currentPhoto }} style={s.image} resizeMode="contain" />
            </>
          : <Package size={80} color={colors.border} strokeWidth={1.2} />
        }
        {/* Бейдж статуса / аукциона */}
        {item.isAuction ? (
          <View style={[s.conditionBadge, { borderColor: '#FF6B0080' }]}>
            <IconLabel icon={Gavel} label="АУКЦИОН" size={14} gap={5} textStyle={[s.conditionText, { color: '#FF6B00' }]} />
          </View>
        ) : (
          <View style={[s.conditionBadge, {
            borderColor: statusInfo.color ? `${statusInfo.color}80` : `${conditionColor}80`
          }]}>
            <Text style={[s.conditionText, { color: statusInfo.color || conditionColor }]}>
              {statusInfo.label || conditionLabel}
            </Text>
          </View>
        )}
        {isStaff && (
          <TouchableOpacity style={s.photoBtn} onPress={handlePickPhoto} disabled={uploading}>
            {uploading
              ? <ActivityIndicator color="white" size="small" />
              : <IconLabel icon={Camera} label="Добавить фото" textStyle={s.photoBtnText} />
            }
          </TouchableOpacity>
        )}
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
          {item.isAuction
            ? <Text style={[s.price, { color: '#FF6B00', fontSize: 16 }]}>от {item.startPrice?.toLocaleString('ru')} ₽</Text>
            : <Text style={s.price}>{item.price?.toLocaleString('ru')} ₽</Text>
          }
        </View>

        {item.manufacturer ? (
          <View style={s.manufacturerRow}>
            <Factory size={16} color={colors.text2} strokeWidth={1.8} />
            <Text style={s.manufacturer}>{item.manufacturer}</Text>
          </View>
        ) : null}

        {/* Продавец — сразу под ценой, до характеристик: кто продаёт и
            насколько ему доверяют (рейтинг из отзывов). Владельцу и персоналу
            на товаре магазина — не показываем (hideBuyer), у них панель ниже */}
        {!hideBuyer && isUserListing ? (
          <View style={s.sellerCard}>
            {item.seller ? (
              <TouchableOpacity style={s.sellerRow} onPress={() => navigation.navigate('UserProfile', { userId: item.seller.id })} activeOpacity={0.7}>
                {item.seller.avatarUrl
                  ? <Image source={{ uri: item.seller.avatarUrl }} style={s.sellerAvatar} />
                  : <View style={[s.sellerAvatar, s.sellerAvatarEmpty]}><User size={20} color={colors.text2} /></View>}
                <View style={{ flex: 1 }}>
                  <Text style={s.sellerName} numberOfLines={1}>{item.seller.name}</Text>
                  <View style={s.ratingRow}>
                    {sellerRating?.count ? <Star size={13} color="#FFB800" fill="#FFB800" strokeWidth={1.5} /> : null}
                    <Text style={s.sellerSub}>{ratingText}</Text>
                  </View>
                </View>
                <ChevronRight size={18} color={colors.text2} />
              </TouchableOpacity>
            ) : null}
            {/* Запасные способы связи — если продавец их оставил */}
            {!isSold && (item.sellerTelegram || item.sellerPhone) ? (
              <View style={s.altRow}>
                <Text style={s.altLabel}>Или напрямую:</Text>
                {item.sellerTelegram ? (
                  <TouchableOpacity style={s.altContact} onPress={openSellerTelegram}>
                    <Send size={14} color={colors.blue} strokeWidth={2} />
                    <Text style={[s.altContactText, { color: colors.blue }]}>Telegram</Text>
                  </TouchableOpacity>
                ) : null}
                {item.sellerPhone ? (
                  <TouchableOpacity style={s.altContact} onPress={openSellerWhatsApp}>
                    <MessageCircle size={14} color="#25D366" strokeWidth={2} />
                    <Text style={s.altContactText}>WhatsApp</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
            {!isSold && item.sellerPhone ? <Text style={s.sellerPhone}>Телефон: {formatPhone(item.sellerPhone)}</Text> : null}
            {!isSold ? <Text style={s.sellerNote}>Сделку вы обсуждаете с продавцом напрямую — Markeltoys в ней не участвует.</Text> : null}
          </View>
        ) : null}
        {!hideBuyer && !isUserListing ? (
          <View style={[s.sellerCard, s.sellerRow]}>
            <Image source={require('../../assets/logo-mark.png')} style={s.sellerAvatar} resizeMode="contain" />
            <View style={{ flex: 1 }}>
              <Text style={s.sellerName}>Markeltoys</Text>
              <Text style={s.sellerSub}>Официальный магазин · отвечает в чате</Text>
            </View>
          </View>
        ) : null}

        {/* Управление: свой товар (вместо кнопок покупателя) или персонал.
            Сразу под названием и ценой, до характеристик: внизу карточки на
            телефоне панель уходила за край экрана и её не находили (20.10) */}
        {canManage ? (
          <View style={s.ownerCard}>
            <Text style={s.contactTitle}>{isOwner ? 'Это ваш товар' : 'Управление товаром'}</Text>
            <Text style={s.ownerHint}>
              {isSold
                ? 'Отмечен проданным — в магазине он в разделе «Продано».'
                : isOwner
                  ? 'Покупатели видят его в магазине и пишут вам напрямую.'
                  : isUserListing
                    ? 'Товар пользователя — как модератор вы можете изменить или удалить его.'
                    : 'Товар магазина Markeltoys — видите эту панель, потому что вы администратор.'}
            </Text>
            <View style={s.contactRow}>
              <TouchableOpacity style={s.ownerBtn} onPress={() => navigation.navigate('SellProduct', { product: item })} disabled={managing}>
                <IconLabel icon={Pencil} label="Редактировать" size={16} textStyle={s.ownerBtnText} />
              </TouchableOpacity>
              <TouchableOpacity style={[s.ownerBtn, !isSold && s.ownerBtnSold]} onPress={handleToggleSold} disabled={managing}>
                {managing
                  ? <ActivityIndicator color={colors.text} size="small" />
                  : <IconLabel
                      icon={isSold ? RotateCw : CircleCheck}
                      label={isSold ? 'Снова в продаже' : 'Продано'}
                      size={16}
                      textStyle={[s.ownerBtnText, !isSold && { color: colors.green }]}
                    />}
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={s.deleteBtn} onPress={handleDelete} disabled={managing}>
              <IconLabel icon={Trash2} label="Удалить товар" size={15} textStyle={s.deleteBtnText} />
            </TouchableOpacity>
            {manageError ? <Text style={s.manageError}>{manageError}</Text> : null}
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
          {!!item.manufacturer && (
            <View style={s.specRow}>
              <Text style={s.specLabel}>Производитель</Text>
              <Text style={s.specValue}>{item.manufacturer}</Text>
            </View>
          )}
          {!!item.franchise && (
            <View style={s.specRow}>
              <Text style={s.specLabel}>Франшиза</Text>
              <Text style={s.specValue}>{item.franchise}</Text>
            </View>
          )}
          {!!item.character && (
            <View style={s.specRow}>
              <Text style={s.specLabel}>Персонаж</Text>
              <Text style={s.specValue}>{item.character}</Text>
            </View>
          )}
          {item.isAuction ? (
            <View style={s.specRow}>
              <Text style={s.specLabel}>Начальная цена</Text>
              <Text style={[s.specValue, { color: '#FF6B00' }]}>{item.startPrice?.toLocaleString('ru')} ₽</Text>
            </View>
          ) : (
            <View style={s.specRow}>
              <Text style={s.specLabel}>Цена</Text>
              <Text style={[s.specValue, { color: colors.accent }]}>{item.price?.toLocaleString('ru')} ₽</Text>
            </View>
          )}
        </View>

        {/* Описание */}
        {item.description ? (
          <View style={s.descCard}>
            <Text style={s.descTitle}>Описание</Text>
            <Text style={s.descText}>{item.description}</Text>
          </View>
        ) : null}

        {/* Аукцион */}
        {item.isAuction && (
          <View style={s.auctionCard}>
            <View style={s.auctionHeader}>
              <IconLabel icon={Gavel} label="Аукцион" size={18} textStyle={s.auctionTitle} />
              {timeLeft ? (
                <View style={s.timer}>
                  <Text style={s.timerText}>
                    {timeLeft.days > 0 ? `${timeLeft.days}д ` : ''}{String(timeLeft.hours).padStart(2,'0')}:{String(timeLeft.mins).padStart(2,'0')}:{String(timeLeft.secs).padStart(2,'0')}
                  </Text>
                </View>
              ) : (
                <View style={[s.timer, { backgroundColor: '#8E8E9320' }]}>
                  <Text style={[s.timerText, { color: '#8E8E93' }]}>Завершён</Text>
                </View>
              )}
            </View>

            <View style={s.auctionStats}>
              <View style={s.auctionStat}>
                <Text style={s.auctionStatLabel}>Начальная цена</Text>
                <Text style={s.auctionStatValue}>{item.startPrice?.toLocaleString('ru')} ₽</Text>
              </View>
              <View style={s.auctionStat}>
                <Text style={s.auctionStatLabel}>Шаг ставки</Text>
                <Text style={s.auctionStatValue}>{item.priceStep?.toLocaleString('ru')} ₽</Text>
              </View>
              <View style={s.auctionStat}>
                <Text style={s.auctionStatLabel}>Лучшая ставка</Text>
                <Text style={[s.auctionStatValue, { color: '#FF6B00' }]}>
                  {auctionBids[0] ? `${auctionBids[0].amount?.toLocaleString('ru')} ₽` : 'Нет ставок'}
                </Text>
              </View>
            </View>

            {auctionBids.length > 0 && (
              <View style={s.bidsList}>
                <Text style={s.bidsTitle}>Ставки ({auctionBids.length})</Text>
                {auctionBids.slice(0, 5).map((bid, i) => (
                  <View key={bid.id || i} style={s.bidRow}>
                    <Text style={s.bidName}>{bid.userName || 'Участник'}</Text>
                    <IconLabel
                      icon={i === 0 ? Trophy : null}
                      label={`${bid.amount?.toLocaleString('ru')} ₽`}
                      size={14} gap={5}
                      textStyle={[s.bidAmount, i === 0 && { color: '#FF6B00', fontWeight: '800' }]}
                    />
                  </View>
                ))}
              </View>
            )}

            {timeLeft && (
              <View style={s.bidInput}>
                <TextInput
                  style={s.bidTextInput}
                  value={bidAmount}
                  onChangeText={setBidAmount}
                  placeholder={`Мин. ${(auctionBids[0]?.amount > 0 ? auctionBids[0].amount + (item.priceStep || 0) : (item.startPrice || 0)).toLocaleString('ru')} ₽`}
                  placeholderTextColor={colors.text2}
                  keyboardType="numeric"
                />
                <TouchableOpacity style={s.bidBtn} onPress={handlePlaceBid} disabled={placingBid}>
                  {placingBid
                    ? <ActivityIndicator color="white" size="small" />
                    : <Text style={s.bidBtnText}>Ставка</Text>
                  }
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Кнопки покупателя. Тому, кто управляет товаром (продавец, а у
            товаров магазина — персонал: продавец там он сам), не показываем:
            раньше админ на товаре магазина видел «Написать» самому себе.
            «Написать» / «Позвонить» — в закреплённой панели внизу экрана */}
        {!hideBuyer && !isSold && !item.isAuction ? (
          <View style={s.actions}>
            <TouchableOpacity
              style={[s.wishlistBtn, addedToWishlist && s.wishlistBtnAdded]}
              onPress={handleAddToWishlist}
              disabled={addingToWishlist || addedToWishlist}
            >
              {addingToWishlist
                ? <ActivityIndicator color={colors.accent} size="small" />
                : <IconLabel
                    icon={addedToWishlist ? Check : Target}
                    label={addedToWishlist ? 'В вишлисте' : 'В вишлист'}
                    textStyle={[s.wishlistBtnText, addedToWishlist && { color: colors.green }]}
                  />
              }
            </TouchableOpacity>
          </View>
        ) : null}
        {!hideBuyer && !item.isAuction ? (
          <TouchableOpacity
            style={[s.collectionBtn, addedToCollection && s.collectionBtnAdded]}
            onPress={handleAddToCollection}
            disabled={addingToCollection || addedToCollection}
          >
            {addingToCollection
              ? <ActivityIndicator color={colors.blue} size="small" />
              : <IconLabel
                  icon={addedToCollection ? Check : Boxes}
                  label={addedToCollection ? 'Добавлено в коллекцию' : 'В мою коллекцию'}
                  textStyle={[s.collectionBtnText, addedToCollection && { color: colors.green }]}
                />
            }
          </TouchableOpacity>
        ) : null}
        {isSold && !hideBuyer ? (
          <View style={s.soldBanner}>
            <IconLabel icon={CircleSlash} label="Товар уже продан" size={18} textStyle={s.soldBannerText} />
            <TouchableOpacity style={s.wishlistBtn} onPress={handleAddToWishlist} disabled={addingToWishlist || addedToWishlist}>
              <IconLabel icon={addedToWishlist ? Check : Target} label={addedToWishlist ? 'В вишлисте' : 'Слежу за похожим'} textStyle={s.wishlistBtnText} />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </ScrollView>
    {showBar ? (
      <View style={s.bottomBar}>
        <View style={s.bottomBarInner}>
        <Text style={s.barPrice} numberOfLines={1}>{item.price?.toLocaleString('ru')} ₽</Text>
        {isUserListing && item.sellerPhone ? (
          <TouchableOpacity style={s.barCall} onPress={callSeller} accessibilityLabel="Позвонить продавцу">
            <Phone size={20} color={colors.text} strokeWidth={2} />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={[s.barWrite, openingChat && { opacity: 0.7 }]} onPress={writeAction} disabled={openingChat}>
          {openingChat
            ? <ActivityIndicator color="#fff" size="small" />
            : <IconLabel
                icon={MessageCircle}
                label={isUserListing ? 'Написать' : 'Написать магазину'}
                size={18}
                textStyle={s.barWriteText}
              />}
        </TouchableOpacity>
        </View>
      </View>
    ) : null}
    </ScreenBackground>
  )
}

const s = StyleSheet.create({
  wrap: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  errorText: { color: colors.text2, fontSize: 16 },
  imageWrap: { height: 280, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', position: 'relative', overflow: 'hidden', borderBottomWidth: 1, borderBottomColor: colors.border },
  image: { width: '100%', height: '100%' },
  imageBackdrop: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%', opacity: 0.55 },
  imageDim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10,11,14,0.35)' },
  conditionBadge: { position: 'absolute', top: 16, right: 16, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, backgroundColor: 'rgba(10,11,14,0.8)' },
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
  manufacturer: { fontSize: 14, color: colors.text2, fontWeight: '500' },
  specsCard: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 16 },
  specsTitle: { fontSize: 11, fontWeight: '700', color: colors.text2, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 14 },
  specRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  specLabel: { fontSize: 14, color: colors.text2 },
  specValue: { fontSize: 14, color: colors.text, fontWeight: '600' },
  descCard: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 16 },
  descTitle: { fontSize: 11, fontWeight: '700', color: colors.text2, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 },
  descText: { fontSize: 15, color: colors.text, lineHeight: 22 },
  contactTitle: { fontSize: 11, fontWeight: '700', color: colors.text2, textTransform: 'uppercase', letterSpacing: 1.5 },
  contactRow: { flexDirection: 'row', gap: 10 },
  sellerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sellerCard: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 16, gap: 10 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  altRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 14 },
  altLabel: { fontSize: 13, color: colors.text2 },
  altContact: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  altContactText: { fontSize: 13, fontWeight: '600', color: '#25D366' },
  // На широком экране ПК карточка не растягивается на всё окно (20.10.2026):
  // контент и панель внизу — по центру, не шире MAX_CONTENT. На телефоне
  // ширина экрана меньше — ничего не меняется
  scrollContent: { width: '100%', maxWidth: MAX_CONTENT, alignSelf: 'center' },
  scrollWithBar: { paddingBottom: 88 },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  bottomBarInner: { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%', maxWidth: MAX_CONTENT - 32, alignSelf: 'center' },
  barPrice: { flexShrink: 1, fontSize: 18, fontWeight: '900', color: colors.accent, marginRight: 'auto' },
  barCall: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border },
  barWrite: { height: 48, paddingHorizontal: 20, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  barWriteText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  sellerAvatar: { width: 44, height: 44, borderRadius: 22 },
  sellerAvatarEmpty: { backgroundColor: colors.surface2, justifyContent: 'center', alignItems: 'center' },
  sellerName: { fontSize: 16, fontWeight: '700', color: colors.text },
  sellerSub: { fontSize: 12, color: colors.text2, marginTop: 2 },
  sellerPhone: { fontSize: 13, color: colors.text2 },
  sellerNote: { fontSize: 12, color: colors.text2, lineHeight: 17 },
  ownerCard: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: `${colors.accent}50`, padding: 16, marginBottom: 16, gap: 10 },
  ownerHint: { fontSize: 13, color: colors.text2, lineHeight: 18 },
  ownerBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface2, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingVertical: 13, minHeight: 48 },
  ownerBtnSold: { borderColor: `${colors.green}60` },
  ownerBtnText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  deleteBtn: { alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 12 },
  deleteBtnText: { color: colors.red, fontSize: 14, fontWeight: '600' },
  manageError: { fontSize: 13, color: colors.red, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  wishlistBtn: { flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  wishlistBtnAdded: { borderColor: colors.green },
  wishlistBtnText: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  collectionBtn: { marginHorizontal: 0, marginTop: 10, backgroundColor: colors.surface, borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: `${colors.blue}40` },
  collectionBtnAdded: { borderColor: colors.green },
  collectionBtnText: { color: colors.blue, fontSize: 15, fontWeight: '600' },
  soldBanner: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, alignItems: 'center', gap: 12 },
  soldBannerText: { fontSize: 16, color: colors.text2, fontWeight: '600' },
  auctionCard: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1.5, borderColor: '#FF6B0040', padding: 16, marginBottom: 16, gap: 14 },
  auctionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  auctionTitle: { fontSize: 17, fontWeight: '800', color: '#FF6B00' },
  timer: { backgroundColor: '#FF6B0015', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  timerText: { fontSize: 14, fontWeight: '800', color: '#FF6B00', fontVariant: ['tabular-nums'] },
  auctionStats: { flexDirection: 'row', gap: 8 },
  auctionStat: { flex: 1, backgroundColor: colors.surface2, borderRadius: 10, padding: 10, alignItems: 'center' },
  auctionStatLabel: { fontSize: 10, color: colors.text2, fontWeight: '600', marginBottom: 4, textAlign: 'center' },
  auctionStatValue: { fontSize: 13, fontWeight: '800', color: colors.text },
  bidsList: { gap: 6 },
  bidsTitle: { fontSize: 11, fontWeight: '700', color: colors.text2, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  bidRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  bidName: { fontSize: 14, color: colors.text },
  bidAmount: { fontSize: 14, color: colors.text, fontWeight: '600' },
  bidInput: { flexDirection: 'row', gap: 10 },
  bidTextInput: { flex: 1, backgroundColor: colors.surface2, borderWidth: 1, borderColor: '#FF6B0040', borderRadius: 10, padding: 12, color: colors.text, fontSize: 15 },
  bidBtn: { backgroundColor: '#FF6B00', borderRadius: 10, paddingHorizontal: 20, justifyContent: 'center' },
  bidBtnText: { color: 'white', fontWeight: '800', fontSize: 15 },
})