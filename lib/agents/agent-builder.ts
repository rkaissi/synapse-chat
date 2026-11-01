import { z } from "zod";
import {
    getModel,
    ModelConfig,
    models,
    reasoningModels
} from "@/lib/utils/model-provider";
import { generateText, NoOutputGeneratedError, Output } from "ai";

const MAX_ATTEMPTS = 2;

// Define the Agent interface
interface Agent {
    name: string;
    role: string;
    model: ModelConfig;
    temperature: number;
    maxTokens: number;
    schema: z.ZodType<any>;
    execute: (prompt: string, context?: any) => Promise<any>;
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

    async executePrompt(
        prompt: string,
        additionalContext: string = "",
        initialTaskList?: any[]
    ): Promise<any> {
        const fullPrompt = `\n${prompt}\n\n## Additional Context:\n${additionalContext}`;
        const contextManager = new ContextManager(fullPrompt);

        while (contextManager.revisionCount < this.maxRevisions) {
            console.log("REVISION COUNT: ", contextManager.revisionCount);

            // Step 1: Project Manager creates or updates task list
            if (contextManager.revisionCount === 0 && initialTaskList) {
                contextManager.taskList = initialTaskList;
            } else {
                const pmPrompt = contextManager.createProjectManagerPrompt(
                    Object.values(this.agents)
                );
                const pmResult = await this.projectManager.execute(pmPrompt);

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

            let needsRevision = false;
            const taskList = [...contextManager.taskList];

            for (const task of taskList) {
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
                const result = await agent.execute(
                    task.instructions,
                    taskContext
                );

                contextManager.addMessage({
                    agent: task.agent,
                    content: result,
                    type: "result"
                });

                const supervisorContext = contextManager.getProjectContext();
                const supervisorReview = await this.supervisor.execute(
                    JSON.stringify({
                        agent: task.agent,
                        task: task.instructions,
                        result: result
                    }),
                    supervisorContext
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
        }

        console.log("### GLOBAL CONTEXT ###");
        console.log(JSON.stringify(contextManager.globalMessages));
        return contextManager.globalMessages;
    }
}

// Create the AgentBuilder class
export class AgentBuilder {
    build(config: {
        name: string;
        role: string;
        model: ModelConfig;
        temperature: number;
        maxTokens: number;
        schema: z.ZodType<any>;
    }): Agent {
        return {
            name: config.name,
            role: config.role,
            model: config.model,
            temperature: config.temperature,
            maxTokens: config.maxTokens,
            schema: config.schema,
            execute: async (prompt: string, context?: string) => {
                const fullPrompt = `Instructions: ${prompt}\n\nContext: ${context}\n\nInstructions: ${prompt}`;

                // Reasoning models only support the default temperature
                const isReasoning = reasoningModels.some(
                    (key) => models[key].model === config.model.model
                );

                // A model occasionally returns no parseable object; retry once
                // before failing the whole network
                for (let attempt = 1; ; attempt++) {
                    const result = await generateText({
                        model: getModel(config.model),
                        instructions: config.role,
                        temperature: isReasoning ? undefined : config.temperature,
                        maxOutputTokens: config.maxTokens,
                        prompt: fullPrompt,
                        output: Output.object({ schema: config.schema }),
                        providerOptions: { openai: { strictJsonSchema: false } }
                    });

                    try {
                        return result.output;
                    } catch (error) {
                        if (
                            !NoOutputGeneratedError.isInstance(error) ||
                            attempt >= MAX_ATTEMPTS
                        ) {
                            throw new Error(
                                `${config.name} returned no usable output (finish reason: ${result.finishReason})`,
                                { cause: error }
                            );
                        }
                        console.warn(
                            `${config.name} returned no usable output (finish reason: ${result.finishReason}), retrying`
                        );
                    }
                }
            }
        };
    }
}
