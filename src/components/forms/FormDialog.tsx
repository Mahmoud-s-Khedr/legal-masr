import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '../ui/alert-dialog';
import { type ReactNode, useCallback, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog as DialogRoot, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { cn } from '@/lib/utils';
import { DraftProtection } from './DraftProtection';

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
  const drafts = useRef(new Map<string, boolean>());
  const content = useRef<HTMLDivElement>(null);
  const initial = useRef<string | null>(null);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const report = useCallback((id: string, dirty: boolean | null) => {
    if (dirty === null) drafts.current.delete(id);
    else drafts.current.set(id, dirty);
  }, []);
  const fields = useCallback(
    () =>
      JSON.stringify(
        Array.from(content.current?.querySelectorAll('input, textarea, select') ?? []).map(
          (field) => {
            const input = field as HTMLInputElement;
            return [
              input.name,
              input.type === 'checkbox' || input.type === 'radio' ? input.checked : input.value,
            ];
          },
        ),
      ),
    [],
  );
  const attachContent = useCallback(
    (node: HTMLDivElement | null) => {
      content.current = node;
      initial.current = node ? fields() : null;
    },
    [fields],
  );
  const requestClose = () => {
    if (content.current?.querySelector('[aria-busy="true"]')) return;
    const dirty =
      drafts.current.size > 0
        ? Array.from(drafts.current.values()).some(Boolean)
        : initial.current !== null && fields() !== initial.current;
    if (dirty) setConfirmingDiscard(true);
    else onOpenChange(false);
  };
  if (!open) return null;
  return (
    <DialogRoot
      open={open}
      disablePointerDismissal
      onOpenChange={(next, details) => {
        if (!next && (details.reason === 'escape-key' || details.reason === 'close-press')) {
          requestClose();
          return;
        }
        onOpenChange(next);
      }}
    >
      <DialogContent
        ref={attachContent}
        showCloseButton={false}
        className={cn(
          'form-dialog max-h-[90dvh] overflow-y-auto',
          size === 'lg' ? 'sm:max-w-3xl' : size === 'md' ? 'sm:max-w-xl' : 'sm:max-w-sm',
        )}
        aria-labelledby={titleId}
        onClickCapture={(event) => {
          if (
            event.currentTarget.contains(event.target as Node) &&
            (event.target as HTMLElement).closest('[data-draft-cancel]')
          ) {
            event.preventDefault();
            event.stopPropagation();
            requestClose();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle id={titleId} className="text-lg leading-snug font-bold">
            {title}
          </DialogTitle>
        </DialogHeader>
        <DraftProtection.Provider value={report}>{children}</DraftProtection.Provider>
        <AlertDialog open={confirmingDiscard} onOpenChange={setConfirmingDiscard}>
          <AlertDialogContent initialFocus>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('forms.discardTitle')}</AlertDialogTitle>
              <AlertDialogDescription>{t('forms.discardDescription')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="sm:justify-start">
              <Button type="button" onClick={() => setConfirmingDiscard(false)}>
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
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </DialogRoot>
  );
}

export function FormDialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="form-dialog-footer"
      className={cn(
        'sticky bottom-0 -mx-4 mt-5 flex justify-start gap-2.5 border-t border-(--line) bg-popover px-4 pt-3 pb-1',
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
