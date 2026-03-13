import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { BrowserContext, Page } from "@playwright/test";

import { RedactedHttpLog } from "./redactedHttpLog.js";

export interface ClientSideRequestCaptureEntry {
  method: string;
  path: string;
  requestBody: string;
}

export function attachHttpCapture(context: BrowserContext, host: string, port: string): RedactedHttpLog {
  const log = new RedactedHttpLog();
  const hostWithPort = `${host}:${port}`;

  context.on("response", (response) => {
    void (async () => {
      const url = response.url();
      if (!url.includes(hostWithPort) || !url.includes("/downloadstation/V4/")) {
        return;
      }

      const request = response.request();
      let responseBody = "";

      try {
        responseBody = await response.text();
      } catch {
        responseBody = "<unavailable>";
      }

      log.add({
        method: request.method(),
        path: new URL(url).pathname,
        status: response.status(),
        requestBody: request.postData() ?? "",
        responseBody,
      });
    })();
  });

  return log;
}

export async function installClientSideRequestCapture(
  context: BrowserContext,
  host: string,
  port: string
): Promise<void> {
  await context.addInitScript(
    ({ hostWithPort }) => {
      const globalKey = "__quickgetHttpRequestCapture";
      const existing = (globalThis as Record<string, unknown>)[globalKey];
      const capture = Array.isArray(existing) ? existing : [];
      (globalThis as Record<string, unknown>)[globalKey] = capture;

      const originalFetch = window.fetch.bind(window);

      const serializeFormData = (formData: FormData): string => {
        const fields = Array.from(formData.entries()).map(([name, value]) => {
          if (typeof value === "string") {
            return { name, value };
          }

          return {
            name,
            fileName: value.name,
            size: value.size,
            type: value.type,
          };
        });

        return JSON.stringify({ kind: "form-data", fields });
      };

      const readRequestBody = async (request: Request): Promise<string> => {
        const contentType = request.headers.get("content-type") || "";

        if (contentType.includes("multipart/form-data")) {
          return serializeFormData(await request.clone().formData());
        }

        return await request.clone().text().catch(() => "");
      };

      window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        try {
          const request = input instanceof Request ? input.clone() : new Request(input, init);
          const url = new URL(request.url);

          if (url.host === hostWithPort && url.pathname.includes("/downloadstation/V4/")) {
            const requestBody = await readRequestBody(request);
            capture.push({
              method: request.method,
              path: url.pathname,
              requestBody,
            });
          }
        } catch {
          // Ignore capture errors; never break the page fetch flow
        }

        return originalFetch(input, init);
      };
    },
    { hostWithPort: `${host}:${port}` }
  );
}

export async function readClientSideRequestCapture(
  page: Page
): Promise<ClientSideRequestCaptureEntry[]> {
  return await page.evaluate(() => {
    const value = (globalThis as Record<string, unknown>).__quickgetHttpRequestCapture;
    return Array.isArray(value) ? (value as ClientSideRequestCaptureEntry[]) : [];
  });
}

export async function persistHttpCapture(rootDir: string, fileName: string, content: string): Promise<string> {
  const artifactsDir = path.join(rootDir, ".e2e-artifacts");
  await mkdir(artifactsDir, { recursive: true });
  const filePath = path.join(artifactsDir, fileName);
  await writeFile(filePath, content, "utf8");
  return filePath;
}

export async function persistHttpCaptureBundle(
  rootDir: string,
  baseName: string,
  log: RedactedHttpLog
): Promise<{ textPath: string; jsonPath: string }> {
  const artifactsDir = path.join(rootDir, ".e2e-artifacts");
  await mkdir(artifactsDir, { recursive: true });

  const textPath = path.join(artifactsDir, `${baseName}.log`);
  const jsonPath = path.join(artifactsDir, `${baseName}.json`);

  await writeFile(textPath, log.toText(), "utf8");
  await writeFile(jsonPath, JSON.stringify(log.toJSON(), null, 2), "utf8");

  return { textPath, jsonPath };
}

