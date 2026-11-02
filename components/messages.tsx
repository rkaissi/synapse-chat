import {
    Artifact,
    AUTO_ROUTER_MODELS,
    CombinedMessage,
    MessageSegment,
    NewMessage,
    ToolInvocation
} from "@/lib/types";
import React, {
    memo,
    useCallback,
    useLayoutEffect,
    useRef,
    useState
} from "react";
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
    Badge,
    Button
} from "@/components/ui";
import { CustomMarkdown } from "./markdown";
import { FileIcon } from "@radix-ui/react-icons";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from "@/components/ui/tooltip";
import { RefreshIcon } from "./icons";
import {
    ClipboardCheckIcon,
    ClipboardCopyIcon,
    ChevronDownIcon,
    ChevronUpIcon,
    CheckIcon,
    CircleAlertIcon,
    LoaderCircleIcon
} from "lucide-react";
import { USER_NAME } from "@/app/api/chat/config";
import dynamic from "next/dynamic";
import { models } from "@/lib/utils/model-provider";
import ReadUrlCard from "./tools/readurl";
import { ReasoningDisplay, ThinkingIndicator } from "./reasoningdisplay";
import { SEGMENT_SEPARATOR } from "@/lib/utils/markdown-to-html";

const ImageGallery = dynamic(
    () => import("@/components/tools").then((mod) => mod.ImageGallery),
    { ssr: false }
);
const RelatedSearches = dynamic(
    () => import("@/components/tools").then((mod) => mod.RelatedSearches),
    { ssr: false }
);
const SourceCard = dynamic(
    () => import("@/components/tools").then((mod) => mod.SourceCard),
    { ssr: false }
);
const TimeCard = dynamic(
    () => import("@/components/tools").then((mod) => mod.TimeCard),
    { ssr: false }
);
const WeatherCard = dynamic(
    () => import("@/components/tools").then((mod) => mod.WeatherCard),
    { ssr: false }
);
const WikipediaSearchCard = dynamic(
    () => import("@/components/tools").then((mod) => mod.WikipediaSearchCard),
    { ssr: false }
);
const WikipediaSummaryCard = dynamic(
    () => import("@/components/tools").then((mod) => mod.WikipediaSummaryCard),
    { ssr: false }
);
const AgentsCard = dynamic(
    () => import("@/components/tools").then((mod) => mod.AgentsCard),
    { ssr: false }
);
const AttachmentPreview = dynamic(() => import("./attachmentpreview"), {
    ssr: false
});
const AttachmentModal = dynamic(() => import("./attachmentmodal"), {
    ssr: false
});

// Chats saved before the switch to OpenAI web search used `bing_web_search`
const isWebSearch = (toolName: string) =>
    toolName === "web_search" || toolName === "bing_web_search";

interface MessagesProps {
    messages: CombinedMessage[];
    onArtifactClick: (identifier: string) => void;
    onRegenerate?: () => void;
    addMessage?: (message: NewMessage) => void;
    // Whether the latest message is still streaming
    isStreaming?: boolean;
}

