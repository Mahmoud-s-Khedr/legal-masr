import { useEffect } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useQueryClient } from '@tanstack/react-query';
import { invalidateSession } from '../bridge/invoke';
import { clearVaultCache } from './vaultCache';

/** Native tray locks must reject late IPC and clear the same caches as UI locks. */
export function useNativeVaultLock(onLocked: () => void) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    let stop: (() => void) | undefined;
    void listen('vault-locked', () => {
      if (disposed) return;
      invalidateSession();
      onLocked();
      void clearVaultCache(queryClient).catch(() => {
        // clearVaultCache has already installed a locked status. A refused
        // status refresh must never restore sensitive renderer state.
      });
    })
      .then((unlisten) => {
        if (disposed) unlisten();
        else stop = unlisten;
      })
      .catch(() => {
        // No renderer session has changed if event registration fails.
      });
    return () => {
      disposed = true;
      stop?.();
    };
  }, [queryClient, onLocked]);
}
