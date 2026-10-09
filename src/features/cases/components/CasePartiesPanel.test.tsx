import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/bridge/commands', async (original) => {
  const module = await original<typeof import('@/bridge/commands')>();
  return { bridge: Object.fromEntries(Object.keys(module.bridge).map((key) => [key, vi.fn()])) };
});
import { bridge } from '@/bridge/commands';
import i18n from '@/i18n';
import { fixtures, prepareWorkflowMocks, renderWorkflow } from '@/test/workflow';
import { CasePartiesPanel } from './CasePartiesPanel';

const locales = [
  { language: 'en', add: 'Add opponent', name: 'Opponent name', save: 'Save opponent' },
  { language: 'ar', add: 'إضافة خصم', name: 'اسم الخصم', save: 'حفظ الخصم' },
] as const;

function render(caseDto = fixtures.caseItem) {
  return renderWorkflow(
    <CasePartiesPanel caseDto={caseDto} />,
    '/cases/demo-case-14',
    '/cases/:id',
  );
}

describe.each(locales)('opponent form validation ($language)', (locale) => {
  beforeEach(async () => {
    prepareWorkflowMocks();
    await i18n.changeLanguage(locale.language);
  });

  it.each([
    ['empty', ''],
    ['whitespace-only', '   '],
  ])('shows an announced required message for a %s name and keeps the draft', async (_, value) => {
    render();
    fireEvent.click(screen.getByRole('button', { name: locale.add }));
    const dialog = await screen.findByRole('dialog');
    const name = within(dialog).getByLabelText(locale.name);
    const lawyer = within(dialog).getByLabelText(i18n.t('cases.parties.lawyer'));
    fireEvent.change(name, { target: { value } });
    fireEvent.change(lawyer, { target: { value: 'DEMO retained lawyer' } });
    fireEvent.click(within(dialog).getByRole('button', { name: locale.save }));

    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent(i18n.t('forms.required'));
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(name.getAttribute('aria-describedby')).toContain(alert.id);
    expect(name).toHaveFocus();
    expect(name).toHaveValue(value);
    expect(lawyer).toHaveValue('DEMO retained lawyer');
    expect(bridge.caseAddOpponent).not.toHaveBeenCalled();
  });

  it('saves a valid name without any validation message', async () => {
    vi.mocked(bridge.caseAddOpponent).mockResolvedValue({
      ...fixtures.caseItem.opponents[0],
      fullName: 'DEMO Opponent',
    });
    render();
    fireEvent.click(screen.getByRole('button', { name: locale.add }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(locale.name), {
      target: { value: '  DEMO Opponent  ' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: locale.save }));

    await waitFor(() => expect(bridge.caseAddOpponent).toHaveBeenCalledTimes(1));
    expect(bridge.caseAddOpponent).toHaveBeenCalledWith(
      expect.objectContaining({ caseId: fixtures.caseItem.id, fullName: 'DEMO Opponent' }),
    );
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('opponent row without capacity or lawyer', () => {
  beforeEach(() => prepareWorkflowMocks());

  it.each([
    ['en', 'No capacity recorded'],
    ['ar', 'دون صفة مسجلة'],
  ])('shows the %s fallback instead of hardcoded Arabic', async (language, expected) => {
    await i18n.changeLanguage(language);
    render();
    const detail = screen.getByText(expected);
    expect(detail).toBeInTheDocument();
    if (language === 'en') expect(detail.textContent).not.toMatch(/[؀-ۿ]/);
  });

  it('joins capacity and lawyer with the middle dot when both exist', async () => {
    await i18n.changeLanguage('en');
    const [opponent] = fixtures.caseItem.opponents;
    render({
      ...fixtures.caseItem,
      opponents: [{ ...opponent, legalCapacity: 'Defendant', lawyerName: 'DEMO Counsel' }],
    });
    expect(screen.getByText('Defendant · Lawyer: DEMO Counsel')).toBeInTheDocument();
    expect(screen.queryByText('No capacity recorded')).not.toBeInTheDocument();
  });
});
