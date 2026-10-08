# Report 2: Should Legal Masr move off shadcn/Base UI?

**Date:** 2026-10-08 · **Based on:** the component review in Report 1, the code at `0d95fd7`, and the ChatGPT "React UI Libraries Battle Royale — 2026" write-up you shared.

---

## Verdict

**Don't migrate.** Keep Base UI as the foundation and finish the job the project started. Adopt the shadcn way of working for real, with registry-style components that own their styles, and build the 4–5 missing composite components.

Reasons:

1. **The problems you described are not caused by shadcn or Base UI.** They come from three things:
   - the app never actually used shadcn components;
   - a 4,800-line legacy stylesheet overrides the component styles;
   - a few key composite components were never built (searchable multi-select, a styled calendar, a unified form pattern).

   Moving to another library fixes those only because it forces a rewrite. The same rewrite on your current stack costs a fraction as much.

2. **Everything you asked for already ships in the library you have installed.** Base UI 1.8 (in `node_modules` now) includes `Combobox` with `multiple` and `Chips`/`Chip`/`ChipRemove`, plus `Autocomplete`, `NumberField`, `Field`, `Fieldset`, `Form`, `Drawer` and `Toast`. react-day-picker 10 (installed) supports `captionLayout="dropdown"`; it only needs its styles.
3. **Migration cost is real and lands on your hardest-won parts.** That means Arabic RTL tuning, the Western-digit and date-only rules, about 13 UI test files that query Arabic labels and roles, and 64 visual baselines, across about 20 screens and 16 forms.
4. **Mantine would be the right pick for a new project.** I agree with ChatGPT on that. For this codebase the switching cost cancels out its advantage (see the scorecard).

---

## 1. What ChatGPT's report gets right, and what it misses for this project

