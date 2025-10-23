
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
  priority?: number;
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
  1: "queued", // Может быть paused - определяется по прогрессу
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

type RawTaskRecord = Record<string, unknown>;

const asRecord = (value: unknown): RawTaskRecord =>
  typeof value === "object" && value !== null ? (value as RawTaskRecord) : {};

const parseNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
};

const readNumber = (value: unknown, fallback = 0): number =>
  parseNumber(value) ?? fallback;

const parseOptionalNumber = (value: unknown): number | undefined =>
  parseNumber(value);

const parseString = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return undefined;
};

const readString = (value: unknown, fallback = ""): string =>
  parseString(value) ?? fallback;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const toRecordArray = (value: unknown): RawTaskRecord[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is RawTaskRecord => typeof item === "object" && item !== null)
    .map((item) => item as RawTaskRecord);
};

export const normalizeSynology = (input: unknown): Task => {
  const task = asRecord(input);
  const additional = asRecord(task.additional);
  const transfer = asRecord(additional.transfer);
  const detail = asRecord(additional.detail);

  const size = readNumber(task.size ?? transfer.size, 0);
  const downloaded = readNumber(transfer.size_downloaded, 0);

  const seedsTotal = parseOptionalNumber(detail.seeders);
  const peersTotal = parseOptionalNumber(detail.leechers);
  const eta =
    parseOptionalNumber(transfer.eta) ??
    parseOptionalNumber(detail.eta);
  const createdAt = parseOptionalNumber(detail.create_time);

  return {
    id: readString(task.id ?? task.task_id ?? task.hash ?? crypto.randomUUID()),
    name: readString(
      task.title ??
        task.display_name ??
        detail.destination ??
        "task"
    ),
    status: mapStatus("synology", readString(task.status ?? "", "")),
    progress:
      size > 0
        ? clamp((downloaded / size) * 100, 0, 100)
        : readNumber(transfer.progress, 0),
    sizeBytes: size,
    downloadedBytes: downloaded,
    uploadedBytes: readNumber(transfer.size_uploaded, 0),
    downSpeedBps: readNumber(transfer.speed_download, 0),
    upSpeedBps: readNumber(transfer.speed_upload, 0),
    seeds: {
      connected: readNumber(detail.connected_seeders, 0),
      total: seedsTotal,
    },
    peers: {
      connected: readNumber(detail.connected_leechers, 0),
      total: peersTotal,
    },
    etaSec: eta,
    hash:
      parseString(task.hash) ??
      parseString(detail.uri) ??
      parseString(detail.destination) ??
      undefined,
    addedAt: createdAt,
    priority: parseOptionalNumber(task.priority),
    source: "synology",
  };
};

export const normalizeQnap = (input: unknown): Task => {
  const task = asRecord(input);

  const size = readNumber(task.total_size ?? task.size, 0);
  const downloaded = readNumber(
    task.total_down ?? task.done ?? task.down_size ?? task.completed,
    0
  );
  const uploaded = readNumber(
    task.total_up ?? task.up_size ?? task.uploaded_size ?? task.uploaded,
    0
  );

  const created =
    task.create_time ??
    task.created ??
    task.added_time ??
    task.start_time ??
    null;

  const addedAt =
    typeof created === "number"
      ? created > 1e12
        ? created
        : created * 1000
      : typeof created === "string"
        ? parseDateToEpoch(created)
        : undefined;

  const rawProgress = parseOptionalNumber(task.progress);
  const hasValidProgress =
    rawProgress !== undefined && rawProgress >= 0 && rawProgress <= 100;

  const calculatedProgress =
    size > 0 ? clamp((downloaded / size) * 100, 0, 100) : 0;

  const progress = hasValidProgress ? rawProgress : calculatedProgress;

  let status = mapStatus(
    "qnap",
    readString(task.status ?? task.state ?? "", "")
  );

  const activityTime = readNumber(task.activity_time, -1);
  const downRate = readNumber(task.down_rate ?? task.download_speed, 0);
  const upRate = readNumber(task.up_rate ?? task.upload_speed, 0);
  const rawState = readNumber(task.status ?? task.state, 0);
  const peers = readNumber(task.peers ?? task.peers_connected, 0);
  const seeds = readNumber(task.seeds ?? task.seeds_connected, 0);

  if (rawState === 3 && progress >= 99 && activityTime > 0) {
    status = "finishing";
  } else if (rawState === 1 && progress > 0) {
    status = "paused";
  }

  if (
    (rawState === 2 ||
      rawState === 6 ||
      rawState === 104 ||
      rawState === 102) &&
    activityTime === 0 &&
    downRate === 0 &&
    upRate === 0 &&
    progress < 100
  ) {
    status = "stopped";
  }

  if (
    rawState === 102 &&
    progress > 0 &&
    progress < 100 &&
    downRate === 0 &&
    peers === 0 &&
    seeds === 0 &&
    activityTime > 0
  ) {
    status = "queued";
  }

  const seedsTotal = parseOptionalNumber(task.seeds_total);
  const peersTotal = parseOptionalNumber(task.peers_total);
  const etaValue =
    parseOptionalNumber(task.eta) ?? parseOptionalNumber(task.remain_time);

  return {
    id: readString(task.id ?? task.gid ?? task.hash ?? crypto.randomUUID()),
    name: readString(
      task.name ?? task.title ?? task.source ?? task.source_name ?? "task"
    ),
    status,
    progress,
    sizeBytes: size,
    downloadedBytes: downloaded,
    uploadedBytes: uploaded,
    downSpeedBps: downRate,
    upSpeedBps: upRate,
    seeds: {
      connected: seeds,
      total: seedsTotal,
    },
    peers: {
      connected: peers,
      total: peersTotal,
    },
    etaSec: etaValue != null && etaValue >= 0 ? etaValue : undefined,
    hash:
      parseString(task.hash) ??
      parseString(task.bt_hash) ??
      undefined,
    addedAt,
    priority: parseOptionalNumber(task.priority),
    source: "qnap",
  };
};

export const normalizeTasks = (vendor: Vendor, payload: unknown): Task[] => {
  const root = asRecord(payload);
  const variants = [
    toRecordArray(payload),
    toRecordArray(root.tasks),
    toRecordArray(root.data),
    toRecordArray(root.result),
  ];

  const list = variants.find((items) => items.length > 0) ?? [];

  return vendor === "synology"
    ? list.map((item) => normalizeSynology(item))
    : list.map((item) => normalizeQnap(item));
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
