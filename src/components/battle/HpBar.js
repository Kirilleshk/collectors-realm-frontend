import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { colors } from '../../theme'
import DamagePopup from './DamagePopup'

export default function HpBar({ label, value, max, color, popups = [] }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0
  return (
    <View style={s.hpRow}>
      <Text style={s.hpLabel}>{label}</Text>
      <View style={s.hpTrackWrap}>
        <View style={s.hpTrack}>
          <View style={[s.hpFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
        </View>
        {popups.map(p => <DamagePopup key={p.id} amount={p.amount} />)}
      </View>
      <Text style={s.hpValue}>{value}/{max}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  hpRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6, alignSelf: 'stretch' },
  hpLabel: { fontSize: 12, color: colors.text2, width: 36 },
  hpTrackWrap: { flex: 1 },
  hpTrack: { height: 10, borderRadius: 5, backgroundColor: colors.surface2, overflow: 'hidden' },
  hpFill: { height: '100%', borderRadius: 5 },
  hpValue: { fontSize: 12, color: colors.text2, width: 56, textAlign: 'right' },
})
