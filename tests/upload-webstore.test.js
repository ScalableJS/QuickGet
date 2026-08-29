import assert from "node:assert/strict";
import crypto from "node:crypto";
import { describe, it } from "node:test";
import {
  compareVersions,
  extractStoreVersion,
  fetchServiceAccountToken,
  fetchStoreStatus,
  findZipPackage,
  formatApiError,
  isPublishSuccessful,
  publishItem,
  uploadAndPublish,
  uploadPackage,
  validateEnv,
} from "../scripts/upload-webstore.js";

// Generate a valid RSA keypair for testing JWT signing
const { privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

const sampleCredentials = {
  type: "service_account",
  project_id: "test-project",
  private_key_id: "key-123",
  private_key: privateKey,
  client_email: "test-sa@test-project.iam.gserviceaccount.com",
  client_id: "123456789",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
};

describe("Chrome Web Store Upload Script", () => {
  describe("validateEnv", () => {
    it("should throw when required environment variables are missing", () => {
      assert.throws(
        () => validateEnv({}),
        /Missing required Chrome Web Store environment variables: CHROME_SERVICE_ACCOUNT_JSON, CHROME_EXTENSION_ID, CHROME_PUBLISHER_ID/,
      );

      assert.throws(
        () =>
          validateEnv({
            CHROME_SERVICE_ACCOUNT_JSON: JSON.stringify(sampleCredentials),
          }),
        /Missing required Chrome Web Store environment variables: CHROME_EXTENSION_ID, CHROME_PUBLISHER_ID/,
      );
    });

    it("should throw when CHROME_SERVICE_ACCOUNT_JSON is invalid JSON", () => {
      assert.throws(
        () =>
          validateEnv({
            CHROME_SERVICE_ACCOUNT_JSON: "not-json{",
            CHROME_EXTENSION_ID: "ext-123",
            CHROME_PUBLISHER_ID: "pub-456",
          }),
        /Invalid CHROME_SERVICE_ACCOUNT_JSON: must be valid JSON/,
      );
    });

    it("should throw when service account JSON is missing client_email or private_key", () => {
      assert.throws(
        () =>
          validateEnv({
            CHROME_SERVICE_ACCOUNT_JSON: JSON.stringify({ private_key: "some-key" }),
            CHROME_EXTENSION_ID: "ext-123",
            CHROME_PUBLISHER_ID: "pub-456",
          }),
        /Invalid CHROME_SERVICE_ACCOUNT_JSON: missing client_email/,
      );

      assert.throws(
        () =>
          validateEnv({
            CHROME_SERVICE_ACCOUNT_JSON: JSON.stringify({ client_email: "test@example.com" }),
            CHROME_EXTENSION_ID: "ext-123",
            CHROME_PUBLISHER_ID: "pub-456",
          }),
        /Invalid CHROME_SERVICE_ACCOUNT_JSON: missing private_key/,
      );
    });

    it("should validate and return credentials when valid", () => {
      const result = validateEnv({
        CHROME_SERVICE_ACCOUNT_JSON: JSON.stringify(sampleCredentials),
        CHROME_EXTENSION_ID: "ext-123",
        CHROME_PUBLISHER_ID: "pub-456",
      });

      assert.equal(result.extensionId, "ext-123");
      assert.equal(result.publisherId, "pub-456");
      assert.equal(result.credentials.client_email, sampleCredentials.client_email);
    });
  });

  describe("formatApiError", () => {
    it("should format string error descriptions", () => {
      const formatted = formatApiError(
        400,
        "Bad Request",
        JSON.stringify({
          error: "invalid_grant",
          error_description: "Invalid JWT Signature.",
        }),
      );
      assert.equal(formatted, "invalid_grant: Invalid JWT Signature.");
    });

    it("should format nested API error messages", () => {
      const formatted = formatApiError(
        400,
        "Bad Request",
        JSON.stringify({
          error: { code: 400, message: "Publish condition not met" },
        }),
      );
      assert.equal(formatted, "Publish condition not met");
    });

    it("should fallback to HTTP status when body is non-JSON", () => {
      const formatted = formatApiError(500, "Internal Server Error", "Plain text error");
      assert.equal(formatted, "HTTP 500 Internal Server Error: Plain text error");
    });
  });

  describe("compareVersions", () => {
    it("should correctly compare version strings", () => {
      assert.equal(compareVersions("2.0.2", "2.0.1"), 1);
      assert.equal(compareVersions("2.1.0", "2.0.9"), 1);
      assert.equal(compareVersions("1.0.0.1", "1.0.0"), 1);

      assert.equal(compareVersions("2.0.1", "2.0.2"), -1);
      assert.equal(compareVersions("1.9.9", "2.0.0"), -1);

      assert.equal(compareVersions("2.0.1", "2.0.1"), 0);
      assert.equal(compareVersions("2.0.0", "2.0"), 0);
    });
  });

  describe("extractStoreVersion", () => {
    it("should extract version from published revision", () => {
      const status = {
        publishedItemRevisionStatus: {
          distributionChannels: [{ crxVersion: "2.0.1", deployPercentage: 100 }],
        },
      };
      assert.equal(extractStoreVersion(status), "2.0.1");
    });

    it("should extract version from submitted revision if published is absent", () => {
      const status = {
        submittedItemRevisionStatus: {
          distributionChannels: [{ crxVersion: "2.0.2", deployPercentage: 100 }],
        },
      };
      assert.equal(extractStoreVersion(status), "2.0.2");
    });

    it("should return null if no version info is present", () => {
      assert.equal(extractStoreVersion({}), null);
      assert.equal(extractStoreVersion(null), null);
    });
  });

  describe("findZipPackage", () => {
    it("should find the compiled chrome zip file and ignore firefox zip", () => {
      const fakeDir = ["quickget-remote-2.0.1-firefox.zip", "quickget-remote-2.0.1.zip", "manifest.json"];
      const zipPath = findZipPackage("/mock/root", () => fakeDir);
      assert.equal(zipPath, "/mock/root/quickget-remote-2.0.1.zip");
    });

    it("should throw if no chrome zip file is found", () => {
      const fakeDir = ["quickget-remote-2.0.1-firefox.zip", "manifest.json"];
      assert.throws(() => findZipPackage("/mock/root", () => fakeDir), /Could not find compiled Chrome ZIP package/);
    });
  });

  describe("fetchServiceAccountToken", () => {
    it("should exchange signed JWT for access token", async () => {
      let requestedUrl = "";
      let requestedBody = "";

      const mockFetch = async (url, options) => {
        requestedUrl = url;
        requestedBody = options.body;
        return {
          ok: true,
          json: async () => ({
            access_token: "ya29.mock_token_abc",
            token_type: "Bearer",
            expires_in: 3600,
          }),
        };
      };

      const token = await fetchServiceAccountToken(sampleCredentials, mockFetch);
      assert.equal(token, "ya29.mock_token_abc");
      assert.equal(requestedUrl, "https://oauth2.googleapis.com/token");

      const params = new URLSearchParams(requestedBody);
      assert.equal(params.get("grant_type"), "urn:ietf:params:oauth:grant-type:jwt-bearer");
      const assertion = params.get("assertion");
      assert.ok(assertion);
      const [headerB64, payloadB64, signature] = assertion.split(".");
      assert.ok(headerB64 && payloadB64 && signature);

      const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
      assert.equal(payload.iss, sampleCredentials.client_email);
      assert.equal(payload.scope, "https://www.googleapis.com/auth/chromewebstore");
      assert.equal(payload.aud, "https://oauth2.googleapis.com/token");
    });

    it("should handle escaped newlines in private key", async () => {
      const escapedKeyCreds = {
        ...sampleCredentials,
        private_key: privateKey.replace(/\n/g, "\\n"),
      };

      const mockFetch = async () => ({
        ok: true,
        json: async () => ({ access_token: "ya29.mock_escaped_key" }),
      });

      const token = await fetchServiceAccountToken(escapedKeyCreds, mockFetch);
      assert.equal(token, "ya29.mock_escaped_key");
    });

    it("should throw on OAuth error response without leaking credentials", async () => {
      const mockFetch = async () => ({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        text: async () =>
          JSON.stringify({
            error: "invalid_grant",
            error_description: "Invalid JWT Signature.",
          }),
      });

      await assert.rejects(
        () => fetchServiceAccountToken(sampleCredentials, mockFetch),
        (err) => {
          assert.match(err.message, /Failed to obtain Google access token: invalid_grant: Invalid JWT Signature\./);
          assert.doesNotMatch(err.message, /BEGIN PRIVATE KEY/);
          return true;
        },
      );
    });
  });

  describe("fetchStoreStatus", () => {
    it("should fetch store status with authorization header", async () => {
      let authHeader = "";
      const mockFetch = async (_url, options) => {
        authHeader = options.headers.Authorization;
        return {
          ok: true,
          json: async () => ({
            name: "publishers/pub-1/items/ext-1",
            publishedItemRevisionStatus: {
              distributionChannels: [{ crxVersion: "2.0.0" }],
            },
          }),
        };
      };

      const status = await fetchStoreStatus({
        extensionId: "ext-1",
        publisherId: "pub-1",
        token: "test-token",
        fetchFn: mockFetch,
      });

      assert.equal(authHeader, "Bearer test-token");
      assert.equal(status.name, "publishers/pub-1/items/ext-1");
    });

    it("should throw formatted error on status error", async () => {
      const mockFetch = async () => ({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: async () => JSON.stringify({ error: { code: 404, message: "Item not found" } }),
      });

      await assert.rejects(
        () =>
          fetchStoreStatus({
            extensionId: "ext-1",
            publisherId: "pub-1",
            token: "test-token",
            fetchFn: mockFetch,
          }),
        /Failed to fetch store status: Item not found/,
      );
    });
  });

  describe("uploadPackage", () => {
    it("should upload package with raw protocol headers", async () => {
      let capturedHeaders = null;
      let capturedBody = null;

      const mockFetch = async (_url, options) => {
        capturedHeaders = options.headers;
        capturedBody = options.body;
        return {
          ok: true,
          json: async () => ({
            uploadState: "SUCCESS",
            crxVersion: "2.0.2",
          }),
        };
      };

      const zipBuffer = Buffer.from("dummy-zip-content");
      const result = await uploadPackage({
        extensionId: "ext-1",
        publisherId: "pub-1",
        token: "test-token",
        zipBuffer,
        fileName: "quickget-remote-2.0.2.zip",
        fetchFn: mockFetch,
      });

      assert.equal(result.uploadState, "SUCCESS");
      assert.equal(capturedHeaders.Authorization, "Bearer test-token");
      assert.equal(capturedHeaders["X-Goog-Upload-Protocol"], "raw");
      assert.equal(capturedHeaders["X-Goog-Upload-File-Name"], "quickget-remote-2.0.2.zip");
      assert.equal(capturedBody, zipBuffer);
    });

    it("should throw if uploadState is FAILURE", async () => {
      const mockFetch = async () => ({
        ok: true,
        json: async () => ({
          uploadState: "FAILURE",
          itemError: [{ error_code: "MANIFEST_INVALID", error_detail: "Invalid manifest" }],
        }),
      });

      await assert.rejects(
        () =>
          uploadPackage({
            extensionId: "ext-1",
            publisherId: "pub-1",
            token: "test-token",
            zipBuffer: Buffer.from(""),
            fetchFn: mockFetch,
          }),
        /Upload failed with FAILURE state: .*MANIFEST_INVALID/,
      );
    });
  });

  describe("publishItem and isPublishSuccessful", () => {
    it("should identify successful publish states including PENDING_REVIEW", () => {
      assert.equal(isPublishSuccessful({ state: "PENDING_REVIEW" }), true);
      assert.equal(isPublishSuccessful({ state: "PUBLISHED" }), true);
      assert.equal(isPublishSuccessful({ state: "STAGED" }), true);
      assert.equal(isPublishSuccessful({ status: ["PENDING_REVIEW"] }), true);
      assert.equal(isPublishSuccessful({ status: ["OK"] }), true);
      assert.equal(isPublishSuccessful({ status: "PENDING_REVIEW" }), true);
      assert.equal(isPublishSuccessful({ status: "OK" }), true);
      assert.equal(isPublishSuccessful({ itemId: "ext-1", state: "PENDING_REVIEW" }), true);

      assert.equal(isPublishSuccessful(null), false);
      assert.equal(isPublishSuccessful({}), false);
      assert.equal(isPublishSuccessful({ error: "FAILED" }), false);
      assert.equal(isPublishSuccessful({ itemId: "ext-1", state: "REJECTED" }), false);
      assert.equal(isPublishSuccessful({ itemId: "ext-1", state: "CANCELLED" }), false);
      assert.equal(isPublishSuccessful({ itemId: "ext-1", state: "UNKNOWN_FUTURE_STATE" }), false);
    });

    it("should publish item with DEFAULT_PUBLISH", async () => {
      let capturedBody = "";
      const mockFetch = async (_url, options) => {
        capturedBody = options.body;
        return {
          ok: true,
          json: async () => ({
            name: "publishers/pub-1/items/ext-1",
            itemId: "ext-1",
            state: "PENDING_REVIEW",
          }),
        };
      };

      const result = await publishItem({
        extensionId: "ext-1",
        publisherId: "pub-1",
        token: "test-token",
        fetchFn: mockFetch,
      });

      assert.equal(result.state, "PENDING_REVIEW");
      assert.equal(JSON.parse(capturedBody).publishType, "DEFAULT_PUBLISH");
    });

    it("should throw on publish HTTP error", async () => {
      const mockFetch = async () => ({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        text: async () =>
          JSON.stringify({
            error: { code: 400, message: "Publish condition not met: Item is not ready" },
          }),
      });

      await assert.rejects(
        () =>
          publishItem({
            extensionId: "ext-1",
            publisherId: "pub-1",
            token: "test-token",
            fetchFn: mockFetch,
          }),
        /Publish failed: Publish condition not met: Item is not ready/,
      );
    });
  });

  describe("uploadAndPublish full cycle", () => {
    it("should succeed and log PENDING_REVIEW when submission enters review", async () => {
      const logs = [];
      const mockLogger = {
        log: (...args) => logs.push(args.join(" ")),
        warn: (...args) => logs.push(args.join(" ")),
        error: (...args) => logs.push(args.join(" ")),
      };

      const mockFetch = async (url) => {
        if (url.includes("oauth2.googleapis.com")) {
          return {
            ok: true,
            json: async () => ({ access_token: "mock-token" }),
          };
        }
        if (url.includes(":fetchStatus")) {
          return {
            ok: true,
            json: async () => ({
              publishedItemRevisionStatus: {
                distributionChannels: [{ crxVersion: "2.0.0" }],
              },
            }),
          };
        }
        if (url.includes(":upload")) {
          return {
            ok: true,
            json: async () => ({ uploadState: "SUCCESS", crxVersion: "2.0.1" }),
          };
        }
        if (url.includes(":publish")) {
          return {
            ok: true,
            json: async () => ({
              name: "publishers/pub-1/items/ext-1",
              itemId: "ext-1",
              state: "PENDING_REVIEW",
            }),
          };
        }
        throw new Error(`Unhandled URL: ${url}`);
      };

      const mockReadFile = (filePath) => {
        if (filePath.endsWith("manifest.json")) {
          return JSON.stringify({ version: "2.0.1" });
        }
        return Buffer.from("mock-zip-bytes");
      };

      const mockReadDir = () => ["quickget-remote-2.0.1.zip"];

      const result = await uploadAndPublish({
        env: {
          CHROME_SERVICE_ACCOUNT_JSON: JSON.stringify(sampleCredentials),
          CHROME_EXTENSION_ID: "ext-123",
          CHROME_PUBLISHER_ID: "pub-456",
        },
        projectRoot: "/fake/root",
        fetchFn: mockFetch,
        readFile: mockReadFile,
        readDir: mockReadDir,
        logger: mockLogger,
      });

      assert.equal(result.uploadResult.uploadState, "SUCCESS");
      assert.equal(result.publishResult.state, "PENDING_REVIEW");
      assert.ok(logs.some((l) => l.includes("pending review")));
    });

    it("should throw on version conflict when localVersion <= storeVersion", async () => {
      const mockLogger = { log: () => {}, warn: () => {}, error: () => {} };

      const mockFetch = async (url) => {
        if (url.includes("oauth2.googleapis.com")) {
          return {
            ok: true,
            json: async () => ({ access_token: "mock-token" }),
          };
        }
        if (url.includes(":fetchStatus")) {
          return {
            ok: true,
            json: async () => ({
              publishedItemRevisionStatus: {
                distributionChannels: [{ crxVersion: "2.0.1" }],
              },
            }),
          };
        }
        throw new Error(`Unhandled URL: ${url}`);
      };

      const mockReadFile = (filePath) => {
        if (filePath.endsWith("manifest.json")) {
          return JSON.stringify({ version: "2.0.1" });
        }
        return Buffer.from("mock-zip-bytes");
      };

      const mockReadDir = () => ["quickget-remote-2.0.1.zip"];

      await assert.rejects(
        () =>
          uploadAndPublish({
            env: {
              CHROME_SERVICE_ACCOUNT_JSON: JSON.stringify(sampleCredentials),
              CHROME_EXTENSION_ID: "ext-123",
              CHROME_PUBLISHER_ID: "pub-456",
            },
            projectRoot: "/fake/root",
            fetchFn: mockFetch,
            readFile: mockReadFile,
            readDir: mockReadDir,
            logger: mockLogger,
          }),
        /Version Conflict: Local version \(2\.0\.1\) is not greater than the store version \(2\.0\.1\)/,
      );
    });
  });
});
