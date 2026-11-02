import { getToolName, isToolUIPart, UIMessage } from "ai";
import {
    Attachment,
    ChatUIMessage,
    CombinedMessage,
    MessageSegment,
    ToolInvocation
} from "@/lib/types";

// Helpers that bridge AI SDK UI messages (parts-based) and the legacy
// content/toolInvocations/attachments shape that chats are persisted in.

export const getMessageText = (message?: UIMessage) =>
    message?.parts
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("") ?? "";

export const getMessageReasoning = (message: UIMessage) =>
    message.parts
        .filter((part) => part.type === "reasoning")
        .map((part) => part.text)
        .join("\n");

export const getToolInvocations = (message: UIMessage): ToolInvocation[] =>
    message.parts.filter(isToolUIPart).map((part) => ({
        state:
            part.state === "output-available" || part.state === "output-error"
                ? "result"
                : part.state === "input-streaming"
                  ? "partial-call"
                  : "call",
        toolCallId: part.toolCallId,
        toolName: getToolName(part),
        // Input is undefined until the tool input has finished streaming
        args: part.input ?? {},
        result:
            part.state === "output-available"
                ? part.output
                : part.state === "output-error"
                  ? { error: part.errorText }
                  : undefined
    }));

/**
 * The reply's text, reasoning and tool calls in the order they streamed, so
 * text written after a tool call renders below its card. Consecutive text or
 * reasoning parts are merged (providers split reasoning summaries into one
 * part per paragraph), and blank text between tool calls is dropped.
 * `texts` holds the markdown of each text segment, in order.
 */
export const getMessageSegments = (message: UIMessage) => {
    const segments: MessageSegment[] = [];
    const texts: string[] = [];

    for (const part of message.parts) {
        const last = segments.at(-1);
        if (part.type === "text") {
            if (last?.type === "text") {
                texts[texts.length - 1] += part.text;
            } else {
                segments.push({ type: "text" });
                texts.push(part.text);
            }
        } else if (part.type === "reasoning") {
            const done = part.state !== "streaming";
            if (last?.type === "reasoning") {
                last.text = [last.text, part.text].filter(Boolean).join("\n\n");
                last.done = last.done && done;
            } else {
                segments.push({ type: "reasoning", text: part.text, done });
            }
        } else if (isToolUIPart(part)) {
            segments.push({ type: "tool", toolCallId: part.toolCallId });
        }
    }

    // Drop blank text segments (e.g. a newline between two tool calls)
    let textIndex = 0;
    const kept: MessageSegment[] = [];
    const keptTexts: string[] = [];
    for (const segment of segments) {
        if (segment.type !== "text") {
            kept.push(segment);
            continue;
        }
        const text = texts[textIndex++];
        if (text.trim() === "") continue;
        kept.push(segment);
        keptTexts.push(text);
    }

    return { segments: kept, texts: keptTexts };
};

export const getAttachments = (message: UIMessage): Attachment[] =>
    message.parts
        .filter((part) => part.type === "file")
        .map((part) => ({
            name: part.filename ?? "attachment",
            contentType: part.mediaType,
            url: part.url
        }));

// Rebuilds a UI message from a persisted chat message
export const toUIMessage = (message: CombinedMessage): ChatUIMessage => {
    const files = (message.attachments ?? []).map((attachment) => ({
        type: "file" as const,
        mediaType: attachment.contentType || "application/octet-stream",
        filename: attachment.name,
        url: attachment.url
    }));
    const tools = (message.toolInvocations ?? [])
        .filter((invocation) => invocation.state === "result")
        .map((invocation) => ({
            type: "dynamic-tool" as const,
            toolName: invocation.toolName,
            toolCallId: invocation.toolCallId,
            state: "output-available" as const,
            input: invocation.args,
            output: invocation.result
        }));

    return {
        id: message.id,
        role: message.role as ChatUIMessage["role"],
        parts: [
            ...files,
            ...tools,
            // Keeps the final answer in its own step after the tool results
            ...(tools.length > 0 ? [{ type: "step-start" as const }] : []),
            { type: "text" as const, text: message.originalContent }
        ]
    };
};

// Many models reject text/* file parts, so send their contents as text instead
export const inlineTextFileParts = async <T extends UIMessage>(
    messages: T[]
): Promise<T[]> =>
    Promise.all(
        messages.map(async (message) => ({
            ...message,
            parts: await Promise.all(
                message.parts.map(async (part) => {
                    if (
                        part.type !== "file" ||
                        !part.mediaType.startsWith("text/")
                    ) {
                        return part;
                    }
                    const text = await (await fetch(part.url)).text();
                    return {
                        type: "text" as const,
                        text: `<file name="${part.filename ?? "attachment"}">\n${text}\n</file>`
                    };
                })
            )
        }))
    );
