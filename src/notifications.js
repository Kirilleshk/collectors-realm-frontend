import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { Platform } from 'react-native'

const API = 'https://collectors-realm-backend.onrender.com/api'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

export async function registerForPushNotifications(token) {
  if (Platform.OS === 'web') return null

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync()
    let finalStatus = existingStatus

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }

    if (finalStatus !== 'granted') {
      console.log('Нет разрешения на уведомления')
      return null
    }

    const pushTokenData = await Notifications.getExpoPushTokenAsync({
      projectId: 'ee592544-47bd-4d06-8f93-0070a93efe36'
    })

    const pushToken = pushTokenData.data
    console.log('Push token получен:', pushToken)

    if (token && pushToken) {
      const res = await fetch(`${API}/users/me/fcm-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ fcmToken: pushToken })
      })
      const data = await res.json()
      console.log('Токен сохранён:', data)
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#E04E28',
      })
    }

    return pushToken
  } catch (e) {
    console.log('Ошибка регистрации уведомлений:', e.message)
    return null
  }
}

export async function sendLocalNotification(title, body, data = {}) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data, sound: true },
    trigger: null,
  })
}