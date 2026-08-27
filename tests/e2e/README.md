# E2E tests

Полная карта всех тестов проекта, команды запуска и runbook по обновлению находятся в [`../README.md`](../README.md).

Этот набор тестов проверяет полный happy-path popup в реальном Chromium с загруженным MV3 extension:

1. открытие popup
2. заполнение настроек
3. test connection
4. сохранение в `chrome.storage.local`
5. загрузка списка задач
6. start / stop / pause
7. upload `.torrent`
8. remove task

## Запуск

```bash
npm run build
npx playwright install chromium
npm run test:e2e:mock
```

Это **безопасный mock-only** прогон. Он не касается реального NAS.

## Real NAS smoke (read-only)

Если есть локальный `.env.e2e.local`, можно запустить только безопасный smoke-сценарий:

```bash
npm run build
npm run test:e2e:real
```

Он проверяет только:
- заполнение и сохранение настроек
- test connection
- загрузку списка задач

Он **не** добавляет, не стартует, не паузит и не удаляет реальные задачи.

## Real NAS mutating flow

Отдельно есть opt-in сценарий, который создаёт только собственную тестовую задачу с префиксом `quickget-e2e-`, а затем удаляет её:

```bash
npm run build
npm run test:e2e:real:mutating
```

Перед запуском такого сценария желательно использовать:
- отдельный тестовый аккаунт NAS
- отдельные папки для `QNAP_E2E_TEMP_DIR` и `QNAP_E2E_DEST_DIR`
- не production-нагруженный Download Station

## Почему здесь не нужны реальные NAS креды

Текущий e2e использует локальный mock NAS и не трогает ваш реальный QNAP.

## Если позже захотите тест против реального NAS

Используйте только локальные переменные окружения или локальный `.env.e2e.local` (он уже игнорируется через `.gitignore`).

Рекомендуемый минимум:

```dotenv
QNAP_E2E_HOST=...
QNAP_E2E_PORT=...
QNAP_E2E_LOGIN=...
QNAP_E2E_PASSWORD=...
QNAP_E2E_TEMP_DIR=...
QNAP_E2E_DEST_DIR=...
```

Никогда не коммитьте:
- NAS address
- login/password
- SID
- сырые request/response дампы без редактирования

## Диагностика

При падении теста Playwright сохраняет trace/screenshot/video, а тест дополнительно прикладывает локальный redacted HTTP log, где маскируются:
- `sid`
- `pass`
- `password`

Если включён real NAS flow, redacted HTTP log также можно сохранять локально в `.e2e-artifacts/` для последующего обновления mock-ответов.

Сейчас для real NAS сценариев автоматически сохраняются два артефакта:

- `.e2e-artifacts/real-nas-smoke.log`
- `.e2e-artifacts/real-nas-smoke.json`

и для mutating flow:

- `.e2e-artifacts/real-nas-mutating.log`
- `.e2e-artifacts/real-nas-mutating.json`

`*.log` удобно читать глазами, а `*.json` удобнее сравнивать и использовать как источник для обновления mock fixture-ов.


## Приватный трекер (opt-in, живой сайт)

`tests/e2e/private-tracker.real.spec.ts` проверяет то, чего мок проверить не может: доходит ли
сессия сайта до `fetch` внутри service worker'а. Chrome считает такой запрос same-site, если у
расширения есть host permission на целевой домен, так что кука должна прикрепляться — тест это
доказывает, а не принимает на веру. Если бы кука не уходила, сайт вернул бы страницу логина, и
на NAS уехал бы HTML.

Сессию нельзя получить скриптом: анти-бот отвечает Playwright-браузеру страницей проверки и в
headless, и в headed режиме. Обход сознательно не делается. Поэтому логин — разовый и ручной:

```bash
npm run tracker:login      # откроется окно; залогинься и закрой его
npm run test:e2e:tracker
```

Целевая страница задаётся локально в `.env.e2e.local` (`TRACKER_E2E_TOPIC`) и в репозитории не
фиксируется. Профиль сохраняется в `.e2e-artifacts/tracker-profile/` (gitignored) вместе с
куками и клиренсом анти-бота. Когда профиля нет или сессия протухла, тест скипается с
подсказкой, а не падает.
