import type { AgentNetwork } from "./agent-builder";
import { AGENT_HEARTBEAT_MS, AGENT_RUN_TIMEOUT_MS } from "./limits";
import { applyAgentEvent, createRunState } from "./run-state";

interface StreamOptions {
    abortSignal?: AbortSignal;
    deadlineAt?: number;
    runTimeoutMs?: number;
    stepTimeoutMs?: number;
    heartbeatMs?: number;
}

// Kept separate from the tool definition so cancellation, heartbeats and
// failure handoff can be tested without making a paid model request.
export async function* streamAgentRun(
    network: Pick<AgentNetwork, "executePrompt">,
    project: string,
    context: string,
    { abortSignal, deadlineAt, runTimeoutMs = AGENT_RUN_TIMEOUT_MS,
        stepTimeoutMs, heartbeatMs = AGENT_HEARTBEAT_MS }: StreamOptions = {}
) {
    abortSignal?.throwIfAborted();
    let run = createRunState();
    const remainingMs = Math.min(runTimeoutMs,
        deadlineAt === undefined ? runTimeoutMs : deadlineAt - Date.now());
    if (remainingMs <= 0) {
        const message = "Agent time budget was exhausted before the network could start. No agents were called.";
        run = applyAgentEvent(run, { type: "error", message, at: Date.now() });
        yield { status: "Incomplete: answer the user directly without calling the agents again in this response.",
            error: message, run };
        return;
    }
    let changed = false;
    let wake: (() => void) | undefined;
    let outcome: { messages?: any[]; error?: unknown } | undefined;
    const controller = new AbortController();
    const signal = abortSignal
        ? AbortSignal.any([abortSignal, controller.signal])
        : controller.signal;
    const notify = () => { changed = true; wake?.(); };
    // Send progress even while generateText is silent. This does not extend
    // the platform's hard execution limit or the network's own deadline.
    const heartbeat = setInterval(notify, heartbeatMs);
    const execution = Promise.resolve().then(() => network.executePrompt(
        project, context, undefined, {
            abortSignal: signal,
            runTimeoutMs: remainingMs,
            stepTimeoutMs,
            onEvent: (event) => { run = applyAgentEvent(run, event); notify(); }
        }
    ));
    execution.then(
        (messages) => { outcome = { messages }; },
        (error) => { outcome = { error }; }
    ).finally(() => wake?.());

    try {
        while (!outcome) {
            if (!changed) await new Promise<void>((resolve) => { wake = resolve; });
            wake = undefined;
            if (changed) {
                changed = false;
                yield { status: "Running", run, heartbeatAt: Date.now() };
            }
        }
        signal.throwIfAborted();
        if (outcome.error !== undefined) {
            const message = outcome.error instanceof Error
                ? outcome.error.message : String(outcome.error);
            run = applyAgentEvent(run, { type: "error", message, at: Date.now() });
            yield { status: "Incomplete: use the completed agent results to answer the user. Explain what failed and what remains. Do not call the agents again in this response.",
                error: message, run };
            return;
        }
        yield {
            status: run.status === "partial"
                ? "Partial: some tasks could not be completed after recovery. Use the completed results, explain the remaining issues, and do not call the agents again in this response."
                : "Success: Tasks completed successfully!",
            messages: outcome.messages, run
        };
    } finally {
        clearInterval(heartbeat);
        // Returning/closing the generator must cancel the in-flight network,
        // rather than leaving paid model calls running after the UI stops.
        controller.abort(new Error("Agent tool stream closed"));
        wake?.();
    }
}
