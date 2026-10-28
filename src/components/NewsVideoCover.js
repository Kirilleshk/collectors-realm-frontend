import React from 'react'
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native'
import { Play } from '../icons'

// Обложка видео в «Новостях»: превью из Telegram, кнопка ▶ и подпись снизу.
// Нужна, когда ролик не проиграть на сайте (Telegram не отдал mp4 — «Media is
// too big», или ссылка протухла) — тогда onPress открывает пост в Telegram;
// в приложении — до нажатия «Смотреть» (см. NewsVideo.js). style задаёт размер.
export default function NewsVideoCover({ video, label, onPress, style }) {
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={[s.wrap, style]}>
      {video.thumb ? <Image source={{ uri: video.thumb }} style={StyleSheet.absoluteFill} resizeMode="contain" /> : null}
      <View style={s.play}>
        <Play size={28} color="white" fill="white" strokeWidth={1.5} />
      </View>
      {label || video.duration ? (
        <View style={s.bar}>
          {label ? <Text style={s.label}>{label}</Text> : <View />}
          {video.duration ? <Text style={s.duration}>{video.duration}</Text> : null}
        </View>
      ) : null}
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  wrap: { backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  play: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', justifyContent: 'center', alignItems: 'center', paddingLeft: 3 },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: 'rgba(0,0,0,0.55)' },
  label: { color: 'white', fontSize: 13, fontWeight: '600' },
  duration: { color: 'white', fontSize: 12, fontWeight: '600' },
})
