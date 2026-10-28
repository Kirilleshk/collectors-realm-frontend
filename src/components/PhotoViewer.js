import React, { useState, useRef, useCallback } from 'react'
import { Modal, View, Image, Pressable, Text, StyleSheet, ActivityIndicator, PanResponder, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { X, ChevronLeft, ChevronRight } from '../icons'

// Фото на весь экран (Марк, 26.10.2026: в профиле коллекционера фото видно
// только маленькими). Рендерить, только пока открыто:
//   {viewer && <PhotoViewer photos={urls} initialIndex={i} onClose={...} />}
// — тогда каждый раз сразу показывается нужное фото, без мелькания прошлого.
// Листать — свайпом или стрелками; закрыть — ✕, нажатием на фото или фон,
// «назад» на Android. Esc в браузере ловит сам Modal react-native-web (только
// верхний, так что модалка под просмотрщиком не закроется вместе с ним).
// Если открываешь из другого Modal — рендери внутри него, иначе на iOS
// просмотрщик не покажется поверх.
export default function PhotoViewer({ photos, initialIndex = 0, onClose }) {
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const count = photos.length
  const [current, setCurrent] = useState(() => Math.min(Math.max(initialIndex, 0), count - 1))
  const [status, setStatus] = useState({}) // url → 'ok' | 'error'; нет ключа — ещё грузится
  const uri = photos[current]

  // Колбэки стабильны для одного url: Image в react-native-web перезапускает
  // загрузку при каждой смене onLoad/onError
  const onLoad = useCallback(() => setStatus(s => ({ ...s, [uri]: 'ok' })), [uri])
  const onError = useCallback(() => setStatus(s => ({ ...s, [uri]: 'error' })), [uri])

  const lastRef = useRef(count - 1)
  lastRef.current = count - 1
  const step = useCallback(d => setCurrent(i => Math.min(Math.max(i + d, 0), lastRef.current)), [])
  // Жест перехватывает нажатие только при заметном движении — простое
  // нажатие доходит до фона (закрыть) и до стрелок. Листает только движение вбок.
  const swipedAt = useRef(0)
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 12 || Math.abs(g.dy) > 12,
    onPanResponderRelease: (_, g) => {
      swipedAt.current = Date.now()
      if (Math.abs(g.dx) > 50 && Math.abs(g.dx) > Math.abs(g.dy)) step(g.dx < 0 ? 1 : -1)
    },
  })).current
  // В браузере onPress — это DOM-click, и он приходит даже после перетаскивания
  // мышью (react-native-web не связывает его с жестом) — иначе свайп закрывал бы фото
  const closeByTap = () => { if (Date.now() - swipedAt.current > 300) onClose() }

  if (!uri) return null

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={s.backdrop} {...pan.panHandlers}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeByTap} accessibilityLabel="Закрыть фото" />

        <View style={[StyleSheet.absoluteFill, s.center, s.passThrough]}>
          {status[uri] === 'error'
            ? <Text style={s.errorText}>Не удалось загрузить фото</Text>
            : status[uri] !== 'ok' && <ActivityIndicator color="white" size="large" style={s.spinner} />}
          <Image source={{ uri }} style={{ width, height }} resizeMode="contain" onLoad={onLoad} onError={onError} />
        </View>

        {count > 1 && <Text style={[s.counter, { top: insets.top + 22 }]}>{current + 1} / {count}</Text>}
        <Pressable style={[s.btn, s.close, { top: insets.top + 12 }]} onPress={onClose} hitSlop={8} accessibilityLabel="Закрыть фото">
          <X size={22} color="white" strokeWidth={2.5} />
        </Pressable>

        {current > 0 && (
          <Pressable style={[s.btn, s.prev]} onPress={() => step(-1)} hitSlop={8} accessibilityLabel="Предыдущее фото">
            <ChevronLeft size={26} color="white" strokeWidth={2.5} />
          </Pressable>
        )}
        {current < count - 1 && (
          <Pressable style={[s.btn, s.next]} onPress={() => step(1)} hitSlop={8} accessibilityLabel="Следующее фото">
            <ChevronRight size={26} color="white" strokeWidth={2.5} />
          </Pressable>
        )}
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' },
  center: { justifyContent: 'center', alignItems: 'center' },
  passThrough: { pointerEvents: 'none' }, // нажатия проходят к фону — фото тоже закрывается нажатием
  spinner: { position: 'absolute' },
  errorText: { position: 'absolute', color: 'white', fontSize: 15 },
  counter: { position: 'absolute', alignSelf: 'center', color: 'white', fontSize: 15, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  // тёмная подложка с обводкой — кнопку видно и на светлом фото, и на чёрном фоне
  btn: { position: 'absolute', width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center' },
  close: { right: 12 },
  prev: { left: 12, top: '50%', marginTop: -22 },
  next: { right: 12, top: '50%', marginTop: -22 },
})
