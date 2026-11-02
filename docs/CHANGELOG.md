# Changelog

Notable changes, including bugs found and fixed while testing. Newest first.

## 2026-11-01 — Artifact isolation, chat scrolling, compact repo control

- **An HTML artifact restyled the whole app** (a green border and changed margins after an agents run built a Snake game). Two causes, both fixed without removing anything from the artifact:
  - The Debugger agent returned the whole page as plain text, and messages/agent results were rendered as HTML, so the page's `<style>` applied to the app. HTML documents and `<style>` blocks outside code blocks are now shown as code (`fenceRawHtml` in `lib/utils/markdown-to-html.ts`, also while streaming). The live version is in the artifact preview.
  - The HTML preview iframe allowed `allow-scripts` together with `allow-same-origin`, which lets artifact scripts reach the app through `window.parent`. It now runs without `allow-same-origin` (an opaque origin, as on claude.ai), and console output is forwarded by a script placed inside the artifact (`lib/utils/capture-logs.ts`). Artifacts render exactly as before; they just can't touch the app. One side effect: an artifact's `localStorage` is unavailable, so e.g. a game's best score isn't kept.
- **The console capture leaked listeners**: its cleanup was never called and the effect re-ran on every new log line, so each log added another listener.
- **The chat was locked to the bottom while anything streamed.** It now follows new output only while you're at the bottom: scrolling up stops following, scrolling back to the bottom or sending a message resumes it, and a streaming artifact never moves the chat.
- **The GitHub connect bar is now a button in the message box.** It opens a small popover to connect; once connected it shows the repository as a chip (details and Disconnect in the popover). The full-width bar above the chat is gone.
- **`NEXT_PUBLIC_ENABLE_EXPENSIVE_MODELS`**: GPT-6 Astra, GPT-6.1 Sol, Claude Fable 5.1, Claude Opus 5.5 and Reasoning are only offered when it is `true`. Leave it unset on a public deployment: the picker hides them, the chat route rejects them (403), saved preferences fall back to the default, and Auto's heavy path uses GPT-6.1 Terra instead of Sol.

## 2026-11-01 — Reasoning level, persistent settings, agent fixes

### Agents

- **Large results failed with "No object generated: could not parse the response"** (e.g. "create a tetris artifact"). Agents had a 4,096-token output limit, and for reasoning models (GPT-6) the hidden reasoning counts against it, so the Programmer's JSON was cut off mid-code. The SDK throws that error from `generateText` itself, which the retry didn't catch. Budgets are now 16k per agent (Writer 32k, Programmer 64k), a cut-off or unparseable response is retried once, with double the budget when it ran out, and errors name the agent. Re-tested with the same prompt: the run completed (including a revision round) and produced a Tetris artifact that renders in the artifacts panel.
- **The chat model only gets the agents' deliverables**: each agent's latest result without its thinking, plus the Supervisor's open concerns if a revision was still requested (`summarizeRunForModel`). Plans, reviews and thinking stay in the agent card. This matches how other frameworks hand subagent results back: Claude Code and Codex subagents return only their final message, OpenAI Agents SDK agents-as-tools return their final output, and LangGraph's supervisor defaults to the last message. On failure the model also gets the error.
- **Artifacts work in agents mode** (the artifact prompt is included and the settings menu is no longer disabled for Agents).
- The Programmer now runs on GPT-6.1 Terra (was Sol), like the Writer.
- Reasoning effort: Luna roles run on high, the Programmer and Writer (Terra) on medium.

### Settings

- **Reasoning level** (minimal, low, medium, high, extra high; default medium) in the settings menu and as a compact picker in the message box. It is passed as the AI SDK's `reasoning` option to reasoning models (GPT-6, GPT-OSS, Qwen; the custom Reasoning model keeps its own thinking budget).
- **Settings persist** across new chats and reloads (localStorage, `lib/hooks/use-preferences.ts`). Only changed settings are stored, so new defaults still apply to everything else.
- **Artifacts are on by default.** Default max output is 32,000 tokens (was 4,096) and agents mode's chat model also gets 32,000; requests are capped at the model's own limit.
- Removed MathGPT and Azure GPT-4o (and the `@ai-sdk/azure` dependency).

### Bugs fixed

