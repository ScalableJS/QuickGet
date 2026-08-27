# Архитектура popup

Документ описывает целевую организацию кода popup-расширения — какие модули нужны, как они взаимодействуют и где хранятся общие зависимости. Это не «план работ», а эталон, на который стоит равняться при рефакторинге.

## Цели и принципы

- разделить ответственность: UI-компоненты, бизнес-логика фич и общие утилиты;
- убрать глобальные переменные из `src/popup/index.ts`;
- переиспользовать уже существующие модули (`@lib/settings`, `@api/client`, рендер `components/downloadItem`);
- сохранить текущее поведение (включая горячие клавиши, автообновление, копирование логов), но сделать его прозрачным и тестируемым;
- обеспечить единый слой координации между фичами (например, выбор загрузки должен обновлять тулбар и статус).

### Слои

- **Components** — чистые функции/классы, отвечающие только за рендер. Не знают об API, состоянии и побочных эффектах.
- **Features** — концентрируют бизнес-логику, работают с состоянием, API, DOM-событиями и orchestrate компоненты.
- **Shared** — общие утилиты, которые могут вызывать все слои (форматирование, morphdom-обёртки, кеш API).

## Структура директорий

```
src/popup/
├── index.ts                       # точка входа, координирует фичи
├── index.html
├── index.css
│
├── components/
│   ├── downloadItem/
│   │   ├── downloadItem.ts        # готовый рендер элемента загрузки
│   │   ├── downloadItem.stories.ts
│   │   └── index.ts
│   ├── statusPill/
│   │   ├── statusPill.ts          # рендер и API статуса
│   │   └── index.ts
│   └── index.ts                   # единая точка экспорта UI-компонентов
│
├── features/
│   ├── downloads/
│   │   ├── downloadsManager.ts    # работа с API Download Station
│   │   ├── downloadsState.ts      # selectedHash, snapshot, observable события
│   │   ├── downloadsUI.ts         # навешивание обработчиков, morphdom-обновления
│   │   ├── autoRefresh.ts         # автообновление и синхронизация с тулбаром
│   │   └── index.ts
│   ├── settings/
│   │   ├── settingsUI.ts           # DOM-логика формы настроек
│   │   ├── connectionTest.ts       # кнопка проверки подключения
│   │   └── index.ts
│   ├── toolbar/
│   │   ├── toolbarActions.ts       # start/stop/remove/add/settings toggle
│   │   ├── toolbarState.ts         # enable/disable кнопок, подписка на состояние загрузок
│   │   └── index.ts
│   ├── upload/
│   │   ├── torrentUpload.ts        # единая точка обработки `<input type=file>`
│   │   ├── duplicateCheck.ts       # использует snapshot из downloadsState
│   │   └── index.ts
│   ├── debug/
│   │   ├── debugLogger.ts          # добавление/очистка/копирование логов
│   │   ├── debugUI.ts              # отображение панели и подписка на enableDebug
│   │   └── index.ts
│   └── index.ts                    # публичные init‑методы фич
│
├── shared/
│   ├── formatters/
│   │   ├── speed.ts                # формат скорости
│   │   ├── time.ts                 # формат ETA (резерв)
│   │   └── date.ts                 # формат даты (резерв)
│   ├── dom/
│   │   ├── morphdom.ts             # обёртки над morphDOMUpdate/List
│   │   └── index.ts
│   └── api/
│       ├── clientCache.ts          # кеш createApiClient
│       └── index.ts
│
└── types/
    └── popup.types.ts              # локальные типы, которых нет в @lib (если реально нужны)
```

> Если дополнительный тип уже описан в `src/lib`, используем импорт оттуда. Новый файл в `types/` оправдан, только когда тип доменно относится исключительно к popup.

## Детализация фич

### Downloads

- `downloadsManager` использует `createApiClient` из `@api/client` и кеш из `shared/api/clientCache`. Отвечает за `list`, `start`, `stop`, `remove`.
- `downloadsState` хранит `selectedHash`, `snapshot` (hashes + normalized names), публикует события (`onSelectionChanged`, `onSnapshotUpdated`). Туда перемещаются глобальные переменные из текущего `index.ts`.
- `downloadsUI` интегрирует `renderDownloadsList` из `components/downloadItem` (существующий `render/downloads.ts` переносится сюда и реэкспортируется), управляет `morphDOM` и кликами по списку. При обновлении списка запрашивает `downloadsState` и сигнализирует тулбару.
- `autoRefresh` регулирует интервал обновления, слушает `toolbar` (кнопки Play/Stop/Pause) и сообщает статус (например, для смены подписи на кнопке).

Верхнеуровневый API: `initializeDownloads(options)` возвращает объект с методами `refreshNow`, `getSelectedHash`, `subscribe`.

### Settings

