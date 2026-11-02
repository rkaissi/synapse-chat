import {
    convertToModelMessages,
    createUIMessageStreamResponse,
    isStepCount,
    smoothStream,
    streamText,
    toUIMessageStream,
    wrapLanguageModel
} from "ai";
import {
    clampReasoning,
    getModel,
    isModelAvailable,
    isReasoningModel,
    ModelKey,
    models,
    unsupportedArtifactUseModels,
    unsupportedToolUseModels
} from "@/lib/utils/model-provider";
import { createAgentsTool, tools, artifactExtractionMiddleware } from "./tools";
import buildPrompt from "./prompt-builder";
import {
    agentsPrompt,
    artifactPrompt,
    DEFAULT_AGENT_SETTINGS,
    DEFAULT_AUTO_PRIORITY,
    DEFAULT_AUTO_ROUTER_MODEL,
    DEFAULT_REASONING_LEVEL,
    maxSteps,
    toolsPrompt
} from "./config";
import {
    ChatMetadata,
    ChatUIMessage,
    RepoConnection,
    Settings,
    ToolChoice
} from "@/lib/types";
import { limitMessages } from "@/lib/utils/message-manager";
import { getMessageText, inlineTextFileParts } from "@/lib/utils/ui-messages";
import { findRelevantMemories, extractMemory } from "@/lib/memory";
import { describeRepo, getRepoSnapshot } from "@/lib/github/repo";
import { createRepoTools } from "@/lib/github/tools";
import { routeRequest } from "@/lib/routing/auto-router";

export const maxDuration = 100; // Timeout in seconds


const getToolsToUse = (
    toolChoice: ToolChoice,
    model: ModelKey,
    messages: ChatUIMessage[]
): { toolChoice: ToolChoice; tools: any } => {
    const previousAssistantMessage = getMessageText(
        messages.findLast((message) => message.role === "assistant")
    );
    const agentsTool = createAgentsTool(previousAssistantMessage);

    if (toolChoice === "none" || unsupportedToolUseModels.includes(model)) {
        return {
            toolChoice: "none",
            tools: model === "agents" ? { call_agents: agentsTool } : {}
        };
    }
    return {
        toolChoice:
            model === "agents"
                ? DEFAULT_AGENT_SETTINGS.toolChoice!
                : toolChoice,
        tools: {
            ...tools,
            ...(model === "agents" ? { call_agents: agentsTool } : {})
        }
    };
};

