#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createAntennaMcpServer } from './factory.js';
import type { AntennaClientOptions } from './client.js';

const DEFAULT_BASE_URL = 'https://antenna.example';

export type AntennaMcpConfig = {
  readonly baseUrl: string;
  readonly sessionCookie?: string;
  readonly token?: string;
};

export { createAntennaMcpServer } from './factory.js';

export function readConfigFromEnv(env: NodeJS.ProcessEnv = process.env): AntennaMcpConfig {
  const config = {
    baseUrl: env.ANTENNA_BASE_URL ?? DEFAULT_BASE_URL,
    sessionCookie: env.ANTENNA_SESSION,
    token: env.ANTENNA_TOKEN,
  };

  if (config.sessionCookie === undefined && config.token === undefined) {
    throw new Error('Set ANTENNA_SESSION or ANTENNA_TOKEN before starting the Antenna MCP server.');
  }

  return config;
}

export async function runStdioServer(
  config: AntennaClientOptions = readConfigFromEnv(),
): Promise<void> {
  const server = createAntennaMcpServer(config);
  await server.connect(new StdioServerTransport());
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runStdioServer().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Antenna MCP server failed: ${message}`);
    process.exit(1);
  });
}
