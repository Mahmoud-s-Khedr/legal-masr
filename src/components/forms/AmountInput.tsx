import { forwardRef, type ComponentProps } from 'react';
import { InputGroup, InputGroupInput, InputGroupAddon, InputGroupText } from '../ui/input-group';
/** Decimal text remains exact until parsed by parseMoneyToMinor at submission. */
export const AmountInput = forwardRef<HTMLInputElement, ComponentProps<'input'>>(
  function AmountInput(props, ref) {
    return (
      <InputGroup>
        <InputGroupInput {...props} ref={ref} type="text" inputMode="decimal" dir="ltr" />
        <InputGroupAddon align="inline-end">
          <InputGroupText>EGP</InputGroupText>
        </InputGroupAddon>
      </InputGroup>
    );
  },
);
