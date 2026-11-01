# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Synapse Chat — a Next.js 16 (App Router, React 19) AI chatbot with Claude-style artifacts, tool use (web search, Wikipedia, weather, GPT Image generation, GitHub repos, etc.), a multi-agent mode, and per-user memory. Built on the Vercel AI SDK v7 (`ai`, `@ai-sdk/react`, `@ai-sdk/*` providers) with MongoDB (Mongoose 9) for persistence. Styling is Tailwind CSS 4 (`app/globals.css` imports `tailwind.config.mts` via `@config`).

## Working agreements

- Fix bugs you run into while testing, and record each change and bug fix in `docs/CHANGELOG.md` (newest first). Planned work lives in `docs/ROADMAP.md`.
- Keep model test calls minimal (the OpenAI/Anthropic keys are paid): one prompt on a cheap model (GPT-6 Luna, Claude Haiku) is usually enough.

## Commands

```bash
npm run dev     # next dev (Turbopack is the default in Next 16)
npm run build
npm run start
npm run lint    # eslint . (flat config in eslint.config.mjs; Next 16 removed `next lint`)
```

There is no test suite. Type-check with `npx tsc --noEmit`.

TypeScript is pinned to `~6.0`: TypeScript 7 drops the compiler API that Next's type-check and `typescript-eslint` need.

Environment: copy `.env.example` to `.env.local`. Keys used: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `AZURE_RESOURCE_NAME`/`AZURE_API_KEY`, `GROQ_API_KEY`, `BING_API_KEY`, `WEATHER_API_KEY`, `MONGODB_URI` (falls back to `mongodb://localhost:27017/ChatbotDB`), `GITHUB_ACCESS_TOKEN`, `NEXT_PUBLIC_URL`, `MATHGPT_MODEL`.

Path alias: `@/*` maps to the repo root.

## Architecture

### Chat request flow
1. `components/chat.tsx` uses `useChat` (`@ai-sdk/react`) with a `DefaultChatTransport`; `userId` and `settings` are sent per request via `sendMessage(..., { body })` / `regenerate({ body })`. Input state is owned by the component (useChat no longer provides it).
2. The route resolves the model (`determineModel`: `"auto"` picks `gpt61sol` (performant) vs `gpt6luna` (fast/cheap default) via `keywordCategories` in `config.ts`; `"agents"` runs the outer chat on `gpt6luna` with `DEFAULT_AGENT_SETTINGS`), selects tools (`getToolsToUse`), trims history (`lib/utils/message-manager.ts`), optionally pulls memories, builds the system prompt, and streams `streamText` through `toUIMessageStream` + `createUIMessageStreamResponse`. The system prompt is passed as `instructions` (with Anthropic cache control); AI SDK 7 rejects system messages inside `messages`.
3. Reasoning arrives as UI message `reasoning` parts; token usage and finish reason are attached as message metadata (`ChatMetadata` in `lib/types`) on the `finish` part.
4. Chats are persisted from the client via `lib/utils/save-chat.ts` → `app/api/save`; loaded via `app/api/chat/[id]` and listed via `app/api/chats`. Saves are triggered by `shouldSaveRef` + an effect on `status`, not directly in `onFinish`.
5. Persistence still uses the pre-v5 `CombinedMessage` shape (`originalContent`, legacy `toolInvocations`, `attachments`). `lib/utils/ui-messages.ts` bridges it: it derives text/reasoning/tool invocations/attachments from UI message parts, and `toUIMessage` rebuilds parts when a saved chat is loaded. Tool cards read the legacy `toolInvocations` shape.

### Models (`lib/utils/model-provider.ts`)
- `ModelKey` union + `models` record map short keys (e.g. `gpt6luna`, `claudesonnet55`) to `{ model, name, provider, maxTokens }`. Adding a model means updating both, and the README model tables.
- `getModel()` builds the provider instance and wraps it with `extractReasoningMiddleware` (`<assistantThinking>` tag). `openai(...)` uses the Responses API; Azure uses `azure.chat(...)`; Groq uses `@ai-sdk/groq`. `Custom` provider returns the Anthropic extended-thinking `reasoning` model.
- Model IDs go stale as providers retire them. Check them against each provider's `/v1/models` endpoint.
- Capability lists: `unsupportedToolUseModels`, `unsupportedArtifactUseModels`, `reasoningModels`. Models in `reasoningModels` are called without `temperature`/`topP` (chat route and agents); add new reasoning models there.

