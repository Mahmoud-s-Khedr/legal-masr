import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../i18n';
import { bridge } from '../../bridge/commands';
import { DeveloperContacts } from './DeveloperContacts';

vi.mock('../../bridge/commands', () => ({ bridge: { openDeveloperContact: vi.fn() } }));

describe('DeveloperContacts', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('ar');
    vi.mocked(bridge.openDeveloperContact).mockResolvedValue();
  });

  it('shows isolated contact values without opening anything on render', () => {
    render(<DeveloperContacts />);
    expect(screen.getByText('طوّر التطبيق محمود خضر')).toBeVisible();
    for (const value of ['Mahmoud.s.khedr.2@gmail.com', '+201016240934']) {
      expect(screen.getByText(value).tagName).toBe('BDI');
      expect(screen.getByText(value)).toHaveAttribute('dir', 'ltr');
    }
    expect(bridge.openDeveloperContact).not.toHaveBeenCalled();
  });

  it.each([
    ['email', 'البريد الإلكتروني', 'mailto:Mahmoud.s.khedr.2@gmail.com'],
    ['phone', 'الهاتف', 'tel:+201016240934'],
    ['whatsapp', 'واتساب', 'https://wa.me/201016240934'],
    ['telegram', 'تيليجرام', 'https://t.me/+201016240934'],
    ['linkedin', 'لينكدإن', 'https://www.linkedin.com/in/mahmoud-s-khedr/'],
  ] as const)('opens %s through the narrow native command', async (kind, label, href) => {
    render(<DeveloperContacts />);
    const link = screen.getByRole('link', { name: new RegExp(label) });
    expect(link).toHaveAttribute('href', href);
    fireEvent.click(link);
    await waitFor(() => expect(bridge.openDeveloperContact).toHaveBeenCalledWith(kind));
    await waitFor(() => expect(link).toHaveAttribute('aria-disabled', 'false'));
  });

  it('shows a safe failure and allows retry', async () => {
    vi.mocked(bridge.openDeveloperContact).mockRejectedValueOnce(new Error('native opener failed'));
    render(<DeveloperContacts />);
    const link = screen.getByRole('link', { name: /البريد الإلكتروني/ });
    fireEvent.click(link);
    expect(await screen.findByRole('alert')).toHaveTextContent('تعذر فتح وسيلة التواصل');
    fireEvent.click(link);
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(bridge.openDeveloperContact).toHaveBeenCalledTimes(2);
  });

  it('ignores repeated clicks while opening', async () => {
    let complete!: () => void;
    vi.mocked(bridge.openDeveloperContact).mockReturnValue(
      new Promise<void>((resolve) => {
        complete = resolve;
      }),
    );
    render(<DeveloperContacts />);
    const link = screen.getByRole('link', { name: /البريد الإلكتروني/ });
    fireEvent.click(link);
    fireEvent.click(link);
    expect(bridge.openDeveloperContact).toHaveBeenCalledTimes(1);
    complete();
    await waitFor(() => expect(link).toHaveAttribute('aria-disabled', 'false'));
  });

  it('provides English labels and the supplied developer name', async () => {
    await i18n.changeLanguage('en');
    render(<DeveloperContacts />);
    expect(screen.getByText('Created by Mahmoud Khedr')).toBeVisible();
    expect(screen.getByRole('navigation', { name: 'Contact the developer' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'WhatsApp' })).toBeVisible();
    await i18n.changeLanguage('ar');
  });
});
