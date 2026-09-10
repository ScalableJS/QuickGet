import { startMockNas } from "../tests/e2e/support/mockNas.js";
import { startTestStandHost } from "../tests/e2e/support/testStandHost.js";

async function main() {
  const stand = await startTestStandHost({ port: 3300 });
  const mockNas = await startMockNas();

  console.log("==================================================");
  console.log("🚀 QuickGet Remote Test Stand & Mock NAS Started!");
  console.log("==================================================");
  console.log(
    `📡 Test Stand:    ${stand.url} (Torrents, Magnets, Direct URLs, Domains)`
  );
  console.log(`💾 Mock QNAP NAS:  http://127.0.0.1:${mockNas.port}`);
  console.log("🔑 NAS Login:      admin");
  console.log("🔑 NAS Password:   demo-password");
  console.log(
    "📁 Folders:        Temp: Download / Target: Multimedia/Movies"
  );
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
