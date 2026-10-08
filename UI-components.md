# Report 1: UI component inventory and fit review

**Project:** Legal Masr / LegalMaster Solo (Tauri 2 + React 19, Arabic-first RTL)
**Commit reviewed:** `0d95fd7` (main)
**Date:** 2026-10-08
**Scope:** Read-only review. No code was changed in the repository. The app was run in its fixture "capture mode" in a separate scratch copy to take the screenshots referenced below and to check one suspected bug.

---

## 0. Summary

1. **This project does not really use shadcn/ui.** `components.json` exists, but nothing in `src/components/ui/` came from the shadcn registry. There are 20 small hand-written files. Some are thin Tailwind wrappers (`Button`, `Input`, `Select`, `Checkbox`, `Textarea`). Five are never imported anywhere: four bare Base UI re-exports (`AlertDialog`, `ScrollArea`, `Separator`, `Tooltip`) and `Badge`. Most of the look comes from a **4,805-line hand-written stylesheet** (`src/styles/styles.css`) with about 900 legacy rule selectors. Tailwind is imported at the very bottom of that file.
2. **The app has two styling systems that fight each other.** Legacy CSS is "unlayered", so it beats Tailwind's layered utilities. Components are therefore often styled twice, for example `<Button variant="secondary" className="secondary-button">` appears about 70 times. That is why visual fixes feel like whack-a-mole.
3. **The app has two form systems.** Only 3 of about 16 forms use `react-hook-form` + zod + the shared `Field` component: Client, Case and Onboarding. All the others use bare `<label>` wrappers, `useState` per field and ad-hoc validation: POA, Hearing, Decision, Task, Payment, Expense, Opponent, Attachment, Fee, Settings ×4. They look and behave differently (compare the screenshots of the new-case page and the POA dialog).
4. **Your two named complaints have specific, fixable causes:**
   - **Client multi-select (Case + POA):** Case uses a custom always-open checkbox list (`ClientPicker`), and its "add client" link navigates away, so everything typed is lost. POA uses an unsearchable flat checkbox list of every client. The right component is a **searchable multi-select combobox with chips and an inline "create client" option**. Base UI 1.8, which is already installed, ships exactly this (`Combobox` with `multiple`, `Chips`, `Chip`, `ChipRemove`).
   - **Ugly date picker:** `react-day-picker`'s stylesheet is **never imported**, so the calendar renders as a bare HTML table. In Arabic the weekday headers run together ("خميسجمعة") and the day columns don't line up under them. Some old CSS from a previous custom calendar is still there and no longer matches anything.
5. **Bugs found while reviewing** (section 5):
   - **Confirmed by test:** saving a new client from inside the POA form also submits the POA form, twice, with an empty internal number.
   - The calendar day buttons announce only "5" to screen readers.
   - Case clients can't be added or removed after a case is created; the panel is read-only and there is no API for it.
6. **About eight composite components would fix most of the pain.** They are listed in section 6. None of them requires leaving Base UI.

_The Arabic date picker as it renders today: weekday headers run together, the columns are misaligned, both navigation chevrons sit above the caption, there's no "today" marker and no month/year jump._

---

## 1. How the UI layer is built

| Layer               | What is used                                                                           | Notes                                                                                                                                                                                        |
| ------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Behavior primitives | `@base-ui/react` 1.8.0                                                                 | Used for Dialog, Popover, Select, Checkbox, Tabs, Menu, plus `DirectionProvider` for RTL. Good choice; it's the most up-to-date headless kit.                                                |
| "shadcn" layer      | `src/components/ui/*` (20 files)                                                       | Hand-written. `Button` uses `cva` like shadcn, but it isn't shadcn source. `components.json` (style `new-york`, `rtl: true`, Tabler icons) has evidently never been used to add a component. |
| Styling             | `styles.css` (4,805 lines, legacy classes) + Tailwind v4 `@theme` token bridge         | The comment in the file says "while screens are migrated incrementally". That migration stopped early.                                                                                       |
| Forms               | `react-hook-form` + `zod` in 3 forms; `useState`/`FormData` in the rest                | Validation, error display and required marks are inconsistent.                                                                                                                               |
| Dates               | `react-day-picker` 10 inside a Base UI Popover; native `<input type="time">` for times | Day-picker CSS missing; the time input looks different on each OS WebView.                                                                                                                   |
| Icons               | `@tabler/icons-react` via `components/layout/Icon.tsx`                                 | Fine.                                                                                                                                                                                        |
| Toasts              | `sonner`                                                                               | Fine.                                                                                                                                                                                        |
| Data fetching       | TanStack Query                                                                         | Fine.                                                                                                                                                                                        |
| Tables              | `<Table>` = a plain `<table className="ui-table">`                                     | No sorting, paging or column control.                                                                                                                                                        |

