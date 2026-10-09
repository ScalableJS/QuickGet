import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function audit(root, registry) {
  const errors = validate(registry);
  if (errors.length)
    return { errors, features: [], links: [], unclassified: [], total: 0, linked: 0, current: 0, areas: [] };
  const ids = new Set(registry.features.map((feature) => feature.id));
  const pages = walk(root, "").filter((path) => path.endsWith(".md"));
  const features = registry.features.map((feature) => {
    const problems = [];
    for (const path of [...feature.sources, ...feature.evidence]) {
      if (!safePath(path) || !existsSync(resolve(root, path))) problems.push(`Missing or unsafe file: ${path}`);
    }
    for (const link of feature.docs) {
      const problem = resolveLink(root, link, "docs/features.json", pages);
      if (problem) problems.push(problem);
      const canonical = documentPath(link, pages);
      if (
        !canonical ||
        !safePath(canonical) ||
        !/\.md$/.test(canonical) ||
        !existsSync(resolve(root, canonical)) ||
        /^(?:https?:|mailto:)/.test(link)
      )
        problems.push(
          `Canonical documentation must be local Markdown with a repository-root path or unambiguous wikilink: ${link}`,
        );
    }
    if (feature.implementation !== "planned" && !feature.sources.length)
      problems.push("Implemented feature has no source files");
    if (feature.assessment === "verified" && (!feature.docs.length || !feature.review))
      problems.push("Verified feature needs documentation and an explicit review");
    const linked = feature.docs.length > 0 && !problems.length;
    const snapshot = fingerprint(root, feature, registry);
    const drift = Boolean(feature.review && feature.review.snapshot !== snapshot);
    const current = linked && feature.assessment === "verified" && !drift;
    for (const problem of problems) errors.push(`${feature.id}: ${problem}`);
    return { ...feature, linked, current, drift, state: drift ? "needs-review" : feature.assessment };
  });
  const files = discoverFiles(root);
  const unclassified = [];
  const classifiedPaths = new Set();
  for (const item of registry.classifications) {
    if (classifiedPaths.has(item.path)) errors.push(`Duplicate classification: ${item.path}`);
    classifiedPaths.add(item.path);
    if (!safePath(item.path) || !existsSync(resolve(root, item.path)))
      errors.push(`Missing classified file: ${item.path}`);
    checkOwners(item, ids, errors);
    for (const id of item.features) {
      if (!registry.features.find((feature) => feature.id === id)?.sources.includes(item.path))
        errors.push(`${item.path}: owner ${id} must include this file in sources`);
    }
  }
  for (const file of files) if (!classifiedPaths.has(file)) unclassified.push(`file:${file}`);
  const links = [];
  const referencedDocs = new Set(features.flatMap((feature) => feature.docs.map((link) => documentPath(link, pages))));
  for (const page of pages.filter((path) => path.startsWith("docs/"))) {
    if (/^status: active$/m.test(readFileSync(resolve(root, page), "utf8"))) referencedDocs.add(page);
  }
  for (const page of [...referencedDocs]
    .filter((page) => page && safePath(page) && existsSync(resolve(root, page)))
    .sort()) {
    const text = stripCode(readFileSync(resolve(root, page), "utf8"));
    for (const match of text.matchAll(/\[\[([^\]]+)\]\]|!?\[[^\]]*\]\(<?([^\s>)]+)>?(?:\s+"[^"]*")?\)/g)) {
      const target = match[1] === undefined ? match[2] : `[[${match[1]}]]`;
      const problem = resolveLink(root, target, page, pages);
      if (problem) links.push(`${page}: ${target}: ${problem}`);
    }
  }
  const counted = features.filter((feature) => feature.implementation !== "planned");
  const areas = [...new Set(counted.map((feature) => feature.area))].sort().map((area) => {
    const subset = counted.filter((feature) => feature.area === area);
    return {
      area,
      total: subset.length,
      linked: subset.filter((feature) => feature.linked).length,
      current: subset.filter((feature) => feature.current).length,
    };
  });
  return {
    errors,
    features,
    links: [...new Set(links)],
    unclassified,
    total: counted.length,
    linked: counted.filter((feature) => feature.linked).length,
    current: counted.filter((feature) => feature.current).length,
    areas,
    discoveredFiles: files.length,
  };
}