export async function POST(req: Request) {
    const {
        userId,
        messages,
        settings,
        repo
    }: {
        userId: string;
        messages: ChatUIMessage[];
        settings: Settings;
        repo?: RepoConnection | null;
    } = await req.json();

    const {
        model,
        temperature,
        topP,
        maxTokens,
        messageLimit,
        enableArtifacts,
        enableInstructions,
        enableSafeguards,
        enableLogicMode,
        enableMemory,
        customInstructions,
        toolChoice,
        reasoningLevel = DEFAULT_REASONING_LEVEL,
        autoRouterModel = DEFAULT_AUTO_ROUTER_MODEL,
        autoPriority = DEFAULT_AUTO_PRIORITY
    } = settings;

    if (!isModelAvailable(model)) {
        return Response.json(
            { error: `${models[model]?.name ?? model} is not enabled on this deployment` },
            { status: 403 }
        );
    }

    const useAgents = model === "agents";
    // Auto picks the model and reasoning effort per message; Agents runs the
    // outer chat on Luna
    const autoRoute =
        model === "auto"
            ? await routeRequest(
                  { messages, repoConnected: !!repo },
                  autoRouterModel,
                  autoPriority,
                  req.signal
              )
            : undefined;
    const modelToUse: ModelKey = autoRoute?.model ?? (useAgents ? "gpt6luna" : model);
    const reasoning = autoRoute?.reasoning ?? clampReasoning(modelToUse, reasoningLevel);

    const { toolChoice: finalToolChoice, tools: toolsToUse } = getToolsToUse(
        toolChoice,
        model,
        messages
    );
    const {
        temperature: finalTemperature,
        topP: finalTopP,
        maxTokens: finalMaxTokens
    } = useAgents ? DEFAULT_AGENT_SETTINGS : { temperature, topP, maxTokens };

    const limitedMessages = await limitMessages([...messages], messageLimit);

    const lastUserMessage = getMessageText(
        messages.findLast((message) => message.role === "user")
    );
    const relevantMemories = enableMemory
        ? await findRelevantMemories(lastUserMessage, userId)
        : []; // This can be a tool as well

    const system = useAgents
        ? `${agentsPrompt}${enableArtifacts ? artifactPrompt : ""}${toolsPrompt}${relevantMemories.join("\n")}`
        : buildPrompt(
              enableArtifacts && !unsupportedArtifactUseModels.includes(model),
              enableInstructions,
              enableSafeguards,
              enableLogicMode,
              finalToolChoice !== "none",
              relevantMemories,
              customInstructions
          );

    if (enableMemory) {
        extractMemory(lastUserMessage, userId);
    }

    // A connected repository is explored through tools, pinned to the connected commit
    let repoTools = {};
    let repoPrompt = "";
    if (repo) {
        try {
            const snapshot = await getRepoSnapshot(repo.owner, repo.repo, repo.sha);
            if (finalToolChoice !== "none") {
                repoTools = createRepoTools(snapshot);
                repoPrompt = describeRepo(snapshot);
            } else {
                repoPrompt = `
The user connected the GitHub repository ${repo.owner}/${repo.repo}, but tools are disabled, so its files cannot be read in this conversation.
`;
            }
        } catch (error) {
            console.error("Failed to load connected repository:", error);
            repoPrompt = `
The user connected the GitHub repository ${repo.owner}/${repo.repo}, but it could not be loaded (${error instanceof Error ? error.message : "unknown error"}). Tell the user if they ask about it.
`;
        }
    }

    const isThinkingModel = isReasoningModel(modelToUse);

    const baseModel = getModel(models[modelToUse]);

    const shouldUseMiddleware =
        enableArtifacts && !unsupportedArtifactUseModels.includes(modelToUse);

    const result = streamText({
        model: shouldUseMiddleware
            ? wrapLanguageModel({
                  model: baseModel,
                  middleware: artifactExtractionMiddleware
              })
            : baseModel,
        // Reasoning models only support the default sampling settings
        temperature: isThinkingModel ? undefined : finalTemperature,
        topP: isThinkingModel ? undefined : finalTopP,
        maxOutputTokens: Math.min(
            finalMaxTokens!,
            models[modelToUse].maxTokens ?? finalMaxTokens!
        ),
        reasoning: isThinkingModel ? reasoning : undefined,
        instructions: {
            role: "system",
            content: system + repoPrompt,
            providerOptions: {
                anthropic: { cacheControl: { type: "ephemeral" } }
            }
        },
        messages: await convertToModelMessages(
            await inlineTextFileParts(limitedMessages),
            { ignoreIncompleteToolCalls: true }
        ),
        tools: { ...toolsToUse, ...repoTools },
        toolChoice: finalToolChoice,
        stopWhen: isStepCount(maxSteps),
        experimental_transform: smoothStream()
    });

    return createUIMessageStreamResponse({
        stream: toUIMessageStream<any, ChatUIMessage>({
            stream: result.stream,
            sendReasoning: true,
            messageMetadata: ({ part }): ChatMetadata | undefined => {
                if (part.type === "start") {
                    return { model: useAgents ? "agents" : modelToUse, autoRoute };
                }
                if (part.type !== "finish") {
                    return undefined;
                }

                const usage = part.totalUsage;
                return {
                    promptTokens: usage.inputTokens,
                    completionTokens: usage.outputTokens,
                    totalTokens: usage.totalTokens,
                    cacheReadTokens: usage.inputTokenDetails.cacheReadTokens,
                    cacheWriteTokens: usage.inputTokenDetails.cacheWriteTokens,
                    finishReason: part.finishReason
                };
            },
            onError: (error) => {
                console.error(error);
                return error instanceof Error ? error.message : String(error);
            }
        })
    });
}
