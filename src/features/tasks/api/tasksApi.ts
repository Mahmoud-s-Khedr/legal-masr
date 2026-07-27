import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { bridge } from "../../../bridge/commands"; import type { TaskInput, TaskListInput } from "../../../bridge/types";
export const useTaskList=(input:TaskListInput={})=>useQuery({queryKey:["tasks",input],queryFn:()=>bridge.taskList(input)});
export const useSaveTask=()=>{const q=useQueryClient();return useMutation({mutationFn:(input:TaskInput)=>input.id?bridge.taskUpdate(input):bridge.taskCreate(input),onSuccess:()=>q.invalidateQueries({queryKey:["tasks"]})})};
export const useCompleteTask=()=>{const q=useQueryClient();return useMutation({mutationFn:bridge.taskComplete,onSuccess:()=>q.invalidateQueries({queryKey:["tasks"]})})};
export const useReopenTask=()=>{const q=useQueryClient();return useMutation({mutationFn:bridge.taskReopen,onSuccess:()=>q.invalidateQueries({queryKey:["tasks"]})})};
