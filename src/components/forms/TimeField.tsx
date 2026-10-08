import { forwardRef, useId, useState, type ChangeEvent, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { useFormat } from '@/i18n/LocalePresentation';
import { isCanonicalTime, normalizeTypedTime } from '@/lib/timeOfDay';
import { Input } from '../ui/input';

// Suggestions cover court hours, every quarter hour from 7:00 to 21:00.
const suggestions = Array.from({ length: 57 }, (_, i) => {
  const minutes = 7 * 60 + i * 15;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
});

type TimeFieldProps = Omit<ComponentProps<'input'>, 'value' | 'onChange'> & {
  /** The canonical 24-hour HH:mm, or whatever was typed while it is not a time yet. */
  value?: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
};

/**
 * A time typed the way people write it (9:30، 2 م، ٩:٣٠). The form receives the
 * canonical HH:mm once typing is finished; the field shows it back as «9:30 ص».
 */
export const TimeField = forwardRef<HTMLInputElement, TimeFieldProps>(function TimeField(
  { value = '', onChange, name, onBlur, onKeyDown, ...props },
  ref,
) {
  const id = useId();
  const { t } = useTranslation();
  const format = useFormat();
  const show = (time: string) => (isCanonicalTime(time) ? format.time(time) : time);
  const [text, setText] = useState(() => show(value));
  // Show a new value from the form, but never reformat what the lawyer is still typing.
  const [shownValue, setShownValue] = useState(value);
  const [editing, setEditing] = useState(false);
  if (value !== shownValue) {
    setShownValue(value);
    if (!editing) setText(show(value));
  }

  const emit = (next: string) =>
    onChange?.({
      target: { name, value: next },
      currentTarget: { name, value: next },
    } as ChangeEvent<HTMLInputElement>);
  const finish = (typed: string) => {
    const canonical = typed.trim() ? normalizeTypedTime(typed) : '';
    if (canonical === null) return;
    setText(show(canonical));
    if (canonical !== value) emit(canonical);
  };

  return (
    <>
      <Input
        {...props}
        ref={ref}
        name={name}
        type="text"
        dir="auto"
        autoComplete="off"
        placeholder={t('timeField.placeholder')}
        list={id}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          emit(event.target.value);
        }}
        onFocus={(event) => {
          setEditing(true);
          props.onFocus?.(event);
        }}
        onBlur={(event) => {
          setEditing(false);
          finish(event.target.value);
          onBlur?.(event);
        }}
        onKeyDown={(event) => {
          // Enter submits without a blur; finish the time first.
          if (event.key === 'Enter') finish(event.currentTarget.value);
          onKeyDown?.(event);
        }}
      />
      <datalist id={id}>
        {suggestions.map((time) => (
          <option key={time} value={format.time(time)} />
        ))}
      </datalist>
    </>
  );
});
