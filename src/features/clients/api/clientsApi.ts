import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bridge } from '../../../bridge/commands';
import type { ClientCreateInput, ClientListInput, ClientUpdateInput } from '../../../bridge/types';
import { queryKeys } from '../../../lib/queryKeys';

export const useClientList = (input: ClientListInput) =>
  useQuery({ queryKey: queryKeys.clients.list(input), queryFn: () => bridge.clientList(input) });

export const useClient = (id: string) =>
  useQuery({ queryKey: queryKeys.clients.detail(id), queryFn: () => bridge.clientGet(id) });

export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ClientCreateInput) => bridge.clientCreate(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.clients.all }),
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ClientUpdateInput) => bridge.clientUpdate(input),
    onSuccess: (client) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
      queryClient.setQueryData(queryKeys.clients.detail(client.id), client);
      queryClient.invalidateQueries({ queryKey: queryKeys.clients.detail(client.id) });
    },
  });
}

export function useArchiveClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => bridge.clientArchive(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.clients.all }),
  });
}

export function useRestoreClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => bridge.clientRestore(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.clients.all }),
  });
}
