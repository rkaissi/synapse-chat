# Changelog

Notable changes, including bugs found and fixed while testing. Newest first.

## 2026-11-02 — Hobby-compatible requests and 2.5-minute steps

- Fixed the PR preview's `invalid_max_duration` deployment failure: the current Vercel Hobby project permits at most 300 seconds, so both chat/agents routes now request **300 seconds** (five minutes), rather than 600. No hosting plan change is needed.
- Reduced the shared network budget to **240 seconds** from request start, retaining a minute for the outer reply, and set each agent step to **150 seconds** (2.5 minutes), including retries. The shared deadline still takes precedence; recovery only runs while network time remains.
- Updated both instruction files, the run-limit guide and the regression assertions to match the deployable limits.

## 2026-11-02 — Five-minute individual agent steps

- Raised the per-step timeout from 120 to **300 seconds** (five minutes), including retries. The request limit remains 600 seconds and the shared network budget remains 540 seconds; the overall deadline takes precedence if a step starts with less than five minutes remaining. Recovery still runs for a failed worker when time remains, but a slow step leaves less time for reviews and replanning.
- Updated both instruction files, the agent-run guide and the regression check for the five-minute step limit and unchanged final-reply reserve.

## 2026-11-02 — Ten-minute agent request limit

- Raised both chat/agents route duration limits from 300 to **600 seconds**. The shared network budget increases from 240 to **540 seconds** from request start, still reserving a minute for the final chat reply. Per-step timeouts remain 120 seconds, so a stuck worker can still trigger recovery rather than consuming the entire request.
- Updated the agent guidance and run-limit docs, including the Vercel deployment caveat: Pro/Enterprise with Fluid Compute support 600 seconds; Hobby's 300-second cap with Fluid Compute cannot be overridden in code. Added a regression check to keep route durations and the network's reply reserve aligned.

## 2026-11-02 — Agent time budgets, recovery and preserved results

- **Long agent runs no longer rely on the 100-second chat limit.** Both agent entry points request 300 seconds. Chat reserves a shared 240-second network budget from request start, leaving time for the outer reply; each step is bounded to 120 seconds. Silent calls send a progress heartbeat every 10 seconds. Hosting hard limits still apply; this is not background/resumable execution.
- **A failed or stuck worker now goes to the Supervisor and then back to the Project Manager** for a bounded recovery plan (split/reassign, preserve completed work). A failed Supervisor produces a deterministic revision report. Cancellation and the total deadline stop new calls instead of entering recovery. Step-level errors show the actual reason; exhausted recovery is marked partial rather than successful. The outer model cannot call the network again in the same response.
- **Recovery planning was missing its context.** The PM prompt referred to `project_context` but never included it; recovery now includes the pending tasks and last review, so the PM can retain unfinished work instead of guessing. Fixed unclosed task/past-message context tags as well.
- **Completed deliverables are retained on failure and across task splits.** The outer model receives the latest successful result per task, not just per agent (which discarded earlier files from the same Programmer), plus failures/open concerns. The interrupted-step fallback no longer implies a specific cause that the client cannot know.
- **More token headroom:** workers 16k -> 32k, Writer 32k -> 64k, Programmer 64k -> 128k, outer Agents reply 32k -> 128k (leads stay at 16k). Existing structured-output retries remain capped at one and double the budget on `length`, up to the model limit. Initial budgets are also clamped, errors report the output budget, and the documented default reasoning effort is now actually passed to the provider.
- Request cancellation reaches the outer model and agent calls; closing the tool stream cancels background execution and cleans up heartbeat/step/run timers. Removed verbose full-prompt/result console dumps while restructuring execution.
- Added `npm run test:agents` with deterministic, no-API regression coverage and `docs/AGENT_RUNS.md`. Added the repository's `AGENTS.md` to version control and refreshed the agent guidance in both instruction files.

## 2026-11-02 — Web search for agents

- **Agents can search the web.** Agents had no tools at all, so in Agents mode only the outer chat could search, and the Researcher was switched off. `AgentBuilder` now takes `webSearch: true`, which gives an agent OpenAI's hosted web search. The search runs inside the same response, so the agent still returns its structured result in one call. Only OpenAI models can use it; building a non-OpenAI agent with it throws.
- The **Researcher** is back in the network with search, and the **Verifier** uses search to fact-check. The Project Manager is told both can search, and to start with the Researcher for current or factual questions.
- Tested with one Agents run ("current Node.js LTS"): the PM assigned the Researcher then the Verifier, both searched and cited nodejs.org, and the Verifier added that v24 and v22 are still LTS too.

