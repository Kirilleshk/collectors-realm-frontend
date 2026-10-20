import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { View, Text, Image, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { messages as messagesApi } from '../api'
import { useAuth } from '../AuthContext'
import { colors } from '../theme'
import { refreshUnread } from '../utils/unread'
import SmartInput from '../utils/SmartInput'
import ScreenBackground from '../components/ScreenBackground'
import { Package, Send, ChevronRight } from '../icons'

// Переписка покупателя с продавцом по товару (20.10.2026, этап 3 «как на
// Авито»). Веб-сокетов нет: пока экран открыт, раз в POLL_MS спрашиваем
// только новые сообщения (?after=время последнего). Вид пузырей — как в
// чате с администрацией (ChatScreen.js).

const POLL_MS = 4000
const MAX_TEXT = 2000

function formatTime(date) {
  return new Date(date).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })
}

function formatDay(date) {
  const d = new Date(date)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return 'Сегодня'
  const y = new Date(now); y.setDate(now.getDate() - 1)
  if (d.toDateString() === y.toDateString()) return 'Вчера'
  return d.toLocaleDateString('ru', { day: 'numeric', month: 'long' })
}

// Слить новые сообщения со старыми без дублей (своё отправленное могло
// прийти и в ответе на отправку, и в очередном опросе)
function merge(prev, incoming) {
  if (!incoming.length) return prev
  const seen = new Set(prev.map(m => m.id))
  const add = incoming.filter(m => !seen.has(m.id))
  return add.length ? [...prev, ...add] : prev
}

