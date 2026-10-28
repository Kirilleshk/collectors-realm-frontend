import React, { useState } from 'react'
import { View, Text, Image, TouchableOpacity, StyleSheet, Linking, useWindowDimensions } from 'react-native'
import PhotoViewer from './PhotoViewer'
import NewsVideo from './NewsVideo'
import NewsVideoCover from './NewsVideoCover'

const THUMBS = 4 // миниатюр под главным фото альбома; остальные — «+N»

// Фото и видео поста в «Новостях» (Марк, 22.10.2026: видео показывалось одним
// кадром, из альбома — только первое фото). item.media приходит с бэкенда
// (news.routes.ts); ответ без media (старый бэкенд) — одна картинка imageUrl.
// Размеры — от ширины колонки: width 100% + пропорции фото/видео, не выше 70%
// экрана (иначе вертикальное видео на ПК не помещается).
export default function NewsMedia({ item }) {
  const { height } = useWindowDimensions()
  const maxHeight = Math.round(height * 0.7)
  const media = item.media?.length ? item.media : item.imageUrl ? [{ type: 'photo', url: item.imageUrl }] : []
  const photos = media.filter(m => m.type === 'photo' && m.url)
  const videos = media.filter(m => m.type === 'video')

  if (!photos.length && !videos.length) return null

  return (
    <View style={s.wrap}>
      {videos.map((v, i) => (
        <VideoBlock key={i} video={v} postUrl={item.url} style={{ width: '100%', aspectRatio: v.ratio || 16 / 9, maxHeight }} />
      ))}
      {photos.length > 0 && <Photos photos={photos} maxHeight={maxHeight} />}
    </View>
  )
}

function VideoBlock({ video, postUrl, style }) {
  const [failed, setFailed] = useState(false)
  if (video.url && !failed) return <NewsVideo video={video} style={style} onError={() => setFailed(true)} />
  return <NewsVideoCover video={video} style={style} label="Смотреть в Telegram" onPress={() => Linking.openURL(postUrl).catch(() => {})} />
}

// Главное фото во всю ширину + ряд миниатюр альбома; нажатие — на весь экран
function Photos({ photos, maxHeight }) {
  const [viewerIndex, setViewerIndex] = useState(null)
  const rest = photos.slice(1, 1 + THUMBS)
  const extra = photos.length - 1 - THUMBS

  return (
    <View style={s.wrap}>
      <TouchableOpacity activeOpacity={0.9} onPress={() => setViewerIndex(0)}>
        <Image source={{ uri: photos[0].url }} style={{ width: '100%', aspectRatio: photos[0].ratio || 4 / 3, maxHeight }} resizeMode="cover" />
      </TouchableOpacity>
      {rest.length > 0 && (
        <View style={s.thumbRow}>
          {/* всегда THUMBS ячеек — миниатюры одного размера при любом числе фото */}
          {Array.from({ length: THUMBS }, (_, i) => rest[i] ? (
            <TouchableOpacity key={i} style={s.thumbCell} activeOpacity={0.85} onPress={() => setViewerIndex(i + 1)}>
              <Image source={{ uri: rest[i].url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              {i === THUMBS - 1 && extra > 0 && (
                <View style={s.more}><Text style={s.moreText}>+{extra}</Text></View>
              )}
            </TouchableOpacity>
          ) : <View key={i} style={s.thumbCell} />)}
        </View>
      )}
      {viewerIndex != null && (
        <PhotoViewer photos={photos.map(p => p.url)} initialIndex={viewerIndex} onClose={() => setViewerIndex(null)} />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { gap: 2 },
  thumbRow: { flexDirection: 'row', gap: 2 },
  thumbCell: { flex: 1, aspectRatio: 1, maxHeight: 130, overflow: 'hidden' },
  more: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center' },
  moreText: { color: 'white', fontSize: 20, fontWeight: '700' },
})
