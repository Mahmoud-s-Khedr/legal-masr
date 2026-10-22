import { useMutation } from '@tanstack/react-query';
import { bridge } from '@/bridge/commands';
import { backupStamp } from '@/lib/backupStamp';

export const useCreateExport = (caseId?: string) =>
  useMutation({
    mutationFn: () => {
      const stamp = backupStamp();
      return bridge.createExport(caseId, `${stamp.slice(0, 13)}${stamp.slice(14, 16)}`);
    },
    gcTime: 0,
  });

export const useRevealExport = () =>
  useMutation({ mutationFn: (token: string) => bridge.revealExport(token), gcTime: 0 });
