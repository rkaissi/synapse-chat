import { openai } from "@ai-sdk/openai";
import { groq } from "@ai-sdk/groq";
import { anthropic } from "@ai-sdk/anthropic";
import { extractReasoningMiddleware, wrapLanguageModel } from "ai";
import { REASONING_LEVELS, ReasoningLevel } from "@/lib/types";

export const embeddingModel = openai.embedding("text-embedding-3-small");
export const imageModel = openai.image("gpt-image-2.5-flare");

export enum ModelProvider {
    OpenAI = "OpenAI",
    Anthropic = "Anthropic",
    Groq = "Groq",
    Other = "Other"
}

export interface ModelConfig {
    model: string;
    name: string;
    provider: ModelProvider;
    maxTokens?: number;
    // Highest reasoning effort the model accepts (default: xhigh)
    maxReasoning?: ReasoningLevel;
}

export type ModelKey =
    | "gpt6astra"
    | "gpt61sol"
    | "gpt61terra"
    | "gpt6luna"
    | "claudeopus55"
    | "claudesonnet55"
    | "claudehaiku55"
    | "claudefable51"
    | "gptoss120b"
    | "gptoss20b"
    | "qwen38_27b"
    | "gptLatest"
    | "claudeLatest"
    | "auto"
    | "agents";

// Used to specify a model other than the DEFAULT_MODEL_CONFIG for certain usage
export const models: { [key in ModelKey]: ModelConfig } = {
    gpt6astra: {
        model: "gpt-6-astra",
        name: "GPT-6 Astra",
        provider: ModelProvider.OpenAI,
        maxTokens: 128000
    },
    gpt61sol: {
        model: "gpt-6.1-sol",
        name: "GPT-6.1 Sol",
        provider: ModelProvider.OpenAI,
        maxTokens: 128000
    },
    gpt61terra: {
        model: "gpt-6.1-terra",
        name: "GPT-6.1 Terra",
        provider: ModelProvider.OpenAI,
        maxTokens: 128000
    },
    gpt6luna: {
        model: "gpt-6-luna",
        name: "GPT-6 Luna",
        provider: ModelProvider.OpenAI,
        maxTokens: 128000
    },
    claudeopus55: {
        model: "claude-opus-5-5",
        name: "Claude Opus 5.5",
        provider: ModelProvider.Anthropic,
        maxTokens: 128000
    },
    claudesonnet55: {
        model: "claude-sonnet-5-5",
        name: "Claude Sonnet 5.5",
        provider: ModelProvider.Anthropic,
        maxTokens: 128000
    },
    claudehaiku55: {
        model: "claude-haiku-5-5",
        name: "Claude Haiku 5.5",
        provider: ModelProvider.Anthropic,
        maxTokens: 128000
    },
    claudefable51: {
        model: "claude-fable-5-1",
        name: "Claude Fable 5.1",
        provider: ModelProvider.Anthropic,
        maxTokens: 128000
    },
    gptoss120b: {
        model: "openai/gpt-oss-120b",
        name: "GPT-OSS 120B (Groq)",
        provider: ModelProvider.Groq,
        // Groq accepts low, medium and high
        maxReasoning: "high",
        maxTokens: 65536
    },
    gptoss20b: {
        model: "openai/gpt-oss-20b",
        name: "GPT-OSS 20B (Groq)",
        provider: ModelProvider.Groq,
        // Groq accepts low, medium and high
        maxReasoning: "high",
        maxTokens: 65536
    },
    qwen38_27b: {
        model: "qwen/qwen3.8-27b",
        name: "Qwen 3.8 27B (Groq)",
        provider: ModelProvider.Groq,
        // Groq accepts low, medium and high
        maxReasoning: "high",
        maxTokens: 16384
    },
    gptLatest: {
        model: "gpt-6.1-sol",
        name: "GPT-6.1 Sol",
        provider: ModelProvider.OpenAI,
        maxTokens: 128000
    },
    claudeLatest: {
        model: "claude-sonnet-5-5",
        name: "Claude Sonnet 5.5",
        provider: ModelProvider.Anthropic,
        maxTokens: 128000
    },

    // Other
    auto: { model: "auto", name: "Auto", provider: ModelProvider.Other },
    agents: { model: "agents", name: "Agents", provider: ModelProvider.Other }
};

export const DEFAULT_MODEL_CONFIG: ModelConfig = models.gptLatest;

export const getModel = (modelConfig: ModelConfig) => {
    let baseModel;
    switch (modelConfig.provider) {
        case ModelProvider.OpenAI:
            baseModel = openai(modelConfig.model);
            break;
        case ModelProvider.Anthropic:
            baseModel = anthropic(modelConfig.model);
            break;
        case ModelProvider.Groq:
            // Groq returns reasoning as a separate field (parsed format by default)
            baseModel = groq(modelConfig.model);
            break;
        default:
            throw new Error(
                `Unsupported model provider: ${modelConfig.provider}`
            );
    }

    return wrapLanguageModel({
        model: baseModel,
        middleware: extractReasoningMiddleware({ tagName: "assistantThinking" })
    });
};

export const unsupportedToolUseModels: Partial<ModelKey>[] = [];
export const unsupportedArtifactUseModels: Partial<ModelKey>[] = [];

// Models that reason (all chat models today). They get the reasoning effort
// option and are called without temperature/topP, which they don't support
// (Claude 5.x rejects sampling parameters entirely).
export const reasoningModels: Partial<ModelKey>[] = [
    "gpt6astra",
    "gpt61sol",
    "gpt61terra",
    "gpt6luna",
    "gptLatest",
    "claudeopus55",
    "claudesonnet55",
    "claudehaiku55",
    "claudefable51",
    "claudeLatest",
    "gptoss120b",
    "gptoss20b",
    "qwen38_27b"
];

// Clamps a reasoning level to what the model accepts, so the SDK doesn't
// have to remap it (it logs a warning when it does)
export const clampReasoning = (
    modelKey: ModelKey,
    level: ReasoningLevel
): ReasoningLevel => {
    const max = models[modelKey]?.maxReasoning;
    if (!max) return level;
    return REASONING_LEVELS.indexOf(level) > REASONING_LEVELS.indexOf(max)
        ? max
        : level;
};

export const isReasoningModel = (modelKey: ModelKey): boolean => {
    return reasoningModels.includes(modelKey);
};

// Premium models are only offered when NEXT_PUBLIC_ENABLE_EXPENSIVE_MODELS is
// "true" (set it locally; leave it unset on a public deployment). The flag is
// public because the model picker needs it; the chat route enforces it too.
export const expensiveModels: ModelKey[] = [
    "gpt6astra",
    "gpt61sol",
    "gptLatest",
    "claudefable51",
    "claudeopus55"
];

export const expensiveModelsEnabled =
    process.env.NEXT_PUBLIC_ENABLE_EXPENSIVE_MODELS === "true";

export const isModelAvailable = (modelKey: ModelKey): boolean =>
    expensiveModelsEnabled || !expensiveModels.includes(modelKey);
