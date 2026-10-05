import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SearchHit } from '../../../bridge/types';
import i18n from '../../../i18n';
import { GlobalSearch } from './GlobalSearch';
import { useGlobalSearch } from '../api/searchApi';

vi.mock('../api/searchApi', () => ({ useGlobalSearch: vi.fn() }));

const hits: SearchHit[] = [
  { entityType: 'CLIENT', entityId: 'client-1', title: 'أحمد علي', subtitle: 'C-1' },
  { entityType: 'CASE', entityId: 'case-1', title: '12/2026', subtitle: 'أحمد علي' },
  { entityType: 'POWER_OF_ATTORNEY', entityId: 'poa-1', title: 'توكيل عام', subtitle: 'أحمد علي' },
];

function SearchHarness({ palette = false }: { palette?: boolean }) {
  const [query, setQuery] = useState('');
  return <GlobalSearch query={query} onQueryChange={setQuery} palette={palette} />;
}

function Location() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

describe('GlobalSearch', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('ar');
  });

  afterEach(() => vi.clearAllMocks());

  it('debounces grouped results and routes the selected record', async () => {
    vi.mocked(useGlobalSearch).mockReturnValue({ data: hits } as ReturnType<
      typeof useGlobalSearch
    >);
    render(
      <MemoryRouter>
        <SearchHarness />
        <Location />
      </MemoryRouter>,
    );

    const input = screen.getByRole('combobox', { name: 'البحث العام' });
    fireEvent.change(input, { target: { value: 'أحمد' } });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    await screen.findByRole('listbox');
    expect(screen.getByText('الموكلون')).toBeInTheDocument();
    expect(screen.getByText('القضايا')).toBeInTheDocument();
    expect(screen.getByText('التوكيلات')).toBeInTheDocument();

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByTestId('location')).toHaveTextContent('/cases/case-1');
    expect(input).toHaveValue('');
  });

  it('shows the empty state and dismisses a command-palette search with Escape', async () => {
    const onNavigate = vi.fn();
    vi.mocked(useGlobalSearch).mockReturnValue({ data: [] } as unknown as ReturnType<
      typeof useGlobalSearch
    >);
    render(
      <MemoryRouter>
        <GlobalSearch
          query="غير موجود"
          onQueryChange={() => undefined}
          palette
          onNavigate={onNavigate}
        />
      </MemoryRouter>,
    );

    expect(await screen.findByText('لا توجد نتائج مطابقة.')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' });
    expect(onNavigate).toHaveBeenCalledOnce();
  });
});
