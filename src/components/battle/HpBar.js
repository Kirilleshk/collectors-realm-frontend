import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { colors } from '../../theme'
import DamagePopup from './DamagePopup'

export default function HpBar({ label, value, max, color, popups = [], thick = false }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0
  const trackHeight = thick ? 18 : 10
  return (
    <View style={s.hpRow}>
      <Text style={[s.hpLabel, thick && s.hpLabelThick]}>{label}</Text>
      <View style={s.hpTrackWrap}>
        <View style={[s.hpTrack, { height: trackHeight, borderRadius: trackHeight / 2 }, thick && s.hpTrackThick]}>
          <View style={[s.hpFill, { width: `${pct * 100}%`, backgroundColor: color, borderRadius: trackHeight / 2 }]} />
        </View>
        {popups.map(p => <DamagePopup key={p.id} amount={p.amount} />)}
      </View>
      <Text style={[s.hpValue, thick && s.hpValueThick]}>{value}/{max}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  hpRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6, alignSelf: 'stretch' },
  hpLabel: { fontSize: 12, color: colors.text2, width: 36 },
  hpLabelThick: { fontSize: 13, fontWeight: '700', color: colors.text, width: 44 },
  hpTrackWrap: { flex: 1 },
  hpTrack: { backgroundColor: colors.surface2, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(0,0,0,0.4)' },
  hpTrackThick: { borderWidth: 1.5 },
  hpFill: { height: '100%' },
  hpValue: { fontSize: 12, color: colors.text2, width: 56, textAlign: 'right' },
  hpValueThick: { fontSize: 13, fontWeight: '700', color: colors.text, width: 64 },
})