### Prompts and config (`app/api/chat/config.ts`)
Large file holding default settings (`DEFAULT_*`), all system prompt fragments (`assistantPrompt`, `artifactPrompt`, `toolsPrompt`, `safetyPrompt`, `logicPrompt`, `latexPrompt`, `agentsPrompt`), supported file formats, and prompt templates. `prompt-builder.ts` concatenates fragments based on the settings toggles plus memories and custom instructions.

### Artifacts
- The model emits `<assistantArtifact identifier type language title>…</assistantArtifact>` (format defined in `artifactPrompt`).
- `app/api/chat/artifact-middleware.ts` exports `extractArtifacts()`, which replaces each artifact with an `[ARTIFACT:<identifier>]` placeholder and handles incomplete (still-streaming) artifacts. It is used both server-side (middleware, non-streaming only) and **client-side** in `components/chat.tsx` during streaming.
- `components/artifactswindow.tsx` displays artifacts; `components/reactrenderer.tsx` executes React artifacts with `react-runner`, injecting a scope of React, Recharts, lucide/radix icons, shadcn components (`components/ui`), and mathjs. Artifact code may only use libraries present in that scope.
- Published artifacts are stored via `app/api/artifacts` and viewed at `app/artifacts/[id]`.

### Tools
- Server tool definitions live in `app/api/chat/tools.ts` (`tools` object, AI SDK `tool()` with zod 4 `inputSchema`). `generate_image` stores GPT Image output in MongoDB (`models/image.ts`) and returns a `/api/images/[id]` URL. Weather, Wikipedia and Bing tools are plain `fetch` implementations that keep the old `@agentic/*` names and result shapes (`@agentic` doesn't support AI SDK 5+).
- Each tool with custom UI is matched by `toolName` in `components/messages.tsx` and rendered by a card in `components/tools/`. A new tool generally needs: definition in `tools.ts`, rendering branch in `messages.tsx`, and optionally a card component exported from `components/tools/index.tsx`.

### Agents (`lib/agents/`)
`createAgentNetwork()` (`index.ts`, where each role's model is set: Programmer on `gpt61sol`, Writer on `gpt61terra`, the rest on `gpt6luna`) builds an `AgentNetwork` of role agents (Project Manager, Supervisor, Programmer, Debugger, Researcher, Verifier, etc.) via `AgentBuilder`, each with a zod schema in `schemas.ts` used through `generateText` + `Output.object` (with OpenAI `strictJsonSchema: false`, since the schemas have optional fields). In `"agents"` mode the chat route exposes the `call_agents` tool (`createAgentsTool` in `tools.ts`), which runs the network; results render in `components/tools/agentscard.tsx`.

### Memory (`lib/memory/`)
When `enableMemory` is on, `findRelevantMemories` embeds the last user message (`text-embedding-3-small`) and ranks stored memories by cosine similarity; `extractMemory` (fire-and-forget) uses `generateText` + `Output.object` to create/update/delete memories on the `User` document (`models/user.ts`).

### History limiting
`lib/utils/message-manager.ts` keeps the last `messageLimit` UI messages and summarizes older ones with a Groq model (`gptoss20b`) before conversion to model messages.

### GitHub repositories (`lib/github/`)
`/api/github` parses the URL and downloads one commit as a tarball into an in-memory cache (`repo.ts`). The client stores the returned `RepoConnection`, sends it as `repo` in each chat request and saves it on the chat document. The chat route then adds `repo_list_files` / `repo_read_file` / `repo_search` (`tools.ts`) and a short overview to the system prompt, pinned to the connected commit.

### Data
Mongoose models in `models/` (`chat`, `user`, `artifact`). `lib/db/index.ts` provides a cached `dbConnect()`; call it in API routes before querying. Models are cached across hot reloads, so restart the dev server after schema changes.

### Markdown rendering
Messages are rendered with Showdown plus custom extensions in `lib/showdown-extensions/` (code highlighting, KaTeX, footnotes, images, links, unclosed code blocks during streaming), sanitized with DOMPurify. Mermaid diagrams render via `components/mermaid.tsx`.
