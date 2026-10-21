import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('@/bridge/commands', async (original) => {
  const module = await original<typeof import('@/bridge/commands')>();
  return { bridge: Object.fromEntries(Object.keys(module.bridge).map((key) => [key, vi.fn()])) };
});
import { bridge } from '@/bridge/commands';
import { fixtures, prepareWorkflowMocks, fictionalFailure } from '@/test/workflow';
import {
  useClient,
  useCreateClient,
  useUpdateClient,
  useArchiveClient,
  useRestoreClient,
} from '@/features/clients/api/clientsApi';
import { useCase, useCaseList } from '@/features/cases/api/casesApi';
import {
  usePowerOfAttorney,
  usePowerOfAttorneyList,
  useSavePowerOfAttorney,
  useArchivePowerOfAttorney,
  useRestorePowerOfAttorney,
} from '@/features/powersOfAttorney/api/powersOfAttorneyApi';
import { useGlobalSearch } from '@/features/search/api/searchApi';

beforeEach(prepareWorkflowMocks);

function observe() {
  // Fresh forever unless the mutation explicitly refreshes it: remounting cannot hide a bug.
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
  });
  const view = renderHook(
    () => ({
      client: useClient(fixtures.client.id),
      case: useCase(fixtures.caseItem.id),
      cases: useCaseList({ clientId: fixtures.client.id }),
      poa: usePowerOfAttorney(fixtures.poa.id),
      clientPoas: usePowerOfAttorneyList({ clientId: fixtures.client.id, includeArchived: true }),
      search: useGlobalSearch('DEMO'),
      create: useCreateClient(),
      update: useUpdateClient(),
      archive: useArchiveClient(),
      restore: useRestoreClient(),
      savePoa: useSavePowerOfAttorney(),
      archivePoa: useArchivePowerOfAttorney(),
      restorePoa: useRestorePowerOfAttorney(),
    }),
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    },
  );
  return view;
}

it.each(['create', 'update', 'archive', 'restore'] as const)(
  'refreshes already mounted dependent labels/search after client %s',
  async (action) => {
    let name = 'DEMO original';
    vi.mocked(bridge.clientGet).mockImplementation(async () => ({
      ...fixtures.client,
      fullName: name,
    }));
    vi.mocked(bridge.caseGet).mockImplementation(async () => ({
      ...fixtures.caseItem,
      clients: fixtures.caseItem.clients.map((c) => ({ ...c, fullName: name })),
    }));
    vi.mocked(bridge.caseList).mockImplementation(async () => [
      { ...fixtures.caseSummary, clientNames: [name] },
    ]);
    vi.mocked(bridge.powerOfAttorneyGet).mockImplementation(async () => ({
      ...fixtures.poa,
      clients: fixtures.poa.clients.map((c) => ({ ...c, fullName: name })),
    }));
    vi.mocked(bridge.searchGlobal).mockImplementation(async () => [
      { entityType: 'CLIENT', entityId: fixtures.client.id, title: name, subtitle: null },
    ]);
    const save = async () => {
      name = 'DEMO changed';
      return { ...fixtures.client, fullName: name };
    };
    vi.mocked(bridge.clientCreate).mockImplementation(save);
    vi.mocked(bridge.clientUpdate).mockImplementation(save);
    vi.mocked(bridge.clientArchive).mockImplementation(save);
    vi.mocked(bridge.clientRestore).mockImplementation(save);
    const { result } = observe();
    await waitFor(() => expect(result.current.search.data?.[0].title).toBe('DEMO original'));
    await waitFor(() =>
      expect(result.current.poa.isSuccess && result.current.case.isSuccess).toBe(true),
    );
    await act(async () => {
      if (action === 'create')
        await result.current.create.mutateAsync({
          internalNumber: 'DEMO new',
          fullName: 'DEMO changed',
          confirmDuplicate: false,
        });
      else if (action === 'update')
        await result.current.update.mutateAsync({
          id: fixtures.client.id,
          internalNumber: fixtures.client.internalNumber,
          fullName: 'DEMO changed',
        });
      else await result.current[action].mutateAsync(fixtures.client.id);
    });
    await waitFor(() => {
      expect(result.current.client.data?.fullName).toBe('DEMO changed');
      expect(result.current.case.data?.clients[0].fullName).toBe('DEMO changed');
      expect(result.current.cases.data?.[0].clientNames).toEqual(['DEMO changed']);
      expect(result.current.poa.data?.clients[0].fullName).toBe('DEMO changed');
      expect(result.current.search.data?.[0].title).toBe('DEMO changed');
    });
  },
);