export const Messages = ({
    messages,
    onArtifactClick,
    onRegenerate,
    addMessage,
    isStreaming = false
}: MessagesProps) => {
    const elementsRef = useRef(new Map<string, HTMLDivElement>());

    // Off-screen messages skip layout and paint (`content-visibility: auto`),
    // which keeps long chats responsive. The latest exchange always renders.
    // The placeholder size is each message's measured height (a fixed guess
    // made a loaded chat's scroll height jump), and all heights are read
    // before any style is written, so this costs one layout, not one per
    // message
    useLayoutEffect(() => {
        const toEnable: HTMLDivElement[] = [];
        const toDisable: HTMLDivElement[] = [];
        messages.forEach((message, index) => {
            const element = elementsRef.current.get(message.id);
            if (!element) return;
            const enabled = index < messages.length - 2;
            const isEnabled = element.style.contentVisibility === "auto";
            if (enabled && !isEnabled) toEnable.push(element);
            if (!enabled && isEnabled) toDisable.push(element);
        });

        const heights = toEnable.map((element) => element.offsetHeight);
        toEnable.forEach((element, index) => {
            element.style.containIntrinsicSize = `auto ${heights[index]}px`;
            element.style.contentVisibility = "auto";
        });
        toDisable.forEach((element) => {
            element.style.contentVisibility = "";
            element.style.containIntrinsicSize = "";
        });
    }, [messages]);

    return (
        <>
            {messages.map((message, index) => {
                const isLatest = index === messages.length - 1;
                const content =
                    message.role === "user" ? (
                        <MemoizedUserMessage message={message} />
                    ) : message.role === "assistant" ? (
                        <MemoizedAssistantMessage
                            message={message}
                            onArtifactClick={onArtifactClick}
                            onRegenerate={isLatest ? onRegenerate : undefined}
                            isLatestResponse={isLatest}
                            isStreaming={isStreaming && isLatest}
                            addMessage={addMessage}
                        />
                    ) : null;
                if (!content) return null;
                return (
                    <div
                        key={message.id}
                        ref={(element) => {
                            if (element) {
                                elementsRef.current.set(message.id, element);
                            } else {
                                elementsRef.current.delete(message.id);
                            }
                        }}
                    >
                        {content}
                    </div>
                );
            })}
            {isStreaming && messages.at(-1)?.role === "user" && <PendingReply />}
        </>
    );
};

interface UserMessageProps {
    message: CombinedMessage;
}

export const UserMessage = ({ message }: UserMessageProps) => {
    return (
        <div className="flex items-start gap-4">
            <Avatar className="w-9 h-9 border shrink-0">
                <AvatarImage
                    src={`https://avatar.oxro.io/avatar.svg?name=${USER_NAME.replace(
                        " ",
                        "+"
                    )}`}
                />
                <AvatarFallback>U</AvatarFallback>
            </Avatar>
            <div className="flex-1 overflow-hidden mb-2">
                <div className="flex items-center justify-between align-middle pt-1 pr-1">
                    <div className="font-bold text-lg">{USER_NAME}</div>
                    <CopyButton content={message.originalContent} />
                </div>
                <div className="text-muted-foreground text-wrap w-full">
                    <CustomMarkdown html={message.processedContent} />
                </div>
                {message.attachments && message.attachments.length > 0 && (
                    <AttachmentPreview attachments={message.attachments} />
                )}
            </div>
        </div>
    );
};

interface AssistantMessageProps {
    message: CombinedMessage | string;
    isLatestResponse: boolean;
    isStreaming?: boolean;
    onArtifactClick?: (identifier: string) => void;
    onRegenerate?: () => void;
    addMessage?: (message: NewMessage) => void;
}

const AssistantHeader = ({ children }: { children?: React.ReactNode }) => (
    <div className="flex items-center justify-between align-middle pt-1 pr-1">
        {children}
    </div>
);

const AssistantAvatar = () => (
    <Avatar className="w-9 h-9 border shrink-0">
        <AvatarImage src="/placeholder-user.jpg" />
        <AvatarFallback>OA</AvatarFallback>
    </Avatar>
);

// Shown between sending a message and the first part of the reply
const PendingReply = () => (
    <div className="flex items-start gap-4">
        <AssistantAvatar />
        <div className="flex-1 overflow-hidden mb-2">
            <AssistantHeader>
                <span className="font-bold text-lg">Assistant</span>
            </AssistantHeader>
            <ThinkingIndicator />
        </div>
    </div>
);

