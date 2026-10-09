import { useRef, useState, type ComponentProps } from 'react';
import type { Control, FieldValues } from 'react-hook-form';
import { DraftObserver } from './DraftProtection';
/** Isolate nested portal submissions and allow one in-flight save per draft. */
export function DraftForm<T extends FieldValues>({
  onSubmit,
  control,
  draftExtra,
  children,
  ...props
}: ComponentProps<'form'> & { control?: Control<T>; draftExtra?: unknown }) {
  const submitting = useRef(false);
  const [pending, setPending] = useState(false);
  return (
    <form
      {...props}
      noValidate
      aria-busy={pending || props['aria-busy']}
      onSubmit={async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (submitting.current) return;
        submitting.current = true;
        setPending(true);
        try {
          await onSubmit?.(event);
        } catch {
          // Each form renders its mutation error while keeping the draft mounted.
        } finally {
          submitting.current = false;
          setPending(false);
        }
      }}
    >
      {control && <DraftObserver control={control} extra={draftExtra} />}
      {children}
    </form>
  );
}
