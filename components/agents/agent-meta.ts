import {
    BadgeCheck,
    Bot,
    Bug,
    ClipboardList,
    CodeXml,
    LucideIcon,
    MessageCircleQuestionMark,
    PenLine,
    Puzzle,
    ScrollText,
    ShieldCheck,
    Sigma,
    SpellCheck,
    Swords,
    Telescope
} from "lucide-react";
import { AgentStepKind } from "@/lib/agents/events";

export interface AgentMeta {
    icon: LucideIcon;
    // Hex so it works in inline styles and SVG
    color: string;
}

const AGENT_META: Record<string, AgentMeta> = {
    "Project Manager": { icon: ClipboardList, color: "#6366f1" },
    Supervisor: { icon: ShieldCheck, color: "#f59e0b" },
    Programmer: { icon: CodeXml, color: "#0ea5e9" },
    Debugger: { icon: Bug, color: "#ef4444" },
    Writer: { icon: PenLine, color: "#ec4899" },
    Editor: { icon: SpellCheck, color: "#a855f7" },
    Summarizer: { icon: ScrollText, color: "#14b8a6" },
    Mathematician: { icon: Sigma, color: "#3b82f6" },
    Researcher: { icon: Telescope, color: "#84cc16" },
    Verifier: { icon: BadgeCheck, color: "#10b981" },
    Debater: { icon: Swords, color: "#f97316" },
    Inquisitor: { icon: MessageCircleQuestionMark, color: "#d946ef" },
    Logician: { icon: Puzzle, color: "#8b5cf6" }
};

export const getAgentMeta = (name: string): AgentMeta =>
    AGENT_META[name] ?? { icon: Bot, color: "#64748b" };

export const STEP_LABELS: Record<AgentStepKind, string> = {
    plan: "Planning",
    task: "Task",
    review: "Review"
};

export const formatDuration = (ms: number) => {
    const seconds = Math.max(0, ms) / 1000;
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${Math.floor(seconds % 60)}s`;
};
