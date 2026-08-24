import { useMutation } from '@tanstack/react-query';
import { bridge } from '../../../bridge/commands';

export const useCreateBackup = () => useMutation({ mutationFn: bridge.createBackup });

export const useValidateBackup = () => useMutation({ mutationFn: bridge.validateBackup });

export const useRestoreBackup = () => useMutation({ mutationFn: bridge.restoreBackup });
