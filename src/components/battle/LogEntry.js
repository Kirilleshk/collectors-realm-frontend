import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { colors } from '../../theme'

// "Ход N" (с возможным добором карты в той же строке) — разделитель ходов.
// Финальные/служебные сообщения — нейтральный стиль по центру.
// «Карта» (Вы) ... или "Вы ..." — действие игрока, иначе — действие босса.
function classifyLog(text) {
  if (/^Ход\s+\d+/.test(text)) return 'turn'
  if (text.includes('Победа!') || text.includes('повержены') || text.startsWith('Награда:') || text.startsWith('Бой начался')) return 'system'
  if (text.startsWith('Вы') || /^«[^»]+»\s*\(Вы\)/.test(text)) return 'player'
  return 'boss'
}

export default function LogEntry({ text }) {
  const kind = classifyLog(text)

  if (kind === 'turn') {
    return (
      <View style={s.logDivider}>
        <Text style={s.logDividerText}>{text}</Text>
      </View>
    )
  }
  if (kind === 'system') {
    return <Text style={s.logSystem}>{text}</Text>
  }

  const isBoss = kind === 'boss'
  const tint = isBoss ? colors.accent : colors.green
  return (
    <View style={[s.logRow, isBoss && s.logRowEnd]}>
      <View style={[s.logBubble, { backgroundColor: `${tint}15`, borderColor: `${tint}35` }]}>
        <View style={[s.logIconBadge, { backgroundColor: tint }]}>
          <Text style={s.logIconBadgeText}>{isBoss ? '👹' : '⚔️'}</Text>
        </View>
        <Text style={s.logBubbleText}>{text}</Text>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  logDivider: { alignSelf: 'center', backgroundColor: colors.surface2, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 4, marginVertical: 8 },
  logDividerText: { fontSize: 11, fontWeight: '700', color: colors.text2 },
  logSystem: { fontSize: 12, color: colors.text2, fontStyle: 'italic', textAlign: 'center', marginBottom: 8 },
  logRow: { flexDirection: 'row', marginBottom: 8 },
  logRowEnd: { justifyContent: 'flex-end' },
  logBubble: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, maxWidth: '85%' },
  logIconBadge: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  logIconBadgeText: { fontSize: 11 },
  logBubbleText: { fontSize: 13, color: colors.text, lineHeight: 18, flexShrink: 1 },
})
