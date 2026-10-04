# Collector's Realm — журнал сессий (HANDOFF)

Передача дел между сессиями Claude: что сделано, что на проде, что не доделано.
Здесь — только **открытые хвосты** и сессии **за последние 3 дня** (новые сверху);
всё старше автоматически уезжает в [docs/handoff-archive/](docs/handoff-archive/)
(по месяцам). Вести командой `/handoff`, начинать сессию с `/handoff где мы`.

## Открытые хвосты

- **Ждёт Кирилла:** секрет `BOT_SECRET` в GitHub-репо бэкенда (Settings → Secrets and variables → Actions) — без него ежедневный запуск бота привлечения падает с 403 (04.10).
- **Ждёт Кирилла:** посмотреть тестового кандидата (cutterpool) в боте задач → в Render env `GROWTH_REVIEWER_CHAT_ID=1871781331`, тогда кандидаты пойдут Марку (04.10).
- **Не сделано:** аккаунт-комментатор Telegram (один, «коллекционер, канал Markeltoys» + ссылка «Аккаунт Telegram») — нужен номер; потом автопубликация выбранного варианта (04.10).
- **Ждёт разбора:** Марк просит Instagram (номер, аккаунт, комментарии/ответы) — без логина Instagram не читается вообще (август), риск бана высокий (04.10).
- **На заметку:** Playwright на машине Кирилла 04.10 перестал открывать вообще всё (даже ya.ru) при выключенном VPN — мешают фоновые VPN-клиенты (xray, RvRvpnGui, OutlineService); curl ходит напрямую. Для проверок «из РФ» — curl + `ipinfo.io`, браузер — после закрытия VPN-клиентов (04.10).
- **Потом:** постоянный хостинг вместо GitHub Pages (правила GitHub против сайтов, занятых в основном продажами; нет прокси /api) — рекомендация Timeweb ~450–500 ₽, решение за Марком (04.10).
- **Не сделано:** удалить тестовый проект Vercel `markeltoys` и токен (vercel.com/account/tokens), `.env.vercel` в фронт-репо (02.10).
- **Ждёт Марка:** верификация e-mail для markeltoys.online в nic.ru — иначе домен приостановят (~до 13.10).
- **Ждёт Кирилла:** аккаунт ВК → `VK_SERVICE_TOKEN` в `.env` бэкенда → 7 ВК-групп в боте привлечения (сейчас «ждёт доступа к API ВК») (29.09).
- **Ждёт Кирилла:** исключать ли из статистики «test» (ksele62@) и «KirillTest21» — кнопка 👻 во вкладке «Люди» (29.09).
- **TODO после 01.10.2026:** убрать `userId` из тела событий аналитики (мост на время выкатки, сервер берёт пользователя из токена) (29.09).
- **Отложено:** PWA — ветка `feature/pwa`, в main не влита. Очередь: тг-бот → PWA → прокси `/api` на своём домене + HttpOnly-cookie — на GitHub Pages невозможно (нет прокси), только после переезда на постоянный хостинг (29.09).
- **Ждёт арта:** уникальные портреты боссов #2–4 (сейчас заглушка «Королева чужих»).

## Сессии

### 2026-10-04 15:37–16:30 — разбор задач Марка, бот привлечения: кандидаты на комментарии с одобрением (MVP на проде)
<!-- session: eed4a8c6 -->
- **Сделано:** разобраны 36 незакрытых заметок бота → список по срочности.
  Порядок от Марка (29.09): сначала тг-бот привлечения, потом PWA.
  Марку отправлены 2 вопроса — он ответил: один аккаунт-коллекционер, при
  бане убираем группу (новый не заводим); ссылка в профиле, считаем TG/ВК
  отдельно, не по группам. Канал **MarkelToys** (`-1001284697699`) подключён:
  бот задач — админ, создал ссылки «Аккаунт Telegram» / «Аккаунт ВК».
- **Сделано (бэкенд) — бот привлечения** (`src/services/growth/*`,
  `growth.routes.ts`, см. docs/backend.md): сканер `t.me/s` + виджет
  обсуждения → до 2 самых обсуждаемых постов (3+ комм., 30 дней) → Groq
  `gpt-oss-120b` проверяет тему и пишет 3 варианта (ответы на комментарии
  людей + к посту) → кандидат с кнопками ✅ 1–3 / 🔄 / ⏭ в бот задач,
  выбранный текст — отдельным сообщением для копирования. Раз в 2 дня на
  группу, посты не по теме → OFFTOPIC. Вступления в канал — `chat_member`,
  `/stats`, `/groups`, `/addgroup`, `/removegroup`, `/scan`. Группы Марка —
  стартап-сид (3 TG + 7 ВК). Ежедневно 10:00 МСК — GitHub Actions.
