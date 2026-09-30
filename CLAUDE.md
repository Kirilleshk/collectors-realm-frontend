# Collector's Realm — Claude Code Context

Приложение для коллекционеров фигурок (React Native/Expo SDK 54; веб + Android/iOS):
магазин с аукционом, карта коллекционеров, коллекция/вишлист, библиотека знаний,
карточная игра. Заказчик — Марк (роль MODERATOR), разработка — Кирилл (ADMIN).

## Стандарты работы

- Код: ставить каждое решение под сомнение, проверять на баги минимум 3 раза, думать, как сделать лучше. Финальный ответ пересмотреть 3 раза.
- После каждого `git push` (сразу) и в конце сессии — `/handoff` (запись сессии с датой и временем в [HANDOFF.md](HANDOFF.md)). Начало работы — `/handoff где мы`.
- Важная инфа от пользователя (ключи, доступы, решения, договорённости) — спросить, заносить ли её в CLAUDE.md/память.
- Репозиторий ПУБЛИЧНЫЙ на GitHub — секреты сюда и в `docs/` не писать (они в приватной памяти Claude).

## Запуск и деплой

- Локально: `npx expo start --web --clear`
- Фронт: Cloudflare Workers, домен markeltoys.ru. Деплой РУЧНОЙ: `npm run deploy`. Push в GitHub прод не обновляет.
- Бэкенд: `E:\MyProgect\collectors-realm-backend` (Node + TS + Prisma) → Render, автодеплой при push в main.
- БД: Supabase PostgreSQL. Миграции/бэкафилл — стартап-скриптами `src/startup/*.ts` бэкенда, не ручным SQL.
- Render Free засыпает: первый запрос после простоя — 50+ сек.

## Константы

```
API           = https://collectors-realm-backend.onrender.com/api
FRONTEND_URL  = https://markeltoys.ru   (запасной holy-grass-59e8.ksele52.workers.dev — в РФ заблокирован)
CLOUD_NAME    = dqutmb1rm,  UPLOAD_PRESET = collectors_realm (unsigned)
PROJECT_ID    = ee592544-47bd-4d06-8f93-0070a93efe36,  EXPO_ACCOUNT = kirill24125
SERVICE_ID    = srv-d7hlnhfaqgkc739da4p0 (Render)
Тест-аккаунт  : kirill@test.com / password123 (COLLECTOR). Админ — в приватной памяти.
```

## Ключевые правила кода

- Состояние — только `AuthContext` + локальный `useState`, без стейт-менеджера. HTTP — через `src/api.js`.
- Доступ к админке — по роли из JWT (ADMIN/ANALYTICS/MODERATOR); бэкенд проверяет ту же роль.
- При каждом релизе обновлять `src/utils/changelog.js`.
- Задачи Марка — только `GET /api/mark-bot/notes` (заголовок `x-bot-secret`); `DONE` — после проверки на проде.

## Документация (читать по необходимости)

- [docs/architecture.md](docs/architecture.md) — структура `src/`, навигация App.js, неочевидные зависимости
- [docs/backend.md](docs/backend.md) — карта route-файлов, схема БД и enum'ы, бот задач Марка
- [docs/domain.md](docs/domain.md) — роли и права, статусы товаров, чат с продавцом
- [docs/card-game.md](docs/card-game.md) — карточная игра: боссы, арт карт, пайплайн загрузки
- [HANDOFF.md](HANDOFF.md) — открытые хвосты + сессии за 3 дня; старше — [docs/handoff-archive/](docs/handoff-archive/) по месяцам
