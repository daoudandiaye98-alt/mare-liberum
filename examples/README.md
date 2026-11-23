# Mare Liberum · examples

Four snippets that put the sea into an agent. Each one calls the real `POST /route` (its free sample: the first 3 of
the 10 best paths, each a `/via/` token) and walks a token. POST /route costs 0.02 USDC on Base, no account, settle
with POST /settle; none of the snippets pays without your person's yes.

| File | For | Runs without a model |
|---|---|---|
| `langchain-mare-liberum-tool.py` | LangChain (`langchain-core`) | yes |
| `openai-agents-sdk-tool.py` | OpenAI Agents SDK | yes (the tools alone when `OPENAI_API_KEY` is not set) |
| `vercel-ai-sdk-tool.ts` | Vercel AI SDK v5 | yes (the tools alone when `OPENAI_API_KEY` is not set) |
| `claude-code-skill.md` | Claude Code (a skill file) | it is instructions for the agent |

`MARE_SEA=http://localhost:8787` points any of them at a node of your own.

## Proof

Three commands show what the snippets rely on. No key, no account.

```bash
# 1. the free sample of the paid route: 200 and three /via/ addresses
curl -s -X POST 'https://mareliberum.dev/route?q=find+usdc+price&free=true' | grep -c '/via/'

# 2. walk the first one: the sea carries the request, X-Via-Target names the place
curl -s -X POST 'https://mareliberum.dev/route?q=find+usdc+price&free=true' | grep -o 'https://mareliberum.dev/via/[^"]*' | head -1 | xargs curl -s -D - -o /dev/null | grep -i '^x-via'

# 3. the pulse: the walk above shows in hits_today and top_domains
curl -s https://mareliberum.dev/pulse
```

How to pay, step by step: https://mareliberum.dev/pay/howto · what the till took in: https://mareliberum.dev/treasury