- **Проверено на проде:** пробные прогоны по 3 TG-группам; по ним исправлено:
  llama недоступна на ключе бота → gpt-oss; регулярка тем пропускала
  планшеты/коктейли → проверка темы нейросетью; «фигурка из моего набора» →
  запрет + reasoning medium; у ответов брался текст цитаты; `&#33;`. Боевой
  прогон cutterpool → кандидат ушёл Кириллу, `/stats` видит 1 кандидата и канал.
- **На заметку:** с машины Кирилла без VPN недоступны t.me, api.telegram.org
  и Groq — всё проверять на Render (`POST /api/growth/run?dryRun=1`).
  Качество вариантов среднее (gpt-oss по-русски), Марк выбирает/просит другие.
- **Файлы:** бэкенд — prisma/schema.prisma, src/services/growth/{tgScraper,
  commentWriter,growth.service}.ts, src/routes/{growth,markBot}.routes.ts,
  src/services/telegram.service.ts, src/config/botChats.ts, src/app.ts,
  src/index.ts, src/startup/seedGrowthGroups2026_10_04.ts,
  .github/workflows/growth-scan.yml; фронт — docs/backend.md
- **Коммиты:** фронт — (docs) · бэкенд a1b803c, 37e2fd0, 66c30e0, c2f76b5, c09cdd1
- **Прод:** бэкенд задеплоен (Render `c09cdd1`); фронт не требуется
- **Хвосты:** секрет BOT_SECRET в GitHub, переключить проверяющего на Марка,
  аккаунт-комментатор, ВК-токен, Instagram — см. «Открытые хвосты».

### 2026-10-04 11:54–15:21 — markeltoys.ru переехал с Cloudflare на GitHub Pages, HTTPS включён (из РФ работает)
<!-- session: 54828e6c -->
- **Сделано:** `npm run deploy` теперь выкладывает на GitHub Pages:
  `scripts/deploy-pages.js` — после `expo export` кладёт `404.html` (= index,
  прямые ссылки), `.nojekyll` (иначе Jekyll выкинет `_expo`), `CNAME
  markeltoys.ru`, проверяет, что в бандле адрес Render API, и force-push'ит
  один коммит в `gh-pages` (без истории — каждая выкладка ~2 МБ).
  Cloudflare — `npm run deploy:cloudflare` (запасной workers.dev);
  `wrangler.jsonc` — домен отвязан. CORS бэкенда открыт — менять не нужно.
- **Сделано (Кирилл, по шагам):** в Cloudflare отвязаны markeltoys.ru/www от
  Worker'а (вкладка Worker → Domains); DNS: 4 × A `@` → 185.199.108–111.153,
  CNAME `www` → kirilleshk.github.io, всё «DNS only», `test` удалён (TXT
  globalsign оставлен). GitHub Pages: источник `gh-pages` /, домен markeltoys.ru.
- **Проверено из РФ без VPN** (Калининград, Ростелеком): бандл 1,79 МБ за
  0,4 с; Playwright по http — вход тест-аккаунтом, магазин (товар + фото
  Cloudinary), карта (подложка, 13 пользователей), прямая ссылка
  `/Main/Profile` (код 404, приложение открывается, вход сохранён); www → 301
  на markeltoys.ru.
- **HTTPS:** проверка DNS в GitHub висела 3 ч «DNS Check in Progress» →
  Remove домена + снова `markeltoys.ru` → «DNS check successful» и
  сертификат за ~1 мин (GitHub при этом сам коммитит Delete/Create CNAME в
  gh-pages). «Enforce HTTPS» включён: http → 301 https, www → 301
  https://markeltoys.ru. curl из РФ 20/20 по https. Кирилл в своём браузере:
  «всё работает».
- **Файлы:** scripts/deploy-pages.js (новый), package.json, wrangler.jsonc,
  src/config.js (комментарий), CLAUDE.md, docs/architecture.md
