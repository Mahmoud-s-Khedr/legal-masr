/** Canonical query-key factories. Feature hooks use these instead of ad-hoc arrays. */
export const queryKeys = {
  appStatus: ['app-status'] as const,
  settings: ['settings'] as const,
  profile: ['profile'] as const,
  backups: {
    latestSuccessful: ['backups', 'latest-successful'] as const,
  },
  clients: {
    all: ['clients'] as const,
    list: (input: object) => ['clients', 'list', input] as const,
    detail: (id: string) => ['clients', id] as const,
    account: (id: string) => ['clients', id, 'account'] as const,
    relationships: (id: string) => ['clients', id, 'relationships'] as const,
  },
  cases: {
    all: ['cases'] as const,
    list: (input: object) => ['cases', 'list', input] as const,
    detail: (id: string) => ['cases', id] as const,
    summary: (id: string) => ['cases', id, 'summary'] as const,
    account: (id: string) => ['cases', id, 'account'] as const,
    relationships: (id: string) => ['cases', id, 'relationships'] as const,
  },
  powersOfAttorney: {
    all: ['powers-of-attorney'] as const,
    list: (input: object) => ['powers-of-attorney', 'list', input] as const,
    detail: (id: string) => ['powers-of-attorney', id] as const,
  },
  hearings: {
    all: ['hearings'] as const,
    list: (input: object) => ['hearings', 'list', input] as const,
  },
  tasks: {
    all: ['tasks'] as const,
    list: (input: object) => ['tasks', 'list', input] as const,
  },
  agenda: ['agenda'] as const,
  today: {
    all: ['today'] as const,
    summary: (date: string) => ['today', 'summary', date] as const,
  },
  payments: {
    all: ['payments'] as const,
    list: (input: object) => ['payments', 'list', input] as const,
  },
  expenses: {
    all: ['expenses'] as const,
    list: (input: object) => ['expenses', 'list', input] as const,
  },
  attachments: {
    all: ['attachments'] as const,
    list: (input: object) => ['attachments', 'list', input] as const,
  },
  search: {
    all: ['search'] as const,
    results: (query: string) => ['search', 'results', query] as const,
  },
} as const;
