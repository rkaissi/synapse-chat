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
- Tool calls show as plain name chips; repo tools (`repo_read_file`, `repo_search`, …) deserve a compact "explored N files" view with the paths
- The GitHub connect bar takes a full row above the chat; it could live in the composer or header
- [ ] Make it easier to turn on/off tools and artifacts (beside chatbox)
- [ ] Add response format

![image](https://github.com/user-attachments/assets/ac8619b6-8c6f-4352-90d5-d1d7cf84169c)

### Agents preview page

An `app/preview/agents` page was started (empty) and removed so builds pass. The intent: a page that runs the agent network through `/api/agents` (client helper: `lib/utils/call-agents.ts`) and shows the agents planning, delegating and reviewing each other's work in real time.

- [ ] Build the page on top of `/api/agents`, streaming each agent message as it is produced
- [ ] Visualize the task list and which agent is working on what

### Web search

- [ ] Replace `bing_web_search`: Microsoft retired the Bing Search API in August 2025. Options: provider-native search tools (OpenAI / Anthropic web search) or a search API such as Brave, Tavily or Exa
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