- **Коммиты:** фронт 8a85eaf (+ docs a921658, 31c3584 и этот); ветка gh-pages 3cdcec5
  (выкладка) + 5eff47b/755a1a3 (GitHub сам: Delete/Create CNAME) · бэкенд —
- **Прод:** задеплоено на GitHub Pages (`3cdcec5` из `8a85eaf`), https://markeltoys.ru работает из РФ без VPN
- **Хвосты:** сообщить Марку, постоянный хостинг, удалить Vercel — см. «Открытые хвосты».

### 2026-09-28 14:00 – 2026-10-02 12:03 — домен, статистика, 👻, тг-бот (требования + разведка), сайт не открывается в РФ → тест хостингов (Vercel ❌, GitHub Pages ✅)
<!-- session: b8bbc0ab -->
- **Сделано (28.09) — свой домен:** markeltoys.ru (куплен Марком в nic.ru
  24.09) переведён на Cloudflare: зона в аккаунте ksele52 (Free), удалены
  A-записи заглушки nic.ru (178.210.92.188), NS `statuspage1/2.nic.ru` →
  `neil`/`zelda.ns.cloudflare.com` (реестр .ru принял ~за час, проверка —
  whois.tcinet.ru). `wrangler.jsonc`: `routes` c `custom_domain` для
  `markeltoys.ru` и `www.` + явный `workers_dev: true` (старая ссылка —
  запасная). Ассистент бота даёт ссылку markeltoys.ru. Марку — про
  верификацию e-mail markeltoys.online (в nic.ru 6 доменов, кроме
  markeltoys.ru не подключены; ukpn.ru Марку не нужен).
- **Сделано (29.09) — статистика «люди, а не клики»** (запрос Марка 23.09).
  Разбор старой (данные через API под админом, с разрешения Кирилла): клики
  вместо людей, английские события, login/register без пользователя
  (setAnalyticsUser в useEffect срабатывал после track), тестовые аккаунты в
  цифрах, «время в приложении» завышено, трекались 4 вкладки, сводку видел
  любой с «admin»/«kirill» в email. Факт: за 30 дней 0 реальных новых людей,
  из 13 реальных пользователей никто ничего не сделал после регистрации.
  Бэкенд: `AnalyticsEvent` + `anonId` (устройство) + `source` (метка
  `?from=`/`utm_source`/реферер, первое касание) + индексы; `/summary` —
  сегодня/вчера/7/30 дней, по дням, воронка, источники, разделы, действия,
  наполнение из таблиц, последние регистрации; дни по Москве; доступ по роли
  из БД. Фронт: `analytics.js`, `AuthContext.js` (setAnalyticsUser(id, token)
  синхронно), `App.js` (screen_view по onStateChange/route.key, app_open,
  app_resume), вкладка «Статистика» в `AdminScreen.js` по-русски.
- **Сделано (29.09) — «теневое» исключение 👻:** `User.excludeFromStats`,
  `PATCH /users/:id/stats-exclude`, кнопка 👻 во вкладке «Люди»; `GET /users`
  отдаёт стаффу email (строка почты в «Людях» была пустой) и флаг. Исключаются
  стафф, бейдж SHOP, @test.com/@example.com, 👻 и гостевые события их устройств.
- **Сделано (29.09) — код-ревью (skill, high) обоих репо, 18 замечаний:**
  🔴 флаг 👻 уходил самому пользователю (вырезан из sanitize/`/me`);
  🔴 POST `/analytics` брал userId из тела — теперь только из JWT; ex_anon
  режет только гостевые события; источники — одно на устройство; 404 для
  stats-exclude; вкладка не падает на неполном ответе; ошибка 👻 видна в вебе.
  Выкатка: сначала фронт (шлёт и токен, и userId), потом бэкенд. Проверено
  вживую: гость по `?from=claude-check2` засчитан → после входа тестовым
  аккаунтом с того же устройства исчез. Кирилл: «в админке всё супер».
- **Сделано (29.09) — PWA начато и отложено:** иконки, manifest, `pwa.js`,
  `InstallAppModal.js`, `UpdateAvailableModal.js` — в ветке `feature/pwa`
  (запушена, в main не влита); что осталось — в тексте коммита ветки.
