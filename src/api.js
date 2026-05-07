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

const api = axios.create({ baseURL: API_URL })

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
  getById: (id) => api.get(`/users/${id}`),
  update: (data) => api.put('/users/me', data),
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

export const bids = {
  getForProduct: (productId) => api.get(`/products/${productId}/bids`),
  place: (productId, amount) => api.post(`/products/${productId}/bids`, { amount }),
}

export default api