## 2026-11-02 — Web search on OpenAI

- **Web search works again.** `bing_web_search` failed on every call (Microsoft retired the Bing Search API). The new `web_search` tool makes a small GPT-6 Luna call with OpenAI's hosted web search (low reasoning effort, existing OpenAI key) and returns the summary and source pages, so it works with every chat model. Sources use Bing's old `webPages` shape, so the Sources card is unchanged. OpenAI returns no image results or related searches, so those cards only appear in older chats, which still render (the UI matches both tool names). It costs about $10 per 1,000 searches plus tokens; switching to Tavily is on the roadmap.
- `BING_API_KEY` is removed from `.env.example`, and the system prompt no longer mentions Bing or search images.
- README: dropped the link to the old Render deployment.

## 2026-11-02 — Vercel deployment prep

- **Published artifact links no longer need `NEXT_PUBLIC_URL`.** The link is built from the address the request came to, so it's right on localhost, Vercel preview deployments, production and custom domains. The variable was the only use and would have pointed live links at `localhost` when set to the local value. It's removed from `.env.example`.
- `.gitignore` ignores the `.vercel` project link and `.env*` files (added by `vercel link`), with `.env.example` kept tracked.

## 2026-11-02 — Separate users per browser

Everyone used to be the same user (`userId = "1"`, hardcoded in the pages), so on a shared deployment every visitor would see and could overwrite everyone's chats and memories.

