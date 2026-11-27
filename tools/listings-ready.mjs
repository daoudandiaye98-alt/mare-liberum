// Mare Liberum · writes listings/ready/<directory>.md: one ready file per directory the repo gives evidence of (a manifest,
// a link or a ticket in the repo), each with name, one sentence of purpose, the /mcp URL, the category, an example call
// and the price line. The prices come from node/pricing.mjs alone, so a file here never says a price the sea does not.
// Where neither the repo nor its configuration says a thing, the file says "nicht belegt". No sign-up, no mail: the files
// are the work of a human, by hand.
// Runs: node tools/listings-ready.mjs  (writes the files; exit code 1 if a file lacks a field)
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { SEAT, CREDIT, PATH_PACKS, seatLine, pricingOf } from '../node/pricing.mjs';

const BASE = 'https://mareliberum.dev', NB = 'nicht belegt';
const has = (f) => existsSync(new URL(`../${f}`, import.meta.url));
const json = (f) => JSON.parse(readFileSync(new URL(`../${f}`, import.meta.url), 'utf8'));
const route = pricingOf(undefined, BASE).amount_usd;
const PURPOSE = 'An open place for AI agents, no account: read any web page as Markdown, reuse paths other agents confirmed, and buy a seat with a key alone, on credit.';
const PRICE = `Free: 20 probe calls per key, the first 3 paths of a route. Paid: a seat ${seatLine(SEAT)}, bought with a key on credit (${CREDIT.dueDays} days to pay) or by card; bundles of ${PATH_PACKS.map((p) => `${p.paths.toLocaleString('en-US')} paths for ${p.cents / 100} USD`).join(' or ')}; one route ${route} USDC on Base over x402.`;
const CALL = (mcp) => `curl -s -X POST ${mcp} -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"read_page","arguments":{"url":"https://example.com"}}}'`;
const claudeCat = has('.claude-plugin/marketplace.json') ? json('.claude-plugin/marketplace.json').plugins?.[0]?.category : null;
const serverName = has('server.json') ? json('server.json').name : null;

