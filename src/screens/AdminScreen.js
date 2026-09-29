import React, { useState, useEffect } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Modal, Image, Platform, KeyboardAvoidingView
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../AuthContext'
import { colors } from '../theme'
import { notifications as notifApi, releases as releasesApi, support as supportApi, users, game, products as productsApi } from '../api'
import { pickAndUploadPhoto } from '../utils/uploadPhoto'
import SmartInput from '../utils/SmartInput'
import ScreenBackground from '../components/ScreenBackground'
import BrandHeader from '../components/BrandHeader'
import { CardArt, RARITY } from '../utils/cardArt'

const CLOUD_NAME = 'dqutmb1rm'
const UPLOAD_PRESET = 'collectors_realm'
const API = 'https://collectors-realm-backend.onrender.com/api'

const EMPTY = { name: '', description: '', price: '', condition: 'NEW', manufacturer: '', franchise: '', character: '', yearMade: '', isAuction: false, startPrice: '', priceStep: '', auctionDays: '1' }

const BADGE_OPTIONS = [
  { value: null,      label: 'Нет',     icon: '—',  color: '#8E8E93' },
  { value: 'SHOP',    label: 'Магазин', icon: '🏪', color: '#FF9700' },
  { value: 'BLOGGER', label: 'Блогер',  icon: '✅', color: '#007AFF' },
]

const STATUS_LABELS = {
  AVAILABLE: { label: 'Доступен', color: '#34C759' },
  SOLD: { label: 'Продан', color: '#8E8E93' },
  PREORDER: { label: 'Предзаказ', color: '#007AFF' },
  RESERVED: { label: 'Резерв', color: '#FF9500' },
  NEGOTIABLE: { label: 'Торг уместен', color: '#AF52DE' },
}

// Русские названия для вкладки «Статистика» (ключи — как их пишет
// src/utils/analytics.js / App.js; Collection/Wishlist — из старых данных)
const SCREEN_LABELS = {
  Login: 'Экран входа / регистрации',
  Shop: 'Магазин',
  ProductDetail: 'Карточка товара',
  Chat: 'Чат с продавцом',
  Notifications: 'Уведомления',
  UserProfile: 'Чужой профиль',
  Releases: 'Анонсы релизов',
  Library: 'Библиотека знаний',
  Map: 'Карта',
  MyItems: 'Моё (коллекция / вишлист)',
  Collection: 'Коллекция',
  Wishlist: 'Вишлист',
  Game: 'Игра',
  Profile: 'Мой профиль',
  Admin: 'Админка',
}

const EVENT_LABELS = {
  login: 'Вход в аккаунт',
  register: 'Регистрация',
  add_to_wishlist: 'Добавили товар в вишлист',
  add_to_collection: 'Добавили товар в коллекцию',
  contact_seller: 'Нажали «Написать продавцу» (Telegram / WhatsApp)',
  bid_placed: 'Ставка на аукционе',
}

const CONTENT_LABELS = [
  ['productsOnSale', 'Товаров в магазине (не проданных)'],
  ['collectionItems', 'Фигурок в коллекциях пользователей'],
  ['wishlistItems', 'Позиций в вишлистах'],
  ['sellerMessages', 'Сообщений продавцу в чате'],
  ['supportMessages', 'Сообщений в поддержку'],
  ['bids', 'Ставок на аукционах'],
  ['reviews', 'Отзывов'],
]