- **Сделано (29.09) — тг-бот привлечения:** Марк прислал группы (TG —
  biggeekru, geek_partykrd, cutterpool; ВК — geekpartykrd, artandtoysgroup,
  geekzona, geekcosplay, baraholka_geek, geekpriyut, geekmediaru) и вводные
  (гик-темы, посты с 5+ комм., раз в 2 дня на группу, «едко без оскорблений»,
  цель — его тг-канал). Отправлены 19 вопросов. Разведка TG без аккаунта
  (`t.me/s/` + виджет `?embed=1&discussion=1`), скрипт
  `scripts/growth/tg-recon.js`: cutterpool (59K, кино/комиксы, 322 поста с
  5+ за 30 дн.) — лучший; biggeekru (582K, в основном смартфоны, запрет
  спама); geek_partykrd (736, ~5 постов/мес) — лучше договор. ВК без
  аккаунта не читается вообще.
- **Сделано (29.09) — разбор «слетает вход»:** багов в коде нет, Safari/
  in-app браузеры стирают localStorage (ITP 7 дней). Решения: PWA или прокси
  `/api` на своём домене + HttpOnly-cookie.
- **Сделано (30.09) — сайт не открывается у Марка:** причина — российские
  провайдеры с июня 2025 режут соединения с Cloudflare до 16 КБ (HTML 3 КБ
  проходит, бандл 1,8 МБ — нет). Бэкенд Render тоже за Cloudflare
  (`Server: cloudflare`), unpkg (стили карты) тоже; Cloudinary — нет.
  check-host: 40 точек мира + Москва (дата-центры) — 200 OK, т.е. режут
  именно потребительские провайдеры. Мои проверки шли через шведский выход
  (VPN) — поэтому 28.09 «работало». Предложено без своего сервера: Яндекс
  Облако (Object Storage для сайта + API Gateway проксирует `/api` на Render)
  или VPS ~300–500 ₽/мес. Ждёт решения.
- **Сделано (30.09) — бэкенд:** `strictNullChecks` в tsconfig — 0 ошибок
  типов вместо 4 (без него zod делал все поля схем необязательными; рантайм
  был верный), `hasStealth` принимает null. `PATCH /mark-bot/notes/:id` —
  `silent: true` (смена статуса без «✅ Готово» Марку в Telegram — иначе
  разбор старых заметок заспамил бы его). `/health` отдаёт `commit` текущей
  выкатки Render (`RENDER_GIT_COMMIT`) — ждать выкатки перед зависимыми
  действиями.
- **Сделано (30.09) — чистка заметок бота** (явное разрешение Кирилла,
  тихо, без сообщений Марку): 41 → DONE (тестовые переписки Кирилла с
  ассистентом 23.09, учтённые материалы, сделанное — логотип/домен/nic.ru/
  аналитика/пауза игры и библиотеки, принятые указания), 19 → IN_PROGRESS
  (тг-бот привлечения + «сайт не открывается»). NEW оставлены 3: вопросы
  Марка ассистенту 23.09 (5 способов привлечения, подписки, «объедини
  задачи») — неизвестно, ответил ли ассистент (тогда сбоил по лимиту Groq).
- **Сделано (30.09) — /handoff:** `rotate.js` сортирует и архивирует по
  времени КОНЦА сессии (многодневная продолженная сессия — наверху, не уезжает
  в архив по дате начала); SKILL.md дополнен.
- **Сделано (30.09–02.10) — выбор хостинга вместо Cloudflare:** бесплатные
  (Яндекс Облако free tier — нужна карта; Beget free — без своего домена;
  GitHub Pages — нестабилен в РФ; Netlify/Vercel — блок) и платные (Timeweb
  Cloud App Platform ~450–500 ₽: фронт от 1 ₽ + бэкенд 1 ГБ 450 ₽, деплой из
  GitHub, не засыпает; Amvera 290/490 ₽ — 0,5/1 ГБ). Рекомендация — Timeweb.
  По просьбе Кирилла проверен Vercel: проект `markeltoys` (аккаунт kirilleshk,
  токен в `.env.vercel`, в git не попадает), сборка с `EXPO_PUBLIC_API_URL=/api`
  в `dist-vercel/`, `deploy/vercel/vercel.json` — прокси `/api` → Render + SPA.
  На markeltoys.vercel.app всё работает, но **из РФ без VPN (Ростелеком,
  Калининград — машина Кирилла 02.10 без VPN) Vercel не отвечает вообще**
  (таймаут и на 76.76.21.21). Там же вживую подтверждён диагноз Cloudflare:
  бандл markeltoys.ru обрывается на 25 КБ из 1,8 МБ.
