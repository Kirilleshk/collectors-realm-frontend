# Collector's Realm — Claude Code Context

Мобильное приложение для коллекционеров фигурок на React Native/Expo.

## Стандарты работы Claude

- **Код:** писать как лучший программист — ставить каждое решение под сомнение, проверять на баги минимум 3 раза перед выводом, всегда думать как сделать лучше.
- **Ответы:** перед финальным ответом на любую задачу — пересмотреть его 3 раза, убедиться что решение оптимальное, поставить под сомнение и улучшить.
- **После завершения работы за сессию** — заносить в этот файл (раздел «Задачи клиента» / соответствующий раздел) краткую запись о том, что было сделано: что именно, в каких файлах, дата.

## Запуск проекта

```powershell
cd C:\Users\ksele\collectors-realm
npx expo start --web --clear
```

## Технический стек

- **Фронтенд:** React Native + Expo SDK 54
- **Бэкенд:** Node.js + TypeScript + Prisma + PostgreSQL (GitHub → Render.com, auto-deploy)
- **БД:** PostgreSQL на **Supabase** (eu-west-1 Ireland, Free план, бессрочно)
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
        ├── NotificationsScreen.js  ← Уведомления
        ├── CollectionScreen.js     ← Моя коллекция
        └── ReleasesScreen.js       ← Анонсы релизов
    └── utils/
        ├── uploadPhoto.js          ← Загрузка фото (web + mobile)
        ├── SmartInput.js           ← TextInput с автоскроллом на web
        ├── analytics.js            ← track() — отправка событий аналитики
        ├── WhatsNewModal.js        ← Модал "Что нового" при обновлении
        └── changelog.js            ← История версий (ОБНОВЛЯТЬ ПРИ КАЖДОМ РЕЛИЗЕ)
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
ADMIN         → полная админка (ksele52@gmail.com)
ANALYTICS     → только статистика (для клиента-заказчика)
MODERATOR     → ограниченная админка для Марка: вкладки «Люди» (блокировка),
                «Чат» (поддержка + удаление сообщений), «Статистика».
                Без доступа к «Товары»/«Релизы» (зона Кирилла)
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
enum UserRole      { COLLECTOR, MASTER_REPAIR, CUSTOMIZER, DIORAMA, ADMIN, ANALYTICS }
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
- ✅ Веб-версия: карточки магазина растянуты — исправлено 01.07.2026,
  сетка колонок теперь зависит от ширины экрана (`ShopScreen.js`)

## Задачи клиента (приоритет по порядку)

1. ✅ **Клавиатура загораживает экран** — KeyboardAvoidingView во всех экранах с вводом
2. ✅ **Кнопки телефона пересекаются** — SafeAreaView + useSafeAreaInsets в tabBarStyle
3. ✅ **Статус товара не меняется на Android** — исправлен products.routes.ts + SQL миграция enum
4. ✅ **Обязательное фото при регистрации** — двухшаговая регистрация, мин. 1 фото
5. ✅ **Расширить вишлист** — поля: originalName, characterRu, manufacturer, releaseDate
6. ✅ **Коллекционеры поблизости** — кнопки 5км/20км в MapScreen, Haversine, кружок радиуса
7. ✅ **Аукцион** — таймер, ставки, бейдж АУКЦИОН, бэкенд endpoints
8. ⏳ **Вход через ВКонтакте** — нужен VK App ID с dev.vk.com

## Задачи клиента Марка (по памяти Claude)

1-3. ✅ Внешние ссылки убраны, канал сменён на markeltoys, кнопка TG у Админа убрана
4. ✅ Внутренний чат «Связь с администрацией» (профиль ↔ AdminScreen → вкладка «Чат»)
5. ✅ Расширенная статистика — фронтенд готов (новые за неделю, среднее время,
   популярные разделы); бэкенд требует мерджа `backend-analytics-extra.ts`
6. ✅ Второй админ-аккаунт (роль `MODERATOR`) — блокировка, удаление сообщений,
   кнопка связи у заблокированных. Требует: миграции `MODERATOR` в enum UserRole,
   применения `backend-set-mark-role.sql` (сменить роль аккаунта Марка с ADMIN на MODERATOR)
7. ⏳ Карточная игра «Карты Средиземья» — геймификация, отдельная большая фича

