import { Empty, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { useState, type Ref } from 'react';
import { useTranslation } from 'react-i18next';
import type { ClientSummary } from '@/bridge/types';
import { EntityMultiPicker } from '@/components/forms/EntityPicker';
import { InlineClientCreateDialog } from '../../clients/components/InlineClientCreateDialog';
export function ClientPicker({
  clients,
  value,
  onChange,
  error,
  ref,
}: {
  clients: ClientSummary[];
  value: string[];
  onChange: (ids: string[]) => void;
  error?: string;
  ref?: Ref<HTMLInputElement>;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState<ClientSummary[]>([]);
  const items = [
    ...clients,
    ...created.filter((c) => !clients.some((existing) => existing.id === c.id)),
  ].map((client) => ({
    value: client.id,
    label: client.fullName,
    searchText: `${client.internalNumber} ${client.primaryPhone ?? ''}`,
    disabled: !!client.archivedAt,
  }));
  return (
    <>
      {!clients.length && !created.length && (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{t('cases.form.noClientsTitle')}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      )}
      <EntityMultiPicker
        ref={ref}
        aria-label={t('cases.fields.clients')}
        aria-invalid={!!error}
        items={items}
        value={value}
        onValueChange={onChange}
        placeholder={t('cases.form.clientSearch')}
        error={error}
        onCreate={(name) => {
          setName(name);
          setOpen(true);
        }}
      />
      <InlineClientCreateDialog
        open={open}
        onOpenChange={setOpen}
        initialName={name}
        onCreated={(id) => {
          setCreated((current) => [
            ...current,
            { id, fullName: name, internalNumber: '', primaryPhone: null, archivedAt: null },
          ]);
          onChange([...value, id]);
        }}
      />
    </>
  );
}
