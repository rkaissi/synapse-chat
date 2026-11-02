// Auto routing policies: which model and reasoning effort a classified
// request gets. Pure and type-only imports, so scripts/auto-routing-table.mjs
// can run it directly with Node to generate docs/AUTO_ROUTING.md.
import type { ModelKey } from "@/lib/utils/model-provider";
import type { AutoPriority, ReasoningLevel } from "@/lib/types";

export const TASKS = [
    "chat",
    "factual",
    "writing",
    "coding",
    "math",
    "analysis",
    "creative"
] as const;
export const DIFFICULTIES = ["trivial", "standard", "complex", "expert"] as const;

export type Task = (typeof TASKS)[number];
export type Difficulty = (typeof DIFFICULTIES)[number];

export interface PolicyInput {
    task: Task;
    difficulty: Difficulty;
    needsDeepThinking: boolean;
    repoConnected: boolean;
    // Whether a model may be used (premium models can be disabled with
    // NEXT_PUBLIC_ENABLE_EXPENSIVE_MODELS)
    isAvailable: (model: ModelKey) => boolean;
}

export interface PolicyChoice {
    model: ModelKey;
    reasoning: ReasoningLevel;
}

// Same order as REASONING_LEVELS in lib/types (kept local so this module has
// no runtime imports)
const LEVELS: readonly ReasoningLevel[] = ["low", "medium", "high", "xhigh"];

const bump = (level: ReasoningLevel): ReasoningLevel =>
    LEVELS[Math.min(LEVELS.indexOf(level) + 1, LEVELS.length - 1)];

const firstAvailable = (input: PolicyInput, ...candidates: ModelKey[]): ModelKey =>
    candidates.find((candidate) => input.isAvailable(candidate)) ?? "gpt6luna";

const POLICIES: Record<AutoPriority, (input: PolicyInput) => PolicyChoice> = {
    // Default. Luna handles everything up to standard difficulty, and more
    // reasoning effort on a cheaper model is tried before a pricier model.
    // Terra only takes complex work, Sol only expert work; Astra and Claude
    // are never picked.
    cost: ({ task, difficulty, ...input }) => {
        switch (difficulty) {
            case "trivial":
                return { model: "gpt6luna", reasoning: "low" };
            case "standard":
                return { model: "gpt6luna", reasoning: "medium" };
            case "complex":
                return task === "chat" || task === "factual"
                    ? { model: "gpt6luna", reasoning: "high" }
                    : { model: "gpt61terra", reasoning: "medium" };
            case "expert":
                return {
                    model: firstAvailable({ task, difficulty, ...input }, "gpt61sol", "gpt61terra"),
                    reasoning: "high"
                };
        }
    },

    // The first Auto policy: stronger models earlier. Terra for standard
    // coding/writing/creative, Sol (high) for complex technical work, Claude
    // Sonnet 5.5 for complex writing, Astra (xhigh) for expert work, and
    // coding with a connected repository never on Luna.
    performance: (input) => {
        const { task, difficulty } = input;
        let choice: PolicyChoice;
        switch (difficulty) {
            case "trivial":
                choice = { model: "gpt6luna", reasoning: "low" };
                break;
            case "standard":
                choice =
                    task === "coding" || task === "writing" || task === "creative"
                        ? { model: "gpt61terra", reasoning: "medium" }
                        : { model: "gpt6luna", reasoning: "medium" };
                break;
            case "complex":
                choice =
                    task === "writing" || task === "creative"
                        ? { model: "claudesonnet55", reasoning: "medium" }
                        : task === "chat" || task === "factual"
                          ? { model: "gpt61terra", reasoning: "medium" }
                          : {
                                model: firstAvailable(input, "gpt61sol", "gpt61terra"),
                                reasoning: "high"
                            };
                break;
            case "expert":
                choice = {
                    model: firstAvailable(input, "gpt6astra", "gpt61sol", "gpt61terra"),
                    reasoning: "xhigh"
                };
                break;
        }
        if (input.repoConnected && task === "coding" && choice.model === "gpt6luna") {
            choice = { ...choice, model: "gpt61terra" };
        }
        return choice;
    }
};

// Model and effort for a classified request. "Needs deep thinking" raises the
// effort one level on the same model.
export const choosePolicy = (
    priority: AutoPriority,
    input: PolicyInput
): PolicyChoice => {
    const choice = POLICIES[priority](input);
    return input.needsDeepThinking
        ? { ...choice, reasoning: bump(choice.reasoning) }
        : choice;
};
