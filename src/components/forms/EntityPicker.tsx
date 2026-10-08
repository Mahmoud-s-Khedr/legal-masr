import { useState, type ReactNode, type Ref } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxList,
  ComboboxItem,
  ComboboxChips,
  ComboboxChip,
  ComboboxChipsInput,
  ComboboxValue,
  useComboboxAnchor,
} from '../ui/combobox';
import { Button } from '../ui/button';
import { Spinner } from '../ui/spinner';
import { matchesSearch } from '@/lib/searchText';

export type EntityOption = {
  value: string;
  label: ReactNode;
  searchText?: string;
  disabled?: boolean;
};
type Shared = {
  items: readonly EntityOption[];
  placeholder?: string;
  /** Shown when nothing matches, e.g. «لا توجد قضايا مطابقة». Defaults to the clients text. */
  emptyText?: string;
  disabled?: boolean;
  loading?: boolean;
  error?: string;
  id?: string;
  name?: string;
  required?: boolean;
  className?: string;
  ref?: Ref<HTMLInputElement>;
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  'aria-labelledby'?: string;
};
export function EntityPicker({
  items,
  value,
  onValueChange,
  placeholder,
  emptyText,
  loading,
  error,
  ...props
}: Shared & { value?: string; onValueChange: (value: string) => void }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState<{ value?: string; query: string } | null>(null);
  const options = items.filter((item) => item.value);
  const selected = options.find((item) => item.value === value) ?? null;
  const selectedLabel = selected ? String(selected.label) : '';
  const query = search && search.value === value ? search.query : selectedLabel;
  const setQuery = (query: string) => setSearch({ value, query });
  return (
    <div>
      <Combobox
        openOnInputClick
        items={options}
        value={selected}
        // Base UI clears the selection when Escape is pressed with the list closed. A
        // lawyer presses Escape to close things, never to erase a choice, so ignore it.
        onValueChange={(item, details) => {
          if (details.reason !== 'escape-key') onValueChange(item?.value ?? '');
        }}
        inputValue={query}
        onInputValueChange={(next, details) => {
          if (details.reason !== 'escape-key') setQuery(next);
        }}
        itemToStringLabel={(item) => String(item.label)}
        itemToStringValue={(item) => item.value}
        filter={(item, needle) => matchesSearch(`${item.label} ${item.searchText ?? ''}`, needle)}
        disabled={props.disabled}
      >
        <ComboboxInput {...props} placeholder={placeholder} showClear={!props.required} />
        <ComboboxContent>
          {loading && <Spinner aria-label={t('records.loading')} />}
          {!loading && !error && (
            <ComboboxEmpty>{emptyText ?? t('clients.noResults')}</ComboboxEmpty>
          )}
          <ComboboxList>
            {(item: EntityOption) => (
              <ComboboxItem key={item.value} value={item} disabled={item.disabled}>
                {item.label}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
export function EntityMultiPicker({
  items,
  value,
  onValueChange,
  placeholder,
  emptyText,
  loading,
  error,
  onCreate,
  ...props
}: Shared & {
  value: string[];
  onValueChange: (value: string[]) => void;
  onCreate?: (name: string) => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const create = () => {
    setOpen(false);
    onCreate?.(query.trim());
  };
  const anchor = useComboboxAnchor();
  const selected = value.map(
    (id) => items.find((item) => item.value === id) ?? { value: id, label: id },
  );
  return (
    <div>
      <Combobox
        openOnInputClick
        multiple
        open={open}
        onOpenChange={setOpen}
        items={items}
        value={selected}
        // See EntityPicker: Escape must never remove the chosen clients.
        onValueChange={(items, details) => {
          if (details.reason !== 'escape-key') onValueChange(items.map((item) => item.value));
        }}
        inputValue={query}
        onInputValueChange={setQuery}
        itemToStringLabel={(item) => String(item.label)}
        itemToStringValue={(item) => item.value}
        isItemEqualToValue={(a, b) => a.value === b.value}
        filter={(item, needle) => matchesSearch(`${item.label} ${item.searchText ?? ''}`, needle)}
        disabled={props.disabled}
      >
        <ComboboxChips ref={anchor}>
          <ComboboxValue>
            {selected.map((item) => (
              <ComboboxChip key={item.value} aria-label={String(item.label)}>
                {item.label}
              </ComboboxChip>
            ))}
          </ComboboxValue>
          <ComboboxChipsInput {...props} placeholder={placeholder} />
        </ComboboxChips>
        <ComboboxContent anchor={anchor}>
          {loading && <Spinner aria-label={t('records.loading')} />}
          {!loading && !error && (
            <ComboboxEmpty>{emptyText ?? t('clients.noResults')}</ComboboxEmpty>
          )}
          <ComboboxList>
            {(item: EntityOption) => (
              <ComboboxItem
                key={item.value}
                value={item}
                disabled={item.disabled && !value.includes(item.value)}
              >
                {item.label}
              </ComboboxItem>
            )}
          </ComboboxList>
          {onCreate && query.trim() && (
            <Button type="button" variant="ghost" className="w-full" onClick={create}>
              {t('cases.form.addClientLink')} «{query.trim()}»
            </Button>
          )}
        </ComboboxContent>
      </Combobox>
      {error && <p role="alert">{error}</p>}
      {onCreate && (
        <Button type="button" variant="link" onClick={create}>
          {t('cases.form.addClientLink')}
        </Button>
      )}
    </div>
  );
}
