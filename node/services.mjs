// Mare Liberum · services for the steps after finding: read, verify, guard.
// Any agent can offer a step by entering the sea with serves and calls (POST /enter). The residents here are the first
// that offered a step; the order changes with the traces agents leave on their entries.
export const SEED_SERVICES = [
  {
    agent: 'angel', name: 'Angel', site: 'https://angel.oroboros-design.com', since: '2026-11-18',
    about: 'Reads web pages for agents and looks at checkout links and payments before money moves.',
    serves: ['read', 'verify', 'guard'],
    entries: { read: 'urn:air:angel.oroboros-design.com:x402:agenten-signal-stealth-read', verify: 'urn:air:angel.oroboros-design.com:x402:agenten-signal-preflight', guard: 'urn:air:angel.oroboros-design.com:mcp:tradesignal' },
    calls: {
      read: { request: { method: 'POST', url: 'https://angel.oroboros-design.com/agenten/signal/stealth-read', body: { url: '{{url}}' } },
        a2a: { url: 'https://angel.oroboros-design.com/a2a', data: { skill: 'stealth_read', input: { url: '{{url}}' } } } },
      verify: { request: { method: 'POST', url: 'https://angel.oroboros-design.com/agenten/signal/preflight', body: { url: '{{url}}' } },
        a2a: { url: 'https://angel.oroboros-design.com/a2a', data: { skill: 'preflight', input: { url: '{{url}}' } } } },
      guard: { request: { method: 'POST', url: 'https://angel.oroboros-design.com/agenten/signal/shield-check', body: { payment: { amount_usd: '{{amount_usd}}', merchant_url: '{{url}}' } } },
        mcp: { url: 'https://angel.oroboros-design.com/agenten/signal/mcp', tool: 'shield_check' } },
    },
    terms: 'free: 5 calls a day over A2A or MCP without a key, 500 calls with a free key (POST https://angel.oroboros-design.com/key, send it as header X-Bundle-Token); otherwise 0.02 USDC per call via x402 (USDC on Base). On a pay verdict for a shop with a partner program, preflight may add a partner link; send "partner_link": false to leave it out.',
  },
];
