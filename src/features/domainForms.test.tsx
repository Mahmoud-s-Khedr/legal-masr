import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./clients/api/clientsApi', () => ({
  useClientList: vi.fn(),
}));

import '../i18n';
import { useClientList } from './clients/api/clientsApi';
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

  it('includes checked clients when creating a case', async () => {
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
    fireEvent.click(screen.getByRole('checkbox', { name: 'أحمد' }));
    fireEvent.click(screen.getByRole('button', { name: 'حفظ' }));

    await waitFor(() => expect(submit).toHaveBeenCalled());
    expect(submit.mock.calls[0][0]).toMatchObject({ clientIds: ['client-1'] });
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
    fireEvent.click(screen.getByRole('checkbox', { name: /أحمد/ }));
    fireEvent.change(screen.getByLabelText('الاسم'), { target: { value: 'محمود' } });
    fireEvent.change(screen.getByLabelText('رقم القيد'), { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: 'إضافة محامٍ' }));
    fireEvent.click(screen.getByRole('button', { name: 'حفظ التوكيل' }));

    await waitFor(() =>
      expect(submit).toHaveBeenCalledWith(
        expect.objectContaining({
          internalSequence: 'TA-3',
          clientIds: ['client-1'],
          lawyers: [expect.objectContaining({ fullName: 'محمود', barNumber: '123' })],
        }),
      ),
    );
  });
});
