"use client";

import React, {
    useState,
    useEffect,
    useRef,
    useCallback,
    useLayoutEffect
} from "react";
import { Messages } from "./messages";
import { useChat } from "@ai-sdk/react";
import {
    Action,
    Artifact,
    ChatUIMessage,
    CombinedMessage,
    NewMessage,
    RepoConnection,
    Settings
} from "@/lib/types";
import { ModelKey } from "@/lib/utils/model-provider";
import ReasoningLevelSelect from "./reasoninglevelselect";
import ChatHeader from "./chatheader";
import ChatFooter from "./chatfooter";
import SettingsMenu from "./settings";
import { usePreferences } from "@/lib/hooks/use-preferences";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import ContinueButton from "./continuebutton";
import dynamic from "next/dynamic";
import DefaultPromptsSkeleton from "./defaultpromptsskeleton";
import { ArtifactsWindow } from "./artifactswindow";
import saveChat from "@/lib/utils/save-chat";
import markdownToHtml from "@/lib/utils/markdown-to-html";
import { DefaultChatTransport } from "ai";
import { usePathname } from "next/navigation";
import { SidebarContainer } from "./sidebar";
import GitHubRepoSelector from "./githubreposelector";
import toast from "react-hot-toast";
import { ChatErrorMessage } from "./chaterrormessage";
import { extractArtifacts } from "@/app/api/chat/artifact-middleware";
import {
    getAttachments,
    getMessageReasoning,
    getMessageText,
    getToolInvocations,
    toUIMessage
} from "@/lib/utils/ui-messages";

const transport = new DefaultChatTransport<ChatUIMessage>({ api: "/api/chat" });

const DefaultPrompts = dynamic(() => import("./defaultprompts"), {
    loading: () => <DefaultPromptsSkeleton />,
    ssr: false
});

const reducer = (state: Settings, action: Action): Settings => {
    switch (action.type) {
        case "SET_MODEL":
            return { ...state, model: action.payload };
        case "SET_TEMPERATURE":
            return { ...state, temperature: action.payload };
        case "SET_MAX_TOKENS":
            return { ...state, maxTokens: action.payload };
        case "SET_TOP_P":
            return { ...state, topP: action.payload };
        case "SET_MESSAGE_LIMIT":
            return { ...state, messageLimit: action.payload };
        case "SET_ENABLE_ARTIFACTS":
            return { ...state, enableArtifacts: action.payload };
        case "SET_ENABLE_INSTRUCTIONS":
            return { ...state, enableInstructions: action.payload };
        case "SET_ENABLE_SAFEGUARDS":
            return { ...state, enableSafeguards: action.payload };
        case "SET_ENABLE_LOGIC_MODE":
            return { ...state, enableLogicMode: action.payload };
        case "SET_ENABLE_PASTE_TO_FILE":
            return { ...state, enablePasteToFile: action.payload };
        case "SET_ENABLE_MEMORY":
            return { ...state, enableMemory: action.payload };
        case "SET_CUSTOM_INSTRUCTIONS":
            return { ...state, customInstructions: action.payload };
        case "SET_TOOL_CHOICE":
            return { ...state, toolChoice: action.payload };
        case "SET_REASONING_LEVEL":
            return { ...state, reasoningLevel: action.payload };
        case "SET_AUTO_ROUTER_MODEL":
            return { ...state, autoRouterModel: action.payload };
        case "SET_AUTO_PRIORITY":
            return { ...state, autoPriority: action.payload };
        default:
            return state;
    }
};

