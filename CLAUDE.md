# Collector's Realm — Claude Code Context

Мобильное приложение для коллекционеров фигурок на React Native/Expo.

## Стандарты работы Claude

- **Код:** писать как лучший программист — ставить каждое решение под сомнение, проверять на баги минимум 3 раза перед выводом, всегда думать как сделать лучше.
- **Ответы:** перед финальным ответом на любую задачу — пересмотреть его 3 раза, убедиться что решение оптимальное, поставить под сомнение и улучшить.
- **После завершения работы за сессию** — заносить в [HANDOFF.md](HANDOFF.md) краткую запись о том, что было сделано: что именно, в каких файлах, дата.
- **Изменения кода** — после каждого `git push` сразу (не откладывая до конца сессии) дописывать краткий итог в конец [HANDOFF.md](HANDOFF.md).
- **Важная инфа от пользователя** (пароли, ключи, доступы, решения, договорённости) — если пользователь дал что-то, что стоит помнить в будущих сессиях, спросить, нужно ли занести это в CLAUDE.md (или в память), а не просто использовать один раз.

## Запуск проекта

```powershell
cd E:\MyProgect\collectors-realm
npx expo start --web --clear
```

## Технический стек

- **Фронтенд:** React Native + Expo SDK 54, хостится на **Cloudflare Workers**
  (`holy-grass-59e8.ksele52.workers.dev`) — деплой **ручной**:
  `npm run deploy` (= `expo export --platform web` + `wrangler deploy`).
  Пуш в GitHub сам по себе прод НЕ обновляет.
- **Бэкенд:** Node.js + TypeScript + Prisma + PostgreSQL (GitHub → Render.com,
  **автодеплой** при пуше в main).
- **БД:** PostgreSQL на **Supabase** (eu-west-1 Ireland, Free план, бессрочно)
- **Фото:** Cloudinary (unsigned upload)
- **Навигация:** React Navigation (Stack + Bottom Tabs)
- **Карточная игра** (вкладка «Игра») — своя мини-подсистема поверх того же
  стека: `react-native-gesture-handler` (drag-to-attack на столе боя),
  `react-native-svg` (карта-путь уровней), `expo-screen-orientation`
  (landscape-lock только в бою).

## Важные константы

```javascript
API           = 'https://collectors-realm-backend.onrender.com/api'
FRONTEND_URL  = 'https://holy-grass-59e8.ksele52.workers.dev'
CLOUD_NAME    = 'dqutmb1rm'
UPLOAD_PRESET = 'collectors_realm'   // unsigned
PROJECT_ID    = 'ee592544-47bd-4d06-8f93-0070a93efe36'
EXPO_ACCOUNT  = 'kirill24125'
SERVICE_ID    = 'srv-d7hlnhfaqgkc739da4p0'  // Render сервис
```

## Тестовые аккаунты

```
Обычный : kirill@test.com  / password123   (роль COLLECTOR — им же прогоняются все живые проверки боя/наград)
Админ   : ksele52@gmail.com / см. приватную память Claude (НЕ в этом файле — репозиторий публичный на GitHub)
```

Доступ к вкладке «Админ»: `user?.roles?.includes('ADMIN'|'ANALYTICS'|'MODERATOR')` (`App.js`) — проверка по роли из JWT, не по email. (Уточнено 25.08.2026 — раньше здесь была устаревшая запись про проверку по подстроке email, в актуальном коде её уже нет.) Бэкенд отдельно проверяет ту же роль для стафф-эндпоинтов (`/api/cards/admin/*` и т.п.).

## Структура фронтенда

