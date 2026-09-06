import { expect } from 'chai';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { dirname, join, relative } from 'path';

/**
 * Guards the `@nestjs/*` deep imports this package relies on.
 *
 * NestJS 12 is ESM-only. `@nestjs/common` and `@nestjs/core` ship an exports
 * map of `{ ".", "./internal", "./*.js", "./*": "./*.js" }`, so a deep import
 * resolves only when `<subpath>.js` is a real file inside the package. A
 * directory index such as `@nestjs/common/interfaces` (a folder holding an
 * `index.js`) resolves under CommonJS on Nest 11 and fails under the exports
 * map on Nest 12 — TS2307 at build time, ERR_MODULE_NOT_FOUND at runtime.
 *
 * This spec scans every `.ts` file in the package (sources and tests) for
 * `@nestjs/<pkg>/<subpath>` specifiers and asserts each one is backed by a
 * regular `<subpath>.js` file, so the directory-import trap cannot come back
 * regardless of which Nest major the current install holds.
 */

const packageDir = join(__dirname, '..');
const SKIPPED_DIRS = new Set(['node_modules', 'dist']);
const DEEP_IMPORT_PATTERN = /['"]@nestjs\/([^/'"]+)\/([^'"]+)['"]/g;

interface DeepImport {
  file: string;
  line: number;
  pkg: string;
  subpath: string;
  specifier: string;
}

function listTypeScriptFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap(entry => {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      return SKIPPED_DIRS.has(entry.name) ? [] : listTypeScriptFiles(fullPath);
    }
    return entry.name.endsWith('.ts') ? [fullPath] : [];
  });
}

function collectDeepImports(files: string[]): DeepImport[] {
  const found: DeepImport[] = [];
  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((text, index) => {
      for (const match of text.matchAll(DEEP_IMPORT_PATTERN)) {
        found.push({
          file: relative(packageDir, file),
          line: index + 1,
          pkg: match[1],
          subpath: match[2],
          specifier: `@nestjs/${match[1]}/${match[2]}`,
        });
      }
    });
  }
  return found;
}

/**
 * Locates the installed `@nestjs/<pkg>` directory by walking up from the
 * package the way Node's `node_modules` lookup does. Deliberately does not go
 * through `require.resolve`: under Nest 12's exports map even
 * `@nestjs/common/package.json` is not an exported subpath.
 */
function findInstalledPackage(pkg: string): string {
  let current = packageDir;
  for (;;) {
    const candidate = join(current, 'node_modules', '@nestjs', pkg);
    if (existsSync(join(candidate, 'package.json'))) {
      return candidate;
    }
    const parent = dirname(current);
    if (parent === current) {
      throw new Error(`@nestjs/${pkg} is not installed above ${packageDir}`);
    }
    current = parent;
  }
}

function resolvesToFile(pkg: string, subpath: string): boolean {
  const fileName = subpath.endsWith('.js') ? subpath : `${subpath}.js`;
  const target = join(findInstalledPackage(pkg), fileName);
  return existsSync(target) && statSync(target).isFile();
}

describe('@nestjs/* deep imports', () => {
  const deepImports = collectDeepImports(listTypeScriptFiles(packageDir));

  it('scans the package and finds the deep imports it relies on', () => {
    const specifiers = deepImports.map(entry => entry.specifier);
    expect(specifiers).to.include('@nestjs/core/injector/constants');
    expect(specifiers).to.include('@nestjs/core/helpers/execution-context-host');
  });

  it('rejects a directory index, which the Nest 12 exports map cannot resolve', () => {
    // Built by concatenation so the scanner above does not pick this up as a
    // real import. `interfaces/` is a directory on both Nest 11 and Nest 12.
    const directorySubpath = ['interfaces'].join('');
    expect(resolvesToFile('common', directorySubpath)).to.equal(false);
  });

  it('only deep-imports subpaths that resolve to a real file inside the package', () => {
    const offenders = deepImports
      .filter(entry => !resolvesToFile(entry.pkg, entry.subpath))
      .map(
        entry =>
          `${entry.file}:${entry.line} imports '${entry.specifier}' but ` +
          `node_modules/@nestjs/${entry.pkg}/${entry.subpath}.js is not a file ` +
          `(directory indexes do not resolve under the NestJS 12 exports map)`,
      );

    expect(offenders, offenders.join('\n')).to.deep.equal([]);
  });
});
