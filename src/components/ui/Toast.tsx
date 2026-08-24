import { useEffect } from 'react';

export function Toast({
  message,
  kind = 'success',
  onDismiss,
}: {
  message: string;
  kind?: 'success' | 'error' | 'info';
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 5_000);
    return () => window.clearTimeout(timer);
  }, [onDismiss]);
  return (
    <div className={`toast toast-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <span>{message}</span>
      <button type="button" className="text-button" onClick={onDismiss} aria-label="إغلاق">
        ×
      </button>
    </div>
  );
}