```
collectors-realm/
├── App.js                   ← Навигация (см. «Навигация» ниже)
├── app.json                 ← Конфиг Expo + EAS
├── eas.json                 ← Конфиг сборки Android/iOS
├── wrangler.jsonc           ← Конфиг Cloudflare Workers (деплой фронтенда)
└── src/
    ├── api.js               ← axios + auth/products/wishlist/users/cards/library/...
    ├── AuthContext.js       ← user, token, login, register, logout, updateUser
    ├── notifications.js     ← Expo Push Notifications
    ├── theme.js             ← bg, surface, surface2, text, text2, accent, border, blue, purple, green
    ├── screens/
    │   ├── LoginScreen.js          ← Вход + регистрация (анкета коллекционера, мин. 3 фото)
    │   ├── ShopScreen.js           ← Магазин: фото, поиск, фильтры, аукцион
    │   ├── ProductDetailScreen.js  ← Карточка товара, галерея, ставки, Telegram/WhatsApp/Max
    │   ├── AdminScreen.js          ← вкладки Товары/Люди/Чат/Игра (ADMIN+MODERATOR),
    │   │                              Релизы (только ADMIN), Статистика (+ ANALYTICS)
    │   ├── ProfileScreen.js        ← Профиль: аватар, роли, геолокация, портфолио-коллекции
    │   ├── UserProfileScreen.js    ← Публичный профиль (портфолио read-only)
    │   ├── MapScreen.js / .web.js  ← Leaflet (react-leaflet веб / WebView мобайл), радиус 5/20км
    │   ├── MyItemsScreen.js        ← вкладка «Моё» — переключатель Коллекция/Вишлист
    │   ├── CollectionScreen.js     ← Моя коллекция
    │   ├── WishlistScreen.js       ← Вишлист с приоритетами
    │   ├── LibraryScreen.js        ← Библиотека знаний гик-культуры (Groq + Wikipedia)
    │   ├── ChatScreen.js           ← Чат с продавцом (единый тред с саппортом)
    │   ├── NotificationsScreen.js  ← Уведомления
    │   ├── ReleasesScreen.js       ← Анонсы релизов
    │   ├── GameScreen.js           ← Коллекция карт темы + вход в бой
    │   ├── LevelSelectScreen.js    ← Карта-путь лестницы боссов
    │   └── BattleScreen.js         ← Экран боя (стол, рука, атака drag-to-target)
    ├── components/
    │   ├── BrandHeader.js          ← Плашка бренда на всех вкладках
    │   ├── ScreenBackground.js     ← Общий атмосферный градиент-фон экранов
    │   └── battle/                 ← BoardSlot, HandCard, BossBanner, CardZoomModal,
    │                                  DamagePopup, DeckPile, HpBar, LogEntry
    └── utils/
        ├── uploadPhoto.js          ← Загрузка фото (web + mobile)
        ├── SmartInput.js           ← TextInput с автоскроллом на web
        ├── analytics.js            ← track() — отправка событий аналитики
        ├── WhatsNewModal.js        ← Модал "Что нового" при обновлении
        ├── changelog.js            ← История версий (ОБНОВЛЯТЬ ПРИ КАЖДОМ РЕЛИЗЕ)
        ├── OnboardingTour.js       ← Тур по вкладкам (один раз за аккаунт)
        ├── LocationRequiredModal.js← Запрос геолокации при входе (со skip)
        ├── HowToPlayModal.js       ← «Как играть» в карточной игре
        ├── cardArt.js              ← RARITY, CardImage, бейджи маны/атаки/HP
        ├── StarterPackModal.js     ← Стартовый набор карт (10 шт)
        └── RewardModal.js          ← Награда за победу над боссом
```

## Навигация (App.js)

```
RootNav
├── Login (не авторизован)
└── Main → MainTabs
    ├── Магазин → ShopStack (ShopList → ProductDetail / Chat / Notifications / UserProfile / Releases / Library)
    ├── Карта   → MapStack (MapMain → UserProfileMap)
    ├── Моё     → MyItemsScreen (Коллекция / Вишлист, переключатель внутри)
    ├── Игра    → GameStack (GameMain → LevelSelect → Battle) — вкладка скрывается флагом SHOW_GAME
    ├── Админ   → только если роль ADMIN/ANALYTICS/MODERATOR (условный таб)
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
MODERATOR     → ограниченная админка для Марка: «Товары», «Люди» (блокировка),
                «Чат» (поддержка + удаление сообщений), «Игра», «Статистика».
                Без доступа только к «Релизы» (зона Кирилла, проверено в
                AdminScreen.js — `isAdmin`-only таб, остальные `isStaff`)
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

Route-файлы в `collectors-realm-backend/src/routes/` (актуальный список
эндпоинтов внутри каждого — точнее смотреть сам файл, здесь только карта,
куда идти):

```
auth.routes.ts        send-code/verify-code, register, login,
                       forgot-password/reset-password
