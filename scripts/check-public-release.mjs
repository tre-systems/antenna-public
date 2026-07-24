#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WRANGLER = 'apps/worker/wrangler.toml';
const TEXT_EXTENSIONS = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.toml',
  '.ts',
  '.tsx',
  '.txt',
  '.yaml',
  '.yml',
]);

const files = execFileSync(
  'git',
  ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
  {
    cwd: ROOT,
  },
)
  .toString('utf8')
  .split('\0')
  .filter(
    (file) =>
      file && file !== 'scripts/check-public-release.mjs' && TEXT_EXTENSIONS.has(extname(file)),
  );

const forbidden = [
  { pattern: /\bTRE Antenna\b/i, reason: 'private product name' },
  { pattern: /Total Reality Engineering/i, reason: 'private parent-brand endorsement' },
  { pattern: /https?:\/\/antenna\.tre\.systems/i, reason: 'private production origin' },
];

const errors = [];
for (const file of files) {
  const text = readFileSync(resolve(ROOT, file), 'utf8');
  for (const rule of forbidden) {
    if (rule.pattern.test(text)) errors.push(`${file}: contains ${rule.reason}`);
  }
}

const wrangler = readFileSync(resolve(ROOT, WRANGLER), 'utf8');
if (!/database_id\s*=\s*"00000000-0000-0000-0000-000000000000"/.test(wrangler)) {
  errors.push(`${WRANGLER}: D1 database ID must remain the public placeholder`);
}
if (!/BETTER_AUTH_URL\s*=\s*"http:\/\/localhost:8787"/.test(wrangler)) {
  errors.push(`${WRANGLER}: auth origin must remain the local public default`);
}
if (/^\s*(routes\s*=|\[\[routes\]\])/m.test(wrangler)) {
  errors.push(`${WRANGLER}: production routes belong only in operator deployment config`);
}

if (errors.length > 0) {
  console.error('Public release isolation check failed:');
  for (const error of errors) console.error(`  ${error}`);
  process.exit(1);
}

console.log(`OK - checked ${files.length} public text files and deployment placeholders.`);
