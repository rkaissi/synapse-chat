import {
    experimental_decide as decide,
    generateText,
    Output,
    UIMessage
} from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { AutoPriority, AutoRoute, AutoRouterModel } from "@/lib/types";
import {
    choosePolicy,
    Difficulty,
    DIFFICULTIES,
    Task,
    TASKS
} from "./policy";
import {
    clampReasoning,
    getModel,
    isModelAvailable,
    ModelKey,
    models
} from "@/lib/utils/model-provider";
import { getMessageText } from "@/lib/utils/ui-messages";

// Auto mode: picks a model and reasoning effort per message, the way hosted
// routers do (ChatGPT's auto mode, OpenRouter Auto). A classifier (the
// autoRouterModel setting) labels the request (task type, difficulty, whether
// it needs deep thinking) from the latest message, recent context and request
// features; a fixed policy maps that to the cheapest model that handles it
// well. If the classifier is slow or fails, heuristics decide instead.
//
// Benchmark (8 labelled prompts x 3 runs, warm calls):
//   GPT-OSS 20B (Groq)        20/24 correct, 4/8 prompts inconsistent, median 329 ms
//   Qwen 3.8 27B (Groq)       20/22 correct, 4/8 inconsistent, 2 errors, p90 ~5 s
//   GPT-6 Luna Decisions API  21/24 correct, 0/8 inconsistent, median 170 ms
// GPT-OSS 20B is the default because it's free on Groq; Decisions is the
// most accurate and consistent but bills the OpenAI key.

interface Classification {
    task: Task;
    difficulty: Difficulty;
    needsDeepThinking: boolean;
}

const ABOUT_THE_STATE =
    "The state holds a chat request: the user's latest message, possibly earlier messages for context (e.g. follow-ups like \"now make it faster\") and notes about the request. Judge the latest message.";

// Typed questions for the Decisions API: one choice, one ordered score and
// one yes/no, each with per-option descriptions
const QUESTIONS = {
    task: {
        type: "choice",
        instructions: `${ABOUT_THE_STATE} What kind of request is it?`,
        criteria: {
            chat: "Greetings, small talk, thanks, opinions",
            factual: "A direct question with a known answer",
            writing: "Prose for people to read: emails, essays, summaries, rewriting, editing. Never code",
            coding: "Anything that asks for code or is about code, even a one-line snippet: functions, scripts, SQL, regex, apps, games, UIs, explaining or debugging code",
            math: "Calculations, proofs, word problems, logic puzzles",
            analysis: "Comparing options, explaining complex topics, planning, working with data",
            creative: "Stories, poems, brainstorming, role-play"
        } satisfies Record<Task, string>
    },
    difficulty: {
        type: "score",
        instructions: `${ABOUT_THE_STATE} How demanding is a good answer? Most requests are standard; only pick complex or expert when the request clearly demands it.`,
        criteria: [
            "Trivial: a one-line answer, no thought needed (\"hi\", \"what's 2+2\", \"thanks\")",
            "Standard: a typical request a capable assistant handles quickly",
            "Complex: multi-part work, a full program or document, careful reasoning, or domain expertise",
            "Expert: research-level or very hard (olympiad math, novel algorithms, large system design, subtle bugs across a codebase)"
        ]
    },
    needsDeepThinking: {
        type: "boolean",
        instructions: `${ABOUT_THE_STATE} Does a good answer need careful multi-step reasoning, such as a proof, a tricky puzzle, debugging, algorithm design or planning under constraints?`
    }
} as const;

const decisionModel = openai.decisionModel("gpt-6-luna");
const CLASSIFIER_TIMEOUT_MS = 3500;

// The same questions as a prompt and schema, for the Groq models
const LANGUAGE_MODEL_INSTRUCTIONS = `You route chat requests to the right model. Classify the user's latest request (use earlier messages only for context, e.g. follow-ups like "now make it faster").

task:
${Object.entries(QUESTIONS.task.criteria)
    .map(([task, description]) => `- ${task}: ${description}`)
    .join("\n")}

difficulty:
${QUESTIONS.difficulty.criteria.map((description) => `- ${description}`).join("\n")}

needsDeepThinking: ${QUESTIONS.needsDeepThinking.instructions.replace(ABOUT_THE_STATE, "").trim()}

Be conservative: most requests are standard. Only use complex or expert when the request clearly demands it.`;

