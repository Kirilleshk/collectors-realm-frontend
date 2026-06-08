import axios from 'axios'
import { Platform } from 'react-native'

const API_URL = 'https://collectors-realm-backend.onrender.com/api'

const getToken = async () => {
  try {
    if (Platform.OS === 'web') return localStorage.getItem('token')
    const AsyncStorage = require('@react-native-async-storage/async-storage').default
    return await AsyncStorage.getItem('token')
  } catch (e) { return null }
}

const api = axios.create({ baseURL: API_URL, timeout: 65000 })

api.interceptors.request.use(async (config) => {
  const token = await getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export const auth = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (name, email, password, roles = ['COLLECTOR']) => api.post('/auth/register', { name, email, password, roles }),
}

export const users = {
  me: () => api.get('/users/me'),
  getAll: () => api.get('/users'),
  getById: (id) => api.get(`/users/${id}`),
  update: (data) => api.put('/users/me', data),
  setBadge: (id, badge) => api.patch(`/users/${id}/badge`, { badge }),
  block: (id, reason) => api.patch(`/users/${id}/block`, { isBlocked: true, blockedReason: reason || null }),
  unblock: (id) => api.patch(`/users/${id}/block`, { isBlocked: false, blockedReason: null }),
}

export const products = {
  getAll: () => api.get('/products'),
  getById: (id) => api.get(`/products/${id}`),
}

export const wishlist = {
  getAll: () => api.get('/wishlist'),
  add: (data) => api.post('/wishlist', data),
  update: (id, data) => api.put(`/wishlist/${id}`, data),
  remove: (id) => api.delete(`/wishlist/${id}`),
}

export const releases = {
  getAll: () => api.get('/releases'),
  create: (data) => api.post('/releases', data),
  update: (id, data) => api.put(`/releases/${id}`, data),
  remove: (id) => api.delete(`/releases/${id}`),
  toggleRemind: (id) => api.post(`/releases/${id}/remind`),
  sendReminders: () => api.post('/releases/send-reminders'),
}

export const reviews = {
  getForUser: (userId) => api.get(`/reviews/${userId}`),
  create: (userId, data) => api.post(`/reviews/${userId}`, data),
  remove: (userId) => api.delete(`/reviews/${userId}`),
}

export const notifications = {
  getAll: () => api.get('/notifications'),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
  triggerReport: (type) => api.post('/notifications/trigger-report', { type }),
}

export const collection = {
  getAll: () => api.get('/collection'),
  add: (data) => api.post('/collection', data),
  update: (id, data) => api.put(`/collection/${id}`, data),
  remove: (id) => api.delete(`/collection/${id}`),
}

export const portfolioCollections = {
  getForUser: (userId) => api.get(`/portfolio-collections/user/${userId}`),
  getMine: () => api.get('/portfolio-collections/me'),
  create: (data) => api.post('/portfolio-collections', data),
  update: (id, data) => api.put(`/portfolio-collections/${id}`, data),
  remove: (id) => api.delete(`/portfolio-collections/${id}`),
  addPhoto: (id, url) => api.post(`/portfolio-collections/${id}/photos`, { url }),
  removePhoto: (id, photoId) => api.delete(`/portfolio-collections/${id}/photos/${photoId}`),
}

export const news = {
  getAll: (params) => api.get('/news', { params }),
}

export const support = {
  getMyMessages: () => api.get('/support'),
  getUnread: () => api.get('/support/unread'),
  sendMessage: (text, product) => api.post('/support', { text, productId: product?.id || null, productName: product?.name || null }),
  getConversations: () => api.get('/support/conversations'),
  getUserMessages: (userId) => api.get(`/support/${userId}`),
  reply: (userId, text) => api.post(`/support/${userId}/reply`, { text }),
  deleteMessage: (id) => api.delete(`/support/message/${id}`),
}

export const game = {
  getThemes:    () => api.get('/cards/themes'),
  getMyCards:   () => api.get('/cards/my'),
  claimStarter: () => api.post('/cards/starter'),
}

export const bids = {
  getForProduct: (productId) => api.get(`/products/${productId}/bids`),
  place: (productId, amount) => api.post(`/products/${productId}/bids`, { amount }),
}

export default api