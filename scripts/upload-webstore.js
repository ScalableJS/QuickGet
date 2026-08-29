#!/usr/bin/env node

/**
 * Upload and publish extension to Chrome Web Store using API v2 with Google Cloud Service Account.
 * Verifies that the local version is greater than the currently published version.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CWS_ROOT_URL = "https://chromewebstore.googleapis.com";
const DEFAULT_TOKEN_URL = "https://oauth2.googleapis.com/token";
const CWS_SCOPE = "https://www.googleapis.com/auth/chromewebstore";

const defaultProjectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

export async function uploadAndPublish({
  env = process.env,
  projectRoot = defaultProjectRoot,
  fetchFn = fetch,
  readFile = fs.readFileSync,
  readDir = fs.readdirSync,
  logger = console,
} = {}) {
  const { credentials, extensionId, publisherId } = validateEnv(env);
  let shouldUpload = true;

  const manifestPath = path.join(projectRoot, "manifest.json");
  const manifest = JSON.parse(readFile(manifestPath, "utf8"));
  const localVersion = manifest.version;
  logger.log(`📦 Local manifest.json version: ${localVersion}`);

  const zipPath = findZipPackage(projectRoot, readDir);
  const zipFileName = path.basename(zipPath);
  logger.log(`🤐 Found package zip: ${zipFileName}`);

  logger.log("🔑 Authenticating with Google Cloud Service Account...");
  const token = await fetchServiceAccountToken(credentials, fetchFn);

  // Check version against current store version
  try {
    logger.log("📡 Querying Chrome Web Store for current version...");
    const statusInfo = await fetchStoreStatus({ extensionId, publisherId, token, fetchFn });
    const { publishedVersion, submittedVersion } = extractStoreVersions(statusInfo);
    logger.log(`🌐 Published Chrome Web Store version: ${publishedVersion || "None"}`);
    logger.log(`📝 Submitted Chrome Web Store version: ${submittedVersion || "None"}`);

    if (publishedVersion && compareVersions(localVersion, publishedVersion) <= 0) {
      throw new Error(
        `Version Conflict: Local version (${localVersion}) is not greater than the published version (${publishedVersion}). Please bump the version in manifest.json before deploying.`,
      );
    }

    if (submittedVersion && compareVersions(localVersion, submittedVersion) < 0) {
      throw new Error(
        `Version Conflict: Local version (${localVersion}) is older than the submitted version (${submittedVersion}). Please reconcile the draft in the Developer Dashboard.`,
      );
    }

    if (submittedVersion === localVersion) {
      logger.log("⏭️ This version is already uploaded; skipping package upload and retrying publication.");
      shouldUpload = false;
    }
    logger.log("✅ Version check passed!");
  } catch (error) {
    if (error.message?.includes("Version Conflict")) {
      throw error;
    }
    logger.warn("⚠️ Version check warning (normal if no published version or draft exists yet):", error.message);
  }

  // Upload ZIP
  let uploadResult = { uploadState: "SKIPPED" };
  if (shouldUpload) {
    logger.log("🚀 Uploading package to Chrome Web Store...");
    const zipBuffer = readFile(zipPath);
    uploadResult = await uploadPackage({
      extensionId,
      publisherId,
      token,
      zipBuffer,
      fileName: zipFileName,
      fetchFn,
    });
    logger.log("✅ Upload successful!");
  }

  // Publish
  logger.log("📢 Publishing draft version to the Chrome Web Store...");
  const publishResult = await publishItem({
    extensionId,
    publisherId,
    token,
    publishType: "DEFAULT_PUBLISH",
    fetchFn,
  });

  if (isPublishSuccessful(publishResult)) {
    if (
      publishResult.state === "PENDING_REVIEW" ||
      publishResult.status?.includes?.("PENDING_REVIEW") ||
      publishResult.status === "PENDING_REVIEW"
    ) {
      logger.log("⏳ Version successfully submitted to Chrome Web Store and is pending review.");
    } else {
      logger.log("🎉 Version successfully published to Chrome Web Store!");
    }
  } else {
    throw new Error(`Publish failed: ${JSON.stringify(publishResult)}`);
  }

  return { uploadResult, publishResult };
}

export function validateEnv(env = process.env) {
  const { CHROME_SERVICE_ACCOUNT_JSON, CHROME_EXTENSION_ID, CHROME_PUBLISHER_ID } = env;

  const missing = [];
  if (!CHROME_SERVICE_ACCOUNT_JSON) missing.push("CHROME_SERVICE_ACCOUNT_JSON");
  if (!CHROME_EXTENSION_ID) missing.push("CHROME_EXTENSION_ID");
  if (!CHROME_PUBLISHER_ID) missing.push("CHROME_PUBLISHER_ID");

  if (missing.length > 0) {
    throw new Error(`Missing required Chrome Web Store environment variables: ${missing.join(", ")}.`);
  }

  let credentials;
  try {
    credentials = JSON.parse(CHROME_SERVICE_ACCOUNT_JSON);
  } catch {
    throw new Error("Invalid CHROME_SERVICE_ACCOUNT_JSON: must be valid JSON.");
  }

  if (!credentials || typeof credentials !== "object" || Array.isArray(credentials)) {
    throw new Error("Invalid CHROME_SERVICE_ACCOUNT_JSON: expected a JSON object.");
  }

  if (!credentials.client_email || typeof credentials.client_email !== "string") {
    throw new Error("Invalid CHROME_SERVICE_ACCOUNT_JSON: missing client_email.");
  }

  if (!credentials.private_key || typeof credentials.private_key !== "string") {
    throw new Error("Invalid CHROME_SERVICE_ACCOUNT_JSON: missing private_key.");
  }

  return {
    credentials,
    extensionId: CHROME_EXTENSION_ID,
    publisherId: CHROME_PUBLISHER_ID,
  };
}

export async function fetchServiceAccountToken(credentials, fetchFn = fetch) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: credentials.client_email,
    scope: CWS_SCOPE,
    aud: credentials.token_uri || DEFAULT_TOKEN_URL,
    exp: now + 3600,
    iat: now,
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signInput = `${encodedHeader}.${encodedPayload}`;

  const privateKey = credentials.private_key.includes("\n")
    ? credentials.private_key
    : credentials.private_key.replace(/\\n/g, "\n");

  let signature;
  try {
    signature = crypto.sign("sha256", Buffer.from(signInput), privateKey).toString("base64url");
  } catch (error) {
    throw new Error(`Failed to sign JWT with service account private key: ${error.message}`);
  }

  const assertion = `${signInput}.${signature}`;
  const tokenEndpoint = credentials.token_uri || DEFAULT_TOKEN_URL;

  const response = await fetchFn(tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }).toString(),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    const errorMsg = formatApiError(response.status, response.statusText, errorBody);
    throw new Error(`Failed to obtain Google access token: ${errorMsg}`);
  }

  const data = await response.json();
  if (!data.access_token) {
    throw new Error("OAuth token response did not contain an access_token.");
  }

  return data.access_token;
}

export async function fetchStoreStatus({ extensionId, publisherId, token, fetchFn = fetch }) {
  const url = `${CWS_ROOT_URL}/v2/publishers/${encodeURIComponent(publisherId)}/items/${encodeURIComponent(extensionId)}:fetchStatus`;
  const response = await fetchFn(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    const errorMsg = formatApiError(response.status, response.statusText, errorBody);
    throw new Error(`Failed to fetch store status: ${errorMsg}`);
  }

  return response.json();
}

export function extractStoreVersions(statusResponse) {
  return {
    publishedVersion: statusResponse?.publishedItemRevisionStatus?.distributionChannels?.[0]?.crxVersion || null,
    submittedVersion: statusResponse?.submittedItemRevisionStatus?.distributionChannels?.[0]?.crxVersion || null,
  };
}

export function findZipPackage(projectRoot, readDir = fs.readdirSync) {
  const files = readDir(projectRoot);
  const zipFile = files.find((f) => f.startsWith("quickget-remote-") && f.endsWith(".zip") && !f.includes("-firefox"));

  if (!zipFile) {
    throw new Error("Could not find compiled Chrome ZIP package. Run 'npm run package:chrome' first.");
  }

  return path.join(projectRoot, zipFile);
}

export async function uploadPackage({
  extensionId,
  publisherId,
  token,
  zipBuffer,
  fileName = "extension.zip",
  fetchFn = fetch,
}) {
  const url = `${CWS_ROOT_URL}/upload/v2/publishers/${encodeURIComponent(publisherId)}/items/${encodeURIComponent(extensionId)}:upload`;
  const response = await fetchFn(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Goog-Upload-Protocol": "raw",
      "X-Goog-Upload-File-Name": fileName,
    },
    body: zipBuffer,
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    const errorMsg = formatApiError(response.status, response.statusText, errorBody);
    throw new Error(`Upload failed: ${errorMsg}`);
  }

  const result = await response.json();
  if (result.uploadState === "FAILURE") {
    throw new Error(`Upload failed with FAILURE state: ${JSON.stringify(result.itemError || result)}`);
  }

  return result;
}

export async function publishItem({
  extensionId,
  publisherId,
  token,
  publishType = "DEFAULT_PUBLISH",
  fetchFn = fetch,
}) {
  const url = `${CWS_ROOT_URL}/v2/publishers/${encodeURIComponent(publisherId)}/items/${encodeURIComponent(extensionId)}:publish`;
  const response = await fetchFn(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ publishType }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    const errorMsg = formatApiError(response.status, response.statusText, errorBody);
    throw new Error(`Publish failed: ${errorMsg}`);
  }

  return response.json();
}

export function isPublishSuccessful(result) {
  if (!result || typeof result !== "object") return false;

  const state = result.state;
  if (state === "PUBLISHED" || state === "PENDING_REVIEW" || state === "STAGED" || state === "PUBLISHED_TO_TESTERS") {
    return true;
  }

  const status = result.status;
  if (Array.isArray(status)) {
    if (
      status.includes("OK") ||
      status.includes("PENDING_REVIEW") ||
      status.includes("ITEM_PENDING_REVIEW") ||
      status.includes("SUCCESS")
    ) {
      return true;
    }
  } else if (typeof status === "string") {
    if (status === "OK" || status === "PENDING_REVIEW" || status === "ITEM_PENDING_REVIEW" || status === "SUCCESS") {
      return true;
    }
  }

  return false;
}

export function compareVersions(v1, v2) {
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

export function formatApiError(status, statusText, bodyText) {
  let message = `HTTP ${status} ${statusText}`;
  try {
    const json = JSON.parse(bodyText);
    if (json.error) {
      if (typeof json.error === "string") {
        message = json.error_description ? `${json.error}: ${json.error_description}` : json.error;
      } else if (typeof json.error === "object" && json.error.message) {
        message = json.error.message;
        if (Array.isArray(json.error.details) && json.error.details.length > 0) {
          message += ` Details: ${JSON.stringify(json.error.details)}`;
        }
      }
    } else if (json.message) {
      message = json.message;
    }
  } catch {
    if (bodyText) {
      message = `${message}: ${bodyText}`;
    }
  }
  return message;
}

const isDirectRun = Boolean(process.argv[1]) && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun) {
  uploadAndPublish().catch((error) => {
    console.error("❌ Deployment pipeline failed:", error.message);
    process.exit(1);
  });
}
