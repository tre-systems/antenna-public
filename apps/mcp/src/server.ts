#!/usr/bin/env node
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createAntennaMcpServer } from './factory.js';
import type { AntennaClientOptions } from './client.js';
import { requireBaseUrl } from './url.js';

export type AntennaMcpConfig = {
  readonly baseUrl: string;
  readonly sessionCookie?: string;
  readonly token?: string;
};

export { createAntennaMcpServer } from './factory.js';

export function readConfigFromEnv(env: NodeJS.ProcessEnv = process.env): AntennaMcpConfig {
  if (env.ANTENNA_SESSION === undefined && env.ANTENNA_TOKEN === undefined) {
    throw new Error('Set ANTENNA_SESSION or ANTENNA_TOKEN before starting the Antenna MCP server.');
  }

  return {
    baseUrl: requireBaseUrl(env.ANTENNA_BASE_URL),
    sessionCookie: env.ANTENNA_SESSION,
    token: env.ANTENNA_TOKEN,
  };
}

// Configuration is read inside the promise so a missing variable reaches the
// caller's handler as one line instead of an uncaught stack trace.
export function runStdioServer(config?: AntennaClientOptions): Promise<void> {
  return Promise.resolve().then(() => {
    const resolved = config ?? readConfigFromEnv();
    serveStdio(() => createAntennaMcpServer(resolved));
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runStdioServer().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Antenna MCP server failed: ${message}`);
    process.exit(1);
  });
}
