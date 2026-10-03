import { Select as SelectPrimitive } from '@base-ui/react/select';
import { IconCheck, IconChevronDown } from '@tabler/icons-react';
import { cn } from '@/lib/utils';

export type SelectItem = { value: string; label: React.ReactNode; disabled?: boolean };

type SelectProps = {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  items: readonly SelectItem[];
  placeholder?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
  'aria-label'?: string;
};

/** Accessible Base UI select. Values are explicit so forms do not depend on native select registration. */
export function Select({
  value,
  defaultValue,
  onValueChange,
  items,
  placeholder = '—',
  name,
  required,
  disabled,
  className,
  ...props
}: SelectProps) {
  return (
    <SelectPrimitive.Root
      value={value || null}
      defaultValue={defaultValue || null}
      onValueChange={(next) => onValueChange?.(next ?? '')}
      items={items}
      name={name}
      required={required}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        className={cn(
          'flex min-h-11 w-full items-center justify-between rounded-sm border border-border bg-card px-3 py-2 text-start text-foreground focus:outline-3 focus:outline-primary/50 disabled:cursor-not-allowed disabled:opacity-55',
          className,
        )}
        {...props}
      >
        <SelectPrimitive.Value className="truncate" placeholder={placeholder} />
        <SelectPrimitive.Icon>
          <IconChevronDown size={16} />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Positioner sideOffset={4} className="z-50">
          <SelectPrimitive.Popup className="max-h-72 min-w-[var(--anchor-width)] overflow-auto rounded-md border border-border bg-card p-1 text-foreground shadow-lg">
            <SelectPrimitive.List>
              {items.map((item) => (
                <SelectPrimitive.Item
                  key={item.value}
                  value={item.value}
                  disabled={item.disabled}
                  className="flex cursor-default items-center justify-between gap-3 rounded-sm px-3 py-2 outline-none data-[highlighted]:bg-accent data-[disabled]:opacity-50"
                >
                  <SelectPrimitive.ItemText>{item.label}</SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator>
                    <IconCheck size={16} />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.List>
          </SelectPrimitive.Popup>
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
