import { fireEvent, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../../bridge/commands', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../bridge/commands')>();
  return { bridge: Object.fromEntries(Object.keys(original.bridge).map((key) => [key, vi.fn()])) };
});
import { bridge } from '../../../bridge/commands';
import i18n from '../../../i18n';
import { renderWorkflow } from '../../../test/workflow';
import { clearRestoreNotice, markRestored } from '../../../lib/restoreNotice';
import { OnboardingPage, type OnboardingSubGate } from './OnboardingPage';
function mount(subGate: OnboardingSubGate) {
  const callbacks = {
    onSwitchToRecovery: vi.fn(),
    onBackToUnlock: vi.fn(),
    onStartRestore: vi.fn(),
    onBackToSetup: vi.fn(),
    onRestored: vi.fn(),
    onSetupSucceeded: vi.fn(),
    onUnlocked: vi.fn(),
    onRecovered: vi.fn(),
    onRecoveryKeySaved: vi.fn(),
  };
  return {
    ...renderWorkflow(
      <OnboardingPage subGate={subGate} recoveryKey="fictional-recovery" {...callbacks} />,
    ),
    callbacks,
  };
}
beforeEach(async () => {
  vi.resetAllMocks();
  clearRestoreNotice();
  await i18n.changeLanguage('ar');
});
describe('vault forms', () => {
  it('shows only the current gate error when switching from unlock to recovery', async () => {
    vi.mocked(bridge.unlock).mockRejectedValue({
      code: 'INVALID_PASSWORD',
      message: 'Fictional refusal',
      details: null,
    });
    vi.mocked(bridge.recover).mockRejectedValue({
      code: 'RECOVERY_KEY_INVALID',
      message: 'Fictional refusal',
      details: null,
    });
    function Gates() {
      const [subGate, setSubGate] = useState<OnboardingSubGate>('unlock');
      return (
        <OnboardingPage
          subGate={subGate}
          recoveryKey=""
          onSwitchToRecovery={() => setSubGate('recovery')}
          onBackToUnlock={() => setSubGate('unlock')}
          onSetupSucceeded={vi.fn()}
          onUnlocked={vi.fn()}
          onRecovered={vi.fn()}
          onRecoveryKeySaved={vi.fn()}
        />
      );
    }
    renderWorkflow(<Gates />);
    fireEvent.change(screen.getByLabelText('كلمة المرور'), {
      target: { value: 'fictional password 2026' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'فتح' }).closest('form')!);
    expect(await screen.findByRole('alert')).toHaveTextContent('كلمة المرور غير صحيحة');
    fireEvent.click(screen.getByRole('button', { name: 'لدي مفتاح الاسترداد' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('مفتاح الاسترداد'), {
      target: { value: 'fictional invalid key' },
    });
    fireEvent.change(screen.getByLabelText('كلمة المرور الجديدة'), {
      target: { value: 'fictional password 2026' },
    });
    fireEvent.change(screen.getByLabelText('تأكيد كلمة المرور'), {
      target: { value: 'fictional password 2026' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'استعادة الوصول' }).closest('form')!);
    expect(await screen.findByRole('alert')).toHaveTextContent('مفتاح الاسترداد غير صحيح');
  });
  for (const gate of ['setup', 'unlock', 'recovery'] as const) {
    it(`${gate} handles refusal, retains the draft and succeeds on retry`, async () => {
      const method = gate === 'setup' ? 'initialize' : gate === 'unlock' ? 'unlock' : 'recover';
      vi.mocked(bridge[method])
        .mockRejectedValueOnce({
          code:
            gate === 'unlock'
              ? 'INVALID_PASSWORD'
              : gate === 'recovery'
                ? 'RECOVERY_KEY_INVALID'
                : 'OPERATION_FAILED',
          message: 'تعذر فتح الخزنة التجريبية.',
          details: null,
        })
        .mockResolvedValue({ recoveryKey: 'fictional-recovery' } as never);
      const { callbacks, invalidate } = mount(gate);
      if (gate === 'setup')
        fireEvent.change(screen.getByLabelText('اسم المحامي'), {
          target: { value: 'محامٍ خيالي' },
        });
      if (gate === 'recovery')
        fireEvent.change(screen.getByLabelText('مفتاح الاسترداد'), {
          target: { value: 'fictional-recovery' },
        });
      fireEvent.change(
        screen.getByLabelText(gate === 'recovery' ? 'كلمة المرور الجديدة' : 'كلمة المرور'),
        { target: { value: 'fictional password 2026' } },
      );
      if (gate !== 'unlock')
        fireEvent.change(screen.getByLabelText('تأكيد كلمة المرور'), {
          target: { value: 'fictional password 2026' },
        });
      fireEvent.submit(
        screen
          .getByRole('button', {
            name: gate === 'setup' ? 'بدء الاستخدام' : gate === 'unlock' ? 'فتح' : 'استعادة الوصول',
          })
          .closest('form')!,
      );
      expect(await screen.findByRole('alert')).toHaveTextContent(
        gate === 'unlock'
          ? 'كلمة المرور غير صحيحة'
          : gate === 'recovery'
            ? 'مفتاح الاسترداد غير صحيح'
            : 'تعذر إتمام العملية',
      );
      expect(invalidate).not.toHaveBeenCalled();
      expect(
        screen.getByLabelText(gate === 'recovery' ? 'كلمة المرور الجديدة' : 'كلمة المرور'),
      ).toHaveValue('fictional password 2026');
      fireEvent.submit(
        screen
          .getByRole('button', {
            name: gate === 'setup' ? 'بدء الاستخدام' : gate === 'unlock' ? 'فتح' : 'استعادة الوصول',
          })
          .closest('form')!,
      );
      await waitFor(() => expect(invalidate).toHaveBeenCalled());
      expect(
        gate === 'setup'
          ? callbacks.onSetupSucceeded
          : gate === 'unlock'
            ? callbacks.onUnlocked
            : callbacks.onRecovered,
      ).toHaveBeenCalled();
    });
  }
  it('offers recovery from the unlock gate', () => {
    const { callbacks } = mount('unlock');
    fireEvent.click(screen.getByRole('button', { name: 'لدي مفتاح الاسترداد' }));
    expect(callbacks.onSwitchToRecovery).toHaveBeenCalledOnce();
  });
  it('explains a short or mismatched new password before contacting the vault', async () => {
    mount('setup');
    fireEvent.change(screen.getByLabelText('اسم المحامي'), { target: { value: 'محامٍ خيالي' } });
    fireEvent.change(screen.getByLabelText('كلمة المرور'), { target: { value: 'short' } });
    fireEvent.change(screen.getByLabelText('تأكيد كلمة المرور'), { target: { value: 'other' } });
    fireEvent.submit(screen.getByRole('button', { name: 'بدء الاستخدام' }).closest('form')!);
    expect(await screen.findByText(/كلمة المرور قصيرة/)).toBeVisible();
    expect(screen.getByText('كلمتا المرور غير متطابقتين.')).toBeVisible();
    expect(bridge.initialize).not.toHaveBeenCalled();
  });
  it('lets the lawyer reveal a password deliberately', () => {
    mount('unlock');
    const password = screen.getByLabelText('كلمة المرور');
    expect(password).toHaveAttribute('type', 'password');
    fireEvent.click(screen.getByRole('button', { name: 'إظهار كلمة المرور' }));
    expect(password).toHaveAttribute('type', 'text');
  });
  it('requires acknowledging the recovery key before continuing', () => {
    const { callbacks } = mount('recovery-key');
    expect(screen.getByText('fictional-recovery')).toBeVisible();
    const proceed = screen.getByRole('button', { name: 'متابعة إلى مساحة العمل' });
    expect(proceed).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(proceed);
    expect(callbacks.onRecoveryKeySaved).toHaveBeenCalledOnce();
  });
  it('returns from recovery to the unlock gate', () => {
    const { callbacks } = mount('recovery');
    fireEvent.click(screen.getByRole('button', { name: 'رجوع إلى الدخول بكلمة المرور' }));
    expect(callbacks.onBackToUnlock).toHaveBeenCalledOnce();
  });
});

describe('restoring an office on a new computer', () => {
  const choice = { token: 'choice-token', fileName: 'LegalMasr-backup-2026-10-08-1052.lmsbackup' };
  const cancelled = { code: 'OPERATION_CANCELLED', message: 'cancelled', details: null };

  it('is offered from the welcome screen and leads back to it', () => {
    const { callbacks, unmount } = mount('setup');
    fireEvent.click(screen.getByRole('button', { name: 'لديّ نسخة احتياطية من جهاز آخر' }));
    expect(callbacks.onStartRestore).toHaveBeenCalledOnce();
    unmount();

    const restore = mount('restore');
    expect(screen.getByRole('heading', { name: 'استعادة مكتبك من نسخة احتياطية' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'رجوع إلى إنشاء مساحة عمل جديدة' }));
    expect(restore.callbacks.onBackToSetup).toHaveBeenCalledOnce();
  });

  it('stays quiet when the file dialog is closed, and explains an old backup', async () => {
    vi.mocked(bridge.chooseBackupToRestore)
      .mockRejectedValueOnce(cancelled)
      .mockRejectedValueOnce({ code: 'BACKUP_NOT_PORTABLE', message: 'safe', details: null });
    mount('restore');
    const choose = screen.getByRole('button', { name: 'اختيار ملف النسخة الاحتياطية…' });

    fireEvent.click(choose);
    await waitFor(() => expect(bridge.chooseBackupToRestore).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(choose).toBeEnabled());
    expect(screen.queryByRole('alert')).toBeNull();

    fireEvent.click(choose);
    expect(await screen.findByRole('alert')).toHaveTextContent('بإصدار أقدم');
    expect(screen.queryByLabelText('كلمة المرور وقت إنشاء النسخة')).toBeNull();
  });

  it('opens the backup with its password, and lets a wrong one be retried', async () => {
    vi.mocked(bridge.chooseBackupToRestore).mockResolvedValue(choice);
    vi.mocked(bridge.restoreFromBackup)
      .mockRejectedValueOnce({ code: 'BACKUP_SECRET_INVALID', message: 'safe', details: null })
      .mockResolvedValueOnce(undefined);
    const { callbacks } = mount('restore');

    fireEvent.click(screen.getByRole('button', { name: 'اختيار ملف النسخة الاحتياطية…' }));
    expect(await screen.findByText(/LegalMasr-backup-2026-10-08-1052\.lmsbackup/)).toBeVisible();
    const password = screen.getByLabelText('كلمة المرور وقت إنشاء النسخة');
    fireEvent.change(password, { target: { value: 'the old office password' } });
    fireEvent.submit(screen.getByRole('button', { name: 'استعادة البيانات' }).closest('form')!);

    expect(await screen.findByRole('alert')).toHaveTextContent('لا يفتح هذه النسخة');
    expect(password).toHaveValue('the old office password');
    expect(callbacks.onRestored).not.toHaveBeenCalled();

    fireEvent.submit(screen.getByRole('button', { name: 'استعادة البيانات' }).closest('form')!);
    await waitFor(() => expect(callbacks.onRestored).toHaveBeenCalledOnce());
    expect(vi.mocked(bridge.restoreFromBackup).mock.calls[1]?.[0]).toEqual({
      token: 'choice-token',
      language: 'ar',
      password: 'the old office password',
    });
  });

  it('opens the backup with the recovery key and a new password', async () => {
    vi.mocked(bridge.chooseBackupToRestore).mockResolvedValue(choice);
    vi.mocked(bridge.restoreFromBackup).mockResolvedValue(undefined);
    const { callbacks } = mount('restore');

    fireEvent.click(screen.getByRole('button', { name: 'اختيار ملف النسخة الاحتياطية…' }));
    fireEvent.click(await screen.findByRole('button', { name: 'بمفتاح الاسترداد' }));
    fireEvent.change(screen.getByLabelText('مفتاح الاسترداد'), {
      target: { value: 'ABCD-EFGH-IJKL' },
    });
    fireEvent.change(screen.getByLabelText('كلمة المرور الجديدة'), { target: { value: 'short' } });
    fireEvent.change(screen.getByLabelText('تأكيد كلمة المرور'), { target: { value: 'short' } });
    fireEvent.submit(screen.getByRole('button', { name: 'استعادة البيانات' }).closest('form')!);
    expect(await screen.findByText(/كلمة المرور قصيرة/)).toBeVisible();
    expect(bridge.restoreFromBackup).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('كلمة المرور الجديدة'), {
      target: { value: 'a brand new office password' },
    });
    fireEvent.change(screen.getByLabelText('تأكيد كلمة المرور'), {
      target: { value: 'a brand new office password' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'استعادة البيانات' }).closest('form')!);
    await waitFor(() => expect(callbacks.onRestored).toHaveBeenCalledOnce());
    expect(vi.mocked(bridge.restoreFromBackup).mock.calls[0]?.[0]).toEqual({
      token: 'choice-token',
      language: 'ar',
      recoveryKey: 'ABCD-EFGH-IJKL',
      newPassword: 'a brand new office password',
    });
  });

  it('tells the lawyer on the password screen that a restore just finished', async () => {
    markRestored();
    vi.mocked(bridge.unlock).mockResolvedValue(undefined);
    const { callbacks } = mount('unlock');
    expect(screen.getByRole('status')).toHaveTextContent('تمت استعادة النسخة الاحتياطية');

    fireEvent.change(screen.getByLabelText('كلمة المرور'), {
      target: { value: 'fictional password 2026' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'فتح' }).closest('form')!);
    await waitFor(() => expect(callbacks.onUnlocked).toHaveBeenCalledOnce());
    mount('unlock');
    expect(screen.queryByText(/تمت استعادة النسخة الاحتياطية/)).toBeNull();
  });

  it('shows how to reach support when the vault needs help the lawyer cannot give', async () => {
    vi.mocked(bridge.unlock).mockRejectedValue({
      code: 'VAULT_CORRUPT',
      message: 'safe',
      details: null,
    });
    mount('unlock');
    expect(screen.queryByText(/\+201016240934/)).toBeNull();
    fireEvent.change(screen.getByLabelText('كلمة المرور'), {
      target: { value: 'fictional password 2026' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'فتح' }).closest('form')!);
    expect(await screen.findByRole('alert')).toHaveTextContent('تواصل مع الدعم الفني');
    expect(screen.getByRole('region', { name: 'الدعم الفني' })).toHaveTextContent('+201016240934');
  });
});
