# Synology DSM / Download Station: compatibility analysis

Research date: June 20, 2026.

## Conclusion

QuickGet can support Synology DSM with Download Station for the core scenario:
viewing tasks, adding URL/magnet and `.torrent`, pause, resume, delete, and
choosing a destination folder.

This is not a direct reuse of the QNAP client. Synology has a different
authorization protocol, dynamic API discovery, and a different task
identifier. Until confirmed on a real DSM, we cannot promise individual
torrent file selection or full parity of deletion with files.

## Research scope

The research was performed without installing an unofficial DSM/Xpenology and
without changing code. Basis:

- official Synology guides for Login, Download Station, and File Station API;
- current QuickGet code;
- Download Station DSM 7 documentation.

There is no public local DSM in this environment, so the exact API name and
behavior of a specific Download Station package version must be confirmed
later on a real DSM.

## Feature compatibility

| QuickGet feature | Synology API | Status | Note |
| --- | --- | --- | --- |
| Login | `SYNO.API.Auth:login` | Supported | Needs `_sid` and, if returned, `SynoToken`. |
| API check | `SYNO.API.Info:query` | Required | CGI paths and versions cannot be hardcoded. |
| Task list | `SYNO.DownloadStation*.Task:list` | Supported | Request `detail,transfer,file`. |
| Task details | `Task:getinfo` | Supported | Identifier is `id`, e.g. `dbid_001`. |
| URL / magnet | `Task:create&uri=...` | Supported | HTTP, FTP, magnet, and ED2K are documented. |
| `.torrent` file | `Task:create` with multipart `file` | Supported | API parameters are safer to pass in the query; the file as the last multipart part. |
| Pause | `Task:pause` | Supported | |
| Resume | `Task:resume` | Supported | This corresponds to the Start button. |
| Stop | No separate method | Partial | Use `pause`; do not claim separate stop semantics. |
| Delete task | `Task:delete` | Supported | Does not exactly match QNAP `clean`; `force_complete` moves incomplete data to the destination folder. |
| Destination folders | `SYNO.FileStation.List:list_share/list` | Supported | Requires File Station permissions. |
| Total speeds | `SYNO.DownloadStation.Statistic:getinfo` | Supported | Returns speeds, but not task counts. |
| Active task counter | No ready-made aggregate | Partial | Compute from the `Task:list` response. |
| Torrent file list | `additional=file` | Supported | Name, size, downloaded size, current priority are available. |
| Torrent file selection | Public API contains no mutator | Not confirmed | Hide for Synology until verified against the current DSM API. |

## How the API should be discovered

The Synology API cannot be implemented via fixed URLs. The first request must
obtain the capabilities of the specific NAS:

```text
GET /webapi/entry.cgi?api=SYNO.API.Info&version=1&method=query&query=all
```

The response returns `path`, `minVersion`, and `maxVersion` for each available
capability. From it, select:

- `SYNO.API.Auth`;
- the available variant of `SYNO.DownloadStation*.Task`;
- `SYNO.DownloadStation.Statistic`;
- `SYNO.FileStation.List`.

The installed package and DSM version may yield different variants, including
`SYNO.DownloadStation.Task` and newer API families. If Download Station is not
installed, the required capability will not appear in the response: this must
be a clear configuration error, not an unclear network error.

## Authorization and session

1. Obtain the `SYNO.API.Auth` description via `SYNO.API.Info`.
2. Perform `login` with `account`, `passwd`, a session name, and
   `enable_syno_token=yes`.
3. Store `sid` and pass it as `_sid` in all subsequent requests.
4. If the server returned `synotoken`, pass `SynoToken` in every request.
5. On codes 106 (timeout), 107 (session interrupted), or 119 (invalid
   session), clear state and retry the safe request once after re-login.

Login should use POST and must not put the password in the URL. In the
current QNAP client, session-expiration handling is tied to QNAP code `5`;
it cannot be reused.

Limitations:

- an account with two-factor authentication will require OTP or separate
  application-password support; the current QuickGet form stores only login
  and password;
- Download Station is available to local DSM users, but not to domain/LDAP
  users;
- listing folders requires File Station permissions and write access to the
  selected shared folder;
