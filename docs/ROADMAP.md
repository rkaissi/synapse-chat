# Roadmap

## Done

- [x] Add sidebar chat history
- [x] Allow dockable sidebar
- [x] Upgrade all dependencies (AI SDK 7, Next 16, Tailwind 4, zod 4) and refresh the model list (see [CHANGELOG](./CHANGELOG.md))
- [x] Connect GitHub repositories as an explorable checkout (list / read / search tools) instead of pasting the repo into the chat

## Next up

### UI/UX overhaul

A full pass over the interface. Known issues and ideas collected so far:

- Narrow windows (< 1024px) open the sidebar as a full overlay by default, covering the chat
- Long model badges wrap into a circle next to "Assistant" when the chat column is narrow
- Generated images have no dedicated card (prompt, size, download); they rely on the model writing markdown
- Tool calls show as plain name chips; repo tools (`repo_read_file`, `repo_search`, …) deserve a compact "explored N files" view with the paths
- The GitHub connect bar takes a full row above the chat; it could live in the composer or header
- [ ] Make it easier to turn on/off tools and artifacts (beside chatbox)
- [ ] Add response format

![image](https://github.com/user-attachments/assets/ac8619b6-8c6f-4352-90d5-d1d7cf84169c)

### Agents

- [ ] Stream agent progress into the chat: the network runs sequentially and the chat shows nothing until every agent has finished (often 30s+)
- [x] Per-role models: Programmer on GPT-6.1 Sol, Writer on GPT-6.1 Terra, everything else on GPT-6 Luna
- [ ] Consider GPT-6.1 Sol for the Mathematician and Logician (reasoning-heavy roles)
- [ ] Trim the verbose agent prompt logging in the server console

### Agents preview page

An `app/preview/agents` page was started (empty) and removed so builds pass. The intent: a page that runs the agent network through `/api/agents` (client helper: `lib/utils/call-agents.ts`) and shows the agents planning, delegating and reviewing each other's work in real time.

- [ ] Build the page on top of `/api/agents`, streaming each agent message as it is produced
- [ ] Visualize the task list and which agent is working on what

### Model routing and providers

- [ ] Overhaul Auto routing. Today `determineModel` substring-matches the last message against ~127 keywords (`keywordCategories` in `app/api/chat/config.ts`): any hit routes to GPT-6.1 Sol, otherwise GPT-6 Luna. Substring matching misfires ("app" matches "happy", "code" matches "decode") and ignores conversation context. Options: a cheap classifier call (Luna with `Output.choice`), routing on attachments/tools/length, or letting the user pick a speed/quality preference.
- [ ] Replace the hand-written `getModel` switch with the AI SDK's built-in `createProviderRegistry` + `customProvider`. They support model aliases ("fast", "smart", "reasoning"), per-alias middleware and default settings, and `provider:model` ids. The custom "Reasoning" model then becomes an alias (e.g. Opus 5.5 with `reasoning: "high"`) instead of a special provider case. Optionally the Vercel AI Gateway (one key, `openai/gpt-6-luna` style ids).

### Web search

- [ ] Replace `bing_web_search` (the Bing Search API was retired; calls return 401). Options:
  - OpenAI's built-in web search tool, called from a tool so it works for any chat model (uses the existing OpenAI key)
  - Anthropic's web search tool (Anthropic models only)
  - A search API such as Brave, Tavily or Exa (needs a new key); keeps the existing sources/images/related-searches cards
- [ ] Turn on search mode like ChatGPT Search

### GitHub integration follow-ups

- [ ] Branch picker in the connect UI (branches can already be connected with `.../tree/<branch>` URLs)
- [ ] Refresh a connection to the latest commit
- [ ] Optional write access: propose changes as a diff / open a pull request

## Later

- [ ] Add version of Custom GPTs / Claude Projects / Perplexity Pages
- [ ] Update logic mode / add [chain of thought mode or model](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/chain-of-thought)
- [ ] Temporary/Private chats (+ clear chat)
- [ ] Real user accounts (every request currently uses `userId = "1"`)
- [ ] Restore per-chat settings (model, artifacts toggle, …) when a saved chat is opened

## CoT Resources

- [Outperform o1](https://www.reddit.com/r/ClaudeAI/comments/1fx51z4/i_made_claude_35_sonnet_to_outperform_openai_o1/)
- [g1 GitHub](https://github.com/bklieger-groq/g1)
