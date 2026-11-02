import { z } from "zod";
import { openai } from "@ai-sdk/openai";
import {
    getModel,
    ModelConfig,
    ModelProvider,
    models,
    reasoningModels
} from "@/lib/utils/model-provider";
import {
    generateText,
    NoObjectGeneratedError,
    NoOutputGeneratedError,
    Output
} from "ai";
import { ReasoningLevel } from "@/lib/types";
import {
    AgentEvent,
    AgentEventHandler,
    AgentEventInput,
    AgentProfile,
    AgentStepKind
} from "./events";

import { AGENT_RUN_TIMEOUT_MS, AGENT_STEP_TIMEOUT_MS } from "./limits";

const MAX_ATTEMPTS = 2;

const errorMessage = (error: unknown) =>
    error instanceof Error ? error.message : String(error);

// Define the Agent interface
interface Agent {
    name: string;
    // Short tagline shown on the agents page
    description: string;
    role: string;
    model: ModelConfig;
    temperature: number;
    maxTokens: number;
    reasoning: ReasoningLevel;
    webSearch: boolean;
    schema: z.ZodType<any>;
    execute: (
        prompt: string,
        context?: any,
        abortSignal?: AbortSignal
    ) => Promise<any>;
}

interface ExecuteOptions {
    onEvent?: AgentEventHandler;
    abortSignal?: AbortSignal;
    runTimeoutMs?: number;
    stepTimeoutMs?: number;
}

interface Message {
    agent: string;
    content: any;
    type: "task" | "result" | "review";
}

interface Task {
    agent: string;
    instructions: string;
}

class ContextManager {
    private _globalMessages: Message[];
    private _prompt: string;
    private _revisionCount: number;
    private _taskList: Task[];
    private _currentTask: Task | null;
    private _lastTaskReview: any;
    private _lastRevisionReport: string;

    constructor(prompt: string) {
        this._globalMessages = [];
        this._prompt = prompt;
        this._revisionCount = 0;
        this._taskList = [];
        this._currentTask = null;
        this._lastTaskReview = null;
        this._lastRevisionReport = "";
    }

    get globalMessages() {
        return this._globalMessages;
    }

    addMessage(message: Message) {
        this._globalMessages.push(message);
    }

    get prompt() {
        return this._prompt;
    }

    set prompt(value) {
        this._prompt = value;
    }

    get revisionCount() {
        return this._revisionCount;
    }

    incrementRevisionCount() {
        this._revisionCount++;
    }

    get taskList() {
        return this._taskList;
    }

    set taskList(taskList: Task[]) {
        this._taskList = [...taskList];
    }

    completeTask() {
        this._taskList.shift();
    }

    taskToString(task?: Task, index?: number) {
        if (!task) return "";

        const tag = index !== undefined ? `task_${index}` : "task";
        return `<${tag}>\nAgent: ${task.agent}\nInstructions: ${task.instructions}\n</${tag}>`;
    }

    taskListToString(taskList: Task[]) {
        return taskList
            .map((task, index) => this.taskToString(task, index))
            .join("\n");
    }

    agentToString(agent: Agent, index: number) {
        return `<agent_${index}>
Agent Name: ${agent.name}
Agent Role: ${agent.role.substring(0, 100)}..
</agent_${index}>`;
    }

    agentListToString(agentList: Agent[]) {
        return agentList
            .map((agent, index) => this.agentToString(agent, index))
            .join("\n");
    }

    get currentTask() {
        return this._currentTask;
    }

    set currentTask(task) {
        this._currentTask = task;
    }

    get lastTaskReview() {
        return this._lastTaskReview;
    }

    set lastTaskReview(review) {
        this._lastTaskReview = review;
    }

    get lastRevisionReport() {
        return this._lastRevisionReport;
    }

    set lastRevisionReport(report) {
        this._lastRevisionReport = report;
    }

    getProjectContext() {
        return `
<project_context>
<original_prompt>
${this._prompt}
</original_prompt>

<last_task_review>
${JSON.stringify(this.lastTaskReview)}
</last_task_review>

<current_task_list>
${this.taskListToString(this._taskList)}
</current_task_list>

<current_task>
${this.taskToString(this._currentTask || undefined)}
</current_task>

<last_revision_report>
${JSON.stringify(this.lastRevisionReport)}
</last_revision_report>
</project_context>
        `;
    }

