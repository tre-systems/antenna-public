#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

import ts from 'typescript';

const FILE_LIMIT = 200;
const FUNCTION_LIMIT = 20;
const SOURCE_GLOBS = [
  'apps/**/*.ts',
  'apps/**/*.tsx',
  'packages/**/*.ts',
  'packages/**/*.tsx',
  'scripts/**/*.mjs',
  'scripts/**/*.js',
];

const sourceFiles = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', ...SOURCE_GLOBS],
  {
    encoding: 'utf8',
  },
)
  .trim()
  .split('\n')
  .filter((file) => file.length > 0 && existsSync(file));

const isTestFile = (file) => /\.(test|spec)\./.test(file);

const sourceKind = (file) => {
  if (file.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (file.endsWith('.ts')) return ts.ScriptKind.TS;
  return ts.ScriptKind.JS;
};

const functionName = (node, source) => {
  if (node.name?.getText) return node.name.getText(source);
  const parent = node.parent;
  if ((ts.isArrowFunction(node) || ts.isFunctionExpression(node)) && parent) {
    if (ts.isVariableDeclaration(parent) || ts.isPropertyAssignment(parent)) {
      return parent.name.getText(source);
    }
  }
  if (ts.isConstructorDeclaration(node)) return 'constructor';
  return '<callback>';
};

const countFunctionLines = (file) => {
  const text = readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, sourceKind(file));
  const rows = [];
  const lineOf = (pos) => ts.getLineAndCharacterOfPosition(source, pos).line + 1;

  const visit = (node) => {
    const hasBody =
      (ts.isFunctionDeclaration(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isArrowFunction(node) ||
        ts.isFunctionExpression(node) ||
        ts.isConstructorDeclaration(node) ||
        ts.isGetAccessorDeclaration(node) ||
        ts.isSetAccessorDeclaration(node)) &&
      node.body;

    if (hasBody) {
      const start = lineOf(node.getStart(source));
      const lines = lineOf(node.end) - start + 1;
      if (lines > FUNCTION_LIMIT) {
        rows.push({ file, lines, name: functionName(node, source), start });
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(source);
  return rows;
};

const fileRows = sourceFiles
  .map((file) => ({ file, lines: readFileSync(file, 'utf8').split('\n').length }))
  .filter((row) => row.lines > FILE_LIMIT)
  .sort((a, b) => b.lines - a.lines || a.file.localeCompare(b.file));

const functionRows = sourceFiles
  .flatMap(countFunctionLines)
  .sort((a, b) => b.lines - a.lines || a.file.localeCompare(b.file));

const sourceFileRows = fileRows.filter((row) => !isTestFile(row.file));
const testFileRows = fileRows.filter((row) => isTestFile(row.file));
const sourceFunctionRows = functionRows.filter((row) => !isTestFile(row.file));

const printRows = (title, rows, render) => {
  console.log(`\n${title} (${rows.length})`);
  for (const row of rows.slice(0, 30)) console.log(render(row));
  if (rows.length > 30) console.log(`... ${rows.length - 30} more`);
};

console.log(
  `Size report: ${sourceFiles.length} tracked/untracked TS/JS files, file limit ${FILE_LIMIT}, function limit ${FUNCTION_LIMIT}.`,
);
printRows('Source files over limit', sourceFileRows, (row) => {
  return `${String(row.lines).padStart(5)} ${row.file}`;
});
printRows('Test files over limit', testFileRows, (row) => {
  return `${String(row.lines).padStart(5)} ${row.file}`;
});
printRows('Source functions over limit', sourceFunctionRows, (row) => {
  return `${String(row.lines).padStart(5)} ${row.file}:${row.start} ${row.name}`;
});
