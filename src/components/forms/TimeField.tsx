import { forwardRef, useId, type ComponentProps } from 'react';
import { Input } from '../ui/input';
const times = Array.from(
  { length: 96 },
  (_, i) =>
    `${String(Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`,
);
export const TimeField = forwardRef<HTMLInputElement, ComponentProps<'input'>>(
  function TimeField(props, ref) {
    const id = useId();
    return (
      <>
        <Input
          {...props}
          ref={ref}
          type="text"
          dir="ltr"
          inputMode="numeric"
          pattern="([01][0-9]|2[0-3]):[0-5][0-9]"
          placeholder="HH:mm"
          list={id}
        />
        <datalist id={id}>
          {times.map((time) => (
            <option key={time} value={time} />
          ))}
        </datalist>
      </>
    );
  },
);
