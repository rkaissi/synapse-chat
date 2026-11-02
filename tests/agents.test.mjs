import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);

// Compile the real modules with narrowly scoped provider mocks. No API keys,
// HTTP requests, dev server or database are needed for these regressions.
const harness = (generateText = async () => { throw new Error("Unexpected model call"); }) => {
    class NoObjectGeneratedError extends Error {
        constructor(finishReason) { super("Invalid structured output"); this.finishReason = finishReason; }
        static isInstance(error) { return error instanceof NoObjectGeneratedError; }
    }
    class NoOutputGeneratedError extends Error {
        static isInstance(error) { return error instanceof NoOutputGeneratedError; }
    }
    const model = { model: "fake", name: "Fake", provider: "openai", maxTokens: 128000 };
    const mocks = {
        "ai": { generateText, NoObjectGeneratedError, NoOutputGeneratedError,
            Output: { object: (options) => options } },
        "@ai-sdk/openai": { openai: { tools: { webSearch: () => ({ type: "provider" }) } } },
        "@/lib/utils/model-provider": { getModel: (value) => value, models: { fake: model },
            reasoningModels: ["fake"], ModelProvider: { OpenAI: "openai" } }
    };
    const cache = new Map();
    const load = (path) => {
        path = resolve(root, path);
        if (cache.has(path)) return cache.get(path).exports;
        const compiled = { exports: {} };
        cache.set(path, compiled);
        const { outputText } = ts.transpileModule(readFileSync(path, "utf8"), {
            compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
                esModuleInterop: true }, fileName: path
        });
        const localRequire = (id) => {
            if (Object.hasOwn(mocks, id)) return mocks[id];
            if (id.startsWith(".")) return load(resolve(dirname(path), `${id}.ts`));
            return require(id);
        };
        new Function("require", "module", "exports", outputText)(localRequire, compiled, compiled.exports);
        return compiled.exports;
    };
    return { ...load("lib/agents/agent-builder.ts"), ...load("lib/agents/run-state.ts"),
        ...load("lib/agents/tool-stream.ts"), ...load("lib/agents/limits.ts"), model, NoObjectGeneratedError, NoOutputGeneratedError };
};
const agent = (name, execute) => ({ name, role: name, description: name, model: { name: "Fake" }, execute });
const approved = () => ({ needsRevision: false, summary: "OK" });
const task = (instructions = "Do the work") => ({ agent: "Worker", instructions });
const observedRun = async (h, network, options = {}, initialTasks) => {
    let state = h.createRunState();
    const events = [];
    const messages = await network.executePrompt("Project", "", initialTasks, {
        runTimeoutMs: 2000, stepTimeoutMs: 300, ...options,
        onEvent: (event) => { events.push(event); state = h.applyAgentEvent(state, event); }
    });
    return { state, events, messages };
};

test("successful tasks finish and do not expose hidden thinking to the outer model", async () => {
    const h = harness();
    const network = new h.AgentNetwork(agent("PM", async () => ({ taskList: [task()] })), agent("Supervisor", approved));
    network.addAgent(agent("Worker", async () => ({ output: "Done", innerThinking: "Private" })));
    const { state, events } = await observedRun(h, network);
    assert.equal(state.status, "done");
    assert.equal(events.filter((event) => event.type === "step-error").length, 0);
    assert.deepEqual(h.summarizeRunForModel(state).results[0].output, { output: "Done" });
});

test("worker failures go to Supervisor and PM with the remaining task context", async () => {
    const h = harness();
    let plans = 0, calls = 0, reviews = 0;
    const pm = agent("PM", async (prompt) => {
        plans++;
        if (plans === 2) {
            assert.match(prompt, /current_task_list/);
            assert.match(prompt, /<\/task_0>/);
            assert.match(prompt, /<\/task>/);
            assert.match(prompt, /original failing task/);
            assert.match(prompt, /remaining work/);
            assert.match(prompt, /Worker failed/);
        }
        return { taskList: plans === 1 ? [task("original failing task"), task("remaining work")]
            : [task("smaller deliverable"), task("remaining work")] };
    });
    const supervisor = agent("Supervisor", async (prompt) => {
        reviews++;
        if (reviews === 1) assert.match(prompt, /This agent failed/);
        return approved(); // Even an incorrect approval cannot accept a failure.
    });
    const network = new h.AgentNetwork(pm, supervisor);
    network.addAgent(agent("Worker", async () => {
        if (++calls === 1) throw new Error("provider failed");
        return { output: "Recovered" };
    }));
    const { state, events } = await observedRun(h, network);
    assert.equal(state.status, "done");
    assert.equal(plans, 2);
    assert.equal(calls, 3);
    assert.equal(reviews, 3);
    assert.equal(events.filter((event) => event.type === "revision").length, 1);
    assert.match(state.steps.find((step) => step.error).error, /provider failed/);
    assert.equal(h.getTaskStatuses(state, state.plans[0], false)[0], "flagged");
    assert.equal(h.summarizeRunForModel(state).results[0].output.output, "Recovered");
});

