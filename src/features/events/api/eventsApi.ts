import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"; import { bridge } from "../../../bridge/commands"; import type { EventInput,EventListInput } from "../../../bridge/types";
export const useEventList=(input:EventListInput={})=>useQuery({queryKey:["events",input],queryFn:()=>bridge.eventList(input)});
export const useSaveEvent=()=>{const q=useQueryClient();return useMutation({mutationFn:(input:EventInput)=>input.id?bridge.eventUpdate(input):bridge.eventCreate(input),onSuccess:()=>q.invalidateQueries({queryKey:["events"]})})};
export const useCompleteEvent=()=>{const q=useQueryClient();return useMutation({mutationFn:bridge.eventComplete,onSuccess:()=>{q.invalidateQueries({queryKey:["events"]});q.invalidateQueries({queryKey:["tasks"]})}})};
