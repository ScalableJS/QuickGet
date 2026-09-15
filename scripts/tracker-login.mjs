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

export function normalizeTopicUrl(value) {
  const topicUrl = value.trim();
  if (
    topicUrl.length >= 2 &&
    ((topicUrl.startsWith('"') && topicUrl.endsWith('"')) || (topicUrl.startsWith("'") && topicUrl.endsWith("'")))
  ) {
    return topicUrl.slice(1, -1);
  }
  return topicUrl;
}

export function parseTopicTarget(value) {
  const topicUrl = normalizeTopicUrl(value);
  if (!topicUrl) return null;

  try {
    const target = new URL(topicUrl);
    if (target.protocol !== "http:" && target.protocol !== "https:") return null;
    return { topicUrl: target.toString(), origin: target.origin };
  } catch {
    return null;
  }
}

function readTopicUrl() {
  if (process.env.TRACKER_E2E_TOPIC) return normalizeTopicUrl(process.env.TRACKER_E2E_TOPIC);

  const envFile = path.join(rootDir, ".env.e2e.local");
  if (!existsSync(envFile)) return "";

  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const match = /^\s*TRACKER_E2E_TOPIC\s*=\s*(.+?)\s*$/.exec(line);
    if (match) return normalizeTopicUrl(match[1]);
  }
  return "";
}

async function run() {
  const topicUrl = readTopicUrl();
  if (!topicUrl) {
    console.error("Set TRACKER_E2E_TOPIC in .env.e2e.local to the topic page you want to test.");
    process.exitCode = 1;
    return;
  }

  const topic = parseTopicTarget(topicUrl);
  if (!topic) {
    console.error("TRACKER_E2E_TOPIC must be an absolute HTTP(S) URL. Update .env.e2e.local and try again.");
    process.exitCode = 1;
    return;
  }

  const context = await chromium.launchPersistentContext(profileDir, {
    channel: "chromium",
    headless: false,
  });

  const page = context.pages()[0] ?? (await context.newPage());
  try {
    await page.goto(topic.topicUrl);
  } catch {
    console.error(
      `Could not open ${topic.origin}. Check that the topic page is reachable, then update TRACKER_E2E_TOPIC and try again.`,
    );
    await context.close();
    process.exitCode = 1;
    return;
  }

  console.log(`
Profile: ${profileDir}

Log in in the window that just opened, clear the bot check if it appears, and confirm the
download link is visible on the topic page. Then close the window — the session stays in the
profile.

Afterwards run:  npm run test:e2e:tracker
`);

  await context.waitForEvent("close", { timeout: 0 });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await run();
}