const classificationSchema = z.object({
    task: z.enum(TASKS),
    difficulty: z.enum(DIFFICULTIES),
    needsDeepThinking: z.boolean()
});

interface RouteInput {
    messages: UIMessage[];
    repoConnected: boolean;
}

interface RequestFeatures {
    text: string;
    context: string;
    hasImages: boolean;
    hasFiles: boolean;
    hasCode: boolean;
    // The request mentions programming (a language, "function", "bug", ...)
    mentionsCode: boolean;
    repoConnected: boolean;
}

const CODE_PATTERN =
    /\b(code|coding|bug|debug|function|method|script|api|regex|sql|query|typescript|javascript|python|java|rust|golang|html|css|react|component|compile|stack trace|refactor)\b|c\+\+/i;

const truncate = (text: string, max: number) =>
    text.length > max ? `${text.slice(0, max)}…` : text;

const getFeatures = ({ messages, repoConnected }: RouteInput): RequestFeatures => {
    const lastUser = messages.findLast((message) => message.role === "user");
    const text = getMessageText(lastUser);
    const files =
        lastUser?.parts.filter((part) => part.type === "file") ?? [];
    const context = messages
        .slice(-3, -1)
        .map((message) => `${message.role}: ${truncate(getMessageText(message), 500)}`)
        .join("\n");

    return {
        text,
        context,
        hasImages: files.some((file) => file.mediaType.startsWith("image/")),
        hasFiles: files.some((file) => !file.mediaType.startsWith("image/")),
        hasCode:
            /```|^\s*(import|def|class|function|const|let|SELECT|#include)\b/m.test(
                text
            ),
        mentionsCode: CODE_PATTERN.test(text),
        repoConnected
    };
};

// Requests that obviously need no thought skip the classifier entirely
const isTrivial = (features: RequestFeatures) =>
    !features.hasImages &&
    !features.hasFiles &&
    !features.hasCode &&
    !features.context &&
    features.text.trim().length < 24 &&
    !/\d\s*[-+*/^]\s*\d/.test(features.text);

// Earlier messages, the latest message and notes about the request
const describeRequest = (features: RequestFeatures) => {
    const notes = [
        features.hasImages && "images attached",
        features.hasFiles && "files attached",
        features.repoConnected && "a GitHub repository is connected",
        (features.hasCode || features.mentionsCode) && "the request involves code"
    ].filter((note): note is string => Boolean(note));
    return [
        features.context && `Earlier messages:\n${features.context}`,
        `Latest message:\n${truncate(features.text, 4000)}`,
        notes.length > 0 && `Notes: ${notes.join(", ")}.`
    ].filter((part): part is string => Boolean(part));
};

const classifyWithDecisions = async (
    features: RequestFeatures,
    abortSignal: AbortSignal
): Promise<Classification> => {
    const { answers } = await decide({
        model: decisionModel,
        state: describeRequest(features).map((text) => ({ type: "text" as const, text })),
        questions: QUESTIONS,
        maxRetries: 1,
        abortSignal
    });

    // The score is a fractional position over the levels; the boolean comes
    // back as a probability
    const level = Math.min(
        Math.max(Math.round(answers.difficulty.score), 0),
        DIFFICULTIES.length - 1
    );
    return {
        task: answers.task.choice,
        difficulty: DIFFICULTIES[level],
        needsDeepThinking: (answers.needsDeepThinking.probability ?? 0) >= 0.5
    };
};

const classifyWithLanguageModel = async (
    modelKey: ModelKey,
    features: RequestFeatures,
    abortSignal: AbortSignal
): Promise<Classification> => {
    const { output } = await generateText({
        model: getModel(models[modelKey]),
        reasoning: "low",
        maxOutputTokens: 800,
        instructions: LANGUAGE_MODEL_INSTRUCTIONS,
        prompt: describeRequest(features).join("\n\n"),
        output: Output.object({ schema: classificationSchema }),
        maxRetries: 1,
        abortSignal
    });
    return output;
};

const classify = (
    routerModel: AutoRouterModel,
    features: RequestFeatures,
    abortSignal?: AbortSignal
): Promise<Classification> => {
    const timeout = AbortSignal.timeout(CLASSIFIER_TIMEOUT_MS);
    const signal = abortSignal ? AbortSignal.any([abortSignal, timeout]) : timeout;
    return routerModel === "decisions"
        ? classifyWithDecisions(features, signal)
        : classifyWithLanguageModel(routerModel, features, signal);
};

// Used when the classifier is unavailable
const classifyHeuristically = (features: RequestFeatures): Classification => {
    const text = features.text.toLowerCase();
    const has = (pattern: RegExp) => pattern.test(text);
    const long = features.text.length > 1500;

    if (features.hasCode || features.mentionsCode || features.repoConnected || has(/\bbuild (an?|me) (app|game|website|site|tool)\b/)) {
        return {
            task: "coding",
            difficulty: long || has(/\b(app|game|full|complete|refactor|architecture)\b/) ? "complex" : "standard",
            needsDeepThinking: has(/\b(debug|why does|fix|optimi[sz]e)\b/)
        };
    }
    if (has(/\b(prove|proof|derive|integral|equation|probability|theorem|riddle|puzzle)\b/) || /\d\s*[-+*/^=]\s*\d/.test(text)) {
        return { task: "math", difficulty: "complex", needsDeepThinking: true };
    }
    if (has(/\b(story|poem|lyrics|brainstorm|role-?play)\b/)) {
        return { task: "creative", difficulty: "standard", needsDeepThinking: false };
    }
    if (has(/\b(essay|email|letter|rewrite|summari[sz]e|proofread|edit)\b/)) {
        return { task: "writing", difficulty: long ? "complex" : "standard", needsDeepThinking: false };
    }
    if (has(/\b(compare|analy[sz]e|explain|plan|strategy|pros and cons|trade-?offs?)\b/)) {
        return { task: "analysis", difficulty: long ? "complex" : "standard", needsDeepThinking: false };
    }
    return {
        task: "chat",
        difficulty: features.text.length < 80 ? "trivial" : "standard",
        needsDeepThinking: false
    };
};

export const routeRequest = async (
    input: RouteInput,
    routerModel: AutoRouterModel,
    priority: AutoPriority,
    abortSignal?: AbortSignal
): Promise<AutoRoute> => {
    const features = getFeatures(input);

    let classification: Classification;
    let source: AutoRoute["source"];
    if (isTrivial(features)) {
        classification = { task: "chat", difficulty: "trivial", needsDeepThinking: false };
        source = "fast-path";
    } else {
        try {
            classification = await classify(routerModel, features, abortSignal);
            source = "classifier";
        } catch (error) {
            console.warn("Auto router classifier failed, using heuristics:", error instanceof Error ? error.message : error);
            classification = classifyHeuristically(features);
            source = "heuristic";
        }
    }

    const { difficulty, needsDeepThinking } = classification;
    // Rules over the classifier: code in or about the request makes it a
    // coding task (small classifiers sometimes call it "writing")
    const task: Task =
        (features.hasCode || features.mentionsCode) &&
        (classification.task === "writing" || classification.task === "chat")
            ? "coding"
            : classification.task;
    const choice = choosePolicy(priority, {
        task,
        difficulty,
        needsDeepThinking,
        repoConnected: features.repoConnected,
        isAvailable: isModelAvailable
    });
    const model = choice.model;
    const reasoning = clampReasoning(model, choice.reasoning);

    return {
        model,
        reasoning,
        task,
        difficulty,
        source,
        ...(source === "classifier" && { classifier: routerModel }),
        priority,
        reason: `${difficulty} ${task}${needsDeepThinking ? ", needs deep thinking" : ""}`
    };
};