test("a hung worker is cancelled, marked failed, and recovered without accepting a late result", async () => {
    const h = harness();
    let calls = 0, plans = 0, timedOutSignal, finishLate;
    const network = new h.AgentNetwork(agent("PM", async () => {
        plans++;
        return { taskList: [task(plans === 1 ? "large task" : "small task")] };
    }), agent("Supervisor", approved));
    network.addAgent(agent("Worker", async (_prompt, _context, signal) => {
        if (++calls === 1) {
            timedOutSignal = signal;
            return new Promise((resolve) => { finishLate = resolve; });
        }
        return { output: "Recovered" };
    }));
    const { state, events } = await observedRun(h, network, { stepTimeoutMs: 20 });
    assert.equal(timedOutSignal.aborted, true);
    assert.equal(state.status, "done");
    const failed = state.steps.find((step) => step.error);
    assert.match(failed.error, /timed out/);
    finishLate({ output: "Too late" });
    await delay(1);
    assert.equal(events.some((event) => event.type === "step-finish" && event.id === failed.id), false);
});

test("Supervisor failure is sent straight to PM and preserves the completed worker result", async () => {
    const h = harness();
    let reviews = 0, plans = 0;
    const network = new h.AgentNetwork(agent("PM", async (prompt) => {
        if (++plans === 2) assert.match(prompt, /Supervisor could not review/);
        return { taskList: [task()] };
    }), agent("Supervisor", async () => {
        if (++reviews === 1) throw new Error("review service unavailable");
        return approved();
    }));
    network.addAgent(agent("Worker", async () => ({ output: "Saved result" })));
    const { state } = await observedRun(h, network);
    assert.equal(state.status, "done");
    assert.equal(plans, 2);
    assert.equal(h.summarizeRunForModel(state).results[0].output.output, "Saved result");
});

test("repeated failures exhaust the revision budget as partial, not success", async () => {
    const h = harness();
    let plans = 0;
    const network = new h.AgentNetwork(agent("PM", async () => {
        plans++;
        return { taskList: [task()] };
    }), agent("Supervisor", approved));
    network.addAgent(agent("Worker", async () => { throw new Error("Still failed"); }));
    const { state } = await observedRun(h, network);
    assert.equal(plans, 2);
    assert.equal(state.status, "partial");
    assert.equal(h.summarizeRunForModel(state).results.length, 0);
    assert.match(h.summarizeRunForModel(state).openConcerns, /Still failed/);
});

test("an empty recovery plan cannot hide the original failure", async () => {
    const h = harness();
    let plans = 0;
    const network = new h.AgentNetwork(agent("PM", async () => ({ taskList: ++plans === 1 ? [task()] : [] })), agent("Supervisor", approved));
    network.addAgent(agent("Worker", async () => { throw new Error("Failed"); }));
    const { state } = await observedRun(h, network);
    assert.equal(state.status, "partial");
});

test("user cancellation stops immediately without Supervisor or replanning", async () => {
    const h = harness();
    const controller = new AbortController();
    let reviews = 0, plans = 0;
    const network = new h.AgentNetwork(agent("PM", async () => {
        plans++;
        return { taskList: [task()] };
    }), agent("Supervisor", async () => { reviews++; return approved(); }));
    network.addAgent(agent("Worker", async () => {
        controller.abort(new Error("User stopped"));
        return new Promise(() => {});
    }));
    await assert.rejects(observedRun(h, network, { abortSignal: controller.signal }), /User stopped/);
    assert.equal(plans, 1);
    assert.equal(reviews, 0);
});

