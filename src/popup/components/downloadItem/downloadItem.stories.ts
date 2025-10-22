import type { Meta, StoryObj } from "@storybook/html";

import type { Task, TaskStatus } from "@lib/tasks.js";
import { renderDownloadItem } from "./downloadItem.js";

interface DownloadItemStoryArgs {
  name: string;
  status: TaskStatus;
  progress: number;
  downSpeedBps: number;
  upSpeedBps: number;
  etaSec?: number;
  addedAt?: number;
  selected?: boolean;
}

const ALL_STATUSES: TaskStatus[] = [
  "queued",
  "downloading",
  "seeding",
  "paused",
  "stopped",
  "checking",
  "repairing",
  "extracting",
  "finishing",
  "finished",
  "error",
];

const DEFAULT_ARGS: DownloadItemStoryArgs = {
  name: "Ubuntu 24.04 LTS image",
  status: "downloading",
  progress: 45,
  downSpeedBps: 12_000_000,
  upSpeedBps: 1_200_000,
  etaSec: 3600,
  addedAt: Date.now(),
  selected: false,
};

const meta: Meta<DownloadItemStoryArgs> = {
  title: "Popup/DownloadItem",
  tags: ["autodocs"],
  render: (args) => {
    const task = createTask(args);
    const element = document.createElement("div");
    element.style.maxWidth = "420px";
    element.style.margin = "0 auto";
    element.innerHTML = renderDownloadItem(task, { selected: args.selected });
    const child = element.firstElementChild;
    if (!(child instanceof HTMLElement)) {
      throw new Error("Failed to render DownloadItem story");
    }
    return child;
  },
  argTypes: {
    status: {
      control: { type: "select" },
      options: ALL_STATUSES,
    },
    progress: {
      control: { type: "range", min: 0, max: 100, step: 1 },
    },
    selected: {
      control: { type: "boolean" },
    },
  },
  args: { ...DEFAULT_ARGS },
};

export default meta;

type Story = StoryObj<DownloadItemStoryArgs>;

export const Downloading: Story = {};

export const ActiveSelected: Story = {
  args: {
    selected: true,
  },
};

export const Paused: Story = {
  args: {
    status: "paused",
    progress: 62,
    downSpeedBps: 0,
    upSpeedBps: 0,
    etaSec: undefined,
  },
};

export const Finished: Story = {
  args: {
    status: "finished",
    progress: 100,
    downSpeedBps: 0,
    upSpeedBps: 0,
    etaSec: undefined,
    addedAt: Date.now() - 1000 * 60 * 60 * 4,
  },
};

export const Seeding: Story = {
  args: {
    status: "seeding",
    progress: 100,
    downSpeedBps: 0,
    upSpeedBps: 850_000,
    etaSec: undefined,
  },
};

export const ErrorState: Story = {
  args: {
    status: "error",
    progress: 10,
    downSpeedBps: 0,
    upSpeedBps: 0,
    etaSec: undefined,
    selected: false,
  },
};

export const LongNameQueued: Story = {
  args: {
    status: "queued",
    progress: 0,
    downSpeedBps: 0,
    upSpeedBps: 0,
    etaSec: undefined,
    name:
      "A Very Long Movie Title — Director's Cut Extended Edition [UltraHD Remaster] (2025) WebRip 1080p Dual Audio",
  },
};

export const Gallery: Story = {
  render: () => {
    const container = document.createElement("div");
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.gap = "16px";
    container.style.maxWidth = "420px";
    container.style.margin = "0 auto";

    const scenarios: DownloadItemStoryArgs[] = [
      { ...DEFAULT_ARGS, name: "Ubuntu 24.04 LTS image" },
      {
        ...DEFAULT_ARGS,
        name: "Ubuntu 24.04 LTS image (selected)",
        selected: true,
      },
      {
        ...DEFAULT_ARGS,
        name: "Fedora Workstation ISO",
        status: "paused",
        progress: 62,
        downSpeedBps: 0,
        upSpeedBps: 0,
        etaSec: undefined,
      },
      {
        ...DEFAULT_ARGS,
        name: "The Martian 4K",
        status: "finished",
        progress: 100,
        downSpeedBps: 0,
        upSpeedBps: 0,
        etaSec: undefined,
        addedAt: Date.now() - 1000 * 60 * 60 * 4,
      },
      {
        ...DEFAULT_ARGS,
        name: "Ubuntu Server Mirror Sync",
        status: "seeding",
        progress: 100,
        downSpeedBps: 0,
        upSpeedBps: 850_000,
        etaSec: undefined,
      },
      {
        ...DEFAULT_ARGS,
        name: "Old torrent archive",
        status: "error",
        progress: 10,
        downSpeedBps: 0,
        upSpeedBps: 0,
        etaSec: undefined,
        selected: false,
      },
      {
        ...DEFAULT_ARGS,
        name:
          "A Very Long Movie Title — Director's Cut Extended Edition [UltraHD Remaster] (2025) WebRip 1080p Dual Audio",
        status: "queued",
        progress: 0,
        downSpeedBps: 0,
        upSpeedBps: 0,
        etaSec: undefined,
        selected: false,
      },
    ];

    container.innerHTML = scenarios
      .map((scenario) => renderDownloadItem(createTask(scenario), { selected: scenario.selected }))
      .join("");

    return container;
  },
};

function createTask(args: DownloadItemStoryArgs): Task {
  const merged = { ...DEFAULT_ARGS, ...args };
  const sizeBytes = 8 * 1024 * 1024 * 1024; // 8 GB
  const downloadedBytes = Math.round((merged.progress / 100) * sizeBytes);
  return {
    id: "storybook-task",
    hash: "storybook-task",
    name: merged.name,
    status: merged.status,
    progress: merged.progress,
    sizeBytes,
    downloadedBytes,
    uploadedBytes: Math.round(merged.upSpeedBps / 4),
    downSpeedBps: merged.downSpeedBps,
    upSpeedBps: merged.upSpeedBps,
    etaSec: merged.etaSec,
    addedAt: merged.addedAt ?? Date.now(),
    source: "qnap",
    peers: { connected: 0 },
    seeds: { connected: 0 },
  };
}