| ChatGPT claim                                                                                                                                               | My assessment                                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Switching shadcn from Base UI to Radix or React Aria won't improve visuals."                                                                               | **Correct**, and it applies here directly.                                                                                                                                                                                 |
| "If the problem is final appearance, replacing Base UI won't solve it; if it's the amount of work for complex business widgets, Mantine or Ant could help." | **Correct framing.** Your problem is mostly the second kind, but only for about 5 widgets, and Base UI already has the primitives for them.                                                                                |
| "Data tables require too much construction" is the likely pain point.                                                                                       | **Not your pain point.** Your lists are small (one lawyer's clients and cases). The real pain is pickers, dates and form consistency. AG Grid would be overkill.                                                           |
| FullCalendar for hearings, Syncfusion for PDFs, Tiptap for notes.                                                                                           | **Mostly overkill for a solo offline desktop app.** Your custom agenda already handles RTL and Arabic. Syncfusion and KendoReact are commercial and heavy. Consider Tiptap only if you later want rich legal-note editing. |
| "Mantine: best overall for Legal Masr."                                                                                                                     | **True for a new project.** For this codebase, see the scorecard.                                                                                                                                                          |
| "You become a design-system maintainer."                                                                                                                    | **True, and it's already happening, but badly:** you maintain 4,800 lines of global CSS instead of about 25 self-contained components. Fixing that reduces the maintenance burden whatever you decide.                     |
| The report assumes you're using shadcn as designed.                                                                                                         | **You aren't.** No component in `src/components/ui/` came from the shadcn registry. You haven't yet seen what a properly built shadcn/Base UI Combobox, Calendar or Field looks like in this app.                          |
| Weighted scorecard and "prototype the same screens in several stacks."                                                                                      | **Good method.** I apply it below, and I suggest a much smaller one-screen prototype instead of three full prototypes.                                                                                                     |

Some things the report doesn't consider:

- **Tauri WebViews.** Windows uses WebView2 (Chromium), macOS uses WKWebView (Safari) and Linux uses WebKitGTK. Native inputs such as `type=time`, `type=date` and `type=number` look and behave differently on each. That argues for fully custom controls, which every option provides; it isn't a reason to switch.
- **The date-library mismatch.** Mantine Dates and Ant Design both use **dayjs**. Your app uses date-fns plus your own date-only helpers (`src/lib/dateOnly.ts`, `src/lib/format.ts`). Migrating means a second date library, and you would need to check that its Arabic locale respects your "Western digits everywhere" rule.
- **Styling engines.** Ant Design v5 and MUI generate styles at runtime with CSS-in-JS. Mantine uses CSS modules and needs layering work to sit alongside Tailwind. Your Tailwind v4 tokens would have to be duplicated into their theme systems.

---

## 2. Scorecard for this codebase (migration cost included)

These are judgement scores (1–5), not measurements, using ChatGPT's weights. "Stay" assumes the Report 1 plan is carried out.

| Factor (weight)                       | **Stay: Base UI + proper shadcn-style kit** | Mantine                  | Ant Design          | MUI (+ MUI X pickers)          |
| ------------------------------------- | ------------------------------------------- | ------------------------ | ------------------- | ------------------------------ |
| Workflow speed & usability (25%)      | 4                                           | 4                        | 4                   | 4                              |
| RTL & Arabic correctness (20%)        | 4 (already working, under your control)     | 4                        | 4                   | 3 (emotion + stylis RTL setup) |
| Component coverage (20%)              | 3 (pickers to build)                        | 5                        | 5                   | 4                              |
| Final visual quality (15%)            | 4 (your own identity)                       | 4                        | 3 (strong Ant look) | 3 (Material look)              |
| Customization & maintainability (10%) | 5                                           | 3                        | 2                   | 3                              |
| Licensing & integration cost (10%)    | 5 (no migration)                            | 2 (rewrite every screen) | 2                   | 2                              |
| **Weighted total**                    | **≈ 80%**                                   | ≈ 78%                    | ≈ 73%               | ≈ 67%                          |
| _Ignoring migration (new project)_    | _≈ 78%_                                     | _**≈ 82%**_              | _≈ 77%_             | _≈ 70%_                        |

How to read it: Mantine edges ahead only when switching is free. Once you count switching cost, staying wins narrowly on score and clearly on risk, because staying can be done one screen at a time and every step ships value.

---

## 3. Rough cost of each path

These are estimates for one developer, including tests and RTL QA. Treat them as orders of magnitude.

| Path                                      | Work                                                                                                                                                                | Rough effort                                                                      | Risk                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **Stay, phase 1** (fixes both complaints) | `EntityMultiPicker`, `EntityPicker`, `DatePicker` v2, fix the POA nested-form bug                                                                                   | ~1–2 weeks                                                                        | Low; localized changes, existing tests protect the rest |
| **Stay, phase 2**                         | RHF + `Field` + `FormDialog` across 13 forms; `CreatableCombobox`, `TimeField`, `AmountInput`; POA to its own page                                                  | ~2–3 weeks                                                                        | Low–medium                                              |
| **Stay, phase 3**                         | Move legacy CSS into components and `@layer`, delete dead CSS and unused wrappers, `DataTable`                                                                      | ~2–3 weeks, can be spread out                                                     | Medium (visual baselines need re-approval)              |
| **Migrate to Mantine**                    | Replace every `ui/` usage on ~20 screens and 16 forms; port tokens to the Mantine theme; dayjs adapter; RTL QA; rewrite many test queries; regenerate all baselines | ~5–8 weeks before you're back where you are, then the same picker and form polish | Medium–high; long freeze on feature work                |
| **Migrate to Ant Design**                 | Same, plus visual re-theming away from the Ant look                                                                                                                 | ~6–9 weeks                                                                        | High                                                    |

---

## 4. The recommended plan (stay)

**Phase 1: fix what annoys you most**

1. **`EntityMultiPicker`** on Base UI `Combobox multiple`: type-ahead by name, number or phone; chips for selected clients; a "＋ Add «typed name» as a new client" row that opens `ClientForm` in a dialog prefilled and auto-selects the result. Use it in **Case create** and **POA create/edit**.
2. **`EntityPicker`** (single): replace every case/client `Select` (hearing, task, payment, expense, and filters).
3. **`DatePicker` v2**: fully styled DayPicker (shadcn Base UI `Calendar` style) with a month/year dropdown, Today and Clear buttons, `dd/MM/yyyy` display, correct aria labels; delete the dead CSS.
4. Fix the **POA inline-client submit bug** and add a regression test (Report 1 §5.1).

**Phase 2: make the forms consistent** 5. RHF + zod + `Field` + a `FormDialog` shell for every form. 6. `CreatableCombobox` for court, circuit, case type, hearing type, notary office and legal capacity. 7. `TimeField` (15-minute slot combobox), `AmountInput` (ج.م suffix), and preset `Select`s for the reminder and auto-lock settings. 8. Move POA create to a page (like New Case); add a backend command to edit a case's clients (UX-06) and reuse `EntityMultiPicker` there.

**Phase 3: pay down the styling debt** 9. Wrap `styles.css` in `@layer components` so Tailwind utilities stop losing; then move styles into components screen by screen. 10. Delete unused `ui/` files; remove the duplicate `variant` + legacy-class pairs. 11. Optional: `DataTable` (TanStack Table) for sortable lists.

**Practical tip:** run `shadcn` with the Base UI flavor in a throwaway folder and copy its `combobox`, `calendar`, `field` and `input-group` source as a starting point, adapted to your tokens. That's the "copy and own" model working as intended.

---
