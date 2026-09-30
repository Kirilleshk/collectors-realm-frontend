# Архитектура фронтенда

## Стек

- React Native + Expo SDK 54, веб-сборка хостится на Cloudflare Workers
  (`wrangler.jsonc`: markeltoys.ru + www.; запасной workers.dev в РФ заблокирован).
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

## Неочевидные зависимости

Точные версии — в `package.json`.

- **react-native-gesture-handler** — вся механика атаки в бою (drag существо →
  цель) построена на `Gesture.Pan()`, не на `onPress` (`BattleScreen.js`, `makeAttackDrag`).
- **react-native-svg** — карта-путь лестницы боссов (`LevelSelectScreen.js`).
- **expo-screen-orientation** — landscape-lock включается ТОЛЬКО в
  `BattleScreen.js`, остальные экраны — свободный поворот.
- **react-native-webview** vs **react-leaflet** — карта рендерится по-разному:
  WebView+Leaflet на мобайле (`MapScreen.js`), react-leaflet на вебе
  (`MapScreen.web.js`). Маркеры кликабельны → карточка пользователя, радиус 5/20км.

## Прочее

- **Авторизация:** AsyncStorage хранит токен и данные пользователя; `updateUser(data)`
  обновляет user в памяти и AsyncStorage без запроса к серверу.
- **Push-уведомления** не работают в Expo Go — нужен development build.