test("the total deadline returns an explicit error while retaining completed results", async () => {
    const h = harness();
    const events = [];
    let state = h.createRunState(), calls = 0;
    const network = new h.AgentNetwork(agent("PM", async () => ({ taskList: [] })), agent("Supervisor", approved));
    network.addAgent(agent("Worker", async () => ++calls === 1 ? { output: "First result" } : new Promise(() => {})));
    await assert.rejects(network.executePrompt("Project", "", [task("first"), task("second")], {
        runTimeoutMs: 30, stepTimeoutMs: 1000,
        onEvent: (event) => { events.push(event); state = h.applyAgentEvent(state, event); }
    }), /time budget/);
    assert.equal(state.status, "error");
    assert.equal(h.summarizeRunForModel(state).results[0].output.output, "First result");
    assert.equal(events.filter((event) => event.type === "revision").length, 0);
});

test("PM errors are terminal and do not produce a success event", async () => {
    const h = harness();
    const events = [];
    const network = new h.AgentNetwork(agent("PM", async () => { throw new Error("PM offline"); }), agent("Supervisor", approved));
    await assert.rejects(network.executePrompt("Project", "", undefined, { onEvent: (event) => events.push(event) }), /PM offline/);
    assert.equal(events.at(-1).type, "error");
    assert.equal(events.some((event) => event.type === "run-finish"), false);
});

test("truncated structured output retries once with a larger, capped budget", async () => {
    const calls = [];
    const h = harness(async (options) => {
        calls.push(options);
        if (calls.length === 1) throw new h.NoObjectGeneratedError("length");
        return { finishReason: "stop", output: { output: "Done" } };
    });
    const worker = new h.AgentBuilder().build({ name: "Worker", description: "Worker", role: "Work",
        model: { ...h.model, maxTokens: 24000 }, maxTokens: 16000, temperature: 0.5, schema: {} });
    await worker.execute("Prompt");
    assert.deepEqual(calls.map((call) => call.maxOutputTokens), [16000, 24000]);
    assert.equal(calls[0].reasoning, "high");
    assert.equal(calls[0].temperature, undefined);
});

test("invalid structured output retries only once and reports the token budget", async () => {
    let calls = 0;
    const h = harness(async () => { calls++; throw new h.NoObjectGeneratedError("length"); });
    const worker = new h.AgentBuilder().build({ name: "Worker", description: "Worker", role: "Work",
        model: h.model, maxTokens: 64000, temperature: 0.5, schema: {} });
    await assert.rejects(worker.execute("Prompt"), /finish reason: length; output budget: 128000 tokens/);
    assert.equal(calls, 2);
});

test("cancelled model calls are not retried", async () => {
    const controller = new AbortController();
    let calls = 0;
    const h = harness(async () => {
        calls++;
        controller.abort(new Error("Cancelled"));
        throw new h.NoOutputGeneratedError("No output");
    });
    const worker = new h.AgentBuilder().build({ name: "Worker", description: "Worker", role: "Work",
        model: h.model, maxTokens: 16000, temperature: 0.5, schema: {} });
    await assert.rejects(worker.execute("Prompt", "", controller.signal), /Cancelled/);
    assert.equal(calls, 1);
});

test("the tool sends heartbeats while a worker is silent", async () => {
    const h = harness();
    const network = new h.AgentNetwork(agent("PM", async () => ({ taskList: [task()] })), agent("Supervisor", approved));
    network.addAgent(agent("Worker", async () => { await delay(30); return { output: "Done" }; }));
    const snapshots = [];
    for await (const snapshot of h.streamAgentRun(network, "Project", "", { heartbeatMs: 5 })) snapshots.push(snapshot);
    const working = snapshots.filter((snapshot) => snapshot.run.steps.some((step) => step.agent === "Worker" && !step.finishedAt));
    assert.ok(working.length >= 2);
    assert.equal(snapshots.at(-1).run.status, "done");
});

test("tool deadlines preserve partial work and return actionable failure instructions", async () => {
    const h = harness();
    let calls = 0;
    const network = new h.AgentNetwork(agent("PM", async () => ({ taskList: [task("first"), task("second")] })), agent("Supervisor", approved));
    network.addAgent(agent("Worker", async () => ++calls === 1 ? { output: "Keep me" } : new Promise(() => {})));
    const snapshots = [];
    for await (const snapshot of h.streamAgentRun(network, "Project", "", { runTimeoutMs: 30, heartbeatMs: 5 })) snapshots.push(snapshot);
    const final = snapshots.at(-1);
    assert.equal(final.run.status, "error");
    assert.match(final.status, /Do not call the agents again/);
    assert.equal(h.summarizeRunForModel(final.run).results[0].output.output, "Keep me");
});

