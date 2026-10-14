import assert from "node:assert/strict";
import { test } from "node:test";
import { collectGroups, scanSource } from "./audit.mjs";

test("inventories implementations and nested callbacks, excluding type-only signatures", () => {
  const result = scanSource(
    "src/sample.ts",
    "type F = () => void; class Client { send() { [1].map(value => value + 1); } } function load() { return true; }",
  );
  assert.equal(result.functions.length, 3);
  assert.deepEqual(
    result.functions.map((fn) => fn.name),
    ["send", "callback:array.map", "load"],
  );
});

test("Svelte script, inline callbacks and snippets keep original lines after Unicode", () => {
  const text =
    '<script lang="ts">\nconst label = "😀";\nfunction save() {}\n</script>\n<button onclick={() => save()}>Save</button>\n{#snippet extra()}<p>{label}</p>{/snippet}';
  const result = scanSource("src/Screen.svelte", text);
  assert.deepEqual(
    result.functions.map((fn) => [fn.kind, fn.line]),
    [
      ["FunctionDeclaration", 3],
      ["ArrowFunction", 5],
      ["SvelteSnippet", 6],
    ],
  );
});

test("distinguishes actual any, double assertions and const literals from prose", () => {
  const result = scanSource(
    "src/sample.test.ts",
    '// any is a word\nconst note = "any";\nconst data = value as unknown as string;\nconst fixture = {} as any;\nconst key = "x" as const;',
  );
  assert.equal(result.risks.filter((risk) => risk.kind === "explicit-any").length, 1);
  assert.equal(result.risks.filter((risk) => risk.kind === "double-assertion").length, 1);
  assert.equal(result.risks.filter((risk) => risk.kind === "const-assertion").length, 1);
  assert.equal(result.scope, "tests");
});

test("renamed whole-body matches are candidates, not semantic duplication certificates", () => {
  const source =
    "function a(value) { if (value) { const next = value + 1; return [next, value].map(item => item * 2).filter(item => item > 5); } return []; }\nfunction b(input) { if (input) { const result = input + 2; return [result, input].map(entry => entry * 3).filter(entry => entry > 9); } return []; }";
  const functions = scanSource("src/sample.ts", source).functions;
  const groups = collectGroups(functions);
  assert.equal(
    groups.some((group) => group.mode === "exact"),
    false,
  );
  assert.equal(groups.filter((group) => group.mode === "shape").length, 1);
  assert.equal(groups[0].status, "candidate-not-semantic-proof");
});

test("inline HTML fixture scripts are included while external script tags add no invented function", () => {
  const result = scanSource(
    "tests/e2e/fixtures/demo.html",
    '<h1>Demo</h1>\n<script src="runtime.js"></script>\n<script>\nfunction respond() { return true; }\n</script>',
  );
  assert.deepEqual(
    result.functions.map((fn) => [fn.name, fn.line]),
    [["respond", 4]],
  );
});
