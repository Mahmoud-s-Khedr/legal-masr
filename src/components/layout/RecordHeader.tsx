import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

/** Identity strip at the top of a client, case or power-of-attorney file. */
export function RecordHeader({
  icon,
  initial,
  kicker,
  title,
  meta,
  badges,
  actions,
}: {
  icon?: IconName;
  initial?: string;
  kicker: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  badges?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="record-header">
      <div className="record-mark" aria-hidden="true">
        {initial ? initial : icon ? <Icon name={icon} size={26} /> : null}
      </div>
      <div className="record-identity">
        <div className="record-kicker">
          <span className="kicker">{kicker}</span>
          {badges}
        </div>
        <h2>{title}</h2>
        {meta && <div className="record-meta">{meta}</div>}
      </div>
      {actions && <div className="record-actions">{actions}</div>}
    </header>
  );
}

/** One labelled fact; empty values render a quiet dash. */
export function Fact({
  label,
  children,
  wide,
}: {
  label: ReactNode;
  children?: ReactNode;
  wide?: boolean;
}) {
  const empty = children === null || children === undefined || children === '';
  return (
    <div className={wide ? 'fact fact-wide' : 'fact'}>
      <dt>{label}</dt>
      <dd className={empty ? 'fact-empty' : undefined}>{empty ? '—' : children}</dd>
    </div>
  );
}
