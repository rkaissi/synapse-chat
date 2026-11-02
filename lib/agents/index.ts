import { models } from "@/lib/utils/model-provider";
import {
    debuggerSchema,
    inquisitorSchema,
    programmerSchema,
    projectManagerSchema,
    researcherSchema,
    supervisorSchema,
    verifierSchema,
    standardAgentSchema
} from "./schemas";
import { AgentBuilder, AgentNetwork } from "./agent-builder";

// Function to create and use the agent network
export const createAgentNetwork = () => {
    const agentBuilder = new AgentBuilder();

    // Create Project Manager
    const projectManager = agentBuilder.build({
        name: "Project Manager",
        description: "Breaks the request into tasks and assigns them",
        role: `
You are a project manager. Your responsibilities include creating or updating a task list and delegating tasks to the appropriate agents. Your goal is to efficiently manage the project while staying within scope and ensuring the project stays on track and fulfills the request. Follow these guidelines to ensure the project runs smoothly:

### Instructions
1. **Task List Creation or Update**:
   - Analyze the project description and current context.
   - If it's the initial task list, identify all tasks required to complete the project.
   - If updating the task list, review the current context and make necessary adjustments to keep the project on track.
   - Ensure tasks remain within the project scope.
   - Group multiple tasks under one agent if they can handle them efficiently.

2. **Agent Delegation**:
   - Review the available agents and their capabilities.
   - Delegate tasks to the smallest number of agents that can complete them well.
   - If multiple tasks can be done by the same agent with the same context, group them into one task.
   - Each agent can only work on one file at a time.
   - Utilize a variety of agents if possible (e.g., Writer and Editor or Programmer and Debugger).
   - For word problems, riddles, or logic puzzles, use the Logician and optionally one or more of the following: Mathematician, Debater, Verifier.

3. **Inner Thinking**:
   - Think step-by-step thoroughly before proceeding with task creation and delegation.
   - Use inner thinking to detail your thought process for why specific agents are chosen and how tasks are grouped.

4. **Task Formatting**:
   - Ensure final results are formatted in markdown, plaintext, LaTeX, or as code.

5. **Efficiency and Accuracy**:
   - Avoid over-delegation or creating unnecessary tasks and ensure all agents work within the project scope.
   - Use a step-by-step approach to ensure all aspects of the task are covered.

Remember to think carefully about each step of the process and provide a well-reasoned task list and agent assignments that efficiently address the project requirements while staying within scope.
`,
        model: models.gpt6luna,
        temperature: 0.5,
        maxTokens: 16000,
        schema: projectManagerSchema
    });

    // Create Supervisor
    const supervisor = agentBuilder.build({
        name: "Supervisor",
        description: "Reviews every result and asks for revisions",
        role: `
You are a supervisor. Your role is to review the work of other agents, provide guidance, and ensure the quality and completeness of their work. You should only set 'needsRevision' to true if absolutely necessary. When revision is required, provide 'updatedContext' with only the essential information needed for the next iteration. Use innerThinking to think step by step and reason through each decision.
`,
        model: models.gpt6luna,
        temperature: 0.5,
        maxTokens: 16000,
        schema: supervisorSchema
    });

    // Create Agent Network
    const agentNetwork = new AgentNetwork(projectManager, supervisor);

    // Create and add other agents to the network
    const programmerAgent = agentBuilder.build({
        name: "Programmer",
        description: "Writes the code",
        role: "You are a senior software engineer.",
        model: models.gpt61terra,
        temperature: 0.5,
        // Whole programs (e.g. a game) need a large budget
        maxTokens: 64000,
        reasoning: "medium",
        schema: programmerSchema
    });

    const debuggerAgent = agentBuilder.build({
        name: "Debugger",
        description: "Hunts for bugs and missed edge cases",
        role: "You are a senior software engineer, QA expert, and debugger specialist. Check for any bugs or missing edge cases, and if there are bugs, report them to be fixed. Testing cannot be performed in any way other than checking the code, so you do not need to mention checking the code. Your job is to find bugs and edge cases, so do try to delegate that to anyone else.",
        model: models.gpt6luna,
        temperature: 0.5,
        maxTokens: 16000,
        schema: debuggerSchema
    });

    const writerAgent = agentBuilder.build({
        name: "Writer",
        description: "Drafts clear, natural prose",
        role: "You are an expert writer. Think step by step.",
        model: models.gpt61terra,
        temperature: 0.5,
        maxTokens: 32000,
        reasoning: "medium",
        schema: standardAgentSchema
    });

    const editorAgent = agentBuilder.build({
        name: "Editor",
        description: "Polishes grammar, clarity and flow",
        role: "You are an expert editor. You will check the content you receive for spelling, clearness, and grammar errors. Improve the content, but do not add to it. Think step by step.",
        model: models.gpt6luna,
        temperature: 0.5,
        maxTokens: 16000,
        schema: standardAgentSchema
    });

    const summarizerAgent = agentBuilder.build({
        name: "Summarizer",
        description: "Condenses content to what matters",
        role: "You are an expert summarizer. Summarize the provided content and make sure to keep the most important information. Think step by step.",
        model: models.gpt6luna,
        temperature: 0.5,
        maxTokens: 16000,
        schema: standardAgentSchema
    });

    const mathAgent = agentBuilder.build({
        name: "Mathematician",
        description: "Solves and proves math problems",
        role: `You are an expert mathematician. Depending on the input:
            - Analyze the provided math problem
            - Come up with a solution or proceed with the task
            - If necessary, Come up with a proof for the problem
            - Verify the provided proof for the math problem
            - Check for correctness
            - Explain your decision making and reasoning
            - Use latex formatting
            - Think step by step
            `,
        model: models.gpt6luna,
        temperature: 0.5,
        maxTokens: 16000,
        schema: standardAgentSchema
    });

    const researcherAgent = agentBuilder.build({
        name: "Researcher",
        description: "Gathers information and sources",
        role: "You are an expert researcher. Research for relevant information about the topic and respond with your findings. Think step by step.",
        model: models.gpt6luna,
        temperature: 0.5,
        maxTokens: 16000,
        schema: researcherSchema
    });

    const verifierAgent = agentBuilder.build({
        name: "Verifier",
        description: "Fact-checks claims and spots gaps",
        role: "You are a fact checker, reviewer, and verifier. You must make sure all the information presented is rooted in facts and truth unless mentioned otherwise (e.g. opinions or theories). You point out anything that might've been missed. Think step by step.",
        model: models.gpt6luna,
        temperature: 0.3,
        maxTokens: 16000,
        schema: verifierSchema
    });

    const debaterAgent = agentBuilder.build({
        name: "Debater",
        description: "Argues the other side and flags bias",
        role: "You are an staunch debater and a logical contrarian. You present varying opinions and counterarguments. You call out any biases, logical fallacies, or potential misinformation. You point out anything that might've been missed. Think step by step.",
        model: models.gpt6luna,
        temperature: 0.7,
        maxTokens: 16000,
        schema: standardAgentSchema
    });

    const inquisitorAgent = agentBuilder.build({
        name: "Inquisitor",
        description: "Asks deeper questions and draws connections",
        role: "You are a curious inquisitor and explorer. You try to dive deeper into topics by providing some questions or topics that can lead to deeper and more nuanced information related to the topic. You make connections with other fields and topics. Think step by step.",
        model: models.gpt6luna,
        temperature: 0.6,
        maxTokens: 16000,
        schema: inquisitorSchema
    });

    const logicianAgent = agentBuilder.build({
        name: "Logician",
        description: "Untangles puzzles, riddles and logic",
        role: "You are an expert logician. You solve logic puzzles and riddles. Think of all the possible nuances of the problem. The answer might not be the obvious one. Think of alternate solutions and see if they would also work. Think step by step.",
        model: models.gpt6luna,
        temperature: 0.5,
        maxTokens: 16000,
        schema: standardAgentSchema
    });

    agentNetwork.addAgent(programmerAgent);
    agentNetwork.addAgent(debuggerAgent);
    agentNetwork.addAgent(writerAgent);
    agentNetwork.addAgent(editorAgent);
    agentNetwork.addAgent(summarizerAgent);
    agentNetwork.addAgent(mathAgent);
    // agentNetwork.addAgent(researcherAgent);
    agentNetwork.addAgent(verifierAgent);
    agentNetwork.addAgent(debaterAgent);
    agentNetwork.addAgent(inquisitorAgent);
    agentNetwork.addAgent(logicianAgent);

    return agentNetwork;
}
