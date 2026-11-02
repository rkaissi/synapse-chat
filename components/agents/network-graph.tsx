import React from "react";
import { AgentProfile } from "@/lib/agents/events";
import { AgentRunState, AgentStep } from "@/lib/agents/run-state";
import { getAgentMeta } from "./agent-meta";

const WIDTH = 520;
const HEIGHT = 300;
const CENTER = { x: WIDTH / 2, y: HEIGHT / 2 };
const NODE_RADIUS = 19;

interface Point {
    x: number;
    y: number;
}

// Leads sit at the top (Project Manager) and bottom (Supervisor); workers
// fan out on two arcs between them
const layout = (agents: AgentProfile[]) => {
    const positions: Record<string, Point> = {};
    const [manager, supervisor] = agents.filter((agent) => agent.lead);
    if (manager) positions[manager.name] = { x: CENTER.x, y: 34 };
    if (supervisor) positions[supervisor.name] = { x: CENTER.x, y: HEIGHT - 50 };

    const workers = agents.filter((agent) => !agent.lead);
    const right = Math.ceil(workers.length / 2);
    workers.forEach((agent, index) => {
        const onRight = index < right;
        const count = onRight ? right : workers.length - right;
        const slot = onRight ? index : index - right;
        const t = count === 1 ? 0.5 : slot / (count - 1);
        const angle = ((-64 + t * 128) * Math.PI) / 180;
        positions[agent.name] = {
            x: CENTER.x + Math.cos(angle) * 200 * (onRight ? 1 : -1),
            y: CENTER.y - 8 + Math.sin(angle) * 100
        };
    });
    return positions;
};

interface Edge {
    from: string;
    to: string;
}

// The edge that carries work right now: delegation for tasks, hand-off to
// the Supervisor for reviews
const getActiveEdge = (
    state: AgentRunState,
    active: AgentStep | undefined,
    manager?: string,
    supervisor?: string
): Edge | undefined => {
    if (!active || !manager || !supervisor) return;
    if (active.kind === "task") return { from: manager, to: active.agent };
    if (active.kind === "review") {
        const task = state.steps.find(
            (step) =>
                step.kind === "task" &&
                step.revision === active.revision &&
                step.taskIndex === active.taskIndex
        );
        if (task) return { from: task.agent, to: supervisor };
    }
};

