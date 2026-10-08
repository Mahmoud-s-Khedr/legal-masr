import { DraftForm } from '@/components/forms/DraftForm';
import { Badge } from '@/components/ui/badge';
import { CreatableCombobox } from '@/components/forms/CreatableCombobox';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { CaseClientInput } from '@/bridge/types';
import { errorMessage } from '@/bridge/errors';
import { FormDialog } from '@/components/forms/FormDialog';
import { EntityPicker, EntityMultiPicker } from '@/components/forms/EntityPicker';
import { Field } from '@/components/forms/FormField';
import { FieldGroup } from '@/components/ui/field';

import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useClientList } from '../../clients/api/clientsApi';
import { usePowerOfAttorneyList } from '../../powersOfAttorney/api/powersOfAttorneyApi';
import { useSetCaseClients } from '../api/casesApi';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { CaseDto } from '../../../bridge/types';

export function CaseClientsPanel({
  caseDto,
  readOnly = false,
}: {
  caseDto: CaseDto;
  readOnly?: boolean;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  return (
    <section className="detail-card">
      <div className="card-title">
        <h3>{t('cases.clientsPanel.title')}</h3>
        {!readOnly && (
          <Button type="button" variant="outline" onClick={() => setEditing(true)}>
            {t('records.edit')}
          </Button>
        )}
      </div>
      <ul className="compact-records">
        {caseDto.clients.map((client) => (
          <li key={client.clientId}>
            <div className="record-copy">
              <Link to={`/clients/${client.clientId}`} dir="auto">
                <bdi>{client.fullName}</bdi>
              </Link>
              <span>
                <bdi className="mono">{client.internalNumber}</bdi>
                {' · '}
                {client.legalCapacity ?? t('cases.clientsPanel.noCapacity')}
              </span>
            </div>
            {client.powerOfAttorneyId ? (
              <Badge
                variant="secondary"
                render={<Link to={`/powers-of-attorney/${client.powerOfAttorneyId}`} />}
              >
                {t('cases.clientsPanel.poaLinked')}
              </Badge>
            ) : (
              <Badge variant="secondary">{t('cases.clientsPanel.noPoa')}</Badge>
            )}
          </li>
        ))}
      </ul>
      <FormDialog open={editing} onOpenChange={setEditing} title={t('cases.clientsPanel.title')}>
        <RelationshipEditor caseDto={caseDto} onClose={() => setEditing(false)} />
      </FormDialog>
    </section>
  );
}

function RelationshipEditor({ caseDto, onClose }: { caseDto: CaseDto; onClose: () => void }) {
  const { t } = useTranslation();
  const clients = useClientList({ includeArchived: true });
  const save = useSetCaseClients();
  const { control, handleSubmit, formState } = useForm<{ clients: CaseClientInput[] }>({
    resolver: zodResolver(
      z.object({
        clients: z
          .array(
            z.object({
              clientId: z.string().min(1),
              legalCapacity: z.string().optional(),
              powerOfAttorneyId: z.string().optional(),
              notes: z.string().optional(),
            }),
          )
          .min(1)
          .refine((rows) => new Set(rows.map((row) => row.clientId)).size === rows.length),
      }),
    ),
    defaultValues: {
      clients: caseDto.clients.map((c) => ({
        clientId: c.clientId,
        legalCapacity: c.legalCapacity ?? '',
        powerOfAttorneyId: c.powerOfAttorneyId ?? '',
        notes: c.notes ?? '',
      })),
    },
  });
  return (
    <DraftForm
      noValidate
      onSubmit={handleSubmit(async (values) => {
        try {
          await save.mutateAsync({
            caseId: caseDto.id,
            clients: values.clients.map((c) => ({
              ...c,
              powerOfAttorneyId: c.powerOfAttorneyId || undefined,
            })),
          });
          onClose();
        } catch {
          /* Retain the draft for retry. */
        }
      })}
    >
      <FieldGroup>
        <FieldGroup>
          <Controller
            name="clients"
            control={control}
            render={({ field }) => (
              <>
                <Field
                  label={t('cases.fields.clients')}
                  required
                  error={formState.errors.clients ? t('cases.form.clientsRequired') : undefined}
                >
                  <EntityMultiPicker
                    ref={field.ref}
                    items={[
                      ...(clients.data ?? []).map((c) => ({
                        value: c.id,
                        label: c.fullName,
                        searchText: `${c.internalNumber} ${c.primaryPhone ?? ''}`,
                        disabled: !!c.archivedAt,
                      })),
                      ...caseDto.clients
                        .filter((c) => !clients.data?.some((loaded) => loaded.id === c.clientId))
                        .map((c) => ({ value: c.clientId, label: c.fullName, disabled: true })),
                    ]}
                    value={field.value.map((c) => c.clientId)}
                    onValueChange={(ids) =>
                      field.onChange(
                        ids.map(
                          (id) =>
                            field.value.find((c) => c.clientId === id) ??
                            caseDto.clients
                              .filter((c) => c.clientId === id)
                              .map((c) => ({
                                clientId: id,
                                legalCapacity: c.legalCapacity ?? '',
                                powerOfAttorneyId: c.powerOfAttorneyId ?? '',
                                notes: c.notes ?? '',
                              }))[0] ?? { clientId: id },
                        ),
                      )
                    }
                    loading={clients.isLoading}
                    error={clients.isError ? t('clients.loadError') : undefined}
                  />
                </Field>
                {field.value.map((client, index) => (
                  <RelationshipFields
                    key={client.clientId}
                    client={client}
                    name={
                      clients.data?.find((c) => c.id === client.clientId)?.fullName ??
                      caseDto.clients.find((c) => c.clientId === client.clientId)?.fullName ??
                      client.clientId
                    }
                    onChange={(next) =>
                      field.onChange(field.value.map((c, i) => (i === index ? next : c)))
                    }
                  />
                ))}
              </>
            )}
          />
          {save.isError && (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage(save.error, t('cases.saveError'))}</AlertDescription>
            </Alert>
          )}
          <div className="form-actions">
            <Button type="submit" disabled={save.isPending || formState.isSubmitting}>
              {t('records.saveEdits')}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              {t('common.cancel')}
            </Button>
          </div>
        </FieldGroup>
      </FieldGroup>
    </DraftForm>
  );
}
function RelationshipFields({
  client,
  name,
  onChange,
}: {
  client: CaseClientInput;
  name: string;
  onChange: (client: CaseClientInput) => void;
}) {
  const { t } = useTranslation();
  const powers = usePowerOfAttorneyList({ clientId: client.clientId, includeArchived: true });
  return (
    <FieldGroup>
      <strong>{name}</strong>
      <Field label={t('cases.clientsPanel.capacity')}>
        <CreatableCombobox
          suggestion="legalCapacity"
          value={client.legalCapacity ?? ''}
          onChange={(e) => onChange({ ...client, legalCapacity: e.target.value })}
        />
      </Field>
      <Field label={t('cases.clientsPanel.poa')}>
        <EntityPicker
          items={(powers.data ?? []).map((p) => ({ value: p.id, label: p.internalSequence }))}
          value={client.powerOfAttorneyId ?? ''}
          onValueChange={(id) => onChange({ ...client, powerOfAttorneyId: id || undefined })}
          loading={powers.isLoading}
          error={powers.isError ? t('poa.loadError') : undefined}
        />
      </Field>
      <Field label={t('common.notes')}>
        <Textarea
          value={client.notes ?? ''}
          onChange={(e) => onChange({ ...client, notes: e.target.value })}
        />
      </Field>
    </FieldGroup>
  );
}
