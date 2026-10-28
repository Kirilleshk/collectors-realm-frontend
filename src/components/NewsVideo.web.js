import React from 'react'
import { View } from 'react-native'

// Видео поста в «Новостях», веб: обычный <video> с кнопками браузера и
// превью из Telegram. preload="none" — в ленте до 20 роликов, грузится только
// тот, что запустили. Не expo-av: в вебе он кладёт обложку картинкой поверх
// <video>, и до загрузки она закрывает кнопки плеера.
// onError (ссылка протухла, CDN недоступен) — NewsMedia покажет обложку
// со ссылкой на пост.
export default function NewsVideo({ video, style, onError }) {
  return (
    <View style={[{ backgroundColor: '#000' }, style]}>
      <video
        src={video.url}
        poster={video.thumb}
        controls
        playsInline
        preload="none"
        onError={onError}
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
      />
    </View>
  )
}
