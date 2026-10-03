import { cva, type VariantProps } from 'class-variance-authority';
import { type ButtonHTMLAttributes, type ReactElement, cloneElement, forwardRef } from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 py-2 font-bold transition focus-visible:outline-3 focus-visible:outline-primary/50 disabled:pointer-events-none disabled:opacity-55',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'border border-border bg-card text-foreground hover:bg-accent',
        outline: 'border border-border bg-transparent text-foreground hover:bg-accent',
        ghost: 'bg-transparent text-primary hover:bg-accent',
        destructive: 'bg-destructive text-white hover:bg-destructive/90',
      },
      size: { default: 'min-h-10', sm: 'min-h-8 px-3 py-1 text-sm', lg: 'min-h-11 px-6' },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild = false, children, ...props },
  ref,
) {
  const classes = cn(buttonVariants({ variant, size }), className);
  if (asChild && children && typeof children === 'object' && 'type' in children) {
    const child = children as ReactElement<{ className?: string }>;
    return cloneElement(child, { className: cn(classes, child.props.className) });
  }
  return <button ref={ref} className={classes} {...props}>{children}</button>;
});

export { buttonVariants };