export function Chat({
    userId,
    chatId,
    isNewChat = false
}: {
    userId: string;
    chatId: string;
    // Set by the home page. Existing chats (/chat/[id]) are loaded from the
    // database; new ones aren't saved yet, so there is nothing to load. (The
    // URL can't tell: after "New chat" it briefly still shows the old chat.)
    isNewChat?: boolean;
}) {
    const path = usePathname();

    // Settings and the sidebar state persist across chats and reloads
    const { preferences, updatePreferences } = usePreferences();
    const state = preferences.settings;
    const dispatch = useCallback(
        (action: Action) =>
            updatePreferences((current) => ({
                ...current,
                settings: reducer(current.settings, action)
            })),
        [updatePreferences]
    );

    // On small screens the sidebar is an overlay, so it always starts closed
    const isDesktop = useMediaQuery("(min-width: 1024px)");
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const isSidebarOpen = isDesktop ? preferences.sidebarOpen : isMobileSidebarOpen;
    const setIsSidebarOpen = useCallback(
        (open: boolean) => {
            if (isDesktop) {
                updatePreferences((current) => ({ ...current, sidebarOpen: open }));
            } else {
                setIsMobileSidebarOpen(open);
            }
        },
        [isDesktop, updatePreferences]
    );

    const [activeTab, setActiveTab] = useState("preview");
    const [artifacts, setArtifacts] = useState<Artifact[]>([]);
    const [currentArtifactIndex, setCurrentArtifactIndex] = useState(-1);

    const [isArtifactsOpen, setIsArtifactsOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const isStreamingArtifactRef = useRef(false);
    // Follow new output only while the reader is at the bottom (like Claude
    // and Codex), see handleMessagesScroll
    const followOutputRef = useRef(true);
    const lastProcessedMessageRef = useRef<ChatUIMessage | null>(null);
    // Messages restored from the database are already processed and must not be
    // re-run through processMessage (it would apply the current settings to them)
    const loadedMessageIdsRef = useRef<Set<string>>(new Set());
    const shouldLoadChatRef = useRef(!isNewChat);
    const shouldSaveRef = useRef(false);
    const combinedMessagesRef = useRef<CombinedMessage[]>([]);

    const [showContinueButton, setShowContinueButton] = useState(false);

    const [combinedMessages, setCombinedMessages] = useState<CombinedMessage[]>(
        []
    );

    // Connected GitHub repository; the ref lets save() read the latest value
    const [repo, setRepo] = useState<RepoConnection | null>(null);
    const repoRef = useRef<RepoConnection | null>(null);

    const [regeneratingMessageId, setRegeneratingMessageId] = useState<
        string | null
    >(null);

    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const [input, setInput] = useState("");

    const { messages, setMessages, sendMessage, status, error, stop, regenerate } =
        useChat<ChatUIMessage>({
            transport,
            // Batch streamed chunks. Each update re-runs message processing,
            // and long fast replies otherwise exceed React's nested update limit
            throttle: 50,
            // Also called after stop() and errors. The save happens once the
            // status settles and the final message has been processed (see below)
            onFinish: ({ message }) => {
                shouldSaveRef.current = true;
                console.log("Chat finished:", message);
            },
            onError: (error) => {
                shouldSaveRef.current = true;
                console.error("Chat error:", error.message);
            }
        });

    const isLoading = status === "submitted" || status === "streaming";

    const requestOptions = { body: { userId, settings: state, repo } };

    const addMessage = (message: NewMessage) => {
        shouldSaveRef.current = true;
        followOutputRef.current = true;
        sendMessage({ text: message.content }, requestOptions);
    };

    const handleSubmit = (
        event: React.FormEvent<HTMLFormElement>,
        files?: FileList
    ) => {
        event.preventDefault();
        if (!input.trim() && (!files || files.length === 0)) {
            return;
        }
        shouldSaveRef.current = true;
        followOutputRef.current = true;
        sendMessage({ text: input, files }, requestOptions);
        setInput("");
    };

    const reload = useCallback(() => {
        shouldSaveRef.current = true;
        regenerate({ body: { userId, settings: state, repo } });
    }, [regenerate, userId, state, repo]);

    // A new chat gets its own URL once it has a message (without navigating,
    // so this component stays mounted)
    useEffect(() => {
        if (isNewChat && messages.length === 1 && !path.includes("chat")) {
            window.history.replaceState({}, "", `/chat/${chatId}`);
        }
    }, [isNewChat, chatId, messages.length, path]);

    // Existing chats are loaded once, when the component mounts
    useEffect(() => {
        const loadExistingChat = async () => {
            if (!shouldLoadChatRef.current) return;
            shouldLoadChatRef.current = false;
            try {
                const response = await fetch(`/api/chat/${chatId}`);
                if (response.status === 404) {
                    // Deleted, or a link to a chat that was never saved
                    console.warn(`Chat ${chatId} not found`);
                    return;
                }
                if (!response.ok) {
                    console.error(`Failed to load chat (HTTP ${response.status})`);
                    return;
                }

                const chatData = await response.json();
                const newCombinedMessages: CombinedMessage[] = chatData.messages.slice();
                repoRef.current = chatData.repo ?? null;
                setRepo(chatData.repo ?? null);
                loadedMessageIdsRef.current = new Set(
                    newCombinedMessages.map((message) => message.id)
                );
                setMessages(newCombinedMessages.map(toUIMessage));
                setCombinedMessages(newCombinedMessages);
                setArtifacts(
                    newCombinedMessages
                        .map((message) => message.artifact)
                        .filter(
                            (artifact): artifact is Artifact => artifact !== undefined
                        )
                );
            } catch (error) {
                console.error("Error loading chat data:", error);
            }
        };

        loadExistingChat();
    }, [chatId, setMessages]);

    useEffect(() => {
        if (combinedMessages.length > 0) {
            combinedMessagesRef.current = combinedMessages;
        }
    }, [combinedMessages]);

    const save = useCallback(async () => {
        if (
            !combinedMessagesRef.current ||
            combinedMessagesRef.current.length === 0
        ) {
            return;
        }

        shouldSaveRef.current = false;
        console.log("Saving...");
        await saveChat(
            userId,
            chatId,
            combinedMessagesRef.current[0].originalContent.slice(0, 50),
            combinedMessagesRef.current,
            state,
            repoRef.current
        );
        console.log("Save completed");
    }, [state, userId, chatId]);

    const processMessage = useCallback(
        (content: string, model?: ModelKey) => {
            if (!state.enableArtifacts || !content.includes("<assistant")) {
                return {
                    cleanedContent: markdownToHtml(content),
                    artifact: undefined,
                    model: model || state.model
                };
            }

            const { cleanedContent, artifacts } = extractArtifacts(content);

            let artifact: Artifact | null = null;
            if (artifacts.length > 0) {
                const extractedArtifact = artifacts[0];
                artifact = {
                    identifier: extractedArtifact.identifier,
                    type: extractedArtifact.type,
                    language: extractedArtifact.language,
                    title: extractedArtifact.title,
                    content: extractedArtifact.content
                };

                if (extractedArtifact.isComplete) {
                    // Complete artifact
                    if (isStreamingArtifactRef.current) {
                        isStreamingArtifactRef.current = false;
                        shouldSaveRef.current = true;
                        setArtifacts((prevArtifacts) => [
                            ...prevArtifacts.slice(0, -1),
                            artifact as Artifact
                        ]);
                        setActiveTab("preview");
                    }
                } else {
                    // Incomplete artifact (streaming) - this handles the live streaming
                    if (!isStreamingArtifactRef.current) {
                        // First time we detect an artifact - initialize streaming
                        isStreamingArtifactRef.current = true;
                        setIsArtifactsOpen(true);
                        setActiveTab("code");
                        setArtifacts((prevArtifacts) => {
                            setCurrentArtifactIndex(prevArtifacts.length);
                            return [...prevArtifacts, artifact as Artifact];
                        });
                    } else {
                        // Update the streaming artifact with new content
                        setArtifacts((prevArtifacts) => [
                            ...prevArtifacts.slice(0, -1),
                            artifact as Artifact
                        ]);
                    }
                }
            }

            return {
                cleanedContent: markdownToHtml(cleanedContent),
                artifact,
                model: model || state.model
            };
        },
        [state.enableArtifacts, state.model]
    );

    useEffect(() => {
        const processMessages = () => {
            const latestMessageIndex = messages.length - 1;
            const latestMessage = messages[latestMessageIndex];

            if (!latestMessage) return;

            const latestContent = getMessageText(latestMessage);
            const toolInvocations = getToolInvocations(latestMessage);

            const { cleanedContent, artifact, model } = processMessage(
                latestContent,
                // The model that answered (Auto's pick), else the previous value
                latestMessage.metadata?.model ??
                    combinedMessages[latestMessageIndex]?.model
            );

            const {
                promptTokens,
                completionTokens,
                totalTokens,
                cacheWriteTokens,
                cacheReadTokens,
                finishReason,
                autoRoute
            } = latestMessage.metadata ?? {};
            const reasoning = getMessageReasoning(latestMessage) || undefined;

            setShowContinueButton(
                finishReason === "length" && latestMessage.role === "assistant"
            );

            let newCombinedMessages = [...combinedMessages];

            // Check if we're regenerating a message
            if (regeneratingMessageId && latestMessage.role === "assistant") {
                // Find the index of the message we're regenerating
                const regeneratedIndex = newCombinedMessages.findIndex(
                    (m) => m.id === regeneratingMessageId
                );

                if (regeneratedIndex !== -1) {
                    // Update the regenerated message
                    newCombinedMessages[regeneratedIndex] = {
                        ...newCombinedMessages[regeneratedIndex],
                        id: latestMessage.id, // Update with the new message ID
                        originalContent: latestContent,
                        processedContent: cleanedContent,
                        artifact: artifact || undefined,
                        model,
                        toolInvocations,
                        promptTokens,
                        completionTokens,
                        totalTokens,
                        finishReason,
                        reasoning,
                        autoRoute,
                        states: [
                            ...newCombinedMessages[regeneratedIndex].states,
                            {
                                content: cleanedContent || "",
                                artifact: artifact || undefined,
                                timestamp: Date.now()
                            }
                        ]
                    };

                    // Reset the regeneratingMessageId
                    setRegeneratingMessageId(null);
                }
            } else {
                // Normal message processing (new message or update)
                const existingMessageIndex = newCombinedMessages.findIndex(
                    (m) => m.id === latestMessage.id
                );

                if (existingMessageIndex !== -1) {
                    // Update existing message. Usage and reasoning only arrive at
                    // certain points of the stream, so keep earlier values
                    const existing = newCombinedMessages[existingMessageIndex];
                    newCombinedMessages[existingMessageIndex] = {
                        ...existing,
                        originalContent: latestContent,
                        processedContent: cleanedContent,
                        artifact: artifact || undefined,
                        model,
                        toolInvocations,
                        promptTokens: promptTokens ?? existing.promptTokens,
                        completionTokens:
                            completionTokens ?? existing.completionTokens,
                        totalTokens: totalTokens ?? existing.totalTokens,
                        cacheWriteTokens:
                            cacheWriteTokens ?? existing.cacheWriteTokens,
                        cacheReadTokens:
                            cacheReadTokens ?? existing.cacheReadTokens,
                        finishReason: finishReason ?? existing.finishReason,
                        reasoning: reasoning ?? existing.reasoning,
                        autoRoute: autoRoute ?? existing.autoRoute,
                        states: [
                            ...newCombinedMessages[
                                existingMessageIndex
                            ].states.slice(0, -1),
                            {
                                content: cleanedContent || "",
                                artifact: artifact || undefined,
                                timestamp: Date.now()
                            }
                        ]
                    };
                } else {
                    // Add new message
                    newCombinedMessages.push({
                        id: latestMessage.id,
                        role: latestMessage.role,
                        originalContent: latestContent,
                        processedContent: cleanedContent || "",
                        attachments: getAttachments(latestMessage),
                        artifact: artifact || undefined,
                        model,
                        toolInvocations,
                        promptTokens,
                        completionTokens,
                        totalTokens,
                        cacheWriteTokens,
                        cacheReadTokens,
                        finishReason,
                        reasoning,
                        autoRoute,
                        states: [
                            {
                                content: cleanedContent || "",
                                artifact: artifact || undefined,
                                timestamp: Date.now()
                            }
                        ]
                    });
                }
            }

            setCombinedMessages(newCombinedMessages);
            // Keep the ref current so a save in this pass includes this update
            combinedMessagesRef.current = newCombinedMessages;

            if (shouldSaveRef.current) {
                console.log("COMBINED MESSAGE SHOULD SAVE...");
                save();
            }
        };

        const latestMessageIndex = messages.length - 1;
        const latestMessage = messages[latestMessageIndex];

        // useChat replaces the message object whenever its parts or metadata change
        if (
            latestMessage &&
            latestMessage !== lastProcessedMessageRef.current &&
            !loadedMessageIdsRef.current.has(latestMessage.id)
        ) {
            // Processed in the next frame, not in the effect: setting state from
            // an effect on every streamed update chains synchronous re-renders,
            // and with a long artifact each pass takes longer than the stream's
            // throttle, so React hits its nested update limit. A frame also
            // merges bursts (only the latest message is processed).
            const frame = requestAnimationFrame(() => {
                lastProcessedMessageRef.current = latestMessage;
                processMessages();
            });
            return () => cancelAnimationFrame(frame);
        }
    }, [
        messages,
        state.model,
        processMessage,
        combinedMessages,
        regeneratingMessageId,
        save
    ]);

    // Also a frame later, so the final update is processed (scheduled above,
    // and frames run in order) before the chat is saved
    useEffect(() => {
        if ((status === "ready" || status === "error") && shouldSaveRef.current) {
            const frame = requestAnimationFrame(() => {
                if (shouldSaveRef.current) save();
            });
            return () => cancelAnimationFrame(frame);
        }
    }, [status, save]);

    // Modify the reload function to set the regeneratingMessageId
    const handleReload = useCallback(() => {
        const lastAssistantMessage = combinedMessages.findLast(
            (m) => m.role === "assistant"
        );
        if (lastAssistantMessage) {
            setRegeneratingMessageId(lastAssistantMessage.id);
        }
        reload();
    }, [combinedMessages, reload]);

    const openArtifact = (identifier: string) => {
        setIsArtifactsOpen(true);
        setCurrentArtifactIndex(
            artifacts.indexOf(
                artifacts.filter(
                    (artifact) => artifact.identifier === identifier
                )[0]
            ) || 0
        );
    };

    const scrollToBottom = useCallback(() => {
        if (messagesContainerRef.current && messagesEndRef.current) {
            const containerHeight = messagesContainerRef.current.clientHeight;
            const contentHeight = messagesContainerRef.current.scrollHeight;
            const bottomOffset = contentHeight - containerHeight;

            messagesContainerRef.current.scrollTo({
                top: bottomOffset,
                behavior: "auto"
            });
        }
    }, []);

    // Scrolling up stops following, scrolling back down or
    // sending a message resumes it. Artifact streaming never moves the chat.
    const handleMessagesScroll = useCallback(() => {
        const container = messagesContainerRef.current;
        if (!container) return;
        followOutputRef.current =
            container.scrollHeight - container.scrollTop - container.clientHeight < 48;
    }, []);

    useLayoutEffect(() => {
        if (followOutputRef.current && !isStreamingArtifactRef.current) {
            scrollToBottom();
        }
    }, [combinedMessages, scrollToBottom]);

    const updateRepo = (connection: RepoConnection | null) => {
        repoRef.current = connection;
        setRepo(connection);
        // Persist the change for chats that already exist
        if (combinedMessagesRef.current.length > 0) {
            save();
        }
    };

    return (
        <div className="flex h-full w-full">
            <SidebarContainer
                userId={userId}
                isOpen={isSidebarOpen}
                onOpenChange={setIsSidebarOpen}
            />
            <div className="flex flex-col h-screen w-full overflow-hidden">
                <SettingsMenu
                    isOpen={isSettingsOpen}
                    onClose={() => {
                        save();
                        setIsSettingsOpen(false);
                    }}
                    settings={state}
                    dispatch={dispatch}
                />
                <div className="flex grow overflow-hidden">
                    <div
                        className={`flex flex-col ${
                            isArtifactsOpen ? "w-[55%]" : "w-full"
                        } h-full bg-background transition-all duration-300`}
                    >
                        <ChatHeader
                            artifacts={artifacts && artifacts.length > 0}
                            isArtifactsOpen={isArtifactsOpen}
                            setIsArtifactsOpen={setIsArtifactsOpen}
                            selectedModel={state.model}
                            onModelSelect={(newModel) =>
                                dispatch({
                                    type: "SET_MODEL",
                                    payload: newModel
                                })
                            }
                            onOpenSettings={() => setIsSettingsOpen(true)}
                            isSidebarOpen={isSidebarOpen}
                            onSidebarOpenChange={setIsSidebarOpen}
                        />
                        <div
                            ref={messagesContainerRef}
                            onScroll={handleMessagesScroll}
                            className="grow w-full h-full overflow-y-auto justify-center transition-all duration-300"
                        >
                            <div className="shrink h-full p-4 space-y-4 max-w-[700px] mx-auto">
                                {combinedMessages.length === 0 && isNewChat ? (
                                    <DefaultPrompts addMessage={addMessage} />
                                ) : (
                                    <Messages
                                        messages={combinedMessages}
                                        onArtifactClick={openArtifact}
                                        onRegenerate={handleReload}
                                        addMessage={addMessage}
                                        isStreaming={isLoading}
                                    />
                                )}
                                {error && (
                                    <ChatErrorMessage
                                        message={error.message}
                                        onRetry={reload}
                                    />
                                )}
                                <div ref={messagesEndRef} />
                            </div>
                        </div>
                        <ContinueButton
                            show={showContinueButton}
                            onHide={() => setShowContinueButton(false)}
                            appendMessage={addMessage}
                        />
                        <ChatFooter
                            input={input}
                            handleInputChange={(event) =>
                                setInput(event.target.value)
                            }
                            handleSubmit={handleSubmit}
                            isLoading={isLoading}
                            handleStop={() => {
                                stop();
                                shouldSaveRef.current = true;
                            }}
                            enablePasteToFile={state.enablePasteToFile}
                            disabled={!!error}
                            leftControls={
                                <GitHubRepoSelector
                                    connection={repo}
                                    onConnect={updateRepo}
                                    onDisconnect={() => updateRepo(null)}
                                />
                            }
                            controls={
                                // Auto picks the reasoning effort per message
                                state.model !== "auto" && (
                                    <ReasoningLevelSelect
                                        compact
                                        value={state.reasoningLevel}
                                        onChange={(value) =>
                                            dispatch({
                                                type: "SET_REASONING_LEVEL",
                                                payload: value
                                            })
                                        }
                                    />
                                )
                            }
                        />
                    </div>
                    <ArtifactsWindow
                        isOpen={isArtifactsOpen}
                        onClose={() => setIsArtifactsOpen(false)}
                        artifacts={artifacts}
                        currentArtifactIndex={currentArtifactIndex}
                        setCurrentArtifactIndex={setCurrentArtifactIndex}
                        activeTab={activeTab}
                        setActiveTab={setActiveTab}
                        isStreamingArtifactRef={isStreamingArtifactRef}
                    />
                </div>
            </div>
        </div>
    );
}