export function fingerprint(root, feature, registry) {
  const pages = walk(root, "").filter((path) => path.endsWith(".md"));
  const paths = [
    ...new Set([
      ...feature.sources,
      ...feature.evidence,
      ...feature.docs.map((link) => documentPath(link, pages)).filter(Boolean),
    ]),
  ].sort();
  const hash = createHash("sha256");
  hash.update(
    JSON.stringify({
      id: feature.id,
      title: feature.title,
      area: feature.area,
      implementation: feature.implementation,
      assessment: feature.assessment,
      docs: feature.docs,
      sources: feature.sources,
      evidence: feature.evidence,
      notes: feature.notes,
      classifications: registry.classifications.filter((item) => item.features.includes(feature.id)),
    }),
  );
  for (const path of paths) {
    hash.update(path);
    hash.update(safePath(path) && existsSync(resolve(root, path)) ? readFileSync(resolve(root, path)) : "MISSING");
  }
  return hash.digest("hex");
}

export function render(result, registry) {
  const lines = [
    "---",
    "type: reference",
    "status: active",
    "area: documentation",
    `updated: ${registry.inventory.date}`,
    "---",
    "",
    "# Documentation coverage",
    "",
    `Inventory: ${registry.inventory.date}. Generated from docs/features.json and current file contents.`,
    "",
    `**Linked: ${ratio(result.linked, result.total)}. Reviewed and unchanged: ${ratio(result.current, result.total)}.**`,
    "",
    "The denominator is registered implemented features, including implemented portions of partial features. Planned features do not count. A reviewed snapshot confirms documentation was compared with the implementation; it does not prove runtime behavior, field reliability, or that no feature was overlooked.",
    "",
    `Discovered source files: ${result.discoveredFiles}. Unclassified files: ${result.unclassified.length}.`,
    "",
    registry.inventory.notes,
    "",
    "| Area | Features | Linked | Reviewed |",
    "|---|---:|---:|---:|",
    ...result.areas.map((area) => `| ${area.area} | ${area.total} | ${area.linked} | ${area.current} |`),
    "",
    "## Features",
    "",
    "| ID | Capability | Implementation | Documentation | Review |",
    "|---|---|---|---|---|",
    ...result.features.map(
      (feature) =>
        `| ${feature.id} | ${escapeCell(feature.title)} | ${feature.implementation} | ${feature.docs.map((link) => `[page](${markdownTarget(link)})`).join(", ") || "missing"} | ${feature.current ? "verified" : feature.state} |`,
    ),
    "",
    "## Needs attention",
    "",
  ];
  const attention = result.features.filter((feature) => !feature.current && feature.implementation !== "planned");
  lines.push(
    ...(attention.length
      ? attention.map((feature) => `- **${feature.id}** (${feature.state}): ${feature.notes}`)
      : [
          "All registered implemented features have current reviews. New behavior inside an existing file still requires human review.",
        ]),
  );
  for (const [title, items] of [
    ["Unclassified sources", result.unclassified],
    ["Registry errors", result.errors],
    ["Unresolved canonical-page links", result.links],
  ]) {
    lines.push("", `## ${title}`, "", ...(items.length ? items.map((item) => `- ${escapeCell(item)}`) : ["None."]));
  }
  lines.push(
    "",
    "## Exclusions from independent features",
    "",
    ...registry.classifications
      .filter((item) => !item.features.length)
      .map((item) => `- \`${item.path}\`: ${item.reason}`),
    "",
    "## Boundaries",
    "",
    "Discovery scans extension TypeScript, Svelte, HTML and CSS; operational scripts; fixture/mock support; Storybook configuration; manifests; build configuration; and GitHub workflows. Unit tests, E2E, declarations and stories do not create independent features; they can provide evidence. A new capability within an existing file cannot be discovered automatically. Product use and duplicate behavior require call-site and test review; a coverage percentage is not evidence that a feature is useful.",
    "",
    "See [the documentation workflow](documentation.md), [the feature review](feature-review.md), and [the knowledge-base entrypoint](README.md).",
    "",
  );
  return lines.join("\n");
}

export function strictProblems(result, registry) {
  const baseline = registry.baseline;
  return [
    ...result.errors,
    ...result.unclassified.filter((item) => !baseline.unclassified.includes(item)),
    ...result.links.filter((item) => !baseline.links.includes(item)),
    ...result.features
      .filter(
        (feature) =>
          feature.implementation !== "planned" && !feature.current && !baseline.reviewDebt.includes(feature.id),
      )
      .map((feature) => `${feature.id}: ${feature.state}`),
  ];
}

export function compareRegistry(registry, previous) {
  const problems = [];
  for (const feature of previous.features) {
    const now = registry.features.find((item) => item.id === feature.id);
    if (
      (!now || (feature.implementation !== "planned" && now.implementation === "planned")) &&
      !registry.retired.some((item) => item.id === feature.id && typeof item.reason === "string" && item.reason.length)
    )
      problems.push(`Feature removed from denominator without retirement reason: ${feature.id}`);
  }
  for (const key of ["links", "unclassified", "reviewDebt"])
    for (const item of registry.baseline[key])
      if (!previous.baseline[key].includes(item)) problems.push(`Documentation debt baseline grew (${key}): ${item}`);
  return problems;
}

