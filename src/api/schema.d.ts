/* eslint-disable @typescript-eslint/consistent-type-definitions */
/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
/* eslint-disable @typescript-eslint/ban-types */

/**
 * QNAP Download Station schema (inspired by Synology documentation)
 * Structured similar to openapi-typescript output for typed API helpers.
 */

export interface components {
  schemas: {
    BaseResponse: {
      error: number;
      reason?: string;
    };
    LoginResponse: components["schemas"]["BaseResponse"] & {
      user: string;
      sid: string;
    };
    DownloadStationStatus: {
      active: number;
      all: number;
      bt: number;
      completed: number;
      down_rate: number;
      downloading: number;
      inactive: number;
      paused: number;
      seeding: number;
      stopped: number;
      up_rate: number;
      url: number;
    };
    DownloadJob: {
      activity_time: number;
      caller: string;
      caller_meta: string;
      category: number;
      choose_files: number;
      comment: string;
      create_time: string;
      done: number;
      down_rate: number;
      down_size: number;
      error: number;
      eta: number;
      finish_time: string;
      hash: string;
      move: string;
      path: string;
      peers: number;
      priority: number;
      progress: number;
      seeds: number;
      share: number;
      size: number;
      source: string;
      source_name: string;
      start_time: string;
      state: number;
      temp: string;
      total_down: number;
      total_files: number;
      total_up: number;
      type: string;
      uid: number;
      up_rate: number;
      up_size: number;
      username: string;
      wakeup_time: string;
    };
    DownloadJobsListResponse: components["schemas"]["BaseResponse"] & {
      data: components["schemas"]["DownloadJob"][];
      status: components["schemas"]["DownloadStationStatus"];
      total: number;
    };
    TaskQueryRequest: {
      sid: string;
      limit?: number;
      from?: number;
      field?: string;
      direction?: "ASC" | "DESC";
      status?: string;
      type?: string;
    };
    AddUrlRequest: {
      sid: string;
      url: string;
      savepath?: string;
      temp?: string;
      move?: string;
    };
    ModifyTaskRequest: {
      sid: string;
      hash: string;
    };
    RemoveTaskRequest: components["schemas"]["ModifyTaskRequest"] & {
      clean?: 0 | 1;
    };
    AddTorrentRequest: {
      sid: string;
      bt?: Blob;
      bt_task?: Blob;
      file?: Blob;
      temp?: string;
      move?: string;
      dest_path?: string;
    };
  };
}

export interface paths {
  "/downloadstation/V4/Misc/Login": {
    post: {
      requestBody: {
        content: {
          "application/x-www-form-urlencoded": {
            user: string;
            pass: string;
          };
        };
      };
      responses: {
        200: {
          content: {
            "application/json": components["schemas"]["LoginResponse"];
          };
        };
      };
    };
  };
  "/downloadstation/V4/Task/Query": {
    post: {
      requestBody: {
        content: {
          "application/x-www-form-urlencoded": components["schemas"]["TaskQueryRequest"];
        };
      };
      responses: {
        200: {
          content: {
            "application/json": components["schemas"]["DownloadJobsListResponse"];
          };
        };
      };
    };
  };
  "/downloadstation/V4/Task/AddUrl": {
    post: {
      requestBody: {
        content: {
          "application/x-www-form-urlencoded": components["schemas"]["AddUrlRequest"];
        };
      };
      responses: {
        200: {
          content: {
            "application/json": components["schemas"]["BaseResponse"];
          };
        };
      };
    };
  };
  "/downloadstation/V4/Task/Start": {
    post: {
      requestBody: {
        content: {
          "application/x-www-form-urlencoded": components["schemas"]["ModifyTaskRequest"];
        };
      };
      responses: {
        200: {
          content: {
            "application/json": components["schemas"]["BaseResponse"];
          };
        };
      };
    };
  };
  "/downloadstation/V4/Task/Stop": {
    post: {
      requestBody: {
        content: {
          "application/x-www-form-urlencoded": components["schemas"]["ModifyTaskRequest"];
        };
      };
      responses: {
        200: {
          content: {
            "application/json": components["schemas"]["BaseResponse"];
          };
        };
      };
    };
  };
  "/downloadstation/V4/Task/Pause": {
    post: {
      requestBody: {
        content: {
          "application/x-www-form-urlencoded": components["schemas"]["ModifyTaskRequest"];
        };
      };
      responses: {
        200: {
          content: {
            "application/json": components["schemas"]["BaseResponse"];
          };
        };
      };
    };
  };
  "/downloadstation/V4/Task/Remove": {
    post: {
      requestBody: {
        content: {
          "application/x-www-form-urlencoded": components["schemas"]["RemoveTaskRequest"];
        };
      };
      responses: {
        200: {
          content: {
            "application/json": components["schemas"]["BaseResponse"];
          };
        };
      };
    };
  };
  "/downloadstation/V4/Task/AddTorrent": {
    post: {
      requestBody: {
        content: {
          "multipart/form-data": components["schemas"]["AddTorrentRequest"];
        };
      };
      responses: {
        200: {
          content: {
            "application/json": components["schemas"]["BaseResponse"];
          };
        };
      };
    };
  };
  "/downloadstation/V4/Task/AddTask": {
    post: {
      requestBody: {
        content: {
          "multipart/form-data": components["schemas"]["AddTorrentRequest"];
        };
      };
      responses: {
        200: {
          content: {
            "application/json": components["schemas"]["BaseResponse"];
          };
        };
      };
    };
  };
  "/downloadstation/V4/Task/Add": {
    post: {
      requestBody: {
        content: {
          "multipart/form-data": components["schemas"]["AddTorrentRequest"];
        };
      };
      responses: {
        200: {
          content: {
            "application/json": components["schemas"]["BaseResponse"];
          };
        };
      };
    };
  };
}

export type operations = {
  login: paths["/downloadstation/V4/Misc/Login"]["post"];
  queryTasks: paths["/downloadstation/V4/Task/Query"]["post"];
  addUrl: paths["/downloadstation/V4/Task/AddUrl"]["post"];
  startTask: paths["/downloadstation/V4/Task/Start"]["post"];
  stopTask: paths["/downloadstation/V4/Task/Stop"]["post"];
  pauseTask: paths["/downloadstation/V4/Task/Pause"]["post"];
  removeTask: paths["/downloadstation/V4/Task/Remove"]["post"];
  addTorrent: paths["/downloadstation/V4/Task/AddTorrent"]["post"];
  addTask: paths["/downloadstation/V4/Task/AddTask"]["post"];
  addLegacy: paths["/downloadstation/V4/Task/Add"]["post"];
};

export type ApiResponse<T extends keyof operations> =
  operations[T]["responses"][200]["content"]["application/json"];

export type ApiRequest<T extends keyof operations> =
  operations[T]["requestBody"]["content"]["application/x-www-form-urlencoded"];
