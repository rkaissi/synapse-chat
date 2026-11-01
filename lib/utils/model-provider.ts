import { openai } from "@ai-sdk/openai";
import { groq } from "@ai-sdk/groq";
import { anthropic } from "@ai-sdk/anthropic";
import { azure } from "@ai-sdk/azure";
import {
    defaultSettingsMiddleware,
    extractReasoningMiddleware,
    LanguageModelMiddleware,
    wrapLanguageModel
} from "ai";

export const embeddingModel = openai.embedding("text-embedding-3-small");
export const imageModel = openai.image("gpt-image-2.5-flare");

export const thinkingMiddleware: LanguageModelMiddleware = {
    transformParams: async ({ params }) => {
        return {
            ...params,
            prompt: params.prompt?.map((message, index) => {
                if (
                    index === params.prompt.length - 1 &&
                    params.prompt[params.prompt.length - 1].role === "user"
                ) {
                    const content =
                        params.prompt[params.prompt.length - 1].content;
                    return {
                        ...params.prompt[params.prompt.length - 1],
                        content: Array.isArray(content)
                            ? content.map((part) => {
                                  if ("text" in part) {
                                      return {
                                          ...part,
                                          text: `${part.text}\nMake sure to think step by step and wrap all your reasoning with <assistantThinking> tags. After your thinking, provide your final answer outside the <assistantThinking> tags. The final answer must stand alone.`
                                      };
                                  }
                                  return part;
                              })
                            : content
                    } as any;
                }
                return message;
            })
        };
    }
};

const reasoning = wrapLanguageModel({
    model: anthropic("claude-opus-5-5"),
    middleware: defaultSettingsMiddleware({
        settings: {
            providerOptions: {
                anthropic: {
                    thinking: { type: "enabled", budgetTokens: 12000 }
                }
            }
        }
    })
});

export enum ModelProvider {
    OpenAI = "OpenAI",
    Anthropic = "Anthropic",
    Azure = "Azure",
    Groq = "Groq",
    Custom = "Custom",
    Other = "Other"
}

export interface ModelConfig {
    model: string;
    name: string;
    provider: ModelProvider;
    maxTokens?: number;
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
    | "azureGpt4o"
    | "gptoss120b"
    | "gptoss20b"
    | "qwen38_27b"
    | "gptLatest"
    | "claudeLatest"
    | "azureLatest"
    | "mathgpt"
    | "reasoning"
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
    azureGpt4o: {
        model: "gpt-4o",
        name: "GPT-4o",
        provider: ModelProvider.Azure
    },
    gptoss120b: {
        model: "openai/gpt-oss-120b",
        name: "GPT-OSS 120B (Groq)",
        provider: ModelProvider.Groq,
        maxTokens: 65536
    },
    gptoss20b: {
        model: "openai/gpt-oss-20b",
        name: "GPT-OSS 20B (Groq)",
        provider: ModelProvider.Groq,
        maxTokens: 65536
    },
    qwen38_27b: {
        model: "qwen/qwen3.8-27b",
        name: "Qwen 3.8 27B (Groq)",
        provider: ModelProvider.Groq,
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
    azureLatest: {
        model: "gpt-4o",
        name: "GPT-4o",
        provider: ModelProvider.Azure,
        maxTokens: 16384
    },

    // Fine-tuned Models
    mathgpt: {
        model: process.env.MATHGPT_MODEL || "gpt-6-luna",
        name: "MathGPT",
        provider: ModelProvider.OpenAI,
        maxTokens: 16384
    },

    // Custom Models
    reasoning: {
        model: "reasoning",
        name: "Reasoning",
        provider: ModelProvider.Custom
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
        case ModelProvider.Azure:
            baseModel = azure.chat(modelConfig.model);
            break;
        case ModelProvider.Groq:
            // Groq returns reasoning as a separate field (parsed format by default)
            baseModel = groq(modelConfig.model);
            break;
        case ModelProvider.Custom:
            return reasoning;
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

// Models that support reasoning/thinking output. These are called without a temperature.
export const reasoningModels: Partial<ModelKey>[] = [
    "gpt6astra",
    "gpt61sol",
    "gpt61terra",
    "gpt6luna",
    "reasoning",
    "gptoss120b",
    "gptoss20b",
    "qwen38_27b"
];

export const isReasoningModel = (modelKey: ModelKey): boolean => {
    return reasoningModels.includes(modelKey);
};