export function discoverFiles(root) {
  const scopes = [
    "src",
    "scripts",
    ".storybook",
    ".github/workflows",
    "tests/e2e/support",
    "tests/fixtures",
    "tests/mocks",
  ];
  const files = scopes.flatMap((dir) =>
    walk(root, dir).filter(
      (path) => /\.(?:ts|svelte|html|css|js|mjs|yml)$/.test(path) && !/(?:\.test|\.spec|\.stories|\.d)\./.test(path),
    ),
  );
  const configuration = [
    "package.json",
    "manifest.json",
    "manifest.firefox.json",
    "vite.config.ts",
    "vitest.config.ts",
    "playwright.config.ts",
    "aliases.config.ts",
    "uno.config.ts",
    "svelte.config.js",
    "biome.json",
    "knip.jsonc",
    "rulesync.jsonc",
  ];
  return [...files, ...configuration.filter((path) => existsSync(resolve(root, path)))].sort();
}

export function resolveLink(root, link, origin, pages = walk(root, "").filter((path) => path.endsWith(".md"))) {
  if (/^(?:https?:|mailto:|tel:|data:)/.test(link)) return null;
  const wiki = link.startsWith("[[");
  const target = wiki ? link.slice(2, -2).split("|")[0] : link;
  try {
    decodeURIComponent(target);
  } catch {
    return `Malformed URL encoding: ${target}`;
  }
  const [path, ...fragment] = target.split("#");
  let resolved;
  if (wiki) {
    const matches = path
      ? pages.filter(
          (page) => page === path || page === `${path}.md` || page.endsWith(`/${path.replace(/\.md$/, "")}.md`),
        )
      : [origin];
    if (matches.length !== 1) return `${matches.length ? "Ambiguous" : "Missing"} wikilink: ${target}`;
    resolved = matches[0];
  } else {
    const decoded = decodeURIComponent(path);
    resolved = decoded
      ? origin === "docs/features.json"
        ? decoded
        : posix.normalize(posix.join(posix.dirname(origin), decoded))
      : origin;
  }
  if (!safePath(resolved) || !existsSync(resolve(root, resolved))) return `Missing or unsafe link: ${target}`;
  if (fragment.length && resolved.endsWith(".md")) {
    const anchor = decodeURIComponent(fragment.join("#"));
    const text = readFileSync(resolve(root, resolved), "utf8");
    const headings = [...stripCode(text).matchAll(/^#{1,6}\s+(.+?)\s*#*\s*$/gm)].map((match) =>
      match[1].replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[*_`]/g, ""),
    );
    const used = new Map();
    const anchors = headings.map((heading) => {
      const slug = heading
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, "")
        .replace(/\s/g, "-");
      const count = used.get(slug) || 0;
      used.set(slug, count + 1);
      return count ? `${slug}-${count}` : slug;
    });
    const block =
      anchor.startsWith("^") &&
      new RegExp(`\\^${anchor.slice(1).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "m").test(text);
    if (!anchors.includes(anchor) && !(wiki && headings.includes(anchor)) && !block && !text.includes(`id="${anchor}"`))
      return `Missing heading: ${target}`;
  }
  return null;
}

function validate(registry) {
  const errors = [];
  if (
    registry?.version !== 1 ||
    !Array.isArray(registry.features) ||
    !Array.isArray(registry.classifications) ||
    !Array.isArray(registry.retired) ||
    !registry.inventory ||
    !["date", "notes"].every((key) => typeof registry.inventory[key] === "string") ||
    !registry.baseline ||
    !["links", "unclassified", "reviewDebt"].every(
      (key) =>
        Array.isArray(registry.baseline[key]) && registry.baseline[key].every((value) => typeof value === "string"),
    )
  )
    return ["Invalid registry envelope (version, features, classifications, retired, inventory, baseline)"];
  const ids = new Set();
  for (const feature of registry.features) {
    if (!feature || typeof feature.id !== "string" || !/^[a-z][a-z0-9-]+$/.test(feature.id) || ids.has(feature.id))
      errors.push(`Invalid or duplicate feature ID: ${feature?.id}`);
    ids.add(feature?.id);
    if (
      !["title", "area", "notes"].every((key) => typeof feature?.[key] === "string") ||
      !["docs", "sources", "evidence"].every(
        (key) => Array.isArray(feature?.[key]) && feature[key].every((value) => typeof value === "string"),
      ) ||
      !["implemented", "partial", "planned"].includes(feature?.implementation) ||
      !["verified", "partial", "missing"].includes(feature?.assessment)
    )
      errors.push(`Invalid feature: ${feature?.id}`);
    if (
      feature?.review &&
      (!["date", "reviewer", "reason", "snapshot"].every(
        (key) => typeof feature.review[key] === "string" && feature.review[key].length > 0,
      ) ||
        !/^[a-f0-9]{64}$/.test(feature.review.snapshot))
    )
      errors.push(`Invalid review: ${feature.id}`);
  }
  for (const item of registry.classifications)
    if (
      !item ||
      !Array.isArray(item.features) ||
      !item.features.every((id) => typeof id === "string") ||
      typeof item.reason !== "string" ||
      !item.reason.length ||
      typeof item.path !== "string" ||
      ("method" in item && !/^[A-Z]+$/.test(item.method))
    )
      errors.push("Invalid surface classification");
  return errors;
}

function checkOwners(item, ids, errors) {
  for (const id of item.features) if (!ids.has(id)) errors.push(`${item.path}: unknown feature ${id}`);
}

function documentPath(link, pages) {
  if (link.startsWith("[[")) {
    const path = link.slice(2, -2).split("|")[0].split("#")[0];
    const matches = pages.filter(
      (page) => page === path || page === `${path}.md` || page.endsWith(`/${path.replace(/\.md$/, "")}.md`),
    );
    return matches.length === 1 ? matches[0] : undefined;
  }
  try {
    return decodeURIComponent(link.split("#")[0]);
  } catch {
    return undefined;
  }
}

function walk(root, dir) {
  const full = resolve(root, dir);
  if (!existsSync(full)) return [];
  return readdirSync(full, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith(".") || ["node_modules", "build", "dist", "web-build"].includes(entry.name)) return [];
    const path = posix.join(dir, entry.name);
    return entry.isDirectory() ? walk(root, path) : entry.isFile() ? [path] : [];
  });
}

function safePath(path) {
  return typeof path === "string" && path.length > 0 && !path.startsWith("/") && !path.split("/").includes("..");
}

function stripCode(text) {
  return text.replace(/^\s*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\s*\1\s*$/gm, "").replace(/`[^`\n]*`/g, "");
}
function ratio(count, total) {
  return total ? `${count}/${total} (${((count / total) * 100).toFixed(2)}%)` : "N/A (0 features)";
}
function escapeCell(text) {
  return text.replace(/\|/g, "\\|").replace(/\n/g, " ");
}
function markdownTarget(link) {
  return link.startsWith("[[") ? link.slice(2, -2).split("|")[0] : `../../${link}`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const rootIndex = args.indexOf("--root");
  const root =
    rootIndex === -1 ? resolve(dirname(fileURLToPath(import.meta.url)), "../..") : resolve(args[rootIndex + 1]);
  let stagedRoot;
  try {
    if (args.includes("--staged")) {
      if (args.includes("--write")) throw new Error("--staged is read-only and cannot be combined with --write");
      stagedRoot = mkdtempSync(resolve(tmpdir(), "quickget-docs-index-"));
      execFileSync("git", ["checkout-index", "--all", `--prefix=${stagedRoot}/`], { cwd: root });
    }
    const inspectedRoot = stagedRoot || root;
    const registry = JSON.parse(readFileSync(resolve(inspectedRoot, "docs/features.json"), "utf8"));
    const result = audit(inspectedRoot, registry);
    const problems = args.includes("--strict") ? strictProblems(result, registry) : result.errors;
    const baseIndex = args.indexOf("--base");
    if (baseIndex !== -1) {
      const revision = args[baseIndex + 1];
      if (!revision || revision.startsWith("-")) throw new Error("Invalid --base revision");
      const file = `${revision}:docs/features.json`;
      execFileSync("git", ["rev-parse", "--verify", revision], { cwd: root, stdio: ["ignore", "ignore", "ignore"] });
      const path = execFileSync("git", ["ls-tree", "--name-only", revision, "docs/features.json"], {
        cwd: root,
        encoding: "utf8",
      });
      if (path.length) {
        const previous = JSON.parse(execFileSync("git", ["show", file], { cwd: root, encoding: "utf8" }));
        problems.push(...compareRegistry(registry, previous));
      }
    }
    if (args.includes("--write") && !result.errors.length)
      writeFileSync(resolve(root, "docs/system/coverage.md"), render(result, registry));
    console.log(
      args.includes("--json")
        ? JSON.stringify({ ...result, gateProblems: problems }, null, 2)
        : render(result, registry),
    );
    if (problems.length) console.error(problems.join("\n"));
    process.exitCode = problems.length ? 1 : 0;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    if (stagedRoot) rmSync(stagedRoot, { recursive: true, force: true });
  }
}