### What the shared `ui/` kit contains

| File                                                                               | What it is                           | Used in                                           | Fit            | Recommendation                                                                                                                                                       |
| ---------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `button.tsx`                                                                       | `cva` button with 5 variants         | Everywhere (~120 uses)                            | ✅ Good        | Delete the legacy `.secondary-button`, `.text-button`, `.danger-button`, `.compact-button` and `.quiet-button` classes and use real variants (`link`, `icon`, `sm`). |
| `input.tsx`                                                                        | Styled `<input>`                     | Everywhere                                        | ✅ Good        | Add an `InputGroup` (prefix/suffix slot) for money, search and phone.                                                                                                |
| `textarea.tsx`                                                                     | Styled `<textarea>`                  | Notes everywhere                                  | ✅ OK          | Optionally auto-grow.                                                                                                                                                |
| `select.tsx`                                                                       | Base UI Select, items array          | about 20 places                                   | ⚠️ Overused    | Fine for short fixed lists. **Wrong for cases/clients** (hundreds of rows, no search). See `EntityPicker`.                                                           |
| `checkbox.tsx`                                                                     | Base UI Checkbox                     | 9 files                                           | ✅ Good        | Used as a multi-select for clients, which is the wrong job (see §3).                                                                                                 |
| `Switch.tsx`                                                                       | Hand-rolled `<button role="switch">` | Settings                                          | ⚠️ Works       | Replace with Base UI `Switch` for consistency (gets form integration and `data-*` states).                                                                           |
| `Tabs.tsx`                                                                         | Base UI Tabs (segmented / underline) | Case, Client, POA detail; Tasks; Finances; Agenda | ✅ Good        | Also use it for the Settings side nav, which is currently fake tabs made of `Button`s.                                                                               |
| `Dialog.tsx`                                                                       | Base UI Dialog + `ConfirmDialog`     | ~15 dialogs                                       | ✅ OK          | Add size variants (sm/md/lg/full) and a sticky footer. The POA form is too long for it.                                                                              |
| `DatePicker.tsx`                                                                   | Text input + Popover + DayPicker     | 9 date fields                                     | ❌ Broken look | See §4.1.                                                                                                                                                            |
| `Field.tsx`                                                                        | Label + hint + error + aria wiring   | **Only 3 forms**                                  | ✅ Good design | Use it in **every** form.                                                                                                                                            |
| `sheet.tsx`                                                                        | Base UI Dialog re-export             | Shell (mobile drawer, search palette)             | ✅ OK          | Base UI 1.8 now has a dedicated `Drawer`.                                                                                                                            |
| `dropdown-menu.tsx`                                                                | Base UI Menu re-export               | Shell "+ إضافة" menu                              | ✅ Good        | —                                                                                                                                                                    |
| `card.tsx`, `table.tsx`, `skeleton.tsx`                                            | `div`/`table` + one class            | Lists, empty states                               | ⚠️ Thin        | Fine as markup; move their styles into the component.                                                                                                                |
| `badge.tsx`, `alert-dialog.tsx`, `scroll-area.tsx`, `separator.tsx`, `tooltip.tsx` | Re-exports                           | **Unused** (0 imports)                            | 🗑️             | Delete them or style them properly. Status badges are done with `.status-badge` CSS instead of `Badge`.                                                              |

---

## 2. Shell and global controls

