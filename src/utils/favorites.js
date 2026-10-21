import { useEffect, useState } from 'react'
import { favorites as favoritesApi } from '../api'
import { showNotice } from './notice'

// Избранное (21.10.2026) — один общий список id на приложение: сердечко
// на карточке в магазине, в карточке товара и вкладка «Моё → Избранное»
// видят одно и то же. Нажатие меняет сердечко сразу (оптимистично), при
// ошибке сервера — откатываем и показываем сообщение.

let ids = new Set()
let loaded = false
const listeners = new Set()

function emit() {
  const copy = new Set(ids)
  listeners.forEach(l => l(copy))
}

export async function loadFavorites() {
  try {
    const res = await favoritesApi.ids()
    ids = new Set(Array.isArray(res.data) ? res.data : [])
    loaded = true
    emit()
  } catch (e) {}
}

// Выход из аккаунта — следующий вошедший не должен видеть чужие сердечки
export function resetFavorites() {
  ids = new Set()
  loaded = false
  emit()
}

export async function toggleFavorite(productId) {
  const had = ids.has(productId)
  if (had) ids.delete(productId); else ids.add(productId)
  emit()
  try {
    if (had) await favoritesApi.remove(productId)
    else await favoritesApi.add(productId)
    showNotice(had ? 'Убрано из избранного' : 'Добавлено в избранное')
  } catch (e) {
    if (had) ids.add(productId); else ids.delete(productId)
    emit()
    showNotice(e.response?.data?.error || 'Не получилось — попробуйте ещё раз', { error: true })
  }
}

// enabled = false (гость) — не ходим на сервер, сердечки пустые
export function useFavorites(enabled = true) {
  const [set, setSet] = useState(ids)
  useEffect(() => {
    listeners.add(setSet)
    if (enabled && !loaded) loadFavorites()
    return () => { listeners.delete(setSet) }
  }, [enabled])
  return set
}
