# Visual baseline review

`baseline/` is tracked review material. Its manifest remains `candidate` until
explicit user approval. Comparison success proves repeatability, not design
approval. Release validation requires `status: approved`.

**Known quality concern — 2026-10-05:** the user reported that many images may
be broken or outdated. Only representative images have been visually inspected,
so the extent is not yet established. Observed issues include Arabic content in
English workflow pages and awkward contact-card wrapping. The candidate was
presented for approval before a full visual audit. Treat these images as
diagnostic review material, not an accepted design reference. Fixes are deferred;
keep the manifest unapproved until all 64 images are audited, defects are
addressed and the user explicitly approves the resulting candidate. See
[the visual follow-up](../../docs/test-hardening-handoff-2026-10-05.md#h1--first-visual-baseline-approval).

Use `pnpm update:visual:canonical` with Docker to propose
changes. Never run it in CI. The command makes all 64 assertions and then writes
PNG dimensions and SHA-256 hashes to a candidate manifest. Review the entire
matrix and record the approver, date, commit and design-reference limitations
before changing status to approved. Do not accept a baseline using a copied
manifest from another build.

`pnpm verify:visual` checks integrity; `pnpm capture:visual:canonical` compares without
updates. `pnpm probe:visual:canonical` intentionally
changes spacing and must fail. Actuals/diffs/traces live in ignored
`test-results/visual/`; the ignored HTML report is `playwright-report/`.

The expected matrix is 16 routes × Arabic/English × 1366×768/1440×900. Browser
clock: 2026-10-03T09:00:00Z; timezone: Africa/Cairo; light theme; animations and
caret disabled; fonts and route content loaded. PNGs are full-page, so their
height can exceed the viewport. Width must match it exactly.

Open [the offline review gallery](review.html) to inspect all 64 candidates. Original
Stitch reference assets are absent, so their pixel/design parity is unverified.
