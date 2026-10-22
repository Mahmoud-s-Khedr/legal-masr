import { bridge } from '@/bridge/commands';

export const deletionApi = {
  preview: bridge.deletionPreview,
  commit: bridge.deletionCommit,
  retryCleanup: bridge.deletionRetryCleanup,
};