const NetworkGraph = ({
    state,
    active
}: {
    state: AgentRunState;
    // The step in progress (only while the run is live)
    active?: AgentStep;
}) => {
    const { agents } = state;
    const positions = layout(agents);
    const [manager, supervisor] = agents
        .filter((agent) => agent.lead)
        .map((agent) => agent.name);

    const activeEdge = getActiveEdge(state, active, manager, supervisor);
    const assigned = new Set(state.plans.at(-1)?.taskList.map((task) => task.agent));
    const finished = new Set(
        state.steps.filter((step) => step.finishedAt !== undefined).map((step) => step.agent)
    );
    const workers = agents.filter((agent) => !agent.lead);

    return (
        <div
            className="relative overflow-hidden rounded-lg border bg-muted/30"
            style={{
                backgroundImage:
                    "radial-gradient(hsl(var(--border)) 1px, transparent 1px)",
                backgroundSize: "16px 16px"
            }}
        >
            <svg
                viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                className="relative h-auto w-full"
                role="img"
                aria-label="Agent network"
            >
                {/* Wiring: Project Manager → worker → Supervisor */}
                {manager &&
                    supervisor &&
                    workers.map((worker) => {
                        const p = positions[worker.name];
                        const lit = assigned.has(worker.name) || finished.has(worker.name);
                        return (
                            <g
                                key={worker.name}
                                stroke="#94a3b8"
                                strokeOpacity={lit ? 0.45 : 0.15}
                                strokeWidth={1}
                            >
                                <line
                                    x1={positions[manager].x}
                                    y1={positions[manager].y}
                                    x2={p.x}
                                    y2={p.y}
                                />
                                <line
                                    x1={p.x}
                                    y1={p.y}
                                    x2={positions[supervisor].x}
                                    y2={positions[supervisor].y}
                                />
                            </g>
                        );
                    })}

                {active && activeEdge && positions[activeEdge.from] && positions[activeEdge.to] && (
                    <ActiveEdge
                        key={active.id}
                        from={positions[activeEdge.from]}
                        to={positions[activeEdge.to]}
                        color={getAgentMeta(active.agent).color}
                    />
                )}

                {agents.map((agent) => {
                    const p = positions[agent.name];
                    if (!p) return null;
                    const { icon: Icon, color } = getAgentMeta(agent.name);
                    const working = active?.agent === agent.name;
                    const involved =
                        agent.lead || assigned.has(agent.name) || finished.has(agent.name);
                    const done = !working && finished.has(agent.name);
                    const radius = agent.lead ? NODE_RADIUS + 3 : NODE_RADIUS;

                    return (
                        <g
                            key={agent.name}
                            transform={`translate(${p.x} ${p.y})`}
                            opacity={involved ? 1 : 0.35}
                            className="transition-opacity duration-500"
                        >
                            <title>
                                {agent.model ? `${agent.name} · ${agent.model}` : agent.name}
                            </title>
                            {working && (
                                <>
                                    <circle r={radius} fill={color} opacity={0.3}>
                                        <animate
                                            attributeName="r"
                                            values={`${radius};${radius + 14};${radius}`}
                                            dur="1.8s"
                                            repeatCount="indefinite"
                                        />
                                        <animate
                                            attributeName="opacity"
                                            values="0.35;0;0.35"
                                            dur="1.8s"
                                            repeatCount="indefinite"
                                        />
                                    </circle>
                                    <circle
                                        r={radius + 5}
                                        fill="none"
                                        stroke={color}
                                        strokeWidth={1.75}
                                        strokeDasharray="5 5"
                                    >
                                        <animateTransform
                                            attributeName="transform"
                                            type="rotate"
                                            from="0"
                                            to="360"
                                            dur="4s"
                                            repeatCount="indefinite"
                                        />
                                    </circle>
                                </>
                            )}
                            <circle
                                r={radius}
                                fill={working ? color : "white"}
                                stroke={color}
                                strokeWidth={working ? 0 : 1.5}
                            />
                            <Icon
                                x={-radius / 2 - 1}
                                y={-radius / 2 - 1}
                                width={radius + 2}
                                height={radius + 2}
                                color={working ? "white" : color}
                                strokeWidth={2}
                            />
                            {done && (
                                <g transform={`translate(${radius * 0.72} ${-radius * 0.72})`}>
                                    <circle r={6.5} fill="#10b981" stroke="white" strokeWidth={2} />
                                    <path
                                        d="M-2.6 0.2 L-0.6 2.2 L2.8 -1.8"
                                        fill="none"
                                        stroke="white"
                                        strokeWidth={1.6}
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </g>
                            )}
                            <text
                                y={radius + 15}
                                textAnchor="middle"
                                fontSize={12}
                                fontWeight={working ? 600 : 500}
                                fill={working ? "#0f172a" : "#475569"}
                            >
                                {agent.name}
                            </text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
};

const ActiveEdge = ({ from, to, color }: { from: Point; to: Point; color: string }) => {
    const path = `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
    return (
        <g>
            <path d={path} stroke={color} strokeOpacity={0.18} strokeWidth={6} strokeLinecap="round" />
            <path
                d={path}
                stroke={color}
                strokeWidth={2}
                strokeDasharray="5 7"
                strokeLinecap="round"
                className="agent-flow"
            />
            {[0, 0.6].map((begin) => (
                <circle key={begin} r={3.5} fill={color}>
                    <animateMotion dur="1.2s" begin={`${begin}s`} repeatCount="indefinite" path={path} />
                </circle>
            ))}
        </g>
    );
};

export default NetworkGraph;
