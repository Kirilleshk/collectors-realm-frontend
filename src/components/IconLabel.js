import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { colors } from '../theme'

// Иконка Lucide + подпись в одну строку — вместо эмодзи внутри текста
// (13.10.2026: эмодзи на разных устройствах рисуются по-разному и не красятся
// в цвета темы). Цвет иконки по умолчанию берётся из textStyle, чтобы
// иконка и подпись всегда совпадали.
export default function IconLabel({ icon: Icon, label, children, color, size = 16, strokeWidth = 2, gap = 6, style, textStyle }) {
  const iconColor = color || StyleSheet.flatten(textStyle)?.color || colors.text
  return (
    <View style={[s.row, { gap }, style]}>
      {Icon ? <Icon size={size} color={iconColor} strokeWidth={strokeWidth} /> : null}
      <Text style={textStyle}>{label ?? children}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
})
