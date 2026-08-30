/**
 * WCAG contrast gate for the popup design tokens.
 *
 * Exists because the palette regressed silently: `f20daf0` hand-picked light-theme
 * colours with no contrast check, leaving control borders at 1.40:1 against a 3:1
 * requirement. Nothing caught it. This does.
 *
 * Resolves `var()` chains out of tokens.css for both themes, so a token is judged by
 * the colour it actually renders, not by the alias it is written as.
 */
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

const css = read("../src/popup/styles/tokens.css").replace(/\/\*[\s\S]*?\*\//g, "");

/** Pull one `--name: value;` map out of the block a selector opens. */
/**
 * Walk every top-level `selector { ... }` rule and collect the custom properties from
 * those whose selector list matches, in source order — later wins, as the cascade does.
 * Matching the selector list (rather than a substring of the file) is what lets a rule
 * written as `:root,\n:root[data-theme="light"]` be found by either name.
 */
function block(wanted) {
  const out = {};
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = m[1]
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    if (!selectors.includes(wanted)) continue;
    for (const d of m[2].matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) out[d[1]] = d[2].trim();
  }
  return out;
}

/** Every `--x: value;` in a stylesheet, whatever selector holds it. */
function allVars(text) {
  const out = {};
  for (const m of text.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) out[m[1]] = m[2].trim();
  return out;
}

const base = { ...allVars(css), ...block(":root") };
const light = { ...base, ...block(":root"), ...block(':root[data-theme="light"]') };
const dark = { ...base, ...block(':root[data-theme="dark"]') };

function resolve(value, vars, depth = 0) {
  if (!value || depth > 12) return null;
  const v = value.trim();
  const ref = /^var\((--[a-z0-9-]+)\)$/i.exec(v);
  if (ref) return resolve(vars[ref[1]], vars, depth + 1);
  if (/^#[0-9a-f]{3,8}$/i.test(v)) return v;
  return null; // color-mix() and friends: not statically decidable, skipped
}

function rgb(hex) {
  let h = hex.slice(1);
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  if (h.length === 8) h = h.slice(0, 6); // ignore alpha: worst case is over an opaque bg
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}

const luminance = (hex) => {
  const [r, g, b] = rgb(hex).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** WCAG 1.4.3 for text (4.5), plus a 3:1 keyboard-focus indicator. */
const RULES = [
  ["--color-text", "--color-bg", 4.5, "primary text"],
  ["--color-text-secondary", "--color-bg", 4.5, "secondary text"],
  ["--color-text", "--color-bg-alt", 4.5, "text on alt surface"],
  ["--color-text-secondary", "--color-bg-alt", 4.5, "secondary on alt surface"],
  ["--color-primary", "--color-bg", 4.5, "accent on surface"],
  ["--color-text-on-primary", "--color-primary-solid", 4.5, "primary button label"],
  ["--color-error", "--color-bg", 4.5, "error text"],
  ["--color-focus-ring", "--color-bg", 3.0, "keyboard focus ring"],
  ["--color-checkbox-border", "--color-bg", 3.0, "unchecked checkbox boundary"],
  ["--textbox-text", "--textbox-bg", 4.5, "textbox text"],
  ["--textbox-placeholder", "--textbox-bg", 4.5, "placeholder"],
];

let failed = 0;
let checked = 0;
for (const [themeName, vars] of [
  ["light", light],
  ["dark", dark],
]) {
  console.log(`\n${themeName} theme`);
  for (const [fg, bg, need, label] of RULES) {
    const f = resolve(vars[fg], vars);
    const b = resolve(vars[bg], vars);
    if (!f || !b) {
      console.log(`  SKIP ${label} (${fg} unresolved)`);
      continue;
    }
    checked++;
    const r = ratio(f, b);
    const ok = r >= need;
    if (!ok) failed++;
    console.log(`  ${ok ? "ok  " : "FAIL"} ${r.toFixed(2).padStart(5)} (need ${need})  ${label}  ${f} on ${b}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} contrast check(s) failed.`);
  process.exit(1);
}
// A run where everything resolved to nothing must not report success: that is how a
// broken parser silently turns into a green check.
if (checked === 0) {
  console.error("\nNo pair could be resolved — the token parser is broken, not the palette.");
  process.exit(1);
}
console.log(`\nAll ${checked} contrast checks passed.`);
