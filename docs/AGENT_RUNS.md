# Agent runs: limits and failure recovery

## Time budgets

- `/api/chat` and `/api/agents` request a **600-second** (10-minute) function duration.
- In chat, the network has **540 seconds from the beginning of the request**, not a fresh 540 seconds for each tool call. Setup and the outer model's initial planning consume part of that budget. The remaining minute is reserved for the outer model to answer with the completed work and explain unfinished work; it is not a guarantee that the final generation will finish in time.
- An individual agent step has **120 seconds**, including SDK retries and the structured-output retry. If it times out, its model call is cancelled and the failed step is handed off for recovery.
- `lib/agents/limits.ts` holds the network/step budgets. Route `maxDuration` exports are literal values because Next needs to analyze them statically. Keep the network deadline below the route duration.
- Tool progress is emitted at least every **10 seconds** during a silent model call. Heartbeats do **not** bypass a host's hard duration limit.

The route's duration is subject to the deployment's actual function/plan limits and configuration. On Vercel, a 600-second request requires Pro/Enterprise with Fluid Compute; Hobby remains capped at 300 seconds, so this code cannot enable 10-minute requests there. See [Vercel's duration limits](https://vercel.com/docs/functions/configuring-functions/duration). Local Next development does not enforce `maxDuration` like a serverless host, so the network also enforces its own deadline. This is still request-bound execution: a killed server process or lost response cannot perform recovery. Workflows that must outlive a request need durable background jobs, persisted checkpoints and a reconnect/resume endpoint.

## Token budgets

Hidden reasoning counts against each model's output budget. Current starting budgets:

| Role | Output tokens (including reasoning) |
| --- | ---: |
| Project Manager, Supervisor | 16,000 |
| Most workers | 32,000 |
| Writer | 64,000 |
| Programmer | 128,000 |
| Outer Agents-mode reply | 128,000 |

Unparseable or missing structured output is retried **once**. If the finish reason is `length`, the retry doubles the output budget, capped at the model's configured maximum. A larger token cap is headroom, not a promise to emit that many tokens; the time budget still applies. Reasoning defaults to high unless overridden (Programmer and Writer use medium).

## Recovery behavior

1. A worker error/timeout emits a `step-error` event with the actual reason.
2. The Supervisor receives the failed task and error and is asked to recommend a split or reassignment. A missing worker result cannot be approved as complete.
3. The Project Manager receives the revision report **and the pending task context**. It should split/reassign the failed task, retain remaining tasks and avoid repeating completed work.
4. The existing two-round revision budget permits the initial plan and one recovery plan. Repeated failures end as **partial**, not success. If the Supervisor itself fails, a deterministic revision report sends the work to the PM instead of discarding the worker's result.
5. User cancellation and the overall deadline are terminal: no new recovery calls are made. Provider calls are aborted, timers/listeners are cleaned up, and completed results remain in the run snapshot.
6. The outer model receives every independent task's latest successful deliverable, failures and unresolved concerns. Multiple files from the same worker are retained. A failed tool result instructs it to use that work and explain the limitation. The chat route disables `call_agents` after the first network run so the outer model cannot restart an exhausted recovery loop in the same response.

A failed Project Manager is terminal (there is no alternate lead to replan its failure). Its error is shown and any earlier successful work remains available.

## Diagnosing an interrupted run

- **`finish reason: length`**: the combined visible output and hidden reasoning exhausted the token budget. The error reports the budget. Split the task if the capped retry also fails.
- **`<agent> timed out after 120 seconds`**: a single step used its time budget. Look for a Supervisor review and a PM recovery plan in Activity.
- **`Agent run reached its time budget`**: the request's shared network deadline was reached. Completed deliverables are handed back to the outer model; unfinished tasks are not reported as successful.
- **Provider/API error**: the failed step displays the provider error; a worker failure can recover, but a request cancellation cannot.
- **Interrupted with no final result**: the client stopped receiving a still-running snapshot. This alone does not identify the cause: check browser network errors and server/deployment logs for cancellation, disconnects or a hard function timeout. A process killed by the host cannot send a final error event.

## Regression tests

Run `npm run test:agents`. The Node tests compile the real agent/network/state/stream modules with mocked provider boundaries. They exercise timeouts, recovery, cancellation, token retries, partial output preservation, heartbeats and stream cleanup without any API, database or paid model calls.