- **The sidebar reopened on every new chat and reload**: its state lived in the chat component, which remounts for each chat. It is now a persisted preference on desktop; on small screens, where the sidebar covers the chat, it starts closed.
- **"Maximum update depth exceeded" while long replies streamed**: every streamed chunk re-ran message processing, which sets state again; a fast burst of chunks (long code) exceeded React's nested update limit. Updates are now throttled to every 50 ms. The message box's resize effect also re-ran on every streamed chunk (it depended on a handler recreated each render).
- The settings menu clamped Max Tokens to 4,096 whenever Auto or Agents was selected (they have no limit of their own), and its tool choice dropdown ignored the saved value.

## 2026-11-01 — Agents mode overhaul

Choosing **Agents** in the model dropdown now shows the team working live inside the chat, instead of a list of raw messages that appeared only after every agent had finished.

- **Agent team card**, above the reply: while the agents work it stays open and shows who is doing what ("Logician is working on a task…") with a live timer; once they finish it collapses to a summary (tasks completed, steps, time, the agents involved) and the answer streams in below. Click to reopen.
- **Network graph**: the Project Manager at the top, the Supervisor at the bottom, specialists in between. The active agent pulses and the current hand-off (delegation or review) animates along its edge; agents outside the plan fade out, finished ones get a check.
- Tabs:
  - **Activity**: a timeline of every step with the agent, its model, duration, assignment, a collapsible thought process and the result. Code, bug lists, fact-check issues and the Supervisor's verdict (approved / revision requested) each get their own presentation instead of raw JSON, and revision rounds are marked.
  - **Plan**: the task list with per-task status (queued, working, in review, approved, needs revision) and progress.
  - **Team**: every agent with its model, what it did and for how long.
  - **Trace**: a waterfall of every step on a shared time axis.
- Chats saved before this change render in the same card (without timings).

How it works: `AgentNetwork.executePrompt` takes an `onEvent` callback and an abort signal (`lib/agents/events.ts`). `call_agents` is now a streaming tool: it folds events into a run snapshot (`lib/agents/run-state.ts`) and yields it after each event, which the AI SDK delivers to the chat as preliminary tool results. The model itself only receives a summary (`toModelOutput`, see the entry above). Stopping the chat aborts the in-flight agent call.

An `/agents` page was briefly built for this and then dropped in favor of the chat.

Bugs found and fixed while testing:

- **The plan disappeared from progress updates**: the network handed out its live task list, which it empties as tasks complete.

- **Prices rendered as LaTeX everywhere** (chat messages included): any two `$` signs in a message became inline math, so "the ball costs $0.05 and the bat $1.05" turned into a garbled formula. Inline `$…$` math now follows Pandoc's rule (no space after the opening `$`, none before the closing `$`, no digit right after it). The same regex also excluded the letter "D" from math, so `$D = 5$` never rendered.
- The Tailwind config replaces the default palette and had no `slate`, `red-50` or `indigo-50`; they were added (existing colors are unchanged).

## 2026-11-01 — Agent models

- The two roles that used Claude Opus 5.5 now use OpenAI models: **Programmer → GPT-6.1 Sol** (near-Astra quality for complex work) and **Writer → GPT-6.1 Terra** (fast, clear natural writing). All other roles stay on GPT-6 Luna. Each was tested with one agent call and returned a valid structured result.

## 2026-11-01 — Tool check and image generation

Every chat tool was run directly against its API:

| Tool | Status |
|---|---|
| `get_current_time`, `execute_javascript`, `get_current_weather`, `wikipedia_get_page_summary` | Working |
| `wikipedia_search` | **Fixed**: Wikimedia rate-limited requests (HTTP 429) without a descriptive `User-Agent` header |
| `get_youtube_video_transcript` | **Fixed**: `youtube-transcript` now returns offsets in milliseconds, so a timestamp at 1.2s showed as "20:00" |
| `generate_image` (was `generate_dalle_image`) | **Updated** to GPT Image 2.5 Flare, see below |
| `bing_web_search` | **Broken**: the Bing Search API was retired (HTTP 401). Needs a replacement provider, see the [roadmap](./ROADMAP.md) |

Image generation:

