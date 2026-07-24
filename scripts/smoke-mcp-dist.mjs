import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const build = spawnSync('npm', ['run', 'build', '--workspace=@antenna/mcp'], {
  stdio: 'inherit',
});

if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

await import(new URL('../apps/mcp/dist/index.js', import.meta.url));
await import('@antenna/mcp');
await import('@antenna/mcp/factory');

for (const entrypoint of ['server.js', 'token-cli.js']) {
  const path = new URL(`../apps/mcp/dist/${entrypoint}`, import.meta.url);
  const firstLine = readFileSync(path, 'utf8').split('\n')[0];
  if (firstLine !== '#!/usr/bin/env node') {
    throw new Error(`MCP dist ${entrypoint} is missing a node shebang.`);
  }
}

const tokenHelp = spawnSync('node', ['apps/mcp/dist/token-cli.js', '--help'], {
  encoding: 'utf8',
});
if (tokenHelp.status !== 0) {
  process.stderr.write(tokenHelp.stderr);
  process.exit(tokenHelp.status ?? 1);
}
if (
  !tokenHelp.stdout.includes('antenna-mcp-token list') ||
  !tokenHelp.stdout.includes('antenna-mcp-token revoke') ||
  tokenHelp.stdout.includes('antenna-mcp-token create')
) {
  throw new Error('MCP token CLI help did not expose the expected legacy list/revoke commands.');
}

const httpSmoke = spawnSync('node', ['scripts/smoke-mcp-http.mjs'], {
  stdio: 'inherit',
  env: process.env,
});
if (httpSmoke.status !== 0) {
  process.exit(httpSmoke.status ?? 1);
}

console.log('MCP dist smoke passed.');
