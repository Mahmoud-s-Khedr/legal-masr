import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bridge } from '../../../bridge/commands';
import type { TaskInput, TaskListInput } from '../../../bridge/types';
import { queryInvalidation } from '../../../lib/queryInvalidation';
import { queryKeys } from '../../../lib/queryKeys';
export const useTaskList = (input: TaskListInput) =>
  useQuery({ queryKey: queryKeys.tasks.list(input), queryFn: () => bridge.taskList(input) });
export const useSaveTask = () => {
  const q = useQueryClient();
  return useMutation({
    mutationFn: (input: TaskInput) =>
      input.id ? bridge.taskUpdate(input) : bridge.taskCreate(input),
    onSuccess: (task) =>
      queryInvalidation.taskCompletion(q, { caseId: task.caseId, clientId: task.clientId }),
  });
};
export const useCreateTask = useSaveTask;
export const useCompleteTask = () => {
  const q = useQueryClient();
  return useMutation({
    mutationFn: bridge.taskComplete,
    onSuccess: (task) =>
      queryInvalidation.taskCompletion(q, { caseId: task.caseId, clientId: task.clientId }),
  });
};
export const useReopenTask = () => {
  const q = useQueryClient();
  return useMutation({
    mutationFn: bridge.taskReopen,
    onSuccess: (task) =>
      queryInvalidation.taskCompletion(q, { caseId: task.caseId, clientId: task.clientId }),
  });
};
export const useDeleteTask = () => {
  const q = useQueryClient();
  return useMutation({
    mutationFn: (task: { id: string; caseId: string | null; clientId: string | null }) =>
      bridge.taskDelete(task.id),
    onSuccess: (_result, task) =>
      queryInvalidation.taskCompletion(q, { caseId: task.caseId, clientId: task.clientId }),
  });
};
