import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import { type ReactNode, useCallback, useEffect, useId, useRef } from 'react';
import { Button } from './button';

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  labelledBy?: string;
};

/** Base UI supplies Escape dismissal, focus containment, and focus restoration. */
export function Dialog({ open, onOpenChange, title, children, labelledBy }: DialogProps) {
  const generatedTitleId = useId();
  const titleId = labelledBy ?? generatedTitleId;
  const returnFocusRef = useRef<HTMLElement | null>(null);

  // Keep the callback stable while open: rerendering errors or query data must
  // not reset the lawyer's focus while editing a draft.
  const focusInitialControl = useCallback(
    (node: HTMLDivElement | null) => {
      if (!open) return;
      node
        ?.querySelector<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        )
        ?.focus();
    },
    [open],
  );

  useEffect(() => {
    if (open) {
      returnFocusRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      return;
    }
    returnFocusRef.current?.focus();
  }, [open]);

  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="dialog-backdrop" />
        <BaseDialog.Viewport className="dialog-viewport">
          <BaseDialog.Popup
            ref={focusInitialControl}
            className="dialog-surface"
            aria-labelledby={titleId}
            initialFocus={false}
          >
            <BaseDialog.Title id={titleId}>{title}</BaseDialog.Title>
            {children}
          </BaseDialog.Popup>
        </BaseDialog.Viewport>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  destructive = false,
  pending = false,
  error,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  destructive?: boolean;
  pending?: boolean;
  error?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title}>
      <p className="dialog-description">{description}</p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="dialog-actions">
        <Button
          type="button"
          variant="secondary"
          className="secondary-button"
          disabled={pending}
          onClick={() => onOpenChange(false)}
        >
          {cancelLabel}
        </Button>
        <Button
          type="button"
          variant={destructive ? 'destructive' : 'default'}
          className={destructive ? 'danger-button-solid' : undefined}
          disabled={pending}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