- Uses `gpt-image-2.5-flare` (OpenAI's fast everyday image model) through the AI SDK's `generateImage`, with `quality` (low/medium/high) and `size` (square, landscape, portrait).
- GPT Image returns image data instead of a URL. Images are stored in MongoDB (`models/image.ts`) and served from `/api/images/[id]`; the model gets that short URL, so base64 never enters the chat history or saved chats. Images are WebP at 80% quality.
- **Bug fixed while testing**: the image route returned empty responses because lean MongoDB documents hold binary data as BSON `Binary`, not a Node `Buffer`.
- The direct `openai` SDK dependency was removed (DALL·E was its only use).
- Removed `readUrl` from the settings menu's "force a tool" list; that tool is disabled on the server, so forcing it failed.

Agents: re-ran the prompt that failed before ("Help me plan a 7-day trip to Japan…"); it now completes (Writer → Verifier → Editor, each reviewed by the Supervisor).

## 2026-11-01 — Agents mode fixed

- **Agents mode failed with "No output generated".** An agent's response sometimes didn't contain a usable structured object, and the AI SDK's `result.output` throws in that case, which failed the whole network. The Programmer and Writer roles ran on Claude Opus 5.5 and the Programmer runs first, making it the likely trigger (not re-run on Opus, to avoid the cost).
- All agent roles now use **GPT-6 Luna**. A full run (Project Manager → Programmer → Supervisor → Debugger → Supervisor) completes in the app with no errors or warnings.
- An agent that returns no usable output is retried once, and errors now name the agent and finish reason instead of the generic SDK message.
- Agents no longer send `temperature` to reasoning models.
- The Supervisor's `updatedContext` schema no longer uses `z.record`, which produced a `propertyNames` constraint OpenAI can't enforce (logged as a warning on every call).

## 2026-11-01 — Database connection and warnings

- **A failed MongoDB connection was cached forever.** `dbConnect` swallowed the error and cached the failed attempt, so the app never retried. Every query then waited 10 seconds and failed with "buffering timed out" (for example, when the dev server started while a paused Atlas cluster was still waking up). It now logs the real error and retries on the next request.
- Replaced Mongoose's deprecated `new: true` option with `returnDocument: "after"`.
- Reasoning models no longer receive `topP` (they ignore it and the AI SDK logged a warning on every request), matching how `temperature` is handled.

## 2026-11-01 — Clean `npm install`

- **ESLint 10 → 9.** `eslint-config-next` 16 depends on plugins (react, import, jsx-a11y) that only support ESLint up to 9, so installs printed peer-dependency conflicts. ESLint 9 is now pinned.
- **`react-runner` peer warning.** Its last release declares React ≤ 18 but works with React 19 (verified with React artifacts). An npm `overrides` entry makes it use the project's React.
- **Security advisories: 25 → 19, no high-severity ones left.** Patched versions of minimatch, glob, picomatch, brace-expansion, underscore, uuid and @xmldom/xmldom were applied, and `postcss-selector-parser` is overridden to 6.1.x.
  - The remaining moderates are in dev-only ESLint/sucrase tooling (fixes need majors those tools don't support yet) and `showdown`, which has no patched release (its output is sanitized with DOMPurify).
  - Don't run `npm audit fix --force`: its suggestions are downgrades (ESLint 4, `eslint-config-next` 12) that break the project.

## 2026-11-01 — Chat loading fixes and GitHub repo connection

### GitHub repository connection (reworked)

Connecting a repo now works like a coding agent's local checkout (Claude Code / Codex style) instead of pasting the repository into the conversation.

- On connect, `/api/github` downloads the repo **once** as a tarball for a single commit and keeps it in memory (`lib/github/repo.ts`, cached per commit, up to 5 repos).
- The model gets three tools (`lib/github/tools.ts`): `repo_list_files`, `repo_read_file` (numbered lines, paged) and `repo_search` (grep with optional regex and path glob). The system prompt only carries a short overview: top-level entries and a README excerpt.
- Accepts `https://github.com/owner/repo`, `.git` URLs, `.../tree/<branch>`, `git@github.com:owner/repo.git` and `owner/repo`. Private repos work when `GITHUB_ACCESS_TOKEN` has access; the token is now optional for public repos.
- The connection is shown as a chip (repo · branch · commit · file count, with disconnect), sent with each request, saved with the chat (`repo` field on the chat document) and restored when the chat is reopened. Requests stay pinned to the connected commit.
- `@octokit/rest` was removed; the GitHub REST API is called with `fetch`.

Bugs fixed in the old implementation:

- Fetched every file with a separate API request, making connects slow and exhausting rate limits on larger repos.
- Fetched the repository twice per connect (selector and chat each called the API).
- Pasted the repo into a user message with `formattedContent.slice(1000)`, which dropped the first 1,000 characters and kept everything else, overflowing the context window on real repos.
- Threw at import time when `GITHUB_ACCESS_TOKEN` was unset, breaking the route.

### Chat loading

- **Loaded messages were reprocessed with the current settings.** Opening a saved chat re-ran its last message through artifact extraction with the current toggles (artifacts are off by default), so artifacts rendered as raw HTML inside the message, and saved reasoning and token counts were wiped. The damaged message was then written back on the next save. Restored messages are no longer reprocessed, and streamed updates keep earlier usage/reasoning values.
- **Sidebar and "new chat" navigation used `redirect()` in click handlers**, which Next.js does not support outside render. They now use the router.
- **"New chat" did not start a new chat after chatting on the home page.** The URL changed back to `/` but the old conversation and chat id stayed, so the next message was appended to the previous chat. The home page now remounts with a fresh id (`lib/utils/new-chat.ts`).
- **The home page created a new chat id on every render.** It is now created once.
- **A database error while building the chat page title crashed the page.** `generateMetadata` now falls back to "Chat".
- The chat page is keyed by chat id, so switching chats never reuses the previous chat's state.

### Other fixes

- **Tool calls crashed the message view while their input was streaming.** AI SDK 7 leaves a tool's input undefined until it finishes streaming; the tool chip formatter called `Object.entries(undefined)`.
- Removed the empty `app/preview/agents/page.tsx`, which broke `next build`. The intended agents preview page is tracked in the [roadmap](./ROADMAP.md).

### Development notes

- Mongoose models are cached across hot reloads (`mongoose.models.X || mongoose.model(...)`), so schema changes need a dev server restart; until then, new fields are silently dropped on save.

## 2026-11-01 — Model lineup refresh

- Replaced retired models with the newest of each family: GPT-6 Astra, GPT-6.1 Sol, GPT-6.1 Terra, GPT-6 Luna; Claude Opus 5.5, Sonnet 5.5, Haiku 5.5, Fable 5.1; Groq GPT-OSS 120B, GPT-OSS 20B and Qwen 3.8 27B (via `@ai-sdk/groq`).
- GPT-6 Luna is the default and handles internal calls (Auto's light path, agents, memory); GPT-6.1 Sol is Auto's heavy path; Claude Opus 5.5 powers the performant agent roles and the extended-thinking "Reasoning" model.
- Reasoning models are called without a temperature.
- **Chat history summarization was broken**: it used Groq's `llama-3.1-8b-instant`, which no longer exists, so chats longer than ~9 messages failed. It now uses GPT-OSS 20B.

## 2026-11-01 — Dependency upgrade and AI SDK 7 migration

- AI SDK 4 → 7: UI message streams, `useChat` with `DefaultChatTransport`, system prompt via `instructions`, `generateText` + `Output.object` instead of `generateObject`, usage and finish reason as message metadata. Saved chats keep their format; `lib/utils/ui-messages.ts` converts between the two, so no data migration is needed.
- Next 15 → 16, React 19.3, Tailwind 3 → 4 (`tw-animate-css` replaces `tailwindcss-animate`), zod 4, Mongoose 9, ESLint with a flat config (`next lint` was removed), TypeScript 6.0 (TypeScript 7 lacks the compiler API that Next and typescript-eslint need), recharts 3, lucide-react 1.x, openai 7.
- `@agentic/*` tools were replaced by `fetch`-based weather, Wikipedia and Bing tools with the same names and result shapes (`@agentic` does not support AI SDK 5+).
- Fixed the new React Compiler lint errors.

Bugs found and fixed while testing:

- **Assistant replies were not saved** after streaming finished (only the user message was). Saving now happens once the chat status settles.
- **The chat history query failed on fresh databases**: it hinted an index the schema never declared. The index is now declared and the hint removed.
- The build failed on a missing `GithubIcon` (brand icons were removed from lucide-react 1.x); replaced with Radix's GitHub icon.