users.routes.ts        GET / (карта), /me, /:id; PUT /me; POST /me/avatar,
                       /me/fcm-token; PATCH /:id/badge, /:id/block (staff)
products.routes.ts     CRUD, PATCH /:id/status, /:id/sold, GET/POST /:id/bids
                       (аукцион)
wishlist.routes.ts     CRUD (name, priority, comment, originalName,
                       characterRu, manufacturer, releaseDate)
collection.routes.ts   CRUD личной коллекции (CollectionItem)
portfolio-collections  CRUD «работ» мастера (фото+описание), /me и /user/:id
reviews.routes.ts      GET/POST/DELETE /:userId — отзывы между коллекционерами
releases.routes.ts     GET / — анонсы релизов
notifications.routes   GET /, PATCH /:id/read, /read-all, POST /trigger-report
support.routes.ts      чат «связь с администрацией» ↔ SupportMessage,
                       /conversations и /:userId/reply — для staff
analytics.routes.ts    POST / (событие), GET /summary (staff)
news.routes.ts         GET / — витрина новостей
markBot.routes.ts      GET/PATCH /notes, POST /send, POST /webhook — Telegram-
                       бот задач Марка (см. «Важные заметки» ниже)
library.routes.ts      GET /article (Groq+Wikipedia, кеш), /suggest, /recent,
                       /admin-coverage, POST /batch-generate (staff)
cards.routes.ts        карточная игра — themes, bosses, battle/start,
                       /:id/play, /:id/attack, /:id/activate, /:id/end-turn,
                       admin/all, admin/stats (staff)
