# Code Review Guide (QuickGet Remote)

Adapted from the keabank AI-code-review prompt for this repo: a **Svelte 5 + TypeScript
Chrome (MV3) extension** (Vite, Biome, Vitest, Playwright). Recommendations, not mandatory fixes.

Always review against [code-standard.instructions.md](./code-standard.instructions.md).

## Review priorities (in order)

1. **Correctness & regressions** — wrong behaviour, broken async, MV3 service-worker lifecycle, race conditions in badge polling / interception.
2. **Security & data exposure** — credential handling (the NAS password is session-stored / encrypted-at-rest), URL/torrent validation, permissions.
3. **Reliability & error handling** — API response parsing, swallowed errors, missing guards.
4. **Standards & dead code** — violations of the code standard, unused exports/options, stale comments that no longer match the code.
5. **Maintainability & readability.**

## Categories

- 💡 **Suggestion** — nice to have
- ⚠️ **Warning** — potential bug / anti-pattern
- 📚 **Learning** — pattern note
- ✅ **Good** — well-written code worth keeping

## Guidelines

1. Be concise — a handful of high-signal items per file, not an exhaustive list.
2. Don't nitpick formatting — that's Biome's job.
3. Don't suggest broad refactors when a small local fix suffices (see core principle #3 — a refactor must *remove* code, not reshuffle).
4. Include `file:line` references.
5. Prefer concrete, actionable wording over generic advice.
6. Acknowledge good code briefly; if a file is clean, say so in one line.
7. Verify the change still passes typecheck / lint / svelte-check / unit tests / build before calling it done.
