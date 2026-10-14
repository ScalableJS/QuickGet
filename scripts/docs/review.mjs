import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { audit, fingerprint } from "./check.mjs";

// Deliberately accepts one feature only; no bulk snapshot refresh.
const args = process.argv.slice(2);
const id = args[0];
const option = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};
const reviewer = option("--reviewer");
const reason = option("--reason");
const assessment = option("--assessment");
const root = option("--root") ? resolve(option("--root")) : resolve(dirname(fileURLToPath(import.meta.url)), "../..");
if (!id || id.startsWith("--") || !reviewer || !reason || !["verified", "partial", "missing"].includes(assessment)) {
  console.error(
    "Usage: node tools/docs/review.mjs <feature-id> --reviewer <name> --reason <review evidence or no-doc-change reason> --assessment verified|partial|missing",
  );
  process.exitCode = 1;
} else {
  const path = resolve(root, "docs/features.json");
  const registry = JSON.parse(readFileSync(path, "utf8"));
  const feature = registry.features.find((item) => item.id === id);
  if (feature) {
    feature.assessment = assessment;
    feature.review = { date: new Date().toISOString().slice(0, 10), reviewer, reason, snapshot: "0".repeat(64) };
  }
  const result = audit(root, registry);
  if (!feature || result.errors.length) {
    console.error(!feature ? `Unknown feature: ${id}` : result.errors.join("\n"));
    process.exitCode = 1;
  } else if (assessment === "verified" && !feature.docs.length) {
    console.error("A verified feature requires documentation.");
    process.exitCode = 1;
  } else {
    feature.review.snapshot = fingerprint(root, feature, registry);
    writeFileSync(path, `${JSON.stringify(registry, null, 2)}\n`);
    console.log(`Recorded explicit review: ${id}. Run check.mjs --write to refresh the report.`);
  }
}
