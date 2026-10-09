---
type: handoff
status: active
area: project
updated: 2026-10-09
---

# Current handoff

The working branch is `env/dev`; production releases use a PR into `env/prod`.
The product version is 2.6.0. [[docs/system/overview|The current overview]] owns shipped behavior;
[task files](../../tasks/README.md) own work status and historical evidence.

The new English knowledge base has a feature registry, explicit review snapshots, independent
source classification, language guard, and CI documentation checks. Read
[[docs/system/documentation|the maintenance workflow]] before changing an owning source.

## Next work

- [BUG-71](../../tasks/BUG-71.md): compare send feedback across real user paths. Popup success
  feedback exists in current code; the original missing-success assertion is historical.
- [ENG-9](../../tasks/ENG-9.md) and [ENG-10](../../tasks/ENG-10.md): existing proven cleanup
  candidates. Documentation coverage does not require speculative functionality removal.
- [ENG-13](../../tasks/ENG-13.md): decide whether batch URL destinations should evaluate rules per line.
- [ENG-14](../../tasks/ENG-14.md): define Firefox runtime evidence separately from packaging.
- [BUG-70](../../tasks/BUG-70.md): wait for a real recurrence and captured causal sequence.
  No persistent dedupe, history sweep, or guessed restart mitigation is authorized.

[[docs/system/feature-review|The feature review]] is the evidence map for these decisions.
A documentation audit does not publish a release or certify a new real-NAS spot check.