- the browser cannot ignore an untrusted DSM HTTPS certificate.

## Task format and differences from QNAP

Synology returns a successful response in the form:

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

This matters for the current code:

- the normalizer must read `data.tasks`, not only the QNAP array `data`;
- the `pause`, `resume`, `delete`, and `getinfo` actions must receive
  `task.id`, not a QNAP hash. The torrent URL is not a task identifier;
- the list request must include `detail,transfer,file`, otherwise there will
  be no speeds, sizes, or file list;
- `Task_Transfer` contains `size_downloaded`, `size_uploaded`,
  `speed_download`, and `speed_upload`; ratio can be computed as
  `size_uploaded / size`;
- `Task_File.priority` is a string `skip`, `low`, `normal`, or `high`, not
  the QNAP value `0 | 1`;
- the full list of statuses includes `waiting`, `downloading`, `paused`,
  `finishing`, `finished`, `hash_checking`, `seeding`,
  `filehosting_waiting`, `extracting`, `error`.

## Badge and monitoring

`SYNO.DownloadStation.Statistic:getinfo` returns only overall upload/download
speeds (separately for eMule as well). It does not return `active` and `all`,
which the QuickGet QNAP API uses.

Options:

- for a badge with a task count, run a lightweight `Task:list` and count
  active statuses on the client;
- for a speed-only badge, use `Statistic:getinfo`;
- do not present synthetic counters as server data.

The first option is consistent with the current UI but requires one
additional request per polling interval.

## Folders and paths

Folder selection does not use the Download Station API. File Station is
needed:

1. `SYNO.FileStation.List:list_share` — list available shared folders;
2. `SYNO.FileStation.List:list` with `folder_path` — expand subdirectories;
3. send the destination path to `Task:create&destination=...`.

Synology paths look like `/video` or `/downloads`, unlike typical QNAP paths
`/share/Multimedia/Movies`. Settings values must be vendor-neutral, not have
QNAP defaults.

## What not to promise before a live test

1. Changing selected files inside an already created torrent task. The
   public guide shows reading file priority but does not describe an
   operation to change it.
2. Identical QNAP task deletion with physical data cleanup.
3. QuickConnect support. The extension should work with a direct DSM URL;
   the QuickConnect route and its redirects are not yet implemented.
4. 2FA login.
5. Compatibility with an unconfirmed HTTPS certificate.

## Pre-release verification

Minimal smoke test on a real DSM 7 with Download Station installed:

1. Call `SYNO.API.Info` and save the actual API names, paths, and versions.
2. Log in as a regular local user with Download Station and File Station
   permissions.
3. Add a URL, magnet, and `.torrent` file to different folders.
4. Get the list with `detail,transfer,file`; verify ID, speeds, progress,
   statuses, and ratio.
5. Verify pause/resume/delete and the behavior of incomplete files.
6. Verify `list_share` and a nested folder with restricted permissions.
7. Verify 2FA, session expiration, and an untrusted certificate as expected
   diagnosable cases.
8. Separately check whether the DSM 7 response contains an API for changing
   file priority. Until a positive result, the feature must be disabled for
   Synology.

## Product decision

Synology support should be planned as a separate API adapter, not a set of
conditionals in the QNAP client. The UI is already largely vendor-neutral.
A realistic first Synology release:

- connection via a direct DSM address;
- task list and statistics;
- URL/magnet/`.torrent`;
- pause/resume/delete;
- folder selection via File Station;
- clear messages about permissions, missing Download Station, and 2FA.

Individual file selection and extended deletion semantics are a follow-up
stage after verification on a live NAS.

## Sources

- [DSM Login Web API Guide](https://kb.synology.com/en-global/DG/DSM_Login_Web_API_Guide/1)
- [Synology Download Station Web API](https://global.download.synology.com/download/Document/Software/DeveloperGuide/Package/DownloadStation/All/enu/Synology_Download_Station_Web_API.pdf)
- [Synology File Station API Guide](https://global.download.synology.com/download/Document/Software/DeveloperGuide/Package/FileStation/All/enu/Synology_File_Station_API_Guide.pdf)
- [Download Station: task management in DSM 7](https://kb.synology.com/tr-tr/DSM/help/DownloadStation/download_manage?version=7)