    createProjectManagerPrompt(agents: Agent[]) {
        const availableAgents = this.agentListToString(agents);

        const finalInstructions =
            this._revisionCount > 0
                ? "Update the task list based on the `project_revision_report` and `project_context`."
                : "Create an initial task list.";

        const revisionReportPrompt = this._lastRevisionReport
            ? `
<project_revision_report>
The project has some issues and the supervisor has decided it needs some revisions.
Use these revisions to create a new tasklist to update the current project. Do not repeat tasks from the previous tasklist if they have already been completed.

## Project Revision Report:
${this._lastRevisionReport}
</project_revision_report>
`
            : "";

        return `
Carefully read the project description and any additional context:

<project_description>
${this._prompt}
</project_description>

${revisionReportPrompt}
${this._revisionCount > 0 ? this.getProjectContext() : ""}

Review the list of available agents and their roles:

<available_agents>
${availableAgents}
</available_agents>

${finalInstructions}
`;
    }
}

// Define the AgentNetwork class
export class AgentNetwork {
    private agents: { [key: string]: Agent };
    private projectManager: Agent;
    private supervisor: Agent;
    private maxRevisions: number = 2;

    constructor(
        projectManager: Agent,
        supervisor: Agent,
        maxRevisions: number = 2
    ) {
        this.agents = {};
        this.projectManager = projectManager;
        this.supervisor = supervisor;
        this.maxRevisions = maxRevisions;
    }

    addAgent(agent: Agent) {
        this.agents[agent.name] = agent;
    }

    listAgents() {
        return Object.values(this.agents);
    }

    getProfiles(): AgentProfile[] {
        const profile = (agent: Agent, lead: boolean) => ({
            name: agent.name,
            description: agent.description,
            model: agent.model.name,
            lead
        });
        return [
            profile(this.projectManager, true),
            profile(this.supervisor, true),
            ...this.listAgents().map((agent) => profile(agent, false))
        ];
    }

