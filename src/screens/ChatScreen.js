
import React, { useState, useRef } from 'react'
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native'
import { colors } from '../theme'

export default function ChatScreen({ route }) {
  const { productName } = route.params || {}
  const [messages, setMessages] = useState([
    { id: '1', text: `Здравствуйте! Меня интересует "${productName}". Он ещё доступен?`, fromMe: true, time: new Date(Date.now() - 60000) },
    { id: '2', text: 'Да, товар доступен! Готов ответить на ваши вопросы.', fromMe: false, time: new Date(Date.now() - 30000) },
  ])
  const [text, setText] = useState('')
  const flatListRef = useRef(null)

  function formatTime(date) {
    return date.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })
  }

  function handleSend() {
    if (!text.trim()) return
    const newMsg = { id: Date.now().toString(), text: text.trim(), fromMe: true, time: new Date() }
    setMessages(prev => [...prev, newMsg])
    setText('')
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100)
    setTimeout(() => {
      const reply = { id: (Date.now() + 1).toString(), text: 'Спасибо за сообщение! Отвечу как можно скорее.', fromMe: false, time: new Date() }
      setMessages(prev => [...prev, reply])
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100)
    }, 1500)
  }

  return (
    <KeyboardAvoidingView style={s.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <View style={s.productBar}>
        <Text style={s.productIcon}>🗿</Text>
        <View>
          <Text style={s.productName} numberOfLines={1}>{productName || 'Товар'}</Text>
          <Text style={s.productSub}>Чат с продавцом</Text>
        </View>
      </View>
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={m => m.id}
        contentContainerStyle={s.list}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => (
          <View style={[s.msgWrap, item.fromMe ? s.msgWrapMe : s.msgWrapThem]}>
            <View style={[s.bubble, item.fromMe ? s.bubbleMe : s.bubbleThem]}>
              <Text style={[s.bubbleText, item.fromMe ? s.bubbleTextMe : s.bubbleTextThem]}>{item.text}</Text>
              <Text style={[s.timeText, item.fromMe ? s.timeMe : s.timeThem]}>{formatTime(item.time)}</Text>
            </View>
          </View>
        )}
      />
      <View style={s.inputBar}>
        <TextInput style={s.input} value={text} onChangeText={setText} placeholder="Написать..." placeholderTextColor={colors.text2} multiline maxLength={500} />
        <TouchableOpacity style={[s.sendBtn, !text.trim() && s.sendBtnOff]} onPress={handleSend} disabled={!text.trim()}>
          <Text style={s.sendIcon}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  productBar: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  productIcon: { fontSize: 32 },
  productName: { fontSize: 15, fontWeight: '700', color: colors.text },
  productSub: { fontSize: 12, color: colors.text2, marginTop: 2 },
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
  timeText: { fontSize: 11, marginTop: 4 },
  timeMe: { color: 'rgba(255,255,255,0.7)', textAlign: 'right' },
  timeThem: { color: colors.text2 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: 12, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  input: { flex: 1, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: colors.text, fontSize: 15, maxHeight: 100 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center' },
  sendBtnOff: { backgroundColor: colors.surface2 },
  sendIcon: { color: 'white', fontSize: 20, fontWeight: '700' },
})