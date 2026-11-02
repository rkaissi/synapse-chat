import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { BrainIcon, ChevronRightIcon } from "lucide-react";
import { CustomMarkdown } from "./markdown";
import markdownToHtml from "@/lib/utils/markdown-to-html";
import { cn } from "@/lib/utils";

interface ReasoningDisplayProps {
    reasoning: string;
    // Still reasoning: shows a live "Thinking" header and the summary as it streams
    isStreaming?: boolean;
    durationMs?: number;
}

const formatDuration = (ms: number) => {
    const seconds = Math.max(1, Math.round(ms / 1000));
    return seconds < 60
        ? `${seconds}s`
        : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
};

// Seconds since the component mounted, updated every second while active
const useElapsed = (active: boolean) => {
    const [start] = useState(() => Date.now());
    const [now, setNow] = useState(start);
    useEffect(() => {
        if (!active) return;
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, [active]);
    return now - start;
};

export const ThinkingIndicator = ({ label = "Thinking" }: { label?: string }) => (
    <div className="flex items-center gap-2 py-1 text-sm text-muted-foreground">
        <BrainIcon className="h-4 w-4 animate-pulse" />
        <span className="agent-shimmer font-medium">{label}…</span>
    </div>
);

export const ReasoningDisplay: React.FC<ReasoningDisplayProps> = ({
    reasoning,
    isStreaming = false,
    durationMs
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const elapsed = useElapsed(isStreaming);
    const contentRef = useRef<HTMLDivElement>(null);
    const text = reasoning?.trim() === "N/A" ? "" : (reasoning?.trim() ?? "");
    const html = useMemo(() => (text ? markdownToHtml(text) : ""), [text]);

    // Follow the newest reasoning while it streams
    useLayoutEffect(() => {
        const element = contentRef.current;
        if (isStreaming && element) element.scrollTop = element.scrollHeight;
    }, [html, isStreaming]);

    if (!isStreaming && !text && durationMs === undefined) return null;

    const label = isStreaming
        ? `Thinking${elapsed >= 1000 ? ` for ${formatDuration(elapsed)}` : ""}`
        : durationMs !== undefined
          ? `Thought for ${formatDuration(durationMs)}`
          : "Reasoning";
    const expanded = isStreaming || isOpen;
    const canExpand = !isStreaming && !!text;

    return (
        <div className="mb-3">
            <button
                type="button"
                onClick={() => canExpand && setIsOpen((open) => !open)}
                className={cn(
                    "flex items-center gap-1.5 py-1 text-sm font-medium text-muted-foreground",
                    canExpand ? "hover:text-foreground" : "cursor-default"
                )}
                aria-expanded={expanded}
            >
                <BrainIcon
                    className={cn("h-4 w-4", isStreaming && "animate-pulse")}
                />
                <span className={cn(isStreaming && "agent-shimmer")}>
                    {label}
                    {isStreaming && "…"}
                </span>
                {canExpand && (
                    <ChevronRightIcon
                        className={cn(
                            "h-4 w-4 transition-transform",
                            isOpen && "rotate-90"
                        )}
                    />
                )}
            </button>
            {expanded && html && (
                <div
                    ref={contentRef}
                    className={cn(
                        "mt-1 border-l-2 border-gray-300 pl-3 text-muted-foreground",
                        // Keep a streaming summary compact; the full text is
                        // available once it's done
                        isStreaming && "max-h-40 overflow-y-auto"
                    )}
                >
                    <CustomMarkdown html={html} className="text-sm" />
                </div>
            )}
        </div>
    );
};
