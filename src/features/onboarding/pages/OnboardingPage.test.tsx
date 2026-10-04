import { fireEvent, screen, waitFor } from '@testing-library/react';
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
        screen.getByLabelText(gate === 'recovery' ? 'كلمة مرور جديدة' : 'كلمة المرور'),
        { target: { value: 'fictional password 2026' } },
      );
      fireEvent.submit(
        screen
          .getByRole('button', {
            name:
              gate === 'setup'
                ? 'إنشاء الخزنة'
                : gate === 'unlock'
                  ? 'فتح الخزنة'
                  : 'استعادة الوصول',
          })
          .closest('form')!,
      );
      expect(await screen.findByRole('alert')).toHaveTextContent('تعذر فتح');
      expect(invalidate).not.toHaveBeenCalled();
      expect(
        screen.getByLabelText(gate === 'recovery' ? 'كلمة مرور جديدة' : 'كلمة المرور'),
      ).toHaveValue('fictional password 2026');
      fireEvent.submit(
        screen
          .getByRole('button', {
            name:
              gate === 'setup'
                ? 'إنشاء الخزنة'
                : gate === 'unlock'
                  ? 'فتح الخزنة'
                  : 'استعادة الوصول',
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
});
