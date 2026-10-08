import { useRef, type ComponentProps } from 'react';
/** Isolate nested portal submissions and allow one in-flight save per draft. */
export function DraftForm({ onSubmit, ...props }: ComponentProps<'form'>) {
  const submitting = useRef(false);
  return (
    <form
      {...props}
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (submitting.current) return;
        submitting.current = true;
        try {
          await onSubmit?.(event);
        } catch {
          // Each form renders its mutation error while keeping the draft mounted.
        } finally {
          submitting.current = false;
        }
      }}
    />
  );
}
