import { Tabs as BaseTabs } from '@base-ui/react/tabs';

type Tab = { id: string; label: string; disabled?: boolean; count?: number };

/**
 * One accessible tab pattern for the whole app. Base UI moves focus and
 * selection together with the arrow keys (mirrored in RTL), Home and End.
 * `segmented` switches a view of the same records; `underline` switches the
 * sections of a record file.
 */
export function Tabs({
  label,
  tabs,
  value,
  onChange,
  variant = 'segmented',
}: {
  label: string;
  tabs: readonly Tab[];
  value: string;
  onChange: (id: string) => void;
  variant?: 'segmented' | 'underline';
}) {
  return (
    <BaseTabs.Root value={value} onValueChange={(next) => onChange(String(next))}>
      <BaseTabs.List
        className={variant === 'underline' ? 'section-tabs' : 'shared-tabs'}
        aria-label={label}
        activateOnFocus
      >
        {tabs.map((tab) => (
          <BaseTabs.Tab
            key={tab.id}
            value={tab.id}
            disabled={tab.disabled}
            className={tab.id === value ? 'active' : ''}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="tab-count" aria-hidden="true">
                {tab.count}
              </span>
            )}
          </BaseTabs.Tab>
        ))}
      </BaseTabs.List>
    </BaseTabs.Root>
  );
}
