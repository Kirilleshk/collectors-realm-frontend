import { Platform } from 'react-native'

const API = 'https://collectors-realm-backend.onrender.com/api/analytics'

let _userId = null

export function setAnalyticsUser(id) {
  _userId = id
}

export async function track(event, params = {}) {
  try {
    await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event,
        params,
        platform: Platform.OS,
        userId: _userId,
      }),
    })
  } catch {
    // аналитика не должна ломать приложение
  }
}
