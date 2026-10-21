import { bridge } from '@/bridge/commands';

// Credentials go directly to IPC, never into React Query's mutation cache.
export const deletionApi = {
  preview: bridge.deletionPreview,
  commit: bridge.deletionCommit,
  retryCleanup: bridge.deletionRetryCleanup,
};
