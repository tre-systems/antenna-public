#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const repoRoot = process.cwd();
const diagramDir = join(repoRoot, 'docs', 'diagrams');

// CI installs Graphviz before `npm run verify`; local machines without it skip.
const probe = spawnSync('dot', ['-V'], { stdio: 'ignore' });
if (probe.error || probe.status !== 0) {
  console.log('Diagram check skipped: Graphviz `dot` not available on PATH.');
  process.exit(0);
}

const tempDir = mkdtempSync(join(tmpdir(), 'antenna-diagrams-'));

const dotFiles = readdirSync(diagramDir)
  .filter((file) => file.endsWith('.dot'))
  .sort();

if (dotFiles.length === 0) {
  console.error('No .dot files found in docs/diagrams.');
  process.exit(1);
}

const failures = [];

// PNGs are not byte-compared: Graphviz/libcairo output differs across versions.
try {
  for (const file of dotFiles) {
    const source = join(diagramDir, file);
    const expectedPng = source.replace(/\.dot$/, '.png');
    const renderedPng = join(tempDir, file.replace(/\.dot$/, '.png'));

    if (!existsSync(expectedPng)) {
      failures.push(`${file}: missing committed PNG next to .dot source`);
      continue;
    }

    const result = spawnSync('dot', ['-Tpng:cairo', source, '-Gdpi=220', '-o', renderedPng], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    if (result.error) {
      failures.push(`${file}: could not run Graphviz dot (${result.error.message})`);
      continue;
    }
    if (result.status !== 0) {
      failures.push(`${file}: dot exited ${result.status}\n${result.stderr.trim()}`);
      continue;
    }
  }
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error('Diagram check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  console.error('\nRender locally with: npm run diagrams');
  process.exit(1);
}

console.log(`Diagram check passed (${dotFiles.length} diagrams render cleanly).`);
