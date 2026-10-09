import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { audit, compareRegistry, fingerprint, render, resolveLink, strictProblems } from "./check.mjs";

test("counts implemented features, excludes documented planned features, and never calls an empty set 100%", (t) => {
  const { root, registry } = fixture(t);
  registry.features.push({ ...registry.features[0], id: "future-feature", implementation: "planned" });
  assert.deepEqual([audit(root, registry).total, audit(root, registry).linked], [1, 1]);
  registry.features = [];
  registry.classifications = [];
  assert.match(render(audit(root, registry), registry), /N\/A/);
});

test("source, prose, evidence, and shared ownership changes require a new explicit review", (t) => {
  const { root, registry } = fixture(t);
  registry.features.push({ ...structuredClone(registry.features[0]), id: "shared-feature" });
  registry.classifications[0].features.push("shared-feature");
  for (const feature of registry.features) feature.review.snapshot = fingerprint(root, feature, registry);
  assert.equal(audit(root, registry).current, 2);
  for (const path of ["src/feature.ts", "docs/system/feature.md", "src/feature.test.ts"]) {
    const original = readFileSync(join(root, path), "utf8");
    writeFileSync(join(root, path), `${original}\nchanged`);
    const result = audit(root, registry);
    assert.equal(result.current, 0, path);
    assert.ok(strictProblems(result, registry).length);
    writeFileSync(join(root, path), original);
  }
  registry.classifications[0].reason = "Changed ownership contract";
  assert.equal(audit(root, registry).current, 0);
});

test("new Svelte, CSS, and operational sources cannot silently escape the inventory", (t) => {
  const { root, registry } = fixture(t);
  put(root, "src/New.svelte", "<p>New behavior</p>");
  put(root, "src/new.css", "p { color: red; }");
  put(root, "scripts/new.mjs", "export const value = 1;");
  put(root, "src/new.test.ts", "test");
  put(root, "src/new.stories.ts", "story");
  put(root, "src/schema.d.ts", "generated declaration");
  const result = audit(root, registry);
  assert.deepEqual(result.unclassified, ["file:scripts/new.mjs", "file:src/New.svelte", "file:src/new.css"]);
});

test("a missing canonical page, source, or local heading fails strict checking", (t) => {
  const { root, registry } = fixture(t);
  registry.features[0].docs = ["docs/system/feature.md#missing"];
  registry.features[0].sources = ["src/deleted.ts"];
  const result = audit(root, registry);
  assert.equal(result.linked, 0);
  assert.ok(result.errors.some((error) => error.includes("Missing heading")));
  assert.ok(result.errors.some((error) => error.includes("deleted.ts")));
});

test("Obsidian aliases resolve, ambiguous links and unsafe paths fail", (t) => {
  const { root } = fixture(t);
  assert.equal(resolveLink(root, "[[feature#Behavior|details]]", "docs/system/feature.md"), null);
  put(root, "docs/other/feature.md", "# Other");
  assert.match(resolveLink(root, "[[feature]]", "docs/system/feature.md"), /Ambiguous/);
  assert.match(resolveLink(root, "../../../outside.md", "docs/system/feature.md"), /unsafe/);
});

test("document-relative links cannot accidentally resolve to a same-named repository file", (t) => {
  const { root } = fixture(t);
  put(root, "README.md", "# Root");
  assert.match(resolveLink(root, "README.md", "docs/system/feature.md"), /Missing/);
});

test("removing features or hiding them as planned needs retirement evidence; review debt cannot grow", (t) => {
  const { registry } = fixture(t);
  const previous = structuredClone(registry);
  registry.features[0].implementation = "planned";
  registry.baseline.reviewDebt.push("example-feature");
  assert.equal(compareRegistry(registry, previous).length, 2);
  registry.retired.push({
    id: "example-feature",
    reason: "Removed from the shipped product after a reviewed decision.",
  });
  registry.baseline.reviewDebt = [];
  assert.deepEqual(compareRegistry(registry, previous), []);
});

