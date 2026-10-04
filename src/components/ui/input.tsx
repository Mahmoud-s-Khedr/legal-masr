import { type InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'min-h-11 w-full rounded-sm border border-border bg-card px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-3 focus:ring-primary/15 focus:outline-none',
          className,
        )}
        {...props}
      />
    );
  },
);
