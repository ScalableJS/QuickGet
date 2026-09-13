import { expect, test } from "@playwright/test";

import { prodBuildPath } from "./support/builds.js";
import { hasRequiredRealNasEnv, loadRealNasEnv } from "./support/e2eEnv.js";
import { launchExtensionPopup } from "./support/extension.js";
import {
  attachHttpCapture,
  installClientSideRequestCapture,
  persistHttpCaptureBundle,
  readClientSideRequestCapture,
} from "./support/httpCapture.js";
import { lanAddress } from "./support/lan.js";
import { openSettingsPanel, switchSettingsTab, waitForPopupReady } from "./support/popup.js";
import { createRealNasClient, rootDir } from "./support/realNasClient.js";
import {
  describeTask,
  findOwnTask,
  newRunId,
  OWNED_PREFIX,
  preflight,
  TaskLedger,
  waitFor,
} from "./support/spotcheck.js";
import { startTestStandHost, type TestStandHostHandle } from "./support/testStandHost.js";

/**
 * The pre-production spot check (BUG-69).
 *
 * Everything else in this repository — 525 unit tests, 45 mock E2E, CI — asks questions of a mock
 * we wrote, which is the one thing a pre-production gate must not do. Two failures escaped it: a
 * feature that passed its mock suite and returned `12288` on the first real click, and a real-NAS
 * spec that sat broken for two months because an opt-in suite nobody runs looks exactly like one
 * that passes.
 *
 * So this suite is deliberately **small**. It runs only what a mock genuinely cannot answer:
 *
 *  1. login through the extension's own code path,
 *  2. `AddTorrent` — a real multipart upload, parsed by the appliance,
 *  3. `AddUrl` with a magnet — a different appliance contract, not another route to the same one,
 *  4. a direct HTTP fetch the NAS performs *itself*, with its whole lifecycle.
 *
 * Rebuilding the 45 mock tests against the owner's hardware would be the mistake: a slow second
 * suite that rots exactly like the last one. Interception, badge arithmetic, form validation and
 * rendering stay hermetic.
 *
 * Run it with `npm run test:prod-spotcheck`, against `dist` — the bundle the Web Store receives.
 */

const env = loadRealNasEnv(rootDir);
const runId = newRunId();
const ledger = new TaskLedger(runId);
const enabled = env.enabled && hasRequiredRealNasEnv(env);

test.describe.configure({ mode: "serial" });

