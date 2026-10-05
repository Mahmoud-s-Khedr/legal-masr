import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { Fact, RecordHeader } from '../../../components/layout/RecordHeader';
import { ConfirmDialog, Dialog } from '../../../components/ui/Dialog';
import { Tabs } from '../../../components/ui/Tabs';
import { Button } from '../../../components/ui/button';
import { useFormat } from '../../../i18n/LocalePresentation';
import { useCaseList } from '../../cases/api/casesApi';
import { CaseStatusBadge, OfficialReference } from '../../cases/components/CaseIdentity';
import { AttachmentPanel } from '../../documents/components/AttachmentPanel';
import { useClientFinanceSummary } from '../../finances/api/financesApi';
import { usePowerOfAttorneyList } from '../../powersOfAttorney/api/powersOfAttorneyApi';
import { ClientForm } from '../forms/ClientForm';
import { useArchiveClient, useClient, useRestoreClient, useUpdateClient } from '../api/clientsApi';

export function ClientDetailPage() {
  const { t } = useTranslation();
  const format = useFormat();
  const { id = '' } = useParams();
  const [tab, setTab] = useState<'summary' | 'cases' | 'poas' | 'account' | 'attachments'>(
    'summary',
  );
  const [editOpen, setEditOpen] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const client = useClient(id);
  const cases = useCaseList({ clientId: id });
  const powersOfAttorney = usePowerOfAttorneyList({ clientId: id, includeArchived: true });
  const finance = useClientFinanceSummary(id);
  const update = useUpdateClient();
  const archive = useArchiveClient();
  const restore = useRestoreClient();
  if (client.isLoading)
    return (
      <p className="page-status" role="status">
        {t('records.loading')}
      </p>
    );
  if (client.isError)
    return (
      <p className="page-status error" role="alert">
        {t('records.loadError')}
      </p>
    );
  if (!client.data) return <p className="page-status">{t('clients.detail.notFound')}</p>;
  const item = client.data;
  const linkedCases = cases.data ?? [];
  const linkedPowers = powersOfAttorney.data ?? [];

  return (
    <section className="entity-detail detail-workspace">
      {(restore.isError || (archive.isError && !confirmArchive)) && (
        <p className="error" role="alert">
          {t('records.statusChangeError')}
        </p>
      )}
      <RecordHeader
        initial={item.fullName.trim().slice(0, 1)}
        kicker={t('clients.detail.kicker')}
        title={item.fullName}
        badges={
          item.archivedAt && (
            <span className="status-badge tone-muted">{t('clients.archivedBadge')}</span>
          )
        }
        meta={
          <>
            <span>
              <bdi className="mono">{item.internalNumber}</bdi>
            </span>
            {item.primaryPhone && (
              <span>
                <a href={`tel:${item.primaryPhone}`}>
                  <bdi className="mono">{item.primaryPhone}</bdi>
                </a>
              </span>
            )}
          </>
        }
        actions={
          <>
            {!item.archivedAt && (
              <Link className="button-link secondary-link" to={`/cases/new?client=${id}`}>
                {t('clients.detail.newCase')}
              </Link>
            )}
            <Button type="button" onClick={() => setEditOpen(true)}>
              {t('records.edit')}
            </Button>
            {item.archivedAt ? (
              <Button
                type="button"
                variant="secondary"
                className="secondary-button"
                disabled={restore.isPending}
                onClick={() => restore.mutate(id)}
              >
                {t('records.restore')}
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                className="quiet-button"
                onClick={() => setConfirmArchive(true)}
              >
                {t('records.archive')}
              </Button>
            )}
          </>
        }
      />
      <Tabs
        variant="underline"
        label={t('clients.detail.sectionsLabel')}
        value={tab}
        onChange={(value) => setTab(value as typeof tab)}
        tabs={[
          { id: 'summary', label: t('clients.detail.tabs.summary') },
          { id: 'cases', label: t('clients.detail.tabs.cases'), count: linkedCases.length },
          { id: 'poas', label: t('clients.detail.tabs.poas'), count: linkedPowers.length },
          { id: 'account', label: t('clients.detail.tabs.account') },
          { id: 'attachments', label: t('clients.detail.tabs.attachments') },
        ]}
      />
      {tab === 'summary' && (
        <div className="detail-grid">
          <section className="detail-card">
            <div className="card-title">
              <h3>{t('clients.detail.contactTitle')}</h3>
            </div>
            <dl className="facts">
              <Fact label={t('clients.fields.internalNumber')}>
                {<bdi className="mono">{item.internalNumber}</bdi>}
              </Fact>
              <Fact label={t('clients.fields.primaryPhone')}>
                {item.primaryPhone && <bdi className="mono">{item.primaryPhone}</bdi>}
              </Fact>
              <Fact label={t('clients.fields.nationalId')}>
                {item.nationalId && <bdi className="mono">{item.nationalId}</bdi>}
              </Fact>
              <Fact label={t('clients.fields.email')}>
                {item.email && <bdi className="mono">{item.email}</bdi>}
              </Fact>
              <Fact label={t('clients.fields.address')} wide>
                {item.address}
              </Fact>
              {item.notes && (
                <Fact label={t('clients.fields.notes')} wide>
                  <span className="prewrap">{item.notes}</span>
                </Fact>
              )}
            </dl>
          </section>
          <section className="detail-card">
            <div className="card-title">
              <h3>{t('clients.detail.casesTitle')}</h3>
              <Button
                type="button"
                variant="ghost"
                className="text-button"
                onClick={() => setTab('cases')}
              >
                {t('dashboard.viewAll')}
              </Button>
            </div>
            {linkedCases.length ? (
              <ul className="compact-records">
                {linkedCases.slice(0, 4).map((caseItem) => (
                  <li key={caseItem.id}>
                    <div className="record-copy">
                      <Link to={`/cases/${caseItem.id}`}>
                        <bdi>{caseItem.internalNumber}</bdi>
                      </Link>
                      {caseItem.officialNumber && (
                        <span>
                          <OfficialReference
                            number={caseItem.officialNumber}
                            year={caseItem.officialYear}
                          />
                        </span>
                      )}
                    </div>
                    <CaseStatusBadge status={caseItem.status} archived={!!caseItem.archivedAt} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">{t('clients.detail.noCases')}</p>
            )}
            <dl className="facts facts-compact">
              <Fact label={t('clients.detail.received')}>
                <bdi>{format.money(finance.data?.receivedMinor ?? 0)}</bdi>
              </Fact>
              <Fact label={t('clients.detail.poasCount')}>
                {format.number(linkedPowers.length)}
              </Fact>
            </dl>
          </section>
        </div>
      )}
      {tab === 'cases' && (
        <section className="detail-card">
          <div className="card-title">
            <h3>{t('clients.detail.casesTitle')}</h3>
            {!item.archivedAt && (
              <Link className="text-link" to={`/cases/new?client=${id}`}>
                {t('clients.detail.newCase')}
              </Link>
            )}
          </div>
          {!linkedCases.length ? (
            <p className="empty-compact">{t('clients.detail.noCases')}</p>
          ) : (
            <ul className="compact-records">
              {linkedCases.map((caseItem) => (
                <li key={caseItem.id}>
                  <div className="record-copy">
                    <Link to={`/cases/${caseItem.id}`}>
                      <bdi>{caseItem.internalNumber}</bdi>
                    </Link>
                    <span>
                      {caseItem.officialNumber ? (
                        <OfficialReference
                          number={caseItem.officialNumber}
                          year={caseItem.officialYear}
                        />
                      ) : (
                        t('clients.detail.noOfficialNumber')
                      )}
                    </span>
                  </div>
                  <CaseStatusBadge status={caseItem.status} archived={!!caseItem.archivedAt} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {tab === 'poas' && (
        <section className="detail-card">
          <div className="card-title">
            <h3>{t('clients.detail.poasTitle')}</h3>
            <Link className="text-link" to="/powers-of-attorney">
              {t('clients.detail.managePoas')}
            </Link>
          </div>
          {powersOfAttorney.isError ? (
            <p className="error" role="alert">
              {t('app.loadError')}
            </p>
          ) : !linkedPowers.length ? (
            <p className="empty-compact">{t('clients.detail.noPoas')}</p>
          ) : (
            <ul className="compact-records">
              {linkedPowers.map((poa) => (
                <li key={poa.id}>
                  <div className="record-copy">
                    <Link to={`/powers-of-attorney/${poa.id}`}>
                      <bdi>{poa.internalSequence}</bdi>
                    </Link>
                    <span>
                      {poa.officialNumber ? (
                        <bdi className="mono">{poa.officialNumber}</bdi>
                      ) : (
                        t('clients.detail.noOfficialNumber')
                      )}
                    </span>
                  </div>
                  {poa.archivedAt && (
                    <span className="status-badge tone-muted">{t('records.archived')}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {tab === 'account' && (
        <section className="detail-card">
          <div className="card-title">
            <h3>{t('clients.detail.tabs.account')}</h3>
            <Link className="text-link" to={`/finances?client=${id}`}>
              {t('clients.detail.openLedger')}
            </Link>
          </div>
          <p className="muted card-note">{t('clients.detail.accountNote')}</p>
          <div className="finance-summary finance-summary-3">
            <article>
              <span>{t('clients.detail.received')}</span>
              <strong>
                <bdi>{format.money(finance.data?.receivedMinor ?? 0)}</bdi>
              </strong>
            </article>
            <article>
              <span>{t('clients.detail.expenses')}</span>
              <strong>
                <bdi>{format.money(finance.data?.expensesMinor ?? 0)}</bdi>
              </strong>
            </article>
            <article className="finance-net">
              <span>{t('clients.detail.net')}</span>
              <strong>
                <bdi>{format.money(finance.data?.netCashMinor ?? 0)}</bdi>
              </strong>
            </article>
          </div>
        </section>
      )}
      {tab === 'attachments' && (
        <AttachmentPanel owner={{ clientId: id }} title={t('clients.detail.attachmentsTitle')} />
      )}
      <Dialog open={editOpen} onOpenChange={setEditOpen} title={t('clients.detail.editTitle')}>
        <ClientForm
          defaultValues={{
            internalNumber: item.internalNumber,
            fullName: item.fullName,
            nationalId: item.nationalId ?? undefined,
            primaryPhone: item.primaryPhone ?? undefined,
            email: item.email ?? undefined,
            address: item.address ?? undefined,
            notes: item.notes ?? undefined,
          }}
          busy={update.isPending}
          submitLabel={t('records.saveEdits')}
          onCancel={() => setEditOpen(false)}
          onSubmit={async (values) => {
            try {
              await update.mutateAsync({ id, ...values });
              setEditOpen(false);
            } catch {
              // Keep the modal open so the lawyer can correct or retry the draft.
            }
          }}
        />
        {update.isError && (
          <p className="error" role="alert">
            {t('records.saveRetry')}
          </p>
        )}
      </Dialog>
      <ConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title={t('clients.detail.archiveTitle')}
        description={t('clients.detail.archiveDescription')}
        confirmLabel={t('clients.detail.archiveTitle')}
        cancelLabel={t('common.cancel')}
        pending={archive.isPending}
        error={archive.isError ? t('records.archiveError') : undefined}
        onConfirm={() => archive.mutate(id, { onSuccess: () => setConfirmArchive(false) })}
      />
    </section>
  );
}
