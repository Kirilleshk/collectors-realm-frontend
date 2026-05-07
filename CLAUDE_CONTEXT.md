# Collector's Realm — Контекст проекта для Claude Code

## О проекте
Мобильное приложение для коллекционеров фигурок на React Native/Expo.
Мы работали над этим проектом долгое время и ты продолжаешь разработку.

---

## Пути к файлам
- **Фронтенд:** `C:\Users\ksele\collectors-realm`
- **Бэкенд (GitHub):** https://github.com/Kirilleshk/collectors-realm-backend

## Запуск проекта
```powershell
cd C:\Users\ksele\collectors-realm
npx expo start --web --clear
```

---

## Технический стек
- **Фронтенд:** React Native + Expo (SDK 54)
- **Бэкенд:** Node.js + TypeScript + Prisma + PostgreSQL
- **Хостинг бэкенда:** Render.com (Free план, засыпает через 15 мин)
- **База данных:** PostgreSQL на Render (Oregon)
- **Хранение фото:** Cloudinary
- **Навигация:** React Navigation (Stack + Bottom Tabs)

---

## Важные константы

```javascript
// Бэкенд
API = 'https://collectors-realm-backend.onrender.com/api'

// Cloudinary
CLOUD_NAME = 'dqutmb1rm'
UPLOAD_PRESET = 'collectors_realm'  // unsigned

// Expo
PROJECT_ID = 'ee592544-47bd-4d06-8f93-0070a93efe36'
EXPO_ACCOUNT = 'kirill24125'

// Render сервис
SERVICE_ID = 'srv-d7hlnhfaqgkc739da4p0'
```

---

## Тестовые аккаунты
- Обычный: `kirill@test.com` / `password123`
- Админ: `admin@test.com` / `admin123`
- Доступ к AdminScreen: email содержит "admin" или "kirill"

---

## Структура файлов фронтенда

```
collectors-realm/
├── App.js                          ← Навигация (ShopStack, MapStack, MainTabs)
├── app.json                        ← Конфиг Expo + EAS
├── eas.json                        ← Конфиг сборки Android/iOS
├── src/
│   ├── api.js                      ← axios инстанс + auth/products/wishlist/users
│   ├── AuthContext.js              ← Контекст авторизации (user, token, login, register, logout, updateUser)
│   ├── notifications.js            ← Expo Push Notifications
│   ├── theme.js                    ← Цвета: bg, surface, surface2, text, text2, accent, border, blue, purple, green
│   └── screens/
│       ├── LoginScreen.js          ← Вход + регистрация с выбором роли (4 карточки)
│       ├── ShopScreen.js           ← Магазин с фото, поиском, фильтрами (Все/Новые/Б/у/Предзаказ/Резерв/Торг/Продано)
│       ├── ProductDetailScreen.js  ← Карточка товара, фото галерея, Telegram/WhatsApp/Max
│       ├── AdminScreen.js          ← Добавление/редактирование/удаление товаров, смена статуса
│       ├── ProfileScreen.js        ← Профиль: аватар, роли, геолокация, портфолио мастеров
│       ├── UserProfileScreen.js    ← Публичный профиль другого пользователя
│       ├── MapScreen.js            ← Карта Leaflet (iframe веб + WebView мобайл), фильтры по ролям
│       ├── WishlistScreen.js       ← Список желаний с приоритетами
│       ├── ChatScreen.js           ← Чат с продавцом
│       └── NotificationsScreen.js  ← Уведомления
```

---

## Роли пользователей
```javascript
COLLECTOR    → 'Коллекционер'    🗿  (синий)
MASTER_REPAIR → 'Мастер по ремонту' 🔧 (accent/оранжевый)
CUSTOMIZER   → 'Кастомизатор'   🎨  (фиолетовый)
DIORAMA      → 'Мастер диорам'  🏔  (зелёный)
ADMIN        → только на бэкенде
```

## Статусы товаров
```javascript
AVAILABLE  → 'Доступен'     (зелёный)
SOLD       → 'Продан'       (серый)
PREORDER   → 'Предзаказ'    (синий #007AFF)
RESERVED   → 'Резерв'       (оранжевый #FF9500)
NEGOTIABLE → 'Торг уместен' (фиолетовый #AF52DE)
```

---

## API эндпоинты бэкенда

### Авторизация
```
POST /api/auth/login       → { email, password } → { token, user }
POST /api/auth/register    → { name, email, password, roles[] } → { token, user }
```

