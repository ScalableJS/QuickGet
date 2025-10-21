
export type Vendor = "synology" | "qnap";

export type TaskStatus =
  | "queued"
  | "downloading"
  | "seeding"
  | "paused"
  | "stopped"
  | "checking"
  | "repairing"
  | "extracting"
  | "finishing"
  | "finished"
  | "error";

export interface Task {
  id: string;
  name: string;
  status: TaskStatus;
  progress: number;
  sizeBytes: number;
  downloadedBytes: number;
  uploadedBytes: number;
  downSpeedBps: number;
  upSpeedBps: number;
  seeds?: { connected: number; total?: number };
  peers?: { connected: number; total?: number };
  etaSec?: number;
  hash?: string;
  addedAt?: number;
  source?: Vendor;
}

const synologyToUnified: Record<string, TaskStatus> = {
  waiting: "queued",
  downloading: "downloading",
  seeding: "seeding",
  paused: "paused",
  stopped: "stopped",
  hash_checking: "checking",
  repairing: "repairing",
  extracting: "extracting",
  finishing: "finishing",
  finished: "finished",
  error: "error",
};

const qnapToUnified: Record<string, TaskStatus> = {
  queued: "queued",
  waiting: "queued",
  downloading: "downloading",
  seeding: "seeding",
  paused: "paused",
  stopped: "stopped",
  checking: "checking",
  repairing: "repairing",
  extracting: "extracting",
  finishing: "finishing",
  finished: "finished",
  complete: "finished",
  error: "error",
};

const mapStatus = (vendor: Vendor, raw: string): TaskStatus => {
  const keyString = String(raw ?? "").trim().toLowerCase();

  if (vendor === "qnap") {
    const numeric = Number(keyString);
    if (!Number.isNaN(numeric)) {
      const mapped = qnapNumericStates[numeric];
      if (mapped) return mapped;
    }
    return qnapToUnified[keyString] ?? "queued";
  }

  if (vendor === "synology") {
    const numeric = Number(keyString);
    if (!Number.isNaN(numeric)) {
      const mapped = synologyNumericStates[numeric];
      if (mapped) return mapped;
    }
    return synologyToUnified[keyString] ?? "queued";
  }

  return "error";
};

const synologyNumericStates: Record<number, TaskStatus> = {
  0: "queued",
  1: "downloading",
  2: "downloading",
  3: "seeding",
  4: "paused",
  5: "finished",
};

const qnapNumericStates: Record<number, TaskStatus> = {
  0: "queued",
  1: "queued",
  2: "downloading",
  3: "paused",
  4: "error",
  5: "finished",
  6: "downloading",
  7: "error",
  8: "finishing",
  9: "checking",
  100: "seeding",
  101: "checking",
  102: "checking",
  103: "finishing",
  104: "downloading",
  105: "seeding",
};

export const normalizeSynology = (task: any): Task => {
  const size = Number(task.size ?? task.additional?.transfer?.size ?? 0);
  const downloaded = Number(task.additional?.transfer?.size_downloaded ?? 0);

  return {
    id: String(task.id ?? task.task_id ?? task.hash ?? crypto.randomUUID()),
    name:
      String(
        task.title ??
          task.display_name ??
          task.additional?.detail?.destination ??
          "task"
      ),
    status: mapStatus("synology", task.status ?? ""),
    progress:
      size > 0
        ? Math.max(0, Math.min(100, (downloaded / size) * 100))
        : Number(task.additional?.transfer?.progress ?? 0),
    sizeBytes: size,
    downloadedBytes: downloaded,
    uploadedBytes: Number(task.additional?.transfer?.size_uploaded ?? 0),
    downSpeedBps: Number(task.additional?.transfer?.speed_download ?? 0),
    upSpeedBps: Number(task.additional?.transfer?.speed_upload ?? 0),
    seeds: {
      connected: Number(task.additional?.detail?.connected_seeders ?? 0),
      total:
        task.additional?.detail?.seeders != null
          ? Number(task.additional.detail.seeders)
          : undefined,
    },
    peers: {
      connected: Number(task.additional?.detail?.connected_leechers ?? 0),
      total:
        task.additional?.detail?.leechers != null
          ? Number(task.additional.detail.leechers)
          : undefined,
    },
    etaSec:
      task.additional?.transfer?.eta != null
        ? Number(task.additional.transfer.eta)
        : undefined,
    hash:
      task.hash ??
      task.additional?.detail?.uri ??
      task.additional?.detail?.destination ??
      undefined,
    addedAt:
      task.additional?.detail?.create_time != null
        ? Number(task.additional.detail.create_time)
        : undefined,
    source: "synology",
  };
};

export const normalizeQnap = (task: any): Task => {
  const size = Number(task.total_size ?? task.size ?? 0);
  const downloaded = Number(task.total_down ?? task.done ?? task.down_size ?? task.completed ?? 0);
  const uploaded = Number(task.total_up ?? task.up_size ?? task.uploaded_size ?? task.uploaded ?? 0);
  
  const created =
    task.create_time ??
    task.created ??
    task.added_time ??
    task.start_time ??
    null;

  const addedAt =
    created != null
      ? typeof created === "number"
        ? created > 1e12
          ? Number(created)
          : Number(created) * 1000
        : parseDateToEpoch(created)
      : undefined;

  // Приоритет для прогресса:
  // 1. Если есть task.progress и оно валидное (0-100), используем его
  // 2. Иначе вычисляем из downloaded/size
  const rawProgress = Number(task.progress ?? -1);
  const hasValidProgress = rawProgress >= 0 && rawProgress <= 100;
  
  const calculatedProgress = size > 0
    ? Math.max(0, Math.min(100, (downloaded / size) * 100))
    : 0;
  
  const progress = hasValidProgress ? rawProgress : calculatedProgress;

  return {
    id: String(task.id ?? task.gid ?? task.hash ?? crypto.randomUUID()),
    name: String(task.name ?? task.title ?? task.source ?? task.source_name ?? "task"),
    status: mapStatus("qnap", task.status ?? task.state ?? ""),
    progress,
    sizeBytes: size,
    downloadedBytes: downloaded,
    uploadedBytes: uploaded,
    downSpeedBps: Number(task.down_rate ?? task.download_speed ?? 0),
    upSpeedBps: Number(task.up_rate ?? task.upload_speed ?? 0),
    seeds: {
      connected: Number(task.seeds ?? task.seeds_connected ?? 0),
      total:
        task.seeds_total != null ? Number(task.seeds_total) : undefined,
    },
    peers: {
      connected: Number(task.peers ?? task.peers_connected ?? 0),
      total:
        task.peers_total != null ? Number(task.peers_total) : undefined,
    },
    etaSec: task.eta != null && task.eta >= 0 ? Number(task.eta) : task.remain_time != null ? Number(task.remain_time) : undefined,
    hash: task.hash ?? task.bt_hash ?? undefined,
    addedAt,
    source: "qnap",
  };
};

export const normalizeTasks = (vendor: Vendor, payload: any): Task[] => {
  const list: any[] = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.tasks)
    ? payload.tasks
    : Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.result)
    ? payload.result
    : [];

  return vendor === "synology" ? list.map(normalizeSynology) : list.map(normalizeQnap);
};

function parseDateToEpoch(value: string): number | undefined {
  const normalized = value.replace(/\./g, "/").replace(" ", "T");
  const parsed = Date.parse(normalized);
  if (!Number.isNaN(parsed)) {
    return parsed;
  }
  const fallback = Date.parse(`${normalized}Z`);
  if (!Number.isNaN(fallback)) {
    return fallback;
  }
  return undefined;
}
