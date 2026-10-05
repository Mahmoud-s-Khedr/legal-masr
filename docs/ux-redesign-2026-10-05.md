# UX redesign — 2026-10-05

Scope: Arabic-first UI and UX pass over every screen for the solo Egyptian lawyer, following [the 2026-09-06 UX review](ux-review-2026-09-06.md). No schema change and no new migration. One backend change is a read-only list filter. No cloud service, telemetry or new logging was added.

## Method

The app was rendered in capture mode with the fictional fixture bridge at 1366×768. Every route was inspected in Arabic, and the narrow layout, English/LTR and record states were spot-checked. Findings came from those screenshots and from reading the source. The remaining risks section lists what this pass could not verify.

## Root causes fixed in the visual foundation

| Problem seen on screen                                                                           | Cause                                                                        | Fix                                                                                           |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| "إضافة" button stacked its icon, label and chevron vertically; icons broke onto their own line   | Tailwind preflight makes `svg` `display:block` beside unflexed legacy markup | Icons inline by default; the create button gets explicit flex styling                         |
| Page titles thin on some screens and bold on others; three different header designs              | Preflight removes heading weight; pages used three header patterns           | One `PageHeader`; headings weighted globally                                                  |
| Agenda month shown as «ربيع الآخر ١٤٤٨ هـ»                                                       | `arSA` locale (Saudi, Hijri) used for presentation                           | `ar-EG` Gregorian presentation helpers (`src/lib/format.ts`)                                  |
| Western and Arabic-Indic digits mixed on one screen                                              | Default `ar-EG` digits next to typed identifiers                             | Western digits everywhere (`-u-nu-latn`), matching typed case numbers and phones              |
| Arabic letters spaced apart in kickers and headings                                              | `letter-spacing`/uppercase meant for Latin                                   | Disabled for RTL                                                                              |
| Text at 0.64–0.72rem                                                                             | Ad hoc sizes                                                                 | 0.78rem minimum for secondary text                                                            |
| Save bar floating over the middle of long forms; a primary cause of the "broken" baseline images | Sticky actions in single-column forms                                        | Two-column grouped forms with static actions                                                  |
| Two tab designs, and arrow keys changed selection without moving focus (UX-18)                   | Custom key handling over Base UI                                             | One `Tabs` component (segmented or underline) using Base UI focus management, mirrored in RTL |

## Screen changes

- **Shell:** navigation grouped as العمل اليومي / الملفات / المكتب. The search field shows the Ctrl K hint. The duplicate search and lock buttons are hidden on desktop.
- **Today:** full Arabic date; counts that link to their views; hearings ordered by time, with case, client, court and preparation note; tasks completable in place; an overdue section with "متأخرة 4 أيام" that appears only when something is overdue; upcoming hearings by readable date ("بعد 7 أيام"). Loading and failure states are distinct, with a retry action (UX-04, UX-09).
- **Forms:** case and client forms are grouped into sections with required marks and visible field errors (UX-10). The case form has a searchable client picker with internal numbers and an "add client" path when none exist. Opening a new case from a client file preselects that client. Saving opens the new record (UX-13). Date fields accept 3/10/2026 and Arabic-Indic digits.
- **Case identity (UX-05):** "رقم الملف الداخلي" and "رقم الدعوى بالمحكمة" are separate and labeled. Court references read «رقم 447 لسنة 2026». The client table's mislabeled "النوع" column now reads "الرقم الداخلي". The status filter offers only the canonical statuses (UX-08). Litigation degrees are shown in Arabic (UX-15).
- **Case file:** labeled facts; the next hearing with decision and edit actions; the latest decision; a fee snapshot. Hearings show a timeline with localized status instead of raw `SCHEDULED`. Tasks are completable in place. The fee agreement is prefilled, validated and confirmed (UX-22). Payments and expenses appear as ledger rows.
- **Client file:** POAs are found by client ID through a new optional `clientId` filter on the POA list, so two clients with the same name no longer see each other's POAs (UX-07, Rust test added).
- **POA file:** linked cases are shown by case number and status.
- **Agenda:** "today" shortcut; a day panel with full date and case context; delete demoted to a quiet text action; readable day names for screen readers; hearing case choices include client names.
- **Tasks:** one checkbox per row (a duplicate decorative circle was removed); case/client context; toned status; per-view empty states; completion failures are visible outside dialogs (UX-12); `?view=` deep links.
- **Finances:** totals for displayed records; the case account when filtered by case; new entries inherit the filtered case (UX-22). Amounts accept `١٢٣٫٤٥`, `1,500` and a «ج.م» suffix, and reject ambiguous input (UX-16, tested).
- **Documents:** the global list labels each file with its owning record (UX-21). Row actions carry the filename in their accessible name (UX-19).
- **Backups:** freshness status with a readable date and size; each action explained; restore outlined rather than solid red; advice to keep a copy off the computer (UX-24, presentation only).
- **Onboarding (UX-14):** plain-language intro; password hint, confirmation and show/hide; recovery-key tips with an explicit acknowledgement; a way back from recovery to unlock.
- **Settings:** no nested cards; on/off settings use accessible switches.

## Validation

- `pnpm lint`, `pnpm typecheck`, `pnpm format:check`: pass.
- `pnpm test`: all Vitest suites and the script tests pass. New tests cover the formatters, the money parser, typed-date normalization, form validation messages and client preselection, task deep links and failures, Today completion, onboarding confirmation and acknowledgement, and backup advice.
- `cargo test --test clients_and_cases_repository`: pass, including same-name POA isolation. `cargo fmt --check`: pass.
- Visual baselines were regenerated with `pnpm update:visual:canonical`. The manifest remains `candidate` and needs the owner's review and approval.

## Remaining risks and follow-ups

- **English copy:** new strings go through i18n, but older client, POA, finance, attachment and settings text is still hardcoded Arabic, so English mode mixes languages there (UX-15).
- **Case relationships (UX-06):** clients' legal capacity and linked POA are shown but still cannot be edited from the case file.
- **Unsaved-draft protection (UX-11):** still absent for navigation, Escape and locking.
- **Reminders (UX-25):** per-record reminder controls are not added.
- **Not verified here:** the native desktop e2e, physical Windows/macOS rendering, screen-reader passes and real dark-theme captures. The desktop e2e script was updated for the new onboarding and creation flow but was not run.
