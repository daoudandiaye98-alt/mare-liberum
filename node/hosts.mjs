// Mare Liberum · the chat hosts (since 4.0), in a module of its own without imports: node/seat.mjs names the host in a seat's
// link, node/installs.mjs counts installations per host, node/contacts.mjs keeps install_source with a contact
// the chat host a call comes from, by its program name (an MCP client's clientInfo.name) or its user agent: one of the hosts
// whose people already keep a card on file, else other (node/installs.mjs counts installations by the same names)
export const HOSTS = Object.freeze(['chatgpt', 'claude', 'grok', 'gemini', 'cursor', 'copilot', 'other']);
export function hostOf(ua, name = '') {
  const s = `${name || ''} ${ua || ''}`;
  if (/cursor/i.test(s)) return 'cursor';
  if (/claude|anthropic/i.test(s)) return 'claude';
  if (/chatgpt|openai|\bgpt(?:bot|s)?\b|oai-/i.test(s)) return 'chatgpt';
  if (/\bgrok\b|\bxai\b|x\.ai\b/i.test(s)) return 'grok';
  if (/gemini|\bbard\b|google-cloudvertexbot|googleagent/i.test(s)) return 'gemini';
  if (/copilot|vscode|visual studio code/i.test(s)) return 'copilot';
  return 'other';
}
