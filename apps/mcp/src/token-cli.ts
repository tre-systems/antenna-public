#!/usr/bin/env node
import type { McpTokenRecord } from '@antenna/shared';
import { normalizeBaseUrl, normalizeCookie } from './url.js';

export type TokenCliEnv = {
  readonly ANTENNA_BASE_URL?: string;
  readonly ANTENNA_SESSION?: string;
  readonly ANTENNA_TOKEN?: string;
};

export type TokenCliOptions = {
  readonly args: readonly string[];
  readonly env?: TokenCliEnv;
  readonly fetchImpl?: typeof fetch;
  readonly write?: (text: string) => void;
  readonly writeError?: (text: string) => void;
};

export async function runTokenCli(options: TokenCliOptions): Promise<number> {
  const env = options.env ?? process.env;
  const write = options.write ?? ((text) => process.stdout.write(text));
  const writeError = options.writeError ?? ((text) => process.stderr.write(text));
  const fetchImpl = options.fetchImpl ?? fetch;
  const [command, ...rest] = options.args;

  if (command === undefined || command === 'help' || command === '--help' || command === '-h') {
    write(helpText());
    return command === undefined ? 1 : 0;
  }

  try {
    const client = createTokenClient(env, fetchImpl);
    if (command === 'list') {
      const tokens = await client.list();
      write(formatTokenList(tokens));
      return 0;
    }
    if (command === 'revoke') {
      const id = rest[0];
      if (id === undefined || id.trim().length === 0) {
        throw new Error('Usage: antenna-mcp-token revoke <token-id>');
      }
      await client.revoke(id);
      write(`Revoked MCP token ${id}\n`);
      return 0;
    }

    throw new Error(`Unknown command "${command}".\n\n${helpText()}`);
  } catch (error) {
    writeError(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

function createTokenClient(env: TokenCliEnv, fetchImpl: typeof fetch) {
  const headers = createHeaders(env);
  const configuredBaseUrl = env.ANTENNA_BASE_URL?.trim();
  if (!configuredBaseUrl) {
    throw new Error('Set ANTENNA_BASE_URL to your Antenna Worker origin.');
  }
  const baseUrl = normalizeBaseUrl(configuredBaseUrl);

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetchImpl(new URL(path, baseUrl), {
      ...init,
      headers: mergeHeaders(headers, init.headers),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      const detail = body ? `: ${body.slice(0, 200)}` : '';
      throw new Error(`${init.method ?? 'GET'} ${path} failed: ${response.status}${detail}`);
    }
    return (await response.json()) as T;
  }

  return {
    list(): Promise<McpTokenRecord[]> {
      return request<McpTokenRecord[]>('/api/mcp-tokens');
    },
    revoke(id: string): Promise<{ revoked: true }> {
      return request<{ revoked: true }>(`/api/mcp-tokens/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    },
  };
}

function createHeaders(env: TokenCliEnv): Headers {
  const headers = new Headers({ Accept: 'application/json', 'Content-Type': 'application/json' });
  if (env.ANTENNA_TOKEN !== undefined) {
    headers.set('Authorization', `Bearer ${env.ANTENNA_TOKEN}`);
    return headers;
  }
  if (env.ANTENNA_SESSION !== undefined) {
    headers.set('Cookie', normalizeCookie(env.ANTENNA_SESSION));
    return headers;
  }
  throw new Error('Set ANTENNA_SESSION or ANTENNA_TOKEN before using antenna-mcp-token.');
}

function mergeHeaders(base: Headers, extra: HeadersInit | undefined): Headers {
  const headers = new Headers(base);
  if (extra !== undefined) {
    new Headers(extra).forEach((value, key) => {
      headers.set(key, value);
    });
  }
  return headers;
}

function formatTokenList(tokens: readonly McpTokenRecord[]): string {
  if (tokens.length === 0) return 'No active MCP tokens.\n';
  const rows = tokens.map((token) =>
    [
      token.id,
      token.label ?? '(none)',
      new Date(token.created_at).toISOString(),
      token.last_used_at === null ? 'never' : new Date(token.last_used_at).toISOString(),
    ].join('\t'),
  );
  return ['id\tlabel\tcreated\tlast used', ...rows, ''].join('\n');
}

function helpText(): string {
  return [
    'Usage:',
    '  antenna-mcp-token list',
    '  antenna-mcp-token revoke <token-id>',
    '',
    'Environment:',
    '  ANTENNA_SESSION  Better Auth session cookie value or full Cookie header',
    '  ANTENNA_TOKEN    Existing legacy pbk_ token for list/revoke',
    '  ANTENNA_BASE_URL Antenna Worker origin (required)',
    '',
  ].join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const code = await runTokenCli({ args: process.argv.slice(2) });
  process.exit(code);
}
