import { format } from 'date-fns';
import { formatDateShort } from '@/lib/format';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { InputGroup, InputGroupInput, InputGroupAddon, InputGroupButton } from '../ui/input-group';
import { Button } from '../ui/button';
import { localDateOnly } from '@/lib/dateOnly';
import { IconCalendarEvent } from '@tabler/icons-react';

import { forwardRef, type ChangeEvent, type InputHTMLAttributes, useEffect, useState } from 'react';
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

const ARABIC_INDIC = /[٠-٩۰-۹]/g;

/**
 * Accepts the day-first dates lawyers type (3/10/2026, 03-10-2026, ٣/١٠/٢٠٢٦) and returns
 * the canonical YYYY-MM-DD value, or null when it is not a real date. `lenient` also
 * accepts an unpadded year-first date (2026-10-3) once typing finishes.
 * Calendar years always require four explicit digits.
 */
export function normalizeTypedDate(raw: string, { lenient = false } = {}) {
  const value = raw.trim().replace(ARABIC_INDIC, (digit) => String(digit.charCodeAt(0) & 0xf));
  const dayFirst = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(value);
  const yearFirst = lenient ? /^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})$/.exec(value) : null;
  const candidate = dayFirst
    ? `${dayFirst[3]}-${dayFirst[2].padStart(2, '0')}-${dayFirst[1].padStart(2, '0')}`
    : yearFirst
      ? `${yearFirst[1]}-${yearFirst[2].padStart(2, '0')}-${yearFirst[3].padStart(2, '0')}`
      : value;
  return parseDateOnly(candidate) ? candidate : null;
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
  const { direction, dateLocale, weekStartsOn, dateFormat } = useLocalePresentation();
  const controlled = value !== undefined;
  const [textValue, setTextValue] = useState(() => {
    const initial = value ?? defaultValue ?? '';
    return parseDateOnly(initial) ? formatDateShort(initial, dateFormat) : initial;
  });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (controlled)
      setTextValue(
        value && parseDateOnly(value) ? formatDateShort(value, dateFormat) : (value ?? ''),
      );
  }, [controlled, value, dateFormat]);

  const emitChange = (next: string) => {
    setTextValue(next && parseDateOnly(next) ? formatDateShort(next, dateFormat) : next);
    onChange?.({
      target: { name, value: next },
      currentTarget: { name, value: next },
    } as ChangeEvent<HTMLInputElement>);
  };
  const selected = parseDateOnly(normalizeTypedDate(textValue) ?? '');

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <InputGroup className={className}>
        <InputGroupInput
          {...inputProps}
          ref={ref}
          type="text"
          name={name}
          dir="ltr"
          inputMode="numeric"
          autoComplete="off"
          placeholder={
            dateFormat === 'yyyy-MM-dd'
              ? t('datePicker.placeholderYearFirst')
              : t('datePicker.placeholder')
          }

          title={t('datePicker.inputTitle')}
          required={required}
          value={textValue}
          onChange={(event) => {
            setTextValue(event.target.value);
            const normalized = normalizeTypedDate(event.target.value);
            if (normalized) emitChange(normalized);
            else onChange?.(event);
          }}
          onBlur={(event) => {
            const normalized = normalizeTypedDate(event.target.value, { lenient: true });
            if (normalized && normalized !== event.target.value) emitChange(normalized);
            inputProps.onBlur?.(event);
          }}
          onKeyDown={(event) => {
            // Enter submits without a blur; finish the date first.
            if (event.key === 'Enter') {
              const normalized = normalizeTypedDate(event.currentTarget.value, { lenient: true });
              if (normalized && normalized !== value) emitChange(normalized);
            }
            inputProps.onKeyDown?.(event);
          }}
        />
        <InputGroupAddon align="inline-end">
          <PopoverTrigger
            render={<InputGroupButton variant="ghost" size="icon-xs" />}
            type="button"
            aria-label={t('datePicker.openCalendar')}
          >
            <IconCalendarEvent aria-hidden="true" size={18} />
          </PopoverTrigger>
        </InputGroupAddon>
      </InputGroup>
      <PopoverContent
        className="w-auto p-2"
        aria-label={t('datePicker.chooseDate')}
        dir={direction}
      >
        <Calendar
          className="[--cell-size:2.75rem]"
          formatters={{
            formatWeekdayName: (date) => format(date, 'EEEEEE', { locale: dateLocale }),
          }}
          mode="single"
          dir={direction}
          locale={dateLocale}
          weekStartsOn={weekStartsOn as 0 | 1 | 2 | 3 | 4 | 5 | 6}
          captionLayout="dropdown"
          startMonth={new Date(1900, 0, 1)}
          endMonth={new Date(2200, 11, 31)}
          numerals="latn"
          selected={selected ?? undefined}
          defaultMonth={selected ?? undefined}
          onSelect={(date) => {
            if (!date) return;
            emitChange(formatDateOnly(date));
            setOpen(false);
          }}
        />
        <div className="flex justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              emitChange(localDateOnly());
              setOpen(false);
            }}
          >
            {t('datePicker.today')}
          </Button>
          {!required && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                emitChange('');
                setOpen(false);
              }}
            >
              {t('datePicker.clear')}
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
});
