import React, { useEffect, useRef, useState } from 'react'
import { Animated, Text, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../theme'
import { CircleCheck } from '../icons'

// Короткое всплывающее подтверждение сверху экрана («Объявление
// опубликовано», «Изменения сохранены») — 20.10.2026. Alert.alert в вебе
// пустая заглушка, а молчаливый возврат на экран после действия оставлял
// человека гадать, получилось ли. Вызов — showNotice('текст') из любого
// места; показывает <NoticeHost />, один раз смонтированный в App.js.

let listener = null

export function showNotice(text) {
  listener?.(text)
}

const SHOW_MS = 2500

export function NoticeHost() {
  const insets = useSafeAreaInsets()
  const [text, setText] = useState(null)
  const opacity = useRef(new Animated.Value(0)).current
  const timerRef = useRef(null)

  useEffect(() => {
    listener = (t) => {
      clearTimeout(timerRef.current)
      setText(t)
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start()
      timerRef.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => setText(null))
      }, SHOW_MS)
    }
    return () => { listener = null; clearTimeout(timerRef.current) }
  }, [opacity])

  if (!text) return null
  return (
    <Animated.View pointerEvents="none" style={[s.wrap, { top: insets.top + 12, opacity }]}>
      <CircleCheck size={18} color={colors.green} strokeWidth={2.2} />
      <Text style={s.text}>{text}</Text>
    </Animated.View>
  )
}

const s = StyleSheet.create({
  wrap: {
    position: 'absolute', alignSelf: 'center', zIndex: 1000, elevation: 20,
    flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '90%',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: `${colors.green}70`,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10,
  },
  text: { color: colors.text, fontSize: 14, fontWeight: '700' },
})
