# Synology DSM / Download Station: анализ совместимости

Дата исследования: 20 июня 2026.

## Вывод

QuickGet может поддерживать Synology DSM с Download Station для основного сценария:
просмотр задач, добавление URL/magnet и `.torrent`, пауза, возобновление,
удаление и выбор папки назначения.

Это не прямое переиспользование QNAP-клиента. У Synology другой протокол
авторизации, динамическое обнаружение API и другой идентификатор задачи. До
подтверждения на реальном DSM нельзя обещать выбор отдельных файлов торрента и
полное соответствие удаления с файлами.

## Границы исследования

Исследование выполнено без установки неофициальной DSM/Xpenology и без
изменения кода. Основание:

- официальные руководства Synology по Login, Download Station и File Station API;
- текущий код QuickGet;
- документация Download Station DSM 7.

Нет публичного локального DSM в данном окружении, поэтому точное имя API и
поведение конкретной версии пакета Download Station должны быть подтверждены
позже на настоящем DSM.

## Совместимость функций

| Функция QuickGet | API Synology | Статус | Примечание |
| --- | --- | --- | --- |
| Вход | `SYNO.API.Auth:login` | Поддерживается | Нужны `_sid` и, если возвращён, `SynoToken`. |
| Проверка API | `SYNO.API.Info:query` | Обязательна | Нельзя жёстко задавать CGI-пути и версии. |
| Список задач | `SYNO.DownloadStation*.Task:list` | Поддерживается | Запрашивать `detail,transfer,file`. |
| Детали задачи | `Task:getinfo` | Поддерживается | Идентификатор — `id`, например `dbid_001`. |
| URL / magnet | `Task:create&uri=...` | Поддерживается | Документированы HTTP, FTP, magnet и ED2K. |
| Файл `.torrent` | `Task:create` с multipart `file` | Поддерживается | Параметры API безопаснее передавать в query, файл — последней multipart-частью. |
| Пауза | `Task:pause` | Поддерживается | |
| Возобновление | `Task:resume` | Поддерживается | Это соответствие кнопке Start. |
| Stop | Нет отдельного метода | Частично | Использовать `pause`; не заявлять отдельную семантику stop. |
| Удаление задачи | `Task:delete` | Поддерживается | Не соответствует точно QNAP `clean`; `force_complete` перемещает незавершённые данные в папку назначения. |
| Папки назначения | `SYNO.FileStation.List:list_share/list` | Поддерживается | Потребуются права File Station. |
| Суммарные скорости | `SYNO.DownloadStation.Statistic:getinfo` | Поддерживается | Возвращает скорости, но не счётчики задач. |
| Счётчик активных задач | Нет готового агрегата | Частично | Считать из ответа `Task:list`. |
| Список файлов торрента | `additional=file` | Поддерживается | Доступны имя, размер, скачанный размер, текущий priority. |
| Выбор файлов торрента | Публичный API не содержит mutator | Не подтверждено | Скрыть для Synology до проверки актуального DSM API. |

## Как должен обнаруживаться API

Synology API нельзя реализовывать через фиксированные URL. Первым запросом
нужно получить возможности конкретного NAS:

```text
GET /webapi/entry.cgi?api=SYNO.API.Info&version=1&method=query&query=all
```

В ответе для каждой доступной возможности возвращаются `path`, `minVersion` и
`maxVersion`. Из него выбирать:

- `SYNO.API.Auth`;
- доступный вариант `SYNO.DownloadStation*.Task`;
- `SYNO.DownloadStation.Statistic`;
- `SYNO.FileStation.List`.

Установленный пакет и версия DSM могут дать разные варианты, включая
`SYNO.DownloadStation.Task` и более новые семейства API. Если Download Station
не установлен, нужная возможность не появится в ответе: это должно быть
понятной ошибкой настройки, а не неясной ошибкой сети.

## Авторизация и сессия

1. Получить описание `SYNO.API.Auth` через `SYNO.API.Info`.
2. Выполнить `login` с `account`, `passwd`, именем сессии и
   `enable_syno_token=yes`.
3. Хранить `sid` и передавать его как `_sid` во все следующие запросы.
4. Если сервер вернул `synotoken`, передавать `SynoToken` в каждом запросе.
5. При кодах 106 (таймаут), 107 (прерванная сессия) или 119 (недействительная
   сессия) очищать состояние и один раз повторять безопасный запрос после
   повторного входа.

Для логина следует использовать POST и не помещать пароль в URL. В текущем
QNAP-клиенте обработка истечения сессии привязана к QNAP-коду `5`; её нельзя
переиспользовать.

Ограничения:

- учётная запись с двухфакторной аутентификацией потребует OTP или отдельной
  поддержки application password; текущая форма QuickGet хранит только логин и
  пароль;
- Download Station доступен локальным DSM-пользователям, но не domain/LDAP
  пользователям;
- для списка папок нужны разрешения File Station и права записи в выбранную
  общую папку;
- браузер не сможет проигнорировать недоверенный HTTPS-сертификат DSM.

