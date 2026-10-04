import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bridge } from '../../../bridge/commands';
import type { LawyerProfile, Settings, SettingsUpdateInput } from '../../../bridge/types';
import { useAppStatus } from '../../onboarding/api/onboardingApi';
import { queryKeys } from '../../../lib/queryKeys';

const SETTINGS_QUERY_KEY = queryKeys.settings;

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
    mutationFn: (settings: SettingsUpdateInput) => bridge.updateSettings(settings),
    onMutate: (next) => {
      const previous = queryClient.getQueryData<Settings>(SETTINGS_QUERY_KEY);
      queryClient.setQueryData(SETTINGS_QUERY_KEY, (current: Settings | undefined) => ({
        ...current,
        ...next,
        autostartEnabled: current?.autostartEnabled ?? false,
        usageCountersEnabled: current?.usageCountersEnabled ?? false,
      }));
      return { previous };
    },
    onError: (_error, _next, context) => queryClient.setQueryData(SETTINGS_QUERY_KEY, context?.previous),
    onSuccess: (settings) => queryClient.setQueryData(SETTINGS_QUERY_KEY, settings),
  });
}

export const useProfile = () => {
  const { data: status } = useAppStatus();
  return useQuery({
    queryKey: queryKeys.profile,
    queryFn: bridge.profile,
    enabled: !!status?.unlocked,
  });
};
export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (profile: LawyerProfile) => bridge.updateProfile(profile),
    onSuccess: (profile) => queryClient.setQueryData(queryKeys.profile, profile),
  });
};
export const useChangePassword = () =>
  useMutation({
    mutationFn: ({
      currentPassword,
      newPassword,
    }: {
      currentPassword: string;
      newPassword: string;
    }) => bridge.changePassword(currentPassword, newPassword),
  });
export const useSetAutostart = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: bridge.setAutostart,
    onSuccess: (settings) => queryClient.setQueryData(SETTINGS_QUERY_KEY, settings),
  });
};
export const useSetUsageCounters = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: bridge.setUsageCounters,
    onSuccess: (settings) => queryClient.setQueryData(SETTINGS_QUERY_KEY, settings),
  });
};
