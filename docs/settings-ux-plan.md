# Plan: settings form — validation, grouping, a11y

Status: **plan, not implemented**. Written after reviewing Settings in Storybook
(`Features/Settings`) and measuring what's currently in the form.

## What was measured, not assumed

| Metric | Value |
| --- | --- |
| Popup CSS | 33.7 KB, **6.5 KB gzip** |
| `<fieldset>` / `<legend>` across the whole popup | **0** |
| `aria-describedby` / `aria-invalid` / `aria-errormessage` | **0** |
| `aria-live` | 0 in the form (status pill is rendered imperatively) |
| Error support in `Field.svelte` | **none** — only `id`, `label`, `value`, `size` |

The conclusions below follow from this. The key one: the form's problem
**is not the styling engine**.

## On utility CSS (Tailwind and alternatives)

The request was "a recognized Tailwind alternative for Svelte, with almost no growth in size."

There's exactly one recognized alternative — **UnoCSS**: an on-demand atomic engine, native for
Vite, with a Tailwind-compatible preset, that consistently produces less CSS than Tailwind and
builds several times faster ([2026 comparison](https://www.pkgpulse.com/guides/tailwind-v4-vs-unocss-vs-pandacss-2026),
[UnoCSS vs Tailwind](https://toolchew.com/en/tailwind-vs-uno/)). PandaCSS is zero-runtime, but
heavier to configure and geared toward React. For a Svelte stack, UnoCSS is the right choice
[if a utility layer is needed at all](https://www.pkgpulse.com/guides/tailwind-vs-unocss-2026).

**Recommendation: don't introduce either.** Reasoning:

1. **There's nothing to save.** 6.5 KB gzip for the whole popup — a utility engine won't improve
   that, and it would add its own preprocessing step to the extension's build from day one.
2. **Tokens already exist.** `--space-*`, `--color-*`, `--control-height-*`, light and dark themes.
   Utilities would give a second way to express the same thing — divergence, not order.
3. **The listed pain points aren't fixed by utilities.** Validation, message highlighting, field
   groups, a11y — this is markup semantics and component state. `class="border-red-500"` adds
   neither `aria-invalid` nor a link between the error and the field.
4. **The cost is high.** Rewriting the scoped styles of every component in the popup is weeks of
   changes with regression risk, in an extension that is currently being fixed at the core.

If a utility layer is ever needed (say, with noticeable UI growth), the right moment is a
separate task, and then it should be UnoCSS specifically, with `presetWrapper`, coexisting with
the tokens rather than replacing them.

## The form's real problems

### 1. The error isn't tied to the field

Any validation error is shown as a single global status pill: *"Fill in Server address,
Temp Folder before saving"*. The field itself isn't marked in any way. A screen reader doesn't
learn about the problem at all — there's neither `aria-invalid` nor `aria-describedby`. The user
has to visually match the message text to the fields.

### 2. Validation only happens on Save

The form checks nothing until Save is pressed, and then checks everything at once. An empty
Temp Folder is exactly the kind of case that went unnoticed for years.

### 3. Sections are `<h2>`, not groups

`Connection`, `Download defaults`, `Routing rules`, `Backup` are marked up with a heading and a
`<div>`. For a screen reader these aren't groups: there's no way to jump "to the next field
group," and no link between the heading and its fields. `<fieldset>`/`<legend>` is used nowhere.

### 4. Routing rules are the weakest spot

Each rule is a row of three controls plus a delete button, with no group of its own and no name.
In a list of three rules, a screen reader reads six unnamed fields in a row. Deletion announces
nothing.

### 5. Status is announced incorrectly

The status pill is inserted imperatively, without `aria-live`. The messages "Settings saved" and
error messages aren't announced. Visually it's the only feedback point for the whole form,
regardless of where the error occurred.

### 6. `Field` doesn't support states

No error, no hint, no `required` in the markup. Everything above follows from this: the
component physically can't show what isn't in it.

## Plan

The order is such that each step is self-contained and can be verified in Storybook before
moving to the next.

### Step 1. `Field` gets states

Add `error?: string`, `hint?: string`, `required?: boolean`. The component itself:

- renders `<span id="{id}-error" role="alert">` and `<span id="{id}-hint">`;
- sets `aria-invalid={!!error}` and `aria-describedby` on the existing elements;
- colors the border with the `--color-error` token, **in addition to** the text, not replacing
  it — color can't be the sole carrier of meaning (WCAG 1.4.1).

Cost: one component, ~40 lines. All existing call sites keep working.

### Step 2. Field groups

Introduce `FormSection.svelte` built on `<fieldset>` + `<legend>`, replacing
`<h2 class="section-heading">`. Reset fieldset's default styles. Nothing changes visually,
everything changes for navigation.

### Step 3. Validation at a moment when it's useful

- validate the field on `blur`, not only on Save;
- Save additionally moves focus to the first field with an error;
- required fields are taken from `findConfigProblem()` — the source is already single, a second
  list must not be created.

### Step 4. Live status

Move the status pill into a container with `aria-live="polite"` (errors — `assertive`). After
that, the "saved" message is announced automatically, with no changes at call sites.

### Step 5. A routing rule as a named group

Each rule becomes a `<fieldset>` with `<legend class="visually-hidden">Rule 1</legend>`; the
delete button gets `aria-label="Remove rule 1"`. After deletion — a message in the live region.

### Step 6. Verification

- Storybook: stories with field errors and with focus on the first error;
- run `axe` against the stories (`@storybook/addon-a11y` — the only new dependency, dev only);
- a keyboard-only pass through the form as acceptance.

## What's deliberately not in the plan

- **Bits UI / Melt UI.** Recognized headless primitives for Svelte 5 with built-in a11y
  ([Bits UI](https://github.com/huntabyte/bits-ui), [Melt UI](https://github.com/melt-ui/melt-ui)),
  but useful where there are complex widgets — combobox, dialog, menu. There are none of those
  in the settings form: it's inputs, checkboxes, one `<select>`, and a segmented control. Taking
  on a library for those would be introducing a dependency the size of the problem it solves.
  Worth revisiting if a proper autocomplete for NAS folders shows up.
- **Replacing the styling engine.** Reasoning above.
- **Redesign of the Connection section** ("log in once, then only Logout"). Discussed
  separately, together with the fate of the master password — that's a change of state model,
  not a form finish.