**Чат «Связаться с продавцом»** теперь реальный (раньше был локальный мок):
переиспользует `SupportMessage` с привязкой к товару (`productId`/`productName`),
все обращения попадают в единый тред пользователя с админом/модератором.

## Итоги сессий

**07.07.2026** — задачи из телеграм-бота Марка (`@collectors_realm_tasks_bot`):
- ✅ Редизайн иконок характеристик карты: жизни — зелёный щит, атака — красный
  клинок-ромб, мана — синий круг с магическим свечением/ореолом. Общие
  компоненты `ManaBadge`/`HealthBadge`/`AttackBadge` в `src/utils/cardArt.js`
  (раньше разметка бейджей дублировалась в HandCard/BoardSlot/GameScreen),
  применены во всех трёх местах. Добавлена зависимость `react-native-svg`
  (`expo install`). Проверено в браузере (коллекция, рука, арена боя) —
  рендерится без ошибок.
- ⏳ Отложено по решению Кирилла: доступ Марка к управлению лотами в магазине
  (сейчас `MODERATOR` не видит вкладку «Товары» — осознанное ограничение)
  и «карта не активна, нет изображения» — нужно уточнить у Марка, какая карта.
- ⏳ Отложена полностью: механика колоды (расширение 10→20, заработок карт за
  игровые действия, объединение 3 одинаковых карт в более редкую с улучшенными
  характеристиками) — сам Марк просил проработать её отдельно, детали
  (какие действия дают карты, шансы редкости, бонусы улучшения) не определены.
- Поворот экрана в игре (жалоба Марка от 01.07) — похоже, уже был исправлен
  коммитами 74d4715/1a6dbcf от 02.07, до подтверждения не проверялось повторно.

## Арт карт игры «Карты Средиземья» (нейрогенерация)

Тема пилот — «Чужой против Хищника», 20 карт (10 Чужие + 10 Хищники) + босс
«Королева чужих» + рубашка колоды. Карты создаются и заливаются вручную по одной.

**Инструмент:** Leonardo.ai, модель **Lucid Origin**, режим **Fast**, стиль
**Dynamic**, размер строго **1:1 (квадрат)** — карты везде отображаются как
квадратные превью с обрезкой по центру (`resizeMode: cover` в `cardArt.js`),
другое соотношение сторон обрежет голову/ноги персонажа.

**Стиль промта:** кинематографичный тёмный постер фильма Alien/Predator,
photorealistic, hyper-detailed, без текста/водяных знаков. Шаблон:
`Cinematic dark sci-fi horror movie poster style, <описание существа/сцены>,
photorealistic, hyper-detailed, square 1:1 composition, dramatic <тип света>,
no text, no watermark`.

**Порядок генерации — от редких к простым** (GOLD → SILVER → EPIC → COMMON),
сначала самые ценные/заметные карты. Всего 20 карт: по 6 COMMON / 2 EPIC /
1 SILVER / 1 GOLD на каждую из двух фракций (Чужие/Хищники), см. `seed-cards.ts`
для точной редкости каждой карты.

- ✅ GOLD (2/2): Предалиен, Волк
- ✅ SILVER (2/2): Преторианец, Старейшина
- ✅ EPIC (4/4): Опустошитель, Городской охотник, Дробитель, Супер-хищник
- ✅ COMMON (12/12): все готовы и залиты, включая Берсерк и Сокольник (01.07.2026)

**Все 20 карт + босс «Королева чужих» + рубашка колоды имеют арт** (последние —
Берсерк и Сокольник — залиты 01.07.2026, `prisma/set-card-images-2026-07-01.sql`,
выполнить в Supabase SQL Editor, если ещё не выполнен). Более нет карт без арта
в теме «Чужой против Хищника».

**Пайплайн загрузки:** файл из `art-cards/<имя-транслит>.png` → unsigned upload
на Cloudinary (`api.cloudinary.com/v1_1/dqutmb1rm/image/upload`, preset
`collectors_realm`) → SQL `prisma/set-card-images-<дата>.sql` с
`UPDATE "Card" SET "imageUrl" = '...' WHERE name = '...'` → выполнить в
Supabase SQL Editor. Папка `art-cards/` в `.gitignore` — исходники не коммитятся,
итоговые URL уже в БД.

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
