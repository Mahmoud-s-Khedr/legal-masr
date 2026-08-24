import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bridge } from '../../../bridge/commands';
import type {
  AttachmentInput,
  AttachmentListInput,
  AttachmentUpdateInput,
} from '../../../bridge/types';
import { queryInvalidation } from '../../../lib/queryInvalidation';
import { queryKeys } from '../../../lib/queryKeys';
export const useAttachments = (input: AttachmentListInput = {}) =>
  useQuery({
    queryKey: queryKeys.attachments.list(input),
    queryFn: () => bridge.attachmentList(input),
  });
export const useAddAttachment = () => {
  const q = useQueryClient();
  return useMutation({
    mutationFn: (input: AttachmentInput) => bridge.attachmentAdd(input),
    onSuccess: (attachment) => queryInvalidation.attachment(q, attachment),
  });
};
export const useRemoveAttachment = () => {
  const q = useQueryClient();
  return useMutation({
    mutationFn: (attachment: {
      id: string;
      caseId: string | null;
      clientId: string | null;
      powerOfAttorneyId: string | null;
    }) => bridge.attachmentRemove(attachment.id),
    onSuccess: (_result, attachment) => queryInvalidation.attachment(q, attachment),
  });
};
export const useUpdateAttachment = () => {
  const q = useQueryClient();
  return useMutation({
    mutationFn: (input: AttachmentUpdateInput) => bridge.attachmentUpdate(input),
    onSuccess: (attachment) => queryInvalidation.attachment(q, attachment),
  });
};
export const useOpenAttachment = () => useMutation({ mutationFn: bridge.attachmentOpen });
export const useRevealAttachment = () => useMutation({ mutationFn: bridge.attachmentReveal });