## Формат задач и различия с QNAP

Synology возвращает успешный ответ в форме:

```json
{
  "success": true,
  "data": {
    "tasks": [
      {
        "id": "dbid_001",
        "title": "Example",
        "status": "downloading",
        "additional": {
          "detail": {},
          "transfer": {},
          "file": []
        }
      }
    ]
  }
}
```

Это важно для текущего кода:

- нормализатор должен читать `data.tasks`, а не только QNAP-массив `data`;
- действия `pause`, `resume`, `delete` и `getinfo` должны получать `task.id`,
  а не QNAP hash. URL торрента не является идентификатором задачи;
- запрос списка должен включать `detail,transfer,file`, иначе не будет
  скоростей, объёмов и списка файлов;
- `Task_Transfer` содержит `size_downloaded`, `size_uploaded`,
  `speed_download` и `speed_upload`; ratio можно вычислять как
  `size_uploaded / size`;
- `Task_File.priority` — строка `skip`, `low`, `normal` или `high`, а не
  QNAP-значение `0 | 1`;
- полный список статусов включает `waiting`, `downloading`, `paused`,
  `finishing`, `finished`, `hash_checking`, `seeding`,
  `filehosting_waiting`, `extracting`, `error`.

## Бейдж и мониторинг

`SYNO.DownloadStation.Statistic:getinfo` возвращает только общие upload/download
скорости (отдельно также eMule). Он не возвращает `active` и `all`, которые
использует QNAP API QuickGet.

Варианты:

- для бейджа с количеством задач выполнять лёгкий `Task:list` и считать
  активные статусы на клиенте;
- для бейджа только со скоростью использовать `Statistic:getinfo`;
- не выдавать синтетические счётчики за серверные данные.

Первый вариант согласован с текущим интерфейсом, но требует одного
дополнительного запроса раз в интервал polling.

## Папки и пути

Для выбора папки не используется Download Station API. Нужен File Station:

1. `SYNO.FileStation.List:list_share` — перечислить доступные общие папки;
2. `SYNO.FileStation.List:list` с `folder_path` — раскрывать подкаталоги;
3. отправлять путь назначения в `Task:create&destination=...`.

Пути Synology выглядят как `/video` или `/downloads`, в отличие от типичных
QNAP-путей `/share/Multimedia/Movies`. Значения настроек должны быть
нейтральными по вендору, а не иметь QNAP-значения по умолчанию.

## Что не следует обещать до живого теста

1. Изменение выбранных файлов внутри уже созданного торрент-задания. Публичное
   руководство показывает чтение приоритета файлов, но не описывает операцию
   его изменения.
2. Идентичное QNAP удаление задачи с физической очисткой данных.
3. Поддержку QuickConnect. Расширение должно работать с прямым DSM URL; маршрут
   QuickConnect и его редиректы пока не реализованы.
4. Вход с 2FA.
5. Совместимость с неподтверждённым HTTPS-сертификатом.

## Проверка перед выпуском

Минимальный smoke-test на реальном DSM 7 с установленным Download Station:

1. Вызвать `SYNO.API.Info` и сохранить фактические API names, paths и версии.
2. Войти обычным локальным пользователем с правами Download Station и File
   Station.
3. Добавить URL, magnet и файл `.torrent` в разные папки.
4. Получить список с `detail,transfer,file`; сверить ID, скорости, прогресс,
   статусы и ratio.
5. Проверить pause/resume/delete и поведение незавершённых файлов.
6. Проверить `list_share` и вложенную папку с ограниченными разрешениями.
7. Проверить 2FA, истечение сессии и недоверенный сертификат как ожидаемые
   диагностируемые случаи.
8. Отдельно проверить, есть ли в ответе DSM 7 API для изменения приоритета
   файлов. До положительного результата функция должна быть выключена для
   Synology.

## Решение по продукту

Поддержку Synology стоит планировать как отдельный API-адаптер, а не набор
условий в QNAP-клиенте. Пользовательский интерфейс в основном уже нейтрален.
Реалистичный первый релиз Synology:

- подключение по прямому адресу DSM;
- список задач и статистика;
- URL/magnet/`.torrent`;
- pause/resume/delete;
- выбор папки через File Station;
- прозрачные сообщения о правах, отсутствии Download Station и 2FA.

Выбор отдельных файлов и расширенная семантика удаления — последующий этап
после проверки на живом NAS.

## Источники

- [DSM Login Web API Guide](https://kb.synology.com/en-global/DG/DSM_Login_Web_API_Guide/1)
- [Synology Download Station Web API](https://global.download.synology.com/download/Document/Software/DeveloperGuide/Package/DownloadStation/All/enu/Synology_Download_Station_Web_API.pdf)
- [Synology File Station API Guide](https://global.download.synology.com/download/Document/Software/DeveloperGuide/Package/FileStation/All/enu/Synology_File_Station_API_Guide.pdf)
- [Download Station: управление задачами в DSM 7](https://kb.synology.com/tr-tr/DSM/help/DownloadStation/download_manage?version=7)
