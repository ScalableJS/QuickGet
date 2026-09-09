import type { Task } from "@lib/tasks.js";
import type { Meta, StoryObj } from "@storybook/svelte-vite";

import DownloadItem from "./DownloadItem.svelte";
import DownloadItemGallery from "./DownloadItemGallery.svelte";

function task(over: Partial<Task> = {}): Task {
  return {
    id: "1",
    hash: "abc",
    name: "Ubuntu 24.04 LTS image",
    status: "downloading",
    progress: 42,
    sizeBytes: 2_400_000_000,
    downloadedBytes: 1_000_000_000,
    uploadedBytes: 620_000_000,
    downSpeedBps: 12_000_000,
    upSpeedBps: 800_000,
    etaSec: 2400,
    destination: "Multimedia/Movies",
    source: "qnap",
    ...over,
  };
}

const meta = {
  title: "Downloads/DownloadItem",
  component: DownloadItem,
  args: { onToggle: () => {}, selectedHash: null },
} satisfies Meta<typeof DownloadItem>;

export default meta;

type Story = StoryObj<typeof meta>;

export const DownloadingActive: Story = {
  args: {
    task: task({
      name: "Ubuntu 24.04 Desktop.iso",
      progress: 73,
      sizeBytes: 24_300_000_000,
      downloadedBytes: 17_800_000_000,
      downSpeedBps: 6_500_000,
      upSpeedBps: 420_000,
      etaSec: 220,
      seeds: { connected: 12 },
      peers: { connected: 4 },
    }),
  },
};

/** Stalled download with 0 B/s — swarm indicator (S 0 · P 1) instantly explains why it is stalled. */
export const DownloadingStalled: Story = {
  args: {
    task: task({
      name: "Debian 12 Netinst.iso",
      progress: 12,
      sizeBytes: 620_000_000,
      downloadedBytes: 74_400_000,
      downSpeedBps: 0,
      upSpeedBps: 0,
      etaSec: undefined,
      seeds: { connected: 0 },
      peers: { connected: 1 },
    }),
  },
};

/** Fetching torrent metadata via magnet link (renders Magnet icon). */
export const DownloadingMetadata: Story = {
  args: {
    task: task({
      name: "magnet:?xt=urn:btih:3b8c4... (resolving)",
      status: "downloadingMetadata",
      progress: 0,
      sizeBytes: 0,
      downloadedBytes: 0,
      downSpeedBps: 0,
      upSpeedBps: 0,
      seeds: { connected: 5 },
      peers: { connected: 2 },
    }),
  },
};

/** Active multi-file task exposes the compact disclosure control before the file list. */
export const MultiFile: Story = {
  args: {
    task: task({
      totalFiles: 4,
      seeds: { connected: 35 },
      peers: { connected: 12 },
    }),
  },
};

/** Active seeding task with emerald quota progress, seeding ETA, and share ratio. */
export const SeedingQuota: Story = {
  args: {
    task: task({
      name: "Arch Linux 2026.09.01 x86_64.iso",
      status: "seeding",
      progress: 25,
      sizeBytes: 1_600_000_000,
      downloadedBytes: 1_600_000_000,
      uploadedBytes: 400_000_000,
      downSpeedBps: 0,
      upSpeedBps: 2_100_000,
      etaSec: 1341,
      shareRatio: 0.25,
      peers: { connected: 4 },
    }),
  },
};

/** Completed task displaying clean final size and status. */
export const Finished: Story = {
  args: {
    task: task({
      name: "Fedora 40 Workstation.iso",
      status: "finished",
      progress: 100,
      sizeBytes: 2_100_000_000,
      downloadedBytes: 2_100_000_000,
      downSpeedBps: 0,
      upSpeedBps: 0,
      etaSec: undefined,
    }),
  },
};

/** QNAP error 20488: human-readable disk full explanation instead of raw code. */
export const ErrorDiskFull: Story = {
  args: {
    task: task({
      name: "Huge 4K Video Render.mkv",
      status: "error",
      progress: 88,
      sizeBytes: 51_400_000_000,
      downloadedBytes: 45_200_000_000,
      errorCode: 20488,
    }),
  },
};

/** QNAP error 8196: duplicate task notice. */
export const ErrorDuplicate: Story = {
  args: {
    task: task({
      name: "Ubuntu 24.04 LTS image",
      status: "error",
      progress: 0,
      sizeBytes: 2_400_000_000,
      downloadedBytes: 0,
      errorCode: 8196,
    }),
  },
};

/** QNAP error 4096: missing target folder notice. */
export const ErrorFolderNotFound: Story = {
  args: {
    task: task({
      name: "Archive Dataset.tar.gz",
      status: "error",
      progress: 0,
      sizeBytes: 10_000_000_000,
      downloadedBytes: 0,
      errorCode: 4096,
    }),
  },
};

export const Selected: Story = {
  args: { task: task({ seeds: { connected: 18 }, peers: { connected: 6 } }), selectedHash: "abc" },
};

export const Removing: Story = {
  args: { task: task(), removing: true },
};

/** All statuses at once — visual regression surface for icons + colours. */
export const AllStatuses: StoryObj = {
  render: () => ({ Component: DownloadItemGallery }),
};

/**
 * Where a download lands is on the card, which is the answer to "did my rule work" that used to
 * require opening Settings and guessing. No competitor shows it: the nearest one hides the path
 * behind a click-to-copy on the title, and the other two never surface it at all.
 */
export const DestinationShortPath: Story = {
  args: { task: task({ name: "Some.Movie.2024.1080p.mkv", destination: "Movies" }) },
};

/** Two segments fit as they are — one would lose what tells `Movies` apart from `Music/Movies`. */
export const DestinationTwoSegments: Story = {
  args: { task: task({ name: "Some.Show.S01.1080p.WEB-DL", destination: "Multimedia/Series" }) },
};

/** A deep path folds from the front: the end is the part that identifies the folder. */
export const DestinationDeepPath: Story = {
  args: {
    task: task({
      name: "Documentary.Collection.2024",
      destination: "Multimedia/Video/Documentaries/2024",
    }),
  },
};

/** A path long enough to need the card's own truncation, not just the two-segment fold. */
export const DestinationVeryLongName: Story = {
  args: {
    task: task({
      name: "A.Very.Long.Release.Name.That.Competes.For.The.Same.Row.2024.2160p.mkv",
      downSpeedBps: 24_000_000,
      destination: "Multimedia/Extremely Long Folder Name For Layout Testing",
    }),
  },
};

/** The NAS reported no destination. Nothing is shown — an empty label would be a guess. */
export const DestinationUnknown: Story = {
  args: { task: task({ destination: undefined }) },
};

/** Finished is where the destination matters most: it says where to go and look. */
export const FinishedWithDestination: Story = {
  args: {
    task: task({
      name: "Ubuntu 24.04 Desktop.iso",
      status: "finished",
      progress: 100,
      downloadedBytes: 2_400_000_000,
      downSpeedBps: 0,
      upSpeedBps: 0,
      etaSec: 0,
      destination: "Software/ISO",
    }),
  },
};
