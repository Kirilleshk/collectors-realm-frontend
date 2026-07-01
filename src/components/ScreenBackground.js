import React from 'react'
import { View, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { colors } from '../theme'

// Общий атмосферный фон экранов приложения — мягкий вертикальный градиент
// вместо плоского colors.bg, без привязки к какой-либо теме/вселенной.
// Оборачивает содержимое экрана, само содержимое рендерится поверх как обычно.
export default function ScreenBackground({ children, style }) {
  return (
    <View style={[s.wrap, style]}>
      <LinearGradient colors={[colors.surface, colors.bg, '#000000']} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      {children}
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { flex: 1 },
})
