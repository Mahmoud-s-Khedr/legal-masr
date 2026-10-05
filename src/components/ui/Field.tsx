import { cloneElement, type ReactElement, type ReactNode, useId } from 'react';
import { cn } from '../../lib/utils';

type ControlProps = {
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  'aria-required'?: boolean;
};

/**
 * Label, control, hint and error for one form field. The required mark is drawn
 * by CSS so the accessible label stays the plain field name; the error is tied
 * to the control with aria-describedby and announced when it appears.
 */
export function Field({
  label,
  required,
  hint,
  error,
  className,
  children,
}: {
  label: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: ReactElement<ControlProps>;
}) {
  const id = useId();
  const controlId = children.props.id ?? `${id}-control`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy =
    [children.props['aria-describedby'], hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cn('field', required && 'is-required', error && 'has-error', className)}>
      <label htmlFor={controlId}>{label}</label>
      {cloneElement(children, {
        id: controlId,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
        'aria-required': required || undefined,
      })}
      {hint && !error && (
        <span className="field-hint" id={hintId}>
          {hint}
        </span>
      )}
      {error && (
        <span className="field-error" id={errorId} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
