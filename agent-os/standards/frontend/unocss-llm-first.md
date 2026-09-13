# UnoCSS — LLM-First Standard

Use UnoCSS with `@unocss/preset-wind4` for popup UI styling.

## Rules

- **Explicit Tailwind-compatible utility classes**: Styling must be understandable directly from the Svelte markup without having to look up external CSS declarations.
- **No Attributify**: Always use standard `class="..."` attributes.
- **No component CSS classes**: Avoid introducing `.my-component-btn` classes for ordinary layout and presentation.
- **No runtime/dynamic class string interpolation**: Do NOT write dynamic template literals (such as `` `bg-${color}-500` ``) for utility names. Build-time extraction cannot find these classes reliably.
- **Typed static class maps**: For conditional variants (e.g. `variant`, `tone`, `size`, `status`), use typed static maps:
  ```ts
  const toneClasses = {
    hint: "text-[var(--color-text-secondary)]",
    error: "text-[var(--color-error)]",
    warning: "text-[var(--color-warning)]",
  } satisfies Record<Tone, string>;
  ```
- **CSS custom properties for theme colors**: Colors and semantic design tokens live in `src/popup/styles/tokens.css` and are driven by `[data-theme="light|dark"]`. Reference them explicitly as:
  `bg-[var(--color-bg)]`, `text-[var(--color-text)]`, `border-[var(--color-border)]`, etc.
- **Minimal global base styles**: Global resets, scrollbars, and browser pseudo-elements belong in `src/popup/styles/base.css`.
- **Avoid shortcuts**: Do not create UnoCSS shortcuts for ordinary components.

## Spacing, rhythm and section boundaries (UX-26)

- **One scale, and it is the preset's.** `presetWind4` defines `--spacing: 0.25rem` and builds
  `p-4` / `gap-2` / `mb-6` from it. Write those. Do **not** add a spacing scale to `tokens.css`;
  two homemade ones (`--space-*` and a `--spacing-*` alias set) is exactly what was removed, after
  both were used interchangeably in the same file. `tokens.css` holds what the preset does not
  know: colour, radius, control height, duration.
- **Arbitrary spacing values are a smell.** `p-[16px]` and `p-[var(--spacing-md)]` are both `p-4`.
  Fractional steps exist (`gap-1.5`, `pr-6.5`) when a real measurement lands off the grid.
- **Tailwind v4 syntax is not automatically ours.** `presetWind4` is Tailwind-*compatible*, not
  Tailwind: `bg-(--token)` compiles to nothing here. Compile-test anything borrowed from a Tailwind
  guide before it becomes a rule — generate it with the repo's own UnoCSS and read the output.
- **The rhythm** is 16px between fields in a section, 8px label→control, 4px control→hint/error,
  8px between buttons in a row, and 16px + 1px `--color-border` + 16px between sections. Three
  distinct levels; a section boundary that equals the field gap is not a boundary.
- **Prefer a container `gap-*` over a `mb-*` on each child.** A gap cannot be forgotten on the last
  item, which is what makes the rhythm enforceable rather than advisory.
- **`FormSection` is the section.** It owns the `<fieldset>`/`<legend>` grouping *and* the boundary;
  callers do not add their own. The divider is a bottom border on all but the last section — a
  `<legend>` splits its fieldset's *top* border and leaves a notch.
- **Reach for spacing before a surface.** A tinted section was measured and rejected:
  `--color-bg-alt` on `--color-bg` is 1.06:1 in the light theme, it dropped two foregrounds below
  WCAG 1.4.3, and its padding costs 32px of a 450px popup. If a future surface is proposed, measure
  first — see `docs/design-system-spacing-research.md`.
- **A new or changed colour token means a new rule in `scripts/check-contrast.mjs`.** It is the only
  thing standing between the palette and a silent regression; it has caught one already.
