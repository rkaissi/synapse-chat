import { z } from "zod";

// Define schemas
export const standardAgentSchema = z.object({
    innerThinking: z.string().optional(),
    output: z.string()
});

export const projectManagerSchema = z.object({
    innerThinking: z
        .string()
        .optional()
        .describe(
            "First, use innerThinking to think through your process step-by-step. Consider the project requirements, available agents, and potential task groupings. Provide insights or thought processes related to task delegation, including any important considerations or trade-offs."
        ),
    taskList: z
        .array(
            z.object({
                agent: z
                    .string()
                    .describe(
                        "The name of the agent responsible to complete the task."
                    ),
                instructions: z
                    .string()
                    .describe(
                        "Detailed instructions for completing the task. The instructions should be clear, concise, and specific to each task."
                    )
            })
        )
        .describe(
            `
When creating the taskList, keep the following guidelines in mind:
   - Only choose agents that are relevant to the task.
   - Stay within the scope of the described project.
   - You may assign multiple tasks to the same agent if required (for different tasks or as different personas).
   - Preferably, do not assign the same agent to two consecutive related tasks, as those should be grouped, unless they involve multiple personas or fields.
   - Keep in mind that final results should be formatted in markdown, plaintext, LaTeX, or as code. You do not need to delegate this formatting as a separate task.
`
        )
});

export const supervisorSchema = z.object({
    summary: z.string(),
    // Free-form object (z.record emits propertyNames, which OpenAI ignores)
    updatedContext: z.object({}).catchall(z.any()).optional(),
    needsRevision: z
        .boolean()
        .describe(
            "Set to true if the task needs to be revised by the project manager. This should only be the case if it is imperative that the current concerns be resolved or if you feel the project hasn't been completed successfully."
        ),
    report: z
        .string()
        .optional()
        .describe(
            "Create a report if needsRevision is set to true. The report includes a summary of all the tasks that have been completed and a description of everything that needs revision. Describe the next steps to be performed for the project to be completed properly. This will be sent to the project manager to plan a list of follow-up tasks to resolve any of the mentioned issues."
        ),
});

export const programmerSchema = z.object({
    innerThinking: z.string().optional(),
    code: z.string(),
    comments: z.string().optional()
});

export const debuggerSchema = z.object({
    innerThinking: z.string().optional(),
    bugs: z.array(z.string()).optional(),
    edgeCases: z.array(z.string()).optional(),
    comments: z.string().optional()
});

export const researcherSchema = z.object({
    innerThinking: z.string().optional(),
    research: z.string().describe("Include sources"),
    sources: z
        .string()
        .describe(
            "Include the full list of sources including any additional sources that might be helpful."
        )
});

export const verifierSchema = z.object({
    innerThinking: z.string().optional(),
    issues: z
        .array(z.string())
        .describe("A list of issues (e.g. incorrect or missing information)"),
    comments: z.string().describe("Any additional comments.")
});

export const inquisitorSchema = z.object({
    innerThinking: z.string().optional(),
    connections: z
        .array(z.string())
        .describe("A list of connections, related topics, etc."),
    relatedQuestions: z
        .array(z.string())
        .describe("A list of related questions to explore the topic deeper")
});
