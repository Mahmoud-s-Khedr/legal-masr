import { forwardRef, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { InputGroup, InputGroupInput, InputGroupAddon, InputGroupText } from '../ui/input-group';
/** Decimal text remains exact until parsed by parseMoneyToMinor at submission. */
export const AmountInput = forwardRef<HTMLInputElement, ComponentProps<'input'>>(
  function AmountInput(props, ref) {
    const { t } = useTranslation();
    return (
      <InputGroup>
        <InputGroupInput {...props} ref={ref} type="text" inputMode="decimal" dir="ltr" />
        <InputGroupAddon align="inline-end">
          <InputGroupText>{t('forms.currencyShort')}</InputGroupText>
        </InputGroupAddon>
      </InputGroup>
    );
  },
);
