import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/bridge/commands', async (original) => {
  const module = await original<typeof import('@/bridge/commands')>();
  return { bridge: Object.fromEntries(Object.keys(module.bridge).map((key) => [key, vi.fn()])) };
});
import i18n from '@/i18n';
import { fixtures, prepareWorkflowMocks } from '@/test/workflow';
import { CaseCreateForm } from '@/features/cases/forms/CaseCreateForm';
import { ExpenseForm, PaymentForm } from '@/features/finances/pages/FinancesPage';
import { PowerOfAttorneyForm } from '@/features/powersOfAttorney/components/PowerOfAttorneyForm';
import { TaskForm } from '@/features/tasks/pages/TasksPage';
import { EntityPicker } from './EntityPicker';

const FOCUSABLE =
  'button, a[href], input, select, textarea, [role="combobox"], [role="button"], [tabindex]';

/** Focusable, visible-to-assistive-technology controls whose accessible name is empty. */
function unnamedFocusableControls(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE)]
    .filter(
      (element) =>
        !element.closest('[aria-hidden="true"]') &&
        element.getAttribute('tabindex') !== '-1' &&
        element.getAttribute('type') !== 'hidden' &&
        !(element as HTMLButtonElement).disabled,
    )
    .filter((element) => {
      try {
        expect(element).toHaveAccessibleName();
        return false;
      } catch {
        return true;
      }
    })
    .map((element) => element.outerHTML.slice(0, 160));
}

const noop = vi.fn();
const cases = [fixtures.caseSummary];
const clients = [fixtures.clientSummary];

function renderIn(node: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{node}</MemoryRouter>
    </QueryClientProvider>,
  );
}

const forms: [string, () => React.ReactNode][] = [
  [
    'task form (preselected case and client)',
    () => (
      <TaskForm
        initial={fixtures.task}
        initialCaseId={fixtures.caseItem.id}
        initialClientId={fixtures.client.id}
        cases={cases}
        clients={clients}
        busy={false}
        onSave={noop}
        onCancel={noop}
      />
    ),
  ],
  [
    'case form (preselected client chip)',
    () => (
      <CaseCreateForm
        clients={clients}
        initialClientIds={[fixtures.client.id]}
        busy={false}
        onSubmit={noop}
        onCancel={noop}
      />
    ),
  ],
  [
    'power of attorney form',
    () => <PowerOfAttorneyForm busy={false} onSubmit={noop} onCancel={noop} />,
  ],
  [
    'payment form',
    () => (
      <PaymentForm
        initialCaseId={fixtures.caseItem.id}
        cases={cases}
        busy={false}
        onSave={noop}
        onCancel={noop}
      />
    ),
  ],
  [
    'expense form',
    () => (
      <ExpenseForm
        initialCaseId={fixtures.caseItem.id}
        cases={cases}
        clients={clients}
        busy={false}
        onSave={noop}
        onCancel={noop}
      />
    ),
  ],
];

describe.each(['en', 'ar'] as const)('picker controls are named (%s)', (language) => {
  beforeEach(async () => {
    prepareWorkflowMocks();
    await i18n.changeLanguage(language);
  });

  it.each(forms)('leaves no unnamed focusable control on the %s', async (_, build) => {
    const { container } = renderIn(build());
    await screen.findAllByRole('combobox');
    expect(unnamedFocusableControls(container)).toEqual([]);
  });

  it('names the open, clear and remove buttons in the interface language', async () => {
    const { container } = renderIn(
      <>
        <EntityPicker
          items={[{ value: 'a', label: 'DEMO A' }]}
          value="a"
          onValueChange={noop}
          aria-label="Case"
        />
        <CaseCreateForm
          clients={clients}
          initialClientIds={[fixtures.client.id]}
          busy={false}
          onSubmit={noop}
          onCancel={noop}
        />
      </>,
    );
    await screen.findAllByRole('combobox');
    expect(
      screen.getAllByRole('button', { name: i18n.t('forms.showOptions') }).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: i18n.t('forms.clearSelection') })).toBeVisible();
    expect(
      screen.getByRole('button', {
        name: i18n.t('forms.removeNamed', { name: fixtures.client.fullName }),
      }),
    ).toBeVisible();
    expect(unnamedFocusableControls(container)).toEqual([]);
  });
});

it('the audit helper reports a focusable control that has no name', () => {
  const { container } = render(
    <button type="button">
      <svg />
    </button>,
  );
  expect(unnamedFocusableControls(container)).toHaveLength(1);
});
