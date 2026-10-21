# Архитектура фронтенда

## Стек

- React Native + Expo SDK 54, веб-сборка хостится на GitHub Pages (ветка `gh-pages`,
  домен markeltoys.ru, выкладка `npm run deploy` → `scripts/deploy-pages.js`; с 04.10.2026 —
  Cloudflare российские провайдеры режут). Запасной Cloudflare Worker (`wrangler.jsonc`,
  только workers.dev, в РФ заблокирован) — `npm run deploy:cloudflare`. API — напрямую на Render.
- Навигация: React Navigation (Stack + Bottom Tabs).
- Фото: Cloudinary, unsigned upload — см. [src/utils/uploadPhoto.js](../src/utils/uploadPhoto.js).
- Нет отдельного стейт-менеджера — только React Context (`AuthContext.js`)
  и локальный `useState` на экранах.

## Структура

```
collectors-realm/
├── App.js                   ← Навигация (см. ниже)
├── app.json                 ← Конфиг Expo + EAS
├── eas.json                 ← Конфиг сборки Android/iOS
├── scripts/deploy-pages.js  ← Выкладка веб-сборки на GitHub Pages (npm run deploy)
├── wrangler.jsonc           ← Запасной Cloudflare Worker (npm run deploy:cloudflare)
└── src/
    ├── api.js               ← axios + auth/products/wishlist/users/cards/library/...
    ├── AuthContext.js       ← user, token, login, register, logout, updateUser
    ├── notifications.js     ← Expo Push Notifications
    ├── theme.js             ← bg, surface, surface2, text, text2, accent, border, blue, purple, green
    ├── screens/
    │   ├── LoginScreen.js          ← Вход + регистрация (анкета коллекционера, мин. 3 фото)
    │   ├── ShopScreen.js           ← Магазин: «Новости» сверху, поиск, фильтры, аукцион
    │   ├── ProductDetailScreen.js  ← Карточка товара, галерея, ставки; продавец-пользователь / панель владельца
    │   ├── SellProductScreen.js    ← Форма объявления (вкладка «Продать»): разместить / редактировать (route.params.product)
    │   ├── MyListingsScreen.js     ← «Моё → Объявления»: свои товары (у персонала — товары магазина), В продаже / Проданные
    │   ├── MessagesScreen.js       ← вкладка «Сообщения»: переписки по товарам (покупатель и продавец), непрочитанные
    │   ├── ConversationScreen.js   ← переписка: товар сверху, пузыри, опрос новых раз в 4 с (?after=), Enter — отправить
    │   ├── AdminScreen.js          ← вкладки Товары/Люди/Чат/Игра (ADMIN+MODERATOR),
    │   │                              Релизы (только ADMIN), Статистика (+ ANALYTICS)
    │   ├── ProfileScreen.js        ← Профиль: аватар, роли, геолокация, портфолио-коллекции
    │   ├── UserProfileScreen.js    ← Публичный профиль (портфолио read-only)
    │   ├── MapScreen.js / .web.js  ← Leaflet (react-leaflet веб / WebView мобайл), радиус 5/20км
    │   ├── MyItemsScreen.js        ← вкладка «Моё» — переключатель Объявления/Коллекция/Вишлист
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
    │   ├── HelpGuide.js            ← «Профиль → Помощь»: гайд «что и куда жать» (ОБНОВЛЯТЬ при смене кнопок/вкладок)
    │   ├── ScreenBackground.js     ← Общий атмосферный градиент-фон экранов
    │   └── battle/                 ← BoardSlot, HandCard, BossBanner, CardZoomModal,
    │                                  DamagePopup, DeckPile, HpBar, LogEntry
    └── utils/
        ├── uploadPhoto.js          ← Загрузка фото (web + mobile)
        ├── SmartInput.js           ← TextInput с автоскроллом на web
        ├── analytics.js            ← track() — отправка событий аналитики
        ├── WhatsNewModal.js        ← Модал "Что нового" при обновлении
        ├── changelog.js            ← История версий (ОБНОВЛЯТЬ ПРИ КАЖДОМ РЕЛИЗЕ)
        ├── OnboardingTour.js       ← Тур по вкладкам (один раз за аккаунт; «Продать» — stay, не переходит)
        ├── notice.js               ← showNotice('текст' [, { error: true }]) + <NoticeHost/> в App.js — всплывающее сообщение
        ├── unread.js               ← useUnreadCount() (счётчик на вкладке, опрос 30 с) + refreshUnread()
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
    ├── Магазин → ShopStack (ShopList → ProductDetail / SellProduct / Chat / Notifications / UserProfile / Releases / Library)
    ├── Карта   → MapStack (MapMain → UserProfileMap)
    ├── Продать → не экран: tabPress → Магазин › SellProduct (кнопка по центру, как «Разместить» на Авито)
    ├── Сообщения → MessagesStack (MessagesList → Conversation / ProductDetail / SellProduct / UserProfile / Chat), счётчик непрочитанных
    ├── Моё     → MyStack (MyItemsMain → ProductDetail / SellProduct / Chat / UserProfile / Conversation) — те же имена роутов, что в ShopStack
    ├── Игра    → GameStack — СКРЫТА с 20.10.2026 (SHOW_GAME = false, раздел закрыт)
    ├── Админ   → только если роль ADMIN/ANALYTICS/MODERATOR (условный таб)
    └── Профиль
```

## Неочевидные зависимости

Точные версии — в `package.json`.

- **react-native-gesture-handler** — вся механика атаки в бою (drag существо →
  цель) построена на `Gesture.Pan()`, не на `onPress` (`BattleScreen.js`, `makeAttackDrag`).
- **react-native-svg** — карта-путь лестницы боссов (`LevelSelectScreen.js`) и
  иконки Lucide.
- **lucide-react-native** (с 13.10.2026) — иконки интерфейса вместо эмодзи.
  Импортировать ТОЛЬКО из `src/icons.js` (по одной иконке через
  `lucide-react-native/icons/<имя>`): импорт из общего индекса тянет в веб-сборку
  все ~1900 иконок (бандл 1,8 → 4 МБ). Новую иконку — дописать в `src/icons.js`.
  «Иконка + подпись» — `src/components/IconLabel.js`. Эмодзи остались
  сознательно: метки на самой карте (HTML Leaflet), системные Alert, тексты
  `changelog.js`/статистики, экраны закрытой игры и библиотеки.
  Копия до замены: тег `ui-emoji-backup-2026-10-13` (код),
  `site-before-icons-2026-10-13` (сборка сайта, откат прода — эту версию в gh-pages).
- **expo-screen-orientation** — landscape-lock включается ТОЛЬКО в
  `BattleScreen.js`, остальные экраны — свободный поворот.
- **react-native-webview** vs **react-leaflet** — карта рендерится по-разному:
  WebView+Leaflet на мобайле (`MapScreen.js`), react-leaflet на вебе
  (`MapScreen.web.js`). Маркеры кликабельны → карточка пользователя, радиус 5/20км.

## Прочее

- **Авторизация:** AsyncStorage хранит токен и данные пользователя; `updateUser(data)`
  обновляет user в памяти и AsyncStorage без запроса к серверу.
- **Push-уведомления** не работают в Expo Go — нужен development build.