const DIRS = [
  { file: 'mcp-registry', name: 'Offizielles MCP-Register', url: 'https://registry.modelcontextprotocol.io', mcp: `${BASE}/mcp`, category: NB, what: `Remote-MCP-Server aus server.json (${serverName || NB})`, how: 'mcp-publisher publish mit dem privaten Domain-Schlüssel (DNS-Nachweis für mareliberum.dev); Glama und andere Spiegel lesen von dort', account: 'kein Konto, aber der private Domain-Schlüssel', evidence: 'server.json (Name, Remote-URL); listings/mcp-registry.md', open: 'Das Register kennt keine Kategorie; neueste Version dort laut listings/directories.md 3.65.0, server.json sagt 3.84.0' },
  { file: 'claude-directory', name: 'Claude-Verzeichnis (Connectors und Plugins)', url: 'https://claude.ai/directory/manage', mcp: `${BASE}/mcp/app`, category: claudeCat || NB, what: 'Verbinder (die Tür /mcp/app) und Plugin aus dem Repo', how: 'Formular im Claude-Verzeichnis, Plugin aus .claude-plugin/marketplace.json', account: 'ja, bezahlter Claude-Plan', evidence: '.claude-plugin/marketplace.json (Kategorie), plugins/mare-liberum/.mcp.json (/mcp/app)', open: 'Stand der Prüfung beim Verzeichnis: nicht belegt (nur im Projekt-Dokument)' },
  { file: 'chatgpt-apps', name: 'ChatGPT-Apps (OpenAI)', url: 'https://platform.openai.com/plugins', mcp: `${BASE}/mcp/app`, category: NB, what: 'App mit MCP-Tür', how: 'Hochladen von plugins/openai/mare-liberum.zip auf der Plattform', account: 'ja, mit bestätigter Identität', evidence: 'plugins/openai/mare-liberum/plugin.json, plugins/openai/mare-liberum/mcp.json (/mcp/app), plugins/openai/mare-liberum.zip', open: 'plugin.json nennt keine Kategorie' },
  { file: 'cursor-plugins', name: 'Cursor-Plugins', url: 'https://cursor.com/docs/plugins', mcp: `${BASE}/mcp/app`, category: NB, what: 'Plugin (MCP-Server und Skill)', how: NB, account: 'ja', evidence: '.cursor-plugin/marketplace.json, plugins/mare-liberum/.mcp.json (/mcp/app)', open: 'Einreichweg nicht belegt (429 beim Lesen der Doku); marketplace.json nennt keine Kategorie' },
  { file: 'gemini-extensions', name: 'Gemini-CLI-Erweiterungen', url: NB, mcp: `${BASE}/mcp/lean`, category: NB, what: 'Erweiterung aus dem Repo (gemini-extension.json, schlanke Tür mit 4 Werkzeugen)', how: NB, account: 'GitHub', evidence: 'gemini-extension.json (httpUrl /mcp/lean), GEMINI.md', open: 'Adresse der Galerie und Weg hinein: nicht belegt' },
  { file: 'glama', name: 'Glama', url: 'https://glama.ai/mcp/connectors/dev.mareliberum/sea', mcp: `${BASE}/mcp`, category: NB, what: 'nichts einzureichen: Glama liest das MCP-Register stündlich', how: 'Admin-Reiter für den Eigentümer (Maintainer aus glama.json)', account: 'ja, für den Admin-Reiter', evidence: 'glama.json (maintainers), Plaketten-Links in README.md', open: 'Kategorie bei Glama: nicht belegt' },
  { file: 'mcpservers-org', name: 'mcpservers.org', url: 'https://mcpservers.org/servers/mareliberum-dev-mcp-server', mcp: `${BASE}/mcp`, category: NB, what: 'schon gelistet; Änderungen über das Formular', how: 'https://mcpservers.org/submit', account: 'nein (E-Mail)', evidence: 'Link in README.md', open: 'Kategorie dort: nicht belegt' },
  { file: 'a2a-registry', name: 'A2A Registry', url: 'https://a2aregistry.org/submit', mcp: `${BASE}/mcp`, category: NB, what: `Agent Card URL ${BASE}/.well-known/agent-card.json`, how: 'Formular mit der Agent-Card-URL', account: 'nein', evidence: '/.well-known/agent-card.json antwortet 200 (geprüft am 27.11.2026)', open: 'Der alte Eintrag nennt noch die Vercel-Adresse (Projekt-Dokument §9); Kategorie: nicht belegt' },
  { file: 'aws-marketplace', name: 'AWS Marketplace (Agentic Commerce, x402)', url: 'https://docs.aws.amazon.com/marketplace/latest/userguide/agentic-commerce-products.html', mcp: `${BASE}/mcp`, category: NB, what: 'bezahlte Endpunkte für Agenten (Bedrock AgentCore Payments, x402)', how: 'Ticket aus docs/ticket_aws_marketplace.md', account: 'ja, Verkäuferkonto', evidence: 'docs/ticket_aws_marketplace.md (fertiges Ticket)', open: 'Produktkategorie bei AWS: nicht belegt' },
];

const out = new URL('../listings/ready/', import.meta.url);
mkdirSync(out, { recursive: true });
let bad = 0;
for (const d of DIRS) {
  const body = [
    `# ${d.name} · fertig zum Einreichen`,
    '',
    `Erzeugt von tools/listings-ready.mjs aus dem Repo (Preise aus node/pricing.mjs). Wo Repo und Konfiguration nichts sagen: **${NB}**.`,
    '',
    '| Feld | Wert |',
    '|---|---|',
    `| Name | Mare Liberum |`,
    `| Zweck (ein Satz) | ${PURPOSE} |`,
    `| MCP-URL | ${d.mcp} |`,
    `| Kategorie | ${d.category} |`,
    `| Verzeichnis | ${d.url} |`,
    `| Was eingetragen wird | ${d.what} |`,
    `| Weg | ${d.how} |`,
    `| Konto nötig | ${d.account} |`,
    `| Beleg im Repo | ${d.evidence} |`,
    `| Offen | ${d.open} |`,
    '',
    '## Beispielaufruf',
    '',
    '```',
    CALL(d.mcp),
    '```',
    '',
    '## Preiszeile',
    '',
    PRICE,
    '',
  ].join('\n');
  for (const f of ['| Name |', '| Zweck (ein Satz) |', '| MCP-URL |', '| Kategorie |', '## Beispielaufruf', '## Preiszeile']) if (!body.includes(f)) { bad++; console.error(`${d.file}: ${f} fehlt`); }
  writeFileSync(new URL(`${d.file}.md`, out), body);
  console.log(`listings/ready/${d.file}.md`);
}
process.exit(bad ? 1 : 0);
