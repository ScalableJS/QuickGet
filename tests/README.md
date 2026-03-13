# Тесты: карта, запуск и обновление

Этот документ — рабочий runbook по тестам проекта: какие наборы тестов есть, где лежат ключевые файлы, как безопасно запускать проверки, как обновлять тесты после изменений и как продолжить работу спустя время без повторного исследования репозитория.

## 1. Быстрая карта тестов

### Unit / integration (`vitest`)

Запускаются командой `npm test` и покрывают основную логику без браузерного UI.

Главные файлы:
- `src/api/index.test.ts` — transport / middleware / сериализация запросов к API
- `src/api/client.test.ts` — поведение `ApiClient`, login, query, multipart upload, duplicate handling
- `src/lib/settings.test.ts` — чтение и сохранение настроек
- `src/popup/features/downloads/downloadsManager.test.ts` — orchestration списка загрузок
- `src/popup/features/downloads/downloadsState.test.ts` — состояние и преобразование списка

Инфраструктура unit-тестов:
- `vitest.config.ts` — конфиг vitest
- `tests/setup.ts` — глобальный setup
- `tests/msw/server.ts` — MSW server для сетевых моков
- `tests/mocks/chrome.ts` — mock `chrome.*` API
- `tests/fixtures/settings.ts` — фабрики тестовых настроек

### Mock E2E (`playwright`)

Запускаются локально против встроенного mock NAS и не трогают реальный QNAP.

Главные файлы:
- `tests/e2e/mockNas.contract.spec.ts` — прямой контракт-тест `mockNas` без UI
- `tests/e2e/popup.full-cycle.spec.ts` — полный happy-path popup в Chromium extension
- `tests/e2e/support/mockNas.ts` — локальный mock Download Station API
- `tests/e2e/support/extension.ts` — запуск extension popup
- `tests/e2e/support/popup.ts` — UI-хелперы popup
- `tests/e2e/support/redactedHttpLog.ts` — redacted request/response log

### Real NAS E2E (`playwright`, opt-in)

Запускаются только локально при явном включении переменных окружения.

Главные файлы:
- `tests/e2e/popup.real-nas.spec.ts` — read-only smoke + opt-in mutating scenario
- `tests/e2e/support/e2eEnv.ts` — загрузка env для real NAS
- `tests/e2e/support/httpCapture.ts` — capture клиентских и сетевых запросов
- `tests/e2e/support/realNasClient.ts` — cleanup только тестовых задач
- `tests/e2e/support/torrentFixture.ts` — генерация тестового `.torrent`
- `tests/e2e/README.md` — более узкие детали только по e2e flow

## 2. Что запускать чаще всего

### Быстрый безопасный цикл перед коммитом

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e:mock
```

Это безопасный набор:
- не использует реальный NAS
- проверяет типы
- гоняет unit/integration
- собирает extension
- запускает mock e2e

### Если меняли только TS-логику без UI

```bash
npm run typecheck
npm test
```

### Если меняли popup / upload / toolbar / mock NAS

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e:mock
```

### Если нужно запустить только безопасные mock E2E явно

```bash
npm run test:e2e:mock
```

## 3. Где что проверяется

### Изменения в `src/api/*`

Проверять в первую очередь:
- `src/api/index.test.ts`
- `src/api/client.test.ts`

Типичные причины обновления тестов:
- изменился shape request body
- изменился multipart upload
- изменился login / SID flow
- изменился shape `Task/Query`

### Изменения в нормализации задач (`src/lib/tasks.ts`)

Проверять:
- `src/api/client.test.ts`
- `tests/e2e/mockNas.contract.spec.ts`
- `tests/e2e/popup.full-cycle.spec.ts`

Типичные причины обновления тестов:
- новые numeric states у QNAP
- новые поля raw job
- изменения в `normalizeQnap()`

### Изменения в popup UI / списке загрузок / toolbar

Проверять:
- `src/popup/features/downloads/downloadsManager.test.ts`
- `src/popup/features/downloads/downloadsState.test.ts`
- `tests/e2e/popup.full-cycle.spec.ts`

### Изменения в реальном QNAP payload

Проверять и обновлять:
- `tests/e2e/support/mockNas.ts`
- `src/api/schema.d.ts`
- `src/lib/tasks.ts`
- `tests/e2e/mockNas.contract.spec.ts`
- `src/api/client.test.ts`

## 4. Как обновлять тесты после изменения функциональности

### Сценарий A: изменили mock / API contract

1. Обновить `tests/e2e/support/mockNas.ts`
2. Если поменялся shape ответа — при необходимости обновить `src/api/schema.d.ts`
3. Если поменялась нормализация — обновить `src/lib/tasks.ts`
4. Зафиксировать контракт в:
   - `tests/e2e/mockNas.contract.spec.ts`
   - `src/api/client.test.ts`
