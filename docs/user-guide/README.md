# Legal Masr illustrated user guides

The guides describe the current pre-beta desktop application using fictional data.

| Language | Markdown                     | Offline HTML                       | PDF                 |
| -------- | ---------------------------- | ---------------------------------- | ------------------- |
| العربية  | [دليل المستخدم](ar/guide.md) | [الدليل المصور](ar/index.html)     | [PDF](ar/guide.pdf) |
| English  | [User guide](en/guide.md)    | [Illustrated guide](en/index.html) | [PDF](en/guide.pdf) |

Open `index.html` directly from disk. Keep its `assets/` folder alongside it;
sharing the entire `docs/user-guide/` folder preserves both guides, fonts,
images, and language links. Red outlines and numbered badges identify controls
explained immediately below each screenshot. Clicking an HTML screenshot opens
the image at full size. Long screens have successive images with overlapping
context. Unannotated full-viewport captures are retained under
`assets/originals/` for review.

## Regeneration

Prerequisites: the repository's Node/pnpm and Rust dependencies, a working Linux
X11 display, `tauri-driver`, `WebKitWebDriver`, Playwright Chromium,
`pdftotext`, and `pdfinfo`. Optional visual-review galleries also require
`pdftoppm`. The desktop harness must be freshly built after
application changes. It is separate from the normal production binary.

```bash
pnpm build:desktop:e2e
TZ=Africa/Cairo pnpm guide:capture
pnpm guide:build
pnpm guide:verify
```

`guide:capture` creates one disposable, marked temporary vault per language.
It exercises real Tauri commands and SQLCipher persistence, drives forms and
navigation, captures the screen inventory, and removes its temporary vaults on
completion. The file picker is the existing test-only allowlisted substitute;
physical OS dialogs are a separate validation requirement. Only sanitized
scenario outcomes and fictional/redacted screenshots are retained. Passwords
and recovery keys never appear in output artifacts.

Markdown is the editable explanation source after the initial generation.
`guide:build` preserves existing `guide.md` files and regenerates their HTML and
PDF, as well as annotated PNGs from the capture metadata. To recreate Markdown
from the bilingual screen catalog after changing screenshots or callouts, use:

```bash
pnpm guide:build -- --refresh-content
```

That explicit refresh replaces the Markdown files. Edit the bilingual catalog
in `scripts/guide-content.mjs` before refreshing to retain instruction changes.
Do not refresh over intentional Markdown edits without incorporating them into
the catalog. Run `guide:verify` after either workflow.

The publisher refuses an incomplete bilingual inventory, a failed native
scenario, duplicate/unsafe filenames, mixed-language captures, or out-of-frame
callouts. The verifier checks PNG dimensions/hashes, all local links, screen and
image counts, responsive HTML, absence of HTTP requests, PDF headers/page counts,
and selectable PDF text. Cairo fonts are copied locally and embedded in PDFs.

To regenerate contact sheets for reviewing every annotated image and PDF page:

```bash
node scripts/review-user-guide.mjs
```

The review images are written under `test-results/user-guide-review/`.

## Evidence and limits

See [validation report](validation-report.md), [screen and test coverage](traceability.md), [capture manifest](capture-manifest.json),
and [artifact checks](artifact-validation.json). The manifest records source
revision, included working-tree changes, desktop binary checksum, screen IDs,
viewport dimensions, original/annotated hashes, callout coordinates, and native
outcomes. Its render checks establish that screens were reached; functional
scenarios establish the operations they explicitly assert. Neither is a claim
that every possible user path was exercised.

The existing visual regression baseline is independent and remains a candidate.
Guide generation does not approve or replace it. Windows/macOS installers,
permissions, native pickers, notifications, autostart, and sleep/resume require
physical-device validation. Cross-device restore remains blocked by the current
backup-key design. These guides do not introduce new product functionality.
