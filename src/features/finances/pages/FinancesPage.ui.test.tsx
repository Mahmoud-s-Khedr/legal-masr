import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../bridge/commands', () => ({
  bridge: {
    caseList: vi.fn(),
    caseGet: vi.fn(),
    clientList: vi.fn(),
    paymentList: vi.fn(),
    expenseList: vi.fn(),
    paymentSave: vi.fn(),
    expenseSave: vi.fn(),
  },
}));

import { bridge } from '../../../bridge/commands';
import { FinancesPage } from './FinancesPage';
import i18n from '../../../i18n';
import { LocalePresentationContext } from '../../../i18n/LocalePresentation';
import { arEG, enUS } from 'date-fns/locale';

function renderPage(language: 'ar' | 'en' = 'ar') {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter>
        <LocalePresentationContext.Provider
          value={{
            language,
            direction: language === 'ar' ? 'rtl' : 'ltr',
            dateLocale: language === 'ar' ? arEG : enUS,
            weekStartsOn: 6,
            dateFormat: 'dd/MM/yyyy',
          }}
        >
          <FinancesPage />
        </LocalePresentationContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('FinancesPage', () => {
  it.each(['ar', 'en'] as const)(
    'uses %s locale and the date preference in payment inspection',
    async (language) => {
      await i18n.changeLanguage(language);
      vi.mocked(bridge.paymentList).mockResolvedValue([
        {
          id: 'payment-1',
          caseId: 'case-1',
          payerClientId: 'client-1',
          amountMinor: 150025,
          paymentDate: '2026-08-24',
          paymentMethod: 'CASH',
          notes: null,
          createdAt: 'now',
          updatedAt: 'now',
        },
      ]);
      renderPage(language);
      const table = await screen.findByRole('table');
      await waitFor(() =>
        expect(
          within(table).getAllByRole('button', {
            name: /24 أغسطس 2026|August 24, 2026|24 August 2026/,
          }),
        ).toHaveLength(1),
      );
      fireEvent.click(
        within(table).getByRole('button', { name: /24 أغسطس 2026|August 24, 2026|24 August 2026/ }),
      );
      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText('24/08/2026')).toBeVisible();
      const amount = within(dialog).getByText(/1,500.25/);
      expect(amount.tagName).toBe('BDI');
      if (language === 'en') expect(amount).toHaveTextContent('EGP');
      expect(amount).not.toHaveTextContent('١');
    },
  );

  afterEach(async () => {
    await i18n.changeLanguage('ar');
  });
  beforeEach(async () => {
    await i18n.changeLanguage('ar');
    vi.clearAllMocks();
    vi.mocked(bridge.caseList).mockResolvedValue([
      {
        id: 'case-1',
        internalNumber: 'CA-1',
        officialNumber: null,
        officialYear: null,
        judicialYear: null,
        status: 'ACTIVE',
        clientNames: ['أحمد'],
        archivedAt: null,
        courtName: null,
        nextHearingDate: null,
      },
    ]);
    vi.mocked(bridge.clientList).mockResolvedValue([
      {
        id: 'client-1',
        internalNumber: 'CL-1',
        fullName: 'أحمد',
        primaryPhone: null,
        archivedAt: null,
      },
      {
        id: 'client-2',
        internalNumber: 'CL-2',
        fullName: 'منى',
        primaryPhone: null,
        archivedAt: null,
      },
    ]);
    vi.mocked(bridge.caseGet).mockImplementation(async (id) => ({
      id,
      internalNumber: 'CA-1',
      officialNumber: null,
      officialYear: null,
      judicialYear: null,
      caseType: null,
      litigationDegree: null,
      courtName: null,
      circuitName: null,
      status: 'ACTIVE',
      filedOn: null,
      closedOn: null,
      subject: null,
      notes: null,
      archivedAt: null,
      createdAt: 'now',
      updatedAt: 'now',
      clients:
        id === 'case-1'
          ? [
              {
                clientId: 'client-1',
                fullName: 'أحمد',
                internalNumber: 'CL-1',
                legalCapacity: null,
                powerOfAttorneyId: null,
                notes: null,
              },
            ]
          : [],
      opponents: [],
    }));
    vi.mocked(bridge.paymentList).mockResolvedValue([]);
    vi.mocked(bridge.expenseList).mockResolvedValue([]);
    vi.mocked(bridge.expenseSave).mockResolvedValue({
      id: 'expense-1',
      caseId: null,
      clientId: null,
      amountMinor: 1_250,
      expenseDate: '2026-08-24',
      expenseType: 'COURT_FEE',
      notes: null,
      createdAt: 'now',
      updatedAt: 'now',
    });
  });

  it('filters payment payers to the chosen case and saves expenses with both links optional', async () => {
    renderPage();
    await screen.findByRole('combobox', { name: 'القضية' });
    fireEvent.click(screen.getByRole('button', { name: 'إضافة دفعة' }));
    const paymentDialog = await screen.findByRole('dialog', { name: 'إضافة دفعة' });
    const caseSelect = within(paymentDialog).getByRole('combobox', { name: 'القضية' });
    caseSelect.focus();
    fireEvent.click(caseSelect);
    fireEvent.keyDown(caseSelect, { key: 'ArrowDown' });
    fireEvent.click(await screen.findByRole('option', { name: /^CA-1( —|$)/ }));
    const payer = await within(paymentDialog).findByRole('combobox', { name: 'الموكل الدافع' });
    payer.focus();
    fireEvent.click(payer);
    fireEvent.keyDown(payer, { key: 'ArrowDown' });
    await screen.findByRole('option', { name: 'أحمد' });
    expect(screen.queryByRole('option', { name: 'منى' })).not.toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });

    fireEvent.click(screen.getByRole('tab', { name: 'المصروفات' }));
    fireEvent.click(screen.getByRole('button', { name: 'إضافة مصروف' }));
    const expenseDialog = await screen.findByRole('dialog', { name: 'إضافة مصروف' });
    expect(
      within(expenseDialog).getByText(
        'اربط المصروف بقضية أو موكل إن وُجد، أو اتركه بلا ربط لمصروفات المكتب العامة.',
      ),
    ).toBeInTheDocument();
    fireEvent.change(within(expenseDialog).getByLabelText('المبلغ (ج.م)'), {
      target: { value: '12.50' },
    });
    fireEvent.click(within(expenseDialog).getByRole('button', { name: 'حفظ المصروف' }));
    await waitFor(() =>
      expect(bridge.expenseSave).toHaveBeenCalledWith(
        expect.objectContaining({ caseId: undefined, clientId: undefined, amountMinor: 1_250 }),
      ),
    );
  });

  it('opens a keyboard-accessible transaction inspection before editing a ledger item', async () => {
    vi.mocked(bridge.paymentList).mockResolvedValueOnce([
      {
        id: 'payment-1',
        caseId: 'case-1',
        payerClientId: 'client-1',
        amountMinor: 12_500,
        paymentDate: '2026-08-24',
        paymentMethod: 'CASH',
        notes: 'دفعة أولى',
        createdAt: 'now',
        updatedAt: 'now',
      },
    ]);
    renderPage();

    const transaction = await screen.findByRole('button', { name: /24 أغسطس 2026/ });
    transaction.focus();
    fireEvent.click(transaction);
    const inspection = await screen.findByRole('dialog', { name: 'تفاصيل الدفعة' });
    expect(within(inspection).getByText('دفعة أولى')).toBeInTheDocument();
    fireEvent.click(within(inspection).getByRole('button', { name: 'تعديل السجل' }));
    expect(await screen.findByRole('dialog', { name: 'تعديل دفعة' })).toBeInTheDocument();
  });

  it('keeps a failed expense draft in its dialog for retry', async () => {
    vi.mocked(bridge.expenseSave).mockRejectedValueOnce(new Error('save failed'));
    renderPage();
    await screen.findByRole('combobox', { name: 'القضية' });
    fireEvent.click(screen.getByRole('tab', { name: 'المصروفات' }));
    fireEvent.click(screen.getByRole('button', { name: 'إضافة مصروف' }));
    const dialog = await screen.findByRole('dialog', { name: 'إضافة مصروف' });
    fireEvent.change(within(dialog).getByLabelText('المبلغ (ج.م)'), { target: { value: '12.50' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'حفظ المصروف' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('تعذر حفظ السجل');
    expect(within(dialog).getByLabelText('المبلغ (ج.م)')).toHaveValue('12.50');
  });

  it('creates one expense when the save is triggered twice before the first completes', async () => {
    let finish!: () => void;
    vi.mocked(bridge.expenseSave).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () =>
            resolve({
              id: 'expense-1',
              caseId: null,
              clientId: null,
              amountMinor: 1_250,
              expenseDate: '2026-08-24',
              expenseType: 'COURT_FEE',
              notes: null,
              createdAt: 'now',
              updatedAt: 'now',
            });
        }),
    );
    renderPage();
    await screen.findByRole('combobox', { name: 'القضية' });
    fireEvent.click(screen.getByRole('tab', { name: 'المصروفات' }));
    fireEvent.click(screen.getByRole('button', { name: 'إضافة مصروف' }));
    const dialog = await screen.findByRole('dialog', { name: 'إضافة مصروف' });
    fireEvent.change(within(dialog).getByLabelText('المبلغ (ج.م)'), { target: { value: '12.50' } });

    // Two submissions in the same tick, before any re-render could disable the button.
    const save = within(dialog).getByRole('button', { name: 'حفظ المصروف' });
    fireEvent.click(save);
    fireEvent.click(save);
    await waitFor(() => expect(bridge.expenseSave).toHaveBeenCalledTimes(1));
    finish();
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'إضافة مصروف' })).toBeNull());
    expect(bridge.expenseSave).toHaveBeenCalledTimes(1);
  });
});
