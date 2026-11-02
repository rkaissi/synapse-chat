import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    ChevronDown,
    CircleAlert,
    CircleCheck,
    LoaderCircle,
    RotateCcw,
    TriangleAlert
} from "lucide-react";
import { CustomMarkdown } from "@/components/markdown";
import markdownToHtml from "@/lib/utils/markdown-to-html";
import { cn } from "@/lib/utils";
import { AgentProfile } from "@/lib/agents/events";
import { formatDuration, getAgentMeta, STEP_LABELS } from "./agent-meta";
import { AgentRevision, AgentRunState, AgentStep } from "@/lib/agents/run-state";

export const AgentAvatar = ({
    name,
    size = 32,
    active = false
}: {
    name: string;
    size?: number;
    active?: boolean;
}) => {
    const { icon: Icon, color } = getAgentMeta(name);
    return (
        <span
            className="relative inline-flex shrink-0 items-center justify-center rounded-xl transition-colors"
            style={{
                width: size,
                height: size,
                backgroundColor: active ? color : `${color}1f`,
                color: active ? "white" : color,
                boxShadow: active ? `0 0 0 4px ${color}2e` : undefined
            }}
        >
            <Icon style={{ width: size * 0.52, height: size * 0.52 }} />
        </span>
    );
};

export const Markdown = ({ text, className }: { text: string; className?: string }) => {
    const html = useMemo(() => markdownToHtml(text), [text]);
    return <CustomMarkdown html={html} className={cn("text-sm", className)} />;
};

// Agents return code with or without a fence
const asCodeBlock = (code: string) =>
    code.trimStart().startsWith("```") ? code : "```\n" + code + "\n```";

// Main deliverable of a task result, as markdown
export const getResultMarkdown = (content: any): string => {
    if (!content || typeof content !== "object") return String(content ?? "");
    const parts: string[] = [];
    if (content.output) parts.push(content.output);
    if (content.research) parts.push(content.research);
    if (content.code) parts.push(asCodeBlock(content.code));
    if (content.comments) parts.push(content.comments);
    if (content.sources) parts.push(`**Sources**\n\n${content.sources}`);
    return parts.join("\n\n");
};

const ListBlock = ({
    title,
    items,
    tone
}: {
    title: string;
    items?: string[];
    tone: "red" | "amber" | "violet" | "sky";
}) => {
    if (!items?.length) return null;
    const tones = {
        red: "bg-red-50 text-red-900 ring-red-100 marker:text-red-400",
        amber: "bg-amber-50 text-amber-900 ring-amber-100 marker:text-amber-400",
        violet: "bg-violet-50 text-violet-900 ring-violet-100 marker:text-violet-400",
        sky: "bg-sky-50 text-sky-900 ring-sky-100 marker:text-sky-400"
    };
    return (
        <div className={cn("rounded-xl px-4 py-3 ring-1", tones[tone])}>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide opacity-70">
                {title} · {items.length}
            </p>
            <ul className="ml-0 list-disc space-y-1 pl-4 text-sm">
                {items.map((item, index) => (
                    <li key={index}>{item}</li>
                ))}
            </ul>
        </div>
    );
};

const Thinking = ({ text }: { text?: string }) => {
    const [open, setOpen] = useState(false);
    if (!text) return null;
    return (
        <div className="rounded-xl bg-slate-50 ring-1 ring-slate-100">
            <button
                onClick={() => setOpen(!open)}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-slate-500 hover:text-slate-700"
            >
                Thought process
                <ChevronDown
                    className={cn("ml-auto h-3.5 w-3.5 transition-transform", open && "rotate-180")}
                />
            </button>
            {open && (
                <p className="whitespace-pre-wrap border-t border-slate-100 px-3 py-2.5 text-xs leading-relaxed text-slate-600 animate-in fade-in">
                    {text}
                </p>
            )}
        </div>
    );
};