- Each browser now gets an anonymous ID on its first visit: a random UUID in an httpOnly cookie (`synapse_uid`, about 13 months), set by `proxy.ts`. A cookie rather than the IP address, since people on one network share an IP and phones change IPs.
- The server reads the user from the cookie and ignores any user ID in requests. `/api/chats` lists only the browser's chats; `/api/chat/[id]` returns 404 for another browser's chat (unless it's public); `/api/save` refuses (403) to overwrite another browser's chat; the chat page title and published artifacts use the cookie user too.
- **Settings → Account** shows the browser ID and explains that chats are tied to the browser.
- **Existing chats**: everything saved before this belongs to the old ID `"1"`, which browsers can't use. `npm run claim-legacy-chats -- <browser-id>` moves those chats, published artifacts, memories and settings to a browser ID (`--dry-run` shows the counts first). Nothing is deleted.

Tested with two cookie jars: separate IDs; a fresh browser sees no chats; reading another browser's chat or a legacy chat gives 404; overwriting gives 403; requests without a cookie get a new ID. The dry run found 794 chats and 30 memories under `"1"`.

## 2026-11-01 — Smarter Auto, reasoning level for every model

### Auto routing (now the default model)

Auto used to substring-match the message against ~127 keywords: any hit went to GPT-6.1 Sol, everything else to Luna ("happy" matched "app", "decode" matched "code", and context was ignored). It now works like the routers in ChatGPT and OpenRouter (`lib/routing/auto-router.ts`):

- **Classifier**: labels the latest message with a task (chat, factual, writing, coding, math, analysis, creative), a difficulty (trivial, standard, complex, expert) and whether it needs deep thinking. Which model classifies is a setting (**Settings → Auto Router**), default GPT-OSS 20B:

  | Classifier | Correct | Prompts answered differently across runs | Errors | Median | p90 |
  |---|---|---|---|---|---|
  | GPT-OSS 20B (Groq, default) | 20/24 | 4/8 | 0 | 329 ms | 544 ms |
  | Qwen 3.8 27B (Groq) | 20/22 | 4/8 | 2 | 414 ms | ~5 s |
  | GPT-6 Luna Decisions API (OpenAI) | 21/24 | 0/8 | 0 | 170 ms | 448 ms |

  8 labelled prompts × 3 runs, warm calls. Qwen 3.8 27B is the only Qwen model Groq serves. The Decisions API (`experimental_decide`, typed choice/score/boolean questions) was the most accurate, consistent and fastest, but it bills the OpenAI key, while the Groq models are free; GPT-OSS 20B stays the default. Both kinds of classifier use the same task and difficulty definitions. It sees the last two messages for follow-ups ("now make it faster") and signals such as attached images/files, code and a connected repository.
- **Fast path**: obviously trivial messages ("hi", "thanks") skip the classifier.
- **Rules over the classifier**: a request that contains or mentions code is a coding task.
- **Policy (cost first)**: more reasoning effort on a cheaper model is tried before a pricier model.

  | Difficulty | Model and reasoning |
  |---|---|
  | Trivial | Luna, low |
  | Standard | Luna, medium |
  | Complex | Terra, medium (coding, math, analysis, writing, creative); Luna, high (chat, factual) |
  | Expert | Sol, high (Terra when premium models are off) |

  "Needs deep thinking" raises the effort one level on the same model. Astra and Claude are never picked automatically.

  The first version of this policy (Terra for standard coding/writing/creative, Sol or Claude Sonnet for complex work, Astra for expert work) picked Terra or better too often. It is kept as **Settings → Auto Priority → Performance**; Cost is the default. Both policies live in `lib/routing/policy.ts`, and [docs/AUTO_ROUTING.md](./AUTO_ROUTING.md) lists every combination (task × difficulty, with and without deep thinking, premium models on/off, repository connected), generated from the code with `npm run docs:auto-routing`.
- **Fallback**: heuristics decide if the classifier fails or takes longer than 3.5 s.
- **Visible**: the badge shows the pick ("Auto · GPT-6.1 Terra") and its tooltip the reason ("standard coding, medium reasoning"); the decision is saved with the message.

Tested (with the first policy): "hi" → fast path, Luna low; "write a Python palindrome function" → Terra medium (now Luna medium); "one-line regex for a US zip code" → trivial coding, Luna low; "TCP vs UDP in two sentences" → trivial factual, Luna low (Decisions API).

### Artifacts

- **"Maximum update depth exceeded" with long artifacts** (still happening after the earlier throttle fix). The chat processed each streamed update inside an effect and set state from it; with a long artifact, each pass (artifact extraction, markdown, highlighting 1,000+ lines) took longer than the 50 ms stream throttle, so the next update was always waiting and React counted an unbroken chain of effect-triggered updates. Messages are now processed in the next animation frame (merging bursts), and the save on finish waits a frame so the final update is processed first. Re-tested with a 56,000-character HTML artifact: no warnings, saved complete.
- **The artifact code view follows the stream** like the chat: it stays at the bottom while you're there, stops when you scroll up, resumes when you scroll back down, and scrolls independently of the chat.

### Bug fixed

- **"Failed to load chat data" when starting a new chat.** The chat decided whether to load from the database by looking for "/chat/" in the URL. Right after "New chat", the URL still showed the previous chat for a moment, so the new, unsaved chat requested itself and got a 404. The home page now marks its chat as new (`isNewChat`) and only `/chat/[id]` loads; a missing chat logs a warning instead of an error.

### Reasoning

- **Reasoning mode was removed.** It was Claude Opus 5.5 with a fixed 12k extended-thinking budget (originally a prompt that made non-reasoning models "think step by step" in tags; that middleware was still in the code, unused).
- **The reasoning level now applies to every model**, including Claude (adaptive thinking) and Groq (`reasoning_effort`). Levels are Low, Medium, High and Extra high: "Minimal" was dropped because neither GPT-6 nor Claude support it, and Groq models are capped at High. All chat models are now called without temperature/top P (Claude 5.x rejects them; the reasoning models ignore them).
- In Auto, the picker is hidden and the settings menu notes that Auto picks the level.

### Model picker

- Auto and Agents are listed first, under "Modes"; **Auto is the default model**.

### Settings dialog

- **The dialog ran past the top and bottom of the screen** (it had grown with each new setting). It's now a fixed-height panel (at most 88% of the window) with sections in a sidebar (Model, Auto, Features, Tools, Instructions; tabs across the top on phones), and only the section content scrolls. Checked down to a 380 px-tall window.
- **Temperature and Top P were removed from the dialog**: every chat model now reasons and is called without them, so they did nothing. The values stay in the stored settings.
- The Auto options use short labels (GPT-OSS 20B / Qwen 3.8 27B / Luna Decisions; Cost / Performance) with one-line hints.

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