- Сохраняет/читает данные через `@lib/settings`. Локальная логика — только сбор/валидация формы.
- `settingsUI` отвечает за показ панели, синхронизацию чекбоксов, отключение списка загрузок при открытых настройках.
- `connectionTest` использует `createApiClient` напрямую (без кеша) и публикует результат через `components/statusPill`.

### Toolbar

- `toolbarActions` реализует текущее поведение: `Play/Stop` работают с выбранным торрентом, `Remove` удаляет через downloadsManager, `Add` открывает `<input>`, `Settings` переключает панель. `Pause` (если нужна) управляет автообновлением, но фактическое наличие кнопки сверяется с HTML.
- Tooltips/aria-атрибуты в `index.html` должны соответствовать этой логике (если требуется, часть rewording вёрстки).
- `toolbarState` подписывается на `downloadsState` и автообновление, включает/выключает кнопки, выставляет `aria-disabled`.

### Upload

- `torrentUpload` обрабатывает событие `change` у `<input>`. Вызывает `duplicateCheck`, который читает snapshot из `downloadsState`. В случае успеха вызывает `downloadsManager.refresh` по завершении добавления (через экспорт из downloads-фичи, без прямого импорта `listDownloads`).

### Debug

- `debugLogger` хранит массив строк и публичные методы `add`, `clear`, `copy`. Состояние `enabled` берётся из настроек либо переключателя UI.
- `debugUI` отвечает за дом-узлы `details.debug-section`, обновляет содержимое и слушает чекбокс `enableDebug`. Статус меняется через `downloadsState` и `components/statusPill` (для сообщений «Logs copied», «Logs cleared»).

## Компоненты

- `downloadItem` — остаётся чистым компонентом (уже реализовано). Вызов через `renderDownloadsList` внутри downloadsUI.
- `statusPill` — новый компонент, инкапсулирует работу с `#status`/`#status-message` и таймер автоскрытия. Экспортирует `showStatus(type)` и `clearStatus()`.

Другие UI-элементы (иконки, кнопки) пока остаются в вёрстке; при появлении сложных блоков их выносим в `components/`.

## Shared-утилиты

- `formatters/speed.ts` содержит текущую `formatRate`. При необходимости форматов времени/дат добавляем новые файлы, но используем единые функции везде (download item, статус, тулы).
- `dom/morphdom.ts` предоставляет обёртки `updateElement(target, html, options?)` и `updateList(target, html)`. После переноса обновляем алиасы в `tsconfig.json` / `vite.config.ts`, чтобы `@popup/update/dom` ссылался на новую локацию.
- `api/clientCache.ts` хранит `clientCache` (ранее глобальная переменная). Экспортирует `getCachedClient()` и `invalidateClientCache()` — вызываем их из settings (после сохранения) и downloads.

## Координация в `index.ts`

Точка входа настраивает DOM и связывает фичи:

```ts
import { initializeDownloads } from "./features/downloads";
import { initializeSettings } from "./features/settings";
import { initializeToolbar } from "./features/toolbar";
import { initializeUpload } from "./features/upload";
import { initializeDebug } from "./features/debug";

document.addEventListener("DOMContentLoaded", async () => {
  const downloads = await initializeDownloads();
  const settings = await initializeSettings({ onDebugToggle: initializeDebug });
  const debug = await initializeDebug();
  const upload = await initializeUpload({ downloads });
  await initializeToolbar({ downloads, settings, upload, debug });
});
```

Каждый `initialize*` возвращает объект с публичными методами (например, `downloads.refreshNow`, `toolbar.disableAutoRefresh`). Это избавляет от прямых импортов между фичами и делает связи явными.

## Рекомендации по внедрению

- **HTML и ARIA**: выровнять подписи и `aria-label` кнопок тулбара с фактической логикой (start/stop torrent, toggle settings и т.д.).
- **Storybook**: после переноса компонентов обновить сторисы (`downloadItem`) и добавить новые для `statusPill`.
- **События**: централизованно прокинуть уведомления (selection change, snapshot change, autoRefresh state) через `downloadsState`, чтобы тулбар и аплоад подписывались, а не читали DOM.
- **Проверка поведения**: сохранить автообновление, очистку ресурсов в `beforeunload`, копирование логов и работу duplicate check — все эти сценарии должны быть покрыты в новых модулях.
- **Типы**: перед созданием отдельных интерфейсов убедиться, что аналогов нет в `src/lib`. Новый `types/popup.types.ts` добавлять только для специфичных типов UI.

## Ожидаемый результат

- `src/popup/index.ts` — ~80 строк, только инициализация и сбор зависимостей.
- Остальные файлы — небольшие и тематические (30–100 строк).
- Любая фича может тестироваться изолированно (mock API, mock DOM).
- Добавление новых действий или UI-элементов не требует изменения огромного монолитного файла.