export const AssistantMessage = ({
    message,
    isLatestResponse,
    isStreaming = false,
    onArtifactClick,
    onRegenerate,
    addMessage
}: AssistantMessageProps) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [transcriptFile, setTranscriptFile] = useState<File | null>(null);

    const openTranscript = useCallback((transcript: string) => {
        setTranscriptFile(
            new File([transcript], "transcript.txt", { type: "text/plain" })
        );
        setIsModalOpen(true);
    }, []);

    const renderHtml = (message: CombinedMessage, html: string) => (
        <div className="text-muted-foreground text-wrap w-full">
            <MessageHtml
                html={html}
                artifact={message.artifact}
                onArtifactClick={onArtifactClick}
            />
        </div>
    );

    const renderToolCard = (invocation: ToolInvocation) => (
        <ToolCard
            invocation={invocation}
            isStreaming={isStreaming}
            addMessage={addMessage}
            onOpenTranscript={openTranscript}
        />
    );

    const renderOrdered = (
        message: CombinedMessage,
        segments: MessageSegment[]
    ) => {
        const htmlPieces = message.processedContent.split(SEGMENT_SEPARATOR);
        let textIndex = 0;
        const last = segments.at(-1);
        const lastInvocation =
            last?.type === "tool"
                ? message.toolInvocations?.find(
                      (tool) => tool.toolCallId === last.toolCallId
                  )
                : undefined;
        // Between steps nothing streams: after a finished tool call or
        // reasoning block the model is working on its next step
        const isWorking =
            isStreaming &&
            (!last ||
                (last.type === "reasoning" && last.done) ||
                (last.type === "tool" && lastInvocation?.state === "result"));

        return (
            <>
                {segments.map((segment, index) => {
                    if (segment.type === "text") {
                        const html = htmlPieces[textIndex++] ?? "";
                        return (
                            <div key={index} className="mb-3 last:mb-0">
                                {renderHtml(message, html)}
                            </div>
                        );
                    }
                    if (segment.type === "reasoning") {
                        return (
                            <ReasoningDisplay
                                key={index}
                                reasoning={segment.text}
                                isStreaming={isStreaming && !segment.done}
                                durationMs={segment.durationMs}
                            />
                        );
                    }
                    const invocation = message.toolInvocations?.find(
                        (tool) => tool.toolCallId === segment.toolCallId
                    );
                    if (!invocation) return null;
                    return (
                        <div key={index} className="mb-3 flex flex-col gap-3">
                            <ToolCallChip invocation={invocation} />
                            {renderToolCard(invocation)}
                        </div>
                    );
                })}
                {isWorking && <ThinkingIndicator />}
            </>
        );
    };

    // Chats saved before segments: agents above the text, other cards below
    const renderLegacy = (message: CombinedMessage) => {
        const invocations = message.toolInvocations ?? [];
        const agents = invocations.find(
            (tool) => tool.toolName === "call_agents"
        );
        return (
            <>
                {message.reasoning && (
                    <ReasoningDisplay reasoning={message.reasoning} />
                )}
                {/* The agents work before the reply is written */}
                {agents && (
                    <div className="mt-1 mb-3">{renderToolCard(agents)}</div>
                )}
                {message.originalContent &&
                    message.processedContent &&
                    renderHtml(message, message.processedContent)}
                <div className="flex flex-col space-y-4">
                    {invocations
                        .filter((tool) => tool.toolName !== "call_agents")
                        .map((tool) => (
                            <React.Fragment key={tool.toolCallId}>
                                {renderToolCard(tool)}
                            </React.Fragment>
                        ))}
                </div>
                {invocations.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                        {invocations.map((tool) => (
                            <ToolCallChip
                                key={tool.toolCallId}
                                invocation={tool}
                            />
                        ))}
                    </div>
                )}
            </>
        );
    };

    return (
        <>
            <div className="flex items-start gap-4">
                <AssistantAvatar />
                <div className="flex-1 overflow-hidden mb-2">
                    <AssistantHeader>
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-lg">Assistant</span>
                            {typeof message !== "string" && message.model && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger className="flex align-middle">
                                            <Badge>
                                                {message.autoRoute && "Auto · "}
                                                {models[message.model]?.name}
                                            </Badge>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <div className="flex flex-col space-y-1 max-w-96 overflow-auto">
                                                <span className="font-bold text-sm">
                                                    {
                                                        models[message.model]
                                                            ?.name
                                                    }
                                                </span>
                                                {message.autoRoute && (
                                                    <span>
                                                        Chosen by Auto:{" "}
                                                        {message.autoRoute.reason},{" "}
                                                        {message.autoRoute.reasoning} reasoning
                                                    </span>
                                                )}
                                                {message.autoRoute?.classifier && (
                                                    <span className="text-xs opacity-70">
                                                        Classified by{" "}
                                                        {AUTO_ROUTER_MODELS[message.autoRoute.classifier]}
                                                    </span>
                                                )}
                                                <span>
                                                    Output Tokens:{" "}
                                                    {message.completionTokens ||
                                                        "N/A"}
                                                </span>
                                                <span>
                                                    Context Tokens:{" "}
                                                    {message.promptTokens ||
                                                        "N/A"}
                                                </span>
                                                <span>
                                                    Cache Write Tokens:{" "}
                                                    {message.cacheWriteTokens ||
                                                        0}
                                                </span>
                                                <span>
                                                    Cache Read Tokens:{" "}
                                                    {message.cacheReadTokens ||
                                                        0}
                                                </span>
                                            </div>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                        </div>
                        <div className="flex h-full align-middle">
                            {isLatestResponse && onRegenerate && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={onRegenerate}
                                    className="flex items-center gap-2"
                                >
                                    <RefreshIcon className="w-4 h-4" />
                                    Regenerate
                                </Button>
                            )}
                            <CopyButton
                                content={
                                    typeof message === "string"
                                        ? message
                                        : message.originalContent
                                }
                            />
                        </div>
                    </AssistantHeader>

                    {typeof message === "string"
                        ? message
                        : message.segments
                          ? renderOrdered(message, message.segments)
                          : renderLegacy(message)}
                </div>
            </div>
            <AttachmentModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                file={transcriptFile}
                fallback={transcriptFile ? undefined : ""}
            />
        </>
    );
};

