/**
 * One-time manual login for the opt-in private-tracker E2E.
 *
 * Anti-bot protection refuses a Playwright-driven browser — headless and headed alike — so the
 * session cannot be established from a script. This opens a persistent profile and waits for a
 * manual login; the spec then reuses that profile, cookies and bot-check clearance included.
 *
 * Configure TRACKER_E2E_TOPIC in .env.e2e.local, then:
 *   npm run tracker:login
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const profileDir = path.join(rootDir, ".e2e-artifacts", "tracker-profile");

function readTopicUrl() {
  if (process.env.TRACKER_E2E_TOPIC) return process.env.TRACKER_E2E_TOPIC;

  const envFile = path.join(rootDir, ".env.e2e.local");
  if (!existsSync(envFile)) return "";

  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const match = /^\s*TRACKER_E2E_TOPIC\s*=\s*(.+?)\s*$/.exec(line);
    if (match) return match[1];
  }
  return "";
}

const topicUrl = readTopicUrl();
if (!topicUrl) {
  console.error("Set TRACKER_E2E_TOPIC in .env.e2e.local to the topic page you want to test.");
  process.exit(1);
}

const context = await chromium.launchPersistentContext(profileDir, {
  channel: "chromium",
  headless: false,
});

const page = context.pages()[0] ?? (await context.newPage());
await page.goto(topicUrl).catch(() => {});

console.log(`
Profile: ${profileDir}

Log in in the window that just opened, clear the bot check if it appears, and confirm the
download link is visible on the topic page. Then close the window — the session stays in the
profile.

Afterwards run:  npm run test:e2e:tracker
`);

await context.waitForEvent("close", { timeout: 0 });
