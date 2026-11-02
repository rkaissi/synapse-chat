import React from "react";
import { Check, CircleDashed, LoaderCircle, Minus, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { AgentRunState, AgentStep, getTaskStatuses, TaskStatus } from "@/lib/agents/run-state";
import { AgentAvatar } from "./activity-feed";
import { formatDuration, getAgentMeta } from "./agent-meta";

const STATUS_STYLES: Record<TaskStatus, { label: string; className: string }> = {
    pending: { label: "Queued", className: "text-slate-400" },
    working: { label: "Working", className: "text-sky-600" },
    reviewing: { label: "In review", className: "text-amber-600" },
    done: { label: "Done", className: "text-slate-500" },
    stopped: { label: "Stopped", className: "text-slate-400" },
    approved: { label: "Approved", className: "text-emerald-600" },
    flagged: { label: "Needs revision", className: "text-amber-600" },
    skipped: { label: "Skipped", className: "text-slate-400" }
};

const StatusIcon = ({ status }: { status: TaskStatus }) => {
    switch (status) {
        case "working":
        case "reviewing":
            return <LoaderCircle className="h-4 w-4 animate-spin" />;
        case "approved":
        case "done":
            return (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white">
                    <Check className="h-3 w-3" strokeWidth={3} />
                </span>
            );
        case "flagged":
            return <TriangleAlert className="h-4 w-4" />;
        case "skipped":
        case "stopped":
            return <Minus className="h-4 w-4" />;
        default:
            return <CircleDashed className="h-4 w-4" />;
    }
};

export const getPlanProgress = (state: AgentRunState, live: boolean) => {
    const plan = state.plans.at(-1);
    const statuses = plan ? getTaskStatuses(state, plan, live) : [];
    const completed = statuses.filter((status) =>
        ["approved", "done", "flagged"].includes(status)
    ).length;
    return { plan, statuses, completed, total: plan?.taskList.length ?? 0 };
};

export const PlanList = ({ state, live }: { state: AgentRunState; live: boolean }) => {
    const { plan, statuses, completed, total } = getPlanProgress(state, live);

    if (!plan) {
        return (
            <p className="text-sm text-muted-foreground">
                {live ? "The Project Manager is drafting a plan…" : "No plan was made."}
            </p>
        );
    }

    return (
        <div>
            <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Plan</span>
                {plan.revision > 0 && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                        Revision {plan.revision}
                    </span>
                )}
                <span className="ml-auto font-mono tabular-nums">
                    {completed}/{total}
                </span>
            </div>
            <div className="mb-2 h-1 overflow-hidden rounded-full bg-muted">
                <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-sky-400 transition-all duration-700"
                    style={{ width: `${total ? (completed / total) * 100 : 0}%` }}
                />
            </div>
            <ol className="ml-0 space-y-0.5">
                {plan.taskList.map((task, index) => {
                    const status = statuses[index];
                    const style = STATUS_STYLES[status];
                    const active = status === "working" || status === "reviewing";
                    return (
                        <li
                            key={index}
                            className={cn(
                                "flex gap-2 rounded-md px-1.5 py-1.5 transition-colors",
                                active && "bg-muted/60"
                            )}
                        >
                            <span className={cn("mt-0.5", style.className)}>
                                <StatusIcon status={status} />
                            </span>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                    <span
                                        className={cn(
                                            "text-sm font-medium",
                                            status === "skipped"
                                                ? "text-muted-foreground line-through"
                                                : "text-foreground"
                                        )}
                                    >
                                        {task.agent}
                                    </span>
                                    <span className={cn("ml-auto shrink-0 text-[11px] font-medium", style.className)}>
                                        {style.label}
                                    </span>
                                </div>
                                <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                                    {task.instructions}
                                </p>
                            </div>
                        </li>
                    );
                })}
            </ol>
        </div>
    );
};

