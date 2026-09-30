# Карточная игра (вкладка «Игра»)

Своя мини-подсистема поверх общего стека. Фронт: `GameScreen.js` → `LevelSelectScreen.js`
→ `BattleScreen.js` + `src/components/battle/`. Бэкенд: вся механика боя — в
`cards.routes.ts`, модели см. [backend.md](backend.md). Неочевидные библиотеки
(gesture-handler, svg, screen-orientation) — в [architecture.md](architecture.md).

## Тема «Чужой против Хищника»

20 карт (10 Чужие + 10 Хищники; по 6 COMMON / 2 EPIC / 1 SILVER / 1 GOLD на фракцию,
точная редкость — в бэкенде `prisma/seed-cards.ts`) + босс «Королева чужих» + рубашка колоды.
**Арт есть у всех карт, босса и рубашки.**

**Лестница боссов** (`Boss`, с 21.08.2026) — 4 босса внутри темы с растущим HP и
уникальной пассивкой (regen/mana_drain/enrage), порядок — поле `order`. Боссы #2-4
пока используют арт-заглушку (портрет «Королевы чужих») — ждут своего арта от
Марка/Кирилла.

## Генерация арта

**Инструмент:** Leonardo.ai, модель **Lucid Origin**, режим **Fast**, стиль **Dynamic**,
размер строго **1:1** — карты везде показываются квадратными превью с обрезкой по центру
(`resizeMode: cover` в `cardArt.js`), другое соотношение обрежет голову/ноги.

**Шаблон промта:** `Cinematic dark sci-fi horror movie poster style, <описание
существа/сцены>, photorealistic, hyper-detailed, square 1:1 composition, dramatic
<тип света>, no text, no watermark`.

Порядок генерации для новых тем — от редких к простым (GOLD → SILVER → EPIC → COMMON).

## Пайплайн загрузки

Файл `art-cards/<имя-транслит>.png` → unsigned upload на Cloudinary
(`api.cloudinary.com/v1_1/dqutmb1rm/image/upload`, preset `collectors_realm`) →
`UPDATE "Card" SET "imageUrl" = '...' WHERE name = '...'`. Папка `art-cards/` в
`.gitignore` — исходники не коммитятся. Раньше UPDATE выполнялся руками через
`prisma/set-card-images-<дата>.sql` в Supabase; для новых загрузок предпочтительнее
стартап-скрипт в бэкенде (`src/startup/`).
