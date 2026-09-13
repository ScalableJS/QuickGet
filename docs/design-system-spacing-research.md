# Research: the popup's spacing and surface system

Status: **implemented.** §1–§4 are the research as it stood before the work; §8 records what
was actually built and the one place where measurement overturned the recommendation. Tracked as `UX-26` in
`agent-os/product/settings-ux-kanban.md`. When a decision is taken, the rules below move into
`agent-os/standards/frontend/` (that is where the next author will read them); this file stays as
the reasoning.

The trigger was three complaints about Settings — "Folders" reads as attached to the block above
it, "Backup" has no air, Export/Import should share a row. They are one gap, not three bugs:
**nothing in the codebase defines what a section is.** The brief's own words for the goal are the
right ones: stop inventing it every time, use ready-made solutions, and keep a11y intact.

---

## 1. What is in the code today

Measured on `env/dev` @ `aec5094`, not assumed.

| Finding | Evidence |
| --- | --- |
| **Section separation does not exist as code.** `<section class="settings-section">` wraps all four groups and matches no CSS rule anywhere. There are no `<style>` blocks in any popup `.svelte` file. | `Settings.svelte:559,648,678,827`; `grep '\.settings-section' src/popup/styles/` → 0 |
| **26 legacy class names style nothing.** Leftovers from the pre-UnoCSS markup. Four of them — `connection-card`, `connection-health`, `connection-detail`, `routing-rule` — are load-bearing **E2E selectors** and must stay; the other 22 are removable. (An earlier draft of this row said none were used by tests. That was wrong: the first grep covered only a subset of the names.) | same file; `grep` over `tests/e2e/` for each name |
| **`FormSection` has no bottom margin** — only its `<legend>` does. Two fieldsets in one `<section>` (Connection + Folders) therefore touch. | `src/popup/ui/FormSection.svelte:12-15` |
| **Internal field spacing (16px) equals the gap between sections (16px).** That ratio is precisely why the boundary carries no signal. | `Settings.svelte`, `mb-[var(--spacing-md)]` on every `form-group` |
| **Two live spacing scales for the same values.** `--space-1..6` (4/8/12/16/24/32) and the `--spacing-xs/sm/md/lg` aliases. `--space-2` = `--spacing-sm` = 8px; `--space-4` = `--spacing-md` = 16px. Used interchangeably in the same file. | `tokens.css:11-21`; 118 arbitrary spacing utilities across 34 files |
| **Every utility is an arbitrary value.** 118 spacing + 309 colour utilities written as `p-[var(--spacing-md)]` / `bg-[var(--color-bg-alt)]`. No token is registered in `uno.config.ts`, so `p-4` and `bg-surface` are unavailable. | `uno.config.ts` has no `theme` block |
| **`Card.svelte`** (`filled` = raised surface + radius + shadow + 16px padding) is used by one Storybook showcase and **no product screen**, while `#add-urls-panel`/`#unlock-panel` hand-roll an equivalent surface inline and `#settings-panel` gets none. | `Card.svelte`; `index.html:26,29,32` |
| **`--radius-container: 10px`** where Wintry ships `--radius-container: 0.75rem` (12px). `--radius: 6px` does match Wintry's `--radius-base: 0.375rem`. | `tokens.css:26-27` vs `@skeletonlabs/skeleton@5.0.1/src/themes/wintry.css` |

---

## 2. Verified on this repo's toolchain

Not taken from documentation or from an advisor — generated with the repo's own
`unocss@66.8.1` + `@unocss/preset-wind4` and read off the output.

| Claim | Result |
| --- | --- |
| `p-4`, `gap-2`, `gap-6`, `mb-6` work out of the box | ✅ emit `calc(var(--spacing) * N)`, and the preset itself emits `:root, :host { --spacing: 0.25rem }` in its theme layer |
| Semantic colours via `theme.colors = { surface: 'var(--color-bg-alt)' }` | ✅ `bg-surface`, `text-ink`, `border-surface` all generate |
| Opacity modifier on a `var()`-backed theme colour (`bg-surface/50`) | ✅ `color-mix(in srgb, var(--color-bg-alt) 50%, transparent)` |
| `theme.radius = { container: 'var(--radius-container)' }` → `rounded-container` | ✅ generates |
| **Tailwind v4's `bg-(--color-bg-alt)` shorthand** | ❌ **produces no rule** in presetWind4 66.8.1 |
| Fractional steps (`gap-1.5`, `p-4.5`) | ✅ generate, so the 4px grid has half-steps if ever needed |

