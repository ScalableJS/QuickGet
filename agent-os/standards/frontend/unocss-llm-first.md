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
