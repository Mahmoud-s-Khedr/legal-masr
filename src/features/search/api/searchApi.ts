import { useQuery } from "@tanstack/react-query";
import { bridge } from "../../../bridge/commands";

export const useGlobalSearch = (query: string) =>
  useQuery({
    queryKey: ["search", query],
    queryFn: () => bridge.searchGlobal(query),
    enabled: query.trim().length > 0,
  });
