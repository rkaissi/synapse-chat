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

- [x] Stream agent progress into the chat, with a network graph, plan, team, activity and trace view (agent team card)
- [x] Per-role models: Programmer and Writer on GPT-6.1 Terra, everything else on GPT-6 Luna
- [ ] Consider GPT-6.1 Sol for the Mathematician and Logician (reasoning-heavy roles)
- [ ] Trim the verbose agent prompt logging in the server console
- [ ] Stream each agent's text as it is generated (today a step appears when the agent finishes)
- [ ] Run independent tasks in parallel instead of strictly one after another
- [ ] Choose which agents may take part in a run

### Model routing and providers

- [x] Overhaul Auto routing: a classifier (OpenAI Decisions API on GPT-6 Luna) plus rules picks the model and reasoning effort per message (`lib/routing/auto-router.ts`)
- [ ] Auto: let users pick a speed/quality preference, and learn from regenerations (a regenerate after a cheap pick could route the retry higher)
- [ ] Replace the hand-written `getModel` switch with the AI SDK's built-in `createProviderRegistry` + `customProvider`. They support model aliases ("fast", "smart", "reasoning"), per-alias middleware and default settings, and `provider:model` ids. Optionally the Vercel AI Gateway (one key, `openai/gpt-6-luna` style ids).

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
