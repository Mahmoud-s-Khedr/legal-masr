import { createContext, useContext, useEffect, useId, useRef } from 'react';
import { useWatch, useFormState, type Control, type FieldValues } from 'react-hook-form';

export const DraftProtection = createContext<((id: string, dirty: boolean | null) => void) | null>(
  null,
);

/** Register a draft held in React state, such as an owner choice. */
export function DraftValueObserver({ value }: { value: unknown }) {
  const report = useContext(DraftProtection);
  const id = useId();
  const snapshot = JSON.stringify(value);
  const initial = useRef(snapshot);
  useEffect(() => {
    report?.(id, snapshot !== initial.current);
  }, [id, report, snapshot]);
  useEffect(() => () => report?.(id, null), [id, report]);
  return null;
}

/** Compare actual values, including portal controls; reverting edits makes a draft clean. */
export function DraftObserver<T extends FieldValues>({
  control,
  extra,
}: {
  control: Control<T>;
  extra?: unknown;
}) {
  const report = useContext(DraftProtection);
  const id = useId();
  const values = useWatch({ control });
  const { isDirty } = useFormState({ control });
  const snapshot = JSON.stringify(values);
  const initialExtra = useRef(JSON.stringify(extra));
  const initial = useRef(snapshot);
  useEffect(() => {
    if (!isDirty) initial.current = snapshot;
    report?.(
      id,
      (isDirty && snapshot !== initial.current) || JSON.stringify(extra) !== initialExtra.current,
    );
  }, [id, report, snapshot, isDirty, extra]);
  useEffect(() => () => report?.(id, null), [id, report]);
  return null;
}
