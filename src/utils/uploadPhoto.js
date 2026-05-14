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
    input.onchange = async (e) => {
      const file = e.target.files[0]
      if (!file) return resolve(null)
      try {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('upload_preset', UPLOAD_PRESET)
        const r = await fetch(CLOUDINARY_URL, { method: 'POST', body: fd })
        const d = await r.json()
        resolve(d.secure_url || null)
      } catch {
        resolve(null)
      }
    }
    input.oncancel = () => resolve(null)
    input.click()
  })
}

async function mobilePick(aspect) {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (status !== 'granted') return null

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect,
    quality: 0.8,
  })
  if (result.canceled) return null

  const fd = new FormData()
  fd.append('file', { uri: result.assets[0].uri, type: 'image/jpeg', name: 'photo.jpg' })
  fd.append('upload_preset', UPLOAD_PRESET)
  const r = await fetch(CLOUDINARY_URL, { method: 'POST', body: fd })
  const d = await r.json()
  return d.secure_url || null
}
