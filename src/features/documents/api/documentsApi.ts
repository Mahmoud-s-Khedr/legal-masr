import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bridge } from '../../../bridge/commands';
import type {
  AttachmentInput,
  AttachmentListInput,
  AttachmentUpdateInput,
} from '../../../bridge/types';
export const useDocuments = (input: AttachmentListInput = {}) =>
  useQuery({ queryKey: ['attachments', input], queryFn: () => bridge.attachmentList(input) });
export const useAddDocument = () => {
  const q = useQueryClient();
  return useMutation({
    mutationFn: (input: AttachmentInput) => bridge.attachmentAdd(input),
    onSuccess: () => q.invalidateQueries({ queryKey: ['attachments'] }),
  });
};
export const useRemoveDocument = () => {
  const q = useQueryClient();
  return useMutation({
    mutationFn: bridge.attachmentRemove,
    onSuccess: () => q.invalidateQueries({ queryKey: ['attachments'] }),
  });
};
export const useUpdateDocument = () => {
  const q = useQueryClient();
  return useMutation({
    mutationFn: (input: AttachmentUpdateInput) => bridge.attachmentUpdate(input),
    onSuccess: () => q.invalidateQueries({ queryKey: ['attachments'] }),
  });
};
export const useOpenDocument = () => useMutation({ mutationFn: bridge.attachmentOpen });
export const useRevealDocument = () => useMutation({ mutationFn: bridge.attachmentReveal });
