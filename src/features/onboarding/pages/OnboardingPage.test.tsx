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
import { OnboardingPage, type OnboardingSubGate } from './OnboardingPage';
function mount(subGate: OnboardingSubGate) {
  const callbacks = {
    onSwitchToRecovery: vi.fn(),
    onBackToUnlock: vi.fn(),
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
