import { useQuery } from '@tanstack/react-query';
import { bridge } from '../../../bridge/commands';
import { queryKeys } from '../../../lib/queryKeys';

export const useGlobalSearch = (query: string) =>
  useQuery({
    queryKey: queryKeys.search.results(query),
    queryFn: () => bridge.searchGlobal(query),
    enabled: query.trim().length > 0,
  });
