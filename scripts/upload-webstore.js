#!/usr/bin/env node

/**
 * Upload and publish extension to Chrome Web Store using API v2.
 * Verifies that the local version is greater than the currently published version.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import chromeWebstoreUpload from "chrome-webstore-upload";

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.dirname(path.dirname(__filename));

const {
  CHROME_CLIENT_ID,
  CHROME_CLIENT_SECRET,
  CHROME_REFRESH_TOKEN,
  CHROME_EXTENSION_ID,
} = process.env;

if (!CHROME_CLIENT_ID || !CHROME_CLIENT_SECRET || !CHROME_REFRESH_TOKEN || !CHROME_EXTENSION_ID) {
  console.error("❌ Missing required Chrome Web Store API credentials in environment variables.");
  process.exit(1);
}

const store = chromeWebstoreUpload({
  extensionId: CHROME_EXTENSION_ID,
  clientId: CHROME_CLIENT_ID,
  clientSecret: CHROME_CLIENT_SECRET,
  refreshToken: CHROME_REFRESH_TOKEN,
});

async function uploadAndPublish() {
  const manifestPath = path.join(projectRoot, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const localVersion = manifest.version;
  console.log(`📦 Local manifest.json version: ${localVersion}`);

  // Find Chrome release ZIP in project root
  const files = fs.readdirSync(projectRoot);
  const zipFile = files.find(
    (f) => f.startsWith("quickget-remote-") && f.endsWith(".zip") && !f.includes("-firefox")
  );

  if (!zipFile) {
    console.error("❌ Could not find compiled Chrome ZIP package. Run 'npm run package:chrome' first.");
    process.exit(1);
  }

  const zipPath = path.join(projectRoot, zipFile);
  console.log(`🤐 Found package zip: ${zipFile}`);

  // Check version against current store version
  try {
    console.log("📡 Querying Chrome Web Store for current version...");
    const token = await store.fetchToken();
    const itemInfo = await store.get("draft", token);
    const storeVersion = itemInfo.crxVersion;
    console.log(`🌐 Chrome Web Store version: ${storeVersion || "None (draft doesn't exist yet)"}`);

    if (storeVersion && compareVersions(localVersion, storeVersion) <= 0) {
      console.error(`❌ Version Conflict: Local version (${localVersion}) is not greater than the store version (${storeVersion}).`);
      console.error("Please bump the version in manifest.json before deploying.");
      process.exit(1);
    }
    console.log("✅ Version check passed!");
  } catch (error) {
    console.warn("⚠️ Version check warning (normal if no published version or draft exists yet):", error.message);
  }

  // Upload ZIP
  console.log("🚀 Uploading package to Chrome Web Store...");
  const zipStream = fs.createReadStream(zipPath);
  const uploadResult = await store.uploadExisting(zipStream);

  if (uploadResult.uploadState === "FAILURE") {
    console.error("❌ Upload failed:", JSON.stringify(uploadResult.itemError || uploadResult));
    process.exit(1);
  }
  console.log("✅ Upload successful!");

  // Publish
  console.log("📢 Publishing draft version to the public...");
  const publishResult = await store.publish("default");

  if (publishResult.status?.includes("OK")) {
    console.log("🎉 Version successfully published to Chrome Web Store!");
  } else {
    console.error("❌ Publish failed:", JSON.stringify(publishResult));
    process.exit(1);
  }
}

/**
 * Compare two dot-separated version strings.
 * Returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal.
 */
function compareVersions(v1, v2) {
  const parts1 = v1.split(".").map(Number);
  const parts2 = v2.split(".").map(Number);
  const maxLen = Math.max(parts1.length, parts2.length);

  for (let i = 0; i < maxLen; i++) {
    const n1 = parts1[i] || 0;
    const n2 = parts2[i] || 0;
    if (n1 > n2) return 1;
    if (n1 < n2) return -1;
  }
  return 0;
}

uploadAndPublish().catch((error) => {
  console.error("❌ Deployment pipeline failed:", error);
  process.exit(1);
});
