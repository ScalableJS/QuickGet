---
name: release
description: End-to-end production release workflow for QuickGet Remote — prepares bilingual release notes (Russian review in chat, English for Git/GitHub/Store), synchronizes and cleans Kanban boards and roadmap, bumps versions across all manifests, enforces pre-flight quality gates, promotes via PR from env/dev to env/prod, merges, and monitors deployment to Chrome Web Store. Use when asked to "релиз", "выкати на прод", "залей на прод", "деплой", "deploy", "release to prod", "publish", "ship".
---

# QuickGet Remote Production Release Workflow

This skill governs the entire end-to-end release lifecycle for QuickGet Remote, taking tested features and bugfixes on `env/dev`, updating project boards, bumping versions, opening a pull request to `env/prod`, and monitoring deployment to the Chrome Web Store.

---

## Core Rules & Constraints

1. **Branching model**:
   - `env/dev` is the direct working branch.
   - `env/prod` is protected — **NEVER push directly to `env/prod`**. Releases MUST go through a Pull Request from `env/dev` into `env/prod`.
2. **Language policy**:
   - **Russian in chat**: When reporting to the developer in the conversation, provide a concise, structured Russian overview of what changed, what was fixed, and the proposed version.
   - **Strictly English for all artifacts**: All Git commit messages, Pull Request titles and bodies, GitHub Release notes, and Chrome Web Store "What's new" descriptions must be written in English.
3. **Secrets hygiene**:
   - Never print, log, or commit credentials. Web Store tokens and secrets are handled purely by GitHub Actions via GitHub Secrets.
4. **Code cleanliness**:
   - No `console.*` in popup/UI/Svelte code (enforced by Biome `noConsole`).
   - Pre-push quality gates must be 100% green before any release PR is opened.

---

## 7-Step Release Procedure

### Step 1: Pre-flight Quality Gates
Ensure the local working tree is clean and on `env/dev`, then run the full verification suite:

```bash
git checkout env/dev
git pull origin env/dev
npm run typecheck && npm run check:svelte && npm run lint && npm test && npm run build
```

If any check fails, **stop immediately** and resolve the issues on `env/dev` before continuing.

---

### Step 2: SemVer Analysis & Multi-Manifest Version Bump
Inspect the commits since the last Git release tag to determine the SemVer increment:

```bash
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "v2.0.0")
git log "${LAST_TAG}..HEAD" --oneline
```

Choose the bump level:
- **Patch** (`x.x.+1`): Bug fixes, telemetry adjustments, styling/accessibility tweaks, refactoring.
- **Minor** (`x.+1.0`): New user-facing features, new options/settings, significant capabilities (e.g. magnet interception, task priority queue, speed throttle).
- **Major** (`+1.0.0`): Breaking architecture or manifest platform changes.

Synchronize the new version across **all 4 manifest/package locations**:
1. `package.json` — `"version": "X.Y.Z"`
2. `package-lock.json` — top-level `"version": "X.Y.Z"` and `packages[""].version`
3. `manifest.json` (Chrome MV3) — `"version": "X.Y.Z"`
4. `manifest.firefox.json` (Firefox) — `"version": "X.Y.Z"`

Rebuild local bundles with the updated version:
```bash
npm run build:dev && npm run build
```

---

### Step 3: Kanban & Roadmap Synchronization
Actively audit and update the project tracking documents before releasing:

1. **`agent-os/product/bugs-kanban.md`**:
   - Locate resolved defect cards (`BUG-xx`).
   - Move their status from `In Progress` / `In Review` to `Done`.
   - Append a resolution stamp under the card:
     ```markdown
     **Resolved YYYY-MM-DD** — shipped in vX.Y.Z: <brief description of fix>
     ```
   - Ensure the summary table at the top of the file reflects the updated status.
2. **`agent-os/product/settings-ux-kanban.md`**:
   - If settings or UI controls were touched, update relevant `UX-xx` cards to `Done`.
3. **`agent-os/product/roadmap.md`**:
   - Move completed features or phase objectives (`GAP-xx`) to the "Shipped" section with `(shipped in vX.Y.Z)`.

---

### Step 4: Bilingual Review Preparation

#### A. Russian Review (In Chat)
Formulate a clear, structured overview in the chat response for the user:
- Release version and type (e.g. `v2.2.1 (Patch)`).
- Summary of new features and key improvements.
- List of fixed bugs with ticket numbers (`BUG-xx`).
- UI/UX refinements.

#### B. English Release Notes (For GitHub & Store)
Prepare formatted English markdown notes covering:
- Title: `Release vX.Y.Z: <Concise headline>`
- Section 1: `### New Features` (with user benefit explanation)
- Section 2: `### Bug Fixes & Improvements` (referencing `BUG-xx` / `GAP-xx`)
- Section 3: `### UI & Accessibility`
- Section 4: `Full Changelog: https://github.com/ScalableJS/QuickGet/compare/vPREV...vX.Y.Z`

---

### Step 5: Promotion via Pull Request (`env/dev` -> `env/prod`)
Follow the repository branch protection protocol:

1. Commit version bumps, manifests, and documentation updates to `env/dev`:
   ```bash
   git add package.json package-lock.json manifest.json manifest.firefox.json agent-os/
   git commit -m "chore(release): bump version to X.Y.Z"
   git push origin env/dev
   ```

2. Create the Pull Request targeting `env/prod`:
   ```bash
   gh pr create --base env/prod --head env/dev      --title "Release vX.Y.Z: <English Headline>"      --body "<English Release Notes>"
   ```

3. Wait for PR CI checks to pass:
   ```bash
   gh pr checks
   ```

4. Merge the Pull Request into `env/prod`:
   ```bash
   gh pr merge --merge
   ```

---

### Step 6: Deploy & Store Verification
The merge push to `env/prod` triggers the GitHub Actions workflow `.github/workflows/deploy.yml`:

1. Monitor the deployment workflow:
   ```bash
   gh run list --workflow=deploy.yml -L 1
   gh run watch <run-id>
   ```

2. Verify that `deploy.yml` completes successfully:
   - Built production zip: `quickget-remote-X.Y.Z.zip`.
   - Uploaded to Chrome Web Store API (confirm response status `PENDING_REVIEW` or published).
   - Created Git tag `vX.Y.Z` and GitHub Release.

3. Update the GitHub Release description with the full formatted English notes:
   ```bash
   gh release edit "vX.Y.Z" --notes "<Formatted English Release Notes>"
   ```

---

### Step 7: Post-Release Hygiene & Final Report
1. Switch back to `env/dev` and ensure it is cleanly synced:
   ```bash
   git checkout env/dev
   git pull origin env/dev
   git status
   ```

2. Report the completed release to the user in chat:
   - Provide direct clickable links to:
     - **GitHub Release**: `https://github.com/ScalableJS/QuickGet/releases/tag/vX.Y.Z`
     - **Merged PR**: `https://github.com/ScalableJS/QuickGet/pull/<PR-number>`
     - **Chrome Web Store Status**: `PENDING_REVIEW` (review usually completes within 24-48 hours)
   - Present the updated state of the Kanban board and next steps from the roadmap.
