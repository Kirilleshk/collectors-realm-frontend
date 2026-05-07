# Collector's Realm — Claude Code Context

Мобильное приложение для коллекционеров фигурок на React Native/Expo.

## Запуск проекта

```powershell
cd C:\Users\ksele\collectors-realm
npx expo start --web --clear
```

## Технический стек

- **Фронтенд:** React Native + Expo SDK 54
- **Бэкенд:** Node.js + TypeScript + Prisma + PostgreSQL (GitHub → Render.com, auto-deploy)
- **БД:** PostgreSQL на Render (Oregon, Free план — засыпает через 15 мин)
- **Фото:** Cloudinary (unsigned upload)
- **Навигация:** React Navigation (Stack + Bottom Tabs)

## Важные константы

```javascript
API           = 'https://collectors-realm-backend.onrender.com/api'
CLOUD_NAME    = 'dqutmb1rm'
UPLOAD_PRESET = 'collectors_realm'   // unsigned
PROJECT_ID    = 'ee592544-47bd-4d06-8f93-0070a93efe36'
EXPO_ACCOUNT  = 'kirill24125'
SERVICE_ID    = 'srv-d7hlnhfaqgkc739da4p0'  // Render сервис
```

## Тестовые аккаунты

```
Обычный : kirill@test.com  / password123
Админ   : admin@test.com   / admin123
```

Доступ к AdminScreen: `user?.email?.includes('admin') || user?.email?.includes('kirill')`

## Структура фронтенда

```
collectors-realm/
├── App.js                   ← Навигация (ShopStack, MapStack, MainTabs)
├── app.json                 ← Конфиг Expo + EAS
├── eas.json                 ← Конфиг сборки Android/iOS
└── src/
    ├── api.js               ← axios + auth/products/wishlist/users
    ├── AuthContext.js       ← user, token, login, register, logout, updateUser
    ├── notifications.js     ← Expo Push Notifications
    ├── theme.js             ← bg, surface, surface2, text, text2, accent, border, blue, purple, green
    └── screens/
        ├── LoginScreen.js          ← Вход + регистрация (4 роли-карточки)
        ├── ShopScreen.js           ← Магазин: фото, поиск, фильтры
        ├── ProductDetailScreen.js  ← Карточка товара, галерея, Telegram/WhatsApp/Max
        ├── AdminScreen.js          ← CRUD товаров, смена статуса
        ├── ProfileScreen.js        ← Профиль: аватар, роли, геолокация, портфолио
        ├── UserProfileScreen.js    ← Публичный профиль пользователя
        ├── MapScreen.js            ← Leaflet (iframe веб / WebView мобайл), фильтры ролей
        ├── WishlistScreen.js       ← Вишлист с приоритетами
        ├── ChatScreen.js           ← Чат с продавцом
        └── NotificationsScreen.js  ← Уведомления
```

## Навигация (App.js)

```
RootNav
├── Login (не авторизован)
└── Main → MainTabs
    ├── Магазин → ShopStack (ShopList → ProductDetail → Chat / Notifications / UserProfile)
    ├── Карта  → MapStack (MapMain → UserProfileMap)
    ├── Вишлист
    ├── Админ
    └── Профиль
```

## Роли пользователей

```
COLLECTOR     → Коллекционер      🗿  синий
MASTER_REPAIR → Мастер по ремонту 🔧  accent/оранжевый
CUSTOMIZER    → Кастомизатор      🎨  фиолетовый
DIORAMA       → Мастер диорам     🏔  зелёный
ADMIN         → только на бэкенде
```

## Статусы товаров

```
AVAILABLE  → Доступен      зелёный  #34C759
SOLD       → Продан        серый    #8E8E93
PREORDER   → Предзаказ     синий    #007AFF
RESERVED   → Резерв        оранжевый #FF9500
NEGOTIABLE → Торг уместен  фиолетовый #AF52DE
```

## API эндпоинты

### Авторизация
```
POST /api/auth/login     { email, password } → { token, user }
POST /api/auth/register  { name, email, password, roles[] } → { token, user }
```

