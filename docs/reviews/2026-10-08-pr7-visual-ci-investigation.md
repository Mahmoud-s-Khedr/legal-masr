# PR #7 visual CI investigation — 2026-10-08

[PR #7](https://github.com/Mahmoud-s-Khedr/legal-masr/pull/7) changed the UI without
refreshing its candidate screenshots. The [failed validation run](https://github.com/Mahmoud-s-Khedr/legal-masr/actions/runs/37815924869)
on `72cf761641cb05b17f95754564da1ab9773aa3f1` reported 68 screenshot mismatches;
keyboard navigation/focus return, validation and all seven Linux native desktop
journeys passed.

Expected, actual and diff images from the failed run were reviewed for all
17 routes in Arabic RTL and English LTR at 1366×768 and 1440×900. The differences
agree with the PR description and source changes:

- Shared screens have a shorter footer linking to About/support instead of
  displaying the developer's contact details on every page.
- Onboarding has revised local-storage guidance and a new-install restore entry.
- Client details offer phone copying; client/case forms suggest internal numbers,
  date fields have example placeholders, and the new-POA form uses the common card
  layout and required-client guidance.
- Case lists add court/next-hearing columns, finance rows use compact labels,
  task badges distinguish states, and the agenda adds hearing-roll printing.
- Backups add save-a-copy/show-in-folder controls and clearer restore wording;
  settings clarify the profile's printed-hearing-roll purpose.

No additional visual regression was found in this capture coverage. The fix
refreshes all 68 PNGs and regenerates their checksums/dimensions with
`pnpm update:visual:canonical` in the existing pinned Playwright 1.63.0 Ubuntu
24.04 container (`sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27`).
The application, fixtures, route coverage, thresholds (`0.2` and `0.001`),
container pin and release approval gate are unchanged. No API, schema or database
changes are included.

The first probe unexpectedly passed all four dashboards: its old `.today-heading`
selector no longer matched the dashboard. The harness now targets
`.dashboard-ledger > .page-header`, asserts exactly one matching header, and
verifies the injected `120px` padding before comparing screenshots. This prevents
an absent selector from silently turning the probe into an ordinary comparison.
Normal captures are unaffected by this probe-only guard.

## Validation

- Local reproduction before refresh: 68 screenshot mismatches, keyboard test
  passed; all 68 actuals were pixel-identical to the failed CI run's actuals.
- `pnpm update:visual:canonical`: 69/69 passed. All 68 regenerated PNGs match
  the reviewed CI actuals pixel-for-pixel.
- `pnpm capture:visual:canonical`, twice with the final harness: 69/69 passed
  on both runs (2.4m and 2.0m), including keyboard navigation/focus return. Two
  earlier comparisons before the probe repair also passed 69/69.
- `pnpm probe:visual:canonical`, after repair: expected exit 1, all four dashboard
  screenshots rejected by image comparison. The header existence and applied-CSS
  assertions passed; differing pixels were about 2%, above the unchanged 0.1% limit.
- `pnpm verify:visual`: verified 68 candidate captures.
- `node --test scripts/verify-visual-manifest.test.mjs`: 9/9 passed, including
  malformed manifests, corrupted PNGs, hash/dimension errors and missing approval.
- `pnpm lint` and `pnpm typecheck`: passed.

- `pnpm format:check` and `git diff --check`: passed.
- `pnpm test`: 428 frontend tests in 48 files and 60 script tests passed. An initial
  startup failed on container-owned Vite cache permissions; ownership was repaired
  only in the isolated checkout's ignored caches before the successful rerun.

The [PR checks](https://github.com/Mahmoud-s-Khedr/legal-masr/pull/7/checks) provide
fresh validation, visual comparison and native Linux desktop results after this
fix is pushed. Work was performed in an isolated worktree on the existing PR
branch; the original `main` checkout was left untouched.

The manifest remains `candidate`. This refresh establishes comparison evidence
for fictional seeded data; release design approval, original-design parity and
physical Windows/macOS validation remain pending. Other beta-readiness risks,
including recovering newer documents after restore (B02), remain outside this fix.
