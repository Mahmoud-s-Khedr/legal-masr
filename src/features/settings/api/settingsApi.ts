import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bridge } from '../../../bridge/commands';
import type { Settings } from '../../../bridge/types';
import { useAppStatus } from '../../onboarding/api/onboardingApi';

const SETTINGS_QUERY_KEY = ['settings'];

// settings_get requires the vault to be unlocked (it errors with APP_LOCKED
// otherwise). Gating on status.unlocked avoids firing it before that point:
// with retry disabled globally, a query fired while still locked settles into
// a permanent error and nothing was refetching it after unlock happened, so
// callers (like the backup step) could see an undefined destination forever.
export const useSettings = () => {
  const { data: status } = useAppStatus();
  return useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: bridge.settings,
    enabled: !!status?.unlocked,
  });
};

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (
      settings: Pick<Settings, 'language' | 'theme' | 'lockTimeoutMinutes'> & {
        backupDirectory: string;
      },
    ) => bridge.updateSettings(settings),
    onSuccess: (settings) => queryClient.setQueryData(SETTINGS_QUERY_KEY, settings),
  });
}