test("closing the tool generator aborts the background network", async () => {
    const h = harness();
    let signal;
    const network = { executePrompt: async (_project, _context, _tasks, options) => {
        signal = options.abortSignal;
        options.onEvent({ type: "run-start", prompt: "Project", agents: [], at: Date.now() });
        await new Promise((_, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true }));
    } };
    const stream = h.streamAgentRun(network, "Project", "", { heartbeatMs: 5 });
    await stream.next();
    await stream.return();
    assert.equal(signal.aborted, true);
});

test("the tool subtracts request setup time from the run budget", async () => {
    const h = harness();
    let budget;
    const network = { executePrompt: async (_project, _context, _tasks, options) => {
        budget = options.runTimeoutMs;
        return [];
    } };
    for await (const _snapshot of h.streamAgentRun(network, "Project", "", { deadlineAt: Date.now() + 100 })) { /* consume */ }
    assert.ok(budget > 0 && budget <= 100);
});


test("splitting work across the same agent keeps every independent deliverable", () => {
    const h = harness();
    const state = { ...h.createRunState(), status: "done", steps: [
        { id: "1", agent: "Worker", kind: "task", instructions: "first file", finishedAt: 1, content: { output: "old first" } },
        { id: "2", agent: "Worker", kind: "task", instructions: "second file", finishedAt: 2, content: { output: "second" } },
        { id: "3", agent: "Worker", kind: "task", instructions: "first file", finishedAt: 3, content: { output: "revised first" } }
    ] };
    const { results } = h.summarizeRunForModel(state);
    assert.equal(results.length, 2);
    assert.deepEqual(results.map((result) => result.output.output), ["second", "revised first"]);
});


test("an oversized starting token budget is clamped to the model limit", async () => {
    const calls = [];
    const h = harness(async (options) => { calls.push(options); return { finishReason: "stop", output: { output: "Done" } }; });
    const worker = new h.AgentBuilder().build({ name: "Worker", description: "Worker", role: "Work",
        model: h.model, maxTokens: 256000, temperature: 0.5, schema: {}, webSearch: true });
    await worker.execute("Prompt");
    assert.equal(calls[0].maxOutputTokens, 128000);
    assert.ok(calls[0].tools.web_search);
});

test("exhausted recovery streams a partial result rather than a success claim", async () => {
    const h = harness();
    const network = new h.AgentNetwork(agent("PM", async () => ({ taskList: [task()] })), agent("Supervisor", approved));
    network.addAgent(agent("Worker", async () => { throw new Error("Unavailable"); }));
    const snapshots = [];
    for await (const snapshot of h.streamAgentRun(network, "Project", "")) snapshots.push(snapshot);
    assert.equal(snapshots.at(-1).run.status, "partial");
    assert.match(snapshots.at(-1).status, /^Partial:/);
});


test("an expired request budget does not start any new agent calls", async () => {
    const h = harness();
    let calls = 0;
    const network = { executePrompt: async () => { calls++; return []; } };
    const snapshots = [];
    for await (const snapshot of h.streamAgentRun(network, "Project", "", { deadlineAt: Date.now() - 100 })) snapshots.push(snapshot);
    assert.equal(calls, 0);
    assert.equal(snapshots.at(-1).run.status, "error");
    assert.match(snapshots.at(-1).error, /No agents were called/);
});


test("both routes allow ten minutes and the network reserves a minute for the final reply", () => {
    const h = harness();
    for (const route of ["app/api/chat/route.ts", "app/api/agents/route.ts"]) {
        const source = readFileSync(resolve(root, route), "utf8");
        const duration = Number(source.match(/export const maxDuration\s*=\s*(\d+)/)?.[1]);
        assert.equal(duration, 600);
        assert.equal(duration * 1000 - h.AGENT_RUN_TIMEOUT_MS, 60000);
    }
    assert.equal(h.AGENT_STEP_TIMEOUT_MS, 120000);
});
