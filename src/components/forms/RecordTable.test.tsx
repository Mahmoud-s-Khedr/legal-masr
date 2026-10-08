import { fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { RecordTable } from './RecordTable';
import i18n from '../../i18n';
describe('record tables', () => {
  it('sorts records and paginates locally at 25 rows', async () => {
    await i18n.changeLanguage('en');
    render(
      <RecordTable>
        <thead>
          <tr>
            <th>Name</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 26 }, (_, i) => (
            <tr key={i}>
              <td>Record {26 - i}</td>
            </tr>
          ))}
        </tbody>
      </RecordTable>,
    );
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(26);
    fireEvent.click(screen.getByRole('button', { name: 'Name' }));
    expect(within(screen.getByRole('table')).getAllByRole('row')[1]).toHaveTextContent('Record 1');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() =>
      expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2),
    );
    expect(screen.getByText('Record 26')).toBeVisible();
    await i18n.changeLanguage('ar');
  });
});
