#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_ROOTS = ['apps', 'packages'];

const PACKAGE_BY_DIR = new Map([
  ['packages/shared', '@antenna/shared'],
  ['packages/connectors', '@antenna/connectors'],
  ['packages/registry', '@antenna/registry'],
  ['apps/mcp', '@antenna/mcp'],
  ['apps/worker', '@antenna/worker'],
  ['apps/web', '@antenna/web'],
]);

const PACKAGE_RULES = {
  '@antenna/shared': {
    allowedPackages: new Set([]),
    bannedRelativePrefixes: ['apps/', 'packages/connectors/', 'packages/registry/'],
  },
  '@antenna/connectors': {
    allowedPackages: new Set(['@antenna/shared']),
    bannedRelativePrefixes: ['apps/', 'packages/registry/'],
  },
  '@antenna/registry': {
    allowedPackages: new Set(['@antenna/connectors', '@antenna/shared']),
    bannedRelativePrefixes: ['apps/'],
  },
  '@antenna/mcp': {
    allowedPackages: new Set(['@antenna/shared']),
    bannedRelativePrefixes: [
      'apps/web/',
      'apps/worker/',
      'packages/connectors/',
      'packages/registry/',
    ],
  },
  '@antenna/worker': {
    allowedPackages: new Set([
      '@antenna/connectors',
      '@antenna/registry',
      '@antenna/shared',
      '@antenna/mcp',
    ]),
    bannedRelativePrefixes: ['apps/web/'],
  },
  '@antenna/web': {
    allowedPackages: new Set(['@antenna/shared', '@antenna/registry/src/display']),
    bannedRelativePrefixes: ['apps/worker/', 'apps/mcp/', 'packages/connectors/'],
  },
};

const walk = (relPath) => {
  const fullPath = resolve(ROOT, relPath);
  if (statSync(fullPath).isDirectory()) {
    return readdirSync(fullPath).flatMap((entry) => {
      if (entry === 'node_modules' || entry === 'dist' || entry === '.wrangler') return [];
      return walk(join(relPath, entry));
    });
  }
  return /\.(ts|tsx|js|mjs)$/.test(relPath) ? [relPath] : [];
};

const packageForFile = (file) => {
  let best = null;
  for (const [dir, packageName] of PACKAGE_BY_DIR) {
    if (file === dir || file.startsWith(`${dir}/`)) {
      if (!best || dir.length > best.dir.length) best = { dir, packageName };
    }
  }
  return best;
};

const importSpecifiers = (text) => {
  const specs = [];
  const patterns = [
    /\bimport\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /\bexport\s+(?:type\s+)?[\s\S]*?\s+from\s+['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      if (match[1]) specs.push(match[1]);
    }
  }
  return specs;
};

const antennaPackage = (specifier) => {
  const match = /^(@antenna\/[^/]+)(\/.*)?$/.exec(specifier);
  if (!match) return null;
  return `${match[1]}${match[2] ?? ''}`;
};

const normalizedRelativeImport = (fromFile, specifier) => {
  if (!specifier.startsWith('.')) return null;
  const fromAbs = resolve(ROOT, fromFile);
  const targetAbs = resolve(dirname(fromAbs), specifier);
  return relative(ROOT, targetAbs).replaceAll('\\', '/');
};

const errors = [];
const files = SOURCE_ROOTS.flatMap(walk);

for (const file of files) {
  const owner = packageForFile(file);
  if (!owner) continue;
  const rules = PACKAGE_RULES[owner.packageName];
  if (!rules) continue;
  const text = readFileSync(resolve(ROOT, file), 'utf8');

  for (const specifier of importSpecifiers(text)) {
    const antenna = antennaPackage(specifier);
    if (antenna) {
      const allowed = [...rules.allowedPackages].some(
        (allowedPrefix) => antenna === allowedPrefix || antenna.startsWith(`${allowedPrefix}/`),
      );
      if (!allowed) {
        errors.push(`${file}: ${owner.packageName} must not import ${specifier}`);
      }
    }

    const relativeTarget = normalizedRelativeImport(file, specifier);
    if (relativeTarget) {
      for (const bannedPrefix of rules.bannedRelativePrefixes) {
        if (relativeTarget.startsWith(bannedPrefix)) {
          errors.push(`${file}: ${owner.packageName} must not reach into ${relativeTarget}`);
        }
      }
    }
  }
}

if (errors.length > 0) {
  console.error(`Found ${errors.length} import-boundary violation(s):`);
  for (const error of errors) console.error(`  ${error}`);
  process.exit(1);
}

console.log(`OK - checked ${files.length} source files, import boundaries hold.`);
