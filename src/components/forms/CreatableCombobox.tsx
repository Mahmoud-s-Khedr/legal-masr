import { forwardRef, useState, type ComponentProps } from 'react';
import { useQuery } from '@tanstack/react-query';
import { bridge } from '@/bridge/commands';
import { queryKeys } from '@/lib/queryKeys';
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
} from '../ui/combobox';
type Suggestion =
  'courtName' | 'circuitName' | 'caseType' | 'hearingType' | 'notaryOffice' | 'legalCapacity';
async function suggestions(kind: Suggestion): Promise<string[]> {
  if (kind === 'hearingType') {
    const rows = await bridge.hearingList();
    return rows.map((row) => row.hearingType ?? '').filter(Boolean);
  }
  if (kind === 'notaryOffice') {
    const list = await bridge.powerOfAttorneyList({});
    const rows = await Promise.all(list.map((row) => bridge.powerOfAttorneyGet(row.id)));
    return rows.map((row) => row.notaryOffice ?? '').filter(Boolean);
  }
  const list = await bridge.caseList({});
  const rows = await Promise.all(list.map((row) => bridge.caseGet(row.id)));
  return kind === 'legalCapacity'
    ? rows.flatMap((row) => row.clients.map((client) => client.legalCapacity ?? '')).filter(Boolean)
    : rows.map((row) => row[kind] ?? '').filter(Boolean);
}
/** Suggest existing domain text; arbitrary new text remains valid and editable. */
export const CreatableCombobox = forwardRef<
  HTMLInputElement,
  ComponentProps<'input'> & { suggestion: Suggestion }
>(function CreatableCombobox({ suggestion, value, defaultValue, onChange, name, ...props }, ref) {
  const [draft, setDraft] = useState(String(defaultValue ?? ''));
  const text = value !== undefined ? String(value) : draft;
  const query = useQuery({
    queryKey: queryKeys.suggestions(suggestion),
    queryFn: () => suggestions(suggestion),
    staleTime: 0,
  });
  const options = [...new Set([...(query.data ?? []), text].filter(Boolean))];
  const change = (next: string) => {
    setDraft(next);
    onChange?.({
      target: { name, value: next },
      currentTarget: { name, value: next },
    } as React.ChangeEvent<HTMLInputElement>);
  };
  return (
    <Combobox
      openOnInputClick
      items={options}
      value={text || null}
      inputValue={text}
      onInputValueChange={change}
      onValueChange={(next) => change(next ?? '')}
    >
      <ComboboxInput {...props} ref={ref} name={name} />
      <ComboboxContent>
        <ComboboxList>
          {(item: string) => (
            <ComboboxItem key={item} value={item}>
              {item}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
});
