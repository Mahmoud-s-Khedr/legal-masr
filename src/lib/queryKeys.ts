/** Canonical query-key factories. Feature hooks use these instead of ad-hoc arrays. */
export const queryKeys = {
  clients: {
    all: ['clients'] as const,
    detail: (id: string) => ['clients', id] as const,
    account: (id: string) => ['clients', id, 'account'] as const,
    relationships: (id: string) => ['clients', id, 'relationships'] as const,
  },
  cases: {
    all: ['cases'] as const,
    detail: (id: string) => ['cases', id] as const,
    summary: (id: string) => ['cases', id, 'summary'] as const,
    account: (id: string) => ['cases', id, 'account'] as const,
    relationships: (id: string) => ['cases', id, 'relationships'] as const,
  },
  powersOfAttorney: {
    all: ['powers-of-attorney'] as const,
    detail: (id: string) => ['powers-of-attorney', id] as const,
  },
  hearings: { all: ['hearings'] as const },
  tasks: { all: ['tasks'] as const },
  agenda: ['agenda'] as const,
  today: ['today'] as const,
  payments: { all: ['payments'] as const },
  expenses: { all: ['expenses'] as const },
  attachments: { all: ['attachments'] as const },
  search: ['search'] as const,
} as const;
