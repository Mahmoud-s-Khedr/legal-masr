import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./clients/api/clientsApi', () => ({
  useClientList: vi.fn(),
  useCreateClient: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}));

import '../i18n';
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
    );

    fireEvent.change(screen.getByLabelText('رقم القضية'), { target: { value: 'CA-5' } });
    const officialNumber = screen.getByLabelText('رقم القضية الرسمي');
    expect(officialNumber).toHaveAttribute('dir', 'ltr');
    fireEvent.change(officialNumber, { target: { value: '2026/45' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'أحمد' }));
    fireEvent.click(screen.getByRole('button', { name: 'حفظ' }));

    await waitFor(() => expect(submit).toHaveBeenCalled());
    expect(submit.mock.calls[0][0]).toMatchObject({
      officialNumber: '2026/45',
      clientIds: ['client-1'],
    });
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
    fireEvent.click(screen.getByRole('checkbox', { name: /أحمد/ }));
    fireEvent.change(screen.getByLabelText('الاسم'), { target: { value: 'محمود' } });
    fireEvent.change(screen.getByLabelText('رقم القيد'), { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: 'إضافة محامٍ' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'إنشاء الموكل وربطه بالتوكيل' }));

    await waitFor(() =>
      expect(createClient).toHaveBeenLastCalledWith(
        expect.objectContaining({ confirmDuplicate: true }),
      ),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
