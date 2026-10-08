import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '../ui/alert-dialog';
import { type ReactNode, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog as DialogRoot, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { cn } from '@/lib/utils';

export function FormDialog({
  open,
  onOpenChange,
  title,
  children,
  labelledBy,
  size = 'lg',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  labelledBy?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const { t } = useTranslation();
  const generatedId = useId();
  const titleId = labelledBy ?? generatedId;
  // A stray click beside the dialog never closes it. Escape closes it straight away
  // only while nothing has been typed; otherwise the lawyer confirms losing the draft.
  const [dirty, setDirty] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [openedAs, setOpenedAs] = useState(open);
  if (open !== openedAs) {
    setOpenedAs(open);
    if (open) {
      setDirty(false);
      setConfirmingDiscard(false);
    }
  }
  return (
    <DialogRoot
      open={open}
      disablePointerDismissal
      onOpenChange={(next, details) => {
        if (!next && details.reason === 'escape-key') {
          if (confirmingDiscard) return setConfirmingDiscard(false);
          if (dirty) return setConfirmingDiscard(true);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent
        showCloseButton={false}
        className={cn(
          'form-dialog max-h-[90dvh] overflow-y-auto',
          size === 'lg' ? 'sm:max-w-3xl' : size === 'md' ? 'sm:max-w-xl' : 'sm:max-w-sm',
        )}
        aria-labelledby={titleId}
        onInputCapture={() => setDirty(true)}
      >
        <DialogHeader>
          <DialogTitle id={titleId}>{title}</DialogTitle>
        </DialogHeader>
        {confirmingDiscard && (
          <div
            role="alertdialog"
            aria-label={t('forms.discardTitle')}
            className="discard-confirm sticky top-0 z-10"
          >
            <p>
              <strong>{t('forms.discardTitle')}</strong> {t('forms.discardDescription')}
            </p>
            <div className="flex gap-2">
              <Button type="button" autoFocus onClick={() => setConfirmingDiscard(false)}>
                {t('forms.keepEditing')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setConfirmingDiscard(false);
                  onOpenChange(false);
                }}
              >
                {t('forms.discard')}
              </Button>
            </div>
          </div>
        )}
        {children}
      </DialogContent>
    </DialogRoot>
  );
}

export function FormDialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="form-dialog-footer"
      className={cn(
        'sticky bottom-0 -mx-4 mt-5 flex justify-start gap-2.5 border-t bg-popover px-4 pt-3 pb-1',
        className,
      )}
      {...props}
    />
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
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {/* Same order as every form: the action first, then «إلغاء». */}
        <AlertDialogFooter className="sm:justify-start">
          <Button
            type="button"
            variant={destructive ? 'destructive' : 'default'}
            disabled={pending}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
