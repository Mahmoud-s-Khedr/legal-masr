import { useCallback, useRef } from 'react';

/**
 * Lets an action start once until it reports that it has settled.
 *
 * A mutation's `isPending` only changes after a re-render, so two clicks in the
 * same tick can both start it. A ref flips immediately, which closes that gap.
 * `start` must call `settled` when the work finishes, whether it succeeded or not.
 */
export function useSingleFlight() {
  const busy = useRef(false);
  return useCallback((start: (settled: () => void) => void) => {
    if (busy.current) return;
    busy.current = true;
    try {
      start(() => {
        busy.current = false;
      });
    } catch (error) {
      busy.current = false;
      throw error;
    }
  }, []);
}