### Товары
```
GET    /api/products           → список товаров (include: images)
GET    /api/products/:id       → товар по ID
POST   /api/products           → создать (imageUrls[])
PUT    /api/products/:id       → обновить (imageUrls[])
PATCH  /api/products/:id/status → { status } — изменить статус
PATCH  /api/products/:id/sold  → пометить продан (обратная совместимость)
DELETE /api/products/:id       → удалить
```

### Пользователи
```
GET  /api/users        → все пользователи (для карты)
GET  /api/users/me     → мой профиль (include: portfolioPhotos)
GET  /api/users/:id    → публичный профиль
PUT  /api/users/me     → обновить (name, city, bio, roles, latitude, longitude, avatarUrl)
POST /api/users/me/avatar    → загрузить аватар
POST /api/users/me/fcm-token → сохранить push-токен
```

### Вишлист
```
GET    /api/wishlist         → мой вишлист
POST   /api/wishlist         → { name, priority, comment }
PUT    /api/wishlist/:id     → обновить
DELETE /api/wishlist/:id     → удалить
```

---

## Схема базы данных (Prisma)

```prisma
enum UserRole     { COLLECTOR, MASTER_REPAIR, CUSTOMIZER, DIORAMA, ADMIN }
enum Condition    { NEW, USED }
enum ProductStatus { AVAILABLE, SOLD, PREORDER, RESERVED, NEGOTIABLE }
enum Priority     { HIGH, MEDIUM, LOW }

model User {
  id, email, phone, passwordHash, name, city
  latitude, longitude, roles[], collectorGrade
  bio, avatarUrl, fcmToken
  wishlist WishlistItem[]
  portfolioPhotos PortfolioPhoto[]
}

model Product {
  id, name, description, price, condition
  status ProductStatus @default(AVAILABLE)
  manufacturer, franchise, character
  images ProductImage[]
}

model ProductImage { id, url, productId, order }
model WishlistItem { id, userId, name, priority, comment }
model PortfolioPhoto { id, url, userId, order }
```

---

## Навигация (App.js)

```
RootNav
├── Login (если не авторизован)
└── Main → MainTabs
    ├── Магазин → ShopStack
    │   ├── ShopList
    │   ├── ProductDetail
    │   ├── Chat
    │   ├── Notifications
    │   └── UserProfile
    ├── Карта → MapStack
    │   ├── MapMain
    │   └── UserProfileMap
    ├── Вишлист
    ├── Админ
    └── Профиль
```

---

## Известные проблемы

1. **Render Free план** — бэкенд засыпает, первый запрос занимает 50+ секунд
2. **Push-уведомления** — не работают в Expo Go, нужен development build
3. **Веб-версия** — карточки товаров немного растянуты (на iPhone норм)
4. **react-native-webview** — версия 13.16.1 (ожидается 13.15.0) — не критично

---

## ✅ Что полностью готово

- [x] Регистрация с выбором роли (4 роли в виде карточек)
- [x] Вход по email/паролю
- [x] Магазин с фото (Cloudinary), поиском, фильтрами по состоянию и статусу
- [x] Карточка товара с галереей фото, характеристиками
- [x] Кнопки связи: Telegram, WhatsApp, Max (с предзаполненным сообщением)
- [x] Вишлист с приоритетами
- [x] Карта пользователей (Leaflet) с фильтрами по ролям
- [x] Геолокация — кнопка "Указать моё местоположение" в профиле
- [x] Профиль: аватар, имя, город, bio, роли, портфолио (до 5 фото для мастеров)
- [x] Публичные профили пользователей
- [x] Переход карта → публичный профиль
- [x] Админка: добавление/редактирование/удаление товаров, смена статуса
- [x] Фото товаров через Cloudinary (до 5 фото)
- [x] Статусы: Доступен/Продан/Предзаказ/Резерв/Торг уместен
- [x] Push-уведомления (код готов, работает на реальном устройстве)
- [x] Android APK собран и отправлен клиенту

---

## 🔴 Задачи от клиента (приоритет по порядку)

### 1. Клавиатура загораживает экран (ВЫСОКИЙ)
Добавить `KeyboardAvoidingView` во все экраны с полями ввода:
- LoginScreen.js (уже есть, проверить)
- WishlistScreen.js
- AdminScreen.js (модал добавления товара)
- ProfileScreen.js (модал редактирования)

### 2. Кнопки телефона пересекаются с кнопками приложения (ВЫСОКИЙ)
- Добавить `SafeAreaView` из `react-native-safe-area-context`
- Увеличить `paddingBottom` в `tabBarStyle` в `App.js`
- Добавить отступы снизу во всех экранах