export default function AdminScreen() {
  const insets = useSafeAreaInsets()
  const { user, token } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [photos, setPhotos] = useState([])
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  const isAdmin = user?.roles?.includes('ADMIN')
  const isModerator = user?.roles?.includes('MODERATOR') && !isAdmin
  const isAnalytics = user?.roles?.includes('ANALYTICS') && !isAdmin && !isModerator
  const isStaff = isAdmin || isModerator

  const [tab, setTab] = useState('products')
  const [allUsers, setAllUsers] = useState([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [sendingReport, setSendingReport] = useState(false)
  const [analyticsSummary, setAnalyticsSummary] = useState(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [releasesList, setReleasesList] = useState([])
  const [releasesLoading, setReleasesLoading] = useState(false)
  const [releaseModal, setReleaseModal] = useState(false)
  const [releaseForm, setReleaseForm] = useState({ name: '', manufacturer: '', releaseDate: '', description: '', imageUrl: '' })
  const [editRelease, setEditRelease] = useState(null)
  const [savingRelease, setSavingRelease] = useState(false)

  // Поддержка
  const [conversations, setConversations] = useState([])
  const [convLoading, setConvLoading] = useState(false)
  const [activeConv, setActiveConv] = useState(null)
  const [convMessages, setConvMessages] = useState([])
  const [convMsgLoading, setConvMsgLoading] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [replySending, setReplySending] = useState(false)

  // Вкладка «Игра» — обзор карт (арт+характеристики) и базовая статистика по боям
  const [gameCards, setGameCards] = useState([])
  const [gameCardsLoading, setGameCardsLoading] = useState(false)
  const [gameStats, setGameStats] = useState(null)
  const [gameStatsLoading, setGameStatsLoading] = useState(false)

  useEffect(() => {
    if (isAnalytics) { setTab('analytics'); return }
    load()
  }, [])

  useEffect(() => {
    if (tab === 'users') loadUsers()
    if (tab === 'releases') loadReleases()
    if (tab === 'analytics') loadAnalytics()
    if (tab === 'support') loadConversations()
    if (tab === 'game') { loadGameCards(); loadGameStats() }
  }, [tab])

  async function loadGameCards() {
    setGameCardsLoading(true)
    try {
      const res = await game.getAllCards()
      setGameCards(Array.isArray(res.data) ? res.data : [])
    } catch (e) {}
    setGameCardsLoading(false)
  }

  async function loadGameStats() {
    setGameStatsLoading(true)
    try {
      const res = await game.getGameStats()
      setGameStats(res.data)
    } catch (e) {}
    setGameStatsLoading(false)
  }

  async function loadConversations() {
    setConvLoading(true)
    try {
      const res = await supportApi.getConversations()
      setConversations(Array.isArray(res.data) ? res.data : [])
    } catch (e) {}
    setConvLoading(false)
  }

  async function openConversation(conv) {
    setActiveConv(conv)
    setConvMsgLoading(true)
    try {
      const res = await supportApi.getUserMessages(conv.user.id)
      setConvMessages(Array.isArray(res.data) ? res.data : [])
      setConversations(prev => prev.map(c => c.user.id === conv.user.id ? { ...c, unread: 0 } : c))
    } catch (e) {}
    setConvMsgLoading(false)
  }

  async function sendReply() {
    if (!replyText.trim() || replySending || !activeConv) return
    setReplySending(true)
    try {
      const res = await supportApi.reply(activeConv.user.id, replyText.trim())
      setConvMessages(prev => [...prev, res.data])
      setReplyText('')
    } catch (e) { Alert.alert('Ошибка', 'Не удалось отправить') }
    setReplySending(false)
  }

  function handleDeleteMessage(msg) {
    Alert.alert('Удалить сообщение?', 'Нельзя отменить', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: async () => {
        try {
          await supportApi.deleteMessage(msg.id)
          setConvMessages(prev => prev.filter(m => m.id !== msg.id))
        } catch (e) { Alert.alert('Ошибка', 'Не удалось удалить') }
      } },
    ])
  }

  async function loadAnalytics() {
    setAnalyticsLoading(true)
    try {
      const res = await fetch(`${API}/analytics/summary`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Ошибка загрузки')
      setAnalyticsSummary(await res.json())
    } catch (e) {
      Alert.alert('Ошибка', 'Не удалось загрузить статистику')
    }
    setAnalyticsLoading(false)
  }

  async function loadReleases() {
    setReleasesLoading(true)
    try {
      const res = await releasesApi.getAll()
      setReleasesList(Array.isArray(res.data) ? res.data : [])
    } catch (e) {}
    setReleasesLoading(false)
  }

  function openAddRelease() {
    setEditRelease(null)
    setReleaseForm({ name: '', manufacturer: '', releaseDate: '', description: '', imageUrl: '' })
    setReleaseModal(true)
  }

  function openEditRelease(r) {
    setEditRelease(r)
    setReleaseForm({
      name: r.name || '',
      manufacturer: r.manufacturer || '',
      releaseDate: r.releaseDate ? r.releaseDate.slice(0, 10) : '',
      description: r.description || '',
      imageUrl: r.imageUrl || '',
    })
    setReleaseModal(true)
  }

  async function handleSaveRelease() {
    if (!releaseForm.name.trim() || !releaseForm.releaseDate) { Alert.alert('Заполните название и дату'); return }
    setSavingRelease(true)
    try {
      const data = {
        name: releaseForm.name.trim(),
        manufacturer: releaseForm.manufacturer.trim() || undefined,
        releaseDate: new Date(releaseForm.releaseDate).toISOString(),
        description: releaseForm.description.trim() || undefined,
        imageUrl: releaseForm.imageUrl.trim() || undefined,
      }
      if (editRelease) await releasesApi.update(editRelease.id, data)
      else await releasesApi.create(data)
      setReleaseModal(false)
      loadReleases()
    } catch (e) { Alert.alert('Ошибка', e.response?.data?.error || 'Не удалось сохранить') }
    setSavingRelease(false)
  }

  async function handleDeleteRelease(id) {
    Alert.alert('Удалить?', 'Нельзя отменить', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: async () => {
        await releasesApi.remove(id).catch(() => {})
        loadReleases()
      }},
    ])
  }

  async function loadUsers() {
    setUsersLoading(true)
    try {
      // users.getAll() (axios, api.js) вместо сырого fetch — иначе запрос
      // не проходит через перехватчик, который разлогинивает при
      // просроченном токене (без него истёкший токен молча давал пустой
      // экран вместо возврата на логин, найдено 19.09.2026)
      const res = await users.getAll()
      setAllUsers(Array.isArray(res.data) ? res.data : [])
    } catch (e) {}
    setUsersLoading(false)
  }

  async function handleTriggerReport(type) {
    setSendingReport(true)
    try {
      await notifApi.triggerReport(type)
      Alert.alert('✅ Запущено', `Генерация ${type === 'MONTHLY' ? 'месячных' : 'годовых'} отчётов запущена. Пользователи получат уведомления через ~1 мин.`)
    } catch (e) {
      Alert.alert('Ошибка', e.response?.data?.error || 'Не удалось запустить')
    }
    setSendingReport(false)
  }

  async function handleToggleBlock(u) {
    const isBlocked = u.isBlocked
    const action = isBlocked ? 'Разблокировать' : 'Заблокировать'
    Alert.alert(
      `${action} пользователя?`,
      isBlocked
        ? `${u.name} снова сможет войти в приложение.`
        : `${u.name} получит сообщение о блокировке при попытке входа.`,
      [
        { text: 'Отмена', style: 'cancel' },
        { text: action, style: isBlocked ? 'default' : 'destructive', onPress: async () => {
          try {
            if (isBlocked) await users.unblock(u.id)
            else await users.block(u.id)
            setAllUsers(prev => prev.map(p => p.id === u.id ? { ...p, isBlocked: !isBlocked } : p))
          } catch (e) { Alert.alert('Ошибка', 'Не удалось изменить статус') }
        }}
      ]
    )
  }

  // Без подтверждения (Alert.alert с кнопками на вебе не показывается) —
  // действие безобидное и отменяется повторным нажатием
  async function handleToggleStatsExclude(u) {
    const exclude = !u.excludeFromStats
    try {
      await users.setStatsExcluded(u.id, exclude)
      setAllUsers(prev => prev.map(p => p.id === u.id ? { ...p, excludeFromStats: exclude } : p))
    } catch (e) { Alert.alert('Ошибка', 'Не удалось изменить') }
  }

  async function handleSetBadge(userId, badge) {
    try {
      await users.setBadge(userId, badge)
      loadUsers()
    } catch (e) { Alert.alert('Ошибка', 'Не удалось изменить бейдж') }
  }

  async function load() {
    setLoading(true)
    try {
      const res = await productsApi.getAll()
      const data = res.data
      setItems(Array.isArray(data) ? data : (data.products || []))
    } catch (e) {
      // Раньше ошибка (403/500/цепочка Render cold-start) молча превращалась
      // в "Товаров нет" — неотличимо от реально пустого каталога, админ мог
      // подумать, что каталог стёрся (найдено 19.09.2026)
      Alert.alert('Ошибка', 'Не удалось загрузить товары')
    }
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
      character: item.character || '',
      yearMade: String(item.yearMade || ''),
      isAuction: item.isAuction || false,
      startPrice: String(item.startPrice || ''),
      priceStep: String(item.priceStep || ''),
      // null (не '1'!) — значит «срок не трогали», сохраняем текущий
      // auctionEndTime как есть. Раньше здесь стояло '1', из-за чего кнопка
      // «1 день» ложно подсвечивалась активной у любого аукциона независимо
      // от реального остатка, а нажатие именно на неё ничего не сохраняло —
      // код не мог отличить «админ явно выбрал 1 день» от «не трогал вообще»
      // (найдено 19.09.2026)
      auctionDays: null,
    })
    setPhotos(item.images?.map(i => i.url) || [])
    setModal(true)
  }

  async function pickPhoto() {
    if (photos.length >= 5) { Alert.alert('Максимум 5 фото'); return }
    setUploadingPhoto(true)
    const url = await pickAndUploadPhoto()
    if (url) setPhotos(p => [...p, url])
    setUploadingPhoto(false)
  }

  async function handleSave() {
    if (!form.name.trim()) { Alert.alert('Введите название'); return }
    if (!form.isAuction && (!form.price || isNaN(Number(form.price)))) { Alert.alert('Введите цену'); return }
    if (form.isAuction && (!form.startPrice || isNaN(Number(form.startPrice)))) { Alert.alert('Введите начальную цену аукциона'); return }
    setSaving(true)
    try {
      const body = {
        name: form.name.trim(),
        description: form.description.trim(),
        price: form.isAuction ? (Number(form.startPrice) || 0) : Number(form.price),
        condition: form.condition,
        manufacturer: form.manufacturer.trim(),
        franchise: form.franchise.trim(),
        character: form.character.trim(),
        yearMade: form.yearMade.trim() && !isNaN(parseInt(form.yearMade)) ? parseInt(form.yearMade) : undefined,
        imageUrls: photos,
        isAuction: form.isAuction,
        startPrice: form.isAuction ? Number(form.startPrice) || 0 : null,
        priceStep: form.isAuction ? Number(form.priceStep) || 0 : null,
        auctionEndTime: form.isAuction ? (
          editItem?.auctionEndTime && !form.auctionDays
            ? editItem.auctionEndTime
            : (() => {
                const d = new Date()
                d.setDate(d.getDate() + parseInt(form.auctionDays || '1'))
                return d.toISOString()
              })()
        ) : null,
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
          try {
            const res = await fetch(`${API}/products/${id}/status`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ status: o.status })
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
              Alert.alert('Ошибка', data.error || `Код ${res.status}`)
              return
            }
            load()
          } catch (e) {
            Alert.alert('Ошибка сети', e.message)
          }
        }
      })),
      { text: 'Отмена', style: 'cancel' }
    ])
  }

  async function handleDelete(id) {
    Alert.alert('Удалить?', 'Нельзя отменить', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: async () => {
        try {
          const res = await fetch(`${API}/products/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
          const data = await res.json().catch(() => ({}))
          if (!res.ok) {
            Alert.alert('Ошибка', data.error || `Код ${res.status}`)
            return
          }
          load()
        } catch (e) {
          Alert.alert('Ошибка сети', e.message)
        }
      }}
    ])
  }

  if (!isAdmin && !isModerator && !isAnalytics) return (
    <View style={[s.center, { paddingTop: insets.top }]}>
      <Text style={{ fontSize: 48, marginBottom: 16 }}>🔒</Text>
      <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 8 }}>Нет доступа</Text>
      <Text style={{ fontSize: 14, color: colors.text2 }}>Только для администраторов</Text>
    </View>
  )

  return (
    <ScreenBackground style={s.wrap}>
      <BrandHeader insets={insets} />
      {/* Переключатель вкладок */}
      <View style={s.tabs}>
        {isStaff && (
          <TouchableOpacity style={[s.tabBtn, tab === 'products' && s.tabBtnActive]} onPress={() => setTab('products')}>
            <Text style={[s.tabText, tab === 'products' && s.tabTextActive]}>📦 Товары</Text>
          </TouchableOpacity>
        )}
        {isAdmin && (
          <TouchableOpacity style={[s.tabBtn, tab === 'releases' && s.tabBtnActive]} onPress={() => setTab('releases')}>
            <Text style={[s.tabText, tab === 'releases' && s.tabTextActive]}>📅 Релизы</Text>
          </TouchableOpacity>
        )}
        {isStaff && (
          <TouchableOpacity style={[s.tabBtn, tab === 'users' && s.tabBtnActive]} onPress={() => setTab('users')}>
            <Text style={[s.tabText, tab === 'users' && s.tabTextActive]}>👥 Люди</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[s.tabBtn, tab === 'analytics' && s.tabBtnActive]} onPress={() => setTab('analytics')}>
          <Text style={[s.tabText, tab === 'analytics' && s.tabTextActive]}>📊 Статистика</Text>
        </TouchableOpacity>
        {isStaff && (
          <TouchableOpacity style={[s.tabBtn, tab === 'support' && s.tabBtnActive]} onPress={() => setTab('support')}>
            <View style={{ position: 'relative' }}>
              <Text style={[s.tabText, tab === 'support' && s.tabTextActive]}>💬 Чат</Text>
              {conversations.some(c => c.unread > 0) && (
                <View style={{ position: 'absolute', top: -4, right: -8, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent }} />
              )}
            </View>
          </TouchableOpacity>
        )}
        {isStaff && (
          <TouchableOpacity style={[s.tabBtn, tab === 'game' && s.tabBtnActive]} onPress={() => setTab('game')}>
            <Text style={[s.tabText, tab === 'game' && s.tabTextActive]}>🎮 Игра</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Вкладка релизов */}
      {tab === 'releases' && (
        releasesLoading ? <View style={s.center}><ActivityIndicator color={colors.accent} size="large" /></View> : (
          <>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', padding: 12 }}>
            <TouchableOpacity style={s.addBtn} onPress={openAddRelease}>
              <Text style={s.addBtnText}>+ Добавить</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
            {releasesList.length === 0 && <Text style={{ color: colors.text2, textAlign: 'center', paddingTop: 40 }}>Релизов нет — добавьте первый!</Text>}
            {releasesList.map(r => (
              <View key={r.id} style={s.card}>
                {r.imageUrl ? <Image source={{ uri: r.imageUrl }} style={s.thumb} /> : <View style={[s.thumb, { backgroundColor: colors.surface2, justifyContent: 'center', alignItems: 'center' }]}><Text style={{ fontSize: 28 }}>📅</Text></View>}
                <View style={{ flex: 1, padding: 12 }}>
                  <Text style={s.cardName} numberOfLines={1}>{r.name}</Text>
                  <Text style={{ fontSize: 12, color: colors.text2 }}>{new Date(r.releaseDate).toLocaleDateString('ru')}</Text>
                  {r.manufacturer ? <Text style={{ fontSize: 11, color: colors.text2 }}>{r.manufacturer}</Text> : null}
                </View>
                <View style={{ flexDirection: 'column', gap: 6, padding: 8 }}>
                  <TouchableOpacity onPress={() => openEditRelease(r)} style={s.iconBtn}><Text>✏️</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeleteRelease(r.id)} style={[s.iconBtn, { backgroundColor: 'rgba(255,59,48,0.15)' }]}><Text>🗑</Text></TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>
          </>
        )
      )}

      {/* Вкладка пользователей */}
      {tab === 'users' ? (
        usersLoading ? (
          <View style={s.center}><ActivityIndicator color={colors.accent} size="large" /></View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
            {/* Отчёты */}
            <View style={s.reportCard}>
              <Text style={s.reportTitle}>📊 Отчёты для пользователей</Text>
              <Text style={s.reportSub}>Claude API сгенерирует персональное сообщение для каждого</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                <TouchableOpacity
                  style={[s.reportBtn, { backgroundColor: `${colors.blue}20`, borderColor: `${colors.blue}50` }]}
                  onPress={() => handleTriggerReport('MONTHLY')}
                  disabled={sendingReport}
                >
                  {sendingReport ? <ActivityIndicator color={colors.blue} size="small" /> : <Text style={[s.reportBtnText, { color: colors.blue }]}>📅 Месячный</Text>}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.reportBtn, { backgroundColor: `${colors.purple}20`, borderColor: `${colors.purple}50` }]}
                  onPress={() => handleTriggerReport('YEARLY')}
                  disabled={sendingReport}
                >
                  {sendingReport ? <ActivityIndicator color={colors.purple} size="small" /> : <Text style={[s.reportBtnText, { color: colors.purple }]}>🏆 Годовой</Text>}
                </TouchableOpacity>
              </View>
            </View>

            {allUsers.map(u => (
              <View key={u.id} style={[s.userCard, u.isBlocked && { opacity: 0.6, borderColor: 'rgba(255,59,48,0.3)' }]}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={s.cardName}>{u.name}</Text>
                    {u.isBlocked && <Text style={{ fontSize: 10, color: '#FF3B30', fontWeight: '700' }}>БЛОК</Text>}
                  </View>
                  <Text style={{ fontSize: 12, color: colors.text2 }}>{u.email}</Text>
                  {u.badge && <Text style={{ fontSize: 11, color: '#FF9700', marginTop: 2 }}>
                    {u.badge === 'SHOP' ? '🏪 Магазин' : '✅ Блогер'}
                  </Text>}
                  {u.excludeFromStats && <Text style={{ fontSize: 11, color: colors.text2, marginTop: 2 }}>👻 Не учитывается в статистике</Text>}
                </View>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity
                    onPress={() => handleToggleStatsExclude(u)}
                    style={[s.badgeBtn, u.excludeFromStats && { borderColor: colors.text2, backgroundColor: `${colors.text2}30` }]}
                  >
                    <Text style={{ fontSize: 14, opacity: u.excludeFromStats ? 1 : 0.5 }}>👻</Text>
                  </TouchableOpacity>
                  {BADGE_OPTIONS.map(opt => (
                    <TouchableOpacity
                      key={String(opt.value)}
                      onPress={() => handleSetBadge(u.id, opt.value)}
                      style={[s.badgeBtn, u.badge === opt.value && { borderColor: opt.color, backgroundColor: `${opt.color}20` }]}
                    >
                      <Text style={{ fontSize: 14 }}>{opt.icon}</Text>
                    </TouchableOpacity>
                  ))}
                  {!u.roles?.includes('ADMIN') && (
                    <TouchableOpacity
                      onPress={() => handleToggleBlock(u)}
                      style={[s.badgeBtn, u.isBlocked && { borderColor: '#FF3B30', backgroundColor: 'rgba(255,59,48,0.15)' }]}
                    >
                      <Text style={{ fontSize: 14 }}>{u.isBlocked ? '🔓' : '🚫'}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </ScrollView>
        )
      ) : null}

      {/* Вкладка аналитики (переделана 29.09.2026 по запросу Марка: раньше
          показывала клики вместо людей, английские названия событий и не
          давала понять, сколько людей пришло/зарегистрировалось за день) */}
      {tab === 'analytics' && (
        analyticsLoading ? <View style={s.center}><ActivityIndicator color={colors.accent} size="large" /></View> :
        !analyticsSummary?.periods ? <View style={s.center}><Text style={{ color: colors.text2 }}>Нет данных</Text></View> : (() => {
          const a = analyticsSummary
          const pct = (x, total) => total ? ` (${Math.round((x / total) * 100)}%)` : ''
          const fmtDay = iso => { const [, m, d] = iso.split('-'); return `${d}.${m}` }
          const fmtDate = v => v ? new Date(v).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'
          const maxVisitors = Math.max(1, ...a.daily.map(d => d.visitors))
          const PERIODS = [['today', 'Сегодня'], ['yesterday', 'Вчера'], ['week', '7 дней'], ['month', '30 дней']]
          const METRICS = [
            ['visitors', '👀 Зашли на сайт'],
            ['users', '🔑 Из них в аккаунте'],
            ['registrations', '🆕 Регистрации'],
          ]
          return (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 16 }}>
              <Text style={{ color: colors.text2, fontSize: 12 }}>
                Дни — по {a.timezone}. Админы, модераторы и тестовые аккаунты не учитываются.
                «Зашли на сайт» — разные люди (устройства), включая тех, кто не вошёл в аккаунт;
                гостей без входа считаем с 29.09.2026.
              </Text>

              {/* Главное: люди и регистрации за периоды */}
              <View style={s.analyticsBlock}>
                <Text style={s.analyticsTitle}>Сколько людей</Text>
                <View style={s.analyticsRow}>
                  <Text style={{ flex: 1.6 }} />
                  {PERIODS.map(([, label]) => (
                    <Text key={label} style={{ flex: 1, color: colors.text2, fontSize: 12, textAlign: 'center' }}>{label}</Text>
                  ))}
                </View>
                {METRICS.map(([key, label]) => (
                  <View key={key} style={s.analyticsRow}>
                    <Text style={{ flex: 1.6, color: colors.text, fontSize: 13 }}>{label}</Text>
                    {PERIODS.map(([p]) => (
                      <Text key={p} style={{ flex: 1, color: colors.accent, fontWeight: '700', textAlign: 'center' }}>
                        {a.periods[p]?.[key] ?? 0}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>

              {/* Воронка — где люди отваливаются */}
              <View style={s.analyticsBlock}>
                <Text style={s.analyticsTitle}>Что делают после регистрации (за всё время)</Text>
                <View style={s.analyticsRow}>
                  <Text style={{ color: colors.text, flex: 1 }}>Зарегистрировались</Text>
                  <Text style={{ color: colors.accent, fontWeight: '700' }}>{a.funnel.registered}</Text>
                </View>
                <View style={s.analyticsRow}>
                  <Text style={{ color: colors.text, flex: 1 }}>Сделали хоть что-то (коллекция, вишлист, сообщение, ставка, отзыв, работа в портфолио)</Text>
                  <Text style={{ color: colors.accent, fontWeight: '700' }}>{a.funnel.didSomething}{pct(a.funnel.didSomething, a.funnel.registered)}</Text>
                </View>
                <View style={s.analyticsRow}>
                  <Text style={{ color: colors.text, flex: 1 }}>Возвращались в другой день</Text>
                  <Text style={{ color: colors.accent, fontWeight: '700' }}>{a.funnel.returned}{pct(a.funnel.returned, a.funnel.registered)}</Text>
                </View>
              </View>

              {/* Откуда пришли */}
              <View style={s.analyticsBlock}>
                <Text style={s.analyticsTitle}>Откуда пришли (30 дней)</Text>
                <Text style={{ color: colors.text2, fontSize: 12 }}>
                  Чтобы видеть канал, давайте ссылку с меткой: markeltoys.ru/?from=tg, ?from=avito, ?from=vk и т.п. — метка запоминается при первом заходе.
                </Text>
                {a.sources.length === 0 ? (
                  <Text style={{ color: colors.text2 }}>Пока никого</Text>
                ) : a.sources.map(src => (
                  <View key={src.source || '-'} style={s.analyticsRow}>
                    <Text style={{ color: colors.text, flex: 1 }}>{src.source || 'Без метки (прямой заход)'}</Text>
                    <Text style={{ color: colors.text2, fontSize: 12 }}>зашли </Text>
                    <Text style={{ color: colors.accent, fontWeight: '700' }}>{src.visitors}</Text>
                    <Text style={{ color: colors.text2, fontSize: 12 }}>  рег. </Text>
                    <Text style={{ color: colors.accent, fontWeight: '700' }}>{src.registrations}</Text>
                  </View>
                ))}
              </View>

              {/* По дням */}
              <View style={s.analyticsBlock}>
                <Text style={s.analyticsTitle}>По дням (30 дней)</Text>
                <Text style={{ color: colors.text2, fontSize: 12 }}>Полоса — сколько людей зашло; 🆕 — регистрации</Text>
                {a.daily.map(d => (
                  <View key={d.date} style={s.analyticsRow}>
                    <Text style={{ color: colors.text2, width: 44, fontSize: 12 }}>{fmtDay(d.date)}</Text>
                    <View style={{ flex: 1 }}>
                      {d.visitors > 0 && (
                        <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.accent, width: `${Math.max(4, (d.visitors / maxVisitors) * 100)}%` }} />
                      )}
                    </View>
                    <Text style={{ color: d.visitors ? colors.accent : colors.text2, fontWeight: '700', width: 28, textAlign: 'right' }}>{d.visitors}</Text>
                    <Text style={{ color: d.registrations ? colors.green : colors.text2, width: 44, textAlign: 'right', fontSize: 12 }}>
                      {d.registrations ? `🆕 ${d.registrations}` : ''}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Разделы */}
              <View style={s.analyticsBlock}>
                <Text style={s.analyticsTitle}>Куда заходят (30 дней)</Text>
                {a.sections.length === 0 ? (
                  <Text style={{ color: colors.text2 }}>Пока никого</Text>
                ) : a.sections.map(sc => (
                  <View key={sc.screen} style={s.analyticsRow}>
                    <Text style={{ color: colors.text, flex: 1 }}>{SCREEN_LABELS[sc.screen] || sc.screen}</Text>
                    <Text style={{ color: colors.accent, fontWeight: '700' }}>{sc.people} чел.</Text>
                    <Text style={{ color: colors.text2, fontSize: 12, width: 70, textAlign: 'right' }}>{sc.views} раз</Text>
                  </View>
                ))}
              </View>

              {/* Действия */}
              <View style={s.analyticsBlock}>
                <Text style={s.analyticsTitle}>Действия (30 дней)</Text>
                {a.actions.length === 0 ? (
                  <Text style={{ color: colors.text2 }}>Пока ничего</Text>
                ) : a.actions.map(ac => (
                  <View key={ac.event} style={s.analyticsRow}>
                    <Text style={{ color: colors.text, flex: 1 }}>{EVENT_LABELS[ac.event] || ac.event}</Text>
                    <Text style={{ color: colors.accent, fontWeight: '700' }}>{ac.count}</Text>
                    <Text style={{ color: colors.text2, fontSize: 12, width: 70, textAlign: 'right' }}>{ac.people} чел.</Text>
                  </View>
                ))}
              </View>

              {/* Наполнение */}
              <View style={s.analyticsBlock}>
                <Text style={s.analyticsTitle}>Что есть в приложении (за всё время)</Text>
                {CONTENT_LABELS.map(([key, label]) => (
                  <View key={key} style={s.analyticsRow}>
                    <Text style={{ color: colors.text, flex: 1 }}>{label}</Text>
                    <Text style={{ color: colors.accent, fontWeight: '700' }}>{a.content[key] ?? 0}</Text>
                  </View>
                ))}
              </View>

              {/* Последние регистрации */}
              <View style={s.analyticsBlock}>
                <Text style={s.analyticsTitle}>Последние регистрации</Text>
                {a.recentUsers.length === 0 ? (
                  <Text style={{ color: colors.text2 }}>Пока никого</Text>
                ) : a.recentUsers.map(u => (
                  <View key={u.id} style={{ gap: 2 }}>
                    <View style={s.analyticsRow}>
                      <Text style={{ color: colors.text, flex: 1, fontWeight: '600' }}>{u.name}</Text>
                      <Text style={{ color: u.didSomething ? colors.green : colors.text2, fontSize: 12 }}>
                        {u.didSomething ? '✅ что-то делал' : '💤 ничего не делал'}
                      </Text>
                    </View>
                    <Text style={{ color: colors.text2, fontSize: 12 }}>
                      Рег. {fmtDate(u.createdAt)} · последний заход {fmtDate(u.lastSeen)}{u.source ? ` · источник: ${u.source}` : ''}
                    </Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          )
        })()
      )}

      {/* Вкладка «Игра» — обзор карт + статистика по боям */}
      {tab === 'game' && (
        (gameCardsLoading || gameStatsLoading) ? <View style={s.center}><ActivityIndicator color={colors.accent} size="large" /></View> : (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 16 }}>
            {gameStats && (
              <>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={[s.statCard, { flex: 1 }]}>
                    <Text style={s.statNum}>{gameStats.totalBattles}</Text>
                    <Text style={s.statLabel}>Боёв всего</Text>
                  </View>
                  <View style={[s.statCard, { flex: 1 }]}>
                    <Text style={s.statNum}>{gameStats.playersWithCards}</Text>
                    <Text style={s.statLabel}>Игроков с картами</Text>
                  </View>
                </View>

                <View style={s.analyticsBlock}>
                  <Text style={s.analyticsTitle}>Бои по статусу</Text>
                  {Object.entries(gameStats.battlesByStatus).map(([status, count]) => (
                    <View key={status} style={s.analyticsRow}>
                      <Text style={{ color: colors.text, flex: 1 }}>
                        {status === 'ACTIVE' ? '⏳ В процессе' : status === 'WON' ? '🏆 Победа' : '💀 Поражение'}
                      </Text>
                      <Text style={{ color: colors.accent, fontWeight: '700' }}>{count}</Text>
                    </View>
                  ))}
                </View>

                {gameStats.topOwnedCards?.length > 0 && (
                  <View style={s.analyticsBlock}>
                    <Text style={s.analyticsTitle}>Популярные карты (по владению)</Text>
                    {gameStats.topOwnedCards.map((c, i) => (
                      <View key={i} style={s.analyticsRow}>
                        <Text style={{ color: colors.text2, width: 20 }}>{i + 1}.</Text>
                        <Text style={{ color: colors.text, flex: 1 }}>{c.name}</Text>
                        <Text style={{ color: colors.accent, fontWeight: '700' }}>{c.totalOwned}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}

            <Text style={s.analyticsTitle}>Все карты ({gameCards.length})</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {gameCards.map(c => {
                const r = RARITY[c.rarity] || RARITY.COMMON
                return (
                  <View key={c.id} style={[s.gameCardTile, { borderColor: r.color }]}>
                    <CardArt card={c} size={64} />
                    <Text style={s.gameCardName} numberOfLines={1}>{c.name}</Text>
                    <Text style={[s.gameCardRarity, { color: r.color }]}>{r.label}</Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 2 }}>
                      <Text style={s.gameCardStat}>💧{c.cost}</Text>
                      <Text style={s.gameCardStat}>⚔️{c.attack}</Text>
                      <Text style={s.gameCardStat}>🛡️{c.health}</Text>
                    </View>
                    {!!c.effectText && <Text style={s.gameCardEffect} numberOfLines={3}>{c.effectText}</Text>}
                  </View>
                )
              })}
            </View>
          </ScrollView>
        )
      )}

      {/* Вкладка товаров */}
      {tab === 'products' && (
      <>
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
      </>
      )}

      {/* Вкладка: Поддержка */}
      {tab === 'support' && (
        convLoading ? <View style={s.center}><ActivityIndicator color={colors.accent} size="large" /></View> :
        activeConv ? (
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 12 }}>
              <TouchableOpacity onPress={() => { setActiveConv(null); setConvMessages([]) }}>
                <Text style={{ fontSize: 24, color: colors.accent }}>‹</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, flex: 1 }}>{activeConv.user.name}</Text>
            </View>
            {convMsgLoading ? <View style={s.center}><ActivityIndicator color={colors.accent} /></View> : (
              <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
                {convMessages.map(msg => (
                  <TouchableOpacity key={msg.id} activeOpacity={0.8} onLongPress={() => handleDeleteMessage(msg)} style={[
                    { maxWidth: '80%', padding: 12, borderRadius: 16 },
                    msg.fromAdmin
                      ? { alignSelf: 'flex-end', backgroundColor: colors.accent }
                      : { alignSelf: 'flex-start', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }
                  ]}>
                    {!!msg.productName && (
                      <Text style={{ fontSize: 11, fontStyle: 'italic', marginBottom: 4, color: msg.fromAdmin ? 'rgba(255,255,255,0.75)' : colors.text2 }}>
                        по товару «{msg.productName}»
                      </Text>
                    )}
                    <Text style={{ fontSize: 14, color: msg.fromAdmin ? 'white' : colors.text, lineHeight: 20 }}>{msg.text}</Text>
                    <Text style={{ fontSize: 10, color: msg.fromAdmin ? 'rgba(255,255,255,0.7)' : colors.text2, marginTop: 4, alignSelf: 'flex-end' }}>
                      {new Date(msg.createdAt).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <View style={{ flexDirection: 'row', padding: 12, gap: 10, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface }}>
                <SmartInput
                  style={{ flex: 1, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: colors.text, fontSize: 14 }}
                  value={replyText}
                  onChangeText={setReplyText}
                  placeholder="Ответ..."
                  placeholderTextColor={colors.text2}
                  multiline
                />
                <TouchableOpacity
                  style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: replyText.trim() ? colors.accent : colors.surface2, justifyContent: 'center', alignItems: 'center', alignSelf: 'flex-end' }}
                  onPress={sendReply}
                  disabled={!replyText.trim() || replySending}
                >
                  {replySending ? <ActivityIndicator color="white" size="small" /> : <Text style={{ color: 'white', fontSize: 18, fontWeight: '700' }}>↑</Text>}
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
            {conversations.length === 0 && (
              <View style={s.center}>
                <Text style={{ fontSize: 40, marginBottom: 12 }}>💬</Text>
                <Text style={{ color: colors.text2 }}>Обращений пока нет</Text>
              </View>
            )}
            {conversations.map(conv => (
              <TouchableOpacity key={conv.user.id} style={[s.userCard, { gap: 12 }]} onPress={() => openConversation(conv)}>
                {conv.user.avatarUrl
                  ? <Image source={{ uri: conv.user.avatarUrl }} style={{ width: 42, height: 42, borderRadius: 21 }} />
                  : <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: `${colors.blue}30`, justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={{ fontWeight: '700', color: colors.blue }}>{(conv.user.name || '?')[0]}</Text>
                    </View>
                }
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{conv.user.name}</Text>
                  {!!conv.lastProductName && (
                    <Text style={{ fontSize: 11, fontStyle: 'italic', color: colors.text2 }} numberOfLines={1}>по товару «{conv.lastProductName}»</Text>
                  )}
                  <Text style={{ fontSize: 12, color: colors.text2 }} numberOfLines={1}>{conv.lastMessage}</Text>
                </View>
                {conv.unread > 0 && (
                  <View style={{ minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 }}>
                    <Text style={{ color: 'white', fontSize: 11, fontWeight: '700' }}>{conv.unread}</Text>
                  </View>
                )}
                <Text style={{ color: colors.text2, fontSize: 18 }}>›</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )
      )}

      {/* Модал релиза */}
      <Modal visible={releaseModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '90%' }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 20 }}>{editRelease ? 'Редактировать релиз' : 'Новый релиз'}</Text>
              <ScrollView keyboardShouldPersistTaps="handled">
                {[
                  ['Название *', 'name', 'Evangelion Unit-01 ver.2.0'],
                  ['Производитель', 'manufacturer', 'Bandai, Good Smile...'],
                  ['Дата выхода * (ГГГГ-ММ-ДД)', 'releaseDate', '2025-12-01'],
                  ['Описание', 'description', 'Краткое описание...'],
                  ['Ссылка на фото (URL)', 'imageUrl', 'https://...'],
                ].map(([label, key, placeholder]) => (
                  <View key={key} style={{ marginBottom: 14 }}>
                    <Text style={s.label}>{label.toUpperCase()}</Text>
                    <SmartInput
                      style={s.input}
                      value={releaseForm[key]}
                      onChangeText={v => setReleaseForm(p => ({ ...p, [key]: v }))}
                      placeholder={placeholder}
                      placeholderTextColor={colors.text2}
                    />
                  </View>
                ))}
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                  <TouchableOpacity style={{ flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }} onPress={() => setReleaseModal(false)}>
                    <Text style={{ color: colors.text, fontWeight: '500' }}>Отмена</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.saveBtn, { flex: 1 }]} onPress={handleSaveRelease} disabled={savingRelease}>
                    {savingRelease ? <ActivityIndicator color="white" /> : <Text style={{ color: 'white', fontWeight: '700' }}>{editRelease ? 'Сохранить' : 'Добавить'}</Text>}
                  </TouchableOpacity>
                </View>
                <View style={{ height: 24 }} />
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
              ['Производитель', 'manufacturer', 'Hasbro, Bandai...', 'default'],
              ['Франшиза', 'franchise', 'Marvel, Star Wars...', 'default'],
              ['Персонаж', 'character', 'Spider-Man, Goku...', 'default'],
              ['Год производства', 'yearMade', '2023', 'numeric'],
            ].map(([label, key, placeholder, kb]) => (
              <View key={key}>
                <Text style={s.label}>{label.toUpperCase()}</Text>
                <SmartInput
                  style={s.input}
                  value={form[key]}
                  onChangeText={v => setForm(p => ({ ...p, [key]: v }))}
                  placeholder={placeholder}
                  placeholderTextColor={colors.text2}
                  keyboardType={kb}
                />
              </View>
            ))}

            {!form.isAuction && (
              <View>
                <Text style={s.label}>ЦЕНА (₽) *</Text>
                <SmartInput
                  style={s.input}
                  value={form.price}
                  onChangeText={v => setForm(p => ({ ...p, price: v }))}
                  placeholder="1500"
                  placeholderTextColor={colors.text2}
                  keyboardType="numeric"
                />
              </View>
            )}

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

            <Text style={s.label}>ТИП ПРОДАЖИ</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
              {[{ v: false, icon: '💰', t: 'Обычная' }, { v: true, icon: '🔨', t: 'Аукцион' }].map(opt => (
                <TouchableOpacity
                  key={String(opt.v)}
                  onPress={() => setForm(p => ({ ...p, isAuction: opt.v }))}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: form.isAuction === opt.v ? (opt.v ? '#FF6B00' : colors.accent) : colors.border, backgroundColor: form.isAuction === opt.v ? (opt.v ? '#FF6B0015' : `${colors.accent}15`) : colors.surface }}
                >
                  <Text style={{ fontSize: 16 }}>{opt.icon}</Text>
                  <Text style={{ fontWeight: '700', color: form.isAuction === opt.v ? (opt.v ? '#FF6B00' : colors.accent) : colors.text2 }}>{opt.t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {form.isAuction && (
              <>
                <Text style={s.label}>НАЧАЛЬНАЯ ЦЕНА (₽) *</Text>
                <SmartInput style={[s.input, { marginBottom: 16 }]} value={form.startPrice} onChangeText={v => setForm(p => ({ ...p, startPrice: v }))} placeholder="500" placeholderTextColor={colors.text2} keyboardType="numeric" />

                <Text style={s.label}>ШАГ СТАВКИ (₽)</Text>
                <SmartInput style={[s.input, { marginBottom: 16 }]} value={form.priceStep} onChangeText={v => setForm(p => ({ ...p, priceStep: v }))} placeholder="100" placeholderTextColor={colors.text2} keyboardType="numeric" />

                <Text style={s.label}>СРОК АУКЦИОНА</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                  {['1', '2', '3'].map(d => (
                    <TouchableOpacity key={d} onPress={() => setForm(p => ({ ...p, auctionDays: d }))}
                      style={{ flex: 1, padding: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1.5, borderColor: form.auctionDays === d ? '#FF6B00' : colors.border, backgroundColor: form.auctionDays === d ? '#FF6B0015' : colors.surface }}>
                      <Text style={{ fontWeight: '700', color: form.auctionDays === d ? '#FF6B00' : colors.text2 }}>{d} {d === '1' ? 'день' : 'дня'}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <Text style={s.label}>ОПИСАНИЕ</Text>
            <SmartInput
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
    </ScreenBackground>
  )
}

const s = StyleSheet.create({
  wrap: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', paddingTop: 60 },
  tabs: { flexDirection: 'row', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  tabBtn: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: colors.accent },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.text2 },
  tabTextActive: { color: colors.accent },
  statCard: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 16, alignItems: 'center' },
  statNum: { fontSize: 32, fontWeight: '900', color: colors.accent },
  statLabel: { fontSize: 12, color: colors.text2, marginTop: 4 },
  analyticsBlock: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 10 },
  analyticsTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 4 },
  analyticsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  userCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 10 },
  badgeBtn: { width: 34, height: 34, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2, justifyContent: 'center', alignItems: 'center' },
  reportCard: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 16 },
  reportTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 4 },
  reportSub: { fontSize: 12, color: colors.text2 },
  reportBtn: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  reportBtnText: { fontSize: 13, fontWeight: '700' },
  gameCardTile: { width: 140, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1.5, padding: 10, alignItems: 'center' },
  gameCardName: { fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 8, textAlign: 'center' },
  gameCardRarity: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  gameCardStat: { fontSize: 12, color: colors.text2 },
  gameCardEffect: { fontSize: 10, color: colors.text2, textAlign: 'center', marginTop: 6, lineHeight: 13 },
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