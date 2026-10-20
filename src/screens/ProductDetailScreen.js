import React, { useState, useEffect, useRef } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Image, Platform, Linking, Alert, TextInput } from 'react-native'
import { products, wishlist, bids, collection } from '../api'
import { useAuth } from '../AuthContext'
import { colors } from '../theme'
import { pickAndUploadPhoto } from '../utils/uploadPhoto'
import { track } from '../utils/analytics'
import ScreenBackground from '../components/ScreenBackground'
import IconLabel from '../components/IconLabel'
import { Package, Gavel, Camera, Factory, Trophy, MessageCircle, Send, Target, Boxes, Check, CircleSlash, Phone, Pencil, CircleCheck, RotateCw, Trash2, User, ChevronRight } from '../icons'
import { API_URL } from '../config'

const CLOUD_NAME = 'dqutmb1rm'
const UPLOAD_PRESET = 'collectors_realm'

const SELLER = {
  telegram: 'collector_realm_shop',
  whatsapp: '79001234567',
  max: 'collector_realm_shop',
  name: "Markeltoys"
}

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
  const timerRef = useRef(null)

  useEffect(() => { load() }, [id])

  // Возврат на карточку (после «Редактировать») — перечитываем товар без
  // спиннера. Пока не закончилась первая загрузка — пропускаем (там уже идёт load())
  const loadedOnceRef = useRef(false)
  useEffect(() => navigation.addListener('focus', () => {
    if (loadedOnceRef.current) load()
  }), [navigation, id])

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

  async function openTelegram() {
    track('contact_seller', { method: 'telegram', productId: item.id })
    const msg = encodeURIComponent(`Здравствуйте! Меня интересует товар "${item.name}" за ${item.price?.toLocaleString('ru')} ₽`)
    const url = `https://t.me/${SELLER.telegram}?text=${msg}`
    try { await Linking.openURL(url) } catch { Linking.openURL(`https://t.me/${SELLER.telegram}`) }
  }

  async function openWhatsApp() {
    track('contact_seller', { method: 'whatsapp', productId: item.id })
    const msg = encodeURIComponent(`Здравствуйте! Меня интересует товар "${item.name}" за ${item.price?.toLocaleString('ru')} ₽`)
    const url = `https://wa.me/${SELLER.whatsapp}?text=${msg}`
    try { await Linking.openURL(url) } catch { Linking.openURL(`https://wa.me/${SELLER.whatsapp}`) }
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
        navigation.goBack()
      } catch (e) {
        setManageError(e.response?.data?.error || 'Не удалось удалить — попробуйте ещё раз')
        setManaging(false)
      }
    })
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
  // Товар пользователя (не магазина): свой блок продавца и прямые контакты
  // вместо контактов Markeltoys и чата с администрацией
  const isUserListing = !!item.sellerId
  const isOwner = isUserListing && item.sellerId === user?.id

  return (
    <ScreenBackground>
    <ScrollView style={s.wrap} showsVerticalScrollIndicator={false}>
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

        {/* Свой товар — управление вместо кнопок покупателя */}
        {isOwner ? (
          <View style={s.ownerCard}>
            <Text style={s.contactTitle}>Это ваш товар</Text>
            <Text style={s.ownerHint}>
              {isSold
                ? 'Отмечен проданным — в магазине он в разделе «Продано».'
                : 'Покупатели видят его в магазине и пишут вам напрямую.'}
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

        {/* Продавец-пользователь: кто он и как с ним связаться */}
        {isUserListing && !isOwner ? (
          <View style={s.contactCard}>
            <Text style={s.contactTitle}>Продавец</Text>
            {item.seller ? (
              <TouchableOpacity style={s.sellerRow} onPress={() => navigation.navigate('UserProfile', { userId: item.seller.id })} activeOpacity={0.7}>
                {item.seller.avatarUrl
                  ? <Image source={{ uri: item.seller.avatarUrl }} style={s.sellerAvatar} />
                  : <View style={[s.sellerAvatar, s.sellerAvatarEmpty]}><User size={20} color={colors.text2} /></View>}
                <View style={{ flex: 1 }}>
                  <Text style={s.sellerName} numberOfLines={1}>{item.seller.name}</Text>
                  <Text style={s.sellerSub}>Открыть профиль</Text>
                </View>
                <ChevronRight size={18} color={colors.text2} />
              </TouchableOpacity>
            ) : null}
            {!isSold && item.sellerTelegram ? (
              <TouchableOpacity style={s.telegramBtn} onPress={openSellerTelegram}>
                <Send size={18} color="white" strokeWidth={2} />
                <Text style={s.telegramBtnText} numberOfLines={1}>Telegram · @{item.sellerTelegram}</Text>
              </TouchableOpacity>
            ) : null}
            {!isSold && item.sellerPhone ? (
              <View style={s.contactRow}>
                <TouchableOpacity style={s.whatsappBtn} onPress={openSellerWhatsApp}>
                  <MessageCircle size={18} color="white" strokeWidth={2} />
                  <Text style={s.whatsappBtnText}>WhatsApp</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.callBtn} onPress={callSeller}>
                  <Phone size={18} color={colors.text} strokeWidth={2} />
                  <Text style={s.callBtnText}>Позвонить</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            {!isSold && item.sellerPhone ? <Text style={s.sellerPhone}>{formatPhone(item.sellerPhone)}</Text> : null}
            {!isSold ? <Text style={s.sellerNote}>Сделку вы обсуждаете с продавцом напрямую — Markeltoys в ней не участвует.</Text> : null}
          </View>
        ) : null}

        {/* Контакты магазина Markeltoys */}
        {!isUserListing && !isSold && !item.isAuction ? (
          <View style={s.contactCard}>
            <Text style={s.contactTitle}>Связаться с продавцом</Text>
            <View style={s.contactRow}>
              <TouchableOpacity style={s.whatsappBtn} onPress={openWhatsApp}>
                <MessageCircle size={18} color="white" strokeWidth={2} />
                <Text style={s.whatsappBtnText}>WhatsApp</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={s.maxBtn} onPress={openMax}>
              <Send size={18} color="white" strokeWidth={2} />
              <Text style={s.maxBtnText}>Написать в Max</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Кнопки (чат с администрацией — только у товаров магазина) */}
        {!isOwner && !isSold && !item.isAuction ? (
          <View style={s.actions}>
            {!isUserListing ? (
              <TouchableOpacity style={s.buyBtn} onPress={() => navigation.navigate('Chat', { productName: item.name, productId: item.id })}>
                <IconLabel icon={MessageCircle} label="Написать в чате" size={18} textStyle={s.buyBtnText} />
              </TouchableOpacity>
            ) : null}
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
        {!isOwner && !item.isAuction ? (
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
        {isSold && !isOwner ? (
          <View style={s.soldBanner}>
            <IconLabel icon={CircleSlash} label="Товар уже продан" size={18} textStyle={s.soldBannerText} />
            <TouchableOpacity style={s.wishlistBtn} onPress={handleAddToWishlist} disabled={addingToWishlist || addedToWishlist}>
              <IconLabel icon={addedToWishlist ? Check : Target} label={addedToWishlist ? 'В вишлисте' : 'Слежу за похожим'} textStyle={s.wishlistBtnText} />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </ScrollView>
    </ScreenBackground>
  )
}

const s = StyleSheet.create({
  wrap: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
  contactCard: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 16, gap: 10 },
  contactTitle: { fontSize: 11, fontWeight: '700', color: colors.text2, textTransform: 'uppercase', letterSpacing: 1.5 },
  contactRow: { flexDirection: 'row', gap: 10 },
  telegramBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#229ED9', borderRadius: 12, padding: 14 },
  telegramBtnText: { color: 'white', fontWeight: '700', fontSize: 15 },
  whatsappBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#25D366', borderRadius: 12, padding: 14 },
  whatsappBtnText: { color: 'white', fontWeight: '700', fontSize: 15 },
  callBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.surface2, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border },
  callBtnText: { color: colors.text, fontWeight: '700', fontSize: 15 },
  sellerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  sellerAvatar: { width: 44, height: 44, borderRadius: 22 },
  sellerAvatarEmpty: { backgroundColor: colors.surface2, justifyContent: 'center', alignItems: 'center' },
  sellerName: { fontSize: 16, fontWeight: '700', color: colors.text },
  sellerSub: { fontSize: 12, color: colors.text2, marginTop: 2 },
  sellerPhone: { fontSize: 13, color: colors.text2, textAlign: 'center' },
  sellerNote: { fontSize: 12, color: colors.text2, lineHeight: 17 },
  ownerCard: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: `${colors.accent}50`, padding: 16, marginBottom: 16, gap: 10 },
  ownerHint: { fontSize: 13, color: colors.text2, lineHeight: 18 },
  ownerBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface2, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingVertical: 13, minHeight: 48 },
  ownerBtnSold: { borderColor: `${colors.green}60` },
  ownerBtnText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  deleteBtn: { alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 12 },
  deleteBtnText: { color: colors.red, fontSize: 14, fontWeight: '600' },
  manageError: { fontSize: 13, color: colors.red, textAlign: 'center' },
  maxBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#0077FF', borderRadius: 12, padding: 14 },
  maxBtnText: { color: 'white', fontWeight: '700', fontSize: 15 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  buyBtn: { flex: 1, backgroundColor: colors.accent, borderRadius: 14, padding: 16, alignItems: 'center' },
  buyBtnText: { color: 'white', fontSize: 16, fontWeight: '700' },
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