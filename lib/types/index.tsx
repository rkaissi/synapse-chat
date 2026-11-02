import type { ModelKey } from "@/lib/utils/model-provider";
import { UIMessage } from "ai";

export interface Artifact {
    identifier: string;
    type: string;
    language: string;
    title: string;
    content: string;
    shareableURL?: string;
}

export interface CodeProps {
    node?: any;
    inline?: any;
    className?: any;
    children?: any;
}

export interface Data {
    completionTokens?: number;
    promptTokens?: number;
    totalTokens?: number;
    cacheWriteTokens?: number;
    cacheReadTokens?: number;
    finishReason?: FinishReason;
    chatId?: string;
    reasoning?: string;
}

// Legacy (AI SDK v4) tool invocation shape. Chats are persisted in this format and
// the tool cards read from it, so UI message tool parts are mapped back to it.
export interface ToolInvocation {
    state: "partial-call" | "call" | "result";
    toolCallId: string;
    toolName: string;
    args: any;
    result?: any;
}

export interface Attachment {
    name: string;
    contentType: string;
    url: string;
}

// A GitHub repository connected to a chat (see lib/github/repo.ts)
export interface RepoConnection {
    owner: string;
    repo: string;
    // Branch/tag the user asked for, and the commit it resolved to
    ref: string;
    sha: string;
    defaultBranch: string;
    isPrivate: boolean;
    fileCount: number;
}

// How Auto mode routed a message (lib/routing/auto-router.ts)
export interface AutoRoute {
    model: ModelKey;
    reasoning: ReasoningLevel;
    task: string;
    difficulty: string;
    // "classifier": a small model decided; "heuristic": it failed or timed
    // out; "fast-path": obviously trivial, no classifier call
    source: "classifier" | "heuristic" | "fast-path";
    // Which classifier made the call (when source is "classifier")
    classifier?: AutoRouterModel;
    // The routing policy used
    priority?: AutoPriority;
    reason: string;
}

// Per-message metadata streamed from /api/chat. `model` is the model that
// actually answered (the routed one in Auto mode).
export type ChatMetadata = Omit<Data, "chatId" | "reasoning"> & {
    model?: ModelKey;
    autoRoute?: AutoRoute;
};

export type ChatUIMessage = UIMessage<ChatMetadata>;

export type NewMessage = {
    id?: string;
    role: "user";
    content: string;
};

export type Role =
    | "user"
    | "assistant"
    | "system"
    | "function"
    | "tool"
    | "data";

export type FinishReason =
    | "stop"
    | "length"
    | "content-filter"
    | "tool-calls"
    | "error"
    | "other"
    | "interrupted"
    | "unknown";

export type CombinedMessage = {
    id: string;
    role: Role;
    originalContent: string;
    processedContent: string;
    attachments?: Attachment[];
    artifact?: Artifact;
    model?: ModelKey;
    // Set when Auto picked the model
    autoRoute?: AutoRoute;
    toolInvocations?: ToolInvocation[];
    completionTokens?: number;
    promptTokens?: number;
    totalTokens?: number;
    cacheWriteTokens?: number;
    cacheReadTokens?: number;
    finishReason?: FinishReason;
    reasoning?: string;
    states: {
        content: string;
        artifact?: Artifact;
        timestamp: number;
    }[];
};

export type Settings = {
    model: ModelKey;
    temperature: number;
    maxTokens: number;
    topP: number;
    messageLimit: number;
    enableArtifacts: boolean;
    enableInstructions: boolean;
    enableSafeguards: boolean;
    enableLogicMode: boolean;
    enableMemory: boolean;
    enablePasteToFile: boolean;
    customInstructions: string;
    toolChoice: ToolChoice;
    // Reasoning effort for every model (Auto picks its own)
    reasoningLevel: ReasoningLevel;
    // What classifies requests in Auto mode
    autoRouterModel: AutoRouterModel;
    // Which routing policy Auto uses
    autoPriority: AutoPriority;
};

// Supported by every chat model (GPT-6, Claude 5.x, Groq); "minimal" and
// "none" are not
export const REASONING_LEVELS = ["low", "medium", "high", "xhigh"] as const;
export type ReasoningLevel = (typeof REASONING_LEVELS)[number];

// Models that can classify requests for Auto (lib/routing/auto-router.ts).
// The Groq models run on Groq's free tier; Decisions bills the OpenAI key.
export const AUTO_ROUTER_MODELS = {
    gptoss20b: "GPT-OSS 20B",
    qwen38_27b: "Qwen 3.8 27B",
    decisions: "Luna Decisions"
} as const;
export type AutoRouterModel = keyof typeof AUTO_ROUTER_MODELS;

// How Auto trades cost against quality (lib/routing/policy.ts,
// docs/AUTO_ROUTING.md)
export const AUTO_PRIORITIES = {
    cost: "Cost",
    performance: "Performance"
} as const;
export type AutoPriority = keyof typeof AUTO_PRIORITIES;

export type Action =
    | { type: "SET_CHAT_ID"; payload: string | null }
    | { type: "SET_MODEL"; payload: ModelKey }
    | { type: "SET_TEMPERATURE"; payload: number }
    | { type: "SET_MAX_TOKENS"; payload: number }
    | { type: "SET_TOP_P"; payload: number }
    | { type: "SET_MESSAGE_LIMIT"; payload: number }
    | { type: "SET_ENABLE_ARTIFACTS"; payload: boolean }
    | { type: "SET_ENABLE_INSTRUCTIONS"; payload: boolean }
    | { type: "SET_ENABLE_SAFEGUARDS"; payload: boolean }
    | { type: "SET_ENABLE_LOGIC_MODE"; payload: boolean }
    | { type: "SET_ENABLE_TOOLS"; payload: boolean }
    | { type: "SET_ENABLE_PASTE_TO_FILE"; payload: boolean }
    | { type: "SET_ENABLE_MEMORY"; payload: boolean }
    | { type: "SET_CUSTOM_INSTRUCTIONS"; payload: string }
    | { type: "SET_TOOL_CHOICE"; payload: ToolChoice }
    | { type: "SET_REASONING_LEVEL"; payload: ReasoningLevel }
    | { type: "SET_AUTO_ROUTER_MODEL"; payload: AutoRouterModel }
    | { type: "SET_AUTO_PRIORITY"; payload: AutoPriority };

export interface WikipediaSearchResult {
    id: number;
    key: string;
    title: string;
    excerpt: string;
    description?: string;
    thumbnail?: {
        url: string;
    };
}

export type ToolChoice =
    | "auto"
    | "required"
    | "none"
    | { type: "tool"; toolName: string };