    async executePrompt(
        prompt: string,
        additionalContext: string = "",
        initialTaskList?: Task[],
        {
            onEvent,
            abortSignal,
            runTimeoutMs = AGENT_RUN_TIMEOUT_MS,
            stepTimeoutMs = AGENT_STEP_TIMEOUT_MS
        }: ExecuteOptions = {}
    ): Promise<Message[]> {
        const contextManager = new ContextManager(
            `\n${prompt}\n\n## Additional Context:\n${additionalContext}`
        );
        const emit = (event: AgentEventInput) =>
            onEvent?.({ ...event, at: Date.now() } as AgentEvent);
        const runController = new AbortController();
        const runTimer = setTimeout(() => runController.abort(new Error(
            "Agent run reached its time budget. Completed results are preserved; remaining work is incomplete."
        )), runTimeoutMs);
        const runSignal = abortSignal
            ? AbortSignal.any([abortSignal, runController.signal])
            : runController.signal;
        let stepCount = 0;

        // Bound the whole step, including SDK retries. The race also releases
        // the network if a provider fails to settle after cancellation.
        const runStep = async (
            agent: Agent,
            kind: AgentStepKind,
            instructions: string,
            context: string | undefined,
            taskIndex?: number
        ) => {
            runSignal.throwIfAborted();
            const id = `step-${++stepCount}`;
            emit({ type: "step-start", id, agent: agent.name, kind,
                revision: contextManager.revisionCount, taskIndex,
                instructions: kind === "task" ? instructions : undefined });
            const stepController = new AbortController();
            const timer = setTimeout(() => stepController.abort(new Error(
                `${agent.name} timed out after ${Math.round(stepTimeoutMs / 1000)} seconds`
            )), stepTimeoutMs);
            const signal = AbortSignal.any([runSignal, stepController.signal]);
            let onAbort: (() => void) | undefined;
            try {
                const cancelled = new Promise<never>((_, reject) => {
                    onAbort = () => reject(signal.reason);
                    signal.addEventListener("abort", onAbort, { once: true });
                    if (signal.aborted) onAbort();
                });
                const result = await Promise.race([
                    Promise.resolve().then(() => {
                        signal.throwIfAborted();
                        return agent.execute(instructions, context, signal);
                    }),
                    cancelled
                ]);
                signal.throwIfAborted();
                emit({ type: "step-finish", id, content: result });
                return result;
            } catch (error) {
                emit({ type: "step-error", id, message: errorMessage(error) });
                throw error;
            } finally {
                clearTimeout(timer);
                if (onAbort) signal.removeEventListener("abort", onAbort);
            }
        };

        emit({ type: "run-start", prompt, agents: this.getProfiles() });
        try {
            let needsRevision = false;
            while (contextManager.revisionCount < this.maxRevisions) {
                runSignal.throwIfAborted();
                if (contextManager.revisionCount === 0 && initialTaskList) {
                    contextManager.taskList = initialTaskList;
                } else {
                    const pmResult = await runStep(this.projectManager, "plan",
                        contextManager.createProjectManagerPrompt(Object.values(this.agents)), undefined);
                    contextManager.taskList = pmResult.taskList;
                    contextManager.addMessage({ agent: this.projectManager.name,
                        content: { taskList: pmResult.taskList }, type: "task" });
                }
                // An empty recovery plan must not hide an unresolved failure.
                if (needsRevision && contextManager.taskList.length === 0) break;
                emit({ type: "plan", revision: contextManager.revisionCount,
                    taskList: [...contextManager.taskList] });
                needsRevision = false;
                const taskList = [...contextManager.taskList];

                for (const [taskIndex, task] of taskList.entries()) {
                    contextManager.currentTask = task;
                    const agent = this.agents[task.agent];
                    if (!agent) throw new Error(`Agent ${task.agent} not found`);
                    const pastMessages = contextManager.globalMessages.slice(
                        Math.max(contextManager.globalMessages.length - 3, 1)
                    );
                    const taskContext = `${contextManager.getProjectContext()}\n\n<past_messages>\n${JSON.stringify(pastMessages)}\n</past_messages>`;
                    let result: any;
                    let taskError: string | undefined;
                    try {
                        result = await runStep(agent, "task", task.instructions, taskContext, taskIndex);
                    } catch (error) {
                        // User cancellation and the total deadline are terminal;
                        // only an individual step failure is sent for recovery.
                        runSignal.throwIfAborted();
                        taskError = errorMessage(error);
                        result = { error: taskError, incomplete: true };
                    }
                    contextManager.addMessage({ agent: task.agent, content: result, type: "result" });

                    let supervisorReview: any;
                    try {
                        supervisorReview = await runStep(this.supervisor, "review",
                            JSON.stringify({ agent: task.agent, task: task.instructions, result,
                                ...(taskError && { recovery: "This agent failed. Ask the Project Manager to split the task into smaller deliverables or reassign it. Preserve completed work; never approve a missing result." }) }),
                            contextManager.getProjectContext(), taskIndex);
                    } catch (error) {
                        runSignal.throwIfAborted();
                        supervisorReview = { needsRevision: true,
                            report: `Supervisor could not review ${task.agent}: ${errorMessage(error)}. Preserve completed work and replan the unfinished task and remaining tasks.` };
                    }
                    if (taskError) {
                        // Never accept a failed worker as a completed task, even
                        // if the model mistakenly approves the failure report.
                        supervisorReview = { ...supervisorReview, needsRevision: true,
                            report: `${task.agent} failed: ${taskError}. Split or reassign this task and keep the remaining tasks. ${supervisorReview.report ?? ""}` };
                    }
                    contextManager.lastTaskReview = supervisorReview;
                    contextManager.addMessage({ agent: this.supervisor.name,
                        content: supervisorReview, type: "review" });

                    if (supervisorReview.needsRevision) {
                        needsRevision = true;
                        contextManager.lastRevisionReport = supervisorReview.report || supervisorReview.summary || "The task needs revision.";
                        break;
                    }
                    contextManager.completeTask();
                }
                if (!needsRevision) break;
                contextManager.incrementRevisionCount();
                if (contextManager.revisionCount < this.maxRevisions) {
                    emit({ type: "revision", revision: contextManager.revisionCount,
                        report: contextManager.lastRevisionReport });
                }
            }
            emit({ type: "run-finish", incomplete: needsRevision,
                report: needsRevision ? contextManager.lastRevisionReport : undefined });
            return contextManager.globalMessages;
        } catch (error) {
            const message = runSignal.aborted ? errorMessage(runSignal.reason) : errorMessage(error);
            emit({ type: "error", message });
            throw new Error(message, { cause: error });
        } finally {
            clearTimeout(runTimer);
        }
    }
}

