#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = process.cwd();

const hasWorkspaces = ['apps', 'packages'].some((dir) => {
  const full = join(repoRoot, dir);
  return existsSync(full) && readdirSync(full).length > 0;
});

if (!hasWorkspaces) {
  console.log('typecheck: no workspaces yet, skipping');
  process.exit(0);
}

const result = spawnSync('npm', ['run', 'typecheck', '--workspaces', '--if-present'], {
  stdio: 'inherit',
});
if (result.error) {
  console.error(`typecheck: failed to start npm (${result.error.message})`);
}
process.exit(result.status ?? 1);
