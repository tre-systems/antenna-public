#!/usr/bin/env node
import { gzipSync } from 'node:zlib';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS_DIR = resolve(ROOT, 'apps/web/dist/assets');

// Budgets track deliberate feature growth. The Cloudflare fleet card now
// includes aligned 24-hour comparisons; keep one kilobyte of headroom so the
// Linux and macOS gzip implementations both enforce the same practical limit.
const limits = {
  jsGzip: readLimit('ANTENNA_MAX_JS_GZIP_BYTES', 115_000),
  cssGzip: readLimit('ANTENNA_MAX_CSS_GZIP_BYTES', 30_000),
  totalGzip: readLimit('ANTENNA_MAX_TOTAL_GZIP_BYTES', 128_000),
};

function readLimit(name, fallback) {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive byte count.`);
  }
  return parsed;
}

function filesWithExtension(extension) {
  try {
    return readdirSync(ASSETS_DIR)
      .filter((file) => file.endsWith(extension))
      .map((file) => join(ASSETS_DIR, file));
  } catch {
    console.error('Bundle assets not found. Run `npm run build --workspace=apps/web` first.');
    process.exit(1);
  }
}

function gzipBytes(files) {
  return files.reduce((sum, file) => sum + gzipSync(readFileSync(file)).byteLength, 0);
}

function rawBytes(files) {
  return files.reduce((sum, file) => sum + statSync(file).size, 0);
}

const jsFiles = filesWithExtension('.js');
const cssFiles = filesWithExtension('.css');
const jsGzip = gzipBytes(jsFiles);
const cssGzip = gzipBytes(cssFiles);
const totalGzip = jsGzip + cssGzip;
const summary = {
  js_raw: rawBytes(jsFiles),
  js_gzip: jsGzip,
  css_raw: rawBytes(cssFiles),
  css_gzip: cssGzip,
  total_gzip: totalGzip,
  limits,
};

const failures = [];
if (jsGzip > limits.jsGzip) failures.push(`JS gzip ${jsGzip} > ${limits.jsGzip}`);
if (cssGzip > limits.cssGzip) failures.push(`CSS gzip ${cssGzip} > ${limits.cssGzip}`);
if (totalGzip > limits.totalGzip) failures.push(`total gzip ${totalGzip} > ${limits.totalGzip}`);

console.log(JSON.stringify(summary, null, 2));

if (failures.length > 0) {
  console.error(`Bundle size check failed: ${failures.join('; ')}`);
  process.exit(1);
}
