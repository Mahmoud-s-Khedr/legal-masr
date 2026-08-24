import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bridge } from '../../../bridge/commands';
import type { ClientCreateInput, ClientListInput, ClientUpdateInput } from '../../../bridge/types';

const CLIENTS_KEY = ['clients'];
const clientKey = (id: string) => ['client', id];

export const useClientList = (input: ClientListInput) =>
  useQuery({ queryKey: [...CLIENTS_KEY, input], queryFn: () => bridge.clientList(input) });

export const useClient = (id: string) =>
  useQuery({ queryKey: clientKey(id), queryFn: () => bridge.clientGet(id) });

export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ClientCreateInput) => bridge.clientCreate(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLIENTS_KEY }),
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ClientUpdateInput) => bridge.clientUpdate(input),
    onSuccess: (client) => {
      queryClient.invalidateQueries({ queryKey: CLIENTS_KEY });
      queryClient.setQueryData(clientKey(client.id), client);
    },
  });
}

export function useArchiveClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => bridge.clientArchive(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLIENTS_KEY }),
  });
}

export function useRestoreClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => bridge.clientRestore(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLIENTS_KEY }),
  });
}
