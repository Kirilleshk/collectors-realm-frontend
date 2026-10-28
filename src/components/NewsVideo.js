import React, { useState } from 'react'
import { Video, ResizeMode } from 'expo-av'
import NewsVideoCover from './NewsVideoCover'

// Видео поста в «Новостях», приложение: сначала обложка, по нажатию — плеер
// expo-av (в ленте до 20 роликов, не грузим их все сразу). Веб — NewsVideo.web.js.
export default function NewsVideo({ video, style, onError }) {
  const [started, setStarted] = useState(false)
  if (!started) return <NewsVideoCover video={video} style={style} onPress={() => setStarted(true)} />
  return (
    <Video
      source={{ uri: video.url }}
      style={[{ backgroundColor: '#000' }, style]}
      resizeMode={ResizeMode.CONTAIN}
      useNativeControls
      shouldPlay
      onError={onError}
    />
  )
}
