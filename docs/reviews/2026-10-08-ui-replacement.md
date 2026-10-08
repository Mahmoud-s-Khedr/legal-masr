# UI replacement evidence (2026-10-08)

## Provenance and versions

- shadcn CLI 4.21.4, official `@shadcn` registry only, style `base-nova`, base `base`, RTL, Tabler icons.
- `shadcn info --json` reports Base UI, Tailwind v4, alias `@` and paths resolving into `src`.
- @base-ui/react 1.8.0, react-day-picker 10.0.2, react-hook-form 7.83.0, zod 4.4.3,
  @hookform/resolvers ^5.5.7, @tanstack/react-table ^8.21.3, tailwindcss ^4.3.3.
- Application compositions (FormDialog, EntityPicker, EntityMultiPicker, CreatableCombobox,
  DatePicker, TimeField, AmountInput, DraftForm, RecordTable) live in `src/components/forms`.
  The old wrappers (Dialog, Field, Switch, Tabs, DatePicker) are removed; no `asChild` remains.

## Case-client editing

`case_set_clients` (Rust command, typed bridge, query mutation) reuses the transactional
`case_update` relationship logic, updates search indexing in the same transaction, and returns
`CASE_CLIENT_HAS_PAYMENTS` when removing a client referenced by payments. No migration was added.

## Validation (Linux, 2026-10-08)

| Check                                                   | Result                                |
| ------------------------------------------------------- | ------------------------------------- |
| `pnpm format:check`, `lint`, `typecheck`                | pass                                  |
| `pnpm vitest run`                                       | 31 files, 249 tests pass              |
| `node --test scripts/*.test.mjs`                        | 48 pass                               |
| `pnpm build`                                            | pass (existing >500 kB chunk warning) |
| `cargo fmt --check`, `clippy -D warnings`, `cargo test` | pass                                  |

Screenshots (synthetic fixtures, Arabic and English, 1440×900 and 1366×768, plus calendar open,
dark theme, relationship editor, POA create, chips) are in
`evidence/2026-10-08/ui-replacement/`. `interactions/checks.json` records keyboard ID selection,
phone search, inline-create name prefill, cancel preserving the parent draft, search Escape and
mobile drawer Escape for both locales.

## Legacy style cleanup

- 185 unused selectors removed from `src/styles/styles.css` (4378 to about 3500 lines), found by
  checking every class against `src`, `scripts` and tests; dynamic `tone-*` classes were kept.
- `.dialog-form` and `.dialog-actions` are gone: dialogs use utility classes and the new
  `FormDialogFooter` (sticky footer) from `src/components/forms/FormDialog.tsx`.
- The two `@theme inline` blocks are merged into one. Calendar styling lives only in
  `src/components/ui/calendar.tsx`; the remaining `.calendar-*` rules belong to the agenda month grid.
- Re-captured all 28 screens after the cleanup: 24 are byte-identical, the 4 calendar captures
  differ only by trigger focus state. Add-payment dialog spot-checked with the sticky footer.

## Desktop (Linux, tauri-driver)

`pnpm build:desktop:e2e` then `pnpm test:desktop`: all 5 scenarios pass. Two restore scenarios first
failed because `scripts/desktop-e2e.mjs` waited for the removed `.error` class; migrated alerts use
`role="alert"`, so the selector was updated (the user-guide capture script had the same stale selector).
A Windows/macOS checklist was added to `docs/device-validation-template.md`; those checks are pending.

## Visual baselines

68 baselines regenerated; `pnpm verify:visual` passes and a plain comparison run (69 tests) passes against them.

## Not verified / unchanged

- Windows and macOS desktop behaviour was not checked (Linux host only).
- Visual baselines were regenerated locally on Fedora 44 (Playwright 1.63.0 Chromium), at the user's
  direction, not in the pinned Ubuntu 24.04 container. The manifest stays `candidate` and records the
  local environment, so the canonical Docker comparison may differ slightly until baselines are
  regenerated with `pnpm update:visual:canonical`. A `new-poa` route was added (68 captures); the
  manifest verifier now derives its expected count from the matrix.
- This work does not close unrelated security, backup, packaging or release blockers.
