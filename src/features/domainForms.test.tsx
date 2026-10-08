import { fireEvent, render as rtlRender, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

vi.mock('./clients/api/clientsApi', () => ({
  useClientList: vi.fn(() => ({ data: [] })),
  useCreateClient: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}));

import i18n from '../i18n';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
function render(ui: ReactNode, options?: Parameters<typeof rtlRender>[1]) {
  return rtlRender(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      {ui}
    </QueryClientProvider>,
    options,
  );
}
async function selectClient(name: string) {
  const input = screen.getByPlaceholderText(i18n.t('cases.form.clientSearch'));
  input.focus();
  fireEvent.click(input);
  fireEvent.change(input, { target: { value: name } });
  fireEvent.keyDown(input, { key: 'ArrowDown' });
  fireEvent.click(await screen.findByRole('option', { name }));
}
import { useClientList, useCreateClient } from './clients/api/clientsApi';
import { ClientForm } from './clients/forms/ClientForm';
import { CaseCreateForm } from './cases/forms/CaseCreateForm';
import { PowerOfAttorneyForm } from './powersOfAttorney/components/PowerOfAttorneyForm';

describe('canonical domain forms', () => {
  it('submits the Arabic client form with mixed-direction identifiers intact', async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    render(<ClientForm busy={false} submitLabel="حفظ" onSubmit={submit} />);

    const number = screen.getByLabelText('الرقم الداخلي');
    expect(number).toHaveAttribute('dir', 'ltr');
    fireEvent.change(number, { target: { value: 'CL-42' } });
    fireEvent.change(screen.getByLabelText('الاسم الكامل'), { target: { value: 'أحمد Smith' } });
    fireEvent.click(screen.getByRole('button', { name: 'حفظ' }));

    await waitFor(() => expect(submit).toHaveBeenCalled());
    expect(submit.mock.calls[0][0]).toMatchObject({
      internalNumber: 'CL-42',
      fullName: 'أحمد Smith',
    });
  });

  it('fills in the suggested next number, says so, and lets the lawyer change it', async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    render(<ClientForm busy={false} submitLabel="حفظ" suggestedNumber="C-8" onSubmit={submit} />);

    const number = await screen.findByDisplayValue('C-8');
    expect(screen.getByText(i18n.t('forms.suggestedNumber'))).toBeVisible();
    fireEvent.change(number, { target: { value: 'C-100' } });
    expect(screen.queryByText(i18n.t('forms.suggestedNumber'))).toBeNull();
    fireEvent.change(screen.getByLabelText('الاسم الكامل'), { target: { value: 'أحمد' } });
    fireEvent.click(screen.getByRole('button', { name: 'حفظ' }));
    await waitFor(() =>
      expect(submit.mock.calls[0]?.[0]).toMatchObject({ internalNumber: 'C-100' }),
    );
  });

  it('never replaces a number already typed with a late suggestion', async () => {
    const { rerender } = render(
      <ClientForm
        busy={false}
        submitLabel="حفظ"
        defaultValues={{ internalNumber: 'X-1' }}
        onSubmit={vi.fn()}
      />,
    );
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <ClientForm
          busy={false}
          submitLabel="حفظ"
          defaultValues={{ internalNumber: 'X-1' }}
          suggestedNumber="C-8"
          onSubmit={vi.fn()}
        />
      </QueryClientProvider>,
    );
    expect(await screen.findByDisplayValue('X-1')).toBeInTheDocument();
  });

  it('includes the optional official number and checked clients when creating a case', async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    render(
      <CaseCreateForm
        busy={false}
        clients={[
          {
            id: 'client-1',
            internalNumber: 'CL-1',
            fullName: 'أحمد',
            primaryPhone: null,
            archivedAt: null,
          },
        ]}
        onCancel={vi.fn()}
        onSubmit={submit}
      />,
      { wrapper: MemoryRouter },
    );

    fireEvent.change(screen.getByLabelText('رقم الملف الداخلي'), { target: { value: 'CA-5' } });
    const officialNumber = screen.getByLabelText('رقم الدعوى بالمحكمة');
    expect(officialNumber).toHaveAttribute('dir', 'ltr');
    fireEvent.change(officialNumber, { target: { value: '2026/45' } });
    await selectClient('أحمد');
    fireEvent.click(screen.getByRole('button', { name: 'حفظ القضية' }));

    await waitFor(() => expect(submit).toHaveBeenCalled());
    expect(submit.mock.calls[0][0]).toMatchObject({
      officialNumber: '2026/45',
      clientIds: ['client-1'],
    });
  });

  it('explains a missing client and blank required fields instead of failing silently', async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    render(
      <CaseCreateForm
        busy={false}
        clients={[
          {
            id: 'client-1',
            internalNumber: 'CL-1',
            fullName: 'أحمد',
            primaryPhone: null,
            archivedAt: null,
          },
        ]}
        onCancel={vi.fn()}
        onSubmit={submit}
      />,
      { wrapper: MemoryRouter },
    );
    fireEvent.change(screen.getByLabelText('رقم الملف الداخلي'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'حفظ القضية' }));
    expect(await screen.findByText('اختر موكلًا واحدًا على الأقل لحفظ القضية.')).toBeVisible();
    expect(screen.getByText('هذا الحقل مطلوب.')).toBeVisible();
    expect(screen.getByLabelText('رقم الملف الداخلي')).toHaveAttribute('aria-invalid', 'true');
    expect(submit).not.toHaveBeenCalled();
  });

  it('offers to add a client when none exist yet', () => {
    render(<CaseCreateForm busy={false} clients={[]} onCancel={vi.fn()} onSubmit={vi.fn()} />, {
      wrapper: MemoryRouter,
    });
    expect(screen.getByText('لا يوجد موكلون بعد')).toBeVisible();
    expect(screen.getByRole('button', { name: 'إضافة موكل جديد' })).toBeVisible();
  });

  it('preselects the client a case is opened from', async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    render(
      <CaseCreateForm
        busy={false}
        initialClientIds={['client-1']}
        clients={[
          {
            id: 'client-1',
            internalNumber: 'CL-1',
            fullName: 'أحمد',
            primaryPhone: null,
            archivedAt: null,
          },
        ]}
        onCancel={vi.fn()}
        onSubmit={submit}
      />,
      { wrapper: MemoryRouter },
    );
    expect(screen.getByText('أحمد')).toBeVisible();
    fireEvent.change(screen.getByLabelText('رقم الملف الداخلي'), { target: { value: 'CA-9' } });
    fireEvent.click(screen.getByRole('button', { name: 'حفظ القضية' }));
    await waitFor(() => expect(submit).toHaveBeenCalled());
    expect(submit.mock.calls[0][0]).toMatchObject({ clientIds: ['client-1'] });
  });

  it('rejects a whitespace-only client name with a visible message', async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    render(<ClientForm busy={false} submitLabel="حفظ" onSubmit={submit} />);
    fireEvent.change(screen.getByLabelText('الرقم الداخلي'), { target: { value: 'CL-7' } });
    fireEvent.change(screen.getByLabelText('الاسم الكامل'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'حفظ' }));
    expect(await screen.findByText('هذا الحقل مطلوب.')).toBeVisible();
    expect(submit).not.toHaveBeenCalled();
  });

  it('adds selected clients and descriptive lawyers to a power of attorney', async () => {
    vi.mocked(useClientList).mockReturnValue({
      data: [
        {
          id: 'client-1',
          internalNumber: 'CL-1',
          fullName: 'أحمد',
          primaryPhone: null,
          archivedAt: null,
        },
      ],
    } as never);
    const submit = vi.fn().mockResolvedValue(undefined);
    render(<PowerOfAttorneyForm busy={false} onCancel={vi.fn()} onSubmit={submit} />);

    fireEvent.change(screen.getByLabelText('الرقم الداخلي'), { target: { value: 'TA-3' } });
    const issueDate = screen.getByLabelText('تاريخ الإصدار');
    expect(issueDate).toHaveAttribute('type', 'text');
    expect(screen.queryByLabelText('سنة الإصدار')).not.toBeInTheDocument();
    fireEvent.change(issueDate, { target: { value: '2026-10-22' } });
    await selectClient('أحمد');
    fireEvent.click(screen.getByRole('button', { name: 'إضافة محامٍ' }));
    fireEvent.change(screen.getByLabelText('اسم المحامي'), { target: { value: 'محمود' } });
    fireEvent.change(screen.getByLabelText('رقم القيد'), { target: { value: '123' } });

    fireEvent.click(screen.getByRole('button', { name: 'حفظ التوكيل' }));

    await waitFor(() =>
      expect(submit).toHaveBeenCalledWith(
        expect.objectContaining({
          internalSequence: 'TA-3',
          issueDate: '2026-10-22',
          issueYear: 2026,
          clientIds: ['client-1'],
          lawyers: [expect.objectContaining({ fullName: 'محمود', barNumber: '123' })],
        }),
      ),
    );
  });

  it('creates a client from a power of attorney and selects it automatically', async () => {
    vi.mocked(useClientList).mockReturnValue({ data: [] } as never);
    const createClient = vi.fn().mockResolvedValue({ id: 'client-new' });
    vi.mocked(useCreateClient).mockReturnValue({
      mutateAsync: createClient,
      isPending: false,
    } as never);
    const submit = vi.fn().mockResolvedValue(undefined);
    render(<PowerOfAttorneyForm busy={false} onCancel={vi.fn()} onSubmit={submit} />);

    fireEvent.click(screen.getByRole('button', { name: 'إضافة موكل جديد' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('الرقم الداخلي'), {
      target: { value: 'CL-NEW' },
    });
    fireEvent.change(within(dialog).getByLabelText('الاسم الكامل'), {
      target: { value: 'موكل جديد' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'حفظ الموكل وربطه بالتوكيل' }));

    await waitFor(() =>
      expect(createClient).toHaveBeenCalledWith(
        expect.objectContaining({
          internalNumber: 'CL-NEW',
          fullName: 'موكل جديد',
          confirmDuplicate: false,
        }),
      ),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(submit).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('الرقم الداخلي'), { target: { value: 'TA-NEW' } });
    fireEvent.click(screen.getByRole('button', { name: 'حفظ التوكيل' }));

    await waitFor(() =>
      expect(submit).toHaveBeenCalledWith(
        expect.objectContaining({ internalSequence: 'TA-NEW', clientIds: ['client-new'] }),
      ),
    );
  });

  it('requires explicit confirmation before linking a probable duplicate client', async () => {
    vi.mocked(useClientList).mockReturnValue({ data: [] } as never);
    const createClient = vi
      .fn()
      .mockRejectedValueOnce({
        code: 'CLIENT_PROBABLE_DUPLICATE',
        message: 'Possible duplicate',
        details: [{ id: 'client-existing', fullName: 'موكل موجود', primaryPhone: null }],
      })
      .mockResolvedValueOnce({ id: 'client-duplicate' });
    vi.mocked(useCreateClient).mockReturnValue({
      mutateAsync: createClient,
      isPending: false,
    } as never);
    render(<PowerOfAttorneyForm busy={false} onCancel={vi.fn()} onSubmit={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'إضافة موكل جديد' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('الرقم الداخلي'), {
      target: { value: 'CL-DUP' },
    });
    fireEvent.change(within(dialog).getByLabelText('الاسم الكامل'), {
      target: { value: 'موكل موجود' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'حفظ الموكل وربطه بالتوكيل' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('قد يكون هذا الموكل'));
    fireEvent.click(
      screen.getByRole('button', { name: 'إضافة الموكل رغم التشابه وربطه بالتوكيل' }),
    );

    await waitFor(() =>
      expect(createClient).toHaveBeenLastCalledWith(
        expect.objectContaining({ confirmDuplicate: true }),
      ),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