test("ordinary checks are read-only and justified single-feature review resolves drift", (t) => {
  const { root, registry } = fixture(t);
  put(root, "docs/features.json", JSON.stringify(registry));
  put(root, "src/feature.ts", "export const value = 2;");
  const checker = resolve("scripts/docs/check.mjs");
  assert.equal(spawnSync(process.execPath, [checker, "--root", root, "--strict"]).status, 1);
  assert.equal(
    JSON.parse(readFileSync(join(root, "docs/features.json"))).features[0].review.snapshot,
    registry.features[0].review.snapshot,
  );
  const review = spawnSync(process.execPath, [
    resolve("scripts/docs/review.mjs"),
    "example-feature",
    "--root",
    root,
    "--reviewer",
    "test",
    "--reason",
    "Compared the changed implementation with the canonical behavior.",
    "--assessment",
    "verified",
  ]);
  assert.equal(review.status, 0, review.stderr.toString());
  assert.equal(spawnSync(process.execPath, [checker, "--root", root, "--strict"]).status, 0);
});

test("staged checks reject source content absent from the reviewed index even when the working tree is current", (t) => {
  const { root, registry } = fixture(t);
  execFileSync("git", ["init", "--quiet"], { cwd: root });
  put(root, "docs/features.json", JSON.stringify(registry));
  execFileSync("git", ["add", "."], { cwd: root });
  put(root, "src/feature.ts", "export const value = 2;");
  registry.features[0].review.snapshot = fingerprint(root, registry.features[0], registry);
  put(root, "docs/features.json", JSON.stringify(registry));
  execFileSync("git", ["add", "docs/features.json"], { cwd: root });
  const checker = resolve("scripts/docs/check.mjs");
  assert.equal(spawnSync(process.execPath, [checker, "--root", root, "--strict"]).status, 0);
  assert.equal(spawnSync(process.execPath, [checker, "--root", root, "--strict", "--staged"]).status, 1);
});

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "quickget-documentation-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  put(root, "src/feature.ts", "export const value = 1;");
  put(root, "src/feature.test.ts", "existing test evidence");
  put(root, "docs/system/feature.md", "# Feature\n\n## Behavior\n\nCurrent behavior.\n");
  const registry = {
    version: 1,
    inventory: { date: "2026-10-09", notes: "Synthetic fixture, not product verification." },
    features: [
      {
        id: "example-feature",
        title: "Example",
        area: "test",
        implementation: "implemented",
        docs: ["docs/system/feature.md"],
        sources: ["src/feature.ts"],
        evidence: ["src/feature.test.ts"],
        assessment: "verified",
        notes: "Code inspection only.",
        review: {
          date: "2026-10-09",
          reviewer: "test",
          reason: "Compared fixture behavior.",
          snapshot: "0".repeat(64),
        },
      },
    ],
    classifications: [{ path: "src/feature.ts", features: ["example-feature"], reason: "Feature implementation" }],
    retired: [],
    baseline: { links: [], unclassified: [], reviewDebt: [] },
  };
  registry.features[0].review.snapshot = fingerprint(root, registry.features[0], registry);
  return { root, registry };
}

function put(root, path, content) {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), content);
}

test("the English guard accepts Unicode input strings but rejects comments and prose even in a fixture", (t) => {
  const { root } = fixture(t);
  execFileSync("git", ["init", "--quiet"], { cwd: root });
  const language = resolve("scripts/docs/language.mjs");
  const word = "\u0442\u0435\u0441\u0442";
  put(root, "src/lib/torrentMeta.test.ts", `const name = "${word}";\n`);
  assert.equal(spawnSync(process.execPath, [language], { cwd: root }).status, 0);
  put(root, "src/lib/torrentMeta.test.ts", `// ${word}\nconst name = "${word}";\n`);
  assert.equal(spawnSync(process.execPath, [language], { cwd: root }).status, 1);
  put(root, "src/lib/torrentMeta.test.ts", `const name = "${word}";\n`);
  put(root, "docs/prose.md", `# ${word}\n`);
  assert.equal(spawnSync(process.execPath, [language], { cwd: root }).status, 1);
});

test("active knowledge-base navigation outside a canonical feature page is also checked", (t) => {
  const { root, registry } = fixture(t);
  put(root, "docs/index.md", "---\nstatus: active\n---\n\n# Home\n\n[[missing-page]]\n");
  assert.ok(audit(root, registry).links.some((problem) => problem.includes("missing-page")));
});