Two consequences worth stating plainly:

- **The 4px scale we hand-maintain is the scale the preset already has.** `--space-1..6` and
  `--spacing-xs..lg` reproduce, by hand and under two names, what `--spacing` gives for free. This
  is the whole root cause: two homemade scales and no registered theme, so every author re-derives
  the same numbers and writes them differently.
- **The `bg-(--var)` shorthand recommended by both linked Tailwind skill repos does not apply
  here.** Those repos target Tailwind v4 proper; we run UnoCSS `presetWind4`, which is
  Tailwind-*compatible*, not Tailwind. Its own docs warn that generated theme-variable names need
  not match Tailwind v4. Anything borrowed from a Tailwind guide has to be compile-tested before it
  becomes a rule here — as this one was, and failed.

---

## 3. What the sources actually say

**Evil Martians, ["5 best practices for preventing chaos in Tailwind CSS"](https://evilmartians.com/chronicles/5-best-practices-for-preventing-chaos-in-tailwind-css).**
The article's precondition is the one we fail: a utility engine only pays off on top of a design
system with real tokens, otherwise you end up writing "magic values in the class lists (like
`p-[123px] mb-[11px] gap-[3px]`)". We are the softer version of that failure — our arbitrary values
point at tokens, so they are not magic numbers, but 427 of them are still bypassing the scale the
engine would have enforced.

