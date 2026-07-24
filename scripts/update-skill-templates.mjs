import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const registryIndexPath = join(root, 'packages/registry/src/index.ts');
const skillPath = join(root, 'skills/antenna/SKILL.md');
const beginMarker = '<!-- BEGIN GENERATED TEMPLATE LIST -->';
const endMarker = '<!-- END GENERATED TEMPLATE LIST -->';

const mode = process.argv[2];
if (mode !== '--write' && mode !== '--check') {
  throw new Error('Usage: node scripts/update-skill-templates.mjs --write|--check');
}

const nextSkill = updateSkill(readFileSync(skillPath, 'utf8'), readTemplates());

if (mode === '--write') {
  writeFileSync(skillPath, nextSkill);
  console.log('Updated Antenna Skill template list.');
} else {
  const currentSkill = readFileSync(skillPath, 'utf8');
  if (nextSkill !== currentSkill) {
    console.error('Antenna Skill template list is out of date.');
    console.error('Run: npm run skill:templates');
    process.exitCode = 1;
  } else {
    console.log('Antenna Skill template list is current.');
  }
}

function readTemplates() {
  const indexSource = readFileSync(registryIndexPath, 'utf8');
  const imports = new Map();
  for (const match of indexSource.matchAll(
    /import\s+\{\s*([A-Za-z0-9_]+)\s*\}\s+from\s+'\.\/([^']+)';/g,
  )) {
    imports.set(match[1], match[2]);
  }

  const templatesMatch = /export const templates = \[([\s\S]*?)\] as const;/.exec(indexSource);
  if (templatesMatch === null) {
    throw new Error('Could not find registry templates array.');
  }

  return templatesMatch[1]
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((templateName) => {
      const moduleName = imports.get(templateName);
      if (moduleName === undefined) {
        throw new Error(`Could not resolve registry import for ${templateName}.`);
      }
      return readTemplate(templateName, join(root, `packages/registry/src/${moduleName}.ts`));
    });
}

function readTemplate(templateName, templatePath) {
  const source = readFileSync(templatePath, 'utf8');
  const exportIndex = source.indexOf(`export const ${templateName}`);
  if (exportIndex === -1) {
    throw new Error(`Could not find export for ${templateName}.`);
  }
  const signal = source.slice(exportIndex);
  return {
    id: readStringProperty(signal, 'id', templateName),
    displayName: readStringProperty(signal, 'displayName', templateName),
    params: readParamKeys(signal),
    rightsStatus: readStringProperty(signal, 'rightsStatus', templateName),
    refreshSeconds: readNumberProperty(signal, 'defaultRefreshSeconds'),
    private: /\bprivate:\s*true\b/.test(signal),
    plannerDisabled: /\bplannerEnabled:\s*false\b/.test(signal),
    serverSecret: readServerSecret(signal),
  };
}

function updateSkill(skill, templates) {
  const generatedSection = [
    beginMarker,
    '',
    ...templates.map((template) => `- ${formatTemplate(template)}`),
    endMarker,
  ].join('\n');
  const pattern = new RegExp(`${escapeRegex(beginMarker)}[\\s\\S]*?${escapeRegex(endMarker)}`);
  if (!pattern.test(skill)) {
    throw new Error(`Could not find generated template markers in ${skillPath}.`);
  }
  return skill.replace(pattern, generatedSection);
}

function formatTemplate(template) {
  const parts = [
    `\`${template.id}\` - ${template.displayName}`,
    `params: ${formatParams(template.params)}`,
    `rights: ${template.rightsStatus}`,
    `refresh: ${formatRefresh(template.refreshSeconds)}`,
  ];
  if (template.serverSecret !== null) {
    parts.push(`secret: \`${template.serverSecret}\``);
  }
  if (template.private) {
    parts.push('private');
  }
  if (template.plannerDisabled) {
    parts.push('planner disabled');
  }
  return `${parts.join('; ')}.`;
}

function readStringProperty(signal, propertyName, templateName) {
  const pattern = new RegExp(`\\b${propertyName}:\\s*'([^']+)'`);
  const match = pattern.exec(signal);
  if (match === null || match[1] === undefined) {
    throw new Error(`Could not read ${propertyName} for ${templateName}.`);
  }
  return match[1];
}

function readNumberProperty(signal, propertyName) {
  const pattern = new RegExp(`\\b${propertyName}:\\s*([0-9_]+)`);
  const match = pattern.exec(signal);
  if (match === null || match[1] === undefined) {
    return null;
  }
  return Number(match[1].replaceAll('_', ''));
}

function readParamKeys(signal) {
  const match = /\bparamKeys:\s*\[([^\]]*)\]/.exec(signal);
  if (match === null || match[1] === undefined) {
    return [];
  }
  return [...match[1].matchAll(/'([^']+)'/g)].map((item) => item[1]).filter(Boolean);
}

function readServerSecret(signal) {
  const match = /\bserverSecret:\s*\{[\s\S]*?\benv:\s*'([^']+)'/.exec(signal);
  return match?.[1] ?? null;
}

function formatParams(params) {
  if (params.length === 0) return 'none';
  return params.map((param) => `\`${param}\``).join(', ');
}

function formatRefresh(seconds) {
  if (seconds === null) return 'unknown';
  if (seconds % 86_400 === 0) return `${seconds / 86_400}d`;
  if (seconds % 3_600 === 0) return `${seconds / 3_600}h`;
  if (seconds % 60 === 0) return `${seconds / 60}m`;
  return `${seconds}s`;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
