import { Alert, AlertDescription } from '@/components/ui/alert';
import { actionableErrorMessage } from '@/bridge/errors';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { Fact, RecordHeader } from '../../../components/layout/RecordHeader';
import { useFormat } from '../../../i18n/LocalePresentation';
import { useCaseList } from '../../cases/api/casesApi';
import { CaseStatusBadge } from '../../cases/components/CaseIdentity';
import { ConfirmDialog, FormDialog } from '../../../components/forms/FormDialog';
import { Tabs, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { Button } from '../../../components/ui/button';
import { AttachmentPanel } from '../../documents/components/AttachmentPanel';
import { PowerOfAttorneyForm } from '../components/PowerOfAttorneyForm';
import {
  useArchivePowerOfAttorney,
  usePowerOfAttorney,
  useRestorePowerOfAttorney,
  useSavePowerOfAttorney,
} from '../api/powersOfAttorneyApi';

export function PowerOfAttorneyDetailPage() {
  const { t } = useTranslation();
  const format = useFormat();
  const { id = '' } = useParams();
  const cases = useCaseList({ includeArchived: true });
  const [tab, setTab] = useState<'summary' | 'clients' | 'lawyers' | 'cases' | 'attachments'>(
    'summary',
  );
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const power = usePowerOfAttorney(id);
  const save = useSavePowerOfAttorney();
  const archive = useArchivePowerOfAttorney();
  const restore = useRestorePowerOfAttorney();
  if (power.isLoading)
    return (
      <p className="page-status" role="status">
        {t('records.loading')}
      </p>
    );
  if (power.isError)
    return (
      <Alert variant="destructive" className="page-status error">
        <AlertDescription>{t('records.loadError')}</AlertDescription>
      </Alert>
    );
  if (!power.data) return <p className="page-status">{t('poa.notFound')}</p>;
  const item = power.data;
  return (
    <section className="entity-detail detail-workspace">
      {(restore.isError || (archive.isError && !archiveOpen)) && (
        <Alert variant="destructive">
          <AlertDescription>{t('records.statusChangeError')}</AlertDescription>
        </Alert>
      )}
      <RecordHeader
        icon="poa"
        kicker={t('poa.kicker')}
        title={<bdi>{item.internalSequence}</bdi>}
        badges={item.archivedAt && <Badge variant="secondary">{t('records.archived')}</Badge>}
        meta={
          <>
            <span>
              {item.officialNumber ? (
                <>
                  {item.issueYear
                    ? t('cases.officialReference', {
                        number: '\u2068' + item.officialNumber + '\u2069',
                        year: item.issueYear,
                      })
                    : t('cases.officialNumberOnly', {
                        number: '\u2068' + item.officialNumber + '\u2069',
                      })}
                </>
              ) : (
                t('poa.noOfficialNumber')
              )}
            </span>
            {item.notaryOffice && (
              <span>
                <bdi dir="auto">{item.notaryOffice}</bdi>
              </span>
            )}
            {item.clients.length > 0 && (
              <span>
                <bdi dir="auto">{item.clients.map((client) => client.fullName).join('، ')}</bdi>
              </span>
            )}
          </>
        }
        actions={
          <>
            <Button type="button" onClick={() => setEditOpen(true)}>
              {t('records.edit')}
            </Button>
            {item.archivedAt ? (
              <Button
                type="button"
                variant="secondary"

                disabled={restore.isPending}
                onClick={() => restore.mutate(id)}
              >
                {t('records.restore')}
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"

                onClick={() => setArchiveOpen(true)}
              >
                {t('records.archive')}
              </Button>
            )}
          </>
        }
      />
      <Tabs
        value={tab}
        onValueChange={(value) => ((value) => setTab(value as typeof tab))(String(value))}
      >
        <TabsList activateOnFocus aria-label={t('poa.sectionsLabel')} variant="line">
          {[
            { id: 'summary', label: t('poa.tabs.summary') },
            { id: 'clients', label: t('poa.tabs.clients'), count: item.clients.length },
            { id: 'lawyers', label: t('poa.tabs.lawyers'), count: item.lawyers.length },
            { id: 'cases', label: t('poa.tabs.cases'), count: item.caseIds.length },
            { id: 'attachments', label: t('poa.tabs.documents') },
          ].map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {tab === 'summary' && (
        <div className="detail-grid">
          <section className="detail-card">
            <div className="card-title">
              <h3>{t('poa.dataTitle')}</h3>
            </div>
            <dl className="facts">
              <Fact label={t('poa.fields.officialNumber')}>
                {item.officialNumber && <bdi className="mono">{item.officialNumber}</bdi>}
              </Fact>
              <Fact label={t('poa.fields.issueYear')}>{item.issueYear}</Fact>
              <Fact label={t('poa.fields.issueDate')}>
                {item.issueDate && format.date(item.issueDate)}
              </Fact>
              <Fact label={t('poa.fields.notaryOffice')}>{item.notaryOffice}</Fact>
              {item.notes && (
                <Fact label={t('common.notes')} wide>
                  <span className="prewrap">{item.notes}</span>
                </Fact>
              )}
            </dl>
          </section>
          <section className="detail-card">
            <div className="card-title">
              <h3>{t('poa.clientsTitle')}</h3>
            </div>
            <ul className="compact-records">
              {item.clients.map((client) => (
                <li key={client.id}>
                  <div className="record-copy">
                    <Link to={`/clients/${client.id}`}>
                      <bdi>{client.fullName}</bdi>
                    </Link>
                    <span>
                      <bdi className="mono">{client.internalNumber}</bdi>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            <dl className="facts facts-compact">
              <Fact label={t('poa.lawyersTitle')}>{format.number(item.lawyers.length)}</Fact>
              <Fact label={t('poa.linkedCases')}>{format.number(item.caseIds.length)}</Fact>
            </dl>
          </section>
        </div>
      )}
      {tab === 'clients' && (
        <section className="detail-card">
          <div className="card-title">
            <h3>{t('poa.tabs.clients')}</h3>
          </div>
          <ul className="compact-records">
            {item.clients.map((client) => (
              <li key={client.id}>
                <div className="record-copy">
                  <Link to={`/clients/${client.id}`}>{client.fullName}</Link>
                  <span>
                    <bdi>{client.internalNumber}</bdi>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {tab === 'lawyers' && (
        <section className="detail-card">
          <div className="card-title">
            <h3>{t('poa.lawyersTitle')}</h3>
          </div>
          {!item.lawyers.length ? (
            <p className="empty-compact">{t('poa.noLawyers')}</p>
          ) : (
            <ul className="compact-records">
              {item.lawyers.map((lawyer) => (
                <li key={lawyer.id}>
                  <div className="record-copy">
                    <strong>{lawyer.fullName}</strong>
                    <span>
                      {lawyer.barNumber ? <bdi>{lawyer.barNumber}</bdi> : t('poa.noBarNumber')}
                      {lawyer.notes && ` · ${lawyer.notes}`}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {tab === 'cases' && (
        <section className="detail-card">
          <div className="card-title">
            <h3>{t('poa.linkedCasesTitle')}</h3>
          </div>
          {!item.caseIds.length ? (
            <p className="empty-compact">{t('poa.noCases')}</p>
          ) : (
            <ul className="compact-records">
              {item.caseIds.map((caseId) => {
                const linked = cases.data?.find((caseItem) => caseItem.id === caseId);
                return (
                  <li key={caseId}>
                    <div className="record-copy">
                      <Link to={`/cases/${caseId}`}>
                        <bdi>{linked?.internalNumber ?? t('poa.openCase')}</bdi>
                      </Link>
                      {linked && <span dir="auto">{linked.clientNames.join('، ')}</span>}
                    </div>
                    {linked && (
                      <CaseStatusBadge status={linked.status} archived={!!linked.archivedAt} />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
      {tab === 'attachments' && (
        <AttachmentPanel owner={{ powerOfAttorneyId: id }} title={t('poa.documentsTitle')} />
      )}
      <FormDialog open={editOpen} onOpenChange={setEditOpen} title={t('poa.editTitle')}>
        <PowerOfAttorneyForm
          powerOfAttorney={item}
          busy={save.isPending}
          onCancel={() => setEditOpen(false)}
          onSubmit={async (input) => {
            try {
              await save.mutateAsync({ id, ...input });
              setEditOpen(false);
            } catch {
              // Keep the modal open so the lawyer can correct or retry the draft.
            }
          }}
        />
        {save.isError && (
          <Alert variant="destructive">
            <AlertDescription>
              {actionableErrorMessage(save.error, t('poa.saveError'))}
            </AlertDescription>
          </Alert>
        )}
      </FormDialog>
      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title={t('poa.archiveTitle')}
        description={t('poa.archiveDescription')}
        confirmLabel={t('poa.archiveTitle')}
        cancelLabel={t('common.cancel')}
        pending={archive.isPending}
        error={archive.isError ? t('records.archiveError') : undefined}
        onConfirm={() => archive.mutate(id, { onSuccess: () => setArchiveOpen(false) })}
      />
    </section>
  );
}
