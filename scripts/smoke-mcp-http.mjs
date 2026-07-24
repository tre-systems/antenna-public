import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const DEFAULT_BASE_URL = 'https://antenna.example';

const baseUrl = process.env.ANTENNA_BASE_URL ?? DEFAULT_BASE_URL;
const token = process.env.ANTENNA_TOKEN;
const sessionCookie = process.env.ANTENNA_SESSION;
const required = process.env.ANTENNA_REQUIRE_HTTP_SMOKE === '1';

if (token === undefined && sessionCookie === undefined) {
  const message =
    'MCP HTTP smoke skipped: set ANTENNA_TOKEN or ANTENNA_SESSION to exercise /api/mcp.';
  if (required) {
    throw new Error(message);
  }
  console.log(message);
  process.exit(0);
}

const transport = new StreamableHTTPClientTransport(
  new URL('/api/mcp', normalizeBaseUrl(baseUrl)),
  {
    requestInit: {
      headers: authHeaders({ token, sessionCookie }),
    },
  },
);
const client = new Client({ name: 'antenna-mcp-http-smoke', version: '0.1.0' });

try {
  await client.connect(transport);
  const tools = await client.listTools();
  const toolNames = tools.tools.map((tool) => tool.name);
  if (!toolNames.includes('list_signals')) {
    throw new Error(`MCP HTTP smoke did not find list_signals. Found: ${toolNames.join(', ')}`);
  }

  const result = await client.callTool({ name: 'list_signals', arguments: {} });
  if (JSON.stringify(result).length === 0) {
    throw new Error('MCP HTTP smoke returned an empty list_signals payload.');
  }

  console.log(`MCP HTTP smoke passed (${baseUrl}).`);
} finally {
  await client.close();
}

function authHeaders({ token, sessionCookie }) {
  if (token !== undefined) {
    return { authorization: `Bearer ${token}` };
  }
  return { cookie: normalizeCookie(sessionCookie) };
}

function normalizeBaseUrl(value) {
  return value.endsWith('/') ? value : `${value}/`;
}

function normalizeCookie(value) {
  if (value === undefined) {
    throw new Error('Missing ANTENNA_SESSION.');
  }
  return value.includes('=') ? value : `better-auth.session_token=${value}`;
}
