import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { bridge, type DeveloperContact } from '../../bridge/commands';

const contacts: { kind: DeveloperContact; href: string; value?: string }[] = [
  {
    kind: 'email',
    href: 'mailto:Mahmoud.s.khedr.2@gmail.com',
    value: 'Mahmoud.s.khedr.2@gmail.com',
  },
  { kind: 'phone', href: 'tel:+201016240934', value: '+201016240934' },
  { kind: 'whatsapp', href: 'https://wa.me/201016240934' },
  { kind: 'telegram', href: 'https://t.me/+201016240934' },
  { kind: 'linkedin', href: 'https://www.linkedin.com/in/mahmoud-s-khedr/' },
];

export function DeveloperContacts() {
  const { t } = useTranslation();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function openContact(contact: DeveloperContact) {
    if (pending) return;
    setPending(true);
    setFailed(false);
    try {
      await bridge.openDeveloperContact(contact);
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="developer-contacts">
      <p className="developer-credit">{t('settings.about.createdBy')}</p>
      <nav className="developer-contact-links" aria-label={t('settings.about.contactLabel')}>
        {contacts.map(({ kind, href, value }) => (
          <a
            key={kind}
            href={href}
            aria-disabled={pending}
            onClick={(event) => {
              event.preventDefault();
              void openContact(kind);
            }}
          >
            {t(`settings.about.${kind}`)}
            {value && (
              <>
                : <bdi dir="ltr">{value}</bdi>
              </>
            )}
          </a>
        ))}
      </nav>
      {failed && <p role="alert">{t('settings.about.openError')}</p>}
    </div>
  );
}
