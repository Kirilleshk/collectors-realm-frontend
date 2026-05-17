import { Platform } from 'react-native'
import * as ImagePicker from 'expo-image-picker'

const CLOUD_NAME = 'dqutmb1rm'
const UPLOAD_PRESET = 'collectors_realm'
const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`

export async function pickAndUploadPhoto({ aspect = [1, 1] } = {}) {
  if (Platform.OS === 'web') {
    return webPick()
  }
  return mobilePick(aspect)
}

function webPick() {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    // Скрываем через позицию — display:none и маленькие размеры ломают iOS Safari
    input.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:100px;height:100px;opacity:0;'
    document.body.appendChild(input)

    let settled = false
    function done(value) {
      if (settled) return
      settled = true
      try { document.body.removeChild(input) } catch {}
      resolve(value)
    }

    input.onchange = async (e) => {
      const file = e.target.files?.[0]
      if (!file) return done(null)
      try {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('upload_preset', UPLOAD_PRESET)
        const r = await fetch(CLOUDINARY_URL, { method: 'POST', body: fd })
        const d = await r.json()
        done(d.secure_url || null)
      } catch {
        done(null)
      }
    }

    // НЕ вешаем oncancel — на iOS Safari он срабатывает при открытии пикера
    // и убирает input из DOM, из-за чего медиатека мгновенно закрывается.
    // Если пользователь закрыл без выбора — спиннер остановится при следующем
    // нажатии (вызов load() сбрасывает состояние).

    // Небольшая задержка: даём React завершить ре-рендер до открытия пикера
    setTimeout(() => input.click(), 50)
  })
}

async function mobilePick(aspect) {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (status !== 'granted') return null

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'images',
    allowsEditing: true,
    aspect,
    quality: 0.8,
  })
  if (result.canceled) return null

  try {
    const fd = new FormData()
    fd.append('file', { uri: result.assets[0].uri, type: 'image/jpeg', name: 'photo.jpg' })
    fd.append('upload_preset', UPLOAD_PRESET)
    const r = await fetch(CLOUDINARY_URL, { method: 'POST', body: fd })
    const d = await r.json()
    return d.secure_url || null
  } catch {
    return null
  }
}
