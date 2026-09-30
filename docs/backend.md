# Бэкенд

Node.js + TypeScript + Prisma, локальный клон `E:\MyProgect\collectors-realm-backend`
(GitHub → Render.com, автодеплой при push в main). БД — PostgreSQL на Supabase
(eu-west-1, Free план).

## Миграции

Часто без файлов миграции: стартап-скрипты в `src/startup/*.ts` (подключены в
`index.ts`) сами приводят БД в нужное состояние при каждом старте сервера —
предпочтительный способ вместо ручных SQL-шагов в Supabase.

## Карта route-файлов

`src/routes/` — точный список эндпоинтов смотреть в самом файле.

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
markBot.routes.ts      GET/PATCH /notes, POST /send, POST /webhook — Telegram-бот задач Марка
library.routes.ts      GET /article (Groq+Wikipedia, кеш), /suggest, /recent,
                       /admin-coverage, POST /batch-generate (staff)
cards.routes.ts        карточная игра — themes, bosses, battle/start,
                       /:id/play, /:id/attack, /:id/activate, /:id/end-turn,
                       admin/all, admin/stats (staff)
```

## Схема БД (Prisma)

Точные поля — в `prisma/schema.prisma`. Ключевые enum'ы:

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
- **Профиль/портфолио:** `PortfolioPhoto`, `PortfolioCollection` + `PortfolioCollectionPhoto`
- **Карточная игра** (см. [card-game.md](card-game.md)): `CardTheme`, `Boss`,
  `UserBossProgress`, `Card`, `UserCard`, `Battle` (JSON-колонки для стола/руки/колоды —
  вся боевая механика живёт в `cards.routes.ts`)
- **Библиотека знаний:** `LibraryArticle` (кеш по slug), `LibrarySearchLog`
- **Саппорт/задачи:** `SupportMessage`, `MarkNote` + `MarkNoteType`/`MarkNoteStatus`
- **Служебное:** `AnalyticsEvent`

## Telegram-бот задач Марка

`@collectors_realm_tasks_bot` — Марк пишет туда текстом/голосом, бэкенд сохраняет
в `MarkNote` (расшифровка голоса через Groq Whisper). Это единственный источник
правды по задачам заказчика. Проверять при «что у нас по задачам» —
`GET /api/mark-bot/notes` с заголовком `x-bot-secret` (значение — в `.env`/Render env).
Статус `DONE` ставить только после реальной проверки на проде.
