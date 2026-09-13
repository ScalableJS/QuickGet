// @vitest-environment node
import { describe, expect, it } from "vitest";

import { startTestStandHost, type TestStandHostHandle } from "../testStandHost.js";

/**
 * The stand is a test fixture, which is exactly why it needs tests of its own: a fixture that
 * lies produces green suites about behaviour that does not exist. The mock NAS has had a contract
 * spec for this reason since `mockNas.contract.spec.ts`; this is the same argument applied to the
 * server the browser talks to.
 *
 * What is deliberately **not** asserted: throughput. `?kbps=` exists so a human can watch a
 * transfer against a real NAS, and a rate assertion would be a race against the machine's load.
 * Determinism comes from barriers, which are events on both sides.
 */

async function withStand(run: (stand: TestStandHostHandle) => Promise<void>): Promise<void> {
  const stand = await startTestStandHost();
  try {
    await run(stand);
  } finally {
    await stand.close();
  }
}

describe("test stand: what it serves", () => {
  it("serves the page uncached, because it is edited while it is open", async () => {
    await withStand(async (stand) => {
      const response = await fetch(stand.url);
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect((await response.text()).toLowerCase()).toContain("<!doctype html>");
    });
  });

  it("gives each link its own torrent, named after the file it describes", async () => {
    await withStand(async (stand) => {
      const body = Buffer.from(await (await fetch(`${stand.url}files/Big.Buck.Bunny.mkv.torrent`)).arrayBuffer());
      // Routing is tested against the real `info.name`; a shared fixture would make every link
      // identical inside and the routing assertions meaningless.
      expect(body.toString("latin1")).toContain("4:name18:Big.Buck.Bunny.mkv");
    });
  });

  it("reveals a tracker release name only through Content-Disposition", async () => {
    await withStand(async (stand) => {
      const response = await fetch(`${stand.url}dl.php?name=Some.Release.2024`);
      expect(response.headers.get("content-type")).toBe("application/x-bittorrent");
      expect(response.headers.get("content-disposition")).toBe('attachment; filename="Some.Release.2024.torrent"');
    });
  });

  it("logs every request, which is how a spec proves no bytes flowed", async () => {
    await withStand(async (stand) => {
      await fetch(`${stand.url}files/plain-clip.mkv`);
      expect(stand.requestLog).toContainEqual({ path: "/files/plain-clip.mkv", method: "GET" });
    });
  });
});

describe("test stand: how it delivers", () => {
  it("declares an honest Content-Length for a generated file and delivers exactly that", async () => {
    await withStand(async (stand) => {
      const response = await fetch(`${stand.url}files/big.bin?mb=1&kbps=1048576`);
      expect(response.headers.get("content-length")).toBe(String(1024 * 1024));
      expect((await response.arrayBuffer()).byteLength).toBe(1024 * 1024);
    });
  });

  it("can withhold Content-Length, leaving a client with no total to show a percentage of", async () => {
    await withStand(async (stand) => {
      const response = await fetch(`${stand.url}files/big.bin?mb=1&nolength=1&kbps=1048576`);
      expect(response.headers.get("content-length")).toBeNull();
      expect((await response.arrayBuffer()).byteLength).toBe(1024 * 1024);
    });
  });

  it("holds at a barrier until released, with no wall-clock guess on either side", async () => {
    await withStand(async (stand) => {
      const request = fetch(`${stand.url}files/big.bin?mb=1&barrierAt=65536&barrier=half`);

      // Both halves of the rendezvous are events. Nothing here waits a fixed duration, so there
      // is no figure to tune and nothing to flake on a loaded machine.
      await stand.barriers.reachedAt("half");
      stand.barriers.release("half");

      expect((await (await request).arrayBuffer()).byteLength).toBe(1024 * 1024);
    });
  });

  it("ends cleanly short of its promised length — the failure a client is likeliest to miss", async () => {
    await withStand(async (stand) => {
      const response = await fetch(`${stand.url}files/big.bin?mb=1&truncateAt=131072&kbps=1048576`);
      // The promise and the delivery disagree, and nothing signals an error: the socket simply
      // ends. A client trusting the close over the declared length calls a partial file complete.
      expect(response.headers.get("content-length")).toBe(String(1024 * 1024));
      await expect(response.arrayBuffer()).rejects.toThrow();
    });
  });

  it("resets the connection mid-transfer when asked", async () => {
    await withStand(async (stand) => {
      const response = await fetch(`${stand.url}files/big.bin?mb=1&abortAt=131072&kbps=1048576`);
      await expect(response.arrayBuffer()).rejects.toThrow();
    });
  });

  it("serves a range from an offset, which is what a resumed download asks for", async () => {
    await withStand(async (stand) => {
      const total = 1024 * 1024;
      const response = await fetch(`${stand.url}files/big.bin?mb=1&kbps=1048576`, {
        headers: { range: "bytes=524288-" },
      });
      expect(response.status).toBe(206);
      expect(response.headers.get("content-range")).toBe(`bytes 524288-${total - 1}/${total}`);
      expect((await response.arrayBuffer()).byteLength).toBe(total - 524288);
      // The log carries the range, so a real-NAS run can show whether Download Station resumes.
      expect(stand.requestLog[stand.requestLog.length - 1]?.range).toBe("bytes=524288-");
    });
  });

  it("can refuse ranges, as a plain file server does", async () => {
    await withStand(async (stand) => {
      const response = await fetch(`${stand.url}files/big.bin?mb=1&noranges=1&kbps=1048576`, {
        headers: { range: "bytes=524288-" },
      });
      expect(response.status).toBe(200);
      expect(response.headers.get("accept-ranges")).toBe("none");
      expect((await response.arrayBuffer()).byteLength).toBe(1024 * 1024);
    });
  });

  it("follows a redirect chain to the real file", async () => {
    await withStand(async (stand) => {
      const response = await fetch(`${stand.url}redirect?hops=3&to=/files/plain-clip.mkv`);
      expect(response.status).toBe(200);
      expect(await response.text()).toContain("plain-clip.mkv");
      expect(stand.requestLog.filter((entry) => entry.path === "/redirect")).toHaveLength(3);
    });
  });

  it("returns the error status it was asked for", async () => {
    await withStand(async (stand) => {
      for (const code of [403, 404, 503]) {
        expect((await fetch(`${stand.url}status/${code}`)).status).toBe(code);
      }
    });
  });
});
