import { useTranslation } from 'react-i18next';
import type { CaseSummary, HearingDto } from '../../../bridge/types';
import { formatNameList } from '../../../lib/format';
import { useFormat } from '../../../i18n/LocalePresentation';
import { OfficialReference } from '../../cases/components/CaseIdentity';
import { useProfile } from '../../settings/api/settingsApi';

/** Hearings without a time come last, the rest in court order. */
export const byHearingTime = (a: HearingDto, b: HearingDto) =>
  (a.hearingTime ?? '99:99').localeCompare(b.hearingTime ?? '99:99');

/**
 * The day's hearing roll (رول الجلسات) as it is printed: one row per hearing, with an
 * empty column for writing the decision in court. Shown only when printing.
 */
export function HearingRoll({
  date,
  hearings,
  cases,
}: {
  date: string;
  hearings: HearingDto[];
  cases: CaseSummary[];
}) {
  const { t, i18n } = useTranslation();
  const format = useFormat();
  const { data: profile } = useProfile();
  const caseOf = (id: string) => cases.find((item) => item.id === id);

  return (
    <section className="hearing-roll print-only print-focus" aria-hidden="true">
      <header>
        <h2>
          {t('agenda.rollTitle')} — <bdi>{format.dateLong(date)}</bdi>
        </h2>
        {profile?.fullName && (
          <p>
            <bdi>{profile.fullName}</bdi>
            {profile.officeAddress && (
              <>
                {' · '}
                <bdi>{profile.officeAddress}</bdi>
              </>
            )}
          </p>
        )}
      </header>
      <table>
        <thead>
          <tr>
            <th>{t('agenda.rollColumns.time')}</th>
            <th>{t('agenda.rollColumns.case')}</th>
            <th>{t('agenda.rollColumns.clients')}</th>
            <th>{t('agenda.rollColumns.court')}</th>
            <th>{t('agenda.rollColumns.preparation')}</th>
            <th className="hearing-roll-decision">{t('agenda.rollColumns.decision')}</th>
          </tr>
        </thead>
        <tbody>
          {[...hearings].sort(byHearingTime).map((hearing) => {
            const item = caseOf(hearing.caseId);
            return (
              <tr key={hearing.id}>
                <td>{hearing.hearingTime ? format.time(hearing.hearingTime) : '—'}</td>
                <td>
                  <bdi>{item?.internalNumber ?? '—'}</bdi>
                  {item?.officialNumber && (
                    <div>
                      <OfficialReference
                        number={item.officialNumber}
                        year={item.officialYear}
                        judicialYear={item.judicialYear}
                      />
                    </div>
                  )}
                  {hearing.hearingType && <div dir="auto">{hearing.hearingType}</div>}
                </td>
                <td dir="auto">
                  {(item
                    ? formatNameList(item.clientNames, i18n.resolvedLanguage === 'en' ? 'en' : 'ar')
                    : '') || '—'}
                </td>
                <td dir="auto">
                  {[hearing.location, hearing.circuitName].filter(Boolean).join(' · ') || '—'}
                </td>
                <td dir="auto">{hearing.requiredDocuments ?? ''}</td>
                <td className="hearing-roll-decision">
                  {hearing.status !== 'SCHEDULED' ? (hearing.decisionText ?? '') : ''}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
