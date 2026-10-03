import { type TextareaHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn('min-h-28 w-full resize-y rounded-sm border border-border bg-card px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-3 focus:ring-primary/15 focus:outline-none', className)} {...props} />;
  },
);
