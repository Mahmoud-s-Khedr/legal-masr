import { QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { DirectionProvider } from '@base-ui/react/direction-provider';
import { Toaster } from '../components/ui/toast';
import { TooltipProvider } from '../components/ui/tooltip';
import { useTranslation } from 'react-i18next';
import { queryClient } from '../lib/queryClient';
import '../i18n';
import { LocalePresentationProvider } from '../i18n/LocalePresentation';

function RuntimeDirection({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const direction = i18n.dir(i18n.language) === 'rtl' ? 'rtl' : 'ltr';
  return (
    <DirectionProvider direction={direction}>
      <TooltipProvider>
        <Toaster>{children}</Toaster>
      </TooltipProvider>
    </DirectionProvider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <LocalePresentationProvider>
        <RuntimeDirection>{children}</RuntimeDirection>
      </LocalePresentationProvider>
    </QueryClientProvider>
  );
}
