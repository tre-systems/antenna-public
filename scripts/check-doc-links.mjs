#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROOTS = ['README.md', 'AGENTS.md', 'CLAUDE.md', 'docs', 'skills'];

const walk = (relPath) => {
  const fullPath = resolve(ROOT, relPath);
  try {
    if (statSync(fullPath).isDirectory()) {
      return readdirSync(fullPath).flatMap((entry) => walk(join(relPath, entry)));
    }
  } catch {
    return [];
  }
  return fullPath.endsWith('.md') ? [relPath] : [];
};

const files = ROOTS.flatMap(walk);

const slugify = (heading) =>
  heading
    .toLowerCase()
    .trim()
    .replace(/[`*_~]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-');

const headingsByFile = new Map();

for (const file of files) {
  const text = readFileSync(resolve(ROOT, file), 'utf8');
  const anchors = new Set();
  let inFence = false;
  for (const line of text.split('\n')) {
    if (/^```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (match?.[2]) anchors.add(slugify(match[2]));
  }
  headingsByFile.set(file, anchors);
}

const errors = [];

for (const file of files) {
  const abs = resolve(ROOT, file);
  const lines = readFileSync(abs, 'utf8').split('\n');
  const masked = new Array(lines.length).fill(false);
  let inFence = false;

  for (let i = 0; i < lines.length; i += 1) {
    if (/^```/.test(lines[i])) {
      inFence = !inFence;
      masked[i] = true;
      continue;
    }
    masked[i] = inFence;
  }

  const linkRe = /!?\[([^\]]*)\]\(([^)\s]+)\)/g;
  for (const [i, line] of lines.entries()) {
    if (masked[i]) continue;
    const stripped = line.replace(/`[^`]*`/g, (match) => ' '.repeat(match.length));
    let match;
    while ((match = linkRe.exec(stripped)) !== null) {
      const href = match[2];
      if (!href) continue;
      if (/^[a-z]+:/i.test(href) || href.startsWith('#')) {
        if (href.startsWith('#') && !headingsByFile.get(file)?.has(href.slice(1))) {
          errors.push(`${file}:${i + 1} missing anchor ${href}`);
        }
        continue;
      }

      const [pathPart, anchor] = href.split('#');
      const targetAbs = resolve(dirname(abs), decodeURIComponent(pathPart));
      const targetRel = relative(ROOT, targetAbs);
      try {
        statSync(targetAbs);
      } catch {
        errors.push(`${file}:${i + 1} missing file ${href} (resolves to ${targetRel})`);
        continue;
      }

      if (anchor && targetAbs.endsWith('.md')) {
        const anchors = headingsByFile.get(targetRel);
        if (anchors && !anchors.has(anchor)) {
          errors.push(`${file}:${i + 1} missing anchor ${href} (in ${targetRel})`);
        }
      }
    }
  }
}

if (errors.length > 0) {
  console.error(`Found ${errors.length} broken doc link(s):`);
  for (const error of errors) console.error(`  ${error}`);
  process.exit(1);
}

console.log(`OK - checked ${files.length} markdown files, no broken internal links.`);
