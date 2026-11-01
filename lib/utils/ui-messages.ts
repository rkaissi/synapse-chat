import { getToolName, isToolUIPart, UIMessage } from "ai";
import {
    Attachment,
    ChatUIMessage,
    CombinedMessage,
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
        args: part.input,
        result:
            part.state === "output-available"
                ? part.output
                : part.state === "output-error"
                  ? { error: part.errorText }
                  : undefined
    }));

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