test.describe("production spot check — real NAS", () => {
  test.skip(!enabled, "Set QNAP_E2E_REAL=1 and fill .env.e2e.local to run the spot check.");

  test.afterAll(async () => {
    if (!enabled) return;
    const outcome = await ledger.releaseRun(env);
    // Cleanup failure is a gate failure. A run that leaves tasks on somebody's NAS has not passed,
    // whatever its assertions said, and the ledger keeps the debt for the next run to inherit.
    expect(outcome.failed, `spot check could not remove ${outcome.failed.length} task(s) it created`).toEqual([]);
  });

  test("preflight: the NAS answers, and there is room to work", async () => {
    const report = await preflight(env, runId);
    console.log(
      [
        "",
        "Spot check preflight",
        `  run:       ${report.runId}`,
        `  target:    ${report.target}`,
        `  headroom:  ${report.headroom} of 30 task slots free`,
        `  recovered: ${report.recovered} task(s) left by earlier runs`,
        "",
      ].join("\n"),
    );
    expect(report.headroom).toBeGreaterThanOrEqual(2);
  });

  test("the extension's own connection check reaches the real Download Station", async () => {
    // The one scenario where the *browser* talks to the NAS, so it is the one worth recording:
    // the redacted bundle is the source for keeping `mockNas.ts` honest about real payloads.
    const session = await launchExtensionPopup(prodBuildPath, {
      beforePageLoad: (context) => installClientSideRequestCapture(context, env.host, env.port),
    });
    const httpLog = attachHttpCapture(session.context, env.host, env.port);
    try {
      const { page } = session;
      await waitForPopupReady(page);
      await openSettingsPanel(page);
      await switchSettingsTab(page, "Connection");

      const scheme = env.secure ? "https" : "http";
      await page.fill("#serverUrl", `${scheme}://${env.host}:${env.port}`);
      await page.fill("#NASlogin", env.login);
      await page.fill("#NASpassword", env.password);
      await page.fill("#NAStempdir", env.tempDir);
      await page.press("#NAStempdir", "Escape");
      await page.fill("#NASdir", env.destDir);
      await page.press("#NASdir", "Escape");
      await page.click("#save-btn");

      // The real contract: `Misc/Login` with a base64 password, through the extension's own client
      // rather than a curl in a test. Credential persistence across a reload is browser storage
      // and is covered hermetically — no real-NAS time is spent on it.
      await expect(page.locator(".connection-health")).toHaveText("Ready", { timeout: 30_000 });

      if (env.captureHttp) {
        httpLog.mergeRequestBodies(await readClientSideRequestCapture(page));
        await persistHttpCaptureBundle(rootDir, "spotcheck-connection", httpLog);
      }
    } finally {
      await session.close();
    }
  });

  test("a real .torrent is accepted and appears under the name inside the file", async () => {
    const client = createRealNasClient(env);
    const contentName = `${runId}-torrent`;
    const stand = await startTestStandHost();

    try {
      const torrent = Buffer.from(
        await (await fetch(`${stand.url}files/${encodeURIComponent(contentName)}.torrent`)).arrayBuffer(),
      );
      await ledger.intend(contentName);
      await client.addTorrent(new File([torrent], `${contentName}.torrent`, { type: "application/x-bittorrent" }), {
        tempFolder: env.tempDir,
        targetFolder: env.destDir,
      });

      const task = await waitFor(async () => await findOwnTask(env, contentName), {
        what: `AddTorrent -> Task/Query shows a task named "${contentName}"`,
        diagnose: async () => [describeTask(await findOwnTask(env, contentName))],
      });
      await ledger.record(task.hash ?? task.id, task.name);

      // The name comes from `info.name` inside the file, not from the upload's filename — which is
      // why the stand generates a distinct torrent per link rather than reusing one fixture.
      expect(task.name).toContain(contentName);
    } finally {
      await stand.close();
    }
  });

  test("a magnet is accepted through AddUrl", async () => {
    const client = createRealNasClient(env);
    const displayName = `${runId}-magnet`;
    // A random infohash, so the task is created and then finds nobody. Nothing is transferred and
    // no tracker is contacted on our behalf; acceptance is the whole contract being checked.
    const infoHash = Array.from({ length: 40 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");
    const magnet = `magnet:?xt=urn:btih:${infoHash}&dn=${encodeURIComponent(displayName)}`;

    await ledger.intend(displayName);
    await client.addUrl(magnet, { tempFolder: env.tempDir, targetFolder: env.destDir });

    const task = await waitFor(async () => await findOwnTask(env, displayName), {
      what: `AddUrl(magnet) -> Task/Query shows a task named "${displayName}"`,
      diagnose: async () => [describeTask(await findOwnTask(env, displayName))],
    });
    await ledger.record(task.hash ?? task.id, task.name);
    expect(task.name).toContain(displayName);
  });

  test("a direct link: the NAS fetches it itself, and the task can be paused, resumed and removed", async () => {
    test.setTimeout(180_000);

    const client = createRealNasClient(env);
    const filename = `${runId}-direct.bin`;
    const lan = lanAddress();
    let stand: TestStandHostHandle | undefined;

    try {
      // Bound to every interface and advertised by the LAN address, because Download Station
      // performs the fetch from its own machine. A loopback URL asks the NAS to download from
      // itself and it answers `12288` — the failure this whole gate exists to have caught.
      stand = await startTestStandHost({ host: "0.0.0.0" });
      const fileUrl = `http://${lan}:${stand.port}/files/${filename}?mb=64&kbps=512&barrierAt=4194304&barrier=partway`;

      await ledger.intend(filename);
      await client.addUrl(fileUrl, { tempFolder: env.tempDir, targetFolder: env.destDir });

      const created = await waitFor(async () => await findOwnTask(env, filename), {
        what: `AddUrl(${lan}) -> Task/Query shows "${filename}"`,
        diagnose: async () => [
          describeTask(await findOwnTask(env, filename)),
          `  stand saw:  ${stand?.requestLog.map((entry) => `${entry.method} ${entry.path}`).join(", ") || "nothing"}`,
          `  note:       nothing here means the NAS could not reach ${lan}:${stand?.port} — firewall, VLAN or the wrong interface.`,
        ],
      });
      const identifier = created.hash ?? created.id;
      await ledger.record(identifier, created.name);

      // Topology proof, and the assertion the mock could never make: the bytes are requested by
      // the NAS, from a server on this machine.
      await waitFor(async () => (stand?.requestLog.some((entry) => entry.path.includes(filename)) ? true : undefined), {
        what: "the NAS actually requests the file from this machine",
        diagnose: async () => [`  stand saw:  ${stand?.requestLog.map((entry) => entry.path).join(", ") || "nothing"}`],
      });

      // The barrier, not the clock: the server has sent exactly 4 MB and is holding. Progress is
      // therefore genuinely partial at a known point, with no sleep to tune.
      await stand.barriers.reachedAt("partway");

      const partial = await waitFor(
        async () => {
          const task = await findOwnTask(env, filename);
          return task && task.downloadedBytes > 0 && task.downloadedBytes < task.sizeBytes ? task : undefined;
        },
        {
          what: "downloaded bytes are above zero and below the total — a transfer actually in progress",
          diagnose: async () => [describeTask(await findOwnTask(env, filename))],
        },
      );
      expect(partial.sizeBytes).toBe(64 * 1024 * 1024);

      // Routing: the destination the task carries is the folder that was asked for, read from
      // `move` rather than from the popup's own optimism.
      expect(partial.destination).toBe(env.destDir);

      await client.pauseTask(identifier);
      const paused = await waitFor(
        async () => {
          const task = await findOwnTask(env, filename);
          return task && (task.status === "paused" || task.status === "stopped") ? task : undefined;
        },
        {
          what: "Task/Pause -> the NAS reports the task paused",
          diagnose: async () => [describeTask(await findOwnTask(env, filename))],
        },
      );

      stand.barriers.release("partway");
      await client.startTask(identifier);

      await waitFor(
        async () => {
          const task = await findOwnTask(env, filename);
          return task && task.downloadedBytes > paused.downloadedBytes ? task : undefined;
        },
        {
          what: `Task/Start -> downloaded bytes rise above the ${paused.downloadedBytes} they stopped at`,
          timeoutMs: 60_000,
          diagnose: async () => [describeTask(await findOwnTask(env, filename))],
        },
      );

      await client.removeTask(identifier, { clean: true });
      await waitFor(async () => ((await findOwnTask(env, filename)) === undefined ? true : undefined), {
        what: "Task/Remove -> the task is gone from Task/Query",
        diagnose: async () => [describeTask(await findOwnTask(env, filename))],
      });
      // Removed by the test itself, so the ledger has nothing left to clean for it.
      await ledger.releaseRun(env);
    } finally {
      await stand?.close();
    }
  });
});

test("the owned prefix is what every fixture name is built from", () => {
  // A guard, not a formality: ownership is the only thing standing between this suite and a
  // stranger's downloads, and it is enforced by name.
  expect(runId.startsWith(OWNED_PREFIX)).toBe(true);
});
