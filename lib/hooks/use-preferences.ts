import { useCallback, useSyncExternalStore } from "react";
import {
    DEFAULT_ENABLE_ARTIFACTS,
    DEFAULT_ENABLE_INSTRUCTIONS,
    DEFAULT_ENABLE_LOGIC_MODE,
    DEFAULT_ENABLE_MEMORY,
    DEFAULT_ENABLE_PASTE_TO_FILE,
    DEFAULT_ENABLE_SAFEGUARDS,
    DEFAULT_MAX_TOKENS,
    DEFAULT_MESSAGE_LIMIT,
    DEFAULT_AUTO_PRIORITY,
    DEFAULT_AUTO_ROUTER_MODEL,
    DEFAULT_MODEL,
    DEFAULT_REASONING_LEVEL,
    DEFAULT_TEMPERATURE,
    DEFAULT_TOOL_CHOICE,
    DEFAULT_TOPP
} from "@/app/api/chat/config";
import { isModelAvailable, models } from "@/lib/utils/model-provider";
import {
    AUTO_PRIORITIES,
    AUTO_ROUTER_MODELS,
    REASONING_LEVELS,
    Settings
} from "@/lib/types";

// User preferences (chat settings and the desktop sidebar state), kept in
// localStorage so they survive new chats and reloads

export interface Preferences {
    settings: Settings;
    sidebarOpen: boolean;
}

// v2 stores only changed settings (v1 stored all of them)
const STORAGE_KEY = "synapse-chat:preferences:v2";

export const DEFAULT_PREFERENCES: Preferences = {
    settings: {
        model: DEFAULT_MODEL,
        temperature: DEFAULT_TEMPERATURE,
        topP: DEFAULT_TOPP,
        maxTokens: DEFAULT_MAX_TOKENS,
        messageLimit: DEFAULT_MESSAGE_LIMIT,
        enableArtifacts: DEFAULT_ENABLE_ARTIFACTS,
        enableInstructions: DEFAULT_ENABLE_INSTRUCTIONS,
        enableSafeguards: DEFAULT_ENABLE_SAFEGUARDS,
        enableLogicMode: DEFAULT_ENABLE_LOGIC_MODE,
        enablePasteToFile: DEFAULT_ENABLE_PASTE_TO_FILE,
        enableMemory: DEFAULT_ENABLE_MEMORY,
        toolChoice: DEFAULT_TOOL_CHOICE,
        customInstructions: "",
        reasoningLevel: DEFAULT_REASONING_LEVEL,
        autoRouterModel: DEFAULT_AUTO_ROUTER_MODEL,
        autoPriority: DEFAULT_AUTO_PRIORITY
    },
    sidebarOpen: true
};

const listeners = new Set<() => void>();
// Cached so useSyncExternalStore gets a stable snapshot between changes
let cache: Preferences | null = null;

const read = (): Preferences => {
    if (cache) return cache;
    let stored: { settings?: Partial<Settings>; sidebarOpen?: boolean } = {};
    try {
        stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    } catch {
        // Corrupt or unavailable storage: fall back to the defaults
    }
    const settings = { ...DEFAULT_PREFERENCES.settings, ...stored.settings };
    // A stored model may have been removed or disabled since
    if (!(settings.model in models) || !isModelAvailable(settings.model)) {
        settings.model = DEFAULT_MODEL;
    }
    // "minimal" was removed as a level
    if (!REASONING_LEVELS.includes(settings.reasoningLevel)) {
        settings.reasoningLevel = DEFAULT_REASONING_LEVEL;
    }
    if (!(settings.autoRouterModel in AUTO_ROUTER_MODELS)) {
        settings.autoRouterModel = DEFAULT_AUTO_ROUTER_MODEL;
    }
    if (!(settings.autoPriority in AUTO_PRIORITIES)) {
        settings.autoPriority = DEFAULT_AUTO_PRIORITY;
    }
    cache = {
        settings,
        sidebarOpen: stored.sidebarOpen ?? DEFAULT_PREFERENCES.sidebarOpen
    };
    return cache;
};

const write = (preferences: Preferences) => {
    cache = preferences;
    // Store only what differs from the defaults, so changed defaults still
    // reach settings the user never touched
    const changedSettings = Object.fromEntries(
        Object.entries(preferences.settings).filter(
            ([key, value]) =>
                JSON.stringify(value) !==
                JSON.stringify(DEFAULT_PREFERENCES.settings[key as keyof Settings])
        )
    );
    try {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
                settings: changedSettings,
                sidebarOpen: preferences.sidebarOpen
            })
        );
    } catch {
        // Storage full or disabled: keep the in-memory value
    }
    listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
    listeners.add(listener);
    // Keep other tabs in sync
    const onStorage = (event: StorageEvent) => {
        if (event.key !== STORAGE_KEY) return;
        cache = null;
        listener();
    };
    window.addEventListener("storage", onStorage);
    return () => {
        listeners.delete(listener);
        window.removeEventListener("storage", onStorage);
    };
};

export const usePreferences = () => {
    const preferences = useSyncExternalStore(
        subscribe,
        read,
        () => DEFAULT_PREFERENCES
    );
    const updatePreferences = useCallback(
        (update: (current: Preferences) => Preferences) => write(update(read())),
        []
    );
    return { preferences, updatePreferences };
};
