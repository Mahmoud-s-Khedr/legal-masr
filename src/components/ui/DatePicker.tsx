import { Popover } from '@base-ui/react/popover';
import { IconCalendarEvent } from '@tabler/icons-react';
import { DayPicker } from 'react-day-picker';
import {
  forwardRef,
  type ChangeEvent,
  type InputHTMLAttributes,
  useEffect,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import '../../i18n';
import { useLocalePresentation } from '../../i18n/LocalePresentation';

type DatePickerProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'defaultValue' | 'onChange' | 'type' | 'value'
> & {
  value?: string;
  defaultValue?: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
};

function parseDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
}

function formatDateOnly(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Local calendar and editable canonical YYYY-MM-DD input; no UTC conversions. */
export const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(function DatePicker(
  { value, defaultValue, onChange, name, required, className, ...inputProps },
  ref,
) {
  const { t } = useTranslation();
  const { direction, dateLocale, weekStartsOn } = useLocalePresentation();
  const controlled = value !== undefined;
  const [textValue, setTextValue] = useState(value ?? defaultValue ?? '');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (controlled) setTextValue(value ?? '');
  }, [controlled, value]);

  const emitChange = (next: string) => {
    if (!controlled) setTextValue(next);
    onChange?.({ target: { name, value: next }, currentTarget: { name, value: next } } as ChangeEvent<HTMLInputElement>);
  };
  const selected = parseDateOnly(textValue);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <span className={`date-picker${className ? ` ${className}` : ''}`}>
        <input
          {...inputProps}
          ref={ref}
          type="text"
          name={name}
          dir="ltr"
          inputMode="numeric"
          autoComplete="off"
          placeholder={t('datePicker.placeholder')}
          pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}"
          title={t('datePicker.inputTitle')}
          required={required}
          value={textValue}
          onChange={(event) => {
            if (!controlled) setTextValue(event.target.value);
            onChange?.(event);
          }}
        />
        <Popover.Trigger className="date-picker-trigger" type="button" aria-label={t('datePicker.openCalendar')}>
          <IconCalendarEvent aria-hidden="true" size={18} />
        </Popover.Trigger>
      </span>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={6}>
          <Popover.Popup className="date-picker-popover" aria-label={t('datePicker.chooseDate')} dir={direction}>
            <DayPicker
              mode="single"
              dir={direction}
              locale={dateLocale}
              weekStartsOn={weekStartsOn as 0 | 1 | 2 | 3 | 4 | 5 | 6}
              components={{
                // Keep a concise, stable day number while the surrounding calendar
                // headings and navigation remain localized by date-fns.
                DayButton: ({ day, ...props }) => (
                  <button {...props} aria-label={String(day.date.getDate())} />
                ),
              }}
              selected={selected ?? undefined}
              defaultMonth={selected ?? undefined}
              onSelect={(date) => {
                if (!date) return;
                emitChange(formatDateOnly(date));
                setOpen(false);
              }}
            />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
});
