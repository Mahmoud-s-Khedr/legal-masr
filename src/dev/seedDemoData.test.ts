import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../bridge/commands', () => ({
  bridge: {
    clientList: vi.fn(),
    clientCreate: vi.fn(),
    powerOfAttorneyCreate: vi.fn(),
    caseCreate: vi.fn(),
    caseAddOpponent: vi.fn(),
    hearingCreate: vi.fn(),
    taskCreate: vi.fn(),
    taskComplete: vi.fn(),
    feeAgreementSave: vi.fn(),
    paymentSave: vi.fn(),
    expenseSave: vi.fn(),
  },
}));

import { bridge } from '../bridge/commands';
import { demoSeedEnabledFor, seedDemoData, seedDemoDataOnce } from './seedDemoData';

describe('development demo seeder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(bridge.clientList).mockResolvedValue([]);
    vi.mocked(bridge.clientCreate)
      .mockResolvedValueOnce({ id: 'client-primary' } as never)
      .mockResolvedValueOnce({ id: 'client-co-client' } as never)
      .mockResolvedValueOnce({ id: 'client-company' } as never);
    vi.mocked(bridge.powerOfAttorneyCreate).mockResolvedValue({ id: 'poa-1' } as never);
    vi.mocked(bridge.caseCreate).mockResolvedValue({ id: 'case-1' } as never);
    vi.mocked(bridge.caseAddOpponent).mockResolvedValue({} as never);
    vi.mocked(bridge.hearingCreate).mockResolvedValue({} as never);
    vi.mocked(bridge.taskCreate).mockResolvedValue({ id: 'task-1' } as never);
    vi.mocked(bridge.taskComplete).mockResolvedValue({} as never);
    vi.mocked(bridge.feeAgreementSave).mockResolvedValue({} as never);
    vi.mocked(bridge.paymentSave).mockResolvedValue({} as never);
    vi.mocked(bridge.expenseSave).mockResolvedValue({} as never);
  });

  it('creates a representative local vault through typed bridge APIs', async () => {
    await expect(seedDemoData()).resolves.toBe('seeded');

    expect(bridge.clientList).toHaveBeenCalledWith({ includeArchived: true });
    expect(bridge.clientCreate).toHaveBeenCalledTimes(3);
    expect(bridge.powerOfAttorneyCreate).toHaveBeenCalledWith(
      expect.objectContaining({ clientIds: ['client-primary'] }),
    );
    expect(bridge.caseCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        clients: [
          expect.objectContaining({ clientId: 'client-primary', powerOfAttorneyId: 'poa-1' }),
          expect.objectContaining({ clientId: 'client-co-client' }),
        ],
      }),
    );
    expect(bridge.hearingCreate).toHaveBeenCalledTimes(2);
    expect(bridge.taskCreate).toHaveBeenCalledTimes(3);
    expect(bridge.taskComplete).toHaveBeenCalledWith('task-1');
    expect(bridge.feeAgreementSave).toHaveBeenCalledWith(
      expect.objectContaining({ caseId: 'case-1', amountMinor: 1_200_000 }),
    );
    expect(bridge.paymentSave).toHaveBeenCalledWith(
      expect.objectContaining({ caseId: 'case-1', payerClientId: 'client-primary' }),
    );
    expect(bridge.expenseSave).toHaveBeenCalledWith(
      expect.objectContaining({ caseId: 'case-1', expenseType: 'COURT_FEE' }),
    );

    const datedInputs = [
      vi.mocked(bridge.powerOfAttorneyCreate).mock.calls[0][0].issueDate,
      vi.mocked(bridge.caseCreate).mock.calls[0][0].filedOn,
      ...vi.mocked(bridge.hearingCreate).mock.calls.map(([input]) => input.hearingDate),
      ...vi.mocked(bridge.taskCreate).mock.calls.map(([input]) => input.dueDate),
      vi.mocked(bridge.feeAgreementSave).mock.calls[0][0].agreementDate,
      vi.mocked(bridge.paymentSave).mock.calls[0][0].paymentDate,
      vi.mocked(bridge.expenseSave).mock.calls[0][0].expenseDate,
    ];
    for (const date of datedInputs) expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('is impossible to enable outside an explicit development build', () => {
    expect(demoSeedEnabledFor(false, 'true')).toBe(false);
    expect(demoSeedEnabledFor(true, undefined)).toBe(false);
    expect(demoSeedEnabledFor(true, 'false')).toBe(false);
    expect(demoSeedEnabledFor(true, 'true')).toBe(true);
  });

  it('refuses to add demo data to a non-empty vault', async () => {
    vi.mocked(bridge.clientList).mockResolvedValue([{ id: 'real-client' }] as never);

    await expect(seedDemoData()).resolves.toBe('skipped_nonempty_vault');

    expect(bridge.clientCreate).not.toHaveBeenCalled();
    expect(bridge.caseCreate).not.toHaveBeenCalled();
  });

  it('returns an API failure to the caller instead of masking a partial seed', async () => {
    vi.mocked(bridge.clientCreate).mockReset().mockRejectedValueOnce(new Error('command failed'));

    await expect(seedDemoData()).rejects.toThrow('command failed');

    expect(bridge.powerOfAttorneyCreate).not.toHaveBeenCalled();
  });

  it('stops before dependent case data when power-of-attorney creation fails', async () => {
    vi.mocked(bridge.powerOfAttorneyCreate).mockRejectedValueOnce(new Error('POA command failed'));

    await expect(seedDemoData()).rejects.toThrow('POA command failed');

    expect(bridge.caseCreate).not.toHaveBeenCalled();
    expect(bridge.hearingCreate).not.toHaveBeenCalled();
    expect(bridge.paymentSave).not.toHaveBeenCalled();
  });

  it('shares one in-flight seed across duplicate development mounts', async () => {
    const first = seedDemoDataOnce();
    const second = seedDemoDataOnce();

    expect(second).toBe(first);
    await expect(first).resolves.toBe('seeded');
    expect(bridge.clientCreate).toHaveBeenCalledTimes(3);
  });
});
