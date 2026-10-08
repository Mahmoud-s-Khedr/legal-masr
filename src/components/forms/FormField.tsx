import { Field as FieldRoot, FieldLabel, FieldDescription, FieldError } from '../ui/field';
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
  const accessibility = {
    id: controlId,
    'aria-describedby': describedBy,
    'aria-invalid': error ? true : undefined,
    'aria-required': required || undefined,
  };
  const renderControl = (
    children.props as { render?: (args: unknown) => ReactElement<ControlProps> }
  ).render;
  const control = renderControl
    ? cloneElement(
        children as ReactElement<{ render: (args: unknown) => ReactElement<ControlProps> }>,
        { render: (args) => cloneElement(renderControl(args), accessibility) },
      )
    : cloneElement(children, accessibility);
  return (
    <FieldRoot data-invalid={!!error} className={cn(required && 'is-required', className)}>
      <FieldLabel htmlFor={controlId}>{label}</FieldLabel>
      {control}
      {hint && !error && <FieldDescription id={hintId}>{hint}</FieldDescription>}
      {error && (
        <FieldError id={errorId} role="alert">
          {error}
        </FieldError>
      )}
    </FieldRoot>
  );
}
