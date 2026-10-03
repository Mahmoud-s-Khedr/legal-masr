type Tab = { id: string; label: string; disabled?: boolean };

export function Tabs({
  label,
  tabs,
  value,
  onChange,
}: {
  label: string;
  tabs: readonly Tab[];
  value: string;
  onChange: (id: string) => void;
}) {
  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.id === value),
  );
  const move = (direction: 1 | -1) => {
    for (let offset = 1; offset <= tabs.length; offset += 1) {
      const next = tabs[(activeIndex + direction * offset + tabs.length) % tabs.length];
      if (!next.disabled) {
        onChange(next.id);
        return;
      }
    }
  };
  return (
    <BaseTabs.Root value={value} onValueChange={onChange}>
      <BaseTabs.List className="shared-tabs" aria-label={label}>
        {tabs.map((tab) => (
          <BaseTabs.Tab
            key={tab.id}
            value={tab.id}
            disabled={tab.disabled}
            className={tab.id === value ? 'active' : ''}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                event.preventDefault();
                move(1);
              }
              if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                event.preventDefault();
                move(-1);
              }
              if (event.key === 'Home') {
                event.preventDefault();
                onChange(tabs.find((item) => !item.disabled)?.id ?? value);
              }
              if (event.key === 'End') {
                event.preventDefault();
                onChange([...tabs].reverse().find((item) => !item.disabled)?.id ?? value);
              }
            }}
          >
            {tab.label}
          </BaseTabs.Tab>
        ))}
      </BaseTabs.List>
    </BaseTabs.Root>
  );
}
import { Tabs as BaseTabs } from '@base-ui/react/tabs';