5. Запустить:

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e:mock
```

### Сценарий B: изменили popup поведение

1. Обновить unit-тесты feature-модуля, если логика находится в `src/popup/features/**`
2. Обновить `tests/e2e/popup.full-cycle.spec.ts`, если менялся пользовательский сценарий
3. Если изменились селекторы или структура popup, проверить хелперы в `tests/e2e/support/popup.ts`
4. Запустить:

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e:mock
```

### Сценарий C: real NAS начал отвечать иначе

1. Локально прогнать real smoke и при необходимости mutating flow
2. Сохранить новые captures в `.e2e-artifacts/`
3. Сравнить новые `.json`/`.log` с текущим `mockNas`
4. Обновить mock и связанные тесты
5. Повторить безопасный mock-only прогон

## 5. Real NAS: как запускать и как не сломать себе окружение

### Read-only smoke

```bash
npm run build
npm run test:e2e:real
```

Проверяет только:
- сохранение настроек
- test connection
- загрузку списка задач

### Mutating real NAS flow

```bash
npm run build
npm run test:e2e:real:mutating
```

Этот сценарий:
- создаёт только свою тестовую задачу с префиксом `quickget-e2e-`
- затем удаляет её
- перед стартом дополнительно делает cleanup задач с этим префиксом

### Рекомендуемые локальные переменные

```dotenv
QNAP_E2E_REAL=1
QNAP_E2E_HOST=...
QNAP_E2E_PORT=...
QNAP_E2E_LOGIN=...
QNAP_E2E_PASSWORD=...
QNAP_E2E_TEMP_DIR=...
QNAP_E2E_DEST_DIR=...
QNAP_E2E_CAPTURE_HTTP=1
```

Для mutating flow дополнительно:

```dotenv
QNAP_E2E_ALLOW_MUTATIONS=1
```

### Правила безопасности

- использовать отдельный NAS-аккаунт для тестов
- использовать отдельные test-owned папки для `TEMP_DIR` и `DEST_DIR`
- не коммитить реальные SID / token / пароли / сырые неотредактированные логи
- mutating flow запускать только осознанно

## 6. CI в GitHub Actions

В репозитории есть workflow `/.github/workflows/ci.yml`, который запускается на `push` и `pull_request` и выполняет безопасный набор проверок:

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e:mock
```

CI не запускает real NAS сценарии и не требует QNAP credentials.

При падении browser e2e workflow сохраняет `playwright-report/` и `test-results/` как artifacts.

## 7. Как обновлять mock по реальному NAS

Главный цикл обновления такой:

1. Прогнать локально real smoke:

```bash
npm run build
npm run test:e2e:real
```

2. Если нужен upload/remove capture, прогнать:

```bash
npm run build
npm run test:e2e:real:mutating
```

3. Посмотреть артефакты в `.e2e-artifacts/`:
- `real-nas-smoke.log`
- `real-nas-smoke.json`
- `real-nas-mutating.log`
- `real-nas-mutating.json`

4. Сравнить реальные payloads с:
- `tests/e2e/support/mockNas.ts`
- `src/api/schema.d.ts`
- `src/lib/tasks.ts`

5. После обновления mock обязательно прогнать:

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e:mock
```

## 8. Как понять, какой тест упал и куда идти

### Упал `src/api/client.test.ts`
Сначала смотреть:
- `src/api/client.ts`
- `src/api/index.ts`
- `src/api/schema.d.ts`
- `src/lib/tasks.ts`

### Упал `tests/e2e/mockNas.contract.spec.ts`
Сначала смотреть:
- `tests/e2e/support/mockNas.ts`
- `src/api/schema.d.ts`
- `src/lib/tasks.ts`

### Упал `tests/e2e/popup.full-cycle.spec.ts`
Сначала смотреть:
- `tests/e2e/support/mockNas.ts`
- `tests/e2e/support/popup.ts`
- `tests/e2e/support/extension.ts`
- `src/popup/features/**`

### Упал real NAS spec
Сначала смотреть:
- env
- доступность NAS
- текущий реальный payload
- `.e2e-artifacts/*.log`
- `.e2e-artifacts/*.json`

## 9. Минимальный рабочий набор файлов, который стоит помнить

Если нужно быстро вернуться в проект спустя время, почти всегда достаточно начать с этих файлов:
- `package.json`
- `README.md`
- `tests/README.md`
- `tests/e2e/README.md`
- `.github/workflows/ci.yml`
- `tests/e2e/support/mockNas.ts`
- `tests/e2e/popup.full-cycle.spec.ts`
- `tests/e2e/popup.real-nas.spec.ts`
- `src/api/client.ts`
- `src/lib/tasks.ts`
- `src/api/schema.d.ts`

## 10. Что уже зафиксировано тестами сейчас

Сейчас тесты уже проверяют:
- login и reuse SID
- query body serialization (`limit`, `field`, и т.д.)
- multipart upload (`sid`, `temp`, `move`, `dest_path`, `bt`, `bt_task`)
- duplicate torrent handling (`24593`)
- отдельный mock-only contract тест для `mockNas`
- popup full cycle на mock NAS
- real NAS read-only smoke
- real NAS mutating flow только для suite-owned torrent
- contract `mockNas` под более real-like QNAP payload

## 11. Рекомендуемый порядок проверки в PR

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e:mock
```

А real NAS прогоны — только локально и по необходимости.


