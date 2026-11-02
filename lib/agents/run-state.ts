import { AgentEvent, AgentProfile, AgentStepKind, AgentTask } from "./events";

// Snapshot of an agent network run, built from its events. The call_agents
// tool streams these to the chat, which renders them in the agents card.

export interface AgentStep {
    id: string;
    agent: string;
    kind: AgentStepKind;
    revision: number;
    taskIndex?: number;
    instructions?: string;
    startedAt: number;
    finishedAt?: number;
    content?: any;
    error?: string;
}

export interface AgentPlan {
    revision: number;
    taskList: AgentTask[];
    at: number;
}

export interface AgentRevision {
    revision: number;
    report: string;
    at: number;
}

export type RunStatus = "running" | "done" | "partial" | "error";

export interface AgentRunState {
    status: RunStatus;
    agents: AgentProfile[];
    plans: AgentPlan[];
    revisions: AgentRevision[];
    steps: AgentStep[];
    startedAt: number;
    finishedAt?: number;
    error?: string;
}

export const createRunState = (startedAt = Date.now()): AgentRunState => ({
    status: "running",
    agents: [],
    plans: [],
    revisions: [],
    steps: [],
    startedAt
});

export const applyAgentEvent = (
    state: AgentRunState,
    event: AgentEvent
): AgentRunState => {
    switch (event.type) {
        case "run-start":
            return { ...state, agents: event.agents, startedAt: event.at };
        case "plan":
            return {
                ...state,
                plans: [
                    ...state.plans,
                    {
                        revision: event.revision,
                        taskList: event.taskList,
                        at: event.at
                    }
                ]
            };
        case "revision":
            return {
                ...state,
                revisions: [
                    ...state.revisions,
                    {
                        revision: event.revision,
                        report: event.report,
                        at: event.at
                    }
                ]
            };
        case "step-start":
            return {
                ...state,
                steps: [
                    ...state.steps,
                    {
                        id: event.id,
                        agent: event.agent,
                        kind: event.kind,
                        revision: event.revision,
                        taskIndex: event.taskIndex,
                        instructions: event.instructions,
                        startedAt: event.at
                    }
                ]
            };
        case "step-finish":
            return {
                ...state,
                steps: state.steps.map((step) =>
                    step.id === event.id
                        ? { ...step, finishedAt: event.at, content: event.content }
                        : step
                )
            };
        case "step-error":
            return { ...state, steps: state.steps.map((step) =>
                step.id === event.id
                    ? { ...step, finishedAt: event.at, error: event.message }
                    : step) };
        case "run-finish":
            return { ...state, status: event.incomplete ? "partial" : "done",
                error: event.report, finishedAt: event.at };
        case "error":
            return {
                ...state,
                status: "error",
                error: event.message,
                finishedAt: event.at
            };
    }
};

export type TaskStatus =
    | "pending"
    | "working"
    | "reviewing"
    | "done"
    | "stopped"
    | "approved"
    | "flagged"
    | "skipped";

// Status of each task in a plan. `live` is false once the run has ended
// (finished, failed or stopped by the user).
export const getTaskStatuses = (
    state: AgentRunState,
    plan: AgentPlan,
    live: boolean
): TaskStatus[] => {
    const superseded =
        !live || state.plans.some((other) => other.revision > plan.revision);

    return plan.taskList.map((_, index) => {
        const find = (kind: AgentStepKind) =>
            state.steps.find(
                (step) =>
                    step.kind === kind &&
                    step.revision === plan.revision &&
                    step.taskIndex === index
            );
        const task = find("task");
        const review = find("review");

        if (!task) return superseded ? "skipped" : "pending";
        if (task.error || review?.error) return "flagged";
        if (task.finishedAt === undefined) return superseded ? "stopped" : "working";
        // Finished but the run ended before the review completed
        if (review?.finishedAt === undefined) return superseded ? "done" : "reviewing";
        return review.content?.needsRevision ? "flagged" : "approved";
    });
};

interface LegacyAgentMessage {
    agent: string;
    content: any;
    type: "task" | "result" | "review";
}

// Chats saved before progress streaming only stored the message list
export const runStateFromMessages = (
    messages: LegacyAgentMessage[]
): AgentRunState => {
    const state = createRunState(0);
    let revision = -1;
    let taskIndex = 0;
    const steps: AgentStep[] = [];
    const plans: AgentPlan[] = [];

    messages.forEach((message, index) => {
        if (message.type === "task") {
            revision++;
            taskIndex = 0;
            plans.push({
                revision,
                taskList: message.content?.taskList ?? [],
                at: 0
            });
        }
        const kind: AgentStepKind =
            message.type === "task"
                ? "plan"
                : message.type === "review"
                  ? "review"
                  : "task";
        const plan = plans.at(-1);
        steps.push({
            id: `step-${index + 1}`,
            agent: message.agent,
            kind,
            revision: Math.max(revision, 0),
            taskIndex: kind === "plan" ? undefined : taskIndex,
            instructions:
                kind === "task"
                    ? plan?.taskList[taskIndex]?.instructions
                    : undefined,
            startedAt: 0,
            finishedAt: 0,
            content: message.content
        });
        if (kind === "review") taskIndex++;
    });

    const agents = [...new Set(steps.map((step) => step.agent))].map(
        (name) => ({
            name,
            description: "",
            model: "",
            lead: name === "Project Manager" || name === "Supervisor"
        })
    );

    return { ...state, status: "done", agents, plans, steps, finishedAt: 0 };
};

// What the chat model gets back from call_agents. Like subagents in other
// frameworks, it sees the agents' deliverables, not their whole conversation:
// each task's latest successful result (without thinking), plus the Supervisor's
// open concerns if the run ended with a revision still requested.
export const summarizeRunForModel = (run: AgentRunState) => {
    const latestByTask = new Map<string, AgentStep>();
    for (const step of run.steps) {
        if (step.kind === "task" && step.finishedAt !== undefined && !step.error) {
            // A worker may produce several independent deliverables after a
            // large task is split. Keep each one, replacing only repeat work
            // on the same task (e.g. a later revision).
            const key = JSON.stringify([step.agent, step.instructions ?? ""]);
            latestByTask.delete(key);
            latestByTask.set(key, step);
        }
    }
    const results = [...latestByTask.values()].map((step) => {
        const { innerThinking: _thinking, ...output } = step.content ?? {};
        return { agent: step.agent, task: step.instructions, output };
    });

    const lastReview = run.steps.findLast(
        (step) => step.kind === "review" && step.finishedAt !== undefined
    );
    const openConcerns = run.error || (lastReview?.error
        ? lastReview.error
        : lastReview?.content?.needsRevision
          ? lastReview.content.report || lastReview.content.summary
          : undefined);
    const failures = run.steps.filter((step) => step.error).map((step) => ({
        agent: step.agent, task: step.instructions, error: step.error
    }));

    return { results, ...(failures.length && { failures }), ...(openConcerns && { openConcerns }) };
};
