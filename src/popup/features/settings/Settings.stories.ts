import type { Meta, StoryObj } from "@storybook/svelte-vite";

import SettingsShowcase from "./SettingsShowcase.svelte";

/**
 * The settings panel in the states that actually occur, rather than only the happy one.
 *
 * The incomplete states are the point: a configuration missing a folder produced no visible
 * signal anywhere, and every download silently stayed in the browser. Anything that changes how
 * a problem is presented should be reviewed here first.
 */
const meta = {
  title: "Features/Settings",
  component: SettingsShowcase,
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof SettingsShowcase>;

export default meta;

type Story = StoryObj<typeof meta>;

const CONNECTED = {
  NASsecure: false,
  NASaddress: "192.168.1.100",
  NASport: "8080",
  NASlogin: "admin",
  NASpassword: "hunter2",
  NAStempdir: "Download",
  NASdir: "Multimedia/Movies",
  torrentInterceptMode: "always",
  rememberPassword: true,
  theme: "auto",
  routingRules: [],
};

/** First run: nothing is set, and the panel has to say so before anything is downloaded. */
export const Unconfigured: Story = { args: { storage: {} } };

/** The state a working setup should look like. */
export const Configured: Story = { args: { storage: CONNECTED } };

/**
 * The case that broke silently in the field: everything filled in except the temporary folder,
 * which Download Station requires. Every torrent fails until it is set.
 */
export const MissingTempFolder: Story = { args: { storage: { ...CONNECTED, NAStempdir: "" } } };

/** Remembered but encrypted, with the session gone — the password cannot be shown. */
export const Locked: Story = {
  args: {
    storage: {
      ...CONNECTED,
      NASpassword: "",
      encryptedNASpassword: { iv: "x", salt: "y", data: "z" },
    },
  },
};

/** Routing rules present, which is where the form gets densest. */
export const WithRoutingRules: Story = {
  args: {
    storage: {
      ...CONNECTED,
      routingRules: [
        { namePattern: "*.mkv", destination: "Multimedia/Movies" },
        { domain: "*.example.com", destination: "Multimedia/Other" },
        { namePattern: "*.iso", destination: "Software" },
      ],
    },
  },
};

/** Interception off — the setting that quietly disabled the feature for whole profiles. */
export const InterceptionOff: Story = { args: { storage: { ...CONNECTED, torrentInterceptMode: "off" } } };

/** Configured but the NAS is switched off — the settings were never wrong. */
export const NasUnreachable: Story = {
  args: {
    storage: {
      ...CONNECTED,
      "qg:connectionHealth": { kind: "unreachable", lastCheckedAt: Date.now(), detail: "Failed to fetch" },
    },
  },
};

/** The NAS rejected the saved credentials — this one really does need the user. */
export const AuthenticationFailed: Story = {
  args: {
    storage: {
      ...CONNECTED,
      "qg:connectionHealth": { kind: "auth-failed", lastCheckedAt: Date.now() },
    },
  },
};

/** The settings screen behind its optional password. */
export const SettingsLocked: Story = {
  args: {
    storage: { ...CONNECTED, settingsLockEnabled: true, settingsLockVerifier: "stub" },
  },
};

/**
 * One story per tab, all on the same configured settings, so each panel's layout can be
 * reviewed without clicking through the others.
 */
export const TabConnection: Story = { args: { storage: CONNECTED, initialTab: "connection" } };
export const TabAppearance: Story = { args: { storage: CONNECTED, initialTab: "appearance" } };
export const TabAdvanced: Story = {
  args: { storage: { ...CONNECTED, routingRules: [{ namePattern: "*.mkv", destination: "Multimedia/Movies" }] }, initialTab: "advanced" },
};