| Element                                | Component used                                    | Fit                                                         | Better option                                                                                          |
| -------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Sidebar navigation                     | `NavLink` list, grouped                           | ✅                                                          | —                                                                                                      |
| Global search (topbar, Ctrl K palette) | `Input` with hand-built `role="combobox"` listbox | ⚠️ Works, but the ARIA and keyboard handling are hand-built | Base UI `Autocomplete` (or `cmdk`) gives grouped results, keyboard handling and correct ARIA for free. |
| Ctrl K palette container               | `Sheet` (Base UI Dialog)                          | ✅                                                          | —                                                                                                      |
| "+ إضافة" create menu                  | `DropdownMenu` (Base UI Menu)                     | ✅                                                          | —                                                                                                      |
| Mobile drawer                          | `Sheet`                                           | ✅                                                          | Base UI `Drawer`.                                                                                      |
| Lock button, language switcher         | `Button`                                          | ✅                                                          | —                                                                                                      |

---

## 3. Page-by-page and form-by-form inventory

Legend: ✅ right component · ⚠️ works but weak · ❌ wrong component or broken

### 3.1 Today (Dashboard) — `DashboardPage.tsx`

| Element                                  | Component                   | Fit | Better |
| ---------------------------------------- | --------------------------- | --- | ------ |
| Count tiles (hearings, tasks, overdue)   | Custom `today-stats` markup | ✅  | —      |
| Overdue / today task rows                | `Checkbox` + text rows      | ✅  | —      |
| Today's hearings timeline, upcoming list | Custom `<ul>`               | ✅  | —      |
| "Open agenda"                            | `Button asChild` + `Link`   | ✅  | —      |

### 3.2 Clients list — `ClientListPage.tsx`

| Element         | Component           | Fit | Better                                                                                                       |
| --------------- | ------------------- | --- | ------------------------------------------------------------------------------------------------------------ |
| Search          | `Input type=search` | ✅  | Add a debounce (each keystroke runs a query now).                                                            |
| "Show archived" | `Checkbox`          | ✅  | `Switch` or a segmented filter (Active / Archived / All).                                                    |
| List            | `Table` (plain)     | ⚠️  | Sortable columns + pagination (TanStack Table + your `Table` styles). AG Grid is overkill for a solo office. |
| Empty state     | `Card`              | ✅  | —                                                                                                            |

### 3.3 New / edit client — `ClientForm.tsx` (page + inline dialog + edit dialog)

| Field       | Component         | Fit | Better |
| ----------- | ----------------- | --- | ------ |
| Full name * | `Field` + `Input` | ✅  | —      |

## Completed repository inventory (replacement scope, 2026-10-08)

The original report stops at the first client field. Repository inspection completes its scope:

| Surface                 | Existing controls and forms                                                                                  | Replacement compositions                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Client create/detail    | Identity/contact/notes, duplicate confirmation, edit/archive/export/account                                  | FieldGroup, Field, FormDialog, Alert, Badge                                 |
| Case list/create/detail | Search/status/client filters, core fields, client checkbox list, opponents, fees, hearings/tasks/attachments | EntityPicker, EntityMultiPicker, Calendar, AmountInput, relationship editor |
| POA list/detail         | Search/archive, sequence/number/date/notary, clients, descriptive lawyers, inline client creation            | Separate create page, multi-select chips, isolated client dialog            |
| Agenda                  | Month/week/list tabs, hearing and decision forms, case/date/time/type/court/circuit                          | Tabs, EntityPicker, Calendar, TimeField, text suggestions                   |
| Tasks                   | Derived tabs, case/client filters, title/date/details/notes form, completion                                 | Tabs, EntityPicker, FieldGroup                                              |
| Finance                 | Payment/expense tabs and filters, payer restricted by case, amount/date/method/type/notes                    | EntityPicker, AmountInput, Calendar                                         |
| Documents               | Managed attachment list, category/description/date metadata, remove confirmation                             | Table, FieldGroup, Calendar, FormDialog                                     |
| Backups                 | Create/validate/restore confirmations and result/error feedback                                              | AlertDialog, Alert, Spinner                                                 |
| Settings                | Profile, general preferences, security/password, backup/privacy/about                                        | FieldGroup, preset selects, Switch, Tabs                                    |
| Onboarding/lock         | Setup/unlock/recovery forms and recovery key acknowledgement                                                 | FieldGroup, InputGroup, Alert                                               |
| Shell/search            | Navigation, drawer, quick create menu, locale/lock, search results                                           | Sheet, DropdownMenu, Dialog, Autocomplete                                   |

Shared primitive replacement uses the official `@shadcn` Base UI registry. Application compositions live outside `components/ui`; no renderer permissions or migrations are part of this replacement.