// Clamps long content with a fade and a "show more" toggle
const Expandable = ({ children }: { children: React.ReactNode }) => {
    const [expanded, setExpanded] = useState(false);
    const [overflowing, setOverflowing] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const element = ref.current;
        if (!element) return;
        const observer = new ResizeObserver(() =>
            setOverflowing(element.scrollHeight > element.clientHeight + 1)
        );
        observer.observe(element);
        if (element.firstElementChild) observer.observe(element.firstElementChild);
        return () => observer.disconnect();
    }, []);

    return (
        <div className="relative">
            <div ref={ref} className={cn(!expanded && "max-h-80 overflow-hidden")}>
                {children}
            </div>
            {!expanded && overflowing && (
                <div className="absolute inset-x-0 bottom-0 flex h-20 items-end justify-center bg-gradient-to-t from-background via-background/90 to-transparent">
                    <button
                        onClick={() => setExpanded(true)}
                        className="mb-1 rounded-full bg-background px-3 py-1 text-xs font-medium text-slate-600 shadow-sm ring-1 ring-slate-200 hover:text-slate-900"
                    >
                        Show more
                    </button>
                </div>
            )}
        </div>
    );
};

const PlanContent = ({ content }: { content: any }) => (
    <div className="space-y-3">
        <Thinking text={content?.innerThinking} />
        <ol className="ml-0 space-y-2">
            {(content?.taskList ?? []).map((task: any, index: number) => (
                <li
                    key={index}
                    className="flex gap-3 rounded-lg border bg-muted/30 p-3"
                >
                    <span className="mt-0.5 font-mono text-xs text-slate-400">
                        {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                            <AgentAvatar name={task.agent} size={20} />
                            <span className="text-sm font-medium text-slate-800">
                                {task.agent}
                            </span>
                        </div>
                        <p className="text-sm leading-relaxed text-slate-600">{task.instructions}</p>
                    </div>
                </li>
            ))}
        </ol>
    </div>
);

const ReviewContent = ({ content }: { content: any }) => (
    <div className="space-y-2.5">
        <div
            className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                content?.needsRevision
                    ? "bg-amber-100 text-amber-800"
                    : "bg-emerald-100 text-emerald-800"
            )}
        >
            {content?.needsRevision ? (
                <CircleAlert className="h-3.5 w-3.5" />
            ) : (
                <CircleCheck className="h-3.5 w-3.5" />
            )}
            {content?.needsRevision ? "Revision requested" : "Approved"}
        </div>
        {content?.summary && (
            <p className="text-sm leading-relaxed text-slate-700">{content.summary}</p>
        )}
        {content?.needsRevision && content?.report && (
            <div className="rounded-xl bg-amber-50 px-4 py-3 ring-1 ring-amber-100">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-700/80">
                    Revision report
                </p>
                <Markdown text={content.report} className="text-amber-900" />
            </div>
        )}
    </div>
);

const TaskContent = ({ content }: { content: any }) => {
    const markdown = getResultMarkdown(content);
    return (
        <div className="space-y-3">
            <Thinking text={content?.innerThinking} />
            {markdown && (
                <Expandable>
                    <Markdown text={markdown} />
                </Expandable>
            )}
            <ListBlock title="Bugs" items={content?.bugs} tone="red" />
            <ListBlock title="Edge cases" items={content?.edgeCases} tone="amber" />
            <ListBlock title="Issues" items={content?.issues} tone="amber" />
            <ListBlock title="Connections" items={content?.connections} tone="sky" />
            <ListBlock title="Questions to explore" items={content?.relatedQuestions} tone="violet" />
        </div>
    );
};

const Working = ({ step }: { step: AgentStep }) => {
    const verb =
        step.kind === "plan"
            ? "Breaking down the request"
            : step.kind === "review"
              ? "Reviewing the result"
              : "Working on it";
    return (
        <div className="space-y-2.5">
            <p className="agent-shimmer text-sm font-medium text-slate-500">{verb}…</p>
            <div className="space-y-2">
                {[92, 78, 54].map((width) => (
                    <div
                        key={width}
                        className="h-2 animate-pulse rounded-full bg-slate-100"
                        style={{ width: `${width}%` }}
                    />
                ))}
            </div>
        </div>
    );
};

