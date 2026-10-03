import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox';
import { IconCheck } from '@tabler/icons-react';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

type CheckboxProps = {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  name?: string;
  value?: string;
  required?: boolean;
  id?: string;
  className?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
};

/** Base UI checkbox with a hidden form input and an accessible labelled control. */
export const Checkbox = forwardRef<HTMLElement, CheckboxProps>(function Checkbox(
  { className, onCheckedChange, ...props },
  ref,
) {
  return (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        'inline-flex size-5 shrink-0 items-center justify-center rounded border border-border bg-card text-primary-foreground outline-none data-[checked]:border-primary data-[checked]:bg-primary focus-visible:outline-3 focus-visible:outline-primary/50 disabled:cursor-not-allowed disabled:opacity-55',
        className,
      )}
      onCheckedChange={(checked) => onCheckedChange?.(checked)}
      {...props}
    >
      <CheckboxPrimitive.Indicator>
        <IconCheck size={15} stroke={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});
