import hljs from "highlight.js";

// Register custom aliases
hljs.registerAliases(["latex", "tex", "math"], { languageName: "latex" });
hljs.registerAliases(["racket", "scheme"], { languageName: "scheme" });

// Language detected for each unknown language name, so auto-detection (which
// tries every language) runs once per name, not on every streamed update
const detectedLanguages = new Map<string, string>();

// Recent results. Streaming re-renders the same code blocks many times, and
// the artifact window re-renders its code on every chat update
const MAX_CACHED_RESULTS = 64;
const resultCache = new Map<string, { value: string; language: string }>();

const highlight = (code: string, language: string) => {
    try {
        if (hljs.getLanguage(language)) {
            return { value: hljs.highlight(code, { language }).value, language };
        }

        const detected = detectedLanguages.get(language);
        if (detected) {
            return {
                value: hljs.highlight(code, { language: detected }).value,
                language: detected
            };
        }

        const result = hljs.highlightAuto(code);
        if (result.language) {
            detectedLanguages.set(language, result.language);
            return { value: result.value, language: result.language };
        }
    } catch {
        // Fall back to plaintext below
    }

    return {
        value: hljs.highlight(code, { language: "plaintext" }).value,
        language: "plaintext"
    };
};

export const highlightCode = (code: string, language: string) => {
    const key = `${language}\u0000${code}`;
    const cached = resultCache.get(key);
    if (cached) {
        // Move to the end so the least recently used result is evicted first
        resultCache.delete(key);
        resultCache.set(key, cached);
        return cached;
    }

    const result = highlight(code, language);
    resultCache.set(key, result);
    if (resultCache.size > MAX_CACHED_RESULTS) {
        resultCache.delete(resultCache.keys().next().value!);
    }
    return result;
};
