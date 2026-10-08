import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { copyText } from '@/lib/clipboard';
import { Icon } from '../layout/Icon';
import { Button } from '../ui/button';

/** A small «نسخ» button that confirms with «تم النسخ» for a moment. */
export function CopyButton({
  text,
  label,
  className,
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  useEffect(() => {
    if (state === 'idle') return;
    const timer = window.setTimeout(() => setState('idle'), 2500);
    return () => window.clearTimeout(timer);
  }, [state]);
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={className}
      aria-label={label ?? t('common.copy')}
      onClick={async () => setState((await copyText(text)) ? 'copied' : 'failed')}
    >
      <Icon name={state === 'copied' ? 'check' : 'copy'} size={16} />
      <span aria-live="polite">
        {state === 'copied'
          ? t('common.copied')
          : state === 'failed'
            ? t('common.copyFailed')
            : t('common.copy')}
      </span>
    </Button>
  );
}
