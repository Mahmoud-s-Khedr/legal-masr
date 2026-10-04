import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AttachmentDto } from '../../../bridge/types';
import { queryKeys } from '../../../lib/queryKeys';
vi.mock('../../../bridge/commands', () => ({
  bridge: {
    attachmentList: vi.fn(),
    attachmentSelectSource: vi.fn(),
    attachmentAdd: vi.fn(),
    attachmentUpdate: vi.fn(),
    attachmentRemove: vi.fn(),
    attachmentOpen: vi.fn(),
    attachmentReveal: vi.fn(),
  },
}));
import { bridge } from '../../../bridge/commands';
import { AttachmentPanel } from './AttachmentPanel';
const item: AttachmentDto = {
  id: 'fictional-file',
  clientId: 'fictional-client',
  caseId: null,
  powerOfAttorneyId: null,
  expenseId: null,
  originalFilename: 'fictional.pdf',
  storedFilename: 'managed.pdf',
  relativePath: 'managed.pdf',
  category: 'OTHER',
  description: 'بيانات خيالية',
  documentDate: '2026-10-03',
  mimeType: null,
  fileSizeBytes: 7,
  sha256: 'a'.repeat(64),
  createdAt: '2026-10-03T09:00:00Z',
  updatedAt: '2026-10-03T09:00:00Z',
};
const failure = (code = 'OPERATION_FAILED') => ({ code, message: 'خطأ تجريبي', details: null });
function mount() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  render(
    <QueryClientProvider client={queryClient}>
      <AttachmentPanel owner={{ clientId: 'fictional-client' }} />
    </QueryClientProvider>,
  );
  return { queryClient, invalidate };
}
async function addDraft() {
  fireEvent.click(screen.getByRole('button', { name: 'إضافة مرفق' }));
  fireEvent.change(screen.getByLabelText('الوصف'), { target: { value: 'مسودة محفوظة' } });
  fireEvent.click(screen.getByRole('button', { name: 'اختيار ملف' }));
  await screen.findByText('selected.pdf');
}
describe('managed attachments with real query hooks', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(bridge.attachmentList).mockResolvedValue([]);
    vi.mocked(bridge.attachmentSelectSource).mockResolvedValue({
      sourceToken: 'single-use',
      filename: 'selected.pdf',
    });
    vi.mocked(bridge.attachmentAdd).mockResolvedValue(item);
    vi.mocked(bridge.attachmentUpdate).mockResolvedValue(item);
    vi.mocked(bridge.attachmentRemove).mockResolvedValue(undefined);
  });
  it('shows loading, empty and owner-scoped reads', async () => {
    let resolve!: (value: AttachmentDto[]) => void;
    vi.mocked(bridge.attachmentList).mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    mount();
    expect(screen.getByText('جارٍ تحميل المرفقات…')).toBeVisible();
    resolve([]);
    expect(await screen.findByText('لا توجد مرفقات بعد.')).toBeVisible();
    expect(bridge.attachmentList).toHaveBeenCalledWith({ clientId: 'fictional-client' });
  });
  it('distinguishes a rejected read from an empty list', async () => {
    vi.mocked(bridge.attachmentList).mockRejectedValue(failure());
    mount();
    expect(await screen.findByRole('alert')).toHaveTextContent('تعذر تحميل');
    expect(screen.queryByText('لا توجد مرفقات بعد.')).not.toBeInTheDocument();
  });
  it('shows populated filenames and timezone-free document dates', async () => {
    vi.mocked(bridge.attachmentList).mockResolvedValue([item]);
    mount();
    expect(await screen.findByText('fictional.pdf')).toBeVisible();
    expect(screen.getByText('2026-10-03').tagName).toBe('BDI');
  });
  it('adds once while pending, closes only on success and refreshes affected views', async () => {
    let resolve!: (value: AttachmentDto) => void;
    vi.mocked(bridge.attachmentAdd).mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const { invalidate } = mount();
    await addDraft();
    const submit = screen.getByRole('button', { name: 'إضافة المرفق' });
    fireEvent.click(submit);
    fireEvent.click(submit);
    await waitFor(() => expect(bridge.attachmentAdd).toHaveBeenCalledOnce());
    expect(submit).toBeDisabled();
    expect(bridge.attachmentAdd).toHaveBeenCalledWith({
      clientId: 'fictional-client',
      sourceToken: 'single-use',
      category: 'OTHER',
      description: 'مسودة محفوظة',
      documentDate: undefined,
    });
    resolve(item);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.attachments.all });
  });
  it('picker cancellation is quiet and performs no mutation', async () => {
    vi.mocked(bridge.attachmentSelectSource).mockRejectedValue(failure('OPERATION_CANCELLED'));
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'إضافة مرفق' }));
    fireEvent.click(screen.getByRole('button', { name: 'اختيار ملف' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'اختيار ملف' })).toBeEnabled());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(bridge.attachmentAdd).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'إلغاء' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('picker failure is handled without discarding metadata', async () => {
    vi.mocked(bridge.attachmentSelectSource).mockRejectedValue(failure());
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'إضافة مرفق' }));
    fireEvent.change(screen.getByLabelText('الوصف'), { target: { value: 'مسودة' } });
    fireEvent.click(screen.getByRole('button', { name: 'اختيار ملف' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('تعذر اختيار');
    expect(screen.getByLabelText('الوصف')).toHaveValue('مسودة');
  });
  it.each(['ATTACHMENT_SOURCE_MISSING', 'OPERATION_FAILED'])(
    'retains failed add metadata and requires a fresh capability: %s',
    async (code) => {
      vi.mocked(bridge.attachmentAdd).mockRejectedValue(failure(code));
      const { invalidate } = mount();
      await addDraft();
      fireEvent.click(screen.getByRole('button', { name: 'إضافة المرفق' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('اختر الملف مرة أخرى');
      expect(screen.getByLabelText('الوصف')).toHaveValue('مسودة محفوظة');
      expect(screen.getByRole('button', { name: 'إضافة المرفق' })).toBeDisabled();
      expect(invalidate).not.toHaveBeenCalled();
      vi.mocked(bridge.attachmentAdd).mockResolvedValue(item);
      vi.mocked(bridge.attachmentSelectSource).mockResolvedValue({
        sourceToken: 'fresh-token',
        filename: 'selected.pdf',
      });
      fireEvent.click(screen.getByRole('button', { name: 'اختيار ملف' }));
      await screen.findByText('selected.pdf');
      fireEvent.click(screen.getByRole('button', { name: 'إضافة المرفق' }));
      await waitFor(() =>
        expect(bridge.attachmentAdd).toHaveBeenLastCalledWith(
          expect.objectContaining({ sourceToken: 'fresh-token', description: 'مسودة محفوظة' }),
        ),
      );
    },
  );
  it('edits, retains the failed draft, retries and invalidates on success', async () => {
    vi.mocked(bridge.attachmentList).mockResolvedValue([item]);
    vi.mocked(bridge.attachmentUpdate).mockRejectedValueOnce(failure());
    const { invalidate } = mount();
    fireEvent.click(await screen.findByRole('button', { name: 'تعديل' }));
    fireEvent.change(screen.getByLabelText('الوصف'), { target: { value: 'تعديل خيالي' } });
    fireEvent.click(screen.getByRole('button', { name: 'حفظ البيانات' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('تعذر حفظ');
    expect(screen.getByLabelText('الوصف')).toHaveValue('تعديل خيالي');
    expect(invalidate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'حفظ البيانات' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(bridge.attachmentUpdate).toHaveBeenLastCalledWith({
      id: item.id,
      category: 'OTHER',
      description: 'تعديل خيالي',
      documentDate: '2026-10-03',
    });
    expect(invalidate).toHaveBeenCalled();
  });
  it.each([
    ['فتح', 'attachmentOpen'],
    ['إظهار', 'attachmentReveal'],
  ] as const)('handles %s failure', async (label, method) => {
    vi.mocked(bridge.attachmentList).mockResolvedValue([item]);
    vi.mocked(bridge[method]).mockRejectedValue(failure());
    mount();
    fireEvent.click(await screen.findByRole('button', { name: label }));
    expect(await screen.findByRole('alert')).toHaveTextContent('تعذر');
    expect(vi.mocked(bridge[method]).mock.calls[0][0]).toBe(item.id);
  });
  it('requires confirmation, preserves failed deletion and refreshes successful deletion', async () => {
    vi.mocked(bridge.attachmentList).mockResolvedValue([item]);
    vi.mocked(bridge.attachmentRemove).mockRejectedValueOnce(failure());
    const { invalidate } = mount();
    fireEvent.click(await screen.findByRole('button', { name: 'إزالة' }));
    fireEvent.click(screen.getByRole('button', { name: 'إلغاء' }));
    expect(bridge.attachmentRemove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'إزالة' }));
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'إزالة المرفق' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('تعذر إزالة');
    expect(invalidate).not.toHaveBeenCalled();
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'إزالة المرفق' }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(invalidate).toHaveBeenCalled();
  });
});