it.each(['savePoa', 'archivePoa', 'restorePoa'] as const)(
  'refreshes client POA history and case relationships after POA %s without changing case membership',
  async (action) => {
    let changed = false;
    const currentPoa = () => ({
      ...fixtures.poa,
      clients:
        changed && action === 'savePoa'
          ? [{ id: 'new-member', fullName: 'DEMO new member', internalNumber: 'NEW' }]
          : fixtures.poa.clients,
      caseIds: changed && action === 'savePoa' ? [] : [fixtures.caseItem.id],
      archivedAt:
        (action === 'archivePoa' && changed) || (action === 'restorePoa' && !changed)
          ? '2026-10-14T10:00:00Z'
          : null,
    });
    vi.mocked(bridge.caseGet).mockImplementation(async () => ({
      ...fixtures.caseItem,
      clients: fixtures.caseItem.clients.map((c) => ({
        ...c,
        powerOfAttorneyId: changed && action === 'savePoa' ? null : fixtures.poa.id,
        powerOfAttorney:
          changed && action === 'savePoa'
            ? null
            : { ...fixtures.poa, archived: currentPoa().archivedAt !== null },
      })),
    }));
    vi.mocked(bridge.powerOfAttorneyGet).mockImplementation(async () => currentPoa());
    vi.mocked(bridge.powerOfAttorneyList).mockImplementation(async () =>
      changed && action === 'savePoa'
        ? []
        : [
            {
              ...currentPoa(),
              clientNames: [fixtures.client.fullName],
              clientIds: [fixtures.client.id],
            },
          ],
    );
    vi.mocked(bridge.searchGlobal).mockResolvedValue([]);
    const save = async () => {
      changed = true;
      return currentPoa();
    };
    vi.mocked(bridge.powerOfAttorneyUpdate).mockImplementation(save);
    vi.mocked(bridge.powerOfAttorneyArchive).mockImplementation(save);
    vi.mocked(bridge.powerOfAttorneyRestore).mockImplementation(save);
    const { result } = observe();
    await waitFor(() =>
      expect(result.current.case.data?.clients[0].powerOfAttorneyId).toBeTruthy(),
    );
    await waitFor(() => expect(result.current.cases.data).toHaveLength(1));
    await waitFor(() => expect(result.current.clientPoas.data).toHaveLength(1));
    const priorClientReads = vi.mocked(bridge.clientGet).mock.calls.length;
    const priorCaseListReads = vi.mocked(bridge.caseList).mock.calls.length;
    await act(async () => {
      if (action === 'savePoa')
        await result.current.savePoa.mutateAsync({
          id: fixtures.poa.id,
          internalSequence: fixtures.poa.internalSequence,
          clientIds: ['new-member'],
          lawyers: [],
        });
      else await result.current[action].mutateAsync(fixtures.poa.id);
    });
    await waitFor(() => {
      if (action === 'savePoa') {
        expect(result.current.case.data?.clients[0].powerOfAttorneyId).toBeNull();
        expect(result.current.clientPoas.data).toEqual([]);
      } else {
        expect(result.current.case.data?.clients[0].powerOfAttorneyId).toBe(fixtures.poa.id);
        expect(result.current.case.data?.clients[0].powerOfAttorney?.archived).toBe(
          currentPoa().archivedAt !== null,
        );
        expect(result.current.clientPoas.data?.[0].archivedAt).toBe(currentPoa().archivedAt);
      }
      expect(result.current.cases.data).toEqual([fixtures.caseSummary]);
      expect(result.current.case.data?.clients.map((client) => client.clientId)).toEqual(
        fixtures.caseItem.clients.map((client) => client.clientId),
      );
      expect(vi.mocked(bridge.clientGet).mock.calls.length).toBeGreaterThan(priorClientReads);
      expect(vi.mocked(bridge.caseList).mock.calls.length).toBeGreaterThan(priorCaseListReads);
    });
  },
);

it('does not refresh dependencies or replace their cached data after a rejected client or POA edit', async () => {
  vi.mocked(bridge.searchGlobal).mockResolvedValue([]);
  vi.mocked(bridge.clientUpdate).mockRejectedValue(fictionalFailure);
  vi.mocked(bridge.powerOfAttorneyUpdate).mockRejectedValue(fictionalFailure);
  const { result } = observe();
  await waitFor(() =>
    expect(
      result.current.poa.isSuccess &&
        result.current.case.isSuccess &&
        result.current.clientPoas.isSuccess &&
        result.current.search.isSuccess,
    ).toBe(true),
  );
  const cached = () => [
    result.current.client.data,
    result.current.case.data,
    result.current.cases.data,
    result.current.poa.data,
    result.current.clientPoas.data,
    result.current.search.data,
  ];
  const before = cached();
  const reads = [
    bridge.clientGet,
    bridge.caseGet,
    bridge.caseList,
    bridge.powerOfAttorneyGet,
    bridge.powerOfAttorneyList,
    bridge.searchGlobal,
  ];
  const counts = reads.map((read) => vi.mocked(read).mock.calls.length);
  await act(async () => {
    await expect(
      result.current.update.mutateAsync({
        id: fixtures.client.id,
        internalNumber: fixtures.client.internalNumber,
        fullName: 'DEMO refused',
      }),
    ).rejects.toEqual(fictionalFailure);
    await expect(
      result.current.savePoa.mutateAsync({
        id: fixtures.poa.id,
        internalSequence: 'DEMO',
        clientIds: [],
        lawyers: [],
      }),
    ).rejects.toEqual(fictionalFailure);
  });
  cached().forEach((data, index) => expect(data).toBe(before[index]));
  reads.forEach((read, index) => expect(vi.mocked(read).mock.calls.length).toBe(counts[index]));
});