export const TeamList = ({
    state,
    active,
    now
}: {
    state: AgentRunState;
    active?: AgentStep;
    now: number;
}) => {
    const assigned = new Set(state.plans.at(-1)?.taskList.map((task) => task.agent));

    return (
        <ul className="ml-0 grid grid-cols-1 gap-1 @md:grid-cols-2 @2xl:grid-cols-3">
            {state.agents.map((agent) => {
                const steps = state.steps.filter((step) => step.agent === agent.name);
                const time = steps.reduce(
                    (total, step) => total + (step.finishedAt ?? now) - step.startedAt,
                    0
                );
                const working = active?.agent === agent.name;
                const involved = agent.lead || assigned.has(agent.name) || steps.length > 0;
                return (
                    <li
                        key={agent.name}
                        className={cn(
                            "flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors",
                            working && "bg-muted/60",
                            !involved && "opacity-50"
                        )}
                    >
                        <AgentAvatar name={agent.name} size={28} active={working} />
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-medium text-foreground">
                                {agent.name}
                                {agent.model && (
                                    <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                                        {agent.model}
                                    </span>
                                )}
                            </p>
                            <p className="truncate text-[11px] text-muted-foreground">
                                {working
                                    ? "Working…"
                                    : steps.length > 0
                                      ? `${steps.length} step${steps.length === 1 ? "" : "s"}${time > 0 ? ` · ${formatDuration(time)}` : ""}`
                                      : agent.description || "Not needed"}
                            </p>
                        </div>
                    </li>
                );
            })}
        </ul>
    );
};

// Waterfall of every step on a shared time axis
export const TraceView = ({
    state,
    now,
    endedAt
}: {
    state: AgentRunState;
    now: number;
    endedAt?: number;
}) => {
    const end = endedAt ?? now;
    const total = end - state.startedAt;
    if (state.steps.length === 0 || total <= 0) {
        return (
            <p className="py-6 text-center text-sm text-muted-foreground">
                No timing data for this run.
            </p>
        );
    }
    const ticks = [0, 0.25, 0.5, 0.75, 1];

    return (
        <div className="pr-12">
            <div className="grid grid-cols-[minmax(110px,160px)_1fr] gap-x-3">
                <div />
                <div className="relative mb-2 h-4 text-[10px] tabular-nums text-muted-foreground">
                    {ticks.map((tick) => (
                        <span
                            key={tick}
                            className="absolute -translate-x-1/2 first:translate-x-0 last:-translate-x-full"
                            style={{ left: `${tick * 100}%` }}
                        >
                            {formatDuration(total * tick)}
                        </span>
                    ))}
                </div>
                {state.steps.map((step) => {
                    const { color } = getAgentMeta(step.agent);
                    const stepEnd = step.finishedAt ?? end;
                    const left = ((step.startedAt - state.startedAt) / total) * 100;
                    const width = Math.max(((stepEnd - step.startedAt) / total) * 100, 0.6);
                    const running = step.finishedAt === undefined && endedAt === undefined;
                    return (
                        <React.Fragment key={step.id}>
                            <div className="flex min-w-0 items-center gap-2 py-1">
                                <AgentAvatar name={step.agent} size={18} />
                                <span className="truncate text-xs font-medium">{step.agent}</span>
                                <span className="text-[10px] text-muted-foreground">
                                    {step.kind === "task" && step.taskIndex !== undefined
                                        ? `#${step.taskIndex + 1}`
                                        : step.kind}
                                </span>
                            </div>
                            <div className="relative flex items-center border-l">
                                {ticks.slice(1).map((tick) => (
                                    <span
                                        key={tick}
                                        className="absolute inset-y-0 w-px bg-border/60"
                                        style={{ left: `${tick * 100}%` }}
                                    />
                                ))}
                                <div
                                    className={cn(
                                        "relative h-4 shrink-0 rounded transition-all duration-300",
                                        running && "agent-stripes"
                                    )}
                                    style={{ marginLeft: `${left}%`, width: `${width}%`, backgroundColor: color }}
                                />
                                <span className="ml-1.5 whitespace-nowrap font-mono text-[10px] tabular-nums text-muted-foreground">
                                    {formatDuration(stepEnd - step.startedAt)}
                                </span>
                            </div>
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
};
