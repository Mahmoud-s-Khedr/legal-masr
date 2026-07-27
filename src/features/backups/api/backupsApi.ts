import { useMutation } from "@tanstack/react-query";
import { bridge } from "../../../bridge/commands";

export const useCreateBackup = () => useMutation({ mutationFn: (destination: string) => bridge.createBackup(destination) });

export const useValidateBackup = () => useMutation({ mutationFn: (path: string) => bridge.validateBackup(path) });

export const useRestoreBackup = () => useMutation({ mutationFn: (path: string) => bridge.restoreBackup(path) });
