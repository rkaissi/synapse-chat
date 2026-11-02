// Keep 60 seconds of the 300-second chat route for the outer model's reply.
// The tool subtracts planning/setup time before starting the network.
export const AGENT_RUN_TIMEOUT_MS = 240_000;
export const AGENT_STEP_TIMEOUT_MS = 120_000;
export const AGENT_HEARTBEAT_MS = 10_000;