### Товары
```
GET    /api/products
GET    /api/products/:id
POST   /api/products           { ...fields, imageUrls[] }
PUT    /api/products/:id
PATCH  /api/products/:id/status  { status }
DELETE /api/products/:id
```

### Пользователи
```
GET  /api/users           все пользователи (карта)
GET  /api/users/me        мой профиль (include portfolioPhotos)
GET  /api/users/:id       публичный профиль
PUT  /api/users/me        { name, city, bio, roles, latitude, longitude, avatarUrl }
POST /api/users/me/avatar
POST /api/users/me/fcm-token
```

### Вишлист
```
GET    /api/wishlist
POST   /api/wishlist        { name, priority, comment }
PUT    /api/wishlist/:id
DELETE /api/wishlist/:id
```

## Схема БД (Prisma)

```prisma
enum UserRole      { COLLECTOR, MASTER_REPAIR, CUSTOMIZER, DIORAMA, ADMIN }
enum Condition     { NEW, USED }
enum ProductStatus { AVAILABLE, SOLD, PREORDER, RESERVED, NEGOTIABLE }
enum Priority      { HIGH, MEDIUM, LOW }

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
model ProductImage   { id, url, productId, order }
model WishlistItem   { id, userId, name, priority, comment }
model PortfolioPhoto { id, url, userId, order }
```

## Загрузка фото (Cloudinary)

```javascript
const fd = new FormData()
fd.append('file', { uri: result.assets[0].uri, type: 'image/jpeg', name: 'photo.jpg' })
fd.append('upload_preset', 'collectors_realm')
const r = await fetch('https://api.cloudinary.com/v1_1/dqutmb1rm/image/upload', { method: 'POST', body: fd })
const d = await r.json()
// d.secure_url — итоговый URL
```

## Авторизация

```javascript
// AsyncStorage хранит токен и данные пользователя
// AuthContext: user, token, loading, login, register, logout, updateUser
// updateUser(data) — обновляет user в памяти и AsyncStorage без запроса к серверу
```

## Важные заметки

1. **Бэкенд на GitHub** — изменения через GitHub, Render деплоит автоматически при push в main.
2. **Миграции БД** — создавать в `prisma/migrations/` на GitHub, файл `migration.sql`.
3. **Статусы PREORDER/RESERVED/NEGOTIABLE** — добавлены в schema.prisma, могут не применились в БД — нужна SQL миграция.
4. **Карта** — Leaflet через iframe (веб) и WebView (мобайл). Маркеры кликабельны → карточка пользователя.
5. **Push-уведомления** — не работают в Expo Go, нужен development build.

## Известные проблемы

- Render Free: первый запрос 50+ сек (засыпает)
- react-native-webview 13.16.1 вместо 13.15.0 — не критично
- Веб-версия: карточки немного растянуты

## Задачи клиента (приоритет по порядку)

1. ✅ **Клавиатура загораживает экран** — KeyboardAvoidingView во всех экранах с вводом
2. ✅ **Кнопки телефона пересекаются** — SafeAreaView + useSafeAreaInsets в tabBarStyle
3. ✅ **Статус товара не меняется на Android** — исправлен products.routes.ts + SQL миграция enum
4. ✅ **Обязательное фото при регистрации** — двухшаговая регистрация, мин. 1 фото
5. ✅ **Расширить вишлист** — поля: originalName, characterRu, manufacturer, releaseDate
6. ✅ **Коллекционеры поблизости** — кнопки 5км/20км в MapScreen, Haversine, кружок радиуса
7. ✅ **Аукцион** — таймер, ставки, бейдж АУКЦИОН, бэкенд endpoints
8. ⏳ **Вход через ВКонтакте** — нужен VK App ID с dev.vk.com

## Ключевые зависимости

```json
"expo": "~54.0.33",
"react-native": "0.76.7",
"@react-navigation/native": "^6.x",
"expo-image-picker": "~55.0.14",
"expo-location": "~18.0.10",
"expo-notifications": "~0.32.16",
"react-native-webview": "13.16.1",
"react-native-maps": "^1.x",
"react-leaflet": "^4.x",
"axios": "^1.x"
```
