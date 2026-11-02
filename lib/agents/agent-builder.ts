import { z } from "zod";
import {
    getModel,
    ModelConfig,
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

const MAX_ATTEMPTS = 2;

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
        return `<${tag}>\nAgent: ${task.agent}\nInstructions: ${task.instructions}\n<${tag}>`;
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
        initialTaskList?: any[],
        { onEvent, abortSignal }: ExecuteOptions = {}
    ): Promise<any> {
        const fullPrompt = `\n${prompt}\n\n## Additional Context:\n${additionalContext}`;
        const contextManager = new ContextManager(fullPrompt);

        const emit = (event: AgentEventInput) =>
            onEvent?.({ ...event, at: Date.now() } as AgentEvent);
        let stepCount = 0;
        // Runs one agent call, wrapped in step-start/step-finish events
        const runStep = async (
            agent: Agent,
            kind: AgentStepKind,
            instructions: string,
            context: string | undefined,
            taskIndex?: number
        ) => {
            const id = `step-${++stepCount}`;
            emit({
                type: "step-start",
                id,
                agent: agent.name,
                kind,
                revision: contextManager.revisionCount,
                taskIndex,
                instructions: kind === "task" ? instructions : undefined
            });
            const result = await agent.execute(
                instructions,
                context,
                abortSignal
            );
            emit({ type: "step-finish", id, content: result });
            return result;
        };

        emit({ type: "run-start", prompt, agents: this.getProfiles() });

        while (contextManager.revisionCount < this.maxRevisions) {
            console.log("REVISION COUNT: ", contextManager.revisionCount);

            // Step 1: Project Manager creates or updates task list
            if (contextManager.revisionCount === 0 && initialTaskList) {
                contextManager.taskList = initialTaskList;
            } else {
                const pmPrompt = contextManager.createProjectManagerPrompt(
                    Object.values(this.agents)
                );
                const pmResult = await runStep(
                    this.projectManager,
                    "plan",
                    pmPrompt,
                    undefined
                );

                contextManager.taskList = pmResult.taskList;

                console.log("### PM BEGIN ###");
                console.log(pmPrompt);
                console.log(JSON.stringify(pmResult));
                console.log("### PM END ###");

                contextManager.addMessage({
                    agent: this.projectManager.name,
                    content: { taskList: pmResult.taskList },
                    type: "task"
                });
            }

            emit({
                type: "plan",
                revision: contextManager.revisionCount,
                // Copy: completeTask() removes tasks from the live list
                taskList: [...contextManager.taskList]
            });

            let needsRevision = false;
            const taskList = [...contextManager.taskList];

            for (const [taskIndex, task] of taskList.entries()) {
                contextManager.currentTask = task;

                const agent = this.agents[task.agent];
                if (!agent) {
                    throw new Error(`Agent ${task.agent} not found`);
                }

                // Get the last 3 messages excluding the first (PM) message
                const pastMessages = contextManager.globalMessages.slice(
                    Math.max(contextManager.globalMessages.length - 3, 1)
                );
                const taskContext = `${contextManager.getProjectContext()}\n\n<past_messages>\n${JSON.stringify(
                    pastMessages
                )}\n<past_messages>`;
                console.log(
                    `### AGENT: ${agent.name} ###\n\n# Instructions: ${task.instructions}\n\n# Context: ${taskContext}\n\n`
                );
                // Execute the task with the current agent
                const result = await runStep(
                    agent,
                    "task",
                    task.instructions,
                    taskContext,
                    taskIndex
                );

                contextManager.addMessage({
                    agent: task.agent,
                    content: result,
                    type: "result"
                });

                const supervisorContext = contextManager.getProjectContext();
                const supervisorReview = await runStep(
                    this.supervisor,
                    "review",
                    JSON.stringify({
                        agent: task.agent,
                        task: task.instructions,
                        result: result
                    }),
                    supervisorContext,
                    taskIndex
                );

                contextManager.lastTaskReview = supervisorReview;

                console.log(
                    `### Supervisor Context ###\n\n${supervisorContext}\n\n### Supervisor Review:  ###\n\n${JSON.stringify(
                        supervisorReview
                    )}`
                );

                contextManager.addMessage({
                    agent: this.supervisor.name,
                    content: supervisorReview,
                    type: "review"
                });

                contextManager.completeTask();

                if (supervisorReview.needsRevision) {
                    needsRevision = true;
                    contextManager.lastRevisionReport = supervisorReview.report;
                    break;
                }
            }

            if (!needsRevision) {
                break;
            }

            contextManager.incrementRevisionCount();
            if (contextManager.revisionCount < this.maxRevisions) {
                emit({
                    type: "revision",
                    revision: contextManager.revisionCount,
                    report: contextManager.lastRevisionReport
                });
            }
        }

        console.log("### GLOBAL CONTEXT ###");
        console.log(JSON.stringify(contextManager.globalMessages));
        emit({ type: "run-finish" });
        return contextManager.globalMessages;
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
        schema: z.ZodType<any>;
    }): Agent {
        return {
            name: config.name,
            description: config.description,
            role: config.role,
            model: config.model,
            temperature: config.temperature,
            maxTokens: config.maxTokens,
            reasoning: config.reasoning ?? "high",
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
                let maxOutputTokens = config.maxTokens;
                for (let attempt = 1; ; attempt++) {
                    let finishReason: string | undefined;
                    try {
                        const result = await generateText({
                            model: getModel(config.model),
                            instructions: config.role,
                            temperature: isReasoning ? undefined : config.temperature,
                            reasoning: isReasoning ? config.reasoning : undefined,
                            maxOutputTokens,
                            prompt: fullPrompt,
                            abortSignal,
                            output: Output.object({ schema: config.schema }),
                            providerOptions: { openai: { strictJsonSchema: false } }
                        });
                        finishReason = result.finishReason;
                        return result.output;
                    } catch (error) {
                        const noOutput =
                            NoObjectGeneratedError.isInstance(error) ||
                            NoOutputGeneratedError.isInstance(error);
                        if (NoObjectGeneratedError.isInstance(error)) {
                            finishReason = error.finishReason;
                        }
                        if (!noOutput || attempt >= MAX_ATTEMPTS) {
                            throw new Error(
                                noOutput
                                    ? `${config.name} returned no usable output (finish reason: ${finishReason ?? "unknown"})`
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
                            `${config.name} returned no usable output (finish reason: ${finishReason ?? "unknown"}), retrying with ${maxOutputTokens} tokens`
                        );
                    }
                }
            }
        };
    }
}
