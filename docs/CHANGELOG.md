# Changelog

Notable changes, including bugs found and fixed while testing. Newest first.

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
