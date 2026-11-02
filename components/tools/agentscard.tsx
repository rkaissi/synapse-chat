import React, { useEffect, useState } from "react";
import {
    Activity,
    ChartGantt,
    ChevronDown,
    ListChecks,
    Users,
    Workflow
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
    AgentRunState,
    runStateFromMessages
} from "@/lib/agents/run-state";
import ActivityFeed, { AgentAvatar } from "@/components/agents/activity-feed";
import { formatDuration } from "@/components/agents/agent-meta";
import NetworkGraph from "@/components/agents/network-graph";
import {
    getPlanProgress,
    PlanList,
    TeamList,
    TraceView
} from "@/components/agents/side-panels";

interface AgentsCardProps {
    // call_agents output: { status, run?, messages?, error? }; undefined
    // until the first progress update arrives
    result?: any;
    // Whether this message is still streaming
    isStreaming: boolean;
}

type Tab = "activity" | "plan" | "team" | "trace";

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "activity", label: "Activity", icon: Activity },
    { key: "plan", label: "Plan", icon: ListChecks },
    { key: "team", label: "Team", icon: Users },
    { key: "trace", label: "Trace", icon: ChartGantt }
];

// Current time, ticking while active (for live timers)
const useNow = (active: boolean) => {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        if (!active) return;
        const timer = setInterval(() => setNow(Date.now()), 100);
        return () => clearInterval(timer);
    }, [active]);
    return now;
};

const getRun = (result: any): AgentRunState | undefined => {
    if (result?.run) return result.run;
    if (Array.isArray(result?.messages)) return runStateFromMessages(result.messages);
};

// When an interrupted run last made progress
const getLastActivity = (run: AgentRunState) =>
    Math.max(
        run.startedAt,
        ...run.steps.map((step) => step.finishedAt ?? step.startedAt)
    );

const AgentsCard = ({ result, isStreaming }: AgentsCardProps) => {
    const run = getRun(result);
    const live = isStreaming && (!run || run.status === "running");
    const stopped = !live && run?.status === "running";
    const now = useNow(live);
    const [open, setOpen] = useState<boolean | null>(null);
    const [tab, setTab] = useState<Tab>("activity");
    // Open while the agents work, collapsed once they're done
    const expanded = open ?? live;

    const endedAt = !run || live ? undefined : (run.finishedAt ?? getLastActivity(run));
    const active = live ? run?.steps.find((step) => step.finishedAt === undefined) : undefined;
    const hasTiming = !!run && run.startedAt > 0;
    const elapsed = run && hasTiming ? (endedAt ?? now) - run.startedAt : 0;
    const participants = run
        ? [...new Set(run.steps.map((step) => step.agent))]
        : [];
    const { completed, total } = run
        ? getPlanProgress(run, live)
        : { completed: 0, total: 0 };

    const subtitle = !run
        ? "Assembling the team…"
        : live
          ? active
              ? `${active.agent} is ${
                    active.kind === "plan"
                        ? "planning the work"
                        : active.kind === "review"
                          ? "reviewing a result"
                          : "working on a task"
                }…`
              : "Handing off…"
          : run.status === "error"
            ? `Failed: ${run.error ?? "unknown error"}`
            : run.status === "partial"
              ? "Partially completed - some tasks need attention"
            : stopped
              ? "Interrupted - no final result received"
              : `Completed${total ? ` · ${completed}/${total} tasks` : ""} · ${run.steps.length} steps`;

    return (
        <div className="@container overflow-hidden rounded-lg border bg-background">
            <button
                onClick={() => setOpen(!expanded)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/40"
            >
                <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-sky-500 text-white">
                    <Workflow className="h-4 w-4" />
                    {live && (
                        <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-sky-400 animate-pulse" />
                    )}
                </span>
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">Agent team</p>
                    <p
                        className={cn(
                            "truncate text-xs",
                            live
                                ? "agent-shimmer text-muted-foreground"
                                : run?.status === "error"
                                  ? "text-red-600"
                                  : "text-muted-foreground"
                        )}
                    >
                        {subtitle}
                    </p>
                </div>
                {!expanded && participants.length > 0 && (
                    <div className="hidden -space-x-1.5 @md:flex">
                        {participants.slice(0, 6).map((name) => (
                            <span key={name} className="rounded-xl ring-2 ring-background">
                                <AgentAvatar name={name} size={22} />
                            </span>
                        ))}
                    </div>
                )}
                {hasTiming && (
                    <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                        {formatDuration(elapsed)}
                    </span>
                )}
                <ChevronDown
                    className={cn(
                        "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                        expanded && "rotate-180"
                    )}
                />
            </button>

            {expanded && (
                <div className="space-y-3 border-t px-3 pb-3 pt-3 animate-in fade-in duration-300">
                    {run && run.agents.length > 0 && <NetworkGraph state={run} active={active} />}

                    {run && (
                        <>
                            <div className="flex items-center gap-1 overflow-x-auto rounded-md bg-muted p-1 text-sm">
                                {TABS.map(({ key, label, icon: Icon }) => (
                                    <button
                                        key={key}
                                        onClick={() => setTab(key)}
                                        className={cn(
                                            "inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-sm px-2.5 py-1 text-xs font-medium transition",
                                            tab === key
                                                ? "bg-background text-foreground shadow-sm"
                                                : "text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        <Icon className="h-3.5 w-3.5" />
                                        {label}
                                        {key === "plan" && total > 0 && (
                                            <span className="font-mono text-[10px] tabular-nums opacity-70">
                                                {completed}/{total}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>

                            {run.status === "partial" && run.error && (
                                <p className="text-sm text-amber-700">{run.error}</p>
                            )}
                            {tab === "activity" &&
                                (run.steps.length > 0 || run.status === "error" ? (
                                    <ActivityFeed state={run} now={now} endedAt={endedAt} />
                                ) : (
                                    <p className="text-sm text-muted-foreground">Starting…</p>
                                ))}
                            {tab === "plan" && <PlanList state={run} live={live} />}
                            {tab === "team" && <TeamList state={run} active={active} now={now} />}
                            {tab === "trace" && <TraceView state={run} now={now} endedAt={endedAt} />}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default AgentsCard;