export default function ConversationScreen({ route, navigation }) {
  const { id } = route.params
  const { user } = useAuth()
  const [conv, setConv] = useState(null)
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState(null)
  const listRef = useRef(null)
  const lastAtRef = useRef(null)

  useEffect(() => { lastAtRef.current = list.length ? list[list.length - 1].createdAt : null }, [list])

  useLayoutEffect(() => {
    if (conv?.other?.name) navigation.setOptions({ title: conv.other.name })
  }, [navigation, conv?.other?.name])

  const loadAll = useCallback(async () => {
    try {
      const res = await messagesApi.get(id)
      setConv(res.data.conversation)
      setList(res.data.messages || [])
      setError(null)
      refreshUnread()
    } catch (e) {
      setError(e.response?.status === 404 ? 'Переписка не найдена' : 'Не удалось загрузить переписку')
    }
    setLoading(false)
  }, [id])

  useEffect(() => { loadAll() }, [loadAll])

  // Опрос новых — только пока экран на виду
  useFocusEffect(useCallback(() => {
    const timer = setInterval(async () => {
      if (!lastAtRef.current) return
      try {
        const res = await messagesApi.get(id, lastAtRef.current)
        const fresh = res.data.messages || []
        if (fresh.length) {
          setList(prev => merge(prev, fresh))
          refreshUnread()
        }
      } catch (e) {}
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [id]))

  async function handleSend() {
    const t = text.trim()
    if (!t || sending) return
    setSending(true); setSendError(null)
    try {
      const res = await messagesApi.send(id, t)
      setList(prev => merge(prev, [res.data]))
      setText('')
    } catch (e) {
      setSendError(
        !e.response ? 'Нет связи — сообщение не отправлено' :
        e.response.data?.error || 'Не удалось отправить — попробуйте ещё раз'
      )
    }
    setSending(false)
  }

  // Enter — отправить, Shift+Enter — новая строка (на компьютере)
  function handleKeyPress(e) {
    if (Platform.OS !== 'web') return
    if (e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (loading) return <View style={s.center}><ActivityIndicator color={colors.accent} size="large" /></View>
  if (error) return <View style={s.center}><Text style={s.errorText}>{error}</Text></View>

  const product = conv?.product
  const photo = product?.images?.[0]?.url
  const isSold = product?.status === 'SOLD'

  return (
    <ScreenBackground>
    <KeyboardAvoidingView style={s.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      {/* О каком товаре переписка — нажатие открывает карточку */}
      <TouchableOpacity
        style={s.productBar}
        onPress={() => product && navigation.navigate('ProductDetail', { id: product.id })}
        disabled={!product}
        activeOpacity={0.75}
      >
        {photo
          ? <Image source={{ uri: photo }} style={s.productThumb} resizeMode="cover" />
          : <View style={[s.productThumb, s.productThumbEmpty]}><Package size={20} color={colors.border} strokeWidth={1.5} /></View>}
        <View style={{ flex: 1 }}>
          <Text style={s.productName} numberOfLines={1}>{product?.name || conv?.productName}</Text>
          <Text style={s.productSub} numberOfLines={1}>
            {!product ? 'Объявление удалено'
              : isSold ? 'Продано'
              : `${product.price?.toLocaleString('ru')} ₽`}
            {conv?.role === 'seller' ? ' · ваш товар' : ''}
          </Text>
        </View>
        {product ? <ChevronRight size={18} color={colors.text2} /> : null}
      </TouchableOpacity>

      <FlatList
        ref={listRef}
        data={list}
        keyExtractor={m => m.id}
        contentContainerStyle={s.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={s.hint}>
            <Text style={s.hintText}>
              {conv?.role === 'seller'
                ? 'Здесь появятся сообщения покупателя.'
                : 'Напишите продавцу — спросите о состоянии, комплектации или договоритесь о встрече. Ответ придёт сюда, во вкладку «Сообщения».'}
            </Text>
          </View>
        }
        renderItem={({ item, index }) => {
          const me = item.senderId === user?.id
          const prev = list[index - 1]
          const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(item.createdAt).toDateString()
          return (
            <View>
              {newDay ? <Text style={s.day}>{formatDay(item.createdAt)}</Text> : null}
              <View style={[s.msgWrap, me ? s.msgWrapMe : s.msgWrapThem]}>
                <View style={[s.bubble, me ? s.bubbleMe : s.bubbleThem]}>
                  <Text style={[s.bubbleText, me ? s.bubbleTextMe : s.bubbleTextThem]}>{item.text}</Text>
                  <Text style={[s.timeText, me ? s.timeMe : s.timeThem]}>{formatTime(item.createdAt)}</Text>
                </View>
              </View>
            </View>
          )
        }}
      />

      {sendError ? <Text style={s.sendError}>{sendError}</Text> : null}
      <View style={s.inputBar}>
        <SmartInput
          style={s.input}
          value={text}
          onChangeText={t => { setText(t); if (sendError) setSendError(null) }}
          onKeyPress={handleKeyPress}
          placeholder="Сообщение…"
          placeholderTextColor={colors.text2}
          multiline
          maxLength={MAX_TEXT}
        />
        <TouchableOpacity
          style={[s.sendBtn, !text.trim() && s.sendBtnOff]}
          onPress={handleSend}
          disabled={!text.trim() || sending}
          accessibilityLabel="Отправить"
        >
          {sending ? <ActivityIndicator color="white" size="small" /> : <Send size={18} color="white" strokeWidth={2.2} />}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
    </ScreenBackground>
  )
}

const s = StyleSheet.create({
  wrap: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  errorText: { color: colors.text2, fontSize: 15 },
  productBar: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  productThumb: { width: 44, height: 44, borderRadius: 8, backgroundColor: colors.surface2 },
  productThumbEmpty: { justifyContent: 'center', alignItems: 'center' },
  productName: { fontSize: 15, fontWeight: '700', color: colors.text },
  productSub: { fontSize: 13, color: colors.accent, marginTop: 2, fontWeight: '600' },
  list: { padding: 16, flexGrow: 1, width: '100%', maxWidth: 820, alignSelf: 'center' },
  hint: { paddingHorizontal: 16, paddingTop: 24 },
  hintText: { fontSize: 13, color: colors.text2, textAlign: 'center', lineHeight: 19 },
  day: { alignSelf: 'center', fontSize: 12, color: colors.text2, marginVertical: 10 },
  msgWrap: { flexDirection: 'row', marginBottom: 8 },
  msgWrapMe: { justifyContent: 'flex-end' },
  msgWrapThem: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '78%', borderRadius: 18, padding: 12, paddingBottom: 6 },
  bubbleMe: { backgroundColor: colors.accent, borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, lineHeight: 20 },
  bubbleTextMe: { color: 'white' },
  bubbleTextThem: { color: colors.text },
  timeText: { fontSize: 11, marginTop: 4 },
  timeMe: { color: 'rgba(255,255,255,0.7)', textAlign: 'right' },
  timeThem: { color: colors.text2 },
  sendError: { fontSize: 13, color: colors.red, textAlign: 'center', paddingHorizontal: 16, paddingBottom: 6 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: 12, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  input: { flex: 1, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: colors.text, fontSize: 15, maxHeight: 120 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center' },
  sendBtnOff: { backgroundColor: colors.surface2 },
})
