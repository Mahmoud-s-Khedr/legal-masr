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
    <div className="shared-tabs" role="tablist" aria-label={label}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={tab.id === value}
          disabled={tab.disabled}
          className={tab.id === value ? 'active' : ''}
          onClick={() => onChange(tab.id)}
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
        </button>
      ))}
    </div>
  );
}
