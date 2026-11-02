// Progress events emitted by AgentNetwork while it runs. /api/agents streams
// them as newline-delimited JSON for the agents page (app/agents).

export interface AgentTask {
    agent: string;
    instructions: string;
}

export interface AgentProfile {
    name: string;
    description: string;
    model: string;
    lead: boolean;
}

// "plan": the Project Manager writes the task list, "task": an agent works on
// a task, "review": the Supervisor reviews that task's result
export type AgentStepKind = "plan" | "task" | "review";

export type AgentEvent =
    | {
          type: "run-start";
          prompt: string;
          agents: AgentProfile[];
          at: number;
      }
    | {
          type: "plan";
          revision: number;
          taskList: AgentTask[];
          at: number;
      }
    | {
          type: "step-start";
          id: string;
          agent: string;
          kind: AgentStepKind;
          revision: number;
          taskIndex?: number;
          instructions?: string;
          at: number;
      }
    | {
          type: "step-finish";
          id: string;
          content: any;
          at: number;
      }
    | {
          type: "revision";
          revision: number;
          report: string;
          at: number;
      }
    | { type: "step-error"; id: string; message: string; at: number }
    | { type: "run-finish"; incomplete?: boolean; report?: string; at: number }
    | { type: "error"; message: string; at: number };

// Distributes Omit over the union so each event keeps its own fields
type WithoutTimestamp<T> = T extends unknown ? Omit<T, "at"> : never;

export type AgentEventInput = WithoutTimestamp<AgentEvent>;

export type AgentEventHandler = (event: AgentEvent) => void;
