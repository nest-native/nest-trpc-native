import fs from 'node:fs';
import path from 'node:path';

// The Compatibility tables in README.md and packages/trpc/README.md (the README
// npm shows), the Runtime Compatibility lists in the support policy and
// installation docs, and the guidelines' support line all state the Node floor
// and the NestJS peer range as literals. Twice in a row a change left one of
// them behind — the Node 20 sunset kept the package README on `>=20`, and the
// NestJS 12 widening kept it on `11.x` — so this check pins every row to
// packages/trpc/package.json. Inside a Markdown table cell `|` is written `\|`.

const repoRoot = process.cwd();
const manifestPath = 'packages/trpc/package.json';
const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, manifestPath), 'utf8'));

const nestRange = manifest.peerDependencies['@nestjs/common'];
const nestCoreRange = manifest.peerDependencies['@nestjs/core'];
if (nestCoreRange !== nestRange) {
  throw new Error(
    `${manifestPath}: @nestjs/common (${nestRange}) and @nestjs/core (${nestCoreRange}) peer ranges differ`,
  );
}

const rows = [
  { label: 'Node.js', literal: manifest.engines.node },
  { label: 'NestJS', literal: nestRange },
];

const markdownFiles = [
  'README.md',
  'packages/trpc/README.md',
  'website/docs/support-policy.md',
  'website/docs/installation.md',
  'GUIDELINES_NEST_TRPC.md',
];

// `| Node.js | `...` |` in a table row, `- Node.js `...`` in a list item. The
// cell must start with a backtick so prose such as "- NestJS 12 is ESM-only"
// is not mistaken for the support line.
const rowPattern = label =>
  new RegExp(`^\\s*(?:\\|\\s*|-\\s+)${label.replace(/\\./g, '\\\\.')}\\s*(?:\\|\\s*)?(\`.*)$`);

const failures = [];

for (const relativeFilePath of markdownFiles) {
  const lines = fs.readFileSync(path.join(repoRoot, relativeFilePath), 'utf8').split('\n');

  for (const { label, literal } of rows) {
    const pattern = rowPattern(label);
    const cells = lines
      .map(line => line.match(pattern)?.[1])
      .filter(cell => cell !== undefined)
      .map(cell => cell.replace(/\\\|/g, '|'));

    if (cells.length === 0) {
      failures.push(`${relativeFilePath}: no "${label}" compatibility row found`);
    } else if (!cells.some(cell => cell.includes(`\`${literal}\``))) {
      failures.push(
        `${relativeFilePath}: "${label}" row does not state \`${literal}\` from ${manifestPath} (found: ${cells.join(' / ')})`,
      );
    }
  }
}

if (failures.length > 0) {
  throw new Error(`Compatibility table drift detected:\n${failures.join('\n')}`);
}

console.log(
  `Compatibility tables OK: ${markdownFiles.length} pages state Node.js ${manifest.engines.node} and NestJS ${nestRange}.`,
);