**[ofershap/tailwind-best-practices](https://github.com/ofershap/tailwind-best-practices) and
[gopherguides `tailwind-best-practices`](https://github.com/gopherguides/gopher-ai/tree/main/plugins/tailwind/skills/tailwind-best-practices).**
Both are Tailwind-v4 skills, and both converge on the same three points that do transfer:

- *"Wrong: px values when scale exists — `p-[16px]`; correct — `p-4`."* Arbitrary values should be
  rare; define tokens in the theme instead. Directly against our current style.
- A **class-ordering convention**: layout → spacing → sizing → typography → colours → effects →
  interactive. We have none, and our long class lists show it.
- **Extract at 3+ repetitions**, and always prefer theme variables over hardcoded values. Our
  `Button`/`Field`/`Card` pattern already matches this; the section surface does not yet.

Their v3→v4 migration tables and `@theme` / `@utility` / `@import "tailwindcss"` advice do **not**
apply — that is Tailwind CSS-first config, and UnoCSS configures through `uno.config.ts`.

**[Skeleton](https://www.skeleton.dev) — Wintry** (`@skeletonlabs/skeleton@5.0.1`, verified from
the published theme file): `--spacing: 0.25rem`, `--radius-base: 0.375rem`,
`--radius-container: 0.75rem`, surface ramp `surface-50 … surface-950` in `oklch`. Skeleton's own
card idiom is `class="card p-4 preset-tonal-surface"` — a *tonal* (tinted) surface, and `card` +
padding, with `preset-outlined-surface-500` as the alternative. Colour pairings like
`surface-50-950` resolve light/dark through CSS `light-dark()`, and `*-contrast-*` supplies the
accessible foreground for a given background. Skeleton does **not** publish a canonical "a settings
section is a tonal card" rule; `filled`/`tonal`/`outlined` are general visual presets.

**[Material 3 — grids & spacing](https://m3.material.io/foundations/layout/grids-spacing/spacing).**
Grouping is either *implicit* (proximity and open space) or *explicit* (outline, divider, shadow).
Explicit grouping is for enclosed, often interactive objects. Plus the ratio rule: internal padding
must be ≤ the margin outside, or adjacent containers merge — which is exactly our 16:16 symptom.

**An independent second opinion** was taken through the ChatGPT gateway (`gpt-5.6-sol-high`) with
the measured facts above. It landed on the same shape — one native 4px scale, semantic theme
colours, tonal surface without shadow or border, 24/16/8/4 rhythm — and it is the source of the
"do not stack tonal + outline + shadow" warning and the dialog-button ordering below. Its claim
that `bg-(--var)` is unproven in UnoCSS was right; the claim was then tested here and is false for
our version, which is why §2 exists.

---

## 4. Recommendation

### 4.1 One scale — the preset's

Delete `--space-1..6` and `--spacing-xs/sm/md/lg` from `tokens.css`. Register nothing to replace
them: `presetWind4` already provides `--spacing: 0.25rem`, and `p-4` / `gap-2` / `mb-6` are the
same 4px grid under names the whole ecosystem already reads. 118 spacing utilities across 34 files
get mechanically shorter and, more to the point, *comparable* — two authors writing 8px now write
the same thing.

Keep `tokens.css` for what it is genuinely for: colour, radius, control height, duration — values
the preset does not know.

### 4.2 Register the semantic colours, keep writing tokens for one-offs

```ts
// uno.config.ts — verified to generate
theme: {
  colors: { surface: "var(--color-bg-alt)", raised: "var(--color-bg-raised)", /* … */ },
  radius: { container: "var(--radius-container)" },
}
```

`bg-surface`, `border-surface`, `rounded-container` then work, including `/50`. A genuinely
one-off variable stays `bg-[var(--…)]` — that is what arbitrary values are for. Note `dark:` is not
part of this: the preset's `dark:` compiles to a `.dark` ancestor selector while our themes swap on
`[data-theme]`, and the token values already flip, so nothing needs a `dark:` variant.

### 4.3 The section contract

| Relationship | Value | Class |
| --- | ---: | --- |
| section → section | 24px | `gap-6` on the panel's flex column |
| field → field inside a section | 16px | `gap-4` |
| label → control | 8px | `gap-2` |
| hint / error → control | 4px | `gap-1` |
| buttons within a row | 8px | `gap-2` |
| section inner padding | 16px | `p-4` |

Three clearly distinct levels — 8 / 16 / 24 — instead of today's 16 / 16. Two structural notes:

- Prefer a flex column with `gap-*` on the container over `mb-*` on each child. A gap cannot be
  forgotten on the last item and cannot collapse; that is what makes the rule enforceable rather
  than advisory.
- **`FormSection` should own the section gap**, for the same reason. It is the component that knows
  it is a section.

### 4.4 Surface: tonal, and only tonal

Give the section `bg-surface rounded-container p-4` — Skeleton's `preset-tonal-surface` idea,
expressed in our tokens — and **no border and no shadow**. Rationale:

- Four bordered-and-shadowed blocks stacked in a 450px popup is the "cage of rectangles" outcome;
  a divider is the last 10%, not the first fix.
- `Card variant="filled"` is the wrong tool here specifically because it adds elevation
  (`--shadow-card`) and a *raised* surface. A static field group is not a raised, interactive object.
- This is also the cheapest path back out: if tonal turns out to be too subtle in the dark theme
  (`--color-bg-alt` `#11233a` sits very close to `--color-bg` `#0b1627`), the fallback is a border
  **instead of**, not in addition to, the fill.

Since a surface is being introduced anyway, decide at the same time whether `Card` becomes the one
section container (with a `tonal` variant) or is deleted as unused, and whether
`#add-urls-panel`/`#unlock-panel` adopt it instead of hand-rolling the same thing inline.

`--radius-container` stays 10px. Wintry's 12px is not a reason to change a value that works; this
is a 450px popup, not Skeleton's marketing site.

### 4.5 Accessibility

The `<fieldset>`/`<legend>` grouping from UX-3 stays exactly as it is. A fill is not an
announcement — visual grouping does not buy back semantic grouping, and this is the one thing a
"make it prettier" change could plausibly break.

On contrast, the applicable criteria and what they actually demand:

- **[1.4.3 Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum)** — text
  ≥ 4.5:1 (large text 3:1). This repo already gates it: `npm run check:contrast`
  (`scripts/check-contrast.mjs`) resolves `var()` chains out of `tokens.css` and checks 11 pairs in
  both themes — it exists because `f20daf0` shipped 1.40:1 control borders unnoticed. Moving section
  content onto `--color-bg-alt` changes which pairs matter, and the gate does **not** yet cover the
  new ones. `--color-text` and `--color-text-secondary` on `--color-bg-alt` are already in `RULES`;
  **add** `--text-muted`, `--color-focus-ring`, `--color-control-border` and
  `--color-checkbox-border` against `--color-bg-alt`. `--text-muted` at 11px is the most likely to
  fail. Extending `RULES` is part of the change, not a follow-up — the gate is what makes the
  surface decision safe to take at all.
- **[1.4.11 Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast)** — 3:1
  for visual information needed to identify a control or its state. A decorative section fill is
  **not** covered: the grouping is already carried by `fieldset`/`legend`, heading and layout. So a
  deliberately subtle tint is fine. What *is* covered: input borders, checkbox states, the focus
  ring — all of which now sit on a different background and need re-checking against it.
- **[2.4.13 Focus Appearance](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance)** — the
  focus ring is `color-mix(…, --color-focus-ring 28%, transparent)` in `Field` and a `ring-2` with
  `ring-offset-[var(--color-bg)]` in `Button`. Both were tuned against `--color-bg`; on a tonal
  surface the button's ring offset paints the *wrong* background behind the ring. That is a concrete
  edit, not just a re-measure.
- **[`forced-colors`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/forced-colors)** — no
  WCAG criterion requires a dedicated block, and `forced-color-adjust: none` must not be set
  globally. But in forced-colors a background tint is dropped, so if the fill is the only visual
  boundary, add `@media (forced-colors: active) { … border: 1px solid CanvasText }`. Worth one pass
  in Windows High Contrast.
- **[`prefers-contrast: more`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-contrast)**
  — an enhancement, not a requirement. A reasonable place to strengthen the boundary later.

`tests/e2e/a11y.spec.ts` must stay green throughout; it is the gate that catches a lost `legend`.

### 4.6 Export / Import, and the import confirmation

Two peers, non-destructive, short labels, 418px of content width — **one row**:
`grid grid-cols-2 gap-2`, both `secondary`. Stacking costs a popup row for nothing.

The `pendingImport` branch above it is *not* the same case and should not get the same treatment.
**Replace settings** is destructive. Convention (Material's dialog guidance, and every desktop
platform) is dismissive left, confirming/destructive right, right-aligned:
`flex justify-end gap-2` → `Cancel` (secondary) then `Replace settings` (destructive). The
destructive action should not be the default Enter action, and Escape should reach Cancel.

This also raises a question worth answering once: `Button` has no destructive variant today, and
`--color-error` is used only for text and borders. Either add one, or accept that "Replace
settings" stays visually identical to a neutral action.

---

## 5. What still has to be decided

1. Tonal fill vs. spacing-only vs. border — §4.4 recommends tonal, but the dark-theme
   `--color-bg-alt` / `--color-bg` separation must be **measured** first, not eyeballed.
2. Removing both homemade spacing scales repo-wide (118 utilities, 34 files) in one pass or per
   feature area. One pass is more reviewable; per-area leaves the codebase mixed for longer.
3. `FormSection` owning the section gap and surface, vs. the caller.
4. `Card`: becomes the section container, or is deleted.
5. Whether a class-ordering convention is adopted and written into
   `agent-os/standards/frontend/unocss-llm-first.md`, which today says nothing about spacing rhythm
   or ordering.
6. Whether `Button` gains a destructive variant (§4.6).
7. Removal plan for the 26 dead class names.

## 6. How any resulting change gets verified

- Storybook `Features/Settings` — light and dark, both tabs, plus the `pendingImport` state.
- `npm run check:contrast` extended with the §4.5 pairs and green in both themes; the measured
  ratios recorded in the card, not summarised as "passes".
- `npm run typecheck && npm run check:svelte && npm run lint && npm test && npm run build`, plus
  `npm run test:e2e:mock` (which carries `a11y.spec.ts`).
- Screenshots before/after at the fixed 450px width — nothing here is responsive.
- CSS bundle size before/after; `p-4` instead of `p-[var(--spacing-md)]` should shrink it, and if it
  does not, something in the theme registration is wrong.

## 7. Related

- `docs/settings-ux-plan.md` — why the form is shaped as it is; UX-3 (field groups), UX-13 (tabs and
  the sticky Save), UX-14 (Backup moved out of the settings flow).
- `agent-os/standards/frontend/unocss-llm-first.md` — explicit utilities, typed static maps, tokens
  for colour. Silent on spacing rhythm, class ordering and surfaces: the gap this card fills.

---

## 8. Outcome

### 8.1 Where measurement overturned §4.4

§4.4 recommended a tonal fill. **Measured, it does not survive contact with this palette**, so the
sections ship with a hairline divider and no fill:

| Pair | light | dark |
| --- | ---: | ---: |
| `--color-bg-alt` vs `--color-bg` (the tint itself) | **1.06:1** | 1.14:1 |
| `--text-muted` on `--color-bg-alt` | **3.98:1** | 6.86 |
| `--color-primary` (link) on `--color-bg-alt` | **4.43:1** | 7.43 |
| `--color-bg-raised` vs `--color-bg-alt` (a rule card nested in a tinted section) | **1.13:1** | 1.11:1 |

A 1.06:1 tint is not a boundary anyone can see, and buying it would have cost two WCAG 1.4.3
failures plus 32px of horizontal space in a 450px popup where 11–13px type is already the norm —
the "small interface" constraint pushes the same way the contrast numbers do. The nested
routing-rule card would also have dissolved into its own section at 1.13:1.

**Shipped instead:** 16px + 1px `--color-border` + 16px between sections, against 16px between
fields inside one. The rule does the boundary work that 24px of empty space would otherwise have
had to do, which is what keeps the popup compact. Measured light 1.29:1 / dark 4.58:1 — a
decorative separator, which WCAG 1.4.11 does not hold to 3:1 because the grouping is carried by
`<fieldset>`/`<legend>`; §4.5 already said so, and that is the exemption being relied on, not a
number being explained away.

### 8.2 What changed

- **One spacing scale.** `--space-1..6` and `--spacing-xs/sm/md/lg` deleted from `tokens.css`;
  119 utilities across 21 files rewritten to the preset's native scale (`p-4`, `gap-2`, `mb-6`).
  `pr-[calc(var(--spacing-sm)+18px)]` became `pr-6.5`. CSS bundle **35588 → 35028 B raw,
  6161 → 5997 B gzip**.
- **`FormSection` owns the section boundary** — `[&:not(:last-child)]:mb-4 pb-4 border-b` plus an
  inner `flex flex-col gap-4`. It is a *bottom* border on all but the last, not a top border on all
  but the first, because a `<legend>` splits its fieldset's top border and leaves a notch.
- **Per-child `mb-*` replaced by container `gap-*`** in Settings: a gap cannot be forgotten on the
  last child, which is what made the rule enforceable rather than advisory.
- **The four styleless `<section class="settings-section">` wrappers are gone**; `FormSection` is
  the section. 22 dead class names removed, the 4 E2E selectors kept.
- **Export / Import** → `grid grid-cols-2 gap-2`. **Import confirmation** → `flex justify-end gap-2`,
  Cancel (secondary) then Replace settings, and a new **`destructive` Button variant**: outlined, not
  filled, because `--color-error` is tuned as a text colour against the page background and no
  contrast-checked on-error foreground exists to fill with. Its label measures 5.83:1 light /
  9.37:1 dark — already gated as "error text".
- **`--text-muted` light `#68788d` → `#5e6c83`.** The old value was **4.207:1** on `--color-bg`,
  under the 4.5 WCAG 1.4.3 asks of body text, and it is real 12px label text (inactive
  segmented-control tabs, non-writable folder entries). `check-contrast.mjs` gained the rule that
  catches it: 24 checks, all green.

### 8.3 Gates

`typecheck`, `check:svelte`, `lint`, 452 unit tests, `build`, `check:contrast` (24/24), and
`test:e2e:mock` (41/41, `a11y.spec.ts` included) all green. Visually verified in Storybook at the
real 450px width, both tabs, light and dark.

### 8.4 Found in passing, deliberately not fixed here

1. **`--color-text-muted` does not exist.** It is referenced in `DownloadItem.svelte` (6×),
   `SpeedShowcase.svelte` and elsewhere; `tokens.css` only defines `--text-muted`. Those colours
   currently fall back to inherited text.
2. **`--color-control-border` is 1.45:1 against `--color-bg` in the light theme**, and `Field`'s
   default border is transparent — so a light-theme textbox is identified only by its white fill at
   1.06:1. `check-contrast.mjs`'s own header says it exists because control borders regressed to
   1.40:1, yet no rule covers this pair. It is a WCAG 1.4.11 question and a palette change, not a
   spacing one.
3. **Dark-theme legends and labels look washed out in captured screenshots** while `getComputedStyle`
   reports the correct `#e8eef7`, and the same capture on stashed pre-change code looks identical —
   so it is not from this work. Likely a colour-profile artifact of the screenshot pipeline rather
   than a real defect, but it deserves one human eyeball in the real popup.