// Message HTML, with artifact placeholders replaced by buttons that open them
const MessageHtml = ({
    html,
    artifact,
    onArtifactClick
}: {
    html: string;
    artifact?: Artifact;
    onArtifactClick?: (identifier: string) => void;
}) => {
    if (!artifact || !onArtifactClick) return <CustomMarkdown html={html} />;

    return (
        <>
            {html.split(/(\[ARTIFACT:[^\]]+\])/).map((part, index) => {
                const match = part.match(/\[ARTIFACT:([^\]]+)\]/);
                if (match && match[1] === artifact.identifier) {
                    return (
                        <Button
                            key={index}
                            variant="outline"
                            size="sm"
                            onClick={() => onArtifactClick(artifact.identifier)}
                            className="inline-flex items-center gap-2 my-1"
                        >
                            <span className="text-xs font-bold uppercase text-gray-500">
                                {artifact.type}
                            </span>
                            <span>{artifact.title}</span>
                        </Button>
                    );
                }
                return <CustomMarkdown key={index} html={part} />;
            })}
        </>
    );
};

// args is empty while the tool input is still streaming
const formatToolArgs = (args?: Record<string, any>): string =>
    Object.entries(args ?? {})
        .map(([key, value]) => {
            const formattedKey = key.replace(/([A-Z])/g, " $1").trim();
            const capitalizedKey =
                formattedKey.charAt(0).toUpperCase() + formattedKey.slice(1);
            const formattedValue =
                typeof value === "string"
                    ? value
                    : (JSON.stringify(value) ?? "");
            return `${capitalizedKey}: ${formattedValue.substring(0, 500)}`;
        })
        .join("\n");

// The tool's name and status (running, done or failed), with its arguments
// in a tooltip
const ToolCallChip = ({ invocation }: { invocation: ToolInvocation }) => {
    const isRunning = invocation.state !== "result";
    const failed = !isRunning && !!invocation.result?.error;
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger className="self-start">
                    <Badge variant="outline" className="gap-1.5">
                        {isRunning ? (
                            <LoaderCircleIcon className="h-3 w-3 animate-spin" />
                        ) : failed ? (
                            <CircleAlertIcon className="h-3 w-3 text-red-500" />
                        ) : (
                            <CheckIcon className="h-3 w-3 text-green-500" />
                        )}
                        {invocation.toolName}
                    </Badge>
                </TooltipTrigger>
                <TooltipContent>
                    <div className="flex flex-col space-y-2 max-w-96 overflow-auto">
                        <span className="font-bold text-sm">
                            Tool Arguments
                        </span>
                        <div className="whitespace-pre-wrap text-sm">
                            {formatToolArgs(invocation.args)}
                        </div>
                        {failed && (
                            <span className="text-sm text-red-500">
                                {String(invocation.result.error)}
                            </span>
                        )}
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};

