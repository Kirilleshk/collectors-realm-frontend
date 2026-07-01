import React, { useEffect, useState, useRef } from 'react'
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native'
import { colors } from '../theme'
import { support as supportApi } from '../api'
import SmartInput from '../utils/SmartInput'
import ScreenBackground from '../components/ScreenBackground'

export default function ChatScreen({ route }) {
  const { productName, productId } = route.params || {}
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const flatListRef = useRef(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await supportApi.getMyMessages()
      setMessages(Array.isArray(res.data) ? res.data : [])
    } catch (e) {}
    setLoading(false)
  }

  function formatTime(date) {
    return new Date(date).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })
  }

  async function handleSend() {
    if (!text.trim() || sending) return
    setSending(true)
    try {
      const res = await supportApi.sendMessage(text.trim(), { id: productId, name: productName })
      setMessages(prev => [...prev, res.data])
      setText('')
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100)
    } catch (e) {}
    setSending(false)
  }

  return (
    <ScreenBackground>
    <KeyboardAvoidingView style={s.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <View style={s.productBar}>
        <Text style={s.productIcon}>🗿</Text>
        <View>
          <Text style={s.productName} numberOfLines={1}>{productName || 'Товар'}</Text>
          <Text style={s.productSub}>Связь с администрацией магазина</Text>
        </View>
      </View>
      {loading ? (
        <View style={s.center}><ActivityIndicator color={colors.accent} size="large" /></View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={m => m.id}
          contentContainerStyle={s.list}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListHeaderComponent={
            <View style={s.hint}>
              <Text style={s.hintText}>
                Сообщение придёт администрации магазина — отвечают здесь же, в этом чате.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[s.msgWrap, item.fromAdmin ? s.msgWrapThem : s.msgWrapMe]}>
              <View style={[s.bubble, item.fromAdmin ? s.bubbleThem : s.bubbleMe]}>
                {item.fromAdmin && <Text style={s.adminLabel}>Администрация</Text>}
                {!!item.productName && (
                  <Text style={[s.productTag, item.fromAdmin ? s.productTagThem : s.productTagMe]}>
                    по товару «{item.productName}»
                  </Text>
                )}
                <Text style={[s.bubbleText, item.fromAdmin ? s.bubbleTextThem : s.bubbleTextMe]}>{item.text}</Text>
                <Text style={[s.timeText, item.fromAdmin ? s.timeThem : s.timeMe]}>{formatTime(item.createdAt)}</Text>
              </View>
            </View>
          )}
        />
      )}
      <View style={s.inputBar}>
        <SmartInput style={s.input} value={text} onChangeText={setText} placeholder="Написать..." placeholderTextColor={colors.text2} multiline maxLength={500} />
        <TouchableOpacity style={[s.sendBtn, !text.trim() && s.sendBtnOff]} onPress={handleSend} disabled={!text.trim() || sending}>
          {sending ? <ActivityIndicator color="white" size="small" /> : <Text style={s.sendIcon}>↑</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
    </ScreenBackground>
  )
}

const s = StyleSheet.create({
  wrap: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  productBar: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  productIcon: { fontSize: 32 },
  productName: { fontSize: 15, fontWeight: '700', color: colors.text },
  productSub: { fontSize: 12, color: colors.text2, marginTop: 2 },
  hint: { paddingHorizontal: 8, paddingBottom: 12 },
  hintText: { fontSize: 12, color: colors.text2, textAlign: 'center', lineHeight: 17 },
  list: { padding: 16, gap: 8 },
  msgWrap: { flexDirection: 'row', marginBottom: 8 },
  msgWrapMe: { justifyContent: 'flex-end' },
  msgWrapThem: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '75%', borderRadius: 18, padding: 12, paddingBottom: 6 },
  bubbleMe: { backgroundColor: colors.accent, borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, lineHeight: 20 },
  bubbleTextMe: { color: 'white' },
  bubbleTextThem: { color: colors.text },
  adminLabel: { fontSize: 11, fontWeight: '700', color: colors.accent, marginBottom: 2 },
  productTag: { fontSize: 11, fontStyle: 'italic', marginBottom: 4 },
  productTagMe: { color: 'rgba(255,255,255,0.75)' },
  productTagThem: { color: colors.text2 },
  timeText: { fontSize: 11, marginTop: 4 },
  timeMe: { color: 'rgba(255,255,255,0.7)', textAlign: 'right' },
  timeThem: { color: colors.text2 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: 12, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  input: { flex: 1, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: colors.text, fontSize: 15, maxHeight: 100 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center' },
  sendBtnOff: { backgroundColor: colors.surface2 },
  sendIcon: { color: 'white', fontSize: 20, fontWeight: '700' },
})
