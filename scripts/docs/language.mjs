import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import ts from "typescript";

// These tests require non-Latin data to verify UTF-8 handling, not non-English prose.
const unicodeFixtures = new Set([
  "src/api/index.test.ts",
  "src/lib/torrentMeta.test.ts",
  "src/lib/torrentSender.test.ts",
]);
const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
  encoding: "utf8",
}).split("\0");
let checked = 0;
let fixtureOccurrences = 0;
const problems = [];
for (const file of new Set(files)) {
  if (!/\.(?:md|ts|svelte|html|css|js|mjs|json|jsonc|yml|yaml|base)$/.test(file)) continue;
  const text = readFileSync(file, "utf8");
  checked += 1;
  const literals = [];
  if (unicodeFixtures.has(file)) {
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    function collectLiterals(node) {
      if (ts.isStringLiteral(node)) literals.push([node.getStart(source), node.getEnd()]);
      ts.forEachChild(node, collectLiterals);
    }
    collectLiterals(source);
  }
  for (const match of text.matchAll(/[\u0400-\u04ff]+/g)) {
    if (literals.some(([start, end]) => match.index >= start && match.index < end)) {
      fixtureOccurrences += 1;
    } else {
      const line = text.slice(0, match.index).split("\n").length;
      problems.push(`${file}:${line}: non-English Cyrillic prose/comment/description`);
    }
  }
}
if (problems.length) {
  console.error(problems.join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    `English-prose guard passed: ${checked} text files; ${fixtureOccurrences} deliberate Unicode fixture literals retained.`,
  );
}