const WebSearchResults = ({
    result,
    addMessage
}: {
    result: any;
    addMessage?: (message: NewMessage) => void;
}) => {
    const [showAllSources, setShowAllSources] = useState(false);
    const { webPages, videos, relatedSearches, images } = result;
    const sources = [...(webPages?.value || []), ...(videos?.value || [])];
    const visibleSources = showAllSources ? sources : sources.slice(0, 3);

    return (
        <>
            {images?.value?.length > 0 && (
                <ImageGallery images={images.value} />
            )}
            {sources.length > 0 && (
                <div>
                    <h3 className="text-lg font-semibold mb-2">Sources</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {visibleSources.map((source, index) => (
                            <SourceCard key={index} source={source} />
                        ))}
                    </div>
                    {sources.length > 3 && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowAllSources(!showAllSources)}
                            className="mt-4"
                        >
                            {showAllSources ? (
                                <>
                                    <ChevronUpIcon className="w-4 h-4 mr-2" />
                                    Show less
                                </>
                            ) : (
                                <>
                                    <ChevronDownIcon className="w-4 h-4 mr-2" />
                                    View {sources.length - 3} more
                                </>
                            )}
                        </Button>
                    )}
                </div>
            )}
            {sources.length > 0 && relatedSearches?.value && (
                <RelatedSearches
                    searches={relatedSearches.value}
                    addMessage={addMessage ? addMessage : () => {}}
                />
            )}
        </>
    );
};

// The card for one tool call, if the tool has one
const ToolCard = ({
    invocation,
    isStreaming,
    addMessage,
    onOpenTranscript
}: {
    invocation: ToolInvocation;
    isStreaming: boolean;
    addMessage?: (message: NewMessage) => void;
    onOpenTranscript: (transcript: string) => void;
}) => {
    const { toolName, state, result, args } = invocation;

    // Progress updates arrive as preliminary results while the agents work
    if (toolName === "call_agents") {
        return <AgentsCard result={result} isStreaming={isStreaming} />;
    }
    if (state !== "result" || !result || result.error) return null;

    if (isWebSearch(toolName)) {
        return <WebSearchResults result={result} addMessage={addMessage} />;
    }
    switch (toolName) {
        case "wikipedia_get_page_summary":
            return <WikipediaSummaryCard summary={result} />;
        case "wikipedia_search":
            return <WikipediaSearchCard results={result.pages} />;
        case "get_current_time":
            return <TimeCard time={result.time} timeZone={args.timeZone} />;
        case "get_current_weather":
            return <WeatherCard weather={result} />;
        case "readUrl":
            return (
                <ReadUrlCard
                    result={result}
                    url={args.url}
                    returnFormat={args.returnFormat || "markdown"}
                />
            );
        case "get_youtube_video_transcript":
            return result.transcript ? (
                <div>
                    <h3 className="text-lg font-semibold mb-2">
                        Video Transcript
                    </h3>
                    <div
                        className="flex items-center max-w-80 p-2 pr-4 bg-white border border-input rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => onOpenTranscript(result.transcript)}
                    >
                        <div className="shrink-0 w-10 h-10 mr-3">
                            <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-md">
                                <FileIcon className="h-5 w-5 text-gray-500" />
                            </div>
                        </div>
                        <div className="grow min-w-0 overflow-hidden">
                            <p className="text-sm font-medium text-gray-900 truncate">
                                transcript.txt
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                                text/plain
                            </p>
                        </div>
                    </div>
                </div>
            ) : null;
        default:
            return null;
    }
};

interface CopyButtonProps {
    content: string;
}

const CopyButton: React.FC<CopyButtonProps> = ({ content }) => {
    const [isCopied, setIsCopied] = useState(false);

    const handleCopy = useCallback(() => {
        navigator.clipboard.writeText(content).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        });
    }, [content]);

    return (
        <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="ml-2"
            aria-label="Copy message content"
        >
            {isCopied ? (
                <ClipboardCheckIcon className="w-4 h-4 text-green-500" />
            ) : (
                <ClipboardCopyIcon className="w-4 h-4" />
            )}
        </Button>
    );
};

// Older messages keep their props while the latest one streams, so they
// skip re-rendering on every streamed update and keystroke
const MemoizedUserMessage = memo(UserMessage);
const MemoizedAssistantMessage = memo(AssistantMessage);
