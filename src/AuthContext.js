import React, { createContext, useContext, useState, useEffect, useRef } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'
import { auth } from './api'
import { registerForPushNotifications } from './notifications'
import * as Notifications from 'expo-notifications'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(true)
  const notificationListener = useRef()
  const responseListener = useRef()

  useEffect(() => {
    checkAuth()

    if (Platform.OS !== 'web') {
      notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
        console.log('Уведомление получено:', notification)
      })

      responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
        console.log('Нажатие на уведомление:', response)
      })

      return () => {
        notificationListener.current?.remove()
        responseListener.current?.remove()
      }
    }
  }, [])

  async function checkAuth() {
    try {
      const t = await AsyncStorage.getItem('token')
      const u = await AsyncStorage.getItem('user')
      if (t && u) {
        setToken(t)
        setUser(JSON.parse(u))
        if (Platform.OS !== 'web') {
          registerForPushNotifications(t).catch(console.error)
        }
      }
    } catch (e) {}
    setLoading(false)
  }

  async function login(email, password) {
    const res = await auth.login(email, password)
    const { token: t, user: u } = res.data
    await AsyncStorage.setItem('token', t)
    await AsyncStorage.setItem('user', JSON.stringify(u))
    setToken(t)
    setUser(u)
    if (Platform.OS !== 'web') {
      registerForPushNotifications(t).catch(console.error)
    }
    return u
  }

 async function register(name, email, password, roles = ['COLLECTOR']) {
  const res = await auth.register(name, email, password, roles)
    const { token: t, user: u } = res.data
    await AsyncStorage.setItem('token', t)
    await AsyncStorage.setItem('user', JSON.stringify(u))
    setToken(t)
    setUser(u)
    if (Platform.OS !== 'web') {
      registerForPushNotifications(t).catch(console.error)
    }
    return u
  }

  async function logout() {
    await AsyncStorage.removeItem('token')
    await AsyncStorage.removeItem('user')
    setToken(null)
    setUser(null)
  }

  // Обновить данные пользователя локально
  async function updateUser(newData) {
    const updated = { ...user, ...newData }
    await AsyncStorage.setItem('user', JSON.stringify(updated))
    setUser(updated)
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)