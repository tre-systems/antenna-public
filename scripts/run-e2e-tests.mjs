#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const e2eDir = join(process.cwd(), 'tests', 'e2e');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
// Must match the port in playwright.config.ts.
const E2E_PORT = 8787;

// A wrangler dev left over from an earlier run answers /healthz but is bound to
// a different D1, so the suite would fail every API call for reasons that look
// nothing like the real cause. Catch it before Playwright starts and say what
// to do about it.
function portInUse(port) {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.once('error', (err) => resolve(err.code === 'EADDRINUSE'));
    probe.once('listening', () => probe.close(() => resolve(false)));
    probe.listen(port, '127.0.0.1');
  });
}

function hasSpecs(dir) {
  if (!existsSync(dir)) return false;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (hasSpecs(full)) return true;
    } else if (/\.(spec|test)\.(t|j)sx?$/.test(entry)) {
      return true;
    }
  }
  return false;
}

if (!hasSpecs(e2eDir)) {
  console.log('e2e: no Playwright tests yet, skipping');
  process.exit(0);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.error) {
    console.error(`e2e: failed to start ${command}: ${result.error.message}`);
    return 1;
  }
  return result.status ?? 1;
}

const configuredBaseURL = process.env.BASE_URL?.trim();
const usesManagedLocalServer = !configuredBaseURL;
const providedPersistTo = process.env.E2E_WRANGLER_PERSIST_TO?.trim();
const generatedPersistTo = usesManagedLocalServer && !providedPersistTo;
const persistTo = usesManagedLocalServer
  ? providedPersistTo || mkdtempSync(join(tmpdir(), 'antenna-e2e-'))
  : providedPersistTo;

function cleanTestEnv(extra = {}) {
  const env = { ...process.env, WRANGLER_HIDE_BANNER: 'true', ...extra };
  delete env.NO_COLOR;
  return env;
}

let exitCode = 0;
try {
  const testEnv = usesManagedLocalServer
    ? cleanTestEnv({ E2E_WRANGLER_PERSIST_TO: persistTo })
    : cleanTestEnv();

  if (usesManagedLocalServer && (await portInUse(E2E_PORT))) {
    console.error(
      [
        `e2e: something is already listening on 127.0.0.1:${E2E_PORT}.`,
        'This run needs that port for its own worker, pointed at a throwaway D1.',
        'A leftover `wrangler dev` is the usual cause — stop it, or run against it',
        `directly with BASE_URL=http://127.0.0.1:${E2E_PORT} npx playwright test.`,
      ].join('\n'),
    );
    exitCode = 1;
  }

  if (exitCode === 0 && usesManagedLocalServer) {
    console.log(`e2e: preparing local D1 state in ${persistTo}`);
    exitCode = run(
      npmCommand,
      ['run', 'db:migrate:local', '--workspace=apps/worker', '--', '--persist-to', persistTo],
      {
        env: cleanTestEnv({ CI: process.env.CI || 'true' }),
      },
    );
  }

  if (exitCode === 0) {
    exitCode = run(npxCommand, ['playwright', 'test', ...process.argv.slice(2)], { env: testEnv });
  }
} finally {
  if (generatedPersistTo) {
    rmSync(persistTo, { recursive: true, force: true });
  }
}

process.exit(exitCode);
