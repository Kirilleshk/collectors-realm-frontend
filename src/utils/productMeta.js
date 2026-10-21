// Категории товара (21.10.2026) — одни подписи для формы объявления,
// фильтров магазина и карточки товара. Значения совпадают с enum
// ProductCategory на бэкенде; у старых товаров категории нет → «Фигурки».
export const CATEGORIES = [
  { value: 'FIGURE', label: 'Фигурки' },
  { value: 'CARDS', label: 'Карточки' },
  { value: 'ACCESSORY', label: 'Аксессуары' },
  { value: 'OTHER', label: 'Другое' },
]

export function categoryLabel(value) {
  return (CATEGORIES.find(c => c.value === value) || CATEGORIES[0]).label
}