```

## Схема БД (Prisma)

Много моделей в `collectors-realm-backend/prisma/schema.prisma` — точные поля
смотреть там (число моделей будет расти, не фиксирую здесь), здесь только
ключевые enum'ы и группы моделей:

```prisma
enum UserRole      { COLLECTOR, MASTER_REPAIR, CUSTOMIZER, DIORAMA, ADMIN, ANALYTICS, MODERATOR }
enum Condition     { NEW, USED }
enum ProductStatus { AVAILABLE, SOLD, PREORDER, RESERVED, NEGOTIABLE }
enum Priority      { HIGH, MEDIUM, LOW }
enum CardRarity    { COMMON, EPIC, SILVER, GOLD }
enum CardFaction   { ALIEN, PREDATOR }
```

Группы моделей:
- **Маркетплейс:** `User` (роли[], геолокация, анкета коллекционера —
  age/collectorTypes/collectingSinceYears/favoriteFranchise/favoriteCharacter,
  isBlocked, onboardingSeen), `Product` (+ аукцион isAuction/startPrice/
  priceStep/auctionEndTime), `ProductImage`, `Bid`, `WishlistItem`,
  `CollectionItem`, `Review`, `Notification`, `Release`, `ReleaseReminder`
- **Профиль/портфолио:** `PortfolioPhoto`, `PortfolioCollection` +
  `PortfolioCollectionPhoto` (работы мастера с описанием)
- **Карточная игра** («Игра», см. отдельный раздел ниже про арт): `CardTheme`,
  `Boss` (лестница внутри темы, `order` + пассивка regen/mana_drain/enrage),
  `UserBossProgress`, `Card`, `UserCard`, `Battle` (JSON-колонки для стола/
  руки/колоды — вся боевая механика живёт в `cards.routes.ts`)
- **Библиотека знаний:** `LibraryArticle` (кеш по slug), `LibrarySearchLog`
- **Саппорт/задачи:** `SupportMessage` (чат с администрацией),
  `MarkNote` (заметки Telegram-бота Марка) + `MarkNoteType`/`MarkNoteStatus`
- **Служебное:** `AnalyticsEvent`

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
2. **Миграции БД** — часто без файлов миграции: стартап-скрипты в
   `src/startup/*.ts` (подключены в `index.ts`) сами приводят БД в нужное
   состояние при каждом старте сервера — предпочтительный способ в этом
   проекте вместо ручных SQL-шагов в Supabase (легко забыть выполнить).
3. **Карта** — react-leaflet (веб, `MapScreen.web.js`) и WebView+Leaflet
   (мобайл, `MapScreen.js`). Маркеры кликабельны → карточка пользователя,
   кнопки радиуса 5/20км.
4. **Push-уведомления** — не работают в Expo Go, нужен development build.
5. **Telegram-бот задач Марка** (`@collectors_realm_tasks_bot`) — Марк пишет
   туда текстом/голосом, бэкенд сохраняет в `MarkNote` (расшифровка голоса
   через Groq Whisper). Проверять при «что у нас по задачам» —
   `GET /api/mark-bot/notes` с заголовком `x-bot-secret` (значение — в
   `.env`/Render env, не в этом файле). Закрывать статус `DONE` только
   после реальной проверки на проде, не раньше.

## Известные проблемы

- Render Free: первый запрос после простоя — 50+ сек (сервис засыпает)

## Открытые задачи

Статичный список задач клиента здесь регулярно устаревал (пункты
числились «не начато»/«заблокировано» уже давно после того, как были
сделаны) — источник правды по задачам Марка теперь только
`GET /api/mark-bot/notes` (см. «Важные заметки» выше), а не этот файл.
Из старого списка Кирилла остаётся не закрытым только один пункт:

- ⏳ **Вход через ВКонтакте** — нужен VK App ID с dev.vk.com

Чат «Связаться с продавцом» (`ChatScreen.js`) переиспользует
`SupportMessage` с привязкой к товару (`productId`/`productName`) — все
обращения пользователя, включая эти, попадают в один тред с
администрацией/модератором.

## Итоги сессий

Полная история — в [HANDOFF.md](HANDOFF.md) (не грузится в контекст
автоматически, читать по запросу — например, свериться "а мы это уже
не пытались чинить раньше?"). Раньше эта история копилась прямо здесь и
разрослась до 1500+ строк — 15.09.2026 вынесена целиком, новые записи
дописывать в HANDOFF.md, не сюда.

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

**Лестница боссов** (`Boss`, 21.08.2026, см. HANDOFF.md) — 4 босса внутри
темы с растущим HP и уникальной пассивкой. Боссы #2-4 пока используют
арт-заглушку (портрет «Королевы чужих») — ждут своего уникального арта
от Марка/Кирилла (заметка бота `cmtbsvea2...`, 27.08).

**Пайплайн загрузки:** файл из `art-cards/<имя-транслит>.png` → unsigned upload
на Cloudinary (`api.cloudinary.com/v1_1/dqutmb1rm/image/upload`, preset
`collectors_realm`) → SQL `prisma/set-card-images-<дата>.sql` с
`UPDATE "Card" SET "imageUrl" = '...' WHERE name = '...'` → выполнить в
Supabase SQL Editor. Папка `art-cards/` в `.gitignore` — исходники не коммитятся,
итоговые URL уже в БД.

## Ключевые зависимости

Точные версии — в `package.json` (они регулярно уходят вперёд, дублировать
здесь бессмысленно). Библиотеки, о которых стоит помнить, потому что их
использование не всегда очевидно:

- **react-native-gesture-handler** — вся механика атаки в бою (drag
  существо → цель) построена на `Gesture.Pan()`, не на `onPress`
  (см. `BattleScreen.js`, `makeAttackDrag`).
- **react-native-svg** — карта-путь лестницы боссов (`LevelSelectScreen.js`).
- **expo-screen-orientation** — landscape-lock включается ТОЛЬКО в
  `BattleScreen.js`, остальные экраны — свободный поворот.
- **react-native-webview** vs **react-leaflet** — карта рендерится по-разному
  на мобайле и вебе (см. `MapScreen.js` / `.web.js`).
- Нет отдельного стейт-менеджера — только React Context (`AuthContext.js`)
  и локальный `useState` на экранах.