// Create the AgentBuilder class
export class AgentBuilder {
    build(config: {
        name: string;
        description: string;
        role: string;
        model: ModelConfig;
        temperature: number;
        maxTokens: number;
        // Reasoning effort for reasoning models (default: high)
        reasoning?: ReasoningLevel;
        // OpenAI's hosted web search (OpenAI models only). It runs inside the
        // same response, so structured output still takes one call
        webSearch?: boolean;
        schema: z.ZodType<any>;
    }): Agent {
        const webSearch = config.webSearch ?? false;
        if (webSearch && config.model.provider !== ModelProvider.OpenAI) {
            throw new Error(`${config.name}: web search needs an OpenAI model`);
        }
        return {
            name: config.name,
            description: config.description,
            role: config.role,
            model: config.model,
            temperature: config.temperature,
            maxTokens: config.maxTokens,
            reasoning: config.reasoning ?? "high",
            webSearch,
            schema: config.schema,
            execute: async (
                prompt: string,
                context?: string,
                abortSignal?: AbortSignal
            ) => {
                const fullPrompt = `Instructions: ${prompt}\n\nContext: ${context}\n\nInstructions: ${prompt}`;

                // Reasoning models only support the default temperature
                const isReasoning = reasoningModels.some(
                    (key) => models[key].model === config.model.model
                );

                // A response can be cut off (the token budget includes hidden
                // reasoning) or unparseable; retry once before failing the
                // whole network, with a bigger budget if it ran out
                let maxOutputTokens = Math.min(config.maxTokens, config.model.maxTokens ?? config.maxTokens);
                for (let attempt = 1; ; attempt++) {
                    abortSignal?.throwIfAborted();
                    let finishReason: string | undefined;
                    try {
                        const result = await generateText({
                            model: getModel(config.model),
                            instructions: config.role,
                            temperature: isReasoning ? undefined : config.temperature,
                            reasoning: isReasoning ? (config.reasoning ?? "high") : undefined,
                            maxOutputTokens,
                            prompt: fullPrompt,
                            tools: webSearch
                                ? { web_search: openai.tools.webSearch() }
                                : undefined,
                            abortSignal,
                            output: Output.object({ schema: config.schema }),
                            providerOptions: { openai: { strictJsonSchema: false } }
                        });
                        finishReason = result.finishReason;
                        return result.output;
                    } catch (error) {
                        abortSignal?.throwIfAborted();
                        const noOutput =
                            NoObjectGeneratedError.isInstance(error) ||
                            NoOutputGeneratedError.isInstance(error);
                        if (NoObjectGeneratedError.isInstance(error)) {
                            finishReason = error.finishReason;
                        }
                        if (!noOutput || attempt >= MAX_ATTEMPTS) {
                            throw new Error(
                                noOutput
                                    ? `${config.name} returned no usable output (finish reason: ${finishReason ?? "unknown"}; output budget: ${maxOutputTokens} tokens including reasoning)`
                                    : `${config.name} failed: ${error instanceof Error ? error.message : String(error)}`,
                                { cause: error }
                            );
                        }
                        if (finishReason === "length") {
                            maxOutputTokens = Math.min(
                                maxOutputTokens * 2,
                                config.model.maxTokens ?? maxOutputTokens * 2
                            );
                        }
                        console.warn(
                            `${config.name} returned no usable output (finish reason: ${finishReason ?? "unknown"}; output budget: ${maxOutputTokens} tokens including reasoning), retrying with ${maxOutputTokens} tokens`
                        );
                    }
                }
            }
        };
    }
}
