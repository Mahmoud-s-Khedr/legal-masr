import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bridge } from '../../../bridge/commands';
import type { DocumentReferenceInput, DocumentUpdateInput } from '../../../bridge/types';
export const useDocuments = () =>
  useQuery({ queryKey: ['documents'], queryFn: () => bridge.documentList() });
export const useAddDocument = () => {
  const q = useQueryClient();
  return useMutation({
    mutationFn: ({ input, managed }: { input: DocumentReferenceInput; managed: boolean }) =>
      managed ? bridge.documentImportManaged(input) : bridge.documentAddReference(input),
    onSuccess: () => q.invalidateQueries({ queryKey: ['documents'] }),
  });
};
export const useRemoveDocument = () => {
  const q = useQueryClient();
  return useMutation({
    mutationFn: bridge.documentRemove,
    onSuccess: () => q.invalidateQueries({ queryKey: ['documents'] }),
  });
};
export const useUpdateDocument = () => {
  const q = useQueryClient();
  return useMutation({
    mutationFn: (input: DocumentUpdateInput) => bridge.documentUpdate(input),
    onSuccess: () => q.invalidateQueries({ queryKey: ['documents'] }),
  });
};
export const useCheckDocumentMissing = () => {
  const q = useQueryClient();
  return useMutation({
    mutationFn: bridge.documentCheckMissing,
    onSuccess: () => q.invalidateQueries({ queryKey: ['documents'] }),
  });
};