const StepCard = ({
    step,
    profile,
    taskCount,
    now,
    endedAt
}: {
    step: AgentStep;
    profile?: AgentProfile;
    taskCount?: number;
    now: number;
    // When the run ended (stopped or failed) before this step finished
    endedAt?: number;
}) => {
    const running = step.finishedAt === undefined && endedAt === undefined;
    const interrupted = step.finishedAt === undefined && endedAt !== undefined;
    const duration = (step.finishedAt ?? endedAt ?? now) - step.startedAt;
    const { color } = getAgentMeta(step.agent);
    const label =
        step.kind === "task" && step.taskIndex !== undefined
            ? `Task ${step.taskIndex + 1}${taskCount ? ` of ${taskCount}` : ""}`
            : STEP_LABELS[step.kind];

    return (
        <div className="relative flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="relative z-10 flex flex-col items-center">
                <AgentAvatar name={step.agent} size={28} active={running} />
            </div>
            <div
                className={cn(
                    "min-w-0 flex-1 rounded-lg border bg-background p-3 transition-shadow",
                    running && "ring-2"
                )}
                style={running ? { ["--tw-ring-color" as string]: `${color}66` } : undefined}
            >
                <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-sm font-semibold text-slate-900">{step.agent}</span>
                    <span
                        className="rounded-md px-1.5 py-0.5 text-[11px] font-medium"
                        style={{ backgroundColor: `${color}17`, color }}
                    >
                        {label}
                    </span>
                    {profile && <span className="text-xs text-slate-400">{profile.model}</span>}
                    <span className="ml-auto flex items-center gap-1.5 font-mono text-xs tabular-nums text-slate-400">
                        {running && <LoaderCircle className="h-3.5 w-3.5 animate-spin" style={{ color }} />}
                        {step.startedAt > 0 && formatDuration(duration)}
                    </span>
                </div>

                {step.instructions && (
                    <div
                        className="mb-3 border-l-2 pl-3 text-sm leading-relaxed text-slate-500"
                        style={{ borderColor: `${color}55` }}
                    >
                        {step.instructions}
                    </div>
                )}

                {running ? (
                    <Working step={step} />
                ) : interrupted ? (
                    <p className="text-sm italic text-slate-400">The run ended before this step finished.</p>
                ) : step.kind === "plan" ? (
                    <PlanContent content={step.content} />
                ) : step.kind === "review" ? (
                    <ReviewContent content={step.content} />
                ) : (
                    <TaskContent content={step.content} />
                )}
            </div>
        </div>
    );
};

const RevisionBanner = ({ revision }: { revision: AgentRevision }) => (
    <div className="flex items-center gap-3 py-1 animate-in fade-in duration-500">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent to-amber-300" />
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
            <RotateCcw className="h-3.5 w-3.5" />
            Revision {revision.revision}: back to the Project Manager
        </span>
        <div className="h-px flex-1 bg-gradient-to-l from-transparent to-amber-300" />
    </div>
);

const ActivityFeed = ({
    state,
    now,
    endedAt
}: {
    state: AgentRunState;
    now: number;
    // Set once the run is over, so unfinished steps show as interrupted
    endedAt?: number;
}) => {
    type Item =
        | { kind: "step"; at: number; step: AgentStep }
        | { kind: "revision"; at: number; revision: AgentRevision };
    const items: Item[] = [
        ...state.steps.map((step) => ({ kind: "step" as const, at: step.startedAt, step })),
        ...state.revisions.map((revision) => ({
            kind: "revision" as const,
            at: revision.at,
            revision
        }))
    ].sort((a, b) => a.at - b.at);

    const profiles = new Map(state.agents.map((agent) => [agent.name, agent]));
    const taskCounts = new Map(state.plans.map((plan) => [plan.revision, plan.taskList.length]));

    return (
        <div className="relative space-y-3">
            {/* Timeline rail behind the avatars */}
            <div className="absolute bottom-4 left-[13.5px] top-4 w-px bg-gradient-to-b from-slate-200 via-slate-200 to-transparent" />
            {items.map((item) =>
                item.kind === "step" ? (
                    <StepCard
                        key={item.step.id}
                        step={item.step}
                        profile={profiles.get(item.step.agent)}
                        taskCount={taskCounts.get(item.step.revision)}
                        now={now}
                        endedAt={endedAt}
                    />
                ) : (
                    <RevisionBanner key={`revision-${item.revision.revision}`} revision={item.revision} />
                )
            )}
            {state.status === "error" && (
                <div className="relative flex gap-3 animate-in fade-in">
                    <span className="relative z-10 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
                        <TriangleAlert className="h-5 w-5" />
                    </span>
                    <div className="flex-1 rounded-lg bg-red-50 p-3 text-sm text-red-800 ring-1 ring-red-100">
                        <p className="font-semibold">The run failed</p>
                        <p className="mt-1 text-red-700">{state.error}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ActivityFeed;
