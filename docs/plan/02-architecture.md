# Architecture

Part of the LegalMaster Solo plan — see [../plan.md](../plan.md).

## Implemented architecture

```text
React Arabic RTL UI
        │ typed Tauri invoke contracts
        ▼
Rust commands → domain services → repositories/infrastructure
        │                         │
        ▼                         ▼
SQLCipher/SQLite              managed attachment directory
```

The frontend is React, TypeScript, React Router, TanStack Query, React Hook
Form, Zod, i18next, and local component state. It has no SQLite client and
does not receive arbitrary filesystem, shell, process, or HTTP access.

Rust owns SQLCipher access (`rusqlite` with bundled SQLCipher), validation,
transactions, file-copy compensation, backup/restore, native opener use, and
search indexing. A Tauri command only deserializes typed input, checks that
the vault is unlocked, calls a service, and returns a stable DTO/error. There
is no SQL in `src-tauri/src/commands/`.

The application has no Node backend, local HTTP server, cloud database,
general HTTP client, Docker service, Redis, OCR runtime, embedded LLM, or
browser-accessible database.

## Implemented command surface

Commands are grouped by domain rather than exposing table or filesystem
operations:

- vault: status, initialize, unlock, lock, password change, and recovery;
- client, case, opponent, and power-of-attorney create/read/list/update/archive
  operations;
- hearing create/update/list, decision recording with optional linked next
  hearing, and removal;
- task create/update/list, complete/reopen, and removal;
- attachment source selection, managed-copy add/list/update/open/reveal/remove;
- fee-agreement save, payment/expense save/list, and case/client summaries;
- dashboard, normalized global search, and index rebuilding;
- manual backup creation, token-based selection/preparation/commit/cancellation,
  latest-successful summary, save-copy/reveal and profile/settings operations.

The typed bridge is implemented in `src/bridge/types.ts` and
`src/bridge/commands.ts`. Query invalidation is centralized in
`src/lib/queryInvalidation.ts`; it invalidates only the affected canonical
views after writes.

## Data and security boundary

Every opened database connection enables foreign keys. Schema changes require new immutable numbered migrations; migration `0001`
remains the canonical domain baseline. Legal dates remain `YYYY-MM-DD` text values; EGP amounts are integer
minor units. Multi-record writes use a database transaction. Managed-copy
attachment operations add compensating cleanup for a failed copy or deletion.

The vault uses a random database master key wrapped separately with
Argon2id-derived password material and a recovery-key envelope. See
[05-security.md](05-security.md). Backups derive a separate encryption key
from that master key; see [07-backup-format.md](07-backup-format.md).

Vault commands share an exclusive operation gate. Native pickers and heavy archive
work run on worker threads. Session generations and selection requests reject stale
results after lock, cancellation or replacement; the renderer also rejects late IPC
results at session boundaries. Paths, staged keys and prepared snapshots stay native.

## Native capabilities and logging

The main capability grants core window behavior and window-state persistence.
The Rust application also uses narrow dialog, opener, and single-instance
plugins.
No shell, HTTP, filesystem, or SQL plugin permission is granted to React.

Logs are local and daily-rotated. Production entries contain application
version, OS family, stable error code, and allow-listed safe diagnostic facts
only. They must never contain record content, names, identifiers, document
paths, passwords, keys, or raw SQLite messages.

## UI and accessibility conventions

The shell is Arabic RTL by default with a right-side navigation rail and a
72px top bar. Identifiers, dates, amounts, phones, filenames, and versions
are rendered with `<bdi>` where mixed direction needs isolation. Shared
dialogs, confirmation dialogs, tabs, menus, comboboxes, and checkboxes have
visible focus, Escape behavior, and focus containment/return.

Visual comparison against the approved Stitch screens still requires fresh
seeded captures at the two specified desktop viewports; it is not inferred
from source code or old baseline images.

## Tray lifecycle status — 2026-10-22

`tray.rs` owns native menus, visibility and the shared close/Quit/ExitRequested
path. Shutdown takes the existing `AppState::operation()` admission gate used
with `vault_operation.rs` setup/restore/deletion journals, refuses busy work and
closes further admission before exiting. It introduces no second coordinator.
Settings use the existing repository/service/command/typed bridge chain;
migration `0006` extends the singleton settings row. The runtime keeps only the
tray preference and menu language after lock. Startup uses OFF/Arabic until the
first unlock loads encrypted settings. Window-state persistence excludes
visibility so a previous tray Quit cannot strand the next launch hidden.

The Tauri `tray-icon` feature is enabled only for Windows/Linux. Linux uses
existing transitive `gio` 0.18 and `libloading` 0.7 packages directly to query the
local session bus for a registered StatusNotifier host and preflight the
indicator library. No package versions or remote services are introduced.
These are narrow native uses: gtk-rs GIO and libloading use MIT-compatible
licenses and were already in the lockfile; added binary impact is not measured.
The two-second native host monitor restores visibility and disables tray use
on host loss; a restart is required after enabling/re-enabling desktop support.
The UI polls only the native boolean capability every five seconds. This adds
local IPC, no network access. Native `vault-locked` events share renderer cache
clearing and IPC epoch invalidation; the main capability adds only event
listen/unlisten permissions. Device behavior remains unverified.
