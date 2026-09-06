/**
 * Proves which NestJS major every workspace actually resolves.
 *
 * Usage: node scripts/check-nestjs-major.mjs <major>
 *
 * The `nestjs-latest-major` CI leg installs the NestJS 12 set on top of the
 * lockfile with `--no-save`. The samples pin `@nestjs/*` to an exact 11.x, so
 * an install that is not applied to every workspace can leave a nested 11
 * copy under a sample — and the samples then "pass on 12" while running on 11.
 * This script resolves each declared framework package from inside each
 * workspace, the same way Node does at runtime, prints the version it finds,
 * and fails if any of them is not the requested major.
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const FRAMEWORK_PACKAGES = new Set([
  '@nestjs/common',
  '@nestjs/core',
  '@nestjs/microservices',
  '@nestjs/platform-express',
  '@nestjs/platform-fastify',
  '@nestjs/testing',
]);

const expectedMajor = Number.parseInt(process.argv[2] ?? '', 10);
if (!Number.isInteger(expectedMajor)) {
  console.error('Usage: node scripts/check-nestjs-major.mjs <major>');
  process.exit(2);
}

const repoRoot = process.cwd();
const rootManifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));

function expandWorkspaceGlob(pattern) {
  // Only the `dir/*` shape is used in this repo's `workspaces` field.
  const [parent, star] = pattern.split('/');
  if (star !== '*') {
    return [pattern];
  }
  return fs
    .readdirSync(path.join(repoRoot, parent), { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => `${parent}/${entry.name}`)
    .filter(dir => fs.existsSync(path.join(repoRoot, dir, 'package.json')));
}

function findPackageRoot(resolvedFile, name) {
  let current = path.dirname(resolvedFile);
  for (;;) {
    const manifestPath = path.join(current, 'package.json');
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      if (manifest.name === name) {
        return { dir: current, version: manifest.version };
      }
    }
    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error(`Could not find the package root of ${name} above ${resolvedFile}`);
    }
    current = parent;
  }
}

const workspaces = ['.', ...rootManifest.workspaces.flatMap(expandWorkspaceGlob)];
const failures = [];

for (const workspace of workspaces) {
  const workspaceDir = path.join(repoRoot, workspace);
  const manifest = JSON.parse(fs.readFileSync(path.join(workspaceDir, 'package.json'), 'utf8'));
  const declared = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies })
    .filter(name => FRAMEWORK_PACKAGES.has(name))
    .sort();
  const localRequire = createRequire(path.join(workspaceDir, 'package.json'));

  for (const name of declared) {
    const { dir, version } = findPackageRoot(localRequire.resolve(name), name);
    const major = Number.parseInt(version.split('.')[0], 10);
    const status = major === expectedMajor ? 'ok' : 'WRONG MAJOR';
    console.log(`${workspace.padEnd(44)} ${name.padEnd(28)} ${version.padEnd(10)} ${path.relative(repoRoot, dir)}  ${status}`);
    if (major !== expectedMajor) {
      failures.push(`${workspace}: ${name} resolves to ${version} from ${path.relative(repoRoot, dir)}`);
    }
  }
}

if (failures.length > 0) {
  console.error(`\nExpected every workspace to resolve NestJS ${expectedMajor}.x, but:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log(`\nEvery workspace resolves NestJS ${expectedMajor}.x.`);