- **Сделано (02.10) — подготовка к переезду (пригодится на любом хостинге):**
  адрес API — только `src/config.js` (`EXPO_PUBLIC_API_URL`, было 9 файлов),
  `leaflet.css` + картинки в `public/leaflet` вместо unpkg (Cloudflare).
  Задеплоено на Cloudflare (`df39872e`). ⚠️ В Git Bash на Windows `/api` в
  переменных и аргументах превращается в `C:/Program Files/Git/api` — нужен
  `MSYS_NO_PATHCONV=1`.
- **Сделано (02.10) — тест GitHub Pages (успешно из РФ):** с машины Кирилла
  без VPN (Ростелеком) выяснено: **Render из РФ НЕ режется** (свои IP
  216.24.57.x; ответ 79 КБ целиком, 61 КБ в одном соединении) — режутся только
  «общие» адреса Cloudflare (172.67/104.21) — наш Worker. GitHub Pages отдаёт
  большие файлы целиком (бандл 1,79 МБ за 0,4 с). Сборка (`dist`, API напрямую на
  Render) выложена в новую ветку **`gh-pages`** (с явного разрешения Кирилла;
  + `.nojekyll`, `404.html` = index.html, `CNAME` test.markeltoys.ru), Pages
  включён, DNS `test` CNAME → kirilleshk.github.io (DNS only). Playwright из РФ
  по http: вход, магазин с товарами, карта (подложка, 13 пользователей,
  аватарки) — всё работает. Замечено: изредка `ERR_EMPTY_RESPONSE` по http
  (manifest.json, первый заход) — перепроверить по https. Ждём сертификат.
  Минусы Pages: правила GitHub запрещают сайты, в основном занятые продажами;
  прямые ссылки отдаются с кодом 404 (приложение открывается); `/api` не
  проксирует (вход на cookie здесь не сделать); Render по-прежнему засыпает.
- **Сообщения Марку через бота:** markeltoys.online (28.09), отчёт по домену
  и статистике + ссылки с метками `?from=tg/avito/vk` (29.09), 19 вопросов
  по боту (29.09).
- **Файлы:** фронт — wrangler.jsonc, App.js, src/AuthContext.js,
  src/utils/analytics.js, src/screens/AdminScreen.js, src/api.js, CLAUDE.md;
  ветка feature/pwa — public/icons/*, public/manifest.json, public/index.html,
  src/utils/{pwa,InstallAppModal,UpdateAvailableModal}.js. Бэкенд —
  prisma/schema.prisma, src/routes/{analytics,users}.routes.ts,
  src/services/{auth,assistant}.service.ts, scripts/growth/tg-recon.js,
  tsconfig.json, src/app.ts, src/routes/{cards,markBot}.routes.ts;
  02.10 фронт — src/config.js, src/api.js, src/notifications.js,
  src/screens/{Admin,Login,ProductDetail,Profile,UserProfile,MapScreen.web}.js,
  src/utils/{analytics,mapShared}.js, public/leaflet/*, deploy/vercel/*, .gitignore;
  handoff — .claude/skills/handoff/{rotate.js,SKILL.md}
- **Коммиты:** фронт b3124ad, 1d7245f, 0024424, 54fe3f6, 1abb092 (+ docs
  7e34ed1, 8cd7845, 1aaf705, a6b9561, eff1183; ветка feature/pwa) · бэкенд
  cf1a6aa, 9b20b99, 1059c61, 1dd75fb, bd10bec, e8f9d03, 9c64a12, 3de59ad;
  фронт 02.10 — 79ba182; ветка gh-pages — d31e912 (тестовая выкладка)
- **Прод:** фронт задеплоен на Cloudflare (последняя `df39872e`, 02.10), бэкенд —
  автодеплой Render (`3de59ad`, видно в `/health`). Тестово: GitHub Pages
  `test.markeltoys.ru` (ветка gh-pages) и Vercel `markeltoys.vercel.app` (в РФ
  недоступен). ⚠️ Основной markeltoys.ru в РФ без VPN по-прежнему не работает.
- **Хвосты:** см. «Открытые хвосты».
