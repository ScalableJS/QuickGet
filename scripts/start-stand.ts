import { lanAddresses } from "../tests/e2e/support/lan.js";
import { startMockNas } from "../tests/e2e/support/mockNas.js";
import { startTestStandHost } from "../tests/e2e/support/testStandHost.js";

async function main() {
  // `QNAP_STAND_LAN=1` binds every interface, so a real NAS on the LAN can fetch the stand's
  // files. Without it the stand is loopback-only and a real NAS cannot reach it at all — it
  // answers `error 12288` for a `127.0.0.1` URL, which reads as a broken extension.
  const lan = process.env.QNAP_STAND_LAN === "1";
  const stand = await startTestStandHost({ port: 3300, host: lan ? "0.0.0.0" : undefined });
  const mockNas = await startMockNas();

  console.log("==================================================");
  console.log("🚀 QuickGet Remote Test Stand & Mock NAS Started!");
  console.log("==================================================");
  console.log(`📡 Test Stand:    ${stand.url} (Torrents, Magnets, Direct URLs, Domains)`);
  if (lan) {
    for (const address of lanAddresses()) {
      console.log(`🌐 Reachable by NAS: http://${address}:3300/  ← use this when testing against a real NAS`);
    }
  } else {
    console.log("🔒 Loopback only. A real NAS cannot fetch these files — restart with QNAP_STAND_LAN=1 for that.");
  }
  console.log(`💾 Mock QNAP NAS:  http://127.0.0.1:${mockNas.port}`);
  console.log("🔑 NAS Login:      admin");
  console.log("🔑 NAS Password:   demo-password");
  console.log("📁 Folders:        Temp: Download / Target: Multimedia/Movies");
  console.log("==================================================");
  console.log("Press Ctrl+C to stop.");

  const shutdown = async () => {
    console.log("\nShutting down...");
    await Promise.all([stand.close(), mockNas.close()]);
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
