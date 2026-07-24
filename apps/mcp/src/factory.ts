import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createAntennaReadClient, type AntennaClientOptions } from './client.js';
import { registerPrompts } from './factory-prompts.js';
import { registerReadTools } from './factory-read-tools.js';
import { registerResources } from './factory-resources.js';
import { registerWriteTools } from './factory-write-tools.js';

export function createAntennaMcpServer(options: AntennaClientOptions): McpServer {
  const client = createAntennaReadClient(options);
  const server = new McpServer({
    name: 'antenna',
    version: '0.1.0',
  });

  registerReadTools(server, client);
  registerWriteTools(server, client);
  registerResources(server, client);
  registerPrompts(server);

  return server;
}