### 3. Статус товара не меняется на Android (ВЫСОКИЙ)
- Проверить что миграция базы данных применилась (PREORDER, RESERVED, NEGOTIABLE)
- Проверить endpoint `PATCH /api/products/:id/status`
- База данных может не знать новые статусы — нужно выполнить SQL миграцию

### 4. Обязательное фото при регистрации (СРЕДНИЙ)
- В `LoginScreen.js` в режиме регистрации добавить шаг загрузки фото коллекции
- Минимум 1 фото обязательно
- Загрузка через Cloudinary
- Сохранять в `portfolioPhotos` при регистрации

### 5. Расширить вишлист (СРЕДНИЙ)
Текущие поля: name, priority, comment
Добавить поля:
- `originalName` — оригинальное название фигурки
- `characterRu` — название персонажа на русском
- `manufacturer` — фирма изготовитель
- `releaseDate` — дата изготовления
Нужно обновить: WishlistScreen.js + бэкенд (schema.prisma + миграция + routes)

### 6. Коллекционеры поблизости на карте (СРЕДНИЙ)
- Добавить кнопку "Поблизости" в MapScreen.js
- Выбор радиуса: 5км или 20км
- Фильтровать пользователей по расстоянию от текущего местоположения
- Карта автоматически масштабируется под выбранный радиус
- Использовать формулу Haversine для расчёта расстояния

### 7. Аукцион (НИЗКИЙ — большая фича)
Новый тип продажи для товаров:
- Поля: `isAuction`, `startPrice`, `priceStep`, `auctionEndTime` (макс 3 дня)
- Ставки через комментарии (кто последний написал максимальную цену — победитель)
- Бейдж "АУКЦИОН" на карточке товара
- Нужно: новые поля в БД, новые экраны, логика ставок
Требует обновления: schema.prisma, products.routes.ts, AdminScreen.js, ProductDetailScreen.js, ShopScreen.js

### 8. Вход через ВКонтакте (НИЗКИЙ)
- Зарегистрировать приложение на dev.vk.com
- Настроить VK OAuth
- Сохранять VK профиль (имя, аватар)
- Требует: VK App ID, настройки редиректов

---

## Зависимости (package.json — ключевые)
```json
"expo": "~54.0.33",
"react-native": "0.76.7",
"@react-navigation/native": "^6.x",
"@react-navigation/bottom-tabs": "^6.x",
"@react-navigation/native-stack": "^6.x",
"expo-image-picker": "~55.0.14",
"expo-location": "~18.0.10",
"expo-notifications": "~0.32.16",
"expo-device": "~7.0.2",
"react-native-webview": "13.16.1",
"react-native-maps": "^1.x",
"react-leaflet": "^4.x",
"leaflet": "^1.9.x",
"axios": "^1.x",
"@react-native-async-storage/async-storage": "^2.x"
```

---

## Как работает загрузка фото (Cloudinary)
```javascript
// Загрузка фото (unsigned upload)
const fd = new FormData()
fd.append('file', { uri: result.assets[0].uri, type: 'image/jpeg', name: 'photo.jpg' })
fd.append('upload_preset', 'collectors_realm')
const r = await fetch('https://api.cloudinary.com/v1_1/dqutmb1rm/image/upload', { method: 'POST', body: fd })
const d = await r.json()
// d.secure_url — URL загруженного фото
```

## Как работает авторизация
```javascript
// AsyncStorage хранит токен и данные пользователя
// AuthContext предоставляет: user, token, loading, login, register, logout, updateUser
// updateUser(data) — обновляет user в памяти и AsyncStorage без запроса к серверу
```

---

## Важные заметки

1. **Бэкенд на GitHub** — любые изменения в бэкенде делаются через редактирование файлов на GitHub. Render.com автоматически деплоит при push в main.

2. **Миграции БД** — создавать в папке `prisma/migrations/` на GitHub. Файл `migration.sql` с ALTER TYPE командами.

3. **isAdmin проверка** — на фронтенде: `user?.roles?.includes('ADMIN') || user?.email?.includes('admin') || user?.email?.includes('kirill')`

4. **Карта** — использует Leaflet через iframe (веб) и WebView (мобайл). Маркеры кликабельны, при клике открывается карточка пользователя.

5. **Статусы товаров** — PREORDER, RESERVED, NEGOTIABLE добавлены в schema.prisma но могут не применились в БД — нужна SQL миграция.